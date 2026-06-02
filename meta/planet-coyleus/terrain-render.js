// planet-coyleus — terrain-render (canvas drawing only).
//
// Imports terrain-core for colors/geometry; holds no model state. Draws a
// glyph's 16 colored cells (optionally with faint arrows for legibility) and
// the universe patch. Cell index is row-major over the 4×4 grid: idx = i*4 + j.

import { EMPTY, cellsFor, matricesFor } from "./terrain-core.js";

const NUM_CELLS = 3; // interior reaction boxes; cell grid is 4×4

// Draw a 16-cell glyph into the box (x0,y0,size). Returns nothing; the caller
// owns hit-testing (idx = floor(dy/cs)*4 + floor(dx/cs), cs = size/4).
export function drawGlyphCells(ctx, x0, y0, size, cells, opts = {}) {
    const cs = size / 4;
    for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
            ctx.fillStyle = cells[i * 4 + j] || EMPTY;
            ctx.fillRect(x0 + j * cs, y0 + i * cs, cs + 0.6, cs + 0.6);
        }
    if (opts.grid) {
        ctx.strokeStyle = "rgba(0,0,0,0.18)";
        ctx.lineWidth = 1;
        for (let g = 0; g <= 4; g++) {
            ctx.beginPath();
            ctx.moveTo(x0 + g * cs, y0);
            ctx.lineTo(x0 + g * cs, y0 + size);
            ctx.moveTo(x0, y0 + g * cs);
            ctx.lineTo(x0 + size, y0 + g * cs);
            ctx.stroke();
        }
    }
    if (opts.matrices) drawArrows(ctx, x0, y0, cs, opts.matrices);
}

// Faint arrows over the cells (same convention as glyphs/glyph-render drawGlyph).
function drawArrows(ctx, x0, y0, cs, m) {
    const { downMatrix, rightMatrix } = m;
    const px = (g) => g * cs;
    ctx.strokeStyle = "rgba(20,22,28,0.5)";
    ctx.lineWidth = Math.max(1, cs * 0.07);
    ctx.lineCap = "round";
    for (let y = 0; y <= NUM_CELLS; y++)
        for (let x = 0; x < NUM_CELLS; x++)
            if (downMatrix[y][x]) {
                const cx = x0 + px(x + 1);
                ctx.beginPath();
                ctx.moveTo(cx, y0 + px(y));
                ctx.lineTo(cx, y0 + px(y + 1));
                ctx.stroke();
            }
    for (let x = 0; x <= NUM_CELLS; x++)
        for (let y = 0; y < NUM_CELLS; y++)
            if (rightMatrix[x][y]) {
                const cy = y0 + px(y + 1);
                ctx.beginPath();
                ctx.moveTo(x0 + px(x), cy);
                ctx.lineTo(x0 + px(x + 1), cy);
                ctx.stroke();
            }
}

// Render one glyph (grid, code) filling a canvas, with arrows + grid.
export function renderGlyph(canvas, grid, d, r) {
    const ctx = canvas.getContext("2d");
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    drawGlyphCells(ctx, 0, 0, size, cellsFor(grid, d, r), {
        grid: true,
        matrices: matricesFor(grid, d, r),
    });
}

// Render the universe patch: every section as a colored 16-cell glyph.
export function renderPatch(canvas, patch) {
    const ctx = canvas.getContext("2d");
    const size = canvas.width;
    const sec = size / patch.NSc;
    ctx.clearRect(0, 0, size, size);
    for (let sr = 0; sr < patch.NSr; sr++)
        for (let sc = 0; sc < patch.NSc; sc++) {
            const [d, r] = patch.codes[sr][sc];
            drawGlyphCells(ctx, sc * sec, sr * sec, sec, cellsFor("V", d, r));
        }
}
