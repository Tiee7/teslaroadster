import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/taxi.js', import.meta.url), 'utf8');
const config = readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
const roadCoords = JSON.parse(config.match(/const CITY_ROAD_COORDS = (\[[^;]+\]);/)[1]);
const origin = { x: 5.5, y: 0, z: 0 };
function model() {
  const context = vm.createContext({});
  vm.runInContext(source.split('// Scene adapter:')[0], context);
  return vm.runInContext('CityTaxiModel', context);
}
const core = model();
const graph = core.buildRoadGraph(roadCoords);
const random = (seed = 1) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const makeSession = (seed = 1) => core.createSession(graph, random(seed));
const at = (session, point) => { session.pause(point); return session.advance(point); };

test('all stops and shortest-route segments stay on the connected city asphalt grid', () => {
  assert.equal(graph.nodes.length, 49);
  const halfWidth = Number(config.match(/const CITY_ROAD_WIDTH = ([\d.]+);/)[1]) / 2;
  const halfBound = Number(config.match(/const CITY_HALF_BOUND = ([\d.]+);/)[1]);
  for (const from of graph.nodes) {
    assert.ok(Math.abs(from.x) < halfBound && Math.abs(from.z) < halfBound);
    assert.ok(roadCoords.some(c => Math.abs(from.x - c) < halfWidth));
    assert.ok(roadCoords.some(c => Math.abs(from.z - c) < halfWidth));
    for (const to of graph.nodes) {
      const route = core.shortestRoute(graph, from.id, to.id);
      assert.equal(route.meters, Math.abs(from.x - to.x) + Math.abs(from.z - to.z));
      assert.equal(route.path[0].id, from.id); assert.equal(route.path.at(-1).id, to.id);
      let sum = 0;
      for (let i = 1; i < route.path.length; i++) {
        const a = route.path[i - 1], b = route.path[i];
        assert.ok(a.x === b.x || a.z === b.z);
        assert.ok(graph.edges[a.id].some(edge => edge.id === b.id));
        assert.ok((a.x === b.x && roadCoords.some(c => Math.abs(a.x - c) < halfWidth)) ||
          (a.z === b.z && roadCoords.some(c => Math.abs(a.z - c) < halfWidth)));
        sum += Math.hypot(a.x - b.x, a.z - b.z);
      }
      assert.equal(sum, route.meters);
    }
  }
  assert.equal(core.shortestRoute(graph, -1, 1), null);
});

test('pickup stops and every drivable route edge clear the actual generated city building collision boxes', () => {
  const world = readFileSync(new URL('../src/world.js', import.meta.url), 'utf8');
  const generation = world.slice(world.indexOf('  const blockCenters = '), world.indexOf('  // High-Altitude Glass Pedestrian Skybridges'));
  const boundsContext = vm.createContext({
    cityEnvGroup: new Object3D(), cityBuildings: [], bldgMats: [{}, {}, {}], neonTrimMats: [{}, {}, {}],
    windowLitMat: {}, windowWarmMat: {}, titaniumMaterial: {}, helipadRingMat: {}, helipadMarkMat: {},
    THREE: { Mesh, BoxGeometry: Geometry, CylinderGeometry: Geometry, SphereGeometry: Geometry,
      PlaneGeometry: Geometry, RingGeometry: Geometry, MeshBasicMaterial: Material },
  });
  vm.runInContext(generation, boundsContext);
  assert.equal(boundsContext.cityBuildings.length, 128);
  const actualGraph = core.buildRoadGraph(roadCoords, 11.5, boundsContext.cityBuildings, 1200);
  assert.equal(actualGraph.nodes.length, 49);
  for (const node of actualGraph.nodes) {
    assert.equal(core.isStopClear(node, boundsContext.cityBuildings, 1200), true);
    assert.ok(Math.abs(node.x) + core.STOP_CLEARANCE < 1200 && Math.abs(node.z) + core.STOP_CLEARANCE < 1200);
    for (const building of boundsContext.cityBuildings) {
      assert.ok(node.x < building.minX - 1.1 || node.x > building.maxX + 1.1 ||
        node.z < building.minZ - 1.8 || node.z > building.maxZ + 1.8, 'stop must clear the real car collision box');
      for (const edge of graph.edges[node.id]) {
        const next = graph.nodes[edge.id];
        const minX = Math.min(node.x, next.x), maxX = Math.max(node.x, next.x);
        const minZ = Math.min(node.z, next.z), maxZ = Math.max(node.z, next.z);
        assert.ok(maxX < building.minX - 1.1 || minX > building.maxX + 1.1 ||
          maxZ < building.minZ - 1.8 || minZ > building.maxZ + 1.8, 'route must not cross a building collision box');
      }
    }
  }
});

test('five distinct spaced waiting passengers have long reachable trips on every refill', () => {
  const session = makeSession(20);
  assert.equal(session.start(origin), true);
  for (let round = 0; round < 120; round++) {
    const data = session.snapshot();
    assert.equal(data.waiting.length, 5);
    assert.equal(new Set(data.waiting.map(trip => trip.pickup.id)).size, 5);
    for (const trip of data.waiting) {
      assert.ok(trip.routeMeters >= 900 && trip.routeMeters <= 3600);
      assert.ok(Math.hypot(trip.pickup.x - trip.destination.x, trip.pickup.z - trip.destination.z) >= 900);
      assert.equal(trip.fare, core.fareForDistance(core.shortestRoute(graph, trip.pickup.id, trip.destination.id).meters));
      for (const other of data.waiting) if (trip.id !== other.id) {
        assert.ok(core.shortestRoute(graph, trip.pickup.id, other.pickup.id).meters >= 600);
      }
    }
    const trip = data.waiting[round % 5];
    assert.equal(at(session, trip.pickup).type, 'picked-up');
    assert.equal(at(session, trip.destination).type, 'delivered');
  }
  assert.equal(session.snapshot().delivered, 120);
});

