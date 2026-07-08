// ════════════════════════════════════════════════════════════════════════
// Coylean Triangle — Phase 1: the typographical view.
//
// The Coylean propagation read on the diagonal. Picture the explorer's
// propagation raster — red DOWN diamonds (vertical arrows, downMatrix) and blue
// RIGHT diamonds (horizontal arrows, rightMatrix) — turned 45° clockwise. Each
// diamond becomes a square holding a single stroke:
//
//     right arrow →  ╲   (backslash, on the LEFT of its cell)
//     down arrow  →  ╱   (slash,     on the RIGHT)   ⟶  the ╲╱ valley reaction
//     empty diamond →  a genuine BLANK
//
// The strokes are a pure re-read of a FINISHED propagation (the engine is the
// trusted oracle; the map is bijective). We integrate a real Coylean square —
// northExtent = westExtent = 1, so the ∞ priority frame is included: colPriority
// [i] = pri(i) with pri(0) = ∞ at the west column (all down arrows → the
// naked-slash left edge) and rowPriority[j] = pri(j) with ∞ at the north row
// (all right arrows → the naked-backslash right edge). The triangle is the
// causal anti-diagonal corner i + j ≤ 2ⁿ, closed under SE flow.
//
// Reading a row left→right gives  ╱ · ╲╱ · ╲╱ · … · ╲  — a naked slash, the
// interior valleys, a naked backslash — matching the r{row}c{col} (down) /
// c{col}r{row} (right) labelling of each anti-diagonal.
//
// Phase 2 (pixelated CA) and Phase 3 (universe) build on this same field.
// ════════════════════════════════════════════════════════════════════════
import { Propagation, Seniority } from "coylean/core";

const el = (id) => document.getElementById(id);
const SVGNS = "http://www.w3.org/2000/svg";

const state = {
    rows: 16, // number of anti-diagonal rows drawn
    angle: 90, // peak/valley opening angle in degrees (90 · 60 · 36)
    senH: false, // false = vertical seniority (≥), true = horizontal (>)
    byPri: true, // two colours: red ╱ (down) / blue ╲ (right)
    showPri: false, // priority number next to each slash
};

// ── Build the triangle from a finished Coylean square ──────────────────────
// A cell (i, j) contributes up to two strokes: a ╱ if its down arrow is on and
// a ╲ if its right arrow is on (both, one, or neither → a blank). Placed on the
// anti-diagonal, screen row = i + j; a cell spans half-columns 2(i−j) ± 1, with
// the ╲ (right) on the left (−1) and ╱ (down) on the right (+1). Each stroke
// carries its own priority: a ╱ its column's colPriority[i] = pri(i), a ╲ its
// row's rowPriority[j] = pri(j) — ∞ at the frame (the ∞·0·1·0·2 ruler).
function buildTriangle() {
    const D = state.rows - 1; // anti-diagonal depth: rows 0 … D
    const N = D; // square side covering the causal corner i + j ≤ D
    const infPri = Math.floor(Math.log2(Math.max(2, N))) + 2; // pri cap ⇒ ∞
    const seniority = state.senH
        ? Seniority.horizontal()
        : Seniority.vertical();
    const P = Propagation.fromUniverseExtents({
        northExtent: 1, // include the ∞ frame (naked slash / backslash edges)
        westExtent: 1,
        southExtent: N,
        eastExtent: N,
        hInitCol: 1, // effective offset 0 ⇒ colPriority[i] = pri(i), pri(0) = ∞
        vInitRow: 1,
        maxPri: infPri,
        seniority,
    });
    const cP = P.colPriority;
    const rP = P.rowPriority;
    const cap = (p) => (p >= infPri ? "∞" : p);

    const strokes = [];
    let minSub = Infinity;
    let maxSub = -Infinity;
    const note = (sub) => {
        if (sub < minSub) minSub = sub;
        if (sub > maxSub) maxSub = sub;
    };
    for (let d = 0; d <= D; d++) {
        for (let i = 0; i <= d; i++) {
            const j = d - i;
            const base = 2 * (i - j);
            if (P.rightMatrix[i] && P.rightMatrix[i][j]) {
                // the ╲ carries its row's N–S priority pri(j) (∞ at the frame)
                strokes.push({ row: d, sub: base - 1, slash: false, pri: cap(rP[j]) });
                note(base - 1);
            }
            if (P.downMatrix[j] && P.downMatrix[j][i]) {
                // the ╱ carries its column's E–W priority pri(i) (∞ at the frame)
                strokes.push({ row: d, sub: base + 1, slash: true, pri: cap(cP[i]) });
                note(base + 1);
            }
        }
    }
    return { strokes, D, minSub, maxSub, infPri };
}

