# Autopilot + temporary RAM replay

Successor to `2e47ce901e0bf5a52bc18cebde601d045042371c`, on the same PR20 development branch. No main merge or production promotion. Keep the user's f2 production and all earlier previews.

## Behavior

- Start the existing highway autopilot, then Record; or switch manual/autopilot while a recording is running. All vehicle transforms are sampled **after the original simulation tick**, including its real autopilot step. Keyboard input is not the recording format.
- The asynchronous **preparing** phase must settle or be canceled before starting a recording/playback. A preparation begun during an existing recording can finish normally; no vehicle population/configuration is replaced.
- Playback uses the same saved position/quaternion/scale/visibility, wheels, lamps, jets and debris fields as before. It never re-runs the historical driver or planner. The live autopilot closure, input and private fixed-clock accumulator remain in place but cannot advance through the replay RAF or its public step/advance/toggle entry points.
- Return to driving restores the live presentation checkpoint, including an airborne one, without stopping/restarting the planner. Playback wall time is not added to its clock debt. A slow replace-clip confirmation similarly discards only modal UI time, on both accept and cancel.
- Existing blur/background/pagehide/graphics safety cancellation remains authoritative. If it stops autopilot, returning from replay does **not** silently re-arm it; the original autopilot button reports the stopped state. Ground/hazard admission rules are unchanged.

## Unchanged boundaries

Only `src/replay.js` and generated `index.html` change at runtime. Original physics, highway autopilot, numerical projection, assets, traffic counts, weather modes, ranking and taxi source stay byte-identical to the predecessor. `source-epoch.json` pins the immutable first RAM epoch and an exact old replay fixture; tests separately prove the binding/sample/interpolation/capture code is unchanged.

Still one temporary page-RAM clip: **5 simulation minutes or 32 MiB of accounted replay data, whichever comes first**, never silently overwriting. This is not a total browser/GPU memory cap or a promise that every map records five minutes. Highway's 314 scrolling props already make the 369-row minimum about 26,632 bytes/sample; at an assumed 20 Hz that basic budget corresponds to about 62.9 seconds before adding animation/debris. This is source arithmetic, not a measured browser duration/FPS claim.

Refresh/pagehide/BFCache clears the clip. No replay download/upload/persistent storage. Explosion fire/smoke, rain, lightning screen flash, audio and coastal ambient rewind are not reproduced; vehicle lamps and actual vehicle/debris motion are. Free cameras have a ground floor, not building obstruction avoidance. No video export or cinematic editor is implied.

## Evidence and limits

The seven added native Three r128 CPU scene tests execute the actual production autopilot, fixed clock, numerical projection and full original simulation owner. DOM/media/rendering are adapters, not real browser visual acceptance. All 53 native vehicle poses and wheel phase are checked against post-physics samples; manual/auto switches, pending cancellation/resolution, fractional-clock preservation, airborne restore, blur cancellation, confirmation delay, real 34-piece crash debris and overload exit are covered. The spaced highway setup and seeded airborne witness are explicit test conditions, **not** claims of a default-spawn journey, planner-generated jump or crash-free autopilot.

`focused-final.tap`, the applicable regression manifest and final summary identify actual runs and exclusions. Existing autopilot clock/lifecycle suites are included freshly for this iteration; unchanged expensive planner suites are not silently relabeled fresh passes.

The previous browser access rejection and unknown extra HTTP action remain stopped. This feature request does not reauthorize either. Do not claim UI, GPU/FPS, or deployed page byte validation that was not performed; a READY preview/Git source readback is separate evidence.
