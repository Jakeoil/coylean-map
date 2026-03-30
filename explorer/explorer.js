// ═══════════════════════════════════════════════════
//  Self-Similar Coylean Map Explorer
// ═══════════════════════════════════════════════════

// ── Coylean Algorithm (shared with glyphs.js) ──

function computeMaxPri(ds, rs) {
    if (ds < rs) ds = rs;
    for (let i = 0; i < 32; i++) {
        if (ds < 1) return i;
        ds = Math.floor(ds / 2);
    }
    return 32;
}

const GLYPH_PRI = computeMaxPri(3, 3);

function priority(i) {
    for (let j = 0; j < GLYPH_PRI; j++) {
        if (i % 2 !== 0) return j;
        i = Math.floor(i / 2);
    }
    return GLYPH_PRI;
}

// ── D4 transforms and letter assignments ──

const D4_TO_SCALE = { 0: [1, 1], 2: [-1, -1], 4: [1, -1], 5: [-1, 1] };

const VISUAL_D4 = [
    { v: (v, h, a, b) => v[a][b], h: (v, h, a, b) => h[a][b] },
    { v: (v, h, a, b) => h[3 - b][a], h: (v, h, a, b) => v[2 - b][a] },
    { v: (v, h, a, b) => v[2 - a][3 - b], h: (v, h, a, b) => h[3 - a][2 - b] },
    { v: (v, h, a, b) => h[b][2 - a], h: (v, h, a, b) => v[b][3 - a] },
    { v: (v, h, a, b) => v[a][3 - b], h: (v, h, a, b) => h[a][2 - b] },
    { v: (v, h, a, b) => v[2 - a][b], h: (v, h, a, b) => h[3 - a][b] },
    { v: (v, h, a, b) => h[b][a], h: (v, h, a, b) => v[b][a] },
    { v: (v, h, a, b) => h[3 - b][2 - a], h: (v, h, a, b) => v[2 - b][3 - a] },
];

function computePattern(downCode, rightCode) {
    const da = [!!(downCode & 1), !!(downCode & 2), !!(downCode & 4)];
    const ra = [!!(rightCode & 1), !!(rightCode & 2), !!(rightCode & 4)];
    const v = Array.from({ length: 3 }, () => Array(4).fill(false));
    const h = Array.from({ length: 4 }, () => Array(3).fill(false));
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            let d = da[x], r = ra[y];
            const dp = priority(x + 1), rp = priority(y + 1);
            if (dp >= rp) { if (d) r = !r; } else { if (r) d = !d; }
            if (da[x]) v[x][y] = true;
            if (ra[y]) h[x][y] = true;
            da[x] = d; ra[y] = r;
        }
        if (ra[y]) h[3][y] = true;
    }
    for (let x = 0; x < 3; x++) { if (da[x]) v[x][3] = true; }
    return { v, h };
}

function transformedPatternKey(v, h, ti) {
    const t = VISUAL_D4[ti];
    let key = 0;
    for (let a = 0; a < 3; a++)
        for (let b = 0; b < 4; b++)
            if (t.v(v, h, a, b)) key |= 1 << (a * 4 + b);
    for (let a = 0; a < 4; a++)
        for (let b = 0; b < 3; b++)
            if (t.h(v, h, a, b)) key |= 1 << (12 + a * 3 + b);
    return key;
}

// Classify V-glyphs for letter assignment
function classifyVisualD4() {
    const glyphs = [];
    for (let d = 0; d < 8; d++) for (let r = 0; r < 8; r++) {
        const { v, h } = computePattern(d, r);
        let ck = Infinity; const keys = [];
        for (let ti = 0; ti < 8; ti++) {
            const k = transformedPatternKey(v, h, ti);
            keys.push(k); if (k < ck) ck = k;
        }
        glyphs.push({ d, r, v, h, ck, keys });
    }
    const groups = new Map();
    for (const g of glyphs) { if (!groups.has(g.ck)) groups.set(g.ck, []); groups.get(g.ck).push(g); }
    const classes = [];
    for (const members of groups.values()) {
        const orbit = members.map(m => [m.d, m.r]).sort((a, b) => (a[0] * 8 + a[1]) - (b[0] * 8 + b[1]));
        const rep = orbit[0];
        const rm = members.find(m => m.d === rep[0] && m.r === rep[1]);
        const transforms = orbit.map(([d, r]) => {
            const m = members.find(x => x.d === d && x.r === r);
            const mKey = m.keys[0];
            for (let ti = 0; ti < 8; ti++) {
                if (transformedPatternKey(rm.v, rm.h, ti) === mKey) return ti;
            }
            return 0;
        });
        classes.push({ orbit, members, transforms });
    }
    return classes;
}

