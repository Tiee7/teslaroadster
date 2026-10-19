# Softer electric-drive audio and model-related input responsiveness

## Audio replacement

The old always-on sawtooth motor has been replaced with a low, rounded sine
fundamental and a faint sine octave. It fades to silence when stationary. The
motor's peak synthesis gain is bounded at 0.026, pitch stays in a low range, and
jet boost changes its fundamental by only 6 Hz instead of the old abrupt 85 Hz.
A 90 ms audio envelope smooths transitions; it does not delay driving input.

The simulated-engine preference, top-bar SFX mute and background-music player
remain independent. Existing storage keys and mute/destruction behavior are
unchanged. Thrusters, tires, collisions and alerts keep their existing routing.

## What the investigation established

The keyboard handler still updates key state synchronously. The sole animation
loop reads that state in the simulation before rendering. No new input debounce,
setTimeout delay or extra animation loop was introduced by the model release.
Regression tests exercise press/release and consumption before the next render.

The reference-model release did introduce a concrete rendering workload
regression. With the production Three.js r128 runtime, the external player car
changed from 45,160 visible color triangles and one 25,600-triangle shadow caster
to 103,297 visible color triangles and **108 detailed shadow casters containing
93,543 triangles**. The new camera wrappers also performed 548 recursive scene
lookup visits each unchanged frame. These are source/runtime findings, not a
measurement of the user's browser input latency or GPU frame rate.

## Changes

- Preserve every detailed visible vertex, material, model choice and cockpit pose.
- Batch the body's shadow silhouette and independently animated wing into two
  lower-detail casters: **13,211 shadow triangles**, about 86% fewer than before.
- Retain extra source rows at tight wheel openings and sill creases. The maximum
  displacement at all original surface samples is 8.33 mm. Fixed uniform
  decimation was rejected because it bridged those profile transitions.
- The casters write no color or main-view depth, do not participate in raycasts,
  and are hidden in studio previews. They use one shared material. The normal
  Three.js r128 shadow pass supplies its own depth-writing depth material.
- Cache stable model handles and synchronize visibility/layout only when model,
  cockpit, camera mode or viewport changes. Repeated stable frames perform zero
  recursive model lookups and no reference-cabin transform copies.
- Keep NPC geometry, traffic density, physics, input mappings and the frame-time
  safety cap unchanged.

The two invisible caster meshes add 13,211 no-color/no-depth triangles to the
main pass. Even including that cost, the player's combined main-plus-shadow
triangle submissions decrease from 196,840 to 129,719. These are scene-graph
submission budgets before frustum culling and material-group expansion.

## Verification

- npm test, python3 tests/lua_runtime.py, npm run check, npm run build
- node verification/input-latency-runtime-check.cjs /path/to/three.min.js result.json
- node verification/reference-model-runtime-check.cjs /path/to/three.min.js result.json

The performance verifier compares the old model release, pre-fix reference
release and current production meshes. All eight model/cockpit/view combinations
have identical visible geometry/material/pose hashes before and after this fix;
all six NPC variants are unchanged. It also bounds shadow-surface error and
checks the stable-frame scene lookup count. The independent geometric verifier
covers 117,600 instrument rays, 39,200 road rays, the steering envelope and closed
rear fascia.

Actual WebGL shading, audible preference and device-specific end-to-end latency
still need a functioning WebGL browser. The available supported cloud browser
could not provide a usable WebGL session, so this report makes no FPS or measured
input-latency improvement claim. The verified workload regression is fixed;
causality and the size of the improvement on the user's device remain unmeasured.
