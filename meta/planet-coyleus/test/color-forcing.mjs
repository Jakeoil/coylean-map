// planet-coyleus — color-forcing analysis.
//
// "All cells inside one outlined area must share a color." An outlined area is a
// connected run of map cells with no line (wall) between them; walls are the
// down/right line field. Color is stored per D4-orbit canonical cell (192 atoms
// = 12 orbits × 16 cells), so whenever two atoms ever land in a common outlined
// area, the map FORCES them to the same color. This walks real maps (several
// orders, both seniorities, all four anchors), unions atoms that share an area,
// and reports:
//
//   1. CONTRADICTIONS — a forced class that is NOT monochrome in the scheme:
//      an outlined area painted two colors. That is a real defect (visible).
//   2. forced classes — the true number of independent color slots the map
//      demands; far fewer than 192 because areas merge atoms.
//   3. REUSE — one color spread over several independent forced classes. Some is
//      intentional (all water = blue); the suspicious ones are two atoms of the
//      SAME glyph sharing a color while sitting in different forced classes.
//
//   node meta/planet-coyleus/test/color-forcing.mjs [path-to-scheme.json]

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve as pathResolve } from "path";
import { LETTERS, loadScheme, cellsFor, rungMap } from "../terrain-core.js";

const here = dirname(fileURLToPath(import.meta.url));
const schemeFile =
    process.argv[2] || pathResolve(here, "..", "color-assignments-II.json");
const scheme = JSON.parse(readFileSync(schemeFile, "utf8"));

// ── atom identity: load a synthetic scheme whose 16 cells are unique tags, then
// cellsFor() reports, per displayed cell, exactly which (orbit, canonical-cell)
// atom it is — independent of any color. ──
const ATOMS = [];
const synthetic = { name: "tags", orbits: {} };
for (const L of LETTERS) {
    const cells = Array.from({ length: 16 }, (_, i) => {
        const tag = `${L}#${i}`;
        ATOMS.push(tag);
        return tag;
    });
    synthetic.orbits[L] = { canonicalCode: "0,0", cells };
}

// ── union-find over the 192 atoms ──
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

// Walk one rung: tag every interior cell with its atom, then union atoms that
// sit in a common outlined area (no wall on the shared edge). Returns the count
// of (atom-pair) merges performed, so we can watch the partition stabilize.
function walkRung(order, seniorityH, curH, curV) {
    loadScheme(synthetic);
    const rung = rungMap(order, seniorityH, curH, curV);
    const { codes, NSr, NSc, SEC, downMatrix, rightMatrix } = rung;
    const fdc = rung.firstDarkCol,
        fdr = rung.firstDarkRow;
    const grid = rung.grid;

    // atomAt[y][x] over the interior cell lattice (sparse via Map keyed "x,y")
    const atomAt = new Map();
    const key = (x, y) => x + "," + y;
    for (let R = 0; R < NSr; R++)
        for (let C = 0; C < NSc; C++) {
            const [d, r] = codes[R][C];
            const tags = cellsFor(grid, d, r); // atom tag per idx = i*4 + j
            for (let i = 0; i < SEC; i++)
                for (let j = 0; j < SEC; j++) {
                    const x = fdc + C * SEC + 1 + j;
                    const y = fdr + R * SEC + 1 + i;
                    atomAt.set(key(x, y), tags[i * SEC + j]);
                }
        }

    let merges = 0;
    for (const [k, a] of atomAt) {
        const [x, y] = k.split(",").map(Number);
        // east neighbour — open unless a vertical wall sits between them
        const e = atomAt.get(key(x + 1, y));
        if (e !== undefined && !(downMatrix[y] && downMatrix[y][x])) {
            if (find(a) !== find(e)) merges++;
            union(a, e);
        }
        // south neighbour — open unless a horizontal wall sits between them
        const s = atomAt.get(key(x, y + 1));
        if (s !== undefined && !(rightMatrix[x] && rightMatrix[x][y])) {
            if (find(a) !== find(s)) merges++;
            union(a, s);
        }
    }
    return merges;
}

