# Original Map 3 paver — portable native sampler evidence

## Result and scope
A controlled **Mesa llvmpipe CPU / native Three r128** rasterization retains more shallow-angle paving-joint detail with anisotropy 8 than with the original 1. This is an isolated texture-sampling experiment, **not** a browser/device/full-scene screenshot, motion/shimmering acceptance, or measured FPS result. It does not establish texture streaming or an increased draw distance. The inspected production baseline builds all paving texture bytes/geometry synchronously.

The comparison keeps exact original 128×128 paver RGBA, linear/trilinear mipmaps, original 2.4 m UV tile / 0.6 m joint spacing, camera, ground geometry, material, native r128 GLSL, lighting, and fog. The complete captured GL streams differ **only** by the anisotropy texture parameter. No texture/geometry scaling trick, new asset, LOD bias, vehicle, or NPC change is involved. Environment-map/shadow content is deliberately absent from both controlled frames.

The baseline is immutable `tests/fixtures/weather-ground-traffic-baseline/coast-map.js`, **never current patched `src/coast-map.js`**. The generated recorder verifies the baseline SHA-256 before extraction:
- Coast source at `4451a11c9c09d031a9da037ce63afe4bb7f062e5`: `ee0a881e0d1647de70d4403002a0f0f9fbadddceca5c15ad758cf25a13dd91de`.
- Paver RGBA: `cdb3fba211e4235586d1279c8ca4a373b1ab7cbe230da98d9e385a6f1c1d8aca`.

## Compact evidence
`evidence.json` contains row/depth/contrast measurements. The native driver is llvmpipe / Mesa 25.0.7, actual anisotropy extension present, native cap 16. Every case is one draw / two triangles, shaders compiled/linked, zero GL errors. Joint fundamental peak-to-peak luminance, on a 0–255 framebuffer scale:

| Actual forward depth | Pixel row | Joint period | Aniso 1 | Aniso 4 | Aniso 8 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 19.90 m | 429 | 22.41 px | 1.7828 | 2.6172 | 2.6172 |
| 29.75 m | 401 | 15.06 px | 0.0190 | 1.8023 | 1.8023 |
| 40.37 m | 386 | 11.12 px | 0.0096 | 0.7187 | 0.7187 |
| 49.83 m | 378 | 9.02 px | ~0 | 0.0566 | 0.5791 |

Depth is solved by camera-ray/ground intersection at each native pixel row. A sinusoidal fundamental at the original joint spacing is fitted over the central 768 columns. This is not a visibility or draw-distance threshold. Thin mortar still fades farther away; anisotropy cannot guarantee subpixel detail to the horizon.

`capability-boundary.json`: native r128's capability API is exercised through an **explicitly simulated WebGL extension/capability facade**. Request 8 / reported cap 4 produces effective 4, with identical commands and pixels to the 4 case. Extension absent makes r128 report 0; guarded effective 1 is command/pixel-identical to baseline. Rasterization uses the supported native Mesa driver, **not a real unsupported physical GPU**.

`replay-manifest.json` records only compact source/runtime/texture/shader/image hashes and errors. All five portable replays matched both original PNG and raw-RGBA hashes; portable `evidence.json` and `capability-boundary.json` also matched the original evidence byte-for-byte. Original native frames and paired PNGs remain in the separate shared delivery evidence folder; no large captures, RGBA, cache, or PNG files are committed here.

## Reproduce without editing production
Prerequisites already used by this environment: Node, Python with numpy/Pillow, native EGL/GLES Mesa supporting anisotropy ≥ 8, and the exact Three r128 runtime. `ROADSTER_THREE_RUNTIME` can point to the local runtime; otherwise the existing recorder defaults to `/tmp/roadster-three.min.js`. No downloads, credentials, browser replacement, or permission bypass is performed.

From any directory, choose an **output directory outside the repository**:

```sh
bash <repo>/verification/weather-ground-traffic-20261022/texture/run-experiment.sh <repo> <output-directory>
```

`run-experiment.sh` calls `build-experiment.py --repo ... --output ...`, reuses the existing `verification/render-instance-20261022/native-webgl-capture.mjs` recorder machinery and `egl-replay.py`/backend, and runs cases 1/4/8/cap4/unsupported. `analyze-evidence.py --repo ... --output ...` recreates compact JSON plus native-scale paired PNGs in that output directory. The existing helper files and original shared evidence are not modified.
