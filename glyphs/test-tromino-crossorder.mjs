// Make-or-break: at a fixed non-anchor offset, is the (self,N,W) tromino rule
// the SAME across order pairs (32->64 vs 64->128)? If yes, it's a genuine
// stable substitution system for that offset (a from-scratch table works). If
// the same key gives different children at different orders, the tromino is
// not a fixed point and we need deeper context.

import { Seniority } from "coylean/core";
import { computeMapModel, setOffset } from "./glyph-core.js";

const SEC = 4, V = Seniority.vertical();
const dAt = (M, y, x) => (M[y] && M[y][x] ? 1 : 0);
function codeAt(M, oR, oC, sr, sc) {
    const y0 = oR + sr * SEC, x0 = oC + sc * SEC;
    let d = 0, r = 0;
    for (let i = 0; i < 3; i++) {
        if (dAt(M.downMatrix, y0, x0 + i)) d |= 1 << i;
        if (dAt(M.rightMatrix, x0, y0 + i)) r |= 1 << i;
    }
    return d + "," + r;
}
// Build the (self,N,W)->children map from a parent order pN -> child 2*pN.
function tromTable(h, v, pN) {
    setOffset(h, v);
    const p = computeMapModel(pN, pN, { seniority: V });
    const c = computeMapModel(pN * 2, pN * 2, { seniority: V });
    const oR = p.firstDarkRow + 1, oC = p.firstDarkCol + 1;
    const cOR = c.firstDarkRow + 1, cOC = c.firstDarkCol + 1;
    const lim = Math.min(p.NSr, p.NSc,
        Math.floor(Math.min(c.NSr, c.NSc) / 2));
    const childCode = (yy, xx) => {
        let d = 0, r = 0;
        for (let i = 0; i < 3; i++) {
            if (dAt(c.downMatrix, yy, xx + i)) d |= 1 << i;
            if (dAt(c.rightMatrix, xx, yy + i)) r |= 1 << i;
        }
        return d + "," + r;
    };
    const C = (sr, sc) => (sr < 0 || sc < 0 ? "x" : codeAt(p, oR, oC, sr, sc));
    const map = new Map();
    let selfConflicts = 0;
    for (let sr = 2; sr < lim - 2; sr++)
        for (let sc = 2; sc < lim - 2; sc++) {
            const cy = cOR + 2 * sr * SEC, cx = cOC + 2 * sc * SEC;
            const ck = [
                childCode(cy, cx), childCode(cy, cx + SEC),
                childCode(cy + SEC, cx), childCode(cy + SEC, cx + SEC),
            ].join("|");
            const key = C(sr, sc) + ";N" + C(sr - 1, sc) + ";W" + C(sr, sc - 1);
            if (map.has(key)) { if (map.get(key) !== ck) selfConflicts++; }
            else map.set(key, ck);
        }
    return { map, selfConflicts };
}

for (const [h, v] of [[2, 1], [1, 2], [2, 2], [3, 3]]) {
    const a = tromTable(h, v, 64);   // 64 -> 128
    const b = tromTable(h, v, 128);  // 128 -> 256
    let shared = 0, agree = 0, disagree = 0;
    for (const [k, va] of a.map)
        if (b.map.has(k)) {
            shared++;
            if (b.map.get(k) === va) agree++; else disagree++;
        }
    console.log(
        `offset long${h}/lat${v}:  64->128 keys=${a.map.size} (self-conflicts ${a.selfConflicts}), ` +
        `128->256 keys=${b.map.size} (self-conflicts ${b.selfConflicts})`);
    console.log(
        `   shared keys ${shared}: agree ${agree}, DISAGREE ${disagree}` +
        (disagree === 0 ? "  ✓ stable across orders" : "  ✗ not a fixed point"));
}
setOffset(1, 1);
