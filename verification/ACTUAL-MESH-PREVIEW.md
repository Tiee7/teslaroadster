# Actual source-mesh preview verification

These are CPU studio renders of the actual canonical meshes returned by
`window.RoadsterVehicle.getPreviewModel()`, using the official Three.js r128
runtime. They are not browser or WebGL screenshots, artist concepts, image
synthesis, or reference photographs.

## Reproduce

From the repository root:

```
node verification/export-actual-preview.cjs /path/to/official/three-r128.min.js verification/visual-candidate
blender -b -noaudio --factory-startup --python verification/render-actual-preview.py -- verification/visual-candidate
python verification/label-actual-preview.py verification/visual-candidate
python verification/compare-actual-preview.py verification/visual-baseline verification/visual-candidate verification/visual-comparison
python verification/compare-reference-photos.py verification/visual-candidate verification/visual-comparison /path/to/supplied-reference-images
```

For iteration only, append selected view names after the render directory, such as
`front-three-quarter rear-three-quarter side`. `ROADSTER_PREVIEW_SAMPLES=16`
can lower sampling cost; compare renders must use the same settings.
`ROADSTER_PREVIEW_RESUME=1` safely skips views already completed in the audit,
only when source hashes and samples are unchanged. The archived first candidate
uses 48 samples and all five views. The latest user-directed revision prioritizes
the optional matched reference-front view at 48 samples; other archived angles
are not evidence of the newest front geometry.

The third exporter argument optionally selects a frozen source directory.
`visual-baseline/source-snapshot` contains the baseline source files captured
before the current fidelity revision. The bundled Three.js build is not copied
into the repository. `/tmp/roadster-three.min.js` is the official runtime used
for the local verification run.

## Fidelity and limits

- Export includes each visible mesh's original vertices, vertex normals,
  indices, material groups, material properties, full world matrix and name.
- Production shared materials are loaded from the relevant declarations in
  `src/world.js`; other geometry modules are executed with only the same
  CPU-compatible DOM/storage stubs used by the existing runtime checks.
- Preview selection is the reference exterior and reference cockpit in the
  canonical neutral pose. Invisible meshes, shadow-only proxies and transparent
  effect meshes are excluded. No geometry is invented to replace any exclusion.
- Blender maps Three `(X,Y,Z)` to `(X,-Z,Y)`, preserving handedness. Negative
  determinant transforms have triangle winding reversed after transformation,
  matching the Three.js renderer's treatment of mirrored transforms. Vertex
  normals use the inverse-transpose matrix. Material FrontSide/BackSide culling
  is represented with a transparent backface shader; DoubleSide stays two-sided.
- No remeshing, subdivision, smoothing modifier, repaired geometry or artistic
  redesign is applied. Original vertex normals control smooth shading. The
  accompanying render audit reports geometric-normal disagreements instead of
  silently repairing them.
- Added geometry is limited to a neutral presentation floor. Lights and cameras
  are a neutral studio setup. All before/after views use the same script,
  material conversion, light positions, exposure and camera parameters.
- The renderer is Blender Cycles CPU at 48 samples. The local Blender build has
  no OpenImageDenoise support, so no denoising is used. A small amount of sampling
  noise can remain, especially in dark reflectors.
- Source color channels are interpreted as sRGB and explicitly converted to
  linear light for Blender. Exposure is 0, world strength is 0.2, and all renders
  use the same half-energy softbox setup to keep dark materials readable. The
  front key is a 2×5 strip at (-3,-1,6); the rear rim is a .7×5 strip at
  (-3.8,-4,5), avoiding a broad white reflection covering the rear glass.
- Material translation is approximate, as Three.js and Cycles are different
  renderers. Environment-map appearance, bloom, tone mapping, browser rasterization,
  actual in-game shadows, animation and GPU performance are not established.
- `manifest.json` records source SHA-256 hashes, model configuration, bounds and
  exclusions. `render-audit.json` records normals, mirrors, counts and exact
  cameras. `actual-preview-meshes.json` is the complete intermediate geometry.
- Individual labeled PNG files and `contact-sheet.png` add honest labels only;
  raw rendered pixels are preserved below the header without retouching.

The photograph comparison preserves the supplied reference photos without cropping
or retouching. Labels explicitly distinguish photographs from actual mesh CPU
previews and disclose different camera positions, focal lengths, pose and lighting.
Reference filenames and SHA-256 hashes are recorded in the comparison provenance.

## First completed candidate provenance

All five latest-source candidate views have completed after the last curved
lamp-bridge and number-plate clearance corrections. The front-three-quarter
view completed first; after Blender was externally killed with exit 137, a
single four-thread process resumed only the remaining four views after the
authorized five-minute retry interval. The render audit records this recovery.
All individual labeled views, the candidate contact sheet, the matched
before/after comparison and supplied-photo comparison were regenerated after
all five views completed.

