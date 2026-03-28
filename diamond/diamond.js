// ═══════════════════════════════════════════════
//  Coylean Diamond View
//  Same algorithm as coylean.js, rendered at 45°.
//  Vertical segments → "/" diagonals
//  Horizontal segments → "\" diagonals
// ═══════════════════════════════════════════════

function computeMaxPri(ds, rs) {
    if (ds < rs) ds = rs;
    for (let i = 0; i < 32; i++) {
        if (ds < 1) return i;
        ds = Math.floor(ds / 2);
    }
    return 32;
}

function priority(i, maxPri) {
    for (let j = 0; j < maxPri; j++) {
        if (i % 2 !== 0) return j;
        i = Math.floor(i / 2);
    }
    return maxPri;
}

// Draw the Coylean square of order n (N = 2^n lines per axis)
// onto canvasEl using cell-size px and margin px border.
//
// Coordinate mapping — grid point (col, row) → display:
//   x_disp = margin + (col - row + N) * cell
//   y_disp = margin + (col + row) * cell
//
// "down" segment at cell (x,y) → "/" from (x+1,y)→(x+1,y+1)
// "right" segment at cell (x,y) → "\" from (x,y+1)→(x+1,y+1)
function drawDiamond(canvasEl, N, cell, margin) {
    const M = N + 1;                          // one extra row+col to complete the square
    const maxPri = computeMaxPri(M, M);
    const size = margin * 2 + M * 2 * cell;
    canvasEl.width = canvasEl.height = size;

    const ctx = canvasEl.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);

    function px(col, row) { return margin + (col - row + M) * cell; }
    function py(col, row) { return margin + (col + row) * cell; }

    // Boundary outline
    ctx.strokeStyle = "#bbb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px(0, 0), py(0, 0));
    ctx.lineTo(px(M, 0), py(M, 0));
    ctx.lineTo(px(M, M), py(M, M));
    ctx.lineTo(px(0, M), py(0, M));
    ctx.closePath();
    ctx.stroke();

    // Coylean algorithm — same init as coylean.js: d[0]=true, rest false
    const d = new Array(M).fill(false);
    const r = new Array(M).fill(false);
    d[0] = true;

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let y = 0; y < M; y++) {
        const rp = priority(y, maxPri);
        for (let x = 0; x < M; x++) {
            const preD = d[x];
            const preR = r[y];
            const dp = priority(x, maxPri);

            // XOR update (vertical wins ties, same as coylean.js)
            if (dp >= rp) {
                if (preD) r[y] = !r[y];
            } else {
                if (preR) d[x] = !d[x];
            }

            // Draw using pre-XOR values
            if (preD) {
                // "/" segment: right edge of cell (x,y)
                ctx.moveTo(px(x + 1, y),     py(x + 1, y));
                ctx.lineTo(px(x + 1, y + 1), py(x + 1, y + 1));
            }
            if (preR) {
                // "\" segment: bottom edge of cell (x,y)
                ctx.moveTo(px(x,     y + 1), py(x,     y + 1));
                ctx.lineTo(px(x + 1, y + 1), py(x + 1, y + 1));
            }
        }
    }
    ctx.stroke();
}

// ── Render all orders ──
const ORDERS = [
    { n: 1, N:  2, cell: 40, margin: 20 },
    { n: 2, N:  4, cell: 24, margin: 20 },
    { n: 3, N:  8, cell: 14, margin: 20 },
    { n: 4, N: 16, cell:  8, margin: 20 },
];

for (const { n, N, cell, margin } of ORDERS) {
    const c = document.getElementById("diamond-" + n);
    if (c) drawDiamond(c, N, cell, margin);
}
