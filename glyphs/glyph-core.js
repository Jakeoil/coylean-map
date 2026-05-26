// ═══════════════════════════════════════════════════
//  Coylean Glyphs — core math + model
// ═══════════════════════════════════════════════════
//
// Pure glyph mathematics and assignment model. No DOM, no canvas, no fetch —
// importable in Node for ASCII validation. Depends only on the engine
// (coylean-core.js). The canvas representation of D4 (D4_MATRIX) and all
// drawing live in glyph-render.js / glyphs.js.

import {
    Seniority,
    Propagation,
    Universe,
} from "../coylean-explorer/coylean-core.js";

const NUM_CELLS = 3;

// The 64 V/H glyphs are a FIXED catalog: every glyph is the canonical
// pri(x+1)/pri(y+1) ("010", middle-of-3 senior) propagation, INDEPENDENT of the
// dyadic location. computePattern / computeGlyphMatrices always use these, so
// V14 (etc.) is the same glyph at every location.
const GLYPH_HINIT = 1;
const GLYPH_VINIT = 1;

// Dyadic location of the MAP only. curHInit = longitude (hInitCol, E–W),
// curVInit = latitude (vInitRow, N–S). Drives computeMapModel — i.e. which
// fixed glyphs land in which map cells — and NEVER the glyph definitions. Clean
// baseline = 1/1; the sidebar boxes vary these. See priority-offset-plan.md.
let curHInit = 1;
let curVInit = 1;

function setOffset(h, v) {
    curHInit = h;
    curVInit = v;
}

// Boundary inputs for a 3-bit code: bit i becomes initBoundary[i].
function bitsToBoundary(code, n) {
    const arr = new Array(n);
    for (let i = 0; i < n; i++) arr[i] = !!(code & (1 << i));
    return arr;
}

// ── D4 Visual Equivalence ──
//
// Two glyphs are equivalent under D4 if one's visual segment pattern
// can be rotated/reflected to match the other's. We classify by the
// rendered output, not the input codes, because the Coylean algorithm's
// XOR propagation breaks input-level symmetry.
//
// Visual pattern representation:
//   v[x][y]: vertical segment at col x+1, rows y to y+1  (x: 0-2, y: 0-3)
//   h[x][y]: horizontal segment at row y+1, cols x to x+1 (x: 0-3, y: 0-2)
//
// D4 transforms on this 4×4 segment grid:
//   e    : v'[a][b] = v[a][b],       h'[a][b] = h[a][b]
//   r    : v'[a][b] = h[3-b][a],     h'[a][b] = v[2-b][a]
//   r²   : v'[a][b] = v[2-a][3-b],   h'[a][b] = h[3-a][2-b]
//   r³   : v'[a][b] = h[b][2-a],     h'[a][b] = v[b][3-a]
//   s_h  : v'[a][b] = v[a][3-b],     h'[a][b] = h[a][2-b]
//   s_v  : v'[a][b] = v[2-a][b],     h'[a][b] = h[3-a][b]
//   s_d1 : v'[a][b] = h[b][a],       h'[a][b] = v[b][a]
//   s_d2 : v'[a][b] = h[3-b][2-a],   h'[a][b] = v[2-b][3-a]

function computePattern(downCode, rightCode, seniority) {
    const { downMatrix, rightMatrix } = new Propagation({
        initDown: bitsToBoundary(downCode, NUM_CELLS),
        initRight: bitsToBoundary(rightCode, NUM_CELLS),
        hInitCol: GLYPH_HINIT,
        vInitRow: GLYPH_VINIT,
        seniority,
    });
    // v[x][y] = vertical at col x+1, row y; h[x][y] = horizontal at row y+1, col x
    const v = Array.from({ length: 3 }, () => Array(4).fill(false));
    const h = Array.from({ length: 4 }, () => Array(3).fill(false));
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 3; x++) {
            v[x][y] = !!downMatrix[y][x];
        }
    }
    for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 3; y++) {
            h[x][y] = !!rightMatrix[x][y];
        }
    }
    return { v, h };
}

