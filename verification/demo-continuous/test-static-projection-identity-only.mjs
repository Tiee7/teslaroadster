/** Identity/build guards only. NEVER call step/jump/physics/driver here. */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { RoadsterDemoNumericProjection } from './browser-static-projection.generated.mjs';
import { emitBrowserStaticProjection, verifyBrowserStaticProjectionBuild } from './emit-browser-static-projection.mjs';
import { EXPECTED_SOURCE_HASHES } from './generate-numeric-projection-kernel.mjs';

const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const folder = join(repo, 'verification/demo-continuous');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const artifact = readFileSync(join(folder, 'browser-static-projection.generated.js'), 'utf8');
const matchLine = name => {
  const match = artifact.match(new RegExp(`^const ${name}=Object\\.freeze\\((.*)\\);$`, 'm'));
  assert.ok(match, name); return JSON.parse(match[1]);
};
const expectedFunctions = matchLine('expectedFunctions'), profiles = matchLine('profiles');
const between = (a, b) => {
  const i = artifact.indexOf(a), j = artifact.indexOf(b, i + a.length);
  assert.ok(i >= 0 && j > i); return artifact.slice(i + a.length, j);
};
const constantsBody = between('const expectedConstants=(()=>{', '})();\nconst expectedHandling=');
const handlingBody = between('const expectedHandling=(()=>{', '})();\nfunction cloneSnapshot');
const declarationRealm = vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
const declare = text => vm.runInContext(text, declarationRealm, {timeout:1000});
// These are identity-only function declarations, not actual helper executions.
// Bodies, including complete updateSimulation, are never invoked by this test.
const freshFunction = source => declare(`(${source})`);
const freshReferences = (profileId = 'three-r128-cpu-vendor-uncompressed') => {
  const profile = profiles.find(value => value.id === profileId); assert.ok(profile);
  return {
    functions:Object.fromEntries(Object.entries(expectedFunctions).map(([name,source])=>[name,freshFunction(source)])),
    math:{clamp:freshFunction(profile.clampSource),lerp:freshFunction(profile.lerpSource)},
    constants:declare(`(()=>{${constantsBody}})()`),
    handling:declare(`(()=>{${handlingBody}})()`)
  };
};
const rows = [];
const test = (name, kind, action) => {
  action(); rows.push({name,kind,passed:true});
};
const identityReject = (action, detail) => {
  assert.throws(action, error => error.code === 'PROJECTION_RUNTIME_IDENTITY_MISMATCH' &&
    (detail === undefined || error.detail === detail));
};
const bind = refs => RoadsterDemoNumericProjection.createForVerification(()=>refs);
const firstReject = (name, mutate, detail) => test(name,'first-bind-rejection',()=>{
  const refs=freshReferences();mutate(refs);identityReject(()=>bind(refs),detail);
});
const cachedReject = (name, mutate, detail) => test(name,'cached-reference-or-value-rejection',()=>{
  const refs=freshReferences(),kernel=bind(refs);mutate(refs);identityReject(()=>kernel.assertRuntime(),detail);
});

const immutableFiles = [...Object.keys(EXPECTED_SOURCE_HASHES),
  'verification/demo-continuous/generate-numeric-projection-kernel.mjs',
  'verification/demo-continuous/emit-browser-static-projection.mjs',
  'verification/demo-continuous/browser-static-projection.generated.js',
  'verification/demo-continuous/browser-static-projection.generated.mjs',
  'verification/demo-continuous/browser-static-projection-identity.generated.mjs',
  'verification/demo-continuous/numeric-math-identity-profiles.json'];
const beforeHashes=Object.fromEntries(immutableFiles.map(name=>[name,sha256(readFileSync(join(repo,name)))]));

