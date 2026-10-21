# Independent frozen eeddf7d verification

Commit: `eeddf7d93c0e21d492b0ba2e3b4d9732ec61d19d`. Source read exclusively via `git show`. No repository edits/check/build/bundle/publish. Genuine Three.js r128 objects were used for scene budgets. No WebGL renderer, GPU/FPS measurement or device thermal test.

## Finding requiring a small fix

**P2: paused canvas resize does not invalidate the render gate.** `src/physics-main.js:2413–2418` calls `renderer.setSize` and camera projection update, but neither `openWorldRenderMap` nor `openWorldRenderActive` changes. After the pause transition was drawn, `animate` only redraws for physics steps, changed map, or changed active state (`2390,2398`). Resizing a paused city/coast consequently gets no color pass until another state transition resumes rendering. A real canvas drawing buffer is reset on resize; the CPU test uses a renderer stub explicitly modeling that reset, rather than claiming an observed browser screenshot.

`resize-repro.json` executes the exact committed resize listener and animate body. Both maps have **0 redraws** across 144 subsequent paused RAFs. An **in-memory-only** candidate adding `openWorldRenderMap=null` after the resize produces exactly **1 redraw** and then remains idle. This is the recommended minimal fix. Consider the same invalidation contract for WebGL context restoration if adding graphics-interruption coverage.

## Passed checks

`verify.mjs` executes committed production animate/clock/input/audio class plus the genuine movement kernel and coast support queries. Rendering, downstream HUD/camera/traffic meshes and audio hardware are stubbed. All assertions complete and data is in `results.json`.

- City/coast × 10/15/30/60/144 RAF, 3 wall-time seconds: **180 physical steps, 3 simulation seconds, 166.6667 m at 200 km/h**, 180 passenger physical ticks at every RAF rate.
- At 144 RAF: **432 fresh audio updates, 180 expensive motion presentations, 181 color passes** (one initial map/state transition plus 180 fixed-step frames). Other rates have one color pass per RAF. Zero-step RAFs still receive immediate fresh throttle release and SFX mute without extra physics or color pass.
- 40 nonlinear cases (city/coast × acceleration/brake/boost/flight × five RAF rates): x/y/z/vx/vy/vz/speed/airRemaining match the identical 60 Hz step sequence within 1e−8.
- Map selector/help/ranked/music/blur/hidden/1.5 s suspended frame: no paused physics or fuel changes, one pause-state render, no stale boost after resume, no catch-up of paused time.
- Blur and hidden events mute immediately without needing another RAF. A suspended AudioContext is not resumed while inactive or on the first zero-step wake RAF. After an active physical step, ordinary engine audio may resume the context via the unchanged existing audio update; this is expected foreground behavior.
- Highway/autopilot still routes stepping through its existing advanceFrame owner (3 stubbed owned substeps → 3 sound updates → 1 color pass), rather than through the city/coast fixed clock.
- Returning to city/coast while paused forces a new map view even before the first fixed step. Highway still renders every RAF.
- Exact world renderer initialization prefix with a recording renderer confirms desktop DPR cap **1.5**, coarse-pointer cap **1.25**, never raising smaller native DPR, `powerPreference:'default'`.

## Actual r128 coast scene budget

- **83 batches, 153,958 actual/max triangles**, 30 shadow-casting batches / 75,158 actual/max shadow triangles.
- 248 permanent ground-floor entrance reveals, 94 permanent low-detail palm crowns; no near pool or distance-dependent refresh.
- Move focus from spawn to (900,−700) and tick 60 times: same budget; only `coast-wheel-cabins` instance buffer version changes. No palm/reveal upload or disappearing LOD.
- 41 owned geometries; 4,371,088 geometry-buffer bytes; 703,836 instance-buffer bytes; 1,256,107 sampled texture-level estimated bytes.
- Clear-day private lighting: hemisphere **0.58**, key **1.0**, road environment contribution **0.15**. This verifies parameters, not subjective brightness.

## Actual committed CPU paths

`cpu-results.json`, Node24 genuine r128, 3 rounds, 300 movement/structure iterations or 1,000 support calls; CPU-only and container-load dependent:

| Path | 17dda06f median ms | Actual eeddf7d median ms |
|---|---:|---:|
| Structure sweep | 5.223 | 0.044 |
| Support | 0.086 | 0.014 |
| Movement kernel | 7.177 | 0.265 |

The movement slice includes genuine support/collision/terrain logic but excludes later traffic/HUD/camera/WebGL costs. The change demonstrates targeted CPU work reduction, not a prediction of end-user FPS or thermal improvement.
