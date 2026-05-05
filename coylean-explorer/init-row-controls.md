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
