// planet-coyleus — terrains (page controller).
//
// DOM wiring, event handling, scheme IO. Imports the pure core and the
// renderer; holds the UI state (current orbit letter, current paint color).

import {
    LETTERS,
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
    cageClientRect,
    setTheme,
} from "./terrain-render.js";
import { oklchHex } from "../4d/src/oklch-ramps.js";

const SIZES = { focus: 220, sub: 88, trans: 80, bar: 6 };

const state = {
    letter: LETTERS[0],
    // cage cursor: a unit-square point {ux,uy} (the selected cage's centre). R,C
    // are derived per rung, so the selection keeps its spatial place across orders.
    cursor: null,
    // anonymous selection: a specific glyph {grid,d,r} with no map location
    // (shift-right-click a child in the editor). Takes precedence over cursor.
    member: null,
    color: null, // active paint hex; set from the loaded ramps (see loadRamps)
    curH: 1, // longitude anchor (0/1)
    curV: 1, // latitude anchor (0/1)
    seniorityH: false, // follows the current map rung
    light: true, // light theme is the default
};

// Cage cursor → (R,C) on a given rung (re-derives the row/col per order).
function cursorRC(rung) {
    return {
        R: Math.max(0, Math.min(rung.NSr - 1, Math.floor(state.cursor.uy * rung.NSr))),
        C: Math.max(0, Math.min(rung.NSc - 1, Math.floor(state.cursor.ux * rung.NSc))),
    };
}
// The orbit letter of the glyph currently under the cursor.
function letterAtCursor() {
    if (!state.cursor || !lastRung) return null;
    const { R, C } = cursorRC(lastRung);
    const [d, r] = lastRung.codes[R][C];
    return orbitLetterOf(lastRung.grid, d, r);
}

// The glyph shown in the editor: an anonymous member if set, else the cage under
// the cursor, else the orbit's rep.
function focusGlyphNow() {
    if (state.member) return state.member;
    if (state.cursor && lastRung) {
        const { R, C } = cursorRC(lastRung);
        const [d, r] = lastRung.codes[R][C];
        return { grid: lastRung.grid, d, r };
    }
    return focusGlyph(state.letter, state.seniorityH);
}

// ── quadrant view: centre (cx,cy) in unit-square [0,1]², z = px per unit ──
const view = { cx: 0.5, cy: 0.5, z: 640 };
const TARGET = 42; // aimed-for section size (px) — picks the LOD rung
let curK = -1; // the DISPLAYED ladder rung (decoupled from raw zoom by the clutch)
let renderedK = -1; // last rung the panels were built for (change detection)
let lastRoundL = null; // last rounded ladder position (for the shift clutch)
let hover = null; // { grid, d, r, R, C, idx } under the cursor
let lastRung = null; // last rendered rung data (for hit-testing)

// Shift-clutch slack, in rungs (one order = 2 rungs). Bigger when zooming IN, so
// you can magnify a rung a lot (esp. the skinny H glyphs) before it re-tiles.
const LEASH_IN = 4; // zoom-in: two full orders of over-zoom
const LEASH_OUT = 3; // zoom-out: 1.5 orders
const clampK = (k) => Math.max(0, Math.min(LADDER_RUNGS - 1, k));

// Continuous ladder position from zoom (section area halves each half-step).
function ladderPos() {
    return 2 * Math.log2(view.z / TARGET) - 4;
}
function zoomForRung(k) {
    return TARGET * 2 ** ((k + 4) / 2);
}

