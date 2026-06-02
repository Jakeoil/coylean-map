// planet-coyleus — terrain-core (pure math + palette model, Node-importable).
//
// No DOM, no canvas, no fetch. Owns: the 12-orbit model (keyed by the
// assignments.json letters), the verified 16-cell D4 derivation, the global
// per-orbit palette (paint one cell → every occurrence + sibling re-derives),
// the substitution/translation relatives, the universe patch, and the OKLCH
// terrain ramps. See test/orbits-12.mjs and test/cell-d4.mjs for the proofs the
// constants below rest on.

import { Seniority } from "../../coylean-explorer/coylean-core.js";
import {
    classifyVisualD4,
    computePattern,
    transformedPatternKey,
    computeGlyphMatrices,
    getSectionData,
    getWorkingAssignments,
    pairKey,
} from "../../glyphs/glyph-core.js";
import {
    TRANSLATION_V,
    V_TO_H,
} from "../superglyphs/tests/rules.mjs";
import { oklchHex } from "../4d/src/oklch-ramps.js";

const V = Seniority.vertical();
const H = Seniority.horizontal();

// Unpainted cell color (neutral, reads as "unassigned").
export const EMPTY = "#23262f";

// ── verified 16-cell D4 permutation (test/cell-d4.mjs) ──
// PERM[ti][c] = the member cell that canonical cell c lands in under D4 element
// ti (catalog order: e r r² r³ s_h s_v s_d1 s_d2).
// prettier-ignore
const CELL_PERM = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    [12, 8, 4, 0, 13, 9, 5, 1, 14, 10, 6, 2, 15, 11, 7, 3],
    [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
    [3, 7, 11, 15, 2, 6, 10, 14, 1, 5, 9, 13, 0, 4, 8, 12],
    [12, 13, 14, 15, 8, 9, 10, 11, 4, 5, 6, 7, 0, 1, 2, 3],
    [3, 2, 1, 0, 7, 6, 5, 4, 11, 10, 9, 8, 15, 14, 13, 12],
    [0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15],
    [15, 11, 7, 3, 14, 10, 6, 2, 13, 9, 5, 1, 12, 8, 4, 0],
];

// ── terrain ramps (OKLCH) ──
const hexOf = (n) => "#" + (n & 0xffffff).toString(16).padStart(6, "0");
function ramp(name, hue, stops) {
    return {
        name,
        hue,
        stops: Object.entries(stops).map(([label, [L, C]]) => ({
            label,
            hex: hexOf(oklchHex(L, C, hue)),
        })),
    };
}
export const TERRAINS = [
    ramp("water", 245, { deep: [0.3, 0.1], mid: [0.45, 0.13], shallow: [0.62, 0.11], foam: [0.85, 0.04] }),
    ramp("forest", 145, { dark: [0.38, 0.1], canopy: [0.52, 0.14], meadow: [0.68, 0.13], dry: [0.8, 0.1] }),
    ramp("desert", 75, { shadow: [0.55, 0.08], sand: [0.72, 0.1], bright: [0.84, 0.09], pale: [0.92, 0.05] }),
    ramp("mountain", 55, { rock: [0.4, 0.04], scree: [0.55, 0.03], bare: [0.7, 0.02], snow: [0.95, 0.01] }),
    ramp("mars", 32, { basalt: [0.32, 0.06], rust: [0.48, 0.12], ochre: [0.62, 0.11], dust: [0.78, 0.06] }),
    ramp("ice", 262, { deep: [0.42, 0.09], glacier: [0.6, 0.1], frost: [0.78, 0.07], rime: [0.92, 0.03] }),
    ramp("dusk", 305, { shadow: [0.34, 0.1], heather: [0.5, 0.14], glow: [0.66, 0.13], haze: [0.82, 0.08] }),
];

// ── orbit model ──
// Letter → its lettered V canonical [d, r], read from the assignments dict
// (default mirrors assignments.json; no fetch needed for the 12 names).
function lettersToCanon() {
    const out = {};
    for (const [k, val] of Object.entries(getWorkingAssignments())) {
        if (!/^V[0-7][0-7]$/.test(k)) continue;
        out[val.replace(/[^A-Za-z]/g, "")] = [+k[1], +k[2]];
    }
    return out;
}

const keyStr = (d, r) => d + "," + r;
const patternKeys = (d, r, sen) => {
    const { v, h } = computePattern(d, r, sen);
    return Array.from({ length: 8 }, (_, t) => transformedPatternKey(v, h, t));
};

