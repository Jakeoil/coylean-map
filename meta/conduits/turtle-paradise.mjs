"use strict";

// Turtle Paradise — a living catalog of glyphs in the elaborate-render style.
//
// Each tile is one glyph brought to life with a calm "breathing idle": the
// cluster sways and breathes, the dots pulse and blink like eyes. Two layers
// share the one animation loop:
//   • the hero tile REPLAYS the hand sketch from `turtle paradise.md`
//     (baked into turtle-paradise-data.js — no runtime LZ-String), keyed to
//     the F glyph (V77) per glyphs/assignments.json.
//   • the rest are ENGINE tiles: the real coylean glyph (computeGlyphMatrices)
//     drawn in the same green/yellow/pink palette, then breathed alive.
//
// To re-bake the sketch if the .md changes (needs `npm i lz-string`):
//   const LZ=require("lz-string"); const md=fs.readFileSync(".../turtle
//   paradise.md","utf8"); JSON.parse(LZ.decompressFromBase64(
//   md.match(/```compressed-json\n([\s\S]*?)\n```/)[1].replace(/\s+/g,"")));

import { TURTLE_PARADISE } from "./turtle-paradise-data.js";
import { Seniority } from "../../coylean-explorer/coylean-core.js";
import { computeGlyphMatrices } from "../../glyphs/glyph-core.js";

// ── The catalog ────────────────────────────────────────────────────────────
// Entry 1 is the sketch (the F glyph). The engine entries are the lettered
// V-glyphs from glyphs/assignments.json — adding a row here grows the catalog.
const CATALOG = [
    {
        kind: "sketch",
        letter: "F",
        code: "V77",
        sym: "F\\",
        title: "Turtle Paradise",
        blurb: "this map is an example of the elaborate rendering",
        featured: true,
        data: TURTLE_PARADISE,
    },
    ...[
        ["P", "V17", "P/", 1, 7],
        ["J", "V66", "J\\", 6, 6],
        ["B", "V56", "B/", 5, 6],
        ["O", "V00", "O\\", 0, 0],
        ["L", "V11", "L/", 1, 1],
        ["Q", "V25", "Q\\", 2, 5],
        ["E", "V07", "E\\", 0, 7],
        ["V", "V15", "V/", 1, 5],
        ["C", "V51", "C/", 5, 1],
        ["R", "V61", "R\\", 6, 1],
        ["N", "V16", "N/", 1, 6],
    ].map(([letter, code, sym, dc, rc]) => ({
        kind: "engine",
        letter,
        code,
        sym,
        title: letter + " — a seedling",
        blurb: "the " + code + " glyph, growing",
        dc,
        rc,
    })),
];

// ── Palette (the glyph / turtle colors) ────────────────────────────────────
const GREEN = "#b2f2bb";
const GREEN_DEEP = "#2f9e44";
const YELLOW = "#ffec99";
const YELLOW_DEEP = "#f08c00";
const PINK = "#ffc9c9";
const GROUND = "#fbfdf6";

// ── Breathing-idle motion helpers ──────────────────────────────────────────
const breath = (t, p) => 1 + 0.018 * Math.sin(t * 0.6 + p);
const sway = (t, p) => 0.014 * Math.sin(t * 0.33 + p);
const pulse = (t, p) => 1 + 0.12 * Math.sin(t * 1.5 + p);

// A slow blink: eyes mostly open, snapping shut briefly each cycle.
function blink(t, p) {
    const period = 4.6;
    const x = (((t + p * 1.7) % period) + period) % period / period;
    const b = x > 0.94 ? Math.sin(((x - 0.94) / 0.06) * Math.PI) : 0;
    return 1 - 0.82 * b;
}

function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}

// Wrap the whole drawing in the cluster's breathe + sway about (cx, cy).
function withLife(ctx, t, phase, cx, cy, fn) {
    const s = breath(t, phase);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sway(t, phase));
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
    fn();
    ctx.restore();
}

