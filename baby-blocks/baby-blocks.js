"use strict";

/**
 * Baby Blocks — extract and render individual alphabet block SVGs
 * from AlphabetBlocks.svg with D4 transforms and color control.
 *
 * Usage:
 *   const blocks = await BabyBlocks.load("./AlphabetBlocks.svg");
 *   const svg = blocks.get("F", { color: "#C4282D", transform: "sv", outline: false });
 *   container.appendChild(svg);
 */

// XMLID → character mapping (derived from block positions in the source SVG)
const ID_TO_CHAR = {
    XMLID_306_: "A", XMLID_1_: "B", XMLID_2_: "C", XMLID_4_: "D",
    XMLID_14_: "E", XMLID_7_: "F", XMLID_10_: "G", XMLID_11_: "H",
    XMLID_16_: "I", XMLID_28_: "J", XMLID_24_: "K", XMLID_22_: "L",
    XMLID_20_: "M", XMLID_26_: "N", XMLID_18_: "O", XMLID_40_: "P",
    XMLID_38_: "Q", XMLID_36_: "R", XMLID_34_: "S", XMLID_32_: "T",
    XMLID_21_: "U", XMLID_52_: "V", XMLID_50_: "W", XMLID_68_: "X",
    XMLID_46_: "Y", XMLID_31_: "Z", XMLID_42_: "0", XMLID_66_: "1",
    XMLID_64_: "2", XMLID_62_: "3", XMLID_60_: "4", XMLID_56_: "5",
    XMLID_58_: "6", XMLID_54_: "7", XMLID_72_: "8", XMLID_70_: "9",
};

// Original colors from the SVG
const ORIGINAL_COLORS = {
    st0: "#C4282D", // red
    st1: "#0075BB", // blue
    st2: "#00934C", // green
    st3: "#FDB845", // yellow
};

// Block size in source SVG coordinates
const BLOCK_SIZE = 183.5395;

/**
 * D4 transform matrices.
 * Each is [a, b, c, d] for the 2×2 linear part of the affine transform,
 * applied around the block center.
 *
 *   e    — identity
 *   r    — 90° clockwise
 *   r2   — 180°
 *   r3   — 270° clockwise (= 90° counter-clockwise)
 *   sv   — vertical mirror (flip left↔right)
 *   sh   — horizontal mirror (flip top↔bottom)
 *   d    — diagonal mirror (\)
 *   d'   — anti-diagonal mirror (/)
 */
const D4 = {
    e:  [ 1,  0,  0,  1],
    r:  [ 0,  1, -1,  0],
    r2: [-1,  0,  0, -1],
    r3: [ 0, -1,  1,  0],
    sv: [-1,  0,  0,  1],
    sh: [ 1,  0,  0, -1],
    d:  [ 0,  1,  1,  0],
    "d'": [ 0, -1, -1,  0],
};

/**
 * Parse the source SVG and extract each block's path data.
 * Returns a Map<char, { d: string, cls: string, outerBox: {x,y} }>
 */
function parseBlocks(svgText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const paths = doc.querySelectorAll("path[id]");
    const blocks = new Map();

    for (const path of paths) {
        const id = path.getAttribute("id");
        const char = ID_TO_CHAR[id];
        if (!char) continue;

        const cls = path.getAttribute("class");
        const d = path.getAttribute("d");

        // Find outer rectangle top-left from the path data.
        // The rect subpath is: M x,y v183.5... then either h±183.5 or H absX
        const m = d.match(/M([\d.]+),([\d.]+)v183\.\d+/);
        if (!m) continue;

        let ox = parseFloat(m[1]);
        const oy = parseFloat(m[2]);
        const after = d.substring(d.indexOf(m[0]) + m[0].length);
        // Relative h: h±183
        const hRel = after.match(/^[\d.]*h(-?[\d.]+)/);
        if (hRel) {
            if (parseFloat(hRel[1]) < 0) ox += parseFloat(hRel[1]);
        } else {
            // Absolute H: the rect goes to H absX — take the min as left edge
            const hAbs = after.match(/^[\d.]*H([\d.]+)/);
            if (hAbs) ox = Math.min(ox, parseFloat(hAbs[1]));
        }

        blocks.set(char, { d, cls, ox, oy, color: ORIGINAL_COLORS[cls] });
    }
    return blocks;
}

/**
 * Separate a block's path data into outline (outer + inner rect) and
 * letter (everything else) subpaths.
 */
function splitPaths(pathData) {
    // Split into subpaths at each M command
    const subpaths = [];
    let current = "";
    for (let i = 0; i < pathData.length; i++) {
        if (pathData[i] === "M" && current) {
            subpaths.push(current);
            current = "";
        }
        current += pathData[i];
    }
    if (current) subpaths.push(current);

    const outline = [];
    const letter = [];

    for (const sp of subpaths) {
        // A subpath is "outline" if it draws one of the two rectangles
        // (outer ~183.5 or inner ~153.5). Check for 183 or 153 dimensions
        // in any command (v, h, V, H — relative or absolute).
        if (/[vh]-?183\.\d/i.test(sp) || /[vh]-?153\.\d/i.test(sp)) {
            outline.push(sp);
        } else {
            letter.push(sp);
        }
    }

    return { outline: outline.join(""), letter: letter.join(""), all: pathData };
}

export class BabyBlocks {
    constructor(blocks) {
        this._blocks = blocks; // Map<char, block>
    }