// Raw propagation matrices for a single 3-cell glyph (including the exit row /
// column the renderer needs for output dots). Defaults to the canonical glyph
// offset so the rendered glyph is the fixed catalog glyph, independent of the
// map's dyadic location.
function computeGlyphMatrices(
    downCode,
    rightCode,
    seniority,
    hInitCol = GLYPH_HINIT,
    vInitRow = GLYPH_VINIT,
) {
    const { downMatrix, rightMatrix } = new Propagation({
        initDown: bitsToBoundary(downCode, NUM_CELLS),
        initRight: bitsToBoundary(rightCode, NUM_CELLS),
        hInitCol,
        vInitRow,
        seniority,
    });
    return { downMatrix, rightMatrix };
}

const VISUAL_D4 = [
    { v: (v, h, a, b) => v[a][b], h: (v, h, a, b) => h[a][b] },
    { v: (v, h, a, b) => h[3 - b][a], h: (v, h, a, b) => v[2 - b][a] },
    { v: (v, h, a, b) => v[2 - a][3 - b], h: (v, h, a, b) => h[3 - a][2 - b] },
    { v: (v, h, a, b) => h[b][2 - a], h: (v, h, a, b) => v[b][3 - a] },
    { v: (v, h, a, b) => v[a][3 - b], h: (v, h, a, b) => h[a][2 - b] },
    { v: (v, h, a, b) => v[2 - a][b], h: (v, h, a, b) => h[3 - a][b] },
    { v: (v, h, a, b) => h[b][a], h: (v, h, a, b) => v[b][a] },
    { v: (v, h, a, b) => h[3 - b][2 - a], h: (v, h, a, b) => v[2 - b][3 - a] },
];

const D4_NAMES = ["e", "r", "r²", "r³", "s_h", "s_v", "s_d1", "s_d2"];

function transformedPatternKey(v, h, ti) {
    const t = VISUAL_D4[ti];
    let key = 0;
    for (let a = 0; a < 3; a++)
        for (let b = 0; b < 4; b++)
            if (t.v(v, h, a, b)) key |= 1 << (a * 4 + b);
    for (let a = 0; a < 4; a++)
        for (let b = 0; b < 3; b++)
            if (t.h(v, h, a, b)) key |= 1 << (12 + a * 3 + b);
    return key;
}

// Apply VISUAL_D4[ti] to a pattern, returning fresh {v, h} arrays.
function applyVisual(v, h, ti) {
    const t = VISUAL_D4[ti];
    const nv = Array.from({ length: 3 }, () => Array(4).fill(false));
    const nh = Array.from({ length: 4 }, () => Array(3).fill(false));
    for (let a = 0; a < 3; a++)
        for (let b = 0; b < 4; b++) nv[a][b] = t.v(v, h, a, b);
    for (let a = 0; a < 4; a++)
        for (let b = 0; b < 3; b++) nh[a][b] = t.h(v, h, a, b);
    return { v: nv, h: nh };
}

// Cayley table[i][j] = k with VISUAL_D4[i] ∘ VISUAL_D4[j] = VISUAL_D4[k],
// found via an asymmetric probe (one off-axis segment → 8 distinct keys).
// (glyph-render.js completes its canvas D4_MATRIX rotations from this table.)
const D4_COMPOSE = (() => {
    const pv = Array.from({ length: 3 }, () => Array(4).fill(false));
    const ph = Array.from({ length: 4 }, () => Array(3).fill(false));
    pv[0][0] = true;
    const probeKey = [];
    for (let ti = 0; ti < 8; ti++)
        probeKey[ti] = transformedPatternKey(pv, ph, ti);

    const table = Array.from({ length: 8 }, () => Array(8).fill(0));
    for (let i = 0; i < 8; i++)
        for (let j = 0; j < 8; j++) {
            const pj = applyVisual(pv, ph, j);
            const pij = applyVisual(pj.v, pj.h, i);
            table[i][j] = probeKey.indexOf(
                transformedPatternKey(pij.v, pij.h, 0),
            );
        }

    return table;
})();

function d4Compose(i, j) {
    return D4_COMPOSE[i][j];
}

