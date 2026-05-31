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

## Source config (Phase 0, validated in Node)

A **centred integrated universe**, `2W × 2W` cells, from the big-map seam
scaffold:

```
buildIntegratedScaffold({
  K: 256, northExtent: W, southExtent: W, westExtent: W, eastExtent: W,
  hInitCol: 1, vInitRow: 1, maxPri, maxLatPri: maxPri, maxLongPri: maxPri,
})
```

- `axisCol = axisRow = W − 1`; `hInitCol0 = vInitRow0 = 1 − W`.
- `maxPri = ceil(log2(2W))` makes `pri(0) = maxPri` the **unique global
  priority maximum** in `[0, 2W)` → no repetition within the universe (verified
  in Node: the top level yields exactly column `axisCol`).
- **Build via explicit `propagateBlock` in SE dependency order** (the
  `drainWork` diagonal + `nextReadyAncestor` march). `tile()`'s own
  `extendScaffold` is a no-op here because `buildIntegratedScaffold` →
  `allocateScaffold` pre-sets `nBlocks`. Verified: full lazy build reconstructs
  the eager `Propagation.fromUniverseExtents` reference exactly (0 / 32768 cell
  mismatches), and the texture read path (`downAt`/`rightAt` through the
  diagonal drain over a region away from the origin) matches too (0 / 8192).

`pri(n)` handles the negative offsets the centred map uses (`n & -n` + `clz32`
give the right 2-adic valuation for `n < 0`), so the skeleton's
`pri(col + hInitCol0, maxPri)` matches the scaffold tiles' priorities exactly.

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

- **Extent is bounded** (`universeBoundarySeed` is O((2W)²) up front — the one
  synchronous cost). Default W = 1024 (2048² map, ~32 turns at D = 64).
  Winding stays coherent only within `[0, 2W)`; the HUD warns when
  `2W/D < 2` (front past the edge — raise Extent or lower Division).
- **First texture paint can lag.** The axis (interesting content) is at the
  universe centre, far from the scaffold's NW origin (block 0,0), so reaching
  the visible front builds a dependency triangle. Skeleton carries the view
  meanwhile; texture fills over ~tenths of a second at the default.

## Deferred / future

- **True unbounded** (no extent cap, no O(extent²) boundary): the moving-origin
  all-direction scaffold growth (`scaffold-direction-growth`: concat NE/SW/NW
  integrations onto the SE scaffold, same seam format) — not yet wired into
  the scaffold. Alternatively an all-true generative seam rule (O(1) setup) for
  a different-but-valid infinite map.
- Blended seam at the back instead of a hard cut.
- On-screen clip for the *column* window (rows are already clipped); cheap to
  add if wide-D zoomed views get heavy.
- Optional refactor of the shared sphere geometry (`rotatePoint`/`project`/
  `spherePoint`/Mercator) into a module imported by both globe pages.
