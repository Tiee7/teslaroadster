# Coastal pier yaw and finite first-contact repair

Preview-only successor to `36ae0b5811e91e36f95d052543d798a581f88881`.
This is an independently reproduced bridge-column defect, **not a localization
or explanation of the original unavailable coastal ground-gap screenshot**.

## Actual model versus the old proxy

The original pier branch expanded a fixed world X±1.1/Z±2.31 box regardless of
yaw. At90 degrees it overblocks Z and underblocks X. The exact archived36ae
motion with unchanged damage reports5 false fatal contacts (27.54–28.13G) from
legal once-only supported initial positions and continuous W. No per-frame pose
assignment is used. One30Hz forward trial is negative, not silently discarded.
Six farther-lane controls and six moving-away controls do not collide.

The audit reconstructs the actual isolated production pier batch/instance and
79,257 actual drawRange/group/material-visible reference-car vertices, including
glass and the original resolved pitchSquat pose. At all5 false impacts, the
whole visible-model Z bounds remain0.5960–0.6018m clear of the actual pier.
The24 native box vertices agree with the logical column bounds to float32
precision. Six genuine head-on trials instead enter the real pier before the
old delayed contact. See `baseline-pier-yaw-reproduction.json` and the exact
baseline fixtures in `tests/fixtures/coast-pier-baseline/`.

This is native Three r128 CPU geometry/motion evidence, **not** shader, full-scene,
browser, display-pixel or user-device GPU proof. Materials are replaced only in
the isolated geometry audit, never in game source. Destruction presentation is
stubbed; the old fatal replay stops at its first impact.

## Minimal runtime scope

- Keep the existing1.1m half-width,2.31m half-length and1.25m caller height.
  Correct the yaw-oriented upright proxy; do not resize the approved car or claim
  a detailed628-mesh contact shape. Pitch/roll shape is not newly generalized.
- Finite pier contact uses five separating axes. Constant yaw uses exact linear
  intervals; changing yaw uses conservative feature travel and an interval
  certificate fallback, never treating iteration exhaustion as a clear path.
  World bounds and3.4m broadphase stay fixed. Contact tolerance is0.1 micrometre.
- Keep the original structure/translation phase and non-pier algorithms byte
  equal. Resolve only an actual pier in its detected yaw with a0.1mm local
  contact separation, not a player reset or teleport/rescue.
- Actual supported Space+A at30/60/144Hz proves that later yaw integration can
  enter a pier even when the earlier translation phase is clear. Add only that
  later same-XYZ yaw segment check. Do not repeat time/fuel integration or other
  structure phases. The signed closing feature drives real contact response;
  opening/zero-energy overlaps must not invoke the old minimum-damage floor.
- Retain original response coefficient1.25, damage function/cooldown/thresholds,
  driving forces and all non-coastal branches. No speed/density reduction,
  terrain/support/road-layout edit, weather/lighting/passenger change or asset edit.

The source epoch explicitly inherits the immutable36ae boundary epoch. Five
exact baseline sources remain archived; frozen historical assertions read those
archives rather than changing their expected hashes. Numeric projection source
and generator/program identity pins follow the authorized physics edit. Negative
guards reject stale geometry/physics/projection, missing late contact, unknown
modules and frozen asset/terrain/weather/traffic/taxi/diagnostic drift.

## Regression scope

The102 new unique cases are84 native/proxy contact cases,12 integration/order/
repeated-contact cases,5 exact-scope/negative guards and1 current broadphase
versus all-scan equivalence case. Focused repeats are not added to the count.

The contact cases include an independent materialized-corner polygon SAT oracle,
4096 temporal samples plus bisection (not the production swept formula),42
multi-angle30/60/144Hz forward/reverse paths, changing yaw/short arcs, diagonal
near-misses, all sides/corners, high-speed crossing, initial overlaps and actual
Space+A/D motion. Integration compares **every state field**, nested arrays,
input/fuel and return flags bit-exact on no-contact old/new land/air paths at
30/144Hz in clear/rain weather. Real simultaneous rail/pier/ceiling candidates
retain earliest-time ordering; low-speed repeated legitimate impacts preserve
cooldown, health, control and positive-energy-only damage requests.

The final combined result is1256 unique passes:1219 main +37 revised serial art.
The initial art batch was36/37: the original internal8KiB road-source guard had
only24B headroom and caught the new1428B gzip correctness-code increment. Keep
the unchanged32KiB art cap and exact archived8KiB road baseline; separately cap
new CCD increment at1536B and current network total at9728B. Negative numeric
boundaries and an actual measured entropy payload prove budget overflow fails.
The whole game grows7865 raw bytes/2293 gzip bytes, **not a performance gain**.
Only that existing test changed after the1219 main run; every runtime/generated/
game byte stayed identical. The94 followup source/projection/integration passes
are repeats, not extra unique cases or a claim of one all-green original batch.

`applicable-test-manifest.json` and `regression-summary.json` identify the final
exact-byte batches, retained initial failures and log hashes. The two art files
run serially. Twelve unchanged heavy highway planner files retain their earlier
combined baseline; this is not represented as a fresh complete planner/GPU run.

## Continuity and limits

Keep every earlier unique preview; create another from the verified commit.
Do not merge main or replace production. Models/materials/scales, coastal terrain,
bridge placement, four weather modes/default night/daytime lights-off,
single-passenger taxi, continuous highway front supply, incident-only rear spawn
and folded local diagnostic export remain frozen. No CPU-index prototype or
unmeasured FPS claim is included. Original coastal screenshot pixels/location
remain unknown; this iteration does not establish every seam or collision fixed.
