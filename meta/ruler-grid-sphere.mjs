// Ruler grid on a sphere, with an optional Coylean-map projection.
//
// Two render modes (toggle in the sidebar):
//   * "Ruler grid" — dyadic meridians/parallels whose thickness follows the
//     2-adic ruler, optionally capped per axis (maxLongPri / maxLatPri).
//   * "Coylean map" — an actual centred universe integrated via
//     `Propagation.fromUniverseBoundary` over four directly-built quadrants
//     (no Universe.assemble). Longitude cycles (maxLongPri = log2(division));
//     latitude is the uncapped Mercator axis. Down-arrows are drawn as
//     meridian segments, right-arrows as parallel segments, so the map's
//     streamlines replace the ruled grid.

import { Propagation } from "../coylean-explorer/coylean-core.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const divisionSelect = document.getElementById("division");
const renderModeSelect = document.getElementById("renderMode");
const lonCapSelect = document.getElementById("lonCap");
const latCapSelect = document.getElementById("latCap");
const vextInput = document.getElementById("vext");
const lineScaleInput = document.getElementById("lineScale");
const densityInput = document.getElementById("density");

const lineScaleValue = document.getElementById("lineScaleValue");
const densityValue = document.getElementById("densityValue");
const mapInfo = document.getElementById("mapInfo");

for (let n = 1; n <= 14; n++) {
    const div = 2 ** n;
    const opt = document.createElement("option");
    opt.value = div;
    opt.textContent = `${div}  (${n === 1 ? "halves" : n === 2 ? "quarters" : n === 3 ? "eighths" : "1/" + div})`;
    if (div === 64) opt.selected = true;
    divisionSelect.appendChild(opt);
}

// Priority-cap selects. "Off" = full dyadic ruler (unclamped);
// a finite cap clamps v2 so the line pattern repeats every
// 2^cap, mirroring coylean-core's pri(n, maxPri).
const capValue = (v) => (v === "off" ? Infinity : Number(v));
for (const sel of [lonCapSelect, latCapSelect]) {
    const off = document.createElement("option");
    off.value = "off";
    off.textContent = "Off (full ruler)";
    sel.appendChild(off);
    for (let c = 0; c <= 12; c++) {
        const opt = document.createElement("option");
        opt.value = String(c);
        opt.textContent = `${c}  (period ${2 ** c})`;
        sel.appendChild(opt);
    }
}

// Materialising a D×D universe is O(D²) time and memory, so the map mode
// clamps the resolution it integrates. The cycle still follows the *selected*
// division up to this ceiling; above it the map is drawn at MAP_MAX_DIVISION
// and the badge notes the clamp. Rough cost of one (cached) build at the
// ceiling: 4096 ≈ 1.6 s and ~0.7 GB — a one-off freeze on first selection.
const MAP_MAX_DIVISION = 4096;
// Cell budget (numColumns × numRows) for the integrated map, bounding build
// memory/time. vext is trimmed so D × (D·vext) stays under this; at the
// MAP_MAX_DIVISION ceiling it permits exactly vext = 1.
const MAP_MAX_CELLS = MAP_MAX_DIVISION * MAP_MAX_DIVISION;
let mapCache = null;

let width = 0,
    height = 0,
    radius = 0,
    dpr = 1;
let rotX = -0.35;
let rotY = 0.55;
let zoom = 1;
let dragging = false;
let pinching = false;
let lastX = 0,
    lastY = 0;
const pointers = new Map();
let lastPinchDistance = 0;

function resize() {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    width = Math.floor(rect.width * dpr);
    height = Math.floor(rect.height * dpr);
    canvas.width = width;
    canvas.height = height;
    radius = Math.min(width, height) * 0.39 * zoom;
    draw();
}

