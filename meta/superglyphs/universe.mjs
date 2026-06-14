// ════════════════════════════════════════════════════════════════════════
//  superglyphs/universe.mjs — scrollable four-quadrant symmetric universe
// ════════════════════════════════════════════════════════════════════════
//
//  Scroll/zoom the full symmetric Coylean universe — origin at the centre, four
//  quadrants around it — and jump to any cell up to ±2⁴⁰ (≈±1.1 trillion) per
//  axis, instantly.
//
//  HOW (and the lesson the README's ⚠️ note hammers): the universe is SEEDED,
//  not hand-rolled. We build one small seed with `Propagation.fromUniverseExtents`
//  (the real integrated symmetric universe), section it into glyphs, and then a
//  section's glyph at any depth is found by descending the translation table
//  from that seed — O(order) lookups, no propagation. The seed already contains
//  all four quadrants, and the table expands every one of them correctly
//  (verified: descent == fromUniverseExtents at depth, 0 mismatches). NO attempt
//  to reflect/derive the off-SE quadrants — that path fails; seed it.
//
//  "FAKE THE ADDRESS." Underneath this is a 0-based SE-flow propagation grid
//  `[0, 2^d)`. We present CENTRED, SIGNED universe coordinates so the user feels
//  they're roaming a universe with the origin in the middle — not indexing a
//  propagation. The universe is a substitution fixed point about its centre, so
//  the origin lands exactly on the grid centre `2^(d-1)`: the fake is one offset.

import { Seniority, Propagation } from "coylean/core";
import { computeGlyphMatrices } from "coylean/glyphs";
import { TRANSLATION_V, ORBIT_V, codeKey } from "./tests/rules.mjs";

const V = Seniority.vertical();
const SEC = 4;

// ── Build the seed: the real symmetric universe, sectioned into glyphs ────
const SEED_D = 5; //               seed is 2^SEED_D = 32 sections per side
const SEED_EXT = 1 << (SEED_D + 1); // fromUniverseExtents extent → ns = ext/2
const MAX_ORDER = 41; //           finest order: 2⁴¹ cells, centred → ±2⁴⁰/axis
const MAX_DEPTH = MAX_ORDER - 2; // finest descent depth
const CENTER = 2 ** (MAX_ORDER - 1); // internal-cell coordinate of the origin

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
    return { codes, vBound, hBound, ns };
}
const SEED = (() => {
    const p = Propagation.fromUniverseExtents({
        northExtent: SEED_EXT, southExtent: SEED_EXT,
        westExtent: SEED_EXT, eastExtent: SEED_EXT,
        hInitCol: 1, vInitRow: 1, seniority: V,
    });
    const { originRow, originCol } = cageOrigin(1, 1, SEED_EXT, SEED_EXT);
    const ns = Math.floor(
        Math.min(p.numRows - originRow, p.numColumns - originCol) / SEC);
    return sectionize(p, originRow, originCol, ns);
})();
const SEED_NS = SEED.ns; // = 2^SEED_D

// ── Glyph at internal section (R, C) at depth d, by descent from the seed ─
function tileGlyph(R, C, d) {
    const e = d - SEED_D;
    let code = SEED.codes[Math.floor(R / 2 ** e)][Math.floor(C / 2 ** e)];
    for (let l = e - 1; l >= 0; l--) {
        const rb = (R / 2 ** l) & 1, cb = (C / 2 ** l) & 1;
        code = TRANSLATION_V[codeKey(code)].children[rb * 2 + cb];
    }
    return code;
}
// Cage walls, address-determined; the recursion bottoms out at the seed.
function vWallEast(R, C, d) {
    if (d === SEED_D) return C + 1 < SEED_NS ? SEED.vBound[R][C] : false;
    const Rp = Math.floor(R / 2), Cp = Math.floor(C / 2);
    if (C % 2 === 0) {
        const p = TRANSLATION_V[codeKey(tileGlyph(Rp, Cp, d - 1))].bars;
        return R % 2 === 0 ? p.vTop : p.vBot;
    }
    return vWallEast(Rp, Cp, d - 1);
}
function hWallSouth(R, C, d) {
    if (d === SEED_D) return R + 1 < SEED_NS ? SEED.hBound[R][C] : false;
    const Rp = Math.floor(R / 2), Cp = Math.floor(C / 2);
    if (R % 2 === 0) {
        const p = TRANSLATION_V[codeKey(tileGlyph(Rp, Cp, d - 1))].bars;
        return C % 2 === 0 ? p.hLeft : p.hRight;
    }
    return hWallSouth(Rp, Cp, d - 1);
}
function v2(n) { let v = 0; while (n > 0 && n % 2 === 0) { v++; n /= 2; } return v; }

