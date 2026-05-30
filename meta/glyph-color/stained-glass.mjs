// Stained-glass: a Coylean map colored by glyph orbit (composited down the
// substitution) with the whole-map Coylean line pattern overlaid, in a
// pannable / zoomable viewport. Built on the renderer-agnostic orbit-color
// engine. The map is rendered once to an offscreen layer; the viewport blits a
// panned/zoomed region (cheap), re-rendering the layer only when content or a
// dial changes.

import {
    buildEngine,
    defaultPalette,
    rgbAt,
    mapModel,
    mapSegments,
    compositeRects,
    Seniority,
} from "./orbit-color.js";

// ── State ──
const state = {
    seniority: Seniority.vertical(),
    order: 64,
    h: 1, v: 1,
    baseAlpha: 0.55, falloff: 0.42, minPx: 4,
    L: 0.63, C: 0.17,
    bg: "glass",
    patternOn: true,
    patternDensity: 0, // extra line-refinement levels beyond the color order
    patternWidth: 1,
    patternColor: "#1d2230",
    patternAlpha: 0.6,
    // viewport
    zoom: 1, panX: 0, panY: 0,
};
let engine = buildEngine(state.seniority);
let palette = defaultPalette(state.seniority, { L: state.L, C: state.C });
const overrides = new Map();

const canvas = document.getElementById("glass-canvas");
const vctx = canvas.getContext("2d");
const offscreen = document.createElement("canvas");
let offW = 0, offH = 0, dirty = true;

// ── Offscreen full-map render ──
function buildOffscreen() {
    const model = mapModel(state.seniority, state.order, state.h, state.v);
    const codes = model.secCodes;
    const cols = codes[0].length, rows = codes.length;
    const secPx = Math.max(16, Math.min(140, Math.round(1500 / cols)));
    offW = cols * secPx;
    offH = rows * secPx;
    offscreen.width = offW;
    offscreen.height = offH;
    const octx = offscreen.getContext("2d");
    octx.fillStyle = state.bg === "dark" ? "#0e0f13"
        : state.bg === "light" ? "#ffffff" : "#ffffff";
    octx.fillRect(0, 0, offW, offH);

    const rects = compositeRects({
        codes, gap: 0, secPx, engine, palette,
        minPx: state.minPx, baseAlpha: state.baseAlpha, falloff: state.falloff,
    });
    for (const rk of rects) {
        octx.fillStyle = `rgba(${rk.r},${rk.g},${rk.b},${rk.a})`;
        octx.fillRect(rk.x, rk.y, rk.size, rk.size);
    }
    if (state.patternOn) drawLines(octx, secPx, model);
    dirty = false;
}

// Whole-map Coylean line pattern, batched by priority (senior cage lines drawn
// thicker). density>0 pulls the segments from a finer-order map.
function drawLines(octx, secPx, baseModel) {
    const lineOrder = Math.min(state.order * (1 << state.patternDensity), 512);
    const mult = lineOrder / state.order;
    const lm = lineOrder === state.order
        ? baseModel
        : mapModel(state.seniority, lineOrder, state.h, state.v);
    const { verts, horis } = mapSegments(lm);
    const cellPx = secPx / (4 * mult);
    const [pr, pg, pb] = hexToRgb(state.patternColor);
    const PRI_CAP = 6;
    const groups = new Map();
    const add = (p, x0, y0, x1, y1) => {
        const pc = Math.min(p, PRI_CAP);
        if (!groups.has(pc)) groups.set(pc, []);
        groups.get(pc).push(x0, y0, x1, y1);
    };
    for (const s of verts)
        add(s.pri, s.x * cellPx, s.y0 * cellPx, s.x * cellPx, s.y1 * cellPx);
    for (const s of horis)
        add(s.pri, s.x0 * cellPx, s.y * cellPx, s.x1 * cellPx, s.y * cellPx);
    octx.lineCap = "round";
    octx.strokeStyle = `rgba(${pr},${pg},${pb},${state.patternAlpha})`;
    for (const pc of [...groups.keys()].sort((a, b) => a - b)) {
        octx.lineWidth = state.patternWidth * (1 + 0.7 * pc);
        octx.beginPath();
        const arr = groups.get(pc);
        for (let i = 0; i < arr.length; i += 4) {
            octx.moveTo(arr[i], arr[i + 1]);
            octx.lineTo(arr[i + 2], arr[i + 3]);
        }
        octx.stroke();
    }
}

// ── Viewport ──
function sizeCanvas() {
    const stage = document.getElementById("stage");
    canvas.width = Math.max(200, stage.clientWidth);
    canvas.height = Math.max(200, window.innerHeight - 150);
}
function fitView() {
    const z = Math.min(canvas.width / offW, canvas.height / offH);
    state.zoom = z;
    state.panX = (canvas.width - offW * z) / 2;
    state.panY = (canvas.height - offH * z) / 2;
}
function blit() {
    vctx.fillStyle = "#0b0c10";
    vctx.fillRect(0, 0, canvas.width, canvas.height);
    vctx.imageSmoothingEnabled = state.zoom < 1;
    vctx.drawImage(offscreen, state.panX, state.panY,
        offW * state.zoom, offH * state.zoom);
    document.getElementById("info").textContent =
        `${offW}×${offH} map · zoom ${(state.zoom).toFixed(2)}×`;
}

