# Analysis of coylean.js — The Exploration Architecture

## coyleanExploration: A Clean Separation

The legacy code (`coyleanLegacy`) interleaves computation and rendering —
every `if/else` branch both updates state AND draws a line. This makes the
algorithm hard to reason about, hard to test, and impossible to reuse.

`coyleanExploration` fixes this completely:

```javascript
let [downMatrix, rightMatrix] = seLoop(height, width);

for (let j = 0; j < SIZE; j++) {
    for (let i = 0; i < SIZE; i++) {
        cell(downMatrix[j][i], rightMatrix[i][j], i, j);
    }
}
```

Two phases: compute, then render. The entire Coylean algorithm reduces to
building two boolean matrices. The `cell()` function is a pure renderer —
it doesn't know or care about priorities, propagation, or seeds. And
`reaction()` is pure logic — no canvas, no globals (aside from the
position offsets). This is the correct factoring of the problem.

## reaction(): The Atom of the Algorithm

```javascript
function reaction(vertical, horizontal, i, j) {
    let downWins = pri(i + hInitCol) >= pri(j + vInitRow);
    ...
}
```

This is the Coylean algorithm distilled to its essence. Two booleans come
in (is there a vertical arrow? a horizontal arrow?), two booleans come out
(do they continue?). The priority comparison decides who wins.

The four cases are:

| vertical | horizontal | downWins | out-vertical | out-horizontal |
| -------- | ---------- | -------- | ------------ | -------------- |
| false    | false      | —        | false        | false          |
| true     | true       | true     | true         | false          |
| true     | true       | false    | false        | true           |
| true     | false      | true     | true         | true           |
| true     | false      | false    | true         | false          |
| false    | true       | true     | false        | true           |
| false    | true       | false    | true         | true           |

Read another way: when both arrows are present, the winner survives and
the loser dies. When only one arrow is present, it always survives, and
the winner's direction **generates** a new arrow. This is the XOR toggle
expressed as a truth table rather than a flip operation.

## The Mystery of a[0] and a[1]

```javascript
[downMatrix[j + 1][i] = a[0], rightMatrix[i + 1][j] = a[1]] = reaction(
    downMatrix[j][i],
    rightMatrix[i][j],
    i,
    j,
);
```

This is JavaScript destructuring with default values. The `= a[0]` and
`= a[1]` would fire if `reaction()` returned `undefined` in either
position. But `reaction()` always returns a complete `[bool, bool]` pair,
so the defaults never execute.

`a` is never defined anywhere in the file. It's a ghost — likely the
remnant of something like `const a = [false, false]` that was deleted
while the references survived. The code works only because the defaults
are never reached. If `reaction()` ever returned a short array, this would
throw a ReferenceError.

The fix is simply to remove the defaults:

```javascript
[downMatrix[j + 1][i], rightMatrix[i + 1][j]] = reaction(
    downMatrix[j][i],
    rightMatrix[i][j],
    i,
    j,
);
```

## seLoop: A Name Too Specific for What It Does

`seLoop` stands for "Southeast Loop" — it propagates arrows rightward and
downward. But as `reaction()` demonstrates, the direction doesn't matter
to the logic. The same computation applies in any direction; only the
initial conditions and iteration order change.

A better name: `propagate`, `computeGrid`, or `buildMatrices`.

The comments in `coyleanExploration` already sketch the four-direction
plan:

```javascript
// Future, do the same for the swLoop where we go left. -i.
//   hInitCol = (-hInitCol + 1)
// The nwLoop, where we go left and up.
//   hInitCol = (-hInitCol + 1)
//   vInitRow = (-vInitRow + 1)
// The neLoop, where we go up.
//   vInitRow = (-vInitRow + 1)
```

These were never implemented, but the insight is correct and profound.

## hInitCol and vInitRow: The Universe in Two Variables

These are the most important variables in the file.

```javascript
let hInitCol = 1;
let vInitRow = 1;
```

