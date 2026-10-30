# Sandpile

Interactive sandpile explorer: drop sand on a grid, change the toppling rules, and watch the patterns form.

Live: https://andre-larsson.github.io/sandpile/

A cell holding too many grains topples and passes grains to its neighbours, which may topple in turn. The page lets you change the grid (square or hexagonal), how many grains go in each direction, the toppling threshold, and what happens to leftover grains. Presets cover the classic model, weighted and lopsided rules, the fill-and-settle identity pattern, and raining avalanches.

## Development

```bash
npm install
npm run dev
```

```bash
npm run build
```

```bash
npm run lint
```

Pushes to `main` build and deploy to GitHub Pages through `.github/workflows/pages.yml`.

## Code layout

- `src/sandpile.js`: the simulation engine (no React).
- `src/renderer.js`: canvas drawing, palettes and zoom.
- `src/controller.js`: ties the engine and renderer to the animation loop.
- `src/presets.js`: preset rules and starting piles.
- `src/App.jsx`, `src/RuleEditor.jsx`: the UI.
