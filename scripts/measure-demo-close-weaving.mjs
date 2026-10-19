#!/usr/bin/env node
/** Read-only production demo metrics. Example:
 * REPO=/path/to/repo SEEDS=1,7,23 COUNTS=20,36,52 SECONDS=90 FPS=60 \
 * OUTPUT=/tmp/close-weaving.json node scripts/measure-demo-close-weaving.mjs
 * Defaults: seed 1, 20 cars, 12 seconds, 60 Hz. No stdout output.
 */
import vm from 'node:vm';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const repo = resolve(process.env.REPO || process.argv[2] || process.cwd());
const output = resolve(process.env.OUTPUT || 'demo-close-weaving.json');
const values = (name, fallback) => (process.env[name] || fallback).split(',').map(Number);
const seeds = values('SEEDS', process.env.SEED || '1');
const counts = values('COUNTS', process.env.COUNT || '20');
const seconds = Number(process.env.SECONDS || 12);
const fps = Number(process.env.FPS || 60);
const closeGap = Number(process.env.CLOSE_FOLLOW_GAP || 12);
const briefLimit = Number(process.env.BRIEF_FOLLOW_SECONDS || 1.5);
const warmup = Number(process.env.WARMUP || 5);
if (!seeds.length || seeds.some(x => !Number.isInteger(x)) || !counts.length || counts.some(x => !Number.isInteger(x) || x < 0) || ![seconds, fps, closeGap, briefLimit].every(x => Number.isFinite(x) && x > 0) || !Number.isFinite(warmup) || warmup < 0) throw Error('Invalid SEEDS, COUNTS, SECONDS, FPS, WARMUP, or following thresholds');
const sourceNames = ['src/highway-demo.js', 'src/highway-traffic.js', 'src/physics-main.js', 'src/ui-hud.js', 'src/config.js', 'src/driving-score.js', 'tests/helpers/demo-harness.mjs', 'scripts/verify-demo.mjs'];
const sourceVersions = () => Object.fromEntries(sourceNames.map(name => [name, createHash('sha256').update(readFileSync(join(repo, name))).digest('hex')]));
const initialSourceVersions = sourceVersions();
const { simulation, lanes } = await import(pathToFileURL(join(repo, 'tests/helpers/demo-harness.mjs')).href);
const { pool } = await import(pathToFileURL(join(repo, 'scripts/verify-demo.mjs')).href);
const EPS = 1e-9, HALF_X = 1.85, PLAYER_HALF_Z = 2.15;
const round = x => Number.isFinite(x) ? +x.toFixed(6) : null;
const at = (a, b, t) => a + (b - a) * t;
const intersect = (a, b) => a && b && Math.min(a[1], b[1]) >= Math.max(a[0], b[0]) + EPS ? [Math.max(a[0], b[0]), Math.min(a[1], b[1])] : null;
function band(a, b, low, high) {
  if (Math.abs(b - a) < 1e-12) return a >= low && a <= high ? [0, 1] : null;
  let p = (low - a) / (b - a), q = (high - a) / (b - a);
  if (p > q) [p, q] = [q, p];
  return intersect([0, 1], [p, q]);
}
function merge(intervals) {
  const sorted = intervals.filter(Boolean).sort((a, b) => a[0] - b[0]), result = [];
  for (const interval of sorted) {
    const last = result.at(-1);
    if (last && interval[0] <= last[1] + EPS) last[1] = Math.max(last[1], interval[1]);
    else result.push([...interval]);
  }
  return result;
}
function complement(intervals) {
  let p = 0; const result = [];
  for (const [a, b] of merge(intervals)) { if (a > p + EPS) result.push([p, a]); p = Math.max(p, b); }
  if (p < 1 - EPS) result.push([p, 1]);
  return result;
}
const minAbs = (a, b, range) => {
  const lo = at(a, b, range[0]), hi = at(a, b, range[1]);
  return lo * hi <= 0 ? 0 : Math.min(Math.abs(lo), Math.abs(hi));
};
function weightedStats(samples) {
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a[0] - b[0]), total = sorted.reduce((n, p) => n + p[1], 0);
  const q = fraction => { let n = 0; for (const [value, weight] of sorted) { n += weight; if (n >= fraction * total - EPS) return round(value); } return round(sorted.at(-1)[0]); };
  return { min: round(sorted[0][0]), p10: q(.1), p50: q(.5), p90: q(.9), p95: q(.95), max: round(sorted.at(-1)[0]), mean: round(sorted.reduce((n, p) => n + p[0] * p[1], 0) / total), sampleSeconds: round(total) };
}
function unweightedStats(values) {
  const result = weightedStats(values.map(value => [value, 1]));
  if (!result) return null;
  delete result.sampleSeconds;
  return { ...result, observations: values.length };
}
function timeline() {
  const episodes = []; let total = 0;
  return {
    add(a, b) {
      if (!(b > a + EPS)) return;
      total += b - a;
      const last = episodes.at(-1);
      if (last && a <= last[1] + EPS) last[1] = Math.max(b, last[1]);
      else episodes.push([a, b]);
    },
    intervals(start, dt, intervals) { for (const [a, b] of merge(intervals)) this.add(start + a * dt, start + b * dt); },
    summary(duration, brief = Infinity) {
      const lengths = episodes.map(([a, b]) => b - a);
      const briefSeconds = lengths.filter(x => x <= brief + EPS).reduce((a, b) => a + b, 0);
      return { seconds: round(total), fractionOfRun: round(duration ? total / duration : 0), episodes: episodes.length, longestSeconds: round(Math.max(0, ...lengths)), durationSeconds: unweightedStats(lengths), briefSeconds: round(briefSeconds), briefFractionOfRun: round(duration ? briefSeconds / duration : 0) };
    }
  };
}
const snapshot = h => ({
  x: h.state.x, y: h.state.y, vx: h.state.vx || 0, vz: h.state.vz || 0, speed: h.state.speed || 0,
  cars: h.cars.map((c, index) => ({ index, x: c.mesh.position.x, z: c.mesh.position.z, y: c.y || 0,
    speed: c.speed || 0, vx: c.vx || 0, blastVz: c.blastVz || 0,
    height: c.height || 1.25, halfZ: (c.length || 4.62) / 2 + PLAYER_HALF_Z,
    live: c.mode === 'highway' && c.highwayWaitingToSpawn === undefined && c.mesh.visible !== false,
    passed: !!c.highwayPassedThisFrame, driverType: c.driverType || null }))
});
function measure(seed, count) {
  const h = simulation({ speed: 42, vz: -42, physicsMode: 'realistic' }, [], { seed });
  pool(h, count, seed);
  // Observe the uncorrected pose after the real motion/NPC update, immediately
  // before the unchanged real collision code. No inputs or state are altered.
  let beforeCollision;
  h.context.__closeWeavingGeometryProbe = () => { beforeCollision = snapshot(h); };
  const source = vm.runInContext('testStep.toString()', h.context);
  const marker = 'trafficCars.forEach(car=>{';
  if (source.split(marker).length !== 2) throw Error('Unsupported harness: cannot locate unique production collision loop');
  vm.runInContext(`testStep = (${source.replace(marker, '__closeWeavingGeometryProbe();\n' + marker)});`, h.context);
  let elapsed = 0, minGas = h.state.airRemaining, overtakes = 0, racerOvertakes = 0, airborneOvertakes = 0;
  let minFront = Infinity, minSide = Infinity, minFrontPlanar = Infinity, minSidePlanar = Infinity;
  let skippedDiscontinuities = 0, skippedInactive = 0, over220 = 0, airBoost = 0, airLift = 0;
  let previousTarget = h.stats().targetLane, change = null, lastHop = -Infinity, hopChain = 0, maxHopChain = 0;
  const changes = [], speeds = [], warmSpeeds = [], crossingSideGaps = [], air = timeline(), stripes = timeline(), closeFollow = timeline();
  const categories = { sideUnder0_5m: new Map(), bumperUnder2m: new Map(), union: new Map(), sweptBodyOverlap: new Map() };
  const encounterCounts = Object.fromEntries(Object.keys(categories).map(key => [key, 0]));
  const encounterSeconds = Object.fromEntries(Object.keys(categories).map(key => [key, 0]));
  let sameFrameOverlapWithoutRecordedImpact = 0;
  const addEncounter = (name, index, intervals, start, dt) => {
    for (const [a, b] of merge(intervals)) {
      const begin = start + a * dt, end = start + b * dt, last = categories[name].get(index);
      if (last === undefined || begin > last + EPS) encounterCounts[name]++;
      categories[name].set(index, end); encounterSeconds[name] += end - begin;
    }
  };
  while (elapsed < seconds - EPS && !h.state.isDestroyed) {
    const start = elapsed, dt = Math.min(1 / fps, seconds - elapsed), from = snapshot(h), impactsBefore = h.impacts.length;
    beforeCollision = null;
    const result = h.step(dt);
    if (!result || !beforeCollision) break;
    const to = beforeCollision;
    elapsed += dt;
    const speedKmh = h.state.speed * 3.6;
    speeds.push([speedKmh, dt]);
    if (elapsed > warmup) warmSpeeds.push([speedKmh, Math.min(dt, elapsed - warmup)]);
    if (speedKmh >= 220) over220 += dt;
    minGas = Math.min(minGas, h.state.airRemaining);
    if (result.frame.jump) { hopChain = start - lastHop < 2 ? hopChain + 1 : 1; maxHopChain = Math.max(maxHopChain, hopChain); lastHop = start; }
    const airIntervals = band(from.y, to.y, .005, Infinity) ? [band(from.y, to.y, .005, Infinity)] : [];
    air.intervals(start, dt, airIntervals);
    if (result.isAirborne && result.isRearThrusterFiring) airBoost += dt;
    if (result.isAirborne && result.isLiftFiring) airLift += dt;
    stripes.intervals(start, dt, complement(lanes.map(x => band(from.x, to.x, x - .9, x + .9))));
    const target = result.frame.targetLane;
    if (target !== previousTarget) {
      if (change) changes.push({ ...change, outcome: 'retargeted', endedAtSeconds: round(start), durationSeconds: round(start - change.startedAtSeconds) });
      change = { fromLane: previousTarget, targetLane: target, startedAtSeconds: round(start), startX: round(from.x), settleSeconds: 0 };
      previousTarget = target;
    }
    if (change) {
      if (Math.abs(h.state.x - lanes[target]) < .32 && Math.abs(h.state.vx) < 1.3 && h.state.y <= .005) change.settleSeconds += dt;
      else change.settleSeconds = 0;
      if (change.settleSeconds >= .08 - EPS) {
        changes.push({ ...change, outcome: 'settled', endedAtSeconds: round(elapsed), durationSeconds: round(elapsed - change.startedAtSeconds) });
        change = null;
      }
    }
    const followingIntervals = []; let sweptOverlapThisFrame = false;
    for (let i = 0; i < to.cars.length; i++) {
      const a = from.cars[i], b = to.cars[i];
      // A respawn is hundreds of metres of discontinuous movement. The generous
      // velocity bound also catches rear-to-front recycling without passed=true.
      const maxTravel = 2 + dt * (Math.abs(from.vz) + Math.abs(to.vz) + a.speed + b.speed + Math.abs(a.blastVz) + Math.abs(b.blastVz)) * 1.65;
      if (!a.live || !b.live || b.passed || Math.abs(b.z - a.z) > maxTravel || Math.abs(b.x - a.x) > 2 + dt * 100) {
        if (!a.live || !b.live) skippedInactive++; else skippedDiscontinuities++;
        for (const map of Object.values(categories)) map.delete(i);
        continue;
      }
      const x0 = a.x - from.x, x1 = b.x - to.x, z0 = a.z, z1 = b.z, halfZ = Math.max(a.halfZ, b.halfZ);
      const lateral = band(x0, x1, -HALF_X, HALF_X), longitudinal = band(z0, z1, -halfZ, halfZ);
      const bodyHeight = band(from.y - a.height, to.y - b.height, -Infinity, -.15);
      const front = intersect(lateral, band(z0, z1, -Infinity, 0));
      if (front) {
        const value = -Math.max(at(z0, z1, front[0]), at(z0, z1, front[1])) - halfZ;
        minFrontPlanar = Math.min(minFrontPlanar, value);
        const valid = intersect(front, bodyHeight);
        if (valid) minFront = Math.min(minFront, -Math.max(at(z0, z1, valid[0]), at(z0, z1, valid[1])) - halfZ);
      }
      if (longitudinal) {
        minSidePlanar = Math.min(minSidePlanar, minAbs(x0, x1, longitudinal) - HALF_X);
        const valid = intersect(longitudinal, bodyHeight);
        if (valid) minSide = Math.min(minSide, minAbs(x0, x1, valid) - HALF_X);
      }
      const side = intersect(intersect(longitudinal, band(x0, x1, -HALF_X - .5, HALF_X + .5)), bodyHeight);
      const bumper = intersect(intersect(lateral, band(z0, z1, -halfZ - 2, halfZ + 2)), bodyHeight);
      const overlap = intersect(intersect(lateral, longitudinal), bodyHeight);
      addEncounter('sideUnder0_5m', i, [side], start, dt);
      addEncounter('bumperUnder2m', i, [bumper], start, dt);
      addEncounter('union', i, [side, bumper], start, dt);
      addEncounter('sweptBodyOverlap', i, [overlap], start, dt);
      if (overlap) sweptOverlapThisFrame = true;
      const following = intersect(intersect(lateral, band(z0, z1, -halfZ - closeGap, -halfZ)), bodyHeight);
      if (following) followingIntervals.push(following);
      if (z0 < 0 && z1 >= 0 && z1 > z0) {
        overtakes++; if (b.driverType === 'racer') racerOvertakes++;
        const u = -z0 / (z1 - z0);
        if (at(from.y, to.y, u) > .005) airborneOvertakes++;
        if (at(from.y - a.height, to.y - b.height, u) < -.15) crossingSideGaps.push(Math.abs(at(x0, x1, u)) - HALF_X);
      }
    }
    if (sweptOverlapThisFrame && h.impacts.length === impactsBefore) sameFrameOverlapWithoutRecordedImpact++;
    closeFollow.intervals(start, dt, followingIntervals);
  }
  if (change) changes.push({ ...change, outcome: h.state.isDestroyed ? 'interrupted_by_crash' : 'incomplete_at_window_end', endedAtSeconds: round(elapsed), durationSeconds: round(elapsed - change.startedAtSeconds) });
  const settled = changes.filter(c => c.outcome === 'settled');
  const planner = { ...h.stats() };
  return {
    seed, count, fps, requestedSeconds: seconds, observedSeconds: round(elapsed), crashed: !!h.state.isDestroyed,
    impacts: h.impacts.length, maxImpactDeltaVMetresPerSecond: round(Math.max(0, ...h.impacts.map(v => Number(v[0]) || 0))),
    speedKmh: weightedStats(speeds), speedAfterWarmupKmh: weightedStats(warmSpeeds), above220Fraction: round(over220 / elapsed),
    planner, changes: { observedTargetChanges: changes.length, independentlySettled: settled.length,
      settleDefinition: 'Target changes until grounded within 0.32m of its center and |vx| < 1.3m/s for >= 0.08s',
      settledDurationSeconds: unweightedStats(settled.map(c => c.durationSeconds)), events: changes.map(({ settleSeconds, ...event }) => event) },
    overtakes: { actualZCrossings: overtakes, perMinute: round(overtakes * 60 / elapsed), racerCrossings: racerOvertakes, airborneCrossings: airborneOvertakes,
      bodyHeightCrossings: crossingSideGaps.length, sideGapAtBodyHeightCrossingMetres: unweightedStats(crossingSideGaps),
      sideGapUnder0_5mCrossings: crossingSideGaps.filter(gap => gap >= 0 && gap < .5).length, bodyOverlapCrossings: crossingSideGaps.filter(gap => gap < 0).length },
    clearanceMetres: { nearestFrontBumperWhileLateralOverlap: round(minFront), minSideWhileLongitudinalOverlap: round(minSide),
      planarAllHeights: { nearestFrontBumperWhileLateralOverlap: round(minFrontPlanar), minSideWhileLongitudinalOverlap: round(minSidePlanar) } },
    nearEncounters: { counts: encounterCounts, pairSeconds: Object.fromEntries(Object.entries(encounterSeconds).map(([key, value]) => [key, round(value)])),
      sweptBodyOverlapFramesWithoutNewImpact: sameFrameOverlapWithoutRecordedImpact },
    closeFollowing: { bumperGapThresholdMetres: closeGap, briefLimitSeconds: briefLimit, ...closeFollow.summary(elapsed, briefLimit) },
    maxStripeSeconds: stripes.summary(elapsed).longestSeconds,
    air: { ...air.summary(elapsed), hops: h.launches.length, plannerJumps: planner.jumps, longestHopChainWithin2Seconds: maxHopChain,
      rearJetSeconds: round(airBoost), liftSeconds: round(airLift), minTankSeconds: round(minGas) },
    geometrySegmentsExcluded: { respawnOrDiscontinuity: skippedDiscontinuities, inactiveOrHidden: skippedInactive }
  };
}
let commit = null;
try { commit = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
const report = {
  schemaVersion: 1, generatedAt: new Date().toISOString(), repo, commit, initialSourceVersions,
  controllerSha256: initialSourceVersions['src/highway-demo.js'], physicsSha256: initialSourceVersions['src/physics-main.js'],
  settings: { seeds, counts, fps, seconds, warmupSeconds: warmup },
  methodology: {
    simulation: 'Current repository production planner, motion, NPC traffic, jump, tank, and collision code through its imported harness and seeded pool. Starts at 42m/s, realistic mode. Stops at destruction.',
    geometry: 'Exact extrema/interval clipping of the continuous piecewise-linear relative AABB sweep between each step start and the uncorrected pre-collision endpoint. This is a read-only measurement probe; production collision checks and response are unchanged. Curved within-step paths are approximated by their linear chord.',
    envelopes: 'Matches production traffic contact envelope: |relative x| < 1.85m; |relative z| < NPC length/2 + 2.15m; body-height filter player y - NPC height < -0.15m. Signed gaps below zero denote overlap. All-height planar minima are also supplied.',
    encounters: 'Each category counts contiguous per-car threshold episodes, not frames. Side: side gap < 0.5m with longitudinal overlap. Bumper: front or rear gap < 2m with lateral overlap. Union deduplicates category overlap. Threshold episodes include penetrations; do not interpret them as collision-free passes. pairSeconds sums across cars.',
    overtakes: 'Only actual negative-to-nonnegative relative-z crossings on continuous visible live-car motion segments. Respawn/hidden segments and collision response jumps are excluded. No lane-nearness requirement.',
    following: 'Time with an ahead bumper gap from 0 up to the configured close-follow gap, lateral overlap, and body-height overlap. Union across cars; brief episodes are <= configured brief duration.',
    stripe: 'Continuous time more than 0.9m from every lane center, including airborne frames.',
    caveat: 'CPU production-harness measurement is not browser/WebGL, visual, frame-rate, or real-device validation. Swept overlap without a new impact can reflect discrete collision sampling or impact cooldown; it is not alone proof of a production collision bug.'
  },
  runs: []
};
for (const count of counts) for (const seed of seeds) {
  const atStart = sourceVersions();
  const run = measure(seed, count);
  const atEnd = sourceVersions();
  run.sourceFilesStable = JSON.stringify(initialSourceVersions) === JSON.stringify(atStart) && JSON.stringify(atStart) === JSON.stringify(atEnd);
  run.validity = run.sourceFilesStable ? 'valid' : 'invalid';
  report.runs.push(run);
}
report.finalSourceVersions = sourceVersions();
report.sourceFilesStable = JSON.stringify(initialSourceVersions) === JSON.stringify(report.finalSourceVersions) && report.runs.every(run => run.sourceFilesStable);
report.validity = report.sourceFilesStable ? 'valid' : 'invalid';
if (!report.sourceFilesStable) report.warning = 'Source files changed during this measurement process; cached harness physics and later planner reads may differ. Re-run with a stable working tree.';
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
