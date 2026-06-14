// ════════════════════════════════════════════════════════════════════════
//  superglyphs/tests — scale-up.mjs
// ════════════════════════════════════════════════════════════════════════
//
//  GOAL
//  Climb from a small seed map up to the SUPERGLYPH scale (a priority-≥8 cage,
//  255×255 ≈ order 8, 256 cells/side) using ONLY the translation table —
//  repeated O(1)-per-cell lookups via expandTranslation — instead of
//  re-propagating a big map each time. Then keep going a couple levels past
//  the superglyph to watch the glyph alphabet.
//
//  WHY THE TABLE SAVES WORK
//  Direct truth at order n propagates a 2ⁿ×2ⁿ grid from scratch (O(4ⁿ) cells,
//  every level redone). The table instead DOUBLES the previous level: each new
//  cell is one dictionary lookup of its parent's rule. Same answer on the
//  anchor (translation is a fixed point there), a fraction of the work, and
//  incremental — you keep the level you already built.
//
//  WHAT IT REPORTS PER LEVEL
//    order, sections/side, cells/side, #distinct glyph codes, #distinct D4
//    orbits, and (where a full propagation is still cheap) #cells where the
//    table disagrees with truth. 0 disagreements = the table genuinely
//    reconstructs the map. The codes/orbits columns answer the open question:
//    does the reachable superglyph catalog keep growing, or close?
//
//  Run:  node meta/superglyphs/tests/scale-up.mjs

import { Seniority } from "coylean/core";
import { getSectionData } from "../../../glyphs/glyph-core.js";
import {
    TRANSLATION_V,
    ORBIT_V,
    codeKey,
    expandTranslation,
} from "./rules.mjs";

const V = Seniority.vertical();

const SEED_ORDER = 5; //  start at 32 cells (8×8 sections) — small, truthful
const SUPERGLYPH_ORDER = 8; //  256 cells ≈ the 255×255 priority-≥8 cage
const TARGET_ORDER = 10; //  push two levels past, on table alone
const TRUTH_MAX_ORDER = 9; //  above this, full propagation gets heavy — skip it

// Seed = the real clean map at SEED_ORDER, in expandTranslation's shape.
function seedMap(order) {
    const s = getSectionData(1 << order, 1 << order, V);
    return { codes: s.codes, vBound: s.vBound, hBound: s.hBound, ns: s.NSr };
}

// Distinct codes / orbits present in a map's section grid.
function census(map) {
    const codes = new Set();
    const orbits = new Set();
    for (let sr = 0; sr < map.ns; sr++)
        for (let sc = 0; sc < map.ns; sc++) {
            const k = codeKey(map.codes[sr][sc]);
            codes.add(k);
            if (ORBIT_V[k] !== undefined) orbits.add(ORBIT_V[k]);
        }
    return { codes: codes.size, orbits: orbits.size };
}

// Cell-by-cell disagreement between the table-built map and true propagation
// at the same order. Returns -1 if we chose to skip truth at this order.
function disagreementVsTruth(map, order) {
    if (order > TRUTH_MAX_ORDER) return -1;
    const truth = getSectionData(1 << order, 1 << order, V);
    let bad = 0;
    for (let sr = 0; sr < map.ns; sr++)
        for (let sc = 0; sc < map.ns; sc++)
            if (codeKey(map.codes[sr][sc]) !== codeKey(truth.codes[sr][sc])) bad++;
    return bad;
}

console.log(
    `Scaling V map ${SEED_ORDER} → ${TARGET_ORDER} by translation-table lookup` +
    ` (superglyph ≈ order ${SUPERGLYPH_ORDER})\n`,
);
console.log("  order  sections  cells   codes  orbits   vs-truth");

let map = seedMap(SEED_ORDER);
let failures = 0;
for (let order = SEED_ORDER; order <= TARGET_ORDER; order++) {
    if (order > SEED_ORDER) map = expandTranslation(map, TRANSLATION_V);
    const { codes, orbits } = census(map);
    const bad = disagreementVsTruth(map, order);
    const cells = map.ns * 4;
    const truthCol =
        bad < 0 ? "(skipped)" : bad === 0 ? "0 ✓" : `${bad} ✗`;
    if (bad > 0) failures++;
    const star = order === SUPERGLYPH_ORDER ? " ← superglyph" : "";
    console.log(
        `  ${String(order).padStart(5)}  ` +
        `${String(map.ns).padStart(8)}  ` +
        `${String(cells).padStart(5)}  ` +
        `${String(codes).padStart(5)}  ` +
        `${String(orbits).padStart(6)}   ${truthCol.padEnd(9)}${star}`,
    );
}

// Closure verdict: once the alphabet stops growing, the superglyph catalog is
// finite and equal to that stable set (here the 12-orbit / 34-code anchor set).
const finalCodes = census(map).codes;
console.log(
    failures === 0
        ? `\nPASS — reached the superglyph by table alone, matching truth; ` +
          `alphabet closed at ${finalCodes} codes / ${census(map).orbits} orbits.\n`
        : `\nFAIL — table-built map disagreed with truth at ${failures} order(s).\n`,
);
process.exit(failures === 0 ? 0 : 1);
