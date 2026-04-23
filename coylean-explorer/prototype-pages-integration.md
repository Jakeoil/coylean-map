# Prototype pages integration

### Scope

Integrate style of the prototype pages. Here are the files for the pages.

- basic-propagation-prototype.html
- exploration-prototype.html
- universe-quadrants-prototype.html
- universal-propagate-prototype.html
- universe-prototype.html

## Diamonds & toggles: basic-propagation vs. the other four

Comparing the diamond visuals and interaction surface on **basic-propagation**
(the "newer", modular page under `src/app` + `src/display`) against
**exploration**, **universe-quadrants**, **universal-propagate**, and
**universe** (the four older, self-contained prototype pages).

### Diamond rendering

| Aspect | basic-propagation | The other four |
|---|---|---|
| Render path | `src/display/render-propagation.js` (shared module) | Inline `<script type="module">` per page; ~200 LOC duplicated each |
| `diamondPts` / arrow paths | `src/display/svg.js`, `src/display/arrows.js` | Duplicated verbatim in every HTML file |
| Cell spacing `S` | **96 px** (`src/display/diagram-coords.js`) | **32 px** (inline) — 3× smaller |
| Padding `PAD` | 64 | 24 (exploration, quadrants) / 40 (universal-propagate, universe) |
| Diamond stroke | `stroke: "none"` on polygon | Explicit per-kind stroke: `#9a4a4a` (down) / `#5a8aaa` (right), `stroke-width: 1` via CSS |
| False-diamond fill (default) | `#e0a8a8` / `#bcd8e8` — **same as true** (only the arrow distinguishes them) | `#fff` — clearly empty |
| False-diamond fill (alt mode) | `#fff` when `showMinimize` toggled on | — |
| Hover style | `.diamond:hover { filter: brightness(1.4); stroke-width: 2.5 }` (stroke-width has no effect since stroke is "none") | None; relies on tooltip for feedback |
| Double-headed init arrow | On `j === 0` / `i === 0` | Same, but universal-propagate and universe use `j === u.originRow` / `i === u.originCol` (crosshair-relative) |
| Origin crosshair | — | Dashed purple (`#bc8cff`, `stroke-dasharray: 3 3`) on universal-propagate and universe only |

Net effect: basic-propagation's diamonds read as **much larger tiles with no
border and undifferentiated fill** unless a toggle is active. The other four
render as small outlined diamonds where true/false is obvious at a glance.

### Toggle / display controls

**basic-propagation** has a `toggle-row` with five buttons, all affecting
render only (none affect propagation):

| Toggle | Default | Effect |
|---|---|---|
| Labels | ON | Writes `r{j}c{i}` / `c{i}r{j}` coord labels inside every diamond |
| Flow | off | Draws thin grey lines through cell centers connecting down and right diamonds (flow of propagation) |
| Priority | off | At each cell center, shows `pI≥pJ?` and the resolved `↓` / `→` glyph; seniority-aware (`≥` vs `>`) |
| Minimize | off | False diamonds → white, true diamonds lose arrow glyphs (visual "minimalization") |
| Encroach | off | Overlay showing half-fills on false diamonds adjacent to two trues of the other color, and thick incursion edges on true diamonds — auto-enables Minimize |

Wired in `src/app/basic-propagation-prototype-page.js:82-100`.

**The other four pages have no toggles at all.** Their diagrams are a single
fixed visual. Interaction is entirely through:

- **Hover tooltip** — floating `<div id="tooltip">` positioned near the
  cursor, event-delegated on the SVG via `data-source`/`data-i`/`data-j` (and
  `data-quad` for the quadrant pages). basic-propagation instead writes to a
  sidebar `.info-panel` via per-polygon `mouseenter` / `mouseleave` callbacks.
- **Priority mismatch highlighting** (`.t-mismatch`, orange `≠`) — exploration,
  universal-propagate, universe only. Compares `u.colPriority[col]` /
  `u.rowPriority[row]` cached values against a direct `pri(...)` recomputation.
  universe-quadrants omits this.

### Controls sidebar

| Page | Sidebar width | Numeric inputs | Extra controls |
|---|---|---|---|
| basic-propagation | 300 px (shared `prototype.css`) | numRows, numCols, hInitCol, vInitRow | Seniority button (Vertical / Horizontal), 5 toggles, legend |
| exploration | 320 px (inline) | numRows, numCols, hInitCol, vInitRow | — |
| universe-quadrants | 320 px | minRow, maxRow, minCol, maxCol, hInitCol, vInitRow | — |
| universal-propagate | 320 px | numRows, numCols, hInitCol, vInitRow | — |
| universe | 320 px | northExtent, southExtent, westExtent, eastExtent, hInitCol, vInitRow (in a compass "extent-cross" grid with an origin dot) | — |

### Styling/architecture

- **basic-propagation** pulls shared structural styles from
  `prototype.css` (breadcrumb, sidebar, buttons, controls, legend, info-panel,
  call-sig) and only keeps page-specific SVG styles inline.
- **The other four** inline every style rule in a `<style>` block — sidebar
  layout, breadcrumb, tooltip, quadrant labels, etc. — with significant
  copy-paste across the four files. They do not link `prototype.css`.
- **Pan/zoom**: all five pages use `src/display/svg-pan-zoom.js` via
  `attachSvgPanZoom(svg, viewportGroup)`, so they share grab-cursor /
  drag-to-pan / wheel-zoom behavior. This is the only piece of shared display
  code the older four currently use.

### Integration implications

Bringing the older four in line with basic-propagation means:

1. **Extract shared rendering.** The duplicated `svgEl`, `diamondPts`,
   `downArrowPath`, `rightArrowPath`, and quadrant-drawing code in
   exploration / universe-quadrants / universal-propagate / universe belongs
   in `src/display/`. Most of it already exists there
   (`svg.js`, `arrows.js`) — the four pages just don't use it.
2. **Decide on diamond defaults.** Pick one convention: stroke-less
   large tiles (basic-propagation) or outlined small diamonds with
   immediately-visible false state (the others). These look like different
   diagrams today. The "outlined, false=white" style communicates matrix
   truthiness without a legend, while the basic-propagation style communicates
   it only via arrow presence — worth a conscious choice.
3. **Unify hover.** Two patterns coexist: sidebar info-panel (basic-propagation)
   vs. floating tooltip (the others). The tooltip is richer (shows
   cached-vs-direct priority mismatch), the sidebar panel is steadier. A
   shared `hover-inspector.js` could support both.
4. **Add toggles where useful.** Labels, Priority, Flow, Minimize, and
   Encroach are all applicable to the universe-variant pages too — they're
   about interpretation of the same underlying matrices. Encroach in
   particular would clarify the quadrant-stitching pages.
5. **Share `prototype.css`.** The four inline-styled pages can drop their
   `<style>` blocks (breadcrumb, sidebar, controls, call-sig) in favor of the
   shared stylesheet, keeping only page-specific SVG and tooltip rules.
6. **Reconcile `S`/`PAD`.** 96 px diamonds vs. 32 px diamonds is a big jump.
   If the pan/zoom helper is fit-to-viewport, the difference mostly disappears
   at initial zoom — but the number of visible diamonds at wheel-zoom=1 is
   very different. Consider parameterizing `S` per page rather than hard-coding
   in `diagram-coords.js`.