// Update the displayed rung after a zoom. Without shift it snaps to the zoom,
// re-syncing whenever a normal threshold is crossed. With shift the rung is held
// — it lags the zoom on a one-order leash, sticky both ways — and that offset
// persists until a no-shift threshold crossing corrects it.
function updateRung(shiftHeld) {
    const L = ladderPos();
    const roundL = Math.round(L);
    if (lastRoundL == null) {
        curK = clampK(roundL);
    } else if (shiftHeld) {
        if (L > curK + LEASH_IN) curK = clampK(Math.round(L - LEASH_IN));
        else if (L < curK - LEASH_OUT) curK = clampK(Math.round(L + LEASH_OUT));
        // else hold the rung — the clutch slips
    } else if (roundL !== lastRoundL) {
        curK = clampK(roundL); // crossed a normal threshold → re-sync
    }
    lastRoundL = roundL;
}
// Jump the rung to k at its ideal zoom (Order / Sen buttons).
function jumpToRung(k) {
    curK = clampK(k);
    view.z = zoomForRung(curK);
    lastRoundL = Math.round(ladderPos());
}

// Apply the active theme to both the CSS chrome (body class) and the canvas
// neutrals (terrain-render). Caller redraws afterward.
function applyTheme() {
    document.body.classList.toggle("dark", !state.light);
    setTheme(state.light);
}