const GLYPH_LETTERS = {};

function assignLetter(classes, downCode, rightCode, letter) {
    for (const cls of classes) {
        if (cls.orbit.some(([d, r]) => d === downCode && r === rightCode)) {
            const base = computePattern(downCode, rightCode);
            for (let i = 0; i < cls.orbit.length; i++) {
                const [d, r] = cls.orbit[i];
                const mem = computePattern(d, r);
                const memKey = transformedPatternKey(mem.v, mem.h, 0);
                for (let ti = 0; ti < 8; ti++) {
                    if (transformedPatternKey(base.v, base.h, ti) === memKey) {
                        const scale = D4_TO_SCALE[ti];
                        if (scale) GLYPH_LETTERS[d + "," + r] = [letter, scale[0], scale[1]];
                        break;
                    }
                }
            }
            break;
        }
    }
}

const V_CLASSES = classifyVisualD4();
assignLetter(V_CLASSES, 7, 7, "F");
assignLetter(V_CLASSES, 1, 7, "P");
assignLetter(V_CLASSES, 6, 6, "J");
assignLetter(V_CLASSES, 5, 6, "M");
assignLetter(V_CLASSES, 0, 0, "O");
assignLetter(V_CLASSES, 1, 1, "L");
assignLetter(V_CLASSES, 2, 5, "Q");
assignLetter(V_CLASSES, 0, 7, "T");
assignLetter(V_CLASSES, 1, 5, "B");
assignLetter(V_CLASSES, 5, 1, "Y");
assignLetter(V_CLASSES, 6, 1, "R");
assignLetter(V_CLASSES, 1, 6, "S");

// ── Substitution Table ──

function getSectionData(N) {
    const M = N + 1;
    const maxP = computeMaxPri(M, M);
    function pri(i) {
        for (let j = 0; j < maxP; j++) {
            if (i % 2 !== 0) return j;
            i = Math.floor(i / 2);
        }
        return maxP;
    }
    const SEC = 4;
    const NS = N / SEC;
    const codes = Array.from({ length: NS }, () =>
        Array.from({ length: NS }, () => [0, 0]),
    );
    const vBound = Array.from({ length: NS }, () => Array(NS).fill(false));
    const hBound = Array.from({ length: NS }, () => Array(NS).fill(false));

    const d = new Array(M).fill(false);
    const r = new Array(M).fill(false);
    d[0] = true;

    for (let y = 0; y < M; y++) {
        const rp = pri(y);
        const yRel = y - 1;
        const sr = Math.floor(yRel / SEC);
        const rowInSec = yRel % SEC;
        const isSecRow = y >= 1 && sr < NS && rowInSec < 3;

        for (let x = 0; x < M; x++) {
            const preD = d[x];
            const preR = r[y];
            const xRel = x - 1;
            const sc = Math.floor(xRel / SEC);
            const colInSec = xRel % SEC;

            if (isSecRow && rowInSec === 0 && x >= 1 && sc < NS && colInSec < 3) {
                if (preD) codes[sr][sc][0] |= 1 << colInSec;
            }
            if (isSecRow && x >= 1 && sc < NS && colInSec === 0) {
                if (preR) codes[sr][sc][1] |= 1 << rowInSec;
            }
            if (x >= 1 && colInSec === 3 && sc < NS - 1 && y >= 1 && sr >= 0 && sr < NS) {
                if (preD) vBound[sr][sc] = true;
            }
            if (y >= 1 && rowInSec === 3 && sr >= 0 && sr < NS - 1 && x >= 1 && sc >= 0 && sc < NS) {
                if (preR) hBound[sr][sc] = true;
            }

            if (pri(x) >= rp) {
                if (preD) r[y] = !r[y];
            } else {
                if (preR) d[x] = !d[x];
            }
        }
    }
    return { codes, NS, vBound, hBound };
}

// Build the substitution table from order 5 → 6
const o5 = getSectionData(32);
const o6 = getSectionData(64);
const SUB_TABLE = {};
const REACHABLE = new Set();

