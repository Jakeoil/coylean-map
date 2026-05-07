// Pan/zoom for an SVG element by transforming a <g> child in-place.
//
// Mouse: drag to pan, wheel to zoom (at cursor).
// Touch: one finger to pan, two fingers to pinch-zoom (around midpoint).
//
// All coordinates are converted from client space to SVG user space via the
// element's CTM, so zoom-at-cursor stays accurate even when the SVG is scaled
// by CSS.

export function attachSvgPanZoom(svg, group, opts = {}) {
    const minScale = opts.minScale ?? 0.05;
    const maxScale = opts.maxScale ?? 40;
    const zoomSpeed = opts.zoomSpeed ?? 0.0015;

    const state = { offsetX: 0, offsetY: 0, scale: 1 };

    function applyTransform() {
        group.setAttribute(
            "transform",
            `translate(${state.offsetX} ${state.offsetY}) scale(${state.scale})`,
        );
    }

    function clientToSvg(clientX, clientY) {
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return { x: clientX, y: clientY };
        const p = pt.matrixTransform(ctm.inverse());
        return { x: p.x, y: p.y };
    }

    function zoomAt(sx, sy, factor) {
        const newScale = Math.max(minScale, Math.min(maxScale, state.scale * factor));
        const worldX = (sx - state.offsetX) / state.scale;
        const worldY = (sy - state.offsetY) / state.scale;
        state.scale = newScale;
        state.offsetX = sx - worldX * newScale;
        state.offsetY = sy - worldY * newScale;
        applyTransform();
    }

    // ── Mouse pan/zoom ──
    let mousePan = null;

    svg.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        const p = clientToSvg(e.clientX, e.clientY);
        mousePan = { lastX: p.x, lastY: p.y };
        svg.classList.add("dragging");
        e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
        if (!mousePan) return;
        const p = clientToSvg(e.clientX, e.clientY);
        state.offsetX += p.x - mousePan.lastX;
        state.offsetY += p.y - mousePan.lastY;
        mousePan.lastX = p.x;
        mousePan.lastY = p.y;
        applyTransform();
    });
    window.addEventListener("mouseup", () => {
        mousePan = null;
        svg.classList.remove("dragging");
    });

    svg.addEventListener(
        "wheel",
        (e) => {
            e.preventDefault();
            const p = clientToSvg(e.clientX, e.clientY);
            const factor = Math.exp(-e.deltaY * zoomSpeed);
            zoomAt(p.x, p.y, factor);
        },
        { passive: false },
    );

    // ── Touch pan/pinch ──
    let touchState = null;

    function touchMidDist(touches) {
        const a = clientToSvg(touches[0].clientX, touches[0].clientY);
        const b = clientToSvg(touches[1].clientX, touches[1].clientY);
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        return { midX, midY, dist };
    }

    // Distance (client-space pixels²) below which a single-touch drag is
    // still treated as a stationary tap. Past this, the touch becomes a
    // pan and we preventDefault to suppress the synthetic click.
    const TAP_THRESHOLD_SQ = 64; // 8 px

    svg.addEventListener(
        "touchstart",
        (e) => {
            if (e.touches.length === 1) {
                // No preventDefault on a single-touch start: a tap must be
                // allowed to fire its synthetic click so diamond handlers
                // run. We tentatively record pan state and only commit to
                // panning once movement exceeds the tap threshold.
                const t = e.touches[0];
                const p = clientToSvg(t.clientX, t.clientY);
                touchState = {
                    mode: "pan",
                    lastX: p.x,
                    lastY: p.y,
                    startClientX: t.clientX,
                    startClientY: t.clientY,
                    panActive: false,
                };
            } else if (e.touches.length === 2) {
                e.preventDefault();
                const m = touchMidDist(e.touches);
                touchState = {
                    mode: "pinch",
                    startDist: m.dist,
                    startMidX: m.midX,
                    startMidY: m.midY,
                    startOffsetX: state.offsetX,
                    startOffsetY: state.offsetY,
                    startScale: state.scale,
                };
            }
        },
        { passive: false },
    );

    svg.addEventListener(
        "touchmove",
        (e) => {
            if (!touchState) return;
            if (touchState.mode === "pan" && e.touches.length === 1) {
                const t = e.touches[0];
                if (!touchState.panActive) {
                    const dx = t.clientX - touchState.startClientX;
                    const dy = t.clientY - touchState.startClientY;
                    if (dx * dx + dy * dy < TAP_THRESHOLD_SQ) return;
                    touchState.panActive = true;
                }
                e.preventDefault();
                const p = clientToSvg(t.clientX, t.clientY);
                state.offsetX += p.x - touchState.lastX;
                state.offsetY += p.y - touchState.lastY;
                touchState.lastX = p.x;
                touchState.lastY = p.y;
                applyTransform();
            } else if (touchState.mode === "pinch" && e.touches.length === 2) {
                e.preventDefault();
                const m = touchMidDist(e.touches);
                const factor = m.dist / touchState.startDist;
                const newScale = Math.max(
                    minScale,
                    Math.min(maxScale, touchState.startScale * factor),
                );
                const worldMidX =
                    (touchState.startMidX - touchState.startOffsetX) /
                    touchState.startScale;
                const worldMidY =
                    (touchState.startMidY - touchState.startOffsetY) /
                    touchState.startScale;
                state.scale = newScale;
                state.offsetX =
                    touchState.startMidX -
                    worldMidX * newScale +
                    (m.midX - touchState.startMidX);
                state.offsetY =
                    touchState.startMidY -
                    worldMidY * newScale +
                    (m.midY - touchState.startMidY);
                applyTransform();
            }
        },
        { passive: false },
    );

    svg.addEventListener("touchend", (e) => {
        if (e.touches.length === 0) {
            touchState = null;
        } else if (e.touches.length === 1) {
            const p = clientToSvg(e.touches[0].clientX, e.touches[0].clientY);
            touchState = { mode: "pan", lastX: p.x, lastY: p.y };
        }
    });

    return {
        state,
        reset() {
            state.offsetX = 0;
            state.offsetY = 0;
            state.scale = 1;
            applyTransform();
        },
    };
}
