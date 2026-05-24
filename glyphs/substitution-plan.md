# Plan — bring the substitution explorer into `glyphs/substitution.html`

**Status: DEFERRED (back burner) — not started.** Parked 2026-05-24.
Baseline commit: `0de16e1`. Source to port: `substitution/explorer.js`
(1260 lines, plain script). Target reuses post-rewrite `glyphs/glyphs.js`
(calibrated `D4_MATRIX` scheme) + `coylean-explorer/coylean-core.js`.
**Resume at Phase 1** (extract `glyph-lib.mjs`) — see Steps.

Goal: recreate the *unique* functionality of `substitution/explorer.js` as a new
page **`glyphs/substitution.html`** that runs on the **existing glyphs logic**
(the corrected D4-matrix letter scheme + `coylean-core.js`), deleting the forked
duplication. The standalone `substitution/` page is then retired.

## Why

`substitution/explorer.js` is a plain `<script>` (not a module), so it could not
import `coylean-core.js` and instead **re-implements** the algorithm, D4
machinery, and letter assignments inline. It is now a fork of the *pre-rewrite*
glyphs code, so it is wrong in two ways:

- old letter scheme (V upright `F P J M O L Q T B Y R S`, H backslash) — none of
  the new V-sideways / H-upright symbols (M→B, T→E, B→V, Y→C, S→N) or `\`/`/`
  diagonals;
- old `scale(sx,sy)`+slash letter rendering (`ftToD4Explorer`, L934–935) — the
  axis-swap composition bug we replaced with the calibrated `D4_MATRIX`.

## Functionality to port (the "good" parts — not in glyphs today)

1. **Self-substitution table** — the 34 reachable `(down,right)` codes, each → a
   fixed 2×2 child block, grouped by D4 orbit, boundary borders between children.
   V and H. (`SUB_TABLE`/`REACHABLE`, `buildSubTable`, `buildSubCard`.)
2. **Reachable-codes lists**, V and H (`buildCodeList`, `buildHCodeList`).
3. **Interactive zoom explorer** — click a section to zoom (`expandGrid` on
   demand), zoom-out stack, hover highlight, Dots/Letters toggles.
4. **Universe view** — 2×2 quadrant seed `J|M / J·sₕ|F` (codes V66, V56, V73,
   V77) expanded twice through the V rule, zoomable. (`buildUniverseSeed`,
   `initUniverse`, the `uni*` functions.)

## Duplication to drop (reuse existing instead)

| `explorer.js` (delete) | reuse from |
| --- | --- |
| `computeMaxPri`, `priority`, `computePattern`, `computePatternH` | `coylean-core.js` `pri`, `Seniority`, `Propagation` (already used by `glyphs.js`) |
| `VISUAL_D4`, `transformedPatternKey`, `D4_TO_SCALE`, `classifyVisualD4`/`H` | `glyphs.js` D4 section (the calibrated `D4_MATRIX` version) |
| `assignLetter`/`assignHLetter` + 24 assignment calls | `glyphs.js` `NEW_ASSIGNMENTS` + `applyNewAssignments`/`applyOldAssignments` |
| `glyphLabel`/`hGlyphLabel`, `SUB_DIGITS`, `drawDot`, `ftToD4Explorer` | `glyphs.js` equivalents (`glyphLabel`, `hGlyphLabel`, `D4_TO_BABY`, `drawDot`) |
| `getSectionData` | `glyphs.js` `getSectionData(Nr,Nc,seniority)` |
| per-section glyph drawing in `renderOnCanvas` | shared `drawSection` extracted from `glyphs.js` `drawGlyph` |

## Architecture — extract a shared module

Today `glyphs.js` keeps all of the above as module-private symbols and runs the
index page on load. To reuse them on a second page, hoist them into a shared
module that both pages import.

```
glyphs/
  glyph-lib.mjs       NEW — shared core (no DOM/side effects on import)
  glyphs.js           index.html controller        → imports glyph-lib.mjs
  index.html
  substitution.mjs    NEW — substitution.html controller → imports glyph-lib.mjs
  substitution.html   NEW
