// ════════════════════════════════════════════════════════════════════════
//  superglyphs/tests — translation-is-a-function.mjs
// ════════════════════════════════════════════════════════════════════════
//
//  WHAT THIS CHECKS
//  The genealogy story rests on one bedrock claim: TRANSLATION (the 4→1
//  step, parent cage → its 2×2 children) is a *function of the parent glyph
//  code alone* — but only on the anchor family (lat/long ∈ {0,1}). This test
//  reproduces that from scratch, standalone, so every later factorization
//  test (V-sub ∘ H-sub = translation) has a verified floor to stand on.
//
//  HOW A TEST WORKS (the part worth learning)
//  These are plain Node ES modules — no test framework, no browser. You
//  `import` the SAME pure math the web pages use (`glyph-core.js`, which is
//  DOM-free on purpose) and assert against it in process. Run with:
//
//      node meta/superglyphs/tests/translation-is-a-function.mjs
//
//  The pattern, top to bottom:
//    1. import the pure layer (core engine + glyph-core model);
//    2. write small helpers that pull the quantity you care about out of the
//       model (here: the per-cage glyph codes from `computeMapModel`);
//    3. assert a property and print a one-line PASS/FAIL per case;
//    4. exit non-zero if anything failed, so CI / a shell `&&` chain notices.
//  No mocks: the engine is deterministic, so "truth" is just running it.
//
//  KEY OBJECTS
//    computeMapModel(Nr, Nc, {seniority})  → the real propagated map, sectioned
//        into 4×4 cages. `.secCodes[sr][sc] = [downCode, rightCode]` is the
//        glyph living in cage (sr, sc). Doubling the order (N → 2N) refines
//        every cage into a 2×2 block of children: parent (sr, sc) ↦ children
//        (2sr+i, 2sc+j), i,j ∈ {0,1}. THAT 2×2 map is "translation".
//    setOffset(long, lat)  → moves the dyadic location of the map (longitude =
//        hInitCol E–W, latitude = vInitRow N–S). 1/1 is the clean anchor.

import { Seniority } from "../../../coylean-explorer/coylean-core.js";
import { computeMapModel, setOffset } from "../../../glyphs/glyph-core.js";

// A glyph code [downCode, rightCode] as a stable string key.
const codeKey = (c) => c[0] + "," + c[1];

// The four children of parent cage (sr, sc), read out of the order-2N model
// `c`, packed into one string so two parents' children compare with ===.
// Order: NW | NE | SW | SE — the same 2×2 layout the substitution table uses.
function childrenKey(c, sr, sc) {
    const r = sr * 2;
    const col = sc * 2;
    return (
        codeKey(c.secCodes[r][col]) + "|" +
        codeKey(c.secCodes[r][col + 1]) + "|" +
        codeKey(c.secCodes[r + 1][col]) + "|" +
        codeKey(c.secCodes[r + 1][col + 1])
    );
}

// Is the 4→1 translation a function of the parent code at the current offset?
// We scan every parent cage in the order-N map, look up its 2×2 children in
// the order-2N map, and record parentCode → childrenKey. If the SAME parent
// code ever maps to two different children blocks, translation is NOT a
// function of the code (it depends on position) — that's a conflict.
function translationIsFunctionOfCode(N) {
    const parent = computeMapModel(N, N, { seniority: Seniority.vertical() });
    const child = computeMapModel(2 * N, 2 * N, { seniority: Seniority.vertical() });

    // Only scan the region the child grid actually covers two-deep.
    const rows = Math.min(parent.NSr, Math.floor(child.NSc / 2));
    const cols = Math.min(parent.NSc, Math.floor(child.NSc / 2));

    const seen = new Map(); // parentCode → childrenKey
    const conflicts = [];
    for (let sr = 0; sr < rows; sr++) {
        for (let sc = 0; sc < cols; sc++) {
            const pk = codeKey(parent.secCodes[sr][sc]);
            const ck = childrenKey(child, sr, sc);
            if (seen.has(pk)) {
                if (seen.get(pk) !== ck)
                    conflicts.push({ pk, expected: seen.get(pk), found: ck });
            } else {
                seen.set(pk, ck);
            }
        }
    }
    return { distinctCodes: seen.size, conflicts };
}

// ── Run the cases ───────────────────────────────────────────────────────
// `expectFn` says whether this offset SHOULD be conflict-free. On the anchor
// it must be; off the anchor we EXPECT conflicts (that asymmetry is the whole
// point — translation only behaves like an alphabet on the anchor family).
let failures = 0;
function runCase(long, lat, anchor, orders) {
    setOffset(long, lat);
    for (const N of orders) {
        const { distinctCodes, conflicts } = translationIsFunctionOfCode(N);
        const cleanWanted = anchor;
        const isClean = conflicts.length === 0;
        const pass = isClean === cleanWanted;
        if (!pass) failures++;
        const tag = pass ? "PASS" : "FAIL";
        const verdict = anchor
            ? `${conflicts.length} conflicts (want 0)`
            : `${conflicts.length} conflicts (want >0, off-anchor)`;
        console.log(
            `  [${tag}] ${long}/${lat} ${anchor ? "anchor  " : "off-anchr"} ` +
            `${String(N).padStart(3)}→${2 * N}: ` +
            `${String(distinctCodes).padStart(2)} codes, ${verdict}`,
        );
    }
    setOffset(1, 1); // always leave the shared offset clean for the next case
}

console.log("Translation (4→1) as a function of the parent glyph code");
console.log("  anchor 1/1 must be conflict-free; off-anchor must conflict\n");

console.log("Anchor (clean baseline 1/1):");
runCase(1, 1, true, [8, 16, 32, 64]);

console.log("\nOff-anchor (translation stops being a code function):");
runCase(2, 2, false, [16, 32]);
runCase(5, 3, false, [16, 32]);

console.log(
    failures === 0
        ? "\nALL PASS — bedrock holds: translation is anchor-local.\n"
        : `\n${failures} FAILED — bedrock assumption is wrong, stop here.\n`,
);
process.exit(failures === 0 ? 0 : 1);
