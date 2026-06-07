# The Conduits — worldbuilding scenes + a living catalog

`meta/conduits/` is the artful corner of the project: the Coylean map dressed up
as a world. Everything here loads via `<script type="module" src="./x.mjs">`
(house rule — no inline module scripts). The math is always the real engine; the
art is a skin over it.

## Pages

| Page | What it is |
| --- | --- |
| `index.html` | **The Yellow Conduit** — the scene hub. Links to the others. |
| `descent.html` / `.mjs` | **Descent** — the map in the draw map's *elaborate* dress: every cell a nest of priority-sized rectangles, color-coded by depth (the 19-step `COLOR_LIST`, verbatim from `coylean.js`). Free zoom/pan, depth + priority dials, day/night. **This is where the living-glyph colors come from.** |
| `compound-glyphs.html` / `.mjs` | The real lettered map at anchor 1/1. Baby-block letters at each glyph's D4 orientation; no-bar neighbors fuse into *compound* rectangles. Has the **orientation card** (anchor quadrant + V/H seniority) — both seniorities show the square compounds. |
| `turtle-paradise.html` / `.mjs` + `turtle-paradise-data.js` | **Turtle Paradise** — a living catalog of glyphs (see below). |
| `turtle paradise.md` | The source Excalidraw sketch (Obsidian) that inspired the living glyphs. Baked to `turtle-paradise-data.js`. |

---

# Turtle Paradise — build plan & phases

## The idea (the inspiration chain — read this first)

1. **Jake's Excalidraw sketch** (`turtle paradise.md`) — a hand drawing of the
   elaborate render: nested rectangles + dot "eyes" in the green / yellow / pink
   glyph palette. The lone **F** text element keys it (via `assignments.json`,
   `"V77":"F\\"`) to the F glyph.
2. **Descent's elaborate coloring** — the depth-colored nested rectangles are
   the *visual* inspiration: a glyph isn't a flat symbol, it's a living nest of
   color.
3. **Living glyphs** — so each glyph in the catalog is rendered as a small
   creature with a calm **breathing-idle**: the cluster breathes and sways, the
   dots pulse and blink like eyes.

The "light motif" = the leaf palette (`GREEN #b2f2bb`, `GREEN_DEEP #2f9e44`,
`YELLOW #ffec99`, `YELLOW_DEEP #f08c00`, `PINK #ffc9c9`) on a cream ground
(`#fbfdf6`). Keep new UI in this register — light, leafy, glowing — not the dark
chrome of the other conduit pages.

## The catalog = the 12 lettered V-glyphs

There are exactly **12** lettered glyphs in `glyphs/assignments.json` (the V
grid), and **F must be among them**:

```
F V77   P V17   J V66   B V56   O V00   L V11
Q V25   E V07   V V15   C V51   R V61   N V16
```

(`Vdr` = V grid, down-code `d`, right-code `r`.) These are the 12 orbits —
`planet-coyleus/terrain-core.js` calls them exactly that.

## APIs to lean on (don't hand-roll)

- **`glyphs/glyph-core.js`** — `computeGlyphMatrices(dc, rc, seniority)` gives a
  glyph's propagated segment matrices (the Node-importable layer — validate
  here). `glyphLetterAt(grid, d, r)` → `[letter, d4Index]`. `setOffset`,
  `computeMapModel`.
- **`coylean-explorer/coylean-core.js`** — `Seniority.vertical()` /
  `Seniority.horizontal()`.
- **`meta/conduits/descent.mjs`** — `COLOR_LIST` + `renderComplex`: the
  elaborate nested-rectangle renderer, if a phase wants real depth-color nests
  inside a living glyph.
- **`meta/planet-coyleus/terrain-core.js`** — *the best glyph work in the repo.*
  The 12-orbit model, per-orbit cell palettes, and crucially:
  - `splitGlyph(grid, d, r, seniorityH)` → a glyph's **2×2 of children** in the
    sibling grid + the bars between them (the substitution recursion —
    "turtles all the way down" made literal).
  - `V_TO_H` / `H_TO_V` translation rules, `focusGlyph` + relatives, ancestry
    via the reverse of the split.
  Mine this for Phases 3+.

---

## Phases

### Phase 0 — DONE (committed `ce68ffe`)
The page exists: a featured **F** hero (replays the baked sketch) + 11 engine
"seedling" tiles (the other lettered glyphs from `computeGlyphMatrices`), all on
one shared `requestAnimationFrame` breathing loop. 12 glyphs total.

### Phase 1 — Selected glyph + a selectable collection of 12
**Goal:** restructure from "fixed F hero + 11 others" into "one **selected**
animated glyph + a collection of **all 12** thumbnails (F included), click to
select." Jake: *"you should be able to guess"* what the selected view shows —

> **My guess (confirm/correct):** A large hero panel shows the **currently
> selected** glyph, living and animated. The 12 glyphs appear as a strip/grid of
> small breathing thumbnails beneath it; the selected one is highlighted.
> Clicking a thumbnail crossfades it up into the hero and updates a caption
> (`letter · Vdr · symbol`). **F is selected by default**, and when F is selected
> the hero shows the Excalidraw **sketch replay**; the other 11 show their engine
> living-glyph rendering, enlarged. Everything keeps the breathing idle.

Implementation notes for the next guy:
- **Stubs are fine for now.** The hero can show a static-but-breathing *stub*
  glyph (the engine seedling). The fully-animated per-glyph "monster" comes in a
  later pass — Phase 1 just needs selection working.
