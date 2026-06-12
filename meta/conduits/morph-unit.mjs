"use strict";

// ════════════════════════════════════════════════════════════════════════
// The Morph Unit — elaborate edition. The smallest genuine Coylean square (an
// order-1 elaborate square) breathing on the SAME grow-and-split timeline as
// the Unbiased Map. It is the atom: solve "what does an elaborate, priority-
// shelled cell look like while it stretches to 3:2 and snaps" here, on one
// cheap unit, and the full elaborate Descent animation is just this tiled.
//
// It climbs the bottom of the V/H ladder — V1 → H1 → V2 — and ping-pongs:
//   V1 (k=2)  order-1 square, 1:1
//   H1 (k=3)  order-1 square, seniority flipped, box grown to grow:1 (the 3:2)
//   V2 (k=4)  order-2 square, 1:1 again — the snap: one cell has become two.
//
// Shared with the other pages:
//   • ladder-kinematics.js — ladderRung / aspW / aspH / ease / lerp
//   • elaborate-cell.js    — renderComplex (the IMMUTABLE coylean.js core)
//   • coylean-core.js      — Universe / Propagation (descent's integrateSquare)
//
// COMPROMISE (v1, frame-only sync): the elaborate square is rendered at its own
// priority proportions, then anisotropically fit into the unbiased grow box —
// so on H rungs the square STRETCHES wide rather than gaining real columns. The
// alternative (real subdivision) is the next experiment; this is the cheap one.
// ════════════════════════════════════════════════════════════════════════
import {
    Universe,
    Propagation,
    Seniority,
} from "../../coylean-explorer/coylean-core.js";
import { ladderRung, aspW, aspH, ease, lerp } from "./ladder-kinematics.js";
import { renderComplex } from "./elaborate-cell.js";
import { rungMap } from "../planet-coyleus/terrain-core.js";

const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");
const el = (id) => document.getElementById(id);

// Ladder window: V1 (k=2) … V2 (k=4). One grow (V1→H1) plus one snap (H1→V2).
const KLO = 2;
const KHI = 4;
const SECONDS_PER_LEG = 3.2; // ~time to cross the window once
const SPEED = (KHI - KLO) / SECONDS_PER_LEG;

const state = {
    k: KLO,
    dir: 1, // ping-pong direction
    playing: true,
    grow: 1.5, // snap proportion: 1.5 = 3:2 (default) · 2 = 2:1
    // A/B the two readings of the V→H grow:
    //   "stretch"   — one order-1 square (integrateSquare), anisotropically
    //                 stretched into the grow box: cells DISTORT wider.
    //   "subdivide" — the real unbiased field (rungMap): the H rung has 2× the
    //                 columns, so each cell genuinely SPLITS; honest aspect.
    mode: "subdivide",
};

// ── descent's integrateSquare, minimal (clean 1/1 baseline) ──
// An order-n square: unit N/W seed against side 2ⁿ to the S/E, reseeded by
// fromUniverseBoundary. maxPri = n+1 so the ∞ axis (col0/row0) frames it.
const sqCache = new Map();
function integrateSquare(order, senH) {
    const ck = `${order},${senH ? 1 : 0}`;
    let p = sqCache.get(ck);
    if (p) return p;
    const side = Math.max(1, 2 ** order);
    const maxPri = order + 1;
    const u = Universe.create({
        northExtent: 1,
        westExtent: 1,
        southExtent: side,
        eastExtent: side,
        hInitCol: 1,
        vInitRow: 1,
        maxPri,
        seniority: senH ? Seniority.horizontal() : Seniority.vertical(),
    });
    p = Propagation.fromUniverseBoundary(u, { maxPri });
    p.__order = order;
    sqCache.set(ck, p);
    return p;
}
const rung = (kInt) => {
    const r = ladderRung(kInt);
    return integrateSquare(r.order, r.seniorityH);
};

