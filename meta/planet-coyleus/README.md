# planet-coyleus — Terrains

An **exploration** project, not a product. The question: can the fixed glyph
catalog be hand-painted into a Coylean map that reads as a *planet* — water,
forests, deserts, mountains — that stays coherent all the way down a deep zoom?

`terrains.html` is the lab where we color and look. This README is the
shared-vocabulary anchor + the log of what we settle, in the spirit of
`meta/superglyphs/README.md`. Read that first for the map/glyph/anchor/cage
vocabulary; this file only adds the coloring layer.

> **Just for exploration.** Nothing here is load-bearing for the engine or the
> big-map. We're chasing a *good-looking* terrain and learning glyph
> relationships by watching color ripple, not shipping a renderer.

---

## What we're coloring

- **The 12 glyphs visible from the anchor points** — the 12 D4 orbits that the
  anchor family (`lat/long ∈ {0,1}`) closes on (35 codes / 12 orbits, per
  superglyphs). These are the entire alphabet a coherent anchor map is tiled
  from, so coloring them colors *everything*.
- **Unit of color = the 16 cells.** A rendered glyph is a **4×4 cell grid**
  (`GRID_CELLS = NUM_CELLS + 1 = 4`); each of the 16 cells gets its own color.
  The map at depth is a grid of colored cells. **The lines are a separate
  matter** (see *Layers* below) — for now we color cells only.
- **Palette is keyed per D4 orbit (12 keys).** You paint one canonical member's
  16 cells; every other orbit member derives its colors by applying the **same
  D4 element to the 4×4 cell grid** (the dihedral action on a 4×4: a 90° turn
  cycles 4-orbits of cells, mirrors transpose them; no fixed centre on an even
  grid). This is what makes the scheme *systematic* and orbit-consistent across
  the map — and what makes a single edit ripple everywhere that orbit appears.
