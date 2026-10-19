/** Fresh parameter-grid NPC retopology. Never reads quarantined derivatives.
 * Mesh boundaries remain exact at near detail. Far drops subpixel detail only.
 * Existing archive objects and catalog files are read-only inputs.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {canonicalSourceGeometryHash} from './canonical-source-hash.mjs';
// Originals are deliberately absent from the deployed/main source tree. Recover
// the versioned archive ZIP separately, then point this offline tool at it.
const root=path.resolve(process.env.ROADSTER_ARCHIVE_ROOT||'assets/vehicle-variants');
const catalogFile='catalog-v3.json',catalog=JSON.parse(fs.readFileSync(path.join(root,catalogFile)));
function getObject(root,ref){
 if(!/^[a-f0-9]{64}$/.test(ref.sha256)||ref.object!==`objects/${ref.sha256.slice(0,2)}/${ref.sha256}.gz`)throw Error('Invalid original archive reference');
 const file=path.join(root,ref.object);if(!fs.existsSync(file))throw Error('Materialize the versioned original archive ZIP first, then set ROADSTER_ARCHIVE_ROOT to its assets/vehicle-variants directory.');
 const bytes=gunzipSync(fs.readFileSync(file));if(bytes.length!==ref.bytes||createHash('sha256').update(bytes).digest('hex')!==ref.sha256)throw Error('Original archive integrity failure');return bytes;
}
function restoreExport(root,archive){
 if(archive.encoding==='raw-json-v1')return getObject(root,archive.raw);
 if(archive.encoding!=='array-objects-v1')throw Error('Unsupported original archive encoding');
 const data=JSON.parse(getObject(root,archive.template));for(const mesh of data.meshes)for(const key of ['position','normal','index'])if(mesh[key]?.archiveArray)mesh[key]=JSON.parse(getObject(root,mesh[key].archiveArray));
 const bytes=Buffer.from(JSON.stringify(data));if(bytes.length!==archive.rawBytes||createHash('sha256').update(bytes).digest('hex')!==archive.rawSha256)throw Error('Original preview integrity failure');return bytes;
}
const runtime=process.argv[2]||'/tmp/roadster-three.min.js';
const context=vm.createContext({console,Math,Float32Array,Uint16Array,Uint32Array,Event:class{constructor(type){this.type=type;}},window:{innerWidth:1440,innerHeight:900,addEventListener(){},dispatchEvent(){}},localStorage:{getItem(){return null;},setItem(){}},document:{createElement(){return{getContext(){return{};}};}}});
vm.runInContext(fs.readFileSync(runtime,'utf8'),context);const T=context.THREE;
if(T.REVISION!=='128')throw Error('Use production r128');
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const v=(p,i)=>p.slice(i*3,i*3+3),sub=(a,b)=>a.map((x,k)=>x-b[k]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((n,x,k)=>n+x*b[k],0);
const normal=n=>{let l=Math.hypot(...n)||1;return n.map(x=>x/l);};
const world=(m,p)=>new T.Vector3(...p).applyMatrix4(new T.Matrix4().fromArray(m)).toArray();
function gridShape(m){
 const n=m.position.length/3,t=(m.index?.length||0)/6;
 if(!Number.isInteger(t)||m.groups?.length>1)return null;
 for(let columns=1;columns<512;columns++)if(t%columns===0){let rows=t/columns;if((columns+1)*(rows+1)!==n)continue;
  const stride=columns+1;if(m.index.slice(0,6).some(i=>i>stride+1)||!m.index.slice(0,6).includes(stride))continue;
  // Verify the entire original is exactly a rectangular parametric grid.
  const faces=new Set();for(let i=0;i<m.index.length;i+=3)faces.add(m.index.slice(i,i+3).sort((a,b)=>a-b).join(','));
  let pass=true;for(let r=0;r<rows&&pass;r++)for(let c=0;c<columns;c++){let a=r*stride+c,b=a+1,d=a+stride+1,e=a+stride;let one=faces.has([a,e,d].sort((x,y)=>x-y).join(','))&&faces.has([a,d,b].sort((x,y)=>x-y).join(','));let two=faces.has([a,e,b].sort((x,y)=>x-y).join(','))&&faces.has([b,e,d].sort((x,y)=>x-y).join(','));if(!one&&!two){pass=false;break;}}
  if(pass)return{rows,columns};
 }return null;
}
function retopology(m,level,options={}){
 const shape=gridShape(m);if(!shape||m.index.length<=192)return m;
 const {rows,columns}=shape,stride=columns+1;
 const step=options.step||(level==='near'?8:18),border=options.border||(level==='near'?1:6);
 const select=(max,spacing)=>{let a=[];for(let i=0;i<max;i+=spacing)a.push(i);a.push(max);return a;};
 // Every outer boundary vertex is retained at near; narrow surfaces remain two
 // exact curves, with no independent rounding, clustering or vertex movement.
 const selectedRows=select(rows,step),selectedColumns=select(columns,step);
 const positions=[],normals=[],indices=[],mapped=new Map();
 const at=(r,c)=>{const key=r*stride+c;if(!mapped.has(key)){mapped.set(key,positions.length/3);positions.push(...v(m.position,key));normals.push(...v(m.normal,key));}return mapped.get(key);};
 const sourceN=cross(sub(v(m.position,m.index[1]),v(m.position,m.index[0])),sub(v(m.position,m.index[2]),v(m.position,m.index[0])));
 const paramN=cross(sub(v(m.position,stride),v(m.position,0)),sub(v(m.position,1),v(m.position,0)));const flip=dot(sourceN,paramN)<0;
 const add=(a,b,c)=>indices.push(...(flip?[a,c,b]:[a,b,c]));
 function triangle(points){
  const polygon=[];
  for(let edge=0;edge<3;edge++){
   const [r,c]=points[edge],[nr,nc]=points[(edge+1)%3];polygon.push(at(r,c));
   // Insert every original boundary point into its exact edge. This keeps
   // adjacent panels at their original seam coordinates without forcing dense
   // interior rows or fanning an entire curved panel to only two endpoints.
   const isBoundary=(r===nr&&(r===0||r===rows))||(c===nc&&(c===0||c===columns));
   const length=Math.max(Math.abs(nr-r),Math.abs(nc-c));
   if(isBoundary)for(let d=border;d<length;d+=border)polygon.push(at(r+(nr-r)*d/length,c+(nc-c)*d/length));
  }
  if(polygon.length===3){add(...polygon);return;}
  const center=positions.length/3,ids=points.map(([r,c])=>r*stride+c);
  positions.push(...[0,1,2].map(k=>ids.reduce((n,i)=>n+m.position[i*3+k],0)/3));
  normals.push(...normal([0,1,2].map(k=>ids.reduce((n,i)=>n+m.normal[i*3+k],0))));
  for(let i=0;i<polygon.length;i++)add(center,polygon[i],polygon[(i+1)%polygon.length]);
 }
 for(let r=0;r<selectedRows.length-1;r++)for(let c=0;c<selectedColumns.length-1;c++){
  const a=[selectedRows[r],selectedColumns[c]],b=[selectedRows[r],selectedColumns[c+1]],d=[selectedRows[r+1],selectedColumns[c+1]],e=[selectedRows[r+1],selectedColumns[c]];
  triangle([a,e,d]);triangle([a,d,b]);
 }
 return{...m,position:positions,normal:normals,index:indices};
}
function integrateLegacyRoofRails(meshes){
 const canopy=meshes.find(m=>m.name==='referenceLegacyCanopy'),rails=meshes.filter(m=>m.name==='referenceWhiteLegacyRoofRail');
 const source=retopology(canopy,'near',{step:2,border:1}),rail=rails[0],centers=[];
 for(let i=0;i<rail.position.length;i+=6)centers.push({z:rail.position[i+2],x:(Math.abs(rail.position[i])+Math.abs(rail.position[i+3]))/2});
 const minZ=centers[0].z,maxZ=centers[centers.length-1].z;
 const centerX=z=>{if(z<=minZ)return centers[0].x;if(z>=maxZ)return centers[centers.length-1].x;let i=0;while(z>centers[i+1].z)i++;let t=(z-centers[i].z)/(centers[i+1].z-centers[i].z);return centers[i].x+(centers[i+1].x-centers[i].x)*t;};
 const batch=()=>({position:[],normal:[],index:[]}),glass=batch(),paint=batch();
 function clip(poly,scalar,keepPositive){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=scalar(a)*(keepPositive?1:-1),db=scalar(b)*(keepPositive?1:-1),inside=da>=0,next=db>=0;if(inside)out.push(a);if(inside!==next){let t=da/(da-db);out.push({p:a.p.map((x,k)=>x+(b.p[k]-x)*t),n:a.n.map((x,k)=>x+(b.n[k]-x)*t),d:a.d+(b.d-a.d)*t});}}return out;}
 function emit(poly,to){if(poly.length<3)return;const base=to.position.length/3;for(const point of poly){to.position.push(...point.p);to.normal.push(...normal(point.n));}for(let i=1;i<poly.length-1;i++)to.index.push(base,base+i,base+i+1);}
 for(let i=0;i<source.index.length;i+=3){let inside=source.index.slice(i,i+3).map(j=>{const p=v(source.position,j);return{p,n:v(source.normal,j),d:Math.abs(p[0])-centerX(p[2])};});
  for(const scalar of [p=>p.d+.032,p=>.032-p.d,p=>p.p[2]-minZ,p=>maxZ-p.p[2]]){emit(clip(inside,scalar,false),glass);inside=clip(inside,scalar,true);if(!inside.length)break;}
  emit(inside,paint);
 }
 const metadata={method:'non-overlapping-canopy-surface-partition',sourceRails:2,heightOffsetMetres:0,overlappingTriangles:0};
 const result=meshes.filter(m=>m!==canopy&&!rails.includes(m));
 result.push({...canopy,...glass,integratedRails:metadata},{...rail,...paint,name:'referenceWhiteLegacyRoofRail',integratedRails:metadata});return result;
}
function role(m,name){
 const c=m.color||[0,0,0],l=c.reduce((a,b)=>a+b,0)/3;
 if(/lamp|light|projector/i.test(name)&&c[0]>.5&&c[0]>c[1]*1.8)return'red';
 if(/lamp|light|projector/i.test(name)&&l>.65)return'lamp';
 if(/Window|Canopy|MirrorGlass/.test(name))return'glass';
 if(l>.72||/White|Shoulder|WedgeHood|Flank|Door$|Painted|DeckCenter|Buttress|Cheek|RoofRail|FrontWing/.test(name))return'body';
 if(l>.32&&(m.metalness||0)>.5)return'alloy';
 return'carbon';
}
const palette=[{id:'body',color:0xeef2f7,metalness:.42,roughness:.27},{id:'carbon',color:0x10151b,metalness:.15,roughness:.66},{id:'glass',color:0x12212c,metalness:.38,roughness:.17},{id:'alloy',color:0x9ba5b4,metalness:.8,roughness:.27},{id:'red',color:0xed183b,emissive:0x65000a,metalness:0,roughness:.3},{id:'lamp',color:0xf3faff,emissive:0xa9d0df,metalness:0,roughness:.3}];
const geometryPool=[],geometryIds=new Map(),variants=[],audit=[];
function build(data,id,label,entryIds,sourceHash){
 const materials=Object.fromEntries(data.materials.map(m=>[m.id,m]));const levels={};
 for(const level of ['near','far']){
  const batches=new Map(palette.map(m=>[m.id,{material:m.id,position:[],normal:[],index:[]}])) ,kept=[],omitted=[];
  function append(m,which){
   const batch=batches.get(which),base=batch.position.length/3,matrix=new T.Matrix4().fromArray(m.matrixWorld),nmat=new T.Matrix3().getNormalMatrix(matrix),p=m.position,n=m.normal;
   for(let i=0;i<p.length/3;i++){batch.position.push(...world(m.matrixWorld,v(p,i)));batch.normal.push(...new T.Vector3(...v(n,i)).applyMatrix3(nmat).normalize().toArray());}
   let ix=m.index||Array.from({length:p.length/3},(_,i)=>i);for(let i=0;i<ix.length;i+=3){let a=ix[i],b=ix[i+1],c=ix[i+2];if(m.worldDeterminant<0)[b,c]=[c,b];const pa=v(batch.position,base+a),pb=v(batch.position,base+b),pc=v(batch.position,base+c);const face=cross(sub(pb,pa),sub(pc,pa));if(Math.hypot(...face)<1e-10)continue;const avg=[0,1,2].map(k=>batch.normal[(base+a)*3+k]+batch.normal[(base+b)*3+k]+batch.normal[(base+c)*3+k]);if(dot(face,avg)<0)[b,c]=[c,b];batch.index.push(base+a,base+b,base+c);}
  }
  for(const m of data.meshes){
   const name=m.name;
   if(!name.startsWith('reference')||/yoke|console|seat|wheel|tire|jet-/i.test(name)){omitted.push(name);continue;}
   if(level==='far'&&/Seam|Wiper|Handle|Mirror|Badge|Fastener|Camera|Fin|Slot|Seal|Recess|Pocket|Carrier|WingSupport|WingBase|LampShoulderBridge/.test(name)){omitted.push(name);continue;}
   let chosen;
   if(id.startsWith('legacy-')&&name==='referenceLegacyCanopy'){
    // Legacy source grids already have few stations. Keep their full crown in
    // the far tier instead of crossing it with a step18 diagonal.
    chosen=retopology(m,'near',{step:id==='legacy-classic-roadster'?2:8,border:1});
   }else if(id==='legacy-classic-roadster'&&name==='referenceWhiteLegacyRoofRail'){
    chosen=m; // Painted bands share an exact non-overlapping glass surface.
   }else if(id==='legacy-classic-roadster'&&name==='referenceWhiteLegacyBody'){
    chosen=retopology(m,level,{step:level==='near'?2:4,border:level==='near'?1:2});
   }else chosen=retopology(m,level);
   append(chosen,role(materials[m.material[0]],name));kept.push({name,originalTriangles:m.index.length/3,triangles:chosen.index.length/3,exactBoundary:level==='near',...(chosen.integratedRails?{integratedRails:chosen.integratedRails}:{})});
  }
  // Deliberate cheap, closed wheel retopology replaces heavy brake internals.
  // Circular inset wheel discs do not show a frozen asymmetric spoke pose.
  const wheelSegments=level==='near'?16:10;
  function primitive(geometry,which,pos){let p=Array.from(geometry.attributes.position.array),n=Array.from(geometry.attributes.normal.array);append({position:p,normal:n,index:Array.from(geometry.index.array),matrixWorld:new T.Matrix4().makeTranslation(...pos).toArray(),worldDeterminant:1},which);}
  for(const [x,y,z]of[[-.86,.33,-1.36],[.86,.33,-1.36],[-.88,.35,1.36],[.88,.35,1.36]]){
   primitive(new T.CylinderGeometry(.33,.33,.23,wheelSegments,1).rotateZ(Math.PI/2),'carbon',[x,y,z]);
   primitive(new T.CylinderGeometry(.235,.235,.238,wheelSegments,1).rotateZ(Math.PI/2),'alloy',[x,y,z]);
   primitive(new T.CylinderGeometry(.11,.11,.242,wheelSegments,1).rotateZ(Math.PI/2),'carbon',[x,y,z]);
  }
  // Opaque recessed cavity backing has a closed outward-normal surface. It is
  // inside all historical body panels and blocks road/wheel see-through.
  primitive(new T.BoxGeometry(1.45,.30,3.88),'carbon',[0,.32,.06]);
  if(level==='far')primitive(new T.BoxGeometry(1.52,.52,.25),'carbon',[0,.40,2.05]);
  const out=[];for(const batch of batches.values())if(batch.index.length){
   // Compact seven-decimal JSON, deterministic geometry deduplication across
   // historical appearances, paint choices and all traffic instances.
   // Some archived primitives contain unused pole vertices with zero normals.
   // Use their incident geometric normal, with an explicit unused-vertex fallback.
   const incident=new Float64Array(batch.position.length);
   for(let i=0;i<batch.index.length;i+=3){const ids=batch.index.slice(i,i+3),[a,b,c]=ids.map(j=>v(batch.position,j)),n=cross(sub(b,a),sub(c,a));for(const j of ids)for(let k=0;k<3;k++)incident[j*3+k]+=n[k];}
   for(let i=0;i<batch.normal.length;i+=3)if(Math.hypot(...batch.normal.slice(i,i+3))<.1){let n=normal(Array.from(incident.slice(i,i+3)));if(Math.hypot(...n)<.1)n=[0,1,0];for(let k=0;k<3;k++)batch.normal[i+k]=n[k];}
   batch.position=batch.position.map(x=>Math.fround(Math.round(x*10000)/10000));
   batch.normal=batch.normal.map(x=>Math.round(x*127)/127);
   const finalNormals=new Float32Array(batch.normal);for(let i=0;i<finalNormals.length;i+=3){const length=Math.hypot(finalNormals[i],finalNormals[i+1],finalNormals[i+2])||1;finalNormals[i]/=length;finalNormals[i+1]/=length;finalNormals[i+2]/=length;}
   // Evaluate culling after final quantization, so sub-millimetre historical
   // slivers cannot reverse their front face during transport to the runtime.
   const cleaned=[];
   for(let i=0;i<batch.index.length;i+=3){let [a,b,c]=batch.index.slice(i,i+3);const pa=v(batch.position,a),pb=v(batch.position,b),pc=v(batch.position,c),face=cross(sub(pb,pa),sub(pc,pa));
    if(Math.hypot(...face)<1e-10)continue;
    const avg=[0,1,2].map(k=>finalNormals[a*3+k]+finalNormals[b*3+k]+finalNormals[c*3+k]);if(dot(face,avg)<0)[b,c]=[c,b];cleaned.push(a,b,c);
   }
   batch.index=cleaned;
   const key=hash(batch);let gi=geometryIds.get(key);if(gi===undefined){gi=geometryPool.length;geometryIds.set(key,gi);geometryPool.push({...batch,sha256:key});}out.push(gi);
  }
  const triangleCount=out.reduce((n,i)=>n+geometryPool[i].index.length/3,0);levels[level]={geometries:out,triangles:triangleCount,draws:out.length};
  audit.push({id,level,triangleCount,draws:out.length,retainedPanels:kept,omittedPanels:omitted});
 }
 variants.push({id,label,sourceGeometrySha256:sourceHash,...(id.startsWith('legacy-')?{sourceGeometryHashFormat:'position-topology-pose-v1'}:{}),archiveEntries:entryIds,levels});
}
for(const variant of catalog.geometryVariants){const entry=catalog.entries.find(e=>e.id===variant.representativeEntry);build(JSON.parse(restoreExport(root,entry.originalPreview)),variant.id,entry.origin.label||entry.id,variant.entries,variant.geometrySha256);globalThis.gc?.();}
// Retain the three distinct pre-reference traffic styles as clean shared batches.
// Their generators are read from an immutable original source snapshot, rather
// than whichever player candidate happens to be in a development worktree.
const original=catalog.entries.find(e=>e.id==='released-reference-20f6117');
const sourceFile=name=>getObject(root,original.originalSources.files[name]).toString();
const worldSource=sourceFile('world.js'),materialStart=worldSource.indexOf('const bodyMaterial ='),materialEnd=worldSource.indexOf('const highwayEnvGroup',materialStart);
vm.runInContext('const scene=new THREE.Scene();const currentMap=\'highway\';\n'+worldSource.slice(materialStart,materialEnd),context);
vm.runInContext(sourceFile('vehicles.js'),context);vm.runInContext(sourceFile('reference-traffic.js'),context);
for(const [type,id,label]of [[0,'legacy-classic-roadster','Preserved classic Roadster'],[1,'legacy-sculpted-track','Preserved sculpted track car'],[2,'legacy-sculpted-touring','Preserved sculpted touring car']]){
 const car=vm.runInContext('createTrafficVehicleMesh('+type+')',context);car.updateMatrixWorld(true);const railGeometries=new Set(vm.runInContext('roadsterCanopyRails.map(part=>part.geometry)',context));const wheelParts=new Set();car.userData.wheels.forEach(w=>w.traverse(p=>wheelParts.add(p)));
 const mats=new Map(),meshes=[];car.traverse(m=>{if(!m.isMesh||wheelParts.has(m))return;const mat=m.material;let semantic='referenceLegacy'+m.geometry.type;
  if(mat===vm.runInContext('sharedTrafficPaintMats['+type+']',context))semantic='referenceWhiteLegacyBody';
  if(mat===vm.runInContext('sharedTrafficCanopyMat',context)||mat===vm.runInContext('goldCanopyMaterial',context))semantic='referenceLegacyCanopy';
  if(mat===vm.runInContext('sharedTrafficHLMat',context)||mat===vm.runInContext('sharedTrafficTLMat',context)||mat===vm.runInContext('sharedTrafficDrlMat',context))semantic='referenceLegacyLight';
  if(railGeometries.has(m.geometry))semantic='referenceWhiteLegacyRoofRail';
  mats.set(mat.uuid,{id:mat.uuid,color:mat.color?.toArray(),metalness:mat.metalness,roughness:mat.roughness,type:mat.type});
  meshes.push({name:semantic,position:Array.from(m.geometry.attributes.position.array),normal:Array.from(m.geometry.attributes.normal.array),index:Array.from(m.geometry.index.array),material:[mat.uuid],matrixWorld:m.matrixWorld.toArray(),worldDeterminant:m.matrixWorld.determinant(),groups:[]});
 });const sourceHash=canonicalSourceGeometryHash(meshes),prepared=id==='legacy-classic-roadster'?integrateLegacyRoofRails(meshes):meshes;build({materials:[...mats.values()],meshes:prepared},id,label,[original.id+':originalSources/vehicles.js',original.id+':originalSources/reference-traffic.js'],sourceHash);
}
const asset={format:'roadster-traffic-retopology-v1',generator:'parameter-grid-boundary-v1',archiveCatalog:catalogFile,archiveCatalogSha256:createHash('sha256').update(fs.readFileSync(path.join(root,catalogFile))).digest('hex'),palette,variants,geometryPool};
// Quantization is 0.1 mm for positions and signed normalized 8-bit normals.
// It is explicit, deterministic, and never mutates an immutable source object.
const packed={...asset,geometryPool:asset.geometryPool.map(g=>{
 if(g.position.length/3>65535)throw Error('NPC batch exceeds Uint16 budget');
 const bytes=Buffer.alloc(g.position.length*2+g.normal.length+g.index.length*2);let offset=0;
 for(const value of g.position){bytes.writeInt16LE(Math.round(value*10000),offset);offset+=2;}
 for(const value of g.normal)bytes.writeInt8(Math.max(-127,Math.min(127,Math.round(value*127))),offset++);
 for(const value of g.index){bytes.writeUInt16LE(value,offset);offset+=2;}
 return{material:g.material,vertexCount:g.position.length/3,indexCount:g.index.length,sha256:createHash('sha256').update(bytes).digest('hex'),packed:bytes.toString('base64')};
})};
const decoder=`
function unpackArchivedTrafficGeometry(record) {
 const text=atob(record.packed),bytes=new Uint8Array(text.length);for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);
 const view=new DataView(bytes.buffer),position=new Float32Array(record.vertexCount*3),normal=new Float32Array(record.vertexCount*3),index=new Uint16Array(record.indexCount);let offset=0;
 for(let i=0;i<position.length;i++){position[i]=view.getInt16(offset,true)/10000;offset+=2;}
 for(let i=0;i<normal.length;i++)normal[i]=view.getInt8(offset++)/127;
 for(let i=0;i<normal.length;i+=3){const length=Math.hypot(normal[i],normal[i+1],normal[i+2])||1;normal[i]/=length;normal[i+1]/=length;normal[i+2]/=length;}
 for(let i=0;i<index.length;i++){index[i]=view.getUint16(offset,true);offset+=2;}
 return{position,normal,index};
}
`;
fs.writeFileSync('src/npc-traffic-assets.js','// Generated clean NPC retopology. Immutable archive objects are never loaded by the game.\nconst archivedTrafficAssets = '+JSON.stringify(packed)+';\n'+decoder);
fs.writeFileSync('verification/npc-traffic/asset-audit.json',JSON.stringify({generator:asset.generator,catalog:catalogFile,variants:variants.map(v=>({id:v.id,entries:v.archiveEntries,levels:v.levels})),poolGeometryCount:geometryPool.length,poolTriangles:geometryPool.reduce((n,g)=>n+g.index.length/3,0),audit},null,2)+'\n');
console.log(JSON.stringify({variants:variants.length,geometryPool:geometryPool.length,sourceBytes:fs.statSync('src/npc-traffic-assets.js').size,levels:variants.map(v=>({id:v.id,near:v.levels.near.triangles,far:v.levels.far.triangles}))},null,2));
