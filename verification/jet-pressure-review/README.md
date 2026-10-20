# Stronger cold-gas pressure and restrained condensation

## Changes

- `src/vehicles.js` is the only gameplay source edited by this revision. Each of the 18 physical outlets still uses one open, shared, depth-tested transparent envelope. No combustion color, additive bloom, light, particle pool or independent shock disk was added.
- The mouth coordinates and mouth radius remain exact. The reference rear wake expands from a maximum radius of 0.083 m to 0.201 m downstream; full-power rear length grows from 1.35 m to 2.35 m. Lift length grows from 1.15 m to 1.65 m; auxiliary jets receive smaller corresponding increases. Power-sensitive width/length and immediate release are retained.
- A faster downstream pressure modulation and longitudinal filaments give the white gas more force and body. Main/lift/RCS peak material opacity is 0.50/0.44/0.38. These are gameplay presentation choices, not measured CFD or a claim of reconstructing an official demonstration video.
- Condensation peak opacity rises only from 0.16 to 0.20. Its geometry, broken angular gaps, travel alignment, 0.8-second fade, threshold/re-arm behavior and FPV suppression remain unchanged.

## Checked

- 18 focused jet/reference-likeness tests passed, including the 6,720-case accepted production-input matrix. Additional tests cover unchanged mouths/topology, pressure wake bounds, monotonic analog response, invalid power, release and FPV hiding.
- The existing actual Three r128 audit passes 10,368 outlet trajectory rays across both bodies/cabins and three rear-gimbal poses with zero body intersections. Its 30/60/144 Hz transient expiry and direction checks pass.
- `audit-pressure.cjs` evaluates the actual production GLSL scalar alpha expressions on ray intersections with actual production geometry. It verifies byte-identical physical motion/tank/collision code and a byte-identical per-frame gas updater against the frozen before sources.
- Screen sampling uses 2,560 rays per scenario/view. At the default zero-pitch, zero-shake highway chase camera, the deliberately conservative effect-only footprint is 6.88% for simultaneous combined commands, with alpha above 0.5 on 0.51% of the screen. The 84 forward road/vehicle targets retain at least 92.69% transmission in that combined case; ordinary rear/retro/lift and sonic cases have zero alpha at those targets. Body and road depth occlusion are omitted, so this overestimates coverage.
- At the sonic pulse peak, the effect-only footprint is 9.45%, compared with 8.87% before; maximum sampled local alpha is 0.170, compared with 0.136 before. It still disappears completely after 0.8 seconds.
- No new draw calls, vertices, triangles, texture reads or per-frame allocations were introduced. Shared gas topology remains 169 vertices and 288 triangles, with 18 maximum outlet meshes. The fragment shader adds one sine operation (two to three); the larger wake does increase local raster/overdraw work. This is a structural CPU review, not a GPU performance benchmark.
- JavaScript syntax, Python compilation and scoped diff whitespace checks pass. Final bundle generation, full aggregate tests and build belong to the parent integration pass, to avoid overwriting concurrent work.

## Evidence and limits

`pressure-before-after.png` compares exact production meshes under the same disclosed studio camera and lighting. Individual unretouched source renders, manifests and hashes are retained alongside it. `before-default-chase.png` and `after-default-chase.png` use actual default highway chase camera offsets, on the same neutral studio floor.

The images use Blender Cycles CPU and vertex-sampled GLSL alpha approximation. They are not gameplay/WebGL screenshots. Fragment interpolation, transparent blend ordering and tone mapping can differ. Actual WebGL shader compilation and real-device FPS remain unverified. No local Chromium or denied browser route was used. No commit, push, deployment or shared root bundle was made by this worker.

## Reproduction

The original source snapshot for this active review is `/tmp/roadster-pressure-before/src`; the baseline renderer is `/tmp/roadster-pressure-before/render-jet-effects.py`. Their source hashes are recorded in each manifest. Baseline `vehicles.js` was clean at task start; other pre-existing development changes were preserved.

    node --test tests/jet-effects.test.mjs tests/reference-likeness.test.mjs
    ROADSTER_JET_AUDIT_OUTPUT=verification/jet-pressure-review/runtime-audit.json node verification/verify-jet-effects.cjs /tmp/roadster-three.min.js src
    node verification/jet-pressure-review/audit-pressure.cjs /tmp/roadster-three.min.js /tmp/roadster-pressure-before/src
    python3 verification/jet-pressure-review/compose-pressure-sheet.py /tmp/roadster-pressure-before /tmp/roadster-pressure-after

Mesh exports use `verification/export-jet-effects.cjs` with `ROADSTER_EFFECTS_SCENARIO=rear`, `lift` or `rear-sonic`. CPU renders use `verification/render-jet-effects.py` and one view per invocation: `effects-pressure-side` or `effects-chase`. The baseline uses its frozen original alpha equations with the same added inspection cameras.
