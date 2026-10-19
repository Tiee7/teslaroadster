# Downward rear-body candidate

Local candidate based on released `cf3e7729c863e3d40e4645c0dbe83ab556d51ade`. Publication is owned by the parent task after candidate review. The existing fifteen compact NPC styles, traffic/scoring, controls, mobile, flight, sound and screen module are unchanged.

## Reference and bounded correction

The new supplied side photograph is `image(20261019-132753).png`, front left and tail right. Its wheel centers are approximately (151,225)/(452,207); preserving that original attitude while measuring relative to the axle line gives an uncertain upper-tail drop of roughly .11–.16m. The image supports lowering the fixed rear body, not a unique spoiler pitch. It is blurred and slightly yawed, so no exact camera/angle fit is claimed.

The prior rear shoulder crest fell only .038m between z=1.38 and2.26. This candidate adds .100m terminal drop, yielding .138m total / approximately8.91degrees. A smooth monotone mapping begins aft of the unchanged rear axle; its height cutoff protects the wheel opening plus15mm. The rear shoulders, central deck, upper lamp surround and bridge share the mapping. The last330mm of central rear panoramic glazing and aft buttress/rail feet follow the deck so they do not hover above it. Front windshield and both side panes stay exact.

The plate relief, camera, four nozzle mouths, jet gimbal/plumes, lower diffuser, all wing geometry and operating targets stay exact. The small carbon header changes by at most .15mm at its highest outboard edge. No visible mesh or color-triangle count increases. The rear lamp recess becomes approximately49.5mm high and the red strip5mm high; reference fascia proportions remain uncertain. The unchanged wing consequently stands farther above the lowered fixed body.

Construction uses a positive-Jacobian position map and its exact inverse transpose for smooth normals. The still-triangular C-buttresses use the true uniform normal of their final plane. Surface grids/indices, material properties and mesh transforms remain unchanged. Two independent attachment-review failures were corrected before final freeze: all26 shared canopy/rail position groups now remain coincident, and buttress-to-body nearest distance is .698mm versus .876mm before the edit. No new degenerates, inversions or edited-face winding/normal disagreements were found. These checks establish the edited seams and retained closed diffuser, not global watertightness of every pre-existing vehicle panel.

## Actual images and retained source

`tail-down/tail-down-side-user-comparison.png` compares the supplied reference, released baseline and candidate. It uses exact uniform XY scaling and wheelbase alignment, preserving the photograph's original flight attitude. Neither photograph nor model is mirrored, reshaped or retouched. `tail-down/tail-down-rear-user-comparison.png` compares baseline/candidate with identical camera,16sample Cycles CPU lighting and crop. Both come from actual production Three r128 exported triangles and stored normals, not an image-generated concept or browser screenshot. `tail-down/preview-provenance.json` records hashes, source identities, exact camera and crop/scale transforms.

Full actual exports, raw views and the original exterior/cockpit source snapshot remain local in ignored `tail-down-baseline/` and `tail-down-candidate/`. The baseline is additionally preserved in `archive/player-tail-before-cf3e772` and the published Git history. `tail-down/preserved-baseline.json` records its exact export and source hashes. It is available for a later bounded NPC retopology batch; this revision does not claim that this newest snapshot has already joined the existing fifteen live variants, and never replaces those production assets with a raw high-detail clone.

## Verification

Final results and exact source hashes are recorded in `tail-down/regression-summary.json`; supporting logs and JSON accompany it. Independent review: `tail-down-independent-review.md` / `.json`.

CPU cost proof compares the exact published baseline to this candidate:261color meshes,121388color triangles,2shadow proxies/14020shadow triangles unchanged. All30 explicitly selected NPC samples and all classic configurations retain exact appearance hashes. Re-sampled maximum shadow approximation deviation remains11.573mm; cached stable view synchronization still performs zero recursive lookups. This is pre-culling CPU evidence, not measured GPU draw calls, input latency or FPS.

Reproduce:

    ROADSTER_THREE_RUNTIME=/tmp/roadster-three.min.js node --test --test-concurrency=1 tests/*.test.mjs
    python3 tests/lua_runtime.py
    npm run check && npm run build
    node verification/cockpit-display-runtime-check.cjs /tmp/roadster-three.min.js verification/tail-down/screen-runtime.json
    node verification/reference-model-runtime-check.cjs /tmp/roadster-three.min.js verification/tail-down/player-runtime.json
    node verification/reference-wheel-batching-runtime-check.cjs /tmp/roadster-three.min.js verification/tail-down/wheel-runtime.json
    node verification/npc-traffic/runtime-check.cjs /tmp/roadster-three.min.js
    node verification/tail-down-runtime-scope.cjs /tmp/roadster-three.min.js verification/tail-down/scope-performance-runtime.json

For later integration with a newer functional commit, set `ROADSTER_TAIL_BASELINE` to that reviewed pre-visual commit for the last scope proof. Regenerate the root bundle from merged sources; do not overwrite a newer scoring/respawn bundle with this baseline's generated bundle. All player/NPC screen-ray predicates and the closed-throat rear test remain unchanged.

No browser/WebGL rendering, physical touch interaction, live wing animation or GPU performance has been verified. This is a specific downward-tail correction with explicit reference uncertainty, not a whole-car exact-likeness claim.
