# Topology of Curve-Crossing Maps

## What you're building

Drawing curves on a plane and tracking their crossings produces a **planar subdivision** — the plane partitioned into vertices (crossings), edges (arcs between crossings), and faces (regions). This is a **CW complex** of dimension 2:

- **0-cells**: intersection points (and dangling endpoints)
- **1-cells**: curve segments between consecutive 0-cells
- **2-cells**: connected regions of the complement (including the unbounded "ocean")

The governing invariant is **Euler's formula for the sphere**:

    V - E + F = 2

(treating the unbounded face as a face, or equivalently compactifying the plane to S^2). Every crossing of two transverse curves is a **4-valent vertex** — exactly four edge-ends meet there. This is the key structural constraint.


## The combinatorial object

Strip away geometry and what remains is a **combinatorial map** (or **rotation system**): a triple (D, R, L) where

- D = set of **darts** (directed edge-halves, a.k.a. half-edges)
- R: D -> D is a permutation whose cycles give the **cyclic order of darts at each vertex** (the rotation)
- L: D -> D is the fixed-point-free involution pairing each dart with its reverse

The faces are the orbits of R composed with L. That's it — no coordinates needed. The entire topology of the map is encoded in two permutations. Coordinates are a separate layer for rendering.

This is exactly what the DCEL (doubly connected edge list) in the current code implements, in a less algebraic but equivalent form:
- Each half-edge stores `origin`, `twin` (= L), and `next` (= R composed with L)
- Face traversal follows `next` pointers
- Vertex traversal follows `twin` then takes the next outgoing edge


## Alternating structure and Coylean maps

When alternating mode is active, each crossing gets an additional bit of state: which strand **continues** and which **stops**. At a 4-valent vertex with strands A and B crossing:

- **Alternating/over-under**: strand A passes over (continues), strand B passes under (stops and restarts). At the next crossing, roles reverse.
- **Coylean convention**: horizontal and vertical lines follow a specific stop/continue rule that produces the self-similar fractal.

This is the same structure as a **knot diagram** — a 4-valent planar graph where each vertex is decorated with crossing information (over/under). The curves themselves are **immersed 1-manifolds** in the plane, and the crossing decoration lifts the immersion to an **embedding in 3-space** (or equivalently, a knot/link).

For Coylean maps specifically: the alternating pattern at crossings is what produces the characteristic fragmented line segments. The "rule" at each crossing (continue or stop) is the seed of the fractal.


## Best data structures

### For the topology: Combinatorial Map

```
Dart {
    id
    twin:   Dart     // the reverse half-edge (involution L)
    next:   Dart     // next dart in the face cycle (R . L)
    prev:   Dart     // previous dart in face cycle (L . R^-1)
    origin: Vertex
    face:   Face
    edge:   Edge     // shared with twin
}
```

**Why**: every query you need is O(1):
- Walk around a face: follow `next`
- Walk around a vertex: follow `twin.next`
- Find the face on either side of an edge: `dart.face` vs `dart.twin.face`
- Test adjacency of two faces: check if any edge borders both

This is the DCEL. The current implementation is close but stores half-edges as plain objects in an array with index-based links. Moving to a proper object/reference model would simplify traversal.

### For the crossings: Decorated 4-valent graph

Each vertex (crossing) needs:

```
Crossing {
    id
    position: (x, y)
    darts:    [Dart; 4]          // the four half-edges, in cyclic order
    state:    'over_AB' | 'over_CD' | 'unresolved'
                                  // which strand passes over (alternating data)
    strands:  [(Dart,Dart), (Dart,Dart)]
                                  // pairs of opposite darts forming each strand
}
```

The `strands` field pairs opposite darts: at a crossing of strands A and B, strand A enters on dart 0 and exits on dart 2 (opposite), strand B on darts 1 and 3. This lets you trace a single strand through multiple crossings.

### For the regions: Face records

```
Face {
    id
    boundary: Dart        // any dart on the boundary (follow `next` for the rest)
    area:     number      // signed area from polygon
    color:    int         // from graph coloring
    isOuter:  bool
}
```

The polygon for rendering is derived by walking `boundary.next` and collecting coordinates. No need to store the polygon separately — it's a view of the dart structure.

### For the geometry: separate from topology

```
Edge {
    id
    dart:     Dart        // one of the two half-edges
    points:   [(x,y)]    // polyline approximation (from spline subdivision)
}

Vertex {
    id
    position: (x, y)
    dart:     Dart        // any outgoing dart
}
```

Geometry (coordinates, polylines) lives on Vertex and Edge. Topology (adjacency, faces) lives on Dart. This separation means you can deform the geometry without touching the topology, or reason about the topology without coordinates.


## Graph coloring

For coloring the faces of a 4-valent planar graph:

- **Four Color Theorem** guarantees 4 colors always suffice.
- **Two-colorability** (checkerboard): a planar graph's faces are 2-colorable iff every vertex has even degree. Since all crossings are 4-valent (even), the faces of the crossing graph are **always 2-colorable** — as long as every vertex is a proper crossing. Dangling endpoints (degree 1) break this.

So for a "pure" curve-crossing map with no dangling ends, white and blue always suffice. Dangling ends (from strokes that start/end in open space) create odd-degree vertices that may require a third color. The current code's strategy of trying 2-coloring first and falling back to greedy is correct.

If you close all strokes (every stroke starts and ends at a crossing, as alternating mode naturally does), the entire map is guaranteed 2-colorable.


## What this connects to

| Concept | Your tool | Classical math |
|---|---|---|
| Curves crossing on a surface | Drawing strokes | Immersed curves, knot diagrams |
| Intersection points | Red dots | 4-valent vertices |
| Regions filling with color | Land/ocean | Faces of CW complex, graph coloring |
| Alternating mode | Stop/continue at crossings | Alternating knots, checkerboard coloring |
| Coylean map rule | Fractal line pattern | Substitution system on the combinatorial map |
| The map itself | What you see | Planar subdivision / combinatorial map |

The Coylean map is a specific **substitution rule** on a combinatorial map: take a square with a crossing pattern, replace each face with a smaller copy of the whole pattern, inheriting crossing states from the parent. The topology of the result is fully determined by the combinatorial map of the seed and the substitution rule — geometry just tells you where to draw it.
