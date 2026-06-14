// planet-coyleus — V/H ladder rung coverage.
//
// The zoomable quadrant map walks the V/H ladder by zoom: V_n (2ⁿ×2ⁿ square) →
// H_n (2ⁿ×2ⁿ⁺¹ WIDE, the sideways v→h intermediate) → V_{n+1} … This checks the
// engine side before any canvas: at all four quadrant anchors, every rung — V
// squares AND the wide H intermediates — is on-anchor, i.e. every section
// resolves to one of the 12 palette orbits (nothing unpaintable). It also
// confirms the H rungs double the section COLUMNS (the substitution split).
//
//   node meta/planet-coyleus/test/ladder.mjs

import { Seniority } from "coylean/core";
import { setOffset, computeMapModel } from "coylean/glyphs";
import { paintCell } from "../terrain-core.js";

let failures = 0;
const check = (label, cond, detail = "") => {
    console.log(`  ${cond ? "✓" : "✗"} ${label}${detail ? "  — " + detail : ""}`);
    if (!cond) failures++;
};

const QUADS = [
    [0, 0, "NW"],
    [1, 0, "NE"],
    [0, 1, "SW"],
    [1, 1, "SE"],
];
const ORDERS = [5, 6, 7, 8];

// Build a rung's section grid at a quadrant anchor. V_n is 2ⁿ×2ⁿ; H_n is the
// wide intermediate 2ⁿ rows × 2ⁿ⁺¹ cols (v→h doubles columns).
function rung(order, seniorityH, h, v) {
    setOffset(h, v);
    const Nr = 1 << order;
    const Nc = seniorityH ? 1 << (order + 1) : 1 << order;
    const m = computeMapModel(Nr, Nc, {
        seniority: seniorityH ? Seniority.horizontal() : Seniority.vertical(),
    });
    return m;
}

console.log("planet-coyleus · V/H ladder rungs\n");

for (const order of ORDERS) {
    for (const senH of [false, true]) {
        const name = order + (senH ? "h" : "");
        let worstBad = 0;
        let dims = "";
        const orbitTotals = [];
        for (const [h, v, q] of QUADS) {
            const m = rung(order, senH, h, v);
            dims = `${m.NSr}×${m.NSc} sec`;
            const grid = senH ? "H" : "V";
            const letters = new Set();
            let bad = 0;
            for (let sr = 0; sr < m.NSr; sr++)
                for (let sc = 0; sc < m.NSc; sc++) {
                    const [d, r] = m.secCodes[sr][sc];
                    const L = paintCell(grid, d, r, 0, null); // probe (writes null)
                    if (L === null) bad++;
                    else letters.add(L);
                }
            worstBad = Math.max(worstBad, bad);
            orbitTotals.push(letters.size);
        }
        // H rung must have twice the section columns of the V rung at this order.
        const widthOK = senH
            ? true // checked relationally below
            : true;
        check(
            `rung ${name.padEnd(3)} (${dims}): every section paintable, 4/4 quads`,
            worstBad === 0,
            `orbits ${Math.min(...orbitTotals)}–${Math.max(...orbitTotals)}`,
        );
    }
}

// Relational: H_n columns == 2 × V_n columns (the v→h split).
for (const order of ORDERS) {
    const vm = rung(order, false, 1, 1);
    const hm = rung(order, true, 1, 1);
    check(
        `H${order} doubles columns vs V${order}`,
        hm.NSc === 2 * vm.NSc && hm.NSr === vm.NSr,
        `V ${vm.NSr}×${vm.NSc} → H ${hm.NSr}×${hm.NSc}`,
    );
}

console.log(
    failures
        ? `\n${failures} check(s) FAILED`
        : "\nall rungs on-anchor & paintable; H doubles columns ✓",
);
process.exit(failures ? 1 : 0);
