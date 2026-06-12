"use strict";

// ════════════════════════════════════════════════════════════════════════
// The elaborate cell — the IMMUTABLE priority-shell renderer, factored out of
// descent.mjs (verbatim from the index draw map's coylean.js renderComplex) so
// the Descent square and the Morph Unit share ONE copy. DO NOT fold render
// variants into it.
//
// Each cell is a priority-sized rectangle (width/height = priority·2·scale)
// placed at the running offset of accumulated cell widths, driven by the
// engine's arrow matrices + priorities. down/right = IN arrows (from N / W),
// down_out/right_out = OUT arrows (to S / E). `top` is the shell ceiling; shell
// i draws only while `i > top - depth - 2`, so LOW depth shows just the inner
// colourful shells of the big trunks (small cells vanish) and raising depth
// fills outward to the green frames.
//
// `opts.scale` (default 6) sizes the cell; `opts.shade(i, pri)` overrides the
// per-arm colour (default = COLOR_LIST[i % len], coylean.js's green frames with
// rainbow innards, shared by the vertical and horizontal arms).
// ════════════════════════════════════════════════════════════════════════

// The 19-color depth palette, verbatim from coylean.js (elaborate mode). Index
// = shell: 0 outermost. Low depth shows only the inner (warm/bright) shells.
export const COLOR_LIST = [
    "#8FBC8F", "#FFEBCD", "#8A2BE2", "#00FFFF", "#DEB887",
    "#FAEBD7", "#FF7F50", "#F0FFFF", "#FF1493", "#8FBC8F",
    "#FFFACD", "#FF6347", "#B22222", "#C0C0C0", "#FFDEAD",
    "#A52A2A", "#FF00FF", "#40E0D0", "#FF00FF",
];

// ONE shell colour per ring i (shell index from the outside), shared by both
// arms — green frames with rainbow innards.
export const SHELL_SHADE = (i) => COLOR_LIST[i % COLOR_LIST.length];

const DEFAULT_SCALE = 6;

export function renderComplex(
    g, x_place, y_place, down, downPri, right, rightPri,
    down_out, right_out, depth, top, opts = {}
) {
    const shade = opts.shade || SHELL_SHADE;
    const SCALE = opts.scale ?? DEFAULT_SCALE;
    const width = downPri * 2;
    const height = rightPri * 2;
    const x_width = SCALE * width;
    for (let i = 0; i < top; i++) {
        let work_done = true;
        if (i > top - depth - 2) {
            work_done = false;
            const w = width - 2 * i - 1;
            const h = height - 2 * i - 1;
            if (w > 0) {
                g.fillStyle = shade(i, downPri); // vertical arm
                if (down) {
                    if (down_out) {
                        g.fillRect(x_place + SCALE * (i + 1), y_place,
                            SCALE * w, SCALE * (rightPri * 2));
                    } else {
                        g.fillRect(x_place + SCALE * (i + 1), y_place,
                            SCALE * w, SCALE * (rightPri + 1));
                    }
                }
                if (down_out) {
                    g.fillRect(x_place + SCALE * (i + 1),
                        y_place + SCALE * rightPri, SCALE * w, SCALE * rightPri);
                }
                work_done = true;
            }
            if (h > 0) {
                g.fillStyle = shade(i, rightPri); // horizontal arm
                if (right) {
                    if (right_out) {
                        g.fillRect(x_place, y_place + SCALE * (i + 1),
                            SCALE * (downPri * 2), SCALE * h);
                    }
                    g.fillRect(x_place, y_place + SCALE * (i + 1),
                        SCALE * (downPri + 1), SCALE * h);
                }
                if (right_out) {
                    g.fillRect(x_place + SCALE * downPri,
                        y_place + SCALE * (i + 1), SCALE * downPri, SCALE * h);
                }
                work_done = true;
            }
        }
        if (!work_done) break;
    }
    return x_width;
}
