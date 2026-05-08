Make a plan for this
I have a single Coylean propagation object.

I also have a replacement init row or replacement init column.

I want to make a new propagation by doing this:

1. Start from the existing propagation.
2. Replace only the specified init row or init column.
3. Use the unchanged paired init boundary from the original propagation.
    - If replacing the init column, keep the original init row.
    - If replacing the init row, keep the original init column.
4. Build the split universe from these two boundaries.
    - This is a two-piece/two-half universe, not a four-quadrant universe.
5. Re-integrate that split universe back into a propagation.
6. Return the new propagation.

Please implement a routine like:

```js
function replacePropagationInitBoundary({
    propagation,
    replacement,
    boundaryKind, // "row" or "column"
}) {
    // returns newPropagation
}
```

Important constraints:

- This is an operation on the propagation only.
- Do not start from a completed four-quadrant universe.
- Do not rebuild unrelated quadrants.
- Treat the universe as a temporary split/intermediate object.
- Preserve the propagation’s existing hInitCol/vInitRow and geometry conventions.
- Use the existing “make split universe” and “integrate universe into propagation” pipeline.
- Do not rewrite the architecture.

# Claudes Response

⏺ I've read enough to know the tools. Before I write code, I want to make sure I understand the geometry — the "two-half universe" step is the part where I'm uncertain. Let me lay out my reading and ask one focused question.

What I understand so far:

- Propagation has initDown (top row, length numColumns) and initRight (left column, length numRows). I assume "init row" = initDown, "init column" = initRight.

# Me

this line

> Replace only the specified init row or init column.

Is unfortunate. Don't confuse it with vInitRow and hInitCol
It should read:

> Replace only the specified initDown row or initRight column

```
{
	initDown, // boolean row of downs.
	initRight, // boolean column of rights
	hInitCol, // horizontal priority offset longitude (meridian) of the column
	vInitRow, // vertical priority offset latitude (parallel) the 1st row
	seniority, // vertical or horizontal
}

```

# Claude

- Universe.fromPropagations({nw, ne, sw, se, ...}) just bundles four quadrants (any can be null) with extents offsets.

- Propagation.fromUniverseBoundary(universe) reads the universe's far-N row + far-W column and runs them as the seed of a fresh SE-flowing propagation spanning the whole rectangle.  
  With only two quadrants set, it falls back to half-axis sources (e.g., sw+se → far-N collapses to origin row from S quadrants).

Where I'm not sure — what does "split universe" mean here geometrically?

# me

North extent zero just means sw and se is created, progagating from the southern extent.
West extent zero just means ne and se is created, propagating from the new eastern extent

# claude

Two interpretations:

(A) Same-direction half. Place the original (presumably an SE-flowing quadrant with user-facing hInitCol/vInitRow) at se. Build a sibling at sw (or ne) so that one shared axis carries the replacement and the other half-axis carries the kept original boundary. Then
`fromUniverseBoundary` returns a wider/taller integrated propagation.

(B) Reverse-direction half. The split places the original on one side of an axis and a freshly-computed mirror partner on the other side, where the central shared axis between them IS the replacement, and the kept paired boundary is the partner's outer init.  
 `fromUniverseBoundary` then reads the far edges to recover an integrated propagation of the
same shape as the original.

> Me (B) is correct

My concrete question: when replacing the init row:

1. Which two of {nw, ne, sw, se} are non-null?

    > Me: By that you mean a row of downs: ne and se are non-null

2. Among {westInitDown, eastInitDown, northInitRight, southInitRight} (the four shared half-axes of createUniverseExtents), which one is the replacement, and which is the kept paired boundary?
    > Me: There will only be pairs. The south pair or the east pair. From the instructions:

> 3.  Use the unchanged paired init boundary from the original propagation.
>
> - If replacing the init column, keep the original init row.
> - If replacing the init row, keep the original init column.
>
> 4.  Build the split universe from these two boundaries.

3. Should the new propagation have the same shape (numRows × numColumns) as the original, or
   a different shape (e.g. doubled along one axis)?
    > Me:Yes

Once I have that, the implementation is straightforward — split the replacement and the kept array into the appropriate half-axis arrays, hand them to `Universe.fromPropagations`, and call `Propagation.fromUniverseBoundary`.

# Claude's Plan

## Vocabulary fix

`initDown` = "init row" (boolean row of downs, length `numColumns`).
`initRight` = "init column" (boolean column of rights, length `numRows`).
`hInitCol`, `vInitRow` are priority offsets — unrelated.

## Geometry I now think you want (interpretation B)

**Replacing `initDown`** (boundaryKind === "row"):

