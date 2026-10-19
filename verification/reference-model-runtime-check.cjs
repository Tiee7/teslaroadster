/**
 * Independent CPU geometry verifier for the production Three.js r128 meshes.
 * Usage: node verification/reference-model-runtime-check.cjs /path/to/three.min.js [result.json]
 * Supplies only DOM/storage stubs. Does not create WebGL, emulate a renderer,
 * access browser internals, or download/vendor a Three.js build.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const runtime = process.argv[2];
if (!runtime) throw Error('Pass the official Three.js r128 runtime path.');
const events = {};
const context = vm.createContext({ console, Math, Float32Array, Uint16Array, Uint32Array,
  Event: class { constructor(type) { this.type = type; } },
  window: { innerWidth: 1440, innerHeight: 900, addEventListener(type, fn) { (events[type] ||= []).push(fn); }, dispatchEvent(e) { events[e.type]?.forEach(fn => fn(e)); } },
  localStorage: { getItem() { return null; }, setItem() {} },
  document: { createElement() { return { width: 0, height: 0, getContext() { return {}; } }; } }
});
vm.runInContext(fs.readFileSync(runtime, 'utf8'), context, { filename: path.basename(runtime) });
vm.runInContext(`const scene=new THREE.Scene();const currentMap='highway';${['whiteLeatherMat', 'cockpitMat', 'bodyMaterial', 'goldCanopyMaterial', 'carbonMaterial', 'titaniumMaterial'].map(name => `const ${name}=new THREE.MeshStandardMaterial();`).join('')}`, context);
const load = file => vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), context, { filename: file });
load('vehicles.js');
vm.runInContext('this.originalChildren=carMeshGroup.children.slice();this.originalYokeParts=yokeWheelGroup.children.slice();', context);
for (const file of ['reference-exterior.js', 'reference-cockpit.js', 'reference-traffic.js']) load(file);
vm.runInContext('this.parts={scene,carMeshGroup,COCKPIT_VIEW,yokeWheelGroup,screenDisplay,screenBezel,resizeCockpitDisplay,setCockpitPerspective,setCockpitExteriorDetailsVisible,headlightSpotL,headlightSpotR,activeWingGroup,rearNozzlesGimbalGroup,rearPlumes,liftPlumes,descendPlumes,frontRetroPlumes,rcsPlumes,createTrafficVehicleMesh};hudCombinerMesh.visible=false;', context);
const p = context.parts, T = context.THREE, api = context.window.RoadsterVehicle;
assert.equal(T.REVISION, '128', 'Use the same Three.js revision as the production application.');
p.carMeshGroup.parent.parent.position.set(0, 0, 0);
const visible = object => { for (let n = object; n; n = n.parent) if (!n.visible) return false; return true; };
const named = name => { const object = p.carMeshGroup.getObjectByName(name); assert.ok(object, `Missing production object ${name}`); return object; };
const label = object => object.name || object.geometry?.type || object.type;
const sourceFiles = ['vehicles.js', 'reference-exterior.js', 'reference-cockpit.js', 'reference-traffic.js'];
const output = { generatedAt: new Date().toISOString(), runtimeRevision: T.REVISION,
  sources: Object.fromEntries(sourceFiles.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'src', file))).digest('hex')])),
  limits: 'CPU scene-graph, projection and exact production-mesh ray intersections only. No WebGL/browser screenshot, GPU shading, actual text rasterization or touch interaction verification.',
  viewports: [[2048,1163],[2048,1123],[1440,900],[844,390],[667,320],[1024,1024],[780,900],[390,844],[360,800],[320,900]],
  steeringAngles: 49, steeringRangeRadians: [-1.009, 1.009], configurationCount: 4, instrumentRays: 0, roadRays: 0, instrumentBlockCount: 0, roadBlockCount: 0,
  instrumentBlocks: [], roadBlocks: [], wheelEnvelopeViolations: [], displayBounds: [], rearDirectRays: 0, rearQuarterRays: 0, rearGaps: [], assertions: [] };
function check(condition, message) { assert.ok(condition, message); }
for (const child of context.originalChildren) check(p.carMeshGroup.getObjectByProperty('uuid', child.uuid) === child, 'An original vehicle part was lost.');
for (const part of context.originalYokeParts) check(p.yokeWheelGroup.children.includes(part), 'Original yoke part was lost.');
output.assertions.push('All original car and yoke objects retained.');
for (let cycle = 0; cycle < 3; cycle++) for (const model of ['reference', 'classic']) for (const cockpit of ['reference', 'classic']) {
  api.setModel(model); api.setCockpit(cockpit);
  const preview = api.getPreviewModel();
  check(preview === api.getPreviewModel(), 'Preview source identity is unstable.');
  check(preview.getObjectByName('reference-canopy').visible, 'Canonical preview canopy inherited FPV hiding.');
  check(preview.getObjectByName('reference-cockpit').visible === false, 'Canonical preview inherited FPV dashboard.');
  check(preview.getObjectByName('reference-yoke').parent.rotation.z === 0, 'Canonical preview inherited turned steering.');
  check(preview.getObjectByName('reference-active-wing').parent.rotation.x === 0, 'Canonical preview inherited deployed wing.');
  check(preview.getObjectByName('referenceShoulder1').geometry === named('referenceShoulder1').geometry, 'Preview geometry was duplicated.');
  check(preview.getObjectByName('referenceShoulder1').material === named('referenceShoulder1').material, 'Preview paint material was duplicated.');
  for (const active of [true, false, true, false]) {
    p.setCockpitPerspective(active); p.setCockpitExteriorDetailsVisible(!active);
    check(visible(named('classic-roadster-exterior')) === (model === 'classic'), 'Classic model visibility is incorrect.');
    check(visible(named('reference-roadster-exterior')) === (model === 'reference'), 'Reference model visibility is incorrect.');
    check(visible(named('reference-cockpit')) === (active && cockpit === 'reference'), 'Reference cabin visibility is incorrect.');
    check(visible(p.headlightSpotL) && visible(p.headlightSpotR), 'Functional forward headlights were hidden.');
    check(named('reference-canopy').visible === !active, 'Canopy does not restore on view transitions.');
    check(named('reference-front-lights').visible === !active, 'Decorative front lights do not restore.');
    check(visible(named('reference-four-rear-jets')) === (model === 'reference'), 'Rear jet selection is incorrect.');
  }
}
output.assertions.push('Repeated four-way configuration and camera transitions preserve lights, canopy and independent choices.');
const counts = {}, classicBodies = [], materialIds = new Set();
for (let i = 0; i < 36; i++) {
  const car = p.createTrafficVehicleMesh(i); counts[car.userData.model] = (counts[car.userData.model] || 0) + 1;
  check(car.userData.length === 4.62 && car.userData.height === 1.25 && car.userData.wheels.length === 4, 'NPC gameplay dimensions or wheel handles changed.');
  if (car.userData.model === 'classic-roadster') classicBodies.push(car.children[0].geometry);
  car.traverse(o => { if (o.material) materialIds.add(o.material.uuid); });
}
check(classicBodies.every(g => g === classicBodies[0]), 'NPC classic body geometry is not shared.');
check(classicBodies[0].attributes.position.count === 41 * 41, 'Unexpected traffic body detail budget.');
assert.deepEqual(counts, { 'classic-roadster': 12, 'sculpted-track': 12, 'sculpted-touring': 12 });
output.npcModels = counts; output.npcMaterialCount = materialIds.size;
output.assertions.push('NPC mix, shared classic body geometry, collision dimensions and four wheel handles retained.');
const ray = new T.Raycaster();
const eye = new T.Vector3(0, p.COCKPIT_VIEW.eyeHeight, p.COCKPIT_VIEW.eyeZ);
const angles = Array.from({ length: 49 }, (_, i) => -1.009 + 2.018 * i / 48);
function meshes() {
  const out = [];
  p.carMeshGroup.traverse(o => { if (o.isMesh && visible(o) && (Array.isArray(o.material) ? o.material : [o.material]).some(m => !m.transparent || m.opacity > .01)) out.push(o); });
  return out;
}
function bounds(object, camera) {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity, near = Infinity;
  object.traverse(part => {
    if (!part.isMesh || !visible(part)) return;
    const a = part.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const v = new T.Vector3().fromBufferAttribute(a, i).applyMatrix4(part.matrixWorld).project(camera);
      left = Math.min(left, (1 + v.x) / 2); right = Math.max(right, (1 + v.x) / 2);
      top = Math.min(top, (1 - v.y) / 2); bottom = Math.max(bottom, (1 - v.y) / 2); near = Math.min(near, v.z);
    }
  });
  return { left, right, top, bottom, minNdcZ: near };
}
for (const model of ['reference', 'classic']) for (const cockpit of ['reference', 'classic']) {
  api.setModel(model); api.setCockpit(cockpit); p.setCockpitPerspective(true); p.setCockpitExteriorDetailsVisible(false);
  for (const [width, height] of output.viewports) {
    context.window.innerWidth = width; context.window.innerHeight = height; p.resizeCockpitDisplay(); p.scene.updateMatrixWorld(true);
    const camera = new T.PerspectiveCamera(60, width / height, .08, 20000);
    camera.position.copy(eye); camera.lookAt(eye.clone().add(new T.Vector3(0, -p.COCKPIT_VIEW.downwardSlope, -1))); camera.updateMatrixWorld(true);
    const b = bounds(p.screenDisplay, camera);
    check(Math.abs((b.left + b.right) / 2 - .5) < 1e-7 && b.top >= .65 - 1e-7 && b.bottom <= .99, 'Live instruments lost their centered safe layout.');
    if (model === 'reference' && cockpit === 'reference') output.displayBounds.push({ viewport: [width, height], ...b });
    const cache = new Map();
    for (const angle of angles) {
      p.yokeWheelGroup.rotation.z = angle; p.scene.updateMatrixWorld(true);
      const all = meshes(); const moving = o => { for (let n = o; n; n = n.parent) if (n === p.yokeWheelGroup) return true; return false; };
      const fixedMeshes = all.filter(o => !moving(o)), movingMeshes = all.filter(moving);
      const closest = (key, omit) => {
        // Static geometry/rays are identical at every steering angle. Cache only
        // the exact static-mesh result, while raycasting the moving yoke each time.
        if (!cache.has(key)) cache.set(key, ray.intersectObjects(fixedMeshes.filter(o => o !== omit), false)[0] || null);
        const a = cache.get(key), b = ray.intersectObjects(movingMeshes, false)[0];
        return a && b ? (a.distance < b.distance ? a : b) : (a || b);
      };
      const envelope = bounds(p.yokeWheelGroup, camera);
      if (envelope.left < (width / height < .75 ? -.025 : .02) || envelope.right > .98 || envelope.top < .65 || envelope.bottom > 1.17 || envelope.minNdcZ < -1) output.wheelEnvelopeViolations.push({ model, cockpit, viewport: [width,height], angle, ...envelope });
      for (const y of [26,66,75,82,104,110,134,156,176,194]) for (const x of [16,80,140,178,330,494]) {
        const target = new T.Vector3((x / 512 - .5) * .38, (.5 - y / 200) * .23, 0).applyMatrix4(p.screenDisplay.matrixWorld);
        ray.set(eye, target.clone().sub(eye).normalize()); ray.near = .08; ray.far = eye.distanceTo(target) - 1e-5;
        const hit = closest(`instrument:${x}:${y}`, p.screenDisplay); output.instrumentRays++;
        if (hit) { output.instrumentBlockCount++; if (output.instrumentBlocks.length < 12) output.instrumentBlocks.push({ model, cockpit, viewport:[width,height], angle, pixel:[x,y], hit:label(hit.object), distance:hit.distance }); }
      }
      for (const x of [-.7,-.35,0,.35,.7]) for (const y of [-.3,-.1,.3,.6]) {
        ray.setFromCamera(new T.Vector2(x, y), camera); ray.near = .08; ray.far = 100;
        const hit = closest(`road:${x}:${y}`); output.roadRays++;
        if (hit) { output.roadBlockCount++; if (output.roadBlocks.length < 12) output.roadBlocks.push({ model, cockpit, viewport:[width,height], angle, ndc:[x,y], hit:label(hit.object), distance:hit.distance }); }
      }
    }
  }
}
api.setModel('reference'); p.setCockpitPerspective(false); p.setCockpitExteriorDetailsVisible(true); p.scene.updateMatrixWorld(true);
const rearMeshes = meshes();
function rearRay(origin, target, kind, metadata) {
  ray.set(origin, target.clone().sub(origin).normalize()); ray.near = .01; ray.far = 30;
  const hit = ray.intersectObjects(rearMeshes, false)[0]; output[kind]++;
  if (!hit || hit.point.z < 2.1) output.rearGaps.push({ ...metadata, first: hit && label(hit.object), point: hit?.point.toArray() });
}
for (const x of [-.78,-.74,-.68,-.60,-.54,-.40,-.32,-.28,-.12,.12,.28,.32,.40,.54,.60,.68,.74,.78]) for (const y of [.215,.23,.26,.3,.34]) rearRay(new T.Vector3(x,y,5),new T.Vector3(x,y,2),'rearDirectRays',{x,y});
for (const side of [-1,1]) for (const y of [.23,.26,.3,.34]) for (const x of [-.5,-.3,-.1,.1,.3,.5]) rearRay(new T.Vector3(side*3,1.15,8),new T.Vector3(x,y,2.25),'rearQuarterRays',{side,x,y});
output.pass = !output.instrumentBlockCount && !output.roadBlockCount && !output.wheelEnvelopeViolations.length && !output.rearGaps.length;
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ pass:output.pass, instrumentRays:output.instrumentRays, roadRays:output.roadRays, instrumentBlocks:output.instrumentBlockCount, roadBlocks:output.roadBlockCount, wheelEnvelopeViolations:output.wheelEnvelopeViolations.length, rearDirectRays:output.rearDirectRays, rearQuarterRays:output.rearQuarterRays, rearGaps:output.rearGaps.length, limits:output.limits }, null, 2));
process.exitCode = output.pass ? 0 : 1;
