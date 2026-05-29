// ═══════════════════════════════════════════════════
//  Coylean Glyphs — Substitution Explorer + Universe View
// ═══════════════════════════════════════════════════
//
// Two interactive views built on the canonical V substitution table:
//   * Explorer — starts at the single-arrow seed (order 5); click a section
//     to substitute one level deeper (order 5 → 6 → 7 …), zoom-out stack.
//   * Universe — starts at the J|M / J·sₕ|F universe seed, expanded twice to
//     order 5; same zoom mechanics.
// Both are canonical by construction (the dyadic-location sidebar that the
// catalog has wouldn't make sense here), so no offset controls.

import { Seniority } from "../coylean-explorer/coylean-core.js";
import {
    getSectionData,
    GLYPH_LETTERS,
    setWorkingAssignments,
    setOldAssignments,
    applyAssignments,
} from "./glyph-core.js";
import {
    drawSection,
    renderState,
    V_COLOR,
    toFt,
    ensureBabyBlocksLoaded,
    babyBlocksReady,
} from "./glyph-render.js";

// ── V Substitution Table ──
// Per-code rule: parent (dc, rc) → 4 child codes + 4 internal-boundary flags
// (the segments dividing the 2×2 child block). Built from canonical clean-map
// section data at orders 5 → 6 and 6 → 7 (deeper catches codes the order-5
// scan didn't hit).
const SUB_TABLE = buildSubTable();

function buildSubTable() {
    const sen = Seniority.vertical();
    const o5 = getSectionData(32, 32, sen);
    const o6 = getSectionData(64, 64, sen);
    const o7 = getSectionData(128, 128, sen);
    const t = {};
    function ingest(parent, child) {
        for (let sr = 0; sr < parent.NSr; sr++) {
            for (let sc = 0; sc < parent.NSc; sc++) {
                const [dc, rc] = parent.codes[sr][sc];
                const k = dc + "," + rc;
                if (t[k]) continue;
                const sr2 = sr * 2, sc2 = sc * 2;
                t[k] = {
                    children: [
                        [...child.codes[sr2][sc2]],
                        [...child.codes[sr2][sc2 + 1]],
                        [...child.codes[sr2 + 1][sc2]],
                        [...child.codes[sr2 + 1][sc2 + 1]],
                    ],
                    vBoundTop: child.vBound[sr2][sc2],
                    vBoundBot: child.vBound[sr2 + 1][sc2],
                    hBoundLeft: child.hBound[sr2][sc2],
                    hBoundRight: child.hBound[sr2][sc2 + 1],
                };
            }
        }
    }
    ingest(o5, o6);
    ingest(o6, o7);
    return t;
}

// ── Grid expansion via SUB_TABLE ──
// (grid, vBound, hBound, ns) → one level deeper (ns2 = 2·ns). For each parent
// cell, look up its rule and stamp 4 children + internal boundary segments.
// Then propagate inter-parent boundaries to the doubled grid.
function expandGrid(grid, vBound, hBound, ns) {
    const ns2 = ns * 2;
    const newGrid = Array.from({ length: ns2 }, () =>
        Array.from({ length: ns2 }, () => [0, 0]));
    const newVB = Array.from({ length: ns2 }, () => Array(ns2).fill(false));
    const newHB = Array.from({ length: ns2 }, () => Array(ns2).fill(false));

    for (let sr = 0; sr < ns; sr++) {
        for (let sc = 0; sc < ns; sc++) {
            const [dc, rc] = grid[sr][sc];
            const rule = SUB_TABLE[dc + "," + rc];
            if (!rule) continue;
            const r2 = sr * 2, c2 = sc * 2;
            newGrid[r2][c2]         = [...rule.children[0]];
            newGrid[r2][c2 + 1]     = [...rule.children[1]];
            newGrid[r2 + 1][c2]     = [...rule.children[2]];
            newGrid[r2 + 1][c2 + 1] = [...rule.children[3]];
            if (rule.vBoundTop)   newVB[r2][c2] = true;
            if (rule.vBoundBot)   newVB[r2 + 1][c2] = true;
            if (rule.hBoundLeft)  newHB[r2][c2] = true;
            if (rule.hBoundRight) newHB[r2][c2 + 1] = true;
        }
    }
    // Inherit inter-parent boundaries to the child grid.
    for (let sr = 0; sr < ns; sr++)
        for (let sc = 0; sc < ns - 1; sc++)
            if (vBound[sr][sc]) {
                newVB[sr * 2][sc * 2 + 1] = true;
                newVB[sr * 2 + 1][sc * 2 + 1] = true;
            }
    for (let sr = 0; sr < ns - 1; sr++)
        for (let sc = 0; sc < ns; sc++)
            if (hBound[sr][sc]) {
                newHB[sr * 2 + 1][sc * 2] = true;
                newHB[sr * 2 + 1][sc * 2 + 1] = true;
            }

    return { grid: newGrid, vBound: newVB, hBound: newHB, ns: ns2 };
}