for (let sr = 0; sr < 8; sr++) {
    for (let sc = 0; sc < 8; sc++) {
        const [dc, rc] = o5.codes[sr][sc];
        const key = dc + "," + rc;
        REACHABLE.add(key);
        if (SUB_TABLE[key]) continue;

        const sr6 = sr * 2, sc6 = sc * 2;
        SUB_TABLE[key] = {
            children: [
                o6.codes[sr6][sc6],
                o6.codes[sr6][sc6 + 1],
                o6.codes[sr6 + 1][sc6],
                o6.codes[sr6 + 1][sc6 + 1],
            ],
            vBoundTop: o6.vBound[sr6][sc6],
            vBoundBot: o6.vBound[sr6 + 1][sc6],
            hBoundLeft: o6.hBound[sr6][sc6],
            hBoundRight: o6.hBound[sr6][sc6 + 1],
        };
    }
}

// Also expand order 6 → 7 to capture any codes that only appear at deeper levels
const o7 = getSectionData(128);
for (let sr = 0; sr < 16; sr++) {
    for (let sc = 0; sc < 16; sc++) {
        const [dc, rc] = o6.codes[sr][sc];
        const key = dc + "," + rc;
        REACHABLE.add(key);
        if (SUB_TABLE[key]) continue;
        const sr7 = sr * 2, sc7 = sc * 2;
        SUB_TABLE[key] = {
            children: [
                o7.codes[sr7][sc7],
                o7.codes[sr7][sc7 + 1],
                o7.codes[sr7 + 1][sc7],
                o7.codes[sr7 + 1][sc7 + 1],
            ],
            vBoundTop: o7.vBound[sr7][sc7],
            vBoundBot: o7.vBound[sr7 + 1][sc7],
            hBoundLeft: o7.hBound[sr7][sc7],
            hBoundRight: o7.hBound[sr7][sc7 + 1],
        };
    }
}

// ── Unicode helpers ──

const SUB_DIGITS = "\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087";

function glyphLabel(dc, rc) {
    const ft = GLYPH_LETTERS[dc + "," + rc];
    if (!ft) return "V" + SUB_DIGITS[dc] + SUB_DIGITS[rc];
    const [letter, sx, sy] = ft;
    if (sx === 1 && sy === 1) return letter;
    if (sx === 1 && sy === -1) return letter + "\u2195";
    if (sx === -1 && sy === 1) return letter + "\u2194";
    if (sx === -1 && sy === -1) return letter + "\u27F2";
    return letter;
}

// ── Build Substitution Table Display ──

const D4_LABELS = ["e", "r", "r\u00B2", "r\u00B3", "s\u2095", "s\u1D65", "s\u2081", "s\u2082"];

function buildSubCard(dc, rc) {
    const rule = SUB_TABLE[dc + "," + rc];
    if (!rule) return null;

    const card = document.createElement("div");
    card.className = "sub-card";

    const title = document.createElement("div");
    title.className = "sub-parent";
    title.textContent = glyphLabel(dc, rc);
    card.appendChild(title);

    const box = document.createElement("div");
    box.className = "sub-2x2";

    const labels = rule.children.map(([d, r]) => glyphLabel(d, r));
    const cls = [
        [rule.hBoundLeft ? "border-bottom" : "", rule.vBoundTop ? "border-right" : ""],
        [rule.hBoundRight ? "border-bottom" : "", ""],
        ["", rule.vBoundBot ? "border-right" : ""],
        ["", ""],
    ];

    for (let i = 0; i < 4; i++) {
        const cell = document.createElement("div");
        cell.className = "sub-cell" +
            (cls[i][0] ? " " + cls[i][0] : "") +
            (cls[i][1] ? " " + cls[i][1] : "");
        cell.textContent = labels[i];
        box.appendChild(cell);
    }
    card.appendChild(box);
    return card;
}

function buildSubTable() {
    const container = document.getElementById("sub-table");

    // Group by D4 orbit: for each orbit with reachable members, show them together
    // with transform labels (e, s_v, s_h, r²)
    const orbitGroups = [];
    for (const cls of V_CLASSES) {
        const reachable = cls.orbit.filter(([d, r]) => SUB_TABLE[d + "," + r]);
        if (reachable.length === 0) continue;

        // Find which transforms are present
        const members = reachable.map(([d, r]) => {
            const idx = cls.orbit.findIndex(([od, or]) => od === d && or === r);
            return { dc: d, rc: r, ti: cls.transforms[idx] };
        });
        // Sort by transform index so e comes first
        members.sort((a, b) => a.ti - b.ti);
        orbitGroups.push(members);
    }

    // Sort groups: single-member first, then by first member code
    orbitGroups.sort((a, b) => {
        if (a.length !== b.length) return a.length - b.length;
        return (a[0].dc * 8 + a[0].rc) - (b[0].dc * 8 + b[0].rc);
    });

    for (const members of orbitGroups) {
        const group = document.createElement("div");
        group.className = "sub-group";

        const grid = document.createElement("div");
        grid.className = "sub-grid";

        for (const m of members) {
            const card = buildSubCard(m.dc, m.rc);
            if (!card) continue;

            // Add transform label below the 2x2
            const tLabel = document.createElement("div");
            tLabel.style.cssText = "font-size:0.7rem;color:#888;margin-top:2px;";
            tLabel.textContent = D4_LABELS[m.ti];
            card.appendChild(tLabel);

            grid.appendChild(card);
        }

        group.appendChild(grid);
        container.appendChild(group);
    }
}

