# Zoom & crowding — a phased LOD model

Design note for how gridlines around the conformal cells should thin out
(crowding) and how new subdivisions should appear (zoom) on the globe.
Status: **agreed model, not yet built.** The three interpretation points are now
settled (see *Settled decisions* at the end).

## Two sizes of a cell

Every cell (square) has **two** measures, and the whole model turns on keeping
them separate:

- **Mathematical size** — the cell's size in lattice/cell units: which dyadic
  level it lives at (`2^k × 2^k` finest cells). Independent of the camera. A
  polar cell and an equatorial cell at the same level have the *same*
  mathematical size.
- **Drawn size** — its size in screen pixels after projection. Varies with the
  view, for two reasons:
  1. **distance** — perspective foreshortening (the `camera/(camera−z)` scale);
  2. **nearness to a pole** — parallels shrink by `cos(lat)` toward the pole, so
     a mathematically-square cell is drawn smaller the higher its latitude.

Both shrink the *drawn* size while leaving the *mathematical* size untouched, and
**the crowding algorithm treats them identically** — it only ever looks at drawn
size.

## Two quantities: line thickness, and on-screen presence

Keep these separate.

**`lineWeight(p)` — the drawn thickness of a line.** A function of the line's
**dyadic priority `p`** and the **`lineEmphasis` knob** only — *not* of the cell's
drawn size. Senior priority → thicker; the emphasis dial scales them all. This is
exactly today's curve, `thickness ≈ lineEmphasis · (a + b·p)` (cf. the existing
`(0.22 + rv·0.34)·lineScale`). Since in practice we're almost always looking at
**the thinnest visible lines**, the exact `a, b` barely matter — what matters is
the ordering (senior > junior) and the emphasis scale. Reasonable guess:
`a ≈ 0.22`, `b ≈ 0.34`, in px, times `lineEmphasis`.

**On-screen presence — what the thresholds judge.** Whether a line is shown is a
question of its cell's **local drawn size `s`** (the per-latitude, per-depth
projected size — see below), weighted by its thickness. The scalar compared
against the threshold knobs is roughly

```
presence(p) ≈ s · lineWeight(p)
```

so a heavier (senior, or high-emphasis) line survives down to a smaller drawn
cell than a junior one. The thinnest visible line at any moment is the one whose
`presence ≈ lineMin`.

## Two thresholds on the same weight axis

### `lineMin` — the invisibility limit (crowding → coarsen)

When `presence(p) = s · lineWeight(p) < lineMin` the line is too thin to see, so
**suppress it**.
Suppressing a level's lines merges its cells into the next coarser conformal
squares. Those coarser squares may themselves keep shrinking (zoom out, or drift
toward a pole) until *they* hit `lineMin`, and so on — a continuous, reversible
coarsening as drawn size falls, and the reverse (lines reappearing) as it grows.

- `lineMin` is the knob on the invisibility limit.
- Because weight rises with `p`, **senior lines hit the limit "further along"**
  (at a smaller drawn size) than junior ones — so junior subdivisions vanish
  first and the senior skeleton is the last thing standing. This is the crowding
  fix for both distance and pole.

### `lineZoom` (a.k.a. `zoomPoint`) — the subdivision reveal (zoom → refine)

Same `presence`, compared against a *different, higher* value:

```
if presence ≥ lineZoom:  reveal the next finer subdivision (globally)
```

We start from a default coarse mathematical square — e.g. `2^10 × 2^10` finest
cells, or coarser — and as the view magnifies and the reference cell grows, the
grid **advances one dyadic level: every square splits into its four children
(`2^k → 2^(k−1)`), exposing the new internal lines.** This is how zoom-in *forms*
new lines instead of having everything present at once. **Deep zoom is the point**
— the level counter should run many levels down (`2^10` is just a starting
default; we want to keep diving).

- **The reveal is global and level-anchored.** At any zoom the whole globe sits
  at **one** base fractional size; squares of a given fractional size are all
  treated identically. `zoomPoint` advances that single level counter (driven by
  the largest/front reference cell), and the new level appears everywhere at
  once — not tile-by-tile in a ragged front.
