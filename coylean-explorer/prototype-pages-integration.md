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

| Aspect                        | basic-propagation                                                                                                   | The other four                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Render path                   | `src/display/render-propagation.js` (shared module)                                                                 | Inline `<script type="module">` per page; ~200 LOC duplicated each                                            |
| `diamondPts` / arrow paths    | `src/display/svg.js`, `src/display/arrows.js`                                                                       | Duplicated verbatim in every HTML file                                                                        |
| Cell spacing `S`              | **96 px** (`src/display/diagram-coords.js`)                                                                         | **32 px** (inline) — 3× smaller                                                                               |
| Padding `PAD`                 | 64                                                                                                                  | 24 (exploration, quadrants) / 40 (universal-propagate, universe)                                              |
| Diamond stroke                | `stroke: "none"` on polygon                                                                                         | Explicit per-kind stroke: `#9a4a4a` (down) / `#5a8aaa` (right), `stroke-width: 1` via CSS                     |
| False-diamond fill (default)  | `#e0a8a8` / `#bcd8e8` — **same as true** (only the arrow distinguishes them)                                        | `#fff` — clearly empty                                                                                        |
| False-diamond fill (alt mode) | `#fff` when `showMinimize` toggled on                                                                               | —                                                                                                             |
| Hover style                   | `.diamond:hover { filter: brightness(1.4); stroke-width: 2.5 }` (stroke-width has no effect since stroke is "none") | None; relies on tooltip for feedback                                                                          |
| Double-headed init arrow      | On `j === 0` / `i === 0`                                                                                            | Same, but universal-propagate and universe use `j === u.originRow` / `i === u.originCol` (crosshair-relative) |
| Origin crosshair              | —                                                                                                                   | Dashed purple (`#bc8cff`, `stroke-dasharray: 3 3`) on universal-propagate and universe only                   |

Net effect: basic-propagation's diamonds read as **much larger tiles with no
border and undifferentiated fill** unless a toggle is active. The other four
render as small outlined diamonds where true/false is obvious at a glance.

### Toggle / display controls

**basic-propagation** has a `toggle-row` with five buttons, all affecting
render only (none affect propagation):

| Toggle   | Default | Effect                                                                                                                                                    |
| -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Labels   | ON      | Writes `r{j}c{i}` / `c{i}r{j}` coord labels inside every diamond                                                                                          |
| Flow     | off     | Draws thin grey lines through cell centers connecting down and right diamonds (flow of propagation)                                                       |
| Priority | off     | At each cell center, shows `pI≥pJ?` and the resolved `↓` / `→` glyph; seniority-aware (`≥` vs `>`)                                                        |
| Minimize | off     | False diamonds → white, true diamonds lose arrow glyphs (visual "minimalization")                                                                         |
| Encroach | off     | Overlay showing half-fills on false diamonds adjacent to two trues of the other color, and thick incursion edges on true diamonds — auto-enables Minimize |

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

| Page                | Sidebar width                   | Numeric inputs                                                                                                             | Extra controls                                              |
| ------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| basic-propagation   | 300 px (shared `prototype.css`) | numRows, numCols, hInitCol, vInitRow                                                                                       | Seniority button (Vertical / Horizontal), 5 toggles, legend |
| exploration         | 320 px (inline)                 | numRows, numCols, hInitCol, vInitRow                                                                                       | —                                                           |
| universe-quadrants  | 320 px                          | minRow, maxRow, minCol, maxCol, hInitCol, vInitRow                                                                         | —                                                           |
| universal-propagate | 320 px                          | numRows, numCols, hInitCol, vInitRow                                                                                       | —                                                           |
| universe            | 320 px                          | northExtent, southExtent, westExtent, eastExtent, hInitCol, vInitRow (in a compass "extent-cross" grid with an origin dot) | —                                                           |

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
   Me: Correct
2. **Decide on diamond defaults.** Pick one convention: stroke-less
   large tiles (basic-propagation) or outlined small diamonds with
   immediately-visible false state (the others). These look like different
   diagrams today. The "outlined, false=white" style communicates matrix
   truthiness without a legend, while the basic-propagation style communicates
   it only via arrow presence — worth a conscious choice.
   Me: Basic-propagation is the preferred model.
