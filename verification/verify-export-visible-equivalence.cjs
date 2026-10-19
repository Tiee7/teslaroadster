/** Exact visible-mesh equality for metadata-only changes between render snapshots. */
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const files=process.argv.slice(2,4);if(files.length!==2)throw Error('Pass two actual-preview-meshes.json exports, then optional result.json.');
const inputs=files.map(f=>JSON.parse(fs.readFileSync(f,'utf8')));
function canonical(data){
 const materials=Object.fromEntries(data.materials.map(m=>{const {id,...properties}=m;return [id,properties];}));
 return data.meshes.map(m=>({...m,material:m.material.map(id=>materials[id])}));
}
const canonicalInputs=inputs.map(canonical);assert.deepEqual(canonicalInputs[0],canonicalInputs[1],'Visible geometry, normals, indices, material properties, group assignments or world poses differ.');
const hashes=canonicalInputs.map(m=>crypto.createHash('sha256').update(JSON.stringify(m)).digest('hex'));
const result={pass:true,verifiedAt:new Date().toISOString(),scope:'Exact equality of every exported visible source mesh, original vertex normals, triangle indices, material properties, material group assignments, draw ranges and world matrices. Random runtime material UUIDs excluded.',visibleExportSha256Before:hashes[0],visibleExportSha256After:hashes[1],meshCount:inputs[0].meshCount,triangleCount:inputs[0].triangleCount,renderedSourceHashes:inputs[0].sources,currentSourceHashes:inputs[1].sources,changedSourceFiles:Object.keys(inputs[0].sources).filter(f=>inputs[0].sources[f]!==inputs[1].sources[f]),note:'Visible export equality only; source-side effects outside canonical preview require separate runtime checks.'};
if(process.argv[4])fs.writeFileSync(process.argv[4],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
