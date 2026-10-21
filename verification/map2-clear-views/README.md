# Clearer map 2 street hierarchy

Base: live audio release main `affe5aae0b78b52bd25feaba582e27f85bf8cc7c`.

- 99 buildings: 64 low mid-block buildings (18–28 m, 12 m road-edge setback)
  plus 35 recessed towers (76–120 m, one 180 m landmark, >=75 m road setback).
  No tall corner walls. All 49 junctions clear 40 m sight triangles and 10584
  tested cross-traffic sight segments at 45/30/15 m approach: three ego lanes ×
  three cross-traffic lanes, both cross-street sides and four approach directions.
- Preserve 35 rooftop refill functions and two visual skybridge groups within
  the original two blocks. Tower positions and bridge centers change; bridge
  collision/landing support was not implemented before and is not claimed here.
- Same 21 m six-lane roads, 3.5 m lanes, paint batches, NPC/stop centers, city
  metre scale, camera and physics. New rendered building bounds equal collision
  boxes. Pickup graph and routes remain connected and unobstructed.
- Two facade bands on low buildings, four on towers; subdued neutral facades,
  fewer neon strips, no ordinary crowns/antennas/billboards/HVAC stacks; 14 m
  refill beams instead of 85 m. No new lights or per-frame occlusion processing.
- Real Three r128 CPU geometry: scene mesh objects 1903→758, shadow casters
  128→99, triangles 55410→29796, lights 0→0, bridges 2→2. These are scene-graph
  counts, **not measured GPU draw calls or real-phone FPS**.

`cpu-street-geometry.png` is a visibly labeled CPU box projection comparison,
not game screenshots. It was opened and checked; it depicts exact building
positions/heights with diagnostic flat colors, without lighting/weather/HUD.
FPV uses the production eye height 1.04 m, eye Z -.15 m and downward slope .04
for a stationary level vehicle; it does not model the cockpit/vehicle occluders.
The current supported cloud browser cannot initialize the game's WebGL scene;
no night/rain/material/device visual acceptance is claimed or bypass attempted.

Reproduce geometry and diagrams:
```
node verification/map2-clear-views/measure-layout.mjs
python3 verification/map2-clear-views/render-study.py
node --test tests/city-layout.test.mjs tests/taxi.test.mjs
```

The explicit numeric epoch differs only in the unused city-layout setback
constant 6→12 and its comment. Highway/coast numeric physics and the newly
released V8 source are unchanged; source mutation guards remain enabled.
