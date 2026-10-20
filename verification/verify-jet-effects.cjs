/** Actual production Three r128 geometry/axis and pure-physics preservation audit.
 * node verification/verify-jet-effects.cjs /tmp/roadster-three.min.js [src] [baseline-src]
 * No browser, GPU timing, artist-generated images or remote writes.
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const{loadEffectsRuntime}=require('./jet-effects-runtime.cjs');
const src=path.resolve(process.argv[3]||path.join(__dirname,'../src')),runtime=process.argv[2]||'/tmp/roadster-three.min.js',baseline=process.argv[4]&&path.resolve(process.argv[4]);
const e=loadEffectsRuntime(src,runtime),T=e.THREE;
assert.equal(T.REVISION,'128');
const report={runtime:T.REVISION,sourceHashes:Object.fromEntries(['vehicles.js','reference-cockpit.js','physics-main.js','ui-hud.js','config.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(src,f))).digest('hex')])),noWebGL:true,limits:'CPU actual geometry, ray/normal/direction/power checks. No browser/FPS evidence. Blender images approximate GLSL alpha; they do not validate real GPU blending.',geometry:{},portAudit:[],motionAudit:[],pulseAudit:[]};
function auditGeometry(g,name){const p=g.attributes.position,n=g.attributes.normal,ids=g.index.array;let degenerate=0,inward=0,maxNormalError=0;for(let i=0;i<p.count;i++){assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));const v=new T.Vector3().fromBufferAttribute(n,i);maxNormalError=Math.max(maxNormalError,Math.abs(v.length()-1));}for(let i=0;i<ids.length;i+=3){const a=new T.Vector3().fromBufferAttribute(p,ids[i]),b=new T.Vector3().fromBufferAttribute(p,ids[i+1]),c=new T.Vector3().fromBufferAttribute(p,ids[i+2]);const face=b.sub(a).cross(c.sub(a));if(face.lengthSq()<1e-16)degenerate++;const avg=new T.Vector3().fromBufferAttribute(n,ids[i]).add(new T.Vector3().fromBufferAttribute(n,ids[i+1])).add(new T.Vector3().fromBufferAttribute(n,ids[i+2]));if(face.dot(avg)<0)inward++;}assert.equal(degenerate,0);assert.equal(inward,0);assert.ok(maxNormalError<1e-6);report.geometry[name]={vertices:p.count,triangles:ids.length/3,degenerate,inward,maxNormalError};}
auditGeometry(e.gasGeometry,'coldGasEnvelope');auditGeometry(e.sonicGeometry,'condensation');
const isDescendant=(o,ancestor)=>{for(let p=o;p;p=p.parent)if(p===ancestor)return true;return false};
const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true};
for(const model of ['reference','classic'])for(const cabin of ['reference','classic']){
 e.api.setModel(model);e.api.setCockpit(cabin);vm.runInContext('setCockpitPerspective(false);',e.context);
 const allMats=new Map(),obstacles=[];
 const omit=new Set(e.plumes);omit.add(e.sonic);omit.add(vm.runInContext('coldGasNozzlesGroup',e.context));omit.add(e.rearGimbal);
 e.car.traverse(o=>{if(!o.isMesh||!visible(o)||o.userData.shadowProxy||[...omit].some(root=>isDescendant(o,root)))return;const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.every(m=>m.opacity===0||m.colorWrite===false))return;obstacles.push(o);for(const m of mats){if(!allMats.has(m))allMats.set(m,m.side);m.side=T.DoubleSide;}});
 let rays=0,blocked=[];
 for(const gimbal of [-.14,0,.14]){
  e.rearGimbal.rotation.set(gimbal,gimbal,0);e.car.updateMatrixWorld(true);
  for(let nozzle=0;nozzle<e.plumes.length;nozzle++){
   const plume=e.plumes[nozzle],d=e.plumeState.get(plume);vm.runInContext(`setThrusterPlumePower(allThrusterPlumes[${nozzle}],1);`,e.context);e.car.updateMatrixWorld(true);
   const p=d.mesh.geometry.attributes.position;
   // 12 angular rays follow each actual longitudinal envelope trajectory.
   for(let side=0;side<12;side++)for(const row of [1,4,8,12]){
    const start=new T.Vector3().fromBufferAttribute(p,side).applyMatrix4(d.mesh.matrixWorld);
    const finish=new T.Vector3().fromBufferAttribute(p,row*13+side).applyMatrix4(d.mesh.matrixWorld);
    const delta=finish.clone().sub(start),ray=new T.Raycaster(start,delta.clone().normalize(),.001,delta.length());
    const hits=ray.intersectObjects(obstacles,false);rays++;
    if(hits.length)blocked.push({nozzle,gimbal,side,row,hit:hits[0].object.name,distance:hits[0].distance,mouth:start.toArray(),end:finish.toArray()});
   }
  }
 }
 for(const[m,side]of allMats)m.side=side;
 report.portAudit.push({model,cabin,rays,obstacleMeshes:obstacles.length,blocked});
 e.rearGimbal.rotation.set(0,0,0);e.clear();
}
// Check local outlet reaction torques independently of the requested label.
for(const[command,roll,pitch,yaw,strafe]of [['roll+',1,0,0,0],['roll-',-1,0,0,0],['pitch+',0,1,0,0],['pitch-',0,-1,0,0],['yaw+',0,0,1,0],['yaw-',0,0,-1,0],['strafe-left',0,0,0,-1],['strafe-right',0,0,0,1]]){
 e.visualUpdate(.01,false,0,0,false,0,0,roll,pitch,yaw,strafe);e.car.updateMatrixWorld(true);
 const torque=new T.Vector3(),force=new T.Vector3();
 for(const plume of e.plumes){const d=e.plumeState.get(plume);if(!d.power)continue;const exhaust=new T.Vector3(0,0,1).applyEuler(plume.rotation),f=exhaust.multiplyScalar(-d.power);force.add(f);torque.add(plume.position.clone().cross(f));}
 if(roll)assert.ok(torque.z*roll>0);if(pitch)assert.ok(torque.x*pitch>0);if(yaw)assert.ok(torque.y*yaw>0);if(strafe){assert.ok(force.x*strafe>0);assert.ok(Math.abs(torque.y)<1e-12);}
 report.motionAudit.push({command,force:force.toArray(),torque:torque.toArray()});
}
// The visual reverse-brake split must exhaust along all components of paid travel.
for(const velocity of [[0,0,-80],[0,0,80],[80,0,0],[-80,0,0],[0,-80,0],[0,80,0],[40,-30,-50]]){
 Object.assign(e.state,{vx:velocity[0],vy:velocity[1],vz:velocity[2],pitch:0,yaw:0,roll:0});
 e.visualUpdate(.01,false,0,1,false,0,0,0,0,0,0,...velocity);
 const exhaust=new T.Vector3();for(const plume of e.plumes){const d=e.plumeState.get(plume);exhaust.add(new T.Vector3(0,0,1).applyEuler(plume.rotation).multiplyScalar(d.power));}
 const travel=new T.Vector3(...velocity).normalize();assert.ok(exhaust.clone().normalize().dot(travel)>.94);
 report.motionAudit.push({command:'paid-retro',velocity,exhaust:exhaust.toArray(),alignment:exhaust.clone().normalize().dot(travel)});
}
for(const hz of [30,60,144]){
 e.clear();Object.assign(e.state,{vx:20,vy:5,vz:-110,yaw:.7,pitch:-.2,roll:.3});e.attitude.rotation.set(e.state.pitch,e.state.yaw,e.state.roll);e.sonicUpdate(0,true,false);
 let elapsed=0;for(let i=0;i<Math.ceil(hz*.9);i++){e.sonicUpdate(1/hz,false,false);elapsed+=1/hz;assert.ok(e.sonicMaterial.uniforms.uOpacity.value<=.200000001);}
 assert.equal(e.sonic.visible,false);
 e.sonicUpdate(0,true,false);e.sonicUpdate(.4,false,false);e.car.updateMatrixWorld(true);
 const worldAxis=new T.Vector3(0,0,1).applyQuaternion(e.sonic.getWorldQuaternion(new T.Quaternion()));const expected=new T.Vector3(-e.state.vx,-e.state.vy,-e.state.vz).normalize();assert.ok(worldAxis.dot(expected)>1-1e-10);
 e.sonicUpdate(0,false,true);assert.equal(e.sonic.visible,false);
 report.pulseAudit.push({hz,elapsed,alignment:worldAxis.dot(expected),peakOpacity:e.sonicMaterial.uniforms.uOpacity.value,fpvHidden:true});
}
if(baseline){
 const part=s=>s.slice(s.indexOf('  const isRealMode ='),s.indexOf('  const playerWorldZ ='));
 const current=part(fs.readFileSync(path.join(src,'physics-main.js'),'utf8')).replace(/  \/\/ Snapshot only for rendering[^\n]*\n  const retroVisualVx[^\n]*\n/,'');
 const previous=part(fs.readFileSync(path.join(baseline,'physics-main.js'),'utf8'));
 assert.equal(current,previous,'all production motion, impulse, tank and collision code retained byte-for-byte apart from read-only visual snapshot');
 report.physicsPreserved={equal:true,sha256:crypto.createHash('sha256').update(previous).digest('hex')};
}
const blocked=report.portAudit.reduce((n,a)=>n+a.blocked.length,0);report.passed=blocked===0;
const out=process.env.ROADSTER_JET_AUDIT_OUTPUT?path.resolve(process.env.ROADSTER_JET_AUDIT_OUTPUT):path.join(__dirname,'jet-effects/runtime-audit.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,portRays:report.portAudit.reduce((n,a)=>n+a.rays,0),blocked,report:out},null,2));
if(blocked)process.exitCode=1;