    /**
     * Load and parse the AlphabetBlocks SVG.
     * @param {string} svgUrl - path to AlphabetBlocks.svg
     * @returns {Promise<BabyBlocks>}
     */
    static async load(svgUrl) {
        const resp = await fetch(svgUrl);
        const text = await resp.text();
        return new BabyBlocks(parseBlocks(text));
    }

    /** List all available characters. */
    get chars() {
        return [...this._blocks.keys()].sort();
    }

    /**
     * Get an SVG element for a single block letter.
     *
     * @param {string} char - the character (A-Z, 0-9)
     * @param {object} opts
     * @param {string}  opts.color     - fill color (default: original)
     * @param {string}  opts.transform - D4 transform name (default: "e")
     * @param {boolean} opts.outline   - include block outline (default: true)
     * @param {number}  opts.size      - output size in px (default: 64)
     * @returns {SVGSVGElement}
     */
    get(char, opts = {}) {
        const block = this._blocks.get(char.toUpperCase());
        if (!block) throw new Error(`No block for "${char}"`);

        const {
            color = block.color,
            transform = "e",
            outline = true,
            size = 64,
        } = opts;

        const mat = D4[transform];
        if (!mat) throw new Error(`Unknown D4 transform "${transform}"`);

        const { d: pathData, ox, oy } = block;
        const split = splitPaths(pathData);
        const drawData = outline ? split.all : split.letter;

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", size);
        svg.setAttribute("height", size);
        svg.setAttribute("viewBox", `0 0 ${BLOCK_SIZE} ${BLOCK_SIZE}`);

        // Build transform: translate block center to origin, apply D4, translate back
        // Combined: translate(-ox, -oy) puts block at (0,0)...(BLOCK_SIZE, BLOCK_SIZE)
        // Then apply D4 around center (BLOCK_SIZE/2, BLOCK_SIZE/2)
        const h = BLOCK_SIZE / 2;
        const [a, b, c, dd] = mat;
        // Full affine: translate(h,h) · matrix(a,b,c,d,0,0) · translate(-h,-h) · translate(-ox,-oy)
        // = matrix(a, b, c, d, h - a*h - c*h - ox*a - oy*c, h - b*h - d*h - ox*b - oy*d)
        // Simplified: first shift to local coords, then D4 around center
        const tx = h - a * (ox + h) - c * (oy + h);
        const ty = h - b * (ox + h) - dd * (oy + h);

        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("transform", `matrix(${a},${b},${c},${dd},${tx},${ty})`);

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", drawData);
        path.setAttribute("fill", color);
        g.appendChild(path);

        svg.appendChild(g);
        return svg;
    }

    /**
     * Draw a block letter directly onto a canvas 2D context using Path2D.
     * Synchronous — no image loading required.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} char - A-Z or 0-9
     * @param {number} x - center x on canvas
     * @param {number} y - center y on canvas
     * @param {number} size - rendered size in px
     * @param {object} opts
     * @param {string}  opts.color     - fill color (default: original)
     * @param {string}  opts.transform - D4 name (default: "e")
     * @param {boolean} opts.outline   - include outline (default: true)
     */
    drawDirect(ctx, char, x, y, size, opts = {}) {
        const block = this._blocks.get(char.toUpperCase());
        if (!block) return;

        const {
            color = block.color,
            transform = "e",
            outline = true,
        } = opts;

        const mat = D4[transform] || D4.e;
        const { ox, oy } = block;
        if (!block._split) block._split = splitPaths(block.d);
        const drawData = outline ? block._split.all : block._split.letter;

        const h = BLOCK_SIZE / 2;
        const s = size / BLOCK_SIZE;
        const [a, b, c, dd] = mat;

        // Affine: translate to (x,y) center, scale to size,
        // then D4 around block center, then shift block origin to (0,0)
        const tx = h - a * (ox + h) - c * (oy + h);
        const ty = h - b * (ox + h) - dd * (oy + h);

        ctx.save();
        ctx.translate(x - size / 2, y - size / 2);
        ctx.scale(s, s);
        ctx.transform(a, b, c, dd, tx, ty);
        ctx.fillStyle = color;
        ctx.fill(new Path2D(drawData));
        ctx.restore();
    }
}

/**
 * Convert a glyph fTransform tuple [letter, scaleX, scaleY, color, backslash]
 * to a D4 transform name for baby blocks.
 */
export function fTransformToD4(ft) {
    const [, sx, sy, , backslash] = ft;
    if (!backslash) {
        if (sx === 1 && sy === 1) return "e";
        if (sx === -1 && sy === -1) return "r2";
        if (sx === 1 && sy === -1) return "sh";
        if (sx === -1 && sy === 1) return "sv";
    } else {
        if (sx === 1 && sy === 1) return "d";
        if (sx === -1 && sy === -1) return "d'";
        if (sx === 1 && sy === -1) return "r3";
        if (sx === -1 && sy === 1) return "r";
    }
    return "e";
}

/**
 * Convert an explorer ft tuple [letter, scaleX, scaleY] (no backslash)
 * to a D4 transform name.
 */
export function ftToD4(ft) {
    const [, sx, sy] = ft;
    if (sx === 1 && sy === 1) return "e";
    if (sx === -1 && sy === -1) return "r2";
    if (sx === 1 && sy === -1) return "sh";
    if (sx === -1 && sy === 1) return "sv";
    return "e";
}

export { D4, ORIGINAL_COLORS, BLOCK_SIZE };
