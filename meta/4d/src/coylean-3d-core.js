"use strict";

import { priority3 } from "./3-bit-priority-cnot-cascade.js";

// Same 6 priority permutations as priority3 / 3-bit-priority-cnot-cascade.js.
// perms[i] = [highest, middle, lowest] in axis-index terms, where axes
// carry the bit labels priority3 uses internally:
//   bit 0 = A = vertical (down) flow
//   bit 1 = B = horizontal (right) flow
//   bit 2 = C = inward (in) flow
// The A/B/C labels are bit-position labels, not priority claims — the
// actual priority order at a cell is decided by pri() values + Seniority3D.
const PERMS = [
    [0, 1, 2], // A > B > C
    [0, 2, 1], // A > C > B
    [1, 0, 2], // B > A > C
    [1, 2, 0], // B > C > A
    [2, 0, 1], // C > A > B
    [2, 1, 0], // C > B > A
];

/**
 * Tie-break rule for 3D Coylean priority comparisons.
 *
 * 2D Seniority picks between two axes (vertical or horizontal); the 3D
 * analogue picks among six total orderings of three axes. The orderIndex
 * (0..5) selects one of the PERMS rows; when two or three priority
 * values tie at a cell, the axis appearing earlier in the chosen
 * permutation wins the tie. When all three priorities are distinct the
 * Seniority3D is not consulted — the priorities alone determine the
 * cascade order.
 */
export class Seniority3D {
    static fromOrderIndex(orderIndex) {
        return new Seniority3D(orderIndex);
    }
    static aOverBOverC() {
        return new Seniority3D(0);
    }
    static aOverCOverB() {
        return new Seniority3D(1);
    }
    static bOverAOverC() {
        return new Seniority3D(2);
    }
    static bOverCOverA() {
        return new Seniority3D(3);
    }
    static cOverAOverB() {
        return new Seniority3D(4);
    }
    static cOverBOverA() {
        return new Seniority3D(5);
    }

    constructor(orderIndex = 0) {
        this.orderIndex = orderIndex;
    }

    get permutation() {
        return PERMS[this.orderIndex];
    }
}

/**
 * Evenness (2-adic valuation) of n.
 * Counts trailing zeros in binary representation.
 * 0 has infinite evenness (returns 100).
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
 * Debug-friendly array types for the three flow axes.
 *   Row prints vertical (down) arrows:    "|" / "o"
 *   Col prints horizontal (right) arrows: "-" / "o"
 *   Layer prints inward (in) arrows:      "*" / "o"
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

export class Layer extends Array {
    toString() {
        return this.reduce((p, c) => p + (c ? "*" : "o"), "");
    }
}

/**
 * Convert per-axis priority values into a priority-CNOT-cascade orderIndex.
 *
 * Sorts the three axes by their priority value (descending). When two
 * or three priorities tie, the axis appearing earlier in
 * seniority.permutation wins the tie. The resulting axis ordering is
 * one of the 6 PERMS rows; its index is returned.
 *
 * Axis labels (matching priority3's bit assignment):
 *   axis 0 = A = vertical,   priority = colPriority
 *   axis 1 = B = horizontal, priority = rowPriority
 *   axis 2 = C = inward,     priority = layerPriority
 *
 * @returns {number} 0..5
 */
export function orderIndexFromPriorities(
    colPriority,
    rowPriority,
    layerPriority,
    seniority = Seniority3D.aOverBOverC(),
) {
    const priorities = [colPriority, rowPriority, layerPriority];
    const seniorityRank = [0, 0, 0];
    seniority.permutation.forEach((axis, rank) => {
        seniorityRank[axis] = rank;
    });
    const axes = [0, 1, 2].sort((a, b) => {
        const dp = priorities[b] - priorities[a];
        if (dp !== 0) return dp;
        return seniorityRank[a] - seniorityRank[b];
    });
    for (let i = 0; i < PERMS.length; i++) {
        const p = PERMS[i];
        if (p[0] === axes[0] && p[1] === axes[1] && p[2] === axes[2]) {
            return i;
        }
    }
    throw new Error(
        `orderIndexFromPriorities: no matching perm for [${axes}]`,
    );
}

