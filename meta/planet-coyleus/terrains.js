// planet-coyleus — terrains (page controller).
//
// DOM wiring, event handling, scheme IO. Imports the pure core and the
// renderer; holds the UI state (current orbit letter, current paint color).

import {
    LETTERS,
    TERRAINS,
    cellsFor,
    focusGlyph,
    letterTag,
    orbitLetterOf,
    substitutionOf,
    translationOf,
    rungMap,
    rungAt,
    rungLabel,
    LADDER_RUNGS,
    paintCell,
    undo,
    serialize,
    loadScheme,
} from "./terrain-core.js";
import {
    renderGlyph,
    drawComposite,
    compositeHit,
    compositeSize,
    drawQuadrant,
    quadrantHit,
    setTheme,
} from "./terrain-render.js";

const SIZES = { focus: 300, sub: 100, trans: 88, bar: 7 };

const state = {
    letter: LETTERS[0],
    member: null, // a specific glyph {grid,d,r} selected on the map (else the rep)
    color: TERRAINS[0].stops[2].hex, // a mid water stop to start
    curH: 1, // longitude anchor (0/1)
    curV: 1, // latitude anchor (0/1)
    seniorityH: false, // follows the current map rung
    light: true, // light theme is the default
};

// The glyph shown in the focus editor: the map-selected member if it matches the
// active seniority, else the current orbit's rep.
function focusGlyphNow() {
    const g = state.seniorityH ? "H" : "V";
    if (state.member && state.member.grid === g) return state.member;
    return focusGlyph(state.letter, state.seniorityH);
}

// ── quadrant view: centre (cx,cy) in unit-square [0,1]², z = px per unit ──
const view = { cx: 0.5, cy: 0.5, z: 640 };
const TARGET = 42; // aimed-for section size (px) — picks the LOD rung
let curK = -1; // current ladder rung index (so seniority changes are detected)
let hover = null; // { grid, d, r, R, C, idx } under the cursor
let lastRung = null; // last rendered rung data (for hit-testing)

// Section area halves each half-step (one axis doubles), so the rung index is
// ~2·log2(z/TARGET) − 4; inverse jumps the zoom onto a given rung.
function rungForZoom(z) {
    return Math.max(0, Math.min(LADDER_RUNGS - 1, Math.round(2 * Math.log2(z / TARGET) - 4)));
}
function zoomForRung(k) {
    return TARGET * 2 ** ((k + 4) / 2);
}

// Apply the active theme to both the CSS chrome (body class) and the canvas
// neutrals (terrain-render). Caller redraws afterward.
function applyTheme() {
    document.body.classList.toggle("dark", !state.light);
    setTheme(state.light);
}

const $ = (id) => document.getElementById(id);
const el = (tag, cls) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
};

// A glyph canvas click → 4×4 cell index (row-major), or null if outside.
function cellIndexFromEvent(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;
    const cs = canvas.width / 4;
    return Math.min(3, Math.floor(y / cs)) * 4 + Math.min(3, Math.floor(x / cs));
}