// One entry per orbit: { letter, rep:[d,r], keys:[8] } where rep is an orbit
// member that has a translation rule (so the relatives panels always resolve);
// keys[ti] is the pattern key of the rep transformed by D4 element ti.
const ORBITS = (() => {
    const canon = lettersToCanon();
    const classes = classifyVisualD4(V);
    const list = [];
    for (const [letter, [cd, cr]] of Object.entries(canon)) {
        const cls = classes.find((c) =>
            c.orbit.some(([d, r]) => d === cd && r === cr),
        );
        const sorted = [...cls.orbit].sort(
            (a, b) => pairKey(a[0], a[1]) - pairKey(b[0], b[1]),
        );
        const rep =
            sorted.find(([d, r]) => TRANSLATION_V[keyStr(d, r)]) || sorted[0];
        list.push({ letter, rep, keys: patternKeys(rep[0], rep[1], V) });
    }
    return list;
})();

export const LETTERS = ORBITS.map((o) => o.letter);

// Resolve any glyph (grid "V"/"H", code d,r) to { orbit, ti } where ti is the
// D4 element taking the orbit's rep pattern to this glyph's pattern. null if the
// glyph is outside the 12-orbit alphabet (shouldn't happen on the anchor).
function resolve(grid, d, r) {
    const key = transformedPatternKey(
        ...(() => {
            const p = computePattern(d, r, grid === "H" ? H : V);
            return [p.v, p.h, 0];
        })(),
    );
    for (const orbit of ORBITS) {
        const ti = orbit.keys.indexOf(key);
        if (ti >= 0) return { orbit, ti };
    }
    return null;
}

// ── palette: letter → 16 cell colors (null = unpainted), against the rep frame ──
const palette = {};
for (const L of LETTERS) palette[L] = Array(16).fill(null);

export function orbitByLetter(letter) {
    return ORBITS.find((o) => o.letter === letter);
}

// The 16 derived cell colors for any glyph, from its orbit's stored canonical.
export function cellsFor(grid, d, r) {
    const res = resolve(grid, d, r);
    if (!res) return Array(16).fill(null);
    const canon = palette[res.orbit.letter];
    const perm = CELL_PERM[res.ti];
    const out = Array(16).fill(null);
    for (let c = 0; c < 16; c++) out[perm[c]] = canon[c];
    return out;
}

// Paint (or clear, color=null) cell `idx` of a displayed glyph — maps back
// through the D4 element to the orbit's canonical cell, so every occurrence and
// every sibling re-derives. Returns the affected letter (or null).
export function paintCell(grid, d, r, idx, color) {
    const res = resolve(grid, d, r);
    if (!res) return null;
    const canonCell = CELL_PERM[res.ti].indexOf(idx);
    palette[res.orbit.letter][canonCell] = color;
    return res.orbit.letter;
}

export function matricesFor(grid, d, r) {
    return computeGlyphMatrices(d, r, grid === "H" ? H : V);
}

// ── relatives of an orbit's display rep ──
export function focusGlyph(letter) {
    const [d, r] = orbitByLetter(letter).rep;
    return { grid: "V", d, r };
}
export function substitutionsOf(letter) {
    const [d, r] = orbitByLetter(letter).rep;
    const rule = V_TO_H[keyStr(d, r)];
    if (!rule) return [];
    return rule.pair.map(([cd, cr]) => ({ grid: "H", d: cd, r: cr }));
}
export function translationsOf(letter) {
    const [d, r] = orbitByLetter(letter).rep;
    const rule = TRANSLATION_V[keyStr(d, r)];
    if (!rule) return [];
    return rule.children.map(([cd, cr]) => ({ grid: "V", d: cd, r: cr }));
}

// ── universe patch (clean anchor V map), sectioned into glyphs ──
export function mapPatch(cells = 64) {
    const { codes, NSr, NSc } = getSectionData(cells, cells, V);
    return { codes, NSr, NSc };
}

// ── scheme IO ──
export function serialize(name = "scheme") {
    const orbits = {};
    for (const o of ORBITS) {
        orbits[o.letter] = {
            canonicalCode: keyStr(o.rep[0], o.rep[1]),
            cells: palette[o.letter].slice(),
        };
    }
    return { name, orbits };
}
export function loadScheme(data) {
    for (const L of LETTERS) palette[L] = Array(16).fill(null);
    if (!data || !data.orbits) return;
    for (const [L, entry] of Object.entries(data.orbits)) {
        if (palette[L] && Array.isArray(entry.cells))
            palette[L] = entry.cells.slice(0, 16);
    }
}
