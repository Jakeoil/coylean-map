// ═══════════════════════════════════════════════════
//  Coylean Glyphs — 4×4 Section Catalog
// ═══════════════════════════════════════════════════

import {
    pri,
    propagateFromBoundary,
} from "../coylean-explorer/coylean-core.js";

// ── Baby Blocks (lazy-loaded) ──
let babyBlocks = null;
let useBabyBlocks = false;
let babyBlocksOutline = true;

// Canvas size for each glyph
const CELL_PX = 16;
const DOT_R = 2.5;
const MARGIN = 10;
const NUM_CELLS = 3;
const GRID_CELLS = NUM_CELLS + 1; // includes exit segment column/row
const CANVAS_SIZE = CELL_PX * GRID_CELLS + MARGIN * 2;

// Boundary inputs for a 3-bit code: bit i becomes initBoundary[i].
function bitsToBoundary(code, n) {
    const arr = new Array(n);
    for (let i = 0; i < n; i++) arr[i] = !!(code & (1 << i));
    return arr;
}

// ── Glyph Renderer — uses the real Coylean algorithm ──

// D4 transform index → [scaleX, scaleY] for letter overlay
// s_h = flip upside down (horizontal axis mirror), s_v = flip left/right (vertical axis mirror)
const D4_TO_SCALE = {
    0: [1, 1], // e
    2: [-1, -1], // r²
    4: [1, -1], // s_h
    5: [-1, 1], // s_v
};

// Populated after V_CLASSES is computed: "d,r" → [letter, scaleX, scaleY]
let GLYPH_LETTERS = {};
let H_GLYPH_LETTERS = {};

