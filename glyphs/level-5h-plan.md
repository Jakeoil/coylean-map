# Level 6h — H-priority Coylean Map Plan

> **Direction change (2026-04-08)**: this plan originally proposed an asymmetric 32×64 "level 5h" — half-step expansion in the horizontal axis only with horizontal-seniority. When implemented, the result was unfamiliar because the seed `d[0] = true` is the V-priority seed; the H dual needs a different seed (see "Seed and the SE patch" below). Switching to a symmetric **16×16 H-priority** map called **6h** is much cleaner: it's just the backslash flip of order 6, sits alongside the existing 5 (= 5v) and 6 (= 6v) maps, and the **V↔H translation tables become the actual point of the page**.

## Goal

Add a third map, **Coylean Map — Order 6h**, between the existing Order 5 and Order 6 figures on `glyphs/index.html`. Order 6h is the same shape as Order 6 (64×64 cells, 16×16 sections of 4×4 glyphs) but with **horizontal seniority** — the dihedral / backslash dual of order 6.

| Level     | Cells   | Sections | Tie-break                    | Seed       |
| --------- | ------- | -------- | ---------------------------- | ---------- |
| 5 (= 5v)  | 32 × 32 | 8 × 8    | vertical wins (V-glyphs)     | `d[0]=true` |
| **6h**    | 64 × 64 | 16 × 16  | **horizontal wins (H-glyphs)** | **`r[0]=true`** |
| 6 (= 6v)  | 64 × 64 | 16 × 16  | vertical wins (V-glyphs)     | `d[0]=true` |

