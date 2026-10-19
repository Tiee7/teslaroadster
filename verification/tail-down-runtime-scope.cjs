/** Local CPU proof vs the exact published baseline. Not WebGL/FPS evidence.
 * node verification/tail-down-runtime-scope.cjs /tmp/roadster-three.min.js [out.json]
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),baseline=process.env.ROADSTER_TAIL_BASELINE||'cf3e7729c863e3d40e4645c0dbe83ab556d51ade',runtime=fs.readFileSync(process.argv[2],'utf8');
const sha=x=>crypto.createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const bytes=(revision,file)=>revision==='current'?fs.readFileSync(path.join(root,file)):execFileSync('git',['show',revision+':'+file],{cwd:root,maxBuffer:128*1024*1024});
const source=(revision,file)=>bytes(revision,file).toString('utf8');
const files=execFileSync('git',['ls-tree','-r','--name-only',baseline,'src','api','lib','assets'],{cwd:root,encoding:'utf8'}).trim().split('\n');
const protectedSources={};for(const file of files){if(file==='src/reference-exterior.js')continue;const now=bytes('current',file);assert.ok(now.equals(bytes(baseline,file)),'Unrelated production file changed: '+file);protectedSources[file]=sha(now);}
const load=revision=>{
 const c=vm.createContext({console,Math,Float32Array,Uint16Array,Uint32Array,atob:t=>Buffer.from(t,'base64').toString('binary'),Event:class{constructor(type){this.type=type;}},window:{innerWidth:1440,innerHeight:900,addEventListener(){},dispatchEvent(){}},localStorage:{getItem(){return null;},setItem(){}},document:{createElement(){return{getContext(){return{};}};}}});
 vm.runInContext(runtime,c);assert.equal(c.THREE.REVISION,'128');
 const world=source(revision,'src/world.js'),start=world.indexOf('const bodyMaterial ='),end=world.indexOf('const highwayEnvGroup',start);
 vm.runInContext(`const scene=new THREE.Scene();const currentMap='highway';const WORLD_SPEED_SCALE=${Number(source(revision,'src/config.js').match(/const WORLD_SPEED_SCALE = ([\d.]+)/)[1])};${world.slice(start,end)}`,c);
 for(const file of ['highway-traffic.js','vehicles.js','reference-exterior.js','reference-cockpit.js','npc-traffic-assets.js','reference-traffic.js'])vm.runInContext(source(revision,'src/'+file),c,{filename:file});
 vm.runInContext('this.parts={carMeshGroup,setCockpitPerspective,setCockpitExteriorDetailsVisible,createTrafficVehicleMesh};',c);return c;
};
const visible=o=>{for(let n=o;n;n=n.parent)if(!n.visible)return false;return true;};
const mat=m=>({type:m.type,color:m.color?.getHex(),emissive:m.emissive?.getHex(),emissiveIntensity:m.emissiveIntensity,side:m.side,transparent:m.transparent,opacity:m.opacity,roughness:m.roughness,metalness:m.metalness,clearcoat:m.clearcoat,colorWrite:m.colorWrite,depthWrite:m.depthWrite});
function count(root){let colorMeshes=0,colorTriangles=0,shadowMeshes=0,shadowTriangles=0;const appearance=[];root.updateMatrixWorld(true);root.traverse(o=>{
 if(!o.isMesh||!visible(o))return;const ms=Array.isArray(o.material)?o.material:[o.material],g=o.geometry,tri=(g.index?.count??g.attributes.position.count)/3;
 if(!ms.every(m=>m.colorWrite===false)){colorMeshes++;colorTriangles+=tri;appearance.push({name:o.name,attributes:Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,sha(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength))])),index:g.index&&sha(Buffer.from(g.index.array.buffer,g.index.array.byteOffset,g.index.array.byteLength)),matrix:o.matrixWorld.toArray(),material:ms.map(mat)});}
 if(o.castShadow){shadowMeshes++;shadowTriangles+=tri;}
 });return{colorMeshes,colorTriangles,shadowMeshes,shadowTriangles,appearanceHash:sha(appearance)};}
function report(c){const p=c.parts,api=c.window.RoadsterVehicle,result={vehicles:{},npc:{}};
 for(const model of ['reference','classic'])for(const cockpit of ['reference','classic'])for(const active of [false,true]){api.setModel(model);api.setCockpit(cockpit);p.setCockpitPerspective(active);p.setCockpitExteriorDetailsVisible(!active);result.vehicles[`${model}:${cockpit}:${active?'fpv':'external'}`]=count(p.carMeshGroup);}
 for(let i=0;i<30;i++)result.npc[i]=count(p.createTrafficVehicleMesh(i,c.window.RoadsterTrafficAssets.variants[i%15].id));
 let visits=0;const original=c.THREE.Object3D.prototype.getObjectByProperty;c.THREE.Object3D.prototype.getObjectByProperty=function(...a){visits++;return original.apply(this,a);};
 result.recursiveViewLookups={};for(const active of [false,true]){p.setCockpitPerspective(active);p.setCockpitExteriorDetailsVisible(!active);visits=0;for(let i=0;i<1000;i++){p.setCockpitPerspective(active);p.setCockpitExteriorDetailsVisible(!active);}result.recursiveViewLookups[active?'fpv':'external']=visits;}
 c.THREE.Object3D.prototype.getObjectByProperty=original;return result;
}
const beforeContext=load(baseline),afterContext=load('current'),before=report(beforeContext),after=report(afterContext);
for(const key of Object.keys(before.vehicles)){const a=before.vehicles[key],b=after.vehicles[key];assert.equal(b.colorMeshes,a.colorMeshes,key+' mesh count');assert.equal(b.colorTriangles,a.colorTriangles,key+' color triangle count');if(key.startsWith('classic:'))assert.equal(b.appearanceHash,a.appearanceHash,key+' classic appearance');}
assert.deepEqual(after.npc,before.npc,'All30 deterministic NPC style/LOD samples remain exact.');assert.deepEqual(after.recursiveViewLookups,{external:0,fpv:0});
let maxShadowDeviation=0,shadowGridMeshes=0;const T=afterContext.THREE;
afterContext.parts.carMeshGroup.traverse(part=>{
 const rs=part.userData.shadowGridRows,cs=part.userData.shadowGridColumns;if(!rs||!cs)return;shadowGridMeshes++;const p=part.geometry.attributes.position,columns=part.userData.surfaceColumns,point=(r,c)=>new T.Vector3().fromBufferAttribute(p,r*(columns+1)+c);
 for(let ri=0;ri<rs.length-1;ri++)for(let ci=0;ci<cs.length-1;ci++){
  const r0=rs[ri],r1=rs[ri+1],c0=cs[ci],c1=cs[ci+1];
  for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){
   const u=(c-c0)/(c1-c0),v=(r-r0)/(r1-r0),a=point(r0,c0),b=point(r0,c1),lo=point(r1,c0),d=point(r1,c1);
   const q=v>=u?a.multiplyScalar(1-v).addScaledVector(lo,v-u).addScaledVector(d,u):a.multiplyScalar(1-u).addScaledVector(d,v).addScaledVector(b,u-v);
   maxShadowDeviation=Math.max(maxShadowDeviation,q.distanceTo(point(r,c)));
  }
 }
});
assert.ok(maxShadowDeviation<.02);assert.equal(after.vehicles['reference:reference:external'].shadowMeshes,2);assert.ok(after.vehicles['reference:reference:external'].shadowTriangles<15000);
const out={pass:true,generatedAt:new Date().toISOString(),baseline,sourceHash:sha(source('current','src/reference-exterior.js')),runtimeRevision:'128',runtimeSha256:sha(runtime),protectedSources,before,after,shadowGridMeshes,maxShadowSampleDeviationMetres:maxShadowDeviation,limits:'CPU pre-culling mesh/triangle counts, exact geometry/material/world-pose hashes, cached view lookup counts and source-grid shadow approximation only. Not GPU draw calls, FPS, browser input latency or live flight animation.'};
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({pass:out.pass,baseline,sourceHash:out.sourceHash,player:after.vehicles['reference:reference:external'],maxShadowSampleDeviationMetres:maxShadowDeviation,unchangedNpcSamples:30,protectedProductionFiles:Object.keys(protectedSources).length},null,2));