- The `CATALOG` array already carries `{kind, letter, code, sym, …}` per entry —
  keep F's sketch `data` for its hero; the other 11 carry `dc`/`rc` for the
  engine stub.
- One `selected` index in module state; `drawSketch`/`drawEngine` already take
  `(ctx, W, H, entry, t, phase)` so the hero just calls the selected entry's
  draw at hero size, thumbnails call at thumb size. No new renderer needed.
- Crossfade = a soft `fadeT` ramp on select (the `descent.mjs` trick).

**Status: Phase 1 DONE (this pass)** — animated hero of the selected glyph + a
strip of 12 thumbnails (F included), click to select, F default. Refinements:
- **The 12 thumbnails are STATIC stubs** (drawn once at the rest pose); the only
  thing that changes on select is the highlight. Just the *hero* animates.
- **The stub is sized to a fraction of the tile** (`STUB_FRAC`) so it is never
  larger than the future monster — same size in the big hero and the thumbs.
  The stub shows **the glyph unchanged**, its letter **centred** where it
  belongs (not in a corner).
- **The info-area badge is a properly oriented baby block.** The hero-meta badge
  (`#heroBadge`, a `<canvas>`) renders the selected glyph's letter via the same
  approach as compound-glyphs — `babyBlocks.drawDirect(..., {outline:false})`,
  oriented by `glyphLetterAt("V", dc, rc)` → `[letter, d4Index]` (verified:
  V77→F/`d`=backslash, V17→P/`d'`=slash). Oriented-font fallback until the SVG
  loads. (`D4B` / `D4M` mirror compound-glyphs — keep them in lock-step.)

> **Heads-up for Phase 2 (Jake):** when the orientation triplet writes into this
> box, **the proper oriented stub glyph must re-render** — the glyph segments
> (`glyphMatrices`, currently hard-wired to `Seniority.vertical()`), the centred
> letter, and the badge (`renderBadge`, currently the glyph's native `d4Index`).
> Thread the chosen orientation/seniority through all three. The stub is already
> the unit that re-renders; Phase 2 just changes *which* orientation it draws.

### Phase 2 — The orientation triplet (light-motif, 3 buttons only)
A compact triplet like the one just added to `compound-glyphs` — but **only the
three buttons with their status** (↔ longitude, ↕ latitude, ⤢ seniority), styled
in the leaf/cream motif, no quadrant label panel. Jake: *"you should guess what
it does (tell me)."*

> **My guess (confirm/correct):** On a single *glyph* (not the map), the dyadic
> anchor doesn't move the glyph — the 64 glyphs are a fixed catalog; the offset
> only moves the *map*. So here the triplet re-orients **the selected glyph
> itself** via its D4 group:
> - **↔ longitude** → reflect the glyph across the vertical mirror (E/W flip).
> - **↕ latitude** → reflect across the horizontal mirror (N/S flip).
> - **⤢ seniority (V/H)** → the transpose / backslash dual — show the glyph in
>   its sibling grid (`glyphLetterAt("H", …)`), the V↔H pairing.
>
> Net effect: the same three controls that *re-anchor the map* on
> compound-glyphs instead *re-orient the living glyph* here — consistent verbs,
> meaningful on a fixed catalog. Status text shows the current orientation
> (e.g. `e`, `↔`, `\`).

**Confirmed by Jake.** Display only: re-orienting *draws the monster* in the new
orientation, or *shows the stub with the corrected letter*. Three buttons +
their status, leaf/cream motif, no quadrant-label panel.

### Phase 3 — Splits & ancestry (stretch, from terrains)
The richest direction. Using `terrain-core.splitGlyph`, let the selected glyph
**split** in place: its 2×2 of children grow out of it (turtles all the way
down), each a living glyph, with the dividing bars drawn. The reverse — climbing
to the **ancestor** — is the same machinery run backward. This is where Paradise
meets the substitution recursion that makes the whole project tick. Lift the
proven logic from `planet-coyleus/terrains`; don't reinvent it.

### Phases 4 & 5 — Open (compound) sides on the hero
A hero glyph can be a *member* of a **compound** (a no-bar neighbor fusion — see
`compound-glyphs`). The hero will eventually show its **open sides**: every edge
where this glyph *could* fuse with a neighbor shows the option (the no-bar
side), so you can see how the creature would join its neighbors into a larger
rectangle. **Phase 4** = detect & show *which* sides are open; **Phase 5** =
render the fusion option on the edge. Pull the no-bar adjacency logic from
`compound-glyphs.mjs` (`vBar` / `hBar`, `findFaces`).

## Life modes (future — the breathing has depth)

The breathing idle is only the **at-rest** mode. The full life simulation:

- **At rest** (current) — the calm breathing idle.
- **Growing** — *vertical* and *horizontal* respectively (tied to seniority
  direction). Still reads as breathing, but it is now *generative* — the
  creature is growing along its grain.
- **Held breath / stress** — occasionally the bug **doesn't exhale**. That
  models **stress generated on its parent**, which propagates **up the chain**
  (ancestry): a child holding its breath strains its parent, and so on up the
  split hierarchy. So breaths are *coupled* across the family tree — which ties
  Life modes directly to Phase 3 (splits & ancestry).

---

*Notes for the next guy:* keep the engine in `glyph-core` (Node-importable —
validate splits/orientation there with an ASCII dump before touching canvas).
Don't reload the page via script — Jake runs his own dev server. Commit style:
descriptive title + body; work merges to `main`.
