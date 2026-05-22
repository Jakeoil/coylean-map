import {
    Propagation, Universe, Seniority,
} from "../../coylean-explorer/coylean-core.js";
import {
    makeTileBitmap, drawArrowsVector,
    drawDyadicGrid, drawDyadicLabels, autoMaxPri,
} from "./render.mjs";

const cv = document.getElementById("cv");
const ctx = cv.getContext("2d", { alpha: false });

// Universe.createUniverseExtents builds the four mirrored quadrant
// propagations, then Propagation.fromUniverseBoundary collapses their
// outer N/W edges into a single (2L-1) × (2L-1) SE-flowing Propagation.
// That integrated propagation has a uniform symmetric priority landscape
// (hInitCol = 1 - L, vInitRow = 1 - L), with the dyadic singular point
// pri(0)=maxPri landing exactly on the origin column/row.
//
// We deliberately avoid Universe.create / universe.assemble() here:
// assemble stitches the four quadrants into a (2L-1)² raster whose
// quadrants disagree on the priority of cells (NE has hInitCol=1 but
// vInitRow=0, etc.) and renders sparsely at the seams. The boundary
// integration is the only step we need.
//
// Rendering: world coords are matrix coords. The origin lives at
// (originRow, originCol) = (L-1, L-1); pan/zoom freely (including
// negative). Logical (dyadic) indices on the labels are measured relative
// to the origin so the origin cell reads as (0, 0).

let state = null;
let tileCache = new Map();
let propCache = new Map();

const view = {
    cellX: 0,
    cellY: 0,
    cellPx: 4,
};

const PROP_CACHE_LIMIT = 64;
const TILE_CACHE_LIMIT = 256;

function $(id) { return document.getElementById(id); }
function ms(t) { return `${t.toFixed(1)} ms`; }

function resizeCanvas() {
    const r = window.devicePixelRatio || 1;
    cv.width = Math.floor(window.innerWidth * r);
    cv.height = Math.floor(window.innerHeight * r);
    cv.style.width = `${window.innerWidth}px`;
    cv.style.height = `${window.innerHeight}px`;
    ctx.setTransform(r, 0, 0, r, 0, 0);
    schedule();
}

function readParams() {
    const L = Number($("L").value);
    const K = Number($("K").value);
    const mp = $("maxPri").value.trim();
    const maxPri = mp ? Number(mp) : autoMaxPri(L);
    if (!Number.isInteger(L) || L < 2) throw new Error("L must be ≥ 2");
    if (!Number.isInteger(K) || K < 1) throw new Error("K must be ≥ 1");
    return { L, K, maxPri };
}

async function build() {
    let params;
    try {
        params = readParams();
    } catch (e) {
        $("hudTitle").textContent = `ERROR: ${e.message}`;
        return;
    }
    const { L, K, maxPri } = params;
    $("hudTitle").textContent = `building universe L=${L}…`;
    $("rebuild").disabled = true;
    await new Promise((r) => requestAnimationFrame(r));
    const t0 = performance.now();
    const quadrants = Universe.createUniverseExtents(
        L, L, L, L,
        1, 1,
        Seniority.vertical(),
        {},
        { maxPri },
    );
    const tIntegrate0 = performance.now();
    const integrated = Propagation.fromUniverseBoundary(quadrants);
    const tIntegrate = performance.now() - tIntegrate0;
    const dt = performance.now() - t0;
    const originRow = L - 1;
    const originCol = L - 1;
    const nRows = integrated.numRows;
    const nCols = integrated.numColumns;
    state = {
        integrated,
        K,
        nRows,
        nCols,
        nBlocksRow: Math.ceil(nRows / K),
        nBlocksCol: Math.ceil(nCols / K),
        originRow,
        originCol,
        maxPri,
        L,
    };
    tileCache = new Map();
    propCache = new Map();
    $("hudTitle").textContent =
        `L=${L}, K=${K}, ${nRows}×${nCols}, built ${ms(dt)}`
        + ` (integrate ${ms(tIntegrate)})`;
    $("rebuild").disabled = false;
    recenter();
}

function recenter(redraw = true) {
    if (!state) return;
    const w = cv.width / (window.devicePixelRatio || 1);
    const h = cv.height / (window.devicePixelRatio || 1);
    const target = Math.min(Math.max(state.nRows, state.nCols), 1024);
    view.cellPx = Math.min(w, h) / target;
    view.cellX = state.originCol - w / view.cellPx / 2;
    view.cellY = state.originRow - h / view.cellPx / 2;
    if (redraw) schedule();
}

