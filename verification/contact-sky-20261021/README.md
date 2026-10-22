# Contact and night/rain sky repair — 2026-10-21

Base: `13b9f5372034cd6ba3e14144433792c525989f63` (PR18). This is a small correctness follow-up, not a new scene or audio design.

## Preserved old failures and fixes

- **Coast oncoming traffic:** world-axis yaw AABBs were used as final contacts, including a second current-body AABB path. Native YXZ player/NPC OBBs are still separated by over 0.8–2m in the captured flat/slope/bridge failures, but the former code applied the whole opposing velocity and killed the player at ~45G. The frozen prior source lives in `tests/fixtures/contact-sky-baseline/physics-main.js`. `coast-player-contact-native.test.mjs` continuously drives those three cases at 30/60/144Hz: old dies, new remains unhurt. True same-lane head-ons still destroy at the unchanged threshold.
- **City seam respawn:** a car outside ±1190m instantly reappeared at the opposite edge even when the player occupied that location. The preceding frame can show empty ground while the solid NPC is over 2380m away. Both native models × four directions reproduced the original death. The seam now queues a visible stopped car at its original edge until player and NPC space clears, then restores its original lane, direction and speed. Actual vertical OBB bounds replace a root-height exemption, including the 90°-pitched tail case. No collision is disabled.
- **Night and rain RGB sky:** native Three r128 `CubeTexture` defaults to RGB, while each face stores RGBA bytes. Alpha255 was read as a colour in three out of four uploaded texels. Explicit `RGBAFormat` fixes the parent upload; the stored palette and exposure are unchanged. `city-skyline.test.mjs` freezes the real default and mismatched-pixel counterexample.

## Certified coastal contacts

Native player bounds and stable near/far NPC bounds use the actual YXZ pose. A root-centred swept-sphere broad phase rejects far cars before OBB/SAT allocation. Fixed orientations use exact swept 15-axis SAT, including almost-tangential shallow crossings. Rotation uses conservative advancement with directional YXZ angular projection bounds and certified temporal fallback; a solver budget is not treated as proof of no contact. Damage is based on closing **normal** speed, including the actual rotating contact feature, not the full tangential/oncoming vector. Final-pose overlap is resolved along its own minimum translation axis. A gentle real roof contact still bounces; an empty roof cushion cannot damage.

Early candidate failures are intentionally retained: initial broad-bound contact tests, a shallow-sweep missed-contact report, a rotating-response residual overlap, and a near-coplanar yaw performance hotspot. The final targeted regressions cover them. Two old synthetic coast tests were corrected to use real contact: an already-deep initial overlap now starts at an actual front edge; a diagonal descent outside the real roof stays clear, plus a separate true vertical roof contact remains positive. No business/damage assertion was removed to make an invisible collision pass.

## Performance / unchanged behaviour

- 2000 far-traffic queries: zero OBB/SAT work after the early sphere rejection.
- Constant positive vertical gap with pure yaw: ≤2 separating-axis evaluations, not thousands of temporal subdivisions.
- Existing maps' empty-scene numerical fields retain `Object.is`; 840 highway projection steps remain field-for-field equal to the base epoch.
- Audio/V8/H brake silence, input/force/clock, city layout/797 solids/35 pads/2 bridges, six-lane coast network, default ten-passenger taxi and rendering limits are byte-identical except the explicit source ownership/projection successor.

## Validation boundary and release boundary

Native Three CPU scene geometry and continuous production-motion tests are **not GPU driving**. Own cloud WebGL could not initialize, so no claim of actual GPU sky colour, exposure, device heat or user-device frame rate is made. The user's exact original collision coordinates remain unknown; these are independently reproducible defects, not a claim to have identified every incident.

This candidate is branch/PR/preview-only. Main merging auto-deploys this project, so no main merge or production action is authorized for this follow-up until separately approved.

## Later car screenshot: asset freeze and independently confirmed camera defect

A later user screenshot shows missing-looking car surfaces. The exact user height, view and zoom are not known, so **it has not been reproduced as the same incident**. Read-only native audits prove PR18 versus prior e95 has identical628-mesh geometry/index/normal/material/scale/world-transform data; the reference exterior is byte-identical to the approved f16643e source. A dedicated regression freezes all five player/NPC asset/model/loader sources.

An independently reproducible older camera defect was found: mode1 showroom orbit, default zoom.75, height80m requests near3.2m while its target is only2.915289m away; over3000 actual canopy triangles are cut. The final production camera branch now caps only near using the actual visualY/YXZ vehicle OBB depth after final camera placement. It does not change model geometry/materials, camera position/lookAt/FOV/zoom or the FPV.08m policy. It applies the projection once per frame. The old branch versus new branch roof-triangle counterexample and96 model/height/zoom/attitude combinations are tested.

Remaining framing boundary: seven independent mode1/zoom.55 samples include actual body/wing vertices at or behind the camera plane; no positive near plane can retain those. Default zoom is.75; presets are.75/1/1.25, while wheel or bracket inputs can reach.55 (intent is not inferred). These samples do not justify changing approved assets or silently changing zoom. Static neutral OBB is not a guarantee for every animated wing pose. No claim of unlimited all-pose visibility or final GPU visual acceptance is made.