They enter the algorithm at exactly one point — the priority comparison:

```javascript
let downWins = pri(i + hInitCol) >= pri(j + vInitRow);
```

With the defaults (1, 1), this is `pri(i+1) >= pri(j+1)`. The "+1" offset
means position 0 in the grid maps to priority position 1, which has
priority 0 (the lowest). The axis line at position 0 (with its infinite
priority) is **excluded** from the computation. The grid starts one step
past the axis.

### What hInitCol=0 means

Setting `hInitCol=0` changes the comparison to `pri(i) >= pri(j+1)`.
Now position i=0 maps to `pri(0) = 100` (maximum priority). **The vertical
axis line is included in the grid.** Column 0 has infinite priority and
will never be flipped — it's a permanent vertical line, exactly the
`d[0] = true` seed from the standard algorithm.

### The four quadrants

| hInitCol | vInitRow | Direction   | Quadrant     | Universe seed |
| --------- | -------- | ----------- | ------------ | ------------- |
| 1         | 1        | SE (+x, +y) | bottom-right | F (V₇₇)       |
| 0         | 1        | SW (−x, +y) | bottom-left  | J×sₕ (V₇₃)    |
| 0         | 0        | NW (−x, −y) | top-left     | J (V₆₆)       |
| 1         | 0        | NE (+x, −y) | top-right    | M (V₅₆)       |

Each quadrant is computed by:

1. Setting hInitCol and vInitRow to include or exclude each axis
2. Flipping the iteration direction for each axis that's included
   (propagate away from the origin, not toward it)

The formula `(-pos + 1)` toggles between 0 and 1 — selecting whether
each axis line participates in the computation.

But 0 and 1 are just the most natural values. These variables are
**integers, not booleans.**

### Beyond 0 and 1: the full parameter space

`hInitCol` and `vInitRow` can be any integer. The priority comparison
`pri(i + hInitCol) >= pri(j + vInitRow)` shifts the entire priority
grid by an arbitrary offset in each direction.

With the default (1, 1), the priority landscape is:

```
i+1:  1  2  3  4  5  6  7  8  ...
pri:  0  1  0  2  0  1  0  3  ...
```

The clean binary hierarchy: every 2nd position is priority 0, every 4th
is priority 1, every 8th is priority 2. This is what produces the
regular, self-similar Coylean map with its 4-cell sections.

With hInitCol=3, the landscape shifts:

```
i+3:  3  4  5  6  7  8  9  10 ...
pri:  0  2  0  1  0  3  0  1  ...
```

The hierarchy is the same sequence but **phase-shifted**. The high-priority
positions land in different columns, breaking the alignment between the
section grid and the priority structure. The map is still deterministic,
still governed by XOR propagation, but its self-similar structure is
disrupted.

The **evenness of the offset determines how strange the map becomes**:

- **Even offsets** (2, 4, 8, ...): The offset is itself divisible by 2,
  so `pri(i + offset)` still has some alignment with the binary hierarchy.
  Higher powers of 2 produce more regular maps. In particular,
  `hInitCol = 2^k` shifts by a full period at level k, preserving the
  structure at scales larger than 2^k.

- **Odd offsets** (1, 3, 5, 7, ...): The least even values. `pri(i + odd)`
  disrupts the priority alignment at the finest scale. Odd offsets other
  than 1 produce maps where the first section boundary falls in an
  unexpected place, breaking the regular tiling.

- **hInitCol=0 and hInitCol=1** are the two values that straddle the
  highest-priority line (position 0, the axis). `pos=1` places you one
  step to the right of the axis; `pos=0` includes the axis itself.
  These are the two "natural" positions — one on each side of the
  infinite-priority boundary. This is why they produce the four clean
  universe quadrants.

