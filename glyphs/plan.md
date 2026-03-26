# Glyphs Page — Implementation Plan

## Goal
Create `glyphs/index.html`: a standalone page that catalogs all 64 possible 4×4 Coylean Map sections, then classifies them by D4 symmetry.

---

## Step 1 — Understand the 4×4 encoding

A 4×4 Coylean section has a 3×3 interior line grid:
- 3 interior **vertical** (down-arrow) lines at x = 1, 2, 3
- 3 interior **horizontal** (right-arrow) lines at y = 1, 2, 3

Each line is either present or absent → 3 bits per axis → 8 states per axis → **8 × 8 = 64 combinations**.

The **2-adic valuation** (ruler sequence) assigns priority to each line position:
- Position 1: priority 0 (1 is odd)
- Position 2: priority 1 (2 = 2¹, highest — the "senior" line)
- Position 3: priority 0 (3 is odd)

**Encoding:** a 3-bit number (0–7) where bit 0 → line at position 1, bit 1 → line at position 2, bit 2 → line at position 3.

**Visual indicators:** Each line's start is marked with a **solid dot** (line present) or **hollow dot** (line absent). This shows the initial state at a glance.

**Layout:** 64 glyphs displayed as 8 rows × 8 columns. Rows indexed by down-code (0–7), columns by right-code (0–7).

---

## Step 2 — Implement the seniority interruption rendering

**Tie-breaking rule (this grid): Vertical lines win ties.**

When a vertical and horizontal interior line both cross at an intersection:
- Compare their priorities (2-adic valuation of their position)
- The **higher-priority** line passes through uninterrupted
- The **lower-priority** line breaks (stops) at the intersection
- **Equal priority → vertical (down-arrow) wins** — the vertical passes through, the horizontal breaks

For each cell (down_code, right_code):
1. Parse which 3 vertical lines are present (from down_code bits)
2. Parse which 3 horizontal lines are present (from right_code bits)
3. For each of the 9 potential intersections (3×3 grid):
   - If only one line present: draw it through
   - If both present: senior line passes through, junior line breaks into segments on either side of the intersection
   - Equal priority: vertical wins (this grid variant)
4. Draw solid dot at line start for present lines, hollow dot for absent lines

Render each glyph on a small canvas with:
- Outer square border (always drawn — the 4×4 boundary)
- Interior lines with correct interruptions
- Dots at line entry points indicating state
- Clean monochrome: black lines on white

---

## Step 3 — Build the 8×8 grid page

Structure:
- `BASE_PATH = '../'` variable at top of script for future promotion
- Breadcrumb linking back to `../` (Coylean Map root)
- Title: "Coylean Glyphs — 4×4 Section Catalog"
- Brief explanation of the encoding and seniority rules
- 8×8 grid:
  - Column headers: right-code 0–7 with binary (e.g. "5 = 101")
  - Row headers: down-code 0–7 with binary
  - Each cell: small canvas glyph + label
- All rendering via HTML5 Canvas, no external dependencies
- Clean monochrome aesthetic consistent with technical/mathematical documentation

Implementation:
- Single self-contained `glyphs/index.html`
- `drawGlyph(canvas, downCode, rightCode)` shared renderer
- Generate all 64 canvases on page load

---

## Step 4 — Note the horizontal-seniority variant (Step 1a from prompt)

Below the first grid, add a note:

> *"A second set of 64 glyphs exists where horizontal lines win ties instead of vertical. This horizontal-seniority variant will be added in a later step."*

Placeholder only for now — no second grid yet.

---

## Step 5 — D4 symmetry classification

The dihedral group D4 has 8 elements acting on a square:
- **e**: identity
- **r**: 90° rotation
- **r²**: 180° rotation
- **r³**: 270° rotation
- **s_h**: reflect across horizontal axis
- **s_v**: reflect across vertical axis
- **s_d1**: reflect across main diagonal (↘)
- **s_d2**: reflect across anti-diagonal (↙)

Each symmetry transforms a (down_code, right_code) pair:

| Symmetry | Effect on (down, right) codes |
|----------|-------------------------------|
| e        | (down, right) → (down, right) |
| r (90°)  | (down, right) → (right, reverse(down)) |
| r² (180°)| (down, right) → (reverse(down), reverse(right)) |
| r³ (270°)| (down, right) → (reverse(right), down) |
| s_h      | (down, right) → (reverse(down), right) |
| s_v      | (down, right) → (down, reverse(right)) |
| s_d1     | (down, right) → (right, down) |
| s_d2     | (down, right) → (reverse(right), reverse(down)) |

Where `reverse(code)` flips bit 0 ↔ bit 2, bit 1 stays (mirror the 3 lines about center).

Implementation:
1. Write the 8 transformation functions on (down, right) pairs
2. For each of 64 combinations, compute its full D4 orbit (up to 8 images)
3. Group into equivalence classes; pick lexicographically smallest as canonical rep
4. For each class, find the stabilizer subgroup (which of the 8 symmetries fix the rep)
5. Name the stabilizer: trivial (|orbit|=8), Z₂ (|orbit|=4), Z₄ (|orbit|=2), D₂ (|orbit|=2), D₄ (|orbit|=1), etc.

Display as a second section:
- Title: "Equivalence Classes under D4"
- Show each canonical representative glyph
- Annotate with: symmetry group name, orbit size, list of equivalent (down, right) codes

---

## Step 6 — Polish and style

- Consistent monochrome aesthetic (white bg, black lines, gray labels/borders)
- Favicon from `../map-icon.png`
- Breadcrumb navigation back to root
- Brief mathematical explanation text between sections
- Responsive — grid scrolls horizontally on narrow screens if needed

---

## Execution order

| # | What | Dependencies |
|---|------|-------------|
| 1 | Scaffold HTML + styles + breadcrumb | None |
| 2 | `drawGlyph()` renderer with seniority interruption + dots | Step 1 encoding |
| 3 | Generate 8×8 grid, wire up 64 canvases | Step 2 renderer |
| 4 | Add horizontal-seniority placeholder note | Step 3 grid |
| 5 | D4 orbit computation + equivalence class grouping | Step 2 renderer |
| 6 | Equivalence class display section | Steps 3 + 5 |
| 7 | Polish, test, verify | All |
