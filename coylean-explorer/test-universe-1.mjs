import { Universe } from "./coylean-core.js";

function stringifyUniverse(u) {
    const lines = [];

    lines.push("Universe:");
    lines.push(
        `  extents: N=${u.northExtent} S=${u.southExtent} W=${u.westExtent} E=${u.eastExtent}`,
    );
    lines.push(`  origin: row=${u.originRow} col=${u.originCol}`);
    lines.push(`  init: h=${u.hInitCol} v=${u.vInitRow}`);
    lines.push("");

    lines.push("  downMatrix:");
    for (let j = 0; j < u.downMatrix.length; j++) {
        const row = u.downMatrix[j].map((v) => (v ? "1" : ".")).join(" ");
        lines.push(`    ${row}`);
    }

    lines.push("");
    lines.push("  rightMatrix:");
    for (let j = 0; j < u.downMatrix.length; j++) {
        let row = [];
        for (let i = 0; i < u.rightMatrix.length; i++) {
            row.push(u.rightMatrix[i][j] ? "1" : ".");
        }
        lines.push(`    ${row.join(" ")}`);
    }

    lines.push("");
    lines.push("  colPriority:");
    lines.push(`    ${u.colPriority.join(" ")}`);

    lines.push("  rowPriority:");
    lines.push(`    ${u.rowPriority.join(" ")}`);

    return lines.join("\n");
}
const u = Universe.create({
    northExtent: 1,
    southExtent: 8,
    westExtent: 1,
    eastExtent: 8,
    hInitCol: 1,
    vInitRow: 1,
});

console.log(stringifyUniverse(u));