const cellsPerSection = (d) => 2 ** (MAX_ORDER - d);
const orbitHue = (code) => ((ORBIT_V[codeKey(code)] ?? 0) * 137.508) % 360;

// ── Glyph arrow drawing (catalog segment convention) ─────────────────────
const glyphCache = new Map();
function glyphMatrices(dc, rc) {
    const k = dc + "," + rc;
    let m = glyphCache.get(k);
    if (!m) { m = computeGlyphMatrices(dc, rc, V, 1, 1); glyphCache.set(k, m); }
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

// ── View state — CENTRED, SIGNED universe cell coords (origin = 0,0) ──────
const canvas = document.getElementById("map");
const ctx = canvas.getContext("2d");
const view = { cx: 0, cy: 0, scale: 6 };

function resize() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    render();
}

const TARGET_SECTION_PX = 36;
const ARROW_MIN_PX = 26;
function renderDepth() {
    const d = Math.round(MAX_ORDER - Math.log2(TARGET_SECTION_PX / view.scale));
    return Math.max(SEED_D, Math.min(MAX_DEPTH, d));
}

function render() {
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = "#0f1117";
    ctx.fillRect(0, 0, W, H);

    const d = renderDepth();
    const cps = cellsPerSection(d);
    const secPx = cps * view.scale;
    const nSec = 2 ** d;

    // Centred universe cell window → internal section window. Internal cell =
    // CENTER + universe cell (the fake: user sees signed, grid stays 0-based).
    const leftU = view.cx - W / 2 / view.scale;
    const topU = view.cy - H / 2 / view.scale;
    const c0 = Math.max(0, Math.floor((CENTER + leftU) / cps) - 1);
    const r0 = Math.max(0, Math.floor((CENTER + topU) / cps) - 1);
    const c1 = Math.min(nSec - 1, Math.floor((CENTER + leftU + W / view.scale) / cps));
    const r1 = Math.min(nSec - 1, Math.floor((CENTER + topU + H / view.scale) / cps));
    const sxOf = (C) => W / 2 + (C * cps - CENTER - view.cx) * view.scale;
    const syOf = (R) => H / 2 + (R * cps - CENTER - view.cy) * view.scale;

    // Pass 1 — glyph interiors (dim) / coarse swatches.
    const drawArrows = secPx >= ARROW_MIN_PX;
    ctx.strokeStyle = "#5f7bb5";
    ctx.lineWidth = Math.max(0.5, secPx / 110);
    for (let R = r0; R <= r1; R++)
        for (let C = c0; C <= c1; C++) {
            const code = tileGlyph(R, C, d);
            if (code[0] === 0 && code[1] === 0) continue;
            const sx = sxOf(C), sy = syOf(R);
            if (drawArrows) drawGlyphArrows(ctx, code[0], code[1], sx, sy, secPx);
            else {
                ctx.fillStyle = `hsl(${orbitHue(code)} 55% 52% / 0.85)`;
                ctx.fillRect(sx, sy, Math.max(1, secPx - 0.5), Math.max(1, secPx - 0.5));
            }
        }

    // Pass 2 — cage walls, brighter + thicker for outer cages (by valuation).
    const wallBase = Math.max(0.7, secPx / 60);
    for (let R = r0; R <= r1; R++)
        for (let C = c0; C <= c1; C++) {
            const sx = sxOf(C), sy = syOf(R);
            if (vWallEast(R, C, d)) {
                const lvl = v2(C + 1);
                ctx.strokeStyle = `hsl(218 35% ${72 + Math.min(lvl, 6) * 4}%)`;
                ctx.lineWidth = wallBase * (1 + 0.7 * Math.min(lvl, 6));
                ctx.beginPath();
                ctx.moveTo(sx + secPx, sy); ctx.lineTo(sx + secPx, sy + secPx); ctx.stroke();
            }
            if (hWallSouth(R, C, d)) {
                const lvl = v2(R + 1);
                ctx.strokeStyle = `hsl(218 35% ${72 + Math.min(lvl, 6) * 4}%)`;
                ctx.lineWidth = wallBase * (1 + 0.7 * Math.min(lvl, 6));
                ctx.beginPath();
                ctx.moveTo(sx, sy + secPx); ctx.lineTo(sx + secPx, sy + secPx); ctx.stroke();
            }
        }

    // Origin prime meridian (universe col 0) — marks the centre the four
    // quadrants meet at. The horizontal "equator" guide was dropped: extraneous,
    // since the map's own senior axis already reads the centre line.
    ctx.strokeStyle = "#5a6498";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const ox = W / 2 + (0 - view.cx) * view.scale;
    ctx.moveTo(ox, 0); ctx.lineTo(ox, H);
    ctx.stroke();

    updateHud(d, secPx);
}

