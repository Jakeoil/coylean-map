import { Propagation } from "coylean/core";
import { buildScaffold } from "./scaffold.mjs";
import { tile } from "./tile.mjs";
import { makeTileBitmap, autoMaxPri } from "./render.mjs";

let scaffold = null;
let full = null;

const $ = (id) => document.getElementById(id);

function fmt(n) { return n.toLocaleString(); }
function ms(t) { return `${t.toFixed(1)} ms`; }
function mb(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function readParams() {
    const L = Number($("L").value);
    const K = Number($("K").value);
    const maxPriInput = $("maxPri").value.trim();
    const maxPri = maxPriInput ? Number(maxPriInput) : autoMaxPri(L);
    if (!Number.isInteger(L) || L < 2) throw new Error("L must be ≥ 2");
    if (!Number.isInteger(K) || K < 1) throw new Error("K must be ≥ 1");
    if (L % K !== 0) throw new Error(`L=${L} not divisible by K=${K}`);
    return { L, K, maxPri };
}

function drawSeams(scaffold) {
    const { L, K, nBlocks, hSeams, vSeams } = scaffold;
    const hCv = $("hSeamsCv");
    const wpx = Math.max(256, Math.min(768, L));
    const hpx = Math.max(80, (nBlocks + 1) * 14);
    hCv.width = wpx;
    hCv.height = hpx;
    const hCtx = hCv.getContext("2d");
    hCtx.fillStyle = "#fff";
    hCtx.fillRect(0, 0, wpx, hpx);
    const cellW = wpx / L;
    const cellH = (hpx - 2) / (nBlocks + 1);
    hCtx.fillStyle = "#202020";
    for (let k = 0; k <= nBlocks; k++) {
        const seam = hSeams[k];
        const y = 1 + k * cellH;
        for (let i = 0; i < L; i++) {
            if (seam[i]) hCtx.fillRect(i * cellW, y, Math.max(1, cellW), cellH - 1);
        }
    }
    hCtx.strokeStyle = "rgba(40,70,140,0.5)";
    hCtx.lineWidth = 1;
    for (let k = 0; k <= nBlocks; k++) {
        hCtx.strokeRect(0.5, 0.5 + k * cellH, wpx - 1, cellH - 1);
    }

    const vCv = $("vSeamsCv");
    const vw = Math.max(80, (nBlocks + 1) * 14);
    const vh = Math.max(256, Math.min(768, L));
    vCv.width = vw;
    vCv.height = vh;
    const vCtx = vCv.getContext("2d");
    vCtx.fillStyle = "#fff";
    vCtx.fillRect(0, 0, vw, vh);
    const vCellH = vh / L;
    const vCellW = (vw - 2) / (nBlocks + 1);
    vCtx.fillStyle = "#202020";
    for (let k = 0; k <= nBlocks; k++) {
        const seam = vSeams[k];
        const x = 1 + k * vCellW;
        for (let j = 0; j < L; j++) {
            if (seam[j]) vCtx.fillRect(x, j * vCellH, vCellW - 1, Math.max(1, vCellH));
        }
    }
    vCtx.strokeStyle = "rgba(40,70,140,0.5)";
    for (let k = 0; k <= nBlocks; k++) {
        vCtx.strokeRect(0.5 + k * vCellW, 0.5, vCellW - 1, vh - 1);
    }
}

function drawTileAt(canvas, propagation, K) {
    const bitmap = makeTileBitmap(propagation, K);
    canvas.width = K;
    canvas.height = K;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0);
    canvas.style.width = `${Math.min(384, Math.max(192, K * 2))}px`;
    canvas.style.height = canvas.style.width;
}

function drawReferenceTile(canvas, full, k1, k2, K) {
    canvas.width = K;
    canvas.height = K;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, K, K);
    ctx.fillStyle = "#202020";
    const r0 = k1 * K;
    const c0 = k2 * K;
    for (let j = 0; j < K; j++) {
        const row = full.downMatrix[r0 + j];
        for (let i = 0; i < K; i++) {
            if (row[c0 + i]) ctx.fillRect(i, j, 1, 1);
        }
    }
    for (let i = 0; i < K; i++) {
        const col = full.rightMatrix[c0 + i];
        for (let j = 0; j < K; j++) {
            if (col[r0 + j]) ctx.fillRect(i, j, 1, 1);
        }
    }
    canvas.style.width = `${Math.min(384, Math.max(192, K * 2))}px`;
    canvas.style.height = canvas.style.width;
}

function compareTile(t, full, k1, k2, K) {
    let mismatches = 0;
    for (let j = 0; j < K; j++) {
        for (let i = 0; i < K; i++) {
            const r = k1 * K + j;
            const c = k2 * K + i;
            if (t.downMatrix[j][i] !== full.downMatrix[r][c]) mismatches++;
            if (t.rightMatrix[i][j] !== full.rightMatrix[c][r]) mismatches++;
        }
    }
    return mismatches;
}

