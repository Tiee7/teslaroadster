/** Exact map-owned Three r128 geometry export, including InstancedMesh transforms/colors.
 * node verification/coast-art/export-scene.cjs /tmp/roadster-three.min.js OUT [SOURCE]
 * No WebGL, reconstructed meshes, browser automation or asset network access.
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const runtime=process.argv[2],out=path.resolve(process.argv[3]),source=path.resolve(process.argv[4]||'src/coast-map.js');
fs.mkdirSync(out,{recursive:true});
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const context=vm.createContext({window:{},console});
vm.runInContext(fs.readFileSync(runtime,'utf8'),context,{filename:runtime});
vm.runInContext(fs.readFileSync(source,'utf8'),context,{filename:source});
const T=context.THREE,coast=context.window.RoadsterCoast;
if(T.REVISION!=='128')throw Error('Exact production r128 runtime required');
const focusX=Number(process.env.COAST_REVIEW_FOCUS_X??coast.spec.spawn.x),focusZ=Number(process.env.COAST_REVIEW_FOCUS_Z??coast.spec.spawn.z);
if(!Number.isFinite(focusX)||!Number.isFinite(focusZ)||Math.abs(focusX)>coast.spec.halfBound||Math.abs(focusZ)>coast.spec.halfBound)throw Error('Explicit offline visual focus must be finite and inside unchanged map bounds');
const visualFocus={x:focusX,z:focusZ},scene=new T.Scene();scene.userData.coastArtBridge={getFocus:()=>visualFocus,sharedLights:[]};const root=coast.enter(scene,T);
const reviewVisualSeconds=Number(process.env.COAST_REVIEW_SECONDS||0);
if(!Number.isFinite(reviewVisualSeconds)||reviewVisualSeconds<0||reviewVisualSeconds>600)throw Error('Offline visual review time must stay within0..600 seconds');
for(let elapsed=0;elapsed<reviewVisualSeconds;){const dt=Math.min(1/60,reviewVisualSeconds-elapsed);coast.tick(dt);elapsed+=dt;}
root.updateMatrixWorld(true);
const textures=new Map(),materials=new Map(),geometries=new Map(),meshes=[],bounds=new T.Box3();
function texture(t){
 if(!t)return null;if(textures.has(t.uuid))return t.uuid;
 if(t.isCubeTexture){textures.set(t.uuid,{id:t.uuid,kind:'cube',mapping:t.mapping,faces:t.image.map(texture)});return t.uuid;}
 const image=t.image;if(!image?.data)throw Error('Only map-owned deterministic DataTexture supported, not an unseen external texture');
 const data=Buffer.from(image.data.buffer,image.data.byteOffset,image.data.byteLength);
 textures.set(t.uuid,{id:t.uuid,width:image.width,height:image.height,format:t.format,type:t.type,repeat:t.repeat.toArray(),offset:t.offset.toArray(),wrapS:t.wrapS,wrapT:t.wrapT,encoding:t.encoding,mapping:t.mapping,flipY:t.flipY,bytes:data.toString('base64')});return t.uuid;
}
function material(m,color){
 const c=m.color?.clone();if(c&&color)c.multiply(color);
 const key=m.uuid+':'+(c?.getHexString()||'none');
 if(materials.has(key))return key;
 materials.set(key,{id:key,name:m.name||m.type,type:m.type,color:c?.toArray(),emissive:m.emissive?.toArray(),emissiveIntensity:m.emissiveIntensity??0,emissiveMap:texture(m.emissiveMap),roughness:m.roughness??.8,metalness:m.metalness??0,opacity:m.opacity??1,transparent:Boolean(m.transparent),side:m.side,wireframe:m.wireframe,vertexColors:Boolean(m.vertexColors),map:texture(m.map),normalMap:texture(m.normalMap),normalScale:m.normalScale?.toArray(),normalMapType:m.normalMapType,bumpMap:texture(m.bumpMap),bumpScale:m.bumpScale,roughnessMap:texture(m.roughnessMap),userData:m.userData});return key;
}
function geometry(g){
 if(geometries.has(g.uuid))return g.uuid;
 const a={};for(const name of ['position','normal','uv','color'])if(g.attributes[name])a[name]=Array.from(g.attributes[name].array);
 geometries.set(g.uuid,{id:g.uuid,name:g.type,attributes:a,index:g.index?Array.from(g.index.array):null,groups:g.groups,drawRange:{start:g.drawRange.start,count:Number.isFinite(g.drawRange.count)?g.drawRange.count:null}});return g.uuid;
}
const inst=new T.Matrix4(),world=new T.Matrix4(),color=new T.Color(),vertex=new T.Vector3();
root.traverse(o=>{
 if(!o.isMesh)return;for(let n=o;n;n=n.parent)if(!n.visible)return;
 const ms=Array.isArray(o.material)?o.material:[o.material],n=o.isInstancedMesh?o.count:1,gid=geometry(o.geometry),p=o.geometry.attributes.position;
 for(let i=0;i<n;i++){
  if(o.isInstancedMesh){o.getMatrixAt(i,inst);world.multiplyMatrices(o.matrixWorld,inst);if(o.instanceColor)o.getColorAt(i,color);else color.setHex(0xffffff);}else{world.copy(o.matrixWorld);color.setHex(0xffffff);}
  const objectBounds=new T.Box3();for(let v=0;v<p.count;v++)objectBounds.expandByPoint(vertex.fromBufferAttribute(p,v).applyMatrix4(world));bounds.union(objectBounds);
  meshes.push({name:o.name||o.geometry.type,instance:o.isInstancedMesh?i:null,geometry:gid,matrixWorld:world.toArray(),materials:ms.map(m=>material(m,color)),castShadow:o.castShadow,receiveShadow:o.receiveShadow,bounds:{min:objectBounds.min.toArray(),max:objectBounds.max.toArray()}});
 }
});
const lights=[];root.traverse(o=>{if(o.isLight)lights.push({name:o.name,type:o.type,color:o.color?.toArray(),groundColor:o.groundColor?.toArray(),intensity:o.intensity,positionWorld:o.getWorldPosition(new T.Vector3()).toArray(),targetWorld:o.target?.getWorldPosition(new T.Vector3()).toArray(),castShadow:o.castShadow,shadowMapSize:o.shadow?.mapSize.toArray()});});
const atmosphere={background:scene.background?.isColor?scene.background.toArray():null,fog:scene.fog?{color:scene.fog.color.toArray(),density:scene.fog.density}:null,environment:texture(scene.environment),lights};
const result={generatedAt:new Date().toISOString(),nativeVisualFocus:visualFocus,reviewVisualSeconds,animationBoundary:'Only map-owned visual tick, not vehicle physics or wall-clock development time',atmosphere,label:'Offline exact-geometry art inspection; NOT a gameplay screenshot',runtimeRevision:T.REVISION,source:{path:source,sha256:hash(source),runtimeSha256:hash(runtime)},metrics:coast.metrics(),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},coordinateMapping:'Three (X,Y,Z) -> Blender (X,-Z,Y)',geometries:[...geometries.values()],materials:[...materials.values()],textures:[...textures.values()],meshes};
fs.writeFileSync(path.join(out,'scene.json'),JSON.stringify(result));
fs.copyFileSync(source,path.join(out,'source-coast-map.js.txt'));
const manifest={...result};delete manifest.meshes;delete manifest.geometries;manifest.textures=manifest.textures.map(({bytes,...t})=>({...t,rawBytes:bytes?Buffer.from(bytes,'base64').length:0}));
manifest.exportedInstances=meshes.length;manifest.uniqueGeometries=geometries.size;manifest.instanceColors='Each exported material color = actual material.color × actual instanceColor';
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));coast.leave();
