// Build one construct of the requested size and print a JSON result.
// Run in a subprocess so OOM is recoverable and peak RSS is measurable.
//
// Modes:
//   prop          → single Propagation, numRows = numColumns = N
//   universe-prop → Universe.createSymmetric(N,N) → Propagation.fromUniverseBoundary
//                   (the final propagation is ~2N x 2N)

import {
    Propagation,
    Universe,
} from "../../coylean-explorer/coylean-core.js";

const mode = process.argv[2];
const size = Number(process.argv[3]);

if (!mode || !Number.isFinite(size) || size < 1) {
    console.error("usage: node worker.mjs <prop|universe-prop> <size>");
    process.exit(2);
}

function memMb() {
    const m = process.memoryUsage();
    return {
        rss: +(m.rss / 1024 / 1024).toFixed(1),
        heap: +(m.heapUsed / 1024 / 1024).toFixed(1),
    };
}

const result = { mode, size };
const t0 = performance.now();

if (mode === "prop") {
    const p = new Propagation({
        numRows: size,
        numColumns: size,
        hInitCol: 1,
        vInitRow: 1,
    });
    result.build_ms = +(performance.now() - t0).toFixed(1);
    result.final_rows = p.numRows;
    result.final_cols = p.numColumns;
    result.mem_after = memMb();
} else if (mode === "universe-prop") {
    const tU0 = performance.now();
    const universe = Universe.createSymmetric(size, size, 1, 1);
    const universe_ms = +(performance.now() - tU0).toFixed(1);
    result.universe_mem = memMb();

    const tB0 = performance.now();
    const p = Propagation.fromUniverseBoundary(universe);
    const boundary_ms = +(performance.now() - tB0).toFixed(1);

    result.universe_ms = universe_ms;
    result.boundary_ms = boundary_ms;
    result.build_ms = +(performance.now() - t0).toFixed(1);
    result.final_rows = p.numRows;
    result.final_cols = p.numColumns;
    result.mem_after = memMb();
} else {
    console.error(`unknown mode: ${mode}`);
    process.exit(2);
}

console.log(JSON.stringify(result));
