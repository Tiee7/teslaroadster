# Roadster development continuity

## Release boundaries

- Bug fixes first; performance work second, with measured before/after evidence.
- Continue PR20 on `feat/weather-ground-traffic-20261022`; inspect the remote head,
  local tree and outstanding drafts before editing. Do not create a competing writer.
- Each verified iteration gets a commit and a **new unique Vercel preview URL**.
  Keep earlier previews available; do not delete/promote them or rely only on a moving branch alias.
- No automatic main merge or production deployment. Production baseline remains
  `4451a11c9c09d031a9da037ce63afe4bb7f062e5` unless separately authorized.
- Approved vehicle geometry/materials/scales are frozen. Do not conceal rendering
  or collision defects by resizing assets, clipping the scene, lowering traffic
  density, teleporting the player, or disabling legitimate collisions.
- Preserve night default, the four requested weather modes, daytime headlights
  off, single-passenger taxi, normal highway front replenishment and incident-only
  rear respawn. Do not invent new gameplay as a substitute for stability work.

## Known baselines and retained previews

| Baseline | Commit | Unique preview |
| --- | --- | --- |
| Highway recycling and single-passenger baseline | `2c217c077c82b014f47a1365b6d803574ac47946` | https://teslaroadster-iqveb25bi-tiee1.vercel.app/ |
| Coastal rotated-hull landing contact | `723ad63d8ec48e455fe5c79c66852a05ba8ce684` | https://teslaroadster-i459q867p-tiee1.vercel.app/ |
| Attached-frame consistency and folded local problem export | `bb73a584f3e40b648ff142707d2204b45e36c459` | https://teslaroadster-5lx2qwv4s-tiee1.vercel.app/ |
| Coastal boundary normal response | `36ae0b5811e91e36f95d052543d798a581f88881` | https://teslaroadster-3nuzlw6tj-tiee1.vercel.app/ |
| Coastal finite pier/yaw contact | `9414c67d4706902c8b723a2b1f33fdb6e17262a9` | https://teslaroadster-gm1vi637y-tiee1.vercel.app/ |
| Coastal finite side contact | `ac55a1fc8fcd80fe04d594d8cce58006f1fa8fc5` | https://teslaroadster-o57d2liyn-tiee1.vercel.app/ |

The current bottom-contact iteration explicitly succeeds ac55 in
`verification/coast-bridge-bottom-contact-20261022/source-epoch.json`. Read PR20's
current head and Vercel metadata for that SHA to locate its **new unique preview**.
The retained side epoch succeeds 9414. Never infer that a previously copied URL
serves a later commit.

## Current finite bridge-bottom iteration

- Succeedsac55; see `verification/coast-bridge-bottom-contact-20261022/README.md`
  and immutable source epoch for exact native underside penetration/air-gap
  counterexamples, continuous input witness, old four-case red and verification.
- Use actual finite bottom triangles and full rotated body CCD; retain original
  side, pier, rail, top landing and underpass behavior. Only the player bypasses
  the obsolete root-height ceiling; default network callers remain unchanged.
- Test/render limits remain explicit: original screenshot location unknown,
  CPU native geometry and whole-state traces, not browser GPU/user-device QA.
- New safe plane certificate reduces unshipped added-query cost, but final CPU
  is slower thanac55 on these scenarios; do not market it as FPS optimization.

- Current final joint coverage:1354 unique passes (1299 main,18 terrain,37 art),
  zero skips. The original terrain worker was SIGKILLed; only async/one scheduler
  yield changed, all original18 assertions reran green. RSS observations do not
  prove OS OOM. No source/index byte changed after the original main/art batch.

## Retainedac55 finite bridge-side iteration

- Reproduced6 actual native side-triangle misses and3 continuous real Space/W
  flights from independently verified nearby terrain support at30/60/144Hz.
  No per-frame pose forcing; the60Hz supported-start witness crosses a real
  vertical face at1.7s with32.03mm visible penetration and no previous damage.
- Cache original finite Float32 side quads in physics, leaving every road/terrain/
  bridge render byte and approved asset frozen. Full-YXZ existing body proxy,
  exact constant-angle intervals and conservative rotational certificates stop
  the true side contact, including later paid RCS, without rerunning fuel/time.
- Preserve original structure priority/ties and pier behavior where sides stay
  clear. Test finite endpoints/edges, normal energy, all-state underpass/rail
  controls and genuine contact-row visible vertices; do not confuse this with
  an exact628-mesh collision solver or original screenshot localization.
- A partition-invariant finite-plane fix and axis-aware certificate bound close
  actual defects found in the new implementation itself. The narrow CPU
  >5-second-to1.68ms no-contact result is not an FPS claim. Persistent native-body
  driving also exposed4.569ms eager-candidate numerical-motion CPU; lazy finite
  geometry and a complete-rotation-radius broadphase reduce it to0.197ms, still
  slightly above old9414 without side collisions (0.130ms), with all1500 per-trial
  states exact across3 trials. Payload grows, not shrinks; original internal
  art/road budgets remain unchanged.
- The previous station4300 bottom-first witness is now stopped by the true side
  shared lower edge, not by a teleport; untested interior underside cases remain
  unproven. Exact tests, strengthened contact-row coverage and limits are in
  `verification/coast-bridge-side-contact-20261022/regression-summary.json`.

- Finalac55 coverage was1319 unique current passes:1264 main,18 serial terrain,
  37 serial art; the same12 unchanged expensive planner files reused the prior
  explicit baseline. Original native penetration/red and unexplained file-level
  SIGKILL history remain retained; no full-repository npm-test claim.

## Retained9414 coastal pier-contact iteration

