# Glyph Lore — the bestiary of Turtle Paradise

Field notes for the zoo. The map is a living place, and its inhabitants are sorted
by **priority** — the only number the Coylean algorithm really cares about. A
cell's priority is how many times its position divides by two (its 2-adic
valuation); the heavier the priority, the larger and emptier the line it draws.
This is the vocabulary we use to talk about who lives where.

## The vacuum (∞)

The **vacuum** is the highest priority there is: `∞ = order + 1`, one step above
everything inside the square. It is the **latitude-0 and longitude-0 axes** — the
left/top ∞ bars that frame a Coylean square. (Latitude = N–S, `vInitRow`;
longitude = E–W, `hInitCol`; the *zero* of each is the vacuum.)

Nothing propagates across the vacuum. It is the emptiness the map hangs in and the
fence it is bounded by — the true edge of the world at this scale. A square is a
finite patch fenced by vacuum on its origin-facing sides, everything inside it
nesting down toward the glyphs.

## Lesser vacui — the ladder

The trick: **every priority level is a vacuum to the level below it.** A `3`
fences the `2`s the way the true vacuum fences everything; a `2` fences the `1`s
and `0`s. So the ladder reads as a stack of *lesser vacui*, each one the sky of
the things beneath it:

```
vacuum (∞)        the true vacuum — nothing above it, the lat/long-0 frame
   ⊃ … (n, n−1)   the spine and its lesser skies
   ⊃ cages (2)    the cage walls
   ⊃ glyphs (1,0) the strokes
```

- **Cages — the twos.** Priority-2 lines are the **cage walls**: the 4×4 sections
  (anchored on the senior lattice where `pri(k) ≥ 2`) that each hold one glyph.
- **Glyphs — the zeros and ones.** Inside a cage, the priority-1 and priority-0
  lines are the glyph's own strokes — its 3×3 code. The smallest, most crowded
  inhabitants.

## Turtles — insides of glyphs

A cage magnified *is* a glyph-scale map of its own. So this scale's vacuum and
cages become the **insides of a glyph** one scale coarser, and a glyph's insides,
magnified, are again vacuum-and-cages-and-glyphs. The lesser vacui go all the way
down — turtles on turtles. What is a fence here is a room there; what is a room
here is a stroke there.

## Merged rooms — the compounds

Sometimes a glyph's cage has **rooms it shares with the neighbors.** Where the
wall between two cages never went up (a no-bar edge), the rooms run together and
the glyphs are **merged** — a *compound*. Your cage is no longer only yours; you
hold a hall in common with whoever you fused with.

Merged rooms are **always rectangles.** The fusion only ever erases straight
walls, so a compound is the rectangle your eye picks out — never a ragged shape.
A glyph living alone is a 1×1 compound; a fused pair is 1×2 or 2×1; larger merges
are larger rectangles. (See `compound-glyphs.html` — every region it outlines is
one of these shared-room rectangles.)
