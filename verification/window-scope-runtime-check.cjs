/** Verify a window-only iteration against actual canonical Three mesh exports. */
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
if(process.argv.length<4)throw Error('Pass baseline and candidate actual-preview-meshes.json paths, plus optional result path.');
const data=process.argv.slice(2,4).map(p=>JSON.parse(fs.readFileSync(p,'utf8')));
const windowName=name=>/^reference(?:PanoramicCanopy|WhiteRoofRail|SideWindow|RearButtress|WindowSill|WindowSeal)/.test(name);
const canonical=d=>{const mats=Object.fromEntries(d.materials.map(m=>{const{id,...p}=m;return[id,p];}));return d.meshes.map(m=>({...m,material:m.material.map(id=>mats[id])}));};
const [before,after]=data.map(canonical),other=meshes=>meshes.filter(m=>!windowName(m.name));
assert.deepEqual(other(before),other(after),'Geometry/material/pose outside the window/canopy scope changed.');
assert.deepEqual(before.map(m=>m.name),after.map(m=>m.name),'Window revision must not add color mesh submissions.');
const changed=before.filter((m,i)=>JSON.stringify(m)!==JSON.stringify(after[i])).map(m=>m.name);
assert.ok(changed.length>0&&changed.every(windowName));
const result={pass:true,scope:'Exact production-export geometry, normals, indices, material properties/groups and world matrices; window/canopy meshes alone may change. No new visible meshes.',baselineSourceHashes:data[0].sources,candidateSourceHashes:data[1].sources,unchangedOutsideWindowMeshes:other(before).length,changedMeshes:changed,baselineTriangles:data[0].triangleCount,candidateTriangles:data[1].triangleCount,meshCount:data[1].meshCount,nonWindowSha256:crypto.createHash('sha256').update(JSON.stringify(other(after))).digest('hex')};
if(process.argv[4])fs.writeFileSync(process.argv[4],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
