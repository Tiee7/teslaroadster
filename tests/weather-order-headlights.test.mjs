import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const config = read('src/config.js'), ui = read('src/ui-hud.js');
const runtime = process.env.ROADSTER_THREE_RUNTIME || '/tmp/roadster-three.min.js';
const section = (from, to) => { const a = ui.indexOf(from), b = ui.indexOf(to, a + from.length); assert.ok(a >= 0 && b > a); return ui.slice(a, b); };
function fn(name) { const a = ui.indexOf(`function ${name}(`); assert.ok(a >= 0, name); return ui.slice(a, ui.indexOf('\n}', a) + 2); }
class Element {
  constructor() { this.children = []; this.listeners = {}; this.attrs = {}; this.style = {}; this.classList = { add() {}, remove() {}, contains: () => true, toggle() {} }; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  appendChild(child) { this.children.push(child); }
  setAttribute(name, value) { this.attrs[name] = String(value); }
}
function harness({ native = false } = {}) {
  const elements = new Map(), byId = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const events = new Map(), window = { innerWidth: 1280, innerHeight: 800, addEventListener(type, listener) { (events.get(type) || (events.set(type, []), events.get(type))).push(listener); }, dispatchEvent(event) { for (const fn of events.get(event.type) || []) fn(event); } };
  const context = vm.createContext({ console, window, document: { getElementById: byId, createElement: () => Object.assign(new Element(), { getContext: () => ({}) }) }, Event: class { constructor(type) { this.type = type; } },
    localStorage: { getItem: () => null, setItem() {} }, sound: { beep() {}, init() {} }, clearAllInputKeys() {}, clearDebris() {}, renderBannerText() {}, populateTraffic() {}, applyRoadWeather() {}, applyTranslations() {},
    THREE: { MathUtils: { clamp: (n, lo, hi) => Math.max(lo, Math.min(hi, n)) } } });
  if (native) vm.runInContext(readFileSync(runtime, 'utf8'), context);
  vm.runInContext(read('src/driving-score.js') + '\n' + config, context);
  if (native) {
    vm.runInContext(`const scene=new THREE.Scene();scene.fog=new THREE.FogExp2();` + ['whiteLeatherMat', 'cockpitMat', 'bodyMaterial', 'goldCanopyMaterial', 'carbonMaterial', 'titaniumMaterial'].map(name => `const ${name}=new THREE.MeshStandardMaterial();`).join(''), context);
    for (const name of ['highway-traffic', 'vehicles', 'reference-exterior', 'reference-cockpit']) vm.runInContext(read('src/' + name + '.js'), context);
    // HUD canvas work is outside this CPU lighting/lifecycle test.
    vm.runInContext('updateCockpitHudScreen=()=>{};', context);
  } else vm.runInContext(`const scene={background:{isColor:true,setHex(){}},fog:{color:{setHex(){}},density:0}},carMeshGroup={};`, context);
  vm.runInContext(`const light=()=>({color:{setHex(value){this.value=value;}},position:{set(){}},intensity:1,visible:true});
    ${native ? '' : 'const headlightSpotL=light(),headlightSpotR=light();'}
    const ambientLight=light(),dirLight=light(),rimLight=light(),studioEnvMap={},marsSunsetEnvMap={},roadMat={},cityAsphaltMat={},cityAsphaltEWMat={},rainLinesMesh={},marsSunGroup={},cityEnvGroup={userData:{}},highwayEnvGroup={};
    ${section('function selectWeatherMode(', 'function cycleWeatherMode(')}
    ${fn('cycleWeatherMode')}\n${fn('renderModalWeatherGrid')}\n${fn('resetCar')}\n${fn('switchMap')}
    globalThis.api={state,window,presets:WEATHER_PRESETS,i18n:I18N,index:()=>weatherIndex,lang:value=>{currentLang=value;},select:selectWeatherMode,cycle:cycleWeatherMode,render:renderModalWeatherGrid,reset:resetCar,map:switchMap,
      lights:()=>[headlightSpotL,headlightSpotR],root:()=>carMeshGroup,model:value=>window.RoadsterVehicle?.setModel(value),source:()=>window.RoadsterVehicle?.getPreviewModel()};`, context);
  context.window.RoadsterCoast = { enter() {}, leave() {}, weather() {}, respawn: () => ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, speed: 0, vx: 0, vy: 0, vz: 0, supportId: null }), recoverTraffic() {} };
  context.trafficCars = [];
  return { context, ...context.api, elements, byId };
}
test('visible weather order is day/dusk/night/rain while default and legacy physical indices remain night0/rain1/dusk2/day3', () => {
  const h = harness(); assert.equal(h.index(), 0);
  assert.deepEqual(Array.from(h.presets, x => x.id), ['cyber-night', 'neon-rain', 'mars-sunset', 'clear-day']);
  assert.deepEqual(Array.from(h.presets, x => x.menuOrder), [2, 3, 1, 0]);
  assert.deepEqual(Array.from(h.i18n.zh.weathers), ['黑夜', '雨夜', '黄昏', '白天']);
  assert.equal(h.presets[1].rain, true); assert.equal(h.presets[3].daylight, true);
  h.lang('zh'); h.render(); const buttons = h.byId('modal-weather-grid').children;
  assert.deepEqual(buttons.map(x => x.attrs['aria-label']), ['白天', '黄昏', '黑夜', '雨夜']);
  assert.deepEqual(buttons.map(x => x.attrs['aria-pressed']), ['false', 'false', 'true', 'false']);
  const cycle = []; for (let n = 0; n < 8; n++) { h.cycle(); cycle.push(h.index()); }
  assert.deepEqual(cycle, [1, 3, 2, 0, 1, 3, 2, 0]);
});
test('translated weather buttons keep stable instances, correct underlying selection across repeated renders', () => {
  const h = harness(); h.lang('zh'); h.render(); const buttons = h.byId('modal-weather-grid').children.slice();
  for (const [position, idx] of [[0, 3], [1, 2], [2, 0], [3, 1], [0, 3]]) { buttons[position].listeners.click(); assert.equal(h.index(), idx); assert.equal(buttons[position].attrs['aria-pressed'], 'true'); }
  h.lang('en'); h.render(); assert.deepEqual(h.byId('modal-weather-grid').children, buttons);
  assert.deepEqual(buttons.map(x => x.attrs['aria-label']), ['Day', 'Dusk', 'Night', 'Rainy Night']);
  assert.match(h.byId('summary-weather-chip').textContent, /Day$/);
});
test('day disables actual light visibility and energy across reset/map/menu policy without changing night/rain/dusk intensity', () => {
  const h = harness(); const check = (intensity, visible) => { for (const light of h.lights()) { assert.equal(light.intensity, intensity); assert.equal(light.visible, visible); } };
  h.select(3, false); check(0, false); h.reset(); check(0, false);
  for (const map of ['city', 'coast', 'highway', 'city']) { h.map(map); check(0, false); h.reset(); check(0, false); }
  h.select(0, false); check(2.4, true); h.reset(); check(2.4, true);
  h.select(1, false); check(2.8, true); h.reset(); check(2.8, true);
  h.select(2, false); check(2, true); h.select(3, false); check(0, false);
  h.state.isDestroyed = true; h.select(0, false); check(0, false); h.reset(); check(2.4, true);
});
function meshSignature(root) {
  const hash = createHash('sha256'), geometries = new Set(), materials = new Set();
  const materialValue = value => value?.isColor ? value.toArray() : value?.isTexture
    ? { uuid: value.uuid, version: value.version } : typeof value?.toArray === 'function' ? value.toArray() : value;
  root.traverse(part => {
    if (!part.isMesh) return;
    hash.update(JSON.stringify({ name: part.name, position: part.position, quaternion: part.quaternion, scale: part.scale, visible: part.visible }));
    if (!geometries.has(part.geometry)) {
      geometries.add(part.geometry);
      hash.update(JSON.stringify({ uuid: part.geometry.uuid, groups: part.geometry.groups, drawRange: part.geometry.drawRange }));
      for (const [name, attribute] of [...Object.entries(part.geometry.attributes), ['index', part.geometry.index]].filter(([, a]) => a)) {
        hash.update(JSON.stringify({ name, itemSize: attribute.itemSize, normalized: attribute.normalized, count: attribute.count }));
        hash.update(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
      }
    }
    for (const material of (Array.isArray(part.material) ? part.material : [part.material])) {
      if (materials.has(material)) continue;
      materials.add(material);
      // Do not serialize canvas images; retain texture identity/version and all
      // material scalar, color and vector properties without mutating them.
      const properties = Object.entries(material).filter(([, value]) => value === null ||
        ['string', 'number', 'boolean'].includes(typeof value) || value?.isColor || value?.isTexture || typeof value?.toArray === 'function');
      hash.update(JSON.stringify(Object.fromEntries(properties.map(([key, value]) => [key, materialValue(value)]))));
    }
  });
  return hash.digest('hex');
}
test('native reference/classic player and neutral menu clones switch only their two actual SpotLights, not mesh/material/geometry/scale', { skip: !existsSync(runtime) && 'native Three r128 required' }, () => {
  const h = harness({ native: true });
  for (const model of ['reference', 'classic']) {
    h.model(model); const root = h.root(), before = meshSignature(root), preview = h.source().clone(true), previewBefore = meshSignature(preview), cloneLights = [];
    preview.traverse(part => { if (part.isSpotLight) cloneLights.push(part); }); assert.equal(cloneLights.length, 2);
    for (const idx of [3, 0, 3, 1, 2, 3]) {
      h.select(idx, false); h.window.RoadsterWeatherLights.applyTo(preview);
      for (const light of [...h.lights(), ...cloneLights]) { assert.equal(light.intensity, idx === 3 ? 0 : idx === 1 ? 2.8 : idx === 2 ? 2 : 2.4); assert.equal(light.visible, idx !== 3); }
      assert.equal(meshSignature(root), before); assert.equal(meshSignature(preview), previewBefore);
    }
    h.reset(); assert.equal(h.lights().every(light => light.intensity === 0 && !light.visible), true);
  }
});
