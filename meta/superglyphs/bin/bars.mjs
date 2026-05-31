// ════════════════════════════════════════════════════════════════════════
//  superglyphs/bin — bars.mjs   (what the separators are, and the anchor magic)
// ════════════════════════════════════════════════════════════════════════
//
//  A "bar" is the separator segment between two sub-glyphs of a substitution —
//  i.e. a CAGE WALL: a high-priority line dividing one cage into children.
//  Jake's hunch: the bars are "the magic the anchor points have." This probes
//  it two ways.
//
//  PART A — bars factor exactly (resolves the open question, on the anchor).
//  The 2×2 of a translation has four internal separators:
//        NW │vTop│ NE
//        ───hLeft──┼──hRight───   (─ = horizontal wall, │ = vertical wall)
//        SW │vBot│ SE
//  The V→H→V factorization predicts: v→h cuts ONE vertical wall (so vTop=vBot=
//  the v→h bar), then h→v cuts the two horizontal walls INDEPENDENTLY inside
//  each H half (hLeft = h→v bar of H_left, hRight = h→v bar of H_right). We
//  check that against TRANSLATION_V's actual bars.
//
//  PART B — is the unbroken vertical wall an ANCHOR property?
//  On the anchor every parent cage's vertical wall is unbroken (vTop=vBot) AND
//  determined by the parent code. Off the anchor, translation stops being a
//  function of the code — so do the WALLS break / stop being code-determined?
//  We read the section walls straight from the propagation at several offsets
//  and count broken vertical walls + walls that the same parent code splits
//  inconsistently.
//
//  Run:  node meta/superglyphs/bin/bars.mjs

import { Seniority } from "../../../coylean-explorer/coylean-core.js";
import { computeMapModel, setOffset } from "../../../glyphs/glyph-core.js";
import {
    TRANSLATION_V,
    V_TO_H,
    H_TO_V,
    codeKey,
} from "./rules.mjs";

// ── PART A : bars factor through the half-steps (anchor) ─────────────────
function partA() {
    let ok = 0, bad = 0, vUnbroken = 0;
    for (const k of Object.keys(TRANSLATION_V)) {
        const { vTop, vBot, hLeft, hRight } = TRANSLATION_V[k].bars;
        if (vTop === vBot) vUnbroken++;
        const vh = V_TO_H[k];
        const [hl, hr] = vh.pair.map(codeKey);
        const hvL = H_TO_V[hl], hvR = H_TO_V[hr];
        const good =
            vTop === vh.bar && vBot === vh.bar && // one vertical wall, doubled
            hLeft === hvL.bar && hRight === hvR.bar; // two independent h walls
        if (good) ok++; else bad++;
    }
    const n = Object.keys(TRANSLATION_V).length;
    console.log("PART A — bars factor through V→H→V (anchor):");
    console.log(`  vertical wall unbroken (vTop=vBot): ${vUnbroken}/${n}`);
    console.log(`  bars recovered from half-steps:     ${ok}/${n}` +
        (bad ? `  (${bad} FAIL)` : "  ✓"));
    return bad === 0 && vUnbroken === n;
}

// ── Section walls straight from a propagated map ─────────────────────────
// vWall[sr][sc] = a vertical wall on section (sr,sc)'s east edge (between it and
// (sr,sc+1)); hWall = a horizontal wall on its south edge. Mirrors getSection-
// Data / sectionsFromPropagation, reading computeMapModel's matrices so it
// works at ANY dyadic offset (cages sit on the firstDark-shifted lattice).
function sectionWalls(model) {
    const { downMatrix, rightMatrix, firstDarkRow, firstDarkCol, NSr, NSc, SEC } =
        model;
    const originRow = firstDarkRow + 1, originCol = firstDarkCol + 1;
    const vWall = Array.from({ length: NSr }, () => Array(NSc).fill(false));
    const hWall = Array.from({ length: NSr }, () => Array(NSc).fill(false));
    for (let sr = 0; sr < NSr; sr++) {
        for (let sc = 0; sc < NSc; sc++) {
            const y0 = originRow + sr * SEC, x0 = originCol + sc * SEC;
            if (sc < NSc - 1) {
                const xExit = x0 + SEC - 1;
                for (let i = 0; i < SEC; i++)
                    if (downMatrix[y0 + i] && downMatrix[y0 + i][xExit]) {
                        vWall[sr][sc] = true;
                        break;
                    }
            }
            if (sr < NSr - 1) {
                const yExit = y0 + SEC - 1;
                for (let i = 0; i < SEC; i++)
                    if (rightMatrix[x0 + i] && rightMatrix[x0 + i][yExit]) {
                        hWall[sr][sc] = true;
                        break;
                    }
            }
        }
    }
    return { vWall, hWall };
}

