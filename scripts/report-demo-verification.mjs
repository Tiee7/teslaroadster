import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = 'verification/highway-demo/';
const read = name => readFileSync(root + name, 'utf8');
const json = name => JSON.parse(read(name));
const rows = json('production-simulation.json'), before = json('production-simulation-before-route-fix.json');
const boundaries = json('boundaries.json'), planning = json('planning-final.json');
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const rounded = value => +value.toFixed(3);
const range = (values, digits = 2) => `${Math.min(...values).toFixed(digits)}–${Math.max(...values).toFixed(digits)}`;
const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
assert.equal(rows.length, 36);
assert.equal(new Set(rows.map(r => `${r.seed}/${r.count}/${r.fps}`)).size, 36);
for (const row of rows) {
  assert.ok(row.seconds >= 90); assert.equal(row.crashed, false); assert.equal(row.impacts, 0);
  assert.equal(row.jumps, 0); assert.equal(row.airPct, 0); assert.equal(row.airBoostSeconds, 0);
  assert.ok(row.maxStripeSeconds < .8);
  assert.equal(row.started - row.completed, Number(row.changing), 'only a still-active end-of-window maneuver remains incomplete');
}
const groups = [20, 36, 52].map(count => {
  const r = rows.filter(x => x.count === count), b = before.filter(x => x.count === count);
  assert.equal(r.length, 12);
  return { count, cases: r.length, medianKmhRange: range(r.map(x => x.speedP50), 0),
    p10KmhRange: range(r.map(x => x.speedP10), 0), p90KmhRange: range(r.map(x => x.speedP90), 0),
    meanRunMedianKmh: rounded(mean(r.map(x => x.speedP50))),
    beforeMeanRunMedianKmh: rounded(mean(b.map(x => x.speedP50))),
    above220PctRange: range(r.map(x => x.above220Pct)), meanAbove220Pct: rounded(mean(r.map(x => x.above220Pct))),
    beforeMeanAbove220Pct: rounded(mean(b.map(x => x.above220Pct))),
    centerPctRange: range(r.map(x => x.centerPct)), longestOffCenterSeconds: Math.max(...r.map(x => x.maxStripeSeconds)),
    completedChanges: r.reduce((s, x) => s + x.completed, 0), ongoingAtWindowEnd: r.filter(x => x.changing).length,
    overtakes: r.reduce((s, x) => s + x.overtakes, 0), racerOvertakes: r.reduce((s, x) => s + x.racerOvertakes, 0),
    minimumGas: Math.min(...r.map(x => x.minGas)), impacts: 0, crashes: 0, jumps: 0, airbornePct: 0 };
});
const nodeTests = Number(read('node-tests-bounded.txt').match(/ℹ tests (\d+)/)?.[1]);
assert.equal(nodeTests, 465); assert.match(read('node-tests-bounded.txt'), /ℹ fail 0/);
assert.match(read('lua-tests.txt'), /Ran 24 tests/); assert.match(read('lua-tests.txt'), /\bOK\b/);
const summary = { date: '2026-10-19', baseCommit: '3adccafb9a1f62afd55543a0aa8637090642a9b2',
  controllerSha256: hash('src/highway-demo.js'), physicsSha256: hash('src/physics-main.js'), bundleSha256: hash('index.html'),
  nodeTests, luaTests: 24, matrixCases: rows.length, simulatedSeconds: rounded(rows.reduce((s, x) => s + x.seconds, 0)),
  speedWarmupSeconds: 5, centeredThresholdMetres: .6, offCenterIntervalThresholdMetres: .9,
  inputReaderNote: 'The final reader additionally owns pending preparation. Matrix adapter isActive/isBusy are both always true; the independently reviewed active paths are equivalent.',
  groups, boundaries, planning: planning.map(({ decisions, ...stats }) => stats), repeatedWallBoundary: json('jump-chain-boundary.json'),
  browser: { executed: false, probeExitCode: 134, reason: 'Cloud Chromium failed its data: probe: process_singleton_posix socket() Operation not permitted; crashpad database unavailable. No WebGL/device claim.' } };
