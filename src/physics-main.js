// =========================================================================
// 7. PHYSICS COLLISION, 18G DESTRUCTION THRESHOLD & SHATTER DEBRIS SYSTEM
// =========================================================================
const debrisGroup = new THREE.Group();
scene.add(debrisGroup);
let debrisPieces = [];

const explosionGroup = new THREE.Group();
scene.add(explosionGroup);
let activeExplosions = [];

function spawnExplosionEffect(x, y, z, scale = 1.0) {
  const expRoot = new THREE.Group();
  expRoot.position.set(x, Math.max(0.5, y + 0.6), z);
  explosionGroup.add(expRoot);

  // 1. Expanding Outer Fireball Sphere
  const fireballMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide
  });
  const fireballMesh = new THREE.Mesh(new THREE.SphereGeometry(1.35 * scale, 20, 16), fireballMat);
  expRoot.add(fireballMesh);

  // 2. White-Hot Inner Plasma Core
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1.0
  });
  const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.85 * scale, 16, 12), coreMat);
  expRoot.add(coreMesh);

  // 3. Supersonic Horizontal Shockwave Blast Ring
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide
  });
  const ringMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.9 * scale, 1.65 * scale, 36).rotateX(-Math.PI / 2),
    ringMat
  );
  ringMesh.position.y = -0.35;
  expRoot.add(ringMesh);

  // 4. High-Intensity Transient Explosion Flash Light
  const flashLight = new THREE.PointLight(0xff6600, 10.0 * scale, 80.0 * scale);
  expRoot.add(flashLight);

  // 5. Radial Fire Sparks & Dark Smoke Plume Particles
  const particles = [];
  const sparkColors = [0xfef08a, 0xf97316, 0xef4444, 0x38bdf8, 0x1e293b];
  const pCount = Math.round(28 * Math.min(1.6, Math.max(0.7, scale)));
  for (let i = 0; i < pCount; i++) {
    const isSmoke = (i % 3 === 0);
    const pMat = new THREE.MeshBasicMaterial({
      color: isSmoke ? 0x334155 : sparkColors[i % 4],
      transparent: true,
      opacity: 0.95
    });
    const r = isSmoke ? (0.35 + Math.random() * 0.45) * scale : (0.14 + Math.random() * 0.25) * scale;
    const pMesh = new THREE.Mesh(
      isSmoke ? new THREE.SphereGeometry(r, 8, 8) : new THREE.BoxGeometry(r, r, r),
      pMat
    );
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.65;
    const spd = (10 + Math.random() * 28) * scale;
    expRoot.add(pMesh);
    particles.push({
      mesh: pMesh,
      mat: pMat,
      isSmoke,
      vx: Math.cos(theta) * Math.sin(phi) * spd,
      vy: Math.cos(phi) * spd + (isSmoke ? 6.0 : 2.0),
      vz: Math.sin(theta) * Math.sin(phi) * spd
    });
  }

  activeExplosions.push({
    root: expRoot,
    fireballMesh,
    fireballMat,
    coreMesh,
    coreMat,
    ringMesh,
    ringMat,
    flashLight,
    particles,
    age: 0.0,
    duration: 1.45 * Math.max(0.85, Math.min(1.35, scale)),
    scale
  });
}

function updateExplosions(dt) {
  for (let i = activeExplosions.length - 1; i >= 0; i--) {
    const ex = activeExplosions[i];
    ex.age += dt;
    const t = ex.age / ex.duration;
    if (t >= 1.0) {
      explosionGroup.remove(ex.root);
      activeExplosions.splice(i, 1);
      continue;
    }
    // Expand fireball & transition color from yellow -> orange -> crimson -> dark smoke
    const fbScale = 1.0 + Math.pow(t, 0.55) * 6.8;
    ex.fireballMesh.scale.set(fbScale, fbScale, fbScale);
    if (t < 0.25) {
      ex.fireballMat.color.setHex(0xfef08a);
    } else if (t < 0.55) {
      ex.fireballMat.color.setHex(0xf97316);
    } else if (t < 0.8) {
      ex.fireballMat.color.setHex(0xdc2626);
    } else {
      ex.fireballMat.color.setHex(0x1e293b);
    }
    ex.fireballMat.opacity = Math.max(0, (1.0 - t) * 0.92);

    const coreScale = 1.0 + t * 3.5;
    ex.coreMesh.scale.set(coreScale, coreScale, coreScale);
    ex.coreMat.opacity = Math.max(0, 1.0 - t * 2.2);

    // Supersonic shockwave ring expands rapidly
    const ringScale = 1.0 + Math.pow(t, 0.48) * 16.5;
    ex.ringMesh.scale.set(ringScale, ringScale, 1.0);
    ex.ringMat.opacity = Math.max(0, (1.0 - t) * 0.85);

    ex.flashLight.intensity = Math.max(0, (1.0 - t * 1.4) * 10.0 * ex.scale);

    ex.particles.forEach((p) => {
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.isSmoke) {
        p.vy += 3.5 * dt;
        const s = 1.0 + t * 2.6;
        p.mesh.scale.set(s, s, s);
      } else {
        p.vy -= 20.0 * dt;
        p.mesh.rotation.x += 8.0 * dt;
        p.mesh.rotation.y += 8.0 * dt;
      }
      p.mat.opacity = Math.max(0, 1.0 - t);
    });
  }
}

function applyExplosionBlastToTraffic(bx, by, bz, blastRadius, blastStrength) {
  let affected = 0;
  trafficCars.forEach((car) => {
    const dx = car.mesh.position.x - bx;
    const dz = car.mesh.position.z - bz;
    const dy = (car.mesh.position.y || 0) - by;
    const dist = Math.hypot(dx, dz, dy * 0.5);
    if (dist < blastRadius) {
      const falloff = Math.pow(1.0 - dist / blastRadius, 1.15);
      const dirX = dist > 0.05 ? dx / dist : (Math.random() - 0.5);
      const dirZ = dist > 0.05 ? dz / dist : -1.0;
      const impulse = blastStrength * (0.45 + 0.55 * falloff);

      car.blastVx = (car.blastVx || 0) + dirX * impulse * 1.15 + (Math.random() - 0.5) * 8.0;
      car.blastVz = (car.blastVz || 0) + dirZ * impulse * 1.15;
      car.blastVy = Math.max(car.blastVy || 0, (6.5 + falloff * 14.5) * (blastStrength / 32.0));
      car.blastVRoll = (Math.random() - 0.5) * 11.0 * falloff;
      car.blastVPitch = (Math.random() - 0.5) * 9.0 * falloff;
      car.blastVYaw = (Math.random() - 0.5) * 10.0 * falloff;
      car.blastTimer = 3.2;

      // Sympathetic secondary explosion on close cars
      if (dist < 14.0) {
        spawnExplosionEffect(car.mesh.position.x, (car.mesh.position.y || 0) + 0.8, car.mesh.position.z, 0.65);
      }
      affected++;
    }
  });
  if (affected > 0) {
    state.blastedCarsCount += affected;
    state.carsCleared += affected;
    state.score += affected * 150;
  }
  return affected;
}

