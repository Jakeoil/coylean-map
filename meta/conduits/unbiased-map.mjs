// ════════════════════════════════════════════════════════════════════════
// The Unbiased Map — agnostic growth of a Coylean square.
//
// H usually plays second fiddle: in a biased render the h half-order draws its
// tiles skinny. But H is just the D1 backslash transpose of V — the same tile
// through the main diagonal. So here we DON'T squash the h phase; we let every
// cell keep an honest square and grow the map instead, walking the V/H ladder
//
//     V_n (2ⁿ square) → H_n (columns split, wide) → V_{n+1} (rows split) → …
//
// A square grows toward 3:2, then SNAPS — its long axis divides in two (the
// Planet-Coyleus substitution). v-grow splits columns, h-grow splits rows, and
// the two are mirror images across the diagonal: agnostic growth. Alice eats
// the cake, drinks the bottle, and steps through the looking-glass.
//
// Data is real: each rung's line field comes from terrain-core.rungMap
// (computeMapModel under the hood). We only animate the framing + the split.
// ════════════════════════════════════════════════════════════════════════
import { rungMap } from "../planet-coyleus/terrain-core.js";
import { ladderRung, aspW, aspH, ease, lerp } from "./ladder-kinematics.js";
import { SlidingRuler } from "../sliding-ruler/volume-ruler-control/sliding-ruler.js";

// The ladder, from the seed up: k=0 is V0 (a 1×1 box), then it alternates
// half-orders — V0,H0,V1,H1,…,V8 — the doubling sequence 1, v,h, 2v,2h, …, 8.
// order = k>>1, seniority H = k odd; ladderRung lives in ./ladder-kinematics.

const MAXK = 16; // …up to V8 (256×256). Deep rungs ride on lines alone (LOD).
const FULL_SECONDS = 30; // superslow: the whole climb over ~30 s
const FRAME_STEP = 0.05; // spacebar nudge — frame-by-frame through a morph
// Velocity ruler: stepped −VEL_MAX … 0 … +VEL_MAX. 0 = paused, sign = direction.
// Speed is GEOMETRIC so the dial starts out very slow — |v|=1 crawls (≈ one rung
// every ~25 s) and each step ~×2.6, ramping to brisk only near the top.
const VEL_MAX = 5;
const SLOW_KPS = MAXK / 400; // |v|=1 climb speed (ladder units/sec): a crawl
const stepKps = (v) =>
    v === 0 ? 0 : Math.sign(v) * SLOW_KPS * 2.6 ** (Math.abs(v) - 1);
// position clock: k maps to morph time t = k / KPS seconds (fixed reference).
const KPS = MAXK / FULL_SECONDS;
const fmtClock = (s) =>
    Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");

const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");
const el = (id) => document.getElementById(id);

// ── depth ramps — nested cage colours. DARK: lifted purples on a dark ground.
// LIGHT: pale lavender interiors deepening to purple walls. Cells stay clear
// of the line colour so the lines always read on top.
const RAMP_DARK = [
    "#3b3168", // p0  lit interior
    "#4a3c84",
    "#5b49a0",
    "#6e5abb",
    "#836fd0",
    "#9b88de",
    "#b6a6ec", // high-priority cage walls
];
const RAMP_LIGHT = [
    "#efe9fb", // p0  pale interior
    "#ddd2f3",
    "#c7b6ea",
    "#b09ade",
    "#977ed0",
    "#7e5cbe",
    "#673f9f", // walls, deep
];
const INK_DARK = "#f3ecff"; // bright lines on the dark ground
const INK_LIGHT = "#241a44"; // dark lines on the pale ground

const theRamp = () => (state.theme === "light" ? RAMP_LIGHT : RAMP_DARK);
const theInk = () => (state.theme === "light" ? INK_LIGHT : INK_DARK);
const rampAt = (d) => {
    const R = theRamp();
    return R[Math.max(0, Math.min(R.length - 1, d))];
};

