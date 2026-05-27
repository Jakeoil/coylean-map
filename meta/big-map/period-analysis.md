# Period of Coylean maps under priority ceilings

Reproduce every table here with **`node meta/big-map/period-analysis.mjs`**
(source kept alongside this file).

## What's being measured

The priority ceilings clamp the 2-adic valuation per axis:

- `maxPri` — caps **both** axes (so `maxPri = c` ≡ `latPri = longPri = c`).
- `maxLatPri` — latitude, **N–S**, rows, `pri(j + vInitRow)`.
- `maxLongPri` — longitude, **E–W**, cols, `pri(i + hInitCol)`.

A cap `c` makes that axis's *priority sequence* periodic with period `2^c`
(`min(valuation, c)` repeats every `2^c`). The question is what period the
resulting **arrow map** has. Method: clean all-true-seed `Propagation`,
standard 1/1 offsets, `maxPri = 20 ≈ ∞`; period = smallest shift `P` giving a
zero-mismatch copy of the full `(down, right)` field over an interior 200×200
window, measured E–W and N–S independently.

> Note: the priority-sequence period (`2^c`) is **not** the map period. The
> propagation integrates long-range history, so the map period is larger.

## Baseline

Uncapped (`maxPri ≈ ∞`): **aperiodic** — no period within the window. The
normal fractal Coylean map.

## Both axes capped at `c`  (= `maxPri = c`)

| `c` | E–W | N–S |
|----|------|------|
| 0 | 2 | 1 |
| 1 | 8 = 2³ | 4 = 2² |
| 2 | 16 = 2⁴ | 16 = 2⁴ |
| 3 | 32 = 2⁵ | 32 = 2⁵ |
| 4 | 64 = 2⁶ | 64 = 2⁶ |
| 5 | 128 = 2⁷ | 128 = 2⁷ |

→ For **`c ≥ 2`: period = `2^(c+2)`** on both axes (4× the priority period,
not equal to it). `c = 0,1` are degenerate small-cap cases — at `c = 0` every
priority ties, down always wins (vertical seniority), and N–S collapses to 1.

## One axis capped at `c`, other ≈∞ (vertical seniority)

| config | E–W | N–S |
|---|---|---|
| `longPri = c` only | `2^(c+2)` | **`2^(c+3)`** |
| `latPri = c` only | `2^(c+2)` | `2^(c+2)` |

Key fact: **capping one axis tiles the *whole* map** — the axes are coupled,
not independent. Mechanism: a priority above the *other* axis's ceiling can
never change an outcome, so the larger ceiling is effectively clamped down to
the smaller. The **binding cap is `m = min(latPri, longPri)`**.

## The law (binding cap `m ≥ 2`)

- Base tile **`2^(m+2) × 2^(m+2)`**.
- **Doubling exception:** the tie-*winning* axis's period doubles to
  **`2^(m+3)`** when the strictly-smaller cap sits on the tie-*losing* axis.

Under **vertical** seniority the tie-winner is N–S (latitude). Confirmed by the
mixed cases:

| config | E–W | N–S | binding | note |
|---|---|---|---|---|
| `lat=2, long=4` | 16 | 16 | lat (winner) | no doubling |
| `lat=4, long=2` | 16 | 32 | long (loser) | N–S doubles |
| `lat=3, long=5` | 32 | 32 | lat (winner) | no doubling |

## Repeat dimensions (x × y cells; x = E–W, y = N–S)

Let `B = 2^(m+2)` with `m = min(latPri, longPri)` the binding cap (`m ≥ 2`).

| regime (vertical seniority) | x × y | in baseline `B` |
|---|---|---|
| both capped, or latitude binds (`lat ≤ long`) | `2^(m+2) × 2^(m+2)` | `B × B` (1×1) |
| longitude strictly binds (`long < lat`) | `2^(m+2) × 2^(m+3)` | `B × 2B` (1×2) |

Horizontal seniority is the backslash flip — transpose x↔y, so `1×2` → `2×1`
(`2B × B`). Concrete tiles (vertical seniority):

- `c=2` both → **16 × 16** · `c=3` both → **32 × 32** · `c=4` both → **64 × 64**
- `longPri=3` only → **32 × 64** (1×2) · `latPri=3` only → **32 × 32** (1×1)

## Symmetry is the H↔V backslash duality

It is **not** symmetric under a bare lat↔long swap. It **is** symmetric under
lat↔long **together with a seniority swap** — which is exactly the
**backslash (transpose) flip that turns a V map into an H map**: reflecting
across the main diagonal swaps rows↔cols (latitude↔longitude) *and*
down↔right arrows *and* the tie-break (vertical seniority ↔ horizontal
seniority). So a `2×1` period ratio on V reads as `1×2` on H.

| seniority | `longPri=3` only (E–W / N–S) | `latPri=3` only (E–W / N–S) |
|---|---|---|
| vertical (down wins) | 32 / **64** | 32 / 32 |
| horizontal (right wins) | 32 / 32 | **64** / 32 |

