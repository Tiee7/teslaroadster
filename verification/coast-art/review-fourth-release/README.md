# Fourth art milestone · offline review

These are native Three geometry/instance transforms rendered with **Blender Cycles CPU and independent inspection lighting/material approximation**. They are **not browser gameplay screenshots or a WebGL/FPS pass**. Cloud WebGL context creation remains unavailable.

- `inland-before.png`: third published art milestone (`c5c8544c…`),1.2m ordinary-driving camera, native focus436/700.
- `inland-after.png`: same camera/focus/shadow policy, fourth candidate (`44fbd106…`). Six existing inland-boulevard houses have coordinated commercial bases and whole-floor plaster groups: pale sage/warm chalk and one subdued coral anchor, not a random checkerboard. Narrow upper corner piers terminate below the inherited cornice.
- `corner-after.png`: same corner camera/focus445/635 as the third gallery, with the new facade grouping and original L-shaped hard courts. Wide green setbacks are still a known art limitation, not disguised by framing.

`provenance.json` records exact PNG hashes, source, camera/focus and scene structure. Native castShadow flags are honored; receive-shadow/material/lighting/color remain approximate. Review PNGs are not runtime game assets.

All132 original physical/layout buildings and129 art entrances remain unchanged. Six visual bodies are partitioned into three exact-abutting vertical boxes (same original union/height/volume) with twelve small visual upper piers.156 body/pier instances, +288 maximum triangles, zero new texture/base batches. Maximum173,566 triangles;80 base batches,16 owned textures/1,256,107 sampled mip bytes, separately counted256KiB CPU field cache. GPU/driver/shadow-target allocations are not covered by those estimates.

The new full-AABB oracle caught and corrected both a3.4m seam cutting a full balcony-door reveal and pier tops overlapping the old cornice. Unmodified failure TAPs remain; strengthened zero-thickness-plane projection tests also pass. This is a modest identity improvement, not a claim the map is artistically finished. Next is purposeful, limited front courts along existing entries rather than more windows.