// ── view / animation state ──
const state = {
    k: 0, // continuous ladder position (0 = V0, the 1×1 box … MAXK)
    velocity: 0, // ruler step −VEL_MAX…VEL_MAX; 0 = paused, sign = direction
    dir: 1, // last non-zero direction (for frame-step orientation)
    userZoom: 1,
    panX: 0,
    panY: 0,
    mirror: false, // through the main diagonal (D1 looking-glass): starts at H
    curH: 1, // longitude anchor ∈ {0,1} (lon toggle) — rungMap's curH
    curV: 1, // latitude anchor ∈ {0,1} (lat toggle) — rungMap's curV
    theme: "dark",
    grow: 1.5, // snap proportion: 1.5 = grow to 3:2 (default) · 2 = grow to 2:1
    autoscale: true, // on = auto-fit the whole map; off = hold the cell grain
    heldScale: 0, // px-per-cell captured when autoscale is switched off
    showCells: false, // lines (the Coylean square) carry it; cells optional
    showLines: true,
    // "no one needs to get fatter": off = the honest fat grow (cells stretch
    // anisotropically with the box); on = subdivide (square cells, the box
    // letterboxes, so the doubling shows as more cells, never fatter ones).
    subdivide: false,
};
let lastFitScale = 1; // most recent auto-fit grain (for the clutch to grab)

// The box proportion at a rung (aspW/aspH from ./ladder-kinematics). A square
// grows along its split axis by `state.grow` then SNAPS: 1.5 → snap at 3:2
// (default), 2 → snap at 2:1. So every other half-order the box is square (the
// genuine Coylean square: V rungs) and between them it is a `grow`:1 rectangle
// (H rungs). At 2:1 the H cells fatten back to squares; at 3:2 they stay 3:4.

// rung cache wrapper (terrain-core caches by key). Anchor = the lon/lat toggles
// (curH/curV); 1/1 is the clean baseline.
const rung = (kInt) => {
    const r = ladderRung(kInt);
    return rungMap(r.order, r.seniorityH, state.curH, state.curV);
};

// ── draw one rung's field into a pixel box, at a given alpha ──
// We render the 2ⁿ interior cells (drop the index-0 seed margin) so dims are
// exact powers of two and a rung NESTS in its v/h counterpart — the cross-fade
// lines up. But a Coylean square is CLOSED: all four sides drawn. The ∞-axis
// (column 0 / row 0 of the west=north=1 integration) IS the west and north
// frame, so we draw the lines on every edge 0..N — col 0 / row 0 land on the
// left / top edge — giving the full frame, not just the open SE interior.
function drawRung(m, px, py, pw, ph, alpha) {
    const Wc = m.Mc - 1; // 2ⁿ interior columns
    const Hc = m.Mr - 1; // 2ⁿ interior rows
    let cw = pw / Wc;
    let ch = ph / Hc;
    if (state.subdivide) {
        // honest square cells — no fattening; centre in the (possibly wider)
        // grow box, which then letterboxes instead of stretching the cells
        cw = ch = Math.min(cw, ch);
        px += (pw - cw * Wc) / 2;
        py += (ph - ch * Hc) / 2;
    }
    ctx.globalAlpha = alpha;

    // The ∞ frame (pri(0)) comes out as the maxPri cap (e.g. 32); remap it to
    // one above the real interior max so the four frame lines read as a frame,
    // not a slab.
    const inf = m.colPriority[0];
    let finiteMax = 0;
    for (let c = 1; c < m.colPriority.length; c++)
        finiteMax = Math.max(finiteMax, m.colPriority[c]);
    for (let r = 1; r < m.rowPriority.length; r++)
        finiteMax = Math.max(finiteMax, m.rowPriority[r]);
    const capPri = finiteMax + 1;
    const eff = (p) => (p >= inf ? capPri : p);

    // deep rungs: cells go sub-pixel, so ride on the lines alone (keeps the
    // superslow 30 s climb to V8 smooth)
    const tiny = Math.min(cw, ch) < 3;
    if (state.showCells && !tiny) {
        for (let sr = 0; sr < Hc; sr++) {
            const rp = m.rowPriority[sr + 1];
            for (let sc = 0; sc < Wc; sc++) {
                // cell depth = how senior the nearest cage wall is around it
                const d = Math.min(rp, m.colPriority[sc + 1]);
                ctx.fillStyle = rampAt(d);
                ctx.fillRect(px + sc * cw, py + sr * ch, cw + 0.7, ch + 0.7);
            }
        }
    }

    if (state.showLines) {
        ctx.strokeStyle = theInk();
        ctx.lineCap = "butt";
        // vertical lines on every edge 0..N. col 0 = west frame (x=px); col N =
        // east frame (x=px+pw). downMatrix[row][col] is the right edge of col.
        for (let col = 0; col <= Wc; col++) {
            const x = px + col * cw;
            ctx.lineWidth = lineWidth(eff(m.colPriority[col]), cw, ch);
            let runStart = -1; // in interior rows 1..N
            for (let r = 1; r <= Hc + 1; r++) {
                const on = r <= Hc && cellDown(m, r, col);
                if (on && runStart < 0) runStart = r;
                if (!on && runStart >= 0) {
                    seg(x, py + (runStart - 1) * ch, x, py + (r - 1) * ch);
                    runStart = -1;
                }
            }
        }
        // horizontal lines on every edge 0..N. row 0 = north frame (y=py);
        // row N = south frame. rightMatrix[col][row] is the bottom of row.
        for (let row = 0; row <= Hc; row++) {
            const y = py + row * ch;
            ctx.lineWidth = lineWidth(eff(m.rowPriority[row]), ch, cw);
            let runStart = -1; // in interior cols 1..N
            for (let c = 1; c <= Wc + 1; c++) {
                const on = c <= Wc && cellRight(m, c, row);
                if (on && runStart < 0) runStart = c;
                if (!on && runStart >= 0) {
                    seg(px + (runStart - 1) * cw, y, px + (c - 1) * cw, y);
                    runStart = -1;
                }
            }
        }
    }
    ctx.globalAlpha = 1;
}

