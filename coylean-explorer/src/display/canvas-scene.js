// Shared canvas rendering for the four-canvas demo.
// All world-space drawing. lineWidth and font are divided by zoom so they
// render at the same visual size regardless of zoom level.

export function drawScene(ctx, zoom, opts = {}) {
    const {
        title = "",
        extent = 200,     // grid runs from -extent to +extent in world units
        step = 20,        // minor grid spacing
        majorEvery = 5,   // label every Nth line
    } = opts;

    const lw = 1 / zoom;
    const majorStep = step * majorEvery;

    drawGrid(ctx, extent, step, lw);
    drawAxes(ctx, extent, lw);
    drawAxisLabels(ctx, extent, majorStep, zoom);
    drawOriginMarker(ctx, zoom);
    if (title) drawTitle(ctx, title, zoom);
}

function drawGrid(ctx, extent, step, lw) {
    ctx.strokeStyle = "#eee";
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let x = -extent; x <= extent; x += step) {
        ctx.moveTo(x, -extent);
        ctx.lineTo(x, extent);
    }
    for (let y = -extent; y <= extent; y += step) {
        ctx.moveTo(-extent, y);
        ctx.lineTo(extent, y);
    }
    ctx.stroke();
}

function drawAxes(ctx, extent, lw) {
    ctx.strokeStyle = "#999";
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(-extent, 0); ctx.lineTo(extent, 0);
    ctx.moveTo(0, -extent); ctx.lineTo(0, extent);
    ctx.stroke();
}

function drawAxisLabels(ctx, extent, majorStep, zoom) {
    drawLabel.setFont(ctx, 10, zoom);
    ctx.fillStyle = "#666";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let x = -extent; x <= extent; x += majorStep) {
        if (x === 0) continue;
        drawLabel(ctx, String(x), x, 4 / zoom, zoom);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let y = -extent; y <= extent; y += majorStep) {
        if (y === 0) continue;
        drawLabel(ctx, String(y), -4 / zoom, y, zoom);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    drawLabel(ctx, "0", -4 / zoom, 4 / zoom, zoom);
}

function drawOriginMarker(ctx, zoom) {
    ctx.fillStyle = "#1f6feb";
    ctx.beginPath();
    ctx.arc(0, 0, 3 / zoom, 0, Math.PI * 2);
    ctx.fill();
}

function drawTitle(ctx, text, zoom) {
    drawLabel.setFont(ctx, 14, zoom, "600");
    ctx.fillStyle = "#333";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    drawLabel(ctx, text, 8 / zoom, -8 / zoom, zoom);
}

// drawLabel(ctx, text, x, y, zoom) — draws text at world (x, y) using the
// font currently set. Caller is responsible for setFont, fillStyle, textAlign,
// and textBaseline beforehand (keeps the hot path allocation-free).
export function drawLabel(ctx, text, x, y) {
    ctx.fillText(text, x, y);
}

drawLabel.setFont = function (ctx, pxSize, zoom, weight = "400") {
    ctx.font = `${weight} ${pxSize / zoom}px system-ui, sans-serif`;
};
