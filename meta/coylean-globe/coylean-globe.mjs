// Unbounded Coylean Globe — the Coylean map wound onto a sphere with no
// longitude repetition. Each column spans 2π/D radians (same cell scale as the
// flat map); successive turns expose NEW columns, so spinning east raises the
// winding number τ without bound. The branch point (the maximum-priority axis:
// prime meridian + equator) is parked at the back; the spiral's cut lives there
// and may peek over the poles.
//
// Two tiers (see meta/coylean-globe/NOTES_coylean_globe.md), both in renderLines():
//   * Skeleton — high-priority meridians/parallels drawn straight from the
//     dyadic priority arrays alone (no propagation). Guarantees the large-scale
//     structure at any zoom.
//   * Texture — actual down/right arrows for EVERY line, reconstructed INSTANTLY
//     by substitution descent (superglyphs/cell-descent.mjs): interior cells
//     from the glyph, the senior wall cell from its bar (both exact). No
//     propagation. Drawn when cells clear TEXTURE_PX; skeleton is the fallback.
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
} from "coylean/core";
import { makeCellUniverse } from "../superglyphs/cell-descent.mjs";
import { ORBIT_V, ORBIT_H, codeKey } from "../superglyphs/tests/rules.mjs";
import { computeGlyphMatrices } from "../../glyphs/glyph-core.js";

// Glyph arrow matrices, cached per code+seniority (the actual Coylean segments a
// section draws once its tiles are big enough — the map, not just the swatch).
const glyphMxCache = new Map();
function glyphMatrices(code, senH) {
    const k = code[0] + "," + code[1] + (senH ? "h" : "v");
    let m = glyphMxCache.get(k);
    if (!m) {
        const sen = senH ? Seniority.horizontal() : Seniority.vertical();
        m = computeGlyphMatrices(code[0], code[1], sen, 1, 1);
        glyphMxCache.set(k, m);
    }
    return m;
}

// Orbit hue per glyph (universe.html dive colouring): the glyph's orbit index
// spun by the golden angle. Seniority picks the orbit table (V vs H).
function orbitHue(code, senH) {
    const tbl = senH ? ORBIT_H : ORBIT_V;
    return ((tbl[codeKey(code)] ?? 0) * 137.508) % 360;
}

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const divisionSelect = document.getElementById("division");
const extentSelect = document.getElementById("extent");
// Line emphasis + draw density are sliding-ruler widgets (meta/sliding-ruler).
// The ruler snaps to integers and would crowd over a wide range, so both run in
// scaled units: emphasis ×10 (4..26 → 0.4..2.6), density ×20 (4..45 → 80..900).
const emphasisRuler = document.getElementById("emphasisRuler");
const densityRuler = document.getElementById("densityRuler");
const zoomRuler = document.getElementById("zoomRuler");
const cellPxRuler = document.getElementById("cellPxRuler");
const washAlphaRuler = document.getElementById("washAlphaRuler");
const budgetRuler = document.getElementById("budgetRuler");
let lineScale = 1.1;
let density = 340;
// Phase 2 — zoomPoint: the drawn tile size (px) at which the next finer level is
// revealed globally. Raise it to split while tiles are large; 1 ≈ today's floor.
let zoomPoint = 1;
// Phase 3 — seniority stagger: the senior orientation (downs under V, rights
// under H) reveals this many levels ahead of the junior, so zoom-in splits one
// orientation then the other. 0.5 = the vertical/horizontal tie-break half-level.
const STAGGER = 0.5;
const showSkeletonCb = document.getElementById("showSkeleton");
const showTextureCb = document.getElementById("showTexture");
const latBtn = document.getElementById("latBtn");
const longBtn = document.getElementById("longBtn");
const senBtn = document.getElementById("senBtn");
const orientLabel = document.getElementById("orientLabel");

const mapInfo = document.getElementById("mapInfo");
const badge = document.getElementById("badge");
const shareUrl = document.getElementById("shareUrl");
const copyUrl = document.getElementById("copyUrl");
const gotoE = document.getElementById("gotoE");
const gotoS = document.getElementById("gotoS");
const gotoZ = document.getElementById("gotoZ");
const gotoBtn = document.getElementById("gotoBtn");

