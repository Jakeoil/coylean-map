// Test runner — runs every Node suite and tallies pass/fail by exit code.
// `npm test`. Feature-local suites that test feature code (planet-coyleus) are
// included by explicit path even though they live with their feature.
import { readdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";

const dirs = [
    "test", // top-level: import-smoketest, test-lib
    "test/core",
    "test/glyphs",
    "test/superglyphs",
    "test/scaffold",
    "meta/planet-coyleus/test",
];
const skip = new Set(["run.mjs"]);

let pass = 0;
let fail = 0;
for (const d of dirs) {
    if (!existsSync(d)) continue;
    for (const name of readdirSync(d).sort()) {
        if (!name.endsWith(".mjs") || skip.has(name)) continue;
        const path = d + "/" + name;
        if (statSync(path).isDirectory()) continue;
        try {
            execFileSync(process.execPath, [path], { stdio: "ignore" });
            console.log("  ok    " + path);
            pass++;
        } catch {
            console.log("  FAIL  " + path);
            fail++;
        }
    }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