The 6v and 6h maps are exact backslash duals: reflecting one across the main `\` diagonal produces the other. The point of having both side-by-side is to make the V↔H glyph translation visible.

## Seed and the SE patch

> **Important context to preserve.** The Coylean algorithm renders only a finite SE patch of a much larger map that conceptually expands in **all four directions** (NW, NE, SW, SE quadrants). The seed arrays `d[]` and `r[]` along the top-left edge are not arbitrary — they're the boundary inputs that the NW quadrant would feed into the SE patch we're rendering.
>
> Both V and H versions are SE patches of the same kind of larger structure, with the boundary inputs **set in the SE sector** of both the v and h versions. The difference is which seed pattern they receive at that NW boundary:
>
> - **V map (`v`-priority)**: seeded with a single down-arrow at column 0 → `d[0] = true`. Propagates a vertical line down the left edge with horizontals branching off to the right.
> - **H map (`h`-priority)**: seeded with a single right-arrow at row 0 → `r[0] = true`. Propagates a horizontal line across the top edge with verticals branching down.
>
> These two seeds are backslash flips of each other, which is why the resulting maps are backslash flips of each other.

## Step 1 — Generalize `drawCoyleanMap` (DONE in earlier stop)

Already complete:

- Signature is now `drawCoyleanMap(canvasEl, Nr, Nc, cell, opts)`.
- `horizontalWinsTies` flag flows through `opts` and flips the tie-break in both the main loop and the section-capture loop.
- Section overlay path reads `H_GLYPH_LETTERS` (with red, backslash-mirrored letters) when `horizontalWinsTies` is set.

**Remaining fix in this function**: the seed line `d[0] = true` (and the matching seed in the section-capture re-run) must become `r[0] = true` when `horizontalWinsTies`. Same fix in two places.

## Step 2 — Rename and resize: 5h → 6h

In `index.html`:

- Rename the `<h2>` from `Coylean Map — Order 5h` to `Coylean Map — Order 6h`.
- Update `data-map="coylean-map-5h"` → `data-map="coylean-map-6h"` on both checkboxes.
- Update `<canvas id="coylean-map-5h">` → `<canvas id="coylean-map-6h">`.

In `glyphs.js`:

- Rename the `mapConfigs` and `mapBBState` keys from `coylean-map-5h` to `coylean-map-6h`.
- Update the dimensions: `{ Nr: 64, Nc: 64, cell: 8, horizontalWinsTies: true }`.

After this step, 6h should look exactly like 6v reflected across the main diagonal — a horizontal cap at the top with verticals branching down, plus all the secondary structure that follows.

## Step 3 — Generalize `getSectionData` for the H map

`getSectionData(N)` at `glyphs.js:753` needs:

- Signature `getSectionData(Nr, Nc, horizontalWinsTies)`.
- `Mr = Nr + 1; Mc = Nc + 1`, asymmetric `d`/`r` arrays.
- Tie-break uses `horizontalWinsTies ? pri(x) > rp : pri(x) >= rp`.
- **Seed**: same flip — `d[0] = true` for V, `r[0] = true` for H.
- `NSr = Nr / SEC`, `NSc = Nc / SEC`; `codes`, `vBound`, `hBound` sized `[NSr][NSc]`.

This is needed so the V↔H translation tables in Step 4 can read level-6h section data the same way we already read level-5 and level-6 V data.

## Step 4 — V↔H translation tables (the point of this work)

This is the actual goal. The existing "Order 5 → 6" 2×2 expansion table stays as-is. We add new tables that pair each level-6 V-section with its level-6h H-counterpart at the same `(sr, sc)` position.

Open questions for the user before coding the table format:

- **Granularity**: pair V-glyphs with H-glyphs **by orbit family** (one card per V family showing its H counterpart) — this gives ~12 cards. Or pair **per position** (all 256 positions in a 16×16 grid showing the V and H glyph side by side) — this gives the full visual grid. Or both.
- **Layout per card**: V on left, H on right? Or V on top, H on bottom? Or overlaid?
- **Direction**: a single V→H table, or both V→H and H→V (which would just be the same data sorted by H family instead of V family)?

These need a 5-minute conversation before the code is right; deferring until after Step 1–3 are visible.

## Step 5 — Verification

Manual checks once 6h renders:

1. **Backslash duality** — order 6h should be exactly the diagonal mirror of order 6v. Pick any feature in 6v (say a particular F-section in the top-left region) and confirm it appears in the mirror-image position in 6h, with the letter sideways and red.
2. **Seed correctness** — 6h should have a horizontal line capping the top edge with verticals branching down (the dual of 6v's vertical-left-edge seed).
3. **Seniority flip at equal-priority intersections** — at any intersection where the down-line and right-line have equal 2-adic priority (e.g. row 2 × col 2, both priority 1): in 6v the vertical passes through, in 6h the horizontal passes through.
4. **Section letters** — assigned H-orbits get red, sideways letters; unassigned ones fall back to `H₍d,r₎` placeholders.
5. **No regressions** — orders 5 and 6 still render identically; the existing 5 → 6 translation table is unchanged.

## Resolved decisions

- **Replace, not supplement**: the asymmetric 32×64 5h is gone; 6h is symmetric 64×64.
- **Naming**: new map is `6h`. Existing 5 and 6 are conceptually `5v` and `6v` but their DOM ids and headings stay as-is for now.
- **Cell size**: 8 px, matching 6v.
- **Seed**: H map uses `r[0] = true`; V map uses `d[0] = true`. Both are SE-patch boundary inputs from the implicit larger map.
- **Translation table format**: deferred until 6h is visible — will discuss V↔H table layout then.

---

## Execution order

| #   | What                                                              | Files                 | Status      |
| --- | ----------------------------------------------------------------- | --------------------- | ----------- |
| 1   | Generalize `drawCoyleanMap` to `(Nr, Nc, horizontalWinsTies)`     | `glyphs.js:522`       | done        |
| 2   | H letter rendering path in section overlay                        | `glyphs.js:639`       | done        |
| 3   | **Seed flip**: `r[0] = true` when `horizontalWinsTies`            | `glyphs.js:544, 592`  | next        |
| 4   | Rename 5h → 6h, resize to 64×64                                   | both                  | next        |
| 5   | Verify 6h matches the backslash-flip-of-6v expectation            | —                     | stop        |
| 6   | Generalize `getSectionData` to `(Nr, Nc, horizontalWinsTies)`     | `glyphs.js:753`       | after stop  |
| 7   | Discuss V↔H translation table format                              | —                     | after stop  |
| 8   | Build V↔H translation tables                                      | `glyphs.js:851`       | after stop  |
