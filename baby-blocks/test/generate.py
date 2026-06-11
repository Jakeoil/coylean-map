#!/usr/bin/env python3
"""Generate a complete AlphabetBlocks SVG (all 95 printable ASCII).

Each block = outer 183.54 rect + inner 153.54 rect (the colored frame ring)
+ the News 706 Bold glyph, placed with the transform calibrated from the
original 36 (scale 0.14, baseline at block-local y=142.80, centered at 91.77).
Frame command patterns + class colors match the original AlphabetBlocks.svg so
baby-blocks.js parses it identically. Each path carries data-char.

Writes ../AlphabetBlocks-complete.svg (the hand-authored original is left
untouched as the working baseline).
"""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

FONT = "../News 706 Bold.otf"
OUT = "../AlphabetBlocks-complete.svg"

# Block geometry (matches original artwork)
BLOCK = 183.5395508
INNER = 153.5395508
BORDER = 15.0
INNER_FAR = BORDER + INNER  # 168.5395508

# Calibrated font -> block transform (from calibrate.py, stdev 0)
SCALE = 0.14
BASELINE = 142.80  # block-local y of the caps baseline
CENTER_X = BLOCK / 2  # 91.76977..., letters centered here

# Toy-block colors, cycled across the set
CLASSES = ["st0", "st1", "st2", "st3"]
COLORS = {"st0": "#C4282D", "st1": "#0075BB", "st2": "#00934C", "st3": "#FDB845"}

# Grid layout in the output canvas
COLS = 12
PITCH = 200.0
PAD = 20.0


def f(x):
    """Compact float formatting."""
    return f"{x:.6f}".rstrip("0").rstrip(".")


def esc_attr(ch):
    """Escape a single char for use in a double-quoted XML attribute."""
    return {
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
    }.get(ch, ch)


def frame_path(gx, gy):
    """Outer + inner rect (the ring), winding matched to the original."""
    outer = (
        f"M{f(gx)},{f(gy)}v{f(BLOCK)}h{f(BLOCK)}"
        f"V{f(gy)}H{f(gx)}z"
    )
    bx, by = gx + BORDER, gy + BORDER
    fx, fy = gx + INNER_FAR, gy + INNER_FAR
    inner = (
        f"M{f(fx)},{f(fy)}H{f(bx)}V{f(by)}"
        f"h{f(INNER)}V{f(fy)}z"
    )
    return outer + inner


font = TTFont(FONT)
gs = font.getGlyphSet()
cmap = font.getBestCmap()

chars = [chr(i) for i in range(0x20, 0x7f) if ord(chr(i)) in cmap]

paths = []
for idx, ch in enumerate(chars):
    col, row = idx % COLS, idx // COLS
    gx = PAD + col * PITCH
    gy = PAD + row * PITCH

    name = cmap[ord(ch)]
    glyph = gs[name]

    # horizontal centering: native x-center -> block center
    bp = BoundsPen(gs)
    glyph.draw(bp)
    if bp.bounds:
        xmin, _, xmax, _ = bp.bounds
        cx_native = (xmin + xmax) / 2
    else:
        cx_native = 0  # empty glyph (space)

    # native (y-up) -> output coords:
    #   X = SCALE*x + (CENTER_X - SCALE*cx_native) + gx
    #   Y = -SCALE*y + BASELINE + gy
    e = (CENTER_X - SCALE * cx_native) + gx
    fy_ = BASELINE + gy
    pen = SVGPathPen(gs)
    tpen = TransformPen(pen, (SCALE, 0, 0, -SCALE, e, fy_))
    glyph.draw(tpen)
    letter = pen.getCommands()

    d = frame_path(gx, gy) + letter
    cls = CLASSES[idx % len(CLASSES)]
    cp = ord(ch)
    paths.append(
        f'<path id="block_{cp:02X}" data-char="{esc_attr(ch)}" '
        f'class="{cls}" d="{d}"/>'
    )

W = PAD * 2 + COLS * PITCH
rows = (len(chars) + COLS - 1) // COLS
H = PAD * 2 + rows * PITCH

style = "\n".join(f"\t.{c}{{fill:{COLORS[c]};}}" for c in CLASSES)
svg = (
    '<?xml version="1.0" encoding="utf-8"?>\n'
    f'<svg version="1.1" xmlns="http://www.w3.org/2000/svg" '
    f'xmlns:xlink="http://www.w3.org/1999/xlink" '
    f'viewBox="0 0 {f(W)} {f(H)}">\n'
    f'<style type="text/css">\n{style}\n</style>\n'
    + "\n".join(paths)
    + "\n</svg>\n"
)
with open(OUT, "w") as fh:
    fh.write(svg)
print(f"wrote {OUT}: {len(chars)} blocks, {COLS}x{rows} grid, "
      f"viewBox {f(W)}x{f(H)}")
