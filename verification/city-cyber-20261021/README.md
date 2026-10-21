# City cyber district + contact diagnosis (2026-10-21)

## Verified defect, not an invented screenshot location

The submitted cockpit screenshot has no coordinates or collision source. It does
not establish a particular boundary wall, vehicle or building as its cause.
A separate prior-production defect is reproduced from frozen e95 source and both
actual native vehicle models: a pitched car outside a roof could project its nose
onto that roof in XZ, be snapped onto it without a 3D/tire-plane contact, and take
a fatal34.63m/s roof impact. The regression keeps that failing old-source witness.

Support now uses the actual YXZ oriented vehicle slice at the root/tire plane;
damaging roof landings additionally require closed3D solid contact (2mm top-face
numerical tolerance). Wall contact remains separate. Real soft/hard landings and
all35 helipad refill functions stay active. This fixes a proven non-contact path;
it is not a claim that the screenshot's unknown exact location was identified or
that every possible collision is exhaustively proven correct.

The bounded local incident recorder captures96 recent simulation frames, pose,
inputs, contact kind/id/logical building/bounds or traffic variant, accepted impact
and crash reason. The crash panel exposes selectable readonly JSON, including when
clipboard APIs are unavailable. Console alternative:
`JSON.stringify(RoadsterCityDiagnostics.snapshot(), null, 2)`.
No automatic upload, storage, clipboard access or external location collection.

## Visible architecture and budgets

The new district has denser street walls, taller interior layers, stepped forms,
large dark glazing/vertical light ribbons and street-level sign bands. Three
forward landmark signs break the repeated grid rhythm. The original procedural
atlas, six facade pixel families and continuous static night cube require no
third-party asset or new per-building light/postprocessing pass.

Native Three r128 structure:418 logical buildings,797 separate solid parts,450
flush sign panels. These are not450 extra buildings. Every opaque mass has its
own exact render/collision minY/roof descriptor; no stepped tower outer-AABB is
used as an obstacle.35pads and2skybridges remain.63 city mesh batches,69,332 maximum
triangles,6 shadow-casting body batches/9,564 body shadow triangles,1,048,576 raw
facade+atlas pixel bytes (sky/mipmap levels are separate). No per-frame instance
matrix refresh or added city light.64m static buckets reduce1323 sampled spatial
queries to mean2.59/max8 candidate boxes out of797, with no true contact omitted.
These are CPU/static budgets, not measured GPU calls, FPS or device temperature.

## Validation boundary

`city-study-0..4.png` use actual production meshes, matrices, stored texture pixels
and actual cockpit camera parameters, rasterized by a CPU z-buffer with approximate
lighting. They cover portrait spawn night/day, avenue night, crossing day and a
high view. They are **not WebGL screenshots or PBR/exposure/driving acceptance**.
Own cloud WebGL initialization failed; no authorized user-device GPU executor was
available. Real-device visual/heat verification therefore remains outside this
release's evidence. No asset was copied from a game screenshot.

The source epoch explicitly supersedes PR17, retains its frozen fixtures, and
hash-locks audio/H behavior, coast/map3, controls/metres, taxi capacity10/defaults,
city clock and highway modules. The emitted highway projection has a new explicit
source epoch, not a false byte-identity claim:840 old/new highway steps agree in
all state/cars/events. Full-test terminal statistics belong in final-verification
and are not inferred from focused tests or these CPU studies.
