# meta/fibonacci-ruler — the Fibonacci ruler, and the map it makes

A non-dyadic priority function for the Coylean map, and a demo that renders the
**Coylean square** it produces. The Coylean algorithm's only number-theoretic
input is its *priority function*; everything here is about swapping that one
function and watching the map change.

## Focus

1. **The Fibonacci ruler.** The engine's default priority is `pri(n)` — the
   2-adic valuation (lowest set bit in binary). The Fibonacci ruler is
   `fibiPri(n)` — the **Fibonacci-adic** (Zeckendorf) valuation: write `n` as a
   sum of non-consecutive Fibonacci numbers `1,2,3,5,8,13,…` and read the index
   of its lowest term.

   ```
   pri(1..8)  = 0,1,0,2,0,1,0,3      high ticks at 2,4,8,…  (powers of two)
   fibiPri    = 0,1,2,0,3,0,1,4      high ticks at 2,3,5,8,… (Fibonacci)
   ```

2. **Drawing a proper Coylean square.** A square is *not* a grid propagated
   from all-true edges. We build a `Universe` with **one cell of context to the
   north and west** (`northExtent = westExtent = 1`) and the full square to the
   south and east, then call `Propagation.fromUniverseBoundary`. That reseeds a
   fresh SE-flowing propagation whose interior `side × side` SE block is the
   genuine SE patch of an infinite Coylean map. When rendering we **suppress the
   result lines** — the trailing `downs`/`rights` past the last cell — and the
   one-cell N/W seed margin.

3. **Line weight = priority.** Each segment is drawn heavier on a higher-priority
   gridline, so the dyadic square shows a power-of-two skeleton and the
   Fibonacci square a golden one.

### The side-length rule

> **Dyadic** squares have **power-of-two** sides (`4, 8, 16, …`); **Fibonacci**
> squares must have **Fibonacci-number** sides (`5, 8, 13, 21, …`). `8` is the
> one side both rulers share. The high-priority gridlines have to land on the
> square's far edge for it to read as a closed, self-similar tile.

## Engine support

`coylean-core.js` gained, with the **dyadic ruler as the default so no other
code needs the option**:

- `fibiPri(n, maxPri)` — the Fibonacci-adic valuation, drop-in for `pri`.
- a `ruler: "dyadic" | "fibi"` option on `Propagation`, `Universe.create`, and
  the boundary factories. A custom `(n, maxPri) → priority` function also works.

## The reusable rendering engine

The square page lifts the good parts of `meta/planet-coyleus` (the most
perfected renderer) and factors them so **anyone can reuse them** — without the
glyphs/cages machinery:

- **`coylean-field.mjs`** — `drawLineField(ctx, W, H, field, view, opts)`. Draws
  a Coylean propagation's down/right lattice mapped onto the unit square, each
  line's thickness scaled by its ruler priority, batched by width with a natural
  sub-pixel level-of-detail. No DOM, no model state.
- **`coylean-viewport.mjs`** — `createViewport(canvas, { sides, fieldForOrder,
  … })`. Owns the pan, the wheel-zoom, the **order ladder**, and the
  **shift-zoom clutch**: plain zoom snaps the displayed order to the zoom
  (re-tiling to a finer/coarser subdivision at each threshold), but holding
  **shift** *holds* the order while you keep zooming — the divisions don't
  re-tile mid-zoom — slipping only when the zoom runs past a leash. The ladder is
  defined purely by an increasing `sides` array, so it works for powers of two,
  Fibonacci numbers, or any sequence.

## Open notes / next steps

### Proposed: a core `coyleanSquare(order)` factory

The square is built so often (here, in `meta/toy-rendering`, in the glyph map
work) that `coylean-core` should grow a one-call factory instead of every page
repeating the `Universe.create({ northExtent: 1, westExtent: 1, … })` →
`fromUniverseBoundary` dance. Sketch:

```js
Propagation.coyleanSquare({ order, ruler = "dyadic", seniority, direction });
```

- **`order` is enough.** The side is derived from the order and the ruler —
  `2 ** order` for `"dyadic"`, `fib(order)` for `"fibi"` — so a square page only
  ever names an order, never a raw side.
- **`seniority`** and **`direction`** (the SE/SW/NE/NW anchor orientation, which
  quadrant of the infinite map the square shows) are the only other knobs.

**The trap — leave it out of v1.** A square is *anchored at the origin*: its
left and top edges **are** the infinite-priority zero axes (column 0 / row 0).
That is exactly what the `westExtent = northExtent = 1` context buys, giving the
internal `hInitCol = vInitRow = 0`. So you **cannot** parameterise the factory by
a free `hInitCol` / `vInitRow` location the way `Universe.create` allows: shifting
the lattice offset slides the zero/infinity lines off the left edge and the
result is no longer a square framed by its spine. Locating a square somewhere
other than the origin (keeping the zero axis on-screen as a moving frame) is a
real design problem — defer it. v1 takes `order` (+ `seniority`, `direction`)
only; the offset stays pinned to the origin anchor.

### Possible: a half-step (alternating V/H) ladder

`meta/planet-coyleus` runs the ladder in **half-steps** — two rungs per order,
`V_n` then `H_n`, seniority flipping between them, each half-step doubling one
axis (the section area halves, not quarters). Smaller re-tile jumps, and it
surfaces the V/H backslash dual. Bringing that here is **low-to-moderate
effort**, because most of the machinery already fits:

- **The renderer is ready.** `coylean-field.mjs` already computes `cellsX` and
  `cellsY` independently, so a *rectangular* field (width ≠ height) maps onto the
  unit square with no change — exactly how planet-coyleus draws half-width H
  cells.
- **The engine needs one generalisation.** Today a ladder rung is a scalar
  `side`; a half-step rung is a `{ width, height, seniority }` descriptor. The
  zoom math (`zoomForOrder` / `ladderPos`) should interpolate on the geometric
  mean `√(width·height)` (the "scale") instead of `side` — a few lines in
  `coylean-viewport.mjs`.
- **The page builds rectangles.** `buildField` would alternate: square rung
  `s × s` (seniority V), half rung `2s × s` (seniority H), next square `2s × 2s`,
  … For **`fibi`** this is especially natural — the half-steps are exactly the
  `Fₙ × Fₙ₋₁` golden rectangles already drawn in `tilings.html`, each step
  multiplying the area by φ.

Estimate: roughly half a day — the rung-descriptor change in the viewport plus
the rectangular `buildField` in the page; no change to `coylean-field` or
`coylean-core`.

## Files

- `index.html` — the ruler's hub (motivation, Zeckendorf, the sub-pages).
- `representations.html` · `negatives.html` · `tilings.html` — the ruler's own
  worldbuilding (place-value construction, two-sided run, geometric tilings).
- `square.html` + `square.mjs` — the Coylean square demo (ruler toggle, ladder).
- `coylean-field.mjs` · `coylean-viewport.mjs` — the reusable rendering engine.
