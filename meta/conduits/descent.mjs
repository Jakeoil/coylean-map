"use strict";

// The living descent: a genuine Coylean SQUARE drawn in the draw map's
// "elaborate" style (priority-width nested rectangles, color-coded by depth) —
// the same square meta/fibonacci-ruler draws, only elaborate. A square of order
// n has side 2^n and is ANCHORED AT THE ORIGIN: a unit N/W seed against side to
// the S/E. Rendered over cells [0..side]: the ∞ axis (priority order+1, one above
// the interior max) draws the two infinity bars that frame it as a Coylean
// square, and the priority-order spine lands on the opposite corner — a closed,
// self-similar tile. The ladder picks the order; the orientation card's lat/long
// force a different quadrant pattern (the dyadic offset ∈ {0,1}, like
// compound-glyphs); depth is the elaborate-nesting knob; seniority flips the V/H
// tie-break.
//
// A checkbox swaps in the OLD render — the boundary-seeded INFINITE patch
// (fromUniverseBoundary) in the same elaborate dress — as a reference. The
// elaborate renderComplex is the IMMUTABLE core (faithful to coylean.js); both
// modes share it.
import {
    Universe,
    Propagation,
    Seniority,
} from "coylean/core";
import { SlidingRuler } from "coylean/ui/sliding-ruler/sliding-ruler.js";
import {
    glyphLetterAt,
    setWorkingAssignments,
    applyAssignments,
} from "coylean/glyphs";
import { BabyBlocks } from "../../src/assets/baby-blocks/baby-blocks.js";
import { COLOR_LIST, renderComplex } from "./elaborate-cell.js";
// engine d4Index → baby-block transform name. The calibrated map from
// glyph-render (Baby Blocks names its two rotations OPPOSITE to ours, so r/r³
// are swapped vs the naïve order — this is the corrected mapping). Imported so
// it can't drift from the catalog.
import { D4_TO_BABY as D4B } from "coylean/ui/render";

// The order's colour = COLOR_LIST[order − 1]: order 1 green, 2 cream/yellow,
// 3 purple, 4 blue/cyan, … — what the bar all around and the ladder rungs use.
const orderColor = (o) =>
    COLOR_LIST[Math.max(0, o - 1) % COLOR_LIST.length];

const SCALE = 6;
const MIN_DEPTH = 1;
// Order = the square's side via the dyadic ladder side = 2^order, matching
// meta/fibonacci-ruler (sides 4·8·16·32·64·128). A square's high-priority spine
// has to land on its far edge for it to read as a closed, self-similar tile, so
// the side is a power of two and the order is its log.
const ORDER_MIN = 1; // side 2 — the green+white atom (order 1)
const ORDER_MAX = 10; // side 1024 — the ceiling (the order dial shows 1..10)
const MAX_BMP = 4096; // cap the offscreen square bitmap; big orders downscale

// Old-render (infinite patch) constants — the reference mode.
const MAPW = 1800;
const MAPH = 1350;
const PATCH_MAXP = 9;
const eastExtent = Math.ceil(MAPW / SCALE) + 8;
const southExtent = Math.ceil(MAPH / SCALE) + 8;

let mode = "square"; // "square" (canonical) | "patch" (old infinite render)

// Draw a visible outline around every reaction's cell boundary — a debug aid
// for deciding what to reduce when rendering elaborate. Off by default.
let outlines = false;

// Shave the square's outermost shell (square mode only). A square's outer shell
// is the n+1 ∞ line at col0/row0 — the unique max priority, one above the
// interior, the extra ring the patch never has. Shaving drops it entirely
// (everything outside and including the n+1 line), leaving the interior: all
// colours ≤ n bounded by the order-n spine. Render-only — the propagation is
// untouched; see `infSkip`. Off by default.
let shaveOuter = false;

// Orientation (anchor quadrant + seniority), mirroring compound-glyphs. The
// map re-integrates on each toggle. Defaults = the clean 1/1 / vertical baseline.
const orient = { curH: 1, curV: 1, senH: false };
const seniorityNow = () =>
    orient.senH ? Seniority.horizontal() : Seniority.vertical();

