# Basic Propagation: init row/column controls

Adds display and editing of the boolean init arrays in the Basic
Propagation prototype: a sidebar block with hex text inputs, plus
direct click-to-toggle on the init-row/column diamonds.

Commits on `main`:
- `777b05c` Phase 1 — hex display & text editing.
- `3e809e0` Phase 2 — click init-row diamonds to toggle bits.
- `88bf1ca` Phase 3 — gate clicks on Set mode; bright init arrows.

## Naming

The constructor of `Propagation` (in `coylean-explorer/coylean-core.js`)
already accepts two boolean arrays:
- `initDown` — top row of `downMatrix`, length `numColumns`. Vertical-flow
  init. (User's "vInitRows".)
- `initRight` — left column of `rightMatrix`, length `numRows`. Horizontal-flow
  init. (User's "hInitColumns".)

These are distinct from the existing scalar offsets `hInitCol` and
`vInitRow`, which shift the priority sequence. Names were kept as the
constructor already used them.

## Hex codec

`coylean-explorer/src/app/init-hex.js`

- `boolsToHex(bits)` — pad to next multiple of 8, MSB-first per byte,
  space-separated 2-char lowercase hex.
  - length 4 → `f0`
  - length 5 → `f8`
  - length 8 → `ff`
  - length 12 → `ff f0`
  - length 21 → `ff ff f8`
- `hexToBools(str)` — case-insensitive, whitespace-tolerant, accepts
  odd nibble counts. Returns `{ bits, length }` (length = nibbles × 4)
  or `null` on empty/invalid input.

## Sidebar UI

`coylean-explorer/basic-propagation-prototype.html`

New "Init" section between Seniority and Display:

- Mode button — toggles `Show` ↔ `Set`.
- Two text inputs, each on its own line:
  - `initDown (V, length numCols)`
  - `initRight (H, length numRows)`

CSS class `.hex-input` widens the box to 220px and switches it to
monospace. `.hex-input.error` flags invalid input.

## Page wiring

`coylean-explorer/src/app/basic-propagation-prototype-page.js`

- `config.initDown` / `config.initRight` — boolean arrays, default
  all `true`. Passed to `new Propagation(...)`.
- `paintInitInputs()` — repaints both inputs from config. Called at the
  end of every `render()`, so the inputs always reflect current state.
- `resizeBools(arr, len)` — extends with `true`, truncates from the end.
  Called from `syncNumericInputs()` only when `numRows`/`numCols`
  actually changed since the previous sync, to avoid clobbering
  freshly-set values.
- `commitHex(inputEl, dimKey, arrayKey)` — runs on the `change` event
  (blur or Enter). On valid input: updates `config[arrayKey]`,
  `config[dimKey]`, the matching numeric input's value, then `render()`.
  On invalid input: marks `.error` and leaves the value alone.
- `Show` / `Set` toggle flips `readOnly` on both inputs, sets
  `flags.initEditable`, and re-renders so the diagram repaints with
  the new arrow colors and (un)wired click handlers. Switching back to
  Show repaints the inputs and discards any pending typed text.
- Numeric inputs render on every `input` keystroke; init-hex inputs
  commit on `change` only.

## Click hooks

`coylean-explorer/src/display/render-propagation.js`

`renderPropagation`'s `hooks` arg accepts optional `onClickDown(i, j)`
and `onClickRight(i, j)`. They're attached only to init cells
(`j === 0` for down, `i === 0` for right), which also pick up an
`init-cell` class.

`coylean-explorer/src/app/basic-propagation-prototype-page.js`

The page passes `clickHooks` only when `flags.initEditable === true`
(Set mode); in Show mode the renderer omits the click listener
entirely. `clickHooks` flips the matching bit in `config.initDown` /
`config.initRight` and calls `render()`. Hex inputs repaint live, so
clicks win over any pending typed text in Set mode.

`basic-propagation-prototype-info.js` — hover hint changed from "always
true" to "click to toggle" for init cells, since they're now editable
(in Set mode).

## Set-mode visuals

`renderPropagation` reads `flags.initEditable` and recolors the init
arrows when it's true:
- init-row down arrows (`j === 0`): `#f00` (pure red), normally
  `#7a2d2d` (dark red).
- init-column right arrows (`i === 0`): `#00f` (pure blue), normally
  `#3d6a8a` (dark blue).

Diamond polygon fills are unchanged in either mode — only the arrow
color changes. Both `arrowMode === "full"` and `arrowMode === "line"`
respect the override.

## Granularity

- The numeric `numRows` / `numCols` inputs accept any positive integer.
- Editing the hex text input rounds the dimension to a multiple of 4
  (one nibble = 4 booleans). The matching numeric input is updated to
  match.
- A click on an individual diamond changes one bit and never changes
  the dimension.
- Display always pads to the next byte (so length 21 displays as
  `ff ff f8`, not `ff ff f` — the trailing 3 bits are pad-zero).

## Universe-Quadrants: extending init controls to four shared arrays

Goal: bring the same Init block (hex display/editing + click-to-toggle +
Set/Show mode) to `universe-quadrants-prototype.html`, but adapted to the
four-quadrant geometry. A single Universe has four central-axis init
arrays — one per side — each of which is *shared* by the two quadrants
that touch that side. Editing one entry must update both quadrants
together.

### Shared arrays — names and ownership

Each side of the cross has its own length, set by the matching extent.
Each array fills the `initDown` or `initRight` slot of the two quadrants
that touch it. Local frames already align (no reversal needed): for both
quadrants on a given side, the array's index 0 is the cell adjacent to
the origin, with index increasing outward along that axis.

| Sidebar field    | Length         | Sent to quadrant slot                   |
| ---------------- | -------------- | --------------------------------------- |
| `westInitDown`   | `westExtent`   | `nw.initDown` *and* `sw.initDown`       |
| `eastInitDown`   | `eastExtent`   | `ne.initDown` *and* `se.initDown`       |
| `northInitRight` | `northExtent`  | `nw.initRight` *and* `ne.initRight`     |
| `southInitRight` | `southExtent`  | `sw.initRight` *and* `se.initRight`     |

(Naming convention: `<side>Init<Axis>` matches the axis name already
used in basic-propagation, prefixed with the side whose extent gives
its length.)

### Core API: constructor changes

`coylean-explorer/coylean-core.js`

`Universe.createUniverseExtents(...)` and `Universe.createUniverseQuadrants(...)`
gain four optional named array params, defaulted to `undefined` (each
quadrant then falls back to its current all-`true` default):

```
createUniverseExtents(
    northExtent, southExtent, westExtent, eastExtent,
    hInitCol, vInitRow, seniority,
    { westInitDown, eastInitDown, northInitRight, southInitRight } = {},
)
```

The new options are forwarded to the right two quadrants:

```
nw: quadrant("nw", northExtent, westExtent, 1 - hInitCol, 1 - vInitRow,
             westInitDown,  northInitRight),
ne: quadrant("ne", northExtent, eastExtent, hInitCol,     1 - vInitRow,
             eastInitDown,  northInitRight),
sw: quadrant("sw", southExtent, westExtent, 1 - hInitCol, vInitRow,
             westInitDown,  southInitRight),
se: quadrant("se", southExtent, eastExtent, hInitCol,     vInitRow,
             eastInitDown,  southInitRight),
```

`Universe.create({...})` likewise accepts the four arrays and forwards
them. `createUniverseQuadrants` simply passes its options bag through to
`createUniverseExtents`.

The two quadrants on a given side get *the same array reference*. This
matters: the page-level click hook mutates the array in place, so both
quadrant Propagations see the change on the next `render()` because
`createUniverseExtents` is called fresh on each render and reads the
same arrays out of `config`.

### Sidebar UI

`coylean-explorer/universe-quadrants-prototype.html`

New "Init" section, placed after the existing Seniority block and before
Display:

- **Mode button** — toggles `Show` ↔ `Set` (same labels and gating as
  basic-propagation).
- **Four hex inputs**, laid out in the same N/W/C/E/S cross used for the
  extent inputs (`.extent-cross`), with an extra row above and below
  for `north`/`south` to host the right-init fields. Concretely, two
  separate cross blocks side by side or stacked:
  - **Down inputs** (`westInitDown`, `eastInitDown`) on a horizontal pair
  - **Right inputs** (`northInitRight`, `southInitRight`) on a vertical pair

  The simple stacked variant (two rows of two inputs, labeled with side)
  is acceptable and matches existing sidebar density. Each input gets the
  `.hex-input` class for monospace + width, and `.hex-input.error` for
  invalid input.

Labels in the field block: `westInitDown (length westExtent)`,
`eastInitDown (length eastExtent)`, `northInitRight (length northExtent)`,
`southInitRight (length southExtent)`.

### Page wiring

`coylean-explorer/src/app/universe-quadrants-prototype-page.js`

- `config.westInitDown / .eastInitDown / .northInitRight / .southInitRight`
  — boolean arrays defaulted to all-`true` at the appropriate extent.
- `flags.initEditable` — toggled by the new Mode button (separate from
  the existing range/extents Mode button, which is unaffected — this
  one will likely be labeled e.g. `Init` with values `Show`/`Set`).
- `paintInitInputs()` — repaints all four hex inputs from config; called
  at the end of every `render()`.
- `resizeBools(arr, len)` — reused from basic-propagation (or imported
  from a shared module — see Refactor note below). Called from
  `syncNumericInputs()` only when an extent changes since the previous
  sync, applied per-side: a change in `westExtent` resizes
  `westInitDown` only, etc.
- `commitHex(inputEl, sideKey, arrayKey)` — analogous to basic-prop.
  On valid input, updates `config[arrayKey]`, the matching extent input,
  and re-renders. On invalid input, sets `.error`.
- The four arrays are passed through the existing `createUniverseExtents`
  call (and the range-mode `createUniverseQuadrants` call, which forwards
  them transparently).

### Click hooks — mosaic view

`coylean-explorer/src/display/render-mosaic.js`

`renderQuadrant`'s caller-supplied `hooks` object gains optional
`onClickDown(name, i, j)` and `onClickRight(name, i, j)`. They are
attached only to init cells (`j === 0` for down, `i === 0` for right) of
each quadrant's panel. Init-cell polygons also get an `init-cell` CSS
class for parity with `render-propagation.js`.

The page's click handler maps `(name, i, j)` to the right shared array
entry, mutates that bit, and re-renders:

```
onClickDown: (name, i) => {
    if (name === "nw" || name === "sw") config.westInitDown[i] = !config.westInitDown[i];
    else                                config.eastInitDown[i] = !config.eastInitDown[i];
    render();
},
onClickRight: (name, _i, j) => {
    if (name === "nw" || name === "ne") config.northInitRight[j] = !config.northInitRight[j];
    else                                config.southInitRight[j] = !config.southInitRight[j];
    render();
},
```

Because the array is shared between two quadrants, the next render
shows the toggle in *both* affected panels simultaneously — that is the
mechanism by which "two sets of init arrows toggle together."

Click hooks are passed only when `flags.initEditable === true` (Set
mode); in Show mode the renderer omits the click listener entirely.

### Set-mode visuals — both views

`render-mosaic.js`'s `renderQuadrant` reads `flags.initEditable` and
recolors init arrows when true (mirroring `render-propagation.js`):
- init-row down arrows (`j === 0`): `#f00`, normally `#7a2d2d`.
- init-column right arrows (`i === 0`): `#00f`, normally `#3d6a8a`.

Polygon fills and stroke colors are unchanged in either mode — only
arrows recolor. Both `arrowMode === "full"` and `arrowMode === "line"`
respect the override.

In **mosaic view**, since the same shared array drives the init cells
of two quadrants, *both panels' relevant init bars* light up bright in
Set mode. This is automatic — each panel's `renderQuadrant` call
independently honors `initEditable`.

In **integrated view**, the boundary Propagation's init cells (far-N
row and far-W column of the integrated panel) likewise light up. See
the deferred section below — integrated view stays untouched in this
iteration.

### Granularity & rounding

Identical to basic-propagation:
- Numeric extent inputs (`northExtent`, etc.) accept any non-negative
  integer (existing constraint).
- Editing a hex text input rounds the matching extent to a multiple of
  4; the matching numeric input is updated to match.
- A click on an individual diamond changes one bit and never changes
  any extent.
- Display pads to the next byte.

### Refactor note: shared init helpers

`init-hex.js` (`boolsToHex`, `hexToBools`) is already a shared module —
no change needed.

`resizeBools` and the `commitHex` factory currently live inside
`basic-propagation-prototype-page.js`. Moving them out is optional;
duplicating them is fine for this iteration. If extracted, candidate
location: `src/app/init-controls.js` exporting `resizeBools` and a
`makeHexCommitter({ getConfig, render })` helper.

### Deferred — integrated view sidebar mismatch

The integrated boundary Propagation has its own `initDown` (length
`westExtent + eastExtent − 1`, the far-N row) and `initRight` (the
far-W column). These are **derived** from the universe's far edges by
`Propagation.fromUniverseBoundary` — not the same as the four central
shared arrays this iteration adds.

This means the sidebar's Init inputs (the four shared central-axis
arrays) describe the *mosaic*, not the integrated panel. The
integrated view has different constructor parameters that the current
sidebar does not represent.

