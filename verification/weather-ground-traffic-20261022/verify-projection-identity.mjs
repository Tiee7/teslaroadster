/** Reuse the original identity assertions without overwriting historical reports. */
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const repo=fileURLToPath(new URL('../..',import.meta.url));
const oldFolder=join(repo,'verification/demo-continuous');
const newFolder=join(repo,'verification/weather-ground-traffic-20261022');
const names=['static-projection-identity-only-tests.json','static-projection-identity-only-tests.md'];
const redirects=new Map(names.map(n=>[join(oldFolder,n),join(newFolder,n)]));
const historical=new Map(names.map(n=>[n,fs.readFileSync(join(oldFolder,n))]));
const originalWrite=fs.writeFileSync;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
// Only the two report destinations change. Every assertion, source read,
// build guard and temporary-mirror negative probe runs in the original file.
fs.writeFileSync=function(path,...args){
 const key=resolve(path instanceof URL?fileURLToPath(path):path);
 return originalWrite(redirects.get(key)||path,...args);
};
syncBuiltinESMExports();
try{await import('../demo-continuous/test-static-projection-identity-only.mjs');}
finally{fs.writeFileSync=originalWrite;syncBuiltinESMExports();}
for(const [name,bytes]of historical)assert.deepEqual(fs.readFileSync(join(oldFolder,name)),bytes,'historical report unchanged: '+name);
const reportPath=join(newFolder,names[0]);
const report=JSON.parse(fs.readFileSync(reportPath,'utf8'));
assert.equal(report.passed,true);assert.equal(report.physicsStepsExecuted,0);
report.runnerProvenance={originalAssertions:'verification/demo-continuous/test-static-projection-identity-only.mjs',
 originalAssertionsSha256:sha(fs.readFileSync(join(oldFolder,'test-static-projection-identity-only.mjs'))),
 reportRedirectionOnly:true,historicalReportsUnchanged:true};
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
