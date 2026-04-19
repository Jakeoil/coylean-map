import { propagate } from "./coylean-core.js";

function countTrue(matrix) {
    let n = 0;
    for (const row of matrix) {
        for (const v of row) if (v) n++;
    }
    return n;
}

function checksum(sizes) {
    const results = [];
    for (const [nR, nC] of sizes) {
        const { downMatrix, rightMatrix } = propagate(nR, nC);
        results.push({
            size: `${nR}x${nC}`,
            downTrue: countTrue(downMatrix),
            rightTrue: countTrue(rightMatrix),
        });
    }
    return results;
}

function printResults(results) {
    for (const r of results) {
        console.log(`${r.size}  down=${r.downTrue}  right=${r.rightTrue}`);
    }
}

function diff(a, b) {
    const byKey = new Map(b.map((r) => [r.size, r]));
    const diffs = [];
    for (const ra of a) {
        const rb = byKey.get(ra.size);
        if (!rb) {
            diffs.push({ size: ra.size, missing: "b" });
            continue;
        }
        if (ra.downTrue !== rb.downTrue || ra.rightTrue !== rb.rightTrue) {
            diffs.push({
                size: ra.size,
                a: { downTrue: ra.downTrue, rightTrue: ra.rightTrue },
                b: { downTrue: rb.downTrue, rightTrue: rb.rightTrue },
            });
        }
    }
    for (const [size] of byKey) {
        if (!a.find((r) => r.size === size)) diffs.push({ size, missing: "a" });
    }
    return diffs;
}

const sizes = [
    [3, 3],
    [5, 5],
    [10, 10],
];

const results = checksum(sizes);
printResults(results);

export { checksum, printResults, diff, countTrue };
