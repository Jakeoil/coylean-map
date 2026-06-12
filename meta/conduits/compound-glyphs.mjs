"use strict";

// Compound glyphs — the real lettered Coylean map. On the anchor points (1/1)
// the glyph letters are a mnemonic; the letter SVGs come from the baby blocks
// (children's blocks — square-based, chosen partly for their rough match to a
// glyph's line pattern). Here we use ONLY the letter part (no border/color),
// black, at the glyph's D8 orientation, as a small label readable only when you
// magnify. A compound glyph is the no-bar rectangle — neighbors fused, the
// rectangle your eye picks out. Real data from glyph-core; baby blocks from
// baby-blocks. (Color is reserved for compound membership later.)
import {
    computeMapModel,
    setWorkingAssignments,
    applyAssignments,
    glyphLetterAt,
    setOffset,
} from "../../glyphs/glyph-core.js";
import { Seniority } from "../../coylean-explorer/coylean-core.js";
import { BabyBlocks } from "../../baby-blocks/baby-blocks.js";
// engine d4Index → baby-block transform name. The calibrated map from
// glyph-render (Baby Blocks names its two rotations OPPOSITE to ours, so r/r³
// are swapped vs the naïve order — this is the corrected mapping). Imported so
// it can't drift from the catalog.
import {
    D4_TO_BABY as D4B,
    D4_MATRIX as D4M,
} from "../../glyphs/glyph-render.js";
// engine d4Index → Jake's transform symbols (0 1 2 3 h v \ /)
const SYM = ["0", "1", "2", "3", "h", "v", "\\", "/"];
// D4M (engine d4Index → 2×2 matrix, plain-font fallback label) is the calibrated
// D4_MATRIX imported above — same source as the catalog, rotations correct.

let lettersReady = false; // assignments loaded → glyphLetterAt resolves
let showLabels = true;

// Orientation: the anchor quadrant (curH / curV ∈ {0,1}) plus seniority (V/H),
// like planet-coyleus/terrain's orientation card. The map shows the square
// compounds under BOTH seniorities — only the tie-break flips.
const state = { curH: 1, curV: 1, senH: false };
const seniorityNow = () =>
    state.senH ? Seniority.horizontal() : Seniority.vertical();
const letterGrid = () => (state.senH ? "H" : "V");

const CELL = 18; // base-cell px in the offscreen map
const ROWS_CELLS = 60;
const COLS_CELLS = 84;

const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");
const readout = document.getElementById("readout");

let model = null;
let faces = [];
let babyBlocks = null;
let mapW = 0, mapH = 0;

// ── boot: render the map immediately; load letters + blocks in the bg ─────
function init() {
    setOffset(state.curH, state.curV); // anchor 1/1 — letters are a mnemonic
    build();
    fitView();
    buildOrient();
    requestAnimationFrame(frame);
    loadAssets();
}

// Re-anchor / re-seniority the map, keeping the camera where it is.
function rebuild() {
    setOffset(state.curH, state.curV);
    build();
    sizeCanvas(); // refresh fitS for the new map dims (camera unchanged)
    syncOrient();
}
async function loadAssets() {
    try {
        const res = await fetch("../../glyphs/assignments-complete.json", {
            cache: "no-store",
        });
        const data = await res.json();
        if (data && data.assignments) {
            setWorkingAssignments(data.assignments);
            applyAssignments(true);
            lettersReady = true; // labels now resolve (font fallback for now)
        }
    } catch (e) {
        console.warn("compound-glyphs: assignments load failed", e);
    }
    try {
        babyBlocks = await BabyBlocks.load(
            "../../baby-blocks/AlphabetBlocks-complete.svg"
        );
    } catch (e) {
        console.warn("compound-glyphs: baby blocks load failed", e);
    }
}

// pixel position of model cell index i (interior starts at 1)
const X = (i) => (i - 1) * CELL;
const Y = (j) => (j - 1) * CELL;

function build() {
    model = computeMapModel(ROWS_CELLS, COLS_CELLS, {
        seniority: seniorityNow(),
    });
    findFaces();
    renderOffscreen();
}

// ── orientation card (anchor quadrant + seniority) ────────────────────────
const orientSym = (sym, val) =>
    `<span class="osym">${sym}</span><span class="oval">${val}</span>`;

function quadrantLabel() {
    const ns = state.curV === 1 ? "S" : "N";
    const ew = state.curH === 1 ? "E" : "W";
    // letter order encodes seniority: V → NS-first, H → EW-first
    return state.senH ? ew + ns : ns + ew;
}