test('arrival is exactly 2m in 3D, including swept ground motion and excluding overhead flight', () => {
  const stop = { x: 0, y: 0, z: 0 };
  for (const p of [{ x: 2, y: 0, z: 0 }, { x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: -2 }]) assert.equal(core.withinArrival(p, p, stop), true);
  for (const p of [{ x: 2.001, y: 0, z: 0 }, { x: 0, y: 2.001, z: 0 }, { x: 1.5, y: 1.5, z: 0 }]) assert.equal(core.withinArrival(p, p, stop), false);
  assert.equal(core.withinArrival({ x: -10, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, stop), true);
  assert.equal(core.withinArrival({ x: -10, y: 3, z: 0 }, { x: 10, y: 3, z: 0 }, stop), false);
  assert.equal(core.withinArrival({ x: 0, y: 100, z: 0 }, { x: 0, y: 3, z: 0 }, stop), false);
  assert.equal(core.withinArrival(null, stop, stop), false);
});

test('single-passenger state machine pays once, refills five and ignores other pickup points while occupied', () => {
  const session = makeSession(); session.start(origin);
  const [trip, other] = session.snapshot().waiting;
  assert.equal(at(session, { ...trip.pickup, y: 2.01 }), null);
  assert.equal(at(session, { ...trip.pickup, x: trip.pickup.x + 2.01 }), null);
  assert.equal(at(session, { ...trip.pickup, x: trip.pickup.x + 2 }).type, 'picked-up');
  assert.equal(session.snapshot().waiting.length, 4);
  assert.equal(at(session, other.pickup), null);
  assert.equal(session.snapshot().passenger.id, trip.id);
  assert.equal(session.snapshot().score, 0);
  assert.equal(at(session, { ...trip.destination, y: 2.01 }), null);
  assert.equal(at(session, trip.destination).type, 'delivered');
  assert.equal(session.snapshot().passenger, null);
  assert.equal(session.snapshot().waiting.length, 5);
  assert.equal(session.snapshot().score, trip.fare);
  assert.equal(session.snapshot().delivered, 1);
  for (let i = 0; i < 5; i++) assert.equal(session.advance(trip.destination), null);
  assert.equal(session.snapshot().score, trip.fare);
});

test('distance-based fares are integral, monotonic and bounded at 1000–3000', () => {
  assert.equal(core.fareForDistance(900), 1000);
  assert.equal(core.fareForDistance(3600), 3000);
  assert.equal(core.fareForDistance(0), 1000);
  assert.equal(core.fareForDistance(10000), 3000);
  let prior = 0;
  for (let meters = 900; meters <= 3600; meters += 300) {
    const fare = core.fareForDistance(meters);
    assert.ok(Number.isInteger(fare) && fare >= 1000 && fare <= 3000 && fare >= prior);
    prior = fare;
  }
});

test('repeated starts do not duplicate passengers; occupied repairs apply double fare and retain delivered count', () => {
  const session = makeSession(); session.start(origin);
  const ids = session.snapshot().waiting.map(trip => trip.id).join(',');
  assert.equal(session.start(origin), false);
  assert.equal(session.snapshot().waiting.map(trip => trip.id).join(','), ids);
  const trip = session.snapshot().waiting[0]; at(session, trip.pickup); at(session, trip.destination);
  const unpaid = session.snapshot().waiting[0]; at(session, unpaid.pickup);
  const loss = session.reset(unpaid.destination);
  assert.equal(loss.type, 'passenger-lost'); assert.equal(loss.reason, 'reset');
  assert.equal(loss.penalty, unpaid.fare * 2);
  assert.equal(session.snapshot().passenger, null); assert.equal(session.snapshot().waiting.length, 5);
  assert.equal(session.snapshot().score, Math.max(0, trip.fare - unpaid.fare * 2)); assert.equal(session.snapshot().delivered, 1);
  assert.equal(session.advance(unpaid.destination), null);
  session.stop();
  assert.equal(session.snapshot().active, false); assert.equal(session.snapshot().waiting.length, 0);
  assert.equal(session.snapshot().score, 0); assert.equal(session.snapshot().delivered, 0);
  assert.equal(session.advance(trip.pickup), null);
  assert.equal(session.start(origin), true); assert.equal(session.snapshot().score, 0);
});

class Element {
  constructor() {
    this.children = []; this.attributes = {}; this.textContent = ''; this.parent = null; this.typing = false;
    this.style = {}; this.dataset = {}; this.hidden = false;
    this.classes = new Set(['hidden']);
    this.classList = { contains: x => this.classes.has(x), add: x => this.classes.add(x), remove: x => this.classes.delete(x),
      toggle: (name, force = !this.classes.has(name)) => { if (force) this.classes.add(name); else this.classes.delete(name); return force; } };
  }
  closest() { return this.typing ? this : null; }
  setAttribute(key, value) { this.attributes[key] = value; }
  appendChild(child) { child.remove(); child.parent = this; this.children.push(child); return child; }
  insertBefore(child, reference) { child.remove(); child.parent = this; this.children.splice(this.children.indexOf(reference), 0, child); return child; }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
}
class Object3D {
  constructor() {
    this.children = []; this.visible = true; this.rotation = {};
    this.position = { x: 0, y: 0, z: 0, set(x, y, z) { Object.assign(this, { x, y, z }); } };
  }
  add(...children) { this.children.push(...children); }
  remove(child) { this.children = this.children.filter(value => value !== child); }
}
class Geometry { rotateX() { return this; } constructor(...args) { this.args = args; this.disposed = false; } dispose() { this.disposed = true; } }
class Material { constructor(options) { Object.assign(this, options); this.disposed = false; } dispose() { this.disposed = true; } }
class Mesh extends Object3D { constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; } }
function harness() {
  const elements = Object.fromEntries(['modal-map-select', 'modal-help', 'modal-destroyed', 'hud-footer', 'hud-top-container', 'hud-main'].map(id => [id, new Element()]));
  elements['hud-top-container'].appendChild(elements['hud-main']);
  const document = { hidden: false, body: new Element(), getElementById: id => elements[id] || null, createElement: () => new Element() };
  const group = new Object3D(); const confirms = []; const aborts = []; let approved = true;
  const window = {
    confirm(message) { confirms.push(message); return approved; },
    RoadsterRanked: { abort: reason => aborts.push(reason), isDialogOpen: () => false },
    RoadsterMusic: { isSettingsOpen: () => false },
  };
  const state = { ...origin, yaw: 0, isDestroyed: false, score: 123, carsCleared: 10 };
  const context = vm.createContext({ window, document, Element, state, currentLang: 'en', currentMap: 'city', lastTime: 1,
    Math: Object.assign(Object.create(Math), { random: random(1) }),
    CITY_ROAD_COORDS: roadCoords, cityBuildings: [], CITY_HALF_BOUND: 1200, cityEnvGroup: group, performance: { now: () => 9999 },
    sound: { beep() {} }, clearAllInputKeys: () => { context.clears = (context.clears || 0) + 1; },
    THREE: { DoubleSide: 2, Group: Object3D, Mesh, CylinderGeometry: Geometry, RingGeometry: Geometry, MeshBasicMaterial: Material },
  });
  vm.runInContext(source, context);
  const taxi = window.RoadsterTaxi;
  const key = (overrides = {}) => taxi.handleKeydown({ code: 'Equal', key: '=', target: new Element(), preventDefault() {}, ...overrides });
  const move = point => { Object.assign(state, point); taxi.tick(); };
  return { context, state, window, document, elements, group, taxi, confirms, aborts, key, move, approve: value => { approved = value; } };
}

