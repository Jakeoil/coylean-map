// planet-coyleus — terrain-core (pure math + palette model, Node-importable).
//
// No DOM, no canvas, no fetch. Owns: the 12-orbit model (keyed by the
// assignments.json letters), the verified 16-cell D4 derivation, the global
// per-orbit palette (paint one cell → every occurrence + sibling re-derives),
// the substitution/translation relatives, the universe patch, and the OKLCH
// terrain ramps. See test/orbits-12.mjs and test/cell-d4.mjs for the proofs the
// constants below rest on.

import { Seniority } from "../../coylean-explorer/coylean-core.js";
import {
    classifyVisualD4,
    computePattern,
    transformedPatternKey,
    computeGlyphMatrices,
    getWorkingAssignments,
    applyAssignments,
    glyphLetterAt,
    setOffset,
    computeMapModel,
    pairKey,
} from "../../glyphs/glyph-core.js";
import {
    TRANSLATION_V,
    TRANSLATION_H,
    V_TO_H,
    H_TO_V,
} from "../superglyphs/tests/rules.mjs";

const V = Seniority.vertical();
const H = Seniority.horizontal();

// Build the letter + D4-operation model from the new scheme (= assignments.json,
// "new v sideways / h upright"). Offset-independent, so once at load is enough.
applyAssignments(true);

// Operation alphabet: 0-3 rotations, then s_h s_v s_d1 s_d2 → - | \ / .
const OP_SUFFIX = ["0", "1", "2", "3", "-", "|", "\\", "/"];

// "F\\" / "P/" / "F2" … — the orbit letter a glyph carries plus its operation,
// matching the V/H grids on glyphs/index.html (e.g. H(1,3) → "F2"). null off the
// 12-orbit alphabet.
export function letterTag(grid, d, r) {
    const lt = glyphLetterAt(grid, d, r);
    return lt ? lt[0] + OP_SUFFIX[lt[1]] : null;
}

// Unpainted cell color (neutral, reads as "unassigned").
export const EMPTY = "#23262f";

// ── verified 16-cell D4 permutation (test/cell-d4.mjs) ──
// PERM[ti][c] = the member cell that canonical cell c lands in under D4 element
// ti (catalog order: e r r² r³ s_h s_v s_d1 s_d2).
// prettier-ignore
const CELL_PERM = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    [12, 8, 4, 0, 13, 9, 5, 1, 14, 10, 6, 2, 15, 11, 7, 3],
    [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
    [3, 7, 11, 15, 2, 6, 10, 14, 1, 5, 9, 13, 0, 4, 8, 12],
    [12, 13, 14, 15, 8, 9, 10, 11, 4, 5, 6, 7, 0, 1, 2, 3],
    [3, 2, 1, 0, 7, 6, 5, 4, 11, 10, 9, 8, 15, 14, 13, 12],
    [0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15],
    [15, 11, 7, 3, 14, 10, 6, 2, 13, 9, 5, 1, 12, 8, 4, 0],
];

// ── orbit model ──
// Letter → its lettered V canonical [d, r], read from the assignments dict
// (default mirrors assignments.json; no fetch needed for the 12 names).
function lettersToCanon() {
    const out = {};
    for (const [k, val] of Object.entries(getWorkingAssignments())) {
        if (!/^V[0-7][0-7]$/.test(k)) continue;
        out[val.replace(/[^A-Za-z]/g, "")] = [+k[1], +k[2]];
    }
    return out;
}

const keyStr = (d, r) => d + "," + r;
const patternKeys = (d, r, sen) => {
    const { v, h } = computePattern(d, r, sen);
    return Array.from({ length: 8 }, (_, t) => transformedPatternKey(v, h, t));
};

// One entry per orbit: { letter, rep:[d,r], keys:[8] } where rep is an orbit
// member that has a translation rule (so the relatives panels always resolve);
// keys[ti] is the pattern key of the rep transformed by D4 element ti.
const ORBITS = (() => {
    const canon = lettersToCanon();
    const classes = classifyVisualD4(V);
    const list = [];
    for (const [letter, [cd, cr]] of Object.entries(canon)) {
        const cls = classes.find((c) =>
            c.orbit.some(([d, r]) => d === cd && r === cr),
        );
        const sorted = [...cls.orbit].sort(
            (a, b) => pairKey(a[0], a[1]) - pairKey(b[0], b[1]),
        );
        const rep =
            sorted.find(([d, r]) => TRANSLATION_V[keyStr(d, r)]) || sorted[0];
        list.push({ letter, rep, keys: patternKeys(rep[0], rep[1], V) });
    }
    return list;
})();

