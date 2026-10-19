# Unpublished Roadster visual candidate

The visual branch is based on released functional main `a969071` (highway overtaking and silent 0 refill included). It remains local and unpublished. User visual review is required before any release. Physics, input, audio, traffic behavior and the classic options are not part of this visual patch.

## Current front-reference revision

The first supplied front photo (`084437`) is the priority. The previous level-front preview exposed specific shape errors: outer-corner lamps, rounded shoulder crowns, a low cross-nose bar and overly tall painted corner faces. The current actual source moves the triangular recesses inward, replaces each upper wing with an actual planar triangular panel and curved outer wrap, raises the cross-nose datum 50 mm, and shortens the painted corner faces 100 mm. The approximate matched front camera was rendered at 48 samples and reviewed independently; it is clearly closer in the basic wing/lamp relationship, but it is not a final likeness verdict.

The lamp aperture is clipped from the actual continuous shoulder mesh. A curved internal liner joins its boundary to the inset optic. Projector and indicator surfaces have forward-only emitting faces. Door-waist surfaces and shutlines are shaped, and the rear nozzle carrier/diffuser have actual depth, rounded edges, recessed nozzles and modeled fins.

## Batching and preservation

Reference wheel geometry is now batched into four single-material meshes per wheel under the unchanged original spin/steer handle: 148 wheel meshes become 16. The runtime equivalence verifier compares oriented world-space material/position/normal/UV fingerprints in three animated poses. Classic geometry/material hashes and all six NPC variants remain exactly equal to main.

Current player scene counts before culling: 261 color meshes / 125,590 triangles, compared with 314 / 103,297 in the released main. These are scene-graph mesh/triangle counts, not measured GPU draw calls, FPS or input latency. There are still two invisible shadow proxies. Adaptive shadow resampling produces 14,548 triangles with maximum sampled combined surface deviation 0.011588 m. The visible geometry is unaffected by shadow decimation.

## Evidence status

- First candidate five-view actual-mesh render set is archived and was shared only as an intermediate.
- Second-pass source was fully tested after rebasing onto main, before the newest front-specific dimensions changed.
- Current front-specific unit tests and exact Three.js preservation/optical-ray checks pass. The final full run passes 345 Node tests, 24 Lua tests, syntax/deterministic bundling and build after corrective cleanup. All sixteen projector rays are unobstructed from both horizontal and matched-inspection front cameras.
- Offline previews export the canonical Three.js r128 geometry and use Blender Cycles CPU, with no reconstruction, remeshing or generated image content. The supplied photo is preserved untouched. Camera match and material translation are approximate.
- Browser/WebGL rendering, in-game GPU performance, animation and touch interaction are not established by CPU renders or Node tests.

See ACTUAL-MESH-PREVIEW.md for reproduction and renderer limitations, and REFERENCE-WHEEL-BATCHING.md for vertex-preserving batching evidence.

## Independent latest-front verdict and known limits

Clearly closer in the broad planar wing, inward triangular lamp, cross-nose
height and shorter-cheek relationship. Remaining visible differences: the
splitter is thick and strongly bowed instead of integrated into the intake;
lower fascia, outer corners and glass outline
are simplified. The earlier tiny carbon-sill tips were traced with exact pixel rays and
removed by terminating the leading sill/arch returns behind the bumper.
Pocket-wall attachment drift was fixed from 39.8 mm to under 0.1 μm.
The corrected image has not been retouched. Visual edits are frozen pending the user's feedback.

A complete regression initially caught zero vertex normals at collapsed
triangular parameter poles. The source now uses the analytic plane/nearest
noncollapsed-row limiting normal, with no position, material or topology
change. The cleanup render preserves its actual source hashes. A separately exported
current source differs only in cached FPV-hidden shoulder handles; exact
canonical-visible-scene equivalence is proved without relabeling render hashes.

## Frozen final verification

- 345/345 Node and 24/24 Lua tests; syntax, deterministic bundle and build pass.
- Exact r128: 117,600 instrument rays and 39,200 road rays, zero blockers;
  138 rear rays, zero gaps; unchanged spinning-wheel bounds.
- Sixteen projector rays from horizontal/inspection cameras are unobstructed.
  Sixteen former-spike pixel rays hit no sill/arch-return mesh.
- Classic and six NPC hashes match main. Cached view synchronization retains
  zero recursive lookups; the newly raised front panels use the same FPV-hidden
  shoulder domain and restore externally.
- Wheel batching retains all 10,408 oriented triangles, original normals/UVs
  and animation pivots, with only the documented Float32 position bake.
- Player scene: 261 color meshes versus released 314; visible triangles
  125,590 versus 103,297. Two proxies total 14,548 shadow triangles with
  maximum sampled deviation 11.588 mm. No GPU performance claim.
- Canonical CPU preview: 255 meshes / 125,578 triangles. Every exterior normal
  passes; only eight pre-existing yoke winding disagreements remain.

Machine-readable current-source, photo/render provenance, visible equivalence,
cleanup scope and test/runtime summaries are saved as `front-reference-*.json`.
No source outside the reference render modules and generated bundle changes
functional behavior from `a969071`. The candidate remains unpublished.
