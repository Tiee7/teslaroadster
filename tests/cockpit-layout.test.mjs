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
class Object3D {
  constructor(geometry) { this.geometry = geometry; this.position = vec(); this.rotation = vec(); this.scale = vec(1, 1, 1); this.children = []; this.userData = {}; }
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
function intersects(eye, target, mesh) {
  const o = rotate(worldToLocal(eye, mesh), mesh.geometry.rotation, true);
  const end = rotate(worldToLocal(target, mesh), mesh.geometry.rotation, true);
  let min = 0, max = 1 - 1e-7;
  for (const [i, a] of ['x', 'y', 'z'].entries()) {
    const half = mesh.geometry.size[i] / 2, d = end[a] - o[a];
    if (Math.abs(d) < 1e-12) { if (Math.abs(o[a]) > half) return false; continue; }
    const range = [(-half - o[a]) / d, (half - o[a]) / d].sort((a, b) => a - b);
    min = Math.max(min, range[0]); max = Math.min(max, range[1]); if (min > max) return false;
  }
  return true;
}
function fixture(width, height) {
  const window = { innerWidth: width, innerHeight: height, addEventListener() {} };
  const c = vm.createContext({ window, carMeshGroup: new Object3D(), cockpitMat: {}, carbonMaterial: {}, titaniumMaterial: {}, screenGlowMat: {}, hudGlassMat: {},
    THREE: { Mesh: Object3D, Group: Object3D, BoxGeometry: Shape, PlaneGeometry: Shape, CylinderGeometry: Cylinder, MeshBasicMaterial: class {} },
  });
  const start = vehicles.indexOf('const seatBack =');
  vm.runInContext(vehicles.slice(start, vehicles.indexOf('// Interior Ambient LED', start)) + '\nthis.parts = { screenDisplay, screenBezel, dashCowling, yokeWheelGroup, steeringColumn };', c);
  return c.parts;
}

test('FPV bar, speed and passenger strip stay inside desktop/mobile frusta and clear of cowling and fully turned yoke', () => {
  assert.match(physics, /new THREE.Vector3\(0\.0, 0\.88, -0\.15\)/);
  assert.match(physics, /new THREE.Vector3\(0\.0, -0\.04, -1\.0\)/);
  assert.match(physics, /camera\.fov = 60/);
  const eye = vec(0, 0.88, -0.15), norm = Math.hypot(0.04, 1), halfFov = Math.tan(Math.PI / 6);
  for (const [width, height] of [[1440, 900], [844, 390], [390, 844], [360, 800], [320, 900]]) {
    const p = fixture(width, height), scale = Math.min(1, width / height / 0.65);
    assert.equal(p.screenDisplay.scale.x, scale); assert.equal(p.screenDisplay.scale.y, scale);
    const obstacles = [p.dashCowling, p.steeringColumn, ...p.yokeWheelGroup.children];
    for (let i = 0; i <= 24; i++) {
      p.yokeWheelGroup.rotation.z = -1.009 + 2.018 * i / 24;
      for (const y of [26, 42, 62, 86, 120, 134, 154, 174, 198, 224, 237, 248, 263]) {
        for (let x = 16; x <= 496; x += 24) {
          const point = localToWorld(vec((x / 512 - 0.5) * 0.38, (0.5 - y / 320) * 0.23, 0), p.screenDisplay);
          const d = { x: point.x, y: point.y - eye.y, z: point.z - eye.z };
          const depth = (-0.04 * d.y - d.z) / norm;
          const ndcX = d.x / (depth * halfFov * width / height), ndcY = (d.y - 0.04 * d.z) / norm / (depth * halfFov);
          assert.ok(Math.abs(ndcX) < 0.98 && Math.abs(ndcY) < 0.98, `${width}×${height}: ${x},${y} clipped`);
          assert.ok(obstacles.every(mesh => !intersects(eye, point, mesh)), `${width}×${height}: ${x},${y} occluded at yoke ${p.yokeWheelGroup.rotation.z}`);
        }
      }
    }
  }
});
