"use strict";

// Turtle Paradise — a living catalog of the 12 lettered glyphs.
//
// Twelve LETTERS, a finished subset of the 128 immutable V/H glyph cards. The
// orientation triplet picks a D4 element: ⤢ seniority swaps the whole set
// between the 12 V cards and their 12 H duals; ↔/↕ pick the orientation within.
// Each card shown is the letter's REAL glyph at that orientation — the actual
// Vdr/Hdr code, correct number, oriented letter watermark — NOT a rotated image.
// Changing orientation swaps in the 12 real cards for that orientation.
//
// The hero (the selected letter) has a Basic / Elaborate / Monster switch:
//   • basic     — the glyph-page card: native segments + oriented letter mark.
//   • elaborate — the glyph as a little elaborate Coylean square (a placeholder
//                 precursor to the monster; its content is corrected elsewhere).
//   • monster   — the animated creature, assigned per ORIENTED glyph; only \F
//                 (V77) has one so far (the baked turtle paradise.md sketch).
//                 Unassigned → falls back to basic.
// The twelve thumbnails are always basic.
//
// To re-bake the sketch if the .md changes (needs `npm i lz-string`):
//   const LZ=require("lz-string"); … decompressFromBase64(the compressed-json).

import { TURTLE_PARADISE } from "./turtle-paradise-data.js";
import { Seniority } from "coylean/core";
import {
    computeGlyphMatrices,
    computePattern,
    transformedPatternKey,
    glyphLetterAt,
    d4Compose,
    setWorkingAssignments,
    applyAssignments,
} from "coylean/glyphs";
import { BabyBlocks } from "../../baby-blocks/baby-blocks.js";
import { translationOf } from "../planet-coyleus/terrain-core.js";
import { elabGlyphInto } from "./elaborate-glyph.js";

// engine d4Index → baby-block transform name (verified, per compound-glyphs)
const D4B = ["e", "r", "r2", "r3", "sh", "sv", "d", "d'"];
// engine d4Index → 2×2 matrix (oriented watermark + font-fallback badge)
const D4M = [
    [1, 0, 0, 1], [0, 1, -1, 0], [-1, 0, 0, -1], [0, -1, 1, 0],
    [1, 0, 0, -1], [-1, 0, 0, 1], [0, 1, 1, 0], [0, -1, -1, 0],
];
const SYM = ["0", "1", "2", "3", "h", "v", "\\", "/"];
const GRID_SWAP = new Set([1, 3, 6, 7]); // D4 elements that land in the H grid
let babyBlocks = null; // loaded async
let lettersReady = false; // assignments built → glyphLetterAt resolves orient.

// Orientation triplet → a D4 element. ↔ longitude s_v (E/W) · ↕ latitude s_h
// (N/S) · ⤢ seniority s_d1 (transpose / backslash dual = the V↔H swap).
const ORI = { h: 0, v: 0, senH: false };
const D4_LONG = 5, D4_LAT = 4, D4_TRANSPOSE = 6;
function netOrient() {
    let n = 0;
    if (ORI.h) n = d4Compose(D4_LONG, n);
    if (ORI.v) n = d4Compose(D4_LAT, n);
    if (ORI.senH) n = d4Compose(D4_TRANSPOSE, n);
    return n;
}

// ── The catalog: the 12 lettered glyphs (canonical V forms, assignments.json)
const CATALOG = [
    ["F", "V77", 7, 7], ["P", "V17", 1, 7], ["J", "V66", 6, 6],
    ["B", "V56", 5, 6], ["O", "V00", 0, 0], ["L", "V11", 1, 1],
    ["Q", "V25", 2, 5], ["E", "V07", 0, 7], ["V", "V15", 1, 5],
    ["C", "V51", 5, 1], ["R", "V61", 6, 1], ["N", "V16", 1, 6],
].map(([letter, code, dc, rc]) => ({ letter, code, dc, rc }));

