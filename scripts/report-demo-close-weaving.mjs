import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const dir='verification/demo-close-weaving/';
const read=p=>readFileSync(p,'utf8');
const before=JSON.parse(read(dir+'before.json')),after=JSON.parse(read(dir+'final.json'));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
for(const report of[before,after]){
  assert.equal(report.validity,'valid');assert.equal(report.sourceFilesStable,true);assert.equal(report.runs.length,9);
  assert.equal(new Set(report.runs.map(r=>`${r.count}/${r.seed}`)).size,9);
  for(const r of report.runs){assert.equal(r.validity,'valid');assert.equal(r.fps,60);assert.equal(r.requestedSeconds,90);}
}
assert.equal(after.controllerSha256,hash('src/highway-demo.js'));
assert.equal(after.physicsSha256,hash('src/physics-main.js'));
assert.match(read(dir+'node-tests.txt'),/ℹ tests 474\n[\s\S]*ℹ pass 474\nℹ fail 0/);
assert.match(read(dir+'lua-tests.txt'),/Ran 24 tests[\s\S]*\bOK\b/);
assert.match(read(dir+'check.txt'),/passed/);assert.match(read(dir+'build.txt'),/Static game copied/);
const sum=(r,f)=>r.reduce((n,x)=>n+f(x),0),mean=(r,f)=>sum(r,f)/r.length;
const round=x=>Number.isFinite(x)?+x.toFixed(3):null;
const range=(r,f,digits=2)=>`${Math.min(...r.map(f)).toFixed(digits)}–${Math.max(...r.map(f)).toFixed(digits)}`;
const aggregate=rows=>({cases:rows.length,seconds:round(sum(rows,r=>r.observedSeconds)),crashes:sum(rows,r=>Number(r.crashed)),impacts:sum(rows,r=>r.impacts),sweptBodyOverlapEpisodes:sum(rows,r=>r.nearEncounters.counts.sweptBodyOverlap),
  meanRunMedianKmh:round(mean(rows,r=>r.speedAfterWarmupKmh.p50)),medianKmhRange:range(rows,r=>r.speedAfterWarmupKmh.p50,1),
  completedChanges:sum(rows,r=>r.planner.completed),changesPerMinute:round(sum(rows,r=>r.planner.completed)*60/sum(rows,r=>r.observedSeconds)),
  completedChangeMedianSecondsRange:range(rows,r=>r.changes.settledDurationSeconds.p50,3),
  actualOvertakes:sum(rows,r=>r.overtakes.actualZCrossings),overtakesPerMinute:round(sum(rows,r=>r.overtakes.actualZCrossings)*60/sum(rows,r=>r.observedSeconds)),
  nearEncounters:sum(rows,r=>r.nearEncounters.counts.union),sideUnder0_5mEpisodes:sum(rows,r=>r.nearEncounters.counts.sideUnder0_5m),bumperUnder2mEpisodes:sum(rows,r=>r.nearEncounters.counts.bumperUnder2m),
  closestFrontBumperMetres:round(Math.min(...rows.map(r=>r.clearanceMetres.nearestFrontBumperWhileLateralOverlap))),closestSideMetres:round(Math.min(...rows.map(r=>r.clearanceMetres.minSideWhileLongitudinalOverlap))),
  maxStripeSeconds:round(Math.max(...rows.map(r=>r.maxStripeSeconds))),hops:sum(rows,r=>r.air.hops),airFraction:round(sum(rows,r=>r.air.seconds)/sum(rows,r=>r.observedSeconds)),
  airborneRearJetSeconds:round(sum(rows,r=>r.air.rearJetSeconds)),minTankSeconds:round(Math.min(...rows.map(r=>r.air.minTankSeconds)))});
