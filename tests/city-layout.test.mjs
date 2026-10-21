import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { motionHarness } from './helpers/motion-harness.mjs';
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
test('city keeps metre scale, six real 4 m lanes and a matching reset/NPC/stop contract', () => {
  assert.match(config, /const CITY_WORLD_SPEED_SCALE = 1\.0/);
  assert.match(config, /const CITY_ROAD_WIDTH = 24;/);
  assert.match(vehicles, /const laneOffset = dir \* CITY_LANE_WIDTH \* \(0\.5 \+/);
  assert.doesNotMatch(vehicles.slice(vehicles.indexOf('function populateTraffic(')), /5\.5/);
  assert.match(read('src/ui-hud.js'), /state\.x = CITY_DEFAULT_LANE_OFFSET/);
  assert.match(read('src/taxi.js'), /buildRoadGraph\(CITY_ROAD_COORDS, CITY_TAXI_STOP_OFFSET, cityBuildings/);
});
test('real Three r128 city layout has low mid-block frontage, recessed towers and preserved functions', {
  skip: !existsSync(runtime) && 'Official Three r128 is required for geometry checks',
}, () => {
  const h = layout(); assert.equal(h.c.THREE.REVISION, '128');
  assert.equal(h.width, 24); assert.equal(h.lane, 4); assert.equal(h.spawn, 6); assert.equal(h.stop, 8);
  assert.equal(h.buildings.length, 227);
  assert.equal(h.buildings.filter(b => b.kind === 'low').length, 192);
  assert.equal(h.buildings.filter(b => b.isHelipad).length, 35, 'retain all 35 rooftop refill functions');
  const landmarks = h.buildings.filter(b => b.kind === 'landmark');
  assert.equal(landmarks.length, 1); assert.equal(landmarks[0].height, 180);
  const lanePaint = h.root.getObjectByName('city-lane-paint'), crosswalk = h.root.getObjectByName('city-crosswalk-paint');
  assert.equal(lanePaint.isInstancedMesh, true); assert.ok(lanePaint.count > 14000 && lanePaint.count < 16000);
  assert.equal(crosswalk.isInstancedMesh, true); assert.equal(crosswalk.count, 784);
  assert.equal(lanePaint.castShadow, false); assert.equal(crosswalk.castShadow, false);
  assert.equal(lanePaint.frustumCulled, false, 'far instance paint cannot disappear with the unit-plane origin');
  let bridges = 0, boxes = 0, lights = 0, meshes = 0, beams = 0;
  h.root.traverse(o => {
    if (o.isLight) lights++; if (o.isMesh) meshes++;
    if (o.geometry?.parameters?.height === 4.2 && o.geometry.parameters.depth === 5.8) bridges++;
    if (o.geometry?.type === 'BoxGeometry' && o.castShadow) boxes++;
    if (o.geometry?.type === 'CylinderGeometry' && o.geometry.parameters.height === 14) { beams+=o.count||1; assert.equal(o.material.opacity, .10); }
  });
  assert.equal(bridges, 2); assert.equal(beams, 35); assert.equal(lights, 0); assert.equal(boxes, 6);
  assert.ok(meshes < 100, 'batch the denser city rather than multiplying per-window/roof scene work');
  assert.equal(h.root.userData.cityArchitecture.families.length,6);assert.equal(new Set(h.buildings.map(b=>b.family)).size,6);
  for (const pair of [-1050, -750]) {
    const endpoints = h.buildings.filter(b => b.bridgePair === pair);
    assert.equal(endpoints.length, 2); assert.ok(endpoints.every(b => b.blockX === -750 && b.blockZ === pair));
    assert.equal(Math.hypot(endpoints[1].x - endpoints[0].x, endpoints[1].z - endpoints[0].z), 68);
  }
  h.root.updateMatrixWorld(true);
  for (const b of h.buildings) {
    assert.ok(b.minX >= -1200 && b.maxX <= 1200 && b.minZ >= -1200 && b.maxZ <= 1200, 'all actual building boxes stay inside city boundaries');
    const mesh = h.root.getObjectByName(b.renderBatch),matrix=new h.c.THREE.Matrix4();mesh.getMatrixAt(b.renderIndex,matrix);mesh.geometry.computeBoundingBox();const bounds=mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
    assert.equal(mesh.userData.cityInstances[b.renderIndex],b.id);
    for (const [actual, expected] of [[bounds.min.x,b.minX],[bounds.max.x,b.maxX],[bounds.min.z,b.minZ],[bounds.max.z,b.maxZ],[bounds.max.y,b.height]]) assert.ok(Math.abs(actual - expected) < 1e-6, 'rendered and collision boxes are identical');
    if (b.kind === 'low') {
      assert.ok(b.height >= 14 && b.height <= 28);
      assert.ok(b.w === 30 || b.d === 30);
      assert.ok(b.x === b.blockX || b.z === b.blockZ, 'frontage sits at street-segment midpoint, not at a corner');
    } else if (b.kind !== 'landmark') assert.ok(b.height >= 76 && b.height <= 120);
    for (const road of h.roads) {
      assert.ok(b.minX > road + h.width / 2 || b.maxX < road - h.width / 2, 'collision box never blocks a north/south avenue');
      assert.ok(b.minZ > road + h.width / 2 || b.maxZ < road - h.width / 2, 'collision box never blocks an east/west avenue');
    }
    const dx = Math.min(...h.roads.map(r => Math.min(Math.abs(b.minX - r), Math.abs(b.maxX - r)))) - h.width / 2;
    const dz = Math.min(...h.roads.map(r => Math.min(Math.abs(b.minZ - r), Math.abs(b.maxZ - r)))) - h.width / 2;
    assert.ok(Math.min(dx, dz) >= (b.kind === 'low' ? 12 : b.avenueAccent ? 28 : 75), 'type-specific real road-edge setback');
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
  for (const b of h.buildings) {
    const driving = motionHarness({x:b.x,z:b.z,y:b.height+.001,vy:-.1,airRemaining:5});
    driving.context.cityBuildings.push(...h.buildings);
    driving.step(1/60);
    assert.ok(Math.abs(driving.state.y-b.height)<1e-8, 'production motion lands on the same rendered roof');
    assert.equal(driving.state.vy,0); assert.equal(driving.impacts.length,0);
    assert.ok(Math.abs(driving.state.airRemaining-5-(b.isHelipad?10:4)/60)<1e-8, '35 helipads retain10/s; all ordinary roofs use the inherited4/s, not an added pad bonus');
    assert.equal(Boolean(driving.state.hasTriggeredHelipad),b.isHelipad);
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
  for (const x of h.roads) for (const z of h.roads) for (const axis of ['x','z']) for (const sign of [-1,1]) for (const distance of [45,30,15]) for (const crossSign of [-1,1]) for (const lane of [2,6,10]) for (const crossLane of [2,6,10]) for (const ownSide of [-1,1]) for (const crossSide of [-1,1]) {
    const other = axis === 'x' ? 'z' : 'x';
    const eye = {x,z}, target = {x,z}; eye[axis] += sign * distance; eye[other] += ownSide * sign * lane;
    target[other] += crossSign * 80; target[axis] += crossSide * crossSign * crossLane;
    assert.ok(h.buildings.every(box => !segmentHitsBox(eye, target, box)), `occluded ${x},${z} ${axis}${sign} distance ${distance}`); rays++;
  }
  assert.equal(rays, 42336, 'three lanes on both ego and cross-traffic carriageways, both sides and four approaches');
});

test('city lane paint is a physical 3m dash / 8m cycle with independent light paint, not a speed multiplier',{skip:!existsSync(runtime)&&'Official Three r128 required'},()=>{
 const h=layout(),paint=h.root.getObjectByName('city-lane-paint'),matrix=new h.c.THREE.Matrix4(),p=new h.c.THREE.Vector3(),r=new h.c.THREE.Quaternion(),scale=new h.c.THREE.Vector3();
 let expected=0;for(let s=-1176;s<=1176;s+=8)if(!h.roads.some(c=>Math.abs(s-c)<h.width/2+3))expected+=8*h.roads.length;
 assert.equal(paint.count,expected);assert.equal(paint.material.color.getHex(),0xd9dfe5);
 for(let i=0;i<paint.count;i++){paint.getMatrixAt(i,matrix);matrix.decompose(p,r,scale);assert.ok((Math.abs(scale.x-.16)<1e-7&&scale.y===3)||(scale.x===3&&Math.abs(scale.y-.16)<1e-7));const along=scale.y===3?p.z:p.x;assert.equal((along+1176)%8,0);}
 assert.match(world,/for \(let z = -420; z < 420; z \+= 14\)/,'highway arcade paint unchanged');
 assert.ok(Math.abs((120/3.6/8)/(120/3.6*1.65/14)-1)<.07,'close visual cycle rate without lying about metres');
});
for(const count of[20,36,52])test(`${count} actual production city NPC spawns use right-side lanes on both axes`,()=>{
 const c=vm.createContext({window:{},console});vm.runInContext(config,c);
 const a=vehicles.indexOf('function populateTraffic('),b=vehicles.indexOf('// =========================================================================',a);
 vm.runInContext(`let trafficCars=[];const trafficGroup={add(){},remove(){}};function createTrafficVehicleMesh(){return{userData:{length:4.62,height:1.25},position:{set(x,y,z){Object.assign(this,{x,y,z})}},rotation:{y:0}};}${vehicles.slice(a,b)}currentMap='city';populateTraffic(${count});globalThis.spawned=trafficCars;`,c);
 for(const car of c.spawned){const axis=car.isNS?'x':'z',offset=car.mesh.position[axis]-Array.from(vm.runInContext('CITY_ROAD_COORDS',c)).reduce((a,b)=>Math.abs(car.mesh.position[axis]-a)<Math.abs(car.mesh.position[axis]-b)?a:b);
  assert.ok(offset*(-car.vz)*(car.isNS?1:0)+offset*car.vx*(car.isNS?0:1)>0,'offset · vehicle right >0');assert.ok([2,6,10].includes(Math.abs(offset)));
  // Existing city traffic is straight+wrap, not an invented turning route.
  const old=car.mesh.position[axis];car.mesh.position[car.isNS?'z':'x']+=car.isNS?car.vz*1000:car.vx*1000;assert.equal(car.mesh.position[axis],old);
 }
});
test('portrait default approach contains nearby high-rise accents without closing the road or junction sightlines',{skip:!existsSync(runtime)&&'Official Three r128 required'},()=>{
 const h=layout(),T=h.c.THREE,camera=new T.PerspectiveCamera(60,9/16,.38,4500);camera.position.set(h.spawn,2.3275,4.05);camera.lookAt(h.spawn,.65,-10);camera.updateMatrixWorld(true);const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const accents=h.buildings.filter(b=>b.avenueAccent);assert.equal(accents.length,2);for(const b of accents)assert.ok(Math.abs((b.x-h.spawn)/(4.05-b.z))<Math.tan(Math.PI/6)*9/16,'both accent centres, not just box slivers, lie inside portrait horizontal FOV');assert.ok(accents.every(b=>b.height>=96&&Math.hypot(b.x-h.spawn,b.z)<250));
 assert.equal(accents.filter(b=>frustum.intersectsBox(new T.Box3(new T.Vector3(b.minX,0,b.minZ),new T.Vector3(b.maxX,b.height,b.maxZ)))).length,2);
 const full=accents.find(b=>b.kind==='tower');for(const x of[full.minX,full.maxX])for(const z of[full.minZ,full.maxZ])for(const y of[0,full.height]){const p=new T.Vector3(x,y,z).project(camera);assert.ok(Math.abs(p.x)<.98&&Math.abs(p.y)<.98,'all eight actual 96m tower corners, including roof and both façade edges, inside portrait image');}

 const apply=h.root.userData.applyWeather;apply({daylight:true});const day=h.root.getObjectByName(h.buildings[0].renderBatch).material.color.getHex();apply({rain:false});assert.notEqual(h.root.getObjectByName(h.buildings[0].renderBatch).material.color.getHex(),day);assert.equal(h.root.getObjectByName('city-lane-paint').material.color.getHex(),0xd9dfe5);
});
