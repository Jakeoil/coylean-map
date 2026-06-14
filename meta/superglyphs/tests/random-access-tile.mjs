// ════════════════════════════════════════════════════════════════════════
//  superglyphs/tests — random-access-tile.mjs
// ════════════════════════════════════════════════════════════════════════
//
//  THE BIG-MAP PAYOFF (anchor offsets only)
//  At an anchor offset the whole map is a substitution fixed point, so a
//  section's glyph is a pure function of its DYADIC ADDRESS. You can compute
//  the glyph at any (row, col) section of an order-M map by descending the
//  translation table from the root — O(M) table lookups — touching NONE of its
//  neighbours and propagating NOTHING.
//
//  Why that matters for meta/big-map: the lazy scaffold builds blocks in an
//  SE-march, so block (k1,k2) must wait for (k1-1,k2) and (k1,k2-1) — panning
//  to a far region drags in the whole upstream chain (the "nextReadyAncestor
//  walks back O(L)" cost in NOTES_lazy_scaffold.md). Substitution replaces that
//  with random access: jump straight to the visible tile in O(depth), seeded
//  from one tiny root. No seam chain, no propagation. (Section glyph → its 4×4
//  cell arrows via the catalog's per-glyph render, so full detail is kept.)
//
//  HARD LIMIT: this only holds where translation is a function of the code —
//  the anchor family lat/long ∈ {0,1}. Off-anchor the cage walls break
//  (bars.mjs) and you must propagate (or use the offset-specific tromino rule).
//  The four quadrants of the canonical universe all sit at anchor offsets
//  (NW 0/0, NE 1/0, SW 0/1, SE 1/1), so the whole default view qualifies.
//
//  Run:  node meta/superglyphs/tests/random-access-tile.mjs

import { Seniority } from "coylean/core";
import { getSectionData } from "coylean/glyphs";
import { TRANSLATION_V, codeKey } from "./rules.mjs";

const V = Seniority.vertical();

// The root: the single top-left section of the clean map (order 2 = 1 section).
const ROOT_ORDER = 2;
const root = getSectionData(1 << ROOT_ORDER, 1 << ROOT_ORDER, V).codes[0][0];

// Glyph at section (R, C) of an order-M map, by address descent from the root.
// The top (M-ROOT_ORDER) bits of R,C choose the path through the 2×2 children
// at each level: child index = rowBit*2 + colBit (children = [NW,NE,SW,SE]).
// O(M) lookups, no neighbours, no propagation.
function tileGlyph(R, C, M) {
    let code = root; // root section spans the whole map; descend into it
    for (let level = M - ROOT_ORDER - 1; level >= 0; level--) {
        const rb = (R >> level) & 1;
        const cb = (C >> level) & 1;
        const rule = TRANSLATION_V[codeKey(code)];
        code = rule.children[rb * 2 + cb];
    }
    return code;
}

// ── (1) Full check: every section at order 8 by descent == truth ─────────
function fullCheck(M) {
    const truth = getSectionData(1 << M, 1 << M, V);
    const ns = truth.NSr;
    let bad = 0;
    for (let R = 0; R < ns; R++)
        for (let C = 0; C < ns; C++)
            if (codeKey(tileGlyph(R, C, M)) !== codeKey(truth.codes[R][C])) bad++;
    console.log(
        `  full order ${M}: ${ns}×${ns} sections by address descent, ${bad} wrong`,
    );
    return bad === 0;
}

// ── (2) Random-access spot checks at order 10 (truth still affordable) ───
function spotCheck(M, picks) {
    const truth = getSectionData(1 << M, 1 << M, V);
    const ns = truth.NSr;
    let bad = 0;
    for (const [R, C] of picks) {
        const got = codeKey(tileGlyph(R % ns, C % ns, M));
        const want = codeKey(truth.codes[R % ns][C % ns]);
        if (got !== want) bad++;
    }
    console.log(
        `  spot order ${M}: ${picks.length} scattered tiles, ${bad} wrong ` +
        `(each found in ${M - ROOT_ORDER} lookups, no propagation)`,
    );
    return bad === 0;
}

// ── (3) Demonstrate a tile FAR beyond what propagation would build ───────
// Order 30 = a ~10⁹ × 10⁹-cell map. Propagating it is hopeless; a single tile
// is 28 lookups. (No truth to check against — the point is it's instant.)
function deepTile(M, R, C) {
    const t0 = process.hrtime.bigint();
    const code = tileGlyph(R, C, M);
    const us = Number(process.hrtime.bigint() - t0) / 1000;
    console.log(
        `  deep order ${M} (≈2^${M}=${(2 ** M).toExponential(1)} cells/side): ` +
        `section (${R},${C}) = glyph ${codeKey(code)} in ${(M - ROOT_ORDER)} ` +
        `lookups / ${us.toFixed(1)}µs`,
    );
}

console.log("Random-access tile generation by substitution (anchor only):\n");
const ok1 = fullCheck(8);
const ok2 = spotCheck(10, [
    [3, 5], [100, 7], [255, 255], [17, 240], [128, 128], [1, 1023],
]);
deepTile(30, 123456789, 987654321);

console.log(
    ok1 && ok2
        ? "\nPASS — any tile is reachable by O(order) lookups, matching truth," +
          "\nso big-map can skip propagation + the seam chain at anchor offsets.\n"
        : "\nFAIL — address descent disagreed with propagation.\n",
);
process.exit(ok1 && ok2 ? 0 : 1);
