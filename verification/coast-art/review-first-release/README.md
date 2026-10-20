# First integrated art candidate · OFFLINE review only

These are exact byte copies of local inspection PNGs, **not browser/gameplay screenshots**. `export-scene.cjs` expands the actual r128 scene geometry, instance matrices, UVs and original procedural textures; `render-scene.py` renders with disclosed independent Cycles CPU lighting/material approximation. This does not establish Three/WebGL shading, shadow behavior, mobile speed or FPS.

- `driver-before.png`: original production map3 geometry, corrected same camera (-64,1.2,700), look target (-64,1.2,580), verified60° vertical field of view.
- `driver-after.png`: integrated phone/art candidate, same camera/projection.
- `coast-after.png`: latest coast-wide inspection view (-450,90,1000) toward (-150,0,-150),72° horizontal.

The car, HUD, NPCs and shared world are not exported in these map-component review renders. Original road width/height/drivable areas/collision remain unchanged; painted median/parking/bike lanes are visual only. Review PNGs are verification artifacts, not served gameplay assets. See `images.json` for exact-copy hashes and `../round-09-on-phone/manifest.json` for candidate source identity/budgets.
