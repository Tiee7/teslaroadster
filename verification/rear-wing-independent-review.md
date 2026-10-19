# Independent review: final wing, rear bumper and windshield

Verdict: pass, with the likeness and validation limits below. No source was edited and no further render jobs were started.

Reviewed exact final export and snapshot, exterior SHA-256 `b02f840f42fe0138fe5ecd8efb5efd05e5ee8b89d6c495b54fdfa4b04b5173f5`, against original photos 084440, 084441, 113142, 113143 and 113144, the compact before/after sheet, native rear three-quarter view, windshield comparison and four static wing-pose views.

## Useful findings

- Clear improvement: the thick oval nozzle surround is now a shallow straight-run shelf; the white rear bridge has real outboard concavity and an underside return. The diffuser backing has physical channel depth.
- The wing is a swept/tapered blade with thin closed endplates and curved supports. Detached box towers are removed.
- The front windshield is genuinely flat and raked, rather than only appearing flat under a particular camera. Its 675 vertices deviate by at most 6.46e-8 m from one plane at 27.24° to horizontal; all share the same outward normal, with at most 5.53e-9 error. Roof and outboard glass remain separately shaped.
- Both concave support caps have six correctly wound triangles per cap. Their total area matches the outline within 2.23e-10 m². Both supports, both endplates, and the 1512-triangle diffuser backing have zero degenerate triangles and zero bad welded edges. Their signed volumes are positive. Edited exterior faces have no face/stored-normal disagreements. Eight pre-existing yoke triangles remain outside this edit.
- Six focused Node tests passed independently. The existing screen-ray proof reports 123.6 mm minimum reference-glass clearance with matching final source hashes.

## Rear-ray depth assertion

The old z >= 2.1 test described the old flat backing. The new intended channel front skin reaches z = 2.0025, while its sealed back cap is z = 1.93. A backing-only bound of z >= 2.00, together with closed-manifold, nondegenerate-triangle, bounded-volume and nearest-front-skin checks, is a defensible semantic update. All other target meshes should retain the previous 2.1 bound. Interior channel hits can additionally be identified by faceIndex < 1152; side-wall boundary hits should be distinguished.

## Functional pose provenance

Physics hash matches the existing four-pose proof. Independent semantic comparison confirms that only the diffuser backing changed between the first-pass and final exports; all ten active-wing meshes are exactly unchanged. Therefore the wing-only proof transfers to the final wing. Rest/deployed/flight/air-brake targets remain (Y, pitch) = (0.79, -0.05), (0.94, -0.05), (0.94, -0.28), (0.96, -0.72).

These are static target transforms, not live driving-animation or mechanical-anchoring validation. The prior whole-car pose images still contain the first-pass diffuser and must not be relabeled as final whole-scene renders.

## Remaining limits

- No exact-match claim: photograph cameras and lighting are unknown. The regular rounded-rectangle carrier and rectilinear lamp surround/plate pad still differ from the reference’s more subtly tapered/chamfered transitions.
- The white bridge has stronger localized studio highlights; the diffuser is dark at 16 CPU samples. Material translation and fixed studio lighting affect this appearance.
- The raised side-photo wing is a pitched operating state. The standard comparison is the unposed construction state; the separate air-brake view is the relevant state comparison.
- No obvious daylight holes or inverted edited surfaces appear in the inspected views. The topology result applies to the named closed solids, not a claim that the entire car’s surface assembly is one globally watertight mesh.

No further redesign is proposed in this review. Full metrics and evidence paths are in `rear-wing-independent-review.json`.
