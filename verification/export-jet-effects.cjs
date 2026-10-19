/** Export exact live Three r128 game meshes with named production effect powers.
 * node verification/export-jet-effects.cjs /tmp/roadster-three.min.js OUTPUT_DIR [SOURCE_DIR]
 * No WebGL/browser access, reconstructed geometry or image generation. Named
 * render scenarios call the production visual updater; accepted-input/fuel
 * behavior is checked separately by jet-effects.test.mjs and the runtime audit.
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
const model=process.env.ROADSTER_EFFECTS_MODEL || 'reference';
api.setModel(model);api.setCockpit(process.env.ROADSTER_EFFECTS_CABIN || 'reference');
const scenario=process.env.ROADSTER_EFFECTS_SCENARIO || 'rear-sonic';
vm.runInContext("const state={vx:0,vy:0,vz:-110,isDestroyed:false};",context);
const candidate=vm.runInContext("typeof updateColdGasVisuals==='function'",context);
const scenarios={
 'rear-sonic':[1,0,false,0,0,0,0,0,0],
 rear:[1,0,false,0,0,0,0,0,0],
 retro:[0,1,false,0,0,0,0,0,0],
 lift:[0,0,false,1,0,0,0,0,0],
 descent:[0,0,false,0,1,0,0,0,0],
 roll:[0,0,false,0,0,1,0,0,0],
 pitch:[0,0,false,0,0,0,1,0,0],
 yaw:[0,0,false,0,0,0,0,1,0],
 strafe:[0,0,false,0,0,0,0,0,-1],
 fpv:[1,1,false,1,1,1,1,1,-1]
};
if(!scenarios[scenario])throw Error('Unknown scenario '+scenario);
if(candidate){
 vm.runInContext(`updateColdGasVisuals(.3,${scenario==='fpv'},${scenarios[scenario].map(v=>String(v)).join(',')});`,context);
 if(scenario==='rear-sonic')vm.runInContext('updateSonicCondensation(0,true,false);updateSonicCondensation(.4,false,false);',context);
}else{
 vm.runInContext(`rearPlumes.forEach(p=>p.visible=${scenario.startsWith('rear')});sonicBoomConeGroup.visible=${scenario==='rear-sonic'};`,context);
}
if(scenario==='fpv')vm.runInContext('setCockpitPerspective(true);',context);
const studioHeight=['lift','descent','roll','pitch','yaw','strafe'].includes(scenario)?1.6:0;
vm.runInContext(`playerWrapper.position.set(0,${studioHeight},0);playerWrapper.updateMatrixWorld(true);`,context);
const preview=vm.runInContext('carMeshGroup',context);
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
 if(!mats.has(m.uuid))mats.set(m.uuid,{id:m.uuid,name:m.name||m.type,type:m.type,color:m.color?.toArray(),emissive:m.emissive?.toArray(),emissiveIntensity:m.emissiveIntensity??0,metalness:m.metalness??0,roughness:m.roughness??.5,clearcoat:m.clearcoat??0,clearcoatRoughness:m.clearcoatRoughness??.1,side:m.side,transparent:m.transparent,opacity:m.opacity,blending:m.blending,colorWrite:m.colorWrite,depthWrite:m.depthWrite,shader:m.isShaderMaterial?{kind:m.uniforms.uTint?'cold-gas':'condensation',power:m.uniforms.uPower?.value??1,tint:m.uniforms.uTint?.value.toArray()??[.86,.94,.98],opacity:m.uniforms.uOpacity.value,time:m.uniforms.uTime.value}:null});
 return m.uuid;
}
let index=0;
preview.traverse(o=>{
 if(!o.isMesh||!visible(o))return;
 const ms=Array.isArray(o.material)?o.material:[o.material];
 if(o.userData.shadowProxy||ms.every(m=>m.colorWrite===false)){skipped.push({name:o.name,reason:'invisible shadow-only proxy'});return;}
 if(ms.every(m=>m.opacity===0)){skipped.push({name:o.name,reason:'zero-opacity inactive material'});return;}
 const g=o.geometry,p=g.attributes.position;if(!p)return;
 const a=[];for(let i=0;i<p.count;i++)a.push(p.getX(i),p.getY(i),p.getZ(i));
 let n=null;if(g.attributes.normal){n=[];const v=g.attributes.normal;for(let i=0;i<v.count;i++)n.push(v.getX(i),v.getY(i),v.getZ(i));}
 meshes.push({id:index++,name:o.name||`${o.geometry.type}-${index}`,geometryType:g.type,position:a,normal:n,uv:g.attributes.uv?Array.from(g.attributes.uv.array):null,index:g.index?Array.from(g.index.array):null,groups:g.groups,drawRange:{start:g.drawRange.start,count:Number.isFinite(g.drawRange.count)?g.drawRange.count:null},material:ms.map(material),matrixWorld:o.matrixWorld.toArray(),worldDeterminant:o.matrixWorld.determinant()});
});
const box=new T.Box3();for(const m of meshes){const matrix=new T.Matrix4().fromArray(m.matrixWorld);for(let i=0;i<m.position.length;i+=3)box.expandByPoint(new T.Vector3(...m.position.slice(i,i+3)).applyMatrix4(matrix));}
const result={generatedAt:new Date().toISOString(),label:'Production geometry effect comparison',renderer:'Offline Blender Cycles CPU; exact live Three r128 geometry/poses with sampled GLSL alpha approximation, not browser/WebGL',runtimeRevision:T.REVISION,model,cockpit:api.getCockpit(),scenario,studioHeight,effectImplementation:candidate?'candidate':'baseline',shaderBoundary:'CPU renderer samples production GLSL alpha functions at source vertices and approximates interpolation/transparent compositing. This is not a WebGL screenshot or GPU performance evidence.',sources:Object.fromEntries([...sources,'physics-main.js','config.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(src,f))).digest('hex')])),coordinateMapping:'Three (X,Y,Z) -> Blender (X,-Z,Y); front is Three -Z',boundsThree:{min:box.min.toArray(),max:box.max.toArray()},meshCount:meshes.length,triangleCount:meshes.reduce((s,m)=>s+(m.index?.length??m.position.length/3)/3,0),materials:[...mats.values()],meshes,skipped};
if(wingPose)result.wingPose=wingPose;
fs.writeFileSync(path.join(out,'actual-preview-meshes.json'),JSON.stringify(result));
const manifest={...result};delete manifest.meshes;fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({meshCount:result.meshCount,triangleCount:result.triangleCount,bounds:result.boundsThree,skipped:skipped.length,output:out},null,2));