// Monsters are keyed to the ORIENTED glyph code. Only \F (V77) has one so far:
// the baked turtle paradise.md sketch — the prototype monster.
const MONSTERS = { V77: TURTLE_PARADISE };

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

// ── The oriented designation: a catalog entry at the current orientation ────
// The triplet's net D4 element transforms the canonical V pattern; we match the
// resulting pattern key to a real member and read the engine's own code + letter
// for it, so the code (Vdr/Hdr) AND the letter+suffix (e.g. F\) are correct —
// and the glyph is drawn NATIVE (the real card), never a rotated image.
let revMapV = null, revMapH = null;
function buildRevMaps() {
    const build = (sen) => {
        const m = new Map();
        for (let d = 0; d < 8; d++)
            for (let r = 0; r < 8; r++) {
                const p = computePattern(d, r, sen);
                m.set(transformedPatternKey(p.v, p.h, 0), d + "," + r);
            }
        return m;
    };
    revMapV = build(Seniority.vertical());
    revMapH = build(Seniority.horizontal());
}

// → { code, sym, letter, d4, grid, d, r } for the entry under the orientation.
function designation(entry) {
    const net = netOrient();
    // fallback before assignments load: the canonical V card (correct at net 0)
    let out = {
        code: entry.code, letter: entry.letter, d4: net, grid: "V",
        d: entry.dc, r: entry.rc, sym: entry.letter + (SYM[net] || ""),
    };
    if (lettersReady) {
        if (!revMapV) buildRevMaps();
        const base = computePattern(entry.dc, entry.rc, Seniority.vertical());
        const key = transformedPatternKey(base.v, base.h, net);
        const grid = GRID_SWAP.has(net) ? "H" : "V";
        const code = (grid === "H" ? revMapH : revMapV).get(key);
        if (code) {
            const [d, r] = code.split(",").map(Number);
            const ft = glyphLetterAt(grid, d, r);
            if (ft)
                out = {
                    code: grid + "" + d + "" + r,
                    letter: ft[0],
                    sym: ft[0] + (SYM[ft[1]] || ""),
                    d4: ft[1],
                    grid, d, r,
                };
        }
    }
    return out;
}

// ── Basic: the native glyph card (segments + oriented letter watermark) ─────
const NC = 3; // cells per glyph axis
const matCache = new Map();
function glyphMat(dsg) {
    if (matCache.has(dsg.code)) return matCache.get(dsg.code);
    const sen = dsg.grid === "H"
        ? Seniority.horizontal()
        : Seniority.vertical();
    const m = computeGlyphMatrices(dsg.d, dsg.r, sen);
    matCache.set(dsg.code, m);
    return m;
}

// Sized to a centred block so it is never larger than the monster — and matches
// between the big hero and the small thumbnails.
const STUB_FRAC = 0.56;