3. **Unify hover.** Two patterns coexist: sidebar info-panel (basic-propagation)
   vs. floating tooltip (the others). The tooltip is richer (shows
   cached-vs-direct priority mismatch), the sidebar panel is steadier. A
   shared `hover-inspector.js` could support both.
   Me: Use the basic-propagation method for hover.
4. **Add toggles where useful.** Labels, Priority, Flow, Minimize, and
   Encroach are all applicable to the universe-variant pages too — they're
   about interpretation of the same underlying matrices. Encroach in
   particular would clarify the quadrant-stitching pages.
   Me: Add toggles to the four pages.
5. **Share `prototype.css`.** The four inline-styled pages can drop their
   `<style>` blocks (breadcrumb, sidebar, controls, call-sig) in favor of the
   shared stylesheet, keeping only page-specific SVG and tooltip rules.
   Me: Favor shared stylesheet.
6. **Reconcile `S`/`PAD`.** 96 px diamonds vs. 32 px diamonds is a big jump.
   If the pan/zoom helper is fit-to-viewport, the difference mostly disappears
   at initial zoom — but the number of visible diamonds at wheel-zoom=1 is
   very different. Consider parameterizing `S` per page rather than hard-coding
   in `diagram-coords.js`.
   Me: Favor basic-propagation.

⏺ I now have full context — I've read the integration doc with your assessment, the shared display modules, the basic-propagation page (HTML + JS + info module +  
 render-propagation), and all four older pages. Here's the plan.

Goal

Bring the four older pages in line with basic-propagation across all six dimensions you confirmed: shared rendering, basic-propagation diamond style (no stroke,  
 undifferentiated fill), sidebar info-panel hover, toggles, shared prototype.css, and S=96/PAD=64.

The structural wrinkle

The four pages don't all share the same geometry, so a single shared renderer won't fit:

- universal-propagate & universe render one assembled global raster with an origin somewhere inside it (not at j=0,i=0).
- exploration & universe-quadrants render four separate quadrant panels with flipJ/flipI orientation flags so each panel's origin corner faces the mosaic centre.
- basic-propagation renders one local propagation whose origin is j=0,i=0.

So I'll extend the display layer with two new render functions, both reusing the existing svg.js / arrows.js / diagram-coords.js primitives:

1. src/display/render-universe.js — for assembled-raster pages. Takes the universe + flags + hooks; supports an arbitrary origin (parameterizes the  
   double-headed-init-arrow check on j === originRow / i === originCol); draws the dashed-purple origin crosshair; supports all five toggles.
2. src/display/render-mosaic.js — for 4-panel mosaic pages. Takes 4 quadrants + flip flags + flags + hooks; renders each panel as its own local matrix with  
   quadrant background + label. Toggles act per-panel.

