# Unpublished side-calibrated player candidate

Status: frozen for user review; not pushed or deployed. Branch `visual/sloping-nose-candidate`.

## What changed

The new side reference 113142 faces left. Its original pixels were never mirrored or reshaped. Wheelbase/front-radius ratios agree closely with the prior model, so the wheel/axle/cabin coordinates stay fixed. The old white wing high point was 0.74 m ahead of the front axle. It now sits at z=-1.400, only 0.04 m ahead of that axle. The forward hood and outer crest envelope fall continuously toward a 0.475–0.490 m high nose. The visual front overhang is 0.16 m shorter, with the mask, splitter, badge and returns moved coherently. The front light apertures remain actual cut, lined recesses on the planar wing. Collapsed Float32 triangles at the two wing tips are omitted.

The existing rear white bridge now closes exactly against the lower beam and rises 80 mm at its outer lower corners. Existing thin diffuser divider grids curve in depth and inward at midspan; no additional grids or visible mesh submissions were added. Current four reference nozzles were already recessed; their geometry, gimbal and functional plumes remain unchanged.

Live main `683f6fd15331d619866b8433520b25d36a75d216` is merged. Its fixed physical cabin screen shares the live texture; the larger projection-sized FPV pod is hidden externally for both exterior and both cockpit choices. The older visibility-only candidate logic was removed.

## Exact previews

`nose-candidate-final/` contains exact production Three r128 mesh exports and Blender Cycles CPU renders, not browser/WebGL screenshots. White paint and neutral studio lighting are unchanged. The user-facing `nose-tight-side-comparison.png` shows reference / previous version / new candidate, cropped and uniformly scaled to the same 580 px wheelbase. The supplied photo is unmirrored. Crop coordinates, uniform scales, source-photo hash and actual source hashes are retained in `nose-preview-provenance.json` and the local render directory.

The side view is approximately matched; real photograph camera and lighting are unknown. The first-front comparison, oblique rear detail and elevated rear comparisons remain available as inspection evidence. Their camera differences are disclosed. Raw unmodified full-frame images remain retained.

## Limits from independent review

The side correction clearly removes the high forward shelf and establishes the requested downward wedge. Complete likeness is not established: the front lamp apertures still appear taller/narrower than reference 084437, the canopy outline differs, and the black lower rear divider curves remain hard to judge under this neutral studio view. Do not describe the rear detailing as fully matched. No new blocking holes, flipped surfaces or invalid front-panel normals were found.

## Preservation and budgets

- Exact nose-scope comparison: 257 opaque preview meshes both before and after; 119,038 -> 118,700 triangles. Every material and world matrix remains exact. All window/canopy/wheel/jet meshes remain exact against the crowned-window model with the same live screen fix.
- Actual player: 263 color meshes, 118,712 color triangles including transparent effects; two shadow proxies, 13,744 shadow triangles. Maximum sampled proxy deviation 11.573 mm. These are CPU scene-graph counts, not measured GPU draw calls or FPS.
- Every non-rendering source file matches functional main683f6fd byte-for-byte, preserving mobile/flight/audio, stable per-car traffic behavior and the hidden zero-key refill.
- Exact official-r128 checks: 117,600 instrument rays and 39,200 road rays, zero blockers; 138 rear rays, zero gaps; 212 glass-clearance rays and 636 exterior occlusion rays across all four body/cockpit configurations pass.
- Classic configuration and six existing NPC geometry/material/pose hashes match main683f6fd. View-sync recursive lookups remain zero. Batched wheels retain exact oriented-triangle/normal/UV fingerprints in three animation poses.
- Rejected attempts remain lossless in immutable catalog-v3: 20 entries / 12 distinct geometries, including crowned-window-2d4bbf7. All 1,096 prior archive files are unchanged. Failed seam-producing derivatives remain quarantined. A separate NPC worker owns clean, bounded runtime random reuse; no raw high-detail NPC clones are activated here.

## Validation

All 363 Node tests pass in split runs after the screen merge: 355 non-archive tests and eight archive integrity tests. The first combined run did not finish its archive child while concurrent heavy tasks were running; its cause was not captured. The same eight archive tests subsequently passed in isolation. A redundant combined rerun was deferred when the user requested the next rear/wing revision. Lua24, deterministic bundle, syntax/DOM/deployment checks, build, exact production mesh scope, cockpit clearance, gameplay-view clearance, wheel batching and shadow budget checks pass. Final regression summary is saved separately when the serial run completes.

No browser/GPU/touch verification is claimed. Future integration must preserve the separately developed NPC runtime changes and repeat relevant counts/clearance checks.
