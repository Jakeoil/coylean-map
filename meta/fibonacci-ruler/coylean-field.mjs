"use strict";

// coylean-field — generic Coylean line-field renderer.
//
// Lifted and factored from meta/planet-coyleus/terrain-render.js (drawQuadrant),
// with the terrain fills / glyph cells / cages removed. Anyone can use it: give
// it a `field` describing a Coylean propagation mapped onto the unit square
// [0,1]², and a `view` { cx, cy, z } (centre in unit coords, z = px per unit),
// and it draws the down/right arrow lattice with each line's thickness scaled by
// its 2-adic / fibonacci-adic priority. No DOM, no model state — just a context.
//
// A `field` is:
//   { firstDarkRow, firstDarkCol,   // cell index where the interior begins
//     Mr, Mc,                       // matrix bounds (rows, cols) — exclusive
//     downMatrix, rightMatrix,      // propagation arrow matrices
//     colPriority, rowPriority }    // per-column / per-row ruler valuation
// The interior spans cells [firstDark, M-1]; those cells map onto [0,1]².

const DEFAULTS = {
    color: "#15171c", // line colour
    background: null, // if set, fill the canvas first
    cap: 6, // priority value past which the line stops thickening
    widthBase: 0.12, // base stroke as a fraction of a cell
    widthGain: 0.62, // extra stroke per priority step
    minWidth: 0.35, // sub-pixel lines are skipped (natural LOD)
};

export function drawLineField(ctx, W, Ht, field, view, opts = {}) {
    const o = { ...DEFAULTS, ...opts };
    const {
        firstDarkRow,
        firstDarkCol,
        Mr,
        Mc,
        downMatrix,
        rightMatrix,
        colPriority,
        rowPriority,
    } = field;

    if (o.background) {
        ctx.fillStyle = o.background;
        ctx.fillRect(0, 0, W, Ht);
    }

    const cellsX = Mc - firstDarkCol; // interior cells E–W (the square's side)
    const cellsY = Mr - firstDarkRow; // interior cells N–S
    // cell coordinate → screen pixel
    const sx = (cx) =>
        W / 2 + ((cx - firstDarkCol) / cellsX - view.cx) * view.z;
    const sy = (cy) =>
        Ht / 2 + ((cy - firstDarkRow) / cellsY - view.cy) * view.z;

    // visible window in unit coords → cell index bounds (with a 1-cell margin)
    const uxL = view.cx - W / 2 / view.z;
    const uxR = view.cx + W / 2 / view.z;
    const uyT = view.cy - Ht / 2 / view.z;
    const uyB = view.cy + Ht / 2 / view.z;
    const x0 = Math.max(0, Math.floor(uxL * cellsX + firstDarkCol) - 1);
    const x1 = Math.min(Mc - 1, Math.ceil(uxR * cellsX + firstDarkCol) + 1);
    const y0 = Math.max(0, Math.floor(uyT * cellsY + firstDarkRow) - 1);
    const y1 = Math.min(Mr - 1, Math.ceil(uyB * cellsY + firstDarkRow) + 1);

    const cellPx = Math.min(view.z / cellsX, view.z / cellsY);
    const base = Math.max(0.4, cellPx * o.widthBase);
    const widthFor = (p) => base * (1 + o.widthGain * Math.min(p, o.cap));

    ctx.strokeStyle = o.color;
    ctx.lineCap = "butt";

    // Batch segments by stroke width so each width is one stroke() call. Lines
    // thinner than minWidth are dropped — the self-similar level-of-detail.
    const byW = new Map();
    const add = (w, ax, ay, bx, by) => {
        if (w < o.minWidth) return;
        const key = w.toFixed(2);
        let a = byW.get(key);
        if (!a) byW.set(key, (a = []));
        a.push(ax, ay, bx, by);
    };

    for (let y = y0; y <= y1; y++) {
        const dRow = downMatrix[y];
        for (let x = x0; x <= x1; x++) {
            if (dRow && dRow[x]) {
                const X = sx(x + 1); // perfect-map convention: line on the boundary
                add(widthFor(colPriority[x] || 0), X, sy(y), X, sy(y + 1));
            }
            const rCol = rightMatrix[x];
            if (rCol && rCol[y]) {
                const Y = sy(y + 1);
                add(widthFor(rowPriority[y] || 0), sx(x), Y, sx(x + 1), Y);
            }
        }
    }

    for (const [key, a] of byW) {
        ctx.lineWidth = +key;
        ctx.beginPath();
        for (let i = 0; i < a.length; i += 4) {
            ctx.moveTo(a[i], a[i + 1]);
            ctx.lineTo(a[i + 2], a[i + 3]);
        }
        ctx.stroke();
    }
}
