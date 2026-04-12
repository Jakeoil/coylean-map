"use strict";
import { pri, Seniority, propagate, universalPropagate } from "./coylean-core.js";

let g; // canvas 2D context

// ── State ──

let feature_active = "legacy"; // "legacy", "explore", "universe"
let numRows = 65;
let numCols = 65;
let SCALE = 8;
let hInitCol = 1;
let vInitRow = 1;
let seniority = Seniority.vertical();
let showInit = false;

// ── DOM references ──

const elesExplore = document.querySelectorAll(".can-explore");
const eleActive = document.querySelector("#feature-active");
const radioButtons = document.querySelectorAll("input[name='feature']");
const eleNumRows = document.querySelector("#numRows");
const eleNumCols = document.querySelector("#numCols");
const eleScale = document.querySelector("#scale");
const eleHInitCol = document.querySelector("#hInitCol");
const eleVInitRow = document.querySelector("#vInitRow");
const eleSeniority = document.querySelector("#seniority");
const eleShowInit = document.querySelector("#showInit");

// ── Controls: Map Type ──

const MODES = ["legacy", "explore", "universe"];

function refreshFeatureActive() {
    for (let button of radioButtons) {
        button.checked = button.id === feature_active;
    }
    eleActive.innerHTML =
        feature_active === "universe"
            ? "Universe"
            : feature_active === "explore"
              ? "Explore"
              : "Legacy";
    for (let ele of elesExplore) {
        ele.style.display = feature_active === "legacy" ? "none" : "block";
    }
}

eleActive.addEventListener("click", function () {
    let idx = MODES.indexOf(feature_active);
    feature_active = MODES[(idx + 1) % MODES.length];
    refreshFeatureActive();
    coyleanApp();
});

for (let button of radioButtons) {
    button.addEventListener("click", function () {
        feature_active = button.id;
        refreshFeatureActive();
        coyleanApp();
    });
}

// ── Controls: Size ──

eleNumRows.addEventListener("input", function () {
    const v = parseInt(eleNumRows.value, 10);
    if (Number.isFinite(v) && v >= 1) {
        numRows = v;
        coyleanApp();
    }
});

eleNumCols.addEventListener("input", function () {
    const v = parseInt(eleNumCols.value, 10);
    if (Number.isFinite(v) && v >= 1) {
        numCols = v;
        coyleanApp();
    }
});

// ── Controls: Scale ──

eleScale.addEventListener("input", function () {
    const v = parseInt(eleScale.value, 10);
    if (Number.isFinite(v) && v >= 1) {
        SCALE = v;
        coyleanApp();
    }
});

// ── Controls: Position Offsets ──

eleHInitCol.addEventListener("input", function () {
    const v = parseInt(eleHInitCol.value, 10);
    if (Number.isFinite(v)) {
        hInitCol = v;
        coyleanApp();
    }
});

eleVInitRow.addEventListener("input", function () {
    const v = parseInt(eleVInitRow.value, 10);
    if (Number.isFinite(v)) {
        vInitRow = v;
        coyleanApp();
    }
});

// ── Controls: Seniority ──

eleSeniority.addEventListener("click", function () {
    seniority = seniority.isVertical ? Seniority.horizontal() : Seniority.vertical();
    eleSeniority.textContent = seniority.isVertical ? "Vertical" : "Horizontal";
    coyleanApp();
});

// ── Controls: Init segments ──

eleShowInit.addEventListener("click", function () {
    showInit = !showInit;
    eleShowInit.textContent = showInit ? "On" : "Off";
    coyleanApp();
});

// ── Rendering ──

/**
 * Apply stroke style for a line of the given priority.
 * Init segments (when showInit is on) → red.
 * pri 0 or 1 → blue; pri 100 (infinite) → black, double width; else black.
 */
function applyPriStyle(p, isInit) {
    if (showInit && isInit) {
        g.strokeStyle = "#c22";
        g.lineWidth = 2;
    } else if (p === 100) {
        g.strokeStyle = "#000";
        g.lineWidth = 2;
    } else if (p <= 1) {
        g.strokeStyle = "#22c";
        g.lineWidth = 1;
    } else {
        g.strokeStyle = "#000";
        g.lineWidth = 1;
    }
}