- **Orbit naming = `glyphs/assignments.json`.** We reuse that scheme verbatim:
  a member index is grid letter (`V`/`H`) + down digit + right digit, optional
  trailing D4 transform suffix (`e` identity; `1 2 3` rotations; `-` H-mirror;
  `|` V-mirror; `\` / `/` diagonal reflections). **Naming a member makes it the
  identity of its D4 group, and the whole orbit — spanning both the V and H
  grids via the backslash dual — follows automatically.** So the 12 orbit keys
  are exactly its 12 letters: **`F P J B O L Q E V C R N`** (canonical members
  `V77 V17 V66 V56 V00 V11 V25 V07 V15 V51 V61 V16`). The **Hxx members are not
  stored** — they're derived by the orbit rules, same as every other
  non-canonical member.

## Layers — what's colorable, in order of priority

A glyph has three independent colorable layers. We're doing the first now; the
others are noted so the data model leaves room.

1. **Cells (now).** The **16** fill squares of the 4×4 grid. This is the terrain.
2. **Lines (later).** The arrows: **18 vertical + 18 horizontal** segments
   (3×6 / 6×3). They are **reversed between V and H glyphs** — a V glyph's
   vertical-line layout is the H glyph's horizontal-line layout, transposed,
   which is the very V↔H backslash-dual transpose the orbit check confirmed.
   Potentially colorable as a second pass; kept out of the cell palette for now.
3. **Cage (separate).** The surrounding high-valuation walls that fence the
   glyph. These **carry priorities** (2-adic valuation → cage depth), so their
   coloring is a function of *address/cage level*, not glyph code — a different
   keying entirely. Treat as its own layer; don't fold into the orbit palette.

## How color flows (the iterative loop)

Color is a **global function of the glyph orbit**. Recoloring an orbit:

1. repaints every section of that orbit, at every zoom; and
2. changes how its **substitution parents** (`V_TO_H` / `H_TO_V`, the 1→2 split
   that flips V↔H) and **translation parents** (`TRANSLATION_V/H`, the 1→4
   split) look — because a parent is rendered from its children's colors.

So the page shows a **focus glyph + its 2 substitution children + 4 translation
children + a live map**: paint the focus, watch the relatives and the planet
move. That cross-effect *is* the thing we're studying.

## Persistence

Schemes save to JSON in `schemes/` — `{ name, orbits: { <letter>: {
canonicalCode: "d,r", cells: [16 hex] } } }`, where `<letter>` is the
`assignments.json` orbit letter (`F`, `P`, …). Non-canonical members — every Hxx
included — are never stored; they're derived by the orbit rules. Survives
reloads, can be committed as named planets.

## The Quadrant map — one zoomable Coylean map, the V/H ladder is the zoom

The map is **one** pan/zoom canvas (`drawQuadrant`), modeled on
`superglyphs/universe.html` but built on direct `computeMapModel` per rung (the
palette alphabet closes at 12 orbits, so deep descent isn't needed — see
`test/ladder.mjs`).

- **Zoom walks the V/H ladder.** A rung is `(order, seniority)`: `V_n` (2ⁿ×2ⁿ
  square), `H_n` (2ⁿ×2ⁿ⁺¹ wide, the v→h intermediate), `V_{n+1}`, … Each rung's
  `NSr×NSc` section grid maps onto the same unit square `[0,1]²`, so a V glyph's
  screen rect is exactly tiled by its 2 H children (left|right), then each by 2 V
  grandchildren (top/bottom). The **alternating zoom falls out for free** — H
  rungs draw half-width cells, the footprint stays square; no anisotropic code.
  LOD picks the rung from zoom (`k ≈ 2·log2(z/TARGET) − 4`). The sidebar **Order**
  list jumps to a rung.
- **Seniority is the rung.** Crossing a half-step flips the global seniority, so
  the focus / relatives / palette all follow the rung you're looking at. (The
  `Sen` button folded into the ladder; Orientation is just the quadrant anchor.)
- **The map is only the Coylean line field.** No cell fills, no swatches, no
  separate cage-wall overlay — just the map's own down/right lines, each scaled by
  its **2-adic priority** so the cage hierarchy reads as **various thicknesses**
  (thin interior arrows → heavy cage walls; capped at p=6). Sub-pixel lines are
  skipped, giving a natural LOD (zoomed out → only thick walls; zoomed in → full
  arrow field). Coloring shows in the focus/relatives editors; **hover** maps a
  cell to its glyph (HUD `letter+op` tag), **click**/right-click paint/erase that
  orbit.

### The coarse-swatch constraint (turtles all the way down)

(Relevant once colors fill the map; the current map is lines-only.)

The map is a substitution fixed point, so **a colored cell at zoom _N_ is the
coarse swatch of a whole colored glyph at zoom _N+1_** — which is itself 16
colored cells, each the swatch of a glyph one level deeper. The LOD shows both
forms *at the same time* across a zoom seam, so a palette must read well **both
as a single 16-cell fill and as the average color of that glyph zoomed out.**

Consequence for the ramps: if a biome's 16 cells average to grey mud, the planet
turns to mud when you pull back. So **keep each biome's stops in one hue family**
(which the OKLCH elevation ramps already do) — the zoomed-out average then stays
*inside* the biome instead of greying toward neutral. Practically, the coarse
swatch for a glyph should be the **mean of its cells in OKLCH** (or just its
biome's `base` stop), not an sRGB average, so it lands on-hue. Verify a planet
still reads as itself at low LOD before trusting a scheme.

---

## Terrain ramps (OKLCH) — starting points

Built with `oklchHex(L, C, H)` / `makeRamp(hue, roles)` from
`meta/4d/src/oklch-ramps.js` (same helper the 4d pages use; mirrors
`meta/oklch.html`). Each terrain is one **hue family**; the stops run by
**elevation/depth** rather than the outline→glow lighting roles. Working
hypothesis for the systematic scheme: **orbit → biome (one ramp), cell position
→ elevation stop within that ramp.** All values provisional — this is a sketch
to tune in `terrains.html`.

| terrain  | hue | stops (role: `[L, C]`) |
|----------|-----|------------------------|
| **water**    | 245 | deep `[0.30, 0.10]` · mid `[0.45, 0.13]` · shallow `[0.62, 0.11]` · foam `[0.85, 0.04]` |
| **forest**   | 145 | canopy-dark `[0.38, 0.10]` · canopy `[0.52, 0.14]` · meadow `[0.68, 0.13]` · dry-grass `[0.80, 0.10]` |
| **desert**   | 75  | dune-shadow `[0.55, 0.08]` · sand `[0.72, 0.10]` · bright-sand `[0.84, 0.09]` · pale `[0.92, 0.05]` |
| **mountain** | 55  | rock `[0.40, 0.04]` · scree `[0.55, 0.03]` · bare `[0.70, 0.02]` · snow `[0.95, 0.01]` |
| **mars**     | 32  | basalt `[0.32, 0.06]` · rust `[0.48, 0.12]` · ochre `[0.62, 0.11]` · pale-dust `[0.78, 0.06]` |
| **ice**      | 262 | deep-ice `[0.42, 0.09]` · glacier `[0.60, 0.10]` · frost `[0.78, 0.07]` · rime `[0.92, 0.03]` |
| **dusk**     | 305 | shadow `[0.34, 0.10]` · heather `[0.50, 0.14]` · glow `[0.66, 0.13]` · haze `[0.82, 0.08]` |

Mountain runs **low chroma** so it reads as rock→snow next to the saturated
biomes; mars is the **reddish** iron-oxide terrain (basalt → rust → ochre →
dust); ice is the **blue** frozen terrain (deep-ice → rime); dusk the
**violet** twilight one (shadow → haze). All in gamut — verified.
Water/forest/desert keep chroma up so coastlines pop. Seven ramps × ~4 stops
gives the cell-level vocabulary; mapping the 12 orbits onto these biomes (by
V/H? by orbit size?) is open and the first thing to play with.

**Hue coverage — the wheel is closed:** mars 32 (red) · mountain 55 / desert 75
(warm) · forest 145 (green) · water 245 (blue-leaning) · ice 262 (blue) · dusk
305 (violet). Seven terrains span the full hue circle, so every orbit can take a
perceptually distinct biome.

## Verified (`test/orbits-12.mjs`)

`node meta/planet-coyleus/test/orbits-12.mjs` — all green:

- The anchor (clean V) map closes on **35 section codes / 12 D4 orbits**.
- Those 12 are **exactly** the 12 `assignments.json` letters, bijectively (no
  extras either way).
- **12 keys, not 24:** every V orbit transposes `(d,r)→(r,d)` onto an H orbit
  (12/12), so one orbit spans both grids — Hxx is derived, never stored.

The 12 orbits and their sizes (members in `{dr}` form):

```
  O  V00  size 1  {00}
  B  V56  size 2  {03 56}      C  V51  size 2  {51 54}
  E  V07  size 2  {07 57}      N  V16  size 2  {16 43}
  V  V15  size 2  {15 40}
  F  V77  size 4  {31 67 74 77} J  V66  size 4  {30 66 70 73}
  L  V11  size 4  {11 14 41 44} P  V17  size 4  {12 17 42 47}
  Q  V25  size 4  {25 26 33 65} R  V61  size 4  {24 27 37 61}
```

Sizes (1 / 2 / 4) are the number of distinct 16-cell renderings an orbit's
single painted canonical generates by D4.

### 16-cell D4 derivation (`test/cell-d4.mjs`) — all green

- Each of the 8 `VISUAL_D4` elements binds to exactly one rigid square motion
  (`e r r² r³` rotations, `s_h`/`s_v` mirrors, `s_d1`/`s_d2` diagonals): the
  arrow-segment transform and the cell transform are the *same* motion.
- The induced 16-cell maps are bijections and **compose like `d4Compose`** — a
  genuine group action, so chaining members and inverting a paint-back are
  consistent. The verified `CELL_PERM[8][16]` table is baked into `terrain-core`.
- **One canonical suffices for both grids:** every H member's pattern is a
  single-D4 image of its orbit's V canonical (12/12), so Hxx really is derived,
  never stored.

## Open questions

- **Which orbit → which biome.** No principled mapping yet; that's the point of
  exploring (cells start blank — you do the assignments).
- **Zoom flips global seniority.** Crossing a half-step rung swaps focus /
  relatives / palette V↔H. Intended (the tool tracks the rung), but if it reads
  as jarring, the alternative is to flip seniority only on explicit Order clicks.
- **Colors on the map.** The Quadrant is lines-only now; filling cells behind the
  lines (the coarse-swatch constraint above) is a deferred option.

## Pointers

- Vocabulary + anchor/translation/substitution rules: `meta/superglyphs/README.md`.
- Rule tables (`TRANSLATION_V/H`, `V_TO_H`, `H_TO_V`): `meta/superglyphs/tests/rules.mjs`.
- Glyph math (Node-importable): `glyphs/glyph-core.js` (`classifyVisualD4`, D4 algebra).
- Orbit naming + canonical members: `glyphs/assignments.json` (letters `F P J B O L Q E V C R N`).
- Zoomable-map reference: `meta/superglyphs/universe.html` / `universe.mjs`.
- OKLCH helper + ramp idiom: `meta/4d/src/oklch-ramps.js`, `meta/oklch.html`.
- Node checks (Node-importable, no canvas): `test/` — `orbits-12.mjs` (12-key
  palette shape), `cell-d4.mjs` (the verified 16-cell `CELL_PERM`),
  `quadrants.mjs` (four quadrant anchors × V/H on-anchor & paintable), and
  `ladder.mjs` (every V/H ladder rung, incl. the wide-H intermediates). Keep
  new exploratory checks here.

## Prototype

`terrains.html` (→ `index.html`) is live, built on the verified math. Three-layer
split like `glyphs/`: `terrain-core.js` (pure model — palette, `CELL_PERM`,
relatives, ramps) → `terrain-render.js` (canvas) → `terrains.js` (controller) →
`terrains.mjs` barrel. Start blank; pick a biome stop from the tray and click
cells to paint — every paint maps back to the orbit canonical so all occurrences
and siblings update at once. **Erase** with the chip or right-click; **undo**
with the button or ⌘/Ctrl-Z.

The relatives render structurally: the **substitution** is the substitution
pair with its bar — `left | right` (v→h) under V, `top / bottom` (h→v) under H;
the **translation** is the 2×2 `NW NE / SW SE` square with its cage-wall bars
(`vTop vBot hLeft hRight`). The focus glyph shows its **letter + operation**
(`letterTag`, ops `0123/\-|`, e.g. `F/`, `H13 → F2`), matching the V/H grids on
`glyphs/index.html`.

**Orientation** (sidebar): `Long`/`Lat` toggle the quadrant anchor
(curHInit/curVInit ∈ {0,1} — **NW NE SW SE**); seniority is the **Order** ladder,
not a button. The **color config is one shared palette** — keyed per orbit in the
V-rep frame, H glyphs derived — so it rides through every quadrant and seniority
unchanged (validated: all rungs × all quadrants on-anchor & paintable,
`test/ladder.mjs`).

**Theme**: light default, `Dark mode` checkbox; the CSS chrome is variables and
the drawn canvas neutrals follow via `setTheme`. Schemes save/load as JSON;
**undo** via button or ⌘/Ctrl-Z.

The map is finite per-rung `computeMapModel`; address-descent (for orders far
past where the palette repeats) remains a later option.