// The elaborate cell renderer (renderComplex) + COLOR_LIST now live in the
// shared ./elaborate-cell.js — the IMMUTABLE coylean.js core, so the Morph Unit
// reuses the same copy. descent draws at the default scale (SCALE = 6).

// ── The active map's matrices + bitmap size, rebuilt on any change ─────────
let downMatrix, rightMatrix, colPriority, rowPriority, numRows, numColumns;
let bmpW = SCALE, bmpH = SCALE; // natural pixel size of the active bitmap

// Glyph labels: a baby-block letter at each 4×4 glyph cage's centre (square mode
// only), superimposed where scale permits. A glyph is the order-2 cage bounded
// by its purple (priority-3) conduit — exactly compound-glyphs' SEC=4 sections.
let labels = false; // off by default — a switch turns them on
let babyBlocks = null; // loaded async
let lettersReady = false; // assignments-complete loaded → glyphLetterAt resolves
let labelData = []; // [{ letter, d4, cx, cy, w }] in logical bitmap pixels

// The genuine Coylean square (per meta/fibonacci-ruler): its side is a power of
// two, side = 2^order, and it is ANCHORED AT THE ORIGIN — its left/top edges are
// the infinite-priority zero axes, with the dominant priority-`order` spine
// landing on the far edge so it reads as a closed, self-similar tile. (NOT a
// centered window, and NOT a hand-rolled all-true grid.)
const sqSide = (n) => Math.max(1, 2 ** n);

// ∞ = one above the square's highest interior priority. A cell's priority is
// pri(i + hInitCol); setting maxPri = order + 1 makes pri(0) (the ∞ axis) come
// out at order + 1 while the interior stays capped at its natural `order`.
const sqMaxPri = (n) => n + 1;

// ORIENTATION = the anchor points. long = hInitCol, lat = vInitRow, each ∈ {0,1}
// — exactly compound-glyphs' setOffset(curH, curV). It just re-propagates one of
// the four anchor patterns; the universe is always the same (a 1-cell N/W context
// against a side×side S/E square, reseeded by fromUniverseBoundary for the correct
// boundary seed). The four offsets COINCIDENTALLY resemble reflections of the
// matching universe quadrants — hence the SE/SW/NE/NW names — but they are anchor
// points, not geometric reflections, so the patterns genuinely differ (only the
// diagonal S·E / N·W close into squares; S·W / N·E are the off-anchor patterns).
// The clean baseline is S·E (1/1). The two ∞ bars a square "needs" come from the
// seed margin where the offset is 1 (col 0 ∞ iff curH=1, row 0 ∞ iff curV=1) plus
// the interior where it is 0 — so SE adds 2, SW/NE add 1, NW adds 0.
//
// At offset 0 the lattice slides by one, so the priority-`order` SPINE (the
// purple band for order 3) would fall one cell past the side and the last column
// loses its hue. We extend the far extent by that slide (1−curH / 1−curV) so the
// spine still lands in the last column/row for EVERY anchor — and render from 0,
// so the leading zero-width cells stay and the four anchors remain distinct.
function integrateSquare(n) {
    const side = sqSide(n);
    const maxPri = sqMaxPri(n);
    const u = Universe.create({
        northExtent: 1,
        westExtent: 1,
        southExtent: side + (1 - orient.curV),
        eastExtent: side + (1 - orient.curH),
        hInitCol: orient.curH,
        vInitRow: orient.curV,
        maxPri,
        seniority: seniorityNow(),
    });
    return Propagation.fromUniverseBoundary(u, { maxPri });
}

// Shave = drop the ∞ axis. A square's outermost shell is the n+1 ∞ line at
// col0/row0 (the unique max priority, one above the interior). Shaving removes
// everything outside and including that n+1 line, leaving the interior — all
// colours ≤ n bounded by the order-n spine. So we simply skip col0/row0 (and
// their width) when `shaveOuter` is on. `infSkip` is that start index; threading
// it through squarePx, the draw loop and the labels keeps everything aligned.
const infSkip = () => (shaveOuter ? 1 : 0);