/**
 * The atom of the 3D Coylean algorithm.
 *
 * Three arrows enter a cell — one vertical (from above), one horizontal
 * (from the left), one inward (from the viewer side). Priorities at the
 * cell, plus tie-breaking seniority, determine the cascade order. The
 * reaction is implemented as the 3-bit priority CNOT (priority3) applied
 * to the packed input bits with the chosen orderIndex.
 *
 * Bit packing (matches priority3 convention):
 *   bit 0 = vertical, bit 1 = horizontal, bit 2 = inward
 *
 * @returns {[boolean, boolean, boolean]}  [vOut, hOut, inOut]
 */
export function reactionFromPriority(
    vertical,
    horizontal,
    inward,
    colPriority,
    rowPriority,
    layerPriority,
    seniority = Seniority3D.aOverBOverC(),
) {
    const orderIndex = orderIndexFromPriorities(
        colPriority,
        rowPriority,
        layerPriority,
        seniority,
    );
    const x =
        (vertical ? 1 : 0) | (horizontal ? 2 : 0) | (inward ? 4 : 0);
    const y = priority3(x, orderIndex);
    return [(y & 1) === 1, (y & 2) === 2, (y & 4) === 4];
}

/**
 * Convenience wrapper: compute the three axis priorities from the cell
 * coordinates and offsets, then invoke reactionFromPriority.
 */
export function reaction(
    vertical,
    horizontal,
    inward,
    i,
    j,
    k,
    hInitCol,
    vInitRow,
    iInitLay,
    seniority = Seniority3D.aOverBOverC(),
) {
    return reactionFromPriority(
        vertical,
        horizontal,
        inward,
        pri(i + hInitCol),
        pri(j + vInitRow),
        pri(k + iInitLay),
        seniority,
    );
}

/**
 * Factories for the three flow matrices. Each is a 3D nested array
 * sized (propagationAxis + 1) × perpendicular plane. The +1 holds the
 * boundary seed plus all propagated steps.
 *
 *   downMatrix[j][i][k]  — j is the propagation axis (numRows + 1 entries)
 *   rightMatrix[i][j][k] — i is the propagation axis
 *   inMatrix[k][i][j]    — k is the propagation axis
 */
export function createDownMatrix(numRows, numColumns, numLayers) {
    return [...Array(numRows + 1)].map(() =>
        [...Array(numColumns)].map(() => new Layer(numLayers)),
    );
}

export function createRightMatrix(numRows, numColumns, numLayers) {
    return [...Array(numColumns + 1)].map(() =>
        [...Array(numRows)].map(() => new Layer(numLayers)),
    );
}

export function createInMatrix(numRows, numColumns, numLayers) {
    return [...Array(numLayers + 1)].map(() =>
        [...Array(numColumns)].map(() => new Row(numRows)),
    );
}

/**
 * Propagate arrows through a 3D grid from arbitrary boundary inputs.
 *
 * Each initial face is a 2D array of booleans indexed by the two
 * perpendicular coordinates:
 *   initDown[i][k]  — top j=0 face, sized numColumns × numLayers
 *   initRight[j][k] — left i=0 face, sized numRows × numLayers
 *   initIn[i][j]    — near k=0 face, sized numColumns × numRows
 *
 * Grid extents are inferred from the init faces when not supplied.
 *
 * @returns {{ downMatrix, rightMatrix, inMatrix }}
 */
export function propagateFromBoundary(
    initDown,
    initRight,
    initIn,
    hInitCol,
    vInitRow,
    iInitLay,
    seniority = Seniority3D.aOverBOverC(),
) {
    const { downMatrix, rightMatrix, inMatrix } = new Propagation({
        hInitCol,
        vInitRow,
        iInitLay,
        seniority,
        initDown,
        initRight,
        initIn,
    });
    return { downMatrix, rightMatrix, inMatrix };
}

/**
 * All-true-boundary propagate. The natural starting point: every face
 * is fully "lit", analogous to 2D propagate.
 */
export function propagate(
    numRows,
    numColumns,
    numLayers,
    hInitCol = 1,
    vInitRow = 1,
    iInitLay = 1,
    seniority = Seniority3D.aOverBOverC(),
) {
    const initDown = [...Array(numColumns)].map(() =>
        new Layer(numLayers).fill(true),
    );
    const initRight = [...Array(numRows)].map(() =>
        new Layer(numLayers).fill(true),
    );
    const initIn = [...Array(numColumns)].map(() =>
        new Row(numRows).fill(true),
    );
    return propagateFromBoundary(
        initDown,
        initRight,
        initIn,
        hInitCol,
        vInitRow,
        iInitLay,
        seniority,
    );
}

