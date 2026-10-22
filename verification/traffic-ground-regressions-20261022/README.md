# Highway traffic continuity repair — preview only

Base: deployed preview `3417fa07d357b4231c36ac439caeb9460371cc31` on draft PR20.
Main/production `4451a11c9c09d031a9da037ce63afe4bb7f062e5` is not updated.

## Confirmed regression and correction

The preceding four-improvement iteration incorrectly applied incident-only rear
recovery to every ordinary longitudinal viewport wrap. The single-passenger
iteration did not change that traffic source. At a faster player speed the fixed
pool drained from the forward window; total pool count alone hid the regression.
The earlier test explicitly expecting depletion was itself an incorrect contract.

Normal rear exits now refill safely ahead, and ordinary far-forward exits return
through the normal rear entrance, as before the regression. Only active/expired
wrecks and true lateral departures from the buffered pavement use the safe rear
reservoir. Incident-origin entries become ordinary traffic again after their
current recovery; an old accident flag does not permanently lock them behind.
Waiting admission preserves its direction, including the destroyed aftermath.

No pool expansion, speed-band/driver/steering/braking/force/collision changes are
used. Existing hidden queues, full wreck footprints, per-driver stopping gaps,
reserved lanes, identity/mesh/material/scale and pass reward eligibility remain.
The source boundary proves the sole physics-file behavior delta is queue routing
in the already-existing destroyed NPC aftermath. Numeric/browser projection
artifacts are explicitly regenerated and re-pinned to this same source.

## Evidence and regression contracts

- Frozen3417 180s counterexample:52 real weighted drivers, seed7,360km/h;
  at5s the forward sample is0, and the remaining175s stays empty. The repaired
  identical replay remains nonempty throughout, ending with39 cars ahead.
- Independent fixed3417/4451 45s comparison also reproduces depletion at normal
  151.2km/h and at234km/h, at30/60/144Hz. These are NPC-controller CPU replays,
  not an assertion of a complete manual driving/GPU run.
- Nine180s cases cover20/36/52-car density,151.2/360km/h, low speed, repeated
  incident recovery and six-lane forecast. They check actual forward counts and
  sustained density, moving speeds/unchanged targets, identities, no NPC overlap,
  hidden queues and repeated genuine passes—not merely the retained pool count.
- Explicit direction/score/queue tests retain30/60/144Hz boundaries, full52-car
  admission pressure, rotated long wrecks and actual destroyed-aftereffect code.
- The real source-pinned planner/physics driving regression runs at least20s,
  finishes any last launched arc, retains at least3 completed jumps, and checks
  collision/destruction, pavement/height bounds, finite tank, speed, unpowered
  airborne controls, normal refills and a nonempty forward tail.
- All earlier source epochs remain immutable. Historical assertions read exact
  deployed fixtures; current sources are checked by the explicit successor
  epoch, including negative drift guards and the unchanged single-seat source.

The complete1094-case run ended with1092 passes and two obsolete rear-only
final assertions in the numeric-projection tests. Every original per-frame
numeric/traffic comparison passed before those final assertions. The exact
original20/52-car trajectories remain; their corrected assertions distinguish
normal23–55m rear admission from95m incident recovery. Three added projection
cases cover normal forward refill, actual lateral incident recovery and a truly
blocked52-car mixed queue. The final related group passed192/192.

Joint coverage is1097 unique applicable contracts:1092 initial passes plus two
corrected replacements and three new cases.187 of the192 related cases overlap
the initial passes. This is **not a single completely green full-suite run**.
All production source and HTML bytes are identical to the complete-run snapshot;
only test assertions/fixtures and documentation changed afterward.
Commands, exact counts, overlap accounting, log hashes and frozen source/artifact
hashes are recorded in `regression-summary.json`.
Raw failing/corrected/full logs are retained under the shared
`tesla-highway-recycle-20261022` evidence folder.

## Separate unresolved coastal ground report

The user's coastal map (display map3) ground-gap/falling-below-ground report is
**not fixed or closed by this highway patch**. The attachment's two official
transfers returned zero bytes/timed out; no screenshot has been inspected.
Independent seam/bridge/slope CPU exclusions do not disprove the user's event.
Coastal source, terrain rendering/support and vehicle physics remain unchanged.
No below-ground teleport/clamp has been added. Targeted location/visual evidence
is still needed; it must not be represented as part of this repair's green label.
