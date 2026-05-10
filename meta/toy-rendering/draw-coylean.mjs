#!/usr/bin/env node
// Render an 8x8 Coylean map to the terminal with Unicode box-drawing chars.
// Propagation comes from ../../coylean-explorer/coylean-core.js;
// see ./how-to-draw.md for the algorithm.

import { Propagation } from "../../coylean-explorer/coylean-core.js";

const N = 8;

// 16-entry box-drawing table indexed by (N<<3 | E<<2 | S<<1 | W).
// prettier-ignore
const BOX = [
    " ", "╴", "╷", "┐",
    "╶", "─", "┌", "┬",
    "╵", "┘", "│", "┤",
    "└", "┴", "├", "┼",
];

// Glue chars between adjacent vertices in the same row.
function render(downMatrix, rightMatrix, numRows, numCols) {
    // Edge incidence at vertex (a, b):
    //   N  = right edge of cell (a-1, b-1)  = downMatrix[b-1][a-1]
    //   S  = right edge of cell (a-1, b)    = downMatrix[b][a-1]
    //   W  = bottom edge of cell (a-1, b-1) = rightMatrix[a-1][b-1]
    //   E  = bottom edge of cell (a, b-1)   = rightMatrix[a][b-1]
    // Cells exist only for j ∈ [0, numRows), i ∈ [0, numCols).
    const dm = (j, i) =>
        j >= 0 && j < numRows && i >= 0 && i < numCols
            ? !!downMatrix[j][i]
            : false;
    const rm = (i, j) =>
        i >= 0 && i < numCols && j >= 0 && j < numRows
            ? !!rightMatrix[i][j]
            : false;

    const lines = [];
    for (let b = 0; b <= numRows; b++) {
        let line = "";
        for (let a = 0; a <= numCols; a++) {
            const n = dm(b - 1, a - 1);
            const s = dm(b, a - 1);
            const w = rm(a - 1, b - 1);
            const e = rm(a, b - 1);
            const idx = (n ? 8 : 0) | (e ? 4 : 0) | (s ? 2 : 0) | (w ? 1 : 0);
            line += BOX[idx];
            if (a < numCols) line += e ? "─" : " ";
        }
        lines.push(line);
    }
    return lines.join("\n");
}

const { downMatrix, rightMatrix } = new Propagation({
    numRows: N,
    numColumns: N,
    hInitCol: 1,
    vInitRow: 1,
});
console.log(render(downMatrix, rightMatrix, N, N));