The source snapshot, complete mesh export, manifest and render audit now refer
to the same frozen first-candidate source revision. The candidate includes 387 visible meshes
and 119,320 triangles. Every exterior mesh passes the geometric/vertex-normal
audit; eight pre-existing yoke triangles remain documented. The frozen baseline
geometry and final studio lighting are unchanged. The equivalence verifier
remains available for future shadow-metadata-only checks; it does not replace
rerendering after visible-geometry changes.

## Optional approximate reference-front camera

Appending `reference-front` selects an optional 1040×585 level perspective
view without changing the original five inspection views. It uses Blender
position (0,6,0.8509439655), target (0,0,0.8509439655), horizontal sensor 36 mm,
focal length 56.7414768 mm, shift_y -0.0804165091 and shift_x -16/1040. The negative shift sign
was verified in the renderer: the roof-center landmark projects to y138.1
and the original straight-splitter landmark to y530.3. Horizontal shift aligns
the roof center to x536.0. The revised raised-center splitter intentionally no
longer occupies the old splitter-center landmark. The original photograph's camera
is unknown; this is an approximate framing match, with different lighting,
not a pixel-equivalent reconstruction. The source photograph is preserved
without cropping, warping, recoloring or retouching in the side-by-side.

Example: `ROADSTER_PREVIEW_SAMPLES=16 blender -b -noaudio --factory-startup
--python verification/render-actual-preview.py -- EXPORT_DIR reference-front`.

## Latest first-front revision

The latest front candidate replaces the twisted longitudinal crown with a
planar triangular folded wing and a curved outer wrap. The lamp is physically
cut into the same plane, with real inner/rear returns into the hood/body.
The front lower lip is contoured instead of a straight full-width plank.
A full regression found zero-length normals at the collapsed triangular
parameter poles; these are assigned their analytic or one-sided limiting
normal without changing positions, materials or topology. The refreshed
verified front export/audit records the exact post-fix source hashes.

The supplied first-front reference is paired using:

    python3 verification/compare-reference-front.py EXPORT_DIR /path/to/image(20261019-084437).png

The final frame remains an intermediate candidate. Independent pixel review
confirms the basic wing/lamp relationship is closer, but the splitter is too
thick/bowed, the lower fascia/outer cheek/glass
outline remain simplified. Corrective cleanup fixes the planar pocket inverse
and terminates leading sill/arch-return ends behind the bumper, removing tiny
points previously traced with exact pixel rays. Neither change is retouched
in the image. The latest render and current-source visible-equivalence
provenance are saved as `front-reference-*.json`. No publication
or GPU-performance claim follows from this render.

The final cleanup render uses the source hashes in `front-reference-render-audit.json`.
The subsequent cockpit-only cached FPV visibility-handle update is exported
separately; `front-reference-visible-equivalence.json` proves bit-for-bit equality
of all canonical visible geometry, normals, topology, material/group properties
and world poses. Render hashes are preserved unchanged. FPV behavior itself is
verified separately by the exact production-runtime instrument/road ray checks.

## Optional top inspections

`top` uses an orthographic camera at (0,0,10), roll +90 degrees,
1200×760 and scale 5.65. The car front points right. `reference-top` uses
700×544, scale 11.10, shift_x -4/700 and shift_y +27/700. The positive
vertical shift was verified in Blender to place the origin at (354,299);
the proposed negative vertical shift would place it at y245. This framing
projects the current car bounds to approximately 294×128 pixels. These are
optional cameras only; the original five inspection cameras are unchanged.

## Window-only continuation

The new unpublished branch starts from preserved 1bf6034. Latest window views
are recorded in `window-evidence.json` and `window-render-audit.json`; the source
hashes match all four 16-sample actual-mesh views. Exact scope checking proves
only eleven window/canopy meshes changed and all other 244 preview meshes,
normals, indices, materials/groups and world poses are identical.
`WINDOW-STRUCTURE-CANDIDATE.md` documents the source-photo interpretation,
independent visual review, limits and preserved rejected-model asset library.

## Optional left-side and rear-detail inspections

`reference-side-left` is a level orthographic camera at (-10,0,.55),
550×688, scale 7.38, shift_x 2/688 and shift_y 0.0344858840. Its verified
horizontal field is 5.900 m, ground y419, origin x273, and roof y315.1.
The model front points left without mirroring any source photo. Model wheel
centers project to (146.2,389.2) and (401.7,386.4); this is an approximate
reference alignment rather than a wheelbase or camera-equivalence claim.
`rear-detail` and `reference-top-rear` are optional approximate perspective
inspections for the newer supplied photographs; their prepared parameters
are recorded in nose-baseline/reference-side-camera-verification.json.
The original inspection cameras remain unchanged.
