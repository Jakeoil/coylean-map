# Encroachment — Implementation Plan for basic-propagation-prototype

## Overview

Encroachment is an enhancement of the "Minimize" display mode. When a matrix
entry is false, its diamond is white (from minimize). Encroachment fills parts
of that white diamond with the complementary color based on neighboring true
values in the **complementary matrix**.

- False **blue** (right) diamonds may be partially filled **light red**, split by
  a **dark red vertical diagonal** (top-to-bottom vertex).
- False **red** (down) diamonds may be partially filled **light blue**, split by
  a **dark blue horizontal diagonal** (left-to-right vertex).

## Contradiction found

The description says:

> "it cedes the territory to its **northern or southern** red neighbors.
> northern neighbors are the pair nw and ne. They must match."
> Me: You are right. It should say "in cedes the territroy to its **eastern or western** red neighbors. Eastern neighbors are the pair ne and se"

But the filling rule says:

> "If I have **nw & sw** neighbors, fill the **left** side"
> "If I have **ne & se** neighbors, fill the **right** side"

The first groups neighbors north/south (nw+ne vs sw+se), the second groups
them west/east (nw+sw vs ne+se). These are different groupings.

**Resolution**: The west/east grouping matches the geometry. A right (blue)
diamond's red neighbors on the LEFT are `nw` and `sw` (both at column `i-1`),
and on the RIGHT are `ne` and `se` (both at column `i`). A vertical diagonal
splits these left/right halves. The "northern or southern" phrasing in the
first paragraph appears to be a mislabel — the actual rule is cede to
**western** (nw+sw) or **eastern** (ne+se) neighbors.

## Geometry

```
Diamond positions (in cell-unit coordinates):
  Down diamond D[j][i]  → center at (i+0.5, j)      — top edge of cell (i,j)
  Right diamond R[i][j] → center at (i,     j+0.5)   — left edge of cell (i,j)
```

### Neighbors of a false blue (right) diamond R[i][j]

All four neighbors are in the red (down) matrix:

```
          D[j][i-1]     D[j][i]
             nw            ne

                R[i][j]
              (target)

          D[j+1][i-1]   D[j+1][i]
             sw            se
```

- **nw**: `dm[j][i-1]` — valid when `i >= 1`
- **ne**: `dm[j][i]` — valid when `i < nC`
- **sw**: `dm[j+1][i-1]` — valid when `i >= 1` and `j+1 <= nR`
- **se**: `dm[j+1][i]` — valid when `i < nC` and `j+1 <= nR`

Out-of-range → treat as false.

**Fill rule** (vertical split):

- nw AND sw both true → fill left half light red
- ne AND se both true → fill right half light red
- Draw dark red vertical diagonal (top vertex → bottom vertex)

### Neighbors of a false red (down) diamond D[j][i]

All four neighbors are in the blue (right) matrix:

```
                R[i][j-1]    R[i+1][j-1]
                   nw            ne

                     D[j][i]
                    (target)

                R[i][j]      R[i+1][j]
                   sw            se
```

- **nw**: `rm[i][j-1]` — valid when `j >= 1`
- **ne**: `rm[i+1][j-1]` — valid when `j >= 1` and `i+1 <= nC`
- **sw**: `rm[i][j]` — valid when `j < nR`
- **se**: `rm[i+1][j]` — valid when `j < nR` and `i+1 <= nC`

Out-of-range → treat as false.

**Fill rule** (horizontal split):

- nw AND ne both true → fill top half light blue
- sw AND se both true → fill bottom half light blue
- Draw dark blue horizontal diagonal (left vertex → right vertex)

## Drawing the halves

A diamond centered at (cx, cy) has vertices: top (cx, cy-D), right (cx+D, cy),
bottom (cx, cy+D), left (cx-D, cy).

**Left half** (for blue diamonds): polygon `top → center → bottom → left`
= `(cx, cy-D), (cx, cy+D), (cx-D, cy)` (triangle using top, bottom, left vertices)

**Right half**: polygon `top → right → bottom → center`
= `(cx, cy-D), (cx+D, cy), (cx, cy+D)` (triangle using top, right, bottom vertices)

**Top half** (for red diamonds): polygon `top → right → center → left`
= `(cx, cy-D), (cx+D, cy), (cx-D, cy)` (triangle using top, right, left vertices)

**Bottom half**: polygon `left → center → right → bottom`
= `(cx-D, cy), (cx+D, cy), (cx, cy+D)` (triangle using left, right, bottom vertices)

**Vertical diagonal**: line from `(cx, cy-D)` to `(cx, cy+D)`
**Horizontal diagonal**: line from `(cx-D, cy)` to `(cx+D, cy)`

## Changes required

### 1. HTML — Add toggle button

Add `<button id="tog-encroach">Encroach</button>` in the Display toggle row,
next to Minimize.

### 2. JS — State and handler

Add `showEncroach = false` alongside the other display flags.
Wire up the toggle button the same way as the others.

### 3. JS — Render function

After drawing each matrix's diamonds (existing code), add an encroachment
pass for false entries. This should run **after** both matrices are drawn
so all diamonds are in place, and the encroachment overlays render on top.

For each false blue diamond `rm[i][j] === false`:

1. Look up the four red neighbors (bounds-checked)
2. If west pair (nw+sw) both true → draw left-half triangle in light red
3. If east pair (ne+se) both true → draw right-half triangle in light red
4. If either half was drawn → draw dark red vertical diagonal line

For each false red diamond `dm[j][i] === false`:

1. Look up the four blue neighbors (bounds-checked)
2. If north pair (nw+ne) both true → draw top-half triangle in light blue
3. If south pair (sw+se) both true → draw bottom-half triangle in light blue
4. If either half was drawn → draw dark blue horizontal diagonal line

### 4. Interaction with Minimize

Encroachment is only meaningful when Minimize is on (false diamonds are white).
When Minimize is off, false diamonds already have their full color — encroachment
fills would be hidden underneath. Consider: auto-enable Minimize when Encroach is
toggled on, or only apply encroachment rendering when both flags are true.

Me: yes I agree, auto enable it when encroach is on

### 5. Colors

| Element                                 | Color                           |
| --------------------------------------- | ------------------------------- |
| Left/right half fill (red encroaching)  | `#e0a8a8` (existing light red)  |
| Vertical diagonal (red)                 | `#7a2d2d` (existing dark red)   |
| Top/bottom half fill (blue encroaching) | `#bcd8e8` (existing light blue) |
| Horizontal diagonal (blue)              | `#3d6a8a` (existing dark blue)  |
