// ════════════════════════════════════════════════════════════════════════
//  superglyphs/universe.mjs — scrollable Coylean map with instant random access
// ════════════════════════════════════════════════════════════════════════
//
//  Scroll/zoom the SE-flowing Coylean map and jump to ANY cell up to 2⁴⁰
//  (≈1.1 trillion) per axis — instantly, because on the anchor the glyph at a
//  section is a pure function of its dyadic address (see bin/random-access-
//  tile.mjs). No propagation, no seam chain: each visible section is found by
//  descending the translation table O(order) times from a one-section root.
//
//  Coordinate model. The whole map is the infinite quadtree from the root.
//  Fix the finest order at MAX_ORDER = 40 (2⁴⁰ cells/side). A section at depth
//  d (d table-descents from the root) is order d+2 and spans 2^(MAX_ORDER−d)
//  cells/side; at d = MAX_DEPTH = 38 a section is a single glyph (4×4 cells).
//  Render depth is chosen from the zoom so on-screen sections stay legible —
//  zoomed in we descend to real glyphs and draw their arrows; zoomed out we
//  draw the coarse parent glyph (a real summary of its subtree) as a swatch.
//
//  Anchor only: this is the clean SE map (lat/long = 1/1, the canonical
//  anchor). Off-anchor offsets break the cage walls and aren't address-
//  addressable (see README "Saving work in big-map").

import { Seniority } from "../../coylean-explorer/coylean-core.js";
import {
    getSectionData,
    computeGlyphMatrices,
} from "../../glyphs/glyph-core.js";
import { TRANSLATION_V, ORBIT_V, codeKey } from "./bin/rules.mjs";

const V = Seniority.vertical();
const MAX_ORDER = 40; //   2⁴⁰ ≈ 1.1e12 cells per axis (just over a trillion)
const MAX_DEPTH = MAX_ORDER - 2; // descents to reach a single-glyph section
const MAX_CELLS = 2 ** MAX_ORDER;

// The root: the single top-left section of the clean map (order 2).
const ROOT = getSectionData(4, 4, V).codes[0][0];

// Glyph code at section (R, C) of depth d, by address descent from the root.
// O(d) lookups; touches no neighbours. R, C ∈ [0, 2^d).
function tileGlyph(R, C, d) {
    let code = ROOT;
    for (let level = d - 1; level >= 0; level--) {
        const rb = (R / 2 ** level) & 1; // bit `level` of R (row path)
        const cb = (C / 2 ** level) & 1; // bit `level` of C (col path)
        code = TRANSLATION_V[codeKey(code)].children[rb * 2 + cb];
    }
    return code;
}

// ── Cage walls by address (the bars between sections) ────────────────────
// A section's east / south wall is the cage separator on that edge. Like the
// glyph it is address-determined on the anchor (bars.mjs): a sibling edge is
// the parent's internal bar; a cross-parent edge is the parent edge inherited.
// Verified == getSectionData's vBound/hBound. These are the senior priority
// lines that draw the nested cage structure.
// (division-based, not >>/& — those are 32-bit and break past 2³¹)
function vWallEast(R, C, d) {
    if (C + 1 >= 2 ** d) return false; // map's outer edge
    const Rp = Math.floor(R / 2), Cp = Math.floor(C / 2);
    if (C % 2 === 0) {
        const p = TRANSLATION_V[codeKey(tileGlyph(Rp, Cp, d - 1))].bars;
        return R % 2 === 0 ? p.vTop : p.vBot;
    }
    return vWallEast(Rp, Cp, d - 1);
}
function hWallSouth(R, C, d) {
    if (R + 1 >= 2 ** d) return false;
    const Rp = Math.floor(R / 2), Cp = Math.floor(C / 2);
    if (R % 2 === 0) {
        const p = TRANSLATION_V[codeKey(tileGlyph(Rp, Cp, d - 1))].bars;
        return C % 2 === 0 ? p.hLeft : p.hRight;
    }
    return hWallSouth(Rp, Cp, d - 1);
}
// 2-adic valuation: a wall east of section C sits at column (C+1); the more
// 2s divide (C+1), the more SENIOR (outer) the cage it bounds.
function v2(n) {
    let v = 0;
    while (n > 0 && n % 2 === 0) { v++; n /= 2; }
    return v;
}

// Cells per side of a depth-d section, and the orbit hue for the LOD swatch.
const cellsPerSection = (d) => 2 ** (MAX_ORDER - d);
const orbitHue = (code) => ((ORBIT_V[codeKey(code)] ?? 0) * 137.508) % 360;

