# Windshield display containment

The exterior pose of the responsive driver instrument pod placed the old bezel
up to 0.08704 m above the actual reference windshield at commit `a969071`.
The fixed cabin screen has a dark 0.38 × 0.16 m housing centered at
`(0, 0.725, -0.64)`, with the existing live instrument texture and its correct
512:200 display aspect ratio. It remains fixed across window resizes.

The original responsive FPV meshes, instrument canvas, speed/air/taxi data,
steering geometry, physics and exterior body meshes are unchanged. Only the
active representation is visible. Start and paint previews use the fixed cabin
screen; the retired combiner is hidden consistently with the existing frame loop.

Verification against the production Three.js r128 runtime:

- Four independent classic/reference exterior and cockpit combinations.
- 212 vertical rays through every screen/housing vertex and face samples:
  minimum actual-glass clearance 0.19970 m (reference), 0.20966 m (classic).
- 636 front/quarter exterior rays hit windshield/body before the screen.
- Repeated FPV/outside/resize transitions retain the same physical screen bounds.
- 117,600 instrument rays and 39,200 forward-road rays across ten viewports and
  49 steering angles: zero blocks; zero wheel-envelope violations.
- 337 Node tests, 24 real Lua-runtime tests, syntax/DOM/deterministic bundle
  checks and static build passed.
- Separate exact-mesh CPU studio renders of the baseline and fixed reference
  preview reproduce and remove the pale rectangle across the lower windshield.
  These are offline geometry renders, not browser/WebGL screenshots.

Reproduce CPU geometry checks with an existing official r128 runtime:

    node verification/cockpit-display-runtime-check.cjs /path/to/three.min.js verification/cockpit-display-exterior-runtime-result.json
    node verification/reference-model-runtime-check.cjs /path/to/three.min.js verification/cockpit-display-fpv-runtime-result.json

Browser/GPU shading, actual canvas-text rasterization and physical device input
remain outside this verification. No new external vehicle geometry is included.
