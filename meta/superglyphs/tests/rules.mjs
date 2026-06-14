// ════════════════════════════════════════════════════════════════════════
//  superglyphs/tests — rules.mjs   (the substitution rules, as JS objects)
// ════════════════════════════════════════════════════════════════════════
//
//  PURPOSE
//  One readable home for the three rules the genealogy runs on, encapsulated
//  as plain dictionaries keyed by a glyph code "d,r" (downCode,rightCode):
//
//    TRANSLATION_V / TRANSLATION_H   4→1 step: a glyph → its 2×2 children + bars
//    V_TO_H                          half-step: a V glyph → left/right H pair
//    H_TO_V                          half-step: an H glyph → top/bottom V pair
//
//  They are DERIVED from the engine at import time (the canonical clean-seed
//  map via getSectionData — the anchor fixed point), not hand-transcribed, so
//  they can never drift from the propagation. But once built they're ordinary
//  objects you can read, log, and apply by lookup — which is what lets scale-up
//  skip re-propagating big maps.
//
//  OBJECT SHAPES
//    TRANSLATION_*[ "d,r" ] = {
//        children: [ [d,r], [d,r], [d,r], [d,r] ],   // NW, NE, SW, SE
//        bars: { vTop, vBot, hLeft, hRight },         // the 4 internal separators
//    }
//    V_TO_H[ "d,r" ] = { pair: [ [d,r]_left,  [d,r]_right  ], bar }  // bar = ┃
//    H_TO_V[ "d,r" ] = { pair: [ [d,r]_top,   [d,r]_bottom ], bar }  // bar = ━
//
//  Run `node rules.mjs` to print all three tables as a human-readable reference.

import { Seniority } from "coylean/core";
import {
    getSectionData,
    classifyVisualD4,
} from "../../../glyphs/glyph-core.js";

const V = Seniority.vertical();
const H = Seniority.horizontal();

export const codeKey = (c) => c[0] + "," + c[1];
export const parseCode = (k) => k.split(",").map(Number);

// ── TRANSLATION (4→1) ────────────────────────────────────────────────────
// Build the parent → 2×2 children + bars table for one seniority. The reachable
// alphabet is 35 codes, but a code only earns a rule when it appears as a
// PARENT. The 35th code first shows up at order 7, so we must ingest one level
// deeper than that (7→8) for the table to be CLOSED — every code that can occur
// in a scaled-up map has a rule. (Ingest orders 5→6→7→8; first sighting wins,
// and on the anchor the rule is a function of the code so later sightings
// agree.) Stop short of this and scaling past order 7 hits ruleless cells.
function buildTranslation(sen) {
    const orders = [32, 64, 128, 256].map((n) => getSectionData(n, n, sen));
    const table = {};
    const ingest = (parent, child) => {
        for (let sr = 0; sr < parent.NSr; sr++) {
            for (let sc = 0; sc < parent.NSc; sc++) {
                const k = codeKey(parent.codes[sr][sc]);
                if (table[k]) continue;
                const r = 2 * sr, c = 2 * sc;
                table[k] = {
                    children: [
                        [...child.codes[r][c]],
                        [...child.codes[r][c + 1]],
                        [...child.codes[r + 1][c]],
                        [...child.codes[r + 1][c + 1]],
                    ],
                    bars: {
                        vTop: child.vBound[r][c],
                        vBot: child.vBound[r + 1][c],
                        hLeft: child.hBound[r][c],
                        hRight: child.hBound[r][c + 1],
                    },
                };
            }
        }
    };
    for (let i = 0; i + 1 < orders.length; i++) ingest(orders[i], orders[i + 1]);
    return table;
}

export const TRANSLATION_V = buildTranslation(V);
export const TRANSLATION_H = buildTranslation(H);

// ── HALF-STEPS (1→2, seniority-flipping) ──────────────────────────────────
// V→H reads the wide H intermediate (double columns, H seniority): a V cell
// (sr,sc) → H pair (sr,2sc),(sr,2sc+1), separated by a vertical bar.
// H→V reads the next V order (double rows, V seniority): an H cell (sr,sc) →
// V pair (2sr,sc),(2sr+1,sc), separated by a horizontal bar.
// Derived at order 6 so the alphabet is complete.
function buildVToH(order) {
    const v = getSectionData(1 << order, 1 << order, V);
    const h = getSectionData(1 << order, 1 << (order + 1), H);
    const table = {};
    for (let sr = 0; sr < v.NSr; sr++)
        for (let sc = 0; sc < v.NSc; sc++) {
            const k = codeKey(v.codes[sr][sc]);
            if (table[k]) continue;
            table[k] = {
                pair: [[...h.codes[sr][2 * sc]], [...h.codes[sr][2 * sc + 1]]],
                bar: h.vBound[sr][2 * sc],
            };
        }
    return table;
}
function buildHToV(order) {
    const h = getSectionData(1 << order, 1 << (order + 1), H);
    const vNext = getSectionData(1 << (order + 1), 1 << (order + 1), V);
    const table = {};
    for (let sr = 0; sr < h.NSr; sr++)
        for (let sc = 0; sc < h.NSc; sc++) {
            const k = codeKey(h.codes[sr][sc]);
            if (table[k]) continue;
            table[k] = {
                pair: [[...vNext.codes[2 * sr][sc]], [...vNext.codes[2 * sr + 1][sc]]],
                bar: vNext.hBound[2 * sr][sc],
            };
        }
    return table;
}

// Built at order 7 so the V parent alphabet is the full closed set (35 codes),
// matching TRANSLATION_*; order 6 alone misses the late-appearing 35th code.
export const V_TO_H = buildVToH(7);
export const H_TO_V = buildHToV(7);

