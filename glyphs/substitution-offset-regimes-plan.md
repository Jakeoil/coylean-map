# Plan — substitution tables across seniority and dyadic offset

**Status: PLAN, 2026-05-29.** Grounded by Node experiments (scripts named
below; all use `glyph-core` + `computeMapModel`, no DOM). Direction chosen with
Jake: the off-anchor solution is the **(self, N, W) tromino table**.

## TL;DR of what the experiments proved

| Question | Answer | Evidence |
| --- | --- | --- |
| Where is the 6-bit-code substitution an exact fixed point? | Exactly the 4 offsets `(long,lat) ∈ {0,1}×{0,1}`, for **both V and H** (0 divergence; everything else 180–250/256). | `test-offset-regimes.mjs` |
| How big is the anchor table? | 35 codes = **12 D4 orbits** per seniority → member-only table is **12 rows V, 12 rows H**. | `test-offset-regimes.mjs` |
| Is it a function of the 6-bit code off-anchor? | **No** — same code → different children in the *same* map (≈25–30 conflicts at 2/2). | `test-substitution.mjs`, `test-offset-regimes.mjs` |
| Does the cage's own 8-bit boundary fix it? | **No** — more conflicts, not fewer. The deciding context is outside the cage. | `test-boundary-key.mjs` |
| What context closes it? | **self + North + West neighbor** (the SE-upstream L-tromino) → 0 conflicts at every offset tested. NW / all-8 add nothing. | `test-neighborhood-key.mjs` |
| One universal tromino table for all offsets? | **No** — merging offsets conflicts; not even constant within `offset mod 4`. The dyadic position matters at all scales. | `test-tromino-regime.mjs` |
| Is a single offset's tromino table a stable fixed point across orders? | **Yes** — 64→128 and 128→256 agree on 100% of shared keys. (A few self-conflicts surface only at the deepest order; likely SE-patch edge truncation — verify with a symmetric universe.) | `test-tromino-crossorder.mjs` |

**Conclusion:** there are two regimes.
- **Anchor regime** `{0,1}²`: the documented 6-bit-code substitution; one
  member-only table per seniority (12 each). Solid — ship it.
- **Off-anchor regime** (1/2 and beyond): the 6-bit code is too coarse; the
  rule is a stable function of the **(self, N, W) tromino**, but the table is
  **specific to each offset** (no master non-anchor table). A from-scratch
  per-offset tromino table works.

## Relation to the superglyph / dyadic-cage idea

Jake's instinct — group already-translated glyphs into a dyadically-bounded
super-cage — is right in spirit. The correction the data forces: the context
that actually closes the substitution is the **upstream** N/W pair (propagation
flows SE), not a downstream E/S block. `(self, N, W)` is an **L-tromino of
upstream cages**, and that triple is the real engine. A super-cage is then a
*display/bookkeeping grouping* on top of the tromino engine, not the unit that
carries the rule (a lone super-cage isn't self-contained — its NW member's N/W
context lives in the neighbouring super-cage).

---

## Phase 1 — Solidify & document the anchor tables ✅ DONE 2026-05-29

1. **Shorten to member-only.** ✅ `glyphs/glyphs.js` `buildTranslationTable` now
   dedupes by D4 orbit and is parametrized by seniority — **12 V cards, 12 H
   cards** (one D4 representative per reachable orbit; rest by D4). Confirmed 12
   reachable orbits / 24 each in the clean order-5 scan.
2. **Document the valid offset range.** ✅ The catalog anchor-note now reads:
   exact fixed point on lat/long ∈ {0,1} (0/0, 0/1, 1/0, 1/1) for both V and H;
   diverges once a coordinate ≥ 2, where the tromino rule is needed.
3. **Two reachables tables** — ✅ `#translation-table-v` and
   `#translation-table-h` on `glyphs/index.html`, each member-only, tagged with
   the anchor-offset validity.
4. **`EXTRA_SUB_V` removed.** ✅ Reverted `substitution.mjs` / `substitution.html`
   to HEAD (the offset-derived feature is gone). The 29 codes are handled via the
   off-anchor regime (Phase 2), not jammed into the anchor table.

## Phase 2 — Off-anchor regime: per-offset tromino tables (1/2 DONE)

5. **Build a from-scratch tromino table for the target offset.** ✅
   `glyphs/substitution.mjs` `buildTrominoTable(seniority, h, v)` keys each cage
   on `(self; N; W)` and reads the 2×2 children + separators from the offset's
   order-6→7 map; cached per `(seniority, offset)` via `currentTrominoTable()`.
   139 keys at 1/2.
6. **Verify it as a fixed point on the page.** ✅ A `Tromino expansion` sidebar
   toggle on `substitution.html` switches `expandGrid` to the tromino rule
   (`ruleFor` falls back to the 6-bit table at window edges with no N/W context).
   With it on at lat/long 1/2 the divergence overlay clears in the interior;
   only the top row / left column (no upstream context) fall back. Node proof:
   `test-tromino-12.mjs` — every tromino-covered seed cell (49/49) matches the
   order-6 truth; the 15 uncovered are exactly the seed edge.
7. **Represent the tromino rule in the UI.** Partially: the sidebar legend
   explains the toggle. *Still TODO* — extend the hover preview to show the
   *triple* `(self; N; W) → 2×2` rather than `parent → 2×2`. The "reachables"
   for this regime are tromino keys, not
   bare codes.

## Phase 3 — Structure & generalization (after 1/2 works)

8. **Map the regime structure.** The table is offset-specific; characterise how
   it varies (it is *not* periodic mod 4). Open question: is it a function of
   the offset's full 2-adic expansion, and can tables for related offsets be
   derived from one another (D4 + dyadic-shift relations), so we don't store one
   per offset? `test-tromino-regime.mjs` is the starting harness.
9. **Resolve the deep-order self-conflicts** (6–9 keys at order 128→256). Most
   likely SE-patch edge truncation — re-run the build on a symmetric universe
   (`Propagation.fromUniverseExtents`, the universe view already in
   `substitution.mjs`) and confirm they vanish. If they persist, a rare class
   needs more than N/W (then, and only then, consider a wider stencil or true
   depth-2 superglyphs).
10. **Superglyph as display layer (optional).** If Jake wants the dyadic
    super-cage view, render it as a 2×2 grouping of tromino-expanded cages
    bounded on the `pri ≥ 3` lattice — a presentation over the Phase-2 engine.

## Files / scripts

- Engine: `glyphs/glyph-core.js` (`computeMapModel`, `getSectionData`,
  `classifyVisualD4`, `computePattern`, `d4Compose`).
- Page: `glyphs/substitution.mjs` / `substitution.html` (divergence overlay,
  hover preview, seniority toggle, offset inputs already present).
- Evidence (keep for the record): `test-offset-regimes.mjs`,
  `test-boundary-key.mjs`, `test-neighborhood-key.mjs`,
  `test-tromino-regime.mjs`, `test-tromino-crossorder.mjs`.

## My recommendation (short)

Ship Phase 1 now (it's correct and small). For Phase 2, the tromino is the right
engine and is proven to close 1/2 — build that table from scratch and confirm
zero divergence on the page. I'd **remove `EXTRA_SUB_V`**: it's a half-measure
that neither belongs to the anchor regime nor fixes any off-anchor one. The big
conceptual result to internalise: **substitution is anchor-local** — a single
6-bit-code table only exists at `{0,1}²`; every other dyadic offset is its own
substitution system on the upstream tromino.
