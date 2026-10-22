// Highway-only traffic. Speeds belong to drivers; lane changes need a slower
// leader and a safe, useful adjacent gap. Plan from one snapshot so an earlier
// array entry cannot cut into a later car's already-reserved merge.
const highwayTraffic = (() => {
  const MIN_GAP = 7;
  // World -Z is forward. Only incident recovery uses the rear reservoir;
  // ordinary longitudinal window exits keep the continuous road traffic loop.
  const REAR_SPAWN_OFFSETS = [95, 135, 175, 215, 255, 295, 335, 375, 415];
  const FRONT_SPAWN_OFFSETS = [-452, -470, -434, -416];
  const NORMAL_REAR_SPAWN_OFFSETS = [55, 39, 23];
  const spawnCandidates = (player, placement) => {
    const offsets = placement === 'incident' ? REAR_SPAWN_OFFSETS : placement === 'ahead' ? FRONT_SPAWN_OFFSETS : NORMAL_REAR_SPAWN_OFFSETS;
    return player.z ? offsets.map(z => z + player.z) : offsets;
  };
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

  function reset(car, lane, lanes, placement) {
    car.laneIdx = lane;
    car.targetX = lanes[lane];
    car.mesh.position.x = car.targetX;
    car.mesh.position.y = 0;
    car.mesh.visible = true;
    car.mesh.rotation.x = car.mesh.rotation.y = car.mesh.rotation.z = 0;
    car.laneChange = null;
    delete car.recoverHighwayLane;
    delete car.highwayWaitingToSpawn;
    car.highwayRecycledBehind = placement === 'incident';
    car.highwayPassEligible = placement === 'ahead';
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

  // Explicit speculative-only allocation path. Shared arrays are immutable;
  // reservations replace own.lanes rather than mutating an occupancy array.
  // Keep the original reserved-lane-first Set order, including reversed merges.
  const forecastMaskLanes = Array.from({ length: 64 }, (_, mask) =>
    Object.freeze(Array.from({ length: 6 }, (_, i) => i).filter(i => mask & (1 << i))));
  const forecastOccupancy = new Array(6 * 7 * 64);
  function forecastFootprint(x, lanes) {
    let mask = 0;
    for (let i = 0; i < 6; i++) if (Math.abs(lanes[i] - x) <= FOOTPRINT_RADIUS) mask |= 1 << i;
    return forecastMaskLanes[mask];
  }
  function forecastOccupied(car, lanes) {
    const first = car.laneChange ? car.laneChange.from : car.laneIdx;
    const second = car.laneChange ? car.laneChange.to : 6;
    if (!Number.isInteger(first) || first < 0 || first >= 6 ||
        !Number.isInteger(second) || second < 0 || second > 6 || (car.laneChange && second === 6))
      return [...new Set([...occupiedLanes(car), ...footprint(car.mesh.position.x, lanes)])];
    let mask = 0;
    for (let i = 0; i < 6; i++) if (Math.abs(lanes[i] - car.mesh.position.x) <= FOOTPRINT_RADIUS) mask |= 1 << i;
    const key = (first * 7 + second) * 64 + mask;
    let occupied = forecastOccupancy[key];
    if (!occupied) {
      occupied = [first];
      let included = 1 << first;
      if (second < 6 && second !== first) { occupied.push(second); included |= 1 << second; }
      for (let i = 0; i < 6; i++) if ((mask & (1 << i)) && !(included & (1 << i))) occupied.push(i);
      forecastOccupancy[key] = Object.freeze(occupied);
    }
    return occupied;
  }
  function forecastSnapshot(car, lanes) {
    if (!Number.isFinite(car.desiredSpeed)) car.desiredSpeed = car.speed;
    if (!Number.isInteger(car.laneIdx)) car.laneIdx = closestLane(car.mesh.position.x, lanes);
    return { car, x: car.mesh.position.x, z: car.mesh.position.z, speed: car.speed,
      desiredSpeed: car.desiredSpeed, length: car.length || 4.62, lanes: forecastOccupied(car, lanes) };
  }
  const forecastLaneKey = Symbol('forecast lane members');
  function forecastIndexLanes(traffic) {
    const members = [[], [], [], [], [], []];
    // Original traffic ordinal is the tie-breaker. Do not sort by z: lengths,
    // equal-z contacts and exact floating-point gap comparisons still matter.
    for (const other of traffic) for (const lane of other.lanes) {
      if (!Number.isInteger(lane) || lane < 0 || lane >= 6) continue;
      const list = members[lane];
      if (list[list.length - 1] !== other) list.push(other);
    }
    traffic[forecastLaneKey] = members;
  }
  function forecastMembers(traffic, lane) {
    return Number.isInteger(lane) && lane >= 0 && lane < 6 ? traffic[forecastLaneKey]?.[lane] : null;
  }
  function forecastSafeAdjacentGap(own, lane, traffic, scale) {
    return safeAdjacentGap(own, lane, forecastMembers(traffic, lane) || traffic, scale);
  }
  function forecastLeaderFor(own, lane, traffic) {
    let leader = null, nearestGap = 0;
    const members = forecastMembers(traffic, lane);
    for (const other of members || traffic) {
      if (own === other || (!members && !other.lanes.includes(lane)) || other.z > own.z) continue;
      const gap = own.z - other.z - (own.length + other.length) / 2;
      if (!leader || gap < nearestGap) { leader = other; nearestGap = gap; }
    }
    // All consumers use only speed and gap. Preserve the safety override and
    // strict comparison above; equal-gap leaders retain original array order.
    return leader ? { speed: leader.frontSafetySpeed ?? leader.speed, gap: nearestGap } : null;
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

  function initializeSpeeds(cars, lanes, scale, player, forecast = false) {
    const snapshotFor = forecast ? forecastSnapshot : snapshot;
    const leaderForStep = forecast ? forecastLeaderFor : leaderFor;
    const footprintFor = forecast ? forecastFootprint : footprint;
    // Birth placement is balanced, not a safety promise: a 180 km/h racer can
    // otherwise start behind a 70 km/h car inside its braking distance.
    // Resolve ahead-to-rear once, retaining every personal cruise target.
    const initial = cars.filter(car => car.mode === 'highway' && !car.highwaySpeedInitialized)
      .sort((a, b) => a.mesh.position.z - b.mesh.position.z);
    for (const car of initial) {
      const own = snapshotFor(car, lanes);
      const traffic = cars.filter(other => other.mode === 'highway' && other !== car && other.highwayWaitingToSpawn === undefined).map(other => snapshotFor(other, lanes));
      if (player && player.y < 4) traffic.push({ z: player.z || 0, speed: Math.max(0, -player.vz), length: 4.62, lanes: footprintFor(player.x, lanes) });
      for (const lane of own.lanes) {
        const leader = leaderForStep(own, lane, traffic);
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

  const bodyRadius = car => Math.hypot(car.length || car.mesh.userData?.length || 4.62,
    car.width || car.mesh.userData?.width || 2.03, car.height || car.mesh.userData?.height || 1.5) / 2;
  const isWreck = car => car.blastTimer > 0 || car.recoverHighwayLane;
  const spawnLength = car => isWreck(car) ? bodyRadius(car) * 2 : car.length || 4.62;
  function spawnOccupied(car, lanes, forecast = false) {
    const occupied = forecast ? forecastOccupied(car, lanes) : [...new Set([...occupiedLanes(car), ...footprint(car.mesh.position.x, lanes)])];
    if (!isWreck(car)) return occupied;
    // A tumbling long body may cover another lane even at a lane center.
    // The half-lane margin covers an admitted body anywhere inside its lane.
    return [...new Set([...occupied, ...lanes.flatMap((center, lane) =>
      Math.abs(center - car.mesh.position.x) <= bodyRadius(car) + 2.5 ? [lane] : [])])];
  }
  const spawnReserves = (car, lane, lanes) => occupiedLanes(car).includes(lane) ||
    Math.abs(car.mesh.position.x - lanes[lane]) <= (isWreck(car) ? bodyRadius(car) + 2.5 : 2.3);

  const forecastReserves = (car, lane) => car.laneChange
    ? car.laneChange.from === lane || car.laneChange.to === lane : car.laneIdx === lane;
  function forecastSpawnIndex(own, cars, lanes, player, scale) {
    const occupancy = [0, 0, 0, 0, 0, 0], neighbors = [], live = [];
    for (const other of cars) {
      if (other === own || other.mode !== 'highway' || other.highwayWaitingToSpawn !== undefined) continue;
      live.push(other);
      for (let lane = 0; lane < 6; lane++) if (forecastReserves(other, lane)) occupancy[lane]++;
      const neighbor = { car: other, z: other.mesh.position.z,
        speed: other.blastTimer > 0 ? blastSpeed(other, player, scale) : other.speed,
        length: spawnLength(other), lanes: spawnOccupied(other, lanes, true) };
      if (other.blastTimer > 0) {
        const bounds = blastSafetyBounds(other, player, scale);
        neighbor.frontSafetySpeed = bounds.frontSafetySpeed; neighbor.rearSafetySpeed = bounds.rearSafetySpeed;
      }
      neighbors.push(neighbor);
    }
    if (player.y < 4) neighbors.push({ z: player.z || 0, speed: -player.vz, length: 4.62,
      lanes: forecastFootprint(player.x, lanes) });
    forecastIndexLanes(neighbors);
    return { occupancy, neighbors, live, gaps: new Map() };
  }
  function forecastRespawn(car, cars, lanes, player, scale, shared, placement) {
    const holder = shared || { index: null };
    const index = holder.index || (holder.index = forecastSpawnIndex(car, cars, lanes, player, scale));
    const candidates = spawnCandidates(player, placement);
    const order = lanes.map((_, i) => i).sort((a, b) => index.occupancy[a] - index.occupancy[b] || Math.abs(a - car.laneIdx) - Math.abs(b - car.laneIdx));
    const length = car.length || 4.62, byLength = index.gaps;
    const key = placement + ':' + length;
    let slots = byLength.get(key);
    if (!slots) {
      slots = candidates.map(z => lanes.map((_, lane) => {
        let gap = Infinity;
        for (const other of index.live) {
          if (!spawnReserves(other, lane, lanes)) continue;
          // Keep the exact original operation order. Splitting the two half
          // lengths can round differently at the 24 m admission boundary.
          gap = Math.min(gap, Math.abs(z - other.mesh.position.z) - (length + spawnLength(other)) / 2);
        }
        return gap;
      }));
      byLength.set(key, slots);
    }
    for (let slot = 0; slot < candidates.length; slot++) {
      const z = candidates[slot];
      for (const lane of order) {
        const atSpawn = { car, z, speed: car.speed, length };
        // Each waiting driver still pays its OWN speed/profile safety check.
        // Only immutable slot geometry is shared, never a failure decision.
        if (slots[slot][lane] >= 24 && forecastSafeAdjacentGap(atSpawn, lane, index.neighbors, scale)) {
          reset(car, lane, lanes, placement); car.mesh.position.z = z;
          holder.index = null; // Newly live car changes every later retry.
          return;
        }
      }
    }
    car.highwayWaitingToSpawn = placement === 'ahead'; car.highwayRecycledBehind = placement === 'incident'; car.highwayPassEligible = false; car.mesh.visible = false;
    car.mesh.position.z = (player.z || 0) + (placement === 'ahead' ? -510 : 510); car.vx = 0;
  }

  function retireBlast(car) {
    car.y = car.blastTimer = car.blastVx = car.blastVy = car.blastVz = 0;
    car.blastVRoll = car.blastVPitch = car.blastVYaw = 0;
    car.mesh.position.y = 0;
    car.mesh.rotation.x = car.mesh.rotation.y = car.mesh.rotation.z = 0;
    car.laneChange = null;
    delete car.recoverHighwayLane;
  }
  function isOffRoad(car, lanes) {
    const halfLane = lanes.length > 1 ? Math.abs(lanes[1] - lanes[0]) / 2 : 2.5;
    // A tumbling body's X extent can come from length/height, not just width.
    // Its enclosing radius keeps the whole body beyond the 30 m pavement plus
    // a 1 m buffer before recycling, regardless of yaw/pitch/roll.
    const lateralMargin = halfLane + bodyRadius(car) + 1;
    return car.mesh.position.x < lanes[0] - lateralMargin || car.mesh.position.x > lanes[lanes.length - 1] + lateralMargin;
  }
  function isOutOfBounds(car, lanes, player = { z: 0 }) {
    if (car.mode !== 'highway') return false;
    const z = player.z || 0, rearLimit = car.highwayRecycledBehind ? 480 : 65;
    return car.mesh.position.z < z - 480 || car.mesh.position.z > z + rearLimit || isOffRoad(car, lanes);
  }
  function respawnBehind(car, cars, lanes, player, scale) {
    if (car.mode !== 'highway') return false;
    car.highwayPassedThisFrame = false;
    delete car.highwayWaitingToSpawn;
    respawn(car, cars, lanes, player, scale);
    return car.highwayWaitingToSpawn === undefined;
  }
  function retrySpawn(car, cars, lanes, player, scale, forecast = false, shared = null) {
    if (car.mode !== 'highway' || car.highwayWaitingToSpawn === undefined) return false;
    const placement = car.highwayWaitingToSpawn ? 'ahead' : car.highwayRecycledBehind ? 'incident' : 'behind';
    delete car.highwayWaitingToSpawn;
    respawn(car, cars, lanes, player, scale, forecast, shared, placement);
    return car.highwayWaitingToSpawn === undefined;
  }
  function respawn(car, cars, lanes, player, scale, forecast = false, shared = null, placement = 'incident') {
    retireBlast(car);
    // Reuse the already-proven exact six-lane retry geometry in the runtime
    // too. Rejected waiting entries stay hidden and do not change occupancy.
    if (forecast || shared) return forecastRespawn(car, cars, lanes, player, scale, shared, placement);
    const candidates = spawnCandidates(player, placement);
    const occupancy = lanes.map((_, lane) => cars.filter(other => other !== car && other.mode === 'highway' && other.highwayWaitingToSpawn === undefined && occupiedLanes(other).includes(lane)).length);
    const order = lanes.map((_, i) => i).sort((a, b) => occupancy[a] - occupancy[b] || Math.abs(a - car.laneIdx) - Math.abs(b - car.laneIdx));
    const neighbors = cars.filter(other => other !== car && other.mode === 'highway' && other.highwayWaitingToSpawn === undefined)
      .map(other => ({
        car: other, z: other.mesh.position.z,
        speed: other.blastTimer > 0 ? blastSpeed(other, player, scale) : other.speed,
        ...(other.blastTimer > 0 ? blastSafetyBounds(other, player, scale) : {}),
        length: spawnLength(other),
        lanes: spawnOccupied(other, lanes)
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
          if (!spawnReserves(other, lane, lanes)) continue;
          gap = Math.min(gap, Math.abs(z - other.mesh.position.z) - ((car.length || 4.62) + spawnLength(other)) / 2);
        }
        const atSpawn = { car, z, speed: car.speed, length: car.length || 4.62 };
        if (gap >= 24 && safeAdjacentGap(atSpawn, lane, neighbors, scale)) {
          reset(car, lane, lanes, placement);
          car.mesh.position.z = z;
          return;
        }
      }
    }
    // Hide a rejected entry instead of materializing inside another vehicle.
    // Retry once a safe gap opens on a later simulation step.
    car.highwayWaitingToSpawn = placement === 'ahead';
    car.highwayRecycledBehind = placement === 'incident';
    car.highwayPassEligible = false;
    car.mesh.visible = false;
    car.mesh.position.z = (player.z || 0) + (placement === 'ahead' ? -510 : 510);
    car.vx = 0;
  }

  function step(cars, player, dt, lanes, scale, forecast = false) {
    const snapshotFor = forecast ? forecastSnapshot : snapshot;
    const leaderForStep = forecast ? forecastLeaderFor : leaderFor;
    const footprintFor = forecast ? forecastFootprint : footprint;
    const adjacentGapFor = forecast ? forecastSafeAdjacentGap : safeAdjacentGap;
    for (const car of cars) car.highwayPassedThisFrame = false;
    if (!(dt > 0)) return;
    initializeSpeeds(cars, lanes, scale, player, forecast);
    // Bound braking/decisions to 60 Hz or finer, including a slow render frame.
    const count = Math.max(1, Math.ceil(dt / (1 / 60) - 1e-8));
    const h = dt / count;
    for (let substep = 0; substep < count; substep++) {
      const live = [];
      const spawnCache = lanes.length === 6 ? { index: null } : null;
      for (const car of cars) {
        if (car.mode !== 'highway') continue;
        if (typeof car.highwayPassEligible !== 'boolean') car.highwayPassEligible =
          car.mesh.position.z < (player.z || 0) - ((car.length || 4.62) + 4.62) / 2;
        // A pre-existing expired blast is a safe fallback. Normal runtime
        // also calls respawnBehind directly at active/destroyed blast expiry.
        const expiredBlast = !(car.blastTimer > 0) && car.recoverHighwayLane;
        const incidentExit = isOffRoad(car, lanes) || (isWreck(car) && isOutOfBounds(car, lanes, player));
        if (car.highwayWaitingToSpawn === undefined && (incidentExit || expiredBlast)) {
          if (spawnCache) spawnCache.index = null;
          respawn(car, cars, lanes, player, scale, forecast, spawnCache);
          if (car.highwayWaitingToSpawn !== undefined) continue;
        }
        if (car.blastTimer > 0) {
          if (spawnCache) spawnCache.index = null;
          car.laneChange = null;
          car.blockedTime = 0;
          car.laneChangeCooldown = profile(car).cooldown;
          car.recoverHighwayLane = true;
          continue;
        }
        if (car.highwayWaitingToSpawn !== undefined) {
          retrySpawn(car, cars, lanes, player, scale, forecast, spawnCache);
          if (car.highwayWaitingToSpawn !== undefined) continue;
        }
        if (car.recoverHighwayLane) {
          if (spawnCache) spawnCache.index = null;
          car.laneIdx = closestLane(car.mesh.position.x, lanes);
          car.targetX = lanes[car.laneIdx];
        }
        car.laneChangeCooldown = Math.max(0, (car.laneChangeCooldown || 0) - h);
        if (spawnCache && !Number.isInteger(car.laneIdx)) spawnCache.index = null;
        live.push(snapshotFor(car, lanes));
      }
      const traffic = live.slice();
      // A low player car occupies every lane swept by its lateral motion during
      // a merge. High flight remains free of road traffic interactions.
      if (player.y < 4) {
        const endX = player.x + (player.vx || 0) * MERGE_SECONDS;
        let occupied;
        if (forecast) {
          let mask = 0;
          const low = Math.min(player.x, endX) - FOOTPRINT_RADIUS, high = Math.max(player.x, endX) + FOOTPRINT_RADIUS;
          for (let i = 0; i < 6; i++) if (lanes[i] >= low && lanes[i] <= high) mask |= 1 << i;
          occupied = forecastMaskLanes[mask];
        } else occupied = lanes.flatMap((x, i) => x >= Math.min(player.x, endX) - FOOTPRINT_RADIUS && x <= Math.max(player.x, endX) + FOOTPRINT_RADIUS ? [i] : []);
        traffic.push({ x: player.x, z: player.z || 0, speed: -player.vz, length: 4.62, lanes: occupied });
      }
      // Keep airborne blast physics separate, but don't merge into a low wreck.
      for (const car of cars) {
        if (car.mode !== 'highway' || !(car.blastTimer > 0) || (car.y || 0) >= 4) continue;
        traffic.push({ z: car.mesh.position.z, speed: blastSpeed(car, player, scale), ...blastSafetyBounds(car, player, scale), length: car.length || 4.62,
          lanes: footprintFor(car.mesh.position.x, lanes) });
      }

      if (forecast) forecastIndexLanes(traffic);

      // A shockwave may leave a car off-center. Rejoin only after checking
      // the destination, while reserving every lane under its actual footprint.
      for (const own of live) {
        const car = own.car;
        if (!car.recoverHighwayLane || !adjacentGapFor(own, car.laneIdx, traffic, scale)) continue;
        car.laneChange = { from: car.laneIdx, to: car.laneIdx, startX: own.x, elapsed: 0 };
        delete car.recoverHighwayLane;
      }
      const requests = [];
      for (const own of live) {
        const car = own.car;
        const leader = leaderForStep(own, car.laneIdx, traffic);
        const blocked = leader && leader.gap > MIN_GAP && leader.gap < lookAhead(own, scale) && own.desiredSpeed - leader.speed >= profile(car).advantage;
        car.blockedTime = blocked ? (car.blockedTime || 0) + h : 0;
        if (blocked && !car.recoverHighwayLane && !car.laneChange && car.laneChangeCooldown === 0 && car.blockedTime >= profile(car).reaction) requests.push({ own, leader });
      }
      requests.sort((a, b) => a.leader.gap - b.leader.gap);
      for (const { own, leader } of requests) {
        const car = own.car;
        const options = [car.laneIdx - 1, car.laneIdx + 1].filter(lane => lane >= 0 && lane < lanes.length)
          .map(lane => {
            const targetLeader = leaderForStep(own, lane, traffic);
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
        // Rebuild immediately in original ordinal order before the next
        // request sees this reservation. Never reuse a pre-approval index.
        if (forecast) forecastIndexLanes(traffic);
      }

      const plans = live.map(own => {
        const driver = profile(own.car);
        let acceleration = driver.acceleration * (1 - Math.pow(own.speed / Math.max(1, own.desiredSpeed), 4));
        for (const lane of own.lanes) {
          const leader = leaderForStep(own, lane, traffic);
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
        const playerZ = player.z || 0;
        // A rear entry is not a player overtake. It becomes eligible only
        // after actually returning fully in front of the player, not a wrap.
        if (car.mesh.position.z < playerZ - ((car.length || 4.62) + 4.62) / 2) {
          car.highwayRecycledBehind = false;
          car.highwayPassEligible = true;
        }
        const rearLimit = car.highwayRecycledBehind ? 480 : 65;
        if (car.mesh.position.z > playerZ + rearLimit) {
          if (!car.highwayRecycledBehind && car.highwayPassEligible && own.z <= playerZ + 65) car.highwayPassedThisFrame = true;
          respawn(car, cars, lanes, player, scale, forecast, null, 'ahead');
        } else if (car.mesh.position.z < playerZ - 480) respawn(car, cars, lanes, player, scale, forecast, null, 'behind');
      }
    }
  }
  function forecastStep(cars, player, dt, lanes, scale) {
    // The six-lane cache is an allocation optimization, never an approximation
    // for another road layout. Other lane counts retain the ordinary path.
    return step(cars, player, dt, lanes, scale, lanes.length === 6);
  }
  return Object.freeze({ step, forecastStep, createDrivers, initializeSpeeds, respawnBehind, retrySpawn, isOutOfBounds });
})();
