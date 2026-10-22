import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const source = readFileSync(new URL('../src/render-diagnostics.js', import.meta.url), 'utf8');
const runtime = process.env.ROADSTER_THREE_RUNTIME || '/tmp/roadster-three.min.js';
const identity = () => ({ elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] });
let id = 0;
function object(name = '') {
  return { id: ++id, name, visible: true, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, order: 'XYZ' },
    scale: { x: 1, y: 1, z: 1 }, matrix: identity(), matrixWorld: identity(), matrixAutoUpdate: true, matrixWorldNeedsUpdate: false,
    layers: { mask: 1 }, children: [], userData: {}, onBeforeRender() {}, onAfterRender() {},
    add(child) { child.parent = this; this.children.push(child); return this; } };
}
function fixture({ count = 12, register = true, three = null } = {}) {
  const scene = object('world'), trafficGroup = object('traffic'); scene.add(trafficGroup);
  const camera = { ...object('camera'), near: .38, far: 3000, fov: 60, projectionMatrix: identity(), matrixWorldInverse: identity() };
  const material = Object.freeze({ id: 9, type: 'MeshStandardMaterial', visible: true, colorWrite: true, opacity: 1, transparent: false, side: 0, depthWrite: true, depthTest: true, version: 0 });
  const geometry = Object.freeze({ id: 8, attributes: { position: { count: 30 } }, index: { count: 60, array: new Uint16Array(60) },
    drawRange: Object.freeze({ start: 0, count: Infinity }), groups: Object.freeze([]), boundingSphere: null });
  const trafficCars = Array.from({ length: count }, (_, index) => {
    const mesh = object(`npc-${index}`); mesh.position.z = -index * 4; mesh.userData = { trafficVariant: `variant-${index}`, trafficDetail: 'near' };
    for (let slot = 0; slot < 6; slot++) { const child = object(`mesh-${slot}`); child.geometry = geometry; child.material = material; mesh.add(child); }
    trafficGroup.add(mesh); return { mesh, mode: 'city', vx: 0, vy: 0, vz: -20, speed: 20, blastTimer: 0 };
  });
  const events = {}, program = { id: 7, usedTimes: 2, diagnostics: { runnable: true, programLog: '', vertexShader: { log: '' }, fragmentShader: { log: '' } } };
  let reader, contextLost = false, time = 100, propertyReads = 0;
  const renderer = { info: { render: { calls: 45, triangles: 14000 }, memory: { geometries: 12 }, programs: [program] },
    properties: { get() { propertyReads++; return { program }; } }, getContext() { return { isContextLost: () => contextLost, getError() { throw Error('Do not consume GL error state'); } }; },
    domElement: { addEventListener(name, callback) { events[name] = callback; } } };
  const window = { RoadsterBuildInfo: { schema: 'roadster-source-manifest-v1', id: 'a'.repeat(64), sourceSha256: { 'src/physics-main.js': 'b'.repeat(64) } } };
  if (register) window.RoadsterCityDiagnostics = { setRuntimeReader(value) { reader = value; } };
  const state = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, isDestroyed: false };
  const context = vm.createContext({ window, scene, renderer, camera, trafficGroup, trafficCars, currentMap: 'city', state,
    performance: { now: () => ++time }, ...(three ? { THREE: three } : {}) });
  const install = () => vm.runInContext(source, context);
  function render({ finish = true, renderChildren = true } = {}) {
    scene.onBeforeRender(renderer, scene, camera, null);
    if (renderChildren) for (const car of trafficCars) for (const child of car.mesh.children) {
      child.onBeforeRender(renderer, scene, camera, child.geometry, child.material, null);
      child.onAfterRender(renderer, scene, camera, child.geometry, child.material, null);
    }
    if (finish) scene.onAfterRender(renderer, scene, camera);
  }
  return { install, render, context, window, scene, camera, renderer, trafficGroup, trafficCars, events, state, program, material, geometry,
    get reader() { return reader; }, get propertyReads() { return propertyReads; }, setContextLost(value) { contextLost = value; } };
}

