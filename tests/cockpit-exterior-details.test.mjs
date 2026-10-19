import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/vehicles.js', import.meta.url), 'utf8');
const physics = readFileSync(new URL('../src/physics-main.js', import.meta.url), 'utf8');
const vector = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { Object.assign(this, { x, y, z }); }, setScalar(n) { this.set(n, n, n); } });
class Object3D {
  constructor(geometry, material) { this.geometry = geometry; this.material = material; this.children = []; this.position = vector(); this.rotation = vector(); this.scale = vector(); this.visible = true; this.userData = {}; }
  add(...parts) { parts.forEach(part => { part.parent = this; this.children.push(part); }); }
}
class Geometry {
  constructor(...parameters) { this.parameters = parameters; this.attributes = {}; this.groups = []; }
  clearGroups() { this.groups = []; }
  addGroup(start, count, materialIndex) { this.groups.push({ start, count, materialIndex }); }
  rotateX() { return this; } rotateZ() { return this; }
  setAttribute(name, attribute) { this.attributes[name] = attribute.array; }
  setIndex(indices) { this.indices = indices; }
  computeVertexNormals() {}
}
class Material { constructor(properties) { Object.assign(this, properties); } }
function fixture() {
  const c = vm.createContext({
    window: { innerWidth: 2048, innerHeight: 1163, addEventListener() {} }, scene: new Object3D(),
    bodyMaterial: {}, goldCanopyMaterial: {}, cockpitMat: {}, carbonMaterial: {}, titaniumMaterial: {},
    document: { createElement: () => ({ getContext: () => ({}) }) },
    THREE: { Group: Object3D, Mesh: Object3D, Object3D, SpotLight: Object3D,
      BufferGeometry: Geometry, BoxGeometry: Geometry, PlaneGeometry: Geometry, CylinderGeometry: Geometry, SphereGeometry: Geometry,
      Float32BufferAttribute: class { constructor(array) { this.array = array; } },
      CanvasTexture: class {}, MeshBasicMaterial: Material, MeshStandardMaterial: Material, FrontSide: 0, DoubleSide: 2 },
  });
  vm.runInContext(source.slice(0, source.indexOf('// Active Rear Spoiler Group')) + `
this.parts = { cockpitExteriorDetailMeshes, setCockpitExteriorDetailsVisible, ledPureWhiteMat, ledHousingMat,
  centerLightBar, headlightSpotL, headlightSpotR, headlightTargetL, headlightTargetR, carMeshGroup, frontTurnSignalL, frontTurnSignalR };
`, c);
  return c.parts;
}

test('front lens triangles face the road without duplicate glowing backfaces', () => {
  const p = fixture();
  const lensQuads = p.cockpitExteriorDetailMeshes.filter(mesh => mesh.material === p.ledPureWhiteMat);
  assert.equal(lensQuads.length, 2);
  assert.equal(p.ledPureWhiteMat.side, 0);
  for (const mesh of lensQuads) {
    assert.equal(mesh.geometry.indices.length, 6, 'a lens must not contain the reverse duplicate panel triangles');
    const positions = mesh.geometry.attributes.position;
    for (let i = 0; i < 6; i += 3) {
      const [a, b, c] = mesh.geometry.indices.slice(i, i + 3).map(index => positions.slice(index * 3, index * 3 + 3));
      const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      assert.ok(nz < 0, 'both mirrored headlights must emit forward (-Z), away from the driver');
    }
  }
});

test('LED boxes have opaque non-emissive rear housings and only their front face emits', () => {
  const p = fixture();
  const boxes = new Set([p.centerLightBar]);
  for (const part of p.cockpitExteriorDetailMeshes) {
    if (Array.isArray(part.material)) boxes.add(part);
    for (const child of part.children) if (Array.isArray(child.material)) boxes.add(child);
  }
  assert.equal(boxes.size, 13, 'center bar, both eyebrows and ten crystal projectors must all be directional');
  for (const mesh of boxes) {
    assert.equal(mesh.material.length, 6);
    assert.ok(mesh.material.slice(0, 5).every(material => material === p.ledHousingMat));
    assert.notEqual(mesh.material[5], p.ledHousingMat);
    assert.equal(mesh.material[4], p.ledHousingMat, 'driver-facing +Z rear must stay dark');
    assert.deepEqual(JSON.parse(JSON.stringify(mesh.geometry.groups)), [
      { start: 0, count: 30, materialIndex: 0 }, { start: 30, count: 6, materialIndex: 5 }
    ], 'five housing faces and one lens need only two draw groups');
  }
});

test('cockpit excludes exposed exterior lamp/vent backs but keeps real road lighting and restores all outside views', () => {
  const p = fixture();
  assert.ok(p.cockpitExteriorDetailMeshes.length >= 23);
  assert.ok(p.cockpitExteriorDetailMeshes.includes(p.frontTurnSignalL));
  assert.ok(p.cockpitExteriorDetailMeshes.includes(p.frontTurnSignalR));
  for (const light of [p.headlightSpotL, p.headlightSpotR, p.headlightTargetL, p.headlightTargetR]) {
    assert.ok(!p.cockpitExteriorDetailMeshes.includes(light));
    assert.equal(light.parent, p.carMeshGroup);
  }
  for (let i = 0; i < 4; i++) {
    p.setCockpitExteriorDetailsVisible(false);
    assert.ok(p.cockpitExteriorDetailMeshes.every(mesh => mesh.visible === false));
    assert.equal(p.headlightSpotL.visible, true); assert.equal(p.headlightSpotR.visible, true);
    p.setCockpitExteriorDetailsVisible(true);
    assert.ok(p.cockpitExteriorDetailMeshes.every(mesh => mesh.visible === true));
  }
  assert.match(physics, /setCockpitPerspective\(isCockpitFpv\);\s*setCockpitExteriorDetailsVisible\(!isCockpitFpv\)/);
});
