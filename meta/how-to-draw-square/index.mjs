// ════════════════════════════════════════════════════════════════════════
// How to Draw a Coylean Square / Map — the geometric compass-and-straightedge
// construction, drawn from a FINISHED propagation.
//
// Both modes build a real engine propagation (descent's principle:
// Universe.create / fromUniverseExtents + fromUniverseBoundary). The square
// includes the western / northern context column ONLY where the anchor needs
// the ∞ frame there (westExtent = curH, northExtent = curV); the map needs no
// context cell at all. We then read the propagation's per-column / per-row
// ruler priorities and draw the passes in priority order, most senior first:
//
//   level = max(colPriority, rowPriority)
//   repeat:
//     for every column whose colPriority == level → a vertical pass
//     for every row    whose rowPriority == level → a horizontal pass
//     level = level − 1
//
// Each pass draws exactly the pencil-down stretches of its line — the maximal
// "on" runs of the finished propagation's downMatrix / rightMatrix. Those runs
// ARE what the pencil-toggle geometry produces (lift/drop at each existing
// crossing); reading them off the propagation makes the construction exact for
// every anchor, seniority, and (framed) margin. Verified in Node: rebuilding
// the matrices from the drawn runs reproduces the propagation exactly.
// ════════════════════════════════════════════════════════════════════════
import {
    Propagation,
    Seniority,
} from "coylean/core";

// Maximal runs of "on" cells down a column of downMatrix → [ [yStart, yEnd], … ]
function colRuns(downMatrix, i, R) {
    const runs = [];
    let s = -1;
    for (let j = 0; j < R; j++) {
        const on = !!downMatrix[j][i];
        if (on && s < 0) s = j;
        if (!on && s >= 0) {
            runs.push([s, j]);
            s = -1;
        }
    }
    if (s >= 0) runs.push([s, R]);
    return runs;
}
// Maximal runs of "on" cells along a row of rightMatrix → [ [xStart, xEnd], … ]
function rowRuns(rightMatrix, j, C) {
    const runs = [];
    let s = -1;
    for (let i = 0; i < C; i++) {
        const on = !!rightMatrix[i][j];
        if (on && s < 0) s = i;
        if (!on && s >= 0) {
            runs.push([s, i]);
            s = -1;
        }
    }
    if (s >= 0) runs.push([s, C]);
    return runs;
}

// Build the ordered draw timeline from a finished propagation P, in priority
// order. `vFirst` controls per-level seniority (V passes first vs H passes
// first). Coordinates are in cell units: column i → vertical line at x = i+1
// spanning its drawn y-runs; row j → horizontal line at y = j+1 spanning its
// drawn x-runs.
function buildTimeline(P, vFirst) {
    const C = P.numColumns;
    const R = P.numRows;
    const cP = P.colPriority;
    const rP = P.rowPriority;
    const timeline = [];
    const maxL = Math.max(...cP, ...rP);
    const minL = Math.min(...cP, ...rP);

    for (let level = maxL; level >= minL; level--) {
        const vCols = [];
        for (let i = 0; i < C; i++) if (cP[i] === level) vCols.push(i);
        const hRows = [];
        for (let j = 0; j < R; j++) if (rP[j] === level) hRows.push(j);

        const doV = () =>
            vCols.forEach((i, passIndex) => {
                const runs = colRuns(P.downMatrix, i, R);
                runs.forEach(([a, b], segIndex) => {
                    timeline.push({
                        orientation: "V",
                        fixed: i + 1,
                        start: a,
                        end: b,
                        level,
                        half: "V",
                        passIndex,
                        passCount: vCols.length,
                        segIndex,
                        segCount: runs.length,
                    });
                });
            });
        const doH = () =>
            hRows.forEach((j, passIndex) => {
                const runs = rowRuns(P.rightMatrix, j, C);
                runs.forEach(([a, b], segIndex) => {
                    timeline.push({
                        orientation: "H",
                        fixed: j + 1,
                        start: a,
                        end: b,
                        level,
                        half: "H",
                        passIndex,
                        passCount: hRows.length,
                        segIndex,
                        segCount: runs.length,
                    });
                });
            });

        if (vFirst) {
            doV();
            doH();
        } else {
            doH();
            doV();
        }
    }
    return { timeline, C, R, maxLevel: maxL };
}

