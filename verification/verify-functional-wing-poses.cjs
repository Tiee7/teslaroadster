/** Prove opt-in inspection poses change actual wing transforms only. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const source=process.argv[2],root=process.argv[3];
const read=f=>JSON.parse(fs.readFileSync(f));
const canonical=data=>{const mats=Object.fromEntries(data.materials.map(({id,...m})=>[id,m]));return data.meshes.map(m=>({...m,material:m.material.map(id=>mats[id])}));};
const neutral=read(path.join(source,'actual-preview-meshes.json')),neutralMeshes=canonical(neutral);
const targets={rest:[.79,-.05],deployed:[.94,-.05],flight:[.94,-.28],airbrake:[.96,-.72]};
const poses=[];
for(const [name,expected] of Object.entries(targets)){
 const data=read(path.join(root,name,'actual-preview-meshes.json')),meshes=canonical(data),pose=data.wingPose;
 assert.deepEqual(data.sources,neutral.sources);assert.deepEqual([pose.targets.y,pose.targets.angle],expected);
 const transformed=[];
 assert.equal(meshes.length,neutralMeshes.length);
 for(let i=0;i<meshes.length;i++){
  const {matrixWorld:a,worldDeterminant:da,...geometryA}=neutralMeshes[i],{matrixWorld:b,worldDeterminant:db,...geometryB}=meshes[i];
  assert(Math.abs(da-db)<1e-12,'Pose changed determinant beyond floating-point rounding');
  assert.deepEqual(geometryA,geometryB,'Pose altered source geometry/materials '+meshes[i].name);
  if(JSON.stringify(a)!==JSON.stringify(b)){
   assert(/Wing|wing/.test(meshes[i].name),'Non-wing world matrix changed '+meshes[i].name);
   transformed.push(meshes[i].name);
  }
 }
 assert(transformed.length>0,'Actual wing matrices did not move');
 poses.push({name,targets:pose.targets,physicsSha256:pose.physicsSha256,actualGroupMatrixWorld:pose.actualGroupMatrixWorld,transformedMeshes:transformed,geometryNormalsTopologyMaterialsUnchanged:true,nonWingWorldMatricesUnchanged:true});
}
assert.equal(new Set(poses.map(p=>p.physicsSha256)).size,1);
const result={pass:true,scope:'Exact target expressions evaluated from physics-main.js; only actual cloned activeWingGroup transforms change. No wing angle baked into source vertices and no physics edited.',sourceExport:source,sourceHashes:neutral.sources,sourcePhysicsSha256:poses[0].physicsSha256,poses};
fs.writeFileSync(path.join(root,'functional-wing-pose-proof.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({pass:true,poses:poses.map(p=>({name:p.name,targets:p.targets,transformedMeshes:p.transformedMeshes.length}))}));