test('secret key is city-only, opt-in, repeat-safe, focus-safe and never reopens an active game', () => {
  const h = harness(); assert.equal(h.elements['hud-footer'].children.length, 0); assert.equal(h.group.children.length, 0);
  h.context.currentMap = 'highway'; h.key(); assert.equal(h.confirms.length, 0);
  h.context.currentMap = 'city'; h.key({ repeat: true }); assert.equal(h.confirms.length, 0);
  for (const flag of ['shiftKey', 'ctrlKey', 'altKey', 'metaKey', 'isComposing']) {
    assert.equal(h.key({ [flag]: true }), false);
  }
  const input = new Element(); input.typing = true; h.key({ target: input }); assert.equal(h.confirms.length, 0);
  for (const id of Object.keys(h.elements).filter(id => id.startsWith('modal-'))) {
    h.elements[id].classList.remove('hidden'); h.key(); assert.equal(h.confirms.length, 0); h.elements[id].classList.add('hidden');
  }
  h.document.hidden = true; h.key(); h.document.hidden = false; assert.equal(h.confirms.length, 0);
  h.window.RoadsterRanked.isDialogOpen = () => true; h.key(); h.window.RoadsterRanked.isDialogOpen = () => false;
  h.window.RoadsterMusic.isSettingsOpen = () => true; h.key(); h.window.RoadsterMusic.isSettingsOpen = () => false;
  h.state.isDestroyed = true; h.key(); h.state.isDestroyed = false; assert.equal(h.confirms.length, 0);
  h.approve(false); h.key(); assert.equal(h.confirms.length, 1); assert.equal(h.taxi.snapshot().active, false);
  assert.equal(h.elements['hud-footer'].children.length, 0); assert.equal(h.group.children.length, 0);
  h.approve(true); h.key(); assert.equal(h.confirms.length, 2); assert.equal(h.taxi.snapshot().waiting.length, 5);
  assert.equal(h.aborts.join(','), 'invalid'); assert.equal(h.context.lastTime, 9999); assert.ok(h.context.clears >= 4);
  const ids = h.taxi.snapshot().waiting.map(x => x.id).join(',');
  h.key(); h.key({ repeat: true }); assert.equal(h.confirms.length, 2);
  assert.equal(h.taxi.snapshot().waiting.map(x => x.id).join(','), ids);
  assert.equal(h.elements['hud-footer'].children.length, 2); assert.equal(h.group.children.length, 1);
});

test('real shared keyboard handler delegates = exclusively, preserves typing, and retains ] zoom', () => {
  const h = harness();
  const hud = readFileSync(new URL('../src/ui-hud.js', import.meta.url), 'utf8');
  const handlerSource = hud.slice(hud.indexOf("window.addEventListener('keydown'"), hud.indexOf("window.addEventListener('keyup'"));
  let handler;
  h.window.addEventListener = (type, listener) => { if (type === 'keydown') handler = listener; };
  h.context.THREE.MathUtils = { clamp: (value, min, max) => Math.max(min, Math.min(max, value)) };
  h.context.updateZoomButtonLabel = () => {};
  h.context.setKeyState = () => { throw new Error('handled shortcuts must not become held controls'); };
  h.state.camZoom = 0.75;
  vm.runInContext(handlerSource, h.context);
  const event = code => ({ code, key: code === 'Equal' ? '=' : ']', target: new Element(), preventDefault() {} });
  const typed = event('Equal'); typed.target.typing = true; handler(typed);
  assert.equal(h.confirms.length, 0); assert.equal(h.state.camZoom, 0.75);
  handler(event('Equal')); assert.equal(h.confirms.length, 1); assert.equal(h.taxi.snapshot().active, true);
  assert.equal(h.state.camZoom, 0.75);
  handler(event('Equal')); assert.equal(h.confirms.length, 1); assert.equal(h.state.camZoom, 0.75);
  handler(event('BracketRight')); assert.equal(h.state.camZoom, 0.65);
});

