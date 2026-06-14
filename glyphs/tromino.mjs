// Coylean Glyphs — Tromino Explorer (page controller).
//
// Teaches the substitution KEY away from the Home Anchor. At the Home Anchor
// (the dilation fixed point) a cage's 2×2 children are a function of its own
// glyph code alone (the translation table). At any other anchor that fails —
// the same code refines differently in different places — but the children ARE
// a clean function of the L-shaped (self, North, West) tromino. The tromino is
// a 3-cell *context key*, NOT a composite "super-glyph": two of its cells
// (N, W) are just neighbours whose seams leak through the cage wall into self's
// interior.
//
// Loaded by tromino.html via <script type="module" src="./tromino.mjs">.

import { Seniority } from "coylean/core";
import {
    setOffset,
    computeMapModel,
    applyAssignments,
    setWorkingAssignments,
    GLYPH_LETTERS,
} from "coylean/glyphs";
import {
    drawGlyph,
    drawCoyleanMap,
    toFt,
    V_COLOR,
    renderState,
    ensureBabyBlocksLoaded,
} from "coylean/ui/render";

const SEC = 4;
const V = Seniority.vertical();

// Offsets to compare. Every offset is an anchor (a quadtree node with four
// quads); the HOME ANCHOR is the unique distinguished one — the dilation fixed
// point, where children = f(self) and the tromino collapses to the self-code.
// At any other anchor the cage wall leaks and children = f(self, N, W). 1/2 is
// the verified case (test-tromino-12.mjs). long = hInitCol (E–W), lat =
// vInitRow (N–S).
const OFFSETS = [
    { h: 1, v: 1, label: "1/1 · Home Anchor", home: true },
    { h: 2, v: 1, label: "1/2 · anchor", home: false },
    { h: 2, v: 2, label: "2/2 · anchor", home: false },
    { h: 3, v: 3, label: "3/3 · anchor", home: false },
];

const state = {
    off: OFFSETS[1], // start at a non-home anchor so the lesson is visible
    sel: null, // {sr, sc} selected map cell
    focus: "self", // which editor slot the catalog edits: self | N | W
};

// editor slots: each a code [d, r] or null (absent neighbour)
let editor = { self: null, N: null, W: null };

// Per-offset model, rebuilt on offset change.
let M = null; // { grid, ns, table, bySelf, codes }

const $ = (id) => document.getElementById(id);
const codeStr = (c) => (c ? c[0] + "," + c[1] : "x");
const sameCode = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];

// ── extract 4×4 sections (glyph codes) from a propagated model ──
function sections(model, ns) {
    const { downMatrix, rightMatrix } = model;
    const oR = model.firstDarkRow + 1;
    const oC = model.firstDarkCol + 1;
    const grid = Array.from({ length: ns }, () =>
        Array.from({ length: ns }, () => [0, 0]));
    for (let sr = 0; sr < ns; sr++) {
        for (let sc = 0; sc < ns; sc++) {
            const y0 = oR + sr * SEC;
            const x0 = oC + sc * SEC;
            for (let i = 0; i < 3; i++) {
                const dRow = downMatrix[y0];
                if (dRow && dRow[x0 + i]) grid[sr][sc][0] |= 1 << i;
                const rCol = rightMatrix[x0];
                if (rCol && rCol[y0 + i]) grid[sr][sc][1] |= 1 << i;
            }
        }
    }
    return grid;
}

