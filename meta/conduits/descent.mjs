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
} from "../../coylean-explorer/coylean-core.js";
import { SlidingRuler } from "../sliding-ruler/volume-ruler-control/sliding-ruler.js";

// The 19-color depth palette, verbatim from coylean.js (elaborate mode). Index
// = shell: 0 outermost. Low depth shows only the inner (warm/bright) shells.
const COLOR_LIST = [
    "#8FBC8F", "#FFEBCD", "#8A2BE2", "#00FFFF", "#DEB887",
    "#FAEBD7", "#FF7F50", "#F0FFFF", "#FF1493", "#8FBC8F",
    "#FFFACD", "#FF6347", "#B22222", "#C0C0C0", "#FFDEAD",
    "#A52A2A", "#FF00FF", "#40E0D0", "#FF00FF",
];

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
const ORDER_MIN = 2; // side 4 — the smallest square that reads as a tile
const ORDER_MAX = 7; // side 128 — the ceiling (~1.5k px natural)

// Old-render (infinite patch) constants — the reference mode.
const MAPW = 1800;
const MAPH = 1350;
const PATCH_MAXP = 9;
const eastExtent = Math.ceil(MAPW / SCALE) + 8;
const southExtent = Math.ceil(MAPH / SCALE) + 8;

let mode = "square"; // "square" (canonical) | "patch" (old infinite render)

// Show the square's RESULT rows — the last down/right matrix line leaving the
// far edge. On = spine pokes out (open, continues into the next tile); off =
// capped, a closed square. Square mode only.
let showResult = true;

// Orientation (anchor quadrant + seniority), mirroring compound-glyphs. The
// map re-integrates on each toggle. Defaults = the clean 1/1 / vertical baseline.
const orient = { curH: 1, curV: 1, senH: false };
const seniorityNow = () =>
    orient.senH ? Seniority.horizontal() : Seniority.vertical();

// ── Elaborate cell renderer — the IMMUTABLE core, ported from coylean.js ───
// This is the elaborate-mode algorithm verbatim from the index draw map
// (coylean.js renderComplex); the Descent / old-render is a port of it. DO NOT
// fold render variants into it. Each cell is a priority-sized rectangle
// (width/height = priority·2·scale), placed at the running offset of
// accumulated cell widths, driven by the engine's arrow matrices + priorities.
// down/right = IN arrows (from N / W), down_out/right_out = OUT arrows (to S /
// E). `top` is the shell ceiling (PATCH_MAXP, playing coylean.js's maxPri);
// shell i draws only while `i > top - depth - 2`, so LOW depth shows just the
// inner colourful shells of the big trunks (small cells vanish) and raising
// depth fills outward to the green frames.
//
// Colour is the coylean.js default: ONE shell colour COLOR_LIST[i % len] per
// ring i (shell index from the outside), shared by the vertical and horizontal
// arms — green frames with rainbow innards. (A trailing `{ shade }` hook exists
// for callers that need a different per-arm colour without touching this core;
// both modes here use the default.)
const SHELL_SHADE = (i) => COLOR_LIST[i % COLOR_LIST.length]; // coylean.js

