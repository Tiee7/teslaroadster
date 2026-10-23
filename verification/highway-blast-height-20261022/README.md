# Map1 airborne-wreck phantom collision — preview only

Succeeds `6bf9a327bfd6baeba48b8a9d62c4349379a152a8` on the existing
PR20 development branch. Main/production `4451a11c9c09d031a9da037ce63afe4bb7f062e5`
are not release targets. Keep all prior previews and immutable source epochs.

## Reproduced defect

A legal reset leaves the preceding crash's blasted NPCs in their existing arc.
The normal highway collision path ignored those NPCs' altitude and orientation:
it tested XZ proximity and treated every NPC as a ground car. A quick reset,
then uninterrupted W + `;`, could therefore hit a car still high overhead.

The retained exact6bf9 fixture reproduces six fatal cases:30/60/144Hz, each with
0 or0.2 seconds of explosion aftermath before the actual reset function. The
first false contact is1.47–1.79 seconds after reset at77.98–82.78m/s reported
impact. Independent actual r128 player/archived-NPC drawn vertices are still
10.65–15.57m vertically separated. `baseline-red-contract.tap` contains all six
original expected-red assertions; do not overwrite it with a passing log.

This is a CPU production-block replay with an explicit initial fatal-contact
fixture, not a drive from default spawn. Crash damage, blast, aftermath, reset,
force, traffic and collision code are original; VFX/debris/audio/DOM presentation
are isolated, including their RNG work. The chosen valid blast RNG seed is
explicit. No per-frame pose, NPC position, fuel or velocity forcing is used.
Actual native geometry is measured separately, not mocked by two height APIs.

## Minimal repair / preserved behavior

Add one rejection-only guard to an **already existing highway XZ candidate**
with positive `blastTimer`. Use the existing native visible-model bounds to
construct conservative root spheres: norm(half extents) + norm(local center).
These contain every orientation, so decorative player lean and full NPC
XYZ tumble cannot invalidate the proof. Use the unchanged highway visual-root
height, including suspension/aero squash and the existing ground0 clamp.
Only a strict vertical gap beyond the summed radii +1e-7m rejects contact.

This is intentionally not a complete3D/swept highway collision rewrite. The
old collision candidate, genuine low impacts, damage, bounce, roof cushion,
blast arc/expiry, safe incident-only rear respawn and normal replenishment
are otherwise byte-exact. Root spheres may admit conservative false positives
at smaller separations; no claim is made that every highway collision is solved.

Frozen: every car/model/material/scale, coast terrain/roads/bridge contacts,
render safeguards, force/handling constants, camera, four weather modes/night
default/daytime lights off, single passenger, highway density and scoring law.
The complete runtime inverse removes only the nine-line guard and restores
all6bf9 physics bytes. Original four source fixtures and every older epoch
remain hash-pinned; only historical read addresses/current successor pins move.

## Checks and limits

New17 behavior cases: six original false-contact replays, three genuine normal
hits, three genuine low-wreck hits, three complete no-contact state comparisons,
all native near/far NPC/player vertex containment plus21 tumble orientations,
and strict envelope/visual-root/mode/zero-blast boundaries. Five new source and
negative drift guards supplement the previous43. Focused repeats are overlaps,
not extra unique cases. Final applicable **1376 unique passes,0 skips**:1302 main +19 unchanged coast-map
serial +18 terrain +37 art. The original main batch retained one coast-map file
SIGKILL; the exact same19 assertions reran green, with all276 inputs unchanged.
This is joint coverage, not one all-green original batch. The12 unchanged long
planner files reuse the explicit prior baseline, not a fresh full-repository run.
Exact source/log identities are recorded in `regression-summary.json`.

No FPS/GPU improvement is claimed; this is a correctness guard, not a measured
performance optimization. No new browser/user-device pixel acceptance is claimed.
The original coastal screenshot/location remains unavailable and unlocalized;
this independent Map1 defect does not establish that every reported map gap is fixed.
