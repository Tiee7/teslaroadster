// Generated verification-only static prototype. No runtime compilation or filesystem access.
// PROJECTION_MANIFEST_BEGIN
// {"schema":"verification-browser-static-projection-v1","numericalProgramSourceSha256":"42fa09be66c5e9c53631019487be63471361812651be7132996187663a6123a3","sourceHashes":{"src/config.js":"b464401a77b311409067f0168278d650d36cb7e5e010dc3c592b01900f592d13","src/physics-main.js":"5b9714605d3360890996ffe12afadcdf78949f5e059baa47fcd220a954611ee7","src/highway-demo.js":"0cd1e9a3367a04565835f9ae042d4b1aa62ed710acaf2534c64f043c5fbaec07","src/highway-traffic.js":"7381a48eee3314a95961ad24cc353402e7d0bd5a5e62bb51cb66e3aa063200ec","src/ui-hud.js":"75ad7d56aead3544af1d1943241fe950450fc3d4c5ef254180cb609791b3eba4","src/audio.js":"b23863a246ae21e00b43faa3779ce8e64e2a5c47ecc0a42dbdd1496acf9c5662","tests/helpers/demo-harness.mjs":"69868deb4aed37cc25c78828fdc9ef34eae4ffae217396b965807f7277f3feff","tests/helpers/vendor/three-r128-MathUtils.mjs":"09ee4ebbae9976c1c9803eaafe5cb7553fcd58f34293fd557dc51c2ac8fe1f61"},"nodeGeneratorSha256":"fad5db8d8d59c34b778950e96d1fb0b738ebc3683c26cf7a8432b49f020fdee3","mathIdentityProfilesSha256":"2d588d45a973970ea3bb253e9eeeafee137fa923785ec107d846498859a9ba3a","mathProfiles":[{"id":"three-r128-cpu-vendor-uncompressed","bundleSha256":"09ee4ebbae9976c1c9803eaafe5cb7553fcd58f34293fd557dc51c2ac8fe1f61"},{"id":"three-r128-browser-bundle-minified","bundleSha256":"9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2"}],"functionSources":{"updateSimulation":{"sha256":"d54040047ed0c5300a95a713c86cc5cadd642fd56c0858678e29df48241a4517","length":100322},"wrapAnglePi":{"sha256":"4a43189ee76d5927e870e14a61a5de8fe71d91dcb8c3a5996d52adc61fa19c52","length":115},"getAirCoastSpeed":{"sha256":"a28838d75ef7eb311382889019adb04a0392039d602d57c4a1fa8e1f98702db1","length":267},"advanceAirHandling":{"sha256":"666321f0cafd62302defc849466ac1b91a25a7c13503a3e1717409e7c9a2194a","length":1083},"getResponsiveAirCoastSpeed":{"sha256":"4ba61ba3a0538edfe2dc6fe63a956e2a01485170ce5a4a81a5b5c2a62227d01d","length":790},"addAirThrust":{"sha256":"1d1613fbc72b5abd17e81d1342e86518a6163e9fb05801e233aa92e9c9ce117f","length":609},"getGroundCoastSpeed":{"sha256":"119b5e596df0f96db75fcc8e4dbc1c29e9dca12fdf5ecb82b4d5e050f75e013a","length":1009},"accelerateGroundSpeed":{"sha256":"665c7b6007346970dc442806dc72c40aba6876bb77521676c4a1929877ca51d1","length":440},"getRetroBrakeDemand":{"sha256":"d17e531a89053170e6a39cadd0af7bc814415b7c826c33d0b67a631d4f1707b2","length":489},"integrateFreefall":{"sha256":"7137e52a2fe6232f082a5005dcdbcab6dfe2d3447fd0feff151346e5ea19de21","length":394},"readDriveInput":{"sha256":"1952a40c7ef5a01c84c8068067d105255a0c0b31481f64ad144b930a25424b0e","length":964},"readAttitudeInput":{"sha256":"17388c049d61ae0971a299fc465d961777796d339226e4539fb6c0a980a1b1eb","length":1256},"advanceAttitudeIdle":{"sha256":"30ec9a47d560129ad4d035e1510538a917b16360b067e1586c7279770f249fb6","length":363},"triggerJump6m":{"sha256":"a7ae117b5a80fa902a8b0dc2c35620adb00cf5d75d45c4b1f369dcdd6d88b43e","length":2325},"trafficStep":{"sha256":"738f8de20ce9c46bd60c19fce8bf632ae1316423715f12b3f9278c1dbc4d2862","length":9521},"trafficForecastStep":{"sha256":"b9139b47a65aa989b55ee97a3b4ef0f8ab8ca71b66f8c2b7d8b9928f4d0920df","length":284},"demoSweptContact":{"sha256":"6f92640e8a8b99e27bcdf2d521b7720af099dd1ee72378349b2b15138acbddc5","length":668}},"numericalSegments":[{"name":"world-tank-mass-constants","file":"src/config.js","begin":20617,"end":22307,"firstLine":357,"lastLine":389,"sourceSha256":"0993e80c745eb69e56c40c3e8cf6dd1bde4040e5479be178765848cd4852d268","emittedSha256":"0993e80c745eb69e56c40c3e8cf6dd1bde4040e5479be178765848cd4852d268","transformations":[]},{"name":"numeric-and-busy-input-helpers","file":"src/physics-main.js","begin":13995,"end":45157,"firstLine":351,"lastLine":765,"sourceSha256":"60c4cdc65a0c83841c58a8841c18ff09712a018975a887a2d1ff4c753ea8c917","emittedSha256":"60c4cdc65a0c83841c58a8841c18ff09712a018975a887a2d1ff4c753ea8c917","transformations":[]},{"name":"motion-gas-altitude-attitude-body","file":"src/physics-main.js","begin":49941,"end":105272,"firstLine":874,"lastLine":1882,"sourceSha256":"e51766f3a7624d2bf07cb32ef3ae1bde619ac97a338522df2c38c47757fe7173","emittedSha256":"ef0edea5f68205c19ab7a1b1c658e570cef4d0109d9c5507fa75a4866d955cf9","transformations":["insert fail-closed guard at true highway rail branch before correction"]},{"name":"npc-contact-body","file":"src/physics-main.js","begin":114359,"end":121715,"firstLine":2057,"lastLine":2146,"sourceSha256":"f4d326d34af93f9f12be82790593b92fe4a4a519da78c18b1f160cc5a3d5ece4","emittedSha256":"264b15239241d510ff9d67ef28ce580904fe8b3246713f9ce5eabbb3f15f1816","transformations":["remove enclosing production trafficCars.forEach terminator only","insert fail-closed guard at true roof-bounce branch before response","insert fail-closed guard at true body-contact branch before response"]},{"name":"real-g-feedback-tail","file":"src/physics-main.js","begin":122756,"end":123203,"firstLine":2166,"lastLine":2171,"sourceSha256":"780158edc83ce2b46b5f83ed8dd3e3965c3b674e65e65efb0d8c635101669247","emittedSha256":"780158edc83ce2b46b5f83ed8dd3e3965c3b674e65e65efb0d8c635101669247","transformations":[]},{"name":"complete-highway-traffic-module","file":"src/highway-traffic.js","begin":0,"end":31022,"firstLine":1,"lastLine":534,"sourceSha256":"7381a48eee3314a95961ad24cc353402e7d0bd5a5e62bb51cb66e3aa063200ec","emittedSha256":"7381a48eee3314a95961ad24cc353402e7d0bd5a5e62bb51cb66e3aa063200ec","transformations":[]},{"name":"demo-handling-and-swept-contact-only","file":"src/highway-demo.js","begin":583,"end":1503,"firstLine":9,"lastLine":34,"sourceSha256":"be8dbba5158270e41c9a7cb4126704e89ba326fcdbcf9669b84f1e0521f32cb7","emittedSha256":"be8dbba5158270e41c9a7cb4126704e89ba326fcdbcf9669b84f1e0521f32cb7","transformations":[]},{"name":"numeric-jump-trigger","file":"src/ui-hud.js","begin":45972,"end":48299,"firstLine":966,"lastLine":1005,"sourceSha256":"297cef1a6f773865f68230d7580b7054ad443ca62075ed43cf0b8c6b3fbbfa8b","emittedSha256":"297cef1a6f773865f68230d7580b7054ad443ca62075ed43cf0b8c6b3fbbfa8b","transformations":[]},{"name":"banner-state-write-before-dom","file":"src/ui-hud.js","begin":12050,"end":12178,"firstLine":307,"lastLine":313,"sourceSha256":"3ff17448794a377bbf396e0a8a9840d79ea315465e36b20b8f89a56af0a33d9a","emittedSha256":"3ff17448794a377bbf396e0a8a9840d79ea315465e36b20b8f89a56af0a33d9a","transformations":[]},{"name":"official-r128-clamp","file":"tests/helpers/vendor/three-r128-MathUtils.mjs","begin":1071,"end":1248,"firstLine":32,"lastLine":40,"sourceSha256":"2b4faee78e40819cbede5285ac90f501de5a8a97d0796b6ce23c772118a2f392","emittedSha256":"2b4faee78e40819cbede5285ac90f501de5a8a97d0796b6ce23c772118a2f392","transformations":[]},{"name":"official-r128-lerp","file":"tests/helpers/vendor/three-r128-MathUtils.mjs","begin":1806,"end":1954,"firstLine":69,"lastLine":76,"sourceSha256":"c99a3f41efd33e5fd7efdbc3519e3db58c78d380a1d98b51c6ea62423d9a72e1","emittedSha256":"c99a3f41efd33e5fd7efdbc3519e3db58c78d380a1d98b51c6ea62423d9a72e1","transformations":[]}],"buildRule":"All complete source bytes and the frozen generator must match. Any mismatch requires an explicit new epoch; do not refresh automatically.","runtimeRule":"First bind exact Function.prototype.toString for actual named functions plus exact constant/handling values and one audited math pair; every later entry checks cached function/math/handling references and constant values.","snapshotContract":"Trusted plain internal lossless data only; no hostile Proxy/accessor/prototype/observer input. Browser JavaScript has no isProxy intrinsic; this does not widen the Node adversarial-input proof.","oracleBoundary":"CPU harness may declare the complete updateSimulation function for source identity only; its numerical oracle still executes only the established extracted body/contact/G regions, not full updateSimulation or page rendering.","productionAuthority":"Prototype only. Existing strict bridge scope and every phase/route/history/NPC/ownership/budget condition remain required. This module never independently grants reuse authority."}
// PROJECTION_MANIFEST_END
const RoadsterDemoNumericProjection = (()=>{
'use strict';
const manifest=Object.freeze({"schema":"verification-browser-static-projection-v1","numericalProgramSourceSha256":"42fa09be66c5e9c53631019487be63471361812651be7132996187663a6123a3","sourceHashes":{"src/config.js":"b464401a77b311409067f0168278d650d36cb7e5e010dc3c592b01900f592d13","src/physics-main.js":"5b9714605d3360890996ffe12afadcdf78949f5e059baa47fcd220a954611ee7","src/highway-demo.js":"0cd1e9a3367a04565835f9ae042d4b1aa62ed710acaf2534c64f043c5fbaec07","src/highway-traffic.js":"7381a48eee3314a95961ad24cc353402e7d0bd5a5e62bb51cb66e3aa063200ec","src/ui-hud.js":"75ad7d56aead3544af1d1943241fe950450fc3d4c5ef254180cb609791b3eba4","src/audio.js":"b23863a246ae21e00b43faa3779ce8e64e2a5c47ecc0a42dbdd1496acf9c5662","tests/helpers/demo-harness.mjs":"69868deb4aed37cc25c78828fdc9ef34eae4ffae217396b965807f7277f3feff","tests/helpers/vendor/three-r128-MathUtils.mjs":"09ee4ebbae9976c1c9803eaafe5cb7553fcd58f34293fd557dc51c2ac8fe1f61"},"nodeGeneratorSha256":"fad5db8d8d59c34b778950e96d1fb0b738ebc3683c26cf7a8432b49f020fdee3","mathIdentityProfilesSha256":"2d588d45a973970ea3bb253e9eeeafee137fa923785ec107d846498859a9ba3a","mathProfiles":[{"id":"three-r128-cpu-vendor-uncompressed","bundleSha256":"09ee4ebbae9976c1c9803eaafe5cb7553fcd58f34293fd557dc51c2ac8fe1f61"},{"id":"three-r128-browser-bundle-minified","bundleSha256":"9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2"}],"functionSources":{"updateSimulation":{"sha256":"d54040047ed0c5300a95a713c86cc5cadd642fd56c0858678e29df48241a4517","length":100322},"wrapAnglePi":{"sha256":"4a43189ee76d5927e870e14a61a5de8fe71d91dcb8c3a5996d52adc61fa19c52","length":115},"getAirCoastSpeed":{"sha256":"a28838d75ef7eb311382889019adb04a0392039d602d57c4a1fa8e1f98702db1","length":267},"advanceAirHandling":{"sha256":"666321f0cafd62302defc849466ac1b91a25a7c13503a3e1717409e7c9a2194a","length":1083},"getResponsiveAirCoastSpeed":{"sha256":"4ba61ba3a0538edfe2dc6fe63a956e2a01485170ce5a4a81a5b5c2a62227d01d","length":790},"addAirThrust":{"sha256":"1d1613fbc72b5abd17e81d1342e86518a6163e9fb05801e233aa92e9c9ce117f","length":609},"getGroundCoastSpeed":{"sha256":"119b5e596df0f96db75fcc8e4dbc1c29e9dca12fdf5ecb82b4d5e050f75e013a","length":1009},"accelerateGroundSpeed":{"sha256":"665c7b6007346970dc442806dc72c40aba6876bb77521676c4a1929877ca51d1","length":440},"getRetroBrakeDemand":{"sha256":"d17e531a89053170e6a39cadd0af7bc814415b7c826c33d0b67a631d4f1707b2","length":489},"integrateFreefall":{"sha256":"7137e52a2fe6232f082a5005dcdbcab6dfe2d3447fd0feff151346e5ea19de21","length":394},"readDriveInput":{"sha256":"1952a40c7ef5a01c84c8068067d105255a0c0b31481f64ad144b930a25424b0e","length":964},"readAttitudeInput":{"sha256":"17388c049d61ae0971a299fc465d961777796d339226e4539fb6c0a980a1b1eb","length":1256},"advanceAttitudeIdle":{"sha256":"30ec9a47d560129ad4d035e1510538a917b16360b067e1586c7279770f249fb6","length":363},"triggerJump6m":{"sha256":"a7ae117b5a80fa902a8b0dc2c35620adb00cf5d75d45c4b1f369dcdd6d88b43e","length":2325},"trafficStep":{"sha256":"738f8de20ce9c46bd60c19fce8bf632ae1316423715f12b3f9278c1dbc4d2862","length":9521},"trafficForecastStep":{"sha256":"b9139b47a65aa989b55ee97a3b4ef0f8ab8ca71b66f8c2b7d8b9928f4d0920df","length":284},"demoSweptContact":{"sha256":"6f92640e8a8b99e27bcdf2d521b7720af099dd1ee72378349b2b15138acbddc5","length":668}},"numericalSegments":[{"name":"world-tank-mass-constants","file":"src/config.js","begin":20617,"end":22307,"firstLine":357,"lastLine":389,"sourceSha256":"0993e80c745eb69e56c40c3e8cf6dd1bde4040e5479be178765848cd4852d268","emittedSha256":"0993e80c745eb69e56c40c3e8cf6dd1bde4040e5479be178765848cd4852d268","transformations":[]},{"name":"numeric-and-busy-input-helpers","file":"src/physics-main.js","begin":13995,"end":45157,"firstLine":351,"lastLine":765,"sourceSha256":"60c4cdc65a0c83841c58a8841c18ff09712a018975a887a2d1ff4c753ea8c917","emittedSha256":"60c4cdc65a0c83841c58a8841c18ff09712a018975a887a2d1ff4c753ea8c917","transformations":[]},{"name":"motion-gas-altitude-attitude-body","file":"src/physics-main.js","begin":49941,"end":105272,"firstLine":874,"lastLine":1882,"sourceSha256":"e51766f3a7624d2bf07cb32ef3ae1bde619ac97a338522df2c38c47757fe7173","emittedSha256":"ef0edea5f68205c19ab7a1b1c658e570cef4d0109d9c5507fa75a4866d955cf9","transformations":["insert fail-closed guard at true highway rail branch before correction"]},{"name":"npc-contact-body","file":"src/physics-main.js","begin":114359,"end":121715,"firstLine":2057,"lastLine":2146,"sourceSha256":"f4d326d34af93f9f12be82790593b92fe4a4a519da78c18b1f160cc5a3d5ece4","emittedSha256":"264b15239241d510ff9d67ef28ce580904fe8b3246713f9ce5eabbb3f15f1816","transformations":["remove enclosing production trafficCars.forEach terminator only","insert fail-closed guard at true roof-bounce branch before response","insert fail-closed guard at true body-contact branch before response"]},{"name":"real-g-feedback-tail","file":"src/physics-main.js","begin":122756,"end":123203,"firstLine":2166,"lastLine":2171,"sourceSha256":"780158edc83ce2b46b5f83ed8dd3e3965c3b674e65e65efb0d8c635101669247","emittedSha256":"780158edc83ce2b46b5f83ed8dd3e3965c3b674e65e65efb0d8c635101669247","transformations":[]},{"name":"complete-highway-traffic-module","file":"src/highway-traffic.js","begin":0,"end":31022,"firstLine":1,"lastLine":534,"sourceSha256":"7381a48eee3314a95961ad24cc353402e7d0bd5a5e62bb51cb66e3aa063200ec","emittedSha256":"7381a48eee3314a95961ad24cc353402e7d0bd5a5e62bb51cb66e3aa063200ec","transformations":[]},{"name":"demo-handling-and-swept-contact-only","file":"src/highway-demo.js","begin":583,"end":1503,"firstLine":9,"lastLine":34,"sourceSha256":"be8dbba5158270e41c9a7cb4126704e89ba326fcdbcf9669b84f1e0521f32cb7","emittedSha256":"be8dbba5158270e41c9a7cb4126704e89ba326fcdbcf9669b84f1e0521f32cb7","transformations":[]},{"name":"numeric-jump-trigger","file":"src/ui-hud.js","begin":45972,"end":48299,"firstLine":966,"lastLine":1005,"sourceSha256":"297cef1a6f773865f68230d7580b7054ad443ca62075ed43cf0b8c6b3fbbfa8b","emittedSha256":"297cef1a6f773865f68230d7580b7054ad443ca62075ed43cf0b8c6b3fbbfa8b","transformations":[]},{"name":"banner-state-write-before-dom","file":"src/ui-hud.js","begin":12050,"end":12178,"firstLine":307,"lastLine":313,"sourceSha256":"3ff17448794a377bbf396e0a8a9840d79ea315465e36b20b8f89a56af0a33d9a","emittedSha256":"3ff17448794a377bbf396e0a8a9840d79ea315465e36b20b8f89a56af0a33d9a","transformations":[]},{"name":"official-r128-clamp","file":"tests/helpers/vendor/three-r128-MathUtils.mjs","begin":1071,"end":1248,"firstLine":32,"lastLine":40,"sourceSha256":"2b4faee78e40819cbede5285ac90f501de5a8a97d0796b6ce23c772118a2f392","emittedSha256":"2b4faee78e40819cbede5285ac90f501de5a8a97d0796b6ce23c772118a2f392","transformations":[]},{"name":"official-r128-lerp","file":"tests/helpers/vendor/three-r128-MathUtils.mjs","begin":1806,"end":1954,"firstLine":69,"lastLine":76,"sourceSha256":"c99a3f41efd33e5fd7efdbc3519e3db58c78d380a1d98b51c6ea62423d9a72e1","emittedSha256":"c99a3f41efd33e5fd7efdbc3519e3db58c78d380a1d98b51c6ea62423d9a72e1","transformations":[]}],"buildRule":"All complete source bytes and the frozen generator must match. Any mismatch requires an explicit new epoch; do not refresh automatically.","runtimeRule":"First bind exact Function.prototype.toString for actual named functions plus exact constant/handling values and one audited math pair; every later entry checks cached function/math/handling references and constant values.","snapshotContract":"Trusted plain internal lossless data only; no hostile Proxy/accessor/prototype/observer input. Browser JavaScript has no isProxy intrinsic; this does not widen the Node adversarial-input proof.","oracleBoundary":"CPU harness may declare the complete updateSimulation function for source identity only; its numerical oracle still executes only the established extracted body/contact/G regions, not full updateSimulation or page rendering.","productionAuthority":"Prototype only. Existing strict bridge scope and every phase/route/history/NPC/ownership/budget condition remain required. This module never independently grants reuse authority."});
const CONTROL_PHYSICS_KEYS=Object.freeze(["x","y","z","vx","vy","vz","speed","maxSpeed","airMaxSpeed","physicsMode","insaneMode","gasMassKg","airStrafeSpeed","steerInput","steerAngle","roll","pitch","yaw","vRoll","vPitch","vYaw","attitudeIdleSeconds","accumulatedRoll","lateralG","longitudinalG","prevSpeed","airRemaining","airUsedContinuous","infiniteJet","isFreefalling","isAutoDescending8s","isJumping6m","isAltitudeHold","isAutoLandingSave","wasAirborne","jumpInertiaSeconds","jumpInertiaGraceSeconds","driftAngle","isDrifting","wasHandbraking","autoStabilizer","isDestroyed","hullIntegrity","impactCooldown","jumpStartY","jumpTargetY","holdTargetY","hudMode","hudMinimal"]);
const expectedFunctions=Object.freeze({"updateSimulation":"function updateSimulation(dt, presentationDt = dt) {\n  const presentFrame = presentationDt !== null;\n  globalThis.window?.RoadsterDemo?.step(dt);\n  const t = I18N[currentLang];\n\n  if (state.impactCooldown > 0) {\n    state.impactCooldown = Math.max(0, state.impactCooldown - dt);\n  }\n\n  updateExplosions(dt);\n  if (typeof updateTireSmokeParticles === 'function') {\n    const scrollDz = (currentMap === 'highway' ? (-state.vz) * WORLD_SPEED_SCALE * dt : 0.0);\n    updateTireSmokeParticles(dt, scrollDz);\n  }\n\n  if (state.isDestroyed) {\n    if (typeof clearThrusterVisuals === 'function') clearThrusterVisuals();\n    debrisPieces.forEach((p) => {\n      p.vy -= 22.0 * dt;\n      p.mesh.position.x += p.vx * dt;\n      p.mesh.position.y += p.vy * dt;\n      p.mesh.position.z += p.vz * dt;\n      p.mesh.rotation.x += p.rx * dt;\n      p.mesh.rotation.y += p.ry * dt;\n      p.mesh.rotation.z += p.rz * dt;\n      if (p.mesh.position.y < 0.15) {\n        p.mesh.position.y = 0.15;\n        p.vy = -p.vy * 0.45;\n        p.vx *= 0.82;\n        p.vz *= 0.82;\n      }\n    });\n    // Continue animating blasted traffic cars during explosion aftermath!\n    trafficCars.forEach((car) => {\n      // Destruction returns before the normal traffic controller. Its aftermath\n      // still retries each queue's placement policy; incident recovery stays\n      // behind the crash and never materializes inside another vehicle.\n      if (currentMap === 'highway' && car.mode === 'highway' &&\n          (car.highwayWaitingToSpawn !== undefined ||\n           (!(car.blastTimer > 0) && highwayTraffic.isOutOfBounds(car, LANE_CENTERS, { z: 0 })))) {\n        const refill = car.highwayWaitingToSpawn !== undefined ? highwayTraffic.retrySpawn : highwayTraffic.respawnBehind;\n        refill(car, trafficCars, LANE_CENTERS,\n          { x: state.x, y: state.y, z: 0, vx: state.vx, vz: state.vz }, WORLD_SPEED_SCALE);\n        return;\n      }\n      if (car.blastTimer && car.blastTimer > 0) {\n        car.blastTimer = Math.max(0, car.blastTimer - dt);\n        car.mesh.position.x += car.blastVx * dt;\n        car.mesh.position.z += car.blastVz * dt;\n        car.y = (car.y || 0) + car.blastVy * dt;\n        car.blastVy -= 22.0 * dt;\n        if (car.y <= 0) {\n          car.y = 0;\n          car.blastVy = -car.blastVy * 0.42;\n          car.blastVx *= Math.pow(0.25, dt);\n          car.blastVz *= Math.pow(0.25, dt);\n        }\n        car.mesh.position.y = car.y;\n        car.mesh.rotation.x += car.blastVPitch * dt;\n        car.mesh.rotation.y += car.blastVYaw * dt;\n        car.mesh.rotation.z += car.blastVRoll * dt;\n        if (currentMap === 'highway' &&\n            (car.blastTimer <= 0.01 || highwayTraffic.isOutOfBounds(car, LANE_CENTERS, { z: 0 }))) {\n          highwayTraffic.respawnBehind(car, trafficCars, LANE_CENTERS,\n            { x: state.x, y: state.y, z: 0, vx: state.vx, vz: state.vz }, WORLD_SPEED_SCALE);\n        }\n      }\n    });\n    if (!cityOwnsDrivingSound() && !coastOwnsDrivingSound()) sound.update(0, false, false, true);\n    document.getElementById('ui-flight-mode').textContent = t.modeDestroyed;\n    document.getElementById('ui-flight-mode').className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-300';\n    document.getElementById('val-hull-pct').textContent = '0%';\n    document.getElementById('hull-bar-fill').style.width = '0%';\n    return;\n  }\n\n  \n  const scoreMotionStart = RoadsterDrivingScore.motion(state, currentMap);\n  const isRealMode = (state.physicsMode === 'realistic');\n  const cityMotionStart = currentMap === 'city' ? {x:state.x,y:state.y,z:state.z,yaw:state.yaw,pitch:state.pitch,roll:state.roll} : null;\n  const coastMotionStart = currentMap === 'coast' ? {x:state.x,y:state.y,z:state.z,yaw:state.yaw,pitch:state.pitch,roll:state.roll,vy:state.vy} : null;\n  if(coastMotionStart&&typeof playerWrapper!=='undefined'&&typeof roadsterAttitudeGroup!=='undefined')coastMotionStart.contactPose={x:state.x,y:playerWrapper.position.y,z:state.z,pitch:roadsterAttitudeGroup.rotation.x,yaw:roadsterAttitudeGroup.rotation.y,roll:roadsterAttitudeGroup.rotation.z};\n  const coastObstacles = currentMap === 'coast' ? (globalThis.window?.RoadsterCoast?.buildings() || []) : null;\n  const coastTrafficStart = currentMap === 'coast' ? new Map(trafficCars.map(c=>[c,{x:c.mesh.position.x,y:c.mesh.position.y,z:c.mesh.position.z,yaw:c.mesh.rotation.y,pitch:c.mesh.rotation.x,roll:c.mesh.rotation.z,visible:c.mesh.visible}])) : null;\n  state.gasMassKg = Number((144.0 * (state.airRemaining / MAX_AIR_SECONDS)).toFixed(1));\n  const currentVehicleMass = VEHICLE_MASS_KG + (state.gasMassKg || 0);\n  const fuelBurnThrustFactor = (VEHICLE_MASS_KG + 144.0) / Math.max(1850.0, currentVehicleMass);\n  let currentGroundAccel = 16.5;\n  let currentAirAccel = 9.5;\n  let currentLiftAccel = 8.2 * 1.3;   // +30% climb acceleration (10.66 m/s²)\n  let currentMaxClimbVy = 6.2 * 1.3;  // +30% Space climb speed (8.06 m/s)\n  let tireScreechIntensity = 0.0;\n\n  const coastWorld = currentMap === 'coast' ? globalThis.window?.RoadsterCoast : null;\n  let coastSupport = coastWorld?.support({...state,grounded:!state.wasAirborne});\n  let groundElevation = coastSupport && Number.isFinite(coastSupport.height) ? coastSupport.height : 0;\n  if (currentMap === 'city' || currentMap === 'coast') {\n    const mapBuildings = coastObstacles || cityNearbyBuildings(state);\n    for (let i = 0; i < mapBuildings.length; i++) {\n      const b = mapBuildings[i];\n      if (coastWorld && state.y + 1.25 < (b.minY ?? 0)) continue;\n      if (currentMap === 'city' ? cityTouchesRoof(state,b) : state.x > b.minX - 1.1 && state.x < b.maxX + 1.1 && state.z > b.minZ - 1.8 && state.z < b.maxZ + 1.8) {\n        if (state.y >= b.height - 0.55) {\n          groundElevation = Math.max(groundElevation, b.height);\n        }\n      }\n    }\n  }\n  // O has already supplied vertical launch velocity, even before this frame's\n  // altitude integration. Do not run another tire-grip/drive frame on takeoff.\n  let isAirborne = coastWorld\n    ? Math.abs(state.y-groundElevation)>.15 || !coastSupport?.solid || (state.isJumping6m&&state.vy>0) || state.coastDetached===true || (state.wasAirborne&&!state.coastSupportId)\n    : (state.y - groundElevation) > 0.15 || (state.isJumping6m && state.vy > 0);\n  let coastGroundAttached = Boolean(coastWorld&&!isAirborne);\n  if(coastWorld){state.coastSupportId=coastGroundAttached?coastSupport.id:null;state.coastDetached=false;}\n  if (!isAirborne) state.groundHopActive = false;\n  const { rawRollInput, rawPitchInput, rawYawInput, hasManualAttitudeInput } = readAttitudeInput(isAirborne);\n  const stabilizerDt = advanceAttitudeIdle(dt, hasManualAttitudeInput || !isAirborne);\n\n  // Unified COPV Air Tank Consumption Helper (Requirement 3: ALL airborne thrusters & ';' rear boost consume tank)\n  let airConsumedThisFrame = 0;\n  function consumeAirTank(amount, airborneNow) {\n    if (amount <= 0 || state.isFreefalling || state.airRemaining <= 0) return false;\n    // Infinite mode changes the shared tank, not thrust strength or input.\n    if (state.infiniteJet) { airConsumedThisFrame += amount; return true; }\n    const airBefore = state.airRemaining;\n    state.airRemaining = Math.max(0.0, state.airRemaining - amount);\n    state.airUsedContinuous = MAX_AIR_SECONDS - state.airRemaining;\n    if (state.airRemaining <= 0.001) {\n      const flightAlertEligible = airborneNow && isAirborne && !state.groundHopActive && !state.isJumping6m && !Number.isFinite(state.jumpInertiaSeconds);\n      state.airRemaining = 0.0;\n      state.airUsedContinuous = MAX_AIR_SECONDS;\n      state.isFreefalling = true;\n      state.isAutoDescending8s = false;\n      state.isAltitudeHold = false;\n      state.isJumping6m = false;\n      // Losing thrust changes acceleration, never the current velocity.\n      // A depleted road tank (including the complete O-hop) is not flight.\n      // This presentation-only marker never changes gas, force or ballistics.\n      if (flightAlertEligible) {\n        showBanner('freefall', 3.5);\n        sound.speakAlert('freefall', 'Critical alert: compressed air depleted. Immediate freefall!', '严重警报：冷气推进剂耗尽，进入自由落体！');\n      }\n      airConsumedThisFrame += airBefore - state.airRemaining;\n      return false;\n    } else if (state.airUsedContinuous >= AUTO_DESCENT_USED_SECONDS && airborneNow) {\n      if (!state.isAutoDescending8s) {\n        state.isAutoDescending8s = true;\n        showBanner('8s', 2.4);\n        sound.speakAlert('8s', 'Warning: Low tank pressure. Auto-descent engaged.', '警告：气瓶压力低于百分之二十，自动下降已启动。');\n      }\n    }\n    airConsumedThisFrame += airBefore - state.airRemaining;\n    return true;\n  }\n\n  let canUseRCS = !state.isFreefalling && state.airRemaining > 0.005;\n\n  // Requirement 4: ';' (Semicolon) triggers Rear Cold-Gas Rocket Boost in Realistic (Standard) mode!\n  const driveInput = readDriveInput();\n  if(currentMap==='city')window.RoadsterCityDiagnostics?.begin(state,dt,driveInput);\n  // Deliberate lift/hold leaves a road hop for actual flight; W held while\n  // driving over a hop alone must not accidentally arm the flight alarm.\n  if (isAirborne && (driveInput.lift > 0 || state.isAltitudeHold)) state.groundHopActive = false;\n  const isRearBoostKey = driveInput.boost > 0;\n  const isThrottleW = driveInput.throttle > 0;\n  const isAccelerating = isThrottleW || (isRearBoostKey && canUseRCS);\n\n  // Set mode-specific dynamic limits (calibrated to 0-100 km/h in 1.9s & venue scale)\n  if (isRealMode) {\n    if (state.insaneMode || (isRearBoostKey && canUseRCS)) {\n      // Plaid mode or ';' Rear Rocket Boost: unlocks up to 370 km/h (= 102.78 m/s) & 38 m/s² rocket thrust\n      state.maxSpeed = 370.0 / 3.6;\n      currentGroundAccel = 38.0;\n      state.airMaxSpeed = 52.0;\n      currentAirAccel = 24.0;\n    } else {\n      // Standard EV propulsion reaches 200 km/h; existing boosted momentum coasts down.\n      state.maxSpeed = STANDARD_EV_MAX_MPS;\n      currentGroundAccel = 16.5;\n      state.airMaxSpeed = 31.5;\n      currentAirAccel = 9.5;\n    }\n    currentLiftAccel = 8.2 * 1.3;\n    currentMaxClimbVy = 6.2 * 1.3;\n  } else {\n    // 幻想模式 (Fantasy Mode) - 加速大幅提升:\n    // 地面极速提高至 576 km/h (160 m/s)，空中最高 260 m/s\n    // 默认纯电驱动加速度大幅提高至 72.0 m/s² (0-100 仅需约 0.38s)\n    state.maxSpeed = 160.0;\n    state.airMaxSpeed = 260.0;\n    currentGroundAccel = 72.0;\n    currentAirAccel = 92.0;\n    currentLiftAccel = 48.0 * 1.3;\n    currentMaxClimbVy = 36.0 * 1.3;\n  }\n  const isStandardEVMode = isRealMode && !state.insaneMode && state.maxSpeed === STANDARD_EV_MAX_MPS;\n  const electricGroundAccel = isRealMode ? (state.insaneMode ? 38.0 : 16.5) : 72.0;\n  const electricAirAccel = isRealMode ? (state.insaneMode ? 24.0 : 9.5) : (currentMap !== 'highway' ? 145.0 : 92.0);\n  const rearJetAccel = isRealMode ? 38.0 : 120.0;\n  const groundDriveAccel = (speed, electricFactor = 1, jetFactor = 1) => {\n    // A small jet request must not turn a held W into full rocket power, or\n    // extend the electric motor past its existing 200 km/h ceiling.\n    const electric = isRealMode && !state.insaneMode && speed >= STANDARD_EV_MAX_MPS\n      ? 0 : electricGroundAccel * driveInput.throttle * electricFactor;\n    const jet = isRearThrusterFiring ? rearJetAccel * driveInput.boost * jetFactor : 0;\n    return Math.max(electric, jet);\n  };\n\n  // Requirement 1 & 2:\n  // • When throttle (W or ;) and foot brake (H) / reverse (S) are pressed simultaneously, execute throttle and ignore foot brake/reverse.\n  // • Handbrake (B) MUST work even when throttle (W) is held (\"不松油门的情况下目前手刹无法正常使用\")!\n  const isFootBraking = driveInput.brake > 0 && !isAccelerating;\n  const isReversing = driveInput.reverse > 0 && !isAccelerating;\n  const isHandbraking = driveInput.handbrake > 0;\n  const isAirBrakingActive = isFootBraking || (isAirborne && isReversing);\n  const coastDragCoeff = ((currentMap === 'coast' ? state.y-groundElevation : state.y) > 0.2 || Math.abs(state.speed) > 33.0) ? 0.44 : 0.34;\n  state.dragCoeffCd = isAirBrakingActive ? coastDragCoeff + (0.72 - coastDragCoeff) * Math.max(driveInput.brake, driveInput.reverse) : coastDragCoeff;\n\n  // Determine if the 4 Rear SpaceX Cold-Gas Nozzles are firing this frame:\n  // 用户要求: \"在空中飞行的时候，按W需要喷气，地上的W不喷气\"\n  // • 空中 (isAirborne === true): 按下 W 或 ; 均启动尾部冷气推进器喷气加速并消耗气瓶\n  // • 地面 (isAirborne === false): 按下 W 仅使用纯电驱动（不喷气），按下 ; 才触发尾部火箭喷气\n  let isRearThrusterFiring = false;\n  if (canUseRCS) {\n    if (isAirborne && (isThrottleW || isRearBoostKey)) {\n      const airBurnRate = Math.max(0.85 * driveInput.boost, 0.65 * driveInput.throttle);\n      isRearThrusterFiring = consumeAirTank(airBurnRate * dt, true);\n    } else if (!isAirborne && isRearBoostKey) {\n      isRearThrusterFiring = consumeAirTank(0.85 * driveInput.boost * dt, false);\n    }\n  }\n  canUseRCS = !state.isFreefalling && state.airRemaining > 0.005;\n\n  // One brake request and one COPV charge, shared by H and S. Throttle's\n  // established priority above remains unchanged, including touch controls.\n  const brakeTravelSpeed = isAirborne\n    ? Math.hypot(state.vx, state.vy, state.vz)\n    : (currentMap === 'highway' ? Math.abs(state.speed) : Math.hypot(state.vx, state.vz));\n  const retroBrakeDemand = (isFootBraking || isReversing)\n    ? getRetroBrakeDemand(brakeTravelSpeed, isAirborne) * Math.max(driveInput.brake, driveInput.reverse) : 0;\n  let retroImpulseSeconds = 0;\n  if (retroBrakeDemand > 0 && !state.isFreefalling && state.airRemaining > 0) {\n    const requestedAir = RETRO_BRAKE_BURN_PER_SECOND * retroBrakeDemand * dt;\n    const airBefore = state.airRemaining;\n    const consumedBefore = airConsumedThisFrame;\n    consumeAirTank(state.infiniteJet ? requestedAir : Math.min(airBefore, requestedAir), isAirborne);\n    // The final fraction of a nearly empty tank supplies only its proportional\n    // impulse, even when consumeAirTank returns false on depletion.\n    retroImpulseSeconds = Math.min(requestedAir, airConsumedThisFrame - consumedBefore) / RETRO_BRAKE_BURN_PER_SECOND;\n  }\n  const isRetroBrakeFiring = retroImpulseSeconds > 0;\n  const retroBrakeAccel = RETRO_BRAKE_FORCE_N / currentVehicleMass;\n  canUseRCS = !state.isFreefalling && state.airRemaining > 0.005;\n\n  // Ground steering uses A / D only (J / L are exclusively Roll!)\n  const steerLeft = Boolean(keys['KeyA']);\n  const steerRight = Boolean(keys['KeyD']);\n  const lateralInput = isAirborne ? 0 : driveInput.steer;\n\n  // Only the opt-in highway stunt demo uses the quicker bounded rack. Manual\n  // A/D, city, drift and all airborne handling keep their established response.\n  const demoGroundHandling = currentMap === 'highway' && !isAirborne && globalThis.window?.RoadsterDemo?.isActive()\n    && typeof RoadsterHighwayDemoPlanner !== 'undefined' ? RoadsterHighwayDemoPlanner.handling : null;\n  const demoGroundSweep = demoGroundHandling ? { x:state.x, y:state.y, cars:new Map(trafficCars\n    .filter(c=>c.mode==='highway' && c.mesh.visible!==false && c.highwayWaitingToSpawn===undefined)\n    .map(c=>[c,{x:c.mesh.position.x,z:c.mesh.position.z}])) } : null;\n  const steerRate = demoGroundHandling ? demoGroundHandling.rackRate : lateralInput !== 0 ? 8.0 : 11.0;\n  const rackBlend = demoGroundHandling ? 1.0 - Math.exp(-steerRate * dt) : Math.min(1.0, steerRate * dt);\n  state.steerInput = (state.steerInput || 0) + (lateralInput - (state.steerInput || 0)) * rackBlend;\n  if (Math.abs(state.steerInput) < 0.004 && lateralInput === 0) state.steerInput = 0.0;\n  state.steerAngle = -state.steerInput * 0.38;\n  frontWheelSteerGroups.forEach(g => { g.rotation.y = state.steerAngle; });\n\n  // Requirement 2 & 3: In mid-air, Q / E controls lateral body movement AND consumes COPV air tank!\n  const wantsAirJetLeft = isAirborne && (Boolean(keys['KeyQ']) || driveInput.strafe < 0);\n  const wantsAirJetRight = isAirborne && (Boolean(keys['KeyE']) || driveInput.strafe > 0);\n  let airJetLeft = false;\n  let airJetRight = false;\n  if ((wantsAirJetLeft || wantsAirJetRight) && canUseRCS) {\n    const strafePower = Math.max(Math.abs(driveInput.strafe), Number(Boolean(keys.KeyQ || keys.KeyE)));\n    if (consumeAirTank(0.45 * strafePower * dt, true)) {\n      airJetLeft = wantsAirJetLeft;\n      airJetRight = wantsAirJetRight;\n    }\n  }\n  canUseRCS = !state.isFreefalling && state.airRemaining > 0.005;\n\n  // Car nose 3D unit vector in world space (Requirement 5: Rear thruster accelerates in NOSE direction, not camera direction)\n  const noseHorizX = -Math.sin(state.yaw);\n  const noseHorizZ = -Math.cos(state.yaw);\n  const rightHorizX = Math.cos(state.yaw);\n  const rightHorizZ = -Math.sin(state.yaw);\n  const nosePitchCos = Math.cos(state.pitch);\n  const nosePitchSin = Math.sin(state.pitch);\n\n  const airHandlingDt = advanceAirHandling(dt, isAirborne);\n  if (isAirborne) {\n    state.isDrifting = false;\n    state.wasHandbraking = false;\n    state.driftAngle = 0.0;\n    // Takeoff retains its inherited vector. Established flight smoothly regains\n    // the controlled speed envelope and nose/bank response used before it.\n    if (isRearThrusterFiring) {\n      const jetAirAccel = currentMap !== 'highway' && !isRealMode ? 145.0 : currentAirAccel;\n      const boostAirAccel = Math.max(electricAirAccel * driveInput.throttle, jetAirAccel * driveInput.boost);\n      const thrust = addAirThrust(state.vx, state.vz,\n        noseHorizX * nosePitchCos * boostAirAccel * dt,\n        noseHorizZ * nosePitchCos * boostAirAccel * dt, state.airMaxSpeed);\n      state.vx = thrust.vx;\n      state.vz = thrust.vz;\n      const maxAirVy = currentMaxClimbVy * 1.35;\n      const verticalImpulse = boostAirAccel * nosePitchSin * 0.55 * dt;\n      state.vy += verticalImpulse > 0 ? Math.min(verticalImpulse, Math.max(0, maxAirVy - state.vy)) : verticalImpulse;\n      const horizMag = Math.hypot(state.vx, state.vz);\n      if (horizMag > state.airMaxSpeed && airHandlingDt > 0) {\n        // Settle inherited overspeed continuously; never clip the O launch or\n        // jump directly to a new propulsion limit when changing flight modes.\n        const nextMag = state.airMaxSpeed + (horizMag - state.airMaxSpeed) * Math.exp(-3.0 * airHandlingDt);\n        state.vx *= nextMag / horizMag;\n        state.vz *= nextMag / horizMag;\n      }\n    } else {\n      const horizMag = Math.hypot(state.vx, state.vz);\n      const launchCoast = getAirCoastSpeed(horizMag, Math.max(0, dt - airHandlingDt));\n      const nextMag = getResponsiveAirCoastSpeed(launchCoast, airHandlingDt);\n      const coastScale = horizMag > 0 ? nextMag / horizMag : 0;\n      state.vx *= coastScale;\n      state.vz *= coastScale;\n    }\n\n    // Explicit side jets keep their proportional input throughout takeoff.\n    // Bank assist and powered sideslip control blend in after the brief carry.\n    const jetDir = airJetLeft || airJetRight ? driveInput.strafe : 0;\n    const bankStrafe = canUseRCS ? Math.sin(state.roll) * 10.0 : 0;\n    const targetStrafe = jetDir * 18.0 + bankStrafe;\n    const strafeRate = isRearThrusterFiring ? 10.0 : 6.5;\n    const lateralSpeed = state.vx * rightHorizX + state.vz * rightHorizZ;\n    const strafeDt = jetDir !== 0 ? dt : airHandlingDt;\n    const strafeChange = jetDir !== 0 || Math.abs(bankStrafe) > 0.001 || isRearThrusterFiring\n      ? (targetStrafe - lateralSpeed) * (1.0 - Math.exp(-strafeRate * strafeDt))\n      : 0;\n    state.vx += rightHorizX * strafeChange;\n    state.vz += rightHorizZ * strafeChange;\n    state.airStrafeSpeed = lateralSpeed + strafeChange;\n    state.speed = Math.hypot(state.vx, state.vz);\n  } else {\n    if (state.wasAirborne) {\n      // Hand inertial flight velocity back to the existing signed ground-drive convention.\n      const forwardVelocity = state.vx * noseHorizX + state.vz * noseHorizZ;\n      state.speed = (forwardVelocity >= 0 ? 1 : -1) * Math.hypot(state.vx, state.vz);\n    }\n    state.airStrafeSpeed = 0.0;\n  }\n  state.wasAirborne = isAirborne;\n\n  // Apply the paid impulse opposite actual travel, never camera/nose heading.\n  // A scalar clamp preserves direction and cannot propel the car through zero.\n  const retroTravelSpeed = isAirborne ? Math.hypot(state.vx, state.vy, state.vz)\n    : (currentMap === 'highway' ? Math.abs(state.speed) : Math.hypot(state.vx, state.vz));\n  const retroScale = retroTravelSpeed > 0\n    ? Math.max(0, retroTravelSpeed - retroBrakeAccel * retroImpulseSeconds) / retroTravelSpeed : 0;\n  const retroUsesRearNozzles = isAirborne\n    ? (state.vx * noseHorizX * nosePitchCos + state.vy * nosePitchSin + state.vz * noseHorizZ * nosePitchCos) < 0\n    : (state.vx * noseHorizX + state.vz * noseHorizZ) < 0;\n  // Snapshot only for rendering the already-paid brake impulse in its travel direction.\n  const retroVisualVx = state.vx, retroVisualVy = isAirborne ? state.vy : 0, retroVisualVz = state.vz;\n  if (isRetroBrakeFiring) {\n    state.vx *= retroScale;\n    state.vz *= retroScale;\n    if (isAirborne) state.vy *= retroScale;\n    state.speed = isAirborne ? Math.hypot(state.vx, state.vz) : state.speed * retroScale;\n  }\n\n  if (currentMap === 'highway') {\n    if (!isAirborne) {\n      // Ground mode on highway\n      if (isAccelerating) {\n        const effAccel = groundDriveAccel(state.speed, isHandbraking ? 1 - 0.12 * driveInput.handbrake : 1, fuelBurnThrustFactor);\n        if (state.speed < -0.5) {\n          state.speed = Math.min(0.0, state.speed + 38.0 * Math.max(driveInput.throttle, driveInput.boost) * dt);\n        } else {\n          state.speed = accelerateGroundSpeed(state.speed, effAccel, state.maxSpeed, dt, isStandardEVMode);\n        }\n      } else if (isFootBraking) {\n        if (state.speed > 0.1) {\n          state.speed = Math.max(0.0, state.speed - 38.0 * driveInput.brake * dt);\n        } else if (state.speed < -0.1) {\n          state.speed = Math.min(0.0, state.speed + 38.0 * driveInput.brake * dt);\n        } else {\n          state.speed = 0.0;\n        }\n      } else if (isReversing) {\n        if (state.speed > 0.3) {\n          state.speed *= Math.pow(0.95, dt * driveInput.reverse);\n        } else if (state.speed < -15.0) {\n          // A fast backward landing brakes toward reverse cruise; the reverse\n          // speed limit must never teleport existing momentum to -15 m/s.\n          state.speed = Math.min(-15.0, state.speed + 38.0 * driveInput.reverse * dt);\n        } else {\n          state.speed = Math.max(-15.0, state.speed - 16.0 * driveInput.reverse * dt);\n        }\n      } else if (!isHandbraking) {\n        // Gentle coasting, including a continuous 30%-stronger normal EV overrun.\n        state.speed = getGroundCoastSpeed(state.speed, dt, isStandardEVMode);\n      }\n\n      const speedFactor = THREE.MathUtils.clamp(Math.abs(state.speed) / 14.0, 0.0, 1.25);\n      const turnSign = state.speed >= -0.1 ? 1 : -1;\n\n      // Fix Issue 1: Handbrake (U) breaks rear tire lateral grip for smooth drift without abrupt dead-stop,\n      // and immediately stops decelerating the instant U is released!\n      if (isHandbraking && Math.abs(state.speed) > 1.5) {\n        state.wasHandbraking = true;\n        if (lateralInput !== 0 || Math.abs(state.driftAngle) > 0.04) {\n          state.isDrifting = true;\n          const targetSlip = -state.steerInput * 0.58 * turnSign * driveInput.handbrake;\n          state.driftAngle += (targetSlip - state.driftAngle) * 8.5 * dt;\n          state.yaw = state.driftAngle;\n          state.vYaw = 0.0;\n          const driftSlideVx = state.steerInput * Math.min(22.0, Math.abs(state.speed) * 0.56) * driveInput.handbrake;\n          const noseThrustVx = isRearThrusterFiring ? (noseHorizX * state.speed * 0.85) : (noseHorizX * state.speed * 0.48);\n          state.vx += (driftSlideVx + noseThrustVx - state.vx) * 9.5 * dt;\n          if (!isAccelerating) {\n            // Very light tire-scrub (~1.2 m/s²) so handbrake never locks/stops the car\n            state.speed = Math.sign(state.speed) * Math.max(0.0, Math.abs(state.speed) - 1.2 * driveInput.handbrake * dt);\n          }\n        } else {\n          state.isDrifting = false;\n          state.driftAngle *= Math.pow(0.05, dt);\n          if (!isAccelerating) {\n            state.speed = Math.sign(state.speed) * Math.max(0.0, Math.abs(state.speed) - 1.2 * driveInput.handbrake * dt);\n          }\n        }\n      } else {\n        state.isDrifting = false;\n        state.wasHandbraking = false;\n        state.driftAngle *= Math.pow(0.005, dt);\n        if (demoGroundHandling) {\n          const targetVx = state.steerInput * demoGroundHandling.lateralSpeed * THREE.MathUtils.clamp(Math.abs(state.speed) / 18.0, 0, 1);\n          const targetYaw = -Math.atan2(targetVx, Math.max(12, Math.abs(state.speed))) * turnSign;\n          state.yaw += wrapAnglePi(targetYaw - state.yaw) * (1.0 - Math.exp(-demoGroundHandling.yawRate * dt));\n          state.vx += (targetVx - state.vx) * (1.0 - Math.exp(-demoGroundHandling.lateralRate * dt));\n        } else {\n          const targetHwyYaw = -state.steerInput * 0.16 * turnSign * Math.min(1.0, speedFactor);\n          state.yaw += wrapAnglePi(targetHwyYaw - state.yaw) * (1.0 - Math.exp(-12.0 * dt));\n          state.vYaw = 0.0;\n          const targetVx = isRearThrusterFiring\n            ? (noseHorizX * state.speed)\n            : (state.steerInput * 13.5 * speedFactor + noseHorizX * state.speed * 0.35);\n          state.vx += (targetVx - state.vx) * 14.0 * dt;\n        }\n      }\n      state.vz = noseHorizZ * state.speed;\n    }\n\n    state.x += state.vx * dt;\n    state.z = 0;\n\n    const halfRoad = ROAD_WIDTH / 2 - 1.25;\n    if (state.x < -halfRoad || state.x > halfRoad) {\n      const hitSpeed = Math.abs(state.vx) + Math.abs(state.speed) * 0.22;\n      state.x = THREE.MathUtils.clamp(state.x, -halfRoad, halfRoad);\n      if (state.y < 1.2 && hitSpeed > 12.0) {\n        triggerPhysicsCollision(hitSpeed, 'crashReasonThreshold', state.x < 0 ? 6.5 : -6.5, 1.2, 0);\n      }\n      const isSteeringIntoRail = (state.x <= -halfRoad && state.steerInput < -0.05) || (state.x >= halfRoad && state.steerInput > 0.05);\n      if (isSteeringIntoRail) {\n        state.vx = 0.0;\n      } else {\n        state.vx = (state.x < 0 ? 1 : -1) * Math.min(2.5, Math.abs(state.vx) * 0.25);\n      }\n      if (isAirborne) {\n        const horizontalSpeed = Math.hypot(state.vx, state.vz);\n        const railScale = horizontalSpeed > 0 ? Math.max(0, horizontalSpeed - 8.0 * dt) / horizontalSpeed : 0;\n        state.vx *= railScale;\n        state.vz *= railScale;\n        state.speed = Math.hypot(state.vx, state.vz);\n      } else {\n        state.speed = Math.max(0.0, state.speed - 8.0 * dt);\n      }\n      state.yaw -= wrapAnglePi(state.yaw) * (1.0 - Math.pow(0.04, dt));\n    }\n  } else {\n    // City Open-World Mode: True 2D Velocity Vector + Momentum-Preserving Handbrake Drift\n    if (!isAirborne) {\n      state.airStrafeSpeed = 0.0;\n      let vForward = state.vx * noseHorizX + state.vz * noseHorizZ;\n      let vLateral = state.vx * rightHorizX + state.vz * rightHorizZ;\n      const totalGroundSpd = Math.hypot(vForward, vLateral);\n      const forwardSign = (vForward >= -0.5 || state.speed >= -0.2) ? 1 : -1;\n      let signedSpd = forwardSign * totalGroundSpd;\n\n      if (isHandbraking && totalGroundSpd > 1.5) {\n        // Fix Issue 1: Momentum-preserving handbrake drift!\n        // Preserves total speed magnitude instead of wiping out vLateral when yaw rotates,\n        // so pulling the handbrake NEVER causes an abrupt dead stop!\n        state.wasHandbraking = true;\n        state.isDrifting = Math.abs(state.steerInput) > 0.04 || Math.abs(state.driftAngle) > 0.05;\n        const turnDir = forwardSign;\n        const pivotSpeedFactor = THREE.MathUtils.clamp(totalGroundSpd / 6.5, 0.35, 1.25);\n        const handbrakeYawRate = state.steerInput * 3.85 * pivotSpeedFactor * turnDir * driveInput.handbrake;\n        state.yaw -= handbrakeYawRate * dt;\n        state.vYaw = 0.0;\n\n        const targetSlip = state.steerInput * 0.55 * turnDir * driveInput.handbrake;\n        state.driftAngle += (targetSlip - state.driftAngle) * 7.5 * dt;\n\n        if (isRearThrusterFiring) {\n          signedSpd = accelerateGroundSpeed(signedSpd, groundDriveAccel(signedSpd), state.maxSpeed, dt, isStandardEVMode);\n          state.driftAngle *= Math.pow(0.15, dt);\n        } else if (isAccelerating) {\n          signedSpd = accelerateGroundSpeed(signedSpd, groundDriveAccel(signedSpd, 1 - 0.15 * driveInput.handbrake), state.maxSpeed * 0.94, dt, isStandardEVMode);\n        } else if (isFootBraking) {\n          signedSpd = Math.sign(signedSpd) * Math.max(0, Math.abs(signedSpd) - 38.0 * driveInput.brake * dt);\n        } else {\n          // Very gentle tire-scrub (~1.2 m/s²) while coasting in handbrake drift\n          if (signedSpd > 0) {\n            signedSpd = Math.max(0.0, signedSpd - 1.2 * driveInput.handbrake * dt);\n          } else {\n            signedSpd = Math.min(0.0, signedSpd + 1.2 * driveInput.handbrake * dt);\n          }\n        }\n\n        // Velocity vector points along (state.yaw + state.driftAngle), preserving full speed magnitude!\n        const travelYaw = state.yaw + state.driftAngle;\n        state.vx = -Math.sin(travelYaw) * signedSpd;\n        state.vz = -Math.cos(travelYaw) * signedSpd;\n        state.speed = signedSpd;\n      } else {\n        // The instant Handbrake (U) is released, transfer full totalGroundSpd cleanly into vForward\n        // so zero momentum is lost and deceleration stops immediately!\n        if (state.wasHandbraking) {\n          vForward = signedSpd;\n          vLateral = 0.0;\n          state.wasHandbraking = false;\n        }\n        state.isDrifting = false;\n        state.driftAngle *= Math.pow(0.005, dt);\n\n        // Normal grippy Ackermann steering\n        const absSpd = Math.abs(vForward);\n        if (absSpd > 0.2) {\n          const turnDir = vForward >= -0.1 ? 1 : -1;\n          const lowSpeedFactor = THREE.MathUtils.clamp(absSpd / 7.5, 0.0, 1.0);\n          const highSpeedDamp = 1.0 / (1.0 + absSpd * 0.015);\n          const yawRate = state.steerInput * 2.35 * lowSpeedFactor * highSpeedDamp * turnDir;\n          state.yaw -= yawRate * dt;\n        }\n        state.vYaw = 0.0;\n\n        const newNoseX = -Math.sin(state.yaw);\n        const newNoseZ = -Math.cos(state.yaw);\n        const newRightX = Math.cos(state.yaw);\n        const newRightZ = -Math.sin(state.yaw);\n\n        if (isRearThrusterFiring) {\n          vForward = accelerateGroundSpeed(vForward, groundDriveAccel(vForward), state.maxSpeed, dt, isStandardEVMode);\n          vLateral *= Math.pow(0.002, dt);\n        } else if (isAccelerating) {\n          if (vForward < -0.5) {\n            vForward = Math.min(0.0, vForward + 38.0 * driveInput.throttle * dt);\n          } else {\n            vForward = accelerateGroundSpeed(vForward, groundDriveAccel(vForward), state.maxSpeed, dt, isStandardEVMode);\n          }\n          vLateral *= Math.pow(0.004, dt);\n        } else if (isFootBraking) {\n          if (vForward > 0.1) {\n            vForward = Math.max(0.0, vForward - 38.0 * driveInput.brake * dt);\n          } else if (vForward < -0.1) {\n            vForward = Math.min(0.0, vForward + 38.0 * driveInput.brake * dt);\n          } else {\n            vForward = 0.0;\n          }\n          vLateral *= Math.pow(0.004, dt * driveInput.brake);\n        } else if (isReversing) {\n          if (vForward > 0.3) {\n            vForward *= Math.pow(0.95, dt * driveInput.reverse);\n          } else if (vForward < -15.0) {\n            vForward = Math.min(-15.0, vForward + 38.0 * driveInput.reverse * dt);\n          } else {\n            vForward = Math.max(-15.0, vForward - 16.0 * driveInput.reverse * dt);\n          }\n          vLateral *= Math.pow(0.004, dt * driveInput.reverse);\n        } else {\n          // Match the highway's continuous normal EV overspeed coasting.\n          vForward = getGroundCoastSpeed(vForward, dt, isStandardEVMode);\n          const wetFriction = (weatherIndex === 1 ? 0.65 : 0.004);\n          vLateral *= Math.pow(wetFriction, dt);\n        }\n\n        state.vx = newNoseX * vForward + newRightX * vLateral;\n        state.vz = newNoseZ * vForward + newRightZ * vLateral;\n        state.speed = (vForward >= -0.1 ? 1 : -1) * Math.hypot(state.vx, state.vz);\n      }\n    }\n\n    // A 300 m city block is traversed in 300 / velocity seconds, on ground or in air.\n    const moveScale = CITY_WORLD_SPEED_SCALE;\n    if(coastGroundAttached){\n      // Gravity projected onto the actual plane, coast only. EV/jet drive and\n      // all map1/2 coefficients above remain untouched.\n      state.vx += EARTH_GRAVITY_MPS2*coastSupport.normal.x*coastSupport.normal.y*dt;\n      state.vz += EARTH_GRAVITY_MPS2*coastSupport.normal.z*coastSupport.normal.y*dt;\n    }\n    state.x += state.vx * moveScale * dt;\n    state.z += state.vz * moveScale * dt;\n\n    const limit = CITY_HALF_BOUND - 2.2;\n    const cityWall=currentMap==='city'?cityVisibleBoundaryHit(cityMotionStart,state):null;\n    if (currentMap==='city' ? cityWall!==null : Math.abs(state.x) > limit || Math.abs(state.z) > limit) {\n      if(cityWall){\n        const t=Math.max(0,cityWall.t-1e-5),contactAxis=cityWall.axis;state[contactAxis]=cityMotionStart[contactAxis]+(state[contactAxis]-cityMotionStart[contactAxis])*t;\n        // Resolve an initial overlap as well as a swept crossing, otherwise a\n        // resting edge can rebound repeatedly on successive frames.\n        const body=cityPlayerBody(state),axis=cityWall.axis,n=cityWall.normal,radius=axis==='x'?body.rx:body.rz;\n        state[axis]+=cityWall.sign*CITY_HALF_BOUND+n*(1+radius+.005)-body[axis];\n        const key=axis==='x'?'vx':'vz',impactV=Math.max(0,-state[key]*n);\n        if(impactV>0){state[key]+=1.35*impactV*n;state.speed=isAirborne?Math.hypot(state.vx,state.vz):-state.vx*Math.sin(state.yaw)-state.vz*Math.cos(state.yaw);}\n        if(impactV>10){window.RoadsterCityDiagnostics?.contact({kind:'boundary',axis,sign:cityWall.sign,height:45.3,normal:n});triggerPhysicsCollision(impactV,'crashReasonThreshold',0,2,0);}\n      } else {\n        const impactV = Math.abs(state.speed);\n        state.x = THREE.MathUtils.clamp(state.x, -limit, limit);state.z = THREE.MathUtils.clamp(state.z, -limit, limit);\n        state.vx *= -0.35;state.vz *= -0.35;\n        state.speed = isAirborne ? Math.hypot(state.vx, state.vz) : state.speed * -0.35;\n        state.yaw -= wrapAnglePi(state.yaw) * (1.0 - Math.pow(0.10, dt));\n        if (impactV > 10.0)triggerPhysicsCollision(impactV, 'crashReasonThreshold', isAirborne ? 0 : -state.vx * 0.4, 2.0, isAirborne ? 0 : -state.vz * 0.4);\n      }\n    }\n  }\n\n  const wantsHover = driveInput.lift > 0;\n  if(coastGroundAttached&&wantsHover&&state.airRemaining>0&&!state.isFreefalling){coastGroundAttached=false;state.coastSupportId=null;state.coastDetached=true;isAirborne=true;state.wasAirborne=true;}\n  const wantsDescend = driveInput.descend > 0;\n  let isLiftFiring = false;\n  let isDescendFiring = false;\n  let freefallStartVy = null;\n\n  // Coast-only continuous obstacle contact; legacy map1/2 response is unchanged.\n  if (coastMotionStart) {\n    const contact = globalThis.window?.RoadsterCoast?.clipBuildings(coastMotionStart,state);\n    if (contact) { triggerPhysicsCollision(contact.speed,'crashReasonBuilding',0,2,0); if (state.isDestroyed) return; }\n  }\n  // Sea is not a road: no automatic landing save or recharge before real contact.\n  const coastSurface = coastWorld?.support({...state,previousY:coastMotionStart.y,grounded:coastGroundAttached});\n  if(coastGroundAttached){\n    const reachable=coastSurface?.solid&&Number.isFinite(coastSurface.height)&&Math.abs(coastSurface.height-state.y)<.5;\n    if(reachable){\n      coastSupport=coastSurface;state.y=coastSupport.height;\n      state.vy=-(coastSupport.normal.x*state.vx+coastSupport.normal.z*state.vz)/coastSupport.normal.y;\n      state.coastSupportId=coastSupport.id;\n    }else{coastGroundAttached=false;isAirborne=true;state.wasAirborne=true;state.coastSupportId=null;}\n  }\n  if (coastSurface?.water) state.isAutoLandingSave = false;\n  // Recompute surface elevation after horizontal (x, z) movement\n  groundElevation = Number.isFinite(coastSurface?.height) ? coastSurface.height : 0.0;\n  if (currentMap === 'city' || currentMap === 'coast') {\n    const mapBuildings = coastObstacles || cityNearbyBuildings(state);\n    for (let i = 0; i < mapBuildings.length; i++) {\n      const b = mapBuildings[i];\n      if (coastWorld && state.y + 1.25 < (b.minY ?? 0)) continue;\n      if (currentMap === 'city' ? cityTouchesRoof(state,b) : state.x > b.minX - 1.1 && state.x < b.maxX + 1.1 && state.z > b.minZ - 1.8 && state.z < b.maxZ + 1.8) {\n        if (state.y >= b.height - 0.55) {\n          groundElevation = Math.max(groundElevation, b.height);\n        }\n      }\n    }\n  }\n\n  const agl = state.y - groundElevation;\n  if (agl > 5.0) state.hasTriggeredHelipad = false;\n  const downSpeed = Math.max(0.0, -state.vy);\n  const cosTiltNow = Math.cos(state.roll) * Math.cos(state.pitch);\n\n  const SAFE_TOUCHDOWN_V = 4.0;\n  const AUTO_BRAKE_ACCEL = 58.0;\n  const kinematicStopDist = Math.max(0.0, (downSpeed * downSpeed - SAFE_TOUCHDOWN_V * SAFE_TOUCHDOWN_V) / (2.0 * AUTO_BRAKE_ACCEL));\n  const minSafeBrakeAlt = Math.max(1.8, kinematicStopDist + downSpeed * dt + 0.45);\n\n  // Auto-landing save must ONLY engage when vehicle is falling fast towards ground, NEVER when climbing or hovering!\n  const isDescendingTowardsGround = state.vy < -3.5 && !wantsHover && !state.isAltitudeHold && !state.isJumping6m;\n  // Keep the existing braking law, but a rotated coast hull can meet the\n  // selected real floor before its upright root reaches that floor.\n  const landingClearance=coastWorld&&coastSurface?.solid?Math.min(agl,coastBodyGroundClearance(state,coastSurface)):agl;\n  const needsEmergencyLandingSave = (\n    !coastSurface?.water && isDescendingTowardsGround &&\n    landingClearance > 0.02 &&\n    landingClearance <= minSafeBrakeAlt &&\n    (state.airRemaining > 0.01 || state.isAutoLandingSave) &&\n    !state.isFreefalling &&\n    (downSpeed > 5.5 || state.isAutoLandingSave || (landingClearance <= 3.0 && cosTiltNow < 0.55 && downSpeed > 2.5))\n  );\n\n  if (needsEmergencyLandingSave) {\n    if (!state.isAutoLandingSave) {\n      state.isAutoLandingSave = true;\n      state.lastAutoSaveAlt = Math.max(2.2, agl);\n      showBanner('autoland', 2.2);\n      sound.speakAlert('autoland', 'Minimum braking altitude. Auto-landing thrusters engaged.', '已达极限安全高度，防坠毁自动喷气已启动。');\n    }\n    isLiftFiring = consumeAirTank(dt, true);\n    // Smooth upward deceleration towards soft touchdown speed (-1.5 m/s).\n    // An exhausted tank cannot supply a final frame of free braking.\n    if (isLiftFiring) state.vy = Math.min(-1.5, state.vy + AUTO_BRAKE_ACCEL * dt);\n    else state.isAutoLandingSave = false;\n\n    // Emergency braking still protects descent; attitude assist respects manual control and its grace period.\n    if (stabilizerDt > 0) {\n      const levelBlend = 1.0 - Math.exp(-10.0 * stabilizerDt);\n      state.roll -= wrapAnglePi(state.roll) * levelBlend;\n      state.pitch -= wrapAnglePi(state.pitch) * levelBlend;\n      state.vRoll *= Math.pow(0.20, stabilizerDt);\n      state.vPitch *= Math.pow(0.20, stabilizerDt);\n    }\n  } else {\n    state.isAutoLandingSave = false;\n    // Manual Space or Shift cancels automated 6m jump or altitude hold\n    if (wantsHover || wantsDescend) {\n      if (state.isJumping6m && wantsDescend) state.isJumping6m = false;\n      if (state.isAltitudeHold) {\n        state.isAltitudeHold = false;\n        const nBadge = document.getElementById('key-n');\n        if (nBadge) nBadge.classList.remove('active');\n      }\n    }\n\n    if (state.isJumping6m && !state.isFreefalling && state.airRemaining > 0) {\n      // Fix Issue 8: O key jumps to 6.0m at 2.5x Space climb speed and consumes 200% of the air\n      // that normal SPACE climb requires to reach this same height!\n      const jumpClimbVy = currentMaxClimbVy * 2.5;\n      const jumpLiftAccel = currentLiftAccel * 2.5;\n      const totalJumpH = Math.max(1.0, (state.jumpTargetY || 6.0) - (state.jumpStartY ?? 0.0));\n      const dRampNormal = (currentMaxClimbVy * currentMaxClimbVy) / (2.0 * currentLiftAccel);\n      const normalClimbAirSec = (totalJumpH <= dRampNormal)\n        ? Math.sqrt((2.0 * totalJumpH) / currentLiftAccel)\n        : ((currentMaxClimbVy / currentLiftAccel) + (totalJumpH - dRampNormal) / currentMaxClimbVy);\n      const jumpTotalDuration = totalJumpH / jumpClimbVy;\n      // Burn rate per second so the jump consumes 200% (2.0x) of normalClimbAirSec\n      const jumpBurnRatePerSec = (2.0 * normalClimbAirSec) / Math.max(0.05, jumpTotalDuration);\n      const nextVy = Math.min(jumpClimbVy, Math.max(jumpClimbVy * 0.92, state.vy + jumpLiftAccel * dt));\n      const stepDt = (state.y + nextVy * dt >= state.jumpTargetY)\n        ? Math.max(0.0, (state.jumpTargetY - state.y) / Math.max(0.1, nextVy))\n        : dt;\n\n      if (stepDt === 0 || consumeAirTank(jumpBurnRatePerSec * stepDt, true)) {\n        if (state.isAutoDescending8s) {\n          state.isJumping6m = false;\n          isLiftFiring = true;\n          state.vy += (-3.2 - state.vy) * 6.0 * dt;\n        } else {\n          isLiftFiring = true;\n          state.vy = nextVy;\n          if (state.y + state.vy * dt >= state.jumpTargetY) {\n            state.y = state.jumpTargetY;\n            state.vy = 0.0;\n            state.isJumping6m = false;\n          }\n        }\n      } else {\n        state.isJumping6m = false;\n      }\n    } else if (wantsHover && !state.isFreefalling && state.airRemaining > 0) {\n      // Space climb speed & acceleration\n      if (consumeAirTank(dt * driveInput.lift, true)) {\n        if (state.isAutoDescending8s) {\n          isLiftFiring = true;\n          state.vy += (-3.2 - state.vy) * 6.0 * dt;\n        } else {\n          state.isAutoDescending8s = false;\n          isLiftFiring = true;\n          const maxAirVy = currentMaxClimbVy * 1.35;\n          // Full stick matches Space. Partial thrust pays for and supplies only\n          // its share of lift, including the force that counteracts gravity.\n          const liftAccel = (currentLiftAccel + EARTH_GRAVITY_MPS2) * driveInput.lift - EARTH_GRAVITY_MPS2;\n          state.vy = Math.min(maxAirVy, state.vy + liftAccel * dt);\n        }\n      }\n    } else if ((state.isAltitudeHold || (agl > 0.15 && Boolean(keys['KeyN']))) && !state.isFreefalling && state.airRemaining > 0) {\n      // Requirement 5: Mid-air N key holds current altitude with low continuous air consumption (0.22x rate)\n      if (!state.isAltitudeHold) {\n        state.isAltitudeHold = true;\n        state.holdTargetY = state.y;\n      }\n      if (consumeAirTank(0.22 * dt, true)) {\n        if (state.isAutoDescending8s) {\n          isLiftFiring = true;\n          state.vy += (-3.2 - state.vy) * 6.0 * dt;\n        } else {\n          isLiftFiring = true;\n          const altError = state.holdTargetY - state.y;\n          state.vy += (altError * 8.5 - state.vy * 9.5) * dt;\n        }\n      } else {\n        state.isAltitudeHold = false;\n      }\n    }\n\n    if (wantsDescend && agl > 0.02) {\n      if (!state.isFreefalling && state.airRemaining > 0 && consumeAirTank(0.55 * driveInput.descend * dt, true)) {\n        isDescendFiring = true;\n        state.vy -= 18.5 * driveInput.descend * dt;\n      }\n    }\n  }\n\n  // Tank contents and physics mode do not change Earth gravity. This also\n  // runs if a lift/hold/jump/save request depleted its tank in this frame.\n  if (!coastGroundAttached && !isLiftFiring && (agl > 0 || state.vy > 0)) {\n    freefallStartVy = state.vy;\n    state.vy -= EARTH_GRAVITY_MPS2 * dt;\n  }\n\n  const prevY = state.y;\n  if (coastGroundAttached && !isLiftFiring) {\n    state.y = coastSupport.height;\n  } else if (freefallStartVy !== null && !isDescendFiring) {\n    const next = integrateFreefall(state.y, freefallStartVy, dt, coastWorld?-Infinity:groundElevation);\n    state.y = next.y;\n    state.vy = next.vy;\n  } else {\n    state.y += state.vy * dt;\n  }\n  const prevVy = state.vy;\n  if (state.y > MAX_FLIGHT_ALTITUDE) {\n    state.y = MAX_FLIGHT_ALTITUDE;\n    state.vy = Math.min(0, state.vy);\n  }\n\n  // Top, bottom and bounded structural contacts are different events.\n  const coastStructureHit=coastWorld?.network?.sweepStructures(coastMotionStart,state);\n  if(coastStructureHit){\n    const h=coastStructureHit,t=Math.max(0,h.t-1e-5),n=h.normal;\n    const inward=state.vx*n.x+state.vy*n.y+state.vz*n.z,impact=Math.max(0,-inward);\n    state.x=coastMotionStart.x+(state.x-coastMotionStart.x)*t;state.z=coastMotionStart.z+(state.z-coastMotionStart.z)*t;\n    state.y=h.kind==='ceiling'?h.height-.002:coastMotionStart.y+(state.y-coastMotionStart.y)*t;\n    if(inward<0){state.vx-=1.25*inward*n.x;state.vy-=1.25*inward*n.y;state.vz-=1.25*inward*n.z;}\n    if(h.kind==='ceiling'){state.isJumping6m=false;state.isAltitudeHold=false;}\n    state.speed=(state.vx*-Math.sin(state.yaw)+state.vz*-Math.cos(state.yaw)>=0?1:-1)*Math.hypot(state.vx,state.vz);\n    if(coastGroundAttached)state.vy=-(coastSupport.normal.x*state.vx+coastSupport.normal.z*state.vz)/coastSupport.normal.y;\n    triggerPhysicsCollision(impact,'crashReasonBuilding',0,1,0);if(state.isDestroyed)return;\n  }\n  const coastLanding=coastWorld&&!coastGroundAttached?coastWorld.network.sweepLanding(coastMotionStart,state):null;\n  const contactFloorY = coastWorld ? (coastGroundAttached?coastSupport.height:coastLanding?.height??(coastSurface?.water?coastSurface.height:-Infinity)) : 0;\n  if ((coastGroundAttached || coastLanding || state.vy <= 0) && state.y <= contactFloorY+(coastWorld ? .00001 : 0)) {\n    if (coastSurface?.water&&!coastLanding) { resetCar(); return; }\n    state.y = contactFloorY;\n    if(coastLanding){state.x=coastLanding.x;state.z=coastLanding.z;}\n    state.jumpInertiaGraceSeconds = null;\n    const downImpactSpeed = coastWorld\n      ? coastGroundAttached?0:Math.max(0,-(state.vx*(coastLanding?.normal.x||0)+prevVy*(coastLanding?.normal.y||1)+state.vz*(coastLanding?.normal.z||0)))\n      : -prevVy;\n    if (downImpactSpeed > 0.8) {\n      state.suspensionSquash = Math.min(0.048, downImpactSpeed * 0.0035);\n      state.suspensionVelocity = downImpactSpeed * 0.004;\n    }\n    state.vy = 0.0;\n    if(coastWorld){coastSupport=coastLanding||coastSupport;coastGroundAttached=true;state.coastSupportId=coastSupport.id;state.wasAirborne=false;groundElevation=coastSupport.height;state.vy=-(coastSupport.normal.x*state.vx+coastSupport.normal.z*state.vz)/coastSupport.normal.y;}\n    state.isAutoLandingSave = false;\n    state.isJumping6m = false;\n    if (state.isAltitudeHold) {\n      state.isAltitudeHold = false;\n      const nBadge = document.getElementById('key-n');\n      if (nBadge) nBadge.classList.remove('active');\n    }\n    const cosTilt = Math.cos(state.roll) * Math.cos(state.pitch);\n    if (downImpactSpeed > 15.5 || (downImpactSpeed > 7.5 && cosTilt < 0.25)) {\n      const effectiveDv = downImpactSpeed * (cosTilt < 0.25 ? 1.85 : 1.15);\n      if(currentMap==='city')window.RoadsterCityDiagnostics?.contact({kind:'ground',height:0,previousY:prevY,downImpactSpeed,cosTilt});\n      triggerPhysicsCollision(effectiveDv, 'crashReasonGround', 0, 3.0, 0);\n      if (state.isDestroyed) return;\n    }\n\n    // A firing retro jet uses the same tank; never recharge over its burn.\n    if (!(coastWorld&&coastSupport?.id==='roof') && !isRetroBrakeFiring && ((!wantsHover && !isRearThrusterFiring) || state.isFreefalling)) {\n      state.airRemaining = Math.min(MAX_AIR_SECONDS, state.airRemaining + 3.4 * dt);\n      state.airUsedContinuous = MAX_AIR_SECONDS - state.airRemaining;\n      if (state.airRemaining > 2.2) state.isAutoDescending8s = false;\n      if (state.airRemaining >= 2.5 && !wantsHover) {\n        state.isFreefalling = false;\n      } else if (state.airRemaining >= 9.95) {\n        state.isFreefalling = false;\n      }\n    }\n  }\n\n  // Requirement 3: All airborne attitude RCS jets (Roll, Pitch, Yaw) consume COPV air tank!\n  canUseRCS = !state.isFreefalling && state.airRemaining > 0.005;\n  let rollInput = 0;\n  let pitchInput = 0;\n  let yawInput = 0;\n  if (canUseRCS && (rawRollInput !== 0 || rawPitchInput !== 0 || rawYawInput !== 0)) {\n    const rcsBurn = (isAirborne ? 0.38 : 0.22) * Math.max(Math.abs(rawRollInput), Math.abs(rawPitchInput), Math.abs(rawYawInput)) * dt;\n    if (consumeAirTank(rcsBurn, isAirborne)) {\n      rollInput = rawRollInput;\n      pitchInput = rawPitchInput;\n      yawInput = rawYawInput;\n    }\n  }\n  canUseRCS = !state.isFreefalling && state.airRemaining > 0.005;\n\n  const rcsAuthority = isAirborne ? 1.0 : 0.35;\n\n  state.roll = wrapAnglePi(state.roll);\n\n  if (canUseRCS && rollInput !== 0) {\n    state.vRoll += rollInput * 3.6 * rcsAuthority * dt;\n    if (isAirborne) {\n      state.vx -= rollInput * 1.6 * dt;\n    }\n  } else if (!isAirborne) {\n    // Progressive anti-roll bar suspension response to lateral G-forces and steering\n    const latG = state.lateralG || 0.0;\n    const speedLean = THREE.MathUtils.clamp(Math.abs(state.speed) / 22.0, 0.0, 1.0);\n    const targetGroundRoll = (-state.steerInput * 0.048 * speedLean) + (latG * 0.012);\n    state.roll += (targetGroundRoll - state.roll) * 11.0 * dt;\n    state.vRoll = 0.0;\n  } else if (stabilizerDt > 0) {\n    // Shortest-path + angular-momentum-assisted roll self-righting\n    const predictedRoll = wrapAnglePi(state.roll + state.vRoll * 0.28);\n    state.vRoll += (-predictedRoll * 7.8 - state.vRoll * 4.5) * stabilizerDt;\n  }\n\n  if (canUseRCS && pitchInput !== 0) {\n    state.vPitch += pitchInput * 3.2 * rcsAuthority * dt;\n    if (isAirborne) {\n      state.vy += pitchInput * 1.1 * dt;\n    }\n  } else if (stabilizerDt > 0 || !isAirborne) {\n    // Use the nearest equivalent level attitude without unwinding completed flips.\n    const pitchError = wrapAnglePi(state.pitch);\n    state.vPitch += (-pitchError * 6.5 - state.vPitch * 4.2) * (isAirborne ? stabilizerDt : dt);\n  }\n\n  if (isAirborne) {\n    if (canUseRCS && yawInput !== 0) {\n      state.vYaw += yawInput * 2.2 * rcsAuthority * dt;\n    } else {\n      // Smoothly damp yaw rate when A/D is released in mid-air so nose stays where aimed\n      state.vYaw *= Math.pow(0.06, dt);\n    }\n  }\n\n  state.vRoll *= Math.pow(0.20, dt);\n  state.vPitch *= Math.pow(0.20, dt);\n  state.vYaw *= Math.pow(0.25, dt);\n\n  state.roll = wrapAnglePi(state.roll + state.vRoll * dt);\n  // Wing attitude assist follows the same delayed stabilizer as the RCS springs.\n  if (pitchInput === 0 && (stabilizerDt > 0 || !isAirborne) && Math.abs(state.speed) > 28.0) {\n    const aeroPitchStab = Math.min(3.5, Math.pow(Math.abs(state.speed) / 35.0, 2)) * 0.45;\n    state.vPitch += (-wrapAnglePi(state.pitch) * aeroPitchStab) * (isAirborne ? stabilizerDt : dt);\n  }\n  // Keep pitch continuous through +/-180 and complete forward/backward 360-degree loops.\n  // THREE renders the Euler angle directly; no Euler extraction or airborne pitch clamp is needed.\n  state.pitch += state.vPitch * dt;\n  state.yaw += state.vYaw * dt;\n\n  // Complete the coast contact after attitude integration as well: a legal\n  // roll/pitch can touch the ground before the upright root descends to it.\n  const coastHullLanding=coastWorld&&!coastGroundAttached?coastBodyGroundLanding(coastWorld,coastMotionStart,state):null;\n  if(coastHullLanding){\n    const normal=coastHullLanding.normal,downImpactSpeed=Math.max(0,-(state.vx*normal.x+state.vy*normal.y+state.vz*normal.z)),cosTilt=Math.cos(state.roll)*Math.cos(state.pitch);\n    state.x=coastHullLanding.x;state.y=coastHullLanding.height;state.z=coastHullLanding.z;\n    coastSupport=coastHullLanding;coastGroundAttached=true;state.coastSupportId=coastSupport.id;state.wasAirborne=false;groundElevation=coastSupport.height;\n    state.vy=-(normal.x*state.vx+normal.z*state.vz)/normal.y;\n    state.jumpInertiaGraceSeconds=null;state.isAutoLandingSave=false;state.isJumping6m=false;\n    if(state.isAltitudeHold){state.isAltitudeHold=false;const badge=document.getElementById('key-n');if(badge)badge.classList.remove('active');}\n    if(downImpactSpeed>.8){state.suspensionSquash=Math.min(.048,downImpactSpeed*.0035);state.suspensionVelocity=downImpactSpeed*.004;}\n    if(downImpactSpeed>15.5||(downImpactSpeed>7.5&&cosTilt<.25)){triggerPhysicsCollision(downImpactSpeed*(cosTilt<.25?1.85:1.15),'crashReasonGround',0,3,0);if(state.isDestroyed)return;}\n    if(!isRetroBrakeFiring&&((!wantsHover&&!isRearThrusterFiring)||state.isFreefalling)){\n      state.airRemaining=Math.min(MAX_AIR_SECONDS,state.airRemaining+3.4*dt);state.airUsedContinuous=MAX_AIR_SECONDS-state.airRemaining;\n      if(state.airRemaining>2.2)state.isAutoDescending8s=false;if(state.airRemaining>=2.5&&!wantsHover||state.airRemaining>=9.95)state.isFreefalling=false;\n    }\n  }\n  if(coastGroundAttached){\n    const plane=coastWorld.network.groundAttitude(coastSupport.normal,state.yaw);\n    state.pitch=plane.pitch;state.roll=plane.roll;state.vPitch=state.vRoll=0;\n  }\n  const trueGroundAgl = Math.max(0.0, state.y - groundElevation);\n  if (trueGroundAgl < 0.35) {\n    const maxGroundPitch = THREE.MathUtils.lerp(0.14, 1.30, THREE.MathUtils.clamp(trueGroundAgl / 0.35, 0.0, 1.0));\n    const slope=coastGroundAttached?coastWorld.network.groundAttitude(coastSupport.normal,state.yaw):{pitch:0,roll:0};\n    const groundPitch = wrapAnglePi(state.pitch-slope.pitch);\n    state.pitch += THREE.MathUtils.clamp(groundPitch, -maxGroundPitch, maxGroundPitch) - groundPitch;\n    const maxGroundRoll = THREE.MathUtils.lerp(0.18, 3.14, THREE.MathUtils.clamp(trueGroundAgl / 0.35, 0.0, 1.0));\n    state.roll = slope.roll+THREE.MathUtils.clamp(state.roll-slope.roll, -maxGroundRoll, maxGroundRoll);\n    if (currentMap === 'highway' && trueGroundAgl < 0.15) {\n      const groundYaw = wrapAnglePi(state.yaw);\n      state.yaw += THREE.MathUtils.clamp(groundYaw, -0.85, 0.85) - groundYaw;\n    }\n    state.accumulatedRoll = 0;\n  } else {\n    state.accumulatedRoll += Math.abs(state.vRoll * dt);\n    if (state.accumulatedRoll >= Math.PI * 1.85) {\n      state.accumulatedRoll = 0;\n      showBanner('stunt', 2.2);\n      sound.beep(880, 0.18);\n    }\n  }\n\n  if (currentMap === 'city' || currentMap === 'coast') {\n    const mapBuildings = coastObstacles || cityNearbyBuildings(state);\n    for (let i = 0; i < mapBuildings.length; i++) {\n      const b = mapBuildings[i];\n      if (coastWorld && state.y + 1.25 < (b.minY ?? 0)) continue;\n      if (currentMap === 'city' ? cityTouchesBuilding(state,b) : state.x > b.minX - 1.1 && state.x < b.maxX + 1.1 && state.z > b.minZ - 1.8 && state.z < b.maxZ + 1.8) {\n        if (state.y > b.height + 0.08) {\n          // Flying freely in the air above the building roof — do NOT teleport or snap down!\n          continue;\n        } else if (prevY >= b.height - 0.55 && state.y <= b.height && state.vy <= 0 && (currentMap!=='city'||cityCanLandOnRoof(state,b))) {\n          // Actually touching down onto or resting on the building roof\n          const downImpactSpeed = -prevVy;\n          if (downImpactSpeed > 0.8) {\n            state.suspensionSquash = Math.min(0.048, downImpactSpeed * 0.0035);\n            state.suspensionVelocity = downImpactSpeed * 0.004;\n          }\n          const cosTilt = Math.cos(state.roll) * Math.cos(state.pitch);\n          state.y = b.height;\n          state.vy = 0;\n          if(coastWorld){coastSupport={id:'roof',height:b.height,solid:true,water:false,normal:{x:0,y:1,z:0}};coastGroundAttached=true;isAirborne=false;state.wasAirborne=false;state.coastSupportId='roof';}\n          state.isAutoLandingSave = false;\n          state.isJumping6m = false;\n          if (state.isAltitudeHold) {\n            state.isAltitudeHold = false;\n            const nBadge = document.getElementById('key-n');\n            if (nBadge) nBadge.classList.remove('active');\n          }\n\n          if (downImpactSpeed > 15.5 || (downImpactSpeed > 7.5 && cosTilt < 0.25)) {\n            const effectiveDv = downImpactSpeed * (cosTilt < 0.25 ? 1.85 : 1.15);\n            if(currentMap==='city')window.RoadsterCityDiagnostics?.contact({kind:'building-roof',id:b.id,logicalId:b.logicalId,bounds:{minX:b.minX,maxX:b.maxX,minZ:b.minZ,maxZ:b.maxZ,minY:b.minY||0,height:b.height},verifiedSolid:true,downImpactSpeed,cosTilt});\n            triggerPhysicsCollision(effectiveDv, 'crashReasonGround', 0, 3.0, 0);\n            if (state.isDestroyed) return;\n          }\n\n          // Roofs/helipads obey the same no-refill-while-firing rule as roads.\n          if (!isRetroBrakeFiring && !isRearThrusterFiring && !isLiftFiring && !isDescendFiring) {\n            const rechargeRate = b.isHelipad ? 10.0 : 4.0;\n            state.airRemaining = Math.min(MAX_AIR_SECONDS, state.airRemaining + rechargeRate * dt);\n            state.airUsedContinuous = MAX_AIR_SECONDS - state.airRemaining;\n            state.isFreefalling = false;\n            state.isAutoDescending8s = false;\n          }\n          if (b.isHelipad && !state.hasTriggeredHelipad) {\n            state.hasTriggeredHelipad = true;\n            showBanner('helipad', 2.8);\n            sound.speakAlert('helipad', 'Helipad touchdown. Release thrusters to recharge the tank.', '停机坪降落成功，松开喷气后补充高压气瓶。');\n          }\n        } else if (state.y < b.height - 0.55) {\n          if(currentMap==='city'){\n            const contact=cityBuildingContact(state,b);if(!contact)continue;\n            state.x+=contact.x*(contact.depth+.005);state.z+=contact.z*(contact.depth+.005);\n            const normalSpeed=Math.max(0,-state.vx*contact.x-state.vz*contact.z);\n            if(normalSpeed>.1){\n              state.vx+=1.3*normalSpeed*contact.x;state.vz+=1.3*normalSpeed*contact.z;\n              state.speed=isAirborne?Math.hypot(state.vx,state.vz):-state.vx*Math.sin(state.yaw)-state.vz*Math.cos(state.yaw);\n              window.RoadsterCityDiagnostics?.contact({kind:'building-wall',id:b.id,logicalId:b.logicalId,bounds:{minX:b.minX,maxX:b.maxX,minZ:b.minZ,maxZ:b.maxZ,minY:b.minY||0,height:b.height},verifiedSolid:true,normal:contact});\n              triggerPhysicsCollision(Math.max(12,normalSpeed),'crashReasonThreshold',0,2,0);if(state.isDestroyed)return;\n            }\n            continue;\n          }\n          const impactSpeed = Math.hypot(state.vx, state.vz, state.vy * 0.5);\n          const dLeft = Math.abs(state.x - (b.minX - 1.1));\n          const dRight = Math.abs(state.x - (b.maxX + 1.1));\n          const dFront = Math.abs(state.z - (b.minZ - 1.8));\n          const dBack = Math.abs(state.z - (b.maxZ + 1.8));\n          const minD = Math.min(dLeft, dRight, dFront, dBack);\n          if (minD === dLeft) state.x = b.minX - 1.2;\n          else if (minD === dRight) state.x = b.maxX + 1.2;\n          else if (minD === dFront) state.z = b.minZ - 1.9;\n          else state.z = b.maxZ + 1.9;\n\n          if (isAirborne) {\n            state.vx *= -0.3;\n            state.vz *= -0.3;\n            state.speed = Math.hypot(state.vx, state.vz);\n          } else {\n            state.speed *= -0.3;\n          }\n          triggerPhysicsCollision(Math.max(12, impactSpeed), 'crashReasonThreshold', isAirborne ? 0 : -state.vx * 0.5, 2.0, isAirborne ? 0 : -state.vz * 0.5);\n          if (state.isDestroyed) return;\n        }\n      }\n    }\n  }\n\n  const playerWorldZ = currentMap === 'highway' ? 0 : state.z;\n  // 2nd-order critically damped suspension recovery: d^2y/dt^2 = -omega^2*y - 2*zeta*omega*v\n  const omegaN = 18.0;\n  // Asymmetric GT suspension damping: softer bump (0.78) to absorb impacts, stiffer rebound (1.15) to prevent bouncing\n  const zeta = (state.suspensionVelocity > 0 ? 0.78 : 1.15);\n  const suspAcc = -omegaN * omegaN * (state.suspensionSquash || 0) - 2.0 * zeta * omegaN * (state.suspensionVelocity || 0);\n  state.suspensionVelocity = (state.suspensionVelocity || 0) + suspAcc * dt;\n  state.suspensionSquash = Math.max(0.0, (state.suspensionSquash || 0) + state.suspensionVelocity * dt);\n  if (state.suspensionSquash < 0.0005) {\n    state.suspensionSquash = 0.0;\n    state.suspensionVelocity = 0.0;\n  }\n  // High-speed aerodynamic downforce compression: compresses suspension springs when driving at speed\n  const aeroSquashTarget = (!isAirborne && (state.downforceN || 0) > 400)\n    ? Math.min(0.025, ((state.downforceN - 400) / 7500.0) * 0.025)\n    : 0.0;\n  state.aeroSquash = THREE.MathUtils.lerp(state.aeroSquash || 0.0, aeroSquashTarget, 8.0 * dt);\n\n\n  // Dynamic Tire Drift Smoke Puffs & Brake Lockup Smoke\n  if (!isAirborne && !state.isDestroyed && typeof spawnTireSmokePuff === 'function') {\n    const isDriftingNow = state.isDrifting && Math.abs(state.speed) > 3.0;\n    const isHardBrakingLockup = (isFootBraking || isHandbraking) && Math.abs(state.speed) > 14.0;\n    if (isDriftingNow || isHardBrakingLockup) {\n      state.tireSmokeTimer = (state.tireSmokeTimer || 0) + dt;\n      if (state.tireSmokeTimer >= 0.036) {\n        state.tireSmokeTimer = 0.0;\n        const smokeIntensity = isDriftingNow\n          ? Math.min(1.5, Math.abs(state.driftAngle) * 2.2 + 0.6)\n          : (Math.abs(state.speed) / 38.0);\n        if (currentMap === 'highway') {\n          spawnTireSmokePuff(state.x - 0.86, 0.08, 1.38, state.vx, -state.speed * 0.4, smokeIntensity);\n          spawnTireSmokePuff(state.x + 0.86, 0.08, 1.38, state.vx, -state.speed * 0.4, smokeIntensity);\n        } else {\n          const cosY = Math.cos(state.yaw);\n          const sinY = Math.sin(state.yaw);\n          const rz = 1.38;\n          [-0.86, 0.86].forEach((rx) => {\n            const wx = state.x + rx * cosY + rz * sinY;\n            const wz = state.z - rx * sinY + rz * cosY;\n            spawnTireSmokePuff(wx, 0.08, wz, state.vx * 0.4, state.vz * 0.4, smokeIntensity);\n          });\n        }\n      }\n    }\n  }\n\n  // Optimus Active Wing with Extreme Air-Brake Pitch (-0.72 rad / ~42°) on Foot Brake H\n  // isAirBrakingActive already hoisted above\n  const targetWingY = ((currentMap==='coast'?state.y-groundElevation:state.y) > 0.2 || isAccelerating) ? 0.94 : (isAirBrakingActive ? 0.96 : 0.79);\n  const targetWingAngle = isAirBrakingActive ? -0.72 : (((currentMap==='coast'?state.y-groundElevation:state.y) > 0.2) ? -0.28 : -0.05);\n  activeWingGroup.position.y += (targetWingY - activeWingGroup.position.y) * 8 * dt;\n  activeWingGroup.rotation.x += (targetWingAngle - activeWingGroup.rotation.x) * 8 * dt;\n\n  // 4 Rear Nozzles Dynamic Gimbal Thrust-Vectoring (+/- 6° responsive pivot on pitch/yaw input)\n  const targetGimbalPitch = THREE.MathUtils.clamp(-state.vPitch * 0.06 - (pitchInput * 0.10), -0.14, 0.14);\n  const targetGimbalYaw = THREE.MathUtils.clamp(-state.vYaw * 0.05 - (yawInput * 0.10), -0.14, 0.14);\n  rearNozzlesGimbalGroup.rotation.x += (targetGimbalPitch - rearNozzlesGimbalGroup.rotation.x) * 12 * dt;\n  rearNozzlesGimbalGroup.rotation.y += (targetGimbalYaw - rearNozzlesGimbalGroup.rotation.y) * 12 * dt;\n\n  // True kinematic wheel rotation matching calibrated world speed (v / wheelRadius)\n  const wheelSpinSpeed = (state.speed * (currentMap === 'highway' ? WORLD_SPEED_SCALE : CITY_WORLD_SPEED_SCALE)) / 0.335;\n  wheels.forEach(w => { w.rotation.x -= wheelSpinSpeed * dt; });\n\n  const isCockpitFpv = (cameraModeIndex === 3);\n  const rearActive = isRearThrusterFiring || (isRetroBrakeFiring && retroUsesRearNozzles);\n  const rearVisualPower = isRearThrusterFiring ? Math.max(driveInput.boost, isAirborne ? driveInput.throttle : 0) : 0;\n  const liftVisualPower = isLiftFiring\n    ? (state.isAutoLandingSave ? 1 : (state.isAutoDescending8s ? 0.45 : 1) * (wantsHover ? driveInput.lift : state.isAltitudeHold ? 0.22 : 1))\n    : 0;\n\n  // Rendering reads the already-paid brake request. It never consumes fuel.\n  const isFrontRetroFiring = isRetroBrakeFiring && !retroUsesRearNozzles;\n  const retroVisualPower = dt > 0 ? Math.min(1, retroImpulseSeconds / dt) : 0;\n  // Paid attitude and strafe inputs share physical outlets; no inferred idle firing.\n  const strafeVisualPower = airJetLeft || airJetRight ? driveInput.strafe : 0;\n  updateColdGasVisuals(dt, isCockpitFpv, rearVisualPower, retroVisualPower, retroUsesRearNozzles,\n    liftVisualPower, isDescendFiring ? driveInput.descend : 0,\n    rollInput, pitchInput, yawInput, strafeVisualPower, retroVisualVx, retroVisualVy, retroVisualVz);\n\n  const rcsRollPitchActive = canUseRCS && (rollInput !== 0 || pitchInput !== 0);\n  const rcsYawRetroActive = (canUseRCS && (yawInput !== 0 || airJetLeft || airJetRight)) || isDescendFiring || isFrontRetroFiring;\n  if (presentFrame) {\n  let activeCount = 0;\n  for (let i = 1; i <= 4; i++) {\n    const el = document.getElementById(`noz-${i}`);\n    if (el) el.classList.toggle('firing', rearActive);\n    if (rearActive) activeCount++;\n  }\n  for (let i = 5; i <= 8; i++) {\n    const el = document.getElementById(`noz-${i}`);\n    if (el) el.classList.toggle('firing', isLiftFiring);\n    if (isLiftFiring) activeCount++;\n  }\n  const noz9 = document.getElementById('noz-9');\n  const noz10 = document.getElementById('noz-10');\n  if (noz9) noz9.classList.toggle('firing', rcsRollPitchActive);\n  if (noz10) noz10.classList.toggle('firing', rcsYawRetroActive);\n  if (rcsRollPitchActive) activeCount++;\n  if (rcsYawRetroActive) activeCount++;\n  document.getElementById('val-active-nozzles').textContent = `${activeCount}${t.activeSuffix}`;\n  }\n\n  if (currentMap === 'highway') {\n    highwayTraffic.step(trafficCars, { x: state.x, y: state.y, z: 0, vx: state.vx, vz: state.vz }, dt, LANE_CENTERS, WORLD_SPEED_SCALE);\n  }\n\n  // Highway road markings & arches scroll at calibrated world Z velocity (both forward & reverse wrap)\n  if (currentMap === 'highway') {\n    const scrollDz = (-state.vz) * WORLD_SPEED_SCALE * dt;\n    scrollingProps.forEach(prop => {\n      prop.position.z += scrollDz;\n      if (prop.position.z > 420) {\n        prop.position.z -= 840;\n      } else if (prop.position.z < -420) {\n        prop.position.z += 840;\n      }\n    });\n  }\n\n  if (currentMap === 'coast') globalThis.window?.RoadsterCoast?.stepTraffic(trafficCars,state,dt);\n  trafficCars.forEach((car) => {\n    if (car.mode === 'coast' && (car.coastWaiting || car.mesh.visible === false)) return;\n    if(currentMap==='city'&&car.mesh.visible===false)return;\n    if (car.mesh.userData.wheels) {\n      const wRot = (car.speed * (currentMap === 'highway' ? WORLD_SPEED_SCALE : CITY_WORLD_SPEED_SCALE) / 0.33) * dt;\n      car.mesh.userData.wheels.forEach((w) => { w.rotation.x -= wRot; });\n    }\n\n    // Coast traffic owns its path/blast/recovery state, never the city's wrap.\n    if (currentMap === 'coast') {\n      // Already advanced above, including hidden safe respawn after a blast.\n    } else if (car.blastTimer && car.blastTimer > 0) {\n      car.blastTimer = Math.max(0, car.blastTimer - dt);\n      car.mesh.position.x += car.blastVx * dt;\n      car.mesh.position.z += (currentMap === 'highway' ? (-state.vz - car.speed + car.blastVz) : car.blastVz) * dt;\n      car.y = (car.y || 0) + car.blastVy * dt;\n      car.blastVy -= 22.0 * dt;\n      if (car.y <= 0.0) {\n        car.y = 0.0;\n        car.blastVy = -car.blastVy * 0.42;\n        car.blastVx *= Math.pow(0.22, dt);\n        car.blastVz *= Math.pow(0.22, dt);\n        car.blastVRoll *= Math.pow(0.25, dt);\n        car.blastVPitch *= Math.pow(0.25, dt);\n        car.blastVYaw *= Math.pow(0.25, dt);\n      }\n      car.mesh.position.y = car.y;\n      car.mesh.rotation.x += car.blastVPitch * dt;\n      car.mesh.rotation.y += car.blastVYaw * dt;\n      car.mesh.rotation.z += car.blastVRoll * dt;\n      if (currentMap === 'highway' &&\n          (car.blastTimer <= 0.01 || highwayTraffic.isOutOfBounds(car, LANE_CENTERS, { z: 0 }))) {\n        highwayTraffic.respawnBehind(car, trafficCars, LANE_CENTERS,\n          { x: state.x, y: state.y, z: 0, vx: state.vx, vz: state.vz }, WORLD_SPEED_SCALE);\n      } else if (car.blastTimer <= 0.01) {\n        car.y = 0.0;\n        car.mesh.position.y = 0.0;\n        car.mesh.rotation.x = 0.0;\n        car.mesh.rotation.z = 0.0;\n        if (currentMap === 'city' && typeof car.baseRotY === 'number') {\n          car.mesh.rotation.y = car.baseRotY;\n        }\n      }\n    } else if (currentMap === 'highway') {\n      if (car.highwayPassedThisFrame) {\n        if (!state.isDestroyed) {\n          state.carsCleared += 1;\n        }\n      }\n    } else {\n      advanceCityTraffic(car,dt);\n    }\n\n    if (currentMap === 'highway' && car.highwayWaitingToSpawn !== undefined) return;\n    const dx = Math.abs(state.x - car.mesh.position.x);\n    const dz = Math.abs(playerWorldZ - car.mesh.position.z);\n    const npcWorldY=currentMap==='coast'||currentMap==='city'?(car.mesh.position.y||0):0;\n    let clearanceY = state.y - npcWorldY - car.height;\n\n    // The faster demo rack also checks the complete relative movement chord.\n    // A narrow corner contact cannot disappear between frames. Respawn jumps\n    // are excluded; manual collision detection and response stay unchanged.\n    const demoPreviousCar = demoGroundSweep?.cars.get(car);\n    const demoSweptHit = demoPreviousCar && car.mesh.visible!==false && car.highwayWaitingToSpawn===undefined\n      && !car.highwayPassedThisFrame && Math.abs(car.mesh.position.z-demoPreviousCar.z)<2+dt*(Math.abs(state.vz)+Math.abs(car.speed))*WORLD_SPEED_SCALE\n      && demoGroundSweep.y<car.height-0.15 && state.y<car.height-0.15\n      ? RoadsterHighwayDemoPlanner.sweptContact(demoPreviousCar.x-demoGroundSweep.x,demoPreviousCar.z,\n        car.mesh.position.x-state.x,car.mesh.position.z,1.85,car.length/2+2.15)!==null : false;\n    const coastOld = currentMap === 'coast' ? coastTrafficStart?.get(car) : null;\n    const coastVisualEnd=currentMap==='coast'?{...state,y:state.y-(state.suspensionSquash||0)-(state.aeroSquash||0),pitch:state.pitch+(!isAirborne?(typeof isAccelerating!=='undefined'&&isAccelerating?(typeof isRearThrusterFiring!=='undefined'&&isRearThrusterFiring ? .032 : .016):(typeof isFootBraking!=='undefined'&&isFootBraking||typeof isReversing!=='undefined'&&isReversing)?-.026:0):0),roll:state.roll+(!isAirborne?-(state.steerInput||0)*.032:0)}:null;\n    const coastContact=currentMap==='coast'&&coastOld&&coastOld.visible!==false&&car.mode==='coast'&&!car.blastTimer?coastVehicleContact(coastMotionStart.contactPose||coastMotionStart,coastVisualEnd,coastOld,car):null;\n    if(coastContact){\n      const relVx=state.vx-(car.vx||0),relVy=state.vy-(car.vy||0),relVz=state.vz-(car.vz||0),closing=Math.max(0,-relVx*coastContact.x-relVy*coastContact.y-relVz*coastContact.z+coastContact.angularClosingPerFraction/Math.max(dt,1e-6));\n      // Rewind only the player to certified first contact. NPC route distance\n      // remains authoritative; a normal impulse does not reverse tangent speed.\n      const t=Math.max(0,coastContact.t-1e-6);for(const k of['x','y','z'])state[k]=coastMotionStart[k]+(state[k]-coastMotionStart[k])*t;\n      const endContact=coastContactSeparation(cityPlayerBody({...state,y:state.y-(state.suspensionSquash||0)-(state.aeroSquash||0),pitch:coastVisualEnd.pitch,roll:coastVisualEnd.roll}),coastTrafficBody(car,{x:car.mesh.position.x,y:car.mesh.position.y,z:car.mesh.position.z,pitch:car.mesh.rotation.x,yaw:car.mesh.rotation.y,roll:car.mesh.rotation.z}));\n      const push=endContact.gap<0?endContact.depth+.0001:.0001,pushNormal=endContact.gap<0?endContact:coastContact;state.x+=pushNormal.x*push;state.y+=pushNormal.y*push;state.z+=pushNormal.z*push;\n      if(coastContact.y>.65&&state.vy<0&&closing<=18){state.vy=Math.max(5.5,state.vy+closing*coastContact.y);sound.beep(520,.08);}\n      else if(closing>.1){globalThis.window?.RoadsterCoast?.hit(car);state.vx+=1.35*closing*coastContact.x;state.vy+=1.35*closing*coastContact.y;state.vz+=1.35*closing*coastContact.z;triggerPhysicsCollision(closing,'crashReasonThreshold',0,0,0);}\n      state.speed=isAirborne?Math.hypot(state.vx,state.vz):-state.vx*Math.sin(state.yaw)-state.vz*Math.cos(state.yaw);return;\n    }\n    // No other coastal AABB/roof-cushion path may promote a broad-phase gap.\n    if(currentMap==='coast')return;\n    const cityNear=currentMap==='city'&&dx<10&&dz<10&&Math.abs(state.y-npcWorldY)<10;\n    const cityPlayer=cityNear?cityPlayerBody(state):null,cityNpc=cityNear?cityTrafficBody(car):null;\n    // Preserve the existing gentle roof-touch cushion separately from solid-body\n    // contact. It may bounce a descending car, never trigger a side-gap crash.\n    const cityRoofTouch=cityNear&&clearanceY>=-.15&&clearanceY<.15&&state.vy<0&&state.vy>=-18&&cityHorizontalContact(cityPlayer,cityNpc);\n    const citySolidContact=cityNear&&cityContactInterval(cityPlayer,cityNpc)!==null;\n    const cityBodyOverlap=cityNear&&(cityRoofTouch||citySolidContact);\n    const bodyOverlap = currentMap==='city'?cityBodyOverlap:dx < 1.85 && dz < (car.length / 2 + 2.15);\n    if (bodyOverlap || demoSweptHit) {\n      if (clearanceY >= -0.15 && clearanceY < 1.1) {\n        if (state.vy < -18.0 && (currentMap!=='city'||citySolidContact)) {\n          if(currentMap==='city')window.RoadsterCityDiagnostics?.contact({kind:'traffic-roof',variant:car.mesh.userData?.trafficVariant,position:{...car.mesh.position},verifiedSolid:citySolidContact});\n          triggerPhysicsCollision(Math.abs(state.vy), 'crashReasonThreshold', 0, 5.0, 0);\n        } else if (state.vy < 0 && clearanceY < 0.15) {\n          state.y = npcWorldY + car.height + 0.15;\n          state.vy = 5.5;\n          sound.beep(520, 0.08);\n        }\n      } else if (clearanceY < -0.15) {\n        const relVx = state.vx - (car.vx || 0);\n        const relVz = state.vz - (car.vz || 0);\n        if(currentMap==='city'){\n          const contact=cityContactDetails(cityPlayerBody(state),cityTrafficBody(car));if(!contact)return;\n          state.x+=contact.x*(contact.depth+.005);state.y+=contact.y*(contact.depth+.005);state.z+=contact.z*(contact.depth+.005);\n          const npcVy=car.blastTimer?(car.blastVy||0):0,normalSpeed=Math.max(0,-relVx*contact.x-(state.vy-npcVy)*contact.y-relVz*contact.z);\n          if(normalSpeed>.1){window.RoadsterCityDiagnostics?.contact({kind:'traffic-body',variant:car.mesh.userData?.trafficVariant,position:{x:car.mesh.position.x,y:car.mesh.position.y,z:car.mesh.position.z},verifiedSolid:true,normal:contact});state.vx+=1.35*normalSpeed*contact.x;state.vy+=1.35*normalSpeed*contact.y;state.vz+=1.35*normalSpeed*contact.z;state.speed=isAirborne?Math.hypot(state.vx,state.vz):-state.vx*Math.sin(state.yaw)-state.vz*Math.cos(state.yaw);triggerPhysicsCollision(normalSpeed,'crashReasonThreshold',0,0,0);}\n          return;\n        }\n        const deltaV = Math.hypot(relVx, relVz, (state.vy-(currentMap==='coast'?(car.vy||0):0)) * 0.5);\n\n        if (currentMap === 'highway') {\n          car.mesh.position.z -= 8.0;\n          if (isAirborne) {\n            const horizontalSpeed = Math.hypot(state.vx, state.vz);\n            const reducedSpeed = Math.min(horizontalSpeed, Math.max(14.0, horizontalSpeed * 0.58));\n            const collisionScale = horizontalSpeed > 0 ? reducedSpeed / horizontalSpeed : 0;\n            state.vx *= collisionScale;\n            state.vz *= collisionScale;\n            state.speed = Math.hypot(state.vx, state.vz);\n          } else {\n            state.speed = Math.max(14.0, state.speed * 0.58);\n          }\n        } else {\n          car.mesh.position.x += Math.sign(car.mesh.position.x - state.x || 1) * 5.0;\n          car.mesh.position.z += Math.sign(car.mesh.position.z - state.z || 1) * 5.0;\n          if (isAirborne) {\n            state.vx *= -0.35;\n            state.vz *= -0.35;\n            state.speed = Math.hypot(state.vx, state.vz);\n          } else {\n            state.speed *= -0.35;\n          }\n        }\n\n        const pushX = Math.sign(state.x - car.mesh.position.x || 1) * 7.5;\n        triggerPhysicsCollision(deltaV, 'crashReasonThreshold', pushX, 2.2, 0);\n      }\n    }\n  });\n\n  // Render the resolved pose after traffic contact (which can change state.y).\n  const visualY = currentMap==='coast' ? state.y-(state.suspensionSquash||0)-(state.aeroSquash||0) : Math.max(groundElevation, state.y - (state.suspensionSquash || 0) - (state.aeroSquash || 0));\n  playerWrapper.position.set(state.x, visualY, playerWorldZ);\n\n  // Dynamic chassis weight transfer (Pitch Squat under acceleration & Dive under braking, plus roll under steering)\n  let pitchSquat = 0.0;\n  if (!isAirborne) {\n    if (isAccelerating) {\n      pitchSquat = isRearThrusterFiring ? 0.032 : 0.016;\n    } else if (isFootBraking || isReversing) {\n      pitchSquat = -0.026;\n    }\n  }\n  const bodyRollTilt = !isAirborne ? (-state.steerInput * 0.032) : 0.0;\n  roadsterAttitudeGroup.rotation.set(state.pitch + pitchSquat, state.yaw, state.roll + bodyRollTilt);\n\n  RoadsterDrivingScore.segment(state, dt, scoreMotionStart, RoadsterDrivingScore.motion(state, currentMap, isAirborne));\n\n  // Calculate Real-Time G-Forces, Tire Screech, Sonic Boom & Yoke Rotation\n  const accelMs2 = (state.speed - (state.prevSpeed || state.speed)) / Math.max(0.001, dt);\n  state.prevSpeed = state.speed;\n  state.longitudinalG = THREE.MathUtils.lerp(state.longitudinalG || 0, -accelMs2 / 9.81, 10 * dt);\n  const latAccel = isAirborne ? (Math.sin(state.roll) * 18.0 + state.vYaw * 12.0) : (-state.steerAngle * Math.abs(state.speed) * 0.85);\n  state.lateralG = THREE.MathUtils.lerp(state.lateralG || 0, latAccel / 9.81, 10 * dt);\n\n  // Rotate 3D Tesla Yoke Steering Wheel in real time with steering & aerial roll\n  if (typeof yokeWheelGroup !== 'undefined') {\n    const targetYokeRot = state.steerAngle * 1.55 - (isAirborne ? rollInput * 0.42 : 0);\n    yokeWheelGroup.rotation.z += (targetYokeRot - yokeWheelGroup.rotation.z) * 14 * dt;\n  }\n\n  const totalAirSpeedMs = RoadsterDrivingScore.displayedSpeed(state, isAirborne);\n  const mph = Math.round(totalAirSpeedMs * 2.23694);\n  const kmh = Math.round(totalAirSpeedMs * 3.6);\n  const isSupersonic = mph >= 230;\n\n  // Update Yoke Shift LEDs\n  if (typeof yokeShiftLeds !== 'undefined' && yokeShiftLeds.length > 0) {\n    const speedRatio = Math.abs(state.speed) / Math.max(1, state.maxSpeed);\n    yokeShiftLeds.forEach((led, idx) => {\n      const threshold = (idx + 1) / 7.5;\n      if (speedRatio >= threshold) {\n        led.material.color.setHex(led.userData.activeColor);\n      } else {\n        led.material.color.setHex(0x1e293b);\n      }\n    });\n  }\n\n  // Speed Milestone Tracking & Telemetry Audio Chimes\n  const currentSpeedKmh = kmh;\n  if (currentSpeedKmh >= 370 && (state.speedMilestone || 0) < 370) {\n    state.speedMilestone = 370;\n    sound.playMilestoneChime();\n    showBanner('milestone370', 2.8);\n  } else if (currentSpeedKmh >= 300 && (state.speedMilestone || 0) < 300) {\n    state.speedMilestone = 300;\n    sound.playMilestoneChime();\n    showBanner('milestone300', 2.5);\n  } else if (currentSpeedKmh >= 200 && (state.speedMilestone || 0) < 200) {\n    state.speedMilestone = 200;\n    sound.playMilestoneChime();\n    showBanner('milestone200', 2.5);\n  } else if (currentSpeedKmh >= 100 && (state.speedMilestone || 0) < 100) {\n    state.speedMilestone = 100;\n    sound.playMilestoneChime();\n    showBanner('milestone100', 2.5);\n  } else if (currentSpeedKmh < 40 && (state.speedMilestone || 0) > 0) {\n    state.speedMilestone = 0;\n  }\n\n\n  // Dynamic Carbon-Ceramic Brake Rotor Thermal Heat & Optical Red Glow\n  const isHeavyBraking = (isFootBraking || isHandbraking) && Math.abs(state.speed) > 4.0;\n  const targetBrakeHeat = isHeavyBraking ? Math.min(1.0, (Math.abs(state.speed) / 45.0) * (isFootBraking ? 1.0 : 0.65)) : 0.0;\n  const heatRiseRate = isHeavyBraking ? 4.8 : 0.38;\n  state.brakeHeat = THREE.MathUtils.lerp(state.brakeHeat || 0, targetBrakeHeat, heatRiseRate * dt);\n\n  if (typeof rotorMat !== 'undefined') {\n    if (state.brakeHeat > 0.03) {\n      const glowR = THREE.MathUtils.clamp(state.brakeHeat * 1.5, 0.0, 1.0);\n      const glowG = THREE.MathUtils.clamp(state.brakeHeat * 0.38, 0.0, 1.0);\n      rotorMat.emissive.setRGB(glowR, glowG * 0.32, 0.0);\n      rotorMat.emissiveIntensity = state.brakeHeat * 2.0;\n    } else {\n      rotorMat.emissive.setRGB(0, 0, 0);\n      rotorMat.emissiveIntensity = 0.0;\n    }\n  }\n\n  // Active Hydraulic Rear Wing Air-Brake Actuator Audio Servo\n  if (isAirBrakingActive && Math.abs(state.speed) > 22.0 && !state.wasAirBraking) {\n    state.wasAirBraking = true;\n    sound.playAirBrakeServo();\n  } else if (!isAirBrakingActive) {\n    state.wasAirBraking = false;\n  }\n\n  // Dynamic Tire Thermal Modeling & Temperature Evolution\n  const isDriftFriction = state.isDrifting || isHandbraking;\n  const isHardBraking = isFootBraking && state.speed > 5.0;\n  const targetTireTemp = isDriftFriction ? 92.0 : (isHardBraking ? 82.0 : (Math.abs(state.speed) > 40.0 ? 68.0 : 38.0));\n  const heatRate = (isDriftFriction || isHardBraking) ? 14.0 : 3.5;\n  const coolRate = (weatherIndex === 1 ? 5.5 : 2.5);\n  if (state.tireTemp < targetTireTemp) {\n    state.tireTemp = THREE.MathUtils.lerp(state.tireTemp || 35.0, targetTireTemp, heatRate * dt * 0.1);\n  } else {\n    state.tireTemp = THREE.MathUtils.lerp(state.tireTemp || 35.0, targetTireTemp, coolRate * dt * 0.1);\n  }\n\n  // Pacejka formulation for thermal friction coefficient with downforce adhesion bonus:\n  const curTireTemp = state.tireTemp || 35.0;\n  const thermalMu = 0.92 + 0.23 * Math.exp(-Math.pow((curTireTemp - 82.0) / 28.0, 2));\n  const downforceBonus = Math.min(0.24, ((state.downforceN || 0) / 5500.0) * 0.24);\n  state.tireGripMu = Number((thermalMu + downforceBonus).toFixed(2));\n\n  // Dynamic Aerodynamic Downforce (Active Rear Wing + Venturi Ground-Effect Suction Fans)\n  const wingCl = isAirBrakingActive ? 0.72 : (((currentMap==='coast'?state.y-groundElevation:state.y) > 0.2) ? 0.48 : 0.24);\n  const wingDownforce = 0.5 * 1.225 * wingCl * 1.64 * (state.speed * state.speed);\n  const trueRideHeight = Math.max(0.0, state.y - groundElevation);\n  // Ground effect suction decays inversely with ride height squared\n  const groundProximity = 1.0 / (1.0 + 9.0 * trueRideHeight * trueRideHeight);\n  const groundEffectN = (Math.abs(state.speed) > 4.0) ? (4200.0 * groundProximity) : 0.0;\n  state.downforceN = Math.round(wingDownforce + groundEffectN);\n\n  // Existing gameplay threshold and sound stay intact. The visual is a brief,\n  // stylized condensation pulse; 230 mph does not represent real Mach 1.\n  const crossedSonicThreshold = isSupersonic && !state.wasSupersonic;\n  if (crossedSonicThreshold) {\n    state.wasSupersonic = true;\n    state.cameraShake = Math.max(state.cameraShake, 0.38);\n    sound.playSonicBoom();\n    sound.speakAlert('sonicboom', 'High-speed threshold reached. Condensation pulse.', '已达到高速阈值，凝结气流脉冲。');\n    showBanner('sonic', 2.8);\n  } else if (mph < 215) {\n    state.wasSupersonic = false;\n  }\n  updateSonicCondensation(dt, crossedSonicThreshold, isCockpitFpv, isSupersonic);\n\n  // Requirement 5: Left/right ground steering sound removed completely\n  tireScreechIntensity = 0.0;\n\n  updateWindshieldRain(dt);\n\n  // Update 3D Rain Particles & Lightning Thunder in Cyber Neon Rain (weatherIndex === 1)\n  if (weatherIndex === 1 && rainLinesMesh.visible) {\n    updateExteriorRain(dt);\n\n    state.lightningTimer -= dt;\n    if (state.lightningTimer <= 0) {\n      state.lightningTimer = 7.0 + Math.random() * 9.0;\n      state.lightningFlash = 1.0;\n      sound.playThunder();\n    }\n  }\n  if (state.lightningFlash > 0) {\n    state.lightningFlash = Math.max(0, state.lightningFlash - dt * 3.2);\n  }\n\n  // Capture resolved thrust, not Web Audio automation, on each city physics tick.\n  // The render owner below samples fresh speed/input even on a zero-tick frame.\n  if (cityOwnsDrivingSound()) {\n    citySoundFrame = {\n      thrust: isLiftFiring || isRearThrusterFiring || (isRetroBrakeFiring && driveInput.reverse > 0),\n      attitude: ((rollInput !== 0 || pitchInput !== 0 || yawInput !== 0 || airJetLeft || airJetRight) && canUseRCS) || (isFrontRetroFiring && driveInput.reverse > 0),\n      tires: tireScreechIntensity\n    };\n  }\n  if (coastOwnsDrivingSound()) {\n    coastSoundFrame = {\n      thrust: isLiftFiring || isRearThrusterFiring || (isRetroBrakeFiring && driveInput.reverse > 0),\n      attitude: ((rollInput !== 0 || pitchInput !== 0 || yawInput !== 0 || airJetLeft || airJetRight) && canUseRCS) || (isFrontRetroFiring && driveInput.reverse > 0),\n      tires: tireScreechIntensity\n    };\n  }\n\n  // The physics, contact, scoring, G/thermal/downforce feedback above still run\n  // every city tick. Expensive canvas/DOM/camera presentation runs once per\n  // rendered frame, not six times on a 10 fps phone.\n  if (!presentFrame) {\n    if (state.bannerTimer > 0) {\n      state.bannerTimer = Math.max(0, state.bannerTimer - dt);\n      if (state.bannerTimer === 0) renderBannerText();\n    }\n    return;\n  }\n\n  // Requirement 7: Constant 60° FOV and zero camera zoom/flicker in Cockpit FPV\n  const cameraDt = typeof presentationDt === 'number' ? presentationDt : dt;\n  const isAnyThrust = isLiftFiring || rearActive || isFrontRetroFiring;\n  if (camera.fov !== 60) {\n    camera.fov = 60;\n    camera.updateProjectionMatrix();\n  }\n\n  const targetShake = isCockpitFpv\n    ? 0.0\n    : ((isAnyThrust ? 0.025 : 0.0) + (isSupersonic ? 0.032 : 0.0) + (state.impactCooldown > 0 ? 0.14 : 0.0));\n  state.cameraShake = isCockpitFpv ? 0.0 : THREE.MathUtils.lerp(state.cameraShake || 0, targetShake, 1.0 - Math.exp(-12.0 * cameraDt));\n  const shakeX = (Math.random() - 0.5) * state.cameraShake;\n  const shakeY = (Math.random() - 0.5) * state.cameraShake;\n  const shakeZ = (Math.random() - 0.5) * state.cameraShake;\n\n  // Reset camera.up unless in 6-DOF Cockpit FPV\n  camera.up.set(0, 1, 0);\n  // Fix Issue 5: Dynamically scale camera.near with altitude in 3rd-person views so depth buffer\n  // precision remains ultra-crisp at 30m–380m altitude and completely prevents ground Z-fighting!\n  const desiredNear = isCockpitFpv\n    ? 0.08\n    : THREE.MathUtils.clamp(0.38 + Math.max(0.0,currentMap==='coast'?state.y-groundElevation:state.y) * 0.045, 0.38, 3.2);\n  roadsterCanopyMesh.visible = !isCockpitFpv;\n  setCockpitPerspective(isCockpitFpv);\n  setCockpitExteriorDetailsVisible(!isCockpitFpv);\n  if (typeof hudCombinerMesh !== \"undefined\") hudCombinerMesh.visible = false;\n\n  if (cameraModeIndex !== 0) resetChaseCamera();\n\n  if (cameraModeIndex === 1) {\n    // 3D Showroom Turntable Close-Up Inspection Orbit (Press V or Cam button)\n    const orbitAngle = performance.now() * 0.00055;\n    const zoom = (state.camZoom || 0.75);\n    const radius = 3.65 * zoom;\n    camera.position.set(\n      state.x + Math.cos(orbitAngle) * radius,\n      state.y + 0.85 + 0.95 * zoom,\n      playerWorldZ + Math.sin(orbitAngle) * radius\n    );\n    camera.lookAt(state.x, state.y + 0.56, playerWorldZ);\n  } else if (cameraModeIndex === 3) {\n    // Requirement 7: Rock-solid Cockpit FPV Camera\n    playerWrapper.updateMatrixWorld(true);\n    roadsterAttitudeGroup.updateMatrixWorld(true);\n    const eyeLocal = new THREE.Vector3(0.0, COCKPIT_VIEW.eyeHeight, COCKPIT_VIEW.eyeZ);\n    const forwardLocal = new THREE.Vector3(0.0, -COCKPIT_VIEW.downwardSlope, -1.0).normalize();\n    const upLocal = new THREE.Vector3(0.0, 1.0, 0.0);\n\n    const eyeWorld = eyeLocal.applyMatrix4(roadsterAttitudeGroup.matrixWorld);\n    const forwardWorld = forwardLocal.transformDirection(roadsterAttitudeGroup.matrixWorld);\n    const upWorld = upLocal.transformDirection(roadsterAttitudeGroup.matrixWorld);\n\n    camera.position.copy(eyeWorld);\n    camera.up.copy(upWorld);\n    camera.lookAt(\n      eyeWorld.x + forwardWorld.x * 50.0,\n      eyeWorld.y + forwardWorld.y * 50.0,\n      eyeWorld.z + forwardWorld.z * 50.0\n    );\n  } else if (currentMap === 'highway') {\n    const zoom = (state.camZoom || 0.75);\n    if (cameraModeIndex === 0) {\n      const airOffset = Math.max(0.0, state.y);\n      updateChaseCamera(\n        { x: state.x, y: visualY, z: playerWorldZ },\n        { x: -state.x * 0.18, y: 1.48 + 1.05 * zoom + Math.min(1.8, airOffset * 0.12) + Math.sin(state.pitch) * 0.85, z: Math.max(3.6, 5.2 * zoom) },\n        { x: 0, y: 0.65 + Math.sin(state.pitch) * 2.2, z: -9 },\n        cameraDt, { x: shakeX, y: shakeY, z: shakeZ }\n      );\n    } else {\n      camera.position.set(state.x * 0.5 + shakeX, state.y + 8.5 * zoom + shakeY, 11.5 * zoom + shakeZ);\n      camera.lookAt(state.x, state.y, -12);\n    }\n  } else {\n    const sinY = Math.sin(state.yaw);\n    const cosY = Math.cos(state.yaw);\n    const zoom = (state.camZoom || 0.75);\n    if (cameraModeIndex === 0) {\n      const airOffset = Math.max(0.0, state.y - groundElevation);\n      const distBack = 5.4 * zoom;\n      updateChaseCamera(\n        { x: state.x, y: visualY, z: playerWorldZ },\n        { x: sinY * distBack, y: 1.54 + 1.05 * zoom + Math.min(1.8, airOffset * 0.12) + Math.sin(state.pitch) * 0.85, z: cosY * distBack },\n        { x: -sinY * 10, y: 0.65 + Math.sin(state.pitch) * 2.2, z: -cosY * 10 },\n        cameraDt, { x: shakeX, y: shakeY, z: shakeZ }\n      );\n    } else {\n      camera.position.set(state.x + sinY * 11.5 * zoom + shakeX, state.y + 10.5 * zoom + shakeY, state.z + cosY * 11.5 * zoom + shakeZ);\n      camera.lookAt(state.x, state.y, state.z);\n    }\n  }\n\n  const resolvedNear=isCockpitFpv?desiredNear:vehicleSafeCameraNear(desiredNear,camera,{x:state.x,y:visualY,z:playerWorldZ,pitch:roadsterAttitudeGroup.rotation.x,yaw:roadsterAttitudeGroup.rotation.y,roll:roadsterAttitudeGroup.rotation.z});\n  // Apply once after the final camera transform; avoid two projection updates\n  // per frame when altitude precision and close-up visibility disagree.\n  if(Math.abs(camera.near-resolvedNear)>1e-5){camera.near=resolvedNear;camera.updateProjectionMatrix();}\n\n  if (state.bannerTimer > 0) {\n    state.bannerTimer -= dt;\n    if (state.bannerTimer <= 0) renderBannerText();\n  }\n\n  const anyAttitude = (rollInput !== 0 || pitchInput !== 0 || yawInput !== 0 || airJetLeft || airJetRight) && canUseRCS;\n  if (!cityOwnsDrivingSound() && !coastOwnsDrivingSound()) sound.update(\n    // Stable 200 km/h audio reference: boost changes performance, not rev ratio.\n    Math.abs(state.speed) / (200.0 / 3.6),\n    isLiftFiring || isRearThrusterFiring || (isRetroBrakeFiring && driveInput.reverse > 0),\n    anyAttitude || (isFrontRetroFiring && driveInput.reverse > 0),\n    false,\n    tireScreechIntensity,\n    Math.max(driveInput.throttle, driveInput.boost, driveInput.reverse)\n  );\n\n  // Update Live Cockpit Center Touchscreen & Speed/Rain Overlay Canvas\n  updateCockpitHudScreen(mph, kmh, rearActive, isLiftFiring, isFrontRetroFiring, rcsRollPitchActive, rcsYawRetroActive);\n  updateSpeedAndWeatherOverlay(cameraDt, mph, isAnyThrust, isSupersonic);\n\n  const speedEl = document.getElementById('val-speed');\n  const unitEl = document.getElementById('val-speed-unit');\n  const subSpeedEl = document.getElementById('val-kmh');\n\n  let modeTag = '';\n  if (isRealMode) {\n    modeTag = state.insaneMode\n      ? (currentLang === 'zh' ? '🔥 狂暴模式 (370 km/h)' : '🔥 Plaid Mode (370 km/h)')\n      : (currentLang === 'zh' ? '⚡ 纯电常规 (限速 200)' : '⚡ Standard EV (200 limit)');\n  } else {\n    modeTag = currentLang === 'zh' ? '✨ 幻想模式 (792 km/h)' : '✨ Fantasy Rocket (492 MPH)';\n  }\n\n  if (state.speedUnit === 'kmh') {\n    speedEl.textContent = kmh;\n    if (unitEl) unitEl.textContent = 'KM/H';\n    if (subSpeedEl) subSpeedEl.textContent = `${mph} MPH • ${modeTag}`;\n  } else {\n    speedEl.textContent = mph;\n    if (unitEl) unitEl.textContent = 'MPH';\n    if (subSpeedEl) subSpeedEl.textContent = `${kmh} km/h • ${modeTag}`;\n  }\n\n  const gForceEl = document.getElementById('val-g-force');\n  if (gForceEl) {\n    const curG = Math.hypot(state.longitudinalG || 0, state.lateralG || 0);\n    gForceEl.textContent = `${curG.toFixed(1)} G`;\n    if (curG > 1.5) {\n      gForceEl.className = 'text-[11px] mono font-bold px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/50 ml-1 warning-pulse';\n    } else if (curG > 0.8) {\n      gForceEl.className = 'text-[11px] mono font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40 ml-1';\n    } else {\n      gForceEl.className = 'text-[11px] mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 ml-1';\n    }\n  }\n\n  // Dynamic Turn Signals Strobe & Instrument Cluster Indicator\n  const isTurningLeft = (state.steerInput > 0.12) || Boolean(keys['KeyA']);\n  const isTurningRight = (state.steerInput < -0.12) || Boolean(keys['KeyD']);\n  const isStrobeOn = (Math.sin(performance.now() * 0.013) > 0);\n  if (typeof turnSignalMatL !== 'undefined') {\n    turnSignalMatL.opacity = (isTurningLeft && isStrobeOn) ? 0.95 : 0.0;\n  }\n  if (typeof turnSignalMatR !== 'undefined') {\n    turnSignalMatR.opacity = (isTurningRight && isStrobeOn) ? 0.95 : 0.0;\n  }\n\n  // Dynamic Stop & Reverse Lamps\n  const isBrakeActive = (isFootBraking || isHandbraking) || (isAirborne && isReversing);\n  if (typeof tailLightMat !== 'undefined') {\n    tailLightMat.color.setHex(isBrakeActive ? 0xff002b : 0xcc1436);\n  }\n  if (typeof chmslMat !== 'undefined') {\n    chmslMat.color.setHex(isBrakeActive ? 0xff002b : 0x3b050d);\n  }\n  const isCarReversing = isReversing || (state.speed < -0.2);\n  if (typeof reverseLightMat !== 'undefined') {\n    reverseLightMat.opacity = isCarReversing ? 0.95 : 0.0;\n  }\n  const turnIndL = document.getElementById('indicator-turn-l');\n  const turnIndR = document.getElementById('indicator-turn-r');\n  if (turnIndL) {\n    turnIndL.className = (isTurningLeft && isStrobeOn)\n      ? 'text-sm font-bold text-emerald-400 drop-shadow-[0_0_8px_#34d399] transition-colors mr-0.5 select-none'\n      : 'text-sm font-bold text-slate-600 transition-colors mr-0.5 select-none';\n  }\n  if (turnIndR) {\n    turnIndR.className = (isTurningRight && isStrobeOn)\n      ? 'text-sm font-bold text-emerald-400 drop-shadow-[0_0_8px_#34d399] transition-colors ml-0.5 mr-1 select-none'\n      : 'text-sm font-bold text-slate-600 transition-colors ml-0.5 mr-1 select-none';\n  }\n\n  const gearEl = document.getElementById('val-drive-gear');\n  if (gearEl) {\n    if (isAirborne) {\n      gearEl.textContent = 'AIR';\n      gearEl.className = 'text-[11px] mono font-bold px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-400/60 ml-1 shadow-[0_0_8px_rgba(56,189,248,0.5)]';\n    } else if (state.isDrifting) {\n      gearEl.textContent = 'DRIFT';\n      gearEl.className = 'text-[11px] mono font-bold px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-400/60 ml-1 warning-pulse';\n    } else if (state.speed < -0.2 || isReversing) {\n      gearEl.textContent = 'R';\n      gearEl.className = 'text-[11px] mono font-bold px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-400/60 ml-1';\n    } else if (Math.abs(state.speed) <= 0.2 && !isAccelerating) {\n      gearEl.textContent = 'P';\n      gearEl.className = 'text-[11px] mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-600 ml-1';\n    } else {\n      gearEl.textContent = 'D';\n      gearEl.className = 'text-[11px] mono font-bold px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-400/60 ml-1';\n    }\n  }\n\n  const flowEl = document.getElementById('val-air-flow');\n  if (flowEl) {\n    // 600 L / 10 tank-seconds. Measure the actual shared ledger, including\n    // feathered/partial retro burns, without counting the same nozzle twice.\n    const flowLps = dt > 0 ? Math.round(airConsumedThisFrame * 60 / dt) : 0;\n    flowEl.textContent = flowLps > 0 ? `FLOW: ${flowLps} L/s` : 'FLOW: 0 L/s';\n    flowEl.className = flowLps > 0 \n      ? 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/25 text-cyan-300 border border-cyan-400/50 warning-pulse'\n      : 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30';\n  }\n\n  if (mph > 225) {\n    speedEl.className = 'mono text-3xl md:text-4xl font-extrabold text-cyan-300 tracking-tight drop-shadow-[0_0_12px_rgba(56,189,248,0.85)]';\n  } else {\n    speedEl.className = 'mono text-3xl md:text-4xl font-extrabold text-white tracking-tight';\n  }\n\n  const tank = getAirTankReadout(state.airRemaining);\n  const pct = tank.fraction * 100;\n  const gasMassEl = document.getElementById('val-gas-mass');\n  if (gasMassEl) gasMassEl.textContent = `${tank.massKg.toFixed(1)} kg`;\n  document.getElementById('val-air-sec').textContent = `${tank.seconds.toFixed(1)}s`;\n\n  const barFill = document.getElementById('air-bar-fill');\n  barFill.style.width = `${pct}%`;\n\n  const tankBadge = document.getElementById('ui-tank-state-badge');\n  const modeBadge = document.getElementById('ui-flight-mode');\n\n  if (state.isFreefalling) {\n    barFill.className = 'h-full rounded-md bg-rose-600 transition-all duration-75';\n    tankBadge.textContent = t.badgeDepleted;\n    tankBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-300 border border-rose-400';\n    modeBadge.textContent = isAirborne && !state.groundHopActive ? t.modeFreefall : isAirborne ? t.modeHover : t.modeGround;\n    modeBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-300';\n  } else if (state.isAutoDescending8s) {\n    barFill.className = 'h-full rounded-md bg-amber-400 transition-all duration-75';\n    tankBadge.textContent = t.badge8sWarn;\n    tankBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300 border border-amber-400';\n    modeBadge.textContent = t.modeAutoDescend;\n    modeBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300';\n  } else if (isRetroBrakeFiring) {\n    barFill.className = 'h-full rounded-md bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-75';\n    tankBadge.textContent = t.badgeRetroBrake;\n    tankBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/30 text-cyan-200 border border-cyan-400';\n    modeBadge.textContent = t.badgeRetroBrake;\n    modeBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/30 text-cyan-300';\n  } else if (isLiftFiring) {\n    barFill.className = 'h-full rounded-md bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-75';\n    tankBadge.textContent = t.badgeThrust;\n    tankBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/30 text-cyan-200 border border-cyan-400';\n    modeBadge.textContent = t.modeHover;\n    modeBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/30 text-cyan-300';\n  } else {\n    barFill.className = 'h-full rounded-md bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-75';\n    tankBadge.textContent = state.airRemaining < 9.95 ? t.badgeRecharging : t.badgeReady;\n    tankBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/30';\n    modeBadge.textContent = (currentMap==='coast'?state.y-groundElevation:state.y) > 0.15 ? t.modeHover : t.modeGround;\n    modeBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300';\n  }\n\n  const hullInt = Math.round(state.hullIntegrity);\n  document.getElementById('val-hull-pct').textContent = `${hullInt}%`;\n  const hullBar = document.getElementById('hull-bar-fill');\n  hullBar.style.width = `${hullInt}%`;\n  hullBar.className = hullInt > 50\n    ? 'h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-100'\n    : hullInt > 25\n      ? 'h-full bg-amber-400 transition-all duration-100'\n      : 'h-full bg-rose-500 transition-all duration-100';\n  document.getElementById('val-impact-g').textContent = `${state.lastImpactG.toFixed(1)}G / 18.0G`;\n\n  const rollDeg = Math.round(THREE.MathUtils.radToDeg(state.roll));\n  const pitchDeg = Math.round(THREE.MathUtils.radToDeg(state.pitch));\n  const yawDeg = Math.round(THREE.MathUtils.radToDeg(state.yaw)) % 360;\n  document.getElementById('val-roll').textContent = `${rollDeg}°`;\n  document.getElementById('val-pitch').textContent = `${pitchDeg}°`;\n  document.getElementById('val-yaw').textContent = `${yawDeg}°`;\n  const trueAgl = Math.max(0.0, state.y - groundElevation);\n  document.getElementById('val-altitude').textContent = (groundElevation > 0.5)\n    ? `${trueAgl.toFixed(1)} m (ASL ${state.y.toFixed(0)}m)`\n    : `${trueAgl.toFixed(1)} m`;\n  document.getElementById('val-vspeed').textContent = `${state.vy >= 0 ? '+' : ''}${state.vy.toFixed(1)} m/s`;\n  document.getElementById('val-coords').textContent = `${Math.round(state.x)}, ${Math.round(state.z)}`;\n  document.getElementById('val-passed').textContent = state.carsCleared;\n  document.getElementById('val-score').textContent = state.score;\n  const downforceEl = document.getElementById('val-downforce');\n  if (downforceEl) downforceEl.textContent = `${state.downforceN || 0} N`;\n  const tireTempEl = document.getElementById('val-tire-temp');\n  if (tireTempEl) tireTempEl.textContent = `${Math.round(state.tireTemp || 35)}°C (μ ${(state.tireGripMu || 1.0).toFixed(2)})`;\n}","wrapAnglePi":"function wrapAnglePi(rad) {\n  return ((rad + Math.PI) % (Math.PI * 2) + (Math.PI * 2)) % (Math.PI * 2) - Math.PI;\n}","getAirCoastSpeed":"function getAirCoastSpeed(speedMps, dt) {\n  // Keep the existing ground aerodynamic curve, without tire rolling drag.\n  // Exact solution of dv/dt = -k*v²: no stall brake and no render-FPS bias.\n  return speedMps / (1 + PASSIVE_AERO_DRAG_PER_METER * speedMps * dt);\n}","advanceAirHandling":"function advanceAirHandling(dt, isAirborne) {\n  if (!isAirborne) {\n    state.jumpInertiaSeconds = null;\n    state.jumpInertiaGraceSeconds = null;\n    return 0;\n  }\n  if (!Number.isFinite(state.jumpInertiaSeconds)) return dt;\n  // A finite demo hop may retain its paid launch vector through its planned arc.\n  // Manual O and ordinary flight keep their existing quarter-second grace.\n  const grace = Number.isFinite(state.jumpInertiaGraceSeconds)\n    ? Math.max(JUMP_INERTIA_GRACE_SECONDS, Math.min(2.4, state.jumpInertiaGraceSeconds)) : JUMP_INERTIA_GRACE_SECONDS;\n  const before = state.jumpInertiaSeconds;\n  const after = before + dt;\n  const integratedBlend = seconds => {\n    const u = (seconds - grace) / JUMP_INERTIA_BLEND_SECONDS;\n    if (u <= 0) return 0;\n    if (u >= 1) return seconds - grace - JUMP_INERTIA_BLEND_SECONDS / 2;\n    return JUMP_INERTIA_BLEND_SECONDS * (u ** 3 - 0.5 * u ** 4);\n  };\n  state.jumpInertiaSeconds = after >= grace + JUMP_INERTIA_BLEND_SECONDS ? null : after;\n  return Math.max(0, Math.min(dt, integratedBlend(after) - integratedBlend(before)));\n}","getResponsiveAirCoastSpeed":"function getResponsiveAirCoastSpeed(speedMps, dt) {\n  // Restore the former flight release curve (55%/s damping plus 15.5 +\n  // 0.0085*v² deceleration), with its continuous-time solution rather than\n  // an FPS-dependent Euler subtraction. This is a horizontal gameplay assist;\n  // vertical velocity and Earth gravity stay in the separate altitude path.\n  const linear = -Math.log(0.45), quadratic = 0.0085, constant = 15.5;\n  const discriminant = Math.sqrt(linear * linear - 4 * quadratic * constant);\n  const nearRoot = (-linear + discriminant) / (2 * quadratic);\n  const farRoot = (-linear - discriminant) / (2 * quadratic);\n  const ratio = (speedMps - nearRoot) / (speedMps - farRoot) * Math.exp(-discriminant * dt);\n  return Math.max(0, (nearRoot - ratio * farRoot) / (1 - ratio));\n}","addAirThrust":"function addAirThrust(vx, vz, impulseX, impulseZ, propulsionLimit) {\n  const impulse = Math.hypot(impulseX, impulseZ);\n  if (impulse === 0) return { vx, vz };\n  // Govern only propulsion along its actual thrust axis. Inherited orthogonal\n  // momentum remains untouched, and a turned nose can still add sideways\n  // thrust even when total travel speed exceeds this propulsion limit.\n  const alongThrust = (vx * impulseX + vz * impulseZ) / impulse;\n  const fraction = Math.min(1, Math.max(0, propulsionLimit - alongThrust) / impulse);\n  return { vx: vx + impulseX * fraction, vz: vz + impulseZ * fraction };\n}","getGroundCoastSpeed":"function getGroundCoastSpeed(speedMps, dt, isStandardEVMode) {\n  let magnitude = Math.abs(speedMps);\n  if (magnitude <= 0.1) return 0;\n  let remainingDt = dt;\n  // Keep the existing aero + rolling resistance curve. Normal EV overrun is\n  // only 30% stronger; changing the powered speed limit cannot erase momentum.\n  if (isStandardEVMode && magnitude > STANDARD_EV_MAX_MPS) {\n    const overspeedDecel = (0.00012 * magnitude * magnitude + 0.35) * STANDARD_EV_OVERSPEED_COAST_FACTOR;\n    const aboveLimitDt = Math.min(remainingDt, (magnitude - STANDARD_EV_MAX_MPS) / overspeedDecel);\n    magnitude = Math.max(STANDARD_EV_MAX_MPS, magnitude - overspeedDecel * aboveLimitDt);\n    remainingDt -= aboveLimitDt;\n  }\n  // Split a threshold-crossing frame so the remainder uses ordinary coasting.\n  // This never snaps to 200, nor carries the 1.3 multiplier below the threshold.\n  magnitude = Math.max(0, magnitude - (0.00012 * magnitude * magnitude + 0.35) * remainingDt);\n  return Math.sign(speedMps) * magnitude;\n}","accelerateGroundSpeed":"function accelerateGroundSpeed(speedMps, acceleration, speedLimit, dt, isStandardEVMode) {\n  if (isStandardEVMode && speedMps > speedLimit) {\n    // W still caps electric propulsion, while excess jet momentum coasts away.\n    // Once it reaches the drive ceiling, W can maintain that speed normally.\n    return Math.max(speedLimit, getGroundCoastSpeed(speedMps, dt, true));\n  }\n  return Math.min(speedLimit, speedMps + acceleration * dt);\n}","getRetroBrakeDemand":"function getRetroBrakeDemand(speedMps, isAirborne) {\n  const blend = Math.max(0, Math.min(1,\n    (speedMps - RETRO_BRAKE_START_MPS) / (RETRO_BRAKE_FULL_MPS - RETRO_BRAKE_START_MPS)));\n  const highSpeedDemand = blend * blend * (3 - 2 * blend);\n  // Preserve the existing airborne H/S manual retro control at low speeds.\n  // Feather it near rest so a stopped vehicle cannot spend fuel indefinitely.\n  return isAirborne ? Math.max(highSpeedDemand, Math.min(1, speedMps)) : highSpeedDemand;\n}","integrateFreefall":"function integrateFreefall(y, vy, dt, surfaceY) {\n  const nextY = y + vy * dt - 0.5 * EARTH_GRAVITY_MPS2 * dt * dt;\n  const nextVy = vy - EARTH_GRAVITY_MPS2 * dt;\n  if (y >= surfaceY && nextY <= surfaceY && nextVy <= 0) {\n    const impactSpeed = Math.sqrt(vy * vy + 2 * EARTH_GRAVITY_MPS2 * (y - surfaceY));\n    return { y: surfaceY, vy: -impactSpeed };\n  }\n  return { y: nextY, vy: nextVy };\n}","readDriveInput":"function readDriveInput() {\n  if (globalThis.window?.RoadsterDemo?.isBusy()) return window.RoadsterDemo.input();\n  const touch = globalThis.window?.RoadsterTouch?.readInput() || {};\n  const axis = name => Math.max(-1, Math.min(1, Number.isFinite(touch[name]) ? touch[name] : 0));\n  const amount = (name, ...codes) => Math.max(0, axis(name), ...codes.map(code => Number(Boolean(keys[code]))));\n  return {\n    steer: Math.max(-1, Math.min(1, Number(Boolean(keys.KeyD)) - Number(Boolean(keys.KeyA)) + axis('steer'))),\n    throttle: amount('throttle', 'KeyW'), boost: amount('boost', 'Semicolon'),\n    brake: amount('brake', 'KeyH'), reverse: amount('reverse', 'KeyS'),\n    handbrake: amount('handbrake', 'KeyU'), lift: amount('lift', 'Space'),\n    descend: amount('descend', 'ShiftLeft', 'ShiftRight'),\n    strafe: Math.max(-1, Math.min(1, Number(Boolean(keys.KeyE)) - Number(Boolean(keys.KeyQ)) + axis('strafe'))),\n    roll: axis('roll'), pitch: axis('pitch')\n  };\n}","readAttitudeInput":"function readAttitudeInput(isAirborne) {\n  if (globalThis.window?.RoadsterDemo?.isBusy()) return { rawRollInput: 0, rawPitchInput: 0, rawYawInput: 0, hasManualAttitudeInput: false };\n  // Keep keyboard ownership independent: a released thumb cannot release W.\n  const drive = readDriveInput();\n  const rollLeft = Boolean(keys['KeyJ'] || keys['ArrowLeft']);\n  const rollRight = Boolean(keys['KeyL'] || keys['ArrowRight']);\n  const pitchUp = Boolean(keys['KeyI'] || keys['ArrowUp']);\n  const pitchDown = Boolean(keys['KeyK'] || keys['ArrowDown']);\n  const yawLeft = isAirborne && Boolean(keys['KeyA']);\n  const yawRight = isAirborne && Boolean(keys['KeyD']);\n  return {\n    rawRollInput: Math.max(-1, Math.min(1, Number(rollLeft) - Number(rollRight) + drive.roll)),\n    rawPitchInput: Math.max(-1, Math.min(1, Number(pitchUp) - Number(pitchDown) + drive.pitch)),\n    rawYawInput: isAirborne ? -drive.steer : 0,\n    // Opposing held controls still count as player input, even if their torques cancel.\n    hasManualAttitudeInput: rollLeft || rollRight || pitchUp || pitchDown || yawLeft || yawRight ||\n      drive.roll !== 0 || drive.pitch !== 0 ||\n      (isAirborne && (drive.steer !== 0 || drive.strafe !== 0 || Boolean(keys['KeyQ'] || keys['KeyE'])))\n  };\n}","advanceAttitudeIdle":"function advanceAttitudeIdle(dt, hasInput) {\n  const previousIdle = state.attitudeIdleSeconds || 0;\n  state.attitudeIdleSeconds = hasInput ? 0 : Math.min(2.0, previousIdle + dt);\n  // Only apply the portion of this frame after the full two-second grace period.\n  return hasInput || !state.autoStabilizer ? 0 : Math.min(dt, Math.max(0, previousIdle + dt - 2.0));\n}","triggerJump6m":"function triggerJump6m() {\n  if (globalThis.window?.RoadsterDemo?.isBusy() && !window.RoadsterDemo.isRequestingJump()) return;\n  if (state.isDestroyed || state.isFreefalling || state.airRemaining <= 0.15) return;\n  sound.init();\n  let groundElev = currentMap === 'coast' ? (globalThis.window?.RoadsterCoast?.support({...state,grounded:!state.wasAirborne}).height ?? 0) : 0;\n  if ((currentMap === 'city' && typeof cityBuildings !== 'undefined') || currentMap === 'coast') {\n    const mapBuildings = currentMap === 'coast' ? (globalThis.window?.RoadsterCoast?.buildings() || []) : cityNearbyBuildings(state);\n    for (let i = 0; i < mapBuildings.length; i++) {\n      const b = mapBuildings[i];\n      if (currentMap==='city'?cityTouchesRoof(state,b):state.x > b.minX - 1.1 && state.x < b.maxX + 1.1 && state.z > b.minZ - 1.8 && state.z < b.maxZ + 1.8) {\n        if (state.y >= b.height - 0.55) {\n          groundElev = Math.max(groundElev, b.height);\n        }\n      }\n    }\n  }\n  const currentAgl = Math.max(0.0, state.y - groundElev);\n  // Only a fresh ground/roof takeoff gets launch grace. Midair O taps cannot\n  // restart it and disable normal flight handling.\n  if (currentAgl <= 0.15 && (currentMap!=='coast'||(!state.wasAirborne&&!state.coastDetached))) {\n    state.groundHopActive = true;\n    state.jumpInertiaSeconds = 0;\n    state.jumpInertiaGraceSeconds = globalThis.window?.RoadsterDemo?.isRequestingJump() ? (window.RoadsterDemo.jumpGraceSeconds?.() ?? 0.95) : null;\n  }\n  // Jump to 6.0m above ground/rooftop (or +6.0m if already flying above 5.5m)\n  state.jumpStartY = state.y;\n  const demoJumpHeight = globalThis.window?.RoadsterDemo?.isRequestingJump() ? window.RoadsterDemo.jumpHeight() : 6.0;\n  state.jumpTargetY = (currentAgl < 5.5) ? (groundElev + demoJumpHeight) : Math.min(MAX_FLIGHT_ALTITUDE, state.y + 6.0);\n  state.isJumping6m = true;\n  if(currentMap==='coast'){state.coastDetached=true;state.coastSupportId=null;}\n  state.isAltitudeHold = false;\n  const nBadge = document.getElementById('key-n');\n  if (nBadge) nBadge.classList.remove('active');\n  const baseClimbVy = (state.physicsMode === 'realistic') ? (6.2 * 1.3) : (28.0 * 1.3);\n  state.vy = Math.max(state.vy, baseClimbVy * 2.5);\n  if (!globalThis.window?.RoadsterDemo?.isRequestingJump()) showBanner('jump6m', 2.0);\n  sound.beep(820, 0.12);\n}","trafficStep":"function step(cars, player, dt, lanes, scale, forecast = false) {\n    const snapshotFor = forecast ? forecastSnapshot : snapshot;\n    const leaderForStep = forecast ? forecastLeaderFor : leaderFor;\n    const footprintFor = forecast ? forecastFootprint : footprint;\n    const adjacentGapFor = forecast ? forecastSafeAdjacentGap : safeAdjacentGap;\n    for (const car of cars) car.highwayPassedThisFrame = false;\n    if (!(dt > 0)) return;\n    initializeSpeeds(cars, lanes, scale, player, forecast);\n    // Bound braking/decisions to 60 Hz or finer, including a slow render frame.\n    const count = Math.max(1, Math.ceil(dt / (1 / 60) - 1e-8));\n    const h = dt / count;\n    for (let substep = 0; substep < count; substep++) {\n      const live = [];\n      const spawnCache = lanes.length === 6 ? { index: null } : null;\n      for (const car of cars) {\n        if (car.mode !== 'highway') continue;\n        if (typeof car.highwayPassEligible !== 'boolean') car.highwayPassEligible =\n          car.mesh.position.z < (player.z || 0) - ((car.length || 4.62) + 4.62) / 2;\n        // A pre-existing expired blast is a safe fallback. Normal runtime\n        // also calls respawnBehind directly at active/destroyed blast expiry.\n        const expiredBlast = !(car.blastTimer > 0) && car.recoverHighwayLane;\n        const incidentExit = isOffRoad(car, lanes) || (isWreck(car) && isOutOfBounds(car, lanes, player));\n        if (car.highwayWaitingToSpawn === undefined && (incidentExit || expiredBlast)) {\n          if (spawnCache) spawnCache.index = null;\n          respawn(car, cars, lanes, player, scale, forecast, spawnCache);\n          if (car.highwayWaitingToSpawn !== undefined) continue;\n        }\n        if (car.blastTimer > 0) {\n          if (spawnCache) spawnCache.index = null;\n          car.laneChange = null;\n          car.blockedTime = 0;\n          car.laneChangeCooldown = profile(car).cooldown;\n          car.recoverHighwayLane = true;\n          continue;\n        }\n        if (car.highwayWaitingToSpawn !== undefined) {\n          retrySpawn(car, cars, lanes, player, scale, forecast, spawnCache);\n          if (car.highwayWaitingToSpawn !== undefined) continue;\n        }\n        if (car.recoverHighwayLane) {\n          if (spawnCache) spawnCache.index = null;\n          car.laneIdx = closestLane(car.mesh.position.x, lanes);\n          car.targetX = lanes[car.laneIdx];\n        }\n        car.laneChangeCooldown = Math.max(0, (car.laneChangeCooldown || 0) - h);\n        if (spawnCache && !Number.isInteger(car.laneIdx)) spawnCache.index = null;\n        live.push(snapshotFor(car, lanes));\n      }\n      const traffic = live.slice();\n      // A low player car occupies every lane swept by its lateral motion during\n      // a merge. High flight remains free of road traffic interactions.\n      if (player.y < 4) {\n        const endX = player.x + (player.vx || 0) * MERGE_SECONDS;\n        let occupied;\n        if (forecast) {\n          let mask = 0;\n          const low = Math.min(player.x, endX) - FOOTPRINT_RADIUS, high = Math.max(player.x, endX) + FOOTPRINT_RADIUS;\n          for (let i = 0; i < 6; i++) if (lanes[i] >= low && lanes[i] <= high) mask |= 1 << i;\n          occupied = forecastMaskLanes[mask];\n        } else occupied = lanes.flatMap((x, i) => x >= Math.min(player.x, endX) - FOOTPRINT_RADIUS && x <= Math.max(player.x, endX) + FOOTPRINT_RADIUS ? [i] : []);\n        traffic.push({ x: player.x, z: player.z || 0, speed: -player.vz, length: 4.62, lanes: occupied });\n      }\n      // Keep airborne blast physics separate, but don't merge into a low wreck.\n      for (const car of cars) {\n        if (car.mode !== 'highway' || !(car.blastTimer > 0) || (car.y || 0) >= 4) continue;\n        traffic.push({ z: car.mesh.position.z, speed: blastSpeed(car, player, scale), ...blastSafetyBounds(car, player, scale), length: car.length || 4.62,\n          lanes: footprintFor(car.mesh.position.x, lanes) });\n      }\n\n      if (forecast) forecastIndexLanes(traffic);\n\n      // A shockwave may leave a car off-center. Rejoin only after checking\n      // the destination, while reserving every lane under its actual footprint.\n      for (const own of live) {\n        const car = own.car;\n        if (!car.recoverHighwayLane || !adjacentGapFor(own, car.laneIdx, traffic, scale)) continue;\n        car.laneChange = { from: car.laneIdx, to: car.laneIdx, startX: own.x, elapsed: 0 };\n        delete car.recoverHighwayLane;\n      }\n      const requests = [];\n      for (const own of live) {\n        const car = own.car;\n        const leader = leaderForStep(own, car.laneIdx, traffic);\n        const blocked = leader && leader.gap > MIN_GAP && leader.gap < lookAhead(own, scale) && own.desiredSpeed - leader.speed >= profile(car).advantage;\n        car.blockedTime = blocked ? (car.blockedTime || 0) + h : 0;\n        if (blocked && !car.recoverHighwayLane && !car.laneChange && car.laneChangeCooldown === 0 && car.blockedTime >= profile(car).reaction) requests.push({ own, leader });\n      }\n      requests.sort((a, b) => a.leader.gap - b.leader.gap);\n      for (const { own, leader } of requests) {\n        const car = own.car;\n        const options = [car.laneIdx - 1, car.laneIdx + 1].filter(lane => lane >= 0 && lane < lanes.length)\n          .map(lane => {\n            const targetLeader = leaderForStep(own, lane, traffic);\n            const usefulGap = MIN_GAP + own.desiredSpeed * scale * profile(car).headway;\n            const flow = targetLeader ? Math.min(own.desiredSpeed, targetLeader.speed + Math.max(0, targetLeader.gap - usefulGap) / (scale * 3)) : own.desiredSpeed;\n            const useful = !targetLeader || targetLeader.speed - leader.speed >= profile(car).advantage || targetLeader.gap - leader.gap > (car.driverType === 'racer' ? 20 : 30);\n            return { lane, flow, useful, gap: targetLeader ? targetLeader.gap : Infinity };\n          }).filter(option => option.useful && option.flow - leader.speed >= profile(car).advantage && safeAdjacentGap(own, option.lane, traffic, scale))\n          .sort((a, b) => b.flow - a.flow || b.gap - a.gap);\n        if (!options.length) continue;\n        const to = options[0].lane;\n        car.laneChange = { from: car.laneIdx, to, startX: own.x, elapsed: 0 };\n        car.targetX = lanes[to];\n        car.blockedTime = 0;\n        own.lanes = [car.laneIdx, to]; // Reservation is visible to every later request.\n        // Rebuild immediately in original ordinal order before the next\n        // request sees this reservation. Never reuse a pre-approval index.\n        if (forecast) forecastIndexLanes(traffic);\n      }\n\n      const plans = live.map(own => {\n        const driver = profile(own.car);\n        let acceleration = driver.acceleration * (1 - Math.pow(own.speed / Math.max(1, own.desiredSpeed), 4));\n        for (const lane of own.lanes) {\n          const leader = leaderForStep(own, lane, traffic);\n          if (!leader) continue;\n          const v = Math.max(0, own.speed) * scale;\n          const closing = (own.speed - leader.speed) * scale;\n          const headway = MIN_GAP + Math.max(0, v * driver.headway + v * closing / (2 * Math.sqrt(driver.acceleration * 4.5) * scale));\n          acceleration = Math.min(acceleration, driver.acceleration * (1 - Math.pow(own.speed / Math.max(1, own.desiredSpeed), 4) - Math.pow(headway / Math.max(0.1, leader.gap), 2)));\n        }\n        return { own, speed: clamp(own.speed + clamp(acceleration, -MAX_BRAKE, driver.acceleration) * h, 0, own.desiredSpeed) };\n      });\n      for (const { own, speed } of plans) {\n        const car = own.car;\n        car.speed = speed;\n        car.vz = -speed;\n        car.mesh.position.z += (-player.vz - (own.speed + speed) / 2) * scale * h;\n        let lateralSpeed = 0;\n        if (car.laneChange) {\n          const change = car.laneChange;\n          const mergeSeconds = profile(car).merge;\n          change.elapsed = Math.min(mergeSeconds, change.elapsed + h);\n          const t = change.elapsed / mergeSeconds;\n          const blend = t * t * t * (10 + t * (-15 + 6 * t));\n          const distance = lanes[change.to] - change.startX;\n          car.mesh.position.x = change.startX + distance * blend;\n          lateralSpeed = distance * 30 * t * t * (1 - t) * (1 - t) / mergeSeconds;\n          if (t >= 1) {\n            car.laneIdx = change.to;\n            car.laneChange = null;\n            car.laneChangeCooldown = profile(car).cooldown;\n          }\n        }\n        car.vx = lateralSpeed; // Highway lateral motion is unscaled, like state.vx.\n        car.mesh.rotation.y = -clamp(Math.atan2(lateralSpeed, Math.max(8, speed * scale)), -0.14, 0.14);\n        car.mesh.rotation.z = -clamp(lateralSpeed * 0.018, -0.06, 0.06);\n        const playerZ = player.z || 0;\n        // A rear entry is not a player overtake. It becomes eligible only\n        // after actually returning fully in front of the player, not a wrap.\n        if (car.mesh.position.z < playerZ - ((car.length || 4.62) + 4.62) / 2) {\n          car.highwayRecycledBehind = false;\n          car.highwayPassEligible = true;\n        }\n        const rearLimit = car.highwayRecycledBehind ? 480 : 65;\n        if (car.mesh.position.z > playerZ + rearLimit) {\n          if (!car.highwayRecycledBehind && car.highwayPassEligible && own.z <= playerZ + 65) car.highwayPassedThisFrame = true;\n          respawn(car, cars, lanes, player, scale, forecast, null, 'ahead');\n        } else if (car.mesh.position.z < playerZ - 480) respawn(car, cars, lanes, player, scale, forecast, null, 'behind');\n      }\n    }\n  }","trafficForecastStep":"function forecastStep(cars, player, dt, lanes, scale) {\n    // The six-lane cache is an allocation optimization, never an approximation\n    // for another road layout. Other lane counts retain the ordinary path.\n    return step(cars, player, dt, lanes, scale, lanes.length === 6);\n  }","demoSweptContact":"function sweptContact(x0,z0,x1,z1,halfX,halfZ){\n  let enter=0,leave=1;\n  const dx=x1-x0;\n  if(Math.abs(dx)<1e-10){\n    if(Math.abs(x0)>=halfX)return null;\n  }else{\n    let lo=(-halfX-x0)/dx,hi=(halfX-x0)/dx;\n    if(lo>hi){const swap=lo;lo=hi;hi=swap;}\n    enter=Math.max(enter,lo);leave=Math.min(leave,hi);\n    if(enter>=leave)return null;\n  }\n  const dz=z1-z0;\n  if(Math.abs(dz)<1e-10){\n    if(Math.abs(z0)>=halfZ)return null;\n  }else{\n    let lo=(-halfZ-z0)/dz,hi=(halfZ-z0)/dz;\n    if(lo>hi){const swap=lo;lo=hi;hi=swap;}\n    enter=Math.max(enter,lo);leave=Math.min(leave,hi);\n    if(enter>=leave)return null;\n  }\n  return leave>0&&enter<1?Math.max(0,enter):null;\n}"});
const profiles=Object.freeze([{"id":"three-r128-cpu-vendor-uncompressed","bundleSha256":"09ee4ebbae9976c1c9803eaafe5cb7553fcd58f34293fd557dc51c2ac8fe1f61","clampSource":"function clamp( value, min, max ) {\n\n\treturn Math.max( min, Math.min( max, value ) );\n\n}","lerpSource":"function lerp( x, y, t ) {\n\n\treturn ( 1 - t ) * x + t * y;\n\n}"},{"id":"three-r128-browser-bundle-minified","bundleSha256":"9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2","clampSource":"function ht(t,e,n){return Math.max(e,Math.min(n,t))}","lerpSource":"function dt(t,e,n){return(1-n)*t+n*e}"}]);
const expectedConstants=(()=>{const ROAD_WIDTH = 30;
const LANE_COUNT = 6;
const LANE_WIDTH = ROAD_WIDTH / LANE_COUNT;
const LANE_CENTERS = [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5];
const CITY_HALF_BOUND = 1200;
const MAX_FLIGHT_ALTITUDE = 380.0;
const CITY_ROAD_COORDS = [-900, -600, -300, 0, 300, 600, 900];
const CITY_ROAD_WIDTH = 24; // Six 4 m lanes; vehicle and map coordinates remain metres.
const CITY_LANE_WIDTH = CITY_ROAD_WIDTH / 6;
const CITY_DEFAULT_LANE_OFFSET = CITY_LANE_WIDTH * 1.5;
const CITY_TAXI_STOP_OFFSET = CITY_ROAD_WIDTH / 2 - 4; // Full 3 m beam + 1 m clearance on asphalt.
const CITY_BUILDING_SETBACK = 12; // Low frontage only; towers are recessed separately.
const WORLD_SPEED_SCALE = 1.65; // Preserve the highway arcade traversal / traffic calibration.
const CITY_WORLD_SPEED_SCALE = 1.0; // City geometry, navigation distances and velocity all use metres.
// Vertical coordinates are meters and vertical velocity is m/s. The horizontal
// optical-flow multiplier must never multiply gravity or the altitude display.
const EARTH_GRAVITY_MPS2 = 9.81;

const MAX_AIR_SECONDS = 10.0;
const AUTO_DESCENT_USED_SECONDS = 8.0;

// One bounded, live reading for both the exterior gauge and the cockpit bar.
function getAirTankReadout(remainingSeconds) {
  const seconds = Math.max(0, Math.min(MAX_AIR_SECONDS, Number.isFinite(remainingSeconds) ? remainingSeconds : 0));
  const fraction = seconds / MAX_AIR_SECONDS;
  return { seconds, fraction, liters: Math.round(fraction * 600), massKg: fraction * 144.0 };
}

const VEHICLE_MASS_KG = 1850;
const CRITICAL_IMPACT_DV = 28.0; // m/s (~100.8 km/h relative impact velocity)
const CRITICAL_G_LIMIT = 18.0;   // 18.0 G single-impact destruction threshold


const RETRO_BRAKE_START_MPS = 200 / 3.6;
const RETRO_BRAKE_FULL_MPS = 240 / 3.6;
const RETRO_BRAKE_FORCE_N = 80000;
const RETRO_BRAKE_BURN_PER_SECOND = 0.55;
const STANDARD_EV_MAX_MPS = 200 / 3.6;
const STANDARD_EV_OVERSPEED_COAST_FACTOR = 1.3;
const PASSIVE_AERO_DRAG_PER_METER = 0.00012;
const JUMP_INERTIA_GRACE_SECONDS = 0.25;
const JUMP_INERTIA_BLEND_SECONDS = 0.60;
return {ROAD_WIDTH,LANE_COUNT,LANE_WIDTH,LANE_CENTERS,CITY_HALF_BOUND,MAX_FLIGHT_ALTITUDE,CITY_ROAD_COORDS,CITY_ROAD_WIDTH,CITY_LANE_WIDTH,CITY_DEFAULT_LANE_OFFSET,CITY_TAXI_STOP_OFFSET,CITY_BUILDING_SETBACK,WORLD_SPEED_SCALE,CITY_WORLD_SPEED_SCALE,EARTH_GRAVITY_MPS2,MAX_AIR_SECONDS,AUTO_DESCENT_USED_SECONDS,VEHICLE_MASS_KG,CRITICAL_IMPACT_DV,CRITICAL_G_LIMIT,RETRO_BRAKE_START_MPS,RETRO_BRAKE_FULL_MPS,RETRO_BRAKE_FORCE_N,RETRO_BRAKE_BURN_PER_SECOND,STANDARD_EV_MAX_MPS,STANDARD_EV_OVERSPEED_COAST_FACTOR,PASSIVE_AERO_DRAG_PER_METER,JUMP_INERTIA_GRACE_SECONDS,JUMP_INERTIA_BLEND_SECONDS};})();
const expectedHandling=(()=>{  const handling = Object.freeze({ rackRate: 30, yawRate: 18, lateralRate: 24, lateralSpeed: 24 });
  // Continuous relative-box sweep: corner contacts between prediction samples
  // are real hazards too. Returns the first frame fraction, or null.
  function sweptContact(x0,z0,x1,z1,halfX,halfZ){
  let enter=0,leave=1;
  const dx=x1-x0;
  if(Math.abs(dx)<1e-10){
    if(Math.abs(x0)>=halfX)return null;
  }else{
    let lo=(-halfX-x0)/dx,hi=(halfX-x0)/dx;
    if(lo>hi){const swap=lo;lo=hi;hi=swap;}
    enter=Math.max(enter,lo);leave=Math.min(leave,hi);
    if(enter>=leave)return null;
  }
  const dz=z1-z0;
  if(Math.abs(dz)<1e-10){
    if(Math.abs(z0)>=halfZ)return null;
  }else{
    let lo=(-halfZ-z0)/dz,hi=(halfZ-z0)/dz;
    if(lo>hi){const swap=lo;lo=hi;hi=swap;}
    enter=Math.max(enter,lo);leave=Math.min(leave,hi);
    if(enter>=leave)return null;
  }
  return leave>0&&enter<1?Math.max(0,enter):null;
}

return handling;})();
function cloneSnapshot(value, path = 'snapshot', seen = new Set()) {
  // Browser JavaScript has no isProxy intrinsic. This entry is for trusted
  // plain-data snapshots from the verified internal producer only. Hostile
  // proxies/getters/observers are outside that contract, never advertised safe.
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint')
      throw Error(`Unsupported snapshot value at ${path}`);
    return value;
  }
  if (seen.has(value)) throw Error(`Cyclic snapshot at ${path}`);
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null)
    throw Error(`Non-data snapshot object at ${path}`);
  seen.add(value);
  const copy = Array.isArray(value) ? [] : Object.create(prototype);
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === 'length') continue;
    if (typeof key !== 'string') throw Error(`Symbol snapshot key at ${path}`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!Object.hasOwn(descriptor, 'value')) throw Error(`Snapshot accessor at ${path}.${key}`);
    Object.defineProperty(copy, key, { value: cloneSnapshot(descriptor.value, `${path}.${key}`, seen),
      enumerable: descriptor.enumerable, writable: true, configurable: true });
  }
  if (Array.isArray(value)) copy.length = value.length;
  seen.delete(value);
  return copy;
}
function makeIdentityBinder({ readReferences, expectedFunctions, expectedConstants, expectedHandling, profiles }) {
  const toString = Function.prototype.toString;
  let cached = null, selectedProfile = null;
  const reject = detail => {
    const error = Error(`Projection runtime identity mismatch: ${detail}`);
    error.code = 'PROJECTION_RUNTIME_IDENTITY_MISMATCH'; error.detail = detail; throw error;
  };
  const sameData = (expected, actual, path) => {
    if (expected === null || actual === null || typeof expected !== 'object' || typeof actual !== 'object') {
      if (!Object.is(expected, actual)) reject(path);
      return;
    }
    if (Array.isArray(expected) !== Array.isArray(actual)) reject(path);
    const keys = Object.keys(expected);
    if (keys.length !== Object.keys(actual).length) reject(`${path}.keys`);
    for (const key of keys) {
      if (!Object.hasOwn(actual, key)) reject(`${path}.${key}.missing`);
      sameData(expected[key], actual[key], `${path}.${key}`);
    }
  };
  const assertRuntime = () => {
    const current = readReferences();
    if (!current || !current.functions || !current.math || !current.constants || !current.handling) reject('missing-bindings');
    const names = Object.keys(expectedFunctions);
    if (Object.keys(current.functions).length !== names.length) reject('function-keys');
    sameData(expectedConstants, current.constants, 'constants');
    sameData(expectedHandling, current.handling, 'handling');
    if (cached) {
      for (const name of names) if (current.functions[name] !== cached.functions[name]) reject(`${name}.reference`);
      if (current.math.clamp !== cached.math.clamp || current.math.lerp !== cached.math.lerp) reject('math.reference');
      if (current.handling !== cached.handling) reject('handling.reference');
      return true;
    }
    for (const name of names) {
      const fn = current.functions[name];
      if (typeof fn !== 'function' || toString.call(fn) !== expectedFunctions[name]) reject(`${name}.source`);
    }
    if (typeof current.math.clamp !== 'function' || typeof current.math.lerp !== 'function') reject('math.missing');
    const clamp = toString.call(current.math.clamp), lerp = toString.call(current.math.lerp);
    const matched = profiles.find(profile => profile.clampSource === clamp && profile.lerpSource === lerp);
    if (!matched) reject('math.unknown-profile');
    selectedProfile = matched.id;
    cached = { functions: { ...current.functions }, math: { ...current.math }, handling: current.handling };
    return true;
  };
  return { assertRuntime, identity: () => ({ bound: !!cached, mathProfile: selectedProfile }) };
}
function createNumericCore(Math,stop){
'use strict';

function clamp( value, min, max ) {

	return Math.max( min, Math.min( max, value ) );

}

// compute euclidian modulo of m % n
// https://en.wikipedia.org/wiki/Modulo_operation

function lerp( x, y, t ) {

	return ( 1 - t ) * x + t * y;

}

// http://www.rorydriscoll.com/2016/03/07/frame-rate-independent-damping-using-lerp/

const THREE = Object.freeze({MathUtils:Object.freeze({clamp,lerp})});
const ROAD_WIDTH = 30;
const LANE_COUNT = 6;
const LANE_WIDTH = ROAD_WIDTH / LANE_COUNT;
const LANE_CENTERS = [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5];
const CITY_HALF_BOUND = 1200;
const MAX_FLIGHT_ALTITUDE = 380.0;
const CITY_ROAD_COORDS = [-900, -600, -300, 0, 300, 600, 900];
const CITY_ROAD_WIDTH = 24; // Six 4 m lanes; vehicle and map coordinates remain metres.
const CITY_LANE_WIDTH = CITY_ROAD_WIDTH / 6;
const CITY_DEFAULT_LANE_OFFSET = CITY_LANE_WIDTH * 1.5;
const CITY_TAXI_STOP_OFFSET = CITY_ROAD_WIDTH / 2 - 4; // Full 3 m beam + 1 m clearance on asphalt.
const CITY_BUILDING_SETBACK = 12; // Low frontage only; towers are recessed separately.
const WORLD_SPEED_SCALE = 1.65; // Preserve the highway arcade traversal / traffic calibration.
const CITY_WORLD_SPEED_SCALE = 1.0; // City geometry, navigation distances and velocity all use metres.
// Vertical coordinates are meters and vertical velocity is m/s. The horizontal
// optical-flow multiplier must never multiply gravity or the altitude display.
const EARTH_GRAVITY_MPS2 = 9.81;

const MAX_AIR_SECONDS = 10.0;
const AUTO_DESCENT_USED_SECONDS = 8.0;

// One bounded, live reading for both the exterior gauge and the cockpit bar.
function getAirTankReadout(remainingSeconds) {
  const seconds = Math.max(0, Math.min(MAX_AIR_SECONDS, Number.isFinite(remainingSeconds) ? remainingSeconds : 0));
  const fraction = seconds / MAX_AIR_SECONDS;
  return { seconds, fraction, liters: Math.round(fraction * 600), massKg: fraction * 144.0 };
}

const VEHICLE_MASS_KG = 1850;
const CRITICAL_IMPACT_DV = 28.0; // m/s (~100.8 km/h relative impact velocity)
const CRITICAL_G_LIMIT = 18.0;   // 18.0 G single-impact destruction threshold


  const handling = Object.freeze({ rackRate: 30, yawRate: 18, lateralRate: 24, lateralSpeed: 24 });
  // Continuous relative-box sweep: corner contacts between prediction samples
  // are real hazards too. Returns the first frame fraction, or null.
  function sweptContact(x0,z0,x1,z1,halfX,halfZ){
  let enter=0,leave=1;
  const dx=x1-x0;
  if(Math.abs(dx)<1e-10){
    if(Math.abs(x0)>=halfX)return null;
  }else{
    let lo=(-halfX-x0)/dx,hi=(halfX-x0)/dx;
    if(lo>hi){const swap=lo;lo=hi;hi=swap;}
    enter=Math.max(enter,lo);leave=Math.min(leave,hi);
    if(enter>=leave)return null;
  }
  const dz=z1-z0;
  if(Math.abs(dz)<1e-10){
    if(Math.abs(z0)>=halfZ)return null;
  }else{
    let lo=(-halfZ-z0)/dz,hi=(halfZ-z0)/dz;
    if(lo>hi){const swap=lo;lo=hi;hi=swap;}
    enter=Math.max(enter,lo);leave=Math.min(leave,hi);
    if(enter>=leave)return null;
  }
  return leave>0&&enter<1?Math.max(0,enter):null;
}

const RoadsterHighwayDemoPlanner=Object.freeze({handling,sweptContact});
// Highway-only traffic. Speeds belong to drivers; lane changes need a slower
// leader and a safe, useful adjacent gap. Plan from one snapshot so an earlier
// array entry cannot cut into a later car's already-reserved merge.
const highwayTraffic = (() => {
  const MIN_GAP = 7;
  // World -Z is forward. Only incident recovery uses the rear reservoir;
  // ordinary longitudinal window exits keep the continuous road traffic loop.
  const REAR_SPAWN_OFFSETS = [95, 135, 175, 215, 255, 295, 335, 375, 415];
  const FRONT_SPAWN_OFFSETS = [-452, -470, -434, -416];
  const NORMAL_REAR_SPAWN_OFFSETS = [55, 39, 23];
  const spawnCandidates = (player, placement) => {
    const offsets = placement === 'incident' ? REAR_SPAWN_OFFSETS : placement === 'ahead' ? FRONT_SPAWN_OFFSETS : NORMAL_REAR_SPAWN_OFFSETS;
    return player.z ? offsets.map(z => z + player.z) : offsets;
  };
  const SPEED_ADVANTAGE = 0.6;
  const MERGE_SECONDS = 2.6;
  const COOLDOWN_SECONDS = 3.0;
  const MAX_BRAKE = 8.5;
  // A car between lane centers can intersect either lane's swept merge path.
  const FOOTPRINT_RADIUS = 4.35; // half a 5 m lane plus the collision envelope
  const footprint = (x, lanes) => lanes.flatMap((center, i) => Math.abs(center - x) <= FOOTPRINT_RADIUS ? [i] : []);
  const blastSpeed = (car, player, scale) => -player.vz - (-player.vz - car.speed + (car.blastVz || 0)) / scale;
  function blastSafetyBounds(car, player, scale) {
    const current = blastSpeed(car, player, scale);
    const settled = -player.vz - (-player.vz - car.speed) / scale;
    // Ground bounces damp blastVz toward zero; expiry restores normal traffic.
    return {
      frontSafetySpeed: Math.min(current, settled, car.speed),
      rearSafetySpeed: Math.max(current, settled, car.desiredSpeed || car.speed)
    };
  }
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const closestLane = (x, lanes) => lanes.reduce((best, center, i) => Math.abs(center - x) < Math.abs(lanes[best] - x) ? i : best, 0);
  const racerProfile = Object.freeze({ merge: 1.85, cooldown: 1.35, reaction: 0.12, advantage: 0.35, headway: 0.68, acceleration: 3.2 });
  const cruiseProfile = Object.freeze({ merge: MERGE_SECONDS, cooldown: COOLDOWN_SECONDS, reaction: 0.24, advantage: SPEED_ADVANTAGE, headway: 0.95, acceleration: 2.1 });
  const profile = car => car?.driverType === 'racer' ? racerProfile : cruiseProfile;
  function createDrivers(count, random = Math.random) {
    const bands = [{ type: 'racer', share: 0.1, min: 160, max: 180 }, { type: 'cruise', share: 0.4, min: 70, max: 80 }, { type: 'cruise', share: 0.3, min: 80, max: 90 }, { type: 'cruise', share: 0.2, min: 90, max: 120 }];
    const sizes = bands.map(b => Math.floor(count * b.share));
    const remainder = bands.map((b, i) => ({ i, remainder: count * b.share - sizes[i] })).sort((a, b) => b.remainder - a.remainder || a.i - b.i);
    const extra = count - sizes.reduce((a, b) => a + b, 0);
    for (let i = 0; i < extra; i++) sizes[remainder[i].i]++;
    const drivers = bands.flatMap((band, i) => Array.from({ length: sizes[i] }, () => ({ driverType: band.type, speedBand: i, desiredSpeed: (band.min + random() * (band.max - band.min)) / 3.6 })));
    for (let i = drivers.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [drivers[i], drivers[j]] = [drivers[j], drivers[i]]; }
    return drivers;
  }
  const occupiedLanes = car => car.laneChange ? [car.laneChange.from, car.laneChange.to] : [car.laneIdx];

  function reset(car, lane, lanes, placement) {
    car.laneIdx = lane;
    car.targetX = lanes[lane];
    car.mesh.position.x = car.targetX;
    car.mesh.position.y = 0;
    car.mesh.visible = true;
    car.mesh.rotation.x = car.mesh.rotation.y = car.mesh.rotation.z = 0;
    car.laneChange = null;
    delete car.recoverHighwayLane;
    delete car.highwayWaitingToSpawn;
    car.highwayRecycledBehind = placement === 'incident';
    car.highwayPassEligible = placement === 'ahead';
    car.blockedTime = 0;
    car.laneChangeCooldown = profile(car).cooldown;
    car.vx = 0;
    car.vz = -car.speed;
    car.y = car.blastTimer = car.blastVx = car.blastVy = car.blastVz = 0;
  }

  function snapshot(car, lanes) {
    if (!Number.isFinite(car.desiredSpeed)) car.desiredSpeed = car.speed;
    if (!Number.isInteger(car.laneIdx)) car.laneIdx = closestLane(car.mesh.position.x, lanes);
    return { car, x: car.mesh.position.x, z: car.mesh.position.z, speed: car.speed,
      desiredSpeed: car.desiredSpeed, length: car.length || 4.62, lanes: [...new Set([...occupiedLanes(car), ...footprint(car.mesh.position.x, lanes)])] };
  }

  // Explicit speculative-only allocation path. Shared arrays are immutable;
  // reservations replace own.lanes rather than mutating an occupancy array.
  // Keep the original reserved-lane-first Set order, including reversed merges.
  const forecastMaskLanes = Array.from({ length: 64 }, (_, mask) =>
    Object.freeze(Array.from({ length: 6 }, (_, i) => i).filter(i => mask & (1 << i))));
  const forecastOccupancy = new Array(6 * 7 * 64);
  function forecastFootprint(x, lanes) {
    let mask = 0;
    for (let i = 0; i < 6; i++) if (Math.abs(lanes[i] - x) <= FOOTPRINT_RADIUS) mask |= 1 << i;
    return forecastMaskLanes[mask];
  }
  function forecastOccupied(car, lanes) {
    const first = car.laneChange ? car.laneChange.from : car.laneIdx;
    const second = car.laneChange ? car.laneChange.to : 6;
    if (!Number.isInteger(first) || first < 0 || first >= 6 ||
        !Number.isInteger(second) || second < 0 || second > 6 || (car.laneChange && second === 6))
      return [...new Set([...occupiedLanes(car), ...footprint(car.mesh.position.x, lanes)])];
    let mask = 0;
    for (let i = 0; i < 6; i++) if (Math.abs(lanes[i] - car.mesh.position.x) <= FOOTPRINT_RADIUS) mask |= 1 << i;
    const key = (first * 7 + second) * 64 + mask;
    let occupied = forecastOccupancy[key];
    if (!occupied) {
      occupied = [first];
      let included = 1 << first;
      if (second < 6 && second !== first) { occupied.push(second); included |= 1 << second; }
      for (let i = 0; i < 6; i++) if ((mask & (1 << i)) && !(included & (1 << i))) occupied.push(i);
      forecastOccupancy[key] = Object.freeze(occupied);
    }
    return occupied;
  }
  function forecastSnapshot(car, lanes) {
    if (!Number.isFinite(car.desiredSpeed)) car.desiredSpeed = car.speed;
    if (!Number.isInteger(car.laneIdx)) car.laneIdx = closestLane(car.mesh.position.x, lanes);
    return { car, x: car.mesh.position.x, z: car.mesh.position.z, speed: car.speed,
      desiredSpeed: car.desiredSpeed, length: car.length || 4.62, lanes: forecastOccupied(car, lanes) };
  }
  const forecastLaneKey = Symbol('forecast lane members');
  function forecastIndexLanes(traffic) {
    const members = [[], [], [], [], [], []];
    // Original traffic ordinal is the tie-breaker. Do not sort by z: lengths,
    // equal-z contacts and exact floating-point gap comparisons still matter.
    for (const other of traffic) for (const lane of other.lanes) {
      if (!Number.isInteger(lane) || lane < 0 || lane >= 6) continue;
      const list = members[lane];
      if (list[list.length - 1] !== other) list.push(other);
    }
    traffic[forecastLaneKey] = members;
  }
  function forecastMembers(traffic, lane) {
    return Number.isInteger(lane) && lane >= 0 && lane < 6 ? traffic[forecastLaneKey]?.[lane] : null;
  }
  function forecastSafeAdjacentGap(own, lane, traffic, scale) {
    return safeAdjacentGap(own, lane, forecastMembers(traffic, lane) || traffic, scale);
  }
  function forecastLeaderFor(own, lane, traffic) {
    let leader = null, nearestGap = 0;
    const members = forecastMembers(traffic, lane);
    for (const other of members || traffic) {
      if (own === other || (!members && !other.lanes.includes(lane)) || other.z > own.z) continue;
      const gap = own.z - other.z - (own.length + other.length) / 2;
      if (!leader || gap < nearestGap) { leader = other; nearestGap = gap; }
    }
    // All consumers use only speed and gap. Preserve the safety override and
    // strict comparison above; equal-gap leaders retain original array order.
    return leader ? { speed: leader.frontSafetySpeed ?? leader.speed, gap: nearestGap } : null;
  }

  function leaderFor(own, lane, traffic) {
    let leader = null;
    for (const other of traffic) {
      if (own === other || !other.lanes.includes(lane) || other.z > own.z) continue;
      const gap = own.z - other.z - (own.length + other.length) / 2;
      if (!leader || gap < leader.gap) leader = { ...other, speed: other.frontSafetySpeed ?? other.speed, gap };
    }
    return leader;
  }

  function initializeSpeeds(cars, lanes, scale, player, forecast = false) {
    const snapshotFor = forecast ? forecastSnapshot : snapshot;
    const leaderForStep = forecast ? forecastLeaderFor : leaderFor;
    const footprintFor = forecast ? forecastFootprint : footprint;
    // Birth placement is balanced, not a safety promise: a 180 km/h racer can
    // otherwise start behind a 70 km/h car inside its braking distance.
    // Resolve ahead-to-rear once, retaining every personal cruise target.
    const initial = cars.filter(car => car.mode === 'highway' && !car.highwaySpeedInitialized)
      .sort((a, b) => a.mesh.position.z - b.mesh.position.z);
    for (const car of initial) {
      const own = snapshotFor(car, lanes);
      const traffic = cars.filter(other => other.mode === 'highway' && other !== car && other.highwayWaitingToSpawn === undefined).map(other => snapshotFor(other, lanes));
      if (player && player.y < 4) traffic.push({ z: player.z || 0, speed: Math.max(0, -player.vz), length: 4.62, lanes: footprintFor(player.x, lanes) });
      for (const lane of own.lanes) {
        const leader = leaderForStep(own, lane, traffic);
        if (!leader) continue;
        const safeSpeed = Math.sqrt(Math.max(0, leader.speed) ** 2 + 2 * MAX_BRAKE * Math.max(0, leader.gap - MIN_GAP - 2) / scale);
        car.speed = Math.min(car.speed, safeSpeed);
      }
      car.vz = -car.speed;
      car.highwaySpeedInitialized = true;
    }
  }

  function lookAhead(own, scale) {
    return Math.max(38, own.speed * scale * 2.5);
  }

  function safeAdjacentGap(own, lane, traffic, scale) {
    for (const other of traffic) {
      if (other === own || !other.lanes.includes(lane)) continue;
      const distance = own.z - other.z;
      const gap = Math.abs(distance) - (own.length + other.length) / 2;
      const behind = distance < 0;
      const obstacleSpeed = behind ? (other.rearSafetySpeed ?? other.speed) : (other.frontSafetySpeed ?? other.speed);
      const closing = Math.max(0, behind ? obstacleSpeed - own.speed : own.speed - obstacleSpeed);
      const followingSpeed = Math.max(0, behind ? obstacleSpeed : own.speed);
      // The merging car may still brake for its source-lane leader. A rear
      // player or wreck cannot be assumed to brake in response to our merge.
      // Bound our travel under maximum braking, rather than freezing our speed.
      const horizon = profile(own.car).merge + 0.25;
      // Responsive NPC followers brake for reservations. For the player or a
      // wreck retain the full maximum-braking bound: they may never react.
      const responsiveNpc = other.car && !(other.car.blastTimer > 0) && !other.car.recoverHighwayLane;
      const responsiveRear = behind && responsiveNpc;
      const brakingHorizon = responsiveRear ? profile(own.car).merge * 0.45 : horizon;
      const brakingTime = Math.min(brakingHorizon, Math.max(0, own.speed) / MAX_BRAKE);
      const minimumSpeed = Math.max(0, own.speed - MAX_BRAKE * brakingTime);
      const minimumTravel = Math.max(0, own.speed) * brakingTime - 0.5 * MAX_BRAKE * brakingTime * brakingTime + minimumSpeed * (horizon - brakingTime);
      const closingTravel = behind ? Math.max(0, obstacleSpeed * horizon - minimumTravel) : closing * horizon;
      const headway = responsiveNpc ? (profile(own.car).headway * 0.55) : 0.85;
      const needed = Math.max(responsiveNpc ? 9 : 13, followingSpeed * scale * headway) + closingTravel * scale;
      if (gap < needed) return false;
    }
    return true;
  }

  const bodyRadius = car => Math.hypot(car.length || car.mesh.userData?.length || 4.62,
    car.width || car.mesh.userData?.width || 2.03, car.height || car.mesh.userData?.height || 1.5) / 2;
  const isWreck = car => car.blastTimer > 0 || car.recoverHighwayLane;
  const spawnLength = car => isWreck(car) ? bodyRadius(car) * 2 : car.length || 4.62;
  function spawnOccupied(car, lanes, forecast = false) {
    const occupied = forecast ? forecastOccupied(car, lanes) : [...new Set([...occupiedLanes(car), ...footprint(car.mesh.position.x, lanes)])];
    if (!isWreck(car)) return occupied;
    // A tumbling long body may cover another lane even at a lane center.
    // The half-lane margin covers an admitted body anywhere inside its lane.
    return [...new Set([...occupied, ...lanes.flatMap((center, lane) =>
      Math.abs(center - car.mesh.position.x) <= bodyRadius(car) + 2.5 ? [lane] : [])])];
  }
  const spawnReserves = (car, lane, lanes) => occupiedLanes(car).includes(lane) ||
    Math.abs(car.mesh.position.x - lanes[lane]) <= (isWreck(car) ? bodyRadius(car) + 2.5 : 2.3);

  const forecastReserves = (car, lane) => car.laneChange
    ? car.laneChange.from === lane || car.laneChange.to === lane : car.laneIdx === lane;
  function forecastSpawnIndex(own, cars, lanes, player, scale) {
    const occupancy = [0, 0, 0, 0, 0, 0], neighbors = [], live = [];
    for (const other of cars) {
      if (other === own || other.mode !== 'highway' || other.highwayWaitingToSpawn !== undefined) continue;
      live.push(other);
      for (let lane = 0; lane < 6; lane++) if (forecastReserves(other, lane)) occupancy[lane]++;
      const neighbor = { car: other, z: other.mesh.position.z,
        speed: other.blastTimer > 0 ? blastSpeed(other, player, scale) : other.speed,
        length: spawnLength(other), lanes: spawnOccupied(other, lanes, true) };
      if (other.blastTimer > 0) {
        const bounds = blastSafetyBounds(other, player, scale);
        neighbor.frontSafetySpeed = bounds.frontSafetySpeed; neighbor.rearSafetySpeed = bounds.rearSafetySpeed;
      }
      neighbors.push(neighbor);
    }
    if (player.y < 4) neighbors.push({ z: player.z || 0, speed: -player.vz, length: 4.62,
      lanes: forecastFootprint(player.x, lanes) });
    forecastIndexLanes(neighbors);
    return { occupancy, neighbors, live, gaps: new Map() };
  }
  function forecastRespawn(car, cars, lanes, player, scale, shared, placement) {
    const holder = shared || { index: null };
    const index = holder.index || (holder.index = forecastSpawnIndex(car, cars, lanes, player, scale));
    const candidates = spawnCandidates(player, placement);
    const order = lanes.map((_, i) => i).sort((a, b) => index.occupancy[a] - index.occupancy[b] || Math.abs(a - car.laneIdx) - Math.abs(b - car.laneIdx));
    const length = car.length || 4.62, byLength = index.gaps;
    const key = placement + ':' + length;
    let slots = byLength.get(key);
    if (!slots) {
      slots = candidates.map(z => lanes.map((_, lane) => {
        let gap = Infinity;
        for (const other of index.live) {
          if (!spawnReserves(other, lane, lanes)) continue;
          // Keep the exact original operation order. Splitting the two half
          // lengths can round differently at the 24 m admission boundary.
          gap = Math.min(gap, Math.abs(z - other.mesh.position.z) - (length + spawnLength(other)) / 2);
        }
        return gap;
      }));
      byLength.set(key, slots);
    }
    for (let slot = 0; slot < candidates.length; slot++) {
      const z = candidates[slot];
      for (const lane of order) {
        const atSpawn = { car, z, speed: car.speed, length };
        // Each waiting driver still pays its OWN speed/profile safety check.
        // Only immutable slot geometry is shared, never a failure decision.
        if (slots[slot][lane] >= 24 && forecastSafeAdjacentGap(atSpawn, lane, index.neighbors, scale)) {
          reset(car, lane, lanes, placement); car.mesh.position.z = z;
          holder.index = null; // Newly live car changes every later retry.
          return;
        }
      }
    }
    car.highwayWaitingToSpawn = placement === 'ahead'; car.highwayRecycledBehind = placement === 'incident'; car.highwayPassEligible = false; car.mesh.visible = false;
    car.mesh.position.z = (player.z || 0) + (placement === 'ahead' ? -510 : 510); car.vx = 0;
  }

  function retireBlast(car) {
    car.y = car.blastTimer = car.blastVx = car.blastVy = car.blastVz = 0;
    car.blastVRoll = car.blastVPitch = car.blastVYaw = 0;
    car.mesh.position.y = 0;
    car.mesh.rotation.x = car.mesh.rotation.y = car.mesh.rotation.z = 0;
    car.laneChange = null;
    delete car.recoverHighwayLane;
  }
  function isOffRoad(car, lanes) {
    const halfLane = lanes.length > 1 ? Math.abs(lanes[1] - lanes[0]) / 2 : 2.5;
    // A tumbling body's X extent can come from length/height, not just width.
    // Its enclosing radius keeps the whole body beyond the 30 m pavement plus
    // a 1 m buffer before recycling, regardless of yaw/pitch/roll.
    const lateralMargin = halfLane + bodyRadius(car) + 1;
    return car.mesh.position.x < lanes[0] - lateralMargin || car.mesh.position.x > lanes[lanes.length - 1] + lateralMargin;
  }
  function isOutOfBounds(car, lanes, player = { z: 0 }) {
    if (car.mode !== 'highway') return false;
    const z = player.z || 0, rearLimit = car.highwayRecycledBehind ? 480 : 65;
    return car.mesh.position.z < z - 480 || car.mesh.position.z > z + rearLimit || isOffRoad(car, lanes);
  }
  function respawnBehind(car, cars, lanes, player, scale) {
    if (car.mode !== 'highway') return false;
    car.highwayPassedThisFrame = false;
    delete car.highwayWaitingToSpawn;
    respawn(car, cars, lanes, player, scale);
    return car.highwayWaitingToSpawn === undefined;
  }
  function retrySpawn(car, cars, lanes, player, scale, forecast = false, shared = null) {
    if (car.mode !== 'highway' || car.highwayWaitingToSpawn === undefined) return false;
    const placement = car.highwayWaitingToSpawn ? 'ahead' : car.highwayRecycledBehind ? 'incident' : 'behind';
    delete car.highwayWaitingToSpawn;
    respawn(car, cars, lanes, player, scale, forecast, shared, placement);
    return car.highwayWaitingToSpawn === undefined;
  }
  function respawn(car, cars, lanes, player, scale, forecast = false, shared = null, placement = 'incident') {
    retireBlast(car);
    // Reuse the already-proven exact six-lane retry geometry in the runtime
    // too. Rejected waiting entries stay hidden and do not change occupancy.
    if (forecast || shared) return forecastRespawn(car, cars, lanes, player, scale, shared, placement);
    const candidates = spawnCandidates(player, placement);
    const occupancy = lanes.map((_, lane) => cars.filter(other => other !== car && other.mode === 'highway' && other.highwayWaitingToSpawn === undefined && occupiedLanes(other).includes(lane)).length);
    const order = lanes.map((_, i) => i).sort((a, b) => occupancy[a] - occupancy[b] || Math.abs(a - car.laneIdx) - Math.abs(b - car.laneIdx));
    const neighbors = cars.filter(other => other !== car && other.mode === 'highway' && other.highwayWaitingToSpawn === undefined)
      .map(other => ({
        car: other, z: other.mesh.position.z,
        speed: other.blastTimer > 0 ? blastSpeed(other, player, scale) : other.speed,
        ...(other.blastTimer > 0 ? blastSafetyBounds(other, player, scale) : {}),
        length: spawnLength(other),
        lanes: spawnOccupied(other, lanes)
      }));
    if (player.y < 4) neighbors.push({
      z: player.z || 0, speed: -player.vz, length: 4.62, lanes: footprint(player.x, lanes)
    });
    for (const z of candidates) {
      for (const lane of order) {
        let gap = Infinity;
        for (const other of cars) {
          if (other === car || other.mode !== 'highway' || other.highwayWaitingToSpawn !== undefined) continue;
          // Include both reserved lanes and the actual footprint of a blasted car.
          if (!spawnReserves(other, lane, lanes)) continue;
          gap = Math.min(gap, Math.abs(z - other.mesh.position.z) - ((car.length || 4.62) + spawnLength(other)) / 2);
        }
        const atSpawn = { car, z, speed: car.speed, length: car.length || 4.62 };
        if (gap >= 24 && safeAdjacentGap(atSpawn, lane, neighbors, scale)) {
          reset(car, lane, lanes, placement);
          car.mesh.position.z = z;
          return;
        }
      }
    }
    // Hide a rejected entry instead of materializing inside another vehicle.
    // Retry once a safe gap opens on a later simulation step.
    car.highwayWaitingToSpawn = placement === 'ahead';
    car.highwayRecycledBehind = placement === 'incident';
    car.highwayPassEligible = false;
    car.mesh.visible = false;
    car.mesh.position.z = (player.z || 0) + (placement === 'ahead' ? -510 : 510);
    car.vx = 0;
  }

  function step(cars, player, dt, lanes, scale, forecast = false) {
    const snapshotFor = forecast ? forecastSnapshot : snapshot;
    const leaderForStep = forecast ? forecastLeaderFor : leaderFor;
    const footprintFor = forecast ? forecastFootprint : footprint;
    const adjacentGapFor = forecast ? forecastSafeAdjacentGap : safeAdjacentGap;
    for (const car of cars) car.highwayPassedThisFrame = false;
    if (!(dt > 0)) return;
    initializeSpeeds(cars, lanes, scale, player, forecast);
    // Bound braking/decisions to 60 Hz or finer, including a slow render frame.
    const count = Math.max(1, Math.ceil(dt / (1 / 60) - 1e-8));
    const h = dt / count;
    for (let substep = 0; substep < count; substep++) {
      const live = [];
      const spawnCache = lanes.length === 6 ? { index: null } : null;
      for (const car of cars) {
        if (car.mode !== 'highway') continue;
        if (typeof car.highwayPassEligible !== 'boolean') car.highwayPassEligible =
          car.mesh.position.z < (player.z || 0) - ((car.length || 4.62) + 4.62) / 2;
        // A pre-existing expired blast is a safe fallback. Normal runtime
        // also calls respawnBehind directly at active/destroyed blast expiry.
        const expiredBlast = !(car.blastTimer > 0) && car.recoverHighwayLane;
        const incidentExit = isOffRoad(car, lanes) || (isWreck(car) && isOutOfBounds(car, lanes, player));
        if (car.highwayWaitingToSpawn === undefined && (incidentExit || expiredBlast)) {
          if (spawnCache) spawnCache.index = null;
          respawn(car, cars, lanes, player, scale, forecast, spawnCache);
          if (car.highwayWaitingToSpawn !== undefined) continue;
        }
        if (car.blastTimer > 0) {
          if (spawnCache) spawnCache.index = null;
          car.laneChange = null;
          car.blockedTime = 0;
          car.laneChangeCooldown = profile(car).cooldown;
          car.recoverHighwayLane = true;
          continue;
        }
        if (car.highwayWaitingToSpawn !== undefined) {
          retrySpawn(car, cars, lanes, player, scale, forecast, spawnCache);
          if (car.highwayWaitingToSpawn !== undefined) continue;
        }
        if (car.recoverHighwayLane) {
          if (spawnCache) spawnCache.index = null;
          car.laneIdx = closestLane(car.mesh.position.x, lanes);
          car.targetX = lanes[car.laneIdx];
        }
        car.laneChangeCooldown = Math.max(0, (car.laneChangeCooldown || 0) - h);
        if (spawnCache && !Number.isInteger(car.laneIdx)) spawnCache.index = null;
        live.push(snapshotFor(car, lanes));
      }
      const traffic = live.slice();
      // A low player car occupies every lane swept by its lateral motion during
      // a merge. High flight remains free of road traffic interactions.
      if (player.y < 4) {
        const endX = player.x + (player.vx || 0) * MERGE_SECONDS;
        let occupied;
        if (forecast) {
          let mask = 0;
          const low = Math.min(player.x, endX) - FOOTPRINT_RADIUS, high = Math.max(player.x, endX) + FOOTPRINT_RADIUS;
          for (let i = 0; i < 6; i++) if (lanes[i] >= low && lanes[i] <= high) mask |= 1 << i;
          occupied = forecastMaskLanes[mask];
        } else occupied = lanes.flatMap((x, i) => x >= Math.min(player.x, endX) - FOOTPRINT_RADIUS && x <= Math.max(player.x, endX) + FOOTPRINT_RADIUS ? [i] : []);
        traffic.push({ x: player.x, z: player.z || 0, speed: -player.vz, length: 4.62, lanes: occupied });
      }
      // Keep airborne blast physics separate, but don't merge into a low wreck.
      for (const car of cars) {
        if (car.mode !== 'highway' || !(car.blastTimer > 0) || (car.y || 0) >= 4) continue;
        traffic.push({ z: car.mesh.position.z, speed: blastSpeed(car, player, scale), ...blastSafetyBounds(car, player, scale), length: car.length || 4.62,
          lanes: footprintFor(car.mesh.position.x, lanes) });
      }

      if (forecast) forecastIndexLanes(traffic);

      // A shockwave may leave a car off-center. Rejoin only after checking
      // the destination, while reserving every lane under its actual footprint.
      for (const own of live) {
        const car = own.car;
        if (!car.recoverHighwayLane || !adjacentGapFor(own, car.laneIdx, traffic, scale)) continue;
        car.laneChange = { from: car.laneIdx, to: car.laneIdx, startX: own.x, elapsed: 0 };
        delete car.recoverHighwayLane;
      }
      const requests = [];
      for (const own of live) {
        const car = own.car;
        const leader = leaderForStep(own, car.laneIdx, traffic);
        const blocked = leader && leader.gap > MIN_GAP && leader.gap < lookAhead(own, scale) && own.desiredSpeed - leader.speed >= profile(car).advantage;
        car.blockedTime = blocked ? (car.blockedTime || 0) + h : 0;
        if (blocked && !car.recoverHighwayLane && !car.laneChange && car.laneChangeCooldown === 0 && car.blockedTime >= profile(car).reaction) requests.push({ own, leader });
      }
      requests.sort((a, b) => a.leader.gap - b.leader.gap);
      for (const { own, leader } of requests) {
        const car = own.car;
        const options = [car.laneIdx - 1, car.laneIdx + 1].filter(lane => lane >= 0 && lane < lanes.length)
          .map(lane => {
            const targetLeader = leaderForStep(own, lane, traffic);
            const usefulGap = MIN_GAP + own.desiredSpeed * scale * profile(car).headway;
            const flow = targetLeader ? Math.min(own.desiredSpeed, targetLeader.speed + Math.max(0, targetLeader.gap - usefulGap) / (scale * 3)) : own.desiredSpeed;
            const useful = !targetLeader || targetLeader.speed - leader.speed >= profile(car).advantage || targetLeader.gap - leader.gap > (car.driverType === 'racer' ? 20 : 30);
            return { lane, flow, useful, gap: targetLeader ? targetLeader.gap : Infinity };
          }).filter(option => option.useful && option.flow - leader.speed >= profile(car).advantage && safeAdjacentGap(own, option.lane, traffic, scale))
          .sort((a, b) => b.flow - a.flow || b.gap - a.gap);
        if (!options.length) continue;
        const to = options[0].lane;
        car.laneChange = { from: car.laneIdx, to, startX: own.x, elapsed: 0 };
        car.targetX = lanes[to];
        car.blockedTime = 0;
        own.lanes = [car.laneIdx, to]; // Reservation is visible to every later request.
        // Rebuild immediately in original ordinal order before the next
        // request sees this reservation. Never reuse a pre-approval index.
        if (forecast) forecastIndexLanes(traffic);
      }

      const plans = live.map(own => {
        const driver = profile(own.car);
        let acceleration = driver.acceleration * (1 - Math.pow(own.speed / Math.max(1, own.desiredSpeed), 4));
        for (const lane of own.lanes) {
          const leader = leaderForStep(own, lane, traffic);
          if (!leader) continue;
          const v = Math.max(0, own.speed) * scale;
          const closing = (own.speed - leader.speed) * scale;
          const headway = MIN_GAP + Math.max(0, v * driver.headway + v * closing / (2 * Math.sqrt(driver.acceleration * 4.5) * scale));
          acceleration = Math.min(acceleration, driver.acceleration * (1 - Math.pow(own.speed / Math.max(1, own.desiredSpeed), 4) - Math.pow(headway / Math.max(0.1, leader.gap), 2)));
        }
        return { own, speed: clamp(own.speed + clamp(acceleration, -MAX_BRAKE, driver.acceleration) * h, 0, own.desiredSpeed) };
      });
      for (const { own, speed } of plans) {
        const car = own.car;
        car.speed = speed;
        car.vz = -speed;
        car.mesh.position.z += (-player.vz - (own.speed + speed) / 2) * scale * h;
        let lateralSpeed = 0;
        if (car.laneChange) {
          const change = car.laneChange;
          const mergeSeconds = profile(car).merge;
          change.elapsed = Math.min(mergeSeconds, change.elapsed + h);
          const t = change.elapsed / mergeSeconds;
          const blend = t * t * t * (10 + t * (-15 + 6 * t));
          const distance = lanes[change.to] - change.startX;
          car.mesh.position.x = change.startX + distance * blend;
          lateralSpeed = distance * 30 * t * t * (1 - t) * (1 - t) / mergeSeconds;
          if (t >= 1) {
            car.laneIdx = change.to;
            car.laneChange = null;
            car.laneChangeCooldown = profile(car).cooldown;
          }
        }
        car.vx = lateralSpeed; // Highway lateral motion is unscaled, like state.vx.
        car.mesh.rotation.y = -clamp(Math.atan2(lateralSpeed, Math.max(8, speed * scale)), -0.14, 0.14);
        car.mesh.rotation.z = -clamp(lateralSpeed * 0.018, -0.06, 0.06);
        const playerZ = player.z || 0;
        // A rear entry is not a player overtake. It becomes eligible only
        // after actually returning fully in front of the player, not a wrap.
        if (car.mesh.position.z < playerZ - ((car.length || 4.62) + 4.62) / 2) {
          car.highwayRecycledBehind = false;
          car.highwayPassEligible = true;
        }
        const rearLimit = car.highwayRecycledBehind ? 480 : 65;
        if (car.mesh.position.z > playerZ + rearLimit) {
          if (!car.highwayRecycledBehind && car.highwayPassEligible && own.z <= playerZ + 65) car.highwayPassedThisFrame = true;
          respawn(car, cars, lanes, player, scale, forecast, null, 'ahead');
        } else if (car.mesh.position.z < playerZ - 480) respawn(car, cars, lanes, player, scale, forecast, null, 'behind');
      }
    }
  }
  function forecastStep(cars, player, dt, lanes, scale) {
    // The six-lane cache is an allocation optimization, never an approximation
    // for another road layout. Other lane counts retain the ordinary path.
    return step(cars, player, dt, lanes, scale, lanes.length === 6);
  }
  return Object.freeze({ step, forecastStep, createDrivers, initializeSpeeds, respawnBehind, retrySpawn, isOutOfBounds });
})();

function receivers(state,external,events){
  const unknown=(receiver,method)=>stop('unknown-visual-call',{receiver,method:String(method)});
  const known=(receiver,methods)=>new Proxy(Object.freeze(methods),{get(target,key){
    if(!Object.hasOwn(target,key))return (...args)=>unknown(receiver,key);
    return target[key];
  }});
  const sound=known('sound',{
    init(){if(external.audioInitialized!==true)stop('audio-init-may-consume-shared-rng');events.push({kind:'audio-init-already-initialized'});},
    beep(...args){events.push({kind:'beep',args});},
    speakAlert(...args){events.push({kind:'speakAlert',args});}
  });
  const document=known('document',{getElementById(id){
    if(id!=='key-n')return unknown('document.getElementById',id);
    return {classList:known('key-n.classList',{remove(token){
      if(token!=='active')return unknown('key-n.classList.remove',token);
      events.push({kind:'remove-key-n-active'});
    }})};
  }});
  const renderBannerText=()=>events.push({kind:'renderBannerText',type:state.bannerType,timer:state.bannerTimer});
  return {sound,document,renderBannerText};
}
function numeric(request,jumpOnly){
  const state=request.state,trafficCars=request.cars,keys=request.keys;
  const dt=1/60,currentMap='highway',weatherIndex=0,cityBuildings=[];
  const input=request.input,external=request.external,events=[];
  const {sound,document,renderBannerText}=receivers(state,external,events);
  const frontWheelSteerGroups=Object.freeze([]);
  const window=Object.freeze({RoadsterDemo:Object.freeze({isActive:()=>external.active,isBusy:()=>external.busy,
    isRequestingJump:()=>external.requestingJump===true,input:()=>input,
    jumpHeight:()=>request.jumpHeight,jumpGraceSeconds:()=>request.jumpGraceSeconds})});
  const globalThis=Object.freeze({window});
  const triggerPhysicsCollision=(...args)=>stop('physics-impact-request',{args},'collision');
function showBanner(type, duration = 2.5) {
  state.bannerType = type;
  state.bannerTimer = duration;
  renderBannerText();
}


function wrapAnglePi(rad) {
  return ((rad + Math.PI) % (Math.PI * 2) + (Math.PI * 2)) % (Math.PI * 2) - Math.PI;
}

// City contact geometry follows the rendered long/short axes, not a fixed
// north/south proxy. The coastal/highway contact implementations stay separate.
function cityContactBody(pose,length=4.62,width=1.96,height=1.25,bounds=null,order='XYZ') {
  const pitch=pose.pitch||0,yaw=pose.yaw||0,roll=pose.roll||0,a=Math.cos(pitch),b=Math.sin(pitch),c=Math.cos(yaw),d=Math.sin(yaw),e=Math.cos(roll),f=Math.sin(roll);
  // The player attitude group is YXZ; NPC meshes use Three's default XYZ.
  // Match both full rendered rotations, not only their heading on the ground.
  const axes=order==='YXZ'?[[c*e+d*b*f,a*f,-d*e+c*b*f],[-c*f+d*b*e,a*e,d*f+c*b*e],[a*d,-b,a*c]]:[[c*e,a*f+b*e*d,b*f-a*e*d],[-c*f,a*e-b*f*d,b*e+a*f*d],[d,-b*c,a*c]];
  const half=bounds?[(bounds.maxX-bounds.minX)/2,(bounds.maxY-bounds.minY)/2,(bounds.maxZ-bounds.minZ)/2]:[width/2,height/2,length/2];
  const local=bounds?[(bounds.minX+bounds.maxX)/2,(bounds.minY+bounds.maxY)/2,(bounds.minZ+bounds.maxZ)/2]:[0,height/2,0];
  const center=[pose.x||0,pose.y||0,pose.z||0];for(let i=0;i<3;i++)for(let j=0;j<3;j++)center[j]+=axes[i][j]*local[i];
  const body={x:center[0],y:center[1],z:center[2],center,half,axes,horizontal:[]};
  body.ry=cityContactProjection(body,[0,1,0]);body.rx=cityContactProjection(body,[1,0,0]);body.rz=cityContactProjection(body,[0,0,1]);
  body.horizontal.push([1,0],[0,1]);for(const edge of axes){const n=Math.hypot(edge[0],edge[2]);if(n>1e-10)body.horizontal.push([edge[2]/n,-edge[0]/n]);}
  return body;
}
function cityContactProjection(body,n){let radius=0;for(let i=0;i<3;i++)radius+=body.half[i]*Math.abs(body.axes[i][0]*n[0]+body.axes[i][1]*n[1]+body.axes[i][2]*n[2]);return radius;}
function cityContactRadius(body,x,z){return cityContactProjection(body,[x,0,z]);}
let cityPlayerBoundsSource=null,cityPlayerBounds=null,cityPlayerPoseCache=null,cityPlayerBodyCache=null;
function cityPlayerBody(pose) {
  const model=globalThis.window?.RoadsterVehicle?.getPreviewModel?.();
  if(model&&model!==cityPlayerBoundsSource&&THREE.Box3){
    model.updateWorldMatrix(true,true);const bounds=new THREE.Box3();
    model.traverseVisible(part=>{if(!part.geometry||part.userData.shadowProxy)return;const materials=Array.isArray(part.material)?part.material:[part.material];if(materials.every(mat=>!mat||mat.colorWrite===false||mat.visible===false||mat.transparent&&mat.opacity===0))return;part.geometry.computeBoundingBox();bounds.union(part.geometry.boundingBox.clone().applyMatrix4(part.matrixWorld));});
    if(!bounds.isEmpty()){cityPlayerBounds={minX:bounds.min.x,minY:bounds.min.y,minZ:bounds.min.z,maxX:bounds.max.x,maxY:bounds.max.y,maxZ:bounds.max.z};cityPlayerBoundsSource=model;cityPlayerPoseCache=null;}
  }
  const q=cityPlayerPoseCache;
  if(q&&q.x===pose.x&&q.y===pose.y&&q.z===pose.z&&q.yaw===pose.yaw&&q.pitch===pose.pitch&&q.roll===pose.roll)return cityPlayerBodyCache;
  cityPlayerPoseCache={x:pose.x,y:pose.y,z:pose.z,yaw:pose.yaw,pitch:pose.pitch,roll:pose.roll};
  cityPlayerBodyCache=cityContactBody(pose,4.62,1.96,1.25,cityPlayerBounds,'YXZ');return cityPlayerBodyCache;
}
function cityTrafficBody(car) {
  const p=car.mesh.position,r=car.mesh.rotation||{},b=car.mesh.userData?.cityContactBounds||globalThis.window?.RoadsterTrafficAssets?.cityContactBounds?.(car.mesh);
  return cityContactBody({x:p.x,y:p.y,z:p.z,yaw:r.y,pitch:r.x,roll:r.z},car.length,car.width||car.mesh.userData.width||1.96,car.height,b);
}
function cityHorizontalContact(a,b){
  for(const[x,z]of[...a.horizontal,...b.horizontal])if(Math.abs((a.x-b.x)*x+(a.z-b.z)*z)>=cityContactRadius(a,x,z)+cityContactRadius(b,x,z)-1e-8)return false;
  return true;
}
function cityContactInterval(a,b,previousA=a,previousB=b) {
  let enter=0,exit=1;const axes=[...a.axes,...b.axes];
  for(const u of a.axes)for(const v of b.axes){const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];if(n[0]*n[0]+n[1]*n[1]+n[2]*n[2]>1e-16)axes.push(n);}
  for(const n of axes){
    const radius=cityContactProjection(a,n)+cityContactProjection(b,n);let start=0,finish=0;
    for(let j=0;j<3;j++){start+=(previousB.center[j]-previousA.center[j])*n[j];finish+=(b.center[j]-a.center[j])*n[j];}
    const delta=finish-start;if(Math.abs(delta)<1e-12){if(Math.abs(start)>=radius-1e-8)return null;}
    else{const p=(-radius-start)/delta,q=(radius-start)/delta;enter=Math.max(enter,Math.min(p,q));exit=Math.min(exit,Math.max(p,q));if(enter>exit)return null;}
  }
  return enter<=exit&&enter<=1&&exit>=0?Math.max(0,enter):null;
}
function cityContactDetails(a,b){
  const axes=[...a.axes,...b.axes];for(const u of a.axes)for(const v of b.axes){const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];if(Math.hypot(...n)>1e-8)axes.push(n);}
  let result=null;for(const raw of axes){const length=Math.hypot(...raw),n=raw.map(v=>v/length);let offset=0;for(let j=0;j<3;j++)offset+=(a.center[j]-b.center[j])*n[j];const depth=cityContactProjection(a,n)+cityContactProjection(b,n)-Math.abs(offset);if(depth<=1e-8)return null;if(!result||depth<result.depth){const sign=offset<0?-1:1;result={depth,x:n[0]*sign,y:n[1]*sign,z:n[2]*sign};}}return result;
}
// Coastal broad AABBs are rejection-only. The final certificate is the real
// YXZ player/NPC OBB, with conservative advancement through their full poses.
// Coast-only landing uses the rotated, frozen player collider, not merely its
// upright root anchor. Every accepted floor still belongs to a finite real
// surface beneath the root; a bridge above the previous root is never selected.
function coastBodyGroundClearance(pose,surface) {
  const body=cityPlayerBody({...pose,y:pose.y-(pose.suspensionSquash||0)-(pose.aeroSquash||0)}),n=surface.normal;
  return(n.x*(body.x-pose.x)+n.y*(body.y-surface.height)+n.z*(body.z-pose.z)-cityContactProjection(body,[n.x,n.y,n.z]))/n.y;
}

function coastBodyGroundLanding(world,previous,next) {
  const start=previous.contactPose||previous;
  const finish={...next,y:next.y-(next.suspensionSquash||0)-(next.aeroSquash||0)};
  const delta={};for(const key of ['pitch','yaw','roll'])delta[key]=wrapAnglePi((finish[key]||0)-(start[key]||0));
  const steps=Math.max(1,Math.ceil(Math.hypot(finish.x-start.x,finish.y-start.y,finish.z-start.z)),Math.ceil((Math.abs(delta.pitch)+Math.abs(delta.yaw)+Math.abs(delta.roll))/.04));
  const at=t=>({x:start.x+(finish.x-start.x)*t,y:start.y+(finish.y-start.y)*t,z:start.z+(finish.z-start.z)*t,pitch:(start.pitch||0)+delta.pitch*t,yaw:(start.yaw||0)+delta.yaw*t,roll:(start.roll||0)+delta.roll*t});
  const corners=pose=>{const body=cityPlayerBody(pose),points=[];for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){const p={x:body.x,y:body.y,z:body.z};for(let axis=0;axis<3;axis++){const amount=[x,y,z][axis]*body.half[axis];p.x+=body.axes[axis][0]*amount;p.y+=body.axes[axis][1]*amount;p.z+=body.axes[axis][2]*amount;}points.push(p);}return points;};
  let old=corners(at(0));
  for(let step=1;step<=steps;step++){
    const points=corners(at(step/steps));let first=null;
    for(let vertex=0;vertex<points.length;vertex++){
      const a=old[vertex],b=points[vertex],hit=world.network.sweepLanding(a,b);
      const options=hit?[hit]:world.network.candidates(a.x,a.z).filter(s=>s.solid&&a.y<s.height&&b.y-a.y+(s.normal.x*(b.x-a.x)+s.normal.z*(b.z-a.z))/s.normal.y< -1e-8).map(s=>({...s,t:0}));
      for(const surface of options){
        const t=(step-1+surface.t)/steps,root={x:previous.x+(next.x-previous.x)*t,z:previous.z+(next.z-previous.z)*t};
        const plane=(x,z)=>surface.triangle?surface.triangle.a.y-(surface.normal.x*(x-surface.triangle.a.x)+surface.normal.z*(z-surface.triangle.a.z))/surface.normal.y:surface.height;
        if(previous.y<plane(previous.x,previous.z)-.025)continue;
        const height=plane(root.x,root.z),finite=world.network.candidates(root.x,root.z).find(s=>s.solid&&s.id===surface.id&&Math.abs(s.height-height)<.03);
        if(!finite)continue;
        const contact={...finite,t,x:root.x,z:root.z,height:finite.height,bodyContact:true};
        if(!first||contact.t<first.t-1e-8||(Math.abs(contact.t-first.t)<1e-8&&contact.road))first=contact;
      }
    }
    if(first)return first;old=points;
  }
  return null;
}

function coastTrafficBody(car,pose) {
  const b=car.mesh.userData?.cityContactBounds||globalThis.window?.RoadsterTrafficAssets?.cityContactBounds?.(car.mesh);
  return cityContactBody(pose,car.length,car.width||car.mesh.userData?.width||1.96,car.height,b,'YXZ');
}
function coastContactSeparation(a,b){
  const axes=[...a.axes,...b.axes];for(const u of a.axes)for(const v of b.axes){const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];if(Math.hypot(...n)>1e-8)axes.push(n);}
  let result=null;for(const raw of axes){const length=Math.hypot(...raw),n=raw.map(v=>v/length);let offset=0;for(let j=0;j<3;j++)offset+=(a.center[j]-b.center[j])*n[j];const gap=Math.abs(offset)-cityContactProjection(a,n)-cityContactProjection(b,n);if(!result||gap>result.gap){const sign=offset<0?-1:1;result={gap,depth:Math.max(0,-gap),x:n[0]*sign,y:n[1]*sign,z:n[2]*sign};}}return result;
}
function coastVehicleContact(previous,next,oldCar,car){
  const p=car.mesh.position,r=car.mesh.rotation||{},npc={x:p.x,y:p.y||0,z:p.z,yaw:r.y||0,pitch:r.x||0,roll:r.z||0};
  const interpolate=(a,b,t)=>{const q={};for(const k of['x','y','z'])q[k]=(a[k]||0)+((b[k]||0)-(a[k]||0))*t;for(const k of['pitch','yaw','roll'])q[k]=(a[k]||0)+wrapAnglePi((b[k]||0)-(a[k]||0))*t;return q;};
  const model=globalThis.window?.RoadsterVehicle?.getPreviewModel?.();if(model&&model!==cityPlayerBoundsSource&&THREE.Box3)cityPlayerBody(previous);
  const npcBounds=car.mesh.userData?.cityContactBounds||globalThis.window?.RoadsterTrafficAssets?.cityContactBounds?.(car.mesh);
  const rootRadius=(bounds,length,width,height)=>bounds?Math.hypot(...['X','Y','Z'].map(k=>Math.max(Math.abs(bounds['min'+k]),Math.abs(bounds['max'+k])))):Math.hypot(width/2,height,length/2);
  // Root-centered swept spheres reject far traffic before constructing any
  // pose OBBs/SAT arrays. The radii contain every native collider vertex.
  const ra=rootRadius(cityPlayerBounds,4.62,1.96,1.25),rb=rootRadius(npcBounds,car.length,car.width||1.96,car.height);
  const d0=[(previous.x||0)-(oldCar.x||0),(previous.y||0)-(oldCar.y||0),(previous.z||0)-(oldCar.z||0)],dv=[next.x-previous.x-(npc.x-oldCar.x),next.y-previous.y-(npc.y-(oldCar.y||0)),next.z-previous.z-(npc.z-oldCar.z)],v2=dv.reduce((sum,v)=>sum+v*v,0),near=v2?Math.max(0,Math.min(1,-d0.reduce((sum,v,i)=>sum+v*dv[i],0)/v2)):0;
  if(Math.hypot(...d0.map((v,i)=>v+dv[i]*near))>ra+rb)return null;
  const a0=cityPlayerBody(previous),b0=coastTrafficBody(car,oldCar),a1=cityPlayerBody(next),b1=coastTrafficBody(car,npc);
  const angle=(a,b)=>['pitch','yaw','roll'].reduce((s,k)=>s+Math.abs(wrapAnglePi((b[k]||0)-(a[k]||0))),0);
  const angularBound=angle(previous,next)*ra+angle(oldCar,npc)*rb;
  const angularProjectionBound=(from,to,radius,n)=>{
    const yaw=Math.abs(wrapAnglePi((to.yaw||0)-(from.yaw||0))),pitch=Math.abs(wrapAnglePi((to.pitch||0)-(from.pitch||0))),roll=Math.abs(wrapAnglePi((to.roll||0)-(from.roll||0))),cross=axis=>Math.hypot(axis[1]*n[2]-axis[2]*n[1],axis[2]*n[0]-axis[0]*n[2],axis[0]*n[1]-axis[1]*n[0]);
    const pitchAxis=p=>[Math.cos(p.yaw||0),0,-Math.sin(p.yaw||0)],rollAxis=p=>[Math.cos(p.pitch||0)*Math.sin(p.yaw||0),-Math.sin(p.pitch||0),Math.cos(p.pitch||0)*Math.cos(p.yaw||0)];
    // YXZ: yaw rotates about world Y, pitch about yawed X, roll about
    // yawed/pitched Z. Bound their projection changes, not a whole sphere.
    // A pure yaw cannot close even a tiny positive vertical deck gap.
    return radius*(yaw*Math.hypot(n[0],n[2])+pitch*Math.min(1,Math.max(cross(pitchAxis(from)),cross(pitchAxis(to)))+yaw)+roll*Math.min(1,Math.max(cross(rollAxis(from)),cross(rollAxis(to)))+yaw+pitch));
  };
  const directionalBound=c=>{const n=[c.x,c.y,c.z];return Math.abs(dv[0]*c.x+dv[1]*c.y+dv[2]*c.z)+angularProjectionBound(previous,next,ra,n)+angularProjectionBound(oldCar,npc,rb,n);};
  const evaluate=t=>{const player=interpolate(previous,next,t),other=interpolate(oldCar,npc,t);return {player,other,contact:coastContactSeparation(cityPlayerBody(player),coastTrafficBody(car,other))};};
  const certify=(t,{player,other,contact})=>{
      // Velocity at the contacting feature, not total angular speed. Keeping
      // its local coordinates fixed avoids a derivative of the support-map
      // corner switching, which would fabricate a tangential impact.
      const angularNormal=(body,pose,from,to,side)=>{
        const n=[contact.x,contact.y,contact.z],offset=body.center.map((v,i)=>v-(pose[['x','y','z'][i]]||0)),local=body.axes.map((axis,i)=>axis.reduce((sum,v,j)=>sum+v*offset[j],0)+body.half[i]*Math.sign(axis.reduce((sum,v,j)=>sum+v*n[j],0))*side);
        const lo=Math.max(0,t-1e-4),hi=Math.min(1,t+1e-4),at=q=>{const axes=cityContactBody(interpolate(from,to,q),1,1,1,null,'YXZ').axes;return axes.reduce((sum,axis,i)=>sum+local[i]*axis.reduce((v,x,j)=>v+x*n[j],0),0);};
        return hi>lo?(at(hi)-at(lo))/(hi-lo):0;
      };
      const angularClosingPerFraction=angularNormal(coastTrafficBody(car,other),other,oldCar,npc,1)-angularNormal(cityPlayerBody(player),player,previous,next,-1);
      return {...contact,t,player,npc:other,angularClosingPerFraction};
  };
  // Constant orientations have an exact swept SAT solution. In particular a
  // long tangential chord must not exhaust a conservative-advance budget.
  if(angularBound<1e-12){const t=cityContactInterval(a1,b1,a0,b0);return t===null?null:certify(t,evaluate(t));}
  let t=0;for(let iteration=0;iteration<96;iteration++){
    const q=evaluate(t),c=q.contact;if(c.gap<=1e-7)return certify(t,q);
    const bound=directionalBound(c);if(bound<1e-12)return null;
    const step=c.gap/bound*.9;if(t+step>1)return null;t+=step;
  }
  // Rare rotating/grazing fallback: reject temporal intervals only when a
  // separating plane certifies all their poses clear. Search left-to-right,
  // never reinterpret an iteration limit as proof of no contact.
  const search=(lo,hi,depth)=>{const mid=(lo+hi)/2,q=evaluate(mid),c=q.contact,bound=directionalBound(c);if(c.gap>bound*(hi-lo)/2+1e-7)return null;if(depth>=36||bound*(hi-lo)<1e-7){for(const at of[lo,mid,hi]){const r=evaluate(at);if(r.contact.gap<=1e-7)return certify(at,r);}return null;}return search(lo,mid,depth+1)||search(mid,hi,depth+1);};
  return search(t,1,0);
}

// A city seam is a respawn, not continuous travel. Wait at the old seam if the
// opposite end is occupied; never teleport a solid vehicle into the player.
function advanceCityTraffic(car,dt){
  const p=car.mesh.position,limit=CITY_HALF_BOUND-10,pending=car.cityWrapPending;
  const vx=pending?pending.vx:car.vx,vz=pending?pending.vz:car.vz;
  const next=pending?pending.target:{x:p.x+vx*CITY_WORLD_SPEED_SCALE*dt,z:p.z+vz*CITY_WORLD_SPEED_SCALE*dt};
  const wraps=pending||Math.abs(next.x)>limit||Math.abs(next.z)>limit;
  if(!wraps){p.x=next.x;p.z=next.z;return;}
  const target=pending?next:{x:next.x>limit?-limit:next.x< -limit?limit:next.x,z:next.z>limit?-limit:next.z< -limit?limit:next.z};
  const npc=cityTrafficBody(car),player=cityPlayerBody(state),verticalClear=body=>body.y-body.ry>npc.y+npc.ry+2||npc.y-npc.ry>body.y+body.ry+2;
  const playerClear=Math.hypot(target.x-state.x,target.z-state.z)>Math.max(80,Math.hypot(state.vx,state.vz)*1.5+8)||verticalClear(player);
  const trafficClear=trafficCars.every(other=>other===car||other.mesh.visible===false||Math.hypot(target.x-other.mesh.position.x,target.z-other.mesh.position.z)>20||verticalClear(cityTrafficBody(other)));
  if(!playerClear||!trafficClear){
    if(!pending)car.cityWrapPending={target,vx,vz,speed:car.speed};
    p.x=Math.max(-limit,Math.min(limit,p.x));p.z=Math.max(-limit,Math.min(limit,p.z));car.vx=car.vz=car.speed=0;return;
  }
  p.x=target.x;p.z=target.z;if(pending){car.vx=pending.vx;car.vz=pending.vz;car.speed=pending.speed;}car.cityWrapPending=null;
}

// Near/far precision must never clip the approved car in a close external
// view. Only cap the requested near plane; geometry/materials/zoom stay intact.
function vehicleSafeCameraNear(requested,camera,pose){
  if(!camera.matrixWorld?.elements||typeof camera.updateMatrixWorld!=='function')return requested;
  camera.updateMatrixWorld(true);const m=camera.matrixWorld.elements,n=[-m[8],-m[9],-m[10]],body=cityPlayerBody(pose);
  const nearest=(body.x-camera.position.x)*n[0]+(body.y-camera.position.y)*n[1]+(body.z-camera.position.z)*n[2]-cityContactProjection(body,n);
  return Math.min(requested,Math.max(.08,nearest-.05));
}

// Static 64 m buckets bound broad-phase work as the district gets denser.
// Reuse the candidate array until the vehicle crosses a bucket boundary; no
// scene traversal, instance upload or city-wide SAT scan per physics substep.
let cityBuildingGridSource=null,cityBuildingGridLength=-1,cityBuildingGrid=null,cityBuildingQueryKey='',cityBuildingQuery=[];
function cityNearbyBuildings(pose){
  if(cityBuildingGridSource!==cityBuildings||cityBuildingGridLength!==cityBuildings.length){
    cityBuildingGridSource=cityBuildings;cityBuildingGridLength=cityBuildings.length;cityBuildingGrid=new Map();cityBuildingQueryKey='';
    for(const b of cityBuildings)for(let x=Math.floor(b.minX/64);x<=Math.floor(b.maxX/64);x++)for(let z=Math.floor(b.minZ/64);z<=Math.floor(b.maxZ/64);z++){const key=x+','+z,list=cityBuildingGrid.get(key)||[];list.push(b);cityBuildingGrid.set(key,list);}
  }
  const body=cityPlayerBody(pose),x0=Math.floor((body.x-body.rx)/64),x1=Math.floor((body.x+body.rx)/64),z0=Math.floor((body.z-body.rz)/64),z1=Math.floor((body.z+body.rz)/64),key=x0+','+x1+','+z0+','+z1;
  if(key!==cityBuildingQueryKey){const found=new Set();for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)for(const b of cityBuildingGrid.get(x+','+z)||[])found.add(b);cityBuildingQuery=[...found];cityBuildingQueryKey=key;}
  return cityBuildingQuery;
}
function cityTouchesBuilding(pose,box) {
  const body=cityPlayerBody(pose);
  // Cheap broad phase rejects virtually all city blocks without arrays/SAT work.
  if(body.x+body.rx<=box.minX||body.x-body.rx>=box.maxX||body.z+body.rz<=box.minZ||body.z-body.rz>=box.maxZ)return false;
  const dx=body.x-(box.minX+box.maxX)/2,dz=body.z-(box.minZ+box.maxZ)/2,hx=(box.maxX-box.minX)/2,hz=(box.maxZ-box.minZ)/2;
  for(const[x,z]of body.horizontal)if(Math.abs(dx*x+dz*z)>=cityContactRadius(body,x,z)+hx*Math.abs(x)+hz*Math.abs(z)-1e-8)return false;
  return true;
}
// Roof support is the actual OBB slice at the vehicle root/tire plane, not
// its whole XZ shadow. A pitched nose can project over a roof while all of it
// remains above that roof and the tires are still outside the building.
let cityRoofSliceBody=null,cityRoofSlice=null;
function cityTouchesRoof(pose,box){
  if(!cityTouchesBuilding(pose,box))return false;
  const body=cityPlayerBody(pose);
  if(body!==cityRoofSliceBody){
    const vertices=[],points=[];for(let bits=0;bits<8;bits++){const v=body.center.slice();for(let axis=0;axis<3;axis++)for(let k=0;k<3;k++)v[k]+=body.axes[axis][k]*body.half[axis]*(bits&(1<<axis)?1:-1);vertices.push(v);}
    const add=v=>{if(!points.some(p=>Math.abs(p[0]-v[0])<1e-8&&Math.abs(p[1]-v[2])<1e-8))points.push([v[0],v[2]]);};
    for(let i=0;i<8;i++){const a=vertices[i];if(Math.abs(a[1]-pose.y)<1e-7)add(a);for(let axis=0;axis<3;axis++){const j=i^(1<<axis);if(j<i)continue;const b=vertices[j],d=b[1]-a[1];if(Math.abs(d)<1e-12)continue;const t=(pose.y-a[1])/d;if(t>0&&t<1)add(a.map((v,k)=>v+(b[k]-v)*t));}}
    if(points.length>=3){const center=points.reduce((a,p)=>[a[0]+p[0]/points.length,a[1]+p[1]/points.length],[0,0]);points.sort((a,b)=>Math.atan2(a[1]-center[1],a[0]-center[0])-Math.atan2(b[1]-center[1],b[0]-center[0]));}
    cityRoofSliceBody=body;cityRoofSlice=points;
  }
  const p=cityRoofSlice;if(p.length<3)return false;
  const axes=[[1,0],[0,1]];for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length],dx=q[0]-p[i][0],dz=q[1]-p[i][1],length=Math.hypot(dx,dz);if(length>1e-8)axes.push([-dz/length,dx/length]);}
  for(const[x,z]of axes){let min=Infinity,max=-Infinity;for(const q of p){const n=q[0]*x+q[1]*z;min=Math.min(min,n);max=Math.max(max,n);}const c=(box.minX+box.maxX)/2*x+(box.minZ+box.maxZ)/2*z,r=(box.maxX-box.minX)/2*Math.abs(x)+(box.maxZ-box.minZ)/2*Math.abs(z);if(max<c-r-1e-7||min>c+r+1e-7)return false;}
  return true;
}
function cityCanLandOnRoof(pose,box){
  if(!cityTouchesRoof(pose,box))return false;
  const minY=box.minY||0,solid=cityContactBody({x:(box.minX+box.maxX)/2,y:minY,z:(box.minZ+box.maxZ)/2},box.maxZ-box.minZ,box.maxX-box.minX,box.height-minY+.002);
  return cityContactInterval(cityPlayerBody(pose),solid)!==null;
}
function cityBuildingContact(pose,box) {
  const body=cityPlayerBody(pose);
  const minY=box.minY||0,solid=cityContactBody({x:(box.minX+box.maxX)/2,y:minY,z:(box.minZ+box.maxZ)/2},box.maxZ-box.minZ,box.maxX-box.minX,box.height-minY);
  // A pitched nose may project over a roof while every actual part clears it.
  // Roof support queries stay separate; only a real 3D wall overlap may damage.
  if(cityContactInterval(body,solid)===null)return null;
  const dx=body.x-(box.minX+box.maxX)/2,dz=body.z-(box.minZ+box.maxZ)/2,hx=(box.maxX-box.minX)/2,hz=(box.maxZ-box.minZ)/2;let result=null;
  for(const[x,z]of body.horizontal){const offset=dx*x+dz*z,depth=cityContactRadius(body,x,z)+hx*Math.abs(x)+hz*Math.abs(z)-Math.abs(offset);if(depth<=1e-8)return null;if(!result||depth<result.depth){const sign=offset<0?-1:1;result={depth,x:x*sign,z:z*sign};}}
  return result;
}
function cityVisibleBoundaryHit(previous,next) {
  const a=cityPlayerBody(next),old=cityPlayerBody(previous),half=CITY_HALF_BOUND;
  let best=null;
  for(const axis of['x','z'])for(const sign of[-1,1]){
    // Same45m wall and0.6m cap as world.js, no infinite collision plane above it.
    const wall=cityContactBody({x:axis==='x'?sign*half:0,z:axis==='z'?sign*half:0,y:0},axis==='x'?half*2:2,axis==='x'?2:half*2,45.3);
    const t=cityContactInterval(a,wall,old,wall);if(t!==null&&(!best||t<best.t))best={t,axis,sign,normal:old.center[axis==='x'?0:2]<sign*half?-1:1};
  }
  return best;
}

// Retro thrust is bounded by the existing 80 kN cold-gas package, rather than
// increasing tire braking without limit. 200-240 km/h smoothstep avoids a kick
// at the threshold and feathers the shared tank use with exactly the same duty.
const RETRO_BRAKE_START_MPS = 200 / 3.6;
const RETRO_BRAKE_FULL_MPS = 240 / 3.6;
const RETRO_BRAKE_FORCE_N = 80000;
const RETRO_BRAKE_BURN_PER_SECOND = 0.55;

const STANDARD_EV_MAX_MPS = 200 / 3.6;
const STANDARD_EV_OVERSPEED_COAST_FACTOR = 1.3;
const PASSIVE_AERO_DRAG_PER_METER = 0.00012;

function getAirCoastSpeed(speedMps, dt) {
  // Keep the existing ground aerodynamic curve, without tire rolling drag.
  // Exact solution of dv/dt = -k*v²: no stall brake and no render-FPS bias.
  return speedMps / (1 + PASSIVE_AERO_DRAG_PER_METER * speedMps * dt);
}

// The tactical O hop keeps its launch vector briefly; established flight then
// regains the earlier, more responsive handling. Integrate smoothstep exactly
// across frame boundaries so a low-FPS frame cannot skip the takeoff grace.
const JUMP_INERTIA_GRACE_SECONDS = 0.25;
const JUMP_INERTIA_BLEND_SECONDS = 0.60;

function advanceAirHandling(dt, isAirborne) {
  if (!isAirborne) {
    state.jumpInertiaSeconds = null;
    state.jumpInertiaGraceSeconds = null;
    return 0;
  }
  if (!Number.isFinite(state.jumpInertiaSeconds)) return dt;
  // A finite demo hop may retain its paid launch vector through its planned arc.
  // Manual O and ordinary flight keep their existing quarter-second grace.
  const grace = Number.isFinite(state.jumpInertiaGraceSeconds)
    ? Math.max(JUMP_INERTIA_GRACE_SECONDS, Math.min(2.4, state.jumpInertiaGraceSeconds)) : JUMP_INERTIA_GRACE_SECONDS;
  const before = state.jumpInertiaSeconds;
  const after = before + dt;
  const integratedBlend = seconds => {
    const u = (seconds - grace) / JUMP_INERTIA_BLEND_SECONDS;
    if (u <= 0) return 0;
    if (u >= 1) return seconds - grace - JUMP_INERTIA_BLEND_SECONDS / 2;
    return JUMP_INERTIA_BLEND_SECONDS * (u ** 3 - 0.5 * u ** 4);
  };
  state.jumpInertiaSeconds = after >= grace + JUMP_INERTIA_BLEND_SECONDS ? null : after;
  return Math.max(0, Math.min(dt, integratedBlend(after) - integratedBlend(before)));
}

function getResponsiveAirCoastSpeed(speedMps, dt) {
  // Restore the former flight release curve (55%/s damping plus 15.5 +
  // 0.0085*v² deceleration), with its continuous-time solution rather than
  // an FPS-dependent Euler subtraction. This is a horizontal gameplay assist;
  // vertical velocity and Earth gravity stay in the separate altitude path.
  const linear = -Math.log(0.45), quadratic = 0.0085, constant = 15.5;
  const discriminant = Math.sqrt(linear * linear - 4 * quadratic * constant);
  const nearRoot = (-linear + discriminant) / (2 * quadratic);
  const farRoot = (-linear - discriminant) / (2 * quadratic);
  const ratio = (speedMps - nearRoot) / (speedMps - farRoot) * Math.exp(-discriminant * dt);
  return Math.max(0, (nearRoot - ratio * farRoot) / (1 - ratio));
}

function addAirThrust(vx, vz, impulseX, impulseZ, propulsionLimit) {
  const impulse = Math.hypot(impulseX, impulseZ);
  if (impulse === 0) return { vx, vz };
  // Govern only propulsion along its actual thrust axis. Inherited orthogonal
  // momentum remains untouched, and a turned nose can still add sideways
  // thrust even when total travel speed exceeds this propulsion limit.
  const alongThrust = (vx * impulseX + vz * impulseZ) / impulse;
  const fraction = Math.min(1, Math.max(0, propulsionLimit - alongThrust) / impulse);
  return { vx: vx + impulseX * fraction, vz: vz + impulseZ * fraction };
}

function getGroundCoastSpeed(speedMps, dt, isStandardEVMode) {
  let magnitude = Math.abs(speedMps);
  if (magnitude <= 0.1) return 0;
  let remainingDt = dt;
  // Keep the existing aero + rolling resistance curve. Normal EV overrun is
  // only 30% stronger; changing the powered speed limit cannot erase momentum.
  if (isStandardEVMode && magnitude > STANDARD_EV_MAX_MPS) {
    const overspeedDecel = (0.00012 * magnitude * magnitude + 0.35) * STANDARD_EV_OVERSPEED_COAST_FACTOR;
    const aboveLimitDt = Math.min(remainingDt, (magnitude - STANDARD_EV_MAX_MPS) / overspeedDecel);
    magnitude = Math.max(STANDARD_EV_MAX_MPS, magnitude - overspeedDecel * aboveLimitDt);
    remainingDt -= aboveLimitDt;
  }
  // Split a threshold-crossing frame so the remainder uses ordinary coasting.
  // This never snaps to 200, nor carries the 1.3 multiplier below the threshold.
  magnitude = Math.max(0, magnitude - (0.00012 * magnitude * magnitude + 0.35) * remainingDt);
  return Math.sign(speedMps) * magnitude;
}

function accelerateGroundSpeed(speedMps, acceleration, speedLimit, dt, isStandardEVMode) {
  if (isStandardEVMode && speedMps > speedLimit) {
    // W still caps electric propulsion, while excess jet momentum coasts away.
    // Once it reaches the drive ceiling, W can maintain that speed normally.
    return Math.max(speedLimit, getGroundCoastSpeed(speedMps, dt, true));
  }
  return Math.min(speedLimit, speedMps + acceleration * dt);
}

function getRetroBrakeDemand(speedMps, isAirborne) {
  const blend = Math.max(0, Math.min(1,
    (speedMps - RETRO_BRAKE_START_MPS) / (RETRO_BRAKE_FULL_MPS - RETRO_BRAKE_START_MPS)));
  const highSpeedDemand = blend * blend * (3 - 2 * blend);
  // Preserve the existing airborne H/S manual retro control at low speeds.
  // Feather it near rest so a stopped vehicle cannot spend fuel indefinitely.
  return isAirborne ? Math.max(highSpeedDemand, Math.min(1, speedMps)) : highSpeedDemand;
}

// Exact constant-gravity integration keeps unpowered flight independent of
// render FPS. There is no measured vertical CdA for this fictional package, so
// do not invent drag or a terminal-speed clamp. Existing horizontal drag stays
// in its own movement path. Stop at the first support surface and retain the
// velocity at contact for the existing damage/landing controller.
function integrateFreefall(y, vy, dt, surfaceY) {
  const nextY = y + vy * dt - 0.5 * EARTH_GRAVITY_MPS2 * dt * dt;
  const nextVy = vy - EARTH_GRAVITY_MPS2 * dt;
  if (y >= surfaceY && nextY <= surfaceY && nextVy <= 0) {
    const impactSpeed = Math.sqrt(vy * vy + 2 * EARTH_GRAVITY_MPS2 * (y - surfaceY));
    return { y: surfaceY, vy: -impactSpeed };
  }
  return { y: nextY, vy: nextVy };
}

function readDriveInput() {
  if (globalThis.window?.RoadsterDemo?.isBusy()) return window.RoadsterDemo.input();
  const touch = globalThis.window?.RoadsterTouch?.readInput() || {};
  const axis = name => Math.max(-1, Math.min(1, Number.isFinite(touch[name]) ? touch[name] : 0));
  const amount = (name, ...codes) => Math.max(0, axis(name), ...codes.map(code => Number(Boolean(keys[code]))));
  return {
    steer: Math.max(-1, Math.min(1, Number(Boolean(keys.KeyD)) - Number(Boolean(keys.KeyA)) + axis('steer'))),
    throttle: amount('throttle', 'KeyW'), boost: amount('boost', 'Semicolon'),
    brake: amount('brake', 'KeyH'), reverse: amount('reverse', 'KeyS'),
    handbrake: amount('handbrake', 'KeyU'), lift: amount('lift', 'Space'),
    descend: amount('descend', 'ShiftLeft', 'ShiftRight'),
    strafe: Math.max(-1, Math.min(1, Number(Boolean(keys.KeyE)) - Number(Boolean(keys.KeyQ)) + axis('strafe'))),
    roll: axis('roll'), pitch: axis('pitch')
  };
}

function readAttitudeInput(isAirborne) {
  if (globalThis.window?.RoadsterDemo?.isBusy()) return { rawRollInput: 0, rawPitchInput: 0, rawYawInput: 0, hasManualAttitudeInput: false };
  // Keep keyboard ownership independent: a released thumb cannot release W.
  const drive = readDriveInput();
  const rollLeft = Boolean(keys['KeyJ'] || keys['ArrowLeft']);
  const rollRight = Boolean(keys['KeyL'] || keys['ArrowRight']);
  const pitchUp = Boolean(keys['KeyI'] || keys['ArrowUp']);
  const pitchDown = Boolean(keys['KeyK'] || keys['ArrowDown']);
  const yawLeft = isAirborne && Boolean(keys['KeyA']);
  const yawRight = isAirborne && Boolean(keys['KeyD']);
  return {
    rawRollInput: Math.max(-1, Math.min(1, Number(rollLeft) - Number(rollRight) + drive.roll)),
    rawPitchInput: Math.max(-1, Math.min(1, Number(pitchUp) - Number(pitchDown) + drive.pitch)),
    rawYawInput: isAirborne ? -drive.steer : 0,
    // Opposing held controls still count as player input, even if their torques cancel.
    hasManualAttitudeInput: rollLeft || rollRight || pitchUp || pitchDown || yawLeft || yawRight ||
      drive.roll !== 0 || drive.pitch !== 0 ||
      (isAirborne && (drive.steer !== 0 || drive.strafe !== 0 || Boolean(keys['KeyQ'] || keys['KeyE'])))
  };
}

function advanceAttitudeIdle(dt, hasInput) {
  const previousIdle = state.attitudeIdleSeconds || 0;
  state.attitudeIdleSeconds = hasInput ? 0 : Math.min(2.0, previousIdle + dt);
  // Only apply the portion of this frame after the full two-second grace period.
  return hasInput || !state.autoStabilizer ? 0 : Math.min(dt, Math.max(0, previousIdle + dt - 2.0));
}


function triggerJump6m() {
  if (globalThis.window?.RoadsterDemo?.isBusy() && !window.RoadsterDemo.isRequestingJump()) return;
  if (state.isDestroyed || state.isFreefalling || state.airRemaining <= 0.15) return;
  sound.init();
  let groundElev = currentMap === 'coast' ? (globalThis.window?.RoadsterCoast?.support({...state,grounded:!state.wasAirborne}).height ?? 0) : 0;
  if ((currentMap === 'city' && typeof cityBuildings !== 'undefined') || currentMap === 'coast') {
    const mapBuildings = currentMap === 'coast' ? (globalThis.window?.RoadsterCoast?.buildings() || []) : cityNearbyBuildings(state);
    for (let i = 0; i < mapBuildings.length; i++) {
      const b = mapBuildings[i];
      if (currentMap==='city'?cityTouchesRoof(state,b):state.x > b.minX - 1.1 && state.x < b.maxX + 1.1 && state.z > b.minZ - 1.8 && state.z < b.maxZ + 1.8) {
        if (state.y >= b.height - 0.55) {
          groundElev = Math.max(groundElev, b.height);
        }
      }
    }
  }
  const currentAgl = Math.max(0.0, state.y - groundElev);
  // Only a fresh ground/roof takeoff gets launch grace. Midair O taps cannot
  // restart it and disable normal flight handling.
  if (currentAgl <= 0.15 && (currentMap!=='coast'||(!state.wasAirborne&&!state.coastDetached))) {
    state.groundHopActive = true;
    state.jumpInertiaSeconds = 0;
    state.jumpInertiaGraceSeconds = globalThis.window?.RoadsterDemo?.isRequestingJump() ? (window.RoadsterDemo.jumpGraceSeconds?.() ?? 0.95) : null;
  }
  // Jump to 6.0m above ground/rooftop (or +6.0m if already flying above 5.5m)
  state.jumpStartY = state.y;
  const demoJumpHeight = globalThis.window?.RoadsterDemo?.isRequestingJump() ? window.RoadsterDemo.jumpHeight() : 6.0;
  state.jumpTargetY = (currentAgl < 5.5) ? (groundElev + demoJumpHeight) : Math.min(MAX_FLIGHT_ALTITUDE, state.y + 6.0);
  state.isJumping6m = true;
  if(currentMap==='coast'){state.coastDetached=true;state.coastSupportId=null;}
  state.isAltitudeHold = false;
  const nBadge = document.getElementById('key-n');
  if (nBadge) nBadge.classList.remove('active');
  const baseClimbVy = (state.physicsMode === 'realistic') ? (6.2 * 1.3) : (28.0 * 1.3);
  state.vy = Math.max(state.vy, baseClimbVy * 2.5);
  if (!globalThis.window?.RoadsterDemo?.isRequestingJump()) showBanner('jump6m', 2.0);
  sound.beep(820, 0.12);
}


  if(jumpOnly){triggerJump6m();return {state,cars:trafficCars,events,dt:0,jumpOnly:true};}
  state.impactCooldown=Math.max(0,state.impactCooldown-dt);
  const isRealMode = (state.physicsMode === 'realistic');
  const cityMotionStart = currentMap === 'city' ? {x:state.x,y:state.y,z:state.z,yaw:state.yaw,pitch:state.pitch,roll:state.roll} : null;
  const coastMotionStart = currentMap === 'coast' ? {x:state.x,y:state.y,z:state.z,yaw:state.yaw,pitch:state.pitch,roll:state.roll,vy:state.vy} : null;
  if(coastMotionStart&&typeof playerWrapper!=='undefined'&&typeof roadsterAttitudeGroup!=='undefined')coastMotionStart.contactPose={x:state.x,y:playerWrapper.position.y,z:state.z,pitch:roadsterAttitudeGroup.rotation.x,yaw:roadsterAttitudeGroup.rotation.y,roll:roadsterAttitudeGroup.rotation.z};
  const coastObstacles = currentMap === 'coast' ? (globalThis.window?.RoadsterCoast?.buildings() || []) : null;
  const coastTrafficStart = currentMap === 'coast' ? new Map(trafficCars.map(c=>[c,{x:c.mesh.position.x,y:c.mesh.position.y,z:c.mesh.position.z,yaw:c.mesh.rotation.y,pitch:c.mesh.rotation.x,roll:c.mesh.rotation.z,visible:c.mesh.visible}])) : null;
  state.gasMassKg = Number((144.0 * (state.airRemaining / MAX_AIR_SECONDS)).toFixed(1));
  const currentVehicleMass = VEHICLE_MASS_KG + (state.gasMassKg || 0);
  const fuelBurnThrustFactor = (VEHICLE_MASS_KG + 144.0) / Math.max(1850.0, currentVehicleMass);
  let currentGroundAccel = 16.5;
  let currentAirAccel = 9.5;
  let currentLiftAccel = 8.2 * 1.3;   // +30% climb acceleration (10.66 m/s²)
  let currentMaxClimbVy = 6.2 * 1.3;  // +30% Space climb speed (8.06 m/s)
  let tireScreechIntensity = 0.0;

  const coastWorld = currentMap === 'coast' ? globalThis.window?.RoadsterCoast : null;
  let coastSupport = coastWorld?.support({...state,grounded:!state.wasAirborne});
  let groundElevation = coastSupport && Number.isFinite(coastSupport.height) ? coastSupport.height : 0;
  if (currentMap === 'city' || currentMap === 'coast') {
    const mapBuildings = coastObstacles || cityNearbyBuildings(state);
    for (let i = 0; i < mapBuildings.length; i++) {
      const b = mapBuildings[i];
      if (coastWorld && state.y + 1.25 < (b.minY ?? 0)) continue;
      if (currentMap === 'city' ? cityTouchesRoof(state,b) : state.x > b.minX - 1.1 && state.x < b.maxX + 1.1 && state.z > b.minZ - 1.8 && state.z < b.maxZ + 1.8) {
        if (state.y >= b.height - 0.55) {
          groundElevation = Math.max(groundElevation, b.height);
        }
      }
    }
  }
  // O has already supplied vertical launch velocity, even before this frame's
  // altitude integration. Do not run another tire-grip/drive frame on takeoff.
  let isAirborne = coastWorld
    ? Math.abs(state.y-groundElevation)>.15 || !coastSupport?.solid || (state.isJumping6m&&state.vy>0) || state.coastDetached===true || (state.wasAirborne&&!state.coastSupportId)
    : (state.y - groundElevation) > 0.15 || (state.isJumping6m && state.vy > 0);
  let coastGroundAttached = Boolean(coastWorld&&!isAirborne);
  if(coastWorld){state.coastSupportId=coastGroundAttached?coastSupport.id:null;state.coastDetached=false;}
  if (!isAirborne) state.groundHopActive = false;
  const { rawRollInput, rawPitchInput, rawYawInput, hasManualAttitudeInput } = readAttitudeInput(isAirborne);
  const stabilizerDt = advanceAttitudeIdle(dt, hasManualAttitudeInput || !isAirborne);

  // Unified COPV Air Tank Consumption Helper (Requirement 3: ALL airborne thrusters & ';' rear boost consume tank)
  let airConsumedThisFrame = 0;
  function consumeAirTank(amount, airborneNow) {
    if (amount <= 0 || state.isFreefalling || state.airRemaining <= 0) return false;
    // Infinite mode changes the shared tank, not thrust strength or input.
    if (state.infiniteJet) { airConsumedThisFrame += amount; return true; }
    const airBefore = state.airRemaining;
    state.airRemaining = Math.max(0.0, state.airRemaining - amount);
    state.airUsedContinuous = MAX_AIR_SECONDS - state.airRemaining;
    if (state.airRemaining <= 0.001) {
      const flightAlertEligible = airborneNow && isAirborne && !state.groundHopActive && !state.isJumping6m && !Number.isFinite(state.jumpInertiaSeconds);
      state.airRemaining = 0.0;
      state.airUsedContinuous = MAX_AIR_SECONDS;
      state.isFreefalling = true;
      state.isAutoDescending8s = false;
      state.isAltitudeHold = false;
      state.isJumping6m = false;
      // Losing thrust changes acceleration, never the current velocity.
      // A depleted road tank (including the complete O-hop) is not flight.
      // This presentation-only marker never changes gas, force or ballistics.
      if (flightAlertEligible) {
        showBanner('freefall', 3.5);
        sound.speakAlert('freefall', 'Critical alert: compressed air depleted. Immediate freefall!', '严重警报：冷气推进剂耗尽，进入自由落体！');
      }
      airConsumedThisFrame += airBefore - state.airRemaining;
      return false;
    } else if (state.airUsedContinuous >= AUTO_DESCENT_USED_SECONDS && airborneNow) {
      if (!state.isAutoDescending8s) {
        state.isAutoDescending8s = true;
        showBanner('8s', 2.4);
        sound.speakAlert('8s', 'Warning: Low tank pressure. Auto-descent engaged.', '警告：气瓶压力低于百分之二十，自动下降已启动。');
      }
    }
    airConsumedThisFrame += airBefore - state.airRemaining;
    return true;
  }

  let canUseRCS = !state.isFreefalling && state.airRemaining > 0.005;

  // Requirement 4: ';' (Semicolon) triggers Rear Cold-Gas Rocket Boost in Realistic (Standard) mode!
  const driveInput = readDriveInput();
  if(currentMap==='city')window.RoadsterCityDiagnostics?.begin(state,dt,driveInput);
  // Deliberate lift/hold leaves a road hop for actual flight; W held while
  // driving over a hop alone must not accidentally arm the flight alarm.
  if (isAirborne && (driveInput.lift > 0 || state.isAltitudeHold)) state.groundHopActive = false;
  const isRearBoostKey = driveInput.boost > 0;
  const isThrottleW = driveInput.throttle > 0;
  const isAccelerating = isThrottleW || (isRearBoostKey && canUseRCS);

  // Set mode-specific dynamic limits (calibrated to 0-100 km/h in 1.9s & venue scale)
  if (isRealMode) {
    if (state.insaneMode || (isRearBoostKey && canUseRCS)) {
      // Plaid mode or ';' Rear Rocket Boost: unlocks up to 370 km/h (= 102.78 m/s) & 38 m/s² rocket thrust
      state.maxSpeed = 370.0 / 3.6;
      currentGroundAccel = 38.0;
      state.airMaxSpeed = 52.0;
      currentAirAccel = 24.0;
    } else {
      // Standard EV propulsion reaches 200 km/h; existing boosted momentum coasts down.
      state.maxSpeed = STANDARD_EV_MAX_MPS;
      currentGroundAccel = 16.5;
      state.airMaxSpeed = 31.5;
      currentAirAccel = 9.5;
    }
    currentLiftAccel = 8.2 * 1.3;
    currentMaxClimbVy = 6.2 * 1.3;
  } else {
    // 幻想模式 (Fantasy Mode) - 加速大幅提升:
    // 地面极速提高至 576 km/h (160 m/s)，空中最高 260 m/s
    // 默认纯电驱动加速度大幅提高至 72.0 m/s² (0-100 仅需约 0.38s)
    state.maxSpeed = 160.0;
    state.airMaxSpeed = 260.0;
    currentGroundAccel = 72.0;
    currentAirAccel = 92.0;
    currentLiftAccel = 48.0 * 1.3;
    currentMaxClimbVy = 36.0 * 1.3;
  }
  const isStandardEVMode = isRealMode && !state.insaneMode && state.maxSpeed === STANDARD_EV_MAX_MPS;
  const electricGroundAccel = isRealMode ? (state.insaneMode ? 38.0 : 16.5) : 72.0;
  const electricAirAccel = isRealMode ? (state.insaneMode ? 24.0 : 9.5) : (currentMap !== 'highway' ? 145.0 : 92.0);
  const rearJetAccel = isRealMode ? 38.0 : 120.0;
  const groundDriveAccel = (speed, electricFactor = 1, jetFactor = 1) => {
    // A small jet request must not turn a held W into full rocket power, or
    // extend the electric motor past its existing 200 km/h ceiling.
    const electric = isRealMode && !state.insaneMode && speed >= STANDARD_EV_MAX_MPS
      ? 0 : electricGroundAccel * driveInput.throttle * electricFactor;
    const jet = isRearThrusterFiring ? rearJetAccel * driveInput.boost * jetFactor : 0;
    return Math.max(electric, jet);
  };

  // Requirement 1 & 2:
  // • When throttle (W or ;) and foot brake (H) / reverse (S) are pressed simultaneously, execute throttle and ignore foot brake/reverse.
  // • Handbrake (B) MUST work even when throttle (W) is held ("不松油门的情况下目前手刹无法正常使用")!
  const isFootBraking = driveInput.brake > 0 && !isAccelerating;
  const isReversing = driveInput.reverse > 0 && !isAccelerating;
  const isHandbraking = driveInput.handbrake > 0;
  const isAirBrakingActive = isFootBraking || (isAirborne && isReversing);
  const coastDragCoeff = ((currentMap === 'coast' ? state.y-groundElevation : state.y) > 0.2 || Math.abs(state.speed) > 33.0) ? 0.44 : 0.34;
  state.dragCoeffCd = isAirBrakingActive ? coastDragCoeff + (0.72 - coastDragCoeff) * Math.max(driveInput.brake, driveInput.reverse) : coastDragCoeff;

  // Determine if the 4 Rear SpaceX Cold-Gas Nozzles are firing this frame:
  // 用户要求: "在空中飞行的时候，按W需要喷气，地上的W不喷气"
  // • 空中 (isAirborne === true): 按下 W 或 ; 均启动尾部冷气推进器喷气加速并消耗气瓶
  // • 地面 (isAirborne === false): 按下 W 仅使用纯电驱动（不喷气），按下 ; 才触发尾部火箭喷气
  let isRearThrusterFiring = false;
  if (canUseRCS) {
    if (isAirborne && (isThrottleW || isRearBoostKey)) {
      const airBurnRate = Math.max(0.85 * driveInput.boost, 0.65 * driveInput.throttle);
      isRearThrusterFiring = consumeAirTank(airBurnRate * dt, true);
    } else if (!isAirborne && isRearBoostKey) {
      isRearThrusterFiring = consumeAirTank(0.85 * driveInput.boost * dt, false);
    }
  }
  canUseRCS = !state.isFreefalling && state.airRemaining > 0.005;

  // One brake request and one COPV charge, shared by H and S. Throttle's
  // established priority above remains unchanged, including touch controls.
  const brakeTravelSpeed = isAirborne
    ? Math.hypot(state.vx, state.vy, state.vz)
    : (currentMap === 'highway' ? Math.abs(state.speed) : Math.hypot(state.vx, state.vz));
  const retroBrakeDemand = (isFootBraking || isReversing)
    ? getRetroBrakeDemand(brakeTravelSpeed, isAirborne) * Math.max(driveInput.brake, driveInput.reverse) : 0;
  let retroImpulseSeconds = 0;
  if (retroBrakeDemand > 0 && !state.isFreefalling && state.airRemaining > 0) {
    const requestedAir = RETRO_BRAKE_BURN_PER_SECOND * retroBrakeDemand * dt;
    const airBefore = state.airRemaining;
    const consumedBefore = airConsumedThisFrame;
    consumeAirTank(state.infiniteJet ? requestedAir : Math.min(airBefore, requestedAir), isAirborne);
    // The final fraction of a nearly empty tank supplies only its proportional
    // impulse, even when consumeAirTank returns false on depletion.
    retroImpulseSeconds = Math.min(requestedAir, airConsumedThisFrame - consumedBefore) / RETRO_BRAKE_BURN_PER_SECOND;
  }
  const isRetroBrakeFiring = retroImpulseSeconds > 0;
  const retroBrakeAccel = RETRO_BRAKE_FORCE_N / currentVehicleMass;
  canUseRCS = !state.isFreefalling && state.airRemaining > 0.005;

  // Ground steering uses A / D only (J / L are exclusively Roll!)
  const steerLeft = Boolean(keys['KeyA']);
  const steerRight = Boolean(keys['KeyD']);
  const lateralInput = isAirborne ? 0 : driveInput.steer;

  // Only the opt-in highway stunt demo uses the quicker bounded rack. Manual
  // A/D, city, drift and all airborne handling keep their established response.
  const demoGroundHandling = currentMap === 'highway' && !isAirborne && globalThis.window?.RoadsterDemo?.isActive()
    && typeof RoadsterHighwayDemoPlanner !== 'undefined' ? RoadsterHighwayDemoPlanner.handling : null;
  const demoGroundSweep = demoGroundHandling ? { x:state.x, y:state.y, cars:new Map(trafficCars
    .filter(c=>c.mode==='highway' && c.mesh.visible!==false && c.highwayWaitingToSpawn===undefined)
    .map(c=>[c,{x:c.mesh.position.x,z:c.mesh.position.z}])) } : null;
  const steerRate = demoGroundHandling ? demoGroundHandling.rackRate : lateralInput !== 0 ? 8.0 : 11.0;
  const rackBlend = demoGroundHandling ? 1.0 - Math.exp(-steerRate * dt) : Math.min(1.0, steerRate * dt);
  state.steerInput = (state.steerInput || 0) + (lateralInput - (state.steerInput || 0)) * rackBlend;
  if (Math.abs(state.steerInput) < 0.004 && lateralInput === 0) state.steerInput = 0.0;
  state.steerAngle = -state.steerInput * 0.38;
  frontWheelSteerGroups.forEach(g => { g.rotation.y = state.steerAngle; });

  // Requirement 2 & 3: In mid-air, Q / E controls lateral body movement AND consumes COPV air tank!
  const wantsAirJetLeft = isAirborne && (Boolean(keys['KeyQ']) || driveInput.strafe < 0);
  const wantsAirJetRight = isAirborne && (Boolean(keys['KeyE']) || driveInput.strafe > 0);
  let airJetLeft = false;
  let airJetRight = false;
  if ((wantsAirJetLeft || wantsAirJetRight) && canUseRCS) {
    const strafePower = Math.max(Math.abs(driveInput.strafe), Number(Boolean(keys.KeyQ || keys.KeyE)));
    if (consumeAirTank(0.45 * strafePower * dt, true)) {
      airJetLeft = wantsAirJetLeft;
      airJetRight = wantsAirJetRight;
    }
  }
  canUseRCS = !state.isFreefalling && state.airRemaining > 0.005;

  // Car nose 3D unit vector in world space (Requirement 5: Rear thruster accelerates in NOSE direction, not camera direction)
  const noseHorizX = -Math.sin(state.yaw);
  const noseHorizZ = -Math.cos(state.yaw);
  const rightHorizX = Math.cos(state.yaw);
  const rightHorizZ = -Math.sin(state.yaw);
  const nosePitchCos = Math.cos(state.pitch);
  const nosePitchSin = Math.sin(state.pitch);

  const airHandlingDt = advanceAirHandling(dt, isAirborne);
  if (isAirborne) {
    state.isDrifting = false;
    state.wasHandbraking = false;
    state.driftAngle = 0.0;
    // Takeoff retains its inherited vector. Established flight smoothly regains
    // the controlled speed envelope and nose/bank response used before it.
    if (isRearThrusterFiring) {
      const jetAirAccel = currentMap !== 'highway' && !isRealMode ? 145.0 : currentAirAccel;
      const boostAirAccel = Math.max(electricAirAccel * driveInput.throttle, jetAirAccel * driveInput.boost);
      const thrust = addAirThrust(state.vx, state.vz,
        noseHorizX * nosePitchCos * boostAirAccel * dt,
        noseHorizZ * nosePitchCos * boostAirAccel * dt, state.airMaxSpeed);
      state.vx = thrust.vx;
      state.vz = thrust.vz;
      const maxAirVy = currentMaxClimbVy * 1.35;
      const verticalImpulse = boostAirAccel * nosePitchSin * 0.55 * dt;
      state.vy += verticalImpulse > 0 ? Math.min(verticalImpulse, Math.max(0, maxAirVy - state.vy)) : verticalImpulse;
      const horizMag = Math.hypot(state.vx, state.vz);
      if (horizMag > state.airMaxSpeed && airHandlingDt > 0) {
        // Settle inherited overspeed continuously; never clip the O launch or
        // jump directly to a new propulsion limit when changing flight modes.
        const nextMag = state.airMaxSpeed + (horizMag - state.airMaxSpeed) * Math.exp(-3.0 * airHandlingDt);
        state.vx *= nextMag / horizMag;
        state.vz *= nextMag / horizMag;
      }
    } else {
      const horizMag = Math.hypot(state.vx, state.vz);
      const launchCoast = getAirCoastSpeed(horizMag, Math.max(0, dt - airHandlingDt));
      const nextMag = getResponsiveAirCoastSpeed(launchCoast, airHandlingDt);
      const coastScale = horizMag > 0 ? nextMag / horizMag : 0;
      state.vx *= coastScale;
      state.vz *= coastScale;
    }

    // Explicit side jets keep their proportional input throughout takeoff.
    // Bank assist and powered sideslip control blend in after the brief carry.
    const jetDir = airJetLeft || airJetRight ? driveInput.strafe : 0;
    const bankStrafe = canUseRCS ? Math.sin(state.roll) * 10.0 : 0;
    const targetStrafe = jetDir * 18.0 + bankStrafe;
    const strafeRate = isRearThrusterFiring ? 10.0 : 6.5;
    const lateralSpeed = state.vx * rightHorizX + state.vz * rightHorizZ;
    const strafeDt = jetDir !== 0 ? dt : airHandlingDt;
    const strafeChange = jetDir !== 0 || Math.abs(bankStrafe) > 0.001 || isRearThrusterFiring
      ? (targetStrafe - lateralSpeed) * (1.0 - Math.exp(-strafeRate * strafeDt))
      : 0;
    state.vx += rightHorizX * strafeChange;
    state.vz += rightHorizZ * strafeChange;
    state.airStrafeSpeed = lateralSpeed + strafeChange;
    state.speed = Math.hypot(state.vx, state.vz);
  } else {
    if (state.wasAirborne) {
      // Hand inertial flight velocity back to the existing signed ground-drive convention.
      const forwardVelocity = state.vx * noseHorizX + state.vz * noseHorizZ;
      state.speed = (forwardVelocity >= 0 ? 1 : -1) * Math.hypot(state.vx, state.vz);
    }
    state.airStrafeSpeed = 0.0;
  }
  state.wasAirborne = isAirborne;

  // Apply the paid impulse opposite actual travel, never camera/nose heading.
  // A scalar clamp preserves direction and cannot propel the car through zero.
  const retroTravelSpeed = isAirborne ? Math.hypot(state.vx, state.vy, state.vz)
    : (currentMap === 'highway' ? Math.abs(state.speed) : Math.hypot(state.vx, state.vz));
  const retroScale = retroTravelSpeed > 0
    ? Math.max(0, retroTravelSpeed - retroBrakeAccel * retroImpulseSeconds) / retroTravelSpeed : 0;
  const retroUsesRearNozzles = isAirborne
    ? (state.vx * noseHorizX * nosePitchCos + state.vy * nosePitchSin + state.vz * noseHorizZ * nosePitchCos) < 0
    : (state.vx * noseHorizX + state.vz * noseHorizZ) < 0;
  // Snapshot only for rendering the already-paid brake impulse in its travel direction.
  const retroVisualVx = state.vx, retroVisualVy = isAirborne ? state.vy : 0, retroVisualVz = state.vz;
  if (isRetroBrakeFiring) {
    state.vx *= retroScale;
    state.vz *= retroScale;
    if (isAirborne) state.vy *= retroScale;
    state.speed = isAirborne ? Math.hypot(state.vx, state.vz) : state.speed * retroScale;
  }

  if (currentMap === 'highway') {
    if (!isAirborne) {
      // Ground mode on highway
      if (isAccelerating) {
        const effAccel = groundDriveAccel(state.speed, isHandbraking ? 1 - 0.12 * driveInput.handbrake : 1, fuelBurnThrustFactor);
        if (state.speed < -0.5) {
          state.speed = Math.min(0.0, state.speed + 38.0 * Math.max(driveInput.throttle, driveInput.boost) * dt);
        } else {
          state.speed = accelerateGroundSpeed(state.speed, effAccel, state.maxSpeed, dt, isStandardEVMode);
        }
      } else if (isFootBraking) {
        if (state.speed > 0.1) {
          state.speed = Math.max(0.0, state.speed - 38.0 * driveInput.brake * dt);
        } else if (state.speed < -0.1) {
          state.speed = Math.min(0.0, state.speed + 38.0 * driveInput.brake * dt);
        } else {
          state.speed = 0.0;
        }
      } else if (isReversing) {
        if (state.speed > 0.3) {
          state.speed *= Math.pow(0.95, dt * driveInput.reverse);
        } else if (state.speed < -15.0) {
          // A fast backward landing brakes toward reverse cruise; the reverse
          // speed limit must never teleport existing momentum to -15 m/s.
          state.speed = Math.min(-15.0, state.speed + 38.0 * driveInput.reverse * dt);
        } else {
          state.speed = Math.max(-15.0, state.speed - 16.0 * driveInput.reverse * dt);
        }
      } else if (!isHandbraking) {
        // Gentle coasting, including a continuous 30%-stronger normal EV overrun.
        state.speed = getGroundCoastSpeed(state.speed, dt, isStandardEVMode);
      }

      const speedFactor = THREE.MathUtils.clamp(Math.abs(state.speed) / 14.0, 0.0, 1.25);
      const turnSign = state.speed >= -0.1 ? 1 : -1;

      // Fix Issue 1: Handbrake (U) breaks rear tire lateral grip for smooth drift without abrupt dead-stop,
      // and immediately stops decelerating the instant U is released!
      if (isHandbraking && Math.abs(state.speed) > 1.5) {
        state.wasHandbraking = true;
        if (lateralInput !== 0 || Math.abs(state.driftAngle) > 0.04) {
          state.isDrifting = true;
          const targetSlip = -state.steerInput * 0.58 * turnSign * driveInput.handbrake;
          state.driftAngle += (targetSlip - state.driftAngle) * 8.5 * dt;
          state.yaw = state.driftAngle;
          state.vYaw = 0.0;
          const driftSlideVx = state.steerInput * Math.min(22.0, Math.abs(state.speed) * 0.56) * driveInput.handbrake;
          const noseThrustVx = isRearThrusterFiring ? (noseHorizX * state.speed * 0.85) : (noseHorizX * state.speed * 0.48);
          state.vx += (driftSlideVx + noseThrustVx - state.vx) * 9.5 * dt;
          if (!isAccelerating) {
            // Very light tire-scrub (~1.2 m/s²) so handbrake never locks/stops the car
            state.speed = Math.sign(state.speed) * Math.max(0.0, Math.abs(state.speed) - 1.2 * driveInput.handbrake * dt);
          }
        } else {
          state.isDrifting = false;
          state.driftAngle *= Math.pow(0.05, dt);
          if (!isAccelerating) {
            state.speed = Math.sign(state.speed) * Math.max(0.0, Math.abs(state.speed) - 1.2 * driveInput.handbrake * dt);
          }
        }
      } else {
        state.isDrifting = false;
        state.wasHandbraking = false;
        state.driftAngle *= Math.pow(0.005, dt);
        if (demoGroundHandling) {
          const targetVx = state.steerInput * demoGroundHandling.lateralSpeed * THREE.MathUtils.clamp(Math.abs(state.speed) / 18.0, 0, 1);
          const targetYaw = -Math.atan2(targetVx, Math.max(12, Math.abs(state.speed))) * turnSign;
          state.yaw += wrapAnglePi(targetYaw - state.yaw) * (1.0 - Math.exp(-demoGroundHandling.yawRate * dt));
          state.vx += (targetVx - state.vx) * (1.0 - Math.exp(-demoGroundHandling.lateralRate * dt));
        } else {
          const targetHwyYaw = -state.steerInput * 0.16 * turnSign * Math.min(1.0, speedFactor);
          state.yaw += wrapAnglePi(targetHwyYaw - state.yaw) * (1.0 - Math.exp(-12.0 * dt));
          state.vYaw = 0.0;
          const targetVx = isRearThrusterFiring
            ? (noseHorizX * state.speed)
            : (state.steerInput * 13.5 * speedFactor + noseHorizX * state.speed * 0.35);
          state.vx += (targetVx - state.vx) * 14.0 * dt;
        }
      }
      state.vz = noseHorizZ * state.speed;
    }

    state.x += state.vx * dt;
    state.z = 0;

    const halfRoad = ROAD_WIDTH / 2 - 1.25;
    if (state.x < -halfRoad || state.x > halfRoad) {
      stop('highway-rail-contact', null, 'collision');
      const hitSpeed = Math.abs(state.vx) + Math.abs(state.speed) * 0.22;
      state.x = THREE.MathUtils.clamp(state.x, -halfRoad, halfRoad);
      if (state.y < 1.2 && hitSpeed > 12.0) {
        triggerPhysicsCollision(hitSpeed, 'crashReasonThreshold', state.x < 0 ? 6.5 : -6.5, 1.2, 0);
      }
      const isSteeringIntoRail = (state.x <= -halfRoad && state.steerInput < -0.05) || (state.x >= halfRoad && state.steerInput > 0.05);
      if (isSteeringIntoRail) {
        state.vx = 0.0;
      } else {
        state.vx = (state.x < 0 ? 1 : -1) * Math.min(2.5, Math.abs(state.vx) * 0.25);
      }
      if (isAirborne) {
        const horizontalSpeed = Math.hypot(state.vx, state.vz);
        const railScale = horizontalSpeed > 0 ? Math.max(0, horizontalSpeed - 8.0 * dt) / horizontalSpeed : 0;
        state.vx *= railScale;
        state.vz *= railScale;
        state.speed = Math.hypot(state.vx, state.vz);
      } else {
        state.speed = Math.max(0.0, state.speed - 8.0 * dt);
      }
      state.yaw -= wrapAnglePi(state.yaw) * (1.0 - Math.pow(0.04, dt));
    }
  } else {
    // City Open-World Mode: True 2D Velocity Vector + Momentum-Preserving Handbrake Drift
    if (!isAirborne) {
      state.airStrafeSpeed = 0.0;
      let vForward = state.vx * noseHorizX + state.vz * noseHorizZ;
      let vLateral = state.vx * rightHorizX + state.vz * rightHorizZ;
      const totalGroundSpd = Math.hypot(vForward, vLateral);
      const forwardSign = (vForward >= -0.5 || state.speed >= -0.2) ? 1 : -1;
      let signedSpd = forwardSign * totalGroundSpd;

      if (isHandbraking && totalGroundSpd > 1.5) {
        // Fix Issue 1: Momentum-preserving handbrake drift!
        // Preserves total speed magnitude instead of wiping out vLateral when yaw rotates,
        // so pulling the handbrake NEVER causes an abrupt dead stop!
        state.wasHandbraking = true;
        state.isDrifting = Math.abs(state.steerInput) > 0.04 || Math.abs(state.driftAngle) > 0.05;
        const turnDir = forwardSign;
        const pivotSpeedFactor = THREE.MathUtils.clamp(totalGroundSpd / 6.5, 0.35, 1.25);
        const handbrakeYawRate = state.steerInput * 3.85 * pivotSpeedFactor * turnDir * driveInput.handbrake;
        state.yaw -= handbrakeYawRate * dt;
        state.vYaw = 0.0;

        const targetSlip = state.steerInput * 0.55 * turnDir * driveInput.handbrake;
        state.driftAngle += (targetSlip - state.driftAngle) * 7.5 * dt;

        if (isRearThrusterFiring) {
          signedSpd = accelerateGroundSpeed(signedSpd, groundDriveAccel(signedSpd), state.maxSpeed, dt, isStandardEVMode);
          state.driftAngle *= Math.pow(0.15, dt);
        } else if (isAccelerating) {
          signedSpd = accelerateGroundSpeed(signedSpd, groundDriveAccel(signedSpd, 1 - 0.15 * driveInput.handbrake), state.maxSpeed * 0.94, dt, isStandardEVMode);
        } else if (isFootBraking) {
          signedSpd = Math.sign(signedSpd) * Math.max(0, Math.abs(signedSpd) - 38.0 * driveInput.brake * dt);
        } else {
          // Very gentle tire-scrub (~1.2 m/s²) while coasting in handbrake drift
          if (signedSpd > 0) {
            signedSpd = Math.max(0.0, signedSpd - 1.2 * driveInput.handbrake * dt);
          } else {
            signedSpd = Math.min(0.0, signedSpd + 1.2 * driveInput.handbrake * dt);
          }
        }

        // Velocity vector points along (state.yaw + state.driftAngle), preserving full speed magnitude!
        const travelYaw = state.yaw + state.driftAngle;
        state.vx = -Math.sin(travelYaw) * signedSpd;
        state.vz = -Math.cos(travelYaw) * signedSpd;
        state.speed = signedSpd;
      } else {
        // The instant Handbrake (U) is released, transfer full totalGroundSpd cleanly into vForward
        // so zero momentum is lost and deceleration stops immediately!
        if (state.wasHandbraking) {
          vForward = signedSpd;
          vLateral = 0.0;
          state.wasHandbraking = false;
        }
        state.isDrifting = false;
        state.driftAngle *= Math.pow(0.005, dt);

        // Normal grippy Ackermann steering
        const absSpd = Math.abs(vForward);
        if (absSpd > 0.2) {
          const turnDir = vForward >= -0.1 ? 1 : -1;
          const lowSpeedFactor = THREE.MathUtils.clamp(absSpd / 7.5, 0.0, 1.0);
          const highSpeedDamp = 1.0 / (1.0 + absSpd * 0.015);
          const yawRate = state.steerInput * 2.35 * lowSpeedFactor * highSpeedDamp * turnDir;
          state.yaw -= yawRate * dt;
        }
        state.vYaw = 0.0;

        const newNoseX = -Math.sin(state.yaw);
        const newNoseZ = -Math.cos(state.yaw);
        const newRightX = Math.cos(state.yaw);
        const newRightZ = -Math.sin(state.yaw);

        if (isRearThrusterFiring) {
          vForward = accelerateGroundSpeed(vForward, groundDriveAccel(vForward), state.maxSpeed, dt, isStandardEVMode);
          vLateral *= Math.pow(0.002, dt);
        } else if (isAccelerating) {
          if (vForward < -0.5) {
            vForward = Math.min(0.0, vForward + 38.0 * driveInput.throttle * dt);
          } else {
            vForward = accelerateGroundSpeed(vForward, groundDriveAccel(vForward), state.maxSpeed, dt, isStandardEVMode);
          }
          vLateral *= Math.pow(0.004, dt);
        } else if (isFootBraking) {
          if (vForward > 0.1) {
            vForward = Math.max(0.0, vForward - 38.0 * driveInput.brake * dt);
          } else if (vForward < -0.1) {
            vForward = Math.min(0.0, vForward + 38.0 * driveInput.brake * dt);
          } else {
            vForward = 0.0;
          }
          vLateral *= Math.pow(0.004, dt * driveInput.brake);
        } else if (isReversing) {
          if (vForward > 0.3) {
            vForward *= Math.pow(0.95, dt * driveInput.reverse);
          } else if (vForward < -15.0) {
            vForward = Math.min(-15.0, vForward + 38.0 * driveInput.reverse * dt);
          } else {
            vForward = Math.max(-15.0, vForward - 16.0 * driveInput.reverse * dt);
          }
          vLateral *= Math.pow(0.004, dt * driveInput.reverse);
        } else {
          // Match the highway's continuous normal EV overspeed coasting.
          vForward = getGroundCoastSpeed(vForward, dt, isStandardEVMode);
          const wetFriction = (weatherIndex === 1 ? 0.65 : 0.004);
          vLateral *= Math.pow(wetFriction, dt);
        }

        state.vx = newNoseX * vForward + newRightX * vLateral;
        state.vz = newNoseZ * vForward + newRightZ * vLateral;
        state.speed = (vForward >= -0.1 ? 1 : -1) * Math.hypot(state.vx, state.vz);
      }
    }

    // A 300 m city block is traversed in 300 / velocity seconds, on ground or in air.
    const moveScale = CITY_WORLD_SPEED_SCALE;
    if(coastGroundAttached){
      // Gravity projected onto the actual plane, coast only. EV/jet drive and
      // all map1/2 coefficients above remain untouched.
      state.vx += EARTH_GRAVITY_MPS2*coastSupport.normal.x*coastSupport.normal.y*dt;
      state.vz += EARTH_GRAVITY_MPS2*coastSupport.normal.z*coastSupport.normal.y*dt;
    }
    state.x += state.vx * moveScale * dt;
    state.z += state.vz * moveScale * dt;

    const limit = CITY_HALF_BOUND - 2.2;
    const cityWall=currentMap==='city'?cityVisibleBoundaryHit(cityMotionStart,state):null;
    if (currentMap==='city' ? cityWall!==null : Math.abs(state.x) > limit || Math.abs(state.z) > limit) {
      if(cityWall){
        const t=Math.max(0,cityWall.t-1e-5),contactAxis=cityWall.axis;state[contactAxis]=cityMotionStart[contactAxis]+(state[contactAxis]-cityMotionStart[contactAxis])*t;
        // Resolve an initial overlap as well as a swept crossing, otherwise a
        // resting edge can rebound repeatedly on successive frames.
        const body=cityPlayerBody(state),axis=cityWall.axis,n=cityWall.normal,radius=axis==='x'?body.rx:body.rz;
        state[axis]+=cityWall.sign*CITY_HALF_BOUND+n*(1+radius+.005)-body[axis];
        const key=axis==='x'?'vx':'vz',impactV=Math.max(0,-state[key]*n);
        if(impactV>0){state[key]+=1.35*impactV*n;state.speed=isAirborne?Math.hypot(state.vx,state.vz):-state.vx*Math.sin(state.yaw)-state.vz*Math.cos(state.yaw);}
        if(impactV>10){window.RoadsterCityDiagnostics?.contact({kind:'boundary',axis,sign:cityWall.sign,height:45.3,normal:n});triggerPhysicsCollision(impactV,'crashReasonThreshold',0,2,0);}
      } else {
        const impactV = Math.abs(state.speed);
        state.x = THREE.MathUtils.clamp(state.x, -limit, limit);state.z = THREE.MathUtils.clamp(state.z, -limit, limit);
        state.vx *= -0.35;state.vz *= -0.35;
        state.speed = isAirborne ? Math.hypot(state.vx, state.vz) : state.speed * -0.35;
        state.yaw -= wrapAnglePi(state.yaw) * (1.0 - Math.pow(0.10, dt));
        if (impactV > 10.0)triggerPhysicsCollision(impactV, 'crashReasonThreshold', isAirborne ? 0 : -state.vx * 0.4, 2.0, isAirborne ? 0 : -state.vz * 0.4);
      }
    }
  }

  const wantsHover = driveInput.lift > 0;
  if(coastGroundAttached&&wantsHover&&state.airRemaining>0&&!state.isFreefalling){coastGroundAttached=false;state.coastSupportId=null;state.coastDetached=true;isAirborne=true;state.wasAirborne=true;}
  const wantsDescend = driveInput.descend > 0;
  let isLiftFiring = false;
  let isDescendFiring = false;
  let freefallStartVy = null;

  // Coast-only continuous obstacle contact; legacy map1/2 response is unchanged.
  if (coastMotionStart) {
    const contact = globalThis.window?.RoadsterCoast?.clipBuildings(coastMotionStart,state);
    if (contact) { triggerPhysicsCollision(contact.speed,'crashReasonBuilding',0,2,0); if (state.isDestroyed) return; }
  }
  // Sea is not a road: no automatic landing save or recharge before real contact.
  const coastSurface = coastWorld?.support({...state,previousY:coastMotionStart.y,grounded:coastGroundAttached});
  if(coastGroundAttached){
    const reachable=coastSurface?.solid&&Number.isFinite(coastSurface.height)&&Math.abs(coastSurface.height-state.y)<.5;
    if(reachable){
      coastSupport=coastSurface;state.y=coastSupport.height;
      state.vy=-(coastSupport.normal.x*state.vx+coastSupport.normal.z*state.vz)/coastSupport.normal.y;
      state.coastSupportId=coastSupport.id;
    }else{coastGroundAttached=false;isAirborne=true;state.wasAirborne=true;state.coastSupportId=null;}
  }
  if (coastSurface?.water) state.isAutoLandingSave = false;
  // Recompute surface elevation after horizontal (x, z) movement
  groundElevation = Number.isFinite(coastSurface?.height) ? coastSurface.height : 0.0;
  if (currentMap === 'city' || currentMap === 'coast') {
    const mapBuildings = coastObstacles || cityNearbyBuildings(state);
    for (let i = 0; i < mapBuildings.length; i++) {
      const b = mapBuildings[i];
      if (coastWorld && state.y + 1.25 < (b.minY ?? 0)) continue;
      if (currentMap === 'city' ? cityTouchesRoof(state,b) : state.x > b.minX - 1.1 && state.x < b.maxX + 1.1 && state.z > b.minZ - 1.8 && state.z < b.maxZ + 1.8) {
        if (state.y >= b.height - 0.55) {
          groundElevation = Math.max(groundElevation, b.height);
        }
      }
    }
  }

  const agl = state.y - groundElevation;
  if (agl > 5.0) state.hasTriggeredHelipad = false;
  const downSpeed = Math.max(0.0, -state.vy);
  const cosTiltNow = Math.cos(state.roll) * Math.cos(state.pitch);

  const SAFE_TOUCHDOWN_V = 4.0;
  const AUTO_BRAKE_ACCEL = 58.0;
  const kinematicStopDist = Math.max(0.0, (downSpeed * downSpeed - SAFE_TOUCHDOWN_V * SAFE_TOUCHDOWN_V) / (2.0 * AUTO_BRAKE_ACCEL));
  const minSafeBrakeAlt = Math.max(1.8, kinematicStopDist + downSpeed * dt + 0.45);

  // Auto-landing save must ONLY engage when vehicle is falling fast towards ground, NEVER when climbing or hovering!
  const isDescendingTowardsGround = state.vy < -3.5 && !wantsHover && !state.isAltitudeHold && !state.isJumping6m;
  // Keep the existing braking law, but a rotated coast hull can meet the
  // selected real floor before its upright root reaches that floor.
  const landingClearance=coastWorld&&coastSurface?.solid?Math.min(agl,coastBodyGroundClearance(state,coastSurface)):agl;
  const needsEmergencyLandingSave = (
    !coastSurface?.water && isDescendingTowardsGround &&
    landingClearance > 0.02 &&
    landingClearance <= minSafeBrakeAlt &&
    (state.airRemaining > 0.01 || state.isAutoLandingSave) &&
    !state.isFreefalling &&
    (downSpeed > 5.5 || state.isAutoLandingSave || (landingClearance <= 3.0 && cosTiltNow < 0.55 && downSpeed > 2.5))
  );

  if (needsEmergencyLandingSave) {
    if (!state.isAutoLandingSave) {
      state.isAutoLandingSave = true;
      state.lastAutoSaveAlt = Math.max(2.2, agl);
      showBanner('autoland', 2.2);
      sound.speakAlert('autoland', 'Minimum braking altitude. Auto-landing thrusters engaged.', '已达极限安全高度，防坠毁自动喷气已启动。');
    }
    isLiftFiring = consumeAirTank(dt, true);
    // Smooth upward deceleration towards soft touchdown speed (-1.5 m/s).
    // An exhausted tank cannot supply a final frame of free braking.
    if (isLiftFiring) state.vy = Math.min(-1.5, state.vy + AUTO_BRAKE_ACCEL * dt);
    else state.isAutoLandingSave = false;

    // Emergency braking still protects descent; attitude assist respects manual control and its grace period.
    if (stabilizerDt > 0) {
      const levelBlend = 1.0 - Math.exp(-10.0 * stabilizerDt);
      state.roll -= wrapAnglePi(state.roll) * levelBlend;
      state.pitch -= wrapAnglePi(state.pitch) * levelBlend;
      state.vRoll *= Math.pow(0.20, stabilizerDt);
      state.vPitch *= Math.pow(0.20, stabilizerDt);
    }
  } else {
    state.isAutoLandingSave = false;
    // Manual Space or Shift cancels automated 6m jump or altitude hold
    if (wantsHover || wantsDescend) {
      if (state.isJumping6m && wantsDescend) state.isJumping6m = false;
      if (state.isAltitudeHold) {
        state.isAltitudeHold = false;
        const nBadge = document.getElementById('key-n');
        if (nBadge) nBadge.classList.remove('active');
      }
    }

    if (state.isJumping6m && !state.isFreefalling && state.airRemaining > 0) {
      // Fix Issue 8: O key jumps to 6.0m at 2.5x Space climb speed and consumes 200% of the air
      // that normal SPACE climb requires to reach this same height!
      const jumpClimbVy = currentMaxClimbVy * 2.5;
      const jumpLiftAccel = currentLiftAccel * 2.5;
      const totalJumpH = Math.max(1.0, (state.jumpTargetY || 6.0) - (state.jumpStartY ?? 0.0));
      const dRampNormal = (currentMaxClimbVy * currentMaxClimbVy) / (2.0 * currentLiftAccel);
      const normalClimbAirSec = (totalJumpH <= dRampNormal)
        ? Math.sqrt((2.0 * totalJumpH) / currentLiftAccel)
        : ((currentMaxClimbVy / currentLiftAccel) + (totalJumpH - dRampNormal) / currentMaxClimbVy);
      const jumpTotalDuration = totalJumpH / jumpClimbVy;
      // Burn rate per second so the jump consumes 200% (2.0x) of normalClimbAirSec
      const jumpBurnRatePerSec = (2.0 * normalClimbAirSec) / Math.max(0.05, jumpTotalDuration);
      const nextVy = Math.min(jumpClimbVy, Math.max(jumpClimbVy * 0.92, state.vy + jumpLiftAccel * dt));
      const stepDt = (state.y + nextVy * dt >= state.jumpTargetY)
        ? Math.max(0.0, (state.jumpTargetY - state.y) / Math.max(0.1, nextVy))
        : dt;

      if (stepDt === 0 || consumeAirTank(jumpBurnRatePerSec * stepDt, true)) {
        if (state.isAutoDescending8s) {
          state.isJumping6m = false;
          isLiftFiring = true;
          state.vy += (-3.2 - state.vy) * 6.0 * dt;
        } else {
          isLiftFiring = true;
          state.vy = nextVy;
          if (state.y + state.vy * dt >= state.jumpTargetY) {
            state.y = state.jumpTargetY;
            state.vy = 0.0;
            state.isJumping6m = false;
          }
        }
      } else {
        state.isJumping6m = false;
      }
    } else if (wantsHover && !state.isFreefalling && state.airRemaining > 0) {
      // Space climb speed & acceleration
      if (consumeAirTank(dt * driveInput.lift, true)) {
        if (state.isAutoDescending8s) {
          isLiftFiring = true;
          state.vy += (-3.2 - state.vy) * 6.0 * dt;
        } else {
          state.isAutoDescending8s = false;
          isLiftFiring = true;
          const maxAirVy = currentMaxClimbVy * 1.35;
          // Full stick matches Space. Partial thrust pays for and supplies only
          // its share of lift, including the force that counteracts gravity.
          const liftAccel = (currentLiftAccel + EARTH_GRAVITY_MPS2) * driveInput.lift - EARTH_GRAVITY_MPS2;
          state.vy = Math.min(maxAirVy, state.vy + liftAccel * dt);
        }
      }
    } else if ((state.isAltitudeHold || (agl > 0.15 && Boolean(keys['KeyN']))) && !state.isFreefalling && state.airRemaining > 0) {
      // Requirement 5: Mid-air N key holds current altitude with low continuous air consumption (0.22x rate)
      if (!state.isAltitudeHold) {
        state.isAltitudeHold = true;
        state.holdTargetY = state.y;
      }
      if (consumeAirTank(0.22 * dt, true)) {
        if (state.isAutoDescending8s) {
          isLiftFiring = true;
          state.vy += (-3.2 - state.vy) * 6.0 * dt;
        } else {
          isLiftFiring = true;
          const altError = state.holdTargetY - state.y;
          state.vy += (altError * 8.5 - state.vy * 9.5) * dt;
        }
      } else {
        state.isAltitudeHold = false;
      }
    }

    if (wantsDescend && agl > 0.02) {
      if (!state.isFreefalling && state.airRemaining > 0 && consumeAirTank(0.55 * driveInput.descend * dt, true)) {
        isDescendFiring = true;
        state.vy -= 18.5 * driveInput.descend * dt;
      }
    }
  }

  // Tank contents and physics mode do not change Earth gravity. This also
  // runs if a lift/hold/jump/save request depleted its tank in this frame.
  if (!coastGroundAttached && !isLiftFiring && (agl > 0 || state.vy > 0)) {
    freefallStartVy = state.vy;
    state.vy -= EARTH_GRAVITY_MPS2 * dt;
  }

  const prevY = state.y;
  if (coastGroundAttached && !isLiftFiring) {
    state.y = coastSupport.height;
  } else if (freefallStartVy !== null && !isDescendFiring) {
    const next = integrateFreefall(state.y, freefallStartVy, dt, coastWorld?-Infinity:groundElevation);
    state.y = next.y;
    state.vy = next.vy;
  } else {
    state.y += state.vy * dt;
  }
  const prevVy = state.vy;
  if (state.y > MAX_FLIGHT_ALTITUDE) {
    state.y = MAX_FLIGHT_ALTITUDE;
    state.vy = Math.min(0, state.vy);
  }

  // Top, bottom and bounded structural contacts are different events.
  const coastStructureHit=coastWorld?.network?.sweepStructures(coastMotionStart,state);
  if(coastStructureHit){
    const h=coastStructureHit,t=Math.max(0,h.t-1e-5),n=h.normal;
    const inward=state.vx*n.x+state.vy*n.y+state.vz*n.z,impact=Math.max(0,-inward);
    state.x=coastMotionStart.x+(state.x-coastMotionStart.x)*t;state.z=coastMotionStart.z+(state.z-coastMotionStart.z)*t;
    state.y=h.kind==='ceiling'?h.height-.002:coastMotionStart.y+(state.y-coastMotionStart.y)*t;
    if(inward<0){state.vx-=1.25*inward*n.x;state.vy-=1.25*inward*n.y;state.vz-=1.25*inward*n.z;}
    if(h.kind==='ceiling'){state.isJumping6m=false;state.isAltitudeHold=false;}
    state.speed=(state.vx*-Math.sin(state.yaw)+state.vz*-Math.cos(state.yaw)>=0?1:-1)*Math.hypot(state.vx,state.vz);
    if(coastGroundAttached)state.vy=-(coastSupport.normal.x*state.vx+coastSupport.normal.z*state.vz)/coastSupport.normal.y;
    triggerPhysicsCollision(impact,'crashReasonBuilding',0,1,0);if(state.isDestroyed)return;
  }
  const coastLanding=coastWorld&&!coastGroundAttached?coastWorld.network.sweepLanding(coastMotionStart,state):null;
  const contactFloorY = coastWorld ? (coastGroundAttached?coastSupport.height:coastLanding?.height??(coastSurface?.water?coastSurface.height:-Infinity)) : 0;
  if ((coastGroundAttached || coastLanding || state.vy <= 0) && state.y <= contactFloorY+(coastWorld ? .00001 : 0)) {
    if (coastSurface?.water&&!coastLanding) { resetCar(); return; }
    state.y = contactFloorY;
    if(coastLanding){state.x=coastLanding.x;state.z=coastLanding.z;}
    state.jumpInertiaGraceSeconds = null;
    const downImpactSpeed = coastWorld
      ? coastGroundAttached?0:Math.max(0,-(state.vx*(coastLanding?.normal.x||0)+prevVy*(coastLanding?.normal.y||1)+state.vz*(coastLanding?.normal.z||0)))
      : -prevVy;
    if (downImpactSpeed > 0.8) {
      state.suspensionSquash = Math.min(0.048, downImpactSpeed * 0.0035);
      state.suspensionVelocity = downImpactSpeed * 0.004;
    }
    state.vy = 0.0;
    if(coastWorld){coastSupport=coastLanding||coastSupport;coastGroundAttached=true;state.coastSupportId=coastSupport.id;state.wasAirborne=false;groundElevation=coastSupport.height;state.vy=-(coastSupport.normal.x*state.vx+coastSupport.normal.z*state.vz)/coastSupport.normal.y;}
    state.isAutoLandingSave = false;
    state.isJumping6m = false;
    if (state.isAltitudeHold) {
      state.isAltitudeHold = false;
      const nBadge = document.getElementById('key-n');
      if (nBadge) nBadge.classList.remove('active');
    }
    const cosTilt = Math.cos(state.roll) * Math.cos(state.pitch);
    if (downImpactSpeed > 15.5 || (downImpactSpeed > 7.5 && cosTilt < 0.25)) {
      const effectiveDv = downImpactSpeed * (cosTilt < 0.25 ? 1.85 : 1.15);
      if(currentMap==='city')window.RoadsterCityDiagnostics?.contact({kind:'ground',height:0,previousY:prevY,downImpactSpeed,cosTilt});
      triggerPhysicsCollision(effectiveDv, 'crashReasonGround', 0, 3.0, 0);
      if (state.isDestroyed) return;
    }

    // A firing retro jet uses the same tank; never recharge over its burn.
    if (!(coastWorld&&coastSupport?.id==='roof') && !isRetroBrakeFiring && ((!wantsHover && !isRearThrusterFiring) || state.isFreefalling)) {
      state.airRemaining = Math.min(MAX_AIR_SECONDS, state.airRemaining + 3.4 * dt);
      state.airUsedContinuous = MAX_AIR_SECONDS - state.airRemaining;
      if (state.airRemaining > 2.2) state.isAutoDescending8s = false;
      if (state.airRemaining >= 2.5 && !wantsHover) {
        state.isFreefalling = false;
      } else if (state.airRemaining >= 9.95) {
        state.isFreefalling = false;
      }
    }
  }

  // Requirement 3: All airborne attitude RCS jets (Roll, Pitch, Yaw) consume COPV air tank!
  canUseRCS = !state.isFreefalling && state.airRemaining > 0.005;
  let rollInput = 0;
  let pitchInput = 0;
  let yawInput = 0;
  if (canUseRCS && (rawRollInput !== 0 || rawPitchInput !== 0 || rawYawInput !== 0)) {
    const rcsBurn = (isAirborne ? 0.38 : 0.22) * Math.max(Math.abs(rawRollInput), Math.abs(rawPitchInput), Math.abs(rawYawInput)) * dt;
    if (consumeAirTank(rcsBurn, isAirborne)) {
      rollInput = rawRollInput;
      pitchInput = rawPitchInput;
      yawInput = rawYawInput;
    }
  }
  canUseRCS = !state.isFreefalling && state.airRemaining > 0.005;

  const rcsAuthority = isAirborne ? 1.0 : 0.35;

  state.roll = wrapAnglePi(state.roll);

  if (canUseRCS && rollInput !== 0) {
    state.vRoll += rollInput * 3.6 * rcsAuthority * dt;
    if (isAirborne) {
      state.vx -= rollInput * 1.6 * dt;
    }
  } else if (!isAirborne) {
    // Progressive anti-roll bar suspension response to lateral G-forces and steering
    const latG = state.lateralG || 0.0;
    const speedLean = THREE.MathUtils.clamp(Math.abs(state.speed) / 22.0, 0.0, 1.0);
    const targetGroundRoll = (-state.steerInput * 0.048 * speedLean) + (latG * 0.012);
    state.roll += (targetGroundRoll - state.roll) * 11.0 * dt;
    state.vRoll = 0.0;
  } else if (stabilizerDt > 0) {
    // Shortest-path + angular-momentum-assisted roll self-righting
    const predictedRoll = wrapAnglePi(state.roll + state.vRoll * 0.28);
    state.vRoll += (-predictedRoll * 7.8 - state.vRoll * 4.5) * stabilizerDt;
  }

  if (canUseRCS && pitchInput !== 0) {
    state.vPitch += pitchInput * 3.2 * rcsAuthority * dt;
    if (isAirborne) {
      state.vy += pitchInput * 1.1 * dt;
    }
  } else if (stabilizerDt > 0 || !isAirborne) {
    // Use the nearest equivalent level attitude without unwinding completed flips.
    const pitchError = wrapAnglePi(state.pitch);
    state.vPitch += (-pitchError * 6.5 - state.vPitch * 4.2) * (isAirborne ? stabilizerDt : dt);
  }

  if (isAirborne) {
    if (canUseRCS && yawInput !== 0) {
      state.vYaw += yawInput * 2.2 * rcsAuthority * dt;
    } else {
      // Smoothly damp yaw rate when A/D is released in mid-air so nose stays where aimed
      state.vYaw *= Math.pow(0.06, dt);
    }
  }

  state.vRoll *= Math.pow(0.20, dt);
  state.vPitch *= Math.pow(0.20, dt);
  state.vYaw *= Math.pow(0.25, dt);

  state.roll = wrapAnglePi(state.roll + state.vRoll * dt);
  // Wing attitude assist follows the same delayed stabilizer as the RCS springs.
  if (pitchInput === 0 && (stabilizerDt > 0 || !isAirborne) && Math.abs(state.speed) > 28.0) {
    const aeroPitchStab = Math.min(3.5, Math.pow(Math.abs(state.speed) / 35.0, 2)) * 0.45;
    state.vPitch += (-wrapAnglePi(state.pitch) * aeroPitchStab) * (isAirborne ? stabilizerDt : dt);
  }
  // Keep pitch continuous through +/-180 and complete forward/backward 360-degree loops.
  // THREE renders the Euler angle directly; no Euler extraction or airborne pitch clamp is needed.
  state.pitch += state.vPitch * dt;
  state.yaw += state.vYaw * dt;

  // Complete the coast contact after attitude integration as well: a legal
  // roll/pitch can touch the ground before the upright root descends to it.
  const coastHullLanding=coastWorld&&!coastGroundAttached?coastBodyGroundLanding(coastWorld,coastMotionStart,state):null;
  if(coastHullLanding){
    const normal=coastHullLanding.normal,downImpactSpeed=Math.max(0,-(state.vx*normal.x+state.vy*normal.y+state.vz*normal.z)),cosTilt=Math.cos(state.roll)*Math.cos(state.pitch);
    state.x=coastHullLanding.x;state.y=coastHullLanding.height;state.z=coastHullLanding.z;
    coastSupport=coastHullLanding;coastGroundAttached=true;state.coastSupportId=coastSupport.id;state.wasAirborne=false;groundElevation=coastSupport.height;
    state.vy=-(normal.x*state.vx+normal.z*state.vz)/normal.y;
    state.jumpInertiaGraceSeconds=null;state.isAutoLandingSave=false;state.isJumping6m=false;
    if(state.isAltitudeHold){state.isAltitudeHold=false;const badge=document.getElementById('key-n');if(badge)badge.classList.remove('active');}
    if(downImpactSpeed>.8){state.suspensionSquash=Math.min(.048,downImpactSpeed*.0035);state.suspensionVelocity=downImpactSpeed*.004;}
    if(downImpactSpeed>15.5||(downImpactSpeed>7.5&&cosTilt<.25)){triggerPhysicsCollision(downImpactSpeed*(cosTilt<.25?1.85:1.15),'crashReasonGround',0,3,0);if(state.isDestroyed)return;}
    if(!isRetroBrakeFiring&&((!wantsHover&&!isRearThrusterFiring)||state.isFreefalling)){
      state.airRemaining=Math.min(MAX_AIR_SECONDS,state.airRemaining+3.4*dt);state.airUsedContinuous=MAX_AIR_SECONDS-state.airRemaining;
      if(state.airRemaining>2.2)state.isAutoDescending8s=false;if(state.airRemaining>=2.5&&!wantsHover||state.airRemaining>=9.95)state.isFreefalling=false;
    }
  }
  if(coastGroundAttached){
    const plane=coastWorld.network.groundAttitude(coastSupport.normal,state.yaw);
    state.pitch=plane.pitch;state.roll=plane.roll;state.vPitch=state.vRoll=0;
  }
  const trueGroundAgl = Math.max(0.0, state.y - groundElevation);
  if (trueGroundAgl < 0.35) {
    const maxGroundPitch = THREE.MathUtils.lerp(0.14, 1.30, THREE.MathUtils.clamp(trueGroundAgl / 0.35, 0.0, 1.0));
    const slope=coastGroundAttached?coastWorld.network.groundAttitude(coastSupport.normal,state.yaw):{pitch:0,roll:0};
    const groundPitch = wrapAnglePi(state.pitch-slope.pitch);
    state.pitch += THREE.MathUtils.clamp(groundPitch, -maxGroundPitch, maxGroundPitch) - groundPitch;
    const maxGroundRoll = THREE.MathUtils.lerp(0.18, 3.14, THREE.MathUtils.clamp(trueGroundAgl / 0.35, 0.0, 1.0));
    state.roll = slope.roll+THREE.MathUtils.clamp(state.roll-slope.roll, -maxGroundRoll, maxGroundRoll);
    if (currentMap === 'highway' && trueGroundAgl < 0.15) {
      const groundYaw = wrapAnglePi(state.yaw);
      state.yaw += THREE.MathUtils.clamp(groundYaw, -0.85, 0.85) - groundYaw;
    }
    state.accumulatedRoll = 0;
  } else {
    state.accumulatedRoll += Math.abs(state.vRoll * dt);
    if (state.accumulatedRoll >= Math.PI * 1.85) {
      state.accumulatedRoll = 0;
      showBanner('stunt', 2.2);
      sound.beep(880, 0.18);
    }
  }

  if (currentMap === 'city' || currentMap === 'coast') {
    const mapBuildings = coastObstacles || cityNearbyBuildings(state);
    for (let i = 0; i < mapBuildings.length; i++) {
      const b = mapBuildings[i];
      if (coastWorld && state.y + 1.25 < (b.minY ?? 0)) continue;
      if (currentMap === 'city' ? cityTouchesBuilding(state,b) : state.x > b.minX - 1.1 && state.x < b.maxX + 1.1 && state.z > b.minZ - 1.8 && state.z < b.maxZ + 1.8) {
        if (state.y > b.height + 0.08) {
          // Flying freely in the air above the building roof — do NOT teleport or snap down!
          continue;
        } else if (prevY >= b.height - 0.55 && state.y <= b.height && state.vy <= 0 && (currentMap!=='city'||cityCanLandOnRoof(state,b))) {
          // Actually touching down onto or resting on the building roof
          const downImpactSpeed = -prevVy;
          if (downImpactSpeed > 0.8) {
            state.suspensionSquash = Math.min(0.048, downImpactSpeed * 0.0035);
            state.suspensionVelocity = downImpactSpeed * 0.004;
          }
          const cosTilt = Math.cos(state.roll) * Math.cos(state.pitch);
          state.y = b.height;
          state.vy = 0;
          if(coastWorld){coastSupport={id:'roof',height:b.height,solid:true,water:false,normal:{x:0,y:1,z:0}};coastGroundAttached=true;isAirborne=false;state.wasAirborne=false;state.coastSupportId='roof';}
          state.isAutoLandingSave = false;
          state.isJumping6m = false;
          if (state.isAltitudeHold) {
            state.isAltitudeHold = false;
            const nBadge = document.getElementById('key-n');
            if (nBadge) nBadge.classList.remove('active');
          }

          if (downImpactSpeed > 15.5 || (downImpactSpeed > 7.5 && cosTilt < 0.25)) {
            const effectiveDv = downImpactSpeed * (cosTilt < 0.25 ? 1.85 : 1.15);
            if(currentMap==='city')window.RoadsterCityDiagnostics?.contact({kind:'building-roof',id:b.id,logicalId:b.logicalId,bounds:{minX:b.minX,maxX:b.maxX,minZ:b.minZ,maxZ:b.maxZ,minY:b.minY||0,height:b.height},verifiedSolid:true,downImpactSpeed,cosTilt});
            triggerPhysicsCollision(effectiveDv, 'crashReasonGround', 0, 3.0, 0);
            if (state.isDestroyed) return;
          }

          // Roofs/helipads obey the same no-refill-while-firing rule as roads.
          if (!isRetroBrakeFiring && !isRearThrusterFiring && !isLiftFiring && !isDescendFiring) {
            const rechargeRate = b.isHelipad ? 10.0 : 4.0;
            state.airRemaining = Math.min(MAX_AIR_SECONDS, state.airRemaining + rechargeRate * dt);
            state.airUsedContinuous = MAX_AIR_SECONDS - state.airRemaining;
            state.isFreefalling = false;
            state.isAutoDescending8s = false;
          }
          if (b.isHelipad && !state.hasTriggeredHelipad) {
            state.hasTriggeredHelipad = true;
            showBanner('helipad', 2.8);
            sound.speakAlert('helipad', 'Helipad touchdown. Release thrusters to recharge the tank.', '停机坪降落成功，松开喷气后补充高压气瓶。');
          }
        } else if (state.y < b.height - 0.55) {
          if(currentMap==='city'){
            const contact=cityBuildingContact(state,b);if(!contact)continue;
            state.x+=contact.x*(contact.depth+.005);state.z+=contact.z*(contact.depth+.005);
            const normalSpeed=Math.max(0,-state.vx*contact.x-state.vz*contact.z);
            if(normalSpeed>.1){
              state.vx+=1.3*normalSpeed*contact.x;state.vz+=1.3*normalSpeed*contact.z;
              state.speed=isAirborne?Math.hypot(state.vx,state.vz):-state.vx*Math.sin(state.yaw)-state.vz*Math.cos(state.yaw);
              window.RoadsterCityDiagnostics?.contact({kind:'building-wall',id:b.id,logicalId:b.logicalId,bounds:{minX:b.minX,maxX:b.maxX,minZ:b.minZ,maxZ:b.maxZ,minY:b.minY||0,height:b.height},verifiedSolid:true,normal:contact});
              triggerPhysicsCollision(Math.max(12,normalSpeed),'crashReasonThreshold',0,2,0);if(state.isDestroyed)return;
            }
            continue;
          }
          const impactSpeed = Math.hypot(state.vx, state.vz, state.vy * 0.5);
          const dLeft = Math.abs(state.x - (b.minX - 1.1));
          const dRight = Math.abs(state.x - (b.maxX + 1.1));
          const dFront = Math.abs(state.z - (b.minZ - 1.8));
          const dBack = Math.abs(state.z - (b.maxZ + 1.8));
          const minD = Math.min(dLeft, dRight, dFront, dBack);
          if (minD === dLeft) state.x = b.minX - 1.2;
          else if (minD === dRight) state.x = b.maxX + 1.2;
          else if (minD === dFront) state.z = b.minZ - 1.9;
          else state.z = b.maxZ + 1.9;

          if (isAirborne) {
            state.vx *= -0.3;
            state.vz *= -0.3;
            state.speed = Math.hypot(state.vx, state.vz);
          } else {
            state.speed *= -0.3;
          }
          triggerPhysicsCollision(Math.max(12, impactSpeed), 'crashReasonThreshold', isAirborne ? 0 : -state.vx * 0.5, 2.0, isAirborne ? 0 : -state.vz * 0.5);
          if (state.isDestroyed) return;
        }
      }
    }
  }


  const playerWorldZ=0;
  highwayTraffic.forecastStep(trafficCars,{x:state.x,y:state.y,z:0,vx:state.vx,vz:state.vz},dt,LANE_CENTERS,WORLD_SPEED_SCALE);
  trafficCars.forEach((car,carIndex)=>{
    const dx = Math.abs(state.x - car.mesh.position.x);
    const dz = Math.abs(playerWorldZ - car.mesh.position.z);
    const npcWorldY=currentMap==='coast'||currentMap==='city'?(car.mesh.position.y||0):0;
    let clearanceY = state.y - npcWorldY - car.height;

    // The faster demo rack also checks the complete relative movement chord.
    // A narrow corner contact cannot disappear between frames. Respawn jumps
    // are excluded; manual collision detection and response stay unchanged.
    const demoPreviousCar = demoGroundSweep?.cars.get(car);
    const demoSweptHit = demoPreviousCar && car.mesh.visible!==false && car.highwayWaitingToSpawn===undefined
      && !car.highwayPassedThisFrame && Math.abs(car.mesh.position.z-demoPreviousCar.z)<2+dt*(Math.abs(state.vz)+Math.abs(car.speed))*WORLD_SPEED_SCALE
      && demoGroundSweep.y<car.height-0.15 && state.y<car.height-0.15
      ? RoadsterHighwayDemoPlanner.sweptContact(demoPreviousCar.x-demoGroundSweep.x,demoPreviousCar.z,
        car.mesh.position.x-state.x,car.mesh.position.z,1.85,car.length/2+2.15)!==null : false;
    const coastOld = currentMap === 'coast' ? coastTrafficStart?.get(car) : null;
    const coastVisualEnd=currentMap==='coast'?{...state,y:state.y-(state.suspensionSquash||0)-(state.aeroSquash||0),pitch:state.pitch+(!isAirborne?(typeof isAccelerating!=='undefined'&&isAccelerating?(typeof isRearThrusterFiring!=='undefined'&&isRearThrusterFiring ? .032 : .016):(typeof isFootBraking!=='undefined'&&isFootBraking||typeof isReversing!=='undefined'&&isReversing)?-.026:0):0),roll:state.roll+(!isAirborne?-(state.steerInput||0)*.032:0)}:null;
    const coastContact=currentMap==='coast'&&coastOld&&coastOld.visible!==false&&car.mode==='coast'&&!car.blastTimer?coastVehicleContact(coastMotionStart.contactPose||coastMotionStart,coastVisualEnd,coastOld,car):null;
    if(coastContact){
      const relVx=state.vx-(car.vx||0),relVy=state.vy-(car.vy||0),relVz=state.vz-(car.vz||0),closing=Math.max(0,-relVx*coastContact.x-relVy*coastContact.y-relVz*coastContact.z+coastContact.angularClosingPerFraction/Math.max(dt,1e-6));
      // Rewind only the player to certified first contact. NPC route distance
      // remains authoritative; a normal impulse does not reverse tangent speed.
      const t=Math.max(0,coastContact.t-1e-6);for(const k of['x','y','z'])state[k]=coastMotionStart[k]+(state[k]-coastMotionStart[k])*t;
      const endContact=coastContactSeparation(cityPlayerBody({...state,y:state.y-(state.suspensionSquash||0)-(state.aeroSquash||0),pitch:coastVisualEnd.pitch,roll:coastVisualEnd.roll}),coastTrafficBody(car,{x:car.mesh.position.x,y:car.mesh.position.y,z:car.mesh.position.z,pitch:car.mesh.rotation.x,yaw:car.mesh.rotation.y,roll:car.mesh.rotation.z}));
      const push=endContact.gap<0?endContact.depth+.0001:.0001,pushNormal=endContact.gap<0?endContact:coastContact;state.x+=pushNormal.x*push;state.y+=pushNormal.y*push;state.z+=pushNormal.z*push;
      if(coastContact.y>.65&&state.vy<0&&closing<=18){state.vy=Math.max(5.5,state.vy+closing*coastContact.y);sound.beep(520,.08);}
      else if(closing>.1){globalThis.window?.RoadsterCoast?.hit(car);state.vx+=1.35*closing*coastContact.x;state.vy+=1.35*closing*coastContact.y;state.vz+=1.35*closing*coastContact.z;triggerPhysicsCollision(closing,'crashReasonThreshold',0,0,0);}
      state.speed=isAirborne?Math.hypot(state.vx,state.vz):-state.vx*Math.sin(state.yaw)-state.vz*Math.cos(state.yaw);return;
    }
    // No other coastal AABB/roof-cushion path may promote a broad-phase gap.
    if(currentMap==='coast')return;
    const cityNear=currentMap==='city'&&dx<10&&dz<10&&Math.abs(state.y-npcWorldY)<10;
    const cityPlayer=cityNear?cityPlayerBody(state):null,cityNpc=cityNear?cityTrafficBody(car):null;
    // Preserve the existing gentle roof-touch cushion separately from solid-body
    // contact. It may bounce a descending car, never trigger a side-gap crash.
    const cityRoofTouch=cityNear&&clearanceY>=-.15&&clearanceY<.15&&state.vy<0&&state.vy>=-18&&cityHorizontalContact(cityPlayer,cityNpc);
    const citySolidContact=cityNear&&cityContactInterval(cityPlayer,cityNpc)!==null;
    const cityBodyOverlap=cityNear&&(cityRoofTouch||citySolidContact);
    const bodyOverlap = currentMap==='city'?cityBodyOverlap:dx < 1.85 && dz < (car.length / 2 + 2.15);
    if (bodyOverlap || demoSweptHit) {
      if (clearanceY >= -0.15 && clearanceY < 1.1) {
        if (state.vy < -18.0 && (currentMap!=='city'||citySolidContact)) {
          if(currentMap==='city')window.RoadsterCityDiagnostics?.contact({kind:'traffic-roof',variant:car.mesh.userData?.trafficVariant,position:{...car.mesh.position},verifiedSolid:citySolidContact});
          triggerPhysicsCollision(Math.abs(state.vy), 'crashReasonThreshold', 0, 5.0, 0);
        } else if (state.vy < 0 && clearanceY < 0.15) {
          stop('npc-roof-bounce-contact', {index:carIndex}, 'collision');
          state.y = npcWorldY + car.height + 0.15;
          state.vy = 5.5;
          sound.beep(520, 0.08);
        }
      } else if (clearanceY < -0.15) {
        stop('npc-body-contact', {index:carIndex}, 'collision');
        const relVx = state.vx - (car.vx || 0);
        const relVz = state.vz - (car.vz || 0);
        if(currentMap==='city'){
          const contact=cityContactDetails(cityPlayerBody(state),cityTrafficBody(car));if(!contact)return;
          state.x+=contact.x*(contact.depth+.005);state.y+=contact.y*(contact.depth+.005);state.z+=contact.z*(contact.depth+.005);
          const npcVy=car.blastTimer?(car.blastVy||0):0,normalSpeed=Math.max(0,-relVx*contact.x-(state.vy-npcVy)*contact.y-relVz*contact.z);
          if(normalSpeed>.1){window.RoadsterCityDiagnostics?.contact({kind:'traffic-body',variant:car.mesh.userData?.trafficVariant,position:{x:car.mesh.position.x,y:car.mesh.position.y,z:car.mesh.position.z},verifiedSolid:true,normal:contact});state.vx+=1.35*normalSpeed*contact.x;state.vy+=1.35*normalSpeed*contact.y;state.vz+=1.35*normalSpeed*contact.z;state.speed=isAirborne?Math.hypot(state.vx,state.vz):-state.vx*Math.sin(state.yaw)-state.vz*Math.cos(state.yaw);triggerPhysicsCollision(normalSpeed,'crashReasonThreshold',0,0,0);}
          return;
        }
        const deltaV = Math.hypot(relVx, relVz, (state.vy-(currentMap==='coast'?(car.vy||0):0)) * 0.5);

        if (currentMap === 'highway') {
          car.mesh.position.z -= 8.0;
          if (isAirborne) {
            const horizontalSpeed = Math.hypot(state.vx, state.vz);
            const reducedSpeed = Math.min(horizontalSpeed, Math.max(14.0, horizontalSpeed * 0.58));
            const collisionScale = horizontalSpeed > 0 ? reducedSpeed / horizontalSpeed : 0;
            state.vx *= collisionScale;
            state.vz *= collisionScale;
            state.speed = Math.hypot(state.vx, state.vz);
          } else {
            state.speed = Math.max(14.0, state.speed * 0.58);
          }
        } else {
          car.mesh.position.x += Math.sign(car.mesh.position.x - state.x || 1) * 5.0;
          car.mesh.position.z += Math.sign(car.mesh.position.z - state.z || 1) * 5.0;
          if (isAirborne) {
            state.vx *= -0.35;
            state.vz *= -0.35;
            state.speed = Math.hypot(state.vx, state.vz);
          } else {
            state.speed *= -0.35;
          }
        }

        const pushX = Math.sign(state.x - car.mesh.position.x || 1) * 7.5;
        triggerPhysicsCollision(deltaV, 'crashReasonThreshold', pushX, 2.2, 0);
      }
    }
  });
  const accelMs2 = (state.speed - (state.prevSpeed || state.speed)) / Math.max(0.001, dt);
  state.prevSpeed = state.speed;
  state.longitudinalG = THREE.MathUtils.lerp(state.longitudinalG || 0, -accelMs2 / 9.81, 10 * dt);
  const latAccel = isAirborne ? (Math.sin(state.roll) * 18.0 + state.vYaw * 12.0) : (-state.steerAngle * Math.abs(state.speed) * 0.85);
  state.lateralG = THREE.MathUtils.lerp(state.lateralG || 0, latAccel / 9.81, 10 * dt);

  return {state,cars:trafficCars,events,dt,isAirborne,isRearThrusterFiring,isLiftFiring,airConsumedThisFrame};
}
numeric.probeBoundary=kind=>{
  const {sound,document}=receivers({}, {audioInitialized:false}, []);
  if(kind==='random')return Math.random();
  if(kind==='unknown-sound')return sound.unsupportedMethod();
  if(kind==='unknown-dom')return document.getElementById('unsupported-node');
  if(kind==='audio-init')return sound.init();
  if(kind==='collision')return stop('physics-impact-request',null,'collision');
  return stop('unknown-boundary-probe',kind);
};
return numeric;

}
function instantiateBrowserProjectionKernel({ manifest, assertRuntime }) {
  const assertSources = assertRuntime;
  assertSources();
  const stop = (reason, detail = null, kind = 'unsupported') => {
    const error = Error(reason); error.projectionBoundary = true;
    error.kind = kind; error.detail = detail; throw error;
  };
  // No ambient Math.random is called or patched. The only supported math
  // helpers are exact official-r128 clamp/lerp copied into programSource.
  const math = Object.create(Math);
  Object.defineProperty(math, 'random', { value: () => stop('random-call'), writable: false });
  Object.freeze(math);
  const numeric = createNumericCore(math, stop);
  const failure = error => {
    if (!error.projectionBoundary) return { supported: false, collision: false,
      unsupported: { reason: 'unexpected-execution-boundary', name: error.name, message: error.message },
      state: null, cars: null, eligibleForComparison: false, reuseAuthorized: false };
    return { supported: false, collision: error.kind === 'collision',
      unsupported: error.kind === 'collision' ? null : { reason: error.message, detail: error.detail },
      contact: error.kind === 'collision' ? { reason: error.message, detail: error.detail } : null,
      state: null, cars: null, eligibleForComparison: false, reuseAuthorized: false };
  };
  const validate = request => {
    if (!request || typeof request !== 'object') stop('missing-request');
    const cloned = cloneSnapshot(request);
    const { state, cars, input, external } = cloned;
    if (!state || !Array.isArray(cars) || !input || !external) stop('missing-snapshot-input-or-external');
    if (Object.hasOwn(cloned, 'dt') && cloned.dt !== 1 / 60) stop('unsupported-step-dt');
    if (external.map !== 'highway' || external.active !== true || external.busy !== true)
      stop('unsupported-map-or-input-ownership');
    if (external.weatherIndex !== 0) stop('unsupported-weather-or-missing-weather-binding');
    if (typeof external.audioInitialized !== 'boolean') stop('missing-audio-initialized-binding');
    if (state.physicsMode !== 'realistic' || state.insaneMode !== false) stop('unsupported-physics-mode');
    if (state.isDestroyed !== false || state.isFreefalling !== false || state.impactCooldown !== 0 || state.isAltitudeHold !== false)
      stop('unsupported-destruction-freefall-cooldown-or-hold');
    const nullable = new Set(['jumpInertiaSeconds', 'jumpInertiaGraceSeconds', 'jumpStartY']);
    const flags = new Set(['physicsMode', 'insaneMode', 'infiniteJet', 'isFreefalling', 'isAutoDescending8s', 'isJumping6m',
      'isAltitudeHold', 'isAutoLandingSave', 'wasAirborne', 'isDrifting', 'wasHandbraking',
      'autoStabilizer', 'isDestroyed', 'hudMode', 'hudMinimal']);
    for (const key of flags) {
      if (key === 'physicsMode' || key === 'hudMode') continue;
      if (key === 'wasHandbraking' && state[key] === undefined) continue;
      if (typeof state[key] !== 'boolean') stop('invalid-control-physics-flag', key);
    }
    if (!['full', 'medium', 'minimal'].includes(state.hudMode)) stop('invalid-hud-mode');
    for (const key of CONTROL_PHYSICS_KEYS) {
      if (nullable.has(key) && (state[key] === null || state[key] === undefined)) continue;
      if (key === 'wasHandbraking' && state[key] === undefined) continue;
      if (!flags.has(key) && !Number.isFinite(state[key])) stop('invalid-control-physics-field', key);
    }
    const inputs = ['steer', 'throttle', 'boost', 'brake', 'reverse', 'handbrake', 'lift', 'descend', 'strafe', 'roll', 'pitch'];
    if (Object.keys(input).some(key => !inputs.includes(key))) stop('unknown-input-field');
    for (const key of inputs) if (!Number.isFinite(input[key]) || Math.abs(input[key]) > 1 ||
      (!['steer', 'strafe', 'roll', 'pitch'].includes(key) && input[key] < 0)) stop('invalid-drive-input', key);
    if (input.roll !== 0 || input.pitch !== 0 || input.lift !== 0 || input.descend !== 0)
      stop('unsupported-manual-rcs-lift-or-descend');
    const airborne = state.y > 0.15 || (state.isJumping6m && state.vy > 0);
    if (airborne && (input.boost !== 0 || input.throttle !== 0)) stop('unsupported-air-propulsion');
    const keys = external.keys;
    if (!Object.hasOwn(external, 'keys') || keys === null || typeof keys !== 'object' || Array.isArray(keys))
      stop('missing-or-invalid-direct-key-binding');
    if (Object.values(keys).some(value => typeof value !== 'boolean')) stop('nonboolean-direct-key');
    if (Object.values(keys).some(value => value)) stop('unsupported-direct-key');
    for (const [index, car] of cars.entries()) {
      if (car.mode !== 'highway' || car.blastTimer > 0 || (car.y || 0) !== 0 || car.recoverHighwayLane)
        stop('unsupported-npc-mode-blast-or-recovery', index);
      if (!car.mesh?.position || !car.mesh?.rotation || typeof car.mesh.visible !== 'boolean') stop('incomplete-npc-mesh-snapshot', index);
      for (const vector of [car.mesh.position, car.mesh.rotation])
        for (const axis of ['x', 'y', 'z']) if (!Number.isFinite(vector[axis])) stop('invalid-npc-transform', { index, axis });
      for (const key of ['speed', 'length', 'height']) if (!Number.isFinite(car[key])) stop('invalid-npc-field', { index, key });
    }
    return { ...cloned, keys };
  };
  const run = (request, jumpOnly) => {
    // Source mismatch is an explicit exception, never converted into a usable
    // fallback. Tests can catch its PROJECTION_SOURCE_MISMATCH code.
    assertSources();
    try {
      const cloned = validate(request);
      if (jumpOnly && cloned.external.audioInitialized !== true) stop('jump-requires-initialized-audio');
      if (jumpOnly && (cloned.external.requestingJump !== true ||
        !Number.isFinite(cloned.jumpHeight) || !Number.isFinite(cloned.jumpGraceSeconds))) stop('missing-jump-contract');
      const result = numeric(cloned, jumpOnly);
      if (!result) stop('numeric-body-returned-without-result');
      return { supported: true, collision: false, unsupported: null, ...result,
        controlState: Object.fromEntries(CONTROL_PHYSICS_KEYS.map(key => [key, result.state[key]])),
        eligibleForComparison: true, reuseAuthorized: false };
    } catch (error) { return failure(error); }
  };
  return Object.freeze({
    manifest, fixedDt: 1 / 60, controlPhysicsKeys: CONTROL_PHYSICS_KEYS,
    step: request => run(request, false),
    triggerJump6m: request => run(request, true),
    assertSources,
    // Executes only the same boundary guards, never physics or a planner.
    // Negative tests can verify random/unknown visual/impact rejection directly.
    probeBoundary: kind => {
      assertSources();
      try { numeric.probeBoundary(kind); return { rejected: false }; }
      catch (error) { return { rejected: true, ...failure(error) }; }
    }
  });
}
const readActualReferences=()=>({functions:{updateSimulation,wrapAnglePi,getAirCoastSpeed,advanceAirHandling,getResponsiveAirCoastSpeed,addAirThrust,getGroundCoastSpeed,accelerateGroundSpeed,getRetroBrakeDemand,integrateFreefall,readDriveInput,readAttitudeInput,advanceAttitudeIdle,triggerJump6m,trafficStep:highwayTraffic.step,trafficForecastStep:highwayTraffic.forecastStep,demoSweptContact:RoadsterHighwayDemoPlanner.sweptContact},math:{clamp:THREE.MathUtils.clamp,lerp:THREE.MathUtils.lerp},constants:{ROAD_WIDTH,LANE_COUNT,LANE_WIDTH,LANE_CENTERS,CITY_HALF_BOUND,MAX_FLIGHT_ALTITUDE,CITY_ROAD_COORDS,CITY_ROAD_WIDTH,CITY_LANE_WIDTH,CITY_DEFAULT_LANE_OFFSET,CITY_TAXI_STOP_OFFSET,CITY_BUILDING_SETBACK,WORLD_SPEED_SCALE,CITY_WORLD_SPEED_SCALE,EARTH_GRAVITY_MPS2,MAX_AIR_SECONDS,AUTO_DESCENT_USED_SECONDS,VEHICLE_MASS_KG,CRITICAL_IMPACT_DV,CRITICAL_G_LIMIT,RETRO_BRAKE_START_MPS,RETRO_BRAKE_FULL_MPS,RETRO_BRAKE_FORCE_N,RETRO_BRAKE_BURN_PER_SECOND,STANDARD_EV_MAX_MPS,STANDARD_EV_OVERSPEED_COAST_FACTOR,PASSIVE_AERO_DRAG_PER_METER,JUMP_INERTIA_GRACE_SECONDS,JUMP_INERTIA_BLEND_SECONDS},handling:RoadsterHighwayDemoPlanner.handling});
function createBound(readReferences){const binding=makeIdentityBinder({readReferences,expectedFunctions,expectedConstants,expectedHandling,profiles});const kernel=instantiateBrowserProjectionKernel({manifest,assertRuntime:binding.assertRuntime});return Object.freeze({...kernel,assertRuntime:binding.assertRuntime,identity:binding.identity});}
return Object.freeze({manifest,create:()=>createBound(readActualReferences),createForVerification:readReferences=>{if(typeof readReferences!=='function')throw TypeError('Explicit verification-only reference reader required');return createBound(readReferences);}});
})();
