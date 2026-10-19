# Conservative route-choice diagnostic

## Result

Confirmed a reproducible safe-route opportunity that the production score repeatedly rejects. The problem is the combination of the 3.6-second reward horizon, three-stage maneuver cost, and fixed score-improvement threshold. No relaxation of collision geometry or following safety was needed to demonstrate the opportunity.

The controller remains unchanged: SHA-256 `c6326df96cd2f5d154c01acd772318fd4d3b0c53d108a20e7caa5495060b30ba`.

## Reproducible case

- Seed 7, 20 production NPCs, 60 Hz, realistic mode; initial player speed 42 m/s and x=2.5.
- Use `simulation` from `tests/helpers/demo-harness.mjs` and `pool(h,20,7)` from `scripts/verify-demo.mjs`.
- At the actual production decision t=6.533333 s, the player is at x≈-12.5, lane 0, travelling about 84.55 km/h.
- `safePath(1)` passes. The production best candidate is `[1,2,3]`, with no predicted collision over the entire 3.6-second horizon.
- Staying predicts 78.969 physical forward metres and score 379.742.
- The candidate predicts 105.682 metres and score 380.421.
- Its 26.713 m progress gain is outweighed by the three moves' 6-point cost plus the required 2-point improvement: it needs more than 32 m of gain in this short window. The required score is 381.742, so this safe candidate is rejected.

At the nearby t=6.483333 s probe state, extending observation of the same route and original prediction/control functions to 7 seconds gives:

- Stay: 149.758 m, no predicted collision.
- Candidate: 243.465 m, no predicted collision.
- Gain: 93.707 m; net score advantage after the unchanged 6-point maneuver cost: 17.427.

The 6.483333 s state is the independent probe/counterfactual starting point, not a production decision instant: 0.033333 s of the decision cooldown remained. The frequency counts below include only executions of the real production decision branch.

This is a lookahead/reward issue. Each transition consumes much of the short prediction window while continuing to pay ordinary following/braking constraints. A larger mandatory center dwell will consume more of that window and should be considered together with the horizon and reward design.

## Frequency and waiting

One 45-second seed-7/20-car run produced:

- 127 production route-decision instants.
- 48 rejected candidates across 48 distinct instants that passed first-step safety, remained collision-free for 3.6 seconds, and predicted more forward progress than staying, but failed the unchanged score threshold.
- None of those 48 instants accepted another candidate.
- Longest consecutive observed sequence: 20 decisions from t=2.416667 to 8.433333, a 6.016667-second span, still in lane 0.
- The car did not select its next lane until t=12.866667. The entire intervening 10.45 seconds is not claimed as continuously safe: the qualifying safe-improvement sequence was interrupted by changed traffic after t=8.433333.
- This baseline run had zero collisions, zero jumps and 7 completed lane changes.

The count measures the cost of the present hysteresis/reward tradeoff. It does not prove that all 48 candidates should be taken.

## Real-dynamics counterfactual

For an independent replay of the same seed, only the selected route at t=6.483333 was set to the already production-approved `[1,2,3]`. No physical parameters, speed, gas, collision code, NPC code, following controls, or safety thresholds were changed. Production rolling route validation and subsequent autonomous decisions remained enabled.

At t=14 s:

- Baseline physical forward distance: 370.979 m.
- Selected-route replay: 543.847 m, a 172.867 m gain.
- Both runs: zero collisions, zero jumps, no airborne time.
- Selected-route replay minimum ground collision-envelope ratio: 1.855, where values below 1 would overlap the production rectangular collision envelope.

This is supporting evidence for a real opportunity, not a proposed final controller or a substitute for the scenario matrix.

## Passing 160–180 km/h traffic

Single production racer in the player's lane, starting 100 or 180 world metres ahead; player starts at 42 m/s. Passing is recorded after the NPC moves at least 5 world metres behind the player.

| Racer speed | Initial distance | Pass time |
| --- | --- | --- |
| 160 km/h | 100 m | 3.083 s |
| 160 km/h | 180 m | 4.967 s |
| 170 km/h | 100 m | 3.383 s |
| 170 km/h | 180 m | 5.750 s |
| 180 km/h | 100 m | 3.817 s |
| 180 km/h | 180 m | 6.833 s |

All six cases completed one ordinary lane change, with zero collisions and zero jumps during 12-second observation. Final speed was about 250 km/h. There is no general inability to overtake fast racers; the diagnosed delay concerns short-horizon multi-lane routes through slower traffic.

## Suggested scope for a correction

Keep the existing physical safety and following checks. Separate the incentive to commit to a safely validated multi-step route from repeated per-step reward deductions, or use enough route-aware reward horizon to observe the benefit after the transitions. Require controlled center dwell and rolling validation as before. Do not interpret this diagnostic as a reason to reduce collision margins or following headway.

Full observations, exact decision records, traffic snapshots, both replay summaries, and fast-pass outcomes: [diagnostic-review.json](diagnostic-review.json).

Only these two diagnostic artifacts were written. No production source or shared helper was changed, and the 36-case matrix was not repeated.
