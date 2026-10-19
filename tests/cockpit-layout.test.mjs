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
  constructor(width, height, depth = 0) {
    this.size = [width, height, depth]; this.rotation = vec();
    this.vertices = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].flatMap(z => [x * width / 2, y * height / 2, z * depth / 2])));
    this.indices = [0, 1, 3, 0, 3, 2, 4, 6, 7, 4, 7, 5, 0, 4, 5, 0, 5, 1, 2, 3, 7, 2, 7, 6, 0, 2, 6, 0, 6, 4, 1, 5, 7, 1, 7, 3];
  }
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
class Cylinder extends Shape {
  constructor(top, bottom, height, segments = 16) {
    super(2 * Math.max(top, bottom), height, 2 * Math.max(top, bottom));
    this.vertices = []; this.indices = [];
    for (let i = 0; i < segments; i++) {
      const a = i * 2 * Math.PI / segments;
      this.vertices.push(Math.sin(a) * bottom, -height / 2, Math.cos(a) * bottom, Math.sin(a) * top, height / 2, Math.cos(a) * top);
    }
    for (let i = 0; i < segments; i++) {
      const a = 2 * i, b = 2 * ((i + 1) % segments);
      this.indices.push(a, b, b + 1, a, b + 1, a + 1);
      if (i > 0 && i < segments - 1) this.indices.push(0, b, a, 1, a + 1, b + 1);
    }
  }
}
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
const geometryBounds = new WeakMap();
function intersects(eye, target, mesh) {
  if (mesh.visible === false) return false;
  const o = rotate(worldToLocal(eye, mesh), mesh.geometry.rotation, true);
  const end = rotate(worldToLocal(target, mesh), mesh.geometry.rotation, true);
  const direction = subtract(end, o), g = mesh.geometry;
  let box = geometryBounds.get(g);
  if (!box) {
    box = { x: [Infinity, -Infinity], y: [Infinity, -Infinity], z: [Infinity, -Infinity] };
    for (let i = 0; i < g.vertices.length; i++) {
      const range = box[['x', 'y', 'z'][i % 3]];
      range[0] = Math.min(range[0], g.vertices[i]); range[1] = Math.max(range[1], g.vertices[i]);
    }
    geometryBounds.set(g, box);
  }
  let near = 0, far = 1 - 1e-7;
  for (const axis of ['x', 'y', 'z']) {
    if (Math.abs(direction[axis]) < 1e-12) {
      if (o[axis] < box[axis][0] || o[axis] > box[axis][1]) return false;
      continue;
    }
    const a = (box[axis][0] - o[axis]) / direction[axis], b = (box[axis][1] - o[axis]) / direction[axis];
    near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
    if (near > far) return false;
  }
  // Exact Moller-Trumbore intersections after a broad-phase box rejection.
  // Primitive fixtures carry the same box/plane/cylinder triangles as THREE,
  // and the body uses the production generated positions and index buffer.
  const v = g.vertices, indices = g.indices, d = direction;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const e1x = v[b] - v[a], e1y = v[b + 1] - v[a + 1], e1z = v[b + 2] - v[a + 2];
    const e2x = v[c] - v[a], e2y = v[c + 1] - v[a + 1], e2z = v[c + 2] - v[a + 2];
    const hx = d.y * e2z - d.z * e2y, hy = d.z * e2x - d.x * e2z, hz = d.x * e2y - d.y * e2x;
    const determinant = e1x * hx + e1y * hy + e1z * hz;
    if (Math.abs(determinant) < 1e-12) continue;
    const sx = o.x - v[a], sy = o.y - v[a + 1], sz = o.z - v[a + 2];
    const u = (sx * hx + sy * hy + sz * hz) / determinant;
    if (u < 0 || u > 1) continue;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
    const baryV = (d.x * qx + d.y * qy + d.z * qz) / determinant;
    if (baryV < 0 || u + baryV > 1) continue;
    const t = (e2x * qx + e2y * qy + e2z * qz) / determinant;
    if (t >= 0 && t < 1 - 1e-7) return true;
  }
  return false;
}
function fixture(width, height) {
  const events = {};
  const window = { innerWidth: width, innerHeight: height, addEventListener(name, callback) { events[name] = callback; } };
  const c = vm.createContext({ window, scene: new Object3D(), bodyMaterial: {}, goldCanopyMaterial: {}, cockpitMat: {}, carbonMaterial: {}, titaniumMaterial: {},
    document: { createElement: () => ({ getContext: () => ({}) }) },
    THREE: { Mesh: Object3D, Group: Object3D, BoxGeometry: Shape, PlaneGeometry: Shape, CylinderGeometry: Cylinder, BufferGeometry: BufferShape,
      Float32BufferAttribute: class { constructor(array) { this.array = array; } }, CanvasTexture: class {}, MeshBasicMaterial: class {} },
  });
  vm.runInContext(vehicles.slice(0, vehicles.indexOf('// 3) Front Fascia')) + '\nthis.parts = { COCKPIT_VIEW, playerWrapper, yokeHub, yokeBottomBar, yokeShiftLeds, screenDisplay, screenBezel, dashCowling, yokeWheelGroup, steeringColumn, roadsterBodyMesh, roadsterRockerMesh, roadsterCanopyRails, dashPipe, resizeCockpitDisplay, setCockpitPerspective };', c);
  const p = c.parts; p.playerWrapper.position.set(0, 0, 0); p.setCockpitPerspective(true);
  return { ...p, window, resize(w, h) { window.innerWidth = w; window.innerHeight = h; events.resize(); } };
}
function project(point, view, width, height) {
  const d = subtract(point, vec(0, view.eyeHeight, view.eyeZ)), norm = Math.hypot(view.downwardSlope, 1), t = Math.tan(Math.PI / 6);
  const depth = (-view.downwardSlope * d.y - d.z) / norm;
  return { x: d.x / (depth * t * width / height), y: (d.y - view.downwardSlope * d.z) / norm / (depth * t), depth };
}
const viewports = [[2048, 1123], [1440, 900], [844, 390], [667, 320], [1024, 1024], [780, 900], [390, 844], [360, 800], [320, 900]];
const steeringAngles = Array.from({ length: 49 }, (_, i) => -1.009 + 2.018 * i / 48);
function projectedVertices(part, p, width, height) {
  const out = [];
  for (let i = 0; i < part.geometry.vertices.length; i += 3) {
    const v = rotate(vec(...part.geometry.vertices.slice(i, i + 3)), part.geometry.rotation);
    out.push(project(localToWorld(v, part), p.COCKPIT_VIEW, width, height));
  }
  return out;
}
function bounds(points) {
  return {
    left: (1 + Math.min(...points.map(c => c.x))) / 2,
    right: (1 + Math.max(...points.map(c => c.x))) / 2,
    top: (1 - Math.max(...points.map(c => c.y))) / 2,
    bottom: (1 - Math.min(...points.map(c => c.y))) / 2
  };
}
test('FPV instrument pod shifts left, stays below the road and remains fully in frame across resize', () => {
  const p = fixture(2048, 1123);
  assert.match(physics, /new THREE.Vector3\(0\.0, COCKPIT_VIEW\.eyeHeight, COCKPIT_VIEW\.eyeZ\)/);
  assert.match(physics, /new THREE.Vector3\(0\.0, -COCKPIT_VIEW\.downwardSlope, -1\.0\)/);
  assert.match(physics, /camera\.fov = 60/);
  for (const [width, height] of [...viewports, ...viewports.toReversed()]) {
    p.resize(width, height);
    for (const part of [p.screenDisplay, p.screenBezel]) {
      const corners = [-1, 1].flatMap(x => [-1, 1].map(y => project(localToWorld(vec(x * part.geometry.size[0] / 2, y * part.geometry.size[1] / 2, part.geometry.size[2] / 2), part), p.COCKPIT_VIEW, width, height)));
      const top = (1 - Math.max(...corners.map(c => c.y))) / 2, bottom = (1 - Math.min(...corners.map(c => c.y))) / 2;
      const box = bounds(corners);
      assert.ok(top >= 0.71 && bottom <= 0.99, `${width}×${height}: pod ${top}..${bottom} enters road or clips`);
      assert.ok(box.left >= 0.02 && box.right <= 0.69, `${width}×${height}: left pod clips or takes wheel space`);
      assert.ok((box.left + box.right) / 2 <= 0.36, 'instruments must visibly move left of the driver center');
      assert.ok(box.right - box.left <= 0.66, 'pod exceeds phone width budget');
      if (part === p.screenDisplay) {
        assert.ok((bottom - top) * height <= 156.000001);
        assert.ok(Math.abs((box.right - box.left) * width / ((bottom - top) * height) - 512 / 200) < 1e-9, 'live HUD texture must preserve its complete aspect ratio');
      }
    }
    assert.ok(p.roadsterCanopyRails.every(rail => !rail.visible));
  }
});
test('all speed, air and passenger readouts clear real generated body triangles, cowling and a fully turned yoke', () => {
  for (const [width, height] of viewports) {
    const p = fixture(width, height), eye = vec(0, p.COCKPIT_VIEW.eyeHeight, p.COCKPIT_VIEW.eyeZ);
    const obstacles = [p.dashCowling, p.steeringColumn, ...p.yokeWheelGroup.children];
    for (const [i, angle] of steeringAngles.entries()) {
      p.yokeWheelGroup.rotation.z = angle;
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
    // Body is static for steering. Test its real triangles once, and every
    // cockpit primitive's triangles at each angle, rather than only at neutral.
    for (const [i, angle] of steeringAngles.entries()) {
      p.yokeWheelGroup.rotation.z = angle;
      const tested = i === 0 ? obstacles : obstacles.slice(2);
      for (const ndcX of [-0.7, -0.35, 0, 0.35, 0.7]) for (const ndcY of [-0.38, -0.1, 0.3, 0.6]) {
      const up = ndcY * 100 * halfFov;
      const target = vec(ndcX * 100 * halfFov * width / height, eye.y + (-slope * 100 + up) / norm, eye.z + (-100 - slope * up) / norm);
      assert.ok(tested.every(mesh => !intersects(eye, target, mesh)), `${width}×${height}: road ray ${ndcX},${ndcY} blocked at ${angle}`);
      }
    }
  }
});
test('the original 3D yoke is visibly in frame, centered below the road and clear of the left instruments at every steering angle', () => {
  assert.match(physics, /targetYokeRot = state\.steerAngle \* 1\.55 - \(isAirborne \? rollInput \* 0\.42 : 0\)/);
  assert.match(physics, /yokeWheelGroup\.rotation\.z \+=/);
  for (const [width, height] of viewports) {
    const p = fixture(width, height), eye = vec(0, p.COCKPIT_VIEW.eyeHeight, p.COCKPIT_VIEW.eyeZ);
    assert.ok(p.yokeWheelGroup.visible && p.yokeWheelGroup.children.every(part => part.visible), 'restored wheel must actually render');
    assert.equal(p.yokeWheelGroup.children.length, 18, 'retain hub, grips, rollers, horn tips, bridge, spokes, badge and seven LEDs');
    assert.equal(p.yokeShiftLeds.length, 7);
    assert.equal(p.yokeWheelGroup.rotation.x, -0.20, 'retain the original driver-facing yoke tilt');
    const pod = bounds(projectedVertices(p.screenBezel, p, width, height));
    for (const angle of steeringAngles) {
      p.yokeWheelGroup.rotation.z = angle;
      const projected = p.yokeWheelGroup.children.flatMap(part => projectedVertices(part, p, width, height));
      const box = bounds(projected);
      assert.ok(projected.every(c => c.depth > 0.08), 'restored yoke crosses the cockpit near plane');
      assert.ok(box.left >= 0.02 && box.right <= 0.98 && box.top >= 0.70 && box.bottom <= 0.99, `${width}×${height}: yoke ${JSON.stringify(box)} clips or blocks road at ${angle}`);
      assert.ok(box.bottom - box.top >= Math.min(0.06, width / height * 0.13), 'wheel must occupy a tangible visible height');
      assert.ok(box.right - box.left >= Math.min(0.045, height / width * 0.09), 'wheel must occupy a tangible visible width');
      assert.ok(pod.right + 0.01 < box.left || pod.bottom + 0.002 < box.top, `${width}×${height}: display and turned wheel overlap`);
      // The front faces of the center hub and both grips must actually be
      // visible through the production shell, not merely project into frame.
      for (const part of [p.yokeHub, p.yokeWheelGroup.children[0], p.yokeWheelGroup.children[3]]) {
        const face = localToWorld(vec(0, 0, part.geometry.size[2] / 2), part);
        for (const obstacle of [p.roadsterBodyMesh, p.roadsterRockerMesh, p.dashCowling, p.screenDisplay, p.screenBezel]) {
          assert.ok(!intersects(eye, face, obstacle), `${width}×${height}: restored yoke is hidden behind another surface at ${angle}`);
        }
      }
    }
  }
});
test('leaving FPV restores exterior geometry repeatedly; resize does not change that pose', () => {
  const p = fixture(1440, 900);
  assert.match(physics, /setCockpitPerspective\(isCockpitFpv\)/);
  for (let i = 0; i < 4; i++) {
    const steer = i % 2 ? -1.009 : 1.009; p.yokeWheelGroup.rotation.z = steer;
    p.setCockpitPerspective(false); p.resize(390, 844);
    assert.ok(p.roadsterCanopyRails.every(rail => rail.visible)); assert.equal(p.dashPipe.visible, true);
    assert.equal(p.dashCowling.position.y, 0.62); assert.equal(p.yokeWheelGroup.position.y, 0.625); assert.equal(p.steeringColumn.position.y, 0.60);
    assert.equal(p.yokeWheelGroup.position.x, 0); assert.equal(p.yokeWheelGroup.position.z, -0.46);
    assert.equal(p.steeringColumn.position.x, 0); assert.equal(p.steeringColumn.position.z, -0.58);
    assert.equal(p.yokeWheelGroup.scale.x, 1); assert.equal(p.steeringColumn.scale.x, 1);
    assert.equal(p.screenDisplay.position.x, 0);
    assert.equal(p.screenDisplay.position.y, 0.80); assert.equal(p.screenDisplay.position.z, -0.90); assert.equal(p.screenDisplay.rotation.x, -0.26);
    assert.equal(p.screenDisplay.scale.x, Math.min(1, 390 / 844 / 0.65)); assert.equal(p.screenDisplay.scale.x, p.screenDisplay.scale.y);
    p.setCockpitPerspective(true); assert.equal(p.dashPipe.visible, false); assert.equal(p.dashCowling.position.y, 0.50);
    p.resize(844, 390); assert.equal(p.yokeWheelGroup.rotation.z, steer, 'responsive poses must not reset live steering');
  }
});
