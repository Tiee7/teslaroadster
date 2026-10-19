import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const before=process.env.BEFORE_REPO;
if(!before)throw Error('Set BEFORE_REPO to an aa3cf088 baseline checkout');
const after=process.env.REPO || process.cwd();
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const hashes=()=>Object.fromEntries(['src/highway-demo.js','src/physics-main.js'].map(p=>[p,hash(`${after}/${p}`)]));
const sourceHashes=hashes();
const old=await import(pathToFileURL(`${before}/tests/helpers/demo-harness.mjs`));
const next=await import(pathToFileURL(`${after}/tests/helpers/demo-harness.mjs`));
const source=readFileSync(`${after}/src/highway-demo.js`,'utf8').split('// UI/lifecycle adapter.')[0];
const ctx=vm.createContext({});vm.runInContext(source+'\nglobalThis.api=RoadsterHighwayDemoPlanner',ctx);
const api=ctx.api;
let randomSeed=924;const random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/2**32;};
// Independent slab reference includes a strict-open midpoint feasibility check.
function reference(x0,z0,x1,z1,hx,hz){
 const candidates=[0,1];
 for(const [a,b,h] of [[x0,x1,hx],[z0,z1,hz]])if(b!==a)candidates.push((-h-a)/(b-a),(h-a)/(b-a));
 const t=[...new Set(candidates.filter(x=>x>=0&&x<=1))].sort((a,b)=>a-b);
 for(let i=0;i<t.length-1;i++){
  const m=(t[i]+t[i+1])/2;
  if(Math.abs(x0+(x1-x0)*m)<hx&&Math.abs(z0+(z1-z0)*m)<hz)return t[i];
 }
 return null;
}
for(let i=0;i<50000;i++){
 const args=[...Array(4)].map(()=>random()*40-20).concat([.1+random()*4,.1+random()*8]);
 const expected=reference(...args),actual=api.sweptContact(...args);
 assert.equal(actual===null,expected===null,JSON.stringify(args));
 if(actual!==null)assert.ok(Math.abs(actual-expected)<1e-10);
}
const keys=['x','y','z','speed','vx','vy','vz','yaw','steerInput','airRemaining','hullIntegrity','vYaw','vPitch','vRoll'];
let comparedFrames=0,manualInputChecks=0;
const checkedManualKeysets=new Set();
for(const map of ['highway','city'])for(const air of [false,true])for(const mode of ['realistic','fantasy'])for(const keyset of [[],['KeyW','KeyD'],['KeyH','KeyA'],['Semicolon','KeyD'],['KeyU','KeyA','KeyW']]){
 const overrides={speed:65,vz:-65,vx:2,y:air?35:0,vy:air?-3:0,physicsMode:mode};
 const a=old.simulation(overrides,[],{seed:3}),b=next.simulation(overrides,[],{seed:3});
 for(const h of [a,b]){
  h.context.window.RoadsterDemo.isActive=()=>false;
  h.context.window.RoadsterDemo.isBusy=()=>false;
  h.context.demoPlanner.step=()=>({input:api.neutral(),jump:false,status:'drive',targetLane:3});
  vm.runInContext(`currentMap='${map}'`,h.context);
  for(const key of keyset)h.context.testKeys[key]=true;
 }
 for(let frame=0;frame<120;frame++){
  for(const h of [a,b]){
   assert.equal(h.context.window.RoadsterDemo.isActive(),false);
   assert.equal(h.context.window.RoadsterDemo.isBusy(),false);
   const input=JSON.parse(vm.runInContext('JSON.stringify(readDriveInput())',h.context));
   assert.deepEqual(input,{steer:Number(keyset.includes('KeyD'))-Number(keyset.includes('KeyA')),throttle:Number(keyset.includes('KeyW')),boost:Number(keyset.includes('Semicolon')),brake:Number(keyset.includes('KeyH')),reverse:0,handbrake:Number(keyset.includes('KeyU')),lift:0,descend:0,strafe:0,roll:0,pitch:0},`actual keyboard input: ${keyset}`);
   manualInputChecks++;
  }
  checkedManualKeysets.add(keyset.join('+')||'neutral');
  a.step(1/60);b.step(1/60);comparedFrames++;
  for(const key of keys)assert.equal(b.state[key],a.state[key],`${map}/${air}/${mode}/${keyset}/${frame}: ${key}`);
 }
}
function grazingCase(active){
 const c=next.car(3,-5.1,0);
 const h=next.simulation({x:.8,y:0,speed:65,vz:-65,vx:-20,airRemaining:10},[c]);
 h.context.window.RoadsterDemo.isActive=()=>active;
 h.context.window.RoadsterDemo.isBusy=()=>active;
 h.context.demoPlanner.step=()=>({input:api.neutral(),jump:false,status:'drive',targetLane:3});
 const start={x:h.state.x,z:c.mesh.position.z};
 h.step(1/30);
 return {active,impacts:h.impacts.length,crashed:!!h.state.isDestroyed,start,end:{x:h.state.x,z:c.mesh.position.z},endpointDx:Math.abs(h.state.x-c.mesh.position.x)};
}
const demoGraze=grazingCase(true),manualGraze=grazingCase(false);
assert.ok(demoGraze.endpointDx>1.85,'endpoint is outside lateral collision envelope');
assert.equal(demoGraze.impacts,1,'continuous ground-demo corner sweep invokes actual collision');
assert.equal(manualGraze.impacts,0,'same endpoint-only normal branch remains unchanged');
assert.deepEqual(hashes(),sourceHashes,'production candidate stayed frozen');
const report={sourceHashes,productionSourcesUnchanged:true,sweptRandomCases:50000,manualEqualityFrames:comparedFrames,manualConfigurations:40,manualDemoOwnershipDisabled:true,manualInputChecks,manualKeysets:[...checkedManualKeysets],demoGraze,manualGraze};
writeFileSync(process.env.OUTPUT || 'verification/demo-close-weaving/independent-review.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