// Pixel size over the rendered cells — every column/row (priority-0 cells
// contribute width 0; the ∞ axis is the wide frame, the spine the last band).
// When shaving, the ∞ axis (index 0) is dropped from the sum.
function squarePx(p) {
    const s = infSkip();
    let w = 0, h = 0;
    for (let i = s; i < p.numColumns; i++) w += p.colPriority[i] * 2;
    for (let j = s; j < p.numRows; j++) h += p.rowPriority[j] * 2;
    return [Math.max(SCALE, SCALE * w), Math.max(SCALE, SCALE * h)];
}

let order = ORDER_MIN; // set to the fitting default once the canvas exists

function buildSquare() {
    const p = integrateSquare(order);
    ({ downMatrix, rightMatrix, colPriority, rowPriority, numRows, numColumns } =
        p);
    [bmpW, bmpH] = squarePx(p);
    buildLabels();
}

// A glyph is the green+beige square fenced by the purple (priority-3) conduit —
// an order-2 square, 8 cells (SEC). Its identity (glyphLetterAt code) is read at
// the three senior internal lines (green·beige·green, offsets +2/+4/+6 from the
// fence), and the letter is centred on the beige (priority-2) spine. The
// cumulative priority-widths map a cell to its pixel x/y (priority-0 cells
// contribute 0). Recomputed per build. (The finer 4-cell cages — the SEC/2
// compound-glyph level — are not labelled here.)
const SEC = 8;
function buildLabels() {
    labelData = [];
    if (mode !== "square" || !lettersReady) return;
    const fdc = (((1 - orient.curH) % SEC) + SEC) % SEC; // first purple fence
    const fdr = (((1 - orient.curV) % SEC) + SEC) % SEC;
    const grid = orient.senH ? "H" : "V";
    // when shaving, the ∞ axis (col0/row0) contributes no width — so the
    // interior starts at x=y=0 and absolute column indices still map correctly
    const s = infSkip();
    const cumX = [0], cumY = [0];
    for (let i = 0; i < numColumns; i++)
        cumX.push(cumX[i] + (i < s ? 0 : colPriority[i] * 2 * SCALE));
    for (let j = 0; j < numRows; j++)
        cumY.push(cumY[j] + (j < s ? 0 : rowPriority[j] * 2 * SCALE));
    const dAt = (y, x) =>
        downMatrix[y] && x < downMatrix[y].length ? downMatrix[y][x] : false;
    const rAt = (x, y) =>
        rightMatrix[x] && y < rightMatrix[x].length ? rightMatrix[x][y] : false;
    const SR = [2, 4, 6]; // the senior green·beige·green offsets within a glyph
    const NSr = Math.floor((numRows - fdr) / SEC);
    const NSc = Math.floor((numColumns - fdc) / SEC);
    for (let sr = 0; sr < NSr; sr++) {
        for (let sc = 0; sc < NSc; sc++) {
            const rs = fdr + sr * SEC, cs = fdc + sc * SEC; // the glyph's fence
            let dc = 0, rc = 0;
            for (let i = 0; i < 3; i++) {
                if (dAt(rs + 1, cs + SR[i])) dc |= 1 << i;
                if (rAt(cs + 1, rs + SR[i])) rc |= 1 << i;
            }
            const ft = glyphLetterAt(grid, dc, rc);
            if (!ft) continue; // unlettered → no label
            // centre on the green+beige interior (skip the fence cells), beige spine
            const x1 = cumX[cs + 1], x2 = cumX[cs + 7];
            const y1 = cumY[rs + 1], y2 = cumY[rs + 7];
            labelData.push({
                letter: ft[0],
                d4: ft[1],
                cx: (x1 + x2) / 2,
                cy: (y1 + y2) / 2,
                w: Math.min(x2 - x1, y2 - y1),
            });
        }
    }
}