// ── HUD (shows the faked, signed universe coordinates + quadrant) ────────
const hud = document.getElementById("hud");
let hoverU = null;
function quadrant(x, y) {
    const v = y < 0 ? "N" : "S", h = x < 0 ? "W" : "E";
    return (x === 0 && y === 0) ? "origin" : v + h;
}
function updateHud(d, secPx) {
    const u = hoverU || { x: Math.round(view.cx), y: Math.round(view.cy) };
    hud.textContent =
        `${quadrant(u.x, u.y)} (${u.x.toLocaleString()}, ${u.y.toLocaleString()})` +
        ` · order ${d + 2} (section = ${cellsPerSection(d).toLocaleString()} cells,` +
        ` ${secPx.toFixed(0)}px) · zoom ${view.scale.toFixed(2)} px/cell`;
}

// ── Interaction ───────────────────────────────────────────────────────────
let drag = null;
canvas.addEventListener("mousedown", (e) => {
    drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
});
window.addEventListener("mouseup", () => (drag = null));
window.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    hoverU = {
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
canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const cxAt = view.cx + (mx - canvas.width / 2) / view.scale;
    const cyAt = view.cy + (my - canvas.height / 2) / view.scale;
    view.scale = Math.min(120, Math.max(2 ** -34, view.scale * Math.exp(-e.deltaY * 0.0015)));
    view.cx = cxAt - (mx - canvas.width / 2) / view.scale;
    view.cy = cyAt - (my - canvas.height / 2) / view.scale;
    clampView();
    render();
}, { passive: false });

function clampView() {
    const lim = CENTER; // universe coords live in [-CENTER, CENTER)
    view.cx = Math.min(lim - 1, Math.max(-lim, view.cx));
    view.cy = Math.min(lim - 1, Math.max(-lim, view.cy));
}

function jumpTo(x, y) {
    view.cx = Math.min(CENTER - 1, Math.max(-CENTER, x));
    view.cy = Math.min(CENTER - 1, Math.max(-CENTER, y));
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
    view.cx = 0; view.cy = 0; view.scale = 6; render();
});
document.querySelectorAll("[data-jump]").forEach((b) =>
    b.addEventListener("click", () => {
        const [x, y] = b.dataset.jump.split(",").map(Number);
        jumpTo(x, y);
    }));

window.addEventListener("resize", resize);
resize();
