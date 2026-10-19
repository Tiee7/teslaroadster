import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = name => readFileSync(new URL(`../../src/${name}`, import.meta.url), 'utf8');
export function installJetPhysics(context) {
  const physics = source('physics-main.js');
  const section = (start, end) => { const a=physics.indexOf(start),b=physics.indexOf(end,a+start.length); if(a<0||b<a)throw Error(start);return physics.slice(a,b); };
  Object.assign(context,{cityBuildings:[],scrollingProps:[],sound:{speakAlert(){},playSonicBoom(){}},showBanner(){},triggerPhysicsCollision(){},cameraModeIndex:0});
  context.document.getElementById ||= () => ({classList:{add(){},remove(){}}});
  context.THREE.MathUtils = {clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),lerp:(a,b,t)=>a+(b-a)*t};
  vm.runInContext(`${source('driving-score.js')}\n${source('config.js')}\nconst keys={};\n${section('function wrapAnglePi(', 'function updateSimulation(')}
  function testJetFrame(dt) {
    const t=I18N[currentLang];
    ${section('  const isRealMode =', '  const playerWorldZ =')}
    ${section('  const isCockpitFpv = (cameraModeIndex === 3);', '  let activeCount = 0;')}
    return {isAirborne,isRearThrusterFiring,isLiftFiring,isDescendFiring,isRetroBrakeFiring,retroImpulseSeconds,retroBrakeDemand,retroUsesRearNozzles,airConsumedThisFrame,rollInput,pitchInput,yawInput,airJetLeft,airJetRight};
  }
  globalThis.jetTest={state,keys,step:testJetFrame,setMap(value){currentMap=value},setView(value){cameraModeIndex=value},powers(){return allThrusterPlumes.map(p=>({power:thrusterPlumeState.get(p).power,visible:p.visible}));},resetVisuals(){clearThrusterVisuals();}};`,context);
  const api=context.jetTest,initial=JSON.parse(JSON.stringify(api.state));
  api.reset=(overrides={})=>{Object.assign(api.state,JSON.parse(JSON.stringify(initial)),{x:0,z:0,y:100,speed:0,vx:0,vy:0,vz:0,...overrides});for(const key of Object.keys(api.keys))delete api.keys[key];api.resetVisuals();};
  return api;
}
