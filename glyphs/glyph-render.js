// ═══════════════════════════════════════════════════
//  Coylean Glyphs — canvas rendering
// ═══════════════════════════════════════════════════
//
// Draws glyph-core's patterns, letters, and map model to a 2D canvas. Imports
// only glyph-core (no engine, no DOM tree). The controller (glyphs.js) builds
// the page DOM and the map model, then calls these draw functions.

import {
    NUM_CELLS,
    GLYPH_LETTERS,
    H_GLYPH_LETTERS,
    D4_SUFFIX,
    d4Compose,
    computeGlyphMatrices,
} from "./glyph-core.js";

// ── Render config (mutated by the controller's toggles) ──
// useBabyBlocks / babyBlocksOutline: global Baby Blocks state for the grids.
// showIndices: maps show each section's V##/H## index instead of its letter.
const renderState = {
    useBabyBlocks: false,
    babyBlocksOutline: true,
    showIndices: false,
    // Override the block fill (null = the SVG's own per-letter color) and the
    // overlay opacity. Defaults reproduce the historical faint-overlay look.
    babyBlocksColor: null,
    babyBlocksAlpha: 0.45,
};
let babyBlocks = null; // lazy-loaded Baby Blocks instance

// ── Pixel sizes ──
const CELL_PX = 16;
const DOT_R = 2.5;
const MARGIN = 10;
const GRID_CELLS = NUM_CELLS + 1; // includes exit segment column/row
const CANVAS_SIZE = CELL_PX * GRID_CELLS + MARGIN * 2;

const V_COLOR = "rgba(0, 0, 100, 0.4)";
const H_COLOR = "rgba(139, 0, 0, 0.5)";

// Build a draw tuple [letter, color, d4Index] from a stored
// [letter, d4Index] entry.
function toFt(entry, color) {
    if (!entry) return null;
    return [entry[0], color, entry[1]];
}

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

function ftToD4Glyph(ft) {
    return D4_TO_BABY[ft[2]] || "e";
}

// Unicode subscript digits: ₀₁₂₃₄₅₆₇
const SUB_DIGITS = "₀₁₂₃₄₅₆₇";

function glyphName(prefix, d, r) {
    return prefix + SUB_DIGITS[d] + SUB_DIGITS[r];
}

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

