import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fixture} from './helpers/reference-fixture.mjs';
const src=file=>readFileSync(new URL('../src/'+file,import.meta.url),'utf8');
test('combined scripts keep scoring/controller/NPC dependencies before consumers',()=>{
 const html=src('index.html'),scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
 for(const [before,after]of[['config.js','driving-score.js'],['driving-score.js','physics-main.js'],['highway-traffic.js','vehicles.js'],['npc-traffic-assets.js','reference-traffic.js'],['reference-traffic.js','physics-main.js']])assert.ok(scripts.indexOf(before)>=0&&scripts.indexOf(before)<scripts.indexOf(after),before+' before '+after);
 assert.match(src('physics-main.js'),/RoadsterTrafficAssets\?\.updateLods\(trafficCars, camera\.position\)/);
});
test('real NPC appearance randomness coexists with exact speed bands and stable driver identities',()=>{
 for(const [count,expected]of[[20,[2,8,6,4]],[36,[4,14,11,7]],[52,[5,21,16,10]]]){
  const f=fixture();let seed=20261019+count;f.context.Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
  vm.runInContext('const LANE_COUNT=6,LANE_CENTERS=[-12.5,-7.5,-2.5,2.5,7.5,12.5],CITY_ROAD_COORDS=[-900,-600,-300,0,300,600,900];this.populate=populateTraffic;this.cars=()=>trafficCars;this.controller=highwayTraffic;',f.context);
  f.context.state={x:30,y:0,z:0,vx:0,vz:-22,speed:22};
  f.context.populate(count);const cars=f.context.cars(),bands=[0,0,0,0],ranges=[[160,180],[70,80],[80,90],[90,120]],identities=cars.map(c=>({model:c.mesh.userData.trafficVariant,entry:c.mesh.userData.archiveEntry,speed:c.desiredSpeed,type:c.driverType,band:c.speedBand}));
  for(const car of cars){bands[car.speedBand]++;const [min,max]=ranges[car.speedBand];assert.ok(car.desiredSpeed*3.6>=min&&car.desiredSpeed*3.6<=max);}
  assert.deepEqual(bands,expected);
  const player={x:30,y:0,z:0,vx:0,vz:-22};
  for(let frame=0;frame<300;frame++){
   f.context.controller.step(cars,player,1/30,[-12.5,-7.5,-2.5,2.5,7.5,12.5],f.context.WORLD_SPEED_SCALE);f.window.RoadsterTrafficAssets.updateLods(cars,{x:0,y:2,z:0});
   for(const car of cars)if(car.highwayWaitingToSpawn!==undefined)assert.equal(car.mesh.visible,false);
   for(let a=0;a<cars.length;a++)for(let b=a+1;b<cars.length;b++){if(cars[a].highwayWaitingToSpawn!==undefined||cars[b].highwayWaitingToSpawn!==undefined)continue;assert.ok(Math.abs(cars[a].mesh.position.x-cars[b].mesh.position.x)>=1.85||Math.abs(cars[a].mesh.position.z-cars[b].mesh.position.z)>=4.62,`NPC overlap count${count} frame${frame} pair${a}/${b} ${JSON.stringify([cars[a],cars[b]].map(c=>({x:c.mesh.position.x,z:c.mesh.position.z,speed:c.speed,desiredSpeed:c.desiredSpeed,lane:c.laneIdx,change:c.laneChange,model:c.mesh.userData.trafficVariant})))}`);}
  }
  cars.forEach((car,i)=>assert.deepEqual({model:car.mesh.userData.trafficVariant,entry:car.mesh.userData.archiveEntry,speed:car.desiredSpeed,type:car.driverType,band:car.speedBand},identities[i]));
  assert.ok(cars.filter(car=>car.mesh.userData.trafficDetail==='near').length<=8);
 }
});
