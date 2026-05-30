// ═══════════════════════════════════════════════════
//  Coylean Glyphs — orbit-color engine (renderer-agnostic)
// ═══════════════════════════════════════════════════
//
// Packages the "color a Coylean map by glyph orbit, composited down the
// substitution" idea so ANY renderer (canvas, SVG, WebGL …) can hook up: the
// engine produces plain {x, y, size, r, g, b, a} rectangles in back-to-front
// draw order; the caller draws them however it likes.
//
// Pure: no DOM, no canvas, no fetch. Depends only on the glyph core (math) and
// the shared OKLCH helper. Importable in Node.
//
// Pipeline:
//   buildEngine(seniority)         → { orbitOf, table, orbits }
//   defaultPalette(seniority)      → Map(orbit → { rgb, hue, L, C, enabled })
//   mapCodes(seniority, order, …)  → 2-D array of [d, r] section codes
//   compositeRects({ codes, … })   → [{ x, y, size, r, g, b, a }, …]

import { Seniority } from "../../coylean-explorer/coylean-core.js";
import {
    getSectionData,
    computeMapModel,
    classifyVisualD4,
    setOffset,
} from "../../glyphs/glyph-core.js";
import { oklchHex } from "../4d/src/oklch-ramps.js";

// Golden-angle hue so any number of orbits stays perceptually separated.
const GOLDEN_ANGLE = 137.508;
// Default OKLCH lightness / chroma for the stained-glass palette.
export const DEFAULT_L = 0.63;
export const DEFAULT_C = 0.17;

// ── Translation table (parent code → 2×2 child codes) ──
// Built from the canonical clean map at orders 5→6 and 6→7 — the same data the
// catalog's translation table shows. Covers every code that appears on the
// anchor map; off-anchor codes with no rule simply stop the descent.
function buildTranslationTable(seniority) {
    const o = [32, 64, 128].map((N) => getSectionData(N, N, seniority));
    const t = {};
    function ingest(p, c) {
        for (let sr = 0; sr < p.NSr; sr++)
            for (let sc = 0; sc < p.NSc; sc++) {
                const [d, r] = p.codes[sr][sc];
                const k = d + "," + r;
                if (t[k]) continue;
                const a = sr * 2, b = sc * 2;
                t[k] = {
                    children: [
                        c.codes[a][b], c.codes[a][b + 1],
                        c.codes[a + 1][b], c.codes[a + 1][b + 1],
                    ],
                };
            }
    }
    ingest(o[0], o[1]);
    ingest(o[1], o[2]);
    return t;
}

// ── Engine ──
// orbitOf : Map "d,r" → orbit index (D4 equivalence class, any orientation)
// table   : code "d,r" → { children: [[d,r]×4] }  (NW, NE, SW, SE)
// orbits  : [{ orbit, rep:[d,r] }]  in canonical order
export function buildEngine(seniority) {
    const classes = classifyVisualD4(seniority);
    const orbitOf = new Map();
    const orbits = [];
    classes.forEach((cls, ci) => {
        orbits.push({ orbit: ci, rep: cls.rep });
        cls.orbit.forEach(([d, r]) => orbitOf.set(d + "," + r, ci));
    });
    return { orbitOf, table: buildTranslationTable(seniority), orbits };
}

// ── Palette ──
// orbit index → { rgb:[r,g,b], hue, L, C, enabled }. OKLCH-derived so hues are
// perceptually even and the lightness/chroma are uniform (stained glass).
export function defaultPalette(seniority, opts = {}) {
    const L = opts.L ?? DEFAULT_L;
    const C = opts.C ?? DEFAULT_C;
    const classes = classifyVisualD4(seniority);
    const pal = new Map();
    classes.forEach((cls, ci) => {
        const hue = (ci * GOLDEN_ANGLE) % 360;
        pal.set(ci, { ...rgbAt(L, C, hue), hue, L, C, enabled: true,
            rep: cls.rep });
    });
    return pal;
}
// One palette entry's rgb from OKLCH.
export function rgbAt(L, C, hue) {
    const int = oklchHex(L, C, hue);
    return { rgb: [(int >> 16) & 255, (int >> 8) & 255, int & 255] };
}

// ── Map codes ──
// 2-D array of [d, r] section codes for a Coylean map at the given order
// (cells per side; 32 → 8×8 sections, 64 → 16×16 …) and dyadic offset.
export function mapCodes(seniority, order, h = 1, v = 1) {
    setOffset(h, v);
    const model = computeMapModel(order, order, { seniority });
    setOffset(1, 1);
    return model.secCodes;
}

// ── Composite ──
// Walk each section, recursing through the translation table; emit a colored
// rectangle for every (sub-)glyph whose orbit is enabled. Alpha falls off with
// depth (baseAlpha · falloff^depth) so the coarse glyph dominates and finer
// scales tint. Returns rects in draw order (coarse first → fine on top).
//
// opts: { codes, gap, secPx, engine, palette, minPx, baseAlpha, falloff }
export function compositeRects(opts) {
    const { codes, gap, secPx, engine, palette } = opts;
    const minPx = opts.minPx ?? 3;
    const baseAlpha = opts.baseAlpha ?? 0.55;
    const falloff = opts.falloff ?? 0.42;
    const { orbitOf, table } = engine;
    const rects = [];
    function descend(code, x, y, size, depth) {
        const orbit = orbitOf.get(code[0] + "," + code[1]);
        const pe = orbit === undefined ? null : palette.get(orbit);
        if (pe && pe.enabled)
            rects.push({
                x, y, size,
                r: pe.rgb[0], g: pe.rgb[1], b: pe.rgb[2],
                a: baseAlpha * Math.pow(falloff, depth),
            });
        const half = size / 2;
        if (half < minPx) return;
        const rule = table[code[0] + "," + code[1]];
        if (!rule) return;
        descend(rule.children[0], x, y, half, depth + 1);
        descend(rule.children[1], x + half, y, half, depth + 1);
        descend(rule.children[2], x, y + half, half, depth + 1);
        descend(rule.children[3], x + half, y + half, half, depth + 1);
    }
    const rows = codes.length, cols = codes[0].length;
    for (let sr = 0; sr < rows; sr++)
        for (let sc = 0; sc < cols; sc++)
            descend(codes[sr][sc],
                gap + sc * (secPx + gap), gap + sr * (secPx + gap), secPx, 0);
    return rects;
}

export { Seniority };
