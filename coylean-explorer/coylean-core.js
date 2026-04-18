"use strict";

export class Seniority {
    static VERTICAL = 0;
    static HORIZONTAL = 1;

    static vertical() {
        return new Seniority(Seniority.VERTICAL);
    }

    static horizontal() {
        return new Seniority(Seniority.HORIZONTAL);
    }

    constructor(value = Seniority.VERTICAL) {
        this.value = value;
    }

    get isVertical() {
        return this.value === Seniority.VERTICAL;
    }
}

/**
 * Evenness (2-adic valuation) of n.
 * Counts trailing zeros in binary representation.
 * 0 has infinite evenness (returns 100).
 * evenness(n) == oddness(n - 1)
 */
export function pri(n) {
    let p = 0;
    if (n === 0) return 100;
    while (n % 2 === 0) {
        p++;
        n = Math.floor(n / 2);
    }
    return p;
}

/**
 * Debug-friendly array types.
 * Row prints vertical arrows:   "|" = present, "o" = absent
 * Col prints horizontal arrows: "-" = present, "o" = absent
 */
export class Row extends Array {
    toString() {
        return this.reduce((p, c) => p + (c ? "|" : "o"), "");
    }
}

export class Col extends Array {
    toString() {
        return this.reduce((p, c) => p + (c ? "-" : "o"), "");
    }
}

/**
 * The atom of the Coylean algorithm.
 *
 * Two arrows enter a cell — one vertical (from above), one horizontal
 * (from the left). Priority at the cell decides which direction "wins".
 * The winner continues straight; the loser is deflected. When only one
 * arrow is present it always continues, and the winner additionally
 * spawns a new arrow in the perpendicular direction.
 *
 * @param {boolean}   vertical   - Is a vertical (down) arrow entering this cell?
 * @param {boolean}   horizontal - Is a horizontal (right) arrow entering this cell?
 * @param {number}    i          - Column index of the cell (0-based).
 * @param {number}    j          - Row index of the cell (0-based).
 * @param {number}    hInitCol   - Column offset added to i before computing
 *                                 vertical priority: pri(i + hInitCol). The
 *                                 standard map uses 1; shifting this value
 *                                 repositions the priority landscape horizontally.
 * @param {number}    vInitRow   - Row offset added to j before computing
 *                                 horizontal priority: pri(j + vInitRow). The
 *                                 standard map uses 1; shifting this value
 *                                 repositions the priority landscape vertically.
 * @param {Seniority} seniority  - Tie-breaking rule when pri(i + hInitCol) equals
 *                                 pri(j + vInitRow). Vertical (default): the
 *                                 vertical arrow wins ties (>=). Horizontal: the
 *                                 horizontal arrow wins ties (strict >).
 * @returns {[boolean, boolean]}   [vertical out, horizontal out] — which arrows
 *                                 exit the cell downward and rightward.
 */
export function verticalWinsPriority(i, j, hInitCol, vInitRow, seniority = Seniority.vertical()) {
    return seniority.isVertical
        ? pri(i + hInitCol) >= pri(j + vInitRow)
        : pri(i + hInitCol) > pri(j + vInitRow);
}

