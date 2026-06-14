// At a BREAKING offset, is substitution a function of the section's full 8-bit
// boundary (4 top down-bits + 4 left right-bits) even though it isn't a
// function of the 6-bit interior code? If yes, "cage-boundary conditioning"
// is the fix; if still conflicting, we need superglyphs / deeper context.

import { Seniority } from "coylean/core";
import { computeMapModel, setOffset } from "coylean/glyphs";

const SEC = 4;
const V = Seniority.vertical();

function keysAt(h, v, pN) {
    setOffset(h, v);
    const p = computeMapModel(pN, pN, { seniority: V });
    const c = computeMapModel(pN * 2, pN * 2, { seniority: V });
    const oR = p.firstDarkRow + 1, oC = p.firstDarkCol + 1;
    const cOR = c.firstDarkRow + 1, cOC = c.firstDarkCol + 1;
    const pns = Math.min(p.NSr, p.NSc);
    const cns = Math.min(c.NSr, c.NSc);
    const lim = Math.min(pns, Math.floor(cns / 2));

    const code6 = new Map(); // 6-bit code -> Set(childKey)
    const bnd8 = new Map();  // 8-bit boundary -> Set(childKey)
    const add = (map, k, ck) => {
        if (!map.has(k)) map.set(k, new Set());
        map.get(k).add(ck);
    };
    const dAt = (M, y, x) => (M[y] && M[y][x] ? 1 : 0);

    for (let sr = 1; sr < lim - 1; sr++)
        for (let sc = 1; sc < lim - 1; sc++) {
            const y0 = oR + sr * SEC, x0 = oC + sc * SEC;
            // 6-bit interior code
            let dc = 0, rc = 0;
            for (let i = 0; i < 3; i++) {
                if (dAt(p.downMatrix, y0, x0 + i)) dc |= 1 << i;
                if (dAt(p.rightMatrix, x0, y0 + i)) rc |= 1 << i;
            }
            const c6 = dc + "," + rc;
            // 8-bit full boundary (4 top down + 4 left right)
            let top = 0, left = 0;
            for (let i = 0; i < 4; i++) {
                if (dAt(p.downMatrix, y0, x0 + i)) top |= 1 << i;
                if (dAt(p.rightMatrix, x0, y0 + i)) left |= 1 << i;
            }
            const b8 = top + "/" + left;
            // child key from order-(n+1) map (interior codes of the 4 children)
            const cy = cOR + 2 * sr * SEC, cx = cOC + 2 * sc * SEC;
            const childCode = (yy, xx) => {
                let d = 0, r = 0;
                for (let i = 0; i < 3; i++) {
                    if (dAt(c.downMatrix, yy, xx + i)) d |= 1 << i;
                    if (dAt(c.rightMatrix, xx, yy + i)) r |= 1 << i;
                }
                return d + "," + r;
            };
            const ck = [
                childCode(cy, cx), childCode(cy, cx + SEC),
                childCode(cy + SEC, cx), childCode(cy + SEC, cx + SEC),
            ].join("|");
            add(code6, c6, ck);
            add(bnd8, b8, ck);
        }

    const conflicts = (map) =>
        [...map.values()].filter((s) => s.size > 1).length;
    return {
        code6Keys: code6.size, code6Conflicts: conflicts(code6),
        bnd8Keys: bnd8.size, bnd8Conflicts: conflicts(bnd8),
    };
}

for (const [h, v] of [[1, 1], [2, 1], [1, 2], [2, 2], [3, 3], [5, 3]]) {
    const r = keysAt(h, v, 64);
    console.log(
        `long=${h} lat=${v}:  6-bit code → ${r.code6Keys} keys, ${r.code6Conflicts} conflicting   ` +
        `|  8-bit boundary → ${r.bnd8Keys} keys, ${r.bnd8Conflicts} conflicting`);
}
setOffset(1, 1);