test('CPU exact recorded math pair binds','positive-identity',()=>{
  const kernel=bind(freshReferences());assert.equal(kernel.assertRuntime(),true);
  assert.equal(kernel.identity().mathProfile,'three-r128-cpu-vendor-uncompressed');
});
test('minified exact recorded math pair binds','positive-identity',()=>{
  const kernel=bind(freshReferences('three-r128-browser-bundle-minified'));assert.equal(kernel.assertRuntime(),true);
  assert.equal(kernel.identity().mathProfile,'three-r128-browser-bundle-minified');
});
firstReject('missing function rejected',refs=>{delete refs.functions.wrapAnglePi},'function-keys');
firstReject('nonfunction rejected',refs=>{refs.functions.wrapAnglePi=0},'wrapAnglePi.source');
firstReject('different helper source rejected',refs=>{refs.functions.wrapAnglePi=freshFunction('function wrapAnglePi(rad){return rad}')},'wrapAnglePi.source');
firstReject('different full update source rejected',refs=>{refs.functions.updateSimulation=freshFunction('function updateSimulation(dt){}')},'updateSimulation.source');
firstReject('unknown math pair rejected',refs=>{refs.math.clamp=freshFunction('function clamp(x,a,b){return x}')},'math.unknown-profile');
firstReject('mixed recorded math pair rejected',refs=>{refs.math.lerp=freshFunction(profiles.find(value=>value.id==='three-r128-browser-bundle-minified').lerpSource)},'math.unknown-profile');
firstReject('wrong gravity constant rejected',refs=>{refs.constants.EARTH_GRAVITY_MPS2=9.8},'constants.EARTH_GRAVITY_MPS2');
firstReject('wrong handling value rejected',refs=>{refs.handling={...refs.handling,rackRate:31}},'handling.rackRate');
firstReject('missing handling key rejected',refs=>{refs.handling={rackRate:30,yawRate:18,lateralRate:24}},'handling.keys');
cachedReject('same-source new helper reference rejected',refs=>{
  const old=refs.functions.wrapAnglePi;refs.functions.wrapAnglePi=freshFunction(expectedFunctions.wrapAnglePi);
  assert.notEqual(old,refs.functions.wrapAnglePi);assert.equal(Function.prototype.toString.call(old),Function.prototype.toString.call(refs.functions.wrapAnglePi));
},'wrapAnglePi.reference');
cachedReject('same-source new math reference rejected',refs=>{
  refs.math.clamp=freshFunction(profiles.find(value=>value.id==='three-r128-cpu-vendor-uncompressed').clampSource);
},'math.reference');
cachedReject('equal-value new handling reference rejected',refs=>{refs.handling={...refs.handling}},'handling.reference');
cachedReject('cached gravity mutation rejected',refs=>{refs.constants.EARTH_GRAVITY_MPS2=9.8},'constants.EARTH_GRAVITY_MPS2');
cachedReject('cached lane value mutation rejected',refs=>{refs.constants.LANE_CENTERS[0]=-12.4},'constants.LANE_CENTERS.0');
test('restoring original reference restores valid identity','positive-identity',()=>{
  const refs=freshReferences(),kernel=bind(refs),old=refs.functions.wrapAnglePi;
  refs.functions.wrapAnglePi=freshFunction(expectedFunctions.wrapAnglePi);
  identityReject(()=>kernel.assertRuntime(),'wrapAnglePi.reference');refs.functions.wrapAnglePi=old;
  assert.equal(kernel.assertRuntime(),true);
});

