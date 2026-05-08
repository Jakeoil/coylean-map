# Encroachment as a line-polygon — geometric plan

## Reframing

The current implementation fills "halves" of a false diamond with the
complementary colour and adds a bisecting diagonal. That works as a static
overlay, but it doesn't match the geometric model we actually want. The new
model is:

> An encroachment is a **polygon that represents a line**, with a
> **thickness parameter** that ranges 0 % → 100 % of the diamond's diagonal
> length. The 100 % case is the real implementation; the smaller percentages
> are visualisation aids that let us see how the line shape is built up
> (and they are what the toggle cycles through).

So encroachment is no longer "fill half of this diamond". It's "draw the
junior line as a strip of thickness *T*, and where it crosses a senior
line, give it a pointed notch that ends at the intersection".

### Where the junior actually stops

This is the key invariant, straight from the Coylean priority rule:

> A junior line that hits a senior **stops halfway through the diamond**,
> at the intersection point. It does not continue past the senior. What
> appears on the *other* side of the senior is **the next line segment**,
> drawn by whatever rule applies to that adjacent cell — it is a separate
> polygon, not a continuation of the same junior line.

So in the picture above, the chevron on each side of the senior belongs
to a *different* junior segment. Two junior segments meet the senior
from opposite sides, each ending in its own pointed notch at the
intersection. They are not one polygon with a hole; they are two
polygons that happen to share a tip.

This matters for implementation: we don't build a single junior polygon
that "wraps around" the senior with a bow-tie cut-out. We iterate over
junior segments — each one is a polygon that runs from where it starts
to where it stops (its first senior crossing, halfway into the diamond)
— and emit one polygon per segment.

## Geometric definition
2
Let the cell side = 1 unit, so the diamond's full diagonal length is also
1 unit. Define `T ∈ [0, 1]` as the thickness of the line polygon (in
diagonal-length units).

At every junior-vs-senior crossing (a cell vertex `(i, j)`):

- Approaching the crossing along the **junior's centreline**, the polygon
  is `T` units wide.
- At distance `T/2` perpendicular from the centreline (i.e. at the
  polygon's edge), the edge **turns 45°** toward the intersection.
- The two turning edges converge to a **pointed notch** whose tip is at
  the intersection point `(i, j)`.
- After the notch, the polygon resumes on the other side of the senior
  with the same `T` thickness.

Said another way: the junior line's polygon at a crossing has a
**chevron** carved into each side of the senior — the chevron's base is
`T` units wide on the junior's edge and its apex sits exactly on the
intersection.

### 100 % case (T = 1, the real implementation)

```
         ┊  bend points are at the diamond's outer border:
         ┊  perpendicular distance ½ from junior centreline,
         ┊  parallel distance ½ from intersection.
         │
   ──────╲           ╱──────         segment A (top junior)
          ╲         ╱                ends at the intersection.
           ╲       ╱
            ╲     ╱
             ╲   ╱
              ╲ ╱
               *      ← intersection (cell vertex)
              ╱ ╲
             ╱   ╲                   segment B (bottom junior),
            ╱     ╲                  a separate polygon, also
           ╱       ╲                 ending at the intersection.
          ╱         ╲
   ──────╱           ╲──────
```

Each notch tip sits on the intersection. Each bend pair sits on the
diamond border on either side of the intersection. Each notch occupies
half of the corresponding junior diamond — and the two halves shown
above belong to **two separate junior polygons**, drawn by the rules
of two adjacent cells. They share only a single point.

### 50 % case (T = 0.5)

Half thickness. Bend points are **¼ unit** to either side of the
junior's centreline, and the notch still ends at a point — the user's
phrase "pointed notch at the end" — at the intersection (or, equivalently,
at the senior's half-thickness boundary `¼` unit away). The notch
geometry scales uniformly with `T`.

### General `T`

- Junior polygon is `T` units wide on its straight runs.
- At each senior crossing, edges bend 45° at perpendicular distance
  `T/2` from the centreline.
- Notch tip at the intersection, parallel distance `T/2` from the
  bend points.

## Mapping to the existing toggle

The `Encroach` button already cycles `off → full → half`. Under the new
model:

| Mode   | Meaning                                       |
| ------ | --------------------------------------------- |
| `off`  | Don't draw line polygons.                     |
| `full` | `T = 1`. The actual implementation.           |
| `half` | `T = 0.5`. Diagnostic view of the same shape. |

(Future: a continuous slider could drive `T` directly, but the current
two-step cycle is enough.)

## Independence from the Fill toggle

Encroachment polygons are **always filled**, regardless of the Display
panel's `Fill` setting. The current code gates encroachment fills on
`showFill`; that gating goes away under the new model. Encroachment
will get its own dedicated control in a later pass — but for now
treat encroachment fill as unconditional.

## What changes vs. the current code

Today, in `src/display/render-mosaic.js` (and the same block in
`render-propagation.js`), encroachment is drawn as:

1. A triangle filling **half** of each false diamond, in the senior's
   colour, when both senior neighbours on that side are true.
2. A bisecting diagonal across the false diamond.
3. Thicker edges on **true** diamonds toward true neighbours.

Under the new model, the rendering changes to:

1. For each junior line that loses at one or more crossings, build a
   **line polygon** of thickness `T` along the junior's centreline.
2. At each lost crossing, carve the polygon with a chevron whose tip is
   the intersection point.
3. The senior line polygon (also of thickness `T`, drawn in the senior's
   colour) passes through unbroken — its edges define the diamond border
   that the junior bends against in the 100 % case.

Concretely, the per-diamond half-triangle is *replaced* by a per-line
polygon; the bisecting diagonal goes away (it's implicit in the
chevron geometry); the "thick edges on true diamonds" decoration also
goes away (it's just the senior polygon's edge).

## Open questions for confirmation

Before implementing, I want to nail down a few things I'm less sure of:

1. **Colour ownership.** Today the encroachment fill is in the *senior's*
   colour painted onto the junior's white diamond. Under the
   line-polygon model, both lines are polygons — junior in junior's
   colour, senior in senior's colour. Confirm: each line is drawn in
   its own colour, and the visual effect of "senior wins" comes from
   the chevron carved into the junior, not from painting senior colour
   into junior territory.

2. **Direction of the notch.** "Junior lines encroach on senior lines"
   reads as if the *junior* is the one whose tip pokes toward the
   intersection (i.e. the chevron belongs to the junior polygon). I've
   modelled it that way above. Confirm that's the intent — it inverts
   the colour story from today's overlay.

3. **"Pointed notch at the end" (50 %).** I read "end" as "tip of the
   chevron", which sits at the intersection regardless of `T`. The
   chevron just gets shorter and narrower with smaller `T`. Confirm
   that the tip stays at the intersection, vs. retracting to the
   senior's half-thickness border `T/2` from the intersection.

4. **Senior thickness.** Is the senior also drawn at thickness `T`
   (so at `T = 0.5` both lines are half-thick), or is the senior
   always at full thickness with only the junior shrinking? My current
   plan assumes both share the same `T`, which gives a clean self-
   similar picture as `T` varies.

5. **Polygon scope.** A junior line passes through many diamonds, but
   each segment ends at its first senior crossing — so "one polygon
   per junior segment" is the natural unit, not "one polygon per whole
   row/column". Confirm we iterate segments (start → first crossing),
   emit one polygon each, and let the next segment pick up on the far
   side as its own polygon.

Once these are settled I can rewrite the encroachment block in
`render-mosaic.js` and `render-propagation.js` to draw line polygons
directly, and the `full` / `half` modes will both fall out of the same
code path with `T = 1` vs. `T = 0.5`.
