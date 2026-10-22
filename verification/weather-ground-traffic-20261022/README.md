# Weather, Map 3 sampling and Map 1 traffic — 2026-10-22

Base: production `4451a11c9c09d031a9da037ce63afe4bb7f062e5`. Independent branch
`feat/weather-ground-traffic-20261022`. **Preview review only; no production release.**

## Requested changes

1. Visible weather/cycle order is **白天 / 黄昏 / 黑夜 / 雨夜**, default **黑夜**.
   Physical indices deliberately stay night0/rain1/dusk2/day3: rain handling and
   the strictly night-only numerical projection are not silently remapped.
2. Map 3 keeps its original synchronous 128px ground textures, pixels, metre UVs,
   mipmaps, geometry, materials, terrain and collisions. It adds only a ground
   sampler setting: `max(1, min(8, floor(renderer capability)))`, queried once at
   entry, with safe fallback1. There is no new streaming/LOD/scale trick.
3. Day switches off the two actual headlight SpotLights, including reset, map
   changes and cached menu model clones. Vehicle lamp meshes/materials are not
   recolored, hidden or rescaled. Other weather intensities remain unchanged.
4. Map 1 recycles expired blasted/out-of-bounds **NPCs**, not the player, into
   safe slots **95–415m behind**. Full admission waits hidden/inactive rather than
   overlapping traffic. The actual driving and destroyed-aftermath branches both
   recycle on the expiry frame. Complete-body buffered side exits and rotated
   long wrecks are covered. Behind birth/recycling cannot earn phantom passes.

Initial traffic population, personal driver speed distributions and all approved
vehicle asset modules are byte-for-byte unchanged. Rear-only recycling can thin
forward traffic when the player outruns NPCs; no covert front refill is added.
The admission cache shares only exact slot geometry, never another driver's
safety decision, and is checked against an independent uncached reference.

## Evidence and limits

- The user screenshot was inspected. Source builds all paving synchronously;
  there is no distance-triggered texture download. An isolated original-paver
  Mesa rasterization reproduces grazing-angle mip detail loss: at29.75m the
  joint's peak-to-peak luminance is0.0190 at aniso1 versus1.8023 at4/8. This supports
  a **sampling correction**, not a guarantee about every user-device symptom.
- `texture/` contains portable scripts, unchanged original-paver hashes and five
  exact pixel-replay cases, including bounded/unsupported capability facades.
  These are **software Mesa pixels, not a browser/full-scene/device-GPU/FPS test**.
- Regression tests cover original-pixel/UV/geometry/layout/byte-budget identity,
  single capability probing, UI order/default, actual player/menu headlights,
  real active/destroyed traffic excerpts, 30/60/144Hz,52-car safe admission,
  rotation, queue retry, pass latches and complete-property forecast equivalence.
- The current source-pinned numeric projection is explicitly regenerated.
  480 fixed-input CPU frames compare every control-physics value (including-0)
  and complete NPC data/visibility/admission flags. Blast/day reuse remains
  rejected. This is not full-page/planner/RNG equivalence.
- The original static projection assertions are reused via report-only I/O
  redirection:29 identity/build guards and3 mirror guards pass. Historical
  source epochs, fixtures and reports stay unchanged. `source-epoch.json` pins
  every current source, exact production baselines and all frozen vehicle assets.
- The previous neutral-white city instance-color repair and main-canvas
  context-loss safety guard remain unchanged.

## Explicit traffic-fixture transition

The first full run was1065/1066: only the old seed7 assertion `landings>=3`
failed. The complete current20s run had one safe3.2m hop, no impact, adequate
fuel and minimum warm speed228.75km/h; front traffic was empty after11s. Changing
**only** traffic reads back to frozen4451 restores five safe landings and every
original assertion. The old strict test is retained as an explicitly historical
traffic-pressure fixture. A separate current20s case keeps all physical safety
checks and verifies actual behind admissions/empty front; an additional current
two-initial-row unit proves paid landing,81 recharge frames and an ordinary safe
successor hop, without injecting cars ahead. This is a fixture-policy change,
**not a claimed physics bug fix** (`traffic-fixture-diagnosis.json`).

The untimed CPU oracle's execution cost is not a browser performance benchmark.
With a real monotonic clock, the current20s sample completes safely in27.91s;
the20ms cooperative planner budget is not a hard cap (planner p95=24.65ms,
max42.85ms). The old-forward timed counterfactual crashes at12.78s and therefore
does not complete1200 frames. Neither CPU harness includes full production
rendering/adapter/projection reuse; these results do not establish a production
regression or GPU/FPS acceptance (`bounded-planner-summary.json`).

## Re-run

```sh
python3 bundle_app.py
npm run check && npm run build
node --test --test-concurrency=2 tests/*.test.mjs
node verification/weather-ground-traffic-20261022/verify-projection-identity.mjs
node --test verification/demo-continuous/test-src-projection-mirror-identity-only.mjs
bash verification/weather-ground-traffic-20261022/texture/run-experiment.sh "$PWD" /tmp/roadster-paver-review
```

Native geometry tests use the already available official Three r128 runtime
(`ROADSTER_THREE_RUNTIME`, default `/tmp/roadster-three.min.js`). The texture replay
also requires the existing Mesa/EGL helper's dependencies. Final full-suite and
build results/digests are recorded in `regression-summary.json`.

## Preview acceptance

Open the new preview: confirm night by default; cycle the four choices; in Day,
check no headlight pool on the road after restarting/changing maps. In Map 3 Day,
drive the same route/view as the screenshot and compare the middle-distance
paving (tile sizes must not change). In Map 1, blasted/escaped NPCs must not
materialize ahead or inside another car. User-device appearance/motion remains
preview acceptance, not a claimed automated browser/GPU result.
