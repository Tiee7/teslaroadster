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
      if (car.highwayPassedThisFrame) {
        if (!state.isDestroyed) {
          state.carsCleared += 1;
        }
      }
    } else {
      car.mesh.position.x += car.vx * CITY_WORLD_SPEED_SCALE * dt;
      car.mesh.position.z += car.vz * CITY_WORLD_SPEED_SCALE * dt;
      if (car.mesh.position.x > CITY_HALF_BOUND - 10) car.mesh.position.x = -CITY_HALF_BOUND + 10;
      if (car.mesh.position.x < -CITY_HALF_BOUND + 10) car.mesh.position.x = CITY_HALF_BOUND - 10;
      if (car.mesh.position.z > CITY_HALF_BOUND - 10) car.mesh.position.z = -CITY_HALF_BOUND + 10;
      if (car.mesh.position.z < -CITY_HALF_BOUND + 10) car.mesh.position.z = CITY_HALF_BOUND - 10;
    }

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
    const coastBounds = currentMap === 'coast' ? globalThis.window?.RoadsterCoast?.contactBounds(state.yaw,car.mesh.rotation.y,car.length,coastMotionStart.yaw,coastOld?.yaw) : null;
    const coastContact = coastOld?.visible !== false && coastOld && car.mode === 'coast' && !car.blastTimer
      ? globalThis.window?.RoadsterCoast?.trafficContact(coastMotionStart,state,coastOld,car,coastBounds) : null;
    const coastSweptHit = coastContact !== null;
    const cityNear=currentMap==='city'&&dx<10&&dz<10&&Math.abs(state.y-npcWorldY)<10;
    const cityPlayer=cityNear?cityPlayerBody(state):null,cityNpc=cityNear?cityTrafficBody(car):null;
    // Preserve the existing gentle roof-touch cushion separately from solid-body
    // contact. It may bounce a descending car, never trigger a side-gap crash.
    const cityRoofTouch=cityNear&&clearanceY>=-.15&&clearanceY<.15&&state.vy<0&&cityHorizontalContact(cityPlayer,cityNpc);
    const cityBodyOverlap=cityNear&&(cityRoofTouch||cityContactInterval(cityPlayer,cityNpc)!==null);
    const bodyOverlap = currentMap==='city'?cityBodyOverlap:coastBounds ? dx < coastBounds.x && dz < coastBounds.z && state.y+1.25>npcWorldY && state.y<npcWorldY+car.height+.15 : dx < 1.85 && dz < (car.length / 2 + 2.15);
    if (bodyOverlap || demoSweptHit || coastSweptHit) {
      if(coastSweptHit)clearanceY=coastContact.relativeY-car.height;
      if (clearanceY >= -0.15 && clearanceY < 1.1) {
        if (state.vy < -18.0) {
          triggerPhysicsCollision(Math.abs(state.vy), 'crashReasonThreshold', 0, 5.0, 0);
        } else if (state.vy < 0 && (coastSweptHit ? clearanceY < 0.150001 : clearanceY < 0.15)) {
          if(coastSweptHit){const t=Math.max(0,coastContact.t-1e-5);state.x=coastMotionStart.x+(state.x-coastMotionStart.x)*t;state.z=coastMotionStart.z+(state.z-coastMotionStart.z)*t;}
          state.y = (coastSweptHit?coastContact.npcY:npcWorldY) + car.height + 0.15;
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
          if(normalSpeed>.1){state.vx+=1.35*normalSpeed*contact.x;state.vy+=1.35*normalSpeed*contact.y;state.vz+=1.35*normalSpeed*contact.z;state.speed=isAirborne?Math.hypot(state.vx,state.vz):-state.vx*Math.sin(state.yaw)-state.vz*Math.cos(state.yaw);triggerPhysicsCollision(normalSpeed,'crashReasonThreshold',0,0,0);}
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
        } else if (currentMap === 'coast') {
          globalThis.window?.RoadsterCoast?.hit(car);
          if (coastSweptHit) { const t=Math.max(0,coastContact.t-1e-5);state.x=coastMotionStart.x+(state.x-coastMotionStart.x)*t;state.z=coastMotionStart.z+(state.z-coastMotionStart.z)*t;state.y=coastMotionStart.y+(state.y-coastMotionStart.y)*t; }
          state.vx *= -.35;state.vz *= -.35;state.speed = isAirborne ? Math.hypot(state.vx,state.vz) : state.speed * -.35;
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

  // Render the resolved pose
