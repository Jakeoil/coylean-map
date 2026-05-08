# How to Draw a Coylean Map

A Coylean map is a square grid of cells. Each cell decides whether a vertical
line lives on its right edge and whether a horizontal line lives on its bottom
edge. The decisions are made one cell at a time by a tiny rule and propagate
across the grid.

## 1. Priority

Every cell `(i, j)` (column `i`, row `j`, both starting at 0) gets a column
priority and a row priority. Priority is the **2-adic valuation** — the number
of times 2 divides the index when shifted by 1:

```
pri(n) = number of trailing zeros of n in binary
```

- `pri(1) = 0`
- `pri(2) = 1`
- `pri(3) = 0`
- `pri(4) = 2`
- `pri(8) = 3`

The cell uses `colP = pri(i + 1)` and `rowP = pri(j + 1)`. Higher means "more
even".

## 2. Reaction

Two arrows can enter a cell:

- **V** — a vertical arrow from above
- **H** — a horizontal arrow from the left

The cell emits up to two arrows:

- **V′** — vertical out the bottom (becomes V of the cell below)
- **H′** — horizontal out the right (becomes H of the cell to the right)

The reaction is decided by which axis wins priority. With **vertical
seniority** (the default, `colP >= rowP`):

| V in | H in | Priority wins | V out | H out |             |
| :--: | :--: | :-----------: | :---: | :---: | ----------- |
|  0   |  0   |       —       |   0   |   0   | empty       |
|  1   |  1   |       V       |   1   |   0   | V continues, H absorbed |
|  1   |  1   |       H       |   0   |   1   | H continues, V absorbed |
|  1   |  0   |       V       |   1   |   1   | V continues, spawns H   |
|  1   |  0   |       H       |   1   |   0   | V continues alone       |
|  0   |  1   |       V       |   0   |   1   | H continues alone       |
|  0   |  1   |       H       |   1   |   1   | H continues, spawns V   |

Compactly: an arrow that's present always continues straight. If the priority
winner is also the present arrow, it additionally spawns the perpendicular.
When both are present, the winner survives and the loser is absorbed.

## 3. Propagation

Seed the boundary:

- top row of V inputs — all true
- left column of H inputs — all true

Sweep through the grid in row-major order. At each cell, apply the reaction.
The outputs become the inputs of the south and east neighbors:

- `V out of (i, j)` → `V into (i, j+1)`
- `H out of (i, j)` → `H into (i+1, j)`

That's it. The two boolean matrices `down[j][i]` (right edges) and
`right[i][j]` (bottom edges) are the whole map.

## 4. Drawing

Each true `down[j][i]` is a vertical segment on the right side of cell
`(i, j)`. Each true `right[i][j]` is a horizontal segment along the bottom of
cell `(i, j)`. To render, walk every grid vertex and pick a glyph from its
four incident edges (N, E, S, W) — there are 16 cases, all available as
Unicode box-drawing characters: `┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼ ─ │` and friends.

## Try it

`draw-coylean.mjs` (in this same folder) is a self-contained Node program
that runs the algorithm on an 8×8 grid and prints it with box-drawing
characters:

```
node meta/toy-rendering/draw-coylean.mjs
```
