import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/vehicles.js', import.meta.url), 'utf8');
const vector = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { Object.assign(this, { x, y, z }); } });
class Object3D {
  constructor(geometry, material) { this.geometry = geometry; this.material = material; this.position = vector(); this.rotation = vector(); this.children = []; this.userData = {}; }
  add(...objects) { this.children.push(...objects); }
}
class Attribute {
  constructor(array, itemSize) { this.array = new Float32Array(array); this.itemSize = itemSize; this.count = this.array.length / itemSize; }
}
class Geometry {
  constructor() { this.attributes = {}; }
  setAttribute(name, attribute) { this.attributes[name] = attribute; }
  setIndex(array) { this.index = { array: Uint16Array.from(array) }; }
  computeVertexNormals() {
    const p = this.attributes.position.array, n = new Float32Array(p.length), idx = this.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const [a, b, c] = [...idx.slice(i, i + 3)].map(index => index * 3);
      const u = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]];
      const v = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
      const normal = cross(u, v);
      for (const at of [a, b, c]) for (let j = 0; j < 3; j++) n[at + j] += normal[j];
    }
    for (let i = 0; i < n.length; i += 3) { const length = Math.hypot(...n.slice(i, i + 3)); for (let j = 0; j < 3; j++) n[i + j] /= length || 1; }
    this.setAttribute('normal', new Attribute(n, 3));
  }
}
class Primitive {
  constructor(...parameters) { this.parameters = parameters; }
  rotateZ() { return this; }
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const subtract = (a, b) => a.map((value, i) => value - b[i]);
const context = vm.createContext({
  carbonMaterial: {}, cockpitMat: {}, titaniumMaterial: {}, tireMat: {}, darkSpokeMat: {}, alloyRimMat: {}, caliperMat: {},
  THREE: { Group: Object3D, Mesh: Object3D, BufferGeometry: Geometry, Float32BufferAttribute: Attribute,
    BoxGeometry: Primitive, CylinderGeometry: Primitive, DoubleSide: 2,
    MeshPhysicalMaterial: class { constructor(parameters) { Object.assign(this, parameters); } },
    MeshBasicMaterial: class { constructor(parameters) { Object.assign(this, parameters); } } },
});
vm.runInContext(source.slice(source.indexOf('function lerpVal'), source.indexOf('// 1) Smooth, shape-preserving')), context);
vm.runInContext(`
this.originalLofts = [];
const originalGridGeometry = createSmoothGridGeometry;
createSmoothGridGeometry = function (rows) {
  const geometry = originalGridGeometry(rows);
  originalLofts.push({ rows, position: Array.from(geometry.attributes.position.array), normal: Array.from(geometry.attributes.normal.array), index: Array.from(geometry.index.array) });
  return geometry;
};
`, context);
vm.runInContext(source.slice(source.indexOf('const trafficPalette'), source.indexOf('function populateTraffic')) + `
this.traffic = { legacySupercarBodyGeo, legacySupercarCanopyGeo, sharedTrafficPaintMats,
  sharedTrafficDiffuserBackingGeo, sharedTrafficDiffuserFinGeo, sharedTrafficUndertrayGeo, sharedTrafficTaillightGeo, createTrafficVehicleMesh };
`, context);
const t = context.traffic, original = context.originalLofts[0], body = t.legacySupercarBodyGeo;
const points = Array.from(body.attributes.position.array, (value) => value);
const vertex = (index) => points.slice(index * 3, index * 3 + 3);
const shellCount = original.position.length / 3, shellIndexCount = original.index.length, rowLength = original.rows[0].length;
const capTriangles = (rear) => {
  const start = shellIndexCount + (rear ? rowLength - 1 : 0) * 3;
  const indices = body.index.array.slice(start, start + (rowLength - 1) * 3);
  const triangles = [];
  for (let i = 0; i < indices.length; i += 3) triangles.push([...indices.slice(i, i + 3)].map(vertex));
  return triangles;
};
function rayTriangle(origin, direction, [a, b, c]) {
  const e1 = subtract(b, a), e2 = subtract(c, a), h = cross(direction, e2), det = dot(e1, h);
  if (Math.abs(det) < 1e-9) return false;
  const s = subtract(origin, a), u = dot(s, h) / det;
  if (u < -1e-7 || u > 1 + 1e-7) return false;
  const q = cross(s, e1), v = dot(direction, q) / det;
  return v >= -1e-7 && u + v <= 1 + 1e-7 && dot(e2, q) / det >= 0;
}
function insidePolygon(x, y, row) {
  let inside = false;
  for (let i = 0, j = row.length - 1; i < row.length; j = i++) {
    const [xi, yi] = row[i], [xj, yj] = row[j];
    if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function rayBox(origin, direction, mesh) {
  const { x, y, z } = mesh.position, [w, h, d] = mesh.geometry.parameters;
  const min = [x - w / 2, y - h / 2, z - d / 2], max = [x + w / 2, y + h / 2, z + d / 2];
  let near = 0, far = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(direction[i]) < 1e-9) { if (origin[i] < min[i] || origin[i] > max[i]) return false; }
    else { const a = (min[i] - origin[i]) / direction[i], b = (max[i] - origin[i]) / direction[i]; near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b)); }
  }
  return near <= far;
}

