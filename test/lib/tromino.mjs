// Reusable (self, North, West) tromino-table builder — the off-home refinement
// rule, re-written inline across the tromino page + experiments. Builds the
// table from an offset's own map at orders `order` → order+1.
import { Seniority } from "coylean/core";
import { setOffset, computeMapModel } from "coylean/glyphs";
import { SEC, sectionsFromModel } from "./sections.mjs";

const codeStr = (c) => (c ? c[0] + "," + c[1] : "x");

// Returns { table, bySelf } for offset (h, v):
//   table:  Map("self;N;W" → [NW, NE, SW, SE] child codes)
//   bySelf: Map("d,r" → Set of distinct child-block strings)  (size 1 ⇒ the
//           self-code alone decides — the Home Anchor signature)
export function buildTrominoTable(h, v, order = 6, seniority = Seniority.vertical()) {
    const N = 1 << order;
    setOffset(h, v);
    const pM = computeMapModel(N, N, { seniority });
    const cM = computeMapModel(2 * N, 2 * N, { seniority });
    setOffset(1, 1);
    const pns = Math.min(pM.NSr, pM.NSc);
    const cns = Math.min(cM.NSr, cM.NSc);
    const p = sectionsFromModel(pM, pns);
    const c = sectionsFromModel(cM, cns);
    const lim = Math.min(pns, Math.floor(cns / 2));

    const table = new Map();
    const bySelf = new Map();
    const at = (sr, sc) =>
        sr < 0 || sc < 0 || sr >= pns || sc >= pns ? null : p[sr][sc];

    for (let sr = 1; sr < lim - 1; sr++) {
        for (let sc = 1; sc < lim - 1; sc++) {
            const self = p[sr][sc];
            const a = sr * 2;
            const b = sc * 2;
            const kids = [c[a][b], c[a][b + 1], c[a + 1][b], c[a + 1][b + 1]];
            const kidStr = kids.map(codeStr).join("|");
            const key =
                codeStr(self) + ";" + codeStr(at(sr - 1, sc)) + ";" +
                codeStr(at(sr, sc - 1));
            if (!table.has(key)) table.set(key, kids);
            const s = codeStr(self);
            if (!bySelf.has(s)) bySelf.set(s, new Set());
            bySelf.get(s).add(kidStr);
        }
    }
    return { table, bySelf };
}