const mirror=mkdtempSync(join(tmpdir(),'roadster-static-identity-only-'));
try {
  const mirrorFiles=[...Object.keys(EXPECTED_SOURCE_HASHES),
    'verification/demo-continuous/generate-numeric-projection-kernel.mjs',
    'verification/demo-continuous/numeric-math-identity-profiles.json',
    'verification/demo-continuous/browser-static-projection.generated.js'];
  for(const name of mirrorFiles){mkdirSync(dirname(join(mirror,name)),{recursive:true});copyFileSync(join(repo,name),join(mirror,name));}
  test('unchanged source mirror generates exact artifact','positive-build',()=>{
    assert.equal(emitBrowserStaticProjection({repo:mirror}).browserSource,artifact);
    assert.equal(verifyBrowserStaticProjectionBuild(join(mirror,'verification/demo-continuous/browser-static-projection.generated.js'),mirror).valid,true);
  });
  for(const name of Object.keys(EXPECTED_SOURCE_HASHES))test(`changed complete source rejects: ${name}`,'build-source-rejection',()=>{
    const path=join(mirror,name),original=readFileSync(path);writeFileSync(path,Buffer.concat([original,Buffer.from('\n// identity-only stale-source probe\n')]));
    try{assert.throws(()=>emitBrowserStaticProjection({repo:mirror}),error=>error.code==='PROJECTION_SOURCE_MISMATCH'&&error.source===name);}
    finally{writeFileSync(path,original);}
  });
  test('changed frozen generator rejects','build-generator-rejection',()=>{
    const path=join(mirror,'verification/demo-continuous/generate-numeric-projection-kernel.mjs'),original=readFileSync(path);
    writeFileSync(path,Buffer.concat([original,Buffer.from('\n// stale generator\n')]));
    try{assert.throws(()=>emitBrowserStaticProjection({repo:mirror}),/Frozen Node generator changed/);}finally{writeFileSync(path,original);}
  });
  test('changed math profile artifact rejects','build-profile-rejection',()=>{
    const path=join(mirror,'verification/demo-continuous/numeric-math-identity-profiles.json'),original=readFileSync(path);
    writeFileSync(path,Buffer.concat([original,Buffer.from('\n')]));
    try{assert.throws(()=>emitBrowserStaticProjection({repo:mirror}),/Audited math profile artifact changed/);}finally{writeFileSync(path,original);}
  });
  test('changed emitted bytes reject','build-artifact-rejection',()=>{
    const path=join(mirror,'verification/demo-continuous/browser-static-projection.generated.js'),original=readFileSync(path);
    writeFileSync(path,Buffer.concat([original,Buffer.from('\n// stale output\n')]));
    try{assert.throws(()=>verifyBrowserStaticProjectionBuild(path,mirror),/differs from exact current emission/);}finally{writeFileSync(path,original);}
  });
}finally{rmSync(mirror,{recursive:true,force:true});}

const afterHashes=Object.fromEntries(immutableFiles.map(name=>[name,sha256(readFileSync(join(repo,name)))]));
assert.deepEqual(afterHashes,beforeHashes);
const report={schema:'static-projection-identity-only-tests-v1',generatedAt:new Date().toISOString(),passed:true,
  totalTests:rows.length,byKind:Object.fromEntries([...new Set(rows.map(row=>row.kind))].map(kind=>[kind,rows.filter(row=>row.kind===kind).length])),
  rows,sourceAndArtifactHashes:beforeHashes,sourceAndArtifactsUnchanged:true,
  physicsStepsExecuted:0,jumpEntriesExecuted:0,driverStepsExecuted:0,browserRuns:0,fullUpdateSimulationCalls:0,
  numericalCoreSha256:RoadsterDemoNumericProjection.manifest.numericalProgramSourceSha256,
  mathIdentityNote:'Positive identities use exact recorded source declarations only. The actual bundle is not loaded again and no clamp/lerp or physics body is called.',
  executionBoundary:'Only static module/factory/binder/assertRuntime instantiation and build guard checks. Source functions are identity-only declarations. All destructive source probes occur in a temporary mirror; live repo source and generated artifacts remain unchanged.'};
writeFileSync(join(folder,'static-projection-identity-only-tests.json'),JSON.stringify(report,null,2)+'\n');
writeFileSync(join(folder,'static-projection-identity-only-tests.md'),
  `# Static projection identity-only tests\n\nAll ${rows.length} tests passed.\n\n`+
  Object.entries(report.byKind).map(([kind,count])=>`- ${kind}: ${count}`).join('\n')+
  `\n\nNo physics, jump entry, driver, browser, full update or math-function body was executed. Positive source functions were declarations for identity only; the actual vendor bundle was not loaded again. Build mutations were confined to a temporary mirror, and every recorded live source/generated artifact hash remained unchanged. This tests identity/build guards, not numerical equivalence, gameplay, scheduler timing or page provenance.\n\n`+
  rows.map((row,index)=>`${index+1}. PASS: ${row.name}`).join('\n')+'\n');
console.log(JSON.stringify({passed:true,totalTests:report.totalTests,byKind:report.byKind,physicsStepsExecuted:0,
  sourceAndArtifactsUnchanged:true,numericalCoreSha256:report.numericalCoreSha256},null,2));