The loose (doubled) axis is always the **tie-winner**, and flipping seniority
mirrors the whole table across the diagonal. Seniority is the only thing that
breaks the N–S/E–W symmetry, so this is the expected and complete picture.

## Invariance

Period is independent of the dyadic offset (verified at 1/1 and 5/3 — both
`2^5` at `c = 3`) and of the seed (the universe-seeded integrated scaffold in
`explore.mjs` tiles with the same period as the clean propagation — separately
checked at `c = 2`: clean 0.00 mismatch at period 16, 0.37 at period 4).

## Practical consequences

1. **At cap `c` both axes, the tile is `2^(c+2)` cells**, e.g. `c=4` → **64**,
   not 16. To *see* tiling in `explore.html`, zoom so ~2–4 tiles span the
   screen. `c=2` (16-cell tiles) or `c=3` (32) read most clearly.
2. **`coylean-core.js` docs were wrong** (commit `05fa53a` claimed the period
   was `2^maxLongPri`) and are **now corrected** to `2^(min(lat,long)+2)` with
   the seniority-dependent ×2 on the tie-winning axis. The big-map `index.html`
   and explorer tooltips make no period claim, so they needed no change.

## Derivation of the exponents

Everything follows from one fact about `reactionFromPriority`.

### 1. The reaction is GF(2)-linear

Reading the four input cases as algebra over GF(2) (⊕ = XOR), with
`D[j][i] = [colPriority_i ≥ rowPriority_j]` the only thing the rule depends on:

    D = 1 (down wins ties):  down_out  = down_in
                             right_out = right_in ⊕ down_in
    D = 0 (right wins):      right_out = right_in
                             down_out  = down_in ⊕ right_in

Both are transvections — **no constant term** — so the whole propagation is a
*linear* function over GF(2) of the boundary seed, parameterised by the boolean
field `D`. (Verified by superposition: `field(1,1) = field(1,0) ⊕ field(0,1)`.)
Map periodicity is thus periodicity of a linear image, set by `D` and the seed
(both doubly periodic — the all-ones seed has period 1).

### 2. Effective caps — the coupling and the asymmetry

`D` compares `c_i = min(v₂(i+1), b)` with `r_j = min(v₂(j+1), a)`
(`a = maxLatPri`, `b = maxLongPri`). Two priority values that never change any
comparison are interchangeable, so each axis has an **effective cap**:

- a column value `c_i ≥ a` always satisfies `c_i ≥ r_j` (since `r_j ≤ a`) →
  all merge → **effLong = min(b, a)**;
- a row value `r_j > b` can never satisfy `c_i ≥ r_j` (since `c_i ≤ b`) → all
  `r_j ≥ b+1` merge → **effLat = min(a, b+1)**.

The `b` vs `b+1` gap *is* the tie direction. With `≥`, a column wins at
equality, so it saturates the moment it reaches `a` (already beats the
strongest row); a row must *exceed* the strongest column `b` to be sure of the
win, so it saturates one level later, at `b+1`. **The tie-winning axis
(latitude, under vertical seniority) gets one extra effective level** — which is
why capping one axis still tiles both, and why the two axes aren't symmetric.
Horizontal seniority gives the tie to the column, swapping the roles:
`effLong = min(b, a+1)`, `effLat = min(a, b)`.

### 3. Period = 2^(effCap + 2)

For a single axis with effective cap `k`, the priority sequence has period
`2^k` but the map period is `2^(k+2)` (`k ≥ 2`):

- **Doubling.** Odd columns carry a shifted copy of the next cap down: for odd
  `i = 2i'+1`, `c_i = 1 + min(v₂(i'+1), k−1)`. Comparisons on the odd×odd
  sublattice shift by +1 on *both* axes, so they reproduce the cap-(k−1)
  problem; integrating out the priority-0 even cells is a fixed linear step
  (§1), leaving the cap-(k−1) map at half scale ⇒ `T(k) = 2·T(k−1)`.
- **Constant.** The recurrence is clean for `k ≥ 2`; the first two levels are a
  pre-asymptotic boundary layer (`k=0 → 2×1`, `k=1 → 8×4`) and it saturates at
  `T(2) = 16 = 2⁴`. The map period is always a multiple of the priority period
  `2^k`; the factor is exactly `4 = 2²` (a 2-cell settling layer per axis — the
  doubling is the rigorous part, the constant is pinned at the base).

### Result

    E–W period = 2^(effLong + 2)     N–S period = 2^(effLat + 2)

    vertical   seniority: effLong = min(b, a),    effLat = min(a, b+1)
    horizontal seniority: effLong = min(b, a+1),  effLat = min(a, b)

Matches every measured case, including the predictions `lat=5,long=3 → 32×64`
and `lat=20,long=3 → 32×64` and both seniority flips (run `period-analysis.mjs`).
It subsumes the `2^(m+2)` / `2^(m+3)` law: with `m = min(a,b)`, equal-or-latitude-
binding gives the square `2^(m+2)`; longitude strictly binding doubles latitude
to `2^(m+3)`.
