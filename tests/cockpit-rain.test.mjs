import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fixture } from './helpers/reference-fixture.mjs';
const read = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
const rain = read('weather-rain.js');
const cabin = vm.runInNewContext(rain.slice(0, rain.indexOf('const rainCabinInverse')) + '\nrainSegmentIntersectsCabin');

test('whole rain segments, including crossings with both endpoints outside, are excluded from the cabin', () => {
  for (const points of [[0,4,0,0,-4,0],[-4,.8,0,4,.8,0],[0,.8,-5,0,.8,5],[-5,5,-5,5,-5,5],[0,.8,0,0,.8,0]]) assert.equal(cabin(...points), true);
  for (const points of [[2,4,0,2,-4,0],[0,3,-5,0,3,5],[-5,.8,-3,5,.8,-3],[2,2,2,3,3,3]]) assert.equal(cabin(...points), false);
  assert.equal(cabin(.96,4,0,.96,-4,0), true, 'glass-edge boundary is conservatively protected');
});
function harness() {
  const f = fixture();
  f.context.THREE.Matrix4 = class { copy() { return this; } invert() { return this; } };
  f.context.THREE.BufferAttribute = class {
    constructor(array, itemSize) { Object.assign(this, { array, itemSize, count: array.length / itemSize }); }
    setUsage(usage) { this.usage = usage; return this; }
  };
  f.context.THREE.ShaderMaterial = class { constructor(options) { Object.assign(this, options); } };
  vm.runInContext(`let weatherIndex=0,cameraModeIndex=0;const state={speed:0,isDestroyed:false};\n${rain}\nthis.rainParts={glassRainMesh,glassRainGeometry,glassRainMaterial,glassRainDrops,glassRainPositions,glassRainOpacities,rainPanes,sampleRainPane};`,f.context);
  return { ...f, ...f.context.rainParts, run: code => vm.runInContext(code, f.context) };
}
test('exact glass sampling respects the reference front plane and follows the original classic grid', () => {
  const h = harness();
  for (const model of ['reference','classic']) for (const z of [-.39,-.45,-.55,-.69]) for (const u of [.25,.38,.5,.62,.75]) {
    const out = new Float32Array(3);
    h.sampleRainPane(h.rainPanes[model],u,z,out,0);
    assert.ok(out.every(Number.isFinite));
    assert.ok(out[0] > -.8 && out[0] < .8);
    assert.ok(out[2] < z && out[2] > z - .002, 'outward normal offsets water toward the road');
    if(model==='reference') {
      const slope=(1.065-.702)/(.705);
      const signed=(out[1]-.702-slope*(out[2]+1.065))/Math.hypot(1,slope);
      assert.ok(Math.abs(signed-.0012)<2e-7, `water is 1.2mm outside the preserved plane: ${signed}`);
    }
  }
});
test('eight small glass beads reuse one depth-tested transparent mesh and all buffers across modes/models/resize', () => {
  const h = harness(), geo = h.glassRainGeometry, positions = h.glassRainPositions, alpha = h.glassRainOpacities;
  assert.equal(positions.length, 8*4*3); assert.equal(geo.index.array.length, 8*6);
  assert.equal(h.glassRainMaterial.depthTest,true); assert.equal(h.glassRainMaterial.depthWrite,false);
  assert.equal(h.glassRainMesh.visible,false);
  for (let cycle=0;cycle<3;cycle++) for (const model of ['reference','classic']) for (const cockpit of ['reference','classic']) {
    h.api.setModel(model); h.api.setCockpit(cockpit);
    h.window.innerWidth = cycle%2 ? 390:1440; h.window.innerHeight=cycle%2 ?844:900;
    for (const weather of [1,0,1,2]) for(const camera of [3,0,3,1,2]) {
      h.run(`weatherIndex=${weather};cameraModeIndex=${camera};updateWindshieldRain(.016);`);
      assert.equal(h.glassRainMesh.visible,weather===1&&camera===3);
      assert.equal(h.glassRainGeometry,geo); assert.equal(h.glassRainPositions,positions); assert.equal(h.glassRainOpacities,alpha);
      assert.ok(positions.every(Number.isFinite));
    }
  }
  h.run('weatherIndex=1;cameraModeIndex=3;state.isDestroyed=true;updateWindshieldRain(.016)');
  assert.equal(h.glassRainMesh.visible,false);
  for(const model of ['classic','reference']){h.api.setModel(model);assert.equal(h.api.getPreviewModel().getObjectByName('exterior-windshield-water'),undefined,'studio previews predate weather geometry');}
});
test('beads slide down the real glass and speed cannot turn them into long full-screen streaks', () => {
  const h=harness(); h.run('weatherIndex=1;cameraModeIndex=3;updateWindshieldRain(0)');
  const before=Array.from(h.glassRainPositions);
  h.run('state.speed=300;updateWindshieldRain(.1)');
  for(let i=0;i<8;i++) {
    assert.ok(h.glassRainPositions[i*12+1]<before[i*12+1]);
    assert.ok(h.glassRainPositions[i*12+2]<before[i*12+2]);
    const p=h.glassRainPositions; assert.ok(Math.hypot(p[i*12]-p[i*12+6],p[i*12+1]-p[i*12+7],p[i*12+2]-p[i*12+8])<.05);
  }
});
test('global rain reconstruction restores suppressed streaks and no 2D windshield rain remains', () => {
  assert.match(rain,/arr\[p \+ 3\] = arr\[p\]; arr\[p \+ 4\] = y - 2\.8; arr\[p \+ 5\] = arr\[p \+ 2\] \+ slantZ/);
  assert.match(rain,/roadsterAttitudeGroup\.updateWorldMatrix\(true, false\)/);
  assert.match(rain,/rainCabinInverse\.copy\(roadsterAttitudeGroup\.matrixWorld\)\.invert\(\)/);
  assert.doesNotMatch(read('ui-hud.js'),/windshieldDrops|Windshield Rain Streaks/);
  assert.match(read('physics-main.js'),/updateExteriorRain\(dt\)/);
  assert.match(read('index.html'),/<script src="weather-rain\.js"><\/script>/);
  assert.doesNotMatch(rain.slice(rain.indexOf('function updateExteriorRain('),rain.indexOf('function createRainPane(')),/new THREE|new Float|\.clone\(|\.map\(|\.forEach\(/);
});
