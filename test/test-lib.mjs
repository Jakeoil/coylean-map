// Self-test for the reusable helpers in test/lib — also a Home Anchor
// regression guard: at the Home Anchor (1/1) every self-code makes exactly one
// child-block; at a non-home anchor (2/2) some self-codes are ambiguous.
import { mapSections } from "./lib/sections.mjs";
import { buildTrominoTable } from "./lib/tromino.mjs";

let fail = 0;
const ck = (cond, msg) => {
    if (!cond) {
        console.error("  ✗ " + msg);
        fail++;
    }
};

const grid = mapSections(1, 1, 6);
ck(
    Array.isArray(grid) && Array.isArray(grid[0]) && grid[0][0].length === 2,
    "mapSections returns an ns×ns grid of [d,r] codes",
);

const home = buildTrominoTable(1, 1);
const off = buildTrominoTable(2, 2);
const ambig = (m) => [...m.bySelf.values()].filter((s) => s.size > 1).length;
ck(ambig(home) === 0, "Home Anchor 1/1: 0 ambiguous self-codes (self decides)");
ck(ambig(off) > 0, "non-home 2/2: some ambiguous self-codes (needs tromino)");

console.log(
    fail
        ? "test-lib FAIL"
        : `test-lib OK — home ambiguous 0, 2/2 ambiguous ${ambig(off)}`,
);
process.exit(fail ? 1 : 0);
