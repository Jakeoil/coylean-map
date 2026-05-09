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
 * @param {number} blueDLeft
 *   Diameter of the horizontal blue pipe on the LEFT half of the drawing,
 *   in normalized units. 0 ≤ blueDLeft ≤ 1; 0 means no blue on the left.
 *
 * @param {number} blueDRight
 *   Diameter of the horizontal blue pipe on the RIGHT half of the drawing,
 *   in normalized units. 0 ≤ blueDRight ≤ 1; 0 means no blue on the right.
 *
 * @param {number} redDTop
 *   Diameter of the vertical red pipe on the TOP half of the drawing,
 *   in normalized units. 0 ≤ redDTop ≤ 1; 0 means no red on top.
 *
 * @param {number} redDBottom
 *   Diameter of the vertical red pipe on the BOTTOM half of the drawing,
 *   in normalized units. 0 ≤ redDBottom ≤ 1; 0 means no red on bottom.
 *
 * @returns {void}
 *
 * @remarks
 * - Coordinates are normalized to [0, 1] × [0, 1] before being scaled to canvas pixels.
 * - The drawing is split into four quadrants at (cx, cy) = (0.5, 0.5) and
 *   each quadrant rendered independently with its (blueD_side, redD_half)
 *   pair. In each quadrant the larger pipe is the through-pipe and the
 *   smaller tapers into it.
 * - When the four quadrants' diameters disagree, the blue band steps at
 *   x = cx and/or the red strip steps at y = cy. If neighboring quadrants
 *   disagree on which pipe dominates, the shared seam may show a visible
 *   discontinuity — natural consequence of an asymmetric junction.
 * - Shading is approximated with linear gradients to suggest cylindrical form.
 *
 * @example
 * drawPipeJunction(ctx, 50, 50, 500, 1.0, 1.0, 0.5, 0.5); // symmetric, blue larger
 *
 * @example
 * drawPipeJunction(ctx, 50, 50, 500, 0.4, 0.4, 0.9, 0.9); // symmetric, red larger
 *
 * @example
 * drawPipeJunction(ctx, 50, 50, 500, 1.0, 0.4, 0.5, 0.7); // fully asymmetric
 */

export function drawPipeJunction(
    ctx,
    x,
    y,
    size,
    blueDLeft = 1,
    blueDRight = 1,
    redDTop = 0.5,
    redDBottom = 0.5,
) {
    blueDLeft = Math.min(1, Math.max(0, blueDLeft));
    blueDRight = Math.min(1, Math.max(0, blueDRight));
    redDTop = Math.min(1, Math.max(0, redDTop));
    redDBottom = Math.min(1, Math.max(0, redDBottom));

    drawQuadrant(ctx, x, y, size, blueDLeft, redDTop, true, true); // NW
    drawQuadrant(ctx, x, y, size, blueDRight, redDTop, false, true); // NE
    drawQuadrant(ctx, x, y, size, blueDLeft, redDBottom, true, false); // SW
    drawQuadrant(ctx, x, y, size, blueDRight, redDBottom, false, false); // SE
}