// Slice the universe matrices into a K-aligned tile at block (k1, k2).
// Returned object shapes itself like a Propagation for makeTileBitmap /
// drawArrowsVector. Edge tiles where K doesn't divide the universe extent
// come back with numRows or numColumns < K; the bitmap path still allocates
// a K × K canvas, leaving the unused region bg-coloured (and on screen that
// region falls outside the universe, where the canvas is white anyway).
function tileSlice(k1, k2) {
    const { integrated, K, nRows, nCols } = state;
    const r0 = k1 * K;
    const c0 = k2 * K;
    const nR = Math.min(K, nRows - r0);
    const nC = Math.min(K, nCols - c0);
    if (nR <= 0 || nC <= 0) return null;
    const dM = new Array(nR);
    for (let j = 0; j < nR; j++) {
        dM[j] = integrated.downMatrix[r0 + j].slice(c0, c0 + nC);
    }
    const rM = new Array(nC);
    for (let i = 0; i < nC; i++) {
        rM[i] = integrated.rightMatrix[c0 + i].slice(r0, r0 + nR);
    }
    return { downMatrix: dM, rightMatrix: rM, numRows: nR, numColumns: nC };
}

function getPropagation(k1, k2) {
    const key = `${k1},${k2}`;
    let p = propCache.get(key);
    if (p) {
        propCache.delete(key);
        propCache.set(key, p);
        return p;
    }
    p = tileSlice(k1, k2);
    if (!p) return null;
    propCache.set(key, p);
    if (propCache.size > PROP_CACHE_LIMIT) {
        const firstKey = propCache.keys().next().value;
        propCache.delete(firstKey);
    }
    return p;
}

// OKLCH red/blue from the theme sketch (meta/oklch.html). Down arrows take
// the red ramp, right arrows the blue. Bitmap mode (cellPx ≤ 2.5) uses the
// brighter `base` tier so single-pixel arrows stay visible at high density;
// vector mode (cellPx > 2.5) uses the darker `outline` tier with a fade
// alpha — see the render() vector branch.
const COLOR_DOWN_BITMAP = "oklch(57% 0.22 25)";
const COLOR_RIGHT_BITMAP = "oklch(58% 0.19 260)";

function getTileBitmap(k1, k2) {
    const key = `${k1},${k2}`;
    let bmp = tileCache.get(key);
    if (bmp) {
        tileCache.delete(key);
        tileCache.set(key, bmp);
        return bmp;
    }
    const p = getPropagation(k1, k2);
    if (!p) return null;
    bmp = makeTileBitmap(p, state.K, {
        fgDown: COLOR_DOWN_BITMAP,
        fgRight: COLOR_RIGHT_BITMAP,
    });
    tileCache.set(key, bmp);
    if (tileCache.size > TILE_CACHE_LIMIT) {
        const firstKey = tileCache.keys().next().value;
        tileCache.delete(firstKey);
    }
    return bmp;
}

let scheduled = false;
function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
        scheduled = false;
        render();
    });
}

