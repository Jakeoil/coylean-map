#!/usr/bin/env node
// Render an 8x8 Coylean map to the terminal with Unicode box-drawing chars.
// Self-contained — see ./how-to-draw.md for the algorithm,
// or ../../coylean-explorer/coylean-core.js for the library version.

const N = 8;

// 2-adic valuation: trailing zero bits.  pri(0) treated as +∞.
function pri(n) {
    if (n === 0) return 100;
    let p = 0;
    while (n % 2 === 0) {
        p++;
        n = Math.floor(n / 2);
    }
    return p;
}

// One cell's reaction. (V in, H in) → (V out, H out). Vertical wins ties.
function reaction(v, h, colP, rowP) {
    if (!v && !h) return [false, false];
    const downWins = colP >= rowP;
    if (v && h) return downWins ? [true, false] : [false, true];
    if (v) return downWins ? [true, true] : [true, false];
    return downWins ? [false, true] : [true, true];
}

// Propagate from all-true top row and left column.
function propagate(numRows, numCols) {
    const colP = Array.from({ length: numCols }, (_, i) => pri(i + 1));
    const rowP = Array.from({ length: numRows }, (_, j) => pri(j + 1));

    const down = Array.from({ length: numRows + 1 }, () => []);
    const right = Array.from({ length: numCols + 1 }, () => []);
    for (let i = 0; i < numCols; i++) down[0][i] = true;
    for (let j = 0; j < numRows; j++) right[0][j] = true;

    for (let j = 0; j < numRows; j++) {
        for (let i = 0; i < numCols; i++) {
            const [vOut, hOut] = reaction(
                down[j][i],
                right[i][j],
                colP[i],
                rowP[j],
            );
            down[j + 1][i] = vOut;
            right[i + 1][j] = hOut;
        }
    }
    return { down, right };
}

// 16-entry box-drawing table indexed by (N<<3 | E<<2 | S<<1 | W).
// prettier-ignore
const BOX = [
    " ", "╴", "╷", "┐",
    "╶", "─", "┌", "┬",
    "╵", "┘", "│", "┤",
    "└", "┴", "├", "┼",
];

// Glue chars between adjacent vertices in the same row.
function render(down, right, numRows, numCols) {
    // Edge incidence at vertex (a, b):
    //   N  = right edge of cell (a-1, b-1)  = down[b-1][a-1]
    //   S  = right edge of cell (a-1, b)    = down[b][a-1]
    //   W  = bottom edge of cell (a-1, b-1) = right[a-1][b-1]
    //   E  = bottom edge of cell (a, b-1)   = right[a][b-1]
    // Cells exist only for j ∈ [0, numRows), i ∈ [0, numCols).
    const dm = (j, i) =>
        j >= 0 && j < numRows && i >= 0 && i < numCols ? !!down[j][i] : false;
    const rm = (i, j) =>
        i >= 0 && i < numCols && j >= 0 && j < numRows ? !!right[i][j] : false;

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

const { down, right } = propagate(N, N);
console.log(render(down, right, N, N));
