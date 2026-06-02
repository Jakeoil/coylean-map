// planet-coyleus — terrains (page controller).
//
// DOM wiring, event handling, scheme IO. Imports the pure core and the
// renderer; holds the UI state (current orbit letter, current paint color).

import {
    LETTERS,
    TERRAINS,
    EMPTY,
    focusGlyph,
    substitutionsOf,
    translationsOf,
    mapPatch,
    paintCell,
    serialize,
    loadScheme,
} from "./terrain-core.js";
import { renderGlyph, renderPatch } from "./terrain-render.js";

const PATCH = mapPatch(64);
const SIZES = { focus: 300, rel: 104 };

const state = {
    letter: LETTERS[0],
    color: TERRAINS[0].stops[2].hex, // a mid water stop to start
};

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
    const erase = el("button", "chip erase");
    erase.textContent = "erase";
    erase.dataset.hex = "";
    erase.addEventListener("click", () => {
        state.color = null;
        markColor();
    });
    box.appendChild(erase);
}

function markColor() {
    document.querySelectorAll("#colors .chip").forEach((chip) => {
        const sel =
            (state.color === null && chip.classList.contains("erase")) ||
            chip.dataset.hex === state.color;
        chip.classList.toggle("on", sel);
    });
}

// ── main panels ──
function rebuildPanels() {
    // focus
    const f = focusGlyph(state.letter);
    const fc = makeGlyphCanvas(SIZES.focus, f.grid, f.d, f.r, onPaint);
    const fbox = $("focus");
    fbox.innerHTML = "";
    fbox.appendChild(fc);
    $("focus-label").textContent =
        `${state.letter} · ${f.grid}${f.d}${f.r}`;

    fillRel("subs", substitutionsOf(state.letter));
    fillRel("trans", translationsOf(state.letter));
}

function fillRel(id, glyphs) {
    const box = $(id);
    box.innerHTML = "";
    for (const g of glyphs) {
        const c = makeGlyphCanvas(SIZES.rel, g.grid, g.d, g.r, onPaint);
        const wrap = el("div", "rel");
        const tag = el("span", "rel-tag");
        tag.textContent = `${g.grid}${g.d}${g.r}`;
        wrap.append(c, tag);
        box.appendChild(wrap);
    }
}

// paint handler shared by every editable glyph + the patch; erase clears the
// cell (sets it back to unpainted) regardless of the selected color.
function onPaint(grid, d, r, idx, erase) {
    paintCell(grid, d, r, idx, erase ? null : state.color);
    redraw();
}

// ── full redraw ──
function redraw() {
    // highlight current orbit
    document.querySelectorAll("#palette .swatch").forEach((s) => {
        s.classList.toggle("on", s.dataset.letter === state.letter);
        const cv = s.querySelector("canvas");
        const g = focusGlyph(s.dataset.letter);
        renderGlyph(cv, g.grid, g.d, g.r);
    });
    rebuildPanels();
    // panels just rebuilt their canvases — draw them
    for (const c of document.querySelectorAll("#focus canvas, #subs canvas, #trans canvas")) {
        renderGlyph(c, c.dataset.grid, +c.dataset.d, +c.dataset.r);
    }
    renderPatch($("patch"), PATCH);
}

// Paint (or erase) a cell of the universe patch (click → section → code → cell).
function paintPatch(e, erase) {
    const canvas = $("patch");
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;
    const secPx = canvas.width / PATCH.NSc;
    const sc = Math.min(PATCH.NSc - 1, Math.floor(x / secPx));
    const sr = Math.min(PATCH.NSr - 1, Math.floor(y / secPx));
    const cs = secPx / 4;
    const j = Math.min(3, Math.floor((x - sc * secPx) / cs));
    const i = Math.min(3, Math.floor((y - sr * secPx) / cs));
    const [d, r] = PATCH.codes[sr][sc];
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
    buildPalette();
    buildColors();
    buildIO();
    $("patch").addEventListener("mousedown", (e) => {
        if (e.button === 2) return;
        paintPatch(e, false);
    });
    $("patch").addEventListener("contextmenu", (e) => {
        e.preventDefault();
        paintPatch(e, true);
    });
    markColor();
    redraw();
}