// ════════════════════════════════════════════════════════════════════════
// Universe timeline — the whole plane, drawn from the central ∞-cross outward.
//
// A universe is centered on the origin: the two ∞ axes are the most-senior
// lines and cross at mid-board; the four quadrants radiate from them (nothing
// is context to hide). Draw order, per priority level, V passes then H:
//   • columns are visited  centre → left → right;
//   • each vertical line fills DOWN from the cross first, then UP;
//   • rows are visited     centre → above → below;
//   • each horizontal line fills RIGHT from the cross first, then LEFT.
// Every emitted segment carries a `grow` direction so the reveal animation
// starts at the cross and grows outward.
// ════════════════════════════════════════════════════════════════════════

// Split a column's on-runs into center-out pieces around the origin row `yc`:
// `downs` grow south from the cross, `ups` grow north, each ordered
// nearest-the-cross first. A run straddling the cross is cut at yc. Each piece
// is [near, far] — the cross-side endpoint first.
function colSegsFromCenter(runs, yc) {
    const downs = [];
    const ups = [];
    for (const [a, b] of runs) {
        if (b <= yc) ups.push([b, a]); // wholly north
        else if (a >= yc) downs.push([a, b]); // wholly south
        else {
            downs.push([yc, b]); // straddles the origin row
            ups.push([yc, a]);
        }
    }
    downs.sort((p, q) => p[0] - q[0]); // nearest cross (south) first
    ups.sort((p, q) => q[0] - p[0]); // nearest cross (north) first
    return { downs, ups };
}
// Symmetric for a row's on-runs around the origin column `xc`.
function rowSegsFromCenter(runs, xc) {
    const rights = [];
    const lefts = [];
    for (const [a, b] of runs) {
        if (b <= xc) lefts.push([b, a]); // wholly west
        else if (a >= xc) rights.push([a, b]); // wholly east
        else {
            rights.push([xc, b]);
            lefts.push([xc, a]);
        }
    }
    rights.sort((p, q) => p[0] - q[0]); // nearest cross (east) first
    lefts.sort((p, q) => q[0] - p[0]); // nearest cross (west) first
    return { rights, lefts };
}

function buildUniverseTimeline(P, vFirst) {
    const C = P.numColumns;
    const R = P.numRows;
    const cP = P.colPriority;
    const rP = P.rowPriority;
    const centerCol = -P.hInitCol; // ∞ vertical axis (max colPriority)
    const centerRow = -P.vInitRow; // ∞ horizontal axis
    const xc = centerCol + 1; // the cross in line (edge) coordinates
    const yc = centerRow + 1;
    const timeline = [];
    const maxL = Math.max(...cP, ...rP);
    const minL = Math.min(...cP, ...rP);

    const push = (o, fixed, near, far, grow, level, half, pi, pc, si, sc) =>
        timeline.push({
            orientation: o,
            fixed,
            start: Math.min(near, far),
            end: Math.max(near, far),
            grow,
            level,
            half,
            passIndex: pi,
            passCount: pc,
            segIndex: si,
            segCount: sc,
        });

    for (let level = maxL; level >= minL; level--) {
        const cols = [];
        for (let i = 0; i < C; i++) if (cP[i] === level) cols.push(i);
        const colOrder = [
            ...cols.filter((i) => i === centerCol),
            ...cols.filter((i) => i < centerCol).sort((a, b) => b - a),
            ...cols.filter((i) => i > centerCol).sort((a, b) => a - b),
        ];
        const rows = [];
        for (let j = 0; j < R; j++) if (rP[j] === level) rows.push(j);
        const rowOrder = [
            ...rows.filter((j) => j === centerRow),
            ...rows.filter((j) => j < centerRow).sort((a, b) => b - a),
            ...rows.filter((j) => j > centerRow).sort((a, b) => a - b),
        ];

        const doV = () =>
            colOrder.forEach((i, passIndex) => {
                const { downs, ups } = colSegsFromCenter(
                    colRuns(P.downMatrix, i, R),
                    yc,
                );
                const segs = [
                    ...downs.map((s) => ["down", s]),
                    ...ups.map((s) => ["up", s]),
                ];
                segs.forEach(([grow, [near, far]], si) =>
                    push("V", i + 1, near, far, grow, level, "V",
                        passIndex, colOrder.length, si, segs.length));
            });
        const doH = () =>
            rowOrder.forEach((j, passIndex) => {
                const { rights, lefts } = rowSegsFromCenter(
                    rowRuns(P.rightMatrix, j, C),
                    xc,
                );
                const segs = [
                    ...rights.map((s) => ["right", s]),
                    ...lefts.map((s) => ["left", s]),
                ];
                segs.forEach(([grow, [near, far]], si) =>
                    push("H", j + 1, near, far, grow, level, "H",
                        passIndex, rowOrder.length, si, segs.length));
            });

        if (vFirst) {
            doV();
            doH();
        } else {
            doH();
            doV();
        }
    }
    return { timeline, C, R, maxLevel: maxL };
}

