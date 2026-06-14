// How much neighborhood context makes substitution a function at a breaking
// offset? Propagation flows SE, so the determining context (if local) is the
// N / W / NW neighbors. Condition the child-set on progressively larger
// neighborhoods and watch the conflict count.

import { Seniority } from "coylean/core";
import { computeMapModel, setOffset } from "coylean/glyphs";

const SEC = 4;
const V = Seniority.vertical();

function codeAt(M, oR, oC, sr, sc) {
    const y0 = oR + sr * SEC, x0 = oC + sc * SEC;
    let d = 0, r = 0;
    const dAt = (Mtx, y, x) => (Mtx[y] && Mtx[y][x] ? 1 : 0);
    for (let i = 0; i < 3; i++) {
        if (dAt(M.downMatrix, y0, x0 + i)) d |= 1 << i;
        if (dAt(M.rightMatrix, x0, y0 + i)) r |= 1 << i;
    }
    return d + "," + r;
}

function run(h, v, pN) {
    setOffset(h, v);
    const p = computeMapModel(pN, pN, { seniority: V });
    const c = computeMapModel(pN * 2, pN * 2, { seniority: V });
    const oR = p.firstDarkRow + 1, oC = p.firstDarkCol + 1;
    const cOR = c.firstDarkRow + 1, cOC = c.firstDarkCol + 1;
    const lim = Math.min(p.NSr, p.NSc, Math.floor(Math.min(c.NSr, c.NSc) / 2));
    const dAt = (M, y, x) => (M[y] && M[y][x] ? 1 : 0);
    const childCode = (yy, xx) => {
        let d = 0, r = 0;
        for (let i = 0; i < 3; i++) {
            if (dAt(c.downMatrix, yy, xx + i)) d |= 1 << i;
            if (dAt(c.rightMatrix, xx, yy + i)) r |= 1 << i;
        }
        return d + "," + r;
    };
    const ctx = {
        self: new Map(), nw: new Map(), nwOnly3: new Map(), all8: new Map(),
    };
    const add = (map, k, ck) => {
        if (!map.has(k)) map.set(k, new Set());
        map.get(k).add(ck);
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
            const self = C(sr, sc);
            add(ctx.self, self, ck);
            add(ctx.nw, self + ";N" + C(sr - 1, sc) + ";W" + C(sr, sc - 1), ck);
            add(ctx.nwOnly3,
                self + ";N" + C(sr - 1, sc) + ";W" + C(sr, sc - 1) +
                ";NW" + C(sr - 1, sc - 1), ck);
            let key = self;
            for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]])
                key += ";" + C(sr + dr, sc + dc);
            add(ctx.all8, key, ck);
        }
    const conf = (m) => [...m.values()].filter((s) => s.size > 1).length;
    return {
        self: [ctx.self.size, conf(ctx.self)],
        nw: [ctx.nw.size, conf(ctx.nw)],
        nw3: [ctx.nwOnly3.size, conf(ctx.nwOnly3)],
        all8: [ctx.all8.size, conf(ctx.all8)],
    };
}

console.log("conflicting keys (keys with >1 distinct child-set) by context size:");
console.log("offset        self    +N,W   +N,W,NW   +all8");
for (const [h, v] of [[1, 1], [2, 1], [1, 2], [2, 2], [3, 3]]) {
    const r = run(h, v, 64);
    const f = ([k, c]) => `${c}/${k}`.padStart(8);
    console.log(
        `long${h} lat${v}` + f(r.self) + f(r.nw) + f(r.nw3) + f(r.all8));
}
setOffset(1, 1);
