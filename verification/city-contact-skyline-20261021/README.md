# City contact + coherent skyline correction

Base main: `39169ed88babd1089954212c499c6b0a94eb55d8` (PR16).
Final contact source: `cb4ba24`; whole source hashes are pinned in source-epoch.json. Later evidence-only commits must not change them.

## Reproduced old defects and narrowly scoped corrections

- East/west NPCs used a fixed north/south contact envelope. Actual continuous road passes with >1m visible gap could cause a fatal impulse. City uses each actual variant's cached near/far union with native orientation, not the shared old highway/coast metadata dimensions.
- City traffic collision pretended NPC Y was always0. A blasted airborne car could destroy a ground player. Contact now uses its actual rendered layer.
- All city building contacts used a fixed world-axis player proxy. A continuous pass beside building0 with0.482m visible clearance could explode. Player contact now uses cached actual model bounds, native YXZ attitude and normal closing velocity; pitched roof-corner projected overlap alone cannot damage. Roof support queries are explicitly separate.
- The visible45m energy shield had an infinite-height collider. Both a default finite-tank ground-start input path and a longer climb could explode above45.3m despite no visible wall. The finite native wall/cap bounds now gate contact. Initial penetration resolves once; tangential motion has no artificial damage/drag.
- Gentle descending NPC roof bounce retains its original0.15m metadata-relative cushion separately from damaging3D body contact. It is an intentional soft support tolerance (actual curved roof may be farther below), not a claim of solid overlap. Fast descent below-18m/s cannot use this cushion: damaging roof contact requires actual3D solid overlap. True high-speed body/building/wall collisions still damage/destroy at the existing threshold.

This is oriented-box contact, not pixel/triangle-perfect contact with every curved body detail. Missing legacy skybridge collision was not a cause of these air explosions and is not newly advertised as fixed.

## Static art correction

Three related modern ceramic/concrete/glass families share a cool mineral palette and human-scale metre UV modules. Remove incoherent brick/warehouse/hotel mixture and64 redundant frontages:163 logical buildings remain, original99 core collider/function definitions,35 refill pads and both bridges retained. Flat avenue paving adds no raised obstacle. Day uses a cached128px×6 direction-continuous gradient/cloud cube for sky/reflections, soft lighting and no visible sun object. Night/day material changes reuse maps/instance payloads. Sky generation/upload is event-only, not per frame.

`scene-budget-final.json` is the actual current/native scene ledger. It is not a device FPS or temperature claim. `render-study.mjs/.py` uses actual production meshes/instances/UVs/textures/sky with CPU z-buffer and approximate lighting, explicitly not PBR/exposure validation.

## Acceptance boundary

Own cloud browser at the formal URL2026-10-21T11:32:59Z failed Three r128 WebGL context initialization (`THREE.WebGLRenderer: Error creating WebGL context`). No game3D image or GPU driving acceptance was obtained. Connected user devices were not task-authorized and were not started. The included full-street CPU studies are diagnostic, NOT game screenshots. Actual-device whole-scene visual acceptance remains open and must be checked with the user's screenshot/play feedback.

Initial unrestricted-concurrency full run is retained as FAILED (`full-test-initial-failed.log`):787 aggregate/770 pass/17 fail;4 contact/pose fixtures and4 Color mocks were corrected,9 test-file processes terminated without a substantive assertion diagnostic. The first bounded run was explicitly interrupted (exit130) on a newly proven fast-roof cushion ghost; see full-test-interrupted-24b-roof.log and the preserved old NPC-step fixture. The final complete bounded-concurrency run must finish successfully before publishing. Never count this failed initial run as final acceptance.

## Final release checks

Complete bounded run:960 total,958 passed/2 fixture TypeErrors,1033897.637441ms. Only the simplified jet-effects fixture was corrected (no production-source change); its complete12 cases then passed in5527.521371ms. Combined unique coverage960 resolved/0 unresolved; this is explicitly NOT one single all-green run.24 Lua,29 projection identity guards+3 mirror guards,840 exact old/new projection steps, deterministic bundle/check/build passed. See final-verification.json and both original/focused logs. Production source pins remain exactly ac5db8d.
