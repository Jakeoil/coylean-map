// Follow-up: (a) verify the cage interiors are at 010 priority alignment for
// every test offset; (b) recompute the parent→child mapping by ABSOLUTE
// lattice position (not by grid index), in case substitution is universal but
// needs an offset-dependent index shift.
//
// 010 check: cage interior cells (k, k+1, k+2) under offset (h, v) should have
// priorities (low, high, low) with the middle having strictly greater 2-adic
// valuation than both neighbours.

import { Seniority, Propagation } from "../coylean-explorer/coylean-core.js";
import { computeMapModel, setOffset } from "./glyph-core.js";

const SEC = 4;

// 2-adic valuation of n (n > 0). Returns Infinity for n === 0 — Propagation's
// priority convention.
function pri(n) {
    if (n === 0) return Infinity;
    let v = 0;
    let m = n;
    while ((m & 1) === 0) {
        v++;
        m >>= 1;
    }
    return v;
}

// Inspect cage alignment for the parent grid produced by computeMapModel at a
// given offset. cage[sr,sc] interior cells (in the matrix) live at columns
// firstDarkCol + sc*SEC + (1..3) and rows firstDarkRow + sr*SEC + (1..3).
// Convert to ABSOLUTE lattice column = matrixCol + hInitColEff. Check that the
// middle has strictly greater pri than its two neighbours (the "010" senior
// pattern).
function checkAlignment(label, offH, offV) {
    setOffset(offH, offV);
    const N = 32;
    const m = computeMapModel(N, N, { seniority: Seniority.vertical() });
    const hEff = offH - 1, vEff = offV - 1;
    const samples = [];
    for (let sr = 0; sr < Math.min(m.NSr, 2); sr++) {
        for (let sc = 0; sc < Math.min(m.NSc, 2); sc++) {
            const interiorAbsCol0 = m.firstDarkCol + sc * SEC + 1 + hEff;
            const interiorAbsRow0 = m.firstDarkRow + sr * SEC + 1 + vEff;
            const cP = [
                pri(interiorAbsCol0),
                pri(interiorAbsCol0 + 1),
                pri(interiorAbsCol0 + 2),
            ];
            const rP = [
                pri(interiorAbsRow0),
                pri(interiorAbsRow0 + 1),
                pri(interiorAbsRow0 + 2),
            ];
            const colOk = cP[1] > cP[0] && cP[1] > cP[2];
            const rowOk = rP[1] > rP[0] && rP[1] > rP[2];
            samples.push({ sr, sc, col: cP, row: rP, colOk, rowOk });
        }
    }
    console.log(`  ${label}  offset (${offH},${offV})  firstDark=(${m.firstDarkRow},${m.firstDarkCol})`);
    for (const s of samples) {
        console.log(
            `    cage[${s.sr},${s.sc}]  colPri=[${s.col.map(p=>p===Infinity?"∞":p).join(",")}]  rowPri=[${s.row.map(p=>p===Infinity?"∞":p).join(",")}]  ${s.colOk && s.rowOk ? "010 ✓" : "✗"}`
        );
    }
    setOffset(1, 1);
}

console.log("=== Cage 010 alignment at each offset ===");
checkAlignment("1/1", 1, 1);
checkAlignment("5/3", 5, 3);
checkAlignment("2/2", 2, 2);
checkAlignment("3/5", 3, 5);
checkAlignment("9/7", 9, 7);

// ---- Universal substitution by absolute lattice position ----
//
// If substitution is a property of absolute lattice position (not of grid
// index), then parent cage at abs (Pr, Pc) should determine children at the
// SAME absolute positions as the canonical 1/1 rule gives. Find the child
// indices in the (offset-N) child grid that correspond to those absolute
// positions, and check consistency that way.

function absPosOf(m, sr, sc, offH, offV) {
    const hEff = offH - 1, vEff = offV - 1;
    return [m.firstDarkRow + sr * SEC + 1 + vEff,
            m.firstDarkCol + sc * SEC + 1 + hEff];
}

// Build a code lookup keyed by ABS lattice (interior-NW corner of each cage).
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

