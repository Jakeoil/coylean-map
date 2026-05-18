# cube-cuts: anomalies, edge cases, and unresolved questions

Notes captured while iterating on the propagation model in
`meta/4d/cube-cuts.html`. These are the corners where the current
implementation either makes a non-obvious choice or where the
visualization may not match the semantic model.

## Semantic model

### 1. Sub-cell concept is gone

The original 4-cell partition (`1.1.1`, `1.1.2`, `1.2`, `2`) was the
classic recursive corner-bisection: each cut painted its sub-cell
(½, ¼, ⅛, ⅛). The new emitter/wall propagation model does **not**
use sub-cells. Painting is determined by the emitter state and which
previous cuts (whose emitters are paint) act as walls.

With all emitters set to paint (the default), the painted regions
happen to coincide with the original sub-cells, so the visualization
still reads as the recursive bisection. With any emitter set to ghost,
they diverge.

**Consequence:** the cell labels and figures in the "show cells"
sub-panel are still computed from the original geometric bisection
(`x = ½`, `y = ½`, `z = ½` planes) and **do not update** when
emitters are flipped to ghost. They become misleading in non-default
configurations.

### 2. Walls only come from *previous* cuts

A cut's walls are restricted to the surfaces of strictly earlier cuts
in the fixed order (cut 1 → cut 2 → cut 3). So:

- Cut 1 has 0 walls, always.
- Cut 2 has 0 or 1 wall (from cut 1).
- Cut 3 has 0, 1, or 2 walls (from cut 1 and/or cut 2).

This asymmetry is intentional ("you can't be your own wall, and you
can't be a wall for something earlier than you"). It does mean
toggling cut 1's emitter affects how cuts 2 and 3 behave, but toggling
cut 3's emitter never affects anything except cut 3 itself.

### 3. "First-toggle-only" vs. parity counting

When the sweep crosses two walls, two rules are possible:

- **First-toggle-only (current):** once a ray from the emitter has
  crossed *any* wall, its state is flipped, and additional crossings
  don't change it again. So the (u > 1, v > 1) quadrant of cut 3 is
  always in the toggled state.
- **Parity counting (rejected):** every wall crossing toggles, so the
  (u > 1, v > 1) quadrant returns to the original emitter state.

The user explicitly preferred first-toggle-only ("if you're making a
wall, stop when you reach a perpendicular wall; if you're not, start
building"). The two rules give visibly different results in cut 3
when both other emitters are paint:

| rule              | red emitter paint, both walls     | red emitter ghost, both walls       |
|-------------------|-----------------------------------|-------------------------------------|
| first-toggle      | paint only the (u≤1, v≤1) corner  | paint everything *except* the corner |
| parity-counting   | paint the corner *and* the far quadrant | paint the two side quadrants only |

### 4. Receivers' state can disappear

Receivers stay invisible until the sweep reaches them, then latch
into their state. Scrubbing backward unlatches them again (they
return to "no state"). This is a deliberate "no results means no
state" choice, but it does mean the painted surface and the receiver
states are linked to the current scrub position, not just the emitter
configuration.

### 5. The leading edge can be discontinuous in state

With 2 walls active and a non-trivial t, the leading edge has up to 3
segments (ghost / paint / ghost in one phase, then back to single
state). Under the first-toggle-only rule the middle paint segment
shrinks to zero exactly at t = 2, and for the rest of the sweep the
line is one uniformly-ghost segment. This is correct by the rule, but
worth flagging because it differs from earlier prototypes.

## Visualization issues

### 6. Ghost-emitter + 2 walls draws overlapping fills

The painted region for ghost emitter with both walls active is
`(sweep ∩ {u > 1}) ∪ (sweep ∩ {v > 1})`. The current implementation
draws each half-strip as its own translucent polygon, so the
(u > 1, v > 1) corner appears with **double the alpha** (darker
tint). A correct rendering would compute the union polygon explicitly
or use a stencil pass.

### 7. Cell figures don't reflect the propagation result

`show cells` paints either a label sprite or a ⅛-size wireframe at
the centroid of each *original* sub-cell. These are independent of
the propagation model. With non-default emitter states the figures
no longer correspond to the painted regions.

### 8. Walls aren't drawn

A previous cut's surface acts as a wall in the new cut's plane, but
the wall itself isn't rendered. Cut 2 doesn't visually show "this
blue wall is gating my sweep" — only the painted/ghost split of the
sweep hints at it.

### 9. Cube wireframe is always shown (mostly)

The cube wireframe persists through cuts. It only hides when
exploding figures are visible, which is a narrow case. Doesn't match
what the painted regions actually depict in unusual emitter configs.

### 10. No legend update for the new propagation semantics

The footer legend still labels the cut colors by axis but doesn't
indicate the emitter / wall / receiver concepts. New users have to
infer the system from interaction.

## Open questions

- **Wall-line indicators:** would it help to draw a faint line at u=1
  and v=1 in cut 2 and cut 3 planes when the corresponding previous
  emitter is paint, to make the "where the wall lives" idea visible?
- **Should `show cells` be removed or restructured** now that the
  cells don't always match the painting? Could re-purpose it to show
  the *computed* painted regions instead.
- **Two-wall ghost fill blending:** worth fixing the overlap (proper
  union) or accept the double-blend as a visual quirk?
- **Reorder cuts:** the cut order is hard-coded (1 → 2 → 3). Would a
  UI for reordering be valuable, or is the fixed sequence the point?
- **Backward scrubbing:** receivers unlatch when scrubbed past. This
  matches "no results means no state" but might surprise users who
  expect receivers to remember their last value.