- **Values near highly even numbers** get local relief. For example,
  `hInitCol=15` or `hInitCol=16` are near the priority-4 line at
  position 16. The map is disrupted globally but has local regularity
  near that high-priority boundary — as if the offset found a smaller
  "axis" to orbit around. The further from any power of 2, the wilder
  the map.

So the parameter space has a fractal structure of its own: values
with more factors of 2 produce more regular maps, and the most
irregular maps come from the most odd values. The Coylean map's
self-similarity is not just a property of the algorithm — it's a
property of the specific (1, 1) offset within a space of possible
offsets, most of which break it.

### Evenness, oddness, and -1

A note on the priority function itself. `pri(n)` counts trailing zeros
in the binary representation of n — its 2-adic valuation, or "evenness":

```
  12 = 1100₂  →  2 trailing zeros  →  pri(12) = 2
   7 = 0111₂  →  0 trailing zeros  →  pri(7) = 0
   0 = 0000₂  →  all zeros          →  pri(0) = ∞
```

There's a dual operation: counting trailing **ones** ("oddness"):

```
  12 = 1100₂  →  0 trailing ones  →  oddness(12) = 0
   7 = 0111₂  →  3 trailing ones  →  oddness(7) = 3
  -1 = 1111₂  →  all ones          →  oddness(-1) = ∞
```

The relationship: **evenness(n) = oddness(n − 1)**. Subtracting 1 from a
binary number flips all trailing zeros to ones (and the lowest one to
zero) — exactly swapping the trailing-zeros count with the trailing-ones
count.

```
  n   = ...1 000  →  evenness = 3
  n-1 = ...0 111  →  oddness  = 3
```

This means the two "infinite priority" values are duals:

- **0** has infinite evenness (all trailing zeros) — the standard axis
- **−1** has infinite oddness (all trailing ones) — the "odd axis"

And `hInitCol` connects them: `pri(i + 1)` is the evenness of `i + 1`,
which equals the oddness of `i`. So the standard Coylean map with
`hInitCol=1` is equivalently computing **oddness-based** priorities
on the raw grid positions. The "+1" offset converts the evenness function
into an oddness function.

### Why all initial arrows are true

`seLoop` initializes the top row of downs and left column of rights to all
`true`. This seems different from the standard algorithm's single
`d[0] = true` seed. But they're equivalent:

In the standard algorithm, `d[0] = true` has maximum priority. At the
first row (y=0), `d[0]` flips `r[0]` to true. Then `r[0]` propagates
rightward, flipping every `d[i]` to true (since `pri(0) > pri(i)` for
all i > 0). By the time row 0 is complete, **every vertical and horizontal
arrow is present**.

`seLoop` simply starts from this fully-propagated state. It skips the
bootstrapping and begins where the standard algorithm arrives after its
first row. The initial "all true" IS the d[0]=true seed, already expanded.

### Connection to the horizontal seed question

This explains why `r[0] = true` (the "horizontal seed") isn't an
independent variable in the standard algorithm. With `d[0] = true` and
`hInitCol=1`, the vertical seed at position 0 has maximum priority. It
flips every horizontal arrow that passes through it. Setting `r[0]` to
true or false before the loop doesn't matter — it gets immediately
overwritten by the interaction with `d[0]`.

The horizontal seed becomes meaningful only when `vInitRow=0`, which
includes the horizontal axis line at maximum priority. In that
configuration, both axis lines are permanent structures, and their
intersection at the origin IS the Coylean seed.

## All Relevant Globals and Constants

| Variable         | Line | Default | Role                                                   |
| ---------------- | ---- | ------- | ------------------------------------------------------ |
| `hInitCol`      | 112  | 1       | Horizontal priority offset (0=include axis, 1=exclude) |
| `vInitRow`       | 113  | 1       | Vertical priority offset (0=include axis, 1=exclude)   |
| `SIZE`           | 59   | 65      | Grid dimension. 65 = 2⁶+1, an order 6 map              |
| `SCALE`          | 86   | 8       | Pixel size per cell                                    |
| `feature_active` | 13   | false   | Toggle: exploration vs legacy rendering                |
| `g`              | 2    | —       | Canvas 2D context (global, set in `exploreMap`)        |

