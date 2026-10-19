import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/vehicles.js', import.meta.url), 'utf8');
const world = readFileSync(new URL('../src/world.js', import.meta.url), 'utf8');
const hud = readFileSync(new URL('../src/ui-hud.js', import.meta.url), 'utf8');
const vec = () => ({ set() {}, order: '' });
class Object3D {
  constructor(geometry) { this.geometry = geometry; this.position = vec(); this.rotation = vec(); this.children = []; }
  add(...objects) { this.children.push(...objects); }
}
class Geometry {
  constructor() { this.attributes = {}; }
  setAttribute(name, attribute) { this.attributes[name] = attribute.array; }
  setIndex(indices) { this.indices = indices; }
  computeVertexNormals() {}
}
const context = vm.createContext({
  scene: new Object3D(), bodyMaterial: {}, goldCanopyMaterial: {}, carbonMaterial: {},
  THREE: { Group: Object3D, Mesh: Object3D, BufferGeometry: Geometry, Float32BufferAttribute: class { constructor(array) { this.array = array; } } },
});
vm.runInContext(source.slice(0, source.indexOf('// FULL-FEATURED FIRST-PERSON')) + `
this.surface = { sampleStationProfile, smoothCrossSection, createSmoothGridGeometry, cyberWedgeStations, cyberCanopyStations,
  roadsterBodyMesh, roadsterCanopyMesh, roadsterCanopyRails, wheelArchOpeningY };
`, context);
const s = context.surface;
const derivative = (stations, z, key, direction) => {
  const h = 1e-6;
  return direction === 'left' ? (s.sampleStationProfile(stations, z)[key] - s.sampleStationProfile(stations, z - h)[key]) / h
    : (s.sampleStationProfile(stations, z + h)[key] - s.sampleStationProfile(stations, z)[key]) / h;
};

test('shared station tangents reproduce a straight loft without flat spots and stay C1 at keys', () => {
  const linear = [{ z: 0, y: 2 }, { z: 0.2, y: 2.6 }, { z: 0.7, y: 4.1 }, { z: 2, y: 8 }];
  for (let z = 0; z <= 2; z += 0.013) assert.ok(Math.abs(s.sampleStationProfile(linear, z).y - (2 + 3 * z)) < 1e-12);
  for (const stations of [s.cyberWedgeStations, s.cyberCanopyStations]) {
    for (const st of stations.slice(1, -1)) for (const key of Object.keys(st).filter(k => k !== 'z')) {
      const left = derivative(stations, st.z, key, 'left'), right = derivative(stations, st.z, key, 'right');
      assert.ok(Math.abs(left - right) < 0.0001, `${key}@${st.z}: ${left} ≠ ${right}`);
    }
  }
  const speed = derivative(s.cyberWedgeStations, -2.04, 'centerY', 'right');
  assert.ok(speed > 0.2, 'hood must pass through a rising station rather than flatten to zero slope');
});

test('shape-preserving station loft retains every landmark and never overshoots any interval', () => {
  for (const stations of [s.cyberWedgeStations, s.cyberCanopyStations]) {
    for (const st of stations) for (const key of Object.keys(st)) assert.ok(Math.abs(s.sampleStationProfile(stations, st.z)[key] - st[key]) < 1e-12);
    for (let i = 0; i < stations.length - 1; i++) for (let j = 0; j <= 40; j++) {
      const a = stations[i], b = stations[i + 1], p = s.sampleStationProfile(stations, a.z + (b.z - a.z) * j / 40);
      for (const key of Object.keys(a)) assert.ok(p[key] >= Math.min(a[key], b[key]) - 1e-12 && p[key] <= Math.max(a[key], b[key]) + 1e-12, `${key} overshoots contour`);
    }
  }
});

test('cross sections are curved, symmetric and preserve all sculpting anchors', () => {
  const row = [[-2, 0, 5], [-1, 0.8, 5], [0, 1, 5], [1, 0.8, 5], [2, 0, 5]];
  const curve = s.smoothCrossSection(row);
  assert.equal(curve.length, 17);
  for (let i = 0; i < row.length; i++) for (let k = 0; k < 3; k++) assert.equal(curve[i * 4][k], row[i][k]);
  assert.ok(curve[2][1] > 0.4, 'new vertices follow a curved contour, not the old planar segment');
  for (let i = 0; i < curve.length; i++) {
    assert.ok(Math.abs(curve[i][0] + curve.at(-i - 1)[0]) < 1e-12);
    assert.ok(Math.abs(curve[i][1] - curve.at(-i - 1)[1]) < 1e-12);
    assert.equal(curve[i][2], 5);
  }
});

test('actual body/canopy meshes carry finite unit mirrored tangent normals with upward crowns', () => {
  for (const [mesh, rows, columns] of [[s.roadsterBodyMesh, 161, 81], [s.roadsterCanopyMesh, 73, 41]]) {
    const { position, normal } = mesh.geometry.attributes;
    assert.equal(position.length, rows * columns * 3); assert.equal(normal.length, position.length);
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const i = 3 * (row * columns + column), other = 3 * (row * columns + columns - column - 1);
      assert.ok(Math.abs(Math.hypot(...normal.slice(i, i + 3)) - 1) < 1e-12);
      assert.ok(Math.abs(normal[i] + normal[other]) < 1e-11);
      assert.ok(Math.abs(normal[i + 1] - normal[other + 1]) < 1e-11);
      assert.ok(Math.abs(normal[i + 2] - normal[other + 2]) < 1e-11);
      if (column === (columns - 1) / 2) assert.ok(normal[i + 1] > 0, 'top crown winding must face upward');
    }
  }
});

test('wheel arch cut and exterior dimensions remain exact after curved tessellation', () => {
  const positions = s.roadsterBodyMesh.geometry.attributes.position;
  for (let row = 0; row < 161; row++) {
    const first = row * 81 * 3, last = first + 80 * 3, z = positions[first + 2];
    const st = s.sampleStationProfile(s.cyberWedgeStations, z), arch = s.wheelArchOpeningY(z);
    assert.ok(Math.abs(positions[first] + st.flankX * 0.96) < 1e-12);
    assert.ok(Math.abs(positions[last] - st.flankX * 0.96) < 1e-12);
    assert.equal(positions[first + 1], Math.max(st.rockerY, arch));
    assert.equal(positions[last + 1], Math.max(st.rockerY, arch));
  }
  assert.match(source, /cabinRecess = 0\.24 \* Math\.sin\(tCab \* Math\.PI\) \*\* 2/);
  assert.match(source, /const st = sampleStationProfile\(cyberCanopyStations, z\);[\s\S]*?const rx = side/);
});

test('vehicle-only reflection softening survives paint changes while all preset finishes remain distinct', () => {
  assert.match(world, /const bodyMaterial = [\s\S]*?clearcoatRoughness: 0\.16,[\s\S]*?envMapIntensity: 1\.2,/);
  assert.match(hud, /bodyMaterial\.roughness = preset\.roughness/);
  assert.match(hud, /bodyMaterial\.clearcoatRoughness = 0\.16/);
  assert.doesNotMatch(hud, /bodyMaterial\.clearcoatRoughness = 0\.03/);
});
