# Second art milestone · offline review

These are exact exported Three geometry / instance transforms rendered with **Blender Cycles CPU and disclosed independent inspection lighting/material approximation**. They are not browser gameplay screenshots or a WebGL/FPS pass. The cloud browser still cannot create a WebGL context.

- `inland-before.png`: original production greybox before this art task; same ordinary30m inland boulevard camera. Original static map had no camera-followed near-detail LOD.
- `inland-after.png`: same1.2m camera,60° vertical FOV, explicit native visual focus436/700, now with strictly flat lane/parking/bicycle markings, ground-level corner displays and a few emissive-mesh lamps.
- `corner-after.png`: current corner storefront, explicit native visual focus445/635, showing corrected positive-reading SURF signs outside the original projecting cornice. Existing linked entrance remains unchanged.

`provenance.json` records every PNG's exact bytes, SHA256, actual source hash, camera and lighting. The after images match coast source `e8e5b1b41290c10c662b7af69bb3d7cdd447c55e5217796b96bd6a13ca6600de`. These review PNGs are not additional runtime game assets or requests.

Current bounded scene:78 base batches,153,378 spawn-active /160,826 inland-active /177,770 maximum allocated triangles;30 shadow-caster batches,99,048 active /123,440 maximum shadow triangles;15 owned textures,862,891 estimated sampled mip bytes,2 actual lights and1024² shadow map. GPU/driver/shadow-target allocations are not hidden in that sampled-texture figure. Parapet union compression saves2112 triangles while increasing static geometry buffers; see the actual per-round manifest.

The street remains spacious because the inherited physical layout/roads/collisions are intentionally preserved. This milestone is improvement, not a claim that the overall art target is finished. Next focus is low-geometry ground/front-court material organization and coherent window/entrance families, not more scattered objects.