function drawBasic(ctx, W, H, dsg, t, phase) {
    const { downMatrix, rightMatrix } = glyphMat(dsg);
    const span = NC + 1; // grid positions 0..NC, plus the exit ring
    const block = Math.min(W, H) * STUB_FRAC;
    const cell = block / span;
    const gx = (W - cell * span) / 2;
    const gy = (H - cell * span) / 2;
    const px = (g) => g * cell;

    ctx.fillStyle = GROUND; // the tile ground stays put
    roundRect(ctx, 8, 8, W - 16, H - 16, 16);
    ctx.fill();

    withLife(ctx, t, phase, W / 2, H / 2, () => {
        ctx.save();
        ctx.translate(gx, gy);

        // soft body behind the live 3×3 area
        ctx.fillStyle = PINK + "55";
        roundRect(ctx, px(0.5), px(0.5), px(NC), px(NC), cell * 0.5);
        ctx.fill();

        // the glyph's letter as a faint watermark, at the correct orientation
        ctx.save();
        ctx.translate(px(span / 2), px(span / 2));
        const m = D4M[dsg.d4] || D4M[0];
        ctx.transform(m[0], m[1], m[2], m[3], 0, 0);
        ctx.fillStyle = YELLOW_DEEP + "33";
        ctx.font = "bold " + cell * 2.4 + "px Monaco, Menlo, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(dsg.letter, 0, 0);
        ctx.restore();

        // green stems — the glyph's propagated segments
        ctx.strokeStyle = GREEN_DEEP;
        ctx.lineCap = "round";
        ctx.lineWidth = cell * 0.16;
        for (let y = 0; y <= NC; y++)
            for (let x = 0; x < NC; x++)
                if (downMatrix[y][x]) {
                    const xr = px(x + 1);
                    ctx.beginPath();
                    ctx.moveTo(xr, px(y));
                    ctx.lineTo(xr, px(y + 1));
                    ctx.stroke();
                }
        for (let x = 0; x <= NC; x++)
            for (let y = 0; y < NC; y++)
                if (rightMatrix[x][y]) {
                    const yb = px(y + 1);
                    ctx.beginPath();
                    ctx.moveTo(px(x), yb);
                    ctx.lineTo(px(x + 1), yb);
                    ctx.stroke();
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
            drawEye(px(i + 1), px(0), !!(dsg.d & (1 << i)), k++);
            drawEye(px(0), px(i + 1), !!(dsg.r & (1 << i)), k++);
            drawEye(px(i + 1), px(span), downMatrix[NC][i], k++);
            drawEye(px(span), px(i + 1), rightMatrix[NC][i], k++);
        }
        ctx.restore();
    });
}

// ── Monster: the animated creature. Replays the baked excalidraw shapes for
// glyphs that have one (only \F = V77 so far); falls back to basic otherwise. ─
function drawSketch(ctx, W, H, data, t, phase) {
    const pad = 26;
    const s = Math.min((W - 2 * pad) / data.w, (H - 2 * pad) / data.h);
    const ox = (W - data.w * s) / 2;
    const oy = (H - data.h * s) / 2;

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

function drawMonster(ctx, W, H, dsg, t, phase) {
    const data = MONSTERS[dsg.code];
    if (data) drawSketch(ctx, W, H, data, t, phase);
    else drawBasic(ctx, W, H, dsg, t, phase); // unassigned → basic
}

// ── Elaborate: the glyph as a little elaborate Coylean square ──────────────
// PLACEHOLDER — currently the 2×2 split children (terrain-core.translationOf)
// via the shared elaborate-glyph renderer. The "perfect little square" content
// is corrected later; here we only wire it to the representation switch.
function drawElaborate(ctx, W, H, dsg, t, phase) {
    ctx.fillStyle = GROUND;
    roundRect(ctx, 8, 8, W - 16, H - 16, 16);
    ctx.fill();

    withLife(ctx, t, phase, W / 2, H / 2, () => {
        const kids = translationOf(dsg.grid, dsg.d, dsg.r).children;
        if (kids.length === 4) {
            const block = Math.min(W, H) * 0.82;
            const cell = block / 2;
            const ox = (W - block) / 2, oy = (H - block) / 2;
            const pos = [[0, 0], [1, 0], [0, 1], [1, 1]]; // NW NE SW SE
            for (let i = 0; i < 4; i++) {
                const c = kids[i];
                elabGlyphInto(ctx, ox + pos[i][0] * cell, oy + pos[i][1] * cell,
                    cell, c.grid, c.d, c.r);
            }
        } else {
            const size = Math.min(W, H) * 0.62;
            elabGlyphInto(ctx, (W - size) / 2, (H - size) / 2, size,
                dsg.grid, dsg.d, dsg.r);
        }
    });
}

// ── The hero (selected glyph) + the strip of twelve thumbnails ─────────────
const strip = document.getElementById("strip");
const heroCanvas = document.getElementById("heroCanvas");
const heroStage = heroCanvas.parentElement;
const heroCtx = heroCanvas.getContext("2d");
const heroBadge = document.getElementById("heroBadge");
const heroTitle = document.getElementById("heroTitle");
const heroSub = document.getElementById("heroSub");

let selected = 0; // default: F (entry 0)
let heroFadeT = 1; // 1 = fully shown; resets to 0 on select for a soft fade-in
let heroW = 0, heroH = 0;
const heroPhase = 0.4;
let repr = "basic"; // "basic" | "elaborate" | "monster"

const thumbs = [];
function makeThumb(entry, idx) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "thumb" + (idx === selected ? " selected" : "");

    const stage = document.createElement("div");
    stage.className = "thumb-stage";
    const canvas = document.createElement("canvas");
    stage.appendChild(canvas);

    const label = document.createElement("div");
    label.className = "thumb-label";
    label.innerHTML =
        '<span class="tl">' + entry.letter + "</span>" +
        '<span class="tc">' + entry.code + "</span>";

    card.appendChild(stage);
    card.appendChild(label);
    card.addEventListener("click", () => select(idx));
    strip.appendChild(card);

    thumbs.push({
        entry,
        card,
        stage,
        canvas,
        ctx: canvas.getContext("2d"),
        codeEl: label.querySelector(".tc"),
        phase: idx * 1.7,
    });
}
CATALOG.forEach(makeThumb);

