# Diamond View

## What it is
The Coylean map rotated 45° so vertical segments render as `/` and horizontal segments as `\`, forming a diamond shape.

## Algorithm
Same as `coylean.js`:
- `d[0] = true`, all others false (single seed)
- `priority(i)` = 2-adic valuation (0-based)
- Vertical wins ties (`downPri >= rightPri`)
- Draw segment using PRE-XOR arrow value, then XOR-update

## Grid dimensions
Order n → M = 2^n + 1 cells per axis (d[0]..d[2^n]).

## Coordinate mapping (45° rotation)
Grid point (col, row) → display:
```
x_disp = MARGIN + (col - row + M) * CELL
y_disp = MARGIN + (col + row) * CELL
```

- `/` segment (vertical/down): from grid(x+1, y) to grid(x+1, y+1) — Δx=-CELL, Δy=+CELL
- `\` segment (horizontal/right): from grid(x, y+1) to grid(x+1, y+1) — Δx=+CELL, Δy=+CELL

Canvas size: `MARGIN*2 + M*2*CELL`

## Orders shown

| Order | N=2^n | M=N+1 | CELL | Canvas |
|-------|-------|-------|------|--------|
| 1     | 2     | 3     | 40px | 280px  |
| 2     | 4     | 5     | 24px | 280px  |
| 3     | 8     | 9     | 14px | 292px  |
| 4     | 16    | 17    | 8px  | 312px  |

## Checkerboard connection
The diagonal structure of the diamond view reveals two seniority classes:
- One diagonal (`\`, top-left→bottom-right) — cells where m+n is even
- Other diagonal (`/`, top-right→bottom-left) — cells where m+n is odd

The checkerboard is the limiting case at infinite iteration — maximum entropy, every intersection at finest resolution where seniority alternates maximally. The densest possible data: zero redundancy, knowing one cell tells you nothing about non-adjacent cells.