const cellDown = (m, j, i) =>
    m.downMatrix[j] && m.downMatrix[j][i];
const cellRight = (m, i, j) =>
    m.rightMatrix[i] && m.rightMatrix[i][j];

// line thickness grows with 2-adic priority (the dyadic ruler / cage walls),
// clamped so it never swamps a cell.
function lineWidth(pri, along, across) {
    const base = Math.min(along, across);
    // floor at ~1px so the faint p0 grid never vanishes; grow with priority.
    const w = Math.max(1, base * (0.12 + 0.16 * pri));
    return Math.min(w, base * 0.7, 12);
}
function seg(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

// ── frame the growing map + render the cross-fade between adjacent rungs ──
function render() {
    const VP = cv.width / (window.devicePixelRatio || 1);
    ctx.setTransform(
        window.devicePixelRatio || 1,
        0,
        0,
        window.devicePixelRatio || 1,
        0,
        0,
    );
    ctx.clearRect(0, 0, VP, VP);

    // looking-glass: reflect the whole scene across the main diagonal (swap x,y)
    if (state.mirror) {
        ctx.transform(0, 1, 1, 0, 0, 0);
    }

    const kInt = Math.max(0, Math.min(MAXK - 1, Math.floor(state.k)));
    const f = ease(Math.min(1, Math.max(0, state.k - kInt)));
    const A = rung(kInt);
    const B = rung(kInt + 1);

    // box proportion: grow the split axis toward 3 : 2 then snap (not 2 : 1).
    // (The cell COUNTS still double — drawRung fills the box with each rung's
    // own 2ⁿ grid — so the rungs nest and the fade lines up.)
    const Wci = lerp(aspW(kInt, state.grow), aspW(kInt + 1, state.grow), f);
    const Hci = lerp(aspH(kInt, state.grow), aspH(kInt + 1, state.grow), f);

    // grain = px per cell. Autoscale on: the auto-fit frames the whole map
    // (cells shrink as it grows). Autoscale off: hold the captured grain so the
    // scale stays put and the map grows past the frame.
    const margin = 0.86;
    lastFitScale = Math.min(VP / Wci, VP / Hci) * margin;
    const grain =
        (state.autoscale ? lastFitScale : state.heldScale) * state.userZoom;
    const boxW = Wci * grain;
    const boxH = Hci * grain;
    const px = (VP - boxW) / 2 + state.panX;
    const py = (VP - boxH) / 2 + state.panY;

    // both rungs fill the same interpolated box; A fades out as B fades in
    drawRung(A, px, py, boxW, boxH, 1 - f);
    drawRung(B, px, py, boxW, boxH, f);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    syncReadout(kInt, f);

    // HUD: apparent h:v line-length ratio (a horizontal cell edge vs a vertical
    // one). Subdivide keeps cells square (1.00); the fat grow stretches them.
    const hud = el("hud");
    if (hud) {
        let ratio = 1;
        if (!state.subdivide) {
            const m = f < 0.5 ? A : B;
            ratio = (boxW / (m.Mc - 1)) / (boxH / (m.Mr - 1));
        }
        hud.textContent = "h:v " + ratio.toFixed(2);
    }
}

// rung name V4/H4 — through the looking-glass V↔H swap, so the ladder reads as
// starting at H when the mirror is on (and the climb grows tall first).
function rungName(kInt) {
    const r = ladderRung(kInt);
    const senH = state.mirror ? !r.seniorityH : r.seniorityH;
    return (senH ? "H" : "V") + r.order;
}
function syncReadout(kInt, f) {
    const a = rungName(kInt);
    const b = rungName(kInt + 1);
    el("rung").textContent = f < 0.5 ? a : b;
    // position clock: how far up the morph we are, in M:SS (k / KPS)
    const clk = el("clock");
    if (clk) clk.textContent = fmtClock(state.k / KPS);
    // V→H splits columns (grows wide); the mirror transposes that to rows/tall
    let splitCols = ladderRung(kInt).seniorityH === false;
    if (state.mirror) splitCols = !splitCols;
    const op = splitCols ? "v-grow" : "h-grow";
    el("phase").textContent =
        f < 0.02
            ? kInt === 0
                ? `${a} — the 1×1 seed box`
                : `${a} — a square`
            : f > 0.98
              ? `${b}`
              : splitCols
                ? `${a} → ${b} · ${op} · widen to 3:2, columns divide`
                : `${a} → ${b} · ${op} · heighten to 3:2, rows divide`;
}

// ── animation loop ──
let last = performance.now();
function frame(now) {
    const dt = (now - last) / 1000;
    last = now;
    if (state.velocity !== 0) {
        state.k += stepKps(state.velocity) * Math.max(0, dt);
        if (state.k >= MAXK || state.k <= 0) {
            state.k = state.k >= MAXK ? MAXK : 0; // hit an end → stop
            setVelocity(0); // park the ruler at 0
        }
    }
    render();
    requestAnimationFrame(frame);
}

// ── canvas sizing ──
function resize() {
    const dpr = window.devicePixelRatio || 1;
    const size = cv.clientWidth;
    cv.width = size * dpr;
    cv.height = size * dpr;
    render();
}
window.addEventListener("resize", resize);

// ── transport: one velocity ruler, −VEL_MAX … 0 … +VEL_MAX (0 = paused) ──
let velRuler = null;
function setVelocity(v) {
    state.velocity = Math.max(-VEL_MAX, Math.min(VEL_MAX, Math.round(v)));
    if (state.velocity !== 0) state.dir = state.velocity > 0 ? 1 : -1;
    if (velRuler && velRuler.getValue() !== state.velocity)
        velRuler.setValue(state.velocity);
}
function buildVelocityRuler() {
    const c = el("velRuler");
    if (!c) return;
    velRuler = new SlidingRuler(c, {
        min: -VEL_MAX,
        max: VEL_MAX,
        value: state.velocity,
        visibleRange: 2 * VEL_MAX + 2,
        height: 54,
        labels: { [-VEL_MAX]: "◀◀", 0: "0", [VEL_MAX]: "▶▶" },
        onChange: (v) => setVelocity(v),
    });
}
buildVelocityRuler();
el("mirror").onclick = () => {
    state.mirror = !state.mirror;
    el("mirror").classList.toggle("on", state.mirror);
};
// Orientation triple: lon (↔ = curH) and lat (↕ = curV) anchor toggles ∈ {0,1},
// plus the looking-glass above. The rAF loop re-reads rung() each frame, so a
// toggle just updates state + the button face.
function syncOrient() {
    const lon = el("lonBtn");
    const lat = el("latBtn");
    if (lon) {
        lon.textContent = "↔ " + state.curH;
        lon.classList.toggle("on", state.curH === 1);
    }
    if (lat) {
        lat.textContent = "↕ " + state.curV;
        lat.classList.toggle("on", state.curV === 1);
    }
}
if (el("lonBtn")) el("lonBtn").onclick = () => { state.curH ^= 1; syncOrient(); };
if (el("latBtn")) el("latBtn").onclick = () => { state.curV ^= 1; syncOrient(); };
// snap proportion: switch the growth between 3:2 and 2:1 (3:2 is the default).
function syncSnap() {
    el("snap").textContent =
        state.grow === 2 ? "Snap 2:1 ⇄ 3:2" : "Snap 3:2 ⇄ 2:1";
    el("snap").classList.toggle("on", state.grow === 1.5);
}
el("snap").onclick = () => {
    state.grow = state.grow === 1.5 ? 2 : 1.5;
    syncSnap();
};
// Autoscale clutch. On (default): the auto-fit frames the whole map as it
// grows. Switch it OFF: it does NOT jump — it grabs the current grain and just
// holds it, so the map keeps growing past the frame at a constant scale (and
// you can wheel-zoom far deeper). Switch back on to re-fit.
function syncAutoscale() {
    el("autoscale").classList.toggle("on", state.autoscale);
    el("autoscale").textContent = state.autoscale
        ? "⟲ Autoscale — on"
        : "⟟ Held — autoscale off";
}
el("autoscale").onclick = () => {
    state.autoscale = !state.autoscale;
    if (state.autoscale) state.userZoom = 1; // clean re-fit
    else state.heldScale = lastFitScale; // freeze at the current grain — no jump
    syncAutoscale();
};
el("reset").onclick = () => {
    state.k = 0;
    state.userZoom = 1;
    state.panX = state.panY = 0;
    setVelocity(0);
    state.autoscale = true;
    syncAutoscale();
};
// single step either way: pause, then nudge one rung
const stepRung = (dir) => {
    setVelocity(0);
    state.k = Math.max(0, Math.min(MAXK, Math.round(state.k) + dir));
};
if (el("stepb")) el("stepb").onclick = () => stepRung(-1);
el("stepf").onclick = () => stepRung(1);
el("cells").onchange = (e) => (state.showCells = e.target.checked);
el("lines").onchange = (e) => (state.showLines = e.target.checked);
// "no one needs to get fatter" → subdivide (square cells) instead of the fat grow
if (el("fatter"))
    el("fatter").onchange = (e) => (state.subdivide = e.target.checked);

// ── light / dark theme ──
function applyTheme(t) {
    state.theme = t;
    document.documentElement.dataset.theme = t;
    el("theme").textContent = t === "light" ? "☾ Dark" : "☀ Light";
    localStorage.setItem("unbiased-theme", t);
}
el("theme").onclick = () =>
    applyTheme(state.theme === "light" ? "dark" : "light");
applyTheme(localStorage.getItem("unbiased-theme") || "dark");

// ── spacebar: pause and step the growth frame-by-frame ──
window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
        e.preventDefault();
        setVelocity(0); // pause
        // step in the last direction so Space frame-steps a reverse too
        state.k = Math.max(
            0,
            Math.min(MAXK, state.k + state.dir * FRAME_STEP),
        );
    }
});

// pan / zoom
let dragging = false,
    lx = 0,
    ly = 0;
cv.addEventListener("pointerdown", (e) => {
    dragging = true;
    lx = e.clientX;
    ly = e.clientY;
    cv.setPointerCapture(e.pointerId);
});
cv.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lx,
        dy = e.clientY - ly;
    lx = e.clientX;
    ly = e.clientY;
    // pan respects the looking-glass (swap dx,dy when mirrored)
    state.panX += state.mirror ? dy : dx;
    state.panY += state.mirror ? dx : dy;
});
cv.addEventListener("pointerup", () => (dragging = false));
cv.addEventListener(
    "wheel",
    (e) => {
        e.preventDefault();
        const f = Math.exp(-e.deltaY * 0.0014);
        // with autoscale off the grain is held, so allow a far deeper zoom
        const lo = state.autoscale ? 0.4 : 0.02;
        const hi = state.autoscale ? 40 : 6000;
        state.userZoom = Math.max(lo, Math.min(hi, state.userZoom * f));
    },
    { passive: false },
);

syncSnap();
syncAutoscale();
syncOrient();
resize();
requestAnimationFrame(frame);
