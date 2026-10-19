# Reference wheel batching verification

The wheel-only change concatenates static child geometry by its existing material inside each unchanged `reference-wheel-{i}` group. The wheel and steering pivots, classic wheel parts, tire handle names and material objects are retained. The production source uses four meshes per wheel; the deliberately incomplete unit-test scene fixture safely keeps its 37 source meshes and is not presented as batching evidence.

## Actual Three.js r128 result

`reference-wheel-batching-runtime-result.json` was generated with the official `/tmp/roadster-three.min.js` production runtime. Its independent baseline runs the same source with only the batching invocation disabled.

- Reference wheel meshes: **148 → 16**, a reduction of 132 single-material submissions (89.19%), before frustum culling.
- Per wheel: rubber 1 → 1; graphite 14 → 1; alloy 17 → 1; red 5 → 1.
- All **10,408 oriented wheel triangles and 7,864 source vertices** remain. No welding, remeshing, winding reversal or normal regeneration.
- Per-material fingerprints match for every oriented world-space triangle, original stored normal, transformed world normal and applicable UV. Fingerprints sort oriented triangles independently of mesh order, triangle order, UUIDs and cyclic starting-vertex selection; they do not permit reversed winding.
- Three verified poses: neutral, independently spinning/steering wheels, and spinning/steering wheels under a translated/rotated car.
- Original stored normals, world normals and UVs are unchanged. The maximum raw CPU world-position difference from baking child translations into Float32 vertex buffers is **5.001347559613344e-9 m** (about 5 nanometres). The matching fingerprints explicitly model this sole Float32 storage conversion. They are not a claim of bit-identical pre-bake double-precision world coordinates or rendered pixels; no epsilon quantization is used in the fingerprints.
- All four classic cockpit/view combinations retain matching visible geometry, serialized material-property, pose and shadow-flag fingerprints. Non-wheel visible meshes also match across all tested poses.
- Model switching restores reference/classic wheel visibility; the original wheel parent, spin and steering hierarchy remains intact. The rubber mesh retains `reference-rounded-tire-{i}`.
- For the source snapshot recorded in the result, opaque neutral preview meshes are **401 → 269** and triangles remain **123,302**. These whole-preview counts include the concurrent exterior revision; the wheel-only reduction remains exactly 132.

These are actual-runtime CPU geometry and scene-graph results. They are not measured GPU frame time, browser latency, FPS, rasterized texture or pixel-equivalence evidence.

## Checks run

- 29/29 focused serialized Node tests passed: wheel batching, reference likeness/model/geometry, cockpit layout and exterior details.
- The existing real-r128 reference-model verifier passed: 117,600 instrument rays, 39,200 road rays, zero instrument/road blocks, zero wheel-envelope violations and zero rear gaps.
- The final focused wheel tests passed 2/2, including the real-runtime verifier.
- Syntax checks passed for the wheel source and verification script.

Reproduce the detailed wheel proof:

    node verification/reference-wheel-batching-runtime-check.cjs /path/to/three.min.js verification/reference-wheel-batching-runtime-result.json

Run the focused tests with an explicitly supplied production runtime:

    ROADSTER_THREE_RUNTIME=/path/to/three.min.js node --test --test-concurrency=1 tests/reference-wheel-batching.test.mjs tests/reference-likeness.test.mjs tests/reference-model.test.mjs tests/reference-model-geometry.test.mjs tests/cockpit-exterior-details.test.mjs tests/cockpit-layout.test.mjs

No publishing or deployment was performed. No physics, controls, input, audio, classic geometry or NPC source was edited.
