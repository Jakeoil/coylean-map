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
function sectionCodes(p, oR, oC, ns) {
    const { downMatrix: D, rightMatrix: R } = p;
    const codes = Array.from({ length: ns }, () =>
        Array.from({ length: ns }, () => [0, 0]));
    for (let sr = 0; sr < ns; sr++)
        for (let sc = 0; sc < ns; sc++) {
            const y0 = oR + sr * SEC, x0 = oC + sc * SEC;
            for (let i = 0; i < 3; i++) {
                if (D[y0] && D[y0][x0 + i]) codes[sr][sc][0] |= 1 << i;
                if (R[x0] && R[x0][y0 + i]) codes[sr][sc][1] |= 1 << i;
            }
        }
    return codes;
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
    const { originRow, originCol } = cageOrigin(hInitCol, vInitRow, ext, ext);
    const ns = Math.floor(
        Math.min(p.numRows - originRow, p.numColumns - originCol) / SEC);
    const seed = sectionCodes(p, originRow, originCol, ns);
    const depth = maxOrder - 2; // section grid = 2^depth per side

    // Glyph code at section (R, C) — descend the table from the seed cell.
    function glyphAt(R, C) {
        const e = depth - seedDepth;
        let code = seed[Math.floor(R / 2 ** e)][Math.floor(C / 2 ** e)];
        for (let l = e - 1; l >= 0; l--) {
            const rb = (R / 2 ** l) & 1, cb = (C / 2 ** l) & 1;
            code = table[codeKey(code)].children[rb * 2 + cb];
        }
        return code;
    }

    // Reconstructed cage cell-matrices, cached per glyph code.
    const gmCache = new Map();
    function matrices(code) {
        const k = code[0] + "," + code[1];
        let m = gmCache.get(k);
        if (!m) { m = computeGlyphMatrices(code[0], code[1], seniority, 1, 1); gmCache.set(k, m); }
        return m;
    }
    // Per-cage glyph cache keyed by section, so a meridian's column of cells
    // descends once.
    const cageCache = new Map();
    function cageMatrices(sr, sc) {
        const k = sr + "," + sc;
        let m = cageCache.get(k);
        if (!m) { m = matrices(glyphAt(sr, sc)); cageCache.set(k, m); }
        return m;
    }

    // Down-arrow at absolute cell (gr, gc). Interior cols (gc%4 ∈ {0,1,2}) only —
    // the 4th column is a senior wall (skeleton tier); returns false there.
    function downAt(gr, gc) {
        const lc = gc % 4;
        if (lc === 3) return false;
        return !!cageMatrices(Math.floor(gr / 4), Math.floor(gc / 4))
            .downMatrix[gr % 4][lc];
    }
    function rightAt(gr, gc) {
        const lr = gr % 4;
        if (lr === 3) return false;
        return !!cageMatrices(Math.floor(gr / 4), Math.floor(gc / 4))
            .rightMatrix[gc % 4][lr];
    }

    return {
        glyphAt, downAt, rightAt,
        depth, seedDepth, seedNs: ns,
        center: 2 ** (maxOrder - 1), // internal-cell coordinate of the origin
    };
}
