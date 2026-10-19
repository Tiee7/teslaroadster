# Independent final nose review

Freeze: `verification/nose-candidate-final`, exported 2026-10-19T11:47:34.657Z.

## Finding

- The shorter nose now slopes down toward the front. The previous forward high platform is gone; the source photograph and actual side render both face left.
- Front apertures are intact, but the visible lamps remain tall/narrow compared with the broader, shallower source triangle. Approximate left-lamp screen contour: 48 × 82 px.
- The white rear bridge now rises toward the outer corners. The dark lower diffuser fins remain hard to distinguish, including in the final oblique view. Their detailed visual likeness is therefore unverified.
- This is a scoped improvement, not a complete-likeness claim. The photograph camera is unknown; studio lighting and 16-sample CPU noise differ.

## Independent geometry checks

- 36 exterior meshes, 6,654 triangles checked: no zero-area triangles, opposed face/vertex normals, or zero normals.
- Maximum lamp-pocket outer-edge attachment error: 6.710477168e-08 world units. All seven diffuser-fin top caps match both side surfaces exactly.
- UV clipping has a residual maximum 0.167474 mm paint intrusion, with summed XY overlap 0.158136% of aperture area. This is visually negligible, not mathematically exact clipping.
- Final export: 257 meshes / 118,700 triangles. All 255 geometry instances from the preceding candidate are unchanged; only interior-live-instruments and interior-screen-housing were added.
- Existing renderer-wide audit separately reports eight normal/winding disagreements on reference-yoke-padded-rim. That cockpit item is outside this exterior audit; no new exterior blocker was found.

## Freeze hashes

Export SHA-256: `081bfbb86c452fb2ad184139b0088147c333a305aca91fc2583d58162988e380`

All five current source files match the final export:

- world.js: `bf166846dbf7019cfbbaa1d583c97b91ea4a376f1e6ab1c21a62c2808c785cf1`
- vehicles.js: `ab7b722e05b9502570ad55be08434ce4b4bce69c5525859760c15131dd2dd7e8`
- reference-exterior.js: `886178971f527fa1e12a88e9391e84bee571211c75c1ee5633485732dd57a489`
- reference-cockpit.js: `9dc593f32e3eb60f9bcce6971ff7b362b27b4414e6c7d27d4cb27c270e5c3ac0`
- reference-traffic.js: `12b9bf36c778c4dc2ec04e0a86fc70fd02d457f89f61d6b9f92e4fb42605c3bb`

## Viewed final artifacts

- `verification/nose-candidate-final/nose-tight-side-comparison.png`
- `verification/nose-candidate-final/reference-front-raw.png`
- `verification/nose-candidate-final/rear-detail-oblique-raw.png`
- `verification/nose-candidate-final/reference-top-rear-raw.png`

The JSON companion records per-mesh checks, exact image hashes, aperture coordinates, and methods. No source edits or commit were made.
