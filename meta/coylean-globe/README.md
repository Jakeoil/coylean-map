# Coylean Globe

The Coylean map wound onto a sphere with **no longitude repetition**. Each
column spans `dLon = 2π/D` radians (D = *Division* = columns per turn), so a
column's absolute longitude `(col − axisCol)·dLon` is unbounded: successive
turns lay down columns as a helix and never repeat. `rotY` accumulates with no
`mod 2π` — it *is* the winding control, and `τ = rotY/2π` is the winding number.
The branch point (the maximum-priority axis = prime meridian × equator) sits at
the back; the spiral's hard cut lives there.

Latitude is **Mercator with square cells** (equator at the axis row, symmetric
N/S). Full design — the winding algebra, orientation labels, branch-cut age
tint, and the GF(2) reason the two-tier LOD works — is in
[`NOTES_coylean_globe.md`](NOTES_coylean_globe.md).

## Two builds

Same winding model and look; they differ only in **where the cell arrows come
from**.

### `coylean-globe.html` — descent (current)

Cells come from **instant substitution address descent** off a tiny
`Propagation.fromUniverseExtents` seed (`../superglyphs/cell-descent.mjs`): a
section's glyph is a function of its dyadic address, so `downAt`/`rightAt` are
`O(order)` table lookups — interior cells from the glyph, the senior wall cell
from its bar (both exact, verified == `fromUniverseExtents`).

Consequences vs the old build:

- **Unbounded.** `2⁴⁰` columns; no extent cap. Hundreds of thousands of
  non-repeating turns *and* a fine cell scale (high Division → deep zoom) coexist.
- **Instant.** No `O((2W)²)` boundary seed, no lazy K×K tile build, no
  first-paint lag — every visible cell is a lookup.
- The old **Extent** control is therefore vestigial (ignored).

### `coylean-globe-old.html` — scaffold (kept for comparison)

The original. Cells come from the **lazy big-map seam scaffold**
(`../big-map/scaffold.mjs` + `tile.mjs`): a centred integrated universe of
`2W × 2W` cells, propagated in `K = 256` blocks on demand (`drainWork` SE-march),
with the boundary seed paid up front. Bounded Extent, and texture fills in over
~tenths of a second as blocks finish. Useful as the ground-truth reference the
descent build was validated against.

## Controls (both)

- **Division (D)** — columns per turn = the **finest cell scale = how deep you
  can zoom**. At 64 there's nothing below the cell to reveal; higher = deeper
  dive (and, on the descent build, a heavier zoomed-out view).
- **Extent** — universe half-width `W`. Real on the old build; **ignored** on the
  descent build (unbounded).
- **Line scale / Density** — line weight, and the priority floor (how many fine
  lines show).
- **Skeleton / Texture** — the two line LOD tiers. Skeleton = high-priority lines
  drawn straight from the dyadic priority arrays (any zoom, cheap). Texture =
  actual gapped arrows, drawn once cells clear `TEXTURE_PX`.
- **Density wash** (descent build) — the sub-pixel tier under the lines. Below
  `TEXTURE_PX`, where the lines go coarse and gaps read blank, each cage is
  filled with a wash whose **alpha = its glyph line-density** (down+right count,
  0..17) in the line colour. The unique empty glyph `V_00`/`H_00` is density 0 →
  alpha 0 → **bare sphere shows through**, so blank regions stay visible (a blank
  area is `00` at every level, so it stays bare at any zoom). The cage level
  climbs the substitution ladder to keep cages ~6 px and the draw count bounded.
  *Future:* two-colour (downs vs rights) to show the bias instead of just total.
- **Lat / Long / Sen** — dyadic anchor (vInitRow/hInitCol ∈ {0,1}) and seniority
  (V↔H); the four anchors × two seniorities. Drag to spin (winds longitude) /
  pitch; wheel to zoom; `0` resets.

## Known limits (descent build)

- **Performance at zoomed-out high Division.** Every visible meridian is a full
  pole-to-pole arc, so a very fine Division draws many arcs and the spin gets
  heavy. Texture/parallels are clipped to the on-screen band; the remaining lever
  is clipping the column window to on-screen + fewer samples per arc at low zoom.
  The density wash adds ≤ `DENSITY_BUDGET` (14k) fills per frame in that regime.
- **Anchor-only.** Descent is exact on the four anchor offsets `{0,1}²` × {V,H}
  (exactly the Lat/Long/Sen toggles); no off-anchor mode.
- **Winding speed.** Drag pans a fixed screen amount, so traversing hundreds of
  turns is drag-heavy — a momentum/fling or a "jump N turns" control would help.