// ── draw one rung's elaborate square, fit into a pixel box, at an alpha ──
// Render the priority-shelled cells at scale 1 into [0,NW]×[0,NH] (the square's
// natural priority size), then map that onto the box with an anisotropic ctx
// scale — the frame-only stretch (see the COMPROMISE note above).
function drawRungElab(p, px, py, boxW, boxH, alpha) {
    const order = p.__order;
    const top = order + 1; // shell ceiling = ∞
    const depth = order + 2; // full nesting: every shell draws
    const colN = p.numColumns - 1;
    const rowN = p.numRows - 1;

    let NW = 0;
    let NH = 0;
    for (let i = 0; i <= colN; i++) NW += p.colPriority[i] * 2;
    for (let j = 0; j <= rowN; j++) NH += p.rowPriority[j] * 2;
    NW = Math.max(1, NW);
    NH = Math.max(1, NH);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(px, py);
    ctx.scale(boxW / NW, boxH / NH);

    let y = 0;
    for (let j = 0; j <= rowN; j++) {
        const rPri = p.rowPriority[j];
        let x = 0;
        for (let i = 0; i <= colN; i++) {
            const dPri = p.colPriority[i];
            const cw = renderComplex(
                ctx, x, y,
                p.downMatrix[j][i], dPri,
                p.rightMatrix[i][j], rPri,
                p.downMatrix[j + 1][i], p.rightMatrix[i + 1][j],
                depth, top, { scale: 1 }
            );
            x += cw;
        }
        y += rPri * 2;
    }
    ctx.restore();
    ctx.globalAlpha = 1;
}

// ── REAL-SUBDIVISION rung (the unbiased field, elaborate) ──
// rungMap gives the H rung 2× the columns (Nc = 2^(order+1)), so the wideness
// is real cells, not a stretch. computeMapModel's ∞-axis comes out as the maxPri
// cap (e.g. 32); remap it to finiteMax+1 so the frame reads as a frame and the
// elaborate cell widths (priority·2) stay sane — same trick unbiased's drawRung
// uses. Then fit ISOTROPICALLY (honest cells; the box may letterbox).
const rungSub = (kInt) => {
    const r = ladderRung(kInt);
    return rungMap(r.order, r.seniorityH, 1, 1);
};
function drawRungSub(m, px, py, boxW, boxH, alpha) {
    const inf = m.colPriority[0];
    let fin = 0;
    for (let c = 1; c < m.colPriority.length; c++)
        fin = Math.max(fin, m.colPriority[c]);
    for (let r = 1; r < m.rowPriority.length; r++)
        fin = Math.max(fin, m.rowPriority[r]);
    const cap = fin + 1;
    const eff = (p) => (p >= inf ? cap : p);
    const top = cap; // shell ceiling = the effective ∞
    const depth = cap; // full nesting
    const colN = m.Mc - 1;
    const rowN = m.Mr - 1;

    let NW = 0;
    let NH = 0;
    for (let i = 0; i <= colN; i++) NW += eff(m.colPriority[i]) * 2;
    for (let j = 0; j <= rowN; j++) NH += eff(m.rowPriority[j]) * 2;
    NW = Math.max(1, NW);
    NH = Math.max(1, NH);

    // isotropic — preserve the honest cell aspect, centre in the box
    const s = Math.min(boxW / NW, boxH / NH);
    const ox = px + (boxW - NW * s) / 2;
    const oy = py + (boxH - NH * s) / 2;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(ox, oy);
    ctx.scale(s, s);

    let y = 0;
    for (let j = 0; j <= rowN; j++) {
        const rPri = eff(m.rowPriority[j]);
        let x = 0;
        for (let i = 0; i <= colN; i++) {
            const dPri = eff(m.colPriority[i]);
            const cw = renderComplex(
                ctx, x, y,
                m.downMatrix[j][i], dPri,
                m.rightMatrix[i][j], rPri,
                m.downMatrix[j + 1][i], m.rightMatrix[i + 1][j],
                depth, top, { scale: 1 }
            );
            x += cw;
        }
        y += rPri * 2;
    }
    ctx.restore();
    ctx.globalAlpha = 1;
}

