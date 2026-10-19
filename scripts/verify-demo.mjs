import { simulation, car, lanes } from '../tests/helpers/demo-harness.mjs';
import vm from 'node:vm';
import { writeFileSync, mkdirSync } from 'node:fs';
export function seeded(seed) { return () => { seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296; }; }
export function pool(h,count,seed) {
  const random=seeded(seed);h.context.randomForDrivers=random;
  const drivers=vm.runInContext(`highwayTraffic.createDrivers(${count},randomForDrivers)`,h.context);
  for(let i=0;i<count;i++){
    const lane=i%6,z=-420+i/count*760+(random()*14-7),safeZ=Math.abs(z)<22&&Math.abs(lanes[lane]-h.state.x)<4?z-40:z;
    h.cars.push(car(lane,safeZ,drivers[i].desiredSpeed,{...drivers[i],laneChange:null,laneChangeCooldown:0,blockedTime:0}));
  }
}
export function measure(seed,count,fps,seconds=90,mode='realistic',options={}) {
  const h=simulation({speed:42,vz:-42,physicsMode:mode},[],{seed,...options});pool(h,count,seed);
  let elapsed=0,air=0,center=0,postWarm=0,over220=0,minGas=10,maxLine=0,lineTime=0,boost=0,throttleGround=0,ground=0,minSpeed=1000,airBoost=0,airLift=0,largestX=0,airStreak=0,maxAirStreak=0,lastJump=-10,jumpChain=0,maxJumpChain=0,overtakes=0,racerOvertakes=0; const speedBins=Array(700).fill(0);
  while(elapsed<seconds&&!h.state.isDestroyed){
    const dt=fps==='irregular'?[1/30,1/80,1/144,1/45,1/60][Math.floor(elapsed*97)%5]:1/fps;
    const previousZ=new Map(h.cars.map(c=>[c,c.mesh.position.z]));
    const frame=h.step(dt);elapsed+=dt;
    for(const c of h.cars)if(previousZ.get(c)<0&&c.mesh.position.z>=0&&c.mesh.position.z-previousZ.get(c)<20){overtakes++;if(c.driverType==='racer')racerOvertakes++;}
    const airborne=h.state.y>.005;
    airStreak=airborne?airStreak+dt:0;maxAirStreak=Math.max(maxAirStreak,airStreak);
    if(frame.frame.jump){jumpChain=elapsed-lastJump<2?jumpChain+1:1;maxJumpChain=Math.max(maxJumpChain,jumpChain);lastJump=elapsed;}
    if(airborne){air+=dt;if(frame.isAirborne&&frame.isRearThrusterFiring)airBoost+=dt;if(frame.isLiftFiring)airLift+=dt;}
    else {ground+=dt;if(frame.frame.input.throttle===1)throttleGround+=dt;}
    if(frame.isRearThrusterFiring)boost+=dt;
    const distance=Math.min(...lanes.map(x=>Math.abs(x-h.state.x)));
    if(distance<.6)center+=dt;
    if(distance>.9){lineTime+=dt;maxLine=Math.max(maxLine,lineTime);}else lineTime=0;
    if(elapsed>5){postWarm+=dt;speedBins[Math.max(0,Math.min(699,Math.round(h.state.speed*3.6)))]+=dt;if(h.state.speed*3.6>=220)over220+=dt;minSpeed=Math.min(minSpeed,h.state.speed*3.6);}
    minGas=Math.min(minGas,h.state.airRemaining);largestX=Math.max(largestX,Math.abs(h.state.x));
  }
  const percentile = p => {let w=0;for(let i=0;i<speedBins.length;i++){w+=speedBins[i];if(w>=postWarm*p)return i;}return null;};
  return {seed,count,fps,mode,seconds:+elapsed.toFixed(2),crashed:h.state.isDestroyed,impacts:h.impacts.length,...h.stats(),overtakes,racerOvertakes,centerPct:+(100*center/elapsed).toFixed(2),airPct:+(100*air/elapsed).toFixed(2),above220Pct:postWarm?+(100*over220/postWarm).toFixed(2):null,minSpeed:postWarm?+minSpeed.toFixed(2):null,speedP10:postWarm?percentile(.1):null,speedP50:postWarm?percentile(.5):null,speedP90:postWarm?percentile(.9):null,minGas:+minGas.toFixed(3),maxStripeSeconds:+maxLine.toFixed(3),boostPct:+(100*boost/elapsed).toFixed(2),groundThrottlePct:+(100*throttleGround/ground).toFixed(2),airBoostSeconds:airBoost,airLiftSeconds:+airLift.toFixed(3),largestX:+largestX.toFixed(3),longestAirSeconds:+maxAirStreak.toFixed(3),longestJumpChain:maxJumpChain};
}
if(process.argv[1]?.endsWith('/verify-demo.mjs')){
  const rows=[];
  for(const count of [20,36,52])for(const fps of [30,60,144,'irregular'])for(const seed of [1,7,23]){const row=measure(seed,count,fps,90);rows.push(row);console.log(JSON.stringify(row));}
  mkdirSync('verification/highway-demo',{recursive:true});writeFileSync('verification/highway-demo/production-simulation.json',JSON.stringify(rows,null,2)+'\n');
}
