import {
    Seniority, Row, Col,
} from "../../coylean-explorer/coylean-core.js";
import {
    createScaffold, allocateScaffold, propagateBlock, isBlockBuilt,
} from "./scaffold.mjs";
import { tile } from "./tile.mjs";
import {
    makeTileBitmap, drawArrowsVector,
    drawDyadicGrid, drawDyadicLabels, autoMaxPri,
} from "./render.mjs";

const cv = document.getElementById("cv");
const ctx = cv.getContext("2d", { alpha: false });

// Lazy-scaffold rendering, two-phase:
//
//   Phase 1 ("boundary"): build four quadrant scaffolds in rAF chunks.
//     Each is an SE-flow scaffold with quadrant-specific hInitCol0 /
//     vInitRow0 (mirroring Universe.createUniverseExtents). We only need
//     their far-from-origin seams (hSeams[L/K], vSeams[L/K]) — these
//     stitch into the universe boundary seed.
//
//   Phase 2 ("ready"): create the INTEGRATED scaffold seeded from the
//     stitched boundary (per Propagation.fromUniverseBoundary). Discard
//     the four quadrant scaffolds. Build integrated blocks lazily,
//     viewport-prioritized.
//
// The integrated scaffold gives the same mathematically consistent
// representation as the eager fromUniverseBoundary path used previously,
// but holds only seam data (~K× memory reduction) and only builds blocks
// the viewport actually visits.
//
// ----------------------------------------------------------------------
// URL query parameters
// ----------------------------------------------------------------------
// Construction params:
//   L          int ≥ 2       per-quadrant extent. Integrated grid covers
//                             (2L-1) × (2L-1) cells, rounded up to K.
//                             Default 1024.
//   K          int ≥ 1       scaffold block size. Default 256.
//   maxPri     int 1..31     priority cap. Default ⌈log₂ L⌉ + 1.
//   hInitCol   int           h priority offset. Default 1 (canonical).
//   vInitRow   int           v priority offset. Default 1 (canonical).
//   seniority  "v" | "h"     tie-breaking. Default "v".
//
// View params (applied once after build):
//   cx, cy     number        viewport centre in origin-relative cells.
//   px         number > 0    initial cellPx. Default = auto fit.
//   grid       "0" | "1"     dyadic grid initial state. Default 0.
//   labels     "0" | "1"     labels initial state. Default 0.

let state = null;
let propCache = new Map();
let tileCache = new Map();

const PROP_CACHE_LIMIT = 256;
const TILE_CACHE_LIMIT = 256;
const FRAME_BUDGET_MS = 8;

const view = {
    cellX: 0,
    cellY: 0,
    cellPx: 4,
};

// Render only when something changed. Without this the rAF loop redraws
// the whole canvas ~60×/sec forever, pinning a core while idle. Interaction
// handlers and drainWork progress flip this on; frame() clears it.
let needsRender = true;
function requestRender() { needsRender = true; }

function $(id) { return document.getElementById(id); }
function ms(t) { return `${t.toFixed(1)} ms`; }

function resizeCanvas() {
    const r = window.devicePixelRatio || 1;
    cv.width = Math.floor(window.innerWidth * r);
    cv.height = Math.floor(window.innerHeight * r);
    cv.style.width = `${window.innerWidth}px`;
    cv.style.height = `${window.innerHeight}px`;
    ctx.setTransform(r, 0, 0, r, 0, 0);
}