renderPropagation for basic-propagation stays as-is (it's a special case: single quadrant, origin at 0,0).

File-by-file changes

New files

- src/display/render-universe.js — render function for universal-propagate + universe.
- src/display/render-mosaic.js — render function for exploration + universe-quadrants.
- src/app/universal-propagate-prototype-page.js — page wiring (inputs, toggles, renderUniverse, sidebar info hooks).
- src/app/universe-prototype-page.js — same shape, plus the compass extent-cross input layout in HTML.
- src/app/exploration-prototype-page.js — page wiring with renderMosaic.
- src/app/universe-quadrants-prototype-page.js — same shape with row/col-range inputs.
- src/app/universe-info.js — sidebar info hooks for the assembled-raster pages (down/right cells with origin-relative priority lines, plus optional  
  cached-vs-direct mismatch indicator preserved from the old tooltips).
- src/app/mosaic-info.js — sidebar info hooks for the 4-panel mosaic pages (per-quadrant, with quadrant name, local indices, and the cached-vs-direct mismatch row
  from exploration-prototype.html).

Modified files

- All four old .html files: drop inline <style> blocks (keep only page-specific SVG: .origin-line, .quadrant-bg, .quadrant-label, .extent-cross), link  
  prototype.css, switch breadcrumb/sidebar/controls markup to the shared classes, add the toggle-row + legend block, replace inline <script> with import { init }  
  from "./src/app/<page>-page.js".

A few decisions to confirm before I start

1. Toggles on mosaic pages: Labels / Flow / Priority / Minimize work per-panel. Encroach technically applies only inside a single quadrant (it's about adjacent  
   diamonds within a propagation). I'd make it operate per-panel — confirm that's right, or omit Encroach from mosaic pages.
2. Cached-vs-direct priority mismatch: today this lives in the floating tooltip on three of the four old pages. I'd surface it as a row in the sidebar info-panel  
   (orange ≠ next to the mismatched line). OK?
3. S=96 universally: at default zoom the mosaic pages will be ~3× larger than today, so fewer diamonds visible without zooming out. Pan/zoom still fits-to-viewport
   at first paint. Confirm you want this — alternative is to leave the mosaic/universe pages at a smaller S and only standardize stroke/fill/hover.
4. Seniority button on the four older pages? basic-propagation has it; the older pages all use Universe.createSymmetric / Universe.create which (from a quick
   glance) bake in vertical seniority. Out of scope, or add as a parameter to those Universe factories too?

Ready to implement once you confirm — particularly on Q3 (S=96 across mosaic pages) and Q4 (seniority button scope).

1. Toggles on mosaic pages should work on all four mosaic pages equally. arrows on lines should indicate direction of propagation. The four pages are distict propagations and renderings.
2. Focus only on diamonds and toggles. Ignore the unfinished debug stuff for now. Note that basic, exlorer(mosaic), and universe-quadrants are solid. The other two are defective and possibly dead.
3. Use two scales, 96 and 32. but use one or the other based on what is plugged into equation. Large propagations will use the smaller scale.
4. The seniority button should be moved below the initCols. It belongs with the signature parameters.

Please implement in steps. Ask if unclear. Let me check changes to 'exploration' for each step before proceding.

⏺ Universe factories do accept seniority, so a seniority button works on all four older pages.

Questions before Step 1:

1. Flow toggle arrows — currently Flow draws thin grey lines through cell centers (no arrowhead). You said "arrows on lines should indicate direction of  
   propagation". Confirm: each flow line should now have a small arrowhead at the outgoing end (down-arrow on the vertical exit line, right-arrow on the horizontal
   exit line), so each cell visibly shows propagation flowing in from N/W and out to S/E?
2. Scale heuristic — how should the page choose 96 vs 32? Two options:
    - (a) Per-page constant (basic-propagation = 96, exploration/quadrants = 32, hardcoded).
    - (b) Auto: compute from current dimensions at render time (e.g. S = max(numRows, numCols) >= 12 ? 32 : 96).

You said "based on what is plugged into equation" which sounds like (b). What threshold? Or do you want a third button-toggle ("zoom out")?  
 3. Scope — you said universal-propagate and universe are "defective and possibly dead". Skip them entirely for now (leave the files untouched), or convert them  
 along with the others?  
 4. Implementation order — I'd propose:

- Step 1: Add a shared per-quadrant matrix renderer in src/display/ (extracted from render-propagation.js, parameterized to take a parent group + offset +  
  flipJ/flipI). Refactor basic-propagation to use it (no visible change).
- Step 2: Convert exploration to use the shared renderer + sidebar info-panel + 5 toggles + shared prototype.css + seniority button.
- Step 3: After your review of exploration, repeat for universe-quadrants.
- Step 4: (Maybe) repeat for universal-propagate / universe based on Q3.

OK with this order?

1. Flow feature should be deprecated, it is no longer relevant. When I say arrows, I am talking about the arrows with arrowheads. In the mosaic 'mirror images' the arrows will be pointing the opposite way
2. (b) Auto Compute at render time. Will fine-tune later. Your suggestion is good enough
3. Convert them along with the others.
   4.1 Step 1: I'd like to keep basic-propagation untouched for now. But of course, the quadrants and explorer can share one.
   4.2 Step 2: Yes. Except seniority button belongs above with signature dimensions: numRow,cols, initRows,cols.
   4.3 Step 3: yes.
   4.4 Step 4: Stop here

⏺ Step 1 is in place. Summary of what changed:

- src/display/svg.js — diamondPts now takes optional d (defaults to D=48); svgEl skips null/undefined attrs (so transform: null doesn't render as the string
  "null"). Basic-propagation behavior unchanged.
- src/display/arrows.js — downArrowPath / rightArrowPath take optional d; arrow-size constants now scale linearly from the d=48 baseline. Defaults preserve
  basic-propagation arrows exactly.
- src/display/render-mosaic.js (new) — renderMosaic(svg, quads) lays out a 2×2 panel grid; auto-picks S=96 if max(numRows,numCols) < 12, else S=32; renders
  diamonds in basic-propagation style (no stroke, colored fill, arrows distinguish); reverses arrow direction (180° rotation) on flipped axes so NW/NE/SW arrows
  point in the actual propagation direction; sets the same data-quad/data-source/data-i/data-j attrs the existing tooltip relies on.
