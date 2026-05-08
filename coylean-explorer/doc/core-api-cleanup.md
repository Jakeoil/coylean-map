# coylean-core API cleanup

Audit of redundant top-level functions in `coylean-core.js` and their call
sites across the whole `coylean-map/` tree. Goal: stop using top-level
helpers when an equivalent static on `Propagation` or `Universe` exists.

## Redundant top-level functions and their callers

| Function | Class equivalent | Call sites |
|---|---|---|
| `propagate(nR, nC, h, v, sen)` → `{downMatrix, rightMatrix}` | `Propagation.create({direction, numRows, numColumns, hInitCol, vInitRow, seniority})` (instance) or `.computeFromBoundary(...)` (plain matrices) | `coylean-app.js:229`, `init-col-problem.html:267`, `diagram.html:388` |
| `propagateFromBoundary(initDown, initRight, h, v, sen)` → `{downMatrix, rightMatrix}` | `Propagation.fromBoundary(...)` (instance) or `.computeFromBoundary(...)` (matrices) | **`glyphs/glyphs.js`: 102, 275, 492, 572, 695** |
| `universalPropagate(nR, nC, h, v, sen)` → `{nw, ne, sw, se}` | `Universe.createSymmetric(nR, nC, h, v, sen)` — identical shape | `coylean-app.js:300` |

## Other exports possibly removable

No external callers found (safe to unexport):
- `verticalWinsPriority`
- `createDownMatrix`, `createRightMatrix`

Keep:
- `reaction` — still used by `diagram.html:360` and
  `src/app/basic-propagation-prototype-info.js:45` (inspector tooltips,
  no class equivalent).

## Cross-directory edge

`glyphs/glyphs.js` is the only caller outside `coylean-explorer/`, and
it's also the heaviest with 5 sites. It imports via
`../coylean-explorer/coylean-core.js`. Migrate first — if shape issues
surface, they'll surface there.

## Three gotchas

1. **Return shape divergence.** `Propagation.create`/`fromBoundary`
   return a Propagation **instance**, not a plain
   `{downMatrix, rightMatrix}`. All current call sites destructure
   (which still works), but if anything later does `JSON.stringify`,
   `Object.keys`, or `instanceof`, behavior changes. Drop-in-with-no-
   shape-change replacement is `.computeFromBoundary(...)`, which
   returns plain matrices.

2. **`direction` is now required.** The old `propagate()` had no notion
   of direction. To migrate to `Propagation.create`, every call site
   has to pick one (probably `"se"` for the bare propagate calls, since
   they're not quadrant-building). If you'd rather not invent a
   direction at those sites, use
   `.computeFromBoundary({initDown: new Row(nC).fill(true), initRight: new Col(nR).fill(true), ...})`
   instead.

3. **`coylean-app.js` plus `coylean.js`.** Two old top-level files
   (`coylean-app.js` and `coylean.js`) look pre-`src/app/` era. Worth
   confirming whether they're still loaded anywhere before spending
   migration effort on them — `coylean.js` even defines its own local
   `reaction()` function, suggesting it predates `coylean-core.js`.

## Recommended order

1. Migrate `glyphs/glyphs.js` (5 sites).
2. Migrate the three explorer sites (`coylean-app.js:229`, `:300`,
   `init-col-problem.html:267`, `diagram.html:388`).
3. Visit each prototype page to confirm it still renders.
4. Delete the three redundant exports (and the three unused helpers).
