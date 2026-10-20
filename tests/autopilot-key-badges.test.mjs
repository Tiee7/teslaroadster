import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { lifecycleHarness, deferred, response, flush } from './helpers/demo-lifecycle-harness.mjs';

const badges=['w','semi','h','s','u','a','d','space','shift','q','e','left','right','up','down','o'];
const lit=h=>badges.filter(id=>h.get(`key-${id}`).classList.contains('active')).sort();
function frame(h,input={},jump=false){
  h.context.adapterPlannerForTest.step=()=>({input:{throttle:0,boost:0,brake:0,reverse:0,handbrake:0,steer:0,lift:0,descend:0,strafe:0,roll:0,pitch:0,...input},jump,jumpHeight:2.3,status:'drive'});
  h.demo.step(1/60);
}

test('active autopilot animates the real key badges for every applied output, not synthetic keyboard input',async()=>{
  const h=lifecycleHarness();await h.demo.toggle();
  let soundInits=0;h.context.sound.init=()=>soundInits++;
  const state=JSON.stringify(h.state),keys=JSON.stringify(h.keys),events=(h.window.listeners.keydown||[]).length;
  for(const [input,expected] of [
    [{throttle:1,boost:.0001},['w','semi']], [{brake:.25},['h']], [{reverse:1,handbrake:1},['s','u']],
    [{steer:-.2,strafe:-.3,roll:1,pitch:1},['a','q','left','up']],
    [{steer:.2,strafe:.3,roll:-1,pitch:-1},['d','e','right','down']],
    [{lift:.2},['space']], [{descend:.7},['shift']], [{boost:NaN,steer:Infinity,roll:-Infinity},[]], [{},[]]
  ]){
    frame(h,input);assert.deepEqual(lit(h),expected.sort());
    assert.equal(JSON.stringify(h.keys),keys);assert.equal(JSON.stringify(h.state),state);
    assert.equal(h.demo.input().boost,input.boost??0,'badges never rewrite the actual control frame');
  }
  assert.equal(soundInits,0);assert.equal((h.window.listeners.keydown||[]).length,events);
  frame(h,{boost:1});await h.window.emit('keyup',{code:'Semicolon'});
  assert.deepEqual(lit(h),['semi'],'physical keyup cannot erase an automatic held action');
  frame(h,{});assert.deepEqual(lit(h),[],'neutral next frame releases the same active style');
});

test('O animates its actual jump phase without impersonating Space or retriggering takeoff',async()=>{
  const h=lifecycleHarness();await h.demo.toggle();frame(h,{},true);
  assert.deepEqual(lit(h),['o']);assert.equal(h.state.isJumping6m,true);
  const vy=h.state.vy;frame(h,{});assert.equal(h.state.vy,vy);assert.deepEqual(lit(h),['o']);
  h.state.isJumping6m=false;frame(h,{});assert.deepEqual(lit(h),[]);
});

test('manual shared-key badges aggregate correctly and resume normally after autopilot',async()=>{
  const h=lifecycleHarness();
  vm.runInContext("setKeyState('ShiftLeft',true);setKeyState('ShiftRight',true);setKeyState('ShiftLeft',false)",h.context);
  assert.deepEqual(lit(h),['shift']);
  vm.runInContext("setKeyState('ShiftRight',false);setKeyState('KeyJ',true);setKeyState('ArrowLeft',true);setKeyState('KeyJ',false)",h.context);
  assert.deepEqual(lit(h),['left']);
  vm.runInContext("setKeyState('ArrowLeft',false)",h.context);assert.deepEqual(lit(h),[]);
  await h.demo.toggle();frame(h,{throttle:1,boost:1});h.demo.stop();assert.deepEqual(lit(h),[]);
  await h.key('KeyW');assert.deepEqual(lit(h),['w']);assert.equal(h.keys.KeyW,true);
  await h.window.emit('keyup',{code:'KeyW'});assert.deepEqual(lit(h),[]);
});

test('stop, focus/visibility loss, reset, map/menu and performance exit clear automatic badges',async()=>{
  for(const cause of ['stop','blur','hidden','pagehide','reset','map','menu','performance']){
    const h=lifecycleHarness();await h.demo.toggle();frame(h,{throttle:1,boost:1,steer:-1});assert.ok(lit(h).length);
    if(cause==='stop')h.demo.stop();
    if(cause==='blur'||cause==='pagehide')await h.window.emit(cause);
    if(cause==='hidden'){h.document.hidden=true;await h.document.emit('visibilitychange');}
    if(cause==='reset')h.context.resetCar();
    if(cause==='map')h.context.switchMap('city');
    if(cause==='menu')h.context.openMapSelectModal();
    if(cause==='performance')h.demo.advanceFrame(.5,()=>{});
    assert.deepEqual(lit(h),[],cause);assert.equal(h.demo.isBusy(),false,cause);
  }
});

test('pending and cancelled preparations never leave old control animations',async()=>{
  const h=lifecycleHarness();await h.start();const end=deferred();
  h.network((url,options)=>url==='/api/end'?end.promise:h.defaultNetwork(url,options));
  const pending=h.demo.toggle();await flush();assert.equal(h.demo.isBusy(),true);assert.deepEqual(lit(h),[]);
  await h.demo.toggle();assert.deepEqual(lit(h),[]);
  end.resolve(response({ended:true,runId:'manual-1'}));await pending;
  assert.equal(h.demo.isBusy(),false);assert.deepEqual(lit(h),[]);
});
