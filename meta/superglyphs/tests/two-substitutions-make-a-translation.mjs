// ════════════════════════════════════════════════════════════════════════
//  superglyphs/tests — two-substitutions-make-a-translation.mjs
// ════════════════════════════════════════════════════════════════════════
//
//  THE CLAIM (Jake's genealogy identity)
//  A translation (the 4→1 step) factors into two seniority-FLIPPING
//  substitutions:
//
//      V-glyph --V→H sub--> (H_left, H_right)            [1 V → 2 H]
//      each H  --H→V sub--> (V_top,  V_bottom)           [1 H → 2 V]
//      ─────────────────────────────────────────────
//      net:    one V-glyph  →  four V-glyphs  =  translation
//
//  The middle layer is H glyphs ("the substitution involving h"). Doing V→H
//  then H→V and landing back in V is one whole cage level. So two
//  substitutions = one translation. This test proves it.
//
//  WHY IT'S NOT TRIVIAL
//  The four output codes are literally read from the same order-6 map either
//  way, so "the grids match" proves nothing. The CONTENT is that each
//  half-step is a *function of the glyph code alone*: the H pair depends only
//  on the V parent's code (not where it sits), and the V pair depends only on
//  the H code. If that holds, the two rule TABLES compose into the direct
//  translation table — that is the real statement.
//
//  HOW THE INTERMEDIATE IS BUILT (mirrors glyphs/glyphs.js buildSubstitutionRules)
//    o5  = getSectionData(32, 32, V)   8×8  sections — the parent V map
//    o5h = getSectionData(32, 64, H)   8×16 sections — H intermediate
//          (double columns, HORIZONTAL seniority = r[0]=true seed)
//    o6  = getSectionData(64, 64, V)   16×16 sections — the child V map
//  getSectionData uses the canonical clean single-arrow seed at offset 0/0,
//  i.e. the anchor fixed-point map — which is exactly where genealogy lives.
//
//  Run:  node meta/superglyphs/tests/two-substitutions-make-a-translation.mjs

import { Seniority } from "../../../coylean-explorer/coylean-core.js";
import { getSectionData } from "../../../glyphs/glyph-core.js";

const V = Seniority.vertical();
const H = Seniority.horizontal();

const codeKey = (c) => c[0] + "," + c[1];

// Build the three section grids once.
const o5 = getSectionData(32, 32, V); //  8×8  parent V
const o5h = getSectionData(32, 64, H); //  8×16 intermediate H
const o6 = getSectionData(64, 64, V); // 16×16 child  V

// ── Generic "is this map a function of the key code?" builder ────────────
// Walks a parent grid, derives (childKey) for each cell via `childOf`, and
// records parentCode → childKey. A second occurrence of the same parent code
// with a different child is a conflict (⇒ the rule is NOT a function of the
// code). Returns the table plus the conflict list.
function buildRuleTable(label, rows, cols, parentCodeAt, childOf) {
    const table = new Map(); // parentCode → childKey
    const conflicts = [];
    for (let sr = 0; sr < rows; sr++) {
        for (let sc = 0; sc < cols; sc++) {
            const pk = parentCodeAt(sr, sc);
            const ck = childOf(sr, sc);
            if (ck === null) continue; // out of the child grid's covered region
            if (table.has(pk)) {
                if (table.get(pk) !== ck)
                    conflicts.push({ pk, want: table.get(pk), got: ck });
            } else {
                table.set(pk, ck);
            }
        }
    }
    console.log(
        `  ${label}: ${table.size} distinct codes, ${conflicts.length} conflicts`,
    );
    return { table, conflicts };
}

// ── (1) V→H substitution: V code → (H_left, H_right) ─────────────────────
// Parent V section (sr,sc) in o5 (8×8) → H pair at o5h (sr,2sc) & (sr,2sc+1).
const vToH = buildRuleTable(
    "V→H  (1 V → left/right H pair)",
    8, 8,
    (sr, sc) => codeKey(o5.codes[sr][sc]),
    (sr, sc) =>
        codeKey(o5h.codes[sr][2 * sc]) + "|" + codeKey(o5h.codes[sr][2 * sc + 1]),
);

// ── (2) H→V substitution: H code → (V_top, V_bottom) ─────────────────────
// H section (sr,sc) in o5h (8×16) → V pair at o6 (2sr,sc) & (2sr+1,sc).
const hToV = buildRuleTable(
    "H→V  (1 H → top/bottom V pair)",
    8, 16,
    (sr, sc) => codeKey(o5h.codes[sr][sc]),
    (sr, sc) =>
        codeKey(o6.codes[2 * sr][sc]) + "|" + codeKey(o6.codes[2 * sr + 1][sc]),
);

// ── (3) Compose the two RULE TABLES and compare to direct translation ────
// For each reachable V parent code: look up its H pair (vToH), then expand
// each H via hToV, assembling the 2×2 [NW,NE,SW,SE]. Compare that to the
// DIRECT translation read straight from o5→o6. Equality here means the
// genealogy identity holds at the level of code rules, not just grids.
function directTranslation(sr, sc) {
    const r = 2 * sr, c = 2 * sc;
    return [
        codeKey(o6.codes[r][c]), // NW
        codeKey(o6.codes[r][c + 1]), // NE
        codeKey(o6.codes[r + 1][c]), // SW
        codeKey(o6.codes[r + 1][c + 1]), // SE
    ].join("|");
}

let composeChecked = 0;
let composeMismatch = 0;
let composeUnreachable = 0;
const seenParent = new Set();
for (let sr = 0; sr < 8; sr++) {
    for (let sc = 0; sc < 8; sc++) {
        const pk = codeKey(o5.codes[sr][sc]);
        if (seenParent.has(pk)) continue; // one check per distinct code
        seenParent.add(pk);

        const hPair = vToH.table.get(pk);
        if (!hPair) { composeUnreachable++; continue; }
        const [hL, hR] = hPair.split("|");
        const left = hToV.table.get(hL); // (NW, SW)
        const right = hToV.table.get(hR); // (NE, SE)
        if (!left || !right) { composeUnreachable++; continue; }
        const [nw, sw] = left.split("|");
        const [ne, se] = right.split("|");

        const composed = [nw, ne, sw, se].join("|");
        const direct = directTranslation(sr, sc);
        composeChecked++;
        if (composed !== direct) {
            composeMismatch++;
            if (composeMismatch <= 3) {
                console.log(`    MISMATCH parent ${pk}`);
                console.log(`      composed V→H→V: ${composed}`);
                console.log(`      direct   V→V  : ${direct}`);
            }
        }
    }
}
console.log(
    `  compose V→H→V vs direct translation: ` +
    `${composeChecked} codes checked, ${composeMismatch} mismatches` +
    (composeUnreachable ? `, ${composeUnreachable} skipped (no rule)` : ""),
);

// ── Verdict ──────────────────────────────────────────────────────────────
const ok =
    vToH.conflicts.length === 0 &&
    hToV.conflicts.length === 0 &&
    composeMismatch === 0 &&
    composeChecked > 0;
console.log(
    ok
        ? "\nPASS — two substitutions (V→H then H→V) make a translation.\n"
        : "\nFAIL — the factorization does not hold as a code rule.\n",
);
process.exit(ok ? 0 : 1);
