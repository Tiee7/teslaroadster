import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {fixture} from './helpers/reference-fixture.mjs';

// The fixture intentionally omits real BufferGeometry/Matrix3 transforms. Keep
// its original parts and animation handles; its counts do not prove batching.
test('minimal scene fixture retains unbatched wheel parts without pretending to batch',()=>{
  const f=fixture();
  f.wheels.forEach((wheel,i)=>{
    const group=wheel.getObjectByName(`reference-wheel-${i}`);
    assert.equal(group.parent,wheel);assert.equal(group.children.length,37);
    assert.equal(new Set(group.children.map(part=>part.material)).size,4);
    assert.ok(group.getObjectByName(`reference-rounded-tire-${i}`));
    assert.ok(group.children.every(part=>!part.userData.referenceWheelBatch));
    wheel.rotation.x=.73;assert.equal(group.parent.rotation.x,.73);
    f.api.setModel('classic');assert.equal(group.visible,false);
    f.api.setModel('reference');assert.equal(group.visible,true);
  });
});

const runtime=process.env.ROADSTER_THREE_RUNTIME||'/tmp/roadster-three.min.js';
test('real r128 wheel batches preserve every oriented triangle, normal, UV and animation parent',{
  skip:existsSync(runtime)?false:'Set ROADSTER_THREE_RUNTIME to the official Three.js r128 build; the simplified fixture cannot prove geometry batching.'
},()=>{
  const script=fileURLToPath(new URL('../verification/reference-wheel-batching-runtime-check.cjs',import.meta.url));
  const result=spawnSync(process.execPath,[script,runtime],{encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024});
  assert.equal(result.status,0,`${result.stdout}\n${result.stderr}`);
  const report=JSON.parse(result.stdout);
  assert.equal(report.pass,true);assert.equal(report.beforeWheelMeshes,148);assert.equal(report.afterWheelMeshes,16);
  assert.equal(report.totalWheelTriangles,10408);assert.equal(report.maximumRawWorldNormalError,0);assert.equal(report.maximumUvError,0);
  assert.ok(report.maximumRawWorldPositionErrorMetres<1e-8);
  assert.equal(report.classicConfigurations,4);
});