/**
 * A single directional propagation in 3D — one octant of the universe.
 *
 * 3D mirror of 2D Propagation. Each cell consumes three incoming arrows
 * (one per axis), applies the priority-CNOT reaction, and emits three
 * outgoing arrows at the +1 offset along each propagation axis.
 *
 * Priorities are evaluated at the cell as
 *   pri(i + hInitCol), pri(j + vInitRow), pri(k + iInitLay)
 * and combined with seniority to pick the orderIndex passed to priority3.
 *
 * @class Propagation
 */
export class Propagation {
    constructor({
        direction,
        numRows,
        numColumns,
        numLayers,
        hInitCol,
        vInitRow,
        iInitLay,
        seniority = Seniority3D.aOverBOverC(),
        initDown,
        initRight,
        initIn,
    }) {
        if (initDown === undefined) {
            initDown = [...Array(numColumns)].map(() =>
                new Layer(numLayers).fill(true),
            );
        }
        if (initRight === undefined) {
            initRight = [...Array(numRows)].map(() =>
                new Layer(numLayers).fill(true),
            );
        }
        if (initIn === undefined) {
            initIn = [...Array(numColumns)].map(() =>
                new Row(numRows).fill(true),
            );
        }
        if (numColumns === undefined) numColumns = initDown.length;
        if (numRows === undefined) numRows = initRight.length;
        if (numLayers === undefined) numLayers = initDown[0].length;

        this.direction = direction;
        this.numRows = numRows;
        this.numColumns = numColumns;
        this.numLayers = numLayers;
        this.hInitCol = hInitCol;
        this.vInitRow = vInitRow;
        this.iInitLay = iInitLay;
        this.seniority = seniority;

        this.colPriority = [...Array(numColumns)].map((_, i) =>
            pri(i + hInitCol),
        );
        this.rowPriority = [...Array(numRows)].map((_, j) =>
            pri(j + vInitRow),
        );
        this.layerPriority = [...Array(numLayers)].map((_, k) =>
            pri(k + iInitLay),
        );

        const downMatrix = createDownMatrix(numRows, numColumns, numLayers);
        const rightMatrix = createRightMatrix(numRows, numColumns, numLayers);
        const inMatrix = createInMatrix(numRows, numColumns, numLayers);

        for (let i = 0; i < numColumns; i++) {
            for (let k = 0; k < numLayers; k++) {
                downMatrix[0][i][k] = initDown[i][k];
            }
        }
        for (let j = 0; j < numRows; j++) {
            for (let k = 0; k < numLayers; k++) {
                rightMatrix[0][j][k] = initRight[j][k];
            }
        }
        for (let i = 0; i < numColumns; i++) {
            for (let j = 0; j < numRows; j++) {
                inMatrix[0][i][j] = initIn[i][j];
            }
        }

        for (let k = 0; k < numLayers; k++) {
            for (let j = 0; j < numRows; j++) {
                for (let i = 0; i < numColumns; i++) {
                    const [vOut, hOut, dOut] = reactionFromPriority(
                        downMatrix[j][i][k],
                        rightMatrix[i][j][k],
                        inMatrix[k][i][j],
                        this.colPriority[i],
                        this.rowPriority[j],
                        this.layerPriority[k],
                        seniority,
                    );
                    downMatrix[j + 1][i][k] = vOut;
                    rightMatrix[i + 1][j][k] = hOut;
                    inMatrix[k + 1][i][j] = dOut;
                }
            }
        }

        this.downMatrix = downMatrix;
        this.rightMatrix = rightMatrix;
        this.inMatrix = inMatrix;
    }

    get initDown() {
        return this.downMatrix[0];
    }
    get initRight() {
        return this.rightMatrix[0];
    }
    get initIn() {
        return this.inMatrix[0];
    }

    get resultDown() {
        return this.downMatrix[this.numRows];
    }
    get resultRight() {
        return this.rightMatrix[this.numColumns];
    }
    get resultIn() {
        return this.inMatrix[this.numLayers];
    }
}