function spawnDestructionDebris(x, y, z, baseVx, baseVy, baseVz) {
  clearDebris();
  const pieceColors = [bodyMaterial.color.getHex(), 0x111827, 0x38bdf8, 0xf97316, 0xef4444];
  for (let i = 0; i < 34; i++) {
    const sx = 0.25 + Math.random() * 0.65;
    const sy = 0.08 + Math.random() * 0.28;
    const sz = 0.25 + Math.random() * 0.75;
    const mat = new THREE.MeshStandardMaterial({
      color: pieceColors[i % pieceColors.length],
      metalness: 0.7,
      roughness: 0.3
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.position.set(
      x + (Math.random() - 0.5) * 1.8,
      Math.max(0.2, y + Math.random() * 1.1),
      z + (Math.random() - 0.5) * 2.8
    );
    debrisGroup.add(mesh);
    debrisPieces.push({
      mesh,
      vx: baseVx * 0.35 + (Math.random() - 0.5) * 28,
      vy: Math.max(5, baseVy * 0.3 + Math.random() * 20),
      vz: baseVz * 0.35 + (Math.random() - 0.5) * 28,
      rx: (Math.random() - 0.5) * 14,
      ry: (Math.random() - 0.5) * 14,
      rz: (Math.random() - 0.5) * 14
    });
  }
}

function clearDebris() {
  debrisPieces.forEach(p => debrisGroup.remove(p.mesh));
  debrisPieces = [];
  activeExplosions.forEach(ex => explosionGroup.remove(ex.root));
  activeExplosions = [];
  if (typeof clearTireSmoke === 'function') clearTireSmoke();
}

function triggerPhysicsCollision(deltaV, reasonKey, bounceVx, bounceVy, bounceVz) {
  if (state.isDestroyed || state.impactCooldown > 0) return;
  state.impactCooldown = 0.32;

  const peakG = (deltaV / CRITICAL_IMPACT_DV) * CRITICAL_G_LIMIT;
  const energyKj = 0.5 * VEHICLE_MASS_KG * deltaV * deltaV / 1000;
  const dvKmh = deltaV * 3.6;

  state.lastImpactG = peakG;
  state.lastImpactDvKmh = dvKmh;
  state.lastImpactEnergyKj = energyKj;

  const worldZ = currentMap === 'highway' ? 0 : state.z;

  if (peakG >= CRITICAL_G_LIMIT) {
    destroyVehicle(reasonKey);
    return;
  }

  // Requirement 1: Ordinary non-fatal collisions do NOT trigger explosion VFX (only vehicle destruction explodes)
  const damage = Math.max(6, Math.pow(deltaV / CRITICAL_IMPACT_DV, 1.65) * 85);
  state.hullIntegrity = Math.max(0, state.hullIntegrity - damage);

  if (state.hullIntegrity <= 0.1) {
    state.hullIntegrity = 0;
    destroyVehicle('crashReasonCumulative');
    return;
  }

  state.vx += bounceVx;
  if (state.wasAirborne) {
    state.vz += bounceVz || 0;
    state.speed = Math.hypot(state.vx, state.vz);
  }
  state.vy = Math.max(state.vy, bounceVy);
  state.vRoll += (Math.random() - 0.5) * 3.5;
  state.vPitch += (Math.random() - 0.5) * 2.5;
  state.vYaw += (Math.random() - 0.5) * 3.0;
  sound.playCrash(false);
  showBanner('impact', 2.0);
}

function destroyVehicle(reasonKey) {
  if (state.isDestroyed) return;
  state.isDestroyed = true;
  state.hullIntegrity = 0;
  state.destroyReasonKey = reasonKey || 'crashReasonThreshold';
  carMeshGroup.visible = false;
  if (typeof headlightSpotL !== 'undefined') headlightSpotL.intensity = 0.0;
  if (typeof headlightSpotR !== 'undefined') headlightSpotR.intensity = 0.0;
  hoverRingMat.opacity = 0;

  const worldZ = currentMap === 'highway' ? 0 : state.z;
  spawnDestructionDebris(state.x, state.y, worldZ, state.vx, state.vy, state.vz);
  spawnExplosionEffect(state.x, state.y, worldZ, 1.75);
  applyExplosionBlastToTraffic(state.x, state.y, worldZ, 55.0, 46.0);
  sound.playCrash(true);

  updateDestroyedModalText();
  document.getElementById('modal-destroyed').classList.remove('hidden');
}

function updateDestroyedModalText() {
  const t = I18N[currentLang];
  document.getElementById('crash-badge').textContent = t.crashBadge;
  document.getElementById('crash-title').textContent = t.crashTitle;
  document.getElementById('crash-reason').textContent = t[state.destroyReasonKey] || t.crashReasonThreshold;
  document.getElementById('crash-lbl-speed').textContent = t.crashLblSpeed;
  document.getElementById('crash-lbl-g').textContent = t.crashLblG;
  document.getElementById('crash-lbl-energy').textContent = t.crashLblEnergy;
  document.getElementById('crash-val-speed').textContent = `${Math.round(state.lastImpactDvKmh)} km/h`;
  document.getElementById('crash-val-g').textContent = `${state.lastImpactG.toFixed(1)} G`;
  document.getElementById('crash-val-energy').textContent = `${Math.round(state.lastImpactEnergyKj)} kJ`;
  document.getElementById('crash-btn-respawn').textContent = t.crashBtnRespawn;
  document.getElementById('crash-btn-map').textContent = t.crashBtnMap;
}

// =========================================================================
// 9. MAIN GAME SIMULATION LOOP (DUAL MAP, 8s/10s TANK, CRASH PHYSICS)
// =========================================================================
populateTraffic(36);
let lastTime = performance.now();

function wrapAnglePi(rad) {
  return ((rad + Math.PI) % (Math.PI * 2) + (Math.PI * 2)) % (Math.PI * 2) - Math.PI;
}

function readAttitudeInput(isAirborne) {
  // Touch controls use the same key state as the keyboard and arrow aliases.
  const rollLeft = Boolean(keys['KeyJ'] || keys['ArrowLeft']);
  const rollRight = Boolean(keys['KeyL'] || keys['ArrowRight']);
  const pitchUp = Boolean(keys['KeyI'] || keys['ArrowUp']);
  const pitchDown = Boolean(keys['KeyK'] || keys['ArrowDown']);
  const yawLeft = isAirborne && Boolean(keys['KeyA']);
  const yawRight = isAirborne && Boolean(keys['KeyD']);
  return {
    rawRollInput: Number(rollLeft) - Number(rollRight),
    rawPitchInput: Number(pitchUp) - Number(pitchDown),
    rawYawInput: Number(yawLeft) - Number(yawRight),
    // Opposing held controls still count as player input, even if their torques cancel.
    hasManualAttitudeInput: rollLeft || rollRight || pitchUp || pitchDown || yawLeft || yawRight ||
      (isAirborne && Boolean(keys['KeyQ'] || keys['KeyE']))
  };
}

function advanceAttitudeIdle(dt, hasInput) {
  const previousIdle = state.attitudeIdleSeconds || 0;
  state.attitudeIdleSeconds = hasInput ? 0 : Math.min(2.0, previousIdle + dt);
  // Only apply the portion of this frame after the full two-second grace period.
  return hasInput || !state.autoStabilizer ? 0 : Math.min(dt, Math.max(0, previousIdle + dt - 2.0));
}

function updateSimulation(dt) {
  const t = I18N[currentLang];

  if (state.impactCooldown > 0) {
    state.impactCooldown = Math.max(0, state.impactCooldown - dt);
  }

  updateExplosions(dt);
  if (typeof updateTireSmokeParticles === 'function') {
    const scrollDz = (currentMap === 'highway' ? (-state.vz) * WORLD_SPEED_SCALE * dt : 0.0);
    updateTireSmokeParticles(dt, scrollDz);
  }

  if (state.isDestroyed) {
    debrisPieces.forEach((p) => {
      p.vy -= 22.0 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += p.rx * dt;
      p.mesh.rotation.y += p.ry * dt;
      p.mesh.rotation.z += p.rz * dt;
      if (p.mesh.position.y < 0.15) {
        p.mesh.position.y = 0.15;
        p.vy = -p.vy * 0.45;
        p.vx *= 0.82;
        p.vz *= 0.82;
      }
    });
    // Continue animating blasted traffic cars during explosion aftermath!
    trafficCars.forEach((car) => {
      if (car.blastTimer && car.blastTimer > 0) {
        car.blastTimer = Math.max(0, car.blastTimer - dt);
        car.mesh.position.x += car.blastVx * dt;
        car.mesh.position.z += car.blastVz * dt;
        car.y = (car.y || 0) + car.blastVy * dt;
        car.blastVy -= 22.0 * dt;
        if (car.y <= 0) {
          car.y = 0;
          car.blastVy = -car.blastVy * 0.42;
          car.blastVx *= Math.pow(0.25, dt);
          car.blastVz *= Math.pow(0.25, dt);
        }
        car.mesh.position.y = car.y;
        car.mesh.rotation.x += car.blastVPitch * dt;
        car.mesh.rotation.y += car.blastVYaw * dt;
        car.mesh.rotation.z += car.blastVRoll * dt;
      }
    });
    sound.update(0, false, false, true);
    document.getElementById('ui-flight-mode').textContent = t.modeDestroyed;
    document.getElementById('ui-flight-mode').className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-300';
    document.getElementById('val-hull-pct').textContent = '0%';
    document.getElementById('hull-bar-fill').style.width = '0%';
    return;
  }

  
  const isRealMode = (state.physicsMode === 'realistic');
  state.gasMassKg = Number((144.0 * (state.airRemaining / MAX_AIR_SECONDS)).toFixed(1));
  const currentVehicleMass = VEHICLE_MASS_KG + (state.gasMassKg || 0);
  const fuelBurnThrustFactor = (VEHICLE_MASS_KG + 144.0) / Math.max(1850.0, currentVehicleMass);
  let currentGroundAccel = 16.5;
  let currentAirAccel = 9.5;
  let currentLiftAccel = 8.2 * 1.3;   // +30% climb acceleration (10.66 m/s²)
  let currentMaxClimbVy = 6.2 * 1.3;  // +30% Space climb speed (8.06 m/s)
  let tireScreechIntensity = 0.0;

  let groundElevation = 0.0;
  if (currentMap === 'city') {
    for (let i = 0; i < cityBuildings.length; i++) {
      const b = cityBuildings[i];
      if (state.x > b.minX - 1.1 && state.x < b.maxX + 1.1 && state.z > b.minZ - 1.8 && state.z < b.maxZ + 1.8) {
        if (state.y >= b.height - 0.55) {
          groundElevation = Math.max(groundElevation, b.height);
        }
      }
    }
  }
  const isAirborne = (state.y - groundElevation) > 0.15;
  const { rawRollInput, rawPitchInput, rawYawInput, hasManualAttitudeInput } = readAttitudeInput(isAirborne);
  const stabilizerDt = advanceAttitudeIdle(dt, hasManualAttitudeInput || !isAirborne);

  // Unified COPV Air Tank Consumption Helper (Requirement 3: ALL airborne thrusters & ';' rear boost consume tank)
  function consumeAirTank(amount, airborneNow) {
    if (amount <= 0 || state.isFreefalling || state.airRemaining <= 0) return false;
    state.airRemaining = Math.max(0.0, state.airRemaining - amount);
    state.airUsedContinuous = MAX_AIR_SECONDS - state.airRemaining;
    if (state.airRemaining <= 0.001) {
      state.airRemaining = 0.0;
      state.airUsedContinuous = MAX_AIR_SECONDS;
      state.isFreefalling = true;
      state.isAutoDescending8s = false;
      state.isAltitudeHold = false;
      state.isJumping6m = false;
      if (airborneNow) {
        state.vy = Math.min(-12.0, state.vy - 10.0);
      }
      showBanner('freefall', 3.5);
      sound.speakAlert('freefall', 'Critical alert: compressed air depleted. Immediate freefall!', '严重警报：冷气推进剂耗尽，进入自由落体！');
      return false;
    } else if (state.airUsedContinuous >= AUTO_DESCENT_USED_SECONDS && airborneNow) {
      if (!state.isAutoDescending8s) {
        state.isAutoDescending8s = true;
        showBanner('8s', 2.4);
        sound.speakAlert('8s', 'Warning: Low tank pressure. Auto-descent engaged.', '警告：气瓶压力低于百分之二十，自动下降已启动。');
      }
    }
    return true;
  }

  let canUseRCS = !state.isFreefalling && state.airRemaining > 0.005;

  // Requirement 4: ';' (Semicolon) triggers Rear Cold-Gas Rocket Boost in Realistic (Standard) mode!
  const isRearBoostKey = Boolean(keys['Semicolon']);
  const isThrottleW = Boolean(keys['KeyW']);
  const isAccelerating = isThrottleW || (isRearBoostKey && canUseRCS);

  // Set mode-specific dynamic limits (calibrated to 0-100 km/h in 1.9s & venue scale)
  if (isRealMode) {
    if (state.insaneMode || (isRearBoostKey && canUseRCS)) {
      // Plaid mode or ';' Rear Rocket Boost: unlocks up to 370 km/h (= 102.78 m/s) & 38 m/s² rocket thrust
      state.maxSpeed = 370.0 / 3.6;
      currentGroundAccel = 38.0;
      state.airMaxSpeed = 52.0;
      currentAirAccel = 24.0;
    } else {
      // Standard EV mode: 0-100 km/h 1.9s pure electric drive, capped at 200 km/h (= 55.56 m/s)
      state.maxSpeed = 200.0 / 3.6;
      currentGroundAccel = 16.5;
      state.airMaxSpeed = 31.5;
      currentAirAccel = 9.5;
    }
    currentLiftAccel = 8.2 * 1.3;
    currentMaxClimbVy = 6.2 * 1.3;
  } else {
    // 幻想模式 (Fantasy Mode) - 加速大幅提升:
    // 地面极速提高至 576 km/h (160 m/s)，空中最高 260 m/s
    // 默认纯电驱动加速度大幅提高至 72.0 m/s² (0-100 仅需约 0.38s)
    state.maxSpeed = 160.0;
    state.airMaxSpeed = 260.0;
    currentGroundAccel = 72.0;
    currentAirAccel = 92.0;
    currentLiftAccel = 48.0 * 1.3;
    currentMaxClimbVy = 36.0 * 1.3;
  }

  // Requirement 1 & 2:
  // • When throttle (W or ;) and foot brake (H) / reverse (S) are pressed simultaneously, execute throttle and ignore foot brake/reverse.
  // • Handbrake (B) MUST work even when throttle (W) is held ("不松油门的情况下目前手刹无法正常使用")!
  const isFootBraking = Boolean(keys['KeyH']) && !isAccelerating;
  const isReversing = Boolean(keys['KeyS']) && !isAccelerating;
  const isHandbraking = Boolean(keys['KeyU']);
  const isAirBrakingActive = isFootBraking || (isAirborne && isReversing);
  state.dragCoeffCd = isAirBrakingActive ? 0.72 : ((state.y > 0.2 || Math.abs(state.speed) > 33.0) ? 0.44 : 0.34);

  // Determine if the 4 Rear SpaceX Cold-Gas Nozzles are firing this frame:
  // 用户要求: "在空中飞行的时候，按W需要喷气，地上的W不喷气"
  // • 空中 (isAirborne === true): 按下 W 或 ; 均启动尾部冷气推进器喷气加速并消耗气瓶
  // • 地面 (isAirborne === false): 按下 W 仅使用纯电驱动（不喷气），按下 ; 才触发尾部火箭喷气
  let isRearThrusterFiring = false;
  if (canUseRCS) {
    if (isAirborne && (isThrottleW || isRearBoostKey)) {
      const airBurnRate = isRearBoostKey ? 0.85 : 0.65;
      isRearThrusterFiring = consumeAirTank(airBurnRate * dt, true);
    } else if (!isAirborne && isRearBoostKey) {
      isRearThrusterFiring = consumeAirTank(0.85 * dt, false);
    }
  }
  canUseRCS = !state.isFreefalling && state.airRemaining > 0.005;

  // Ground steering uses A / D only (J / L are exclusively Roll!)
  const steerLeft = Boolean(keys['KeyA']);
  const steerRight = Boolean(keys['KeyD']);
  const lateralInput = isAirborne ? 0 : ((steerRight ? 1 : 0) - (steerLeft ? 1 : 0));

  // Progressive steering rack smoothing for natural ground steering feel
  const steerRate = lateralInput !== 0 ? 8.0 : 11.0;
  state.steerInput = (state.steerInput || 0) + (lateralInput - (state.steerInput || 0)) * Math.min(1.0, steerRate * dt);
  if (Math.abs(state.steerInput) < 0.004 && lateralInput === 0) state.steerInput = 0.0;
  state.steerAngle = -state.steerInput * 0.38;
  frontWheelSteerGroups.forEach(g => { g.rotation.y = state.steerAngle; });

  // Requirement 2 & 3: In mid-air, Q / E controls lateral body movement AND consumes COPV air tank!
  const wantsAirJetLeft = isAirborne && Boolean(keys['KeyQ']);
  const wantsAirJetRight = isAirborne && Boolean(keys['KeyE']);
  let airJetLeft = false;
  let airJetRight = false;
  if ((wantsAirJetLeft || wantsAirJetRight) && canUseRCS) {
    if (consumeAirTank(0.45 * dt, true)) {
      airJetLeft = wantsAirJetLeft;
      airJetRight = wantsAirJetRight;
    }
  }
  canUseRCS = !state.isFreefalling && state.airRemaining > 0.005;

  // Car nose 3D unit vector in world space (Requirement 5: Rear thruster accelerates in NOSE direction, not camera direction)
  const noseHorizX = -Math.sin(state.yaw);
  const noseHorizZ = -Math.cos(state.yaw);
  const rightHorizX = Math.cos(state.yaw);
  const rightHorizZ = -Math.sin(state.yaw);
  const nosePitchCos = Math.cos(state.pitch);
  const nosePitchSin = Math.sin(state.pitch);

  if (isAirborne) {
    state.isDrifting = false;
    state.wasHandbraking = false;
    state.driftAngle = 0.0;
    // Preserve world-space momentum throughout flips; only thrust changes its direction.
    if (isRearThrusterFiring) {
      const boostAirAccel = currentMap === 'city' && !isRealMode ? 145.0 : currentAirAccel;
      state.vx += noseHorizX * nosePitchCos * boostAirAccel * dt;
      state.vz += noseHorizZ * nosePitchCos * boostAirAccel * dt;
      const maxAirVy = currentMaxClimbVy * 1.35;
      state.vy = Math.min(maxAirVy, state.vy + boostAirAccel * nosePitchSin * 0.55 * dt);
      const horizMag = Math.hypot(state.vx, state.vz);
      if (horizMag > state.airMaxSpeed) {
        state.vx *= state.airMaxSpeed / horizMag;
        state.vz *= state.airMaxSpeed / horizMag;
      }
    } else {
      const horizMag = Math.hypot(state.vx, state.vz);
      const isAirBrake = isFootBraking || isReversing;
      const airStallDecel = 15.5 + 0.0085 * horizMag * horizMag;
      const nextMag = isAirBrake
        ? (canUseRCS ? Math.max(0, horizMag - 38.0 * dt) : horizMag)
        : Math.max(0, horizMag * Math.pow(0.45, dt) - airStallDecel * dt);
      const coastScale = horizMag > 0 ? nextMag / horizMag : 0;
      state.vx *= coastScale;
      state.vz *= coastScale;
    }

    // Q/E and roll drift retain their responsive lateral assist without rebuilding forward momentum.
    const jetDir = (airJetRight ? 1 : 0) - (airJetLeft ? 1 : 0);
    const targetStrafe = jetDir * 18.0 + Math.sin(state.roll) * (currentMap === 'highway' ? 12.0 : 10.0);
    const strafeRate = currentMap === 'highway' ? (isRearThrusterFiring ? 10.0 : 6.5) : 6.0;
    const lateralSpeed = state.vx * rightHorizX + state.vz * rightHorizZ;
    const strafeChange = Math.abs(targetStrafe) > 0.001
      ? (targetStrafe - lateralSpeed) * Math.min(1.0, strafeRate * dt)
      : 0;
    state.vx += rightHorizX * strafeChange;
    state.vz += rightHorizZ * strafeChange;
    state.airStrafeSpeed = lateralSpeed + strafeChange;
    state.speed = Math.hypot(state.vx, state.vz);
  } else {
    if (state.wasAirborne) {
      // Hand inertial flight velocity back to the existing signed ground-drive convention.
      const forwardVelocity = state.vx * noseHorizX + state.vz * noseHorizZ;
      state.speed = (forwardVelocity >= 0 ? 1 : -1) * Math.hypot(state.vx, state.vz);
    }
    state.airStrafeSpeed = 0.0;
  }
  state.wasAirborne = isAirborne;

  if (currentMap === 'highway') {
    if (!isAirborne) {
      // Ground mode on highway
      if (isAccelerating) {
        const effAccel = isRearThrusterFiring ? (isRealMode ? 38.0 * fuelBurnThrustFactor : 120.0 * fuelBurnThrustFactor) : (isHandbraking ? currentGroundAccel * 0.88 : currentGroundAccel);
        if (state.speed < -0.5) {
          state.speed = Math.min(0.0, state.speed + 38.0 * dt);
        } else {
          state.speed = Math.min(state.maxSpeed, state.speed + effAccel * dt);
        }
      } else if (isFootBraking) {
        if (state.speed > 0.1) {
          state.speed = Math.max(0.0, state.speed - 38.0 * dt);
        } else if (state.speed < -0.1) {
          state.speed = Math.min(0.0, state.speed + 38.0 * dt);
        } else {
          state.speed = 0.0;
        }
      } else if (isReversing) {
        if (state.speed > 0.3) {
          state.speed *= Math.pow(0.95, dt);
        } else {
          state.speed = Math.max(-15.0, state.speed - 16.0 * dt);
        }
      } else if (!isHandbraking) {
        // Gentle coasting resistance (releasing handbrake immediately stops handbrake deceleration)
        const cdEff = isAirBrakingActive ? 0.65 : 0.34;
        const aeroDecel = 0.00012 * (cdEff / 0.34) * (state.speed * state.speed);
        const rollDecel = 0.35;
        const coastDecel = (aeroDecel + rollDecel) * (state.speed >= 0 ? 1 : -1);
        if (state.speed > 0.1) {
          state.speed = Math.max(0.0, state.speed - coastDecel * dt);
        } else if (state.speed < -0.1) {
          state.speed = Math.min(0.0, state.speed - coastDecel * dt);
        } else {
          state.speed = 0.0;
        }
      }

      const speedFactor = THREE.MathUtils.clamp(Math.abs(state.speed) / 14.0, 0.0, 1.25);
      const turnSign = state.speed >= -0.1 ? 1 : -1;

      // Fix Issue 1: Handbrake (U) breaks rear tire lateral grip for smooth drift without abrupt dead-stop,
      // and immediately stops decelerating the instant U is released!
      if (isHandbraking && Math.abs(state.speed) > 1.5) {
        state.wasHandbraking = true;
        if (lateralInput !== 0 || Math.abs(state.driftAngle) > 0.04) {
          state.isDrifting = true;
          const targetSlip = -state.steerInput * 0.58 * turnSign;
          state.driftAngle += (targetSlip - state.driftAngle) * 8.5 * dt;
          state.yaw = state.driftAngle;
          state.vYaw = 0.0;
          const driftSlideVx = state.steerInput * Math.min(22.0, Math.abs(state.speed) * 0.56);
          const noseThrustVx = isRearThrusterFiring ? (noseHorizX * state.speed * 0.85) : (noseHorizX * state.speed * 0.48);
          state.vx += (driftSlideVx + noseThrustVx - state.vx) * 9.5 * dt;
          if (!isAccelerating) {
            // Very light tire-scrub (~1.2 m/s²) so handbrake never locks/stops the car
            state.speed = Math.max(0.0, state.speed - 1.2 * dt);
          }
        } else {
          state.isDrifting = false;
          state.driftAngle *= Math.pow(0.05, dt);
          if (!isAccelerating) {
            state.speed = Math.max(0.0, state.speed - 1.2 * dt);
          }
        }
      } else {
        state.isDrifting = false;
        state.wasHandbraking = false;
        state.driftAngle *= Math.pow(0.005, dt);
        const targetHwyYaw = -state.steerInput * 0.16 * turnSign * Math.min(1.0, speedFactor);
        state.yaw += (targetHwyYaw - state.yaw) * 12.0 * dt;
        state.vYaw = 0.0;
        const targetVx = isRearThrusterFiring
          ? (noseHorizX * state.speed)
          : (state.steerInput * 13.5 * speedFactor + noseHorizX * state.speed * 0.35);
        state.vx += (targetVx - state.vx) * 14.0 * dt;
      }
      state.vz = noseHorizZ * state.speed;
    }

    state.x += state.vx * dt;
    state.z = 0;

    const halfRoad = ROAD_WIDTH / 2 - 1.25;
    if (state.x < -halfRoad || state.x > halfRoad) {
      const hitSpeed = Math.abs(state.vx) + Math.abs(state.speed) * 0.22;
      state.x = THREE.MathUtils.clamp(state.x, -halfRoad, halfRoad);
      if (state.y < 1.2 && hitSpeed > 12.0) {
        triggerPhysicsCollision(hitSpeed, 'crashReasonThreshold', state.x < 0 ? 6.5 : -6.5, 1.2, 0);
      }
      const isSteeringIntoRail = (state.x <= -halfRoad && state.steerInput < -0.05) || (state.x >= halfRoad && state.steerInput > 0.05);
      if (isSteeringIntoRail) {
        state.vx = 0.0;
      } else {
        state.vx = (state.x < 0 ? 1 : -1) * Math.min(2.5, Math.abs(state.vx) * 0.25);
      }
      if (isAirborne) {
        const horizontalSpeed = Math.hypot(state.vx, state.vz);
        const railScale = horizontalSpeed > 0 ? Math.max(0, horizontalSpeed - 8.0 * dt) / horizontalSpeed : 0;
        state.vx *= railScale;
        state.vz *= railScale;
        state.speed = Math.hypot(state.vx, state.vz);
      } else {
        state.speed = Math.max(0.0, state.speed - 8.0 * dt);
      }
      state.yaw *= Math.pow(0.04, dt);
    }
  } else {
    // City Open-World Mode: True 2D Velocity Vector + Momentum-Preserving Handbrake Drift
    if (!isAirborne) {
      state.airStrafeSpeed = 0.0;
      let vForward = state.vx * noseHorizX + state.vz * noseHorizZ;
      let vLateral = state.vx * rightHorizX + state.vz * rightHorizZ;
      const totalGroundSpd = Math.hypot(vForward, vLateral);
      const forwardSign = (vForward >= -0.5 || state.speed >= -0.2) ? 1 : -1;
      let signedSpd = forwardSign * totalGroundSpd;

      if (isHandbraking && totalGroundSpd > 1.5) {
        // Fix Issue 1: Momentum-preserving handbrake drift!
        // Preserves total speed magnitude instead of wiping out vLateral when yaw rotates,
        // so pulling the handbrake NEVER causes an abrupt dead stop!
        state.wasHandbraking = true;
        state.isDrifting = Math.abs(state.steerInput) > 0.04 || Math.abs(state.driftAngle) > 0.05;
        const turnDir = forwardSign;
        const pivotSpeedFactor = THREE.MathUtils.clamp(totalGroundSpd / 6.5, 0.35, 1.25);
        const handbrakeYawRate = state.steerInput * 3.85 * pivotSpeedFactor * turnDir;
        state.yaw -= handbrakeYawRate * dt;
        state.vYaw = 0.0;

        const targetSlip = state.steerInput * 0.55 * turnDir;
        state.driftAngle += (targetSlip - state.driftAngle) * 7.5 * dt;

        if (isRearThrusterFiring) {
          signedSpd = Math.min(state.maxSpeed, signedSpd + (isRealMode ? 38.0 : 120.0) * dt);
          state.driftAngle *= Math.pow(0.15, dt);
        } else if (isAccelerating) {
          signedSpd = Math.min(state.maxSpeed * 0.94, signedSpd + currentGroundAccel * 0.85 * dt);
        } else {
          // Very gentle tire-scrub (~1.2 m/s²) while coasting in handbrake drift
          if (signedSpd > 0) {
            signedSpd = Math.max(0.0, signedSpd - 1.2 * dt);
          } else {
            signedSpd = Math.min(0.0, signedSpd + 1.2 * dt);
          }
        }

        // Velocity vector points along (state.yaw + state.driftAngle), preserving full speed magnitude!
        const travelYaw = state.yaw + state.driftAngle;
        state.vx = -Math.sin(travelYaw) * signedSpd;
        state.vz = -Math.cos(travelYaw) * signedSpd;
        state.speed = signedSpd;
      } else {
        // The instant Handbrake (U) is released, transfer full totalGroundSpd cleanly into vForward
        // so zero momentum is lost and deceleration stops immediately!
        if (state.wasHandbraking) {
          vForward = signedSpd;
          vLateral = 0.0;
          state.wasHandbraking = false;
        }
        state.isDrifting = false;
        state.driftAngle *= Math.pow(0.005, dt);

        // Normal grippy Ackermann steering
        const absSpd = Math.abs(vForward);
        if (absSpd > 0.2) {
          const turnDir = vForward >= -0.1 ? 1 : -1;
          const lowSpeedFactor = THREE.MathUtils.clamp(absSpd / 7.5, 0.0, 1.0);
          const highSpeedDamp = 1.0 / (1.0 + absSpd * 0.015);
          const yawRate = state.steerInput * 2.35 * lowSpeedFactor * highSpeedDamp * turnDir;
          state.yaw -= yawRate * dt;
        }
        state.vYaw = 0.0;

        const newNoseX = -Math.sin(state.yaw);
        const newNoseZ = -Math.cos(state.yaw);
        const newRightX = Math.cos(state.yaw);
        const newRightZ = -Math.sin(state.yaw);

        if (isRearThrusterFiring) {
          vForward = Math.min(state.maxSpeed, vForward + (isRealMode ? 38.0 : 120.0) * dt);
          vLateral *= Math.pow(0.002, dt);
        } else if (isAccelerating) {
          if (vForward < -0.5) {
            vForward = Math.min(0.0, vForward + 38.0 * dt);
          } else {
            vForward = Math.min(state.maxSpeed, vForward + currentGroundAccel * dt);
          }
          vLateral *= Math.pow(0.004, dt);
        } else if (isFootBraking) {
          if (vForward > 0.1) {
            vForward = Math.max(0.0, vForward - 38.0 * dt);
          } else if (vForward < -0.1) {
            vForward = Math.min(0.0, vForward + 38.0 * dt);
          } else {
            vForward = 0.0;
          }
          vLateral *= Math.pow(0.004, dt);
        } else if (isReversing) {
          if (vForward > 0.3) {
            vForward *= Math.pow(0.95, dt);
          } else {
            vForward = Math.max(-15.0, vForward - 16.0 * dt);
          }
          vLateral *= Math.pow(0.004, dt);
        } else {
          // Gentle coasting resistance in open-world city
          const cdEff = isAirBrakingActive ? 0.65 : 0.34;
          const aeroDecel = 0.00012 * (cdEff / 0.34) * (vForward * vForward);
          const rollDecel = 0.35;
          const coastDecel = (aeroDecel + rollDecel) * (vForward >= 0 ? 1 : -1);
          if (vForward > 0.1) {
            vForward = Math.max(0.0, vForward - coastDecel * dt);
          } else if (vForward < -0.1) {
            vForward = Math.min(0.0, vForward - coastDecel * dt);
          } else {
            vForward = 0.0;
          }
          const wetFriction = (weatherIndex === 1 ? 0.65 : 0.004);
          vLateral *= Math.pow(wetFriction, dt);
        }

        state.vx = newNoseX * vForward + newRightX * vLateral;
        state.vz = newNoseZ * vForward + newRightZ * vLateral;
        state.speed = (vForward >= -0.1 ? 1 : -1) * Math.hypot(state.vx, state.vz);
      }
    }

    // Calibrate world traversal displacement to match venue scale (2400m city / 300m blocks)
    const moveScale = isAirborne ? 1.35 : WORLD_SPEED_SCALE;
    state.x += state.vx * moveScale * dt;
    state.z += state.vz * moveScale * dt;

    const limit = CITY_HALF_BOUND - 2.2;
    if (Math.abs(state.x) > limit || Math.abs(state.z) > limit) {
      const impactV = Math.abs(state.speed);
      state.x = THREE.MathUtils.clamp(state.x, -limit, limit);
      state.z = THREE.MathUtils.clamp(state.z, -limit, limit);
      state.vx *= -0.35;
      state.vz *= -0.35;
      state.speed = isAirborne ? Math.hypot(state.vx, state.vz) : state.speed * -0.35;
      state.yaw *= Math.pow(0.10, dt);
      if (impactV > 10.0) {
        triggerPhysicsCollision(impactV, 'crashReasonThreshold', isAirborne ? 0 : -state.vx * 0.4, 2.0, isAirborne ? 0 : -state.vz * 0.4);
      }
    }
  }

  const wantsHover = Boolean(keys['Space']);
  const wantsDescend = Boolean(keys['ShiftLeft'] || keys['ShiftRight']);
  let isLiftFiring = false;
  let isDescendFiring = false;

  // Recompute surface elevation after horizontal (x, z) movement
  groundElevation = 0.0;
  if (currentMap === 'city') {
    for (let i = 0; i < cityBuildings.length; i++) {
      const b = cityBuildings[i];
      if (state.x > b.minX - 1.1 && state.x < b.maxX + 1.1 && state.z > b.minZ - 1.8 && state.z < b.maxZ + 1.8) {
        if (state.y >= b.height - 0.55) {
          groundElevation = Math.max(groundElevation, b.height);
        }
      }
    }
  }

  const agl = state.y - groundElevation;
  if (agl > 5.0) state.hasTriggeredHelipad = false;
  const downSpeed = Math.max(0.0, -state.vy);
  const cosTiltNow = Math.cos(state.roll) * Math.cos(state.pitch);

  const SAFE_TOUCHDOWN_V = 4.0;
  const AUTO_BRAKE_ACCEL = 58.0;
  const kinematicStopDist = Math.max(0.0, (downSpeed * downSpeed - SAFE_TOUCHDOWN_V * SAFE_TOUCHDOWN_V) / (2.0 * AUTO_BRAKE_ACCEL));
  const minSafeBrakeAlt = Math.max(1.8, kinematicStopDist + downSpeed * dt + 0.45);

  // Auto-landing save must ONLY engage when vehicle is falling fast towards ground, NEVER when climbing or hovering!
  const isDescendingTowardsGround = state.vy < -3.5 && !wantsHover && !state.isAltitudeHold && !state.isJumping6m;
  const needsEmergencyLandingSave = (
    isDescendingTowardsGround &&
    agl > 0.02 &&
    agl <= minSafeBrakeAlt &&
    (state.airRemaining > 0.01 || state.isAutoLandingSave) &&
    !state.isFreefalling &&
    (downSpeed > 5.5 || state.isAutoLandingSave || (agl <= 3.0 && cosTiltNow < 0.55 && downSpeed > 2.5))
  );

  if (needsEmergencyLandingSave) {
    if (!state.isAutoLandingSave) {
      state.isAutoLandingSave = true;
      state.lastAutoSaveAlt = Math.max(2.2, agl);
      showBanner('autoland', 2.2);
      sound.speakAlert('autoland', 'Minimum braking altitude. Auto-landing thrusters engaged.', '已达极限安全高度，防坠毁自动喷气已启动。');
    }
    isLiftFiring = true;
    consumeAirTank(dt, true);
    // Smooth upward deceleration towards soft touchdown speed (-1.5 m/s)
    state.vy = Math.min(-1.5, state.vy + AUTO_BRAKE_ACCEL * dt);

    // Emergency braking still protects descent; attitude assist respects manual control and its grace period.
    if (stabilizerDt > 0) {
      const levelBlend = 1.0 - Math.exp(-10.0 * stabilizerDt);
      state.roll -= wrapAnglePi(state.roll) * levelBlend;
      state.pitch -= wrapAnglePi(state.pitch) * levelBlend;
      state.vRoll *= Math.pow(0.20, stabilizerDt);
      state.vPitch *= Math.pow(0.20, stabilizerDt);
    }
  } else {
    state.isAutoLandingSave = false;
    // Manual Space or Shift cancels automated 6m jump or altitude hold
    if (wantsHover || wantsDescend) {
      if (state.isJumping6m && wantsDescend) state.isJumping6m = false;
      if (state.isAltitudeHold) {
        state.isAltitudeHold = false;
        const nBadge = document.getElementById('key-n');
        if (nBadge) nBadge.classList.remove('active');
      }
    }

    if (state.isJumping6m && !state.isFreefalling && state.airRemaining > 0) {
      // Fix Issue 8: O key jumps to 6.0m at 2.5x Space climb speed and consumes 200% of the air
      // that normal SPACE climb requires to reach this same height!
      const jumpClimbVy = currentMaxClimbVy * 2.5;
      const jumpLiftAccel = currentLiftAccel * 2.5;
      const totalJumpH = Math.max(1.0, (state.jumpTargetY || 6.0) - (state.jumpStartY ?? 0.0));
      const dRampNormal = (currentMaxClimbVy * currentMaxClimbVy) / (2.0 * currentLiftAccel);
      const normalClimbAirSec = (totalJumpH <= dRampNormal)
        ? Math.sqrt((2.0 * totalJumpH) / currentLiftAccel)
        : ((currentMaxClimbVy / currentLiftAccel) + (totalJumpH - dRampNormal) / currentMaxClimbVy);
      const jumpTotalDuration = totalJumpH / jumpClimbVy;
      // Burn rate per second so the jump consumes 200% (2.0x) of normalClimbAirSec
      const jumpBurnRatePerSec = (2.0 * normalClimbAirSec) / Math.max(0.05, jumpTotalDuration);
      const nextVy = Math.min(jumpClimbVy, Math.max(jumpClimbVy * 0.92, state.vy + jumpLiftAccel * dt));
      const stepDt = (state.y + nextVy * dt >= state.jumpTargetY)
        ? Math.max(0.0, (state.jumpTargetY - state.y) / Math.max(0.1, nextVy))
        : dt;

      if (consumeAirTank(jumpBurnRatePerSec * stepDt, true)) {
        if (state.isAutoDescending8s) {
          state.isJumping6m = false;
          isLiftFiring = true;
          state.vy += (-3.2 - state.vy) * 6.0 * dt;
        } else {
          isLiftFiring = true;
          state.vy = nextVy;
          if (state.y + state.vy * dt >= state.jumpTargetY) {
            state.y = state.jumpTargetY;
            state.vy = 0.0;
            state.isJumping6m = false;
          }
        }
      } else {
        state.isJumping6m = false;
      }
    } else if (wantsHover && !state.isFreefalling && state.airRemaining > 0) {
      // Space climb speed & acceleration
      if (consumeAirTank(dt, true)) {
        if (state.isAutoDescending8s) {
          isLiftFiring = true;
          state.vy += (-3.2 - state.vy) * 6.0 * dt;
        } else {
          state.isAutoDescending8s = false;
          isLiftFiring = true;
          const maxAirVy = currentMaxClimbVy * 1.35;
          state.vy = Math.min(maxAirVy, state.vy + currentLiftAccel * dt);
        }
      }
    } else if ((state.isAltitudeHold || (agl > 0.15 && Boolean(keys['KeyN']))) && !state.isFreefalling && state.airRemaining > 0) {
      // Requirement 5: Mid-air N key holds current altitude with low continuous air consumption (0.22x rate)
      if (!state.isAltitudeHold) {
        state.isAltitudeHold = true;
        state.holdTargetY = state.y;
      }
      if (consumeAirTank(0.22 * dt, true)) {
        if (state.isAutoDescending8s) {
          isLiftFiring = true;
          state.vy += (-3.2 - state.vy) * 6.0 * dt;
        } else {
          isLiftFiring = true;
          const altError = state.holdTargetY - state.y;
          state.vy += (altError * 8.5 - state.vy * 9.5) * dt;
        }
      } else {
        state.isAltitudeHold = false;
      }
    } else {
      // Requirement 2: Realistic heavy sports car Earth gravity with true aerodynamic terminal velocity
      if (state.isFreefalling && agl > 0.01) {
        // True physical gravitational acceleration matching world visual speed scale
        const freefallG = 24.5;
        const dragAcc = 0.0025 * (state.vy * state.vy);
        state.vy -= (freefallG - dragAcc) * dt;
        state.vy = Math.max(-65.0, state.vy); // Terminal downward velocity ~234 km/h
      } else if (agl > 0.01) {
        // Normal unpowered descent when hover key is not pressed
        const normalG = 16.5;
        const dragAcc = 0.0035 * (state.vy * state.vy);
        state.vy -= (normalG - dragAcc) * dt;
        state.vy = Math.max(-42.0, state.vy);
      }
    }

    if (wantsDescend && agl > 0.02) {
      if (!state.isFreefalling && state.airRemaining > 0 && consumeAirTank(0.55 * dt, true)) {
        isDescendFiring = true;
        state.vy -= 18.5 * dt;
      }
    }
  }

  const prevY = state.y;
  const prevVy = state.vy;
  state.y += state.vy * dt;
  if (state.y > MAX_FLIGHT_ALTITUDE) {
    state.y = MAX_FLIGHT_ALTITUDE;
    state.vy = Math.min(0, state.vy);
  }

  if (state.y <= 0.0) {
    state.y = 0.0;
    const downImpactSpeed = -prevVy;
    if (downImpactSpeed > 0.8) {
      state.suspensionSquash = Math.min(0.048, downImpactSpeed * 0.0035);
      state.suspensionVelocity = downImpactSpeed * 0.004;
    }
    state.vy = 0.0;
    state.isAutoLandingSave = false;
    state.isJumping6m = false;
    if (state.isAltitudeHold) {
      state.isAltitudeHold = false;
      const nBadge = document.getElementById('key-n');
      if (nBadge) nBadge.classList.remove('active');
    }
    const cosTilt = Math.cos(state.roll) * Math.cos(state.pitch);
    if (downImpactSpeed > 15.5 || (downImpactSpeed > 7.5 && cosTilt < 0.25)) {
      const effectiveDv = downImpactSpeed * (cosTilt < 0.25 ? 1.85 : 1.15);
      triggerPhysicsCollision(effectiveDv, 'crashReasonGround', 0, 3.0, 0);
      if (state.isDestroyed) return;
    }

    // Only recharge on ground when NOT firing hover or ';' rear rocket thrusters
    if ((!wantsHover && !isRearThrusterFiring) || state.isFreefalling) {
      state.airRemaining = Math.min(MAX_AIR_SECONDS, state.airRemaining + 3.4 * dt);
      state.airUsedContinuous = MAX_AIR_SECONDS - state.airRemaining;
      if (state.airRemaining > 2.2) state.isAutoDescending8s = false;
      if (state.airRemaining >= 2.5 && !wantsHover) {
        state.isFreefalling = false;
      } else if (state.airRemaining >= 9.95) {
        state.isFreefalling = false;
      }
    }
  }

  // Requirement 3: All airborne attitude RCS jets (Roll, Pitch, Yaw) consume COPV air tank!
  canUseRCS = !state.isFreefalling && state.airRemaining > 0.005;
  let rollInput = 0;
  let pitchInput = 0;
  let yawInput = 0;
  if (canUseRCS && (rawRollInput !== 0 || rawPitchInput !== 0 || rawYawInput !== 0)) {
    const rcsBurn = (isAirborne ? 0.38 : 0.22) * dt;
    if (consumeAirTank(rcsBurn, isAirborne)) {
      rollInput = rawRollInput;
      pitchInput = rawPitchInput;
      yawInput = rawYawInput;
    }
  }
  canUseRCS = !state.isFreefalling && state.airRemaining > 0.005;

  const rcsAuthority = isAirborne ? 1.0 : 0.35;

  state.roll = wrapAnglePi(state.roll);

  if (canUseRCS && rollInput !== 0) {
    state.vRoll += rollInput * 3.6 * rcsAuthority * dt;
    if (isAirborne) {
      state.vx -= rollInput * 1.6 * dt;
    }
  } else if (!isAirborne) {
    // Progressive anti-roll bar suspension response to lateral G-forces and steering
    const latG = state.lateralG || 0.0;
    const speedLean = THREE.MathUtils.clamp(Math.abs(state.speed) / 22.0, 0.0, 1.0);
    const targetGroundRoll = (-state.steerInput * 0.048 * speedLean) + (latG * 0.012);
    state.roll += (targetGroundRoll - state.roll) * 11.0 * dt;
    state.vRoll = 0.0;
  } else if (stabilizerDt > 0) {
    // Shortest-path + angular-momentum-assisted roll self-righting
    const predictedRoll = wrapAnglePi(state.roll + state.vRoll * 0.28);
    state.vRoll += (-predictedRoll * 7.8 - state.vRoll * 4.5) * stabilizerDt;
  }

  if (canUseRCS && pitchInput !== 0) {
    state.vPitch += pitchInput * 3.2 * rcsAuthority * dt;
    if (isAirborne) {
      state.vy += pitchInput * 1.1 * dt;
    }
  } else if (stabilizerDt > 0 || !isAirborne) {
    // Use the nearest equivalent level attitude without unwinding completed flips.
    const pitchError = wrapAnglePi(state.pitch);
    state.vPitch += (-pitchError * 6.5 - state.vPitch * 4.2) * (isAirborne ? stabilizerDt : dt);
  }

  if (isAirborne) {
    if (canUseRCS && yawInput !== 0) {
      state.vYaw += yawInput * 2.2 * rcsAuthority * dt;
    } else {
      // Smoothly damp yaw rate when A/D is released in mid-air so nose stays where aimed
      state.vYaw *= Math.pow(0.06, dt);
    }
  }

  state.vRoll *= Math.pow(0.20, dt);
  state.vPitch *= Math.pow(0.20, dt);
  state.vYaw *= Math.pow(0.25, dt);

  state.roll = wrapAnglePi(state.roll + state.vRoll * dt);
  // Wing attitude assist follows the same delayed stabilizer as the RCS springs.
  if (pitchInput === 0 && (stabilizerDt > 0 || !isAirborne) && Math.abs(state.speed) > 28.0) {
    const aeroPitchStab = Math.min(3.5, Math.pow(Math.abs(state.speed) / 35.0, 2)) * 0.45;
    state.vPitch += (-wrapAnglePi(state.pitch) * aeroPitchStab) * (isAirborne ? stabilizerDt : dt);
  }
  // Keep pitch continuous through +/-180 and complete forward/backward 360-degree loops.
  // THREE renders the Euler angle directly; no Euler extraction or airborne pitch clamp is needed.
  state.pitch += state.vPitch * dt;
  state.yaw += state.vYaw * dt;

  const trueGroundAgl = Math.max(0.0, state.y - groundElevation);
  if (trueGroundAgl < 0.35) {
    const maxGroundPitch = THREE.MathUtils.lerp(0.14, 1.30, THREE.MathUtils.clamp(trueGroundAgl / 0.35, 0.0, 1.0));
    const groundPitch = wrapAnglePi(state.pitch);
    state.pitch += THREE.MathUtils.clamp(groundPitch, -maxGroundPitch, maxGroundPitch) - groundPitch;
    const maxGroundRoll = THREE.MathUtils.lerp(0.18, 3.14, THREE.MathUtils.clamp(trueGroundAgl / 0.35, 0.0, 1.0));
    state.roll = THREE.MathUtils.clamp(state.roll, -maxGroundRoll, maxGroundRoll);
    if (currentMap === 'highway' && trueGroundAgl < 0.15) {
      state.yaw = THREE.MathUtils.clamp(state.yaw, -0.85, 0.85);
    }
    state.accumulatedRoll = 0;
  } else {
    state.accumulatedRoll += Math.abs(state.vRoll * dt);
    if (state.accumulatedRoll >= Math.PI * 1.85) {
      state.accumulatedRoll = 0;
      state.score += 500;
      showBanner('stunt', 2.2);
      sound.beep(880, 0.18);
    }
  }

  if (currentMap === 'city') {
    for (let i = 0; i < cityBuildings.length; i++) {
      const b = cityBuildings[i];
      if (state.x > b.minX - 1.1 && state.x < b.maxX + 1.1 && state.z > b.minZ - 1.8 && state.z < b.maxZ + 1.8) {
        if (state.y > b.height + 0.08) {
          // Flying freely in the air above the building roof — do NOT teleport or snap down!
          continue;
        } else if (prevY >= b.height - 0.55 && state.y <= b.height + 0.08 && state.vy <= 0) {
          // Actually touching down onto or resting on the building roof
          const downImpactSpeed = -prevVy;
          if (downImpactSpeed > 0.8) {
            state.suspensionSquash = Math.min(0.048, downImpactSpeed * 0.0035);
            state.suspensionVelocity = downImpactSpeed * 0.004;
          }
          const cosTilt = Math.cos(state.roll) * Math.cos(state.pitch);
          state.y = b.height;
          state.vy = 0;
          state.isAutoLandingSave = false;
          state.isJumping6m = false;
          if (state.isAltitudeHold) {
            state.isAltitudeHold = false;
            const nBadge = document.getElementById('key-n');
            if (nBadge) nBadge.classList.remove('active');
          }

          if (downImpactSpeed > 15.5 || (downImpactSpeed > 7.5 && cosTilt < 0.25)) {
            const effectiveDv = downImpactSpeed * (cosTilt < 0.25 ? 1.85 : 1.15);
            triggerPhysicsCollision(effectiveDv, 'crashReasonGround', 0, 3.0, 0);
            if (state.isDestroyed) return;
          }

          const rechargeRate = b.isHelipad ? 10.0 : 4.0;
          state.airRemaining = Math.min(MAX_AIR_SECONDS, state.airRemaining + rechargeRate * dt);
          state.airUsedContinuous = MAX_AIR_SECONDS - state.airRemaining;
          state.isFreefalling = false;
          state.isAutoDescending8s = false;
          if (b.isHelipad && !state.hasTriggeredHelipad) {
            state.hasTriggeredHelipad = true;
            state.score += 300;
            showBanner('helipad', 2.8);
            sound.speakAlert('helipad', 'Helipad touchdown. Tank pressure restored to one hundred percent.', '停机坪降落成功，高压气瓶已补满。');
          }
        } else if (state.y < b.height - 0.55) {
          const impactSpeed = Math.hypot(state.vx, state.vz, state.vy * 0.5);
          const dLeft = Math.abs(state.x - (b.minX - 1.1));
          const dRight = Math.abs(state.x - (b.maxX + 1.1));
          const dFront = Math.abs(state.z - (b.minZ - 1.8));
          const dBack = Math.abs(state.z - (b.maxZ + 1.8));
          const minD = Math.min(dLeft, dRight, dFront, dBack);
          if (minD === dLeft) state.x = b.minX - 1.2;
          else if (minD === dRight) state.x = b.maxX + 1.2;
          else if (minD === dFront) state.z = b.minZ - 1.9;
          else state.z = b.maxZ + 1.9;

          if (isAirborne) {
            state.vx *= -0.3;
            state.vz *= -0.3;
            state.speed = Math.hypot(state.vx, state.vz);
          } else {
            state.speed *= -0.3;
          }
          triggerPhysicsCollision(Math.max(12, impactSpeed), 'crashReasonThreshold', isAirborne ? 0 : -state.vx * 0.5, 2.0, isAirborne ? 0 : -state.vz * 0.5);
          if (state.isDestroyed) return;
        }
      }
    }
  }

  const playerWorldZ = currentMap === 'highway' ? 0 : state.z;
  // 2nd-order critically damped suspension recovery: d^2y/dt^2 = -omega^2*y - 2*zeta*omega*v
  const omegaN = 18.0;
  // Asymmetric GT suspension damping: softer bump (0.78) to absorb impacts, stiffer rebound (1.15) to prevent bouncing
  const zeta = (state.suspensionVelocity > 0 ? 0.78 : 1.15);
  const suspAcc = -omegaN * omegaN * (state.suspensionSquash || 0) - 2.0 * zeta * omegaN * (state.suspensionVelocity || 0);
  state.suspensionVelocity = (state.suspensionVelocity || 0) + suspAcc * dt;
  state.suspensionSquash = Math.max(0.0, (state.suspensionSquash || 0) + state.suspensionVelocity * dt);
  if (state.suspensionSquash < 0.0005) {
    state.suspensionSquash = 0.0;
    state.suspensionVelocity = 0.0;
  }
  // High-speed aerodynamic downforce compression: compresses suspension springs when driving at speed
  const aeroSquashTarget = (!isAirborne && (state.downforceN || 0) > 400)
    ? Math.min(0.025, ((state.downforceN - 400) / 7500.0) * 0.025)
    : 0.0;
  state.aeroSquash = THREE.MathUtils.lerp(state.aeroSquash || 0.0, aeroSquashTarget, 8.0 * dt);
  const visualY = Math.max(groundElevation, state.y - (state.suspensionSquash || 0) - (state.aeroSquash || 0));
  playerWrapper.position.set(state.x, visualY, playerWorldZ);

  // Dynamic chassis weight transfer (Pitch Squat under acceleration & Dive under braking, plus roll under steering)
  let pitchSquat = 0.0;
  if (!isAirborne) {
    if (isAccelerating) {
      pitchSquat = isRearThrusterFiring ? 0.032 : 0.016;
    } else if (isFootBraking || isReversing) {
      pitchSquat = -0.026;
    }
  }
  const bodyRollTilt = !isAirborne ? (-state.steerInput * 0.032) : 0.0;
  roadsterAttitudeGroup.rotation.set(state.pitch + pitchSquat, state.yaw, state.roll + bodyRollTilt);

  // Dynamic Tire Drift Smoke Puffs & Brake Lockup Smoke
  if (!isAirborne && !state.isDestroyed && typeof spawnTireSmokePuff === 'function') {
    const isDriftingNow = state.isDrifting && Math.abs(state.speed) > 3.0;
    const isHardBrakingLockup = (isFootBraking || isHandbraking) && Math.abs(state.speed) > 14.0;
    if (isDriftingNow || isHardBrakingLockup) {
      state.tireSmokeTimer = (state.tireSmokeTimer || 0) + dt;
      if (state.tireSmokeTimer >= 0.036) {
        state.tireSmokeTimer = 0.0;
        const smokeIntensity = isDriftingNow
          ? Math.min(1.5, Math.abs(state.driftAngle) * 2.2 + 0.6)
          : (Math.abs(state.speed) / 38.0);
        if (currentMap === 'highway') {
          spawnTireSmokePuff(state.x - 0.86, 0.08, 1.38, state.vx, -state.speed * 0.4, smokeIntensity);
          spawnTireSmokePuff(state.x + 0.86, 0.08, 1.38, state.vx, -state.speed * 0.4, smokeIntensity);
        } else {
          const cosY = Math.cos(state.yaw);
          const sinY = Math.sin(state.yaw);
          const rz = 1.38;
          [-0.86, 0.86].forEach((rx) => {
            const wx = state.x + rx * cosY + rz * sinY;
            const wz = state.z - rx * sinY + rz * cosY;
            spawnTireSmokePuff(wx, 0.08, wz, state.vx * 0.4, state.vz * 0.4, smokeIntensity);
          });
        }
      }
    }
  }

  // Optimus Active Wing with Extreme Air-Brake Pitch (-0.72 rad / ~42°) on Foot Brake H
  // isAirBrakingActive already hoisted above
  const targetWingY = (state.y > 0.2 || isAccelerating) ? 0.94 : (isAirBrakingActive ? 0.96 : 0.79);
  const targetWingAngle = isAirBrakingActive ? -0.72 : ((state.y > 0.2) ? -0.28 : -0.05);
  activeWingGroup.position.y += (targetWingY - activeWingGroup.position.y) * 8 * dt;
  activeWingGroup.rotation.x += (targetWingAngle - activeWingGroup.rotation.x) * 8 * dt;

  // 4 Rear Nozzles Dynamic Gimbal Thrust-Vectoring (+/- 6° responsive pivot on pitch/yaw input)
  const targetGimbalPitch = THREE.MathUtils.clamp(-state.vPitch * 0.06 - (pitchInput * 0.10), -0.14, 0.14);
  const targetGimbalYaw = THREE.MathUtils.clamp(-state.vYaw * 0.05 - (yawInput * 0.10), -0.14, 0.14);
  rearNozzlesGimbalGroup.rotation.x += (targetGimbalPitch - rearNozzlesGimbalGroup.rotation.x) * 12 * dt;
  rearNozzlesGimbalGroup.rotation.y += (targetGimbalYaw - rearNozzlesGimbalGroup.rotation.y) * 12 * dt;

  // True kinematic wheel rotation matching calibrated world speed (v / wheelRadius)
  const wheelSpinSpeed = (state.speed * WORLD_SPEED_SCALE) / 0.335;
  wheels.forEach(w => { w.rotation.x -= wheelSpinSpeed * dt; });

  const isCockpitFpv = (cameraModeIndex === 3);
  const flicker = 0.82 + Math.random() * 0.36;
  const rearActive = isRearThrusterFiring;
  rearPlumes.forEach(p => {
    p.visible = rearActive && !isCockpitFpv;
    p.scale.set(1, flicker, 1);
  });
  liftPlumes.forEach(p => {
    p.visible = isLiftFiring && !isCockpitFpv;
    const powerScale = state.isAutoDescending8s ? 0.45 * flicker : 1.05 * flicker;
    p.scale.set(1, powerScale, 1);
  });
  descendPlumes.forEach(p => {
    p.visible = isDescendFiring && !isCockpitFpv;
    p.scale.set(1, flicker, 1);
  });

  // Mid-air retro braking (H or S when throttle W/; is not pressed) consumes COPV tank
  let isFrontRetroFiring = false;
  if (isAirborne && (isFootBraking || isReversing) && canUseRCS) {
    isFrontRetroFiring = consumeAirTank(0.55 * dt, true);
  }
  frontRetroPlumes.forEach(p => {
    p.visible = isFrontRetroFiring && !isCockpitFpv;
    p.scale.set(1, flicker, 1);
  });

  rcsPlumes.rollLeft.visible = !isCockpitFpv && canUseRCS && (rollInput > 0 || airJetLeft);
  rcsPlumes.rollRight.visible = !isCockpitFpv && canUseRCS && (rollInput < 0 || airJetRight);
  rcsPlumes.pitchUp.visible = !isCockpitFpv && canUseRCS && pitchInput > 0;
  rcsPlumes.pitchDown.visible = !isCockpitFpv && canUseRCS && pitchInput < 0;
  rcsPlumes.yawLeft.visible = !isCockpitFpv && canUseRCS && (yawInput > 0 || airJetLeft);
  rcsPlumes.yawRight.visible = !isCockpitFpv && canUseRCS && (yawInput < 0 || airJetRight);

  let activeCount = 0;
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`noz-${i}`);
    if (el) el.classList.toggle('firing', rearActive);
    if (rearActive) activeCount++;
  }
  for (let i = 5; i <= 8; i++) {
    const el = document.getElementById(`noz-${i}`);
    if (el) el.classList.toggle('firing', isLiftFiring);
    if (isLiftFiring) activeCount++;
  }
  const rcsRollPitchActive = canUseRCS && (rollInput !== 0 || pitchInput !== 0);
  const rcsYawRetroActive = (canUseRCS && (yawInput !== 0 || airJetLeft || airJetRight)) || isDescendFiring || isFrontRetroFiring;
  const noz9 = document.getElementById('noz-9');
  const noz10 = document.getElementById('noz-10');
  if (noz9) noz9.classList.toggle('firing', rcsRollPitchActive);
  if (noz10) noz10.classList.toggle('firing', rcsYawRetroActive);
  if (rcsRollPitchActive) activeCount++;
  if (rcsYawRetroActive) activeCount++;
  document.getElementById('val-active-nozzles').textContent = `${activeCount}${t.activeSuffix}`;

  // Highway road markings & arches scroll at calibrated world Z velocity (both forward & reverse wrap)
  if (currentMap === 'highway') {
    const scrollDz = (-state.vz) * WORLD_SPEED_SCALE * dt;
    scrollingProps.forEach(prop => {
      prop.position.z += scrollDz;
      if (prop.position.z > 420) {
        prop.position.z -= 840;
      } else if (prop.position.z < -420) {
        prop.position.z += 840;
      }
    });
  }

  trafficCars.forEach((car) => {
    if (car.mesh.userData.wheels) {
      const wRot = (car.speed * WORLD_SPEED_SCALE / 0.33) * dt;
      car.mesh.userData.wheels.forEach((w) => { w.rotation.x -= wRot; });
    }

    // Integrate Explosion Shockwave Blast Physics on Nearby Traffic Cars
    if (car.blastTimer && car.blastTimer > 0) {
      car.blastTimer = Math.max(0, car.blastTimer - dt);
      car.mesh.position.x += car.blastVx * dt;
      car.mesh.position.z += (currentMap === 'highway' ? (-state.vz - car.speed + car.blastVz) : car.blastVz) * dt;
      car.y = (car.y || 0) + car.blastVy * dt;
      car.blastVy -= 22.0 * dt;
      if (car.y <= 0.0) {
        car.y = 0.0;
        car.blastVy = -car.blastVy * 0.42;
        car.blastVx *= Math.pow(0.22, dt);
        car.blastVz *= Math.pow(0.22, dt);
        car.blastVRoll *= Math.pow(0.25, dt);
        car.blastVPitch *= Math.pow(0.25, dt);
        car.blastVYaw *= Math.pow(0.25, dt);
      }
      car.mesh.position.y = car.y;
      car.mesh.rotation.x += car.blastVPitch * dt;
      car.mesh.rotation.y += car.blastVYaw * dt;
      car.mesh.rotation.z += car.blastVRoll * dt;
      if (car.blastTimer <= 0.01) {
        car.y = 0.0;
        car.mesh.position.y = 0.0;
        car.mesh.rotation.x = 0.0;
        car.mesh.rotation.z = 0.0;
        if (currentMap === 'city' && typeof car.baseRotY === 'number') {
          car.mesh.rotation.y = car.baseRotY;
        }
      }
    } else if (currentMap === 'highway') {
      const relSpeed = (-state.vz - car.speed) * WORLD_SPEED_SCALE;
      car.mesh.position.z += relSpeed * dt;

      car.changeTimer -= dt;
      if (car.changeTimer <= 0) {
        car.changeTimer = 4 + Math.random() * 7;
        const dir = Math.random() < 0.5 ? -1 : 1;
        const nextLane = THREE.MathUtils.clamp(car.laneIdx + dir, 0, LANE_COUNT - 1);
        car.laneIdx = nextLane;
        car.targetX = LANE_CENTERS[nextLane];
      }
      const dxLane = car.targetX - car.mesh.position.x;
      car.mesh.position.x += dxLane * 3.0 * dt;
      car.mesh.rotation.y = -THREE.MathUtils.clamp(dxLane * 0.045, -0.14, 0.14);
      car.mesh.rotation.z = -THREE.MathUtils.clamp(dxLane * 0.025, -0.06, 0.06);
      car.vx = dxLane * 3.0;
      car.vz = -car.speed;

      if (car.mesh.position.z > 65) {
        car.mesh.position.z = -440 - Math.random() * 60;
        car.blastTimer = 0;
        car.blastVx = 0;
        car.blastVy = 0;
        car.blastVz = 0;
        car.y = 0;
        car.mesh.position.y = 0;
        car.mesh.position.x = car.targetX;
        car.mesh.rotation.x = 0;
        car.mesh.rotation.y = 0;
        car.mesh.rotation.z = 0;
        state.carsCleared += 1;
        state.score += state.y > 1.5 ? 25 : 10;
      } else if (car.mesh.position.z < -480) {
        car.mesh.position.z = 55;
      }
    } else {
      car.mesh.position.x += car.vx * WORLD_SPEED_SCALE * dt;
      car.mesh.position.z += car.vz * WORLD_SPEED_SCALE * dt;
      if (car.mesh.position.x > CITY_HALF_BOUND - 10) car.mesh.position.x = -CITY_HALF_BOUND + 10;
      if (car.mesh.position.x < -CITY_HALF_BOUND + 10) car.mesh.position.x = CITY_HALF_BOUND - 10;
      if (car.mesh.position.z > CITY_HALF_BOUND - 10) car.mesh.position.z = -CITY_HALF_BOUND + 10;
      if (car.mesh.position.z < -CITY_HALF_BOUND + 10) car.mesh.position.z = CITY_HALF_BOUND - 10;
    }

    const dx = Math.abs(state.x - car.mesh.position.x);
    const dz = Math.abs(playerWorldZ - car.mesh.position.z);
    const clearanceY = state.y - car.height;

    if (dx < 1.85 && dz < (car.length / 2 + 2.15)) {
      if (clearanceY >= -0.15 && clearanceY < 1.1) {
        if (state.vy < -18.0) {
          triggerPhysicsCollision(Math.abs(state.vy), 'crashReasonThreshold', 0, 5.0, 0);
        } else if (state.vy < 0 && clearanceY < 0.15) {
          state.y = car.height + 0.15;
          state.vy = 5.5;
          sound.beep(520, 0.08);
        }
      } else if (clearanceY < -0.15) {
        const relVx = state.vx - (car.vx || 0);
        const relVz = state.vz - (car.vz || 0);
        const deltaV = Math.hypot(relVx, relVz, state.vy * 0.5);

        if (currentMap === 'highway') {
          car.mesh.position.z -= 8.0;
          if (isAirborne) {
            const horizontalSpeed = Math.hypot(state.vx, state.vz);
            const reducedSpeed = Math.min(horizontalSpeed, Math.max(14.0, horizontalSpeed * 0.58));
            const collisionScale = horizontalSpeed > 0 ? reducedSpeed / horizontalSpeed : 0;
            state.vx *= collisionScale;
            state.vz *= collisionScale;
            state.speed = Math.hypot(state.vx, state.vz);
          } else {
            state.speed = Math.max(14.0, state.speed * 0.58);
          }
        } else {
          car.mesh.position.x += Math.sign(car.mesh.position.x - state.x || 1) * 5.0;
          car.mesh.position.z += Math.sign(car.mesh.position.z - state.z || 1) * 5.0;
          if (isAirborne) {
            state.vx *= -0.35;
            state.vz *= -0.35;
            state.speed = Math.hypot(state.vx, state.vz);
          } else {
            state.speed *= -0.35;
          }
        }

        const pushX = Math.sign(state.x - car.mesh.position.x || 1) * 7.5;
        triggerPhysicsCollision(deltaV, 'crashReasonThreshold', pushX, 2.2, 0);
      }
    }
  });

  // Calculate Real-Time G-Forces, Tire Screech, Sonic Boom & Yoke Rotation
  const accelMs2 = (state.speed - (state.prevSpeed || state.speed)) / Math.max(0.001, dt);
  state.prevSpeed = state.speed;
  state.longitudinalG = THREE.MathUtils.lerp(state.longitudinalG || 0, -accelMs2 / 9.81, 10 * dt);
  const latAccel = isAirborne ? (Math.sin(state.roll) * 18.0 + state.vYaw * 12.0) : (-state.steerAngle * Math.abs(state.speed) * 0.85);
  state.lateralG = THREE.MathUtils.lerp(state.lateralG || 0, latAccel / 9.81, 10 * dt);

  // Rotate 3D Tesla Yoke Steering Wheel in real time with steering & aerial roll
  if (typeof yokeWheelGroup !== 'undefined') {
    const targetYokeRot = state.steerAngle * 1.55 - (isAirborne ? rollInput * 0.42 : 0);
    yokeWheelGroup.rotation.z += (targetYokeRot - yokeWheelGroup.rotation.z) * 14 * dt;
  }

  const totalAirSpeedMs = isAirborne ? Math.hypot(state.speed, state.vy * 0.45) : Math.abs(state.speed);
  const mph = Math.round(totalAirSpeedMs * 2.23694);
  const kmh = Math.round(totalAirSpeedMs * 3.6);
  const isSupersonic = mph >= 230;

  // Update Yoke Shift LEDs
  if (typeof yokeShiftLeds !== 'undefined' && yokeShiftLeds.length > 0) {
    const speedRatio = Math.abs(state.speed) / Math.max(1, state.maxSpeed);
    yokeShiftLeds.forEach((led, idx) => {
      const threshold = (idx + 1) / 7.5;
      if (speedRatio >= threshold) {
        led.material.color.setHex(led.userData.activeColor);
      } else {
        led.material.color.setHex(0x1e293b);
      }
    });
  }

  // Speed Milestone Tracking & Telemetry Audio Chimes
  const currentSpeedKmh = kmh;
  if (currentSpeedKmh >= 370 && (state.speedMilestone || 0) < 370) {
    state.speedMilestone = 370;
    sound.playMilestoneChime();
    showBanner('milestone370', 2.8);
  } else if (currentSpeedKmh >= 300 && (state.speedMilestone || 0) < 300) {
    state.speedMilestone = 300;
    sound.playMilestoneChime();
    showBanner('milestone300', 2.5);
  } else if (currentSpeedKmh >= 200 && (state.speedMilestone || 0) < 200) {
    state.speedMilestone = 200;
    sound.playMilestoneChime();
    showBanner('milestone200', 2.5);
  } else if (currentSpeedKmh >= 100 && (state.speedMilestone || 0) < 100) {
    state.speedMilestone = 100;
    sound.playMilestoneChime();
    showBanner('milestone100', 2.5);
  } else if (currentSpeedKmh < 40 && (state.speedMilestone || 0) > 0) {
    state.speedMilestone = 0;
  }


  // Dynamic Carbon-Ceramic Brake Rotor Thermal Heat & Optical Red Glow
  const isHeavyBraking = (isFootBraking || isHandbraking) && Math.abs(state.speed) > 4.0;
  const targetBrakeHeat = isHeavyBraking ? Math.min(1.0, (Math.abs(state.speed) / 45.0) * (isFootBraking ? 1.0 : 0.65)) : 0.0;
  const heatRiseRate = isHeavyBraking ? 4.8 : 0.38;
  state.brakeHeat = THREE.MathUtils.lerp(state.brakeHeat || 0, targetBrakeHeat, heatRiseRate * dt);

  if (typeof rotorMat !== 'undefined') {
    if (state.brakeHeat > 0.03) {
      const glowR = THREE.MathUtils.clamp(state.brakeHeat * 1.5, 0.0, 1.0);
      const glowG = THREE.MathUtils.clamp(state.brakeHeat * 0.38, 0.0, 1.0);
      rotorMat.emissive.setRGB(glowR, glowG * 0.32, 0.0);
      rotorMat.emissiveIntensity = state.brakeHeat * 2.0;
    } else {
      rotorMat.emissive.setRGB(0, 0, 0);
      rotorMat.emissiveIntensity = 0.0;
    }
  }

  // Active Hydraulic Rear Wing Air-Brake Actuator Audio Servo
  if (isAirBrakingActive && Math.abs(state.speed) > 22.0 && !state.wasAirBraking) {
    state.wasAirBraking = true;
    sound.playAirBrakeServo();
  } else if (!isAirBrakingActive) {
    state.wasAirBraking = false;
  }

  // Dynamic Tire Thermal Modeling & Temperature Evolution
  const isDriftFriction = state.isDrifting || isHandbraking;
  const isHardBraking = isFootBraking && state.speed > 5.0;
  const targetTireTemp = isDriftFriction ? 92.0 : (isHardBraking ? 82.0 : (Math.abs(state.speed) > 40.0 ? 68.0 : 38.0));
  const heatRate = (isDriftFriction || isHardBraking) ? 14.0 : 3.5;
  const coolRate = (weatherIndex === 1 ? 5.5 : 2.5);
  if (state.tireTemp < targetTireTemp) {
    state.tireTemp = THREE.MathUtils.lerp(state.tireTemp || 35.0, targetTireTemp, heatRate * dt * 0.1);
  } else {
    state.tireTemp = THREE.MathUtils.lerp(state.tireTemp || 35.0, targetTireTemp, coolRate * dt * 0.1);
  }

  // Pacejka formulation for thermal friction coefficient with downforce adhesion bonus:
  const curTireTemp = state.tireTemp || 35.0;
  const thermalMu = 0.92 + 0.23 * Math.exp(-Math.pow((curTireTemp - 82.0) / 28.0, 2));
  const downforceBonus = Math.min(0.24, ((state.downforceN || 0) / 5500.0) * 0.24);
  state.tireGripMu = Number((thermalMu + downforceBonus).toFixed(2));

  // Dynamic Aerodynamic Downforce (Active Rear Wing + Venturi Ground-Effect Suction Fans)
  const wingCl = isAirBrakingActive ? 0.72 : ((state.y > 0.2) ? 0.48 : 0.24);
  const wingDownforce = 0.5 * 1.225 * wingCl * 1.64 * (state.speed * state.speed);
  const trueRideHeight = Math.max(0.0, state.y - groundElevation);
  // Ground effect suction decays inversely with ride height squared
  const groundProximity = 1.0 / (1.0 + 9.0 * trueRideHeight * trueRideHeight);
  const groundEffectN = (Math.abs(state.speed) > 4.0) ? (4200.0 * groundProximity) : 0.0;
  state.downforceN = Math.round(wingDownforce + groundEffectN);

    // Trigger Supersonic Sonic Boom & Mach Vapor Cone when crossing 230 MPH!
  if (isSupersonic && !state.wasSupersonic) {
    state.wasSupersonic = true;
    state.score += 400;
    state.cameraShake = Math.max(state.cameraShake, 0.38);
    sound.playSonicBoom();
    sound.speakAlert('sonicboom', 'Supersonic velocity reached. Mach shock cone active.', '已突破超音速音障，激波云环已激活。');
    showBanner('sonic', 2.8);
  } else if (mph < 215) {
    state.wasSupersonic = false;
  }

  if (typeof sonicBoomConeGroup !== 'undefined') {
    sonicBoomConeGroup.visible = isSupersonic && !isCockpitFpv;
    if (isSupersonic && !isCockpitFpv) {
      const pulse = 0.92 + Math.sin(performance.now() * 0.025) * 0.14;
      sonicBoomConeGroup.scale.set(pulse, pulse, 1.0 + Math.random() * 0.15);
    }
  }

  // Requirement 5: Left/right ground steering sound removed completely
  tireScreechIntensity = 0.0;

  // Update 3D Rain Particles & Lightning Thunder in Cyber Neon Rain (weatherIndex === 1)
  if (weatherIndex === 1 && rainLinesMesh.visible) {
    rainLinesMesh.position.set(state.x, Math.max(0, state.y - 20), playerWorldZ);
    const posAttr = rainLinesMesh.geometry.attributes.position;
    const arr = posAttr.array;
    const slantZ = (currentMap === 'highway' ? -state.vz : state.vz) * 0.04;
    for (let i = 0; i < rainCount; i++) {
      let ry = arr[i * 6 + 1] - 62.0 * dt;
      if (ry < 0) ry += 90.0;
      arr[i * 6 + 1] = ry;
      arr[i * 6 + 4] = ry - 2.8;
      arr[i * 6 + 5] = arr[i * 6 + 2] + slantZ;
    }
    posAttr.needsUpdate = true;

    state.lightningTimer -= dt;
    if (state.lightningTimer <= 0) {
      state.lightningTimer = 7.0 + Math.random() * 9.0;
      state.lightningFlash = 1.0;
      sound.playThunder();
    }
  }
  if (state.lightningFlash > 0) {
    state.lightningFlash = Math.max(0, state.lightningFlash - dt * 3.2);
  }

  // Requirement 7: Constant 60° FOV and zero camera zoom/flicker in Cockpit FPV
  const isAnyThrust = isLiftFiring || rearActive || isFrontRetroFiring;
  if (camera.fov !== 60) {
    camera.fov = 60;
    camera.updateProjectionMatrix();
  }

  const targetShake = isCockpitFpv
    ? 0.0
    : ((isAnyThrust ? 0.025 : 0.0) + (isSupersonic ? 0.032 : 0.0) + (state.impactCooldown > 0 ? 0.14 : 0.0));
  state.cameraShake = isCockpitFpv ? 0.0 : THREE.MathUtils.lerp(state.cameraShake || 0, targetShake, 12 * dt);
  const shakeX = (Math.random() - 0.5) * state.cameraShake;
  const shakeY = (Math.random() - 0.5) * state.cameraShake;
  const shakeZ = (Math.random() - 0.5) * state.cameraShake;

  // Reset camera.up unless in 6-DOF Cockpit FPV
  camera.up.set(0, 1, 0);
  // Fix Issue 5: Dynamically scale camera.near with altitude in 3rd-person views so depth buffer
  // precision remains ultra-crisp at 30m–380m altitude and completely prevents ground Z-fighting!
  const desiredNear = isCockpitFpv
    ? 0.08
    : THREE.MathUtils.clamp(0.38 + Math.max(0.0, state.y) * 0.045, 0.38, 3.2);
  if (Math.abs(camera.near - desiredNear) > 0.02) {
    camera.near = desiredNear;
    camera.updateProjectionMatrix();
  }
  roadsterCanopyMesh.visible = !isCockpitFpv;
  if (typeof hudCombinerMesh !== "undefined") hudCombinerMesh.visible = false;

  if (cameraModeIndex === 1) {
    // 3D Showroom Turntable Close-Up Inspection Orbit (Press V or Cam button)
    const orbitAngle = performance.now() * 0.00055;
    const zoom = (state.camZoom || 0.75);
    const radius = 3.65 * zoom;
    camera.position.set(
      state.x + Math.cos(orbitAngle) * radius,
      state.y + 0.85 + 0.95 * zoom,
      playerWorldZ + Math.sin(orbitAngle) * radius
    );
    camera.lookAt(state.x, state.y + 0.56, playerWorldZ);
  } else if (cameraModeIndex === 3) {
    // Requirement 7: Rock-solid Cockpit FPV Camera
    playerWrapper.updateMatrixWorld(true);
    roadsterAttitudeGroup.updateMatrixWorld(true);
    const eyeLocal = new THREE.Vector3(0.0, 0.88, -0.15);
    const forwardLocal = new THREE.Vector3(0.0, -0.04, -1.0).normalize();
    const upLocal = new THREE.Vector3(0.0, 1.0, 0.0);

    const eyeWorld = eyeLocal.applyMatrix4(roadsterAttitudeGroup.matrixWorld);
    const forwardWorld = forwardLocal.transformDirection(roadsterAttitudeGroup.matrixWorld);
    const upWorld = upLocal.transformDirection(roadsterAttitudeGroup.matrixWorld);

    camera.position.copy(eyeWorld);
    camera.up.copy(upWorld);
    camera.lookAt(
      eyeWorld.x + forwardWorld.x * 50.0,
      eyeWorld.y + forwardWorld.y * 50.0,
      eyeWorld.z + forwardWorld.z * 50.0
    );
  } else if (currentMap === 'highway') {
    const zoom = (state.camZoom || 0.75);
    if (cameraModeIndex === 0) {
      const airOffset = Math.max(0.0, state.y);
      const targetCamX = state.x * 0.82;
      const pitchCamLift = Math.sin(state.pitch) * 0.85;
      const targetCamY = visualY + 1.48 + 1.05 * zoom + Math.min(1.8, airOffset * 0.12) + pitchCamLift;
      const targetCamZ = Math.max(3.6, 5.2 * zoom);
      camera.position.x += (targetCamX - camera.position.x) * 9 * dt + shakeX;
      camera.position.y += (targetCamY - camera.position.y) * 9 * dt + shakeY;
      camera.position.z += (targetCamZ - camera.position.z) * 9 * dt + shakeZ;
      const pitchLook = Math.sin(state.pitch) * 2.2;
      const lookY = visualY + 0.65 + pitchLook;
      camera.lookAt(state.x + shakeX * 0.5, lookY + shakeY * 0.5, -9);
    } else {
      camera.position.set(state.x * 0.5 + shakeX, state.y + 8.5 * zoom + shakeY, 11.5 * zoom + shakeZ);
      camera.lookAt(state.x, state.y, -12);
    }
  } else {
    const sinY = Math.sin(state.yaw);
    const cosY = Math.cos(state.yaw);
    const zoom = (state.camZoom || 0.75);
    if (cameraModeIndex === 0) {
      const airOffset = Math.max(0.0, state.y - groundElevation);
      const distBack = 5.4 * zoom;
      const targetCamX = state.x + sinY * distBack;
      const pitchCamLift = Math.sin(state.pitch) * 0.85;
      const targetCamY = visualY + 1.54 + 1.05 * zoom + Math.min(1.8, airOffset * 0.12) + pitchCamLift;
      const targetCamZ = state.z + cosY * distBack;
      camera.position.x += (targetCamX - camera.position.x) * 9 * dt + shakeX;
      camera.position.y += (targetCamY - camera.position.y) * 9 * dt + shakeY;
      camera.position.z += (targetCamZ - camera.position.z) * 9 * dt + shakeZ;
      const pitchLook = Math.sin(state.pitch) * 2.2;
      const lookY = visualY + 0.65 + pitchLook;
      camera.lookAt(state.x - sinY * 10, lookY, state.z - cosY * 10);
    } else {
      camera.position.set(state.x + sinY * 11.5 * zoom + shakeX, state.y + 10.5 * zoom + shakeY, state.z + cosY * 11.5 * zoom + shakeZ);
      camera.lookAt(state.x, state.y, state.z);
    }
  }

  if (state.bannerTimer > 0) {
    state.bannerTimer -= dt;
    if (state.bannerTimer <= 0) renderBannerText();
  }

  const anyAttitude = (rollInput !== 0 || pitchInput !== 0 || yawInput !== 0 || airJetLeft || airJetRight) && canUseRCS;
  sound.update(
    Math.abs(state.speed) / state.maxSpeed,
    isLiftFiring || rearActive || isFrontRetroFiring,
    anyAttitude || isFrontRetroFiring,
    false,
    tireScreechIntensity
  );

  // Update Live Cockpit Center Touchscreen & Speed/Rain Overlay Canvas
  updateCockpitHudScreen(mph, kmh, rearActive, isLiftFiring, isFrontRetroFiring, rcsRollPitchActive, rcsYawRetroActive);
  updateSpeedAndWeatherOverlay(dt, mph, isAnyThrust, isSupersonic);

  const speedEl = document.getElementById('val-speed');
  const unitEl = document.getElementById('val-speed-unit');
  const subSpeedEl = document.getElementById('val-kmh');

  let modeTag = '';
  if (isRealMode) {
    modeTag = state.insaneMode
      ? (currentLang === 'zh' ? '🔥 狂暴模式 (370 km/h)' : '🔥 Plaid Mode (370 km/h)')
      : (currentLang === 'zh' ? '⚡ 纯电常规 (限速 200)' : '⚡ Standard EV (200 limit)');
  } else {
    modeTag = currentLang === 'zh' ? '✨ 幻想模式 (792 km/h)' : '✨ Fantasy Rocket (492 MPH)';
  }

  if (state.speedUnit === 'kmh') {
    speedEl.textContent = kmh;
    if (unitEl) unitEl.textContent = 'KM/H';
    if (subSpeedEl) subSpeedEl.textContent = `${mph} MPH • ${modeTag}`;
  } else {
    speedEl.textContent = mph;
    if (unitEl) unitEl.textContent = 'MPH';
    if (subSpeedEl) subSpeedEl.textContent = `${kmh} km/h • ${modeTag}`;
  }

  const gForceEl = document.getElementById('val-g-force');
  if (gForceEl) {
    const curG = Math.hypot(state.longitudinalG || 0, state.lateralG || 0);
    gForceEl.textContent = `${curG.toFixed(1)} G`;
    if (curG > 1.5) {
      gForceEl.className = 'text-[11px] mono font-bold px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/50 ml-1 warning-pulse';
    } else if (curG > 0.8) {
      gForceEl.className = 'text-[11px] mono font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40 ml-1';
    } else {
      gForceEl.className = 'text-[11px] mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 ml-1';
    }
  }

  // Dynamic Turn Signals Strobe & Instrument Cluster Indicator
  const isTurningLeft = (state.steerInput > 0.12) || Boolean(keys['KeyA']);
  const isTurningRight = (state.steerInput < -0.12) || Boolean(keys['KeyD']);
  const isStrobeOn = (Math.sin(performance.now() * 0.013) > 0);
  if (typeof turnSignalMatL !== 'undefined') {
    turnSignalMatL.opacity = (isTurningLeft && isStrobeOn) ? 0.95 : 0.0;
  }
  if (typeof turnSignalMatR !== 'undefined') {
    turnSignalMatR.opacity = (isTurningRight && isStrobeOn) ? 0.95 : 0.0;
  }

  // Dynamic Stop & Reverse Lamps
  const isBrakeActive = (isFootBraking || isHandbraking) || (isAirborne && isReversing);
  if (typeof tailLightMat !== 'undefined') {
    tailLightMat.color.setHex(isBrakeActive ? 0xff002b : 0xcc1436);
  }
  if (typeof chmslMat !== 'undefined') {
    chmslMat.color.setHex(isBrakeActive ? 0xff002b : 0x3b050d);
  }
  const isCarReversing = isReversing || (state.speed < -0.2);
  if (typeof reverseLightMat !== 'undefined') {
    reverseLightMat.opacity = isCarReversing ? 0.95 : 0.0;
  }
  const turnIndL = document.getElementById('indicator-turn-l');
  const turnIndR = document.getElementById('indicator-turn-r');
  if (turnIndL) {
    turnIndL.className = (isTurningLeft && isStrobeOn)
      ? 'text-sm font-bold text-emerald-400 drop-shadow-[0_0_8px_#34d399] transition-colors mr-0.5 select-none'
      : 'text-sm font-bold text-slate-600 transition-colors mr-0.5 select-none';
  }
  if (turnIndR) {
    turnIndR.className = (isTurningRight && isStrobeOn)
      ? 'text-sm font-bold text-emerald-400 drop-shadow-[0_0_8px_#34d399] transition-colors ml-0.5 mr-1 select-none'
      : 'text-sm font-bold text-slate-600 transition-colors ml-0.5 mr-1 select-none';
  }

  const gearEl = document.getElementById('val-drive-gear');
  if (gearEl) {
    if (isAirborne) {
      gearEl.textContent = 'AIR';
      gearEl.className = 'text-[11px] mono font-bold px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-400/60 ml-1 shadow-[0_0_8px_rgba(56,189,248,0.5)]';
    } else if (state.isDrifting) {
      gearEl.textContent = 'DRIFT';
      gearEl.className = 'text-[11px] mono font-bold px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-400/60 ml-1 warning-pulse';
    } else if (state.speed < -0.2 || isReversing) {
      gearEl.textContent = 'R';
      gearEl.className = 'text-[11px] mono font-bold px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-400/60 ml-1';
    } else if (Math.abs(state.speed) <= 0.2 && !isAccelerating) {
      gearEl.textContent = 'P';
      gearEl.className = 'text-[11px] mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-600 ml-1';
    } else {
      gearEl.textContent = 'D';
      gearEl.className = 'text-[11px] mono font-bold px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-400/60 ml-1';
    }
  }

  const flowEl = document.getElementById('val-air-flow');
  if (flowEl) {
    let flowLps = 0;
    if (rearActive) flowLps += 51;
    if (isLiftFiring) flowLps += (state.isJumping6m ? 180 : 60);
    if (isDescendFiring || isFrontRetroFiring) flowLps += 33;
    if (rcsRollPitchActive || rcsYawRetroActive) flowLps += 23;
    flowEl.textContent = flowLps > 0 ? `FLOW: ${flowLps} L/s` : 'FLOW: 0 L/s';
    flowEl.className = flowLps > 0 
      ? 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/25 text-cyan-300 border border-cyan-400/50 warning-pulse'
      : 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30';
  }

  if (mph > 225) {
    speedEl.className = 'mono text-3xl md:text-4xl font-extrabold text-cyan-300 tracking-tight drop-shadow-[0_0_12px_rgba(56,189,248,0.85)]';
  } else {
    speedEl.className = 'mono text-3xl md:text-4xl font-extrabold text-white tracking-tight';
  }

  const pct = Math.max(0, Math.min(100, (state.airRemaining / MAX_AIR_SECONDS) * 100));
  const liters = Math.round((state.airRemaining / MAX_AIR_SECONDS) * 600);
  document.getElementById('val-air-sec').textContent = `${state.airRemaining.toFixed(1)}s`;
  document.getElementById('val-air-liters').textContent = `(${liters}L)`;
  const burnUsedEl = document.getElementById('val-burn-used');
  if (burnUsedEl) burnUsedEl.textContent = `${state.airUsedContinuous.toFixed(1)}s`;

  const barFill = document.getElementById('air-bar-fill');
  barFill.style.width = `${pct}%`;

  const tankBadge = document.getElementById('ui-tank-state-badge');
  const modeBadge = document.getElementById('ui-flight-mode');

  if (state.isFreefalling) {
    barFill.className = 'h-full rounded-md bg-rose-600 transition-all duration-75';
    tankBadge.textContent = t.badgeDepleted;
    tankBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-300 border border-rose-400';
    modeBadge.textContent = t.modeFreefall;
    modeBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-300';
  } else if (state.isAutoDescending8s) {
    barFill.className = 'h-full rounded-md bg-amber-400 transition-all duration-75';
    tankBadge.textContent = t.badge8sWarn;
    tankBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300 border border-amber-400';
    modeBadge.textContent = t.modeAutoDescend;
    modeBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300';
  } else if (isLiftFiring) {
    barFill.className = 'h-full rounded-md bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-75';
    tankBadge.textContent = t.badgeThrust;
    tankBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/30 text-cyan-200 border border-cyan-400';
    modeBadge.textContent = t.modeHover;
    modeBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/30 text-cyan-300';
  } else {
    barFill.className = 'h-full rounded-md bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-75';
    tankBadge.textContent = state.airRemaining < 9.95 ? t.badgeRecharging : t.badgeReady;
    tankBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/30';
    modeBadge.textContent = state.y > 0.15 ? t.modeHover : t.modeGround;
    modeBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300';
  }

  const hullInt = Math.round(state.hullIntegrity);
  document.getElementById('val-hull-pct').textContent = `${hullInt}%`;
  const hullBar = document.getElementById('hull-bar-fill');
  hullBar.style.width = `${hullInt}%`;
  hullBar.className = hullInt > 50
    ? 'h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-100'
    : hullInt > 25
      ? 'h-full bg-amber-400 transition-all duration-100'
      : 'h-full bg-rose-500 transition-all duration-100';
  document.getElementById('val-impact-g').textContent = `${state.lastImpactG.toFixed(1)}G / 18.0G`;

  const rollDeg = Math.round(THREE.MathUtils.radToDeg(state.roll));
  const pitchDeg = Math.round(THREE.MathUtils.radToDeg(state.pitch));
  const yawDeg = Math.round(THREE.MathUtils.radToDeg(state.yaw)) % 360;
  document.getElementById('val-roll').textContent = `${rollDeg}°`;
  document.getElementById('val-pitch').textContent = `${pitchDeg}°`;
  document.getElementById('val-yaw').textContent = `${yawDeg}°`;
  const trueAgl = Math.max(0.0, state.y - groundElevation);
  document.getElementById('val-altitude').textContent = (groundElevation > 0.5)
    ? `${trueAgl.toFixed(1)} m (ASL ${state.y.toFixed(0)}m)`
    : `${trueAgl.toFixed(1)} m`;
  document.getElementById('val-vspeed').textContent = `${state.vy >= 0 ? '+' : ''}${state.vy.toFixed(1)} m/s`;
  document.getElementById('val-coords').textContent = `${Math.round(state.x)}, ${Math.round(state.z)}`;
  document.getElementById('val-passed').textContent = state.carsCleared;
  document.getElementById('val-score').textContent = Math.round(state.score + state.carsCleared * 10);
  const downforceEl = document.getElementById('val-downforce');
  if (downforceEl) downforceEl.textContent = `${state.downforceN || 0} N`;
  const tireTempEl = document.getElementById('val-tire-temp');
  if (tireTempEl) tireTempEl.textContent = `${Math.round(state.tireTemp || 35)}°C (μ ${(state.tireGripMu || 1.0).toFixed(2)})`;
}

