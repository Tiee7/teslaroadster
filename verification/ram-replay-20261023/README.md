# Temporary page-RAM trajectory replay

Succeeds the exact user-promoted `f2cbd9b3557e242ff40f2291df02fa3e224f7c61` source. PR20 development preview only: do not merge main or promote a deployment. The user's production `dpl_7sJARPobcCozbJP8bGqRGS5uehci` remains untouched.

## Use

Launch a map, choose **Replay / 录制·回放**, then **Record → Stop → Play**. The current clip already lives in page memory; no download, import or upload is needed. Playback supports pause, timeline seeking, 0.25/0.5/1/2× speed, looping, following the player or any NPC, and chase/front-side/ground/free cameras. Drag the scene to look; use WASD and Q/E in Free view, or the camera +/− buttons on touch screens. Return to driving restores the original live scene rather than continuing physics from a historical pose.

All three maps record every vehicle, including hidden/queued NPCs: up to 52 NPCs plus the player on highway/city, 20 plus the player on the coast. Samples preserve actual local position/quaternion, hierarchy scale/visibility, wheel phase, wing/gimbal/steering, jets and animated lamps. Actual destruction produces and records the existing 34 debris meshes, with visibility across crash/reset cuts. Existing respawn/controller state and per-tick discontinuities prevent interpolation through map wraps or resets. Highway scrolling props retain their existing local coordinate system.

## Deliberate boundaries

- One temporary clip. Replacement asks first. Recording stops at 300 simulation seconds or 32 MiB of accounted sample/retained-debris buffer, whichever comes first; it never overwrites older frames. A separate 256-retained-debris-object safety cap also stops recording visibly. This is a replay-data budget, **not** total browser/GPU memory.
- Refresh/navigation/close clears the clip. `pagehide` also clears on BFCache retention, and persisted `pageshow` starts empty. Backgrounding stops recording or pauses playback; it does not automatically resume. Releasing references is not a claim of secure memory erasure.
- No replay `fetch`, upload, download, Blob URL, local/session storage, IndexedDB or Cache API. Existing unrelated game preferences/analytics/ranking continue to have their existing behavior outside replay; this is not a claim that the entire game never uses storage/network.
- A clip belongs to one unchanged map/vehicle/weather/traffic population. Clear it before configuration changes. Open menus/challenges/demo prevent playback entry. Replay does not tick physical simulation, score, AI, taxi or ranked submission. Independent ranked actions have explicit guards. Taxi state is retained; current live taxi markers/HUD are hidden during playback.
- This is trajectory replay, not exact rendered video. Explosion fire/smoke, rain particles, audio and coastal ambient animation are not replayed. Real debris and vehicle blast trajectories are recorded. The UI states these limits explicitly. Particle-perfect rewinding and video export are not silently implied.
- Free cameras have a ground floor but no building/bridge/vehicle obstruction solver. The original scene, assets, traffic counts, materials, four weather modes and driving physics are preserved. Unmodeled/hidden surfaces or finite highway scenery remain finite; arbitrary remote historical traffic is not synthesized.
- No hardware FPS/GPU-performance claim. Native r128 tests are CPU scene/DOM-adapter evidence, distinct from browser visual QA.

## Verification contract

`source-epoch.json` declares the exact authorized presentation delta and preserves every inherited epoch. The original physics, highway controller, coast map/network, config, input/HUD numerical source, generated numeric projection and all vehicle assets stay byte-identical to f2. The replay adapter wraps the existing simulation/render/reset owners after they load, following the existing render-health ownership pattern.

Historical semantic proofs use immutable f2 presentation fixtures only where the current authorized UI/guard files changed. Their current-source hash and negative-drift guards still read all real current files, including both new modules. `tests/replay-source-boundary.test.mjs` independently checks that taxi semantics and ranked/mobile algorithms are exact outside the declared name/guards, original CSS/HTML/bundler bytes remain intact outside replay additions, and every undeclared change is rejected.

Run focused coverage with the official production Three r128 build at `/tmp/roadster-three.min.js` (or `ROADSTER_THREE_RUNTIME`):

```
node --test tests/replay.test.mjs tests/replay-source-boundary.test.mjs
node --test tests/*source-boundary.test.mjs
npm run check
npm run build
```

The final regression summary identifies exact counts, source hashes, actual test groups and exclusions; do not represent the documented unchanged expensive-planner baseline as a fresh full-repository `npm test` pass. Local Chromium launch was blocked by execution-environment socket permissions; cloud-browser visual checks must be reported separately against the independent READY preview.