// ── Build the propagation for the current mode + orientation ───────────────
// descent's principle: fromUniverseExtents + fromUniverseBoundary. The
// orientation triplet is the anchor: longitude = hInitCol, latitude = vInitRow,
// each ∈ {0,1}; seniority picks the V/H tie-break. The western/northern context
// column is included exactly when that axis's offset is 1 (so the ∞ frame
// lands in the margin); when it is 0 the ∞ axis is already in the grid.
function buildPropagation() {
    const { curH, curV, senH } = state.orient;
    const seniority = senH ? Seniority.horizontal() : Seniority.vertical();
    // renderWest / renderNorth = the western / northern margin the render layer
    // hides as ∞-context. Square hides its 1-cell frame; the universe hides
    // nothing (the ∞-cross is interior, drawn mid-board); the map has none.
    let opts, renderWest, renderNorth, maxPri;
    if (state.mode === "square") {
        const side = 2 ** state.order;
        maxPri = state.order + 1; // pri(0) (the ∞ axis) reads one above interior
        renderWest = curH; // include the western column iff the W frame is ∞ here
        renderNorth = curV; // …and the northern row iff the N frame is ∞ here
        opts = {
            northExtent: curV,
            westExtent: curH,
            // extend the far edge by the anchor's slide so the priority-`order`
            // spine still lands in the last column/row for every anchor.
            southExtent: side + (1 - curV),
            eastExtent: side + (1 - curH),
        };
    } else if (state.mode === "universe") {
        // Symmetric window around the origin: the ∞-cross lands interior and
        // the four quadrants radiate out. Nothing is context — draw it whole.
        const radius = 2 ** state.order;
        maxPri = state.order + 1; // pri(0) (the ∞ cross) reads above the interior
        renderWest = 0;
        renderNorth = 0;
        opts = {
            northExtent: radius,
            southExtent: radius,
            westExtent: radius,
            eastExtent: radius,
        };
    } else {
        renderWest = 0; // the map patch needs no context cell (north & west later)
        renderNorth = 0;
        maxPri =
            Math.ceil(
                Math.log2(Math.max(state.southExtent, state.eastExtent, 2)),
            ) + 1;
        opts = {
            northExtent: 0,
            westExtent: 0,
            southExtent: state.southExtent,
            eastExtent: state.eastExtent,
        };
    }
    const P = Propagation.fromUniverseExtents({
        ...opts,
        hInitCol: curH,
        vInitRow: curV,
        maxPri,
        seniority,
    });
    return { P, renderWest, renderNorth };
}

// ════════════════════════════════════════════════════════════════════════
// Rendering + animation controller
// ════════════════════════════════════════════════════════════════════════
const PAD = 40;
const SIZE = 720;
const INNER = SIZE - 2 * PAD;
const SVGNS = "http://www.w3.org/2000/svg";