// The OLD render: the boundary-seeded INFINITE patch (fromUniverseBoundary).
function buildPatch() {
    const u = Universe.create({
        northExtent: 1,
        westExtent: 1,
        eastExtent,
        southExtent,
        hInitCol: orient.curH,
        vInitRow: orient.curV,
        maxPri: PATCH_MAXP,
        seniority: seniorityNow(),
    });
    ({ downMatrix, rightMatrix, colPriority, rowPriority, numRows, numColumns } =
        Propagation.fromUniverseBoundary(u, { maxPri: PATCH_MAXP }));
    bmpW = MAPW;
    bmpH = MAPH;
    labelData = []; // no glyph labels on the infinite patch
}

function buildActive() {
    if (mode === "square") buildSquare();
    else buildPatch();
}

// Day mode = cheerful white ground like the draw map's original; night = the
// dark ground the depth colors glow against.
let day = true;
const ground = () => (day ? "#ffffff" : "#0a0d0a");

// The genuine Coylean square, drawn elaborate. Render every cell [0..side]: the
// ∞ axis (priority order+1) draws the two ∞ bars framing the square and the
// spine on the opposite corner; [1..side] is the interior. The orientation
// (see integrateSquare) just re-propagates a different quadrant pattern. Always
// the classic shell coylean.js coloring (green frames, rainbow innards).
//
// The result row/col (the trailing down/right matrix line) is always rendered,
// so the spine trunks poke out the far (S/E) edge — the square continuing into
// the next tile. When `outlines` is on, every reaction's cell boundary is
// stroked (a debug aid for deciding what to reduce).
function makeSquareBitmap(depth) {
    const off = document.createElement("canvas");
    // cap the offscreen size; big orders render at a reduced scale, then the
    // camera blits the logical bmpW×bmpH (so fitView/zoom are unaffected).
    const rs = Math.min(1, MAX_BMP / Math.max(bmpW, bmpH));
    off.width = Math.max(1, Math.round(bmpW * rs));
    off.height = Math.max(1, Math.round(bmpH * rs));
    const g = off.getContext("2d");
    if (rs !== 1) g.scale(rs, rs);
    g.fillStyle = ground();
    g.fillRect(0, 0, bmpW, bmpH);

    const top = sqMaxPri(order); // shell ceiling = ∞ (order + 1)
    // shaving drops the ∞ axis (col0/row0 = the n+1 line); start past it
    const s = infSkip();
    const colN = numColumns - 1, rowN = numRows - 1; // last real col / row
    let y = 0;
    for (let j = s; j <= rowN; j++) {
        const rPri = rowPriority[j];
        let x = 0;
        for (let i = s; i <= colN; i++) {
            const dPri = colPriority[i];
            // always render the result row/col (the trailing down/right matrix
            // line) so the spine trunks poke out the far edge
            const cw = renderComplex(
                g, x, y,
                downMatrix[j][i], dPri,
                rightMatrix[i][j], rPri,
                downMatrix[j + 1][i], rightMatrix[i + 1][j],
                depth, top, { scale: SCALE }
            );
            if (outlines && cw > 0 && rPri > 0) {
                g.strokeStyle = day ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.5)";
                g.lineWidth = 1;
                g.strokeRect(x + 0.5, y + 0.5, cw - 1, SCALE * rPri * 2 - 1);
            }
            x += cw;
        }
        y += SCALE * rPri * 2;
    }
    return off;
}

