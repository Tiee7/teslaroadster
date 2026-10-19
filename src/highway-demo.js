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
    let target = null, changing = false, dwell = 0, jumpCooldown = 0, charging = false, decisionCooldown = 0;
    let completed = 0, started = 0, jumps = 0, landingLane = null, routePlan = [], followTimer = 0;
    const previous = new WeakMap();
    function reset(x = 2.5) {
      target = nearest(x, lanes); changing = false; dwell = 0.2; jumpCooldown = 0; charging = false;
      completed = started = jumps = 0; landingLane = null; routePlan = []; decisionCooldown = 0; followTimer = 0;
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
    function step(player, cars, dt) {
      if (target === null) reset(player.x);
      jumpCooldown = Math.max(0, jumpCooldown - dt);
      decisionCooldown = Math.max(0, decisionCooldown - dt);
      const grounded = player.y <= 0.005 && Math.abs(player.vy || 0) < 0.01 && !player.isJumping6m;
      const input = neutral(), airborne = !grounded;
      const live = obstacles(cars, dt);
      // A short, paid side correction may select a clear landing lane. There
      // is no forward/lift/hover request in the air. This also escapes the
      // ordinary car-roof rebound instead of hovering over a stopped NPC.
      if (airborne) {
        const speed = Math.max(0, -player.vz);
        const landingTime = Math.max(0.2, Math.min(1.1, 0.12 + (player.vy + Math.sqrt(player.vy ** 2 + 19.62 * Math.max(0, player.y))) / 9.81));
        const room = lane => {
          let gap = 200;
          for (const o of live) {
            if (Math.abs(carX(o, landingTime) - lanes[lane]) > 3) continue;
            const low = o.z + (speed * 0.93 - o.speed) * scale * landingTime;
            const high = o.z + (speed - o.speed) * scale * landingTime;
            const separation = low <= 0 && high >= 0 ? 0 : Math.min(Math.abs(low), Math.abs(high));
            gap = Math.min(gap, separation - o.halfLength);
          }
          return gap;
        };
        if (room(target) < 18 && landingLane === null && speed < 35) {
          const base = nearest(player.x, lanes);
          const candidates = [base - 1, base, base + 1].filter(i => i >= 0 && i < lanes.length)
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
      const boostFor = (v, gas, recharging, freefall=player.isFreefalling) => !recharging && gas > 4.3 && !freefall && v < cruiseLimit;
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
      function controlsFor(v,gas,recharging,leader=null,time=0,ownMetres=0,freefall=player.isFreefalling) {
        if (!leader) return { throttle: 1, brake: 0, boost: boostFor(v,gas,recharging,freefall) ? 1 : 0 };
        const gap = Math.max(0,-relativeZ(leader,time,ownMetres)-leader.halfLength-0.3);
        const leadSpeed=Math.max(0,leader.speed+Math.min(0,leader.acceleration)*(time+0.3));
        const desiredGap=0.6+v*scale*0.005+Math.max(0,v-leadSpeed)*scale*0.02;
        const followingSpeed=leadSpeed+(gap-desiredGap)/(scale*0.30);
        const stoppingEnvelope=Math.sqrt(leadSpeed*leadSpeed+2*32*gap/scale);
        const requested=clamp(Math.min(followingSpeed,stoppingEnvelope),0,cruiseLimit);
        if (v>requested+0.3) return { throttle:0,boost:0,brake:clamp((v-requested)/8,0,1) };
        const throttle=clamp((requested-v)/6,0,1);
        return {throttle,brake:0,boost:requested>220/3.6 && throttle>0.9 && boostFor(v,gas,recharging,freefall) ? 1 : 0};
      }
      // One trajectory for first-gap validation, route ranking and the urgent
      // collision test. Integrate the real rack/yaw/lateral response rather
      // than drawing three mutually inconsistent eased/straight paths.
      function trajectory(route, horizon, useFollowing=true) {
        const p = { x: player.x, vx: player.vx || 0, yaw: player.yaw || 0, steer: player.steerInput || 0,
          speed: Math.max(0, player.speed || 0), gas: player.airRemaining, freefall: player.isFreefalling, charging, metres: 0 };
        const points = [{ t: 0, x: p.x, metres: 0 }];
        let firstArrival = null;
        const h = 0.025; let index = 0, settled = 0;
        for (let t = h; t <= horizon + 1e-6; t += h) {
          const lane = route[index];
          settled = Math.abs(p.x-lanes[lane]) < 0.32 && Math.abs(p.vx) < 1.3 ? settled+h : 0;
          if (settled >= 0.08 && firstArrival === null) firstArrival = t;
          if (settled >= 0.08 && index < route.length-1) { index++; settled=0; }
          if (p.gas < 4.3) p.charging = true;
          if (p.gas >= 7) p.charging = false;
          const leader=useFollowing ? frontLeader(p.x,route[index],t-h,p.metres) : null;
          const controls=controlsFor(p.speed,p.gas,p.charging,leader,t-h,p.metres,p.freefall);
          const boost = controls.boost > 0;
          const command = steeringFor(p.x,p.vx,p.speed,route[index],boost);
          p.steer += (command-p.steer)*(1-Math.exp(-handling.rackRate*h));
          const nx = -Math.sin(p.yaw), nz = -Math.cos(p.yaw);
          const realistic = player.physicsMode === 'realistic';
          const standard = realistic && !player.insaneMode && !boost;
          const maximum = realistic ? (standard ? 200/3.6 : 370/3.6) : 160;
          const electric = realistic ? (player.insaneMode ? 38 : 16.5) : 72;
          const jet = (realistic ? 38 : 120) * 1994 / (1850 + p.gas*14.4);
          const retroBlend=clamp((p.speed-200/3.6)/(40/3.6),0,1);
          const retroDemand=retroBlend*retroBlend*(3-2*retroBlend)*controls.brake;
          const retro=controls.brake>0 && p.gas>0 && !p.freefall ? retroDemand : 0;
          const paidRetro=Math.min(p.gas,0.55*retro*h);
          if (paidRetro>0) p.speed=Math.max(0,p.speed-80000/(1850+p.gas*14.4)*(paidRetro/0.55));
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
      const pathFor = lane => { if (!paths.has(lane)) paths.set(lane,trajectory([lane],1.0));return paths.get(lane); };
      const safePath = lane => { const path=pathFor(lane), end=(path.arrival ?? 0.65)+0.10;return collisionTime(path.filter(p=>p.t<=end)) === Infinity; };
      const threatAt = lane => collisionTime(trajectory([lane],4.2),7);
      const error = lanes[target] - player.x;
      if (Math.abs(error) < 0.32 && Math.abs(player.vx) < 1.3) {
        dwell += dt;
        if (changing && dwell >= 0.08) { changing = false; completed++; }
      } else dwell = 0;
      const currentThreat = !changing && decisionCooldown===0 && live.length ? collisionTime(trajectory([target],1.2,false),0.6) : Infinity;
      function routeRoom(first,stayFlow) {
        let best={ room: 0, score: -Infinity, flow: 0, route: [first] };
        function extend(route) {
          if (route.length === 3) {
            const path=trajectory(route,2.4);
            const collision = collisionTime(path);
            const moves=route.reduce((n,l,i)=>n+Number(l!==(i?route[i-1]:target)),0);
            const room=collision===Infinity?2.4:collision;
            const flow=path[path.length-1].metres;
            // A bounded exhibition reward keeps a safe three-stage escape
            // moving instead of settling after its first pass. Every stage
            // still has the same continuous contact validation.
            const score=room*100+flow*1.2+(flow>stayFlow+2 ? moves*8 : -moves*0.25);
            if (score > best.score) best={ room, score, flow, route: [...route] };
            return;
          }
          const last=route[route.length-1];
          for (const next of [last,last-1,last+1]) if(next>=0&&next<lanes.length) extend([...route,next]);
        }
        extend([first]);return best;
      }
      if (!changing && dwell >= 0.08 && routePlan.length) {
        while (routePlan[0] === target) routePlan.shift();
        const next = routePlan[0];
        if (next !== undefined && safePath(next)) { target=next; routePlan.shift();changing=true;dwell=0;started++; }
        else routePlan=[];
      }
      if (!changing && dwell >= 0.08 && currentThreat < 0.55 && decisionCooldown === 0) {
        decisionCooldown = 0.08;
        const stayPath=trajectory([target],2.4);
        const stayCollision=collisionTime(stayPath);
        const stayScore=(stayCollision===Infinity?2.4:stayCollision)*100+stayPath[stayPath.length-1].metres*1.2;
        const options = [target - 1, target + 1].filter(i => i >= 0 && i < lanes.length && safePath(i))
          .map(lane => ({ lane, ...routeRoom(lane,stayPath[stayPath.length-1].metres) }))
          .filter(o => o.room>=0.75 && o.score > stayScore+0.2)
          .sort((a, b) => b.score - a.score || Math.abs(a.lane - 2.5) - Math.abs(b.lane - 2.5));
        if (options.length) { target = options[0].lane; routePlan=options[0].route.slice(1); changing = true; dwell = 0; started++; }
      }
      // Check the actual near-term lateral sweep as well as the committed lane.
      // This catches a new NPC merge during our maneuver instead of camping on
      // a stripe or reversing direction indefinitely.
      const leader=frontLeader(player.x,target);
      const drive=controlsFor(speed,player.airRemaining,charging,leader);
      const immediate = collisionTime(trajectory([target],0.8),0.3,2.0,0.1);
      const jump = immediate < 0.32 && (!changing || !safePath(target)) && jumpCooldown === 0 && player.airRemaining >= 4.3 && !player.isFreefalling;
      if (jump) {
        jumpCooldown = 0.65; jumps++; routePlan=[];
        return { input: neutral(), jump: true, status: 'jump', targetLane: target };
      }
      // Keep a real short-jump/landing reserve. Ground recharge happens only
      // through the same existing no-jet physics rule as manual driving.
      Object.assign(input,drive);
      input.steer = steeringFor(player.x,player.vx || 0,speed,target,input.boost);
      return { input, jump: false, status: drive.brake>0 || drive.throttle<0.99 ? 'follow' : changing ? 'merge' : (charging ? 'recharge' : 'drive'), targetLane: target };
    }
    return { step, reset, stats: () => ({ started, completed, jumps, targetLane: target, changing }) };
  }
  return Object.freeze({ create, neutral, handling, sweptContact });
})();

// UI/lifecycle adapter. No keyboard shortcut is registered for this mode.
(() => {
  const button = document.getElementById('btn-highway-demo');
  if (!button) return;
  const planner = RoadsterHighwayDemoPlanner.create(LANE_CENTERS, WORLD_SPEED_SCALE);
  let requestingJump = false;
  let active = false, pending = false, version = 0, frameInput = RoadsterHighwayDemoPlanner.neutral(), status = '', error = false;
  const busy = () => active || pending;
  function render() {
    const zh = currentLang === 'zh';
    button.hidden = currentMap !== 'highway';
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-busy', String(pending));
    button.textContent = pending ? (zh ? '演示：准备中·取消' : 'Demo: preparing · cancel') : active ? (status === 'follow' ? (zh ? '演示：跟车·退出' : 'Demo: following · exit') : (zh ? '演示：开·退出' : 'Demo: on · exit')) : error === 'ground' ? (zh ? '演示：先落地' : 'Demo: land first') : error ? (zh ? '演示：重试' : 'Demo: retry') : (zh ? '演示模式' : 'Demo drive');
    const details = error === 'ground' ? (zh ? '请先落地，再开启演示驾驶。' : 'Land before enabling demo drive.') : error ? (zh ? '旧挑战尚未确认结束，请重试演示。' : 'Previous challenge end is unconfirmed. Retry demo.') : active ? (status === 'follow' ? (zh ? '拥堵跟车，暂时减速。空隙恢复后自动回220+ km/h。关闭后手动驾驶。' : 'Following traffic safely. Returns to 220+ km/h when clear. Switch off for manual control.') : (zh ? '自动驾驶·目标220+ km/h·不计排行。拥堵时暂时减速。关闭后手动驾驶。' : 'Autodrive · target 220+ km/h · unranked. Slows for congestion. Switch off for manual control.')) : (zh ? '第一关自动演示。真实用气与碰撞，无快捷键。' : 'Highway autodrive. Real gas and collisions. No shortcut.');
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
      requestingJump = true;
      try { triggerJump6m(); } finally { requestingJump = false; }
    }
    if (status !== frame.status) { status = frame.status; render(); }
  }
  button.addEventListener('click', toggle);
  window.addEventListener('blur', stop);
  window.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.RoadsterDemo = { jumpHeight: () => Math.max(2.3, ...trafficCars.filter(c => c.mode === 'highway' && Math.abs(c.mesh.position.z) < 50).map(c => (c.height || 1.25) + 0.8)), isRequestingJump: () => requestingJump, isActive: () => active, isBusy: busy, stop, toggle, step, render, input: () => frameInput };
  render();
})();
