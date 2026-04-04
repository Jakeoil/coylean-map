# Discovery - Curve Intersection Explorer

An interactive canvas for drawing curves, detecting their crossings, and filling bounded regions like a map. The purpose is to construct Coylean maps by hand, observing how the stop/continue rule at crossings produces the characteristic fractal subdivision.

## Controls

### Drawing

- **Left-click and drag** to draw a freehand curve. Release to finish the stroke.
- Crossings with existing curves are detected in real time as you draw.
- **Endpoint snapping**: when a stroke starts or ends within 15px of an existing crossing or stroke start point, it snaps to that point. This includes snapping back to the stroke's own start to close a loop.

### Alternating mode

Toggle with the **Alternating** button or **right-click** on the canvas.

In alternating mode the mouse cursor moves freely without drawing. A small hollow circle follows the cursor to indicate the skip state. When the cursor crosses an existing line, drawing begins automatically and the circle disappears. When it crosses another line, drawing stops and the skip indicator returns. This continues until alternating mode is toggled off.

This is how a Coylean map is built: horizontal and vertical lines follow a stop/continue rule at perpendicular crossings. Drawing alternately between crossings produces the fragmented line segments that, at successive scales, form the self-similar fractal.

### Navigation

- **Scroll wheel** to zoom in/out (zooms toward the cursor)
- **Middle-click drag** or **Ctrl+left-click drag** to pan
- **Clear** resets everything including the view

### Hovering

Move the cursor over drawn elements to inspect them. Priority order:

1. **Vertex** (crossing point) -- shows ID, position, and crossing angle. Marked with a red dot and crossing lines.
2. **Edge** (arc between crossings) -- shows the dart pair, origin/destination nodes, and the faces on each side. Highlighted in gold.
3. **Region** (bounded area) -- shows region ID, area, edge count, and adjacent regions. Highlighted with increased opacity.

The sidebar lists all crossings and regions. Entries highlight in sync with canvas hover.

## How it works

### Curve sampling and intersection

Mouse input is collected via `getCoalescedEvents()` for high-density sampling. The raw points are interpolated with **Catmull-Rom splines** and subdivided into micro-segments (~2.5px each). Every new segment is tested against all existing segments for intersection using parametric line-line intersection.

Self-intersections skip adjacent segments (within 8 sequential indices) to avoid false positives near the drawing point.

### Planar subdivision (DCEL)

When crossings exist, the curves partition the plane into vertices, edges, and faces -- a **planar subdivision**. This is maintained as a **Doubly Connected Edge List (DCEL)**, also known as a half-edge data structure:

- Each edge between two nodes is represented by a pair of **half-edges** (darts), one in each direction.
- Each dart stores: origin node, twin dart, next dart in the face cycle, the incident face, and the geometric points of the arc.
- At each node, outgoing darts are sorted by angle (decreasing, for screen coordinates where Y points down). The linking rule `twin(e_i).next = e_{(i+1) mod k}` connects the face cycles.
- **Faces** are traced by following `next` pointers until returning to the start.

This is the combinatorial map (D, R, L) from the theory: `twin` is the involution L, and the face permutation is R composed with L (stored directly as `next`).

### Euler's formula

For a connected planar graph:

    V - E + F = 2

where V = vertices (crossings + endpoints), E = edges (arcs), F = faces (regions + the outer face). Every crossing of two transverse curves is a 4-valent vertex.

### Region coloring

The outer face (largest absolute area) is identified as the background ocean. Remaining faces are colored using:

1. **2-coloring attempt** (BFS bipartite check) -- always works when every vertex has even degree (all proper crossings are 4-valent).
2. **Greedy fallback** -- if dangling endpoints create odd-degree vertices, a greedy algorithm assigns colors avoiding adjacent conflicts.

Adjacent regions (sharing an edge, not just a vertex) always get different colors. The palette uses land tones on an ocean-blue background, like a map.

### View transform

All drawing and hit-testing operates in **world coordinates**. The canvas applies an affine transform `(scale, 0, 0, scale, offsetX, offsetY)` at render time. Screen coordinates are converted to world coordinates on input. Line widths, marker sizes, and hover radii are divided by the scale factor so they appear constant on screen regardless of zoom level.

## Connection to Coylean maps

A Coylean map is produced by subdividing a square with vertical and horizontal lines where each line stops or continues at perpendicular crossings according to a deterministic rule. The resulting pattern contains similar copies of previous iterations -- a fractal generated by a substitution system on the combinatorial map.

In this tool, alternating mode replicates that construction: the cursor traces a path, and lines are drawn only between crossings. The DCEL captures the full topological structure -- the same structure that, when the substitution rule is applied recursively, produces the Coylean fractal at arbitrary depth.

See [analyze.md](analyze.md) for the full mathematical treatment: CW complexes, combinatorial maps, knot diagrams, and the Four Color Theorem as it applies to 4-valent planar graphs.