function buildCodeList() {
    const container = document.getElementById("code-list");
    const keys = [...REACHABLE].sort((a, b) => {
        const [ad, ar] = a.split(",").map(Number);
        const [bd, br] = b.split(",").map(Number);
        return (ad * 8 + ar) - (bd * 8 + br);
    });
    for (const key of keys) {
        const [dc, rc] = key.split(",").map(Number);
        const tag = document.createElement("span");
        const ft = GLYPH_LETTERS[key];
        tag.className = "code-tag" + (ft ? " assigned" : "");
        tag.textContent = "V" + SUB_DIGITS[dc] + SUB_DIGITS[rc] +
            (ft ? " = " + glyphLabel(dc, rc) : "");
        container.appendChild(tag);
    }
}

// ── Explorer State ──

const canvas = document.getElementById("explorer-canvas");
const ctx = canvas.getContext("2d");

let currentGrid;    // NS × NS array of [dc, rc]
let currentVBound;  // boundary data
let currentHBound;
let gridSize;       // sections per axis
let zoomStack = []; // for zoom out
let hoverR = -1, hoverC = -1;
let showDots = true;
let showLetters = true;

function initRootGrid() {
    gridSize = o5.NS; // 8
    currentGrid = o5.codes.map(row => row.map(c => [...c]));
    currentVBound = o5.vBound.map(row => [...row]);
    currentHBound = o5.hBound.map(row => [...row]);
    zoomStack = [];
    updateUI();
    render();
}

// Expand entire grid one level using substitution table
function expandGrid(grid, vBound, hBound, ns) {
    const ns2 = ns * 2;
    const newGrid = Array.from({ length: ns2 }, () =>
        Array.from({ length: ns2 }, () => [0, 0]),
    );
    const newVBound = Array.from({ length: ns2 }, () => Array(ns2).fill(false));
    const newHBound = Array.from({ length: ns2 }, () => Array(ns2).fill(false));

    for (let sr = 0; sr < ns; sr++) {
        for (let sc = 0; sc < ns; sc++) {
            const [dc, rc] = grid[sr][sc];
            const rule = SUB_TABLE[dc + "," + rc];
            if (!rule) continue;

            const r2 = sr * 2, c2 = sc * 2;
            newGrid[r2][c2] = [...rule.children[0]];
            newGrid[r2][c2 + 1] = [...rule.children[1]];
            newGrid[r2 + 1][c2] = [...rule.children[2]];
            newGrid[r2 + 1][c2 + 1] = [...rule.children[3]];

            // Internal boundaries
            if (rule.vBoundTop) newVBound[r2][c2] = true;
            if (rule.vBoundBot) newVBound[r2 + 1][c2] = true;
            if (rule.hBoundLeft) newHBound[r2][c2] = true;
            if (rule.hBoundRight) newHBound[r2][c2 + 1] = true;
        }
    }

    // Inter-parent boundaries: inherit from parent level
    for (let sr = 0; sr < ns; sr++) {
        for (let sc = 0; sc < ns - 1; sc++) {
            if (vBound[sr][sc]) {
                newVBound[sr * 2][sc * 2 + 1] = true;
                newVBound[sr * 2 + 1][sc * 2 + 1] = true;
            }
        }
    }
    for (let sr = 0; sr < ns - 1; sr++) {
        for (let sc = 0; sc < ns; sc++) {
            if (hBound[sr][sc]) {
                newHBound[sr * 2 + 1][sc * 2] = true;
                newHBound[sr * 2 + 1][sc * 2 + 1] = true;
            }
        }
    }

    return { grid: newGrid, vBound: newVBound, hBound: newHBound, ns: ns2 };
}