function readParams() {
    const L = Number($("L").value);
    const K = Number($("K").value);
    const mp = $("maxPri").value.trim();
    const maxPri = mp ? Number(mp) : autoMaxPri(L);
    // Optional per-axis ceilings. Blank = fall back to maxPri (so the map
    // runs exactly as before); set one to clamp only that axis. latPri =
    // N–S (vInitRow), longPri = E–W (hInitCol).
    const latStr = $("maxLatPri").value.trim();
    const longStr = $("maxLongPri").value.trim();
    const maxLatPri = latStr ? Number(latStr) : maxPri;
    const maxLongPri = longStr ? Number(longStr) : maxPri;
    const hInitCol = Number($("hInitCol").value);
    const vInitRow = Number($("vInitRow").value);
    const seniority = $("seniorityH").checked
        ? Seniority.horizontal()
        : Seniority.vertical();
    if (!Number.isInteger(L) || L < 2) throw new Error("L must be ≥ 2");
    if (!Number.isInteger(K) || K < 1) throw new Error("K must be ≥ 1");
    if (L % K !== 0) throw new Error(`L=${L} must be divisible by K=${K}`);
    if (!Number.isInteger(hInitCol)) throw new Error("hInitCol must be int");
    if (!Number.isInteger(vInitRow)) throw new Error("vInitRow must be int");
    if (latStr && (!Number.isInteger(maxLatPri) || maxLatPri < 1))
        throw new Error("latPri must be a positive int");
    if (longStr && (!Number.isInteger(maxLongPri) || maxLongPri < 1))
        throw new Error("longPri must be a positive int");
    return { L, K, maxPri, maxLatPri, maxLongPri, hInitCol, vInitRow, seniority };
}

// pendingView holds URL-supplied view params, applied once after Phase 1
// completes (when we know the integrated dimensions).
let pendingView = null;

function build() {
    let params;
    try {
        params = readParams();
    } catch (e) {
        // render() rewrites #hudTitle every frame, so an error there is
        // erased instantly and the stale map looks "unchanged". Surface it
        // in a dedicated line render() never touches.
        const err = $("buildErr");
        err.textContent = `Rebuild failed: ${e.message}`;
        err.style.display = "";
        return;
    }
    $("buildErr").style.display = "none";
    // Preserve the current zoom + pan across the rebuild. captureView reads
    // the OLD state, so grab it before we overwrite `state` below. (On the
    // first build state is null and we keep the URL-supplied pendingView.)
    const preserved = captureView();
    if (preserved) pendingView = preserved;
    const {
        L, K, maxPri, maxLatPri, maxLongPri, hInitCol, vInitRow, seniority,
    } = params;
    $("rebuild").disabled = true;

    const nBlocksPerQuad = L / K;

    // Phase-1 quadrant scaffolds. createUniverseExtents-equivalent
    // per-quadrant offsets. The per-axis ceilings are axis-aligned (cols are
    // always E–W, rows always N–S), so they pass through the mirrored
    // quadrants unchanged.
    const quadScaffolds = {
        nw: createScaffold({
            K, hInitCol0: 1 - hInitCol, vInitRow0: 1 - vInitRow,
            seniority, maxPri, maxLatPri, maxLongPri,
        }),
        ne: createScaffold({
            K, hInitCol0: hInitCol, vInitRow0: 1 - vInitRow,
            seniority, maxPri, maxLatPri, maxLongPri,
        }),
        sw: createScaffold({
            K, hInitCol0: 1 - hInitCol, vInitRow0: vInitRow,
            seniority, maxPri, maxLatPri, maxLongPri,
        }),
        se: createScaffold({
            K, hInitCol0: hInitCol, vInitRow0: vInitRow,
            seniority, maxPri, maxLatPri, maxLongPri,
        }),
    };
    for (const q of Object.values(quadScaffolds)) {
        allocateScaffold(q, nBlocksPerQuad);
    }

    // SE-march order, interleaved across the 4 quadrants so they make
    // progress in parallel (visually all four corners fill at once if we
    // ever start rendering Phase-1 progress).
    const boundaryQueue = [];
    for (let d = 0; d < nBlocksPerQuad * 2 - 1; d++) {
        for (let k1 = Math.max(0, d - nBlocksPerQuad + 1);
                 k1 <= Math.min(d, nBlocksPerQuad - 1); k1++) {
            const k2 = d - k1;
            for (const quad of ["nw", "ne", "sw", "se"]) {
                boundaryQueue.push({ quad, k1, k2 });
            }
        }
    }

    state = {
        phase: "boundary",
        params,
        L, K, maxPri,
        nBlocksPerQuad,
        quadScaffolds,
        boundaryQueue,
        boundaryDone: 0,
        boundaryTotal: boundaryQueue.length,
        // Phase-2 fields, populated at transition.
        integrated: null,
        integratedNBlocks: 0,
        integratedCells: 0,    // cell extent of valid universe region
        originRow: L - 1,
        originCol: L - 1,
        tBuildStart: performance.now(),
        tBoundaryEnd: 0,
        tReadyStart: 0,
    };
    propCache = new Map();
    tileCache = new Map();
    // Loop is already running (started once at page load).
    $("hudTitle").textContent = `building boundary L=${L}…`;
    requestRender();
}

