// Unbounded Coylean Globe — the Coylean map wound onto a sphere with no
// longitude repetition. Each column spans 2π/D radians (same cell scale as the
// flat map); successive turns expose NEW columns, so spinning east raises the
// winding number τ without bound. The branch point (the maximum-priority axis:
// prime meridian + equator) is parked at the back; the spiral's cut lives there
// and may peek over the poles.
//
// Two tiers (see meta/NOTES_coylean_globe.md), both in renderLines():
//   * Skeleton — high-priority meridians/parallels drawn straight from the
//     dyadic priority arrays alone (no propagation). Guarantees the large-scale
//     structure at any zoom.
//   * Texture — actual down/right arrows for the pri ≤ 1 interior lines,
//     reconstructed INSTANTLY by substitution descent (superglyphs/cell-descent
//     .mjs), no propagation. Drawn when cells clear TEXTURE_PX; the senior cage
//     walls (pri ≥ 2, incl. the axis) stay skeleton — they don't break anyway.
//
// Source: an UNBOUNDED centred universe, seeded with Propagation.fromUniverse-
// Extents and grown by the translation table — instant random access to any
// cell, no O((2W)²) boundary seed, no lazy build. maxPri = 32 makes the origin
// the infinity sentinel, the unique priority maximum over all columns (so the
// winding never repeats). Verified in Node: descent == fromUniverseExtents.

import {
    pri,
    Seniority,
    DEFAULT_MAX_PRI,
} from "../coylean-explorer/coylean-core.js";
import { makeCellUniverse } from "./superglyphs/cell-descent.mjs";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const divisionSelect = document.getElementById("division");
const extentSelect = document.getElementById("extent");
const lineScaleInput = document.getElementById("lineScale");
const densityInput = document.getElementById("density");
const showSkeletonCb = document.getElementById("showSkeleton");
const showTextureCb = document.getElementById("showTexture");
const latBtn = document.getElementById("latBtn");
const longBtn = document.getElementById("longBtn");
const senBtn = document.getElementById("senBtn");
const orientLabel = document.getElementById("orientLabel");

const lineScaleValue = document.getElementById("lineScaleValue");
const densityValue = document.getElementById("densityValue");
const mapInfo = document.getElementById("mapInfo");
const badge = document.getElementById("badge");
const shareUrl = document.getElementById("shareUrl");
const copyUrl = document.getElementById("copyUrl");

// Division = columns per full turn (one circumference). Powers of two.
for (let n = 3; n <= 14; n++) {
    const div = 2 ** n;
    const opt = document.createElement("option");
    opt.value = div;
    opt.textContent = `${div}  (2^${n} cols / turn)`;
    if (div === 64) opt.selected = true;
    divisionSelect.appendChild(opt);
}

// Extent = cells per side of the centred universe (half-width W). The map is
// 2W × 2W; the boundary seed costs O((2W)^2) up front, so this is capped.
for (let n = 8; n <= 13; n++) {
    const w = 2 ** n;
    const opt = document.createElement("option");
    opt.value = w;
    opt.textContent = `${w}  (${2 * w}² map)`;
    if (w === 1024) opt.selected = true;
    extentSelect.appendChild(opt);
}

// ── View state ──────────────────────────────────────────────────────────────
let width = 0,
    height = 0,
    radius = 0,
    dpr = 1;
// rotY accumulates UNBOUNDED (no mod 2π) — it is the winding control. rotY =
// π/2 parks the axis (φ = 0) at the back of the globe.
// Start at the origin (0, 0): the prime meridian × equator — the branch point
// (max-priority axis) — at front centre. rotY = −π/2 lands the prime meridian
// (φ = 0) at the front; rotX = 0 lands the equator there. The branch cut then
// sits a half-turn away on the far side (back), out of view until you spin.
const INITIAL_ROTX = 0;
const INITIAL_ROTY = -Math.PI / 2;
let rotX = INITIAL_ROTX;
let rotY = INITIAL_ROTY;
let zoom = 1;
// +1 = last spin was eastward (front column increasing), -1 = westward. Sets
// which side of the branch cut is "new" (emerging) vs "old" (fading).
let spinDir = 1;
let dragging = false;
let pinching = false;
let lastX = 0,
    lastY = 0;
