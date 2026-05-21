import { svgEl } from "./svg.js";
import { D } from "./diagram-coords.js";
import { theme } from "./theme.js";

// Encroach overlay: half-fills match the diamond fill (theme.*.glow);
// bisecting lines and incursion edges match the diamond border
// (theme.*.outline). Read live at draw time so theme toggles flow through.

// Render the encroachment overlay into `parent`.
//
//   dm, rm           — down/right matrices (p.downMatrix, p.rightMatrix)
//   nR, nC           — numRows, numColumns
//   downC, rightC    — (i, j) → [cx, cy] center lookups
//   wX, eX, nY, sY   — flip-aware corner offsets relative to a diamond center.
//                      For an unflipped panel: wX=cx-D, eX=cx+D, nY=cy-D, sY=cy+D.
//                      In a flipped mosaic panel these swap sides so logical
//                      "north" / "west" track the propagation's logical axes.
//   showFill         — when false, suppress the half-fill triangles but keep
//                      the bisecting lines and incursion edges (Fill toggle).
//
// The four passes mirror the original inline blocks: false-right half-fills,
// false-down half-fills, true-right incursion edges, true-down incursion edges.
export function renderEncroach(parent, opts) {
    const { dm, rm, nR, nC, downC, rightC, wX, eX, nY, sY, showFill } = opts;

    // False right diamonds: half-fill toward true down neighbors.
    for (let i = 0; i <= nC; i++) {
        for (let j = 0; j < nR; j++) {
            if (rm[i][j]) continue;
            const [cx, cy] = rightC(i, j);

            const nw = i >= 1 ? dm[j][i - 1] : false;
            const ne = i < nC ? dm[j][i] : false;
            const sw = i >= 1 && j + 1 <= nR ? dm[j + 1][i - 1] : false;
            const se = i < nC && j + 1 <= nR ? dm[j + 1][i] : false;

            const leftFill = nw && sw;
            const rightFill = ne && se;
            if (leftFill && showFill) {
                parent.appendChild(
                    svgEl("polygon", {
                        points: `${cx},${cy - D} ${cx},${cy + D} ${wX(cx)},${cy}`,
                        fill: theme.row.glow,
                        stroke: "none",
                    }),
                );
            }
            if (rightFill && showFill) {
                parent.appendChild(
                    svgEl("polygon", {
                        points: `${cx},${cy - D} ${eX(cx)},${cy} ${cx},${cy + D}`,
                        fill: theme.row.glow,
                        stroke: "none",
                    }),
                );
            }
            if (leftFill || rightFill) {
                parent.appendChild(
                    svgEl("line", {
                        x1: cx,
                        y1: cy - D,
                        x2: cx,
                        y2: cy + D,
                        stroke: theme.row.outline,
                        "stroke-width": "1.5",
                    }),
                );
            }
        }
    }

    // False down diamonds: half-fill toward true right neighbors.
    for (let j = 0; j <= nR; j++) {
        for (let i = 0; i < nC; i++) {
            if (dm[j][i]) continue;
            const [cx, cy] = downC(i, j);

            const nw = j >= 1 ? rm[i][j - 1] : false;
            const ne = j >= 1 && i + 1 <= nC ? rm[i + 1][j - 1] : false;
            const sw = j < nR ? rm[i][j] : false;
            const se = j < nR && i + 1 <= nC ? rm[i + 1][j] : false;

            const topFill = nw && ne;
            const bottomFill = sw && se;
            if (topFill && showFill) {
                parent.appendChild(
                    svgEl("polygon", {
                        points: `${cx},${nY(cy)} ${cx + D},${cy} ${cx - D},${cy}`,
                        fill: theme.col.glow,
                        stroke: "none",
                    }),
                );
            }
            if (bottomFill && showFill) {
                parent.appendChild(
                    svgEl("polygon", {
                        points: `${cx - D},${cy} ${cx + D},${cy} ${cx},${sY(cy)}`,
                        fill: theme.col.glow,
                        stroke: "none",
                    }),
                );
            }
            if (topFill || bottomFill) {
                parent.appendChild(
                    svgEl("line", {
                        x1: cx - D,
                        y1: cy,
                        x2: cx + D,
                        y2: cy,
                        stroke: theme.col.outline,
                        "stroke-width": "1.5",
                    }),
                );
            }
        }
    }

    // True right diamonds: thick edges toward true down neighbors.
    for (let i = 0; i <= nC; i++) {
        for (let j = 0; j < nR; j++) {
            if (!rm[i][j]) continue;
            const [cx, cy] = rightC(i, j);
            const nw = i >= 1 ? dm[j][i - 1] : false;
            const ne = i < nC ? dm[j][i] : false;
            const sw = i >= 1 && j + 1 <= nR ? dm[j + 1][i - 1] : false;
            const se = i < nC && j + 1 <= nR ? dm[j + 1][i] : false;
            const edge = (x1, y1, x2, y2) =>
                parent.appendChild(
                    svgEl("line", {
                        x1,
                        y1,
                        x2,
                        y2,
                        stroke: theme.row.outline,
                        "stroke-width": "2.5",
                    }),
                );
            if (nw) edge(cx, nY(cy), wX(cx), cy);
            if (ne) edge(cx, nY(cy), eX(cx), cy);
            if (sw) edge(cx, sY(cy), wX(cx), cy);
            if (se) edge(cx, sY(cy), eX(cx), cy);
        }
    }

    // True down diamonds: thick edges toward true right neighbors.
    for (let j = 0; j <= nR; j++) {
        for (let i = 0; i < nC; i++) {
            if (!dm[j][i]) continue;
            const [cx, cy] = downC(i, j);
            const nw = j >= 1 ? rm[i][j - 1] : false;
            const ne = j >= 1 && i + 1 <= nC ? rm[i + 1][j - 1] : false;
            const sw = j < nR ? rm[i][j] : false;
            const se = j < nR && i + 1 <= nC ? rm[i + 1][j] : false;
            const edge = (x1, y1, x2, y2) =>
                parent.appendChild(
                    svgEl("line", {
                        x1,
                        y1,
                        x2,
                        y2,
                        stroke: theme.col.outline,
                        "stroke-width": "2.5",
                    }),
                );
            if (nw) edge(cx, nY(cy), wX(cx), cy);
            if (ne) edge(cx, nY(cy), eX(cx), cy);
            if (sw) edge(cx, sY(cy), wX(cx), cy);
            if (se) edge(cx, sY(cy), eX(cx), cy);
        }
    }
}

