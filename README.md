# Coylean Map Maker

A fractal pattern generator that creates "Coylean Maps" — geometric patterns produced by recursively subdividing a square with vertical and horizontal lines. Lines stop and continue where they meet perpendicular lines, producing self-similar fractal structures.

This pattern was discovered in late 1970 by Jeff Coyle while exploring the four color theorum. I was fascinated by a method of drawing maps by drawing a continuous self intersecting curve and alternatively drawing and lifting the pen. I became very interested doing this in a square and called it a Coylean Square. An avid reader of Martin Gardner's Scientific American's Mathematical Games, I had dreams that I found something important. I originally explored it by increasingly detailed drawings on graph paper.  This physical attempt is enshrined and an SX70 photograph from 1975. My first computer implementation was on my buddy's Commodore PET using it's character set. Then I got an Apple II in 1978 programmed it in 6502 assembler. Over the years, it became my "Hello World" for learning the basic graphing commands on new computers and languages. Java applets in the web. C#/.NET in Windows. An Android app in Java. My best effort so far was the Coylean Explorer which was on my web site (and Github), in 2022 after I retired. With the advent of Claude Code, I am managing to bring all my ideas together in this project. As my friend Curt said, when he saw the site: Screams Coyle!

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
