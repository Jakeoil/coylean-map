"use strict";

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
 * Two booleans in (vertical arrow, horizontal arrow),
 * two booleans out (do they continue?).
 *
 * rightsPos and downsPos offset the priority grid.
 * The standard map uses (1, 1). Other values shift the
 * priority landscape, producing different maps.
 */
export function reaction(vertical, horizontal, i, j, rightsPos, downsPos, rightHigh = false) {
    if (!horizontal && !vertical) {
        return [false, false];
    }

    let downWins = rightHigh
        ? pri(i + rightsPos) > pri(j + downsPos)
        : pri(i + rightsPos) >= pri(j + downsPos);
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
 * Propagate arrows through a grid, building two boolean matrices.
 *
 * downMatrix[j][i]  — vertical arrow entering row j at column i
 * rightMatrix[i][j] — horizontal arrow entering column i at row j
 *
 * Initial conditions: top row all true, left column all true.
 * This is equivalent to the d[0]=true seed after it has propagated
 * through the first row of the standard algorithm.
 *
 * @param {number} numRows    - grid height
 * @param {number} numColumns - grid width
 * @param {number} rightsPos  - horizontal priority offset
 * @param {number} downsPos   - vertical priority offset
 * @returns {[Row[], Col[]]}  - [downMatrix, rightMatrix]
 */
export function propagate(numRows, numColumns, rightsPos, downsPos, rightHigh = false) {
    const initRow = new Row(numColumns).fill(true);
    const downMatrix = [...Array(numRows + 1)].map(() => new Row());
    const rightMatrix = [...Array(numColumns + 1)].map(() => new Col());

    downMatrix[0] = initRow;
    for (let j = 0; j < numRows; j++) {
        rightMatrix[0][j] = true;
        for (let i = 0; i < numColumns; i++) {
            [downMatrix[j + 1][i], rightMatrix[i + 1][j]] =
                reaction(
                    downMatrix[j][i],
                    rightMatrix[i][j],
                    i,
                    j,
                    rightsPos,
                    downsPos,
                    rightHigh,
                );
        }
    }
    return [downMatrix, rightMatrix];
}

/**
 * Universal propagation across all four quadrants.
 *
 * Computes the full Coylean map extending in every direction from the
 * axis crossing point. Each quadrant is an independent propagate() call
 * with the appropriate (rightsPos, downsPos) offset:
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
 *   Each quadrant is a [downMatrix, rightMatrix] pair from propagate().
 */
export function universalPropagate(numRows, numColumns, rightHigh = false) {
    return {
        nw: propagate(numRows, numColumns, 0, 0, rightHigh),
        ne: propagate(numRows, numColumns, 1, 0, rightHigh),
        sw: propagate(numRows, numColumns, 0, 1, rightHigh),
        se: propagate(numRows, numColumns, 1, 1, rightHigh),
    };
}
