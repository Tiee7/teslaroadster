import test from 'node:test';
import assert from 'node:assert/strict';
import { lifecycleHarness, source, response, issued, flush, deferred } from './helpers/demo-lifecycle-harness.mjs';

const neutral = input => Object.values(input).every(value => value === 0);

test('demo cancels a running ranked session, waits for exact server end, and never submits its score', async () => {
  const h = lifecycleHarness(); await h.start();
  const runId = JSON.parse(h.requests('/api/run')[0].options.body);
  assert.equal(runId.category, 'highway-realistic');
  const end = deferred();
  h.network((url, options) => url === '/api/end' ? end.promise : h.defaultNetwork(url, options));
  const pending = h.demo.toggle(); await flush();
  assert.equal(h.phase(), 'aborted'); assert.equal(h.demo.isBusy(), true); assert.equal(h.demo.isActive(), false);
  assert.equal(h.get('ranked-start').disabled, true);
  const request = h.requests('/api/end')[0];
  assert.deepEqual(JSON.parse(request.options.body), { runId: 'manual-1' });
  assert.equal(request.options.keepalive, true); assert.equal(request.options.credentials, 'same-origin');
  end.resolve(response({ ended: true, runId: 'manual-1' })); await pending;
  assert.equal(h.demo.isActive(), true);
  h.state.distanceBySpeed = [99999, 0, 0, 0, 0, 0]; h.advance(120000);
  await h.click('ranked-submit');
  assert.equal(h.requests('/api/score').length, 0); assert.equal(h.get('ranked-submit').hidden, true);
});

test('late ranked issuance is ended before pending demo becomes active', async () => {
  const h = lifecycleHarness(), issue = deferred(), end = deferred();
  h.network((url, options) => url === '/api/run' ? issue.promise : url === '/api/end' ? end.promise : h.defaultNetwork(url, options));
  const start = h.start(); await flush();
  assert.equal(h.phase(), 'starting');
  const demo = h.demo.toggle(); await flush();
  assert.equal(h.phase(), 'aborted'); assert.equal(h.demo.isActive(), false);
  issue.resolve(issued('late-run')); await start; await flush();
  assert.deepEqual(JSON.parse(h.requests('/api/end')[0].options.body), { runId: 'late-run' });
  assert.equal(h.demo.isActive(), false);
  end.resolve(response({ ended: true, runId: 'late-run' })); await demo;
  assert.equal(h.demo.isActive(), true); assert.equal(h.requests('/api/run').length, 1);
});

test('unconfirmed end fails closed, retries the same run, and permits manual ranked after demo exit', async () => {
  const h = lifecycleHarness(); await h.start();
  let fail = true;
  h.network((url, options) => {
    if (url === '/api/end' && fail) throw new TypeError('network_down');
    return h.defaultNetwork(url, options);
  });
  await h.demo.toggle();
  assert.equal(h.demo.isActive(), false); assert.equal(h.demo.isBusy(), false);
  assert.match(h.get('btn-highway-demo').title, /unconfirmed/);
  assert.equal(h.requests('/api/run').length, 1);
  assert.ok(h.requests('/api/end').length >= 1);
  fail = false; await h.demo.toggle();
  assert.equal(h.demo.isActive(), true);
  assert.ok(h.requests('/api/end').every(request => JSON.parse(request.options.body).runId === 'manual-1'));
  h.demo.stop(); await h.start('Fresh Manual');
  assert.equal(h.phase(), 'running'); assert.equal(h.requests('/api/run').length, 2);
  h.state.distanceBySpeed = [100, 0, 0, 0, 0, 0]; h.advance(60000); await h.click('ranked-submit');
  assert.equal(h.phase(), 'submitted');
  assert.equal(JSON.parse(h.requests('/api/score')[0].options.body).runId, 'manual-2');
});

