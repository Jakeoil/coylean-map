// ═══════════════════════════════════════════════════
//  Coylean Glyphs — 4×4 Section Catalog
// ═══════════════════════════════════════════════════

// Canvas size for each glyph
const CELL_PX = 16;
const DOT_R = 2.5;
const MARGIN = 10;
const NUM_CELLS = 3;
const GRID_CELLS = NUM_CELLS + 1; // includes exit segment column/row
const CANVAS_SIZE = CELL_PX * GRID_CELLS + MARGIN * 2;

// ── Coylean Algorithm (duplicated from coylean.js — no module system) ──

function computeMaxPri(ds, rs) {
    if (ds < rs) ds = rs;
    for (let i = 0; i < 32; i++) {
        if (ds < 1) return i;
        ds = Math.floor(ds / 2);
    }
    return 32;
}

const MAX_PRI = computeMaxPri(NUM_CELLS, NUM_CELLS);

function priority(i) {
    for (let j = 0; j < MAX_PRI; j++) {
        if (i % 2 !== 0) return j;
        i = Math.floor(i / 2);
    }
    return MAX_PRI;
}

// ── Glyph Renderer — uses the real Coylean algorithm ──

// D4 transform index → [scaleX, scaleY] for letter overlay
// s_h = flip upside down (horizontal axis mirror), s_v = flip left/right (vertical axis mirror)
const D4_TO_SCALE = {
    0: [1, 1],      // e
    2: [-1, -1],    // r²
    4: [1, -1],     // s_h
    5: [-1, 1],     // s_v
};

// Populated after V_CLASSES is computed: "d,r" → [letter, scaleX, scaleY]
let GLYPH_LETTERS = {};

