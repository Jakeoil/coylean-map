# Elaborate Mitosis — figure analysis

Decoded from `../../conduits/ElaborateMitosis.md` (an Obsidian-Excalidraw doc)
and read against `../../conduits/life-cycle.md`. The drawing is **322 rounded
rectangles + 6 text labels**, no grouping — every figure is defined purely by *spatial nesting* and
*colour*. This folder holds each figure pulled out as its own SVG, put in
sequence.

> These are hand-drawn idealisations of the cells in the **elaborate render**
> (`elaborate-cell.js` → `renderComplex`, the priority-shell renderer). A real
> elaborate cell is a priority-sized rectangle drawn as nested colour shells
> (`COLOR_LIST`: green ⊃ cream ⊃ purple ⊃ cyan…); the rounded rects here are
> the same shells, redrawn by hand with rounded corners and a cleaner palette.

## The palette is the order ladder

Per `glyph-lore.md`, **a cell's frame colour names its order** (identity rides
the highest *normal* priority, the spine):

| family | excalidraw fill | "real" `COLOR_LIST` hue | priority / order | what the figure shows |
|---|---|---|---|---|
| `green/` | `#b2f2bb` green | `#8FBC8F` green | **1** | the simplest cell: a green body holding 1 white nucleus → 2 nuclei |
| `yellow/` | `#ffec99` yellow | `#FFEBCD` **cream** (blanchedalmond) | **2** | two green lobes inside a cream body, with developing white bars |
| `violet/` | `#d0bfff` violet | `#8A2BE2` purple | **3** | the full elaborate cell: violet ⊃ cream ⊃ green compartments ⊃ white bars |

(The Excalidraw `#ffec99` is a brighter stand-in for the real priority-2 hue,
which is **cream** `#FFEBCD`; likewise violet stands in for purple.)

So the three colour bands are **not three drawings of one thing — they are the
same cell at orders 1, 2, 3.** Climbing the ladder is the mitosis: each order
adds a shell and doubles the compartment count (order *n* square = 2ⁿ+1 cells
per axis), so every order-step is one division.

This is confirmed by the nesting in the drawing itself, not just the
identity-colour rule: **every** yellow figure contains a green shell, and
**every** violet figure contains both yellow and green shells — the cells nest
`green ⊂ yellow ⊂ violet`, a higher order literally carrying the lower orders as
its inner shells.

## Two columns: the sequence and its v/h version

The Excalidraw holds **two side-by-side sequences**. The **left column is the
main sequence** (animated in `mitosis-sequence.gif`); the **right column is its
v/h version** (`vh-sequence.gif`) — the same cells through the **main diagonal**
(H = V transposed, the D1 backslash): where the left cell is wider-than-high and
splits side-by-side, the right is higher-than-wide and splits top-and-bottom.
Jake drew the right out only as far as the **first five**; the later stages in
`vh/` are completed by transposing the left figures. Both play together on
`../index.html`. (The violet-only stop-motion is `mitosis-violet.gif`.)

Read top-to-bottom on Jake's canvas; that is the developmental order.

1. **`green/` (order 1, 4 figures)** — interphase. A green cell with a single
   white nucleus, then the nucleus pairs (the first division).
2. **`yellow/` (order 2, 6 figures)** — two green lobes appear inside a cream
   body; white bars (the glyph's V/H strokes) accumulate lobe by lobe.
3. **`violet/` (order 3, 8 figures)** — the elaborate cell, and the heart of the
   piece. Stages:
   - `violet-1..4` — **growth**: one cell, two green compartments, white bars
     multiplying and rearranging (members 10→14→13→21→22).
   - `violet-5..8` — **cleavage**: a vertical cream/violet seam runs down the
     middle and the cell splits into two daughters, each re-growing its own
     green compartments and bars, heading toward four (members jump **22→35**→
     39→40 — the leap is the new division walls going up).

`parts-bin.svg` is a single order-3 cell crammed with ~40 white bars of every
shape — the **vocabulary of components** ("many forms for the same thing")
collected in one frame. `loose-components.svg` gathers the 19 stray bars/squares
scattered at the top of the canvas: the raw parts before assembly.

## Deliberate mathematical inconsistency

The text labels read `3/2`, `1.5/1`, `1/.66`, `1.5x1`, `.75x.5` — all loose
names for the same thing. The intent is the **√2 ratio** (1.414…), so a vertical
cell and a horizontal cell are *geometrically similar* (one is the other
turned 90°) and read alike. The figures are diagrammatic, not literal: the true
`renderComplex` sizes a cell `downPri·2 × rightPri·2` (integer priorities, never
√2). Tellingly, **only the violet/order-3 band actually holds the ratio** — all
eight are 1.445 — while the green and yellow precursors were sketched freehand
(0.89–1.56). The √2 discipline is adopted exactly where the drawing becomes
"elaborate."

## Relation to `life-cycle.md`

`life-cycle.md` is the **cyclic** companion to this **linear** sheet. It places
the same green/yellow/violet √2 cells around a loop (a small arrow, `day` /
`night` labels) with a concentric rainbow **elaborate nucleus** at the centre —
the literal `COLOR_LIST` shell-nesting (red ⊃ green ⊃ blue ⊃ violet ⊃ …) that
the rounded figures abstract. Its bars are drawn pink/red rather than white —
one more palette variant of the same component vocabulary. Where ElaborateMitosis
unrolls *one* division as a left-to-right/top-to-bottom sequence, life-cycle
closes it into the cell's recurring day–night round.

## Reproducing

The drawings are LZString-compressed inside the `.md` files. To re-extract:
decompress the ` ```compressed-json ` block with `lz-string`
(`decompressFromBase64`), then each top-level rounded rect + the rects nested
inside it (by centre-containment) is one figure. The SVGs here were rendered
straight from those rects (rounded-rect corner radius = `min(32, 0.25·min(w,h))`,
Excalidraw's adaptive radius).