writeFileSync(root + 'summary.json', JSON.stringify(summary, null, 2) + '\n');
const table = groups.map(g => `| ${g.count} | ${g.p10KmhRange} / ${g.medianKmhRange} / ${g.p90KmhRange} | ${g.above220PctRange} (${g.meanAbove220Pct.toFixed(2)}) | ${g.centerPctRange} | ${g.longestOffCenterSeconds.toFixed(3)} | ${g.completedChanges} + ${g.ongoingAtWindowEnd} ongoing | ${g.overtakes} / ${g.racerOvertakes} |`).join('\n');
const paired = planning.map(r => `| ${r.variant} | ${r.seed} | ${r.speedP50.toFixed(2)} | ${r.above220Pct.toFixed(2)} | ${r.usefulSafeRejectedInstants} | ${r.longestSkippedSpan.toFixed(3)} | ${r.overtakes} / ${r.racerOvertakes} |`).join('\n');
writeFileSync(root + 'README.md', `# Highway demo verification

Date: 2026-10-19. Base: \`${summary.baseCommit}\`. Controller SHA-256: \`${summary.controllerSha256}\`. Bundle SHA-256: \`${summary.bundleSha256}\`.

## Automated checks

- Full Node coverage: **${nodeTests}/${nodeTests} passed**, all test files, with concurrency bounded to 2. Lua: **24/24 passed**. Syntax, unique DOM IDs, deterministic bundling and static build passed.
- Independent whole-feature review: **42 focused cases passed**. See the [overall review](review-overall.md), [delta chronology](review-route-fix.md) and [captured output](review-route-fix.txt).
- An initial unbounded run had an obsolete 40-m-wall jump assertion and a test-file subprocess failure. The assertion was corrected to distinguish feasible braking from a genuinely close 20-m wall; isolated jet tests passed 9/9 and the complete final bounded suite passed. Earlier logs are retained rather than presented as successful runs.
- Final input ownership also covers pending ranked cancellation, including analog mobile sticks. The active matrix path is equivalent before/after this final pending-only reader extension, as independently checked in the review.

## Seeded production-logic simulation

36 cases: seeds 1/7/23 × 20/36/52 cars × 30/60/144/irregular frame intervals; each runs at least 90 seconds, for **${summary.simulatedSeconds} simulated seconds** total. The harness executes the production input, horizontal/vertical tank physics, highway drivers (including initialization/wrap/merge) and NPC collision code. DOM, media and rendering are stubbed. This is controlled CPU simulation, not a real browser end-to-end playthrough.

Speed percentiles and 220+ fractions exclude the first five seconds. P10/P50/P90 are run-level ranges, rounded to 1 km/h. The mean in the 220 column is the mean of 12 run fractions, not a pooled speed percentile. Centered means within 0.6 m of a lane center; the interval column measures consecutive time more than 0.9 m from every center, covering the normal crossing motion too.

| Cars | P10 / P50 / P90 km/h ranges | 220+ time range % (mean) | Centered time % | Longest off-center s | Completed changes | Genuine overtakes / racers |
| --- | --- | --- | --- | --- | --- | --- |
${table}

All 36 cases: **0 impacts, 0 crashes, 0 hops, 0% airborne time, 0 airborne forward-boost/lift time**. No maneuver was abandoned midway: the listed ongoing maneuvers were still running when the 90-second observation ended. Passing encounters require continuous negative-to-positive z crossing; hidden/waiting cars and respawn jumps are excluded. Re-encountering a pooled car later counts as another encounter.

These finite runs do not establish zero collision probability or optimal route selection. Dense traffic often remains far below 220. Temporary slowing is the approved safety fallback; the measurements must not be described as continuous 220+ performance. Some residual conservatism is algorithmic, not proven physically unavoidable.

## Route-choice audit and correction

The original three-stage reward penalty could reject a fully safe useful route for six seconds. Only the maneuver penalty (2→1) and minimum reward improvement (2→0.5) changed. Safety margins, trajectory, following headway, center dwell, gas and physics did not. The paired 45-second, 20-car audit records:

| Policy | Seed | P50 km/h | 220+ % | Useful-safe score rejections | Longest observed rejection span s | Overtakes / racers |
| --- | --- | --- | --- | --- | --- | --- |
${paired}

See [independent counterfactual evidence](diagnostic-review.md). Remaining tiny-gain rejections are hysteresis, not a claim that no safe lane exists. A uniform 7-second horizon and other in-memory alternatives were rejected after complete multi-seed comparisons, not chosen from isolated good seeds; see [7-second comparison](review-horizon-comparison.md). Six 160/170/180-km/h racer fixtures completed genuine passes in 2.967–6.683 seconds, with ordinary centered changes and no impacts/hops.

## Real acceleration, hop and failure boundaries

- Clear road, from rest at 30/60/144 Hz: first 220 in **1.604–1.633 s**, peak 370 km/h, stable post-warmup 220+ time 100%, minimum tank 7.705–7.719 s. Actual controls and paid jets accelerate the car; speed and HUD are not assigned.
- An 80-m wall induces real H/paid-retro following around 79 km/h, without hopping. Removing that fixture restores throttle on the next frame and 220+ in **1.028–1.033 s**.
- A sudden 20-m six-lane wall at 65 m/s with a full tank: one paid hop, peak 2.3 m, 0 impacts; overlapping-NPC vertical clearance **0.808–0.854 m**. Air time **0.868–0.967 s** includes the shared O action's brief **0.160–0.200 s** paid lift pulse. There is no airborne rear boost or repeated lift request. A 10-m fixture has a smaller minimum clearance of 0.429 m.
- 40 m at 144 Hz can instead produce a single roof-rebound episode lasting **1.993 s**, 33.22% of its six-second observation, peak 2.942 m and 0 rear boost. This is retained as an adverse boundary, not hidden in the normal-traffic average.
- Empty-tank 20/10-m walls actually destroy the vehicle in about 0.09–0.27 s; a 40-m empty-tank/144-Hz case has a nonfatal impact. Four full-width walls 30 m apart cause this controller to crash after one hop at about 0.63 s even with gas. These are observed controller failures, not proofs that every conceivable driving strategy is impossible.
- No refill, collision suppression, teleport, NPC-speed change or score-rule change is used. See [boundary rows](boundaries.json) and [repeated-wall boundary](jump-chain-boundary.json).

## UI/ranking and browser limit

Nineteen lifecycle cases cover the highway-only/no-shortcut switch, three HUD modes, keyboard/legacy/mobile ownership, preparation cancellation, reset/destruction/map/blur/hidden/pagehide, mobile overlays, exact server-end/late issuance races, no demo submission and a fresh manual challenge after exit. A completed manual snapshot stays immutable.

The native cloud Chromium failed even a data: probe with a process-singleton socket permission error (exit 134); [probe output](browser-probe-errors.txt) is retained. No security restriction was bypassed and no user computer was used. Rendered WebGL appearance, real-device hit testing and visual FPS remain unverified.

## Reproduction

Run the full suite with \`node --test --test-concurrency=2 tests/*.test.mjs\`, production matrix with \`node scripts/verify-demo.mjs\`, boundaries with \`node scripts/verify-demo-boundaries.mjs\`, and this summary/invariant check with \`node scripts/report-demo-verification.mjs\`. \`DEMO_DIAGNOSTIC_SET=final node scripts/diagnose-demo-planning.mjs\` compares the retained before-fix controller with the production source in memory. It does not alter physical rules or the application.
`);
console.log(`Validated ${rows.length} production-logic cases; ${nodeTests} Node + 24 Lua passed. Report: ${root}README.md`);