// Suffix naming a lettered glyph's orientation, indexed by D4 element.
const D4_SUFFIX = [
    "", //        0 e
    "↻", //  1 r   ↻
    "⟲", //  2 r²  ⟲
    "↺", //  3 r³  ↺
    "↕", //  4 s_h ↕
    "↔", //  5 s_v ↔
    "\\", //      6 s_d1
    "/", //       7 s_d2
];

function pairKey(d, r) {
    return d * 8 + r;
}

function classifyVisualD4(seniority) {
    const glyphs = [];
    for (let d = 0; d < 8; d++) {
        for (let r = 0; r < 8; r++) {
            const { v, h } = computePattern(d, r, seniority);
            let canonKey = Infinity;
            const keys = [];
            for (let ti = 0; ti < 8; ti++) {
                const k = transformedPatternKey(v, h, ti);
                keys.push(k);
                if (k < canonKey) canonKey = k;
            }
            glyphs.push({ d, r, v, h, canonKey, keys });
        }
    }

    const groups = new Map();
    for (const g of glyphs) {
        if (!groups.has(g.canonKey)) groups.set(g.canonKey, []);
        groups.get(g.canonKey).push(g);
    }

    const classes = [];
    for (const members of groups.values()) {
        const orbit = members.map((m) => [m.d, m.r]);
        orbit.sort((a, b) => pairKey(a[0], a[1]) - pairKey(b[0], b[1]));
        const rep = orbit[0];
        const rm = members.find((m) => m.d === rep[0] && m.r === rep[1]);
        const repKey = rm.keys[0]; // identity = original pattern

        // For each orbit member, find which D4 transform maps rep → member
        const transforms = orbit.map(([d, r]) => {
            const m = members.find((x) => x.d === d && x.r === r);
            const mKey = m.keys[0];
            for (let ti = 0; ti < 8; ti++) {
                if (transformedPatternKey(rm.v, rm.h, ti) === mKey) return ti;
            }
            return 0;
        });

        classes.push({ rep, orbit, transforms, orbitSize: orbit.length });
    }

    classes.sort(
        (a, b) => pairKey(a.rep[0], a.rep[1]) - pairKey(b.rep[0], b.rep[1]),
    );
    return classes;
}

function orbitKey(cls) {
    return cls.orbit.map((m) => pairKey(m[0], m[1])).join(",");
}

// ── Section codes ──
// Canonical clean-map section model (single-arrow seed at hInitCol/vInitRow 0),
// used by the substitution + translation tables. The offset universe-integration
// map model lives with the renderer.
function getSectionData(Nr, Nc, seniority) {
    const Mr = Nr + 1;
    const Mc = Nc + 1;
    const SEC = 4;
    const NSr = Nr / SEC;
    const NSc = Nc / SEC;

    const initDown = new Array(Mc).fill(false);
    const initRight = new Array(Mr).fill(false);
    if (!seniority.isVertical) initRight[0] = true;
    else initDown[0] = true;

    const { downMatrix, rightMatrix } = new Propagation({
        initDown,
        initRight,
        hInitCol: 0,
        vInitRow: 0,
        seniority,
    });

    const codes = Array.from({ length: NSr }, () =>
        Array.from({ length: NSc }, () => [0, 0]),
    );
    // vBound[sr][sc]: vertical segment at section sc's exit column, row sr
    // hBound[sr][sc]: horizontal segment at section sr's exit row, col sc
    const vBound = Array.from({ length: NSr }, () => Array(NSc).fill(false));
    const hBound = Array.from({ length: NSr }, () => Array(NSc).fill(false));

    for (let sr = 0; sr < NSr; sr++) {
        for (let sc = 0; sc < NSc; sc++) {
            const y0 = sr * SEC + 1;
            const x0 = sc * SEC + 1;
            // Section input codes: down arrows entering the section's first
            // interior row, right arrows entering its first interior column.
            for (let i = 0; i < 3; i++) {
                if (downMatrix[y0][x0 + i]) codes[sr][sc][0] |= 1 << i;
                if (rightMatrix[x0][y0 + i]) codes[sr][sc][1] |= 1 << i;
            }
            // Boundary segments live at colInSec=3 / rowInSec=3 — the 4th
            // cell of each section. Match the original semantics: vBound is
            // true if any cell along the section's exit column has a vertical
            // arrow; likewise for hBound along the exit row.
            if (sc < NSc - 1) {
                let any = false;
                for (let i = 0; i < 4; i++) {
                    if (downMatrix[y0 + i][x0 + 3]) {
                        any = true;
                        break;
                    }
                }
                vBound[sr][sc] = any;
            }
            if (sr < NSr - 1) {
                let any = false;
                for (let i = 0; i < 4; i++) {
                    if (rightMatrix[x0 + i][y0 + 3]) {
                        any = true;
                        break;
                    }
                }
                hBound[sr][sc] = any;
            }
        }
    }
    return { codes, NSr, NSc, vBound, hBound };
}

