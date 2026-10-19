# Independent review: minimal route-reward correction

## Conclusion

No blocking issue found in this delta. The correction materially reduces the demonstrated slow-queue trap without changing collision checks, following safety, real tank/physics behavior, or the center-settling rule. Remaining slow periods should not be presented as a guarantee of continuous 220+ km/h.

Reviewed controller SHA-256: `34412641c929d1f5ff67ac1b093324852051bd57af5f5a09cafe9e8abc6fefed`.

Previous controller SHA-256: `c6326df96cd2f5d154c01acd772318fd4d3b0c53d108a20e7caa5495060b30ba`.

## Static delta

The complete source comparison against `controller-before-route-fix.js` contains only:

- Maneuver cost: `moves * 2` → `moves`.
- Required score improvement: `2` → `0.5`.
- An explanatory comment.

Headway, safe-path/route/emergency trajectories, collision margins, gas debit, physical movement, NPC behavior, 3.6-second horizon and center dwell are unchanged. A three-move route now needs more than 14 m of predicted progress improvement, rather than more than 32 m, when compared at the same safety horizon.

## Focused regressions

Ran the actual source through:

`node --test tests/highway-demo-physics.test.mjs tests/highway-demo-following.test.mjs tests/highway-demo-lifecycle.test.mjs tests/highway-demo-routing.test.mjs`

Initial combined run: **40 passed; 0 failed, cancelled or skipped.**

### HUD coverage addendum

After the test-only HUD coverage addition, independently reran `node --test tests/highway-demo-lifecycle.test.mjs`: **18 passed; 0 failed, cancelled or skipped**. Distinct focused coverage is now **41 cases**: physics 10, following 10, lifecycle 18 and routing 3. The 45-second diagnostics and long matrix were not rerun for this test-only change.

The helper now loads the production section from `const HUD_MODES =` up to, but excluding, `const keys = {};`. That adds the real HUD normalization/application/restoration/toggle functions without world initialization. The new test executes actual `applyHudMode()` and demo button callbacks for full, medium and minimal modes, confirms the button is not directly hidden, then confirms it stays hidden in the city in all three modes. This is appropriate DOM/state coverage; it does not assert rendered pixel visibility or physical device hit testing.

Production controller/adapter code did not change; the reviewed `34412641…fefed` controller hash was rechecked.

### Final pending-input ownership correction

The subsequent production delta changes only the demo ownership predicate in `readDriveInput()` and `readAttitudeInput()` from `isActive()` to `isBusy()`. That correctly extends ownership to the preparation state: `frameInput` is neutral until activation, fresh mobile-stick requests cannot leak into manual physics, and stop/cancel clears captured touch input. The active demo controller and adapter are unchanged.

The added lifecycle regression holds preparation pending, issues keyboard and both analog-stick requests, executes the real movement/air code, confirms neutral drive/attitude with no jet debit, then cancels preparation and confirms clean manual input.

**Latest complete focused run: 42 passed; 0 failed, cancelled or skipped** (physics 10 + following 10 + lifecycle 19 + routing 3). Its actual output is appended to `review-route-fix.txt` and also retained in `review-route-fix-pending.txt`.

The long-matrix fixture in `tests/helpers/demo-harness.mjs` supplies both `isActive:()=>true` and `isBusy:()=>true`. The changed predicates therefore select the exact same branches for every matrix frame. An isolated old/new production-reader comparison additionally returned identical drive and grounded/airborne attitude values for five neutral/throttle/boost/brake/steer/strafe samples, even with conflicting manual keys/touch values present. This equivalence concerns the matrix fixture; real pending UI ownership deliberately changes. There is no need to restart that matrix solely for this predicate change.

The controller hash remains `34412641c929d1f5ff67ac1b093324852051bd57af5f5a09cafe9e8abc6fefed`. No production edits were made in this review, and the prior 45-second diagnostic was not repeated.

This includes 30/60/144 Hz queue escape, grounded following and clearing recovery, paid/empty/fractional/freefall tank behavior, prediction/real-H consistency, real short-jump behavior, ranked isolation, late issuance/end races, input ownership and menu/reset/crash cleanup.

Full test output and replay summary: [review-route-fix.txt](review-route-fix.txt).

## Paired production-dynamics replay

Ran one 45-second seed-7 / 20-car / 60-Hz replay per controller. Only the controller source differs; physics, collisions, NPC AI and source inputs are unchanged. Observation hooks only record decisions and positions; no route was forced in this comparison.