function render() {
    const t0 = performance.now();
    const W = cv.width / (window.devicePixelRatio || 1);
    const H = cv.height / (window.devicePixelRatio || 1);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    if (!state) return;
    const { K, nBlocksRow, nBlocksCol, originRow, originCol, maxPri } = state;
    const { cellX, cellY, cellPx } = view;

    const iMin = Math.floor(cellX);
    const iMax = Math.ceil(cellX + W / cellPx);
    const jMin = Math.floor(cellY);
    const jMax = Math.ceil(cellY + H / cellPx);

    const k1Min = Math.max(0, Math.floor(jMin / K));
    const k1Max = Math.min(nBlocksRow - 1, Math.floor(jMax / K));
    const k2Min = Math.max(0, Math.floor(iMin / K));
    const k2Max = Math.min(nBlocksCol - 1, Math.floor(iMax / K));

    const useVector = cellPx >= 2.5;

    ctx.imageSmoothingEnabled = cellPx < 1.5;
    ctx.imageSmoothingQuality = "low";

    if (useVector) {
        const fade = Math.max(0, Math.min(1, (cellPx - 2.5) / 3));
        const alpha = 0.55 + 0.35 * fade;
        const downColor = `oklch(34% 0.18 25 / ${alpha})`;
        const rightColor = `oklch(34% 0.15 260 / ${alpha})`;
        for (let k1 = k1Min; k1 <= k1Max; k1++) {
            for (let k2 = k2Min; k2 <= k2Max; k2++) {
                const p = getPropagation(k1, k2);
                if (!p) continue;
                const x0 = (k2 * K - cellX) * cellPx;
                const y0 = (k1 * K - cellY) * cellPx;
                drawArrowsVector(ctx, p, x0, y0, cellPx, {
                    strokeStyleDown: downColor,
                    strokeStyleRight: rightColor,
                });
            }
        }
    } else {
        for (let k1 = k1Min; k1 <= k1Max; k1++) {
            for (let k2 = k2Min; k2 <= k2Max; k2++) {
                const bmp = getTileBitmap(k1, k2);
                if (!bmp) continue;
                const x = (k2 * K - cellX) * cellPx;
                const y = (k1 * K - cellY) * cellPx;
                const sz = K * cellPx;
                ctx.drawImage(bmp, x, y, sz, sz);
            }
        }
    }

    // Logical-index offsets passed to grid/labels: integrated propagation
    // has colPriority[c] = pri(c - originCol), so the origin column itself
    // is the dyadic singular point pri(0)=maxPri.
    const hLabelOffset = -originCol;
    const vLabelOffset = -originRow;

    if ($("showGrid").checked) {
        drawDyadicGrid(ctx, {
            canvas: { width: W, height: H },
            viewCellX: cellX, viewCellY: cellY, cellPx,
            hInitCol0: hLabelOffset,
            vInitRow0: vLabelOffset,
            maxPri,
            minPri: 2,
        });
    }
    if ($("showLabels").checked && cellPx >= 0.5) {
        drawDyadicLabels(ctx, {
            canvas: { width: W, height: H },
            viewCellX: cellX, viewCellY: cellY, cellPx,
            hInitCol0: hLabelOffset,
            vInitRow0: vLabelOffset,
            maxPri,
            labelMinPri: cellPx >= 2 ? 3 : 5,
        });
    }

    // HUD viewBounds in origin-relative coords (origin is 0).
    const iLogMin = iMin - originCol;
    const iLogMax = iMax - originCol;
    const jLogMin = jMin - originRow;
    const jLogMax = jMax - originRow;
    $("viewBounds").textContent =
        `cols [${iLogMin}..${iLogMax}] × rows [${jLogMin}..${jLogMax}]`;
    $("cellPx").textContent = cellPx.toFixed(2);
    $("mode").textContent = useVector ? "vector" : "bitmap";
    $("cacheSize").textContent =
        `${tileCache.size} bmp · ${propCache.size} prop`;
    $("extent").textContent =
        `${state.nRows}×${state.nCols} cells · L=${state.L}`;
    const dt = performance.now() - t0;
    $("frameTime").textContent = ms(dt);
}

let dragging = false;
let lastX = 0;
let lastY = 0;
cv.addEventListener("pointerdown", (e) => {
    dragging = true;
    cv.classList.add("dragging");
    cv.setPointerCapture(e.pointerId);
    lastX = e.clientX;
    lastY = e.clientY;
});
cv.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    view.cellX -= dx / view.cellPx;
    view.cellY -= dy / view.cellPx;
    schedule();
});
cv.addEventListener("pointerup", (e) => {
    dragging = false;
    cv.classList.remove("dragging");
    cv.releasePointerCapture(e.pointerId);
});
cv.addEventListener("pointercancel", () => {
    dragging = false;
    cv.classList.remove("dragging");
});

cv.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0015);
    const rect = cv.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const wx = view.cellX + mx / view.cellPx;
    const wy = view.cellY + my / view.cellPx;
    view.cellPx = Math.max(0.1, Math.min(64, view.cellPx * factor));
    view.cellX = wx - mx / view.cellPx;
    view.cellY = wy - my / view.cellPx;
    schedule();
}, { passive: false });

window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "0") { recenter(); }
    else if (e.key === "+" || e.key === "=") {
        view.cellPx = Math.min(64, view.cellPx * 1.4);
        schedule();
    } else if (e.key === "-" || e.key === "_") {
        view.cellPx = Math.max(0.1, view.cellPx / 1.4);
        schedule();
    } else if (e.key === "g") {
        $("showGrid").checked = !$("showGrid").checked;
        schedule();
    }
});

window.addEventListener("resize", resizeCanvas);
$("rebuild").addEventListener("click", build);
$("recenter").addEventListener("click", () => recenter());
$("showGrid").addEventListener("change", schedule);
$("showLabels").addEventListener("change", schedule);

resizeCanvas();
build();