export function reaction(
    vertical,
    horizontal,
    i,
    j,
    hInitCol,
    vInitRow,
    seniority = Seniority.vertical(),
) {
    if (!horizontal && !vertical) {
        return [false, false];
    }

    let downWins = verticalWinsPriority(i, j, hInitCol, vInitRow, seniority);
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

/**
 * Propagate arrows through a grid from arbitrary boundary inputs.
 *
 * downMatrix[j][i]  — vertical arrow entering row j at column i
 * rightMatrix[i][j] — horizontal arrow entering column i at row j
 *
 * The top row of downMatrix and the left column of rightMatrix are
 * seeded from the supplied initDown / initRight arrays. Grid size is
 * inferred from their lengths.
 * last 'extra' row in downMatrix and col in rightMatrix provides new init value
 * for subsequent call. (It is necessary for user to adjust the priority offsets
 * by the width or height)
 *
 * @param {boolean[]} initDown  - top-row down inputs (length = numColumns)
 * @param {boolean[]} initRight - left-column right inputs (length = numRows)
 * @param {number}    hInitCol  - horizontal priority offset
 * @param {number}    vInitRow  - vertical priority offset
 * @returns {{ downMatrix: Row[], rightMatrix: Col[] }}
 */
export function createDownMatrix(numRows) {
    return [...Array(numRows + 1)].map(() => new Row());
}

export function createRightMatrix(numColumns) {
    return [...Array(numColumns + 1)].map(() => new Col());
}

export function propagateFromBoundary(
    initDown,
    initRight,
    hInitCol,
    vInitRow,
    seniority = Seniority.vertical(),
) {
    const numColumns = initDown.length;
    const numRows = initRight.length;
    const downMatrix = createDownMatrix(numRows);
    const rightMatrix = createRightMatrix(numColumns);

    for (let i = 0; i < numColumns; i++) downMatrix[0][i] = initDown[i];
    for (let j = 0; j < numRows; j++) rightMatrix[0][j] = initRight[j];

    for (let j = 0; j < numRows; j++) {
        for (let i = 0; i < numColumns; i++) {
            [downMatrix[j + 1][i], rightMatrix[i + 1][j]] = reaction(
                downMatrix[j][i],
                rightMatrix[i][j],
                i,
                j,
                hInitCol,
                vInitRow,
                seniority,
            );
        }
    }
    return { downMatrix, rightMatrix };
}

/**
 * Propagate arrows through a grid with all-true boundaries.
 *
 * Initial conditions: top row all true, left column all true.
 * This is equivalent to the d[0]=true seed after it has propagated
 * through the first row of the standard algorithm (the seed at maximum
 * priority flips r[0]=true, which then flips every d[i] in row 0 to true).
 *
 * @param {number} numRows    - grid height
 * @param {number} numColumns - grid width
 * @param {number} hInitCol   - horizontal priority offset (initial column)
 * @param {number} vInitRow   - vertical priority offset (initial row)
 * @returns {{ downMatrix: Row[], rightMatrix: Col[] }}
 */
export function propagate(
    numRows,
    numColumns,
    hInitCol = 1,
    vInitRow = 1,
    seniority = Seniority.vertical(),
) {
    return propagateFromBoundary(
        new Row(numColumns).fill(true),
        new Col(numRows).fill(true),
        hInitCol,
        vInitRow,
        seniority,
    );
}

/**
 * Universal propagation across all four quadrants.
 *
 * Computes the full Coylean map extending in every direction from the
 * axis crossing point. Each quadrant is an independent propagate() call
 * with the appropriate (hInitCol, vInitRow) offset:
 *
 *       NW (0,0) │ NE (1,0)
 *       ─────────┼─────────
 *       SW (0,1) │ SE (1,1)
 *
 * The axis boundary (all-true initial conditions) is shared by
 * construction — each quadrant starts from the axis and propagates
 * outward. The rendering flips local coordinates to global canvas
 * positions, which automatically produces the correct axis segments.
 *
 * @param {number} numRows    - cells per quadrant in the vertical direction
 * @param {number} numColumns - cells per quadrant in the horizontal direction
 * @returns {{ nw, ne, sw, se }}
 *   Each quadrant is a { downMatrix, rightMatrix } object from propagate().
 */
export function universalPropagate(numRows, numColumns, hInitCol = 1, vInitRow = 1, seniority = Seniority.vertical()) {
    return {
        nw: propagate(numRows, numColumns, 1 - hInitCol, 1 - vInitRow, seniority),
        ne: propagate(numRows, numColumns, hInitCol, 1 - vInitRow, seniority),
        sw: propagate(numRows, numColumns, 1 - hInitCol, vInitRow, seniority),
        se: propagate(numRows, numColumns, hInitCol, vInitRow, seniority),
    };
}

export class Propagation {
    constructor(
        direction,
        numRows,
        numColumns,
        hInitCol,
        vInitRow,
        seniority,
        downMatrix,
        rightMatrix,
    ) {
        this.direction = direction;
        this.numRows = numRows;
        this.numColumns = numColumns;
        this.hInitCol = hInitCol;
        this.vInitRow = vInitRow;
        this.seniority = seniority;
        this.downMatrix = downMatrix;
        this.rightMatrix = rightMatrix;
    }

    get isNorth() {
        return this.direction === "nw" || this.direction === "ne";
    }

    get isSouth() {
        return this.direction === "sw" || this.direction === "se";
    }

    get isEast() {
        return this.direction === "ne" || this.direction === "se";
    }

    get isWest() {
        return this.direction === "nw" || this.direction === "sw";
    }
}