- exploration-prototype.html — dropped the inline S/D/PAD/GAP/LABEL_H constants, svgEl, diamondPts, arrow path helpers, and the entire drawQuadrant function plus
  the per-render layout/positioning loop. render() now ends in renderMosaic(svg, quads). Tooltip + inline CSS untouched.

What you should see in exploration:

- 8×8 default looks compact (S=32 since 8 < 12 — wait that would be S=96; only ≥12 triggers the small scale). At 8×8 you'll get the chunky S=96 view. Bump
  numRows/numCols to ≥12 to see the small scale kick in.
- Diamonds are now solid colored tiles with no border — you tell true vs false purely by the arrow.
- In NW the down-arrows point ↑ and right-arrows point ←. NE: down ↑, right →. SW: down ↓, right ←. SE unchanged (↓ and →).
- Tooltip on hover still works as before.

Ready for your review. Tell me if the auto-scale threshold (≥12 for S=32) feels right at this stage, or if it should kick in sooner — and I'll move on to Step 2.

⏺ Step 2 is in place. Summary of what changed:

- src/display/render-mosaic.js — renderMosaic(svg, quads, flags, hooks) now supports the four toggles. Encroach half-fills, incursion edges, and the Priority  
  resolved-arrow glyph all flip with flipJ/flipI so they stay visually-correct in mirror panels (e.g. NW shows ↑/←). Mouse listeners are wired per-diamond when hooks
  are provided.
- src/app/mosaic-info.js (new) — makeMosaicInfo(info, getCtx) populates the sidebar .info-panel on hover, falls back to a per-quadrant summary on leave. Same  
  content shape as basic-propagation (title + rows + dim).
- src/app/exploration-prototype-page.js (new) — page wiring: inputs, render() loop, seniority button (toggles vertical/horizontal and re-runs
  Universe.createSymmetric), four toggle buttons (Labels, Priority, Minimize, Encroach with auto-enable-Minimize), info hooks. Pattern follows  
  basic-propagation-prototype-page.js.
- exploration-prototype.html — dropped the inline <style> block (kept only page-specific SVG: .diamond:hover brightness, .quadrant-bg/-label, .coord-label,  
  #diagram cursor, info-panel content classes). Linked prototype.css. Sidebar markup now matches basic-propagation: controls (numRows/numCols, hInitCol/vInitRow,  
  Seniority), Display toggle-row, Legend, Details info-panel. Script imports init from the new page module.

What you should see in exploration:

- Sidebar layout matches basic-propagation: shared breadcrumb, signature controls (with seniority button at bottom of signature block), 4 toggle buttons, legend
  swatches, Details panel.
- Hovering any diamond writes its details into the Details panel; moving off restores the per-quadrant summary.
- Toggles work per-panel: Labels writes r{j}c{i} / c{i}r{j} in each diamond; Priority writes pI≥pJ? and a direction glyph (flips to ↑/← in mirrored panels);  
  Minimize turns false diamonds white and removes arrows from trues; Encroach auto-enables Minimize and overlays half-fills/incursion edges (also flip-aware, so an  
  "encroachment from logical-NW" shows visually-NE in the NW panel).
- Seniority button toggles Vertical/Horizontal and re-runs Universe.createSymmetric with that argument; the call-sig at top updates accordingly.

Ready for your review. Let me know how exploration looks and I'll move to Step 3 (apply to universe-quadrants).

Here is my input.
Don't use small scale (exploration style?). There are too many problems with labels, priority etc.
Basic style just needs some fixes. Rendering should be confined to the quad boundaries like in exploration style.
Arrows should be the thicker arrows formerly used in exploration style (and currenly in quadrants)
Arrow and arrowhead weights will be tweakable in the future.

Add to this plan:
For priority, make a set of arrows with 3 different thicknesses. Priority 0 and 1 thinnest. priority 2 to < Max thicker. Priority Max thickest. Dark red and

⏺ The instruction ends mid-sentence ("Dark red and"). Before I start, let me look at what "thicker arrows" and "quad boundaries" refer to so I can ask good
clarifying questions.

Read 2 files, listed 1 directory (ctrl+o to expand)

