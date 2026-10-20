# Phone driving visibility, cockpit eye and public city passengers

## Changes
- Coarse-pointer Full/Medium info cards start folded, open one closable bounded sheet at a time, and keep the close row sticky. Short occupied landscapes account for safe areas and shrink nonessential notice space. Minimal hides information, not actual input.
- All HUD modes retain dual sticks, right-stick mode, Jump/Hold/View/Reset, camera and reset. HUD/rotation/menu/blur cleanup clears stale pointer ownership; fresh touches work afterward. Portrait and short-landscape instruments reserve separate utility space.
- Shared FPV eye lowered from1.12m to1.04m inside both real canopy meshes. Existing camera FOV/near plane, vehicle pose transform, physical forces and previous cockpit fit tests remain unchanged.
- Map2 now exposes a native Passenger game / 接客游戏 toolbar button in every HUD mode. Click starts without the hidden native confirmation; click again exits cleanly. Existing = start shortcut remains guarded and repeat/focus safe. Maps1/3 cannot start it.
- Five passengers, ground pickup4m, destination2m,900m minimum routes,1,000–3,000 independent fares, crash/reset lifecycle and ranked-run mutual exclusion are retained.
- Map3, maps1/2 physical motion, autopilot and jet/audio rules are unchanged.

## Verification
Latest runtime bb56013 passed653/653 Node tests with0 failures/skips/cancellations, including95 targeted mobile/HUD/taxi/actual-r128-eye checks. Lua24, static identity29 + mirror3, numerical contract6 and846,720 Object.is old-map physical field comparisons passed. See final-verification.json and exact file manifests. The only later runtime-freeze difference is a README wording correction; executable/generated/test inputs are unchanged.

## Real boundaries
The user's portrait screenshot was actually materialized and visually inspected locally; it is not a publication asset. The normal HTTPS cloud browser still fails WebGL creation before UI initialization. Actual phone pixels/gameplay, GPU/FPS and hearing are not claimed. CSS budget tests are source/algebra checks, not rendered screenshots. Existing all-mode/high-density60-second collision-free autopilot acceptance is still unfinished.
