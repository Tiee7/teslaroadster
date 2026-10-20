import test from 'node:test';
import assert from 'node:assert/strict';
import { simulation, car, lanes } from './helpers/demo-harness.mjs';
import { lifecycleHarness, source } from './helpers/demo-lifecycle-harness.mjs';
import vm from 'node:vm';

const wall = (distance = 80, speed = 22) => lanes.map((_, lane) => car(lane, -distance, speed));
const exclusive = (input, label = '') => {
  assert.ok(!(input.brake > 0 && (input.throttle > 0 || input.boost > 0)), `brake must release both propulsion sources ${label}`);
};

// Expose observations from the real private prediction functions in memory.
// These insertions do not replace controls, integrators, or any decisions.
function predictionProbe(h, dt) {
  const production = source('highway-demo.js').split('// UI/lifecycle adapter.')[0];
  const anchor = /const currentThreat\s*=[^;]+;/;
  const point = /points\.push\(\{t,x:p\.x,metres:p\.metres(?:,speed:p\.speed)?\}\);/;
  assert.ok(anchor.test(production) && point.test(production), 'prediction probe anchors exist');
  const instrumented = production
    .replace('const RoadsterHighwayDemoPlanner =', 'globalThis.followingPredictionFactory =')
    .replace(anchor, match => `${match} globalThis.followingPredictionProbe={trajectory,controlsFor,live};`)
    .replace(point, 'points.push({t,x:p.x,metres:p.metres,speed:p.speed,gas:p.gas,freefall:p.freefall});');
  vm.runInContext(instrumented, h.context);
  h.context.followingPredictionFactory.create(lanes, 1.65).step(h.state, h.cars, dt);
  const probe = h.context.followingPredictionProbe;
  const leader = probe.live.find(other => other.x === 2.5);
  assert.ok(leader);
  return { controls: probe.controlsFor(h.state.speed, h.state.airRemaining, h.state.airRemaining < 4.3, leader),
    prediction: probe.trajectory([3], dt).at(-1) };
}

const floor=220/3.6;
for(const fps of [30,60,144]) {
  test(`slow boxed-in wall uses a real paid hop instead of braking below 220 at ${fps} Hz`,()=>{
    const h=simulation({speed:65,vz:-65},wall());
    let peak=0,air=0,minimum=Infinity,landed=false,paid=0;
    for(let frame=0;frame<4*fps;frame++){
      const before=h.state.speed,result=h.step(1/fps);assert.ok(result);
      exclusive(result.frame.input);
      if(result.frame.input.brake>0)assert.ok(h.state.speed>=floor-1e-9,'combined mechanical + paid retro stays above floor');
      minimum=Math.min(minimum,h.state.speed);peak=Math.max(peak,h.state.y);paid+=result.airConsumedThisFrame;
      if(result.isAirborne){air+=1/fps;assert.equal(result.frame.input.throttle,0);assert.equal(result.frame.input.boost,0);assert.equal(result.frame.input.lift,0);}
      if(h.launches.length&&h.state.y===0)landed=true;
      assert.ok(h.state.speed-before<=40/fps+.01,'no speed assignment');
      assert.ok(h.state.airRemaining>=0&&h.state.airRemaining<=10);
    }
    assert.equal(h.launches.length,1);assert.ok(minimum>=floor);assert.ok(peak>=2&&peak<4);
    assert.ok(air<1.6);assert.equal(landed,true);assert.ok(paid>1);
    assert.equal(h.impacts.length,0);assert.equal(h.state.isDestroyed,false);
  });
  test(`braking above 220 remains paid and releases both propulsion requests at ${fps} Hz`,()=>{
    const h=simulation({speed:75,vz:-75},wall(80,62));let frames=0,paid=0;
    for(let i=0;i<4*fps;i++){
      const f=h.step(1/fps);exclusive(f.frame.input);
      if(f.frame.input.brake>0){frames++;paid+=f.airConsumedThisFrame;assert.equal(f.isRearThrusterFiring,false);}
      assert.ok(h.state.speed>=floor-1e-9);
    }
    assert.ok(frames>0);assert.ok(paid>0);assert.equal(h.launches.length,0);assert.equal(h.impacts.length,0);
  });
}

