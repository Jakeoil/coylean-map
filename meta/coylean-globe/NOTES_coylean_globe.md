# Unbounded Coylean Globe — design notes

`meta/coylean-globe.{html,mjs}`. The Coylean map wound onto a sphere with **no
longitude repetition**. Sibling to `ruler-grid-sphere` (which repeats `D`
columns around the globe via `maxLongPri = log2(D)`); this one keeps the same
cell scale but exposes *new* map every turn.

## The winding model

- Each column spans `dLon = 2π/D` radians (D = division = columns per turn) —
  the **same cell scale** as the flat Coylean map / ruler-grid-sphere.
- A column's **absolute** longitude is `φ(col) = (col − axisCol)·dLon`,
  unbounded. `spherePoint`'s `cos/sin` wraps it onto the sphere, so successive
  turns lay down columns `… D, 2D, …` as a helix — never a repeat.
- `rotY` accumulates **unbounded** (no mod 2π): it *is* the winding control.
  `τ = rotY / 2π` is the winding number, shown in the HUD. Spinning east raises
  τ and reveals farther-east columns.
- The front-centre longitude after rotation is `φ = rotY + π/2` (from the
  rotation algebra), so the visible column window is `axisCol +
  (rotY+π/2)/dLon ± D/4` (the front hemisphere = D/2 columns), clamped to the
  universe. `visibleColRange()`.
- **Branch point at the back.** The axis (`pri = maxPri` column = prime
  meridian) is parked at `lon = π` by the initial `rotY = π/2`. The spiral's
  hard cut sits there; near the poles the front/back layers converge so the cut
  can peek over — an accepted artifact, not hidden.
- **Latitude** is Mercator with square cells: `latOf(row) =
  latFromMercatorY(−(row − axisRow)·dLon)`, equator at `axisRow`, south
  positive, symmetric N/S. The front-most latitude is exactly the pitch `rotX`
  (so the screen-centre row is analytic — used to seed `visibleRowRange`).

## Orientation controls (anchor + seniority)

Three buttons toggle the map's dyadic anchor and tie-break, rebuilding the
scaffold: **Lat** (vInitRow 0↔1), **Long** (hInitCol 0↔1), **Sen** (V↔H). A
large label names the orientation. Verified in Node for all four anchors ×
both seniorities: `axisCol = W − hInitCol`, `axisRow = W − vInitRow`, offsets
`hInitCol − W` / `vInitRow − W`, tiles reconstruct exactly.

Label rule (lat 1→S/0→N, long 1→E/0→W): **V** names N–S first, **H** names
E–W first.

| (lat,long) | V  | H  |
|-----------|----|----|
| 1,1       | SE | ES |
| 0,1       | NE | EN |
| 1,0       | SW | WS |
| 0,0       | NW | WN |

## Branch-cut age tint

Meridians within a small band of the branch cut (the back, at the window edges
`centre ± D/2`, one turn apart) are coloured by age, so the cut reads as map
emerging and dissipating as you spin (visible near the poles, where the far
side peeks over):

- **Leading edge (new, just emerged):** brightest **violet** → fades to the
  normal line colour as it ages away from the cut.
- **Trailing edge (old, about to vanish):** normal → darkens to **red** → fades
  to **transparent** right at the cut.

Which edge is new vs old follows `spinDir` (the last rotation direction; drag
left = eastward = new at the high/east edge). Band width is ~5° each side, but
at least `CUT_RAMP_MIN_COLS` columns so it stays visible at coarse divisions.
`branchTint`/`meridianColor` in coylean-globe.mjs. Parallels stay neutral — the
emerging meridian "spokes" carry the effect; the latitude circles cross them.

## Source: instant substitution descent (2026-05-31)

The lazy big-map scaffold was **replaced by `meta/superglyphs/cell-descent.mjs`**
— an UNBOUNDED, instant cell source. (See that directory's README ⚠️ note: the
universe is *seeded*, not hand-rolled.) `buildSource`:

```
cu = makeCellUniverse({ hInitCol, vInitRow, seniority, maxOrder: 32 })
center  = cu.center = 2^31          // the origin cell
numCols = numRows = 2^32            // effectively unbounded
axisCol = center − hInitCol, axisRow = center − vInitRow
hInitCol0 = hInitCol − center, vInitRow0 = vInitRow − center
maxPri  = DEFAULT_MAX_PRI = 32
```

