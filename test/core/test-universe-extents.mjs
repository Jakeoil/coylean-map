// Regression test for the optimized integrated factory.
//
// Pins Propagation.fromUniverseExtents (and its universeBoundarySeed seam)
// to the eager reference path Propagation.fromUniverseBoundary(Universe.create
// (opts)): the factory streams each quadrant's far edge and skips the SE
// quadrant, so this guards against any divergence from the four-quadrant
// build. Compares downMatrix + rightMatrix cell-for-cell across extents,
// offsets (incl. negative/large), both seniorities, per-axis caps, sparse
// universes, and custom init arrays.
//
// Run: node coylean-explorer/test-universe-extents.mjs   (exit 0 = all pass)

import { Propagation, Universe, Seniority } from "coylean/core";

function eqMatrix(a, b) {
    if (a.length !== b.length) return `row count ${a.length} vs ${b.length}`;
    for (let r = 0; r < a.length; r++) {
        if (a[r].length !== b[r].length)
            return `row ${r} len ${a[r].length} vs ${b[r].length}`;
        for (let c = 0; c < a[r].length; c++) {
            if (!!a[r][c] !== !!b[r][c])
                return `cell [${r}][${c}] ${a[r][c]} vs ${b[r][c]}`;
        }
    }
    return null;
}

let pass = 0;
let total = 0;

function check(label, opts) {
    total++;
    let ref;
    try {
        ref = Propagation.fromUniverseBoundary(Universe.create(opts));
    } catch {
        // If the eager path rejects opts, the factory must reject them too.
        let factThrew = false;
        try { Propagation.fromUniverseExtents(opts); }
        catch { factThrew = true; }
        console.log(`${factThrew ? "PASS" : "FAIL"}  ${label}  (both throw)`);
        if (factThrew) pass++;
        return;
    }
    const got = Propagation.fromUniverseExtents(opts);
    const dErr = eqMatrix(ref.downMatrix, got.downMatrix);
    const rErr = eqMatrix(ref.rightMatrix, got.rightMatrix);
    const meta =
        ref.hInitCol === got.hInitCol && ref.vInitRow === got.vInitRow
            ? null
            : `offsets ref(${ref.hInitCol},${ref.vInitRow})`
              + ` vs got(${got.hInitCol},${got.vInitRow})`;
    const ok = !dErr && !rErr && !meta;
    console.log(
        `${ok ? "PASS" : "FAIL"}  ${label}`
        + (dErr ? `\n   down:  ${dErr}` : "")
        + (rErr ? `\n   right: ${rErr}` : "")
        + (meta ? `\n   meta:  ${meta}` : ""),
    );
    if (ok) pass++;
}

const V = Seniority.vertical();
const H = Seniority.horizontal();

// Symmetric extents, default offsets.
for (const L of [1, 2, 3, 5, 8, 16, 33]) {
    check(`symmetric L=${L}`, {
        northExtent: L, southExtent: L, westExtent: L, eastExtent: L,
        hInitCol: 1, vInitRow: 1, seniority: V,
    });
}

// Asymmetric extents.
check("asym 2/5/3/7", {
    northExtent: 2, southExtent: 5, westExtent: 3, eastExtent: 7,
    hInitCol: 1, vInitRow: 1, seniority: V,
});
check("asym 9/1/1/4", {
    northExtent: 9, southExtent: 1, westExtent: 1, eastExtent: 4,
    hInitCol: 1, vInitRow: 1, seniority: V,
});

// Offsets, including negative and large.
for (const [h, v] of [[0, 0], [1, 1], [5, 3], [-2, 4], [3, -7], [16, 9]]) {
    check(`offset h=${h} v=${v}`, {
        northExtent: 6, southExtent: 6, westExtent: 6, eastExtent: 6,
        hInitCol: h, vInitRow: v, seniority: V,
    });
}

// Both seniorities.
check("seniority H symmetric", {
    northExtent: 8, southExtent: 8, westExtent: 8, eastExtent: 8,
    hInitCol: 1, vInitRow: 1, seniority: H,
});
check("seniority H asym + offset", {
    northExtent: 5, southExtent: 9, westExtent: 7, eastExtent: 3,
    hInitCol: 2, vInitRow: -3, seniority: H,
});

// Per-axis priority caps (both seniorities).
for (const [mp, lat, lng] of [
    [4, undefined, undefined], [20, 2, undefined], [20, undefined, 3],
    [20, 2, 4], [20, 4, 2], [20, 3, 5], [6, 2, 3],
]) {
    for (const [sen, tag] of [[V, "V"], [H, "H"]]) {
        check(`caps maxPri=${mp} lat=${lat} long=${lng} ${tag}`, {
            northExtent: 12, southExtent: 12, westExtent: 12, eastExtent: 12,
            hInitCol: 1, vInitRow: 1, seniority: sen,
            maxPri: mp, maxLatPri: lat, maxLongPri: lng,
        });
    }
}

