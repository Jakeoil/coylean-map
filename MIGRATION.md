# Migration — shared code → `src/`, addressed by the `coylean/` prefix

Goal: move reusable guts into `src/` and import them everywhere by a single
root-anchored prefix (`coylean/…`), so there are no `../../` chains and a future
move is a one-line map edit. Pages stay in their feature dirs; only shared code
moves.

## End-state layout
```
src/
  core/        coylean-core.js              → "coylean/core"     (pure map engine; Node-importable, no DOM)
  glyphs/      glyph-core.js                → "coylean/glyphs"   (pure glyph math)
  ui/          glyph-render.js + render guts→ "coylean/ui/render"(canvas/DOM rendering)
    prototype/ base.css + shared page chrome
  assets/      baby-blocks (svg+js), shared JSON, icons
test/
  lib/         reusable helpers (sectionize, tromino-table builder, ascii-bitmap)
  …            feature tests, importing "coylean/*"
```
Everything else (HTML + page controllers in `glyphs/`, `meta/*`,
`coylean-explorer/`, …) stays put and imports from `coylean/…`.

## The `coylean/` scheme (resolved two ways — verified PASS, both runtimes)
Browser — inline import map, in `<head>` **before** any module script:
```html
<script type="importmap">
{ "imports": {
  "coylean/": "/src/",
  "coylean/core": "/src/core/coylean-core.js",
  "coylean/glyphs": "/src/glyphs/glyph-core.js",
  "coylean/ui/render": "/src/ui/glyph-render.js"
} }</script>
```
Node — root `package.json` `exports` (self-reference, no build/install):
```json
"exports": {
  "./core": "./src/core/coylean-core.js",
  "./glyphs": "./src/glyphs/glyph-core.js",
  "./ui/render": "./src/ui/glyph-render.js",
  "./*": "./src/*"
}
```
Both make every file write `import { … } from "coylean/core"` etc.

## Safety rules (hold for every step)
- **`git mv`** to move files (preserve history).
- **Re-export shim** left at each *old* path until its importers are repointed;
  delete the shim only when `grep` shows zero importers of the old path. This
  means **no commit is ever broken** — old and new paths both resolve mid-flight.
  (Shim body: `export * from "<new path>";` — add `export { default } from …`
  too if the module has a default export.)
- **Don't edit moved files' contents** in the same step as the move (especially
  the frozen-API `coylean-core.js`): move first, repoint imports, verify; change
  behaviour only in a separate, intentional commit.
- **One feature dir per batch**, its own commit.
- **Verify after every batch** (see harness below) before moving on.

## Verification harness (run after each batch)
1. `npm run test:imports` — resolution smoke (Node).
2. The migrated dir's Node test(s), e.g. `node meta/superglyphs/tests/scale-up.mjs`.
3. Load that feature's main page on `http://localhost:8011/…` (manual).
The smoke tests stay permanent: `test/import-smoketest.mjs` (Node),
`import-smoketest.html` + `import-smoketest.mjs` (browser).

## Phases

### Phase 0 — bootstrap  ✅ DONE (this session)
Root `package.json` (name `coylean`, `type:module`, `exports`); `src/core/`
shim; browser + Node smoke tests both PASS.

### Phase 1 — land the engine in `src/core`
- `rm src/core/coylean-core.js` (the temp forward-shim).
- `git mv coylean-explorer/coylean-core.js src/core/coylean-core.js`.
- Create reverse shim `coylean-explorer/coylean-core.js`:
  `export * from "../src/core/coylean-core.js";`
- Verify. Now `coylean/core` hits the real engine; the 60 existing relative
  importers still work via the reverse shim.

### Phase 2 — repoint core importers (batch by dir), then drop the shim
Order smallest → largest so failures are cheap to read:
`meta/how-to-draw-square`(1) · `meta/glyph-color`(1) · `meta/fibonacci-ruler`(1)
· `meta`(1) · `meta/coylean-globe`(2) · `meta/toy-rendering`(2) ·
`meta/superglyphs`(2) · `meta/planet-coyleus`(2/+3 test) · `meta/conduits`(5) ·
`coylean-explorer` + `…/src/app` + `…/src/display`(~11) · `meta/big-map`(8) ·
`meta/superglyphs/tests`(8) · `glyphs`(16).
Per file: `from "…coylean-explorer/coylean-core.js"` → `from "coylean/core"`.
Per HTML page in the dir: add the import-map block.
When `grep -rl coylean-explorer/coylean-core README/code` is empty → delete the
reverse shim. Commit.

### Phase 3 — `glyph-core` → `src/glyphs` (= `coylean/glyphs`)
- `git mv glyphs/glyph-core.js src/glyphs/glyph-core.js`; reverse shim at
  `glyphs/glyph-core.js`.
- Repoint glyph-core's own engine import to `coylean/core`.
- Repoint the 35 importers, batch by dir; drop the shim when grep-clean.

### Phase 4 — `glyph-render` → `src/ui/glyph-render.js` (= `coylean/ui/render`)
- `git mv`; reverse shim at `glyphs/glyph-render.js`.
- Repoint render's imports (`coylean/glyphs`); fix its lazy `import()` + `fetch`
  of baby-blocks (interim relative until Phase 5).
- Repoint the 7 importers; drop shim when clean.

### Phase 5 — assets → `src/assets`
- Move `baby-blocks/` (svg+js), shared JSON, icons. Update render's baby-blocks
  `import()`/`fetch` paths and any page `fetch("./assignments*.json")` that used
  a *shared* copy. Per-page JSON stays local (decide per file).
- Verify baby-blocks render on tromino / substitution / glyphs index.

### Phase 6 — `src/ui/prototype/base.css` (opportunistic, non-gating)
Extract the shared inline `<style>` (body/font, breadcrumb, panel-title,
buttons, banner) into one stylesheet; pages `<link>` it and keep only
page-specific rules. Migrate pages as you touch them.

### Phase 7 — consolidate tests into `test/`
Move the Node suites (`meta/superglyphs/tests/*`, `glyphs/test-*`,
`meta/planet-coyleus/test/*`) into `test/` mirroring features; repoint to
`coylean/*`. Extract reusable helpers → `test/lib` (the `sections()` /
tromino-table / ascii-bitmap code currently re-written inline). Add scripts
(`test:core`, `test:glyphs`, `test`). Biggest test-import churn — do last,
running each suite as it moves.

## Rollback
Each phase/batch is one commit; shims keep half-migrated states working. To
undo, revert the commit.

## Effort
~17 dir-batches, 43 HTML pages get the import-map block, 64 importer files
repointed. Independently shippable per batch; spread across sessions.