const pointers = new Map();
let lastPinchDistance = 0;

// ── Texture tier config ───────────────────────────────────────────────────────
// Below this on-screen cell size, draw straight skeleton (no per-cell reads).
const TEXTURE_PX = 1.3;
// Finest order: 2^MAX_ORDER columns, centred → winding is effectively unbounded.
// The cell source is instant substitution descent (superglyphs/cell-descent.mjs),
// so there is no O((2W)²) boundary seed and no lazy build — only the tiny seed.
const MAX_ORDER = 32;
// Render only when something changed; drainWork progress + interaction flip it.
let needsRender = true;
function requestRender() {
    needsRender = true;
}

// ── Orientation: anchor (lat = vInitRow, long = hInitCol) + seniority ─────────
// Each of lat/long toggles 0↔1; seniority toggles V↔H. The four anchors are the
// canonical quadrant family; the big label names the orientation: lat 1→S/0→N,
// long 1→E/0→W, V seniority names N–S first (SE/NE/SW/NW), H names E–W first
// (ES/EN/WS/WN).
let curHInitCol = 1; // longitude anchor
let curVInitRow = 1; // latitude anchor
let curSeniorityH = false; // false = V, true = H

function orientationLabel(vInitRow, hInitCol, seniorityH) {
    const ns = vInitRow === 1 ? "S" : "N";
    const ew = hInitCol === 1 ? "E" : "W";
    return seniorityH ? ew + ns : ns + ew;
}

// ── Source descriptor (the map's dyadic frame + instant cell descent) ─────────
let src = null;

// `_extent` (the old Extent control) is now vestigial: the universe is unbounded,
// seeded instantly by cell-descent — no extent to choose. Kept in the signature
// so the callers/UI need no change.
function buildSource(division, _extent, hInitCol, vInitRow, seniorityH) {
    const seniority = seniorityH
        ? Seniority.horizontal()
        : Seniority.vertical();
    // Unbounded centred universe via instant substitution descent: seeded with
    // fromUniverseExtents, no boundary seed, no lazy build (cell-descent.mjs).
    const cu = makeCellUniverse({
        hInitCol,
        vInitRow,
        seniority,
        maxOrder: MAX_ORDER,
    });
    const center = cu.center; //          2^(MAX_ORDER-1), the origin cell
    const numCols = 2 * center; //        = 2^MAX_ORDER (effectively unbounded)
    const numRows = 2 * center;
    const axisCol = center - hInitCol; //  unique max-priority meridian
    const axisRow = center - vInitRow;
    const hInitCol0 = hInitCol - center; // colPri(c)=pri(c+hInitCol0) peaks at axis
    const vInitRow0 = vInitRow - center;
    // maxPri = 32: the origin is the infinity sentinel, unique over all columns
    // (finite valuations top out at 31), so winding never repeats — unbounded.
    src = {
        division,
        numCols,
        numRows,
        axisCol,
        axisRow,
        hInitCol0,
        vInitRow0,
        maxPri: DEFAULT_MAX_PRI,
        cu,
    };
    return src;
}

// Down/right arrow at global cell (gr, gc) — instant, by substitution descent
// (cell-descent.mjs). Interior cells only; the 4th col/row of each cage is a
// senior wall (pri ≥ 2), which renders as skeleton, never texture (see
// renderLines), so it is never asked of these.
function downAt(gr, gc) {
    return src.cu.downAt(gr, gc);
}
function rightAt(gr, gc) {
    return src.cu.rightAt(gr, gc);
}

function colPri(c) {
    return pri(c + src.hInitCol0, src.maxPri);
}
function rowPri(r) {
    return pri(r + src.vInitRow0, src.maxPri);
}

// ── Sphere geometry (ported from ruler-grid-sphere.mjs) ───────────────────────
function rotatePoint(x, y, z) {
    const cy = Math.cos(rotY),
        sy = Math.sin(rotY);
    const cx = Math.cos(rotX),
        sx = Math.sin(rotX);
    const x1 = cy * x + sy * z;
    const z1 = -sy * x + cy * z;
    const y1 = cx * y - sx * z1;
    const z2 = sx * y + cx * z1;
    return [x1, y1, z2];
}