⏺ Let me look at the other pages to understand the "thicker arrows" reference and the current state.

Searched for 1 pattern, listed 1 directory (ctrl+o to expand)

⏺ I read the instructions at the end of the file (lines 273-280). The last line is cut off mid-sentence ("Dark red and"). Here is what I understand, plus clarifying
questions before I start.

What I understand

1. Drop auto-scale — always use S=96 in render-mosaic.js; remove the pickScale / LARGE_DIM logic. (The small-scale mode caused label/priority readability  
   problems.)
2. Confine rendering to quad boundaries — current PAD=24 with D=48 means diamonds overflow the quadrant rect at top/left/right/bottom. Fix by bumping PAD to ≥ D  
   (probably PAD=64 to match basic-propagation).
3. Thicker arrows — replace the current thin-arrow baselines in src/display/arrows.js with the heavier values used inline by universe-quadrants-prototype.html (and
   formerly by exploration-prototype.html):
    - At D=16: HL=6, HW=3, ND=2 (proportions HL/D=0.375, HW/D=0.188, ND/D=0.125)
    - Scaled to the D=48 baseline in arrows.js: BASE_HL≈18, BASE_HW≈9, BASE_ND≈6 (currently 8 / 3.5 / 2.5)

4. Priority arrows at 3 thicknesses (new feature):
    - Priority 0 and 1 → thinnest
    - Priority 2 to < MAX → thicker
    - Priority MAX → thickest

Questions before I start

Q1. The sentence trails off at "Dark red and". What's the full color spec? My guess: "Dark red and dark blue" (i.e. keep the current down/right arrow colors  
 #7a2d2d / #3d6a8a, just vary thickness by priority) — but it could also be "three shades of red and three shades of blue" where thickness and color both change
with priority tier. Which?

Me: Your first guess is correct. Do nothing new.

Q2. For a given arrow, which priority determines its tier?

- (a) pI = pri(i + hInitCol) for down arrows; pJ = pri(j + vInitRow) for right arrows (the propagation's own axis priority)
- (b) max(pI, pJ) at that cell
- (c) something else  
  Me: (a) the computed priority of its cell

Q3. "Priority MAX" — do you mean the single highest priority value that appears in the visible data (scan max), or a fixed global (e.g. log₂ of dim)?
Me: Currently 100, basically infinity. It's a unique line

Q4. Does this apply to basic-propagation too, or only the mosaic pages (exploration, universe-quadrants)? You said to leave basic-propagation untouched in step 1,
but the arrow-thickening change touches arrows.js which basic-propagation shares.
Me: Leave it untouched with this exception. The thicker are much nicer than the original

Q5. Scope confirmation: apply 1–3 immediately to render-mosaic.js + arrows.js, then do priority-thickness after your answers — OK, or wait on all of it?  
Me: Just do 1,2 and 3 immediately.

Make a new toggle: arrow, placed after label. Default to true.
Change minimize toggle behavior. It will not affect the arrows.
Make sure encroach turns on minimize and turns off arrows.
In the heading field of the mozaic in explorer. It should show the quad name and dimension the same size as quadrants.

For diamond labels, draw a semi-opaque rectangular background behind the label text.

Requirements:

- The label background should be drawn before the text.
- It can be a simple rectangle, not rounded.
- The background color should match the diamond's family (rights true/downs true/false):
    - light red → semi-opaque light red
    - light blue → semi-opaque light blue
    - white cell → semi-opaque white
- Use enough opacity that black text is readable over arrows/errors.
- Keep the rectangle only slightly larger than the text.
- Use ctx.measureText() to size the rectangle.
- Then draw the black label text centered over it.

Do not change the diamond colors or arrow rendering.
Only improve label readability.
Update the canvas label drawing code so each label is rendered like this:

Outline

1. Set the font.
2. Measure the text using ctx.measureText(label).
3. Compute a small padded rectangle centered at the label position.
4. Fill that rectangle with a semi-opaque background color that matches the cell color.
5. Draw the label text in black on top.

Use a helper like:

drawLabelWithBackground(ctx, label, x, y, backgroundColor)

The rectangle can be square-cornered. No rounded corners needed.

Example colors (only examples!):

- light red label background: rgba(r, g, b, 0.85)
- blue label background: rgba(r, g, b, 0.85)
- white label background: rgba(255, 255, 255, 0.85)

Keep the implementation simple.