// ── Seeds ──
// Explorer root: order-5 clean-baseline single-arrow propagation, sectioned.
function explorerSeed() {
    const o5 = getSectionData(32, 32, Seniority.vertical());
    return {
        grid:   o5.codes.map(row => row.map(c => [...c])),
        vBound: o5.vBound.map(row => [...row]),
        hBound: o5.hBound.map(row => [...row]),
        ns:     o5.NSr,    // 8
    };
}
// Universe seed: 2×2 J|M / J·sₕ|F, expanded twice to reach order 5.
function universeSeed() {
    let grid = [
        [[6, 6], [5, 6]],   // J  M
        [[7, 3], [7, 7]],   // J·sₕ  F
    ];
    let vb = [[true, false], [true, false]];
    let hb = [[false, true], [false, false]];
    let ns = 2;
    let exp = expandGrid(grid, vb, hb, ns);
    exp = expandGrid(exp.grid, exp.vBound, exp.hBound, exp.ns);
    return exp;
}

// ── Layout / rendering ──
const SEC = 4;
function computeLayout(cols) {
    const maxPx = Math.min(800, window.innerWidth - 60);
    const cellSize = Math.max(4, Math.floor(maxPx / (cols * SEC + cols)));
    const gap = Math.max(1, Math.floor(cellSize * 0.15));
    const secPx = SEC * cellSize;
    return { cellSize, gap, secPx, stride: secPx + gap };
}

function renderView(canvas, state) {
    const ctx = canvas.getContext("2d");
    const rows = state.grid.length;
    const cols = state.grid[0].length;
    const { cellSize, gap, secPx } = computeLayout(cols);
    const totalW = cols * (secPx + gap) + gap;
    const totalH = rows * (secPx + gap) + gap;
    canvas.width = totalW;
    canvas.height = totalH;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, totalW, totalH);

    // Amber background for the 2×2 children of the last zoom click.
    let hiRect = null;
    if (state.childHiR >= 0 && state.childHiC >= 0) {
        hiRect = {
            x: gap + state.childHiC * (secPx + gap),
            y: gap + state.childHiR * (secPx + gap),
            w: 2 * secPx + gap,
            h: 2 * secPx + gap,
        };
        ctx.fillStyle = "rgba(255, 159, 10, 0.18)";
        ctx.fillRect(hiRect.x, hiRect.y, hiRect.w, hiRect.h);
    }

    const sen = Seniority.vertical();
    for (let sr = 0; sr < rows; sr++) {
        for (let sc = 0; sc < cols; sc++) {
            const [dc, rc] = state.grid[sr][sc];
            const sx = gap + sc * (secPx + gap);
            const sy = gap + sr * (secPx + gap);

            if (sr === state.hoverR && sc === state.hoverC) {
                ctx.fillStyle = "rgba(0, 0, 100, 0.05)";
                ctx.fillRect(sx, sy, secPx, secPx);
            }

            const ft = renderState.showIndices
                ? null
                : toFt(GLYPH_LETTERS[dc + "," + rc], V_COLOR);
            drawSection(ctx, {
                dc, rc,
                seniority: sen,
                sx, sy, cell: cellSize,
                ft,
                prefix: "V",
                showDots: state.showDots,
                showLetters: state.showLetters,
                babyBlocks: renderState.useBabyBlocks && babyBlocksReady(),
                outline: renderState.babyBlocksOutline,
            });
        }
    }

    // Inter-section boundary segments (bold black).
    const lw = Math.max(0.5, cellSize * 0.08);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = lw;
    for (let sr = 0; sr < rows; sr++) {
        for (let sc = 0; sc < cols - 1; sc++) {
            if (state.vBound[sr][sc]) {
                const x = gap + (sc + 1) * (secPx + gap) - gap / 2;
                const y1 = gap + sr * (secPx + gap);
                ctx.beginPath();
                ctx.moveTo(x, y1);
                ctx.lineTo(x, y1 + secPx);
                ctx.stroke();
            }
        }
    }
    for (let sr = 0; sr < rows - 1; sr++) {
        for (let sc = 0; sc < cols; sc++) {
            if (state.hBound[sr][sc]) {
                const y = gap + (sr + 1) * (secPx + gap) - gap / 2;
                const x1 = gap + sc * (secPx + gap);
                ctx.beginPath();
                ctx.moveTo(x1, y);
                ctx.lineTo(x1 + secPx, y);
                ctx.stroke();
            }
        }
    }

    if (hiRect) {
        ctx.strokeStyle = "#ff9f0a";
        ctx.lineWidth = Math.max(1.5, cellSize * 0.2);
        ctx.strokeRect(hiRect.x, hiRect.y, hiRect.w, hiRect.h);
    }
}

