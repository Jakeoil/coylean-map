// ═══════════════════════════════════════════════════
//  Coylean Glyphs — Substitution Explorer + Universe View
// ═══════════════════════════════════════════════════
//
// Two interactive views built on the canonical V substitution table:
//   * Explorer — seeded from computeMapModel(32,32) at the current dyadic
//     offset (so at 1/1 it's the clean single-arrow map; at other offsets
//     it's that offset's actual order-5 map). Click a section to substitute
//     one level deeper (order 5 → 6 → 7 …), zoom-out stack.
//   * Universe — the FULL symmetric universe at order 5, propagated from
//     extent 32 in each of N, S, W, E (Propagation.fromUniverseExtents),
//     sectioned into 16×16. The centre is the universe origin; reseeds
//     when lat/long changes (the offset is baked into the boundary).
// Each render compares the substitution-driven grid to truth = computeMapModel
// at the current offset and order; cells that disagree are tinted red. At 1/1
// substitution is a fixed point, so divergence is empty everywhere. At other
// dyadic offsets, divergence reveals where and at what order the substitution
// rule starts mispredicting the true propagation.

import { Seniority, Propagation } from "coylean/core";
import {
    getSectionData,
    GLYPH_LETTERS,
    H_GLYPH_LETTERS,
    setWorkingAssignments,
    setOldAssignments,
    applyAssignments,
    setOffset,
    computeMapModel,
    computeGlyphMatrices,
    computePattern,
    transformedPatternKey,
    classifyVisualD4,
    d4Compose,
} from "./glyph-core.js";
import {
    drawSection,
    renderState,
    V_COLOR,
    H_COLOR,
    CELL_PX,
    toFt,
    glyphLabel,
    hGlyphLabel,
    ensureBabyBlocksLoaded,
    babyBlocksReady,
} from "./glyph-render.js";

// Cells per section side (Coylean structural constant).
const SEC = 4;
// Base order: both views' seed grids are 8 sections × 8 sections (order 5).
const BASE_NS = 8;

// Current dyadic offset; mirrored from the sidebar inputs. Used to (re)seed
// the explorer and to compute the truth map for divergence marking.
let currentH = 1, currentV = 1;
let currentSeniority = Seniority.vertical();

// ── D4 extrapolation helpers (must precede SUB_TABLE_V/H init below) ──
// Canonical propagation reaches ~34 codes out of 64. The remaining codes are
// reachable from a known one by a D4 transform of the section pattern. For
// each missing code we find an orbit-sibling with a rule, then map the rule
// across by:
//   * permuting the 2×2 children's POSITIONS via D4_POS (where each cell
//     lands under the transform);
//   * transforming each child's CODE via CODE_UNDER_D4_{V,H} (a 64×8 lookup
//     of where each (d, r) lands under each D4 element); and
//   * permuting the 4 internal-boundary flags via D4_BND (the boundary
//     between two cells maps to the boundary between their new positions).

// D4_POS[g][p] = new position of cell p under D4 element g, with cells
// numbered 0=NW (0,0), 1=NE (0,1), 2=SW (1,0), 3=SE (1,1).
const D4_POS = [
    [0, 1, 2, 3], // 0 e        identity
    [1, 3, 0, 2], // 1 r        90° CW (NW→NE, NE→SE, SW→NW, SE→SW)
    [3, 2, 1, 0], // 2 r²       180°
    [2, 0, 3, 1], // 3 r³       270° CW
    [2, 3, 0, 1], // 4 s_h      flip top-bottom (NW↔SW, NE↔SE)
    [1, 0, 3, 2], // 5 s_v      flip left-right (NW↔NE, SW↔SE)
    [0, 2, 1, 3], // 6 s_d1     transpose along main diag (NE↔SW)
    [3, 1, 2, 0], // 7 s_d2     anti-diagonal (NW↔SE)
];

// D4_BND[g][b] = boundary index that boundary b maps to under D4 element g,
// where boundaries are 0=vBoundTop (NW/NE), 1=vBoundBot (SW/SE),
// 2=hBoundLeft (NW/SW), 3=hBoundRight (NE/SE).
const D4_BND = [
    [0, 1, 2, 3], // 0 e
    [3, 2, 0, 1], // 1 r
    [1, 0, 3, 2], // 2 r²
    [2, 3, 1, 0], // 3 r³
    [1, 0, 2, 3], // 4 s_h
    [0, 1, 3, 2], // 5 s_v
    [2, 3, 0, 1], // 6 s_d1
    [3, 2, 1, 0], // 7 s_d2
];

const D4_INV = (() => {
    const inv = new Array(8);
    for (let g = 0; g < 8; g++)
        for (let k = 0; k < 8; k++)
            if (d4Compose(g, k) === 0) { inv[g] = k; break; }
    return inv;
})();

function buildCodeUnderD4(seniority) {
    const keyToCode = new Map();
    for (let d = 0; d < 8; d++) {
        for (let r = 0; r < 8; r++) {
            const { v, h } = computePattern(d, r, seniority);
            keyToCode.set(transformedPatternKey(v, h, 0), [d, r]);
        }
    }
    const table = {};
    for (let d = 0; d < 8; d++) {
        for (let r = 0; r < 8; r++) {
            const { v, h } = computePattern(d, r, seniority);
            const lookup = new Array(8);
            for (let ti = 0; ti < 8; ti++) {
                lookup[ti] = keyToCode.get(transformedPatternKey(v, h, ti));
            }
            table[d + "," + r] = lookup;
        }
    }
    return table;
}
const CODE_UNDER_D4_V = buildCodeUnderD4(Seniority.vertical());
const CODE_UNDER_D4_H = buildCodeUnderD4(Seniority.horizontal());

function applyD4ToRule(rule, ti, codeTable) {
    const newChildren = new Array(4);
    for (let i = 0; i < 4; i++) {
        const [d, r] = rule.children[i];
        newChildren[D4_POS[ti][i]] = [...codeTable[d + "," + r][ti]];
    }
    const oldB = [
        rule.vBoundTop, rule.vBoundBot, rule.hBoundLeft, rule.hBoundRight,
    ];
    const newB = [false, false, false, false];
    for (let i = 0; i < 4; i++) newB[D4_BND[ti][i]] = oldB[i];
    return {
        children: newChildren,
        vBoundTop: newB[0], vBoundBot: newB[1],
        hBoundLeft: newB[2], hBoundRight: newB[3],
    };
}

