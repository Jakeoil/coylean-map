import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Propagation, Seniority, pri } from 'coylean/core';

// ── Coylean map → 3D hollow-pipe lattice ─────────────────────────────────────
// Un-flattens the 2D universe-quadrants "Pipes card" (mode: extents, view:
// integrated, all Display toggles off). The 2D junction is an orthographic
// top-view of cylinders tangent to a common top plane; here the same per-cell
// half-diameters become real open-ended (hollow) cylinder surfaces, all tangent
// to a common front plane (z = 0) — so fatter pipes bulge further back and a
// thinner pipe rides on the fatter one's front surface (never through its core).
//
// Diameter rule ported from coylean-explorer/src/display/render-pipes.js
// (dForDown / dForRight) and arrows.js (presetForPri); those files are the
// source of truth — keep in sync if the presets change.
const PRESET_PIPE_SCALE = {
    thin2:   0.25,
    thin1:   0.5,
    current: 0.75,
    thick:   1.0,
};
function presetForPri(p) {
    if (p <= 1) return 'thin2';
    if (p === 2) return 'thin1';
    if (p === 3) return 'current';
    return 'thick';
}

// ── Scene (ported from hello-world.js) ───────────────────────────────────────
const canvas = document.getElementById('scene');
const wrap = document.getElementById('canvas-wrap');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x11161f);

// Image-based lighting: a neutral room env gives the MeshStandardMaterial real
// reflections, so the tubes read as glossy plastic rather than flat fill. With
// it doing most of the modelling, the direct lights are kept low.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 500);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.addEventListener('change', render);

scene.add(new THREE.AmbientLight(0xffffff, 0.25));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(3, 5, 8);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xcfe6ff, 0xeeeeee, 0.25));