// ── Glyph arrow drawing (mirrors the catalog's segment convention) ───────
// downMatrix[gy][gx] = vertical segment at col gx+1, rows gy..gy+1 (gx 0-2, gy 0-3)
// rightMatrix[gx][gy] = horizontal segment at row gy+1, cols gx..gx+1 (gx 0-3, gy 0-2)
const glyphCache = new Map();
function glyphMatrices(dc, rc) {
    const k = dc + "," + rc;
    let m = glyphCache.get(k);
    if (!m) {
        m = computeGlyphMatrices(dc, rc, V, 1, 1);
        glyphCache.set(k, m);
    }
    return m;
}
function drawGlyphArrows(ctx, dc, rc, sx, sy, size) {
    const { downMatrix, rightMatrix } = glyphMatrices(dc, rc);
    const cell = size / 4;
    ctx.beginPath();
    for (let gy = 0; gy <= 3; gy++)
        for (let gx = 0; gx < 3; gx++)
            if (downMatrix[gy][gx]) {
                const x = sx + (gx + 1) * cell;
                ctx.moveTo(x, sy + gy * cell);
                ctx.lineTo(x, sy + (gy + 1) * cell);
            }
    for (let gx = 0; gx <= 3; gx++)
        for (let gy = 0; gy < 3; gy++)
            if (rightMatrix[gx][gy]) {
                const y = sy + (gy + 1) * cell;
                ctx.moveTo(sx + gx * cell, y);
                ctx.lineTo(sx + (gx + 1) * cell, y);
            }
    ctx.stroke();
}

// ── View state (cell-space) ──────────────────────────────────────────────
const canvas = document.getElementById("map");
const ctx = canvas.getContext("2d");
const view = { cx: 8.5, cy: 8.5, scale: 8 }; // center cell + px per cell

function resize() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    render();
}

// Pick the render depth so a section is ~ TARGET px on screen.
const TARGET_SECTION_PX = 36;
const ARROW_MIN_PX = 26; // below this, draw a swatch instead of arrows
function renderDepth() {
    const d = Math.round(MAX_ORDER - Math.log2(TARGET_SECTION_PX / view.scale));
    return Math.max(0, Math.min(MAX_DEPTH, d));
}

function render() {
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = "#0f1117";
    ctx.fillRect(0, 0, W, H);

    const d = renderDepth();
    const cps = cellsPerSection(d);
    const secPx = cps * view.scale;
    const nSec = 2 ** d; // sections per side at this depth

    // Visible cell window → section index window. Start one section early so
    // the left/top cage walls (owned by the off-screen neighbour) still draw.
    const leftCell = view.cx - W / 2 / view.scale;
    const topCell = view.cy - H / 2 / view.scale;
    const c0 = Math.max(0, Math.floor(leftCell / cps) - 1);
    const r0 = Math.max(0, Math.floor(topCell / cps) - 1);
    const c1 = Math.min(nSec - 1, Math.floor((leftCell + W / view.scale) / cps));
    const r1 = Math.min(nSec - 1, Math.floor((topCell + H / view.scale) / cps));
    const sxOf = (C) => W / 2 + (C * cps - view.cx) * view.scale;
    const syOf = (R) => H / 2 + (R * cps - view.cy) * view.scale;

    // Pass 1 — glyph interiors (junior segments, dim) / coarse swatches.
    const drawArrows = secPx >= ARROW_MIN_PX;
    ctx.strokeStyle = "#5f7bb5";
    ctx.lineWidth = Math.max(0.5, secPx / 110);
    for (let R = r0; R <= r1; R++) {
        for (let C = c0; C <= c1; C++) {
            const code = tileGlyph(R, C, d);
            if (code[0] === 0 && code[1] === 0) continue; // all-quiet
            const sx = sxOf(C), sy = syOf(R);
            if (drawArrows) {
                drawGlyphArrows(ctx, code[0], code[1], sx, sy, secPx);
            } else {
                ctx.fillStyle = `hsl(${orbitHue(code)} 55% 52% / 0.85)`;
                ctx.fillRect(sx, sy, Math.max(1, secPx - 0.5), Math.max(1, secPx - 0.5));
            }
        }
    }

    // Pass 2 — the cages: senior cage walls, brighter + thicker the more outer
    // the cage (by the wall's 2-adic valuation). Drawn on top of the glyphs.
    const wallBase = Math.max(0.7, secPx / 60);
    for (let R = r0; R <= r1; R++) {
        for (let C = c0; C <= c1; C++) {
            const sx = sxOf(C), sy = syOf(R);
            if (vWallEast(R, C, d)) {
                const lvl = v2(C + 1);
                ctx.strokeStyle = `hsl(218 35% ${72 + Math.min(lvl, 6) * 4}%)`;
                ctx.lineWidth = wallBase * (1 + 0.7 * Math.min(lvl, 6));
                ctx.beginPath();
                ctx.moveTo(sx + secPx, sy);
                ctx.lineTo(sx + secPx, sy + secPx);
                ctx.stroke();
            }
            if (hWallSouth(R, C, d)) {
                const lvl = v2(R + 1);
                ctx.strokeStyle = `hsl(218 35% ${72 + Math.min(lvl, 6) * 4}%)`;
                ctx.lineWidth = wallBase * (1 + 0.7 * Math.min(lvl, 6));
                ctx.beginPath();
                ctx.moveTo(sx, sy + secPx);
                ctx.lineTo(sx + secPx, sy + secPx);
                ctx.stroke();
            }
        }
    }

    // Origin axes (cell 0) for orientation.
    ctx.strokeStyle = "#39406a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const ox = W / 2 + (0 - view.cx) * view.scale;
    const oy = H / 2 + (0 - view.cy) * view.scale;
    ctx.moveTo(ox, 0); ctx.lineTo(ox, H);
    ctx.moveTo(0, oy); ctx.lineTo(W, oy);
    ctx.stroke();

    updateHud(d, secPx);
}