function extrapolateSubTable(baseTable, seniority) {
    const out = { ...baseTable };
    const classes = classifyVisualD4(seniority);
    const codeTable = seniority.isVertical
        ? CODE_UNDER_D4_V : CODE_UNDER_D4_H;
    for (const cls of classes) {
        let canonI = -1;
        for (let i = 0; i < cls.orbit.length; i++) {
            const [d, r] = cls.orbit[i];
            if (baseTable[d + "," + r]) { canonI = i; break; }
        }
        if (canonI < 0) continue; // entire orbit missing — nothing to extrapolate
        const [cd, cr] = cls.orbit[canonI];
        const baseRule = baseTable[cd + "," + cr];
        const tCanonInv = D4_INV[cls.transforms[canonI]];
        for (let i = 0; i < cls.orbit.length; i++) {
            const [d, r] = cls.orbit[i];
            if (out[d + "," + r]) continue;
            const ti = d4Compose(cls.transforms[i], tCanonInv);
            out[d + "," + r] = applyD4ToRule(baseRule, ti, codeTable);
        }
    }
    return out;
}

// ── Substitution Tables (per seniority) ──
// Per-code rule: parent (dc, rc) → 4 child codes + 4 internal-boundary flags
// (the segments dividing the 2×2 child block). Built from canonical clean-map
// section data at orders 5 → 6 and 6 → 7 (deeper catches codes the order-5
// scan didn't hit), then completed within each touched orbit by D4
// extrapolation. One table per seniority — H propagation is a different
// dynamics, so its substitution table differs.
function buildSubTable(sen) {
    const o5 = getSectionData(32, 32, sen);
    const o6 = getSectionData(64, 64, sen);
    const o7 = getSectionData(128, 128, sen);
    const t = {};
    function ingest(parent, child) {
        for (let sr = 0; sr < parent.NSr; sr++) {
            for (let sc = 0; sc < parent.NSc; sc++) {
                const [dc, rc] = parent.codes[sr][sc];
                const k = dc + "," + rc;
                if (t[k]) continue;
                const sr2 = sr * 2, sc2 = sc * 2;
                t[k] = {
                    children: [
                        [...child.codes[sr2][sc2]],
                        [...child.codes[sr2][sc2 + 1]],
                        [...child.codes[sr2 + 1][sc2]],
                        [...child.codes[sr2 + 1][sc2 + 1]],
                    ],
                    vBoundTop: child.vBound[sr2][sc2],
                    vBoundBot: child.vBound[sr2 + 1][sc2],
                    hBoundLeft: child.hBound[sr2][sc2],
                    hBoundRight: child.hBound[sr2][sc2 + 1],
                };
            }
        }
    }
    ingest(o5, o6);
    ingest(o6, o7);
    return t;
}
const SUB_TABLE_V = extrapolateSubTable(
    buildSubTable(Seniority.vertical()), Seniority.vertical());
const SUB_TABLE_H = extrapolateSubTable(
    buildSubTable(Seniority.horizontal()), Seniority.horizontal());
function currentSubTable() {
    return currentSeniority.isVertical ? SUB_TABLE_V : SUB_TABLE_H;
}

// ── Off-anchor tromino expansion ──
// Off the anchor family lat/long ∈ {0,1}², the 6-bit-code substitution is NOT a
// fixed point, but the rule IS a stable function of the (self, North, West) cage
// triple — the SE-upstream L-tromino (propagation flows SE, so a cage's
// refinement is fed by what's above and to its left). When enabled, expandGrid
// keys on that triple, using a table built from the CURRENT offset's own map
// (orders 6→7). The table is offset-specific. Cells with no N/W context (top
// row / left column of the window) fall back to the 6-bit table. Verified at
// lat/long 1/2: every tromino-covered cell matches truth (test-tromino-12.mjs,
// substitution-offset-regimes-plan.md).
let useTromino = false;
const trominoCache = new Map(); // "sen;h;v" → Map(key → rule)

// Build the (self;N;W) → {children, bounds} table from the offset's map at
// orders 6→7. Keys use "x" for an absent (out-of-grid) neighbour.
function buildTrominoTable(seniority, h, v) {
    setOffset(h, v);
    const pM = computeMapModel(64, 64, { seniority });
    const cM = computeMapModel(128, 128, { seniority });
    setOffset(currentH, currentV); // restore the live offset
    const pns = Math.min(pM.NSr, pM.NSc);
    const cns = Math.min(cM.NSr, cM.NSc);
    const p = sectionsFromPropagation(
        pM, pM.firstDarkRow + 1, pM.firstDarkCol + 1, pns);
    const c = sectionsFromPropagation(
        cM, cM.firstDarkRow + 1, cM.firstDarkCol + 1, cns);
    const lim = Math.min(pns, Math.floor(cns / 2));
    const table = new Map();
    const ck = (sr, sc) =>
        sr < 0 || sc < 0 || sr >= pns || sc >= pns
            ? "x" : p.grid[sr][sc].join(",");
    for (let sr = 1; sr < lim - 1; sr++)
        for (let sc = 1; sc < lim - 1; sc++) {
            const key = ck(sr, sc) + ";" + ck(sr - 1, sc) + ";" + ck(sr, sc - 1);
            if (table.has(key)) continue;
            const a = sr * 2, b = sc * 2;
            table.set(key, {
                children: [
                    [...c.grid[a][b]], [...c.grid[a][b + 1]],
                    [...c.grid[a + 1][b]], [...c.grid[a + 1][b + 1]],
                ],
                vBoundTop: c.vBound[a][b], vBoundBot: c.vBound[a + 1][b],
                hBoundLeft: c.hBound[a][b], hBoundRight: c.hBound[a][b + 1],
            });
        }
    return table;
}
function currentTrominoTable() {
    const key =
        (currentSeniority.isVertical ? "v" : "h") + ";" + currentH + ";" +
        currentV;
    if (!trominoCache.has(key))
        trominoCache.set(
            key, buildTrominoTable(currentSeniority, currentH, currentV));
    return trominoCache.get(key);
}
// Resolve a cell's expansion rule: tromino (self;N;W) when enabled, else the
// 6-bit code table; tromino misses (edges) fall back to the code table.
function ruleFor(grid, ns, sr, sc, subTable, trom) {
    if (trom) {
        const ck = (r, c) =>
            r < 0 || c < 0 || r >= ns || c >= ns ? "x" : grid[r][c].join(",");
        const rule =
            trom.get(ck(sr, sc) + ";" + ck(sr - 1, sc) + ";" + ck(sr, sc - 1));
        if (rule) return rule;
    }
    const [dc, rc] = grid[sr][sc];
    return subTable[dc + "," + rc] || null;
}

