import { pri } from "../../coylean-core.js";
import { S, PAD } from "./diagram-coords.js";
import { presetForPri } from "./arrows.js";
import { drawPipeJunctionSvg } from "../../../meta/pipes/pipe-junction.js";
import { svgEl } from "./svg.js";

// Reaction box at cell (i,j): an S×S square whose corners are the cell's four
// corners, centered on the cell-center reaction. Its four triangular sectors
// are the half-diamonds nearest the reaction:
//   N triangle = D[j][i]   bottom half  (redDTop)
//   S triangle = D[j+1][i] top half     (redDBottom)
//   W triangle = R[i][j]   right half   (blueDLeft)
//   E triangle = R[i+1][j] left half    (blueDRight)
//
// flipJ/flipI: the panel is drawn with its local (0,0) flipped toward the
// mosaic centre. When flipped, the visual top↔bottom (or left↔right) of each
// reaction box is reversed, so we swap the corresponding diameter pair.

// Priority mode: scale uniform diameter by the half-pipe's axis priority preset.
// Down arrows are keyed by column priority pri(i + hInitCol);
// right arrows by row priority pri(j + vInitRow).
const PRESET_PIPE_SCALE = {
    thin2:   0.25,
    thin1:   0.5,
    current: 0.75,
    thick:   1.0,
};

// panel: {
//   numRows, numCols, hInitCol, vInitRow,
//   downMatrix, rightMatrix,
//   x = 0, y = 0,            // top-left of the panel area
//   flipJ = false, flipI = false,
// }
// flags: { pipesMode: "off" | "pipes" | "priority", pipesSize: 0..100 }
export function renderPipes(parent, panel, flags) {
    const {
        numRows, numCols, hInitCol, vInitRow, maxPri,
        downMatrix: dm, rightMatrix: rm,
        x = 0, y = 0,
        flipJ = false, flipI = false,
    } = panel;
    const { pipesMode = "off", pipesSize = 25 } = flags;
    if (pipesMode === "off") return;

    const baseD = Math.max(0, Math.min(1, pipesSize / 100));
    const usePriority = pipesMode === "priority";

    const dForDown = (i, val) => {
        if (!val) return 0;
        if (!usePriority) return baseD;
        return baseD * PRESET_PIPE_SCALE[presetForPri(pri(i + hInitCol, maxPri))];
    };
    const dForRight = (j, val) => {
        if (!val) return 0;
        if (!usePriority) return baseD;
        return baseD * PRESET_PIPE_SCALE[presetForPri(pri(j + vInitRow, maxPri))];
    };

    // Decorative overlay — never intercept clicks aimed at diamonds beneath.
    const layer = svgEl("g", { "pointer-events": "none" });
    parent.appendChild(layer);

    for (let j = 0; j < numRows; j++) {
        for (let i = 0; i < numCols; i++) {
            const pi = flipI ? (numCols - 1 - i) : i;
            const pj = flipJ ? (numRows - 1 - j) : j;
            const boxX = x + PAD + pi * S;
            const boxY = y + PAD + pj * S;

            let blueDLeft  = dForRight(j, rm[i][j]);
            let blueDRight = dForRight(j, rm[i + 1][j]);
            let redDTop    = dForDown(i, dm[j][i]);
            let redDBottom = dForDown(i, dm[j + 1][i]);

            if (flipJ) [redDTop, redDBottom] = [redDBottom, redDTop];
            if (flipI) [blueDLeft, blueDRight] = [blueDRight, blueDLeft];

            drawPipeJunctionSvg(
                layer, boxX, boxY, S,
                blueDLeft, blueDRight, redDTop, redDBottom,
            );
        }
    }
}

