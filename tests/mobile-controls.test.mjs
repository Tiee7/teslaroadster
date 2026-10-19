import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
const controls = source('mobile-controls.js');
const physics = source('physics-main.js');
const config = source('config.js');
const hud = source('ui-hud.js');
const html = source('index.html');
const css = source('styles.css');

function section(text, start, end) {
  const first = text.indexOf(start), last = text.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, `Missing production section: ${start}`);
  return text.slice(first, last);
}

// Execute the real mobile module, keyboard handlers, reset/jump/hold actions,
// and complete movement, tank, gravity, attitude and collision paths. The DOM,
// sound, scene geometry and effects are the only stubs, as in freefall.test.mjs.
const helpers = section(physics, 'function wrapAnglePi(', 'function updateSimulation(');
const motion = section(physics, '  const isRealMode =', '  const playerWorldZ =');
const collision = section(physics, 'function triggerPhysicsCollision(', 'function destroyVehicle(');
const keyboard = section(hud, 'const keys = {};', 'function showBanner(');
const reset = section(hud, 'function resetCar(', 'function applyTranslations(');
const clearAll = section(hud, 'function clearAllInputKeys()', 'function openMapSelectModal()');
const actions = section(hud, 'function triggerJump6m()', 'function toggleStabilizer()');
const g = 9.81;
const inputNames = ['steer', 'throttle', 'brake', 'reverse', 'lift', 'descend', 'strafe', 'roll', 'pitch', 'boost', 'handbrake'];
const close = (actual, expected, tolerance = 1e-10, label = '') =>
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);

test('mobile pads stay outside the scrolling footer and passenger score stays between them', () => {
  assert.ok(html.indexOf('id="mobile-controls"') < html.indexOf('<footer id="hud-footer"'));
  assert.match(css, /body\[data-mobile-controls="true"\] \.city-taxi-hud \{ align-self: center; max-width: max\(108px, calc\(100vw - var\(--mobile-stick-size\) \* 2 - 36px\)\)/);
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1024, 768]]) {
    const stick = height <= 500 ? Math.max(88, Math.min(112, height * 0.24)) : Math.max(88, Math.min(124, width * 0.27));
    const middleWidth = Math.max(108, width - stick * 2 - 36);
    assert.ok((width - middleWidth) / 2 > 10 + stick, `${width}x${height}: score clears both stick pads`);
  }
});

test('repeated idle physics reads do not mutate DOM attributes or measure joystick layout', () => {
  for (const coarse of [false, true]) {
    const h = harness({}, { coarse });
    const nodes = [h.document.body, h.get('mobile-controls'), h.get('mobile-stick-left'), h.get('mobile-stick-right')];
    const snapshot = () => nodes.map(node => [node.attributeWrites, node.layoutReads]);
    const before = snapshot();
    for (let frame = 0; frame < 120; frame++) { h.context.readDriveInput(); h.context.readAttitudeInput(true); }
    assert.deepEqual(snapshot(), before, `${coarse ? 'mobile' : 'desktop'} idle input has no layout/write work`);
  }
});

