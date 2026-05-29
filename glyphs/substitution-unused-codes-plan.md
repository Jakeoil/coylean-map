# Plan — find substitution rules for the 29 unused V codes

**Status: OPEN as of 2026-05-29.** Same content as the auto-memory entry
`project_substitution_unused_codes`; kept here for in-repo discoverability.

## Where we are

`glyphs/substitution.mjs` builds `SUB_TABLE_V` / `SUB_TABLE_H` by:

1. Direct canonical propagation at orders 5/6/7 via `getSectionData`. Yields
   **34 codes** per seniority.
2. D4 extrapolation (`extrapolateSubTable`): for any orbit with at least one
   canonical member, fill the rest by transforming that member's rule under
   the D4 element relating them. Lifts the count to **35** (fills Q's missing
   (2, 6) orbit-sibling). 12 orbits are now fully covered.

The hover preview in the sidebar shows each cell's rule live, and the diff
overlay (red = pred-only, pink = truth-only) marks substitution mispredictions.
The orange cells the user still sees are the **29 codes in 11 orbits that
canonical propagation never reaches** — D4 has no source to extrapolate from
in those orbits.

## What's open

64 V codes split into 24 D4 orbits. Canonical propagation touches 12; 11
orbits (29 codes) are structurally unreachable from any canonical seed —
single-arrow at the origin, all-true universe boundary, or
`fromUniverseExtents(N=W=E=S=256)` all max out at the same 35. Order 9
(N=512) does not add new codes either.

Cross-seniority observation: H propagation reaches 35 codes too, of which
11 are V's untouched codes — so **18 of V's 29 missing codes are also
untouched by H**. A pure cross-seniority transform tops out at 46/64.

## What didn't work, and why

**Isolated 8×8-block propagation** (set `initDown`/`initRight` to put the
parent's 3 down + 3 right bits at the NW interior, zero everywhere else,
propagate). Result: NW child matches canonical, but NE/SW/SE disagree in
26 of 27 entries. In canonical the 8×8 region's N/W boundary past the
parent's 6-bit input is set by surrounding sections — not zero. For an
unreachable code there's no surrounding context to copy, so any boundary
choice is a *definition*, not a derivation.

## Ideas worth trying

1. **Cross-seniority transform**. 11 of V's 29 missing codes are canonical
   in H. The V grid is the backslash dual of H (`project_glyph_font_mapping`
   in memory). Compose the V↔H dual with D4 to obtain a V rule from each
   H rule that lands on a missing V code.

2. **Algebraic closure under substitution + D4**. Empirical question: is
   there a relation (e.g. a missing-orbit rule = a substitution-child rule
   from a touched orbit, transformed) that would close the table?

3. **Seed-from-the-missing-code propagation**. Start a propagation whose
   universe boundary FORCES a missing code to appear at some section; read
   off the children. Risk: the children depend on the rest of the seed; need
   to pick a seed that keeps the canonical 35 codes' rules invariant.

## Files to start at

- `glyphs/substitution.mjs` — `extrapolateSubTable`, `applyD4ToRule`,
  `buildCodeUnderD4`, the SUB_TABLE_V/H init.
- `glyphs/glyph-core.js` — `computePattern`, `transformedPatternKey`,
  `classifyVisualD4`, `d4Compose`. All exported now.
- Recent commits: `3856346` (TDZ fix), `6848a92` (D4 extrapolation),
  `bc2647b` (hover preview), `5300e70` (seniority + diff overlay).

## Notes on UI side

When a cell still has no rule after the extrapolation gets richer:

- It stays orange.
- Hover shows "Not in canonical SUB_TABLE — no 2×2 expansion rule."

Once we add new rules (from cross-seniority or wherever), the orange goes
away for those codes and the hover preview shows the new children
automatically.