function makeSubtleNormalMap(size = 256, strength = 6) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    const heights = new Float32Array(size * size);
    for (let i = 0; i < heights.length; i++) heights[i] = Math.random();
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;
            const xm = (x - 1 + size) % size;
            const xp = (x + 1) % size;
            const ym = (y - 1 + size) % size;
            const yp = (y + 1) % size;
            const dx = (heights[y * size + xp] - heights[y * size + xm]) * strength;
            const dy = (heights[yp * size + x] - heights[ym * size + x]) * strength;
            const len = Math.sqrt(dx * dx + dy * dy + 1);
            img.data[idx]     = ((-dx / len) * 0.5 + 0.5) * 255;
            img.data[idx + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
            img.data[idx + 2] = ((1 / len) * 0.5 + 0.5) * 255;
            img.data[idx + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
}
const subtleNormal = makeSubtleNormalMap();

const matRed = new THREE.MeshStandardMaterial({
    color: 0xff9aa2, roughness: 0.35, metalness: 0,
    normalMap: subtleNormal, envMapIntensity: 0.5, side: THREE.DoubleSide,
});
const matBlue = new THREE.MeshStandardMaterial({
    color: 0x9ec5ff, roughness: 0.35, metalness: 0,
    normalMap: subtleNormal, envMapIntensity: 0.5, side: THREE.DoubleSide,
});

// ── Config / flags ───────────────────────────────────────────────────────────
const config = {
    northExtent: 4, southExtent: 4, westExtent: 4, eastExtent: 4,
    hInitCol: 1, vInitRow: 1, maxPri: 20,
    seniority: Seniority.vertical(),
};
const flags = {
    pipesMode: 'pipes', // "off" | "pipes" | "priority"
    pipesSize: 25,      // percentage 0–100
    wireframe: false,
};

const CELL = 1;                 // world size of one map cell
const RADIAL = 24;              // cylinder radial segments
const pipeGroup = new THREE.Group();
scene.add(pipeGroup);

// ── Map model (from coylean/core) ────────────────────────────────────────────
function buildModel() {
    const { northExtent: N, southExtent: S, westExtent: W, eastExtent: E } = config;
    // Cheaper streamed equivalent of
    // fromUniverseBoundary(Universe.createUniverseExtents(...)). Init arrays
    // default to all-true when omitted (the standard clean seed).
    return Propagation.fromUniverseExtents({
        northExtent: N, southExtent: S, westExtent: W, eastExtent: E,
        hInitCol: config.hInitCol, vInitRow: config.vInitRow,
        seniority: config.seniority, maxPri: config.maxPri,
    });
}

// ── Geometry: one hollow half-pipe along local +X ────────────────────────────
// Open-ended tube of radius r, from the cell centre (x = 0) out to x = L.
// `fatForPhi(phi)` returns the radius of the perpendicular crossbar this part of
// the tube tees into (0 → no crossing there, flat open end at the centre).
// Both tubes are tangent to the front plane (centres at z = −r and z = −fat), so
// this tube's surface point sits at depth d = r(1 − sinφ) below the plane and
// meets the crossbar at axial distance √(d(2·fat − d)) — equal radii → the
// r·|cosφ| miter; unequal radii → the thinner rides on the fatter's front, not
// through its core. Making the cut a function of φ — rather than one radius for
// the whole tube — lets a tee stay SOLID on the side where no crossing pipe
// exists (the notch fix), matching the 2D per-quadrant model.
function makeHalfPipe(r, fatForPhi, L, segments = RADIAL) {
    const positions = [];
    const indices = [];
    for (let i = 0; i <= segments; i++) {
        const phi = (i / segments) * Math.PI * 2;
        const y = Math.cos(phi) * r;
        const z = Math.sin(phi) * r;
        const fat = fatForPhi ? fatForPhi(phi) : 0;
        const d = r * (1 - Math.sin(phi));
        const xIn = fat > 0 ? Math.sqrt(Math.max(0, d * (2 * fat - d))) : 0;
        positions.push(xIn, y, z);   // inner ring (centre-facing, cut where teed)
        positions.push(L, y, z);     // outer ring (flat)
    }
    for (let i = 0; i < segments; i++) {
        const a = i * 2, b = i * 2 + 1;
        const c = (i + 1) * 2, d = (i + 1) * 2 + 1;
        indices.push(a, c, d, a, d, b);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
}

// Rotations taking local +X onto each outward world direction.
const ROT = {
    px: 0,                 // +X (blue right)
    nx: Math.PI,           // -X (blue left)
    py: Math.PI / 2,       // +Y (red top / north)
    ny: -Math.PI / 2,      // -Y (red bottom / south)
};

function addHalfPipe(cx, cy, dir, r, fatForPhi, L, mat) {
    if (r <= 0) return;
    const mesh = new THREE.Mesh(makeHalfPipe(r, fatForPhi, L), mat);
    mesh.position.set(cx, cy, -r); // tangent to the front plane (z = 0)
    mesh.rotation.z = ROT[dir];
    pipeGroup.add(mesh);
}

// ── Build the lattice ────────────────────────────────────────────────────────
let mapCols = 8, mapRows = 8;

function rebuildScene() {
    // Dispose previous meshes.
    for (const m of pipeGroup.children) m.geometry.dispose();
    pipeGroup.clear();

    matRed.wireframe = flags.wireframe;
    matBlue.wireframe = flags.wireframe;

    if (flags.pipesMode === 'off') { render(); return; }

    const p = buildModel();
    const numRows = p.numRows;
    const numCols = p.numColumns;
    mapCols = numCols;
    mapRows = numRows;
    const dm = p.downMatrix;      // dm[j][i]  vertical (red)
    const rm = p.rightMatrix;     // rm[i][j]  horizontal (blue)
    const { hInitCol, vInitRow, maxPri } = p;

    const baseD = Math.max(0, Math.min(1, flags.pipesSize / 100));
    const usePriority = flags.pipesMode === 'priority';
    const dForDown = (i, val) => {
        if (!val) return 0;
        if (!usePriority) return baseD;
        return baseD * PRESET_PIPE_SCALE[presetForPri(pri(i + hInitCol, maxPri))];
    };
    const dForRight = (j, val) => {
        if (!val) return 0;
        if (!usePriority) return baseD;
        return baseD * PRESET_PIPE_SCALE[presetForPri(pri(j + vInitRow, maxPri))];
    };

    // Centre the map on the origin. Column i → worldX, row j → worldY (north up).
    const originX = -numCols / 2 * CELL;
    const originY =  numRows / 2 * CELL;
    const half = CELL / 2;

    for (let j = 0; j < numRows; j++) {
        for (let i = 0; i < numCols; i++) {
            const blueDLeft  = dForRight(j, rm[i][j]);
            const blueDRight = dForRight(j, rm[i + 1][j]);
            const redDTop    = dForDown(i, dm[j][i]);
            const redDBottom = dForDown(i, dm[j + 1][i]);
            if (!(blueDLeft || blueDRight || redDTop || redDBottom)) continue;

            const cx = originX + (i + 0.5) * CELL;
            const cy = originY - (j + 0.5) * CELL;

            // Half-pipe radii (world). Absent halves are 0.
            const rTop   = redDTop / 2 * CELL;
            const rBot   = redDBottom / 2 * CELL;
            const rLeft  = blueDLeft / 2 * CELL;
            const rRight = blueDRight / 2 * CELL;

            // A tube tees into the perpendicular crossbar only where that
            // crossbar exists AND wins the crossbar rule (pipe-junction:
            // blue ≥ red → blue crossbar / red tapers). The facing side is
            // read per angle φ from the tube's world orientation, so a tee is
            // cut on the crossing side and stays solid on the empty side.
            // red top (py):    worldX = −r·cosφ → west when cosφ > 0
            const fatRedTop = (phi) => {
                const b = Math.cos(phi) > 0 ? rLeft : rRight;
                return b > 0 && b >= rTop ? b : 0;
            };
            // red bottom (ny): worldX = r·cosφ → west when cosφ < 0
            const fatRedBot = (phi) => {
                const b = Math.cos(phi) < 0 ? rLeft : rRight;
                return b > 0 && b >= rBot ? b : 0;
            };
            // blue right (px): worldY = r·cosφ → north when cosφ > 0
            const fatBlueRight = (phi) => {
                const rr = Math.cos(phi) > 0 ? rTop : rBot;
                return rr > 0 && rr > rRight ? rr : 0;
            };
            // blue left (nx):  worldY = −r·cosφ → north when cosφ < 0
            const fatBlueLeft = (phi) => {
                const rr = Math.cos(phi) < 0 ? rTop : rBot;
                return rr > 0 && rr > rLeft ? rr : 0;
            };

            addHalfPipe(cx, cy, 'py', rTop,   fatRedTop,     half, matRed);
            addHalfPipe(cx, cy, 'ny', rBot,   fatRedBot,     half, matRed);
            addHalfPipe(cx, cy, 'nx', rLeft,  fatBlueLeft,   half, matBlue);
            addHalfPipe(cx, cy, 'px', rRight, fatBlueRight,  half, matBlue);
        }
    }
    render();
}

// ── Camera framing (fit-to-content) ──────────────────────────────────────────
// View directions (from target toward camera). "map" is face-on to the front
// plane — reproduces the 2D universe-quadrants card, north up. "iso" is the
// default oblique. "side" grazes along +X to reveal the tangent depth (thin
// pipes riding on the front of fat ones).
const VIEW_DIRS = {
    map:  new THREE.Vector3(0, 0, 1),
    iso:  new THREE.Vector3(0.4, -0.5, 0.9).normalize(),
    side: new THREE.Vector3(1, -0.15, 0.28).normalize(),
};
const _box = new THREE.Box3();
const _sphere = new THREE.Sphere();
const _center = new THREE.Vector3();

function fitDistance(radius) {
    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const fit = Math.max(radius / Math.sin(vFov / 2), radius / Math.sin(hFov / 2));
    return fit * 1.12; // margin
}

// Frame the actual pipe bounds along a named direction. Falls back to the map
// cell span when the group is empty (pipes Off). instant = snap (no tween).
function frameView(dirKey = 'iso', { instant = false } = {}) {
    _box.setFromObject(pipeGroup);
    if (_box.isEmpty()) {
        const s = Math.max(mapCols, mapRows) * CELL;
        _box.setFromCenterAndSize(
            new THREE.Vector3(0, 0, 0), new THREE.Vector3(s, s, 1));
    }
    _box.getBoundingSphere(_sphere);
    _box.getCenter(_center);
    const dir = VIEW_DIRS[dirKey] || VIEW_DIRS.iso;
    const dist = fitDistance(_sphere.radius || Math.max(mapCols, mapRows) * 0.6);
    const toPos = _center.clone().addScaledVector(dir, dist);
    if (instant) {
        camera.position.copy(toPos);
        controls.target.copy(_center);
        camera.lookAt(_center);
        controls.update();
        render();
    } else {
        tweenCamera(toPos, _center.clone());
    }
}

// ── Controls wiring ──────────────────────────────────────────────────────────
const numericIds = [
    'northExtent', 'southExtent', 'westExtent', 'eastExtent',
    'hInitCol', 'vInitRow', 'maxPri',
];
for (const id of numericIds) {
    const el = document.getElementById(id);
    el.value = String(config[id]);
    el.addEventListener('input', () => {
        config[id] = +el.value;
        rebuildScene();
    });
}

const pipesModeBtn = document.getElementById('pipes-mode');
const PIPES_CYCLE = ['off', 'pipes', 'priority'];
const PIPES_LABEL = { off: 'Off', pipes: 'Pipes', priority: 'Priority' };
pipesModeBtn.textContent = PIPES_LABEL[flags.pipesMode];
pipesModeBtn.classList.toggle('active', flags.pipesMode !== 'off');
pipesModeBtn.onclick = () => {
    const next = (PIPES_CYCLE.indexOf(flags.pipesMode) + 1) % PIPES_CYCLE.length;
    flags.pipesMode = PIPES_CYCLE[next];
    pipesModeBtn.textContent = PIPES_LABEL[flags.pipesMode];
    pipesModeBtn.classList.toggle('active', flags.pipesMode !== 'off');
    rebuildScene();
};

const sizeInput = document.getElementById('pipes-size');
const sizeVal = document.getElementById('pipes-size-val');
sizeInput.value = String(flags.pipesSize);
sizeVal.textContent = String(flags.pipesSize);
sizeInput.addEventListener('input', () => {
    flags.pipesSize = +sizeInput.value;
    sizeVal.textContent = String(flags.pipesSize);
    rebuildScene();
});

const wireframeInput = document.getElementById('wireframe');
wireframeInput.addEventListener('change', () => {
    flags.wireframe = wireframeInput.checked;
    rebuildScene();
});

const VIEW_BTNS = { 'view-map': 'map', 'view-iso': 'iso', 'view-side': 'side' };
for (const [id, key] of Object.entries(VIEW_BTNS)) {
    document.getElementById(id).addEventListener('click', () => frameView(key));
}

// ── Render loop (on demand + animation-gated) ────────────────────────────────
// Idle by default (no rAF churn); render() requests a single frame. Damping and
// camera tweens keep re-requesting frames until they settle, then the loop
// stops again. `anims` holds active step(now)→keepGoing callbacks.
let renderRequested = false;
let tweening = false;
const anims = new Set();

function render() {
    if (!renderRequested) {
        renderRequested = true;
        requestAnimationFrame(frame);
    }
}

function frame(now) {
    renderRequested = false;
    for (const a of [...anims]) if (!a(now)) anims.delete(a);
    if (controls.enableDamping && !tweening) controls.update();
    renderer.render(scene, camera);
    if (anims.size > 0) render();
}

function tweenCamera(toPos, toTarget, ms = 450) {
    const fromPos = camera.position.clone();
    const fromTgt = controls.target.clone();
    let start = null;
    tweening = true;
    controls.enabled = false; // don't let a drag fight the tween
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    anims.add((now) => {
        if (start === null) start = now;
        const t = Math.min(1, (now - start) / ms);
        const e = ease(t);
        camera.position.lerpVectors(fromPos, toPos, e);
        controls.target.lerpVectors(fromTgt, toTarget, e);
        camera.lookAt(controls.target);
        if (t >= 1) {
            tweening = false;
            controls.enabled = true;
            controls.update();
            return false;
        }
        return true;
    });
    render();
}

function resize() {
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    render();
}
window.addEventListener('resize', resize);

rebuildScene();
resize();
frameView('iso', { instant: true });