function syncOrient() {
    const set = (id, html) => {
        const e = document.getElementById(id);
        if (e) e.innerHTML = html;
    };
    set("longBtn", orientSym("↔", state.curH));
    set("latBtn", orientSym("↕", state.curV));
    set("senBtn", orientSym("⤢", state.senH ? "H" : "V"));
    const lab = document.getElementById("orientLabel");
    if (lab) lab.textContent = quadrantLabel();
}

function buildOrient() {
    const wire = (id, fn) => {
        const e = document.getElementById(id);
        if (e) e.onclick = fn;
    };
    wire("longBtn", () => { state.curH ^= 1; rebuild(); });
    wire("latBtn", () => { state.curV ^= 1; rebuild(); });
    wire("senBtn", () => { state.senH = !state.senH; rebuild(); });
    syncOrient();
}

const vBar = (i, j) => (i < model.numColumns - 1 ? !!model.downMatrix[j][i] : true);
const hBar = (i, j) => (j < model.numRows - 1 ? !!model.rightMatrix[i][j] : true);

// no-bar rectangles over the interior [1..]; every region is a rectangle.
function findFaces() {
    faces = [];
    const C = model.numColumns, R = model.numRows;
    const seen = Array.from({ length: R }, () => new Array(C).fill(false));
    for (let j = 1; j < R; j++) {
        for (let i = 1; i < C; i++) {
            if (seen[j][i]) continue;
            let minx = i, maxx = i, miny = j, maxy = j;
            const st = [[i, j]];
            seen[j][i] = true;
            while (st.length) {
                const [x, y] = st.pop();
                minx = Math.min(minx, x); maxx = Math.max(maxx, x);
                miny = Math.min(miny, y); maxy = Math.max(maxy, y);
                if (x + 1 < C && !vBar(x, y) && !seen[y][x + 1]) {
                    seen[y][x + 1] = true; st.push([x + 1, y]);
                }
                if (x - 1 >= 1 && !vBar(x - 1, y) && !seen[y][x - 1]) {
                    seen[y][x - 1] = true; st.push([x - 1, y]);
                }
                if (y + 1 < R && !hBar(x, y) && !seen[y + 1][x]) {
                    seen[y + 1][x] = true; st.push([x, y + 1]);
                }
                if (y - 1 >= 1 && !hBar(x, y - 1) && !seen[y - 1][x]) {
                    seen[y - 1][x] = true; st.push([x, y - 1]);
                }
            }
            faces.push({ i: minx, j: miny, w: maxx - minx + 1, h: maxy - miny + 1 });
        }
    }
}

let off = null;
function renderOffscreen() {
    const C = model.numColumns, R = model.numRows;
    mapW = (C - 1) * CELL;
    mapH = (R - 1) * CELL;
    off = document.createElement("canvas");
    off.width = mapW;
    off.height = mapH;
    const g = off.getContext("2d");
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, mapW, mapH);

    // compound rectangles: a faint tint so the fused blocks read (color is
    // reserved for compound membership later; neutral for now)
    for (const f of faces) {
        if (f.w * f.h === 1) continue;
        g.fillStyle = "rgba(120,150,200,0.10)";
        g.fillRect(X(f.i), Y(f.j), f.w * CELL, f.h * CELL);
    }

    // the bars (the map)
    g.strokeStyle = "rgba(35,40,48,0.9)";
    g.lineWidth = 1.2;
    g.beginPath();
    for (let j = 1; j < R; j++) {
        for (let i = 1; i < C; i++) {
            if (i < C - 1 && model.downMatrix[j][i]) {
                const x = X(i) + CELL;
                g.moveTo(x, Y(j)); g.lineTo(x, Y(j) + CELL);
            }
            if (j < R - 1 && model.rightMatrix[i][j]) {
                const y = Y(j) + CELL;
                g.moveTo(X(i), y); g.lineTo(X(i) + CELL, y);
            }
        }
    }
    g.stroke();
}

// ── camera (zoom + pan) ───────────────────────────────────────────────────
let vx = 0, vy = 0, vs = 1, fitS = 1;
function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    cv.width = cv.clientWidth * dpr;
    cv.height = cv.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fitS = Math.min(cv.clientWidth / Math.max(mapW, 1), cv.clientHeight / Math.max(mapH, 1));
}
function fitView() {
    sizeCanvas();
    vs = fitS;
    vx = (cv.clientWidth - mapW * vs) / 2;
    vy = (cv.clientHeight - mapH * vs) / 2;
}
window.addEventListener("resize", () => { if (model) fitView(); });

