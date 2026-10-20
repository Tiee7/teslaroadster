import * as threeMathUtils from './vendor/three-r128-MathUtils.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

export const source = name => readFileSync(new URL(`../../src/${name}`, import.meta.url), 'utf8');
const html = source('index.html');
export const section = (text, start, end) => {
  const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Missing production section: ${start}`);
  return text.slice(a, b);
};
export const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
export const issued = runId => response({ runId, durationMs: 60000, scoreVersion: 'distance-v2' });
export const flush = () => new Promise(resolve => setImmediate(resolve));
export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Only browser DOM, media, effects and transport are fake. The actual demo,
// ranked, keyboard/touch, jump, reset/map and selected physics code execute.
export function lifecycleHarness() {
  class Element {
    constructor(attributes = {}) {
      this.attributes = { ...attributes }; this.id = attributes.id || '';
      this.listeners = {}; this.children = []; this.dataset = {};
      this.value = ''; this.textContent = ''; this.open = false; this.disabled = false;
      this.hidden = 'hidden' in attributes; this.type = attributes.type || '';
      this.isConnected = true; this.style = { setProperty() {} }; this.captured = new Set();
      const classes = new Set((attributes.class || '').split(/\s+/).filter(Boolean));
      this.classList = {
        add: (...xs) => xs.forEach(x => classes.add(x)),
        remove: (...xs) => xs.forEach(x => classes.delete(x)),
        contains: x => classes.has(x),
        toggle: (x, on = !classes.has(x)) => { if (on) classes.add(x); else classes.delete(x); return on; }
      };
      this.paused = true;
    }
    addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
    async emit(type, extra = {}) {
      const event = { type, target: this, currentTarget: this, defaultPrevented: false,
        pointerId: 1, pointerType: 'touch', button: 0, clientX: 60, clientY: 70,
        preventDefault() { this.defaultPrevented = true; }, ...extra };
      // Invoke all handlers synchronously like the DOM, then await their work.
      await Promise.all((this.listeners[type] || []).map(listener => listener(event)));
      return event;
    }
    click() { return this.emit('click'); }
    getAttribute(name) { return this.attributes[name]; }
    setAttribute(name, value) { this.attributes[name] = value; }
    appendChild(child) { this.children.push(child); return child; }
    replaceChildren(...children) { this.children = children; }
    querySelectorAll(selector) { return selector === 'option' ? this.children : []; }
    closest() { return this.type === 'text' ? this : null; }
    focus() { this.ownerDocument.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; void this.emit('close'); }
    getBoundingClientRect() { return { left: 10, top: 20, width: 100, height: 100, right: 110, bottom: 120 }; }
    setPointerCapture(id) { this.captured.add(id); }
    releasePointerCapture(id) { if (this.captured.delete(id)) void this.emit('lostpointercapture', { pointerId: id }); }
    pause() { this.paused = true; }
    play() { this.paused = false; return Promise.resolve(); }
    load() {}
  }
  const elements = new Map();
  for (const match of html.matchAll(/<[a-z][^>]*\bid="([^"]+)"[^>]*>/gi)) {
    const attrs = Object.fromEntries([...match[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]));
    if (/\shidden(?:\s|>)/.test(match[0])) attrs.hidden = '';
    elements.set(match[1], new Element(attrs));
  }
  const get = id => { assert.ok(elements.has(id), `Missing real DOM node ${id}`); return elements.get(id); };
  const document = new Element(), window = new Element(), media = new Element();
  document.body = new Element(); document.body.dataset.hudMode = 'full'; document.hidden = false;
  document.getElementById = get; document.createElement = () => new Element();
  const holdButtons = [...html.matchAll(/<(?:button|span)\b[^>]*\bdata-hold-key="([^"]+)"[^>]*>/g)]
    .map(([, code]) => new Element({ 'data-hold-key': code }));
  document.querySelectorAll = () => holdButtons;
  Object.values([document.body, ...elements.values(), ...holdButtons]).forEach(el => { el.ownerDocument = document; });
  document.activeElement = get('btn-leaderboard');
  ['modal-map-select', 'modal-help', 'modal-destroyed'].forEach(id => get(id).classList.add('hidden'));
  get('ranked-category').children = ['highway-realistic', 'highway-fantasy', 'city-realistic', 'city-fantasy']
    .map(value => Object.assign(new Element(), { value }));
  get('ranked-category').value = 'highway-realistic'; get('ranked-nickname').type = 'text';
  get('mobile-stick-mode').options = ['lift', 'attitude', 'boost'].map(value => ({ value }));
  get('mobile-stick-mode').value = 'lift';
  media.matches = true; window.matchMedia = () => media;
  window.screen = { orientation: new Element() }; window.visualViewport = new Element();
  let now = 1000, nextRun = 0;
  const calls = [], impacts = [];
  const defaultNetwork = async (url, options) => {
    if (url.startsWith('/api/leaderboard')) return response({ category: 'highway-realistic', entries: [], limit: 100 });
    if (url === '/api/run') return issued(`manual-${++nextRun}`);
    if (url === '/api/end') return response({ ended: true, runId: JSON.parse(options.body).runId });
    if (url === '/api/score') return response({ accepted: true, improved: true, bestScore: JSON.parse(options.body).score, rank: 1 });
    throw new Error(`Unexpected request ${url}`);
  };
  let network = defaultNetwork;
  const context = vm.createContext({ window, document, Element, TextEncoder, URL, AbortController,
    performance: { now: () => now }, lastTime: 0, setTimeout: () => 1, clearTimeout() {}, setInterval() {},
    localStorage: { getItem: () => null, setItem() {} }, history: { state: {}, pushState(value) { this.state = value; } },
    fetch: async (url, options) => { calls.push({ url, options }); return network(url, options); },
    sound: { init() {}, beep() {}, speakAlert() {}, playCrash() {}, simulatedEngineEnabled: true },
    THREE: { MathUtils: threeMathUtils },
    cityBuildings: [], trafficCars: [], frontWheelSteerGroups: [], carMeshGroup: {}, cameraModeIndex: 0,
    highwayEnvGroup: {}, cityEnvGroup: {}, hoverRingMat: {},
    showBanner() {}, renderBannerText() {}, clearDebris() {}, updateDestroyedModalText() {},
    spawnDestructionDebris() {}, spawnExplosionEffect() {}, applyExplosionBlastToTraffic() {},
    triggerPhysicsCollision: (...args) => impacts.push(args),
    highlightSelectedMapCard() {}, renderModalPaintGrid() {}, renderPreview() {},
    updateHudBounds() {}, toggleHudMode() {}, togglePhysicsMode() {}, togglePlaidMode() {}, toggleSpeedUnit() {}, toggleLanguage() {},
    toggleStabilizer: () => { window.RoadsterRanked?.abort('stabilizer'); context.stateRef.autoStabilizer = !context.stateRef.autoStabilizer; },
    cycleWeatherMode() {}, updateZoomButtonLabel() {},
    selectWeatherMode: value => { window.RoadsterRanked?.abort('weather'); vm.runInContext(`weatherIndex=${value}`, context); },
    populateTraffic: count => { context.trafficCount = count; },
    applyTranslations: () => { window.RoadsterDemo?.render(); window.RoadsterRanked?.render(); }
  });
  const hud = source('ui-hud.js'), physics = source('physics-main.js');
  vm.runInContext(`${source('driving-score.js')}\n${source('config.js')}\n
    ${section(hud, 'const HUD_MODES =', 'const keys = {};')}
    ${section(hud, 'const keys = {};', 'function showBanner(')}
    ${section(hud, 'function clearAllInputKeys()', 'function openMapSelectModal()')}
    ${section(hud, 'function resetCar()', 'function applyTranslations(')}
    ${section(hud, 'function switchMap(', 'function resetCar()')}
    ${section(hud, 'function openMapSelectModal()', "document.getElementById('btn-map-select')")}
    ${section(hud, 'function triggerJump6m()', 'function toggleStabilizer()')}
    ${section(hud, 'function toggleHelpModal()', "document.getElementById('btn-help')")}
    ${section(physics, 'function wrapAnglePi(', 'function updateSimulation(')}
    ${section(physics, 'function destroyVehicle(', 'function updateDestroyedScores(')}
    function fullMotion(dt) { const t=I18N[currentLang];
      ${section(physics, '  const isRealMode =', '  const playerWorldZ =')}
      return {isAirborne,isRearThrusterFiring,airJetLeft,airJetRight,airConsumedThisFrame};
    }
    globalThis.stateRef=state; globalThis.keyRef=keys;
    globalThis.setMap=value=>{currentMap=value;};
    globalThis.setLanguage=value=>{currentLang=value;};
  `, context);
  vm.runInContext(source('music.js'), context);
  vm.runInContext(source('mobile-controls.js'), context);
  vm.runInContext(source('leaderboard.js'), context);
  const keyboardHandlersBeforeDemo = (window.listeners.keydown || []).length;
  vm.runInContext(source('highway-traffic.js'), context);
  const demoSource=source('highway-demo.js'),plannerAnchor='  const planner = RoadsterHighwayDemoPlanner.create(LANE_CENTERS, WORLD_SPEED_SCALE);';
  assert.equal(demoSource.split(plannerAnchor).length,2);
  vm.runInContext(demoSource.replace(plannerAnchor,plannerAnchor+'globalThis.adapterPlannerForTest=planner;'), context);
  // Execute the real paint-entry function in its adapter's expected lexical scope.
  vm.runInContext(`(() => {
    const $=id=>document.getElementById(id), picker=$('paint-picker'), vehicleButton=$('btn-paint');
    const historyKey='test-paint', historyToken='paint-entry';
    let pendingBack=false,deferredOpen=null,returnFocus=null,ownsHistory=false;
    const menuVisible=()=>!$('modal-map-select').classList.contains('hidden');
    ${section(source('start-screen.js'), '  function openPaint(', '  function closePaint(')}
    globalThis.openPaint=openPaint;
  })();`, context);
  Object.assign(context.stateRef, { x: 2.5, y: 0, z: 0, vx: 0, vy: 0, vz: -42, speed: 42,
    airRemaining: 10, isDestroyed: false, physicsMode: 'realistic', insaneMode: false, autoStabilizer: true });
  const demo = window.RoadsterDemo;
  return { context, document, window, get, calls, impacts, demo, state: context.stateRef, keys: context.keyRef,
    keyboardHandlersBeforeDemo, hold: code => holdButtons.find(el => el.getAttribute('data-hold-key') === code),
    network: fn => { network = fn; }, defaultNetwork,
    requests: path => calls.filter(call => call.url === path),
    phase: () => get('ranked-hud').dataset.phase,
    click: id => get(id).emit('click'),
    async start(name = 'Manual Racer') { get('ranked-nickname').value = name; await get('ranked-start').emit('click'); },
    advance(ms) { now += ms; window.RoadsterRanked.tick(now); },
    step(dt = 1 / 60) { demo.step(dt); return context.fullMotion(dt); },
    async key(code, extra = {}) { return window.emit('keydown', { target: null, code, repeat: false, ...extra }); },
    async stick(side, x, y, pointerId = side === 'left' ? 11 : 22) {
      const el = get(`mobile-stick-${side}`);
      await el.emit('pointerdown', { pointerId, clientX: 60, clientY: 70 });
      await el.emit('pointermove', { pointerId, clientX: 60 + x * 32, clientY: 70 - y * 32 });
    }
  };
}
