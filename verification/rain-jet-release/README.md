# Combined cockpit rain and cold-gas/condensation release

Inputs: published f16643ef9eaad8a52932f18086162c03e9912dd0, frozen cockpit rain a0efac27185ece1d0adc5c369dab3cc1c98b4ca2 and frozen jet visuals 1785c27c61d74faa285175da5ef1399bf05558c5.

Only README's two appended feature sections conflicted; both are retained. Physics and HUD merged automatically. `input-preservation.json` independently reconstructs those two non-conflicting three-way unions and compares all other production src/api/lib/assets files and the bundle manifest against their intended frozen input. The root bundle is regenerated from the combination.

The rain module remains after model/NPC construction and before physics. The two production rain update calls remain, the old forty-two fullscreen rain streaks remain removed, and the new cold-gas/pulse display/reset calls are retained. Pure driving forces, tank consumption, scoring, crash-result lifetime, NPC geometry, traffic policy, tail/body geometry and original archive metadata are not retuned by this integration.

Frozen standalone image/ray audits are kept as input evidence. `standalone-jet-runtime-1785c27.json` and `standalone-rain-runtime-a0efac2.json` are exact retained copies. Fresh combined audits live here. The jet verification command naturally writes its original output path; during release validation that result was copied here and the frozen input's audit file restored, so image/input evidence is not silently relabeled. Jet geometry/material modules are byte-identical to the frozen renderer input; merged physics only adds the rain branch's existing independent changes.

## Validation

See `regression-summary.json`, input preservation, fresh runtime reports and logs. The complete Node suite includes the 6,720 accepted-input/gas/frame-step combinations. The new rain check must pass against the final jet mouth meshes, not only the standalone rain scene. It covers actual glass attachment, projection and screen/wheel clearance, full trajectories and 28 viewport/model/cockpit combinations, as well as surviving exterior rain segments against the transformed cabin. The fresh jet audit checks actual envelope geometry, 10,368 outlet trajectories, command reaction direction/torque, paid 3D retro split, pulse duration/orientation and pure-physics source preservation.

The independent player screen/road/tail rays, wheel-batching proof and all fifteen NPC near/far/resource checks are rerun against the final production sources. All earlier player and NPC versions remain recoverable in published history and the preserved original archive workspaces. Full original ZIP publication remains a separate pending delivery.

CPU projection diagrams and Blender renders are explicitly not browser screenshots. GLSL alpha in the studio jet views is approximated. No working WebGL rendering, real GPU performance, live-device interaction or live ranked-service run is claimed.