// Zoom into a section: expand and crop to show context around it
function zoomIn(row, col) {
    // Save current state
    zoomStack.push({
        grid: currentGrid,
        vBound: currentVBound,
        hBound: currentHBound,
        ns: gridSize,
    });

    // Expand full grid one level
    const expanded = expandGrid(currentGrid, currentVBound, currentHBound, gridSize);

    // The clicked section expands to 4 children at (row*2, col*2)...(row*2+1, col*2+1)
    // Show a window centered around them, keeping same viewport section count
    const ns2 = expanded.ns;
    const centerR = row * 2;
    const centerC = col * 2;

    // Crop to gridSize × gridSize window centered on the expansion
    const halfWin = Math.floor(gridSize / 2);
    let startR = Math.max(0, centerR - halfWin + 1);
    let startC = Math.max(0, centerC - halfWin + 1);
    if (startR + gridSize > ns2) startR = Math.max(0, ns2 - gridSize);
    if (startC + gridSize > ns2) startC = Math.max(0, ns2 - gridSize);
    const viewRows = Math.min(gridSize, ns2);
    const viewCols = Math.min(gridSize, ns2);

    const newGrid = Array.from({ length: viewRows }, (_, r) =>
        Array.from({ length: viewCols }, (_, c) =>
            [...expanded.grid[startR + r][startC + c]],
        ),
    );
    const newVBound = Array.from({ length: viewRows }, (_, r) =>
        Array.from({ length: viewCols }, (_, c) => {
            const sc = startC + c;
            return sc < ns2 - 1 ? expanded.vBound[startR + r][sc] : false;
        }),
    );
    const newHBound = Array.from({ length: viewRows }, (_, r) =>
        Array.from({ length: viewCols }, (_, c) => {
            const sr = startR + r;
            return sr < ns2 - 1 ? expanded.hBound[sr][startC + c] : false;
        }),
    );

    currentGrid = newGrid;
    currentVBound = newVBound;
    currentHBound = newHBound;
    // gridSize stays the same (viewport size is constant)

    updateUI();
    render();
}

function zoomOut() {
    if (zoomStack.length === 0) return;
    const prev = zoomStack.pop();
    currentGrid = prev.grid;
    currentVBound = prev.vBound;
    currentHBound = prev.hBound;
    gridSize = prev.ns;
    updateUI();
    render();
}

function updateUI() {
    const level = zoomStack.length;
    const order = 5 + level;
    document.getElementById("zoom-info").textContent =
        "Level " + level + " \u2014 Order " + order +
        " (" + gridSize + "\u00d7" + gridSize + " window)";
    document.getElementById("btn-out").disabled = level === 0;

    // Build path
    const pathEl = document.getElementById("zoom-path");
    if (level === 0) {
        pathEl.textContent = "";
    } else {
        pathEl.textContent = "Zoom depth: " + level +
            " (click Zoom Out or Reset to navigate back)";
    }
}

// ── Rendering ──

const DOT_R = 2;

function drawDot(c, x, y, filled, r) {
    const radius = r || DOT_R;
    c.beginPath();
    c.arc(x, y, radius, 0, Math.PI * 2);
    if (filled) {
        c.fillStyle = "#000";
        c.fill();
    } else {
        c.strokeStyle = "#000";
        c.lineWidth = radius * 0.32;
        c.stroke();
    }
}