- **Four children, one level finer** — `2^k → 2^(k−1)`, the Coylean 2×2
  substitution. (The proposal's `2^10 → 2^8` was add/multiply slip for `2^9`.)
- **`zoomPoint` is a taste knob** — the drawn tile size (px) at which a level
  splits. High → tiles split while still large and obvious; low (→ 1px) → split
  only once small (≈ the old crowded floor). **Implemented (Phase 2):**
  `pMin = ⌈log2(zoomPoint / cellArcPx)⌉`, and the render floor is
  `max(minPriFloor(density), pMin)` so it only ever coarsens the density floor.

### Where they meet

`zoomPoint` reveals levels from the top (coarse → fine as you zoom in); `lineMin`
culls from the bottom (fine → coarse as cells shrink). **When a square's drawn
size falls to `lineMin`, the `lineMin` algorithm takes over** — i.e. a level that
`zoomPoint` would reveal but which is already sub-`lineMin` somewhere (e.g. near
the pole) is simply suppressed there. The two compose into one continuous ladder.

## Pole vs equator falls out for free

The base fractional size is **uniform** across the globe (one level counter), but
drawn size carries the `cos(lat)` factor, so **a level's polar tiles are drawn
smaller than its equatorial tiles.** So:

- When `zoomPoint` advances the level, the **north/south tiles "try to split
  while they're smaller than the equatorial ones"** — same fractional size,
  smaller drawn size.
- The polar lines that fall below `lineMin` are then simply **culled by the
  suppression rule** — a per-line drawn cull on top of the uniform level. The
  model level stays uniform; the *render* near the pole just shows fewer lines.
  Visually the pole reads coarser, with no special-casing.

## Priority stagger within a level — the hand-drawing imitation

Down-lines and right-lines of the *same* level need not split together. Under **V
seniority the downs are mathematically senior (heavier) than the rights**, so in
`lineWeight` they carry more weight and **cross `zoomPoint` first**: on zoom-in
you see the **downs split, then the rights** a beat later. That staggered reveal
is exactly the order you'd lay the lines down drawing the map by hand. (Under H
seniority the roles swap.)

## Phased build

Each phase is independently shippable and testable.

- **Phase 1 — `lineWeight` + `lineMin`, drawn-size aware.**
  Replace the current global `minPriFloor(density)` (which keys off the
  *equatorial* `cellArcPx` only, latitude- and distance-blind) with a per-line
  `lineWeight(p, s)` where `s` is the **local** drawn cell size — i.e.
  `cellArcPx · cos(lat) · perspectiveScale`, not the front-equator constant.
  Suppress below `lineMin`. This alone fixes polar/distance crowding and gives
  the reversible coarsen/uncoarsen ladder. Knob: `lineMin`.

- **Phase 2 — `zoomPoint` reveal. *(done)*** Global uniform base level
  `pMin = ⌈log2(zoomPoint/cellArcPx)⌉` off the equatorial reference cell; render
  floor `max(minPriFloor(density), pMin)`. Cells split into four as `cellArcPx`
  doubles past each step, everywhere at once; Phase 1's `latBand` keeps culling
  the too-small instances poleward. Knob: **Zoom point** dial (px), default 1
  (≈ old floor), raise to split while tiles are larger.

- **Phase 3 — priority stagger (downs before rights for V). *(done)*** The
  reveal floor is split per orientation: downs ride the meridians (`floorM`),
  rights the parallels (`floorP`). The senior orientation (V → downs, H → rights)
  reveals at `zoomPoint`; the junior at `zoomPoint·2^STAGGER` (`STAGGER = 0.5`, the
  V/H tie-break half-level). So on zoom-in the two split on alternating
  half-doublings — one orientation, then the other, hand-drawing order.

### Mapping to current code (`coylean-globe.mjs`)

- `minPriFloor(density)` → folded into `lineWeight(p, s)` + the `lineMin`
  comparison, evaluated per line/region rather than once per frame.