function transitionToIntegrated() {
    const { L, K, maxPri, params, nBlocksPerQuad, quadScaffolds } = state;
    const { hInitCol, vInitRow, seniority, maxLatPri, maxLongPri } = params;
    state.tBoundaryEnd = performance.now();

    // Per fromUniverseBoundary's stitching (with all 4 quadrants present):
    //   initDown  = NW.resultDown reversed ++ NE.resultDown      (length 2L)
    //   initRight = NW.resultRight reversed ++ SW.resultRight     (length 2L)
    // resultDown of a quadrant scaffold = hSeams[nBlocks]
    // resultRight                     = vSeams[nBlocks]
    const N = nBlocksPerQuad;
    const nwResultDown  = quadScaffolds.nw.hSeams[N];
    const neResultDown  = quadScaffolds.ne.hSeams[N];
    const nwResultRight = quadScaffolds.nw.vSeams[N];
    const swResultRight = quadScaffolds.sw.vSeams[N];

    const initDown = new Row(2 * L);
    for (let i = 0; i < L; i++) initDown[i] = nwResultDown[L - 1 - i];
    for (let i = 0; i < L; i++) initDown[L + i] = neResultDown[i];
    const initRight = new Col(2 * L);
    for (let j = 0; j < L; j++) initRight[j] = nwResultRight[L - 1 - j];
    for (let j = 0; j < L; j++) initRight[L + j] = swResultRight[j];

    // Integrated scaffold: round extent up to next K-multiple ≥ (2L - 1).
    // For typical L_q divisible by K, 2L is already a multiple of K, so
    // the integrated covers (2L) cells per axis (1 cell beyond the
    // universe's SE edge; that cell exists in the scaffold but never
    // renders inside the universe).
    const cellExtent = 2 * L - 1;
    const blockExtent = Math.ceil(cellExtent / K);
    const integrated = createScaffold({
        K,
        hInitCol0: hInitCol - L,
        vInitRow0: vInitRow - L,
        seniority,
        maxPri,
        maxLatPri,
        maxLongPri,
    });
    allocateScaffold(integrated, blockExtent);

    // Overwrite the all-true seeds with the universe boundary.
    for (let i = 0; i < initDown.length; i++) {
        integrated.hSeams[0][i] = initDown[i];
    }
    for (let j = 0; j < initRight.length; j++) {
        integrated.vSeams[0][j] = initRight[j];
    }

    state.integrated = integrated;
    state.integratedNBlocks = blockExtent;
    state.integratedCells = cellExtent;
    state.quadScaffolds = null;          // GC the 4 quadrants
    state.boundaryQueue = null;
    state.phase = "ready";
    state.tReadyStart = performance.now();
    propCache = new Map();
    tileCache = new Map();

    applyView(pendingView);
    pendingView = null;
    $("rebuild").disabled = false;
}

function applyView(overrides) {
    if (!state || state.phase !== "ready") return;
    const w = cv.width / (window.devicePixelRatio || 1);
    const h = cv.height / (window.devicePixelRatio || 1);
    const cx = overrides?.cx ?? 0;
    const cy = overrides?.cy ?? 0;
    if (overrides?.px && overrides.px > 0) {
        view.cellPx = overrides.px;
    } else {
        const target = Math.min(state.integratedCells, 1024);
        view.cellPx = Math.min(w, h) / target;
    }
    view.cellX = state.originCol + cx - w / view.cellPx / 2;
    view.cellY = state.originRow + cy - h / view.cellPx / 2;
    requestRender();
}

// Inverse of applyView: snapshot the live view as origin-relative
// {cx, cy, px} so a rebuild can restore the same zoom + position even if
// L (hence the origin) changed. Returns null before the first build.
function captureView() {
    if (!state || state.phase !== "ready") return null;
    const w = cv.width / (window.devicePixelRatio || 1);
    const h = cv.height / (window.devicePixelRatio || 1);
    return {
        cx: view.cellX + w / view.cellPx / 2 - state.originCol,
        cy: view.cellY + h / view.cellPx / 2 - state.originRow,
        px: view.cellPx,
    };
}