test('scene has five readable double-sided white beams and only one green destination while occupied', () => {
  const h = harness(); h.key(); const markers = h.group.children[0].children;
  assert.equal(markers.length, 6); assert.equal(markers.filter(x => x.visible).length, 5);
  for (const marker of markers.slice(0, 5)) {
    assert.equal(marker.children[0].material.color, 0xffffff);
    assert.equal(marker.children[0].material.opacity, 0.34);
    assert.equal(marker.children[0].material.side, 2);
    assert.equal(marker.children[0].material.toneMapped, false);
    assert.equal(marker.children[0].material.depthTest, true);
    assert.equal(marker.children[0].geometry.args[0], core.MARKER_RADIUS);
    assert.equal(marker.children[2].material.opacity, 0.82);
    assert.equal(marker.children[2].geometry.args[0], 0.75);
    assert.equal(marker.children[0].geometry.args[2], 1100);
    assert.equal(marker.children[0].material.fog, false);
    assert.equal(marker.children[0].material.depthWrite, false);
  }
  const trip = h.taxi.snapshot().waiting[0];
  h.move({ ...trip.pickup, y: 10 }); assert.equal(h.taxi.snapshot().passenger, null);
  h.move(trip.pickup);
  assert.equal(h.taxi.snapshot().passenger.id, trip.id); assert.equal(markers.filter(x => x.visible).length, 1);
  assert.equal(markers.at(-1).visible, true); assert.equal(markers.at(-1).children[0].material.color, 0x22ff77);
  assert.equal(markers.at(-1).position.x, trip.destination.x); assert.equal(markers.at(-1).position.z, trip.destination.z);
  const other = h.taxi.snapshot().waiting.find(candidate => !core.withinArrival(trip.pickup, candidate.pickup, trip.destination));
  assert.ok(other, 'use another pickup that does not sweep through this green destination');
  h.move(other.pickup); assert.equal(h.taxi.snapshot().passenger.id, trip.id);
  assert.equal(markers.filter(x => x.visible).length, 1);
  h.move(trip.destination); assert.equal(h.taxi.snapshot().score, trip.fare);
  assert.equal(markers.filter(x => x.visible).length, 5); assert.equal(markers.at(-1).visible, false);
  assert.equal(h.state.score, 123); assert.equal(h.state.carsCleared, 10);
  const scoreHud = h.elements['hud-footer'].children.at(-1);
  assert.equal(scoreHud.children.length, 1); assert.equal(scoreHud.children[0].textContent, trip.fare.toLocaleString());
  h.context.currentLang = 'zh'; h.taxi.render();
  assert.equal(scoreHud.children[0].textContent, trip.fare.toLocaleString());
  assert.equal(scoreHud.attributes['aria-label'], `接客积分 ${trip.fare.toLocaleString()}`);
});

test('map exit and repeated stops fully remove and dispose markers and the active-only score display', () => {
  const h = harness(); h.key(); const markers = h.group.children[0].children;
  const geometry = markers[0].children[0].geometry, material = markers[0].children[0].material;
  const trip = h.taxi.snapshot().waiting[0]; h.move(trip.pickup);
  Object.assign(h.state, origin); h.taxi.onReset();
  assert.equal(h.taxi.snapshot().passenger, null); assert.equal(h.taxi.snapshot().waiting.length, 5);
  h.context.currentMap = 'highway'; h.taxi.tick(); h.taxi.stop();
  assert.equal(h.taxi.snapshot().active, false); assert.equal(h.taxi.snapshot().score, 0);
  assert.equal(h.group.children.length, 0); assert.equal(h.elements['hud-footer'].children.length, 0);
  assert.equal(geometry.disposed, true); assert.equal(material.disposed, true);
  h.context.currentMap = 'city'; h.key(); assert.equal(h.taxi.snapshot().waiting.length, 5);
  assert.equal(h.group.children.length, 1); assert.equal(h.elements['hud-footer'].children.length, 2);
});

test('bottom-right HUD renders only the original passenger score through deliveries, losses and empty resets', () => {
  const h = harness(); h.key();
  const scoreHud = h.elements['hud-footer'].children.at(-1);
  let expected = 0;
  const check = () => {
    assert.equal(scoreHud.children.length, 1, 'no title, delivery count, fare, route or status row');
    assert.equal(scoreHud.children[0].children.length, 0);
    assert.equal(scoreHud.children[0].textContent, expected.toLocaleString());
    assert.equal(h.taxi.snapshot().score, expected);
    assert.equal(h.state.score, 123, 'driving score stays separate');
    assert.equal(h.state.carsCleared, 10);
  };
  check();
  for (let i = 0; i < 6; i++) {
    const trip = h.taxi.snapshot().waiting[0];
    h.move(trip.pickup); check();
    h.move(trip.destination); expected += trip.fare; check();
    assert.equal(h.taxi.snapshot().passenger, null);
    assert.equal(navigationParts(h).navigation.hidden, true, 'score remains current without a destination');
  }
  const trip = h.taxi.snapshot().waiting[0]; h.move(trip.pickup); check();
  h.state.isDestroyed = true; h.taxi.onDestroyed();
  expected = Math.max(0, expected - trip.fare * 2); assert.ok(expected > 0); check();
  for (let i = 0; i < 3; i++) { h.taxi.onDestroyed(); h.taxi.tick(); check(); }
  Object.assign(h.state, origin, { isDestroyed: false }); h.taxi.onReset(); check();
  while (expected > 0) {
    const next = h.taxi.snapshot().waiting[0]; h.move(next.pickup); check();
    h.taxi.onReset(); expected = Math.max(0, expected - next.fare * 2); check();
    h.taxi.onReset(); check();
  }
  assert.equal(h.taxi.snapshot().passenger, null);
  const next = h.taxi.snapshot().waiting[0]; h.move(next.pickup); h.taxi.onReset(); check();
  h.context.currentMap = 'highway'; h.taxi.tick();
  assert.equal(scoreHud.parent, null); assert.equal(h.elements['hud-footer'].children.length, 0);
  h.context.currentMap = 'city'; h.key();
  const restartedHud = h.elements['hud-footer'].children.at(-1);
  assert.notEqual(restartedHud, scoreHud);
  assert.equal(restartedHud.children.length, 1); assert.equal(restartedHud.children[0].textContent, '0');
});