- `cellArcPx()` (= `radius·dLon`, equatorial) → a **local** drawn-size helper
  carrying `cos(lat)` and the perspective scale, so weight reflects what's
  actually on screen at that latitude/depth.
- The `for p = floor … maxPri` sweep stays, but membership at each `p` becomes a
  `lineWeight` test (suppress / draw / reveal-next) instead of a hard floor.
- Ties into existing tiers: the **density wash** is the floor once even the
  coarsest lines fall below `lineMin`; **texture** is unaffected (it's the
  big-cell regime, well above both thresholds).

## Coordinate budget — 32 bits per axis (i = 16, balanced)

Each axis is a **32-bit fixed-point position** (signed ±2³¹ ≈ ±2.1 billion, safely
inside the 2⁵³ integer ceiling). **Never multiply two axis coordinates** — a
`row·col` product would reach 2⁶⁴ and lose precision; the descent keeps axes
independent, so this holds. Split the 32 bits down the middle:

- **OUTER — 16 bits — macro navigation ("which cell").**
  - **E–W:** winding number + column-within-turn. With a turn of `T` columns,
    `winds = 2¹⁶ / T` (T = 2⁸ → 256 winds; 2¹⁰ → 64). Keep the Division modest —
    the *inner* bits, not a huge `D`, carry the fine detail.
  - **N–S:** row toward the pole. 2¹⁶ rows reaches lat → 90° with room to spare
    (Mercator saturates within a few hundred rows), so the **whole arctic is in
    range cheaply**.
- **INNER — 16 bits — micro zoom.** 16 substitution levels into a cell =
  **65,536× linear magnification**.

**Arctic ≈ zoom.** Approaching a pole shrinks cells by `cos(lat)`, so near-pole
*detail* is spent from the **same INNER budget** as deep equatorial zoom — which
is why the symmetric 16/16 serves both, with no N–S bias needed.

**Why 2³² and not bigger — the `pri` cap.** `pri(n)` (2-adic valuation, capped at
`DEFAULT_MAX_PRI = 32`) returns **32 only for column 0**, the ∞ branch axis (prime
meridian / equator). For that sentinel to stay unique across the winding — so it
never repeats and the globe is effectively unbounded — **no finite column may
also reach pri 32**, i.e. none may be divisible by 2³². The 32-bit budget enforces
exactly this: hold every column offset within ±2³² and finite columns top out at
**pri 31**, leaving 32 to the axis alone. The column budget and the `pri ≤ 32` cap
are the same uniqueness condition. **When calling `pri`, never exceed column 0's
value (32).**

Code target: globe `MAX_ORDER 40 → 32` (center 2³¹); Division kept small.

## Settled decisions

1. **Reveal granularity** — **global / level-anchored.** One base fractional size
   for the whole globe per zoom; squares of a given size are treated identically;
   `zoomPoint` advances a single level counter. Polar coarsening is the `lineMin`
   render cull, not a per-region level.
2. **Split factor / depth** — four children one level finer (`2^k → 2^(k−1)`),
   the 2×2 substitution. Built for **deep zoom** — many levels down from the
   `2^10`-ish default.
3. **`lineWeight`** — drawn **thickness** = `f(priority, lineEmphasis)` only;
   reasonable guess `lineEmphasis·(0.22 + 0.34·p)` px. Drawn size `s` enters only
   through `presence = s · lineWeight(p)`, the scalar the thresholds judge; the
   regime that matters is the thinnest visible line, `presence ≈ lineMin`.
4. **Priority stagger is a wanted feature, not optional** — the V/H "one
   orientation at a time" reveal (Phase 3) is explicitly desired.
5. **Coordinate budget = 32 bits/axis, split 16 outer / 16 inner** (balanced).
   Outer = winds (E–W) / pole row (N–S); inner = 16 levels of cell zoom. Arctic
   reach is cheap; arctic *detail* and deep zoom share the inner budget. See
   *Coordinate budget* above.