**Out of scope for this iteration. Decision (user): leave integrated
view alone. Just preserve the four quad inputs — they apply to the
mosaic and to the universe construction; the integrated panel
re-derives its init from the universe boundary as today.** Set-mode
brightening on integrated-view init cells is fine as visual parity but
clicks are not wired in integrated view, and no override mechanism is
introduced.

A future revision should rework the sidebar so that, in integrated
view, the displayed constructor parameters are re-derived to match the
boundary Propagation (its own `numRows`/`numColumns`, `hInitCol`,
`vInitRow`, `initDown`, `initRight`) rather than the four shared
quadrant arrays. That is a separate workstream — track it when picked
up.

### Phasing

A reasonable commit sequence (mirrors basic-propagation's three phases):

1. **Phase 1 — core API + sidebar hex display & text editing.**
   Constructor takes the four arrays; sidebar shows them; editing the
   text commits to config and re-renders. No click hooks yet.
2. **Phase 2 — click init-cell diamonds to toggle bits.** Add
   `onClickDown`/`onClickRight` to `render-mosaic.js`; wire up the
   page-level handler that maps `(name, i, j)` to the right shared array.
3. **Phase 3 — Set-mode gating + bright init arrows.** Mode button,
   `initEditable` flag, click gating, recolored arrows in both
   `render-mosaic.js` paths (mosaic + integrated).