function renderOnCanvas(canvasEl, c, grid, vBound, hBound, hR, hC, dots, letters) {
    const rows = grid.length;
    const cols = grid[0].length;
    const SEC = 4;

    // Compute cell size to fit canvas
    const maxPx = Math.min(800, window.innerWidth - 60);
    const cellSize = Math.max(4, Math.floor(maxPx / (cols * SEC + cols)));
    const gap = Math.max(1, Math.floor(cellSize * 0.15));
    const secPx = SEC * cellSize;
    const totalW = cols * (secPx + gap) + gap;
    const totalH = rows * (secPx + gap) + gap;

    canvasEl.width = totalW;
    canvasEl.height = totalH;
    c.fillStyle = "#fff";
    c.fillRect(0, 0, totalW, totalH);

    const lw = Math.max(0.5, cellSize * 0.08);
    const dotR = Math.max(1, cellSize * 0.15);

    for (let sr = 0; sr < rows; sr++) {
        for (let sc = 0; sc < cols; sc++) {
            const [dc, rc] = grid[sr][sc];
            const sx = gap + sc * (secPx + gap);
            const sy = gap + sr * (secPx + gap);

            // Highlight on hover
            if (sr === hR && sc === hC) {
                c.fillStyle = "rgba(0, 0, 100, 0.05)";
                c.fillRect(sx, sy, secPx, secPx);
            }

            // Draw glyph lines
            const da = [!!(dc & 1), !!(dc & 2), !!(dc & 4)];
            const ra = [!!(rc & 1), !!(rc & 2), !!(rc & 4)];

            c.strokeStyle = "#90caf9";
            c.lineWidth = lw;

            for (let gy = 0; gy < 3; gy++) {
                for (let gx = 0; gx < 3; gx++) {
                    let dv = da[gx], rv = ra[gy];
                    const dp = priority(gx + 1), rp = priority(gy + 1);
                    if (dp >= rp) { if (dv) rv = !rv; }
                    else { if (rv) dv = !dv; }

                    const x0 = sx + gx * cellSize, y0 = sy + gy * cellSize;
                    if (da[gx]) {
                        c.beginPath();
                        c.moveTo(x0 + cellSize, y0);
                        c.lineTo(x0 + cellSize, y0 + cellSize);
                        c.stroke();
                    }
                    if (ra[gy]) {
                        c.beginPath();
                        c.moveTo(x0, y0 + cellSize);
                        c.lineTo(x0 + cellSize, y0 + cellSize);
                        c.stroke();
                    }
                    da[gx] = dv;
                    ra[gy] = rv;
                }
                if (ra[gy]) {
                    c.beginPath();
                    c.moveTo(sx + 3 * cellSize, sy + (gy + 1) * cellSize);
                    c.lineTo(sx + 4 * cellSize, sy + (gy + 1) * cellSize);
                    c.stroke();
                }
            }
            for (let gx = 0; gx < 3; gx++) {
                if (da[gx]) {
                    c.beginPath();
                    c.moveTo(sx + (gx + 1) * cellSize, sy + 3 * cellSize);
                    c.lineTo(sx + (gx + 1) * cellSize, sy + 4 * cellSize);
                    c.stroke();
                }
            }

            // Dots
            if (dots) {
                const daOrig = [!!(dc & 1), !!(dc & 2), !!(dc & 4)];
                const raOrig = [!!(rc & 1), !!(rc & 2), !!(rc & 4)];
                for (let i = 0; i < 3; i++) {
                    drawDot(c, sx + (i + 1) * cellSize, sy, daOrig[i], dotR);
                    drawDot(c, sx, sy + (i + 1) * cellSize, raOrig[i], dotR);
                    drawDot(c, sx + (i + 1) * cellSize, sy + 4 * cellSize, da[i], dotR);
                    drawDot(c, sx + 4 * cellSize, sy + (i + 1) * cellSize, ra[i], dotR);
                }
            }

            // Letter overlay
            if (letters) {
                const ft = GLYPH_LETTERS[dc + "," + rc];
                if (ft) {
                    const fontSize = 3 * cellSize;
                    const cx = sx + 2 * cellSize;
                    const cy = sy + 2 * cellSize + fontSize * 0.05 * ft[2];
                    c.save();
                    c.translate(cx, cy);
                    c.scale(ft[1], ft[2]);
                    c.fillStyle = "rgba(0, 0, 100, 0.4)";
                    c.font = "bold " + fontSize + "px Monaco, Menlo, monospace";
                    c.textAlign = "center";
                    c.textBaseline = "middle";
                    c.fillText(ft[0], 0, 0);
                    c.restore();
                } else if (cellSize >= 6) {
                    // V label for unassigned
                    c.fillStyle = "rgba(0, 0, 0, 0.25)";
                    c.font = (cellSize * 0.7) + "px Monaco, Menlo, monospace";
                    c.textAlign = "center";
                    c.textBaseline = "middle";
                    c.fillText(
                        "V" + SUB_DIGITS[dc] + SUB_DIGITS[rc],
                        sx + 2 * cellSize, sy + 2 * cellSize,
                    );
                }
            }
        }
    }

    // Draw boundary segments between sections
    c.strokeStyle = "#000";
    c.lineWidth = lw;

    for (let sr = 0; sr < rows; sr++) {
        for (let sc = 0; sc < cols - 1; sc++) {
            if (vBound[sr][sc]) {
                const x = gap + (sc + 1) * (secPx + gap) - gap / 2;
                const y1 = gap + sr * (secPx + gap);
                const y2 = y1 + secPx;
                c.beginPath();
                c.moveTo(x, y1);
                c.lineTo(x, y2);
                c.stroke();
            }
        }
    }
    for (let sr = 0; sr < rows - 1; sr++) {
        for (let sc = 0; sc < cols; sc++) {
            if (hBound[sr][sc]) {
                const y = gap + (sr + 1) * (secPx + gap) - gap / 2;
                const x1 = gap + sc * (secPx + gap);
                const x2 = x1 + secPx;
                c.beginPath();
                c.moveTo(x1, y);
                c.lineTo(x2, y);
                c.stroke();
            }
        }
    }
}