const pts = new Map();
let pinchPrev = 0;
const localXY = (e) => {
    const r = cv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
};
function zoomAt(cx, cy, f) {
    const ns = Math.max(fitS * 0.5, Math.min(fitS * 80, vs * f));
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
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinchPrev > 0) zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pinchPrev);
        pinchPrev = d;
    } else {
        vx += nx - ox; vy += ny - oy;
    }
});
function endPtr(e) { pts.delete(e.pointerId); if (pts.size < 2) pinchPrev = 0; }
cv.addEventListener("pointerup", endPtr);
cv.addEventListener("pointercancel", endPtr);
cv.addEventListener("wheel", (e) => {
    e.preventDefault();
    const [cx, cy] = localXY(e);
    zoomAt(cx, cy, Math.exp(-e.deltaY * 0.0015));
}, { passive: false });

document.getElementById("reset").onclick = fitView;

// ── click → name the compound under the cursor ────────────────────────────
cv.addEventListener("click", (e) => {
    if (!model || pts.size) return;
    const [mx, my] = localXY(e);
    const lx = (mx - vx) / vs, ly = (my - vy) / vs; // offscreen coords

    // glyph (section) under the cursor → letter + orientation symbol
    let glyphTxt = "";
    if (lettersReady) {
        const i = Math.floor(lx / CELL) + 1, j = Math.floor(ly / CELL) + 1;
        const sc = Math.floor((i - model.firstDarkCol - 1) / SEC);
        const sr = Math.floor((j - model.firstDarkRow - 1) / SEC);
        if (sr >= 0 && sr < model.NSr && sc >= 0 && sc < model.NSc) {
            const [d, r] = model.secCodes[sr][sc];
            const ft = glyphLetterAt(letterGrid(), d, r);
            if (ft) glyphTxt = ` · glyph ${ft[0]}${SYM[ft[1]] || ""}`;
        }
    }

    for (const f of faces) {
        if (lx >= X(f.i) && lx < X(f.i) + f.w * CELL &&
            ly >= Y(f.j) && ly < Y(f.j) + f.h * CELL) {
            const base =
                f.w * f.h === 1
                    ? "a glyph living alone (1×1)"
                    : `compound · ${f.w}×${f.h} · ${f.w * f.h} cells fused`;
            readout.textContent = base + glyphTxt;
            return;
        }
    }
});

// ── render loop: blit map, then draw baby-block letters when magnified ─────
const SEC = 4;
function frame(ts) {
    const t = ts / 1000;
    const W = cv.clientWidth, H = cv.clientHeight;
    ctx.fillStyle = "#fbfbf4";
    ctx.fillRect(0, 0, W, H);

    const breathe = 1 + 0.006 * Math.sin(t * 0.6);
    const ds = vs * breathe;
    const cx = W / 2, cy = H / 2;
    const dx = cx - (cx - vx) * breathe;
    const dy = cy - (cy - vy) * breathe;
    if (off) ctx.drawImage(off, dx, dy, mapW * ds, mapH * ds);

    // glyph letters — only when a section is big enough to read
    const secPx = SEC * CELL * ds; // a section's on-screen size
    if (showLabels && lettersReady && model && secPx > 22) {
        const { secCodes, NSr, NSc, firstDarkRow, firstDarkCol } = model;
        const size = 3 * CELL * ds; // letter size on screen
        for (let sr = 0; sr < NSr; sr++) {
            for (let sc = 0; sc < NSc; sc++) {
                // +2 cells = the cage CENTER (the middle interior bar); +1
                // sat on the left/top interior bar, reading off-centre.
                const ccx = (firstDarkCol + sc * SEC + 2) * CELL;
                const ccy = (firstDarkRow + sr * SEC + 2) * CELL;
                const sx = dx + ccx * ds, sy = dy + ccy * ds;
                if (sx < -size || sx > W + size || sy < -size || sy > H + size)
                    continue;
                const [d, r] = secCodes[sr][sc];
                const ft = glyphLetterAt(letterGrid(), d, r);
                if (!ft) continue;
                if (babyBlocks) {
                    // the baby-block letter part — no border, black, oriented
                    babyBlocks.drawDirect(ctx, ft[0], sx, sy, size, {
                        transform: D4B[ft[1]] || "e",
                        outline: false,
                        color: "#000",
                    });
                } else {
                    // fallback until the SVG loads: plain letter, same D4
                    const m = D4M[ft[1]] || D4M[0];
                    ctx.save();
                    ctx.translate(sx, sy);
                    ctx.transform(m[0], m[1], m[2], m[3], 0, 0);
                    ctx.fillStyle = "#000";
                    ctx.font = "700 " + size * 0.8 + "px Menlo, monospace";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(ft[0], 0, 0);
                    ctx.restore();
                }
            }
        }
    }
    requestAnimationFrame(frame);
}

const labelsToggle = document.getElementById("labels-toggle");
if (labelsToggle) {
    showLabels = labelsToggle.checked;
    labelsToggle.addEventListener("change", () => {
        showLabels = labelsToggle.checked;
    });
}

init();
