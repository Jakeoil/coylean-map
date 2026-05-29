// Ad-hoc verification: does V→V 2x2 substitution hold (a) across orders,
// (b) at the standard 1/1 offset, (c) at other dyadic offsets?
//
// Strategy: at a given offset/order, scan the map's section codes (secCodes
// from computeMapModel). For each parent section code in the order-n grid,
// collect ALL occurrences of its 2x2 child block in the order-(n+1) grid.
// If every occurrence of the same parent code produces the same 2x2 children,
// the substitution rule is well-defined (a function of the parent code).

import { Seniority } from "../coylean-explorer/coylean-core.js";
import { computeMapModel, setOffset } from "./glyph-core.js";

function key(code) {
    return code[0] + "," + code[1];
}

// Build a section table at a given V order N (sections are N/4 x N/4)
// using computeMapModel with the current offsets (setOffset).
function sectionTable(N) {
    return computeMapModel(N, N, { seniority: Seniority.vertical() });
}

// Check if parent (order n) -> child (order n+1) 2x2 expansion is a function
// of the parent code at the given offset. Returns { ok, codeCount, conflicts }
function verifyOrder(parentN, label) {
    const p = sectionTable(parentN);
    const c = sectionTable(parentN * 2);
    // Use the intersected region (both grids must have data there).
    const NSrP = Math.min(p.NSr, Math.floor(c.NSr / 2));
    const NScP = Math.min(p.NSc, Math.floor(c.NSc / 2));

    const map = new Map(); // parentKey -> "v00,v01;v10,v11"
    const conflicts = [];
    for (let sr = 0; sr < NSrP; sr++) {
        for (let sc = 0; sc < NScP; sc++) {
            const pk = key(p.secCodes[sr][sc]);
            const ck =
                key(c.secCodes[2 * sr][2 * sc]) + "|" +
                key(c.secCodes[2 * sr][2 * sc + 1]) + "|" +
                key(c.secCodes[2 * sr + 1][2 * sc]) + "|" +
                key(c.secCodes[2 * sr + 1][2 * sc + 1]);
            if (map.has(pk)) {
                if (map.get(pk) !== ck) {
                    conflicts.push({ pk, expected: map.get(pk), found: ck, at: [sr, sc] });
                }
            } else {
                map.set(pk, ck);
            }
        }
    }
    console.log(
        `  ${label}: ${parentN}->${2*parentN}, region ${NSrP}x${NScP} sections, ` +
        `${map.size} distinct codes, ${conflicts.length} conflicts`
    );
    if (conflicts.length > 0) {
        for (const k of conflicts.slice(0, 3)) {
            console.log(`    parent=${k.pk} at sec[${k.at}]`);
            console.log(`      expected ${k.expected}`);
            console.log(`      found    ${k.found}`);
        }
    }
    return { ok: conflicts.length === 0, codeCount: map.size, conflicts };
}

// Compare the substitution dictionaries at two offsets:
// is the rule (parent code -> children codes) the SAME at both offsets?
function compareOffsets(parentN, offA, offB) {
    setOffset(offA[0], offA[1]);
    const a = sectionTable(parentN), aC = sectionTable(parentN * 2);
    const mapA = new Map();
    for (let sr = 0; sr < Math.min(a.NSr, Math.floor(aC.NSr/2)); sr++) {
        for (let sc = 0; sc < Math.min(a.NSc, Math.floor(aC.NSc/2)); sc++) {
            const pk = key(a.secCodes[sr][sc]);
            const ck =
                key(aC.secCodes[2 * sr][2 * sc]) + "|" +
                key(aC.secCodes[2 * sr][2 * sc + 1]) + "|" +
                key(aC.secCodes[2 * sr + 1][2 * sc]) + "|" +
                key(aC.secCodes[2 * sr + 1][2 * sc + 1]);
            if (!mapA.has(pk)) mapA.set(pk, ck);
        }
    }

    setOffset(offB[0], offB[1]);
    const b = sectionTable(parentN), bC = sectionTable(parentN * 2);
    const mapB = new Map();
    for (let sr = 0; sr < Math.min(b.NSr, Math.floor(bC.NSr/2)); sr++) {
        for (let sc = 0; sc < Math.min(b.NSc, Math.floor(bC.NSc/2)); sc++) {
            const pk = key(b.secCodes[sr][sc]);
            const ck =
                key(bC.secCodes[2 * sr][2 * sc]) + "|" +
                key(bC.secCodes[2 * sr][2 * sc + 1]) + "|" +
                key(bC.secCodes[2 * sr + 1][2 * sc]) + "|" +
                key(bC.secCodes[2 * sr + 1][2 * sc + 1]);
            if (!mapB.has(pk)) mapB.set(pk, ck);
        }
    }

    setOffset(1, 1); // restore

    const onlyA = [], onlyB = [], disagree = [];
    for (const [k, v] of mapA) {
        if (!mapB.has(k)) onlyA.push(k);
        else if (mapB.get(k) !== v) disagree.push({ k, a: v, b: mapB.get(k) });
    }
    for (const k of mapB.keys()) if (!mapA.has(k)) onlyB.push(k);

    console.log(
        `  offsets ${offA[0]}/${offA[1]} vs ${offB[0]}/${offB[1]} @ order ${parentN}: ` +
        `|A|=${mapA.size}, |B|=${mapB.size}, only-A=${onlyA.length}, only-B=${onlyB.length}, ` +
        `disagree=${disagree.length}`
    );
    if (disagree.length > 0) {
        for (const d of disagree.slice(0, 3)) {
            console.log(`    parent=${d.k}`);
            console.log(`      A: ${d.a}`);
            console.log(`      B: ${d.b}`);
        }
    }
    return { onlyA, onlyB, disagree };
}

console.log("=== (1) Substitution as a function of parent code, at offset 1/1 ===");
setOffset(1, 1);
verifyOrder(8,  "8 -> 16 ");
verifyOrder(16, "16 -> 32");
verifyOrder(32, "32 -> 64");
verifyOrder(64, "64 -> 128");

console.log("\n=== (2) Same, at offset 5/3 ===");
setOffset(5, 3);
verifyOrder(8,  "8 -> 16 ");
verifyOrder(16, "16 -> 32");
verifyOrder(32, "32 -> 64");
verifyOrder(64, "64 -> 128");
setOffset(1, 1);

console.log("\n=== (3) Same, at offset 2/2 (an even, non-clean point) ===");
setOffset(2, 2);
verifyOrder(16, "16 -> 32");
verifyOrder(32, "32 -> 64");
setOffset(1, 1);

console.log("\n=== (4) Does the substitution table DEPEND on offset? ===");
compareOffsets(32, [1, 1], [5, 3]);
compareOffsets(32, [1, 1], [2, 2]);
compareOffsets(32, [1, 1], [3, 5]);
compareOffsets(32, [1, 1], [9, 7]);
