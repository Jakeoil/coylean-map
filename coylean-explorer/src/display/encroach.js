import { svgEl } from "./svg.js";
import { D } from "./diagram-coords.js";

const FILL_DOWN = "#e0a8a8";
const FILL_RIGHT = "#bcd8e8";
const STROKE_DOWN = "#7a2d2d";
const STROKE_RIGHT = "#3d6a8a";

// Render the encroachment overlay into `parent`.
//
//   dm, rm           — down/right matrices (p.downMatrix, p.rightMatrix)
//   nR, nC           — numRows, numColumns
//   downC, rightC    — (i, j) → [cx, cy] center lookups
//   wX, eX, nY, sY   — flip-aware corner offsets relative to a diamond center.
//                      For an unflipped panel: wX=cx-D, eX=cx+D, nY=cy-D, sY=cy+D.
//                      In a flipped mosaic panel these swap sides so logical
//                      "north" / "west" track the propagation's logical axes.
//   showFill         — when false, suppress the half-fill triangles but keep
//                      the bisecting lines and incursion edges (Fill toggle).
//
// The four passes mirror the original inline blocks: false-right half-fills,
// false-down half-fills, true-right incursion edges, true-down incursion edges.
export function renderEncroach(parent, opts) {
    const {
        dm, rm, nR, nC,
        downC, rightC,
        wX, eX, nY, sY,
        showFill,
    } = opts;

    // False right diamonds: half-fill toward true down neighbors.
    for (let i = 0; i <= nC; i++) {
        for (let j = 0; j < nR; j++) {
            if (rm[i][j]) continue;
            const [cx, cy] = rightC(i, j);

            const nw = (i >= 1)                        ? dm[j][i-1]   : false;
            const ne = (i < nC)                        ? dm[j][i]     : false;
            const sw = (i >= 1 && j+1 <= nR)           ? dm[j+1][i-1] : false;
            const se = (i < nC && j+1 <= nR)           ? dm[j+1][i]   : false;

            const leftFill = nw && sw;
            const rightFill = ne && se;
            if (leftFill && showFill) {
                parent.appendChild(svgEl("polygon", {
                    points: `${cx},${cy-D} ${cx},${cy+D} ${wX(cx)},${cy}`,
                    fill: FILL_DOWN, stroke: "none",
                }));
            }
            if (rightFill && showFill) {
                parent.appendChild(svgEl("polygon", {
                    points: `${cx},${cy-D} ${eX(cx)},${cy} ${cx},${cy+D}`,
                    fill: FILL_DOWN, stroke: "none",
                }));
            }
            if (leftFill || rightFill) {
                parent.appendChild(svgEl("line", {
                    x1: cx, y1: cy-D, x2: cx, y2: cy+D,
                    stroke: STROKE_DOWN, "stroke-width": "1.5",
                }));
            }
        }
    }

    // False down diamonds: half-fill toward true right neighbors.
    for (let j = 0; j <= nR; j++) {
        for (let i = 0; i < nC; i++) {
            if (dm[j][i]) continue;
            const [cx, cy] = downC(i, j);

            const nw = (j >= 1)                        ? rm[i][j-1]   : false;
            const ne = (j >= 1 && i+1 <= nC)           ? rm[i+1][j-1] : false;
            const sw = (j < nR)                        ? rm[i][j]     : false;
            const se = (j < nR && i+1 <= nC)           ? rm[i+1][j]   : false;

            const topFill = nw && ne;
            const bottomFill = sw && se;
            if (topFill && showFill) {
                parent.appendChild(svgEl("polygon", {
                    points: `${cx},${nY(cy)} ${cx+D},${cy} ${cx-D},${cy}`,
                    fill: FILL_RIGHT, stroke: "none",
                }));
            }
            if (bottomFill && showFill) {
                parent.appendChild(svgEl("polygon", {
                    points: `${cx-D},${cy} ${cx+D},${cy} ${cx},${sY(cy)}`,
                    fill: FILL_RIGHT, stroke: "none",
                }));
            }
            if (topFill || bottomFill) {
                parent.appendChild(svgEl("line", {
                    x1: cx-D, y1: cy, x2: cx+D, y2: cy,
                    stroke: STROKE_RIGHT, "stroke-width": "1.5",
                }));
            }
        }
    }

    // True right diamonds: thick edges toward true down neighbors.
    for (let i = 0; i <= nC; i++) {
        for (let j = 0; j < nR; j++) {
            if (!rm[i][j]) continue;
            const [cx, cy] = rightC(i, j);
            const nw = (i >= 1)                        ? dm[j][i-1]   : false;
            const ne = (i < nC)                        ? dm[j][i]     : false;
            const sw = (i >= 1 && j+1 <= nR)           ? dm[j+1][i-1] : false;
            const se = (i < nC && j+1 <= nR)           ? dm[j+1][i]   : false;
            const edge = (x1, y1, x2, y2) => parent.appendChild(svgEl("line", {
                x1, y1, x2, y2,
                stroke: STROKE_DOWN, "stroke-width": "2.5",
            }));
            if (nw) edge(cx, nY(cy), wX(cx), cy);
            if (ne) edge(cx, nY(cy), eX(cx), cy);
            if (sw) edge(cx, sY(cy), wX(cx), cy);
            if (se) edge(cx, sY(cy), eX(cx), cy);
        }
    }

    // True down diamonds: thick edges toward true right neighbors.
    for (let j = 0; j <= nR; j++) {
        for (let i = 0; i < nC; i++) {
            if (!dm[j][i]) continue;
            const [cx, cy] = downC(i, j);
            const nw = (j >= 1)                        ? rm[i][j-1]   : false;
            const ne = (j >= 1 && i+1 <= nC)           ? rm[i+1][j-1] : false;
            const sw = (j < nR)                        ? rm[i][j]     : false;
            const se = (j < nR && i+1 <= nC)           ? rm[i+1][j]   : false;
            const edge = (x1, y1, x2, y2) => parent.appendChild(svgEl("line", {
                x1, y1, x2, y2,
                stroke: STROKE_RIGHT, "stroke-width": "2.5",
            }));
            if (nw) edge(cx, nY(cy), wX(cx), cy);
            if (ne) edge(cx, nY(cy), eX(cx), cy);
            if (sw) edge(cx, sY(cy), wX(cx), cy);
            if (se) edge(cx, sY(cy), eX(cx), cy);
        }
    }
}