test('numeric passenger score survives language and HUD/camera changes without adding visual text', () => {
  const h = harness(); h.key(); const trip = h.taxi.snapshot().waiting[0];
  h.move(trip.pickup); h.move(trip.destination);
  const scoreHud = h.elements['hud-footer'].children.at(-1);
  for (const currentLang of ['zh', 'en', 'zh', 'en']) {
    h.context.currentLang = currentLang;
    for (const mode of [0, 3, 2, 1, 3, 0]) {
      h.context.cameraModeIndex = mode; h.state.hudMinimal = mode % 2 === 1;
      h.taxi.render(); h.taxi.tick();
      assert.equal(scoreHud.children.length, 1);
      assert.equal(scoreHud.children[0].textContent, trip.fare.toLocaleString());
      assert.equal(scoreHud.attributes['aria-label'], `${currentLang === 'zh' ? '接客积分' : 'Passenger score'} ${trip.fare.toLocaleString()}`);
      assert.equal(navigationParts(h).navigation.hidden, true);
    }
  }
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  const scoreStyle = css.match(/\.city-taxi-hud \{([^}]+)\}/)[1];
  assert.match(scoreStyle, /max-width: 100%; box-sizing: border-box/);
  assert.doesNotMatch(scoreStyle, /width: min\(21rem|flex-direction: column/);
  assert.match(css, /\.city-taxi-hud strong \{[^}]*font-variant-numeric: tabular-nums;[^}]*overflow-wrap: anywhere;/);
  const hud = readFileSync(new URL('../src/ui-hud.js', import.meta.url), 'utf8');
  assert.match(hud, /function applyTranslations\(\) \{[\s\S]*?window\.RoadsterTaxi\?\.render\(\)/);
});

test('menus pause transitions; destruction clears the occupied ride before any payout', () => {
  const h = harness(); h.key(); const trip = h.taxi.snapshot().waiting[0];
  h.elements['modal-help'].classList.remove('hidden'); h.move(trip.pickup);
  assert.equal(h.taxi.snapshot().passenger, null);
  h.elements['modal-help'].classList.add('hidden'); h.taxi.tick(); assert.equal(h.taxi.snapshot().passenger.id, trip.id);
  h.state.isDestroyed = true; h.move(trip.destination); assert.equal(h.taxi.snapshot().score, 0);
  assert.equal(h.taxi.snapshot().passenger, null);
  assert.equal(h.taxi.snapshot().waiting.length, 5);
  assert.equal(h.group.children[0].children.filter(marker => marker.visible).length, 5);
  Object.assign(h.state, origin, { isDestroyed: false }); h.taxi.onReset();
  assert.equal(h.taxi.snapshot().score, 0); assert.equal(h.taxi.snapshot().passenger, null);
});

