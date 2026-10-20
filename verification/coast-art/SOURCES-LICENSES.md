# Art sources and redistribution

Current art is original deterministic geometry and procedural microtextures written for this repository. No third-party art downloads, map assets, copied GTA content, external account, payment or new credentials are used.

- Three.js r128 runtime: existing production runtime and local QA copy at `/tmp/roadster-three.min.js`; software dependency, MIT, unchanged. QA exporter records its SHA-256. It is not a new art download.
- Blender 4.3.2: preinstalled local CPU inspection renderer; no bundled Blender assets are redistributed. Its inspection lighting is separate from the game and is recorded as such.

Optional research leads provided by root (not downloaded or included): official Kenney city commercial/suburban CC0 kits and Poly Haven asphalt_02 CC0. These are not treated as used assets unless a later entry records the exact official source, license, individual files and shipped byte counts.

## Runtime compatibility research (not imported art assets)

Official Three r128 source was read2026-10-20 to verify map-local texture/shadow lifetime behavior:
- https://raw.githubusercontent.com/mrdoob/three.js/r128/src/renderers/webgl/WebGLCubeMaps.js — equirectangular conversion is cached by source texture; source disposal releases its converted cube.
- https://raw.githubusercontent.com/mrdoob/three.js/r128/src/renderers/webgl/WebGLTextures.js — direct CubeTexture upload accepts six DataTexture face payloads and observes the cube version.
- https://raw.githubusercontent.com/mrdoob/three.js/r128/src/textures/CubeTexture.js — direct cube mapping and face orientation API.
- https://raw.githubusercontent.com/mrdoob/three.js/r128/src/renderers/webgl/WebGLShadowMap.js — shadow render-target ownership and instanced-batch submission boundary.

No new third-party art/code files were downloaded into the application. New textures, canopy/roof meshes, signs and furniture are original deterministic project code. The official pre-existing QA runtime remains an inspection dependency, not a newly shipped asset.

## Round10 original water fields

The128×128 RGBA tangent normal field is original project code, analytically summing four periodic sine slopes;65,536 source bytes, mipmapped and map-owned, no network file. Continuous water/sand vertex colors, the sea-side cut closure and broken opaque foam ribbons are also original deterministic geometry, not photographs, downloaded shaders or copied art. Existing Three native MeshStandard normal mapping is reused; no new software/art dependency.

## Rounds11–12 original architectural/street kit

Curved parapets, balcony-door/platform assemblies, split flat plinths, corner storefronts/glyphs, forked courtyard trees, small reflecting basin, dogleg beach walks and second-boulevard markings are all original deterministic project geometry. No external asset pack, texture or software was downloaded. They reuse existing owned texture/material batches where possible; the courtyard surface shares the original water-normal texture instead of adding another image.

## Rounds13–14 original low-frequency ground and window atlas

The original world color field is generated once asRGBA256² (65,536 source pixels/262,144 bytes), clamp-to-edge with independent original-ground-boxUVs. Its CPU pixel cache is separately metered; eachGPUTexture remains map-entry-owned and disposed.512² was an inspected intermediate, not a shipped photo/download. Two original64px sash glyph families share128×64 albedo/emission atlases with synchronized glass masks. LimitedL front courts reuse the original project paver image/union geometry. All are original deterministic project art; no external art files, services, payment or credentials were introduced.