const el = (id) => document.getElementById(id);
const guidesG = () => el("guides");
const inkG = () => el("ink");

const state = {
    mode: "square",
    order: 4,
    southExtent: 16,
    eastExtent: 24,
    orient: { curH: 1, curV: 1, senH: false },
    gran: "half",
    timeline: [],
    C: 1,
    R: 1,
    westExtent: 0,
    northExtent: 0,
    maxLevel: 1,
    scale: 1,
    offX: PAD,
    offY: PAD,
    drawn: 0,
    playing: false,
    timer: null,
};

// fit the drawable region [westExtent, C] × [northExtent, R] into the padded
// board, centered, preserving aspect — so the ∞ frame sits on the edge.
function computeFit() {
    const w = state.C - state.westExtent;
    const h = state.R - state.northExtent;
    state.scale = INNER / Math.max(w, h);
    state.offX = PAD + (INNER - w * state.scale) / 2;
    state.offY = PAD + (INNER - h * state.scale) / 2;
}
const X = (cx) => state.offX + (cx - state.westExtent) * state.scale;
const Y = (cy) => state.offY + (cy - state.northExtent) * state.scale;

function strokeWidthFor(level) {
    // heavier for senior (high-priority) lines, like the dyadic ruler
    const t = state.maxLevel > 0 ? level / state.maxLevel : 1;
    return 1.1 + 3.1 * t;
}
function colorFor(s) {
    if (!el("bycolor").checked) return null; // CSS --ink
    const hue = (s.level * 52 + 8) % 360;
    const light =
        document.documentElement.dataset.theme === "light" ? 42 : 70;
    return `hsl(${hue} 70% ${light}%)`;
}

function addLine(parent, x1, y1, x2, y2, classes) {
    const l = document.createElementNS(SVGNS, "line");
    l.setAttribute("x1", x1);
    l.setAttribute("y1", y1);
    l.setAttribute("x2", x2);
    l.setAttribute("y2", y2);
    l.setAttribute("class", classes.filter(Boolean).join(" "));
    parent.appendChild(l);
    return l;
}

function drawGuides() {
    guidesG().innerHTML = "";
    if (!el("grid").checked) return;
    for (let i = state.westExtent; i <= state.C; i++)
        addLine(guidesG(), X(i), Y(state.northExtent), X(i), Y(state.R), [
            "guide",
        ]);
    for (let j = state.northExtent; j <= state.R; j++)
        addLine(guidesG(), X(state.westExtent), Y(j), X(state.C), Y(j), [
            "guide",
        ]);
}

// append timeline entries [from, to) to the paper, clamped to the drawable
// region (the western/northern margin is context, not drawn).
function paintRange(from, to, animate) {
    for (let k = from; k < to; k++) {
        const s = state.timeline[k];
        let cx1, cy1, cx2, cy2;
        if (s.orientation === "V") {
            const ys = Math.max(s.start, state.northExtent);
            const ye = Math.min(s.end, state.R);
            if (ye - ys <= 0 || s.fixed < state.westExtent) continue;
            cx1 = cx2 = s.fixed;
            // grow from the cross: "up" reveals from the bottom (ye) toward ys
            [cy1, cy2] = s.grow === "up" ? [ye, ys] : [ys, ye];
        } else {
            const xs = Math.max(s.start, state.westExtent);
            const xe = Math.min(s.end, state.C);
            if (xe - xs <= 0 || s.fixed < state.northExtent) continue;
            cy1 = cy2 = s.fixed;
            // grow from the cross: "left" reveals from the right (xe) toward xs
            [cx1, cx2] = s.grow === "left" ? [xe, xs] : [xs, xe];
        }
        const l = addLine(inkG(), X(cx1), Y(cy1), X(cx2), Y(cy2), [
            "seg",
            animate ? "fresh" : "",
        ]);
        l.setAttribute("pathLength", "1");
        l.style.strokeWidth = strokeWidthFor(s.level);
        const c = colorFor(s);
        if (c) l.style.stroke = c;
        l.dataset.k = k; // for recolor
    }
}