// ── Sketch tile: replay the baked excalidraw shapes, alive ─────────────────
function drawSketch(ctx, W, H, entry, t, phase) {
    const data = entry.data;
    const pad = 26;
    const s = Math.min((W - 2 * pad) / data.w, (H - 2 * pad) / data.h);
    const ox = (W - data.w * s) / 2;
    const oy = (H - data.h * s) / 2;

    // cream ground framed to the artwork (the hero band is wide; the sketch is
    // portrait — flooding the whole tile would look empty)
    const fr = 14;
    ctx.fillStyle = GROUND;
    roundRect(ctx, ox - fr, oy - fr, data.w * s + 2 * fr, data.h * s + 2 * fr,
        18);
    ctx.fill();

    withLife(ctx, t, phase, W / 2, H / 2, () => {
        ctx.save();
        ctx.translate(ox, oy);
        ctx.scale(s, s);
        const shapes = data.shapes;
        for (let i = 0; i < shapes.length; i++) {
            const e = shapes[i];
            if (e.t === "text") continue; // labels live in the tile chrome
            const cx = e.x + e.w / 2;
            const cy = e.y + e.h / 2;
            ctx.save();
            ctx.translate(cx, cy);
            if (e.a) ctx.rotate(e.a);
            const hasFill = e.bg && e.bg !== "transparent";
            if (e.t === "ellipse") {
                // a living eye / bud: pulse, and blink shut now and then
                const ph = phase + i * 0.9;
                const k = pulse(t, ph);
                const by = blink(t, ph);
                ctx.scale(k, k * by);
                ctx.beginPath();
                ctx.ellipse(0, 0, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
                if (hasFill) {
                    ctx.fillStyle = e.bg;
                    ctx.fill();
                }
                ctx.lineWidth = e.sw;
                ctx.strokeStyle = e.st;
                ctx.stroke();
            } else {
                const r = Math.min(e.w, e.h) * 0.18;
                roundRect(ctx, -e.w / 2, -e.h / 2, e.w, e.h, r);
                if (hasFill) {
                    ctx.fillStyle = e.bg;
                    ctx.fill();
                }
                ctx.lineWidth = e.sw;
                ctx.strokeStyle = e.st;
                ctx.stroke();
            }
            ctx.restore();
        }
        ctx.restore();
    });
}

// ── Engine tile: the real glyph in the turtle palette, alive ───────────────
const NC = 3; // cells per glyph axis
const matCache = new Map();
function glyphMatrices(entry) {
    if (matCache.has(entry.code)) return matCache.get(entry.code);
    const m = computeGlyphMatrices(entry.dc, entry.rc, Seniority.vertical());
    matCache.set(entry.code, m);
    return m;
}

function drawEngine(ctx, W, H, entry, t, phase) {
    const { downMatrix, rightMatrix } = glyphMatrices(entry);
    const pad = 30;
    const span = NC + 1; // grid positions 0..NC, plus the exit ring
    const cell = Math.min(W - 2 * pad, H - 2 * pad) / span;
    const gx = (W - cell * span) / 2;
    const gy = (H - cell * span) / 2;
    const px = (g) => g * cell;

    ctx.fillStyle = GROUND;
    roundRect(ctx, 8, 8, W - 16, H - 16, 16);
    ctx.fill();

    withLife(ctx, t, phase, W / 2, H / 2, () => {
        ctx.save();
        ctx.translate(gx, gy);

        // soft body behind the live 3×3 area
        ctx.fillStyle = PINK + "55";
        roundRect(ctx, px(0.5), px(0.5), px(NC), px(NC), cell * 0.5);
        ctx.fill();

        // translucent letter watermark
        ctx.save();
        ctx.fillStyle = YELLOW_DEEP + "33";
        ctx.font = "bold " + cell * 2.4 + "px Monaco, Menlo, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(entry.letter, px(span / 2), px(span / 2));
        ctx.restore();

        // green stems — the glyph's propagated segments
        ctx.strokeStyle = GREEN_DEEP;
        ctx.lineCap = "round";
        ctx.lineWidth = cell * 0.16;
        for (let y = 0; y <= NC; y++) {
            for (let x = 0; x < NC; x++) {
                if (downMatrix[y][x]) {
                    const xr = px(x + 1);
                    ctx.beginPath();
                    ctx.moveTo(xr, px(y));
                    ctx.lineTo(xr, px(y + 1));
                    ctx.stroke();
                }
            }
        }
        for (let x = 0; x <= NC; x++) {
            for (let y = 0; y < NC; y++) {
                if (rightMatrix[x][y]) {
                    const yb = px(y + 1);
                    ctx.beginPath();
                    ctx.moveTo(px(x), yb);
                    ctx.lineTo(px(x + 1), yb);
                    ctx.stroke();
                }
            }
        }

        // input / output dots as pulsing, blinking eyes
        const drawEye = (cxp, cyp, filled, idx) => {
            const ph = phase + idx * 0.8;
            const r = cell * 0.18 * pulse(t, ph);
            const by = blink(t, ph);
            ctx.save();
            ctx.translate(cxp, cyp);
            ctx.scale(1, by);
            ctx.beginPath();
            ctx.ellipse(0, 0, r, r, 0, 0, Math.PI * 2);
            if (filled) {
                ctx.fillStyle = GREEN_DEEP;
                ctx.fill();
            } else {
                ctx.lineWidth = cell * 0.06;
                ctx.strokeStyle = GREEN_DEEP;
                ctx.stroke();
            }
            ctx.restore();
        };
        let k = 0;
        for (let i = 0; i < 3; i++) {
            drawEye(px(i + 1), px(0), !!(entry.dc & (1 << i)), k++);
            drawEye(px(0), px(i + 1), !!(entry.rc & (1 << i)), k++);
            drawEye(px(i + 1), px(span), downMatrix[NC][i], k++);
            drawEye(px(span), px(i + 1), rightMatrix[NC][i], k++);
        }
        ctx.restore();
    });
}

// ── Build the catalog DOM ──────────────────────────────────────────────────
const grid = document.getElementById("catalog");
const tiles = [];

function makeTile(entry, idx) {
    const card = document.createElement("article");
    card.className = "card" + (entry.featured ? " featured" : "");

    const stage = document.createElement("div");
    stage.className = "tile-stage";
    const canvas = document.createElement("canvas");
    stage.appendChild(canvas);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML =
        '<span class="badge">' +
        entry.letter +
        "</span>" +
        '<div class="meta-text"><div class="title">' +
        entry.title +
        '</div><div class="sub"><code>' +
        entry.code +
        "</code> · " +
        entry.sym +
        "</div></div>";

    card.appendChild(stage);
    card.appendChild(meta);
    grid.appendChild(card);

    const ctx = canvas.getContext("2d");
    tiles.push({
        entry,
        canvas,
        ctx,
        stage,
        phase: idx * 1.7,
        draw: entry.kind === "sketch" ? drawSketch : drawEngine,
    });
}
CATALOG.forEach(makeTile);

// ── Sizing (DPR-aware) ─────────────────────────────────────────────────────
function sizeTiles() {
    const dpr = window.devicePixelRatio || 1;
    for (const tile of tiles) {
        const w = tile.stage.clientWidth;
        const h = tile.stage.clientHeight;
        tile.canvas.width = w * dpr;
        tile.canvas.height = h * dpr;
        tile.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        tile.cssW = w;
        tile.cssH = h;
    }
}
sizeTiles();
window.addEventListener("resize", sizeTiles);

// ── One shared breathing loop ──────────────────────────────────────────────
function frame(ts) {
    const t = ts / 1000;
    for (const tile of tiles) {
        const { ctx, cssW, cssH } = tile;
        ctx.clearRect(0, 0, cssW, cssH);
        tile.draw(ctx, cssW, cssH, tile.entry, t, tile.phase);
    }
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
