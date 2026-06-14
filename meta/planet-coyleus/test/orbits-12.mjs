// planet-coyleus — the 12-orbit foundation check.
//
// Settles the palette-shape question for terrains.html. Verifies, against the
// engine + glyph-core (no canvas), that:
//
//   1. the anchor (clean canonical V) map closes on 35 section codes / 12 D4
//      orbits — the alphabet the whole planet is tiled from;
//   2. those 12 orbits are exactly the 12 letters in glyphs/assignments.json
//      (bijective — one letter per appearing orbit, no extras);
//   3. one orbit spans BOTH the V and H grids: transposing a V orbit's codes
//      (d,r)→(r,d) lands on an H orbit, bijectively. So the palette has 12
//      keys, and every Hxx is derived, never stored.
//
//   node meta/planet-coyleus/test/orbits-12.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { Seniority } from "coylean/core";
import { classifyVisualD4, getSectionData } from "../../../glyphs/glyph-core.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");

// Order 8 (256 cells/axis → 64 sections): past where the catalog closes, so the
// appearing-code set is the saturated alphabet (superglyphs scale-up: 35 / 12).
const ORDER_CELLS = 256;

let failures = 0;
function check(label, cond, detail = "") {
    console.log(
        `  ${cond ? "✓" : "✗"} ${label}${detail ? "  — " + detail : ""}`,
    );
    if (!cond) failures++;
}

// Map every glyph code "d,r" to its D4-orbit representative "d,r".
function buildOrbitIndex(seniority) {
    const classes = classifyVisualD4(seniority);
    const codeToRep = new Map();
    for (const cls of classes) {
        const rep = cls.rep.join(",");
        for (const [d, r] of cls.orbit) codeToRep.set(`${d},${r}`, rep);
    }
    return { classes, codeToRep };
}

// Distinct section codes appearing on the clean anchor map.
function anchorMapCodes(seniority) {
    const { codes, NSr, NSc } = getSectionData(
        ORDER_CELLS,
        ORDER_CELLS,
        seniority,
    );
    const set = new Set();
    for (let sr = 0; sr < NSr; sr++)
        for (let sc = 0; sc < NSc; sc++) {
            const [d, r] = codes[sr][sc];
            set.add(`${d},${r}`);
        }
    return set;
}

const V = buildOrbitIndex(Seniority.vertical());
const H = buildOrbitIndex(Seniority.horizontal());

console.log("planet-coyleus · 12-orbit foundation\n");

// ── 1. the anchor map closes on 35 codes / 12 orbits ──
const vCodes = anchorMapCodes(Seniority.vertical());
const vOrbits = new Set([...vCodes].map((c) => V.codeToRep.get(c)));
check("anchor map closes on 35 section codes", vCodes.size === 35, `${vCodes.size}`);
check("anchor map closes on 12 D4 orbits", vOrbits.size === 12, `${vOrbits.size}`);

// ── 2. the 12 letters in assignments.json are exactly those 12 orbits ──
const assignments = JSON.parse(
    readFileSync(join(REPO, "glyphs", "assignments.json"), "utf8"),
).assignments;

const lettered = Object.entries(assignments)
    .filter(([k]) => /^V[0-7][0-7]$/.test(k))
    .map(([k, v]) => ({
        letter: v.replace(/[^A-Za-z]/g, ""),
        d: +k[1],
        r: +k[2],
        rep: V.codeToRep.get(`${+k[1]},${+k[2]}`),
    }));

const letteredReps = new Set(lettered.map((x) => x.rep));
check("assignments.json names 12 V members", lettered.length === 12, `${lettered.length}`);
check("the 12 letters hit 12 distinct orbits", letteredReps.size === 12, `${letteredReps.size}`);
const sameSet =
    letteredReps.size === vOrbits.size &&
    [...letteredReps].every((rep) => vOrbits.has(rep));
check("lettered orbits == anchor-map orbits (bijective)", sameSet);

// ── 3. one orbit spans both grids: V orbit transposes to an H orbit ──
const hOrbitKeys = new Set(
    H.classes.map((c) =>
        c.orbit
            .map(([d, r]) => `${d},${r}`)
            .sort()
            .join("|"),
    ),
);
let dualOK = 0;
for (const rep of vOrbits) {
    const cls = V.classes.find((c) => c.rep.join(",") === rep);
    const transposed = cls.orbit
        .map(([d, r]) => `${r},${d}`)
        .sort()
        .join("|");
    if (hOrbitKeys.has(transposed)) dualOK++;
}
check(
    "each V orbit transposes to an H orbit (12 keys span both grids)",
    dualOK === 12,
    `${dualOK}/12`,
);

// ── reference dump ──
console.log("\n  12 orbits — letter · canonical V code · size · members:");
for (const x of [...lettered].sort((a, b) => a.letter.localeCompare(b.letter))) {
    const cls = V.classes.find((c) => c.rep.join(",") === x.rep);
    const members = cls.orbit.map(([d, r]) => `${d}${r}`).join(" ");
    console.log(
        `    ${x.letter}  V${x.d}${x.r}  size ${cls.orbitSize}  {${members}}`,
    );
}

console.log(
    failures
        ? `\n${failures} check(s) FAILED`
        : "\nall checks passed — palette is 12 orbit keys, Hxx derived ✓",
);
process.exit(failures ? 1 : 0);
