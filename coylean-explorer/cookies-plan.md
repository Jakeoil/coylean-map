# Formalizing persistence for Basic Propagation and Universe-Quadrants

## Current state

Neither page persists anything. Every reload resets all controls to the values
hard-coded in the HTML.

## State inventory

Shared between both pages:
- `seniority` (Vertical / Horizontal)
- `hInitCol`, `vInitRow`
- Display toggles: `tog-labels`, `tog-arrows`, `tog-pri`, `tog-minimize`,
  `tog-encroach`, `tog-fill`, `tog-borders`

Basic-Propagation only:
- `numRows`, `numCols`
- `init-mode` (Show / Set)
- `initDown`, `initRight` (hex strings)

Universe-Quadrants only:
- `mode` (Range / Extents)
- `view` (Mosaic / ...)
- `minRow`, `maxRow`, `minCol`, `maxCol`
- `northExtent`, `southExtent`, `westExtent`, `eastExtent`

## Conceptual layers

Every control on either page falls into one of four layers:

1. **algorithm** — math inputs that determine the propagation result
   (seniority, seed location). Identical shape on both pages.
2. **view** — what region of the (potentially infinite) map is being shown,
   and at what scale. Page-specific shape, since Basic uses a fixed-size
   grid and Universe uses a windowed view of the infinite map.
3. **init** — values for individual diamonds along the boundary / seed.
   Basic exposes per-bit editing of the init row and column; Universe
   uses an implicit seed (`d[0]=true` for V, `r[0]=true` for H) and so
   has nothing to store here.
4. **display** — rendering toggles that apply to the whole canvas
   (labels, arrows, priority, minimize, encroach, fill, borders).
   Identical shape on both pages.

## JSON structure

Top-level keys are the same on both pages so the helper, the diff, and the
mental model stay uniform. The contents of each subtree are page-specific
where the underlying concept differs.

### Basic Propagation — `coylean.basic-propagation.v1`

```json
{
  "version": 1,
  "algorithm": {
    "seniority": "vertical",
    "hInitCol": 1,
    "vInitRow": 1
  },
  "view": {
    "numRows": 4,
    "numCols": 4
  },
  "init": {
    "mode": "show",
    "initDown":  "0x...",
    "initRight": "0x..."
  },
  "display": {
    "labels":   true,
    "arrows":   true,
    "priority": false,
    "minimize": false,
    "encroach": false,
    "fill":     true,
    "borders":  false
  }
}
```

### Universe-Quadrants — `coylean.universe-quadrants.v1`

```json
{
  "version": 1,
  "algorithm": {
    "seniority": "vertical",
    "hInitCol": 1,
    "vInitRow": 1
  },
  "view": {
    "mode":  "range",
    "style": "mosaic",
    "range": {
      "minRow": -6, "maxRow": 10,
      "minCol": -6, "maxCol": 10
    },
    "extents": {
      "north": 8, "south": 8, "west": 8, "east": 8
    }
  },
  "init": {},
  "display": {
    "labels":   false,
    "arrows":   true,
    "priority": false,
    "minimize": false,
    "encroach": false,
    "fill":     true,
    "borders":  false
  }
}
```

### Notes on the shape

- `algorithm` and `display` are byte-identical in shape across pages. A
  future "global preferences" key could lift `display` out and share it,
  but that's a later call (see "Per-page vs shared state" below).
- `view.mode` on Universe selects which of `view.range` / `view.extents`
  is the active source; both are kept persisted so toggling between them
  doesn't lose values.
- `init.mode` on Basic is the editor mode (Show vs Set), not init data
  itself — it lives under `init` because it governs how the user
  interacts with init values.
- `init: {}` on Universe is intentional: the seed is implicit. Keeping
  the empty object preserves the four-layer shape so a generic
  inspector / diff renders both pages the same way.

## Recommendation

Use `localStorage`, one versioned key per page, holding a JSON blob:

- `coylean.basic-propagation.v1`
- `coylean.universe-quadrants.v1`

A small shared helper exposes `load(defaults)` and `save(partial)`. Each
control's change handler writes its slice; the page's init code reads the blob
once at startup, applies it to the DOM controls, then runs its existing render
pipeline.

Why not cookies: cookies ride on every request to the server, have a tiny size
budget, and need string encoding. None of that is useful here — this is purely
client-side UI state. `localStorage` is the right primitive.

## Schema versioning

Bump the version suffix (`v1` → `v2`) whenever a control is renamed,
removed, or its semantic meaning changes. On load, if the stored version
doesn't match, discard the blob and fall back to defaults rather than
silently misinterpreting old values. (Migrations can be added later if a
specific version bump warrants preserving user state — but defaulting to
"discard on mismatch" is the safe baseline.)

## Save granularity

Save on `change`, not `input`. Spinning a number input fires `input` on every
intermediate value; `change` only fires on commit (blur or Enter). For
buttons / toggles, save in the same handler that flips the active class.

## Per-page vs shared state

Resist the urge to share the keys across pages, even for state that exists on
both pages (seniority, hInitCol, etc.). Treat each page's blob as
self-contained. Two reasons:
1. The two pages may diverge — e.g. Universe might want a different default
   seniority than Basic.
2. Cross-page coupling makes the schema-version story messier (a v2 bump on
   one page would need to consider the other).

If a "global preferences" concept emerges later (e.g. a theme), introduce a
separate `coylean.global.v1` key then.

## Shareability (deferred)

`localStorage` is invisible and not shareable. If shareable links become
desirable later:
- Keep `localStorage` as the source of truth.
- Add a "copy link" button that serializes the same blob into the URL hash.
- On load, if a hash blob is present, prefer it over `localStorage` and write
  it back so the link "imports" the state.

This keeps the everyday path (just-reload-the-page) cheap, and makes
shareability an explicit user action rather than always-on URL clutter.

## Suggested rollout

1. Write the helper (`src/app/persist.js` or similar): `load(key, defaults)`,
   `save(key, partial)`. Single file, ~30 lines.
2. Wire it into Basic Propagation first. All controls listed above.
3. Validate the feel: reload the page mid-edit, confirm everything restores.
4. Apply the same pattern to Universe-Quadrants.
5. (Later, if wanted) Add the URL-hash share button.

## Open questions

- Should `info` panel hover state persist? Probably no — it's transient by
  design.
- Should pan/zoom of the SVG viewport persist? Worth deciding; if yes, it
  belongs in the same blob under a `viewport` sub-object.
- Do we want a "Reset to defaults" button visible on each page? Cheap to add
  and answers the "how do I get out of a weird state" question.
