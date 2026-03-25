# Coylean Map Maker

A fractal pattern generator that creates "Coylean Maps" — geometric patterns produced by recursively subdividing a square with vertical and horizontal lines. Lines stop and continue where they meet perpendicular lines, producing self-similar fractal structures.

This pattern was discovered by Jeff Coyle in the early 1970s, originally drawn by hand, then implemented on Commodore PET, Apple II, and C#/.NET. This repo contains the Android app and a web port.

## Web App

The web version runs in any browser — no install needed.

**[Try it live on GitHub Pages](https://jakeoil.github.io/coylean-map/)**

Open `index.html` locally or deploy to GitHub Pages. Features:

- **Simple mode** — black fractal lines on white
- **Elaborate mode** — color-coded depth layers using a 19-color palette
- **Pan** — drag to explore the fractal
- **Depth/Scale controls** — adjust detail level and cell size in real time

## Android App

The original Android implementation lives in `Coylean/`. See [Coylean/README.md](Coylean/README.md) for details.

- Java, min SDK 7
- SurfaceView with threaded rendering
- Background MIDI music
- Touch panning

## How the Algorithm Works

1. A **priority function** counts how many times a grid position divides evenly by 2 (its "evenness")
2. Two boolean arrays (`downArrows`, `rightArrows`) propagate state across the grid
3. At each cell, the arrow with higher priority flips the other — this creates the recursive subdivision pattern
4. **Simple mode** draws the resulting grid lines; **Elaborate mode** fills nested rectangles color-coded by depth

## Running Locally

```bash
# Web — just open in a browser
open index.html

# Android — import Coylean/ into Android Studio
```