test('prediction and actual H obey the floor across fractional tanks, freefall and long frames',()=>{
  // At80m the new continuous-boost policy has no braking demand: the prior
  // brake came only from the retired250 cruise cap. Keep that old position as
  // an explicit no-fake-brake check, then use40m for actual H/retro coverage.
  const clearHarness=simulation({speed:75,vz:-75},wall(80,62));
  const clear=predictionProbe(clearHarness,.025);
  assert.equal(clear.controls.brake,0);assert.ok(clear.controls.boost>0);
  const clearActual=clearHarness.step(.025);
  assert.equal(clearActual.frame.input.brake,0);assert.ok(clearActual.frame.input.boost>0);
  assert.ok(Math.abs(clear.prediction.speed-clearHarness.state.speed)<1e-6);
  assert.ok(Math.abs(clear.prediction.gas-clearHarness.state.airRemaining)<1e-9);
  for(const dt of [1/144,1/60,1/30,.1])for(const [airRemaining,isFreefalling] of [[10,false],[.001,false],[0,true],[1,true],[2.49,true]]){
    const h=simulation({speed:75,vz:-75,airRemaining,isFreefalling},wall(40,62));
    // One predictor sample is 25ms; compare that exact integration step.
    const {prediction,controls}=predictionProbe(h,.025);
    exclusive(controls);assert.ok(controls.brake>0);
    const f=h.step(.025);assert.equal(f.frame.input.brake,controls.brake);
    assert.ok(prediction.speed>=floor);assert.ok(h.state.speed>=floor);
    assert.ok(Math.abs(prediction.speed-h.state.speed)<1e-6);
    assert.ok(Math.abs(prediction.gas-h.state.airRemaining)<1e-9);
    const direct=simulation({speed:floor+.01,vz:-floor-.01,airRemaining,isFreefalling},wall(40,62));
    const near=direct.step(dt);if(near.frame.input.brake>0)assert.ok(direct.state.speed>=floor-1e-9,'actual brake cannot cross the floor');
    else if(isFreefalling)assert.equal(near.frame.input.brake,0,'unavailable boost may coast naturally, never command a below-floor brake');
  }
});

test('empty/freefall tanks cannot synthesize a hop or fuel to clear an unavoidable wall',()=>{
  for(const airRemaining of [0,.001,1]){
    const h=simulation({speed:65,vz:-65,airRemaining,isFreefalling:true},wall(20));
    const f=h.step(1/60);exclusive(f.frame.input);
    assert.equal(f.frame.jump,false);assert.equal(f.frame.input.brake,0);
    assert.equal(f.isRearThrusterFiring,false);assert.equal(f.airConsumedThisFrame,0);
    assert.ok(h.state.airRemaining<=airRemaining+3.4/60+1e-9,'only ordinary grounded recharge');
    assert.ok(h.state.speed>floor);
  }
  const h=simulation({speed:65,vz:-65,airRemaining:0,isFreefalling:true},wall(8));
  for(let i=0;i<20&&!h.state.isDestroyed;i++)h.step(1/60);
  assert.equal(h.launches.length,0);assert.ok(h.impacts.length>0,'real collision remains possible with no usable gas');
});

test('manual W/H precedence remains unchanged before and after demo ownership', async () => {
  for (const afterDemo of [false, true]) {
    const powered = lifecycleHarness();
    if (afterDemo) { await powered.demo.toggle(); powered.demo.stop(); }
    Object.assign(powered.state, { speed: 65, vz: -65, y: 0, vy: 0, airRemaining: 10, isFreefalling: false });
    powered.keys.KeyW = powered.keys.KeyH = true;
    const simultaneous = powered.context.fullMotion(1 / 60);
    const expectedCoast = powered.context.getGroundCoastSpeed(65, 1 / 60, true);
    assert.ok(Math.abs(powered.state.speed - expectedCoast) < 1e-9, 'held W keeps its established precedence over H');
    assert.equal(simultaneous.airConsumedThisFrame, 0);
    assert.equal(powered.demo.isBusy(), false);

    const braking = lifecycleHarness();
    if (afterDemo) { await braking.demo.toggle(); braking.demo.stop(); }
    Object.assign(braking.state, { speed: 65, vz: -65, y: 0, vy: 0, airRemaining: 10, isFreefalling: false });
    braking.keys.KeyH = true;
    const manualBrake = braking.context.fullMotion(1 / 60);
    assert.ok(manualBrake.airConsumedThisFrame > 0);
    assert.ok(braking.state.speed < powered.state.speed);
    assert.equal(braking.demo.isBusy(), false);
  }
});

test('binding long-frame brake clip predicts and pays only the impulse down to 220',()=>{
 for(const dt of [.25,.5]){
  const h=simulation({speed:65,vz:-65,airRemaining:10,isFreefalling:false},wall(6,61.7));
  predictionProbe(h,dt);
  const probe=h.context.followingPredictionProbe,leader=probe.live.find(o=>o.x===2.5);
  const controls=probe.controlsFor(65,10,false,leader,0,0,false,dt);
  assert.ok(controls.brake>0&&controls.brake<.21,'floor cap binds');exclusive(controls);
  const input={...h.context.followingPredictionFactory.neutral(),throttle:controls.throttle,boost:controls.boost,brake:controls.brake};
  h.cars.length=0;
  h.context.demoPlanner.step=()=>({input,jump:false,status:'brake',targetLane:3});
  const result=h.step(dt);
  assert.ok(h.state.speed>=floor);assert.ok(h.state.speed<floor+1e-5);
  assert.ok(Math.abs(result.airConsumedThisFrame-.026544270131153243)<1e-9);
  assert.ok(Math.abs(h.state.airRemaining-(10-result.airConsumedThisFrame))<1e-9);
  assert.equal(h.impacts.length,0);assert.equal(h.launches.length,0);
 }
});
