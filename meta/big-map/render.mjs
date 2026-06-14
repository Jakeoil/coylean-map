// Canvas-rendering helpers shared by explain.html and explore.html.
//
// Two render modes:
//   * bitmap   — pre-rasterise a tile to a K x K canvas (1 px / cell).
//                drawImage scales it for any zoom; used when cellPx <= ~2.
//   * vector   — at higher zoom, lines drawn directly so they stay crisp.
// Overlay: dyadic gridlines whose thickness grows with pri.

import { pri, DEFAULT_MAX_PRI } from "coylean/core";

export function autoMaxPri(L) {
    return Math.ceil(Math.log2(Math.max(2, L))) + 1;
}

// Memoized CSS-string → packed uint32 RGBA. Used so callers can pass OKLCH
// (or any CSS color) without doing the conversion themselves.
const _packedColorCache = new Map();
function packCssColor(cssColor) {
    const hit = _packedColorCache.get(cssColor);
    if (hit !== undefined) return hit;
    const cv = document.createElement("canvas");
    cv.width = 1;
    cv.height = 1;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = cssColor;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const packed = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
    _packedColorCache.set(cssColor, packed);
    return packed;
}

export function makeTileBitmap(propagation, K, opts = {}) {
    const {
        bg = [255, 255, 255, 255],
        fg = [32, 32, 32, 255],
        fgDown,
        fgRight,
    } = opts;
    const cv = document.createElement("canvas");
    cv.width = K;
    cv.height = K;
    const ctx = cv.getContext("2d");
    const imageData = ctx.createImageData(K, K);
    const u32 = new Uint32Array(imageData.data.buffer);
    const bgPacked =
        ((bg[3] << 24) | (bg[2] << 16) | (bg[1] << 8) | bg[0]) >>> 0;
    const fgPacked =
        ((fg[3] << 24) | (fg[2] << 16) | (fg[1] << 8) | fg[0]) >>> 0;
    const fgDownPacked = fgDown != null ? packCssColor(fgDown) : fgPacked;
    const fgRightPacked = fgRight != null ? packCssColor(fgRight) : fgPacked;
    u32.fill(bgPacked);

    const { downMatrix, rightMatrix, numRows, numColumns } = propagation;
    for (let j = 0; j < numRows; j++) {
        const row = downMatrix[j];
        const base = j * K;
        for (let i = 0; i < numColumns; i++) {
            if (row[i]) u32[base + i] = fgDownPacked;
        }
    }
    for (let i = 0; i < numColumns; i++) {
        const col = rightMatrix[i];
        for (let j = 0; j < numRows; j++) {
            if (col[j]) u32[j * K + i] = fgRightPacked;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return cv;
}

// Vector draw: each arrow as a one-cell line segment. Crisp at any zoom.
// (x0, y0) is the screen position of cell (0, 0) of the propagation.
// strokeStyleDown / strokeStyleRight let the caller color the two axes
// independently; both fall back to strokeStyle if not provided.
export function drawArrowsVector(ctx, propagation, x0, y0, cellPx, opts = {}) {
    const {
        strokeStyle = "#202020",
        strokeStyleDown = strokeStyle,
        strokeStyleRight = strokeStyle,
        lineWidth = Math.max(0.5, cellPx * 0.06),
    } = opts;
    const { downMatrix, rightMatrix, numRows, numColumns } = propagation;

    ctx.lineWidth = lineWidth;
    ctx.lineCap = "butt";

    // Down arrows.
    ctx.strokeStyle = strokeStyleDown;
    ctx.beginPath();
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
    ctx.stroke();

    // Right arrows.
    ctx.strokeStyle = strokeStyleRight;
    ctx.beginPath();
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

// Reusable soft-white halo: one offscreen canvas with a radial-gradient blob
// built once at module load. Stretched per label via drawImage so the
// transparent edges fade smoothly behind any text size. Avoids the cost of
// createRadialGradient per label.
let _haloCv = null;
function getHaloCanvas() {
    if (_haloCv) return _haloCv;
    const size = 64;
    _haloCv = document.createElement("canvas");
    _haloCv.width = size;
    _haloCv.height = size;
    const c = _haloCv.getContext("2d");
    const g = c.createRadialGradient(
        size / 2, size / 2, 0,
        size / 2, size / 2, size / 2,
    );
    g.addColorStop(0.0, "rgba(255, 255, 255, 0.92)");
    g.addColorStop(0.55, "rgba(255, 255, 255, 0.78)");
    g.addColorStop(1.0, "rgba(255, 255, 255, 0)");
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    return _haloCv;
}

// Dyadic axis labels along the top and left margins.
// Labels every column/row whose pri >= labelMinPri.
// Down (column) labels: two lines (index above, p{pri} below) centered
// horizontally on the column's vertical line, pinned to the top margin.
// Right (row) labels: single line "idx · p{pri}" whose vertical middle
// sits on the row's horizontal line, pinned to the left margin.
export function drawDyadicLabels(ctx, opts) {
    const {
        canvas,
        viewCellX, viewCellY, cellPx,
        hInitCol0 = 1, vInitRow0 = 1,
        maxPri = DEFAULT_MAX_PRI,
        labelMinPri = 4,
        font = "10px ui-monospace, Menlo, monospace",
        colorDown = "oklch(25% 0.13 25)",
        colorRight = "oklch(25% 0.11 260)",
    } = opts;
    const W = canvas.width;
    const H = canvas.height;
    const iMin = Math.floor(viewCellX);
    const iMax = Math.ceil(viewCellX + W / cellPx);
    const jMin = Math.floor(viewCellY);
    const jMax = Math.ceil(viewCellY + H / cellPx);

    ctx.save();
    ctx.font = font;
    const halo = getHaloCanvas();
    const lineH = 11; // tuned for 10px monospace
    const padX = 4;
    const padY = 3;
    // Halo overshoots the text box so the gradient's transparent edge is
    // visible rather than being clipped to a hard rectangle.
    const haloOverX = 8;
    const haloOverY = 5;

    // Down labels — centered on the vertical column line, pinned to top.
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const topY = 3;
    for (let i = iMin; i <= iMax; i++) {
        const p = pri(i + hInitCol0, maxPri);
        if (p < labelMinPri) continue;
        const x = (i - viewCellX) * cellPx;
        if (x < 0 || x > W) continue;
        const idxStr = `${i + hInitCol0}`;
        const priStr = `p${p}`;
        const boxW =
            Math.max(ctx.measureText(idxStr).width, ctx.measureText(priStr).width)
            + 2 * padX;
        const boxH = 2 * lineH + 2 * padY;
        ctx.drawImage(
            halo,
            x - boxW / 2 - haloOverX,
            topY - haloOverY,
            boxW + 2 * haloOverX,
            boxH + 2 * haloOverY,
        );
        ctx.fillStyle = colorDown;
        ctx.fillText(idxStr, x, topY + padY);
        ctx.fillText(priStr, x, topY + padY + lineH);
    }

    // Right labels — single line, text's vertical middle on the row line.
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const leftX = 3;
    for (let j = jMin; j <= jMax; j++) {
        const p = pri(j + vInitRow0, maxPri);
        if (p < labelMinPri) continue;
        const y = (j - viewCellY) * cellPx;
        if (y < 0 || y > H) continue;
        const text = `${j + vInitRow0} · p${p}`;
        const boxW = ctx.measureText(text).width + 2 * padX;
        const boxH = lineH + 2 * padY;
        const boxY = y - boxH / 2;
        ctx.drawImage(
            halo,
            leftX - haloOverX,
            boxY - haloOverY,
            boxW + 2 * haloOverX,
            boxH + 2 * haloOverY,
        );
        ctx.fillStyle = colorRight;
        ctx.fillText(text, leftX + padX, y);
    }
    ctx.restore();
}
