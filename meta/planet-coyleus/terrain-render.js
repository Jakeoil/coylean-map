// planet-coyleus — terrain-render (canvas drawing only).
//
// Imports terrain-core for colors/geometry; holds no model state. Draws a
// glyph's 16 colored cells (optionally with arrows), the substitution/
// translation composites, and the zoomable quadrant map. Cells may be non-square
// (H rungs are half-width), so the glyph drawer takes (w,h). Cell index is
// row-major over the 4×4 grid: idx = i*4 + j.

import { cellsFor, matricesFor } from "./terrain-core.js";

const NUM_CELLS = 3; // interior reaction boxes; cell grid is 4×4

// Theme-aware canvas neutrals (the chrome is CSS; these are drawn). Light is the
// default; setTheme(false) switches to dark.
let isLight = true;
let NEUTRAL = "#e2e4e9"; // unpainted cell fill
let GAP_COLOR = "#cdd0d6"; // composite bar-lane background
let WALL_COLOR = "#3b414d"; // cage walls
let BAR_COLOR = "#000000"; // substitution/translation bars
let MAP_BG = "#dfe2e7"; // quadrant background
export function setTheme(light) {
    isLight = light;
    NEUTRAL = light ? "#e2e4e9" : "#23262f";
    GAP_COLOR = light ? "#cdd0d6" : "#0b0c10";
    WALL_COLOR = light ? "#3b414d" : "#aab2c0";
    BAR_COLOR = light ? "#000000" : "#f2f4f9";
    MAP_BG = light ? "#dfe2e7" : "#0b0c10";
}

// Draw a 16-cell glyph into the box (x0,y0,w,h). May be non-square (H cells).
export function drawGlyphCells(ctx, x0, y0, w, h, cells, opts = {}) {
    const cw = w / 4;
    const ch = h / 4;
    for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
            ctx.fillStyle = cells[i * 4 + j] || NEUTRAL;
            ctx.fillRect(x0 + j * cw, y0 + i * ch, cw + 0.6, ch + 0.6);
        }
    if (opts.grid) {
        ctx.strokeStyle = isLight ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        for (let g = 0; g <= 4; g++) {
            ctx.beginPath();
            ctx.moveTo(x0 + g * cw, y0);
            ctx.lineTo(x0 + g * cw, y0 + h);
            ctx.moveTo(x0, y0 + g * ch);
            ctx.lineTo(x0 + w, y0 + g * ch);
            ctx.stroke();
        }
    }
    if (opts.matrices) drawArrows(ctx, x0, y0, cw, ch, opts.matrices);
}

// Arrows over the cells (glyphs/glyph-render convention). Light mode: dark
// casing+core (hairlines on tiny cells); dark mode: simple white lines.
function drawArrows(ctx, x0, y0, cw, ch, m) {
    const { downMatrix, rightMatrix } = m;
    const segs = [];
    for (let y = 0; y <= NUM_CELLS; y++)
        for (let x = 0; x < NUM_CELLS; x++)
            if (downMatrix[y][x]) {
                const cx = x0 + (x + 1) * cw;
                segs.push([cx, y0 + y * ch, cx, y0 + (y + 1) * ch]);
            }
    for (let x = 0; x <= NUM_CELLS; x++)
        for (let y = 0; y < NUM_CELLS; y++)
            if (rightMatrix[x][y]) {
                const cy = y0 + (y + 1) * ch;
                segs.push([x0 + x * cw, cy, x0 + (x + 1) * cw, cy]);
            }
    if (!segs.length) return;
    const cs = Math.min(cw, ch);
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
        pass("rgba(244,246,250,0.95)", small ? Math.max(0.7, cs * 0.16) : Math.min(6, cs * 0.12));
        return;
    }
    if (small) {
        pass("rgba(8,10,14,0.85)", Math.max(0.6, cs * 0.16));
    } else {
        const core = Math.min(6, cs * 0.11);
        pass("rgba(242,244,249,0.5)", core + Math.max(1.4, cs * 0.06)); // casing
        pass("rgba(10,12,16,0.95)", core); // core
    }
}

