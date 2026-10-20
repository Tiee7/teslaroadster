import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {candidateHarness} from './helpers/demo-candidate-harness.mjs';

const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/demo-floor-refill-handoff.json',import.meta.url),'utf8'));
const source=fs.readFileSync(new URL('../src/highway-demo.js',import.meta.url),'utf8').split('// UI/lifecycle adapter.')[0];
const clone=structuredClone;
const near=(a,b,message)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-10,`${message}: ${a} != ${b}`);

test('complete candidate real-O unit: a paid refill pulse preserves220 and the exact admitted handoff without free recharge',()=>{
  // Physical-model unit dispatch, not obsolete synchronous backup admission.
  // The same fixed state/NPC geometry must still pass the full pure arc proof.
  const u=candidateHarness(clone(fixture.state),clone(fixture.cars),{seed:fixture.provenance.seed,dt:fixture.dt}),h=u.h;
  const {option:candidate,motion}=u.candidate(fixture.witness.height,fixture.witness.lane,3.6);
  assert.ok(candidate,'fixed complete candidate must remain safe and payable');u.dispatch(candidate);
  const prediction={candidate,motion};
  const dt=fixture.dt,rows=[];let frames=1,minimum=Infinity,groundPulses=0,airPulses=0,endpoint=null;
  for(let index=0;index<frames;index++){
    const before=clone(h.state),out=h.step(dt);assert.ok(out,'all measured frames execute real physics');
    if(index===0){
      assert.equal(out.frame.jump,true,'explicit physical unit dispatch goes through the ordinary real O pipeline');
      // Dispatch role is a unit seam, not a ranking/admission assertion.
assert.equal(out.frame.targetLane,fixture.witness.lane);assert.equal(out.frame.jumpHeight,fixture.witness.height);
      assert.ok(prediction.candidate);frames=prediction.motion.steps.length;
    }else assert.equal(out.frame.jump,false,'one ordinary paid arc, not an injected hop chain');
    minimum=Math.min(minimum,h.state.speed*3.6);
    if(out.isAirborne){assert.equal(out.frame.input.throttle,0);assert.equal(out.frame.input.boost,0);assert.equal(out.frame.input.lift,0);}
    if(out.frame.input.boost){
      if(out.isAirborne)airPulses++;else groundPulses++;
      assert.equal(before.y,0);assert.equal(h.state.y,0);assert.equal(out.frame.input.boost,1);
      near(out.airConsumedThisFrame,.85*dt,'real ground jet charges the tank');
      near(h.state.airRemaining,before.airRemaining-.85*dt,'a firing frame cannot also receive3.4/s recharge');
    }else if(before.y===0&&h.state.y===0){
      assert.equal(out.frame.input.brake,0);near(h.state.airRemaining,Math.min(10,before.airRemaining+3.4*dt),'ordinary nonfiring ground frame recharges');
    }
    rows.push({index,before,after:clone(h.state),out});
    if(index===prediction.motion.handoff.index)endpoint={state:clone(h.state),cars:clone(h.cars)};
    assert.equal(h.impacts.length,0);assert.equal(h.state.isDestroyed,false);
  }
  assert.equal(h.launches.length,1);assert.equal(groundPulses,1);assert.equal(airPulses,0);
  assert.ok(minimum>=220);assert.ok(prediction.motion.minSpeed*3.6>=220);
  near(candidate.groundWait,fixture.witness.unrepairedGroundWait+dt,'paid pulse needs one extra true ground-wait frame');
  near(candidate.preparation,fixture.witness.unrepairedPreparation+dt,'preparation retains that extra frame');
  near((motion.handoff.index+1)*dt,candidate.duration+candidate.groundWait,'handoff cannot retain an earlier phase after wait extension');
  near(motion.steps[motion.handoff.index].point.t,candidate.duration+candidate.groundWait,'NPC handoff and final returned wait use the same frame');
  near(motion.steps.at(-1).point.t,candidate.duration+candidate.preparation,'later preparation must not retroactively shift handoff');
  assert.ok(endpoint);assert.ok(endpoint.state.airRemaining>=3.6);
  near(endpoint.state.airRemaining,fixture.witness.unrepairedHandoffGas-.85*dt,'extra recharge frame offsets missed recharge, while real jet burn remains paid');
  const core=['x','y','vx','vz','speed','yaw','steerInput','airRemaining','gasMassKg','roll','pitch','vRoll','vPitch','vYaw','attitudeIdleSeconds','lateralG'];
  for(const key of core)near(endpoint.state[key],candidate.endpoint[key],`predicted handoff ${key}`);
  // Forecast snapshots omit only rendering-only mesh.userData. Every remaining
  // NPC key/array/flag is checked; numerical model roundoff is explicitly1e-10.
  const compare=(actual,predicted,path='cars')=>{
    if(typeof actual==='number'&&typeof predicted==='number'){near(actual,predicted,path);return;}
    if(actual&&predicted&&typeof actual==='object'&&typeof predicted==='object'){
      assert.equal(Array.isArray(actual),Array.isArray(predicted),path);
      const keys=Object.keys(actual).filter(key=>!(key==='userData'&&path.endsWith('.mesh')));
      assert.deepEqual(keys,Object.keys(predicted),path+' keys');
      for(const key of keys)compare(actual[key],predicted[key],path+'.'+key);
    }else assert.equal(actual,predicted,path);
  };
  compare(endpoint.cars,candidate.forecast);
});