// Sparse universes (a zero extent suppresses the quadrants on that side).
check("sparse SE only (no N, no W)", {
    northExtent: 0, southExtent: 6, westExtent: 0, eastExtent: 6,
    hInitCol: 1, vInitRow: 1, seniority: V,
});
check("sparse east half (no W)", {
    northExtent: 5, southExtent: 5, westExtent: 0, eastExtent: 6,
    hInitCol: 1, vInitRow: 1, seniority: V,
});
check("sparse south half (no N)", {
    northExtent: 0, southExtent: 7, westExtent: 4, eastExtent: 4,
    hInitCol: 1, vInitRow: 1, seniority: V,
});
check("sparse NW only (no S, no E)", {
    northExtent: 5, southExtent: 0, westExtent: 5, eastExtent: 0,
    hInitCol: 1, vInitRow: 1, seniority: V,
});
check("sparse west half (no E)", {
    northExtent: 4, southExtent: 6, westExtent: 5, eastExtent: 0,
    hInitCol: 2, vInitRow: 1, seniority: H,
});
check("sparse north half (no S)", {
    northExtent: 6, southExtent: 0, westExtent: 4, eastExtent: 5,
    hInitCol: 1, vInitRow: 3, seniority: V,
});

// Custom init arrays (non-all-true seeds), shared central axes.
const bits = (n, seed) => {
    const a = [];
    let x = seed;
    for (let k = 0; k < n; k++) {
        x = (x * 1103515245 + 12345) & 0x7fffffff;
        a.push(((x >> 16) & 1) === 1);
    }
    return a;
};
check("custom init arrays symmetric", {
    northExtent: 6, southExtent: 6, westExtent: 6, eastExtent: 6,
    hInitCol: 1, vInitRow: 1, seniority: V,
    westInitDown: bits(6, 1), eastInitDown: bits(6, 2),
    northInitRight: bits(6, 3), southInitRight: bits(6, 4),
});
check("custom init arrays asym + cap", {
    northExtent: 4, southExtent: 8, westExtent: 5, eastExtent: 3,
    hInitCol: 1, vInitRow: 1, seniority: V, maxPri: 32, maxLatPri: 3,
    westInitDown: bits(5, 7), eastInitDown: bits(3, 8),
    northInitRight: bits(4, 9), southInitRight: bits(8, 10),
});

// ── Negative extents: the seam moves off-origin, the window lies wholly on
// one side. check() already cross-validates both build paths agree; these add
// the external oracle (the window must equal the canonical field sliced) and
// the guard.
for (const opts of [
    { northExtent: 6, southExtent: 6, westExtent: -2, eastExtent: 6 },
    { northExtent: 6, southExtent: 6, westExtent: 6, eastExtent: -1 },
    { northExtent: -2, southExtent: 6, westExtent: 6, eastExtent: 6 },
    { northExtent: 6, southExtent: -3, westExtent: 6, eastExtent: 6 },
    { northExtent: -3, southExtent: 6, westExtent: -2, eastExtent: 6 },
]) {
    const o = { ...opts, hInitCol: 1, vInitRow: 1, seniority: V };
    const w = opts.westExtent, e = opts.eastExtent;
    check(`neg W=${w} E=${e} N=${opts.northExtent} S=${opts.southExtent}`, o);
}

// Windowed-oracle: a negative-extent map equals a big origin-containing map
// sliced to the same absolute (offset-aligned) window.
const BIG = Propagation.fromUniverseExtents({
    northExtent: 16, southExtent: 16, westExtent: 16, eastExtent: 16,
    hInitCol: 1, vInitRow: 1, seniority: V,
});
function windowOK(label, opts) {
    total++;
    const m = Propagation.fromUniverseExtents({
        ...opts, hInitCol: 1, vInitRow: 1, seniority: V,
    });
    const cS = m.hInitCol - BIG.hInitCol;
    const rS = m.vInitRow - BIG.vInitRow;
    let bad = 0;
    for (let r = 0; r < m.downMatrix.length; r++)
        for (let c = 0; c < m.downMatrix[r].length; c++)
            if (!!m.downMatrix[r][c] !== !!BIG.downMatrix[r + rS]?.[c + cS]) bad++;
    for (let c = 0; c < m.rightMatrix.length; c++)
        for (let r = 0; r < m.rightMatrix[c].length; r++)
            if (!!m.rightMatrix[c][r] !== !!BIG.rightMatrix[c + cS]?.[r + rS]) bad++;
    console.log(`${bad === 0 ? "PASS" : "FAIL"}  window ${label}  (${bad} off)`);
    if (bad === 0) pass++;
}
windowOK("W=-2", { northExtent: 6, southExtent: 6, westExtent: -2, eastExtent: 6 });
windowOK("N=-3,W=-2", { northExtent: -3, southExtent: 6, westExtent: -2, eastExtent: 6 });

// Guard: per-axis sum must be ≥ 0 (the negative side can't out-reach the
// positive one).
total++;
let threw = false;
try {
    Propagation.fromUniverseExtents({
        northExtent: 6, southExtent: 6, westExtent: -7, eastExtent: 6,
        hInitCol: 1, vInitRow: 1, seniority: V,
    });
} catch { threw = true; }
console.log(`${threw ? "PASS" : "FAIL"}  guard: W+E < 0 throws`);
if (threw) pass++;

console.log(`\n${pass}/${total} passed`);
process.exit(pass === total ? 0 : 1);
