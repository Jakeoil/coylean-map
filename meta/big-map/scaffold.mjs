// Seam scaffold for a logical SE-quadrant propagation.
// Starts empty (nBlocks=0) and can be grown to any extent on demand.
//
// State after extendScaffold(s, N):
//   nBlocks      = N (square: nBlocksX == nBlocksY == N)
//   hSeams[k1]   = Row of length N*K  — down-arrows entering row k1*K
//   vSeams[k2]   = Col of length N*K  — right-arrows entering col k2*K
// hSeams[0] / vSeams[0] are the all-true N/W universe boundaries.
//
// Working memory: 2 N^2 K booleans (the seams) plus one K x K block
// during propagation. The full N*K square is never materialised.

import {
    Propagation,
    Row,
    Col,
    Seniority,
    DEFAULT_MAX_PRI,
} from "../../coylean-explorer/coylean-core.js";

export function createScaffold({
    K,
    hInitCol0 = 1,
    vInitRow0 = 1,
    seniority = Seniority.vertical(),
    maxPri = DEFAULT_MAX_PRI,
    maxLatPri = maxPri,
    maxLongPri = maxPri,
}) {
    if (!Number.isInteger(K) || K <= 0) {
        throw new Error(`K must be a positive integer (got K=${K})`);
    }
    return {
        K,
        hInitCol0,
        vInitRow0,
        seniority,
        maxPri,
        maxLatPri,
        maxLongPri,
        nBlocks: 0,
        get L() { return this.nBlocks * this.K; },
        hSeams: [new Row()],
        vSeams: [new Col()],
        // builtMask[k1][k2] = true once propagateBlock has run on (k1, k2).
        // Sized to nBlocks × nBlocks; rows are allocated lazily by
        // allocateScaffold / extendScaffold.
        builtMask: [],
    };
}

export function propagateBlock(s, k1, k2) {
    const {
        K, hInitCol0, vInitRow0, seniority, maxPri, maxLatPri, maxLongPri,
        hSeams, vSeams,
    } = s;
    const block = new Propagation({
        numRows: K,
        numColumns: K,
        hInitCol: hInitCol0 + k2 * K,
        vInitRow: vInitRow0 + k1 * K,
        seniority,
        maxPri,
        maxLatPri,
        maxLongPri,
        initDown: hSeams[k1].slice(k2 * K, (k2 + 1) * K),
        initRight: vSeams[k2].slice(k1 * K, (k1 + 1) * K),
    });
    const south = block.resultDown;
    const east = block.resultRight;
    for (let i = 0; i < K; i++) hSeams[k1 + 1][k2 * K + i] = south[i];
    for (let j = 0; j < K; j++) vSeams[k2 + 1][k1 * K + j] = east[j];
    if (s.builtMask[k1]) s.builtMask[k1][k2] = true;
}

export function isBlockBuilt(s, k1, k2) {
    return !!(s.builtMask[k1] && s.builtMask[k1][k2]);
}

// True iff propagateBlock(s, k1, k2) can run now — its two upstream seams
// exist either as a built neighbour's output or as the universe boundary
// (k1 === 0 or k2 === 0).
export function isBlockReady(s, k1, k2) {
    if (k1 < 0 || k2 < 0 || k1 >= s.nBlocks || k2 >= s.nBlocks) return false;
    if (isBlockBuilt(s, k1, k2)) return false;
    const upOK = k1 === 0 || isBlockBuilt(s, k1 - 1, k2);
    const leftOK = k2 === 0 || isBlockBuilt(s, k1, k2 - 1);
    return upOK && leftOK;
}

// Pre-allocate seam arrays and boundary seeds out to newN blocks WITHOUT
// running any block propagation. Use this with propagateBlock() for
// lazy / on-demand block building (rAF priority queue, etc.).
// Idempotent if newN <= s.nBlocks.
export function allocateScaffold(s, newN) {
    if (!Number.isInteger(newN) || newN < 0) {
        throw new Error(`newN must be a non-negative integer (got ${newN})`);
    }
    if (newN <= s.nBlocks) return s;
    const { K, hSeams, vSeams } = s;
    const oldN = s.nBlocks;

    for (let c = oldN * K; c < newN * K; c++) hSeams[0][c] = true;
    for (let r = oldN * K; r < newN * K; r++) vSeams[0][r] = true;

    while (hSeams.length < newN + 1) hSeams.push(new Row(newN * K));
    while (vSeams.length < newN + 1) vSeams.push(new Col(newN * K));

    while (s.builtMask.length < newN) {
        s.builtMask.push(new Array(newN).fill(false));
    }
    for (let k1 = 0; k1 < newN; k1++) {
        const row = s.builtMask[k1];
        while (row.length < newN) row.push(false);
    }

    s.nBlocks = newN;
    return s;
}

// Grow the scaffold square to newN blocks. Idempotent if newN <= nBlocks.
// Iteration order matters: a block's inputs are always seams set by an
// earlier block in the same call (or by the original build).
export function extendScaffold(s, newN) {
    if (!Number.isInteger(newN) || newN < 0) {
        throw new Error(`newN must be a non-negative integer (got ${newN})`);
    }
    if (newN <= s.nBlocks) return s;
    const oldN = s.nBlocks;
    allocateScaffold(s, newN);

    for (let k1 = 0; k1 < oldN; k1++) {
        for (let k2 = oldN; k2 < newN; k2++) propagateBlock(s, k1, k2);
    }
    for (let k1 = oldN; k1 < newN; k1++) {
        for (let k2 = 0; k2 < newN; k2++) propagateBlock(s, k1, k2);
    }

    return s;
}

export function buildScaffold({
    L,
    K,
    hInitCol0,
    vInitRow0,
    seniority,
    maxPri,
}) {
    if (!Number.isInteger(L) || L <= 0) {
        throw new Error(`L must be a positive integer (got L=${L})`);
    }
    if (L % K !== 0) {
        throw new Error(`L=${L} must be divisible by K=${K}`);
    }
    const s = createScaffold({
        K,
        hInitCol0,
        vInitRow0,
        seniority,
        maxPri,
    });
    extendScaffold(s, L / K);
    return s;
}
