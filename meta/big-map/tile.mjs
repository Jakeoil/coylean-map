// Rebuild a single K x K tile from a scaffold.
// (k1, k2) selects the block at global row k1*K, column k2*K. The scaffold
// is auto-extended to cover the requested block, so any (k1, k2) >= 0 is
// valid — panning past the current extent just grows the universe out.

import { Propagation } from "../../coylean-explorer/coylean-core.js";
import { extendScaffold } from "./scaffold.mjs";

export function tile(scaffold, k1, k2) {
    if (!Number.isInteger(k1) || !Number.isInteger(k2) || k1 < 0 || k2 < 0) {
        throw new Error(
            `tile (k1=${k1}, k2=${k2}) must be non-negative integers`,
        );
    }
    extendScaffold(scaffold, Math.max(k1, k2) + 1);
    const {
        K,
        hInitCol0,
        vInitRow0,
        seniority,
        maxPri,
        hSeams,
        vSeams,
    } = scaffold;
    const r = k1 * K;
    const c = k2 * K;
    return new Propagation({
        numRows: K,
        numColumns: K,
        hInitCol: hInitCol0 + c,
        vInitRow: vInitRow0 + r,
        seniority,
        maxPri,
        initDown: hSeams[k1].slice(c, c + K),
        initRight: vSeams[k2].slice(r, r + K),
    });
}
