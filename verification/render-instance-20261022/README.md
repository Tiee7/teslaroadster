# Interrupted city rendering / invisible solid traffic — 2026-10-22

## Independently reproduced cause and minimal correction

The current Three r128 renderer can abort a city frame after drawing the road and only building family0. The city reuses the same material for a coloured `city-building-batch-0` and an uncoloured `city-roof-cornices-0`. The material's cached instancing-colour program still requires `instanceColor`; the cornice's attribute is null. Native `WebGLBindingStates.setup` calls `WebGLAttributes.get(null)` and throws `TypeError: Cannot read properties of null (reading 'isInterleavedBufferAttribute')`.

A minimal **two InstancedMesh / one shared material** counterexample reproduces the exception in native r128 WebGL1 **and WebGL2/VAO** branches with actual Mesa GLSL compile/link/reflection. Providing neutral-white instance colours to the untinted mesh changes one completed draw to two, without changing material, geometry, position, scale or intended tint.

Production creation order reproduces the same failure after37 draw calls. `city-building-batch-1` and every NPC child have not reached rendering at all. Log1's solid520 is batch1/index80; logs2/3 identify NPC contacts. Thus all three physical contacts can exist while the corresponding objects are absent from the interrupted image. This corrects the earlier inference that matching solid geometry plus `.visible=true` established what the user could see.

`src/world.js` now supplies `record.color ?? 0xffffff` to every city batch record. Existing tint bytes are retained. White is an exact multiplier of one for untinted records. Regression checks certify unchanged vertex/index/UV buffers, material parameters/textures, local transforms, instance matrices and all797 collision bounds. The change adds only22,368 bytes of static instance colour data; it adds no draw calls, model changes or per-frame upload.

## Scope of the rendering evidence

The recording layer runs the actual frozen Three r128 renderer and observes its generated shaders, active uniforms/attributes and GL command stream. Shader reflection and linking use native EGL/OpenGLES Mesa llvmpipe. A separate backend replays uploaded buffers, uniforms, textures, framebuffer/depth/cull state and indexed/instanced draws into CPU-rasterized PNGs. This is **software CPU GL, not a browser screenshot, physical GPU, mobile device, FPS or heat acceptance**. No shader source, geometry, palette, materials or scale is edited to make the test pass.

The before/after city scene uses actual production city geometry, the log2 NPC and a stated default-chase camera assumption. V2 logs do not record the user's camera, loaded build or exception stack: this is a directly reproduced same-code/same-symptom failure, not proof of the exact historical user-device state. The player, HUD and canvas-based studio environment are not included in these isolated views. The day sky is the real production DataTexture CubeTexture, and a further comparison enables production2048 PCFSoft shadow configuration.

With the source correction, the complete scene reaches65 main-pass draws and all6 NPC children. The NPC-present / NPC-absent comparison changes3,668 pixels in rectangle[280,200]..[359,250] at640×400. Both no-shadow and shadow replays finish with zero GL errors or failed shader programs. Raw stream captures remain in the local shared evidence directory; compact summaries, original emitted shaders and re-run scripts are retained here.

## Separate context-loss mitigation

Native r128 also silently skips rendering after its main-canvas context-loss event, while the previous production RAF loop continued motion (30 ticks /29.869m in an injected-loss CPU counterexample). The separate render-health module pauses driving, clears controls and frame debt, shows recovery status, and requires explicit acknowledgement after restoration. It does not alter collision rules or claim that these user incidents were context losses. The optional showroom renderer's context loss does not pause the game. Ranked wall-clock timing retains its existing independent interval; this is a driving-safety pause, not a leaderboard-rule change.

## Release boundary

PR19 / `fix/contact-sky-20261021` was prepared preview-only. At 2026-10-22 07:48 UTC, the user explicitly authorized pushing, merging and deploying this specific tested repair. Publication must still verify the expected heads, commit identity, checks and served artifact, without bypassing protections. Approved player/NPC models, geometry, materials, scale and loading sources, and numerical physics/collision/camera code remain unchanged. Existing v3 local diagnostics remain available for checking exact build and runtime state.

## Reproducing the render counterexample

The recorder needs the exact existing Three r128 runtime (set `ROADSTER_THREE_RUNTIME` to its local file), Node, Python3, and EGL/OpenGLES Mesa. It does not install dependencies or require a remote browser. From the repository root, an options JSON passed as the third argument can select `city`, `npcVisible`, `webgl2`, `environment`, `shadows`, and `worldSourcePath`. For the before case, set `worldSourcePath` to the preserved `tests/fixtures/render-instance-baseline/world.js`; omit it for the fixed current source. Example:

```sh
node verification/render-instance-20261022/native-webgl-capture.mjs "$PWD" /tmp/city-fixed.json /tmp/city-options.json
python3 verification/render-instance-20261022/egl-replay.py /tmp/city-fixed.json /tmp/city-fixed.png
```

See `native-render-summary.json` for the exact paired scene settings and results. These scripts and retained emitted shader hashes expose the boundary between real shader compile/raster evidence and the isolated capture adapter; they do not turn it into an end-to-end browser test. Before/after PNG originals were delivered to the user and remain in local shared evidence, rather than adding game assets to this patch.

## Final regression status

The complete final suite passes **1031/1031**, zero failures/skips/cancellations, with test-file concurrency2 (872944ms). `full-suite-final.log` is the raw terminal run. The failed initial high-concurrency run and the complete failed-file rerun are deliberately retained; the inherited v3 diagnostics and new world/render-health hashes now have explicit source-epoch ownership, without rewriting old epochs or fixtures. `npm run check` and `npm run build` also pass.