### SIZE = 65 = 2⁶ + 1

This follows the Coylean dimension rule: order n requires 2ⁿ + 1 cells
per axis, not 2ⁿ. The "+1" accounts for the boundary cell — or
equivalently, for the axis line that `hInitCol`/`vInitRow` can include
or exclude.

### The Row and Col classes

```javascript
class Row extends Array {
    toString() {
        return this.reduce((p, c) => p + (c ? "|" : "o"), "");
    }
}
class Col extends Array {
    toString() {
        return this.reduce((p, c) => p + (c ? "-" : "o"), "");
    }
}
```

Neat debugging helpers. `Row` prints vertical arrows as `|` and absent
as `o`. `Col` prints horizontal arrows as `-`. They make the boolean
matrices human-readable in the console.

## Analytic Continuation: Propagation in Negative Directions

The term is borrowed from complex analysis, where a function defined on
one region is extended to a larger domain while preserving its algebraic
structure. Here the "function" is `propagate()`, defined for the SE
quadrant (+i, +j), and we want to continue it westward (−i direction).

### What propagate computes

`propagate()` fills two matrices by iterating i = 0, 1, 2, ... and
j = 0, 1, 2, ..., with initial conditions: top row all true, left column
all true. These represent arrows arriving from the axis boundary.

At each cell, `reaction()` asks: `pri(i + hInitCol) >= pri(j + vInitRow)?`

The entire map structure is encoded in this priority comparison.

### The axis as a mirror

The axis line lives at the position where `pri() = ∞` — i.e., where
`i + hInitCol = 0`, or `i = -hInitCol`. With the standard `hInitCol=1`,
the axis is at global position i = −1, one step left of the grid's
origin.

The axis has infinite priority. It never loses. Every perpendicular arrow
that crosses it gets flipped. This makes it a **perfect mirror**: arrows
arrive from the east, hit the axis, and get reflected back as the initial
conditions for the westward propagation.

This is why `propagate()` starts with all-true boundaries — those are the
arrows the axis reflects.

### Continuing westward

To propagate leftward (−i direction), we need three things:

**1. Reverse the iteration.** Instead of i = 0, 1, 2, ..., we iterate
i = 0, −1, −2, ... (or equivalently, we iterate i = 0, 1, 2, ... and
map them to global positions going left).

**2. Shift the priority offset.** The original comments have the formula:

```
hInitCol_west = (-hInitCol + 1)
```

This toggles between 0 and 1: if the SE quadrant excludes the axis
(`hInitCol=1`), the SW quadrant includes it (`hInitCol=0`), and vice
versa. The two quadrants share the axis boundary between them — one must
include it, the other must not, to avoid double-counting.

**3. Keep the same initial conditions.** Arrows arriving at the SW
quadrant's right edge come from the axis, which reflects everything.
So the initial conditions are still all-true — but now they enter from
the RIGHT column instead of the left. The `propagate()` function's
"left column = all true" becomes "right column = all true" under the
horizontal flip.

### Why it works algebraically

The priority function has a key property: `pri(-n) = pri(n)` for all
nonzero n (since −n and n have the same power-of-2 factorization). This
means the priority landscape is **symmetric around 0**.

For the SE quadrant with `hInitCol=1`, the priority sequence at
columns 0, 1, 2, 3, ... is:

```
pri(0+1), pri(1+1), pri(2+1), pri(3+1) = pri(1), pri(2), pri(3), pri(4)
                                        = 0, 1, 0, 2
```

For the SW quadrant going left with `hInitCol=0`, the priority sequence
at columns 0, 1, 2, 3, ... (mapped to global positions 0, −1, −2, −3) is:

```
pri(0+0), pri(1+0), pri(2+0), pri(3+0) = pri(0), pri(1), pri(2), pri(3)
                                        = ∞, 0, 1, 0
```

The SW sequence starts with ∞ (the axis itself) then continues with 0,
1, 0, ... — the SAME values as the SE sequence, just with the axis
prepended. The axis is the hinge that connects the two halves.

### The four continuations

| Direction   | hInitCol | vInitRow | Axis included |
| ----------- | --------- | -------- | ------------- |
| SE (+i, +j) | 1         | 1        | neither       |
| SW (−i, +j) | 0         | 1        | vertical      |
| NE (+i, −j) | 1         | 0        | horizontal    |
| NW (−i, −j) | 0         | 0        | both          |

Each continuation is `propagate()` with adjusted offsets and a flipped
read-out direction. The function itself doesn't change. This is the
sense in which it's an analytic continuation: the same algebraic rule,
the same function, extended across a boundary.

### What changes at the boundary

The axis line is where the continuation is glued together. In the SE
quadrant, the axis is just off-grid (at position −1). In the SW quadrant,
the axis is at position 0 (the first column). The two grids share the
same all-true boundary — they agree on the values at the seam.

But the boundary is not perfectly symmetric. The horizontal arrow state
**at the axis** depends on which side processes it first. With the
standard tie-breaking (`>=`, vertical wins), the vertical axis always
wins, so horizontal arrows at the axis are determined by the vertical
arrows, not vice versa. This is why the universe seed has asymmetric
horizontal boundaries:

```
 J     │ M          vertical boundaries: both present (the axis)
       │───         horizontal boundary: only right side (M─F)
 J×sₕ  │ F          left side (J─J×sₕ): no horizontal boundary
```

The vertical axis is permanent. The horizontal state at the axis is a
**consequence** of the vertical axis acting on the horizontal arrows —
and the tie-breaking rule makes this asymmetric. The horizontal boundary
exists between M and F (where the horizontal arrows were flipped by the
vertical axis) but not between J and J×sₕ (where they weren't, because
the propagation goes the other direction).

### Toward a single universal propagate

The four calls to `propagate()` could be unified into a single function
that computes all four quadrants simultaneously, sharing the axis boundary.
The axis would be computed once, and each quadrant would read its initial
conditions from the appropriate edge of the axis interaction.

This is exactly what the universe seed accomplishes in the substitution
framework: the 2×2 seed (J, M, J×sₕ, F) with its boundary data IS the
axis interaction, pre-computed. The substitution table then propagates
each quadrant independently.

The two frameworks — `propagate()` with offset parameters, and seed
expansion with the substitution table — are dual descriptions of the same
analytic continuation.

## Summary

`coyleanExploration` is the right architecture: separate computation from
rendering, factor the algorithm into a pure `reaction()` function, and
parameterize the quadrant selection with `hInitCol` and `vInitRow`.

The four-quadrant universe that we built in the explorer page using the
2×2 seed (J | M / J×sₕ | F) is the same thing this code expresses with
two integer offsets and a direction flip. Two different representations of
the same mathematical structure — one as a substitution seed, one as a
parameterized propagation.

## Appendix

❯ Propose the structure of the universal propagation function.

Searched for 1 pattern, read 2 files (ctrl+o to expand)

⏺ Here's the structural proposal. The key insight from the analysis:  
 propagate() already computes any quadrant — we just need the right
offset and a coordinate flip.

### Universal Propagate — Proposed Structure

Strategy: Four quadrants, one axis

             N
             ↑
      NW     │     NE
     (0,0)   │   (1,0)
             │
    ─────────┼──────────→ E
             │
      SW     │     SE
     (0,1)   │   (1,1)     ← (hInitCol, vInitRow)
             │
             S

Each quadrant is a standard propagate() call. The offset parameter  
 (0 or 1) controls whether that quadrant includes its axis edge. The
four calls tile together without overlap or gap.

Signature