// ── HUD ──────────────────────────────────────────────────────────────────
const hud = document.getElementById("hud");
let hoverCell = null;
function updateHud(d, secPx) {
    const order = d + 2;
    const cell = hoverCell
        ? `cell (${hoverCell.x.toLocaleString()}, ${hoverCell.y.toLocaleString()})`
        : `center (${Math.floor(view.cx).toLocaleString()}, ${Math.floor(view.cy).toLocaleString()})`;
    hud.textContent =
        `${cell} · order ${order} (section = ${cellsPerSection(d).toLocaleString()} cells, ` +
        `${secPx.toFixed(0)}px) · zoom ${view.scale.toFixed(2)} px/cell`;
}

// ── Interaction ───────────────────────────────────────────────────────────
let drag = null;
canvas.addEventListener("mousedown", (e) => {
    drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
});
window.addEventListener("mouseup", () => (drag = null));
window.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    hoverCell = {
        x: Math.floor(view.cx + (e.clientX - rect.left - canvas.width / 2) / view.scale),
        y: Math.floor(view.cy + (e.clientY - rect.top - canvas.height / 2) / view.scale),
    };
    if (drag) {
        view.cx = drag.cx - (e.clientX - drag.x) / view.scale;
        view.cy = drag.cy - (e.clientY - drag.y) / view.scale;
        clampView();
    }
    render();
});
canvas.addEventListener(
    "wheel",
    (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        // Cell under cursor before zoom, kept fixed after.
        const cxAt = view.cx + (mx - canvas.width / 2) / view.scale;
        const cyAt = view.cy + (my - canvas.height / 2) / view.scale;
        const factor = Math.exp(-e.deltaY * 0.0015);
        view.scale = Math.min(120, Math.max(2 ** -34, view.scale * factor));
        view.cx = cxAt - (mx - canvas.width / 2) / view.scale;
        view.cy = cyAt - (my - canvas.height / 2) / view.scale;
        clampView();
        render();
    },
    { passive: false },
);

function clampView() {
    view.cx = Math.min(MAX_CELLS, Math.max(0, view.cx));
    view.cy = Math.min(MAX_CELLS, Math.max(0, view.cy));
}

// Jump-to box: go to an exact cell, zoomed in enough to see the glyph.
function jumpTo(x, y) {
    view.cx = Math.min(MAX_CELLS - 1, Math.max(0, x)) + 0.5;
    view.cy = Math.min(MAX_CELLS - 1, Math.max(0, y)) + 0.5;
    view.scale = 18;
    render();
}
document.getElementById("jump").addEventListener("submit", (e) => {
    e.preventDefault();
    const x = Number(document.getElementById("jx").value);
    const y = Number(document.getElementById("jy").value);
    if (Number.isFinite(x) && Number.isFinite(y)) jumpTo(x, y);
});
document.getElementById("reset").addEventListener("click", () => {
    view.cx = 8.5; view.cy = 8.5; view.scale = 8; render();
});
document.querySelectorAll("[data-jump]").forEach((b) =>
    b.addEventListener("click", () => {
        const [x, y] = b.dataset.jump.split(",").map(Number);
        jumpTo(x, y);
    }),
);

window.addEventListener("resize", resize);
resize();
