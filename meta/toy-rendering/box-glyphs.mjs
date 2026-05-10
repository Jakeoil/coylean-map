"use strict";

// Box-drawing glyph palettes and ASCII renderers for Coylean propagation
// results. Consumes a { downMatrix, rightMatrix } pair (the shape returned
// by `new Propagation(...)` in ../../coylean-explorer/coylean-core.js)
// and produces a multi-line Unicode string.
//
// Conventions:
//   downMatrix[j][i]  — vertical arrow on the right edge of cell (i, j)
//   rightMatrix[i][j] — horizontal arrow on the bottom edge of cell (i, j)
//
// Rendering walks every grid vertex (a, b) with a in [0, numCols] and
// b in [0, numRows], and reads the four incident edges:
//   N (north): right edge of cell (a-1, b-1) = downMatrix[b-1][a-1]
//   S (south): right edge of cell (a-1, b)   = downMatrix[b][a-1]
//   W (west):  bottom edge of cell (a-1, b-1) = rightMatrix[a-1][b-1]
//   E (east):  bottom edge of cell (a, b-1)   = rightMatrix[a][b-1]
// Out-of-bounds reads count as absent.
//
// USAGE
// -----
//   import { Propagation } from "../../coylean-explorer/coylean-core.js";
//   import {
//       LIGHT, HEAVY, DOUBLE,
//       renderUniform, renderMixed, priorityWeight,
//   } from "./box-glyphs.mjs";
//
//   const N = 8;
//   const { downMatrix, rightMatrix } = new Propagation({
//       numRows: N, numColumns: N, hInitCol: 1, vInitRow: 1,
//   });
//
//   // Pick one of the uniform-weight palettes:
//   console.log(renderUniform({ downMatrix, rightMatrix, palette: LIGHT  }));
//   console.log(renderUniform({ downMatrix, rightMatrix, palette: HEAVY  }));
//   console.log(renderUniform({ downMatrix, rightMatrix, palette: DOUBLE }));
//
//   // Or mix light/heavy per edge by supplying a weight function:
//   console.log(renderMixed({
//       downMatrix, rightMatrix, weight: priorityWeight,
//   }));

import { pri } from "../../coylean-explorer/coylean-core.js";

/**
 * Light box-drawing glyphs. 16 entries indexed by
 *   (N << 3 | E << 2 | S << 1 | W)
 * where each direction is 0 (absent) or 1 (present).
 */
// prettier-ignore
export const LIGHT = [
    " ", "╴", "╷", "┐", "╶", "─", "┌", "┬",
    "╵", "┘", "│", "┤", "└", "┴", "├", "┼",
];

/** Heavy box-drawing glyphs. Same indexing as LIGHT. */
// prettier-ignore
export const HEAVY = [
    " ", "╸", "╻", "┓", "╺", "━", "┏", "┳",
    "╹", "┛", "┃", "┫", "┗", "┻", "┣", "╋",
];

/**
 * Double box-drawing glyphs. Same indexing as LIGHT.
 * Single-direction stubs (indices 1, 2, 4, 8) fall back to LIGHT caps
 * because Unicode has no double-line single-direction glyphs.
 */
// prettier-ignore
export const DOUBLE = [
    " ", "╴", "╷", "╗", "╶", "═", "╔", "╦",
    "╵", "╝", "║", "╣", "╚", "╩", "╠", "╬",
];

/**
 * Mixed-weight (light + heavy) glyphs. 81 entries keyed by a 4-character
 * string `${n}${e}${s}${w}` where each character ∈ {"0", "1", "2"}:
 *   0 = absent
 *   1 = light
 *   2 = heavy
 *
 * Use `renderMixed` to drive this directly from a per-edge weight function.
 */
// prettier-ignore
export const MIXED = {
    "0000":" ",
    "1000":"╵","2000":"╹","0100":"╶","0200":"╺",
    "0010":"╷","0020":"╻","0001":"╴","0002":"╸",
    "1010":"│","1020":"╽","2010":"╿","2020":"┃",
    "0101":"─","0102":"╾","0201":"╼","0202":"━",
    "0110":"┌","0120":"┎","0210":"┍","0220":"┏",
    "0011":"┐","0012":"┑","0021":"┒","0022":"┓",
    "1100":"└","1200":"┕","2100":"┖","2200":"┗",
    "1001":"┘","1002":"┙","2001":"┚","2002":"┛",
    "1110":"├","1120":"┟","1210":"┝","1220":"┢",
    "2110":"┞","2120":"┠","2210":"┡","2220":"┣",
    "1011":"┤","1012":"┥","1021":"┧","1022":"┪",
    "2011":"┦","2012":"┩","2021":"┨","2022":"┫",
    "0111":"┬","0112":"┭","0121":"┰","0122":"┱",
    "0211":"┮","0212":"┯","0221":"┲","0222":"┳",
    "1101":"┴","1102":"┵","1201":"┶","1202":"┷",
    "2101":"┸","2102":"┹","2201":"┺","2202":"┻",
    "1111":"┼","1112":"┽","1121":"╁","1122":"╅",
    "1211":"┾","1212":"┿","1221":"╆","1222":"╈",
    "2111":"╀","2112":"╃","2121":"╂","2122":"╉",
    "2211":"╄","2212":"╇","2221":"╊","2222":"╋",
};