// ── Render the strokes into the SVG board ──────────────────────────────────
// Each stroke spans ±w horizontally over a FIXED height H, at half-column `sub`
// (odd), screen `row`. The opening angle θ (the peak / valley vertex) sets only
// the half-width: an arm makes θ/2 with the vertical, so tan(θ/2) = w / (H/2)
// ⟹ w = (H/2)·tan(θ/2). H is constant, so changing θ keeps every row's physical
// height fixed and only narrows the triangle (θ = 90° → 45° arms / squares; 60°
// and 36° → progressively narrower, taller-looking peaks). Adjacent strokes are
// 2 sub apart and 2w wide, so x is scaled by w.
const PAD = 1.4;
const H = 2; // constant physical row height (independent of angle & rows)
function render() {
    const { strokes, D, minSub, maxSub } = buildTriangle();
    const ink = el("ink");
    const labelG = el("labels");
    ink.innerHTML = "";
    labelG.innerHTML = "";

    const w = (H / 2) * Math.tan((state.angle / 2) * (Math.PI / 180));
    const X = (sub) => PAD + w + (sub - minSub) * w; // box centre; box spans ±w
    const Y = (row) => PAD + row * H;
    const boardW = (maxSub - minSub + 2) * w + 2 * PAD;
    const boardH = (D + 1) * H + 2 * PAD;
    el("board").setAttribute("viewBox", `0 0 ${boardW} ${boardH}`);
    // constant on-screen weight: the board scales to a fixed display width, so a
    // viewBox stroke ∝ boardW renders the same thickness at any row count / angle
    const sw = boardW * 0.0026;

    for (const s of strokes) {
        const cx = X(s.sub);
        const yt = Y(s.row);
        const l = document.createElementNS(SVGNS, "line");
        if (s.slash) {
            // ╱ : bottom-left → top-right
            l.setAttribute("x1", cx - w);
            l.setAttribute("y1", yt + H);
            l.setAttribute("x2", cx + w);
            l.setAttribute("y2", yt);
        } else {
            // ╲ : top-left → bottom-right
            l.setAttribute("x1", cx - w);
            l.setAttribute("y1", yt);
            l.setAttribute("x2", cx + w);
            l.setAttribute("y2", yt + H);
        }
        const cls = ["stroke"];
        if (state.byPri) cls.push(s.slash ? "down" : "right");
        l.setAttribute("class", cls.join(" "));
        l.style.strokeWidth = sw;
        ink.appendChild(l);
    }

    // priorities near the TOP of each arm, on its outer side: red ╱ pri(i) to the
    // upper-left, blue ╲ pri(j) to the upper-right, tinted toward the arm colour.
    if (state.showPri && D <= 24) {
        const fs = Math.min(0.78, 1.3 * w);
        for (const s of strokes) {
            const cx = X(s.sub);
            const yt = Y(s.row);
            const t = document.createElementNS(SVGNS, "text");
            // near the top; ╱ nudged left, ╲ nudged right (kept small so the
            // whole row of numbers stays roughly equidistant)
            t.setAttribute("x", cx + (s.slash ? -0.25 * w : 0.25 * w));
            t.setAttribute("y", yt + 0.26 * H);
            t.setAttribute("font-size", fs);
            t.setAttribute("class", "pri " + (s.slash ? "s" : "b"));
            t.textContent = s.pri;
            labelG.appendChild(t);
        }
    }
}

// ── Controls ───────────────────────────────────────────────────────────────
function syncSen() {
    el("senBtn").querySelector(".oval").textContent = state.senH ? "H" : "V";
}
function clampInt(v, lo, hi) {
    v = Math.round(Number(v));
    if (!Number.isFinite(v)) v = lo;
    return Math.min(hi, Math.max(lo, v));
}

function wire() {
    el("senBtn").onclick = () => {
        state.senH = !state.senH;
        syncSen();
        render();
    };
    el("rows").onchange = () => {
        state.rows = clampInt(el("rows").value, 2, 64);
        el("rows").value = state.rows;
        render();
    };
    el("angleSel")
        .querySelectorAll("button")
        .forEach((b) => {
            b.onclick = () => {
                state.angle = Number(b.dataset.angle);
                el("angleSel")
                    .querySelectorAll("button")
                    .forEach((x) => x.classList.toggle("active", x === b));
                render();
            };
        });
    el("bypri").onchange = () => {
        state.byPri = el("bypri").checked;
        render();
    };
    el("showpri").onchange = () => {
        state.showPri = el("showpri").checked;
        render();
    };
}

// ── Theme ──
function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    el("theme-toggle").textContent = t === "light" ? "☀ Light" : "☾ Dark";
    localStorage.setItem("coylean-triangle-theme", t);
}
el("theme-toggle").onclick = () =>
    applyTheme(
        document.documentElement.dataset.theme === "light" ? "dark" : "light",
    );

// ── init ──
wire();
syncSen();
applyTheme(localStorage.getItem("coylean-triangle-theme") || "dark");
render();
