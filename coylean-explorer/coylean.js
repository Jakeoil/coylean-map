"use strict";
let g;

/**
 * Controls (preferences)
 */

const elesExplore = document.querySelectorAll(".can-explore");

/**
 * Map type
 */
let feature_active = false;

const eleActive = document.querySelector("#feature-active");
const radioButtons = document.querySelectorAll("input[name='feature']");

const refreshFeatureActive = () => {
    for (let button of radioButtons) {
        if (feature_active) {
            if (button.id == "exp") {
                if (!button.checked) button.checked = true;
            }
        } else {
            if (button.id == "leg") {
                if (!button.checked) button.checked = true;
            }
        }
    }
    eleActive.innerHTML = feature_active ? "Explore" : "Legacy";
    for (let ele of elesExplore) {
        ele.style.display = feature_active ? "block" : "none";
    }
};

refreshFeatureActive();
const toggleActive = function () {
    feature_active = !feature_active;
    refreshFeatureActive();

    coyleanApp();
};

const featureClicked = function () {
    console.log("radio button clicked");
    for (let button of radioButtons) {
        if (button.checked) {
            console.log(`value: ${button.value}`);
            feature_active = button.id == "exp";
            console.log(`feature-active: ${feature_active}`);
            refreshFeatureActive();
        }
    }
    coyleanApp();
};
/**
 * Size and Scale
 */
let SIZE = 65;

const eleSizeDec = document.querySelector("#size-dec");
const eleSizeInc = document.querySelector("#size-inc");
const eleSizeToggle = document.querySelector("#size-toggle");

eleSizeToggle.innerHTML = SIZE;
const clickSizeInc = function () {
    SIZE++;
    eleSizeToggle.innerHTML = SIZE;
    coyleanApp();
};
const clickSizeDec = function () {
    if (SIZE > 1) SIZE--;
    eleSizeToggle.innerHTML = SIZE;
    coyleanApp();
};
const clickSizeToggle = function () {
    if (SIZE < 10) {
        SIZE = 65;
    } else {
        SIZE = 5;
    }
    eleSizeToggle.innerHTML = SIZE;
    coyleanApp();
};

let SCALE = 8;

const eleScaleDec = document.querySelector("#scale-dec");
const eleScaleInc = document.querySelector("#scale-inc");
const eleScaleReset = document.querySelector("#scale-reset");

eleScaleReset.innerHTML = SCALE;
const clickScaleInc = function () {
    SCALE++;
    eleScaleReset.innerHTML = SCALE;
    coyleanApp();
};
const clickScaleDec = function () {
    if (SCALE > 1) SCALE--;
    eleScaleReset.innerHTML = SCALE;
    coyleanApp();
};
const clickScaleReset = function () {
    if (SCALE != 8) SCALE = 8;
    eleScaleReset.innerHTML = SIZE;
    coyleanApp();
};

/**
 * Horizontal and Vertical Initializations
 */
let rightsPos = 1;
let downsPos = 1;

const eleLeft = document.querySelector("#rights-left");
const eleRight = document.querySelector("#rights-right");
const eleUp = document.querySelector("#downs-up");
const eleDown = document.querySelector("#rights-right");
const eleDownsPos = document.querySelector("#downs-pos");
const eleRightsPos = document.querySelector("#rights-pos");

/**
 * These control the are the rights- and downs- Pos
 */
eleRightsPos.innerHTML = rightsPos;
eleDownsPos.innerHTML = downsPos;

const clickRight = function () {
    rightsPos++;
    eleRightsPos.innerHTML = rightsPos;
    coyleanApp();
};
const clickLeft = function () {
    rightsPos--;
    eleRightsPos.innerHTML = rightsPos;
    coyleanApp();
};
const clickUp = function () {
    downsPos--;
    eleDownsPos.innerHTML = downsPos;
    coyleanApp();
};
const clickDown = function () {
    downsPos++;
    eleDownsPos.innerHTML = downsPos;
    coyleanApp();
};

/** Returns the evenness of a number
 * 1 is the least even (0)
 * 0 is the most 100. 2^100 is just as even
 * WE CAN DO BETTER THAN THIS
 */
function pri(n) {
    let p = 0;
    if (n == 0) return 100;

    while (n % 2 == 0) {
        p++;
        n = Math.floor(n / 2);
    }
    return p;
}

/**
 * These little wrappers allow nice string methods for logging.
 */
class Row extends Array {
    toString() {
        return this.reduce(
            (previousValue, currentValue) =>
                previousValue + (currentValue ? "|" : "o"),
            ""
        );
    }
}

class Col extends Array {
    toString() {
        return this.reduce(
            (previousValue, currentValue) =>
                previousValue + (currentValue ? "-" : "o"),
            ""
        );
    }
}

/**
 * This little stub is almost pointless
 */
function coyleanApp() {
    console.log("draw the map");
    exploreMap("explore-map");
}

function exploreMap(id) {
    const canvas = document.querySelector(`#explore-map > canvas`);

    g = canvas.getContext("2d");
    g.lineWidth = 1;
    canvas.width = SCALE * (SIZE + 1);
    canvas.height = SCALE * (SIZE + 1);
    const drawScreen = feature_active ? coyleanExploration : coyleanLegacy;

    drawScreen();
}

/**
 * The legacy map.
 */
