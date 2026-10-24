# Coastal rotated-hull landing contact — preview only

Base: PR20 preview `2c217c077c82b014f47a1365b6d803574ac47946`.
Main/production `4451a11c9c09d031a9da037ce63afe4bb7f062e5` stays unchanged.

## Evidence boundary

This repairs an independently reachable coastal partial-burial class. It does
**not establish that it is the user's original ground-gap/screenshot event**.
No screenshot pixels were obtained or viewed. The first-person/airtime clue came
only from potentially imperfect system-extracted description/OCR.

The frozen version can start upright on a real flat road, hold Space 0.8s and
J 1.6s, then release every key. During rotated descent the cockpit eye and actual
frozen reference-model vertices go below the rendered road while the root stays
above it. This is not a camera-only defect: the rotated vehicle itself overlaps
the floor before the old root-only landing event.

Independent native Three r128 scene inspection read six actual ground Meshes,
32,088 world-space triangles and eight Raycaster cross-checks. 78,698 bounded
road/bank/terrain samples matched physics support within 1.42e-14m. 32 high-speed
landing/bridge handoffs did not reproduce a mesh gap. Those exclusions do not
disprove the user's event and are not GPU/FPS or screenshot verification.

## Minimal correction

- Coastal airborne landing traces corners of the already-existing frozen player
  collision body with its real YXZ orientation, including within-frame rotation.
- A contact must belong to a finite real surface under the root, and the previous
  root must be above that plane. A distant bridge top cannot attract a car below.
- Root height comes from its actual finite support triangle, not an extrapolated
  neighboring corner triangle. The initial prototype's slope/bridge failures are
  retained; the 1e-8 consistency assertions were not loosened.
- Contact hands off to the existing landing/ground-attitude policy. Existing
  damage thresholds, thrust, damping, fuel and recharge coefficients stay exact.
- Coastal automatic landing protection reads the smaller of old root AGL and
  the same rotated body's clearance to the selected real floor. Otherwise the
  old root distance could postpone braking until after the body actually struck.
  Ordinary upright takeoff peaks/fuel remain unchanged in the tested cases;
  rotated-flight fuel/contact timing can legitimately differ and is not claimed
  to remain bit-identical.
- No camera lift, universal low-Y rescue, terrain/road mesh change, vehicle asset,
  material, scale, new control, weather, highway traffic or passenger change.

## Regression and lineage

`source-epoch.json` explicitly inherits the unchanged highway repair epoch and
pins all current sources. Exact 2c physics/projection/generator fixtures preserve
the historical source checks. Only coastal contact/clearance code and generated
projection identities are authorized; the physics difference guard retains
every other production byte. Highway/city full motion states are compared
bit-for-bit against the exact 2c fixture at 30/60/144Hz.

Portable regressions retain the original natural-input failure, real scene
triangles/FPV matrices/frozen reference vertices, normal flight, inverted and
sideways landings, slopes, bridge top/underneath, finite-surface guards and genuine
fuel-starved/too-late hard-contact damage. Existing suspension compression is
retained, not confused with metre-scale cockpit/chassis burial.

Final commands, counts, source/artifact hashes and retained red/prototype evidence
are recorded in `regression-summary.json` after the complete applicable suite.
Raw evidence remains under the shared `tesla-coast-hull-contact-20261022` and
`tesla-coast-ground-gap-20261022` folders. New publication/readback proof is saved
separately after the commit exists; this is not a production deployment.

## Final validation

- Complete command: `node --test --test-concurrency=2 tests/*.test.mjs`.
  It completed with 1127 passed cases and two file-level failures, zero skips,
  in 997.31 seconds. The final spec reporter gave no assertion/signal details;
  the exit cause is unknown, not established as OOM or SIGKILL.
- Without changing any of the 211 frozen source/test files, those two original
  files were rerun serially with TAP: **37/37 passed**, zero skips, in 45.81s.
- Combined coverage: **1164 unique cases passed** (1127 + 37). This is **not a
  single all-green complete run**. Earlier focused/257-case runs overlap and are
  not added. The original complete-run red log remains retained.
- All 67 newly added cases are included: 51 motion/contact, 11 native geometry,
  and 5 source-boundary cases. Low-fuel hard-contact loops are scenarios within
  the native cases, not additional independent test counts.
- `npm run build` and `npm run check` pass; served-game candidate is 5,015,942
  bytes, SHA256 `108ddb92d9e086fb389e6ddc967dfe9c73e3394c986c44f734367cb92b11fed3`.
- Native CPU checks actually ran with zero skips using the existing official
  Three r128 runtime. Set `ROADSTER_THREE_RUNTIME` to that official build to
  reproduce them; no GPU/browser/pixel/FPS validation is claimed.
- The exact historical physics fixture keeps its two original trailing-space
  lines. Only that immutable archive is excluded from the scoped whitespace
  check; production, tests and documentation are not exempted.

Manual preview retest: in the **coastal map**, take off and roll/pitch before
landing on a normal road; also try slopes and the bridge/underpass separately.
The original reported screenshot/location remains unlocalized; passing these
checks does not establish that every possible ground-gap report is resolved.