function rulerValue(i, cap = Infinity) {
    // v2(i): exponent of the largest power of 2 dividing i.
    // Sequence for i = 0..8 after special casing 0:
    // 0,1,2,1,3,1,2,1,4
    //
    // `cap` mirrors coylean-core's pri(n, maxPri): a finite cap
    // clamps v2 so the pattern goes periodic with period 2^cap —
    // a seamless cyclic grid. When capped, i === 0 (and the
    // equator) wrap up to the max level instead of being the
    // skipped axis line that the overlay handles.
    if (i === 0) return cap === Infinity ? 0 : cap + 1;
    let v = 0;
    while ((i & 1) === 0) {
        v++;
        i >>= 1;
    }
    if (cap !== Infinity) v = Math.min(v, cap);
    return v + 1;
}

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
    return [
        width / 2 + x * radius * scale,
        height / 2 - y * radius * scale,
        scale,
        z,
    ];
}

function spherePoint(lon, lat) {
    const clat = Math.cos(lat);
    return [
        clat * Math.cos(lon),
        Math.sin(lat),
        clat * Math.sin(lon),
    ];
}

function drawPolyline(points, thickness, alpha) {
    let started = false;
    ctx.beginPath();

    for (const p of points) {
        const [x, y, z] = rotatePoint(p[0], p[1], p[2]);
        const [sx, sy] = project(x, y, z);

        // Hide the back side. This gives an orientable globe rather than a transparent wireball.
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
    ctx.strokeStyle = `rgba(215,236,255,${alpha})`;
    ctx.stroke();
}

function makeMeridian(lon, latLimit, samples) {
    const pts = [];
    for (let s = 0; s <= samples; s++) {
        const t = s / samples;
        const lat = -latLimit + 2 * latLimit * t;
        pts.push(spherePoint(lon, lat));
    }
    return pts;
}

function makeParallel(lat, samples) {
    const pts = [];
    for (let s = 0; s <= samples; s++) {
        const lon = (2 * Math.PI * s) / samples;
        pts.push(spherePoint(lon, lat));
    }
    return pts;
}

function mercatorYFromLat(lat) {
    return Math.log(Math.tan(Math.PI / 4 + lat / 2));
}

function latFromMercatorY(y) {
    return Math.atan(Math.sinh(y));
}

function squareGridLat(j, division, yLimit) {
    // Equal steps in Mercator y. Since dy = dφ / cos(φ), this compensates
    // for shrinking longitude circles and makes the spherical cells locally square.
    const t = (j / division - 0.5) * 2;
    return latFromMercatorY(t * yLimit);
}

// ── Coylean map projection ────────────────────────────────────────────────

// Build a centred universe and integrate its boundary into one SE-flow
// propagation. Symmetric half-extents put the dyadic axis (max-priority
// column / row — the prime meridian / equator) at the geometric centre.
// maxLongPri = log2(division) makes longitude periodic over exactly
// `division` columns so the map wraps the sphere; maxLatPri is left at its
// default (Mercator axis, never repeats N–S).
//
// The four quadrant propagations are built directly with the canonical
// createUniverseExtents offsets (hInitCol = vInitRow = 1, all-true seeds) and
// handed straight to fromUniverseBoundary. This deliberately avoids
// Universe.create, whose internal assemble() is broken and wasteful — the
// boundary integration is the only consumer and it ignores the mosaic anyway.
// Verified identical to the Universe.create path, ~2× faster.
// `vext` (vertical extent, in circumferences) sets the latitude row count to
// division × vext — so each cell stays square (Mercator-y step = 2π/division =
// the longitude step) and the map reaches further toward the poles as vext
// grows, instead of stretching a fixed row count over a wider degree range.
function buildSphereMap(division, vext) {
    const halfCol = division / 2;
    const halfRow = (division * vext) / 2;
    const maxLongPri = Math.log2(division);
    const quad = (direction, hInitCol, vInitRow) =>
        new Propagation({
            direction,
            numRows: halfRow,
            numColumns: halfCol,
            hInitCol,
            vInitRow,
            maxLongPri,
        });
    const prop = Propagation.fromUniverseBoundary({
        nw: quad("nw", 0, 0),
        ne: quad("ne", 1, 0),
        sw: quad("sw", 0, 1),
        se: quad("se", 1, 1),
    });
    const axisCol = prop.colPriority.indexOf(Math.max(...prop.colPriority));
    const axisRow = prop.rowPriority.indexOf(Math.max(...prop.rowPriority));
    return { division, vext, prop, axisCol, axisRow };
}

function getSphereMap(division, vext) {
    if (
        !mapCache ||
        mapCache.division !== division ||
        mapCache.vext !== vext
    ) {
        mapCache = buildSphereMap(division, vext);
    }
    return mapCache;
}

// Stroke one column's down-arrows as a meridian polyline (constant lon),
// breaking the path wherever an arrow is absent or rounds to the back side.
function drawMapMeridian(i, prop, lonAt, latAt, thickness, alpha, samp) {
    const { downMatrix, numRows } = prop;
    const lon = lonAt(i + 0.5);
    ctx.beginPath();
    let started = false;
    for (let j = 0; j <= numRows; j++) {
        if (!(downMatrix[j] && downMatrix[j][i])) {
            started = false;
            continue;
        }
        for (let s = 0; s <= samp; s++) {
            const lat = latAt(j - 0.5 + s / samp);
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
    ctx.strokeStyle = `rgba(215,236,255,${alpha})`;
    ctx.stroke();
}

// Stroke one row's right-arrows as a parallel polyline (constant lat).
function drawMapParallel(j, prop, lonAt, latAt, thickness, alpha, samp) {
    const { rightMatrix, numColumns } = prop;
    const lat = latAt(j + 0.5);
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= numColumns; i++) {
        if (!(rightMatrix[i] && rightMatrix[i][j])) {
            started = false;
            continue;
        }
        for (let s = 0; s <= samp; s++) {
            const lon = lonAt(i - 0.5 + s / samp);
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
    ctx.strokeStyle = `rgba(215,236,255,${alpha})`;
    ctx.stroke();
}

function drawMap(division, rawVext, lineScale, density) {
    const D = Math.min(division, MAP_MAX_DIVISION);
    // Trim vext so D × (D·vext) stays within the cell budget.
    const vext = Math.max(1, Math.min(rawVext, Math.floor(MAP_MAX_CELLS / (D * D))));
    const { prop, axisCol, axisRow } = getSphereMap(D, vext);
    const yLimit = Math.PI * vext;

    // Cell-index → sphere coordinate, dyadic axes pinned to lon = lat = 0.
    // Coylean latitude is south-positive (increasing row flows south) and
    // longitude is east-positive (increasing column flows east). Both are
    // negated here: spherePoint sweeps the visible face N→S downward already
    // for lat but W→E *leftward* for lon, so the negations land south at the
    // bottom and east to the right — the canonical, un-mirrored orientation.
    // dy = 2π/D, so cells are square regardless of vext.
    const lonAt = (x) => (-2 * Math.PI * (x - (axisCol + 0.5))) / D;
    const dy = (2 * yLimit) / prop.numRows;
    const latAt = (y) => latFromMercatorY(-(y - (axisRow + 0.5)) * dy);

    // Sub-samples per cell. Scales with zoom (≈2 at zoom 1 — unchanged from
    // before — rising as you magnify) but never finer than the on-screen cell
    // size needs (~1 sample / 1.5 device px), so big cells at high zoom stay
    // smooth while sub-pixel cells at high division stay cheap.
    const samp = Math.max(
        2,
        Math.min(
            Math.round(2 * zoom),
            Math.round((2 * Math.PI * radius) / D / 1.5),
        ),
    );

    const { colPriority, rowPriority, numColumns, numRows } = prop;
    // A column's meridian / a row's parallel is as "important" as its dyadic
    // priority (the same pri the ruler grid weights by). Clamp to log2(D):
    // the axis itself is pri = maxPri, drawn anyway by the orientation overlay.
    const pCap = Math.log2(D);
    // Priority level-of-detail. Lines with pri ≥ p number ≈ D / 2^p, so to
    // show ≈ `budget` lines/axis we drop everything below this floor. Without
    // it the map floods to a white ball as D grows — worst vertically, where
    // meridians crowd toward the poles. The budget scales with zoom: you
    // can't resolve 1024 meridians on a small globe, but zooming in makes room
    // for the finer dyadic structure, so higher divisions reveal more detail
    // as you zoom rather than capping the whole-globe view.
    const budget = density * zoom;
    const minPri = Math.max(0, Math.round(Math.log2(D / budget)));

    // Bucket columns / rows by clamped priority.
    const colByPri = new Map();
    for (let i = 0; i < numColumns; i++) {
        const p = Math.min(colPriority[i], pCap);
        if (p < minPri) continue;
        if (!colByPri.has(p)) colByPri.set(p, []);
        colByPri.get(p).push(i);
    }
    const rowByPri = new Map();
    for (let j = 0; j < numRows; j++) {
        const p = Math.min(rowPriority[j], pCap);
        if (p < minPri) continue;
        if (!rowByPri.has(p)) rowByPri.set(p, []);
        rowByPri.get(p).push(j);
    }

    // Thin first, thick last so heavy dyadic lines sit on top — the ruled
    // grid's exact thickness/alpha ramp (rv = pri + 1).
    for (let p = minPri; p <= pCap; p++) {
        const rv = p + 1;
        const colThick = (0.22 + rv * 0.38) * lineScale;
        const colAlpha = Math.min(0.16 + rv * 0.08, 0.82);
        for (const i of colByPri.get(p) ?? []) {
            drawMapMeridian(i, prop, lonAt, latAt, colThick, colAlpha, samp);
        }
        const rowThick = (0.2 + rv * 0.34) * lineScale;
        const rowAlpha = Math.min(0.14 + rv * 0.075, 0.76);
        for (const j of rowByPri.get(p) ?? []) {
            drawMapParallel(j, prop, lonAt, latAt, rowThick, rowAlpha, samp);
        }
    }

    // Lines shown/axis ≈ D / 2^minPri; flag when the LOD is hiding detail
    // that zooming in would reveal.
    const shown = Math.round(D / 2 ** minPri);
    const sizeStr =
        D === division
            ? `${D}×${numRows}`
            : `${D}×${numRows} (D clamped from ${division})`;
    const vextStr =
        vext < rawVext ? `vext ${vext} (clamped from ${rawVext})` : `vext ${vext}`;
    const lodStr =
        minPri > 0 ? ` · ${shown}/axis shown — zoom in for more` : "";
    mapInfo.textContent = `Coylean map · ${sizeStr} · ${vextStr} · cycle 2^${Math.log2(D)}${lodStr}`;
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

function draw() {
    if (!width || !height) return;

    const division = Number(divisionSelect.value);
    const mode = renderModeSelect.value;
    const lonCap = capValue(lonCapSelect.value);
    const latCap = capValue(latCapSelect.value);
    // Vertical extent in circumferences: each unit adds `division` square rows
    // of latitude (Mercator-y span π per side per unit). The grid uses it
    // directly; the map clamps it for memory inside drawMap.
    const vext = Math.max(1, Math.round(Number(vextInput.value) || 1));
    const yLimit = Math.PI * vext;
    const latLimit = latFromMercatorY(yLimit);
    const lineScale = Number(lineScaleInput.value);
    const density = Number(densityInput.value);

    lineScaleValue.textContent = lineScale.toFixed(1);
    densityValue.textContent = `${density}`;

    const isMap = mode === "map";
    // The ruler caps only apply to the grid; grey them out for the map.
    lonCapSelect.disabled = isMap;
    latCapSelect.disabled = isMap;
    mapInfo.style.display = isMap ? "block" : "none";

    clearAndDrawSphere();

    // Sample counts scale with zoom (the on-screen arc length grows with
    // radius ∝ zoom) so meridians/parallels stay smooth when magnified rather
    // than going polygonal. Capped to bound cost at extreme magnification.
    const detail = Math.max(1, zoom);
    const meridianSamples = Math.min(
        6000,
        Math.round(Math.max(80, Math.min(480, Math.floor(density * 0.75))) * detail),
    );
    const parallelSamples = Math.min(
        8000,
        Math.round(Math.max(120, Math.min(720, Math.floor(density * 1.15))) * detail),
    );

    if (isMap) {
        // The map replaces the ruled grid entirely.
        drawMap(division, vext, lineScale, density);
    } else {
        // Latitude has `division × vext` square cells over the Mercator band.
        const latDiv = division * vext;
        const lonStride = Math.max(1, Math.ceil(division / density));
        const latStride = Math.max(1, Math.ceil(latDiv / density));
        const fullRuler = Math.log2(latDiv);
        const maxRuler = Math.max(
            lonCap === Infinity ? fullRuler : lonCap,
            latCap === Infinity ? fullRuler : latCap,
        );

        // Draw thin first, thick last, so important dyadic lines sit on top.
        for (let level = 1; level <= maxRuler + 1; level++) {
            for (let i = 0; i < division; i += lonStride) {
                const rv = rulerValue(i, lonCap);
                if (rv !== level) continue;
                const lon = (2 * Math.PI * i) / division;
                const thickness = (0.22 + rv * 0.38) * lineScale;
                const alpha = Math.min(0.16 + rv * 0.08, 0.82);
                drawPolyline(
                    makeMeridian(lon, latLimit, meridianSamples),
                    thickness,
                    alpha,
                );
            }

            // Latitude parallels: exclude poles. Equal Mercator-y spacing over
            // latDiv rows keeps cells square on the actual sphere.
            for (let j = 1; j < latDiv; j += latStride) {
                const rv = rulerValue(Math.abs(j - latDiv / 2), latCap);
                if (rv !== level) continue;
                const lat = squareGridLat(j, latDiv, yLimit);
                const thickness = (0.2 + rv * 0.34) * lineScale;
                const alpha = Math.min(0.14 + rv * 0.075, 0.76);
                drawPolyline(
                    makeParallel(lat, parallelSamples),
                    thickness,
                    alpha,
                );
            }
        }
    }

    // Equator + prime-meridian orientation overlay — grid mode only. The
    // Coylean map already draws its own equator/prime meridian as the
    // highest-priority row/column (always above the LOD floor), so a solid
    // overlaid cross there would be a spurious continuous line on top of the
    // real streamlines.
    if (!isMap) {
        ctx.save();
        drawPolyline(makeParallel(0, parallelSamples), 1.9 * lineScale, 0.86);
        drawPolyline(
            makeMeridian(0, latLimit, meridianSamples),
            1.9 * lineScale,
            0.86,
        );
        ctx.restore();
    }
}

function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return [
        (e.clientX - rect.left) * dpr,
        (e.clientY - rect.top) * dpr,
    ];
}

function pinchDistance() {
    const pts = [...pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
}

function setZoom(nextZoom) {
    zoom = Math.max(0.45, Math.min(32, nextZoom));
    radius = Math.min(width, height) * 0.39 * zoom;
    draw();
}

canvas.addEventListener(
    "wheel",
    (e) => {
        e.preventDefault();
        const factor = Math.exp(-e.deltaY * 0.0014);
        setZoom(zoom * factor);
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
        if (lastPinchDistance > 0)
            setZoom((zoom * dist) / lastPinchDistance);
        lastPinchDistance = dist;
        return;
    }

    if (!dragging) return;
    rotY += ((x - lastX) / radius) * 0.9;
    rotX += ((y - lastY) / radius) * 0.9;
    rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));
    lastX = x;
    lastY = y;
    draw();
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

[
    divisionSelect,
    renderModeSelect,
    lonCapSelect,
    latCapSelect,
    vextInput,
    lineScaleInput,
    densityInput,
].forEach((el) => {
    el.addEventListener("input", draw);
    el.addEventListener("change", draw);
});

window.addEventListener("resize", resize);
resize();