function project(x, y, z) {
    const camera = 3.0;
    const scale = camera / (camera - z);
    return [width / 2 + x * radius * scale, height / 2 - y * radius * scale, z];
}

function spherePoint(lon, lat) {
    const clat = Math.cos(lat);
    return [clat * Math.cos(lon), Math.sin(lat), clat * Math.sin(lon)];
}

function latFromMercatorY(y) {
    return Math.atan(Math.sinh(y));
}

function mercatorYFromLat(lat) {
    return Math.log(Math.tan(Math.PI / 4 + lat / 2));
}

// ── Cell-index → sphere coordinate (winding longitude, Mercator latitude) ─────
// Absolute (unbounded) longitude of a column; spherePoint's cos/sin wraps it.
// NEGATED so EAST (increasing column → increasing distance east) sweeps to the
// RIGHT on screen, matching the flat map and ruler-grid-sphere. The propagation
// (right-arrows flowing east) then runs rightward.
function dLon() {
    return (2 * Math.PI) / src.division;
}
// Lines are drawn at cell centre (index + 0.5), so the axis reference carries
// +0.5 too — the two cancel, putting the axis column/row exactly on lon/lat 0
// (matches ruler-grid-sphere). Without it the prime meridian / equator land
// half a cell off — glaring at low D where a cell spans tens of degrees.
function lonOf(col) {
    return -(col - (src.axisCol + 0.5)) * dLon();
}
// Mercator y with square cells (dy = dLon); equator at axisRow, south positive
// (increasing row → south → bottom of screen).
function latOf(row) {
    return latFromMercatorY(-(row - (src.axisRow + 0.5)) * dLon());
}

// The front-most point faces the camera at longitude φ = rotY + π/2 (from
// rotatePoint). With the negated lon that inverts to a column. We draw a FULL
// turn around the centre (± D/2 columns = 360°), not just the front hemisphere,
// so looking down a pole shows all longitudes (not a half-disk) and the branch
// cut — where the two ends of the wind meet, D columns apart — appears on the
// far side. Back-face culling hides whatever is genuinely behind the globe.
function visibleColRange() {
    const center = src.axisCol - (rotY + Math.PI / 2) / dLon();
    const half = src.division / 2 + 2; // full turn + margin
    const lo = Math.max(0, Math.floor(center - half));
    const hi = Math.min(src.numCols - 1, Math.ceil(center + half));
    return { lo, hi, center };
}

// Is a cell at row `r` (front-centre longitude) both front-facing AND on
// screen? The on-screen clamp bounds the band at high zoom, where the front
// hemisphere runs far past the canvas edges.
function rowFrontFacing(r, lon) {
    const [px, py, pz] = spherePoint(lon, latOf(r));
    const [x, y, z] = rotatePoint(px, py, pz);
    if (z < -0.05) return false;
    const sy = project(x, y, z)[1];
    const m = height * 0.08;
    return sy >= -m && sy <= height + m;
}

// Rows whose parallels are on the front hemisphere AND on screen. The
// front-most latitude is exactly the pitch rotX (from the rotation algebra), so
// the row at screen centre is analytic — a robust seed at any zoom. The visible
// set is contiguous in row (lat monotonic, no fold on the front face), so
// expand each edge from the seed.
function visibleRowRange() {
    const lon = lonOf(visibleColRange().center + 0.5);
    const { axisRow, numRows } = src;
    // latOf(row) = 0 at row = axisRow + 0.5, so invert to that frame.
    let seed = Math.round(axisRow + 0.5 - mercatorYFromLat(rotX) / dLon());
    seed = Math.max(0, Math.min(numRows - 1, seed));
    return bisectBand(seed, lon);
}