// SE-patch map model for the catalog maps. Realizes the map as a universe with
// westExtent=northExtent=1 and east/south reaching across, then integrates its
// boundary into one SE propagation (fromUniverseBoundary bakes in the catalog→
// map −1 and the correct all-true boundary seed; see priority-offset-plan.md).
// Returns the matrices, priorities, cage geometry, and per-cage section codes;
// the renderer consumes this and only draws. Pure (no canvas).
function computeMapModel(Nr, Nc, opts) {
    const seniority = (opts && opts.seniority) || Seniority.vertical();
    const SEC = 4;
    const hInitCol = curHInit - 1;
    const vInitRow = curVInit - 1;
    // First senior column/row: where pri(k + hInitCol) ≥ 2, i.e. k ≡ −hInitCol
    // (mod 4). The 4×4 cages sit on this lattice; a partial cage may precede it
    // on the N/W edge. Extend E/S by that shift so a full run of cages still
    // fits after realignment.
    const firstDarkCol = (((-hInitCol) % SEC) + SEC) % SEC;
    const firstDarkRow = (((-vInitRow) % SEC) + SEC) % SEC;

    const universe = Universe.create({
        northExtent: 1,
        westExtent: 1,
        eastExtent: Nc + firstDarkCol,
        southExtent: Nr + firstDarkRow,
        hInitCol: curHInit,
        vInitRow: curVInit,
        seniority,
    });
    const {
        downMatrix,
        rightMatrix,
        colPriority,
        rowPriority,
        numRows,
        numColumns,
    } = Propagation.fromUniverseBoundary(universe);

    const Mr = numRows;
    const Mc = numColumns;

    // Bounds-guarded reads (cages near the edges may probe one past the grid).
    const dAt = (y, x) =>
        y >= 0 && x >= 0 && downMatrix[y] && x < downMatrix[y].length
            ? downMatrix[y][x]
            : false;
    const rAt = (x, y) =>
        x >= 0 && y >= 0 && rightMatrix[x] && y < rightMatrix[x].length
            ? rightMatrix[x][y]
            : false;

    // Cage grid: full 4×4 sections anchored on the senior lattice. Only full
    // cages hold a glyph; the partial N/W margin (firstDark cells) gets none.
    const NSr = Math.floor((Mr - firstDarkRow) / SEC);
    const NSc = Math.floor((Mc - firstDarkCol) / SEC);
    const secCodes = Array.from({ length: NSr }, () =>
        Array.from({ length: NSc }, () => [0, 0]),
    );
    // Section input codes at each full cage's interior, offset onto the senior
    // lattice by firstDarkRow/Col.
    for (let sr = 0; sr < NSr; sr++) {
        for (let sc = 0; sc < NSc; sc++) {
            const y0 = firstDarkRow + sr * SEC + 1;
            const x0 = firstDarkCol + sc * SEC + 1;
            for (let i = 0; i < 3; i++) {
                if (dAt(y0, x0 + i)) secCodes[sr][sc][0] |= 1 << i;
                if (rAt(x0, y0 + i)) secCodes[sr][sc][1] |= 1 << i;
            }
        }
    }

    return {
        downMatrix,
        rightMatrix,
        colPriority,
        rowPriority,
        numRows: Mr,
        numColumns: Mc,
        SEC,
        firstDarkCol,
        firstDarkRow,
        NSr,
        NSc,
        secCodes,
        seniority,
        isVertical: seniority.isVertical,
    };
}

