import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const html = read('src/index.html');
const ui = read('src/ui-hud.js');
const moduleSource = read('src/start-screen.js');
const config = read('src/config.js');
const css = read('src/styles.css');
function fn(name) {
  const start = ui.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return ui.slice(start, ui.indexOf('\n}', start) + 2);
}
class Element {
  constructor(id = '', tag = '') {
    this.id = id; this.tagName = tag; this.children = []; this.listeners = {}; this.attributes = {}; this.style = {};
    this.open = false; this.isConnected = true; this.disabled = false; this.clientWidth = 330; this.clientHeight = 100;
    this.textContent = ''; this.options = []; this.parentNode = null; this.value = ''; this.innerHTML = '';
    const classes = new Set();
    this.classList = { contains: x => classes.has(x), add: (...xs) => xs.forEach(x => classes.add(x)), remove: (...xs) => xs.forEach(x => classes.delete(x)), toggle: (x, on = !classes.has(x)) => on ? classes.add(x) : classes.delete(x) };
  }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  emit(type, event = {}) { const e = { target: this, currentTarget: this, preventDefault() { this.prevented = true; }, ...event }; for (const listener of this.listeners[type] || []) listener(e); return e; }
  appendChild(child) { if (child.parentNode) child.parentNode.children = child.parentNode.children.filter(x => x !== child); this.children.push(child); child.parentNode = this; return child; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  focus() { this.ownerDocument.activeElement = this; }
  showModal() { this.open = true; }
  close() { this.open = false; this.emit('close'); }
  getClientRects() { return this.disabled ? [] : [{}]; }
  getBoundingClientRect() { return { left: 100, top: 100, right: 600, bottom: 700 }; }
  querySelectorAll() { return this.controls || []; }
  closest(selector) { return selector.includes(this.tagName.toLowerCase()) && this.tagName ? this : null; }
}
function harness({ saved = null, storageBlocked = false, failPreview = false, asyncHistory = false } = {}) {
  const document = { activeElement: null };
  const els = Object.fromEntries([...html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"/g)].map(([, tag, id]) => [id, new Element(id, tag.toUpperCase())]));
  document.getElementById = id => els[id] || null;
  document.createElement = tag => Object.assign(new Element('', tag.toUpperCase()), { ownerDocument: document });
  Object.values(els).forEach(element => { element.ownerDocument = document; });
  els['start-physics'].options = ['realistic', 'plaid', 'fantasy'].map(value => ({ value }));
  els['start-traffic'].options = ['0', '1', '2'].map(value => ({ value }));
  els['modal-map-select'].controls = ['btn-map-audio-settings', 'btn-map-modal-lang', 'btn-start-paint', 'card-map-highway', 'card-map-city', 'start-physics', 'start-traffic', 'btn-launch-selected-map'].map(id => els[id]);
  const window = new Element('window'); window.devicePixelRatio = 3;
  const writes = []; const storage = new Map(saved ? [['roadster-paint-finish', saved]] : []);
  const renders = []; const created = [];
  class Group { constructor() { this.children = []; } add(node) { this.children.push(node); } }
  class Camera {
    constructor(...args) { this.args = args; this.position = { set() {} }; }
    lookAt(...args) { this.target = args; }
    updateProjectionMatrix() { this.updated = true; }
  }
  class Light { constructor(color, intensity) { this.color = color; this.intensity = intensity; this.position = { set() {} }; } }
  class Renderer {
    constructor(options) { if (failPreview) throw Error('WebGL unavailable'); this.options = options; this.domElement = document.createElement('canvas'); created.push(this); }
    setPixelRatio(value) { this.pixelRatio = value; }
    setClearColor() {}
    setSize(width, height, updateStyle) { this.size = [width, height, updateStyle]; }
    render(scene, camera) { renders.push({ scene, camera, size: this.size }); }
    dispose() { this.disposed = true; }
  }
  const model = { cloneCount: 0, clone() { this.cloneCount++; return { visible: false, position: { set() {} }, rotation: { set() {} }, scale: { set() {} }, sharedPaint: bodyMaterial }; } };
  const bodyMaterial = { color: { setHex(value) { this.value = value; } } };
  const state = { physicsMode: 'realistic', insaneMode: false };
  let context;
  let entries = [{}]; let cursor = 0; const pendingHistory = [];
  const history = {
    get state() { return entries[cursor]; },
    pushState(next) { entries = entries.slice(0, cursor + 1); entries.push(next); cursor++; },
    back() { const go = () => { if (cursor) { cursor--; window.emit('popstate', { state: entries[cursor] }); } }; if (asyncHistory) pendingHistory.push(go); else go(); },
    forward() { if (cursor < entries.length - 1) { cursor++; window.emit('popstate', { state: entries[cursor] }); } },
    get length() { return entries.length; }, get cursor() { return cursor; }
  };
  const localStorage = {
    getItem(key) { if (storageBlocked) throw Error('storage denied'); return storage.get(key) ?? null; },
    setItem(key, value) { if (storageBlocked) throw Error('storage denied'); storage.set(key, value); writes.push({ key, value }); }
  };
  let clears = 0; let launched = 0; let traffic = null;
  context = vm.createContext({ Element, document, window, history, localStorage, state, currentLang: 'en', paintIndex: 0, weatherIndex: 0, trafficLevelIndex: 1, selectedMapInModal: 'highway', currentMap: 'highway', carMeshGroup: model, bodyMaterial, studioEnvMap: { texture: 'studio' },
    THREE: { MathUtils: { clamp: (x, lo, hi) => Math.min(hi, Math.max(lo, x)) }, Scene: Group, OrthographicCamera: Camera, AmbientLight: Light, DirectionalLight: Light, WebGLRenderer: Renderer, sRGBEncoding: 3001 },
    clearAllInputKeys() { clears++; }, launchSelectedMap() { launched++; },
    applyTranslations() { context.renderModalPaintGrid(); context.renderModalWeatherGrid(); window.RoadsterStart?.render(); },
    populateTraffic(count) { traffic = count; },
    showBanner() {},
    sound: { beep() {}, init() {}, speakAlert() {} },
    cardHighwayEl: els['card-map-highway'], cardCityEl: els['card-map-city'],
    keys: {},
  });
  // Reuse the actual palettes from production configuration.
  vm.runInContext(`${config.slice(config.indexOf('const PAINT_PRESETS ='), config.indexOf('\n];', config.indexOf('const PAINT_PRESETS =')) + 3)}\n${config.slice(config.indexOf('const WEATHER_PRESETS ='), config.indexOf('\n];', config.indexOf('const WEATHER_PRESETS =')) + 3)}`, context);
  vm.runInContext(['renderModalPaintGrid', 'renderModalWeatherGrid', 'selectPaintFinish', 'togglePlaidMode', 'togglePhysicsMode', 'highlightSelectedMapCard'].map(fn).join('\n'), context);
  vm.runInContext(moduleSource, context);
  const inputStart = ui.indexOf("window.addEventListener('keydown',");
  vm.runInContext(ui.slice(inputStart, ui.indexOf("window.addEventListener('keyup',", inputStart)), context);
  return { context, els, window, state, document, model, bodyMaterial, history, renders, created, writes, storage,
    flushHistory() { pendingHistory.shift()?.(); }, clears: () => clears, launched: () => launched, traffic: () => traffic,
    click: id => els[id].emit('click'),
    select(id, value) { els[id].value = value; els[id].emit('change'); },
    key(target, code, extra = {}) { return window.emit('keydown', { target, code, ...extra }); }
  };
}

test('compact entry shows the actual model once, with a stable shared paint material and capped pixel ratio', () => {
  const h = harness();
  assert.equal(h.model.cloneCount, 1); assert.equal(h.created.length, 1);
  assert.equal(h.created[0].pixelRatio, 2);
  assert.equal(h.created[0].domElement.parentNode, h.els['start-car-preview']);
  assert.equal(h.renders.at(-1).scene.children[0].sharedPaint, h.bodyMaterial);
  assert.equal(h.renders.at(-1).scene.environment, h.context.studioEnvMap);
  const before = h.renders.length;
  h.context.selectPaintFinish(4, false);
  assert.equal(h.bodyMaterial.color.value, 0x0284c7);
  assert.ok(h.renders.length > before); assert.equal(h.created.length, 1); assert.equal(h.model.cloneCount, 1);
  assert.equal(h.bodyMaterial.clearcoatRoughness, .16);
  h.els['modal-map-select'].classList.add('hidden');
  h.window.RoadsterStart.render();
  assert.equal(h.renders.length, before + 1, 'no preview render while driving');
});

test('all 12 finishes apply and restore by stable ID; blocked or stale storage is harmless', () => {
  const h = harness({ saved: 'mars-orange' });
  assert.equal(h.context.paintIndex, 8); assert.equal(h.bodyMaterial.color.value, 0xea580c);
  assert.equal(h.els['modal-paint-grid'].children.length, 12);
  for (const [idx, button] of h.els['modal-paint-grid'].children.entries()) {
    button.focus(); button.emit('click');
    assert.equal(h.context.paintIndex, idx);
    assert.equal(h.document.activeElement, button, 'paint refresh retains keyboard focus');
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    assert.equal(h.els['modal-paint-grid'].children.filter(b => b.getAttribute('aria-pressed') === 'true').length, 1);
  }
  assert.equal(h.storage.get('roadster-paint-finish'), 'sonic-yellow');
  assert.equal(harness({ saved: 'retired-paint' }).context.paintIndex, 0);
  assert.doesNotThrow(() => harness({ storageBlocked: true }));
  h.context.selectPaintFinish(Number.NaN, false); assert.equal(h.context.paintIndex, 0);
});

test('finish picker closes by Done/Escape/outside/Back, returns focus, and supports repeated open and Forward', () => {
  const h = harness();
  h.click('btn-start-paint');
  assert.equal(h.els['paint-picker'].open, true); assert.equal(h.history.cursor, 1);
  assert.equal(h.created[0].domElement.parentNode, h.els['paint-picker-preview']);
  assert.equal(h.els['btn-start-paint'].getAttribute('aria-expanded'), 'true');
  h.click('btn-start-paint'); assert.equal(h.history.length, 2, 'double-click does not stack entries');
  h.click('paint-picker-close');
  assert.equal(h.els['paint-picker'].open, false); assert.equal(h.history.cursor, 0);
  assert.equal(h.document.activeElement, h.els['btn-start-paint']);
  assert.equal(h.created[0].domElement.parentNode, h.els['start-car-preview']);
  h.history.forward(); assert.equal(h.els['paint-picker'].open, true);
  h.history.back(); assert.equal(h.els['paint-picker'].open, false);
  h.click('btn-start-paint'); h.els['paint-picker'].close(); // Native Escape/default cancel closes a dialog.
  assert.equal(h.history.cursor, 0);
  h.click('btn-start-paint');
  h.els['paint-picker'].emit('click', { clientX: 200, clientY: 200 }); assert.equal(h.els['paint-picker'].open, true, 'interior blank space stays open');
  h.els['paint-picker'].emit('click', { clientX: 10, clientY: 10 }); assert.equal(h.els['paint-picker'].open, false);
  assert.equal(h.els['btn-start-paint'].getAttribute('aria-expanded'), 'false');
});

test('menu and picker keyboard interactions never trigger gameplay or an accidental launch', () => {
  const h = harness();
  for (const id of ['btn-start-paint', 'card-map-city', 'btn-map-modal-lang']) {
    for (const code of ['Enter', 'Space', 'KeyW', 'KeyF']) h.key(h.els[id], code);
  }
  assert.equal(h.launched(), 0); assert.equal(h.state.physicsMode, 'realistic');
  h.key(h.els['modal-map-select'], 'Enter'); assert.equal(h.launched(), 1);
  h.click('btn-start-paint'); h.key(h.els['modal-paint-grid'].children[2], 'Enter'); assert.equal(h.launched(), 1);
  h.click('paint-picker-close');
  h.els['btn-launch-selected-map'].focus();
  const next = h.els['modal-map-select'].emit('keydown', { key: 'Tab' });
  assert.equal(next.prevented, true); assert.equal(h.document.activeElement, h.els['btn-map-audio-settings']);
  const prev = h.els['modal-map-select'].emit('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(prev.prevented, true); assert.equal(h.document.activeElement, h.els['btn-launch-selected-map']);
});

test('world/weather use keyboard-native pressed buttons, and mode/traffic selectors stay synchronized', () => {
  const h = harness();
  h.context.highlightSelectedMapCard('city');
  assert.equal(h.els['card-map-city'].getAttribute('aria-pressed'), 'true');
  assert.equal(h.els['card-map-highway'].getAttribute('aria-pressed'), 'false');
  assert.equal(h.els['modal-weather-grid'].children.length, 3);
  h.context.weatherIndex = 2;
  const weather = h.els['modal-weather-grid'].children[2]; weather.focus(); h.context.renderModalWeatherGrid();
  assert.equal(h.els['modal-weather-grid'].children[2], weather); assert.equal(h.document.activeElement, weather);
  assert.equal(weather.getAttribute('aria-pressed'), 'true');
  for (const [value, mode, plaid] of [['plaid', 'realistic', true], ['fantasy', 'fantasy', false], ['realistic', 'realistic', false]]) {
    h.select('start-physics', value); assert.equal(h.state.physicsMode, mode); assert.equal(h.state.insaneMode, plaid); assert.equal(h.els['start-physics'].value, value);
  }
  h.select('start-traffic', '2'); assert.equal(h.context.trafficLevelIndex, 2); assert.equal(h.traffic(), 52);
  h.context.currentLang = 'zh'; h.window.RoadsterStart.render();
  assert.equal(h.els['ui-btn-launch-map'].textContent, '进入游戏');
  assert.equal(h.els['start-physics'].options[0].textContent, '常规物理');
  assert.match(h.els['btn-start-paint'].getAttribute('aria-label'), /更换涂装/);
});

test('optional preview failure cannot block configuration, and initial paint collection is in a separate native dialog', () => {
  const h = harness({ failPreview: true });
  assert.match(h.els['start-car-preview'].textContent, /unavailable/);
  h.click('btn-start-paint'); assert.equal(h.els['paint-picker'].open, true);
  h.els['modal-paint-grid'].children[6].emit('click'); assert.equal(h.context.paintIndex, 6);
  assert.match(html, /<dialog id="paint-picker"[^>]*aria-labelledby="ui-modal-paint-title"/);
  const menuHtml = html.slice(html.indexOf('<div id="modal-map-select"'), html.indexOf('<dialog id="paint-picker"'));
  assert.doesNotMatch(menuHtml, /id="modal-paint-grid"/);
  for (const id of ['btn-start-paint', 'card-map-highway', 'card-map-city', 'start-physics', 'start-traffic', 'btn-launch-selected-map']) assert.match(menuHtml, new RegExp(`id="${id}"`));
  assert.match(css, /\.start-main \{[^}]*min-height: 0;[^}]*overflow-y: auto/s);
  assert.match(css, /\.start-footer \{ flex-shrink: 0;/);
  assert.match(css, /@media \(max-width: 650px\)/);
  assert.match(css, /\.start-drive-options select \{[^}]*min-height: 44px/s);
  assert.doesNotMatch(moduleSource, /requestAnimationFrame|setInterval/);
});


test('an immediate reopen waits for asynchronous Back rather than closing the newer picker', () => {
  const h = harness({ asyncHistory: true });
  h.click('btn-start-paint'); h.click('paint-picker-close');
  assert.equal(h.els['paint-picker'].open, false); assert.equal(h.history.cursor, 1);
  h.click('btn-start-paint'); h.click('btn-start-paint');
  assert.equal(h.history.length, 2); assert.equal(h.els['paint-picker'].open, false);
  h.flushHistory();
  assert.equal(h.els['paint-picker'].open, true); assert.equal(h.history.length, 2); assert.equal(h.history.cursor, 1);
  h.click('paint-picker-close'); h.flushHistory();
  assert.equal(h.els['paint-picker'].open, false); assert.equal(h.history.cursor, 0);
});
