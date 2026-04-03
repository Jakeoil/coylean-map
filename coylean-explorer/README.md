# Coylean Map Explorer

An infinite tiling of rectangles on a plane created with simple rules.

The Coylean map uses a priority function based on powers of 2 to determine whether lines extend down or right at each grid intersection, producing a self-similar fractal-like pattern of rectangles.

## Running

Serve the directory with any static file server:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser.

## Controls

- **Map Type** — Toggle between Legacy and Explore modes
- **Size** — Adjust the grid size
- **Scale** — Zoom in/out
- **Horizontal/Vertical init** — Shift the starting column/row to explore different regions

## File Structure

- `index.html` — Main page with controls
- `coylean.js` — All application logic
- `math.css` — Shared stylesheet

## Author

Jeff Coyle