// ── Assignment model ──

// Stored per assigned glyph: "d,r" → [letter, d4Index]. d4Index is the
// single D4 element (0–7, indexing VISUAL_D4 / D4_NAMES) the letter is drawn
// under, so rendered orientations match the glyph's true D4 relationships.
let GLYPH_LETTERS = {};
let H_GLYPH_LETTERS = {};

// baseD4 = the orientation the named glyph's letter is drawn under (0 = e
// upright, 6 = s_d1 "\", 7 = s_d2 "/"). Each orbit member's stored element is
// (member transform from base) ∘ baseD4, so member-to-member relationships
// render as the true glyph D4 relationships.
function assignLetter(
    classes,
    downCode,
    rightCode,
    letter,
    target = GLYPH_LETTERS,
    seniority = Seniority.vertical(),
    baseD4 = 0,
) {
    for (const cls of classes) {
        if (cls.orbit.some(([d, r]) => d === downCode && r === rightCode)) {
            // Transforms are relative to the named glyph (not the orbit rep).
            const base = computePattern(downCode, rightCode, seniority);
            for (let i = 0; i < cls.orbit.length; i++) {
                const [d, r] = cls.orbit[i];
                const mem = computePattern(d, r, seniority);
                const memKey = transformedPatternKey(mem.v, mem.h, 0);
                for (let ti = 0; ti < 8; ti++) {
                    if (transformedPatternKey(base.v, base.h, ti) === memKey) {
                        target[d + "," + r] = [letter, d4Compose(ti, baseD4)];
                        break;
                    }
                }
            }
            break;
        }
    }
}

// D4 equivalence classes of the fixed glyph catalog. Constant (computePattern
// uses the canonical glyph offset), so these don't change with the dyadic
// location; applyAssignments rebuilds them once and re-letters.
let V_CLASSES;
let H_CLASSES;

function rebuildClasses() {
    V_CLASSES = classifyVisualD4(Seniority.vertical());
    H_CLASSES = classifyVisualD4(Seniority.horizontal());
    const vKeys = new Set(V_CLASSES.map(orbitKey));
    const hKeys = new Set(H_CLASSES.map(orbitKey));
    V_CLASSES.forEach((c) => {
        c.colorClass = hKeys.has(orbitKey(c)) ? "both" : "v-only";
    });
    H_CLASSES.forEach((c) => {
        c.colorClass = vKeys.has(orbitKey(c)) ? "both" : "h-only";
    });
}

// ── Letter assignments ──
// Old: V upright, H sideways (backslash dual). New: V sideways on each
// family's diagonal ("\\" = s_d1, "/" = s_d2); H is the whole-map backslash
// dual of V — same symbol, oriented s_d1 ∘ (V orientation), so upright or
// 180°, never sideways. Switch with the checkbox at the top (chicken switch).
const H_SENIORITY = Seniority.horizontal();

// Old-scheme H grid: the original letters at the dual codes, drawn
// sideways (baseD4 = 6 = s_d1). The new scheme assigns H inline below.
function applyHAssignments(baseD4) {
    assignLetter(H_CLASSES, 7, 7, "F", H_GLYPH_LETTERS, H_SENIORITY, baseD4);
    assignLetter(H_CLASSES, 7, 1, "P", H_GLYPH_LETTERS, H_SENIORITY, baseD4);
    assignLetter(H_CLASSES, 6, 6, "J", H_GLYPH_LETTERS, H_SENIORITY, baseD4);
    assignLetter(H_CLASSES, 6, 5, "M", H_GLYPH_LETTERS, H_SENIORITY, baseD4);
    assignLetter(H_CLASSES, 0, 0, "O", H_GLYPH_LETTERS, H_SENIORITY, baseD4);
    assignLetter(H_CLASSES, 1, 1, "L", H_GLYPH_LETTERS, H_SENIORITY, baseD4);
    assignLetter(H_CLASSES, 5, 2, "Q", H_GLYPH_LETTERS, H_SENIORITY, baseD4);
    assignLetter(H_CLASSES, 7, 0, "T", H_GLYPH_LETTERS, H_SENIORITY, baseD4);
    assignLetter(H_CLASSES, 5, 1, "B", H_GLYPH_LETTERS, H_SENIORITY, baseD4);
    assignLetter(H_CLASSES, 1, 5, "Y", H_GLYPH_LETTERS, H_SENIORITY, baseD4);
    assignLetter(H_CLASSES, 1, 6, "R", H_GLYPH_LETTERS, H_SENIORITY, baseD4);
    assignLetter(H_CLASSES, 6, 1, "S", H_GLYPH_LETTERS, H_SENIORITY, baseD4);
}