// ── paint-by-drag: hold to paint many cells (left) / erase (right) ──
// `hit(e)` returns { grid, d, r, idx } or null for the canvas it's bound to.
let painting = null; // { hit, erase, lastKey }
function bindPaint(canvas, hit) {
    canvas.addEventListener("mousedown", (e) => {
        if (e.button !== 0 && e.button !== 2) return;
        if (e.shiftKey && e.button === 0) {
            const h = hit(e); // shift-click = eyedropper
            if (h) pickColor(h);
            return;
        }
        painting = { hit, erase: e.button === 2, lastKey: "" };
        paintMove(e);
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
}

// Eyedropper: adopt the clicked cell's current color as the paint color (null →
// the erase tool).
function pickColor(h) {
    state.color = cellsFor(h.grid, h.d, h.r)[h.idx] || null;
    markColor();
}
function paintMove(e) {
    if (!painting) return;
    const h = painting.hit(e);
    if (!h) return;
    const key = `${h.grid}${h.d}${h.r}:${h.idx}`;
    if (key === painting.lastKey) return; // same cell — skip
    painting.lastKey = key;
    paintCell(h.grid, h.d, h.r, h.idx, painting.erase ? null : state.color);
    repaint();
}

function makeGlyphCanvas(size, grid, d, r, editable) {
    const c = el("canvas", "glyph");
    c.width = c.height = size;
    c.style.width = c.style.height = size + "px";
    c.dataset.grid = grid;
    c.dataset.d = d;
    c.dataset.r = r;
    if (editable)
        bindPaint(c, (e) => {
            const idx = cellIndexFromEvent(c, e);
            return idx == null ? null : { grid, d, r, idx };
        });
    return c;
}

// ── sidebar: glyph palette ──
function buildPalette() {
    const box = $("palette");
    box.innerHTML = "";
    for (const letter of LETTERS) {
        const { grid, d, r } = focusGlyph(letter);
        const wrap = el("div", "swatch");
        wrap.dataset.letter = letter;
        const c = makeGlyphCanvas(46, grid, d, r, null);
        const tag = el("span", "swatch-tag");
        tag.textContent = letter;
        wrap.append(c, tag);
        wrap.addEventListener("click", () => {
            state.letter = letter;
            state.member = null; // orbit chosen → show its rep
            redraw();
        });
        box.appendChild(wrap);
    }
}

// ── sidebar: color tray ──
function buildColors() {
    const box = $("colors");
    box.innerHTML = "";
    for (const terrain of TERRAINS) {
        const row = el("div", "ramp");
        const label = el("span", "ramp-name");
        label.textContent = terrain.name;
        row.appendChild(label);
        const strip = el("div", "ramp-strip");
        for (const stop of terrain.stops) {
            const chip = el("button", "chip");
            chip.style.background = stop.hex;
            chip.title = terrain.name + " · " + stop.label + " " + stop.hex;
            chip.dataset.hex = stop.hex;
            chip.addEventListener("click", () => {
                state.color = stop.hex;
                markColor();
            });
            strip.appendChild(chip);
        }
        row.appendChild(strip);
        box.appendChild(row);
    }
    const actions = el("div", "actions");
    const erase = el("button", "chip act erase");
    erase.textContent = "erase";
    erase.dataset.hex = "";
    erase.addEventListener("click", () => {
        state.color = null;
        markColor();
    });
    const undoBtn = el("button", "chip act");
    undoBtn.textContent = "undo";
    undoBtn.addEventListener("click", () => {
        if (undo()) redraw();
    });
    actions.append(erase, undoBtn);
    box.appendChild(actions);
}

function markColor() {
    document.querySelectorAll("#colors .chip").forEach((chip) => {
        const sel =
            (state.color === null && chip.classList.contains("erase")) ||
            chip.dataset.hex === state.color;
        chip.classList.toggle("on", sel);
    });
}

// ── sidebar: orientation (the quadrant anchor; seniority is the ladder) ──
function buildOrient() {
    const box = $("orient");
    box.innerHTML = "";
    const mk = (id, onClick) => {
        const b = el("button", "orient-btn");
        b.id = id;
        b.addEventListener("click", onClick);
        return b;
    };
    const btns = el("div", "orient-btns");
    btns.append(
        mk("longBtn", () => {
            state.curH ^= 1;
            orientChanged();
        }),
        mk("latBtn", () => {
            state.curV ^= 1;
            orientChanged();
        }),
    );
    const label = el("div", "orient-label");
    label.id = "orientLabel";
    box.append(btns, label);
    syncOrient();
}

function quadrantLabel() {
    const ns = state.curV === 1 ? "S" : "N";
    const ew = state.curH === 1 ? "E" : "W";
    return state.seniorityH ? ew + ns : ns + ew;
}

function syncOrient() {
    $("longBtn").textContent = `Long ${state.curH}`;
    $("latBtn").textContent = `Lat ${state.curV}`;
    $("orientLabel").textContent = `${quadrantLabel()} · ${
        state.seniorityH ? "H" : "V"
    }`;
}

// Quadrant anchor changed: relabel and re-render the map (relatives unaffected).
function orientChanged() {
    syncOrient();
    redraw();
}

// ── sidebar: order — the V/H ladder; clicking a rung jumps the zoom there ──
function buildOrder() {
    const box = $("order");
    box.innerHTML = "";
    for (let k = 0; k < LADDER_RUNGS; k++) {
        const b = el("button", "rung-btn");
        b.dataset.k = k;
        b.textContent = rungLabel(k);
        b.addEventListener("click", () => {
            view.z = zoomForRung(k);
            clampView();
            redraw();
        });
        box.appendChild(b);
    }
}
function syncOrder() {
    document.querySelectorAll("#order .rung-btn").forEach((b) => {
        b.classList.toggle("on", +b.dataset.k === curK);
    });
}

// ── main panels ──
function subLayout(f) {
    const m = substitutionOf(f.grid, f.d, f.r);
    if (m.layout === "tb")
        return {
            rows: 2,
            cols: 1,
            glyphPx: SIZES.sub,
            barPx: SIZES.bar,
            children: m.pair,
            bars: { barH: m.bar },
        };
    return {
        rows: 1,
        cols: 2,
        glyphPx: SIZES.sub,
        barPx: SIZES.bar,
        children: m.pair,
        bars: { barV: m.bar },
    };
}
function transLayout(f) {
    const m = translationOf(f.grid, f.d, f.r);
    return {
        rows: 2,
        cols: 2,
        glyphPx: SIZES.trans,
        barPx: SIZES.bar,
        children: m.children,
        bars: m.bars,
    };
}

// Current editor canvases + layouts, kept so a paint-drag can re-render them in
// place (no DOM rebuild, which would detach the canvas mid-drag).
let focusCanvas = null;
let subsCanvas = null;
let transCanvas = null;
let focusCur = null;
let tagCur = "";
let subsLayoutCur = null;
let transLayoutCur = null;

function rebuildPanels() {
    const f = focusGlyphNow();
    // Letter + operation as it appears on the V/H grids (0123/\-| ops).
    const tag = letterTag(f.grid, f.d, f.r) || state.letter;
    focusCur = f;
    tagCur = tag;
    const fc = makeGlyphCanvas(SIZES.focus, f.grid, f.d, f.r, true);
    const fbox = $("focus");
    fbox.innerHTML = "";
    fbox.appendChild(fc);
    focusCanvas = fc;
    renderGlyph(fc, f.grid, f.d, f.r, tag);
    $("focus-label").textContent = `${tag} · ${f.grid}${f.d}${f.r}`;
    $("subs-h2").textContent = state.seniorityH
        ? "Substitution · h→v (top / bottom)"
        : "Substitution · v→h (left | right)";
    $("trans-h2").textContent = "Translation · 4→1 (square + bars)";

    subsLayoutCur = subLayout(f);
    transLayoutCur = transLayout(f);
    subsCanvas = buildComposite("subs", subsLayoutCur);
    transCanvas = buildComposite("trans", transLayoutCur);
}

// A composite relative (substitution pair / translation square) in one canvas,
// with cage-wall bars and per-child cell hit-testing. Returns the canvas.
function buildComposite(boxId, layout) {
    const { w, h } = compositeSize(layout);
    const canvas = el("canvas", "glyph");
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    bindPaint(canvas, (e) => compositeHit(canvas, layout, e));
    const box = $(boxId);
    box.innerHTML = "";
    box.appendChild(canvas);
    drawComposite(canvas, layout);
    return canvas;
}

// Re-render the editor canvases + palette swatches + map in place (used during a
// paint-drag, so the canvases the drag is bound to are not recreated).
function repaint() {
    if (focusCanvas && focusCur)
        renderGlyph(focusCanvas, focusCur.grid, focusCur.d, focusCur.r, tagCur);
    if (subsCanvas) drawComposite(subsCanvas, subsLayoutCur);
    if (transCanvas) drawComposite(transCanvas, transLayoutCur);
    document.querySelectorAll("#palette .swatch").forEach((s) => {
        const g = focusGlyph(s.dataset.letter, state.seniorityH);
        renderGlyph(s.querySelector("canvas"), g.grid, g.d, g.r);
    });
    renderMap();
}

// Palette swatches + focus/relatives, in the active seniority.
function refreshPanels() {
    document.querySelectorAll("#palette .swatch").forEach((s) => {
        s.classList.toggle("on", s.dataset.letter === state.letter);
        const g = focusGlyph(s.dataset.letter, state.seniorityH);
        renderGlyph(s.querySelector("canvas"), g.grid, g.d, g.r);
    });
    rebuildPanels();
}

// Resolve the current rung from the zoom; if it changed, the seniority flips —
// update the panels (focus/relatives/palette all follow the rung).
function syncRung() {
    const r = rungAt(rungForZoom(view.z));
    if (r.k !== curK) {
        curK = r.k;
        state.seniorityH = r.seniorityH;
        state.member = null; // map context changed → drop the specific selection
        refreshPanels();
        syncOrient();
        syncOrder();
    }
    return r;
}

function renderMap() {
    const r = syncRung();
    lastRung = rungMap(r.order, r.seniorityH, state.curH, state.curV);
    drawQuadrant($("quadrant"), lastRung, view, hover);
    const tag = hover ? letterTag(hover.grid, hover.d, hover.r) : null;
    $("map-hud").textContent =
        `rung ${rungLabel(r.k)} · ${lastRung.NSr}×${lastRung.NSc} glyphs · ` +
        quadrantLabel() +
        (hover ? ` · ${tag || "·"} (${hover.grid}${hover.d}${hover.r})` : "");
}

// Full refresh (after paint / orbit select / theme / quadrant change).
function redraw() {
    refreshPanels();
    renderMap();
}

function clampZoom() {
    view.z = Math.max(zoomForRung(0), Math.min(zoomForRung(LADDER_RUNGS - 1) * 1.5, view.z));
}
function clampView() {
    clampZoom();
    const canvas = $("quadrant");
    const hw = canvas.width / 2 / view.z;
    const hh = canvas.height / 2 / view.z;
    view.cx = 2 * hw >= 1 ? 0.5 : Math.max(hw, Math.min(1 - hw, view.cx));
    view.cy = 2 * hh >= 1 ? 0.5 : Math.max(hh, Math.min(1 - hh, view.cy));
}

// Coalesce hover/pan renders to one per frame.
const raf =
    typeof requestAnimationFrame !== "undefined"
        ? requestAnimationFrame
        : (f) => f();
let rafPending = false;
function scheduleMap() {
    if (rafPending) return;
    rafPending = true;
    raf(() => {
        rafPending = false;
        renderMap();
    });
}

// ── quadrant interaction: wheel zoom, drag pan, hover, click/right-click paint ──
let drag = null;
function bindQuadrant() {
    const canvas = $("quadrant");
    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
        const my = (e.clientY - rect.top) * (canvas.height / rect.height);
        const uxAt = view.cx + (mx - canvas.width / 2) / view.z;
        const uyAt = view.cy + (my - canvas.height / 2) / view.z;
        view.z *= Math.exp(-e.deltaY * 0.0016);
        clampZoom();
        view.cx = uxAt - (mx - canvas.width / 2) / view.z;
        view.cy = uyAt - (my - canvas.height / 2) / view.z;
        clampView();
        scheduleMap();
    }, { passive: false });

    canvas.addEventListener("mousedown", (e) => {
        if (e.button === 2) return;
        drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy, moved: false };
    });
    const hoverKey = (h) => (h ? `${h.R},${h.C},${h.idx}` : "");
    window.addEventListener("mousemove", (e) => {
        const prev = hoverKey(hover);
        if (lastRung) hover = quadrantHit(canvas, lastRung, view, e);
        if (drag) {
            const rect = canvas.getBoundingClientRect();
            const sc = canvas.width / rect.width;
            view.cx = drag.cx - ((e.clientX - drag.x) * sc) / view.z;
            view.cy = drag.cy - ((e.clientY - drag.y) * sc) / view.z;
            if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 3)
                drag.moved = true;
            clampView();
            scheduleMap();
        } else if (hoverKey(hover) !== prev) {
            scheduleMap(); // only re-render when the hovered section changes
        }
    });
    window.addEventListener("mouseup", (e) => {
        if (drag && !drag.moved && lastRung) {
            const h = quadrantHit(canvas, lastRung, view, e);
            if (h) selectGlyph(h.grid, h.d, h.r); // select, don't paint
        }
        drag = null;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
}

// Clicking the map loads that glyph into the editor (its oriented pattern + name
// + children); painting happens there, and every instance updates via redraw.
function selectGlyph(grid, d, r) {
    state.member = { grid, d, r };
    const L = orbitLetterOf(grid, d, r);
    if (L) state.letter = L;
    redraw();
}

// ── IO ──
function buildIO() {
    $("save").addEventListener("click", () => {
        const name = $("scheme-name").value.trim() || "scheme";
        const blob = new Blob([JSON.stringify(serialize(name), null, 2)], {
            type: "application/json",
        });
        const a = el("a");
        a.href = URL.createObjectURL(blob);
        a.download = name + ".json";
        a.click();
        URL.revokeObjectURL(a.href);
    });
    $("load").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                loadScheme(data);
                if (data.name) $("scheme-name").value = data.name;
                redraw();
            } catch (err) {
                console.error("bad scheme file", err);
            }
        };
        reader.readAsText(file);
    });
    $("clear-all").addEventListener("click", () => {
        loadScheme(null);
        redraw();
    });
}

export function init() {
    const themeToggle = $("theme-toggle");
    themeToggle.checked = !state.light; // checked = dark
    themeToggle.addEventListener("change", () => {
        state.light = !themeToggle.checked;
        applyTheme();
        redraw();
    });
    applyTheme();

    buildPalette();
    buildColors();
    buildOrient();
    buildOrder();
    buildIO();
    bindQuadrant();
    // paint-drag across the editor canvases
    window.addEventListener("mousemove", (e) => {
        if (painting) paintMove(e);
    });
    window.addEventListener("mouseup", () => {
        painting = null;
    });
    window.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "z") {
            e.preventDefault();
            if (undo()) redraw();
        }
    });
    markColor();
    clampView();
    redraw();
}