// Build the offset's tromino table (orders 6→7) plus a `bySelf` index that, for
// each self-code, records how many DISTINCT 2×2 child-blocks it produces and
// under which (N, W) contexts. bySelf is the heart of the lesson: distinct == 1
// means self alone decides (Home Anchor); distinct > 1 means it needs N/W.
function build(off) {
    setOffset(off.h, off.v);
    const pM = computeMapModel(64, 64, { seniority: V });
    const cM = computeMapModel(128, 128, { seniority: V });
    const pns = Math.min(pM.NSr, pM.NSc);
    const cns = Math.min(cM.NSr, cM.NSc);
    const p = sections(pM, pns);
    const c = sections(cM, cns);
    const lim = Math.min(pns, Math.floor(cns / 2));

    const table = new Map(); // "self;N;W" -> [NW, NE, SW, SE]
    const bySelf = new Map(); // "d,r" -> { codes:{N,W}, kids: Map(str->kids) }
    const codes = new Map(); // "d,r" -> [d,r]  (distinct self-codes present)
    const at = (sr, sc) =>
        sr < 0 || sc < 0 || sr >= pns || sc >= pns ? null : p[sr][sc];

    for (let sr = 1; sr < lim - 1; sr++) {
        for (let sc = 1; sc < lim - 1; sc++) {
            const self = p[sr][sc];
            const N = at(sr - 1, sc);
            const W = at(sr, sc - 1);
            const a = sr * 2;
            const b = sc * 2;
            const kids = [
                [...c[a][b]], [...c[a][b + 1]],
                [...c[a + 1][b]], [...c[a + 1][b + 1]],
            ];
            const kidStr = kids.map(codeStr).join("|");
            const key = codeStr(self) + ";" + codeStr(N) + ";" + codeStr(W);
            if (!table.has(key)) table.set(key, kids);

            const sStr = codeStr(self);
            codes.set(sStr, self);
            if (!bySelf.has(sStr)) bySelf.set(sStr, new Map());
            const m = bySelf.get(sStr);
            if (!m.has(kidStr))
                m.set(kidStr, { kids, N, W });
        }
    }
    setOffset(state.off.h, state.off.v); // leave the live offset set
    // cell px sized so the whole order-6 map fits ~600px wide.
    const cell = Math.max(7, Math.round(600 / pM.numColumns));
    return {
        grid: p, ns: Math.min(pns, pM.NSr, pM.NSc),
        table, bySelf, codes, model: pM, cell,
    };
}

// ── small helpers to render a glyph into a freshly-made canvas ──
// fTransform = [letter, color, d4Index] drives the letter overlay / Baby Block.
function ftFor(code) {
    return code ? toFt(GLYPH_LETTERS[codeStr(code)], V_COLOR) : null;
}
function glyphCanvas(code, cls) {
    const cv = document.createElement("canvas");
    cv.className = cls || "";
    if (code) drawGlyph(cv, code[0], code[1], V, ftFor(code));
    else {
        // unknown / absent slot: a faint "?" tile
        cv.width = 96;
        cv.height = 96;
        const ctx = cv.getContext("2d");
        ctx.fillStyle = "#f3f3f3";
        ctx.fillRect(0, 0, 96, 96);
        ctx.fillStyle = "#bbb";
        ctx.font = "40px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(code === null ? "·" : "?", 48, 50);
    }
    return cv;
}

// ── the map: a real Coylean map (with cage-wall BARS) drawn by the engine ──
// drawCoyleanMap paints the priority lattice (the bars are the priority-≥2
// black lines), the glyph line-art, and the black Baby Block letters. We then
// overlay the selected L-tromino and hit-test clicks back to a section.
let mapCanvas = null;

function buildMap() {
    if (!mapCanvas) {
        mapCanvas = document.createElement("canvas");
        mapCanvas.className = "map-canvas";
        mapCanvas.addEventListener("click", onMapClick);
        const wrap = $("map");
        wrap.innerHTML = "";
        wrap.appendChild(mapCanvas);
    }
    drawMap();
}

function drawMap() {
    drawCoyleanMap(mapCanvas, M.model, {
        cell: M.cell,
        babyBlocks: true,
        outline: false,
    });
    if (state.sel) overlayTromino(state.sel.sr, state.sel.sc);
}

// section (sr,sc) → its 4×4 pixel rect on the map canvas
function sectionRect(sr, sc) {
    const g = mapCanvas._coySections;
    return {
        x: (g.firstDarkCol + sc * g.SEC + 1) * g.cell,
        y: (g.firstDarkRow + sr * g.SEC + 1) * g.cell,
        s: g.SEC * g.cell,
    };
}

