# Independent review: final downward-tail candidate

Verdict: pass for this bounded geometry revision. No source was edited, no additional render jobs were launched, and no heavy runtime ray jobs were run by this reviewer.

Final exterior SHA-256: 3d99d3652f09b4b4a0fabb589674b70bb0cafde81ac0d6d4906128ea01a8c782. The current source, actual-mesh export, manifest and final CPU render audit all match.

## Result

The true upper-body silhouette falls aft more clearly in the final side render. Source crest landmarks change from a 38 mm fall over 880 mm to a 138 mm fall, approximately 8.91 degrees mean descent. The terminal shoulder crest receives 100 mm additional drop. This is an inferred multi-view improvement, not an exact reference-camera match.

The two intermediate attachment issues are resolved. First the rear buttresses/rails, then the final 330 mm of central panoramic canopy, were included in the same position/normal mapping. All 26 formerly shared canopy/rail edge-position groups remain coincident in the final export. The buttress tip's nearest actual body-surface distance is now 0.698 mm on both sides, compared with 0.876 mm before this edit; the intermediate 31.8 mm gap is absent.

## Exact export checks

- 255 visible meshes and 121,376 triangles; 26 meshes and 6,278 vertices change.
- No topology/index, material-group or world-matrix changes. All material properties remain unchanged.
- No new degenerate triangles, inversions, nonfinite positions or welded-vertex splits.
- No edited-face stored-normal/winding disagreements. The same eight pre-existing yoke triangles disagree outside the edit.
- All normals are finite and unit-length within 4.1e-8. The inverse-transpose Jacobian is correct for the warped smooth panels, with minimum vertical derivative approximately 0.3865. The two rear buttresses remain individual planes: their normals are recomputed from their actual deformed triangles, identical at all three vertices, with zero spread and maximum face-normal error 1.08e-8. This avoids fictitious smooth curvature on those planar triangles.
- windowStructure.buttressTail now uses tailDownSample(buttressTail), so its metadata follows the actual lowered attachment instead of retaining the old height.
- Every exported vertex at z <= 1.38 or y <= .635 remains unchanged. Wheel-arch protection is additionally enforced by the source's height cutoff.
- Front windshield, side panes, cockpit, wing meshes/poses, nozzles, diffuser, plate relief and reversing camera are unchanged. Only the aft central panoramic glass/roof portion beyond z=1.38 participates. The jet-pocket header changes by at most 0.15 mm; it is not one of the nozzle mouths.

## Final image inspection

Viewed the final 1200 x 760 tail-side-left-raw.png and rear-inspection-three-quarter-raw.png again after the planar-normal/metadata corrections, backed by the matching final render audit. The descending shoulder/upper transom, lamp recess, white bridge and separate four-mouth jet assembly remain readable. No visible daylight seam or inverted tail surface appears in those views. The continuous red strip remains approximately 5 mm tall; the black recess is approximately 49.5 mm tall. This compression is coherent for a thin light-bar treatment, although the reference's exact fascia proportions remain uncertain.

Wing geometry/operating targets remain fixed, so its visible separation above the lowered body increases. These are unposed actual-mesh CPU inspection renders, not live flight-pose or mechanical-anchoring validation. The old reference-side-left-raw.png in the candidate directory is stale and was excluded from the final verdict.

## Limits

The source photograph has an unknown camera and an operating wing state. The retained wheels, front end, materials and wing are not an exact photographic likeness. Studio material translation, lighting and 16-sample CPU noise affect surface appearance. Geometry checks do not establish whole-car global watertightness or browser/WebGL performance.

Detailed measurements and evidence hashes: tail-down-independent-review.json.