```

`glyph-lib.mjs` exports (all currently inside `glyphs.js`):

- D4: `VISUAL_D4`, `transformedPatternKey`, `applyVisual`, `matMul`,
  `D4_MATRIX`, `d4Compose`, `D4_SUFFIX`, `D4_TO_BABY`, `D4_NAMES`
- glyphs: `computePattern`, `classifyVisualD4`, `bitsToBoundary`
- letters: `assignLetter`, `NEW_ASSIGNMENTS`, `slashToD4`, and a **factory**
  `buildAssignments(useNew) → { vLetters, hLetters }` (wraps the current
  `applyOldAssignments`/`applyNewAssignments`/`applyHAssignments`, returning the
  populated maps instead of mutating module globals)
- labels/data: `glyphLabel`, `hGlyphLabel`, `SUB_DIGITS`
- section/grid data: `getSectionData`
- rendering: `drawDot`, `toFt`, `V_COLOR`, `H_COLOR`, and a new
  `drawSection(ctx, {dc, rc, seniority, x, y, cell, letters, dots, babyBlocks,
  outline}, lookup)` — the per-section propagate-lines + dots + D4-matrix letter
  overlay, factored out of `drawGlyph`/`drawCoyleanMap`'s overlay block

`glyphLabel`/`hGlyphLabel` must take the lookup maps as args (not read globals)
so each page can hold its own V/H maps.

## Substitution-specific code (lives in `substitution.mjs`)

Carry over, rewritten on the shared core:

- `SUB_TABLE`/`REACHABLE` (V) and `H_SUB_TABLE`/`H_REACHABLE` — built from
  `getSectionData(32,32,…)`, `(64,64,…)`, `(128,128,…)` instead of the inline
  `getSectionData(N, seniority)`. Keep the orbit-grouped card display.
- `expandGrid(grid, vBound, hBound, ns, SUB_TABLE)` — pass the table in.
- `buildUniverseSeed` / `initUniverse` and the explorer zoom/render loop, using
  `drawSection` per cell + the boundary-segment pass.
- Reuse the new sidebar pattern (New scheme / Show indices / Baby Blocks /
  Outline) so the page matches `index.html`.

## Steps

1. **Extract `glyph-lib.mjs`** from `glyphs.js`; make `glyphs.js` import it. No
   change to `index.html` behavior. Convert globals it mutates (`GLYPH_LETTERS`,
   `H_GLYPH_LETTERS`) to the `buildAssignments` factory + page-local maps.
   **Checkpoint:** `index.html` renders identically (maps, grids, tables, both
   toggles) — diff against current screenshots/manual check.
2. **Add `drawSection`** to the lib, refactor `drawGlyph` and the assigned-letter
   branch of `drawCoyleanMap` to call it. **Checkpoint:** index page unchanged.
3. **Build `substitution.html` + `substitution.mjs`**: substitution table +
   reachable codes (V and H), then the explorer, then the universe view.
   **Checkpoint:** `SUB_TABLE`/`REACHABLE` match the old explorer's output (34
   V codes; compare child blocks + boundary flags for several codes — see Risks).
4. **Wire links + retire old page**: breadcrumb in `glyphs/index.html` →
   `substitution.html`; point `substitution/index.html` at the new page (or
   delete `substitution/` and update any inbound links). `grep -rl substitution/`
   first.

## Risks / checkpoints

- **`getSectionData` boundary semantics differ** between the two
  implementations (glyphs counts a boundary segment along the whole exit
  column/row; explorer sets it from specific cells). The 2×2 child borders in the
  substitution cards depend on this — verify a handful of `SUB_TABLE` entries
  (e.g. F=7,7; J=6,6; M=5,6) reproduce the old explorer's borders before trusting
  the rest.
- **Letter scheme now differs** — the ported table/explorer will show the new
  sideways/upright symbols, not the old upright letters. Intended, but it means
  the page won't visually match the old `substitution/` page; confirm that's
  wanted (it is, for consistency with glyphs).
- **Universe seed codes** (V66/V56/V73/V77) are scheme-independent (they're input
  codes, not letters), so the universe structure is unaffected by the rewrite;
  only the rendered letters change.

## Open decisions (defaults chosen — change on resume if wanted)

- Shared-module name → **`glyph-lib.mjs`**.
- `substitution.html` controls → **include the same sidebar/chicken switch** as
  `index.html` (New scheme / Show indices / Baby Blocks / Outline), for
  consistency.
- Old `substitution/` → **delete** after the breadcrumb relink (it's a stale
  fork; keep nothing). Confirm no other inbound links via `grep -rl substitution/`.
