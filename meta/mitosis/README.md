# Mitosis

A Conduits/Turtle-Paradise side project: the **elaborate cell as a dividing
cell**, animated from Jake's hand-drawn Excalidraw worksheets
(`../conduits/ElaborateMitosis.md`, `../conduits/life-cycle.md`). The Excalidraw
has **two side-by-side sequences** — a main column and its v/h transpose — and
this project decodes both, sequences each figure as an SVG, and animates them.

## Contents

| path | what |
|---|---|
| `index.html` | **the page** — the two sequences side by side (main + v/h); linked from the Conduits index |
| `figures/` | the Excalidraw figures decoded, each an SVG. **Main (left column):** `green/` (order 1, 4) ⊂ `yellow/` (order 2, 6) ⊂ `violet/` (order 3, 8). **`vh/`:** the v/h version (18) — the diagonal transpose. Plus `parts-bin.svg` / `loose-components.svg`. See `figures/README.md` for the analysis. |
| `figures/mitosis-sequence.gif` | the main sequence, green → yellow → violet, cross-faded |
| `figures/vh-sequence.gif` | the v/h (transposed, portrait) sequence |
| `figures/mitosis-violet.gif` | stop-motion of just the 8 violet stages |

## The idea

The hand-drawn figures are idealisations of the **elaborate render**'s cells
(priority shells: green ⊃ cream ⊃ purple ⊃ the vacuum core). A cell's frame
colour names its **order** (the spine priority): green = 1, yellow/cream = 2,
violet/purple = 3 — a higher order carries the lower ones as its inner shells.
Climbing the ladder doubles the cell count, so each step is one **mitotic
division**.

## The two sequences

- **Main (left column)** — `green/` → `yellow/` → `violet/`, cells *wider than
  high*, dividing **side-by-side**.
- **v/h version (right column)** — the same sequence through the **main
  diagonal** (H = V transposed, the D1 backslash): cells *higher than wide*,
  dividing **top-and-bottom**. Jake drew it out only as far as the first five
  figures; the rest of `vh/` is completed by transposing the left figures
  (swap each rect's x↔y and w↔h). Verified: the transpose of the left's first
  figures reproduces the hand-drawn five.

Both play together on `index.html`.

## Rebuilding the GIFs

The figure SVGs are the committed source. To re-assemble a GIF, render the
ordered SVGs to PNG (any self-contained rasteriser — e.g. `@resvg/resvg-js`;
ImageMagick's own SVG delegate mangles colours), centre each on a common canvas,
then `magick -delay <d> @list.png -morph 5 -loop 0 -layers optimize out.gif`
(the `-morph` frames are the cross-fade). The v/h SVGs are transposes of the
main ones.