function renderComplex(
    g, x_place, y_place, down, downPri, right, rightPri,
    down_out, right_out, depth, top, opts = {}
) {
    const shade = opts.shade || SHELL_SHADE;
    const width = downPri * 2;
    const height = rightPri * 2;
    const x_width = SCALE * width;
    for (let i = 0; i < top; i++) {
        let work_done = true;
        if (i > top - depth - 2) {
            work_done = false;
            const w = width - 2 * i - 1;
            const h = height - 2 * i - 1;
            if (w > 0) {
                g.fillStyle = shade(i, downPri); // vertical arm
                if (down) {
                    if (down_out) {
                        g.fillRect(x_place + SCALE * (i + 1), y_place,
                            SCALE * w, SCALE * (rightPri * 2));
                    } else {
                        g.fillRect(x_place + SCALE * (i + 1), y_place,
                            SCALE * w, SCALE * (rightPri + 1));
                    }
                }
                if (down_out) {
                    g.fillRect(x_place + SCALE * (i + 1),
                        y_place + SCALE * rightPri, SCALE * w, SCALE * rightPri);
                }
                work_done = true;
            }
            if (h > 0) {
                g.fillStyle = shade(i, rightPri); // horizontal arm
                if (right) {
                    if (right_out) {
                        g.fillRect(x_place, y_place + SCALE * (i + 1),
                            SCALE * (downPri * 2), SCALE * h);
                    }
                    g.fillRect(x_place, y_place + SCALE * (i + 1),
                        SCALE * (downPri + 1), SCALE * h);
                }
                if (right_out) {
                    g.fillRect(x_place + SCALE * downPri,
                        y_place + SCALE * (i + 1), SCALE * downPri, SCALE * h);
                }
                work_done = true;
            }
        }
        if (!work_done) break;
    }
    return x_width;
}

// ── The active map's matrices + bitmap size, rebuilt on any change ─────────
let downMatrix, rightMatrix, colPriority, rowPriority, numRows, numColumns;
let bmpW = SCALE, bmpH = SCALE; // natural pixel size of the active bitmap

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

// Pixel size over the whole propagation — every column/row (priority-0 cells
// contribute width 0; the ∞ axis is the wide frame, the spine the last band).
function squarePx(p) {
    let w = 0, h = 0;
    for (let i = 0; i < p.numColumns; i++) w += p.colPriority[i] * 2;
    for (let j = 0; j < p.numRows; j++) h += p.rowPriority[j] * 2;
    return [Math.max(SCALE, SCALE * w), Math.max(SCALE, SCALE * h)];
}

let order = ORDER_MIN; // set to the fitting default once the canvas exists

