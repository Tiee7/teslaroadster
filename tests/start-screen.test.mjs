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
function harness({ saved = null, storageBlocked = false, failPreview = false, asyncHistory = false, withVehicle = false, initialModel = 'reference', initialCockpit = 'reference' } = {}) {
  const document = { activeElement: null };
  const els = Object.fromEntries([...html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"/g)].map(([, tag, id]) => [id, new Element(id, tag.toUpperCase())]));
  document.getElementById = id => els[id] || null;
  document.createElement = tag => Object.assign(new Element('', tag.toUpperCase()), { ownerDocument: document });
  Object.values(els).forEach(element => { element.ownerDocument = document; });
  els['start-physics'].options = ['realistic', 'plaid', 'fantasy'].map(value => ({ value }));
  els['start-traffic'].options = ['0', '1', '2'].map(value => ({ value }));
  els['start-model'].options = ['reference', 'classic'].map(value => ({ value }));
  els['start-cockpit'].options = ['reference', 'classic'].map(value => ({ value }));
  els['modal-map-select'].controls = ['btn-map-audio-settings', 'btn-map-modal-lang', 'btn-start-paint', 'start-model', 'start-cockpit', 'card-map-highway', 'card-map-city', 'card-map-coast', 'start-physics', 'start-traffic', 'btn-launch-selected-map'].map(id => els[id]);
  const window = new Element('window'); window.devicePixelRatio = 3;
  const writes = []; const storage = new Map(saved ? [['roadster-paint-finish', saved]] : []);
  const renders = []; const created = [];
  class Group { constructor() { this.children = []; } add(node) { this.children.push(node); } remove(node) { this.children = this.children.filter(child => child !== node); } }
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
    render(scene, camera) { if (this.failRender) throw Error('context lost'); renders.push({ scene, camera, size: this.size }); }
    dispose() { this.disposed = true; }
  }
  const vehicleState = { model: initialModel, cockpit: initialCockpit };
  const vehicleCalls = [];
  const sharedGeometry = { dispose() { assert.fail('the preview must never dispose shared geometry'); } };
  const makeSource = () => ({ cloneCount: 0, clone(deep) {
    assert.equal(deep, true);
    this.cloneCount++;
    return { visible: false, position: { set() {} }, rotation: { set() {} }, scale: { set() {} }, sharedPaint: bodyMaterial,
      geometry: sharedGeometry, modelId: vehicleState.model, cockpitId: vehicleState.cockpit };
  } });
  const model = makeSource();
  let previewSource = model;
  if (withVehicle) window.RoadsterVehicle = {
    getModel: () => vehicleState.model,
    getCockpit: () => vehicleState.cockpit,
    setModel(id) { vehicleCalls.push(['model', id]); vehicleState.model = id; window.emit('roadster-vehicle-change'); },
    setCockpit(id) { vehicleCalls.push(['cockpit', id]); vehicleState.cockpit = id; window.emit('roadster-vehicle-change'); },
    getPreviewModel: () => previewSource
  };
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
  return { context, els, window, state, document, model, bodyMaterial, history, renders, created, writes, storage, vehicleState, vehicleCalls, sharedGeometry,
    replacePreviewSource() { previewSource = makeSource(); window.emit('roadster-vehicle-change'); return previewSource; },
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
  for (const id of ['btn-start-paint', 'start-model', 'start-cockpit', 'card-map-city', 'btn-map-modal-lang']) {
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

test('third original coast card is keyboard-native and uses its actual bilingual traffic densities',()=>{
 const h=harness();h.context.highlightSelectedMapCard('coast');
 assert.equal(h.els['card-map-coast'].tagName,'BUTTON');assert.equal(h.els['card-map-coast'].getAttribute('aria-pressed'),'true');
 for(const id of ['highway','city'])assert.equal(h.els[`card-map-${id}`].getAttribute('aria-pressed'),'false');
 assert.equal(h.els['summary-map-chip'].textContent,'Original Coastal District');
 assert.deepEqual(h.els['start-traffic'].options.map(x=>x.textContent),['Normal · 12','Heavy · 16','Busy · 20']);
 h.key(h.els['card-map-coast'],'Enter');h.key(h.els['card-map-coast'],'Space');assert.equal(h.launched(),0);
 h.context.currentMap='coast';h.select('start-traffic','2');assert.equal(h.traffic(),20);
 h.context.currentLang='zh';h.context.highlightSelectedMapCard('coast');
 assert.equal(h.els['card-coast-title'].textContent,'海滨街区');assert.equal(h.els['card-coast-spec'].textContent,'沙滩 · 码头 · 原创');
 assert.deepEqual(h.els['start-traffic'].options.map(x=>x.textContent),['普通 · 12 辆','密集 · 16 辆','繁忙 · 20 辆']);
 h.context.currentMap='city';h.context.highlightSelectedMapCard('city');h.select('start-traffic','0');assert.equal(h.traffic(),20);
 assert.match(h.els['start-traffic'].options[2].textContent,/52/);
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


test('independent entry choices use the vehicle API and refresh one shared-resource model without new renderers', () => {
  const h = harness({ withVehicle: true });
  const scene = h.renders.at(-1).scene;
  const currentModel = () => scene.children.find(child => child.sharedPaint);
  assert.equal(h.els['start-model'].value, 'reference');
  assert.equal(h.els['start-cockpit'].value, 'reference');
  assert.equal(currentModel().modelId, 'reference');
  assert.equal(currentModel().cockpitId, 'reference');
  const originalClone = currentModel();
  h.els['start-model'].focus();
  h.select('start-model', 'classic');
  assert.deepEqual(h.vehicleCalls, [['model', 'classic']]);
  assert.equal(h.vehicleState.cockpit, 'reference', 'exterior selection leaves cockpit alone');
  assert.equal(h.document.activeElement, h.els['start-model']);
  assert.equal(currentModel().modelId, 'classic');
  assert.equal(currentModel().cockpitId, 'reference');
  assert.notEqual(currentModel(), originalClone);
  assert.equal(scene.children.includes(originalClone), false, 'old preview is detached');
  assert.equal(h.created.length, 1);
  assert.equal(h.model.cloneCount, 2, 'synchronous API event and direct UI refresh share one clone');
  h.select('start-cockpit', 'classic');
  assert.deepEqual(h.vehicleCalls, [['model', 'classic'], ['cockpit', 'classic']]);
  assert.equal(h.vehicleState.model, 'classic', 'cockpit selection leaves exterior alone');
  assert.equal(currentModel().cockpitId, 'classic');
  assert.equal(scene.children.length, 4, 'model replacement never accumulates duplicate models or lights');
  assert.equal(currentModel().sharedPaint, h.bodyMaterial);
  assert.equal(currentModel().geometry, h.sharedGeometry);
  assert.equal(h.created[0].disposed, undefined);
  h.window.RoadsterStart.render(); h.window.emit('resize');
  assert.equal(h.model.cloneCount, 3, 'ordinary refresh and resize reuse the current clone');
  assert.equal(h.writes.some(write => /model|cockpit/.test(write.key)), false, 'vehicle persistence belongs to its module');
});

test('saved mixed choices, external changes, translated copy, and source replacement stay synchronized', () => {
  const h = harness({ withVehicle: true, initialModel: 'classic', initialCockpit: 'reference' });
  assert.equal(h.els['start-model'].value, 'classic');
  assert.equal(h.els['start-cockpit'].value, 'reference');
  assert.equal(h.vehicleCalls.length, 0, 'entry must not overwrite restored choices');
  h.context.currentLang = 'zh'; h.window.RoadsterStart.render();
  assert.equal(h.els['start-model-label'].textContent, '车身车型');
  assert.equal(h.els['start-cockpit-label'].textContent, '驾驶舱');
  assert.equal(h.els['start-model'].options[1].textContent, '经典 Roadster');
  assert.equal(h.els['start-cockpit'].options[0].textContent, '参考驾驶舱');
  assert.equal(h.els['summary-model-chip'].textContent, '经典 Roadster');
  assert.equal(h.els['start-vehicle-options'].getAttribute('aria-label'), '车辆配置');
  h.window.RoadsterVehicle.setCockpit('classic');
  assert.equal(h.els['start-cockpit'].value, 'classic');
  assert.equal(h.els['summary-cockpit-chip'].textContent, '经典驾驶舱');
  const previousModel = h.renders.at(-1).scene.children.find(child => child.sharedPaint);
  const newSource = h.replacePreviewSource();
  assert.equal(newSource.cloneCount, 1, 'updated live source is cloned even when choice IDs are unchanged');
  assert.equal(h.renders.at(-1).scene.children.includes(previousModel), false);
  assert.equal(h.created.length, 1);
  h.select('start-model', 'invalid'); h.select('start-cockpit', 'invalid');
  assert.equal(h.els['start-model'].value, 'classic');
  assert.equal(h.els['start-cockpit'].value, 'classic');
  assert.equal(h.vehicleCalls.length, 1, 'unrecognized values never reach the vehicle API');
});

test('choice changes move the same live-configured preview between entry and paint dialog, and defer hidden work', () => {
  const h = harness({ withVehicle: true });
  h.click('btn-start-paint');
  h.window.RoadsterVehicle.setModel('classic');
  assert.equal(h.created[0].domElement.parentNode, h.els['paint-picker-preview']);
  assert.equal(h.renders.at(-1).scene.children.find(child => child.sharedPaint).modelId, 'classic');
  h.click('paint-picker-close');
  assert.equal(h.created[0].domElement.parentNode, h.els['start-car-preview']);
  h.els['modal-map-select'].classList.add('hidden');
  const before = h.renders.length; const clones = h.model.cloneCount;
  h.window.RoadsterVehicle.setCockpit('classic');
  assert.equal(h.renders.length, before);
  assert.equal(h.model.cloneCount, clones, 'hidden entry does not allocate model clones');
  h.els['modal-map-select'].classList.remove('hidden'); h.window.RoadsterStart.onOpen();
  assert.equal(h.model.cloneCount, clones + 1);
  assert.equal(h.renders.at(-1).scene.children.find(child => child.sharedPaint).cockpitId, 'classic');
  assert.equal(h.created.length, 1);
});

test('vehicle selectors remain usable without the optional module or WebGL and expose explicit production defaults', () => {
  const fallback = harness();
  assert.doesNotThrow(() => { fallback.select('start-model', 'classic'); fallback.select('start-cockpit', 'classic'); });
  assert.equal(fallback.els['start-model'].value, 'classic');
  assert.equal(fallback.els['start-cockpit'].value, 'classic');
  const h = harness({ withVehicle: true, failPreview: true });
  h.select('start-model', 'classic'); h.select('start-cockpit', 'classic');
  assert.equal(h.vehicleState.model, 'classic'); assert.equal(h.vehicleState.cockpit, 'classic');
  h.context.currentLang = 'zh'; h.window.RoadsterStart.render(); h.click('btn-start-paint');
  assert.equal(h.els['start-car-preview'].textContent, '3D 预览暂不可用');
  assert.equal(h.els['paint-picker-preview'].textContent, '3D 预览暂不可用');
  for (const id of ['start-model', 'start-cockpit']) {
    assert.match(html, new RegExp('<label for="' + id + '">'));
    assert.match(html, new RegExp('<select id="' + id + '"><option value="reference" selected>'));
  }
  assert.match(css, /\.start-vehicle-options select \{[^}]*min-height: 44px/s);
  assert.match(css, /@media \(max-width: 370px\)[\s\S]*\.start-vehicle-options \{ grid-template-columns: minmax\(0, 1fr\)/);
});

test('a lost preview context is released once while configuration and launch remain available', () => {
  const h = harness({ withVehicle: true });
  h.created[0].failRender = true;
  h.select('start-model', 'classic');
  assert.equal(h.created[0].disposed, true);
  h.select('start-cockpit', 'classic'); h.window.emit('resize'); h.window.RoadsterStart.render();
  assert.equal(h.created.length, 1, 'a failed optional preview never spins up replacement WebGL contexts');
  assert.equal(h.vehicleState.cockpit, 'classic');
  assert.match(h.els['start-car-preview'].textContent, /unavailable/);
  h.key(h.els['modal-map-select'], 'Enter'); assert.equal(h.launched(), 1);
});
