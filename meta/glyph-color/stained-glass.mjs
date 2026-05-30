// Stained-glass: color a Coylean map by glyph orbit, composited down the
// substitution, on the renderer-agnostic orbit-color engine. Canvas renderer +
// dials + an editable glyph color map (per-orbit hue, on/off).

import {
    buildEngine,
    defaultPalette,
    rgbAt,
    mapCodes,
    compositeRects,
    Seniority,
} from "./orbit-color.js";

// ── State ──
const state = {
    seniority: Seniority.vertical(),
    order: 64, // cells per side: 32→8×8, 64→16×16, 128→32×32 sections
    h: 1, v: 1, // dyadic offset (longitude, latitude)
    baseAlpha: 0.55,
    falloff: 0.42,
    minPx: 4,
    L: 0.63, C: 0.17, // OKLCH lightness / chroma for the palette
    gap: 3, // leading width (px)
    bg: "glass", // glass | dark | light
};
let engine = buildEngine(state.seniority);
let palette = defaultPalette(state.seniority, { L: state.L, C: state.C });
// User per-orbit color overrides (orbit → [r,g,b]); survive L/C regen.
const overrides = new Map();

const canvas = document.getElementById("glass-canvas");
const ctx = canvas.getContext("2d");

// ── Palette helpers ──
// Rebuild the palette from OKLCH defaults at the current L/C, re-applying user
// color overrides and the existing enabled flags. rebuildUI=false just refreshes
// the swatch <input> values in place (cheap enough for live L/C dragging).
function regenPalette(rebuildUI) {
    const prev = palette;
    palette = defaultPalette(state.seniority, { L: state.L, C: state.C });
    for (const [orbit, rgb] of overrides) {
        const pe = palette.get(orbit);
        if (pe) pe.rgb = rgb.slice();
    }
    if (prev)
        for (const [o, pe] of palette) {
            const old = prev.get(o);
            if (old) pe.enabled = old.enabled;
        }
    if (rebuildUI) buildPaletteUI();
    else refreshSwatches();
}
// Recolor existing palette entries from the current L/C (hue/enabled kept,
// overrides honored) — cheap enough for live dragging (no re-classification).
function recolorPalette() {
    for (const [o, pe] of palette) {
        pe.rgb = overrides.has(o)
            ? overrides.get(o).slice()
            : rgbAt(state.L, state.C, pe.hue).rgb;
        pe.L = state.L;
        pe.C = state.C;
    }
    refreshSwatches();
}
function hexOf(rgb) {
    return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
}
function refreshSwatches() {
    document.querySelectorAll(".pal-col").forEach((el) => {
        const pe = palette.get(+el.dataset.orbit);
        if (pe) el.value = hexOf(pe.rgb);
    });
}

// ── Render (rAF-coalesced) ──
let pending = false;
function scheduleRender() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; render(); });
}
function render() {
    const codes = mapCodes(state.seniority, state.order, state.h, state.v);
    const cols = codes[0].length, rows = codes.length;
    const gap = state.gap;
    const maxW = Math.min(820, window.innerWidth - 340);
    const secPx = Math.max(8, Math.floor((maxW - (cols + 1) * gap) / cols));
    const totalW = cols * (secPx + gap) + gap;
    const totalH = rows * (secPx + gap) + gap;
    canvas.width = totalW;
    canvas.height = totalH;

    const lead = state.bg === "light" ? "#d8d8de"
        : state.bg === "dark" ? "#0e0f13" : "#15161b";
    const glass = state.bg === "dark" ? "#0e0f13"
        : state.bg === "light" ? "#ffffff" : "#ffffff";
    ctx.fillStyle = lead;
    ctx.fillRect(0, 0, totalW, totalH);
    // Lit glass base per section (so translucent colors read luminous).
    if (state.bg !== "dark") {
        ctx.fillStyle = glass;
        for (let sr = 0; sr < rows; sr++)
            for (let sc = 0; sc < cols; sc++)
                ctx.fillRect(
                    gap + sc * (secPx + gap), gap + sr * (secPx + gap),
                    secPx, secPx);
    }
    const rects = compositeRects({
        codes, gap, secPx, engine, palette,
        minPx: state.minPx, baseAlpha: state.baseAlpha, falloff: state.falloff,
    });
    for (const rk of rects) {
        ctx.fillStyle = `rgba(${rk.r},${rk.g},${rk.b},${rk.a})`;
        ctx.fillRect(rk.x, rk.y, rk.size, rk.size);
    }
    document.getElementById("info").textContent =
        `${cols}×${rows} sections · ${rects.length} color rects`;
}

