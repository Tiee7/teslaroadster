# Read-only verification: eeddf7d

## Finding — cross-floor pickup under non-bridge mountain road

`src/taxi.js:401` treats any truthy `state.coastSupportId` as grounded enough for coast taxi. The pickup sphere is 4m, but the terrain mesh remains approximately 3m below some mountain road surfaces. A vehicle physically attached to that lower terrain layer can therefore board a passenger through the road surface.

Independent production-motion + production-taxi-adapter reproduction (deterministic seed 2):
- Waiting stop 12: x 352.7348139317077, y 21.277421231312545, z -929.3897933057489, supportId `road-0`.
- Real lower terrain: y 18.267984592509105, gap 3.0094366388034395m.
- Vehicle at that lower terrain, speed zero; after one frozen production motion step (1/60s), state was x 352.73465514302745, y 18.26797524359199, z -929.3898065175582, wasAirborne false, coastSupportId `terrain`.
- `RoadsterTaxi.tick(false)` boarded the road-0 passenger: onboard 0 -> 1.

Small proposed gate: replace `Boolean(state.coastSupportId)` with `Boolean(state.coastSupportId?.startsWith('road-'))`. This rejects terrain/roof/pier floors while allowing true same-height road-1 junctions. Since each coast stop's entire 4m pickup footprint is inside actual asphalt, this does not reduce legal pickup approaches.

Pure in-memory A/B applied only that expression. The lower-floor reproduction no longer boarded (`FLOOR_COUNTEREXAMPLE null`), while every positive probe below still passed. No repository edit performed.

## Independent positive evidence

The probes loaded all target production sources with `git show eeddf7d:src/...`, not moving working-tree sources. They did not rerun the repository's taxi test cases.

- 30 real production-motion approaches through coast stops, using both normal lane directions and 200/370/792 km/h initial speed. Includes sea level, slope and bridge stop planes. Every expected passenger boarded; real physics remained grounded.
- Actual `resetCar`, `switchMap`, and `destroyVehicle` function bodies ran in VM with only graphical/external presentation calls stubbed. Real coast spawn logic ran. Checked repeated city/coast/highway map switches, graph/marker parent replacement and score reset, ranked gating/normalized reset, revival, and destruction.
- Ten-person destruction example: 36,738 points earned; double-fare sum 32,548; final 4,190. Repeated destroy/onDestroyed/onReset-while-wrecked/tick preserved 4,190 and did not deduct again. Real respawn reset cleared round state.
- Independent ledger randomized walk: 28,109 transitions across city and coast, checking payout-once IDs, ledger score, waiting always 5, onboard <=10, IDs unique between waiting and onboard, and reset/death settlement.
- Full car at same-station dropoff + waiting pickup with 792 km/h production motion did not miss the pickup: delivery happened in one substep, the following substep's swept segment boarded the waiting passenger even though its endpoint was over 5m beyond the stop. No advance rewrite is warranted for this case.

## Reproduction files

- `frozen-verify.mjs` / `frozen-verify.log`: unmodified frozen source including counterexample.
- `candidate-road-floor-verify.mjs` / `candidate-road-floor-verify.log`: in-memory one-expression candidate gate, not a source patch.

No repo writes, npm/check/build/bundle, git mutations or publication were performed.
