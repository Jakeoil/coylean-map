import { pri } from "../../coylean-core.js";
import { svgEl, diamondPts } from "./svg.js";
import { S, D, PAD, downPos, rightPos, cellPos } from "./diagram-coords.js";
import { downArrowPath, rightArrowPath, downLineSeg, rightLineSeg, presetForPri } from "./arrows.js";
import { renderEncroach } from "./encroach.js";

const LABEL_BG_DOWN  = "rgba(224, 168, 168, 0.85)";
const LABEL_BG_RIGHT = "rgba(188, 216, 232, 0.85)";
const LABEL_BG_WHITE = "rgba(255, 255, 255, 0.85)";

// Append a coord-label with a semi-opaque rectangular background.
// Font-size / family matches the .coord-label CSS (16px monospace).
function appendLabelWithBg(parent, cx, cy, text, bgFill) {
    const fontSize = 16;
    const charWidth = fontSize * 0.6;
    const padX = 3, padY = 2;
    const w = text.length * charWidth + 2 * padX;
    const h = fontSize + 2 * padY;
    parent.appendChild(svgEl("rect", {
        x: cx - w / 2, y: cy - h / 2,
        width: w, height: h,
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

// config: { numRows, numCols, hInitCol, vInitRow, seniority }  — propagation input
// result: { downMatrix, rightMatrix }                          — propagate() output
// flags:  { showLabels, arrowMode, showReactionLabels, priorityArrows, showMinimize, encroachMode, initEditable }
//         priorityArrows: when true, each arrow's thickness is keyed off its
//                         axis priority (pri(i + hInitCol) for down,
//                         pri(j + vInitRow) for right) via presetForPri.
//         arrowMode:    "off" | "full" | "line"
//         encroachMode: "off" | "full" | "half"
//         initEditable: when true, init cells get dark fills (red for down,
//                       blue for right) so the editable row/column stands out.
// hooks:  { onEnterDown(i, j, val), onEnterRight(i, j, val), onLeave(),
//           onClickDown?(i, j), onClickRight?(i, j) }
//         By default, click hooks are only attached to init cells (j === 0
//         for down, i === 0 for right). Set flags.allCellsClickable to
//         attach click handlers on every cell — handler then dispatches on
//         (i, j) to choose init-toggle vs. interior-perturbation behavior.
export function renderPropagation(svg, config, result, flags, hooks) {
    const { numRows: nR, numCols: nC, hInitCol, vInitRow, seniority } = config;
    const { downMatrix: dm, rightMatrix: rm } = result;
    const { showLabels, showReactionLabels, showMinimize, encroachMode = "off", arrowMode = "full", showBorders, showFill = true, initEditable = false, allCellsClickable = false, priorityArrows = false } = flags;
    const showEncroach = encroachMode !== "off";
    const showArrows = arrowMode !== "off";
    const { onEnterDown, onEnterRight, onLeave, onClickDown, onClickRight } = hooks;

    const w = 2 * PAD + nC * S;
    const h = 2 * PAD + nR * S;
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

    // Render into a stable viewport group so pan/zoom transforms persist across renders.
    let vp = svg.querySelector("g.viewport");
    if (!vp) {
        vp = svgEl("g", { class: "viewport" });
        svg.appendChild(vp);
    }
    vp.innerHTML = "";

    // Layered draw order: polygons (with borders) → arrows → encroach →
    // labels → priority. Keeps borders from overdrawing arrows of adjacent
    // diamonds, and keeps labels/priority on top of everything else.

    // ── Pass 1: down-diamond polygons ──
    for (let j = 0; j <= nR; j++) {
        for (let i = 0; i < nC; i++) {
            const [cx, cy] = downPos(i, j);
            const val = dm[j][i];
            const isInit = j === 0;
            const poly = svgEl("polygon", {
                points: diamondPts(cx, cy),
                class: isInit ? "diamond init-cell" : "diamond",
                fill: !showFill ? "none" : (!val && showMinimize ? "#fff" : "#e0a8a8"),
                stroke: showBorders ? "#9a4a4a" : "none",
                "stroke-width": showBorders ? 1.5 : 0,
            });
            poly.addEventListener("mouseenter", () => onEnterDown(i, j, val));
            poly.addEventListener("mouseleave", onLeave);
            if ((isInit || allCellsClickable) && onClickDown) {
                poly.addEventListener("click", () => onClickDown(i, j));
            }
            vp.appendChild(poly);
        }
    }

    // ── Pass 1: right-diamond polygons ──
    for (let i = 0; i <= nC; i++) {
        for (let j = 0; j < nR; j++) {
            const [cx, cy] = rightPos(i, j);
            const val = rm[i][j];
            const isInit = i === 0;
            const poly = svgEl("polygon", {
                points: diamondPts(cx, cy),
                class: isInit ? "diamond init-cell" : "diamond",
                fill: !showFill ? "none" : (!val && showMinimize ? "#fff" : "#bcd8e8"),
                stroke: showBorders ? "#5a8aaa" : "none",
                "stroke-width": showBorders ? 1.5 : 0,
            });
            poly.addEventListener("mouseenter", () => onEnterRight(i, j, val));
            poly.addEventListener("mouseleave", onLeave);
            if ((isInit || allCellsClickable) && onClickRight) {
                poly.addEventListener("click", () => onClickRight(i, j));
            }
            vp.appendChild(poly);
        }
    }

    // ── Pass 2: down arrows ──
    // Init-row arrows (j === 0) take pure red in Set mode to flag toggleability.
    if (showArrows) {
        for (let j = 0; j <= nR; j++) {
            for (let i = 0; i < nC; i++) {
                if (!dm[j][i]) continue;
                const [cx, cy] = downPos(i, j);
                const arrowColor = initEditable && j === 0 ? "#f00" : "#7a2d2d";
                const preset = priorityArrows ? presetForPri(pri(i + hInitCol)) : "current";
                if (arrowMode === "line") {
                    vp.appendChild(svgEl("line", {
                        ...downLineSeg(cx, cy, D, preset),
                        stroke: arrowColor,
                        class: "arrow-path",
                    }));
                } else {
                    vp.appendChild(svgEl("path", {
                        d: downArrowPath(cx, cy, j === 0, D, preset),
                        class: "arrow-path",
                        fill: arrowColor,
                    }));
                }
            }
        }
    }

    // ── Pass 2: right arrows ──
    // Init-column arrows (i === 0) take pure blue in Set mode to flag toggleability.
    if (showArrows) {
        for (let i = 0; i <= nC; i++) {
            for (let j = 0; j < nR; j++) {
                if (!rm[i][j]) continue;
                const [cx, cy] = rightPos(i, j);
                const arrowColor = initEditable && i === 0 ? "#00f" : "#3d6a8a";
                const preset = priorityArrows ? presetForPri(pri(j + vInitRow)) : "current";
                if (arrowMode === "line") {
                    vp.appendChild(svgEl("line", {
                        ...rightLineSeg(cx, cy, D, preset),
                        stroke: arrowColor,
                        class: "arrow-path",
                    }));
                } else {
                    vp.appendChild(svgEl("path", {
                        d: rightArrowPath(cx, cy, i === 0, D, preset),
                        class: "arrow-path",
                        fill: arrowColor,
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
        renderEncroach(vp, {
            dm, rm, nR, nC,
            downC: downPos, rightC: rightPos,
            wX: (cx) => cx - D, eX: (cx) => cx + D,
            nY: (cy) => cy - D, sY: (cy) => cy + D,
            showFill,
        });
    }

    // ── Pass 4: labels (drawn after arrows and encroach so they sit on top) ──
    if (showLabels) {
        for (let j = 0; j <= nR; j++) {
            for (let i = 0; i < nC; i++) {
                const [cx, cy] = downPos(i, j);
                const val = dm[j][i];
                const bg = (!showFill || (!val && showMinimize)) ? LABEL_BG_WHITE : LABEL_BG_DOWN;
                appendLabelWithBg(vp, cx, cy, `r${j}c${i}`, bg);
            }
        }
        for (let i = 0; i <= nC; i++) {
            for (let j = 0; j < nR; j++) {
                const [cx, cy] = rightPos(i, j);
                const val = rm[i][j];
                const bg = (!showFill || (!val && showMinimize)) ? LABEL_BG_WHITE : LABEL_BG_RIGHT;
                appendLabelWithBg(vp, cx, cy, `c${i}r${j}`, bg);
            }
        }
    }

    // ── Pass 5: reaction-labels overlay (cell-center text) ──
    for (let j = 0; j < nR; j++) {
        for (let i = 0; i < nC; i++) {
            const [cx, cy] = cellPos(i, j);

            if (showReactionLabels) {
                const pI = pri(i + hInitCol);
                const pJ = pri(j + vInitRow);
                const dw = seniority.isVertical
                    ? pI >= pJ
                    : pI > pJ;
                const cmp = seniority.isVertical ? "≥" : ">";
                vp.appendChild(
                    Object.assign(
                        svgEl("text", {
                            x: cx,
                            y: cy - 6,
                            class: "coord-label",
                            fill: "#bc8cff",
                            "font-size": "14px",
                        }),
                        { textContent: `${pI}${cmp}${pJ}?` },
                    ),
                );
                vp.appendChild(
                    Object.assign(
                        svgEl("text", {
                            x: cx,
                            y: cy + 16,
                            class: "coord-label",
                            fill: dw ? "#9a4a4a" : "#5a8aaa",
                            "font-size": "16px",
                            "font-weight": "bold",
                        }),
                        { textContent: dw ? "↓" : "→" },
                    ),
                );
            }
        }
    }
}
