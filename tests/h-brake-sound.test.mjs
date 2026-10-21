import test from'node:test';import assert from'node:assert/strict';import vm from'node:vm';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';import{motionHarness}from'./helpers/motion-harness.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),physics=read('src/physics-main.js'),before=read('tests/fixtures/quiet-h-brake-baseline/physics-main.js');
const slice=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)+a.length));
class Param{constructor(){this.value=0;}setTargetAtTime(v){this.value=v;}}
class Node{constructor(){this.gain=new Param();this.frequency=new Param();this.Q=new Param();}connect(){}start(){}stop(){}setPeriodicWave(){}}
class AudioContext{constructor(){this.sampleRate=8;this.currentTime=0;this.state='running';this.destination={};}createBuffer(){return{getChannelData:()=>new Float32Array(16)};}createGain(){return new Node();}createOscillator(){return new Node();}createBiquadFilter(){return new Node();}createBufferSource(){return new Node();}createWaveShaper(){return new Node();}createPeriodicWave(){return{};}}
function soundFor(h,frame,map,source=physics){
 const p=frame.audioState,front=p.isRetroBrakeFiring&&!p.retroUsesRearNozzles,context=vm.createContext({...p,state:h.state,window:{AudioContext},localStorage:{getItem:()=>null},citySoundFrame:null,coastSoundFrame:null,
  isFrontRetroFiring:front,rearActive:p.isRearThrusterFiring||(p.isRetroBrakeFiring&&p.retroUsesRearNozzles),tireScreechIntensity:0,
  cityOwnsDrivingSound:()=>map==='city',coastOwnsDrivingSound:()=>map==='coast',readDriveInput:()=>p.driveInput});
 vm.runInContext(read('src/audio.js')+'\nsound.init();globalThis.audio=sound;',context);
 const args=[],update=context.audio.update.bind(context.audio);context.audio.update=(...values)=>{args.push(values);update(...values);};
 vm.runInContext(slice(source,'  // Capture resolved thrust,','  // The physics, contact, scoring,')+slice(source,'  const anyAttitude =','  // Update Live Cockpit Center'),context);
 if(map!=='highway'){const title=map==='city'?'City':'Coast';vm.runInContext(slice(source,`function update${title}FrameSound(`,map==='city'?'function cityFrameActive(':'function coastFrameActive(')+`update${title}FrameSound(true);`,context);}
 assert.equal(args.length,1);return{args:args[0],gain:context.audio.thrusterGain.gain.value,voice:JSON.parse(JSON.stringify(context.audio.engineVoice)),engineGain:context.audio.engineGain.gain.value};
}
function motion(map,keys,{air=false,backward=false,speed=80,touch=false}={},source=physics){
 const h=motionHarness({x:map==='coast'?-68.25:map==='city'?6:2.5,z:map==='coast'?700:0,y:air?80:0,speed:backward?-speed:speed,vz:backward?speed:-speed,vy:0,wasAirborne:air},map,{'physics-main.js':source});
 if(map==='coast')vm.runInContext(read('src/coast-road-network.js')+'\n'+read('src/coast-map.js'),h.context);
 for(const key of keys)h.keys[key]=true;if(touch)h.context.window.RoadsterTouch={readInput:()=>({brake:1})};
 return h;
}
test('the six H-derived audio changes stay exact throughout the physical kernel; later render-only ownership is separate',()=>{
 let expected=before;expected=expected.replaceAll('thrust: isLiftFiring || rearActive || isFrontRetroFiring,','thrust: isLiftFiring || isRearThrusterFiring || (isRetroBrakeFiring && driveInput.reverse > 0),').replaceAll('&& canUseRCS) || isFrontRetroFiring,','&& canUseRCS) || (isFrontRetroFiring && driveInput.reverse > 0),').replace('    isLiftFiring || rearActive || isFrontRetroFiring,','    isLiftFiring || isRearThrusterFiring || (isRetroBrakeFiring && driveInput.reverse > 0),').replace('    anyAttitude || isFrontRetroFiring,','    anyAttitude || (isFrontRetroFiring && driveInput.reverse > 0),');assert.equal(physics.slice(0,physics.indexOf('// Scope the fixed clock')),expected.slice(0,expected.indexOf('// Scope the fixed clock')));
 const epoch=JSON.parse(read('verification/quiet-h-brake-20261021/source-epoch.json'));for(const[file,sha]of Object.entries(epoch.unchangedAudioSha256))assert.equal(createHash('sha256').update(read('src/'+file)).digest('hex'),sha);
});
for(const map of['highway','city','coast']){
 for(const air of[false,true])for(const backward of[false,true])test(`${map} ${air?'air':'ground'} ${backward?'backward':'forward'}: H keeps paid retro impulse but adds no jet/attitude sound`,()=>{
  const h=motion(map,['KeyH'],{air,backward}),frame=h.step(1/60),next=soundFor(h,frame,map),old=soundFor(h,frame,map,before);assert.ok(frame.isRetroBrakeFiring&&frame.retroImpulseSeconds>0&&frame.airConsumedThisFrame>0);assert.equal(next.gain,0);assert.equal(next.args[1],false);assert.equal(next.args[2],false);assert.ok(old.gain>=.24,'preserved pre-fix audible H witness');assert.deepEqual(next.voice,old.voice);assert.ok(next.engineGain>0,'normal moving V8 remains audible');
 });
 test(`${map}: touch foot brake and low-speed mechanical H remain quiet and functional`,()=>{for(const options of[{touch:true},{speed:20}]){const h=motion(map,options.touch?[]:['KeyH'],options),start=Math.abs(h.state.speed),frame=h.step(1/60),sound=soundFor(h,frame,map);assert.equal(sound.gain,0);assert.ok(Math.abs(h.state.speed)<start);}});
 for(const[other,air,expected]of[['Semicolon',false,.24],['Space',true,.24],['KeyW',true,.24],['KeyJ',true,.09],['KeyQ',true,.09],['KeyS',false,.33],['KeyW',false,0]])test(`${map}: H + ${other} retains only separately requested sound`,()=>{
  const h=motion(map,['KeyH',other],{air}),frame=h.step(1/60),sound=soundFor(h,frame,map);assert.ok(Math.abs(sound.gain-expected)<1e-12);assert.ok(sound.engineGain>0);if(other==='KeyW')assert.equal(sound.voice.load,1);
 });
 for(const keys of[['KeyH'],['KeyH','Semicolon'],['KeyH','Space'],['KeyH','KeyS'],['KeyS'],['Semicolon']])test(`${map}: ${keys.join('+')} numerical braking, gas and safety match previous production every tick`,()=>{
  const old=motion(map,keys,{air:keys.includes('Space')},before),next=motion(map,keys,{air:keys.includes('Space')});for(let i=0;i<180;i++){old.step(1/60);next.step(1/60);for(const[k,v]of Object.entries(old.state))if(typeof v==='number'||typeof v==='boolean')assert.ok(Object.is(next.state[k],v),`${k} tick${i}`);assert.deepEqual(next.impacts,old.impacts);}
 });
}
