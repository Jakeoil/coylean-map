// ═══════════════════════════════════════════════════
//  Coylean Glyphs — 4×4 Section Catalog
// ═══════════════════════════════════════════════════

import {
    Seniority,
    Propagation,
    Universe,
} from "../coylean-explorer/coylean-core.js";
import {
    NUM_CELLS,
    curHInit,
    curVInit,
    setOffset,
    bitsToBoundary,
    d4Compose,
    D4_NAMES,
    D4_SUFFIX,
    pairKey,
    getSectionData,
    GLYPH_LETTERS,
    H_GLYPH_LETTERS,
    V_CLASSES,
    H_CLASSES,
    glyphLetterAt,
    orbitMemberKeys,
    getWorkingAssignments,
    setWorkingAssignments,
    setOldAssignments,
    parseAssignmentValue,
    SUFFIX_TO_D4,
    applyAssignments,
} from "./glyph-core.js";

// ── Baby Blocks (lazy-loaded) ──
let babyBlocks = null;
let useBabyBlocks = false;
let babyBlocksOutline = true;

// Maps: when true, show each section's V##/H## index instead of its letter.
let showIndices = false;

// Canvas size for each glyph. NUM_CELLS (the 3 interior cells) is the math
// constant, owned by glyph-core; the pixel sizes below are render-only.
const CELL_PX = 16;
const DOT_R = 2.5;
const MARGIN = 10;
const GRID_CELLS = NUM_CELLS + 1; // includes exit segment column/row
const CANVAS_SIZE = CELL_PX * GRID_CELLS + MARGIN * 2;

// ── Glyph Renderer — draws the core's patterns/letters to canvas ──

const V_COLOR = "rgba(0, 0, 100, 0.4)";
const H_COLOR = "rgba(139, 0, 0, 0.5)";

// Build a draw tuple [letter, color, d4Index] from a stored
// [letter, d4Index] entry.
function toFt(entry, color) {
    if (!entry) return null;
    return [entry[0], color, entry[1]];
}

