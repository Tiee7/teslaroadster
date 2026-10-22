// Identity-only CPU declarations. NEVER execute these functions.
export const declaredUpdateSimulation = function updateSimulation(dt, presentationDt = dt) {
  const presentFrame = presentationDt !== null;
  globalThis.window?.RoadsterDemo?.step(dt);
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
    if (typeof clearThrusterVisuals === 'function') clearThrusterVisuals();
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
      // Destruction returns before the normal traffic controller. Its aftermath
      // still retries each queue's placement policy; incident recovery stays
      // behind the crash and never materializes inside another vehicle.
      if (currentMap === 'highway' && car.mode === 'highway' &&
          (car.highwayWaitingToSpawn !== undefined ||
           (!(car.blastTimer > 0) && highwayTraffic.isOutOfBounds(car, LANE_CENTERS, { z: 0 })))) {
        const refill = car.highwayWaitingToSpawn !== undefined ? highwayTraffic.retrySpawn : highwayTraffic.respawnBehind;
        refill(car, trafficCars, LANE_CENTERS,
          { x: state.x, y: state.y, z: 0, vx: state.vx, vz: state.vz }, WORLD_SPEED_SCALE);
        return;
      }
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
        if (currentMap === 'highway' &&
            (car.blastTimer <= 0.01 || highwayTraffic.isOutOfBounds(car, LANE_CENTERS, { z: 0 }))) {
          highwayTraffic.respawnBehind(car, trafficCars, LANE_CENTERS,
            { x: state.x, y: state.y, z: 0, vx: state.vx, vz: state.vz }, WORLD_SPEED_SCALE);
        }
      }
    });
    if (!cityOwnsDrivingSound() && !coastOwnsDrivingSound()) sound.update(0, false, false, true);
    document.getElementById('ui-flight-mode').textContent = t.modeDestroyed;
    document.getElementById('ui-flight-mode').className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-300';
    document.getElementById('val-hull-pct').textContent = '0%';
    document.getElementById('hull-bar-fill').style.width = '0%';
    return;
  }

  
  const scoreMotionStart = RoadsterDrivingScore.motion(state, currentMap);
  const isRealMode = (state.physicsMode === 'realistic');
  const cityMotionStart = currentMap === 'city' ? {x:state.x,y:state.y,z:state.z,yaw:state.yaw,pitch:state.pitch,roll:state.roll} : null;
  const coastMotionStart = currentMap === 'coast' ? {x:state.x,y:state.y,z:state.z,yaw:state.yaw,pitch:state.pitch,roll:state.roll,vy:state.vy} : null;
  if(coastMotionStart&&typeof playerWrapper!=='undefined'&&typeof roadsterAttitudeGroup!=='undefined')coastMotionStart.contactPose={x:state.x,y:playerWrapper.position.y,z:state.z,pitch:roadsterAttitudeGroup.rotation.x,yaw:roadsterAttitudeGroup.rotation.y,roll:roadsterAttitudeGroup.rotation.z};
  const coastObstacles = currentMap === 'coast' ? (globalThis.window?.RoadsterCoast?.buildings() || []) : null;
  const coastTrafficStart = currentMap === 'coast' ? new Map(trafficCars.map(c=>[c,{x:c.mesh.position.x,y:c.mesh.position.y,z:c.mesh.position.z,yaw:c.mesh.rotation.y,pitch:c.mesh.rotation.x,roll:c.mesh.rotation.z,visible:c.mesh.visible}])) : null;
  state.gasMassKg = Number((144.0 * (state.airRemaining / MAX_AIR_SECONDS)).toFixed(1));
  const currentVehicleMass = VEHICLE_MASS_KG + (state.gasMassKg || 0);
  const fuelBurnThrustFactor = (VEHICLE_MASS_KG + 144.0) / Math.max(1850.0, currentVehicleMass);
  let currentGroundAccel = 16.5;
  let currentAirAccel = 9.5;
  let currentLiftAccel = 8.2 * 1.3;   // +30% climb acceleration (10.66 m/s²)
  let currentMaxClimbVy = 6.2 * 1.3;  // +30% Space climb speed (8.06 m/s)
  let tireScreechIntensity = 0.0;

  const coastWorld = currentMap === 'coast' ? globalThis.window?.RoadsterCoast : null;
  let coastSupport = coastWorld?.support({...state,grounded:!state.wasAirborne});
  let groundElevation = coastSupport && Number.isFinite(coastSupport.height) ? coastSupport.height : 0;
  if (currentMap === 'city' || currentMap === 'coast') {
    const mapBuildings = coastObstacles || cityNearbyBuildings(state);
    for (let i = 0; i < mapBuildings.length; i++) {
      const b = mapBuildings[i];
      if (coastWorld && state.y + 1.25 < (b.minY ?? 0)) continue;
      if (currentMap === 'city' ? cityTouchesRoof(state,b) : state.x > b.minX - 1.1 && state.x < b.maxX + 1.1 && state.z > b.minZ - 1.8 && state.z < b.maxZ + 1.8) {
        if (state.y >= b.height - 0.55) {
          groundElevation = Math.max(groundElevation, b.height);
        }
      }
    }
  }
  // O has already supplied vertical launch velocity, even before this frame's
  // altitude integration. Do not run another tire-grip/drive frame on takeoff.
  let isAirborne = coastWorld
    ? Math.abs(state.y-groundElevation)>.15 || !coastSupport?.solid || (state.isJumping6m&&state.vy>0) || state.coastDetached===true || (state.wasAirborne&&!state.coastSupportId)
    : (state.y - groundElevation) > 0.15 || (state.isJumping6m && state.vy > 0);
  let coastGroundAttached = Boolean(coastWorld&&!isAirborne);
  if(coastWorld){state.coastSupportId=coastGroundAttached?coastSupport.id:null;state.coastDetached=false;}
  if (!isAirborne) state.groundHopActive = false;
  const { rawRollInput, rawPitchInput, rawYawInput, hasManualAttitudeInput } = readAttitudeInput(isAirborne);
  const stabilizerDt = advanceAttitudeIdle(dt, hasManualAttitudeInput || !isAirborne);

  // Unified COPV Air Tank Consumption Helper (Requirement 3: ALL airborne thrusters & ';' rear boost consume tank)
  let airConsumedThisFrame = 0;
  function consumeAirTank(amount, airborneNow) {
    if (amount <= 0 || state.isFreefalling || state.airRemaining <= 0) return false;
    // Infinite mode changes the shared tank, not thrust strength or input.
    if (state.infiniteJet) { airConsumedThisFrame += amount; return true; }
    const airBefore = state.airRemaining;
    state.airRemaining = Math.max(0.0, state.airRemaining - amount);
    state.airUsedContinuous = MAX_AIR_SECONDS - state.airRemaining;
    if (state.airRemaining <= 0.001) {
      const flightAlertEligible = airborneNow && isAirborne && !state.groundHopActive && !state.isJumping6m && !Number.isFinite(state.jumpInertiaSeconds);
      state.airRemaining = 0.0;
      state.airUsedContinuous = MAX_AIR_SECONDS;
      state.isFreefalling = true;
      state.isAutoDescending8s = false;
      state.isAltitudeHold = false;
      state.isJumping6m = false;
      // Losing thrust changes acceleration, never the current velocity.
      // A depleted road tank (including the complete O-hop) is not flight.
      // This presentation-only marker never changes gas, force or ballistics.
      if (flightAlertEligible) {
        showBanner('freefall', 3.5);
        sound.speakAlert('freefall', 'Critical alert: compressed air depleted. Immediate freefall!', '严重警报：冷气推进剂耗尽，进入自由落体！');
      }
      airConsumedThisFrame += airBefore - state.airRemaining;
      return false;
    } else if (state.airUsedContinuous >= AUTO_DESCENT_USED_SECONDS && airborneNow) {
      if (!state.isAutoDescending8s) {
        state.isAutoDescending8s = true;
        showBanner('8s', 2.4);
        sound.speakAlert('8s', 'Warning: Low tank pressure. Auto-descent engaged.', '警告：气瓶压力低于百分之二十，自动下降已启动。');
      }
    }
    airConsumedThisFrame += airBefore - state.airRemaining;
    return true;
  }

  let canUseRCS = !state.isFreefalling && state.airRemaining > 0.005;

  // Requirement 4: ';' (Semicolon) triggers Rear Cold-Gas Rocket Boost in Realistic (Standard) mode!
  const driveInput = readDriveInput();
  if(currentMap==='city')window.RoadsterCityDiagnostics?.begin(state,dt,driveInput);
  // Deliberate lift/hold leaves a road hop for actual flight; W held while
  // driving over a hop alone must not accidentally arm the flight alarm.
  if (isAirborne && (driveInput.lift > 0 || state.isAltitudeHold)) state.groundHopActive = false;
  const isRearBoostKey = driveInput.boost > 0;
  const isThrottleW = driveInput.throttle > 0;
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
      // Standard EV propulsion reaches 200 km/h; existing boosted momentum coasts down.
      state.maxSpeed = STANDARD_EV_MAX_MPS;
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
  const isStandardEVMode = isRealMode && !state.insaneMode && state.maxSpeed === STANDARD_EV_MAX_MPS;
  const electricGroundAccel = isRealMode ? (state.insaneMode ? 38.0 : 16.5) : 72.0;
  const electricAirAccel = isRealMode ? (state.insaneMode ? 24.0 : 9.5) : (currentMap !== 'highway' ? 145.0 : 92.0);
  const rearJetAccel = isRealMode ? 38.0 : 120.0;
  const groundDriveAccel = (speed, electricFactor = 1, jetFactor = 1) => {
    // A small jet request must not turn a held W into full rocket power, or
    // extend the electric motor past its existing 200 km/h ceiling.
    const electric = isRealMode && !state.insaneMode && speed >= STANDARD_EV_MAX_MPS
      ? 0 : electricGroundAccel * driveInput.throttle * electricFactor;
    const jet = isRearThrusterFiring ? rearJetAccel * driveInput.boost * jetFactor : 0;
    return Math.max(electric, jet);
  };

  // Requirement 1 & 2:
  // • When throttle (W or ;) and foot brake (H) / reverse (S) are pressed simultaneously, execute throttle and ignore foot brake/reverse.
  // • Handbrake (B) MUST work even when throttle (W) is held ("不松油门的情况下目前手刹无法正常使用")!
  const isFootBraking = driveInput.brake > 0 && !isAccelerating;
  const isReversing = driveInput.reverse > 0 && !isAccelerating;
  const isHandbraking = driveInput.handbrake > 0;
  const isAirBrakingActive = isFootBraking || (isAirborne && isReversing);
  const coastDragCoeff = ((currentMap === 'coast' ? state.y-groundElevation : state.y) > 0.2 || Math.abs(state.speed) > 33.0) ? 0.44 : 0.34;
  state.dragCoeffCd = isAirBrakingActive ? coastDragCoeff + (0.72 - coastDragCoeff) * Math.max(driveInput.brake, driveInput.reverse) : coastDragCoeff;

  // Determine if the 4 Rear SpaceX Cold-Gas Nozzles are firing this frame:
  // 用户要求: "在空中飞行的时候，按W需要喷气，地上的W不喷气"
  // • 空中 (isAirborne === true): 按下 W 或 ; 均启动尾部冷气推进器喷气加速并消耗气瓶
  // • 地面 (isAirborne === false): 按下 W 仅使用纯电驱动（不喷气），按下 ; 才触发尾部火箭喷气
  let isRearThrusterFiring = false;
  if (canUseRCS) {
    if (isAirborne && (isThrottleW || isRearBoostKey)) {
      const airBurnRate = Math.max(0.85 * driveInput.boost, 0.65 * driveInput.throttle);
      isRearThrusterFiring = consumeAirTank(airBurnRate * dt, true);
    } else if (!isAirborne && isRearBoostKey) {
      isRearThrusterFiring = consumeAirTank(0.85 * driveInput.boost * dt, false);
    }
  }
  canUseRCS = !state.isFreefalling && state.airRemaining > 0.005;

  // One brake request and one COPV charge, shared by H and S. Throttle's
  // established priority above remains unchanged, including touch controls.
  const brakeTravelSpeed = isAirborne
    ? Math.hypot(state.vx, state.vy, state.vz)
    : (currentMap === 'highway' ? Math.abs(state.speed) : Math.hypot(state.vx, state.vz));
  const retroBrakeDemand = (isFootBraking || isReversing)
    ? getRetroBrakeDemand(brakeTravelSpeed, isAirborne) * Math.max(driveInput.brake, driveInput.reverse) : 0;
  let retroImpulseSeconds = 0;
  if (retroBrakeDemand > 0 && !state.isFreefalling && state.airRemaining > 0) {
    const requestedAir = RETRO_BRAKE_BURN_PER_SECOND * retroBrakeDemand * dt;
    const airBefore = state.airRemaining;
    const consumedBefore = airConsumedThisFrame;
    consumeAirTank(state.infiniteJet ? requestedAir : Math.min(airBefore, requestedAir), isAirborne);
    // The final fraction of a nearly empty tank supplies only its proportional
    // impulse, even when consumeAirTank returns false on depletion.
    retroImpulseSeconds = Math.min(requestedAir, airConsumedThisFrame - consumedBefore) / RETRO_BRAKE_BURN_PER_SECOND;
  }
  const isRetroBrakeFiring = retroImpulseSeconds > 0;
  const retroBrakeAccel = RETRO_BRAKE_FORCE_N / currentVehicleMass;
  canUseRCS = !state.isFreefalling && state.airRemaining > 0.005;

  // Ground steering uses A / D only (J / L are exclusively Roll!)
  const steerLeft = Boolean(keys['KeyA']);
  const steerRight = Boolean(keys['KeyD']);
  const lateralInput = isAirborne ? 0 : driveInput.steer;

  // Only the opt-in highway stunt demo uses the quicker bounded rack. Manual
  // A/D, city, drift and all airborne handling keep their established response.
  const demoGroundHandling = currentMap === 'highway' && !isAirborne && globalThis.window?.RoadsterDemo?.isActive()
    && typeof RoadsterHighwayDemoPlanner !== 'undefined' ? RoadsterHighwayDemoPlanner.handling : null;
  const demoGroundSweep = demoGroundHandling ? { x:state.x, y:state.y, cars:new Map(trafficCars
    .filter(c=>c.mode==='highway' && c.mesh.visible!==false && c.highwayWaitingToSpawn===undefined)
    .map(c=>[c,{x:c.mesh.position.x,z:c.mesh.position.z}])) } : null;
  const steerRate = demoGroundHandling ? demoGroundHandling.rackRate : lateralInput !== 0 ? 8.0 : 11.0;
  const rackBlend = demoGroundHandling ? 1.0 - Math.exp(-steerRate * dt) : Math.min(1.0, steerRate * dt);
  state.steerInput = (state.steerInput || 0) + (lateralInput - (state.steerInput || 0)) * rackBlend;
  if (Math.abs(state.steerInput) < 0.004 && lateralInput === 0) state.steerInput = 0.0;
  state.steerAngle = -state.steerInput * 0.38;
  frontWheelSteerGroups.forEach(g => { g.rotation.y = state.steerAngle; });

  // Requirement 2 & 3: In mid-air, Q / E controls lateral body movement AND consumes COPV air tank!
  const wantsAirJetLeft = isAirborne && (Boolean(keys['KeyQ']) || driveInput.strafe < 0);
  const wantsAirJetRight = isAirborne && (Boolean(keys['KeyE']) || driveInput.strafe > 0);
  let airJetLeft = false;
  let airJetRight = false;
  if ((wantsAirJetLeft || wantsAirJetRight) && canUseRCS) {
    const strafePower = Math.max(Math.abs(driveInput.strafe), Number(Boolean(keys.KeyQ || keys.KeyE)));
    if (consumeAirTank(0.45 * strafePower * dt, true)) {
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

  const airHandlingDt = advanceAirHandling(dt, isAirborne);
  if (isAirborne) {
    state.isDrifting = false;
    state.wasHandbraking = false;
    state.driftAngle = 0.0;
    // Takeoff retains its inherited vector. Established flight smoothly regains
    // the controlled speed envelope and nose/bank response used before it.
    if (isRearThrusterFiring) {
      const jetAirAccel = currentMap !== 'highway' && !isRealMode ? 145.0 : currentAirAccel;
      const boostAirAccel = Math.max(electricAirAccel * driveInput.throttle, jetAirAccel * driveInput.boost);
      const thrust = addAirThrust(state.vx, state.vz,
        noseHorizX * nosePitchCos * boostAirAccel * dt,
        noseHorizZ * nosePitchCos * boostAirAccel * dt, state.airMaxSpeed);
      state.vx = thrust.vx;
      state.vz = thrust.vz;
      const maxAirVy = currentMaxClimbVy * 1.35;
      const verticalImpulse = boostAirAccel * nosePitchSin * 0.55 * dt;
      state.vy += verticalImpulse > 0 ? Math.min(verticalImpulse, Math.max(0, maxAirVy - state.vy)) : verticalImpulse;
      const horizMag = Math.hypot(state.vx, state.vz);
      if (horizMag > state.airMaxSpeed && airHandlingDt > 0) {
        // Settle inherited overspeed continuously; never clip the O launch or
        // jump directly to a new propulsion limit when changing flight modes.
        const nextMag = state.airMaxSpeed + (horizMag - state.airMaxSpeed) * Math.exp(-3.0 * airHandlingDt);
        state.vx *= nextMag / horizMag;
        state.vz *= nextMag / horizMag;
      }
    } else {
      const horizMag = Math.hypot(state.vx, state.vz);
      const launchCoast = getAirCoastSpeed(horizMag, Math.max(0, dt - airHandlingDt));
      const nextMag = getResponsiveAirCoastSpeed(launchCoast, airHandlingDt);
      const coastScale = horizMag > 0 ? nextMag / horizMag : 0;
      state.vx *= coastScale;
      state.vz *= coastScale;
    }

    // Explicit side jets keep their proportional input throughout takeoff.
    // Bank assist and powered sideslip control blend in after the brief carry.
    const jetDir = airJetLeft || airJetRight ? driveInput.strafe : 0;
    const bankStrafe = canUseRCS ? Math.sin(state.roll) * 10.0 : 0;
    const targetStrafe = jetDir * 18.0 + bankStrafe;
    const strafeRate = isRearThrusterFiring ? 10.0 : 6.5;
    const lateralSpeed = state.vx * rightHorizX + state.vz * rightHorizZ;
    const strafeDt = jetDir !== 0 ? dt : airHandlingDt;
    const strafeChange = jetDir !== 0 || Math.abs(bankStrafe) > 0.001 || isRearThrusterFiring
      ? (targetStrafe - lateralSpeed) * (1.0 - Math.exp(-strafeRate * strafeDt))
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

  // Apply the paid impulse opposite actual travel, never camera/nose heading.
  // A scalar clamp preserves direction and cannot propel the car through zero.
  const retroTravelSpeed = isAirborne ? Math.hypot(state.vx, state.vy, state.vz)
    : (currentMap === 'highway' ? Math.abs(state.speed) : Math.hypot(state.vx, state.vz));
  const retroScale = retroTravelSpeed > 0
    ? Math.max(0, retroTravelSpeed - retroBrakeAccel * retroImpulseSeconds) / retroTravelSpeed : 0;
  const retroUsesRearNozzles = isAirborne
    ? (state.vx * noseHorizX * nosePitchCos + state.vy * nosePitchSin + state.vz * noseHorizZ * nosePitchCos) < 0
    : (state.vx * noseHorizX + state.vz * noseHorizZ) < 0;
  // Snapshot only for rendering the already-paid brake impulse in its travel direction.
  const retroVisualVx = state.vx, retroVisualVy = isAirborne ? state.vy : 0, retroVisualVz = state.vz;
  if (isRetroBrakeFiring) {
    state.vx *= retroScale;
    state.vz *= retroScale;
    if (isAirborne) state.vy *= retroScale;
    state.speed = isAirborne ? Math.hypot(state.vx, state.vz) : state.speed * retroScale;
  }

  if (currentMap === 'highway') {
    if (!isAirborne) {
      // Ground mode on highway
      if (isAccelerating) {
        const effAccel = groundDriveAccel(state.speed, isHandbraking ? 1 - 0.12 * driveInput.handbrake : 1, fuelBurnThrustFactor);
        if (state.speed < -0.5) {
          state.speed = Math.min(0.0, state.speed + 38.0 * Math.max(driveInput.throttle, driveInput.boost) * dt);
        } else {
          state.speed = accelerateGroundSpeed(state.speed, effAccel, state.maxSpeed, dt, isStandardEVMode);
        }
      } else if (isFootBraking) {
        if (state.speed > 0.1) {
          state.speed = Math.max(0.0, state.speed - 38.0 * driveInput.brake * dt);
        } else if (state.speed < -0.1) {
          state.speed = Math.min(0.0, state.speed + 38.0 * driveInput.brake * dt);
        } else {
          state.speed = 0.0;
        }
      } else if (isReversing) {
        if (state.speed > 0.3) {
          state.speed *= Math.pow(0.95, dt * driveInput.reverse);
        } else if (state.speed < -15.0) {
          // A fast backward landing brakes toward reverse cruise; the reverse
          // speed limit must never teleport existing momentum to -15 m/s.
          state.speed = Math.min(-15.0, state.speed + 38.0 * driveInput.reverse * dt);
        } else {
          state.speed = Math.max(-15.0, state.speed - 16.0 * driveInput.reverse * dt);
        }
      } else if (!isHandbraking) {
        // Gentle coasting, including a continuous 30%-stronger normal EV overrun.
        state.speed = getGroundCoastSpeed(state.speed, dt, isStandardEVMode);
      }

      const speedFactor = THREE.MathUtils.clamp(Math.abs(state.speed) / 14.0, 0.0, 1.25);
      const turnSign = state.speed >= -0.1 ? 1 : -1;

      // Fix Issue 1: Handbrake (U) breaks rear tire lateral grip for smooth drift without abrupt dead-stop,
      // and immediately stops decelerating the instant U is released!
      if (isHandbraking && Math.abs(state.speed) > 1.5) {
        state.wasHandbraking = true;
        if (lateralInput !== 0 || Math.abs(state.driftAngle) > 0.04) {
          state.isDrifting = true;
          const targetSlip = -state.steerInput * 0.58 * turnSign * driveInput.handbrake;
          state.driftAngle += (targetSlip - state.driftAngle) * 8.5 * dt;
          state.yaw = state.driftAngle;
          state.vYaw = 0.0;
          const driftSlideVx = state.steerInput * Math.min(22.0, Math.abs(state.speed) * 0.56) * driveInput.handbrake;
          const noseThrustVx = isRearThrusterFiring ? (noseHorizX * state.speed * 0.85) : (noseHorizX * state.speed * 0.48);
          state.vx += (driftSlideVx + noseThrustVx - state.vx) * 9.5 * dt;
          if (!isAccelerating) {
            // Very light tire-scrub (~1.2 m/s²) so handbrake never locks/stops the car
            state.speed = Math.sign(state.speed) * Math.max(0.0, Math.abs(state.speed) - 1.2 * driveInput.handbrake * dt);
          }
        } else {
          state.isDrifting = false;
          state.driftAngle *= Math.pow(0.05, dt);
          if (!isAccelerating) {
            state.speed = Math.sign(state.speed) * Math.max(0.0, Math.abs(state.speed) - 1.2 * driveInput.handbrake * dt);
          }
        }
      } else {
        state.isDrifting = false;
        state.wasHandbraking = false;
        state.driftAngle *= Math.pow(0.005, dt);
        if (demoGroundHandling) {
          const targetVx = state.steerInput * demoGroundHandling.lateralSpeed * THREE.MathUtils.clamp(Math.abs(state.speed) / 18.0, 0, 1);
          const targetYaw = -Math.atan2(targetVx, Math.max(12, Math.abs(state.speed))) * turnSign;
          state.yaw += wrapAnglePi(targetYaw - state.yaw) * (1.0 - Math.exp(-demoGroundHandling.yawRate * dt));
          state.vx += (targetVx - state.vx) * (1.0 - Math.exp(-demoGroundHandling.lateralRate * dt));
        } else {
          const targetHwyYaw = -state.steerInput * 0.16 * turnSign * Math.min(1.0, speedFactor);
          state.yaw += wrapAnglePi(targetHwyYaw - state.yaw) * (1.0 - Math.exp(-12.0 * dt));
          state.vYaw = 0.0;
          const targetVx = isRearThrusterFiring
            ? (noseHorizX * state.speed)
            : (state.steerInput * 13.5 * speedFactor + noseHorizX * state.speed * 0.35);
          state.vx += (targetVx - state.vx) * 14.0 * dt;
        }
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
      state.yaw -= wrapAnglePi(state.yaw) * (1.0 - Math.pow(0.04, dt));
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
        const handbrakeYawRate = state.steerInput * 3.85 * pivotSpeedFactor * turnDir * driveInput.handbrake;
        state.yaw -= handbrakeYawRate * dt;
        state.vYaw = 0.0;

        const targetSlip = state.steerInput * 0.55 * turnDir * driveInput.handbrake;
        state.driftAngle += (targetSlip - state.driftAngle) * 7.5 * dt;

        if (isRearThrusterFiring) {
          signedSpd = accelerateGroundSpeed(signedSpd, groundDriveAccel(signedSpd), state.maxSpeed, dt, isStandardEVMode);
          state.driftAngle *= Math.pow(0.15, dt);
        } else if (isAccelerating) {
          signedSpd = accelerateGroundSpeed(signedSpd, groundDriveAccel(signedSpd, 1 - 0.15 * driveInput.handbrake), state.maxSpeed * 0.94, dt, isStandardEVMode);
        } else if (isFootBraking) {
          signedSpd = Math.sign(signedSpd) * Math.max(0, Math.abs(signedSpd) - 38.0 * driveInput.brake * dt);
        } else {
          // Very gentle tire-scrub (~1.2 m/s²) while coasting in handbrake drift
          if (signedSpd > 0) {
            signedSpd = Math.max(0.0, signedSpd - 1.2 * driveInput.handbrake * dt);
          } else {
            signedSpd = Math.min(0.0, signedSpd + 1.2 * driveInput.handbrake * dt);
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
          vForward = accelerateGroundSpeed(vForward, groundDriveAccel(vForward), state.maxSpeed, dt, isStandardEVMode);
          vLateral *= Math.pow(0.002, dt);
        } else if (isAccelerating) {
          if (vForward < -0.5) {
            vForward = Math.min(0.0, vForward + 38.0 * driveInput.throttle * dt);
          } else {
            vForward = accelerateGroundSpeed(vForward, groundDriveAccel(vForward), state.maxSpeed, dt, isStandardEVMode);
          }
          vLateral *= Math.pow(0.004, dt);
        } else if (isFootBraking) {
          if (vForward > 0.1) {
            vForward = Math.max(0.0, vForward - 38.0 * driveInput.brake * dt);
          } else if (vForward < -0.1) {
            vForward = Math.min(0.0, vForward + 38.0 * driveInput.brake * dt);
          } else {
            vForward = 0.0;
          }
          vLateral *= Math.pow(0.004, dt * driveInput.brake);
        } else if (isReversing) {
          if (vForward > 0.3) {
            vForward *= Math.pow(0.95, dt * driveInput.reverse);
          } else if (vForward < -15.0) {
            vForward = Math.min(-15.0, vForward + 38.0 * driveInput.reverse * dt);
          } else {
            vForward = Math.max(-15.0, vForward - 16.0 * driveInput.reverse * dt);
          }
          vLateral *= Math.pow(0.004, dt * driveInput.reverse);
        } else {
          // Match the highway's continuous normal EV overspeed coasting.
          vForward = getGroundCoastSpeed(vForward, dt, isStandardEVMode);
          const wetFriction = (weatherIndex === 1 ? 0.65 : 0.004);
          vLateral *= Math.pow(wetFriction, dt);
        }

        state.vx = newNoseX * vForward + newRightX * vLateral;
        state.vz = newNoseZ * vForward + newRightZ * vLateral;
        state.speed = (vForward >= -0.1 ? 1 : -1) * Math.hypot(state.vx, state.vz);
      }
    }

    // A 300 m city block is traversed in 300 / velocity seconds, on ground or in air.
    const moveScale = CITY_WORLD_SPEED_SCALE;
    if(coastGroundAttached){
      // Gravity projected onto the actual plane, coast only. EV/jet drive and
      // all map1/2 coefficients above remain untouched.
      state.vx += EARTH_GRAVITY_MPS2*coastSupport.normal.x*coastSupport.normal.y*dt;
      state.vz += EARTH_GRAVITY_MPS2*coastSupport.normal.z*coastSupport.normal.y*dt;
    }
    state.x += state.vx * moveScale * dt;
    state.z += state.vz * moveScale * dt;

    const limit = CITY_HALF_BOUND - 2.2;
    const cityWall=currentMap==='city'?cityVisibleBoundaryHit(cityMotionStart,state):null;
    if (currentMap==='city' ? cityWall!==null : Math.abs(state.x) > limit || Math.abs(state.z) > limit) {
      if(cityWall){
        const t=Math.max(0,cityWall.t-1e-5),contactAxis=cityWall.axis;state[contactAxis]=cityMotionStart[contactAxis]+(state[contactAxis]-cityMotionStart[contactAxis])*t;
        // Resolve an initial overlap as well as a swept crossing, otherwise a
        // resting edge can rebound repeatedly on successive frames.
        const body=cityPlayerBody(state),axis=cityWall.axis,n=cityWall.normal,radius=axis==='x'?body.rx:body.rz;
        state[axis]+=cityWall.sign*CITY_HALF_BOUND+n*(1+radius+.005)-body[axis];
        const key=axis==='x'?'vx':'vz',impactV=Math.max(0,-state[key]*n);
        if(impactV>0){state[key]+=1.35*impactV*n;state.speed=isAirborne?Math.hypot(state.vx,state.vz):-state.vx*Math.sin(state.yaw)-state.vz*Math.cos(state.yaw);}
        if(impactV>10){window.RoadsterCityDiagnostics?.contact({kind:'boundary',axis,sign:cityWall.sign,height:45.3,normal:n});triggerPhysicsCollision(impactV,'crashReasonThreshold',0,2,0);}
      } else {
        const impactV = Math.abs(state.speed);
        state.x = THREE.MathUtils.clamp(state.x, -limit, limit);state.z = THREE.MathUtils.clamp(state.z, -limit, limit);
        state.vx *= -0.35;state.vz *= -0.35;
        state.speed = isAirborne ? Math.hypot(state.vx, state.vz) : state.speed * -0.35;
        state.yaw -= wrapAnglePi(state.yaw) * (1.0 - Math.pow(0.10, dt));
        if (impactV > 10.0)triggerPhysicsCollision(impactV, 'crashReasonThreshold', isAirborne ? 0 : -state.vx * 0.4, 2.0, isAirborne ? 0 : -state.vz * 0.4);
      }
    }
  }

  const wantsHover = driveInput.lift > 0;
  if(coastGroundAttached&&wantsHover&&state.airRemaining>0&&!state.isFreefalling){coastGroundAttached=false;state.coastSupportId=null;state.coastDetached=true;isAirborne=true;state.wasAirborne=true;}
  const wantsDescend = driveInput.descend > 0;
  let isLiftFiring = false;
  let isDescendFiring = false;
  let freefallStartVy = null;

  // Coast-only continuous obstacle contact; legacy map1/2 response is unchanged.
  if (coastMotionStart) {
    const contact = globalThis.window?.RoadsterCoast?.clipBuildings(coastMotionStart,state);
    if (contact) { triggerPhysicsCollision(contact.speed,'crashReasonBuilding',0,2,0); if (state.isDestroyed) return; }
  }
  // Sea is not a road: no automatic landing save or recharge before real contact.
  const coastSurface = coastWorld?.support({...state,previousY:coastMotionStart.y,grounded:coastGroundAttached});
  if(coastGroundAttached){
    const reachable=coastSurface?.solid&&Number.isFinite(coastSurface.height)&&Math.abs(coastSurface.height-state.y)<.5;
    if(reachable){
      coastSupport=coastSurface;state.y=coastSupport.height;
      state.vy=-(coastSupport.normal.x*state.vx+coastSupport.normal.z*state.vz)/coastSupport.normal.y;
      state.coastSupportId=coastSupport.id;
    }else{coastGroundAttached=false;isAirborne=true;state.wasAirborne=true;state.coastSupportId=null;}
  }
  if (coastSurface?.water) state.isAutoLandingSave = false;
  // Recompute surface elevation after horizontal (x, z) movement
  groundElevation = Number.isFinite(coastSurface?.height) ? coastSurface.height : 0.0;
  if (currentMap === 'city' || currentMap === 'coast') {
    const mapBuildings = coastObstacles || cityNearbyBuildings(state);
    for (let i = 0; i < mapBuildings.length; i++) {
      const b = mapBuildings[i];
      if (coastWorld && state.y + 1.25 < (b.minY ?? 0)) continue;
      if (currentMap === 'city' ? cityTouchesRoof(state,b) : state.x > b.minX - 1.1 && state.x < b.maxX + 1.1 && state.z > b.minZ - 1.8 && state.z < b.maxZ + 1.8) {
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
    !coastSurface?.water && isDescendingTowardsGround &&
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
    isLiftFiring = consumeAirTank(dt, true);
    // Smooth upward deceleration towards soft touchdown speed (-1.5 m/s).
    // An exhausted tank cannot supply a final frame of free braking.
    if (isLiftFiring) state.vy = Math.min(-1.5, state.vy + AUTO_BRAKE_ACCEL * dt);
    else state.isAutoLandingSave = false;

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

      if (stepDt === 0 || consumeAirTank(jumpBurnRatePerSec * stepDt, true)) {
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
      if (consumeAirTank(dt * driveInput.lift, true)) {
        if (state.isAutoDescending8s) {
          isLiftFiring = true;
          state.vy += (-3.2 - state.vy) * 6.0 * dt;
        } else {
          state.isAutoDescending8s = false;
          isLiftFiring = true;
          const maxAirVy = currentMaxClimbVy * 1.35;
          // Full stick matches Space. Partial thrust pays for and supplies only
          // its share of lift, including the force that counteracts gravity.
          const liftAccel = (currentLiftAccel + EARTH_GRAVITY_MPS2) * driveInput.lift - EARTH_GRAVITY_MPS2;
          state.vy = Math.min(maxAirVy, state.vy + liftAccel * dt);
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
    }

    if (wantsDescend && agl > 0.02) {
      if (!state.isFreefalling && state.airRemaining > 0 && consumeAirTank(0.55 * driveInput.descend * dt, true)) {
        isDescendFiring = true;
        state.vy -= 18.5 * driveInput.descend * dt;
      }
    }
  }

  // Tank contents and physics mode do not change Earth gravity. This also
  // runs if a lift/hold/jump/save request depleted its tank in this frame.
  if (!coastGroundAttached && !isLiftFiring && (agl > 0 || state.vy > 0)) {
    freefallStartVy = state.vy;
    state.vy -= EARTH_GRAVITY_MPS2 * dt;
  }

  const prevY = state.y;
  if (coastGroundAttached && !isLiftFiring) {
    state.y = coastSupport.height;
  } else if (freefallStartVy !== null && !isDescendFiring) {
    const next = integrateFreefall(state.y, freefallStartVy, dt, coastWorld?-Infinity:groundElevation);
    state.y = next.y;
    state.vy = next.vy;
  } else {
    state.y += state.vy * dt;
  }
  const prevVy = state.vy;
  if (state.y > MAX_FLIGHT_ALTITUDE) {
    state.y = MAX_FLIGHT_ALTITUDE;
    state.vy = Math.min(0, state.vy);
  }

  // Top, bottom and bounded structural contacts are different events.
  const coastStructureHit=coastWorld?.network?.sweepStructures(coastMotionStart,state);
  if(coastStructureHit){
    const h=coastStructureHit,t=Math.max(0,h.t-1e-5),n=h.normal;
    const inward=state.vx*n.x+state.vy*n.y+state.vz*n.z,impact=Math.max(0,-inward);
    state.x=coastMotionStart.x+(state.x-coastMotionStart.x)*t;state.z=coastMotionStart.z+(state.z-coastMotionStart.z)*t;
    state.y=h.kind==='ceiling'?h.height-.002:coastMotionStart.y+(state.y-coastMotionStart.y)*t;
    if(inward<0){state.vx-=1.25*inward*n.x;state.vy-=1.25*inward*n.y;state.vz-=1.25*inward*n.z;}
    if(h.kind==='ceiling'){state.isJumping6m=false;state.isAltitudeHold=false;}
    state.speed=(state.vx*-Math.sin(state.yaw)+state.vz*-Math.cos(state.yaw)>=0?1:-1)*Math.hypot(state.vx,state.vz);
    if(coastGroundAttached)state.vy=-(coastSupport.normal.x*state.vx+coastSupport.normal.z*state.vz)/coastSupport.normal.y;
    triggerPhysicsCollision(impact,'crashReasonBuilding',0,1,0);if(state.isDestroyed)return;
  }
  const coastLanding=coastWorld&&!coastGroundAttached?coastWorld.network.sweepLanding(coastMotionStart,state):null;
  const contactFloorY = coastWorld ? (coastGroundAttached?coastSupport.height:coastLanding?.height??(coastSurface?.water?coastSurface.height:-Infinity)) : 0;
  if ((coastGroundAttached || coastLanding || state.vy <= 0) && state.y <= contactFloorY+(coastWorld ? .00001 : 0)) {
    if (coastSurface?.water&&!coastLanding) { resetCar(); return; }
    state.y = contactFloorY;
    if(coastLanding){state.x=coastLanding.x;state.z=coastLanding.z;}
    state.jumpInertiaGraceSeconds = null;
    const downImpactSpeed = coastWorld
      ? coastGroundAttached?0:Math.max(0,-(state.vx*(coastLanding?.normal.x||0)+prevVy*(coastLanding?.normal.y||1)+state.vz*(coastLanding?.normal.z||0)))
      : -prevVy;
    if (downImpactSpeed > 0.8) {
      state.suspensionSquash = Math.min(0.048, downImpactSpeed * 0.0035);
      state.suspensionVelocity = downImpactSpeed * 0.004;
    }
    state.vy = 0.0;
    if(coastWorld){coastSupport=coastLanding||coastSupport;coastGroundAttached=true;state.coastSupportId=coastSupport.id;state.wasAirborne=false;groundElevation=coastSupport.height;state.vy=-(coastSupport.normal.x*state.vx+coastSupport.normal.z*state.vz)/coastSupport.normal.y;}
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
      if(currentMap==='city')window.RoadsterCityDiagnostics?.contact({kind:'ground',height:0,previousY:prevY,downImpactSpeed,cosTilt});
      triggerPhysicsCollision(effectiveDv, 'crashReasonGround', 0, 3.0, 0);
      if (state.isDestroyed) return;
    }

    // A firing retro jet uses the same tank; never recharge over its burn.
    if (!(coastWorld&&coastSupport?.id==='roof') && !isRetroBrakeFiring && ((!wantsHover && !isRearThrusterFiring) || state.isFreefalling)) {
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
    const rcsBurn = (isAirborne ? 0.38 : 0.22) * Math.max(Math.abs(rawRollInput), Math.abs(rawPitchInput), Math.abs(rawYawInput)) * dt;
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

  if(coastGroundAttached){
    const plane=coastWorld.network.groundAttitude(coastSupport.normal,state.yaw);
    state.pitch=plane.pitch;state.roll=plane.roll;state.vPitch=state.vRoll=0;
  }
  const trueGroundAgl = Math.max(0.0, state.y - groundElevation);
  if (trueGroundAgl < 0.35) {
    const maxGroundPitch = THREE.MathUtils.lerp(0.14, 1.30, THREE.MathUtils.clamp(trueGroundAgl / 0.35, 0.0, 1.0));
    const slope=coastGroundAttached?coastWorld.network.groundAttitude(coastSupport.normal,state.yaw):{pitch:0,roll:0};
    const groundPitch = wrapAnglePi(state.pitch-slope.pitch);
    state.pitch += THREE.MathUtils.clamp(groundPitch, -maxGroundPitch, maxGroundPitch) - groundPitch;
    const maxGroundRoll = THREE.MathUtils.lerp(0.18, 3.14, THREE.MathUtils.clamp(trueGroundAgl / 0.35, 0.0, 1.0));
    state.roll = slope.roll+THREE.MathUtils.clamp(state.roll-slope.roll, -maxGroundRoll, maxGroundRoll);
    if (currentMap === 'highway' && trueGroundAgl < 0.15) {
      const groundYaw = wrapAnglePi(state.yaw);
      state.yaw += THREE.MathUtils.clamp(groundYaw, -0.85, 0.85) - groundYaw;
    }
    state.accumulatedRoll = 0;
  } else {
    state.accumulatedRoll += Math.abs(state.vRoll * dt);
    if (state.accumulatedRoll >= Math.PI * 1.85) {
      state.accumulatedRoll = 0;
      showBanner('stunt', 2.2);
      sound.beep(880, 0.18);
    }
  }

  if (currentMap === 'city' || currentMap === 'coast') {
    const mapBuildings = coastObstacles || cityNearbyBuildings(state);
    for (let i = 0; i < mapBuildings.length; i++) {
      const b = mapBuildings[i];
      if (coastWorld && state.y + 1.25 < (b.minY ?? 0)) continue;
      if (currentMap === 'city' ? cityTouchesBuilding(state,b) : state.x > b.minX - 1.1 && state.x < b.maxX + 1.1 && state.z > b.minZ - 1.8 && state.z < b.maxZ + 1.8) {
        if (state.y > b.height + 0.08) {
          // Flying freely in the air above the building roof — do NOT teleport or snap down!
          continue;
        } else if (prevY >= b.height - 0.55 && state.y <= b.height && state.vy <= 0 && (currentMap!=='city'||cityCanLandOnRoof(state,b))) {
          // Actually touching down onto or resting on the building roof
          const downImpactSpeed = -prevVy;
          if (downImpactSpeed > 0.8) {
            state.suspensionSquash = Math.min(0.048, downImpactSpeed * 0.0035);
            state.suspensionVelocity = downImpactSpeed * 0.004;
          }
          const cosTilt = Math.cos(state.roll) * Math.cos(state.pitch);
          state.y = b.height;
          state.vy = 0;
          if(coastWorld){coastSupport={id:'roof',height:b.height,solid:true,water:false,normal:{x:0,y:1,z:0}};coastGroundAttached=true;isAirborne=false;state.wasAirborne=false;state.coastSupportId='roof';}
          state.isAutoLandingSave = false;
          state.isJumping6m = false;
          if (state.isAltitudeHold) {
            state.isAltitudeHold = false;
            const nBadge = document.getElementById('key-n');
            if (nBadge) nBadge.classList.remove('active');
          }

          if (downImpactSpeed > 15.5 || (downImpactSpeed > 7.5 && cosTilt < 0.25)) {
            const effectiveDv = downImpactSpeed * (cosTilt < 0.25 ? 1.85 : 1.15);
            if(currentMap==='city')window.RoadsterCityDiagnostics?.contact({kind:'building-roof',id:b.id,logicalId:b.logicalId,bounds:{minX:b.minX,maxX:b.maxX,minZ:b.minZ,maxZ:b.maxZ,minY:b.minY||0,height:b.height},verifiedSolid:true,downImpactSpeed,cosTilt});
            triggerPhysicsCollision(effectiveDv, 'crashReasonGround', 0, 3.0, 0);
            if (state.isDestroyed) return;
          }

          // Roofs/helipads obey the same no-refill-while-firing rule as roads.
          if (!isRetroBrakeFiring && !isRearThrusterFiring && !isLiftFiring && !isDescendFiring) {
            const rechargeRate = b.isHelipad ? 10.0 : 4.0;
            state.airRemaining = Math.min(MAX_AIR_SECONDS, state.airRemaining + rechargeRate * dt);
            state.airUsedContinuous = MAX_AIR_SECONDS - state.airRemaining;
            state.isFreefalling = false;
            state.isAutoDescending8s = false;
          }
          if (b.isHelipad && !state.hasTriggeredHelipad) {
            state.hasTriggeredHelipad = true;
            showBanner('helipad', 2.8);
            sound.speakAlert('helipad', 'Helipad touchdown. Release thrusters to recharge the tank.', '停机坪降落成功，松开喷气后补充高压气瓶。');
          }
        } else if (state.y < b.height - 0.55) {
          if(currentMap==='city'){
            const contact=cityBuildingContact(state,b);if(!contact)continue;
            state.x+=contact.x*(contact.depth+.005);state.z+=contact.z*(contact.depth+.005);
            const normalSpeed=Math.max(0,-state.vx*contact.x-state.vz*contact.z);
            if(normalSpeed>.1){
              state.vx+=1.3*normalSpeed*contact.x;state.vz+=1.3*normalSpeed*contact.z;
              state.speed=isAirborne?Math.hypot(state.vx,state.vz):-state.vx*Math.sin(state.yaw)-state.vz*Math.cos(state.yaw);
              window.RoadsterCityDiagnostics?.contact({kind:'building-wall',id:b.id,logicalId:b.logicalId,bounds:{minX:b.minX,maxX:b.maxX,minZ:b.minZ,maxZ:b.maxZ,minY:b.minY||0,height:b.height},verifiedSolid:true,normal:contact});
              triggerPhysicsCollision(Math.max(12,normalSpeed),'crashReasonThreshold',0,2,0);if(state.isDestroyed)return;
            }
            continue;
          }
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
  const targetWingY = ((currentMap==='coast'?state.y-groundElevation:state.y) > 0.2 || isAccelerating) ? 0.94 : (isAirBrakingActive ? 0.96 : 0.79);
  const targetWingAngle = isAirBrakingActive ? -0.72 : (((currentMap==='coast'?state.y-groundElevation:state.y) > 0.2) ? -0.28 : -0.05);
  activeWingGroup.position.y += (targetWingY - activeWingGroup.position.y) * 8 * dt;
  activeWingGroup.rotation.x += (targetWingAngle - activeWingGroup.rotation.x) * 8 * dt;

  // 4 Rear Nozzles Dynamic Gimbal Thrust-Vectoring (+/- 6° responsive pivot on pitch/yaw input)
  const targetGimbalPitch = THREE.MathUtils.clamp(-state.vPitch * 0.06 - (pitchInput * 0.10), -0.14, 0.14);
  const targetGimbalYaw = THREE.MathUtils.clamp(-state.vYaw * 0.05 - (yawInput * 0.10), -0.14, 0.14);
  rearNozzlesGimbalGroup.rotation.x += (targetGimbalPitch - rearNozzlesGimbalGroup.rotation.x) * 12 * dt;
  rearNozzlesGimbalGroup.rotation.y += (targetGimbalYaw - rearNozzlesGimbalGroup.rotation.y) * 12 * dt;

  // True kinematic wheel rotation matching calibrated world speed (v / wheelRadius)
  const wheelSpinSpeed = (state.speed * (currentMap === 'highway' ? WORLD_SPEED_SCALE : CITY_WORLD_SPEED_SCALE)) / 0.335;
  wheels.forEach(w => { w.rotation.x -= wheelSpinSpeed * dt; });

  const isCockpitFpv = (cameraModeIndex === 3);
  const rearActive = isRearThrusterFiring || (isRetroBrakeFiring && retroUsesRearNozzles);
  const rearVisualPower = isRearThrusterFiring ? Math.max(driveInput.boost, isAirborne ? driveInput.throttle : 0) : 0;
  const liftVisualPower = isLiftFiring
    ? (state.isAutoLandingSave ? 1 : (state.isAutoDescending8s ? 0.45 : 1) * (wantsHover ? driveInput.lift : state.isAltitudeHold ? 0.22 : 1))
    : 0;

  // Rendering reads the already-paid brake request. It never consumes fuel.
  const isFrontRetroFiring = isRetroBrakeFiring && !retroUsesRearNozzles;
  const retroVisualPower = dt > 0 ? Math.min(1, retroImpulseSeconds / dt) : 0;
  // Paid attitude and strafe inputs share physical outlets; no inferred idle firing.
  const strafeVisualPower = airJetLeft || airJetRight ? driveInput.strafe : 0;
  updateColdGasVisuals(dt, isCockpitFpv, rearVisualPower, retroVisualPower, retroUsesRearNozzles,
    liftVisualPower, isDescendFiring ? driveInput.descend : 0,
    rollInput, pitchInput, yawInput, strafeVisualPower, retroVisualVx, retroVisualVy, retroVisualVz);

  const rcsRollPitchActive = canUseRCS && (rollInput !== 0 || pitchInput !== 0);
  const rcsYawRetroActive = (canUseRCS && (yawInput !== 0 || airJetLeft || airJetRight)) || isDescendFiring || isFrontRetroFiring;
  if (presentFrame) {
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
  const noz9 = document.getElementById('noz-9');
  const noz10 = document.getElementById('noz-10');
  if (noz9) noz9.classList.toggle('firing', rcsRollPitchActive);
  if (noz10) noz10.classList.toggle('firing', rcsYawRetroActive);
  if (rcsRollPitchActive) activeCount++;
  if (rcsYawRetroActive) activeCount++;
  document.getElementById('val-active-nozzles').textContent = `${activeCount}${t.activeSuffix}`;
  }

  if (currentMap === 'highway') {
    highwayTraffic.step(trafficCars, { x: state.x, y: state.y, z: 0, vx: state.vx, vz: state.vz }, dt, LANE_CENTERS, WORLD_SPEED_SCALE);
  }

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

  if (currentMap === 'coast') globalThis.window?.RoadsterCoast?.stepTraffic(trafficCars,state,dt);
  trafficCars.forEach((car) => {
    if (car.mode === 'coast' && (car.coastWaiting || car.mesh.visible === false)) return;
    if(currentMap==='city'&&car.mesh.visible===false)return;
    if (car.mesh.userData.wheels) {
      const wRot = (car.speed * (currentMap === 'highway' ? WORLD_SPEED_SCALE : CITY_WORLD_SPEED_SCALE) / 0.33) * dt;
      car.mesh.userData.wheels.forEach((w) => { w.rotation.x -= wRot; });
    }

    // Coast traffic owns its path/blast/recovery state, never the city's wrap.
    if (currentMap === 'coast') {
      // Already advanced above, including hidden safe respawn after a blast.
    } else if (car.blastTimer && car.blastTimer > 0) {
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
      if (currentMap === 'highway' &&
          (car.blastTimer <= 0.01 || highwayTraffic.isOutOfBounds(car, LANE_CENTERS, { z: 0 }))) {
        highwayTraffic.respawnBehind(car, trafficCars, LANE_CENTERS,
          { x: state.x, y: state.y, z: 0, vx: state.vx, vz: state.vz }, WORLD_SPEED_SCALE);
      } else if (car.blastTimer <= 0.01) {
        car.y = 0.0;
        car.mesh.position.y = 0.0;
        car.mesh.rotation.x = 0.0;
        car.mesh.rotation.z = 0.0;
        if (currentMap === 'city' && typeof car.baseRotY === 'number') {
          car.mesh.rotation.y = car.baseRotY;
        }
      }
    } else if (currentMap === 'highway') {
      if (car.highwayPassedThisFrame) {
        if (!state.isDestroyed) {
          state.carsCleared += 1;
        }
      }
    } else {
      advanceCityTraffic(car,dt);
    }

    if (currentMap === 'highway' && car.highwayWaitingToSpawn !== undefined) return;
    const dx = Math.abs(state.x - car.mesh.position.x);
    const dz = Math.abs(playerWorldZ - car.mesh.position.z);
    const npcWorldY=currentMap==='coast'||currentMap==='city'?(car.mesh.position.y||0):0;
    let clearanceY = state.y - npcWorldY - car.height;

    // The faster demo rack also checks the complete relative movement chord.
    // A narrow corner contact cannot disappear between frames. Respawn jumps
    // are excluded; manual collision detection and response stay unchanged.
    const demoPreviousCar = demoGroundSweep?.cars.get(car);
    const demoSweptHit = demoPreviousCar && car.mesh.visible!==false && car.highwayWaitingToSpawn===undefined
      && !car.highwayPassedThisFrame && Math.abs(car.mesh.position.z-demoPreviousCar.z)<2+dt*(Math.abs(state.vz)+Math.abs(car.speed))*WORLD_SPEED_SCALE
      && demoGroundSweep.y<car.height-0.15 && state.y<car.height-0.15
      ? RoadsterHighwayDemoPlanner.sweptContact(demoPreviousCar.x-demoGroundSweep.x,demoPreviousCar.z,
        car.mesh.position.x-state.x,car.mesh.position.z,1.85,car.length/2+2.15)!==null : false;
    const coastOld = currentMap === 'coast' ? coastTrafficStart?.get(car) : null;
    const coastVisualEnd=currentMap==='coast'?{...state,y:state.y-(state.suspensionSquash||0)-(state.aeroSquash||0),pitch:state.pitch+(!isAirborne?(typeof isAccelerating!=='undefined'&&isAccelerating?(typeof isRearThrusterFiring!=='undefined'&&isRearThrusterFiring ? .032 : .016):(typeof isFootBraking!=='undefined'&&isFootBraking||typeof isReversing!=='undefined'&&isReversing)?-.026:0):0),roll:state.roll+(!isAirborne?-(state.steerInput||0)*.032:0)}:null;
    const coastContact=currentMap==='coast'&&coastOld&&coastOld.visible!==false&&car.mode==='coast'&&!car.blastTimer?coastVehicleContact(coastMotionStart.contactPose||coastMotionStart,coastVisualEnd,coastOld,car):null;
    if(coastContact){
      const relVx=state.vx-(car.vx||0),relVy=state.vy-(car.vy||0),relVz=state.vz-(car.vz||0),closing=Math.max(0,-relVx*coastContact.x-relVy*coastContact.y-relVz*coastContact.z+coastContact.angularClosingPerFraction/Math.max(dt,1e-6));
      // Rewind only the player to certified first contact. NPC route distance
      // remains authoritative; a normal impulse does not reverse tangent speed.
      const t=Math.max(0,coastContact.t-1e-6);for(const k of['x','y','z'])state[k]=coastMotionStart[k]+(state[k]-coastMotionStart[k])*t;
      const endContact=coastContactSeparation(cityPlayerBody({...state,y:state.y-(state.suspensionSquash||0)-(state.aeroSquash||0),pitch:coastVisualEnd.pitch,roll:coastVisualEnd.roll}),coastTrafficBody(car,{x:car.mesh.position.x,y:car.mesh.position.y,z:car.mesh.position.z,pitch:car.mesh.rotation.x,yaw:car.mesh.rotation.y,roll:car.mesh.rotation.z}));
      const push=endContact.gap<0?endContact.depth+.0001:.0001,pushNormal=endContact.gap<0?endContact:coastContact;state.x+=pushNormal.x*push;state.y+=pushNormal.y*push;state.z+=pushNormal.z*push;
      if(coastContact.y>.65&&state.vy<0&&closing<=18){state.vy=Math.max(5.5,state.vy+closing*coastContact.y);sound.beep(520,.08);}
      else if(closing>.1){globalThis.window?.RoadsterCoast?.hit(car);state.vx+=1.35*closing*coastContact.x;state.vy+=1.35*closing*coastContact.y;state.vz+=1.35*closing*coastContact.z;triggerPhysicsCollision(closing,'crashReasonThreshold',0,0,0);}
      state.speed=isAirborne?Math.hypot(state.vx,state.vz):-state.vx*Math.sin(state.yaw)-state.vz*Math.cos(state.yaw);return;
    }
    // No other coastal AABB/roof-cushion path may promote a broad-phase gap.
    if(currentMap==='coast')return;
    const cityNear=currentMap==='city'&&dx<10&&dz<10&&Math.abs(state.y-npcWorldY)<10;
    const cityPlayer=cityNear?cityPlayerBody(state):null,cityNpc=cityNear?cityTrafficBody(car):null;
    // Preserve the existing gentle roof-touch cushion separately from solid-body
    // contact. It may bounce a descending car, never trigger a side-gap crash.
    const cityRoofTouch=cityNear&&clearanceY>=-.15&&clearanceY<.15&&state.vy<0&&state.vy>=-18&&cityHorizontalContact(cityPlayer,cityNpc);
    const citySolidContact=cityNear&&cityContactInterval(cityPlayer,cityNpc)!==null;
    const cityBodyOverlap=cityNear&&(cityRoofTouch||citySolidContact);
    const bodyOverlap = currentMap==='city'?cityBodyOverlap:dx < 1.85 && dz < (car.length / 2 + 2.15);
    if (bodyOverlap || demoSweptHit) {
      if (clearanceY >= -0.15 && clearanceY < 1.1) {
        if (state.vy < -18.0 && (currentMap!=='city'||citySolidContact)) {
          if(currentMap==='city')window.RoadsterCityDiagnostics?.contact({kind:'traffic-roof',variant:car.mesh.userData?.trafficVariant,position:{...car.mesh.position},verifiedSolid:citySolidContact});
          triggerPhysicsCollision(Math.abs(state.vy), 'crashReasonThreshold', 0, 5.0, 0);
        } else if (state.vy < 0 && clearanceY < 0.15) {
          state.y = npcWorldY + car.height + 0.15;
          state.vy = 5.5;
          sound.beep(520, 0.08);
        }
      } else if (clearanceY < -0.15) {
        const relVx = state.vx - (car.vx || 0);
        const relVz = state.vz - (car.vz || 0);
        if(currentMap==='city'){
          const contact=cityContactDetails(cityPlayerBody(state),cityTrafficBody(car));if(!contact)return;
          state.x+=contact.x*(contact.depth+.005);state.y+=contact.y*(contact.depth+.005);state.z+=contact.z*(contact.depth+.005);
          const npcVy=car.blastTimer?(car.blastVy||0):0,normalSpeed=Math.max(0,-relVx*contact.x-(state.vy-npcVy)*contact.y-relVz*contact.z);
          if(normalSpeed>.1){window.RoadsterCityDiagnostics?.contact({kind:'traffic-body',variant:car.mesh.userData?.trafficVariant,position:{x:car.mesh.position.x,y:car.mesh.position.y,z:car.mesh.position.z},verifiedSolid:true,normal:contact});state.vx+=1.35*normalSpeed*contact.x;state.vy+=1.35*normalSpeed*contact.y;state.vz+=1.35*normalSpeed*contact.z;state.speed=isAirborne?Math.hypot(state.vx,state.vz):-state.vx*Math.sin(state.yaw)-state.vz*Math.cos(state.yaw);triggerPhysicsCollision(normalSpeed,'crashReasonThreshold',0,0,0);}
          return;
        }
        const deltaV = Math.hypot(relVx, relVz, (state.vy-(currentMap==='coast'?(car.vy||0):0)) * 0.5);

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

  // Render the resolved pose after traffic contact (which can change state.y).
  const visualY = currentMap==='coast' ? state.y-(state.suspensionSquash||0)-(state.aeroSquash||0) : Math.max(groundElevation, state.y - (state.suspensionSquash || 0) - (state.aeroSquash || 0));
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

  RoadsterDrivingScore.segment(state, dt, scoreMotionStart, RoadsterDrivingScore.motion(state, currentMap, isAirborne));

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

  const totalAirSpeedMs = RoadsterDrivingScore.displayedSpeed(state, isAirborne);
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
  const wingCl = isAirBrakingActive ? 0.72 : (((currentMap==='coast'?state.y-groundElevation:state.y) > 0.2) ? 0.48 : 0.24);
  const wingDownforce = 0.5 * 1.225 * wingCl * 1.64 * (state.speed * state.speed);
  const trueRideHeight = Math.max(0.0, state.y - groundElevation);
  // Ground effect suction decays inversely with ride height squared
  const groundProximity = 1.0 / (1.0 + 9.0 * trueRideHeight * trueRideHeight);
  const groundEffectN = (Math.abs(state.speed) > 4.0) ? (4200.0 * groundProximity) : 0.0;
  state.downforceN = Math.round(wingDownforce + groundEffectN);

  // Existing gameplay threshold and sound stay intact. The visual is a brief,
  // stylized condensation pulse; 230 mph does not represent real Mach 1.
  const crossedSonicThreshold = isSupersonic && !state.wasSupersonic;
  if (crossedSonicThreshold) {
    state.wasSupersonic = true;
    state.cameraShake = Math.max(state.cameraShake, 0.38);
    sound.playSonicBoom();
    sound.speakAlert('sonicboom', 'High-speed threshold reached. Condensation pulse.', '已达到高速阈值，凝结气流脉冲。');
    showBanner('sonic', 2.8);
  } else if (mph < 215) {
    state.wasSupersonic = false;
  }
  updateSonicCondensation(dt, crossedSonicThreshold, isCockpitFpv, isSupersonic);

  // Requirement 5: Left/right ground steering sound removed completely
  tireScreechIntensity = 0.0;

  updateWindshieldRain(dt);

  // Update 3D Rain Particles & Lightning Thunder in Cyber Neon Rain (weatherIndex === 1)
  if (weatherIndex === 1 && rainLinesMesh.visible) {
    updateExteriorRain(dt);

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

  // Capture resolved thrust, not Web Audio automation, on each city physics tick.
  // The render owner below samples fresh speed/input even on a zero-tick frame.
  if (cityOwnsDrivingSound()) {
    citySoundFrame = {
      thrust: isLiftFiring || isRearThrusterFiring || (isRetroBrakeFiring && driveInput.reverse > 0),
      attitude: ((rollInput !== 0 || pitchInput !== 0 || yawInput !== 0 || airJetLeft || airJetRight) && canUseRCS) || (isFrontRetroFiring && driveInput.reverse > 0),
      tires: tireScreechIntensity
    };
  }
  if (coastOwnsDrivingSound()) {
    coastSoundFrame = {
      thrust: isLiftFiring || isRearThrusterFiring || (isRetroBrakeFiring && driveInput.reverse > 0),
      attitude: ((rollInput !== 0 || pitchInput !== 0 || yawInput !== 0 || airJetLeft || airJetRight) && canUseRCS) || (isFrontRetroFiring && driveInput.reverse > 0),
      tires: tireScreechIntensity
    };
  }

  // The physics, contact, scoring, G/thermal/downforce feedback above still run
  // every city tick. Expensive canvas/DOM/camera presentation runs once per
  // rendered frame, not six times on a 10 fps phone.
  if (!presentFrame) {
    if (state.bannerTimer > 0) {
      state.bannerTimer = Math.max(0, state.bannerTimer - dt);
      if (state.bannerTimer === 0) renderBannerText();
    }
    return;
  }

  // Requirement 7: Constant 60° FOV and zero camera zoom/flicker in Cockpit FPV
  const cameraDt = typeof presentationDt === 'number' ? presentationDt : dt;
  const isAnyThrust = isLiftFiring || rearActive || isFrontRetroFiring;
  if (camera.fov !== 60) {
    camera.fov = 60;
    camera.updateProjectionMatrix();
  }

  const targetShake = isCockpitFpv
    ? 0.0
    : ((isAnyThrust ? 0.025 : 0.0) + (isSupersonic ? 0.032 : 0.0) + (state.impactCooldown > 0 ? 0.14 : 0.0));
  state.cameraShake = isCockpitFpv ? 0.0 : THREE.MathUtils.lerp(state.cameraShake || 0, targetShake, 1.0 - Math.exp(-12.0 * cameraDt));
  const shakeX = (Math.random() - 0.5) * state.cameraShake;
  const shakeY = (Math.random() - 0.5) * state.cameraShake;
  const shakeZ = (Math.random() - 0.5) * state.cameraShake;

  // Reset camera.up unless in 6-DOF Cockpit FPV
  camera.up.set(0, 1, 0);
  // Fix Issue 5: Dynamically scale camera.near with altitude in 3rd-person views so depth buffer
  // precision remains ultra-crisp at 30m–380m altitude and completely prevents ground Z-fighting!
  const desiredNear = isCockpitFpv
    ? 0.08
    : THREE.MathUtils.clamp(0.38 + Math.max(0.0,currentMap==='coast'?state.y-groundElevation:state.y) * 0.045, 0.38, 3.2);
  roadsterCanopyMesh.visible = !isCockpitFpv;
  setCockpitPerspective(isCockpitFpv);
  setCockpitExteriorDetailsVisible(!isCockpitFpv);
  if (typeof hudCombinerMesh !== "undefined") hudCombinerMesh.visible = false;

  if (cameraModeIndex !== 0) resetChaseCamera();

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
    const eyeLocal = new THREE.Vector3(0.0, COCKPIT_VIEW.eyeHeight, COCKPIT_VIEW.eyeZ);
    const forwardLocal = new THREE.Vector3(0.0, -COCKPIT_VIEW.downwardSlope, -1.0).normalize();
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
      updateChaseCamera(
        { x: state.x, y: visualY, z: playerWorldZ },
        { x: -state.x * 0.18, y: 1.48 + 1.05 * zoom + Math.min(1.8, airOffset * 0.12) + Math.sin(state.pitch) * 0.85, z: Math.max(3.6, 5.2 * zoom) },
        { x: 0, y: 0.65 + Math.sin(state.pitch) * 2.2, z: -9 },
        cameraDt, { x: shakeX, y: shakeY, z: shakeZ }
      );
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
      updateChaseCamera(
        { x: state.x, y: visualY, z: playerWorldZ },
        { x: sinY * distBack, y: 1.54 + 1.05 * zoom + Math.min(1.8, airOffset * 0.12) + Math.sin(state.pitch) * 0.85, z: cosY * distBack },
        { x: -sinY * 10, y: 0.65 + Math.sin(state.pitch) * 2.2, z: -cosY * 10 },
        cameraDt, { x: shakeX, y: shakeY, z: shakeZ }
      );
    } else {
      camera.position.set(state.x + sinY * 11.5 * zoom + shakeX, state.y + 10.5 * zoom + shakeY, state.z + cosY * 11.5 * zoom + shakeZ);
      camera.lookAt(state.x, state.y, state.z);
    }
  }

  const resolvedNear=isCockpitFpv?desiredNear:vehicleSafeCameraNear(desiredNear,camera,{x:state.x,y:visualY,z:playerWorldZ,pitch:roadsterAttitudeGroup.rotation.x,yaw:roadsterAttitudeGroup.rotation.y,roll:roadsterAttitudeGroup.rotation.z});
  // Apply once after the final camera transform; avoid two projection updates
  // per frame when altitude precision and close-up visibility disagree.
  if(Math.abs(camera.near-resolvedNear)>1e-5){camera.near=resolvedNear;camera.updateProjectionMatrix();}

  if (state.bannerTimer > 0) {
    state.bannerTimer -= dt;
    if (state.bannerTimer <= 0) renderBannerText();
  }

  const anyAttitude = (rollInput !== 0 || pitchInput !== 0 || yawInput !== 0 || airJetLeft || airJetRight) && canUseRCS;
  if (!cityOwnsDrivingSound() && !coastOwnsDrivingSound()) sound.update(
    // Stable 200 km/h audio reference: boost changes performance, not rev ratio.
    Math.abs(state.speed) / (200.0 / 3.6),
    isLiftFiring || isRearThrusterFiring || (isRetroBrakeFiring && driveInput.reverse > 0),
    anyAttitude || (isFrontRetroFiring && driveInput.reverse > 0),
    false,
    tireScreechIntensity,
    Math.max(driveInput.throttle, driveInput.boost, driveInput.reverse)
  );

  // Update Live Cockpit Center Touchscreen & Speed/Rain Overlay Canvas
  updateCockpitHudScreen(mph, kmh, rearActive, isLiftFiring, isFrontRetroFiring, rcsRollPitchActive, rcsYawRetroActive);
  updateSpeedAndWeatherOverlay(cameraDt, mph, isAnyThrust, isSupersonic);

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
    // 600 L / 10 tank-seconds. Measure the actual shared ledger, including
    // feathered/partial retro burns, without counting the same nozzle twice.
    const flowLps = dt > 0 ? Math.round(airConsumedThisFrame * 60 / dt) : 0;
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

  const tank = getAirTankReadout(state.airRemaining);
  const pct = tank.fraction * 100;
  const gasMassEl = document.getElementById('val-gas-mass');
  if (gasMassEl) gasMassEl.textContent = `${tank.massKg.toFixed(1)} kg`;
  document.getElementById('val-air-sec').textContent = `${tank.seconds.toFixed(1)}s`;

  const barFill = document.getElementById('air-bar-fill');
  barFill.style.width = `${pct}%`;

  const tankBadge = document.getElementById('ui-tank-state-badge');
  const modeBadge = document.getElementById('ui-flight-mode');

  if (state.isFreefalling) {
    barFill.className = 'h-full rounded-md bg-rose-600 transition-all duration-75';
    tankBadge.textContent = t.badgeDepleted;
    tankBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-300 border border-rose-400';
    modeBadge.textContent = isAirborne && !state.groundHopActive ? t.modeFreefall : isAirborne ? t.modeHover : t.modeGround;
    modeBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-300';
  } else if (state.isAutoDescending8s) {
    barFill.className = 'h-full rounded-md bg-amber-400 transition-all duration-75';
    tankBadge.textContent = t.badge8sWarn;
    tankBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300 border border-amber-400';
    modeBadge.textContent = t.modeAutoDescend;
    modeBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300';
  } else if (isRetroBrakeFiring) {
    barFill.className = 'h-full rounded-md bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-75';
    tankBadge.textContent = t.badgeRetroBrake;
    tankBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/30 text-cyan-200 border border-cyan-400';
    modeBadge.textContent = t.badgeRetroBrake;
    modeBadge.className = 'text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/30 text-cyan-300';
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
    modeBadge.textContent = (currentMap==='coast'?state.y-groundElevation:state.y) > 0.15 ? t.modeHover : t.modeGround;
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
  document.getElementById('val-score').textContent = state.score;
  const downforceEl = document.getElementById('val-downforce');
  if (downforceEl) downforceEl.textContent = `${state.downforceN || 0} N`;
  const tireTempEl = document.getElementById('val-tire-temp');
  if (tireTempEl) tireTempEl.textContent = `${Math.round(state.tireTemp || 35)}°C (μ ${(state.tireGripMu || 1.0).toFixed(2)})`;
};
export const declaredTriggerJump6m = function triggerJump6m() {
  if (globalThis.window?.RoadsterDemo?.isBusy() && !window.RoadsterDemo.isRequestingJump()) return;
  if (state.isDestroyed || state.isFreefalling || state.airRemaining <= 0.15) return;
  sound.init();
  let groundElev = currentMap === 'coast' ? (globalThis.window?.RoadsterCoast?.support({...state,grounded:!state.wasAirborne}).height ?? 0) : 0;
  if ((currentMap === 'city' && typeof cityBuildings !== 'undefined') || currentMap === 'coast') {
    const mapBuildings = currentMap === 'coast' ? (globalThis.window?.RoadsterCoast?.buildings() || []) : cityNearbyBuildings(state);
    for (let i = 0; i < mapBuildings.length; i++) {
      const b = mapBuildings[i];
      if (currentMap==='city'?cityTouchesRoof(state,b):state.x > b.minX - 1.1 && state.x < b.maxX + 1.1 && state.z > b.minZ - 1.8 && state.z < b.maxZ + 1.8) {
        if (state.y >= b.height - 0.55) {
          groundElev = Math.max(groundElev, b.height);
        }
      }
    }
  }
  const currentAgl = Math.max(0.0, state.y - groundElev);
  // Only a fresh ground/roof takeoff gets launch grace. Midair O taps cannot
  // restart it and disable normal flight handling.
  if (currentAgl <= 0.15 && (currentMap!=='coast'||(!state.wasAirborne&&!state.coastDetached))) {
    state.groundHopActive = true;
    state.jumpInertiaSeconds = 0;
    state.jumpInertiaGraceSeconds = globalThis.window?.RoadsterDemo?.isRequestingJump() ? (window.RoadsterDemo.jumpGraceSeconds?.() ?? 0.95) : null;
  }
  // Jump to 6.0m above ground/rooftop (or +6.0m if already flying above 5.5m)
  state.jumpStartY = state.y;
  const demoJumpHeight = globalThis.window?.RoadsterDemo?.isRequestingJump() ? window.RoadsterDemo.jumpHeight() : 6.0;
  state.jumpTargetY = (currentAgl < 5.5) ? (groundElev + demoJumpHeight) : Math.min(MAX_FLIGHT_ALTITUDE, state.y + 6.0);
  state.isJumping6m = true;
  if(currentMap==='coast'){state.coastDetached=true;state.coastSupportId=null;}
  state.isAltitudeHold = false;
  const nBadge = document.getElementById('key-n');
  if (nBadge) nBadge.classList.remove('active');
  const baseClimbVy = (state.physicsMode === 'realistic') ? (6.2 * 1.3) : (28.0 * 1.3);
  state.vy = Math.max(state.vy, baseClimbVy * 2.5);
  if (!globalThis.window?.RoadsterDemo?.isRequestingJump()) showBanner('jump6m', 2.0);
  sound.beep(820, 0.12);
};
