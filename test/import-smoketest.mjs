// Node smoke test: proves `coylean/core` resolves via the root package.json
// "exports" self-reference (no build, no install). Run from the project root:
//     node test/import-smoketest.mjs
import { Propagation, Seniority } from "coylean/core";
import * as core from "coylean/core";

const ok = typeof Propagation === "function" && !!Seniority.vertical();
console.log(
    (ok ? "OK ✓" : "FAIL ✗") +
        "  coylean/core resolved in Node — " +
        Object.keys(core).length +
        " exports",
);
process.exit(ok ? 0 : 1);