function render() {
    renderOnCanvas(canvas, ctx, currentGrid, currentVBound, currentHBound, hoverR, hoverC, showDots, showLetters);
}

// ── Interaction ──

function getSection(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const rows = currentGrid.length;
    const cols = currentGrid[0].length;
    const SEC = 4;
    const maxPx = Math.min(800, window.innerWidth - 60);
    const cellSize = Math.max(4, Math.floor(maxPx / (cols * SEC + cols)));
    const gap = Math.max(1, Math.floor(cellSize * 0.15));
    const secPx = SEC * cellSize;
    const stride = secPx + gap;

    const sc = Math.floor((mx - gap) / stride);
    const sr = Math.floor((my - gap) / stride);
    if (sr >= 0 && sr < rows && sc >= 0 && sc < cols) return [sr, sc];
    return null;
}

canvas.addEventListener("click", function (e) {
    const sec = getSection(e);
    if (sec) zoomIn(sec[0], sec[1]);
});

canvas.addEventListener("mousemove", function (e) {
    const sec = getSection(e);
    const oldR = hoverR, oldC = hoverC;
    if (sec) { hoverR = sec[0]; hoverC = sec[1]; }
    else { hoverR = -1; hoverC = -1; }
    if (hoverR !== oldR || hoverC !== oldC) render();
});

canvas.addEventListener("mouseleave", function () {
    hoverR = -1; hoverC = -1;
    render();
});

document.getElementById("btn-out").addEventListener("click", zoomOut);
document.getElementById("btn-reset").addEventListener("click", initRootGrid);

const btnDots = document.getElementById("btn-dots");
btnDots.addEventListener("click", function () {
    showDots = !showDots;
    btnDots.textContent = "Dots: " + (showDots ? "On" : "Off");
    btnDots.classList.toggle("active", showDots);
    render();
});

const btnLetters = document.getElementById("btn-letters");
btnLetters.addEventListener("click", function () {
    showLetters = !showLetters;
    btnLetters.textContent = "Letters: " + (showLetters ? "On" : "Off");
    btnLetters.classList.toggle("active", showLetters);
    render();
});

document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
        if (zoomStack.length > 0) zoomOut();
    }
});

// ── Universe View ──

const uniCanvas = document.getElementById("universe-canvas");
const uniCtx = uniCanvas ? uniCanvas.getContext("2d") : null;

let uniGrid, uniVBound, uniHBound, uniGridSize;
let uniZoomStack = [];
let uniHoverR = -1, uniHoverC = -1;
let uniShowDots = true;
let uniShowLetters = true;

function buildUniverseSeed() {
    // 2×2 seed: J(V66) | M(V56) / J×s_h(V73) | F(V77)
    let grid = [
        [[6, 6], [5, 6]],
        [[7, 3], [7, 7]],
    ];
    let vb = [[true, false], [true, false]];
    let hb = [[false, true], [false, false]];
    let ns = 2;

    // Expand twice: 2→4→8 (order 3 → 4 → 5)
    let exp = expandGrid(grid, vb, hb, ns);
    exp = expandGrid(exp.grid, exp.vBound, exp.hBound, exp.ns);
    return exp;
}

function initUniverse() {
    const seed = buildUniverseSeed();
    uniGridSize = seed.ns;
    uniGrid = seed.grid;
    uniVBound = seed.vBound;
    uniHBound = seed.hBound;
    uniZoomStack = [];
    updateUniUI();
    renderUniverse();
}

