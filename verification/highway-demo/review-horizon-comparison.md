# Uniform 7-second horizon comparison

## Recommendation

**Keep the current 3.6-second production candidate.** The requested horizon-only experiment does not show a stable performance improvement across the complete six-case sample. All paired cases remain collision-free and grounded, but mean run medians fall at both traffic densities and actual overtaking encounters decrease overall.

This result rejects this simple horizon-only remedy; it does not prove that every remaining slowdown is inevitable congestion. The current candidate should still be described as safe-following-oriented, with temporary low speeds and no promise of sustained 220+ km/h.

## Fixed scope

- Production controller SHA-256: `34412641c929d1f5ff67ac1b093324852051bd57af5f5a09cafe9e8abc6fefed`. It stayed unchanged.
- Variant exists only in memory. All route-decision, stay and route-ranking horizons and their common safe-horizon score ceilings were set to 7 seconds.
- The three-stage route limit, 0.08-second center dwell, headway, first-step safety, emergency boundary, tank controls and real physics/collision/NPC code were unchanged. Speed conversions such as 250/3.6 were preserved.
- Seeds 1/7/23, densities 20/36, 60 Hz, 45 seconds each. Exactly six new 7-second variant replays.
- Current 20-car baselines were reused from the authorized `planning-final.json` balanced rows. Three current 36-car baselines were run locally for the same 45-second window. The separate 90-second matrix was not repeated.
- Speed metrics exclude the first five seconds. Group figures are means of the three run-level metrics, not a pooled speed median.

## Group results

| Cars | Mean run median, current → 7s | Mean 220+ time | Mean centered time | Actual overtakes | Racer overtakes | Maximum stripe time |
| --- | --- | --- | --- | --- | --- | --- |
| 20 | 150.6 → 125.3 km/h | 22.2 → 23.7% | 82.4 → 81.6% | 157 → 145 | 8 → 7 | 0.500 → 0.483 s |
| 36 | 103.3 → 96.6 km/h | 3.0 → 3.5% | 87.0 → 82.3% | 124 → 108 | 8 → 10 | 0.517 → 0.467 s |

Total actual overtaking encounters: **281 → 253**. All six current baselines and all six variants have **0 impacts, 0 crashes and 0 jumps**. The six variants and three newly replayed 36-car baselines also explicitly recorded 0% airborne time.

## Every paired result

Each cell shows current 3.6 seconds → common 7 seconds.

| Cars / seed | Median km/h | 220+ time % | Centered % | Longest stripe s | Overtakes | Racer overtakes |
| --- | --- | --- | --- | --- | --- | --- |
| 20 / 1 | 114.9 → 118.9 | 17.6 → 25.0 | 89.2 → 83.7 | 0.417 → 0.450 | 43 → 49 | 2 → 3 |
| 20 / 7 | 151.0 → 160.3 | 14.1 → 32.3 | 77.6 → 80.2 | 0.467 → 0.483 | 53 → 60 | 3 → 4 |
| 20 / 23 | 186.0 → 96.8 | 34.9 → 13.7 | 80.4 → 81.1 | 0.500 → 0.467 | 61 → 36 | 3 → 0 |
| 36 / 1 | 104.5 → 109.6 | 1.6 → 8.1 | 87.1 → 76.1 | 0.417 → 0.467 | 37 → 52 | 2 → 4 |
| 36 / 7 | 99.5 → 87.9 | 0.0 → 0.0 | 87.5 → 84.9 | 0.517 → 0.317 | 37 → 17 | 3 → 3 |
| 36 / 23 | 105.9 → 92.3 | 7.4 → 2.3 | 86.4 → 85.9 | 0.483 → 0.450 | 50 → 39 | 3 → 3 |

## Material counterexamples

- **20 cars, seed 23:** median 186.0 → 96.8 km/h; 220+ time 34.9 → 13.7%; overtakes 61 → 36. This outweighs the favorable seed-7 result and prevents recommending the variant from a selected good seed.
- **36 cars, seed 7:** median 99.5 → 87.9 km/h; overtakes 37 → 17; 220+ remains 0%.
- **36 cars, seed 23:** median 105.9 → 92.3 km/h; 220+ time 7.4 → 2.3%; overtakes 50 → 39.
- **36 cars, seed 1:** 220+ time improves 1.6 → 8.1%, but centered time drops 87.1 → 76.1%. The longer horizon is a tradeoff here, not an unqualified gain.

## Interpretation and limits

The longer horizon can recognize delayed route rewards, but it also changes which future traffic interactions dominate route selection. These data do not support a universal speed benefit. No per-case causal claim beyond the changed horizon is made without a detailed trace.

Centered time means within 0.6 m of a lane center; stripe streak means more than 0.9 m from every lane center. Overtakes are actual negative-to-nonnegative z crossings, with large respawn/waiting teleports excluded. New replays also require visibility and non-waiting state on both sides of the crossing. Counts are encounters, not unique NPC identities.

This is a limited 45-second deterministic comparison, not the 90-second matrix or WebGL/browser testing. Raw wall times are retained for provenance only: other verification work was running concurrently, so they are not controlled performance benchmarks.

All row-level metrics, the exact in-memory transformations, overtake events for new replays, and baseline provenance are in [review-horizon-comparison.json](review-horizon-comparison.json). No production source or shared helper was edited.