function drawGlyph(canvas, downCode, rightCode, seniority, fTransform) {
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

    // Propagate the 3×3 glyph using the shared core. curHInit/curVInit default
    // to 1 (the original priority(x+1)/priority(y+1) tie-breaking); the sidebar
    // boxes vary them.
    const { downMatrix, rightMatrix } = new Propagation({
        initDown: bitsToBoundary(downCode, NUM_CELLS),
        initRight: bitsToBoundary(rightCode, NUM_CELLS),
        hInitCol: curHInit,
        vInitRow: curVInit,
        seniority,
    });

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
    // fTransform: [letter, color, d4Index]
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
            const m = D4_MATRIX[fTransform[2]] || D4_MATRIX[0];
            ctx.save();
            ctx.translate(gridCx, gridCy);
            ctx.transform(m[0], m[1], m[2], m[3], 0, 0);
            ctx.fillStyle = fTransform[1] || "rgba(0, 0, 100, 0.4)";
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

function buildGrid(tableId, prefix, seniority) {
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
            td.dataset.grid = prefix; // "V" / "H" — for the assignment editor
            td.dataset.d = d;
            td.dataset.r = r;
            const canvas = document.createElement("canvas");
            let ft = null;
            if (seniority.isVertical) {
                ft = toFt(GLYPH_LETTERS[d + "," + r], V_COLOR);
            } else {
                ft = toFt(H_GLYPH_LETTERS[d + "," + r], H_COLOR);
            }
            drawGlyph(canvas, d, r, seniority, ft);
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

// (Glyph/section pattern math + D4 visual classification live in glyph-core.js.)

// ── D4 group: canvas matrices, calibrated to glyph-core's VISUAL_D4 ──
//
// Canvas affine [a, b, c, d] maps (x, y) → (a·x + c·y, b·x + d·y). Indices
// match glyph-core's VISUAL_D4 / D4_NAMES. The six unambiguous elements are
// written out; the two rotations (1, 3) are filled below as products of
// reflections, indexed via the core's d4Compose so they stay in lock-step.
const D4_MATRIX = [
    [1, 0, 0, 1], // 0 e
    null, //          1 r   (filled below)
    [-1, 0, 0, -1], // 2 r²
    null, //          3 r³  (filled below)
    [1, 0, 0, -1], // 4 s_h  flip vertical (upside-down)
    [-1, 0, 0, 1], // 5 s_v  flip horizontal (mirror)
    [0, 1, 1, 0], //  6 s_d1 main diagonal (transpose, "\")
    [0, -1, -1, 0], // 7 s_d2 anti-diagonal ("/")
];

// 2×2 product in [a, b, c, d] form (matrix [[a, c], [b, d]]).
function matMul(A, B) {
    return [
        A[0] * B[0] + A[2] * B[1],
        A[1] * B[0] + A[3] * B[1],
        A[0] * B[2] + A[2] * B[3],
        A[1] * B[2] + A[3] * B[3],
    ];
}

// Fill the two rotation matrices (1, 3) as products of reflections, using
// glyph-core's Cayley table (d4Compose) so they stay in lock-step with the
// pattern transforms (no hand-guessed axis).
D4_MATRIX[d4Compose(6, 4)] = matMul(D4_MATRIX[6], D4_MATRIX[4]); // s_d1∘s_h
D4_MATRIX[d4Compose(6, 5)] = matMul(D4_MATRIX[6], D4_MATRIX[5]); // s_d1∘s_v

// D4 element index → baby-blocks transform name. Calibrated on load by
// matching the baby-blocks D4 matrices against D4_MATRIX, so a block's
// orientation always equals the rendered letter's. (Baby Blocks names its
// two rotations opposite to ours, which this matching corrects.) The static
// values below are the correct fallback for any call before load.
let D4_TO_BABY = ["e", "r3", "r2", "r", "sh", "sv", "d", "d'"];

function calibrateBabyNames(babyD4) {
    const names = Object.keys(babyD4);
    D4_TO_BABY = D4_MATRIX.map((m) => {
        const hit = names.find((n) =>
            babyD4[n].every((val, k) => val === m[k]),
        );
        return hit || "e";
    });
}

// Unicode subscript digits: ₀₁₂₃₄₅₆₇
const SUB_DIGITS = "\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087";

function glyphName(prefix, d, r) {
    return prefix + SUB_DIGITS[d] + SUB_DIGITS[r];
}

function buildEquivalenceClasses(
    containerId,
    prefix,
    seniority,
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
            cell.dataset.grid = prefix; // "V" / "H" — for the assignment editor
            cell.dataset.d = d;
            cell.dataset.r = r;

            const canvas = document.createElement("canvas");
            let ft2 = null;
            if (seniority.isVertical) {
                ft2 = toFt(GLYPH_LETTERS[d + "," + r], V_COLOR);
            } else {
                ft2 = toFt(H_GLYPH_LETTERS[d + "," + r], H_COLOR);
            }
            drawGlyph(canvas, d, r, seniority, ft2);
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

// ── Coylean Map ──

function drawCoyleanMap(canvasEl, Nr, Nc, cell, opts) {
    const mapBB = opts && opts.babyBlocks;
    const mapBBOutline = opts ? opts.outline : true;
    const seniority = (opts && opts.seniority) || Seniority.vertical();
    const SEC = 4;

    // Dyadic location. The map is an SE patch of the infinite Coylean map; we
    // realize it as a universe with westExtent=northExtent=1 (just the origin
    // row/col on the N/W side) and eastExtent/southExtent reaching across the
    // map, then integrate its boundary into one SE propagation. This bakes in
    // the catalog→map −1 (fromUniverseBoundary sets hInitCol = curHInit −
    // westExtent = curHInit − 1) and, crucially, derives the correct all-true
    // boundary seed instead of a hand-rolled single arrow. At 1/1 the section
    // codes match the historical clean map exactly; varying the offset slides
    // the senior (≥P2) lattice, so codes outside the standard set surface.
    const hInitCol = curHInit - 1;
    const vInitRow = curVInit - 1;
    // First senior column/row: where pri(k + hInitCol) ≥ 2, i.e. k ≡ −hInitCol
    // (mod 4). The 4×4 cages sit on this lattice; a partial cage may precede it
    // on the N/W edge. Extend E/S by that shift so a full run of cages still
    // fits after realignment.
    const firstDarkCol = (((-hInitCol) % SEC) + SEC) % SEC;
    const firstDarkRow = (((-vInitRow) % SEC) + SEC) % SEC;

    const universe = Universe.create({
        northExtent: 1,
        westExtent: 1,
        eastExtent: Nc + firstDarkCol,
        southExtent: Nr + firstDarkRow,
        hInitCol: curHInit,
        vInitRow: curVInit,
        seniority,
    });
    const { downMatrix, rightMatrix, colPriority, rowPriority, numRows, numColumns } =
        Propagation.fromUniverseBoundary(universe);

    const Mr = numRows;
    const Mc = numColumns;
    const w = Mc * cell;
    const h = Mr * cell;
    canvasEl.width = w;
    canvasEl.height = h;

    const ctx = canvasEl.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);

    // Bounds-guarded reads (cages near the edges may probe one past the grid).
    const dAt = (y, x) =>
        y >= 0 && x >= 0 && downMatrix[y] && x < downMatrix[y].length
            ? downMatrix[y][x]
            : false;
    const rAt = (x, y) =>
        x >= 0 && y >= 0 && rightMatrix[x] && y < rightMatrix[x].length
            ? rightMatrix[x][y]
            : false;

    const lw = (cell * 1.2) / CELL_PX;
    ctx.lineWidth = lw;

    // Cage grid: full 4×4 sections anchored on the senior lattice. Only full
    // cages hold a glyph; the partial N/W margin (firstDark cells) gets none.
    const NSr = Math.floor((Mr - firstDarkRow) / SEC);
    const NSc = Math.floor((Mc - firstDarkCol) / SEC);
    const secCodes = Array.from({ length: NSr }, () =>
        Array.from({ length: NSc }, () => [0, 0]),
    );

    for (let y = 0; y < Mr; y++) {
        const rp = rowPriority[y];
        for (let x = 0; x < Mc; x++) {
            const preD = !!(downMatrix[y] && downMatrix[y][x]);
            const preR = !!(rightMatrix[x] && rightMatrix[x][y]);
            const dp = colPriority[x];

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

    // Capture section input codes at each full cage's interior, offset onto
    // the senior lattice by firstDarkRow/Col.
    for (let sr = 0; sr < NSr; sr++) {
        for (let sc = 0; sc < NSc; sc++) {
            const y0 = firstDarkRow + sr * SEC + 1;
            const x0 = firstDarkCol + sc * SEC + 1;
            for (let i = 0; i < 3; i++) {
                if (dAt(y0, x0 + i)) secCodes[sr][sc][0] |= 1 << i;
                if (rAt(x0, y0 + i)) secCodes[sr][sc][1] |= 1 << i;
            }
        }
    }

    // Draw overlays on all sections
    for (let sr = 0; sr < NSr; sr++) {
        for (let sc = 0; sc < NSc; sc++) {
            const [dc, rc] = secCodes[sr][sc];
            let ft;
            if (!seniority.isVertical) {
                ft = toFt(H_GLYPH_LETTERS[dc + "," + rc], H_COLOR);
            } else {
                ft = toFt(GLYPH_LETTERS[dc + "," + rc], V_COLOR);
            }
            if (showIndices) ft = null; // force the V##/H## placeholder

            const sx = (firstDarkCol + sc * SEC + 1) * cell;
            const sy = (firstDarkRow + sr * SEC + 1) * cell;
            const cx = sx + 2 * cell;
            const cy = sy + 2 * cell;

            if (ft) {
                // Assigned letter: draw overlay lines, dots, and transformed letter
                const { downMatrix: secDown, rightMatrix: secRight } = new Propagation({
                    initDown: bitsToBoundary(dc, 3),
                    initRight: bitsToBoundary(rc, 3),
                    hInitCol: 1,
                    vInitRow: 1,
                    seniority,
                });

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
                    const m = D4_MATRIX[ft[2]] || D4_MATRIX[0];
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.transform(m[0], m[1], m[2], m[3], 0, 0);
                    ctx.fillStyle = ft[1] || "rgba(0, 0, 100, 0.4)";
                    ctx.font =
                        "bold " + mapFontSize + "px Monaco, Menlo, monospace";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(ft[0], 0, 0);
                    ctx.restore();
                }
            } else {
                // Unassigned: show placeholder label
                const prefix = seniority.isVertical ? "V" : "H";
                ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
                ctx.font = cell * 0.7 + "px Monaco, Menlo, monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(prefix + SUB_DIGITS[dc] + SUB_DIGITS[rc], cx, cy);
            }
        }
    }

    // Stash section geometry so the assignment editor can hit-test a map click
    // back to a (grid, d, r) member. Editor-only; the catalog never reads it.
    canvasEl._coySections = {
        firstDarkCol,
        firstDarkRow,
        cell,
        SEC,
        isVertical: seniority.isVertical,
        secCodes,
        NSr,
        NSc,
    };
}

// ── Translation Table ──

function glyphLabel(dc, rc) {
    const ft = GLYPH_LETTERS[dc + "," + rc];
    if (!ft) return "V" + SUB_DIGITS[dc] + SUB_DIGITS[rc];
    return ft[0] + D4_SUFFIX[ft[1]];
}

function hGlyphLabel(dc, rc) {
    const ft = H_GLYPH_LETTERS[dc + "," + rc];
    if (!ft) return "H" + SUB_DIGITS[dc] + SUB_DIGITS[rc];
    return ft[0] + D4_SUFFIX[ft[1]];
}

function buildTranslationTable(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    const o5 = getSectionData(32, 32, Seniority.vertical());
    const o6 = getSectionData(64, 64, Seniority.vertical());

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
    const o5 = getSectionData(32, 32, Seniority.vertical());
    const o5h = getSectionData(32, 64, Seniority.horizontal());
    const o6 = getSectionData(64, 64, Seniority.vertical());

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
        vhContainer.innerHTML = "";
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
        hvContainer.innerHTML = "";
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

// ── Assignment loading (IO) ──
// The assignment dicts + model (DEFAULT/NEW/OLD, parsing, accessors) live in
// glyph-core.js. The controller fetches the files and pushes them into core.

// Fetch one assignment file and return its member-index dict, or null on any
// failure. cache:"no-store" so editing the file and refreshing takes effect.
async function fetchAssignmentDict(path) {
    try {
        const res = await fetch(path, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (data && data.assignments && typeof data.assignments === "object") {
            return data.assignments;
        }
        throw new Error("no .assignments object");
    } catch (e) {
        console.warn("glyphs: could not load", path + ";", "using fallback.", e);
        return null;
    }
}

// Load both schemes from their own files. New falls back to the built-in
// DEFAULT_ASSIGNMENTS; old stays null so applyAssignmentsAndRender falls back to
// the hard-coded applyOldAssignments baseline.
async function loadAssignments() {
    const [newDict, oldDict] = await Promise.all([
        fetchAssignmentDict("./assignments.json"),
        fetchAssignmentDict("./assignments-old.json"),
    ]);
    if (newDict) setWorkingAssignments(newDict);
    if (oldDict) setOldAssignments(oldDict);
}

// Per-map baby blocks state
const mapBBState = {
    "coylean-map": { bb: false, outline: true },
    "coylean-map-6h": { bb: false, outline: true },
    "coylean-map-6": { bb: false, outline: true },
};

const mapConfigs = {
    "coylean-map": { Nr: 32, Nc: 32, cell: CELL_PX, seniority: Seniority.vertical() },
    "coylean-map-6h": { Nr: 64, Nc: 64, cell: 8, seniority: Seniority.horizontal() },
    "coylean-map-6": { Nr: 64, Nc: 64, cell: 8, seniority: Seniority.vertical() },
};

function redrawMap(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const st = mapBBState[id];
    const cfg = mapConfigs[id];
    drawCoyleanMap(el, cfg.Nr, cfg.Nc, cfg.cell, {
        babyBlocks: st.bb,
        outline: st.outline,
        seniority: cfg.seniority,
    });
}

function applyAssignmentsAndRender(useNew) {
    applyAssignments(useNew); // core: rebuild D4 classes + letter model

    for (const id of Object.keys(mapConfigs)) {
        if (document.getElementById(id)) redrawMap(id);
    }
    buildTranslationTable("translation-table");
    buildSubstitutionRules("vh-sub-table", "hv-sub-table");
    rebuildGrids();
}

// ── fTransform → baby-blocks D4 name ──

function ftToD4Glyph(ft) {
    return D4_TO_BABY[ft[2]] || "e";
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
    buildGrid("v-grid", "V", Seniority.vertical());
    buildEquivalenceClasses("v-eq-classes", "V", Seniority.vertical(), V_CLASSES);
    buildGrid("h-grid", "H", Seniority.horizontal());
    buildEquivalenceClasses("h-eq-classes", "H", Seniority.horizontal(), H_CLASSES);
}

// ── Baby Blocks + Outline (global: all maps and grids) ──

function ensureBabyBlocksLoaded(cb) {
    if (babyBlocks) {
        cb();
        return;
    }
    import("../baby-blocks/baby-blocks.js").then((mod) => {
        calibrateBabyNames(mod.D4);
        mod.BabyBlocks.load("../baby-blocks/AlphabetBlocks.svg").then((bb) => {
            babyBlocks = bb;
            cb();
        });
    });
}

// Mirror the global state into every map, then redraw maps and grids.
function applyBabyBlocks() {
    for (const id of Object.keys(mapBBState)) {
        mapBBState[id].bb = useBabyBlocks;
        mapBBState[id].outline = babyBlocksOutline;
    }
    for (const id of Object.keys(mapConfigs)) {
        if (document.getElementById(id)) redrawMap(id);
    }
    rebuildGrids();
}

const bbToggle = document.getElementById("bb-toggle");
const bbOutline = document.getElementById("bb-outline");

if (bbToggle) {
    bbToggle.addEventListener("change", function () {
        useBabyBlocks = this.checked;
        if (useBabyBlocks && !babyBlocks) {
            ensureBabyBlocksLoaded(applyBabyBlocks);
        } else {
            applyBabyBlocks();
        }
    });
}

if (bbOutline) {
    bbOutline.addEventListener("change", function () {
        babyBlocksOutline = this.checked;
        applyBabyBlocks();
    });
}

// ── Assignment toggle (chicken switch) ──

const newAssignToggle = document.getElementById("new-assignment-toggle");
let useNewAssignments = newAssignToggle ? newAssignToggle.checked : true;
if (newAssignToggle) {
    newAssignToggle.addEventListener("change", function () {
        useNewAssignments = this.checked;
        applyAssignmentsAndRender(useNewAssignments);
    });
}

// ── Show-indices toggle (maps show V##/H## instead of letters) ──

const showIndicesToggle = document.getElementById("show-indices-toggle");
showIndices = showIndicesToggle ? showIndicesToggle.checked : false;
if (showIndicesToggle) {
    showIndicesToggle.addEventListener("change", function () {
        showIndices = this.checked;
        for (const id of Object.keys(mapConfigs)) {
            if (document.getElementById(id)) redrawMap(id);
        }
    });
}

// ── Tie-break offset inputs (hInitCol / vInitRow — catalog + maps) ──

const hInitInput = document.getElementById("hinit-input");
const vInitInput = document.getElementById("vinit-input");

function readOffset(el, fallback) {
    const n = parseInt(el.value, 10);
    return Number.isFinite(n) ? n : fallback;
}

if (hInitInput && vInitInput) {
    const onOffsetChange = function () {
        setOffset(readOffset(hInitInput, 1), readOffset(vInitInput, 1));
        applyAssignmentsAndRender(useNewAssignments);
    };
    hInitInput.addEventListener("change", onOffsetChange);
    vInitInput.addEventListener("change", onOffsetChange);
}

const whenLoaded = loadAssignments().then(() =>
    applyAssignmentsAndRender(useNewAssignments),
);

// ── Editor API ──
// Consumed by assign.mjs; index.html's <script type="module"> tag ignores these
// exports. whenLoaded resolves after the initial file-driven render, so the
// editor can layer its localStorage override without a render race.
export {
    applyAssignmentsAndRender,
    getWorkingAssignments,
    setWorkingAssignments,
    glyphLetterAt,
    orbitMemberKeys,
    parseAssignmentValue,
    SUFFIX_TO_D4,
    D4_SUFFIX,
    whenLoaded,
};
