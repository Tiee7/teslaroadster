# Map 2 street scale and foreground time — 2026-10-21

## Scope
- Baseline: published main `907a7029925d70ac1ebcd3e4e766767d599739e3`.
- Independent branch/workspace; no attempt to reconstruct the unavailable Map 3 sixth-round tree.
- The entire `src/coast-map.js` is byte-identical to the published fifth-round art.
- Every shared/highway `world.js` byte outside `buildOpenWorldCity()` is unchanged. The original coast collision prefix remains pinned; an additional explicit city revision boundary preserves the rest of the world.
- The numerical projection epoch changes only the city-layout constant segment. Highway handling/traffic arithmetic and the coast module are unchanged; all identity/mutation guards remain enabled with the new reviewed source hashes.

## Time and presentation
- City manual physics uses bounded 1/60 s ticks and retains fractional time. Foreground 10/15 fps frames receive six/four physical ticks; no 50 ms remainder is discarded.
- Blur/hidden pages/menus, resets and a >1 s suspended frame discard paused debt, not normal 10/15 fps elapsed time. Extreme stalls are treated as pauses, not an unbounded catch-up loop. No single physics tick exceeds 1/60 s.
- Physics contact, scoring and passenger swept-arrival checks run per tick. Main camera/HUD/cockpit canvas/overlay presentation runs only on the final tick, with the combined presentation interval. Passenger navigation has one separate presentation per render.
- Tests compare cruise, acceleration, braking, boost and flight against the exact 60 Hz production-motion oracle at 10/15/20/30/60/144 rendered fps. Separate integration checks retain the previous map 1/3 and Autopilot branches.
- This is not render interpolation or a claim that a slow phone renders at 60 fps.

## Geometry and rendering work
- 21 m road = six 3.5 m lanes; dividers, crosswalks, NPC centres, player reset and 6.5 m passenger nodes use the same constants.
- The same 128 towers retain dimensions/details, moving to opposite block corners with 6 m frontage setbacks. Real building collision boxes follow their mesh poses; legal avenues and all 49 taxi nodes/routes are checked against expanded collision bounds.
- Original bridge pair eligibility is retained using the prior layout coordinates, so only two bridges remain after repositioning.
- The new 21 m paint positions are batched without additional repositioning by the batch transform: 7,616 lane dashes and 686 crosswalk bars become two instance meshes.
- `layout-before-after.json`: actual official Three r128 scene graphs, 10,175→1,903 mesh objects, 128 shadow-casting boxes unchanged, 0 extra lights, 2 bridges unchanged. Triangles 55,354→55,410; batching reduces submissions, not visible detail.
- Reproduce: `node verification/map2-street-scale/measure-layout.mjs` with the exact official runtime supplied through `ROADSTER_THREE_RUNTIME` or `/tmp/roadster-three.min.js`. The script reads the real baseline Git commit, never guesses an absent source tree.

## Verification boundaries
- CPU scene graph, mesh transforms, collision/navigation/arrival, source-identity and fixed-clock behavior are inspectable here.
- No new WebGL or mobile touch/FPS acceptance is claimed; the previously unavailable cloud WebGL path was not retried or bypassed.
- Final aggregate results are recorded only after the corresponding command finishes successfully.