function assignLetter(
    classes,
    downCode,
    rightCode,
    letter,
    target = GLYPH_LETTERS,
    verticalWinsTies = true,
) {
    for (const cls of classes) {
        if (cls.orbit.some(([d, r]) => d === downCode && r === rightCode)) {
            // Compute transforms relative to the specified glyph (not the orbit rep)
            const base = computePattern(downCode, rightCode, verticalWinsTies);
            for (let i = 0; i < cls.orbit.length; i++) {
                const [d, r] = cls.orbit[i];
                const mem = computePattern(d, r, verticalWinsTies);
                const memKey = transformedPatternKey(mem.v, mem.h, 0);
                for (let ti = 0; ti < 8; ti++) {
                    if (transformedPatternKey(base.v, base.h, ti) === memKey) {
                        const scale = D4_TO_SCALE[ti];
                        if (scale)
                            target[d + "," + r] = [letter, scale[0], scale[1]];
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

    // Propagate the 3×3 glyph using the shared core. hInitCol/vInitRow=1
    // matches the original priority(x+1)/priority(y+1) tie-breaking.
    const [downMatrix, rightMatrix] = propagateFromBoundary(
        bitsToBoundary(downCode, NUM_CELLS),
        bitsToBoundary(rightCode, NUM_CELLS),
        1,
        1,
        !verticalWinsTies,
    );

    // Vertical segments at col x+1, rows y..y+1
    for (let y = 0; y <= NUM_CELLS; y++) {
        for (let x = 0; x < NUM_CELLS; x++) {
            if (downMatrix[y][x]) {
                const x_r = px(x + 1);
                const cy = px(y);
                ctx.beginPath();
                ctx.moveTo(x_r, cy);
                ctx.lineTo(x_r, cy + CELL_PX);
                ctx.stroke();
            }
        }
    }
    // Horizontal segments at row y+1, cols x..x+1
    for (let x = 0; x <= NUM_CELLS; x++) {
        for (let y = 0; y < NUM_CELLS; y++) {
            if (rightMatrix[x][y]) {
                const cx = px(x);
                const y_b = px(y + 1);
                ctx.beginPath();
                ctx.moveTo(cx, y_b);
                ctx.lineTo(cx + CELL_PX, y_b);
                ctx.stroke();
            }
        }
    }

    // Output dots: final row of downMatrix, final column of rightMatrix
    for (let y = 0; y < 3; y++) {
        drawDot(ctx, px(GRID_CELLS), px(y + 1), rightMatrix[NUM_CELLS][y]);
    }
    for (let x = 0; x < 3; x++) {
        drawDot(ctx, px(x + 1), px(GRID_CELLS), downMatrix[NUM_CELLS][x]);
    }

    // Letter overlay
    // fTransform: [letter, scaleX, scaleY, color, backslash]
    if (fTransform) {
        const gridCx = MARGIN + (GRID_CELLS * CELL_PX) / 2;
        const gridCy = MARGIN + (GRID_CELLS * CELL_PX) / 2;
        const fontSize = NUM_CELLS * CELL_PX;

        if (useBabyBlocks && babyBlocks) {
            const d4 = ftToD4Glyph(fTransform);
            const blockSize = GRID_CELLS * CELL_PX;
            ctx.save();
            ctx.globalAlpha = 0.45;
            babyBlocks.drawDirect(
                ctx,
                fTransform[0],
                gridCx,
                gridCy,
                blockSize,
                {
                    transform: d4,
                    outline: babyBlocksOutline,
                },
            );
            ctx.restore();
        } else {
            ctx.save();
            ctx.translate(gridCx, gridCy + fontSize * 0.05 * fTransform[2]);
            if (fTransform[4]) ctx.transform(0, 1, 1, 0, 0, 0);
            ctx.scale(fTransform[1], fTransform[2]);
            ctx.fillStyle = fTransform[3] || "rgba(0, 0, 100, 0.4)";
            ctx.font = "bold " + fontSize + "px Monaco, Menlo, monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(fTransform[0], 0, 0);
            ctx.restore();
        }
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
            let ft = null;
            if (verticalWinsTies) {
                ft = GLYPH_LETTERS[d + "," + r];
            } else {
                const hft = H_GLYPH_LETTERS[d + "," + r];
                if (hft)
                    ft = [hft[0], hft[1], hft[2], "rgba(139, 0, 0, 0.5)", true];
            }
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
    const [downMatrix, rightMatrix] = propagateFromBoundary(
        bitsToBoundary(downCode, NUM_CELLS),
        bitsToBoundary(rightCode, NUM_CELLS),
        1,
        1,
        !verticalWinsTies,
    );
    // v[x][y] = vertical at col x+1, row y; h[x][y] = horizontal at row y+1, col x
    const v = Array.from({ length: 3 }, () => Array(4).fill(false));
    const h = Array.from({ length: 4 }, () => Array(3).fill(false));
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 3; x++) {
            v[x][y] = !!downMatrix[y][x];
        }
    }
    for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 3; y++) {
            h[x][y] = !!rightMatrix[x][y];
        }
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
            let ft2 = null;
            if (verticalWinsTies) {
                ft2 = GLYPH_LETTERS[d + "," + r];
            } else {
                const hft = H_GLYPH_LETTERS[d + "," + r];
                if (hft)
                    ft2 = [
                        hft[0],
                        hft[1],
                        hft[2],
                        "rgba(139, 0, 0, 0.5)",
                        true,
                    ];
            }
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

function drawCoyleanMap(canvasEl, Nr, Nc, cell, opts) {
    const mapBB = opts && opts.babyBlocks;
    const mapBBOutline = opts ? opts.outline : true;
    const horizontalWinsTies = !!(opts && opts.horizontalWinsTies);
    const Mr = Nr + 1;
    const Mc = Nc + 1;
    const w = Mc * cell;
    const h = Mr * cell;
    canvasEl.width = w;
    canvasEl.height = h;

    const ctx = canvasEl.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);

    // Seed: SE-patch boundary input from the implicit larger map.
    // V uses a single down-arrow at col 0; H is the backslash dual,
    // so it uses a single right-arrow at row 0.
    const initDown = new Array(Mc).fill(false);
    const initRight = new Array(Mr).fill(false);
    if (horizontalWinsTies) initRight[0] = true;
    else initDown[0] = true;

    // hInitCol=vInitRow=0 keeps the axis cells (priority pri(0)=∞) as the
    // first row/column, matching glyphs.js's pri(x)/pri(y) convention.
    const [downMatrix, rightMatrix] = propagateFromBoundary(
        initDown,
        initRight,
        0,
        0,
        horizontalWinsTies,
    );

    const lw = (cell * 1.2) / CELL_PX;
    ctx.lineWidth = lw;

    // Section bookkeeping: capture input codes during the same pass that
    // draws segments. Each section is a 4×4 block whose interior is a 3×3
    // glyph; rowInSec/colInSec ∈ {0,1,2} are interior, ==3 is the exit edge.
    const SEC = 4;
    const NSr = Nr / SEC;
    const NSc = Nc / SEC;
    const secCodes = Array.from({ length: NSr }, () =>
        Array.from({ length: NSc }, () => [0, 0]),
    );

    for (let y = 0; y < Mr; y++) {
        const rp = pri(y);
        for (let x = 0; x < Mc; x++) {
            const preD = !!downMatrix[y][x];
            const preR = !!rightMatrix[x][y];
            const dp = pri(x);

            if (preD) {
                ctx.strokeStyle = dp < 2 ? "#90caf9" : "#000";
                ctx.beginPath();
                ctx.moveTo((x + 1) * cell, y * cell);
                ctx.lineTo((x + 1) * cell, (y + 1) * cell);
                ctx.stroke();
            }
            if (preR) {
                ctx.strokeStyle = rp < 2 ? "#90caf9" : "#000";
                ctx.beginPath();
                ctx.moveTo(x * cell, (y + 1) * cell);
                ctx.lineTo((x + 1) * cell, (y + 1) * cell);
                ctx.stroke();
            }
        }
    }

    // Capture section input codes by reading the propagated matrices at
    // the section-boundary cells. For section (sr, sc), the down inputs
    // come from downMatrix at y = sr*SEC+1 and x = sc*SEC+1+colInSec; the
    // right inputs come from rightMatrix at x = sc*SEC+1 and y = sr*SEC+1+rowInSec.
    for (let sr = 0; sr < NSr; sr++) {
        for (let sc = 0; sc < NSc; sc++) {
            const y0 = sr * SEC + 1;
            const x0 = sc * SEC + 1;
            for (let i = 0; i < 3; i++) {
                if (downMatrix[y0][x0 + i]) secCodes[sr][sc][0] |= 1 << i;
                if (rightMatrix[x0][y0 + i]) secCodes[sr][sc][1] |= 1 << i;
            }
        }
    }

    // Draw overlays on all sections
    for (let sr = 0; sr < NSr; sr++) {
        for (let sc = 0; sc < NSc; sc++) {
            const [dc, rc] = secCodes[sr][sc];
            let ft;
            if (horizontalWinsTies) {
                const hft = H_GLYPH_LETTERS[dc + "," + rc];
                if (hft)
                    ft = [hft[0], hft[1], hft[2], "rgba(139, 0, 0, 0.5)", true];
            } else {
                ft = GLYPH_LETTERS[dc + "," + rc];
            }

            const sx = (sc * SEC + 1) * cell;
            const sy = (sr * SEC + 1) * cell;
            const cx = sx + 2 * cell;
            const cy = sy + 2 * cell;

            if (ft) {
                // Assigned letter: draw overlay lines, dots, and transformed letter
                const [secDown, secRight] = propagateFromBoundary(
                    bitsToBoundary(dc, 3),
                    bitsToBoundary(rc, 3),
                    1,
                    1,
                    horizontalWinsTies,
                );

                ctx.strokeStyle = "#90caf9";
                ctx.lineWidth = lw;

                // Vertical segments at col gx+1 of the section
                for (let gy = 0; gy <= 3; gy++) {
                    for (let gx = 0; gx < 3; gx++) {
                        if (secDown[gy][gx]) {
                            ctx.beginPath();
                            ctx.moveTo(sx + (gx + 1) * cell, sy + gy * cell);
                            ctx.lineTo(
                                sx + (gx + 1) * cell,
                                sy + (gy + 1) * cell,
                            );
                            ctx.stroke();
                        }
                    }
                }
                // Horizontal segments at row gy+1 of the section
                for (let gx = 0; gx <= 3; gx++) {
                    for (let gy = 0; gy < 3; gy++) {
                        if (secRight[gx][gy]) {
                            ctx.beginPath();
                            ctx.moveTo(sx + gx * cell, sy + (gy + 1) * cell);
                            ctx.lineTo(
                                sx + (gx + 1) * cell,
                                sy + (gy + 1) * cell,
                            );
                            ctx.stroke();
                        }
                    }
                }

                const dr = (cell * DOT_R) / CELL_PX;
                for (let i = 0; i < 3; i++) {
                    drawDot(
                        ctx,
                        sx + (i + 1) * cell,
                        sy,
                        !!(dc & (1 << i)),
                        dr,
                    );
                    drawDot(
                        ctx,
                        sx,
                        sy + (i + 1) * cell,
                        !!(rc & (1 << i)),
                        dr,
                    );
                    drawDot(
                        ctx,
                        sx + (i + 1) * cell,
                        sy + 4 * cell,
                        secDown[3][i],
                        dr,
                    );
                    drawDot(
                        ctx,
                        sx + 4 * cell,
                        sy + (i + 1) * cell,
                        secRight[3][i],
                        dr,
                    );
                }

                if (mapBB && babyBlocks) {
                    const d4 = ftToD4Glyph(ft);
                    const blockSize = 4 * cell;
                    ctx.save();
                    ctx.globalAlpha = 0.45;
                    babyBlocks.drawDirect(ctx, ft[0], cx, cy, blockSize, {
                        transform: d4,
                        outline: mapBBOutline,
                    });
                    ctx.restore();
                } else {
                    const mapFontSize = 3 * cell;
                    ctx.save();
                    ctx.translate(cx, cy + mapFontSize * 0.05 * ft[2]);
                    if (ft[4]) ctx.transform(0, 1, 1, 0, 0, 0);
                    ctx.scale(ft[1], ft[2]);
                    ctx.fillStyle = ft[3] || "rgba(0, 0, 100, 0.4)";
                    ctx.font =
                        "bold " + mapFontSize + "px Monaco, Menlo, monospace";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(ft[0], 0, 0);
                    ctx.restore();
                }
            } else {
                // Unassigned: show placeholder label
                const prefix = horizontalWinsTies ? "H" : "V";
                ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
                ctx.font = cell * 0.7 + "px Monaco, Menlo, monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(prefix + SUB_DIGITS[dc] + SUB_DIGITS[rc], cx, cy);
            }
        }
    }
}

// ── Translation Table ──

function getSectionData(Nr, Nc, horizontalWinsTies) {
    const Mr = Nr + 1;
    const Mc = Nc + 1;
    const SEC = 4;
    const NSr = Nr / SEC;
    const NSc = Nc / SEC;

    const initDown = new Array(Mc).fill(false);
    const initRight = new Array(Mr).fill(false);
    if (horizontalWinsTies) initRight[0] = true;
    else initDown[0] = true;

    const [downMatrix, rightMatrix] = propagateFromBoundary(
        initDown,
        initRight,
        0,
        0,
        horizontalWinsTies,
    );

    const codes = Array.from({ length: NSr }, () =>
        Array.from({ length: NSc }, () => [0, 0]),
    );
    // vBound[sr][sc]: vertical segment at section sc's exit column, row sr
    // hBound[sr][sc]: horizontal segment at section sr's exit row, col sc
    const vBound = Array.from({ length: NSr }, () => Array(NSc).fill(false));
    const hBound = Array.from({ length: NSr }, () => Array(NSc).fill(false));

    for (let sr = 0; sr < NSr; sr++) {
        for (let sc = 0; sc < NSc; sc++) {
            const y0 = sr * SEC + 1;
            const x0 = sc * SEC + 1;
            // Section input codes: down arrows entering the section's first
            // interior row, right arrows entering its first interior column.
            for (let i = 0; i < 3; i++) {
                if (downMatrix[y0][x0 + i]) codes[sr][sc][0] |= 1 << i;
                if (rightMatrix[x0][y0 + i]) codes[sr][sc][1] |= 1 << i;
            }
            // Boundary segments live at colInSec=3 / rowInSec=3 — the 4th
            // cell of each section. Match the original semantics: vBound is
            // true if any cell along the section's exit column has a vertical
            // arrow; likewise for hBound along the exit row.
            if (sc < NSc - 1) {
                let any = false;
                for (let i = 0; i < 4; i++) {
                    if (downMatrix[y0 + i][x0 + 3]) {
                        any = true;
                        break;
                    }
                }
                vBound[sr][sc] = any;
            }
            if (sr < NSr - 1) {
                let any = false;
                for (let i = 0; i < 4; i++) {
                    if (rightMatrix[x0 + i][y0 + 3]) {
                        any = true;
                        break;
                    }
                }
                hBound[sr][sc] = any;
            }
        }
    }
    return { codes, NSr, NSc, vBound, hBound };
}

function glyphLabel(dc, rc) {
    const ft = GLYPH_LETTERS[dc + "," + rc];
    if (!ft) return "V" + SUB_DIGITS[dc] + SUB_DIGITS[rc];
    const [letter, sx, sy] = ft;
    if (sx === 1 && sy === 1) return letter;
    if (sx === 1 && sy === -1) return letter + "\u2195"; // ↕ s_h
    if (sx === -1 && sy === 1) return letter + "\u2194"; // ↔ s_v
    if (sx === -1 && sy === -1) return letter + "\u27F2"; // ⟲ r²
    return letter;
}

function hGlyphLabel(dc, rc) {
    const ft = H_GLYPH_LETTERS[dc + "," + rc];
    if (!ft) return "H" + SUB_DIGITS[dc] + SUB_DIGITS[rc];
    const [letter, sx, sy] = ft;
    const bs = "\\";
    if (sx === 1 && sy === 1) return letter + bs;
    if (sx === 1 && sy === -1) return letter + bs + "\u2195";
    if (sx === -1 && sy === 1) return letter + bs + "\u2194";
    if (sx === -1 && sy === -1) return letter + bs + "\u27F2";
    return letter + bs;
}

function buildTranslationTable(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const o5 = getSectionData(32, 32, false);
    const o6 = getSectionData(64, 64, false);

    const grid = document.createElement("div");
    grid.className = "trans-grid";

    const seen = new Set();
    for (let sr5 = 0; sr5 < 8; sr5++) {
        for (let sc5 = 0; sc5 < 8; sc5++) {
            const [dc5, rc5] = o5.codes[sr5][sc5];
            const ft5 = GLYPH_LETTERS[dc5 + "," + rc5];
            if (!ft5) continue;
            const parent = glyphLabel(dc5, rc5);
            if (seen.has(parent)) continue;
            seen.add(parent);

            const sr6 = sr5 * 2,
                sc6 = sc5 * 2;
            const children = [
                [sr6, sc6],
                [sr6, sc6 + 1],
                [sr6 + 1, sc6],
                [sr6 + 1, sc6 + 1],
            ];
            const labels = children.map(([r, c]) =>
                glyphLabel(o6.codes[r][c][0], o6.codes[r][c][1]),
            );

            // Boundary segments between the 2×2 children
            const vSepTop = o6.vBound[sr6][sc6];
            const vSepBot = o6.vBound[sr6 + 1][sc6];
            const hSepLeft = o6.hBound[sr6][sc6];
            const hSepRight = o6.hBound[sr6][sc6 + 1];

            const card = document.createElement("div");
            card.className = "trans-card";

            const title = document.createElement("div");
            title.className = "trans-parent";
            title.textContent = parent;
            card.appendChild(title);

            const box = document.createElement("div");
            box.className = "trans-2x2";
            const classes = [
                [
                    hSepLeft ? "border-bottom" : "",
                    vSepTop ? "border-right" : "",
                ],
                [hSepRight ? "border-bottom" : "", ""],
                ["", vSepBot ? "border-right" : ""],
                ["", ""],
            ];
            for (let i = 0; i < 4; i++) {
                const cell = document.createElement("div");
                cell.className =
                    "trans-cell" +
                    (classes[i][0] ? " " + classes[i][0] : "") +
                    (classes[i][1] ? " " + classes[i][1] : "");
                cell.textContent = labels[i];
                box.appendChild(cell);
            }
            card.appendChild(box);
            grid.appendChild(card);
        }
    }
    container.appendChild(grid);
}

// ── V↔H Substitution Rules ──
//
// V→H: each V section in 5v expands into a 1×2 horizontal pair of H sections
// in the asymmetric H-priority intermediate (5h: 32 rows × 64 cols, r[0]=true seed).
// H→V: each H section in 5h expands into a 2×1 vertical pair of V sections in 6v.
// Composing V→H→V reproduces the existing 5→6 V→V 2×2 substitution.

function buildSubstitutionRules(vhContainerId, hvContainerId) {
    const o5 = getSectionData(32, 32, false);
    const o5h = getSectionData(32, 64, true);
    const o6 = getSectionData(64, 64, false);

    function makeCard(parentLabel, childLabels, sep, layoutClass, sepClass) {
        const card = document.createElement("div");
        card.className = "trans-card";
        const title = document.createElement("div");
        title.className = "trans-parent";
        title.textContent = parentLabel;
        card.appendChild(title);
        const box = document.createElement("div");
        box.className = layoutClass;
        for (let i = 0; i < childLabels.length; i++) {
            const cell = document.createElement("div");
            cell.className =
                "trans-cell" + (i === 0 && sep ? " " + sepClass : "");
            cell.textContent = childLabels[i];
            box.appendChild(cell);
        }
        card.appendChild(box);
        return card;
    }

    // V → H (1×2 horizontal pair)
    const vhContainer = document.getElementById(vhContainerId);
    if (vhContainer) {
        const grid = document.createElement("div");
        grid.className = "trans-grid";
        const seen = new Set();
        for (let sr = 0; sr < 8; sr++) {
            for (let sc = 0; sc < 8; sc++) {
                const [dc, rc] = o5.codes[sr][sc];
                const parent = glyphLabel(dc, rc);
                if (seen.has(parent)) continue;
                seen.add(parent);
                const ha = o5h.codes[sr][2 * sc];
                const hb = o5h.codes[sr][2 * sc + 1];
                const sep = o5h.vBound[sr][2 * sc];
                grid.appendChild(
                    makeCard(
                        parent,
                        [hGlyphLabel(ha[0], ha[1]), hGlyphLabel(hb[0], hb[1])],
                        sep,
                        "trans-1x2",
                        "border-right",
                    ),
                );
            }
        }
        vhContainer.appendChild(grid);
    }

    // H → V (2×1 vertical pair)
    const hvContainer = document.getElementById(hvContainerId);
    if (hvContainer) {
        const grid = document.createElement("div");
        grid.className = "trans-grid";
        const seen = new Set();
        for (let sr = 0; sr < 8; sr++) {
            for (let sc = 0; sc < 16; sc++) {
                const [dc, rc] = o5h.codes[sr][sc];
                const parent = hGlyphLabel(dc, rc);
                if (seen.has(parent)) continue;
                seen.add(parent);
                const va = o6.codes[2 * sr][sc];
                const vb = o6.codes[2 * sr + 1][sc];
                const sep = o6.hBound[2 * sr][sc];
                grid.appendChild(
                    makeCard(
                        parent,
                        [glyphLabel(va[0], va[1]), glyphLabel(vb[0], vb[1])],
                        sep,
                        "trans-2x1",
                        "border-bottom",
                    ),
                );
            }
        }
        hvContainer.appendChild(grid);
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
assignLetter(V_CLASSES, 0, 7, "T");
assignLetter(V_CLASSES, 1, 5, "B");
assignLetter(V_CLASSES, 5, 1, "Y");
assignLetter(V_CLASSES, 6, 1, "R");
assignLetter(V_CLASSES, 1, 6, "S");

// H-grid letter assignments (backslash reflection: V_{d,r} → H_{r,d})
assignLetter(H_CLASSES, 7, 7, "F", H_GLYPH_LETTERS, false);
assignLetter(H_CLASSES, 7, 1, "P", H_GLYPH_LETTERS, false);
assignLetter(H_CLASSES, 6, 6, "J", H_GLYPH_LETTERS, false);
assignLetter(H_CLASSES, 6, 5, "M", H_GLYPH_LETTERS, false);
assignLetter(H_CLASSES, 0, 0, "O", H_GLYPH_LETTERS, false);
assignLetter(H_CLASSES, 1, 1, "L", H_GLYPH_LETTERS, false);
assignLetter(H_CLASSES, 5, 2, "Q", H_GLYPH_LETTERS, false);
assignLetter(H_CLASSES, 7, 0, "T", H_GLYPH_LETTERS, false);
assignLetter(H_CLASSES, 5, 1, "B", H_GLYPH_LETTERS, false);
assignLetter(H_CLASSES, 1, 5, "Y", H_GLYPH_LETTERS, false);
assignLetter(H_CLASSES, 1, 6, "R", H_GLYPH_LETTERS, false);
assignLetter(H_CLASSES, 6, 1, "S", H_GLYPH_LETTERS, false);

// Per-map baby blocks state
const mapBBState = {
    "coylean-map": { bb: false, outline: true },
    "coylean-map-6h": { bb: false, outline: true },
    "coylean-map-6": { bb: false, outline: true },
};

const mapConfigs = {
    "coylean-map": { Nr: 32, Nc: 32, cell: CELL_PX, horizontalWinsTies: false },
    "coylean-map-6h": { Nr: 64, Nc: 64, cell: 8, horizontalWinsTies: true },
    "coylean-map-6": { Nr: 64, Nc: 64, cell: 8, horizontalWinsTies: false },
};

function redrawMap(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const st = mapBBState[id];
    const cfg = mapConfigs[id];
    drawCoyleanMap(el, cfg.Nr, cfg.Nc, cfg.cell, {
        babyBlocks: st.bb,
        outline: st.outline,
        horizontalWinsTies: cfg.horizontalWinsTies,
    });
}

for (const id of Object.keys(mapConfigs)) {
    if (document.getElementById(id)) redrawMap(id);
}

buildTranslationTable("translation-table");
buildSubstitutionRules("vh-sub-table", "hv-sub-table");

// ── fTransform → D4 name (for baby blocks) ──

function ftToD4Glyph(ft) {
    const [, sx, sy, , backslash] = ft;
    if (!backslash) {
        if (sx === 1 && sy === 1) return "e";
        if (sx === -1 && sy === -1) return "r2";
        if (sx === 1 && sy === -1) return "sh";
        if (sx === -1 && sy === 1) return "sv";
    } else {
        if (sx === 1 && sy === 1) return "d";
        if (sx === -1 && sy === -1) return "d'";
        if (sx === 1 && sy === -1) return "r3";
        if (sx === -1 && sy === 1) return "r";
    }
    return "e";
}

// ── Build grids ──

function rebuildGrids() {
    for (const id of ["v-grid", "h-grid"]) {
        const el = document.getElementById(id);
        el.innerHTML = "";
    }
    for (const id of ["v-eq-classes", "h-eq-classes"]) {
        const el = document.getElementById(id);
        el.innerHTML = "";
    }
    buildGrid("v-grid", "V", true);
    buildEquivalenceClasses("v-eq-classes", "V", true, V_CLASSES);
    buildGrid("h-grid", "H", false);
    buildEquivalenceClasses("h-eq-classes", "H", false, H_CLASSES);
}

rebuildGrids();

// ── Baby Blocks Toggle ──

const bbToggle = document.getElementById("baby-blocks-toggle");
const bbOutline = document.getElementById("baby-blocks-outline");

if (bbToggle) {
    bbToggle.addEventListener("change", function () {
        useBabyBlocks = this.checked;
        if (useBabyBlocks && !babyBlocks) {
            import("../baby-blocks/baby-blocks.js").then((mod) => {
                mod.BabyBlocks.load("../baby-blocks/AlphabetBlocks.svg").then(
                    (bb) => {
                        babyBlocks = bb;
                        rebuildGrids();
                    },
                );
            });
        } else {
            rebuildGrids();
        }
    });
}

if (bbOutline) {
    bbOutline.addEventListener("change", function () {
        babyBlocksOutline = this.checked;
        if (useBabyBlocks) rebuildGrids();
    });
}

// ── Per-map Baby Blocks Toggles ──

function ensureBabyBlocksLoaded(cb) {
    if (babyBlocks) {
        cb();
        return;
    }
    import("../baby-blocks/baby-blocks.js").then((mod) => {
        mod.BabyBlocks.load("../baby-blocks/AlphabetBlocks.svg").then((bb) => {
            babyBlocks = bb;
            cb();
        });
    });
}

document.querySelectorAll(".map-bb-toggle").forEach((el) => {
    el.addEventListener("change", function () {
        const id = this.dataset.map;
        mapBBState[id].bb = this.checked;
        if (this.checked) {
            ensureBabyBlocksLoaded(() => redrawMap(id));
        } else {
            redrawMap(id);
        }
    });
});

document.querySelectorAll(".map-bb-outline").forEach((el) => {
    el.addEventListener("change", function () {
        const id = this.dataset.map;
        mapBBState[id].outline = this.checked;
        if (mapBBState[id].bb) redrawMap(id);
    });
});
