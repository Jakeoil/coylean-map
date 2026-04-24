import { pri } from "../../coylean-core.js";
import { svgEl, diamondPts } from "./svg.js";
import { downArrowPath, rightArrowPath } from "./arrows.js";

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

// Semi-opaque label backgrounds matching the three diamond families.
const LABEL_BG_DOWN  = "rgba(224, 168, 168, 0.85)";
const LABEL_BG_RIGHT = "rgba(188, 216, 232, 0.85)";
const LABEL_BG_WHITE = "rgba(255, 255, 255, 0.85)";

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
//   flags:  { showLabels, showArrows, showPri, showMinimize, showEncroach } — display toggles
//   hooks:  { onEnterDown(name,i,j,val), onEnterRight(name,i,j,val), onLeave() }
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

    // West column shares nw/sw width; east shares ne/se width.
    // North row shares nw/ne height; south shares sw/se height.
    const wW = 2 * PAD + nw.p.numColumns * S;
    const eW = 2 * PAD + ne.p.numColumns * S;
    const nH = 2 * PAD + nw.p.numRows * S;
    const sH = 2 * PAD + sw.p.numRows * S;

    const totalW = wW + GAP + eW;
    const totalH = LABEL_H + nH + GAP + LABEL_H + sH;

    svg.setAttribute("viewBox", `0 0 ${totalW} ${totalH}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    let viewport = svg.querySelector("g.viewport");
    if (!viewport) {
        viewport = svgEl("g", { class: "viewport" });
        svg.appendChild(viewport);
    }
    viewport.innerHTML = "";

    const sRowY = LABEL_H + nH + GAP + LABEL_H;
    const positions = {
        nw: { x: 0,        y: LABEL_H, w: wW, h: nH },
        ne: { x: wW + GAP, y: LABEL_H, w: eW, h: nH },
        sw: { x: 0,        y: sRowY,   w: wW, h: sH },
        se: { x: wW + GAP, y: sRowY,   w: eW, h: sH },
    };

    for (const quad of [nw, ne, sw, se]) {
        const pos = positions[quad.name];
        renderQuadrant(viewport, quad, pos.x, pos.y, pos.w, pos.h, flags, hooks);
    }
}

function renderQuadrant(parent, quad, x, y, w, h, flags, hooks) {
    const { p, name, flipJ, flipI } = quad;
    const numRows = p.numRows;
    const numCols = p.numColumns;
    const { showLabels, showPri, showMinimize, showEncroach, showArrows = true } = flags;
    const { onEnterDown, onEnterRight, onLeave } = hooks;

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

    // ── Down diamonds ──
    for (let j = 0; j <= numRows; j++) {
        for (let i = 0; i < numCols; i++) {
            const [cx, cy] = downC(i, j);
            const val = p.downMatrix[j][i];

            const poly = svgEl("polygon", {
                points: diamondPts(cx, cy, D),
                class: "diamond",
                fill: !val && showMinimize ? "#fff" : FILL_DOWN,
                stroke: "none",
                "data-quad": name,
                "data-source": "down",
                "data-i": i,
                "data-j": j,
            });
            if (onEnterDown) {
                poly.addEventListener("mouseenter", () => onEnterDown(name, i, j, val));
                if (onLeave) poly.addEventListener("mouseleave", onLeave);
            }
            group.appendChild(poly);

            if (val && showArrows) {
                group.appendChild(svgEl("path", {
                    d: downArrowPath(cx, cy, j === 0, D),
                    fill: ARROW_DOWN,
                    "pointer-events": "none",
                    transform: flipJ ? `rotate(180 ${cx} ${cy})` : null,
                }));
            }

            if (showLabels) {
                const bg = (!val && showMinimize) ? LABEL_BG_WHITE : LABEL_BG_DOWN;
                appendLabelWithBg(group, cx, cy, `r${j}c${i}`, bg);
            }
        }
    }

    // ── Right diamonds ──
    for (let i = 0; i <= numCols; i++) {
        for (let j = 0; j < numRows; j++) {
            const [cx, cy] = rightC(i, j);
            const val = p.rightMatrix[i][j];

            const poly = svgEl("polygon", {
                points: diamondPts(cx, cy, D),
                class: "diamond",
                fill: !val && showMinimize ? "#fff" : FILL_RIGHT,
                stroke: "none",
                "data-quad": name,
                "data-source": "right",
                "data-i": i,
                "data-j": j,
            });
            if (onEnterRight) {
                poly.addEventListener("mouseenter", () => onEnterRight(name, i, j, val));
                if (onLeave) poly.addEventListener("mouseleave", onLeave);
            }
            group.appendChild(poly);

            if (val && showArrows) {
                group.appendChild(svgEl("path", {
                    d: rightArrowPath(cx, cy, i === 0, D),
                    fill: ARROW_RIGHT,
                    "pointer-events": "none",
                    transform: flipI ? `rotate(180 ${cx} ${cy})` : null,
                }));
            }

            if (showLabels) {
                const bg = (!val && showMinimize) ? LABEL_BG_WHITE : LABEL_BG_RIGHT;
                appendLabelWithBg(group, cx, cy, `c${i}r${j}`, bg);
            }
        }
    }

    // ── Encroachment overlays ──
    if (showEncroach) {
        const dm = p.downMatrix;
        const rm = p.rightMatrix;

        // False right diamonds: half-fill toward true down neighbors.
        for (let i = 0; i <= numCols; i++) {
            for (let j = 0; j < numRows; j++) {
                if (rm[i][j]) continue;
                const [cx, cy] = rightC(i, j);

                const nw = (i >= 1)               ? dm[j][i-1]   : false;
                const ne = (i < numCols)          ? dm[j][i]     : false;
                const sw = (i >= 1 && j+1 <= numRows) ? dm[j+1][i-1] : false;
                const se = (i < numCols && j+1 <= numRows) ? dm[j+1][i] : false;

                const leftFill = nw && sw;     // logical west pair both true
                const rightFill = ne && se;    // logical east pair both true
                if (leftFill) {
                    group.appendChild(svgEl("polygon", {
                        points: `${cx},${cy-D} ${cx},${cy+D} ${wX(cx)},${cy}`,
                        fill: FILL_DOWN, stroke: "none",
                    }));
                }
                if (rightFill) {
                    group.appendChild(svgEl("polygon", {
                        points: `${cx},${cy-D} ${eX(cx)},${cy} ${cx},${cy+D}`,
                        fill: FILL_DOWN, stroke: "none",
                    }));
                }
                if (leftFill || rightFill) {
                    group.appendChild(svgEl("line", {
                        x1: cx, y1: cy-D, x2: cx, y2: cy+D,
                        stroke: "#7a2d2d", "stroke-width": "1.5",
                    }));
                }
            }
        }

        // False down diamonds: half-fill toward true right neighbors.
        for (let j = 0; j <= numRows; j++) {
            for (let i = 0; i < numCols; i++) {
                if (dm[j][i]) continue;
                const [cx, cy] = downC(i, j);

                const nw = (j >= 1)              ? rm[i][j-1]   : false;
                const ne = (j >= 1 && i+1 <= numCols) ? rm[i+1][j-1] : false;
                const sw = (j < numRows)         ? rm[i][j]     : false;
                const se = (j < numRows && i+1 <= numCols) ? rm[i+1][j] : false;

                const topFill = nw && ne;
                const bottomFill = sw && se;
                if (topFill) {
                    group.appendChild(svgEl("polygon", {
                        points: `${cx},${nY(cy)} ${cx+D},${cy} ${cx-D},${cy}`,
                        fill: FILL_RIGHT, stroke: "none",
                    }));
                }
                if (bottomFill) {
                    group.appendChild(svgEl("polygon", {
                        points: `${cx-D},${cy} ${cx+D},${cy} ${cx},${sY(cy)}`,
                        fill: FILL_RIGHT, stroke: "none",
                    }));
                }
                if (topFill || bottomFill) {
                    group.appendChild(svgEl("line", {
                        x1: cx-D, y1: cy, x2: cx+D, y2: cy,
                        stroke: "#3d6a8a", "stroke-width": "1.5",
                    }));
                }
            }
        }

        // True right diamonds: thick edges toward true down neighbors.
        for (let i = 0; i <= numCols; i++) {
            for (let j = 0; j < numRows; j++) {
                if (!rm[i][j]) continue;
                const [cx, cy] = rightC(i, j);
                const nw = (i >= 1)               ? dm[j][i-1]   : false;
                const ne = (i < numCols)          ? dm[j][i]     : false;
                const sw = (i >= 1 && j+1 <= numRows) ? dm[j+1][i-1] : false;
                const se = (i < numCols && j+1 <= numRows) ? dm[j+1][i] : false;
                const edge = (x1, y1, x2, y2) => group.appendChild(svgEl("line", {
                    x1, y1, x2, y2,
                    stroke: "#7a2d2d", "stroke-width": "2.5",
                }));
                if (nw) edge(cx, nY(cy), wX(cx), cy);
                if (ne) edge(cx, nY(cy), eX(cx), cy);
                if (sw) edge(cx, sY(cy), wX(cx), cy);
                if (se) edge(cx, sY(cy), eX(cx), cy);
            }
        }

        // True down diamonds: thick edges toward true right neighbors.
        for (let j = 0; j <= numRows; j++) {
            for (let i = 0; i < numCols; i++) {
                if (!dm[j][i]) continue;
                const [cx, cy] = downC(i, j);
                const nw = (j >= 1)              ? rm[i][j-1]   : false;
                const ne = (j >= 1 && i+1 <= numCols) ? rm[i+1][j-1] : false;
                const sw = (j < numRows)         ? rm[i][j]     : false;
                const se = (j < numRows && i+1 <= numCols) ? rm[i+1][j] : false;
                const edge = (x1, y1, x2, y2) => group.appendChild(svgEl("line", {
                    x1, y1, x2, y2,
                    stroke: "#3d6a8a", "stroke-width": "2.5",
                }));
                if (nw) edge(cx, nY(cy), wX(cx), cy);
                if (ne) edge(cx, nY(cy), eX(cx), cy);
                if (sw) edge(cx, sY(cy), wX(cx), cy);
                if (se) edge(cx, sY(cy), eX(cx), cy);
            }
        }
    }

    // ── Priority overlay ──
    if (showPri) {
        const isVert = p.seniority?.isVertical ?? true;
        const cmp = isVert ? "≥" : ">";
        const downGlyph = flipJ ? "↑" : "↓";
        const rightGlyph = flipI ? "←" : "→";

        for (let j = 0; j < numRows; j++) {
            for (let i = 0; i < numCols; i++) {
                const [cx, cy] = cellC(i, j);
                const pI = pri(i + p.hInitCol);
                const pJ = pri(j + p.vInitRow);
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
