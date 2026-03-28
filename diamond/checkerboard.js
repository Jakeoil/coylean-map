// ═══════════════════════════════════════════════
//  Checkerboard proof-of-concept
//  Two-color diamond: black = / (senior), red = \ (junior)
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

// Draw borderless filled square behind each segment
function fillSquares(ctx, segments, color, cellSize) {
    ctx.fillStyle = color;
    for (const [x1, y1, x2, y2] of segments) {
        ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), cellSize, cellSize);
    }
}

function drawCheckerboard(canvasEl, N, cell, margin) {
    const M = N + 1;
    const maxPri = computeMaxPri(M, M);
    const size = margin * 2 + M * 2 * cell;
    canvasEl.width = canvasEl.height = size;

    const ctx = canvasEl.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);

    function px(col, row) { return margin + (col - row + M) * cell; }
    function py(col, row) { return margin + (col + row) * cell; }

    // Boundary outline
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px(0, 0), py(0, 0));
    ctx.lineTo(px(M, 0), py(M, 0));
    ctx.lineTo(px(M, M), py(M, M));
    ctx.lineTo(px(0, M), py(0, M));
    ctx.closePath();
    ctx.stroke();

    // Algorithm
    const d = new Array(M).fill(false);
    const r = new Array(M).fill(false);
    d[0] = true;

    const slashes = [];
    const backslashes = [];

    for (let y = 0; y < M; y++) {
        const rp = priority(y, maxPri);
        for (let x = 0; x < M; x++) {
            const preD = d[x];
            const preR = r[y];
            const dp = priority(x, maxPri);

            if (dp >= rp) {
                if (preD) r[y] = !r[y];
            } else {
                if (preR) d[x] = !d[x];
            }

            if (preD) {
                slashes.push([px(x+1, y), py(x+1, y), px(x+1, y+1), py(x+1, y+1)]);
            }
            if (preR) {
                backslashes.push([px(x, y+1), py(x, y+1), px(x+1, y+1), py(x+1, y+1)]);
            }
        }
    }

    // Background squares (drawn first, borderless)
    fillSquares(ctx, slashes, "#e0e0e0", cell);
    fillSquares(ctx, backslashes, "#ffcdd2", cell);

    // / in black (senior)
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of slashes) {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
    }
    ctx.stroke();

    // \ in red (junior)
    ctx.strokeStyle = "#c62828";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of backslashes) {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
    }
    ctx.stroke();
}

// Labeled version: show priority values at grid intersections
function drawLabeled(canvasEl, N, cell, margin) {
    const M = N + 1;
    const maxPri = computeMaxPri(M, M);
    const size = margin * 2 + M * 2 * cell;
    canvasEl.width = canvasEl.height = size;

    const ctx = canvasEl.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);

    function px(col, row) { return margin + (col - row + M) * cell; }
    function py(col, row) { return margin + (col + row) * cell; }

    // Boundary
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px(0, 0), py(0, 0));
    ctx.lineTo(px(M, 0), py(M, 0));
    ctx.lineTo(px(M, M), py(M, M));
    ctx.lineTo(px(0, M), py(0, M));
    ctx.closePath();
    ctx.stroke();

    // Draw faint grid lines to show all possible diagonals
    ctx.strokeStyle = "#eee";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= M; i++) {
        // / diagonals (constant col)
        ctx.beginPath();
        ctx.moveTo(px(i, 0), py(i, 0));
        ctx.lineTo(px(i, M), py(i, M));
        ctx.stroke();
        // \ diagonals (constant row)
        ctx.beginPath();
        ctx.moveTo(px(0, i), py(0, i));
        ctx.lineTo(px(M, i), py(M, i));
        ctx.stroke();
    }

    // Algorithm
    const d = new Array(M).fill(false);
    const r = new Array(M).fill(false);
    d[0] = true;

    const slashes = [];
    const backslashes = [];

    for (let y = 0; y < M; y++) {
        const rp = priority(y, maxPri);
        for (let x = 0; x < M; x++) {
            const preD = d[x];
            const preR = r[y];
            const dp = priority(x, maxPri);

            if (dp >= rp) {
                if (preD) r[y] = !r[y];
            } else {
                if (preR) d[x] = !d[x];
            }

            if (preD) slashes.push([px(x+1, y), py(x+1, y), px(x+1, y+1), py(x+1, y+1)]);
            if (preR) backslashes.push([px(x, y+1), py(x, y+1), px(x+1, y+1), py(x+1, y+1)]);
        }
    }

    // Background squares
    fillSquares(ctx, slashes, "#e0e0e0", cell);
    fillSquares(ctx, backslashes, "#ffcdd2", cell);

    // / in black
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of slashes) {
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    }
    ctx.stroke();

    // \ in red
    ctx.strokeStyle = "#c62828";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of backslashes) {
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    }
    ctx.stroke();

    // Label priority along top-right edge (/ priorities = column indices)
    ctx.fillStyle = "#000";
    ctx.font = Math.max(10, cell * 0.6) + "px Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < M; i++) {
        const p = priority(i, maxPri);
        const label = p === maxPri ? "\u221e" : String(p);
        // Label along top-right edge: grid col i+1, row 0
        // Midpoint of the / diagonal at column i+1 between row 0 and row 1
        const lx = px(i + 0.5, -0.5);
        const ly = py(i + 0.5, -0.5);
        ctx.fillStyle = "#000";
        ctx.fillText(label, lx, ly);
    }

    // Label along top-left edge (\ priorities = row indices)
    for (let i = 0; i < M; i++) {
        const p = priority(i, maxPri);
        const label = p === maxPri ? "\u221e" : String(p);
        const lx = px(-0.5, i + 0.5);
        const ly = py(-0.5, i + 0.5);
        ctx.fillStyle = "#c62828";
        ctx.fillText(label, lx, ly);
    }
}

