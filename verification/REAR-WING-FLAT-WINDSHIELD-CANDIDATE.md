# Unpublished rear/wing and flat-windshield candidate

Frozen for user review. No push, deployment or acceptance claim. The completed nose/window/screen snapshot is preserved as `fad45ea` and `visual/nose-screen-frozen`; this iteration is `visual/rear-wing-candidate`.

## Requested geometry corrections

- Front windshield: only the front domain of `referencePanoramicCanopy`, z=-1.065..-.360, is now one raked plane between the original cowl/roof endpoints. All 675 front vertices share one limiting normal; independent maximum plane residual is 6.46e-8 m. The roof peak/outer outline and both outboard side panes are retained. The matching inner A-pillar edge follows the pane. No extra visible pane mesh was added.
- The selected reference body's small physical screen mounts20mm lower to keep at least123.6mm measured glass clearance. The classic body's mount and readable responsive FPV pod stay unchanged; all four body/cockpit combinations pass clearance/visibility checks.
- Wing: .490m center chord, .410m tip chord, swept/tapered cambered blade, thin closed8mm endplates and curved carbon supports. Two detached rectangular thickness boxes are removed. Existing physical pivot and all rest/deployed/flight/air-brake target expressions are unchanged.
- Rear: white side wings now have actual concave depth around the preserved plate attachment; an underside carbon return joins the bridge to a shallow straight-run rounded-rectangle four-nozzle shelf. Existing four recessed mouths and gimbal/plume geometry are untouched. Thin dividers now have resolved belly curvature. The old flat backing box is replaced by one closed carbon multi-channel bowl with exactly paired boundaries, retaining opaque rear coverage.

## Actual preview evidence

The two user sheets are `rear-wing-candidate-final/rear-three-quarter-tight-user-comparison.png` and `front-windshield-tight-user-comparison.png`. These are exact production Three r128 geometry rendered in Blender Cycles CPU, white paint and neutral studio,16samples. They are not browser/WebGL screenshots or generated concepts. The rear baseline/candidate use identical newly audited inspection cameras and gentle85W low rear fill. Original photographs are only cropped/uniformly scaled, never mirrored, reshaped or retouched. Photograph camera/lighting differ and are disclosed.

The front blue annotation is the actual front-pane perimeter projected through the inspection camera; it is not a planarity measurement. Geometry/normals provide that measurement. Raw images, exact frozen source snapshots and crop/projection/hash evidence remain retained locally; durable small metadata is in `rear-wing-preview-provenance.json`.

Four extra static wing-pose checks apply exact existing physics targets to the real cloned parent group. Only ten wing world matrices change. Their whole-car images contain the first-pass diffuser; they must not be relabeled as final whole scenes. The final wing geometry/material signature is exactly identical, so the wing-only proof transfers. Static targets do not verify live driving animation or physical linkage anchoring.

## Validation and bounded cost

- Full369Node tests,24Lua tests, deterministic bundle, syntax/DOM/deployment checks and build pass.
- Official-r128 runtime:117,600instrument rays and39,200road rays, zero blockers;212glass/636exterior screen rays pass in four combinations;138rear rays pass; exact wheel batching fingerprints remain unchanged.
- Deep rear throats intentionally reach z=2.0025, beyond the old flat-box z>=2.10 assumption. The revised check first proves1512nondegenerate triangles/2268oppositely paired welded edges and bounded closed volume, then accepts only front-grid hits (faceIndex<1152,z>=2.00). It never accepts the deeper z=1.93back cap. All other meshes retain the old z>=2.10 criterion. Independent review confirms this semantic change;34previous depth-only flags were genuine first-skin hits, not daylight holes.
- Opaque canonical preview:257->255meshes,118,700->121,376triangles(+2.25%). New triangles resolve actual bowl/wing/divider curvature; visible submissions decrease. Actual player:261color meshes/121,388color triangles. Two shadow proxies total14,020triangles; maximum sampled deviation11.573mm. These are CPU counts, not measured GPU draw calls/FPS.
- Exact scope proof preserves the completed front nose, both side panes, wheels, four jet mouths and all non-rendering source files byte-for-byte against the functional main683f6fd. Classic configurations and existing six NPC hashes are unchanged; stable view-sync recursive lookups remain zero.
- Catalog-v3 and all prior immutable assets are untouched. Earlier candidates remain available for the separately developed clean NPC reuse path; no high-detail raw NPC clones are introduced here.

## Independent limitations

Review passes edited topology, pane normals and pose provenance. It does not establish exact likeness. The carrier/transom/plate remain more regular than the reference's subtle tapers and chamfers. Strong localized bridge highlights, dark diffuser and different studio materials/camera affect appearance. Front lamp proportion and broader cabin/silhouette differences remain from prior feedback. No browser/GPU/touch validation is claimed.

Before eventual publication, merge the separately released NPC/traffic/scoring changes and repeat affected runtime/count checks. This branch deliberately remains unpublished until user review.