/**
 * Default mixed-weight rule: any edge at a column or row boundary `k`
 * with `pri(k) > 1` is heavy (weight 2); everything else is light
 * (weight 1). For an N=8 grid this picks out boundaries 4 and 8.
 *
 * @param {number} boundary  column or row boundary index in [0, N]
 * @returns {1 | 2}
 */
export function priorityWeight(boundary) {
    return pri(boundary) > 1 ? 2 : 1;
}

/**
 * Render a propagation as a multi-line string using a uniform-weight
 * palette (LIGHT, HEAVY, or DOUBLE).
 *
 * Adjacent vertices in the same row are joined by a glue character
 * (the connector) when an E-edge is present; absent E-edges become
 * a space. The connector defaults to `palette[5]` — the horizontal-line
 * glyph of the chosen palette — which is correct for all three
 * built-in palettes.
 *
 * @param {Object} options
 * @param {boolean[][]} options.downMatrix
 * @param {boolean[][]} options.rightMatrix
 * @param {number} [options.numRows=downMatrix.length - 1]
 * @param {number} [options.numCols=rightMatrix.length - 1]
 * @param {string[]} [options.palette=LIGHT]   16-entry glyph table
 * @param {string} [options.connector=palette[5]]
 * @returns {string}
 */
export function renderUniform({
    downMatrix,
    rightMatrix,
    numRows = downMatrix.length - 1,
    numCols = rightMatrix.length - 1,
    palette = LIGHT,
    connector = palette[5],
}) {
    const dm = (j, i) =>
        j >= 0 && j < numRows && i >= 0 && i < numCols
            ? !!downMatrix[j][i]
            : false;
    const rm = (i, j) =>
        i >= 0 && i < numCols && j >= 0 && j < numRows
            ? !!rightMatrix[i][j]
            : false;
    const lines = [];
    for (let b = 0; b <= numRows; b++) {
        let line = "";
        for (let a = 0; a <= numCols; a++) {
            const n = dm(b - 1, a - 1);
            const s = dm(b, a - 1);
            const w = rm(a - 1, b - 1);
            const e = rm(a, b - 1);
            const idx = (n ? 8 : 0) | (e ? 4 : 0) | (s ? 2 : 0) | (w ? 1 : 0);
            line += palette[idx];
            if (a < numCols) line += e ? connector : " ";
        }
        lines.push(line);
    }
    return lines.join("\n");
}

/**
 * Render a propagation as a multi-line string with per-edge weights,
 * mixing light and heavy glyphs from the MIXED palette.
 *
 * The `weight` callback is invoked once per column boundary (for
 * vertical edges in that column) and once per row boundary (for
 * horizontal edges in that row), and must return 1 (light) or
 * 2 (heavy). See `priorityWeight` for the standard rule.
 *
 * @param {Object} options
 * @param {boolean[][]} options.downMatrix
 * @param {boolean[][]} options.rightMatrix
 * @param {number} [options.numRows=downMatrix.length - 1]
 * @param {number} [options.numCols=rightMatrix.length - 1]
 * @param {(boundary: number) => 1 | 2} [options.weight=priorityWeight]
 * @returns {string}
 */
export function renderMixed({
    downMatrix,
    rightMatrix,
    numRows = downMatrix.length - 1,
    numCols = rightMatrix.length - 1,
    weight = priorityWeight,
}) {
    const dm = (j, i) =>
        j >= 0 && j < numRows && i >= 0 && i < numCols
            ? !!downMatrix[j][i]
            : false;
    const rm = (i, j) =>
        i >= 0 && i < numCols && j >= 0 && j < numRows
            ? !!rightMatrix[i][j]
            : false;
    const lines = [];
    for (let b = 0; b <= numRows; b++) {
        const hWeight = weight(b);
        let line = "";
        for (let a = 0; a <= numCols; a++) {
            const vWeight = weight(a);
            const n = dm(b - 1, a - 1) ? vWeight : 0;
            const s = dm(b, a - 1) ? vWeight : 0;
            const w = rm(a - 1, b - 1) ? hWeight : 0;
            const e = rm(a, b - 1) ? hWeight : 0;
            const key = `${n}${e}${s}${w}`;
            line += MIXED[key] ?? "?";
            if (a < numCols) {
                const eEdge = rm(a, b - 1);
                line += eEdge ? (hWeight === 2 ? "━" : "─") : " ";
            }
        }
        lines.push(line);
    }
    return lines.join("\n");
}
