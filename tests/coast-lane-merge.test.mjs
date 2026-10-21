import test from'node:test';import assert from'node:assert/strict';import vm from'node:vm';import{readFileSync}from'node:fs';
const c=vm.createContext({window:{}});for(const p of['coast-road-network','coast-map'])vm.runInContext(readFileSync(new URL(`../src/${p}.js`,import.meta.url),'utf8'),c);
const coast=c.window.RoadsterCoast,n=coast.network;
const vector=()=>({x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}}),mesh=()=>({visible:true,position:vector(),rotation:vector(),userData:{length:4.62,height:1.25,wheels:[]}});
function overlap(a,b){
 const A=a.mesh.position,B=b.mesh.position;if(A.y+a.height<=B.y||B.y+b.height<=A.y)return false;
 const dx=B.x-A.x,dz=B.z-A.z;if(dx*dx+dz*dz>25)return false;
 const yawA=a.mesh.rotation.y,yawB=b.mesh.rotation.y;
 const axes=[[Math.sin(yawA),Math.cos(yawA)],[Math.cos(yawA),-Math.sin(yawA)],[Math.sin(yawB),Math.cos(yawB)],[Math.cos(yawB),-Math.sin(yawB)]];
 for(const [x,z]of axes){const extent=yaw=>2.31*Math.abs(x*Math.sin(yaw)+z*Math.cos(yaw))+.98*Math.abs(x*Math.cos(yaw)-z*Math.sin(yaw));if(Math.abs(dx*x+dz*z)>=extent(yawA)+extent(yawB)-1e-7)return false;}return true;
}
for(const route of[0,2])for(const jitter of[-.2,0,.2])for(const reverseOrder of[false,true])test(`three parallel lanes safely merge: route${route}, stagger${jitter}, order${reverseOrder}`,()=>{
 const player={x:-1000,y:500,z:1100},cars=coast.createTraffic(3,mesh,{add(){}},player),moved=cars.map(()=>0),narrow=new Set();
 for(let i=0;i<3;i++){
  const lane=1.75+3.5*i,path=n.trafficPath(route,lane),target=(route===0?4750:3300)+jitter*i,station=path.stations.reduce((a,b)=>Math.abs(a.sxz-target)<Math.abs(b.sxz-target)?a:b),p=n.sampleRoute(route,station.s,lane),car=cars[i];
  Object.assign(car,{coastRoute:route,coastLane:lane,coastRouteLength:path.length,coastDistance:station.s,coastWaiting:false,coastCooldown:0,speed:14,desiredSpeed:14,y:p.y,coastSupportId:p.supportId,vx:p.vx*14,vy:p.vy*14,vz:p.vz*14});car.mesh.position.set(p.x,p.y,p.z);car.mesh.rotation.set(p.pitch,p.yaw,p.roll);car.mesh.visible=true;
 }
 if(reverseOrder)cars.reverse();
 for(let tick=0;tick<90*60;tick++){
  const before=cars.map(c=>c.coastDistance);coast.stepTraffic(cars,player,1/60);
  for(let i=0;i<3;i++){let delta=cars[i].coastDistance-before[i];if(delta<0)delta+=cars[i].coastRouteLength;moved[i]+=delta;const p=n.sampleRoute(route,cars[i].coastDistance,cars[i].coastLane);if(p.wide<.001)narrow.add(cars[i]);for(let j=0;j<i;j++)assert.equal(overlap(cars[i],cars[j]),false,`tick${tick} lanes${cars[i].coastLane}/${cars[j].coastLane}`);}
 }
 assert.equal(narrow.size,3,'all three physically complete the lane convergence');assert.ok(Math.min(...moved)>350,'no merge deadlock or global crawl');
});
