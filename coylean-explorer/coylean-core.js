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
 * Default ceiling for the priority sequence. Clamping at 20 keeps the
 * 0 → "infinite priority" axis cell distinguishable from any practical
 * map's interior priorities (2^20 cells is well past anything we render),
 * while still making the priority sequence periodic when callers shrink
 * the ceiling explicitly.
 */
export const DEFAULT_MAX_PRI = 20;

/**
 * Evenness (2-adic valuation) of n.
 * Counts trailing zeros in binary representation.
 * 0 has infinite evenness (returns DEFAULT_MAX_PRI by default).
 * evenness(n) == oddness(n - 1)
 *
 * Optional `maxPri` clamps the result, producing a periodic priority
 * sequence of length 2^maxPri (so a smaller ceiling shortens the
 * propagation period).
 *
 * Implemented via `n & -n` (isolate lowest set bit) + Math.clz32.
 * Hard limitation: only valid for n in [0, 2^32) and maxPri ≤ 31.
 * For arbitrary-precision n use priLoop() instead.
 */
export function pri(n, maxPri = DEFAULT_MAX_PRI) {
    if (n === 0) return maxPri;
    return Math.min(31 - Math.clz32(n & -n), maxPri);
}

/**
 * Museum exhibit: the original loop-based pri(). Same semantics as pri()
 * but works for any non-negative Number (no 32-bit ceiling). Kept exported
 * for (a) the equivalence bench in test-pri.mjs, and (b) callers that need
 * to push n past 2^32. Don't use on hot paths — the bitwise pri() is 10×+
 * faster post-V8-warmup in every realistic input distribution.
 */
