# Invisible NPC traffic — diagnostic preview, 2026-10-21

## Open issue, not a claimed fix

The user reports driving into empty road and being unable to see any other cars. Logs2/3 identify `traffic-body` contacts with two different historical NPC variants, including a straight road at X6. These are distinct from log1's building-wall record. The first record's static CPU geometry match **does not disprove the user's on-screen observation**. The NPC display failure remains unresolved until runtime evidence or visual reproduction identifies it.

Two minimized NPC fixtures preserve the last row/contact/result, not the full user traces. `tests/city-invisible-traffic-incidents.test.mjs` reconstructs their final motion/contact under stated inferred NPC-speed/yaw and hidden rack/lateralG assumptions. Both match nine pose fields and incoming normal velocity within1e-11 (deltaV exactly). This demonstrates the collision path, **not GPU visibility**. V2 records omit camera, render state and build identity; they cannot locate an invisible-display failure or identify the loaded commit by themselves.

## Minimal diagnostic-only change

- A deterministic `RoadsterBuildInfo.id` hashes every bundled source input, CSS/template and the bundler. It is a source-content identity, not a fabricated Git SHA. Matching the served preview to a commit remains a separate readback step.
- V3 collision reports attach a bounded, cloned local render snapshot at impact. The previous96-row trace is retained. Diagnostic failures cannot prevent collision processing.
- A separate module records real Three scene/mesh render-callback paths for at most eight nearby NPCs/six children each. Existing callbacks remain invoked; weak references avoid retaining removed traffic populations. The impact target is included when identifiable.
- Evidence includes local and last-presented world matrices, visible ancestor chains, scene attachment, camera layers/projection/near/far, stored-sphere frustum checks, variant/LOD/material/index/drawRange data, existing shader-program diagnostics and context-loss events.
- Hooks mean **CPU render-path/submission attempts only**. They do not certify GPU completion, unoccluded pixels, perceived contrast, or the absence of a shader/device failure. Stored matrices/bounds are observed, never silently repaired.
- No geometry, material parameters, scale, model files, physics/collision rules, damage thresholds, speed, camera placement/FOV or gameplay inputs change. The observer does not call `getError()` or perform GPU pixel readback. No network transmission or persistence is added; the user explicitly copies the local report when sharing it.

## Reproduction boundary

Native checks find valid visible near/far NPC shells under the examined source, but cannot establish the user's GPU result. Local Chromium startup was blocked by required local-socket permissions; one ordinary escalation failed in runtime filesystem setup before launch. Existing cloud-browser CDP navigation/runtime-binding calls timed out. No GPU driving or pixel-visibility acceptance is claimed.

This revision is PR19 branch/preview only. Main and production are not authorized. The preview is for collecting the missing display evidence, not a promise that invisible NPCs are fixed. A screenshot with weather/view information and a V3 report can connect the user's observation to the exact source/render path without altering approved art or hiding collisions.
