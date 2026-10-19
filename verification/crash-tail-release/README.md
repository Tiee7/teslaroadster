# Crash-result and downward-tail integration

Inputs:

- Published functional/player base: cf3e7729c863e3d40e4645c0dbe83ab556d51ade.
- Reviewed crash-result lifetime fix: caada63c6518967cbeeb3432bedca6e3fb5a5167.
- Frozen downward-tail geometry: a2cc7fe3c5837a7c28d52f20362715276944a541.

The tail cherry-pick merged without source conflicts. The generated root bundle was rebuilt from the combined sources. `input-preservation.json` compares every production src/api/lib/assets file to the appropriate frozen input: only reference-exterior.js comes from the tail revision; all other files match the reviewed crash revision exactly. The NPC payload, source-entry registry, collision dimensions, driver logic and shared geometry/material limits remain unchanged.

The prior player is recoverable from published cf3e772 history. The tail workspace also preserves its exact baseline source/mesh export and archive/player-tail-before-cf3e772. Earlier immutable originals, ZIP and split transport parts remain intact locally; separate ZIP publication is not claimed here. The existing fifteen NPC styles are not regenerated or replaced by high-detail player copies.

Fresh combined validation is recorded in this directory. Historical standalone crash/tail audits remain attributable to their own frozen inputs. Combined screen/player/wheel/NPC checks retain all strict geometry, ray, resource and winding predicates. The tail scope/performance check uses the reviewed crash revision as its functional baseline, so the score repair is not mistaken for a tail scope violation.

Reproduce with the cached official Three.js r128 runtime:

    ROADSTER_THREE_RUNTIME=/tmp/roadster-three.min.js node --test --test-concurrency=1 tests/*.test.mjs
    python3 tests/lua_runtime.py
    npm run check && npm run build
    node verification/cockpit-display-runtime-check.cjs /tmp/roadster-three.min.js verification/crash-tail-release/screen-runtime.json
    node verification/reference-model-runtime-check.cjs /tmp/roadster-three.min.js verification/crash-tail-release/player-runtime.json
    node verification/reference-wheel-batching-runtime-check.cjs /tmp/roadster-three.min.js verification/crash-tail-release/wheel-runtime.json
    node verification/npc-traffic/runtime-check.cjs /tmp/roadster-three.min.js
    ROADSTER_TAIL_BASELINE=caada63c6518967cbeeb3432bedca6e3fb5a5167 node verification/tail-down-runtime-scope.cjs /tmp/roadster-three.min.js verification/crash-tail-release/scope-runtime.json

The final command additionally needs the retained local crash input commit. Normal tests/build and the production-runtime geometry checks do not require unpublished input commits. CPU studio previews and static wing-pose proofs do not establish browser/WebGL behavior, GPU frame time, live mechanical motion or live ranked-service behavior.
