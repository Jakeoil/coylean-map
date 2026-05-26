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

## Open

The `+2` / `+3` exponents are clean empirically (`c = 2..5`) but not yet
derived. Likely a short argument from the reaction's 2×2 dependency stencil.
