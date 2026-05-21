// Canvas-rendering helpers shared by explain.html and explore.html.
//
// Two render modes:
//   * bitmap   — pre-rasterise a tile to a K x K canvas (1 px / cell).
//                drawImage scales it for any zoom; used when cellPx <= ~2.
//   * vector   — at higher zoom, lines drawn directly so they stay crisp.
// Overlay: dyadic gridlines whose thickness grows with pri.

import { pri, DEFAULT_MAX_PRI } from "../../coylean-explorer/coylean-core.js";

export function autoMaxPri(L) {
    return Math.ceil(Math.log2(Math.max(2, L))) + 1;
}

export function makeTileBitmap(propagation, K, opts = {}) {
    const {
        bg = [255, 255, 255, 255],
        fg = [32, 32, 32, 255],
    } = opts;
    const cv = document.createElement("canvas");
    cv.width = K;
    cv.height = K;
    const ctx = cv.getContext("2d");
    const imageData = ctx.createImageData(K, K);
    const u32 = new Uint32Array(imageData.data.buffer);
    const bgPacked =
        (bg[3] << 24) | (bg[2] << 16) | (bg[1] << 8) | bg[0];
    const fgPacked =
        (fg[3] << 24) | (fg[2] << 16) | (fg[1] << 8) | fg[0];
    u32.fill(bgPacked);

    const { downMatrix, rightMatrix, numRows, numColumns } = propagation;
    for (let j = 0; j < numRows; j++) {
        const row = downMatrix[j];
        const base = j * K;
        for (let i = 0; i < numColumns; i++) {
            if (row[i]) u32[base + i] = fgPacked;
        }
    }
    for (let i = 0; i < numColumns; i++) {
        const col = rightMatrix[i];
        for (let j = 0; j < numRows; j++) {
            if (col[j]) u32[j * K + i] = fgPacked;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return cv;
}

// Vector draw: each arrow as a one-cell line segment. Crisp at any zoom.
// (x0, y0) is the screen position of cell (0, 0) of the propagation.
export function drawArrowsVector(ctx, propagation, x0, y0, cellPx, opts = {}) {
    const {
        strokeStyle = "#202020",
        lineWidth = Math.max(0.5, cellPx * 0.06),
    } = opts;
    const { downMatrix, rightMatrix, numRows, numColumns } = propagation;

    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "butt";

    ctx.beginPath();
    // Each arrow runs from the center of its source cell to the center of
    // its destination cell. Adjacent arrows along a stream share endpoints,
    // and corner deflections meet correctly at the destination cell center.
    for (let j = 0; j <= numRows; j++) {
        const row = downMatrix[j];
        if (!row) continue;
        const y1 = y0 + (j - 0.5) * cellPx;
        const y2 = y0 + (j + 0.5) * cellPx;
        for (let i = 0; i < numColumns; i++) {
            if (row[i]) {
                const x = x0 + (i + 0.5) * cellPx;
                ctx.moveTo(x, y1);
                ctx.lineTo(x, y2);
            }
        }
    }
    for (let i = 0; i <= numColumns; i++) {
        const col = rightMatrix[i];
        if (!col) continue;
        const x1 = x0 + (i - 0.5) * cellPx;
        const x2 = x0 + (i + 0.5) * cellPx;
        for (let j = 0; j < numRows; j++) {
            if (col[j]) {
                const y = y0 + (j + 0.5) * cellPx;
                ctx.moveTo(x1, y);
                ctx.lineTo(x2, y);
            }
        }
    }
    ctx.stroke();
}

// Dyadic gridlines: at column c, the algorithm's priority is pri(c + hInitCol0).
// We draw a vertical line at every column whose priority crosses a threshold,
// with thickness rising with pri. Used as an overlay on top of the cells.
//
// minPri  — smallest priority that gets a line (default 2)
// maxLine — cap on line thickness in CSS px
export function drawDyadicGrid(ctx, opts) {
    const {
        canvas,
        viewCellX, viewCellY, cellPx,
        hInitCol0 = 1, vInitRow0 = 1,
        maxPri = DEFAULT_MAX_PRI,
        minPri = 2,
        maxLine = 8,
        color = "rgba(40, 70, 140, 0.35)",
    } = opts;
    const W = canvas.width;
    const H = canvas.height;

    const iMin = Math.floor(viewCellX);
    const iMax = Math.ceil(viewCellX + W / cellPx);
    const jMin = Math.floor(viewCellY);
    const jMax = Math.ceil(viewCellY + H / cellPx);

    ctx.save();
    ctx.strokeStyle = color;

    // Group lines by priority so each thickness is a single stroke call.
    const byPriV = new Map();
    for (let i = iMin; i <= iMax; i++) {
        const p = pri(i + hInitCol0, maxPri);
        if (p < minPri) continue;
        if (!byPriV.has(p)) byPriV.set(p, []);
        byPriV.get(p).push(i);
    }
    const byPriH = new Map();
    for (let j = jMin; j <= jMax; j++) {
        const p = pri(j + vInitRow0, maxPri);
        if (p < minPri) continue;
        if (!byPriH.has(p)) byPriH.set(p, []);
        byPriH.get(p).push(j);
    }

    const priorities = new Set([...byPriV.keys(), ...byPriH.keys()]);
    const sorted = [...priorities].sort((a, b) => a - b);
    for (const p of sorted) {
        const thickness = Math.min(maxLine, 0.7 + (p - minPri + 1) * 0.8);
        const alpha = Math.min(0.9, 0.18 + (p - minPri) * 0.08);
        ctx.lineWidth = thickness;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        for (const i of byPriV.get(p) ?? []) {
            const x = (i - viewCellX) * cellPx;
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
        }
        for (const j of byPriH.get(p) ?? []) {
            const y = (j - viewCellY) * cellPx;
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
        }
        ctx.stroke();
    }
    ctx.restore();
}

// Dyadic axis labels along the top and left margins.
// Labels every column/row whose pri >= labelMinPri.
export function drawDyadicLabels(ctx, opts) {
    const {
        canvas,
        viewCellX, viewCellY, cellPx,
        hInitCol0 = 1, vInitRow0 = 1,
        maxPri = DEFAULT_MAX_PRI,
        labelMinPri = 4,
        font = "10px ui-monospace, Menlo, monospace",
        color = "rgba(20, 30, 60, 0.85)",
    } = opts;
    const W = canvas.width;
    const H = canvas.height;
    const iMin = Math.floor(viewCellX);
    const iMax = Math.ceil(viewCellX + W / cellPx);
    const jMin = Math.floor(viewCellY);
    const jMax = Math.ceil(viewCellY + H / cellPx);

    ctx.save();
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textBaseline = "top";

    for (let i = iMin; i <= iMax; i++) {
        const p = pri(i + hInitCol0, maxPri);
        if (p < labelMinPri) continue;
        const x = (i - viewCellX) * cellPx;
        if (x < 0 || x > W) continue;
        ctx.fillText(`${i + hInitCol0} · p${p}`, x + 2, 2);
    }
    ctx.textBaseline = "alphabetic";
    for (let j = jMin; j <= jMax; j++) {
        const p = pri(j + vInitRow0, maxPri);
        if (p < labelMinPri) continue;
        const y = (j - viewCellY) * cellPx;
        if (y < 0 || y > H) continue;
        ctx.fillText(`${j + vInitRow0} · p${p}`, 2, y - 2);
    }
    ctx.restore();
}