function bisectBand(seed, lon) {
    const { numRows } = src;
    // Walk the lower edge (toward row 0) and upper edge (toward numRows-1).
    let lo = seed;
    let step = 1;
    while (lo - step >= 0 && rowFrontFacing(lo - step, lon)) {
        lo -= step;
        step *= 2;
    }
    for (let s = Math.floor(step / 2); s >= 1; s = Math.floor(s / 2)) {
        if (lo - s >= 0 && rowFrontFacing(lo - s, lon)) lo -= s;
    }
    let hi = seed;
    step = 1;
    while (hi + step < numRows && rowFrontFacing(hi + step, lon)) {
        hi += step;
        step *= 2;
    }
    for (let s = Math.floor(step / 2); s >= 1; s = Math.floor(s / 2)) {
        if (hi + s < numRows && rowFrontFacing(hi + s, lon)) hi += s;
    }
    return { lo: Math.max(0, lo - 1), hi: Math.min(numRows - 1, hi + 1) };
}

// No build phase any more — cells are instant by descent. Kept as a no-op so
// the rAF loop needs no change.
function drainWork() {
    return false;
}

// ── Priority level-of-detail ──────────────────────────────────────────────────
// On-screen arc width of one column at the front (≈ one equatorial row cell).
function cellArcPx() {
    return radius * dLon();
}
// Draw lines whose dyadic priority clears a floor that drops as you zoom in:
// lines of priority ≥ p are spaced 2^p cells, so they stay ≥ 1px apart when
// 2^p · cellPx ≥ 1. Density scales the effective pixel budget.
function minPriFloor(density) {
    const effPx = cellArcPx() * (density / 340);
    return Math.max(0, Math.ceil(-Math.log2(Math.max(effPx, 1e-6))));
}

// Indices in [lo, hi] congruent to `base` modulo `step`.
function congruent(base, step, lo, hi) {
    const out = [];
    let first = base + step * Math.ceil((lo - base) / step);
    for (let v = first; v <= hi; v += step) out.push(v);
    return out;
}
const mod = (a, n) => ((a % n) + n) % n;

// Columns / rows of EXACTLY priority p within [lo, hi]. For p < maxPri the
// index n = idx + off satisfies n ≡ 2^p (mod 2^{p+1}); for the capped top
// level n ≡ 0 (mod 2^maxPri).
function indicesAtLevel(p, off, lo, hi, maxPri) {
    if (p >= maxPri) {
        const step = 2 ** maxPri;
        return congruent(mod(-off, step), step, lo, hi);
    }
    const step = 2 ** (p + 1);
    return congruent(mod(2 ** p - off, step), step, lo, hi);
}

// ── Branch-cut age tint ───────────────────────────────────────────────────────
// The branch cut sits at the back, at the window edges (col = centre ± D/2,
// one full turn apart). A meridian within ~5° of the cut is coloured by age:
//   * leading edge (new, just emerged): brightest violet → fades to the normal
//     line colour as it ages away from the cut;
//   * trailing edge (old, about to vanish): normal → darkens to red → fades to
//     transparent right at the cut.
// Which edge is new/old follows spinDir (the last rotation). Returns
// [r, g, b, alphaMult] or null for the normal colour.
const NORMAL_RGB = [215, 236, 255];
const VIOLET_RGB = [200, 120, 255];
const RED_RGB = [255, 80, 80];
const CUT_RAMP = 5 / 360; // 5° on either side, in turns…
const CUT_RAMP_MIN_COLS = 4; // …but at least a few columns so it stays visible

function mix3(a, b, t) {
    return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t),
    ];
}

function branchTint(col, center, dir) {
    const ramp = Math.max(CUT_RAMP, CUT_RAMP_MIN_COLS / src.division);
    const u = (col - center) / src.division; // [-0.5, 0.5] within the window
    const dHigh = 0.5 - u; // turns to the high (east) edge
    const dLow = u + 0.5; // turns to the low (west) edge
    const dNew = dir >= 0 ? dHigh : dLow; // eastward → new at the high edge
    const dOld = dir >= 0 ? dLow : dHigh;
    if (dNew >= 0 && dNew < ramp) {
        const age = dNew / ramp; // 0 newest → 1 normal
        return [...mix3(VIOLET_RGB, NORMAL_RGB, age), 1];
    }
    if (dOld >= 0 && dOld < ramp) {
        const t = dOld / ramp; // 0 at the cut → 1 normal
        if (t >= 0.4) return [...mix3(RED_RGB, NORMAL_RGB, (t - 0.4) / 0.6), 1];
        return [...RED_RGB, t / 0.4]; // red, alpha fading to 0 at the cut
    }
    return null;
}