// ── sweep: orders 5..8, V and H, all four anchors. Watch merges fall to 0. ──
const ORDERS = [5, 6, 7, 8];
const ANCHORS = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
];
console.log(`scheme: ${scheme.name}  (${schemeFile})`);
console.log("\nmerge sweep (new atom-pair unions per pass — should reach 0):");
for (const order of ORDERS) {
    for (const sh of [false, true]) {
        let m = 0;
        for (const [h, v] of ANCHORS) m += walkRung(order, sh, h, v);
        console.log(
            `  order ${order} ${sh ? "H" : "V"}  (4 anchors):  ${m} merges`,
        );
    }
}

// ── forced classes ──
const classes = new Map(); // root → [atoms]
for (const a of ATOMS) {
    const r = find(a);
    if (!classes.has(r)) classes.set(r, []);
    classes.get(r).push(a);
}

// color of an atom in the real scheme
const colorOf = (tag) => {
    const [L, i] = tag.split("#");
    return scheme.orbits[L]?.cells[+i] ?? null;
};
const glyphOf = (tag) => tag.split("#")[0];

console.log(
    `\n192 atoms → ${classes.size} forced classes ` +
        `(independent color slots the structure demands).`,
);

// 1. CONTRADICTIONS: a forced class painted >1 color.
const contradictions = [];
for (const [root, atoms] of classes) {
    const cols = new Set(atoms.map(colorOf));
    if (cols.size > 1) contradictions.push({ root, atoms, cols: [...cols] });
}
console.log(`\n── 1. contradictions (outlined area painted two colors) ──`);
if (!contradictions.length) {
    console.log("  none — every outlined area is monochrome. Scheme is");
    console.log("  consistent with the forcing structure. ✓");
} else {
    for (const c of contradictions) {
        console.log(`  ✗ class of ${c.atoms.length} atoms uses ${c.cols.length} colors:`);
        const byColor = {};
        for (const a of c.atoms) (byColor[colorOf(a)] ??= []).push(a);
        for (const [col, as] of Object.entries(byColor))
            console.log(`      ${col}  ←  ${as.join(" ")}`);
    }
}

// 2. REUSE: one color across several independent forced classes.
const colorClasses = new Map(); // color → [classRoot...]
for (const [root, atoms] of classes) {
    const col = colorOf(atoms[0]);
    if (contradictions.find((c) => c.root === root)) continue; // skip mixed
    if (!colorClasses.has(col)) colorClasses.set(col, []);
    colorClasses.get(col).push(atoms);
}
console.log(`\n── 2. color reuse across independent forced classes ──`);
const reused = [...colorClasses.entries()]
    .filter(([, cs]) => cs.length > 1)
    .sort((a, b) => b[1].length - a[1].length);
console.log(
    `  ${colorClasses.size} colors; ${reused.length} are reused by >1 class.`,
);
for (const [col, cs] of reused) {
    const sizes = cs.map((c) => c.length).join("+");
    console.log(`\n  ${col} — ${cs.length} classes (${sizes} atoms):`);
    for (const c of cs) console.log(`      { ${c.join(" ")} }`);
}

// 3. SAME-GLYPH duplicates: two atoms of one glyph, same color, but in different
//    forced classes — the most likely accidental dup (within a glyph you almost
//    always want distinct areas to read as distinct colors).
console.log(`\n── 3. same-glyph duplicates (likely accidental) ──`);
let flagged = 0;
for (const L of LETTERS) {
    const byColor = {}; // color → set of class-roots within this glyph
    for (let i = 0; i < 16; i++) {
        const tag = `${L}#${i}`;
        const col = colorOf(tag);
        (byColor[col] ??= new Map()).set(find(tag), tag);
    }
    for (const [col, roots] of Object.entries(byColor)) {
        if (roots.size > 1) {
            flagged++;
            console.log(
                `  glyph ${L}: ${col} appears in ${roots.size} separate areas ` +
                    `→ cells ${[...roots.values()].join(" ")}`,
            );
        }
    }
}
if (!flagged) console.log("  none.");