// Preserved baseline — the original upright V assignments, kept verbatim.
function applyOldAssignments() {
    assignLetter(V_CLASSES, 7, 7, "F");
    assignLetter(V_CLASSES, 1, 7, "P");
    assignLetter(V_CLASSES, 6, 6, "J");
    assignLetter(V_CLASSES, 5, 6, "M");
    assignLetter(V_CLASSES, 0, 0, "O");
    assignLetter(V_CLASSES, 1, 1, "L");
    assignLetter(V_CLASSES, 2, 5, "Q");
    assignLetter(V_CLASSES, 0, 7, "T");
    assignLetter(V_CLASSES, 1, 5, "B");
    assignLetter(V_CLASSES, 5, 1, "Y");
    assignLetter(V_CLASSES, 6, 1, "R");
    assignLetter(V_CLASSES, 1, 6, "S");
    applyHAssignments(6); // sideways H (s_d1), as in the original
}

// New-scheme assignments: a dict from member index — grid letter ("V"/"H") +
// down-code digit + right-code digit, each 0–7 — to a symbol. Naming a member
// makes it the identity (state e) of its D4 group; the whole orbit, spanning
// both the V and H grids via the backslash dual, follows. A trailing transform
// suffix relocates the identity to another member of the group:
//   e=identity  1,2,3=rotations  -=flip(↕)  |=flip(↔)  \=backslash  /=slash
// The symbol is a unicode character; expressing it as an image (e.g. the baby-
// blocks SVG render) is a higher-level concern driven by the same [symbol, d4].
// glyphs/assignments.json is authoritative (fetched each refresh); the dict
// below mirrors it as a fallback (e.g. file://).
const DEFAULT_ASSIGNMENTS = {
    V77: "F\\",
    V17: "P/",
    V66: "J\\",
    V56: "B/",
    V00: "O\\",
    V11: "L/",
    V25: "Q\\",
    V07: "E\\",
    V15: "V/",
    V51: "C/",
    V61: "R\\",
    V16: "N/",
};
let NEW_ASSIGNMENTS = DEFAULT_ASSIGNMENTS;

// Editor hooks: assign.mjs reads/replaces the working (new-scheme) dict, then
// calls applyAssignmentsAndRender(true) to re-render maps + grids + groups.
function getWorkingAssignments() {
    return NEW_ASSIGNMENTS;
}
function setWorkingAssignments(dict) {
    NEW_ASSIGNMENTS = dict;
}

// Effective rendered letter at a member: [symbol, d4] or null. Reads the live
// GLYPH_LETTERS / H_GLYPH_LETTERS the renderer just built, so the editor can
// pre-fill the current letter when a member is selected.
function glyphLetterAt(grid, d, r) {
    const map = grid === "H" ? H_GLYPH_LETTERS : GLYPH_LETTERS;
    return map[d + "," + r] || null;
}

// Member keys ("V77", …) of the D4 orbit containing (d, r) in one grid. Lets the
// editor clear a whole group when re-lettering one of its members, keeping one
// dict entry per group. V_CLASSES/H_CLASSES are populated by the time the editor
// (which runs after the first render) calls this.
function orbitMemberKeys(grid, d, r) {
    const classes = grid === "H" ? H_CLASSES : V_CLASSES;
    for (const cls of classes) {
        if (cls.orbit.some(([dd, rr]) => dd === d && rr === r)) {
            return cls.orbit.map(([dd, rr]) => grid + dd + rr);
        }
    }
    return [grid + d + r];
}