// ── Controls wiring ──
function num(id) { return document.getElementById(id); }
function bindRange(id, key, fmtId, fmt = (x) => x) {
    const el = num(id);
    const out = fmtId ? num(fmtId) : null;
    const apply = () => {
        state[key] = parseFloat(el.value);
        if (out) out.textContent = fmt(state[key]);
        if (key === "L" || key === "C") recolorPalette();
        scheduleRender();
    };
    el.addEventListener("input", apply);
    if (out) out.textContent = fmt(state[key]);
}

// Which orbits actually appear on the current map (for the color map list).
function presentOrbits() {
    const codes = mapCodes(state.seniority, state.order, state.h, state.v);
    const seen = new Set();
    for (const row of codes)
        for (const [d, r] of row) {
            const o = engine.orbitOf.get(d + "," + r);
            if (o !== undefined) seen.add(o);
        }
    return [...seen].sort((a, b) => a - b);
}

function buildPaletteUI() {
    const host = document.getElementById("palette");
    host.innerHTML = "";
    for (const o of presentOrbits()) {
        const pe = palette.get(o);
        const rep = pe.rep;
        const hex = hexOf(pe.rgb);
        const row = document.createElement("label");
        row.className = "pal-row";
        row.innerHTML =
            `<input type="checkbox" ${pe.enabled ? "checked" : ""} ` +
            `data-orbit="${o}" class="pal-on" />` +
            `<input type="color" value="${hex}" data-orbit="${o}" ` +
            `class="pal-col" />` +
            `<span class="pal-name">${state.seniority.isVertical ? "V" : "H"}` +
            `${rep[0]}${rep[1]}</span>`;
        host.appendChild(row);
    }
    host.querySelectorAll(".pal-on").forEach((el) =>
        el.addEventListener("change", () => {
            palette.get(+el.dataset.orbit).enabled = el.checked;
            scheduleRender();
        }));
    host.querySelectorAll(".pal-col").forEach((el) =>
        el.addEventListener("input", () => {
            const o = +el.dataset.orbit;
            const rgb = [
                parseInt(el.value.slice(1, 3), 16),
                parseInt(el.value.slice(3, 5), 16),
                parseInt(el.value.slice(5, 7), 16),
            ];
            palette.get(o).rgb = rgb;
            overrides.set(o, rgb);
            scheduleRender();
        }));
}

function init() {
    bindRange("base-alpha", "baseAlpha", "base-alpha-out", (x) => x.toFixed(2));
    bindRange("falloff", "falloff", "falloff-out", (x) => x.toFixed(2));
    bindRange("minpx", "minPx", "minpx-out", (x) => x.toFixed(0));
    bindRange("lightness", "L", "lightness-out", (x) => x.toFixed(2));
    bindRange("chroma", "C", "chroma-out", (x) => x.toFixed(2));
    bindRange("gap", "gap", "gap-out", (x) => x.toFixed(0));

    num("order").addEventListener("change", (e) => {
        state.order = parseInt(e.target.value, 10);
        buildPaletteUI();
        scheduleRender();
    });
    num("bg").addEventListener("change", (e) => {
        state.bg = e.target.value;
        scheduleRender();
    });
    ["h", "v"].forEach((k) =>
        num(k + "-input").addEventListener("change", (e) => {
            state[k] = parseInt(e.target.value, 10) || 1;
            buildPaletteUI();
            scheduleRender();
        }));
    document.querySelectorAll('input[name="seniority"]').forEach((r) =>
        r.addEventListener("change", () => {
            const sel = document.querySelector(
                'input[name="seniority"]:checked');
            state.seniority = sel.value === "h"
                ? Seniority.horizontal() : Seniority.vertical();
            engine = buildEngine(state.seniority);
            overrides.clear();
            regenPalette(true);
            scheduleRender();
        }));

    document.getElementById("reset-palette").addEventListener("click", () => {
        overrides.clear();
        regenPalette(true);
        scheduleRender();
    });

    buildPaletteUI();
    render();
    window.addEventListener("resize", scheduleRender);
}

init();