test('failed cancellation of a late-issued run keeps demo off and preserves that exact ID for retry', async () => {
  const h = lifecycleHarness(), issue = deferred();
  let fail = true;
  h.network((url, options) => {
    if (url === '/api/run') return issue.promise;
    if (url === '/api/end' && fail) throw new TypeError('late_end_network_down');
    return h.defaultNetwork(url, options);
  });
  const starting = h.start(); await flush();
  const preparing = h.demo.toggle(); await flush();
  issue.resolve(issued('late-failed-end')); await starting; await preparing;
  assert.equal(h.demo.isBusy(), false); assert.equal(h.demo.isActive(), false);
  assert.match(h.get('btn-highway-demo').title, /unconfirmed/);
  assert.ok(h.requests('/api/end').length >= 1);
  fail = false; await h.demo.toggle();
  assert.equal(h.demo.isActive(), true);
  assert.ok(h.requests('/api/end').every(request => JSON.parse(request.options.body).runId === 'late-failed-end'));
  assert.equal(h.requests('/api/run').length, 1); assert.equal(h.requests('/api/score').length, 0);
});

test('cancelled pending demo cannot turn itself on after late issuance/end; repeated preparation shares exact end', async () => {
  const h = lifecycleHarness(), issue = deferred(), end = deferred();
  h.network((url, options) => url === '/api/run' ? issue.promise : url === '/api/end' ? end.promise : h.defaultNetwork(url, options));
  const start = h.start(); await flush();
  const first = h.demo.toggle(); await flush();
  await h.demo.toggle(); assert.equal(h.demo.isBusy(), false);
  const second = h.demo.toggle(); await flush();
  issue.resolve(issued('cancelled-start')); await start; await flush();
  assert.equal(h.requests('/api/end').length, 1, 'one in-flight cancellation is shared by preparations');
  await h.demo.toggle(); assert.equal(h.demo.isBusy(), false);
  end.resolve(response({ ended: true, runId: 'cancelled-start' })); await Promise.all([first, second]);
  assert.equal(h.demo.isActive(), false); assert.equal(h.demo.isBusy(), false);
  assert.equal(h.requests('/api/run').length, 1); assert.equal(h.requests('/api/score').length, 0);
  assert.equal(neutral(h.demo.input()), true);
});

test('programmatic ranked start is blocked during active and pending demo, including disabled-button dispatch', async () => {
  for (const pending of [false, true]) {
    const h = lifecycleHarness(), ready = deferred();
    if (pending) h.window.RoadsterRanked.prepareForDemo = () => ready.promise;
    const toggling = h.demo.toggle(); if (!pending) await toggling;
    await h.start();
    assert.equal(h.requests('/api/run').length, 0); assert.equal(h.get('ranked-start').disabled, true);
    if (pending) { h.demo.stop(); ready.resolve(); await toggling; }
  }
});

test('old completed manual snapshot survives demo scoring and submits the original immutable payload', async () => {
  const h = lifecycleHarness(); await h.start('Original Manual');
  h.state.distanceBySpeed = [1254, 0, 0, 0, 0, 0]; h.advance(60000);
  assert.equal(h.phase(), 'complete');
  const original = h.get('ranked-result').textContent;
  await h.click('ranked-close'); await h.demo.toggle();
  assert.equal(h.demo.isActive(), true); assert.equal(h.phase(), 'complete');
  h.state.distanceBySpeed = [999999, 0, 0, 0, 0, 0]; h.state.score = 999999;
  h.advance(120000); h.demo.render();
  assert.equal(h.get('ranked-result').textContent, original); assert.equal(h.requests('/api/end').length, 0);
  await h.click('btn-leaderboard');
  assert.equal(h.demo.isActive(), false); await h.click('ranked-submit');
  const payload = JSON.parse(h.requests('/api/score')[0].options.body);
  assert.equal(payload.runId, 'manual-1'); assert.equal(payload.nickname, 'Original Manual'); assert.equal(payload.score, 126);
  assert.deepEqual(payload.distanceBySpeed, [1254, 0, 0, 0, 0, 0]);
});

