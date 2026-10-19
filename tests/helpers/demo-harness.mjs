import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const read = n => readFileSync(new URL(`../../src/${n}`, import.meta.url), 'utf8');
const physics = read('physics-main.js'), hud = read('ui-hud.js');
const part = (s, a, b) => { const i=s.indexOf(a), j=s.indexOf(b,i+a.length);if(i<0||j<i)throw Error(a);return s.slice(i,j); };
export const lanes = [-12.5,-7.5,-2.5,2.5,7.5,12.5];
export function car(lane,z,speed,extra={}) {
  return { mode:'highway', laneIdx:lane, targetX:lanes[lane], speed,desiredSpeed:speed,length:4.62,height:1.25,vx:0,vz:-speed,y:0,blastTimer:0,
    mesh:{position:{x:lanes[lane],y:0,z},rotation:{x:0,y:0,z:0},visible:true,userData:{wheels:[]}},...extra };
}
export function simulation(overrides={},cars=[],options={}) {
  const impacts=[], launches=[], frames=[];
  const el={classList:{remove(){},add(){},toggle(){}},textContent:'',style:{}};
  let seed=options.seed ?? 1;const math=Object.create(Math);math.random=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
  const context=vm.createContext({ Math:math, window:{}, document:{getElementById:()=>el}, cityBuildings:[], frontWheelSteerGroups:[], scrollingProps:[], carMeshGroup:{},
    THREE:{MathUtils:{clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),lerp:(a,b,t)=>a+(b-a)*t}},
    sound:{init(){},beep(){},speakAlert(){},playCrash(){}},showBanner(){},recordImpact:(...v)=>impacts.push(v),recordJump:()=>launches.push(1),
    destroyVehicle(){context.stateRef.isDestroyed=true;}, trafficCars:cars });
  const collision=part(physics,'    const dx = Math.abs(state.x - car.mesh.position.x);','\n  // Render the resolved pose').replace(/\n  \}\);\s*$/,'');
  const plannerOnly=read('highway-demo.js').split('// UI/lifecycle adapter.')[0].replace('250 / 3.6',`${options.trafficCap ?? 250} / 3.6`);
  vm.runInContext(`${read('driving-score.js')}\n${read('config.js')}\nconst keys={};\n${read('highway-traffic.js')}\n${plannerOnly}
  ${part(physics,'function wrapAnglePi(', 'function updateSimulation(')}
  ${part(physics,'function triggerPhysicsCollision(', 'function destroyVehicle(')}
  ${part(hud,'function triggerJump6m() {','function toggleAltitudeHold() {')}
  const planner=RoadsterHighwayDemoPlanner.create(LANE_CENTERS,WORLD_SPEED_SCALE);
  let frame={input:RoadsterHighwayDemoPlanner.neutral()};
  window.RoadsterDemo={isActive:()=>true,isBusy:()=>true,jumpHeight:()=>Math.max(2.3,...trafficCars.filter(c=>Math.abs(c.mesh.position.z)<50).map(c=>(c.height||1.25)+.8)),isRequestingJump:()=>true,input:()=>frame.input};
  const originalCollision=triggerPhysicsCollision; triggerPhysicsCollision=(...args)=>{if(!state.isDestroyed&&state.impactCooldown<=0)recordImpact(...args);originalCollision(...args)};
  function testStep(dt) {
    if(state.isDestroyed)return null;
    state.impactCooldown=Math.max(0,state.impactCooldown-dt);
    frame=planner.step(state,trafficCars,dt);if(frame.jump){triggerJump6m();recordJump();}
    const t=I18N[currentLang];
    ${part(physics,'  const isRealMode =','  const playerWorldZ =')}
    const playerWorldZ=0;
    highwayTraffic.step(trafficCars,{x:state.x,y:state.y,z:0,vx:state.vx,vz:state.vz},dt,LANE_CENTERS,WORLD_SPEED_SCALE);
    trafficCars.forEach(car=>{${collision}\n});
    return {frame,isAirborne,isRearThrusterFiring,isLiftFiring,airConsumedThisFrame};
  }
  globalThis.stateRef=state; globalThis.demoPlanner=planner;globalThis.testKeys=keys;`,context);
  Object.assign(context.stateRef,{x:2.5,y:0,z:0,speed:0,vx:0,vy:0,vz:0,...overrides});
  context.demoPlanner.reset(context.stateRef.x);
  return {context,state:context.stateRef,cars,impacts,launches,step:dt=>context.testStep(dt),stats:()=>context.demoPlanner.stats()};
}
