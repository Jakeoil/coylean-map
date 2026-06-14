// Reusable test/validation helpers — the section-extraction + ascii-bitmap code
// that kept getting re-written inline. Pure; imports only the coylean/ layers.
//
//   import { mapSections, sectionsFromModel, asciiBitmap } from
//       "../lib/sections.mjs";   // or "coylean/.." once test/ is on the map
import { Seniority } from "coylean/core";
import { setOffset, computeMapModel } from "coylean/glyphs";

export const SEC = 4;

// Extract the ns×ns grid of glyph codes [downCode, rightCode] from a
// computeMapModel output (honours the model's firstDark margin).
export function sectionsFromModel(model, ns) {
    const { downMatrix, rightMatrix } = model;
    const oR = model.firstDarkRow + 1;
    const oC = model.firstDarkCol + 1;
    const grid = Array.from({ length: ns }, () =>
        Array.from({ length: ns }, () => [0, 0]));
    for (let sr = 0; sr < ns; sr++) {
        for (let sc = 0; sc < ns; sc++) {
            const y0 = oR + sr * SEC;
            const x0 = oC + sc * SEC;
            for (let i = 0; i < 3; i++) {
                if (downMatrix[y0] && downMatrix[y0][x0 + i]) {
                    grid[sr][sc][0] |= 1 << i;
                }
                if (rightMatrix[x0] && rightMatrix[x0][y0 + i]) {
                    grid[sr][sc][1] |= 1 << i;
                }
            }
        }
    }
    return grid;
}

// Convenience: set the offset, propagate an order-`order` map, and section it.
// Restores the offset to 1/1 afterward. Returns the ns×ns code grid.
export function mapSections(h, v, order, seniority = Seniority.vertical()) {
    const N = 1 << order;
    setOffset(h, v);
    const model = computeMapModel(N, N, { seniority });
    setOffset(1, 1);
    const ns = Math.min(model.NSr, model.NSc);
    return sectionsFromModel(model, ns);
}

// Render a boolean matrix (array of rows of truthy/falsy) as an ascii bitmap.
export function asciiBitmap(rows, on = "█", off = "·") {
    return rows
        .map((row) => Array.from(row, (c) => (c ? on : off)).join(""))
        .join("\n");
}