// ── Grid expansion via SUB_TABLE ──
// (grid, vBound, hBound, ns) → one level deeper (ns2 = 2·ns). For each parent
// cell, look up its rule (in the current seniority's table) and stamp 4
// children + internal boundary segments. Then propagate inter-parent
// boundaries to the doubled grid.
function expandGrid(grid, vBound, hBound, ns) {
    const ns2 = ns * 2;
    const newGrid = Array.from({ length: ns2 }, () =>
        Array.from({ length: ns2 }, () => [0, 0]));
    const newVB = Array.from({ length: ns2 }, () => Array(ns2).fill(false));
    const newHB = Array.from({ length: ns2 }, () => Array(ns2).fill(false));
    const subTable = currentSubTable();
    const trom = useTromino ? currentTrominoTable() : null;

    for (let sr = 0; sr < ns; sr++) {
        for (let sc = 0; sc < ns; sc++) {
            const rule = ruleFor(grid, ns, sr, sc, subTable, trom);
            if (!rule) continue;
            const r2 = sr * 2, c2 = sc * 2;
            newGrid[r2][c2]         = [...rule.children[0]];
            newGrid[r2][c2 + 1]     = [...rule.children[1]];
            newGrid[r2 + 1][c2]     = [...rule.children[2]];
            newGrid[r2 + 1][c2 + 1] = [...rule.children[3]];
            if (rule.vBoundTop)   newVB[r2][c2] = true;
            if (rule.vBoundBot)   newVB[r2 + 1][c2] = true;
            if (rule.hBoundLeft)  newHB[r2][c2] = true;
            if (rule.hBoundRight) newHB[r2][c2 + 1] = true;
        }
    }
    // Inherit inter-parent boundaries to the child grid.
    for (let sr = 0; sr < ns; sr++)
        for (let sc = 0; sc < ns - 1; sc++)
            if (vBound[sr][sc]) {
                newVB[sr * 2][sc * 2 + 1] = true;
                newVB[sr * 2 + 1][sc * 2 + 1] = true;
            }
    for (let sr = 0; sr < ns - 1; sr++)
        for (let sc = 0; sc < ns; sc++)
            if (hBound[sr][sc]) {
                newHB[sr * 2 + 1][sc * 2] = true;
                newHB[sr * 2 + 1][sc * 2 + 1] = true;
            }

    return { grid: newGrid, vBound: newVB, hBound: newHB, ns: ns2 };
}

// ── Seeds ──
// Explorer root: the actual order-5 map at the current dyadic offset (via
// computeMapModel / universe integration). At 1/1 this matches the clean
// single-arrow seed exactly; at other offsets it's the offset's true map,
// so the user can watch how substitution-driven expansion diverges from
// further propagation. Boundary flags reconstructed from the same matrices.
function explorerSeed() {
    setOffset(currentH, currentV);
    const model = computeMapModel(32, 32, { seniority: currentSeniority });
    const ns = Math.min(model.NSr, model.NSc, 8);
    const { vBound, hBound } = boundsFromModel(model, ns);
    return {
        grid:   model.secCodes.slice(0, ns).map(r => r.slice(0, ns).map(c => [...c])),
        vBound,
        hBound,
        ns,
    };
}
// vBound[sr][sc] / hBound[sr][sc]: any active segment along the section's
// exit column / row. Mirrors getSectionData's boundary logic, but reads
// computeMapModel's matrices (which honour the dyadic offset).
function boundsFromModel(model, ns) {
    const { vBound, hBound } = sectionsFromPropagation(
        model, model.firstDarkRow + 1, model.firstDarkCol + 1, ns);
    return { vBound, hBound };
}

// Partition a Propagation (downMatrix/rightMatrix) into ns × ns sections of
// SEC × SEC cells, starting at matrix (originRow, originCol). For each
// section, compute the 3-bit downCode / rightCode (which interior input
// segments are present) and whether the exit column / row has any segment.
// Two conventions in play:
//   * SE patch (computeMapModel)   — originRow=firstDarkRow+1, originCol=firstDarkCol+1, ns=8.
//   * Symmetric universe (fromUniverseExtents) — originRow=originCol=0, ns=numRows/SEC.
function sectionsFromPropagation(prop, originRow, originCol, ns) {
    const { downMatrix, rightMatrix } = prop;
    const grid = Array.from({ length: ns }, () =>
        Array.from({ length: ns }, () => [0, 0]));
    const vBound = Array.from({ length: ns }, () => Array(ns).fill(false));
    const hBound = Array.from({ length: ns }, () => Array(ns).fill(false));
    for (let sr = 0; sr < ns; sr++) {
        for (let sc = 0; sc < ns; sc++) {
            const y0 = originRow + sr * SEC;
            const x0 = originCol + sc * SEC;
            for (let i = 0; i < 3; i++) {
                const dRow = downMatrix[y0];
                if (dRow && dRow[x0 + i]) grid[sr][sc][0] |= 1 << i;
                const rCol = rightMatrix[x0];
                if (rCol && rCol[y0 + i]) grid[sr][sc][1] |= 1 << i;
            }
            if (sc < ns - 1) {
                const xExit = x0 + SEC - 1;
                for (let i = 0; i < SEC; i++) {
                    const row = downMatrix[y0 + i];
                    if (row && row[xExit]) { vBound[sr][sc] = true; break; }
                }
            }
            if (sr < ns - 1) {
                const yExit = y0 + SEC - 1;
                for (let i = 0; i < SEC; i++) {
                    const col = rightMatrix[x0 + i];
                    if (col && col[yExit]) { hBound[sr][sc] = true; break; }
                }
            }
        }
    }
    return { grid, vBound, hBound };
}
// Universe seed: the FULL symmetric universe at order 5 — propagation from
// extent 32 on all four sides (N, S, W, E) via Propagation.fromUniverseExtents.
// At the canonical 1/1 anchor this gives a 64×64-cell matrix = 16×16 sections,
// with the universe origin at the centre. Reseeds when the dyadic offset
// changes, since fromUniverseExtents bakes the offset into its boundary.
//
// (The previous hardcoded seed [[J,M],[J·sₕ,F]] expanded twice — and even
// the corrected computeMapModel(8,8)-derived seed — only showed the SE patch
// = SE quadrant of the symmetric universe. Jake asked for the full symmetric
// view; see 2026-05-29.)
const UNIVERSE_EXTENT = 32;

