"use strict";

// The living descent: the real Coylean engine drawn in the draw map's
// "elaborate" style (nested rectangles color-coded by depth). The math comes
// from coylean-core's boundary-seeded Propagation — NOT a hand-rolled seed —
// per the house rule that fromUniverseBoundary is the only coherent map.
import {
    Universe,
    Propagation,
    Seniority,
} from "../../coylean-explorer/coylean-core.js";

// The 19-color depth palette, verbatim from coylean.js (elaborate mode).
const COLOR_LIST = [
    "#8FBC8F", "#FFEBCD", "#8A2BE2", "#00FFFF", "#DEB887",
    "#FAEBD7", "#FF7F50", "#F0FFFF", "#FF1493", "#8FBC8F",
    "#FFFACD", "#FF6347", "#B22222", "#C0C0C0", "#FFDEAD",
    "#A52A2A", "#FF00FF", "#40E0D0", "#FF00FF",
];

const MAPW = 1600;
const MAPH = 1200;
const SCALE = 5;
const MAXP = 10; // priority ceiling → ~10 nestable depth layers
const MIN_DEPTH = 2;
const MAX_DEPTH = MAXP + 2;

// ── Build the coherent map once (cheap: a few ms) ─────────────────────────
const eastExtent = Math.ceil(MAPW / (SCALE * 2)) + 8;
const southExtent = Math.ceil(MAPH / (SCALE * 2)) + 8;
const universe = Universe.create({
    northExtent: 1,
    westExtent: 1,
    eastExtent,
    southExtent,
    hInitCol: 1,
    vInitRow: 1,
    maxPri: MAXP,
    seniority: Seniority.vertical(),
});
const {
    downMatrix,
    rightMatrix,
    colPriority,
    rowPriority,
    numRows,
    numColumns,
} = Propagation.fromUniverseBoundary(universe, { maxPri: MAXP });

// ── Elaborate cell renderer, ported from coylean.js renderComplex ─────────
// Driven by the engine's arrow matrices + priorities instead of a re-derived
// reaction. Convention: down/right are the IN arrows (from N / from W),
// down_out/right_out the OUT arrows (to S / to E).
function renderComplex(
    g, x_place, y_place, down, downPri, right, rightPri,
    down_out, right_out, depth
) {
    const width = downPri * 2;
    const height = rightPri * 2;
    const x_width = SCALE * width;
    for (let i = 0; i < MAXP; i++) {
        let work_done = true;
        if (i > MAXP - depth - 2) {
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

// Render the whole map at a given depth into a fresh offscreen bitmap.
function makeBitmap(depth) {
    const off = document.createElement("canvas");
    off.width = MAPW;
    off.height = MAPH;
    const g = off.getContext("2d");
    g.fillStyle = "#0a0d0a"; // dark ground — the depth colors glow against it
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

// ── Living camera + crossfade ─────────────────────────────────────────────
const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");
const hud = document.getElementById("hud");
const announce = document.getElementById("announce");

let depth = MIN_DEPTH;
let cur = makeBitmap(depth);
let prev = null;
let fadeT = 1; // 1 = fully showing cur

let zoom = 1, zoomTo = 1;
let fx = 0.5, fy = 0.5, fxTo = 0.5, fyTo = 0.5;

function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    cv.width = cv.clientWidth * dpr;
    cv.height = cv.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
sizeCanvas();
window.addEventListener("resize", sizeCanvas);

let announceTimer = 0;
function showAnnounce(text) {
    announce.textContent = text;
    announce.style.opacity = "1";
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => (announce.style.opacity = "0"), 1700);
}

function regen() {
    prev = cur;
    fadeT = 0;
    cur = makeBitmap(depth);
}

function descend(px, py) {
    if (depth >= MAX_DEPTH) {
        showAnnounce("the deepest shell — turtles still, below");
        return;
    }
    depth++;
    if (px !== undefined) {
        fxTo = Math.max(0.18, Math.min(0.82, px));
        fyTo = Math.max(0.18, Math.min(0.82, py));
    }
    zoomTo = Math.min(zoomTo * 1.32, 8);
    regen();
    const g = depth - MIN_DEPTH + 1;
    if (depth === 6) showAnnounce("a new generation splits open");
    else if (depth === 10) showAnnounce("deeper — the small turtles appear");
    else showAnnounce("generation " + g);
}

function ascend() {
    if (depth <= MIN_DEPTH) return;
    depth--;
    zoomTo = Math.max(zoomTo / 1.32, 1);
    regen();
}

document.getElementById("deeper").onclick = () => descend();
document.getElementById("shallower").onclick = ascend;
document.getElementById("reset").onclick = () => {
    depth = MIN_DEPTH;
    zoom = zoomTo = 1;
    fx = fy = fxTo = fyTo = 0.5;
    regen();
};
cv.addEventListener("click", (e) => {
    const r = cv.getBoundingClientRect();
    descend((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
});

// draw a bitmap "contained" with zoom + fractional focus + breathing
function blit(bmp, alpha, breathe) {
    const W = cv.clientWidth, H = cv.clientHeight;
    const base = Math.min(W / bmp.width, H / bmp.height);
    const s = base * zoom * breathe;
    const dw = bmp.width * s, dh = bmp.height * s;
    const dx = W / 2 - fx * dw;
    const dy = H / 2 - fy * dh;
    ctx.globalAlpha = alpha;
    ctx.drawImage(bmp, dx, dy, dw, dh);
    ctx.globalAlpha = 1;
}

function frame(ts) {
    const t = ts / 1000;
    zoom += (zoomTo - zoom) * 0.06;
    fx += (fxTo - fx) * 0.06;
    fy += (fyTo - fy) * 0.06;
    // slow ambient drift when not actively diving — never fully dead
    const driftX = 0.5 + 0.012 * Math.sin(t * 0.17);
    const driftY = 0.5 + 0.012 * Math.cos(t * 0.13);
    if (Math.abs(fxTo - 0.5) < 0.001) fx += (driftX - fx) * 0.01;
    if (Math.abs(fyTo - 0.5) < 0.001) fy += (driftY - fy) * 0.01;
    const breathe = 1 + 0.02 * Math.sin(t * 0.6);

    const W = cv.clientWidth, H = cv.clientHeight;
    ctx.fillStyle = "#0a0d0a";
    ctx.fillRect(0, 0, W, H);

    if (fadeT < 1) fadeT = Math.min(1, fadeT + 0.04);
    if (prev && fadeT < 1) blit(prev, 1 - fadeT, breathe);
    blit(cur, fadeT, breathe);

    // ambient sheen sweep — soft moving light keeps it alive
    const sweep = ((t * 60) % (W + 360)) - 180;
    const grad = ctx.createLinearGradient(sweep - 140, 0, sweep + 140, H);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, "rgba(220,240,210,0.05)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";

    // gentle vignette
    const vg = ctx.createRadialGradient(
        W / 2, H / 2, Math.min(W, H) * 0.35,
        W / 2, H / 2, Math.max(W, H) * 0.7
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    hud.textContent =
        "generation " + (depth - MIN_DEPTH + 1) +
        "   ·   depth " + depth +
        "   ·   zoom " + zoom.toFixed(2) + "×" +
        "   ·   " + numColumns + "×" + numRows + " · maxPri " + MAXP;

    document.getElementById("shallower").disabled = depth <= MIN_DEPTH;

    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
