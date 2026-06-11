#!/usr/bin/env python3
"""Extract A-Z and 0-9 outlines from News 706 Bold.otf to SVG path data.

Scratch tool for the viability comparison (font-extracted letters vs the
letters already baked into AlphabetBlocks.svg). Emits font-letters.json:
{ "A": "<svg path d, y-down>", ... }. The path is in font units (y flipped
into SVG's y-down space); the comparison page fits each by its bounding box,
so absolute scale/position here don't matter.
"""
import json

from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONT = "../News 706 Bold.otf"
OUT = "font-letters.json"

font = TTFont(FONT)
glyphset = font.getGlyphSet()
cmap = font.getBestCmap()
upm = font["head"].unitsPerEm

# all printable ASCII (covers every symbol used in assignments.json)
chars = "".join(chr(i) for i in range(0x20, 0x7f))
out = {}
for ch in chars:
    if ord(ch) not in cmap:
        continue
    name = cmap[ord(ch)]
    pen = SVGPathPen(glyphset)
    # flip y (font y-up -> svg y-down), keep glyph in positive space
    tpen = TransformPen(pen, (1, 0, 0, -1, 0, upm))
    glyphset[name].draw(tpen)
    out[ch] = pen.getCommands()

with open(OUT, "w") as fh:
    json.dump(out, fh, indent=0)
print(f"wrote {OUT}: {len(out)} glyphs, upm={upm}")