test('registers a local bounded reader and does not require diagnostics registration to expose a live snapshot', () => {
  const f = fixture(); f.install();
  assert.equal(typeof f.reader, 'function');
  const value = f.window.RoadsterRenderDiagnostics.snapshot();
  assert.equal(value.schema, 'roadster-render-evidence-v1');
  assert.equal(value.phase, 'live'); assert.equal(value.map, 'city');
  assert.equal(value.build.id, 'a'.repeat(64)); assert.equal(value.build.sourceSha256['src/physics-main.js'], 'b'.repeat(64));
  assert.equal(value.build.sourceInputCount, 1);
  assert.equal(value.traffic.total, 12); assert.equal(value.traffic.captured, 8);
  assert.ok(value.traffic.cars.every(car => car.children.length <= 6));
  assert.match(value.limitation, /not GPU completion, pixel visibility/);
  assert.equal(f.propertyReads, 0, 'snapshot never requests properties for an unobserved material');
  const absent = fixture({ register: false }); absent.install();
  assert.equal(absent.window.RoadsterRenderDiagnostics.registered, false);
  assert.doesNotThrow(() => absent.window.RoadsterRenderDiagnostics.snapshot());
});

test('preserves scene and mesh callback this/arguments/results, observes attempts, and is idempotent', () => {
  const f = fixture({ count: 1 }), child = f.trafficCars[0].mesh.children[0], calls = [];
  f.scene.onBeforeRender = function (...args) { calls.push(['scene-before', this, args]); return 31; };
  f.scene.onAfterRender = function (...args) { calls.push(['scene-after', this, args]); return 32; };
  child.onBeforeRender = function (...args) { calls.push(['mesh-before', this, args]); return 41; };
  child.onAfterRender = function (...args) { calls.push(['mesh-after', this, args]); return 42; };
  f.install(); const wrapper = f.scene.onBeforeRender; f.install(); assert.equal(f.scene.onBeforeRender, wrapper);
  assert.equal(f.scene.onBeforeRender(f.renderer, f.scene, f.camera), 31);
  assert.equal(child.onBeforeRender(f.renderer, f.scene, f.camera, child.geometry, child.material), 41);
  assert.equal(child.onAfterRender(f.renderer, f.scene, f.camera, child.geometry, child.material), 42);
  assert.equal(f.scene.onAfterRender(f.renderer, f.scene, f.camera), 32);
  assert.deepEqual(calls.map(row => row[0]), ['scene-before', 'mesh-before', 'mesh-after', 'scene-after']);
  assert.equal(calls[0][1], f.scene); assert.equal(calls[1][1], child); assert.equal(calls[1][2][0], f.renderer);
  const snap = f.reader({ phase: 'impact' }), submission = snap.traffic.cars[0].children[0].submission;
  assert.equal(submission.beforeCallbacks, 1); assert.equal(submission.afterCallbacks, 1);
  assert.equal(submission.lastBeforeFrame, 1); assert.equal(submission.lastAfterFrame, 1);
  assert.equal(submission.lastProgram.id, 7); assert.equal(snap.frame.active, false);
});

test('does not mistake CPU callbacks, missing callbacks, or an interrupted previous frame for visible pixels', () => {
  const f = fixture({ count: 1 }); f.install(); f.render({ finish: false, renderChildren: false });
  let snap = f.reader(); assert.equal(snap.frame.active, true);
  assert.equal(snap.traffic.cars[0].children[0].submission.beforeCallbacks, 0);
  f.render(); snap = f.reader();
  assert.equal(snap.frame.started, 2); assert.equal(snap.frame.finished, 1);
  assert.equal(snap.frame.lastFinishedFrame, 2); assert.equal(snap.frame.active, false);
  assert.equal(snap.traffic.cars[0].children[0].submission.afterCallbacks, 1);
  assert.match(snap.limitation, /occlusion/);
});

test('retains the matching traffic contact even outside the nearest eight and accepts direct contact input', () => {
  const f = fixture(); f.install();
  const car = f.trafficCars[11], contact = { kind: 'traffic-body', variant: car.mesh.userData.trafficVariant, position: { ...car.mesh.position } };
  const snap = f.reader({ phase: 'impact', contact });
  assert.equal(snap.traffic.captured, 8); assert.equal(snap.traffic.contactTargetMatched, true);
  const target = snap.traffic.cars.find(value => value.contactTarget);
  assert.equal(target.variant, 'variant-11'); assert.equal(target.children[0].submission.observed, false);
  assert.equal(f.reader(contact).traffic.contactTargetMatched, true);
  assert.equal(f.reader({ contact: { ...contact, position: { x: 999, y: 0, z: 999 } } }).traffic.contactTargetMatched, false);
});

