import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.getElementById('scene');
const wrap = document.getElementById('canvas-wrap');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfe6ff);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
const initialCamPos = new THREE.Vector3(0, 0, 4);
camera.position.copy(initialCamPos);

const controls = new OrbitControls(camera, canvas);
controls.addEventListener('change', render);

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(0, 0, 8);
scene.add(sun);
const sky = new THREE.HemisphereLight(0xcfe6ff, 0xeeeeee, 0.5);
scene.add(sky);

// Square of intersecting cylinders, centered at origin.
// Vertical pair (parallel to y-axis) = red. Horizontal pair = blue.
const SIZE = 1;
const OVERSHOOT = 0.15;
const cylinderLength = SIZE * 2 + OVERSHOOT * 2;
const HIT_RADIUS = 0.08;

function makeSubtleNormalMap(size = 256, strength = 6) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
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
      img.data[idx + 2] = ((1   / len) * 0.5 + 0.5) * 255;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

const subtleNormal = makeSubtleNormalMap();

const matRed = new THREE.MeshStandardMaterial({
  color: 0xff9aa2,
  roughness: 0.35,
  metalness: 0.15,
  normalMap: subtleNormal,
  side: THREE.DoubleSide,
});
const matBlue = new THREE.MeshStandardMaterial({
  color: 0x9ec5ff,
  roughness: 0.35,
  metalness: 0.15,
  normalMap: subtleNormal,
  side: THREE.DoubleSide,
});
const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

// Blue is cut to terminate at the red cylinders' outer surface.
// Equal radii, so the saddle cut at angle θ ends at x = ±SIZE ∓ r·|cosθ|.
// Blue geometry is built directly along its local x-axis (no rotation needed).
function makeCutBlueGeometry(radius, halfLength, segments = 64) {
  const positions = [];
  const indices = [];
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const y = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    const cut = radius * Math.abs(Math.cos(theta));
    positions.push(-halfLength + cut, y, z);
    positions.push( halfLength - cut, y, z);
  }
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const a = i * 2,     b = i * 2 + 1;
    const c = next * 2,  d = next * 2 + 1;
    indices.push(a, c, d);
    indices.push(a, d, b);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

let redGeometry = new THREE.CylinderGeometry(0.1, 0.1, cylinderLength, 32, 1, true);
let blueGeometry = makeCutBlueGeometry(0.1, SIZE, 64);
const hitGeometry = new THREE.CylinderGeometry(HIT_RADIUS, HIT_RADIUS, cylinderLength, 16);

function makeCylinder(material, axis, position) {
  const subGroup = new THREE.Group();
  subGroup.position.copy(position);
  subGroup.userData.axis = axis;

  const visible = axis === 'x'
    ? new THREE.Mesh(blueGeometry, material)
    : new THREE.Mesh(redGeometry, material);

  const hit = new THREE.Mesh(hitGeometry, hitMaterial);
  if (axis === 'x') hit.rotation.z = Math.PI / 2;
  hit.userData.subGroup = subGroup;

  subGroup.add(visible);
  subGroup.add(hit);
  subGroup.userData.visible = visible;
  return subGroup;
}

const cylinderGroups = [
  makeCylinder(matRed,  'y', new THREE.Vector3( SIZE, 0, 0)),
  makeCylinder(matRed,  'y', new THREE.Vector3(-SIZE, 0, 0)),
  makeCylinder(matBlue, 'x', new THREE.Vector3(0,  SIZE, 0)),
  makeCylinder(matBlue, 'x', new THREE.Vector3(0, -SIZE, 0)),
];
cylinderGroups.forEach(g => scene.add(g));
const hitMeshes = cylinderGroups.map(g => g.children[1]);

