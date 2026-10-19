# Cockpit rain

## Behavior

- Eight small glass beads/trails use one preallocated 32-vertex, 16-triangle mesh and one transparent, depth-tested material. There is no full-screen rain texture or rain overlay.
- The reference windshield retains its existing planar geometry; the preserved classic canopy retains its original curved surface. Every water vertex samples the actual selected glass triangles and offsets 1.2 mm along their outward normals.
- Beads slowly move down the real glass, with a bounded speed response. Their projected widths stay around 2–4 pixels. Their trails are short and fade at both ends of the trajectory.
- The fixed cockpit camera and all instrument/wheel positions remain unchanged. Model-aware empty side bands keep the central road, speed, air, taxi display and wheel clear in landscape and portrait.
- Water appears only in rainy cockpit view on an intact vehicle. Dry weather, exterior views and destruction hide it. Repeated weather, view, model, cockpit and resize transitions reuse the same geometry, material and typed arrays. Canonical studio/paint previews never capture weather geometry.

## Cabin enclosure

The existing 1,500-line exterior rain field remains visible in all rainy views. A conservative cabin enclosure covers both models and the complete driver/dashboard volume. Once per rainy frame its inverse world transform is updated from the resolved player pose, including suspension, pitch, yaw and roll. A cheap world-space broad phase rejects distant streaks. Nearby whole segments are tested against the local enclosure, including long slanted segments whose endpoints both lie outside.

An intersecting segment is reduced to zero length for that frame. Its head remains in the simulation, and its tail is rebuilt on the next frame before testing, so no permanent gaps or duplicate particle respawns accumulate. Suppression affects only nearby streaks crossing the closed cabin. It does not depend on camera mode or an interior alpha mask.

## Verification

- `node --test tests/cockpit-rain.test.mjs`: continuous segment exclusion, production glass sampling/plane clearance, downward motion, bounded size, four model/cockpit combinations, resize and repeated weather/view lifecycle, preview exclusion and buffer reuse.
- `node verification/cockpit-rain-runtime-check.cjs /path/to/production/three.min.js verification/cockpit-rain-runtime-result.json`: uses actual Three.js r128 production geometries and transforms. It samples full drop trajectories and quad envelopes across two exteriors, two cabins and seven desktop, ultrawide, tablet, portrait and phone-landscape sizes (28 combinations). Exact triangle rays also sample four points inside every water triangle and verify glass attachment, visual accessibility and no screen/wheel projection overlap. Over 100,000 surviving world rain segments are independently checked against the moving enclosure on both maps, at several altitudes, speeds and full-rotation attitudes; previously suppressed segments are checked for restoration.
- `python3 verification/render-cockpit-rain-projection.py`: produces a clearly labeled CPU projection footprint diagnostic. It is not a gameplay screenshot.
- Normal release checks remain `python3 bundle_app.py`, `npm test`, `npm run check`, `npm run build`.

Browser validation was attempted in the cloud Chromium runtime. Chromium exited before creating a page because socket creation was denied (`Operation not permitted`). That restriction was not bypassed. CPU geometry, projection and ray checks do not establish final WebGL blending, perceived appearance, FPS, or real-device interaction quality. No browser/GPU performance pass is claimed.
