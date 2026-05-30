// Phase 2 verification: at offset lat/long = 1/2 (latitude 1, longitude 2),
// build the (self,N,W) tromino table from the offset map, expand the order-5
// seed with it, and compare to the order-6 truth. Expect ~0 interior
// divergence (vs ~182/256 with the 6-bit code table).

import { Seniority } from "../coylean-explorer/coylean-core.js";
import { computeMapModel, setOffset } from "./glyph-core.js";

const SEC = 4, V = Seniority.vertical();
const LONG = 2, LAT = 1; // lat/long = 1/2  → setOffset(h=long, v=lat)

function sectionize(model, ns) {
    const { downMatrix, rightMatrix } = model;
    const oR = model.firstDarkRow + 1, oC = model.firstDarkCol + 1;
    const grid = Array.from({ length: ns }, () =>
        Array.from({ length: ns }, () => [0, 0]));
    const vB = Array.from({ length: ns }, () => Array(ns).fill(false));
    const hB = Array.from({ length: ns }, () => Array(ns).fill(false));
    const dAt = (M, y, x) => (M[y] && M[y][x] ? 1 : 0);
    for (let sr = 0; sr < ns; sr++)
        for (let sc = 0; sc < ns; sc++) {
            const y0 = oR + sr * SEC, x0 = oC + sc * SEC;
            for (let i = 0; i < 3; i++) {
                if (dAt(downMatrix, y0, x0 + i)) grid[sr][sc][0] |= 1 << i;
                if (dAt(rightMatrix, x0, y0 + i)) grid[sr][sc][1] |= 1 << i;
            }
            const xE = x0 + SEC - 1;
            for (let i = 0; i < SEC; i++)
                if (dAt(downMatrix, y0 + i, xE)) { vB[sr][sc] = true; break; }
            const yE = y0 + SEC - 1;
            for (let i = 0; i < SEC; i++)
                if (dAt(rightMatrix, x0 + i, yE)) { hB[sr][sc] = true; break; }
        }
    return { grid, vBound: vB, hBound: hB };
}

setOffset(LONG, LAT);
// Build tromino table from order 64 -> 128.
const pM = computeMapModel(64, 64, { seniority: V });
const cM = computeMapModel(128, 128, { seniority: V });
const pns = Math.min(pM.NSr, pM.NSc), cns = Math.min(cM.NSr, cM.NSc);
const p = sectionize(pM, pns), c = sectionize(cM, cns);
const trom = new Map();
const codeKey = (g, sr, sc) =>
    sr < 0 || sc < 0 || sr >= g.length || sc >= g.length
        ? "x" : g[sr][sc].join(",");
const lim = Math.min(pns, Math.floor(cns / 2));
for (let sr = 1; sr < lim - 1; sr++)
    for (let sc = 1; sc < lim - 1; sc++) {
        const key = codeKey(p.grid, sr, sc) + ";" +
            codeKey(p.grid, sr - 1, sc) + ";" + codeKey(p.grid, sr, sc - 1);
        if (trom.has(key)) continue;
        const a = sr * 2, b = sc * 2;
        trom.set(key, [
            c.grid[a][b].join(","), c.grid[a][b + 1].join(","),
            c.grid[a + 1][b].join(","), c.grid[a + 1][b + 1].join(","),
        ].join("|"));
    }
console.log(`tromino table (built @1/2 from 64→128): ${trom.size} keys`);

// Now expand the order-5 seed (32) and compare to order-6 truth (64).
const seedM = computeMapModel(32, 32, { seniority: V });
const truthM = computeMapModel(64, 64, { seniority: V });
setOffset(1, 1);
const sns = Math.min(seedM.NSr, seedM.NSc);
const tns = Math.min(truthM.NSr, truthM.NSc);
const seed = sectionize(seedM, sns);
const truth = sectionize(truthM, tns);

const elim = Math.min(sns, Math.floor(tns / 2));
let covered = 0, coveredMatch = 0, uncovered = 0, total = 0;
for (let sr = 0; sr < elim; sr++)
    for (let sc = 0; sc < elim; sc++) {
        const key = codeKey(seed.grid, sr, sc) + ";" +
            codeKey(seed.grid, sr - 1, sc) + ";" + codeKey(seed.grid, sr, sc - 1);
        const a = sr * 2, b = sc * 2;
        const truthCk = [
            truth.grid[a][b].join(","), truth.grid[a][b + 1].join(","),
            truth.grid[a + 1][b].join(","), truth.grid[a + 1][b + 1].join(","),
        ].join("|");
        total++;
        if (trom.has(key)) {
            covered++;
            if (trom.get(key) === truthCk) coveredMatch++;
        } else uncovered++;
    }
console.log(`\nexpand order-5 seed → compare to order-6 truth (region ${elim}×${elim} = ${total} cells):`);
console.log(`  covered by tromino: ${covered}  (matching truth: ${coveredMatch})`);
console.log(`  uncovered (edge / no N,W context, falls back): ${uncovered}`);
console.log(covered === coveredMatch
    ? "  ✓ every tromino-covered cell matches truth — fixed point on the interior"
    : `  ✗ ${covered - coveredMatch} covered cells mispredict`);
