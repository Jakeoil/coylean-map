// ═══════════════════════════════════════════════════
//  Elaborate sealed glyph — shared pure canvas renderer
// ═══════════════════════════════════════════════════
//
// The descent (renderComplex) nested-rectangle style for a single glyph,
// coloured by shell depth: purple → yellow → green → pink (outer → inner).
// SEALED = the four perimeter bars are forced on (a cage with 4 bars). Pure:
// imports only the engine, no DOM/canvas-state config. Used by the turtle
// paradise hero (the "monster" = 2×2 split children) and the life-cycle page.

import { Seniority } from "../../coylean-explorer/coylean-core.js";
import { computeGlyphMatrices } from "../../glyphs/glyph-core.js";

export const ELAB = ["#9775fa", "#ffec99", "#b2f2bb", "#ffc9c9"]; // outer→inner
export const ELAB_P = 4; // shells (and the uniform cell priority)
export const NC = 3; // cells per glyph axis

const cache = new Map();
export function elabMatrices(grid, d, r) {
    const key = grid + d + r;
    if (cache.has(key)) return cache.get(key);
    const sen = grid === "H" ? Seniority.horizontal() : Seniority.vertical();
    const m = computeGlyphMatrices(d, r, sen);
    cache.set(key, m);
    return m;
}

// One cell, ported from descent.mjs renderComplex (downPri = rightPri = ELAB_P).
export function elabCell(g, x, y, down, right, down_out, right_out, S) {
    const P = ELAB_P, side = P * 2;
    for (let i = 0; i < P; i++) {
        g.fillStyle = ELAB[i];
        const w = side - 2 * i - 1;
        const h = side - 2 * i - 1;
        if (w > 0) {
            if (down) {
                if (down_out) g.fillRect(x + S * (i + 1), y, S * w, S * side);
                else g.fillRect(x + S * (i + 1), y, S * w, S * (P + 1));
            }
            if (down_out) g.fillRect(x + S * (i + 1), y + S * P, S * w, S * P);
        }
        if (h > 0) {
            if (right) {
                if (right_out) g.fillRect(x, y + S * (i + 1), S * side, S * h);
                g.fillRect(x, y + S * (i + 1), S * (P + 1), S * h);
            }
            if (right_out) g.fillRect(x + S * P, y + S * (i + 1), S * P, S * h);
        }
    }
}

// One sealed elaborate glyph into the square (x0, y0, size).
export function elabGlyphInto(ctx, x0, y0, size, grid, d, r) {
    const { downMatrix, rightMatrix } = elabMatrices(grid, d, r);
    const cellPx = size / NC;
    const S = cellPx / (ELAB_P * 2);
    for (let y = 0; y < NC; y++) {
        for (let x = 0; x < NC; x++) {
            let down = !!downMatrix[y][x];
            let down_out = !!downMatrix[y + 1][x];
            let right = !!rightMatrix[x][y];
            let right_out = !!rightMatrix[x + 1][y];
            if (y === 0) down = true; // seal: top cage bar
            if (y === NC - 1) down_out = true; //  bottom
            if (x === 0) right = true; //          left
            if (x === NC - 1) right_out = true; // right
            elabCell(ctx, x0 + x * cellPx, y0 + y * cellPx,
                down, right, down_out, right_out, S);
        }
    }
}
