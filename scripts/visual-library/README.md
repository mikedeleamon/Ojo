# Visual library pipeline

Offline tooling for the Instagram-story loops: short videos of the app's own
weather backdrop, one per look it can show. Everything here runs once on a Mac;
the app only downloads the results from R2 and caches them. Background and
decisions: `docs/prerendered-visuals-plan.md` (Phase 0). The app-side contract
lives in `src/lib/visualLibrary/`.

**Nothing is generated or imitated.** The loops are the app's own backdrop,
rendered offline:
- `export_data.ts` runs the app's own `gradientFor()` and `backdropLayersFor()`
  for every look in `src/lib/visualLibrary/looks.ts`, and copies every particle
  number out of `src/lib/weather/backdropSpec.ts`;
- `render_loops.py` draws them with the same rules as the components:
  - rain and lightning, from `StormIconLightning`;
  - stars, from `ClearNightIconMoon`;
  - the shooting star, from `ShootingStar` (one per loop, at a fixed time);
  - sun glare, from `SunGlare`;
  - snow and ice pellets, from `FlakeFall`;
  - fog, from `FogDrift`.

If you change how a backdrop looks in the app, re-run the pipeline and
re-publish. The stories then follow automatically.

Nothing at build time depends on this folder. `work/` holds every generated
file and is gitignored. The only output that gets committed is
`src/lib/visualLibrary/manifest.json`, written by the publish step.

## Prerequisites

| Tool | For | Install |
|---|---|---|
| ffmpeg | encoding the loops | `brew install ffmpeg` |
| numpy, Pillow | rendering | already in the Anaconda Python |
| tsx | step 1 | root devDependency (`npm install`) |

## Steps

Run from the repo root unless noted.

```bash
# 1. Export the app's looks, gradients, particle specs and recap timing
npx tsx scripts/visual-library/export_data.ts

# 2. Render every loop: 23 looks + the Weekly Recap, about 15 minutes
python3 scripts/visual-library/build_dist.py
#    just some:  --looks snow,sky.sunset      only the recap:  --only recap

# 3. Publish (from server/). Dry run first, then --upload
cd server
npx ts-node src/scripts/publishVisualLibrary.ts
npx ts-node src/scripts/publishVisualLibrary.ts --upload
```

To look at a few frames without ffmpeg:

```bash
python3 scripts/visual-library/render_loops.py --look sky.clearNight --frames-only --out /tmp/vl
python3 scripts/visual-library/render_recap_loop.py --frames-only --out /tmp/vl
```

## Checking a look in the app

`EXPO_PUBLIC_DEV_CONDITION` forces the condition the home-screen backdrop draws,
in dev builds only (`src/lib/debug/devWeatherOverride.ts`). It works with any
condition text, for example `Snow`, `Sleet` or `Fog`:

```bash
EXPO_PUBLIC_DEV_CONDITION=Snow EXPO_PUBLIC_DEV_IS_DAY=false npx expo start --clear
```

## Before publishing

- **Check which bucket the R2 credentials point at.** The repo-root `.env` is the
  dev environment. The library has to land in the bucket production serves from.
- **Set the app's base URL.** `--upload` prints the `EXPO_PUBLIC_LIBRARY_BASE_URL`
  value to set in `.env` and in `eas.json`'s `preview` and `production` env blocks.
  Until it's set, the app shows today's fallbacks.
- **Publish complete or not at all.** The publish script refuses an incomplete
  library: the app's manifest test only accepts "empty" or "complete".
