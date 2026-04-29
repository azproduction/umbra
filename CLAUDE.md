# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server with HMR
npm run build     # type-check then bundle (tsc -b && vite build)
npm run lint      # ESLint
npm run preview   # preview production build locally
```

There is no test suite configured.

## Architecture

Single-component React app (`src/App.tsx`) — a cosplay photography masterclass tool for visualising how light modifier size, distance, surface distribution, and beam angle affect shadow softness, catchlights, and light falloff.

**State → model → canvases pipeline:**

1. Four `useState` sliders (`size`, `dist`, `distribution`, `beamAngle`) feed a `useMemo` that runs all geometry — tangent lines, umbra/antumbra/penumbra extents across 8 concentric rings, EV falloff curve, and perceptual weighting. The result is the `model` object.

2. Four `useEffect` hooks each own one `<canvas>` ref and re-draw whenever the relevant slice of `model` changes:
   - `mainCanvasRef` — 2-D ray diagram (light source → subject sphere → shadow wall)
   - `profileCanvasRef` — horizontal shadow width profile
   - `falloffCanvasRef` — relative EV values at 5 distances
   - `skinCanvasRef` — perceived skin softness texture

All canvas drawing is manual 2-D context calls; no drawing library is used.

**Key geometry helpers** (top of `App.tsx`, no explicit types):

- `getTangents` — outer tangent points from a point light to a circular occluder
- `getIntersection` — line–line intersection for antumbra cross detection
- `getWallY` — projects a ray onto the shadow wall

**Styling:** Tailwind utility classes via CDN (no config file). Custom `<style>` block in JSX for range-input track/thumb overrides. Dark theme throughout (`#1a1a1a` background).

**React Compiler** is enabled via `@rolldown/plugin-babel` + `babel-plugin-react-compiler` in `vite.config.ts` — avoid manual `useCallback`/`useMemo` optimisations that conflict with it.