// Render one glyph (grid, code) filling a square canvas, with arrows + grid and
// an optional letter+op corner label.
export function renderGlyph(canvas, grid, d, r, label) {
    const ctx = canvas.getContext("2d");
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    drawGlyphCells(ctx, 0, 0, size, size, cellsFor(grid, d, r), {
        grid: true,
        matrices: matricesFor(grid, d, r),
    });
    if (label) drawLabel(ctx, size, label);
}

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
        drawGlyphCells(ctx, c * step, r * step, glyphPx, glyphPx, cellsFor(g.grid, g.d, g.r), {
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

// ── zoomable quadrant map: the Coylean line field, thickness by priority ──
// view = { cx, cy, z }: (cx,cy) the centre in unit-square coords [0,1]², z = px
// per unit. The section grid (NSr×NSc) maps onto the unit square, so cells span
// 1/(NSc·SEC) × 1/(NSr·SEC) of it; H rungs (2× columns) draw half-width cells.
// Only the map's own down/right lines are drawn — no fills, no overlays — each
// scaled by its 2-adic priority, so the cage hierarchy reads as thicker lines.
export function drawQuadrant(canvas, rung, view, hover) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const Ht = canvas.height;
    ctx.fillStyle = MAP_BG;
    ctx.fillRect(0, 0, W, Ht);
    const { NSr, NSc, SEC, downMatrix, rightMatrix, colPriority, rowPriority } = rung;
    const cellsX = NSc * SEC;
    const cellsY = NSr * SEC;
    // cell-grid coordinate → screen
    const sx = (cx) => W / 2 + ((cx - rung.firstDarkCol) / cellsX - view.cx) * view.z;
    const sy = (cy) => Ht / 2 + ((cy - rung.firstDarkRow) / cellsY - view.cy) * view.z;
    // visible cell range
    const uxL = view.cx - W / 2 / view.z;
    const uxR = view.cx + W / 2 / view.z;
    const uyT = view.cy - Ht / 2 / view.z;
    const uyB = view.cy + Ht / 2 / view.z;
    const x0 = Math.max(0, Math.floor(uxL * cellsX + rung.firstDarkCol) - 1);
    const x1 = Math.min(rung.Mc - 1, Math.ceil(uxR * cellsX + rung.firstDarkCol) + 1);
    const y0 = Math.max(0, Math.floor(uyT * cellsY + rung.firstDarkRow) - 1);
    const y1 = Math.min(rung.Mr - 1, Math.ceil(uyB * cellsY + rung.firstDarkRow) + 1);

    const cellPx = Math.min(view.z / cellsX, view.z / cellsY);
    const base = Math.max(0.4, cellPx * 0.12);
    // Thickness grows with 2-adic priority (cage depth); capped so the few very
    // high-priority lines near the prime-meridian axis don't blow up.
    const widthFor = (p) => base * (1 + 0.62 * Math.min(p, 6));
    ctx.strokeStyle = isLight ? "#15171c" : "#eef1f6";
    ctx.lineCap = "butt";
    // group segments by width so we stroke each width once
    const byW = new Map();
    const add = (w, x0_, y0_, x1_, y1_) => {
        if (w < 0.35) return; // sub-pixel → skip (natural LOD)
        const key = w.toFixed(2);
        let a = byW.get(key);
        if (!a) byW.set(key, (a = []));
        a.push(x0_, y0_, x1_, y1_);
    };
    for (let y = y0; y <= y1; y++) {
        const dRow = downMatrix[y];
        for (let x = x0; x <= x1; x++) {
            if (dRow && dRow[x]) {
                const X = sx(x + 1);
                add(widthFor(colPriority[x] || 0), X, sy(y), X, sy(y + 1));
            }
            const rCol = rightMatrix[x];
            if (rCol && rCol[y]) {
                const Y = sy(y + 1);
                add(widthFor(rowPriority[y] || 0), sx(x), Y, sx(x + 1), Y);
            }
        }
    }
    for (const [key, a] of byW) {
        ctx.lineWidth = +key;
        ctx.beginPath();
        for (let i = 0; i < a.length; i += 4) {
            ctx.moveTo(a[i], a[i + 1]);
            ctx.lineTo(a[i + 2], a[i + 3]);
        }
        ctx.stroke();
    }
    // hover outline on the section under the cursor (interaction feedback)
    if (hover) {
        const hx = sx(rung.firstDarkCol + hover.C * SEC);
        const hy = sy(rung.firstDarkRow + hover.R * SEC);
        ctx.strokeStyle = isLight ? "rgba(176,125,18,0.9)" : "rgba(216,181,106,0.9)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(hx, hy, view.z / NSc, view.z / NSr);
    }
}

// Map a pointer event to { grid, d, r, R, C, idx } or null (outside the map).
export function quadrantHit(canvas, rung, view, e) {
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);
    const ux = view.cx + (px - canvas.width / 2) / view.z;
    const uy = view.cy + (py - canvas.height / 2) / view.z;
    if (ux < 0 || ux >= 1 || uy < 0 || uy >= 1) return null;
    const C = Math.min(rung.NSc - 1, Math.floor(ux * rung.NSc));
    const R = Math.min(rung.NSr - 1, Math.floor(uy * rung.NSr));
    const [d, r] = rung.codes[R][C];
    const j = Math.min(3, Math.floor((ux * rung.NSc - C) * 4));
    const i = Math.min(3, Math.floor((uy * rung.NSr - R) * 4));
    return { grid: rung.grid, d, r, R, C, idx: i * 4 + j };
}