// The info-area badge: the selected glyph's letter as a properly oriented baby
// block (same drawDirect approach as compound-glyphs), over the gradient chip.
function renderBadge() {
    const dsg = designation(CATALOG[selected]);
    const dpr = window.devicePixelRatio || 1;
    const w = heroBadge.clientWidth || 48, h = heroBadge.clientHeight || 48;
    heroBadge.width = w * dpr;
    heroBadge.height = h * dpr;
    const b = heroBadge.getContext("2d");
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    b.clearRect(0, 0, w, h);
    const size = Math.min(w, h) * 0.82;
    if (babyBlocks) {
        babyBlocks.drawDirect(b, dsg.letter, w / 2, h / 2, size, {
            transform: D4B[dsg.d4] || "e",
            outline: false,
            color: "#14210f",
        });
    } else {
        const m = D4M[dsg.d4] || D4M[0];
        b.save();
        b.translate(w / 2, h / 2);
        b.transform(m[0], m[1], m[2], m[3], 0, 0);
        b.fillStyle = "#14210f";
        b.font = "700 " + size * 0.9 + "px Monaco, Menlo, monospace";
        b.textAlign = "center";
        b.textBaseline = "middle";
        b.fillText(dsg.letter, 0, 0);
        b.restore();
    }
}

// badge + title + the Vdr/Hdr code · letter-transform, for the selected glyph.
function syncHeroMeta() {
    renderBadge();
    const dsg = designation(CATALOG[selected]);
    heroTitle.textContent = CATALOG[selected].letter;
    heroSub.innerHTML = "<code>" + dsg.code + "</code> · " + dsg.sym;
}

// ── Representation switch (basic / elaborate / monster) ─────────────────────
const reprEl = document.getElementById("repr");
function syncRepr() {
    if (!reprEl) return;
    for (const b of reprEl.querySelectorAll(".rbtn"))
        b.classList.toggle("on", b.dataset.repr === repr);
}
if (reprEl) {
    reprEl.addEventListener("click", (e) => {
        const b = e.target.closest(".rbtn");
        if (!b || b.dataset.repr === repr) return;
        repr = b.dataset.repr;
        syncRepr();
        heroFadeT = 0; // soft fade-in of the new representation
    });
    syncRepr();
}

// ── Orientation triplet — three buttons re-orient the hero AND the twelve ───
const longBtn = document.getElementById("longBtn");
const latBtn = document.getElementById("latBtn");
const senBtn = document.getElementById("senBtn");
const oSym = (sym, val) =>
    '<span class="osym">' + sym + '</span><span class="oval">' + val +
    "</span>";