// Old render: the whole infinite patch, clipped to MAPW×MAPH.
function makePatchBitmap(depth) {
    const off = document.createElement("canvas");
    off.width = MAPW;
    off.height = MAPH;
    const g = off.getContext("2d");
    g.fillStyle = ground();
    g.fillRect(0, 0, MAPW, MAPH);

    let y = 0;
    for (let j = 0; j < numRows && y < MAPH; j++) {
        const rPri = rowPriority[j];
        let x = 0;
        for (let i = 0; i < numColumns && x < MAPW; i++) {
            const dPri = colPriority[i];
            const cw = renderComplex(
                g, x, y,
                downMatrix[j][i], dPri,
                rightMatrix[i][j], rPri,
                downMatrix[j + 1][i], rightMatrix[i + 1][j],
                depth, PATCH_MAXP, { scale: SCALE }
            );
            if (outlines && cw > 0 && rPri > 0) {
                g.strokeStyle = day ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.5)";
                g.lineWidth = 1;
                g.strokeRect(x + 0.5, y + 0.5, cw - 1, SCALE * rPri * 2 - 1);
            }
            x += cw;
        }
        y += SCALE * rPri * 2;
    }
    return off;
}

function makeBitmap(depth) {
    return mode === "square" ? makeSquareBitmap(depth) : makePatchBitmap(depth);
}

// ── Camera (free zoom + pan) and depth knob ───────────────────────────────
const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");
const hud = document.getElementById("hud");
const depthCanvas = document.getElementById("depthRuler");

// Default order = the largest whose natural square fits the canvas at base
// SCALE (so it shows ~1:1); the ladder climbs above it (zoom out) or below.
function fittingOrder() {
    const stage = Math.min(cv.clientWidth || 800, cv.clientHeight || 600);
    let best = ORDER_MIN;
    for (let n = ORDER_MIN + 1; n <= ORDER_MAX; n++) {
        const [w, h] = squarePx(integrateSquare(n));
        if (Math.max(w, h) <= stage) best = n;
        else break;
    }
    return best;
}
order = fittingOrder();
// Full nest by default: every ring draws, so each trunk shows its whole
// colour stack (order colour outside → green → white), as in the references.
// Lowering depth peels the OUTER (order-colour) rings, revealing the green
// core. top of the gate = the order, so depth = order shows everything.
let depth = Math.max(MIN_DEPTH, sqMaxPri(order));
buildActive();

let cur = makeBitmap(depth);
let prev = null;
let fadeT = 1; // 1 = fully showing cur

// view: bitmap is drawn at (vx, vy) scaled by vs (CSS px). fitS = contain.
let vx = 0, vy = 0, vs = 1, fitS = 1;

function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    cv.width = cv.clientWidth * dpr;
    cv.height = cv.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fitS = Math.min(cv.clientWidth / bmpW, cv.clientHeight / bmpH);
}
function fitView() {
    sizeCanvas();
    vs = fitS;
    vx = (cv.clientWidth - bmpW * vs) / 2;
    vy = (cv.clientHeight - bmpH * vs) / 2;
}
fitView();
window.addEventListener("resize", fitView);

// Re-render the bitmap (depth changed), crossfading from the old one.
function regen() {
    prev = cur;
    fadeT = 0;
    cur = makeBitmap(depth);
}

// Re-render with no crossfade (size changed — the two bitmaps differ in size).
function hardRegen() {
    prev = null;
    fadeT = 1;
    cur = makeBitmap(depth);
}

// Re-integrate at the same size (orientation changed); keep the camera.
function rebuildOrientation() {
    buildActive();
    syncOrient();
    if (mode === "patch") regen();
    else { fitView(); hardRegen(); }
}

// Re-integrate at a new order; the square changes size, re-fit and skip fade.
function setOrder(n) {
    if (n === order) return;
    order = n;
    depth = Math.max(MIN_DEPTH, sqMaxPri(order)); // full nest for the new square
    if (mode === "square") buildActive();
    buildRulers(); // depth ruler tops out at the new order (order ruler unchanged)
    syncOrder();
    if (mode === "square") { fitView(); hardRegen(); }
}

function setMode(m) {
    if (m === mode) return;
    mode = m;
    depth = mode === "square" ? Math.max(MIN_DEPTH, sqMaxPri(order)) : PATCH_MAXP;
    buildActive();
    buildRulers();
    syncOrder();
    fitView();
    hardRegen();
}

