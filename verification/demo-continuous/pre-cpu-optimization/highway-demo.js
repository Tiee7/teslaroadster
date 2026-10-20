// A highway-only input driver. The planner never edits vehicle/traffic state,
// speed, position, gas, scores or collisions. It asks the ordinary input/jump
// pipeline to do the work and accepts that a boxed-in, empty-tank car can crash.
const RoadsterHighwayDemoPlanner = (() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // Stunt-demo steering only. Production manual input retains its original rack,
  // tire response and boost coupling. Both prediction and physics share these
  // bounded rates; lateral velocity and position still integrate continuously.
  const handling = Object.freeze({ rackRate: 30, yawRate: 18, lateralRate: 24, lateralSpeed: 24 });
  // Continuous relative-box sweep: corner contacts between prediction samples
  // are real hazards too. Returns the first frame fraction, or null.
  function sweptContact(x0, z0, x1, z1, halfX, halfZ) {
    let enter=0, leave=1;
    for (const [a,b,half] of [[x0,x1,halfX],[z0,z1,halfZ]]) {
      if (Math.abs(b-a)<1e-10) { if (Math.abs(a)>=half) return null; continue; }
      let lo=(-half-a)/(b-a), hi=(half-a)/(b-a);
      if (lo>hi) [lo,hi]=[hi,lo];
      enter=Math.max(enter,lo); leave=Math.min(leave,hi);
      if (enter>=leave) return null;
    }
    return leave>0 && enter<1 ? Math.max(0,enter) : null;
  }
  const neutral = () => ({ steer: 0, throttle: 0, boost: 0, brake: 0, reverse: 0, handbrake: 0, lift: 0, descend: 0, strafe: 0, roll: 0, pitch: 0 });
  const nearest = (x, lanes) => lanes.reduce((best, value, i) => Math.abs(value - x) < Math.abs(lanes[best] - x) ? i : best, 0);
  function create(lanes, scale) {
    let target = null, changing = false, dwell = 0, jumpCooldown = 0, charging = false, decisionCooldown = 0, refillTarget = 0;
    let completed = 0, started = 0, jumps = 0, landingLane = null, multiLane = 0, maxLaneSpan = 0;
    let certifiedNext=null, certifiedHandoffs=0, invalidatedCertificates=0, releasedCertificates=0, backupHops=0;
    const previous = new WeakMap();
    function reset(x = 2.5) {
      target = nearest(x, lanes); changing = false; dwell = 0.2; jumpCooldown = 0; charging = false; refillTarget = 0;
      completed = started = jumps = multiLane = maxLaneSpan = 0; landingLane = null; decisionCooldown = 0;
      certifiedNext=null;certifiedHandoffs=invalidatedCertificates=releasedCertificates=backupHops=0;
    }
    function obstacles(cars, dt) {
      return cars.filter(c => c.mode === 'highway' && c.highwayWaitingToSpawn === undefined && c.mesh.visible !== false)
        .map(c => {
          const speed = Math.max(0, c.speed || 0), old = previous.get(c);
          const acceleration = old !== undefined && dt > 0 ? clamp((speed - old) / dt, -8.5, 3.2) : 0;
          previous.set(c, speed);
          return { car: c, speed, acceleration, x: c.mesh.position.x, z: c.mesh.position.z,
            halfLength: (c.length || 4.62) / 2 + 2.15, height: c.height || 1.25 };
        });
    }
    function rawCarX(o, t) {
      const c = o.car, change = c.laneChange;
      if (change) {
        const duration = c.driverType === 'racer' ? 1.85 : 2.6;
        const p = clamp((change.elapsed + t) / duration, 0, 1);
        const blend = p * p * p * (10 + p * (-15 + 6 * p));
        return change.startX + (lanes[change.to] - change.startX) * blend;
      }
      return o.x + (c.blastTimer > 0 ? (c.blastVx || 0) : (c.recoverHighwayLane ? (c.vx || 0) * Math.min(t, 0.4) / Math.max(t, 0.001) : 0)) * t;
    }
    function carX(o,t) {
      o.futureX ||= new Map();
      if (!o.futureX.has(t)) o.futureX.set(t,rawCarX(o,t));
      return o.futureX.get(t);
    }
    function travel(speed, acceleration, limit, t) {
      const untilLimit = acceleration > 0 ? Math.max(0, limit - speed) / acceleration : t;
      const a = Math.min(t, untilLimit);
      return speed * a + 0.5 * acceleration * a * a + Math.max(speed, limit) * Math.max(0, t - a);
    }
    const hopProfiles=new Map();
    function hopProfile(height, realistic=true,frameDt=1/60) {
      const h=clamp(frameDt,1/240,.1);
      const key=`${height}/${realistic}/${h}`;if(hopProfiles.has(key))return hopProfiles.get(key);
      const climb=realistic?20.15:117,accel=realistic?10.66:62.4,maxClimb=climb/2.5;
      const ramp=maxClimb*maxClimb/(2*accel),normal=height<=ramp?Math.sqrt(2*height/accel):maxClimb/accel+(height-ramp)/maxClimb;
      const burn=2*normal/Math.max(.05,height/climb),points=[{t:0,y:0}],profile={points,cost:0,duration:0,dt:h};
      let y=0,vy=realistic?climb:91,rising=true,save=false;
      for(let t=h;t<3.5;t+=h){
        const down=Math.max(0,-vy),stop=Math.max(0,(down*down-16)/116),minAlt=Math.max(1.8,stop+down*h+.45);
        const landing=vy < -3.5 && y>.02 && y<=minAlt && (down>5.5||save);
        if(landing){save=true;vy=Math.min(-1.5,vy+58*h);profile.cost+=h;y+=vy*h;}
        else if(rising){save=false;vy=Math.min(climb,Math.max(climb*.92,vy+accel*2.5*h));const paid=Math.min(h,Math.max(0,(height-y)/vy));profile.cost+=burn*paid;y+=vy*h;if(y>=height){y=height;vy=0;rising=false;}}
        else {save=false;y+=vy*h-4.905*h*h;vy-=9.81*h;}
        y=Math.max(0,y);points.push({t,y});
        if(y===0&&!rising){profile.duration=t;break;}
      }
      hopProfiles.set(key,profile);return profile;
    }
    function step(player, cars, dt) {
      if (target === null) reset(player.x);
      jumpCooldown = Math.max(0, jumpCooldown - dt);if(jumpCooldown<1e-7)jumpCooldown=0;
      decisionCooldown = Math.max(0, decisionCooldown - dt);if(decisionCooldown<1e-7)decisionCooldown=0;
      if(certifiedNext&&(player.physicsMode!==certifiedNext.physicsMode||!!player.insaneMode!==certifiedNext.insaneMode)){certifiedNext=null;invalidatedCertificates++;}
      const grounded = player.y <= 0.005 && Math.abs(player.vy || 0) < 0.01 && !player.isJumping6m;
      const input = neutral(), airborne = !grounded;
      const live = obstacles(cars, dt);
      // A short, paid side correction may select a clear landing lane. There
      // is no forward/lift/hover request in the air. This also escapes the
      // ordinary car-roof rebound instead of hovering over a stopped NPC.
      if (airborne) {
        const speed = Math.max(0, -player.vz);
        // The automated hop stops its upward impulse at jumpTargetY. A
        // ballistic extrapolation of its 20m/s launch would predict a phantom
        // four-second flight and miss the next car at the real low landing.
        const targetY=Math.max(player.y,player.jumpTargetY||2.3);
        const landingTime=player.isJumping6m && player.vy>0
          ? Math.max(0.2,Math.min(1.1,(targetY-player.y)/Math.max(1,player.vy)+Math.sqrt(2*targetY/9.81)+0.08))
          : Math.max(0.2,Math.min(1.1,0.12+(player.vy+Math.sqrt(player.vy**2+19.62*Math.max(0,player.y)))/9.81));
        const room = lane => {
          let gap = 200;
          for (const o of live) {
            if (Math.abs(carX(o, landingTime) - lanes[lane]) > 3) continue;
            const low = o.z + (speed * 0.93 - o.speed) * scale * landingTime;
            const high = o.z + (speed - o.speed) * scale * landingTime;
            const separation = low <= 0 && high >= 0 ? 0 : Math.min(Math.abs(low), Math.abs(high));
            // Landing must leave grounded recharge/decision runway too. A
            // merely clear touchdown 30m behind the next slow car otherwise
            // causes immediate hop chains until the real tank is exhausted.
            const runway=high<0 ? Math.max(0,speed-o.speed)*scale*0.65 : 0;
            gap = Math.min(gap, separation - o.halfLength - runway);
          }
          return gap;
        };
        // Validate the paid strafe's complete low-altitude sweep, rather than
        // selecting a clear endpoint across another car during descent.
        const landingSweepClear=lane=>{
          let x=player.x,vx=player.vx||0,vz=player.vz||0,y=player.y,vy=player.vy||0,metres=0;
          let rising=player.isJumping6m,elapsed=0;
          const yaw=player.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw),h=0.025;
          const npcZ=(o,t,own)=>{
            const bt=o.acceleration<0?Math.min(t,o.speed/-o.acceleration):t;
            const travel=o.speed*bt+0.5*o.acceleration*bt*bt+Math.max(0,o.speed+o.acceleration*bt)*Math.max(0,t-bt);
            return o.z+(own-travel)*scale;
          };
          while(elapsed<landingTime+0.001){
            const step=Math.min(h,landingTime-elapsed);if(step<=0)break;
            const old={x,y,metres},mag=Math.hypot(vx,vz),coast=1/(1+0.00012*mag*step);
            vx*=coast;vz*=coast;
            const error=lanes[lane]-x,desired=clamp(error*5-vx*0.65,-8.5,8.5);
            const command=player.airRemaining>0.3&&(Math.abs(error)>.24||Math.abs(vx)>.7)?clamp((desired*c-vz*s)/18,-.8,.8):0;
            if(command){const delta=(command*18-(vx*c-vz*s))*(1-Math.exp(-6.5*step));vx+=c*delta;vz-=s*delta;}
            x+=vx*step;metres+=-vz*step;
            if(rising){y=Math.min(targetY,y+Math.max(0,vy)*step);if(y>=targetY){rising=false;vy=0;}}
            else {y=Math.max(0,y+vy*step-4.905*step*step);vy-=9.81*step;}
            for(const o of live){
              // Roof-rebound clearance matters as well as body penetration.
              const height=(o.car.y||0)+o.height+.20;
              let lo=0,hi=1;
              if(old.y>=height&&y>=height)continue;
              if(old.y>=height)lo=(old.y-height)/(old.y-y);
              else if(y>=height)hi=(height-old.y)/(y-old.y);
              const lerp=(a,b,f)=>a+(b-a)*f;
              const x0=carX(o,elapsed)-old.x,x1=carX(o,elapsed+step)-x;
              const z0=npcZ(o,elapsed,old.metres),z1=npcZ(o,elapsed+step,metres);
              if(sweptContact(lerp(x0,x1,lo),lerp(z0,z1,lo),lerp(x0,x1,hi),lerp(z0,z1,hi),2.03,o.halfLength+.35)!==null)return false;
            }
            elapsed+=step;
          }
          return Math.abs(x-lanes[lane])<0.9;
        };
        if (room(target) < 18 && landingLane === null) {
          const base = nearest(player.x, lanes);
          const candidates = [base - 1, base, base + 1].filter(i => i >= 0 && i < lanes.length)
            .filter(lane=>landingSweepClear(lane))
            .map(lane => ({ lane, gap: room(lane) })).sort((a,b) => b.gap - a.gap || Math.abs(lanes[a.lane]-player.x) - Math.abs(lanes[b.lane]-player.x));
          if (candidates.length && candidates[0].gap > room(target) + 6) {
            target = candidates[0].lane;
            if (!changing) { changing = true; started++; } dwell = 0;
          }
        }
        if (player.y > 1.6) landingLane = target;
        const error = lanes[target] - player.x;
        if (player.airRemaining > 0.3 && (Math.abs(error) > 0.24 || Math.abs(player.vx) > 0.7)) {
          const desired = clamp(error * 5.0 - player.vx * 0.65, -8.5, 8.5);
          const localSideSpeed = desired * Math.cos(player.yaw || 0) - player.vz * Math.sin(player.yaw || 0);
          input.strafe = clamp(localSideSpeed / 18, -0.8, 0.8);
        }
        return { input, jump: false, status: 'jump', targetLane: target };
      }
      landingLane = null;
      input.throttle = 1;
      const speed = Math.max(0, -player.vz, player.speed || 0);
      const cruiseLimit = player.physicsMode !== 'realistic' ? 160 : player.insaneMode ? 370 / 3.6 : live.length ? 250 / 3.6 : 370 / 3.6;
      if (player.airRemaining < 4.3) charging = true;
      if (player.airRemaining >= 7.0) charging = false;
      if (player.airRemaining>=refillTarget) refillTarget=0;
      // Recharge hysteresis must not strand usable paid ground boost below
      // the floor plus finite-hop coast headroom. This never powers flight.
      const boostFor = (v, gas, recharging, freefall=player.isFreefalling) => (!recharging || v<220/3.6+2) && gas > 4.3 && !freefall && v < cruiseLimit
        && !(gas<refillTarget && v>220/3.6+1);
      const steeringFor = (x, vx, v, lane, boost) => {
        const desired = clamp((lanes[lane] - x) * 12.0 - vx * 0.6, -20, 20);
        const gain = handling.lateralSpeed * clamp(v / 18, 0, 1);
        return clamp(desired / Math.max(3, gain), -0.95, 0.95);
      };
      const relativeZ = (o, t, ownMetres) => {
        o.futureZ ||= new Map();
        const venueScale=o.car.blastTimer>0 ? 1 : scale;
        if (!o.futureZ.has(t)) {
          const brakingTime=o.acceleration<0 ? Math.min(t,o.speed/-o.acceleration) : t;
          const npcTravel=o.speed*brakingTime+0.5*o.acceleration*brakingTime*brakingTime+
            Math.max(0,o.speed+o.acceleration*brakingTime)*Math.max(0,t-brakingTime);
          o.futureZ.set(t,o.z-npcTravel*venueScale+(o.car.blastVz||0)*t);
        }
        return o.futureZ.get(t)+ownMetres*venueScale;
      };
      function frontLeader(x,lane,time=0,metres=0) {
        let result=null,nearestGap=Infinity;
        for (const o of live) {
          const z=relativeZ(o,time,metres), cx=carX(o,time);
          if (z>=0 || (Math.abs(cx-x)>=2.6 && Math.abs(cx-lanes[lane])>=2.6)) continue;
          if (-z<nearestGap) { nearestGap=-z; result=o; }
        }
        return result;
      }
      const speedFloor = 220 / 3.6;
      // Paid H includes mechanical braking and the speed-dependent shared-gas
      // retro impulse. Bound the combined result, including a long frame, before
      // requesting any brake. No speed or gas state is assigned by the driver.
      function brakeResult(v, gas, brake, seconds, freefall) {
        const blend = clamp((v - 200 / 3.6) / (40 / 3.6), 0, 1);
        const demand = blend * blend * (3 - 2 * blend) * brake;
        const paid = freefall ? 0 : Math.min(gas, 0.55 * demand * seconds);
        const mass = 1850 + Number((gas * 14.4).toFixed(1));
        return { speed: Math.max(0, v - 38 * brake * seconds - 80000 / mass * paid / 0.55), paid };
      }
      function controlsFor(v,gas,recharging,leader=null,time=0,ownMetres=0,freefall=player.isFreefalling,seconds=dt) {
        const cruise = { throttle: 1, brake: 0, boost: boostFor(v,gas,recharging,freefall) ? 1 : 0, jumpNeeded: false };
        if (!leader) return cruise;
        const gap = Math.max(0,-relativeZ(leader,time,ownMetres)-leader.halfLength-0.3);
        const leadSpeed=Math.max(0,leader.speed+Math.min(0,leader.acceleration)*(time+0.3));
        const desiredGap=0.6+v*scale*0.005+Math.max(0,v-leadSpeed)*scale*0.02;
        const followingSpeed=leadSpeed+(gap-desiredGap)/(scale*0.30);
        const stoppingEnvelope=Math.sqrt(leadSpeed*leadSpeed+2*32*gap/scale);
        const requested=clamp(Math.min(followingSpeed,stoppingEnvelope),0,cruiseLimit);
        // A slow queue is a routing/hop request, never permission to follow it
        // below 220. From rest we still accelerate using ordinary propulsion.
        if (requested < speedFloor + 0.5) return { ...cruise, jumpNeeded: true };
        if (v>requested+0.3) {
          let brake=clamp((v-requested)/8,0,1);
          if (brakeResult(v,gas,brake,seconds,freefall).speed < speedFloor) {
            let lo=0,hi=brake;
            for (let i=0;i<24;i++) { const mid=(lo+hi)/2; if (brakeResult(v,gas,mid,seconds,freefall).speed>=speedFloor) lo=mid; else hi=mid; }
            brake=lo;
          }
          if (brake>0) return { throttle:0,boost:0,brake,jumpNeeded:false };
        }
        // Avoid slowly coasting through the floor while waiting for a gap.
        return cruise;
      }
      // One trajectory for first-gap validation, route ranking and the urgent
      // collision test. Integrate the real rack/yaw/lateral response rather
      // than drawing three mutually inconsistent eased/straight paths.
      function trajectory(route, horizon, useFollowing=true) {
        const p = { x: player.x, vx: player.vx || 0, yaw: player.yaw || 0, steer: player.steerInput || 0,
          speed: Math.max(0, player.speed || 0), gas: player.airRemaining, freefall: player.isFreefalling, charging, metres: 0 };
        const points = [{ t: 0, x: p.x, metres: 0 }];
        let firstArrival = null;
        const h = 0.025, lane = route[route.length-1]; let settled = 0;
        for (let t = h; t <= horizon + 1e-6; t += h) {
          settled = Math.abs(p.x-lanes[lane]) < 0.32 && Math.abs(p.vx) < 1.3 ? settled+h : 0;
          if (settled >= 0.08 && firstArrival === null) firstArrival = t;
          if (p.gas < 4.3) p.charging = true;
          if (p.gas >= 7) p.charging = false;
          const leader=useFollowing ? frontLeader(p.x,lane,t-h,p.metres) : null;
          const controls=controlsFor(p.speed,p.gas,p.charging,leader,t-h,p.metres,p.freefall,h);
          const boost = controls.boost > 0;
          const command = steeringFor(p.x,p.vx,p.speed,lane,boost);
          p.steer += (command-p.steer)*(1-Math.exp(-handling.rackRate*h));
          const nx = -Math.sin(p.yaw), nz = -Math.cos(p.yaw);
          const realistic = player.physicsMode === 'realistic';
          const standard = realistic && !player.insaneMode && !boost;
          const maximum = realistic ? (standard ? 200/3.6 : 370/3.6) : 160;
          const electric = realistic ? (player.insaneMode ? 38 : 16.5) : 72;
          const mass=1850+Number((p.gas*14.4).toFixed(1));
          const jet = (realistic ? 38 : 120) * 1994 / mass;
          const braking=brakeResult(p.speed,p.gas,controls.brake,h,p.freefall);
          const paidRetro=braking.paid;
          if (paidRetro>0) p.speed=Math.max(0,p.speed-80000/mass*(paidRetro/0.55));
          if (controls.throttle>0 || boost) {
            if (standard && p.speed > maximum) p.speed = Math.max(maximum,p.speed-(0.00012*p.speed*p.speed+0.35)*1.3*h);
            else p.speed = Math.min(maximum,p.speed+Math.max(electric*controls.throttle,boost ? jet : 0)*h);
          } else if (controls.brake>0) p.speed=Math.max(0,p.speed-38*controls.brake*h);
          else p.speed=Math.max(0,p.speed-(0.00012*p.speed*p.speed+0.35)*(standard&&p.speed>maximum?1.3:1)*h);
          const factor=clamp(p.speed/14,0,1.25);
          const targetVx=p.steer*handling.lateralSpeed*clamp(p.speed/18,0,1);
          const targetYaw=-Math.atan2(targetVx,Math.max(12,p.speed));
          p.yaw += (targetYaw-p.yaw)*(1-Math.exp(-handling.yawRate*h));
          p.vx += (targetVx-p.vx)*(1-Math.exp(-handling.lateralRate*h));
          p.x += p.vx*h; p.metres += -nz*p.speed*h;
          p.gas=clamp(p.gas+(boost ? -0.85*h : paidRetro>0 ? -paidRetro : 3.4*h),0,10);
          if (p.gas<=0.001) p.freefall=true;
          if (p.gas>=2.5 && !boost) p.freefall=false;
          points.push({t,x:p.x,metres:p.metres,speed:p.speed});
        }
        points.arrival = firstArrival;
        return points;
      }
      function collisionTime(path, margin=0.35, lateral=2.03, uncertainty=0.12) {
        let first=Infinity;
        for (const o of live) {
          let previousPoint=path[0];
          for (const point of path) {
            if (previousPoint.t>=first) break;
            const x0=carX(o,previousPoint.t)-previousPoint.x, x1=carX(o,point.t)-point.x;
            const z0=relativeZ(o,previousPoint.t,previousPoint.metres), z1=relativeZ(o,point.t,point.metres);
            const hit=sweptContact(x0,z0,x1,z1,lateral,o.halfLength+margin+point.t*uncertainty);
            if (hit!==null) { first=Math.min(first,previousPoint.t+(point.t-previousPoint.t)*hit); break; }
            previousPoint=point;
          }
        }
        return first;
      }
      const paths = new Map();
      // Every candidate is one complete trajectory toward its FINAL center.
      // Crossing two or more lanes never inserts an intermediate steering zero,
      // dwell, or route-selection point. Validate the entire sweep and hold.
      const horizon = 2.4;
      const pathFor = lane => { if (!paths.has(lane)) paths.set(lane,trajectory([lane],horizon));return paths.get(lane); };
      const safePath = lane => { const path=pathFor(lane);return path.arrival!==null && path.arrival+0.25<=horizon && collisionTime(path)>path.arrival+0.25; };
      const error = lanes[target] - player.x;
      if (Math.abs(error) < 0.32 && Math.abs(player.vx) < 1.3) {
        dwell += dt;
        if (changing && dwell >= 0.08) { changing = false; completed++; }
      } else dwell = 0;
      const currentThreat = live.length ? collisionTime(trajectory([target],1.6,false),0.6) : Infinity;
      const leader=frontLeader(player.x,target);
      let drive=controlsFor(speed,player.airRemaining,charging,leader);
      const committedThreat=live.length ? collisionTime(pathFor(target)) : Infinity;
      // An unnecessary successor may be released only for a fresh COMPLETE
      // ground horizon, not merely because the immediate trigger is absent.
      if(certifiedNext&&jumpCooldown===0&&safePath(target)&&committedThreat>horizon&&pathFor(target).slice(1).every(p=>p.speed>=speedFloor)){
        certifiedNext=null;releasedCertificates++;
      }
      // Retain the final target throughout the maneuver. A newly unsafe sweep
      // may extend the same-direction move; it must not induce lane-by-lane
      // recentring or an opposite-direction selection oscillation.
      if (decisionCooldown === 0 && jumpCooldown===0 && !certifiedNext && (currentThreat < 1.35 || drive.jumpNeeded || committedThreat < 0.8)) {
        decisionCooldown=0.10;
        const direction=changing ? Math.sign(error) : 0;
        const options=lanes.map((_,lane)=>lane).filter(lane=>lane!==target && (!changing || Math.sign(lanes[lane]-player.x)===direction) && safePath(lane))
          .map(lane=>{const path=pathFor(lane);return {lane,flow:path.at(-1).metres,distance:Math.abs(lanes[lane]-player.x)};})
          .sort((a,b)=>(b.flow-a.flow)*0.08+(a.distance-b.distance) || Math.abs(a.lane-2.5)-Math.abs(b.lane-2.5));
        if (options.length && (!changing || committedThreat < 0.8)) {
          const from=nearest(player.x,lanes),span=Math.abs(options[0].lane-from);
          target=options[0].lane; if(!changing)started++;
          if(span>1)multiLane++;maxLaneSpan=Math.max(maxLaneSpan,span);
          changing=true;dwell=0;
          drive=controlsFor(speed,player.airRemaining,charging,frontLeader(player.x,target));
        }
      }
      const immediate=live.length ? collisionTime(trajectory([target],0.85),0.3,2.0,0.1) : Infinity;
      // Launch early enough to clear the body, late enough to land beyond it.
      // Slow requested following below the floor escalates to the same paid
      // tactical hop. Empty/low/freefall tanks cannot invent a jump or fuel.
      let plannedHop=null;
      if(jumpCooldown===0&&(certifiedNext||(immediate<0.55&&player.airRemaining>=3.6&&!player.isFreefalling))){
        // Plan launch -> full paid arc -> touchdown -> next-launch preparation
        // as one maneuver. A clear point at touchdown is insufficient when a
        // second car occupies the next-launch preparation window immediately
        // afterward. Prefer the lowest complete arc; never extend it in air.
        const minimum=Math.max(2.3,...live.filter(o=>Math.abs(o.z)<60).map(o=>o.height+.8));
        const heights=[minimum,3.2,4.5,6,7.5,10].filter((height,i,a)=>height>=minimum&&a.indexOf(height)===i);
        function candidate(start,sourceCars,height,lane,prepare){
          const profile=hopProfile(height,start.physicsMode==='realistic',dt);
          if(!(profile.duration>0)||profile.duration+.18>2.4)return null;
          if(start.isDestroyed||start.isFreefalling||start.isAltitudeHold||start.airRemaining<Math.max(3.6,profile.cost+2.2)||Math.abs(lanes[lane]-start.x)>8.5*profile.duration+1)return null;
            let x=start.x,vx=start.vx||0,vz=start.vz||0,metres=0,gas=start.airRemaining-profile.cost,paidSide=0,ok=true;
            let prior={t:0,x,y:0,metres:0,fastestMetres:0},fastestMetres=0,groundSpeed=null,groundYaw=start.yaw||0,groundSteer=0,groundSeconds=0;
            // Long landing/refill windows must not freeze a driver's current
            // braking acceleration for several seconds. Advance the ordinary
            // traffic controller on isolated snapshots for this candidate.
            // Reservations, reactions and respawns remain real; no live car or
            // rendering object is handed to the speculative controller.
            const forecast=sourceCars.map(car=>({...car,laneChange:car.laneChange?{...car.laneChange}:null,
              mesh:{position:{...car.mesh.position},rotation:{...car.mesh.rotation},visible:car.mesh.visible}}));
            const yaw=start.yaw||0,c=Math.cos(yaw),sin=Math.sin(yaw);
            const climb=start.physicsMode==='realistic'?20.15:117;
            // Recharge is part of the next-launch clock. A low-pressure
            // touchdown cannot rearm merely because its cooldown elapsed.
            // Budget the real minimum tank for the next admitted takeoff,
            // then add the discrete rise-to-clearance and frame allowance.
            const clearHeight=Math.max(...live.map(o=>o.height+.2),1.45);
            const riseTime=Math.ceil(clearHeight/(climb*profile.dt))*profile.dt;
            const requiredNextAir=3.6,h=profile.dt;let groundWait=Math.ceil(.12/h)*h,preparation=Math.ceil(.30/h)*h,handoff=null;
            let finish=profile.duration+(prepare?preparation:0);
            for(let t=h;t<=finish+1e-6;t+=h){
              const inAir=t<=profile.duration+1e-6;
              if(inAir){
                const mag=Math.hypot(vx,vz),coast=1/(1+.00012*mag*h);vx*=coast;vz*=coast;
                const err=lanes[lane]-x,desired=clamp(err*5-vx*.65,-8.5,8.5),command=Math.abs(err)>.24||Math.abs(vx)>.7?clamp((desired*c-vz*sin)/18,-.8,.8):0;
                if(command){const delta=(command*18-(vx*c-vz*sin))*(1-Math.exp(-6.5*h));vx+=c*delta;vz-=sin*delta;paidSide+=.45*Math.abs(command)*h;}
                const rechargeTime=Math.max(0,requiredNextAir-(gas-paidSide))/3.4;
                groundWait=Math.ceil(Math.max(.12,rechargeTime)/h-1e-8)*h;
                preparation=Math.ceil(Math.max(.30,groundWait+riseTime+3*h)/h-1e-8)*h;
                finish=profile.duration+(prepare?preparation:0);
              }else{
                groundSeconds+=h;if(groundSpeed===null)groundSpeed=Math.hypot(vx,vz);
                const command=steeringFor(x,vx,groundSpeed,lane,false),oldYaw=groundYaw;
                groundSteer+=(command-groundSteer)*(1-Math.exp(-handling.rackRate*h));
                if(start.physicsMode==='realistic'&&!start.insaneMode&&groundSpeed>200/3.6)
                  groundSpeed=Math.max(200/3.6,groundSpeed-(.00012*groundSpeed*groundSpeed+.35)*1.3*h);
                else groundSpeed=Math.min(start.physicsMode==='realistic'?(start.insaneMode?370/3.6:200/3.6):160,groundSpeed+(start.physicsMode==='realistic'?(start.insaneMode?38:16.5):72)*h);
                const desired=groundSteer*handling.lateralSpeed*clamp(groundSpeed/18,0,1);
                groundYaw+=(-Math.atan2(desired,Math.max(12,groundSpeed))-groundYaw)*(1-Math.exp(-handling.yawRate*h));
                vx+=(desired-vx)*(1-Math.exp(-handling.lateralRate*h));vz=-Math.cos(oldYaw)*groundSpeed;
              }
              x+=vx*h;metres+=-vz*h;
              // Bound the fastest real grounded reboost too. The air-vector
              // continuation alone can under-predict forward travel after
              // touchdown and falsely declare the next-launch window clear.
              const maximumForward=Math.max(start.speed||0,cruiseLimit)+(start.physicsMode==='realistic'?38:120)*1994/1850*dt;
              fastestMetres=inAir?metres:fastestMetres+Math.max(-vz,maximumForward)*h;
              const sample=t/profile.dt,index=Math.min(profile.points.length-1,Math.floor(sample)),a=profile.points[index],b=profile.points[Math.min(index+1,profile.points.length-1)];
              const point={t,x,metres,fastestMetres,y:inAir?a.y+(b.y-a.y)*(sample-index):0};
              if(Math.abs(x)>13.65){ok=false;break;}
              const beforeTraffic=forecast.map(car=>({x:car.mesh.position.x,z:car.mesh.position.z,y:car.y||0,live:car.mode==='highway'&&car.highwayWaitingToSpawn===undefined&&car.mesh.visible!==false}));
              highwayTraffic.step(forecast,{x,y:point.y,z:0,vx,vz},h,lanes,scale);
              for(let i=0;i<forecast.length;i++){
                const car=forecast[i],before=beforeTraffic[i];
                // Blast motion is integrated separately from normal traffic.
                if(car.blastTimer>0){
                  car.blastTimer=Math.max(0,car.blastTimer-h);car.mesh.position.x+=(car.blastVx||0)*h;
                  car.mesh.position.z+=(-vz-car.speed+(car.blastVz||0))*h;car.y=(car.y||0)+(car.blastVy||0)*h;car.blastVy=(car.blastVy||0)-22*h;
                  if(car.y<=0){car.y=0;car.blastVy=-car.blastVy*.42;car.blastVx=(car.blastVx||0)*Math.pow(.22,h);car.blastVz=(car.blastVz||0)*Math.pow(.22,h);}
                  if(car.blastTimer<=.01)car.y=0;
                }
                if(car.mode!=='highway'||car.highwayWaitingToSpawn!==undefined||car.mesh.visible===false)continue;
                // Respawn is discontinuous far from the start. Validate its
                // new endpoint, never a fictitious sweep through the road.
                const reset=!before.live||Math.abs(car.mesh.position.z-before.z)>100;
                const roof=Math.max(before.y,car.y||0)+(car.height||1.25)+.2;let lo=0,hi=1;
                if(prior.y>=roof&&point.y>=roof)continue;
                if(prior.y>=roof)lo=(prior.y-roof)/(prior.y-point.y);else if(point.y>=roof)hi=(roof-prior.y)/(point.y-prior.y);
                const mix=(a,b,f)=>a+(b-a)*f,x1=car.mesh.position.x-x,z1=car.mesh.position.z;
                const x0=reset?x1:before.x-prior.x,z0=reset?z1:before.z;
                const halfLength=(car.length||4.62)/2+2.15;
                if(sweptContact(mix(x0,x1,lo),mix(z0,z1,lo),mix(x0,x1,hi),mix(z0,z1,hi),2.1,halfLength+.65+t*.15+Math.max(prior.fastestMetres-prior.metres,fastestMetres-metres)*scale)!==null){ok=false;break;}
              }
              if(!ok)break;
              if(!handoff&&t>=profile.duration+groundWait-1e-6){
                const remaining=clamp(gas-paidSide+3.4*groundSeconds,0,10);
                // Capture the actual next-launch phase NOW. The later rise/
                // frame-buffer validation must not advance this saved state
                // or mutate its independent NPC reservations/relative poses.
                handoff={state:{...JSON.parse(JSON.stringify(start)),x,y:0,z:0,vx,vy:0,vz,speed:groundSpeed??Math.hypot(vx,vz),yaw:groundYaw,steerInput:groundSteer,
                  airRemaining:remaining,airUsedContinuous:10-remaining,gasMassKg:Number((remaining*14.4).toFixed(1)),
                  isJumping6m:false,isAltitudeHold:false,isAutoLandingSave:false,wasAirborne:false,jumpInertiaSeconds:null,jumpInertiaGraceSeconds:null},
                  cars:forecast.map(car=>({...car,laneChange:car.laneChange?{...car.laneChange}:null,
                    mesh:{position:{...car.mesh.position},rotation:{...car.mesh.rotation},visible:car.mesh.visible}}))};
              }
              prior=point;
            }
          if(!ok||!handoff||Math.abs(x-lanes[lane])>=.6||start.airRemaining<profile.cost+paidSide+2.1)return null;
          return {lane,height,duration:profile.duration,cost:profile.cost+paidSide,requiredNextAir,groundWait,preparation,distance:Math.abs(lanes[lane]-start.x),
            forecast:handoff.cars,endpoint:handoff.state};
        }
        // Cash the certified successor at its admitted handoff time, before
        // ordinary rerouting and without inventing a new C requirement for B.
        // The saved snapshots are evidence only: actual state/cars and current
        // dt must freshly pass the complete paid B arc and preparation window.
        if(certifiedNext){
          const certificate=certifiedNext;certifiedNext=null;
          plannedHop=candidate(player,cars,certificate.height,certificate.lane,true);
          if(plannedHop){plannedHop.fromCertificate=true;certifiedHandoffs++;}else invalidatedCertificates++;
        }
        // One bounded successor check prevents a legal low landing from
        // committing us to a next hop whose required height is unaffordable.
        // The successor includes its OWN real refill/launch runway too;
        // validating only its arc would defer the same blocked-landing bug.
        let backupHop=null;
        if(!plannedHop&&immediate<.55)for(const height of heights){
          // Ranking is distance-only. Visit its identical stable order and
          // stop at the first valid pair instead of rolling out losing lanes.
          const order=lanes.map((_,lane)=>lane).sort((a,b)=>Math.abs(lanes[a]-player.x)-Math.abs(lanes[b]-player.x));
          for(const lane of order){
            const option=candidate(player,cars,height,lane,true);if(!option)continue;
            if(!backupHop)backupHop=option;
            for(const nextHeight of heights){
              for(let nextLane=0;nextLane<lanes.length;nextLane++){
                const successor=candidate(option.endpoint,option.forecast,nextHeight,nextLane,true);
                if(successor){option.successor=successor;break;}
              }
              if(option.successor)break;
            }
            if(option.successor){plannedHop=option;break;}
          }
          if(plannedHop)break;
        }
        // Lookahead ranks safer continuations, but absence of a farther
        // successor cannot veto an already complete, paid and swept escape
        // from the CURRENT hazard. Never wait for a crash while that backup
        // is still physically executable; its own refill/rise window remains
        // mandatory and is not shortened here.
        if(!plannedHop&&backupHop){plannedHop=backupHop;plannedHop.backup=true;backupHops++;}
      }
      if(plannedHop){
        const span=Math.abs(plannedHop.lane-nearest(player.x,lanes));
        if(plannedHop.lane!==target){if(!changing)started++;changing=true;dwell=0;}
        if(span>1)multiLane++;maxLaneSpan=Math.max(maxLaneSpan,span);
        target=plannedHop.lane;landingLane=target;refillTarget=plannedHop.requiredNextAir;
        certifiedNext=plannedHop.successor?{lane:plannedHop.successor.lane,height:plannedHop.successor.height,
          physicsMode:player.physicsMode,insaneMode:!!player.insaneMode,frameDt:dt,
          scheduledAfter:plannedHop.duration+plannedHop.groundWait,expectedState:{...plannedHop.endpoint},expectedCars:plannedHop.forecast}:null;
        jumpCooldown=plannedHop.duration+plannedHop.groundWait;jumps++;
        return {input:neutral(),jump:true,jumpHeight:plannedHop.height,jumpGraceSeconds:Math.min(2.4,plannedHop.duration+.18),nextJumpAir:plannedHop.requiredNextAir,groundPreparationSeconds:plannedHop.preparation,groundWaitSeconds:plannedHop.groundWait,certificateSource:plannedHop.fromCertificate?'revalidated':plannedHop.backup?'backup':'new',nextJumpLane:certifiedNext?.lane??null,nextJumpHeight:certifiedNext?.height??null,status:'jump',targetLane:target};
      }
      // The admitted refill interval uses ordinary no-jet ground recharge.
      // Keep the admitted preparation interval as well as the tank minimum.
      // Optional H/retro or boost would stop that clock; the swept runway
      // already validates the faster no-brake continuation during this wait.
      if(jumpCooldown>0||(refillTarget>0&&player.airRemaining<refillTarget))drive={throttle:1,boost:0,brake:0,jumpNeeded:drive.jumpNeeded};
      input.throttle=drive.throttle;input.boost=drive.boost;input.brake=drive.brake;
      input.steer=steeringFor(player.x,player.vx||0,speed,target,input.boost);
      return {input,jump:false,status:drive.brake>0?'brake':changing?'merge':charging?'recharge':'drive',targetLane:target};

    }
    return { step, reset, stats: () => ({ started, completed, jumps, multiLane, maxLaneSpan, targetLane: target, changing,certifiedNextLane:certifiedNext?.lane??null,certifiedNextHeight:certifiedNext?.height??null,certifiedHandoffs,invalidatedCertificates,releasedCertificates,backupHops }) };
  }
  return Object.freeze({ create, neutral, handling, sweptContact });
})();