// Division = columns per full turn (one circumference). Powers of two.
for (let n = 3; n <= 20; n++) {
    const div = 2 ** n;
    const opt = document.createElement("option");
    opt.value = div;
    opt.textContent = `${div}  (2^${n} cols / turn)`;
    // More cells/turn → more zoom-in subdivision levels before the 2^32 floor
    // (≈ log2(D) levels), at the cost of fewer turns. 2^18 → ~9 levels, ~16k turns.
    if (div === 262144) opt.selected = true;
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
// Below this on-screen cell size, draw straight skeleton (cheap) instead of the
// per-cell texture. Higher = texture only once cells are genuinely big (so the
// dense zoomed-out view stays skeleton and fast).
const TEXTURE_PX = 5;
// ── Orbit-tile dive (universe.html on the sphere) ─────────────────────────────
// As you zoom, the render depth climbs and glyph sections subdivide into four,
// each filled with its orbit hue — so detail keeps EMERGING instead of cells just
// magnifying. depth = MAX_ORDER − log2(TARGET_SECTION_PX / scale); a section at
// depth d spans 2^(MAX_ORDER−d) finest cells. Drawn only below TEXTURE_PX (above
// it the real arrows take over). See NOTES_zoom_crowding.md.
const TARGET_SECTION_PX = 34; // on-screen size a section aims for
const ARROW_MIN_PX = 22; // above this a section draws arrows; below, a swatch
// Priority-line emphasis (the dive's line model). Every segment is a dyadic line
// at RELATIVE priority p (absolute valuation − depth base level), so the look is
// scale-invariant. Width ramps ~linearly in p (log-faithful) capped at LW_CAP so
// the axis is only a touch above the top cage; it scales with sLocal (on-screen
// sub-cell size) so emphasis fades with distance. alpha fades a line in by its
// on-screen SPACING (2^p·sLocal): senior (wide) first, junior up as you zoom;
// the Line-emphasis dial shifts that threshold. Tune to taste.
// `let` so the sidebar Tuning inputs can adjust them live.
let LW_BASE = 0.05, LW_SLOPE = 0.05, LW_CAP = 7;
let REVEAL_LO = 2.4, REVEAL_RANGE = 2.6;
let EMPH_GAIN = 1.6, EMPH_MID = 1.2; // Line-emphasis dial (lineScale) → reveal bias
// ── Density tier config ───────────────────────────────────────────────────────
// Sub-pixel LOD: when cells are below TEXTURE_PX the lines go coarse and large
// areas read blank. Fill them with a per-cage density wash — alpha ∝ the glyph's
// line count (down+right, 0..17), so the empty glyph V_00/H_00 → alpha 0 → bare
// sphere (blank areas stay visible as sphere, never missed). Same colour as the
// lines, so a dense region reads as a wash the lines resolve out of.
// Density wash is disabled for now (the glyph-density tiles didn't look good);
// the code + dials are kept, just gated off. Flip to true to bring it back.
const DENSITY_WASH_ON = false;
// Tunable via the sidebar dials (sliding-rulers), so `let` not `const`.
let DENSITY_CELL_PX = 6; // target on-screen size of one density cage
let DENSITY_BUDGET = 14000; // max cages/frame — coarsen the level to fit
let DENSITY_ALPHA = 0.9; // alpha of the densest cage (17/17); 00 → 0
// Finest order: 2^MAX_ORDER columns, centred → winding is effectively unbounded.
// Capped at 32 (= DEFAULT_MAX_PRI): column offsets stay within ±2^32, so finite
// columns top out at pri 31 and only the origin reaches the capped pri 32 — the
// ∞ branch axis stays unique, so the winding never repeats. (At 40 the columns
// past ±2^32 aliased onto pri 32 and collided with the axis.) Still 2^32 columns
// = millions of non-repeating turns, with deep zoom carried by the inner cell
// levels rather than a huge Division. See NOTES_zoom_crowding.md (Coordinate
// budget). Cells are instant substitution descent (superglyphs/cell-descent.mjs).
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
    const band = bisectBand(seed, lon);
    // Latitude does NOT wind (only longitude does), and Mercator saturates fast —
    // even ±a few hundred rows of the front-centre spans the whole visible ±90°.
    // On the unbounded 2^MAX_ORDER grid the far rows all pile up at the poles
    // (front-facing, on-screen), so `band` can be billions wide; cap it so the
    // per-cell texture loop (drawTextureMeridian) never runs away.
    const CAP = 1024;
    return {
        lo: Math.max(band.lo, seed - CAP),
        hi: Math.min(band.hi, seed + CAP),
    };
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
// Phase 1 — local-drawn-size suppression (NOTES_zoom_crowding.md). A level-p
// line's drawn spacing is 2^p·cellArcPx·cos(lat): meridians converge and
// parallels compress by the SAME cos(lat) toward the poles. It clears the
// visibility floor where that spacing ≥ ~1px (the density budget = effPx0), i.e.
// cos(lat) ≥ cmin = 2^-p / effPx0. So level p lives in |lat| ≤ acos(cmin): fine
// levels hug the equator, coarse levels reach the poles — the poles declutter on
// their own. Returns the row band [lo,hi] for level p, intersected with `rows`.
// At the equator cos(lat)=1 ≥ cmin for every p ≥ floor, so equatorial output is
// unchanged; the band only clips poleward. (cos-of-longitude limb foreshortening
// — the other "distance" crowding — is a later refinement.)
function latBand(p, effPx0, rows) {
    const cmin = 2 ** -p / effPx0;
    if (cmin >= 1) return { lo: 1, hi: 0 }; // sub-floor even at the equator
    const half = mercatorYFromLat(Math.acos(cmin)) / dLon(); // |rows| from equator
    const c = src.axisRow + 0.5;
    return {
        lo: Math.max(rows.lo, Math.ceil(c - half)),
        hi: Math.min(rows.hi, Math.floor(c + half)),
    };
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
    // Sample evenly in LATITUDE, not row: latOf is Mercator, so even-in-row
    // clusters points at the poles and starves the mid-latitudes (faceted
    // arcs). Even-in-lat gives a smooth great-circle meridian at any band width.
    const latLo = latOf(rowLo), latHi = latOf(rowHi);
    const pts = [];
    for (let s = 0; s <= samples; s++) {
        pts.push([lon, latLo + ((latHi - latLo) * s) / samples]);
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

// Is a front-facing pole within ~one canvas of the screen? Near a visible pole
// every meridian fans onto the screen (all longitudes converge there), so the
// equatorial column clip below MUST be disabled or the polar caps show only a
// central wedge — the "north/south not full 360°" gap. Margin = one canvas
// dimension: only when a pole is that far off-screen (deep zoom on a non-polar
// patch) is the clip safe, and there it pays for itself.
function poleNearScreen() {
    for (const lat of [Math.PI / 2, -Math.PI / 2]) {
        const [px, py, pz] = spherePoint(0, lat); // longitude irrelevant at a pole
        const [x, y, z] = rotatePoint(px, py, pz);
        if (z < -0.05) continue; // back-facing pole: its fan is hidden
        const [sx, sy] = project(x, y, z);
        if (sx >= -width && sx <= 2 * width && sy >= -height && sy <= 2 * height)
            return true;
    }
    return false;
}

// Column window for a frame: the full ±D/2 turn, narrowed to the on-screen
// front columns only when the globe overflows the canvas AND no pole is near
// (see poleNearScreen). Drawing off-screen meridians is otherwise just wasted
// projection at high zoom.
function colClip(cols) {
    if (radius <= width / 2 || poleNearScreen()) {
        return { clo: cols.lo, chi: cols.hi };
    }
    const aMax = Math.asin(Math.min(1, width / (1.9 * radius)));
    const half = Math.ceil(aMax / dLon()) + 8;
    return {
        clo: Math.max(cols.lo, Math.round(cols.center - half)),
        chi: Math.min(cols.hi, Math.round(cols.center + half)),
    };
}

// Unified line render. Per dyadic level p ≥ floor, draw each visible meridian
// and parallel: its TRUE gapped arrows reconstructed instantly by descent when
// cells clear TEXTURE_PX (interior cells from the glyph, the senior wall from
// its bar — both exact), else a straight skeleton line from priorities alone
// (zoomed out, or texture off). Thin first / thick last. Everything is instant.
function renderLines(lineScale, density, cols, rows, samp) {
    const { hInitCol0, vInitRow0, maxPri } = src;
    // Phase 2: the global uniform base level. zoomPoint is the drawn tile size
    // (px) at which the next finer level is revealed — pMin is the finest level
    // whose equatorial cell is already ≥ zoomPoint, so it drops a step each time
    // cells double (a coherent split-into-four everywhere at once). It only ever
    // RAISES the floor above the density-driven minimum, so zoomPoint=1 keeps the
    // old look and higher values reveal later (split while tiles are larger).
    //
    // Phase 3: split the floor per orientation — downs ride the meridians, rights
    // the parallels. The senior orientation (V → downs, H → rights) reveals at
    // zoomPoint; the junior waits ×2^STAGGER (a higher effective zoomPoint), so
    // zoom-in splits one orientation then the other, hand-drawing order.
    const pMinAt = (zp) =>
        Math.max(minPriFloor(density),
            Math.max(0, Math.ceil(Math.log2(zp / cellArcPx()))));
    const merSenior = !curSeniorityH; // V seniority → downs (meridians) lead
    const floorM = pMinAt(zoomPoint * (merSenior ? 1 : 2 ** STAGGER));
    const floorP = pMinAt(zoomPoint * (merSenior ? 2 ** STAGGER : 1));
    const floor = Math.min(floorM, floorP);
    const skel = showSkeletonCb.checked;
    // Texture (the actual gapped arrows) is instant via descent, but it's PER-CELL
    // work, so only when cells are genuinely big (TEXTURE_PX). Skeleton otherwise.
    const wantTex = showTextureCb.checked && cellArcPx() >= TEXTURE_PX;
    const subSamp = Math.max(2, Math.min(64, Math.ceil(cellArcPx() / 6)));

    // Per-cell / per-row work (texture + parallels) is bounded to a tight band
    // around the front-centre row — the rest of the wide `rows` band is sub-pixel
    // near the poles and would explode the cost at high Division. Meridian ARCS
    // still use the full `rows` band (samp points, cheap) so they reach the poles.
    const seedRow = Math.round(
        src.axisRow + 0.5 - mercatorYFromLat(rotX) / dLon());
    const TEX_HALF = 160;
    const tLo = Math.max(rows.lo, seedRow - TEX_HALF);
    const tHi = Math.min(rows.hi, seedRow + TEX_HALF);

    // Column window: on-screen front columns when zoomed in, full ±D/2 turn when
    // the globe fits OR a pole is near (the fan needs every longitude) — colClip.
    const { clo, chi } = colClip(cols);
    const effPx0 = cellArcPx() * (density / 340); // equatorial pixel budget

    for (let p = floor; p <= maxPri; p++) {
        // Phase 1: confine this level to the latitude band where it isn't
        // crowded. Meridian arcs clip to it; parallels outside it are dropped.
        const band = latBand(p, effPx0, rows);
        if (band.lo > band.hi) continue;
        const tbLo = Math.max(tLo, band.lo), tbHi = Math.min(tHi, band.hi);
        // Visual weight of priority p. Capped: maxPri is now 32 (the infinity
        // sentinel), but the axis/walls shouldn't balloon — cap at the old
        // ceiling (~11) so thickness/alpha tops out at a sane bold, not a slab.
        const rv = Math.min(p + 1, 12);
        const colThick = (0.22 + rv * 0.34) * lineScale;
        const colAlpha = Math.min(0.16 + rv * 0.07, 0.82);
        const cIdx = // downs reveal at floorM (Phase 3 stagger)
            p >= floorM ? indicesAtLevel(p, hInitCol0, clo, chi, maxPri) : [];
        for (const c of cIdx) {
            // Meridians carry the branch-cut age tint (violet new / red old).
            const cColor = meridianColor(c, cols.center, colAlpha);
            if (wantTex) {
                if (tbLo <= tbHi)
                    drawTextureMeridian(c, tbLo, tbHi, colThick, cColor, subSamp);
            } else if (skel) {
                strokeArc(
                    meridianPoints(c, band.lo, band.hi, samp.meridian),
                    colThick,
                    cColor,
                );
            }
        }
        const rowThick = (0.2 + rv * 0.3) * lineScale;
        const rowAlpha = Math.min(0.14 + rv * 0.065, 0.76);
        const rColor = normalColor(rowAlpha);
        // Parallels: on-screen tight band ∩ the level's latitude band, and only
        // at/under the parallel reveal floor (rights reveal at floorP — Phase 3).
        const rIdx = p >= floorP && tbLo <= tbHi
            ? indicesAtLevel(p, vInitRow0, tbLo, tbHi, maxPri) : [];
        for (const r of rIdx) {
            if (wantTex) {
                drawTextureParallel(r, clo, chi, rowThick, rColor, subSamp);
            } else if (skel) {
                strokeArc(
                    parallelPoints(r, clo, chi, samp.parallel),
                    rowThick,
                    rColor,
                );
            }
        }
    }
}

// Sub-pixel density wash. When cells are below TEXTURE_PX the lines are coarse
// and the gaps read blank; tile the visible sphere with cage-density quads so
// you see WHERE the fine map is dense vs empty. Cage level is picked so a cage is
// ~DENSITY_CELL_PX on screen (the ladder), then coarsened until the cage count
// fits DENSITY_BUDGET. alpha = density/17 · DENSITY_ALPHA; 00 (the unique empty
// glyph, and its ancestors) → alpha 0 → skipped → bare sphere shows through.
function drawDensity(cols, rows) {
    const arc = cellArcPx();
    if (arc >= TEXTURE_PX) return; // cells big enough for real lines/texture
    const cu = src.cu;
    const maxLevel = cu.depth - cu.seedDepth;

    // Same column window as renderLines (full turn near a pole — see colClip).
    const { clo, chi } = colClip(cols);

    // Level so a cage ≈ DENSITY_CELL_PX on screen, then coarsen to fit the budget.
    let level = Math.round(Math.log2(DENSITY_CELL_PX / Math.max(arc, 1e-6))) - 2;
    level = Math.max(0, Math.min(maxLevel, level));
    let span = 1 << (level + 2);
    while (
        level < maxLevel &&
        (Math.floor((chi - clo) / span) + 1) *
            (Math.floor((rows.hi - rows.lo) / span) + 1) >
            DENSITY_BUDGET
    ) {
        level++;
        span = 1 << (level + 2);
    }

    const half = span / 2;
    const cageArcPx = span * arc;
    const [cr, cg, cb] = NORMAL_RGB;
    const c0 = Math.floor(clo / span) * span;
    const r0 = Math.floor(rows.lo / span) * span;
    for (let gc = c0; gc <= chi; gc += span) {
        const lon = lonOf(gc + half);
        for (let gr = r0; gr <= rows.hi; gr += span) {
            const den = cu.densityAt(gr + half, gc + half, level);
            if (den === 0) continue; // empty cage → leave the sphere bare
            const [px, py, pz] = spherePoint(lon, latOf(gr + half));
            const [x, y, z] = rotatePoint(px, py, pz);
            if (z < -0.02) continue; // back face
            const [sx, sy] = project(x, y, z);
            const sz = cageArcPx * (3 / (3 - z)) * dpr; // perspective size
            const a = (den / cu.densityMax) * DENSITY_ALPHA;
            ctx.fillStyle = `rgba(${cr},${cg},${cb},${a.toFixed(3)})`;
            ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
        }
    }
}

// Project a cell-space (lon, lat) to screen, or null if back-facing.
function projCell(lon, lat) {
    const [px, py, pz] = spherePoint(lon, lat);
    const [x, y, z] = rotatePoint(px, py, pz);
    if (z < -0.02) return null;
    return project(x, y, z);
}

const emphAmt = () => (lineScale - EMPH_MID) * EMPH_GAIN; // dial → reveal bias

// Stroke the current path as a priority-`relP` line. Width ramps with relP and
// scales with sLocal (the on-screen sub-cell size); alpha fades the line in by
// its on-screen spacing (relP + log2 sLocal vs the reveal threshold + emphasis),
// so senior lines appear first and junior ones fade up as you zoom. Walls carry
// a seniority brightness; arrows are the plain map colour.
function strokeAtPriority(relP, sLocal, emph, wall) {
    const a = (relP + Math.log2(Math.max(sLocal, 1e-3)) - REVEAL_LO + emph)
        / REVEAL_RANGE;
    if (a <= 0.012) return; // below the reveal floor — leave it invisible
    const alpha = Math.min(1, a).toFixed(3);
    // sLocal is already device-px (scale = radius·dLon), so no ×dpr here.
    ctx.lineWidth = (LW_BASE + LW_SLOPE * Math.min(relP, LW_CAP)) * sLocal;
    ctx.strokeStyle = wall
        ? `hsl(214 38% ${66 + Math.min(relP, 6) * 4}% / ${alpha})`
        : `rgba(226,238,255,${alpha})`;
    ctx.stroke();
}

// Draw a section's glyph as Coylean arrow segments on the sphere — each glyph
// segment (universe.html's catalog convention) becomes a short meridian/parallel
// arc. Grouped by line (column / row) so each gets its own priority width/alpha.
// baseLevel = log2(sub): subtracted from absolute valuation → relative priority.
function drawSectionGlyph(code, baseC, baseR, cps, senH, sLocal, emph) {
    const { downMatrix, rightMatrix } = glyphMatrices(code, senH);
    const sub = cps / 4; // finest cells per glyph sub-cell
    for (let gx = 0; gx < 3; gx++) { // interior down-lines, one priority each
        const col = baseC + (gx + 1) * sub;
        // Relative priority from the sub-cell GRID position (anchor-agnostic):
        // the glyph's middle line (gx 1) is the 2×2 divider (relP 1), the cell
        // lines (gx 0,2) are relP 0. Cages (the 4×4 boundary) come in at relP 2+.
        const relP = pri(gx + 1, 40);
        const lon = lonOf(col);
        ctx.beginPath();
        let any = false;
        for (let gy = 0; gy <= 3; gy++) {
            if (!downMatrix[gy][gx]) continue;
            const p0 = projCell(lon, latOf(baseR + gy * sub));
            const p1 = projCell(lon, latOf(baseR + (gy + 1) * sub));
            if (p0 && p1) { ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); any = true; }
        }
        if (any) strokeAtPriority(relP, sLocal, emph, false);
    }
    for (let gy = 0; gy < 3; gy++) { // interior right-lines
        const row = baseR + (gy + 1) * sub;
        const relP = pri(gy + 1, 40);
        const lat = latOf(row);
        ctx.beginPath();
        let any = false;
        for (let gx = 0; gx <= 3; gx++) {
            if (!rightMatrix[gx][gy]) continue;
            const p0 = projCell(lonOf(baseC + gx * sub), lat);
            const p1 = projCell(lonOf(baseC + (gx + 1) * sub), lat);
            if (p0 && p1) { ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); any = true; }
        }
        if (any) strokeAtPriority(relP, sLocal, emph, false);
    }
}

// A section's senior cage bars: east wall (meridian at the right edge) + south
// wall (parallel at the bottom), each a high-priority line — same priority model
// (relative p, width/alpha), so the cage hierarchy reads as the senior end of the
// same ramp and the axis is its top.
function drawSectionWalls(C, R, cps, d, sLocal, emph) {
    const cu = src.cu;
    if (cu.wallEastAt(R, C, d)) {
        // Cage seniority = how senior this section boundary is in the section
        // grid (v2 of the index), +2 so the 4×4 glyph boundary is relP 2, 8×8 is
        // 3, 16×16 is 4 … the axis (a power-of-two index) saturates the cap.
        const relP = 2 + pri(C + 1, 40);
        const col = (C + 1) * cps;
        const le = lonOf(col);
        const p0 = projCell(le, latOf(R * cps));
        const p1 = projCell(le, latOf((R + 1) * cps));
        if (p0 && p1) {
            ctx.beginPath();
            ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]);
            strokeAtPriority(relP, sLocal, emph, true);
        }
    }
    if (cu.wallSouthAt(R, C, d)) {
        const relP = 2 + pri(R + 1, 40);
        const row = (R + 1) * cps;
        const ls = latOf(row);
        const p0 = projCell(lonOf(C * cps), ls);
        const p1 = projCell(lonOf((C + 1) * cps), ls);
        if (p0 && p1) {
            ctx.beginPath();
            ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]);
            strokeAtPriority(relP, sLocal, emph, true);
        }
    }
}