// In a fromUniverseExtents(N=S=W=E=ext) matrix, the cage 010-alignment doesn't
// start at matrix col 0 in general — it shifts with the dyadic offset. With
// the engine's stored hInit_eff = curH − westExtent, the first matrix column
// where pri = 1 (cage middle) sits at matrix col K+1 such that K+1+hInit_eff
// is even and not a multiple of 4. Solving:
//   originCol = ((westExtent + 1 − curH) mod SEC + SEC) mod SEC
//   originRow = ((northExtent + 1 − curV) mod SEC + SEC) mod SEC
// Verified: long=1 → 0, long=0 → 1, long=2 → 3. ns shrinks to 15 when the
// origin is non-zero; the extra matrix cells at the NW edge are an incomplete
// cage outside the section grid.
function cageOrigin(curH, curV, westExtent, northExtent) {
    const originCol = ((westExtent + 1 - curH) % SEC + SEC) % SEC;
    const originRow = ((northExtent + 1 - curV) % SEC + SEC) % SEC;
    return { originRow, originCol };
}

function universeSeed() {
    const prop = Propagation.fromUniverseExtents({
        northExtent: UNIVERSE_EXTENT, southExtent: UNIVERSE_EXTENT,
        westExtent: UNIVERSE_EXTENT, eastExtent: UNIVERSE_EXTENT,
        hInitCol: currentH, vInitRow: currentV,
        seniority: currentSeniority,
    });
    const { originRow, originCol } = cageOrigin(
        currentH, currentV, UNIVERSE_EXTENT, UNIVERSE_EXTENT);
    const ns = Math.floor(Math.min(
        prop.numRows - originRow, prop.numColumns - originCol) / SEC);
    const { grid, vBound, hBound } =
        sectionsFromPropagation(prop, originRow, originCol, ns);
    return { grid, vBound, hBound, ns };
}

// ── Layout / rendering ──
function computeLayout(cols) {
    const maxPx = Math.min(800, window.innerWidth - 60);
    const cellSize = Math.max(4, Math.floor(maxPx / (cols * SEC + cols)));
    const gap = Math.max(1, Math.floor(cellSize * 0.15));
    const secPx = SEC * cellSize;
    return { cellSize, gap, secPx, stride: secPx + gap };
}

// Truth caches — one per (view, offset, level) tuple. Both views compute truth
// from a Propagation, so we store `{ NSr, NSc, secCodes }` either way.
const truthCache = new Map();
function invalidateTruth() { truthCache.clear(); }

// Truth for the explorer: computeMapModel (SE patch, 1-cell N/W boundary) at
// the current offset and order. The seed of the explorer view IS this map at
// level 0, so divergence appears only at level ≥ 1 (where substitution may
// or may not preserve the true propagation).
function getTruthExplorer(level) {
    const N = BASE_NS * SEC * Math.pow(2, level); // 32 → 64 → 128 …
    if (N > 1024) return null;
    const sen = currentSeniority.isVertical ? "v" : "h";
    const key = `expl:${sen}:${currentH}/${currentV}@${N}`;
    const hit = truthCache.get(key); if (hit) return hit;
    setOffset(currentH, currentV);
    const model = computeMapModel(N, N, { seniority: currentSeniority });
    truthCache.set(key, model);
    return model;
}

// Truth for the universe view: fromUniverseExtents (symmetric, all four
// directions at the same extent) at the current offset and order. At level 0
// the universe seed IS this truth (so divergence is empty at level 0);
// substitution-driven zoom-ins are compared against fromUniverseExtents at
// extent 32·2^level.
function getTruthUniverse(level) {
    const ext = UNIVERSE_EXTENT * Math.pow(2, level); // 32 → 64 → 128 …
    if (ext > 512) return null; // 1024-cell-side cap
    const sen = currentSeniority.isVertical ? "v" : "h";
    const key = `univ:${sen}:${currentH}/${currentV}@${ext}`;
    const hit = truthCache.get(key); if (hit) return hit;
    const prop = Propagation.fromUniverseExtents({
        northExtent: ext, southExtent: ext, westExtent: ext, eastExtent: ext,
        hInitCol: currentH, vInitRow: currentV,
        seniority: currentSeniority,
    });
    const { originRow, originCol } = cageOrigin(currentH, currentV, ext, ext);
    const ns = Math.floor(Math.min(
        prop.numRows - originRow, prop.numColumns - originCol) / SEC);
    const { grid } = sectionsFromPropagation(prop, originRow, originCol, ns);
    const model = { secCodes: grid, NSr: ns, NSc: ns };
    truthCache.set(key, model);
    return model;
}

function computeDivergence(state) {
    const level = state.zoomStack.length;
    const truth = state.getTruth ? state.getTruth(level) : null;
    const rows = state.grid.length;
    const cols = state.grid[0].length;
    // div[r][c] holds the truth code [dT, rT] if the cell diverges, else null.
    // (renderView consumes the truth code to draw the segment-level diff
    // overlay — red for pred-only segments, pink for truth-only.)
    const div = Array.from({ length: rows }, () => Array(cols).fill(null));
    const unknown = Array.from({ length: rows }, () => Array(cols).fill(false));
    const subTable = currentSubTable();
    const trom = useTromino ? currentTrominoTable() : null;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const [d, rr] = state.grid[r][c];
            // "Unknown" = the next expansion has no rule. With the tromino on,
            // a cell is covered if its (self;N;W) key is in the tromino table;
            // otherwise it falls back to the 6-bit code table.
            if (!ruleFor(state.grid, cols, r, c, subTable, trom))
                unknown[r][c] = true;
            if (!truth) continue;
            const ar = state.absR0 + r, ac = state.absC0 + c;
            if (ar < 0 || ar >= truth.NSr || ac < 0 || ac >= truth.NSc) continue;
            const t = truth.secCodes[ar][ac];
            if (d !== t[0] || rr !== t[1]) div[r][c] = [t[0], t[1]];
        }
    }
    return { div, unknown };
}