// ── floating editor panel: position / drag / collapse / persist ──
const EDITOR_KEY = "planet-coyleus.editor";
const editor = (() => {
    let saved = {};
    try {
        saved = JSON.parse(localStorage.getItem(EDITOR_KEY)) || {};
    } catch (e) {
        /* no storage */
    }
    return Object.assign({ x: null, y: null, collapsed: false }, saved);
})();
function saveEditor() {
    try {
        localStorage.setItem(EDITOR_KEY, JSON.stringify(editor));
    } catch (e) {
        /* no storage */
    }
}
function clampEditor() {
    editor.x = Math.max(4, Math.min((window.innerWidth || 1200) - 60, editor.x));
    editor.y = Math.max(4, Math.min((window.innerHeight || 800) - 40, editor.y));
}
function placeEditor() {
    const p = $("editor-panel");
    if (editor.x == null) {
        editor.x = Math.max(20, (window.innerWidth || 1200) - 440);
        editor.y = 96;
    }
    clampEditor();
    p.style.left = editor.x + "px";
    p.style.top = editor.y + "px";
    p.classList.toggle("collapsed", editor.collapsed);
    $("editor-collapse").textContent = editor.collapsed ? "▸" : "▾";
}
function showEditor() {
    $("editor-panel").hidden = false;
    placeEditor();
}
function bindEditor() {
    const bar = $("editor-bar");
    let d = null;
    bar.addEventListener("mousedown", (e) => {
        if (e.target.closest && e.target.closest("button")) return;
        d = { x: e.clientX, y: e.clientY, ex: editor.x, ey: editor.y };
        e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
        if (!d) return;
        editor.x = d.ex + (e.clientX - d.x);
        editor.y = d.ey + (e.clientY - d.y);
        clampEditor();
        const p = $("editor-panel");
        p.style.left = editor.x + "px";
        p.style.top = editor.y + "px";
    });
    window.addEventListener("mouseup", () => {
        if (d) {
            d = null;
            saveEditor();
        }
    });
    $("editor-collapse").addEventListener("click", () => {
        editor.collapsed = !editor.collapsed;
        $("editor-panel").classList.toggle("collapsed", editor.collapsed);
        $("editor-collapse").textContent = editor.collapsed ? "▸" : "▾";
        saveEditor();
    });
    $("editor-close").addEventListener("click", () => {
        $("editor-panel").hidden = true;
    });
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
function bindPaint(canvas, hit, onSelect) {
    canvas.addEventListener("mousedown", (e) => {
        if (e.button !== 0 && e.button !== 2) return;
        if (e.shiftKey && e.button === 2 && onSelect) {
            const h = hit(e); // shift-right-click = select this glyph to edit
            if (h) onSelect(h);
            return;
        }
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

// Make a glyph the editor focus with no map location (anonymous).
function selectMember(grid, d, r) {
    state.member = { grid, d, r };
    state.cursor = null;
    const L = orbitLetterOf(grid, d, r);
    if (L) state.letter = L;
    redraw();
}

// Eyedropper: adopt the clicked cell's color as the paint color. An empty cell
// has no color to pick, so leave the current one (don't silently arm erase).
function pickColor(h) {
    const c = cellsFor(h.grid, h.d, h.r)[h.idx];
    if (!c) return;
    state.color = c;
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
            state.cursor = null; // orbit chosen from the palette → show its rep
            state.member = null;
            showEditor();
            redraw();
        });
        box.appendChild(wrap);
    }
}

// ── color ramps (loaded from terrain-ramps.json) ──
// `palettes` is the full set of named swatch books; `activePalette` is the one
// the tray currently shows. A ramp's stored OKLCH (hue + per-stop [L,C]) is
// resolved to hex here — the controller owns this since core stays fetch-free.
let palettes = [];
let activePalette = null;

// Remember the chosen palette across reloads.
const PALETTE_KEY = "planet-coyleus.palette";
function savedPaletteId() {
    try {
        return localStorage.getItem(PALETTE_KEY);
    } catch (e) {
        return null;
    }
}

const hexOf = (n) => "#" + (n & 0xffffff).toString(16).padStart(6, "0");
function buildRamp(spec) {
    return {
        name: spec.name,
        hue: spec.hue,
        stops: Object.entries(spec.stops).map(([label, [L, C]]) => ({
            label,
            hex: hexOf(oklchHex(L, C, spec.hue)),
        })),
    };
}

// A single neutral ramp, used only if terrain-ramps.json fails to load so the
// page still paints.
const FALLBACK_PALETTE = {
    id: "grey",
    label: "Grey",
    ramps: [buildRamp({ name: "grey", hue: 250, stops: { dark: [0.35, 0.01], mid: [0.55, 0.01], light: [0.75, 0.01], pale: [0.9, 0.01] } })],
};

async function loadRamps() {
    try {
        const res = await fetch("./terrain-ramps.json");
        const data = await res.json();
        palettes = data.palettes.map((p) => ({
            id: p.id,
            label: p.label,
            ramps: p.ramps.map(buildRamp),
        }));
    } catch (err) {
        console.warn("terrain-ramps.json failed to load:", err);
        palettes = [FALLBACK_PALETTE];
    }
    const remembered = savedPaletteId();
    activePalette = palettes.find((p) => p.id === remembered) || palettes[0];
    // start on a mid stop of the active palette's first ramp
    const r0 = activePalette.ramps[0];
    state.color = r0.stops[Math.min(2, r0.stops.length - 1)].hex;
}

// Switch the visible swatch book. Painted cells keep their stored hex — this
// only changes which swatches the tray offers, not the map.
function setPalette(id) {
    const p = palettes.find((q) => q.id === id);
    if (!p || p === activePalette) return;
    activePalette = p;
    try {
        localStorage.setItem(PALETTE_KEY, p.id);
    } catch (e) {
        /* no storage */
    }
    buildColors();
    markColor();
}

// ── sidebar: color tray ──
function buildColors() {
    const box = $("colors");
    box.innerHTML = "";
    if (palettes.length > 1) {
        const switcher = el("div", "pal-switch");
        for (const p of palettes) {
            const b = el("button", "chip act");
            b.textContent = p.label;
            b.classList.toggle("on", p === activePalette);
            b.addEventListener("click", () => setPalette(p.id));
            switcher.appendChild(b);
        }
        box.appendChild(switcher);
    }
    for (const terrain of activePalette.ramps) {
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
        if (chip.closest(".pal-switch")) return; // palette toggles own their .on
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
        // Seniority is the V/H ladder: toggling jumps to the sibling rung
        // (V_n ↔ H_n at the same order).
        mk("senBtn", () => {
            jumpToRung(curK ^ 1);
            clampView();
            redraw();
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
    const lab = (sym, val) =>
        `<span class="osym">${sym}</span><span class="oval">${val}</span>`;
    $("longBtn").innerHTML = lab("↔", state.curH);
    $("latBtn").innerHTML = lab("↕", state.curV);
    $("senBtn").innerHTML = lab("⤢", state.seniorityH ? "H" : "V");
    // The quadrant label's letter order (SE vs ES) already encodes seniority, so
    // no redundant "· H/V".
    $("orientLabel").textContent = quadrantLabel();
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
            jumpToRung(k);
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
    // heading: tag · code · order/seniority · [cage row : col] — or "—" if the
    // focus is an anonymous member (shift-right-clicked child, no map location).
    let head = `${tag} ${f.grid}${f.d}${f.r}`;
    if (state.member) {
        head += " —";
    } else {
        head += ` ${rungLabel(curK < 0 ? 0 : curK)}`;
        if (state.cursor && lastRung) {
            const { R, C } = cursorRC(lastRung);
            head += ` [r${R}:c${C}]`;
        }
    }
    $("focus-label").textContent = head;
    const fH = f.grid === "H"; // titles follow the focus glyph's own seniority
    $("subs-h2").textContent = fH ? "h→2v" : "v→2h";
    $("trans-h2").textContent = fH ? "h→4h" : "v→4v";

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
    bindPaint(
        canvas,
        (e) => compositeHit(canvas, layout, e),
        (h) => selectMember(h.grid, h.d, h.r),
    );
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
    const r = rungAt(curK);
    if (curK !== renderedK) {
        renderedK = curK;
        state.seniorityH = r.seniorityH;
        // update lastRung to the new rung first, so the cursor re-derives its
        // (R,C) on the new order and the panels read the right glyph.
        lastRung = rungMap(r.order, r.seniorityH, state.curH, state.curV);
        if (state.cursor) state.letter = letterAtCursor() || state.letter;
        refreshPanels();
        syncOrient();
        syncOrder();
    }
    return r;
}

function renderMap() {
    const r = syncRung();
    lastRung = rungMap(r.order, r.seniorityH, state.curH, state.curV);
    const sel = state.cursor ? cursorRC(lastRung) : null;
    drawQuadrant($("quadrant"), lastRung, view, hover, sel);
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
    view.z = Math.max(
        zoomForRung(-LEASH_OUT),
        Math.min(zoomForRung(LADDER_RUNGS - 1 + LEASH_IN), view.z),
    );
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
        // Shift can remap the wheel to the X axis (macOS), so take whichever
        // axis carries the scroll — otherwise shift+wheel never zooms.
        const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
        view.z *= Math.exp(-delta * 0.0016);
        clampZoom();
        updateRung(e.shiftKey); // shift slips the clutch (rung lags the zoom)
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
            if (h) selectCage(h);
        }
        drag = null;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
}

// Move the cage cursor to (R,C): loads that glyph into the editor, keeps it
// on-screen, and re-places the floating panel relative to the cage.
function setCursorRC(R, C) {
    if (!lastRung) return;
    state.member = null; // a map selection drops any anonymous one
    R = Math.max(0, Math.min(lastRung.NSr - 1, R));
    C = Math.max(0, Math.min(lastRung.NSc - 1, C));
    state.cursor = { ux: (C + 0.5) / lastRung.NSc, uy: (R + 0.5) / lastRung.NSr };
    const L = letterAtCursor();
    if (L) state.letter = L;
    ensureCageVisible(R, C);
    showEditor();
    placePanelForCage(R, C);
    redraw();
}
function selectCage(h) {
    setCursorRC(h.R, h.C);
}
function moveCursor(dR, dC) {
    if (!state.cursor || !lastRung) return;
    const { R, C } = cursorRC(lastRung);
    const nR = R + dR;
    const nC = C + dC;
    // Scrolling past the origin-side (zero) edge flips the quadrant: past row 0
    // flips latitude (N↔S), past col 0 flips longitude (E↔W). The cursor lands on
    // the zero edge of the new quadrant, keeping its other coordinate. Far edges
    // just clamp.
    if (nR < 0) {
        flipQuadrant("v");
        setCursorRC(0, nC);
    } else if (nC < 0) {
        flipQuadrant("h");
        setCursorRC(nR, 0);
    } else {
        setCursorRC(nR, nC);
    }
}

// Flip the quadrant anchor on one axis and rebuild the map for it.
function flipQuadrant(axis) {
    if (axis === "v") state.curV ^= 1;
    else state.curH ^= 1;
    const r = rungAt(curK);
    lastRung = rungMap(r.order, r.seniorityH, state.curH, state.curV);
    syncOrient();
}

// Pan just enough to keep the selected cage on-screen (one-cage margin).
function ensureCageVisible(R, C) {
    const canvas = $("quadrant");
    const ux = (C + 0.5) / lastRung.NSc;
    const uy = (R + 0.5) / lastRung.NSr;
    const halfW = canvas.width / 2 / view.z;
    const halfH = canvas.height / 2 / view.z;
    const mx = 1 / lastRung.NSc;
    const my = 1 / lastRung.NSr;
    if (ux < view.cx - halfW + mx) view.cx = ux + halfW - mx;
    else if (ux > view.cx + halfW - mx) view.cx = ux - halfW + mx;
    if (uy < view.cy - halfH + my) view.cy = uy + halfH - my;
    else if (uy > view.cy + halfH - my) view.cy = uy - halfH + my;
    clampView();
}

// Keep the panel out of the selected cage's way. Only nudge it when the cage's
// closest-corner distance is under 2 cages (Pythagoras), and then just enough to
// restore that clearance along ONE axis, away from the cage (never closer),
// preferring to slide right.
function placePanelForCage(R, C) {
    const p = $("editor-panel");
    const cr = cageClientRect($("quadrant"), lastRung, view, R, C);
    if (!cr) return;
    const cageW = cr.width;
    const cageH = cr.height;
    if (p.hidden) {
        editor.x = cr.left + cageW; // first appearance: down-right of the cage
        editor.y = cr.top + 2 * cageH;
    } else {
        const b = p.getBoundingClientRect();
        const clear = cageW + cageH; // ≈ 2 cages
        const sepX = Math.max(0, cr.left - b.right, b.left - cr.right);
        const sepY = Math.max(0, cr.top - b.bottom, b.top - cr.bottom);
        if (Math.hypot(sepX, sepY) < clear) {
            const dirX = (cr.left + cr.right) / 2 <= (b.left + b.right) / 2 ? 1 : -1;
            const dirY = (cr.top + cr.bottom) / 2 <= (b.top + b.bottom) / 2 ? 1 : -1;
            const needX = Math.sqrt(Math.max(0, clear * clear - sepY * sepY)) - sepX;
            const needY = Math.sqrt(Math.max(0, clear * clear - sepX * sepX)) - sepY;
            if (dirX === 1) {
                editor.x += needX; // slide right (natural)
            } else if (needY <= needX) {
                editor.y += dirY * needY;
            } else {
                editor.x += dirX * needX;
            }
        }
    }
    clampEditor();
    p.style.left = editor.x + "px";
    p.style.top = editor.y + "px";
    saveEditor();
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

export async function init() {
    await loadRamps(); // ramps drive the color tray + initial paint color
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
    bindEditor();
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
            return;
        }
        const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(
            (e.target && e.target.tagName) || "",
        );
        if (inField || !state.cursor) return;
        const moves = {
            ArrowUp: [-1, 0],
            ArrowDown: [1, 0],
            ArrowLeft: [0, -1],
            ArrowRight: [0, 1],
        };
        if (moves[e.key]) {
            e.preventDefault();
            moveCursor(moves[e.key][0], moves[e.key][1]);
        }
    });
    markColor();
    clampView();
    updateRung(false); // seed the displayed rung from the initial zoom
    redraw();
    showEditor(); // panel visible from the start at its remembered position
}