export function priLoop(n, maxPri = DEFAULT_MAX_PRI) {
    let p = 0;
    if (n === 0) return maxPri;
    while (n % 2 === 0) {
        p++;
        n = Math.floor(n / 2);
    }
    return Math.min(p, maxPri);
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

// The reaction is a GF(2) transvection. Once `downWins` is fixed, the table
// below is exactly (⊕ = XOR, no constant term):
//
//   downWins:   down_out = down_in;            right_out = right_in ⊕ down_in
//   !downWins:  right_out = right_in;          down_out  = down_in ⊕ right_in
//
// (Check: it agrees on all four input pairs, including (0,0) → (0,0).) So each
// cell applies a linear shear to (down, right) over GF(2), and the whole
// Propagation is a LINEAR function of its boundary seed, parameterised only by
// the boolean field downWins[j][i] = [colPriority_i ≥ rowPriority_j]. This is
// what makes the priority-ceiling period law tractable — see
// meta/big-map/period-analysis.md (the propagation is also bijective because
// each transvection is its own inverse).
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
 * Priority is evaluated per axis from shifted local coordinates; each axis
 * has its own offset and ceiling (the ceilings couple — see below):
 *
 *   longitude (E–W):  colPriority[i] = pri(i + hInitCol, maxLongPri)
 *   latitude  (N–S):  rowPriority[j] = pri(j + vInitRow, maxLatPri)
 *
 * Two knobs per axis:
 *
 *   - OFFSET — hInitCol (longitude) and vInitRow (latitude) slide the
 *     priority lattice relative to the geometric propagation origin. The
 *     origin is fixed; only where the high-priority gridlines fall moves.
 *     The standard clean map uses hInitCol = vInitRow = 1.
 *
 *   - CEILING — maxLongPri (longitude) and maxLatPri (latitude) are
 *     OPTIONAL per-axis caps on that axis's 2-adic valuation. Each defaults
 *     to maxPri, so setting only maxPri (default or explicit) leaves both
 *     axes on the same ceiling and the propagation runs exactly as before.
 *     Supplying one cap overrides only that axis; the other keeps maxPri
 *     (whether maxPri is the default or set).
 *
 *     A cap c makes that axis's PRIORITY SEQUENCE periodic with period 2^c
 *     (min(valuation, c) repeats every 2^c). The resulting ARROW MAP tiles
 *     with a LARGER period, and the two axes are COUPLED: a priority above
 *     the other axis's ceiling can never win, so the larger ceiling is
 *     effectively clamped to the smaller and capping one axis tiles the
 *     whole map. With m = min(maxLatPri, maxLongPri) the binding cap, the
 *     map period is ~2^(m+2) cells per axis (m ≥ 2; empirical). Seniority
 *     breaks the symmetry: the tie-WINNING axis's period doubles to 2^(m+3)
 *     when the strictly smaller cap sits on the tie-LOSING axis (under the
 *     H↔V backslash dual a 2×1 tile on one becomes 1×2 on the other). The
 *     uncapped map (maxPri ≈ ∞) is aperiodic. Full table + the runnable
 *     measurement: meta/big-map/period-analysis.md.
 *
 * The propagation origin is geometric and independent of the priority
 * lattice. These per-axis ceilings are a Propagation-level feature: the
 * standalone reaction() / verticalWinsPriority() helpers evaluate pri() at
 * the default ceiling and do not take per-axis caps.
 *
 * A Propagation is a local object: it does not know about other quadrants.
 * Multiple Propagations are combined by the Universe assembly process
 * into a single global raster.
 *
 * @class Propagation
 *
 * @param {Object} options
 * @param {"nw"|"ne"|"sw"|"se"} [options.direction]
 *   Directional identity of this propagation. Optional; only consulted by
 *   the isNorth/isSouth/isEast/isWest accessors.
 * @param {number} [options.numRows]
 *   Number of rows in the local grid. Required unless initRight is given
 *   (in which case numRows = initRight.length).
 * @param {number} [options.numColumns]
 *   Number of columns in the local grid. Required unless initDown is given
 *   (in which case numColumns = initDown.length).
 * @param {number} options.hInitCol
 *   Horizontal offset applied to column indices when computing priority.
 * @param {number} options.vInitRow
 *   Vertical offset applied to row indices when computing priority.
 * @param {Seniority} [options.seniority]
 *   Tie-breaking rule for priority comparisons. Defaults to vertical.
 * @param {number} [options.maxPri]
 *   Default ceiling for both axes; the per-axis maxLatPri / maxLongPri each
 *   fall back to this when omitted. maxPri ≈ ∞ (the default) gives the normal
 *   aperiodic fractal map; lowering it tiles the map — see maxLatPri /
 *   maxLongPri for the period. Defaults to {@link DEFAULT_MAX_PRI}.
 * @param {number} [options.maxLatPri]
 *   Optional cap for the latitude (N–S) priority sequence,
 *   rowPriority[j] = pri(j + vInitRow, maxLatPri); the sequence then repeats
 *   every 2^maxLatPri rows. The MAP period is larger and coupled to the other
 *   axis: ~2^(m+2) cells, m = min(maxLatPri, maxLongPri) (see the CEILING
 *   note above). Omit it and latitude uses maxPri (default or set), unchanged
 *   from the original behaviour. See meta/big-map/period-analysis.md.
 * @param {number} [options.maxLongPri]
 *   Optional cap for the longitude (E–W) priority sequence,
 *   colPriority[i] = pri(i + hInitCol, maxLongPri); the sequence then repeats
 *   every 2^maxLongPri columns. The MAP period is larger and coupled to the
 *   other axis: ~2^(m+2) cells, m = min(maxLatPri, maxLongPri) (see the
 *   CEILING note above). Omit it and longitude uses maxPri (default or set),
 *   unchanged from the original behaviour. See meta/big-map/period-analysis.md.
 * @param {boolean[]} [options.initDown]
 *   Top-row down inputs (length = numColumns). Defaults to all-true.
 * @param {boolean[]} [options.initRight]
 *   Left-column right inputs (length = numRows). Defaults to all-true.
 *
 * @property {"nw"|"ne"|"sw"|"se"} direction
 * @property {number} numRows
 * @property {number} numColumns
 * @property {number} hInitCol
 * @property {number} vInitRow
 * @property {Seniority} seniority
 * @property {number} maxPri
 * @property {number} maxLatPri
 * @property {number} maxLongPri
 * @property {Row[]} downMatrix
 * @property {Col[]} rightMatrix
 * @property {number[]} colPriority  Precomputed pri(i + hInitCol) per column.
 * @property {number[]} rowPriority  Precomputed pri(j + vInitRow) per row.
 *
 * @readonly @property {boolean[]} initDown    First row of downMatrix.
 * @readonly @property {boolean[]} initRight   First column of rightMatrix.
 * @readonly @property {boolean[]} resultDown  Last row of downMatrix; the
 *   trailing slice that can seed initDown of a continuing propagation.
 * @readonly @property {boolean[]} resultRight Last column of rightMatrix;
 *   the trailing slice that can seed initRight of a continuing propagation.
 * @readonly @property {boolean} isNorth
 * @readonly @property {boolean} isSouth
 * @readonly @property {boolean} isEast
 * @readonly @property {boolean} isWest
 */
export class Propagation {
    // Convention:
    // downMatrix[j][i]  → vertical flow
    // rightMatrix[i][j] → horizontal flow
    constructor({
        direction,
        numRows,
        numColumns,
        hInitCol,
        vInitRow,
        seniority = Seniority.vertical(),
        maxPri = DEFAULT_MAX_PRI,
        maxLatPri = maxPri,
        maxLongPri = maxPri,
        initDown,
        initRight,
    }) {
        if (initDown === undefined)
            initDown = new Row(numColumns).fill(true);
        if (initRight === undefined)
            initRight = new Col(numRows).fill(true);
        if (numColumns === undefined) numColumns = initDown.length;
        if (numRows === undefined) numRows = initRight.length;

        this.direction = direction;
        this.numRows = numRows;
        this.numColumns = numColumns;
        this.hInitCol = hInitCol;
        this.vInitRow = vInitRow;
        this.seniority = seniority;
        this.maxPri = maxPri;
        this.maxLatPri = maxLatPri;
        this.maxLongPri = maxLongPri;
        // longitude (E–W) priority varies across columns via hInitCol;
        // latitude (N–S) priority varies down rows via vInitRow. Each axis
        // takes its own ceiling so one can cycle while the other runs on.
        this.colPriority = [...Array(numColumns)].map((_, i) =>
            pri(i + hInitCol, maxLongPri),
        );
        this.rowPriority = [...Array(numRows)].map((_, j) =>
            pri(j + vInitRow, maxLatPri),
        );

        const downMatrix = createDownMatrix(numRows);
        const rightMatrix = createRightMatrix(numColumns);
        for (let i = 0; i < numColumns; i++) downMatrix[0][i] = initDown[i];
        for (let j = 0; j < numRows; j++) rightMatrix[0][j] = initRight[j];

        for (let j = 0; j < numRows; j++) {
            for (let i = 0; i < numColumns; i++) {
                [downMatrix[j + 1][i], rightMatrix[i + 1][j]] =
                    reactionFromPriority(
                        downMatrix[j][i],
                        rightMatrix[i][j],
                        this.colPriority[i],
                        this.rowPriority[j],
                        seniority,
                    );
            }
        }
        this.downMatrix = downMatrix;
        this.rightMatrix = rightMatrix;
    }

    get initDown() {
        return this.downMatrix[0];
    }

    get initRight() {
        return this.rightMatrix[0];
    }

    get resultDown() {
        return this.downMatrix[this.numRows];
    }

    get resultRight() {
        return this.rightMatrix[this.numColumns];
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

    /**
     * Build a new Propagation from the outer boundary of an existing universe.
     *
     * Stitches the universe's far-N row (W → E) and far-W column (N → S),
     * then runs them as the top/left seed of a fresh SE-flowing
     * propagation. The result spans the whole universe rectangle.
     *
     * Sparse universes (some quadrants null after zero-extent
     * suppression) are supported. If neither north quadrant exists,
     * the universe's "far-N row" collapses to the origin row, which
     * we read from the south quadrants' initDown instead of nw/ne's
     * resultDown. The W-column stitching is the symmetric story.
     *
     * Priority offsets extend the universe's lattice from origin
     * westward and northward:
     *
     *   hInitCol  = hInitCol_user - westExtent
     *   vInitRow  = vInitRow_user - northExtent
     *
     * The user's hInitCol / vInitRow are recovered from any surviving
     * quadrant via the createUniverseExtents inversion (eastern
     * quadrants store hInitCol_user directly; western ones store
     * 1 - hInitCol_user — same shape vertically).
     *
     * Pure boundary extraction — no quadrant stitching or mosaic
     * assembly. The returned Propagation carries
     * metadata.source = "universe-boundary".
     *
     * @param {Object} universe  bundle exposing { nw, ne, sw, se }
     *                           with each quadrant either a Propagation
     *                           or null (missing). At least one non-null
     *                           quadrant is required.
     * @param {Object} [opts]  Per-axis priority-ceiling overrides for the
     *   rebuilt propagation. Each defaults to the surviving quadrant's
     *   value, so by default the boundary round-trips faithfully; set
     *   maxLongPri low to make the integrated map wrap E–W.
     * @param {number} [opts.maxPri]
     * @param {number} [opts.maxLatPri]
     * @param {number} [opts.maxLongPri]
     * @returns {Propagation}
     */
    static fromUniverseBoundary(universe, opts = {}) {
        const { nw, ne, sw, se } = universe;
        const anyQuad = nw || ne || sw || se;
        if (!anyQuad) {
            throw new Error("fromUniverseBoundary: no surviving quadrants");
        }

        const westExtent  = (nw || sw)?.numColumns ?? 0;
        const northExtent = (nw || ne)?.numRows ?? 0;

        // Far-N row, W → E. Prefer N-quadrants' resultDown (true far-N
        // edge); when N is empty, the origin row plays the role of
        // far-N and lives on S-quadrants' initDown instead.
        let initDown;
        if (nw && ne) {
            initDown = Row.from([...[...nw.resultDown].reverse(), ...ne.resultDown]);
        } else if (nw) {
            initDown = Row.from([...nw.resultDown].reverse());
        } else if (ne) {
            initDown = Row.from([...ne.resultDown]);
        } else if (sw && se) {
            initDown = Row.from([...[...sw.initDown].reverse(), ...se.initDown]);
        } else if (sw) {
            initDown = Row.from([...sw.initDown].reverse());
        } else {
            initDown = Row.from([...se.initDown]);
        }

        // Far-W column, N → S. Symmetric: W-quadrants' resultRight, or
        // E-quadrants' initRight as the origin-column fallback.
        let initRight;
        if (nw && sw) {
            initRight = Col.from([...[...nw.resultRight].reverse(), ...sw.resultRight]);
        } else if (nw) {
            initRight = Col.from([...nw.resultRight].reverse());
        } else if (sw) {
            initRight = Col.from([...sw.resultRight]);
        } else if (ne && se) {
            initRight = Col.from([...[...ne.initRight].reverse(), ...se.initRight]);
        } else if (ne) {
            initRight = Col.from([...ne.initRight].reverse());
        } else {
            initRight = Col.from([...se.initRight]);
        }

        // Recover hInitCol_user / vInitRow_user. Eastern quadrants
        // (ne, se) store it directly; western quadrants store its
        // 1's-complement. Symmetric for v on south vs. north.
        const hInitColUser = (se || ne)
            ? (se || ne).hInitCol
            : 1 - (sw || nw).hInitCol;
        const vInitRowUser = (se || sw)
            ? (se || sw).vInitRow
            : 1 - (ne || nw).vInitRow;

        const hInitCol = hInitColUser - westExtent;
        const vInitRow = vInitRowUser - northExtent;

        const propagation = new Propagation({
            hInitCol,
            vInitRow,
            seniority: anyQuad.seniority,
            maxPri: opts.maxPri ?? anyQuad.maxPri,
            maxLatPri: opts.maxLatPri ?? anyQuad.maxLatPri,
            maxLongPri: opts.maxLongPri ?? anyQuad.maxLongPri,
            initDown,
            initRight,
        });
        propagation.metadata = { source: "universe-boundary" };
        return propagation;
    }
}
/**
 * Assembly-level abstraction: a composed Coylean universe assembled from
 * four directional propagations. Where Propagation models a single quadrant,
 * Universe owns the stitching, origin geometry, and global raster output
 * that renderers consume.
 *
 * ⚠️ BREADCRUMB (2026-05-24): the assembled mosaic raster — `assemble()` and
 * the resulting `universe.downMatrix` / `rightMatrix` — is BROKEN; do not
 * consume it and do not try to "assemble the universes." The working path to a
 * single coherent map from a Universe is `Propagation.fromUniverseBoundary`,
 * which reads only the four quadrants' boundary slices and re-propagates. See
 * glyphs/glyphs.js (drawCoyleanMap) for the canonical usage.
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
        maxPri = DEFAULT_MAX_PRI,
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
            maxPri,
            nw,
            ne,
            sw,
            se,
        );
    }

    /**
     * Build a symmetric Universe by computing four quadrant propagations.
     *
     * The four quadrants share the given numRows × numColumns extent, with
     * priority offsets mirrored about the origin:
     *
     *       NW (1 - hInitCol, 1 - vInitRow) │ NE (hInitCol, 1 - vInitRow)
     *       ────────────────────────────────┼────────────────────────────
     *       SW (1 - hInitCol, vInitRow)     │ SE (hInitCol, vInitRow)
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
        { maxPri = DEFAULT_MAX_PRI } = {},
    ) {
        const quadrant = (direction, h, v) =>
            new Propagation({
                direction,
                numRows,
                numColumns,
                hInitCol: h,
                vInitRow: v,
                seniority,
                maxPri,
            });
        return new Universe(
            numRows,
            numRows,
            numColumns,
            numColumns,
            hInitCol,
            vInitRow,
            seniority,
            maxPri,
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
     * Empty-side endpoints suppress the quadrants on that side: minRow=1
     * gives northExtent=0 (NW/NE absent), maxRow=-1 gives southExtent=0
     * (SW/SE absent), and the col equivalents zero out W/E. Missing
     * quadrants are returned as null. Throws if the result has no
     * quadrants at all.
     *
     * @param {[number, number]} rowRange  [minRow, maxRow] with minRow ≤ 1, maxRow ≥ -1
     * @param {[number, number]} colRange  [minCol, maxCol] with minCol ≤ 1, maxCol ≥ -1
     * @param {number} [hInitCol]
     * @param {number} [vInitRow]
     * @param {Seniority} [seniority]
     * @param {Object} [initArrays] Optional shared central-axis init arrays.
     *   Each is fed to the two quadrants that touch that side (so editing
     *   one entry is visible in both). Length must match the corresponding
     *   extent. Omitted sides default to all-true.
     * @param {boolean[]} [initArrays.westInitDown]   length westExtent
     * @param {boolean[]} [initArrays.eastInitDown]   length eastExtent
     * @param {boolean[]} [initArrays.northInitRight] length northExtent
     * @param {boolean[]} [initArrays.southInitRight] length southExtent
     * @returns {{ nw: Propagation|null, ne: Propagation|null, sw: Propagation|null, se: Propagation|null }}
     */
    static createUniverseQuadrants(
        rowRange,
        colRange,
        hInitCol = 1,
        vInitRow = 1,
        seniority = Seniority.vertical(),
        initArrays = {},
        { maxPri = DEFAULT_MAX_PRI } = {},
    ) {
        const [minRow, maxRow] = rowRange;
        const [minCol, maxCol] = colRange;
        // Empty-side ranges: minRow=1 (no north), maxRow=-1 (no south),
        // and the col equivalents. The 1-minRow / maxRow+1 arithmetic
        // already collapses to 0 for those endpoints.
        const northExtent = 1 - minRow;
        const southExtent = maxRow + 1;
        const westExtent = 1 - minCol;
        const eastExtent = maxCol + 1;
        return Universe.createUniverseExtents(
            northExtent, southExtent, westExtent, eastExtent,
            hInitCol, vInitRow, seniority, initArrays,
            { maxPri },
        );
    }

    /**
     * Build up to four quadrant propagations with the given extents,
     * returned unstitched. A quadrant exists iff both of its bounding
     * extents are non-zero; absent quadrants come back as null.
     *
     * Shared-edge sizes: nw/sw share westExtent, ne/se share eastExtent,
     * nw/ne share northExtent, sw/se share southExtent. Asymmetric extents
     * yield differently-sized quadrants; zero on a side suppresses both
     * quadrants there.
     *
     * Throws if all extents on either axis are zero (no quadrants).
     *
     * @param {number} northExtent  ≥ 0; 0 suppresses NW and NE
     * @param {number} southExtent  ≥ 0; 0 suppresses SW and SE
     * @param {number} westExtent   ≥ 0; 0 suppresses NW and SW
     * @param {number} eastExtent   ≥ 0; 0 suppresses NE and SE
     * @param {number} [hInitCol]
     * @param {number} [vInitRow]
     * @param {Seniority} [seniority]
     * @param {Object} [initArrays] Optional shared central-axis init arrays;
     *   each forwarded to the two quadrants that touch that side. See
     *   createUniverseQuadrants for the field shape.
     * @returns {{ nw: Propagation|null, ne: Propagation|null, sw: Propagation|null, se: Propagation|null }}
     */
    static createUniverseExtents(
        northExtent,
        southExtent,
        westExtent,
        eastExtent,
        hInitCol = 1,
        vInitRow = 1,
        seniority = Seniority.vertical(),
        initArrays = {},
        { maxPri = DEFAULT_MAX_PRI } = {},
    ) {
        if (northExtent < 0 || southExtent < 0 || westExtent < 0 || eastExtent < 0) {
            throw new Error("Universe extents must be non-negative");
        }
        if (northExtent + southExtent === 0 || westExtent + eastExtent === 0) {
            throw new Error("Universe must contain at least one quadrant");
        }
        const { westInitDown, eastInitDown, northInitRight, southInitRight } = initArrays;
        // A quadrant exists iff both of its bounding extents are non-zero.
        // Missing quadrants are returned as null. initDown/initRight are
        // shared by reference between the two quadrants on each side.
        const quadrant = (direction, numRows, numColumns, h, v, initDown, initRight) =>
            (numRows && numColumns)
                ? new Propagation({
                    direction, numRows, numColumns,
                    hInitCol: h, vInitRow: v, seniority, maxPri,
                    initDown, initRight,
                })
                : null;
        // prettier-ignore
        return {
            nw: quadrant("nw", northExtent, westExtent, 1 - hInitCol, 1 - vInitRow, westInitDown, northInitRight),
            ne: quadrant("ne", northExtent, eastExtent, hInitCol,     1 - vInitRow, eastInitDown, northInitRight),
            sw: quadrant("sw", southExtent, westExtent, 1 - hInitCol, vInitRow,     westInitDown, southInitRight),
            se: quadrant("se", southExtent, eastExtent, hInitCol,     vInitRow,     eastInitDown, southInitRight),
        };
    }
    /**
     * Build a 2-half universe by partitioning a propagation horizontally
     * at row index `i`. The new row `downs` becomes the shared central
     * horizontal axis (eastInitDown), feeding both `ne` (which propagates
     * it northward) and `se` (which propagates it southward). The
     * propagation's own `initRight` is split at `i` into the two halves'
     * outer N/S inits and recovered intact when the universe is
     * re-integrated via `Propagation.fromUniverseBoundary`.
     *
     * Edge cases: `i === 0` yields a 1-quadrant universe with only `se`;
     * `i === numRows` yields one with only `ne`. Both are valid degenerate
     * partitions.
     *
     * Geometry is preserved in place: the integrated propagation produced
     * by `Propagation.fromUniverseBoundary` has the same `hInitCol` and
     * `vInitRow` as the input (a partition replaces an interior row, it
     * does not extend the propagation beyond its existing extent).
     *
     * @param {Propagation} propagation
     * @param {boolean[]}   downs        new value for `dMatrix[i]` — length numColumns
     * @param {number}      i            row index in [0, propagation.numRows]
     * @returns {Universe}
     */
    static hPartition(propagation, downs, i) {
        const { numRows, numColumns, hInitCol, vInitRow, seniority, maxPri, initRight } = propagation;
        if (i < 0 || i > numRows) {
            throw new Error(`hPartition: i=${i} out of range [0, ${numRows}]`);
        }
        if (downs.length !== numColumns) {
            throw new Error(
                `hPartition: downs.length=${downs.length} must equal numColumns=${numColumns}`,
            );
        }
        const northExtent = i;
        const southExtent = numRows - i;
        const westExtent = 0;
        const eastExtent = numColumns;

        // Shared central horizontal axis going E from origin: the perturbed row.
        const eastInitDown = Row.from([...downs]);
        // Original initRight is N→S. ne stores its initRight S→N (local j=0 at
        // origin), so reverse the top slice. se's bottom slice is already N→S.
        const northInitRight = Col.from([...initRight.slice(0, i)].reverse());
        const southInitRight = Col.from([...initRight.slice(i)]);

        // Pre-compensate the v offset so fromUniverseBoundary recovers the
        // original vInitRow exactly: it subtracts northExtent on the way out.
        // Partition replaces an interior row in place — geometry is preserved.
        const vInitRowPassed = vInitRow + northExtent;

        const { nw, ne, sw, se } = Universe.createUniverseExtents(
            northExtent, southExtent, westExtent, eastExtent,
            hInitCol, vInitRowPassed, seniority,
            { eastInitDown, northInitRight, southInitRight },
            { maxPri },
        );
        return Universe.fromPropagations({
            northExtent, southExtent, westExtent, eastExtent,
            hInitCol, vInitRow: vInitRowPassed, seniority, maxPri,
            nw, ne, sw, se,
        });
    }

    /**
     * Build a 2-half universe by partitioning a propagation vertically
     * at column index `j`. The new column `rights` becomes the shared
     * central vertical axis (southInitRight), feeding both `sw` (which
     * propagates it westward) and `se` (which propagates it eastward).
     * The propagation's own `initDown` is split at `j` into the two
     * halves' outer W/E inits and recovered intact on re-integration.
     *
     * Edge cases: `j === 0` yields a 1-quadrant universe with only `se`;
     * `j === numColumns` yields one with only `sw`.
     *
     * Geometry is preserved in place: the integrated propagation has the
     * same `hInitCol` and `vInitRow` as the input (see `hPartition`).
     *
     * @param {Propagation} propagation
     * @param {boolean[]}   rights      new value for `rMatrix[j]` — length numRows
     * @param {number}      j           column index in [0, propagation.numColumns]
     * @returns {Universe}
     */
    static vPartition(propagation, rights, j) {
        const { numRows, numColumns, hInitCol, vInitRow, seniority, maxPri, initDown } = propagation;
        if (j < 0 || j > numColumns) {
            throw new Error(`vPartition: j=${j} out of range [0, ${numColumns}]`);
        }
        if (rights.length !== numRows) {
            throw new Error(
                `vPartition: rights.length=${rights.length} must equal numRows=${numRows}`,
            );
        }
        const northExtent = 0;
        const southExtent = numRows;
        const westExtent = j;
        const eastExtent = numColumns - j;

        // Shared central vertical axis going S from origin: the perturbed column.
        const southInitRight = Col.from([...rights]);
        // Original initDown is W→E. sw stores its initDown E→W (local i=0 at
        // origin), so reverse the left slice. se's right slice is already W→E.
        const westInitDown = Row.from([...initDown.slice(0, j)].reverse());
        const eastInitDown = Row.from([...initDown.slice(j)]);

        // Pre-compensate the h offset so fromUniverseBoundary recovers the
        // original hInitCol exactly: it subtracts westExtent on the way out.
        const hInitColPassed = hInitCol + westExtent;

        const { nw, ne, sw, se } = Universe.createUniverseExtents(
            northExtent, southExtent, westExtent, eastExtent,
            hInitColPassed, vInitRow, seniority,
            { westInitDown, eastInitDown, southInitRight },
            { maxPri },
        );
        return Universe.fromPropagations({
            northExtent, southExtent, westExtent, eastExtent,
            hInitCol: hInitColPassed, vInitRow, seniority, maxPri,
            nw, ne, sw, se,
        });
    }

    /**
     * Factory for a Universe with its four quadrant propagations.
     *
     * ⚠️ Builds the quadrants, then runs the BROKEN assemble() and attaches
     * its global raster (downMatrix, rightMatrix, originRow, originCol,
     * colPriority, rowPriority) onto the instance. That attached mosaic is
     * WRONG — do not consume `universe.downMatrix` / `rightMatrix` (see the
     * assemble() warning below). The only safe consumer of this object is
     * `Propagation.fromUniverseBoundary`, which reads just the quadrants and
     * ignores the mosaic — that path is safe but still pays for the wasted
     * assemble(). To skip assemble() entirely, build the four quadrant
     * Propagations directly (NW 1-hInitCol,1-vInitRow · NE hInitCol,1-vInitRow
     * · SW 1-hInitCol,vInitRow · SE hInitCol,vInitRow) and hand the
     * { nw, ne, sw, se } bundle straight to fromUniverseBoundary.
     *
     * @param {Object} options
     * @param {number} options.northExtent
     * @param {number} options.southExtent
     * @param {number} options.westExtent
     * @param {number} options.eastExtent
     * @param {number} options.hInitCol
     * @param {number} options.vInitRow
     * @param {Seniority} [options.seniority]
     * @param {number} [options.maxPri]      default ceiling for both axes
     * @param {number} [options.maxLatPri]   N–S ceiling; defaults to maxPri
     * @param {number} [options.maxLongPri]  E–W ceiling; defaults to maxPri.
     *   Lower it so the quadrant seeds (and thus the integrated map) wrap E–W.
     * @param {boolean[]} [options.westInitDown]   length westExtent  — shared by NW & SW
     * @param {boolean[]} [options.eastInitDown]   length eastExtent  — shared by NE & SE
     * @param {boolean[]} [options.northInitRight] length northExtent — shared by NW & NE
     * @param {boolean[]} [options.southInitRight] length southExtent — shared by SW & SE
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
        maxPri = DEFAULT_MAX_PRI,
        maxLatPri = maxPri,
        maxLongPri = maxPri,
        westInitDown,
        eastInitDown,
        northInitRight,
        southInitRight,
    }) {
        const quadrant = (direction, numRows, numColumns, h, v, initDown, initRight) =>
            new Propagation({
                direction,
                numRows,
                numColumns,
                hInitCol: h,
                vInitRow: v,
                seniority,
                maxPri,
                maxLatPri,
                maxLongPri,
                initDown,
                initRight,
            });
        const universe = new Universe(
            northExtent,
            southExtent,
            westExtent,
            eastExtent,
            hInitCol,
            vInitRow,
            seniority,
            maxPri,
            quadrant("nw", northExtent, westExtent, 1 - hInitCol, 1 - vInitRow, westInitDown, northInitRight),
            quadrant("ne", northExtent, eastExtent, hInitCol,     1 - vInitRow, eastInitDown, northInitRight),
            quadrant("sw", southExtent, westExtent, 1 - hInitCol, vInitRow,     westInitDown, southInitRight),
            quadrant("se", southExtent, eastExtent, hInitCol,     vInitRow,     eastInitDown, southInitRight),
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
        maxPri,
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
        this.maxPri = maxPri ?? DEFAULT_MAX_PRI;
        this.nw = nw;
        this.ne = ne;
        this.sw = sw;
        this.se = se;
    }

    // ⚠️ BROKEN — do not use (2026-05-24). The stitched mosaic this produces is
    // wrong; renderers must not consume universe.downMatrix/rightMatrix. For a
    // coherent map from a Universe use Propagation.fromUniverseBoundary instead.
    // Kept only because Universe.create still calls it (its output is ignored on
    // the fromUniverseBoundary path).
    assemble() {
        const {
            northExtent,
            southExtent,
            westExtent,
            eastExtent,
            hInitCol,
            vInitRow,
            maxPri,
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
            pri(i - originCol + hInitCol, maxPri),
        );
        const rowPriority = [...Array(numRows)].map((_, j) =>
            pri(j - originRow + vInitRow, maxPri),
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
