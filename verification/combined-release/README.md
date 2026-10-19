# Combined NPC, traffic/scoring and player release

Inputs: NPC/traffic integration `68198cd54b2fe67eaeb3771d740527b8672832fd` and frozen player exterior/cockpit `d08aafa936eddd24ecc45f78185d751298b8d22c`. The only production modules changed from 68198cd are the two exact player modules. `input-preservation.json` proves every production src/api/lib file against its intended input. Root bundle is regenerated rather than copied from either input.

All prior immutable vehicle originals remain intact in the local versioned ZIP, split parts and source archive workspaces. Main retains compact provenance and NPC payload only. Original ZIP publication is a separate pending delivery; this release does not claim remote recoverability.

## Validation

- 394 Node tests passed, no skips, with official Three.js r128 wheel verification enabled.
- 24 real Lua tests, check/build and deterministic bundle passed.
- Combined production-r128 NPC checker: all 15 styles × 2 LODs, 60 highway/city population rounds,85 shared geometries/14 materials, zero winding disagreements and zero rear-ray misses.
- Combined screen checker: four exterior/cockpit combinations, 212 canopy-clearance and 636 exterior rays, all pass. Reference minimum clearance remains 123.6 mm.
- Player runtime and wheel proof are regenerated in this directory using final combined sources. Full instrument/road ray thresholds and diffuser front-skin predicate are retained.

The frozen player CPU previews in the visual workspace and the 90 NPC views already reviewed are still geometrically applicable: corresponding production sources/payload are byte-identical. No new render or image relabeling was used. Historical player standalone scope/performance audits remain historical and are not represented as combined traffic checks. No browser/WebGL, live touch or live ranked-service exercise is claimed.

Reproduce from repository root with cached official runtime:

    ROADSTER_THREE_RUNTIME=/tmp/roadster-three.min.js node --test --test-concurrency=1 tests/*.test.mjs
    python3 tests/lua_runtime.py
    npm run check && npm run build
    node verification/npc-traffic/runtime-check.cjs /tmp/roadster-three.min.js
    node verification/cockpit-display-runtime-check.cjs /tmp/roadster-three.min.js verification/combined-release/screen-runtime.json
    node verification/reference-model-runtime-check.cjs /tmp/roadster-three.min.js verification/combined-release/player-runtime.json
    node verification/reference-wheel-batching-runtime-check.cjs /tmp/roadster-three.min.js verification/combined-release/wheel-runtime.json