test('integration has no discoverable entry, retains zoom brackets and keeps taxi fares out of ranked state', () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  const hiddenCrashScore = html.match(/<div id="crash-passenger-score"[^>]* hidden>[\s\S]*?<\/strong>\s*<\/div>/)?.[0];
  assert.ok(hiddenCrashScore, 'passenger crash score is hidden until the secret game is active');
  const visibleHtml = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(hiddenCrashScore, '');
  assert.doesNotMatch(visibleHtml, /taxi|passenger|接客|乘客|快捷键[^<]*=|\[=\]|aria-keyshortcuts\s*=\s*["']=["']/i);
  assert.doesNotMatch(config.replace(/^.*crashLblPassengerScore:.*$/gm, ''), /taxi|passenger|接客|乘客/);
  const hud = readFileSync(new URL('../src/ui-hud.js', import.meta.url), 'utf8');
  assert.match(hud, /if \(window\.RoadsterTaxi\?\.handleKeydown\(e\)\) return/);
  assert.ok(hud.indexOf("closest('input") < hud.indexOf('RoadsterTaxi?.handleKeydown(e)'));
  assert.match(hud, /if \(e\.code === 'BracketRight'\)/);
  assert.match(hud, /function switchMap\(targetMap\) \{\s*window\.RoadsterTaxi\?\.stop\(\)/);
  assert.match(hud, /window\.RoadsterTaxi\?\.onReset\(\)/);
  const ranked = readFileSync(new URL('../src/leaderboard.js', import.meta.url), 'utf8');
  assert.match(ranked, /normalizing = true;\s*window\.RoadsterTaxi\?\.stop\(\);\s*resetCar\(\)/);
  assert.doesNotMatch(source, /state\.score\s*[+\-*/]?=|\/api\/|fetch\(/);
  const physics = readFileSync(new URL('../src/physics-main.js', import.meta.url), 'utf8');
  assert.match(physics, /state\.isDestroyed = true;\s*window\.RoadsterTaxi\?\.onDestroyed\(\)/);
  assert.match(physics, /updateSimulation\(dt\);\s*window\.RoadsterTaxi\?\.tick\(\);\s*if \(state\.isDestroyed\) updateDestroyedScores\(\);\s*renderer\.render/);
  const bundler = readFileSync(new URL('../bundle_app.py', import.meta.url), 'utf8');
  assert.match(bundler, /'vehicles\.js', 'taxi\.js', 'ui-hud\.js'/);
});

test('stop clearance rejects the entire column footprint, trim margin and city boundary', () => {
  const building = { minX: 3.9, maxX: 10, minZ: -10, maxZ: 10 };
  assert.equal(core.isStopClear({ x: 0, z: 0 }, [building], 1200), false, 'center is outside but beam margin would overlap');
  assert.equal(core.isStopClear({ x: -0.11, z: 0 }, [building], 1200), true);
  assert.equal(core.isStopClear({ x: 1196, z: 0 }, [], 1200), false);
  assert.equal(core.isStopClear({ x: 1195.9, z: 0 }, [], 1200), true);
  const unsafe = graph.nodes[0];
  const filtered = core.buildRoadGraph(roadCoords, 11.5, [{ minX: unsafe.x + 2.9, maxX: unsafe.x + 6, minZ: unsafe.z - 1, maxZ: unsafe.z + 1 }], 1200);
  assert.equal(filtered.nodes.length, 48);
  assert.ok(!filtered.nodes.some(node => node.x === unsafe.x && node.z === unsafe.z));
  filtered.nodes.forEach((node, id) => assert.equal(node.id, id));
});

test('landing and low altitude flight never sweep a pickup or destination', () => {
  const session = makeSession(); session.start(origin);
  const trip = session.snapshot().waiting[0];
  const flyThenLandBeyond = stop => {
    assert.equal(session.advance({ ...stop, x: stop.x - 4, y: 0.4 }, false), null);
    assert.equal(session.advance({ ...stop, x: stop.x + 4 }, true), null);
    assert.equal(session.advance({ ...stop, y: 0.1 }, false), null);
  };
  flyThenLandBeyond(trip.pickup); assert.equal(session.snapshot().passenger, null);
  assert.equal(at(session, { ...trip.pickup, y: 0.36 }), null);
  assert.equal(at(session, trip.pickup).type, 'picked-up');
  flyThenLandBeyond(trip.destination); assert.equal(session.snapshot().score, 0);
  assert.equal(at(session, trip.destination).type, 'delivered');
  const h = harness(); h.key(); const next = h.taxi.snapshot().waiting[0];
  h.state.wasAirborne = true; h.move(next.pickup); assert.equal(h.taxi.snapshot().passenger, null);
  h.state.wasAirborne = false; h.move(next.pickup); assert.equal(h.taxi.snapshot().passenger.id, next.id);
});

test('passenger death charges exactly double fare once, including crash-to-reset and zero floor', () => {
  const h = harness(); h.key();
  for (let i = 0; i < 10; i++) {
    const trip = h.taxi.snapshot().waiting[0]; h.move(trip.pickup); h.move(trip.destination);
  }
  const trip = h.taxi.snapshot().waiting[0]; h.move(trip.pickup);
  const before = h.taxi.snapshot();
  h.state.hullIntegrity = 80; h.taxi.tick();
  assert.equal(h.taxi.snapshot().passenger.id, trip.id, 'surviving damage keeps the passenger');
  h.state.isDestroyed = true; h.taxi.onDestroyed();
  assert.equal(h.taxi.snapshot().score, before.score - trip.fare * 2);
  assert.ok(h.taxi.snapshot().score > 0); assert.equal(h.taxi.snapshot().delivered, before.delivered);
  assert.equal(h.taxi.snapshot().passenger, null);
  assert.equal(h.group.children[0].children.filter(marker => marker.visible).length, 5);
  for (let i = 0; i < 10; i++) { h.taxi.onDestroyed(); h.taxi.tick(); }
  Object.assign(h.state, origin, { isDestroyed: false }); h.taxi.onReset(); h.taxi.onReset();
  assert.equal(h.taxi.snapshot().score, before.score - trip.fare * 2, 'repair after crash cannot charge twice');
  const next = h.taxi.snapshot().waiting[0]; h.move(next.pickup); h.taxi.onReset();
  const expected = Math.max(0, before.score - trip.fare * 2 - next.fare * 2);
  assert.equal(h.taxi.snapshot().score, expected); h.taxi.onReset(); assert.equal(h.taxi.snapshot().score, expected);
  const session = makeSession(); session.start(origin); const first = session.snapshot().waiting[0]; at(session, first.pickup);
  assert.equal(session.losePassenger(first.pickup).deducted, 0); assert.equal(session.snapshot().score, 0);
  assert.equal(session.losePassenger(first.pickup), null);
});

test('bottom-right passenger HUD participates in footer bounds and releases its active layout', () => {
  const h = harness(); const footer = h.elements['hud-footer'];
  const controls = new Element(), cluster = new Element();
  footer.appendChild(controls); footer.appendChild(cluster); h.key();
  assert.deepEqual(footer.children[0].children, [controls, cluster]);
  assert.equal(footer.children.at(-1).id, 'city-taxi-hud'); assert.equal(footer.classList.contains('taxi-active'), true);
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  const taxiCss = css.slice(css.indexOf('.city-taxi-hud {'));
  assert.match(taxiCss, /align-self: flex-end/); assert.match(taxiCss, /text-align: right/);
  assert.doesNotMatch(taxiCss, /left: 50%|translateX|position: fixed/);
  assert.match(taxiCss, /\.taxi-footer-instruments \{[^}]*min-height: 0;[^}]*overflow-y: auto/s);
  assert.match(taxiCss, /#hud-footer\.taxi-active \{ overflow: visible;/);
  const resources = new Set(h.group.children[0].children.flatMap(marker => marker.children.flatMap(mesh => [mesh.geometry, mesh.material])));
  h.taxi.stop(); assert.deepEqual(footer.children, [controls, cluster]); assert.equal(footer.classList.contains('taxi-active'), false);
  for (const resource of resources) assert.equal(resource.disposed, true);
});

test('cockpit passenger strip shows live destination distance and local score without covering speed or tank', () => {
  const h = harness(); const draws = [], fills = [];
  const ctx = { save() {}, restore() {}, fillText(text, x, y, width) { draws.push({ text, x, y, width }); }, fillRect(...rect) { fills.push(rect); } };
  h.taxi.drawCockpit(ctx); assert.equal(draws.length, 0);
  h.key(); h.taxi.drawCockpit(ctx); assert.match(draws.at(-1).text, /EMPTY.*5 WAITING/);
  const trip = h.taxi.snapshot().waiting[0]; h.move(trip.pickup);
  Object.assign(h.state, trip.destination, { x: trip.destination.x - 100 });
  h.taxi.drawCockpit(ctx); assert.match(draws.at(-1).text, /ON BOARD.*100m/);
  assert.match(draws.at(-1).text, new RegExp(String(trip.fare)));
  for (const draw of draws) { assert.ok(draw.y > 160 && draw.y < 198); assert.ok(draw.x >= 18 && draw.x + draw.width < 512); }
  for (const [x, y, width, height] of fills) { assert.ok(y >= 160 && y + height <= 198); }
  h.move(trip.destination); h.taxi.drawCockpit(ctx); assert.match(draws.at(-2).text, new RegExp(`${trip.fare} PTS`));
  h.context.currentLang = 'zh'; h.taxi.drawCockpit(ctx); assert.match(draws.at(-1).text, /空车/);
  const hud = readFileSync(new URL('../src/ui-hud.js', import.meta.url), 'utf8');
  assert.match(hud, /window\.RoadsterTaxi\?\.drawCockpit\(ctx\);\s*cockpitHudTexture\.needsUpdate = true/);
});

test('destination bearing maps vehicle-forward up and left/right correctly at every heading', () => {
  const position = { x: 17, y: 600, z: -29 };
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.432, 6 * Math.PI + 0.432]) {
    for (const angle of [-Math.PI, -Math.PI / 2, 0, Math.PI / 2, Math.PI]) {
      // Build the destination from the vehicle axes; altitude must not affect bearing/distance.
      const right = Math.sin(angle) * 100, forward = Math.cos(angle) * 100;
      const destination = { x: position.x + right * Math.cos(yaw) - forward * Math.sin(yaw),
        y: 0, z: position.z - right * Math.sin(yaw) - forward * Math.cos(yaw) };
      const bearing = core.destinationBearing(position, yaw, destination);
      assert.ok(Math.abs(Math.atan2(Math.sin(bearing.radians - angle), Math.cos(bearing.radians - angle))) < 1e-10);
      assert.ok(Math.abs(bearing.meters - 100) < 1e-10);
    }
  }
  for (const bad of [NaN, Infinity, undefined]) assert.equal(core.destinationBearing(position, bad, origin), null);
  assert.equal(core.destinationBearing({ ...position, x: NaN }, 0, origin), null);
});

const navigationParts = h => {
  const navigation = h.elements['hud-top-container'].children.find(child => child.id === 'city-taxi-navigation');
  return { navigation, arrow: navigation?.children[0] };
};
const rotation = arrow => Number(arrow.style.transform.match(/rotate\(([^r]+)rad\)/)[1]);

test('upper-left navigation is a bare arrow, hidden empty and live across all three real HUD modes and cameras', () => {
  const h = harness(), top = h.elements['hud-top-container'];
  const hud = readFileSync(new URL('../src/ui-hud.js', import.meta.url), 'utf8');
  const modeControls = hud.slice(hud.indexOf('const HUD_MODES'), hud.indexOf('function restoreHudMode()'));
  const perspectiveControl = hud.slice(hud.indexOf('function syncHudPerspective()'), hud.indexOf('const HUD_MODES'));
  h.context.updateHudBounds = () => {};
  vm.runInContext(`${modeControls}\n${perspectiveControl}`, h.context);
  assert.equal(navigationParts(h).navigation, undefined);
  h.key(); const { navigation, arrow } = navigationParts(h);
  assert.equal(navigation.hidden, true); assert.equal(top.classList.contains('taxi-navigation-active'), false);
  assert.equal(top.children.indexOf(navigation) + 1, top.children.indexOf(h.elements['hud-main']));
  assert.equal(navigation.attributes.role, 'img');
  assert.deepEqual(navigation.children, [arrow], 'no label, distance, dial, card or other visible element');
  assert.equal(navigation.textContent, ''); assert.equal(arrow.textContent, '');
  assert.equal(arrow.children.length, 0); assert.equal(arrow.attributes['aria-hidden'], 'true');
  const trip = h.taxi.snapshot().waiting[0]; h.move(trip.pickup);
  assert.equal(navigation.hidden, false); assert.equal(top.classList.contains('taxi-navigation-active'), true);
  // Stay far from the destination while varying yaw, altitude, camera and HUD modes.
  Object.assign(h.state, { x: trip.destination.x, z: trip.destination.z + 100, y: 50, wasAirborne: true });
  for (const hudMode of ['full', 'medium', 'minimal', 'full']) {
    h.state.hudMode = hudMode;
    for (const mode of [0, 3, 2, 1, 3, 0]) {
      h.context.cameraModeIndex = mode;
      vm.runInContext('applyHudMode(); syncHudPerspective();', h.context);
      assert.equal(h.document.body.dataset.hudMode, hudMode);
      assert.equal(h.document.body.classList.contains('cockpit-view'), mode === 3);
      h.state.yaw = Math.PI / 2; h.taxi.tick();
      assert.equal(navigation.hidden, false); assert.ok(Math.abs(rotation(arrow) - Math.PI / 2) < 1e-10);
      assert.match(navigation.attributes['aria-label'], /100 meters/);
      h.state.yaw = -Math.PI / 2; h.taxi.tick();
      assert.ok(Math.abs(Math.sin(rotation(arrow)) + 1) < 1e-10);
      assert.deepEqual(navigation.children, [arrow]);
      assert.equal(arrow.textContent, '');
    }
  }
  h.context.currentLang = 'zh'; h.taxi.render();
  assert.match(navigation.attributes['aria-label'], /距离 100 米；箭头上方为车头前方/);
  assert.equal(navigation.textContent, ''); assert.equal(arrow.textContent, '');
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.city-taxi-navigation\[hidden\] \{ display: none; \}/);
  assert.match(css, /#hud-left, #hud-right-card \{[^}]*var\(--hud-navigation-height, 0px\)/s);
  assert.match(css, /\.taxi-navigation-active \{ --hud-navigation-height: 40px; \}/);
  assert.match(css, /\.city-taxi-navigation \{[^}]*border: 0; background: none;/s);
  assert.doesNotMatch(css, /\.city-taxi-navigation-(?:card|dial|detail)/);
  assert.doesNotMatch(css, /\.cockpit-view[^}]*\.city-taxi-navigation/);
  assert.doesNotMatch(css, /(?:data-hud-mode|hud-minimal-view|hud-compact-view)[^}]*\.city-taxi-navigation/);
});

