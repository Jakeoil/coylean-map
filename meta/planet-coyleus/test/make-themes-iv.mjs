// planet-coyleus — generate color-assignments-IV.json from Themes II.
//
// Two edits, both structure-aware (see test/color-forcing.mjs):
//   1. The light-green outlined area (#b8e1b8, one forced class) → ice.rime, a
//      pale blue (terrains.ice.rime).
//   2. The non-forced duplicates — one color spread over several independent
//      forced classes — get differentiated: keep the LARGEST class on the
//      original color, recolor each other class to its nearest UNUSED terrains
//      swatch (so siblings stay similar but areas read as distinct).
//
//   node meta/planet-coyleus/test/make-themes-iv.mjs

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve as pathResolve } from "path";
import { oklchHex } from "../../4d/src/oklch-ramps.js";
import { LETTERS, loadScheme, cellsFor, rungMap } from "../terrain-core.js";

const here = dirname(fileURLToPath(import.meta.url));
const P = (f) => pathResolve(here, "..", f);
const hexOf = (n) => "#" + (n & 0xffffff).toString(16).padStart(6, "0");

const II = JSON.parse(readFileSync(P("color-assignments-II.json"), "utf8"));

// deep copy → Themes IV
const IV = { name: "Themes IV", orbits: {} };
for (const [L, o] of Object.entries(II.orbits))
    IV.orbits[L] = { canonicalCode: o.canonicalCode, cells: o.cells.slice() };

// ── terrains palette (the only source for differentiating swatches) ──
const ramps = JSON.parse(
    readFileSync(P("terrain-ramps.json"), "utf8"),
).palettes.find((p) => p.id === "terrains").ramps;
const TERRAIN = [];
for (const r of ramps)
    for (const [label, [L, C]] of Object.entries(r.stops))
        TERRAIN.push({ name: `${r.name}.${label}`, hex: hexOf(oklchHex(L, C, r.hue)) });
const RIME = TERRAIN.find((t) => t.name === "ice.rime").hex;

// ── 1. light-green area → ice.rime ──
for (const o of Object.values(IV.orbits))
    o.cells = o.cells.map((c) => (c === "#b8e1b8" ? RIME : c));

// ── forced classes (structure only; identical for II and IV) ──
const ATOMS = [];
const synthetic = { name: "t", orbits: {} };
for (const L of LETTERS) {
    const cells = Array.from({ length: 16 }, (_, i) => {
        const t = `${L}#${i}`;
        ATOMS.push(t);
        return t;
    });
    synthetic.orbits[L] = { canonicalCode: "0,0", cells };
}
const parent = new Map(ATOMS.map((a) => [a, a]));
const find = (a) => {
    while (parent.get(a) !== a) {
        parent.set(a, parent.get(parent.get(a)));
        a = parent.get(a);
    }
    return a;
};
const union = (a, b) => {
    const ra = find(a),
        rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
};
for (const order of [5, 6])
    for (const sh of [false, true])
        for (const [h, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
            loadScheme(synthetic);
            const R = rungMap(order, sh, h, v);
            const { codes, NSr, NSc, SEC, downMatrix, rightMatrix, grid } = R;
            const A = new Map();
            const key = (x, y) => x + "," + y;
            for (let r = 0; r < NSr; r++)
                for (let c = 0; c < NSc; c++) {
                    const [d, rr] = codes[r][c];
                    const t = cellsFor(grid, d, rr);
                    for (let i = 0; i < SEC; i++)
                        for (let j = 0; j < SEC; j++)
                            A.set(
                                key(R.firstDarkCol + c * SEC + 1 + j, R.firstDarkRow + r * SEC + 1 + i),
                                t[i * SEC + j],
                            );
                }
            for (const [k, a] of A) {
                const [x, y] = k.split(",").map(Number);
                const e = A.get(key(x + 1, y));
                if (e !== undefined && !(downMatrix[y] && downMatrix[y][x])) union(a, e);
                const s = A.get(key(x, y + 1));
                if (s !== undefined && !(rightMatrix[x] && rightMatrix[x][y])) union(a, s);
            }
        }
const classes = new Map();
for (const a of ATOMS) {
    const r = find(a);
    if (!classes.has(r)) classes.set(r, []);
    classes.get(r).push(a);
}

const colorOf = (tag) => {
    const [L, i] = tag.split("#");
    return IV.orbits[L].cells[+i];
};
const setColor = (tag, hex) => {
    const [L, i] = tag.split("#");
    IV.orbits[L].cells[+i] = hex;
};

// ── 2. differentiate non-forced duplicates with nearest unused terrain swatch ──
// redmean perceptual-ish RGB distance
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function dist(h1, h2) {
    const [r1, g1, b1] = rgb(h1),
        [r2, g2, b2] = rgb(h2);
    const rm = (r1 + r2) / 2,
        dr = r1 - r2,
        dg = g1 - g2,
        db = b1 - b2;
    return Math.sqrt(
        (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db,
    );
}

// group forced classes by their current IV color
const byColor = new Map();
for (const atoms of classes.values()) {
    const col = colorOf(atoms[0]);
    if (!byColor.has(col)) byColor.set(col, []);
    byColor.get(col).push(atoms);
}

const used = new Set();
for (const o of Object.values(IV.orbits)) for (const c of o.cells) used.add(c);

const changes = [];
for (const [col, group] of byColor) {
    if (group.length < 2) continue; // not reused → nothing to do
    group.sort((a, b) => b.length - a.length); // keep the largest on `col`
    for (let g = 1; g < group.length; g++) {
        // nearest terrains swatch not yet used anywhere in IV
        let best = null,
            bestD = Infinity;
        for (const t of TERRAIN) {
            if (used.has(t.hex)) continue;
            const d = dist(col, t.hex);
            if (d < bestD) (bestD = d), (best = t);
        }
        if (!best) throw new Error("ran out of unused terrain swatches");
        used.add(best.hex);
        for (const tag of group[g]) setColor(tag, best.hex);
        changes.push({ from: col, to: best.hex, swatch: best.name, atoms: group[g] });
    }
}

writeFileSync(P("color-assignments-IV.json"), JSON.stringify(IV, null, 2) + "\n");

// ── report ──
console.log(`light-green area #b8e1b8 → ice.rime ${RIME}`);
console.log(`\ndifferentiated ${changes.length} duplicate classes:`);
for (const c of changes)
    console.log(
        `  ${c.from} → ${c.to}  (${c.swatch})  ${c.atoms.length} cells: ${c.atoms.join(" ")}`,
    );
console.log(`\nwrote ${P("color-assignments-IV.json")}`);