function recenter() { applyView(null); }

// Walk back from (k1, k2) along its SE-march dependency chain to the
// closest unbuilt block that IS ready (both upstream seams populated).
// Returns null if nothing left to do; otherwise {k1, k2}.
function nextReadyAncestor(s, k1, k2) {
    while (k1 >= 0 && k2 >= 0) {
        if (isBlockBuilt(s, k1, k2)) return null;
        const needUp = k1 > 0 && !isBlockBuilt(s, k1 - 1, k2);
        const needLeft = k2 > 0 && !isBlockBuilt(s, k1, k2 - 1);
        if (!needUp && !needLeft) return { k1, k2 };
        // Walk toward origin along whichever axis still needs work.
        // Prefer the larger remaining distance to bias toward diagonal march.
        if (needUp && (!needLeft || k1 >= k2)) { k1--; }
        else { k2--; }
    }
    return null;
}

// Per frame, drain work up to FRAME_BUDGET_MS. In "boundary" phase: pop
// from the pre-built quadrant queue. In "ready" phase: walk back from
// visible-but-unbuilt blocks. Returns true while there is still animating
// work (so the caller keeps rendering); false once idle.
function drainWork() {
    if (!state) return false;
    const deadline = performance.now() + FRAME_BUDGET_MS;
    if (state.phase === "boundary") {
        const q = state.boundaryQueue;
        const scaffolds = state.quadScaffolds;
        while (performance.now() < deadline && q.length > 0) {
            const job = q.shift();
            propagateBlock(scaffolds[job.quad], job.k1, job.k2);
            state.boundaryDone++;
        }
        if (q.length === 0) transitionToIntegrated();
        return true; // boundary is always progressing → keep rendering
    }
    // ready: viewport-driven lazy build
    const visible = visibleBlockRange();
    if (!visible) return false;
    const s = state.integrated;
    const { k1Min, k1Max, k2Min, k2Max } = visible;
    let built = 0;
    // Diagonal-spiral order from top-left of viewport (closest to origin
    // is built first, which is what's needed anyway for dependency).
    outer:
    for (let d = 0; d <= (k1Max - k1Min) + (k2Max - k2Min); d++) {
        for (let dk = 0; dk <= d; dk++) {
            const k1 = k1Min + dk;
            const k2 = k2Min + (d - dk);
            if (k1 > k1Max || k2 > k2Max) continue;
            if (isBlockBuilt(s, k1, k2)) continue;
            const anc = nextReadyAncestor(s, k1, k2);
            if (!anc) continue;
            propagateBlock(s, anc.k1, anc.k2);
            built++;
            if (performance.now() >= deadline) break outer;
        }
    }
    return built > 0; // false once all visible blocks are built → idle
}

function visibleBlockRange() {
    if (!state || state.phase !== "ready") return null;
    const W = cv.width / (window.devicePixelRatio || 1);
    const H = cv.height / (window.devicePixelRatio || 1);
    const { K, integratedNBlocks } = state;
    const { cellX, cellY, cellPx } = view;
    const iMin = Math.floor(cellX);
    const iMax = Math.ceil(cellX + W / cellPx);
    const jMin = Math.floor(cellY);
    const jMax = Math.ceil(cellY + H / cellPx);
    const k1Min = Math.max(0, Math.floor(jMin / K));
    const k1Max = Math.min(integratedNBlocks - 1, Math.floor(jMax / K));
    const k2Min = Math.max(0, Math.floor(iMin / K));
    const k2Max = Math.min(integratedNBlocks - 1, Math.floor(iMax / K));
    if (k1Min > k1Max || k2Min > k2Max) return null;
    return { k1Min, k1Max, k2Min, k2Max };
}