// ── Zoom view factory ──
// Wraps state + zoom logic + event handlers for one canvas. `initFn` returns
// the seed (level-0) grid bundle; the view resets back to that on Reset.
function makeZoomView(canvas, initFn, ui) {
    const state = {
        grid: null, vBound: null, hBound: null, ns: 0,
        zoomStack: [],
        hoverR: -1, hoverC: -1,
        childHiR: -1, childHiC: -1,
        showDots: true,
        showLetters: true,
        baseOrder: 5,
    };

    function reset() {
        const seed = initFn();
        state.grid = seed.grid;
        state.vBound = seed.vBound;
        state.hBound = seed.hBound;
        state.ns = seed.ns;
        state.zoomStack = [];
        state.childHiR = -1;
        state.childHiC = -1;
        refresh();
    }

    function zoomIn(row, col) {
        state.zoomStack.push({
            grid: state.grid, vBound: state.vBound,
            hBound: state.hBound, ns: state.ns,
        });
        const exp = expandGrid(state.grid, state.vBound, state.hBound, state.ns);
        const ns2 = exp.ns;
        const centerR = row * 2, centerC = col * 2;
        const halfWin = Math.floor(state.ns / 2);
        let startR = Math.max(0, centerR - halfWin + 1);
        let startC = Math.max(0, centerC - halfWin + 1);
        if (startR + state.ns > ns2) startR = Math.max(0, ns2 - state.ns);
        if (startC + state.ns > ns2) startC = Math.max(0, ns2 - state.ns);
        const view = Math.min(state.ns, ns2);
        state.childHiR = centerR - startR;
        state.childHiC = centerC - startC;
        state.grid = Array.from({ length: view }, (_, r) =>
            Array.from({ length: view }, (_, c) =>
                [...exp.grid[startR + r][startC + c]]));
        state.vBound = Array.from({ length: view }, (_, r) =>
            Array.from({ length: view }, (_, c) => {
                const sc = startC + c;
                return sc < ns2 - 1 ? exp.vBound[startR + r][sc] : false;
            }));
        state.hBound = Array.from({ length: view }, (_, r) =>
            Array.from({ length: view }, (_, c) => {
                const sr = startR + r;
                return sr < ns2 - 1 ? exp.hBound[sr][startC + c] : false;
            }));
        refresh();
    }

    function zoomOut() {
        if (state.zoomStack.length === 0) return;
        const prev = state.zoomStack.pop();
        state.grid = prev.grid;
        state.vBound = prev.vBound;
        state.hBound = prev.hBound;
        state.ns = prev.ns;
        state.childHiR = -1;
        state.childHiC = -1;
        refresh();
    }

    function getSection(e) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const cols = state.grid[0].length;
        const { gap, stride } = computeLayout(cols);
        const sc = Math.floor((mx - gap) / stride);
        const sr = Math.floor((my - gap) / stride);
        if (sr >= 0 && sr < state.grid.length && sc >= 0 && sc < cols)
            return [sr, sc];
        return null;
    }

    function refresh() {
        renderView(canvas, state);
        if (!ui) return;
        if (ui.info) {
            const level = state.zoomStack.length;
            const order = state.baseOrder + level;
            ui.info.textContent =
                `Level ${level} — Order ${order} (${state.ns}×${state.ns} window)`;
        }
        if (ui.btnOut) ui.btnOut.disabled = state.zoomStack.length === 0;
    }
    function render() { renderView(canvas, state); }

    canvas.addEventListener("click", e => {
        const sec = getSection(e);
        if (sec) zoomIn(sec[0], sec[1]);
    });
    canvas.addEventListener("mousemove", e => {
        const sec = getSection(e);
        const oldR = state.hoverR, oldC = state.hoverC;
        if (sec) { state.hoverR = sec[0]; state.hoverC = sec[1]; }
        else     { state.hoverR = -1;     state.hoverC = -1; }
        if (state.hoverR !== oldR || state.hoverC !== oldC) render();
    });
    canvas.addEventListener("mouseleave", () => {
        state.hoverR = -1; state.hoverC = -1;
        render();
    });

    if (ui) {
        if (ui.btnOut)   ui.btnOut.addEventListener("click", zoomOut);
        if (ui.btnReset) ui.btnReset.addEventListener("click", reset);
        if (ui.btnDots) {
            ui.btnDots.addEventListener("click", () => {
                state.showDots = !state.showDots;
                ui.btnDots.textContent = "Dots: " + (state.showDots ? "On" : "Off");
                ui.btnDots.classList.toggle("active", state.showDots);
                render();
            });
        }
    }

    return { reset, render, refresh, state };
}

