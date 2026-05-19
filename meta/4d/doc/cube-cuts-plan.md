# Recursive corner-bisection of cubes and tesseracts

Plan for an animated simulation of a recursive binary subdivision
scheme, starting in 3D and generalizing to the tesseract.

## The scheme

Pick a corner of an n-cube. The n edges meeting at that corner are the
**starting edges** 1, 2, …, n. Each is shared between two parallel
(n−1)-faces (cells in 4D, faces in 3D).

For each k = 1, …, n, the **k-th cut** is the midplane perpendicular to
edge k, restricted to the cell `1.1.….1` (k−1 ones). The naming
convention: at every cut, the half "nearer" the common corner is
labelled `…1` and the other half `…2`. So `1` is always the side
containing the corner.

The sequence:

| cut # | splits cell | new cells       |
|-------|-------------|-----------------|
| 1     | the whole n-cube | `1`, `2`   |
| 2     | `1`         | `1.1`, `1.2`    |
| 3     | `1.1`       | `1.1.1`, `1.1.2` |
| …     | …           | …               |
| n     | `1.1.….1` (n−1 ones) | `1.1.….1` and `1.1.….2` (n ones / one with a 2) |

After all n cuts there are **n+1 cells**, with volumes (as fractions of
the original n-cube):

| cell label              | size           |
|-------------------------|----------------|
| `2`                     | 1/2            |
| `1.2`                   | 1/4            |
| `1.1.2`                 | 1/8            |
| …                       | …              |
| `1.…1.2` (k−1 ones, ending in 2) | 1/2^k |
| …                       | …              |
| `1.…1.1` and `1.…1.2` (terminal pair) | 1/2^(n−1), 1/2^(n−1) |

Sum = 1.

The chain `1 ⊃ 1.1 ⊃ 1.1.1 ⊃ … ⊃ 1.1.…1` is a nested sequence of
corner pieces, each half the volume of the previous one. The two
smallest pieces together fill the 1/2^(n−1)-sized corner cell.

## 3D version (cube, n=3)

Three orthogonal starting edges meeting at the origin. After 3 cuts:

| cell    | constraints                       | volume |
|---------|-----------------------------------|--------|
| `2`     | x ≥ ½                             | ½      |
| `1.2`   | x ≤ ½, y ≥ ½                      | ¼      |
| `1.1.2` | x ≤ ½, y ≤ ½, z ≥ ½               | ⅛      |
| `1.1.1` | x,y,z ≤ ½                         | ⅛      |

Each cell is a rectangular box (cuboid).

Each cut, considered as a *sweep* across the cell it bisects, has a
cross-section that evolves through three phases (in the cell's
midplane):

1. **Right triangle** (sweep parameter t ∈ (0, 1]), starts at the
   midpoint of the starting edge, grows along a 45° diagonal until it
   reaches the two adjacent cube edges. Right angle at the starting
   corner.
2. **Pentagon** (t ∈ (1, 2)) with three right angles and two 135°
   angles — a rectangle with one corner truncated at 45°.
3. **Square** (t = 2) — the full midplane of the cell being cut, which
   completes the bisection.

Areas: t²/2 in phase 1, 1 − (2−t)²/2 in phase 2; smooth at t=1.

## 4D analog (tesseract, n=4)

Four starting edges; four cuts. Five cells:

| cell        | constraints                            | volume |
|-------------|----------------------------------------|--------|
| `2`         | x ≥ ½                                  | ½      |
| `1.2`       | x ≤ ½, y ≥ ½                           | ¼      |
| `1.1.2`     | x ≤ ½, y ≤ ½, z ≥ ½                    | ⅛      |
| `1.1.1.2`   | x,y,z ≤ ½, w ≥ ½                       | 1/16   |
| `1.1.1.1`   | x,y,z,w ≤ ½                            | 1/16   |

Each cell is a 4-cuboid. The chain
`1 ⊃ 1.1 ⊃ 1.1.1 ⊃ 1.1.1.1` is a 4-step nested corner chain.

The 4-th cut bisects the corner ⅛-tesseract `1.1.1` into `1.1.1.1`
and `1.1.1.2` — two equal 1/16-tesseracts stacked along w.

Each cut considered as a *sweep* (n-th cut in an n-cube) has a
cross-section in the cell's mid-(n−1)-flat that evolves through
**n phases**:

- 3D (n=3): triangle → pentagon → square (3 phases including the terminal).
- 4D (n=4): tetrahedron → corner-cut polyhedron → cube-minus-corner-tetrahedron → cube.

Using sweep parameter t (a hyperplane c_1 + c_2 + … + c_(n−1) = t cutting
the (n−1)-cube midcell):
- t ∈ (0, 1]: orthoscheme (n−1)-simplex at the near corner.
- t ∈ (1, 2): single-corner-truncated near-simplex.
- t ∈ (k, k+1) for general k: a polytope where k of the n−1 axis-aligned
  corner-tetrahedra have been resolved.
- t = n−1: the full (n−1)-cube (terminal "square" / "cube" / …).

## Simulation — proposed design

New page: `meta/4d/cube-cuts.html`, alongside `tesseract.html`.

- Three.js wireframe cube. The three starting edges highlighted in
  axis colors (red x, teal y, blue z) at the common origin corner.
  Midpoints of those edges marked with small spheres.
- Controls:
  - **Cut 1 / Cut 2 / Cut 3** buttons that animate each cut in turn.
  - **Reset**.
  - **Scrub slider** that runs the entire 3-cut sequence smoothly
    from start to finish.
  - **Explode slider** that pulls the four resulting cells apart along
    the cube's main diagonal for visual separation.
- Each cut animation shows the cut surface evolving through right
  triangle → pentagon → square in its midplane.
- Cut surfaces stay drawn after their animation completes, so cuts 2
  and 3 visibly grow only on the previously cut sub-cube.
- Each resulting cell is rendered as a translucent box with a per-cell
  color and a sprite label (`1.1.1`, `1.1.2`, `1.2`, `2`).
- Style: matching the tesseract page (sky-blue daytime background,
  same palette) so it reads as part of the same project.
- Back-link to `meta/4d/` index.

### Open decisions

1. **Animation pacing** — smooth continuous sweep (preferred) vs.
   discrete phase-by-phase pauses.
2. **Explode mode** — uniform translate-along-diagonal vs. per-cell
   custom offset showing the labelled hierarchy.

## Roadmap

1. Build the 3D cube-cuts simulation page (`cube-cuts.html`).
2. Add a card on `meta/index.html` linking to it (and to a future 4D
   version).
3. Build the 4D analog as `cube-cuts-4d.html` (or fold into the same
   page with a mode toggle), reusing the projection machinery from
   `tesseract.html`.
