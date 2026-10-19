import { simulation, lanes } from '../tests/helpers/demo-harness.mjs';
import { pool } from './verify-demo.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
// Retain a reproducible before/after scoring comparison after production moves
// on; every variant below is an in-memory input planner, never changed physics.
const source = readFileSync('verification/highway-demo/controller-before-route-fix.js', 'utf8').split('// UI/lifecycle adapter.')[0];
const variants = {
  baseline: text => text,
  usefulRoutes: text => text.replace('moves*2', 'moves*0.35').replace('stayScore+2', 'stayScore+0.25').replaceAll('metres*0.25', 'metres*0.6').replace('flow*0.25', 'flow*0.6'),
  usefulRoutesShortHeadway: text => variants.usefulRoutes(text).replace('v*scale*0.65', 'v*scale*0.40')
    .replace('Math.sqrt(leadSpeed*leadSpeed+2*24*gap/scale)', 'leadSpeed+Math.sqrt(2*24*gap/scale)')
};
const balanced = text => text.replace('moves*2', 'moves*1').replace('stayScore+2', 'stayScore+0.5');
const holding = text => text.replaceAll('settled >= 0.08', 'settled >= 0.24').replaceAll('dwell >= 0.08', 'dwell >= 0.24');
const monotonic = text => holding(balanced(text))
  .replace('trajectory([target],3.6,false)', 'trajectory([target],4.8,false)')
  .replace('currentThreat < 3.6', 'currentThreat < 4.8')
  .replace('trajectory([target],3.6)', 'trajectory([target],4.8)')
  .replace('stayCollision===Infinity?3.6:stayCollision', 'stayCollision===Infinity?4.8:stayCollision')
  .replace(/      function routeRoom\(first\) \{[\s\S]*?(?=      if \(!changing && dwell >=)/, `      function routeRoom(first) {
        let best={room:0,score:-Infinity,flow:0,route:[first]};
        const direction=Math.sign(first-target);
        for(let destination=first;destination>=0&&destination<lanes.length;destination+=direction){
          const route=[];
          for(let lane=first;direction*(lane-destination)<=0;lane+=direction)route.push(lane);
          const path=trajectory(route,4.8), collision=collisionTime(path);
          const room=collision===Infinity?4.8:collision, flow=path[path.length-1].metres;
          const score=room*100+flow*0.25-route.length;
          if(score>best.score)best={room,score,flow,route};
        }
        return best;
      }
`);
const selectedVariants = process.env.DEMO_DIAGNOSTIC_SET === 'balanced'
  ? { balanced, balancedHold: text => holding(balanced(text)), balancedHoldHeadway: text => holding(balanced(text)).replace('v*scale*0.65', 'v*scale*0.45') }
  : process.env.DEMO_DIAGNOSTIC_SET === 'boost'
    ? { balancedFullBoost: text => balanced(text).replace('250 / 3.6', '370 / 3.6'), balancedHoldFullBoost: text => holding(balanced(text)).replace('250 / 3.6', '370 / 3.6') }
    : process.env.DEMO_DIAGNOSTIC_SET === 'routes'
      ? { monotonic, monotonicFullBoost: text => monotonic(text).replace('250 / 3.6', '370 / 3.6') }
      : process.env.DEMO_DIAGNOSTIC_SET === 'final'
        ? { baseline: text => text, balanced: () => readFileSync('src/highway-demo.js','utf8').split('// UI/lifecycle adapter.')[0] }
      : variants;
const rows = [];
for (const [variant, transform] of Object.entries(selectedVariants)) for (const seed of [1, 7, 23]) {
  const decisions = [];
  const h = simulation({ speed: 42, vz: -42 }, [], { seed }); pool(h, 20, seed);
  h.context.reportDemoDecision = row => decisions.push({ ...row, time: h.context.demoTime });
  const instrumented = transform(source)
    .replace('const RoadsterHighwayDemoPlanner =', 'globalThis.diagnosticPlannerFactory =')
    .replace('.filter(o => o.room>=1.2 && o.score > stayScore+', '.map(o=>{ globalThis.reportDemoDecision({target,stayScore,stayMetres:stayPath[stayPath.length-1].metres,...o});return o; }).filter(o => o.room>=1.2 && o.score > stayScore+');
  vm.runInContext(instrumented, h.context);
  const planner = h.context.diagnosticPlannerFactory.create(lanes, 1.65);
  h.context.demoPlanner.step = planner.step;
  let elapsed = 0, center = 0, over220 = 0, stripe = 0, maxStripe = 0, passes = 0, racerPasses = 0, overtakes=0, racerOvertakes=0;
  const speeds = [];
  while (elapsed < 45 && !h.state.isDestroyed) {
    h.context.demoTime = elapsed;
    const decisionStart=decisions.length, before=new Map(h.cars.map(c=>[c,c.mesh.position.z]));
    h.step(1 / 60); elapsed += 1 / 60;
    for(let i=decisionStart;i<decisions.length;i++) decisions[i].tookAnyLane=planner.stats().targetLane!==decisions[i].target;
    const gap = Math.min(...lanes.map(x => Math.abs(h.state.x - x)));
    if (gap < .6) center += 1 / 60;
    stripe = gap > .9 ? stripe + 1 / 60 : 0; maxStripe = Math.max(maxStripe, stripe);
    for (const other of h.cars) if (other.highwayPassedThisFrame) { passes++; if (other.driverType === 'racer') racerPasses++; }
    for(const other of h.cars) if(before.get(other)<0&&other.mesh.position.z>=0&&other.mesh.position.z-before.get(other)<20){overtakes++;if(other.driverType==='racer')racerOvertakes++;}
    if (elapsed > 5) { speeds.push(h.state.speed * 3.6); if (h.state.speed * 3.6 >= 220) over220 += 1 / 60; }
  }
  speeds.sort((a, b) => a - b);
  const threshold = variant === 'baseline' ? 2 : variant.startsWith('useful') ? .25 : .5;
  const horizon = variant.startsWith('monotonic') ? 4.8 : 3.6;
  const safeRejected = decisions.filter(o => !o.tookAnyLane && o.room >= horizon && o.flow > o.stayMetres && o.score <= o.stayScore + threshold);
  const skippedTimes = [...new Set(safeRejected.map(o=>o.time))].sort((a,b)=>a-b);
  let first=0,previous=-2,longestSkippedSpan=0,skippedStart=null,skippedEnd=null;
  for(const time of skippedTimes){if(time-previous>.35)first=time;if(time-first>longestSkippedSpan){longestSkippedSpan=time-first;skippedStart=first;skippedEnd=time;}previous=time;}
  const row = { variant, seed, seconds: elapsed, impacts: h.impacts.length, crashed: h.state.isDestroyed,
    ...planner.stats(), jumps: h.launches.length, wraps:passes, racerWraps:racerPasses,overtakes,racerOvertakes,
    centerPct: 100 * center / elapsed, above220Pct: 100 * over220 / (elapsed - 5),
    speedP50: speeds[Math.floor(speeds.length * .5)], speedP90: speeds[Math.floor(speeds.length * .9)],
    maxStripe, usefulSafeRejectedInstants:skippedTimes.length,longestSkippedSpan,skippedStart,skippedEnd, decisions };
  rows.push(row); console.log(JSON.stringify({ ...row, decisions: decisions.length }));
}
writeFileSync(`verification/highway-demo/planning-${process.env.DEMO_DIAGNOSTIC_SET || 'comparison'}.json`, JSON.stringify(rows, null, 2) + '\n');
