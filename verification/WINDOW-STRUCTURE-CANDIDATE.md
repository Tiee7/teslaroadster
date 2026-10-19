# Unpublished window-structure candidate

New branch: `visual/window-structure-candidate`, starting at preserved `1bf6034`.
Functional main remains `a969071`. The user's latest request preserves all earlier
unsuccessful designs as other-car assets and adjusts the window structure of the
new player candidate. This local candidate remains unpublished and activates no new NPC assets.

## Reference evidence and interpretation

All five supplied originals were inspected. `window-reference-landmarks.json`
records visible landmarks and uncertainty. The annotated sheet uses actual
reference crops and actual prior-model render pixels, with labels/arrows only.

- Front 084437 shows the combined canopy's outboard silhouette. Its ~642 px span
  must not be treated as the central windshield width: the white wings occlude
  portions of the cowl and the photo has some yaw.
- Aerial 084438 shows a rear-tapered central black pane, separate outboard side
  glazing, and white longitudinal rails. Approximate mid-cabin ratios are 48%
  central pane /84% overall side-glass span relative to body width, with about
  ±3 px uncertainty from motion blur.
- Interior/rear 084439–084441 support a distinct acute aft side-glass point,
  straighter lower boundary and broad triangular white C-buttress. The upper
  outline retains a gentle crown; it is not a long flat roof cap.
- Single photographs do not uniquely determine depths, exact widths or glass
  angles. The selected world-space landmarks are a constrained interpretation,
  not measured manufacturer geometry.

## Bounded implementation

The central front-wide/rear-narrow taper remains. The mid-roof is slightly
narrower, without globally widening the windshield cowl. One continuous mesh per
side has a planar main glazing region, a gently crowned outline and softened
front/quarter transitions, ending at one acute aft point. The white C-buttress is
an actual broad planar triangle with a separate inner rail adapter, rather than
a blunt finite-height glass cutoff and widening trim strip.

An initial flat-cap prototype overcorrected the roof and glass transitions.
Independent review rejected it. Its source and full geometry are preserved as
`frozen-window-flat-roof-prototype` in immutable asset catalog-v2. The current
candidate restores the original gentle longitudinal roof crown while retaining
outboard side panes and the acute aft topology.

Exact exported-mesh comparison permits changes only to eleven canopy/window
meshes. All other 244 opaque preview meshes, normals, indices, material/group
properties and world poses must match `1bf6034`. The player color mesh count
remains 261; no new window draw submissions are added. Full frozen-source verification now passes 356 Node tests, 24 Lua tests,
syntax/deterministic bundling/build, exact instrument/road/rear rays, wheel
batching and classic/NPC preservation. The current player has 119,036 visible
triangles versus the prior 125,590, with the same 261 color meshes. Two shadow
proxies total 14,030 triangles; maximum sampled deviation is 11.588 mm.

## Preserved designs and NPC status

`assets/vehicle-variants/catalog-v2.json` preserves nineteen historical entries /
eleven distinct geometries with exact source/geometry hashes and lossless
restoration. Earlier catalogs and original objects are immutable. This includes
released 20f6117, first visual identities e3ba317/e4313dc, stage 2 8c4dd7c,
folded-front 1bf6034, all frozen previews and the rejected flat-cap prototype.

This is an inactive local asset library. Static build copies none of its payloads
and no production source imports it. The generated low-detail NPC experiments
failed visual seam/roof/wheel QA, remain quarantined, and are refused by the
optional loader. Preserving the designs is complete; clean NPC-specific
retopology and runtime activation remain pending. Numeric LOD-budget tests do not
constitute visual acceptance or GPU-performance evidence.

## Preview limits

Actual Three.js r128 canonical meshes are exported and rendered in Blender
Cycles CPU. Reference photos are preserved, apart from explicitly disclosed
uniform crop/resize for comparison sheets. Source and studio cameras, lighting
and material translation differ. These are not browser/WebGL screenshots, final
likeness approval, measured GPU FPS or input-latency results.

## Frozen actual preview and independent verdict

The latest source and all four actual-mesh views match exactly: top, pure side,
rear three-quarter and approximate matched front, at 16 samples. The three-column
sheet pairs supplied original crops with the frozen 1bf6034 baseline and latest
candidate; it also includes native-pixel side before/after. Cameras, crops, scale
and lighting limits are disclosed. Machine-readable hashes, rendered cameras,
photo transforms, checks and preservation status are saved as `window-*.json`.

Independent review confirms the flat-cap regression is gone, upper transitions
are gentler, and the acute aft point/outboard panes/broad white buttress remain.
No new obvious window hole, detached edge or spike was found. This is suitable
to show for feedback, not a full-car likeness claim. A small white far-side
corner in the rear-quarter view is the inherited folded front fender: exact
mesh rays identify `referenceLampShoulderBridge-1`. It is unchanged, and this
window pass does not expand into another front-body redesign.

Visual edits stop here for user feedback. The branch is local; nothing is
merged, pushed or deployed. The entire rejected-model archive is retained,
while clean performant NPC retopology remains an explicit unfinished item.