```

- Propagate the Coylean map across all four quadrants.
-
- @param {number} radius — extent in each direction (2^n for order
  n)
- @returns {{ down: boolean[][], right: boolean[][] }}
- Matrices indexed in global coordinates: [-radius..+radius]
- Stored with offset: array index = global coord + radius
   \*/
  function universalPropagate(radius)
```

### Internal structure

1. Compute four quadrants (independent — parallelizable)
   SE = propagate(radius, radius, 1, 1) // neither axis
   SW = propagate(radius, radius, 0, 1) // includes vertical axis
   (col 0)
   NE = propagate(radius, radius, 1, 0) // includes horizontal
   axis (row 0)
   NW = propagate(radius, radius, 0, 0) // includes both axes
2. Allocate global matrices
   size = 2 \* radius + 1
   down[size+1][size] — vertical arrows
   right[size][size+1] — horizontal arrows

3. Assemble — flip and place
   SE → as-is into global [+1..+R, +1..+R]
   SW → flip cols into global [−R..0, +1..+R]
   NE → flip rows into global [+1..+R, −R..0]
   NW → flip both into global [−R..0, −R..0]
   Axis ownership:
   • Vertical axis (col 0): from SW or NW (hInitCol = 0)
   • Horizontal axis (row 0): from NE or NW (vInitRow = 0)
   • Origin (0,0): from NW (both = 0)

### Why the flips work

Each quadrant's propagate() iterates away from the axis in local  
 coordinates (i = 0, 1, 2...). In global coordinates:

┌──────────┬──────────────────────────┬──────────────────────────┐  
 │ Quadrant │ Local i=0,1,2... maps to │ Local j=0,1,2... maps to │
│ │ global │ global │  
 ├──────────┼──────────────────────────┼──────────────────────────┤  
 │ SE │ +1, +2, +3... │ +1, +2, +3... │
├──────────┼──────────────────────────┼──────────────────────────┤  
 │ SW │ 0, −1, −2... │ +1, +2, +3... │  
 ├──────────┼──────────────────────────┼──────────────────────────┤  
 │ NE │ +1, +2, +3... │ 0, −1, −2... │  
 ├──────────┼──────────────────────────┼──────────────────────────┤  
 │ NW │ 0, −1, −2... │ 0, −1, −2... │
└──────────┴──────────────────────────┴──────────────────────────┘

The flip during assembly reverses the array to match global  
 ordering. Priority is symmetric (pri(n) = pri(-n) for n ≠ 0), so the
flipped quadrant's priority landscape is correct.

What reaction() needs

No changes. It already takes (vertical, horizontal, i, j, hInitCol,
vInitRow) — the offset parameter handles everything. The only new
concern is the assembly step, which is pure index arithmetic.

### Alternative: direct global iteration

Instead of four calls + assembly, iterate once over the full grid:

```
for (let j = -radius; j <= radius; j++) {
 for (let i = -radius; i <= radius; i++) {
 // priority: pri(|i|) >= pri(|j|)
 // arrow source depends on quadrant:
 // SE: from (i-1, j) and (i, j-1)
 // SW: from (i+1, j) and (i, j-1)
 // NE: from (i-1, j) and (i, j+1)
 // NW: from (i+1, j) and (i, j+1)
 let di = i > 0 ? -1 : +1; // look toward axis
 let dj = j > 0 ? -1 : +1;
 // ... reaction using arrow from (i+di, j) and (i, j+dj)
 }
 }
```

This is more elegant but requires careful iteration order — each  
 quadrant must be filled outward from the axis. You'd need four
nested loops anyway (or a spiral), so it's not obviously simpler  
 than the four-call approach.

### Recommendation

The four-call assembly approach. It reuses propagate() unchanged,  
 makes the quadrant structure explicit, and the assembly is just
array flips. The direct-iteration version is mathematically cleaner
but harder to verify and doesn't let you reuse the existing tested
function.
