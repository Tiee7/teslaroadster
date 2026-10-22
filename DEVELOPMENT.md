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

The boundary-response iteration explicitly succeeds bb73 in
`verification/coast-boundary-20261022/source-epoch.json`. Its source hashes and
regression report identify the exact candidate; read PR20's current head and the
Vercel deployment metadata for that SHA to locate its new unique preview. Never
infer that a previously copied URL serves a later commit.

## Current coastal boundary iteration

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
- Run applicable final-byte tests/build/checks. The bb73 applicable baseline was
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