- Reproduced5 false fatal bridge-column contacts across legal supported W drives
  at30/60/144Hz. The unchanged actual visible model remains0.596–0.602m clear of
  the exact native pier instance;6 far-lane and6 leaving controls stay clear.
  One30Hz forward near trial did not reproduce and remains a negative control.
- The old column branch expanded a fixed world-axis box regardless of car yaw.
  Preserve its1.1m/2.31m half-extents and1.25m default height; use oriented finite
  contact and first-contact yaw instead. This remains an upright proxy, **not**
  exact628-mesh collision. No approved asset, terrain, road layout or damage law
  is altered. Existing rails/abutments/ceilings retain byte-identical logic.
- Preserve the original translation/structure phase. Actual supported Space+A
  additionally proves that a later pure-yaw integration can reach a pier; check
  only that later same-XYZ yaw segment. Do not rerun integration, fuel or other
  structures. Zero-energy opening overlaps must not cause recurring minimum damage.
- Bit-exact all-state no-contact comparisons cover land/air, clear/rain weather,
  actual inputs and30/144Hz. Independent polygon/time oracles, rotating/short-arc
  paths, all faces/corners, existing overlaps, simultaneous structure candidates,
  repeated positive impacts and control recovery supplement real native geometry.
- The final applicable counts, source/game hashes, retained red evidence and
  exact limitations are in
  `verification/coast-pier-contact-20261022/regression-summary.json`.
  This fixes an independent reproduced bug, not the still-unlocalized original
  coastal gap screenshot. No fresh browser/user-GPU visual acceptance is claimed.

## Retained36ae coastal boundary iteration

- Reproduced a real outer-world shallow-graze defect independently of the unknown
  ground-gap report: legal supported40m/s starts, at30/60/144Hz, struck the boundary
  at only1.97–2.09m/s normal closing speed. All9 baseline cases fed the total
  ~39.5m/s into fatal damage and reversed the fast tangent; all9 inward controls
  stayed clear. The original source fixture and compact measured witness remain.
- Change only the coastal boundary response: retain bounds, restitution0.35,
  strict10m/s impact trigger and existing yaw correction; apply bounce/damage only
  to outward motion on crossed axes. Preserve tangent velocity and combine corner
  normal components without counting tangential speed. No player teleport/rescue,
  collision removal, asset change, ground-height adjustment or driving-speed tune.
- Positive hard impacts, corners, inward overlaps, slow contact, varied frame
  rates and post-contact controls need explicit regression coverage. The exact
  final tested source and counts are recorded in
  `verification/coast-boundary-20261022/regression-summary.json`.
- A separate CPU structure-index prototype is **not integrated**: microbenchmark
  improvement alone does not establish meaningful end-to-end frame-time/FPS gain.
  Terrain, road structures, traffic, weather, lights and local diagnostics stay
  byte-frozen from bb73.

## Retained bb73 stability improvements

1. A coastal landing already resolved support/`wasAirborne`, but its local
   airborne flag survived one fixed step. Synchronize the already-attached frame
   so the gear/readout and ground-body feedback agree. This is a small state
   consistency repair, not a demonstrated lasting loss of control.
2. Add folded local problem tools under Settings and a copy action on the crash
   panel. Copy a brief report or explicitly save JSON. Only game coordinates,
   velocity, attitude, support/contact and source identity are exported; no account,
   nickname, typed text, cookies, URLs or device identifiers, and no automatic upload.
3. The pose ring is fixed at96 rendered samples/9216 numeric backing bytes (not
   a total JS heap measurement). It is **not an exact
   physics-tick/input replay**. No terrain or geometry query runs per sample;
   manual geometry observation has a65536-triangle ceiling and never repairs data.
4. New15-minute highway NPC-step endurance cases supplement the previous actual
   driving/three-minute continuity coverage. They do not claim a full rendered
   player-driving session or device FPS measurement.

## Still open / evidence limits

- The original reported coastal ground-gap image pixels and exact position/input
  were not obtained. Do not claim this report is fully resolved or that the user
  saw the independently reproduced rotated-body defect.
- Bounded real mesh/motion audits and six actual software-Mesa environment views
  found no gap in their tested locations. Those views contain no car, HUD or NPCs;
  they are not browser/user-device GPU acceptance tests.
- Existing supported cloud browser exposure was unavailable in this iteration.
  Do not move work to the user's computer, provision another runtime, disable
  sandboxing, or retry a permission denial to manufacture visual evidence.

## Verification and publication

- Keep historical source epochs and exact fixtures immutable. Add an explicit
  successor and negative drift guards; fix historical *read addresses*, not their
  frozen expected values, when a later authorized source changes.
- Run applicable final-byte tests/build/checks. The9414 applicable baseline was
  1256 unique passes (1219 main +37 serial art; no fresh heavy planner run).
  The36ae applicable baseline was
  1154 unique passes (1117 main +37 serial art; no fresh heavy planner run).
  The bb73 applicable baseline was
  1092 unique passes (1055 main +37 serial art; no fresh heavy planner run).
  Reuse the prior1164-case combined
  baseline for unchanged planner code rather than mechanically repeating its
  longest cases; report exactly which current tests ran and which baseline was reused.
- The prior1164 coverage was **not one all-green full run**:1127 full-batch passes
  plus37 serial art-file passes, with the two unexplained file-level failures
  retained. Do not silently relabel it as a clean complete run.
- Verify author/committer, expected branch head, complete tree and remote files;
  then wait for the new preview to be READY and verify exact deployment SHA and
  all game HTML bytes (separate any known hosting feedback append).
- Save a concise release report and keep the original failing evidence. Any CPU,
  software-Mesa, HTTP-only or browser limitation stays explicit.
