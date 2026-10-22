# One passenger per ride — preview revision

Base preview: `b58060ad60df3e46fa93f953f4441ce5b4388029`, same draft PR20 / branch
`feat/weather-ground-traffic-20261022`. **No main merge or production deployment.**

The existing shared city/coast passenger model now has capacity1 instead of10.
An occupied seat rejects all other pickups; the existing delivery/loss/reset
lifecycle must clear it first. Arrival radii, 3D/grounded sweeps, route generation,
fares, double-fare loss, rankings, physics and map availability are unchanged.
Map1 does not gain a passenger mode. The arrays remain API-compatible.

The existing adapter follows capacity1 without added behavior: all five waiting
white markers hide while occupied; the sole green marker, navigation and cockpit
1/1 stay bound to that ride. After delivery, five white markers return. Delivery
settles alone in its update; if a waiting stop shares that destination, the next
update may pick up the next passenger. No artificial waiting period is added.
English/Chinese help no longer describes ten-seat or multi-destination play.

## Regression evidence

- Both real city/coast graphs: full-seat refusal, repeated updates, a swept step
  crossing multiple waiting pickups, generated coincident delivery/next-pickup,
  12seeds x80updates with exact fare/ID/waiting-station accounting per map.
- Actual production adapter under scene/DOM doubles: current target and cockpit1/1,
  hidden/returned markers, score separation, fatal arrival before delivery,
  idempotent death, respawn/reset and city/coast/highway transitions.
- All pre-existing crash/score, menus, ranked ownership, navigation, elevated-road
  support, pickup/arrival radii and route-clearance tests remain applicable.
- The previous weather/ground/traffic epoch is immutable. Its old taxi source is
  retained byte-exact in `tests/fixtures/single-passenger-baseline/taxi.js`;
  `source-epoch.json` explicitly permits only this taxi revision and freezes every
  other source, approved vehicle asset and previous render/context-loss fix.
  A differential guard proves capacity is the sole model behavior change and
  help text is the sole adapter change. Negative drift guards remain strict.

The first aggregate run exposed one historical city-cyber source assertion still
reading the live taxi module as old bytes. Its historical read now uses the exact
b580 fixture, while the new source epoch and negative guards continue checking
the actual single-seat source. No production code was changed to resolve it; the
red aggregate and isolated failure logs are retained separately.

Re-run:
```sh
python3 bundle_app.py
npm run check && npm run build
node --test --test-concurrency=2 tests/*.test.mjs
```
Final totals and log/source/artifact hashes are in `regression-summary.json`.
These are CPU/model/adapter/native geometry regressions, not an actual browser,
full-scene or user-GPU acceptance test. Preview acceptance: in maps2/3, collect
one passenger, pass another pickup, deliver, then collect the next; confirm a
single destination and1/1 throughout, plus empty reset/map/death transitions.