// Collection of small pipes — mixed red/blue, varying radii.
// All centered on the same z-plane (z = mainRadius) so perpendicular blue
// and red pipes truly cross through each other in an X / + shape.
const PIPE_LENGTH = SIZE * 2;
const smallHitGeometry = new THREE.CylinderGeometry(HIT_RADIUS, HIT_RADIUS, PIPE_LENGTH, 16);
let mainRadius = 0.1;
const smallPipeConfigs = [
  { axis: 'x', other:  0.30, scale: 0.50, mat: matBlue },
  { axis: 'x', other: -0.40, scale: 0.70, mat: matBlue },
  { axis: 'x', other:  0.70, scale: 0.30, mat: matBlue },
  { axis: 'y', other:  0.40, scale: 0.40, mat: matRed  },
  { axis: 'y', other: -0.30, scale: 0.60, mat: matRed  },
  { axis: 'y', other:  0.00, scale: 0.35, mat: matRed  },
  // thinner pipes:
  { axis: 'x', other:  0.55, scale: 0.20, mat: matBlue },
  { axis: 'y', other:  0.55, scale: 0.18, mat: matRed  },
  { axis: 'x', other: -0.65, scale: 0.15, mat: matBlue },
  { axis: 'y', other: -0.55, scale: 0.12, mat: matRed  },
];
const smallPipes = [];
for (const cfg of smallPipeConfigs) {
  const r = mainRadius * cfg.scale;
  const subGroup = new THREE.Group();

  const visible = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, PIPE_LENGTH, 32, 1, true),
    cfg.mat
  );
  const hit = new THREE.Mesh(smallHitGeometry, hitMaterial);

  if (cfg.axis === 'x') {
    visible.rotation.z = Math.PI / 2;
    hit.rotation.z = Math.PI / 2;
    subGroup.position.set(0, cfg.other, mainRadius);
  } else {
    subGroup.position.set(cfg.other, 0, mainRadius);
  }
  hit.userData.subGroup = subGroup;

  subGroup.add(visible);
  subGroup.add(hit);
  subGroup.userData.visible = visible;
  subGroup.userData.config = cfg;
  scene.add(subGroup);
  smallPipes.push(subGroup);
  hitMeshes.push(hit);
}

function rebuildSmallPipes(newMainRadius) {
  mainRadius = newMainRadius;
  for (const subGroup of smallPipes) {
    const cfg = subGroup.userData.config;
    const r = mainRadius * cfg.scale;
    const next = new THREE.CylinderGeometry(r, r, PIPE_LENGTH, 32, 1, true);
    subGroup.userData.visible.geometry.dispose();
    subGroup.userData.visible.geometry = next;
    subGroup.position.z = mainRadius;
  }
}

function rebuildGeometry(newRadius) {
  const nextRed = new THREE.CylinderGeometry(newRadius, newRadius, cylinderLength, 32, 1, true);
  const nextBlue = makeCutBlueGeometry(newRadius, SIZE, 64);
  for (const g of cylinderGroups) {
    g.userData.visible.geometry = g.userData.axis === 'x' ? nextBlue : nextRed;
  }
  redGeometry.dispose();
  blueGeometry.dispose();
  redGeometry = nextRed;
  blueGeometry = nextBlue;
}

// Drag cylinders — each pipe stays on its own z plane (the one it currently sits on).
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const intersection = new THREE.Vector3();
const dragOffset = new THREE.Vector3();
let dragged = null;

function setPointer(e) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

canvas.addEventListener('pointerdown', (e) => {
  setPointer(e);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(hitMeshes, false);
  if (hits.length === 0) return;
  const target = hits[0].object.userData.subGroup;
  dragPlane.constant = -target.position.z;
  if (!raycaster.ray.intersectPlane(dragPlane, intersection)) return;
  dragged = target;
  dragOffset.copy(intersection).sub(dragged.position);
  controls.enabled = false;
  canvas.setPointerCapture(e.pointerId);
  e.stopPropagation();
}, true);

canvas.addEventListener('pointermove', (e) => {
  if (!dragged) return;
  setPointer(e);
  raycaster.setFromCamera(pointer, camera);
  if (raycaster.ray.intersectPlane(dragPlane, intersection)) {
    dragged.position.x = intersection.x - dragOffset.x;
    dragged.position.y = intersection.y - dragOffset.y;
    render();
  }
});

function endDrag(e) {
  if (!dragged) return;
  dragged = null;
  controls.enabled = true;
  if (e.pointerId !== undefined && canvas.hasPointerCapture(e.pointerId)) {
    canvas.releasePointerCapture(e.pointerId);
  }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

const radiusInput = document.getElementById('radius');
const radiusVal = document.getElementById('radius-val');
const wireframeInput = document.getElementById('wireframe');
const resetBtn = document.getElementById('reset');

radiusInput.addEventListener('input', () => {
  const r = parseFloat(radiusInput.value);
  radiusVal.textContent = r.toFixed(2);
  rebuildGeometry(r);
  rebuildSmallPipes(r);
  render();
});
wireframeInput.addEventListener('change', () => {
  matRed.wireframe = wireframeInput.checked;
  matBlue.wireframe = wireframeInput.checked;
  render();
});
resetBtn.addEventListener('click', () => {
  camera.position.copy(initialCamPos);
  controls.target.set(0, 0, 0);
  controls.update();
});

function resize() {
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  render();
}
window.addEventListener('resize', resize);

function render() {
  renderer.render(scene, camera);
}
resize();
