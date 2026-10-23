# Coastal building-side separation — preview-only

Succeeds `f67c1789a7c8e94506d025a7e719907c3823a5a9` on the same PR20 development branch. No main/production operation. Retain the existing unique preview and every earlier preview.

## Reproduced defect

24 once-supported, continuous-W paths (eight original flat-ground shop-houses at30/60/144Hz) encounter a building-side collision at0.3125–0.3333s despite a0.382m native car-box/wall gap. The original world-axis1.1×1.8m expansion ignores yaw. Exact r128 scene-triangle inspection at those callbacks finds only intended tire/ground contact, not a side collision with facade/decoration. The initial placement is a legal nearby supported fixture, **not** a default-spawn whole-map journey. Retained exact original source and counterexamples are in `baseline-native-reproduction.json` and `tests/fixtures/coast-building-separation-baseline/`.

`baseline-red-contract.mjs` intentionally reruns the frozen old source and fails all three no-false-collision assertions. This red is an explicit old-fixture rerun after the candidate was written, not a claimed earlier wall-clock run. The original24 native witnesses were recorded before the runtime edit.

## Small conservative repair

Only certified flat, straight, zero-angular-rate, non-manual-RCS motion may reject an old building candidate. Require actual approved native bounds and a flat solid endpoint at the same height. A fixed world X/Z plane must separate the **whole** native body across the translation chord, including root-offset radius, short-Euler travel and the original maximum visual pitch/roll. Nonfinite input or missing native bounds keeps old contact.

Apply that same rejection to the later coastal **wall-only** fallback. Otherwise retain the original candidate selection/time, response, damage, roof/support ownership, driving coefficients and every map/vehicle/render asset. Default `clipBuildings(previous,state)` callers remain exact. This is not a full building CCD, rotated/airborne-wall rewrite, removal of real collisions, or a ground-height/teleport workaround. Smaller gaps and other trajectories retain the conservative legacy behavior.

## Verification and limits

- 43 new unique cases:24 native-clear real-input paths,12 exact genuine/no-candidate/steered/airborne controls, native whole-corner sweep/visual-envelope proof, default-API/lazy-response identity, missing-native/nonfinite fail-closed coverage, and4 source/lineage guards.
- Historical source guards needed **read-address-only** corrections for the newly changed coastal source; expected historical hashes/fixtures/epochs remain exact. Preserve initial87/91 source-focused log (four old read-address failures). A second132/133 run exposed one remaining old read address; preserve it too. No runtime or original expected value was changed to satisfy those historical assertions.
- Final applicable counts, exact final-byte snapshot and check/build outcomes are recorded in `regression-summary.json`. Focused reruns overlap and are not added. The12 unchanged expensive highway planner files retain the explicit prior baseline; no fresh full-repository npm-test claim.
- Original coastal ground-gap screenshot/location remains unlocalized. A separate next-step exploratory lateral audit, at its own recorded intermediate source snapshots and not added to final regression counts, found brief bank-kink low-detail clipping. It is not repaired or relabeled as a clean pass here. No claim all map gaps are fixed.
- CPU/native geometry and production-block controls only: no fresh browser, user-device GPU, full rendered world, or FPS/performance-improvement claim.
