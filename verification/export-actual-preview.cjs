/** Export actual canonical production preview meshes, without WebGL or browser access.
 * node verification/export-actual-preview.cjs /tmp/roadster-three.min.js OUTPUT_DIR [SOURCE_DIR]
 * SOURCE_DIR defaults to ../src. No reconstructed or artist-generated geometry.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const runtime = process.argv[2], out = path.resolve(process.argv[3] || 'verification/visual-candidate');
const src = path.resolve(process.argv[4] || path.join(__dirname,'../src'));
if (!runtime) throw Error('Pass official Three.js r128 runtime.');
fs.mkdirSync(out,{recursive:true});
const events = {};
const context = vm.createContext({console,Math,Float32Array,Uint16Array,Uint32Array,atob:text=>Buffer.from(text,'base64').toString('binary'),
 Event:class{constructor(type){this.type=type;}},
 window:{innerWidth:1440,innerHeight:900,addEventListener(type,fn){(events[type]||=[]).push(fn);},dispatchEvent(e){events[e.type]?.forEach(fn=>fn(e));}},
 localStorage:{getItem(){return null;},setItem(){}},
 document:{createElement(){return {width:0,height:0,getContext(){return {};}};}}});
vm.runInContext(fs.readFileSync(runtime,'utf8'),context,{filename:path.basename(runtime)});
if(context.THREE.REVISION!=='128')throw Error('Runtime revision must match production r128.');
const world=fs.readFileSync(path.join(src,'world.js'),'utf8');
const start=world.indexOf('const bodyMaterial ='), end=world.indexOf('const highwayEnvGroup',start);
if(start<0||end<0)throw Error('Could not locate actual shared material declarations.');
vm.runInContext(`const scene=new THREE.Scene();const currentMap='highway';const WORLD_SPEED_SCALE=${Number(fs.readFileSync(path.join(src,'config.js'),'utf8').match(/const WORLD_SPEED_SCALE = ([\d.]+)/)[1])};\n${world.slice(start,end)}`,context);
const sources=['world.js','highway-traffic.js','vehicles.js','reference-exterior.js','reference-cockpit.js',...(fs.existsSync(path.join(src,'npc-traffic-assets.js'))?['npc-traffic-assets.js']:[]),'reference-traffic.js'];
for(const file of sources.slice(1))vm.runInContext(fs.readFileSync(path.join(src,file),'utf8'),context,{filename:file});
const T=context.THREE,api=context.window.RoadsterVehicle;
api.setModel('reference');api.setCockpit('reference');
const preview=api.getPreviewModel();
let wingPose=null;
if(process.env.ROADSTER_PREVIEW_WING_POSE){
 const pose=process.env.ROADSTER_PREVIEW_WING_POSE;
 const conditions={rest:{state:{y:0},isAccelerating:false,isAirBrakingActive:false},deployed:{state:{y:0},isAccelerating:true,isAirBrakingActive:false},flight:{state:{y:1},isAccelerating:false,isAirBrakingActive:false},airbrake:{state:{y:0},isAccelerating:false,isAirBrakingActive:true}};
 if(!conditions[pose])throw Error('Unknown opt-in wing pose '+pose);
 const physicsPath=path.resolve(process.env.ROADSTER_PREVIEW_PHYSICS_PATH||path.join(src,'physics-main.js'));
 const physics=fs.readFileSync(physicsPath,'utf8');
 const expression=name=>{const match=physics.match(new RegExp('const '+name+' = ([^;]+);'));if(!match)throw Error('Missing physics target '+name);return match[1];};
 const targetYExpression=expression('targetWingY'),targetAngleExpression=expression('targetWingAngle');
 const targets=vm.runInNewContext(`({y:(${targetYExpression}),angle:(${targetAngleExpression})})`,conditions[pose]);
 const innerWing=preview.getObjectByName('reference-active-wing');if(!innerWing?.parent)throw Error('Missing actual reference wing hierarchy');
 const group=innerWing.parent;
 const original={position:group.position.toArray(),rotation:[group.rotation.x,group.rotation.y,group.rotation.z,group.rotation.order]};
 group.position.y=targets.y;group.rotation.x=targets.angle;preview.updateMatrixWorld(true);
 wingPose={name:pose,source:'Exact target expressions from unchanged physics-main.js applied to actual cloned activeWingGroup; no mesh vertices changed',physicsSha256:crypto.createHash('sha256').update(physics).digest('hex'),targetYExpression,targetAngleExpression,conditions:conditions[pose],targets,originalGroupTransform:original,actualGroupPosition:group.position.toArray(),actualGroupRotation:[group.rotation.x,group.rotation.y,group.rotation.z,group.rotation.order],actualGroupMatrix:group.matrix.toArray(),actualGroupMatrixWorld:group.matrixWorld.toArray(),innerReferenceWingMatrixWorld:innerWing.matrixWorld.toArray()};
}
preview.updateMatrixWorld(true);
const visible=o=>{for(let n=o;n;n=n.parent)if(!n.visible)return false;return true;};
const mats=new Map(), meshes=[], skipped=[];
function material(m){
 if(!mats.has(m.uuid))mats.set(m.uuid,{id:m.uuid,name:m.name||m.type,type:m.type,color:m.color?.toArray(),emissive:m.emissive?.toArray(),emissiveIntensity:m.emissiveIntensity??0,metalness:m.metalness??0,roughness:m.roughness??.5,clearcoat:m.clearcoat??0,clearcoatRoughness:m.clearcoatRoughness??.1,side:m.side,transparent:m.transparent,opacity:m.opacity,blending:m.blending,colorWrite:m.colorWrite,depthWrite:m.depthWrite});
 return m.uuid;
}
let index=0;
preview.traverse(o=>{
 if(!o.isMesh||!visible(o))return;
 const ms=Array.isArray(o.material)?o.material:[o.material];
 if(o.userData.shadowProxy||ms.every(m=>m.colorWrite===false)){skipped.push({name:o.name,reason:'invisible shadow-only proxy'});return;}
 if(ms.every(m=>m.transparent||m.opacity<.99)){skipped.push({name:o.name,reason:'transparent effects excluded from neutral preview'});return;}
 const g=o.geometry,p=g.attributes.position;if(!p)return;
 const a=[];for(let i=0;i<p.count;i++)a.push(p.getX(i),p.getY(i),p.getZ(i));
 let n=null;if(g.attributes.normal){n=[];const v=g.attributes.normal;for(let i=0;i<v.count;i++)n.push(v.getX(i),v.getY(i),v.getZ(i));}
 meshes.push({id:index++,name:o.name||`${o.geometry.type}-${index}`,geometryType:g.type,position:a,normal:n,index:g.index?Array.from(g.index.array):null,groups:g.groups,drawRange:{start:g.drawRange.start,count:Number.isFinite(g.drawRange.count)?g.drawRange.count:null},material:ms.map(material),matrixWorld:o.matrixWorld.toArray(),worldDeterminant:o.matrixWorld.determinant()});
});
const box=new T.Box3();for(const m of meshes){const matrix=new T.Matrix4().fromArray(m.matrixWorld);for(let i=0;i<m.position.length;i+=3)box.expandByPoint(new T.Vector3(...m.position.slice(i,i+3)).applyMatrix4(matrix));}
const result={generatedAt:new Date().toISOString(),label:'Actual model preview',renderer:'Offline Blender Cycles CPU studio; exact exported canonical Three.js preview geometry, not a browser/WebGL screenshot',runtimeRevision:T.REVISION,model:'reference',cockpit:'reference',sources:Object.fromEntries(sources.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(src,f))).digest('hex')])),coordinateMapping:'Three (X,Y,Z) -> Blender (X,-Z,Y); front is Three -Z',boundsThree:{min:box.min.toArray(),max:box.max.toArray()},meshCount:meshes.length,triangleCount:meshes.reduce((s,m)=>s+(m.index?.length??m.position.length/3)/3,0),materials:[...mats.values()],meshes,skipped};
if(wingPose)result.wingPose=wingPose;
fs.writeFileSync(path.join(out,'actual-preview-meshes.json'),JSON.stringify(result));
const manifest={...result};delete manifest.meshes;fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({meshCount:result.meshCount,triangleCount:result.triangleCount,bounds:result.boundsThree,skipped:skipped.length,output:out},null,2));
