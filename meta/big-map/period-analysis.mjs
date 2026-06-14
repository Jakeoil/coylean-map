// period-analysis.mjs — reproduces the numbers in period-analysis.md.
// Run from anywhere:  node meta/big-map/period-analysis.mjs
//
// Measures the fundamental period of the Coylean arrow field as a function of
// the priority ceilings:
//   maxPri      caps BOTH axes (== latPri = longPri)
//   maxLatPri   caps latitude  (N–S, rows, vInitRow)
//   maxLongPri  caps longitude (E–W, cols, hInitCol)
// Period = smallest shift P with zero mismatch of the full (down,right) arrow
// field over an interior window — measured E–W and N–S independently.
import { Propagation, Seniority } from "coylean/core";

const N = 520, R0 = 100, W = 200, PMAX = 160; // need R0 + W + PMAX <= N
const V = Seniority.vertical(), H = Seniority.horizontal();

function build(opts) {
    return new Propagation({
        numRows: N, numColumns: N, hInitCol: 1, vInitRow: 1,
        maxPri: 32, seniority: V, ...opts,
    });
}
// 2-bit cell state: bit0 = down arrow, bit1 = right arrow.
const cell = (p, j, i) =>
    (p.downMatrix[j]?.[i] ? 1 : 0) | (p.rightMatrix[i]?.[j] ? 2 : 0);

function period(p, axis) {
    for (let P = 1; P <= PMAX; P++) {
        let ok = true;
        for (let j = R0; j < R0 + W && ok; j++) {
            for (let i = R0; i < R0 + W; i++) {
                const jj = axis === "ns" ? j + P : j;
                const ii = axis === "ew" ? i + P : i;
                if (cell(p, j, i) !== cell(p, jj, ii)) { ok = false; break; }
            }
        }
        if (ok) return P;
    }
    return null; // aperiodic within PMAX
}
const f = (x) => (x === null ? `>${PMAX}` : String(x));
const lg = (x) =>
    x && Number.isInteger(Math.log2(x)) ? `2^${Math.log2(x)}` : "";

function rowFor(p, label) {
    const ew = period(p, "ew"), ns = period(p, "ns");
    console.log(
        "  " + label.padEnd(24),
        `E-W=${f(ew).padStart(4)} ${lg(ew).padStart(4)}`,
        ` N-S=${f(ns).padStart(4)} ${lg(ns).padStart(4)}`,
    );
}
const row = (label, opts) => rowFor(build(opts), label);

console.log("Baseline (uncapped, maxPri≈∞):");
row("none", {});

console.log("\nBoth axes capped at c  (== maxPri=c, latPri=longPri=c):");
for (let c = 0; c <= 5; c++) row(`c=${c}`, { maxLatPri: c, maxLongPri: c });

console.log("\nlongPri=c only (latPri≈∞), vertical seniority:");
for (let c = 0; c <= 5; c++) row(`longPri=${c}`, { maxLongPri: c });

console.log("\nlatPri=c only (longPri≈∞), vertical seniority:");
for (let c = 0; c <= 5; c++) row(`latPri=${c}`, { maxLatPri: c });

console.log("\nMixed (binding cap = min(lat,long); + asymmetry):");
row("latPri=2, longPri=4", { maxLatPri: 2, maxLongPri: 4 });
row("latPri=4, longPri=2", { maxLatPri: 4, maxLongPri: 2 });
row("latPri=3, longPri=5", { maxLatPri: 3, maxLongPri: 5 });

console.log("\nSeniority flips the asymmetry (H = backslash dual of V):");
row("longPri=3 only, V", { maxLongPri: 3, seniority: V });
row("latPri=3 only,  V", { maxLatPri: 3, seniority: V });
row("longPri=3 only, H", { maxLongPri: 3, seniority: H });
row("latPri=3 only,  H", { maxLatPri: 3, seniority: H });

console.log("\nInvariance (offset doesn't change period):");
row("c=3, offset 1/1", { maxLatPri: 3, maxLongPri: 3 });
rowFor(
    new Propagation({
        numRows: N, numColumns: N, hInitCol: 5, vInitRow: 3,
        maxPri: 32, maxLatPri: 3, maxLongPri: 3,
    }),
    "c=3, offset 5/3",
);

// ---------------------------------------------------------------------------
// Derivation checks (see the "Derivation" section of period-analysis.md).
// ---------------------------------------------------------------------------

// (1) The reaction is GF(2)-linear: field(initDown=1, initRight=1) must equal
//     field(1,0) XOR field(0,1) cell-by-cell.
function gf2LinearityHolds() {
    const M = 40;
    const f = (down, right) => new Propagation({
        numRows: M, numColumns: M, hInitCol: 1, vInitRow: 1,
        maxPri: 32, maxLatPri: 3, maxLongPri: 3,
        initDown: Array(M).fill(down), initRight: Array(M).fill(right),
    });
    const ones = f(true, true), a = f(true, false), b = f(false, true);
    for (let j = 0; j < M; j++) {
        for (let i = 0; i < M; i++) {
            const lhs = ones.downMatrix[j][i] ? 1 : 0;
            const rhs = (a.downMatrix[j][i] ? 1 : 0) ^ (b.downMatrix[j][i] ? 1 : 0);
            if (lhs !== rhs) return false;
        }
    }
    return true;
}

// (2) Exact period from effective caps. a = maxLatPri (N–S), b = maxLongPri
//     (E–W). The tie-WINNING axis gets +1 in its effective cap.
function predict(a, b, seniority) {
    const vert = seniority.isVertical;
    const effLong = vert ? Math.min(b, a) : Math.min(b, a + 1); // E–W
    const effLat = vert ? Math.min(a, b + 1) : Math.min(a, b);  // N–S
    return [2 ** (effLong + 2), 2 ** (effLat + 2)];
}

console.log("\nDerivation checks:");
console.log("  GF(2) linearity (field(1,1)==field(1,0)^field(0,1)):",
    gf2LinearityHolds());
console.log("  predicted vs measured (a=lat, b=long):");
for (const [a, b, sen, nm] of [
    [2, 2, V, "V"], [4, 2, V, "V"], [5, 3, V, "V"], [3, 5, V, "V"],
    [3, 20, V, "V"], [20, 3, V, "V"], [3, 20, H, "H"], [5, 3, H, "H"],
]) {
    const p = build({ maxLatPri: a, maxLongPri: b, seniority: sen });
    const m = [period(p, "ew"), period(p, "ns")];
    const pr = predict(a, b, sen);
    const ok = m[0] === pr[0] && m[1] === pr[1] ? "OK" : "MISMATCH";
    console.log(
        `    a=${a} b=${b} ${nm}:  measured ${JSON.stringify(m)}`
        + `  predicted ${JSON.stringify(pr)}  ${ok}`,
    );
}
