# CLAUDE.md — working notes for agents

Domain background lives in `README.md` and `ALGORITHM.md`. This file is the
short list of things that have bitten past sessions. Read it before touching the
algorithm or the glyphs catalog.

## The engine — `src/core/coylean-core.js` (imported as `coylean/core`)

This is the hub; almost everything imports from it. Frozen API — extend free
functions via a trailing options object, never new positional params. Shared
code lives in `src/` and is imported by the bare `coylean/` prefix (import map
in browser pages, `package.json` `exports` in Node) — not relative paths.

- **`Propagation`** runs one SE-flowing quadrant: `pri(i + hInitCol)` /
  `pri(j + vInitRow)` priorities, `Seniority` breaks ties (vertical `>=`,
  horizontal `>`). `pri(n)` (2-adic valuation) is valid only for `n >= 0`.
- **To get a coherent finite map / shifted lattice, use
  `Propagation.fromUniverseBoundary(Universe.create({...}))`.** Don't hand-roll
  a single-arrow seed — it only survives on the ∞-axis and collapses off it
  (odd `hInitCol` → a sparse blue scatter). The standard seed is all-true;
  `fromUniverseBoundary` derives the correct boundary seed from the four
  quadrants and sets `hInitCol = hInitCol_user − westExtent`.
- **Extents may be NEGATIVE** (since 2026-06-15): a negative extent moves the
  seam past the origin into the opposite territory — the window then lies wholly
  on one side (the same field, windowed off-origin). The guard is per-axis SUM
  ≥ 0 (`westExtent + eastExtent`, `northExtent + southExtent`), not per-extent
  ≥ 0. Honoured by every extent path (`fromUniverseExtents`, `Universe.create` +
  `fromUniverseBoundary`, `createUniverseQuadrants`) via clamp-to-covering +
  `Propagation.windowSeed` (re-seed from the found interior edge). Dial/test it
  in the basic-propagation + universe-quadrants prototypes; see
  `test/core/test-universe-extents.mjs`.
- **A `Universe` is just the bundle of four quadrant Propagations
  (`nw`/`ne`/`sw`/`se`); it has no global raster.** The old broken
  `Universe.assemble()` / `debugAssemblySummary()` and the stitched
  `universe.downMatrix` / `rightMatrix` were deleted (2026-05-27). Never
  re-add a "assemble the universes" mosaic — `fromUniverseBoundary` is the
  only way to a coherent map.
- **Validate algorithm changes in Node before editing canvas code**: import
  core, render an ASCII bitmap of the matrices. Catches collapses/off-by-ones
  without a browser round-trip.

## The glyphs catalog — `glyphs/` (main active work)

`glyphs/index.html` is the 4×4 section catalog (three Coylean maps, equivalence
classes, substitution + translation tables); `glyphs/assign.html` is the
interactive symbol-assignment editor. Both load via a single entry module.

**Three-layer split** (one-way chain `coylean/core → coylean/glyphs →
coylean/ui/render → glyphs.js`); the math now lives in `src/` — `glyph-core.js`
→ `src/glyphs/` (`coylean/glyphs`), `glyph-render.js` → `src/ui/`
(`coylean/ui/render`) — while `glyphs.js` stays the page controller in `glyphs/`:

- **`glyph-core.js`** (`src/glyphs/`, `coylean/glyphs`) — pure math + assignment
  model. No DOM, no canvas, no
  `fetch`; imports only the engine. Owns `computePattern`, the D4 algebra
  (`VISUAL_D4`, `D4_COMPOSE`/`d4Compose`), `classifyVisualD4`, the letter maps +
  `assignLetter`/`applyAssignmentDict`, the dyadic offsets (`curHInit`/`curVInit`
  + `setOffset`), and the pure model generators `computeMapModel` (offset
  universe-integration map + section codes) and `computeGlyphMatrices`. **This is
  the Node-importable layer — do algorithm validation here** (see the engine
  note above), not against the canvas.
- **`glyph-render.js`** (`src/ui/`, `coylean/ui/render`) — canvas drawing only
  (`drawGlyph`, `drawDot`,
  `drawCoyleanMap(canvas, model, opts)` consuming `computeMapModel`'s output),
  the calibrated `D4_MATRIX`, Baby Blocks (loaded from `src/assets/baby-blocks/`),
  and a `renderState` config object the
  controller mutates. Imports only `coylean/glyphs` — holds no `Propagation`/DOM.
- **`glyphs.js`** — page controller: DOM table builders, `mapConfigs`, event
  wiring, IO (`loadAssignments`), and the re-export barrel `assign.mjs` imports.

- **Dyadic location** = the priority-lattice offset pair. **latitude =
  `vInitRow`** (N–S), **longitude = `hInitCol`** (E–W). Clean baseline = **1/1**.
  Sidebar boxes `#vinit-input` / `#hinit-input` drive `curVInit` / `curHInit`
  (in `glyph-core`, via `setOffset`).
- Catalog is clean at raw offset 1; the **map is clean at raw 0**, so
  **map raw = lat/long − 1**. `computeMapModel` gets this for free from
  `fromUniverseBoundary` with `westExtent = northExtent = 1`. At 1/1 the map is
  pixel-identical to the historical clean map (verified).
- Letters render via one calibrated D4 matrix per glyph (`D4_MATRIX` in
  `glyph-render`), not scale+slash. The matrix's two rotation entries are filled
  from `glyph-core`'s `d4Compose` Cayley table. See `memory` and
  `glyphs/priority-offset-plan.md` for the map↔catalog reconciliation trail.

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
