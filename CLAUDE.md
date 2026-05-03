# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server with HMR
npm run build     # type-check then bundle (tsc -b && vite build)
npm run test      # run vitest (geometry unit tests)
npm run lint      # ESLint
npm run knip      # dead-code / unused-export detection
npm run precheck  # lint + knip + tsc (run before committing)
npm run preview   # preview production build locally
```

## Architecture

A cosplay photography masterclass tool for visualising how light modifier size, distance, surface distribution, and beam angle affect shadow softness, catchlights, and light falloff.

**Data flow:**

```
useState sliders (App.tsx)
  → calculateShadowModel() [src/lib/calculateShadowModel.ts]
      → geometry helpers  [src/lib/geometry.ts]
  → model object passed as props
      → RayDiagram        [canvas: 2-D ray diagram]
      → SubjectView       [aggregates the four readout panels]
          → CatchlightIndicator
          → FovVisualizer
          → SkinSoftness
          → ShadowWidths
          → Falloff
```

`App.tsx` holds all state and calls `calculateShadowModel` inside a `useMemo`. The result (`model`) is the single source of truth passed down. No context or global state.

**`calculateShadowModel`** decomposes the light source into 8 concentric rings with decreasing size (controlled by the `distribution` exponent). For each ring it: computes tangent lines from the ring edge to the subject sphere, determines umbra/penumbra/antumbra extents on the shadow wall, clips them against the beam cone, and accumulates perceptually-weighted sums. Returns a `Ring[]` array plus derived scalars (`effectiveFovRatio`, `textureDesc`, `falloffData`, etc.).

**Geometry helpers** (`src/lib/geometry.ts`, fully typed):

- `getTangents` — outer tangent points from a point to a circle
- `getIntersection` — line–line intersection (antumbra cross detection)
- `getWallY` — projects a ray onto the shadow wall at a given x

**`RayDiagram`** receives `model`, `size`, `dist`, `beamAngle`, and `exposure` (iso/10). It owns a `<canvas>` and redraws via `useEffect` when these change. All canvas drawing is raw 2-D context calls.

**Styling:** Tailwind v4 via `@tailwindcss/vite` (no separate config file). Custom `<style>` block in `App.tsx` for range-input track/thumb overrides. Dark theme throughout (`#1a1a1a` background).

**React Compiler** is enabled via `@rolldown/plugin-babel` + `babel-plugin-react-compiler` — avoid manual `useCallback`/`useMemo` optimisations that conflict with it.

**Tests** live in `src/lib/geometry.test.ts` (Vitest). Only the pure geometry helpers are unit-tested; canvas-drawing components are not.
