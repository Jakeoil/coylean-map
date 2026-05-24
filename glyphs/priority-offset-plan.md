# Plan — hInitCol / vInitRow tie-break offsets on the maps

**Status: sidebar + catalog DONE; map integration PLANNED.** 2026-05-24.

The sidebar has two number boxes (`#hinit-input`, `#vinit-input`, default 1,
negatives allowed). They drive module globals `curHInit` / `curVInit`, which feed
the **glyph catalog**: `computePattern` (classification + assignment + labels)
and `drawGlyph` (the grid/eq-class canvases). `applyAssignmentsAndRender` calls
`rebuildClasses()` first, so changing the boxes reshapes the whole catalog
consistently. At 1/1 everything is identical to before.

**Not yet wired:** the three Coylean maps. That's this plan — and it carries the
"p2 cages won't line up" complication.

## What the offsets do

Priority is `pri(i + hInitCol)` / `pri(j + vInitRow)` (2-adic valuation). The
senior "p2" lines that bound each 4×4 section cage fall where `pri ≥ 2`, i.e.
`i + hInitCol ≡ 0 (mod 4)`. The maps currently propagate with `hInitCol = 0`
(`drawCoyleanMap` main `Propagation`, and `getSectionData`), so the senior lines
land at `i = 0, 4, 8, …` — exactly the fixed 4-cell cage grid the renderer draws.

The catalog glyph uses offset 1 (`pri(x+1)`). Varying the offset moves the
senior lattice by `-hInitCol (mod 4)`, so the cages drawn at fixed 4-multiples no
longer sit on the senior lines. Hence: **shift/extend the propagation to realign.**

## The complication — cage realignment (the "+3 cells")

Period is 4, so the lattice shift `s = ((-hInitCol) mod 4 + 4) % 4 ∈ {0,1,2,3}`.
To keep drawing aligned cages:

1. **Propagate 3 extra cells** on the leading edge (`Mr + 3`, `Mc + 3`) so there's
   a full period of slack regardless of `s`.
2. **Crop the drawn window** by `s` cells (the v-axis uses the `vInitRow`
   equivalent `sV`), so the first visible cage boundary lands on a senior line.
3. **Read section codes from the shifted indices** — today `secCodes` /
   `getSectionData` read at `y0 = sr*SEC + 1`, `x0 = sc*SEC + 1`; add the crop
   offset (`+ sV`, `+ s`) so codes come from the realigned cages.

Net: the map looks the same shape, but the cage grid tracks the senior lattice
for any offset, exposing section codes outside today's 34-reachable set
("unused glyphs").

## Map section labels (assigned symbol, else index name)

Each map section shows the **assigned symbol** if its `(dc,rc)` code has a letter
in `GLYPH_LETTERS` / `H_GLYPH_LETTERS`, otherwise the **`V##`/`H##` index name**.
This is already `drawCoyleanMap`'s behavior (assigned → letter overlay via `ft`;
unassigned → placeholder). The thing to preserve under varying offsets: changing
`hInitCol`/`vInitRow` changes which codes are reachable, so codes that were never
drawn before will appear — and must fall back to their index name until assigned.
This is precisely how the "unused glyphs" become visible and nameable.

## Terminology — dyadic location

The offset pair is the **dyadic location** of the priority lattice. The clean
baseline is **latitude/longitude = 1/1** (the box default and the standard
glyph). In raw `Propagation` terms:
- **latitude** — the row offset (N–S); sidebar `#vinit-input`, `curVInit`.
- **longitude** — the column offset (E–W); sidebar `#hinit-input`, `curHInit`.

**Catalog vs map axis offset (important for the map pass).** The catalog glyph
is clean at raw `hInitCol = 1`, but the **map is clean at raw `hInitCol = 0`** —
its column 0 is the ∞-priority axis, and columns 1–3 then carry the glyph's
`pri(1),pri(2),pri(3)` interior. So the map's axis convention is one cell left of
the catalog's. To keep the unified coordinate (clean = 1/1) consistent, the map
must use **raw offset = lat/long − 1**: `hInitCol = curHInit - 1`,
`vInitRow = curVInit - 1` (so box 1/1 → map raw 0/0 = clean).

Lesson (2026-05-24): driving the map at raw = box value put the default (1/1) at
raw 1/1, which sends the ∞-axis off the top-left corner; the seed (single arrow
pinned at column 0) is then a lowest-priority column and the map collapses to a
sparse blue-horizontal scatter. This is exactly why the map pass needs the
**+3-cell extend-then-crop**: extend N/W so the axis stays inside the
propagation for any offset, then crop the visible window.

## Negative offsets

`pri(n)` is only valid for `n ≥ 0` (`n & -n`). With `hInitCol < 0`, small `i`
gives `i + hInitCol < 0` → garbage. Fix: start the propagation window at an index
`≥ -hInitCol` (propagate from a more-negative geometric origin and crop), which
the +3-cell leading margin already half-buys — extend it to `max(3, -hInitCol)`
when the offset is negative. Verify both signs against a known case.

## Steps

1. **Thread offsets into the maps.** Replace the hardcoded `hInitCol: 0,
   vInitRow: 0` in `drawCoyleanMap`'s main `Propagation` and in `getSectionData`
   with the chosen map offset; make the per-section overlay `Propagation`
   (currently `1,1`) use `curHInit/curVInit` so map glyphs match the catalog.
   Decide the **default**: keep the map's historical `0` as the baseline and let
   the boxes add a shift, *or* drive the map directly from the boxes (default 1)
   and rely on the cage fix. (The boxes today are labeled "catalog" — relabel
   when they also drive maps.)
2. **Add the +3-cell margin + crop** to `drawCoyleanMap`: extend `Mr/Mc`, compute
   `s`/`sV`, crop the segment-draw loop and the cage/section-code reads.
3. **Update `getSectionData`** with the same crop so the translation /
   substitution tables stay consistent (and `secCodes` in `drawCoyleanMap`).
4. **Reachability:** recompute which codes appear; expect the "unused glyphs" to
   surface. The back-burnered `substitution-plan.md` page would show this too.

## Checkpoints

- At map offset `0/0` (today's value) the maps must render **byte-identical** to
  current — diff before trusting the realignment math.
- At `1/1`, cages must sit on senior lines after the +3-cell crop; spot-check a
  few section boundaries against the catalog glyph shapes.
- Negative offset (e.g. `-1`) renders without `pri` going negative.

## Open decisions

- One offset pair for catalog **and** maps, or separate? (Catalog wants the
  glyph-local convention; maps want the section-grid convention — they differ by
  the historical 1-vs-0. Simplest: one pair, with the map applying the cage crop
  so it reconciles.)
- Whether to expose the maps' offset as the same two boxes or a third "maps too"
  control.
