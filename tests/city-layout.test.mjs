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
test('real Three r128 city geometry reuses 128 tower boxes with six-metre street frontage and clear routes', {
  skip: !existsSync(runtime) && 'Official Three r128 is required for geometry checks',
}, () => {
  const h = layout(); assert.equal(h.c.THREE.REVISION, '128');
  assert.equal(h.width, 21); assert.equal(h.lane, 3.5); assert.equal(h.spawn, 5.25); assert.equal(h.stop, 6.5);
  assert.equal(h.buildings.length, 128);
  const lanePaint = h.root.getObjectByName('city-lane-paint'), crosswalk = h.root.getObjectByName('city-crosswalk-paint');
  assert.equal(lanePaint.isInstancedMesh, true); assert.equal(lanePaint.count, 7616);
  assert.equal(crosswalk.isInstancedMesh, true); assert.equal(crosswalk.count, 686);
  assert.equal(lanePaint.castShadow, false); assert.equal(crosswalk.castShadow, false);
  assert.equal(lanePaint.frustumCulled, false, 'far instance paint cannot disappear with the unit-plane origin');
  let bridges = 0; h.root.traverse(o => { if (o.geometry?.parameters?.height === 4.2 && o.geometry.parameters.depth === 5.8) bridges++; });
  assert.equal(bridges, 2, 'moving towers must retain only the original two bridge pairs');
  let boxes = 0, lights = 0;
  h.root.traverse(o => { if (o.isLight) lights++; if (o.geometry?.type === 'BoxGeometry' && o.castShadow) boxes++; });
  assert.equal(lights, 0, 'no new per-building/per-street lights'); assert.equal(boxes, 128);
  for (const b of h.buildings) {
    assert.ok(b.w >= 36 && b.w <= 66 && b.d >= 36 && b.d <= 66);
    for (const road of h.roads) {
      assert.ok(b.minX > road + h.width / 2 || b.maxX < road - h.width / 2, 'actual collision box never blocks a north/south avenue');
      assert.ok(b.minZ > road + h.width / 2 || b.maxZ < road - h.width / 2, 'actual collision box never blocks an east/west avenue');
    }
    if (Math.abs(b.x) < 1000 && Math.abs(b.z) < 1000) {
      const dx = Math.min(...h.roads.map(r => Math.min(Math.abs(b.minX - r), Math.abs(b.maxX - r)))) - h.width / 2;
      const dz = Math.min(...h.roads.map(r => Math.min(Math.abs(b.minZ - r), Math.abs(b.maxZ - r)))) - h.width / 2;
      assert.ok(Math.abs(dx - 6) < 1e-8); assert.ok(Math.abs(dz - 6) < 1e-8);
    }
  }
  // The existing passenger route tests independently check the beam, approach,
  // swept arrival, minimum 900 m fare routes and every building-expanded edge.
});
