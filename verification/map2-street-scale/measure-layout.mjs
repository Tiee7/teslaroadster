// CPU scene-graph evidence only: never creates a WebGLRenderer or claims phone FPS.
import vm from 'node:vm';
import {readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const base = '907a7029925d70ac1ebcd3e4e766767d599739e3';
const runtime = process.env.ROADSTER_THREE_RUNTIME || '/tmp/roadster-three.min.js';
const sha = s => createHash('sha256').update(s).digest('hex');
const runtimeBytes = readFileSync(runtime);
if (sha(runtimeBytes) !== '9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2') throw Error('Use the exact official production r128 runtime');
function measure(baseline) {
 const read = p => baseline ? execFileSync('git',['show',base+':'+p],{maxBuffer:20*1024*1024,encoding:'utf8'}) : readFileSync(p,'utf8');
 const world=read('src/world.js'),config=read('src/config.js'),c=vm.createContext({console});vm.runInContext(runtimeBytes.toString(),c);vm.runInContext(config,c);
 vm.runInContext(`const cityEnvGroup=new THREE.Group(),cityBuildings=[];let cityAsphaltMat=null,cityAsphaltEWMat=null;
 const dashMat=new THREE.MeshBasicMaterial(),titaniumMaterial=new THREE.MeshStandardMaterial(),createWetRoadDetail=()=>({});
 ${world.slice(world.indexOf('function buildOpenWorldCity()'),world.indexOf('buildOpenWorldCity();')+21)}
 globalThis.result={root:cityEnvGroup,buildings:cityBuildings,width:CITY_ROAD_WIDTH};`,c);
 let meshes=0,shadowCasters=0,lights=0,triangles=0,instances=0,bridges=0;
 c.result.root.traverse(o=>{if(o.isLight)lights++;if(!o.isMesh)return;meshes++;if(o.castShadow)shadowCasters++;
 const n=o.isInstancedMesh?o.count:1;instances+=n;triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3*n;
 if(o.geometry.parameters?.height===4.2&&o.geometry.parameters.depth===5.8)bridges++;});
 return {roadWidthMetres:c.result.width,laneWidthMetres:c.result.width/6,buildings:c.result.buildings.length,
 sceneMeshObjects:meshes,shadowCasters,lights,triangles,instances,bridges,worldSourceSha256:sha(world),configSourceSha256:sha(config)};
}
const before=measure(true),after=measure(false);
const evidence={baseCommit:base,runtimeSha256:sha(runtimeBytes),before,after,meshObjectReduction:before.sceneMeshObjects-after.sceneMeshObjects,
 boundary:'Actual Three r128 CPU scene graph and geometry. Mesh objects are potential rendering submissions before culling, not measured GPU draw calls, browser or phone FPS.'};
writeFileSync('verification/map2-street-scale/layout-before-after.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