/**
 * Draws a 2D orthographic rendering of a perpendicular pipe junction inside a unit square.
 *
 * The function renders:
 * - A horizontal "blue" pipe (crossbar)
 * - A vertical "red" pipe (joining pipe)
 *
 * Both pipes are modeled as cylinders tangent to a common top plane and projected
 * orthographically (top-down). The red pipe tapers where it intersects the blue pipe,
 * based on equal-height contour geometry. For equal diameters, the taper forms straight
 * 45° lines; for unequal diameters, the taper begins after a flat segment and converges
 * to the center.
 *
 * The drawing is scaled to fit within a 1×1 logical square, mapped to the rectangle
 * defined by (x, y, size).
 *
 * @param {CanvasRenderingContext2D} ctx
 *   The 2D canvas rendering context used for drawing.
 *
 * @param {number} x
 *   The x-coordinate (in pixels) of the top-left corner of the drawing region.
 *
 * @param {number} y
 *   The y-coordinate (in pixels) of the top-left corner of the drawing region.
 *
 * @param {number} size
 *   The width and height (in pixels) of the square drawing region.
 *
 * @param {number} blueD
 *   Diameter of the horizontal (blue) pipe, expressed in normalized units (0 < blueD ≤ 1).
 *   This pipe is centered vertically within the square and acts as the crossbar.
 *
 * @param {number} redD
 *   Diameter of the vertical (red) pipe, expressed in normalized units (0 < redD ≤ 1).
 *   This pipe is centered horizontally and tapers into the blue pipe.
 *
 * @returns {void}
 *
 * @remarks
 * - Coordinates are normalized to [0,1] × [0,1] before being scaled to the canvas.
 * - The taper point is computed from the relation:
 *     y0 = sqrt(2 R r - r^2)
 *   where R = blueD / 2 and r = redD / 2.
 * - The implementation assumes redD ≤ blueD (the red pipe joins into the blue pipe).
 * - Shading is approximated using linear gradients to simulate cylindrical lighting.
 *
 * @example
 * drawPipeJunction(ctx, 50, 50, 500, 1.0, 0.5);
 */
export function drawPipeJunction(ctx, x, y, size, blueD = 1, redD = 0.5) {
    // diameters must be <= 1
    blueD = Math.min(1, blueD);
    redD = Math.min(1, redD);

    const S = size;

    const R = blueD / 2; // blue radius
    const r = redD / 2; // red radius

    function X(u) {
        return x + u * S;
    }
    function Y(v) {
        return y + v * S;
    }

    ctx.save();

    // clip to unit square
    ctx.beginPath();
    ctx.rect(x, y, S, S);
    ctx.clip();

    const cx = 0.5;
    const cy = 0.5;

    // -------------------------
    // BLUE PIPE (horizontal)
    // -------------------------
    const blueTop = cy - R;
    const blueBot = cy + R;

    const blueGrad = ctx.createLinearGradient(0, Y(blueTop), 0, Y(blueBot));
    blueGrad.addColorStop(0.0, "#003388");
    blueGrad.addColorStop(0.35, "#1f7cff");
    blueGrad.addColorStop(0.5, "#75b7ff");
    blueGrad.addColorStop(0.65, "#1f7cff");
    blueGrad.addColorStop(1.0, "#002866");

    ctx.fillStyle = blueGrad;
    ctx.fillRect(X(0), Y(blueTop), S, Y(blueBot) - Y(blueTop));

    // -------------------------
    // RED PIPE (vertical)
    // -------------------------
    const redLeft = cx - r;
    const redRight = cx + r;

    // taper start (derived earlier)
    const y0 = Math.sqrt(Math.max(0, 2 * R * r - r * r));

    const topTaper = cy - y0;
    const bottomTaper = cy + y0;

    ctx.beginPath();

    // top stem
    ctx.moveTo(X(redLeft), Y(0));
    ctx.lineTo(X(redRight), Y(0));
    ctx.lineTo(X(redRight), Y(topTaper));

    // taper to center
    ctx.lineTo(X(cx), Y(cy));

    // taper out
    ctx.lineTo(X(redRight), Y(bottomTaper));
    ctx.lineTo(X(redRight), Y(1));
    ctx.lineTo(X(redLeft), Y(1));
    ctx.lineTo(X(redLeft), Y(bottomTaper));

    // taper back to center
    ctx.lineTo(X(cx), Y(cy));

    // taper out
    ctx.lineTo(X(redLeft), Y(topTaper));

    ctx.closePath();

    const redGrad = ctx.createLinearGradient(X(redLeft), 0, X(redRight), 0);
    redGrad.addColorStop(0.0, "#7a0000");
    redGrad.addColorStop(0.35, "#ff3030");
    redGrad.addColorStop(0.5, "#ffaaaa");
    redGrad.addColorStop(0.65, "#ff3030");
    redGrad.addColorStop(1.0, "#7a0000");

    ctx.fillStyle = redGrad;
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = Math.max(1, S * 0.006);
    ctx.stroke();

    ctx.restore();
}