// The dive: glyph sections at a zoom-derived depth, subdividing into four as you
// zoom in (universe.html ported to the sphere). Big tiles draw the real Coylean
// ARROWS over a faint orbit tint; small ones a solid orbit swatch. Only below
// TEXTURE_PX — closer in, renderLines' per-cell texture takes over. The depth
// climbs with zoom, so finer structure keeps emerging, not just bigger cells.
function renderSections(cols) {
    const scale = cellArcPx(); // px per finest cell
    if (scale <= 0) return;
    const cu = src.cu;
    if (typeof cu.glyphAtD !== "function") return; // stale module → skip, don't blank
    const MO = cu.maxOrder;
    // Depth from zoom; clamp so sections never span more than a fraction of a
    // turn (coarse cap) and never finer than the descent's leaves.
    const coarse = Math.max(cu.seedDepth, MO - Math.floor(Math.log2(src.division)) + 2);
    let d = Math.round(MO - Math.log2(TARGET_SECTION_PX / scale));
    d = Math.max(coarse, Math.min(cu.depth, d));
    const cps = 2 ** (MO - d); // finest cells per section side
    const senH = curSeniorityH;
    const secPx = cps * scale; // a section's equatorial on-screen size

    // Column window from colClip; row window bounded to the visible SCREEN in
    // section units (NOT the texture-capped `rows`, which is a thin band at high
    // Division). Per-tile culling drops the off-screen / back-facing rest.
    const { clo, chi } = colClip(cols);
    const c0 = Math.floor(clo / cps), c1 = Math.floor(chi / cps);
    const seedRow = src.axisRow + 0.5 - mercatorYFromLat(rotX) / dLon();
    const seedSec = Math.floor(seedRow / cps);
    const halfSec = Math.min(600, Math.ceil(height / Math.max(secPx, 1)) + 2);
    const r0 = Math.max(0, seedSec - halfSec), r1 = seedSec + halfSec;
    const drawArrows = secPx >= ARROW_MIN_PX;
    const emph = emphAmt();
    for (let C = c0; C <= c1; C++) {
        const lon = lonOf((C + 0.5) * cps);
        for (let R = r0; R <= r1; R++) {
            const code = cu.glyphAtD(R, C, d);
            const empty = code[0] === 0 && code[1] === 0;
            const [px, py, pz] = spherePoint(lon, latOf((R + 0.5) * cps));
            const [x, y, z] = rotatePoint(px, py, pz);
            if (z < -0.02) continue; // back face
            const [sx, sy] = project(x, y, z);
            const persp = 3 / (3 - z);
            const sz = cps * scale * persp * 1.04; // device-px section size
            if (sx < -sz || sx > width + sz || sy < -sz || sy > height + sz) continue;
            const sLocal = (cps / 4) * scale * persp; // on-screen sub-cell size
            if (drawArrows) {
                if (!empty)
                    drawSectionGlyph(code, C * cps, R * cps, cps, senH, sLocal, emph);
                drawSectionWalls(C, R, cps, d, sLocal, emph); // cage bars
            } else if (!empty) {
                // too small for arrows: a solid orbit swatch carries structure
                ctx.fillStyle = `hsl(${orbitHue(code, senH)} 58% 52% / 0.8)`;
                ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
            }
        }
    }
}

