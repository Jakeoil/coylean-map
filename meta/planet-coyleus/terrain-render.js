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
// The painted terrain (colored cells per section, so painting an orbit updates
// every instance) with the map's own down/right line field on top — each line
// scaled by its 2-adic priority, so the cage hierarchy reads as thicker lines.

// Mean of a section's painted cells (sRGB) for the zoomed-out swatch LOD.
function swatch(cells) {
    let r = 0, g = 0, b = 0, n = 0;
    for (const c of cells) {
        if (!c) continue;
        r += parseInt(c.slice(1, 3), 16);
        g += parseInt(c.slice(3, 5), 16);
        b += parseInt(c.slice(5, 7), 16);
        n++;
    }
    if (!n) return NEUTRAL;
    return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
}

export function drawQuadrant(canvas, rung, view, hover) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const Ht = canvas.height;
    ctx.fillStyle = MAP_BG;
    ctx.fillRect(0, 0, W, Ht);
    const { NSr, NSc, SEC, grid, downMatrix, rightMatrix, colPriority, rowPriority } = rung;
    const cellsX = NSc * SEC;
    const cellsY = NSr * SEC;
    // cell-grid coordinate → screen; section-grid coordinate → screen
    const sx = (cx) => W / 2 + ((cx - rung.firstDarkCol) / cellsX - view.cx) * view.z;
    const sy = (cy) => Ht / 2 + ((cy - rung.firstDarkRow) / cellsY - view.cy) * view.z;
    // Section rect aligned to the line field: a glyph sits +1 cell into its cage.
    const Xs = (C) => sx(rung.firstDarkCol + C * SEC + 1);
    const Ys = (R) => sy(rung.firstDarkRow + R * SEC + 1);
    const secW = view.z / NSc;
    const secH = view.z / NSr;
    const uxL = view.cx - W / 2 / view.z;
    const uxR = view.cx + W / 2 / view.z;
    const uyT = view.cy - Ht / 2 / view.z;
    const uyB = view.cy + Ht / 2 / view.z;

    // ── colored terrain (section fills) ──
    const c0 = Math.max(0, Math.floor(uxL * NSc) - 1);
    const c1 = Math.min(NSc - 1, Math.ceil(uxR * NSc) + 1);
    const r0 = Math.max(0, Math.floor(uyT * NSr) - 1);
    const r1 = Math.min(NSr - 1, Math.ceil(uyB * NSr) + 1);
    const detail = Math.min(secW, secH) >= 24;
    for (let R = r0; R <= r1; R++)
        for (let C = c0; C <= c1; C++) {
            const [d, r] = rung.codes[R][C];
            const cells = cellsFor(grid, d, r);
            if (detail) {
                drawGlyphCells(ctx, Xs(C), Ys(R), secW, secH, cells, {});
            } else {
                ctx.fillStyle = swatch(cells);
                ctx.fillRect(Xs(C), Ys(R), secW + 0.6, secH + 0.6);
            }
        }

    // ── the Coylean line field on top (lines at cell coords; thickness ∝ priority) ──
    const x0 = Math.max(0, Math.floor(uxL * cellsX + rung.firstDarkCol) - 1);
    const x1 = Math.min(rung.Mc - 1, Math.ceil(uxR * cellsX + rung.firstDarkCol) + 1);
    const y0 = Math.max(0, Math.floor(uyT * cellsY + rung.firstDarkRow) - 1);
    const y1 = Math.min(rung.Mr - 1, Math.ceil(uyB * cellsY + rung.firstDarkRow) + 1);
    const cellPx = Math.min(view.z / cellsX, view.z / cellsY);
    const base = Math.max(0.4, cellPx * 0.12);
    const widthFor = (p) => base * (1 + 0.62 * Math.min(p, 6));
    ctx.strokeStyle = isLight ? "#15171c" : "#eef1f6";
    ctx.lineCap = "butt";
    const byW = new Map();
    const add = (w, ax, ay, bx, by) => {
        if (w < 0.35) return; // sub-pixel → skip (natural LOD)
        const key = w.toFixed(2);
        let a = byW.get(key);
        if (!a) byW.set(key, (a = []));
        a.push(ax, ay, bx, by);
    };
    for (let y = y0; y <= y1; y++) {
        const dRow = downMatrix[y];
        for (let x = x0; x <= x1; x++) {
            if (dRow && dRow[x]) {
                const X = sx(x + 1); // original (perfect) map convention
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
        ctx.strokeStyle = isLight ? "rgba(176,125,18,0.95)" : "rgba(216,181,106,0.95)";
        ctx.lineWidth = 2;
        ctx.strokeRect(Xs(hover.C), Ys(hover.R), secW, secH);
    }
}

// Map a pointer event to { grid, d, r, R, C, idx } or null (outside the map).
// Sections sit +1 cell into their cage (matching the line field), so the unit
// coordinate is shifted by one cell before flooring to a section.
export function quadrantHit(canvas, rung, view, e) {
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);
    const ux = view.cx + (px - canvas.width / 2) / view.z;
    const uy = view.cy + (py - canvas.height / 2) / view.z;
    const fx = (ux - 1 / (rung.NSc * rung.SEC)) * rung.NSc;
    const fy = (uy - 1 / (rung.NSr * rung.SEC)) * rung.NSr;
    const C = Math.floor(fx);
    const R = Math.floor(fy);
    if (C < 0 || C >= rung.NSc || R < 0 || R >= rung.NSr) return null;
    const [d, r] = rung.codes[R][C];
    const j = Math.min(3, Math.max(0, Math.floor((fx - C) * 4)));
    const i = Math.min(3, Math.max(0, Math.floor((fy - R) * 4)));
    return { grid: rung.grid, d, r, R, C, idx: i * 4 + j };
}
