import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read = p => readFileSync(new URL('../' + p, import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
test('bundled build identity hashes every source input deterministically, including diagnostic wiring and approved assets', () => {
 const html=read('index.html').toString(),match=html.match(/window\.RoadsterBuildInfo=Object\.freeze\((\{"id":[^\n]+)\);/);
 assert.ok(match,'bundle exposes deterministic source identity before the game modules');
 const build=JSON.parse(match[1]);assert.equal(build.schema,'roadster-source-manifest-v1');
 assert.ok(build.sourceSha256['src/render-diagnostics.js']);assert.ok(build.sourceSha256['bundle_app.py']);
 for(const [path,hash] of Object.entries(build.sourceSha256))assert.equal(sha(read(path)),hash,path);
 const canonical=Object.fromEntries(Object.entries(build.sourceSha256).sort(([a],[b])=>a.localeCompare(b)));
 assert.equal(sha(JSON.stringify(canonical)),build.id);
 for(const file of ['reference-exterior','reference-cockpit','vehicles','reference-traffic','npc-traffic-assets'])assert.ok(build.sourceSha256['src/'+file+'.js']);
 assert.ok(html.indexOf('window.RoadsterBuildInfo=')<html.indexOf('// MODULE: config.js'));
});
