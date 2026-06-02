// planet-coyleus — terrain-render (canvas drawing only).
//
// Imports terrain-core for colors/geometry; holds no model state. Draws a
// glyph's 16 colored cells (optionally with faint arrows for legibility) and
// the universe patch. Cell index is row-major over the 4×4 grid: idx = i*4 + j.

import { cellsFor, matricesFor } from "./terrain-core.js";

const NUM_CELLS = 3; // interior reaction boxes; cell grid is 4×4

// Theme-aware canvas neutrals (the chrome is CSS; these are drawn). Light is the
// default; setTheme(false) switches to dark.
let isLight = true; // light theme is the default
let NEUTRAL = "#e2e4e9"; // unpainted cell fill
let GAP_COLOR = "#cdd0d6"; // composite bar-lane background
let WALL_COLOR = "#454b57"; // map cage walls
let BAR_COLOR = "#000000"; // substitution/translation bars (black on light)
export function setTheme(light) {
    isLight = light;
    NEUTRAL = light ? "#e2e4e9" : "#23262f";
    GAP_COLOR = light ? "#cdd0d6" : "#0b0c10";
    WALL_COLOR = light ? "#3b414d" : "#aab2c0";
    BAR_COLOR = light ? "#000000" : "#f2f4f9"; // black on light, white on dark
}

// Draw a 16-cell glyph into the box (x0,y0,size). Returns nothing; the caller
// owns hit-testing (idx = floor(dy/cs)*4 + floor(dx/cs), cs = size/4).
export function drawGlyphCells(ctx, x0, y0, size, cells, opts = {}) {
    const cs = size / 4;
    for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
            ctx.fillStyle = cells[i * 4 + j] || NEUTRAL;
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

// Arrows over the cells (same convention as glyphs/glyph-render drawGlyph).
// Drawn as a light casing + dark core so the v/h lines stay legible on any
// biome fill, light or dark.
function drawArrows(ctx, x0, y0, cs, m) {
    const { downMatrix, rightMatrix } = m;
    const px = (g) => g * cs;
    const segs = [];
    for (let y = 0; y <= NUM_CELLS; y++)
        for (let x = 0; x < NUM_CELLS; x++)
            if (downMatrix[y][x]) {
                const cx = x0 + px(x + 1);
                segs.push([cx, y0 + px(y), cx, y0 + px(y + 1)]);
            }
    for (let x = 0; x <= NUM_CELLS; x++)
        for (let y = 0; y < NUM_CELLS; y++)
            if (rightMatrix[x][y]) {
                const cy = y0 + px(y + 1);
                segs.push([x0 + px(x), cy, x0 + px(x + 1), cy]);
            }
    if (!segs.length) return;
    ctx.lineCap = "round";
    const pass = (color, width) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        for (const [ax, ay, bx, by] of segs) {
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
        }
        ctx.stroke();
    };
    const small = cs < 12;
    if (!isLight) {
        // dark mode: simple white lines, adaptive width
        pass("rgba(244,246,250,0.95)", small ? Math.max(0.7, cs * 0.16) : Math.min(6, cs * 0.12));
        return;
    }
    // light mode: dark lines — hairlines on tiny map cells, casing+core when big
    if (small) {
        pass("rgba(8,10,14,0.85)", Math.max(0.6, cs * 0.16));
    } else {
        const core = Math.min(6, cs * 0.11);
        pass("rgba(242,244,249,0.5)", core + Math.max(1.4, cs * 0.06)); // casing
        pass("rgba(10,12,16,0.95)", core); // core
    }
}

// Render one glyph (grid, code) filling a canvas, with arrows + grid. An
// optional `label` (e.g. "F\\") is drawn as a corner overlay.
export function renderGlyph(canvas, grid, d, r, label) {
    const ctx = canvas.getContext("2d");
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    drawGlyphCells(ctx, 0, 0, size, cellsFor(grid, d, r), {
        grid: true,
        matrices: matricesFor(grid, d, r),
    });
    if (label) drawLabel(ctx, size, label);
}

// Letter + operation tag, top-left, with a halo so it reads over any cell.
function drawLabel(ctx, size, text) {
    const fs = Math.max(13, size * 0.12);
    ctx.font = `bold ${fs}px Menlo, Monaco, monospace`;
    ctx.textBaseline = "top";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(2, fs * 0.2);
    ctx.strokeStyle = isLight ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.92)";
    ctx.strokeText(text, 5, 4);
    ctx.fillStyle = isLight ? "#11141a" : "#f4f6fa";
    ctx.fillText(text, 5, 4);
}

