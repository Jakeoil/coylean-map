import { pri } from "../../coylean-core.js";
import { svgEl, diamondPts } from "./svg.js";
import { downArrowPath, rightArrowPath, downLineSeg, rightLineSeg, presetForPri } from "./arrows.js";
import { renderEncroach } from "./encroach.js";
import { renderPipes, renderOrphanPipes } from "./render-pipes.js";

// Layout constants for the 2x2 quadrant mosaic.
const S = 96;          // cell size (basic-propagation scale)
const D = S / 2;       // diamond half-diagonal
const PAD = 64;        // interior padding — must be >= D so edge diamonds stay inside the quad rect
const GAP = 48;        // gap between adjacent panels
const LABEL_H = 44;    // vertical space reserved for the panel label

// Diamond-style colours match basic-propagation: stroke-less tiles, true vs
// false distinguished only by arrow presence.
const FILL_DOWN = "#e0a8a8";
const FILL_RIGHT = "#bcd8e8";
const ARROW_DOWN = "#7a2d2d";
const ARROW_RIGHT = "#3d6a8a";
const STROKE_DOWN = "#9a4a4a";
const STROKE_RIGHT = "#5a8aaa";

// Radial label-bg gradients: base color at the center fading to fully
// transparent at the rect's edges, so the rect has no visible boundary —
// the text floats over a soft halo blending into the diamonds below.
// Installed as <radialGradient>s in <defs> per render and referenced via
// url(#…) below.
const LABEL_BG_COLORS = {
    down:  "rgb(224, 168, 168)",
    right: "rgb(188, 216, 232)",
    white: "rgb(255, 255, 255)",
};
const LABEL_BG_CENTER_OPACITY = 0.85;

let labelGradSeq = 0;

function installLabelBgGradients(viewport) {
    const seq = labelGradSeq++;
    const defs = svgEl("defs", {});
    viewport.appendChild(defs);
    const out = {};
    for (const [kind, color] of Object.entries(LABEL_BG_COLORS)) {
        const id = `mosaic-lbl-${kind}-${seq}`;
        const grad = svgEl("radialGradient", { id, cx: 0.5, cy: 0.5, r: 0.5 });
        grad.appendChild(svgEl("stop", {
            offset: "0%",
            "stop-color": color,
            "stop-opacity": LABEL_BG_CENTER_OPACITY,
        }));
        grad.appendChild(svgEl("stop", {
            offset: "100%",
            "stop-color": color,
            "stop-opacity": 0,
        }));
        defs.appendChild(grad);
        out[kind] = `url(#${id})`;
    }
    return out;
}

// Append a coord-label with a semi-opaque rectangular background.
// Font-size / family matches the .coord-label CSS (16px monospace).
function appendLabelWithBg(parent, cx, cy, text, bgFill) {
    const fontSize = 16;
    const charWidth = fontSize * 0.6;       // monospace estimate
    const padX = 3, padY = 2;
    const w = text.length * charWidth + 2 * padX;
    const h = fontSize + 2 * padY;
    parent.appendChild(svgEl("rect", {
        x: cx - w / 2, y: cy - h / 2,
        width: w, height: h,
        rx: 6, ry: 6,
        fill: bgFill,
        "pointer-events": "none",
    }));
    parent.appendChild(Object.assign(
        svgEl("text", {
            x: cx, y: cy + 5,
            class: "coord-label",
            fill: "#000",
        }),
        { textContent: text },
    ));
}

