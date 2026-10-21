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
for(const count of[12,16,20])test(`${count} actual coast NPCs: 1800s full-lap 3D motion, exclusive joins, no OBB overlap, no deadlock`,t=>{
 const player={x:-1000,y:500,z:1100},cars=coast.createTraffic(count,mesh,{add(){}},player),distance=cars.map(()=>0),stops=cars.map(()=>0);let maxStop=0;
 assert.equal(cars.filter(c=>c.mesh.visible).length,count);
 for(let tick=0;tick<1800*60;tick++){
  const before=cars.map(c=>c.coastDistance);coast.stepTraffic(cars,player,1/60);
  for(let i=0;i<cars.length;i++){
   const car=cars[i],length=coast.routes[car.coastRoute].length;let delta=car.coastDistance-before[i];if(delta<-length/2)delta+=length;
   distance[i]+=delta;stops[i]=car.speed<.05?stops[i]+1/60:0;maxStop=Math.max(maxStop,stops[i]);
   assert.ok(car.mesh.visible&&Number.isFinite(car.y)&&Number.isFinite(car.vy));assert.ok(delta>=-1e-8&&delta<=16.5/60+1e-7);
   if(tick%60===0)assert.ok(n.candidates(car.mesh.position.x,car.mesh.position.z).some(s=>s.road&&Math.abs(s.height-car.y)<.03));
   for(let j=0;j<i;j++)assert.equal(overlap(car,cars[j]),false,`tick ${tick}: routes ${car.coastRoute}/${cars[j].coastRoute}`);
  }
 }
 const stats=coast.trafficJunctionStats();for(let i=0;i<cars.length;i++)assert.ok(distance[i]>coast.routes[cars[i].coastRoute].length,'every NPC completes a whole route');
 assert.ok(maxStop<90&&stats.maximumWait<90&&stats.maximumHold<35,'bounded fair waiting, not global crawling or deadlock');
 assert.ok(stats.zones.every(z=>z.grants>5&&z.releases>4));
 t.diagnostic(JSON.stringify({count,seconds:1800,minDistance:Math.min(...distance),maxStop,...stats}));
});