/**
 * Draw the line segments inside one grid cell.
 *
 * Each cell is a SCALE×SCALE square at column `i`, row `j`. The cell carries
 * up to two perpendicular segments: a vertical segment along one of its
 * vertical edges (left or right) and a horizontal segment along one of its
 * horizontal edges (top or bottom). When both are present they share a corner,
 * forming an L.
 *
 * @param {boolean} down    - true if a vertical (down) segment passes through
 *                            this cell.
 * @param {boolean} right   - true if a horizontal (right) segment passes
 *                            through this cell.
 * @param {number}  i       - column index of the cell (x = i * SCALE).
 * @param {number}  j       - row index of the cell    (y = j * SCALE).
 * @param {0|1}     dx      - which vertical edge carries the down segment:
 *                            1 → right edge (x + SCALE), 0 → left edge (x).
 * @param {0|1}     dy      - which horizontal edge carries the right segment:
 *                            1 → bottom edge (y + SCALE), 0 → top edge (y).
 * @param {number}  downPri - priority of the down segment's column (-1 = no styling)
 * @param {number}  rightPri- priority of the right segment's row (-1 = no styling)
 *
 * The four (dx, dy) combinations correspond to the four quadrants of the
 * universal map and pick which corner of the cell the L wraps around:
 *   (1,1) SE identity — right + bottom edges
 *   (0,1) SW sᵥ       — left  + bottom edges
 *   (1,0) NE sₕ       — right + top    edges
 *   (0,0) NW r²       — left  + top    edges
 *
 * Returns early without drawing when both `down` and `right` are false.
 */
function cell(down, right, i, j, dx = 1, dy = 1, downPri = -1, rightPri = -1, downInit = false, rightInit = false) {
    if (!down && !right) return;

    let x = i * SCALE;
    let xp = x + SCALE;
    let y = j * SCALE;
    let yp = y + SCALE;

    // dx,dy select which edges carry the segments:
    //   (1,1) SE identity  — right + bottom
    //   (0,1) SW sᵥ        — left  + bottom
    //   (1,0) NE sₕ        — right + top
    //   (0,0) NW r²        — left  + top
    let vx = dx ? xp : x;
    let hy = dy ? yp : y;

    if (down && right) {
        // Two separate strokes so each segment gets its own priority style
        if (downPri >= 0) applyPriStyle(downPri, downInit);
        g.beginPath();
        g.moveTo(vx, dy ? y : yp);
        g.lineTo(vx, hy);
        g.stroke();

        if (rightPri >= 0) applyPriStyle(rightPri, rightInit);
        g.beginPath();
        g.moveTo(vx, hy);
        g.lineTo(dx ? x : xp, hy);
        g.stroke();
        return;
    }

    if (down) {
        if (downPri >= 0) applyPriStyle(downPri, downInit);
        g.beginPath();
        g.moveTo(vx, y);
        g.lineTo(vx, yp);
        g.stroke();
        return;
    }

    if (rightPri >= 0) applyPriStyle(rightPri, rightInit);
    g.beginPath();
    g.moveTo(x, hy);
    g.lineTo(xp, hy);
    g.stroke();
}

function coyleanExploration(numRows, numCols) {
    let [downMatrix, rightMatrix] = propagate(numRows, numCols, hInitCol, vInitRow, seniority);

    for (let j = 0; j < numRows; j++) {
        for (let i = 0; i < numCols; i++) {
            cell(downMatrix[j][i], rightMatrix[i][j], i, j, 1, 1,
                pri(i + hInitCol), pri(j + vInitRow), j === 0, i === 0);
        }
    }
}

