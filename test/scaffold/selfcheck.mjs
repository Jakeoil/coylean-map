// Verify that every tile reconstructed from the scaffold matches the
// corresponding sub-region of a direct L x L propagation. Reports a few
// timings on the side.
//
// Usage: node selfcheck.mjs [L] [K]   (defaults: L=1024, K=128)

import { Propagation } from "coylean/core";
import { buildScaffold } from "coylean/scaffold/scaffold.mjs";
import { tile } from "coylean/scaffold/tile.mjs";

const L = Number(process.argv[2] ?? 1024);
const K = Number(process.argv[3] ?? 128);
if (L % K !== 0) {
    console.error(`L=${L} must be divisible by K=${K}`);
    process.exit(2);
}
const nBlocks = L / K;

function ms(t) {
    return `${t.toFixed(1)} ms`;
}

const tFull0 = performance.now();
const full = new Propagation({
    numRows: L,
    numColumns: L,
    hInitCol: 1,
    vInitRow: 1,
});
const tFull = performance.now() - tFull0;

const tScaf0 = performance.now();
const scaf = buildScaffold({ L, K });
const tScaf = performance.now() - tScaf0;

const tTile0 = performance.now();
const sample = tile(scaf, Math.floor(nBlocks / 2), Math.floor(nBlocks / 3));
const tTile = performance.now() - tTile0;
void sample;

let mismatches = 0;
const examples = [];
for (let k1 = 0; k1 < nBlocks; k1++) {
    for (let k2 = 0; k2 < nBlocks; k2++) {
        const t = tile(scaf, k1, k2);
        for (let j = 0; j < K; j++) {
            for (let i = 0; i < K; i++) {
                const r = k1 * K + j;
                const c = k2 * K + i;
                if (t.downMatrix[j][i] !== full.downMatrix[r][c]) {
                    if (examples.length < 5) {
                        examples.push(`down  (${r},${c})`);
                    }
                    mismatches++;
                }
                if (t.rightMatrix[i][j] !== full.rightMatrix[c][r]) {
                    if (examples.length < 5) {
                        examples.push(`right (${c},${r})`);
                    }
                    mismatches++;
                }
            }
        }
    }
}

const seamBooleans = 2 * (nBlocks + 1) * L;
const fullCells = 2 * L * L;
const ratio = fullCells / seamBooleans;

console.log(`L=${L}  K=${K}  nBlocks=${nBlocks}x${nBlocks}`);
console.log(`  full propagation build:  ${ms(tFull)}`);
console.log(`  scaffold build:          ${ms(tScaf)}`);
console.log(`  one tile rebuild:        ${ms(tTile)}`);
console.log(
    `  seam booleans: ${seamBooleans.toLocaleString()}` +
        `   (full has ${fullCells.toLocaleString()} arrows;` +
        ` ratio ${ratio.toFixed(1)}x)`,
);
if (mismatches === 0) {
    console.log("PASS — all tiles match the reference propagation.");
} else {
    console.log(`FAIL — ${mismatches} mismatched cells`);
    console.log(`  first examples: ${examples.join(", ")}`);
    process.exit(1);
}
