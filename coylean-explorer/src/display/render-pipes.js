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

// Priority mode: scale uniform diameter by the half-pipe's axis priority preset.
// Down arrows are keyed by column priority pri(i + hInitCol);
// right arrows by row priority pri(j + vInitRow) — matches render-propagation.
const PRESET_PIPE_SCALE = {
    thin2:   0.25,
    thin1:   0.5,
    current: 0.75,
    thick:   1.0,
};

export function renderPipes(vp, config, result, flags) {
    const { numRows: nR, numCols: nC, hInitCol, vInitRow } = config;
    const { downMatrix: dm, rightMatrix: rm } = result;
    const { pipesMode = "off", pipesSize = 25 } = flags;
    if (pipesMode === "off") return;

    const baseD = Math.max(0, Math.min(1, pipesSize / 100));
    const usePriority = pipesMode === "priority";

    const dForDown = (i, val) => {
        if (!val) return 0;
        if (!usePriority) return baseD;
        const k = PRESET_PIPE_SCALE[presetForPri(pri(i + hInitCol))];
        return baseD * k;
    };
    const dForRight = (j, val) => {
        if (!val) return 0;
        if (!usePriority) return baseD;
        const k = PRESET_PIPE_SCALE[presetForPri(pri(j + vInitRow))];
        return baseD * k;
    };

    for (let j = 0; j < nR; j++) {
        for (let i = 0; i < nC; i++) {
            const x = PAD + i * S;
            const y = PAD + j * S;
            const blueDLeft  = dForRight(j, rm[i][j]);
            const blueDRight = dForRight(j, rm[i + 1][j]);
            const redDTop    = dForDown(i, dm[j][i]);
            const redDBottom = dForDown(i, dm[j + 1][i]);
            drawPipeJunctionSvg(vp, x, y, S, blueDLeft, blueDRight, redDTop, redDBottom);
        }
    }
}