test('bare arrow has unclipped rotation space on portrait, landscape and desktop viewports', () => {
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.taxi-navigation-active \{ --hud-navigation-height: 48px; \}/);
  assert.match(css, /\.city-taxi-navigation-arrow \{[^}]*width: 20px; height: 30px/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.city-taxi-navigation-arrow \{ width: 16px; height: 26px; \}/);
  for (const [width, height] of [[320, 568], [568, 320], [390, 844], [844, 390], [1366, 768]]) {
    const mobile = width <= 767;
    const rowHeight = mobile ? 40 : 48, paddingLeft = mobile ? 12 : 20;
    const arrowWidth = mobile ? 16 : 20, arrowHeight = mobile ? 26 : 30;
    const radius = Math.hypot(arrowWidth, arrowHeight) / 2;
    assert.ok(rowHeight / 2 - radius >= 4, 'arrow clears vertical row padding at any angle');
    assert.ok(paddingLeft + arrowWidth / 2 - radius >= 0, 'left-pointing arrow stays onscreen');
    assert.ok(paddingLeft + arrowWidth / 2 + radius < width);
    const header = height * 0.25, footer = height * 0.32;
    assert.ok(header + rowHeight < height - footer, 'navigation row stays clear of footer in either orientation');
  }
});

test('bare navigation arrow gets dark silhouette contrast without a background, border or card', () => {
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  const host = css.match(/\.city-taxi-navigation \{([^}]+)\}/)[1];
  const arrow = css.match(/\.city-taxi-navigation-arrow \{([^}]+)\}/)[1];
  assert.match(host, /background: none;/); assert.match(host, /border: 0;/);
  assert.match(host, /filter: drop-shadow\(0 1px 1px rgba\(0, 0, 0, 0\.9\)\);/);
  assert.doesNotMatch(host, /border-radius|box-shadow|backdrop-filter/);
  assert.match(arrow, /background: #86efac;/); assert.match(arrow, /clip-path: polygon\(/);
  assert.doesNotMatch(arrow, /border|outline|box-shadow/);
  // Applying the filter to the transparent host keeps the child's clip-path
  // from cutting off the shadow; the arrow is the host's only visible content.
  const h = harness(); h.key(); const { navigation, arrow: element } = navigationParts(h);
  assert.deepEqual(navigation.children, [element]); assert.equal(element.children.length, 0);
  assert.equal(navigation.textContent, ''); assert.equal(element.textContent, '');
  assert.doesNotMatch(css, /\.city-taxi-navigation-(?:card|dial|detail)/);
});