function getPropagation(k1, k2) {
    const key = `${k1},${k2}`;
    let p = propCache.get(key);
    if (p) {
        propCache.delete(key);
        propCache.set(key, p);
        return p;
    }
    const s = state.integrated;
    // Upstream seams must be populated. tile() requires them; even if
    // (k1, k2) itself isn't "built" (meaning its OWN downstream seams
    // aren't written), the inputs come from the upstream neighbours.
    const upOK = k1 === 0 || isBlockBuilt(s, k1 - 1, k2);
    const leftOK = k2 === 0 || isBlockBuilt(s, k1, k2 - 1);
    if (!upOK || !leftOK) return null;
    p = tile(s, k1, k2);
    propCache.set(key, p);
    if (propCache.size > PROP_CACHE_LIMIT) {
        const firstKey = propCache.keys().next().value;
        propCache.delete(firstKey);
    }
    return p;
}

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

function render() {
    const t0 = performance.now();
    const W = cv.width / (window.devicePixelRatio || 1);
    const H = cv.height / (window.devicePixelRatio || 1);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    if (!state) return;

    if (state.phase === "boundary") {
        const pct = (state.boundaryDone / state.boundaryTotal) * 100;
        $("hudTitle").textContent =
            `building boundary ${state.boundaryDone.toLocaleString()}`
            + ` / ${state.boundaryTotal.toLocaleString()} blocks`
            + ` (${pct.toFixed(1)}%)`;
        $("viewBounds").textContent = "—";
        $("cellPx").textContent = "—";
        $("mode").textContent = "boundary";
        $("cacheSize").textContent = "0";
        $("extent").textContent = `4 × ${state.nBlocksPerQuad}² quadrant blocks`;
        $("frameTime").textContent = ms(performance.now() - t0);
        return;
    }

    // Phase: ready
    const visible = visibleBlockRange();
    const { K, integratedCells, originRow, originCol, maxPri } = state;
    const { cellX, cellY, cellPx } = view;
    const useVector = cellPx >= 2.5;
    ctx.imageSmoothingEnabled = cellPx < 1.5;
    ctx.imageSmoothingQuality = "low";

    let drawn = 0, pending = 0;
    if (visible) {
        const { k1Min, k1Max, k2Min, k2Max } = visible;
        if (useVector) {
            const fade = Math.max(0, Math.min(1, (cellPx - 2.5) / 3));
            const alpha = 0.55 + 0.35 * fade;
            const downColor = `oklch(34% 0.18 25 / ${alpha})`;
            const rightColor = `oklch(34% 0.15 260 / ${alpha})`;
            for (let k1 = k1Min; k1 <= k1Max; k1++) {
                for (let k2 = k2Min; k2 <= k2Max; k2++) {
                    const p = getPropagation(k1, k2);
                    if (!p) { pending++; drawPlaceholder(k1, k2); continue; }
                    const x0 = (k2 * K - cellX) * cellPx;
                    const y0 = (k1 * K - cellY) * cellPx;
                    drawArrowsVector(ctx, p, x0, y0, cellPx, {
                        strokeStyleDown: downColor,
                        strokeStyleRight: rightColor,
                    });
                    drawn++;
                }
            }
        } else {
            for (let k1 = k1Min; k1 <= k1Max; k1++) {
                for (let k2 = k2Min; k2 <= k2Max; k2++) {
                    const bmp = getTileBitmap(k1, k2);
                    if (!bmp) { pending++; drawPlaceholder(k1, k2); continue; }
                    const x = (k2 * K - cellX) * cellPx;
                    const y = (k1 * K - cellY) * cellPx;
                    const sz = K * cellPx;
                    ctx.drawImage(bmp, x, y, sz, sz);
                    drawn++;
                }
            }
        }
    }

    if ($("showGrid").checked) {
        drawDyadicGrid(ctx, {
            canvas: { width: W, height: H },
            viewCellX: cellX, viewCellY: cellY, cellPx,
            hInitCol0: state.integrated.hInitCol0,
            vInitRow0: state.integrated.vInitRow0,
            maxPri,
            minPri: 2,
        });
    }
    if ($("showLabels").checked && cellPx >= 0.5) {
        drawDyadicLabels(ctx, {
            canvas: { width: W, height: H },
            viewCellX: cellX, viewCellY: cellY, cellPx,
            hInitCol0: state.integrated.hInitCol0,
            vInitRow0: state.integrated.vInitRow0,
            maxPri,
            labelMinPri: cellPx >= 2 ? 3 : 5,
        });
    }

    // HUD
    const iLogMin = Math.floor(cellX) - originCol;
    const iLogMax = Math.ceil(cellX + W / cellPx) - originCol;
    const jLogMin = Math.floor(cellY) - originRow;
    const jLogMax = Math.ceil(cellY + H / cellPx) - originRow;
    $("hudTitle").textContent = pending > 0
        ? `building viewport (${pending} pending, ${drawn} drawn)`
        : `L=${state.L}, K=${state.K},`
          + ` ${integratedCells}² integrated (lazy)`;
    $("viewBounds").textContent =
        `cols [${iLogMin}..${iLogMax}] × rows [${jLogMin}..${jLogMax}]`;
    $("cellPx").textContent = cellPx.toFixed(2);
    $("mode").textContent = useVector ? "vector" : "bitmap";
    $("cacheSize").textContent =
        `${tileCache.size} bmp · ${propCache.size} prop`;
    $("extent").textContent =
        `${integratedCells}² cells · L=${state.L}`;
    $("frameTime").textContent = ms(performance.now() - t0);
}

