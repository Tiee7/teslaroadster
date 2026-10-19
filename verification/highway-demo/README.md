# Highway demo verification

Date: 2026-10-19. Base: `3adccafb9a1f62afd55543a0aa8637090642a9b2`. Controller SHA-256: `34412641c929d1f5ff67ac1b093324852051bd57af5f5a09cafe9e8abc6fefed`. Bundle SHA-256: `0b6a72c54f5c0515a1f9c9235eceb45dd37c84af04350a7669aa6ae90016bc1f`.

## Automated checks

- Full Node coverage: **465/465 passed**, all test files, with concurrency bounded to 2. Lua: **24/24 passed**. Syntax, unique DOM IDs, deterministic bundling and static build passed.
- Independent whole-feature review: **42 focused cases passed**. See the [overall review](review-overall.md), [delta chronology](review-route-fix.md) and [captured output](review-route-fix.txt).
- An initial unbounded run had an obsolete 40-m-wall jump assertion and a test-file subprocess failure. The assertion was corrected to distinguish feasible braking from a genuinely close 20-m wall; isolated jet tests passed 9/9 and the complete final bounded suite passed. Earlier logs are retained rather than presented as successful runs.
- Final input ownership also covers pending ranked cancellation, including analog mobile sticks. The active matrix path is equivalent before/after this final pending-only reader extension, as independently checked in the review.

## Seeded production-logic simulation

36 cases: seeds 1/7/23 × 20/36/52 cars × 30/60/144/irregular frame intervals; each runs at least 90 seconds, for **3240.63 simulated seconds** total. The harness executes the production input, horizontal/vertical tank physics, highway drivers (including initialization/wrap/merge) and NPC collision code. DOM, media and rendering are stubbed. This is controlled CPU simulation, not a real browser end-to-end playthrough.

Speed percentiles and 220+ fractions exclude the first five seconds. P10/P50/P90 are run-level ranges, rounded to 1 km/h. The mean in the 220 column is the mean of 12 run fractions, not a pooled speed percentile. Centered means within 0.6 m of a lane center; the interval column measures consecutive time more than 0.9 m from every center, covering the normal crossing motion too.

| Cars | P10 / P50 / P90 km/h ranges | 220+ time range % (mean) | Centered time % | Longest off-center s | Completed changes | Genuine overtakes / racers |
| --- | --- | --- | --- | --- | --- | --- |
| 20 | 78–104 / 118–154 / 214–233 | 8.61–24.42 (18.39) | 75.66–86.15 | 0.521 | 436 + 5 ongoing | 1179 / 54 |
| 36 | 68–76 / 77–99 / 106–179 | 0.00–4.09 (1.30) | 87.15–95.94 | 0.533 | 226 + 1 ongoing | 666 / 48 |
| 52 | 69–75 / 71–81 / 86–131 | 0.00–0.00 (0.00) | 91.63–97.66 | 0.500 | 108 + 0 ongoing | 367 / 33 |

All 36 cases: **0 impacts, 0 crashes, 0 hops, 0% airborne time, 0 airborne forward-boost/lift time**. No maneuver was abandoned midway: the listed ongoing maneuvers were still running when the 90-second observation ended. Passing encounters require continuous negative-to-positive z crossing; hidden/waiting cars and respawn jumps are excluded. Re-encountering a pooled car later counts as another encounter.

These finite runs do not establish zero collision probability or optimal route selection. Dense traffic often remains far below 220. Temporary slowing is the approved safety fallback; the measurements must not be described as continuous 220+ performance. Some residual conservatism is algorithmic, not proven physically unavoidable.

## Route-choice audit and correction

The original three-stage reward penalty could reject a fully safe useful route for six seconds. Only the maneuver penalty (2→1) and minimum reward improvement (2→0.5) changed. Safety margins, trajectory, following headway, center dwell, gas and physics did not. The paired 45-second, 20-car audit records:

| Policy | Seed | P50 km/h | 220+ % | Useful-safe score rejections | Longest observed rejection span s | Overtakes / racers |
| --- | --- | --- | --- | --- | --- | --- |
| baseline | 1 | 115.21 | 17.83 | 21 | 2.533 | 43 / 2 |
| baseline | 7 | 84.86 | 1.87 | 48 | 6.017 | 14 / 2 |
| baseline | 23 | 134.64 | 26.07 | 10 | 1.267 | 51 / 2 |
| balanced | 1 | 114.90 | 17.62 | 21 | 2.850 | 43 / 2 |
| balanced | 7 | 150.96 | 14.12 | 8 | 0.950 | 53 / 3 |
| balanced | 23 | 185.97 | 34.86 | 6 | 0.950 | 61 / 3 |

See [independent counterfactual evidence](diagnostic-review.md). Remaining tiny-gain rejections are hysteresis, not a claim that no safe lane exists. A uniform 7-second horizon and other in-memory alternatives were rejected after complete multi-seed comparisons, not chosen from isolated good seeds; see [7-second comparison](review-horizon-comparison.md). Six 160/170/180-km/h racer fixtures completed genuine passes in 2.967–6.683 seconds, with ordinary centered changes and no impacts/hops.

## Real acceleration, hop and failure boundaries

- Clear road, from rest at 30/60/144 Hz: first 220 in **1.604–1.633 s**, peak 370 km/h, stable post-warmup 220+ time 100%, minimum tank 7.705–7.719 s. Actual controls and paid jets accelerate the car; speed and HUD are not assigned.
- An 80-m wall induces real H/paid-retro following around 79 km/h, without hopping. Removing that fixture restores throttle on the next frame and 220+ in **1.028–1.033 s**.
- A sudden 20-m six-lane wall at 65 m/s with a full tank: one paid hop, peak 2.3 m, 0 impacts; overlapping-NPC vertical clearance **0.808–0.854 m**. Air time **0.868–0.967 s** includes the shared O action's brief **0.160–0.200 s** paid lift pulse. There is no airborne rear boost or repeated lift request. A 10-m fixture has a smaller minimum clearance of 0.429 m.
- 40 m at 144 Hz can instead produce a single roof-rebound episode lasting **1.993 s**, 33.22% of its six-second observation, peak 2.942 m and 0 rear boost. This is retained as an adverse boundary, not hidden in the normal-traffic average.
- Empty-tank 20/10-m walls actually destroy the vehicle in about 0.09–0.27 s; a 40-m empty-tank/144-Hz case has a nonfatal impact. Four full-width walls 30 m apart cause this controller to crash after one hop at about 0.63 s even with gas. These are observed controller failures, not proofs that every conceivable driving strategy is impossible.
- No refill, collision suppression, teleport, NPC-speed change or score-rule change is used. See [boundary rows](boundaries.json) and [repeated-wall boundary](jump-chain-boundary.json).

## UI/ranking and browser limit

Nineteen lifecycle cases cover the highway-only/no-shortcut switch, three HUD modes, keyboard/legacy/mobile ownership, preparation cancellation, reset/destruction/map/blur/hidden/pagehide, mobile overlays, exact server-end/late issuance races, no demo submission and a fresh manual challenge after exit. A completed manual snapshot stays immutable.

The native cloud Chromium failed even a data: probe with a process-singleton socket permission error (exit 134); [probe output](browser-probe-errors.txt) is retained. No security restriction was bypassed and no user computer was used. Rendered WebGL appearance, real-device hit testing and visual FPS remain unverified.

## Reproduction

Run the full suite with `node --test --test-concurrency=2 tests/*.test.mjs`, production matrix with `node scripts/verify-demo.mjs`, boundaries with `node scripts/verify-demo-boundaries.mjs`, and this summary/invariant check with `node scripts/report-demo-verification.mjs`. `DEMO_DIAGNOSTIC_SET=final node scripts/diagnose-demo-planning.mjs` compares the retained before-fix controller with the production source in memory. It does not alter physical rules or the application.