function coyleanLegacy(numRows, numCols) {
    const downs = new Array(numCols).fill(false);
    const rights = new Array(numRows).fill(false);
    downs[0] = true;

    for (let j = 0; j < numRows; j++) {
        let y = j * SCALE;
        let yp = y + SCALE;
        for (let i = 0; i < numCols; i++) {
            let x = i * SCALE;
            let xp = x + SCALE;
            if (downs[i]) {
                if (rights[j]) {
                    g.beginPath();
                    g.moveTo(xp, y);
                    g.lineTo(xp, yp);
                    g.lineTo(x, yp);
                    g.stroke();
                    if (pri(i) >= pri(j)) {
                        downs[i] = true;
                        rights[j] = false;
                    } else {
                        downs[i] = false;
                        rights[j] = true;
                    }
                } else {
                    g.beginPath();
                    g.moveTo(xp, y);
                    g.lineTo(xp, yp);
                    g.stroke();
                    if (pri(i) >= pri(j)) {
                        downs[i] = true;
                        rights[j] = true;
                    } else {
                        downs[i] = true;
                        rights[j] = false;
                    }
                }
            } else {
                if (rights[j]) {
                    g.beginPath();
                    g.moveTo(xp, yp);
                    g.lineTo(x, yp);
                    g.stroke();
                    if (pri(i) >= pri(j)) {
                        downs[i] = false;
                        rights[j] = true;
                    } else {
                        downs[i] = true;
                        rights[j] = true;
                    }
                } else {
                    downs[i] = false;
                    rights[j] = false;
                }
            }
        }
    }
}

function coyleanUniverse(numRows, numCols) {
    const { nw, ne, sw, se } = universalPropagate(numRows, numCols, hInitCol, vInitRow, seniority);
    const [nwDM, nwRM] = nw;
    const [neDM, neRM] = ne;
    const [swDM, swRM] = sw;
    const [seDM, seRM] = se;

    // SE: identity — full range, owns both axes
    for (let j = 0; j < numRows; j++) {
        for (let i = 0; i < numCols; i++) {
            cell(seDM[j][i], seRM[i][j], numCols - 1 + i, numRows - 1 + j, 1, 1,
                pri(i + hInitCol), pri(j + vInitRow), j === 0, i === 0);
        }
    }
    // NE: sₕ — suppress down at j=0 (init row duplicate)
    for (let j = 0; j < numRows; j++) {
        for (let i = 0; i < numCols; i++) {
            cell(
                j === 0 ? false : neDM[j][i],
                neRM[i][j],
                numCols - 1 + i,
                numRows - 1 - j,
                1, 0,
                pri(i + hInitCol), pri(j + 1 - vInitRow),
                j === 0, i === 0,
            );
        }
    }
    // SW: sᵥ — suppress right at i=0 (init col duplicate)
    for (let j = 0; j < numRows; j++) {
        for (let i = 0; i < numCols; i++) {
            cell(
                swDM[j][i],
                i === 0 ? false : swRM[i][j],
                numCols - 1 - i,
                numRows - 1 + j,
                0, 1,
                pri(i + 1 - hInitCol), pri(j + vInitRow),
                j === 0, i === 0,
            );
        }
    }
    // NW: r² — suppress down at j=0, right at i=0
    for (let j = 0; j < numRows; j++) {
        for (let i = 0; i < numCols; i++) {
            cell(
                j === 0 ? false : nwDM[j][i],
                i === 0 ? false : nwRM[i][j],
                numCols - 1 - i,
                numRows - 1 - j,
                0, 0,
                pri(i + 1 - hInitCol), pri(j + 1 - vInitRow),
                j === 0, i === 0,
            );
        }
    }
}

// ── App ──

function coyleanApp() {
    const canvas = document.querySelector("#explore-map > canvas");
    g = canvas.getContext("2d");
    g.lineWidth = 1;

    if (feature_active === "universe") {
        canvas.width = SCALE * 2 * numCols;
        canvas.height = SCALE * 2 * numRows;
    } else {
        canvas.width = SCALE * (numCols + 1);
        canvas.height = SCALE * (numRows + 1);
    }

    const drawScreen =
        feature_active === "universe"
            ? coyleanUniverse
            : feature_active === "explore"
              ? coyleanExploration
              : coyleanLegacy;
    drawScreen(numRows, numCols);
}

// ── Init ──

refreshFeatureActive();
eleNumRows.value = numRows;
eleNumCols.value = numCols;
eleScale.value = SCALE;
eleHInitCol.value = hInitCol;
eleVInitRow.value = vInitRow;
coyleanApp();