// 1/1 parent at abs (P) → children at 1/1 abs:
// (2P-1+(corner)) — derive empirically by reading the 1/1 substitution from
// data at offset 1/1 and order N/2N, then re-apply by absolute lookup at the
// test offset.
function buildOneByOneSubstitution(N) {
    setOffset(1, 1);
    const p = computeMapModel(N, N, { seniority: Seniority.vertical() });
    const c = computeMapModel(N * 2, N * 2, { seniority: Seniority.vertical() });
    // Canonical 1/1 substitution: parent[sr,sc] -> child[2sr..2sr+1, 2sc..2sc+1]
    // Express as abs-lattice rule: parent at abs (Pr, Pc) -> children at abs
    // positions derived from child[2sr+i, 2sc+j].
    const rule = new Map(); // codeKey -> [4 child codes as abs offsets relative to parent]
    for (let sr = 0; sr < p.NSr; sr++) {
        for (let sc = 0; sc < p.NSc; sc++) {
            const code = p.secCodes[sr][sc];
            const k = code[0] + "," + code[1];
            const [Pr, Pc] = absPosOf(p, sr, sc, 1, 1);
            if (rule.has(k)) continue;
            const childAt = (i, j) => {
                const csr = 2 * sr + i, csc = 2 * sc + j;
                if (csr >= c.NSr || csc >= c.NSc) return null;
                const [Cr, Cc] = absPosOf(c, csr, csc, 1, 1);
                return { dRow: Cr - Pr, dCol: Cc - Pc, code: c.secCodes[csr][csc] };
            };
            const ch = [childAt(0, 0), childAt(0, 1), childAt(1, 0), childAt(1, 1)];
            if (ch.some(x => x === null)) continue;
            rule.set(k, ch);
        }
    }
    setOffset(1, 1);
    return rule;
}

function testAbsRuleAt(N, offH, offV, rule) {
    setOffset(offH, offV);
    const p = computeMapModel(N, N, { seniority: Seniority.vertical() });
    const c = computeMapModel(N * 2, N * 2, { seniority: Seniority.vertical() });
    const childByAbs = absCodeMap(c, offH, offV);
    let checked = 0, ok = 0, fail = 0, missing = 0;
    const failures = [];
    for (let sr = 0; sr < p.NSr; sr++) {
        for (let sc = 0; sc < p.NSc; sc++) {
            const code = p.secCodes[sr][sc];
            const k = code[0] + "," + code[1];
            if (!rule.has(k)) continue; // code not in canonical rule
            const [Pr, Pc] = absPosOf(p, sr, sc, offH, offV);
            const expected = rule.get(k);
            checked++;
            let allMatch = true, anyMissing = false;
            const detail = [];
            for (const e of expected) {
                const key = (Pr + e.dRow) + "," + (Pc + e.dCol);
                const got = childByAbs.get(key);
                if (!got) { anyMissing = true; detail.push(`miss@${key}`); continue; }
                if (got[0] !== e.code[0] || got[1] !== e.code[1]) {
                    allMatch = false;
                    detail.push(`@${key} got ${got} want ${e.code}`);
                }
            }
            if (anyMissing) missing++;
            else if (allMatch) ok++;
            else { fail++; if (failures.length < 3) failures.push({ sr, sc, k, detail }); }
        }
    }
    console.log(
        `  offset ${offH}/${offV} order ${N}->${2*N}: checked=${checked}  ok=${ok}  fail=${fail}  missing=${missing}`
    );
    for (const f of failures) {
        console.log(`    parent[${f.sr},${f.sc}]=${f.k}  ${f.detail.slice(0,2).join("; ")}`);
    }
    setOffset(1, 1);
    return { checked, ok, fail, missing };
}

console.log("\n=== Universal absolute-position substitution test ===");
console.log("(canonical rule learned from 1/1 @ order 32->64, applied by abs lattice position to other offsets)");
const rule = buildOneByOneSubstitution(32);
console.log(`  canonical rule covers ${rule.size} codes`);

testAbsRuleAt(32, 1, 1, rule);
testAbsRuleAt(32, 5, 3, rule);
testAbsRuleAt(32, 2, 2, rule);
testAbsRuleAt(32, 3, 5, rule);
testAbsRuleAt(32, 9, 7, rule);
testAbsRuleAt(32, 1, 3, rule);
testAbsRuleAt(32, 3, 1, rule);