function normalColor(alpha) {
    return `rgba(${NORMAL_RGB[0]},${NORMAL_RGB[1]},${NORMAL_RGB[2]},${alpha})`;
}

// Colour for meridian `col`: the branch-cut tint if within range, else normal.
function meridianColor(col, center, alpha) {
    const t = branchTint(col, center, spinDir);
    if (!t) return normalColor(alpha);
    return `rgba(${t[0]},${t[1]},${t[2]},${(alpha * t[3]).toFixed(3)})`;
}

// ── Drawing ───────────────────────────────────────────────────────────────────
function strokeArc(points, thickness, color) {
    ctx.beginPath();
    let started = false;
    for (const [lon, lat] of points) {
        const [px, py, pz] = spherePoint(lon, lat);
        const [x, y, z] = rotatePoint(px, py, pz);
        const [sx, sy] = project(x, y, z);
        if (z < -0.03) {
            started = false;
            continue;
        }
        if (!started) {
            ctx.moveTo(sx, sy);
            started = true;
        } else {
            ctx.lineTo(sx, sy);
        }
    }
    ctx.lineWidth = thickness * dpr;
    ctx.strokeStyle = color;
    ctx.stroke();
}

function meridianPoints(col, rowLo, rowHi, samples) {
    const lon = lonOf(col + 0.5);
    const pts = [];
    for (let s = 0; s <= samples; s++) {
        const row = rowLo + ((rowHi - rowLo) * s) / samples;
        pts.push([lon, latOf(row)]);
    }
    return pts;
}

function parallelPoints(row, colLo, colHi, samples) {
    const lat = latOf(row + 0.5);
    const pts = [];
    for (let s = 0; s <= samples; s++) {
        const col = colLo + ((colHi - colLo) * s) / samples;
        pts.push([lonOf(col), lat]);
    }
    return pts;
}

// Texture meridian: stroke column `gc`'s actual down-arrows as a polyline that
// breaks wherever an arrow is absent (the flow turned) or rounds to the back.
// Each present arrow spans its cell (row gr ± 0.5). subSamp smooths the arc.
function drawTextureMeridian(gc, grLo, grHi, thickness, color, subSamp) {
    const lon = lonOf(gc + 0.5);
    ctx.beginPath();
    let started = false;
    for (let gr = grLo; gr <= grHi; gr++) {
        if (!downAt(gr, gc)) {
            started = false;
            continue;
        }
        for (let s = 0; s <= subSamp; s++) {
            const lat = latOf(gr - 0.5 + s / subSamp);
            const [px, py, pz] = spherePoint(lon, lat);
            const [x, y, z] = rotatePoint(px, py, pz);
            const [sx, sy] = project(x, y, z);
            if (z < -0.03) {
                started = false;
                continue;
            }
            if (!started) {
                ctx.moveTo(sx, sy);
                started = true;
            } else {
                ctx.lineTo(sx, sy);
            }
        }
    }
    ctx.lineWidth = thickness * dpr;
    ctx.strokeStyle = color;
    ctx.stroke();
}

// Texture parallel: row `gr`'s actual right-arrows, breaking on absence.
function drawTextureParallel(gr, gcLo, gcHi, thickness, color, subSamp) {
    const lat = latOf(gr + 0.5);
    ctx.beginPath();
    let started = false;
    for (let gc = gcLo; gc <= gcHi; gc++) {
        if (!rightAt(gr, gc)) {
            started = false;
            continue;
        }
        for (let s = 0; s <= subSamp; s++) {
            const lon = lonOf(gc - 0.5 + s / subSamp);
            const [px, py, pz] = spherePoint(lon, lat);
            const [x, y, z] = rotatePoint(px, py, pz);
            const [sx, sy] = project(x, y, z);
            if (z < -0.03) {
                started = false;
                continue;
            }
            if (!started) {
                ctx.moveTo(sx, sy);
                started = true;
            } else {
                ctx.lineTo(sx, sy);
            }
        }
    }
    ctx.lineWidth = thickness * dpr;
    ctx.strokeStyle = color;
    ctx.stroke();
}

