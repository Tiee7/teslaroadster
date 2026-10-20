import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../src/vehicles.js',import.meta.url),'utf8');
const physics=readFileSync(new URL('../src/physics-main.js',import.meta.url),'utf8');
const begin=source.indexOf('let sonicCondensationAge = 1;');
const end=source.indexOf('// Four underside lift ports',begin);
assert.ok(begin>0&&end>begin);

function harness(random=.5) {
  const events={},documentEvents={};
  const material={uniforms:{uOpacity:{value:0}}};
  const group={visible:false,quaternion:{setFromUnitVectors(){}}};
  const state={isDestroyed:false,vx:0,vy:0,vz:-110};
  let menu=false;
  const document={hidden:false,getElementById:()=>({classList:{contains:()=>!menu}}),
    addEventListener:(name,fn)=>(documentEvents[name]??=[]).push(fn)};
  class Vector {set(){return this;}lengthSq(){return 1;}normalize(){return this;}applyQuaternion(){return this;}}
  class Quaternion {invert(){return this;}}
  const context=vm.createContext({THREE:{Vector3:Vector,Quaternion},state,document,
    window:{addEventListener:(name,fn)=>(events[name]??=[]).push(fn)},
    sonicCondensationMaterial:material,sonicBoomConeGroup:group,
    carMeshGroup:{getWorldQuaternion:q=>q},Math:Object.assign(Object.create(Math),{random:()=>random})});
  vm.runInContext(source.slice(begin,end),context);
  const snapshot=()=>({visible:group.visible,opacity:material.uniforms.uOpacity.value,
    age:vm.runInContext('sonicCondensationAge',context),
    remaining:vm.runInContext('sonicCondensationRepeatSeconds',context)});
  return {state,document,snapshot,setMenu:value=>{menu=value;},
    step:(dt,cross=false,cockpit=false,supersonic=true)=>{context.updateSonicCondensation(dt,cross,cockpit,supersonic);return snapshot();},
    event:name=>events[name]?.forEach(fn=>fn()),
    visibility:hidden=>{document.hidden=hidden;documentEvents.visibilitychange.forEach(fn=>fn());},
    clear:()=>context.resetSonicCondensation()};
}

for(const frames of [[1/30],[1/60],[1/144],[.007,.023,.05,.011]])for(const random of [0,.5,1]) {
  test(`side wisps repeat ${3+2*random}s after disappearance at ${frames.join('/')} frames`,()=>{
    const h=harness(random),expected=3+2*random,maxDt=Math.max(...frames);
    assert.equal(h.step(0,true).visible,true);
    let elapsed=0,previous=true,gone=null,repeats=0;
    for(let i=0;elapsed<21;i++) {
      const dt=frames[i%frames.length];elapsed+=dt;
      const value=h.step(dt);
      assert.ok(value.opacity>=0&&value.opacity<=.2+1e-12);
      if(previous&&!value.visible)gone=elapsed;
      if(!previous&&value.visible) {
        assert.notEqual(gone,null);
        assert.ok(elapsed-gone>=expected-1e-8,'delay starts after disappearance, not pulse start');
        assert.ok(elapsed-gone<=expected+maxDt+1e-8,'no extra scheduler drift');
        repeats++;
      }
      previous=value.visible;
    }
    assert.ok(repeats>=3);
  });
}

test('pulse shape/lifetime stay unchanged; threshold noise cannot overlap or restart a live pulse',()=>{
  const h=harness();h.step(0,true);
  const peak=h.step(.4,true);
  assert.equal(peak.age,.5);assert.equal(peak.opacity,.2);
  const end=h.step(.4,true);
  assert.equal(end.visible,false);assert.equal(end.age,1);assert.equal(end.remaining,4);
  assert.ok(end.opacity<1e-12);
  assert.equal(h.step(.1,true).visible,false,'crossing cannot skip an existing cooldown');
});

test('loss of trigger, FPV, destruction, menu, hidden page and focus clear pulses and stale delay',()=>{
  for(const cause of ['speed','cockpit','destroyed','menu','hidden','blur','pagehide','reset']) {
    const h=harness();h.step(0,true);h.step(.2);
    assert.equal(h.snapshot().visible,true);
    if(cause==='speed')h.step(.1,false,false,false);
    if(cause==='cockpit')h.step(.1,false,true);
    if(cause==='destroyed'){h.state.isDestroyed=true;h.step(.1);}
    if(cause==='menu'){h.setMenu(true);h.step(.1);}
    if(cause==='hidden')h.visibility(true);
    if(cause==='blur')h.event('blur');
    if(cause==='pagehide')h.event('pagehide');
    if(cause==='reset')h.clear();
    assert.deepEqual(h.snapshot(),{visible:false,opacity:0,age:1,remaining:null},cause);
    h.state.isDestroyed=false;h.setMenu(false);h.visibility(false);h.event('focus');
    assert.equal(h.step(0).visible,false,'resume never replays a backlog');
    assert.equal(h.snapshot().remaining,4);
    assert.equal(h.step(3.99).visible,false);
    assert.equal(h.step(.01).visible,true);
  }
});

test('paused/invalid deltas cannot advance cooldown; injected randomness remains bounded',()=>{
  const h=harness();h.step(0,true);h.step(.8);
  for(const dt of [0,-1,NaN,Infinity])assert.equal(h.step(dt).remaining,4);
  for(const [random,expected] of [[-10,3],[10,5],[NaN,3]]) {
    const g=harness(random);g.step(0,true);g.step(.8);assert.equal(g.snapshot().remaining,expected);
  }
});

test('only existing body wisps repeat, with no timers, added geometry, force, sound or banner',()=>{
  const scheduler=source.slice(begin,end);
  assert.doesNotMatch(scheduler,/setInterval|setTimeout|playSonicBoom|speakAlert|showBanner|new THREE\.(?:Mesh|Group|BufferGeometry)|consumeAirTank/);
  assert.match(physics,/updateSonicCondensation\(dt, crossedSonicThreshold, isCockpitFpv, isSupersonic\)/);
  const thresholdStart=physics.indexOf('  const crossedSonicThreshold =');
  const threshold=physics.slice(thresholdStart,physics.indexOf('  // Requirement 5:',thresholdStart));
  assert.equal((threshold.match(/sound\.playSonicBoom\(\)/g)||[]).length,1);
  assert.match(threshold,/if \(crossedSonicThreshold\) \{[\s\S]*sound\.playSonicBoom\(\)/);
  assert.match(source,/sonicBoomConeGroup\.name = 'transient-condensation-wisps'/);
  assert.match(source,/resetSonicCondensation\(\);\n\}/,'reset/map/destroy visual cleanup shares the scheduler reset');
});