// Orphan half-pipes: for each visible panel edge, every true edge diamond
// gets rendered as if it were one half of a real junction at a ghost cell
// just outside the panel. We assume the perpendicular (crossbar) pipe
// exists with its diameter set by the standard priority rule at the ghost
// row/column index, then draw only the orphan-color half of that junction
// — the would-be crossbar pipe is geometry-only and not painted.
//
// Same panel descriptor and flags as renderPipes.
export function renderOrphanPipes(parent, panel, flags) {
    const {
        numRows, numCols, hInitCol, vInitRow, maxPri,
        downMatrix: dm, rightMatrix: rm,
        x = 0, y = 0,
        flipJ = false, flipI = false,
    } = panel;
    const { pipesMode = "off", pipesSize = 25 } = flags;
    if (pipesMode === "off") return;

    const baseD = Math.max(0, Math.min(1, pipesSize / 100));
    const usePriority = pipesMode === "priority";

    // Orphan-side diameter: zero if the edge diamond is false, otherwise
    // the standard preset for its axis priority.
    const dForDown = (i, val) => {
        if (!val) return 0;
        if (!usePriority) return baseD;
        return baseD * PRESET_PIPE_SCALE[presetForPri(pri(i + hInitCol, maxPri))];
    };
    const dForRight = (j, val) => {
        if (!val) return 0;
        if (!usePriority) return baseD;
        return baseD * PRESET_PIPE_SCALE[presetForPri(pri(j + vInitRow, maxPri))];
    };
    // Ghost-crossbar diameter: applies the same priority rule, but
    // unconditionally (the non-existent pipe is assumed present).
    const dGhostRow = (jGhost) => {
        if (!usePriority) return baseD;
        return baseD * PRESET_PIPE_SCALE[presetForPri(pri(jGhost + vInitRow, maxPri))];
    };
    const dGhostCol = (iGhost) => {
        if (!usePriority) return baseD;
        return baseD * PRESET_PIPE_SCALE[presetForPri(pri(iGhost + hInitCol, maxPri))];
    };

    // Edge diamond indices (panel-local) at each visual edge.
    const edgeJTop = flipJ ? numRows : 0;
    const edgeJBot = flipJ ? 0 : numRows;
    const edgeILeft = flipI ? numCols : 0;
    const edgeIRight = flipI ? 0 : numCols;
    // Ghost cell row/column (panel-local) one step outside each visual edge.
    const ghostJTop = flipJ ? numRows : -1;
    const ghostJBot = flipJ ? -1 : numRows;
    const ghostILeft = flipI ? numCols : -1;
    const ghostIRight = flipI ? -1 : numCols;

    // Force the orphan-color pipe to always be the wedge (so it always
    // tapers), and clamp the ghost crossbar diameter to be at least the
    // orphan's. The wedge taper distance y0 = sqrt(2*R*r - r*r) needs
    // 2R > r to stay positive; clamping R = crossbar_radius ≥ r =
    // wedge_radius guarantees y0 ≥ r > 0 for every orphan.
    const redOrphanOpts = { skipBlue: true, forceCrossbar: "blue" };
    const blueOrphanOpts = { skipRed: true, forceCrossbar: "red" };

    // Decorative overlay — never intercept clicks aimed at diamonds beneath.
    const layer = svgEl("g", { "pointer-events": "none" });
    parent.appendChild(layer);

    // Top edge: ghost cell sits above the panel; orphan is red.
    {
        const cellY = y + PAD - S;
        const dCrossRaw = dGhostRow(ghostJTop);
        for (let i = 0; i < numCols; i++) {
            const dOrphan = dForDown(i, dm[edgeJTop][i]);
            if (dOrphan <= 0) continue;
            const dCross = Math.max(dCrossRaw, dOrphan);
            const vi = flipI ? (numCols - 1 - i) : i;
            const cellX = x + PAD + vi * S;
            drawPipeJunctionSvg(
                layer, cellX, cellY, S,
                dCross, dCross, 0, dOrphan,
                redOrphanOpts,
            );
        }
    }

    // Bottom edge: ghost cell below; orphan is red on the north side.
    {
        const cellY = y + PAD + numRows * S;
        const dCrossRaw = dGhostRow(ghostJBot);
        for (let i = 0; i < numCols; i++) {
            const dOrphan = dForDown(i, dm[edgeJBot][i]);
            if (dOrphan <= 0) continue;
            const dCross = Math.max(dCrossRaw, dOrphan);
            const vi = flipI ? (numCols - 1 - i) : i;
            const cellX = x + PAD + vi * S;
            drawPipeJunctionSvg(
                layer, cellX, cellY, S,
                dCross, dCross, dOrphan, 0,
                redOrphanOpts,
            );
        }
    }

    // Left edge: ghost cell to the left; orphan is blue on the east side.
    {
        const cellX = x + PAD - S;
        const dCrossRaw = dGhostCol(ghostILeft);
        for (let j = 0; j < numRows; j++) {
            const dOrphan = dForRight(j, rm[edgeILeft][j]);
            if (dOrphan <= 0) continue;
            const dCross = Math.max(dCrossRaw, dOrphan);
            const vj = flipJ ? (numRows - 1 - j) : j;
            const cellY = y + PAD + vj * S;
            drawPipeJunctionSvg(
                layer, cellX, cellY, S,
                0, dOrphan, dCross, dCross,
                blueOrphanOpts,
            );
        }
    }

    // Right edge: ghost cell to the right; orphan is blue on the west side.
    {
        const cellX = x + PAD + numCols * S;
        const dCrossRaw = dGhostCol(ghostIRight);
        for (let j = 0; j < numRows; j++) {
            const dOrphan = dForRight(j, rm[edgeIRight][j]);
            if (dOrphan <= 0) continue;
            const dCross = Math.max(dCrossRaw, dOrphan);
            const vj = flipJ ? (numRows - 1 - j) : j;
            const cellY = y + PAD + vj * S;
            drawPipeJunctionSvg(
                layer, cellX, cellY, S,
                dOrphan, 0, dCross, dCross,
                blueOrphanOpts,
            );
        }
    }
}