function harness(overrides = {}, { map = 'highway', coarse = true, legacyMedia = false } = {}) {
  const elements = new Map(), observers = [], pending = new Set();
  const mutate = (target, name) => {
    for (const observer of observers) {
      if (observer.targets.some(([node, options]) => node === target && options.attributes &&
        (!options.attributeFilter || options.attributeFilter.includes(name)))) pending.add(observer);
    }
  };
  class Element {
    constructor(attributes = {}) {
      this.attributes = { ...attributes }; this.listeners = {}; this.styleValues = new Map();
      this.layoutReads = 0; this.attributeWrites = 0;
      this.style = { setProperty: (name, value) => this.styleValues.set(name, value) };
      const classes = new Set((attributes.class || '').split(/\s+/).filter(Boolean));
      this.classList = {
        contains: value => classes.has(value),
        add: (...values) => { values.forEach(value => classes.add(value)); mutate(this, 'class'); },
        remove: (...values) => { values.forEach(value => classes.delete(value)); mutate(this, 'class'); },
        toggle: (value, force = !classes.has(value)) => {
          if (force) classes.add(value); else classes.delete(value);
          mutate(this, 'class'); return force;
        }
      };
      this.dataset = new Proxy({}, { set: (target, key, value) => {
        this.attributeWrites++;
        target[key] = value;
        mutate(this, `data-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`); return true;
      } });
      this.captured = new Set(); this.captureCalls = []; this.releaseCalls = [];
      this.box = { left: 10, top: 20, width: 100, height: 100 };
      this._hidden = 'hidden' in attributes; this._open = false; this.clickCount = 0;
    }
    get hidden() { return this._hidden; }
    set hidden(value) { this.attributeWrites++; this._hidden = value; mutate(this, 'hidden'); }
    get open() { return this._open; }
    set open(value) { this._open = value; mutate(this, 'open'); }
    getBoundingClientRect() { this.layoutReads++; return this.box; }
    addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
    emit(type, event = {}) {
      const result = { type, target: this, pointerId: 1, pointerType: 'touch', button: 0,
        clientX: 60, clientY: 70, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }, ...event };
      for (const listener of this.listeners[type] || []) listener(result);
      return result;
    }
    getAttribute(name) { return this.attributes[name]; }
    setAttribute(name, value) { this.attributeWrites++; this.attributes[name] = value; mutate(this, name); }
    closest() { return null; }
    click() { this.clickCount++; this.emit('click'); }
    setPointerCapture(id) {
      if (this.failCapture) throw new Error('Capture unavailable');
      this.captureCalls.push(id); this.captured.add(id);
    }
    releasePointerCapture(id) {
      this.releaseCalls.push(id);
      if (this.captured.delete(id)) this.emit('lostpointercapture', { pointerId: id });
    }
  }
  class MutationObserver {
    constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); }
    observe(node, options) { this.targets.push([node, options]); }
  }
  for (const match of html.matchAll(/<[a-z][^>]*\bid="([^"]+)"[^>]*>/gi)) {
    const attributes = Object.fromEntries([...match[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
    if (/\shidden(?:\s|>)/.test(match[0])) attributes.hidden = '';
    elements.set(match[1], new Element(attributes));
  }
  const oldButtons = [...html.matchAll(/<(?:button|span)\b[^>]*\bdata-hold-key="([^"]+)"[^>]*>/g)]
    .map(([, code]) => new Element({ 'data-hold-key': code }));
  const get = id => {
    if (!elements.get(id)) elements.set(id, new Element({ id }));
    return elements.get(id);
  };
  const document = new Element(), window = new Element(), media = new Element();
  document.getElementById = get; document.querySelectorAll = () => oldButtons;
  document.body = new Element(); document.body.dataset.hudMode = 'full'; document.hidden = false;
  window.visualViewport = new Element(); window.screen = { orientation: new Element() };
  media.matches = coarse;
  if (legacyMedia) {
    media.addListener = listener => Element.prototype.addEventListener.call(media, 'change', listener);
    media.addEventListener = undefined;
  }
  window.matchMedia = query => { assert.equal(query, '(pointer: coarse)'); return media; };
  ['modal-map-select', 'modal-help', 'modal-destroyed'].forEach(id => get(id).classList.add('hidden'));
  get('mobile-stick-mode').options = ['lift', 'attitude', 'boost'].map(value => ({ value }));
  get('mobile-stick-mode').value = 'lift';
  const soundCalls = [], banners = [];
  const context = vm.createContext({ Element, MutationObserver, document, window,
    cityBuildings: [], frontWheelSteerGroups: [], carMeshGroup: {},
    THREE: { MathUtils: { clamp: (value, low, high) => Math.max(low, Math.min(high, value)), lerp: (a, b, t) => a + (b - a) * t } },
    sound: { init: () => soundCalls.push('init'), beep() {}, speakAlert() {}, playCrash() {} },
    showBanner: (...args) => banners.push(args), renderBannerText() {}, clearDebris() {},
    destroyVehicle() { context.gameState.isDestroyed = true; }
  });
  vm.runInContext(`${config}\n${keyboard}\n${helpers}\n${reset}\n${clearAll}\n${actions}\n${collision}
    function frame(dt) { const t = I18N[currentLang]; ${motion}
      return { airConsumedThisFrame, isRearThrusterFiring, isRetroBrakeFiring, isLiftFiring, isDescendFiring,
        retroBrakeDemand, driveInput, rawRollInput, rawPitchInput, rawYawInput, stabilizerDt };
    }
    function setMap(value) { currentMap = value; }
    function setLanguage(value) { currentLang = value; window.RoadsterTouch.setLanguage(); }
    globalThis.gameState = state; globalThis.gameKeys = keys;
  `, context);
  context.setMap(map);
  Object.assign(context.gameState, { x: 0, z: 0, y: 100, vx: 0, vy: 0, vz: 0, speed: 0, ...overrides });
  vm.runInContext(controls, context);
  const origins = new Map();
  function down(side, id = side === 'left' ? 11 : 22, x = 60, y = 70, event = {}) {
    origins.set(`${side}/${id}`, { x, y });
    return get(`mobile-stick-${side}`).emit('pointerdown', { pointerId: id, clientX: x, clientY: y, ...event });
  }
  function rawMove(side, x, y, id = side === 'left' ? 11 : 22) {
    const origin = origins.get(`${side}/${id}`) || { x: 60, y: 70 };
    const radius = get(`mobile-stick-${side}`).box.width * 0.32;
    return get(`mobile-stick-${side}`).emit('pointermove', { pointerId: id, clientX: origin.x + x * radius, clientY: origin.y - y * radius });
  }
  function move(side, x, y, id = side === 'left' ? 11 : 22) {
    const magnitude = Math.hypot(x, y), rawMagnitude = 0.14 + magnitude * 0.86;
    return rawMove(side, magnitude ? x / magnitude * rawMagnitude : 0, magnitude ? y / magnitude * rawMagnitude : 0, id);
  }
  const read = () => window.RoadsterTouch.readInput();
  function mode(value) { get('mobile-stick-mode').value = value; get('mobile-stick-mode').emit('change'); }
  function flushMutations() {
    while (pending.size) {
      const current = [...pending]; pending.clear(); current.forEach(observer => observer.callback([]));
    }
  }
  return { state: context.gameState, keys: context.gameKeys, context, window, document, media, get,
    down, move, rawMove, read, mode, flushMutations, soundCalls, banners, oldButtons,
    hold(side, x, y, id) { down(side, id); move(side, x, y, id); },
    release(side, type = 'pointerup', id = side === 'left' ? 11 : 22) { get(`mobile-stick-${side}`).emit(type, { pointerId: id }); },
    step: dt => context.frame(dt),
    key(code, isDown = true) { return window.emit(isDown ? 'keydown' : 'keyup', { code, target: document.body }); },
    clear: () => window.RoadsterTouch.clear()
  };
}

function expectInput(h, expected = {}) {
  const actual = h.read();
  for (const name of inputNames) close(actual[name] ?? 0, expected[name] ?? 0, 1e-10, name);
}

function expectReleased(h) {
  expectInput(h);
  for (const side of ['left', 'right']) {
    const element = h.get(`mobile-stick-${side}`);
    assert.equal(element.captured.size, 0, `${side}: capture released`);
    assert.equal(element.classList.contains('is-held'), false, `${side}: held presentation cleared`);
    close(parseFloat(element.styleValues.get('--stick-x') || '0px'), 0);
    close(parseFloat(element.styleValues.get('--stick-y') || '0px'), 0);
  }
}

test('coarse capability enables real sticks, while fine-pointer desktop keeps the existing button grid', () => {
  assert.match(html, /id="mobile-controls" hidden/);
  assert.match(html, /id="touch-controls"[^>]*md:hidden/);
  assert.ok(html.indexOf('src="mobile-controls.js"') > html.indexOf('src="config.js"'));
  assert.ok(html.indexOf('src="mobile-controls.js"') < html.indexOf('src="physics-main.js"'));
  assert.match(css, /#mobile-controls, \.mobile-help\s*\{\s*display:\s*none/);
  const coarseBlock = section(css, '@media (pointer: coarse) {\n  body { --mobile-stick-size', '@media (pointer: coarse) and');
  assert.match(coarseBlock, /body\[data-mobile-controls="true"\] #touch-controls\s*\{\s*display:\s*none !important/);
  assert.match(coarseBlock, /#mobile-controls:not\(\[hidden\]\)[^{]*\{[^}]*pointer-events:\s*none/);
  assert.match(coarseBlock, /\.mobile-stick\s*\{[^}]*pointer-events:\s*auto;\s*touch-action:\s*none/);
  assert.match(coarseBlock, /safe-area-inset-bottom/);
  const fine = harness({}, { coarse: false });
  assert.equal(fine.get('mobile-controls').hidden, true);
  assert.equal(fine.document.body.dataset.mobileControls, 'false');
  fine.hold('left', 0, 1); expectReleased(fine);
  const h = harness();
  assert.equal(h.get('mobile-controls').hidden, false);
  assert.equal(h.document.body.dataset.mobileControls, 'true');
  assert.ok(h.oldButtons.some(button => button.getAttribute('data-hold-key') === 'KeyW'));
});

test('a resting thumb is neutral at centre or pad edge; only deliberate relative drag drives', () => {
  for (const [x, y] of [[60, 70], [11, 21], [109, 119]]) {
    const h = harness();
    assert.equal(h.down('left', 11, x, y).defaultPrevented, true);
    expectInput(h); assert.equal(h.get('mobile-stick-left').classList.contains('is-held'), true);
    h.move('left', 0, 0.5); expectInput(h, { throttle: 0.5 });
    h.release('left'); expectReleased(h);
  }
});

test('two simultaneous pointer IDs retain independent ownership and release only their own pad', () => {
  const h = harness();
  h.hold('left', 0, 0.5); h.hold('right', 0, 1);
  expectInput(h, { throttle: 0.5, lift: 1 });
  assert.deepEqual(h.get('mobile-stick-left').captureCalls, [11]);
  assert.deepEqual(h.get('mobile-stick-right').captureCalls, [22]);
  h.release('left'); expectInput(h, { lift: 1 });
  assert.deepEqual(h.get('mobile-stick-left').releaseCalls, [11], 'synchronous lostcapture is safely re-entrant');
  h.move('right', -0.5, 0); expectInput(h, { strafe: -0.5 });
  h.release('right'); expectReleased(h);
  assert.deepEqual(Object.keys(h.keys), [], 'mobile pointers never write keyboard state');
});

test('stale, mouse, extra and already-owned pointers cannot steal a stick or mutate either input', () => {
  const h = harness();
  h.down('left', 10, 60, 70, { pointerType: 'mouse' });
  h.down('left', 10, 60, 70, { button: 1 }); expectReleased(h);
  h.hold('left', 0, 0.5);
  h.down('left', 33); h.move('left', 1, 0, 33);
  h.down('right', 11); h.move('right', 0, 1, 11);
  h.release('left', 'pointerup', 33); h.release('left', 'pointercancel', 44);
  h.get('mobile-stick-left').emit('lostpointercapture', { pointerId: 44 });
  expectInput(h, { throttle: 0.5 });
  assert.deepEqual(h.get('mobile-stick-left').captureCalls, [11]);
  assert.deepEqual(h.get('mobile-stick-right').captureCalls, []);
  h.release('left'); h.move('left', 0, 1); expectReleased(h);
  assert.equal(h.get('mobile-stick-left').emit('contextmenu').defaultPrevented, true);
});

test('pointerup, pointercancel and lostpointercapture clear displacement, latch and capture idempotently', () => {
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    const h = harness({ y: 0 });
    h.hold('left', 0, -1); h.hold('right', 0, 1);
    h.release('left', type); expectInput(h, { lift: 1 });
    h.release('right', type); h.clear(); h.clear(); expectReleased(h);
    h.move('left', 0, -1); h.move('right', 0, 1); expectReleased(h);
    h.hold('left', 0, 1, 33); expectInput(h, { throttle: 1 });
  }
});

test('failed capture aborts ownership without leaving any thrust or stuck held appearance', () => {
  const h = harness(); h.get('mobile-stick-right').failCapture = true;
  h.down('right'); h.move('right', 0, 1); expectReleased(h);
  h.get('mobile-stick-right').failCapture = false;
  h.hold('right', 0, 1); expectInput(h, { lift: 1 });
});

test('radial deadzone, per-axis neutral band and circular saturation retain precise analog magnitude', () => {
  const h = harness(); h.down('left');
  for (const [x, y] of [[0, 0], [0.13, 0], [0, 0.14], [0.09, 0.09]]) {
    h.rawMove('left', x, y); expectInput(h);
  }
  h.rawMove('left', 0.57, 0); expectInput(h, { steer: 0.5 });
  close(parseFloat(h.get('mobile-stick-left').styleValues.get('--stick-x')), 16);
  h.rawMove('left', 0.1, 1);
  assert.equal(h.read().steer, 0, 'near-vertical movement does not add unwanted steering');
  h.rawMove('left', 1, 0.1);
  assert.equal(h.read().throttle, 0, 'near-horizontal movement does not add unwanted throttle');
  for (const [x, y] of [[1, 1], [10, 10], [-5, 3]]) {
    h.rawMove('left', x, y);
    const input = h.read(); close(Math.hypot(input.steer, input.throttle), 1);
    close(input.steer, x / Math.hypot(x, y)); close(input.throttle, y / Math.hypot(x, y));
  }
});

test('left stick maps steering and throttle independently; lower pull latches brake until centred', () => {
  const h = harness({ y: 0, speed: 12, vz: -12 });
  h.hold('left', -0.6, 0.8); expectInput(h, { steer: -0.6, throttle: 0.8 });
  h.move('left', 0, -0.5); expectInput(h, { brake: 0.5 });
  Object.assign(h.state, { speed: 0, vx: 0, vy: 0, vz: 0 });
  h.move('left', 0, -1); expectInput(h, { brake: 1 });
  h.step(0.1); close(h.state.speed, 0, 0, 'holding a braking pull cannot accelerate backward after stopping');
  h.move('left', 0, 0); expectInput(h);
  h.move('left', 0, -0.5); expectInput(h, { reverse: 0.5 });
  h.step(0.1); close(h.state.speed, -0.8);
  h.release('left'); h.hold('left', 0, 1); expectInput(h, { throttle: 1 });
});

test('moving backward and airborne lower pulls brake, while a fresh stationary grounded pull reverses', () => {
  for (const overrides of [{ y: 0, speed: -8, vz: 8 }, { y: 100, wasAirborne: true }, { y: 0, isJumping6m: true }]) {
    const h = harness(overrides); h.hold('left', 0, -1); expectInput(h, { brake: 1 });
  }
  const h = harness({ y: 0 }); h.hold('left', 0, -1); expectInput(h, { reverse: 1 });
  h.clear(); h.move('left', 0, -1); expectReleased(h);
});

test('right modes have exact signed lift/descend/strafe, pitch/roll and boost/handbrake mappings', () => {
  const cases = [
    ['lift', 0.6, 0.8, { lift: 0.8, strafe: 0.6 }],
    ['lift', -0.6, -0.8, { descend: 0.8, strafe: -0.6 }],
    ['attitude', 0.6, 0.8, { roll: -0.6, pitch: 0.8 }],
    ['attitude', -0.6, -0.8, { roll: 0.6, pitch: -0.8 }],
    ['boost', 0.6, 0.8, { boost: 0.8, strafe: 0.6 }],
    ['boost', -0.6, -0.8, { handbrake: 0.8, strafe: -0.6 }]
  ];
  for (const [mode, x, y, expected] of cases) {
    const h = harness(); h.mode(mode); h.hold('right', x, y); expectInput(h, expected);
  }
});

test('every mode change releases both fingers and stale moves require fresh pointerdowns', () => {
  const h = harness();
  for (const mode of ['attitude', 'boost', 'lift', 'unrecognized']) {
    h.hold('left', 0.5, 0.5); h.hold('right', 0, 1);
    h.mode(mode); expectReleased(h);
    h.move('left', 0, 1); h.move('right', 0, 1); expectReleased(h);
    assert.equal(h.get('mobile-stick-mode').value, mode === 'unrecognized' ? 'lift' : mode);
    h.hold('right', 0, 0.5, 99);
    assert.ok(Object.values(h.read()).some(value => Math.abs(value - 0.5) < 1e-10));
    h.clear();
  }
});

for (const reason of ['blur', 'pagehide', 'resize', 'orientationchange', 'visual viewport resize', 'screen rotation', 'visibilitychange']) {
  test(`${reason} releases both pointers and a returning stale gesture cannot reactivate them`, () => {
    const h = harness(); h.hold('left', 0, 1); h.hold('right', 0, 1);
    if (reason === 'visual viewport resize') h.window.visualViewport.emit('resize');
    else if (reason === 'screen rotation') h.window.screen.orientation.emit('change');
    else if (reason === 'visibilitychange') { h.document.hidden = true; h.document.emit('visibilitychange'); }
    else h.window.emit(reason);
    expectReleased(h);
    h.document.hidden = false; h.document.emit('visibilitychange');
    h.move('left', 0, 1); h.move('right', 0, 1); expectReleased(h);
    h.hold('left', 0, 1, 55); expectInput(h, { throttle: 1 });
  });
}

for (const legacyMedia of [false, true]) {
  test(`media capability transition clears held pointers (${legacyMedia ? 'legacy addListener' : 'change event'})`, () => {
    const h = harness({}, { legacyMedia }); h.hold('left', 0, 1); h.hold('right', 0, 1);
    h.media.matches = false; h.media.emit('change'); expectReleased(h);
    assert.equal(h.get('mobile-controls').hidden, true);
    h.media.matches = true; h.media.emit('change');
    assert.equal(h.get('mobile-controls').hidden, false);
    h.move('left', 0, 1); expectReleased(h);
  });
}

for (const id of ['modal-map-select', 'modal-help', 'modal-destroyed', 'ranked-dialog', 'audio-settings', 'paint-picker']) {
  test(`${id} opening clears both sticks, suppresses utilities and requires a new gesture after close`, () => {
    const h = harness(); h.hold('left', 0, 1); h.hold('right', 0, 1);
    const dialog = h.get(id), native = !id.startsWith('modal-');
    if (native) dialog.open = true; else dialog.classList.remove('hidden');
    h.flushMutations(); expectReleased(h); assert.equal(h.get('mobile-controls').hidden, true);
    h.get('mobile-jump').click(); assert.equal(h.state.isJumping6m, false);
    if (native) dialog.open = false; else dialog.classList.add('hidden');
    h.flushMutations(); assert.equal(h.get('mobile-controls').hidden, false);
    h.move('left', 0, 1); h.move('right', 0, 1); expectReleased(h);
    h.hold('left', 0, 0.5, 44); expectInput(h, { throttle: 0.5 });
  });
}

test('Full and Medium keep controls; Minimal and destroyed state cancel all stick requests', () => {
  const h = harness();
  h.document.body.dataset.hudMode = 'medium'; h.flushMutations();
  h.hold('left', 0, 1); expectInput(h, { throttle: 1 });
  h.document.body.dataset.hudMode = 'minimal'; h.flushMutations(); expectReleased(h);
  assert.equal(h.get('mobile-controls').hidden, true);
  h.document.body.dataset.hudMode = 'full'; h.flushMutations();
  h.move('left', 0, 1); expectReleased(h);
  h.hold('right', 0, 1); h.state.isDestroyed = true;
  expectReleased(h); assert.equal(h.get('mobile-controls').hidden, true);
  h.state.isDestroyed = false; h.window.RoadsterTouch.sync();
  h.move('right', 0, 1); expectReleased(h);
});

test('mobile Reset and keyboard R execute the actual reset and cannot leave either finger applying thrust', () => {
  for (const keyboardReset of [false, true]) {
    const h = harness(); h.hold('left', 0, 1); h.hold('right', 0, 1);
    if (keyboardReset) h.key('KeyR'); else h.get('mobile-reset').click();
    expectReleased(h); close(h.state.y, 0); close(h.state.speed, 42); close(h.state.airRemaining, 10);
    h.move('left', 0, 1); h.move('right', 0, 1); expectReleased(h);
  }
});

test('the existing clearAllInputKeys map/menu hook releases both mobile and keyboard sources', () => {
  const h = harness(); h.key('KeyW'); h.key('KeyJ');
  h.hold('left', 0, 1); h.hold('right', 0, 1);
  h.context.clearAllInputKeys(); expectReleased(h);
  assert.equal(h.keys.KeyW, false); assert.equal(h.keys.KeyJ, false);
  h.move('left', 0, 1); h.move('right', 0, 1); expectReleased(h);
  h.hold('right', 0, 0.5, 88); expectInput(h, { lift: 0.5 });
});

test('Jump, altitude-hold toggle and View call existing actions without synthesizing held keys', () => {
  const h = harness(); h.get('mobile-jump').click();
  assert.equal(h.state.isJumping6m, true); close(h.state.jumpTargetY, 106); assert.ok(h.state.vy > 0);
  h.get('mobile-hold').click(); assert.equal(h.state.isJumping6m, false); assert.equal(h.state.isAltitudeHold, true);
  h.state.vy = 0; const result = h.step(0.1);
  close(result.airConsumedThisFrame, 0.022); close(h.state.y, 100); close(h.state.vy, 0);
  h.get('mobile-hold').click(); assert.equal(h.state.isAltitudeHold, false);
  h.get('mobile-camera').click(); assert.equal(h.get('btn-camera').clickCount, 1);
  assert.deepEqual(Object.keys(h.keys), []);
});

test('English and Chinese labels expose the mode, live hint and accurate brake/reverse guidance', () => {
  const h = harness();
  assert.match(h.get('mobile-help-copy').textContent, /centre then pull down again to reverse/);
  h.mode('attitude'); assert.match(h.get('mobile-stick-right').getAttribute('aria-label'), /Attitude.*Pitch.*Roll/);
  h.context.setLanguage('zh');
  assert.equal(h.get('mobile-hold').textContent, '定高');
  assert.match(h.get('mobile-help-copy').textContent, /停稳后回中再下拉可倒车/);
  assert.match(h.get('mobile-stick-right').getAttribute('aria-label'), /姿态.*俯仰.*横滚/);
  h.mode('boost'); assert.match(h.get('mobile-right-hint').textContent, /喷气.*漂移.*平移/);
});

test('neutral thumbs and released thumbs retain exact freefall and consume no air on either map', () => {
  for (const map of ['highway', 'city']) for (const fps of [30, 60, 144]) {
    const h = harness({ vy: 3 }, { map }); h.down('left', 11, 11, 21); h.down('right', 22, 109, 119);
    for (let i = 0; i < fps; i++) close(h.step(1 / fps).airConsumedThisFrame, 0);
    close(h.state.y, 100 + 3 - 0.5 * g); close(h.state.vy, 3 - g); close(h.state.airRemaining, 10);
    h.move('right', 0, 1); h.step(1 / fps); h.release('left'); h.release('right');
    const { y, vy, airRemaining } = h.state;
    for (let i = 0; i < fps; i++) close(h.step(1 / fps).airConsumedThisFrame, 0);
    close(h.state.y, y + vy - 0.5 * g); close(h.state.vy, vy - g); close(h.state.airRemaining, airRemaining);
  }
});

test('half/full left throttle produces proportionate ground motor force without gas burn on both maps', () => {
  for (const map of ['highway', 'city']) for (const demand of [0.25, 0.5, 1]) {
    const h = harness({ y: 0 }, { map }); h.hold('left', 0, demand);
    const result = h.step(0.05);
    close(h.state.speed, 16.5 * demand * 0.05); close(result.airConsumedThisFrame, 0);
    assert.equal(result.isRearThrusterFiring, false); close(h.state.airRemaining, 10);
  }
});

test('half/full ground steering reaches the real smoothed rack with the correct sign and no RCS bill', () => {
  for (const map of ['highway', 'city']) for (const demand of [-1, -0.5, 0.5, 1]) {
    const h = harness({ y: 0, speed: 10, vz: -10 }, { map }); h.hold('left', demand, 0);
    const result = h.step(0.05);
    close(h.state.steerInput, demand * 8 * 0.05); close(h.state.steerAngle, -demand * 8 * 0.05 * 0.38);
    close(result.rawYawInput, 0); close(result.airConsumedThisFrame, 0);
    assert.ok(h.state.yaw * demand < 0, 'steering changes the ground nose in the intended direction');
  }
});

test('both fingers affect the same real physics frame and release independently without double-charging gas', () => {
  for (const map of ['highway', 'city']) {
    const h = harness({}, { map }); h.hold('left', 0, 0.5); h.hold('right', 0.5, 0);
    const result = h.step(0.05);
    close(h.state.vz, -9.5 * 0.5 * 0.05);
    close(h.state.vx, 0.5 * 18 * (1 - Math.exp(-10 * 0.05)));
    close(result.airConsumedThisFrame, (0.65 * 0.5 + 0.45 * 0.5) * 0.05);
    h.release('left'); const strafeOnly = h.step(0.05);
    close(strafeOnly.airConsumedThisFrame, 0.45 * 0.5 * 0.05);
    assert.equal(strafeOnly.isRearThrusterFiring, false);
    h.release('right'); close(h.step(0.05).airConsumedThisFrame, 0); expectReleased(h);
  }
});

test('half/full airborne throttle scales rear impulse and shared tank use on both maps', () => {
  for (const map of ['highway', 'city']) for (const demand of [0.5, 1]) {
    const h = harness({}, { map }); h.hold('left', 0, demand);
    const result = h.step(0.05);
    close(h.state.vz, -9.5 * demand * 0.05); close(h.state.vy, -g * 0.05);
    close(result.airConsumedThisFrame, 0.65 * demand * 0.05); assert.equal(result.isRearThrusterFiring, true);
  }
});

test('half/full Boost scales ground and aerial thrust and burn rather than becoming a digital button', () => {
  for (const map of ['highway', 'city']) for (const y of [0, 100]) for (const demand of [0.5, 1]) {
    const h = harness({ y }, { map }); h.mode('boost'); h.hold('right', 0, demand);
    const result = h.step(0.05);
    close(h.state.speed, (y ? 24 : 38) * demand * 0.05);
    close(result.airConsumedThisFrame, 0.85 * demand * 0.05); assert.equal(result.isRearThrusterFiring, true);
  }
});

test('a tiny Boost cannot promote held W to full rocket force or bypass the motor ceiling', () => {
  for (const map of ['highway', 'city']) for (const y of [0, 100]) {
    const h = harness({ y }, { map }); h.key('KeyW'); h.mode('boost'); h.hold('right', 0, 0.1);
    const result = h.step(0.05);
    close(h.state.speed, (y ? 9.5 : 16.5) * 0.05);
    close(result.airConsumedThisFrame, (y ? 0.65 : 0.085) * 0.05);
    h.release('right'); assert.equal(h.keys.KeyW, true); close(h.context.readDriveInput().throttle, 1);
    const limit = 200 / 3.6, faster = harness({ y: 0, speed: limit, vz: -limit }, { map });
    faster.key('KeyW'); faster.mode('boost'); faster.hold('right', 0, 0.1);
    faster.step(0.05); close(faster.state.speed, limit + 38 * 0.1 * 0.05);
  }
});

test('half/full Lift pays for proportional gravity compensation plus climb force', () => {
  for (const map of ['highway', 'city']) for (const physicsMode of ['realistic', 'fantasy']) for (const demand of [0.25, 0.5, 1]) {
    const h = harness({ physicsMode }, { map }); h.hold('right', 0, demand);
    const result = h.step(0.05), lift = physicsMode === 'realistic' ? 8.2 * 1.3 : 48 * 1.3;
    close(h.state.vy, ((lift + g) * demand - g) * 0.05);
    close(result.airConsumedThisFrame, demand * 0.05); assert.equal(result.isLiftFiring, true);
    if (demand === 1) {
      const keyboardH = harness({ physicsMode }, { map }); keyboardH.key('Space'); keyboardH.step(0.05);
      close(h.state.vy, keyboardH.state.vy); close(h.state.airRemaining, keyboardH.state.airRemaining);
    }
  }
});

test('half/full Descend adds only its requested downward force and gas use, with gravity retained', () => {
  for (const map of ['highway', 'city']) for (const demand of [0.5, 1]) {
    const h = harness({}, { map }); h.hold('right', 0, -demand);
    const result = h.step(0.05);
    close(h.state.vy, -(g + 18.5 * demand) * 0.05);
    close(result.airConsumedThisFrame, 0.55 * demand * 0.05);
    assert.equal(result.isLiftFiring, false); assert.equal(result.isDescendFiring, true);
  }
});

test('half/full braking scales mechanical and high-speed retro force with exactly one tank charge', () => {
  for (const map of ['highway', 'city']) for (const speed of [20, 100]) for (const demand of [0.5, 1]) {
    const h = harness({ y: 0, speed, vz: -speed }, { map }); h.hold('left', 0, -demand);
    const result = h.step(0.05), retro = speed > 240 / 3.6 ? 80000 / 1994 : 0;
    close(h.state.speed, speed - (38 + retro) * demand * 0.05);
    close(result.airConsumedThisFrame, speed > 240 / 3.6 ? 0.55 * demand * 0.05 : 0);
    close(result.retroBrakeDemand, speed > 240 / 3.6 ? demand : 0);
  }
});

test('half/full strafe uses the side-jet axis and proportional gas without inventing roll or yaw torque', () => {
  for (const map of ['highway', 'city']) for (const mode of ['lift', 'boost']) for (const demand of [-1, -0.5, 0.5, 1]) {
    const h = harness({}, { map }); h.mode(mode); h.hold('right', demand, 0);
    const result = h.step(0.05);
    close(h.state.vx, demand * 18 * (1 - Math.exp(-6.5 * 0.05)));
    close(result.airConsumedThisFrame, 0.45 * Math.abs(demand) * 0.05);
    close(h.state.vRoll, 0); close(h.state.vYaw, 0); close(h.state.attitudeIdleSeconds, 0);
  }
});

test('attitude sticks scale signed roll, pitch and yaw torque and share max-axis RCS billing', () => {
  const dt = 0.05;
  for (const map of ['highway', 'city']) for (const demand of [-1, -0.5, 0.5, 1]) {
    for (const axis of ['roll', 'pitch', 'yaw']) {
      const h = harness({}, { map }); h.mode('attitude');
      if (axis === 'roll') h.hold('right', -demand, 0);
      if (axis === 'pitch') h.hold('right', 0, demand);
      if (axis === 'yaw') h.hold('left', -demand, 0);
      const result = h.step(dt), rate = axis === 'roll' ? 3.6 : axis === 'pitch' ? 3.2 : 2.2;
      close(h.state[`v${axis[0].toUpperCase()}${axis.slice(1)}`], demand * rate * dt * Math.pow(axis === 'yaw' ? 0.25 : 0.2, dt));
      close(result.airConsumedThisFrame, 0.38 * Math.abs(demand) * dt);
      close(h.state.attitudeIdleSeconds, 0); close(result.stabilizerDt, 0);
    }
    const both = harness({}, { map }); both.mode('attitude');
    both.hold('left', -demand, 0); both.hold('right', -demand * 0.6, demand * 0.8);
    close(both.step(dt).airConsumedThisFrame, 0.38 * Math.abs(demand) * dt);
  }
});

test('manual analog input resets the two-second stabilizer grace and release restores it without gas burn', () => {
  const h = harness({ roll: 0.7, pitch: 0.5, attitudeIdleSeconds: 2 });
  h.mode('attitude'); h.hold('right', -0.5, 0);
  close(h.step(0.05).stabilizerDt, 0); close(h.state.attitudeIdleSeconds, 0);
  h.release('right');
  for (let i = 0; i < 39; i++) close(h.step(0.05).stabilizerDt, 0, 1e-12);
  const crossing = h.step(0.1); close(crossing.stabilizerDt, 0.05, 1e-10);
  close(crossing.airConsumedThisFrame, 0); assert.ok(h.state.vPitch < 0, 'released pitch self-levels after grace');
  h.state.autoStabilizer = false; close(h.step(0.1).stabilizerDt, 0);
});

test('mobile cleanup and mode switching never release keyboard drive, lift or attitude keys', () => {
  const h = harness();
  for (const key of ['KeyW', 'Space', 'KeyJ']) h.key(key);
  h.hold('left', 0, 0.5); h.hold('right', 0, 0.5);
  for (const cleanup of [() => h.release('left'), () => h.release('right', 'pointercancel'), () => h.mode('boost'), h.clear]) {
    cleanup();
    for (const key of ['KeyW', 'Space', 'KeyJ']) assert.equal(h.keys[key], true);
    close(h.context.readDriveInput().throttle, 1); close(h.context.readDriveInput().lift, 1);
    close(h.context.readAttitudeInput(true).rawRollInput, 1);
  }
  for (const key of ['KeyW', 'Space', 'KeyJ']) h.key(key, false);
  close(h.context.readDriveInput().throttle, 0); close(h.context.readDriveInput().lift, 0);
  close(h.context.readAttitudeInput(true).rawRollInput, 0);
});

test('keyboard and touch priority, opposite axes and saturation stay bounded and preserve source ownership', () => {
  const h = harness({ y: 0, speed: 20, vz: -20 });
  h.hold('left', 0, -0.5); h.key('KeyW');
  const result = h.step(0.05); close(h.state.speed, 20 + 16.5 * 0.05); assert.equal(result.isRetroBrakeFiring, false);
  h.key('KeyW', false); h.clear(); h.hold('left', 0.5, 0); h.key('KeyA');
  close(h.context.readDriveInput().steer, -0.5); h.release('left'); close(h.context.readDriveInput().steer, -1);
  h.key('KeyA', false); h.key('KeyD'); h.hold('left', 0.5, 0); close(h.context.readDriveInput().steer, 1);
  h.mode('attitude'); h.key('KeyJ'); h.hold('right', 0.5, 0); close(h.context.readAttitudeInput(true).rawRollInput, 0.5);
  h.release('right'); close(h.context.readAttitudeInput(true).rawRollInput, 1);
});

test('half/full handbrake feathers drift scrubbing without rear gas and remains effective with throttle', () => {
  for (const map of ['highway', 'city']) for (const demand of [0.5, 1]) {
    const h = harness({ y: 0, speed: 20, vz: -20 }, { map }); h.mode('boost'); h.hold('right', 0, -demand);
    const result = h.step(0.05);
    close(h.state.speed, 20 - 1.2 * demand * 0.05); close(result.airConsumedThisFrame, 0);
    h.key('KeyW'); h.hold('left', 0.5, 0); h.step(0.05);
    assert.equal(h.state.wasHandbraking, true); assert.equal(h.state.isDrifting, true);
    assert.ok(h.state.speed > 20 - 1.2 * demand * 0.05);
  }
});

test('empty tank gives no unpaid analog thrust while normal ground motor and mechanical brake remain usable', () => {
  for (const map of ['highway', 'city']) for (const mode of ['lift', 'attitude', 'boost']) {
    const h = harness({ airRemaining: 0, isFreefalling: true }, { map }); h.mode(mode);
    h.hold('right', 0.6, 0.8); h.hold('left', 0, 0.5);
    const result = h.step(0.05); close(result.airConsumedThisFrame, 0); close(h.state.vy, -g * 0.05);
    close(h.state.vx, 0); close(h.state.vz, 0); close(h.state.vRoll, 0); close(h.state.vPitch, 0);
    const ground = harness({ y: 0, airRemaining: 0, isFreefalling: true }, { map }); ground.hold('left', 0, 0.5);
    ground.step(0.05); close(ground.state.speed, 16.5 * 0.5 * 0.05);
    ground.clear(); Object.assign(ground.state, { speed: 20, vz: -20 }); ground.hold('left', 0, -0.5);
    ground.step(0.05); close(ground.state.speed, 20 - 38 * 0.5 * 0.05);
  }
});
