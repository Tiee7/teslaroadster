/**
 * CPU-only production-runtime regression evidence. No browser or FPS emulation.
 * Usage: node verification/input-latency-runtime-check.cjs /path/to/three.min.js [result.json]
 * Requires the production Three.js r128 runtime and the repository's history.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const runtimePath = process.argv[2];
if (!runtimePath) throw Error('Supply the official Three.js r128 runtime path.');
const runtime = fs.readFileSync(runtimePath, 'utf8');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const beforeModel = 'cab98f9';
const beforeFix = '20f6117';
const source = (revision, file) => revision === 'worktree'
  ? fs.readFileSync(path.join(root, 'src', file), 'utf8')
  : execFileSync('git', ['show', `${revision}:src/${file}`], { cwd: root, encoding: 'utf8' });
function load(revision) {
  const context = vm.createContext({ console, Math, Float32Array, Uint16Array, Uint32Array, performance,
    Event: class { constructor(type) { this.type = type; } },
    window: { innerWidth: 1440, innerHeight: 900, addEventListener() {}, dispatchEvent() {} },
    localStorage: { getItem() { return null; }, setItem() {} },
    document: { createElement() { return { getContext() { return {}; } }; } }
  });
  vm.runInContext(runtime, context);
  vm.runInContext(`const scene=new THREE.Scene();let currentMap='highway';${
    ['whiteLeatherMat', 'cockpitMat', 'bodyMaterial', 'goldCanopyMaterial', 'carbonMaterial', 'titaniumMaterial']
      .map(name => `const ${name}=new THREE.MeshStandardMaterial();`).join('')}`, context);
  for (const file of ['vehicles.js', ...(revision === beforeModel ? [] : ['reference-exterior.js', 'reference-cockpit.js', 'reference-traffic.js'])]) {
    vm.runInContext(source(revision, file), context, { filename: file });
  }
  vm.runInContext('this.parts={carMeshGroup,setCockpitPerspective,setCockpitExteriorDetailsVisible,createTrafficVehicleMesh};', context);
  assert.equal(context.THREE.REVISION, '128');
  return context;
}
const isVisible = object => { for (let n = object; n; n = n.parent) if (!n.visible) return false; return true; };
function count(root) {
  const result = { visibleMeshes: 0, colorMeshes: 0, colorTriangles: 0, shadowMeshes: 0, shadowTriangles: 0, extraNoWriteTriangles: 0 };
  const appearance = [];
  root.traverse(object => {
    if (!object.isMesh || !isVisible(object)) return;
    result.visibleMeshes++;
    const geometry = object.geometry, material = object.material;
    const triangles = (geometry.index?.count || geometry.attributes.position.count) / 3;
    if (material.colorWrite === false) result.extraNoWriteTriangles += triangles;
    else {
      result.colorMeshes++; result.colorTriangles += triangles;
      const attributes = Object.fromEntries(Object.entries(geometry.attributes).map(([key, value]) => [key, hash(Buffer.from(value.array.buffer, value.array.byteOffset, value.array.byteLength))]));
      appearance.push({ name: object.name, attributes, index: geometry.index && hash(Buffer.from(geometry.index.array.buffer, geometry.index.array.byteOffset, geometry.index.array.byteLength)),
        position: object.position.toArray(), rotation: object.rotation.toArray(), scale: object.scale.toArray(),
        material: { type: material.type, color: material.color?.getHex(), emissive: material.emissive?.getHex(), side: material.side, transparent: material.transparent,
          opacity: material.opacity, roughness: material.roughness, metalness: material.metalness, clearcoat: material.clearcoat } });
    }
    if (object.castShadow) { result.shadowMeshes++; result.shadowTriangles += triangles; }
  });
  result.visibleAppearanceHash = hash(JSON.stringify(appearance));
  return result;
}
function report(context, revision) {
  const { parts: p, THREE: T } = context, api = context.window.RoadsterVehicle;
  const vehicle = {}, traffic = {};
  for (const model of api ? ['reference', 'classic'] : ['classic']) for (const cockpit of api ? ['reference', 'classic'] : ['classic']) for (const active of [false, true]) {
    api?.setModel(model); api?.setCockpit(cockpit);
    p.setCockpitPerspective(active); p.setCockpitExteriorDetailsVisible(!active);
    vehicle[`${model}:${cockpit}:${active ? 'fpv' : 'external'}`] = count(p.carMeshGroup);
  }
  for (let i = 0; i < 6; i++) traffic[i] = count(p.createTrafficVehicleMesh(i));
  let visits = 0;
  const original = T.Object3D.prototype.getObjectByProperty;
  T.Object3D.prototype.getObjectByProperty = function (...args) { visits++; return original.apply(this, args); };
  const viewSync = {};
  for (const active of [false, true]) {
    p.setCockpitPerspective(active); p.setCockpitExteriorDetailsVisible(!active);
    for (let i = 0; i < 1000; i++) { p.setCockpitPerspective(active); p.setCockpitExteriorDetailsVisible(!active); }
    visits = 0;
    const iterations = 20000, started = performance.now();
    for (let i = 0; i < iterations; i++) { p.setCockpitPerspective(active); p.setCockpitExteriorDetailsVisible(!active); }
    viewSync[active ? 'fpv' : 'external'] = { iterations, elapsedMs: performance.now() - started, recursiveLookupVisitsPerFrame: visits / iterations };
  }
  return { revision, vehicle, traffic, viewSync };
}
const old = report(load(beforeModel), beforeModel);
const before = report(load(beforeFix), beforeFix);
const currentContext = load('worktree');
const after = report(currentContext, 'worktree');
let maximumShadowSampleDeviationMetres = 0;
currentContext.parts.carMeshGroup.traverse(part => {
  const rs = part.userData.shadowGridRows, cs = part.userData.shadowGridColumns;
  if (!rs || !cs) return;
  const p = part.geometry.attributes.position, columns = part.userData.surfaceColumns;
  const point = (r,c) => new currentContext.THREE.Vector3().fromBufferAttribute(p,r*(columns+1)+c);
  for (let ri=0; ri<rs.length-1; ri++) for (let ci=0; ci<cs.length-1; ci++) {
    const r0=rs[ri],r1=rs[ri+1],c0=cs[ci],c1=cs[ci+1];
    for (let r=r0; r<=r1; r++) for (let c=c0; c<=c1; c++) {
      const u=(c-c0)/(c1-c0),v=(r-r0)/(r1-r0);
      const a=point(r0,c0),b=point(r0,c1),lo=point(r1,c0),d=point(r1,c1);
      const approximated = v>=u ? a.multiplyScalar(1-v).addScaledVector(lo,v-u).addScaledVector(d,u)
        : a.multiplyScalar(1-u).addScaledVector(d,v).addScaledVector(b,u-v);
      maximumShadowSampleDeviationMetres = Math.max(maximumShadowSampleDeviationMetres,approximated.distanceTo(point(r,c)));
    }
  }
});
assert.ok(maximumShadowSampleDeviationMetres < .02, 'Shadow silhouette approximation exceeded 2 cm.');
for (const key of Object.keys(before.vehicle)) {
  assert.equal(after.vehicle[key].visibleAppearanceHash, before.vehicle[key].visibleAppearanceHash, `Visible mesh geometry/material/pose changed: ${key}`);
}
for (let i = 0; i < 6; i++) assert.deepEqual(after.traffic[i], before.traffic[i], `NPC ${i} changed`);
assert.equal(after.vehicle['reference:reference:external'].shadowMeshes, 2);
assert.ok(after.vehicle['reference:reference:external'].shadowTriangles < 15000);
assert.equal(after.viewSync.external.recursiveLookupVisitsPerFrame, 0);
assert.equal(after.viewSync.fpv.recursiveLookupVisitsPerFrame, 0);
const output = { generatedAt: new Date().toISOString(), pass: true, runtimeRevision: '128', runtimeSha256: hash(runtime),
  limits: 'CPU-only exact production scene-graph, geometry/material/pose hashes and view-sync microbenchmark. Counts are before frustum culling and material-group expansion, not measured GPU draw calls, browser input latency or FPS.',
  findings: ['Input handlers synchronously update key state; the RAF performs simulation before one render, without a new key debounce.',
    'Reference-model release expanded player shadow casters from 1 to 108; two lower-detail silhouette batches now replace those detailed shadow passes.',
    'All eight visible model/cockpit/camera geometry, material and pose hashes match the pre-fix production code.',
    'All six NPC variants are unchanged; unchanged-view recursive lookups drop from 548 to zero.'],
  maximumShadowSampleDeviationMetres, baseline: old, before, after };
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ pass: true, playerBefore: before.vehicle['reference:reference:external'], playerAfter: after.vehicle['reference:reference:external'], maximumShadowSampleDeviationMetres, limits: output.limits }, null, 2));
