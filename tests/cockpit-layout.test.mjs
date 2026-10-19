import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const vehicles = readFileSync(new URL('../src/vehicles.js', import.meta.url), 'utf8');
const physics = readFileSync(new URL('../src/physics-main.js', import.meta.url), 'utf8');
const vec = (x = 0, y = 0, z = 0) => ({ x, y, z, set(x, y, z) { Object.assign(this, { x, y, z }); }, setScalar(v) { this.set(v, v, v); } });
function rotate(v, e, inverse = false) {
  const r = { ...v };
  for (const axis of inverse ? ['x', 'y', 'z'] : ['z', 'y', 'x']) {
    const a = e[axis] * (inverse ? -1 : 1), c = Math.cos(a), s = Math.sin(a);
    const [u, w] = axis === 'x' ? ['y', 'z'] : axis === 'y' ? ['z', 'x'] : ['x', 'y'];
    [r[u], r[w]] = [c * r[u] - s * r[w], s * r[u] + c * r[w]];
  }
  return r;
}
class Shape {
  constructor(width, height, depth = 0) { this.size = [width, height, depth]; this.rotation = vec(); }
  rotateX(x) { this.rotation.x += x; return this; } rotateZ(z) { this.rotation.z += z; return this; }
}
class BufferShape {
  constructor() { this.rotation = vec(); }
  setAttribute(name, attribute) { if (name === 'position') this.vertices = attribute.array; }
  setIndex(indices) { this.indices = indices; }
  computeVertexNormals() {}
}
class Object3D {
  constructor(geometry) { this.geometry = geometry; this.position = vec(); this.rotation = vec(); this.scale = vec(1, 1, 1); this.children = []; this.userData = {}; this.visible = true; }
  add(...objects) { for (const o of objects) { o.parent = this; this.children.push(o); } }
}
class Cylinder extends Shape { constructor(top, bottom, height) { super(2 * Math.max(top, bottom), height, 2 * Math.max(top, bottom)); } }
function localToWorld(v, object) {
  let r = rotate({ x: v.x * object.scale.x, y: v.y * object.scale.y, z: v.z * object.scale.z }, object.rotation);
  for (const a of ['x', 'y', 'z']) r[a] += object.position[a];
  return object.parent ? localToWorld(r, object.parent) : r;
}
function worldToLocal(v, object) {
  let r = object.parent ? worldToLocal(v, object.parent) : v;
  r = rotate({ x: r.x - object.position.x, y: r.y - object.position.y, z: r.z - object.position.z }, object.rotation, true);
  return { x: r.x / object.scale.x, y: r.y / object.scale.y, z: r.z / object.scale.z };
}
const subtract = (a, b) => vec(a.x - b.x, a.y - b.y, a.z - b.z);
const cross = (a, b) => vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
function intersects(eye, target, mesh) {
  const o = rotate(worldToLocal(eye, mesh), mesh.geometry.rotation, true);
  const end = rotate(worldToLocal(target, mesh), mesh.geometry.rotation, true);
  const direction = subtract(end, o), g = mesh.geometry;
  if (g.vertices) {
    for (let i = 0; i < g.indices.length; i += 3) {
      const points = g.indices.slice(i, i + 3).map(n => vec(...g.vertices.slice(3 * n, 3 * n + 3)));
      const e1 = subtract(points[1], points[0]), e2 = subtract(points[2], points[0]);
      const h = cross(direction, e2), determinant = dot(e1, h);
      if (Math.abs(determinant) < 1e-12) continue;
      const s = subtract(o, points[0]), u = dot(s, h) / determinant;
      if (u < 0 || u > 1) continue;
      const q = cross(s, e1), v = dot(direction, q) / determinant;
      if (v < 0 || u + v > 1) continue;
      const t = dot(e2, q) / determinant;
      if (t >= 0 && t < 1 - 1e-7) return true;
    }
    return false;
  }
  let min = 0, max = 1 - 1e-7;
  for (const [i, a] of ['x', 'y', 'z'].entries()) {
    const half = g.size[i] / 2, d = direction[a];
    if (Math.abs(d) < 1e-12) { if (Math.abs(o[a]) > half) return false; continue; }
    const range = [(-half - o[a]) / d, (half - o[a]) / d].sort((a, b) => a - b);
    min = Math.max(min, range[0]); max = Math.min(max, range[1]); if (min > max) return false;
  }
  return true;
}
function fixture(width, height) {
  const events = {};
  const window = { innerWidth: width, innerHeight: height, addEventListener(name, callback) { events[name] = callback; } };
  const c = vm.createContext({ window, scene: new Object3D(), bodyMaterial: {}, goldCanopyMaterial: {}, cockpitMat: {}, carbonMaterial: {}, titaniumMaterial: {},
    document: { createElement: () => ({ getContext: () => ({}) }) },
    THREE: { Mesh: Object3D, Group: Object3D, BoxGeometry: Shape, PlaneGeometry: Shape, CylinderGeometry: Cylinder, BufferGeometry: BufferShape,
      Float32BufferAttribute: class { constructor(array) { this.array = array; } }, CanvasTexture: class {}, MeshBasicMaterial: class {} },
  });
  vm.runInContext(vehicles.slice(0, vehicles.indexOf('// 3) Front Fascia')) + '\nthis.parts = { COCKPIT_VIEW, playerWrapper, screenDisplay, screenBezel, dashCowling, yokeWheelGroup, steeringColumn, roadsterBodyMesh, roadsterRockerMesh, roadsterCanopyRails, dashPipe, resizeCockpitDisplay, setCockpitPerspective };', c);
  const p = c.parts; p.playerWrapper.position.set(0, 0, 0); p.setCockpitPerspective(true);
  return { ...p, window, resize(w, h) { window.innerWidth = w; window.innerHeight = h; events.resize(); } };
}
function project(point, view, width, height) {
  const d = subtract(point, vec(0, view.eyeHeight, view.eyeZ)), norm = Math.hypot(view.downwardSlope, 1), t = Math.tan(Math.PI / 6);
  const depth = (-view.downwardSlope * d.y - d.z) / norm;
  return { x: d.x / (depth * t * width / height), y: (d.y - view.downwardSlope * d.z) / norm / (depth * t) };
}
const viewports = [[2048, 1123], [1440, 900], [844, 390], [667, 320], [390, 844], [360, 800], [320, 900]];
test('FPV instrument pod is below the road, fully in frame, and bounded in pixels/phone width across resize', () => {
  const p = fixture(2048, 1123);
  assert.match(physics, /new THREE.Vector3\(0\.0, COCKPIT_VIEW\.eyeHeight, COCKPIT_VIEW\.eyeZ\)/);
  assert.match(physics, /new THREE.Vector3\(0\.0, -COCKPIT_VIEW\.downwardSlope, -1\.0\)/);
  assert.match(physics, /camera\.fov = 60/);
  for (const [width, height] of [...viewports, ...viewports.toReversed()]) {
    p.resize(width, height);
    for (const part of [p.screenDisplay, p.screenBezel]) {
      const corners = [-1, 1].flatMap(x => [-1, 1].map(y => project(localToWorld(vec(x * part.geometry.size[0] / 2, y * part.geometry.size[1] / 2, part.geometry.size[2] / 2), part), p.COCKPIT_VIEW, width, height)));
      const top = (1 - Math.max(...corners.map(c => c.y))) / 2, bottom = (1 - Math.min(...corners.map(c => c.y))) / 2;
      assert.ok(top >= 0.76 && bottom <= 0.99, `${width}×${height}: pod ${top}..${bottom} enters road or clips`);
      assert.ok(Math.max(...corners.map(c => Math.abs(c.x))) <= 0.75, 'pod exceeds phone width budget');
      if (part === p.screenDisplay) assert.ok((bottom - top) * height <= 156.000001);
    }
    assert.ok(p.roadsterCanopyRails.every(rail => !rail.visible));
  }
});
test('all speed, air and passenger readouts clear real generated body triangles, cowling and a fully turned yoke', () => {
  for (const [width, height] of viewports) {
    const p = fixture(width, height), eye = vec(0, p.COCKPIT_VIEW.eyeHeight, p.COCKPIT_VIEW.eyeZ);
    const obstacles = [p.dashCowling, p.steeringColumn, ...p.yokeWheelGroup.children];
    for (let i = 0; i <= 24; i++) {
      p.yokeWheelGroup.rotation.z = -1.009 + 2.018 * i / 24;
      for (const y of [26, 66, 75, 82, 104, 110, 134, 156, 176, 194]) {
        for (const x of [16, 80, 140, 178, 330, 494]) {
          const point = localToWorld(vec((x / 512 - 0.5) * 0.38, (0.5 - y / 200) * 0.23, 0), p.screenDisplay);
          const ndc = project(point, p.COCKPIT_VIEW, width, height);
          assert.ok(Math.abs(ndc.x) < 0.98 && Math.abs(ndc.y) < 0.98, 'essential text clips');
          assert.ok(obstacles.every(mesh => !intersects(eye, point, mesh)), `yoke/cowling covers ${x},${y}`);
          if (i === 0) assert.ok(!intersects(eye, point, p.roadsterBodyMesh), `actual body covers ${x},${y}`);
        }
      }
    }
  }
});
test('central forward road rays stay clear of actual body/rocker/cockpit across all viewport shapes', () => {
  for (const [width, height] of viewports) {
    const p = fixture(width, height), eye = vec(0, p.COCKPIT_VIEW.eyeHeight, p.COCKPIT_VIEW.eyeZ);
    const slope = p.COCKPIT_VIEW.downwardSlope, norm = Math.hypot(1, slope), halfFov = Math.tan(Math.PI / 6);
    const obstacles = [p.roadsterBodyMesh, p.roadsterRockerMesh, p.dashCowling, p.screenBezel, p.screenDisplay, p.steeringColumn, ...p.yokeWheelGroup.children];
    for (const ndcX of [-0.7, -0.35, 0, 0.35, 0.7]) for (const ndcY of [-0.38, -0.1, 0.3, 0.6]) {
      const up = ndcY * 100 * halfFov;
      const target = vec(ndcX * 100 * halfFov * width / height, eye.y + (-slope * 100 + up) / norm, eye.z + (-100 - slope * up) / norm);
      assert.ok(obstacles.every(mesh => !intersects(eye, target, mesh)), `${width}×${height}: road ray ${ndcX},${ndcY} blocked`);
    }
  }
});
test('leaving FPV restores exterior geometry repeatedly; resize does not change that pose', () => {
  const p = fixture(1440, 900);
  assert.match(physics, /setCockpitPerspective\(isCockpitFpv\)/);
  for (let i = 0; i < 4; i++) {
    p.setCockpitPerspective(false); p.resize(390, 844);
    assert.ok(p.roadsterCanopyRails.every(rail => rail.visible)); assert.equal(p.dashPipe.visible, true);
    assert.equal(p.dashCowling.position.y, 0.62); assert.equal(p.yokeWheelGroup.position.y, 0.625); assert.equal(p.steeringColumn.position.y, 0.60);
    assert.equal(p.screenDisplay.position.y, 0.80); assert.equal(p.screenDisplay.position.z, -0.90); assert.equal(p.screenDisplay.rotation.x, -0.26);
    assert.equal(p.screenDisplay.scale.x, Math.min(1, 390 / 844 / 0.65)); assert.equal(p.screenDisplay.scale.x, p.screenDisplay.scale.y);
    p.setCockpitPerspective(true); assert.equal(p.dashPipe.visible, false); assert.equal(p.dashCowling.position.y, 0.50);
  }
});
