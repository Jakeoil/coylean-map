"use strict";

// The Life Cycle — Jake's actual storyboard (life-cycle.md), baked and brought
// to life. A faithful replay of the drawn figure with a gentle breathing idle
// and a soft day↔night wash. The shapes live in life-cycle-data.js (no runtime
// LZ-String); re-bake from the `compressed-json` block of life-cycle.md the
// same way as turtle-paradise (LZString.decompressFromBase64).

import { LIFE_CYCLE } from "./life-cycle-data.js";

const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");
const hud = document.getElementById("hud");

let W = 0, H = 0;
function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    W = cv.clientWidth;
    H = cv.clientHeight;
    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
sizeCanvas();
window.addEventListener("resize", sizeCanvas);

let paused = false, pausedT = 0;
const playBtn = document.getElementById("play");
if (playBtn) {
    playBtn.onclick = () => {
        paused = !paused;
        playBtn.textContent = paused ? "▶ Play" : "❚❚ Pause";
    };
}

const PERIOD = 18; // seconds per day↔night breath of the whole figure
const DAY = "#fbfdf6", NIGHT = "#e6e3f4"; // kept light so the ink reads

function hexMix(a, b, t) {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return "rgb(" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join() + ")";
}

function roundRect(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
}

// ── replay the baked storyboard shapes ─────────────────────────────────────
function drawFigure(g) {
    for (const e of LIFE_CYCLE.shapes) {
        const hasFill = e.bg && e.bg !== "transparent";
        if (e.t === "rectangle") {
            const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
            g.save();
            g.translate(cx, cy);
            if (e.a) g.rotate(e.a);
            roundRect(g, -e.w / 2, -e.h / 2, e.w, e.h, Math.min(e.w, e.h) * 0.1);
            if (hasFill) { g.fillStyle = e.bg; g.fill(); }
            g.lineWidth = e.sw;
            g.strokeStyle = e.st;
            g.stroke();
            g.restore();
        } else if (e.t === "arrow" || e.t === "line") {
            if (!e.pts || e.pts.length < 2) continue;
            g.save();
            g.strokeStyle = e.st;
            g.lineWidth = Math.max(1, e.sw);
            g.lineCap = "round";
            g.lineJoin = "round";
            g.beginPath();
            g.moveTo(e.x + e.pts[0][0], e.y + e.pts[0][1]);
            for (let i = 1; i < e.pts.length; i++)
                g.lineTo(e.x + e.pts[i][0], e.y + e.pts[i][1]);
            g.stroke();
            if (e.t === "arrow") {
                const n = e.pts.length;
                const a = e.pts[n - 2], b = e.pts[n - 1];
                const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
                const bx = e.x + b[0], by = e.y + b[1], hl = 6;
                g.beginPath();
                g.moveTo(bx, by);
                g.lineTo(bx - hl * Math.cos(ang - 0.5), by - hl * Math.sin(ang - 0.5));
                g.moveTo(bx, by);
                g.lineTo(bx - hl * Math.cos(ang + 0.5), by - hl * Math.sin(ang + 0.5));
                g.stroke();
            }
            g.restore();
        } else if (e.t === "text") {
            g.save();
            g.fillStyle = e.st || "#1e1e1e";
            g.font = "600 " + (e.fs || 16) + "px 'Segoe UI', system-ui, sans-serif";
            g.textBaseline = "top";
            g.textAlign = "left";
            const lines = (e.text || "").split("\n");
            for (let i = 0; i < lines.length; i++)
                g.fillText(lines[i], e.x, e.y + i * (e.fs || 16) * 1.25);
            g.restore();
        }
    }
}

function frame(ts) {
    const t = paused ? pausedT : ts / 1000;
    if (!paused) pausedT = t;
    const p = (t % PERIOD) / PERIOD;
    const night = 0.5 - 0.5 * Math.cos(2 * Math.PI * p); // 0 day → 1 night → 0

    ctx.clearRect(0, 0, W, H);

    const pad = 26;
    const s = Math.min((W - 2 * pad) / LIFE_CYCLE.w, (H - 2 * pad) / LIFE_CYCLE.h);
    const ox = (W - LIFE_CYCLE.w * s) / 2;
    const oy = (H - LIFE_CYCLE.h * s) / 2;

    // light card ground, framed to the figure, washing day↔dusk
    const fr = 16;
    ctx.fillStyle = hexMix(DAY, NIGHT, night);
    roundRect(ctx, ox - fr, oy - fr, LIFE_CYCLE.w * s + 2 * fr,
        LIFE_CYCLE.h * s + 2 * fr, 16);
    ctx.fill();

    // gentle breathing about the figure centre — alive, but the drawing is the
    // drawing (no shapes added or moved)
    const cx = W / 2, cy = H / 2;
    const breath = 1 + 0.012 * Math.sin(t * 0.5);
    const sway = 0.006 * Math.sin(t * 0.33);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sway);
    ctx.scale(breath, breath);
    ctx.translate(-cx, -cy);
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    drawFigure(ctx);
    ctx.restore();

    hud.textContent = night > 0.5 ? "night ☾" : "day ☀";
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