// ── Segment-level diff overlay ──
// At divergent cells, paint the *segments* that disagree between the
// substitution-predicted glyph and the propagation-truth glyph:
//   red  — segment present in predicted but absent in truth (false positive)
//   pink — segment present in truth but absent in predicted (false negative)
// Pred-side segments are already drawn (in light blue) by drawSection; this
// just repaints the disagreeing ones, and adds the missing truth segments
// in pink that drawSection didn't draw.
const DIFF_PRED_ONLY = "#d32f2f";
const DIFF_TRUTH_ONLY = "#f48fb1";
// ── Hover-driven substitution-rule preview (sidebar) ──
// Mirrors the catalog's V→V translation table, but for a single hovered code:
// shows the parent's glyph label + the 4 child labels in a 2×2 with the
// internal boundary segments drawn between them. If the code isn't in the
// current seniority's SUB_TABLE, says so explicitly.
function labelFor(dc, rc) {
    return currentSeniority.isVertical
        ? glyphLabel(dc, rc)
        : hGlyphLabel(dc, rc);
}
function escapeText(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function showHoverTranslation(dc, rc) {
    const el = document.getElementById("hover-translation");
    if (!el) return;
    const parent = labelFor(dc, rc);
    const rule = currentSubTable()[dc + "," + rc];
    if (!rule) {
        el.innerHTML =
            `<div class="ht-parent">${escapeText(parent)}</div>` +
            `<p class="ht-unreachable">Not in canonical SUB_TABLE — ` +
            `code never appears in clean-baseline propagation, so ` +
            `there is no 2×2 expansion rule.</p>`;
        return;
    }
    const ch = rule.children.map(([d, r]) => escapeText(labelFor(d, r)));
    // Internal boundary classes per cell (matches the catalog's translation
    // table layout in glyphs.js:283).
    const cls = [
        [rule.hBoundLeft ? "border-bottom" : "",
         rule.vBoundTop  ? "border-right"  : ""],
        [rule.hBoundRight ? "border-bottom" : "", ""],
        ["", rule.vBoundBot ? "border-right" : ""],
        ["", ""],
    ];
    const cell = (i) =>
        `<div class="ht-child ${cls[i].filter(Boolean).join(" ")}">${ch[i]}</div>`;
    el.innerHTML =
        `<div class="ht-parent">${escapeText(parent)}</div>` +
        `<div class="ht-arrow">→ 2×2 children</div>` +
        `<div class="ht-children">${cell(0)}${cell(1)}${cell(2)}${cell(3)}</div>`;
}
function clearHoverTranslation() {
    const el = document.getElementById("hover-translation");
    if (el) el.innerHTML =
        `<p class="ht-empty">Hover over a section to see its 2×2 expansion.</p>`;
}

function overlayDiff(ctx, dc, rc, dcT, rcT, seniority, sx, sy, cell) {
    const pred = computeGlyphMatrices(dc, rc, seniority, 1, 1);
    const truth = computeGlyphMatrices(dcT, rcT, seniority, 1, 1);
    const lw = (cell * 1.6) / CELL_PX;
    ctx.lineWidth = lw;
    // Vertical segments at col gx+1, between rows gy and gy+1.
    for (let gy = 0; gy <= 3; gy++) {
        for (let gx = 0; gx < 3; gx++) {
            const p = !!pred.downMatrix[gy][gx];
            const t = !!truth.downMatrix[gy][gx];
            if (p === t) continue;
            ctx.strokeStyle = p ? DIFF_PRED_ONLY : DIFF_TRUTH_ONLY;
            ctx.beginPath();
            ctx.moveTo(sx + (gx + 1) * cell, sy + gy * cell);
            ctx.lineTo(sx + (gx + 1) * cell, sy + (gy + 1) * cell);
            ctx.stroke();
        }
    }
    // Horizontal segments at row gy+1, between cols gx and gx+1.
    for (let gx = 0; gx <= 3; gx++) {
        for (let gy = 0; gy < 3; gy++) {
            const p = !!pred.rightMatrix[gx][gy];
            const t = !!truth.rightMatrix[gx][gy];
            if (p === t) continue;
            ctx.strokeStyle = p ? DIFF_PRED_ONLY : DIFF_TRUTH_ONLY;
            ctx.beginPath();
            ctx.moveTo(sx + gx * cell, sy + (gy + 1) * cell);
            ctx.lineTo(sx + (gx + 1) * cell, sy + (gy + 1) * cell);
            ctx.stroke();
        }
    }
}

// ── Self-similar shading (hover) ──
// On the anchor family the map is an exact substitution tiling, so a glyph's
// motif recurs at every FINER scale: descend each on-screen section through the
// translation table (parent → 2×2 children), and wherever a (sub-)glyph is in
// the hovered glyph's D4 orbit, fill that quarter. One translucent fill, drawn
// at every depth — full sections (matching glyphs), then 2×2-cell quarters,
// then 1×1-cell sub-quarters … — so overlaps compound and the deeply
// self-similar points come out darkest. This is Jake's "find the target glyph
// in each letter's translation, then fill the appropriate quarter" method.
// Explorer only (the universe view aligns its sections differently).
let selfSimShade = false;
const orbitIdCache = new Map();
function orbitIdMap(seniority) {
    const key = seniority.isVertical ? "v" : "h";
    if (orbitIdCache.has(key)) return orbitIdCache.get(key);
    const m = new Map();
    classifyVisualD4(seniority).forEach((cls, ci) =>
        cls.orbit.forEach(([d, r]) => m.set(d + "," + r, ci)));
    orbitIdCache.set(key, m);
    return m;
}
// Smallest sub-glyph (px) we still subdivide — caps the recursion depth.
const SELFSIM_MIN_PX = 3;
function drawSelfSimShading(ctx, state, gap, secPx) {
    if (!state.selfSim || state.hoverR < 0 || state.hoverC < 0) return;
    const orbitMap = orbitIdMap(currentSeniority);
    const hc = state.grid[state.hoverR][state.hoverC];
    const target = orbitMap.get(hc[0] + "," + hc[1]);
    if (target === undefined) return;
    const sub = currentSubTable();
    ctx.fillStyle = "rgba(40, 90, 200, 0.13)";
    // Descend one section: fill it if its glyph matches, then recurse into the
    // four translation children (NW, NE, SW, SE) over the same pixel box.
    function descend(code, x, y, size) {
        if (orbitMap.get(code[0] + "," + code[1]) === target)
            ctx.fillRect(x, y, size, size);
        const half = size / 2;
        if (half < SELFSIM_MIN_PX) return;
        const rule = sub[code[0] + "," + code[1]];
        if (!rule) return;
        descend(rule.children[0], x, y, half);
        descend(rule.children[1], x + half, y, half);
        descend(rule.children[2], x, y + half, half);
        descend(rule.children[3], x + half, y + half, half);
    }
    const rows = state.grid.length, cols = state.grid[0].length;
    for (let sr = 0; sr < rows; sr++)
        for (let sc = 0; sc < cols; sc++)
            descend(
                state.grid[sr][sc],
                gap + sc * (secPx + gap),
                gap + sr * (secPx + gap),
                secPx);
}

// ── Color by orbit (whole-map composite) ──
// Paint every section, and recursively its translation sub-glyphs, with the
// (sub-)glyph's orbit hue. Alpha falls off with depth so the coarse glyph
// dominates and finer scales only tint — a scale-weighted composite of the
// self-similar structure (think colored substitution tiling / Rauzy fractal).
// Distinct hues come from the golden angle. Rendered once per grid to an
// offscreen layer and cached on the state, so hover stays cheap.
let colorByOrbit = false;
const ORBIT_BASE_ALPHA = 0.55, ORBIT_FALLOFF = 0.42;
function orbitHue(orbit) { return (orbit * 137.508) % 360; }
function drawOrbitColoring(ctx, state, gap, secPx) {
    const orbitMap = orbitIdMap(currentSeniority);
    const sub = currentSubTable();
    function descend(code, x, y, size, depth) {
        const orbit = orbitMap.get(code[0] + "," + code[1]);
        if (orbit !== undefined) {
            ctx.fillStyle = `hsla(${orbitHue(orbit)}, 65%, 55%, ` +
                `${ORBIT_BASE_ALPHA * Math.pow(ORBIT_FALLOFF, depth)})`;
            ctx.fillRect(x, y, size, size);
        }
        const half = size / 2;
        if (half < SELFSIM_MIN_PX) return;
        const rule = sub[code[0] + "," + code[1]];
        if (!rule) return;
        descend(rule.children[0], x, y, half, depth + 1);
        descend(rule.children[1], x + half, y, half, depth + 1);
        descend(rule.children[2], x, y + half, half, depth + 1);
        descend(rule.children[3], x + half, y + half, half, depth + 1);
    }
    const rows = state.grid.length, cols = state.grid[0].length;
    for (let sr = 0; sr < rows; sr++)
        for (let sc = 0; sc < cols; sc++)
            descend(state.grid[sr][sc],
                gap + sc * (secPx + gap), gap + sr * (secPx + gap), secPx, 0);
}
// Cached offscreen layer; recomputed only when the grid / size / seniority
// changes (not on hover).
function orbitLayer(state, w, h, gap, secPx) {
    const sig = w + "x" + h + ":" + (currentSeniority.isVertical ? "v" : "h");
    if (state._ol && state._olGrid === state.grid && state._olSig === sig)
        return state._ol;
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    drawOrbitColoring(off.getContext("2d"), state, gap, secPx);
    state._ol = off;
    state._olGrid = state.grid;
    state._olSig = sig;
    return off;
}

function renderView(canvas, state) {
    const ctx = canvas.getContext("2d");
    const rows = state.grid.length;
    const cols = state.grid[0].length;
    const { cellSize, gap, secPx } = computeLayout(cols);
    const totalW = cols * (secPx + gap) + gap;
    const totalH = rows * (secPx + gap) + gap;
    canvas.width = totalW;
    canvas.height = totalH;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, totalW, totalH);

    // Whole-map orbit coloring (cached layer) sits at the base.
    if (colorByOrbit)
        ctx.drawImage(orbitLayer(state, totalW, totalH, gap, secPx), 0, 0);
    // Self-similar shading sits under everything; overlapping fills compound.
    if (selfSimShade) drawSelfSimShading(ctx, state, gap, secPx);

    const flags = computeDivergence(state);
    if (flags) {
        // Orange tint only for cells whose code isn't in SUB_TABLE — they'd
        // expand to V₀₀ children. Divergent cells are no longer block-tinted;
        // they get a per-segment overlay below, after drawSection.
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!flags.unknown[r][c]) continue;
                const x = gap + c * (secPx + gap);
                const y = gap + r * (secPx + gap);
                ctx.fillStyle = "rgba(245, 158, 11, 0.22)";
                ctx.fillRect(x, y, secPx, secPx);
            }
        }
    }

    // Amber background for the 2×2 children of the last zoom click.
    let hiRect = null;
    if (state.childHiR >= 0 && state.childHiC >= 0) {
        hiRect = {
            x: gap + state.childHiC * (secPx + gap),
            y: gap + state.childHiR * (secPx + gap),
            w: 2 * secPx + gap,
            h: 2 * secPx + gap,
        };
        ctx.fillStyle = "rgba(255, 159, 10, 0.18)";
        ctx.fillRect(hiRect.x, hiRect.y, hiRect.w, hiRect.h);
    }

    const isVertical = currentSeniority.isVertical;
    const letterLookup = isVertical ? GLYPH_LETTERS : H_GLYPH_LETTERS;
    const letterColor = isVertical ? V_COLOR : H_COLOR;
    const prefix = isVertical ? "V" : "H";
    for (let sr = 0; sr < rows; sr++) {
        for (let sc = 0; sc < cols; sc++) {
            const [dc, rc] = state.grid[sr][sc];
            const sx = gap + sc * (secPx + gap);
            const sy = gap + sr * (secPx + gap);

            if (sr === state.hoverR && sc === state.hoverC) {
                ctx.fillStyle = "rgba(0, 0, 100, 0.05)";
                ctx.fillRect(sx, sy, secPx, secPx);
            }

            const ft = renderState.showIndices
                ? null
                : toFt(letterLookup[dc + "," + rc], letterColor);
            drawSection(ctx, {
                dc, rc,
                seniority: currentSeniority,
                sx, sy, cell: cellSize,
                ft,
                prefix,
                showDots: state.showDots,
                showLetters: state.showLetters,
                babyBlocks: renderState.useBabyBlocks && babyBlocksReady(),
                outline: renderState.babyBlocksOutline,
            });

            // Per-segment diff overlay for divergent cells (red = pred only,
            // pink = truth only). Drawn AFTER drawSection so the disagreement
            // colours overwrite the light-blue predicted segments.
            if (flags && flags.div[sr][sc]) {
                const [tDC, tRC] = flags.div[sr][sc];
                overlayDiff(ctx, dc, rc, tDC, tRC,
                    currentSeniority, sx, sy, cellSize);
            }
        }
    }

    // Inter-section boundary segments (bold black).
    const lw = Math.max(0.5, cellSize * 0.08);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = lw;
    for (let sr = 0; sr < rows; sr++) {
        for (let sc = 0; sc < cols - 1; sc++) {
            if (state.vBound[sr][sc]) {
                const x = gap + (sc + 1) * (secPx + gap) - gap / 2;
                const y1 = gap + sr * (secPx + gap);
                ctx.beginPath();
                ctx.moveTo(x, y1);
                ctx.lineTo(x, y1 + secPx);
                ctx.stroke();
            }
        }
    }
    for (let sr = 0; sr < rows - 1; sr++) {
        for (let sc = 0; sc < cols; sc++) {
            if (state.hBound[sr][sc]) {
                const y = gap + (sr + 1) * (secPx + gap) - gap / 2;
                const x1 = gap + sc * (secPx + gap);
                ctx.beginPath();
                ctx.moveTo(x1, y);
                ctx.lineTo(x1 + secPx, y);
                ctx.stroke();
            }
        }
    }

    if (hiRect) {
        ctx.strokeStyle = "#ff9f0a";
        ctx.lineWidth = Math.max(1.5, cellSize * 0.2);
        ctx.strokeRect(hiRect.x, hiRect.y, hiRect.w, hiRect.h);
    }
}