let pending = false;
function scheduleRender() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; render(); });
}
function render() {
    if (dirty) buildOffscreen();
    blit();
}
// Content changed: rebuild the offscreen next frame.
function invalidate() { dirty = true; scheduleRender(); }

// ── Palette helpers ──
function recolorPalette() {
    for (const [o, pe] of palette) {
        pe.rgb = overrides.has(o)
            ? overrides.get(o).slice()
            : rgbAt(state.L, state.C, pe.hue).rgb;
        pe.L = state.L; pe.C = state.C;
    }
    refreshSwatches();
}
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
function hexOf(rgb) {
    return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
}
function hexToRgb(hex) {
    return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
    ];
}
function refreshSwatches() {
    document.querySelectorAll(".pal-col").forEach((el) => {
        const pe = palette.get(+el.dataset.orbit);
        if (pe) el.value = hexOf(pe.rgb);
    });
}
function presentOrbits() {
    const codes = mapModel(state.seniority, state.order, state.h, state.v)
        .secCodes;
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
    const tag = state.seniority.isVertical ? "V" : "H";
    for (const o of presentOrbits()) {
        const pe = palette.get(o);
        const row = document.createElement("label");
        row.className = "pal-row";
        row.innerHTML =
            `<input type="checkbox" ${pe.enabled ? "checked" : ""} ` +
            `data-orbit="${o}" class="pal-on" />` +
            `<input type="color" value="${hexOf(pe.rgb)}" data-orbit="${o}" ` +
            `class="pal-col" />` +
            `<span class="pal-name">${tag}${pe.rep[0]}${pe.rep[1]}</span>`;
        host.appendChild(row);
    }
    host.querySelectorAll(".pal-on").forEach((el) =>
        el.addEventListener("change", () => {
            palette.get(+el.dataset.orbit).enabled = el.checked;
            invalidate();
        }));
    host.querySelectorAll(".pal-col").forEach((el) =>
        el.addEventListener("input", () => {
            const o = +el.dataset.orbit;
            const rgb = hexToRgb(el.value);
            palette.get(o).rgb = rgb;
            overrides.set(o, rgb);
            invalidate();
        }));
}

// ── Controls ──
function num(id) { return document.getElementById(id); }
function bindRange(id, key, fmtId, fmt = (x) => x) {
    const el = num(id);
    const out = fmtId ? num(fmtId) : null;
    el.addEventListener("input", () => {
        state[key] = parseFloat(el.value);
        if (out) out.textContent = fmt(state[key]);
        if (key === "L" || key === "C") recolorPalette();
        invalidate();
    });
    if (out) out.textContent = fmt(state[key]);
}

function init() {
    bindRange("base-alpha", "baseAlpha", "base-alpha-out", (x) => x.toFixed(2));
    bindRange("falloff", "falloff", "falloff-out", (x) => x.toFixed(2));
    bindRange("minpx", "minPx", "minpx-out", (x) => x.toFixed(0));
    bindRange("lightness", "L", "lightness-out", (x) => x.toFixed(2));
    bindRange("chroma", "C", "chroma-out", (x) => x.toFixed(2));
    bindRange("pat-density", "patternDensity", "pat-density-out",
        (x) => x.toFixed(0));
    bindRange("pat-width", "patternWidth", "pat-width-out", (x) => x.toFixed(1));
    bindRange("pat-alpha", "patternAlpha", "pat-alpha-out", (x) => x.toFixed(2));

    num("pattern-on").addEventListener("change", (e) => {
        state.patternOn = e.target.checked; invalidate();
    });
    num("pat-color").addEventListener("input", (e) => {
        state.patternColor = e.target.value; invalidate();
    });
    num("order").addEventListener("change", (e) => {
        state.order = parseInt(e.target.value, 10);
        buildPaletteUI();
        dirty = true; buildOffscreen(); fitView(); blit();
    });
    num("bg").addEventListener("change", (e) => {
        state.bg = e.target.value; invalidate();
    });
    ["h", "v"].forEach((k) =>
        num(k + "-input").addEventListener("change", (e) => {
            state[k] = parseInt(e.target.value, 10) || 1;
            buildPaletteUI();
            invalidate();
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
            invalidate();
        }));
    document.getElementById("reset-palette").addEventListener("click", () => {
        overrides.clear();
        regenPalette(true);
        invalidate();
    });
    num("fit").addEventListener("click", () => { fitView(); blit(); });

    // Pan (drag) + zoom (wheel).
    let dragging = false, lx = 0, ly = 0;
    canvas.addEventListener("pointerdown", (e) => {
        dragging = true; lx = e.clientX; ly = e.clientY;
        canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        state.panX += e.clientX - lx;
        state.panY += e.clientY - ly;
        lx = e.clientX; ly = e.clientY;
        blit();
    });
    canvas.addEventListener("pointerup", () => { dragging = false; });
    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
        const ix = (cx - state.panX) / state.zoom;
        const iy = (cy - state.panY) / state.zoom;
        const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        state.zoom = Math.max(0.05, Math.min(40, state.zoom * f));
        state.panX = cx - ix * state.zoom;
        state.panY = cy - iy * state.zoom;
        blit();
    }, { passive: false });

    window.addEventListener("resize", () => { sizeCanvas(); blit(); });

    buildPaletteUI();
    sizeCanvas();
    buildOffscreen();
    fitView();
    blit();
}

init();