// For each PARENT cage (order m) look at the central vertical wall of its 2×2
// children (read from the order-m+1 map): is it unbroken (vTop==vBot)? And is
// it a function of the parent code, or does the same code sometimes wall one
// way and sometimes another? Exactly the translation-function test, but for the
// wall instead of the child codes.
function wallStats(long, lat, order) {
    setOffset(long, lat);
    const sen = { seniority: Seniority.vertical() };
    const parent = computeMapModel(1 << order, 1 << order, sen);
    const child = computeMapModel(1 << (order + 1), 1 << (order + 1), sen);
    setOffset(1, 1);
    const { vWall } = sectionWalls(child);
    const rows = Math.min(parent.NSr, Math.floor((child.NSr - 1) / 2));
    const cols = Math.min(parent.NSc, Math.floor((child.NSc - 1) / 2));

    let broken = 0, total = 0;
    const byCode = new Map(); // parentCode → set of "vTop,vBot" seen
    for (let sr = 0; sr < rows; sr++) {
        for (let sc = 0; sc < cols; sc++) {
            const vTop = vWall[2 * sr][2 * sc];
            const vBot = vWall[2 * sr + 1][2 * sc];
            total++;
            if (vTop !== vBot) broken++;
            const pk = codeKey(parent.secCodes[sr][sc]);
            if (!byCode.has(pk)) byCode.set(pk, new Set());
            byCode.get(pk).add((vTop ? 1 : 0) + "," + (vBot ? 1 : 0));
        }
    }
    // A code is "wall-ambiguous" if it splits its vertical wall ≠ ways.
    let ambiguous = 0;
    for (const s of byCode.values()) if (s.size > 1) ambiguous++;
    return { broken, total, codes: byCode.size, ambiguous };
}

function partB() {
    console.log("\nPART B — is the unbroken, code-determined wall anchor-only?");
    console.log("  offset   blocks  broken-vWalls  codes  wall-ambiguous-codes");
    const cases = [
        [1, 1, "anchor "],
        [2, 2, "off    "],
        [5, 3, "off    "],
        [3, 5, "off    "],
    ];
    let anchorClean = true;
    for (const [h, v, tag] of cases) {
        const { broken, total, codes, ambiguous } = wallStats(h, v, 7);
        const anchor = h === 1 && v === 1;
        if (anchor && (broken > 0 || ambiguous > 0)) anchorClean = false;
        console.log(
            `  ${h}/${v} ${tag} ${String(total).padStart(5)}   ` +
            `${String(broken).padStart(11)}    ${String(codes).padStart(4)}   ` +
            `${String(ambiguous).padStart(6)}`,
        );
    }
    return anchorClean;
}

const aOk = partA();
const bOk = partB();
console.log(
    "\n" +
    (aOk
        ? "Bars factor exactly and the vertical wall is unbroken on the anchor."
        : "Bar factorization broke — unexpected.") +
    (bOk
        ? "\nOn the anchor: 0 broken walls, every code splits its wall one way." +
          "\nOff the anchor the walls break and the same code splits both ways" +
          " — the intact, code-determined cage wall is the anchor's magic.\n"
        : "\n(anchor showed broken/ambiguous walls — revisit)\n"),
);
process.exit(aOk ? 0 : 1);
