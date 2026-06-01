// ════════════════════════════════════════════════════════════════════════
//  superglyphs/cell-descent.mjs — instant cell-level universe by descent
// ════════════════════════════════════════════════════════════════════════
//
//  A drop-in, UNBOUNDED, instant source of Coylean cell arrows for any
//  anchor-offset universe — the data layer the globe's lazy big-map scaffold
//  can be replaced with. No propagation, no boundary seed, no SE-march.
//
//  Seed once with `Propagation.fromUniverseExtents` (the README's ⚠️ rule:
//  seed it, don't derive it), section into glyph codes, then:
//    glyphAt(sr, sc) — descend the translation table from the seed (O(order))
//    downAt(gr, gc) / rightAt(gr, gc) — the cell's arrow, reconstructed from
//      its cage glyph via computeGlyphMatrices (verified == fromUniverseExtents
//      for the 3 INTERIOR cols/rows; the 4th is the senior cage wall = the
//      globe's analytic "skeleton" tier, not read here).
//
//  Works on the four anchor offsets {0,1}² × {V, H} — exactly the globe's
//  Lat/Long/Sen orientation buttons. Off-anchor is not address-addressable.

import { Seniority, Propagation } from "../../coylean-explorer/coylean-core.js";
import { computeGlyphMatrices } from "../../glyphs/glyph-core.js";
import { TRANSLATION_V, TRANSLATION_H, codeKey } from "./tests/rules.mjs";

const SEC = 4;

function cageOrigin(h, v, we, ne) {
    return {
        originRow: (((ne + 1 - v) % SEC) + SEC) % SEC,
        originCol: (((we + 1 - h) % SEC) + SEC) % SEC,
    };
}
function sectionize(p, oR, oC, ns) {
    const { downMatrix: D, rightMatrix: R } = p;
    const codes = Array.from({ length: ns }, () =>
        Array.from({ length: ns }, () => [0, 0]));
    const vBound = Array.from({ length: ns }, () => Array(ns).fill(false));
    const hBound = Array.from({ length: ns }, () => Array(ns).fill(false));
    for (let sr = 0; sr < ns; sr++)
        for (let sc = 0; sc < ns; sc++) {
            const y0 = oR + sr * SEC, x0 = oC + sc * SEC;
            for (let i = 0; i < 3; i++) {
                if (D[y0] && D[y0][x0 + i]) codes[sr][sc][0] |= 1 << i;
                if (R[x0] && R[x0][y0 + i]) codes[sr][sc][1] |= 1 << i;
            }
            if (sc < ns - 1) {
                const xe = x0 + SEC - 1;
                for (let i = 0; i < SEC; i++)
                    if (D[y0 + i] && D[y0 + i][xe]) { vBound[sr][sc] = true; break; }
            }
            if (sr < ns - 1) {
                const ye = y0 + SEC - 1;
                for (let i = 0; i < SEC; i++)
                    if (R[x0 + i] && R[x0 + i][ye]) { hBound[sr][sc] = true; break; }
            }
        }
    return { codes, vBound, hBound };
}