- `cell-descent` seeds once with `Propagation.fromUniverseExtents` (a tiny 32×32
  seed), sections it into glyph codes, and gives `downAt(gr,gc)`/`rightAt(gr,gc)`
  by **descending the translation table** from the seed — O(order) lookups, no
  propagation, no boundary seed, no SE-march. Verified in Node: descent ==
  `fromUniverseExtents`, **0 mismatches** (incl. all four anchors × V/H via the
  seed orientation).
- `maxPri = 32` is the **infinity sentinel** at the origin (finite valuations top
  out at 31 via `clz32`), so the axis is the unique priority maximum over *all*
  columns — winding never repeats, with no extent cap.
- **Cell vs wall.** The glyph reconstructs the `pri ≤ 1` interior cells (3 of each
  cage's 4 cols/rows); the 4th is a senior cage wall (`pri ≥ 2`, incl. the axis),
  which renders as **skeleton** (the axis never breaks, so solid is exact). So
  texture is gated to `p ≤ 1` lines in `renderLines`; walls/coarse stay skeleton.

`pri(n)` handles the negative offsets the centred map uses (`n & -n` + `clz32`
give the right 2-adic valuation for `n < 0`), so the skeleton's
`pri(col + hInitCol0, maxPri)` matches the descent's cage walls exactly.

## Two-tier LOD (the GF(2) reason it works)

The reaction is a GF(2) transvection on `downWins = colPriority[i] ≥
rowPriority[j]` (`coylean-core.js:114–165`):

- downWins:  `down_out = down_in`,  `right_out = right_in ⊕ down_in`
- !downWins: `right_out = right_in`, `down_out = down_in ⊕ right_in`

So a priority-`p` meridian passes its down-arrow **straight through unchanged**
for every row with `rowPriority ≤ p`; it only breaks/deflects where it crosses
a *higher*-priority parallel (≈ one per `2^{p+1}` rows). Hence:

- **Skeleton tier** — high-`p` meridians/parallels are essentially
  propagation-free; drawn straight from the priority arrays alone, with a
  zoom-scaled floor `minPri = ceil(−log2(cellArcPx·density/340))`. Guarantees
  the large-scale structure at *any* zoom. The build gate can never hide it.
- **Texture tier** — actual gapped arrows read from built scaffold tiles, drawn
  only when cells clear `TEXTURE_PX` (≈1.3px). A line stays skeleton (instant)
  until its blocks finish, then flips to texture. Tiles propagate lazily within
  an 8ms/frame budget, **gated** so cells below `BUILD_GATE_PX` (0.5px) are
  never built (`drainWork`). Build-LOD (½px gate) and draw-LOD (priority floor)
  are decoupled but consistent.

Both tiers live in `renderLines()`; the per-line skeleton↔texture choice is
`wantTex && colBuilt(...) ? drawTextureMeridian : strokeArc(meridianPoints)`.

## Constraints / known limits

- **Unbounded + instant now** (the descent swap, 2026-05-31): no extent cap, no
  O(extent²) boundary seed, no first-paint lag — every cell is an O(order)
  lookup. The old "raise Extent / D too large for extent" warnings are gone; the
  **Extent control is vestigial** (kept in the UI but ignored — repurpose or
  remove). `MAX_ORDER = 32` sets the finest scale (2³² columns); raise it for an
  even larger range at a few more lookups per cell.
- **Anchor-only.** Descent is exact on the four anchor offsets {0,1}² × {V,H} —
  exactly the Lat/Long/Sen buttons. No off-anchor mode (would need propagation).
- The pri ≥ 2 walls render skeleton-solid; the sparse gaps where a wall crosses
  a *higher* parallel (texture would show them) are not drawn. The axis (highest
  priority) has none, so it's exact; lower walls lose a few gaps — acceptable.

## Deferred / future

- ~~True unbounded~~ **— done** via the substitution-descent swap.
- Blended seam at the back instead of a hard cut.
- Repurpose or drop the now-vestigial Extent control (e.g. → `MAX_ORDER`).
- On-screen clip for the *column* window (rows are already clipped); cheap to
  add if wide-D zoomed views get heavy.
- Optional refactor of the shared sphere geometry (`rotatePoint`/`project`/
  `spherePoint`/Mercator) into a module imported by both globe pages.