// ── Alphabet / orbits ─────────────────────────────────────────────────────
// code "d,r" → its D4 orbit id (for the current seniority). Two glyphs in the
// same orbit are the same shape up to rotation/reflection; the reachable
// alphabet on the anchor is 12 V orbits (35 codes) — the genealogy's letters.
function orbitMap(sen) {
    const m = {};
    classifyVisualD4(sen).forEach((cls, id) =>
        cls.orbit.forEach(([d, r]) => (m[d + "," + r] = id)),
    );
    return m;
}
export const ORBIT_V = orbitMap(V);
export const ORBIT_H = orbitMap(H);

// ── Applying the translation rule: one map → one cage level deeper ────────
// A "map" here is { codes, vBound, hBound, ns } of ns×ns sections (square),
// exactly getSectionData's shape (with ns = NSr). Returns the doubled map by
// stamping each cell's 2×2 children + internal bars from the table, then
// inheriting the inter-section bars to the child grid. Pure lookup — no
// propagation — which is the whole point of having the table.
export function expandTranslation(map, table = TRANSLATION_V) {
    const { codes, vBound, hBound, ns } = map;
    const ns2 = ns * 2;
    const blank2d = (fill) =>
        Array.from({ length: ns2 }, () => Array.from({ length: ns2 }, fill));
    const newCodes = blank2d(() => [0, 0]);
    const newVB = blank2d(() => false);
    const newHB = blank2d(() => false);

    for (let sr = 0; sr < ns; sr++) {
        for (let sc = 0; sc < ns; sc++) {
            const rule = table[codeKey(codes[sr][sc])];
            if (!rule) continue; // unreached code (shouldn't happen on anchor)
            const r = 2 * sr, c = 2 * sc;
            newCodes[r][c] = [...rule.children[0]];
            newCodes[r][c + 1] = [...rule.children[1]];
            newCodes[r + 1][c] = [...rule.children[2]];
            newCodes[r + 1][c + 1] = [...rule.children[3]];
            if (rule.bars.vTop) newVB[r][c] = true;
            if (rule.bars.vBot) newVB[r + 1][c] = true;
            if (rule.bars.hLeft) newHB[r][c] = true;
            if (rule.bars.hRight) newHB[r][c + 1] = true;
        }
    }
    // Inherit the bars that ran BETWEEN parent sections into the child grid.
    for (let sr = 0; sr < ns; sr++)
        for (let sc = 0; sc < ns - 1; sc++)
            if (vBound[sr][sc]) {
                newVB[2 * sr][2 * sc + 1] = true;
                newVB[2 * sr + 1][2 * sc + 1] = true;
            }
    for (let sr = 0; sr < ns - 1; sr++)
        for (let sc = 0; sc < ns; sc++)
            if (hBound[sr][sc]) {
                newHB[2 * sr + 1][2 * sc] = true;
                newHB[2 * sr + 1][2 * sc + 1] = true;
            }
    return { codes: newCodes, vBound: newVB, hBound: newHB, ns: ns2 };
}

// ── Readable reference dump (node rules.mjs) ──────────────────────────────
function show2x2(rule) {
    const [nw, ne, sw, se] = rule.children.map(codeKey);
    const vb = (b) => (b ? "┃" : " ");
    const hb = (b) => (b ? "━━" : "  ");
    // Two rows of the 2×2 with the internal separators drawn between cells.
    return (
        `${nw.padStart(3)} ${vb(rule.bars.vTop)} ${ne.padStart(3)}` +
        `   |   ${sw.padStart(3)} ${vb(rule.bars.vBot)} ${se.padStart(3)}` +
        `   [h ${hb(rule.bars.hLeft)}/${hb(rule.bars.hRight)}]`
    );
}
function dumpTranslation(name, table, orbits) {
    const keys = Object.keys(table).sort(
        (a, b) => (orbits[a] ?? 99) - (orbits[b] ?? 99),
    );
    console.log(`\n${name}  (${keys.length} codes)`);
    console.log("  parent →  NW vTop NE  |  SW vBot SE   [hLeft/hRight]");
    for (const k of keys)
        console.log(`  ${k.padStart(3)} → ${show2x2(table[k])}   orbit ${orbits[k]}`);
}
function dumpHalf(name, table, sep) {
    const keys = Object.keys(table).sort();
    console.log(`\n${name}  (${keys.length} codes)   bar = ${sep}`);
    for (const k of keys) {
        const [a, b] = table[k].pair.map(codeKey);
        console.log(
            `  ${k.padStart(3)} → ${a.padStart(3)} ${table[k].bar ? sep : " "} ${b.padStart(3)}`,
        );
    }
}

if (
    typeof process !== "undefined" &&
    process.argv &&
    import.meta.url === `file://${process.argv[1]}`
) {
    console.log("Coylean superglyph rules — readable reference");
    dumpTranslation("TRANSLATION_V", TRANSLATION_V, ORBIT_V);
    dumpHalf("V_TO_H (V → left/right H)", V_TO_H, "┃");
    dumpHalf("H_TO_V (H → top/bottom V)", H_TO_V, "━");
    const reachableVOrbits = new Set(
        Object.keys(TRANSLATION_V).map((k) => ORBIT_V[k]),
    ).size;
    console.log(
        `\nalphabet (reachable on the anchor): ` +
        `${Object.keys(TRANSLATION_V).length} V codes / ${reachableVOrbits} ` +
        `V orbits, ${Object.keys(TRANSLATION_H).length} H codes.`,
    );
}