// Build an instant cell-universe for one orientation. `maxOrder` sets the finest
// resolution (and the centred extent: ±2^(maxOrder-1) cells); seeded at a small
// `seedDepth` (seed = 2^seedDepth sections/side via fromUniverseExtents).
export function makeCellUniverse({
    hInitCol = 1,
    vInitRow = 1,
    seniority = Seniority.vertical(),
    seedDepth = 5,
    maxOrder = 41,
} = {}) {
    const table = seniority.isVertical ? TRANSLATION_V : TRANSLATION_H;
    const ext = 1 << (seedDepth + 1);
    const p = Propagation.fromUniverseExtents({
        northExtent: ext, southExtent: ext, westExtent: ext, eastExtent: ext,
        hInitCol, vInitRow, seniority,
    });
    // Cage origin: at non-1/1 anchors the senior cage lattice starts at cell
    // (oR, oC) ∈ {0,1}², not 0 — the firstDark N/W margin. EVERY cell read must
    // carry it, or the whole map shears one cell into the wrong cage (the dotted
    // equator / gap-at-the-prime-meridian bug). A clean 2^seedDepth seed: the SE
    // edge cage is partial but its 3-bit code still reads in-range cells.
    const { originRow: oR, originCol: oC } = cageOrigin(
        hInitCol, vInitRow, ext, ext);
    const ns = 1 << seedDepth;
    const seed = sectionize(p, oR, oC, ns);
    const depth = maxOrder - 2; // section grid = 2^depth per side

    // Glyph code at section (R, C) at a given depth d — descend from the seed.
    function glyphAtD(R, C, d) {
        const e = d - seedDepth;
        let code = seed.codes[Math.floor(R / 2 ** e)][Math.floor(C / 2 ** e)];
        for (let l = e - 1; l >= 0; l--) {
            const rb = (R / 2 ** l) & 1, cb = (C / 2 ** l) & 1;
            code = table[codeKey(code)].children[rb * 2 + cb];
        }
        return code;
    }
    const glyphAt = (R, C) => glyphAtD(R, C, depth);

    // Senior cage walls, address-determined (the bars of bars.mjs): a sibling
    // edge is the parent's internal bar; a cross-parent edge is inherited. Used
    // to texture the 4th col/row of each cage (the wall meridian/parallel) so it
    // appears GAPPED per the map, not as a continuous skeleton grid line.
    function wallEastAt(R, C, d) {
        if (d === seedDepth) return C + 1 < ns ? seed.vBound[R][C] : false;
        const Rp = Math.floor(R / 2), Cp = Math.floor(C / 2);
        if (C % 2 === 0) {
            const b = table[codeKey(glyphAtD(Rp, Cp, d - 1))].bars;
            return R % 2 === 0 ? b.vTop : b.vBot;
        }
        return wallEastAt(Rp, Cp, d - 1);
    }
    function wallSouthAt(R, C, d) {
        if (d === seedDepth) return R + 1 < ns ? seed.hBound[R][C] : false;
        const Rp = Math.floor(R / 2), Cp = Math.floor(C / 2);
        if (R % 2 === 0) {
            const b = table[codeKey(glyphAtD(Rp, Cp, d - 1))].bars;
            return C % 2 === 0 ? b.hLeft : b.hRight;
        }
        return wallSouthAt(Rp, Cp, d - 1);
    }

    // Reconstructed cage cell-matrices, cached per glyph code + per cage.
    const gmCache = new Map();
    function matrices(code) {
        const k = code[0] + "," + code[1];
        let m = gmCache.get(k);
        if (!m) { m = computeGlyphMatrices(code[0], code[1], seniority, 1, 1); gmCache.set(k, m); }
        return m;
    }
    const cageCache = new Map();
    function cageMatrices(sr, sc) {
        const k = sr + "," + sc;
        let m = cageCache.get(k);
        if (!m) { m = matrices(glyphAt(sr, sc)); cageCache.set(k, m); }
        return m;
    }

    // Down/right arrow at absolute cell (gr, gc). Interior cols/rows (0,1,2)
    // come from the glyph; the 4th (the senior wall) comes from its bar, so
    // walls texture gapped-as-map rather than as a solid graticule.
    function downAt(gr, gc) {
        const r = gr - oR, c = gc - oC;
        if (r < 0 || c < 0) return false; // N/W margin: no full cage
        const sr = Math.floor(r / 4), sc = Math.floor(c / 4), lc = c - sc * 4;
        if (lc === 3) return wallEastAt(sr, sc, depth);
        return !!cageMatrices(sr, sc).downMatrix[r - sr * 4][lc];
    }
    function rightAt(gr, gc) {
        const r = gr - oR, c = gc - oC;
        if (r < 0 || c < 0) return false;
        const sr = Math.floor(r / 4), sc = Math.floor(c / 4), lr = r - sr * 4;
        if (lr === 3) return wallSouthAt(sr, sc, depth);
        return !!cageMatrices(sr, sc).rightMatrix[c - sc * 4][lr];
    }

    return {
        glyphAt, downAt, rightAt,
        depth, seedDepth, seedNs: ns,
        center: 2 ** (maxOrder - 1), // internal-cell coordinate of the origin
    };
}