const groups=[20,36,52].map(count=>({count,before:aggregate(before.runs.filter(r=>r.count===count)),after:aggregate(after.runs.filter(r=>r.count===count))}));
const summary={date:'2026-10-19',baselineMain:'aa3cf0883fa78cbd4cf589b86c8740a266ebf8a7',baselineTree:'84b74e4c2d23244eb20d6a89837181cdfbffd975',controllerSha256:hash('src/highway-demo.js'),physicsSha256:hash('src/physics-main.js'),bundleSha256:hash('index.html'),nodeTests:474,luaTests:24,settings:after.settings,groups,before:aggregate(before.runs),after:aggregate(after.runs),browser:{executed:false,reason:'CPU production harness and motion diagram only; no new WebGL/browser/device claim.'}};
writeFileSync(dir+'summary.json',JSON.stringify(summary,null,2)+'\n');
const table=groups.map(g=>`| ${g.count} | ${g.before.meanRunMedianKmh} → ${g.after.meanRunMedianKmh} | ${g.before.changesPerMinute} → ${g.after.changesPerMinute} | ${g.before.overtakesPerMinute} → ${g.after.overtakesPerMinute} | ${g.before.nearEncounters} → ${g.after.nearEncounters} | ${g.after.closestFrontBumperMetres} / ${g.after.closestSideMetres} |`).join('\n');
const rows=after.runs.map(r=>`| ${r.count} | ${r.seed} | ${r.observedSeconds} | ${r.speedAfterWarmupKmh.p50.toFixed(1)} | ${r.planner.completed} | ${r.changes.settledDurationSeconds.p50.toFixed(3)} | ${r.overtakes.perMinute.toFixed(1)} | ${r.nearEncounters.counts.union} | ${r.impacts} / ${Number(r.crashed)} | ${r.air.hops} / ${(100*r.air.fractionOfRun).toFixed(2)}% |`).join('\n');
writeFileSync(dir+'README.md',`# Close-weaving demo verification

Date: 2026-10-19. Baseline main: \`${summary.baselineMain}\`, tree \`${summary.baselineTree}\` (the original local 6dc8336 checkout has exactly that tree). Final controller: \`${summary.controllerSha256}\`. Physics: \`${summary.physicsSha256}\`.

## Checks

- **474/474 Node tests, 24/24 Lua tests passed.** JavaScript syntax, deterministic bundle, unique DOM IDs and static build passed. The npm wrapper attempted a blocked npm-registry request; the identical local check/build entrypoints were run directly with Node, without accessing that service.
- [Independent review](independent-review.json): 50,000 randomized continuous-box sweeps matched an independent interval implementation; 4,800 actual manual frames across 40 highway/city, ground/air, Realistic/Fantasy and control cases matched the prior production physics bit for bit. Both demo ownership flags are disabled; 9,600 per-frame input checks verify the actual keyboard throttle, steering, brake, boost and handbrake values in both versions. This corrected audit replaces the earlier neutral-input-only evidence. A deliberately constructed between-frame corner hit caused ordinary demo damage/destruction, proving contact is not disabled.
- Focused tests cover complete 30/60/144/irregular-Hz changes, bounded per-frame lateral movement, no stripe camping, a fast approaching rear car, full-wall following/braking, real gas, collision failure and lifecycle/ranked isolation. Fuel, propulsion, NPC behavior and leaderboard rules are unchanged.

## Paired measurements

Seeds 1/7/23 × 20/36/52 traffic cars, 60 Hz, 90-second requested observations. Identical seeded production traffic and starting 42 m/s. Runs stop on destruction; short rows are explicitly listed. Both reports record matching unchanged source hashes. Only the frozen final candidate is summarized; exploratory variants are excluded.

Speed is the mean of each run's post-five-second median, not a pooled percentile. Changes and overtakes are normalized by actual observed time. Overtakes are all genuine continuous negative-to-positive relative-z crossings, including cars in other lanes; they are not all near passes. Near encounters are contiguous per-car episodes with either <0.5 m side clearance while longitudinal envelopes overlap, or <2 m bumper clearance while lateral envelopes overlap. Episodes may include a collision, which is separately reported. Gaps are signed against the existing collision envelope, not render-mesh distance.

| Cars | Mean run median km/h, before → after | Completed changes/min, before → after | True z-crosses/min, before → after | Near episodes, before → after | After closest front / side m |
| --- | --- | --- | --- | --- | --- |
${table}

| Cars | Seed | Observed s | Speed P50 km/h | Complete changes | Median change s | True z-crosses/min | Near episodes | Impacts / crashes | Hops / air % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows}

Overall after: **${summary.after.impacts} impacts, ${summary.after.crashes} crashes, ${summary.after.sweptBodyOverlapEpisodes} swept-body-overlap episodes**, ${summary.after.hops} real paid hops, ${(100*summary.after.airFraction).toFixed(2)}% airborne time and ${summary.after.airborneRearJetSeconds}s airborne rear jets. Longest continuous >0.9 m off-center interval: ${summary.after.maxStripeSeconds}s. Close clearances and higher speed are deliberate exhibition behavior; finite runs do not establish collision-free driving for arbitrary traffic.

The demo uses a real continuously integrated quick steering response only while active and grounded on the highway. Whole centers remain the targets. The 2.4-second route evaluation and 0.55-second near-threat trigger use roughly 1–1.5 m steady following clearance, narrow positive predictive margins and a bounded reward for multi-stage routes only when they materially advance beyond staying. The actual contact envelope is not reduced. Prediction and actual demo collision detection both include continuous relative-box sweeps between samples/frames, with respawn jumps excluded.

## Motion diagram and browser limit

[CPU motion diagram](demo-lane-change-motion.png), [SVG](demo-lane-change-motion.svg), [actual trace and hashes](demo-lane-change-motion.json): one 0.533-second complete center-to-center maneuver from seed7/count36. It is labelled CPU production simulation, not WebGL, and shows a safe complete lateral transition rather than claiming the shown first maneuver is a near scrape. Nearest-ahead gap can jump when a leader leaves the lateral overlap envelope.

No new real WebGL, visual FPS, device hit-testing or local-browser validation was performed. The prior verified cloud Chromium restriction remains documented in the [earlier release report](../highway-demo/README.md); no restriction or denied local DevTools route was bypassed.

## Reproduction

- \`node --test --test-concurrency=2 tests/*.test.mjs\`
- \`python3 tests/lua_runtime.py\`
- \`node scripts/check.mjs && node scripts/build.mjs\`
- \`REPO=/path/to/baseline SEEDS=1,7,23 COUNTS=20,36,52 SECONDS=90 FPS=60 CLOSE_FOLLOW_GAP=2 OUTPUT=verification/demo-close-weaving/before.json node scripts/measure-demo-close-weaving.mjs\`
- Repeat with \`REPO=$PWD\` and \`OUTPUT=verification/demo-close-weaving/final.json\`, then \`node scripts/report-demo-close-weaving.mjs\`.
- \`BEFORE_REPO=/path/to/baseline node scripts/review-demo-weaving-focused.mjs\`.
- \`node scripts/collect-demo-weaving-motion.mjs\` (optional Python matplotlib/numpy for rendering).
`);
console.log(JSON.stringify(summary,null,2));
