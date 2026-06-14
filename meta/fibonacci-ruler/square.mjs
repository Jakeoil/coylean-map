"use strict";

// square.mjs — page controller for the Fibonacci Coylean Square.
//
// Glue only: builds the proper Coylean square for an order (via
// Propagation.fromUniverseBoundary), owns the ruler toggle + order ladder DOM,
// and hands the reusable engine (coylean-viewport) a fieldForOrder callback. All
// the pan / zoom / order-ladder / shift-clutch behaviour and the line drawing
// live in the generic modules, so this file stays about the page.

import {
    Propagation,
    Universe,
} from "coylean/core";
import { createViewport } from "./coylean-viewport.mjs";

// Order ladders. Dyadic squares are powers of two; Fibonacci squares must be
// Fibonacci numbers (8 is the side both rulers share).
const LADDERS = {
    dyadic: [4, 8, 16, 32, 64, 128],
    fibi: [5, 8, 13, 21, 34, 55, 89],
};
const COLORS = {
    dyadic: "#8fbcff", // powers of two → cool blue
    fibi: "#ffd27a", // golden ratio → warm gold
};
const MAP_BG = "#0c1430";

// Build the proper Coylean square of `side` under `ruler`, packaged as a field
// for coylean-field: one cell of N/W context seeds it, the interior side×side SE
// block is the square, and the trailing result lines are excluded by the field's
// Mr/Mc bounds (firstDark = 1 suppresses the seed margin). Cached per (ruler,side).
const cache = new Map();
function buildField(side, ruler) {
    const key = `${ruler}:${side}`;
    let f = cache.get(key);
    if (f) return f;
    const universe = Universe.create({
        northExtent: 1,
        southExtent: side,
        westExtent: 1,
        eastExtent: side,
        hInitCol: 1,
        vInitRow: 1,
        ruler,
    });
    const p = Propagation.fromUniverseBoundary(universe);
    f = {
        side,
        firstDarkRow: 1,
        firstDarkCol: 1,
        Mr: p.numRows,
        Mc: p.numColumns,
        downMatrix: p.downMatrix,
        rightMatrix: p.rightMatrix,
        colPriority: p.colPriority,
        rowPriority: p.rowPriority,
    };
    cache.set(key, f);
    return f;
}

const $ = (id) => document.getElementById(id);

const state = { ruler: "dyadic" };

const CAPTIONS = {
    dyadic:
        "Dyadic ruler — pri(n). Heavy lines fall on powers of two, so zooming" +
        " in reveals the same square halving forever: binary self-similarity.",
    fibi:
        "Fibonacci ruler — fibiPri(n). Heavy lines fall on Fibonacci numbers," +
        " so the subdivision steps in the golden ratio: a quasiperiodic, φ-tiled" +
        " cousin of the dyadic square.",
};

function sizeCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const css = Math.min(canvas.parentElement.clientWidth, 680);
    canvas.style.width = css + "px";
    canvas.style.height = css + "px";
    canvas.width = Math.round(css * dpr);
    canvas.height = Math.round(css * dpr);
}

function init() {
    const canvas = $("map");
    sizeCanvas(canvas);

    const vp = createViewport(canvas, {
        sides: LADDERS[state.ruler],
        fieldForOrder: (k) => buildField(LADDERS[state.ruler][k], state.ruler),
        drawOpts: { background: MAP_BG, color: COLORS[state.ruler], cap: 7 },
        onChange: (k) => syncLadder(k),
    });

    // ── order ladder ──
    function buildLadder() {
        const box = $("ladder");
        box.innerHTML = "";
        LADDERS[state.ruler].forEach((side, k) => {
            const b = document.createElement("button");
            b.className = "rung";
            b.dataset.k = String(k);
            b.textContent = `${side}×${side}`;
            b.addEventListener("click", () => vp.jumpToOrder(k));
            box.appendChild(b);
        });
        syncLadder(vp.getOrder());
    }
    function syncLadder(k) {
        document.querySelectorAll("#ladder .rung").forEach((b) => {
            b.classList.toggle("on", Number(b.dataset.k) === k);
        });
        const side = LADDERS[state.ruler][k];
        $("orderlabel").textContent = `order ${k} · ${side}×${side} square`;
    }

    // ── ruler toggle ──
    function setRuler(ruler) {
        state.ruler = ruler;
        for (const b of document.querySelectorAll("[data-ruler]")) {
            b.classList.toggle("active", b.dataset.ruler === ruler);
        }
        $("caption").textContent = CAPTIONS[ruler];
        vp.setDrawOpts({ color: COLORS[ruler] });
        vp.setLadder(LADDERS[ruler], { keepZoom: true });
        buildLadder();
        syncLadder(vp.getOrder());
    }
    for (const b of document.querySelectorAll("[data-ruler]")) {
        b.addEventListener("click", () => setRuler(b.dataset.ruler));
    }

    window.addEventListener("resize", () => {
        sizeCanvas(canvas);
        vp.render();
    });

    buildLadder();
    setRuler("dyadic");
    vp.render();
}

init();