// Four-quadrant view.
// Each quadrant runs the same algorithm from the same seed (d[0]=true).
// The only difference is the direction of propagation:
//   S: / goes SW, \ goes SE
//   E: / goes NE, \ goes SE  (/ reversed)
//   N: / goes NE, \ goes NW  (both reversed)
//   W: / goes SW, \ goes NW  (\ reversed)
//
// The ∞/ line extends full NE-SW, ∞\ extends full NW-SE through center.
// The seed lines and the ∞ base positions are the only information.
function drawFourQuadrants(canvasEl, N, cell, margin) {
    const M = N + 1;
    const maxPri = computeMaxPri(M, M);

    const size = margin * 2 + 4 * M * cell;
    canvasEl.width = canvasEl.height = size;

    const ctx = canvasEl.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    function px(gc, gr) { return cx + (gc - gr) * cell; }
    function py(gc, gr) { return cy + (gc + gr) * cell; }

    // Run one quadrant (S), collect segments in centered grid coords.
    // / at cell (x,y): centered (x, y-1)→(x, y)
    // \ at cell (x,y): centered (x-1, y)→(x, y)
    const da = new Array(M).fill(false);
    const ra = new Array(M).fill(false);
    da[0] = true;

    const sSlash = [];
    const sBack = [];

    for (let y = 0; y < M; y++) {
        const rp = priority(y, maxPri);
        for (let x = 0; x < M; x++) {
            const preD = da[x];
            const preR = ra[y];
            const dp = priority(x, maxPri);
            if (dp >= rp) { if (preD) ra[y] = !ra[y]; }
            else          { if (preR) da[x] = !da[x]; }
            if (preD) sSlash.push([x, y - 1, x, y]);
            if (preR) sBack.push([x - 1, y, x, y]);
        }
    }

    // Four orientations by sign of (gc, gr):
    // S:(+gc,+gr)  E:(+gc,-gr)  N:(-gc,-gr)  W:(-gc,+gr)
    const allSlash = [];
    const allBack = [];
    for (const [a, b, c, e] of sSlash) {
        allSlash.push([ a,  b,  c,  e]);   // S
        allSlash.push([ a, -b,  c, -e]);   // E
        allSlash.push([-a, -b, -c, -e]);   // N
        allSlash.push([-a,  b, -c,  e]);   // W
    }
    for (const [a, b, c, e] of sBack) {
        allBack.push([ a,  b,  c,  e]);
        allBack.push([ a, -b,  c, -e]);
        allBack.push([-a, -b, -c, -e]);
        allBack.push([-a,  b, -c,  e]);
    }

    // ---- Draw ----
    const ext = M - 0.5;
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px(0, -ext), py(0, -ext));
    ctx.lineTo(px(ext, 0), py(ext, 0));
    ctx.lineTo(px(0, ext), py(0, ext));
    ctx.lineTo(px(-ext, 0), py(-ext, 0));
    ctx.closePath();
    ctx.stroke();

    // Background squares
    function fillGridSquares(segs, color) {
        ctx.fillStyle = color;
        for (const [a, b, c, e] of segs) {
            const x1 = px(a, b), y1 = py(a, b);
            const x2 = px(c, e), y2 = py(c, e);
            ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), cell, cell);
        }
    }
    fillGridSquares(allSlash, "#e0e0e0");
    fillGridSquares(allBack, "#ffcdd2");

    // / segments (black, senior)
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const [a, b, c, e] of allSlash) {
        ctx.moveTo(px(a, b), py(a, b));
        ctx.lineTo(px(c, e), py(c, e));
    }
    ctx.stroke();

    // \ segments (red, junior)
    ctx.strokeStyle = "#c62828";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const [a, b, c, e] of allBack) {
        ctx.moveTo(px(a, b), py(a, b));
        ctx.lineTo(px(c, e), py(c, e));
    }
    ctx.stroke();

    // ∞/ highlight: full NE-SW
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px(0, -(M - 1)), py(0, -(M - 1)));
    ctx.lineTo(px(0, M - 1), py(0, M - 1));
    ctx.stroke();

    // ∞\ highlight: full NW-SE
    ctx.strokeStyle = "rgba(194,40,40,0.25)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px(-(M - 1), 0), py(-(M - 1), 0));
    ctx.lineTo(px(M - 1, 0), py(M - 1, 0));
    ctx.stroke();

    // Quadrant labels
    ctx.font = Math.max(10, cell * 0.7) + "px Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#aaa";
    const off = M * 0.4 * cell;
    ctx.fillText("S", cx, cy + off);
    ctx.fillText("N", cx, cy - off);
    ctx.fillText("E", cx + off, cy);
    ctx.fillText("W", cx - off, cy);
}

// ── Render ──
const c1 = document.getElementById("cb-colored");
if (c1) drawCheckerboard(c1, 4, 28, 20);

const c2 = document.getElementById("cb-labeled");
if (c2) drawLabeled(c2, 4, 28, 30);

const c3 = document.getElementById("cb-order3");
if (c3) drawCheckerboard(c3, 8, 14, 20);

const c4 = document.getElementById("cb-fourquad");
if (c4) drawFourQuadrants(c4, 4, 20, 24);

const c5 = document.getElementById("cb-fourquad3");
if (c5) drawFourQuadrants(c5, 8, 10, 24);