function buildSquare() {
    const p = integrateSquare(order);
    ({ downMatrix, rightMatrix, colPriority, rowPriority, numRows, numColumns } =
        p);
    [bmpW, bmpH] = squarePx(p);
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
// The RESULT rows — the last row of downMatrix (resultDown) and last column of
// rightMatrix (resultRight) — are the out-arrows leaving the far (S/E) edge,
// reached as down_out at the last row and right_out at the last column. Showing
// them lets the spine trunks poke out the bottom/right (the square continuing
// into the next tile); hiding them caps the spine into a closed square.
function makeSquareBitmap(depth) {
    const off = document.createElement("canvas");
    off.width = Math.max(1, Math.round(bmpW));
    off.height = Math.max(1, Math.round(bmpH));
    const g = off.getContext("2d");
    g.fillStyle = ground();
    g.fillRect(0, 0, off.width, off.height);

    const top = sqMaxPri(order); // shell ceiling = ∞ (order + 1)
    const colN = numColumns - 1, rowN = numRows - 1; // last real col / row
    let y = 0;
    for (let j = 0; j <= rowN; j++) {
        const rPri = rowPriority[j];
        let x = 0;
        for (let i = 0; i <= colN; i++) {
            const dPri = colPriority[i];
            // suppress the result row/col (last down/right matrix line) unless shown
            const dOut = !showResult && j === rowN
                ? false : downMatrix[j + 1][i];
            const rOut = !showResult && i === colN
                ? false : rightMatrix[i + 1][j];
            x += renderComplex(
                g, x, y,
                downMatrix[j][i], dPri,
                rightMatrix[i][j], rPri,
                dOut, rOut,
                depth, top
            );
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
            x += renderComplex(
                g, x, y,
                downMatrix[j][i], dPri,
                rightMatrix[i][j], rPri,
                downMatrix[j + 1][i], rightMatrix[i + 1][j],
                depth, PATCH_MAXP
            );
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
    buildRulers(); // depth ruler tops out at the new order
    syncLadder();
    if (mode === "square") { fitView(); hardRegen(); }
}

function setMode(m) {
    if (m === mode) return;
    mode = m;
    depth = mode === "square" ? Math.max(MIN_DEPTH, sqMaxPri(order)) : PATCH_MAXP;
    buildActive();
    buildRulers();
    syncLadder();
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

// ── Ladder card: the order meter, rungs coloured by the order palette ──
// Rung o is boxed in orderColor(o) = COLOR_LIST[o−1] (1 green · 2 yellow ·
// 3 purple · 4 blue …) — the colour the square's frame takes at that order.
// Order = the canonical
// square's order: side 2^o + 1, tallest trunk priority o. Click a rung to
// resize the square. (In patch mode the ladder is disabled.)
const ladderEl = document.getElementById("ladder");
const orderLabel = document.getElementById("orderLabel");
function syncLadder() {
    ladderEl.classList.toggle("disabled", mode !== "square");
    for (const b of ladderEl.children) {
        const o = +b.dataset.order;
        b.classList.toggle("on", o <= order); // lit up to the current order
        b.classList.toggle("cur", o === order);
    }
    if (orderLabel)
        orderLabel.textContent = mode === "square" ? String(order) : "—";
}
function buildLadder() {
    ladderEl.innerHTML = "";
    // top rung = highest order (you climb UP to bigger squares)
    for (let o = ORDER_MAX; o >= ORDER_MIN; o--) {
        const b = document.createElement("button");
        b.className = "rung";
        b.dataset.order = String(o);
        b.style.setProperty("--c", orderColor(o));
        b.title = "order " + o + " · " + sqSide(o) + "² square";
        const box = document.createElement("span");
        box.className = "rung-box";
        const num = document.createElement("span");
        num.className = "rung-num";
        num.textContent = String(o);
        b.append(box, num);
        b.onclick = () => { if (mode === "square") setOrder(o); };
        ladderEl.append(b);
    }
    syncLadder();
}
buildLadder();

// One SlidingRuler knob: depth = how many nested shells show (from the inside
// out). Its max tracks the shell ceiling (order in square mode, PATCH_MAXP in
// patch). Colors are baked at construction, so it's rebuilt on every change.
const labelsFor = (lo, hi) => {
    const m = {};
    for (let v = lo; v <= hi; v++) m[v] = String(v);
    return m;
};

let depthRuler = null;
function buildRulers() {
    const maxDepth = mode === "square" ? Math.max(MIN_DEPTH, sqMaxPri(order)) : PATCH_MAXP;
    if (depth > maxDepth) depth = maxDepth;
    const pal = day
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
        ...pal,
    });
}
buildRulers();

document.getElementById("reset").onclick = fitView;

const oldToggle = document.getElementById("oldrender");
if (oldToggle) {
    oldToggle.checked = mode === "patch";
    oldToggle.addEventListener("change", () =>
        setMode(oldToggle.checked ? "patch" : "square")
    );
}

// Result-rows toggle (square only): show/hide the trailing down/right result
// line at the far edge.
const resultToggle = document.getElementById("resultrows");
if (resultToggle) {
    resultToggle.checked = showResult;
    resultToggle.addEventListener("change", () => {
        showResult = resultToggle.checked;
        if (mode === "square") regen();
    });
}

const dayBtn = document.getElementById("daynight");
dayBtn.onclick = () => {
    day = !day;
    document.body.classList.toggle("day", day);
    document.body.classList.toggle("night", !day);
    dayBtn.textContent = day ? "☾ Night" : "☀ Day";
    buildRulers(); // recolor the dials to match
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

    hud.textContent =
        (mode === "square"
            ? "order " + order + "   ·   " + sqSide(order) + "² square"
            : "old render · infinite patch") +
        "   ·   depth " + depth +
        "   ·   zoom " + (vs / fitS).toFixed(2) + "×";

    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
