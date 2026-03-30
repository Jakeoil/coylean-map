# Coylean Map Algorithm — Structure and Parameters

## The Core Algorithm

The Coylean map is produced by propagating two boolean arrays across a grid:

```
d[] — vertical arrows (propagate downward)
r[] — horizontal arrows (propagate rightward)
```

At each grid intersection `(x, y)`:

1. Compute the **priority** of `x` and `y`
2. The higher-priority direction **wins**: its arrow flips the other
3. Both arrows propagate forward with their (possibly flipped) values

```javascript
if (priority(x) >= priority(y)) {
    if (d[x]) r[y] = !r[y];   // vertical wins → flip horizontal
} else {
    if (r[y]) d[x] = !d[x];   // horizontal wins → flip vertical
}
```

The standard seed is `d[0] = true` — a single vertical arrow at the origin.

## Two Equivalent Representations

The same map can be generated two ways:

1. **Direct algorithm**: Run the propagation over an `(N+1) × (N+1)` grid.
   Each 4×4 section is characterized by a pair `(dc, rc)` — the 3-bit
   codes of its entering vertical and horizontal arrows.

2. **Seed expansion**: Start from a single code (F = V₇₇) and recursively
   apply the substitution table — each code deterministically expands to a
   2×2 block of child codes, plus boundary segments.

Both produce identical results. This equivalence confirms the map's
**self-similar fractal structure**: the local XOR propagation rule and the
global substitution system encode the same information.

Only **34 of the 64 possible** `(dc, rc)` codes are reachable from the F
seed. The substitution is deterministic and closed over this set.

## The Universe Extension

The standard map occupies one quadrant (rightward and downward from the
origin). The full plane is tiled by a 2×2 quadrant seed:

```
 J (V₆₆)     │ M (V₅₆)
              │─────────
 J×sₕ (V₇₃)  │ F (V₇₇)
```

- Vertical boundaries between left and right quadrants: **yes** (both rows)
- Horizontal boundary between M and F: **yes**
- Horizontal boundary between J and J×sₕ: **no**

Expanding this seed with the same substitution rules produces the Coylean
map for the entire plane.

## Free Parameters

The algorithm as described is one specific instance. Several of its
assumptions are actually free parameters that define a **family** of maps:

### 1. Seed

**Current choice**: `d[0] = true`

The initial condition. Could seed at different positions, in both arrays,
or at multiple positions. The universe quadrant seed (J, M, J×sₕ, F) shows
that different regions of the full map correspond to effectively different
seed conditions. Any reachable code could serve as a seed for a sub-map.

### 2. Tie-breaking rule

**Current choice**: `>=` (vertical wins ties)

When `priority(x) == priority(y)`, the vertical arrow takes precedence.
Changing to `>` (horizontal wins ties) produces a fundamentally different
map — the transpose, in a sense. This single bit of asymmetry is what
breaks the diagonal symmetry of the output.

### 3. Priority function

**Current choice**: 2-adic valuation (count trailing zeros in binary)

```
position:  1  2  3  4  5  6  7  8  ...
priority:  0  1  0  2  0  1  0  3  ...
```

This creates a hierarchy where every 2nd line has priority 0, every 4th
has priority 1, every 8th has priority 2, etc. The resulting map has
**4-cell sections** because the priority function has period 4 at the
section level (positions 1–3 have priorities 0, 1, 0 — then position 4
resets at a higher level).

A different base (e.g., 3-adic valuation) would produce a different
hierarchical structure with different section sizes. Non-arithmetic
priority functions would break the regular subdivision entirely.

### 4. Propagation rule

**Current choice**: XOR toggle (`!r[y]`, `!d[x]`)

The winning arrow **flips** the losing arrow. This is an involution —
applying it twice returns to the original state. Other Boolean operations
are possible:

- **OR** (set): `r[y] = true` — arrows only turn on, never off
- **AND** (gate): `r[y] = r[y] && d[x]` — arrows can only survive together
- **Copy**: `r[y] = d[x]` — direct transfer

Each would produce a qualitatively different family of patterns. The XOR
rule is special because it preserves information (it's reversible) and
produces the rich self-similar structure.

### 5. Section size

**Current choice**: 4 cells per section axis (3 internal + 1 boundary)

This is coupled to the priority function: the 2-adic valuation naturally
groups cells into blocks of 4. A p-adic priority function would pair with
section size `p + 1`. Changing section size independently of the priority
function would break the alignment between the hierarchical structure and
the section boundaries.

## What Makes This Instance Special

The specific combination of 2-adic priority + XOR toggle + vertical
tie-breaking produces a map with:

- **Exact self-similarity**: the substitution structure is deterministic
  and closed
- **D4 symmetry classes**: the 34 reachable codes fall into equivalence
  classes under the dihedral group of the square
- **Finite substitution alphabet**: only 34 codes, not growing with depth
- **Universe tileability**: the full plane can be covered by a simple 2×2 seed

It is an open question which other parameter choices preserve these
properties, and whether there are other "nice" points in this parameter
space.
