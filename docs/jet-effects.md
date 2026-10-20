# Cold-gas and high-speed visual revision

## What changed

- The previous shock visualization was a persistent, double-sided conical cylinder plus a thick blue annulus. Its broad faces crossed the car silhouette. Both have been removed.
- Crossing the existing230 mph gameplay threshold produces the same0.8-second, aft-opening, broken condensation sleeve. While still above threshold, body-side wisps repeat a random3–5 simulation seconds after disappearing. Repeats do not replay audio, speech, banners or camera shake. Loss of eligibility/focus/visibility, menus and reset clear the scheduler without timers or backlog. The215 mph audio re-arm threshold and score rules stay intact; this game threshold is not real Mach1.
- Each active cold-gas outlet uses a single shared open-envelope geometry, one transparent, depth-tested shader and no depth writes. A low alpha floor and two-sided shell retain a faint gas cue when looking down the jet axis from chase/orbit views. It has a narrow origin, an outward-only axis and a soft length/angular falloff. There are no luminous disks, stacked Mach rings, solid white cones, extra particle pools or new lights.
- Reference and classic rear mouths are separately aligned with their actual lips. Underside lift outlets sit between the axles. Top and side mouth hardware is permanently hidden on both bodies, including after view/layout changes; their gas effects are retained. Front retro mouths and rear propulsion are unchanged.
- J/L roll now displays side exhaust, sharing the four side plumes with yaw and strafe. Top gas is reserved for actual paid Shift descent, not roll, pitch or inferred retro velocity. Bottom lift/pitch/downward-travel retro cues remain. This requested display mapping does not change actual attitude torque, braking or fuel use. The legacy ten-indicator schematic remains a set of logical controller groups.
- Rendering reads accepted, already-paid production requests. Analog input scales power, width and length. Hover, low-pressure descent and emergency landing retain distinct power. Retro cues follow paid pre-brake travel except that top plumes are now Shift-only as requested. No tank charge, force, impulse or score calculation was added to display code.
- Every plume is hidden in FPV without changing its accepted power or instrumented physics. Reset/destruction clears plume and condensation visibility immediately.

## Verification

The original effect-only revision retained a byte-identical motion section apart
from its read-only velocity snapshot. That is historical, not a claim about the
current city-scale/infinite-air/flight-alert source. The current release uses
[explicit source epochs and physical-field comparisons](../verification/controls-city-scale/README.md).
The new road-hop marker controls only alert presentation and is separately tested;
49-field motion equivalence does not certify audio events.

`tests/jet-effects.test.mjs` executes accepted production requests, not a reimplemented force model. Its 6,720-case matrix covers both maps, both physics modes, both exteriors/cabins, 30/60/144 Hz and an irregular 23 ms frame, and tank levels 0, 0.001, 0.006, 2 and 10 seconds. Cases include electric ground W, rear boost, H/S retro, airborne W/boost, lift, jump, hold, active descent, both roll/pitch/yaw/strafe directions, backwards retro, combined inputs and release. Additional checks cover analog values, emergency landing at low tank, 3D retro, immediate clearing and FPV suppression.

The historical `verification/verify-jet-effects.cjs` audit loaded its recorded
Three r128 source snapshot and checked the following. Its old roll/top mapping and
one-shot call contract must not be treated as current-release acceptance:

- Finite geometry, nondegenerate triangles, outward winding and unit-normal checks
- 10,368 longitudinal envelope-trajectory rays across both bodies/cabins and rear gimbal positions -0.14/0/+0.14 radians, including actual body, wheels and interior obstacles; zero intersections
- Independent exhaust/reaction force and roll/pitch/yaw torque direction checks, pure-strafe torque cancellation and seven 3D paid-retro vectors
- 30/60/144 Hz condensation expiry, bounded opacity, actual-world-travel alignment and FPV suppression

Current deterministic checks (the old standalone audit requires its matching
historical source/contract, not arbitrary current files):

    node --test tests/jet-effects.test.mjs
    node --test tests/sonic-condensation-repeat.test.mjs tests/autopilot-key-badges.test.mjs tests/freefall.test.mjs
    python3 bundle_app.py
    npm test
    python3 tests/lua_runtime.py
    npm run check
    npm run build

## Visual evidence and limits

The supplied comparison and mode sheets are Blender Cycles CPU renders of the actual live production Three r128 meshes and poses. Geometry is exported directly by `verification/export-jet-effects.cjs`. Gas/condensation alpha is sampled from the production shader functions at source vertices and approximated in Blender; per-fragment interpolation, transparent compositing, anti-aliasing and screen tone mapping can differ from WebGL. Studio cameras, lighting, floor and elevated flight-display poses are disclosed in the manifests. They are not gameplay/browser screenshots, concept art, generated images or GPU frame-rate evidence.

The cloud browser cannot initialize this game's WebGL renderer, and the previously denied local socket/DevTools path was not retried. Real-device/WebGL shader compilation, final transparent blending and interactive FPS remain unverified. The frame-rate matrix verifies deterministic control/visual behavior, not measured rendering speed. The effect reduces transparent meshes in the rear-plus-condensation case from 30 to 5; this is a draw-structure comparison, not an FPS claim.
