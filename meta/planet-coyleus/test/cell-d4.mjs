// planet-coyleus — the 16-cell D4 permutation.
//
// The whole "paint one cell, every sibling updates" behavior rests on deriving
// an orbit member's 16-cell coloring from its canonical by the SAME D4 motion
// that classifyVisualD4 reports (its `transforms[i]`). The glyph's VISUAL_D4 is
// defined on arrow *segments*; here we bind each of its 8 elements to a concrete
// geometric motion of the 4×4 cell grid and emit the cell permutation, proving:
//
//   1. each VISUAL_D4 element matches exactly one rigid square motion (the
//      segment transform and the cell transform are the same motion);
//   2. every induced 16-cell map is a bijection (a real permutation);
//   3. the 8 permutations compose like D4 (`d4Compose`) — a group action, so
//      chaining members / inverting a paint-back is consistent.
//
//   node meta/planet-coyleus/test/cell-d4.mjs

import {
    transformedPatternKey,
    d4Compose,
    D4_NAMES,
} from "../../../glyphs/glyph-core.js";

// Glyph segment layout (drawGlyph convention):
//   v[x][y]  x:0..2 y:0..3   vertical line at dot-col x+1, rows y..y+1
//   h[x][y]  x:0..3 y:0..2   horizontal line at dot-row y+1, cols x..x+1
// Cells are the 16 squares of the 4×4 grid; cell(i,j) centers at (j+.5, i+.5)
// in (col X, row Y) coordinates over the [0,4]² figure (center = 2).

const emptyPattern = () => ({
    v: Array.from({ length: 3 }, () => Array(4).fill(false)),
    h: Array.from({ length: 4 }, () => Array(3).fill(false)),
});
const keyOf = (p) => transformedPatternKey(p.v, p.h, 0);

// The 8 rigid motions of the square, as maps on a point (X, Y) about center 2.
const MOTIONS = [
    { name: "e", f: (X, Y) => [X, Y] },
    { name: "rot90", f: (X, Y) => [2 + (Y - 2), 2 - (X - 2)] },
    { name: "rot180", f: (X, Y) => [2 - (X - 2), 2 - (Y - 2)] },
    { name: "rot270", f: (X, Y) => [2 - (Y - 2), 2 + (X - 2)] },
    { name: "mirrorX", f: (X, Y) => [2 - (X - 2), Y] }, // flip left↔right
    { name: "mirrorY", f: (X, Y) => [X, 2 - (Y - 2)] }, // flip top↔bottom
    { name: "diagMain", f: (X, Y) => [2 + (Y - 2), 2 + (X - 2)] }, // across Y=X
    { name: "diagAnti", f: (X, Y) => [2 - (Y - 2), 2 - (X - 2)] }, // across Y=-X
];

const isInt = (z) => Math.abs(z - Math.round(z)) < 1e-6;

// Push a whole segment pattern through a motion, reclassifying each segment back
// into the v/h arrays at its new position/orientation.
function transformPattern(p, motion) {
    const out = emptyPattern();
    const place = (X, Y) => {
        if (isInt(X)) {
            // vertical: integer col, half-integer row-mid
            const x = Math.round(X) - 1;
            const y = Math.round(Y - 0.5);
            out.v[x][y] = true;
        } else {
            // horizontal: half-integer col-mid, integer row
            const x = Math.round(X - 0.5);
            const y = Math.round(Y) - 1;
            out.h[x][y] = true;
        }
    };
    for (let x = 0; x < 3; x++)
        for (let y = 0; y < 4; y++)
            if (p.v[x][y]) place(...motion.f(x + 1, y + 0.5));
    for (let x = 0; x < 4; x++)
        for (let y = 0; y < 3; y++)
            if (p.h[x][y]) place(...motion.f(x + 0.5, y + 1));
    return out;
}

// Asymmetric probes — no nontrivial symmetry, so each pins one motion.
function probe(spec) {
    const p = emptyPattern();
    for (const [t, x, y] of spec) p[t][x][y] = true;
    return p;
}
const PROBES = [
    probe([["v", 0, 0]]),
    probe([["h", 0, 0]]),
    probe([["v", 0, 0], ["h", 3, 2], ["v", 2, 1]]),
];

let failures = 0;
const check = (label, cond, detail = "") => {
    console.log(`  ${cond ? "✓" : "✗"} ${label}${detail ? "  — " + detail : ""}`);
    if (!cond) failures++;
};

console.log("planet-coyleus · 16-cell D4 permutation\n");

// ── 1. bind each VISUAL_D4 element to one rigid motion ──
const motionForTi = [];
for (let ti = 0; ti < 8; ti++) {
    const matches = MOTIONS.filter((m) =>
        PROBES.every(
            (pr) =>
                transformedPatternKey(pr.v, pr.h, ti) ===
                keyOf(transformPattern(pr, m)),
        ),
    );
    check(
        `${D4_NAMES[ti].padEnd(3)} ↔ exactly one motion`,
        matches.length === 1,
        matches.map((m) => m.name).join(",") || "none",
    );
    motionForTi[ti] = matches[0];
}

// ── 2. each motion → a 16-cell permutation (bijection) ──
function cellPerm(motion) {
    const perm = new Array(16);
    for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
            const [X, Y] = motion.f(j + 0.5, i + 0.5);
            const j2 = Math.round(X - 0.5);
            const i2 = Math.round(Y - 0.5);
            perm[i * 4 + j] = i2 * 4 + j2;
        }
    return perm;
}
const PERM = motionForTi.map((m) => (m ? cellPerm(m) : null));
check(
    "every cell map is a bijection of the 16 cells",
    PERM.every((p) => p && new Set(p).size === 16 && p.every((d) => d >= 0 && d < 16)),
);

// ── 3. the 8 permutations compose like D4 ──
let homoOK = 0;
for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++) {
        const k = d4Compose(i, j);
        const composed = PERM[j].map((_, c) => PERM[i][PERM[j][c]]);
        if (composed.every((d, c) => d === PERM[k][c])) homoOK++;
    }
check("permutations compose like d4Compose (group action)", homoOK === 64, `${homoOK}/64`);

// ── emit the table for terrain-core ──
console.log("\n  CELL_PERM[ti] — canonical cell c → member cell (4×4, row-major):");
for (let ti = 0; ti < 8; ti++)
    console.log(
        `    ${ti} ${D4_NAMES[ti].padEnd(3)} ${motionForTi[ti].name.padEnd(8)} [${PERM[ti].join(",")}]`,
    );

console.log(
    failures
        ? `\n${failures} check(s) FAILED`
        : "\nall checks passed — 16-cell D4 derivation is sound ✓",
);
process.exit(failures ? 1 : 0);
