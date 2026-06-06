"use strict";

// coylean-viewport — generic pan / zoom / order-ladder / shift-clutch engine.
//
// Factored out of meta/planet-coyleus/terrains.js so any Coylean page can reuse
// the good interaction parts without dragging in glyphs, cages or seniority.
// You give it a canvas, a ladder of "orders" (each order is a Coylean square /
// map of some integer side), and a callback that builds the field for an order.
// The engine owns the view, the wheel-zoom, the drag-pan, and — the clutch — the
// decoupling of the *displayed* order from the raw zoom:
//
//   • Plain wheel zoom snaps the displayed order to the zoom, re-tiling to a
//     finer / coarser Coylean subdivision as you cross each threshold.
//   • Holding SHIFT engages the clutch: the order is *held* while you keep
//     zooming, slipping only when the zoom runs past a leash. So the divisions
//     don't re-tile mid-zoom — you can magnify one order freely.
//
// The ladder is defined purely by `sides` (an increasing array of integer side
// lengths). zoomForOrder(k) = target · side[k]; the continuous ladder position
// is the inverse, interpolated in log space, so the ladder works for powers of
// two, Fibonacci numbers, or any increasing sequence.

import { drawLineField } from "./coylean-field.mjs";

export function createViewport(canvas, config) {
    const {
        sides, // [side0, side1, …] increasing — defines the order ladder
        fieldForOrder, // (k) => field (see coylean-field.mjs)
        target = 42, // aimed-for cell size in px (picks the order for a zoom)
        leashIn = 4, // clutch slack zooming IN, in orders
        leashOut = 3, // clutch slack zooming OUT, in orders
        onChange, // (k) => void — fired when the displayed order changes
        draw = drawLineField, // (ctx, W, H, field, view, drawOpts)
    } = config;

    let ladder = sides.slice();
    let drawOpts = config.drawOpts || {};
    const view = { cx: 0.5, cy: 0.5, z: 0 };
    let curK = -1; // displayed order (decoupled from raw zoom by the clutch)
    let shownK = -1; // last order onChange saw
    let lastRoundL = null; // last rounded ladder position (clutch reference)
    let lastField = null; // for external hit-testing if needed

    const N = () => ladder.length;
    const clampK = (k) => Math.max(0, Math.min(N() - 1, k));

    // log(side) at a (possibly fractional, out-of-range) ladder index, linearly
    // extrapolated past the ends so the clutch leash can over-zoom both ways.
    function logSideAt(k) {
        const L = ladder.map(Math.log);
        const n = L.length;
        if (k <= 0) return L[0] + k * (L[1] - L[0]);
        if (k >= n - 1) return L[n - 1] + (k - (n - 1)) * (L[n - 1] - L[n - 2]);
        const i = Math.floor(k);
        return L[i] + (k - i) * (L[i + 1] - L[i]);
    }
    const zoomForOrder = (k) => target * Math.exp(logSideAt(k));

    // Inverse of zoomForOrder: continuous ladder position for the current zoom.
    function ladderPos() {
        const want = Math.log(view.z / target);
        const L = ladder.map(Math.log);
        const n = L.length;
        if (want <= L[0]) return (want - L[0]) / (L[1] - L[0]);
        for (let k = 0; k < n - 1; k++) {
            if (want <= L[k + 1]) {
                return k + (want - L[k]) / (L[k + 1] - L[k]);
            }
        }
        return n - 1 + (want - L[n - 1]) / (L[n - 1] - L[n - 2]);
    }

    // The clutch. Without shift the order snaps to the zoom whenever a normal
    // threshold is crossed. With shift it is held, lagging the zoom on a leash
    // (sticky both ways); the offset persists until a no-shift crossing corrects.
    function updateOrder(shiftHeld) {
        const Lp = ladderPos();
        const roundL = Math.round(Lp);
        if (lastRoundL == null) {
            curK = clampK(roundL);
        } else if (shiftHeld) {
            if (Lp > curK + leashIn) curK = clampK(Math.round(Lp - leashIn));
            else if (Lp < curK - leashOut)
                curK = clampK(Math.round(Lp + leashOut));
            // else hold the order — the clutch slips
        } else if (roundL !== lastRoundL) {
            curK = clampK(roundL);
        }
        lastRoundL = roundL;
    }

    function clampZoom() {
        view.z = Math.max(
            zoomForOrder(-leashOut),
            Math.min(zoomForOrder(N() - 1 + leashIn), view.z),
        );
    }
    function clampView() {
        clampZoom();
        const hw = canvas.width / 2 / view.z;
        const hh = canvas.height / 2 / view.z;
        view.cx = 2 * hw >= 1 ? 0.5 : Math.max(hw, Math.min(1 - hw, view.cx));
        view.cy = 2 * hh >= 1 ? 0.5 : Math.max(hh, Math.min(1 - hh, view.cy));
    }

    // Coalesce zoom/pan renders to one per animation frame.
    const raf =
        typeof requestAnimationFrame !== "undefined"
            ? requestAnimationFrame
            : (f) => f();
    let rafPending = false;
    function schedule() {
        if (rafPending) return;
        rafPending = true;
        raf(() => {
            rafPending = false;
            render();
        });
    }

    function render() {
        if (curK !== shownK) {
            shownK = curK;
            if (onChange) onChange(curK);
        }
        lastField = fieldForOrder(curK);
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        draw(ctx, canvas.width, canvas.height, lastField, view, drawOpts);
    }

    // ── interaction ──
    let drag = null;
    canvas.addEventListener(
        "wheel",
        (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
            const my = (e.clientY - rect.top) * (canvas.height / rect.height);
            const uxAt = view.cx + (mx - canvas.width / 2) / view.z;
            const uyAt = view.cy + (my - canvas.height / 2) / view.z;
            // shift can remap the wheel to the X axis (macOS) — take either.
            const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
            view.z *= Math.exp(-delta * 0.0016);
            clampZoom();
            updateOrder(e.shiftKey); // shift slips the clutch
            view.cx = uxAt - (mx - canvas.width / 2) / view.z;
            view.cy = uyAt - (my - canvas.height / 2) / view.z;
            clampView();
            schedule();
        },
        { passive: false },
    );
    canvas.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
    });
    window.addEventListener("mousemove", (e) => {
        if (!drag) return;
        const rect = canvas.getBoundingClientRect();
        const sc = canvas.width / rect.width;
        view.cx = drag.cx - ((e.clientX - drag.x) * sc) / view.z;
        view.cy = drag.cy - ((e.clientY - drag.y) * sc) / view.z;
        clampView();
        schedule();
    });
    window.addEventListener("mouseup", () => {
        drag = null;
    });

    // ── public API ──
    function jumpToOrder(k) {
        curK = clampK(k);
        view.z = zoomForOrder(curK);
        lastRoundL = Math.round(ladderPos());
        clampView();
        render();
    }
    function setLadder(newSides, { keepZoom = true } = {}) {
        ladder = newSides.slice();
        if (!keepZoom) view.z = zoomForOrder(clampK(curK));
        clampZoom();
        updateOrder(false);
        clampView();
        render();
    }
    function setDrawOpts(next) {
        drawOpts = { ...drawOpts, ...next };
        render();
    }

    // initial zoom: middle of the ladder
    curK = clampK(Math.floor(N() / 2));
    view.z = zoomForOrder(curK);
    clampView();

    return {
        view,
        render,
        schedule,
        jumpToOrder,
        setLadder,
        setDrawOpts,
        getOrder: () => curK,
        getField: () => lastField,
    };
}
