"use strict";
import { pri, propagate, universalPropagate } from "./coylean-core.js";

let g; // canvas 2D context

// ── State ──

let feature_active = "legacy"; // "legacy", "explore", "universe"
let numRows = 65;
let numCols = 65;
let SCALE = 8;
let rightsPos = 1;
let downsPos = 1;

// ── DOM references ──

const elesExplore = document.querySelectorAll(".can-explore");
const eleActive = document.querySelector("#feature-active");
const radioButtons = document.querySelectorAll("input[name='feature']");
const eleNumRows = document.querySelector("#numRows");
const eleNumCols = document.querySelector("#numCols");
const eleScaleReset = document.querySelector("#scale-reset");
const eleRightsPos = document.querySelector("#rights-pos");
const eleDownsPos = document.querySelector("#downs-pos");

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
        ele.style.display = feature_active === "explore" ? "block" : "none";
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

document.querySelector("#scale-dec").addEventListener("click", function () {
    if (SCALE > 1) SCALE--;
    eleScaleReset.innerHTML = SCALE;
    coyleanApp();
});

document.querySelector("#scale-inc").addEventListener("click", function () {
    SCALE++;
    eleScaleReset.innerHTML = SCALE;
    coyleanApp();
});

eleScaleReset.addEventListener("click", function () {
    if (SCALE !== 8) SCALE = 8;
    eleScaleReset.innerHTML = SCALE;
    coyleanApp();
});

// ── Controls: Position Offsets ──

document.querySelector("#rights-right").addEventListener("click", function () {
    rightsPos++;
    eleRightsPos.innerHTML = rightsPos;
    coyleanApp();
});

document.querySelector("#rights-left").addEventListener("click", function () {
    rightsPos--;
    eleRightsPos.innerHTML = rightsPos;
    coyleanApp();
});

document.querySelector("#downs-up").addEventListener("click", function () {
    downsPos--;
    eleDownsPos.innerHTML = downsPos;
    coyleanApp();
});

document.querySelector("#downs-down").addEventListener("click", function () {
    downsPos++;
    eleDownsPos.innerHTML = downsPos;
    coyleanApp();
});

// ── Rendering ──

/**
 * Draw the line segments inside one grid cell.
 *
 * Each cell is a SCALE×SCALE square at column `i`, row `j`. The cell carries
 * up to two perpendicular segments: a vertical segment along one of its
 * vertical edges (left or right) and a horizontal segment along one of its
 * horizontal edges (top or bottom). When both are present they share a corner,
 * forming an L.
 *
 * @param {boolean} down  - true if a vertical (down) segment passes through
 *                          this cell.
 * @param {boolean} right - true if a horizontal (right) segment passes
 *                          through this cell.
 * @param {number}  i     - column index of the cell (x = i * SCALE).
 * @param {number}  j     - row index of the cell    (y = j * SCALE).
 * @param {0|1}     dx    - which vertical edge carries the down segment:
 *                          1 → right edge (x + SCALE), 0 → left edge (x).
 * @param {0|1}     dy    - which horizontal edge carries the right segment:
 *                          1 → bottom edge (y + SCALE), 0 → top edge (y).
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
function cell(down, right, i, j, dx = 1, dy = 1) {
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
        g.beginPath();
        g.moveTo(vx, dy ? y : yp);
        g.lineTo(vx, hy);
        g.lineTo(dx ? x : xp, hy);
        g.stroke();
        return;
    }

    if (down) {
        g.beginPath();
        g.moveTo(vx, y);
        g.lineTo(vx, yp);
        g.stroke();
        return;
    }

    g.beginPath();
    g.moveTo(x, hy);
    g.lineTo(xp, hy);
    g.stroke();
}

function coyleanExploration(numRows, numCols) {
    let [downMatrix, rightMatrix] = propagate(numRows, numCols, rightsPos, downsPos);

    for (let j = 0; j < numRows; j++) {
        for (let i = 0; i < numCols; i++) {
            cell(downMatrix[j][i], rightMatrix[i][j], i, j);
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
    const { nw, ne, sw, se } = universalPropagate(numRows, numCols);
    const [nwDM, nwRM] = nw;
    const [neDM, neRM] = ne;
    const [swDM, swRM] = sw;
    const [seDM, seRM] = se;

    // SE: identity — full range, owns both axes
    for (let j = 0; j < numRows; j++) {
        for (let i = 0; i < numCols; i++) {
            cell(seDM[j][i], seRM[i][j], numCols + i, numRows + j, 1, 1);
        }
    }
    // NE: sₕ — suppress down at j=0 (init row duplicate)
    for (let j = 0; j < numRows; j++) {
        for (let i = 0; i < numCols; i++) {
            cell(
                j === 0 ? false : neDM[j][i],
                neRM[i][j],
                numCols + i,
                numRows - 1 - j,
                1,
                0,
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
                numRows + j,
                0,
                1,
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
                0,
                0,
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
        canvas.width = SCALE * (2 * numCols + 1);
        canvas.height = SCALE * (2 * numRows + 1);
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
eleScaleReset.innerHTML = SCALE;
eleRightsPos.innerHTML = rightsPos;
eleDownsPos.innerHTML = downsPos;
coyleanApp();
