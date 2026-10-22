# Coastal boundary normal response

This preview-only successor to `bb73a584f3e40b648ff142707d2204b45e36c459`
fixes an independently reproduced player boundary defect, **not a localized
explanation of the original coastal ground-gap screenshot**.

## Counterexample and repair

At legal supported land positions, a40m/s car grazing the world boundary at
0.05rad has only1.97–2.09m/s outward normal closing speed. The exact bb73 source
fed total speed (~39.5m/s) into the unchanged damage function: all9 measured
land-edge/frame-rate cases reached fatal25.4G and reversed the fast tangent.
Six-metres-inward controls did not collide. The compact game-state witness is
`baseline-grazing-reproduction.json`; the complete prior physics/generator/
projection sources remain immutable in `tests/fixtures/coast-boundary-baseline/`.

Only a coastal branch is added at the existing finite-world boundary. It clamps
the same1197.8m bound, reflects crossed **outward normal** components at the same
0.35 restitution, and reports the combined corner-normal magnitude above the
same strict10m/s trigger. Tangential velocity and already-inward motion are not
reflected. The old yaw correction remains; the production damage function,
fatal thresholds, driving forces, steering and all non-coastal branches are
unchanged. No player rescue/teleport, ground-height shift, asset resizing,
collision removal or density/speed reduction is introduced.

## Exact scope and regression

`source-epoch.json` freezes every other source and links the immutable bb73
source epoch. The only source changes are coastal physics plus the numeric
projection and its explicit source/generator/program identity pins. Historical
source tests read their exact archive instead of weakening frozen expectations.
Negative guards reject old physics/projection, asset/terrain/weather/traffic/
passenger/diagnostic drift and unknown modules.

`tests/coast-world-boundary.test.mjs` has57 unique cases:

-9 exact old fatal counterexamples with inward controls;
-12 shallow contacts across four edges and30/60/144Hz, followed by continued
  steps with no repeat damage;
-12 hard-normal head-on/oblique cases (two genuine impacts per case);
-6 corner cases combining both crossed normals once, including the threshold;
-12 existing inward-overlap recoveries;
-3 mixed inward/outward corner cases;
-3 actual W/A/H post-contact control recoveries.

The west edge is water: those cases start legally airborne, not on invented
land. Other initial supported starts are legal but are not a continuous drive
from default spawn. The actual damage function is byte-equal old/new and runs
in the test VM; sound/destruction presentation is stubbed and random attitude
kicks are neutralized. These are CPU motion/damage tests, not rendered gameplay.

The final exact-byte applicable manifest/results and raw-log hashes are in
`regression-summary.json`. Focused runs are not added to the final unique count.
The two art files run serially; unchanged heavy highway planner cases retain
their prior combined baseline rather than being represented as a fresh full run.

## Evidence boundaries and continuity

- Vehicle models/materials/scales, terrain/rendered geometry, bridge/road layout,
  night-default weather, daytime lights-off, single-passenger state, normal highway
  front supply, incident-only rear respawn and folded local diagnostics stay frozen.
- No new browser/user-device GPU acceptance or fresh software-Mesa screenshot is
  claimed in this round. Previous environment-only views remain limited to their
  tested positions and omit player/HUD/NPCs.
- The original reported gap location/pixels remain unknown. Bounded sampling
  without a new failure is not a claim that every coastal seam is fixed.
- A separate structure-index CPU prototype was not integrated. Its isolated
  function timing is not an end-to-end frame-time/FPS improvement claim.
- Keep the old unique preview and create another preview from the verified SHA;
  do not promote to production or merge main. See `DEVELOPMENT.md` for continuity.