function coyleanLegacy() {
    const downs = [];
    const rights = [];

    for (let i = 0; i < SIZE; i++) {
        downs.push(false);
        rights.push(false);
    }
    downs[0] = true; // !!! set them all to true
    // !!start j at 1. add right base
    for (let j = 0; j < SIZE; j++) {
        // Y (rights)
        let y = j * SCALE;
        let yp = y + SCALE;
        for (let i = 0; i < SIZE; i++) {
            // X (downs)
            let x = i * SCALE;
            let xp = x + SCALE;
            if (downs[i]) {
                if (rights[j]) {
                    // _|
                    g.beginPath();
                    g.moveTo(xp, y);
                    g.lineTo(xp, yp);
                    g.lineTo(x, yp);
                    g.stroke();

                    if (pri(i) >= pri(j)) {
                        // _|
                        //  |
                        downs[i] = true;
                        rights[j] = false;
                    } else {
                        //  _|_
                        //
                        downs[i] = false;
                        rights[j] = true;
                    }
                } else {
                    //   |_
                    //   |
                    g.beginPath();
                    g.moveTo(xp, y);
                    g.lineTo(xp, yp);
                    g.stroke();

                    if (pri(i) >= pri(j)) {
                        //   |_
                        //   |
                        downs[i] = true;
                        rights[j] = true;
                    } else {
                        //   |
                        //   |
                        downs[i] = true;
                        rights[j] = false;
                    }
                }
            } else {
                if (rights[j]) {
                    //   __
                    g.beginPath();
                    g.moveTo(xp, yp);
                    g.lineTo(x, yp);
                    g.stroke();

                    if (pri(i) >= pri(j)) {
                        downs[i] = false;
                        rights[j] = true;
                    } else {
                        // ___
                        //  |
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

/**
 * Two matrices representing the vertical strokes and horizontal strokes respectivily.
 * Render them.
 *
 * Preconditions:
 *     rightsPos
 *     downsPos
 */
function coyleanExploration() {
    let width = SIZE;
    let height = SIZE;
    // seLoop(height - downsPos, width-rightsPos);
    let [downMatrix, rightMatrix] = seLoop(height, width);
    // Future, do the same for the swLoop where we go left. -i.
    //
    //   h = height - downsPos; w = rightsPos;
    //   rightsPos = (-rightsPos + 1)
    //   swLoop(h, w);

    //
    // The nwLoop, where we go left and up.
    //   nwLoop(downsPos, rightsPos);
    //   rightsPos = (-rightsPos + 1)
    //   downsPos = (-downsPos + 1)
    // The neLoop, where we go up.
    //   neLoop(downsPos, width - rightsPos);
    //   downsPos = (-downsPos + 1)

    for (let j = 0; j < SIZE; j++) {
        for (let i = 0; i < SIZE; i++) {
            cell(downMatrix[j][i], rightMatrix[i][j], i, j);
        }
    }
}

/**
 * The Southeast Loop
 *
 * This computes the default sector of the Coylean Region
 * From the initial row and columns, all set, it builds two Matrices based
 * on the horizontal and vertical size.
 * A loop on rows and columns.
 * Creates a matrix using a column with numRows rights.
 * And a row with numColumns downs
 *
 */
function seLoop(numRows, numColumns) {
    const initRow = new Row(numColumns).fill(true);
    const downMatrix = [...Array(numRows + 1)].map((x) => new Row());
    const rightMatrix = [...Array(numColumns + 1)].map((x) => new Col());
    let j = 0;
    downMatrix[j] = initRow; // Full of rights
    for (j = 0; j < numRows; j++) {
        // right matrix column zero first element i=0 inited
        let i = 0;
        rightMatrix[i][j] = true;
        for (i = 0; i < numColumns; i++) {
            [downMatrix[j + 1][i] = a[0], rightMatrix[i + 1][j] = a[1]] =
                reaction(
                    downMatrix[j][i], // this is correct
                    rightMatrix[i][j],
                    i,
                    j
                );
        }
    }
    return [downMatrix, rightMatrix];
}

function cell(down, right, i, j) {
    if (!down && !right) return;

    let x = i * SCALE;
    let xp = x + SCALE;
    let y = j * SCALE;
    let yp = y + SCALE;

    if (down && right) {
        // _|
        g.beginPath();
        g.moveTo(xp, y);
        g.lineTo(xp, yp);
        g.lineTo(x, yp);
        g.stroke();
        return;
    }

    if (down) {
        //   |
        g.beginPath();
        g.moveTo(xp, y);
        g.lineTo(xp, yp);
        g.stroke();
        return;
    }
    //   __
    g.beginPath();
    g.moveTo(xp, yp);
    g.lineTo(x, yp);
    g.stroke();
}

/***
 * Purely logical result of inputs horizontal and vertical.
 * The direction should not matter so southeast is a bad name.
 * i and j is the logical, determining the outputs.
 */

function reaction(vertical, horizontal, i, j) {
    if (!horizontal && !vertical) {
        return [false, false];
    }

    let downWins = pri(i + rightsPos) >= pri(j + downsPos);
    if (horizontal && vertical) {
        if (downWins) return [true, false];
        else return [false, true];
    }

    if (vertical) {
        if (downWins) return [true, true];
        else return [true, false];
    } else {
        if (downWins) return [false, true];
        else return [true, true];
    }
}