function refreshTile() {
    if (!scaffold) return;
    const { K, nBlocks } = scaffold;
    let k1 = Number($("k1").value) | 0;
    let k2 = Number($("k2").value) | 0;
    k1 = Math.max(0, Math.min(nBlocks - 1, k1));
    k2 = Math.max(0, Math.min(nBlocks - 1, k2));
    $("k1").value = k1;
    $("k2").value = k2;
    const t = tile(scaffold, k1, k2);
    drawTileAt($("tileCv"), t, K);
    if (full) {
        drawReferenceTile($("refCv"), full, k1, k2, K);
        const mismatches = compareTile(t, full, k1, k2, K);
        const cmp = $("tileCmp");
        cmp.className = `check ${mismatches === 0 ? "pass" : "fail"}`;
        cmp.textContent = mismatches === 0
            ? "✓ matches reference"
            : `✗ ${mismatches} cells differ`;
    } else {
        $("refCv").getContext("2d").clearRect(0, 0, $("refCv").width, $("refCv").height);
        $("tileCmp").textContent = "(reference not built)";
        $("tileCmp").className = "check";
    }
}

async function run() {
    let params;
    try {
        params = readParams();
    } catch (e) {
        $("stats").textContent = `ERROR: ${e.message}`;
        return;
    }
    const { L, K, maxPri } = params;
    $("run").disabled = true;
    $("verifyBtn").disabled = true;
    $("stats").textContent = `Building scaffold L=${L} K=${K} maxPri=${maxPri}...`;
    await new Promise((r) => requestAnimationFrame(r));

    const tScaf0 = performance.now();
    scaffold = buildScaffold({ L, K, maxPri });
    const tScaf = performance.now() - tScaf0;

    let tFull = null;
    full = null;
    if (L * L <= 4_194_304) {
        $("stats").textContent = (
            `Built scaffold in ${ms(tScaf)}. Building full L×L reference...`
        );
        await new Promise((r) => requestAnimationFrame(r));
        const tFull0 = performance.now();
        full = new Propagation({
            numRows: L, numColumns: L,
            hInitCol: 1, vInitRow: 1, maxPri,
        });
        tFull = performance.now() - tFull0;
    }

    const seamBooleans = 2 * (scaffold.nBlocks + 1) * L;
    const fullCells = 2 * L * L;
    const ratio = fullCells / seamBooleans;
    const lines = [
        `L = ${fmt(L)}    K = ${fmt(K)}    blocks = ${scaffold.nBlocks}×${scaffold.nBlocks}    maxPri = ${maxPri}`,
        `seam booleans: ${fmt(seamBooleans)} (~${mb(seamBooleans)} naive @ 1 B/bool)`,
        `full arrow count if materialised: ${fmt(fullCells)} (~${mb(fullCells)})`,
        `compression ratio: ${ratio.toFixed(1)}× fewer booleans than full`,
        `scaffold build:   ${ms(tScaf)}`,
        tFull !== null
            ? `full L×L build:   ${ms(tFull)}    (verification available)`
            : `full L×L build:   skipped (L too large for safe verify)`,
    ];
    $("stats").textContent = lines.join("\n");

    drawSeams(scaffold);
    $("k1").max = scaffold.nBlocks - 1;
    $("k2").max = scaffold.nBlocks - 1;
    $("redrawTile").disabled = false;
    if (full) $("verifyBtn").disabled = false;
    $("run").disabled = false;
    refreshTile();
}

async function verifyAll() {
    if (!full || !scaffold) return;
    $("verifyBtn").disabled = true;
    const { K, nBlocks } = scaffold;
    let mismatches = 0;
    const t0 = performance.now();
    for (let k1 = 0; k1 < nBlocks; k1++) {
        for (let k2 = 0; k2 < nBlocks; k2++) {
            mismatches += compareTile(tile(scaffold, k1, k2), full, k1, k2, K);
        }
    }
    const dt = performance.now() - t0;
    const cmp = $("tileCmp");
    if (mismatches === 0) {
        cmp.className = "check pass";
        cmp.textContent = `✓ all ${nBlocks * nBlocks} tiles match (${ms(dt)})`;
    } else {
        cmp.className = "check fail";
        cmp.textContent = `✗ ${mismatches} mismatched cells across the grid`;
    }
    $("verifyBtn").disabled = false;
}

$("run").addEventListener("click", run);
$("verifyBtn").addEventListener("click", verifyAll);
$("redrawTile").addEventListener("click", refreshTile);
$("k1").addEventListener("change", refreshTile);
$("k2").addEventListener("change", refreshTile);

run();
