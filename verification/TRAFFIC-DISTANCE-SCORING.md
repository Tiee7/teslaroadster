# Highway driver pools and distance scoring verification

Historical verification of the initial distance-scoring change. Its death-zero behavior is superseded by the crash-final-score lifecycle described in CRASH-FINAL-SCORE.md; traffic and speed-band rules are unchanged.

Verified locally on 2026-10-19, based on commit 683f6fd15331d619866b8433520b25d36a75d216. This candidate contains gameplay/scoring changes only; the separately reviewed compact NPC appearance changes must be integrated first. No remote publication, live database write or deployment was performed.

## Requested behavior

- Highway personal cruise targets: 10% uniformly sampled from 160–180 km/h, 40% from 70–80, 30% from 80–90, and 20% from 90–120. Largest-remainder rounding gives 2/8/6/4 drivers at 20 cars, 4/14/11/7 at 36, and 5/21/16/10 at 52. Shuffle prevents lane/type coupling.
- Actual speeds may decrease for safe initial braking gaps, traffic following or overtaking. Personal target, band, type and visual identity remain stable across wraps. Racers react and merge sooner, while normal drivers also actively pass.
- Initial lane distribution is balanced. Out-of-view safe respawns prefer less-occupied lanes. There are no in-view lane teleports.
- Both maps use distance-only driving points: one upward rounding of the cumulative weighted physical horizontal metres divided by 10. Highest segment bonus applies at >=180/200/240/300/350 km/h: +20/30/40/60/80%. Threshold-crossing frames are split and earlier distance is never upgraded retroactively.
- Counted horizontal speed is capped by the calibrated horizontal speedometer source, excluding the 1.65 venue/optical multiplier. Forward-moving horizontal path length is counted; reverse, exact lateral sliding, idle and vertical hovering earn no mileage. Nearly lateral motion with a positive forward component still counts its calibrated path, an intentional path-length interpretation rather than longitudinal-only displacement.
- Vehicle-passing counts remain statistics. Fixed pass/blast/stunt/helipad/sonic point additions and their award claims are removed. Passenger fares remain separate. Crash/reset/map reset clear driving accumulators, preserving passenger-specific penalties and prior submitted records.
- Ranked protocol distance-v2 submits six accumulated speed-band metre totals. Server recomputes the score, checks category speed/time plausibility, and retains signed identity, ownership, timing, cancellation, replay and rate-limit protections. Versioned board/name keys preserve legacy records without mixing them; stale clients/runs are rejected. Browser telemetry remains forgeable, so the casual board is not cheat-proof.

## Final frozen-source checks

- npm test: 354 passed, 0 failed.
- python3 tests/lua_runtime.py: 24 passed.
- npm run check: passed syntax, inline-bundle syntax, unique DOM IDs, deterministic bundle and deployment configuration.
- npm run build: passed, generated public/index.html from the committed standalone bundle.
- git diff --check: passed.

Tests cover exact scoring thresholds, cumulative ceiling, acceleration/braking threshold segmentation, 20/30/60/144 Hz equivalence, both maps, reset/destruction, no idle/reverse credit, independent passenger fares, version/legacy-board handling, schema rejection, speed envelopes and existing ownership/timing/replay/cancellation protections.

## Deterministic production-logic traffic checks

The test harness executes production spawning, traffic control, wrapping and contact code, with mesh/DOM rendering stubbed:

- Existing 52-car dense scene: 60 simulation seconds, no NPC overlaps.
- New seeded 36-car pool: 35 seconds, 28 overtakes including 11 racer overtakes, 46 safe forward wraps, longest full-road lane vacancy 0.00 seconds.
- New seeded 52-car pool: 35 seconds, 30 overtakes including 4 racer overtakes, 59 safe forward wraps, longest full-road lane vacancy 0.00 seconds.
- Exact seed-6 fast-racer birth regression: no overlap after fixing birth-speed braking-envelope initialization.
- Refresh around stopped players at x=2.5, -2.5, -12.5 and 10: no player overlaps.
- Simultaneous merge reservation, close front/rear gaps, player lateral sweep, low blasted wrecks, recovery and both wrap directions retain regression coverage.

An independent read-only review found and verified fixes for unsafe racer birth speed, stopped-player initialization, lateral-mileage/server-envelope mismatch and stale fixed-award copy. It then passed 20 exact-production mixed-traffic scenes (36/52 cars, ten seeds, ten seconds each) and 24 exact-production stopped-player scenes (36/52 cars, four lateral positions, three seeds, five seconds each), checking every NPC pair and player overlap each frame. No blocking finding remained.

## Limits and integration

These checks are deterministic simulation and source/API tests, not real WebGL gameplay. This cloud environment has no usable GPU browser, and no live Upstash or deployed ranked flow was exercised. After integration, regenerate index.html, run all checks again, and verify the deployed 60-second ranked protocol and browser gameplay in a supported environment.

Integrate compact NPC appearance changes first, then this gameplay commit. Preserve src/reference-traffic.js, its bounded-count wrapper, all compact NPC assets and the render-time visual LOD hook. Shared generated index.html should be regenerated, not manually merged. Likely source conflicts are the bundle_app.py script list (keep driving-score.js immediately after config.js and all NPC modules in their reviewed order), src/index.html script tags, appended README sections, and adjacent test-fixture changes. This candidate intentionally does not include the separate player-vehicle visual-fidelity work.