test('traffic caps keep the existing sculpted shell, wheel cuts, bounds and shading intact', () => {
  assert.deepEqual(points.slice(0, original.position.length), Array.from(original.position));
  assert.deepEqual(Array.from(body.attributes.normal.array).slice(0, original.normal.length), Array.from(original.normal));
  assert.deepEqual(Array.from(body.index.array).slice(0, shellIndexCount), Array.from(original.index));
  assert.equal(body.attributes.position.count, shellCount + 2 * (rowLength + 1));
  assert.equal(body.index.array.length, shellIndexCount + 2 * (rowLength - 1) * 3);
  for (const rear of [false, true]) {
    const row = rear ? original.rows.at(-1) : original.rows[0], base = shellCount + (rear ? rowLength + 1 : 0);
    for (let i = 0; i < rowLength; i++) assert.deepEqual(vertex(base + i + 1), Array.from(row[i], Math.fround));
  }
});

test('front and rear traffic caps are finite, nondegenerate, outward-facing and flat-shaded', () => {
  for (const rear of [false, true]) {
    const sign = rear ? 1 : -1, base = shellCount + (rear ? rowLength + 1 : 0);
    for (let i = 0; i <= rowLength; i++) assert.deepEqual(Array.from(body.attributes.normal.array.slice((base + i) * 3, (base + i + 1) * 3)), [0, 0, sign]);
    for (const [a, b, c] of capTriangles(rear)) {
      assert.ok([...a, ...b, ...c].every(Number.isFinite));
      const n = cross(subtract(b, a), subtract(c, a));
      assert.ok(sign * n[2] > 1e-8, 'end cap must not fold, overlap or face the interior');
      assert.ok(n[0] === 0 && n[1] === 0);
    }
  }
});

test('every interior pixel sample of both end silhouettes is blocked by the production cap triangles', () => {
  for (const rear of [false, true]) {
    const row = rear ? original.rows.at(-1) : original.rows[0], triangles = capTriangles(rear), sign = rear ? 1 : -1;
    let samples = 0;
    for (let x = -1.1; x < 1.1; x += 0.013) for (let y = 0.12; y < 0.9; y += 0.011) {
      if (!insidePolygon(x, y, row)) continue;
      samples++;
      assert.ok(triangles.some(triangle => rayTriangle([x, y, row[0][2] + sign * 5], [0, 0, -sign], triangle)), `open ${rear ? 'rear' : 'front'} at ${x}, ${y}`);
    }
    assert.ok(samples > 1000);
    const polygonArea = Math.abs(row.reduce((sum, point, i) => { const next = row[(i + 1) % row.length]; return sum + point[0] * next[1] - next[0] * point[1]; }, 0)) / 2;
    const triangleArea = triangles.reduce((sum, [a, b, c]) => sum + Math.hypot(...cross(subtract(b, a), subtract(c, a))) / 2, 0);
    assert.ok(Math.abs(polygonArea - triangleArea) < 1e-7, 'triangulation must match the exact shell outline');
  }
});

test('all traffic colors share opaque capped bodies and a backed diffuser, preserving wheels and lights', () => {
  let sharedBody;
  for (let color = 0; color < t.sharedTrafficPaintMats.length * 2; color++) {
    const vehicle = t.createTrafficVehicleMesh(color), bodyMesh = vehicle.children.find(mesh => mesh.geometry === body);
    assert.ok(bodyMesh); sharedBody ??= bodyMesh.geometry; assert.equal(bodyMesh.geometry, sharedBody);
    assert.equal(bodyMesh.material, t.sharedTrafficPaintMats[color % t.sharedTrafficPaintMats.length]);
    assert.notEqual(bodyMesh.material.transparent, true);
    assert.equal(vehicle.userData.wheels.length, 4); assert.equal(vehicle.userData.length, 4.62); assert.equal(vehicle.userData.height, 1.25);
    assert.equal(vehicle.children.filter(mesh => mesh.geometry === t.sharedTrafficDiffuserFinGeo).length, 5);
    assert.equal(vehicle.children.filter(mesh => mesh.geometry === t.sharedTrafficTaillightGeo).length, 1);
    const backing = vehicle.children.find(mesh => mesh.geometry === t.sharedTrafficDiffuserBackingGeo);
    const tray = vehicle.children.find(mesh => mesh.geometry === t.sharedTrafficUndertrayGeo);
    assert.ok(backing);
    assert.ok(backing.position.y + backing.geometry.parameters[1] / 2 > original.rows.at(-1)[0][1]);
    assert.ok(backing.position.y - backing.geometry.parameters[1] / 2 < tray.position.y + tray.geometry.parameters[1] / 2);
    assert.ok(backing.position.z - backing.geometry.parameters[2] / 2 < tray.position.z + tray.geometry.parameters[2] / 2);
  }
});

test('rear panel and lower diffuser block wheel/road sightlines from following and three-quarter views', () => {
  const vehicle = t.createTrafficVehicleMesh(7), backing = vehicle.children.find(mesh => mesh.geometry === t.sharedTrafficDiffuserBackingGeo);
  for (const degrees of [-50, -30, 0, 30, 50]) {
    const angle = degrees * Math.PI / 180, origin = [Math.sin(angle) * 5, 1.12, 2.28 + Math.cos(angle) * 5];
    for (let x = -0.72; x <= 0.72; x += 0.06) for (let y = 0.18; y <= 0.65; y += 0.025) {
      const direction = subtract([x, y, 2.28], origin);
      assert.ok(capTriangles(true).some(triangle => rayTriangle(origin, direction, triangle)) || rayBox(origin, direction, backing), `visible hole from ${degrees}° at ${x}, ${y}`);
    }
  }
});