function assignLetter(classes, downCode, rightCode, letter) {
    for (const cls of classes) {
        if (cls.orbit.some(([d, r]) => d === downCode && r === rightCode)) {
            // Compute transforms relative to the specified glyph (not the orbit rep)
            const base = computePattern(downCode, rightCode, true);
            for (let i = 0; i < cls.orbit.length; i++) {
                const [d, r] = cls.orbit[i];
                const mem = computePattern(d, r, true);
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

function drawGlyph(canvas, downCode, rightCode, verticalWinsTies, fTransform) {
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Initialize arrows from the 3-bit codes
    const downArrows = [!!(downCode & 1), !!(downCode & 2), !!(downCode & 4)];
    const rightArrows = [
        !!(rightCode & 1),
        !!(rightCode & 2),
        !!(rightCode & 4),
    ];

    // Convert grid position to pixel coordinate
    function px(gridPos) {
        return MARGIN + gridPos * CELL_PX;
    }

    // Input dots
    for (let x = 0; x < 3; x++) {
        drawDot(ctx, px(x + 1), px(0), !!(downCode & (1 << x)));
    }
    for (let y = 0; y < 3; y++) {
        drawDot(ctx, px(0), px(y + 1), !!(rightCode & (1 << y)));
    }

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.2;

    let y_place = 0;
    for (let y = 0; y < NUM_CELLS; y++) {
        let x_place = 0;
        for (let x = 0; x < NUM_CELLS; x++) {
            let down = downArrows[x];
            let right = rightArrows[y];

            const downPri = priority(x + 1);
            const rightPri = priority(y + 1);

            if (verticalWinsTies ? downPri >= rightPri : downPri > rightPri) {
                if (down) right = !right;
            } else {
                if (right) down = !down;
            }

            const cx = px(0) + x_place;
            const cy = px(0) + y_place;
            const x_r = cx + CELL_PX;
            const y_b = cy + CELL_PX;

            if (downArrows[x]) {
                ctx.beginPath();
                ctx.moveTo(x_r, cy);
                ctx.lineTo(x_r, y_b);
                ctx.stroke();
            }
            if (rightArrows[y]) {
                ctx.beginPath();
                ctx.moveTo(cx, y_b);
                ctx.lineTo(x_r, y_b);
                ctx.stroke();
            }

            // Update arrows for next iteration
            downArrows[x] = down;
            rightArrows[y] = right;
            x_place += CELL_PX;
        }

        // Draw the final right value exiting the row
        if (rightArrows[y]) {
            const cx = px(0) + x_place;
            const cy = px(0) + y_place;
            const y_b = cy + CELL_PX;
            ctx.beginPath();
            ctx.moveTo(cx, y_b);
            ctx.lineTo(cx + CELL_PX, y_b);
            ctx.stroke();
        }

        y_place += CELL_PX;
    }

    for (let x = 0; x < NUM_CELLS; x++) {
        if (downArrows[x]) {
            const x_r = px(0) + (x + 1) * CELL_PX;
            const cy = px(0) + y_place;
            ctx.beginPath();
            ctx.moveTo(x_r, cy);
            ctx.lineTo(x_r, cy + CELL_PX);
            ctx.stroke();
        }
    }

    // Output dots
    for (let y = 0; y < 3; y++) {
        drawDot(ctx, px(GRID_CELLS), px(y + 1), rightArrows[y]);
    }
    for (let x = 0; x < 3; x++) {
        drawDot(ctx, px(x + 1), px(GRID_CELLS), downArrows[x]);
    }

    // Letter overlay
    if (fTransform) {
        const gridCx = MARGIN + (GRID_CELLS * CELL_PX) / 2;
        const gridCy = MARGIN + (GRID_CELLS * CELL_PX) / 2;
        ctx.save();
        ctx.translate(gridCx, gridCy);
        ctx.scale(fTransform[1], fTransform[2]);
        ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
        ctx.font =
            "bold " + NUM_CELLS * CELL_PX + "px Monaco, Menlo, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(fTransform[0], 0, 0);
        ctx.restore();
    }
}

function drawDot(ctx, x, y, filled, r) {
    ctx.beginPath();
    ctx.arc(x, y, r || DOT_R, 0, Math.PI * 2);
    if (filled) {
        ctx.fillStyle = "#000";
        ctx.fill();
    } else {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = (r || DOT_R) * 0.32;
        ctx.stroke();
    }
}

// ── Build 8×8 Grid ──

function buildGrid(tableId, prefix, verticalWinsTies) {
    const table = document.getElementById(tableId);

    // Header row
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const corner = document.createElement("th");
    corner.className = "corner-label";
    corner.textContent = "right \\ down";
    headerRow.appendChild(corner);

    for (let r = 0; r < 8; r++) {
        const th = document.createElement("th");
        th.className = "col-header";
        th.textContent = r + " = " + r.toString(2).padStart(3, "0");
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Data rows
    const tbody = document.createElement("tbody");
    for (let d = 0; d < 8; d++) {
        const row = document.createElement("tr");

        const rowHeader = document.createElement("th");
        rowHeader.className = "row-header";
        rowHeader.textContent = d + " = " + d.toString(2).padStart(3, "0");
        row.appendChild(rowHeader);

        for (let r = 0; r < 8; r++) {
            const td = document.createElement("td");
            const canvas = document.createElement("canvas");
            const ft = verticalWinsTies ? GLYPH_LETTERS[d + "," + r] : null;
            drawGlyph(canvas, d, r, verticalWinsTies, ft);
            td.appendChild(canvas);
            const label = document.createElement("div");
            label.className = "glyph-label";
            label.textContent = glyphName(prefix, d, r);
            td.appendChild(label);
            row.appendChild(td);
        }
        tbody.appendChild(row);
    }
    table.appendChild(tbody);
}

// ── D4 Visual Equivalence ──
//
// Two glyphs are equivalent under D4 if one's visual segment pattern
// can be rotated/reflected to match the other's. We classify by the
// rendered output, not the input codes, because the Coylean algorithm's
// XOR propagation breaks input-level symmetry.
//
// Visual pattern representation:
//   v[x][y]: vertical segment at col x+1, rows y to y+1  (x: 0-2, y: 0-3)
//   h[x][y]: horizontal segment at row y+1, cols x to x+1 (x: 0-3, y: 0-2)
//
// D4 transforms on this 4×4 segment grid:
//   e    : v'[a][b] = v[a][b],       h'[a][b] = h[a][b]
//   r    : v'[a][b] = h[3-b][a],     h'[a][b] = v[2-b][a]
//   r²   : v'[a][b] = v[2-a][3-b],   h'[a][b] = h[3-a][2-b]
//   r³   : v'[a][b] = h[b][2-a],     h'[a][b] = v[b][3-a]
//   s_h  : v'[a][b] = v[a][3-b],     h'[a][b] = h[a][2-b]
//   s_v  : v'[a][b] = v[2-a][b],     h'[a][b] = h[3-a][b]
//   s_d1 : v'[a][b] = h[b][a],       h'[a][b] = v[b][a]
//   s_d2 : v'[a][b] = h[3-b][2-a],   h'[a][b] = v[2-b][3-a]

function computePattern(downCode, rightCode, verticalWinsTies) {
    const downArrows = [!!(downCode & 1), !!(downCode & 2), !!(downCode & 4)];
    const rightArrows = [
        !!(rightCode & 1),
        !!(rightCode & 2),
        !!(rightCode & 4),
    ];

    const v = Array.from({ length: 3 }, () => Array(4).fill(false));
    const h = Array.from({ length: 4 }, () => Array(3).fill(false));

    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            let down = downArrows[x];
            let right = rightArrows[y];
            const downPri = priority(x + 1);
            const rightPri = priority(y + 1);
            if (verticalWinsTies ? downPri >= rightPri : downPri > rightPri) {
                if (down) right = !right;
            } else {
                if (right) down = !down;
            }
            if (downArrows[x]) v[x][y] = true;
            if (rightArrows[y]) h[x][y] = true;
            downArrows[x] = down;
            rightArrows[y] = right;
        }
        if (rightArrows[y]) h[3][y] = true;
    }
    for (let x = 0; x < 3; x++) {
        if (downArrows[x]) v[x][3] = true;
    }
    return { v, h };
}

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

const D4_NAMES = ["e", "r", "r\u00B2", "r\u00B3", "s_h", "s_v", "s_d1", "s_d2"];

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

// Unicode subscript digits: ₀₁₂₃₄₅₆₇
const SUB_DIGITS = "\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087";

function glyphName(prefix, d, r) {
    return prefix + SUB_DIGITS[d] + SUB_DIGITS[r];
}

function pairKey(d, r) {
    return d * 8 + r;
}

function classifyVisualD4(verticalWinsTies) {
    const glyphs = [];
    for (let d = 0; d < 8; d++) {
        for (let r = 0; r < 8; r++) {
            const { v, h } = computePattern(d, r, verticalWinsTies);
            let canonKey = Infinity;
            const keys = [];
            for (let ti = 0; ti < 8; ti++) {
                const k = transformedPatternKey(v, h, ti);
                keys.push(k);
                if (k < canonKey) canonKey = k;
            }
            glyphs.push({ d, r, v, h, canonKey, keys });
        }
    }

    const groups = new Map();
    for (const g of glyphs) {
        if (!groups.has(g.canonKey)) groups.set(g.canonKey, []);
        groups.get(g.canonKey).push(g);
    }

    const classes = [];
    for (const members of groups.values()) {
        const orbit = members.map((m) => [m.d, m.r]);
        orbit.sort((a, b) => pairKey(a[0], a[1]) - pairKey(b[0], b[1]));
        const rep = orbit[0];
        const rm = members.find((m) => m.d === rep[0] && m.r === rep[1]);
        const repKey = rm.keys[0]; // identity = original pattern

        // For each orbit member, find which D4 transform maps rep → member
        const transforms = orbit.map(([d, r]) => {
            const m = members.find((x) => x.d === d && x.r === r);
            const mKey = m.keys[0];
            for (let ti = 0; ti < 8; ti++) {
                if (transformedPatternKey(rm.v, rm.h, ti) === mKey) return ti;
            }
            return 0;
        });

        classes.push({ rep, orbit, transforms, orbitSize: orbit.length });
    }

    classes.sort(
        (a, b) => pairKey(a.rep[0], a.rep[1]) - pairKey(b.rep[0], b.rep[1]),
    );
    return classes;
}

function buildEquivalenceClasses(
    containerId,
    prefix,
    verticalWinsTies,
    classes,
) {
    const container = document.getElementById(containerId);

    // Sort by orbit size (1, 2, 4), then by rep
    const sorted = [...classes].sort((a, b) => {
        if (a.orbitSize !== b.orbitSize) return a.orbitSize - b.orbitSize;
        return pairKey(a.rep[0], a.rep[1]) - pairKey(b.rep[0], b.rep[1]);
    });

    // Pack multiple groups per line; separate lines when orbit size changes
    let lastSize = 0;
    let line = null;

    for (const cls of sorted) {
        if (cls.orbitSize !== lastSize) {
            if (lastSize > 0) {
                const sep = document.createElement("div");
                sep.className = "eq-separator";
                container.appendChild(sep);
            }
            lastSize = cls.orbitSize;
            line = null;
        }

        if (!line) {
            line = document.createElement("div");
            line.className = "eq-line";
            container.appendChild(line);
        }

        const group = document.createElement("div");
        group.className = "eq-group " + (cls.colorClass || "both");

        for (let i = 0; i < cls.orbit.length; i++) {
            const [d, r] = cls.orbit[i];
            const cell = document.createElement("div");
            cell.className = "eq-cell";

            const canvas = document.createElement("canvas");
            const ft2 = verticalWinsTies ? GLYPH_LETTERS[d + "," + r] : null;
            drawGlyph(canvas, d, r, verticalWinsTies, ft2);
            cell.appendChild(canvas);

            const nameLabel = document.createElement("div");
            nameLabel.className = "sym-name";
            nameLabel.textContent = glyphName(prefix, d, r);
            cell.appendChild(nameLabel);

            const transformLabel = document.createElement("div");
            transformLabel.className = "transform";
            transformLabel.textContent = D4_NAMES[cls.transforms[i]];
            cell.appendChild(transformLabel);

            group.appendChild(cell);
        }

        line.appendChild(group);
    }
}

function orbitKey(cls) {
    return cls.orbit.map((m) => pairKey(m[0], m[1])).join(",");
}

// ── Coylean Map ──

function drawCoyleanMap(canvasEl, N, cell) {
    const M = N + 1;
    const maxP = computeMaxPri(M, M);
    const size = M * cell;
    canvasEl.width = canvasEl.height = size;

    function pri(i) {
        for (let j = 0; j < maxP; j++) {
            if (i % 2 !== 0) return j;
            i = Math.floor(i / 2);
        }
        return maxP;
    }

    const ctx = canvasEl.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);

    const d = new Array(M).fill(false);
    const r = new Array(M).fill(false);
    d[0] = true;

    const lw = cell * 1.2 / CELL_PX;
    ctx.lineWidth = lw;

    for (let y = 0; y < M; y++) {
        const rp = pri(y);
        for (let x = 0; x < M; x++) {
            const preD = d[x];
            const preR = r[y];
            const dp = pri(x);

            if (dp >= rp) {
                if (preD) r[y] = !r[y];
            } else {
                if (preR) d[x] = !d[x];
            }

            const xr = (x + 1) * cell;
            const yb = (y + 1) * cell;

            if (preD) {
                ctx.strokeStyle = dp < 2 ? "#90caf9" : "#000";
                ctx.beginPath();
                ctx.moveTo(xr, y * cell);
                ctx.lineTo(xr, yb);
                ctx.stroke();
            }
            if (preR) {
                ctx.strokeStyle = rp < 2 ? "#90caf9" : "#000";
                ctx.beginPath();
                ctx.moveTo(x * cell, yb);
                ctx.lineTo(xr, yb);
                ctx.stroke();
            }
        }
    }

    // Find all sections matching V77's orbit and overlay F
    // Re-run algorithm to capture section input codes
    const SEC = 4;
    const NS = N / SEC; // 8 sections per axis
    const secCodes = Array.from({length: NS}, () =>
        Array.from({length: NS}, () => [0, 0])
    );
    {
        const d2 = new Array(M).fill(false);
        const r2 = new Array(M).fill(false);
        d2[0] = true;

        for (let y = 0; y < M; y++) {
            const rp2 = pri(y);
            const yRel = y - 1;
            const sr = Math.floor(yRel / SEC);
            const rowInSec = yRel % SEC;
            const isSecRow = y >= 1 && sr < NS && rowInSec < 3;

            for (let x = 0; x < M; x++) {
                const preD2 = d2[x];
                const preR2 = r2[y];
                const xRel = x - 1;
                const sc = Math.floor(xRel / SEC);
                const colInSec = xRel % SEC;

                // Capture down inputs at first interior row of each section
                if (isSecRow && rowInSec === 0 && x >= 1 && sc < NS && colInSec < 3) {
                    if (preD2) secCodes[sr][sc][0] |= (1 << colInSec);
                }
                // Capture right inputs at first interior column of each section
                if (isSecRow && x >= 1 && sc < NS && colInSec === 0) {
                    if (preR2) secCodes[sr][sc][1] |= (1 << rowInSec);
                }

                if (pri(x) >= rp2) {
                    if (preD2) r2[y] = !r2[y];
                } else {
                    if (preR2) d2[x] = !d2[x];
                }
            }
        }
    }

    // Draw overlays on all sections
    for (let sr = 0; sr < NS; sr++) {
        for (let sc = 0; sc < NS; sc++) {
            const [dc, rc] = secCodes[sr][sc];
            const ft = GLYPH_LETTERS[dc + "," + rc];

            const sx = (sc * SEC + 1) * cell;
            const sy = (sr * SEC + 1) * cell;
            const cx = sx + 2 * cell;
            const cy = sy + 2 * cell;

            if (ft) {
                // Assigned letter: draw brown lines, dots, and transformed letter
                const da = [!!(dc & 1), !!(dc & 2), !!(dc & 4)];
                const ra = [!!(rc & 1), !!(rc & 2), !!(rc & 4)];

                ctx.strokeStyle = "#c9a96e";
                ctx.lineWidth = lw;

                for (let gy = 0; gy < 3; gy++) {
                    for (let gx = 0; gx < 3; gx++) {
                        let dv = da[gx], rv = ra[gy];
                        const dp = priority(gx + 1), rp = priority(gy + 1);
                        if (dp >= rp) { if (dv) rv = !rv; }
                        else          { if (rv) dv = !dv; }

                        const x0 = sx + gx * cell, y0 = sy + gy * cell;
                        if (da[gx]) {
                            ctx.beginPath();
                            ctx.moveTo(x0 + cell, y0);
                            ctx.lineTo(x0 + cell, y0 + cell);
                            ctx.stroke();
                        }
                        if (ra[gy]) {
                            ctx.beginPath();
                            ctx.moveTo(x0, y0 + cell);
                            ctx.lineTo(x0 + cell, y0 + cell);
                            ctx.stroke();
                        }
                        da[gx] = dv;
                        ra[gy] = rv;
                    }
                    if (ra[gy]) {
                        ctx.beginPath();
                        ctx.moveTo(sx + 3 * cell, sy + (gy + 1) * cell);
                        ctx.lineTo(sx + 4 * cell, sy + (gy + 1) * cell);
                        ctx.stroke();
                    }
                }
                for (let gx = 0; gx < 3; gx++) {
                    if (da[gx]) {
                        ctx.beginPath();
                        ctx.moveTo(sx + (gx + 1) * cell, sy + 3 * cell);
                        ctx.lineTo(sx + (gx + 1) * cell, sy + 4 * cell);
                        ctx.stroke();
                    }
                }

                const dr = cell * DOT_R / CELL_PX;
                for (let i = 0; i < 3; i++) {
                    drawDot(ctx, sx + (i + 1) * cell, sy, !!(dc & (1 << i)), dr);
                    drawDot(ctx, sx, sy + (i + 1) * cell, !!(rc & (1 << i)), dr);
                    drawDot(ctx, sx + (i + 1) * cell, sy + 4 * cell, da[i], dr);
                    drawDot(ctx, sx + 4 * cell, sy + (i + 1) * cell, ra[i], dr);
                }

                ctx.save();
                ctx.translate(cx, cy);
                ctx.scale(ft[1], ft[2]);
                ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
                ctx.font = "bold " + (3 * cell) + "px Monaco, Menlo, monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(ft[0], 0, 0);
                ctx.restore();
            } else {
                // Unassigned: show V label
                ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
                ctx.font = (cell * 0.7) + "px Monaco, Menlo, monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("V" + SUB_DIGITS[dc] + SUB_DIGITS[rc], cx, cy);
            }
        }
    }
}

// ── Init ──
const V_CLASSES = classifyVisualD4(true);
const H_CLASSES = classifyVisualD4(false);

// Find which orbits are shared between V and H
const vOrbitKeys = new Set(V_CLASSES.map(orbitKey));
const hOrbitKeys = new Set(H_CLASSES.map(orbitKey));

V_CLASSES.forEach((c) => {
    c.colorClass = hOrbitKeys.has(orbitKey(c)) ? "both" : "v-only";
});
H_CLASSES.forEach((c) => {
    c.colorClass = vOrbitKeys.has(orbitKey(c)) ? "both" : "h-only";
});

// Assign letters to glyph families
assignLetter(V_CLASSES, 7, 7, "F");
assignLetter(V_CLASSES, 1, 7, "P");
assignLetter(V_CLASSES, 6, 6, "J");
assignLetter(V_CLASSES, 5, 6, "M");
assignLetter(V_CLASSES, 0, 0, "O");
assignLetter(V_CLASSES, 1, 1, "L");
assignLetter(V_CLASSES, 2, 5, "Q");
assignLetter(V_CLASSES, 5, 7, "R");
assignLetter(V_CLASSES, 1, 5, "B");
assignLetter(V_CLASSES, 5, 1, "Y");
assignLetter(V_CLASSES, 3, 7, "r");
assignLetter(V_CLASSES, 1, 6, "S");

const mapCanvas = document.getElementById("coylean-map");
if (mapCanvas) drawCoyleanMap(mapCanvas, 32, CELL_PX);

const mapCanvas6 = document.getElementById("coylean-map-6");
if (mapCanvas6) drawCoyleanMap(mapCanvas6, 64, 8);

buildGrid("v-grid", "V", true);
buildEquivalenceClasses("v-eq-classes", "V", true, V_CLASSES);
buildGrid("h-grid", "H", false);
buildEquivalenceClasses("h-eq-classes", "H", false, H_CLASSES);