// ── Drawing primitives ──

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

    // Propagate the 3×3 glyph via the shared core (curHInit/curVInit offset).
    const { downMatrix, rightMatrix } = computeGlyphMatrices(
        downCode,
        rightCode,
        seniority,
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
    // fTransform: [letter, color, d4Index]
    if (fTransform) {
        const gridCx = MARGIN + (GRID_CELLS * CELL_PX) / 2;
        const gridCy = MARGIN + (GRID_CELLS * CELL_PX) / 2;
        const fontSize = NUM_CELLS * CELL_PX;

        if (renderState.useBabyBlocks && babyBlocks) {
            const d4 = ftToD4Glyph(fTransform);
            const blockSize = GRID_CELLS * CELL_PX;
            const bbOpts = {
                transform: d4,
                outline: renderState.babyBlocksOutline,
            };
            if (renderState.babyBlocksColor)
                bbOpts.color = renderState.babyBlocksColor;
            ctx.save();
            ctx.globalAlpha = renderState.babyBlocksAlpha;
            babyBlocks.drawDirect(
                ctx,
                fTransform[0],
                gridCx,
                gridCy,
                blockSize,
                bbOpts,
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

// Draw one 4×4 section at (sx, sy) at the given cell size: the section's
// canonical glyph propagation (V_COLOR / H_COLOR), input/output dots, and the
// letter overlay (D4_MATRIX or Baby Blocks) or a V##/H## placeholder. Used by
// the substitution explorer; matches the section-overlay block of drawCoyleanMap.
function drawSection(ctx, opts) {
    const {
        dc, rc, seniority,
        sx, sy, cell,
        ft,                // [letter, color, d4Index] or null
        prefix,            // "V" or "H" — for the placeholder
        showDots = true,
        showLetters = true,
        babyBlocks: bbEnable = false,
        outline = true,
    } = opts;

    const lw = (cell * 1.2) / CELL_PX;
    const { downMatrix: secDown, rightMatrix: secRight } =
        computeGlyphMatrices(dc, rc, seniority, 1, 1);

    ctx.strokeStyle = "#90caf9";
    ctx.lineWidth = lw;
    for (let gy = 0; gy <= 3; gy++) {
        for (let gx = 0; gx < 3; gx++) {
            if (secDown[gy][gx]) {
                ctx.beginPath();
                ctx.moveTo(sx + (gx + 1) * cell, sy + gy * cell);
                ctx.lineTo(sx + (gx + 1) * cell, sy + (gy + 1) * cell);
                ctx.stroke();
            }
        }
    }
    for (let gx = 0; gx <= 3; gx++) {
        for (let gy = 0; gy < 3; gy++) {
            if (secRight[gx][gy]) {
                ctx.beginPath();
                ctx.moveTo(sx + gx * cell, sy + (gy + 1) * cell);
                ctx.lineTo(sx + (gx + 1) * cell, sy + (gy + 1) * cell);
                ctx.stroke();
            }
        }
    }

    if (showDots) {
        const dr = (cell * DOT_R) / CELL_PX;
        for (let i = 0; i < 3; i++) {
            drawDot(ctx, sx + (i + 1) * cell, sy, !!(dc & (1 << i)), dr);
            drawDot(ctx, sx, sy + (i + 1) * cell, !!(rc & (1 << i)), dr);
            drawDot(ctx, sx + (i + 1) * cell, sy + 4 * cell, secDown[3][i], dr);
            drawDot(ctx, sx + 4 * cell, sy + (i + 1) * cell, secRight[3][i], dr);
        }
    }

    if (!showLetters) return;

    const cx = sx + 2 * cell;
    const cy = sy + 2 * cell;
    if (ft) {
        if (bbEnable && babyBlocks) {
            const d4 = ftToD4Glyph(ft);
            const blockSize = 4 * cell;
            ctx.save();
            ctx.globalAlpha = 0.45;
            babyBlocks.drawDirect(ctx, ft[0], cx, cy, blockSize, {
                transform: d4, outline,
            });
            ctx.restore();
        } else {
            const fontSize = 3 * cell;
            const m = D4_MATRIX[ft[2]] || D4_MATRIX[0];
            ctx.save();
            ctx.translate(cx, cy);
            ctx.transform(m[0], m[1], m[2], m[3], 0, 0);
            ctx.fillStyle = ft[1] || "rgba(0, 0, 100, 0.4)";
            ctx.font = "bold " + fontSize + "px Monaco, Menlo, monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(ft[0], 0, 0);
            ctx.restore();
        }
    } else if (prefix) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.font = cell * 0.7 + "px Monaco, Menlo, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(prefix + SUB_DIGITS[dc] + SUB_DIGITS[rc], cx, cy);
    }
}

// Draw a map from glyph-core's computeMapModel output. opts: { cell, babyBlocks
// (per-map enable), outline }. Stashes section geometry on the canvas for the
// assignment editor's click hit-testing.
function drawCoyleanMap(canvasEl, model, opts) {
    const cell = opts.cell;
    const mapBB = opts && opts.babyBlocks;
    const mapBBOutline = opts ? opts.outline : true;
    const {
        downMatrix,
        rightMatrix,
        colPriority,
        rowPriority,
        numRows: Mr,
        numColumns: Mc,
        SEC,
        firstDarkCol,
        firstDarkRow,
        NSr,
        NSc,
        secCodes,
        seniority,
        isVertical,
    } = model;

    const w = Mc * cell;
    const h = Mr * cell;
    canvasEl.width = w;
    canvasEl.height = h;

    const ctx = canvasEl.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);

    const lw = (cell * 1.2) / CELL_PX;
    ctx.lineWidth = lw;

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

    // Draw overlays on all sections
    for (let sr = 0; sr < NSr; sr++) {
        for (let sc = 0; sc < NSc; sc++) {
            const [dc, rc] = secCodes[sr][sc];
            let ft;
            if (!isVertical) {
                ft = toFt(H_GLYPH_LETTERS[dc + "," + rc], H_COLOR);
            } else {
                ft = toFt(GLYPH_LETTERS[dc + "," + rc], V_COLOR);
            }
            if (renderState.showIndices) ft = null; // force V##/H## placeholder

            const sx = (firstDarkCol + sc * SEC + 1) * cell;
            const sy = (firstDarkRow + sr * SEC + 1) * cell;
            const cx = sx + 2 * cell;
            const cy = sy + 2 * cell;

            if (ft) {
                // Assigned letter: overlay lines, dots, and transformed letter.
                const { downMatrix: secDown, rightMatrix: secRight } =
                    computeGlyphMatrices(dc, rc, seniority, 1, 1);

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
                    const bbOpts = { transform: d4, outline: mapBBOutline };
                    if (renderState.babyBlocksColor)
                        bbOpts.color = renderState.babyBlocksColor;
                    ctx.save();
                    ctx.globalAlpha = renderState.babyBlocksAlpha;
                    babyBlocks.drawDirect(ctx, ft[0], cx, cy, blockSize, bbOpts);
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
                const prefix = isVertical ? "V" : "H";
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
        isVertical,
        secCodes,
        NSr,
        NSc,
    };
}

// ── Baby Blocks (lazy-loaded) ──

function ensureBabyBlocksLoaded(cb) {
    if (babyBlocks) {
        cb();
        return;
    }
    import("../baby-blocks/baby-blocks.js").then((mod) => {
        calibrateBabyNames(mod.D4);
        mod.BabyBlocks.load("../baby-blocks/AlphabetBlocks-complete.svg").then((bb) => {
            babyBlocks = bb;
            cb();
        });
    });
}

function babyBlocksReady() {
    return !!babyBlocks;
}

export {
    CELL_PX,
    V_COLOR,
    H_COLOR,
    toFt,
    glyphName,
    glyphLabel,
    hGlyphLabel,
    drawGlyph,
    drawSection,
    drawCoyleanMap,
    renderState,
    ensureBabyBlocksLoaded,
    babyBlocksReady,
    D4_TO_BABY,
    D4_MATRIX,
};