function uniZoomIn(row, col) {
    uniZoomStack.push({
        grid: uniGrid, vBound: uniVBound, hBound: uniHBound, ns: uniGridSize,
    });
    const expanded = expandGrid(uniGrid, uniVBound, uniHBound, uniGridSize);
    const ns2 = expanded.ns;
    const centerR = row * 2, centerC = col * 2;
    const halfWin = Math.floor(uniGridSize / 2);
    let startR = Math.max(0, centerR - halfWin + 1);
    let startC = Math.max(0, centerC - halfWin + 1);
    if (startR + uniGridSize > ns2) startR = Math.max(0, ns2 - uniGridSize);
    if (startC + uniGridSize > ns2) startC = Math.max(0, ns2 - uniGridSize);
    const viewRows = Math.min(uniGridSize, ns2);
    const viewCols = Math.min(uniGridSize, ns2);

    uniGrid = Array.from({ length: viewRows }, (_, r) =>
        Array.from({ length: viewCols }, (_, c) =>
            [...expanded.grid[startR + r][startC + c]],
        ),
    );
    uniVBound = Array.from({ length: viewRows }, (_, r) =>
        Array.from({ length: viewCols }, (_, c) => {
            const sc = startC + c;
            return sc < ns2 - 1 ? expanded.vBound[startR + r][sc] : false;
        }),
    );
    uniHBound = Array.from({ length: viewRows }, (_, r) =>
        Array.from({ length: viewCols }, (_, c) => {
            const sr = startR + r;
            return sr < ns2 - 1 ? expanded.hBound[sr][startC + c] : false;
        }),
    );
    updateUniUI();
    renderUniverse();
}

function uniZoomOut() {
    if (uniZoomStack.length === 0) return;
    const prev = uniZoomStack.pop();
    uniGrid = prev.grid;
    uniVBound = prev.vBound;
    uniHBound = prev.hBound;
    uniGridSize = prev.ns;
    updateUniUI();
    renderUniverse();
}

function updateUniUI() {
    const level = uniZoomStack.length;
    const order = 5 + level;
    document.getElementById("uni-zoom-info").textContent =
        "Level " + level + " \u2014 Order " + order +
        " (" + uniGridSize + "\u00d7" + uniGridSize + " window)";
    document.getElementById("btn-uni-out").disabled = level === 0;
    const pathEl = document.getElementById("uni-zoom-path");
    if (level === 0) {
        pathEl.textContent = "";
    } else {
        pathEl.textContent = "Zoom depth: " + level +
            " (click Zoom Out or Reset to navigate back)";
    }
}

function renderUniverse() {
    if (!uniCtx) return;
    renderOnCanvas(uniCanvas, uniCtx, uniGrid, uniVBound, uniHBound,
        uniHoverR, uniHoverC, uniShowDots, uniShowLetters);
}

function getUniSection(e) {
    const rect = uniCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const rows = uniGrid.length;
    const cols = uniGrid[0].length;
    const SEC = 4;
    const maxPx = Math.min(800, window.innerWidth - 60);
    const cellSize = Math.max(4, Math.floor(maxPx / (cols * SEC + cols)));
    const gap = Math.max(1, Math.floor(cellSize * 0.15));
    const stride = SEC * cellSize + gap;
    const sc = Math.floor((mx - gap) / stride);
    const sr = Math.floor((my - gap) / stride);
    if (sr >= 0 && sr < rows && sc >= 0 && sc < cols) return [sr, sc];
    return null;
}

if (uniCanvas) {
    uniCanvas.addEventListener("click", function (e) {
        const sec = getUniSection(e);
        if (sec) uniZoomIn(sec[0], sec[1]);
    });

    uniCanvas.addEventListener("mousemove", function (e) {
        const sec = getUniSection(e);
        const oldR = uniHoverR, oldC = uniHoverC;
        if (sec) { uniHoverR = sec[0]; uniHoverC = sec[1]; }
        else { uniHoverR = -1; uniHoverC = -1; }
        if (uniHoverR !== oldR || uniHoverC !== oldC) renderUniverse();
    });

    uniCanvas.addEventListener("mouseleave", function () {
        uniHoverR = -1; uniHoverC = -1;
        renderUniverse();
    });

    document.getElementById("btn-uni-out").addEventListener("click", uniZoomOut);
    document.getElementById("btn-uni-reset").addEventListener("click", initUniverse);

    const btnUniDots = document.getElementById("btn-uni-dots");
    btnUniDots.addEventListener("click", function () {
        uniShowDots = !uniShowDots;
        btnUniDots.textContent = "Dots: " + (uniShowDots ? "On" : "Off");
        btnUniDots.classList.toggle("active", uniShowDots);
        renderUniverse();
    });

    const btnUniLetters = document.getElementById("btn-uni-letters");
    btnUniLetters.addEventListener("click", function () {
        uniShowLetters = !uniShowLetters;
        btnUniLetters.textContent = "Letters: " + (uniShowLetters ? "On" : "Off");
        btnUniLetters.classList.toggle("active", uniShowLetters);
        renderUniverse();
    });
}

// ── Init ──
buildSubTable();
buildCodeList();
initUniverse();
initRootGrid();
