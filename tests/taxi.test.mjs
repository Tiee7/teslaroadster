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
    this.classes = new Set(['hidden']);
    this.classList = { contains: x => this.classes.has(x), add: x => this.classes.add(x), remove: x => this.classes.delete(x) };
  }
  closest() { return this.typing ? this : null; }
  setAttribute(key, value) { this.attributes[key] = value; }
  appendChild(child) { child.remove(); child.parent = this; this.children.push(child); return child; }
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
  const elements = Object.fromEntries(['modal-map-select', 'modal-help', 'modal-destroyed', 'hud-footer'].map(id => [id, new Element()]));
  const document = { hidden: false, body: new Element(), getElementById: id => elements[id] || null, createElement: () => new Element() };
  const group = new Object3D(); const confirms = []; const aborts = []; let approved = true;
  const window = {
    confirm(message) { confirms.push(message); return approved; },
    RoadsterRanked: { abort: reason => aborts.push(reason), isDialogOpen: () => false },
    RoadsterMusic: { isSettingsOpen: () => false },
  };
  const state = { ...origin, isDestroyed: false, score: 123, carsCleared: 10 };
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
  assert.match(h.elements['hud-footer'].children.at(-1).children[0].textContent.replace(/,/g, ''), new RegExp(String(trip.fare)));
  h.context.currentLang = 'zh'; h.taxi.render(); assert.match(h.elements['hud-footer'].children.at(-1).children[0].textContent, /接客积分/);
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
  const visibleHtml = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  assert.doesNotMatch(visibleHtml, /taxi|passenger|接客|乘客|快捷键[^<]*=|\[=\]|aria-keyshortcuts\s*=\s*["']=["']/i);
  assert.doesNotMatch(config, /taxi|passenger|接客|乘客/);
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
  assert.match(physics, /updateSimulation\(dt\);\s*window\.RoadsterTaxi\?\.tick\(\);\s*renderer\.render/);
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
  for (const draw of draws) { assert.ok(draw.y > 232 && draw.y < 264); assert.ok(draw.x >= 18 && draw.x + draw.width < 512); }
  for (const [x, y, width, height] of fills) { assert.ok(y > 232 && y + height < 264); }
  h.move(trip.destination); h.taxi.drawCockpit(ctx); assert.match(draws.at(-2).text, new RegExp(`${trip.fare} PTS`));
  h.context.currentLang = 'zh'; h.taxi.drawCockpit(ctx); assert.match(draws.at(-1).text, /空车/);
  const hud = readFileSync(new URL('../src/ui-hud.js', import.meta.url), 'utf8');
  assert.match(hud, /window\.RoadsterTaxi\?\.drawCockpit\(ctx\);\s*cockpitHudTexture\.needsUpdate = true/);
});