function syncOrient() {
    longBtn.innerHTML = oSym("↔", ORI.h);
    latBtn.innerHTML = oSym("↕", ORI.v);
    senBtn.innerHTML = oSym("⤢", ORI.senH ? "H" : "V");
}
function orientChanged() {
    syncOrient();
    renderThumbs(); // the twelve swap to the new orientation (glyph + V/H code)
    syncHeroMeta(); // badge + title + sub follow
}
function buildOrient() {
    longBtn.onclick = () => { ORI.h ^= 1; orientChanged(); };
    latBtn.onclick = () => { ORI.v ^= 1; orientChanged(); };
    senBtn.onclick = () => { ORI.senH = !ORI.senH; orientChanged(); };
    syncOrient();
}
buildOrient();

function select(idx) {
    if (idx === selected) return;
    selected = idx;
    heroFadeT = 0; // soft fade-in of the newly selected hero
    thumbs.forEach((tm, i) =>
        tm.card.classList.toggle("selected", i === selected));
    syncHeroMeta();
}
syncHeroMeta();

// ── Sizing (DPR-aware) ─────────────────────────────────────────────────────
function sizeCanvas(canvas, ctx, stage) {
    const dpr = window.devicePixelRatio || 1;
    const w = stage.clientWidth, h = stage.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [w, h];
}
function sizeAll() {
    [heroW, heroH] = sizeCanvas(heroCanvas, heroCtx, heroStage);
    for (const tm of thumbs)
        [tm.cssW, tm.cssH] = sizeCanvas(tm.canvas, tm.ctx, tm.stage);
    renderThumbs();
    renderBadge();
}

// The twelve are STATIC basic cards at the rest pose (t = 0), each its letter's
// real glyph at the current orientation. Re-rendered on resize, on orientation
// change, and once the letters finish loading.
function renderThumbs() {
    for (const tm of thumbs) {
        const dsg = designation(tm.entry);
        tm.ctx.clearRect(0, 0, tm.cssW, tm.cssH);
        drawBasic(tm.ctx, tm.cssW, tm.cssH, dsg, 0, 0);
        if (tm.codeEl) tm.codeEl.textContent = dsg.code;
    }
}
sizeAll();
window.addEventListener("resize", sizeAll);

// ── Load the letters' orientation + the baby blocks ────────────────────────
async function loadAssets() {
    try {
        const res = await fetch("../../glyphs/assignments.json", {
            cache: "no-store",
        });
        const data = await res.json();
        if (data && data.assignments) {
            setWorkingAssignments(data.assignments);
            applyAssignments(true);
            lettersReady = true; // glyphLetterAt now resolves orientation
            renderThumbs(); // codes/letters resolve
            syncHeroMeta();
        }
    } catch (e) {
        console.warn("turtle-paradise: assignments load failed", e);
    }
    try {
        babyBlocks = await BabyBlocks.load(
            "../../baby-blocks/AlphabetBlocks-complete.svg",
        );
        renderBadge(); // badge upgrades from font fallback to the baby block
    } catch (e) {
        console.warn("turtle-paradise: baby blocks load failed", e);
    }
}
loadAssets();

// ── The hero animates; the thumbnails stay still ───────────────────────────
function frame(ts) {
    const t = ts / 1000;
    if (heroFadeT < 1) heroFadeT = Math.min(1, heroFadeT + 0.06);
    heroCtx.clearRect(0, 0, heroW, heroH);
    heroCtx.globalAlpha = heroFadeT;
    const dsg = designation(CATALOG[selected]);
    if (repr === "elaborate") drawElaborate(heroCtx, heroW, heroH, dsg, t,
        heroPhase);
    else if (repr === "monster") drawMonster(heroCtx, heroW, heroH, dsg, t,
        heroPhase);
    else drawBasic(heroCtx, heroW, heroH, dsg, t, heroPhase);
    heroCtx.globalAlpha = 1;
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