function clearAndDrawSphere() {
    ctx.clearRect(0, 0, width, height);
    const grad = ctx.createRadialGradient(
        width * 0.42,
        height * 0.33,
        radius * 0.15,
        width * 0.5,
        height * 0.5,
        radius * 1.2,
    );
    grad.addColorStop(0, "rgba(70,100,145,.95)");
    grad.addColorStop(0.65, "rgba(30,39,57,.98)");
    grad.addColorStop(1, "rgba(11,14,22,1)");
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();
}

// Unified line render. Per dyadic level p ≥ floor, draw each visible meridian
// and parallel: for pri ≤ 1 interior lines, its TRUE gapped arrows reconstructed
// instantly by descent when cells clear TEXTURE_PX; otherwise (senior walls, or
// zoomed out) a straight skeleton line from priorities alone. Thin first / thick
// last. Everything is instant — no build wait.
function renderLines(lineScale, density, cols, rows, samp) {
    const { hInitCol0, vInitRow0, maxPri } = src;
    const floor = minPriFloor(density);
    const skel = showSkeletonCb.checked;
    // Texture is instant now (descent), so it's available whenever cells are big
    // enough. But only the pri ≤ 1 INTERIOR lines have reconstructable cells; the
    // senior cage walls (pri ≥ 2, incl. the axis) stay skeleton — solid lines
    // that, being the highest priority around, don't actually break anyway.
    const wantTex = showTextureCb.checked && cellArcPx() >= TEXTURE_PX;
    // Sub-samples per cell scale with the cell's on-screen arc, so big cells at
    // low D stay smooth curves instead of polygons (capped to bound cost).
    const subSamp = Math.max(2, Math.min(64, Math.ceil(cellArcPx() / 6)));

    for (let p = floor; p <= maxPri; p++) {
        const rv = p + 1;
        const colThick = (0.22 + rv * 0.34) * lineScale;
        const colAlpha = Math.min(0.16 + rv * 0.07, 0.82);
        for (const c of indicesAtLevel(p, hInitCol0, cols.lo, cols.hi, maxPri)) {
            // Meridians carry the branch-cut age tint (violet new / red old).
            const cColor = meridianColor(c, cols.center, colAlpha);
            if (wantTex && p <= 1) {
                drawTextureMeridian(
                    c, rows.lo, rows.hi, colThick, cColor, subSamp,
                );
            } else if (skel) {
                strokeArc(
                    meridianPoints(c, rows.lo, rows.hi, samp.meridian),
                    colThick,
                    cColor,
                );
            }
        }
        const rowThick = (0.2 + rv * 0.3) * lineScale;
        const rowAlpha = Math.min(0.14 + rv * 0.065, 0.76);
        const rColor = normalColor(rowAlpha);
        for (const r of indicesAtLevel(p, vInitRow0, rows.lo, rows.hi, maxPri)) {
            if (wantTex && p <= 1) {
                drawTextureParallel(
                    r, cols.lo, cols.hi, rowThick, rColor, subSamp,
                );
            } else if (skel) {
                strokeArc(
                    parallelPoints(r, cols.lo, cols.hi, samp.parallel),
                    rowThick,
                    rColor,
                );
            }
        }
    }
}

function draw() {
    if (!width || !height || !src) return;

    const lineScale = Number(lineScaleInput.value);
    const density = Number(densityInput.value);
    lineScaleValue.textContent = lineScale.toFixed(1);
    densityValue.textContent = `${density}`;

    clearAndDrawSphere();

    const cols = visibleColRange();
    const rows = visibleRowRange();
    const detail = Math.max(1, zoom);
    const samp = {
        meridian: Math.min(
            6000,
            Math.round(Math.max(60, Math.min(420, density * 0.7)) * detail),
        ),
        parallel: Math.min(
            8000,
            Math.round(Math.max(120, Math.min(640, density)) * detail),
        ),
    };

    renderLines(lineScale, density, cols, rows, samp);

    updateHud(density);
    syncURL();
}

