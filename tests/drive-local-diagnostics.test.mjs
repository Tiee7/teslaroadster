import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {nativeAvailable,nativeWorld} from './helpers/coast-hull-native-harness.mjs';
const source=readFileSync(new URL('../src/render-diagnostics.js',import.meta.url),'utf8');
const plain=v=>JSON.parse(JSON.stringify(v));
const ids=['audio-settings','btn-settings','btn-map-audio-settings','btn-lang','btn-modal-lang','btn-map-modal-lang','ranked-language','drive-problem-tools','drive-problem-title','drive-problem-note','btn-copy-drive-problem','btn-save-drive-problem','drive-problem-status','drive-problem-data','btn-copy-crash-problem','crash-problem-status','crash-problem-data','modal-destroyed','btn-crash-respawn','btn-crash-switch-map'];
function fixture({clipboard=async()=>{},support=()=>({id:'road-0',height:0,solid:true,road:true,normal:{x:0,y:1,z:0}}),map='coast',meshes={}}={}){
 const elements=Object.fromEntries(ids.map(id=>[id,{id,textContent:'',value:'',hidden:true,disabled:true,open:id==='audio-settings',events:{},classList:{contains:k=>id==='modal-destroyed'?false:false},addEventListener(k,fn){(this.events[k]??=[]).push(fn);},fire(k,event={}){const e={currentTarget:this,...event};for(const f of this.events[k]||[])f(e);return e;},focus(){this.focused=true;},select(){this.selected=true;}}]));
 const state={x:6,y:0,z:-20,vx:0,vy:0,vz:-30,yaw:0,pitch:0,roll:0,airRemaining:8,hullIntegrity:100,wasAirborne:false,coastSupportId:'road-0',physicsMode:'realistic',lastImpactG:0,lastImpactDvKmh:0};
 const calls={support:0,downloads:[],revokes:[],timers:[],clipboard:[]},window={RoadsterBuildInfo:{schema:'roadster-source-manifest-v1',id:'abcdef0123456789',sourceSha256:{'src/physics-main.js':'a'.repeat(64),'private-file':'secret'}},RoadsterCoast:{support:p=>{calls.support++;return support(p);}},RoadsterCityDiagnostics:{setRuntimeReader(){},snapshot:()=>({map:'city',tick:7,contact:{kind:'traffic-body',id:3,normal:{x:0,y:0,z:1,depth:.01}},deltaV:8,secret:'excluded'})}};
 const scene={onBeforeRender(){return'before';},onAfterRender(){return'after';},getObjectByName:n=>meshes[n]};
 const c=vm.createContext({window,state,currentMap:map,currentLang:'zh',weatherIndex:0,cameraModeIndex:2,scene,trafficCars:[],camera:{},renderer:{domElement:{addEventListener(){}}},performance,navigator:{clipboard:{writeText:text=>{calls.clipboard.push(text);return clipboard(text);}}},document:{getElementById:id=>elements[id]??null,createElement:()=>({click(){calls.downloads.push(this);},remove(){}})},Blob:class{constructor(parts,opts){this.parts=parts;this.type=opts.type;}},URL:{createObjectURL:b=>{calls.blob=b;return'blob:local-game';},revokeObjectURL:u=>calls.revokes.push(u)},setTimeout:fn=>calls.timers.push(fn)});
 vm.runInContext(source,c);return{c,state,scene,window,elements,calls,api:window.RoadsterDriveDiagnostics};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('local report fixes missing coast capture without changing the existing city incident schema',()=>{
 const h=fixture(),before=structuredClone(h.state),r=plain(h.api.snapshot());assert.equal(r.schema,'roadster-local-problem-v1');assert.equal(r.map,'coast');assert.equal(r.available,true);assert.equal(r.support.selected.id,'road-0');assert.equal(r.impact.cityContact,null,'never mislabel the last city incident as a coast impact');assert.deepEqual(h.state,before);assert.equal(r.build.sourceInputCount,1);assert.equal(r.build.sourceSha256['private-file'],undefined);
 const city=fixture({map:'city'}),report=city.api.snapshot();assert.equal(report.impact.cityContact.kind,'traffic-body');assert.equal(report.impact.cityContact.deltaV,8);assert.equal(report.impact.cityContact.secret,undefined);
});

test('render pose ring is bounded, clone-safe and makes no support/geometry queries per frame',()=>{
 const h=fixture();for(let i=0;i<1000;i++){h.state.x=i;assert.equal(h.scene.onAfterRender(),'after');}
 assert.equal(h.calls.support,0);assert.deepEqual(plain(h.api.stats()),{capacity:96,storedFrames:96,bytes:9216});const r=h.api.snapshot();assert.equal(h.calls.support,1);assert.equal(r.recent.trace.length,96);assert.equal(r.recent.trace[0][1],905);assert.match(r.recent.sampling,/not exact physics/);r.recent.trace[0][1]=-1;assert.notEqual(h.api.snapshot().recent.trace[0][1],-1);h.c.currentMap='highway';h.scene.onAfterRender();assert.equal(h.api.stats().storedFrames,1,'map switch cannot mix worlds in the recent ring');
});

test('game-only allowlist excludes account, nickname, typed keys, storage, device identifiers and arbitrary errors',()=>{
 const h=fixture({support:()=>{throw Error('secret-user/path');}});Object.assign(h.state,{nickname:'private nickname',email:'private@email',lastUrl:'https://private',userInput:'typed secret'});h.c.keys={typed:'secret'};const r=JSON.stringify(h.api.snapshot());assert.doesNotMatch(r,/private nickname|private@email|typed secret|secret-user|https:\/\/private/);assert.match(r,/Support query unavailable/);assert.doesNotMatch(source,/fetch\s*\(|sendBeacon|XMLHttpRequest|WebSocket|localStorage|sessionStorage|userAgent|document\.cookie|location\.href|readPixels|getError\s*\(/);
});

test('nonfinite values remain unknown, never fake zero speed, and no active map returns an explicit unavailable record',()=>{
 const h=fixture();h.state.vx=NaN;h.state.y=Infinity;const r=plain(h.api.snapshot());assert.equal(r.velocity.x,null);assert.equal(r.pose.y,null);assert.match(h.api.brief(),/\? km\/h/);h.c.currentMap='unknown';assert.equal(h.api.snapshot().available,false);
});

test('copy is explicit, brief, local, bilingual and does not run when settings merely opens',async()=>{
 const h=fixture();assert.equal(h.calls.clipboard.length,0);h.elements['btn-settings'].fire('click');assert.equal(h.calls.clipboard.length,0);assert.equal(h.elements['btn-copy-drive-problem'].textContent,'复制简要记录');h.elements['btn-copy-drive-problem'].fire('click');await settle();assert.equal(h.calls.clipboard.length,1);assert.ok(Buffer.byteLength(h.calls.clipboard[0])<1800);assert.match(h.calls.clipboard[0],/Map: coast/);assert.match(h.elements['drive-problem-status'].textContent,/已复制/);assert.equal(h.elements['drive-problem-data'].hidden,false);h.c.currentLang='en';h.elements['btn-settings'].fire('click');assert.equal(h.elements['btn-copy-drive-problem'].textContent,'Copy brief report');
});

for(const behavior of['missing','reject','throw'])test(`clipboard ${behavior} leaves an immediately selectable manual record and never retries`,async()=>{
 const h=fixture({clipboard:()=>{if(behavior==='throw')throw Error('denied');return Promise.reject(Error('denied'));}});if(behavior==='missing')h.c.navigator={};h.elements['btn-copy-drive-problem'].fire('click');await settle();assert.equal(h.calls.clipboard.length,behavior==='missing'?0:1);assert.equal(h.elements['drive-problem-data'].hidden,false);assert.ok(h.elements['drive-problem-data'].selected);assert.match(h.elements['drive-problem-status'].textContent,/手动复制/);
});

test('late copy settlement cannot reopen or overwrite a dismissed/newer flow',async()=>{
 let resolve;const h=fixture({clipboard:()=>new Promise(r=>resolve=r)});h.elements['btn-copy-drive-problem'].fire('click');h.elements['audio-settings'].open=false;h.elements['audio-settings'].fire('close');resolve();await settle();assert.equal(h.elements['drive-problem-data'].value,'');assert.equal(h.elements['drive-problem-status'].textContent,'');assert.equal(h.elements['drive-problem-data'].hidden,true);
});

test('coast crash copy works independently of city-only crash textarea and manual fallback stays inside the crash',async()=>{
 const h=fixture({clipboard:()=>Promise.reject(Error('denied'))});h.elements['btn-copy-crash-problem'].fire('click');await settle();assert.match(h.elements['crash-problem-data'].value,/Map: coast/);assert.ok(h.elements['crash-problem-data'].selected);assert.equal(h.elements['drive-problem-data'].value,'');h.elements['btn-crash-respawn'].fire('click');assert.equal(h.elements['crash-problem-data'].value,'');
});

test('JSON save is an explicit local download; object URLs are revoked and no live references escape',()=>{
 const h=fixture();assert.equal(h.calls.downloads.length,0);h.elements['btn-save-drive-problem'].fire('click');assert.equal(h.calls.downloads.length,1);assert.equal(h.calls.downloads[0].download,'roadster-coast-problem.json');assert.equal(h.calls.blob.type,'application/json');const r=JSON.parse(h.calls.blob.parts[0]);assert.equal(r.map,'coast');h.state.x=123;assert.equal(r.pose.x,6);assert.equal(h.calls.revokes.length,0);h.calls.timers.forEach(f=>f());assert.deepEqual(h.calls.revokes,['blob:local-game']);
});

test('highway traffic summary uses relative display coordinates, not accumulated journey Z',()=>{
 const h=fixture({map:'highway'});h.state.z=-9000;h.c.trafficCars=[{mesh:{visible:true,position:{x:6,y:0,z:-40}}},{mesh:{visible:false,position:{x:6,y:0,z:-430}},highwayWaitingToSpawn:true},{mesh:{visible:true,position:{x:6,y:0,z:40}}}];const r=h.api.snapshot();assert.equal(r.traffic.aheadWithin480m,1);assert.equal(r.traffic.behindWithin480m,1);assert.equal(r.traffic.queued,1);assert.equal(r.traffic.positionsRelativeToPlayer,true);
});

test('native export observes finite actual visible-material triangles without mutating meshes or physical support',{skip:!nativeAvailable},()=>{
 const w=nativeWorld(),h=fixture({support:p=>w.coast.support(p),meshes:Object.fromEntries(w.meshes.map(m=>[m.name,m]))}),point=w.coast.network.sampleRoute(0,3800,0);Object.assign(h.state,{x:point.x,y:point.y,z:point.z,coastSupportId:'road-0'});const before=w.meshes.map(m=>({version:m.geometry.attributes.position.version,matrix:[...m.matrixWorld.elements],sphere:m.geometry.boundingSphere}));const r=h.api.snapshot();assert.equal(r.geometry.truncated,false);assert.ok(r.geometry.trianglesVisited>30000&&r.geometry.trianglesVisited<=65536);assert.ok(Math.abs(r.selectedSupportGeometryDelta)<1e-5);assert.ok(r.geometry.hits.some(t=>Math.abs(t.height-point.y)<1e-5));assert.match(r.geometry.method,/not GPU/);assert.deepEqual(w.meshes.map(m=>({version:m.geometry.attributes.position.version,matrix:[...m.matrixWorld.elements],sphere:m.geometry.boundingSphere})),before);
});

test('pose observer CPU overhead stays bounded with fixed storage, and direct game callbacks keep their return value',t=>{
 const h=fixture();const start=performance.now();for(let i=0;i<20000;i++)h.scene.onAfterRender();const elapsed=performance.now()-start;assert.equal(h.calls.support,0);assert.equal(h.api.stats().storedFrames,96);assert.equal(h.api.stats().bytes,9216);assert.ok(elapsed<2000,'CPU guard only, not device FPS');t.diagnostic(JSON.stringify({scope:'CPU-only bounded local pose sampling, not GPU/device FPS',frames:20000,totalMs:elapsed,msPerFrame:elapsed/20000,bytes:9216}));
});

test('problem tools stay folded inside settings or crash, have manual-copy semantics and no driving overlay',()=>{
 const html=readFileSync(new URL('../src/index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');assert.match(html,/<details id="drive-problem-tools" class="drive-problem-tools">/);assert.doesNotMatch(html,/<details id="drive-problem-tools"[^>]*\bopen\b/);assert.ok(html.indexOf('id="drive-problem-tools"')>html.indexOf('<dialog id="audio-settings"'));for(const id of['drive-problem-data','crash-problem-data']){assert.match(html,new RegExp('<textarea id="'+id+'" readonly hidden'));assert.match(css,/#drive-problem-data, #crash-problem-data/);}assert.match(css,/user-select: text/);
});


test('copy-then-save invalidates both late clipboard success and rejection without overwriting local JSON status',async()=>{
 for(const outcome of['resolve','reject']){let resolve,reject;const h=fixture({clipboard:()=>new Promise((a,b)=>{resolve=a;reject=b;})});h.elements['btn-copy-drive-problem'].fire('click');h.elements['btn-save-drive-problem'].fire('click');const status=h.elements['drive-problem-status'].textContent,json=h.elements['drive-problem-data'].value;assert.match(status,/JSON/);if(outcome==='resolve')resolve();else reject(Error('denied'));await settle();assert.equal(h.elements['drive-problem-status'].textContent,status,outcome);assert.equal(h.elements['drive-problem-data'].value,json,outcome);assert.notEqual(h.elements['drive-problem-data'].selected,true,outcome);}
});

test('crash report keyboard activation stays native instead of becoming a driving Space hotkey',()=>{
 const h=fixture(),ui=readFileSync(new URL('../src/ui-hud.js',import.meta.url),'utf8'),handler=ui.match(/window\.addEventListener\('keydown', \(e\) => \{[\s\S]+?\n\}\);/);assert.ok(handler);const keys=[];let globalKeydown;h.window.addEventListener=(k,fn)=>{if(k==='keydown')globalKeydown=fn;};h.c.Element=class{};h.c.setKeyState=(...args)=>keys.push(args);vm.runInContext(handler[0],h.c);assert.equal(typeof globalKeydown,'function');
 for(const code of['Space','Enter']){let stopped=false,prevented=false;const e=h.elements['btn-copy-crash-problem'].fire('keydown',{code,target:h.elements['btn-copy-crash-problem'],stopPropagation(){stopped=true;},preventDefault(){prevented=true;}});if(!stopped)globalKeydown(e);assert.equal(stopped,true,code);assert.equal(prevented,false,'retain native button activation');assert.deepEqual(keys,[]);}
 let stopped=false;h.elements['btn-copy-crash-problem'].fire('keydown',{code:'KeyW',stopPropagation(){stopped=true;}});assert.equal(stopped,false,'do not broaden this interface-only exception to driving controls');
});
