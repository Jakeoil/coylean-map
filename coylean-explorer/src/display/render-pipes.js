import { pri } from "../../coylean-core.js";
import { S, PAD } from "./diagram-coords.js";
import { presetForPri } from "./arrows.js";
import { drawPipeJunctionSvg } from "../../../meta/pipes/pipe-junction.js";

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
        numRows, numCols, hInitCol, vInitRow,
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
        return baseD * PRESET_PIPE_SCALE[presetForPri(pri(i + hInitCol))];
    };
    const dForRight = (j, val) => {
        if (!val) return 0;
        if (!usePriority) return baseD;
        return baseD * PRESET_PIPE_SCALE[presetForPri(pri(j + vInitRow))];
    };

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
                parent, boxX, boxY, S,
                blueDLeft, blueDRight, redDTop, redDBottom,
            );
        }
    }
}
