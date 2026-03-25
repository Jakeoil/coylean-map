# Coylean Map Maker

An Android app that generates fractal geometric patterns called "Coylean Maps." These patterns are created by recursively subdividing a square with vertical and horizontal lines that stop and continue where they meet perpendicular lines, producing self-similar fractal structures.

Based on a pattern originally discovered by Jeff Coyle in the early 1970s. Previously implemented on Commodore PET, Apple II, and C#/.NET.

## Features

- **Two rendering modes:**
  - **Simple** — black lines on white background
  - **Elaborate** — multi-layered fractal rendering with a 19-color palette showing recursive depth
- **Touch navigation** — pan across the generated fractal map
- **Background music** — looping MIDI playback that persists across screens
- **Settings** — complexity preference via PreferenceActivity

## Screens

| Screen | Description |
|--------|-------------|
| Main Menu | Continue, New Map, About, Exit |
| Map View | Full-screen fractal rendering with touch panning (SurfaceView + threaded rendering) |
| About | History of Coylean Maps and app background |
| Settings | Complexity toggle |

## Tech Stack

- **Language:** Java
- **Min SDK:** 7
- **Rendering:** SurfaceView with background thread (CoyleanThread)
- **Audio:** MediaPlayer with MIDI
- **UI:** Standard Android layouts + custom SurfaceView

## Project Structure

```
Coylean/
├── src/com/jakeoil/coylean/map/
│   ├── CoyleanSquares.java      # Main menu activity (launcher)
│   ├── Map.java                 # Map display activity
│   ├── CoyleanSurfaceView.java  # Threaded fractal renderer (active)
│   ├── CoyleanView.java         # Canvas-based renderer (legacy)
│   ├── About.java               # About screen
│   ├── Prefs.java               # Settings activity
│   └── Music.java               # Background music utility
├── res/
│   ├── layout/                  # main.xml, about.xml
│   ├── menu/                    # menu.xml, view_menu.xml
│   ├── xml/settings.xml         # Preference definitions
│   ├── raw/quartet.mid          # Background music
│   └── values/                  # strings, colors, arrays
└── AndroidManifest.xml
```

## How the Algorithm Works

1. A priority function measures how "even" each grid position is by counting factors of 2
2. Two boolean arrays (`downArrows`, `rightArrows`) track where subdivision lines exist
3. Lines are drawn based on priority thresholds, creating the recursive fractal pattern
4. In Elaborate mode, nested rectangles are color-coded by depth level across 19 colors

## Building

Import the project into Android Studio or build via Gradle:

```bash
./gradlew assembleDebug
```

## Status

The app is largely functional (~80% complete). Main gaps:
- "Continue" button doesn't restore saved maps
- View menu scale/depth controls are defined but not wired up
- Preferences screen isn't fully integrated into map generation
- Contains some legacy/commented-out code (CoyleanView)