function rebuild() {
    const { P, renderWest, renderNorth } = buildPropagation();
    const built =
        state.mode === "universe"
            ? buildUniverseTimeline(P, !state.orient.senH)
            : buildTimeline(P, !state.orient.senH);
    state.timeline = built.timeline;
    state.C = built.C;
    state.R = built.R;
    state.maxLevel = built.maxLevel;
    state.westExtent = renderWest;
    state.northExtent = renderNorth;
    state.drawn = 0;
    computeFit();
    inkG().innerHTML = "";
    drawGuides();
    updateLabel();
    updateButtons();
}

// Granularity grouping: a step advances to the end of the group holding the
// next undrawn segment.
function groupId(s, gran) {
    if (gran === "segment") return null;
    if (gran === "pass") return `${s.level}:${s.half}:${s.passIndex}`;
    if (gran === "half") return `${s.level}:${s.half}`;
    return `${s.level}`; // level
}
function nextStop() {
    const t = state.timeline;
    if (state.drawn >= t.length) return state.drawn;
    if (state.gran === "segment") return state.drawn + 1;
    const gid = groupId(t[state.drawn], state.gran);
    let i = state.drawn;
    while (i < t.length && groupId(t[i], state.gran) === gid) i++;
    return i;
}

function step(animate = true) {
    if (state.drawn >= state.timeline.length) {
        stop();
        return false;
    }
    const to = nextStop();
    paintRange(state.drawn, to, animate);
    state.drawn = to;
    updateLabel();
    updateButtons();
    if (state.drawn >= state.timeline.length) stop();
    return true;
}

function complete() {
    stop();
    paintRange(state.drawn, state.timeline.length, false);
    state.drawn = state.timeline.length;
    updateLabel();
    updateButtons();
}

function reset() {
    stop();
    state.drawn = 0;
    inkG().innerHTML = "";
    updateLabel();
    updateButtons();
}

// ── play / pause ──
function play() {
    if (state.playing) return;
    if (state.drawn >= state.timeline.length) reset();
    state.playing = true;
    el("play").textContent = "Pause ⏸";
    el("play").classList.add("primary");
    tick();
}
function stop() {
    state.playing = false;
    clearTimeout(state.timer);
    state.timer = null;
    el("play").textContent = "Play ▶";
}
function tick() {
    if (!state.playing) return;
    if (!step(true)) {
        stop();
        return;
    }
    const interval = Number(el("speed").value);
    document.documentElement.style.setProperty(
        "--reveal",
        Math.min(0.28, interval / 1000) + "s",
    );
    state.timer = setTimeout(tick, interval);
}

// ── labels & button states ──
function updateLabel() {
    const where = el("where");
    const count = el("count");
    const total = state.timeline.length;
    if (state.drawn === 0) {
        where.textContent =
            state.mode === "square"
                ? `Order ${state.order} square — ready.`
                : state.mode === "universe"
                  ? `Universe · radius 2^${state.order} — ready.`
                  : `${state.R}×${state.C} map — ready.`;
        count.innerHTML =
            "Press <strong>Step</strong> or <strong>Play</strong> to begin.";
        return;
    }
    count.innerHTML = `${state.drawn} / ${total} segments drawn`;
    const s = state.timeline[state.drawn - 1];
    const dir = s.half === "V" ? "vertical" : "horizontal";
    where.textContent =
        `Level ${s.level} · ${dir} pass ` +
        `${s.passIndex + 1}/${s.passCount} · ` +
        `segment ${s.segIndex + 1}/${s.segCount}`;
}
function updateButtons() {
    const done = state.drawn >= state.timeline.length;
    el("step").disabled = done;
    el("complete").disabled = done;
}

