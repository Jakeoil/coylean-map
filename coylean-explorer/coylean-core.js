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
export function verticalWinsPriority(
    i,
    j,
    hInitCol,
    vInitRow,
    seniority = Seniority.vertical(),
) {
    return seniority.isVertical
        ? pri(i + hInitCol) >= pri(j + vInitRow)
        : pri(i + hInitCol) > pri(j + vInitRow);
}

function reactionFromPriority(
    vertical,
    horizontal,
    colPriority,
    rowPriority,
    seniority = Seniority.vertical(),
) {
    if (!horizontal && !vertical) {
        return [false, false];
    }

    const downWins = seniority.isVertical
        ? colPriority >= rowPriority
        : colPriority > rowPriority;
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

export function reaction(
    vertical,
    horizontal,
    i,
    j,
    hInitCol,
    vInitRow,
    seniority = Seniority.vertical(),
) {
    return reactionFromPriority(
        vertical,
        horizontal,
        pri(i + hInitCol),
        pri(j + vInitRow),
        seniority,
    );
}

/**
 * Propagate arrows through a grid from arbitrary boundary inputs.
 *
 * Function-style wrapper around Propagation.computeFromBoundary — retained
 * for callers that want a plain { downMatrix, rightMatrix } result without
 * constructing a Propagation instance.
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
// Note: the +1 allocates an extra trailing row/col beyond the grid.
// Original intent was that this extra slice could seed the init of a
// subsequent call (a natural continuation of the propagation); the current
// callers don't use it, so it's effectively unused overhead today.
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
    const { downMatrix, rightMatrix } = Propagation.computeFromBoundary({
        initDown,
        initRight,
        hInitCol,
        vInitRow,
        seniority,
    });
    return { downMatrix, rightMatrix };
}

/**
 * Propagate arrows through a grid with all-true boundaries.
 *
 * Function-style wrapper retained for legacy callers; Propagation.create()
 * is the class-based equivalent.
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
 * Function-style wrapper around Universe.createSymmetric — returns the raw
 * { nw, ne, sw, se } quadrant bundle for callers that don't need the
 * Universe assembly abstraction.
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
export function universalPropagate(
    numRows,
    numColumns,
    hInitCol = 1,
    vInitRow = 1,
    seniority = Seniority.vertical(),
) {
    const { nw, ne, sw, se } = Universe.createSymmetric(
        numRows,
        numColumns,
        hInitCol,
        vInitRow,
        seniority,
    );
    return { nw, ne, sw, se };
}

/**
 * A single directional propagation of the Coylean algorithm.
 *
 * A Propagation represents one quadrant of the universe, extending outward
 * from the central propagation origin. It encapsulates the local grid,
 * priority offsets, and the resulting arrow matrices for that quadrant.
 *
 * The direction determines how this propagation is oriented relative to
 * the global universe:
 *   - "se" → positive columns, positive rows
 *   - "ne" → positive columns, negative rows
 *   - "sw" → negative columns, positive rows
 *   - "nw" → negative columns, negative rows
 *
 * Each propagation is computed independently using the Coylean rules,
 * producing two matrices:
 *   - downMatrix[j][i]  — vertical arrows (flowing downward)
 *   - rightMatrix[i][j] — horizontal arrows (flowing rightward)
 *
 * Priority is evaluated using shifted local coordinates:
 *   pri(i + hInitCol) and pri(j + vInitRow)
 *
 * The offsets (hInitCol, vInitRow) define the placement of the priority
 * grid relative to the propagation origin. The propagation origin itself
 * is geometric and independent of the priority lattice.
 *
 * A Propagation is a local object: it does not know about other quadrants.
 * Multiple Propagations are combined by the Universe assembly process
 * into a single global raster.
 *
 * @class Propagation
 *
 * @param {"nw"|"ne"|"sw"|"se"} direction
 *   Directional identity of this propagation.
 *
 * @param {number} numRows
 *   Number of rows in the local grid.
 *
 * @param {number} numColumns
 *   Number of columns in the local grid.
 *
 * @param {number} hInitCol
 *   Horizontal offset applied to column indices when computing priority.
 *
 * @param {number} vInitRow
 *   Vertical offset applied to row indices when computing priority.
 *
 * @param {Seniority} seniority
 *   Tie-breaking rule for priority comparisons.
 *
 * @param {Row[]} downMatrix
 *   Matrix of vertical arrow states: downMatrix[j][i].
 *
 * @param {Col[]} rightMatrix
 *   Matrix of horizontal arrow states: rightMatrix[i][j].
 *
 * @static
 * @method fromMatrices
 * @param {Object} options
 * @param {"nw"|"ne"|"sw"|"se"} options.direction
 * @param {number} options.numRows
 * @param {number} options.numColumns
 * @param {number} options.hInitCol
 * @param {number} options.vInitRow
 * @param {Seniority} options.seniority
 * @param {Row[]} options.downMatrix
 * @param {Col[]} options.rightMatrix
 * @returns {Propagation}
 *   Constructs a Propagation from precomputed matrices.
 *
 * @property {"nw"|"ne"|"sw"|"se"} direction
 * @property {number} numRows
 * @property {number} numColumns
 * @property {number} hInitCol
 * @property {number} vInitRow
 * @property {Seniority} seniority
 * @property {Row[]} downMatrix
 * @property {Col[]} rightMatrix
 * @property {number[]} colPriority
 *   Precomputed priority for each local column: pri(i + hInitCol).
 * @property {number[]} rowPriority
 *   Precomputed priority for each local row: pri(j + vInitRow).
 *
 * @readonly
 * @property {boolean} isNorth
 * @readonly
 * @property {boolean} isSouth
 * @readonly
 * @property {boolean} isEast
 * @readonly
 * @property {boolean} isWest
 */
export class Propagation {
    static fromMatrices({
        direction,
        numRows,
        numColumns,
        hInitCol,
        vInitRow,
        seniority,
        downMatrix,
        rightMatrix,
    }) {
        return new Propagation(
            direction,
            numRows,
            numColumns,
            hInitCol,
            vInitRow,
            seniority,
            downMatrix,
            rightMatrix,
        );
    }

    /**
     * Class-based construction API: compute a Propagation with all-true
     * boundaries. Preferred over the propagate() function wrapper when the
     * caller wants a Propagation instance with direction/priority metadata.
     *
     * @param {Object} options
     * @param {"nw"|"ne"|"sw"|"se"} options.direction
     * @param {number} options.numRows
     * @param {number} options.numColumns
     * @param {number} options.hInitCol
     * @param {number} options.vInitRow
     * @param {Seniority} [options.seniority]
     * @returns {Propagation}
     */
    static create({
        direction,
        numRows,
        numColumns,
        hInitCol,
        vInitRow,
        seniority = Seniority.vertical(),
    }) {
        const { downMatrix, rightMatrix } = Propagation.computeFromBoundary({
            initDown: new Row(numColumns).fill(true),
            initRight: new Col(numRows).fill(true),
            hInitCol,
            vInitRow,
            seniority,
        });
        return new Propagation(
            direction,
            numRows,
            numColumns,
            hInitCol,
            vInitRow,
            seniority,
            downMatrix,
            rightMatrix,
        );
    }

    /**
     * Class-based construction API: compute a Propagation from explicit
     * boundary inputs. Preferred over the propagateFromBoundary() function
     * wrapper when the caller wants a Propagation instance.
     *
     * @param {Object} options
     * @param {"nw"|"ne"|"sw"|"se"} options.direction
     * @param {boolean[]} options.initDown   - top-row down inputs (length = numColumns)
     * @param {boolean[]} options.initRight  - left-column right inputs (length = numRows)
     * @param {number} options.hInitCol
     * @param {number} options.vInitRow
     * @param {Seniority} [options.seniority]
     * @returns {Propagation}
     */
    static fromBoundary({
        direction,
        initDown,
        initRight,
        hInitCol,
        vInitRow,
        seniority = Seniority.vertical(),
    }) {
        const { downMatrix, rightMatrix, numRows, numColumns } =
            Propagation.computeFromBoundary({
                initDown,
                initRight,
                hInitCol,
                vInitRow,
                seniority,
            });
        return new Propagation(
            direction,
            numRows,
            numColumns,
            hInitCol,
            vInitRow,
            seniority,
            downMatrix,
            rightMatrix,
        );
    }

    /**
     * Core boundary-propagation algorithm. Returns the computed matrices
     * along with the inferred grid dimensions.
     *
     * @param {Object} options
     * @param {boolean[]} options.initDown
     * @param {boolean[]} options.initRight
     * @param {number} options.hInitCol
     * @param {number} options.vInitRow
     * @param {Seniority} [options.seniority]
     * @returns {{ downMatrix: Row[], rightMatrix: Col[], numRows: number, numColumns: number }}
     */
    static computeFromBoundary({
        initDown,
        initRight,
        hInitCol,
        vInitRow,
        seniority = Seniority.vertical(),
    }) {
        const numColumns = initDown.length;
        const numRows = initRight.length;
        const downMatrix = createDownMatrix(numRows);
        const rightMatrix = createRightMatrix(numColumns);

        for (let i = 0; i < numColumns; i++) downMatrix[0][i] = initDown[i];
        for (let j = 0; j < numRows; j++) rightMatrix[0][j] = initRight[j];

        const colPriority = [...Array(numColumns)].map((_, i) =>
            pri(i + hInitCol),
        );
        const rowPriority = [...Array(numRows)].map((_, j) =>
            pri(j + vInitRow),
        );

        for (let j = 0; j < numRows; j++) {
            for (let i = 0; i < numColumns; i++) {
                [downMatrix[j + 1][i], rightMatrix[i + 1][j]] =
                    reactionFromPriority(
                        downMatrix[j][i],
                        rightMatrix[i][j],
                        colPriority[i],
                        rowPriority[j],
                        seniority,
                    );
            }
        }
        return { downMatrix, rightMatrix, numRows, numColumns };
    }
    // Convention:
    // downMatrix[j][i]  → vertical flow
    // rightMatrix[i][j] → horizontal flow
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
        this.colPriority = [...Array(numColumns)].map((_, i) =>
            pri(i + hInitCol),
        );
        this.rowPriority = [...Array(numRows)].map((_, j) => pri(j + vInitRow));
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
/**
 * Assembly-level abstraction: a composed Coylean universe assembled from
 * four directional propagations. Where Propagation models a single quadrant,
 * Universe owns the stitching, origin geometry, and global raster output
 * that renderers consume.
 *
 * A Universe represents a finite rectangular region centered on a propagation
 * origin, constructed by stitching together four quadrant Propagation objects:
 *   - nw (northwest)
 *   - ne (northeast)
 *   - sw (southwest)
 *   - se (southeast)
 *
 * The universe is defined geometrically by independent extents in each direction:
 *   - northExtent
 *   - southExtent
 *   - westExtent
 *   - eastExtent
 *
 * These extents need not be equal. The propagation origin lies at:
 *   (originRow = northExtent - 1, originCol = westExtent - 1)
 *
 * The priority grid is independent of this geometric center and is positioned
 * via the offsets:
 *   pri(i + hInitCol), pri(j + vInitRow)
 *
 * Assembly produces a single global raster representation:
 *   - downMatrix[j][i]  — vertical arrows (flowing downward)
 *   - rightMatrix[i][j] — horizontal arrows (flowing rightward)
 *
 * Quadrant stitching rules:
 *   - SE owns both axes (written last)
 *   - NE suppresses vertical arrows at its boundary (j === 0)
 *   - SW suppresses horizontal arrows at its boundary (i === 0)
 *   - NW suppresses both
 *
 * The renderer consumes only the assembled raster and metadata, without needing
 * to know about quadrant decomposition.
 *
 * @class Universe
 *
 * @param {number} northExtent
 *   Number of rows extending north from the propagation origin.
 *
 * @param {number} southExtent
 *   Number of rows extending south from the propagation origin.
 *
 * @param {number} westExtent
 *   Number of columns extending west from the propagation origin.
 *
 * @param {number} eastExtent
 *   Number of columns extending east from the propagation origin.
 *
 * @param {number} hInitCol
 *   Horizontal offset applied when evaluating priority.
 *
 * @param {number} vInitRow
 *   Vertical offset applied when evaluating priority.
 *
 * @param {Seniority} seniority
 *   Tie-breaking rule for priority comparisons.
 *
 * @param {Propagation} nw
 * @param {Propagation} ne
 * @param {Propagation} sw
 * @param {Propagation} se
 *
 * @static
 * @method fromPropagations
 * @param {Object} options
 * @param {number} options.northExtent
 * @param {number} options.southExtent
 * @param {number} options.westExtent
 * @param {number} options.eastExtent
 * @param {number} options.hInitCol
 * @param {number} options.vInitRow
 * @param {Seniority} options.seniority
 * @param {Propagation} options.nw
 * @param {Propagation} options.ne
 * @param {Propagation} options.sw
 * @param {Propagation} options.se
 * @returns {Universe}
 *
 * @method assemble
 * @returns {Object}
 * @returns {Row[]} returns.downMatrix
 * @returns {Col[]} returns.rightMatrix
 * @returns {number} returns.originRow
 * @returns {number} returns.originCol
 * @returns {number} returns.hInitCol
 * @returns {number} returns.vInitRow
 * @returns {number} returns.northExtent
 * @returns {number} returns.southExtent
 * @returns {number} returns.westExtent
 * @returns {number} returns.eastExtent
 *
 * @method debugAssemblySummary
 * @returns {Object}
 * @returns {number} returns.totalRows
 * @returns {number} returns.totalCols
 * @returns {number} returns.originRow
 * @returns {number} returns.originCol
 */
export class Universe {
    static fromPropagations({
        northExtent,
        southExtent,
        westExtent,
        eastExtent,
        hInitCol,
        vInitRow,
        seniority,
        nw,
        ne,
        sw,
        se,
    }) {
        return new Universe(
            northExtent,
            southExtent,
            westExtent,
            eastExtent,
            hInitCol,
            vInitRow,
            seniority,
            nw,
            ne,
            sw,
            se,
        );
    }

    /**
     * Build a symmetric Universe by computing four quadrant propagations.
     *
     * The four quadrants share the given numRows × numColumns extent, and
     * use the same priority-offset assignment as universalPropagate().
     *
     * @param {number} numRows
     * @param {number} numColumns
     * @param {number} [hInitCol]
     * @param {number} [vInitRow]
     * @param {Seniority} [seniority]
     * @returns {Universe}
     */
    static createSymmetric(
        numRows,
        numColumns,
        hInitCol = 1,
        vInitRow = 1,
        seniority = Seniority.vertical(),
    ) {
        const quadrant = (direction, h, v) =>
            Propagation.create({
                direction,
                numRows,
                numColumns,
                hInitCol: h,
                vInitRow: v,
                seniority,
            });
        return new Universe(
            numRows,
            numRows,
            numColumns,
            numColumns,
            hInitCol,
            vInitRow,
            seniority,
            quadrant("nw", 1 - hInitCol, 1 - vInitRow),
            quadrant("ne", hInitCol, 1 - vInitRow),
            quadrant("sw", 1 - hInitCol, vInitRow),
            quadrant("se", hInitCol, vInitRow),
        );
    }

    /**
     * Build the four quadrant propagations spanning
     * [minRow, maxRow] × [minCol, maxCol] (inclusive, signed about the
     * origin), returned unstitched.
     *
     * Shared-edge sizes: nw/sw share westExtent, ne/se share eastExtent,
     * nw/ne share northExtent, sw/se share southExtent. When the range
     * is not symmetric about the origin the four quadrants differ in
     * size accordingly.
     *
     * @param {[number, number]} rowRange  [minRow, maxRow] with minRow <= 0 <= maxRow
     * @param {[number, number]} colRange  [minCol, maxCol] with minCol <= 0 <= maxCol
     * @param {number} [hInitCol]
     * @param {number} [vInitRow]
     * @param {Seniority} [seniority]
     * @returns {{ nw: Propagation, ne: Propagation, sw: Propagation, se: Propagation }}
     */
    static createUniverseQuadrants(
        rowRange,
        colRange,
        hInitCol = 1,
        vInitRow = 1,
        seniority = Seniority.vertical(),
    ) {
        const [minRow, maxRow] = rowRange;
        const [minCol, maxCol] = colRange;
        const northExtent = 1 - minRow;
        const southExtent = maxRow + 1;
        const westExtent = 1 - minCol;
        const eastExtent = maxCol + 1;

        const quadrant = (direction, numRows, numColumns, h, v) =>
            Propagation.create({
                direction,
                numRows,
                numColumns,
                hInitCol: h,
                vInitRow: v,
                seniority,
            });
        // prettier-ignore
        return {
            nw: quadrant("nw", northExtent, westExtent, 1 - hInitCol, 1 - vInitRow),
            ne: quadrant("ne", northExtent, eastExtent, hInitCol,     1 - vInitRow),
            sw: quadrant("sw", southExtent, westExtent, 1 - hInitCol, vInitRow),
            se: quadrant("se", southExtent, eastExtent, hInitCol,     vInitRow),
        };
    }

    /**
     * Build the four quadrant propagations with extents
     * [minRow, maxRow] × [minCol, maxCol] (inclusive, signed about the
     * origin), returned unstitched.
     *
     * Shared-edge sizes: nw/sw share westExtent, ne/se share eastExtent,
     * nw/ne share northExtent, sw/se share southExtent. When the range
     * is not symmetric about the origin the four quadrants differ in
     * size accordingly.
     *
     * @param {[number, number]} rowRange  [minRow, maxRow] with minRow <= 0 <= maxRow
     * @param {[number, number]} colRange  [minCol, maxCol] with minCol <= 0 <= maxCol
     * @param {number} [hInitCol]
     * @param {number} [vInitRow]
     * @param {Seniority} [seniority]
     * @returns {{ nw: Propagation, ne: Propagation, sw: Propagation, se: Propagation }}
     */
    static createUniverseExtents(
        northExtent,
        southExtent,
        westExtent,
        eastExtent,
        hInitCol = 1,
        vInitRow = 1,
        seniority = Seniority.vertical(),
    ) {
        const quadrant = (direction, numRows, numColumns, h, v) =>
            Propagation.create({
                direction,
                numRows,
                numColumns,
                hInitCol: h,
                vInitRow: v,
                seniority,
            });
        // prettier-ignore
        return {
            nw: quadrant("nw", northExtent, westExtent, 1 - hInitCol, 1 - vInitRow),
            ne: quadrant("ne", northExtent, eastExtent, hInitCol,     1 - vInitRow),
            sw: quadrant("sw", southExtent, westExtent, 1 - hInitCol, vInitRow),
            se: quadrant("se", southExtent, eastExtent, hInitCol,     vInitRow),
        };
    }
    /**
     * Primary factory for a fully assembled Universe.
     *
     * Builds the four quadrant propagations with per-direction extents, then
     * runs assemble() and attaches the resulting global raster (downMatrix,
     * rightMatrix, originRow, originCol, colPriority, rowPriority) directly
     * onto the instance so callers don't need to call assemble() themselves.
     *
     * @param {Object} options
     * @param {number} options.northExtent
     * @param {number} options.southExtent
     * @param {number} options.westExtent
     * @param {number} options.eastExtent
     * @param {number} options.hInitCol
     * @param {number} options.vInitRow
     * @param {Seniority} [options.seniority]
     * @returns {Universe}
     */
    static create({
        northExtent,
        southExtent,
        westExtent,
        eastExtent,
        hInitCol,
        vInitRow,
        seniority = Seniority.vertical(),
    }) {
        const quadrant = (direction, numRows, numColumns, h, v) =>
            Propagation.create({
                direction,
                numRows,
                numColumns,
                hInitCol: h,
                vInitRow: v,
                seniority,
            });
        const universe = new Universe(
            northExtent,
            southExtent,
            westExtent,
            eastExtent,
            hInitCol,
            vInitRow,
            seniority,
            quadrant("nw", northExtent, westExtent, 1 - hInitCol, 1 - vInitRow),
            quadrant("ne", northExtent, eastExtent, hInitCol, 1 - vInitRow),
            quadrant("sw", southExtent, westExtent, 1 - hInitCol, vInitRow),
            quadrant("se", southExtent, eastExtent, hInitCol, vInitRow),
        );
        const assembled = universe.assemble();
        universe.downMatrix = assembled.downMatrix;
        universe.rightMatrix = assembled.rightMatrix;
        universe.originRow = assembled.originRow;
        universe.originCol = assembled.originCol;
        universe.colPriority = assembled.colPriority;
        universe.rowPriority = assembled.rowPriority;
        return universe;
    }

    constructor(
        northExtent,
        southExtent,
        westExtent,
        eastExtent,
        hInitCol,
        vInitRow,
        seniority,
        nw,
        ne,
        sw,
        se,
    ) {
        this.northExtent = northExtent;
        this.southExtent = southExtent;
        this.westExtent = westExtent;
        this.eastExtent = eastExtent;
        this.hInitCol = hInitCol;
        this.vInitRow = vInitRow;
        this.seniority = seniority;
        this.nw = nw;
        this.ne = ne;
        this.sw = sw;
        this.se = se;
    }

    assemble() {
        const {
            northExtent,
            southExtent,
            westExtent,
            eastExtent,
            hInitCol,
            vInitRow,
            nw,
            ne,
            sw,
            se,
        } = this;
        const originRow = northExtent - 1;
        const originCol = westExtent - 1;
        // Convention: northExtent / southExtent / westExtent / eastExtent
        // each include the origin row/col, so the assembled grid is
        // northExtent + southExtent - 1 rows × westExtent + eastExtent - 1 cols.
        // The JSDoc description of these fields is ambiguous; clarify before
        // consumers rely on the exclusive-of-origin reading.
        const numRows = northExtent + southExtent - 1;
        const numColumns = westExtent + eastExtent - 1;

        // Global index → local coordinate (relative to origin) → priority.
        const colPriority = [...Array(numColumns)].map((_, i) =>
            pri(i - originCol + hInitCol),
        );
        const rowPriority = [...Array(numRows)].map((_, j) =>
            pri(j - originRow + vInitRow),
        );

        const downMatrix = [...Array(numRows)].map(() => {
            const row = new Row(numColumns);
            for (let c = 0; c < numColumns; c++) row[c] = false;
            return row;
        });
        const rightMatrix = [...Array(numColumns)].map(() => {
            const col = new Col(numRows);
            for (let r = 0; r < numRows; r++) col[r] = false;
            return col;
        });

        // NW: suppress down at j=0, right at i=0
        for (let j = 0; j < nw.numRows; j++) {
            for (let i = 0; i < nw.numColumns; i++) {
                const r = originRow - j;
                const c = originCol - i;
                downMatrix[r][c] = j === 0 ? false : nw.downMatrix[j][i];
                rightMatrix[c][r] = i === 0 ? false : nw.rightMatrix[i][j];
            }
        }
        // NE: suppress down at j=0
        for (let j = 0; j < ne.numRows; j++) {
            for (let i = 0; i < ne.numColumns; i++) {
                const r = originRow - j;
                const c = originCol + i;
                downMatrix[r][c] = j === 0 ? false : ne.downMatrix[j][i];
                rightMatrix[c][r] = ne.rightMatrix[i][j];
            }
        }
        // SW: suppress right at i=0
        for (let j = 0; j < sw.numRows; j++) {
            for (let i = 0; i < sw.numColumns; i++) {
                const r = originRow + j;
                const c = originCol - i;
                downMatrix[r][c] = sw.downMatrix[j][i];
                rightMatrix[c][r] = i === 0 ? false : sw.rightMatrix[i][j];
            }
        }
        // SE owns both axes (written last)
        for (let j = 0; j < se.numRows; j++) {
            for (let i = 0; i < se.numColumns; i++) {
                const r = originRow + j;
                const c = originCol + i;
                downMatrix[r][c] = se.downMatrix[j][i];
                rightMatrix[c][r] = se.rightMatrix[i][j];
            }
        }

        return {
            downMatrix,
            rightMatrix,
            originRow,
            originCol,
            hInitCol,
            vInitRow,
            northExtent,
            southExtent,
            westExtent,
            eastExtent,
            colPriority,
            rowPriority,
        };
    }

    debugAssemblySummary() {
        const { originRow, originCol } = this.assemble();
        return {
            totalRows: this.northExtent + this.southExtent - 1,
            totalCols: this.westExtent + this.eastExtent - 1,
            originRow,
            originCol,
        };
    }
}