// ── Orientation card (anchor quadrant + seniority), per compound-glyphs ────
const orientSym = (sym, val) =>
    `<span class="osym">${sym}</span><span class="oval">${val}</span>`;
function quadrantLabel() {
    const ns = orient.curV === 1 ? "S" : "N";
    const ew = orient.curH === 1 ? "E" : "W";
    // letter order encodes seniority: V → NS-first, H → EW-first
    return orient.senH ? ew + ns : ns + ew;
}
function syncOrient() {
    const set = (id, html) => {
        const e = document.getElementById(id);
        if (e) e.innerHTML = html;
    };
    set("longBtn", orientSym("↔", orient.curH));
    set("latBtn", orientSym("↕", orient.curV));
    set("senBtn", orientSym("⤢", orient.senH ? "H" : "V"));
    const lab = document.getElementById("orientLabel");
    if (lab) lab.textContent = quadrantLabel();
}
function buildOrient() {
    const wire = (id, fn) => {
        const e = document.getElementById(id);
        if (e) e.onclick = fn;
    };
    wire("longBtn", () => { orient.curH ^= 1; rebuildOrientation(); });
    wire("latBtn", () => { orient.curV ^= 1; rebuildOrientation(); });
    wire("senBtn", () => { orient.senH = !orient.senH; rebuildOrientation(); });
    syncOrient();
}
buildOrient();

// ── Order ruler: the old ladder, now a SlidingRuler dial faced with the
// colored numbered order-dial.png. Drag to resize the square; the selected
// number rides under the centre indicator. Disabled (greyed) in patch mode.
const orderCanvas = document.getElementById("orderRuler");
let orderRuler = null;
function syncOrder() {
    const knob = orderCanvas && orderCanvas.closest(".knob");
    if (knob) knob.classList.toggle("disabled", mode !== "square");
    if (orderRuler) orderRuler.setValue(order); // ignored while dragging
}

// One SlidingRuler knob: depth = how many nested shells show (from the inside
// out). Its max tracks the shell ceiling (order in square mode, PATCH_MAXP in
// patch). Colors are baked at construction, so it's rebuilt on every change.
const labelsFor = (lo, hi) => {
    const m = {};
    for (let v = lo; v <= hi; v++) m[v] = String(v);
    return m;
};
const rulerPalette = () =>
    day
        ? {
              bgColor: "#eef5ea",
              indicatorColor: "#5a8f3f",
              majorTickColor: "#9bb38c",
              midTickColor: "#86a276",
              minorTickColor: "#c2d3b6",
              labelColor: "#3d5e34",
              fadeColor: "rgba(238,245,234,0.92)",
          }
        : {
              bgColor: "#10180f",
              indicatorColor: "#9ccb7a",
              majorTickColor: "#5f7a52",
              midTickColor: "#76916a",
              minorTickColor: "#3f5238",
              labelColor: "#cfe8cf",
              fadeColor: "rgba(16,24,15,0.92)",
          };
let depthRuler = null;
function buildRulers() {
    const maxDepth = mode === "square" ? Math.max(MIN_DEPTH, sqMaxPri(order)) : PATCH_MAXP;
    if (depth > maxDepth) depth = maxDepth;
    if (depthRuler) depthRuler.destroy();
    depthRuler = new SlidingRuler(depthCanvas, {
        min: MIN_DEPTH,
        max: maxDepth,
        value: depth,
        visibleRange: maxDepth - MIN_DEPTH + 2,
        height: 54,
        labels: labelsFor(MIN_DEPTH, maxDepth),
        onChange: (v) => {
            if (v === depth) return;
            depth = v;
            regen();
        },
        ...rulerPalette(),
    });
}
buildRulers();