test('reports current ancestor visibility, attachment, stored matrices, layers and draw state without repairing scene objects', () => {
  const f = fixture({ count: 1 }), mesh = f.trafficCars[0].mesh.children[0];
  f.trafficGroup.visible = false; mesh.layers.mask = 2; mesh.matrixWorld.elements[12] = 91;
  mesh.matrixWorldNeedsUpdate = true; Object.freeze(mesh.scale); Object.freeze(mesh.geometry); Object.freeze(mesh.material);
  f.install(); const before = JSON.stringify({ matrix: mesh.matrixWorld, geometry: mesh.geometry, material: mesh.material, scale: mesh.scale });
  const value = f.reader().traffic.cars[0].children[0];
  assert.equal(value.eligibility.visibleInAncestors, false); assert.equal(value.eligibility.attachedToScene, true);
  assert.equal(value.eligibility.cameraLayerMatch, false); assert.equal(value.eligibility.storedSphereIntersectsCamera, null);
  assert.equal(value.matrixWorld[12], 91); assert.equal(value.matrixWorldNeedsUpdate, true);
  assert.equal(value.geometry.drawRange.unbounded, true); assert.equal(value.geometry.indexType, 'Uint16Array');
  assert.equal(JSON.stringify({ matrix: mesh.matrixWorld, geometry: mesh.geometry, material: mesh.material, scale: mesh.scale }), before);
  f.trafficCars[0].mesh.parent = null;
  assert.equal(f.reader().traffic.cars[0].children[0].eligibility.attachedToScene, false);
});

test('prioritizes bounded existing shader failures and observes context-loss events without consuming GL errors', () => {
  const f = fixture(); f.install();
  f.renderer.info.programs = Array.from({ length: 30 }, (_, index) => ({ id: index, diagnostics: { runnable: index !== 29,
    programLog: index === 29 ? 'link failed'.repeat(300) : '', vertexShader: { log: 'vertex' }, fragmentShader: { log: 'fragment' } } }));
  f.events.webglcontextlost(); f.setContextLost(true);
  let snap = f.reader(); assert.equal(snap.renderer.contextLost, true); assert.equal(snap.renderer.contextEvents.lost, 1);
  assert.equal(snap.renderer.failedProgramCount, 1); assert.equal(snap.renderer.programs.length, 8);
  assert.equal(snap.renderer.programs[0].id, 29); assert.equal(snap.renderer.programs[0].runnable, false);
  assert.equal(snap.renderer.programs[0].programLog.length, 1024); assert.equal(snap.renderer.getErrorConsumed, false);
  f.events.webglcontextrestored(); f.setContextLost(false); snap = f.reader();
  assert.equal(snap.renderer.contextLost, false); assert.equal(snap.renderer.contextEvents.restored, 1);
});

test('does not swallow or replace existing render callback failures', () => {
  const f = fixture({ count: 1 }), child = f.trafficCars[0].mesh.children[0], failure = Error('original observer failure');
  child.onBeforeRender = () => { throw failure; }; f.install(); f.scene.onBeforeRender(f.renderer, f.scene, f.camera);
  assert.throws(() => child.onBeforeRender(f.renderer), error => error === failure);
  assert.equal(f.reader().traffic.cars[0].children[0].submission.callbackError, failure.message);
});

test('native Three stored-sphere frustum evidence does not compute bounds or update world matrices', { skip: !existsSync(runtime) }, () => {
  const c = vm.createContext({}); vm.runInContext(readFileSync(runtime, 'utf8'), c); const T = c.THREE;
  const f = fixture({ count: 1, three: T }), child = f.trafficCars[0].mesh.children[0];
  const geometry = new T.BoxGeometry(1, 1, 1); geometry.computeBoundingSphere();
  const camera = new T.PerspectiveCamera(60, 1, .1, 100); camera.updateMatrixWorld(true); Object.assign(f.camera, camera);
  child.geometry = geometry; child.matrixWorld = new T.Matrix4().makeTranslation(0, 0, -5);
  geometry.computeBoundingSphere = () => { throw Error('must not compute source bounds'); };
  f.install(); assert.equal(f.reader().traffic.cars[0].children[0].eligibility.storedSphereIntersectsCamera, true);
  child.matrixWorld.makeTranslation(50, 0, -5);
  assert.equal(f.reader().traffic.cars[0].children[0].eligibility.storedSphereIntersectsCamera, false);
  assert.equal(child.matrixWorld.elements[12], 50);
});

