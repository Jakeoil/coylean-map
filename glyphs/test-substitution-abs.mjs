// Test 2: properly formulated abs-lattice substitution.
//
// At 1/1, the by-index test showed substitution is a function of parent code:
//   parent grid index (sr,sc) -> child grid indices (2sr+i, 2sc+j)
// In abs lattice coords this is:
//   parent abs (Pr,Pc) -> children abs (2Pr-1 + 4i, 2Pc-1 + 4j), i,j in {0,1}
// Verify this dilation formula at non-1/1 offsets, locating children by abs
// position rather than by grid index.
//
// ── Open follow-up to keep this test around for ──────────────────────────
// In the current working setup, the universe seam sits adjacent to the prime
// meridian (longitude 1 line) and the equator-like parallel (latitude 1 line):
// westExtent = northExtent = 1 in computeMapModel, so the integrated boundary
// is at lattice col/row 0, one cell W/N of the rendered map.
// At non-(1,1) offsets, abs-lattice substitution fails (this file, below).
// To rule out the "seam in the wrong place" explanation: re-run with the
// universe extended so the seam falls ON the meridian/parallel — i.e.
// westExtent = curHInit-1, northExtent = curVInit-1 (so the universe spans
// the entire region between the meridian/parallel and the SE patch). If that
// recovers substitution at non-(1,1) offsets, the failure was geometric, not
// algorithmic. Likely won't, but worth eliminating.
// ─────────────────────────────────────────────────────────────────────────

import { Seniority } from "coylean/core";
import { computeMapModel, setOffset } from "./glyph-core.js";

const SEC = 4;

function absPosOf(m, sr, sc, offH, offV) {
    const hEff = offH - 1, vEff = offV - 1;
    return [m.firstDarkRow + sr * SEC + 1 + vEff,
            m.firstDarkCol + sc * SEC + 1 + hEff];
}

function absCodeMap(m, offH, offV) {
    const map = new Map();
    for (let sr = 0; sr < m.NSr; sr++) {
        for (let sc = 0; sc < m.NSc; sc++) {
            const [ar, ac] = absPosOf(m, sr, sc, offH, offV);
            map.set(ar + "," + ac, m.secCodes[sr][sc]);
        }
    }
    return map;
}

// Canonical rule from 1/1: codeKey -> 4 child-codes at offsets (i,j) in {0,1}.
// We use the by-index pairing (proven consistent at 1/1) to populate it.
function buildRule(N) {
    setOffset(1, 1);
    const p = computeMapModel(N, N, { seniority: Seniority.vertical() });
    const c = computeMapModel(N * 2, N * 2, { seniority: Seniority.vertical() });
    const rule = new Map();
    const conflicts = [];
    for (let sr = 0; sr < p.NSr; sr++) {
        for (let sc = 0; sc < p.NSc; sc++) {
            const code = p.secCodes[sr][sc];
            const k = code[0] + "," + code[1];
            if (2 * sr + 1 >= c.NSr || 2 * sc + 1 >= c.NSc) continue;
            const ch = [
                c.secCodes[2 * sr][2 * sc],
                c.secCodes[2 * sr][2 * sc + 1],
                c.secCodes[2 * sr + 1][2 * sc],
                c.secCodes[2 * sr + 1][2 * sc + 1],
            ];
            const chK = ch.map(x => x[0] + "," + x[1]).join("|");
            if (rule.has(k)) {
                const prev = rule.get(k).map(x => x[0] + "," + x[1]).join("|");
                if (prev !== chK) conflicts.push({ k, prev, found: chK });
            } else {
                rule.set(k, ch);
            }
        }
    }
    setOffset(1, 1);
    return { rule, conflicts };
}

// Test at offset (offH, offV) using the abs-lattice dilation rule:
//   parent abs P -> children abs 2P-1 + 4*{i,j}
function testAt(N, offH, offV, rule) {
    setOffset(offH, offV);
    const p = computeMapModel(N, N, { seniority: Seniority.vertical() });
    const c = computeMapModel(N * 2, N * 2, { seniority: Seniority.vertical() });
    const childByAbs = absCodeMap(c, offH, offV);

    let checked = 0, ok = 0, fail = 0, missing = 0, unknown = 0;
    const failures = [];
    const missingDetails = [];
    for (let sr = 0; sr < p.NSr; sr++) {
        for (let sc = 0; sc < p.NSc; sc++) {
            const code = p.secCodes[sr][sc];
            const k = code[0] + "," + code[1];
            if (!rule.has(k)) { unknown++; continue; }
            const [Pr, Pc] = absPosOf(p, sr, sc, offH, offV);
            // Children at abs (2Pr-1 + 4i, 2Pc-1 + 4j)
            const cAbs = [
                [2 * Pr - 1,     2 * Pc - 1    ],
                [2 * Pr - 1,     2 * Pc - 1 + 4],
                [2 * Pr - 1 + 4, 2 * Pc - 1    ],
                [2 * Pr - 1 + 4, 2 * Pc - 1 + 4],
            ];
            const expected = rule.get(k);
            checked++;
            let allMatch = true, anyMissing = false;
            const detail = [];
            for (let i = 0; i < 4; i++) {
                const key = cAbs[i][0] + "," + cAbs[i][1];
                const got = childByAbs.get(key);
                if (!got) { anyMissing = true; detail.push(`miss@${key}`); continue; }
                const want = expected[i];
                if (got[0] !== want[0] || got[1] !== want[1]) {
                    allMatch = false;
                    detail.push(`@${key} got ${got} want ${want}`);
                }
            }
            if (anyMissing) { missing++; if (missingDetails.length < 2) missingDetails.push({sr,sc,k,detail}); }
            else if (allMatch) ok++;
            else { fail++; if (failures.length < 3) failures.push({ sr, sc, k, Pr, Pc, detail }); }
        }
    }
    console.log(
        `  offset ${offH}/${offV} N=${N}: checked=${checked}  ok=${ok}  fail=${fail}  missing=${missing}  unknown=${unknown}`
    );
    for (const f of failures) {
        console.log(`    parent[${f.sr},${f.sc}]=${f.k} @abs(${f.Pr},${f.Pc})  ${f.detail.slice(0,2).join("; ")}`);
    }
    for (const f of missingDetails) {
        console.log(`    (range) parent[${f.sr},${f.sc}]=${f.k}  ${f.detail.slice(0,2).join("; ")}`);
    }
    setOffset(1, 1);
    return { checked, ok, fail, missing, unknown };
}

console.log("=== Build canonical rule from 1/1 (N=32 -> 64) ===");
const { rule, conflicts } = buildRule(32);
console.log(`  rule covers ${rule.size} codes, ${conflicts.length} conflicts during build`);

console.log("\n=== Apply rule by ABS lattice dilation (P -> 2P-1 + 4·{0,1}) ===");
console.log("(if substitution is universal in abs lattice, all should be ok=checked)");
testAt(32, 1, 1, rule);  // self-check
testAt(32, 5, 3, rule);
testAt(32, 2, 2, rule);
testAt(32, 3, 5, rule);
testAt(32, 9, 7, rule);
testAt(32, 1, 3, rule);
testAt(32, 3, 1, rule);
testAt(32, 1, 5, rule);
testAt(32, 5, 1, rule);

console.log("\n=== Larger order, abs rule from 1/1 at N=64 -> 128 ===");
const { rule: rule64 } = buildRule(64);
console.log(`  rule covers ${rule64.size} codes`);
testAt(64, 1, 1, rule64);
testAt(64, 5, 3, rule64);
testAt(64, 2, 2, rule64);