function draw() {
    if (!width || !height || !src) return;

    clearAndDrawSphere();

    const cols = visibleColRange();
    // The dive (renderSections) is now the sole map renderer — glyph sections /
    // arrows / cage bars at a zoom-derived depth, continuous to the finest. The
    // old renderLines (priority gridlines + per-cell texture) is retired here; its
    // line-emphasis / density / zoom-point dials are inert for now. (Branch-cut
    // age tint and the axis line lived there — re-add to the dive if wanted.)
    renderSections(cols);

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
    // Fixed-point [16 outer | 16 inner] address of the centre cell (#2 spec):
    // the absolute index split at bit 16 — outer = winds/pole base cell, inner =
    // sub-cell. Type the E/S offsets above into Go-to to land back here.
    const colIdx = src.axisCol + eastCols, rowIdx = src.axisRow + southRows;
    const fp = (n) => `${Math.floor(n / 65536)}:${((n % 65536) + 65536) % 65536}`;
    mapInfo.textContent =
        `Unbounded centred universe, axis at (${src.axisCol}, ${src.axisRow}),` +
        ` maxPri ${src.maxPri}. One turn = ${src.division} columns.` +
        ` Centre cell [E ${fp(colIdx)} | S ${fp(rowIdx)}] (16|16).`;
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
    zoom = Math.max(0.45, Math.min(1e6, next));
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
[showSkeletonCb, showTextureCb].forEach((el) =>
    el.addEventListener("change", requestRender),
);
emphasisRuler.addEventListener("change", (e) => {
    lineScale = e.detail.value / 10;
    requestRender();
});
densityRuler.addEventListener("change", (e) => {
    density = e.detail.value * 20;
    requestRender();
});
zoomRuler.addEventListener("change", (e) => {
    zoomPoint = e.detail.value;
    requestRender();
});
// Mouse wheel over a ruler nudges its value — driven from outside the widget
// (no slider-code changes): track the current ruler integer in our state, step
// it, and push it back via the `value` attribute (→ the widget's setValue).
function wheelNudge(el, getUnit, setFromUnit, lo, hi) {
    el.addEventListener("wheel", (e) => {
        e.preventDefault();
        const v = Math.max(lo, Math.min(hi, getUnit() + (e.deltaY < 0 ? 1 : -1)));
        setFromUnit(v);
        el.setAttribute("value", v);
        requestRender();
    }, { passive: false });
}
wheelNudge(emphasisRuler, () => Math.round(lineScale * 10),
    (v) => (lineScale = v / 10), 4, 26);
wheelNudge(densityRuler, () => Math.round(density / 20),
    (v) => (density = v * 20), 4, 45);
wheelNudge(zoomRuler, () => Math.round(zoomPoint),
    (v) => (zoomPoint = v), 1, 160);
// Density-wash dials: cage px (direct), alpha (×10), budget (×1000).
cellPxRuler.addEventListener("change", (e) => {
    DENSITY_CELL_PX = e.detail.value;
    requestRender();
});
washAlphaRuler.addEventListener("change", (e) => {
    DENSITY_ALPHA = e.detail.value / 10;
    requestRender();
});
budgetRuler.addEventListener("change", (e) => {
    DENSITY_BUDGET = e.detail.value * 1000;
    requestRender();
});
wheelNudge(cellPxRuler, () => Math.round(DENSITY_CELL_PX),
    (v) => (DENSITY_CELL_PX = v), 3, 16);
wheelNudge(washAlphaRuler, () => Math.round(DENSITY_ALPHA * 10),
    (v) => (DENSITY_ALPHA = v / 10), 2, 10);
wheelNudge(budgetRuler, () => Math.round(DENSITY_BUDGET / 1000),
    (v) => (DENSITY_BUDGET = v * 1000), 2, 40);
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

// ── Jump-to-cell (#2 nav) ─────────────────────────────────────────────────────
// Centre the view on the finest cell at (east, south) offset from the prime
// axis, optionally at a zoom. Inverts the HUD readout: eastCols = -(rotY+π/2)/dLon
// and southRows = -mercatorY(rotX)/dLon. east/south are full 32-bit cell offsets
// (= winds·D + column, with the low 16 bits the inner sub-cell), so any of the
// 2^32 cells is one jump away — no dragging through turns. rotX self-clamps to a
// pole via latFromMercatorY's atan range.
function goToCell(east, south, z) {
    rotY = -Math.PI / 2 - east * dLon();
    rotX = latFromMercatorY(-south * dLon());
    if (Number.isFinite(z) && z > 0) setZoom(z);
    else requestRender();
}
gotoBtn.addEventListener("click", () => {
    const e = Math.trunc(Number(gotoE.value)) || 0;
    const s = Math.trunc(Number(gotoS.value)) || 0;
    const z = Number(gotoZ.value);
    goToCell(e, s, z);
});

// Live tuning inputs for the line-emphasis constants (dev knobs; reset on reload).
for (const [id, set] of [
    ["tuneLwBase", (v) => (LW_BASE = v)],
    ["tuneLwSlope", (v) => (LW_SLOPE = v)],
    ["tuneLwCap", (v) => (LW_CAP = v)],
    ["tuneRevealLo", (v) => (REVEAL_LO = v)],
    ["tuneRevealRange", (v) => (REVEAL_RANGE = v)],
    ["tuneEmphGain", (v) => (EMPH_GAIN = v)],
    ["tuneEmphMid", (v) => (EMPH_MID = v)],
]) {
    const el = document.getElementById(id);
    el?.addEventListener("input", () => {
        const v = Number(el.value);
        if (Number.isFinite(v)) { set(v); requestRender(); }
    });
}

// ── Shareable URL ─────────────────────────────────────────────────────────────
const roundTo = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

function applyParams() {
    const p = new URLSearchParams(location.search);
    const setVal = (el, key) => {
        if (p.has(key)) el.value = p.get(key);
    };
    setVal(divisionSelect, "div");
    setVal(extentSelect, "ext");
    const num = (key, cur) => {
        const v = Number(p.get(key));
        return p.has(key) && Number.isFinite(v) ? v : cur;
    };
    rotX = num("rotx", rotX);
    rotY = num("roty", rotY);
    zoom = num("zoom", zoom);
    // Rulers: restore the state vars and seed each widget's initial value (read
    // by the component when it inits a frame later).
    lineScale = num("scale", lineScale);
    density = num("density", density);
    zoomPoint = num("zpt", zoomPoint);
    emphasisRuler.setAttribute("value", Math.round(lineScale * 10));
    densityRuler.setAttribute("value", Math.round(density / 20));
    zoomRuler.setAttribute("value", Math.round(zoomPoint));
    DENSITY_CELL_PX = num("dcell", DENSITY_CELL_PX);
    DENSITY_ALPHA = num("dalpha", DENSITY_ALPHA);
    DENSITY_BUDGET = num("dbudget", DENSITY_BUDGET);
    cellPxRuler.setAttribute("value", Math.round(DENSITY_CELL_PX));
    washAlphaRuler.setAttribute("value", Math.round(DENSITY_ALPHA * 10));
    budgetRuler.setAttribute("value", Math.round(DENSITY_BUDGET / 1000));
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
    p.set("scale", roundTo(lineScale, 1));
    p.set("density", Math.round(density));
    p.set("zpt", Math.round(zoomPoint));
    p.set("dcell", Math.round(DENSITY_CELL_PX));
    p.set("dalpha", roundTo(DENSITY_ALPHA, 2));
    p.set("dbudget", Math.round(DENSITY_BUDGET));
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
