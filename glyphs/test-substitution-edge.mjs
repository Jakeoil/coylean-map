// Verify substitution at 0/1, 1/0, 0/0 (the offsets adjacent to / containing
// the 1/1 anchor). Same abs-lattice dilation rule as test-substitution-abs.mjs.

import { Seniority } from "../coylean-explorer/coylean-core.js";
import { computeMapModel, setOffset } from "./glyph-core.js";

const SEC = 4;

function absPosOf(m, sr, sc, offH, offV) {
    const hEff = offH - 1, vEff = offV - 1;
    return [m.firstDarkRow + sr * SEC + 1 + vEff,
            m.firstDarkCol + sc * SEC + 1 + hEff];
}
function absCodeMap(m, offH, offV) {
    const map = new Map();
    for (let sr = 0; sr < m.NSr; sr++)
        for (let sc = 0; sc < m.NSc; sc++) {
            const [ar, ac] = absPosOf(m, sr, sc, offH, offV);
            map.set(ar + "," + ac, m.secCodes[sr][sc]);
        }
    return map;
}
function buildRule(N) {
    setOffset(1, 1);
    const p = computeMapModel(N, N, { seniority: Seniority.vertical() });
    const c = computeMapModel(N * 2, N * 2, { seniority: Seniority.vertical() });
    const rule = new Map();
    for (let sr = 0; sr < p.NSr; sr++)
        for (let sc = 0; sc < p.NSc; sc++) {
            const code = p.secCodes[sr][sc];
            const k = code[0] + "," + code[1];
            if (2 * sr + 1 >= c.NSr || 2 * sc + 1 >= c.NSc) continue;
            if (!rule.has(k)) rule.set(k, [
                c.secCodes[2 * sr][2 * sc],
                c.secCodes[2 * sr][2 * sc + 1],
                c.secCodes[2 * sr + 1][2 * sc],
                c.secCodes[2 * sr + 1][2 * sc + 1],
            ]);
        }
    setOffset(1, 1);
    return rule;
}
function selfConsistency(N, offH, offV, label) {
    // Within a single offset: does parent code uniquely determine its 2x2?
    // Use grid-index children (parent[sr,sc] -> child[2sr+i, 2sc+j]).
    setOffset(offH, offV);
    const p = computeMapModel(N, N, { seniority: Seniority.vertical() });
    const c = computeMapModel(N * 2, N * 2, { seniority: Seniority.vertical() });
    const seen = new Map();
    let conflicts = 0;
    for (let sr = 0; sr < p.NSr; sr++)
        for (let sc = 0; sc < p.NSc; sc++) {
            if (2 * sr + 1 >= c.NSr || 2 * sc + 1 >= c.NSc) continue;
            const code = p.secCodes[sr][sc];
            const k = code[0] + "," + code[1];
            const ch = [
                c.secCodes[2 * sr][2 * sc],
                c.secCodes[2 * sr][2 * sc + 1],
                c.secCodes[2 * sr + 1][2 * sc],
                c.secCodes[2 * sr + 1][2 * sc + 1],
            ].map(x => x[0] + "," + x[1]).join("|");
            if (seen.has(k) && seen.get(k) !== ch) conflicts++;
            else seen.set(k, ch);
        }
    console.log(`  self ${label} (${offH}/${offV}) N=${N}: ${seen.size} codes, ${conflicts} conflicts`);
    setOffset(1, 1);
    return { codes: seen.size, conflicts };
}

function testAbsAt(N, offH, offV, rule, label) {
    setOffset(offH, offV);
    const p = computeMapModel(N, N, { seniority: Seniority.vertical() });
    const c = computeMapModel(N * 2, N * 2, { seniority: Seniority.vertical() });
    const childByAbs = absCodeMap(c, offH, offV);
    let checked = 0, ok = 0, fail = 0, missing = 0, unknown = 0;
    for (let sr = 0; sr < p.NSr; sr++)
        for (let sc = 0; sc < p.NSc; sc++) {
            const code = p.secCodes[sr][sc];
            const k = code[0] + "," + code[1];
            if (!rule.has(k)) { unknown++; continue; }
            const [Pr, Pc] = absPosOf(p, sr, sc, offH, offV);
            const cAbs = [
                [2 * Pr - 1,     2 * Pc - 1    ],
                [2 * Pr - 1,     2 * Pc - 1 + 4],
                [2 * Pr - 1 + 4, 2 * Pc - 1    ],
                [2 * Pr - 1 + 4, 2 * Pc - 1 + 4],
            ];
            const expected = rule.get(k);
            checked++;
            let allMatch = true, anyMissing = false;
            for (let i = 0; i < 4; i++) {
                const key = cAbs[i][0] + "," + cAbs[i][1];
                const got = childByAbs.get(key);
                if (!got) { anyMissing = true; continue; }
                if (got[0] !== expected[i][0] || got[1] !== expected[i][1])
                    allMatch = false;
            }
            if (anyMissing) missing++;
            else if (allMatch) ok++;
            else fail++;
        }
    console.log(
        `  abs  ${label} (${offH}/${offV}) N=${N}: checked=${checked}  ok=${ok}  fail=${fail}  missing=${missing}  unknown=${unknown}`
    );
    setOffset(1, 1);
    return { checked, ok, fail, missing, unknown };
}

console.log("=== Build canonical rule from 1/1 (N=32 -> 64) ===");
const rule32 = buildRule(32);
const rule64 = buildRule(64);
console.log(`  rule32: ${rule32.size} codes; rule64: ${rule64.size} codes`);

console.log("\n=== Edge offsets ===");
for (const [h, v, label] of [
    [0, 0, "0/0"],
    [0, 1, "0/1"],
    [1, 0, "1/0"],
    [1, 1, "1/1"],
    [1, 2, "1/2"],
    [2, 1, "2/1"],
    [0, 2, "0/2"],
    [2, 0, "2/0"],
]) {
    selfConsistency(32, h, v, label);
    selfConsistency(64, h, v, label);
    testAbsAt(32, h, v, rule32, label);
    testAbsAt(64, h, v, rule64, label);
    console.log();
}