// Render a 2x2 mosaic of four propagation panels.
//   svg:    the <svg> element to render into
//   quads:  array of { p, name, flipJ, flipI } where name is "nw"|"ne"|"sw"|"se"
//   flags:  { showLabels, arrowMode, showReactionLabels, priorityArrows, showMinimize, encroachMode } — display toggles
//          priorityArrows: when true, each arrow's thickness is keyed off its
//                          axis priority (pri(i + p.hInitCol) for down,
//                          pri(j + p.vInitRow) for right) via presetForPri.
//          arrowMode:    "off" | "full" | "line"
//          encroachMode: "off" | "full" | "half"
//   hooks:  { onEnterDown(name,i,j,val), onEnterRight(name,i,j,val), onLeave(),
//            onClickDown?(name,i,j), onClickRight?(name,i,j) }
//          Click hooks fire only on init cells (j === 0 for down, i === 0
//          for right). Init cells also pick up the "init-cell" class.
//
// Each panel is sized from its own p.numRows / p.numColumns.
//
// flipJ / flipI orient each panel so its local (0,0) — the axis-adjacent
// corner of its propagation — points toward the centre of the mosaic.
// Arrows are reversed on flipped axes so they always read in the actual
// direction of propagation in the assembled universe. Encroach overlays and
// the resolved-priority arrow glyph follow the same convention.
export function renderMosaic(svg, quads, flags = {}, hooks = {}) {
    const byName = Object.fromEntries(quads.map((q) => [q.name, q]));
    const nw = byName.nw, ne = byName.ne, sw = byName.sw, se = byName.se;

    // West/east columns and north/south rows each take their dimension
    // from whichever quadrant is present on that side. Missing sides
    // collapse to width/height 0 (and their gap drops out).
    const panelW = (q) => q ? 2 * PAD + q.p.numColumns * S : 0;
    const panelH = (q) => q ? 2 * PAD + q.p.numRows * S : 0;
    const wW = Math.max(panelW(nw), panelW(sw));
    const eW = Math.max(panelW(ne), panelW(se));
    const nH = Math.max(panelH(nw), panelH(ne));
    const sH = Math.max(panelH(sw), panelH(se));

    const colGap = (wW && eW) ? GAP : 0;
    const rowGap = (nH && sH) ? GAP : 0;
    const nLabelH = (nH ? LABEL_H : 0);
    const sLabelH = (sH ? LABEL_H : 0);
    const totalW = wW + colGap + eW;
    const totalH = nLabelH + nH + rowGap + sLabelH + sH;

    svg.setAttribute("viewBox", `0 0 ${totalW} ${totalH}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    let viewport = svg.querySelector("g.viewport");
    if (!viewport) {
        viewport = svgEl("g", { class: "viewport" });
        svg.appendChild(viewport);
    }
    viewport.innerHTML = "";
    const labelBg = installLabelBgGradients(viewport);

    const sRowY = nLabelH + nH + rowGap + sLabelH;
    // prettier-ignore
    const positions = {
        nw: { x: 0,             y: nLabelH, w: wW, h: nH },
        ne: { x: wW + colGap,   y: nLabelH, w: eW, h: nH },
        sw: { x: 0,             y: sRowY,   w: wW, h: sH },
        se: { x: wW + colGap,   y: sRowY,   w: eW, h: sH },
    };

    for (const quad of quads) {
        const pos = positions[quad.name];
        renderQuadrant(viewport, quad, pos.x, pos.y, pos.w, pos.h, flags, hooks, labelBg);
    }
}

// Render a single boundary-extracted propagation in the same viewport
// dimensions as renderMosaic, positioned so its far-SE cell coincides with
// the SE quadrant's far-SE cell — the panel "clicks into" the SE corner of
// the mosaic layout while extending up-and-left to span the full universe.
//
// quads:      the four-quadrant reference bundle (used to size the viewport
//             so toggling between mosaic and integrated keeps the SE corner
//             pinned in place).
// integrated: { p, name, flipJ, flipI } for the boundary propagation —
//             typically { p, name: "integrated", flipJ: false, flipI: false }.
export function renderIntegrated(svg, quads, integrated, flags = {}, hooks = {}) {
    const byName = Object.fromEntries(quads.map((q) => [q.name, q]));
    const nw = byName.nw, ne = byName.ne, sw = byName.sw, se = byName.se;

    // Mirror renderMosaic's sparse layout so the SE corner stays pinned
    // when the user toggles between mosaic and integrated.
    const panelW = (q) => q ? 2 * PAD + q.p.numColumns * S : 0;
    const panelH = (q) => q ? 2 * PAD + q.p.numRows * S : 0;
    const wW = Math.max(panelW(nw), panelW(sw));
    const eW = Math.max(panelW(ne), panelW(se));
    const nH = Math.max(panelH(nw), panelH(ne));
    const sH = Math.max(panelH(sw), panelH(se));
    const colGap = (wW && eW) ? GAP : 0;
    const rowGap = (nH && sH) ? GAP : 0;
    const nLabelH = nH ? LABEL_H : 0;
    const sLabelH = sH ? LABEL_H : 0;
    const totalW = wW + colGap + eW;
    const totalH = nLabelH + nH + rowGap + sLabelH + sH;

    svg.setAttribute("viewBox", `0 0 ${totalW} ${totalH}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    let viewport = svg.querySelector("g.viewport");
    if (!viewport) {
        viewport = svgEl("g", { class: "viewport" });
        svg.appendChild(viewport);
    }
    viewport.innerHTML = "";
    const labelBg = installLabelBgGradients(viewport);

    const intP = integrated.p;
    const intW = 2 * PAD + intP.numColumns * S;
    const intH = 2 * PAD + intP.numRows * S;
    const x = totalW - intW;
    const y = totalH - intH;

    renderQuadrant(viewport, integrated, x, y, intW, intH, flags, hooks, labelBg);
}

function renderQuadrant(parent, quad, x, y, w, h, flags, hooks, labelBg) {
    const { p, name, flipJ, flipI } = quad;
    const numRows = p.numRows;
    const numCols = p.numColumns;
    const { showLabels, showReactionLabels, showMinimize, encroachMode = "off", arrowMode = "full", showBorders, showFill = true, initEditable = false, priorityArrows = false } = flags;
    const showEncroach = encroachMode !== "off";
    const showArrows = arrowMode !== "off";
    const { onEnterDown, onEnterRight, onLeave, onClickDown, onClickRight } = hooks;

    const group = svgEl("g", {});
    parent.appendChild(group);

    group.appendChild(svgEl("rect", {
        x, y: y - LABEL_H, width: w, height: h + LABEL_H,
        class: "quadrant-bg",
    }));
    const label = svgEl("text", {
        x: x + 12, y: y - 10, class: "quadrant-label",
    });
    label.textContent = `${name.toUpperCase()}  ${numRows}×${numCols}`;
    group.appendChild(label);

    // Visual offsets — used by encroach and priority glyphs to flip with the panel.
    const wX = (cx) => flipI ? cx + D : cx - D;
    const eX = (cx) => flipI ? cx - D : cx + D;
    const nY = (cy) => flipJ ? cy + D : cy - D;
    const sY = (cy) => flipJ ? cy - D : cy + D;

    // Down diamond center for panel-local (i, j) — accounts for flips.
    const downC = (i, j) => {
        const pj = flipJ ? (numRows - j) : j;
        const pi = flipI ? (numCols - 1 - i) : i;
        return [x + PAD + (pi + 0.5) * S, y + PAD + pj * S];
    };
    // Right diamond center for panel-local (i, j) — accounts for flips.
    const rightC = (i, j) => {
        const pj = flipJ ? (numRows - 1 - j) : j;
        const pi = flipI ? (numCols - i) : i;
        return [x + PAD + pi * S, y + PAD + (pj + 0.5) * S];
    };
    // Cell center for panel-local (i, j) — accounts for flips.
    const cellC = (i, j) => {
        const pj = flipJ ? (numRows - 1 - j) : j;
        const pi = flipI ? (numCols - 1 - i) : i;
        return [x + PAD + (pi + 0.5) * S, y + PAD + (pj + 0.5) * S];
    };

    // Layered draw order: polygon fills → pipes → polygon borders → arrows →
    // encroach → labels → priority. Splitting fills from borders lets the
    // pipes overlay sit beneath arrows/labels/borders while still allowing
    // hover hit-testing on the underlying diamond fills.

    // ── Pass 1: down-diamond fills (with hover/click hooks) ──
    for (let j = 0; j <= numRows; j++) {
        for (let i = 0; i < numCols; i++) {
            const [cx, cy] = downC(i, j);
            const val = p.downMatrix[j][i];
            const isInit = j === 0;
            const poly = svgEl("polygon", {
                points: diamondPts(cx, cy, D),
                class: isInit ? "diamond init-cell" : "diamond",
                fill: !showFill ? "none" : (!val && showMinimize ? "#fff" : FILL_DOWN),
                stroke: "none",
                "stroke-width": 0,
                "data-quad": name,
                "data-source": "down",
                "data-i": i,
                "data-j": j,
            });
            if (onEnterDown) {
                poly.addEventListener("mouseenter", () => onEnterDown(name, i, j, val));
                if (onLeave) poly.addEventListener("mouseleave", onLeave);
            }
            if (isInit && onClickDown) {
                poly.addEventListener("click", () => onClickDown(name, i, j));
            }
            group.appendChild(poly);
        }
    }

    // ── Pass 1: right-diamond fills (with hover/click hooks) ──
    for (let i = 0; i <= numCols; i++) {
        for (let j = 0; j < numRows; j++) {
            const [cx, cy] = rightC(i, j);
            const val = p.rightMatrix[i][j];
            const isInit = i === 0;
            const poly = svgEl("polygon", {
                points: diamondPts(cx, cy, D),
                class: isInit ? "diamond init-cell" : "diamond",
                fill: !showFill ? "none" : (!val && showMinimize ? "#fff" : FILL_RIGHT),
                stroke: "none",
                "stroke-width": 0,
                "data-quad": name,
                "data-source": "right",
                "data-i": i,
                "data-j": j,
            });
            if (onEnterRight) {
                poly.addEventListener("mouseenter", () => onEnterRight(name, i, j, val));
                if (onLeave) poly.addEventListener("mouseleave", onLeave);
            }
            if (isInit && onClickRight) {
                poly.addEventListener("click", () => onClickRight(name, i, j));
            }
            group.appendChild(poly);
        }
    }

    // ── Pipes overlay (under arrows/borders/labels) ──
    const pipePanel = {
        numRows, numCols,
        hInitCol: p.hInitCol, vInitRow: p.vInitRow,
        maxPri: p.maxPri,
        downMatrix: p.downMatrix, rightMatrix: p.rightMatrix,
        x, y,
        flipJ, flipI,
    };
    renderPipes(group, pipePanel, flags);
    renderOrphanPipes(group, pipePanel, flags);

    // ── Pass 1b: diamond borders, drawn on top of pipes ──
    if (showBorders) {
        for (let j = 0; j <= numRows; j++) {
            for (let i = 0; i < numCols; i++) {
                const [cx, cy] = downC(i, j);
                group.appendChild(svgEl("polygon", {
                    points: diamondPts(cx, cy, D),
                    class: "diamond-border",
                    fill: "none",
                    stroke: STROKE_DOWN,
                    "stroke-width": 1.5,
                    "pointer-events": "none",
                }));
            }
        }
        for (let i = 0; i <= numCols; i++) {
            for (let j = 0; j < numRows; j++) {
                const [cx, cy] = rightC(i, j);
                group.appendChild(svgEl("polygon", {
                    points: diamondPts(cx, cy, D),
                    class: "diamond-border",
                    fill: "none",
                    stroke: STROKE_RIGHT,
                    "stroke-width": 1.5,
                    "pointer-events": "none",
                }));
            }
        }
    }

    // ── Pass 2: down arrows ──
    // Init-row arrows (j === 0) take pure red in Set mode to flag toggleability.
    if (showArrows) {
        for (let j = 0; j <= numRows; j++) {
            for (let i = 0; i < numCols; i++) {
                if (!p.downMatrix[j][i]) continue;
                const [cx, cy] = downC(i, j);
                const arrowColor = initEditable && j === 0 ? "#f00" : ARROW_DOWN;
                const preset = priorityArrows ? presetForPri(pri(i + p.hInitCol, p.maxPri)) : "current";
                if (arrowMode === "line") {
                    group.appendChild(svgEl("line", {
                        ...downLineSeg(cx, cy, D, preset),
                        stroke: arrowColor,
                        "pointer-events": "none",
                    }));
                } else {
                    group.appendChild(svgEl("path", {
                        d: downArrowPath(cx, cy, j === 0, D, preset),
                        fill: arrowColor,
                        "pointer-events": "none",
                        transform: flipJ ? `rotate(180 ${cx} ${cy})` : null,
                    }));
                }
            }
        }
    }

    // ── Pass 2: right arrows ──
    // Init-column arrows (i === 0) take pure blue in Set mode to flag toggleability.
    if (showArrows) {
        for (let i = 0; i <= numCols; i++) {
            for (let j = 0; j < numRows; j++) {
                if (!p.rightMatrix[i][j]) continue;
                const [cx, cy] = rightC(i, j);
                const arrowColor = initEditable && i === 0 ? "#00f" : ARROW_RIGHT;
                const preset = priorityArrows ? presetForPri(pri(j + p.vInitRow, p.maxPri)) : "current";
                if (arrowMode === "line") {
                    group.appendChild(svgEl("line", {
                        ...rightLineSeg(cx, cy, D, preset),
                        stroke: arrowColor,
                        "pointer-events": "none",
                    }));
                } else {
                    group.appendChild(svgEl("path", {
                        d: rightArrowPath(cx, cy, i === 0, D, preset),
                        fill: arrowColor,
                        "pointer-events": "none",
                        transform: flipI ? `rotate(180 ${cx} ${cy})` : null,
                    }));
                }
            }
        }
    }

    // ── Encroachment overlays ──
    // Encroach bisecting lines and incursion edges are intentionally
    // independent of the Border toggle: they are structural cues for the
    // overlay, not part of the diamond outline.
    if (showEncroach) {
        renderEncroach(group, {
            dm: p.downMatrix, rm: p.rightMatrix,
            nR: numRows, nC: numCols,
            downC, rightC,
            wX, eX, nY, sY,
            showFill,
        });
    }

    // ── Pass 4: labels (drawn after arrows and encroach so they sit on top) ──
    if (showLabels) {
        for (let j = 0; j <= numRows; j++) {
            for (let i = 0; i < numCols; i++) {
                const [cx, cy] = downC(i, j);
                const val = p.downMatrix[j][i];
                const bg = (!showFill || (!val && showMinimize)) ? labelBg.white : labelBg.down;
                appendLabelWithBg(group, cx, cy, `r${j}c${i}`, bg);
            }
        }
        for (let i = 0; i <= numCols; i++) {
            for (let j = 0; j < numRows; j++) {
                const [cx, cy] = rightC(i, j);
                const val = p.rightMatrix[i][j];
                const bg = (!showFill || (!val && showMinimize)) ? labelBg.white : labelBg.right;
                appendLabelWithBg(group, cx, cy, `c${i}r${j}`, bg);
            }
        }
    }

    // ── Reaction-labels overlay ──
    if (showReactionLabels) {
        const isVert = p.seniority?.isVertical ?? true;
        const cmp = isVert ? "≥" : ">";
        const downGlyph = flipJ ? "↑" : "↓";
        const rightGlyph = flipI ? "←" : "→";

        for (let j = 0; j < numRows; j++) {
            for (let i = 0; i < numCols; i++) {
                const [cx, cy] = cellC(i, j);
                const pI = pri(i + p.hInitCol, p.maxPri);
                const pJ = pri(j + p.vInitRow, p.maxPri);
                const dw = isVert ? pI >= pJ : pI > pJ;

                group.appendChild(Object.assign(
                    svgEl("text", {
                        x: cx, y: cy - 6,
                        class: "coord-label",
                        fill: "#bc8cff",
                        "font-size": "14px",
                    }),
                    { textContent: `${pI}${cmp}${pJ}?` },
                ));
                group.appendChild(Object.assign(
                    svgEl("text", {
                        x: cx, y: cy + 16,
                        class: "coord-label",
                        fill: dw ? "#9a4a4a" : "#5a8aaa",
                        "font-size": "16px",
                        "font-weight": "bold",
                    }),
                    { textContent: dw ? downGlyph : rightGlyph },
                ));
            }
        }
    }
}
