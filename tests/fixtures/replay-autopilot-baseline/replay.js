// RAM-only scene replay. Deliberately no serialization, storage or network API.
// Physics remains the sole driving owner. Playback changes presentation only.
(() => {
  'use strict';
  const S = RoadsterReplayCore.STRIDE;
  let buffer = RoadsterReplayCore.create(), mode = 'drive', bindings = [], baseCount = 0;
  let elapsed = 0, nextSample = 0, playhead = 0, speed = 1, loop = false, checkpoint = null;
  let metadata = null, message = '', open = false, resetGeneration = 0;
  let lastDestroyed = false, lastAirborne = false, pendingCut = false, cameraMode = 'chase', targetIndex = 0;
  const debrisIds = new Map(), held = new Set(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  const effectRoot = new THREE.Group(); effectRoot.name = 'temporary-replay-debris'; effectRoot.visible = false; scene.add(effectRoot);
  const free = { yaw: 0, pitch: -.12, distance: 8, initialized: false, position: new THREE.Vector3(), drag: null };
  const $ = id => document.getElementById(id);
  const zh = () => currentLang === 'zh';
  const active = () => mode === 'playing' || mode === 'paused';
  const busy = () => mode !== 'drive';
  const text = (en, cn) => zh() ? cn : en;
  const signature = () => `${currentMap}|${trafficCars.length}|${paintIndex}|${weatherIndex}|${window.RoadsterVehicle?.getModel?.() || ''}|${window.RoadsterVehicle?.getCockpit?.() || ''}`;
  const matchesScene = () => metadata && metadata.signature === signature() && metadata.population === trafficCars;
  const overlayOpen = () => ['modal-map-select', 'modal-help'].some(id => { const n = $(id); return n && !n.classList.contains('hidden'); }) ||
    window.RoadsterRanked?.isDialogOpen?.() || window.RoadsterMusic?.isSettingsOpen?.() || window.RoadsterStart?.isPaintOpen?.() || window.RoadsterRenderHealth?.isPaused?.();
  function add(node, options = {}) {
    if (!node) return;
    let playerTree = false; for (let p = node; p; p = p.parent) if (p === playerWrapper) { playerTree = true; break; }
    bindings.push({ node, generation: 0, playerTree, ...options });
  }
  function buildBindings() {
    bindings = []; debrisIds.clear();
    add(playerWrapper, { player: true }); add(roadsterAttitudeGroup); add(carMeshGroup);
    for (const car of trafficCars) add(car.mesh, { car });
    for (const node of [...wheels, ...frontWheelSteerGroups, activeWingGroup, rearNozzlesGimbalGroup, yokeWheelGroup, sonicBoomConeGroup]) add(node, { wheel: wheels.includes(node), steeringOnly: node === yokeWheelGroup });
    for (const plume of allThrusterPlumes) { add(plume, { plume: true }); add(plume.children[0]); }
    add(sonicBoomConeGroup.children[0]);
    // Capture actual animated lamps, including the reference model's linked ones.
    const dynamicMaterials = new Set([turnSignalMatL, turnSignalMatR, tailLightMat, chmslMat, reverseLightMat, rotorMat]);
    const seenMaterials = new Set();
    playerWrapper.traverse(node => { if (node.isLight || (dynamicMaterials.has(node.material) && !seenMaterials.has(node.material))) { add(node); if (node.material) seenMaterials.add(node.material); } });
    if (currentMap === 'highway') for (const node of scrollingProps) add(node, { wrap: true });
    baseCount = bindings.length;
    for (const b of bindings) if (b.car) { b.token = trafficToken(b); b.tickPose = b.node.position.clone(); }
  }
  const trafficToken = b => `${Number(b.node.visible)}|${b.car.coastSpawnCursor ?? ''}|${b.car.highwayWaitingToSpawn ?? ''}|${Number((b.car.blastTimer || 0) > 0)}`;
  function dataFor(binding, out, o) {
    const n = binding.node, m = n.material && !Array.isArray(n.material) ? n.material : null;
    const p = n.position, q = n.quaternion, scale = n.scale;
    out[o] = p.x; out[o + 1] = p.y; out[o + 2] = p.z;
    out[o + 3] = q.x; out[o + 4] = q.y; out[o + 5] = q.z; out[o + 6] = q.w;
    out[o + 7] = scale.x; out[o + 8] = scale.y; out[o + 9] = scale.z;
    out[o + 10] = binding.debris ? Number(n.parent === debrisGroup) : Number(n.visible);
    out[o + 11] = m?.opacity ?? 1; out[o + 12] = (m?.color || n.color)?.getHex?.() ?? -1;
    out[o + 13] = m?.uniforms?.uPower?.value ?? 0;
    out[o + 14] = m?.uniforms?.uOpacity?.value ?? 0;
    out[o + 15] = n.isLight ? n.intensity : 0;
    out[o + 16] = binding.generation + (binding.playerTree ? resetGeneration : 0);
    out[o + 17] = binding.wheel ? n.rotation.x : binding.steeringOnly ? n.rotation.z : coldGasTime.value;
  }
  function applyOne(binding, a, b, o, alpha, restoring = false) {
    const n = binding.replayNode || binding.node;
    if (o + S > a.length) { if (binding.debris) n.visible = false; return; }
    const smooth = RoadsterReplayCore.continuous(a, b, o);
    const t = smooth ? alpha : 0, mix = k => a[o + k] + ((b[o + k] ?? a[o + k]) - a[o + k]) * t;
    if (!binding.steeringOnly || restoring) n.position.set(mix(0), mix(1), mix(2));
    if (binding.steeringOnly && !restoring) n.rotation.z = mix(17);
    else { qa.fromArray(a, o + 3); if (smooth) { qb.fromArray(b, o + 3); qa.slerp(qb, t); } n.quaternion.copy(qa); }
    if (binding.wheel) n.rotation.x = mix(17);
    if (!binding.steeringOnly || restoring) n.scale.set(mix(7), mix(8), mix(9)); n.visible = Boolean(a[o + 10]);
    const m = n.material && !Array.isArray(n.material) ? n.material : null;
    if (m) { m.opacity = mix(11); if (m.color && a[o + 12] >= 0) m.color.setHex(a[o + 12]);
      if (m.uniforms?.uPower) m.uniforms.uPower.value = mix(13);
      if (m.uniforms?.uOpacity) m.uniforms.uOpacity.value = mix(14);
    }
    if (n.isLight) { n.intensity = mix(15); if (a[o + 12] >= 0) n.color.setHex(a[o + 12]); }
  }
  function snapshotLive() {
    const values = new Float64Array(bindings.length * S); bindings.forEach((b, i) => dataFor(b, values, i * S));
    const visible = []; playerWrapper.traverse(n => visible.push([n, n.visible]));
    return { values, visible, camera: { position: camera.position.clone(), quaternion: camera.quaternion.clone(), up: camera.up.clone(), near: camera.near, fov: camera.fov },
      effects: [debrisGroup.visible, explosionGroup.visible, tireSmokeGroup.visible, rainLinesMesh.visible], coldTime: coldGasTime.value,
      destroyedModalHidden: $('modal-destroyed')?.classList.contains('hidden'),
      taxiMarker: scene.getObjectByName('taxi-passenger-markers'), taxiMarkerVisible: scene.getObjectByName('taxi-passenger-markers')?.visible };
  }
  function clearInput() { held.clear(); free.drag = null; clearAllInputKeys(); window.RoadsterTouch?.clear?.(); }
  function resetClock() { window.RoadsterCityFrame?.reset?.(); window.RoadsterCoastFrame?.reset?.(); lastTime = performance.now(); resetChaseCamera(); }
  function finish(reason = '') {
    if (mode !== 'recording') return;
    mode = 'drive'; message = reason || buffer.stats().reason; renderUi();
  }
  function capture(force = false) {
    if (mode !== 'recording') return;
    if (!matchesScene()) { finish('configuration'); return; }
    // Real debris meshes and their actual transforms, not a regenerated crash.
    for (const piece of debrisPieces) if (!debrisIds.has(piece.mesh)) {
      const geometryBytes = Object.values(piece.mesh.geometry.attributes).reduce((n, a) => n + a.array.byteLength, 0) + (piece.mesh.geometry.index?.array.byteLength || 0) + 1024;
      if (debrisIds.size >= 256 || !buffer.reserve(geometryBytes)) { finish('memory'); return; }
      const clone = piece.mesh.clone(false); clone.visible = false; effectRoot.add(clone);
      const binding = { node: piece.mesh, replayNode: clone, debris: true, generation: 0 };
      debrisIds.set(piece.mesh, binding); bindings.push(binding); force = true;
    }
    if (!force && elapsed + 1e-9 < nextSample) return;
    const values = new Float32Array(bindings.length * S);
    bindings.forEach((b, i) => {
      dataFor(b, values, i * S);
      if (b.car) { const p = b.node.position; if (b.last && Math.hypot(p.x - b.last.x, p.y - b.last.y, p.z - b.last.z) >= 40) b.generation++;
        b.last = { x: p.x, y: p.y, z: p.z }; values[i * S + 16] = b.generation; }
    });
    if (!buffer.append(elapsed, values)) { finish(buffer.stats().reason); return; }
    nextSample = elapsed + .05;
    if (buffer.stats().stopped) finish(buffer.stats().reason);
    renderUi();
  }
  function afterTick(dt) {
    if (mode !== 'recording') return;
    elapsed += Math.max(0, dt);
    // Observe the existing controllers, never instrument their pinned kernels.
    // Native highway/city wraps exceed 40m; coast placement changes its cursor.
    // Blast expiry and visibility transitions are additional explicit cuts.
    for (const b of bindings) if (b.car) {
      const n = b.node, token = trafficToken(b);
      if (b.tickPose && (token !== b.token || n.position.distanceTo(b.tickPose) >= 40)) { b.generation++; pendingCut = true; }
      b.token = token; if (!b.tickPose) b.tickPose = new THREE.Vector3(); b.tickPose.copy(n.position);
    }
    const changed = lastDestroyed !== state.isDestroyed || lastAirborne !== state.wasAirborne;
    lastDestroyed = state.isDestroyed; lastAirborne = state.wasAirborne; capture(changed || pendingCut); pendingCut = false;
  }
  function releaseClip() {
    if (active()) exit();
    mode = 'drive'; buffer.clear(); bindings = []; baseCount = 0; debrisIds.clear(); metadata = null; checkpoint = null;
    // Clones share original generated geometry/material; never dispose live assets.
    effectRoot.clear(); effectRoot.visible = false; message = ''; elapsed = playhead = nextSample = 0; renderUi();
  }
  function record() {
    if (active() || overlayOpen() || window.RoadsterRanked?.isActive?.() || window.RoadsterDemo?.isBusy?.()) { message = 'busy'; renderUi(); return false; }
    if (buffer.stats().frames && !window.confirm(text('Replace the temporary clip? The old clip will be cleared.', '开始新录制会清除现有临时片段，是否继续？'))) return false;
    releaseClip(); buildBindings();
    metadata = { signature: signature(), population: trafficCars, map: currentMap, vehicles: trafficCars.length + 1, build: window.RoadsterBuildInfo?.id || '', weather: weatherIndex };
    $('replay-target').innerHTML = '<option value="0">Player / 我的车</option>' + trafficCars.map((_, i) => `<option value="${i + 1}">NPC ${i + 1} / 交通车 ${i + 1}</option>`).join('');
    targetIndex = 0;
    elapsed = nextSample = resetGeneration = 0; pendingCut = false; lastDestroyed = state.isDestroyed; lastAirborne = state.wasAirborne;
    mode = 'recording'; open = true; capture(true); renderUi(); return true;
  }
  function play() {
    if (mode === 'recording') finish();
    if (buffer.stats().frames < 2 || !buffer.duration()) return false;
    if (!matchesScene()) { message = 'configuration'; renderUi(); return false; }
    if (!active()) {
      if (overlayOpen() || window.RoadsterRanked?.isActive?.() || window.RoadsterDemo?.isBusy?.()) { message = 'busy'; renderUi(); return false; }
      checkpoint = snapshotLive(); clearInput();
      if (checkpoint.taxiMarker) checkpoint.taxiMarker.visible = false;
      debrisGroup.visible = explosionGroup.visible = tireSmokeGroup.visible = rainLinesMesh.visible = false;
      effectRoot.visible = true; playhead = 0; free.initialized = false;
      setCockpitPerspective(false); setCockpitExteriorDetailsVisible(true); roadsterCanopyMesh.visible = true;
      document.body.dataset.replayActive = 'true';
      document.getElementById('modal-destroyed')?.classList.add('hidden');
      sound.update(0, false, false, true);
    }
    if (playhead >= buffer.duration()) playhead = 0;
    mode = 'playing'; open = true; renderFrame(0); renderUi(); return true;
  }
  function pause() { if (mode === 'playing') mode = 'paused'; clearInput(); renderUi(); }
  function exit() {
    if (!active()) return;
    if (checkpoint) {
      setCockpitPerspective(cameraModeIndex === 3); setCockpitExteriorDetailsVisible(cameraModeIndex !== 3);
      bindings.forEach((b, i) => { if (!b.debris) applyOne(b, checkpoint.values, checkpoint.values, i * S, 0, true); });
      for (const [n, visible] of checkpoint.visible) n.visible = visible;
      const c = checkpoint.camera; camera.position.copy(c.position); camera.quaternion.copy(c.quaternion); camera.up.copy(c.up); camera.near = c.near; camera.fov = c.fov; camera.updateProjectionMatrix();
      [debrisGroup.visible, explosionGroup.visible, tireSmokeGroup.visible, rainLinesMesh.visible] = checkpoint.effects;
      coldGasTime.value = checkpoint.coldTime;
      $('modal-destroyed')?.classList.toggle('hidden', checkpoint.destroyedModalHidden);
      if (checkpoint.taxiMarker) checkpoint.taxiMarker.visible = checkpoint.taxiMarkerVisible;
    }
    checkpoint = null; effectRoot.visible = false; mode = 'drive'; document.body.dataset.replayActive = 'false'; clearInput(); resetClock(); renderUi();
  }
  function seek(time) { if (!active()) return; playhead = Math.max(0, Math.min(buffer.duration(), Number(time) || 0)); renderFrame(0); renderUi(); }
  function updateCamera(dt) {
    const car = targetIndex ? trafficCars[targetIndex - 1]?.mesh : playerWrapper;
    const anchor = car?.position || playerWrapper.position;
    const heading = targetIndex ? car.rotation.y : roadsterAttitudeGroup.rotation.y;
    const sin = Math.sin(heading), cos = Math.cos(heading);
    camera.up.set(0, 1, 0); camera.fov = 60; camera.near = .08;
    if (!free.initialized) { free.position.set(anchor.x + sin * 8, anchor.y + 3, anchor.z + cos * 8); free.yaw = heading; free.pitch = -.12; free.initialized = true; }
    if (cameraMode === 'free') {
      const v = (held.has('ShiftLeft') || held.has('ShiftRight') ? 45 : 12) * Math.min(.05, dt);
      const forward = Number(held.has('KeyW')) - Number(held.has('KeyS')), side = Number(held.has('KeyD')) - Number(held.has('KeyA'));
      free.position.x += (-Math.sin(free.yaw) * forward + Math.cos(free.yaw) * side) * v;
      free.position.z += (-Math.cos(free.yaw) * forward - Math.sin(free.yaw) * side) * v;
      free.position.y += (Number(held.has('KeyE')) - Number(held.has('KeyQ'))) * v;
      camera.position.copy(free.position);
      camera.lookAt(camera.position.x - Math.sin(free.yaw) * Math.cos(free.pitch) * 20, camera.position.y + Math.sin(free.pitch) * 20, camera.position.z - Math.cos(free.yaw) * Math.cos(free.pitch) * 20);
    } else {
      const distance = free.distance;
      const front = cameraMode === 'front', ground = cameraMode === 'ground';
      const side = front ? distance * .72 : ground ? distance * .60 : 0;
      const back = front ? -distance * .8 : distance;
      camera.position.set(anchor.x + sin * back + cos * side, anchor.y + (ground ? .34 : front ? 1.3 : 2.4), anchor.z + cos * back - sin * side);
      camera.lookAt(anchor.x, anchor.y + .65, anchor.z);
    }
    const floor = currentMap === 'coast' ? (window.RoadsterCoast?.surface?.(camera.position.x, camera.position.z)?.height || 0) : 0;
    camera.position.y = Math.max(floor + .12, camera.position.y); free.position.y = camera.position.y;
    camera.updateProjectionMatrix();
  }
  function enterFree() {
    free.position.copy(camera.position);
    const direction = camera.getWorldDirection(new THREE.Vector3());
    free.yaw = Math.atan2(-direction.x, -direction.z); free.pitch = Math.asin(Math.max(-1, Math.min(1, direction.y)));
    free.initialized = true; cameraMode = 'free'; $('replay-camera').value = 'free';
  }
  function renderFrame(dt) {
    const pair = buffer.at(playhead); if (!pair) return;
    bindings.forEach((b, i) => applyOne(b, pair.a.values, pair.b.values, i * S, pair.alpha));
    coldGasTime.value = playhead;
    // Saved viewpoint must not hide plumes/body when watching from outside.
    for (const plume of allThrusterPlumes) plume.visible = (plume.children[0]?.material?.uniforms?.uPower?.value || 0) > .001;
    updateCamera(dt); window.RoadsterTrafficAssets?.updateLods(trafficCars, camera.position); renderer.render(scene, camera);
  }
  function frame(dt) {
    if (!active()) return false;
    if (mode === 'playing') {
      playhead += Math.max(0, Math.min(.1, dt)) * speed;
      if (playhead >= buffer.duration()) { if (loop) playhead %= buffer.duration(); else { playhead = buffer.duration(); mode = 'paused'; } }
    }
    renderFrame(dt); renderUi(); return true;
  }
  function renderUi() {
    if (!$('replay-panel')) return;
    const stats = buffer.stats();
    $('replay-panel').hidden = !open;
    $('btn-replay').textContent = mode === 'recording' ? text('● Recording', '● 录制中') : text('Replay', '录制 / 回放');
    $('replay-title').textContent = text('Temporary replay · RAM only', '临时回放 · 仅当前页面内存');
    $('replay-record').textContent = text('● Record', '● 开始录制'); $('replay-stop').textContent = text('■ Stop', '■ 停止录制');
    $('replay-play').textContent = mode === 'paused' ? text('▶ Resume', '▶ 继续') : text('▶ Play', '▶ 回放');
    $('replay-pause').textContent = text('Ⅱ Pause', 'Ⅱ 暂停'); $('replay-exit').textContent = text('Return to driving', '返回驾驶');
    $('replay-clear').textContent = text('Clear clip', '清除片段'); $('replay-close').textContent = text('Close panel', '收起');
    $('replay-record').disabled = busy(); $('replay-stop').disabled = mode !== 'recording';
    $('replay-play').disabled = stats.frames < 2 || mode === 'recording' || mode === 'playing';
    $('replay-pause').disabled = mode !== 'playing'; $('replay-exit').disabled = !active(); $('replay-clear').disabled = !stats.frames || mode === 'recording';
    $('replay-seek').disabled = !active(); $('replay-seek').max = String(stats.duration); $('replay-seek').value = String(active() ? playhead : 0);
    $('replay-time').textContent = `${(active() ? playhead : stats.duration).toFixed(1)} / ${stats.duration.toFixed(1)} s · ${(stats.bytes / 1048576).toFixed(1)} / 32 MiB · ${metadata?.vehicles || 0} ${text('vehicles', '辆车')}`;
    const notices = { memory: text('Buffer limit reached. Recording stopped; clip retained.', '已达内存上限，录制自动停止，已有片段已保留。'), duration: text('5-minute limit reached. Clip retained.', '已达5分钟上限，录制自动停止，已有片段已保留。'), hidden: text('Page hidden: recording stopped / replay paused.', '页面转入后台：已停止录制或暂停回放。'), graphics: text('Graphics interrupted: recording stopped; clip retained.', '图形中断：录制已停止，片段已保留。'), configuration: text('Scene changed. Clear this clip before recording again.', '场景配置已改变，请清除片段后重新录制。'), busy: text('Close menus or finish the challenge/demo first.', '请先关闭菜单，或结束排位/自动演示。'), locked: text('Clear the clip before changing map or configuration.', '请先清除临时片段，再更换地图或配置。') };
    $('replay-status').textContent = notices[message] || (mode === 'recording' ? text('Recording all vehicles. Stops at 5 min or 32 MiB; never overwrites.', '正在记录所有车辆。5分钟或32MiB自动停止，不循环覆盖。') : active() ? text('Playback only — driving, score and taxi are frozen.', '回放中：驾驶、计分、出租车均已冻结。') : text('Record → Stop → Play. Refresh / leaving this page clears the clip.', '录制 → 停止 → 回放。刷新或离开网页后清除。'));
    $('replay-note').textContent = text('Vehicle / debris trajectories and jets recorded. Explosion fire/smoke, rain, audio and coastal ambient animation are not replayed. Free camera has ground clearance, not building avoidance. Drag to look; wheel / + / − to move; WASD + Q/E in Free view.', '记录车辆、碎片轨迹与喷气。爆炸火球烟雾、雨滴、音频及海岸环境动画暂不回放。自由镜头有贴地保护，无建筑避障。拖动转向；滚轮或＋／−移动；自由机位可用WASD＋Q/E。');
  }
  $('btn-replay')?.addEventListener('click', () => { open = !open; renderUi(); });
  $('replay-record')?.addEventListener('click', record); $('replay-stop')?.addEventListener('click', () => { capture(true); finish(); });
  $('replay-play')?.addEventListener('click', play); $('replay-pause')?.addEventListener('click', pause); $('replay-exit')?.addEventListener('click', exit);
  $('replay-clear')?.addEventListener('click', releaseClip); $('replay-close')?.addEventListener('click', () => { open = false; renderUi(); });
  $('replay-seek')?.addEventListener('input', e => seek(e.target.value)); $('replay-speed')?.addEventListener('change', e => { speed = Number(e.target.value); });
  $('replay-loop')?.addEventListener('change', e => { loop = e.target.checked; });
  $('replay-camera')?.addEventListener('change', e => { if (e.target.value === 'free' && active()) enterFree(); else { cameraMode = e.target.value; free.initialized = false; } });
  $('replay-target')?.addEventListener('change', e => { targetIndex = Math.max(0, Math.min(trafficCars.length, Number(e.target.value) || 0)); free.initialized = false; });
  function dolly(amount) { free.distance = Math.max(2.5, Math.min(40, free.distance + amount)); if (cameraMode === 'free') { free.position.x += Math.sin(free.yaw) * Math.cos(free.pitch) * amount; free.position.z += Math.cos(free.yaw) * Math.cos(free.pitch) * amount; free.position.y -= Math.sin(free.pitch) * amount; } }
  $('replay-near')?.addEventListener('click', () => dolly(-2)); $('replay-far')?.addEventListener('click', () => dolly(2));
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', e => { if (!active()) return; free.drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture?.(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (!active() || free.drag?.id !== e.pointerId) return; if (cameraMode !== 'free') enterFree(); free.yaw -= (e.clientX - free.drag.x) * .006; free.pitch = Math.max(-1.4, Math.min(1.4, free.pitch - (e.clientY - free.drag.y) * .006)); free.drag.x = e.clientX; free.drag.y = e.clientY; });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, () => { free.drag = null; });
  canvas.addEventListener('wheel', e => { if (active()) { e.preventDefault(); e.stopImmediatePropagation(); dolly(Math.sign(e.deltaY)); } }, { passive: false, capture: true });
  const lockedIds = new Set(['btn-map-select', 'btn-crash-switch-map', 'btn-physics-mode', 'btn-plaid-mode', 'btn-paint', 'btn-weather', 'btn-traffic', 'btn-highway-demo', 'btn-leaderboard', 'ranked-hud-open', 'ranked-start']);
  document.addEventListener('click', e => { const button = e.target.closest?.('button'); if (button?.closest('#render-health-overlay')) return; if ((active() && button && !button.closest('#replay-panel') && button.id !== 'btn-replay') || (buffer.stats().frames && lockedIds.has(button?.id))) { e.preventDefault(); e.stopImmediatePropagation(); message = 'locked'; open = true; renderUi(); return; }
    // These existing listeners hold the original reset function by reference.
    if (mode === 'recording' && ['btn-reset', 'btn-crash-respawn'].includes(button?.id)) { resetGeneration++; pendingCut = true; }
  }, true);
  window.addEventListener('keydown', e => {
    if (window.RoadsterRenderHealth?.isPaused?.()) return;
    if (!active() && buffer.stats().frames && ['KeyM', 'KeyF', 'KeyY', 'KeyT'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); message = 'locked'; open = true; renderUi(); return; }
    if (!active()) return;
    // Keep native control defaults, but never bubble a focused-button R/F/T to
    // the older game shortcuts (which can mutate state without setKeyState).
    if (e.target.closest?.('input,select,button') || e.code === 'Tab') { e.stopImmediatePropagation(); return; }
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.code === 'Escape') exit(); else if (e.code === 'Space' && !e.repeat) mode === 'playing' ? pause() : play(); else held.add(e.code);
  }, true);
  window.addEventListener('keyup', e => { held.delete(e.code); if (active()) { e.stopImmediatePropagation(); clearAllInputKeys(); } }, true);
  window.addEventListener('blur', () => { if (active()) pause(); clearInput(); });
  canvas.addEventListener('webglcontextlost', () => { if (mode === 'recording') finish('graphics'); if (active()) pause(); clearInput(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (mode === 'recording') finish('hidden'); if (active()) pause(); message = 'hidden'; clearInput(); renderUi(); } });
  window.addEventListener('pagehide', releaseClip);
  window.addEventListener('pageshow', e => { if (e.persisted) { releaseClip(); resetClock(); } });
  window.RoadsterReplay = Object.freeze({ record, stop: () => { capture(true); finish(); }, play, pause, exit, seek, clear: releaseClip, frame, afterTick,
    isActive: active, isBusy: busy, hasClip: () => buffer.stats().frames > 0,
    discontinuity: () => { if (mode === 'recording') { resetGeneration++; pendingCut = true; lastDestroyed = state.isDestroyed; lastAirborne = state.wasAirborne; } },
    markCar: car => { if (mode !== 'recording') return; const binding = bindings.find(b => b.car === car); if (binding) { binding.generation++; pendingCut = true; } },
    render: renderUi, stats: () => ({ ...buffer.stats(), mode, playhead, baseCount, bindings: bindings.length, vehicles: metadata?.vehicles || 0, map: metadata?.map || null, cameraMode, speed, loop, checkpoint: Boolean(checkpoint), debris: debrisIds.size }),
    sample: time => { const p = buffer.at(time); return p ? { time: p.time, a: Array.from(p.a.values), b: Array.from(p.b.values), alpha: p.alpha } : null; }
  });
  // Install after the original game and before render-health. No numerical
  // source, fixed step, collision kernel or planner identity is changed.
  const simulate = updateSimulation;
  updateSimulation = function () { if (active()) return; const result = simulate.apply(this, arguments); afterTick(arguments[0]); return result; };
  const runFrame = animate;
  animate = function (now) {
    if (!active()) return runFrame.apply(this, arguments);
    requestAnimationFrame(animate);
    const dt = (now - lastTime) / 1000; lastTime = now; frame(dt);
  };
  const reset = resetCar;
  resetCar = function () {
    if (active()) return;
    const result = reset.apply(this, arguments);
    if (mode === 'recording') { resetGeneration++; pendingCut = true; }
    return result;
  };
  const input = setKeyState;
  setKeyState = function (code, isDown) { if (isDown && active()) return; return input.apply(this, arguments); };
  if (window.__gameTestHooks) window.__gameTestHooks.resetCar = resetCar;
  renderUi();
})();