// ── frame: cross-fade adjacent rungs into the interpolated grow box ──
const MARGIN = 0.84;
function render() {
    const VPw = cv.width;
    const VPh = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, VPw, VPh);

    const kInt = Math.max(KLO, Math.min(KHI - 1, Math.floor(state.k)));
    const f = ease(Math.min(1, Math.max(0, state.k - kInt)));

    const Wci = lerp(aspW(kInt, state.grow), aspW(kInt + 1, state.grow), f);
    const Hci = lerp(aspH(kInt, state.grow), aspH(kInt + 1, state.grow), f);

    const fit = Math.min(VPw / Wci, VPh / Hci) * MARGIN;
    const boxW = Wci * fit;
    const boxH = Hci * fit;
    const px = (VPw - boxW) / 2;
    const py = (VPh - boxH) / 2;

    // both rungs share the interpolated grow box; A fades out as B fades in
    if (state.mode === "subdivide") {
        drawRungSub(rungSub(kInt), px, py, boxW, boxH, 1 - f);
        drawRungSub(rungSub(kInt + 1), px, py, boxW, boxH, f);
    } else {
        drawRungElab(rung(kInt), px, py, boxW, boxH, 1 - f);
        drawRungElab(rung(kInt + 1), px, py, boxW, boxH, f);
    }

    syncReadout(kInt, f);
}

const rungName = (kInt) => {
    const r = ladderRung(kInt);
    return (r.seniorityH ? "H" : "V") + r.order;
};
function syncReadout(kInt, f) {
    const a = rungName(kInt);
    const b = rungName(kInt + 1);
    // V→H grows (widen to 3:2); H→V snaps (doubles back to a square)
    const grew = ladderRung(kInt).seniorityH === false;
    el("phase").textContent =
        f < 0.04 ? `${a} — a square`
        : f > 0.96 ? `${b}`
        : grew ? `${a} → ${b} · grow · widen to ${state.grow === 2 ? "2:1" : "3:2"}`
        : `${a} → ${b} · snap · the cell divides in two`;
}

// ── animation loop (ping-pong V1 ⇄ V2) ──
let last = performance.now();
function frame(now) {
    const dt = (now - last) / 1000;
    last = now;
    if (state.playing) {
        state.k += state.dir * Math.max(0, dt) * SPEED;
        if (state.k >= KHI) {
            state.k = KHI;
            state.dir = -1;
        } else if (state.k <= KLO) {
            state.k = KLO;
            state.dir = 1;
        }
    }
    render();
    requestAnimationFrame(frame);
}

// ── canvas sizing ──
function resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = cv.getBoundingClientRect();
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    render();
}
window.addEventListener("resize", resize);

// ── controls ──
function syncPlay() {
    el("play").textContent = state.playing ? "⏸ Pause" : "▶ Play";
}
el("play").onclick = () => {
    state.playing = !state.playing;
    syncPlay();
};
function syncSnap() {
    el("snap").textContent =
        state.grow === 2 ? "Snap 2:1 ⇄ 3:2" : "Snap 3:2 ⇄ 2:1";
    el("snap").classList.toggle("on", state.grow === 1.5);
}
el("snap").onclick = () => {
    state.grow = state.grow === 1.5 ? 2 : 1.5;
    syncSnap();
};
// A/B: stretch one square vs. subdivide into real columns
function syncMode() {
    el("mode").textContent =
        state.mode === "subdivide" ? "Render: subdivide" : "Render: stretch";
    el("mode").classList.toggle("on", state.mode === "subdivide");
}
el("mode").onclick = () => {
    state.mode = state.mode === "subdivide" ? "stretch" : "subdivide";
    syncMode();
};
// spacebar: pause + frame-step in the current direction
window.addEventListener("keydown", (e) => {
    if (e.code !== "Space") return;
    e.preventDefault();
    state.playing = false;
    syncPlay();
    state.k = Math.max(KLO, Math.min(KHI, state.k + state.dir * 0.05));
});

syncPlay();
syncSnap();
syncMode();
resize();
requestAnimationFrame(frame);