export const LETTERS = ORBITS.map((o) => o.letter);

// H display reps: the orbit's H-grid member (transpose dual) that has a
// TRANSLATION_H rule. Used only to *show* the orbit under H seniority — the
// color storage frame stays the V rep (resolve handles H glyphs as D4 images).
const H_REP = (() => {
    const classesH = classifyVisualD4(H);
    const out = {};
    for (const o of ORBITS) {
        const [vd, vr] = o.rep;
        const cls = classesH.find((c) =>
            c.orbit.some(([d, r]) => d === vr && r === vd),
        );
        const sorted = [...cls.orbit].sort(
            (a, b) => pairKey(a[0], a[1]) - pairKey(b[0], b[1]),
        );
        out[o.letter] =
            sorted.find(([d, r]) => TRANSLATION_H[keyStr(d, r)]) || sorted[0];
    }
    return out;
})();

// The display rep of an orbit in the active seniority.
function repOf(letter, seniorityH) {
    return seniorityH ? H_REP[letter] : orbitByLetter(letter).rep;
}

// Resolve any glyph (grid "V"/"H", code d,r) to { orbit, ti } where ti is the
// D4 element taking the orbit's rep pattern to this glyph's pattern. null if the
// glyph is outside the 12-orbit alphabet (shouldn't happen on the anchor).
// Memoized — resolution is static, only 128 (grid,code) inputs exist.
const resolveCache = new Map();
function resolve(grid, d, r) {
    const ck = grid + d + "," + r;
    if (resolveCache.has(ck)) return resolveCache.get(ck);
    const p = computePattern(d, r, grid === "H" ? H : V);
    const key = transformedPatternKey(p.v, p.h, 0);
    let result = null;
    for (const orbit of ORBITS) {
        const ti = orbit.keys.indexOf(key);
        if (ti >= 0) {
            result = { orbit, ti };
            break;
        }
    }
    resolveCache.set(ck, result);
    return result;
}

// ── palette: letter → 16 cell colors (null = unpainted), against the rep frame ──
const palette = {};
for (const L of LETTERS) palette[L] = Array(16).fill(null);

export function orbitByLetter(letter) {
    return ORBITS.find((o) => o.letter === letter);
}

// The 16 derived cell colors for any glyph, from its orbit's stored canonical.
export function cellsFor(grid, d, r) {
    const res = resolve(grid, d, r);
    if (!res) return Array(16).fill(null);
    const canon = palette[res.orbit.letter];
    const perm = CELL_PERM[res.ti];
    const out = Array(16).fill(null);
    for (let c = 0; c < 16; c++) out[perm[c]] = canon[c];
    return out;
}

// Undo history: one entry per cell change (previous value of a canonical cell).
const history = [];

// Paint (or clear, color=null) cell `idx` of a displayed glyph — maps back
// through the D4 element to the orbit's canonical cell, so every occurrence and
// every sibling re-derives. Returns the affected letter (or null).
export function paintCell(grid, d, r, idx, color) {
    const res = resolve(grid, d, r);
    if (!res) return null;
    const canonCell = CELL_PERM[res.ti].indexOf(idx);
    const arr = palette[res.orbit.letter];
    history.push({ letter: res.orbit.letter, cell: canonCell, prev: arr[canonCell] });
    arr[canonCell] = color;
    return res.orbit.letter;
}

// Undo the last cell change. Returns true if something was undone.
export function undo() {
    const last = history.pop();
    if (!last) return false;
    palette[last.letter][last.cell] = last.prev;
    return true;
}
export function canUndo() {
    return history.length > 0;
}

const matCache = new Map();
export function matricesFor(grid, d, r) {
    const ck = grid + d + "," + r;
    let m = matCache.get(ck);
    if (!m) {
        m = computeGlyphMatrices(d, r, grid === "H" ? H : V);
        matCache.set(ck, m);
    }
    return m;
}

// ── relatives of an orbit's display rep (in the active seniority) ──
export function focusGlyph(letter, seniorityH) {
    const [d, r] = repOf(letter, seniorityH);
    return { grid: seniorityH ? "H" : "V", d, r };
}

// The orbit letter a glyph carries (no operation suffix), or null off-alphabet.
export function orbitLetterOf(grid, d, r) {
    const lt = glyphLetterAt(grid, d, r);
    return lt ? lt[0] : null;
}