function overlayTromino(sr, sc) {
    const ctx = mapCanvas.getContext("2d");
    const ring = (r, c, color, lw) => {
        const { x, y, s } = sectionRect(r, c);
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.strokeRect(x + lw / 2, y + lw / 2, s - lw, s - lw);
    };
    if (sr > 0) ring(sr - 1, sc, "#2563eb", 3); // North
    if (sc > 0) ring(sr, sc - 1, "#0891b2", 3); // West
    ring(sr, sc, "#c026d3", 4); // self
}

function onMapClick(e) {
    const g = mapCanvas._coySections;
    const rect = mapCanvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) * mapCanvas.width) / rect.width;
    const py = ((e.clientY - rect.top) * mapCanvas.height) / rect.height;
    const sc = Math.floor((px / g.cell - g.firstDarkCol - 1) / g.SEC);
    const sr = Math.floor((py / g.cell - g.firstDarkRow - 1) / g.SEC);
    if (sr < 0 || sc < 0 || sr >= g.NSr || sc >= g.NSc) return;
    selectCell(sr, sc);
}

function selectCell(sr, sc) {
    state.sel = { sr, sc };
    editor.self = M.grid[sr][sc];
    editor.N = sr > 0 ? M.grid[sr - 1][sc] : null;
    editor.W = sc > 0 ? M.grid[sr][sc - 1] : null;
    state.focus = "self";
    drawMap(); // redraw + overlay the L-tromino
    renderEditor();
    renderCatalog();
}

// ── the floating tromino editor ──
function lookupChildren() {
    const key =
        codeStr(editor.self) + ";" + codeStr(editor.N) + ";" + codeStr(editor.W);
    return M.table.get(key) || null; // null = this triple doesn't occur
}

function renderEditor() {
    const slot = (name) => {
        const d = document.createElement("div");
        d.className = "slot" + (state.focus === name ? " focus" : "");
        d.appendChild(glyphCanvas(editor[name], "g"));
        const tag = document.createElement("span");
        tag.className = "slot-tag";
        tag.textContent =
            (name === "self" ? "self " : name === "N" ? "N " : "W ") +
            codeStr(editor[name]);
        d.appendChild(tag);
        d.addEventListener("click", () => {
            state.focus = name;
            renderEditor();
            renderCatalog();
        });
        return d;
    };

    // L-tromino layout:   .  N
    //                     W  self
    const lwrap = $("trom");
    lwrap.innerHTML = "";
    const blank = document.createElement("div");
    lwrap.append(blank, slot("N"), slot("W"), slot("self"));

    // children (Home Anchor: from self alone; else: from self+N+W)
    const kids = lookupChildren();
    const kwrap = $("kids");
    kwrap.innerHTML = "";
    if (kids) {
        for (const k of kids) kwrap.appendChild(glyphCanvas(k, "g"));
        $("kids-note").textContent = "";
    } else {
        for (let i = 0; i < 4; i++) kwrap.appendChild(glyphCanvas(undefined, "g"));
        $("kids-note").textContent =
            "this (self, N, W) triple does not occur in the offset's map";
    }

    // the lesson readout: how many distinct child-blocks does THIS self make?
    const sStr = codeStr(editor.self);
    const m = M.bySelf.get(sStr);
    const distinct = m ? m.size : 0;
    const readout = $("readout");
    if (!editor.self) {
        readout.innerHTML = "Click a cell on the map to load its tromino.";
    } else if (distinct <= 1) {
        readout.innerHTML =
            `self <b>${sStr}</b> → <b>1</b> child-block everywhere. ` +
            `<span class="ok">self alone decides — N and W are irrelevant.</span>`;
    } else {
        readout.innerHTML =
            `self <b>${sStr}</b> → <b>${distinct}</b> different child-blocks ` +
            `across the map, depending on its (N, W). ` +
            `<span class="bad">self alone is ambiguous — you need the tromino.</span>`;
    }
}