function drawQuadrant(ctx, x, y, size, blueD, redD, isLeft, isTop) {
    if (blueD <= 0 && redD <= 0) return;

    const halfX = isLeft ? x : x + size / 2;
    const halfY = isTop ? y : y + size / 2;
    const halfW = size / 2;
    const halfH = size / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(halfX, halfY, halfW, halfH);
    ctx.clip();

    if (blueD <= 0) {
        drawSingleRedPipe(ctx, x, y, size, redD);
    } else if (redD <= 0) {
        drawSingleBluePipe(ctx, x, y, size, blueD);
    } else if (blueD >= redD) {
        drawJunctionBlueCrossbar(ctx, x, y, size, blueD, redD);
    } else {
        drawJunctionRedCrossbar(ctx, x, y, size, blueD, redD);
    }

    ctx.restore();
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

/**
 * SVG counterpart of {@link drawPipeJunction}. Appends a `<g>` (with a nested
 * `<defs>` for gradients and clipPaths) to the given viewport element. The
 * geometry, parameter meaning, and shading match the canvas version.
 *
 * @param {SVGGraphicsElement} viewport
 *   An SVG container element (typically a `<g>`) the junction will be appended
 *   to. Must live inside an `<svg>` document.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} size
 * @param {number} blueDLeft
 * @param {number} blueDRight
 * @param {number} redDTop
 * @param {number} redDBottom
 *
 * @returns {SVGGElement} The root `<g>` that was appended, for caller cleanup.
 */
export function drawPipeJunctionSvg(
    viewport,
    x,
    y,
    size,
    blueDLeft = 1,
    blueDRight = 1,
    redDTop = 0.5,
    redDBottom = 0.5,
) {
    blueDLeft = Math.min(1, Math.max(0, blueDLeft));
    blueDRight = Math.min(1, Math.max(0, blueDRight));
    redDTop = Math.min(1, Math.max(0, redDTop));
    redDBottom = Math.min(1, Math.max(0, redDBottom));

    const root = svgEl("g", { class: "pipe-junction" });
    const defs = svgEl("defs", {});
    root.appendChild(defs);
    viewport.appendChild(root);

    const q = (bD, rD, isLeft, isTop) =>
        drawQuadrantSvg(root, defs, x, y, size, bD, rD, isLeft, isTop);

    q(blueDLeft, redDTop, true, true); // NW
    q(blueDRight, redDTop, false, true); // NE
    q(blueDLeft, redDBottom, true, false); // SW
    q(blueDRight, redDBottom, false, false); // SE

    return root;
}

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v == null) continue;
        el.setAttribute(k, v);
    }
    return el;
}

let nextSvgId = 0;
const uid = (prefix) => `${prefix}-${nextSvgId++}`;

function drawQuadrantSvg(root, defs, x, y, size, blueD, redD, isLeft, isTop) {
    if (blueD <= 0 && redD <= 0) return;

    const halfX = isLeft ? x : x + size / 2;
    const halfY = isTop ? y : y + size / 2;
    const halfW = size / 2;
    const halfH = size / 2;

    const clipId = uid("pipe-clip");
    const clipPath = svgEl("clipPath", { id: clipId });
    clipPath.appendChild(
        svgEl("rect", { x: halfX, y: halfY, width: halfW, height: halfH }),
    );
    defs.appendChild(clipPath);

    const g = svgEl("g", { "clip-path": `url(#${clipId})` });
    root.appendChild(g);

    if (blueD <= 0) {
        drawSingleRedPipeSvg(g, defs, x, y, size, redD);
    } else if (redD <= 0) {
        drawSingleBluePipeSvg(g, defs, x, y, size, blueD);
    } else if (blueD >= redD) {
        drawJunctionBlueCrossbarSvg(g, defs, x, y, size, blueD, redD);
    } else {
        drawJunctionRedCrossbarSvg(g, defs, x, y, size, blueD, redD);
    }
}

function makeBlueGradient(defs, yTopPx, yBotPx) {
    const id = uid("blue-grad");
    const grad = svgEl("linearGradient", {
        id,
        x1: 0,
        y1: yTopPx,
        x2: 0,
        y2: yBotPx,
        gradientUnits: "userSpaceOnUse",
    });
    const stops = [
        ["0%", "#003388"],
        ["35%", "#1f7cff"],
        ["50%", "#75b7ff"],
        ["65%", "#1f7cff"],
        ["100%", "#002866"],
    ];
    for (const [offset, color] of stops) {
        grad.appendChild(svgEl("stop", { offset, "stop-color": color }));
    }
    defs.appendChild(grad);
    return id;
}

function makeRedGradient(defs, xLeftPx, xRightPx) {
    const id = uid("red-grad");
    const grad = svgEl("linearGradient", {
        id,
        x1: xLeftPx,
        y1: 0,
        x2: xRightPx,
        y2: 0,
        gradientUnits: "userSpaceOnUse",
    });
    const stops = [
        ["0%", "#7a0000"],
        ["35%", "#ff3030"],
        ["50%", "#ffaaaa"],
        ["65%", "#ff3030"],
        ["100%", "#7a0000"],
    ];
    for (const [offset, color] of stops) {
        grad.appendChild(svgEl("stop", { offset, "stop-color": color }));
    }
    defs.appendChild(grad);
    return id;
}

