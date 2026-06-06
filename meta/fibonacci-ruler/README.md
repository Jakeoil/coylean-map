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

## Files

- `index.html` — the ruler's hub (motivation, Zeckendorf, the sub-pages).
- `representations.html` · `negatives.html` · `tilings.html` — the ruler's own
  worldbuilding (place-value construction, two-sided run, geometric tilings).
- `square.html` + `square.mjs` — the Coylean square demo (ruler toggle, ladder).
- `coylean-field.mjs` · `coylean-viewport.mjs` — the reusable rendering engine.