| Metric | Previous | Minimal correction |
| --- | ---: | ---: |
| Median speed after 5-second warmup | 84.86 km/h | 150.96 km/h |
| Time at 220+ after warmup | 1.87% | 14.12% |
| Useful safe candidates rejected by score | 48 | 8 |
| Longest consecutive observed score-rejection span | 6.017 s | 0.950 s |
| Completed lane changes | 7 | 23 |
| Time within 0.6 m of a lane center | 93.34% | 77.64% |
| Longest continuous time >0.9 m from all lane centers | 0.433 s | 0.467 s |
| Actual z=0 overtaking encounters | 14 | 53 |
| Racer overtaking encounters | 2 | 3 |
| Collisions / jumps / airborne time | 0 / 0 / 0 | 0 / 0 / 0 |

The improvement trades more complete lane changes for less queue following. It did not produce long stripe occupancy in this replay. The broader matrix remains a separate check.

### Remaining conservatism

All eight remaining score-rejected candidates are collision-free within the production 3.6-second prediction and offer only **0.043–2.808 m** more predicted progress. Several are out-and-back routes such as `[1,1,0]`. Rejecting these tiny gains is consistent with retaining hysteresis against unnecessary weaving; these are materially different from the prior 18–27 m multi-stage improvements that were suppressed repeatedly.

The longest remaining observed rejection sequence is four decisions at t=16.450–17.400, lane 0. This is a span between qualifying production decision instants, not a claim that every intervening frame was an independently evaluated decision.

## Real overtaking definition

Counted only negative-to-nonnegative z crossings when the NPC is visible and not waiting to spawn both before and after the frame, and its positive single-frame z displacement is below 20 world metres. This excludes the large respawn/waiting teleports. Full from-z, to-z, displacement, player/NPC position and speeds are recorded for each event.

These are genuine overtaking **encounters**, not unique NPC identities: the 20-object pool can be encountered again after a later respawn, but the respawn movement itself is not counted as an overtake.

## Fast racer confirmation

The new production controller also passed six independent 12-second cases with a 160/170/180 km/h racer in the player's lane, starting 100 or 180 world metres ahead. All crossed z=0 continuously, completed one ordinary lane change, and had zero collisions/jumps.

| Racer | Initial gap | Genuine z=0 crossing |
| --- | ---: | ---: |
| 160 km/h | 100 m | 2.967 s |
| 160 km/h | 180 m | 4.850 s |
| 170 km/h | 100 m | 3.250 s |
| 170 km/h | 180 m | 5.617 s |
| 180 km/h | 100 m | 3.667 s |
| 180 km/h | 180 m | 6.683 s |

Each ended around 250 km/h. Every crossing is retained with its before/after z evidence.

## Artifacts and limits

Exact decisions, rejections, route scores, overtaking events and paired replay outcomes: [review-route-fix.json](review-route-fix.json).

The current controller hash stayed unchanged during this verification. No production file or shared helper was edited. The full Node suite and 36-case long matrix were not repeated here; this review does not claim real-browser/WebGL validation or absolute collision immunity.


## Final native-Space accessibility review (2026-10-19 15:50 UTC)

No blocking issue found in the final two-line keyboard delta. The `Space` early return is narrowly limited to the actual focused `btn-highway-demo` native `type="button"`, before the busy/driving-key interception. It neither prevents the browser default nor sets the driving Space key. The existing keyup handler only releases the key and also does not cancel native activation, so the normal button action remains available in idle and active states without adding a driving shortcut. Existing text-entry/modal guards are preserved.

Independently reran `node --test tests/highway-demo-lifecycle.test.mjs`: **19 passed; 0 failed, cancelled or skipped**. The updated existing UI regression checks idle and active focused-button Space dispatches, verifies default is not prevented and lift input is not injected, and then verifies clean button exit. This fake-DOM test does not synthesize a real browser's native key-to-click action; preservation of that default action is established by the handler review and native button markup. The distinct focused coverage remains **42 cases**, with the previously passing physics/following/routing cases not repeated for this UI-only delta.

Controller SHA-256 rechecked unchanged: `34412641c929d1f5ff67ac1b093324852051bd57af5f5a09cafe9e8abc6fefed`. No production edits, tuning experiments, 45-second diagnostics or long-matrix replays were made for this review. Lifecycle test output is appended to `review-route-fix.txt`.
