import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/reference-fixture.mjs';
const f=fixture(),e=f.carMeshGroup.getObjectByName('reference-roadster-exterior'),s=e.userData;

test('upper rear shoulder descends behind the fixed axle rather than forming a high shelf',()=>{
  const start=s.sampleShoulder(1.38,.55),end=s.sampleShoulder(2.26,.55);
  assert.ok(Math.abs(start[1]-.886)<1e-10);
  assert.ok(Math.abs(end[1]-.748)<1e-10,'terminal shoulder lowers100mm from the saved .848m version');
  assert.ok(Math.atan2(start[1]-end[1],end[2]-start[2])*180/Math.PI>8.8);
  let previous=start[1];
  for(let i=1;i<=200;i++){
    const y=s.sampleShoulder(1.38+.88*i/200,.55)[1];
    assert.ok(y<=previous+1e-8,'no secondary upward hump or vertical tail tower');previous=y;
  }
  assert.ok(s.sampleShoulder(1.38,0)[1]-s.sampleShoulder(2.26,0)[1]>.10,'central rear deck also follows the descending silhouette');
});

test('rear wheel opening and arch returns remain outside the upper-tail deformation',()=>{
  for(const side of [-1,1]){
    const a=e.getObjectByName(`referenceArchReturn${side}`).geometry.attributes.position;
    for(let r=0;r<=240;r++)for(let c=0;c<=3;c++){
      const i=r*4+c,z=-1.94+(2.26+1.94)*r/240,expected=s.wheelOpeningY(z)-c/3*.014;
      assert.ok(Math.abs(a.getY(i)-expected)<1.5e-6,'arch clearance is not compressed by the descending body');
    }
  }
  assert.deepEqual({...s.axles.rear},{z:1.38,y:.35,radius:.35});
  assert.ok(s.tailDownProfile.protectedArchClearance>=.015);
});

test('aft buttress feet descend with their deck attachment while the front glass stays independent',()=>{
  for(const side of [-1,1]){
    const p=e.getObjectByName(`referenceRearButtress${side}`).geometry.attributes.position;
    const tail=Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)]).sort((a,b)=>b[2]-a[2])[0];
    const deck=s.sampleShoulder(tail[2],0,side);
    assert.ok(Math.abs(tail[1]-deck[1])<.002,'no hovering quarter-window buttress tip above the rear deck');
    const glass=e.getObjectByName(`referenceSideWindow${side}`).geometry.attributes.position;
    for(let i=0;i<glass.count;i++)assert.ok(glass.getZ(i)<s.tailDownProfile.startZ);
  }
});

test('rear light retains ordered thin faces and the fixed plate/nozzles keep their clearance',()=>{
  const p=e.getObjectByName('referenceRearContinuousRedLight').geometry.attributes.position;
  const top=Math.max(...Array.from({length:p.count},(_,i)=>p.getY(i))),bottom=Math.min(...Array.from({length:p.count},(_,i)=>p.getY(i)));
  assert.ok(top-bottom>.004&&top-bottom<.006,'light remains resolved instead of collapsing or folding');
  assert.equal(e.getObjectByName('referenceRearPlatePad').position.y,.603);
  for(const x of [-.45,-.15,.15,.45])assert.equal(f.carMeshGroup.getObjectByName(`reference-jet-flush-lip-${x}`).position.y,-.060);
  assert.ok(s.tailDownProfile.minimumJacobian>.38,'continuous upper-tail warp has strictly positive volume derivative');
});

test('tail taper preserves the existing wing mechanism and the two bounded shadow batches',()=>{
  assert.deepEqual(Array.from(s.wingProfile.constructionPivot),[0,.85,2.04]);
  assert.equal(s.wingProfile.centerChord,.490);
  const proxies=[];e.traverse(m=>{if(m.userData.shadowProxy)proxies.push(m);});
  assert.equal(proxies.length,1,'animated wing shadow proxy is mounted outside the body after integration');
  const all=[];f.carMeshGroup.traverse(m=>{if(m.userData.shadowProxy)all.push(m);});
  assert.equal(all.length,2);assert.ok(all.reduce((n,m)=>n+m.geometry.index.array.length/3,0)<15000);
});
