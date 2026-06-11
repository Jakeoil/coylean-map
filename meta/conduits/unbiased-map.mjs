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

// The ladder, from the seed up: k=0 is V0 (a 1×1 box), then it alternates
// half-orders — V0,H0,V1,H1,…,V8 — the doubling sequence 1, v,h, 2v,2h, …, 8.
// order = k>>1, seniority H = k odd. (Through the looking-glass it reads h,v,…)
const ladderRung = (k) => ({ order: k >> 1, seniorityH: (k & 1) === 1 });

const MAXK = 16; // …up to V8 (256×256). Deep rungs ride on lines alone (LOD).
const FULL_SECONDS = 30; // superslow: the whole climb over ~30 s
const FRAME_STEP = 0.05; // spacebar nudge — frame-by-frame through a morph

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
    playing: false, // start paused on the seed — step it frame-by-frame
    speed: MAXK / FULL_SECONDS, // superslow default
    userZoom: 1,
    panX: 0,
    panY: 0,
    mirror: false, // through the main diagonal (D1 looking-glass): starts at H
    theme: "dark",
    clutch: false, // hold the scale: freeze the cell grain as the map grows
    heldScale: 0, // px-per-cell captured when the clutch engages
    showCells: true,
    showLines: true,
};
let lastFitScale = 1; // most recent auto-fit grain (for the clutch to grab)

// rung cache wrapper (terrain-core already caches; this keeps anchor 1/1)
const rung = (kInt) => {
    const r = ladderRung(kInt);
    return rungMap(r.order, r.seniorityH, 1, 1);
};

// smoothstep ease
const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

// ── draw one rung's field into a pixel box, at a given alpha ──
// We render the 2ⁿ interior only — drop the index-0 seed margin — so dims are
// exact powers of two (V4 = 16, H4 = 32). That makes a rung and its v/h
// counterpart NEST: every coarse cell of the back map lands exactly on two of
// the front map's, so the cross-fade lines up instead of drifting.
function drawRung(m, px, py, pw, ph, alpha) {
    const Wc = m.Mc - 1; // 2ⁿ columns (interior, seed margin dropped)
    const Hc = m.Mr - 1; // 2ⁿ rows
    const cw = pw / Wc;
    const ch = ph / Hc;
    ctx.globalAlpha = alpha;

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
        // vertical (down) lines: downMatrix[row][col] is the right edge of col
        for (let sc = 0; sc < Wc; sc++) {
            const col = sc + 1;
            const x = px + (sc + 1) * cw;
            ctx.lineWidth = lineWidth(m.colPriority[col], cw, ch);
            let runStart = -1;
            for (let sr = 0; sr <= Hc; sr++) {
                const on = sr < Hc && cellDown(m, sr + 1, col);
                if (on && runStart < 0) runStart = sr;
                if (!on && runStart >= 0) {
                    seg(x, py + runStart * ch, x, py + sr * ch);
                    runStart = -1;
                }
            }
        }
        // horizontal (right) lines: rightMatrix[col][row] is the bottom of row
        for (let sr = 0; sr < Hc; sr++) {
            const row = sr + 1;
            const y = py + (sr + 1) * ch;
            ctx.lineWidth = lineWidth(m.rowPriority[row], ch, cw);
            let runStart = -1;
            for (let sc = 0; sc <= Wc; sc++) {
                const on = sc < Wc && cellRight(m, sc + 1, row);
                if (on && runStart < 0) runStart = sc;
                if (!on && runStart >= 0) {
                    seg(px + runStart * cw, y, px + sc * cw, y);
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

    // interpolate the framed cell-grid aspect from A to B (the split axis
    // grows). Powers of two (16 → 32) so the rungs nest and the fade lines up.
    const Wci = lerp(A.Mc - 1, B.Mc - 1, f);
    const Hci = lerp(A.Mr - 1, B.Mr - 1, f);

    // grain = px per cell. Free-wheeling, the auto-fit frames the whole map
    // (cells shrink as it grows). With the clutch in, we hold the captured
    // grain so the cell scale stays put and the map grows past the frame —
    // the auto-zoom kept in sync with the doubling.
    const margin = 0.86;
    lastFitScale = Math.min(VP / Wci, VP / Hci) * margin;
    const grain = (state.clutch ? state.heldScale : lastFitScale) * state.userZoom;
    const boxW = Wci * grain;
    const boxH = Hci * grain;
    const px = (VP - boxW) / 2 + state.panX;
    const py = (VP - boxH) / 2 + state.panY;

    // both rungs fill the same interpolated box; A fades out as B fades in
    drawRung(A, px, py, boxW, boxH, 1 - f);
    drawRung(B, px, py, boxW, boxH, f);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    syncReadout(kInt, f);
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
    // V→H splits columns (grows wide); the mirror transposes that to rows/tall
    let splitCols = ladderRung(kInt).seniorityH === false;
    if (state.mirror) splitCols = !splitCols;
    el("phase").textContent =
        f < 0.02
            ? kInt === 0
                ? `${a} — the 1×1 seed box`
                : `${a} — a square`
            : f > 0.98
              ? `${b}`
              : splitCols
                ? `${a} → ${b} · growing wide, columns dividing`
                : `${a} → ${b} · growing tall, rows dividing`;
}

// ── animation loop ──
let last = performance.now();
function frame(now) {
    const dt = (now - last) / 1000;
    last = now;
    if (state.playing) {
        state.k += Math.max(0, dt) * state.speed;
        if (state.k >= MAXK) {
            state.k = MAXK;
            state.playing = false;
            el("play").textContent = "Replay ↺";
        }
    }
    if (state.k < 0) state.k = 0;
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

// ── controls ──
el("play").onclick = () => {
    if (state.k >= MAXK) {
        state.k = 0;
    }
    state.playing = !state.playing;
    el("play").textContent = state.playing ? "Pause ❚❚" : "Play ▶";
};
el("speed").oninput = (e) => (state.speed = Number(e.target.value) / 100);
el("mirror").onclick = () => {
    state.mirror = !state.mirror;
    el("mirror").classList.toggle("on", state.mirror);
};
// the clutch: engage to hold the cell grain (freeze the auto-zoom in sync with
// the growth); disengage to free-wheel back to fitting the whole map.
el("clutch").onclick = () => {
    state.clutch = !state.clutch;
    if (state.clutch) {
        state.heldScale = lastFitScale; // grab the current grain, no jump
        state.userZoom = 1;
    }
    el("clutch").classList.toggle("on", state.clutch);
};
el("reset").onclick = () => {
    state.k = 0;
    state.userZoom = 1;
    state.panX = state.panY = 0;
    state.playing = false;
    state.clutch = false;
    el("clutch").classList.remove("on");
    el("play").textContent = "Play ▶";
};
const stepRung = (dir) => {
    state.playing = false;
    el("play").textContent = "Play ▶";
    state.k = Math.max(0, Math.min(MAXK, Math.round(state.k) + dir));
};
el("stepf").onclick = () => stepRung(1);
el("stepb").onclick = () => stepRung(-1);
el("cells").onchange = (e) => (state.showCells = e.target.checked);
el("lines").onchange = (e) => (state.showLines = e.target.checked);

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
        state.playing = false;
        el("play").textContent = "Play ▶";
        state.k = Math.min(MAXK, state.k + FRAME_STEP);
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
        state.userZoom = Math.max(0.4, Math.min(40, state.userZoom * f));
    },
    { passive: false },
);

resize();
requestAnimationFrame(frame);
