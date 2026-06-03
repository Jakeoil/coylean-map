// planet-coyleus — quadrant + seniority coverage check.
//
// The orientation control lets you pick a quadrant anchor (curHInit long,
// curVInit lat ∈ {0,1}) and seniority (V/H). This verifies the engine side:
//
//   1. all four quadrants × both seniorities are on-anchor — every map section
//      resolves to one of the 12 palette orbits (nothing unpaintable);
//   2. for both seniorities, every orbit's focus rep + substitution + 4→1
//      translation relatives exist (the panels never come up empty).
//
//   node meta/planet-coyleus/test/quadrants.mjs

import {
    LETTERS,
    focusGlyph,
    substitutionOf,
    translationOf,
    rungMap,
    paintCell,
} from "../terrain-core.js";

let failures = 0;
const check = (label, cond, detail = "") => {
    console.log(`  ${cond ? "✓" : "✗"} ${label}${detail ? "  — " + detail : ""}`);
    if (!cond) failures++;
};

console.log("planet-coyleus · quadrant + seniority coverage\n");

// ── 1. every map section of every quadrant × seniority resolves ──
const QUADS = [
    [0, 0, "NW"],
    [1, 0, "NE"],
    [0, 1, "SW"],
    [1, 1, "SE"],
];
for (const senH of [false, true]) {
    for (const [h, v, name] of QUADS) {
        const patch = rungMap(6, senH, h, v);
        let bad = 0;
        const letters = new Set();
        for (let sr = 0; sr < patch.NSr; sr++)
            for (let sc = 0; sc < patch.NSc; sc++) {
                const [d, r] = patch.codes[sr][sc];
                // paintCell(...,null) returns the orbit letter, or null if the
                // section is outside the 12-orbit alphabet. (No visible effect:
                // the palette starts blank, so this writes null over null.)
                const L = paintCell(patch.grid, d, r, 0, null);
                if (L === null) bad++;
                else letters.add(L);
            }
        check(
            `${senH ? "H" : "V"} ${name} (h${h}/v${v}): every section paintable`,
            bad === 0,
            `${bad} unresolved · ${letters.size} orbits used`,
        );
    }
}

// ── 2. relatives exist for both seniorities, every orbit ──
for (const senH of [false, true]) {
    let subOK = 0;
    let transOK = 0;
    for (const L of LETTERS) {
        const f = focusGlyph(L, senH);
        if (!f || f.d === undefined) continue;
        const s = substitutionOf(f.grid, f.d, f.r);
        const t = translationOf(f.grid, f.d, f.r);
        if (s.pair.length === 2) subOK++;
        if (t.children.length === 4) transOK++;
    }
    check(`${senH ? "H" : "V"}: all 12 substitutions present`, subOK === 12, `${subOK}/12`);
    check(`${senH ? "H" : "V"}: all 12 translations present`, transOK === 12, `${transOK}/12`);
}

console.log(
    failures
        ? `\n${failures} check(s) FAILED`
        : "\nall checks passed — quadrants + seniority fully covered ✓",
);
process.exit(failures ? 1 : 0);