// The order dial — fixed range ORDER_MIN..ORDER_MAX, faced with the colored
// numbered dial PNG (order-dial.png, numbers 1..10 on their order colours). The
// image spans [0.5, 10.5] so number n centres on unit n, and scrolls in step.
// Rebuilt only on day/night (palette), never on setOrder — so a drag is never
// destroyed mid-scrub; setOrder just setValue()s it (ignored while dragging).
function buildOrderRuler() {
    if (!orderCanvas) return;
    if (orderRuler) orderRuler.destroy();
    orderRuler = new SlidingRuler(orderCanvas, {
        min: ORDER_MIN,
        max: ORDER_MAX,
        value: order,
        visibleRange: (ORDER_MAX - ORDER_MIN + 2) / 2, // half — fewer numbers
        height: 54,
        bgImage: "./order-dial.png",
        bgImageRange: [ORDER_MIN - 0.5, ORDER_MAX + 0.5],
        onChange: (v) => {
            if (mode === "square" && v !== order) setOrder(v);
        },
        ...rulerPalette(),
    });
    syncOrder();
}
buildOrderRuler();

document.getElementById("reset").onclick = fitView;

const oldToggle = document.getElementById("oldrender");
if (oldToggle) {
    oldToggle.checked = mode === "patch";
    oldToggle.addEventListener("change", () =>
        setMode(oldToggle.checked ? "patch" : "square")
    );
}

// Outlines toggle: stroke every reaction's cell boundary (a debug aid for
// deciding what to reduce when rendering elaborate).
const outlinesToggle = document.getElementById("outlines");
if (outlinesToggle) {
    outlinesToggle.checked = outlines;
    outlinesToggle.addEventListener("change", () => {
        outlines = outlinesToggle.checked;
        regen();
    });
}

// Shave-outer-shell toggle (square only): drop the proud outer ∞ ring.
const shaveToggle = document.getElementById("shaveouter");
if (shaveToggle) {
    shaveToggle.checked = shaveOuter;
    shaveToggle.addEventListener("change", () => {
        shaveOuter = shaveToggle.checked;
        // clamping the ∞ axis changes the square's size → rebuild + re-fit
        if (mode === "square") {
            buildActive();
            fitView();
            hardRegen();
        }
    });
}

// Labels toggle (square only): glyph letters at each cage centre.
const labelsToggle = document.getElementById("labels");
if (labelsToggle) {
    labelsToggle.checked = labels;
    labelsToggle.addEventListener("change", () => {
        labels = labelsToggle.checked; // drawn in the loop — no rebuild needed
    });
}

// Load the glyph letters + baby blocks, then stamp the cage labels.
async function loadLabels() {
    try {
        const res = await fetch("../../glyphs/assignments-complete.json", {
            cache: "no-store",
        });
        const data = await res.json();
        if (data && data.assignments) {
            setWorkingAssignments(data.assignments);
            applyAssignments(true);
            lettersReady = true;
            buildLabels(); // matrices are already built
        }
    } catch (e) {
        console.warn("descent: assignments load failed", e);
    }
    try {
        babyBlocks = await BabyBlocks.load(
            "../../src/assets/baby-blocks/AlphabetBlocks-complete.svg"
        );
    } catch (e) {
        console.warn("descent: baby blocks load failed", e);
    }
}
loadLabels();

const dayBtn = document.getElementById("daynight");
dayBtn.onclick = () => {
    day = !day;
    document.body.classList.toggle("day", day);
    document.body.classList.toggle("night", !day);
    dayBtn.textContent = day ? "☾ Night" : "☀ Day";
    buildRulers(); // recolor the depth dial
    buildOrderRuler(); // recolor the order dial
    hardRegen(); // rebuild without crossfade so the two grounds don't blend
};

// ── Pointer pan + pinch, wheel zoom ───────────────────────────────────────
const pts = new Map();
let pinchPrev = 0;

function localXY(e) {
    const r = cv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
}
function zoomAt(cx, cy, factor) {
    const ns = Math.max(fitS * 0.5, Math.min(fitS * 60, vs * factor));
    const k = ns / vs;
    vx = cx - (cx - vx) * k;
    vy = cy - (cy - vy) * k;
    vs = ns;
}