// ── catalog: the COMPLETE lettered set (every orbit, from
// assignments-complete.json); click to set the focused slot. Codes that are
// ambiguous at the current offset (need the tromino) are tinted. ──
function renderCatalog() {
    const wrap = $("catalog");
    wrap.innerHTML = "";
    const list = Object.keys(GLYPH_LETTERS)
        .map((k) => k.split(",").map(Number))
        .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (const code of list) {
        const item = document.createElement("div");
        item.className = "cat-item";
        const m = M.bySelf.get(codeStr(code));
        if (m && m.size > 1) item.classList.add("ambig");
        if (sameCode(code, editor[state.focus])) item.classList.add("on");
        item.appendChild(glyphCanvas(code, "g"));
        const tag = document.createElement("span");
        tag.className = "cat-tag";
        tag.textContent = codeStr(code) + (m && m.size > 1 ? " ·" + m.size : "");
        item.appendChild(tag);
        item.addEventListener("click", () => {
            editor[state.focus] = code;
            state.sel = null; // an edited tromino is no longer a map cell
            drawMap(); // clears the map highlight
            renderEditor();
            renderCatalog();
        });
        wrap.appendChild(item);
    }
}

// ── offset switcher + banner ──
function renderOffsets() {
    const wrap = $("offsets");
    wrap.innerHTML = "";
    for (const off of OFFSETS) {
        const b = document.createElement("button");
        b.textContent = off.label;
        b.className = "off-btn" + (off === state.off ? " on" : "");
        b.addEventListener("click", () => switchOffset(off));
        wrap.appendChild(b);
    }
    const banner = $("banner");
    banner.className = "banner " + (state.off.home ? "home" : "away");
    banner.innerHTML = state.off.home
        ? "<b>HOME ANCHOR.</b> The dilation fixed point — all four {0,1}² quads " +
          "are its own. The cage wall seals, so children = <b>f(self)</b>: " +
          "N and W are ignored and the tromino collapses to the self-code."
        : "<b>ANCHOR.</b> A node drifting ×2 per level from home. The cage " +
          "wall leaks, so children = <b>f(self, N, W)</b> — the same self-code " +
          "splits differently depending on its North and West neighbours.";
}

function switchOffset(off) {
    state.off = off;
    M = build(off);
    state.sel = null;
    editor = { self: null, N: null, W: null };
    renderOffsets();
    buildMap();
    renderCatalog();
    renderEditor();
}

// ── draggable floating editor window ──
function makeDraggable(win, handle) {
    let dx = 0;
    let dy = 0;
    let down = false;
    handle.addEventListener("mousedown", (e) => {
        down = true;
        const r = win.getBoundingClientRect();
        dx = e.clientX - r.left;
        dy = e.clientY - r.top;
        e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
        if (!down) return;
        win.style.left = e.clientX - dx + "px";
        win.style.top = e.clientY - dy + "px";
        win.style.right = "auto";
    });
    window.addEventListener("mouseup", () => {
        down = false;
    });
}

// ── load the COMPLETE assignment set (all orbits) so every glyph has a letter
// / Baby Block, then boot. assignments-complete.json names one member per
// orbit; applyAssignments propagates it across the whole D4 orbit, both grids.
async function loadCompleteAssignments() {
    try {
        const res = await fetch("./assignments-complete.json", {
            cache: "no-store",
        });
        const data = await res.json();
        if (data && data.assignments) setWorkingAssignments(data.assignments);
    } catch (e) {
        console.warn("tromino: could not load assignments-complete.json", e);
    }
    applyAssignments(true); // populate GLYPH_LETTERS / H_GLYPH_LETTERS
}

export async function init() {
    await loadCompleteAssignments();
    M = build(state.off);
    renderOffsets();
    buildMap();
    renderCatalog();
    renderEditor();
    makeDraggable($("editor"), $("editor-bar"));

    // Upgrade to solid black Baby Blocks (no outline) once the SVG loads. The
    // map is already visible with letter overlays, so a load failure can't
    // blank the page — it just keeps the fallback letters.
    ensureBabyBlocksLoaded(() => {
        renderState.useBabyBlocks = true;
        renderState.babyBlocksOutline = false;
        renderState.babyBlocksColor = "#555"; // grey, not black
        renderState.babyBlocksAlpha = 0.6; // let the map structure show through
        buildMap();
        renderCatalog();
        renderEditor();
    });
}

init();