test('demo UI is highway-only, translates live, and adds no keyboard shortcut', async () => {
  const h = lifecycleHarness();
  assert.equal(h.get('btn-highway-demo').hidden, false);
  assert.equal((h.window.listeners.keydown || []).length, h.keyboardHandlersBeforeDemo);
  assert.doesNotMatch(source('highway-demo.js'), /addEventListener\(\s*['"]key(?:down|up|press)['"]/);
  await h.key('KeyG'); assert.equal(h.demo.isBusy(), false);
  const button = h.get('btn-highway-demo');
  for (const active of [false, true]) {
    if (active) await button.click();
    const event = await h.key('Space', { target: button });
    assert.equal(event.defaultPrevented, false, 'focused Space keeps native button activation');
    assert.notEqual(h.keys.Space, true, 'focused button activation never injects lift');
  }
  await button.click(); assert.equal(h.demo.isBusy(), false);
  h.context.setMap('city'); h.demo.render();
  assert.equal(h.get('btn-highway-demo').hidden, true); await h.demo.toggle(); assert.equal(h.demo.isBusy(), false);
  h.context.setMap('highway'); h.context.setLanguage('zh'); h.demo.render();
  assert.equal(h.get('btn-highway-demo').hidden, false); assert.match(h.get('btn-highway-demo').textContent, /自动驾驶/);
});

test('native demo switch remains reachable in full, medium and minimal HUD modes without appearing in the city', async () => {
  const h = lifecycleHarness();
  for (const mode of ['full', 'medium', 'minimal']) {
    h.state.hudMode = mode; h.context.applyHudMode();
    const button = h.get('btn-highway-demo');
    assert.equal(button.hidden, false); assert.equal(button.classList.contains('hidden'), false);
    await button.click(); assert.equal(h.demo.isActive(), true, mode);
    await button.click(); assert.equal(h.demo.isBusy(), false, mode);
  }
  h.context.setMap('city'); h.demo.render();
  for (const mode of ['full', 'medium', 'minimal']) {
    h.state.hudMode = mode; h.context.applyHudMode();
    assert.equal(h.get('btn-highway-demo').hidden, true);
  }
});

test('repeated on/off clears virtual input and held keyboard/touch ownership without changing physics or tank', async () => {
  const h = lifecycleHarness();
  for (let cycle = 0; cycle < 3; cycle++) {
    await h.key('KeyW'); await h.stick('right', 0.5, 1);
    const gas = h.state.airRemaining, mode = h.state.physicsMode, x = h.state.x;
    await h.demo.toggle(); h.demo.step(1 / 60);
    assert.equal(h.demo.isActive(), true); assert.equal(h.keys.KeyW, false);
    assert.equal(h.demo.input().throttle, 1); assert.equal(h.state.airRemaining, gas);
    assert.equal(h.state.physicsMode, mode); assert.equal(h.state.x, x);
    await h.demo.toggle();
    assert.equal(h.demo.isBusy(), false); assert.equal(neutral(h.demo.input()), true);
    const input = h.context.readDriveInput();
    assert.equal(neutral(input), true, 'no old keyboard or captured mobile request survives exit');
    assert.equal(h.get('mobile-stick-right').captured.size, 0);
  }
});

test('manual keys, mobile sticks and jump/hold actions cannot fight active demo input', async () => {
  const h = lifecycleHarness(); await h.demo.toggle(); h.demo.step(1 / 60);
  const codes = ['KeyW','KeyA','KeyS','KeyD','KeyH','KeyU','Space','Semicolon','ShiftLeft','ShiftRight','KeyQ','KeyE','KeyI','KeyK','KeyJ','KeyL','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyO','KeyN'];
  for (const code of codes) { const event = await h.key(code); assert.equal(event.defaultPrevented, true, code); assert.notEqual(h.keys[code], true, code); }
  await h.stick('left', -1, -1); await h.stick('right', 1, 1);
  assert.deepEqual({ ...h.context.readDriveInput() }, { ...h.demo.input() });
  assert.equal(h.context.readAttitudeInput(true).hasManualAttitudeInput, false);
  await h.click('mobile-jump'); assert.equal(h.state.isJumping6m, false);
  h.state.y = 2; await h.click('mobile-hold'); assert.equal(h.state.isAltitudeHold, false);
  h.demo.stop(); assert.equal(neutral(h.context.readDriveInput()), true);
  h.state.y = 0; h.context.triggerJump6m(); assert.equal(h.state.jumpTargetY, 6, 'manual O keeps the original height');
});

test('legacy hold buttons cannot inject propulsion, lift or attitude into an airborne demo', async () => {
  const h = lifecycleHarness(); await h.demo.toggle();
  Object.assign(h.state, { y: 2, vx: 0, vy: 0, vz: -65, speed: 65, airRemaining: 10, wasAirborne: true });
  for (const code of ['KeyW', 'Semicolon', 'Space', 'ShiftLeft', 'KeyJ', 'KeyI', 'KeyA']) {
    const button = h.hold(code); assert.ok(button, `real legacy ${code} hold button exists`);
    await button.emit('pointerdown');
  }
  for (const code of ['KeyQ','KeyE','KeyN']) h.context.setKeyState(code,true);
  const frame = h.step();
  assert.equal(frame.isRearThrusterFiring, false);
  assert.equal(frame.airConsumedThisFrame, 0);
  assert.equal(frame.airJetLeft, false);
  assert.equal(frame.airJetRight, false);
  assert.equal(h.context.readAttitudeInput(true).hasManualAttitudeInput, false);
  h.demo.stop(); assert.equal(neutral(h.context.readDriveInput()), true);
});

test('pending ranked cancellation also owns analog mobile input and returns neutral until ready or cancelled', async () => {
  const h = lifecycleHarness(), ready = deferred();
  h.window.RoadsterRanked.prepareForDemo = () => ready.promise;
  const preparing = h.demo.toggle(); await flush();
  assert.equal(h.demo.isBusy(), true); assert.equal(h.demo.isActive(), false);
  await h.key('KeyW'); await h.stick('left', 1, 1); await h.stick('right', 1, 1);
  assert.equal(neutral(h.context.readDriveInput()), true);
  assert.equal(h.context.readAttitudeInput(true).hasManualAttitudeInput, false);
  const frame = h.context.fullMotion(1 / 60);
  assert.equal(frame.isRearThrusterFiring, false); assert.equal(frame.airConsumedThisFrame, 0);
  h.demo.stop(); ready.resolve(); await preparing;
  assert.equal(h.demo.isBusy(), false); assert.equal(neutral(h.context.readDriveInput()), true);
});

test('adapter dispatches its supplied admitted short-hop command through real O and releases airborne propulsion', async () => {
  const h = lifecycleHarness(); await h.demo.toggle();
  Object.assign(h.state, { x: 2.5, y: 0, vx: 0, vy: 0, vz: -65, speed: 65, airRemaining: 10 });
  for (const [x, z] of [[2.5, -12], [-2.5, -8], [7.5, -8]]) {
    h.context.trafficCars.push({ mode: 'highway', speed: 20, length: 4.62, height: 1.25,
      mesh: { visible: true, position: { x, z } } });
  }
  // Adapter unit: planner admission is separately exercised by complete clock
  // runs. Supply a completed command, never fake the resulting motion/tank.
  let launch=true;h.context.adapterPlannerForTest.step=()=>{const jump=launch;launch=false;return{input:RoadsterNeutral(),jump,jumpHeight:2.3,jumpGraceSeconds:1,status:'jump',targetLane:3};};
  function RoadsterNeutral(){return{steer:0,throttle:0,boost:0,brake:0,reverse:0,handbrake:0,lift:0,descend:0,strafe:0,roll:0,pitch:0};}
  h.demo.step(1 / 60);
  assert.equal(h.state.isJumping6m, true);
  assert.equal(h.state.jumpTargetY, h.demo.jumpHeight());
  assert.ok(h.state.jumpTargetY > 1.25 && h.state.jumpTargetY < 6, 'demo requests obstacle clearance below the manual 6m jump');
  assert.equal(h.state.jumpInertiaSeconds, 0);
  assert.equal(neutral(h.demo.input()), true);
  const frame = h.step();
  assert.equal(frame.isAirborne, true); assert.equal(frame.isRearThrusterFiring, false);
  assert.ok(frame.airConsumedThisFrame > 0, 'short jump still pays the ordinary lift tank debit');
});

test('blur, hidden, pagehide, real reset, crash, and map switch return demo to neutral manual control', async () => {
  const actions = {
    blur: h => h.window.emit('blur'),
    hidden: h => { h.document.hidden = true; return h.document.emit('visibilitychange'); },
    pagehide: h => h.window.emit('pagehide'),
    reset: h => h.context.resetCar(),
    crash: h => h.context.destroyVehicle('crashReasonThreshold'),
    map: h => h.context.switchMap('city')
  };
  for (const [name, run] of Object.entries(actions)) {
    const h = lifecycleHarness(); await h.demo.toggle(); h.demo.step(1 / 60);
    await run(h);
    assert.equal(h.demo.isBusy(), false, name); assert.equal(neutral(h.demo.input()), true, name);
    assert.equal(neutral(h.context.readDriveInput()), true, name);
    assert.equal(h.requests('/api/score').length, 0, name);
  }
});

test('pending demo is invalidated by blur, hidden, and reset before delayed prepare resolves', async () => {
  for (const action of [h => h.window.emit('blur'), h => { h.document.hidden = true; return h.document.emit('visibilitychange'); }, h => h.context.resetCar()]) {
    const h = lifecycleHarness(), ready = deferred();
    h.window.RoadsterRanked.prepareForDemo = () => ready.promise;
    const pending = h.demo.toggle(); await flush(); await action(h); ready.resolve(); await pending;
    assert.equal(h.demo.isBusy(), false); assert.equal(h.demo.isActive(), false);
  }
});

test('mobile map, help, audio and leaderboard menus stop demo and do not resume it when dismissed', async () => {
  const actions = [
    ['map', h => h.context.openMapSelectModal(), h => h.get('modal-map-select').classList.add('hidden')],
    ['help', h => h.context.toggleHelpModal(), h => h.context.toggleHelpModal()],
    ['audio', h => h.click('btn-settings'), h => h.click('audio-settings-close')],
    ['leaderboard', h => h.click('btn-leaderboard'), h => h.click('ranked-close')]
  ];
  for (const [name, open, close] of actions) {
    const h = lifecycleHarness(); await h.demo.toggle(); h.demo.step(1 / 60);
    await open(h); assert.equal(h.demo.isBusy(), false, name); assert.equal(neutral(h.demo.input()), true, name);
    await close(h); assert.equal(h.demo.isBusy(), false, `${name} dismiss`);
  }
});

test('mobile paint menu stops demo and keeps vehicle neutral throughout the open picker', async () => {
  const h = lifecycleHarness(); await h.demo.toggle(); h.demo.step(1 / 60);
  h.context.openPaint({ currentTarget: h.get('btn-paint') });
  assert.equal(h.get('paint-picker').open, true);
  assert.equal(h.demo.isBusy(), false, 'paint picker must relinquish autopilot ownership like every other menu');
  assert.equal(neutral(h.demo.input()), true);
});

test('opening any mobile overlay cancels pending demo even if server-end confirmation arrives later', async () => {
  const actions = [
    ['map', h => h.context.openMapSelectModal()],
    ['help', h => h.context.toggleHelpModal()],
    ['audio', h => h.click('btn-settings')],
    ['leaderboard', h => h.click('btn-leaderboard')],
    ['paint', h => h.context.openPaint({ currentTarget: h.get('btn-paint') })]
  ];
  for (const [name, open] of actions) {
    const h = lifecycleHarness(), end = deferred(); await h.start();
    h.network((url, options) => url === '/api/end' ? end.promise : h.defaultNetwork(url, options));
    const preparing = h.demo.toggle(); await flush();
    assert.equal(h.demo.isBusy(), true, name); assert.equal(h.demo.isActive(), false, name);
    await open(h); assert.equal(h.demo.isBusy(), false, name);
    end.resolve(response({ ended: true, runId: 'manual-1' })); await preparing;
    assert.equal(h.demo.isBusy(), false, `${name} late confirmation`);
    assert.equal(neutral(h.demo.input()), true, name);
    assert.equal(h.requests('/api/score').length, 0, name);
  }
});

test('near-term high-speed cold activation refuses input ownership and preserves actual manual keys', async()=>{
 const h=lifecycleHarness();Object.assign(h.state,{x:2.5,y:0,vx:0,vy:0,vz:-65,speed:65});
 for(const x of[-12.5,-7.5,-2.5,2.5,7.5,12.5])h.context.trafficCars.push({mode:'highway',speed:22,vx:0,vz:-22,length:4.62,height:1.25,mesh:{visible:true,position:{x,y:0,z:-20},rotation:{x:0,y:0,z:0}}});
 await h.key('KeyW');await h.key('KeyD');const before=JSON.stringify(h.state),keysBefore=JSON.stringify(h.keys);
 await h.demo.toggle();assert.equal(h.demo.isActive(),false);assert.equal(h.demo.isBusy(),false);assert.equal(h.demo.isRequestingJump(),false);
 assert.equal(JSON.stringify(h.state),before);assert.equal(JSON.stringify(h.keys),keysBefore);
 const input=h.context.readDriveInput();assert.equal(input.throttle,1);assert.equal(input.steer,1);
 assert.equal(h.get('btn-highway-demo').dataset.status,'unsafe');assert.match(h.get('btn-highway-demo').title,/Cannot safely take over|暂不能安全接管/);
 assert.equal(h.requests('/api/end').length,0,'refused startup cannot cancel an existing manual challenge');
 await h.demo.toggle();assert.equal(h.demo.isBusy(),false);assert.equal(JSON.stringify(h.keys),keysBefore,'same unsafe retry must not clear held manual input');
});

test('sufficient-clearance high-speed activation and ordinary zero-speed activation remain available', async()=>{
 for(const speed of[0,65]){
  const h=lifecycleHarness();Object.assign(h.state,{x:2.5,y:0,vx:0,vy:0,vz:-speed,speed});
  for(const x of[-12.5,-7.5,-2.5,2.5,7.5,12.5])h.context.trafficCars.push({mode:'highway',speed:22,vx:0,vz:-22,length:4.62,height:1.25,mesh:{visible:true,position:{x,y:0,z:-80},rotation:{x:0,y:0,z:0}}});
  await h.demo.toggle();assert.equal(h.demo.isActive(),true);assert.equal(h.demo.isBusy(),true);assert.equal(h.state.speed,speed,'activation does not inject or clip speed');
 }
});

test('startup veto is never used to abandon an already-running demo after a sudden hazard',async()=>{
 const h=lifecycleHarness();Object.assign(h.state,{x:2.5,y:0,vx:0,vy:0,vz:-65,speed:65});await h.demo.toggle();assert.equal(h.demo.isActive(),true);
 for(const x of[-12.5,-7.5,-2.5,2.5,7.5,12.5])h.context.trafficCars.push({mode:'highway',speed:22,vx:0,vz:-22,length:4.62,height:1.25,mesh:{visible:true,position:{x,y:0,z:-20},rotation:{x:0,y:0,z:0}}});
 h.demo.step(1/60);assert.equal(h.demo.isActive(),true);assert.equal(h.demo.isBusy(),true);assert.notEqual(h.get('btn-highway-demo').dataset.status,'unsafe');
 assert.equal(h.context.readDriveInput().throttle,h.demo.input().throttle,'still owns its real input rather than silently handing off');
});
