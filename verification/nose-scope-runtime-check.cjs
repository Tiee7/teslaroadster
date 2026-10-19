/** Exact canonical mesh comparison against the frozen window model with the same live screen fix. */
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
if(process.argv.length<4)throw Error('Pass baseline and candidate exports, then optional result path.');
const data=process.argv.slice(2,4).map(p=>JSON.parse(fs.readFileSync(p,'utf8')));
const allowed=name=>/^reference(?:FlatWedgeHood|Shoulder-?1$|UpperFlank|SculptedDoor|ArchReturn|CarbonSill|LampShoulderBridge|FrontWing|FrontCheek|FrontCarbonCorner|FrontFasciaRecess|FrontLowerIntake|GrilleHorizontalBlade|FrontSplitter|NoseBadge|RearPaintedBumper|ClosedUndertray|DiffuserFin|TriangleHeadlamp|LampPocketWall|HeadlightProjector|FrontBarHousing|CrossNoseLight)/.test(name);
const canonical=d=>{const mats=Object.fromEntries(d.materials.map(({id,...m})=>[id,m]));return d.meshes.map(m=>({...m,material:m.material.map(id=>mats[id])}));};
const [before,after]=data.map(canonical);
assert.deepEqual(before.map(m=>m.name),after.map(m=>m.name),'No added visible mesh submissions.');
const changed=[];
for(let i=0;i<before.length;i++){
 const a=before[i],b=after[i];
 assert.deepEqual(a.material,b.material,`${a.name}: material changed`);
 assert.deepEqual(a.matrixWorld,b.matrixWorld,`${a.name}: animation/pose changed`);
 if(JSON.stringify(a)!==JSON.stringify(b)){assert.ok(allowed(a.name),`Out-of-scope mesh changed: ${a.name}`);changed.push(a.name);}
}
const baseline='683f6fd15331d619866b8433520b25d36a75d216';
const sourceFiles=execFileSync('git',['ls-tree','-r','--name-only',baseline,'src'],{encoding:'utf8'}).trim().split('\n');
const unchangedSources={};
for(const file of sourceFiles){
 if(['src/reference-exterior.js','src/reference-cockpit.js'].includes(file))continue;
 const previous=execFileSync('git',['show',`${baseline}:${file}`]),current=fs.readFileSync(file);
 assert.ok(previous.equals(current),`Functional source changed: ${file}`);
 unchangedSources[file]=crypto.createHash('sha256').update(current).digest('hex');
}
assert.ok(data[1].triangleCount<data[0].triangleCount,'Bounded revision should not grow triangles.');
const fixed=after.filter(m=>!allowed(m.name));
const result={pass:true,baselineFunctionalCommit:baseline,scope:'Only existing front-envelope/mask surfaces plus the existing rear white bridge and thin divider surfaces may change. Shared side grids are reparameterized to the shorter nose. All materials, world matrices, window/canopy/wheel/jet meshes and every non-rendering source are exact.',baselineSourceHashes:data[0].sources,candidateSourceHashes:data[1].sources,changedMeshes:changed,unchangedMeshes:after.length-changed.length,baselineMeshCount:data[0].meshCount,candidateMeshCount:data[1].meshCount,baselineTriangles:data[0].triangleCount,candidateTriangles:data[1].triangleCount,unchangedFunctionalSources:unchangedSources,unchangedOutsideScopeSha256:crypto.createHash('sha256').update(JSON.stringify(fixed)).digest('hex')};
if(process.argv[4])fs.writeFileSync(process.argv[4],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
