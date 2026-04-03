"use strict";
import { pri, propagate, universalPropagate } from "./coylean-core.js";

let g; // canvas 2D context

// ── State ──

let feature_active = "legacy"; // "legacy", "explore", "universe"
let SIZE = 65;
let SCALE = 8;
let rightsPos = 1;
let downsPos = 1;

// ── DOM references ──

const elesExplore = document.querySelectorAll(".can-explore");
const eleActive = document.querySelector("#feature-active");
const radioButtons = document.querySelectorAll("input[name='feature']");
const eleSizeToggle = document.querySelector("#size-toggle");
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

document.querySelector("#size-dec").addEventListener("click", function () {
    if (SIZE > 1) SIZE--;
    eleSizeToggle.innerHTML = SIZE;
    coyleanApp();
});

document.querySelector("#size-inc").addEventListener("click", function () {
    SIZE++;
    eleSizeToggle.innerHTML = SIZE;
    coyleanApp();
});

eleSizeToggle.addEventListener("click", function () {
    SIZE = SIZE < 10 ? 65 : 5;
    eleSizeToggle.innerHTML = SIZE;
    coyleanApp();
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

function coyleanExploration() {
    let [downMatrix, rightMatrix] = propagate(SIZE, SIZE, rightsPos, downsPos);

    for (let j = 0; j < SIZE; j++) {
        for (let i = 0; i < SIZE; i++) {
            cell(downMatrix[j][i], rightMatrix[i][j], i, j);
        }
    }
}

function coyleanLegacy() {
    const downs = new Array(SIZE).fill(false);
    const rights = new Array(SIZE).fill(false);
    downs[0] = true;

    for (let j = 0; j < SIZE; j++) {
        let y = j * SCALE;
        let yp = y + SCALE;
        for (let i = 0; i < SIZE; i++) {
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

function coyleanUniverse() {
    const { nw, ne, sw, se, radius: R } = universalPropagate(SIZE);
    const [nwDM, nwRM] = nw;
    const [neDM, neRM] = ne;
    const [swDM, swRM] = sw;
    const [seDM, seRM] = se;

    // SE: identity — full range, owns both axes
    for (let j = 0; j < R; j++) {
        for (let i = 0; i < R; i++) {
            cell(seDM[j][i], seRM[i][j], R + i, R + j, 1, 1);
        }
    }
    // NE: sₕ — suppress down at j=0 (init row duplicate)
    for (let j = 0; j < R; j++) {
        for (let i = 0; i < R; i++) {
            cell(j === 0 ? false : neDM[j][i], neRM[i][j], R + i, R - 1 - j, 1, 0);
        }
    }
    // SW: sᵥ — suppress right at i=0 (init col duplicate)
    for (let j = 0; j < R; j++) {
        for (let i = 0; i < R; i++) {
            cell(swDM[j][i], i === 0 ? false : swRM[i][j], R - 1 - i, R + j, 0, 1);
        }
    }
    // NW: r² — suppress down at j=0, right at i=0
    for (let j = 0; j < R; j++) {
        for (let i = 0; i < R; i++) {
            cell(j === 0 ? false : nwDM[j][i], i === 0 ? false : nwRM[i][j], R - 1 - i, R - 1 - j, 0, 0);
        }
    }
}

// ── App ──

function coyleanApp() {
    const canvas = document.querySelector("#explore-map > canvas");
    g = canvas.getContext("2d");
    g.lineWidth = 1;

    if (feature_active === "universe") {
        canvas.width = SCALE * (2 * SIZE + 1);
        canvas.height = SCALE * (2 * SIZE + 1);
    } else {
        canvas.width = SCALE * (SIZE + 1);
        canvas.height = SCALE * (SIZE + 1);
    }

    const drawScreen =
        feature_active === "universe"
            ? coyleanUniverse
            : feature_active === "explore"
              ? coyleanExploration
              : coyleanLegacy;
    drawScreen();
}

// ── Init ──

refreshFeatureActive();
eleSizeToggle.innerHTML = SIZE;
eleScaleReset.innerHTML = SCALE;
eleRightsPos.innerHTML = rightsPos;
eleDownsPos.innerHTML = downsPos;
coyleanApp();
