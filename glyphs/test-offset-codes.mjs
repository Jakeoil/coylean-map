// Verify Jake's method: at longitude 2 the OFFSET map shows section codes that
// the clean (1/1) map never produces. For each such new code, read its order
// n -> n+1 expansion (4 children + 4 internal separators) straight from the
// map, and check the expansion is consistent across every occurrence.

import { Seniority } from "coylean/core";
import {
    getSectionData,
    computeMapModel,
    setOffset,
    classifyVisualD4,
} from "./glyph-core.js";

const SEC = 4;
const V = Seniority.vertical();

// canonical-reachable codes (the 35) from the clean map.
function canonicalCodes() {
    const set = new Set();
    for (const N of [32, 64, 128]) {
        const sd = getSectionData(N, N, V);
        for (let sr = 0; sr < sd.NSr; sr++)
            for (let sc = 0; sc < sd.NSc; sc++)
                set.add(sd.codes[sr][sc].join(","));
    }
    return set;
}

// Partition a model's matrices into ns x ns sections (mirror of
// sectionsFromPropagation in substitution.mjs).
function sectionize(model, ns) {
    const { downMatrix, rightMatrix } = model;
    const originRow = model.firstDarkRow + 1;
    const originCol = model.firstDarkCol + 1;
    const grid = Array.from({ length: ns }, () =>
        Array.from({ length: ns }, () => [0, 0]));
    const vBound = Array.from({ length: ns }, () => Array(ns).fill(false));
    const hBound = Array.from({ length: ns }, () => Array(ns).fill(false));
    for (let sr = 0; sr < ns; sr++)
        for (let sc = 0; sc < ns; sc++) {
            const y0 = originRow + sr * SEC, x0 = originCol + sc * SEC;
            for (let i = 0; i < 3; i++) {
                const dRow = downMatrix[y0];
                if (dRow && dRow[x0 + i]) grid[sr][sc][0] |= 1 << i;
                const rCol = rightMatrix[x0];
                if (rCol && rCol[y0 + i]) grid[sr][sc][1] |= 1 << i;
            }
            const xExit = x0 + SEC - 1;
            for (let i = 0; i < SEC; i++) {
                const row = downMatrix[y0 + i];
                if (row && row[xExit]) { vBound[sr][sc] = true; break; }
            }
            const yExit = y0 + SEC - 1;
            for (let i = 0; i < SEC; i++) {
                const col = rightMatrix[x0 + i];
                if (col && col[yExit]) { hBound[sr][sc] = true; break; }
            }
        }
    return { grid, vBound, hBound };
}

function expansionKey(child, vBound, hBound, r2, c2) {
    return (
        [child[r2][c2], child[r2][c2 + 1], child[r2 + 1][c2], child[r2 + 1][c2 + 1]]
            .map((p) => p.join(",")).join("|") +
        " b:" +
        [vBound[r2][c2], vBound[r2 + 1][c2], hBound[r2][c2], hBound[r2][c2 + 1]]
            .map((x) => (x ? 1 : 0)).join("")
    );
}

const canon = canonicalCodes();

// Sweep several offsets, collect new codes + their expansions.
const offsets = [[2, 1], [1, 2], [2, 2], [3, 1], [1, 3], [2, 3], [3, 2], [3, 3], [4, 1], [5, 3]];
const found = new Map(); // code -> Map(expansionKey -> count)

for (const [h, v] of offsets) {
    setOffset(h, v);
    const pN = 32, cN = 64;
    const pModel = computeMapModel(pN, pN, { seniority: V });
    const cModel = computeMapModel(cN, cN, { seniority: V });
    const pns = Math.min(pModel.NSr, pModel.NSc);
    const cns = Math.min(cModel.NSr, cModel.NSc);
    const p = sectionize(pModel, pns);
    const c = sectionize(cModel, cns);
    const maxSr = Math.min(pns, Math.floor(cns / 2));
    const maxSc = maxSr;
    for (let sr = 0; sr < maxSr; sr++)
        for (let sc = 0; sc < maxSc; sc++) {
            const code = p.grid[sr][sc].join(",");
            if (canon.has(code)) continue;
            const ek = expansionKey(c.grid, c.vBound, c.hBound, sr * 2, sc * 2);
            if (!found.has(code)) found.set(code, new Map());
            const m = found.get(code);
            m.set(ek, (m.get(ek) || 0) + 1);
        }
}
setOffset(1, 1);

// Report.
const newCodes = [...found.keys()].sort();
console.log(`New (non-canonical) codes seen across offsets: ${newCodes.length}/29`);
let multi = 0;
for (const code of newCodes) {
    const m = found.get(code);
    const flag = m.size > 1 ? `  *** ${m.size} distinct expansions ***` : "";
    if (m.size > 1) multi++;
    console.log(`  ${code}${flag}`);
    if (m.size > 1)
        for (const [ek, n] of m) console.log(`      (${n}x) ${ek}`);
}
console.log(`\nmulti-valued codes: ${multi}`);

// Coverage after D4 closure: which missing orbits get >=1 member.
const classesV = classifyVisualD4(V);
const missingOrbits = classesV.filter(
    (cls) => !cls.orbit.some(([d, r]) => canon.has(d + "," + r)));
let codesAfterD4 = 0, orbitsUnlocked = 0;
const stillMissing = [];
for (const cls of missingOrbits) {
    if (cls.orbit.some(([d, r]) => found.has(d + "," + r))) {
        orbitsUnlocked++; codesAfterD4 += cls.orbit.length;
    } else stillMissing.push(cls);
}
console.log(`\nmissing orbits unlocked by offset sweep: ${orbitsUnlocked}/${missingOrbits.length}`);
console.log(`V coverage after D4 closure: 35 -> ${35 + codesAfterD4}/64`);
console.log(`still-missing orbits:`);
for (const cls of stillMissing)
    console.log("   ", cls.orbit.map(([d, r]) => `${d},${r}`).join("  "));