- 2-half universe = `{ ne, se }`, with `nw = sw = null`.
- `westExtent = 0`, `eastExtent = propagation.numColumns`.
- `northExtent + southExtent = propagation.numRows`.
- Shared axis between `ne` and `se` is `eastInitDown` ⇐ **`replacement`**.
- The kept paired boundary is `propagation.initRight`. It runs N→S along the central
  vertical axis, so it splits into `northInitRight` (top portion, fed to `ne` —
  which stores it in S→N order, so reversed) and `southInitRight` (bottom portion,
  fed to `se` directly).
- `Propagation.fromUniverseBoundary({ne, se})` then:
    - reads `initRight = ne.initRight.reverse() ++ se.initRight = propagation.initRight` (recovered intact);
    - reads `initDown = ne.resultDown` — the replacement propagated _northward_ through `ne`, becoming the new far-N row of the integrated propagation.

**Replacing `initRight`** (boundaryKind === "column"): mirror-symmetric.

- 2-half universe = `{ sw, se }`, with `nw = ne = null`.
- `northExtent = 0`, `southExtent = propagation.numRows`.
- `westExtent + eastExtent = propagation.numColumns`.
- Shared axis = `southInitRight` ⇐ **`replacement`**.
- Kept `propagation.initDown` splits into `westInitDown` (left portion, reversed for `sw`) and `eastInitDown` (right portion, into `se`).
- Integrated: `initDown` recovered as the kept original; `initRight = sw.resultRight` is the replacement propagated westward through `sw`.

## Open questions before I implement

1. **How to split `numRows` into `northExtent + southExtent`** (and symmetrically for cols)?
   The split isn't determined by `propagation.hInitCol/vInitRow` alone — those are
   priority offsets, not a geometric origin marker.

> me forget replacePropagationInitBoundary, or rather improve. Reuse the existing Universe constructor to build a universe with existing logic, and > then integrate it into a propagation. This logic will take care of the h / v geometry logic and direction.

> I suggest a universe factory Universe.partition(propagation, downs, i). i splits rMatrix[0] into a northern and southern extent. Also, downs is >the new dMatrix[i] and the ne quadrant uses it to build ne and se.  
> A corresponding function with Universe.partition(propagation, rights, j), which dMatrix[0] becomes western >and eastern extent. So rights it the >new rMatrix[j] and the sw quadrant uses it to build sw and se.

> The stuff below looks like noise to me. Tell me if you undertand the partition idea.

# Me Let's try this again, see my suggestion above.

    Options:

- (a) Always split in half (`northExtent = floor(numRows/2)`).
- (b) Require the caller to pass the split, or stash it on `propagation` (e.g. a
  `metadata.northExtent`/`metadata.westExtent` left there by
  `fromUniverseBoundary` — which currently doesn't record this).
- (c) Recover it from `hInitCol`/`vInitRow`: an integrated propagation has
  `hInitCol = hInitCol_user - westExtent`, so if `hInitCol_user` is known
  (e.g. always 1 for the standard universe) we can solve `westExtent = 1 - hInitCol`. Same for `northExtent = 1 - vInitRow`. This requires assuming the user-facing offset is fixed.

My guess is (c) under the convention `hInitCol_user = vInitRow_user = 1` — please confirm or specify.

1. **Priority offsets on the two new quadrants** follow the standard
   `createUniverseExtents` rule:
    - `ne.hInitCol = hInitCol_user`, `ne.vInitRow = 1 - vInitRow_user`
    - `se.hInitCol = hInitCol_user`, `se.vInitRow = vInitRow_user`

    where `hInitCol_user, vInitRow_user` are recovered as in (1). Confirm?

2. **Seniority** carried through from `propagation.seniority`. Confirm?

3. **Shape preservation.** With the split above, the integrated propagation has
   exactly `numRows × numColumns` matching the original — answers your "Yes" to
   question 3.

4. **Mismatched `replacement` length.** Should I throw if
   `replacement.length !== propagation.numColumns` (row case) or `!== numRows`
   (column case)? Default: yes, throw.

## Sketch

```js
function replacePropagationInitBoundary({
    propagation,
    replacement,
    boundaryKind,
}) {
    const { numRows, numColumns, hInitCol, vInitRow, seniority } = propagation;
    // Recover user-facing offsets and the geometric split, per question (1)/(c).
    const hInitColUser = 1,
        vInitRowUser = 1; // assumed convention
    const westExtent = hInitColUser - hInitCol;
    const northExtent = vInitRowUser - vInitRow;
    const eastExtent = numColumns - westExtent;
    const southExtent = numRows - northExtent;

    if (boundaryKind === "row") {
        // length check on replacement: must equal numColumns
        // Build {ne, se} half-universe; share eastInitDown = replacement.
        // Split kept initRight into northInitRight (reversed top half) + southInitRight.
        // Universe.fromPropagations({ northExtent, southExtent, westExtent: 0, eastExtent, ... ne, se }).
    } else {
        // boundaryKind === "column": mirror — {sw, se}, share southInitRight = replacement.
    }
    return Propagation.fromUniverseBoundary(universe);
}
```

I'll fill in the constructor calls once you confirm the open questions — especially (1).

# Claude's Sketch v2 — `Universe.partition`

Yes, I understand the partition idea, and it's a much better factoring. The key
realization: the replacement is the new value for an **interior** axis line
(`dMatrix[i]` or `rMatrix[j]`), not for the boundary `dMatrix[0]`/`rMatrix[0]`.
The boundary array gets split at the partition index to seed the two halves'
outer inits. The Universe machinery already knows how to flip `hInitCol`/`vInitRow`
per quadrant, so we just hand it user-facing offsets straight off the input
propagation.

## Signatures

Two methods (or one with an axis discriminator — preference?):

```js
// Row-partition: cut horizontally at row j = i; ne and se share the new dMatrix[i].
Universe.partition(propagation, downs, i)   // i ∈ [1, numRows-1], downs.length === numColumns

// Col-partition: cut vertically at col i = j; sw and se share the new rMatrix[j].
Universe.partition(propagation, rights, j)  // j ∈ [1, numColumns-1], rights.length === numRows
```

JS has no overloading; if you want one name I'd dispatch on the length of the array
parameter (`downs.length === numColumns` vs `rights.length === numRows`) and throw
on ambiguity. Or two methods (`partitionRow` / `partitionCol`). Tell me which.

## Row-partition body

```js
static partition(propagation, downs, i) {
    const { numRows, numColumns, hInitCol, vInitRow, seniority, initRight } = propagation;
    if (i < 1 || i >= numRows) throw new Error("partition: i out of range");
    if (downs.length !== numColumns) throw new Error("partition: downs length mismatch");

    const northExtent = i;
    const southExtent = numRows - i;
    const westExtent  = 0;
    const eastExtent  = numColumns;

    // Shared central horizontal axis going E from origin — the perturbed row.
    const eastInitDown = Row.from([...downs]);

    // Split kept initRight at index i. Original is N→S; ne stores it
    // S→N (its local j=0 sits at origin), so reverse the top slice.
    const northInitRight = Col.from([...initRight.slice(0, i)].reverse());
    const southInitRight = Col.from([...initRight.slice(i)]);

    const { nw, ne, sw, se } = Universe.createUniverseExtents(
        northExtent, southExtent, westExtent, eastExtent,
        hInitCol, vInitRow, seniority,
        { eastInitDown, northInitRight, southInitRight },
    );
    return Universe.fromPropagations({
        northExtent, southExtent, westExtent, eastExtent,
        hInitCol, vInitRow, seniority,
        nw, ne, sw, se,
    });
}
```

## Col-partition body (mirror)

```js
static partition(propagation, rights, j) {
    const { numRows, numColumns, hInitCol, vInitRow, seniority, initDown } = propagation;
    if (j < 1 || j >= numColumns) throw new Error("partition: j out of range");
    if (rights.length !== numRows) throw new Error("partition: rights length mismatch");

    const northExtent = 0;
    const southExtent = numRows;
    const westExtent  = j;
    const eastExtent  = numColumns - j;

    // Shared central vertical axis going S from origin — the perturbed column.
    const southInitRight = Col.from([...rights]);

    // Split kept initDown at j. Original is W→E; sw stores it E→W from origin.
    const westInitDown = Row.from([...initDown.slice(0, j)].reverse());
    const eastInitDown = Row.from([...initDown.slice(j)]);

    const { nw, ne, sw, se } = Universe.createUniverseExtents(
        northExtent, southExtent, westExtent, eastExtent,
        hInitCol, vInitRow, seniority,
        { westInitDown, eastInitDown, southInitRight },
    );
    return Universe.fromPropagations({
        northExtent, southExtent, westExtent, eastExtent,
        hInitCol, vInitRow, seniority,
        nw, ne, sw, se,
    });
}
```

## Caller usage

```js
const universe = Universe.partition(propagation, perturbedRow, i);
const newPropagation = Propagation.fromUniverseBoundary(universe);
```

The new propagation has the same shape, identical `initRight` (recovered intact
from the split-and-restitch), and an `initDown` that is the perturbed `downs`
propagated *northward* through `ne` for `i` steps — i.e. the natural far-N row
implied by the perturbed central axis.

## Small confirmations before I write the code

1. **One method or two?** Default: two — `Universe.partition` for row, `Universe.partitionCol` for column. Or single dispatched. Your call.
2. **Edge cases `i = 0` or `i = numRows`** — these collapse one half to zero, which `createUniverseExtents` rejects ("Universe must contain at least one quadrant"). I'll throw with a clearer message; OK?
3. **Should `partition` itself return the integrated propagation** instead of the universe, since that's the only thing callers will do with it? Or keep the two-step (factory returns Universe; caller integrates) for symmetry with the rest of the API? I lean toward the two-step.

