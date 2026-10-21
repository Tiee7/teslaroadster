# Quiet H brake · 2026-10-21

User: “H刹车不要有奇怪的音效”. Based on published main42db2bb744c8b4c42bebb34360030ff05cd10484. Scope is the H/foot-brake contribution to sound, not a new engine voice or a physical brake change.

## Cause and minimal change

H above200km/h/on airborne retro braking previously set the shared thrust/attitude audio flags. The original SoundEngine adds0.24main-jet gain plus0.09attitude gain, causing0.33forward retro noise (or0.24rear retro noise). There is no dedicated H key beep; current tire sound intensity is already zero.

Only six Boolean audio arguments change in physics-main.js: city/coast resolved-sound snapshots and the highway/Autopilot legacy audio call. H-derived retro is excluded; explicit S/reverse-derived retro remains. Actual rear boost/airborne throttle, lift and manual attitude/strafe remain audible when requested simultaneously with H. H's visible retro nozzles, physical braking, drag, COPV charge, empty-tank handling, landing safeguards, V8/audio graph, crash sounds and music are unchanged.

`tests/h-brake-sound.test.mjs` reconstructs the exact old physics source using only these six replacements and requires whole-source equality. It feeds real production motion flags through actual production city/coast/highway call sites and the original Web Audio graph with parameter mocks. This proves control/gain targets, **not subjective listening or native audio playback**.

## Verification

-107focused tests passed: braking, sound ownership/lifecycle, high-speed V8, H-only and mixed-input regression. New55cases include all3maps, ground/air, forward/backward travel, touch brake and low-speed mechanical braking; H+W/boost/lift/RCS/strafe/S preserves the separately requested sound.18scenarios×180ticks compare all numeric/Boolean physical state and impacts against exact prior-main physics with Object.is.
- `source-epoch.json` inherits the untouched historical driving-feedback epoch and owns only the new physics source hash. Prior audio.js/music.js hashes remain exact. Numeric projection program SHA stays03384f04166142255cc51b06f40a6843dc5069cf13ab93c7b4652190c87a2284; only source/full-function identity pins and generated mirrors change.
- check/build passed against regenerated root index. Aggregate runner925:924pass/1obsolete isolated sound-fixture failure,377.93s. The fixture was adapted without dropping assertions; final engine+H65/65passed. This covers924current business test instances (excluding one empty-filter runner), plus3unchanged-closure prior long runs:927instances total. Exact title multiset and all failed/passed/reused distinctions are retained in final-verification.json; not a claim of one all-green full npm run.
- The prior three12/16/20NPC×1800s long tests are eligible for reuse only because their entire source closure (coast-map.js,coast-road-network.js,coast-traffic-3d.test.mjs) remains byte-identical to published42db2bb. Final ledger records exact hashes and points to the original passing logs. These tests do not use physics-main.js/motion-harness, so this audio-only change does not invalidate their closure. No claim that they were rerun.

Browser WebGL is unavailable, and no new browser workaround, audio redesign, unrelated visual work or real-phone/FPS/listening claim is made. Publishing requires branch/PR checks, production READY and exact formal-domain root/CSS readback, not only local tests.