// ── composites: substitution pair / translation square, with cage-wall bars ──
// layout: { rows, cols, glyphPx, barPx, children:[{grid,d,r}], bars }.
// children are row-major; a bar lane of width barPx sits between adjacent cells.
export function compositeSize(layout) {
    return {
        w: layout.cols * layout.glyphPx + (layout.cols - 1) * layout.barPx,
        h: layout.rows * layout.glyphPx + (layout.rows - 1) * layout.barPx,
    };
}

export function drawComposite(canvas, layout) {
    const { rows, cols, glyphPx, barPx, children, bars } = layout;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = GAP_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const step = glyphPx + barPx;
    children.forEach((g, k) => {
        if (!g) return;
        const r = Math.floor(k / cols);
        const c = k % cols;
        drawGlyphCells(ctx, c * step, r * step, glyphPx, cellsFor(g.grid, g.d, g.r), {
            grid: true,
            matrices: matricesFor(g.grid, g.d, g.r),
        });
    });
    ctx.fillStyle = BAR_COLOR;
    if (rows === 1 && cols === 2) {
        if (bars.barV) ctx.fillRect(glyphPx, 0, barPx, glyphPx);
    } else if (rows === 2 && cols === 1) {
        if (bars.barH) ctx.fillRect(0, glyphPx, glyphPx, barPx);
    } else if (rows === 2 && cols === 2) {
        if (bars.vTop) ctx.fillRect(glyphPx, 0, barPx, glyphPx);
        if (bars.vBot) ctx.fillRect(glyphPx, step, barPx, glyphPx);
        if (bars.hLeft) ctx.fillRect(0, glyphPx, glyphPx, barPx);
        if (bars.hRight) ctx.fillRect(step, glyphPx, glyphPx, barPx);
    }
}

// Map a click on a composite to { grid, d, r, idx } or null (bar lane / miss).
export function compositeHit(canvas, layout, e) {
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;
    const { rows, cols, glyphPx, barPx } = layout;
    const step = glyphPx + barPx;
    const locate = (v) => {
        const idx = Math.floor(v / step);
        const within = v - idx * step;
        return within < glyphPx ? [idx, within] : null;
    };
    const lx = locate(x);
    const ly = locate(y);
    if (!lx || !ly || lx[0] >= cols || ly[0] >= rows) return null;
    const g = layout.children[ly[0] * cols + lx[0]];
    if (!g) return null;
    const cellPx = glyphPx / 4;
    const j = Math.min(3, Math.floor(lx[1] / cellPx));
    const i = Math.min(3, Math.floor(ly[1] / cellPx));
    return { grid: g.grid, d: g.d, r: g.r, idx: i * 4 + j };
}

// Render the universe patch: every section as a colored 16-cell glyph, with the
// v/h lines drawn when opts.lines is set.
export function renderPatch(canvas, patch, opts = {}) {
    const ctx = canvas.getContext("2d");
    const size = canvas.width;
    const sec = size / patch.NSc;
    const grid = patch.grid || "V";
    ctx.clearRect(0, 0, size, size);
    for (let sr = 0; sr < patch.NSr; sr++)
        for (let sc = 0; sc < patch.NSc; sc++) {
            const [d, r] = patch.codes[sr][sc];
            drawGlyphCells(
                ctx,
                sc * sec,
                sr * sec,
                sec,
                cellsFor(grid, d, r),
                opts.lines ? { matrices: matricesFor(grid, d, r) } : {},
            );
        }
    drawCageBars(ctx, patch, sec, size);
}

// Section-boundary cage walls, weighted by 2-adic valuation (more outer cage →
// heavier), a little heavier than the glyph hairlines.
function drawCageBars(ctx, patch, sec, size) {
    const glyphLine = sec * 0.04; // ~the small-cell arrow hairline
    const width = (p) =>
        Math.min(sec * 0.42, glyphLine * (1.6 + 0.95 * Math.max(0, p - 2)));
    ctx.strokeStyle = WALL_COLOR;
    ctx.lineCap = "butt";
    const bar = (x0, y0, x1, y1, p) => {
        if (!p) return;
        ctx.lineWidth = width(p);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
    };
    if (patch.vWalls)
        for (let sc = 1; sc < patch.NSc; sc++)
            bar(sc * sec, 0, sc * sec, size, patch.vWalls[sc]);
    if (patch.hWalls)
        for (let sr = 1; sr < patch.NSr; sr++)
            bar(0, sr * sec, size, sr * sec, patch.hWalls[sr]);
}
