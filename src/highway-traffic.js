// Highway-only traffic. Speeds belong to drivers; lane changes need a slower
// leader and a safe, useful adjacent gap. Plan from one snapshot so an earlier
// array entry cannot cut into a later car's already-reserved merge.
const highwayTraffic = (() => {
  const MIN_GAP = 7;
  const SPEED_ADVANTAGE = 0.6;
  const MERGE_SECONDS = 2.6;
  const COOLDOWN_SECONDS = 3.0;
  const MAX_BRAKE = 8.5;
  // A car between lane centers can intersect either lane's swept merge path.
  const FOOTPRINT_RADIUS = 4.35; // half a 5 m lane plus the collision envelope
  const footprint = (x, lanes) => lanes.flatMap((center, i) => Math.abs(center - x) <= FOOTPRINT_RADIUS ? [i] : []);
  const blastSpeed = (car, player, scale) => -player.vz - (-player.vz - car.speed + (car.blastVz || 0)) / scale;
  function blastSafetyBounds(car, player, scale) {
    const current = blastSpeed(car, player, scale);
    const settled = -player.vz - (-player.vz - car.speed) / scale;
    // Ground bounces damp blastVz toward zero; expiry restores normal traffic.
    return {
      frontSafetySpeed: Math.min(current, settled, car.speed),
      rearSafetySpeed: Math.max(current, settled, car.desiredSpeed || car.speed)
    };
  }
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const closestLane = (x, lanes) => lanes.reduce((best, center, i) => Math.abs(center - x) < Math.abs(lanes[best] - x) ? i : best, 0);
  const racerProfile = Object.freeze({ merge: 1.85, cooldown: 1.35, reaction: 0.12, advantage: 0.35, headway: 0.68, acceleration: 3.2 });
  const cruiseProfile = Object.freeze({ merge: MERGE_SECONDS, cooldown: COOLDOWN_SECONDS, reaction: 0.24, advantage: SPEED_ADVANTAGE, headway: 0.95, acceleration: 2.1 });
  const profile = car => car?.driverType === 'racer' ? racerProfile : cruiseProfile;
  function createDrivers(count, random = Math.random) {
    const bands = [{ type: 'racer', share: 0.1, min: 160, max: 180 }, { type: 'cruise', share: 0.4, min: 70, max: 80 }, { type: 'cruise', share: 0.3, min: 80, max: 90 }, { type: 'cruise', share: 0.2, min: 90, max: 120 }];
    const sizes = bands.map(b => Math.floor(count * b.share));
    const remainder = bands.map((b, i) => ({ i, remainder: count * b.share - sizes[i] })).sort((a, b) => b.remainder - a.remainder || a.i - b.i);
    const extra = count - sizes.reduce((a, b) => a + b, 0);
    for (let i = 0; i < extra; i++) sizes[remainder[i].i]++;
    const drivers = bands.flatMap((band, i) => Array.from({ length: sizes[i] }, () => ({ driverType: band.type, speedBand: i, desiredSpeed: (band.min + random() * (band.max - band.min)) / 3.6 })));
    for (let i = drivers.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [drivers[i], drivers[j]] = [drivers[j], drivers[i]]; }
    return drivers;
  }
  const occupiedLanes = car => car.laneChange ? [car.laneChange.from, car.laneChange.to] : [car.laneIdx];

  function reset(car, lane, lanes) {
    car.laneIdx = lane;
    car.targetX = lanes[lane];
    car.mesh.position.x = car.targetX;
    car.mesh.position.y = 0;
    car.mesh.visible = true;
    car.mesh.rotation.x = car.mesh.rotation.y = car.mesh.rotation.z = 0;
    car.laneChange = null;
    delete car.recoverHighwayLane;
    car.blockedTime = 0;
    car.laneChangeCooldown = profile(car).cooldown;
    car.vx = 0;
    car.vz = -car.speed;
    car.y = car.blastTimer = car.blastVx = car.blastVy = car.blastVz = 0;
  }

  function snapshot(car, lanes) {
    if (!Number.isFinite(car.desiredSpeed)) car.desiredSpeed = car.speed;
    if (!Number.isInteger(car.laneIdx)) car.laneIdx = closestLane(car.mesh.position.x, lanes);
    return { car, x: car.mesh.position.x, z: car.mesh.position.z, speed: car.speed,
      desiredSpeed: car.desiredSpeed, length: car.length || 4.62, lanes: [...new Set([...occupiedLanes(car), ...footprint(car.mesh.position.x, lanes)])] };
  }

  function leaderFor(own, lane, traffic) {
    let leader = null;
    for (const other of traffic) {
      if (own === other || !other.lanes.includes(lane) || other.z > own.z) continue;
      const gap = own.z - other.z - (own.length + other.length) / 2;
      if (!leader || gap < leader.gap) leader = { ...other, speed: other.frontSafetySpeed ?? other.speed, gap };
    }
    return leader;
  }

  function initializeSpeeds(cars, lanes, scale, player) {
    // Birth placement is balanced, not a safety promise: a 180 km/h racer can
    // otherwise start behind a 70 km/h car inside its braking distance.
    // Resolve ahead-to-rear once, retaining every personal cruise target.
    const initial = cars.filter(car => car.mode === 'highway' && !car.highwaySpeedInitialized)
      .sort((a, b) => a.mesh.position.z - b.mesh.position.z);
    for (const car of initial) {
      const own = snapshot(car, lanes);
      const traffic = cars.filter(other => other.mode === 'highway' && other !== car && other.highwayWaitingToSpawn === undefined).map(other => snapshot(other, lanes));
      if (player && player.y < 4) traffic.push({ z: player.z || 0, speed: Math.max(0, -player.vz), length: 4.62, lanes: footprint(player.x, lanes) });
      for (const lane of own.lanes) {
        const leader = leaderFor(own, lane, traffic);
        if (!leader) continue;
        const safeSpeed = Math.sqrt(Math.max(0, leader.speed) ** 2 + 2 * MAX_BRAKE * Math.max(0, leader.gap - MIN_GAP - 2) / scale);
        car.speed = Math.min(car.speed, safeSpeed);
      }
      car.vz = -car.speed;
      car.highwaySpeedInitialized = true;
    }
  }

  function lookAhead(own, scale) {
    return Math.max(38, own.speed * scale * 2.5);
  }

  function safeAdjacentGap(own, lane, traffic, scale) {
    for (const other of traffic) {
      if (other === own || !other.lanes.includes(lane)) continue;
      const distance = own.z - other.z;
      const gap = Math.abs(distance) - (own.length + other.length) / 2;
      const behind = distance < 0;
      const obstacleSpeed = behind ? (other.rearSafetySpeed ?? other.speed) : (other.frontSafetySpeed ?? other.speed);
      const closing = Math.max(0, behind ? obstacleSpeed - own.speed : own.speed - obstacleSpeed);
      const followingSpeed = Math.max(0, behind ? obstacleSpeed : own.speed);
      // The merging car may still brake for its source-lane leader. A rear
      // player or wreck cannot be assumed to brake in response to our merge.
      // Bound our travel under maximum braking, rather than freezing our speed.
      const horizon = profile(own.car).merge + 0.25;
      // Responsive NPC followers brake for reservations. For the player or a
      // wreck retain the full maximum-braking bound: they may never react.
      const responsiveNpc = other.car && !(other.car.blastTimer > 0) && !other.car.recoverHighwayLane;
      const responsiveRear = behind && responsiveNpc;
      const brakingHorizon = responsiveRear ? profile(own.car).merge * 0.45 : horizon;
      const brakingTime = Math.min(brakingHorizon, Math.max(0, own.speed) / MAX_BRAKE);
      const minimumSpeed = Math.max(0, own.speed - MAX_BRAKE * brakingTime);
      const minimumTravel = Math.max(0, own.speed) * brakingTime - 0.5 * MAX_BRAKE * brakingTime * brakingTime + minimumSpeed * (horizon - brakingTime);
      const closingTravel = behind ? Math.max(0, obstacleSpeed * horizon - minimumTravel) : closing * horizon;
      const headway = responsiveNpc ? (profile(own.car).headway * 0.55) : 0.85;
      const needed = Math.max(responsiveNpc ? 9 : 13, followingSpeed * scale * headway) + closingTravel * scale;
      if (gap < needed) return false;
    }
    return true;
  }

  function respawn(car, cars, lanes, ahead, player, scale) {
    const candidates = ahead ? [-452, -470, -434, -416] : [55, 39, 23];
    const occupancy = lanes.map((_, lane) => cars.filter(other => other !== car && other.mode === 'highway' && other.highwayWaitingToSpawn === undefined && occupiedLanes(other).includes(lane)).length);
    const order = lanes.map((_, i) => i).sort((a, b) => occupancy[a] - occupancy[b] || Math.abs(a - car.laneIdx) - Math.abs(b - car.laneIdx));
    const neighbors = cars.filter(other => other !== car && other.mode === 'highway' && other.highwayWaitingToSpawn === undefined)
      .map(other => ({
        car: other, z: other.mesh.position.z,
        speed: other.blastTimer > 0 ? blastSpeed(other, player, scale) : other.speed,
        ...(other.blastTimer > 0 ? blastSafetyBounds(other, player, scale) : {}),
        length: other.length || 4.62,
        lanes: [...new Set([...occupiedLanes(other), ...footprint(other.mesh.position.x, lanes)])]
      }));
    if (player.y < 4) neighbors.push({
      z: player.z || 0, speed: -player.vz, length: 4.62, lanes: footprint(player.x, lanes)
    });
    for (const z of candidates) {
      for (const lane of order) {
        let gap = Infinity;
        for (const other of cars) {
          if (other === car || other.mode !== 'highway' || other.highwayWaitingToSpawn !== undefined) continue;
          // Include both reserved lanes and the actual footprint of a blasted car.
          if (!occupiedLanes(other).includes(lane) && Math.abs(other.mesh.position.x - lanes[lane]) > 2.3) continue;
          gap = Math.min(gap, Math.abs(z - other.mesh.position.z) - ((car.length || 4.62) + (other.length || 4.62)) / 2);
        }
        const atSpawn = { car, z, speed: car.speed, length: car.length || 4.62 };
        if (gap >= 24 && safeAdjacentGap(atSpawn, lane, neighbors, scale)) {
          reset(car, lane, lanes);
          car.mesh.position.z = z;
          return;
        }
      }
    }
    // Hide a rejected entry instead of materializing inside another vehicle.
    // Retry once a safe gap opens on a later simulation step.
    car.highwayWaitingToSpawn = ahead;
    car.mesh.visible = false;
    car.mesh.position.z = ahead ? -510 : 95;
    car.vx = 0;
  }

  function step(cars, player, dt, lanes, scale) {
    for (const car of cars) car.highwayPassedThisFrame = false;
    if (!(dt > 0)) return;
    initializeSpeeds(cars, lanes, scale, player);
    // Bound braking/decisions to 60 Hz or finer, including a slow render frame.
    const count = Math.max(1, Math.ceil(dt / (1 / 60) - 1e-8));
    const h = dt / count;
    for (let substep = 0; substep < count; substep++) {
      const live = [];
      for (const car of cars) {
        if (car.mode !== 'highway') continue;
        if (car.blastTimer > 0) {
          car.laneChange = null;
          car.blockedTime = 0;
          car.laneChangeCooldown = profile(car).cooldown;
          car.recoverHighwayLane = true;
          continue;
        }
        if (car.highwayWaitingToSpawn !== undefined) {
          const ahead = car.highwayWaitingToSpawn;
          delete car.highwayWaitingToSpawn;
          respawn(car, cars, lanes, ahead, player, scale);
          if (car.highwayWaitingToSpawn !== undefined) continue;
        }
        if (car.recoverHighwayLane) {
          car.laneIdx = closestLane(car.mesh.position.x, lanes);
          car.targetX = lanes[car.laneIdx];
        }
        car.laneChangeCooldown = Math.max(0, (car.laneChangeCooldown || 0) - h);
        live.push(snapshot(car, lanes));
      }
      const traffic = live.slice();
      // A low player car occupies every lane swept by its lateral motion during
      // a merge. High flight remains free of road traffic interactions.
      if (player.y < 4) {
        const endX = player.x + (player.vx || 0) * MERGE_SECONDS;
        const occupied = lanes.flatMap((x, i) => x >= Math.min(player.x, endX) - FOOTPRINT_RADIUS && x <= Math.max(player.x, endX) + FOOTPRINT_RADIUS ? [i] : []);
        traffic.push({ x: player.x, z: player.z || 0, speed: -player.vz, length: 4.62, lanes: occupied });
      }
      // Keep airborne blast physics separate, but don't merge into a low wreck.
      for (const car of cars) {
        if (car.mode !== 'highway' || !(car.blastTimer > 0) || (car.y || 0) >= 4) continue;
        traffic.push({ z: car.mesh.position.z, speed: blastSpeed(car, player, scale), ...blastSafetyBounds(car, player, scale), length: car.length || 4.62,
          lanes: footprint(car.mesh.position.x, lanes) });
      }

      // A shockwave may leave a car off-center. Rejoin only after checking
      // the destination, while reserving every lane under its actual footprint.
      for (const own of live) {
        const car = own.car;
        if (!car.recoverHighwayLane || !safeAdjacentGap(own, car.laneIdx, traffic, scale)) continue;
        car.laneChange = { from: car.laneIdx, to: car.laneIdx, startX: own.x, elapsed: 0 };
        delete car.recoverHighwayLane;
      }
      const requests = [];
      for (const own of live) {
        const car = own.car;
        const leader = leaderFor(own, car.laneIdx, traffic);
        const blocked = leader && leader.gap > MIN_GAP && leader.gap < lookAhead(own, scale) && own.desiredSpeed - leader.speed >= profile(car).advantage;
        car.blockedTime = blocked ? (car.blockedTime || 0) + h : 0;
        if (blocked && !car.recoverHighwayLane && !car.laneChange && car.laneChangeCooldown === 0 && car.blockedTime >= profile(car).reaction) requests.push({ own, leader });
      }
      requests.sort((a, b) => a.leader.gap - b.leader.gap);
      for (const { own, leader } of requests) {
        const car = own.car;
        const options = [car.laneIdx - 1, car.laneIdx + 1].filter(lane => lane >= 0 && lane < lanes.length)
          .map(lane => {
            const targetLeader = leaderFor(own, lane, traffic);
            const usefulGap = MIN_GAP + own.desiredSpeed * scale * profile(car).headway;
            const flow = targetLeader ? Math.min(own.desiredSpeed, targetLeader.speed + Math.max(0, targetLeader.gap - usefulGap) / (scale * 3)) : own.desiredSpeed;
            const useful = !targetLeader || targetLeader.speed - leader.speed >= profile(car).advantage || targetLeader.gap - leader.gap > (car.driverType === 'racer' ? 20 : 30);
            return { lane, flow, useful, gap: targetLeader ? targetLeader.gap : Infinity };
          }).filter(option => option.useful && option.flow - leader.speed >= profile(car).advantage && safeAdjacentGap(own, option.lane, traffic, scale))
          .sort((a, b) => b.flow - a.flow || b.gap - a.gap);
        if (!options.length) continue;
        const to = options[0].lane;
        car.laneChange = { from: car.laneIdx, to, startX: own.x, elapsed: 0 };
        car.targetX = lanes[to];
        car.blockedTime = 0;
        own.lanes = [car.laneIdx, to]; // Reservation is visible to every later request.
      }

      const plans = live.map(own => {
        const driver = profile(own.car);
        let acceleration = driver.acceleration * (1 - Math.pow(own.speed / Math.max(1, own.desiredSpeed), 4));
        for (const lane of own.lanes) {
          const leader = leaderFor(own, lane, traffic);
          if (!leader) continue;
          const v = Math.max(0, own.speed) * scale;
          const closing = (own.speed - leader.speed) * scale;
          const headway = MIN_GAP + Math.max(0, v * driver.headway + v * closing / (2 * Math.sqrt(driver.acceleration * 4.5) * scale));
          acceleration = Math.min(acceleration, driver.acceleration * (1 - Math.pow(own.speed / Math.max(1, own.desiredSpeed), 4) - Math.pow(headway / Math.max(0.1, leader.gap), 2)));
        }
        return { own, speed: clamp(own.speed + clamp(acceleration, -MAX_BRAKE, driver.acceleration) * h, 0, own.desiredSpeed) };
      });
      for (const { own, speed } of plans) {
        const car = own.car;
        car.speed = speed;
        car.vz = -speed;
        car.mesh.position.z += (-player.vz - (own.speed + speed) / 2) * scale * h;
        let lateralSpeed = 0;
        if (car.laneChange) {
          const change = car.laneChange;
          const mergeSeconds = profile(car).merge;
          change.elapsed = Math.min(mergeSeconds, change.elapsed + h);
          const t = change.elapsed / mergeSeconds;
          const blend = t * t * t * (10 + t * (-15 + 6 * t));
          const distance = lanes[change.to] - change.startX;
          car.mesh.position.x = change.startX + distance * blend;
          lateralSpeed = distance * 30 * t * t * (1 - t) * (1 - t) / mergeSeconds;
          if (t >= 1) {
            car.laneIdx = change.to;
            car.laneChange = null;
            car.laneChangeCooldown = profile(car).cooldown;
          }
        }
        car.vx = lateralSpeed; // Highway lateral motion is unscaled, like state.vx.
        car.mesh.rotation.y = -clamp(Math.atan2(lateralSpeed, Math.max(8, speed * scale)), -0.14, 0.14);
        car.mesh.rotation.z = -clamp(lateralSpeed * 0.018, -0.06, 0.06);
        if (car.mesh.position.z > 65) {
          car.highwayPassedThisFrame = true;
          respawn(car, cars, lanes, true, player, scale);
        } else if (car.mesh.position.z < -480) respawn(car, cars, lanes, false, player, scale);
      }
    }
  }
  return Object.freeze({ step, createDrivers, initializeSpeeds });
})();