// ── Zoom view factory ──
// Wraps state + zoom logic + event handlers for one canvas. `initFn` returns
// the seed (level-0) grid bundle; the view resets back to that on Reset.
function makeZoomView(canvas, initFn, getTruth, ui) {
    const state = {
        grid: null, vBound: null, hBound: null, ns: 0,
        zoomStack: [],
        hoverR: -1, hoverC: -1,
        childHiR: -1, childHiC: -1,
        showDots: true,
        showLetters: true,
        baseOrder: 5,
        // Viewport's top-left section index in absolute order-(baseOrder+level)
        // section coords. Used to align the windowed view with truth at this
        // offset+level, for divergence marking.
        absR0: 0, absC0: 0,
        // Per-view truth source (computeMapModel for explorer, fromUniverse-
        // Extents for the symmetric universe). computeDivergence reads this.
        getTruth,
    };

    function reset() {
        const seed = initFn();
        state.grid = seed.grid;
        state.vBound = seed.vBound;
        state.hBound = seed.hBound;
        state.ns = seed.ns;
        state.zoomStack = [];
        state.childHiR = -1;
        state.childHiC = -1;
        state.absR0 = 0;
        state.absC0 = 0;
        refresh();
    }

    function zoomIn(row, col) {
        state.zoomStack.push({
            grid: state.grid, vBound: state.vBound,
            hBound: state.hBound, ns: state.ns,
            absR0: state.absR0, absC0: state.absC0,
        });
        const exp = expandGrid(state.grid, state.vBound, state.hBound, state.ns);
        const ns2 = exp.ns;
        const centerR = row * 2, centerC = col * 2;
        const halfWin = Math.floor(state.ns / 2);
        let startR = Math.max(0, centerR - halfWin + 1);
        let startC = Math.max(0, centerC - halfWin + 1);
        if (startR + state.ns > ns2) startR = Math.max(0, ns2 - state.ns);
        if (startC + state.ns > ns2) startC = Math.max(0, ns2 - state.ns);
        const view = Math.min(state.ns, ns2);
        state.childHiR = centerR - startR;
        state.childHiC = centerC - startC;
        // The doubled grid sits at absolute section coords starting at
        // (2·absR0, 2·absC0) in the order-(level+1) section grid; the
        // window then shifts by (startR, startC).
        state.absR0 = state.absR0 * 2 + startR;
        state.absC0 = state.absC0 * 2 + startC;
        state.grid = Array.from({ length: view }, (_, r) =>
            Array.from({ length: view }, (_, c) =>
                [...exp.grid[startR + r][startC + c]]));
        state.vBound = Array.from({ length: view }, (_, r) =>
            Array.from({ length: view }, (_, c) => {
                const sc = startC + c;
                return sc < ns2 - 1 ? exp.vBound[startR + r][sc] : false;
            }));
        state.hBound = Array.from({ length: view }, (_, r) =>
            Array.from({ length: view }, (_, c) => {
                const sr = startR + r;
                return sr < ns2 - 1 ? exp.hBound[sr][startC + c] : false;
            }));
        refresh();
    }

    function zoomOut() {
        if (state.zoomStack.length === 0) return;
        const prev = state.zoomStack.pop();
        state.grid = prev.grid;
        state.vBound = prev.vBound;
        state.hBound = prev.hBound;
        state.ns = prev.ns;
        state.absR0 = prev.absR0;
        state.absC0 = prev.absC0;
        state.childHiR = -1;
        state.childHiC = -1;
        refresh();
    }

    function getSection(e) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const cols = state.grid[0].length;
        const { gap, stride } = computeLayout(cols);
        const sc = Math.floor((mx - gap) / stride);
        const sr = Math.floor((my - gap) / stride);
        if (sr >= 0 && sr < state.grid.length && sc >= 0 && sc < cols)
            return [sr, sc];
        return null;
    }

    function refresh() {
        renderView(canvas, state);
        if (!ui) return;
        if (ui.info) {
            const level = state.zoomStack.length;
            const order = state.baseOrder + level;
            ui.info.textContent =
                `Level ${level} — Order ${order} (${state.ns}×${state.ns} window)`;
        }
        if (ui.btnOut) ui.btnOut.disabled = state.zoomStack.length === 0;
    }
    function render() { renderView(canvas, state); }

    canvas.addEventListener("click", e => {
        const sec = getSection(e);
        if (sec) zoomIn(sec[0], sec[1]);
    });
    canvas.addEventListener("mousemove", e => {
        const sec = getSection(e);
        const oldR = state.hoverR, oldC = state.hoverC;
        if (sec) { state.hoverR = sec[0]; state.hoverC = sec[1]; }
        else     { state.hoverR = -1;     state.hoverC = -1; }
        if (state.hoverR !== oldR || state.hoverC !== oldC) {
            if (state.hoverR >= 0 && state.hoverC >= 0) {
                const [dc, rc] = state.grid[state.hoverR][state.hoverC];
                showHoverTranslation(dc, rc);
            } else {
                clearHoverTranslation();
            }
            render();
        }
    });
    canvas.addEventListener("mouseleave", () => {
        state.hoverR = -1; state.hoverC = -1;
        clearHoverTranslation();
        render();
    });

    if (ui) {
        if (ui.btnOut)   ui.btnOut.addEventListener("click", zoomOut);
        if (ui.btnReset) ui.btnReset.addEventListener("click", reset);
        if (ui.btnDots) {
            ui.btnDots.addEventListener("click", () => {
                state.showDots = !state.showDots;
                ui.btnDots.textContent = "Dots: " + (state.showDots ? "On" : "Off");
                ui.btnDots.classList.toggle("active", state.showDots);
                render();
            });
        }
    }

    return { reset, render, refresh, state };
}

