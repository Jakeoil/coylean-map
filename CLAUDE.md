# CLAUDE.md — working notes for agents

Domain background lives in `README.md` and `ALGORITHM.md`. This file is the
short list of things that have bitten past sessions. Read it before touching the
algorithm or the glyphs catalog.

## The engine — `coylean-explorer/coylean-core.js`

This is the hub; almost everything imports from it. Frozen API — extend free
functions via a trailing options object, never new positional params.

- **`Propagation`** runs one SE-flowing quadrant: `pri(i + hInitCol)` /
  `pri(j + vInitRow)` priorities, `Seniority` breaks ties (vertical `>=`,
  horizontal `>`). `pri(n)` (2-adic valuation) is valid only for `n >= 0`.
- **To get a coherent finite map / shifted lattice, use
  `Propagation.fromUniverseBoundary(Universe.create({...}))`.** Don't hand-roll
  a single-arrow seed — it only survives on the ∞-axis and collapses off it
  (odd `hInitCol` → a sparse blue scatter). The standard seed is all-true;
  `fromUniverseBoundary` derives the correct boundary seed from the four
  quadrants and sets `hInitCol = hInitCol_user − westExtent`.
- **⚠️ `Universe.assemble()` and the assembled mosaic raster
  (`universe.downMatrix` / `rightMatrix`) are BROKEN — do not consume them, do
  not try to "assemble the universes."** `Universe.create` calls `assemble()`
  internally but `fromUniverseBoundary` ignores its output, so that path is
  safe.
- **Validate algorithm changes in Node before editing canvas code**: import
  core, render an ASCII bitmap of the matrices. Catches collapses/off-by-ones
  without a browser round-trip.

## The glyphs catalog — `glyphs/` (main active work)

`glyphs/index.html` + `glyphs/glyphs.js` (ES module). 4×4 section catalog,
three Coylean maps, equivalence classes, substitution + translation tables.

- **Dyadic location** = the priority-lattice offset pair. **latitude =
  `vInitRow`** (N–S), **longitude = `hInitCol`** (E–W). Clean baseline = **1/1**.
  Sidebar boxes `#vinit-input` / `#hinit-input` drive `curVInit` / `curHInit`.
- Catalog is clean at raw offset 1; the **map is clean at raw 0**, so
  **map raw = lat/long − 1**. `drawCoyleanMap` gets this for free from
  `fromUniverseBoundary` with `westExtent = northExtent = 1`. At 1/1 the map is
  pixel-identical to the historical clean map (verified).
- Letters render via one calibrated D4 matrix per glyph (`D4_MATRIX`), not
  scale+slash. See `memory` and `glyphs/priority-offset-plan.md` for the
  reasoning trail on the map↔catalog reconciliation.

## House rules

- **Don't run prettier / formatters.** Write JS to fit printWidth 80; use
  `// prettier-ignore` for lines that must stay long. Tolerate auto-format
  whitespace noise.
- **HTML pages with `import`s** load via `<script type="module" src="./x.mjs">`
  (no inline module scripts — keeps VS Code Go-to-Definition working).
- **Don't reload pages** via Chrome/osascript — Jake runs his own local dev
  server with its own reload flow.
- **Preserve "working baseline" code verbatim** when refactoring; mark read-only,
  don't delete.
- **Commits**: single-line title (`area: summary`), no body bullets restating
  the diff. Commit/push only when asked.