// Old-scheme dict, loaded from assignments-old.json. Null until loaded; when
// null, applyAssignments falls back to the hard-coded applyOldAssignments
// baseline, so nothing depends on the file being present.
let OLD_ASSIGNMENTS = null;
function setOldAssignments(dict) {
    OLD_ASSIGNMENTS = dict;
}

// Transform suffix → D4 index (catalog D4_SUFFIX order). e/\\// are exercised by
// the defaults; rotations/flips are positional and easy to recalibrate.
const SUFFIX_TO_D4 = {
    e: 0,
    "1": 1,
    "2": 2,
    "3": 3,
    "-": 4,
    "|": 5,
    "\\": 6,
    "/": 7,
};
// "F" / "P/" / "p-" → { symbol, d4 }. The symbol is a unicode character (which
// may itself stand in for an image/glyph — that's a higher-level concern); an
// optional trailing transform suffix sets the named member's orientation.
function parseAssignmentValue(val) {
    let d4 = 0;
    let symbol = val;
    if (val.length >= 2) {
        const last = val.slice(-1);
        if (Object.prototype.hasOwnProperty.call(SUFFIX_TO_D4, last)) {
            d4 = SUFFIX_TO_D4[last];
            symbol = val.slice(0, -1);
        }
    }
    return { symbol, d4 };
}

// "V15" / "H37" → { grid, d, r }.
function parseMemberKey(key) {
    return {
        grid: key[0].toUpperCase(),
        d: parseInt(key[1], 10),
        r: parseInt(key[2], 10),
    };
}

// Apply one member-index dict (new or old scheme — same machinery; the old set
// is just this format with no suffixes, so its H dual lands at baseD4 = 6).
function applyAssignmentDict(dict) {
    for (const [key, val] of Object.entries(dict)) {
        if (!/^[VH][0-7][0-7]$/.test(key)) continue; // skip non-member keys
        const { grid, d, r } = parseMemberKey(key);
        const { symbol, d4 } = parseAssignmentValue(val);
        // Anchor on the named grid (named member = identity in state `d4`); the
        // other grid gets the whole-map backslash dual at the transposed code,
        // oriented s_d1 ∘ d4 — i.e. upright/180°, never sideways.
        if (grid === "H") {
            assignLetter(
                H_CLASSES, d, r, symbol,
                H_GLYPH_LETTERS, H_SENIORITY, d4,
            );
            assignLetter(
                V_CLASSES, r, d, symbol,
                GLYPH_LETTERS, Seniority.vertical(), d4Compose(6, d4),
            );
        } else {
            assignLetter(
                V_CLASSES, d, r, symbol,
                GLYPH_LETTERS, Seniority.vertical(), d4,
            );
            assignLetter(
                H_CLASSES, r, d, symbol,
                H_GLYPH_LETTERS, H_SENIORITY, d4Compose(6, d4),
            );
        }
    }
}

// Rebuild the whole letter model for the current offsets and scheme. The
// renderer (glyphs.js) calls this, then redraws maps/grids/groups.
function applyAssignments(useNew) {
    rebuildClasses();
    GLYPH_LETTERS = {};
    H_GLYPH_LETTERS = {};
    if (useNew) applyAssignmentDict(NEW_ASSIGNMENTS);
    else if (OLD_ASSIGNMENTS) applyAssignmentDict(OLD_ASSIGNMENTS);
    else applyOldAssignments(); // hard-coded baseline (file absent)
}

export {
    NUM_CELLS,
    curHInit,
    curVInit,
    setOffset,
    bitsToBoundary,
    d4Compose,
    D4_NAMES,
    D4_SUFFIX,
    pairKey,
    getSectionData,
    computeGlyphMatrices,
    computeMapModel,
    GLYPH_LETTERS,
    H_GLYPH_LETTERS,
    V_CLASSES,
    H_CLASSES,
    glyphLetterAt,
    orbitMemberKeys,
    getWorkingAssignments,
    setWorkingAssignments,
    setOldAssignments,
    parseAssignmentValue,
    SUFFIX_TO_D4,
    applyAssignments,
};