// ── Assignment loading (duplicated lightly from glyphs.js — keep in sync) ──
async function fetchAssignmentDict(path) {
    try {
        const res = await fetch(path, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (data && data.assignments && typeof data.assignments === "object")
            return data.assignments;
        throw new Error("no .assignments object");
    } catch (e) {
        console.warn("substitution: could not load", path, e);
        return null;
    }
}
const ASSIGNMENT_FILES = {
    "assignments-complete": "./assignments-complete.json",
    assignments: "./assignments.json",
    "assignments-old": "./assignments-old.json",
};
const DEFAULT_ASSIGNMENT_FILE = "assignments-complete";
async function loadAssignmentFile(key) {
    const dict = await fetchAssignmentDict(ASSIGNMENT_FILES[key]);
    if (dict) setWorkingAssignments(dict);
    return dict;
}
async function loadOldAssignments() {
    const dict = await fetchAssignmentDict(ASSIGNMENT_FILES["assignments-old"]);
    if (dict) setOldAssignments(dict);
}

// ── Bootstrap ──
const explorerCanvas = document.getElementById("explorer-canvas");
const universeCanvas = document.getElementById("universe-canvas");

const explorer = makeZoomView(explorerCanvas, explorerSeed, getTruthExplorer, {
    info:     document.getElementById("explorer-info"),
    btnOut:   document.getElementById("explorer-out"),
    btnReset: document.getElementById("explorer-reset"),
    btnDots:  document.getElementById("explorer-dots"),
});
// Self-similar shading is meaningful only on the explorer's SE patch (clean ×2
// dilation from the NW origin); the universe view aligns differently.
explorer.state.selfSim = true;
const universe = makeZoomView(universeCanvas, universeSeed, getTruthUniverse, {
    info:     document.getElementById("universe-info"),
    btnOut:   document.getElementById("universe-out"),
    btnReset: document.getElementById("universe-reset"),
    btnDots:  document.getElementById("universe-dots"),
});

function rerenderAll() {
    explorer.render();
    universe.render();
}

// Wire shared controls (Letters dropdown, Show indices, Baby Blocks, Outline).
function wireControls() {
    const sel = document.getElementById("assignment-select");
    if (sel) {
        sel.addEventListener("change", async () => {
            await loadAssignmentFile(sel.value);
            applyAssignments(true);
            rerenderAll();
        });
    }
    const showIdx = document.getElementById("show-indices-toggle");
    if (showIdx) {
        showIdx.addEventListener("change", () => {
            renderState.showIndices = showIdx.checked;
            rerenderAll();
        });
    }
    const bb = document.getElementById("bb-toggle");
    if (bb) {
        bb.addEventListener("change", () => {
            renderState.useBabyBlocks = bb.checked;
            if (bb.checked) ensureBabyBlocksLoaded(rerenderAll);
            else rerenderAll();
        });
    }
    const outline = document.getElementById("bb-outline");
    if (outline) {
        outline.addEventListener("change", () => {
            renderState.babyBlocksOutline = outline.checked;
            if (renderState.useBabyBlocks) rerenderAll();
        });
    }
    const tromino = document.getElementById("tromino-toggle");
    if (tromino) {
        tromino.addEventListener("change", () => {
            useTromino = tromino.checked;
            // Expansion rule changed — re-expand both views from their seeds.
            explorer.reset();
            universe.reset();
        });
    }
    const selfSim = document.getElementById("selfsim-toggle");
    if (selfSim) {
        selfSim.addEventListener("change", () => {
            selfSimShade = selfSim.checked;
            explorer.render();
        });
    }
    const colorOrbit = document.getElementById("colororbit-toggle");
    if (colorOrbit) {
        colorOrbit.addEventListener("change", () => {
            colorByOrbit = colorOrbit.checked;
            rerenderAll();
        });
    }
    document.addEventListener("keydown", e => {
        if (e.key !== "Escape") return;
        // Zoom out whichever view has depth (explorer first; mirrors the old
        // single-canvas page).
        if (explorer.state.zoomStack.length > 0) {
            document.getElementById("explorer-out").click();
        } else if (universe.state.zoomStack.length > 0) {
            document.getElementById("universe-out").click();
        }
    });

    // Dyadic location: explorer seed depends on the offset (so reset it),
    // universe seed is canonical (so just rerender to refresh divergence).
    const hIn = document.getElementById("hinit-input");
    const vIn = document.getElementById("vinit-input");
    function readN(el, fallback) {
        const n = parseInt(el.value, 10);
        return Number.isFinite(n) ? n : fallback;
    }
    function onOffsetChange() {
        currentH = readN(hIn, 1);
        currentV = readN(vIn, 1);
        setOffset(currentH, currentV);
        invalidateTruth();
        // Both seeds depend on the offset (explorer via computeMapModel,
        // universe via fromUniverseExtents), so reset both.
        explorer.reset();
        universe.reset();
    }
    if (hIn) hIn.addEventListener("change", onOffsetChange);
    if (vIn) vIn.addEventListener("change", onOffsetChange);

    // Seniority radios — switching seniority changes both the substitution
    // table and the underlying propagation, so reseed both views.
    const senRadios = document.querySelectorAll('input[name="seniority"]');
    function onSeniorityChange() {
        const sel = document.querySelector('input[name="seniority"]:checked');
        if (!sel) return;
        currentSeniority = sel.value === "h"
            ? Seniority.horizontal()
            : Seniority.vertical();
        invalidateTruth();
        explorer.reset();
        universe.reset();
    }
    senRadios.forEach(r => r.addEventListener("change", onSeniorityChange));
}

(async function init() {
    const sel = document.getElementById("assignment-select");
    const key = sel && ASSIGNMENT_FILES[sel.value] ? sel.value
              : DEFAULT_ASSIGNMENT_FILE;
    await loadAssignmentFile(key);
    await loadOldAssignments();
    applyAssignments(true);
    // Read whatever the HTML defaulted the lat/long boxes to (1/1) before
    // the first seed so explorerSeed sees the right offset.
    const hIn = document.getElementById("hinit-input");
    const vIn = document.getElementById("vinit-input");
    if (hIn && vIn) {
        currentH = parseInt(hIn.value, 10) || 1;
        currentV = parseInt(vIn.value, 10) || 1;
        setOffset(currentH, currentV);
    }
    const senSel = document.querySelector('input[name="seniority"]:checked');
    if (senSel && senSel.value === "h") {
        currentSeniority = Seniority.horizontal();
    }
    explorer.reset();
    universe.reset();
    wireControls();
})();
