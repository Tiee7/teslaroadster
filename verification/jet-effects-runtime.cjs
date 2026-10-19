const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function loadEffectsRuntime(src,runtime='/tmp/roadster-three.min.js'){
 const events={},context=vm.createContext({console,Math,atob:s=>Buffer.from(s,'base64').toString('binary'),window:{innerWidth:1440,innerHeight:900,addEventListener(type,fn){(events[type]||=[]).push(fn)},dispatchEvent(e){events[e.type]?.forEach(fn=>fn(e))}},Event:class{constructor(type){this.type=type}},localStorage:{getItem(){return null},setItem(){}},document:{createElement(){return{getContext(){return {}}}},getElementById(){return{classList:{add(){},remove(){}}}}},sound:{speakAlert(){},playSonicBoom(){}},showBanner(){},triggerPhysicsCollision(){},cityBuildings:[],scrollingProps:[],performance:{now:()=>1000},cameraModeIndex:0});
 const read=f=>fs.readFileSync(path.join(src,f),'utf8');
 vm.runInContext(fs.readFileSync(runtime,'utf8'),context);
 vm.runInContext(read('driving-score.js')+'\n'+read('config.js'),context);
 const world=read('world.js'),start=world.indexOf('const bodyMaterial ='),end=world.indexOf('const highwayEnvGroup',start);
 vm.runInContext('const scene=new THREE.Scene();'+world.slice(start,end),context);
 for(const f of ['highway-traffic.js','vehicles.js','reference-exterior.js','reference-cockpit.js','npc-traffic-assets.js','reference-traffic.js'])vm.runInContext(read(f),context,{filename:f});
 const physics=read('physics-main.js');
 const section=(start,end)=>{const a=physics.indexOf(start),b=physics.indexOf(end,a+start.length);if(a<0||b<a)throw Error(start);return physics.slice(a,b)};
 vm.runInContext(`const keys={};${section('function wrapAnglePi(', 'function updateSimulation(')}
 function actualJetFrame(dt){const t=I18N[currentLang];${section('  const isRealMode =','  const playerWorldZ =')}${section('  const isCockpitFpv = (cameraModeIndex === 3);','  let activeCount = 0;')}return {isRearThrusterFiring,isRetroBrakeFiring,isLiftFiring,isDescendFiring,retroUsesRearNozzles,retroImpulseSeconds,airConsumedThisFrame};}
 playerWrapper.position.set(0,0,0);
 globalThis.effects={state,keys,step:actualJetFrame,car:carMeshGroup,attitude:roadsterAttitudeGroup,rearGimbal:rearNozzlesGimbalGroup,plumes:allThrusterPlumes,plumeState:thrusterPlumeState,lift:liftPlumes,top:descendPlumes,rear:rearPlumes,front:frontRetroPlumes,side:sideRcsPlumes,sonic:sonicBoomConeGroup,sonicMaterial:sonicCondensationMaterial,sonicGeometry:sonicCondensationGeometry,gasGeometry:coldGasEnvelopeGeometry,clear:clearThrusterVisuals,sonicUpdate:updateSonicCondensation,visualUpdate:updateColdGasVisuals,setMap(value){currentMap=value},setView(value){cameraModeIndex=value},time:coldGasTime};`,context);
 return{context,THREE:context.THREE,api:context.window.RoadsterVehicle,...context.effects};
}
module.exports={loadEffectsRuntime};
