// planet-coyleus — terrains (page controller).
//
// DOM wiring, event handling, scheme IO. Imports the pure core and the
// renderer; holds the UI state (current orbit letter, current paint color).

import {
    LETTERS,
    TERRAINS,
    focusGlyph,
    substitutionOf,
    translationOf,
    mapPatch,
    paintCell,
    undo,
    serialize,
    loadScheme,
} from "./terrain-core.js";
import {
    renderGlyph,
    renderPatch,
    drawComposite,
    compositeHit,
    compositeSize,
    setTheme,
} from "./terrain-render.js";

// Two map orders side by side — the same region one cage level apart.
const MAP_ORDERS = [6, 7];
const MAP_IDS = ["patch", "patch2"];
const SIZES = { focus: 300, sub: 100, trans: 88, bar: 7 };

const state = {
    letter: LETTERS[0],
    color: TERRAINS[0].stops[2].hex, // a mid water stop to start
    curH: 1, // longitude anchor (0/1)
    curV: 1, // latitude anchor (0/1)
    seniorityH: false, // false = V, true = H
    light: true, // light theme is the default
};

// Apply the active theme to both the CSS chrome (body class) and the canvas
// neutrals (terrain-render). Caller redraws afterward.
function applyTheme() {
    document.body.classList.toggle("dark", !state.light);
    setTheme(state.light);
}

// Maps depend on the orientation; recompute on any anchor/seniority change.
let maps = [];
function rebuildMaps() {
    maps = MAP_ORDERS.map((order, i) => ({
        id: MAP_IDS[i],
        order,
        patch: mapPatch(order, state.seniorityH, state.curH, state.curV),
    }));
}

const $ = (id) => document.getElementById(id);
const el = (tag, cls) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
};

// Map a click on a glyph canvas to a 4×4 cell index (row-major).
function cellIndexFromEvent(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;
    const cs = canvas.width / 4;
    const j = Math.min(3, Math.max(0, Math.floor(x / cs)));
    const i = Math.min(3, Math.max(0, Math.floor(y / cs)));
    return i * 4 + j;
}

function makeGlyphCanvas(size, grid, d, r, onClick) {
    const c = el("canvas", "glyph");
    c.width = c.height = size;
    c.style.width = c.style.height = size + "px";
    c.dataset.grid = grid;
    c.dataset.d = d;
    c.dataset.r = r;
    if (onClick) {
        c.addEventListener("mousedown", (e) => {
            if (e.button === 2) return; // right-click handled below
            onClick(grid, d, r, cellIndexFromEvent(c, e), false);
        });
        c.addEventListener("contextmenu", (e) => {
            e.preventDefault(); // right-click erases the cell
            onClick(grid, d, r, cellIndexFromEvent(c, e), true);
        });
    }
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

// ── sidebar: orientation (anchor lat/long + seniority), like coylean-globe ──
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
        mk("senBtn", () => {
            state.seniorityH = !state.seniorityH;
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
    $("senBtn").textContent = `Sen ${state.seniorityH ? "H" : "V"}`;
    $("orientLabel").textContent = `${quadrantLabel()} · ${
        state.seniorityH ? "H" : "V"
    } seniority`;
}

// Anchor or seniority changed: relabel, rebuild the maps, redraw everything.
function orientChanged() {
    syncOrient();
    rebuildMaps();
    redraw();
}

// ── main panels ──
function subLayout(letter) {
    const m = substitutionOf(letter, state.seniorityH);
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
function transLayout(letter) {
    const m = translationOf(letter, state.seniorityH);
    return {
        rows: 2,
        cols: 2,
        glyphPx: SIZES.trans,
        barPx: SIZES.bar,
        children: m.children,
        bars: m.bars,
    };
}

function rebuildPanels() {
    const f = focusGlyph(state.letter, state.seniorityH);
    const fc = makeGlyphCanvas(SIZES.focus, f.grid, f.d, f.r, onPaint);
    const fbox = $("focus");
    fbox.innerHTML = "";
    fbox.appendChild(fc);
    renderGlyph(fc, f.grid, f.d, f.r);
    $("focus-label").textContent = `${state.letter} · ${f.grid}${f.d}${f.r}`;
    $("subs-h2").textContent = state.seniorityH
        ? "Substitution · h→v (top / bottom)"
        : "Substitution · v→h (left | right)";
    $("trans-h2").textContent = "Translation · 4→1 (square + bars)";

    buildComposite("subs", subLayout(state.letter));
    buildComposite("trans", transLayout(state.letter));
}

// A composite relative (substitution pair / translation square) in one canvas,
// with cage-wall bars and per-child cell hit-testing.
function buildComposite(boxId, layout) {
    const { w, h } = compositeSize(layout);
    const canvas = el("canvas", "glyph");
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const fire = (e, erase) => {
        const hit = compositeHit(canvas, layout, e);
        if (hit) onPaint(hit.grid, hit.d, hit.r, hit.idx, erase);
    };
    canvas.addEventListener("mousedown", (e) => {
        if (e.button === 2) return;
        fire(e, false);
    });
    canvas.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        fire(e, true);
    });
    const box = $(boxId);
    box.innerHTML = "";
    box.appendChild(canvas);
    drawComposite(canvas, layout);
}

// paint handler shared by every editable glyph + the patch; erase clears the
// cell (sets it back to unpainted) regardless of the selected color.
function onPaint(grid, d, r, idx, erase) {
    paintCell(grid, d, r, idx, erase ? null : state.color);
    redraw();
}

// ── full redraw ──
function redraw() {
    // highlight current orbit + refresh palette swatches (in active seniority)
    document.querySelectorAll("#palette .swatch").forEach((s) => {
        s.classList.toggle("on", s.dataset.letter === state.letter);
        const g = focusGlyph(s.dataset.letter, state.seniorityH);
        renderGlyph(s.querySelector("canvas"), g.grid, g.d, g.r);
    });
    rebuildPanels(); // draws focus + the two composites
    for (const m of maps) {
        renderPatch($(m.id), m.patch, { lines: true });
        $(m.id + "-label").textContent = `order ${m.order} · ${quadrantLabel()}`;
    }
}

// Paint (or erase) a cell of a map (click → section → code → cell).
function paintMap(patch, canvas, e, erase) {
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;
    const secPx = canvas.width / patch.NSc;
    const sc = Math.min(patch.NSc - 1, Math.floor(x / secPx));
    const sr = Math.min(patch.NSr - 1, Math.floor(y / secPx));
    const cs = secPx / 4;
    const j = Math.min(3, Math.floor((x - sc * secPx) / cs));
    const i = Math.min(3, Math.floor((y - sr * secPx) / cs));
    const [d, r] = patch.codes[sr][sc];
    onPaint("V", d, r, i * 4 + j, erase);
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
    buildIO();
    for (const id of MAP_IDS) {
        const canvas = $(id);
        const patchFor = () => maps.find((m) => m.id === id).patch;
        canvas.addEventListener("mousedown", (e) => {
            if (e.button === 2) return;
            paintMap(patchFor(), canvas, e, false);
        });
        canvas.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            paintMap(patchFor(), canvas, e, true);
        });
    }
    window.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "z") {
            e.preventDefault();
            if (undo()) redraw();
        }
    });
    markColor();
    rebuildMaps();
    redraw();
}