function animate(now) {
  requestAnimationFrame(animate);
  // Snapshot the score before any simulation step beyond the real-time deadline.
  window.RoadsterRanked?.tick(now);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  updateSimulation(dt);
  window.RoadsterTaxi?.tick();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizeVfxCanvas();
});

window.__gameTestHooks = {
  getState: () => state,
  setKeyState,
  toggleLanguage,
  getCurrentLang: () => currentLang,
  switchMap,
  getCurrentMap: () => currentMap,
  cyclePaintFinish,
  selectPaintFinish,
  renderModalPaintGrid,
  getPaintCount: () => PAINT_PRESETS.length,
  getTrafficCars: () => trafficCars,
  getActiveExplosions: () => activeExplosions,
  getCityBounds: () => ({ halfBound: CITY_HALF_BOUND, maxAlt: MAX_FLIGHT_ALTITUDE, maxTowerHeight: Math.max(...cityBuildings.map(b => b.height)) }),
  triggerPhysicsCollision,
  triggerJump6m,
  toggleAltitudeHold,
  resetCar,
  getTireSmokePool: () => (typeof tireSmokePool !== 'undefined' ? tireSmokePool : []),
  spawnTireSmokePuff: (typeof spawnTireSmokePuff === 'function' ? spawnTireSmokePuff : null),
  clearTireSmoke: (typeof clearTireSmoke === 'function' ? clearTireSmoke : null),
  stepSimulation: (dt) => updateSimulation(dt)
};

window.onload = () => {
  renderModalPaintGrid();
  renderModalWeatherGrid();
  highlightSelectedMapCard(selectedMapInModal);
  applyTranslations();
  lastTime = performance.now();
  requestAnimationFrame(animate);
};
