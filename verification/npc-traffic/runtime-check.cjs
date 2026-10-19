const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const runtime=process.argv[2]||'/tmp/roadster-three.min.js';const events={};
const context=vm.createContext({console,Math:Object.create(Math),Float32Array,Uint16Array,Uint32Array,Event:class{constructor(type){this.type=type;}},window:{innerWidth:1440,innerHeight:900,addEventListener(type,fn){(events[type]||=[]).push(fn);},dispatchEvent(e){events[e.type]?.forEach(fn=>fn(e));}},localStorage:{getItem(){return null;},setItem(){}},document:{createElement(){return{getContext(){return{};}};}},atob:text=>Buffer.from(text,'base64').toString('binary')});
vm.runInContext(fs.readFileSync(runtime,'utf8'),context);const T=context.THREE;assert.equal(T.REVISION,'128');
const config=fs.readFileSync('src/config.js','utf8'),world=fs.readFileSync('src/world.js','utf8'),start=world.indexOf('const bodyMaterial ='),end=world.indexOf('const highwayEnvGroup',start);
const declarations=['LANE_COUNT','LANE_CENTERS','CITY_ROAD_COORDS','WORLD_SPEED_SCALE'].map(name=>config.match(new RegExp('^const '+name+' = [^;]+;','m'))[0]).join('\n');
vm.runInContext("const scene=new THREE.Scene();let currentMap='highway';\n"+declarations+"\n"+world.slice(start,end),context);
for(const file of ['highway-traffic.js','vehicles.js','reference-exterior.js','reference-cockpit.js','npc-traffic-assets.js','reference-traffic.js'])vm.runInContext(fs.readFileSync('src/'+file,'utf8'),context);
vm.runInContext('this.makeCar=createTrafficVehicleMesh;this.populate=populateTraffic;this.cars=()=>trafficCars;',context);
const api=context.window.RoadsterTrafficAssets,report={runtime:T.REVISION,assetSha256:crypto.createHash('sha256').update(fs.readFileSync('src/npc-traffic-assets.js')).digest('hex'),variants:[],populationCycles:0,normalWindingDisagreements:0,rearOcclusionMisses:[]};
const ray=new T.Raycaster(),eye={x:0,y:0,z:0};
for(const variant of api.variants){
 const car=context.makeCar(4,variant.id);car.updateMatrixWorld(true);const row={id:variant.id,levels:[]};
 for(const level of ['near','far']){
  car.position.z=level==='near'?0:100;api.updateLods([{mesh:car}],eye);car.updateMatrixWorld(true);assert.equal(car.userData.trafficDetail,level);
  let triangles=0;for(const mesh of car.children){assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,false);assert.equal(mesh.material.side,T.FrontSide);const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,ix=g.index.array;triangles+=ix.length/3;
   for(let i=0;i<ix.length;i+=3){const a=new T.Vector3().fromBufferAttribute(p,ix[i]),b=new T.Vector3().fromBufferAttribute(p,ix[i+1]),c=new T.Vector3().fromBufferAttribute(p,ix[i+2]);const face=b.sub(a).cross(c.sub(a));if(face.length()<1e-8)continue;const avg=new T.Vector3();for(let k=0;k<3;k++)avg.add(new T.Vector3().fromBufferAttribute(n,ix[i+k]));if(face.dot(avg)<-1e-7)report.normalWindingDisagreements++;}
  }
  assert.equal(triangles,car.userData.triangleCount);assert.ok(triangles<=(level==='near'?19000:3500));
  let hits=0,misses=0;for(let x=-.60;x<=.601;x+=.10)for(let y=.25;y<=.601;y+=.05){ray.set(new T.Vector3(x,y,car.position.z+3),new T.Vector3(0,0,-1));const intersections=ray.intersectObject(car,true);if(intersections.length)hits++;else{misses++;report.rearOcclusionMisses.push({id:variant.id,level,x,y});}}
  row.levels.push({level,triangles,draws:car.children.length,rearTestHits:hits,rearTestMisses:misses});
 }
 report.variants.push(row);
}
const started=performance.now();for(const map of ['highway','city']){vm.runInContext("currentMap='"+map+"'",context);for(let cycle=0;cycle<30;cycle++){context.populate([20,36,52,0,52][cycle%5]);const cars=context.cars();api.updateLods(cars,eye);assert.ok(cars.length<=52);assert.ok(cars.filter(c=>c.mesh.userData.trafficDetail==='near').length<=8);report.populationCycles++;}}
report.populationCpuMs=Math.round(performance.now()-started);report.stats=api.stats();assert.ok(report.stats.cachedGeometries<=report.stats.maximumGeometries);assert.equal(report.normalWindingDisagreements,0);fs.writeFileSync('verification/npc-traffic/runtime-result.json',JSON.stringify(report,null,2)+'\n');assert.equal(report.rearOcclusionMisses.length,0);report.pass=true;
fs.writeFileSync('verification/npc-traffic/runtime-result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