cv.addEventListener("pointerdown", (e) => {
    cv.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, localXY(e));
    if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinchPrev = Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
});
cv.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    const [nx, ny] = localXY(e);
    const [ox, oy] = pts.get(e.pointerId);
    pts.set(e.pointerId, [nx, ny]);
    if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const midx = (a[0] + b[0]) / 2;
        const midy = (a[1] + b[1]) / 2;
        if (pinchPrev > 0) zoomAt(midx, midy, dist / pinchPrev);
        pinchPrev = dist;
    } else {
        vx += nx - ox; // pan
        vy += ny - oy;
    }
});
function endPointer(e) {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinchPrev = 0;
}
cv.addEventListener("pointerup", endPointer);
cv.addEventListener("pointercancel", endPointer);
cv.addEventListener("pointerleave", endPointer);

cv.addEventListener(
    "wheel",
    (e) => {
        e.preventDefault();
        const [cx, cy] = localXY(e);
        zoomAt(cx, cy, Math.exp(-e.deltaY * 0.0015));
    },
    { passive: false }
);

// ── Render loop ───────────────────────────────────────────────────────────
function frame(ts) {
    const t = ts / 1000;
    const W = cv.clientWidth, H = cv.clientHeight;

    // faint breathing about the canvas center — alive, but never fights the
    // user's pan/zoom (it doesn't mutate the view, just the drawn scale).
    const breathe = 1 + 0.008 * Math.sin(t * 0.6);
    const ds = vs * breathe;
    const cx = W / 2, cy = H / 2;
    const dx = cx - (cx - vx) * breathe;
    const dy = cy - (cy - vy) * breathe;

    ctx.fillStyle = ground();
    ctx.fillRect(0, 0, W, H);

    if (fadeT < 1) fadeT = Math.min(1, fadeT + 0.05);
    const blit = (bmp, alpha) => {
        ctx.globalAlpha = alpha;
        ctx.drawImage(bmp, dx, dy, bmpW * ds, bmpH * ds);
        ctx.globalAlpha = 1;
    };
    if (prev && fadeT < 1) blit(prev, 1 - fadeT);
    blit(cur, fadeT);

    // Night only: soft sheen + vignette keep the dark alive. Day stays clean
    // and cheerful like the original white draw map.
    if (!day) {
        const sweep = ((t * 60) % (W + 360)) - 180;
        const grad = ctx.createLinearGradient(sweep - 140, 0, sweep + 140, H);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(0.5, "rgba(220,240,210,0.05)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.globalCompositeOperation = "soft-light";
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = "source-over";

        const vg = ctx.createRadialGradient(
            W / 2, H / 2, Math.min(W, H) * 0.35,
            W / 2, H / 2, Math.max(W, H) * 0.7
        );
        vg.addColorStop(0, "rgba(0,0,0,0)");
        vg.addColorStop(1, "rgba(0,0,0,0.4)");
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);
    }

    // glyph labels — a baby-block letter at each cage centre, where scale
    // permits. Tracks the same breathe transform as the blit.
    if (labels && mode === "square" && babyBlocks && labelData.length) {
        ctx.globalAlpha = 0.45; // transparent enough to see the glyph underneath
        for (const L of labelData) {
            const sw = L.w * ds;
            if (sw < 22) continue; // too small to read at this scale
            const sx = dx + L.cx * ds, sy = dy + L.cy * ds;
            if (sx < -sw || sx > W + sw || sy < -sw || sy > H + sw) continue;
            babyBlocks.drawDirect(ctx, L.letter, sx, sy, sw * 0.62, {
                transform: D4B[L.d4] || "e",
                outline: false,
                color: day ? "#14210f" : "#eef5e6",
            });
        }
        ctx.globalAlpha = 1;
    }

    hud.textContent =
        (mode === "square"
            ? "order " + order + "   ·   " + sqSide(order) + "² square"
            : "old render · infinite patch") +
        "   ·   depth " + depth +
        "   ·   zoom " + (vs / fitS).toFixed(2) + "×";

    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
