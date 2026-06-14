// ════════════════════════════════════════════════════════════════════════
//  superglyphs/tests — broken-wall-structure.mjs
// ════════════════════════════════════════════════════════════════════════
//
//  CHASING "174". bars.mjs noticed that three off-anchor offsets (2/2, 5/3,
//  3/5) all had exactly 174 broken vertical walls at order 7, hinting at an
//  invariant. They are NOT — 174 was three offsets landing in one dyadic
//  band-cell. The broken-wall count is a SELF-SIMILAR (2-adic) function of the
//  offset, with no constant closed form. This script shows the structure.
//
//  WHAT A "BROKEN WALL" IS
//  For each parent cage, its 2×2 children share a central vertical wall. The
//  wall is "broken" when its top half (vTop) ≠ its bottom half (vBot). On the
//  anchor every wall is whole (0 broken). Off-anchor some break; we count them.
//
//  THE TWO FINDINGS THIS PRINTS
//  (1) Offset grid: the count depends on LATITUDE bands (whether ANY wall
//      breaks) × LONGITUDE bands (how many). Rows within an active latitude
//      band are identical; lat ∈ {0,1} and the outer region are clean (0).
//  (2) Band scaling: the set of "active" latitudes doubles every order
//      (2^(order−2)) and is Cantor-like (not contiguous) — a self-similar
//      fractal. Hence the count grows ≈×4 per order at ~constant density,
//      but the exact value is fixed by the binary digits of (long, lat).
//
//  Run:  node meta/superglyphs/tests/broken-wall-structure.mjs

import { Seniority } from "coylean/core";
import { computeMapModel, setOffset } from "coylean/glyphs";

// Vertical walls per section, straight from the propagated child map (works at
// any offset — the cage lattice rides the firstDark shift).
function vWalls(model) {
    const { downMatrix, firstDarkRow, firstDarkCol, NSr, NSc, SEC } = model;
    const oR = firstDarkRow + 1, oC = firstDarkCol + 1;
    const w = Array.from({ length: NSr }, () => Array(NSc).fill(false));
    for (let sr = 0; sr < NSr; sr++)
        for (let sc = 0; sc < NSc - 1; sc++) {
            const y0 = oR + sr * SEC, x0 = oC + sc * SEC, xE = x0 + SEC - 1;
            for (let i = 0; i < SEC; i++)
                if (downMatrix[y0 + i] && downMatrix[y0 + i][xE]) {
                    w[sr][sc] = true;
                    break;
                }
        }
    return w;
}

// Broken vertical walls among the order-`order` parent cages at this offset.
function broken(long, lat, order) {
    setOffset(long, lat);
    const child = computeMapModel(1 << (order + 1), 1 << (order + 1), {
        seniority: Seniority.vertical(),
    });
    setOffset(1, 1);
    const vW = vWalls(child);
    const n = Math.floor((child.NSr - 1) / 2);
    let b = 0;
    for (let sr = 0; sr < n; sr++)
        for (let sc = 0; sc < n; sc++)
            if (vW[2 * sr][2 * sc] !== vW[2 * sr + 1][2 * sc]) b++;
    return b;
}

// ── (1) The offset grid at one order ─────────────────────────────────────
const ORDER = 6;
console.log(`Broken vertical walls at order ${ORDER} (long across, lat down):`);
let head = " lat\\long";
for (let L = 0; L <= 8; L++) head += String(L).padStart(5);
console.log(head);
for (let lat = 0; lat <= 8; lat++) {
    let row = String(lat).padStart(8) + " ";
    for (let long = 0; long <= 8; long++)
        row += String(broken(long, lat, ORDER)).padStart(5);
    console.log(row);
}
console.log(
    "  → lat {0,1} & {6,7,8} clean; lat {2..5} active; magnitude set by longitude.",
);

// ── (2) The active-latitude set doubles per order (self-similar) ─────────
console.log("\nActive-latitude set vs order (long=2):");
for (const order of [4, 5, 6, 7]) {
    const active = [];
    for (let lat = 0; lat <= (1 << order); lat++)
        if (broken(2, lat, order) > 0) active.push(lat);
    console.log(
        `  order ${order}: |active| = ${String(active.length).padStart(2)} ` +
        `(= 2^${order - 2}), span [${active[0]}..${active[active.length - 1]}] ` +
        `→ ${active.length === active[active.length - 1] - active[0] + 1
            ? "contiguous" : "Cantor-like (gappy)"}, broken(2,2)=${broken(2, 2, order)}`,
    );
}

// ── Sanity assertions (keep the pass/fail convention) ────────────────────
// The anchor and the clean latitudes give 0; the "174-class" trio agrees.
const anchorZero = broken(1, 1, 7) === 0 && broken(0, 1, 7) === 0;
const cls = [broken(2, 2, 7), broken(5, 3, 7), broken(3, 5, 7)];
const classAgrees = cls[0] === 174 && cls[1] === 174 && cls[2] === 174;
const ok = anchorZero && classAgrees;
console.log(
    "\n" +
    (ok
        ? "OK — anchor/clean-lat = 0; the 2/2,5/3,3/5 band-cell = 174 (not a\n" +
          "universal invariant — a self-similar function of the 2-adic offset).\n"
        : "Unexpected — counts changed; revisit.\n"),
);
process.exit(ok ? 0 : 1);