// Substitution of a specific glyph (grid,d,r). A V glyph v→h: a left|right pair
// of H glyphs with a vertical bar (layout "lr"). An H glyph h→v: a top/bottom
// pair of V glyphs with a horizontal bar ("tb"). { pair:[{grid,d,r}×2], bar }.
export function substitutionOf(g, d, r) {
    const seniorityH = g === "H";
    const rule = (seniorityH ? H_TO_V : V_TO_H)[keyStr(d, r)];
    const childGrid = seniorityH ? "V" : "H";
    const layout = seniorityH ? "tb" : "lr";
    if (!rule) return { pair: [], bar: false, layout };
    return {
        pair: rule.pair.map(([cd, cr]) => ({ grid: childGrid, d: cd, r: cr })),
        bar: !!rule.bar,
        layout,
    };
}

// 4→1 translation of a specific glyph: a 2×2 square (NW NE SW SE) with cage-wall
// bars. { children:[{grid,d,r}×4], bars:{vTop,vBot,hLeft,hRight} }.
export function translationOf(g, d, r) {
    const rule = (g === "H" ? TRANSLATION_H : TRANSLATION_V)[keyStr(d, r)];
    if (!rule) return { children: [], bars: {} };
    return {
        children: rule.children.map(([cd, cr]) => ({ grid: g, d: cd, r: cr })),
        bars: rule.bars,
    };
}

// ── the quadrant map at a V/H ladder rung, sectioned into glyphs ──
// A rung is (order, seniority). V_n is the 2ⁿ×2ⁿ square; H_n is the WIDE v→h
// intermediate 2ⁿ×2ⁿ⁺¹ (columns doubled). Anchor offsets curHInit (long) /
// curVInit (lat) ∈ {0,1} are the four quadrant anchors. Validated on-anchor &
// paintable for every rung in test/ladder.mjs. Cached per (order,sen,h,v).
const rungCache = new Map();
export function rungMap(order, seniorityH, curH, curV) {
    const ck = `${order},${seniorityH ? 1 : 0},${curH},${curV}`;
    let cached = rungCache.get(ck);
    if (cached) return cached;
    setOffset(curH, curV);
    const Nr = 1 << order;
    const Nc = seniorityH ? 1 << (order + 1) : 1 << order;
    const m = computeMapModel(Nr, Nc, { seniority: seniorityH ? H : V });
    // The Coylean map itself: the full down/right line field plus per-line 2-adic
    // priority (→ line thickness; cage walls are just the high-priority lines).
    // secCodes/NSr/NSc/grid stay for glyph hit-testing. firstDark* place the
    // section lattice; Mr/Mc are the cell-grid dimensions.
    cached = {
        order,
        seniorityH,
        grid: seniorityH ? "H" : "V",
        codes: m.secCodes,
        NSr: m.NSr,
        NSc: m.NSc,
        SEC: 4,
        downMatrix: m.downMatrix,
        rightMatrix: m.rightMatrix,
        colPriority: m.colPriority,
        rowPriority: m.rowPriority,
        firstDarkCol: m.firstDarkCol,
        firstDarkRow: m.firstDarkRow,
        Mr: m.numRows,
        Mc: m.numColumns,
    };
    rungCache.set(ck, cached);
    return cached;
}

// ── the V/H ladder: rung index k → (order, seniority), and labels ──
export const LADDER_ORDER0 = 4; // k=0 is V4
export const LADDER_RUNGS = 12; // V4,H4,V5,H5,…,V9,H9
export function rungAt(k) {
    const i = Math.max(0, Math.min(LADDER_RUNGS - 1, Math.round(k)));
    return { k: i, order: LADDER_ORDER0 + (i >> 1), seniorityH: (i & 1) === 1 };
}
export function rungLabel(k) {
    const r = rungAt(k);
    return r.order + (r.seniorityH ? "h" : "");
}

// ── scheme IO ──
export function serialize(name = "scheme") {
    const orbits = {};
    for (const o of ORBITS) {
        orbits[o.letter] = {
            canonicalCode: keyStr(o.rep[0], o.rep[1]),
            cells: palette[o.letter].slice(),
        };
    }
    return { name, orbits };
}
export function loadScheme(data) {
    history.length = 0; // a load/clear is not undoable
    for (const L of LETTERS) palette[L] = Array(16).fill(null);
    if (!data || !data.orbits) return;
    for (const [L, entry] of Object.entries(data.orbits)) {
        if (palette[L] && Array.isArray(entry.cells))
            palette[L] = entry.cells.slice(0, 16);
    }
}
