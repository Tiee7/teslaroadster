import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const config = read('src/config.js'), world = read('src/world.js'), vehicles = read('src/vehicles.js');
const runtime = process.env.ROADSTER_THREE_RUNTIME || '/tmp/roadster-three.min.js';
function layout() {
  const c = vm.createContext({ console }); vm.runInContext(readFileSync(runtime, 'utf8'), c);
  vm.runInContext(config, c);
  vm.runInContext(`const cityEnvGroup=new THREE.Group(),cityBuildings=[];
    let cityAsphaltMat=null,cityAsphaltEWMat=null;
    const dashMat=new THREE.MeshBasicMaterial(),titaniumMaterial=new THREE.MeshStandardMaterial();
    const createWetRoadDetail=()=>({});
    ${world.slice(world.indexOf('function buildOpenWorldCity()'), world.indexOf('buildOpenWorldCity();') + 21)}
    globalThis.layoutApi={root:cityEnvGroup,buildings:cityBuildings,width:CITY_ROAD_WIDTH,lane:CITY_LANE_WIDTH,
      roads:CITY_ROAD_COORDS,stop:CITY_TAXI_STOP_OFFSET,spawn:CITY_DEFAULT_LANE_OFFSET};`, c);
  return { c, ...c.layoutApi };
}
test('city keeps metre scale, six real 3.5 m lanes and a matching reset/NPC/stop contract', () => {
  assert.match(config, /const CITY_WORLD_SPEED_SCALE = 1\.0/);
  assert.match(config, /const CITY_ROAD_WIDTH = 21;/);
  assert.match(vehicles, /const laneOffset = dir \* CITY_LANE_WIDTH \* \(0\.5 \+/);
  assert.doesNotMatch(vehicles.slice(vehicles.indexOf('function populateTraffic(')), /5\.5/);
  assert.match(read('src/ui-hud.js'), /state\.x = CITY_DEFAULT_LANE_OFFSET/);
  assert.match(read('src/taxi.js'), /buildRoadGraph\(CITY_ROAD_COORDS, CITY_TAXI_STOP_OFFSET, cityBuildings/);
});
test('real Three r128 city layout has low mid-block frontage, recessed towers and preserved functions', {
  skip: !existsSync(runtime) && 'Official Three r128 is required for geometry checks',
}, () => {
  const h = layout(); assert.equal(h.c.THREE.REVISION, '128');
  assert.equal(h.width, 21); assert.equal(h.lane, 3.5); assert.equal(h.spawn, 5.25); assert.equal(h.stop, 6.5);
  assert.equal(h.buildings.length, 99);
  assert.equal(h.buildings.filter(b => b.kind === 'low').length, 64);
  assert.equal(h.buildings.filter(b => b.isHelipad).length, 35, 'retain all 35 rooftop refill functions');
  const landmarks = h.buildings.filter(b => b.kind === 'landmark');
  assert.equal(landmarks.length, 1); assert.equal(landmarks[0].height, 180);
  const lanePaint = h.root.getObjectByName('city-lane-paint'), crosswalk = h.root.getObjectByName('city-crosswalk-paint');
  assert.equal(lanePaint.isInstancedMesh, true); assert.equal(lanePaint.count, 7616);
  assert.equal(crosswalk.isInstancedMesh, true); assert.equal(crosswalk.count, 686);
  assert.equal(lanePaint.castShadow, false); assert.equal(crosswalk.castShadow, false);
  assert.equal(lanePaint.frustumCulled, false, 'far instance paint cannot disappear with the unit-plane origin');
  let bridges = 0, boxes = 0, lights = 0, meshes = 0, beams = 0;
  h.root.traverse(o => {
    if (o.isLight) lights++; if (o.isMesh) meshes++;
    if (o.geometry?.parameters?.height === 4.2 && o.geometry.parameters.depth === 5.8) bridges++;
    if (o.geometry?.type === 'BoxGeometry' && o.castShadow) boxes++;
    if (o.geometry?.type === 'CylinderGeometry' && o.geometry.parameters.height === 14) { beams++; assert.equal(o.material.opacity, .10); }
  });
  assert.equal(bridges, 2); assert.equal(beams, 35); assert.equal(lights, 0); assert.equal(boxes, 99);
  assert.ok(meshes < 1903, 'simplify actual scene objects, not extra per-frame visibility work');
  for (const pair of [-1050, -750]) {
    const endpoints = h.buildings.filter(b => b.bridgePair === pair);
    assert.equal(endpoints.length, 2); assert.ok(endpoints.every(b => b.blockX === -750 && b.blockZ === pair));
    assert.equal(Math.hypot(endpoints[1].x - endpoints[0].x, endpoints[1].z - endpoints[0].z), 68);
  }
  h.root.updateMatrixWorld(true);
  for (const b of h.buildings) {
    const mesh = h.root.getObjectByName(`city-building-${b.id}`), bounds = new h.c.THREE.Box3().setFromObject(mesh);
    for (const [actual, expected] of [[bounds.min.x,b.minX],[bounds.max.x,b.maxX],[bounds.min.z,b.minZ],[bounds.max.z,b.maxZ],[bounds.max.y,b.height]]) assert.ok(Math.abs(actual - expected) < 1e-6, 'rendered and collision boxes are identical');
    if (b.kind === 'low') {
      assert.ok(b.height >= 18 && b.height <= 28);
      assert.ok(b.w === 30 || b.d === 30);
      assert.ok(b.x === b.blockX || b.z === b.blockZ, 'frontage sits at street-segment midpoint, not at a corner');
    } else if (b.kind !== 'landmark') assert.ok(b.height >= 76 && b.height <= 120);
    for (const road of h.roads) {
      assert.ok(b.minX > road + h.width / 2 || b.maxX < road - h.width / 2, 'collision box never blocks a north/south avenue');
      assert.ok(b.minZ > road + h.width / 2 || b.maxZ < road - h.width / 2, 'collision box never blocks an east/west avenue');
    }
    const dx = Math.min(...h.roads.map(r => Math.min(Math.abs(b.minX - r), Math.abs(b.maxX - r)))) - h.width / 2;
    const dz = Math.min(...h.roads.map(r => Math.min(Math.abs(b.minZ - r), Math.abs(b.maxZ - r)))) - h.width / 2;
    assert.ok(Math.min(dx, dz) >= (b.kind === 'low' ? 12 : 75), 'type-specific real road-edge setback');
    for (const rx of h.roads) for (const rz of h.roads) {
      const cx = Math.min(Math.abs(b.minX - rx), Math.abs(b.maxX - rx)) - h.width / 2;
      const cz = Math.min(Math.abs(b.minZ - rz), Math.abs(b.maxZ - rz)) - h.width / 2;
      assert.ok(cx + cz >= 40, '40 m intersection sight triangle is empty of tall opaque buildings');
    }
  }
  for (let i = 0; i < h.buildings.length; i++) for (let j = i + 1; j < h.buildings.length; j++) {
    const a = h.buildings[i], b = h.buildings[j];
    assert.ok(a.maxX <= b.minX || a.minX >= b.maxX || a.maxZ <= b.minZ || a.minZ >= b.maxZ, 'no tower/frontage box overlaps');
  }
});
function segmentHitsBox(a, b, box) {
  let low = 0, high = 1;
  for (const [axis, min, max] of [['x','minX','maxX'], ['z','minZ','maxZ']]) {
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-10) { if (a[axis] <= box[min] || a[axis] >= box[max]) return false; }
    else { const p = (box[min] - a[axis]) / delta, q = (box[max] - a[axis]) / delta;
      low = Math.max(low, Math.min(p, q)); high = Math.min(high, Math.max(p, q)); if (low >= high) return false; }
  }
  return high > 0 && low < 1;
}
test('all 49 city junctions expose cross traffic from four driving approaches before entry', {
  skip: !existsSync(runtime) && 'Official Three r128 is required for geometry checks',
}, () => {
  const h = layout(); let rays = 0;
  for (const x of h.roads) for (const z of h.roads) for (const axis of ['x','z']) for (const sign of [-1,1]) for (const distance of [45,30,15]) for (const crossSign of [-1,1]) {
    const other = axis === 'x' ? 'z' : 'x';
    const eye = {x,z}, target = {x,z}; eye[axis] += sign * distance; eye[other] += sign * h.spawn; target[other] += crossSign * 80;
    assert.ok(h.buildings.every(box => !segmentHitsBox(eye, target, box)), `occluded ${x},${z} ${axis}${sign} distance ${distance}`); rays++;
  }
  assert.equal(rays, 1176);
});
