// Shared browser/server scoring rules. Metres use the physical velocity behind
// the speedometer; WORLD_SPEED_SCALE is visual venue calibration, not mileage.
(() => {
  const version = 'distance-v2';
  const thresholds = Object.freeze([0, 180, 200, 240, 300, 350]);
  const multipliers = Object.freeze([1, 1.2, 1.3, 1.4, 1.6, 1.8]);
  const band = kmh => {
    for (let i = thresholds.length - 1; i > 0; i--) if (kmh >= thresholds[i] - 1e-9) return i;
    return 0;
  };
  const displayedSpeed = (state, airborne = state.wasAirborne) => airborne
    ? Math.hypot(state.speed, state.vy * 0.45) : Math.abs(state.speed);
  const points = meters => Math.max(0, Math.ceil(meters.reduce((sum, value, i) => sum + value * multipliers[i] / 10, 0) - 1e-9));
  function reset(state) {
    state.distanceMeters = 0;
    state.distanceBySpeed = thresholds.map(() => 0);
    state.score = 0;
  }
  // Split a linear velocity segment exactly at bonus boundaries. Never ceil a
  // frame or apply a later speed bonus retroactively to earlier metres.
  function segment(state, dt, start, end) {
    if (state.isDestroyed || !(dt > 0) || !Number.isFinite(dt)) return;
    if (!Array.isArray(state.distanceBySpeed)) reset(state);
    const values = [start.speed, end.speed, start.forward, end.forward, start.horizontal, end.horizontal];
    if (values.some(value => !Number.isFinite(value))) return;
    const cuts = [0, 1];
    const speedDelta = end.speed - start.speed;
    for (const threshold of thresholds.slice(1)) {
      const crossing = (threshold / 3.6 - start.speed) / speedDelta;
      if (crossing > 0 && crossing < 1) cuts.push(crossing);
    }
    const forwardDelta = end.forward - start.forward;
    const zero = -start.forward / forwardDelta;
    if (zero > 0 && zero < 1) cuts.push(zero);
    cuts.sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      const from = cuts[i - 1], to = cuts[i], middle = (from + to) / 2;
      // Reverse, pure lateral sliding, and vertical hovering earn no mileage.
      if (start.forward + forwardDelta * middle <= 1e-8) continue;
      const metres = Math.max(0, start.horizontal + (end.horizontal - start.horizontal) * middle) * (to - from) * dt;
      state.distanceBySpeed[band((start.speed + speedDelta * middle) * 3.6)] += metres;
      state.distanceMeters += metres;
    }
    state.score = points(state.distanceBySpeed);
  }
  function motion(state, map, airborne = state.wasAirborne) {
    return {
      speed: displayedSpeed(state, airborne),
      // Highway steering has a visual lateral assist. It must not add
      // mileage beyond the calibrated horizontal speed behind the HUD.
      horizontal: Math.min(Math.hypot(state.vx, state.vz), Math.abs(state.speed)),
      forward: map === 'highway' ? -state.vz : state.vx * -Math.sin(state.yaw) - state.vz * Math.cos(state.yaw)
    };
  }
  globalThis.RoadsterDrivingScore = Object.freeze({ version, thresholds, multipliers, band, points, reset, segment, motion, displayedSpeed });
})();
