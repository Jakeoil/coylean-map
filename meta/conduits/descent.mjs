"use strict";

// The living descent: the real Coylean engine drawn in the draw map's
// "elaborate" style (priority-width nested rectangles, color-coded by depth).
// The math comes from coylean-core's boundary-seeded Propagation — NOT a
// hand-rolled seed — per the house rule that fromUniverseBoundary is the only
// coherent map. Zoom/pan are free navigation; depth is a separate knob.
import {
    Universe,
    Propagation,
    Seniority,
} from "../../coylean-explorer/coylean-core.js";
import { SlidingRuler } from "../sliding-ruler/volume-ruler-control/sliding-ruler.js";

// The 19-color depth palette, verbatim from coylean.js (elaborate mode).
const COLOR_LIST = [
    "#8FBC8F", "#FFEBCD", "#8A2BE2", "#00FFFF", "#DEB887",
    "#FAEBD7", "#FF7F50", "#F0FFFF", "#FF1493", "#8FBC8F",
    "#FFFACD", "#FF6347", "#B22222", "#C0C0C0", "#FFDEAD",
    "#A52A2A", "#FF00FF", "#40E0D0", "#FF00FF",
];

const MAPW = 1800;
const MAPH = 1350;
const SCALE = 6;
const MIN_DEPTH = 2;
const MAX_DEPTH = 12;
const PRI_MIN = 3;
const PRI_MAX = 12;

// priCap = the priority ceiling (engine maxPri). Lowering it clamps the tallest
// high-priority lines and makes the lattice periodic — useful when you've
// zoomed into a local region and the giant trunks would otherwise dominate.
let priCap = 10;

// ── Elaborate cell renderer, ported from coylean.js renderComplex ─────────
// Each cell is a priority-sized rectangle (width/height = priority·2·scale),
// placed at the running offset of accumulated cell widths. Driven by the
// engine's arrow matrices + priorities. down/right = IN arrows (from N / W),
// down_out/right_out = OUT arrows (to S / E).
function renderComplex(
    g, x_place, y_place, down, downPri, right, rightPri,
    down_out, right_out, depth
) {
    const width = downPri * 2;
    const height = rightPri * 2;
    const x_width = SCALE * width;
    for (let i = 0; i < priCap; i++) {
        let work_done = true;
        if (i > priCap - depth - 2) {
            work_done = false;
            g.fillStyle = COLOR_LIST[i % COLOR_LIST.length];
            const w = width - 2 * i - 1;
            const h = height - 2 * i - 1;
            if (w > 0) {
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

// ── The coherent map, rebuilt when the priority cap changes (a few ms) ────
const eastExtent = Math.ceil(MAPW / SCALE) + 8;
const southExtent = Math.ceil(MAPH / SCALE) + 8;
let downMatrix, rightMatrix, colPriority, rowPriority, numRows, numColumns;
function rebuildMap() {
    const u = Universe.create({
        northExtent: 1,
        westExtent: 1,
        eastExtent,
        southExtent,
        hInitCol: 1,
        vInitRow: 1,
        maxPri: priCap,
        seniority: Seniority.vertical(),
    });
    ({ downMatrix, rightMatrix, colPriority, rowPriority, numRows, numColumns } =
        Propagation.fromUniverseBoundary(u, { maxPri: priCap }));
}
rebuildMap();

// Day mode = cheerful white ground like the draw map's original; night = the
// dark ground the depth colors glow against.
let day = true;
const ground = () => (day ? "#ffffff" : "#0a0d0a");

// Render the whole map at a given depth into a fresh offscreen bitmap.
function makeBitmap(depth) {
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
                depth
            );
        }
        y += SCALE * rPri * 2;
    }
    return off;
}

// ── Camera (free zoom + pan) and depth knob ───────────────────────────────
const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");
const hud = document.getElementById("hud");
const depthCanvas = document.getElementById("depthRuler");
const priCanvas = document.getElementById("priRuler");

let depth = MIN_DEPTH;
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
    fitS = Math.min(cv.clientWidth / MAPW, cv.clientHeight / MAPH);
}
function fitView() {
    sizeCanvas();
    vs = fitS;
    vx = (cv.clientWidth - MAPW * vs) / 2;
    vy = (cv.clientHeight - MAPH * vs) / 2;
}
fitView();
window.addEventListener("resize", fitView);

function regen() {
    prev = cur;
    fadeT = 0;
    cur = makeBitmap(depth);
}

// Two SlidingRuler knobs, each value labeled on its dial, independent of the
// camera. depth = how many nested shells show; priority = the high-line cap.
// Colors are baked at construction, so both are rebuilt on day/night toggle.
const labelsFor = (lo, hi) => {
    const m = {};
    for (let v = lo; v <= hi; v++) m[v] = String(v);
    return m;
};
const DEPTH_LABELS = labelsFor(MIN_DEPTH, MAX_DEPTH);
const PRI_LABELS = labelsFor(PRI_MIN, PRI_MAX);

let depthRuler = null;
let priRuler = null;
function buildRulers() {
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
        max: MAX_DEPTH,
        value: depth,
        visibleRange: MAX_DEPTH - MIN_DEPTH + 2,
        height: 54,
        labels: DEPTH_LABELS,
        onChange: (v) => {
            if (v === depth) return;
            depth = v;
            regen();
        },
        ...pal,
    });
    if (priRuler) priRuler.destroy();
    priRuler = new SlidingRuler(priCanvas, {
        min: PRI_MIN,
        max: PRI_MAX,
        value: priCap,
        visibleRange: PRI_MAX - PRI_MIN + 2,
        height: 54,
        labels: PRI_LABELS,
        onChange: (v) => {
            if (v === priCap) return;
            priCap = v;
            rebuildMap(); // re-derive with the new high-line cap
            regen();
        },
        ...pal,
    });
}
buildRulers();

document.getElementById("reset").onclick = fitView;

const dayBtn = document.getElementById("daynight");
dayBtn.onclick = () => {
    day = !day;
    document.body.classList.toggle("day", day);
    document.body.classList.toggle("night", !day);
    dayBtn.textContent = day ? "☾ Night" : "☀ Day";
    buildRulers(); // recolor the dials to match
    // rebuild the map without crossfade so the two grounds don't blend
    prev = null;
    fadeT = 1;
    cur = makeBitmap(depth);
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
        ctx.drawImage(bmp, dx, dy, MAPW * ds, MAPH * ds);
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
        "generation " + (depth - MIN_DEPTH + 1) +
        "   ·   depth " + depth +
        "   ·   priority ≤ " + priCap +
        "   ·   zoom " + (vs / fitS).toFixed(2) + "×";

    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
