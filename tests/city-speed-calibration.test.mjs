// Read-only CPU calibration; baseline source, actual animate branch, actual clock,
// production movement slice and chase helper. NOT a browser/phone benchmark.
import vm from 'node:vm';import{readFileSync}from'node:fs';import test from'node:test';import assert from'node:assert/strict';
import {motionHarness} from './helpers/motion-harness.mjs';
const src=Object.fromEntries(['config.js','driving-score.js','physics-main.js','city-clock.js'].map(n=>[n,readFileSync(new URL('../src/'+n,import.meta.url),'utf8')]));
const clockApi=vm.runInNewContext(src['city-clock.js']+'\nRoadsterCityClock;');let results=[];
for(const fps of[10,15,20,30,60,144])test(`actual city animate+motion+HUD+camera: 120km/h travels 300m in nine seconds at ${fps}Hz`,t=>{
 const h=motionHarness({speed:120/3.6,vz:-120/3.6,x:6},'city',src);
 // The smallest legitimate positive analogue throttle chooses the unchanged
 // production drive branch; its impulse rounds to zero. No speed assignment
 // is made after initialization; speed/displacement/HUD/time factors are unchanged.
 h.context.window.RoadsterTouch={readInput:()=>({throttle:1e-20})};
 const pos={};h.context.camera={position:{set(x,y,z){Object.assign(pos,{x,y,z})}},lookAt(){}};
 const rig=dt=>vm.runInContext(`updateChaseCamera({x:state.x,y:state.y,z:state.z},{x:0,y:2.3275,z:4.05},{x:0,y:.65,z:-10},${dt},{x:0,y:0,z:0})`,h.context);rig(0);const cam0=pos.z;
 let now=0,sim=0,presentations=0,minHUD=Infinity,maxHUD=-Infinity;
 const events={};const c=vm.createContext({currentMap:'city',lastTime:0,state:h.state,trafficCars:[],camera:h.context.camera,RoadsterCityClock:clockApi,performance:{now:()=>now},requestAnimationFrame(){},document:{hidden:false,getElementById:()=>({classList:{contains:()=>true}}),addEventListener:(k,f)=>events[k]=f},window:{addEventListener:(k,f)=>events[k]=f,RoadsterRanked:{tick(){}},RoadsterTaxi:{tick(){},present(){}},RoadsterDemo:{isActive:()=>false}},sound:{update(){}},renderer:{render(){}},scene:{},updateDestroyedScores(){},readDriveInput:()=>({}),updateSimulation(dt,present){h.step(dt);sim+=dt;const hud=vm.runInContext('Math.round(RoadsterDrivingScore.displayedSpeed(state,false)*3.6)',h.context);minHUD=Math.min(minHUD,hud);maxHUD=Math.max(maxHUD,hud);if(present!==null){presentations++;rig(present);}}});
 const p=src['physics-main.js'];vm.runInContext(p.slice(p.indexOf('// Scope the fixed clock'),p.indexOf("window.addEventListener('resize'")),c);
 for(let i=0;i<fps*9;i++){now=(i+1)*1000/fps;c.animate(now);}
 const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
 close(now/1000,9);close(sim,9);close(-h.state.z,300);close(cam0-pos.z,300);close(pos.z-h.state.z,4.05);assert.equal(minHUD,120);assert.equal(maxHUD,120);
 t.diagnostic(JSON.stringify({scope:'synthetic RAF/CPU integration, not a human cruise or device/WebGL FPS measurement',fps,wallSeconds:now/1000,metres:-h.state.z,cameraMetres:cam0-pos.z,HUD:[minHUD,maxHUD],presentations}));
});
