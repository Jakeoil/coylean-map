// Hypothesis: the (self,N,W) tromino table depends only on the dyadic phase
// = offset mod 4 = (firstDarkRow, firstDarkCol). If so, there are at most 16
// regime tables (and the anchor {0,1}^2 is the degenerate case where the 6-bit
// self-code already suffices). Group offsets by firstDark, merge within group,
// count within-group cross-offset conflicts.

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

// group -> { table:Map, conflicts, total }
const groups = new Map();
for (let h = 0; h <= 7; h++)
    for (let v = 0; v <= 7; v++) {
        setOffset(h, v);
        const p = computeMapModel(64, 64, { seniority: V });
        const c = computeMapModel(128, 128, { seniority: V });
        const gk = p.firstDarkRow + "," + p.firstDarkCol;
        if (!groups.has(gk))
            groups.set(gk, { table: new Map(), conflicts: 0, total: 0 });
        const G = groups.get(gk);
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
        const C = (sr, sc) =>
            sr < 0 || sc < 0 ? "x" : codeAt(p, oR, oC, sr, sc);
        for (let sr = 2; sr < lim - 2; sr++)
            for (let sc = 2; sc < lim - 2; sc++) {
                const cy = cOR + 2 * sr * SEC, cx = cOC + 2 * sc * SEC;
                const ck = [
                    childCode(cy, cx), childCode(cy, cx + SEC),
                    childCode(cy + SEC, cx), childCode(cy + SEC, cx + SEC),
                ].join("|");
                const key =
                    C(sr, sc) + ";N" + C(sr - 1, sc) + ";W" + C(sr, sc - 1);
                G.total++;
                if (G.table.has(key)) {
                    if (G.table.get(key) !== ck) G.conflicts++;
                } else G.table.set(key, ck);
            }
    }
setOffset(1, 1);

console.log("firstDark(R,C)   keys   samples   within-regime conflicts");
let allClean = true;
for (const [gk, G] of [...groups.entries()].sort()) {
    if (G.conflicts) allClean = false;
    console.log(
        `   ${gk}        ` +
        `${String(G.table.size).padStart(5)} ` +
        `${String(G.total).padStart(8)} ` +
        `${String(G.conflicts).padStart(10)}`);
}
console.log(allClean
    ? "\n=> regime = offset mod 4: each (firstDarkR,firstDarkC) has ONE consistent tromino table."
    : "\n=> some regimes still conflict — tromino+phase is not the full key.");
