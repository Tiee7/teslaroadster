import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const bytes=readFileSync(new URL('../assets/vehicle-variants/catalog-v3.json',import.meta.url));
const catalog=JSON.parse(bytes),manifest=JSON.parse(readFileSync(new URL('../assets/vehicle-variants/roadster-vehicle-originals-v3-manifest.json',import.meta.url)));
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
test('compact provenance retains all original identities and an independently recoverable versioned archive',()=>{
 assert.equal(catalog.entries.length,20);assert.equal(catalog.geometryVariants.length,12);
 assert.equal(manifest.entries,20);assert.equal(manifest.distinctGeometryVariants,12);assert.equal(manifest.archiveBranch,'archive/vehicle-originals-v3-20261019');
 assert.equal(manifest.archivePath,'archives/roadster-vehicle-originals-v3-20261019.zip');assert.match(manifest.archiveSha256,/^[a-f0-9]{64}$/);assert.ok(manifest.archiveBytes<20_000_000);
 const files=new Map(manifest.files.map(file=>[file.path,file]));assert.equal(files.size,manifest.files.length);assert.ok(files.size>1100);
 assert.equal(files.get('assets/vehicle-variants/catalog-v3.json').sha256,hash(bytes));
 for(const file of files.values()){assert.ok(file.bytes>0);assert.match(file.sha256,/^[a-f0-9]{64}$/);assert.doesNotMatch(file.path,/(?:^|\/)\.\.(?:\/|$)|^\//);}
 function visit(value){if(!value||typeof value!=='object')return;if(typeof value.object==='string'){assert.ok(files.has('assets/vehicle-variants/'+value.object),value.object);assert.match(value.sha256,/^[a-f0-9]{64}$/);}for(const item of Object.values(value))visit(item);}
 visit(catalog);
});
test('crowned-window source hashes and exact parent/commit lineage do not need private Git history',()=>{
 const entry=catalog.entries.find(entry=>entry.id==='crowned-window-2d4bbf7');
 assert.equal(entry.origin.commit,'2d4bbf7d691c68a42a91ebab272499989a28df6c');assert.equal(entry.parentCommit,'1bf6034f6089f4ffe8f4c105ff9ad803a0cea6de');
 assert.equal(entry.originalSources.files['reference-exterior.js'].sha256,'1ea3044926d851befa04d70f1716cba9997bb2ce4525b57694c28a9b5014b63d');
 assert.equal(entry.geometryVariant,'roadster-482991b20d0c7983');assert.match(entry.originalPreview.rawSha256,/^[a-f0-9]{64}$/);
 const rebase=catalog.entries.find(e=>e.id==='first-visual-rebased-e4313dc'),first=catalog.entries.find(e=>e.id==='first-visual-e3ba317');assert.equal(rebase.geometrySha256,first.geometrySha256);
});
test('startup ships only clean compact profiles and never reads original or quarantined payloads',()=>{
 const build=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8'),runtime=readFileSync(new URL('../src/reference-traffic.js',import.meta.url),'utf8');
 assert.doesNotMatch(build,/vehicle-variants|archives|\bcp\(/);assert.doesNotMatch(runtime,/fetch\(|XMLHttpRequest|vertex-cluster-v1|shared-position-cluster-v2|objects\//);
 assert.equal(existsSync(new URL('../assets/vehicle-variants/objects',import.meta.url)),false,'originals live on their dedicated archive branch');
});