function updateHud(density) {
    const tex = cellArcPx() >= TEXTURE_PX ? "texture" : "skeleton";
    // Signed distance of the screen-centre cell from the prime meridian /
    // equator. East (increasing column) and south (increasing row) positive.
    const frontCol = visibleColRange().center;
    const eastCols = Math.round(frontCol - src.axisCol);
    const southRows = Math.round(-mercatorYFromLat(rotX) / dLon());
    const sgn = (n) => (n >= 0 ? `+${n}` : `${n}`);
    const tau = rotY / (2 * Math.PI);
    badge.textContent =
        `E ${sgn(eastCols)} · S ${sgn(southRows)} cells from prime` +
        ` · τ ${tau.toFixed(2)} · ${tex} · z ${zoom.toFixed(2)}`;
    mapInfo.textContent =
        `Unbounded centred universe, axis at (${src.axisCol}, ${src.axisRow}),` +
        ` maxPri ${src.maxPri}. One turn = ${src.division} columns.` +
        ` Instant by descent — no build, no edge.`;
}

// ── Interaction ───────────────────────────────────────────────────────────────
function resize() {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    width = Math.floor(rect.width * dpr);
    height = Math.floor(rect.height * dpr);
    canvas.width = width;
    canvas.height = height;
    radius = Math.min(width, height) * 0.39 * zoom;
    requestRender();
}

function setZoom(next) {
    zoom = Math.max(0.45, Math.min(64, next));
    radius = Math.min(width, height) * 0.39 * zoom;
    requestRender();
}

// rAF loop: spend a budget building visible tiles, then redraw if anything
// changed (interaction, zoom, or build progress). Idle frames are cheap.
function frame() {
    if (width && height && src) {
        const cols = visibleColRange();
        const rows = visibleRowRange();
        if (drainWork(cols, rows)) needsRender = true;
    }
    if (needsRender) {
        draw();
        needsRender = false;
    }
    requestAnimationFrame(frame);
}

function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return [(e.clientX - rect.left) * dpr, (e.clientY - rect.top) * dpr];
}

function pinchDistance() {
    const pts = [...pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
}

canvas.addEventListener(
    "wheel",
    (e) => {
        e.preventDefault();
        setZoom(zoom * Math.exp(-e.deltaY * 0.0014));
    },
    { passive: false },
);

canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    const [x, y] = pointerPos(e);
    pointers.set(e.pointerId, { x, y });
    if (pointers.size >= 2) {
        pinching = true;
        dragging = false;
        lastPinchDistance = pinchDistance();
    } else {
        dragging = true;
        pinching = false;
        lastX = x;
        lastY = y;
    }
});

canvas.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    const [x, y] = pointerPos(e);
    pointers.set(e.pointerId, { x, y });
    if (pinching && pointers.size >= 2) {
        const dist = pinchDistance();
        if (lastPinchDistance > 0) setZoom((zoom * dist) / lastPinchDistance);
        lastPinchDistance = dist;
        return;
    }
    if (!dragging) return;
    // Horizontal drag spins longitude (rotY, unbounded → winds); vertical drag
    // pitches. Boost the spin by 1/cos(pitch) so it stays usable near a pole.
    const lonGain = 0.9 / Math.max(Math.cos(rotX), 0.1);
    rotY += ((x - lastX) / radius) * lonGain;
    rotX += ((y - lastY) / radius) * 0.9;
    rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));
    // Drag left (x decreasing) winds east (front column increasing).
    if (x !== lastX) spinDir = x < lastX ? 1 : -1;
    lastX = x;
    lastY = y;
    requestRender();
});

function releasePointer(e) {
    pointers.delete(e.pointerId);
    pinching = pointers.size >= 2;
    dragging = pointers.size === 1;
    if (dragging) {
        const p = [...pointers.values()][0];
        lastX = p.x;
        lastY = p.y;
    }
}
canvas.addEventListener("pointerup", releasePointer);
canvas.addEventListener("pointercancel", releasePointer);

