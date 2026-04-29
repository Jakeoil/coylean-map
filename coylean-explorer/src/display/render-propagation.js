import { pri } from "../../coylean-core.js";
import { svgEl, diamondPts } from "./svg.js";
import { S, D, PAD, downPos, rightPos, cellPos } from "./diagram-coords.js";
import { downArrowPath, rightArrowPath } from "./arrows.js";

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
// flags:  { showLabels, showFlow, showPri, showMinimize, showEncroach }
// hooks:  { onEnterDown(i, j, val), onEnterRight(i, j, val), onLeave() }
export function renderPropagation(svg, config, result, flags, hooks) {
    const { numRows: nR, numCols: nC, hInitCol, vInitRow, seniority } = config;
    const { downMatrix: dm, rightMatrix: rm } = result;
    const { showLabels, showFlow, showPri, showMinimize, showEncroach, showBorders, showArrows = true, showFill = true } = flags;
    const { onEnterDown, onEnterRight, onLeave } = hooks;

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

    // ── Flow lines (subtle connections) ──
    if (showFlow) {
        const g = svgEl("g", {});
        for (let j = 0; j < nR; j++) {
            for (let i = 0; i < nC; i++) {
                const [cx, cy] = cellPos(i, j);
                // down in
                const [dx0, dy0] = downPos(i, j);
                g.appendChild(
                    svgEl("line", {
                        x1: dx0,
                        y1: dy0,
                        x2: cx,
                        y2: cy,
                        class: "flow-line",
                    }),
                );
                // down out
                const [dx1, dy1] = downPos(i, j + 1);
                g.appendChild(
                    svgEl("line", {
                        x1: cx,
                        y1: cy,
                        x2: dx1,
                        y2: dy1,
                        class: "flow-line",
                    }),
                );
                // right in
                const [rx0, ry0] = rightPos(i, j);
                g.appendChild(
                    svgEl("line", {
                        x1: rx0,
                        y1: ry0,
                        x2: cx,
                        y2: cy,
                        class: "flow-line",
                    }),
                );
                // right out
                const [rx1, ry1] = rightPos(i + 1, j);
                g.appendChild(
                    svgEl("line", {
                        x1: cx,
                        y1: cy,
                        x2: rx1,
                        y2: ry1,
                        class: "flow-line",
                    }),
                );
            }
        }
        vp.appendChild(g);
    }

    // ── Down diamonds ──
    for (let j = 0; j <= nR; j++) {
        for (let i = 0; i < nC; i++) {
            const [cx, cy] = downPos(i, j);
            const val = dm[j][i];

            const showStroke = showBorders || !showFill;
            const poly = svgEl("polygon", {
                points: diamondPts(cx, cy),
                class: "diamond",
                fill: !showFill ? "none" : (!val && showMinimize ? "#fff" : "#e0a8a8"),
                stroke: showStroke ? "#9a4a4a" : "none",
                "stroke-width": showStroke ? 1.5 : 0,
            });
            poly.addEventListener("mouseenter", () =>
                onEnterDown(i, j, val),
            );
            poly.addEventListener("mouseleave", onLeave);
            vp.appendChild(poly);

            if (val && showArrows) {
                vp.appendChild(
                    svgEl("path", {
                        d: downArrowPath(cx, cy, j === 0),
                        class: "arrow-path",
                        fill: "#7a2d2d",
                    }),
                );
            }

            if (showLabels) {
                const bg = (!val && showMinimize) ? LABEL_BG_WHITE : LABEL_BG_DOWN;
                appendLabelWithBg(vp, cx, cy, `r${j}c${i}`, bg);
            }
        }
    }

    // ── Right diamonds ──
    for (let i = 0; i <= nC; i++) {
        for (let j = 0; j < nR; j++) {
            const [cx, cy] = rightPos(i, j);
            const val = rm[i][j];

            const showStroke = showBorders || !showFill;
            const poly = svgEl("polygon", {
                points: diamondPts(cx, cy),
                class: "diamond",
                fill: !showFill ? "none" : (!val && showMinimize ? "#fff" : "#bcd8e8"),
                stroke: showStroke ? "#5a8aaa" : "none",
                "stroke-width": showStroke ? 1.5 : 0,
            });
            poly.addEventListener("mouseenter", () =>
                onEnterRight(i, j, val),
            );
            poly.addEventListener("mouseleave", onLeave);
            vp.appendChild(poly);

            if (val && showArrows) {
                vp.appendChild(
                    svgEl("path", {
                        d: rightArrowPath(cx, cy, i === 0),
                        class: "arrow-path",
                        fill: "#3d6a8a",
                    }),
                );
            }

            if (showLabels) {
                const bg = (!val && showMinimize) ? LABEL_BG_WHITE : LABEL_BG_RIGHT;
                appendLabelWithBg(vp, cx, cy, `c${i}r${j}`, bg);
            }
        }
    }

    // ── Encroachment overlays ──
    if (showEncroach) {
        // False blue (right) diamonds: check red (down) neighbors
        for (let i = 0; i <= nC; i++) {
            for (let j = 0; j < nR; j++) {
                if (rm[i][j]) continue;
                const [cx, cy] = rightPos(i, j);
                const nw = (i >= 1)              ? dm[j][i-1]   : false;
                const ne = (i < nC)              ? dm[j][i]     : false;
                const sw = (i >= 1 && j+1 <= nR) ? dm[j+1][i-1] : false;
                const se = (i < nC && j+1 <= nR) ? dm[j+1][i]   : false;
                const leftFill = nw && sw;
                const rightFill = ne && se;
                if (leftFill) {
                    vp.appendChild(svgEl("polygon", {
                        points: `${cx},${cy-D} ${cx},${cy+D} ${cx-D},${cy}`,
                        fill: "#e0a8a8", stroke: "none",
                    }));
                }
                if (rightFill) {
                    vp.appendChild(svgEl("polygon", {
                        points: `${cx},${cy-D} ${cx+D},${cy} ${cx},${cy+D}`,
                        fill: "#e0a8a8", stroke: "none",
                    }));
                }
                if (leftFill || rightFill) {
                    vp.appendChild(svgEl("line", {
                        x1: cx, y1: cy-D, x2: cx, y2: cy+D,
                        stroke: "#7a2d2d", "stroke-width": "1.5",
                    }));
                }
            }
        }
        // False red (down) diamonds: check blue (right) neighbors
        for (let j = 0; j <= nR; j++) {
            for (let i = 0; i < nC; i++) {
                if (dm[j][i]) continue;
                const [cx, cy] = downPos(i, j);
                const nw = (j >= 1)              ? rm[i][j-1]   : false;
                const ne = (j >= 1 && i+1 <= nC) ? rm[i+1][j-1] : false;
                const sw = (j < nR)              ? rm[i][j]     : false;
                const se = (j < nR && i+1 <= nC) ? rm[i+1][j]   : false;
                const topFill = nw && ne;
                const bottomFill = sw && se;
                if (topFill) {
                    vp.appendChild(svgEl("polygon", {
                        points: `${cx},${cy-D} ${cx+D},${cy} ${cx-D},${cy}`,
                        fill: "#bcd8e8", stroke: "none",
                    }));
                }
                if (bottomFill) {
                    vp.appendChild(svgEl("polygon", {
                        points: `${cx-D},${cy} ${cx+D},${cy} ${cx},${cy+D}`,
                        fill: "#bcd8e8", stroke: "none",
                    }));
                }
                if (topFill || bottomFill) {
                    vp.appendChild(svgEl("line", {
                        x1: cx-D, y1: cy, x2: cx+D, y2: cy,
                        stroke: "#3d6a8a", "stroke-width": "1.5",
                    }));
                }
            }
        }
        // Incursions: true blue diamonds get dark-red edges facing true red neighbors
        for (let i = 0; i <= nC; i++) {
            for (let j = 0; j < nR; j++) {
                if (!rm[i][j]) continue;
                const [cx, cy] = rightPos(i, j);
                const nw = (i >= 1)              ? dm[j][i-1]   : false;
                const ne = (i < nC)              ? dm[j][i]     : false;
                const sw = (i >= 1 && j+1 <= nR) ? dm[j+1][i-1] : false;
                const se = (i < nC && j+1 <= nR) ? dm[j+1][i]   : false;
                const edge = (x1, y1, x2, y2) => vp.appendChild(svgEl("line", {
                    x1, y1, x2, y2,
                    stroke: "#7a2d2d", "stroke-width": "2.5",
                }));
                if (nw) edge(cx, cy-D, cx-D, cy);
                if (ne) edge(cx, cy-D, cx+D, cy);
                if (sw) edge(cx, cy+D, cx-D, cy);
                if (se) edge(cx, cy+D, cx+D, cy);
            }
        }
        // Incursions: true red diamonds get dark-blue edges facing true blue neighbors
        for (let j = 0; j <= nR; j++) {
            for (let i = 0; i < nC; i++) {
                if (!dm[j][i]) continue;
                const [cx, cy] = downPos(i, j);
                const nw = (j >= 1)              ? rm[i][j-1]   : false;
                const ne = (j >= 1 && i+1 <= nC) ? rm[i+1][j-1] : false;
                const sw = (j < nR)              ? rm[i][j]     : false;
                const se = (j < nR && i+1 <= nC) ? rm[i+1][j]   : false;
                const edge = (x1, y1, x2, y2) => vp.appendChild(svgEl("line", {
                    x1, y1, x2, y2,
                    stroke: "#3d6a8a", "stroke-width": "2.5",
                }));
                if (nw) edge(cx, cy-D, cx-D, cy);
                if (ne) edge(cx, cy-D, cx+D, cy);
                if (sw) edge(cx, cy+D, cx-D, cy);
                if (se) edge(cx, cy+D, cx+D, cy);
            }
        }
    }

    // ── Cell center hover zones (small invisible) for reaction info ──
    for (let j = 0; j < nR; j++) {
        for (let i = 0; i < nC; i++) {
            const [cx, cy] = cellPos(i, j);

            if (showPri) {
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