// UI/lifecycle adapter. No keyboard shortcut is registered for this mode.
(() => {
  const button = document.getElementById('btn-highway-demo');
  if (!button) return;
  const planner = RoadsterHighwayDemoPlanner.create(LANE_CENTERS, WORLD_SPEED_SCALE);
  let requestingJump = false, plannedJumpHeight=2.3, plannedJumpGrace=.95;
  let active = false, pending = false, version = 0, frameInput = RoadsterHighwayDemoPlanner.neutral(), status = '', error = false;
  const busy = () => active || pending;
  function render() {
    const zh = currentLang === 'zh';
    button.hidden = currentMap !== 'highway';
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-busy', String(pending));
    button.textContent = pending ? (zh ? '演示：准备中·取消' : 'Demo: preparing · cancel') : active ? (status === 'brake' ? (zh ? '演示：制动·退出' : 'Demo: braking · exit') : (zh ? '演示：开·退出' : 'Demo: on · exit')) : error === 'ground' ? (zh ? '演示：先落地' : 'Demo: land first') : error ? (zh ? '演示：重试' : 'Demo: retry') : (zh ? '演示模式' : 'Demo drive');
    const details = error === 'ground' ? (zh ? '请先落地，再开启演示驾驶。' : 'Land before enabling demo drive.') : error ? (zh ? '旧挑战尚未确认结束，请重试演示。' : 'Previous challenge end is unconfirmed. Retry demo.') : active ? (status === 'brake' ? (zh ? '仅在预测不低于220 km/h时制动；否则优先变道或真实耗气跳跃。关闭后手动驾驶。' : 'Braking only above 220 km/h; otherwise pass or use a paid hop. Switch off for manual control.') : (zh ? '自动驾驶·目标220+ km/h·不计排行。连续变道、耗气跳跃；气量不足时受真实物理限制。' : 'Autodrive · target 220+ km/h · unranked. Continuous merges and paid hops; real tank limits apply.')) : (zh ? '第一关自动演示。真实用气与碰撞，无快捷键。' : 'Highway autodrive. Real gas and collisions. No shortcut.');
    button.title = details;
    button.setAttribute('aria-label', `${button.textContent}. ${details}`);
    button.dataset.status = status;
    document.body.classList.toggle('highway-demo-active', active);
    window.RoadsterRanked?.render();
    if (typeof updateHudBounds === 'function') updateHudBounds();
  }
  function stop() {
    if (!busy()) return;
    version++; active = pending = false; status = ''; error = false;
    frameInput = RoadsterHighwayDemoPlanner.neutral();
    clearAllInputKeys();
    render();
  }
  async function toggle() {
    if (busy()) { stop(); return; }
    if (currentMap !== 'highway' || state.isDestroyed || document.hidden) return;
    if (state.y > 0.15 || state.isJumping6m || state.isAltitudeHold) { error = 'ground'; render(); return; }
    const token = ++version;
    pending = true; error = false; clearAllInputKeys(); render();
    try {
      // Await both late issuance and server cancellation before taking control.
      await window.RoadsterRanked?.prepareForDemo();
      if (token !== version || !pending || currentMap !== 'highway' || state.isDestroyed || document.hidden) return;
      clearAllInputKeys(); planner.reset(state.x);
      active = true; pending = false; status = 'drive';
    } catch (_) {
      if (token !== version) return;
      pending = false; error = true;
    }
    render();
  }
  function step(dt) {
    if (!active) return;
    if (currentMap !== 'highway' || state.isDestroyed || document.hidden) { stop(); return; }
    const frame = planner.step(state, trafficCars, dt);
    frameInput = frame.input;
    if (frame.jump) {
      plannedJumpHeight=frame.jumpHeight||2.3;plannedJumpGrace=frame.jumpGraceSeconds||.95;
      requestingJump = true;
      try { triggerJump6m(); } finally { requestingJump = false; }
    }
    if (status !== frame.status) { status = frame.status; render(); }
  }
  button.addEventListener('click', toggle);
  window.addEventListener('blur', stop);
  window.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.RoadsterDemo = { jumpHeight: () => plannedJumpHeight, jumpGraceSeconds:()=>plannedJumpGrace, isRequestingJump: () => requestingJump, isActive: () => active, isBusy: busy, stop, toggle, step, render, input: () => frameInput };
  render();
})();