window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "0") {
        rotX = INITIAL_ROTX;
        rotY = INITIAL_ROTY;
        zoom = 1;
        radius = Math.min(width, height) * 0.39 * zoom;
        requestRender();
    }
});

function updateOrientUI() {
    latBtn.textContent = `Lat ${curVInitRow}`;
    longBtn.textContent = `Long ${curHInitCol}`;
    senBtn.textContent = `Sen ${curSeniorityH ? "H" : "V"}`;
    orientLabel.textContent = orientationLabel(
        curVInitRow, curHInitCol, curSeniorityH,
    );
}

function rebuild() {
    buildSource(
        Number(divisionSelect.value),
        Number(extentSelect.value),
        curHInitCol,
        curVInitRow,
        curSeniorityH,
    );
    updateOrientUI();
    requestRender();
}

[divisionSelect, extentSelect].forEach((el) =>
    el.addEventListener("change", rebuild),
);
[lineScaleInput, densityInput, showSkeletonCb, showTextureCb].forEach((el) => {
    el.addEventListener("input", requestRender);
    el.addEventListener("change", requestRender);
});
latBtn.addEventListener("click", () => {
    curVInitRow ^= 1;
    rebuild();
});
longBtn.addEventListener("click", () => {
    curHInitCol ^= 1;
    rebuild();
});
senBtn.addEventListener("click", () => {
    curSeniorityH = !curSeniorityH;
    rebuild();
});

// ── Shareable URL ─────────────────────────────────────────────────────────────
const roundTo = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

function applyParams() {
    const p = new URLSearchParams(location.search);
    const setVal = (el, key) => {
        if (p.has(key)) el.value = p.get(key);
    };
    setVal(divisionSelect, "div");
    setVal(extentSelect, "ext");
    setVal(lineScaleInput, "scale");
    setVal(densityInput, "density");
    const num = (key, cur) => {
        const v = Number(p.get(key));
        return p.has(key) && Number.isFinite(v) ? v : cur;
    };
    rotX = num("rotx", rotX);
    rotY = num("roty", rotY);
    zoom = num("zoom", zoom);
    if (p.has("skel")) showSkeletonCb.checked = p.get("skel") !== "0";
    if (p.has("tex")) showTextureCb.checked = p.get("tex") !== "0";
    if (p.get("long") === "0" || p.get("long") === "1")
        curHInitCol = Number(p.get("long"));
    if (p.get("lat") === "0" || p.get("lat") === "1")
        curVInitRow = Number(p.get("lat"));
    if (p.has("sen")) curSeniorityH = p.get("sen") === "h";
}

function buildQuery() {
    const p = new URLSearchParams();
    p.set("div", divisionSelect.value);
    p.set("ext", extentSelect.value);
    p.set("rotx", roundTo(rotX, 4));
    p.set("roty", roundTo(rotY, 4));
    p.set("zoom", roundTo(zoom, 3));
    p.set("scale", lineScaleInput.value);
    p.set("density", densityInput.value);
    p.set("skel", showSkeletonCb.checked ? "1" : "0");
    p.set("tex", showTextureCb.checked ? "1" : "0");
    p.set("lat", curVInitRow);
    p.set("long", curHInitCol);
    p.set("sen", curSeniorityH ? "h" : "v");
    return p.toString();
}

// Build the share link into the sidebar field only — deliberately NOT written
// to the address bar. That keeps a plain refresh on defaults (or on whatever
// link was opened); use Copy link to capture the current view explicitly.
function syncURL() {
    shareUrl.value = `${location.origin}${location.pathname}?${buildQuery()}`;
}

copyUrl.addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(shareUrl.value);
        copyUrl.textContent = "Copied!";
        setTimeout(() => (copyUrl.textContent = "Copy link"), 1200);
    } catch {
        shareUrl.select();
    }
});

window.addEventListener("resize", resize);
applyParams();
buildSource(
    Number(divisionSelect.value),
    Number(extentSelect.value),
    curHInitCol,
    curVInitRow,
    curSeniorityH,
);
updateOrientUI();
resize();
requestAnimationFrame(frame);