function drawSingleBluePipeSvg(g, defs, x, y, size, blueD) {
    const S = size;
    const R = blueD / 2;
    const cy = 0.5;
    const X = (u) => x + u * S;
    const Y = (v) => y + v * S;
    const blueTop = cy - R;
    const blueBot = cy + R;

    const id = makeBlueGradient(defs, Y(blueTop), Y(blueBot));
    g.appendChild(
        svgEl("rect", {
            x: X(0),
            y: Y(blueTop),
            width: S,
            height: Y(blueBot) - Y(blueTop),
            fill: `url(#${id})`,
        }),
    );
}

function drawSingleRedPipeSvg(g, defs, x, y, size, redD) {
    const S = size;
    const R = redD / 2;
    const cx = 0.5;
    const X = (u) => x + u * S;
    const Y = (v) => y + v * S;
    const redLeft = cx - R;
    const redRight = cx + R;

    const id = makeRedGradient(defs, X(redLeft), X(redRight));
    g.appendChild(
        svgEl("rect", {
            x: X(redLeft),
            y: Y(0),
            width: X(redRight) - X(redLeft),
            height: S,
            fill: `url(#${id})`,
        }),
    );
}

function drawJunctionBlueCrossbarSvg(g, defs, x, y, size, blueD, redD) {
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

    const blueId = makeBlueGradient(defs, Y(blueTop), Y(blueBot));
    g.appendChild(
        svgEl("rect", {
            x: X(0),
            y: Y(blueTop),
            width: S,
            height: Y(blueBot) - Y(blueTop),
            fill: `url(#${blueId})`,
        }),
    );

    const d = [
        `M ${X(redLeft)} ${Y(0)}`,
        `L ${X(redRight)} ${Y(0)}`,
        `L ${X(redRight)} ${Y(topTaper)}`,
        `L ${X(cx)} ${Y(cy)}`,
        `L ${X(redRight)} ${Y(bottomTaper)}`,
        `L ${X(redRight)} ${Y(1)}`,
        `L ${X(redLeft)} ${Y(1)}`,
        `L ${X(redLeft)} ${Y(bottomTaper)}`,
        `L ${X(cx)} ${Y(cy)}`,
        `L ${X(redLeft)} ${Y(topTaper)}`,
        `Z`,
    ].join(" ");

    const redId = makeRedGradient(defs, X(redLeft), X(redRight));
    g.appendChild(
        svgEl("path", {
            d,
            fill: `url(#${redId})`,
            stroke: "rgba(0,0,0,0.3)",
            "stroke-width": Math.max(1, S * 0.006),
        }),
    );
}

function drawJunctionRedCrossbarSvg(g, defs, x, y, size, blueD, redD) {
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

    const redId = makeRedGradient(defs, X(redLeft), X(redRight));
    g.appendChild(
        svgEl("rect", {
            x: X(redLeft),
            y: Y(0),
            width: X(redRight) - X(redLeft),
            height: S,
            fill: `url(#${redId})`,
        }),
    );

    const d = [
        `M ${X(0)} ${Y(blueTop)}`,
        `L ${X(leftTaper)} ${Y(blueTop)}`,
        `L ${X(cx)} ${Y(cy)}`,
        `L ${X(leftTaper)} ${Y(blueBot)}`,
        `L ${X(0)} ${Y(blueBot)}`,
        `Z`,
        `M ${X(1)} ${Y(blueTop)}`,
        `L ${X(rightTaper)} ${Y(blueTop)}`,
        `L ${X(cx)} ${Y(cy)}`,
        `L ${X(rightTaper)} ${Y(blueBot)}`,
        `L ${X(1)} ${Y(blueBot)}`,
        `Z`,
    ].join(" ");

    const blueId = makeBlueGradient(defs, Y(blueTop), Y(blueBot));
    g.appendChild(
        svgEl("path", {
            d,
            fill: `url(#${blueId})`,
            stroke: "rgba(0,0,0,0.3)",
            "stroke-width": Math.max(1, S * 0.006),
        }),
    );
}
