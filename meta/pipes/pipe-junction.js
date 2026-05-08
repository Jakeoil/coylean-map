/**
 * Draws a 2D orthographic rendering of a perpendicular red/blue pipe junction
 * inside a square drawing region.
 *
 * The function renders:
 * - A horizontal blue pipe
 * - A vertical red pipe
 *
 * Each pipe diameter is given independently. The larger-diameter pipe should be
 * treated as the visually dominant pipe at the junction, while the smaller pipe
 * tapers into it. If the diameters are equal, the junction produces the symmetric
 * equal-radius case, with straight 45° seam lines in top view.
 *
 * Both pipes are modeled as cylinders tangent to a common top plane and projected
 * orthographically. The visible seam/taper is based on equal-height contour
 * geometry between the two cylindrical surfaces.
 *
 * The drawing is scaled to fit inside a 1×1 logical square, mapped to the canvas
 * rectangle defined by (x, y, size).
 *
 * @param {CanvasRenderingContext2D} ctx
 *   The 2D canvas rendering context used for drawing.
 *
 * @param {number} x
 *   The x-coordinate, in pixels, of the top-left corner of the drawing region.
 *
 * @param {number} y
 *   The y-coordinate, in pixels, of the top-left corner of the drawing region.
 *
 * @param {number} size
 *   The width and height, in pixels, of the square drawing region.
 *
 * @param {number} blueD
 *   Diameter of the horizontal blue pipe, in normalized units.
 *   Must satisfy 0 < blueD <= 1.
 *
 * @param {number} redD
 *   Diameter of the vertical red pipe, in normalized units.
 *   Must satisfy 0 < redD <= 1.
 *
 * @returns {void}
 *
 * @remarks
 * - Coordinates are normalized to [0, 1] × [0, 1] before being scaled to canvas pixels.
 * - The larger pipe is drawn as the continuous crossbar/through-pipe.
 * - The smaller pipe is clipped/tapered into the larger pipe.
 * - If blueD > redD, the vertical red pipe tapers into the horizontal blue pipe.
 * - If redD > blueD, the horizontal blue pipe tapers into the vertical red pipe.
 * - If blueD === redD, the junction is symmetric.
 * - Shading is approximated with linear gradients to suggest cylindrical form.
 *
 * @example
 * drawPipeJunction(ctx, 50, 50, 500, 1.0, 0.5); // blue larger
 *
 * @example
 * drawPipeJunction(ctx, 50, 50, 500, 0.4, 0.9); // red larger
 *
 * @example
 * drawPipeJunction(ctx, 50, 50, 500, 0.75, 0.75); // equal diameters
 */

export function drawPipeJunction(ctx, x, y, size, blueD = 1, redD = 0.5) {
    blueD = Math.min(1, Math.max(0, blueD));
    redD = Math.min(1, Math.max(0, redD));

    const blueOff = blueD <= 0;
    const redOff = redD <= 0;

    if (blueOff && redOff) return;
    if (blueOff) return drawSingleRedPipe(ctx, x, y, size, redD);
    if (redOff) return drawSingleBluePipe(ctx, x, y, size, blueD);

    if (blueD >= redD) {
        drawJunctionBlueCrossbar(ctx, x, y, size, blueD, redD);
    } else {
        drawJunctionRedCrossbar(ctx, x, y, size, blueD, redD);
    }
}

function drawSingleBluePipe(ctx, x, y, size, blueD) {
    const S = size;
    const R = blueD / 2;
    const cy = 0.5;
    const X = (u) => x + u * S;
    const Y = (v) => y + v * S;
    const blueTop = cy - R;
    const blueBot = cy + R;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, S, S);
    ctx.clip();

    const blueGrad = ctx.createLinearGradient(0, Y(blueTop), 0, Y(blueBot));
    blueGrad.addColorStop(0.0, "#003388");
    blueGrad.addColorStop(0.35, "#1f7cff");
    blueGrad.addColorStop(0.5, "#75b7ff");
    blueGrad.addColorStop(0.65, "#1f7cff");
    blueGrad.addColorStop(1.0, "#002866");

    ctx.fillStyle = blueGrad;
    ctx.fillRect(X(0), Y(blueTop), S, Y(blueBot) - Y(blueTop));

    ctx.restore();
}

function drawSingleRedPipe(ctx, x, y, size, redD) {
    const S = size;
    const R = redD / 2;
    const cx = 0.5;
    const X = (u) => x + u * S;
    const Y = (v) => y + v * S;
    const redLeft = cx - R;
    const redRight = cx + R;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, S, S);
    ctx.clip();

    const redGrad = ctx.createLinearGradient(X(redLeft), 0, X(redRight), 0);
    redGrad.addColorStop(0.0, "#7a0000");
    redGrad.addColorStop(0.35, "#ff3030");
    redGrad.addColorStop(0.5, "#ffaaaa");
    redGrad.addColorStop(0.65, "#ff3030");
    redGrad.addColorStop(1.0, "#7a0000");

    ctx.fillStyle = redGrad;
    ctx.fillRect(X(redLeft), Y(0), X(redRight) - X(redLeft), S);

    ctx.restore();
}

