# Sliding Ruler — Enhancement Plans

Ideas for both the test page (`test.html`) and the upstream
`SlidingRuler` library at `jakeoil.github.io/lg-remote/volume-ruler-control`.

## Upstream library (lg-remote)

- **Native mouse-wheel support.** Currently wrapped in the test page. Move
  the handler into `SlidingRuler` so all consumers get it. Should respect
  `passive: false` and use the same accumulator pattern. Optionally
  configurable: `wheelSensitivity` (units per 100px of deltaY) and
  `wheelEnabled` (bool).
- **Keyboard support.** Make the canvas focusable (`tabindex="0"`),
  draw a focus ring, and bind `ArrowLeft`/`ArrowRight` to ±1, `Home`/`End`
  to min/max, `PageUp`/`PageDown` to ±10. Needed for accessibility.
- **ARIA / a11y.** Add `role="slider"` and live `aria-valuemin`,
  `aria-valuemax`, `aria-valuenow`, `aria-valuetext` (uses label string
  when labels mode is active). Screen-reader announce on change.
- **Fade-color bug.** `_draw` hardcodes one gradient stop as
  `rgba(13,24,38,0)`, so on light backgrounds the edges show a faint dark
  tint regardless of the `fadeColor` option. Derive the transparent stop
  from `fadeColor` instead (parse rgba/hex and force alpha=0).
- **Setter API for runtime options.** Today every option except `value`
  is constructor-time only — the test page works around this by
  destroy+rebuild on every change. Add `setOptions({...})` so colors,
  `visibleRange`, `height`, and `labels` can update without throwing
  away listener state.
- **Web component parity.** `<sliding-ruler>` only forwards 3 of the 7
  color options. Add `major-tick-color`, `mid-tick-color`,
  `minor-tick-color`, `fade-color` to `observedAttributes` and
  `_init()`.
- **Configurable tick intervals.** Major / mid / minor cadences are
  hardcoded to 10 / 5 / 1. Expose as options (e.g. `majorEvery: 10`,
  `midEvery: 5`) so the ruler can show 0.1 / 0.5 / 1.0 marks for
  fine-grained scales, or every-25 for coarse ones.
- **Vertical orientation.** Add an `orientation: 'vertical'` option
  (default `'horizontal'`). Mostly an internal refactor of `_draw` and
  the pointer handlers — swap x/y roles, `_ppu = cssH / visibleRange`,
  indicator becomes a horizontal line at the vertical center, fade
  gradient runs top-to-bottom, pointer handlers read `clientY` for
  drag/tap/velocity. Public API is otherwise unchanged. Worth bundling
  with the fade-color fix above, since both want surgery on `_draw`.
  Open design questions:
  - **Drag direction.** Horizontal mode uses drag-left = value-up;
    vertical equivalent is drag-up = value-up (matches volume-slider
    convention). Worth confirming before coding.
  - **Major-tick label rendering.** Two options: keep labels
    horizontal (legible but requires the ruler to be ≥~30px wide), or
    rotate 90&deg; (works in a narrow strip but harder to read).
    Could be a sub-option (`labelOrientation`).
  - **Web component sizing.** `:host` currently has `width: 100%` and
    no height; vertical mode needs the inverse. Update the component
    CSS conditional on the `orientation` attribute.

## Test page (test.html)

- **Event log panel.** Below the options dump, show a rolling list of
  recent `change` events with their timestamps — useful for verifying
  inertia coast and tap behavior.
- **"Copy options as code" button.** Take the current state and emit
  a ready-to-paste `new SlidingRuler(canvas, {...})` snippet (and an
  equivalent `<sliding-ruler>` tag) into the clipboard.
- **Dark-mode toggle for the page itself.** Right now the page chrome is
  light-only; a toggle would let the dark presets be tested on dark
  chrome without comparing across two tabs.
- **Snap-step option pass-through.** Once the library exposes
  configurable snap (currently always `Math.round` to integer), the test
  page should add a control for it.
- **Shareable URL.** Encode the current state into the hash so a preset
  configuration can be linked.