// ── orientation triplet (anchor + seniority), per descent / compound-glyphs ─
function quadrantLabel() {
    const ns = state.orient.curV === 1 ? "S" : "N";
    const ew = state.orient.curH === 1 ? "E" : "W";
    // letter order encodes seniority: V → NS-first, H → EW-first
    return state.orient.senH ? ew + ns : ns + ew;
}
function syncOrient() {
    el("longBtn").innerHTML =
        `<span class="osym">↔</span><span class="oval">${state.orient.curH}</span>`;
    el("latBtn").innerHTML =
        `<span class="osym">↕</span><span class="oval">${state.orient.curV}</span>`;
    el("senBtn").innerHTML =
        `<span class="osym">⤢</span><span class="oval">${state.orient.senH ? "H" : "V"}</span>`;
    el("orientLabel").textContent = quadrantLabel();
}

// ── mode toggle ──
function syncMode() {
    const sq = state.mode === "square";
    const uni = state.mode === "universe";
    el("modeSquare").classList.toggle("active", sq);
    el("modeUniverse").classList.toggle("active", uni);
    el("modeMap").classList.toggle("active", state.mode === "map");
    // Square and Universe both take Order n; only Map uses south/east extents.
    el("square-inputs").style.display = sq || uni ? "" : "none";
    el("map-inputs").style.display = state.mode === "map" ? "" : "none";
    el("order-hint").textContent = uni ? "radius = 2ⁿ" : "side = 2ⁿ";
}

// ── wiring ──
function wire() {
    el("step").onclick = () => {
        stop();
        step(true);
    };
    el("reset").onclick = reset;
    el("complete").onclick = complete;
    el("play").onclick = () => (state.playing ? stop() : play());

    el("modeSquare").onclick = () => {
        state.mode = "square";
        syncMode();
        rebuild();
    };
    el("modeUniverse").onclick = () => {
        state.mode = "universe";
        syncMode();
        rebuild();
    };
    el("modeMap").onclick = () => {
        state.mode = "map";
        syncMode();
        rebuild();
    };

    el("order").onchange = () => {
        state.order = clampInt(el("order").value, 0, 6);
        el("order").value = state.order;
        rebuild();
    };
    el("south").onchange = () => {
        state.southExtent = clampInt(el("south").value, 1, 64);
        el("south").value = state.southExtent;
        rebuild();
    };
    el("east").onchange = () => {
        state.eastExtent = clampInt(el("east").value, 1, 64);
        el("east").value = state.eastExtent;
        rebuild();
    };
    el("gran").onchange = () => (state.gran = el("gran").value);
    el("grid").onchange = drawGuides;
    el("bycolor").onchange = recolor;

    el("longBtn").onclick = () => {
        state.orient.curH ^= 1;
        syncOrient();
        rebuild();
    };
    el("latBtn").onclick = () => {
        state.orient.curV ^= 1;
        syncOrient();
        rebuild();
    };
    el("senBtn").onclick = () => {
        state.orient.senH = !state.orient.senH;
        syncOrient();
        rebuild();
    };
}
function recolor() {
    inkG()
        .querySelectorAll("line.seg")
        .forEach((l) => {
            const c = colorFor(state.timeline[Number(l.dataset.k)]);
            l.style.stroke = c || "";
        });
}
function clampInt(v, lo, hi) {
    v = Math.round(Number(v));
    if (!Number.isFinite(v)) v = lo;
    return Math.min(hi, Math.max(lo, v));
}

// keyboard niceties
window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.code === "Space") {
        e.preventDefault();
        state.playing ? stop() : play();
    } else if (e.key === "ArrowRight") {
        stop();
        step(true);
    } else if (e.key.toLowerCase() === "r") {
        reset();
    }
});

// ── theme ──
function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    el("theme-toggle").textContent = t === "light" ? "☀ Light" : "☾ Dark";
    localStorage.setItem("coylean-square-theme", t);
    if (el("bycolor").checked) recolor();
}
el("theme-toggle").onclick = () =>
    applyTheme(
        document.documentElement.dataset.theme === "light"
            ? "dark"
            : "light",
    );

// ── init ──
wire();
syncMode();
syncOrient();
applyTheme(localStorage.getItem("coylean-square-theme") || "dark");
rebuild();