function drawJunctionBlueCrossbar(ctx, x, y, size, blueD, redD) {
    const S = size;
    const R = blueD / 2;
    const r = redD / 2;
    const cx = 0.5,
        cy = 0.5;

    const X = (u) => x + u * S;
    const Y = (v) => y + v * S;

    const blueTop = cy - R;
    const blueBot = cy + R;

    const redLeft = cx - r;
    const redRight = cx + r;

    const y0 = Math.sqrt(Math.max(0, 2 * R * r - r * r));
    const topTaper = cy - y0;
    const bottomTaper = cy + y0;

    ctx.save();

    ctx.beginPath();
    ctx.rect(x, y, S, S);
    ctx.clip();

    const blueGrad = ctx.createLinearGradient(0, Y(blueTop), 0, Y(blueBot));
    blueGrad.addColorStop(0.0, "#003388");
    blueGrad.addColorStop(0.35, "#1f7cff");
    blueGrad.addColorStop(0.5, "#75b7ff");
    blueGrad.addColorStop(0.65, "#1f7cff");
    blueGrad.addColorStop(1.0, "#002866");

    ctx.fillStyle = blueGrad;
    ctx.fillRect(X(0), Y(blueTop), S, Y(blueBot) - Y(blueTop));

    ctx.beginPath();
    ctx.moveTo(X(redLeft), Y(0));
    ctx.lineTo(X(redRight), Y(0));
    ctx.lineTo(X(redRight), Y(topTaper));
    ctx.lineTo(X(cx), Y(cy));
    ctx.lineTo(X(redRight), Y(bottomTaper));
    ctx.lineTo(X(redRight), Y(1));
    ctx.lineTo(X(redLeft), Y(1));
    ctx.lineTo(X(redLeft), Y(bottomTaper));
    ctx.lineTo(X(cx), Y(cy));
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

function drawJunctionRedCrossbar(ctx, x, y, size, blueD, redD) {
    const S = size;
    const R = redD / 2;
    const r = blueD / 2;
    const cx = 0.5,
        cy = 0.5;

    const X = (u) => x + u * S;
    const Y = (v) => y + v * S;

    const redLeft = cx - R;
    const redRight = cx + R;

    const blueTop = cy - r;
    const blueBot = cy + r;

    const x0 = Math.sqrt(Math.max(0, 2 * R * r - r * r));
    const leftTaper = cx - x0;
    const rightTaper = cx + x0;

    ctx.save();

    ctx.beginPath();
    ctx.rect(x, y, S, S);
    ctx.clip();

    const redGrad = ctx.createLinearGradient(X(redLeft), 0, X(redRight), 0);
    redGrad.addColorStop(0.0, "#7a0000");
    redGrad.addColorStop(0.35, "#ff3030");
    redGrad.addColorStop(0.5, "#ffaaaa");
    redGrad.addColorStop(0.65, "#ff3030");
    redGrad.addColorStop(1.0, "#7a0000");

    ctx.fillStyle = redGrad;
    ctx.fillRect(X(redLeft), Y(0), X(redRight) - X(redLeft), S);

    ctx.beginPath();
    ctx.moveTo(X(0), Y(blueTop));
    ctx.lineTo(X(leftTaper), Y(blueTop));
    ctx.lineTo(X(cx), Y(cy));
    ctx.lineTo(X(leftTaper), Y(blueBot));
    ctx.lineTo(X(0), Y(blueBot));
    ctx.lineTo(X(0), Y(blueTop));
    ctx.closePath();

    ctx.moveTo(X(1), Y(blueTop));
    ctx.lineTo(X(rightTaper), Y(blueTop));
    ctx.lineTo(X(cx), Y(cy));
    ctx.lineTo(X(rightTaper), Y(blueBot));
    ctx.lineTo(X(1), Y(blueBot));
    ctx.lineTo(X(1), Y(blueTop));
    ctx.closePath();

    const blueGrad = ctx.createLinearGradient(0, Y(blueTop), 0, Y(blueBot));
    blueGrad.addColorStop(0.0, "#003388");
    blueGrad.addColorStop(0.35, "#1f7cff");
    blueGrad.addColorStop(0.5, "#75b7ff");
    blueGrad.addColorStop(0.65, "#1f7cff");
    blueGrad.addColorStop(1.0, "#002866");

    ctx.fillStyle = blueGrad;
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = Math.max(1, S * 0.006);
    ctx.stroke();

    ctx.restore();
}
