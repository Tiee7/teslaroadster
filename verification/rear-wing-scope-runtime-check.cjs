/** Exact canonical production geometry scope for the requested tail and flat windshield iteration. */
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const{execFileSync}=require('node:child_process');
if(process.argv.length<4)throw Error('Pass frozen nose/screen baseline export and final candidate export.');
const [baseline,candidate]=process.argv.slice(2,4).map(p=>JSON.parse(fs.readFileSync(p,'utf8')));
const sha=v=>crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
function keyed(d){
 const occurrence={},materials=Object.fromEntries(d.materials.map(({id,...m})=>[id,m]));
 return Object.fromEntries(d.meshes.map(({id,...m})=>{
  const name=m.name===`${m.geometryType}-${id+1}`?`unnamed:${m.geometryType}`:m.name;
  return[name+'#'+(occurrence[name]=(occurrence[name]||0)+1),{...m,name,material:m.material.map(id=>materials[id])}];
 }));
}
const before=keyed(baseline),after=keyed(candidate);
const removed=Object.keys(before).filter(k=>!after[k]),added=Object.keys(after).filter(k=>!before[k]);
assert.deepEqual(removed.sort(),['referenceWingEndplateThickness-1#1','referenceWingEndplateThickness1#1'].sort());
assert.deepEqual(added,[],'No added visible mesh submissions.');
const allowed=name=>/^reference(?:WhiteWing|Wing|PanoramicCanopy|WhiteRoofRail|RearPaintedBumper|SculptedJetCarrierRim|JetCarrierDeepWall|JetPocketHeader|ClosedDiffuserBacking|DiffuserFin)/.test(name)||/^interior-(?:screen-housing|live-instruments)$/.test(name);
const changed=[],unchanged=[];
for(const [key,b]of Object.entries(after)){
 const a=before[key];
 if(JSON.stringify(a)===JSON.stringify(b)){unchanged.push(key);continue;}
 assert.ok(allowed(b.name),`Out-of-scope actual geometry changed: ${key}`);changed.push(key);
 if(!/^reference(?:WingSupport|ClosedDiffuserBacking)/.test(b.name))assert.deepEqual(a.material,b.material,`Material changed: ${key}`);
 if(!/^referenceWing(?:BaseMount|Support)/.test(b.name)&&!/^interior-/.test(b.name))assert.deepEqual(a.matrixWorld,b.matrixWorld,`Unexpected pose change: ${key}`);
 if(/^interior-/.test(b.name)){
  assert.deepEqual(a.position,b.position);assert.deepEqual(a.normal,b.normal);assert.deepEqual(a.index,b.index);
  for(let i=0;i<16;i++)assert.ok(Math.abs(b.matrixWorld[i]-a.matrixWorld[i]-(i===13?-.020:0))<1e-12,'Only reference physical-screen mount lowers20mm.');
 }
}
assert.equal(candidate.meshCount,baseline.meshCount-2);
assert.ok(candidate.triangleCount<baseline.triangleCount*1.03,'Real curved throat/wing surface budget exceeded3%.');
const immutable=Object.fromEntries(unchanged.map(k=>[k,after[k]]));
const functional='683f6fd15331d619866b8433520b25d36a75d216',sources={};
for(const file of execFileSync('git',['ls-tree','-r','--name-only',functional,'src'],{encoding:'utf8'}).trim().split('\n')){
 if(['src/reference-exterior.js','src/reference-cockpit.js'].includes(file))continue;
 const current=fs.readFileSync(file),old=execFileSync('git',['show',`${functional}:${file}`]);assert.ok(current.equals(old),`Functional source changed: ${file}`);sources[file]=sha(current.toString());
}
const report={pass:true,scope:'Existing tail surfaces/wing and central front-glass domain only; front nose, side glass, rear roof outline, wheels, jet mouths, cabin geometry and every non-rendering source remain exact. Only the reference physical screen mount lowers20mm to retain12cm glass clearance. Two detached wing thickness boxes removed, no new submissions.',baselineHashes:baseline.sources,candidateHashes:candidate.sources,baselineMeshCount:baseline.meshCount,candidateMeshCount:candidate.meshCount,baselineTriangles:baseline.triangleCount,candidateTriangles:candidate.triangleCount,triangleGrowthPercent:100*(candidate.triangleCount/baseline.triangleCount-1),removedMeshes:removed,changedMeshes:changed,unchangedMeshes:unchanged.length,unchangedOutsideScopeSha256:sha(immutable),functionalBase:functional,unchangedFunctionalSources:sources};
if(process.argv[4])fs.writeFileSync(process.argv[4],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
