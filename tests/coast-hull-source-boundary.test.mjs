import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),sha=s=>createHash('sha256').update(s).digest('hex');
const epoch=JSON.parse(read('verification/coast-hull-contact-20261022/source-epoch.json'));
const inherited=JSON.parse(read(epoch.inheritedTrafficEpoch));
const stability=JSON.parse(read('verification/drive-stability-20261022/source-epoch.json'));
const pier=JSON.parse(read('verification/coast-pier-contact-20261022/source-epoch.json'));
const boundary=JSON.parse(read('verification/coast-boundary-20261022/source-epoch.json'));
const historical=p=>read(stability.baselineSourceFixtures[p]?.path||p);
const pins={...epoch.frozenSourceSha256,...epoch.authorizedSourceSha256,...stability.authorizedSourceSha256, ...boundary.authorizedSourceSha256,...pier.authorizedSourceSha256};
function verify(overrides={}){
 for(const p of Object.keys(overrides))assert.ok(Object.hasOwn(pins,p),'unknown source '+p);
 for(const [p,h]of Object.entries(pins))assert.equal(sha(Object.hasOwn(overrides,p)?overrides[p]:read(p)),h,p);
}
function removeRegion(source,a,b){assert.equal(source.split(a).length,2);const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(j>i);return source.slice(0,i)+source.slice(j);}

test('coast hull repair explicitly inherits immutable2c traffic/single-seat preview and exact source fixtures',()=>{
 assert.equal(epoch.schema,'coast-hull-contact-source-epoch-v1');assert.equal(epoch.basePreview,'2c217c077c82b014f47a1365b6d803574ac47946');
 assert.equal(epoch.mainUnchanged,'4451a11c9c09d031a9da037ce63afe4bb7f062e5');assert.match(epoch.publicationScope,/^preview-only; same PR20;/);
 assert.equal(epoch.inheritedTrafficEpochSha256,'2f29b8317572cc7c3c7ffc532594ad9bc64564af12d16bcb888ab90e929d3d69');assert.equal(sha(read(epoch.inheritedTrafficEpoch)),epoch.inheritedTrafficEpochSha256);
 assert.deepEqual(Object.keys(epoch.authorizedSourceSha256).sort(),['src/demo-numeric-projection.js','src/physics-main.js','verification/demo-continuous/emit-browser-static-projection.mjs','verification/demo-continuous/generate-numeric-projection-kernel.mjs']);
 for(const [p,f]of Object.entries(epoch.baselineSourceFixtures)){assert.equal(sha(read(f.path)),f.sha256,p);assert.equal(f.sha256,inherited.authorizedSourceSha256[p]);}
 assert.match(epoch.originalUserEvent,/Not matched/);
});

test('all current sources stay pinned; assets, rendering, ground meshes, traffic, weather and single passenger remain exact',()=>{
 verify();assert.deepEqual(Object.keys(pins).filter(p=>p.startsWith('src/')).sort(),readdirSync(new URL('../src/',import.meta.url)).map(p=>'src/'+p).sort());
 for(const p of ['src/vehicles.js','src/reference-exterior.js','src/reference-cockpit.js','src/npc-traffic-assets.js','src/reference-traffic.js','src/coast-road-network.js','src/coast-map.js','src/highway-traffic.js','src/config.js','src/world.js','src/taxi.js','src/render-health.js'])assert.equal(epoch.frozenSourceSha256[p],({...inherited.frozenSourceSha256,...inherited.authorizedSourceSha256})[p],p);
 assert.equal(epoch.frozenPassengerCapacity,1);assert.equal(sha(read('src/taxi.js')),'5a228e3dd438fbcc0d4f5b5216608b09717ee6b975d05f094b879cc93aa0f88a');
});

test('physics byte delta is only coast hull geometry/contact and the existing autoland distance input, never a camera or force rewrite',()=>{
 const before=read(epoch.baselineSourceFixtures['src/physics-main.js'].path),after=historical('src/physics-main.js');
 let normalized=removeRegion(after,'// Coast-only landing uses the rotated, frozen player collider,','function coastTrafficBody(car,pose) {');
 normalized=removeRegion(normalized,'  // Complete the coast contact after attitude integration as well:','  if(coastGroundAttached){\n    const plane=coastWorld.network.groundAttitude(coastSupport.normal,state.yaw);');
 normalized=removeRegion(normalized,'  // Keep the existing braking law, but a rotated coast hull can meet the','  const needsEmergencyLandingSave = (');
 assert.equal(normalized.split('landingClearance').length-1,3);normalized=normalized.replaceAll('landingClearance','agl');assert.equal(normalized,before,'every other production physics byte is preserved');
 assert.match(after,/coastWorld&&!coastGroundAttached\?coastBodyGroundLanding\(coastWorld,coastMotionStart,state\):null/);
 assert.match(after,/coastWorld&&coastSurface\?\.solid\?Math\.min\(agl,coastBodyGroundClearance\(state,coastSurface\)\):agl/);
 assert.match(after,/height:finite\.height,bodyContact:true/);assert.ok(!after.includes('a.y>=s.height-3.5'),'no arbitrary low-Y rescue band');
});

test('projection generators change only their explicit physics/generator/program identity pins',()=>{
 const g='verification/demo-continuous/generate-numeric-projection-kernel.mjs',emit='verification/demo-continuous/emit-browser-static-projection.mjs';
 const oldPhysics=epoch.baselineSourceFixtures['src/physics-main.js'].sha256,newPhysics=epoch.authorizedSourceSha256['src/physics-main.js'];
 assert.equal(historical(g).replace(newPhysics,oldPhysics),read(epoch.baselineSourceFixtures[g].path));
 assert.equal(historical(emit).replace(epoch.numericProjection.currentGeneratorSha256,epoch.numericProjection.previousGeneratorSha256).replace(epoch.numericProjection.currentProgramSha256,epoch.numericProjection.previousProgramSha256),read(epoch.baselineSourceFixtures[emit].path));
});

test('negative guards reject omitted hull repair, core-asset/handling/traffic/passenger/terrain drift and unknown gameplay modules',()=>{
 for(const p of ['src/physics-main.js','src/vehicles.js','src/config.js','src/highway-traffic.js','src/taxi.js','src/coast-map.js','src/coast-road-network.js','src/render-health.js']){
  const value=p==='src/physics-main.js'?read(epoch.baselineSourceFixtures[p].path):read(p)+'\n// unauthorized drift\n';assert.throws(()=>verify({[p]:value}),e=>e.code==='ERR_ASSERTION'&&e.message.includes(p));
 }
 assert.throws(()=>verify({'src/new-gameplay.js':''}),/unknown source/);
});