test('diagnostics code has no network/storage/pixel-read/error-draining or asset mutation path', () => {
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage|readPixels|getError)\s*\(/);
  assert.doesNotMatch(source, /\.(?:geometry|material|scale)\s*=|\.computeBounding(?:Box|Sphere)\s*\(|\.update(?:World)?Matrix(?:World)?\s*\(/);
});

test('build evidence keeps only bounded public source hashes, never stringifies nested objects', () => {
  const f = fixture(); f.install();
  f.window.RoadsterBuildInfo.sourceSha256 = Object.fromEntries(Array.from({ length: 40 }, (_, index) => [`src/test-${index}.js`, 'b'.repeat(64)]));
  f.window.RoadsterBuildInfo.sourceSha256['.env'] = 'c'.repeat(64);
  f.window.RoadsterBuildInfo.sourceSha256['src/secret.js'] = 'not-a-hash';
  const value = f.reader().build;
  assert.equal(value.sourceInputCount, 40); assert.equal(Object.keys(value.sourceSha256).length, 32);
  assert.equal(value.sourceListTruncated, true); assert.equal('.env' in value.sourceSha256, false);
  assert.doesNotMatch(JSON.stringify(value), /\[object Object\]|not-a-hash/);
});

test('native 52-car/100-frame observer budget leaves asset bytes, materials and transforms unchanged', { skip: !existsSync(runtime) }, t => {
  const c = vm.createContext({ window: {}, atob: value => Buffer.from(value, 'base64').toString('binary') });
  vm.runInContext(readFileSync(runtime, 'utf8'), c);
  const file = name => readFileSync(new URL('../src/' + name, import.meta.url), 'utf8');
  const palette = file('vehicles.js').match(/const trafficPalette = \[[\s\S]*?\];/)[0];
  vm.runInContext(palette + '\nfunction createTrafficVehicleMesh(){} function populateTraffic(){}\n' + file('npc-traffic-assets.js') + '\n' + file('reference-traffic.js')
    + ';globalThis.make=createTrafficVehicleMesh;globalThis.variants=archivedTrafficAssets.variants;', c);
  const f = fixture({ count: 0, three: c.THREE });
  for (let index = 0; index < 52; index++) {
    const mesh = c.make(index, c.variants[index % c.variants.length].id);
    mesh.position.set((index % 6 - 2.5) * 4, 0, -index * 3); f.trafficGroup.add(mesh); mesh.updateMatrixWorld(true);
    f.trafficCars.push({ mesh, mode: 'city', vx: 0, vy: 0, vz: -20, speed: 20, blastTimer: 0 });
  }
  c.window.RoadsterTrafficAssets.updateLods(f.trafficCars, f.camera.position);
  function signature() {
    const hash = createHash('sha256'), geometries = new Set(), materials = new Set();
    for (const { mesh } of f.trafficCars) mesh.traverse(part => {
      hash.update(JSON.stringify({ position: part.position, rotation: part.rotation, scale: part.scale, visible: part.visible, matrix: part.matrix.elements, matrixWorld: part.matrixWorld.elements }));
      if (part.geometry && !geometries.has(part.geometry)) {
        geometries.add(part.geometry);
        for (const attribute of [...Object.values(part.geometry.attributes), part.geometry.index].filter(Boolean))
          hash.update(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
        hash.update(JSON.stringify({ drawRange: part.geometry.drawRange, groups: part.geometry.groups, boundingSphere: part.geometry.boundingSphere, boundingBox: part.geometry.boundingBox }));
      }
      for (const material of (Array.isArray(part.material) ? part.material : [part.material]).filter(Boolean)) if (!materials.has(material)) {
        materials.add(material); hash.update(JSON.stringify({ color: material.color?.getHex(), emissive: material.emissive?.getHex(), visible: material.visible,
          colorWrite: material.colorWrite, opacity: material.opacity, transparent: material.transparent, side: material.side, roughness: material.roughness, metalness: material.metalness, version: material.version }));
      }
    });
    return hash.digest('hex');
  }
  const before = signature(), startBaseline = performance.now();
  for (let i = 0; i < 100; i++) f.render();
  const baselineMs = performance.now() - startBaseline; f.install(); const startObserved = performance.now();
  for (let i = 0; i < 100; i++) f.render();
  const observedMs = performance.now() - startObserved, snapshotStart = performance.now(), result = f.reader(), snapshotMs = performance.now() - snapshotStart;
  assert.equal(signature(), before);
  assert.equal(result.traffic.captured, 8); assert.equal(result.frame.started, 100); assert.equal(result.frame.finished, 100);
  assert.ok(result.traffic.cars.every(car => car.children.every(child => child.submission.afterCallbacks === 100)));
  t.diagnostic(JSON.stringify({ scope: 'native Three CPU callbacks only, not GPU/device FPS', cars: 52, frames: 100, baselineMs, observedMs,
    meanObserverOverheadMsPerFrame: (observedMs - baselineMs) / 100, snapshotMs, snapshotJsonBytes: Buffer.byteLength(JSON.stringify(result)), assetTransformSha256: before }));
});
