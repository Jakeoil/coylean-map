# baby-blocks/test — provenance for the complete block set

`../AlphabetBlocks-complete.svg` (all 95 printable ASCII blocks) is generated
from the **News 706 Bold** typeface. That font is **proprietary** (Bitstream
Inc., "All rights reserved" — now Monotype) and is **not** checked into the
repo. The generated SVG holds only outlines and is self-contained; the app
never needs the font at runtime.

To regenerate, drop `News 706 Bold.otf` into `baby-blocks/` (it's gitignored),
then run from this directory:

```sh
python3 extract-font-letters.py   # -> font-letters.json (all 95 glyphs)
python3 calibrate.py              # derives the font->block transform
python3 generate.py               # -> ../AlphabetBlocks-complete.svg
```

Pages (served via your dev server):

- `compare.html` — font glyphs vs the original 36 in `AlphabetBlocks.svg`
  (overlay), the viability check that confirmed the source typeface.
- `preview.html` — the full generated set rendered as real blocks through
  `baby-blocks.js`.

Calibration (from `calibrate.py`, stdev 0 across E F H I L T): scale **0.14**,
caps baseline at block-local y **142.80**, centered at **91.77**.
