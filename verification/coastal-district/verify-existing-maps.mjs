// Paired, fixed-input regression against the exact preceding production tree.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {motionHarness} from '../../tests/helpers/motion-harness.mjs';
import {CONTROL_PHYSICS_KEYS} from '../demo-continuous/generate-numeric-projection-kernel.mjs';
const baseline='9ac7c1f47e76b498f775f8cf08f620b8d0087d87';
const production='20d0d2cf237595df3d9060faf2f4a6a95a618928';
const tree=execFileSync('git',['show','-s','--format=%T',baseline],{encoding:'utf8'}).trim();
assert.equal(tree,'647d6b797cf31afa3884906fe70a776e777a3d9a');
const sources=Object.fromEntries(['config.js','physics-main.js','driving-score.js'].map(n=>[n,execFileSync('git',['show',`${baseline}:src/${n}`],{encoding:'utf8',maxBuffer:16*1024*1024})]));
let frames=0,comparisons=0;const rows=[];
for(const map of ['highway','city'])for(const physicsMode of ['realistic','plaid','fantasy'])for(const infiniteJet of [false,true])for(const timing of ['30','60','144','irregular'])for(const airborne of [false,true]){
 const state={x:map==='highway'?2.5:200,z:100,speed:65,vz:-65,y:airborne?80:0,vy:airborne?-3:0,wasAirborne:airborne,airRemaining:.9,airUsedContinuous:9.1,physicsMode:physicsMode==='plaid'?'realistic':physicsMode,insaneMode:physicsMode==='plaid',infiniteJet};
 const old=motionHarness(state,map,sources),now=motionHarness(state,map);
 for(let i=0;i<180;i++){
  const keys={KeyW:i<130,Semicolon:i<45||i>100&&i<120,KeyA:i>20&&i<32,KeyD:i>65&&i<73,KeyH:i>140,Space:airborne&&i<25,ShiftLeft:airborne&&i>75&&i<95,KeyQ:airborne&&i>35&&i<43,KeyL:airborne&&i>115&&i<122};
  Object.assign(old.keys,keys);Object.assign(now.keys,keys);
  const dt=timing==='irregular'?[1/144,1/30,.05,1/60][i%4]:1/Number(timing);
  const a=old.step(dt),b=now.step(dt);
  for(const key of CONTROL_PHYSICS_KEYS){assert.ok(Object.is(old.state[key],now.state[key]),`${map}/${physicsMode}/${infiniteJet}/${timing}/${airborne}/${i}/${key}: ${old.state[key]} != ${now.state[key]}`);comparisons++;}
  assert.deepEqual(structuredClone(b),structuredClone(a));
  assert.deepEqual(structuredClone(now.alerts),structuredClone(old.alerts));assert.deepEqual(structuredClone(now.impacts),structuredClone(old.impacts));frames++;
 }
 rows.push({map,physicsMode,infiniteJet,timing,airborne,steps:180,exact:true});
}
const result={passed:true,baselineLocalReview:baseline,baselineProductionCommit:production,baselineProductionTree:tree,cases:rows.length,physicalSteps:frames,objectIsPhysicalComparisons:comparisons,fields:CONTROL_PHYSICS_KEYS.length,rows,boundary:'Actual production movement/attitude/tank/alarm blocks under identical fixed input. No renderer/full-page RNG, old-city NPC or collision-free autopilot acceptance.'};
writeFileSync('verification/coastal-district/existing-map-equivalence.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,rows:undefined}));