test('navigation crosses north and +/-180 smoothly without a reverse full-turn jump', () => {
  for (const boundary of [0, Math.PI, 2 * Math.PI, -2 * Math.PI]) {
    const h = harness(); h.key(); const trip = h.taxi.snapshot().waiting[0]; h.move(trip.pickup);
    Object.assign(h.state, { x: trip.destination.x, z: trip.destination.z + 100, y: 10, wasAirborne: true, yaw: boundary - 0.001 });
    h.taxi.tick(); const before = rotation(navigationParts(h).arrow);
    h.state.yaw = boundary + 0.001; h.taxi.tick();
    const after = rotation(navigationParts(h).arrow);
    assert.ok(Math.abs((after - before) - 0.002) < 1e-10);
  }
});

test('menus pause passenger transitions without freezing the live vehicle-relative bearing', () => {
  const h = harness(); h.key(); const trip = h.taxi.snapshot().waiting[0]; h.move(trip.pickup);
  Object.assign(h.state, { x: trip.destination.x, z: trip.destination.z + 100, yaw: 0 });
  h.elements['modal-help'].classList.remove('hidden'); h.taxi.tick();
  assert.ok(Math.abs(rotation(navigationParts(h).arrow)) < 1e-10);
  h.state.yaw = Math.PI / 2; h.taxi.tick();
  assert.ok(Math.abs(rotation(navigationParts(h).arrow) - Math.PI / 2) < 1e-10);
  h.move(trip.destination); assert.equal(h.taxi.snapshot().passenger.id, trip.id);
});

test('delivery, destroyed/reset passengers, stop and map exit clear navigation and its reserved space', () => {
  for (const finish of ['delivery', 'destroy', 'reset', 'stop', 'map']) {
    const h = harness(); h.key(); const trip = h.taxi.snapshot().waiting[0]; h.move(trip.pickup);
    const { navigation, arrow } = navigationParts(h); assert.equal(navigation.hidden, false);
    if (finish === 'delivery') h.move(trip.destination);
    if (finish === 'destroy') { h.state.isDestroyed = true; h.taxi.onDestroyed(); h.taxi.onDestroyed(); }
    if (finish === 'reset') h.taxi.onReset();
    if (finish === 'stop') { h.taxi.stop(); h.taxi.stop(); }
    if (finish === 'map') { h.context.currentMap = 'highway'; h.taxi.tick(); }
    assert.equal(h.taxi.snapshot().passenger, null);
    assert.equal(h.elements['hud-top-container'].classList.contains('taxi-navigation-active'), false);
    if (finish === 'stop' || finish === 'map') assert.equal(navigation.parent, null);
    else { assert.equal(navigation.hidden, true); assert.equal(arrow.style.transform, ''); }
  }
});

test('short landscape notice space is bounded by the header, footer and occupied-trip row', () => {
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  const rule = css.match(/#hud-top-container\.taxi-navigation-active \{([^}]+)\}/)[1];
  assert.match(rule, /--hud-notice-space: min\(100px, max\(0px, calc\(100dvh - var\(--hud-header-height, 150px\) - var\(--hud-footer-height, 180px\) - var\(--hud-navigation-height\) - 32px\)\)\)/);
  for (const height of [320, 360, 375, 600]) {
    const header = height * 0.25, footer = height * 0.32, navigation = 40;
    const notices = Math.min(100, Math.max(0, height - header - footer - navigation - 32));
    const panels = Math.max(0, height - header - footer - notices - navigation - 16);
    assert.ok(header + navigation + notices + 4 + panels <= height - footer);
  }
});