function drawPlaceholder(k1, k2) {
    const { K } = state;
    const { cellX, cellY, cellPx } = view;
    const x = (k2 * K - cellX) * cellPx;
    const y = (k1 * K - cellY) * cellPx;
    const sz = K * cellPx;
    ctx.fillStyle = "#f0f0f4";
    ctx.fillRect(x, y, sz, sz);
}

function frame() {
    if (drainWork()) needsRender = true;
    if (needsRender) {
        render();
        needsRender = false;
    }
    requestAnimationFrame(frame);
}

// Pointer / wheel / keys.
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
    requestRender();
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
    requestRender();
}, { passive: false });

window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "0") { recenter(); }
    else if (e.key === "+" || e.key === "=") {
        view.cellPx = Math.min(64, view.cellPx * 1.4);
    } else if (e.key === "-" || e.key === "_") {
        view.cellPx = Math.max(0.1, view.cellPx / 1.4);
    } else if (e.key === "g") {
        $("showGrid").checked = !$("showGrid").checked;
    } else {
        return;
    }
    requestRender();
});

window.addEventListener("resize", () => { resizeCanvas(); requestRender(); });
$("rebuild").addEventListener("click", build);
$("recenter").addEventListener("click", recenter);
$("showGrid").addEventListener("change", requestRender);
$("showLabels").addEventListener("change", requestRender);

// Auto-rebuild when a construction param is committed (blur/Enter for
// number inputs, toggle for the checkbox) — no need to hit Rebuild. The
// preserved view keeps zoom + position, so the change applies in place.
for (const id of [
    "L", "K", "maxPri", "maxLatPri", "maxLongPri",
    "hInitCol", "vInitRow", "seniorityH",
]) {
    $(id).addEventListener("change", build);
}

function applyQueryParams() {
    const q = new URLSearchParams(window.location.search);
    const setNum = (key, id) => {
        if (!q.has(key)) return;
        const v = q.get(key);
        if (v !== "") $(id).value = v;
    };
    setNum("L", "L");
    setNum("K", "K");
    setNum("maxPri", "maxPri");
    setNum("maxLatPri", "maxLatPri");
    setNum("maxLongPri", "maxLongPri");
    setNum("hInitCol", "hInitCol");
    setNum("vInitRow", "vInitRow");
    if (q.get("seniority") === "h") $("seniorityH").checked = true;
    if (q.has("grid")) $("showGrid").checked = q.get("grid") !== "0";
    if (q.has("labels")) $("showLabels").checked = q.get("labels") !== "0";
    const cx = q.has("cx") ? Number(q.get("cx")) : undefined;
    const cy = q.has("cy") ? Number(q.get("cy")) : undefined;
    const px = q.has("px") ? Number(q.get("px")) : undefined;
    if (cx !== undefined || cy !== undefined || px !== undefined) {
        pendingView = { cx, cy, px };
    }
}

applyQueryParams();
resizeCanvas();
requestAnimationFrame(frame);
build();
