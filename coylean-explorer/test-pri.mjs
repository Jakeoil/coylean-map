// Equivalence + perf check for pri() (bitwise) vs priLoop() (museum).
// Usage: node test-pri.mjs

import { pri, priLoop } from "./coylean-core.js";

function eqv(n, maxPri) {
    const a = priLoop(n, maxPri);
    const b = pri(n, maxPri);
    if (a !== b) {
        throw new Error(
            `mismatch at n=${n}, maxPri=${maxPri}: priLoop=${a} pri=${b}`,
        );
    }
}

// Cover the full range where pri (bitwise) is valid: n in [0, 2^31),
// maxPri in [0, 31]. 2^22 samples is enough to exercise every trailing-zero
// count up to 22 and every maxPri clamping path.
const N = 1 << 22;
for (const maxPri of [0, 1, 5, 20, 31]) {
    for (let n = 0; n < N; n++) eqv(n, maxPri);
}
// Spot-check the upper end where int32 sign-wrap matters.
for (let k = 22; k <= 30; k++) eqv(1 << k, 31);
eqv(0x7FFFFFFF, 31);
console.log(`OK: pri ≡ priLoop across ${N.toLocaleString()} × 5 cases + upper-end spot-checks`);

function bench(fn, arr, label) {
    let s = 0;
    const t0 = performance.now();
    for (let i = 0; i < arr.length; i++) s += fn(arr[i], 31);
    const dt = performance.now() - t0;
    console.log(`  ${label.padEnd(8)} ${dt.toFixed(1)} ms   checksum=${s}`);
    return { dt, s };
}

function compare(name, arr) {
    console.log(`\n${name} (n=${arr.length.toLocaleString()}):`);
    const a = bench(priLoop, arr, "priLoop");
    const b = bench(pri, arr, "pri");
    if (a.s !== b.s) throw new Error(`${name}: checksums differ`);
    console.log(`  speedup: ${(a.dt / b.dt).toFixed(2)}× (pri vs priLoop)`);
}

// Build a few different input distributions of equal length so we can see
// where each implementation wins.
const M = 1 << 22;

// 1. Sequential ruler 1..M — average trailing-zeros ≈ 1.
const seq = new Int32Array(M);
for (let i = 0; i < M; i++) seq[i] = i + 1;

// 2. Powers of two (cycled): every value has the maximum trailing-zero count
//    the while-loop will see. Stresses pri()'s worst case.
const pow2 = new Int32Array(M);
for (let i = 0; i < M; i++) pow2[i] = 1 << ((i % 30) + 1);

// 3. Deep dyadic: n = (2k+1) << shift for shift cycling 0..29 — wide spread
//    of trailing-zero counts including the high end.
const dyadic = new Int32Array(M);
for (let i = 0; i < M; i++) {
    const shift = i % 30;
    const odd = ((i >>> 5) | 1) >>> 0;
    dyadic[i] = (odd << shift) >>> 0;
    if (dyadic[i] === 0) dyadic[i] = 1 << shift;
}

// 4. Shuffled sequential — defeats branch prediction.
const shuf = Int32Array.from(seq);
for (let i = M - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [shuf[i], shuf[j]] = [shuf[j], shuf[i]];
}

for (let pass = 1; pass <= 2; pass++) {
    console.log(`\n=== pass ${pass} ===`);
    compare("sequential 1..M", seq);
    compare("powers of two (cycled)", pow2);
    compare("deep dyadic mix", dyadic);
    compare("shuffled sequential", shuf);
}

// Sweep bands: each input is a value whose trailing-zero count is one of
// {k, k+1, k+2}, equal proportions. Find the breakeven k.
function bandMix(k) {
    const arr = new Int32Array(M);
    for (let i = 0; i < M; i++) {
        const p = k + (i % 3);
        // odd part * 2^p — gives a value with exactly p trailing zeros.
        const odd = (((i >>> 1) * 2 + 1) | 0) & 0x3fffffff;
        arr[i] = (odd << p) >>> 0 || 1 << p;
    }
    return arr;
}

console.log("\n=== narrow-band sweep (equal mix of {k, k+1, k+2}) ===");
// V8 has already warmed up the call sites, so this measures post-warmup behavior.
for (let k = 0; k <= 10; k++) {
    compare(`band {${k},${k + 1},${k + 2}}`, bandMix(k));
}
