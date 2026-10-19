# Elevated-highway traffic

`src/highway-traffic.js` controls elevated-highway NPCs only. City motion, vehicle
meshes, blast integration, collision consequences and pass rewards stay in their
existing paths.

Each driver receives one 16–30 m/s cruise speed at spawn. Following traffic may
brake smoothly and later accelerate back to that personal target; wrapping does
not reroll it. There is no timer-driven random lane change or automatic return.

An overtake requires a genuinely slower nearby leader, at least 1.6 m/s speed
advantage, 0.35 seconds of sustained obstruction and an adjacent lane with better
flow. Front/rear headway predicts closing over the 2.6-second quintic-eased merge,
including the grounded player's longitudinal/lateral movement and low blast
wrecks. Rear clearance also covers maximum possible NPC braking during the
merge, so an initially equal-speed player cannot be cut off as the NPC slows. Both source and destination lanes stay reserved. Snapshot-based decisions
make conflicting simultaneous requests deterministic, and a six-second cooldown
follows completed merges. A recovering blasted car also waits for a safe gap.

Both road ends check safe entry spacing. A temporarily unavailable respawn stays
hidden and retries rather than stacking cars. Rear-boundary pass flags are
single-frame, including zero-duration updates, and existing destruction guards
still prevent score gains after a crash.

## Reproduction and checks

- `node --test tests/highway-traffic.test.mjs` executes the production controller
  and complete traffic/collision block, with render objects stubbed. It covers
  cruise, following, useful/blocked overtakes, player front/rear/sweep protection,
  concurrent merge reservation, cooldown, safe wraps, hidden retry, blast
  recovery/coordinate conversion, collision lateral velocity and 20/30/60/144 Hz.
- A seeded 52-car run executes 60 seconds of the actual traffic update, checks
  every NPC pair each frame, and covers overtakes and repeated wraps.
- Existing attitude/braking movement fixtures load the real replacement traffic
  controller, retaining their reverse-travel and world-scroll assertions.
- Run `npm test`, `python3 tests/lua_runtime.py`, `npm run check`, and
  `npm run build` after `python3 bundle_app.py`.

These are production-JavaScript CPU runtime checks, not a WebGL playtest or GPU
rendering/performance verification.
