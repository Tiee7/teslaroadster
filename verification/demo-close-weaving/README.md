# Close-weaving demo verification

Date: 2026-10-19. Baseline main: `aa3cf0883fa78cbd4cf589b86c8740a266ebf8a7`, tree `84b74e4c2d23244eb20d6a89837181cdfbffd975` (the original local 6dc8336 checkout has exactly that tree). Final controller: `d705cdd85ba8625b7229ed25e78207b3286f30cd588434406f721afc1129db03`. Physics: `5f115c1741e10cfa3a6b3a0fe20331ba8e6c03a43e6421069e6ec292507f231c`.

## Checks

- **474/474 Node tests, 24/24 Lua tests passed.** JavaScript syntax, deterministic bundle, unique DOM IDs and static build passed. The npm wrapper attempted a blocked npm-registry request; the identical local check/build entrypoints were run directly with Node, without accessing that service.
- [Independent review](independent-review.json): 50,000 randomized continuous-box sweeps matched an independent interval implementation; 4,800 actual manual frames across 40 highway/city, ground/air, Realistic/Fantasy and control cases matched the prior production physics bit for bit. Both demo ownership flags are disabled; 9,600 per-frame input checks verify the actual keyboard throttle, steering, brake, boost and handbrake values in both versions. This corrected audit replaces the earlier neutral-input-only evidence. A deliberately constructed between-frame corner hit caused ordinary demo damage/destruction, proving contact is not disabled.
- Focused tests cover complete 30/60/144/irregular-Hz changes, bounded per-frame lateral movement, no stripe camping, a fast approaching rear car, full-wall following/braking, real gas, collision failure and lifecycle/ranked isolation. Fuel, propulsion, NPC behavior and leaderboard rules are unchanged.

## Paired measurements

Seeds 1/7/23 × 20/36/52 traffic cars, 60 Hz, 90-second requested observations. Identical seeded production traffic and starting 42 m/s. Runs stop on destruction; short rows are explicitly listed. Both reports record matching unchanged source hashes. Only the frozen final candidate is summarized; exploratory variants are excluded.

Speed is the mean of each run's post-five-second median, not a pooled percentile. Changes and overtakes are normalized by actual observed time. Overtakes are all genuine continuous negative-to-positive relative-z crossings, including cars in other lanes; they are not all near passes. Near encounters are contiguous per-car episodes with either <0.5 m side clearance while longitudinal envelopes overlap, or <2 m bumper clearance while lateral envelopes overlap. Episodes may include a collision, which is separately reported. Gaps are signed against the existing collision envelope, not render-mesh distance.

| Cars | Mean run median km/h, before → after | Completed changes/min, before → after | True z-crosses/min, before → after | Near episodes, before → after | After closest front / side m |
| --- | --- | --- | --- | --- | --- |
| 20 | 131.622 → 208.389 | 23.111 → 34.667 | 66 → 115.111 | 0 → 6 | 0.597 / 1.025 |
| 36 | 86.317 → 167.432 | 12.444 → 55.556 | 36.667 → 148.444 | 0 → 12 | 0.714 / 0.834 |
| 52 | 74.856 → 160.506 | 6.889 → 56.222 | 18.889 → 146.444 | 0 → 22 | 0.78 / 0.972 |

| Cars | Seed | Observed s | Speed P50 km/h | Complete changes | Median change s | True z-crosses/min | Near episodes | Impacts / crashes | Hops / air % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 20 | 1 | 90 | 216.5 | 47 | 0.533 | 115.3 | 3 | 0 / 0 | 0 / 0.00% |
| 20 | 7 | 90 | 204.1 | 53 | 0.533 | 114.7 | 2 | 0 / 0 | 0 / 0.00% |
| 20 | 23 | 90 | 204.6 | 56 | 0.533 | 115.3 | 1 | 0 / 0 | 0 / 0.00% |
| 36 | 1 | 90 | 167.8 | 83 | 0.533 | 152.0 | 3 | 0 / 0 | 0 / 0.00% |
| 36 | 7 | 90 | 167.9 | 85 | 0.533 | 147.3 | 2 | 0 / 0 | 0 / 0.00% |
| 36 | 23 | 90 | 166.7 | 82 | 0.533 | 146.0 | 7 | 0 / 0 | 0 / 0.00% |
| 52 | 1 | 90 | 157.3 | 87 | 0.533 | 140.7 | 10 | 0 / 0 | 0 / 0.00% |
| 52 | 7 | 90 | 160.3 | 87 | 0.533 | 149.3 | 1 | 0 / 0 | 0 / 0.00% |
| 52 | 23 | 90 | 163.8 | 79 | 0.533 | 149.3 | 11 | 0 / 0 | 0 / 0.00% |

Overall after: **0 impacts, 0 crashes, 0 swept-body-overlap episodes**, 0 real paid hops, 0.00% airborne time and 0s airborne rear jets. Longest continuous >0.9 m off-center interval: 0.188s. Close clearances and higher speed are deliberate exhibition behavior; finite runs do not establish collision-free driving for arbitrary traffic.

The demo uses a real continuously integrated quick steering response only while active and grounded on the highway. Whole centers remain the targets. The 2.4-second route evaluation and 0.55-second near-threat trigger use roughly 1–1.5 m steady following clearance, narrow positive predictive margins and a bounded reward for multi-stage routes only when they materially advance beyond staying. The actual contact envelope is not reduced. Prediction and actual demo collision detection both include continuous relative-box sweeps between samples/frames, with respawn jumps excluded.

## Motion diagram and browser limit

[CPU motion diagram](demo-lane-change-motion.png), [SVG](demo-lane-change-motion.svg), [actual trace and hashes](demo-lane-change-motion.json): one 0.533-second complete center-to-center maneuver from seed7/count36. It is labelled CPU production simulation, not WebGL, and shows a safe complete lateral transition rather than claiming the shown first maneuver is a near scrape. Nearest-ahead gap can jump when a leader leaves the lateral overlap envelope.

No new real WebGL, visual FPS, device hit-testing or local-browser validation was performed. The prior verified cloud Chromium restriction remains documented in the [earlier release report](../highway-demo/README.md); no restriction or denied local DevTools route was bypassed.

## Reproduction

- `node --test --test-concurrency=2 tests/*.test.mjs`
- `python3 tests/lua_runtime.py`
- `node scripts/check.mjs && node scripts/build.mjs`
- `REPO=/path/to/baseline SEEDS=1,7,23 COUNTS=20,36,52 SECONDS=90 FPS=60 CLOSE_FOLLOW_GAP=2 OUTPUT=verification/demo-close-weaving/before.json node scripts/measure-demo-close-weaving.mjs`
- Repeat with `REPO=$PWD` and `OUTPUT=verification/demo-close-weaving/final.json`, then `node scripts/report-demo-close-weaving.mjs`.
- `BEFORE_REPO=/path/to/baseline node scripts/review-demo-weaving-focused.mjs`.
- `node scripts/collect-demo-weaving-motion.mjs` (optional Python matplotlib/numpy for rendering).
