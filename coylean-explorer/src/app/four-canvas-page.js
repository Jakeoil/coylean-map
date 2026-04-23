import { Viewport } from "../display/viewport.js";
import { drawScene } from "../display/canvas-scene.js";

const CANVAS_TITLES = {
    A: "Canvas A",
    B: "Canvas B",
    C: "Canvas C",
    D: "Canvas D",
};

export function init() {
    const info = document.getElementById("info");
    const cells = document.querySelectorAll(".canvas-cell canvas[data-id]");

    const views = [];
    for (const canvas of cells) {
        views.push(makeCanvasView(canvas, info));
    }

    document.getElementById("reset-all").addEventListener("click", () => {
        for (const v of views) v.reset();
    });
}

// One independent canvas: own Viewport, own scene, own resize handling.
// No shared state with the other canvases.
function makeCanvasView(canvas, info) {
    const id = canvas.dataset.id;
    const ctx = canvas.getContext("2d");

    const vp = new Viewport({ onChange: draw });
    vp.attach(canvas);

    function resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));
        draw();
    }

    function draw() {
        const dpr = window.devicePixelRatio || 1;
        // Clear in device space.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Combined DPR + viewport transform: (x,y) in world → device pixels.
        ctx.setTransform(
            dpr * vp.zoom, 0,
            0, dpr * vp.zoom,
            dpr * vp.panX, dpr * vp.panY,
        );
        drawScene(ctx, vp.zoom, { title: CANVAS_TITLES[id] });
    }

    canvas.addEventListener("pointermove", (e) => {
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const { x, y } = vp.screenToWorld(sx, sy);
        info.innerHTML =
            `<div><b>Canvas ${id}</b></div>` +
            `<div>screen: (${sx.toFixed(0)}, ${sy.toFixed(0)})</div>` +
            `<div>world:  (${x.toFixed(2)}, ${y.toFixed(2)})</div>` +
            `<div>zoom:   ${vp.zoom.toFixed(3)}</div>`;
    });

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    return {
        reset: () => vp.reset(),
    };
}
