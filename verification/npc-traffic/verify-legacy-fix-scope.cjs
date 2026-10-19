const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const beforeFile=process.argv[2]||'/tmp/npc-before-legacy-fix.js',afterFile='src/npc-traffic-assets.js';
function read(file){const c=vm.createContext({});vm.runInContext(fs.readFileSync(file,'utf8')+';this.assets=archivedTrafficAssets;',c);return c.assets;}
const before=read(beforeFile),after=read(afterFile),h=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex'),fileHash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function signature(asset,v,level){return h(v.levels[level].geometries.map(i=>asset.geometryPool[i]));}
const unchanged=[],changed=[];
for(const v of after.variants){const old=before.variants.find(q=>q.id===v.id),levels={};for(const level of['near','far'])levels[level]={before:signature(before,old,level),after:signature(after,v,level)};const same=Object.values(levels).every(x=>x.before===x.after);if(v.id.startsWith('legacy-'))changed.push({id:v.id,levels});else{assert.ok(same,v.id);unchanged.push({id:v.id,levels});}}
const result={pass:true,beforeAssetSha256:fileHash(beforeFile),afterAssetSha256:fileHash(afterFile),unmodifiedHistoricalStyles:unchanged,modifiedLegacyStyles:changed};
fs.writeFileSync('verification/npc-traffic/legacy-lod-fix-scope.json',JSON.stringify(result,null,2)+'\n');
fs.writeFileSync('verification/npc-traffic/historical-style-baseline.json',JSON.stringify(unchanged.map(v=>({id:v.id,levels:Object.fromEntries(Object.entries(v.levels).map(([level,value])=>[level,value.before]))})),null,2)+'\n');
console.log(JSON.stringify({pass:true,unchanged:unchanged.length,changed:changed.map(v=>v.id)},null,2));
