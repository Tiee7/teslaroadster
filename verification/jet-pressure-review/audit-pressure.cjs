/** CPU checks of live production geometry and production shader alpha.
 * node verification/jet-pressure-review/audit-pressure.cjs THREE_RUNTIME BASELINE_SRC
 * Does not create a browser, WebGL context, screenshot or FPS measurement.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {loadEffectsRuntime}=require('../jet-effects-runtime.cjs');
const runtime=process.argv[2]||'/tmp/roadster-three.min.js',src=path.resolve(__dirname,'../../src'),baseline=path.resolve(process.argv[3]||'/tmp/roadster-pressure-before/src');
const current=loadEffectsRuntime(src,runtime),previous=loadEffectsRuntime(baseline,runtime),T=current.THREE;
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const source=f=>fs.readFileSync(path.join(src,f),'utf8'),before=f=>fs.readFileSync(path.join(baseline,f),'utf8');
const physical=s=>s.slice(s.indexOf('  const isRealMode ='),s.indexOf('  const playerWorldZ ='));
assert.equal(physical(source('physics-main.js')),physical(before('physics-main.js')),'physical motion/tank/collision section must remain byte-identical');
assert.equal(String(current.visualUpdate),String(previous.visualUpdate),'no extra per-frame updater work');
assert.equal(String(current.sonicUpdate).replace('* 0.20;','* 0.16;'),String(previous.sonicUpdate),'only sonic peak opacity changes');
function alphaEvaluator(material){
 const shader=material.fragmentShader;
 let body=shader.slice(shader.indexOf('void main() {')+'void main() {'.length,shader.indexOf('if (alpha <'));
 body=body.replace(/\bfloat\s+/g,'const ').replace(/dot\(normalize\(vNormal\), normalize\(vView\)\)/g,'dotNV');
 const evaluate=new Function('vUv','dotNV','uniforms',`const {sin,pow,exp,abs}=Math;const {uTime,uOpacity,uPower}=uniforms;const smoothstep=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};${body}return alpha<.002?0:alpha;`);
 const uniforms=Object.fromEntries(Object.entries(material.uniforms).map(([k,v])=>[k,v.value]));
 return (uv,dot)=>evaluate(uv,dot,uniforms);
}
function shadedHits(e,camera,objects,raycaster){
 let transmission=1;
 for(const hit of raycaster.intersectObjects(objects,false)){
  const mesh=hit.object,normal=mesh.geometry.attributes.normal,position=mesh.geometry.attributes.position;
  const local=mesh.worldToLocal(hit.point.clone()),face=hit.face;
  const a=new T.Vector3().fromBufferAttribute(position,face.a),b=new T.Vector3().fromBufferAttribute(position,face.b),c=new T.Vector3().fromBufferAttribute(position,face.c);
  const weights=T.Triangle.getBarycoord(local,a,b,c,new T.Vector3());
  const n=new T.Vector3().fromBufferAttribute(normal,face.a).multiplyScalar(weights.x)
   .add(new T.Vector3().fromBufferAttribute(normal,face.b).multiplyScalar(weights.y))
   .add(new T.Vector3().fromBufferAttribute(normal,face.c).multiplyScalar(weights.z))
   .applyNormalMatrix(new T.Matrix3().getNormalMatrix(mesh.matrixWorld));
  const dot=Math.abs(n.dot(camera.position.clone().sub(hit.point).normalize()));
  const alpha=alphaEvaluator(mesh.material)(hit.uv,dot);
  assert.ok(Number.isFinite(alpha)&&alpha>=0&&alpha<=.500000001);
  transmission*=1-alpha;
 }
 return 1-transmission;
}
const report={runtime:T.REVISION,limits:'CPU production-geometry raycasts and direct scalar evaluation of production GLSL alpha. No depth occlusion by car/road: footprint is a conservative effect-only upper bound. No GPU shader compilation, transparent blend ordering or FPS claim.',sourceHashes:{vehicles:sha(source('vehicles.js')),baselineVehicles:sha(before('vehicles.js')),physicalSection:sha(physical(source('physics-main.js')))},physicalSectionUnchanged:true,visualUpdateIdentical:true,geometry:[],shaderArithmetic:{oldSinCalls:(previous.plumeState.get(previous.rear[0]).mesh.material.fragmentShader.match(/\bsin\(/g)||[]).length,newSinCalls:(current.plumeState.get(current.rear[0]).mesh.material.fragmentShader.match(/\bsin\(/g)||[]).length,textureReads:0,additionalDraws:0,additionalVertices:0,additionalTriangles:0},projection:[]};
const scenarios={rear:[1,0,false,0,0,0,0,0,0],retro:[0,1,false,0,0,0,0,0,0],lift:[0,0,false,1,0,0,0,0,0],combined:[1,0,false,1,1,1,1,1,-1],sonic:[1,0,false,0,0,0,0,0,0]};
for(const [label,e]of[['before',previous],['after',current]]){
 e.api.setModel('reference');e.api.setCockpit('reference');
 Object.assign(e.state,{vx:0,vy:0,vz:-110,isDestroyed:false,pitch:0,yaw:0,roll:0});
 e.visualUpdate(.3,false,...scenarios.rear);e.car.updateMatrixWorld(true);
 const data=e.plumeState.get(e.rear[0]),p=e.gasGeometry.attributes.position;
 let maxRadius=0;for(let i=0;i<p.count;i++)maxRadius=Math.max(maxRadius,Math.hypot(p.getX(i),p.getY(i)));
 report.geometry.push({label,outlets:e.plumes.length,sharedGeometries:new Set(e.plumes.map(p=>e.plumeState.get(p).mesh.geometry)).size,vertices:p.count,triangles:e.gasGeometry.index.count/3,mouthRadius:data.radius*Math.hypot(p.getX(0),p.getY(0)),wakeRadius:data.radius*maxRadius,rearLength:data.length,opacity:data.mesh.material.uniforms.uOpacity.value});
 for(const [scenario,inputs]of Object.entries(scenarios)){
  e.clear();e.visualUpdate(.1,false,...inputs);if(scenario==='sonic'){e.sonicUpdate(0,true,false);e.sonicUpdate(.4,false,false)}e.car.updateMatrixWorld(true);
  const objects=e.plumes.filter(p=>p.visible).map(p=>e.plumeState.get(p).mesh);if(e.sonic.visible)objects.push(e.sonic.children[0]);
  for(const [view,pos,target]of[['default-highway-chase',[0,2.2675,3.9],[0,.65,-9]],['rear-quarter',[5,2.5,6],[0,.5,0]]]){
   const camera=new T.PerspectiveCamera(60,1.6,.1,1000);camera.position.set(...pos);camera.lookAt(...target);camera.updateMatrixWorld(true);
   const ray=new T.Raycaster(),uv=new T.Vector2();let samples=0,touched=0,dense=0,maxAlpha=0,sum=0;
   for(let y=0;y<40;y++)for(let x=0;x<64;x++){
    uv.set((x+.5)/64*2-1,1-(y+.5)/40*2);ray.setFromCamera(uv,camera);
    const a=shadedHits(e,camera,objects,ray);samples++;if(a>.01)touched++;if(a>.5)dense++;sum+=a;maxAlpha=Math.max(maxAlpha,a);
   }
   const road={samples:0,maxAlpha:0,anyVisible:0};
   for(const x of [-12.5,-7.5,-2.5,0,2.5,7.5,12.5])for(const z of [-12,-25,-60])for(const y of [0,.7,1.5,2]){
    const target=new T.Vector3(x,y,z),dir=target.clone().sub(camera.position);ray.set(camera.position,dir.clone().normalize());ray.far=dir.length();
    const a=shadedHits(e,camera,objects,ray);road.samples++;road.maxAlpha=Math.max(road.maxAlpha,a);if(a>.01)road.anyVisible++;
   }
   const record={label,scenario,view,samples,footprintFraction:touched/samples,denseFraction:dense/samples,averageAlpha:sum/samples,maxAlpha,forwardRoadAndVehicleTargets:road};
   if(view==='default-highway-chase'){
    // The transient sonic sleeve is wider but much more transparent than gas.
    // These CPU guardrails protect the current default camera; they are not an
    // assertion about arbitrary flight angles, WebGL blending or other devices.
    assert.ok(record.footprintFraction<(scenario==='sonic'?.11:.08),'default-camera effect footprint remains local');
    assert.ok(record.denseFraction<.01,'dense effect covers less than 1% of the screen');
    assert.ok(road.maxAlpha<.10,'forward road/vehicle samples retain at least 90% transmission');
   }
   report.projection.push(record);
  }
 }
 e.clear();e.visualUpdate(.1,true,...scenarios.combined);e.sonicUpdate(0,true,true);assert.equal(e.plumes.some(p=>p.visible)||e.sonic.visible,false);
}
const [a,b]=report.geometry;assert.equal(a.vertices,b.vertices);assert.equal(a.triangles,b.triangles);assert.equal(a.mouthRadius,b.mouthRadius);assert.ok(b.wakeRadius/a.wakeRadius>2.4);assert.equal(b.rearLength,2.35);
report.passed=true;
fs.writeFileSync(path.join(__dirname,'pressure-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,geometry:report.geometry,defaultChaseAfter:report.projection.filter(x=>x.label==='after'&&x.view==='default-highway-chase'),report:'verification/jet-pressure-review/pressure-audit.json'},null,2));
