# Cold-gas and high-speed visual revision

## What changed

- The previous shock visualization was a persistent, double-sided conical cylinder plus a thick blue annulus. Its broad faces crossed the car silhouette. Both have been removed.
- Crossing the existing 230 mph gameplay threshold now produces one 0.8-second, aft-opening, broken condensation sleeve. It follows actual travel, fades completely, and stays hidden in cockpit view. The 215 mph re-arm threshold, sonic audio, existing camera-shake request and score rules are retained. The banner/voice identifies this as a stylized game threshold; 370 km/h is not real Mach 1.
- Each active cold-gas outlet uses a single shared open-envelope geometry, one transparent, depth-tested shader and no depth writes. A low alpha floor and two-sided shell retain a faint gas cue when looking down the jet axis from chase/orbit views. It has a narrow origin, an outward-only axis and a soft length/angular falloff. There are no luminous disks, stacked Mach rings, solid white cones, extra particle pools or new lights.
- Reference and classic rear mouths are separately aligned with their actual lips. Underside lift outlets sit between the axles, below each body's real undertray. Small unlit top/side/front rims mark the corresponding outlets. Front retro jets clear the reference splitter. All visual jets follow the vehicle hierarchy and rear gimbal.
- Lift, descent, roll and pitch share the four bottom/four top outlets. A yaw couple and pure strafe share the four side outlets, combining powers once per mouth. The rear four and front two provide longitudinal thrust. The legacy ten-indicator schematic remains a set of logical controller groups.
- Rendering reads accepted, already-paid production requests. Analog input scales power, width and length. Hover is visibly weaker; the existing low-pressure descent cue and full emergency-landing command remain distinct. Retro jets also use the paid pre-brake 3D travel vector, so sideways/vertical braking chooses corresponding ports. No tank charge, force, impulse or score calculation was added to the display code.
- Every plume is hidden in FPV without changing its accepted power or instrumented physics. Reset/destruction clears plume and condensation visibility immediately.

## Verification

The existing production motion section, from mode setup through movement, tank consumption, lift/gravity, attitude and collision handling, is byte-identical to the reviewed baseline after removing a read-only pre-brake velocity snapshot. The runtime audit records its SHA-256. No physics constants, drag, speed settling, gas consumption or scoring rules changed.

`tests/jet-effects.test.mjs` executes accepted production requests, not a reimplemented force model. Its 6,720-case matrix covers both maps, both physics modes, both exteriors/cabins, 30/60/144 Hz and an irregular 23 ms frame, and tank levels 0, 0.001, 0.006, 2 and 10 seconds. Cases include electric ground W, rear boost, H/S retro, airborne W/boost, lift, jump, hold, active descent, both roll/pitch/yaw/strafe directions, backwards retro, combined inputs and release. Additional checks cover analog values, emergency landing at low tank, 3D retro, immediate clearing and FPV suppression.

`verification/verify-jet-effects.cjs` loads the actual production Three r128 meshes and performs:

- Finite geometry, nondegenerate triangles, outward winding and unit-normal checks
- 10,368 longitudinal envelope-trajectory rays across both bodies/cabins and rear gimbal positions -0.14/0/+0.14 radians, including actual body, wheels and interior obstacles; zero intersections
- Independent exhaust/reaction force and roll/pitch/yaw torque direction checks, pure-strafe torque cancellation and seven 3D paid-retro vectors
- 30/60/144 Hz condensation expiry, bounded opacity, actual-world-travel alignment and FPV suppression

Reproduce from the project root with an official Three.js r128 runtime:

    node --test tests/jet-effects.test.mjs
    node verification/verify-jet-effects.cjs /path/to/three-r128.min.js src /path/to/reviewed-baseline/src
    python3 bundle_app.py
    npm test
    python3 tests/lua_runtime.py
    npm run check
    npm run build

## Visual evidence and limits

The supplied comparison and mode sheets are Blender Cycles CPU renders of the actual live production Three r128 meshes and poses. Geometry is exported directly by `verification/export-jet-effects.cjs`. Gas/condensation alpha is sampled from the production shader functions at source vertices and approximated in Blender; per-fragment interpolation, transparent compositing, anti-aliasing and screen tone mapping can differ from WebGL. Studio cameras, lighting, floor and elevated flight-display poses are disclosed in the manifests. They are not gameplay/browser screenshots, concept art, generated images or GPU frame-rate evidence.

The cloud browser cannot initialize this game's WebGL renderer, and the previously denied local socket/DevTools path was not retried. Real-device/WebGL shader compilation, final transparent blending and interactive FPS remain unverified. The frame-rate matrix verifies deterministic control/visual behavior, not measured rendering speed. The effect reduces transparent meshes in the rear-plus-condensation case from 30 to 5; this is a draw-structure comparison, not an FPS claim.
