// Conservative rejection only; production-block/native CPU, not browser/GPU.
import test from 'node:test';import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';import vm from'node:vm';
import{nativeWorld,nativeAvailable,physics}from'./helpers/coast-hull-native-harness.mjs';
const old=readFileSync(new URL('./fixtures/coast-building-separation-baseline/physics-main.js',import.meta.url),'utf8');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function drive(fps,index,{before=false,gap=1.4,steer=0,airborne=false,seconds=2.2}={}){
 const w=nativeWorld(),C=w.coast,b=C.layout().buildings[index],x=b.minX-8,z=gap===null?b.z:b.maxZ+gap,g=C.support({x,z,y:0,grounded:true}),yaw=-Math.PI/2,speed=20;
 const initial={x,y:g.height+(airborne?2:0),z,yaw,...C.network.groundAttitude(g.normal,yaw),speed,vx:speed,vy:0,vz:0,wasAirborne:airborne,coastSupportId:airborne?null:g.id};
 const h=w.makeRun(initial,'native',before?old:physics),rows=[];h.keys.KeyW=true;if(steer)h.keys.KeyA=true;
 for(let frame=0;frame<Math.ceil(seconds*fps);frame++){const result=h.step(1/fps);rows.push({frame,state:structuredClone(h.state),airborne:result?.isAirborne,impacts:structuredClone(h.impacts)});if(h.impacts.length)break;}
 return{w,b,h,initial,rows};
}
for(const fps of[30,60,144])for(const index of[0,1,2,3,4,5,6,7])test(`native-clear coast building${index} side drive retains real W motion without fixed-axis false hit at${fps}Hz`,{skip:!nativeAvailable},()=>{
 const a=drive(fps,index,{before:true}),b=drive(fps,index);assert.equal(a.h.impacts.length,1);assert.ok(a.h.impacts[0][0]>25);assert.ok(a.rows.at(-1).frame/fps>.25);
 const body=a.h.context.cityPlayerBody(a.h.state);assert.ok(body.z-body.rz-a.b.maxZ>.38,'whole conservative native Box3, not a chosen body point, clears actual wall');
 assert.equal(b.h.impacts.length,0);assert.equal(b.h.resets,0);assert.equal(b.h.state.wasAirborne,false);assert.equal(b.h.state.airRemaining,10);assert.ok(b.h.state.x>b.b.maxX+3,'continuous input traverses entire side, no teleport/rescue');
 for(let i=0;i<a.rows.length-1;i++)assert.deepEqual(b.rows[i],a.rows[i],'all unaffected pre-hit states/tank remain exact');
});
for(const fps of[30,60,144])for(const options of[{gap:null},{gap:3},{gap:1.4,steer:1},{gap:1.4,airborne:true}])test(`genuine/no-candidate/steered/airborne original building behavior stays exact${fps}Hz ${JSON.stringify(options)}`,{skip:!nativeAvailable},()=>{
 const a=drive(fps,2,{...options,before:true}),b=drive(fps,2,options);assert.deepEqual(b.rows,a.rows);if(options.gap===null)assert.ok(b.h.impacts.length,'true wall hit/damage remains');
});
test('separation certificate encloses native corners over translation/short-Euler/visual-lean paths',{skip:!nativeAvailable},()=>{
 const w=nativeWorld(),h=w.makeRun(),T=w.T,body=h.context.cityPlayerBody({x:0,y:0,z:0,pitch:0,yaw:0,roll:0}),local=[];
 for(const x of[-1,1])for(const y of[-1,1])for(const z of[-1,1])local.push(new T.Vector3(body.x+x*body.half[0],body.y+y*body.half[1],body.z+z*body.half[2]));
 const box={minX:-2,maxX:2,minZ:-3,maxZ:3},wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));let seed=37,clear=0,kept=0;
 const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
 for(let i=0;i<180;i++){
  const a={x:random()*30-15,y:0,z:random()*30-15,pitch:random()*6-3,yaw:random()*6-3,roll:random()*6-3},b={...a,x:a.x+random()*12-6,z:a.z+random()*12-6,pitch:a.pitch+(random()-.5)*.5,yaw:a.yaw+(random()-.5)*.5,roll:a.roll+(random()-.5)*.5};
  if(!h.context.coastBuildingSeparated(a,b,box)){kept++;continue;}clear++;
  for(let k=0;k<=16;k++)for(const pitchLean of[-.032,.032])for(const rollLean of[-.032,.032]){
   const t=k/16,q=new T.Quaternion().setFromEuler(new T.Euler(a.pitch+wrap(b.pitch-a.pitch)*t+pitchLean,a.yaw+wrap(b.yaw-a.yaw)*t,a.roll+wrap(b.roll-a.roll)*t+rollLean,'YXZ')),points=local.map(p=>p.clone().applyQuaternion(q).add(new T.Vector3(a.x+(b.x-a.x)*t,0,a.z+(b.z-a.z)*t))),bounds=new T.Box3().setFromPoints(points);
   assert.ok(bounds.max.x<box.minX||bounds.min.x>box.maxX||bounds.max.z<box.minZ||bounds.min.z>box.maxZ,'every certified sample is whole-native-box clear including both visual lean extremes');
  }
 }
 assert.ok(clear>70&&kept>5,'nonvacuous separated and retained paths');
 for(const bad of[NaN,Infinity])assert.equal(h.context.coastBuildingSeparated({x:bad,y:0,z:0},{x:bad,y:0,z:0},box),false,'nonfinite never grants separation');
});
test('default coastal clip API and surviving candidate response are unchanged, lazy gate runs only after original broad hit',()=>{
 const load=text=>{const c=vm.createContext({window:{}});vm.runInContext(read('src/coast-road-network.js')+'\n'+text,c);return c.window.RoadsterCoast;},a=load(read('tests/fixtures/coast-building-separation-baseline/coast-map.js')),b=load(read('src/coast-map.js')),building=a.layout().buildings[2];
 for(const z of[building.z,building.maxZ+1.4,building.maxZ+3]){
  const from={x:building.minX-10,y:0,z},next={x:building.maxX+10,y:0,z,vx:20,vz:0,speed:20},one=structuredClone(next),two=structuredClone(next);assert.deepEqual(structuredClone(b.clipBuildings(from,two)),structuredClone(a.clipBuildings(from,one)));assert.deepEqual(two,one);
  let calls=0;const three=structuredClone(next),four=structuredClone(next),expected=b.clipBuildings(from,three),actual=b.clipBuildings(from,four,()=>{calls++;return false;});assert.deepEqual(structuredClone(actual),structuredClone(expected));assert.deepEqual(four,three);assert.equal(calls,expected?1:0);
 }
});
test('missing native bounds and invalid pose angles fail closed without changing old hit ownership',{skip:!nativeAvailable},()=>{
 const w=nativeWorld(),h=w.makeRun(),plain=w.makeRun({},'fallback'),a={x:0,y:0,z:8,pitch:0,yaw:Math.PI/2,roll:0},b={...a,x:10},box={minX:-2,maxX:2,minZ:-3,maxZ:3};
 assert.equal(plain.context.coastBuildingSeparated(a,b,box),false,'fallback box is not evidence about approved native assets');
 assert.equal(h.context.coastBuildingSeparated(a,b,box),true);
 for(const key of['x','y','z','pitch','yaw','roll'])for(const bad of[NaN,Infinity,-Infinity,'0'])for(const end of[false,true])assert.equal(h.context.coastBuildingSeparated(end?a:{...a,[key]:bad},end?{...b,[key]:bad}:b,box),false,key+' invalid');
});