// ── Assignment loading (duplicated lightly from glyphs.js — keep in sync) ──
async function fetchAssignmentDict(path) {
    try {
        const res = await fetch(path, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (data && data.assignments && typeof data.assignments === "object")
            return data.assignments;
        throw new Error("no .assignments object");
    } catch (e) {
        console.warn("substitution: could not load", path, e);
        return null;
    }
}
const ASSIGNMENT_FILES = {
    "assignments-complete": "./assignments-complete.json",
    assignments: "./assignments.json",
    "assignments-old": "./assignments-old.json",
};
const DEFAULT_ASSIGNMENT_FILE = "assignments-complete";
async function loadAssignmentFile(key) {
    const dict = await fetchAssignmentDict(ASSIGNMENT_FILES[key]);
    if (dict) setWorkingAssignments(dict);
    return dict;
}
async function loadOldAssignments() {
    const dict = await fetchAssignmentDict(ASSIGNMENT_FILES["assignments-old"]);
    if (dict) setOldAssignments(dict);
}

// ── Bootstrap ──
const explorerCanvas = document.getElementById("explorer-canvas");
const universeCanvas = document.getElementById("universe-canvas");

const explorer = makeZoomView(explorerCanvas, explorerSeed, {
    info:     document.getElementById("explorer-info"),
    btnOut:   document.getElementById("explorer-out"),
    btnReset: document.getElementById("explorer-reset"),
    btnDots:  document.getElementById("explorer-dots"),
});
const universe = makeZoomView(universeCanvas, universeSeed, {
    info:     document.getElementById("universe-info"),
    btnOut:   document.getElementById("universe-out"),
    btnReset: document.getElementById("universe-reset"),
    btnDots:  document.getElementById("universe-dots"),
});

function rerenderAll() {
    explorer.render();
    universe.render();
}

// Wire shared controls (Letters dropdown, Show indices, Baby Blocks, Outline).
function wireControls() {
    const sel = document.getElementById("assignment-select");
    if (sel) {
        sel.addEventListener("change", async () => {
            await loadAssignmentFile(sel.value);
            applyAssignments(true);
            rerenderAll();
        });
    }
    const showIdx = document.getElementById("show-indices-toggle");
    if (showIdx) {
        showIdx.addEventListener("change", () => {
            renderState.showIndices = showIdx.checked;
            rerenderAll();
        });
    }
    const bb = document.getElementById("bb-toggle");
    if (bb) {
        bb.addEventListener("change", () => {
            renderState.useBabyBlocks = bb.checked;
            if (bb.checked) ensureBabyBlocksLoaded(rerenderAll);
            else rerenderAll();
        });
    }
    const outline = document.getElementById("bb-outline");
    if (outline) {
        outline.addEventListener("change", () => {
            renderState.babyBlocksOutline = outline.checked;
            if (renderState.useBabyBlocks) rerenderAll();
        });
    }
    document.addEventListener("keydown", e => {
        if (e.key !== "Escape") return;
        // Zoom out whichever view has depth (explorer first; mirrors the old
        // single-canvas page).
        if (explorer.state.zoomStack.length > 0) {
            document.getElementById("explorer-out").click();
        } else if (universe.state.zoomStack.length > 0) {
            document.getElementById("universe-out").click();
        }
    });
}

(async function init() {
    const sel = document.getElementById("assignment-select");
    const key = sel && ASSIGNMENT_FILES[sel.value] ? sel.value
              : DEFAULT_ASSIGNMENT_FILE;
    await loadAssignmentFile(key);
    await loadOldAssignments();
    applyAssignments(true);
    explorer.reset();
    universe.reset();
    wireControls();
})();
