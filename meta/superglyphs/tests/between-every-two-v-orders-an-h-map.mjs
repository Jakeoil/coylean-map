// ════════════════════════════════════════════════════════════════════════
//  superglyphs/tests — between-every-two-v-orders-an-h-map.mjs
// ════════════════════════════════════════════════════════════════════════
//
//  THE CLAIM (Jake)
//  "Any two consecutive V-order Coylean maps have an H-order map in between,
//   consisting of sideways (H) glyphs."
//
//  Concretely the orders interleave at half-cage grain:
//
//      V_n  ──v→h──>  H_n  ──h→v──>  V_{n+1}  ──v→h──>  H_{n+1}  ── …
//
//  and the in-between H map is dimensionally wedged between its V neighbours:
//
//      V_n      :  2ⁿ   × 2ⁿ     cells   (square, V glyphs)
//      H_n      :  2ⁿ   × 2ⁿ⁺¹   cells   (wide,   H/sideways glyphs)  ← between
//      V_{n+1}  :  2ⁿ⁺¹ × 2ⁿ⁺¹   cells   (square, V glyphs)
//
//  v→h doubles the COLUMNS (V_n → H_n); h→v doubles the ROWS (H_n → V_{n+1}).
//  Each is a real Coylean propagation (getSectionData with the matching
//  seniority), so H_n genuinely IS a sideways-glyph map, not bookkeeping.
//
//  WHAT THIS TEST ADDS over two-substitutions-make-a-translation.mjs
//  That test confirmed the factorization at ONE order (5→6). This confirms the
//  half-step rules are a TRANSFERABLE substitution system: build the v→h and
//  h→v code tables once (at a deep order, to see the full alphabet), then use
//  them to PREDICT the in-between H map and the next V map at OTHER orders,
//  cell for cell. If a rule learned at order 6 regenerates the order-5 ladder,
//  it's a real generative rule — the hallmark of a substitution.
//
//  getSectionData(N, M, seniority): the canonical clean-seed map, N rows × M
//  cols of cells, sectioned 4×4. ".codes[sr][sc] = [downCode, rightCode]".
//
//  Run:  node meta/superglyphs/tests/between-every-two-v-orders-an-h-map.mjs

import { Seniority } from "../../../coylean-explorer/coylean-core.js";
import { getSectionData } from "../../../glyphs/glyph-core.js";

const V = Seniority.vertical();
const H = Seniority.horizontal();
const N = (order) => 1 << order; // cells per side at a square order (2^order)
const codeKey = (c) => c[0] + "," + c[1];

// V_n (square V), H_n (wide H, between V_n and V_{n+1}), V_{n+1} (square V).
const vMap = (order) => getSectionData(N(order), N(order), V);
const hMbetween = (order) => getSectionData(N(order), N(order + 1), H);

// ── Learn the two half-step rules from one (deep) order ──────────────────
// v→h: V code → "Hleft|Hright". h→v: H code → "Vtop|Vbottom". Keys are the
// glyph codes; values are the ordered child-code pair. Built at LEARN_ORDER,
// where the alphabet is (close to) complete, so the tables cover the codes
// that appear at the shallower orders we then predict.
const LEARN_ORDER = 6;
function learnVToH(order) {
    const v = vMap(order);
    const h = hMbetween(order);
    const t = new Map();
    for (let sr = 0; sr < v.NSr; sr++)
        for (let sc = 0; sc < v.NSc; sc++)
            t.set(
                codeKey(v.codes[sr][sc]),
                codeKey(h.codes[sr][2 * sc]) + "|" +
                    codeKey(h.codes[sr][2 * sc + 1]),
            );
    return t;
}
function learnHToV(order) {
    const h = hMbetween(order);
    const vNext = vMap(order + 1);
    const t = new Map();
    for (let sr = 0; sr < h.NSr; sr++)
        for (let sc = 0; sc < h.NSc; sc++)
            t.set(
                codeKey(h.codes[sr][sc]),
                codeKey(vNext.codes[2 * sr][sc]) + "|" +
                    codeKey(vNext.codes[2 * sr + 1][sc]),
            );
    return t;
}
const V_TO_H = learnVToH(LEARN_ORDER);
const H_TO_V = learnHToV(LEARN_ORDER);
console.log(
    `Learned half-step rules at order ${LEARN_ORDER}: ` +
    `v→h ${V_TO_H.size} V codes, h→v ${H_TO_V.size} H codes\n`,
);

// ── Predict a child grid from a rule table and compare to the truth ──────
// For every parent cell, expand via the rule and check it matches the real
// propagated child map. `pairAt(truth, sr, sc)` returns the truth pair string
// for the parent at (sr, sc); the rule's output must equal it. Counts misses
// (parent code absent from the rule — alphabet not yet covered) separately
// from mismatches (rule present but WRONG — a real failure).
function predict(label, dims, rule, pRows, pCols, parentCodeAt, truthPairAt) {
    let checked = 0, mismatch = 0, miss = 0;
    for (let sr = 0; sr < pRows; sr++) {
        for (let sc = 0; sc < pCols; sc++) {
            const got = rule.get(parentCodeAt(sr, sc));
            if (got === undefined) { miss++; continue; }
            checked++;
            if (got !== truthPairAt(sr, sc)) mismatch++;
        }
    }
    const tag = mismatch === 0 && checked > 0 ? "PASS" : "FAIL";
    console.log(
        `  [${tag}] ${label} ${dims}: ${checked} cells, ` +
        `${mismatch} mismatch` + (miss ? `, ${miss} uncovered` : ""),
    );
    return mismatch === 0 && checked > 0;
}

// Predict, at order `order`, both legs of the ladder around H_n.
function checkOrder(order) {
    const v = vMap(order);
    const h = hMbetween(order);
    const vNext = vMap(order + 1);
    const dimsH = `(V ${N(order)}² → H ${N(order)}×${N(order + 1)})`;
    const dimsV = `(H ${N(order)}×${N(order + 1)} → V ${N(order + 1)}²)`;

    // Leg 1 — v→h regenerates the in-between H map (the sideways-glyph map).
    const a = predict(
        "v→h builds H_between", dimsH, V_TO_H, v.NSr, v.NSc,
        (sr, sc) => codeKey(v.codes[sr][sc]),
        (sr, sc) =>
            codeKey(h.codes[sr][2 * sc]) + "|" +
            codeKey(h.codes[sr][2 * sc + 1]),
    );
    // Leg 2 — h→v turns that H map into the next V order.
    const b = predict(
        "h→v builds V_{n+1} ", dimsV, H_TO_V, h.NSr, h.NSc,
        (sr, sc) => codeKey(h.codes[sr][sc]),
        (sr, sc) =>
            codeKey(vNext.codes[2 * sr][sc]) + "|" +
            codeKey(vNext.codes[2 * sr + 1][sc]),
    );
    return a && b;
}

console.log("Ladder V_n → H_n (sideways) → V_{n+1}, rules transferred:\n");
let ok = true;
for (const order of [5, 6]) {
    console.log(`order ${order} → ${order + 1}:`);
    ok = checkOrder(order) && ok;
}

console.log(
    ok
        ? "\nPASS — between every two V orders sits a generated H map of " +
          "sideways glyphs.\n"
        : "\nFAIL — the in-between H map is not regenerated by the rules.\n",
);
process.exit(ok ? 0 : 1);
