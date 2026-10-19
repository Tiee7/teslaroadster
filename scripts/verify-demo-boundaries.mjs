import { simulation, car, lanes } from '../tests/helpers/demo-harness.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

// Adversarial fixtures, deliberately including cases the real controls cannot
// save. A recorded impact/fatality here is evidence of the boundary, not hidden
// by replacing collisions or replenishing the tank.
const rows = [];
const round = value => +value.toFixed(3);
for (const fps of [30, 60, 144]) {
  for (const distance of [80, 40, 20, 10]) for (const gas of [10, 0]) {
    const h = simulation({ speed: 65, vz: -65, airRemaining: gas }, lanes.map((_, i) => car(i, -distance, 22)));
    let elapsed = 0, air = 0, peak = 0, clearance = Infinity, minimumGas = 10, airBoost = 0, airLift = 0;
    let streak = 0, longestAir = 0, landed = false;
    while (elapsed < 6 && !h.state.isDestroyed) {
      const frame = h.step(1 / fps); elapsed += 1 / fps;
      peak = Math.max(peak, h.state.y);
      if (h.state.y > 0.005) { air += 1 / fps; streak += 1 / fps; } else streak = 0;
      longestAir = Math.max(longestAir, streak);
      if (frame.isAirborne && frame.isRearThrusterFiring) airBoost += 1 / fps;
      if (frame.isAirborne && frame.isLiftFiring) airLift += 1 / fps;
      for (const other of h.cars) {
        if (Math.abs(other.mesh.position.x - h.state.x) < 1.85 && Math.abs(other.mesh.position.z) < other.length / 2 + 2.15) {
          clearance = Math.min(clearance, h.state.y - other.height);
        }
      }
      minimumGas = Math.min(minimumGas, h.state.airRemaining);
      if (h.launches.length && h.state.y === 0) landed = true;
    }
    rows.push({ scenario: 'sudden-six-lane-wall', fps, distance, initialGas: gas, seconds: round(elapsed),
      impacts: h.impacts.length, crashed: h.state.isDestroyed, jumps: h.launches.length,
      airPct: round(100 * air / elapsed), longestAirSeconds: round(longestAir), peakY: round(peak),
      minimumOverlappingCarClearance: clearance === Infinity ? null : round(clearance),
      minimumGas: round(minimumGas), airborneRearBoostSeconds: round(airBoost), airborneLiftSeconds: round(airLift), landed,
      finalSpeedKmh: round(h.state.speed * 3.6) });
  }
  const clear = simulation();
  let elapsed = 0, stable = 0, over220 = 0, peak = 0, minGas = 10, first220 = null;
  const speeds = [];
  while (elapsed < 30) {
    clear.step(1 / fps); elapsed += 1 / fps;
    const kmh = clear.state.speed * 3.6;
    if (kmh >= 220 && first220 === null) first220 = elapsed;
    peak = Math.max(peak, kmh); minGas = Math.min(minGas, clear.state.airRemaining);
    if (elapsed > 5) { stable += 1 / fps; speeds.push(kmh); if (kmh >= 220) over220 += 1 / fps; }
  }
  speeds.sort((a, b) => a - b);
  const percentile = p => round(speeds[Math.floor((speeds.length - 1) * p)]);
  rows.push({ scenario: 'clear-road-from-rest', fps, first220Seconds: round(first220), peakKmh: round(peak),
    stableAbove220Pct: round(100 * over220 / stable), stableP10: percentile(.1), stableP50: percentile(.5),
    stableP90: percentile(.9), minimumGas: round(minGas), impacts: clear.impacts.length,
    crashed: clear.state.isDestroyed, jumps: clear.launches.length });

  const recovery = simulation({ speed: 65, vz: -65 }, lanes.map((_, i) => car(i, -80, 22)));
  for (let i = 0; i < 4 * fps; i++) recovery.step(1 / fps);
  const followedKmh = recovery.state.speed * 3.6;
  // Scenario event: the wall clears. This does not alter the actual controller.
  recovery.cars.length = 0;
  let recovered = null, air = 0;
  for (let i = 0; i < 6 * fps; i++) {
    recovery.step(1 / fps);
    if (recovery.state.speed * 3.6 >= 220 && recovered === null) recovered = (i + 1) / fps;
    if (recovery.state.y > .005) air += 1 / fps;
  }
  rows.push({ scenario: 'congestion-clears', fps, followedKmh: round(followedKmh),
    recovered220Seconds: recovered === null ? null : round(recovered), finalKmh: round(recovery.state.speed * 3.6),
    airSeconds: round(air), impacts: recovery.impacts.length, crashed: recovery.state.isDestroyed, jumps: recovery.launches.length });
}
mkdirSync('verification/highway-demo', { recursive: true });
writeFileSync('verification/highway-demo/boundaries.json', JSON.stringify(rows, null, 2) + '\n');
for (const row of rows) console.log(JSON.stringify(row));
