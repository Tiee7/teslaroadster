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
  function sweptContact(x0,z0,x1,z1,halfX,halfZ){
  let enter=0,leave=1;
  const dx=x1-x0;
  if(Math.abs(dx)<1e-10){
    if(Math.abs(x0)>=halfX)return null;
  }else{
    let lo=(-halfX-x0)/dx,hi=(halfX-x0)/dx;
    if(lo>hi){const swap=lo;lo=hi;hi=swap;}
    enter=Math.max(enter,lo);leave=Math.min(leave,hi);
    if(enter>=leave)return null;
  }
  const dz=z1-z0;
  if(Math.abs(dz)<1e-10){
    if(Math.abs(z0)>=halfZ)return null;
  }else{
    let lo=(-halfZ-z0)/dz,hi=(halfZ-z0)/dz;
    if(lo>hi){const swap=lo;lo=hi;hi=swap;}
    enter=Math.max(enter,lo);leave=Math.min(leave,hi);
    if(enter>=leave)return null;
  }
  return leave>0&&enter<1?Math.max(0,enter):null;
}
  const neutral = () => ({ steer: 0, throttle: 0, boost: 0, brake: 0, reverse: 0, handbrake: 0, lift: 0, descend: 0, strafe: 0, roll: 0, pitch: 0 });
  const nearest = (x, lanes) => lanes.reduce((best, value, i) => Math.abs(value - x) < Math.abs(lanes[best] - x) ? i : best, 0);
  // Only opt-in demo simulation uses this clock. Manual animate(dt) is unchanged.
  function createClock() {
    const fixedDt=1/60,maxSteps=3,maxDebt=.15;
    let accumulator=0,elapsedSeconds=0,simulationSeconds=0,renders=0,steps=0;
    const clear=()=>{accumulator=0;};
    const reset=()=>{clear();elapsedSeconds=simulationSeconds=renders=steps=0;};
    const stats=()=>({fixedDt,maxSteps,maxDebt,accumulator,elapsedSeconds,simulationSeconds,renders,steps});
    function advance(seconds,simulate,isActive=()=>true){
      if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('Invalid demo frame time');
      renders++;elapsedSeconds+=seconds;accumulator+=seconds;
      // Retain short debt. Sustained <20fps explicitly exits the demo instead
      // of silently dropping time while advertising a real-time speed floor.
      if(accumulator>maxDebt)return {...stats(),overloaded:true,frameSteps:0};
      let frameSteps=0;
      while(accumulator+1e-12>=fixedDt&&frameSteps<maxSteps&&isActive()){
        accumulator=Math.max(0,accumulator-fixedDt);simulate(fixedDt);
        frameSteps++;steps++;simulationSeconds+=fixedDt;
      }
      return {...stats(),overloaded:false,frameSteps};
    }
    return Object.freeze({advance,clear,reset,stats});
  }
  // Startup veto only, not a collision-free admission certificate. A cold
  // planner must not seize manual input with less than one second of current
  // swept footprint clearance at220+. Running demo never calls this gate.
  function activationHazard(player,cars,scale){
    const speed=Math.max(0,player.speed||0,-(player.vz||0));
    if(speed<220/3.6)return false;
    const seconds=1,x=player.x,vx=player.vx||0,vz=Number.isFinite(player.vz)?player.vz:-speed;
    if(Math.abs(x)>13.65||Math.abs(x+vx*seconds)>13.65)return true;
    for(const car of cars){
      if(car.mode!=='highway'||car.highwayWaitingToSpawn!==undefined||car.mesh?.visible===false)continue;
      const cx=car.mesh?.position?.x,cz=car.mesh?.position?.z;
      if(!Number.isFinite(cx)||!Number.isFinite(cz))return true;
      const cvx=car.vx||0,cvz=Number.isFinite(car.vz)?car.vz:-Math.max(0,car.speed||0);
      if(sweptContact(cx-x,cz,cx-x+(cvx-vx)*seconds,cz+(cvz-vz)*scale*seconds,2.1,(car.length||4.62)/2+2.8)!==null)return true;
    }
    return false;
  }
  function create(lanes, scale) {
    let target = null, changing = false, dwell = 0, jumpCooldown = 0, charging = false, decisionCooldown = 0, refillTarget = 0;
    let completed = 0, started = 0, jumps = 0, landingLane = null, multiLane = 0, maxLaneSpan = 0;
    let certifiedNext=null, certifiedHandoffs=0, invalidatedCertificates=0, releasedCertificates=0, backupHops=0;
    let freshValidations=0,maxFreshValidations=0,elapsed=0,proposalHints=[];
    function rememberHints(job){
      for(const option of [job?.ready,...(job?.safeRoots||[])]){
        if(!option||option.rejected)continue;
        proposalHints=proposalHints.filter(hint=>hint.lane!==option.lane||hint.height!==option.height);
        proposalHints.push({lane:option.lane,height:option.height,entryAir:option.entryAir,
          successor:option.successor?{lane:option.successor.lane,height:option.successor.height}:null,createdAt:elapsed});
      }
      proposalHints=proposalHints.slice(-8);
    }
    let planJob=null,lastImmediate=Infinity,backgroundSearches=0,backgroundWork=0,backgroundFrames=0,maxBackgroundWork=0,expiredPlans=0,emptyPlans=0,planEpoch=0,lastPlanMismatch=null,expiryReasons={};
    const copyState=value=>Array.isArray(value)?value.map(copyState):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,copyState(item)])):value;
    let finiteSearches=0,finiteNodes=0,finiteYields=0,finiteCapped=0,finiteGoals=0,finiteMemoHits=0,continuationProofs=0,continuedCertificates=0;
    const planningWorkLimit=192,planningBudgetMs=20,clockNow=()=>typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():null;
    let renderWorkRemaining=null,renderStartedAt=null,renderDeadline=null,renderTimeLimitHits=0,maxRenderElapsedAtPlannerExitMs=0;
    function beginRender(){renderWorkRemaining=planningWorkLimit;renderStartedAt=clockNow();renderDeadline=renderStartedAt===null?null:renderStartedAt+planningBudgetMs;}
    const previous = new WeakMap();
    // These are the complete audited future-control/physical dependencies.
    // Render/score/scene-graph objects are deliberately not cache authority.
    const controlPhysicsKeys=('x y z vx vy vz speed maxSpeed airMaxSpeed physicsMode insaneMode gasMassKg airStrafeSpeed steerInput steerAngle roll pitch yaw vRoll vPitch vYaw attitudeIdleSeconds accumulatedRoll lateralG longitudinalG prevSpeed airRemaining airUsedContinuous infiniteJet isFreefalling isAutoDescending8s isJumping6m isAltitudeHold isAutoLandingSave wasAirborne jumpInertiaSeconds jumpInertiaGraceSeconds driftAngle isDrifting wasHandbraking autoStabilizer isDestroyed hullIntegrity impactCooldown jumpStartY jumpTargetY holdTargetY hudMode hudMinimal').split(' ');
    const controlPhysicsSchema='demo-control-physics-r128-v5-fuel-mode';
    const directKeyCodes=['KeyW','KeyA','KeyS','KeyD','KeyH','KeyU','Space','Semicolon','ShiftLeft','ShiftRight','KeyQ','KeyE','KeyN','KeyI','KeyK','KeyJ','KeyL','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
    const externalControlState=()=>({map:typeof currentMap==='undefined'?'highway':currentMap,active:!!globalThis.window?.RoadsterDemo?.isActive?.(),busy:!!globalThis.window?.RoadsterDemo?.isBusy?.(),requestingJump:!!globalThis.window?.RoadsterDemo?.isRequestingJump?.(),weatherIndex:typeof weatherIndex==='undefined'?null:weatherIndex,audioInitialized:typeof sound==='undefined'?false:sound.initialized===true,keys:directKeyCodes.map(code=>typeof keys==='undefined'?false:!!keys[code])});
    const controlState=p=>Object.fromEntries(controlPhysicsKeys.map(key=>[key,p[key]]));
    const controlCars=cars=>cars.map(car=>({...copyState(Object.fromEntries(Object.entries(car).filter(([key])=>key!=='mesh'))),
      mesh:{position:{x:car.mesh.position.x,y:car.mesh.position.y,z:car.mesh.position.z},rotation:{x:car.mesh.rotation.x,y:car.mesh.rotation.y,z:car.mesh.rotation.z},visible:car.mesh.visible}}));
    const certificatePhase=certificate=>certificate?Object.fromEntries(['lane','height','requiredNextAir','physicsMode','insaneMode','infiniteJet','frameDt','phase','successorGeometry'].map(key=>[key,certificate[key]])):null;
    function exactDifference(expected,actual,path=''){
      if(expected===null||actual===null||typeof expected!=='object'||typeof actual!=='object')return Object.is(expected,actual)?null:path||'value';
      if(Array.isArray(expected)!==Array.isArray(actual))return path||'type';
      const keys=Object.keys(expected);if(keys.length!==Object.keys(actual).length)return path+'.keys';
      for(const key of keys){if(!Object.prototype.hasOwnProperty.call(actual,key))return path+'.'+key;const difference=exactDifference(expected[key],actual[key],path?path+'.'+key:key);if(difference)return difference;}
      return null;
    }
    let admissionJob=null,stepSeed=null,simulationFrame=-1,lastFrameAirborne=false,groundReanchorPending=false,certificateSerial=0;
    let sourceStartChecks=0,sourceAnchorChecks=0,sourceInvalidations=0,cachedSourceCommits=0,lastSourceFailure=null;
    let groundReanchors=0,groundWindows=0,groundWindowFailures=0,groundWindowWork=0,lastGroundReanchor=null;
    let preparedJobs=0,preparedWork=0,preparedChecks=0,preparedStartChecks=0,preparedInvalidations=0,preparedNoReady=0,maxPreparedWork=0,preparedCommits=0,preparedDeferred=0,lastPreparedFailure=null;
    const actualRoute=cars=>({target,changing,dwell,jumpCooldown,charging,decisionCooldown,refillTarget,landingLane,
      certificate:certificatePhase(certifiedNext),previousSpeeds:cars.map(car=>previous.get(car))});
    function projectedRoute(p,cars,prepared=false){return {target:p.demoTarget,changing:p.demoChanging,dwell:p.demoDwell,jumpCooldown:p.demoJumpCooldown,
      charging:p.demoCharging,decisionCooldown:p.demoDecisionCooldown,refillTarget:p.demoRefillTarget,landingLane:p.demoLandingLane??null,
      certificate:p.demoCertificate?p.demoCertificatePhase:null,previousSpeeds:prepared?cars.map((car,i)=>car.mode==='highway'&&car.highwayWaitingToSpawn===undefined&&car.mesh.visible!==false?car.speed:p.demoNpcSpeeds[i]):[...p.demoNpcSpeeds]};}
    const projectedCheckpoint=(p,cars,frame,prepared=false)=>({schema:controlPhysicsSchema,frame,external:copyState(p.demoControlExternal),state:controlState(p),cars:controlCars(cars),route:copyState(projectedRoute(p,cars,prepared))});
    const actualCheckpoint=(player,cars,frame)=>({schema:controlPhysicsSchema,frame,external:externalControlState(),state:controlState(player),cars:controlCars(cars),route:actualRoute(cars)});
    // Same projection/key-presence/Object.is comparison as materializing an
    // actualCheckpoint, without deep-copying numerical NPC data just to read it.
    // Immutable snapshots are still recorded for all future proof checkpoints.
    function actualDifference(expected,player,cars,frame){
      if(!expected||typeof expected!=='object'||Array.isArray(expected))return exactDifference(expected,actualCheckpoint(player,cars,frame));
      if(Object.keys(expected).length!==6)return '.keys';
      for(const key of Object.keys(expected))if(!['schema','frame','external','state','cars','route'].includes(key))return '.'+key;
      let difference=exactDifference(expected.schema,controlPhysicsSchema,'schema')||exactDifference(expected.frame,frame,'frame')||exactDifference(expected.external,externalControlState(),'external');
      if(difference)return difference;
      if(!expected.state||typeof expected.state!=='object'||Array.isArray(expected.state))return exactDifference(expected.state,controlState(player),'state');
      if(Object.keys(expected.state).length!==controlPhysicsKeys.length)return 'state.keys';
      for(const key of Object.keys(expected.state)){
        if(!controlPhysicsKeys.includes(key))return 'state.'+key;
        if(!Object.is(expected.state[key],player[key]))return 'state.'+key;
      }
      if(!Array.isArray(expected.cars))return exactDifference(expected.cars,controlCars(cars),'cars');
      if(Object.keys(expected.cars).length!==Object.keys(cars).filter(key=>String(Number(key))===key&&Number.isInteger(Number(key))&&Number(key)>=0&&Number(key)<cars.length).length)return 'cars.keys';
      for(const i of Object.keys(expected.cars)){
        if(String(Number(i))!==i||!Number.isInteger(Number(i))||Number(i)<0||Number(i)>=cars.length||!Object.hasOwn(cars,i))return 'cars.'+i;
        const a=expected.cars[i],b=cars[i],path='cars.'+i;
        if(a===null||typeof a!=='object'||Array.isArray(a))return exactDifference(a,controlCars([b])[0],path);
        const actualKeys=Object.keys(b).filter(key=>key!=='mesh');
        if(Object.keys(a).length!==actualKeys.length+1)return path+'.keys';
        for(const key of Object.keys(a)){
          if(key==='mesh'){
            const mesh=b.mesh,view={position:{x:mesh.position.x,y:mesh.position.y,z:mesh.position.z},rotation:{x:mesh.rotation.x,y:mesh.rotation.y,z:mesh.rotation.z},visible:mesh.visible};
            difference=exactDifference(a.mesh,view,path+'.mesh');
          }else if(!Object.prototype.propertyIsEnumerable.call(b,key))return path+'.'+key;
          else difference=exactDifference(a[key],b[key],path+'.'+key);
          if(difference)return difference;
        }
      }
      return exactDifference(expected.route,actualRoute(cars),'route');
    }
    function invalidateAdmission(reason,details=null){
      if(!admissionJob)return;preparedInvalidations++;if(reason.includes('ready')||reason.includes('missed'))preparedNoReady++;
      lastPreparedFailure={reason,frame:simulationFrame,anchorFrame:admissionJob.anchor?.frame??admissionJob.pendingAnchor?.frame,...details};
      if(reason.includes('ready')||reason.includes('missed')){
        // A missed current-frame deadline must not restart the same impossible
        // offset-zero proof. Reserve future normal-ground preparation work at
        // the clock's worst three simulation steps per render, without draining.
        const proofWork=Math.max(1,admissionJob.work-(admissionJob.pendingWorkStart??admissionJob.work));
        const retryLeadFrames=Math.max(3,Math.ceil(proofWork/(planningWorkLimit/3))+2);
        if(admissionJob.promised&&certifiedNext)certifiedNext.retryLeadFrames=Math.max(certifiedNext.retryLeadFrames||0,retryLeadFrames);
        else if(admissionJob.sourceJob)admissionJob.sourceJob.retryLeadFrames=Math.max(admissionJob.sourceJob.retryLeadFrames||0,retryLeadFrames);
      }
      admissionJob.invalid=true;admissionJob.iterator=null;
    }
    function invalidateSource(reason,details=null){
      if(!planJob?.strictSource||planJob.sourceInvalid)return;
      planJob.sourceInvalid=true;planJob.sourceCheckpoints=null;sourceInvalidations++;
      lastSourceFailure={reason,frame:simulationFrame,...details};
    }
    function recordSourceCheckpoint(job,p,cars){
      if(job?.strictSource&&!job.sourceInvalid&&!job.sourceCheckpoints.has(job.cursorFrame))job.sourceCheckpoints.set(job.cursorFrame,projectedCheckpoint(p,cars,job.cursorFrame));
    }
    function consumePreparedSource(player,cars,dt,immediate){
      const job=planJob;if(certifiedNext||!job?.strictSource||job.sourceInvalid||!job.readyGoal||!job.sourceAnchor)return null;
      if(job.fromEarlyBridge&&!job.bridgeValidated){invalidateSource('unvalidated-early-bridge');return null;}
      if(job.projectionKernel){try{(job.projectionKernel.assertRuntime||job.projectionKernel.assertSources)();}catch(error){invalidateSource('projection-source-version');return null;}}
      if(job.dt!==dt||job.epoch!==planEpoch||job.sourceSchema!==controlPhysicsSchema||job.identities.length!==cars.length||job.identities.some((car,i)=>car!==cars[i])){invalidateSource('source-version');return null;}
      if(job.sourceValidatedUntil!==simulationFrame){invalidateSource('unchecked-source-frame');return null;}
      if(job.sourceAnchor.frame>simulationFrame)return {waiting:true};
      if(job.sourceAnchor.frame<simulationFrame){invalidateSource('missed-source-anchor');return null;}
      if(player.physicsMode!=='realistic'||player.insaneMode||player.isDestroyed||player.isFreefalling||player.impactCooldown>0||player.speed<220/3.6||cars.some(car=>car.blastTimer>0)||!(immediate<.55)){
        invalidateSource('source-anchor-domain');return null;
      }
      sourceAnchorChecks++;const difference=actualDifference(job.sourceAnchor,player,cars,simulationFrame);
      if(difference){invalidateSource('source-anchor-mismatch',{difference});return null;}
      const goal=job.readyGoal,path=goal.path;for(let i=0;i<path.length-1;i++)path[i].successor=path[i+1];
      const root=path[0];root.fromCertificate=false;root.rankingTerminal=path.length<=2?goal.terminal:null;
      planJob=null;admissionJob=null;cachedSourceCommits++;return {root};
    }
    // Verification prototype: frozen exact numeric kernel is supplied by the
    // isolated test realm. Production integration must use the audited static
    // source/identity-guarded kernel, never an unverified ambient replacement.
    let earlyJob=null,prefetchJob=null,pendingEarlySeed=null,lastProjectionApi=null,lastLaunchedFromCertificate=false;
    let earlyJobs=0,earlyWork=0,earlyChecks=0,earlyInvalidations=0,earlyLandings=0,earlyFreshCChecks=0;
    let lastEarlyFailure=null,lastEarlyPromotion=null;let prefetchJobs=0,prefetchWork=0,prefetchBindings=0,prefetchInvalidations=0,lastPrefetchFailure=null,lastPrefetchBinding=null,prefetchRejectedPhase=null;
    function invalidateEarly(reason,details=null){
      if(!earlyJob)return;
      earlyInvalidations++;lastEarlyFailure={reason,frame:simulationFrame,...details};
      if(planJob===earlyJob.source)planJob=null;
      earlyJob.invalid=true;earlyJob.iterator=null;earlyJob=null;pendingEarlySeed=null;
    }
    function invalidatePrefetch(reason,details=null){
      if(!prefetchJob)return;prefetchInvalidations++;lastPrefetchFailure={reason,frame:simulationFrame,...details};
      prefetchRejectedPhase=prefetchJob.certificate.phase;prefetchJob.invalid=true;prefetchJob.iterator=null;prefetchJob=null;
    }
    function checkPrefetchDomain(player,cars,dt){
      const job=prefetchJob;if(!job)return;
      if(job.dt!==dt||job.epoch!==planEpoch||job.identities.length!==cars.length||job.identities.some((car,i)=>car!==cars[i])){invalidatePrefetch('prefetch-version');return;}
      if(player.physicsMode!==job.physicsMode||!!player.insaneMode!==job.insaneMode||!!player.infiniteJet!==!!job.infiniteJet||player.isDestroyed||player.isFreefalling||player.isAltitudeHold||player.impactCooldown>0){invalidatePrefetch('prefetch-domain');return;}
      const externalDifference=exactDifference(job.external,externalControlState());if(externalDifference){invalidatePrefetch('prefetch-external',{difference:externalDifference});return;}
      try{(job.kernel.assertRuntime||job.kernel.assertSources)();}catch(error){invalidatePrefetch('prefetch-source-version');return;}
      if(simulationFrame-job.createdFrame>Math.ceil(7/dt)){invalidatePrefetch('prefetch-expired');return;}
      if(job.expectedLaunches.size===2&&simulationFrame>=job.expectedC.anchor.frame){invalidatePrefetch('missed-real-B-C-cut');return;}
      if(!job.bConsumed){if(exactDifference(job.certificate,certificatePhase(certifiedNext)))invalidatePrefetch('original-B-contract-lost');}
      else if(certifiedNext){if(exactDifference(job.futureCertificate,certificatePhase(certifiedNext)))invalidatePrefetch('original-C-contract-lost');}
      // A freshly executed B legitimately has no C certificate while its one
      // already selected continuation is being independently recomputed.
      else if(planJob?.kind!=='continuation'||planJob!==job.continuationJob)invalidatePrefetch('C-continuation-lost');
    }
    function earlyExternal(external,requestingJump=false){return {...external,requestingJump,keys:Object.fromEntries(directKeyCodes.map((code,i)=>[code,external.keys[i]]))};}
    function applyEarlyRoute(p,route,external){Object.assign(p,{demoControlExternal:copyState(external),demoTarget:route.target,demoChanging:route.changing,
      demoDwell:route.dwell,demoJumpCooldown:route.jumpCooldown,demoCharging:route.charging,demoDecisionCooldown:route.decisionCooldown,
      demoRefillTarget:route.refillTarget,demoLandingLane:route.landingLane,demoCertificate:!!route.certificate,
      demoCertificatePhase:copyState(route.certificate),demoNpcSpeeds:[...route.previousSpeeds],demoRoutePrepared:false});}
    function prepareEarlyAir(p,cars,route,h,prepared=false){
      if(route.landingLane===null||route.landingLane===undefined)throw Error('unfixed-early-landing-lane');
      if(!prepared){
        route.jumpCooldown=Math.max(0,route.jumpCooldown-h);if(route.jumpCooldown<1e-7)route.jumpCooldown=0;
        route.decisionCooldown=Math.max(0,route.decisionCooldown-h);if(route.decisionCooldown<1e-7)route.decisionCooldown=0;
        route.previousSpeeds=cars.map((car,i)=>car.mode==='highway'&&car.highwayWaitingToSpawn===undefined&&car.mesh.visible!==false?Math.max(0,car.speed||0):route.previousSpeeds[i]);
      }
      const input=neutral();if(p.y>1.6)route.landingLane=route.target;
      const error=lanes[route.target]-p.x;
      if(p.airRemaining>.3&&(Math.abs(error)>.24||Math.abs(p.vx)>.7)){
        const desired=clamp(error*5-p.vx*.65,-8.5,8.5),side=desired*Math.cos(p.yaw||0)-p.vz*Math.sin(p.yaw||0);
        input.strafe=clamp(side/18,-.8,.8);
      }
      return input;
    }
    function* earlyBridgeSteps(job,seed,api,kernel){
      let p=copyState(seed.state),traffic=copyState(seed.cars),route=copyState(seed.route),frame=seed.frame,first=true,launched=0;
      const h=job.dt,external=seed.external;applyEarlyRoute(p,route,external);
      // Only the remainder of one committed B and its already promised C.
      // All prelude physical/NPC frames yield against the SAME render budget.
      const lastBridgeFrame=seed.frame+Math.ceil(7/h);
      while(frame<=lastBridgeFrame){
        const air=!(p.y<=.005&&Math.abs(p.vy||0)<.01&&!p.isJumping6m);
        if(!first)job.checkpoints.set(frame,projectedCheckpoint(p,traffic,frame));
        if(launched===job.expectedLaunchCount&&!air){
          job.landingFrame=frame;job.landingCheckpoint=projectedCheckpoint(p,traffic,frame);
          const source=api.makeProjectedGroundJob(p,traffic,frame);source.projectionKernel=kernel;source.sourceSeed=projectedCheckpoint(p,traffic,frame);job.source=source;
          // age is measured from this FUTURE ground source, never reset when
          // it becomes real. The finite horizon therefore remains unchanged.
          source.age=(simulationFrame-frame)*h;source.untilStart=-source.age;
          let result;
          do{result=source.iterator.next();source.work++;if(!result.done)yield null;}while(!result.done);
          source.done=true;source.result=result.value;source.completionFrame=simulationFrame;finishFiniteJob(source);
          return {source};
        }
        let input=neutral(),jump=null;
        if(air){input=prepareEarlyAir(p,traffic,route,h,first);applyEarlyRoute(p,route,external);job.preparedCheckpoints.set(frame,projectedCheckpoint(p,traffic,frame,true));}
        else{
          yield* api.prepareProjectedGroundSteps(p,traffic,h);route=copyState(projectedRoute(p,traffic,true));
          const c=route.certificate;
          if(c&&route.jumpCooldown===0&&p.airRemaining>=api.entryAir(c.height,p)){
            // Conditional expected event only. Actual C still has its own
            // independent fresh admission, checked before any early reuse.
            const expected=projectedCheckpoint(p,traffic,frame,true);job.preparedCheckpoints.set(frame,expected);
            const option=yield* api.candidateSteps(p,traffic,c.height,c.lane,true,null,c.requiredNextAir);
            if(!option)return {failed:'expected-C-not-safe'};
            job.expectedC={anchor:expected,height:option.height,lane:option.lane,duration:option.duration,groundWait:option.groundWait,
              preparation:option.preparation,requiredNextAir:option.requiredNextAir};
            job.expectedLaunches.set(frame,job.expectedC);
            jump={height:option.height,grace:Math.min(2.4,option.duration+.18)};
            if(option.lane!==route.target){route.changing=true;route.dwell=0;}
            route.target=option.lane;route.landingLane=option.lane;route.refillTarget=option.requiredNextAir;
            // Speculative C metadata has zero action authority. Reuse starts
            // only at the full exact REAL B+true-C prepared-state cut below.
            const next=job.prefetch?c.successorGeometry:null;
            route.certificate=next?{lane:next.lane,height:next.height,requiredNextAir:next.requiredNextAir,physicsMode:p.physicsMode,
              insaneMode:!!p.insaneMode,infiniteJet:!!p.infiniteJet,frameDt:h,phase:c.phase+1,successorGeometry:null}:null;
            route.jumpCooldown=option.duration+option.groundWait;applyEarlyRoute(p,route,external);launched++;
          }else{
            const drive=p.demoControls,v=Math.max(0,-p.vz,p.speed||0);input.throttle=drive.throttle;input.boost=drive.boost;input.brake=drive.brake;
            input.steer=api.steeringFor(p.x,p.vx||0,v,route.target,input.boost);applyEarlyRoute(p,route,external);
          }
        }
        if(jump){const out=kernel.triggerJump6m({state:p,cars:traffic,input,external:earlyExternal(external,true),dt:h,jumpHeight:jump.height,jumpGraceSeconds:jump.grace});if(!out.supported)return {failed:'kernel-C-jump-rejected',boundary:out.unsupported||out.contact};p=out.state;traffic=out.cars;}
        const out=kernel.step({state:p,cars:traffic,input,external:earlyExternal(external),dt:h});
        if(!out.supported)return {failed:'kernel-step-rejected',boundary:out.unsupported||out.contact};
        if(out.state.speed<220/3.6)return {failed:'bridge-speed-floor'};
        p=out.state;traffic=out.cars;frame++;first=false;yield null;
      }
      return {failed:'bounded-bridge-expired'};
    }
    // Bind the source-pinned numeric projection lazily, after all real helpers
    // exist. No ambient verification kernel can authorize production reuse.
    let numericProjectionKernel=null;
    function projectionKernel(){
      try{
        if(typeof RoadsterDemoNumericProjection==='undefined')return null;
        return numericProjectionKernel||(numericProjectionKernel=RoadsterDemoNumericProjection.create());
      }catch(error){return null;}
    }
    function maybeStartEarly(player,cars,dt){
      if(earlyJob||!lastProjectionApi||!certifiedNext||landingLane===null||dt!==1/60)return;
      const isPrefetch=!lastLaunchedFromCertificate&&!!certifiedNext.successorGeometry;
      const isStrict=lastLaunchedFromCertificate&&!certifiedNext.successorGeometry;
      if(!isPrefetch&&!isStrict||isPrefetch&&certifiedNext.phase===prefetchRejectedPhase)return;
      const external=externalControlState(),kernel=projectionKernel();
      if(!kernel||external.weatherIndex!==0||!external.audioInitialized||external.requestingJump||!external.active||!external.busy||external.keys.some(Boolean))return;
      if(isPrefetch&&prefetchJob)return;
      const seed=actualCheckpoint(player,cars,simulationFrame);
      if(isStrict&&prefetchJob){
        const job=prefetchJob,expected=job.preparedCheckpoints.get(simulationFrame);
        if(job.dt!==dt||job.epoch!==planEpoch||job.identities.length!==cars.length||job.identities.some((car,i)=>car!==cars[i])){invalidatePrefetch('prefetch-version');return;}
        if(!expected)return;
        const difference=exactDifference(expected,seed);
        if(difference){invalidatePrefetch('prefetch-cut-mismatch',{difference});return;}
        try{(job.kernel.assertRuntime||job.kernel.assertSources)();}catch(error){invalidatePrefetch('prefetch-source-version');return;}
        job.validatedUntil=simulationFrame;job.boundaryFrame=simulationFrame;earlyJob=job;prefetchJob=null;prefetchBindings++;earlyJobs++;
        lastPrefetchBinding={createdFrame:job.createdFrame,boundaryFrame:simulationFrame,additionalSeconds:(simulationFrame-job.createdFrame)*dt,
          work:job.work,sourceWork:job.source?.work??0,sourceReady:!!job.source?.readyGoal};
        return;
      }
      pendingEarlySeed={seed,identities:[...cars],api:lastProjectionApi,kernel,dt,prefetch:isPrefetch};
    }
    function startPendingEarly(){
      if(earlyJob||!pendingEarlySeed)return;
      const {seed,identities,api,kernel,dt,prefetch}=pendingEarlySeed;pendingEarlySeed=null;
      if(seed.frame!==simulationFrame)return;
      const job={dt,epoch:planEpoch,identities,certificate:copyState(seed.route.certificate),work:0,done:false,result:null,invalid:false,
        createdFrame:simulationFrame,validatedUntil:simulationFrame,checkpoints:new Map(),preparedCheckpoints:new Map(),expectedLaunches:new Map(),
        expectedLaunchCount:prefetch?2:1,prefetch,source:null,kernel,cExecuted:false,landingValidated:false,bConsumed:false,
        physicsMode:seed.state.physicsMode,insaneMode:!!seed.state.insaneMode,infiniteJet:!!seed.state.infiniteJet,external:copyState(seed.external)};
      const b=job.certificate,c=b.successorGeometry;job.futureCertificate=c?{lane:c.lane,height:c.height,requiredNextAir:c.requiredNextAir,physicsMode:b.physicsMode,
        insaneMode:b.insaneMode,infiniteJet:!!b.infiniteJet,frameDt:b.frameDt,phase:b.phase+1,successorGeometry:null}:null;
      job.iterator=earlyBridgeSteps(job,seed,api,kernel);if(prefetch){prefetchJob=job;prefetchJobs++;}else{earlyJob=job;earlyJobs++;}
    }
    function endRender(){
      startPendingEarly();advancePlanJob(true);advanceEarly();
      if(renderStartedAt!==null)maxRenderElapsedAtPlannerExitMs=Math.max(maxRenderElapsedAtPlannerExitMs,clockNow()-renderStartedAt);
    }
    function advanceEarly(){
      const job=earlyJob||prefetchJob;if(!job||job.done)return;
      const invalidate=job===earlyJob?invalidateEarly:invalidatePrefetch;
      try{const work=spendWork(job);if(job===earlyJob)earlyWork+=work;else prefetchWork+=work;}catch(error){invalidate('kernel-exception',{code:error.code||null,message:error.message});return;}
      if(job.done&&(!job.result?.source||!job.source?.readyGoal))invalidate(job.result?.failed||'no-complete-early-goal',{boundary:job.result?.boundary});
    }
    function checkEarlyFreshC(job,option){
      const bridge=earlyJob||prefetchJob;if(!bridge)return;
      if(bridge===prefetchJob&&bridge.bConsumed){invalidatePrefetch('C-fresh-without-strict-cut');return;}
      const invalidate=bridge===earlyJob?invalidateEarly:invalidatePrefetch;
      const expected=bridge.expectedLaunches.get(simulationFrame);
      if(!expected){invalidate('expected-C-not-ready');return;}
      const difference=exactDifference(expected.anchor,job.anchor)||exactDifference(
        {height:expected.height,lane:expected.lane,duration:expected.duration,groundWait:expected.groundWait,preparation:expected.preparation,requiredNextAir:expected.requiredNextAir},
        {height:option.height,lane:option.lane,duration:option.duration,groundWait:option.groundWait,preparation:option.preparation,requiredNextAir:option.requiredNextAir});
      earlyFreshCChecks++;if(difference)invalidate('actual-C-fresh-mismatch',{difference});else if(bridge===earlyJob)bridge.cExecuted=true;else bridge.bConsumed=true;
    }
    function checkEarlyBeforeControl(player,cars,dt,air){
      if(!earlyJob)return false;const job=earlyJob;
      try{(job.kernel.assertRuntime||job.kernel.assertSources)();}catch(error){invalidateEarly('bridge-source-version',{code:error.code||null});return false;}
      if(job.dt!==dt||job.epoch!==planEpoch||job.identities.length!==cars.length||job.identities.some((car,i)=>car!==cars[i])){invalidateEarly('bridge-version');return false;}
      if(job.validatedUntil!==simulationFrame-1){invalidateEarly('bridge-prefix-gap');return false;}
      const expected=job.checkpoints.get(simulationFrame)||job.source?.sourceCheckpoints.get(simulationFrame);
      if(!expected){invalidateEarly('bridge-checkpoint-not-ready');return false;}
      earlyChecks++;const difference=actualDifference(expected,player,cars,simulationFrame);
      if(difference){invalidateEarly('bridge-control-physics-mismatch',{difference});return false;}
      job.validatedUntil=simulationFrame;job.checkpoints.delete(simulationFrame);
      if(!air&&job.landingFrame===simulationFrame){
        if(!job.cExecuted||!job.source||!job.landingCheckpoint){invalidateEarly('C-landing-without-complete-bridge');return false;}
        const seedDifference=exactDifference(job.landingCheckpoint,job.source.sourceSeed);if(seedDifference){invalidateEarly('C-source-seed-mismatch',{difference:seedDifference});return false;}
        const source=job.source;source.bridgeValidated=true;source.sourceValidatedUntil=simulationFrame-1;
        planJob=source;admissionJob=null;earlyLandings++;lastEarlyPromotion={createdFrame:job.createdFrame,landingFrame:simulationFrame,work:job.work,sourceWork:source.work,
          sourceReady:!!source.readyGoal,completionFrame:source.completionFrame??null,anchorFrame:source.sourceAnchor?.frame??null};
        earlyJob=null;return true;
      }
      return false;
    }
    function beforeControlStep(player,cars,dt){
      simulationFrame++;const air=!(player.y<=.005&&Math.abs(player.vy||0)<.01&&!player.isJumping6m);
      pendingEarlySeed=null;const earlyPromoted=checkEarlyBeforeControl(player,cars,dt,air);
      if(air){invalidateSource('unexpected-source-air');lastFrameAirborne=true;stepSeed=null;return;}
      if(lastFrameAirborne){lastFrameAirborne=false;admissionJob=null;groundReanchorPending=!earlyPromoted;}
      stepSeed=actualCheckpoint(player,cars,simulationFrame);
      if(planJob?.strictSource&&!planJob.sourceInvalid){
        if(planJob.dt!==dt||planJob.epoch!==planEpoch||planJob.sourceSchema!==controlPhysicsSchema||planJob.identities.length!==cars.length||planJob.identities.some((car,i)=>car!==cars[i]))invalidateSource('source-version');
        else if(planJob.sourceValidatedUntil!==simulationFrame-1)invalidateSource('source-prefix-gap');
        else{
          const expected=planJob.sourceCheckpoints.get(simulationFrame);
          if(!expected)invalidateSource('source-prefix-not-ready');
          else{sourceStartChecks++;const difference=exactDifference(expected,stepSeed);if(difference)invalidateSource('source-prefix-mismatch',{difference});else{planJob.sourceValidatedUntil=simulationFrame;planJob.sourceCheckpoints.delete(simulationFrame);}}
        }
      }
      if(admissionJob&&!admissionJob.invalid){
        if(admissionJob.dt!==dt||admissionJob.epoch!==planEpoch||admissionJob.identities.length!==cars.length||admissionJob.identities.some((car,i)=>car!==cars[i]))invalidateAdmission('phase-version');
        else{const expected=admissionJob.checkpoints.get(simulationFrame);if(!expected)invalidateAdmission('checkpoint-not-prepared');else{preparedStartChecks++;const difference=exactDifference(expected,stepSeed);if(difference)invalidateAdmission('control-physics-mismatch',{difference});}}
      }
    }
    function spendWork(job){
      let work=0;const budget=renderWorkRemaining??planningWorkLimit;
      while(work<budget&&!job.done&&!job.invalid){
        if(renderDeadline!==null&&clockNow()>=renderDeadline){renderTimeLimitHits++;break;}
        const next=job.iterator.next();work++;job.work++;
        if(next.done){job.done=true;job.result=next.value;job.completionFrame=simulationFrame;}
      }
      if(renderWorkRemaining!==null)renderWorkRemaining-=work;
      backgroundWork+=work;if(work)backgroundFrames++;maxBackgroundWork=Math.max(maxBackgroundWork,renderWorkRemaining===null?work:planningWorkLimit-renderWorkRemaining);
      return work;
    }
    function* prepareAdmissionSteps(job,api,seed){
      const p=copyState(seed.state),traffic=copyState(seed.cars),route=seed.route,dt=job.dt;
      Object.assign(p,{demoControlExternal:copyState(seed.external),demoTarget:route.target,demoLandingLane:route.landingLane,demoChanging:route.changing,demoDwell:route.dwell,demoJumpCooldown:route.jumpCooldown,
        demoCharging:route.charging,demoDecisionCooldown:route.decisionCooldown,demoRefillTarget:route.refillTarget,demoCertificate:!!route.certificate,
        demoCertificatePhase:copyState(route.certificate),demoNpcSpeeds:[...route.previousSpeeds],demoRoutePrepared:false});
      let attemptedAnchor=false;
      for(let offset=0;offset<=Math.ceil(2.4/dt);offset++){
        const frame=seed.frame+offset;job.checkpoints.set(frame,projectedCheckpoint(p,traffic,frame));
        yield* api.prepareProjectedGroundSteps(p,traffic,dt);p.demoLandingLane=null;
        const immediate=api.projectedImmediate(p,traffic,dt),entryAir=api.entryAir(job.geometry[0].height,p);
        if(frame>=job.minimumAnchorFrame&&p.demoJumpCooldown===0&&(job.promised||immediate<.55)&&p.airRemaining>=entryAir){
          attemptedAnchor=true;const anchor=projectedCheckpoint(p,traffic,frame,true);job.pendingAnchor=anchor;job.pendingWorkStart=job.work;
          const arcs=[];let state=p,cars=traffic,clear=true;
          for(let i=0;i<job.geometry.length;i++){
            const selected=job.geometry[i],next=job.geometry[i+1],nextAir=selected.requiredNextAir??(next?api.entryAir(next.height,p):3.6);job.nodes++;
            const option=yield* api.candidateSteps(state,cars,selected.height,selected.lane,true,null,nextAir);
            if(!option){clear=false;break;}arcs.push(option);state=option.endpoint;cars=option.forecast;
          }
          let terminal=null;if(clear&&!job.promised)terminal=yield* api.groundTerminalSteps(state,cars);
          if(clear&&(job.promised||terminal)){
            for(let i=0;i<arcs.length-1;i++)arcs[i].successor=arcs[i+1];
            job.pendingAnchor=null;job.anchor=anchor;return {root:arcs[0],terminal,arcCount:arcs.length};
          }
          job.pendingAnchor=null;
        }
        const before=api.groundSweepBefore(p,traffic);api.projectedGroundStep(p,traffic,dt);p.impactCooldown=Math.max(0,p.impactCooldown-dt);yield null;
        if(!api.groundSweepClear(p,traffic,before))return null;
      }
      // No common launch in this safe prefix is not rejection of future
      // geometry. Keep its ranking work and checked prefix until a fresh seed
      // is needed; the old prefix never authorizes an actual launch.
      return attemptedAnchor?null:{deferred:true,retryFrame:seed.frame+Math.ceil(1.2/dt)};
    }
    function prepareActualAdmission(api,player,cars,dt,immediate){
      if(player.physicsMode!=='realistic'||player.insaneMode||player.isDestroyed||player.isFreefalling||player.impactCooldown>0||player.speed<220/3.6||cars.some(car=>car.blastTimer>0))return null;
      if(admissionJob?.promised&&!certifiedNext)invalidateAdmission('certificate-released');
      if(admissionJob?.invalid){
        if(lastPreparedFailure?.reason==='no-complete-selected-path'&&!admissionJob.promised&&planJob===admissionJob.sourceJob)planJob=null;
        admissionJob=null;return null;
      }
      if(admissionJob?.result?.deferred&&simulationFrame>=admissionJob.result.retryFrame)admissionJob=null;
      if(!admissionJob){
        const promised=!!certifiedNext,goal=planJob?.readyGoal;
        if(!promised&&planJob&&!['ground','ground-window'].includes(planJob.origin))return null;
        // Source timing schedules work only. Consumption below still requires
        // the actual common trigger and an exact current physical checkpoint.
        if(!promised&&planJob?.readyGoal&&planJob?.candidateLaunchAge+(goal?.launchDelay||0)-planJob?.age>2.4)return null;
        const geometry=promised?[{height:certifiedNext.height,lane:certifiedNext.lane,requiredNextAir:certifiedNext.requiredNextAir??3.6}]:goal?.path.map(option=>({height:option.height,lane:option.lane,requiredNextAir:option.requiredNextAir}));
        if(!geometry?.length||!stepSeed)return null;
        const sourceFrame=!promised&&Number.isFinite(planJob?.createdFrame)&&Number.isFinite(planJob?.candidateLaunchAge)
          ?(Number.isFinite(planJob.candidateLaunchFrame)&&Number.isFinite(goal.launchFrames)?planJob.candidateLaunchFrame+goal.launchFrames:planJob.createdFrame+Math.round((planJob.candidateLaunchAge+(goal.launchDelay||0))/dt)):stepSeed.frame;
        admissionJob={dt,epoch:planEpoch,identities:[...cars],sourceJob:planJob,promised,geometry,minimumAnchorFrame:Math.max(sourceFrame,stepSeed.frame+(promised?(certifiedNext.retryLeadFrames||0):(planJob?.retryLeadFrames||0))),checkpoints:new Map(),anchor:null,pendingAnchor:null,done:false,result:null,invalid:false,nodes:0,work:0};
        admissionJob.iterator=prepareAdmissionSteps(admissionJob,api,stepSeed);preparedJobs++;
      }
      const job=admissionJob,work=spendWork(job);preparedWork+=work;maxPreparedWork=Math.max(maxPreparedWork,work);
      if(job.pendingAnchor&&job.pendingAnchor.frame<=simulationFrame){invalidateAdmission(job.pendingAnchor.frame===simulationFrame?'anchor-not-ready':'missed-anchor');return null;}
      if(job.anchor?.frame<simulationFrame){invalidateAdmission('missed-anchor');return null;}
      if(job.anchor?.frame===simulationFrame){
        if(!job.done||!job.result){invalidateAdmission('anchor-not-ready');return null;}
        preparedChecks++;const difference=actualDifference(job.anchor,player,cars,simulationFrame);
        if(difference){invalidateAdmission('prepared-control-physics-mismatch',{difference});return null;}
        if(!job.promised&&!(immediate<.55)){invalidateAdmission('common-trigger-mismatch');return null;}
        const option=job.result.root;option.fromCertificate=job.promised;
        if(job.promised)checkEarlyFreshC(job,option);
        // This already computed normal-ground tail may seed ranking after its
        // own A/B phase. It is never reused as an actual collision certificate,
        // and a three-arc tail cannot skip the still-uncommitted third hop.
        option.rankingTerminal=!job.promised&&job.result.arcCount<=2?job.result.terminal:null;
        if(job.promised){
          option.continuationGeometry=copyState(certifiedNext.successorGeometry);
          if(planJob?.afterCertificate&&!exactDifference(planJob.afterCertificate,certificatePhase(certifiedNext))){option.retainedPlanJob=planJob;planJob.afterCertificate=null;}
          certifiedNext=null;certifiedHandoffs++;
        }else planJob=null;
        admissionJob=null;preparedCommits++;return option;
      }
      if(job.done&&job.result?.deferred){if(!job.deferredCounted){preparedDeferred++;job.deferredCounted=true;}return null;}
      if(job.done&&!job.result){invalidateAdmission('no-complete-selected-path');return null;}
      return null;
    }

    let fuelMode = null, fuelModeChanges = 0;
    function invalidateFuelMode(player) {
      // Fuel is a future-physics dependency. Discard every old proof/iterator,
      // but preserve the currently executing airborne route and real inputs.
      fuelMode = !!player.infiniteJet; fuelModeChanges++; planEpoch++;
      planJob = admissionJob = earlyJob = prefetchJob = pendingEarlySeed = null;
      certifiedNext = lastProjectionApi = stepSeed = prefetchRejectedPhase = null;
      lastLaunchedFromCertificate = false; proposalHints = [];
      charging = false; refillTarget = 0; lastImmediate = Infinity;
      groundReanchorPending = true;
    }
    function reset(x = 2.5) {
      fuelMode = null; fuelModeChanges = 0;
      earlyJob=null;prefetchJob=null;pendingEarlySeed=null;lastProjectionApi=null;lastLaunchedFromCertificate=false;prefetchJobs=prefetchWork=prefetchBindings=prefetchInvalidations=0;lastPrefetchFailure=lastPrefetchBinding=null;prefetchRejectedPhase=null;earlyJobs=earlyWork=earlyChecks=earlyInvalidations=earlyLandings=earlyFreshCChecks=0;lastEarlyFailure=lastEarlyPromotion=null;
      renderWorkRemaining=null;renderStartedAt=renderDeadline=null;renderTimeLimitHits=maxRenderElapsedAtPlannerExitMs=0;admissionJob=null;stepSeed=null;simulationFrame=-1;lastFrameAirborne=false;groundReanchorPending=false;certificateSerial=0;
      sourceStartChecks=sourceAnchorChecks=sourceInvalidations=cachedSourceCommits=0;lastSourceFailure=null;
      groundReanchors=groundWindows=groundWindowFailures=groundWindowWork=0;lastGroundReanchor=null;
      preparedJobs=preparedWork=preparedChecks=preparedStartChecks=preparedInvalidations=preparedNoReady=maxPreparedWork=preparedCommits=preparedDeferred=0;lastPreparedFailure=null;
      target = nearest(x, lanes); changing = false; dwell = 0.2; jumpCooldown = 0; charging = false; refillTarget = 0;
      completed = started = jumps = multiLane = maxLaneSpan = 0; landingLane = null; decisionCooldown = 0;
      certifiedNext=null;certifiedHandoffs=invalidatedCertificates=releasedCertificates=backupHops=0;
      finiteSearches=finiteNodes=finiteYields=finiteCapped=finiteGoals=finiteMemoHits=continuationProofs=continuedCertificates=0;
      freshValidations=maxFreshValidations=elapsed=0;proposalHints=[];planJob=null;lastImmediate=Infinity;backgroundSearches=backgroundWork=backgroundFrames=maxBackgroundWork=expiredPlans=emptyPlans=0;lastPlanMismatch=null;expiryReasons={};planEpoch++;
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
      if(!o.car.laneChange && !(o.car.blastTimer>0) && !o.car.recoverHighwayLane && !Object.is(o.x,-0))return o.x+0*t;
      o.futureX ||= new Map();
      if (!o.futureX.has(t)) o.futureX.set(t,rawCarX(o,t));
      return o.futureX.get(t);
    }
    function travel(speed, acceleration, limit, t) {
      const untilLimit = acceleration > 0 ? Math.max(0, limit - speed) / acceleration : t;
      const a = Math.min(t, untilLimit);
      return speed * a + 0.5 * acceleration * a * a + Math.max(speed, limit) * Math.max(0, t - a);
    }
    // Zero-attitude-input demo prediction. The actual physics keeps its own
    // unchanged manual/RCS path; these are the same passive springs and bank
    // assist that affect a paid demo strafe and the following ground phase.
    function advanceDemoAttitude(p,h,airborne,landingSave=false){
      const wrap=rad=>((rad+Math.PI)%(Math.PI*2)+(Math.PI*2))%(Math.PI*2)-Math.PI;
      const idle=p.attitudeIdleSeconds||0,stabilizer=airborne&&p.autoStabilizer?Math.min(h,Math.max(0,idle+h-2)):0;
      p.attitudeIdleSeconds=airborne?Math.min(2,idle+h):0;
      p.roll=p.roll||0;p.pitch=p.pitch||0;p.vRoll=p.vRoll||0;p.vPitch=p.vPitch||0;p.vYaw=p.vYaw||0;
      if(landingSave&&stabilizer>0){const blend=1-Math.exp(-10*stabilizer);p.roll-=wrap(p.roll)*blend;p.pitch-=wrap(p.pitch)*blend;p.vRoll*=Math.pow(.2,stabilizer);p.vPitch*=Math.pow(.2,stabilizer);}
      p.roll=wrap(p.roll);
      if(!airborne){const lean=clamp(Math.abs(p.speed)/22,0,1),goal=-(p.steerInput||0)*.048*lean+(p.lateralG||0)*.012;p.roll+=(goal-p.roll)*11*h;p.vRoll=0;}
      else if(stabilizer>0){const predicted=wrap(p.roll+p.vRoll*.28);p.vRoll+=(-predicted*7.8-p.vRoll*4.5)*stabilizer;}
      if(stabilizer>0||!airborne)p.vPitch+=(-wrap(p.pitch)*6.5-p.vPitch*4.2)*(airborne?stabilizer:h);
      if(airborne)p.vYaw*=Math.pow(.06,h);
      p.vRoll*=Math.pow(.2,h);p.vPitch*=Math.pow(.2,h);p.vYaw*=Math.pow(.25,h);
      p.roll=wrap(p.roll+p.vRoll*h);
      if((stabilizer>0||!airborne)&&Math.abs(p.speed)>28){const aero=Math.min(3.5,Math.pow(Math.abs(p.speed)/35,2))*.45;p.vPitch+=(-wrap(p.pitch)*aero)*(airborne?stabilizer:h);}
      p.pitch+=p.vPitch*h;p.yaw+=p.vYaw*h;
      if(p.y<.35){const blend=clamp(p.y/.35,0,1),pitchLimit=(1-blend)*.14+blend*1.30,rollLimit=(1-blend)*.18+blend*3.14,groundPitch=wrap(p.pitch);p.pitch+=clamp(groundPitch,-pitchLimit,pitchLimit)-groundPitch;p.roll=clamp(p.roll,-rollLimit,rollLimit);if(p.y<.15){const groundYaw=wrap(p.yaw);p.yaw+=clamp(groundYaw,-.85,.85)-groundYaw;}}
      const lateral=airborne?Math.sin(p.roll)*18+p.vYaw*12:(p.steerInput||0)*.38*Math.abs(p.speed)*.85;
      p.lateralG=(1-10*h)*(p.lateralG||0)+(10*h)*(lateral/9.81);
    }
    const hopProfiles=new Map();
    function entryAirFor(p, height, frameDt) {
      return p.infiniteJet ? 0 : Math.max(3.6, hopProfile(height, p.physicsMode === 'realistic', frameDt).cost + 2.2);
    }
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
        y=Math.max(0,y);points.push({t,y,landing});
        if(y===0&&!rising){profile.duration=t;break;}
      }
      hopProfiles.set(key,profile);return profile;
    }
    // Air-origin search results remain geometry hints. An actual-ground
    // source may reuse its proof only after every intervening dependency
    // checkpoint and its immutable prepared launch phase match exactly.
    function finishFiniteJob(job){
      if(!job.result)return;
      const goal=job.result;job.readyGoal=goal;
      if(job.strictSource&&!job.sourceInvalid){
        for(const checkpoint of goal.launchCheckpoints){const full={...checkpoint,frame:job.candidateLaunchFrame+checkpoint.frame};job.sourceCheckpoints.set(full.frame,full);}
        const frame=job.candidateLaunchFrame+goal.launchFrames;job.sourceAnchor=projectedCheckpoint(goal.launchState,goal.launchCars,frame,true);
      }
    }
    function advancePlanJob(allowSpeculative=false){
      // Promised current B/C admission always owns the earlier physical ticks.
      // Only a real-ground source may need inline next-tick prefix snapshots;
      // speculative/ranking/continuation work runs once after all actual ticks.
      if(!allowSpeculative&&(!planJob?.strictSource||planJob.sourceInvalid||lastFrameAirborne||certifiedNext))return;
      if((earlyJob||prefetchJob)&&planJob?.kind!=='continuation')return;
      if(!planJob||planJob.done||planJob.readyGoal)return;
      const work=spendWork(planJob);finiteYields+=work;
      if(planJob.done){
        if(planJob.kind==='continuation'){
          const finished=planJob;planJob=finished.result?finished.promote(finished.result,finished.age):null;
          if(!finished.result)emptyPlans++;
        }else if(planJob.result){
          finishFiniteJob(planJob);
        }else{planJob=null;emptyPlans++;}
      }
    }
    function step(player, cars, dt) {
      const initialRenderBudget=renderWorkRemaining,initialRenderStart=renderStartedAt,initialRenderDeadline=renderDeadline;
      if (target === null) reset(player.x);
      if (fuelMode === null) fuelMode = !!player.infiniteJet;
      else if (fuelMode !== !!player.infiniteJet) invalidateFuelMode(player);
      renderWorkRemaining=initialRenderBudget;renderStartedAt=initialRenderStart;renderDeadline=initialRenderDeadline;
      // Public direct-step callers own one render. The browser clock calls
      // beginRender once for up to three ticks; neither path grants each job
      // its own fallback allowance.
      const standalone=renderWorkRemaining===null;if(standalone)beginRender();
      try {
      beforeControlStep(player,cars,dt);
      let frameValidations=0;elapsed+=dt;proposalHints=proposalHints.filter(hint=>elapsed-hint.createdAt<=2);
      jumpCooldown = Math.max(0, jumpCooldown - dt);if(jumpCooldown<1e-7)jumpCooldown=0;
      decisionCooldown = Math.max(0, decisionCooldown - dt);if(decisionCooldown<1e-7)decisionCooldown=0;
      if(certifiedNext&&(player.physicsMode!==certifiedNext.physicsMode||!!player.insaneMode!==certifiedNext.insaneMode||!!player.infiniteJet!==!!certifiedNext.infiniteJet)){certifiedNext=null;invalidatedCertificates++;}
      if(planJob&&(player.physicsMode!==planJob.physicsMode||!!player.insaneMode!==planJob.insaneMode||!!player.infiniteJet!==!!planJob.infiniteJet))planJob=null;
      const grounded = player.y <= 0.005 && Math.abs(player.vy || 0) < 0.01 && !player.isJumping6m;
      const bridgeSource=earlyJob?.source||prefetchJob?.source;if(bridgeSource&&planJob!==bridgeSource){bridgeSource.age+=dt;bridgeSource.untilStart-=dt;}
      if(planJob){planJob.age+=dt;planJob.untilStart-=dt;if(planJob.epoch!==planEpoch||planJob.dt!==dt||planJob.age>8||planJob.identities.length!==cars.length||planJob.identities.some((car,i)=>car!==cars[i])){planJob=null;expiredPlans++;}}
      const input = neutral(), airborne = !grounded;
      const live = obstacles(cars, dt);checkPrefetchDomain(player,cars,dt);
      // A short, paid side correction may select a clear landing lane. There
      // is no forward/lift/hover request in the air. This also escapes the
      // ordinary car-roof rebound instead of hovering over a stopped NPC.
      if (airborne) {
        advancePlanJob();maybeStartEarly(player,cars,dt);
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
        if (landingLane === null && room(target) < 18) {
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
      const cruiseLimit = player.physicsMode !== 'realistic' ? 160 : 370 / 3.6;
      if (player.airRemaining < 4.3) charging = true;
      if (player.airRemaining >= 7.0) charging = false;
      if (player.airRemaining>=refillTarget) refillTarget=0;
      // Recharge hysteresis must not strand usable paid ground boost below
      // the floor plus finite-hop coast headroom. This never powers flight.
      const boostFor = (v, gas, recharging, freefall=player.isFreefalling,seconds=dt,requiredAir=refillTarget) => refillBoost(v,gas,seconds,freefall)||(!recharging || v<220/3.6+2) && gas > 4.3 && !freefall
        && !(gas<requiredAir && v>220/3.6+1);
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
      function frontLeader(x,lane,time=0,metres=0,observations=live) {
        let result=null,nearestGap=Infinity;
        for (const o of observations) {
          const cx=carX(o,time);
          if(Math.abs(cx-x)>=2.6 && Math.abs(cx-lanes[lane])>=2.6)continue;
          const z=relativeZ(o,time,metres);if(z>=0)continue;
          if (-z<nearestGap) { nearestGap=-z; result=o; }
        }
        return result;
      }
      const speedFloor = 220 / 3.6;
      // A refill frame normally uses W and recharges. If its real EV overrun
      // would cross the floor, pay for ONE ground-only jet frame instead.
      // The complete candidate accounts for both its .85/s burn and the lost
      // 3.4/s recharge, so maintaining speed never borrows fictitious gas.
      function refillBoost(v,gas,seconds,freefall=player.isFreefalling,state=player){
        return state.physicsMode==='realistic'&&!state.insaneMode&&!freefall&&v>=speedFloor
          &&gas-.85*seconds>=2.1&&v-(.00012*v*v+.35)*1.3*seconds<speedFloor;
      }
      // Paid H includes mechanical braking and the speed-dependent shared-gas
      // retro impulse. Bound the combined result, including a long frame, before
      // requesting any brake. No speed or gas state is assigned by the driver.
      function brakeResult(v, gas, brake, seconds, freefall) {
        const blend = clamp((v - 200 / 3.6) / (40 / 3.6), 0, 1);
        const demand = blend * blend * (3 - 2 * blend) * brake;
        const paid = freefall ? 0 : player.infiniteJet ? 0.55 * demand * seconds : Math.min(gas, 0.55 * demand * seconds);
        const mass = 1850 + Number((gas * 14.4).toFixed(1));
        return { speed: Math.max(0, v - 38 * brake * seconds - 80000 / mass * paid / 0.55), paid };
      }
      function controlsFor(v,gas,recharging,leader=null,time=0,ownMetres=0,freefall=player.isFreefalling,seconds=dt,requiredAir=refillTarget) {
        const cruise = { throttle: 1, brake: 0, boost: boostFor(v,gas,recharging,freefall,seconds,requiredAir) ? 1 : 0, jumpNeeded: false };
        if (!leader) return cruise;
        const gap = Math.max(0,-relativeZ(leader,time,ownMetres)-leader.halfLength-0.3);
        const leadSpeed=Math.max(0,leader.speed+Math.min(0,leader.acceleration)*(time+0.3));
        const desiredGap=0.6+v*scale*0.005+Math.max(0,v-leadSpeed)*scale*0.02;
        const followingSpeed=leadSpeed+(gap-desiredGap)/(scale*0.30);
        const stoppingEnvelope=Math.sqrt(leadSpeed*leadSpeed+2*32*gap/scale);
        const requested=clamp(Math.min(followingSpeed,stoppingEnvelope),0,cruiseLimit);
        // A slow queue is a routing/hop request, never permission to follow it
        // below 220. From rest we still accelerate using ordinary propulsion.
        if (requested < speedFloor + 0.5) return { ...cruise, boost: v < speedFloor ? cruise.boost : refillBoost(v,gas,seconds,freefall) ? 1 : 0, jumpNeeded: true };
        if (v>requested+0.3) {
          let brake=clamp((v-requested)/8,0,1);
          if (brakeResult(v,gas,brake,seconds,freefall).speed < speedFloor) {
            let lo=0,hi=brake;
            for (let i=0;i<24;i++) { const mid=(lo+hi)/2; if (brakeResult(v,gas,mid,seconds,freefall).speed>=speedFloor) lo=mid; else hi=mid; }
            brake=lo;
          }
          if (brake>0) return { throttle:0,boost:0,brake,jumpNeeded:false };
        }
        // Clear road: keep the requested jet lit even at the physical limiter.
        // A finite following envelope feathers continuously instead of a full
        // on/off switch around a speed threshold. The exact same command is
        // used by live control and every ground trajectory projection.
        if (requested < cruiseLimit - 1e-6) cruise.boost *= clamp((requested - v) / 4, 0, 1);
        // The established 220 floor still needs its real paid protection pulse.
        if (!cruise.boost && refillBoost(v,gas,seconds,freefall)) cruise.boost = 1;
        return cruise;
      }
      // One trajectory for first-gap validation, route ranking and the urgent
      // collision test. Integrate the real rack/yaw/lateral response rather
      // than drawing three mutually inconsistent eased/straight paths.
      function trajectory(route, horizon, useFollowing=true, state=player, observations=live, chargingState=charging,requiredAir=refillTarget) {
        const p = { x: state.x, vx: state.vx || 0, yaw: state.yaw || 0, steer: state.steerInput || 0,
          speed: Math.max(0, state.speed || 0), gas: state.airRemaining, freefall: state.isFreefalling, charging:chargingState, metres: 0 };
        const points = [{ t: 0, x: p.x, metres: 0 }];
        let firstArrival = null;
        const h = 0.025, lane = route[route.length-1]; let settled = 0;
        for (let t = h; t <= horizon + 1e-6; t += h) {
          settled = Math.abs(p.x-lanes[lane]) < 0.32 && Math.abs(p.vx) < 1.3 ? settled+h : 0;
          if (settled >= 0.08 && firstArrival === null) firstArrival = t;
          if (p.gas < 4.3) p.charging = true;
          if (p.gas >= 7) p.charging = false;
          const leader=useFollowing ? frontLeader(p.x,lane,t-h,p.metres,observations) : null;
          const controls=controlsFor(p.speed,p.gas,p.charging,leader,t-h,p.metres,p.freefall,h,requiredAir);
          const boost = controls.boost > 0;
          const command = steeringFor(p.x,p.vx,p.speed,lane,boost);
          p.steer += (command-p.steer)*(1-Math.exp(-handling.rackRate*h));
          const nx = -Math.sin(p.yaw), nz = -Math.cos(p.yaw);
          const realistic = state.physicsMode === 'realistic';
          const standard = realistic && !state.insaneMode && !boost;
          const maximum = realistic ? (standard ? 200/3.6 : 370/3.6) : 160;
          const electric = realistic && !state.insaneMode && p.speed >= 200/3.6 ? 0 : realistic ? (state.insaneMode ? 38 : 16.5) : 72;
          const mass=1850+Number((p.gas*14.4).toFixed(1));
          const jet = (realistic ? 38 : 120) * 1994 / mass;
          const braking=brakeResult(p.speed,p.gas,controls.brake,h,p.freefall);
          const paidRetro=braking.paid;
          if (paidRetro>0) p.speed=Math.max(0,p.speed-80000/mass*(paidRetro/0.55));
          if (controls.throttle>0 || boost) {
            if (standard && p.speed > maximum) p.speed = Math.max(maximum,p.speed-(0.00012*p.speed*p.speed+0.35)*1.3*h);
            else p.speed = Math.min(maximum,p.speed+Math.max(electric*controls.throttle,boost ? jet*controls.boost : 0)*h);
          } else if (controls.brake>0) p.speed=Math.max(0,p.speed-38*controls.brake*h);
          else p.speed=Math.max(0,p.speed-(0.00012*p.speed*p.speed+0.35)*(standard&&p.speed>maximum?1.3:1)*h);
          const factor=clamp(p.speed/14,0,1.25);
          const targetVx=p.steer*handling.lateralSpeed*clamp(p.speed/18,0,1);
          const targetYaw=-Math.atan2(targetVx,Math.max(12,p.speed));
          p.yaw += (targetYaw-p.yaw)*(1-Math.exp(-handling.yawRate*h));
          p.vx += (targetVx-p.vx)*(1-Math.exp(-handling.lateralRate*h));
          p.x += p.vx*h; p.metres += -nz*p.speed*h;
          p.gas=state.infiniteJet?10:clamp(p.gas+(boost ? -0.85*controls.boost*h : paidRetro>0 ? -paidRetro : 3.4*h),0,10);
          if (p.gas<=0.001) p.freefall=true;
          if (p.gas>=2.5 && !boost) p.freefall=false;
          points.push({t,x:p.x,metres:p.metres,speed:p.speed});
        }
        points.arrival = firstArrival;
        return points;
      }
      function collisionTime(path, margin=0.35, lateral=2.03, uncertainty=0.12, observations=live) {
        let minX=Infinity,maxX=-Infinity;for(const point of path){minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);}
        let first=Infinity;
        for (const o of observations) {
          if(!o.car.laneChange && !(o.car.blastTimer>0) && !o.car.recoverHighwayLane && (o.x<minX-lateral || o.x>maxX+lateral))continue;
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
      const immediateFor=(state,observations,chargingState,path=null)=>collisionTime(path||trajectory([target],.85,true,state,observations,chargingState),.3,2.0,.1,observations);
      // Pure routing state machine shared by the actual ground driver and
      // its future-ground projection. It neither mutates vehicle/NPC state nor
      // turns a speculative jump into collision authority.
      function* groundDecisionSteps(state,observations,route,seconds){
        let lane=route.target,merging=route.changing,settled=route.dwell,cooldown=route.decisionCooldown;
        let certificate=route.certificate,startedDelta=0,completedDelta=0,multiDelta=0,maxSpan=0,released=false;
        const v=Math.max(0,-state.vz,state.speed||0),paths=new Map(),horizon=2.4;
        const pathFor=next=>{if(!paths.has(next))paths.set(next,trajectory([next],horizon,true,state,observations,route.charging,route.refillTarget??refillTarget));return paths.get(next);};
        function* contact(path,margin=.35){
          let minX=Infinity,maxX=-Infinity;for(const point of path){minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);}
          let first=Infinity,work=0;
          for(const obstacle of observations){
            if(!(!obstacle.car.laneChange && !(obstacle.car.blastTimer>0) && !obstacle.car.recoverHighwayLane && (obstacle.x<minX-2.03 || obstacle.x>maxX+2.03))){
            let prior=path[0];
            for(const point of path){
              if(prior.t>=first)break;
              const hit=sweptContact(carX(obstacle,prior.t)-prior.x,relativeZ(obstacle,prior.t,prior.metres),carX(obstacle,point.t)-point.x,relativeZ(obstacle,point.t,point.metres),2.03,obstacle.halfLength+margin+point.t*.12);
              if(hit!==null){first=Math.min(first,prior.t+(point.t-prior.t)*hit);break;}
              prior=point;
            }
            // Work units now count actual swept paths; a proven bbox miss
            // performs no sweep and no longer spends an empty work quantum.
            // Every integrated player/NPC frame still yields independently.
            if(++work%4===0)yield null;
            }
          }
          return first;
        }
        function* safePath(next){const path=pathFor(next);return path.arrival!==null&&path.arrival+.25<=horizon&&(yield* contact(path))>path.arrival+.25;}
        const error=lanes[lane]-state.x;
        if(Math.abs(error)<.32&&Math.abs(state.vx)<1.3){settled+=seconds;if(merging&&settled>=.08){merging=false;completedDelta++;}}
        else settled=0;
        const result=()=>({target:lane,changing:merging,dwell:settled,decisionCooldown:cooldown,startedDelta,completedDelta,multiDelta,maxSpan,released,paths,pathFor});
        if(route.jumpCooldown>0)return {...result(),drive:null,currentThreat:Infinity,committedThreat:Infinity};
        const currentThreat=observations.length&&cooldown===0?(yield* contact(trajectory([lane],1.6,false,state,observations,route.charging,route.refillTarget??refillTarget),.6)):Infinity;
        let drive=controlsFor(v,state.airRemaining,route.charging,frontLeader(state.x,lane,0,0,observations),0,0,state.isFreefalling,seconds,route.refillTarget??refillTarget);
        const committedThreat=observations.length&&(cooldown===0||certificate)?(yield* contact(pathFor(lane))):Infinity;
        if(certificate&&(yield* safePath(lane))&&committedThreat>horizon&&pathFor(lane).slice(1).every(point=>point.speed>=speedFloor)){released=true;certificate=false;}
        if(cooldown===0&&!certificate&&(currentThreat<1.35||drive.jumpNeeded||committedThreat<.8)){
          cooldown=.10;const direction=merging?Math.sign(error):0;
          const options=[];
          for(let next=0;next<lanes.length;next++)if(next!==lane&&(!merging||Math.sign(lanes[next]-state.x)===direction)&&(yield* safePath(next))){
            const path=pathFor(next);options.push({lane:next,flow:path.at(-1).metres,distance:Math.abs(lanes[next]-state.x)});
          }
          options.sort((a,b)=>(b.flow-a.flow)*.08+(a.distance-b.distance)||Math.abs(a.lane-2.5)-Math.abs(b.lane-2.5));
          if(options.length&&(!merging||committedThreat<.8)){
            const span=Math.abs(options[0].lane-nearest(state.x,lanes));lane=options[0].lane;
            if(!merging)startedDelta++;if(span>1)multiDelta++;maxSpan=span;merging=true;settled=0;
            drive=controlsFor(v,state.airRemaining,route.charging,frontLeader(state.x,lane,0,0,observations),0,0,state.isFreefalling,seconds,route.refillTarget??refillTarget);
          }
        }
        return {...result(),drive,currentThreat,committedThreat};
      }
      function groundDecision(...args){const iterator=groundDecisionSteps(...args);let result;do{result=iterator.next();}while(!result.done);return result.value;}
      const ground=groundDecision(player,live,{target,changing,dwell,decisionCooldown,jumpCooldown,charging,certificate:!!certifiedNext},dt);
      target=ground.target;changing=ground.changing;dwell=ground.dwell;decisionCooldown=ground.decisionCooldown;
      started+=ground.startedDelta;completed+=ground.completedDelta;multiLane+=ground.multiDelta;maxLaneSpan=Math.max(maxLaneSpan,ground.maxSpan);

      if(ground.released){invalidatePrefetch('certificate-released');if(certifiedNext.fromHandoff||planJob?.afterCertificate)planJob=null;certifiedNext=null;releasedCertificates++;}
      const {paths,pathFor,currentThreat,committedThreat}=ground;
      let drive=ground.drive||{throttle:1,boost:refillBoost(speed,player.airRemaining,dt)?1:0,brake:0};
      const immediate=live.length ? immediateFor(player,live,charging,paths.has(target)?pathFor(target).filter(point=>point.t<=.85+1e-6):null) : Infinity;
      // Launch early enough to clear the body, late enough to land beyond it.
      // Slow requested following below the floor escalates to the same paid
      // tactical hop. Empty/low/freefall tanks cannot invent a jump or fuel.
      lastImmediate=immediate;let plannedHop=null,validatedLaunchThisFrame=false;
      {
        // Plan launch -> full paid arc -> touchdown -> next-launch preparation
        // as one maneuver. A clear point at touchdown is insufficient when a
        // second car occupies the next-launch preparation window immediately
        // afterward. Prefer the lowest complete arc; never extend it in air.
        const minimum=Math.max(2.3,...live.filter(o=>Math.abs(o.z)<60).map(o=>o.height+.8));
        const heights=[minimum,3.2,4.5,6,7.5,10].filter((height,i,a)=>height>=minimum&&a.indexOf(height)===i);
        // Pure player path. NPC evolution can only reject this path; it never
        // changes its motion, paid gas or exact refill/handoff clock.
        function playerMotion(start,profile,lane,prepare,nextRequiredAir=3.6){
          const steps=[],h=profile.dt;
          let x=start.x,vx=start.vx||0,vz=start.vz||0,metres=0,paidSide=0,ok=true;
          let fastestMetres=0,groundSpeed=null,yaw=start.yaw||0,steer=start.steerInput||0,groundSeconds=0,boostedGroundSeconds=0,groundGasBefore=start.airRemaining,priorY=0,touchdownCredit=0,minSpeed=Infinity;
          const startLane=start.demoTarget??target;
          let groundDwell=lane===startLane?(start.demoDwell??dwell):0,groundChanging=lane!==startLane||!!(start.demoChanging??changing),groundCharging=start.demoCharging??charging;
          const attitude={yaw,roll:start.roll||0,pitch:start.pitch||0,vRoll:start.vRoll||0,vPitch:start.vPitch||0,vYaw:start.vYaw||0,autoStabilizer:start.autoStabilizer,attitudeIdleSeconds:start.attitudeIdleSeconds||0,lateralG:start.lateralG||0};
          const climb=start.physicsMode==='realistic'?20.15:117;
          const clearHeight=Math.max(...live.map(o=>o.height+.2),1.45),riseTime=Math.ceil(clearHeight/(climb*h))*h,requiredNextAir=start.infiniteJet?0:Math.max(3.6,nextRequiredAir);
          let groundWait=Math.ceil(.12/h)*h,preparation=Math.ceil(.30/h)*h,handoff=null,finish=profile.duration+(prepare?preparation:0);
          function groundCoast(value){
            let magnitude=Math.abs(value);if(magnitude<=.1)return 0;let remainder=h;
            if(start.physicsMode==='realistic'&&!start.insaneMode&&magnitude>200/3.6){const decel=(.00012*magnitude*magnitude+.35)*1.3,above=Math.min(remainder,(magnitude-200/3.6)/decel);magnitude=Math.max(200/3.6,magnitude-decel*above);remainder-=above;}
            magnitude=Math.max(0,magnitude-(.00012*magnitude*magnitude+.35)*remainder);return Math.sign(value)*magnitude;
          }
          for(let t=h;t<=finish+1e-6;t+=h){
            const airbornePhase=t<=profile.duration+1e-6,sample=t/h,index=Math.min(profile.points.length-1,Math.floor(sample)),a=profile.points[index],b=profile.points[Math.min(index+1,profile.points.length-1)];
            const rawY=airbornePhase?a.y+(b.y-a.y)*(sample-index):0,y=Math.abs(rawY)<1e-9?0:rawY;
            // The real launch frame is neutral. Later air commands are sampled
            // before drag; the physics horizontal mode already becomes ground
            // at <=.15m on descent, while the demo still requests air-neutral.
            const physicsAirborne=airbornePhase&&(priorY>.15||t<=h+1e-8);
            if(physicsAirborne){
              const c=Math.cos(yaw),sin=Math.sin(yaw);
              const err=lanes[lane]-x,desired=clamp(err*5-vx*.65,-8.5,8.5);
              const command=t<=h+1e-8?0:Math.abs(err)>.24||Math.abs(vx)>.7?clamp((desired*c-vz*sin)/18,-.8,.8):0;
              steer+=(0-steer)*Math.min(1,11*h);if(Math.abs(steer)<.004)steer=0;
              const magnitude=Math.hypot(vx,vz),coast=magnitude>0?(magnitude/(1+.00012*magnitude*h))/magnitude:0;vx*=coast;vz*=coast;
              if(command){const delta=(command*18+Math.sin(attitude.roll)*10-(vx*c-vz*sin))*(1-Math.exp(-6.5*h));vx+=c*delta;vz-=sin*delta;paidSide+=.45*Math.abs(command)*h;}
            }else{
              if(groundSpeed===null)groundSpeed=Math.hypot(vx,vz);
              const oldYaw=yaw,groundedPlanner=!airbornePhase;
              let command=0,boost=false;
              if(groundedPlanner){
                const beforeGas=start.infiniteJet?10:start.airRemaining-profile.cost-paidSide+touchdownCredit+3.4*groundSeconds-4.25*boostedGroundSeconds;groundGasBefore=beforeGas;
                if(beforeGas<4.3)groundCharging=true;if(beforeGas>=7)groundCharging=false;
                if(Math.abs(x-lanes[lane])<.32&&Math.abs(vx)<1.3){groundDwell+=h;if(groundChanging&&groundDwell>=.08)groundChanging=false;}else groundDwell=0;
                boost=refillBoost(groundSpeed,beforeGas,h,start.isFreefalling,start);
                command=steeringFor(x,vx,groundSpeed,lane,boost);groundSeconds+=h;if(boost)boostedGroundSeconds+=h;
              }
              steer+=(command-steer)*(1-Math.exp(-handling.rackRate*h));if(Math.abs(steer)<.004&&command===0)steer=0;
              // Air-neutral low-altitude frames coast. The admitted real ground
              // wait uses W, with one paid floor-protecting ground pulse when needed.
              if(!groundedPlanner)groundSpeed=groundCoast(groundSpeed);
              else if(boost){const mass=1850+Number((144*(groundGasBefore/10)).toFixed(1));groundSpeed=Math.min(370/3.6,groundSpeed+38*(1994/mass)*h);}
              else if(start.physicsMode==='realistic'&&!start.insaneMode&&groundSpeed>200/3.6)groundSpeed=Math.max(200/3.6,groundCoast(groundSpeed));
              else groundSpeed=Math.min(start.physicsMode==='realistic'?(start.insaneMode?370/3.6:200/3.6):160,groundSpeed+(start.physicsMode==='realistic'?(start.insaneMode?38:16.5):72)*h);
              const desired=steer*handling.lateralSpeed*clamp(groundSpeed/18,0,1),targetYaw=-Math.atan2(desired,Math.max(12,groundSpeed));
              const yawError=((targetYaw-yaw+Math.PI)%(Math.PI*2)+(Math.PI*2))%(Math.PI*2)-Math.PI;
              yaw+=yawError*(1-Math.exp(-handling.yawRate*h));vx+=(desired-vx)*(1-Math.exp(-handling.lateralRate*h));vz=-Math.cos(oldYaw)*groundSpeed;
            }
            minSpeed=Math.min(minSpeed,physicsAirborne?Math.hypot(vx,vz):groundSpeed);
            x+=vx*h;metres+=-vz*h;
            Object.assign(attitude,{yaw,y,steerInput:steer,speed:physicsAirborne?Math.hypot(vx,vz):groundSpeed});advanceDemoAttitude(attitude,h,physicsAirborne,!!profile.points[Math.min(profile.points.length-1,Math.round(sample))].landing);yaw=attitude.yaw;
            if(airbornePhase&&y===0)touchdownCredit=3.4*h;
            if(!handoff){const rechargeTime=start.infiniteJet?0:Math.max(0,requiredNextAir-(start.airRemaining-profile.cost-paidSide+touchdownCredit-4.25*boostedGroundSeconds))/3.4;
            groundWait=Math.ceil(Math.max(.12,rechargeTime)/h-1e-8)*h;preparation=Math.ceil(Math.max(.30,groundWait+riseTime+3*h)/h-1e-8)*h;finish=profile.duration+(prepare?preparation:0);}
            // Until the committed ground wait ends, the real driver owns only
            // W + the paid floor pulse above. Afterwards bound free acceleration
            // from the handoff speed; a370 limit is not an instant370 velocity.
            const freeGroundSeconds=Math.max(0,t-profile.duration-groundWait);
            const handoffSpeed=handoff?.groundSpeed??groundSpeed??Math.hypot(vx,vz);
            const physicalLimit=start.physicsMode==='realistic'?370/3.6:160;
            const maximumForward=Math.max(handoffSpeed,Math.min(physicalLimit,handoffSpeed+(start.physicsMode==='realistic'?38:120)*1994/1850*(freeGroundSeconds+dt)));
            fastestMetres=freeGroundSeconds<=1e-8?metres:fastestMetres+Math.max(-vz,maximumForward)*h;
            const point={t,x,metres,fastestMetres,y};if(Math.abs(x)>13.65){ok=false;break;}
            const motionIndex=steps.length;steps.push({point,vx,vz});
            if(!handoff&&t>=profile.duration+groundWait-1e-6){const remaining=start.infiniteJet?10:clamp(start.airRemaining-profile.cost-paidSide+touchdownCredit+3.4*groundSeconds-4.25*boostedGroundSeconds,0,10);handoff={index:motionIndex,remaining,gasBefore:groundGasBefore,x,vx,vz,groundSpeed,groundYaw:yaw,groundSteer:steer,groundDwell,groundChanging,groundCharging,attitude:{...attitude}};}
            priorY=y;
          }
          const valid=!(!ok||!handoff||minSpeed<speedFloor||Math.abs(x-lanes[lane])>=.6||(!start.infiniteJet&&start.airRemaining<profile.cost+paidSide+2.1));
          return {steps,h,handoff,valid,minSpeed,cost:start.infiniteJet?0:profile.cost+paidSide+.85*boostedGroundSeconds,requiredNextAir,groundWait,preparation};
        }
        function* candidateSteps(start,sourceCars,height,lane,prepare,failure=null,nextRequiredAir=3.6){
          const profile=hopProfile(height,start.physicsMode==='realistic',dt);
          if(!(profile.duration>0)||profile.duration+.18>2.4)return null;
          if(start.isDestroyed||start.isFreefalling||start.isAltitudeHold||(!start.infiniteJet&&start.airRemaining<entryAirFor(start,height,dt))||Math.abs(lanes[lane]-start.x)>8.5*profile.duration+1)return null;
          const motion=playerMotion(start,profile,lane,prepare,nextRequiredAir);
          // A requested retry hint is observable: an earlier collision can
          // still suggest a later takeoff even if this path cannot center.
          // Preserve that NPC/sweep path when failure evidence was requested.
          if(motion.minSpeed<speedFloor||!motion.valid&&!failure)return null;
          const h=motion.h;
          let prior={t:0,x:start.x,y:0,metres:0,fastestMetres:0},ok=true,handoff=null;
            // Long landing/refill windows must not freeze a driver's current
            // braking acceleration for several seconds. Advance the ordinary
            // traffic controller on isolated snapshots for this candidate.
            // Reservations, reactions and respawns remain real; no live car or
            // rendering object is handed to the speculative controller.
            const forecast=sourceCars.map(car=>({...car,laneChange:car.laneChange?{...car.laneChange}:null,
              mesh:{position:{...car.mesh.position},rotation:{...car.mesh.rotation},visible:car.mesh.visible}}));
            for(let index=0;index<motion.steps.length;index++){
              const sample=motion.steps[index],point=sample.point;
              const {t,x,metres,fastestMetres}=point,{vx,vz}=sample;
              const beforeTraffic=forecast.map(car=>({x:car.mesh.position.x,z:car.mesh.position.z,y:car.y||0,speed:car.speed,live:car.mode==='highway'&&car.highwayWaitingToSpawn===undefined&&car.mesh.visible!==false}));
              highwayTraffic.forecastStep(forecast,{x,y:point.y,z:0,vx,vz},h,lanes,scale);
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
                if(sweptContact(mix(x0,x1,lo),mix(z0,z1,lo),mix(x0,x1,hi),mix(z0,z1,hi),2.1,halfLength+.65+t*.15+Math.max(prior.fastestMetres-prior.metres,fastestMetres-metres)*scale)!==null){
                  // A descending arc can be blocked by a car which will have
                  // completely passed at a slightly later paid takeoff. Offer
                  // one kinematic time hint, never a safety exemption: both the
                  // ground wait and the shifted full arc must still be swept.
                  const closing=(-vz-car.speed)*scale;
                  if(failure&&t>profile.duration*.5&&closing>1){
                    const delay=(halfLength+.65+t*.15-z1)/closing+3*h;
                    if(delay>0&&delay<=.3)failure.retryDelay=Math.ceil(delay/h)*h;
                  }
                  ok=false;break;
                }
              }
              if(!ok)break;
              if(!handoff&&motion.handoff&&index===motion.handoff.index){
                const {remaining,x,vx,vz,groundSpeed,groundYaw,groundSteer,groundDwell,groundChanging,groundCharging}=motion.handoff;
                // Capture the actual next-launch phase NOW. The later rise/
                // frame-buffer validation must not advance this saved state
                // or mutate its independent NPC reservations/relative poses.
                handoff={state:{...copyState(start),x,y:0,z:0,vx,vy:0,vz,speed:groundSpeed??Math.hypot(vx,vz),yaw:groundYaw,steerInput:groundSteer,
                  airRemaining:remaining,airUsedContinuous:10-remaining,gasMassKg:Number((144*(motion.handoff.gasBefore/10)).toFixed(1)),
                  ...motion.handoff.attitude,jumpTargetY:height,jumpStartY:0,steerAngle:-groundSteer*.38,
                  isJumping6m:false,isAltitudeHold:false,isAutoLandingSave:false,wasAirborne:false,jumpInertiaSeconds:null,jumpInertiaGraceSeconds:null,
                  demoNpcSpeeds:beforeTraffic.map(car=>car.speed),demoTarget:lane,demoLandingLane:null,demoDwell:groundDwell,demoChanging:groundChanging,demoDecisionCooldown:0,demoCharging:groundCharging,demoRoutePrepared:false,
                  demoJumpCooldown:0,demoRefillTarget:remaining>=motion.requiredNextAir?0:motion.requiredNextAir,demoCertificate:false,demoCertificatePhase:null},
                  cars:forecast.map(car=>({...car,laneChange:car.laneChange?{...car.laneChange}:null,
                    mesh:{position:{...car.mesh.position},rotation:{...car.mesh.rotation},visible:car.mesh.visible}}))};
              }
              prior=point;
              yield null;
            }
          if(!ok||!motion.valid||!handoff)return null;
          return {lane,height,duration:profile.duration,cost:motion.cost,minSpeed:motion.minSpeed,requiredNextAir:motion.requiredNextAir,groundWait:motion.groundWait,preparation:motion.preparation,distance:Math.abs(lanes[lane]-start.x),
            forecast:handoff.cars,endpoint:handoff.state};
        }
        function candidate(...args){
          freshValidations++;frameValidations++;maxFreshValidations=Math.max(maxFreshValidations,frameValidations);
          const iterator=candidateSteps(...args);let result;
          do{result=iterator.next();}while(!result.done);
          return result.value;
        }
        function* searchHops(start,sourceCars,withSuccessor=true,job=null){
          const cloneCars=cars=>cars.map(car=>({...car,laneChange:car.laneChange?{...car.laneChange}:null,
            mesh:{position:{...car.mesh.position},rotation:{...car.mesh.rotation},visible:car.mesh.visible}}));
          function* trial(...args){
            const budget=job?.finiteBudget;
            if(budget){if(budget.nodes>=budget.cap){budget.capped=true;finiteCapped++;return null;}budget.nodes++;finiteNodes++;}
            return yield* candidateSteps(...args);
          }
          const order=lanes.map((_,lane)=>lane),delayed=[];
          if(withSuccessor)order.sort((a,b)=>Math.abs(lanes[a]-start.x)-Math.abs(lanes[b]-start.x)||(a===job?.rootHint?.lane?-1:0)-(b===job?.rootHint?.lane?-1:0));
          function* offer(option){
            yield {safeRoot:option};if(option.rejected)return;
            if(!withSuccessor){yield {pairedRoot:option};return;}
            for(const nextHeight of heights)for(let nextLane=0;nextLane<lanes.length;nextLane++){
              yield null;const successor=yield* trial(option.endpoint,option.forecast,nextHeight,nextLane,true);
              if(option.rejected)return;
              if(successor){option.successor=successor;yield {pairedRoot:option};return;}
            }
          }
          function* waitForLaunch(state,cars,requiredAir,minDelay,maxDelay){
            const p=copyState(state),traffic=cloneCars(cars);let delay=0;
            while((p.airRemaining+1e-10<requiredAir||delay<minDelay-1e-8)&&delay<maxDelay-1e-8){
              const before=traffic.map(car=>({x:car.mesh.position.x-p.x,z:car.mesh.position.z,
                live:car.mode==='highway'&&car.highwayWaitingToSpawn===undefined&&car.mesh.visible!==false}));
              const beforeTarget=p.demoTarget;yield* prepareProjectedGroundSteps(p,traffic,dt);projectedGroundStep(p,traffic,dt);
              if(p.demoTarget!==beforeTarget&&job)job.routeChanges.push({from:beforeTarget,to:p.demoTarget,age:job.candidateLaunchAge+delay});
              delay+=dt;let clear=Math.abs(p.x)<=13.65;
              for(let i=0;i<traffic.length&&clear;i++){
                const car=traffic[i],old=before[i];
                if(car.mode!=='highway'||car.highwayWaitingToSpawn!==undefined||car.mesh.visible===false)continue;
                const x=car.mesh.position.x-p.x,z=car.mesh.position.z,reset=!old.live||Math.abs(z-old.z)>100;
                if(sweptContact(reset?x:old.x,reset?z:old.z,x,z,2.1,(car.length||4.62)/2+2.8)!==null)clear=false;
              }
              yield null;if(!clear)return null;
            }
            return p.airRemaining+1e-10>=requiredAir&&delay+1e-8>=minDelay?{state:p,cars:traffic,delay}:null;
          }
          if(!withSuccessor&&job?.successorHint){
            const hint=job.successorHint;yield null;
            const suggested=yield* trial(start,sourceCars,hint.height,hint.lane,true);
            if(suggested){suggested.launchAtAge=job.candidateLaunchAge;suggested.entryAir=entryAirFor(start,hint.height,dt);yield* offer(suggested);}
          }
          for(const height of heights){
            const entryAir=entryAirFor(start,height,dt);
            const launch=yield* waitForLaunch(start,sourceCars,entryAir,0,.75);if(!launch)continue;
            for(const lane of order){
              yield null;const failure={};
              const option=yield* trial(launch.state,launch.cars,height,lane,true,failure);
              if(option){option.launchAtAge=(job?.candidateLaunchAge||0)+launch.delay;option.entryAir=entryAir;yield* offer(option);}
              else if(failure.retryDelay)delayed.push({height,lane,entryAir,launch,retryDelay:failure.retryDelay});
            }
          }
          // Keep the original same-phase A/B order. A delayed window must not
          // steal a current complete pair simply because its lane was nearer.
          // Only after all nominal pairs fail do bounded, swept time retries run.
          for(const retry of delayed){
            const launch=yield* waitForLaunch(retry.launch.state,retry.launch.cars,retry.entryAir,retry.retryDelay,retry.retryDelay);if(!launch)continue;
            yield null;const option=yield* trial(launch.state,launch.cars,retry.height,retry.lane,true);if(!option)continue;
            option.launchAtAge=(job?.candidateLaunchAge||0)+retry.launch.delay+launch.delay;option.entryAir=retry.entryAir;yield* offer(option);
          }
          return null;
        }
        function projectedObservations(p,traffic,h){
          return traffic.flatMap((car,index)=>car.mode==='highway'&&car.highwayWaitingToSpawn===undefined&&car.mesh.visible!==false?[{car,x:car.mesh.position.x,z:car.mesh.position.z,speed:car.speed,
            acceleration:p.demoNpcSpeeds?clamp((car.speed-p.demoNpcSpeeds[index])/h,-8.5,3.2):0,halfLength:(car.length||4.62)/2+2.15,height:car.height||1.25}]:[]);
        }
        function* prepareProjectedGroundSteps(p,traffic,h){
          p.demoLandingLane=null;
          if(p.demoRoutePrepared)return;
          p.demoJumpCooldown=Math.max(0,(p.demoJumpCooldown||0)-h);if(p.demoJumpCooldown<1e-7)p.demoJumpCooldown=0;
          if(p.demoRefillTarget===undefined)p.demoRefillTarget=0;if(p.airRemaining>=p.demoRefillTarget)p.demoRefillTarget=0;
          p.demoDecisionCooldown=Math.max(0,(p.demoDecisionCooldown||0)-h);if(p.demoDecisionCooldown<1e-7)p.demoDecisionCooldown=0;
          if(p.airRemaining<4.3)p.demoCharging=true;if(p.airRemaining>=7)p.demoCharging=false;
          const ground=yield* groundDecisionSteps(p,projectedObservations(p,traffic,h),{target:p.demoTarget??target,changing:!!p.demoChanging,dwell:p.demoDwell||0,
            decisionCooldown:p.demoDecisionCooldown,jumpCooldown:p.demoJumpCooldown,charging:p.demoCharging,certificate:!!p.demoCertificate,refillTarget:p.demoRefillTarget},h);
          p.demoTarget=ground.target;p.demoChanging=ground.changing;p.demoDwell=ground.dwell;p.demoDecisionCooldown=ground.decisionCooldown;
          if(ground.released)p.demoCertificate=false;
          p.demoControls=ground.drive;
          if(p.demoJumpCooldown>0||p.demoRefillTarget>0&&p.airRemaining<p.demoRefillTarget)p.demoControls={throttle:1,boost:refillBoost(Math.max(0,-p.vz,p.speed||0),p.airRemaining,h,p.isFreefalling,p)?1:0,brake:0,jumpNeeded:ground.drive?.jumpNeeded};
          p.demoRoutePrepared=true;
        }
        function prepareProjectedGround(...args){const iterator=prepareProjectedGroundSteps(...args);let result;do{result=iterator.next();}while(!result.done);return result.value;}
        function projectedGroundStep(p,traffic,h){
          prepareProjectedGround(p,traffic,h);const controls=p.demoControls,lane=p.demoTarget;p.demoRoutePrepared=false;
          const originalGas=p.airRemaining,mass=1850+Number((144*(originalGas/10)).toFixed(1));
          const wrap=rad=>((rad+Math.PI)%(Math.PI*2)+(Math.PI*2))%(Math.PI*2)-Math.PI;
          function coast(speed,seconds,isStandard){
            let magnitude=Math.abs(speed);if(magnitude<=.1)return 0;let remainingDt=seconds;
            if(isStandard&&magnitude>200/3.6){
              const decel=(.00012*magnitude*magnitude+.35)*1.3;
              const above=Math.min(remainingDt,(magnitude-200/3.6)/decel);
              magnitude=Math.max(200/3.6,magnitude-decel*above);remainingDt-=above;
            }
            magnitude=Math.max(0,magnitude-(.00012*magnitude*magnitude+.35)*remainingDt);
            return Math.sign(speed)*magnitude;
          }
          const command=steeringFor(p.x,p.vx||0,Math.max(p.speed,-p.vz),lane,controls.boost);
          p.steerInput=(p.steerInput||0)+(command-(p.steerInput||0))*(1-Math.exp(-handling.rackRate*h));
          if(Math.abs(p.steerInput)<.004&&command===0)p.steerInput=0;
          p.steerAngle=-p.steerInput*.38;
          const real=p.physicsMode==='realistic',boost=controls.boost>0&&!p.isFreefalling&&originalGas>0;
          const standard=real&&!p.insaneMode&&!boost,maximum=real?(standard?200/3.6:370/3.6):160;
          p.maxSpeed=maximum;p.airMaxSpeed=real?(p.insaneMode||boost?52:31.5):260;
          if(p.wasAirborne){const nx=-Math.sin(p.yaw),nz=-Math.cos(p.yaw),forward=p.vx*nx+p.vz*nz;p.speed=(forward>=0?1:-1)*Math.hypot(p.vx,p.vz);}
          p.wasAirborne=false;p.airStrafeSpeed=0;p.jumpInertiaSeconds=null;p.jumpInertiaGraceSeconds=null;
          const oldSpeed=p.speed;
          const blend=clamp((Math.abs(oldSpeed)-200/3.6)/(40/3.6),0,1);
          const demand=blend*blend*(3-2*blend)*controls.brake;
          const requestedAir=.55*demand*h;
          const retroGas=controls.brake>0&&!p.isFreefalling&&originalGas>0?Math.max(0,originalGas-Math.min(originalGas,requestedAir)):originalGas;
          const impulseSeconds=(p.infiniteJet?requestedAir:Math.min(requestedAir,originalGas-retroGas))/.55;
          const retroTravelSpeed=Math.abs(oldSpeed);
          const retroScale=retroTravelSpeed>0?Math.max(0,retroTravelSpeed-80000/mass*impulseSeconds)/retroTravelSpeed:0;
          if(impulseSeconds>0){p.vx*=retroScale;p.vz*=retroScale;p.speed*=retroScale;}
          if(controls.throttle>0||boost){
            const electric=real&&!p.insaneMode&&p.speed>=200/3.6?0:(real?(p.insaneMode?38:16.5):72)*controls.throttle;
            const jet=boost?(real?38:120)*controls.boost*(1994/Math.max(1850,mass)):0;
            const acceleration=Math.max(electric,jet);
            p.speed=standard&&p.speed>maximum?Math.max(maximum,coast(p.speed,h,true)):Math.min(maximum,p.speed+acceleration*h);
          }else if(controls.brake>0)p.speed=Math.max(0,p.speed-38*controls.brake*h);
          else p.speed=coast(p.speed,h,standard);
          const oldYaw=p.yaw||0,desired=(p.steerInput||0)*handling.lateralSpeed*clamp(p.speed/18,0,1);
          const yawError=wrap(-Math.atan2(desired,Math.max(12,p.speed))-oldYaw);
          p.yaw=oldYaw+yawError*(1-Math.exp(-handling.yawRate*h));
          p.vx=(p.vx||0)+(desired-(p.vx||0))*(1-Math.exp(-handling.lateralRate*h));p.vz=-Math.cos(oldYaw)*p.speed;p.x+=p.vx*h;
          p.airRemaining=p.infiniteJet?10:boost?Math.max(0,originalGas-.85*controls.boost*h):impulseSeconds>0?retroGas:Math.min(10,originalGas+3.4*h);
          p.airUsedContinuous=10-p.airRemaining;p.gasMassKg=Number((144*(originalGas/10)).toFixed(1));
          if(p.airRemaining>=2.5&&!boost)p.isFreefalling=false;
          p.isDrifting=false;p.wasHandbraking=false;p.driftAngle*=Math.pow(.005,h);p.isAutoLandingSave=false;p.isJumping6m=false;p.accumulatedRoll=0;if(!boost&&impulseSeconds===0&&p.airRemaining>2.2)p.isAutoDescending8s=false;
          advanceDemoAttitude(p,h,false);
          const acceleration=(p.speed-(p.prevSpeed||p.speed))/Math.max(.001,h);p.prevSpeed=p.speed;p.longitudinalG=(1-10*h)*(p.longitudinalG||0)+(10*h)*(-acceleration/9.81);
          p.demoNpcSpeeds=traffic.map((car,i)=>car.mode==='highway'&&car.highwayWaitingToSpawn===undefined&&car.mesh.visible!==false?car.speed:p.demoNpcSpeeds?.[i]);
          highwayTraffic.forecastStep(traffic,{x:p.x,y:0,z:0,vx:p.vx,vz:p.vz},h,lanes,scale);
        }
        function projectedImmediate(p,traffic,h){
          return collisionTime(trajectory([p.demoTarget],.85,true,p,projectedObservations(p,traffic,h),p.demoCharging,p.demoRefillTarget),.3,2.0,.1,projectedObservations(p,traffic,h));
        }
        const copyCars=source=>source.map(car=>({...car,laneChange:car.laneChange?{...car.laneChange}:null,
          mesh:{position:{x:car.mesh.position.x,y:car.mesh.position.y,z:car.mesh.position.z},rotation:{x:car.mesh.rotation.x,y:car.mesh.rotation.y,z:car.mesh.rotation.z},visible:car.mesh.visible}}));
        const groundSweepBefore=(p,traffic)=>traffic.map(car=>({x:car.mesh.position.x-p.x,z:car.mesh.position.z,
          live:car.mode==='highway'&&car.highwayWaitingToSpawn===undefined&&car.mesh.visible!==false}));
        function groundSweepClear(p,traffic,before,enforceFloor=true){
          if(Math.abs(p.x)>13.65||enforceFloor&&p.speed<speedFloor||p.airRemaining<=.3)return false;
          for(let i=0;i<traffic.length;i++){
            const car=traffic[i],old=before[i];if(car.mode!=='highway'||car.highwayWaitingToSpawn!==undefined||car.mesh.visible===false)continue;
            const x=car.mesh.position.x-p.x,z=car.mesh.position.z,reset=!old.live||Math.abs(z-old.z)>100;
            if(sweptContact(reset?x:old.x,reset?z:old.z,x,z,2.1,(car.length||4.62)/2+2.8)!==null)return false;
          }
          return true;
        }
        function* groundTerminalSteps(state,sourceCars,seconds=2.4,checkpointJob=null){
          const p=copyState(state),traffic=copyCars(sourceCars);let frames=0,minSpeed=p.speed,minGas=p.airRemaining;
          for(let time=0;time<seconds-1e-8;time+=dt){
            recordSourceCheckpoint(checkpointJob,p,traffic);
            const before=groundSweepBefore(p,traffic);yield* prepareProjectedGroundSteps(p,traffic,dt);projectedGroundStep(p,traffic,dt);frames++;
            minSpeed=Math.min(minSpeed,p.speed);minGas=Math.min(minGas,p.airRemaining);
            if(checkpointJob){checkpointJob.cursorFrame++;recordSourceCheckpoint(checkpointJob,p,traffic);}yield null;
            if(!groundSweepClear(p,traffic,before))return null;
          }
          return {seconds:frames*dt,frames,minSpeed,minGas,endpoint:p,forecast:traffic};
        }
        function* waitForEntrySteps(state,sourceCars,requiredAir,minDelay=0,maxDelay=.75,capture=false){
          const p=copyState(state),traffic=copyCars(sourceCars),checkpoints=[];let delay=0,frames=0;
          while((p.airRemaining<requiredAir||delay<minDelay-1e-8)&&delay<maxDelay-1e-8){
            if(capture&&frames>0)checkpoints.push(projectedCheckpoint(p,traffic,frames));
            const before=groundSweepBefore(p,traffic);yield* prepareProjectedGroundSteps(p,traffic,dt);projectedGroundStep(p,traffic,dt);delay+=dt;frames++;yield null;
            if(!groundSweepClear(p,traffic,before))return null;
          }
          if(!(p.airRemaining>=requiredAir&&delay+1e-8>=minDelay))return null;
          if(capture&&frames>0)checkpoints.push(projectedCheckpoint(p,traffic,frames));
          // The actual launch step also completes its ground routing before
          // neutral paid takeoff. Do not hand an unprepared last wait step to
          // the candidate or to its exact prepared-phase cache key.
          yield* prepareProjectedGroundSteps(p,traffic,dt);
          return {state:p,cars:traffic,delay,frames,checkpoints};
        }
        // Finite backtracking continuation. A source proof authorizes only
        // its exact actual-ground prefix and prepared launch checkpoint;
        // Keep A before backtracking it; finish all two-hop goals before C.
        function* finiteSearchSteps(start,sourceCars,job={}){
          finiteSearches++;job.nodes??=0;job.cap??=36**3;job.capped??=false;
          const edgeMemo=new WeakMap();
          const entry=height=>entryAirFor(start,height,dt);
          function* edge(state,traffic,height,lane,nextAir=3.6){
            if(job.nodes>=job.cap){job.capped=true;finiteCapped++;return null;}
            job.nodes++;finiteNodes++;yield null;
            // Within one immutable finite search only, the same exact object
            // inputs and numeric parameters may recur while funding A/B.
            // Keep ordinal nodes/cap and candidate order unchanged; only
            // duplicate candidate-internal prediction work is eliminated.
            let byTraffic=edgeMemo.get(state);if(!byTraffic){byTraffic=new WeakMap();edgeMemo.set(state,byTraffic);}
            let entries=byTraffic.get(traffic);if(!entries){entries=[];byTraffic.set(traffic,entries);}
            const cached=entries.find(item=>Object.is(item.height,height)&&Object.is(item.lane,lane)&&Object.is(item.nextAir,nextAir));
            if(cached){finiteMemoHits++;job.memoHits=(job.memoHits||0)+1;return cached.value;}
            const value=yield* candidateSteps(state,traffic,height,lane,true,null,nextAir);entries.push({height,lane,nextAir,value});return value;
          }
          function* goal(path,launch){
            const last=path[path.length-1],terminal=yield* groundTerminalSteps(last.endpoint,last.forecast);
            if(!terminal)return null;finiteGoals++;
            return {path,launchDelay:launch.delay,launchFrames:launch.frames,launchState:copyState(launch.state),launchCars:copyCars(launch.cars),launchCheckpoints:launch.checkpoints||[],terminal,proofSeconds:path.reduce((sum,node)=>sum+node.duration+node.groundWait,launch.delay)+terminal.seconds};
          }
          function* root(launch,heightA,laneA){
            const a=yield* edge(launch.state,launch.cars,heightA,laneA);if(!a)return null;
            let found=yield* goal([a],launch);if(found)return found;
            const acceptedB=[];
            for(const heightB of heights){
              if(job.capped)return null;
              const fundedA=yield* edge(launch.state,launch.cars,heightA,laneA,entry(heightB));if(!fundedA)continue;
              for(let laneB=0;laneB<lanes.length;laneB++){
                const b=yield* edge(fundedA.endpoint,fundedA.forecast,heightB,laneB);if(!b)continue;
                found=yield* goal([fundedA,b],launch);if(found)return found;
                acceptedB.push({A:fundedA,height:heightB,lane:laneB});
              }
            }
            for(const prior of acceptedB)for(const heightC of heights){
              if(job.capped)return null;
              const fundedB=yield* edge(prior.A.endpoint,prior.A.forecast,prior.height,prior.lane,entry(heightC));if(!fundedB)continue;
              for(let laneC=0;laneC<lanes.length;laneC++){
                const c=yield* edge(fundedB.endpoint,fundedB.forecast,heightC,laneC);if(!c)continue;
                found=yield* goal([prior.A,fundedB,c],launch);if(found)return found;
              }
            }
            return null;
          }
          // The old first complete pair is an incumbent ordering only. Do not
          // stop the finite iterator when this pair lacks a terminal ground goal.
          const incumbentSearch=searchHops(start,sourceCars,true,{candidateLaunchAge:0,routeChanges:[],finiteBudget:job,rootHint:job.rootHint});let incumbent=null;
          while(!job.capped){const next=incumbentSearch.next();if(next.done)break;yield null;if(next.value?.pairedRoot){incumbent=next.value.pairedRoot;incumbentSearch.return();break;}}
          if(incumbent){
            const delay=incumbent.launchAtAge||0,launch=yield* waitForEntrySteps(start,sourceCars,entry(incumbent.height),delay,.75,job.strictSource&&!job.sourceInvalid);
            if(launch){const found=yield* root(launch,incumbent.height,incumbent.lane);if(found)return found;}
          }
          const order=lanes.map((_,lane)=>lane).sort((a,b)=>Math.abs(lanes[a]-start.x)-Math.abs(lanes[b]-start.x)||(a===job.rootHint?.lane?-1:0)-(b===job.rootHint?.lane?-1:0));
          for(const height of heights){
            if(job.capped)return null;const launch=yield* waitForEntrySteps(start,sourceCars,entry(height),0,.75,job.strictSource&&!job.sourceInvalid);if(!launch)continue;
            for(const lane of order){
              if(job.capped)return null;if(incumbent&&height===incumbent.height&&lane===incumbent.lane&&launch.delay===(incumbent.launchAtAge||0))continue;
              const found=yield* root(launch,height,lane);if(found)return found;
            }
          }
          return null;
        }
        function* searchAtLaunch(job,start,traffic){
          const p=copyState(start),h=clamp(dt,1/240,.1);p.demoCharging=start.demoCharging??charging;
          if(traffic.some(car=>car.blastTimer>0))return null;
          let enforceFloor=p.speed>=speedFloor,failedTarget=null,first=true;
          // Keep one bounded cursor through safe normal-ground episodes. A
          // failed jump search at an avoidable hazard is not failure of every
          // later launch phase. All episodes share one36^3 candidate allowance.
          while(job.age+job.untilStart<8-1e-8){
            recordSourceCheckpoint(job,p,traffic);
            const beforeTarget=p.demoTarget;yield* prepareProjectedGroundSteps(p,traffic,h);
            if(p.demoTarget!==beforeTarget)job.routeChanges.push({from:beforeTarget,to:p.demoTarget,age:job.age+job.untilStart});
            const immediate=projectedImmediate(p,traffic,h);
            if(immediate>=.55)failedTarget=null;
            const trigger=p.speed>=speedFloor&&p.demoJumpCooldown===0&&immediate<.55;
            if((first&&job.origin==='handoff'||trigger)&&failedTarget!==p.demoTarget){
              job.candidateLaunchState=copyState(p);
              job.candidateLaunchCars=copyState(traffic);
              job.candidateLaunchAge=job.age+job.untilStart;job.candidateLaunchFrame=job.cursorFrame;
              job.expectedState=copyState(p);job.expectedCars=copyState(traffic);job.expectedAdvanced=0;job.anchorDefined=true;
              const goal=yield* finiteSearchSteps(p,traffic,job);if(goal)return goal;
              if(job.capped)return null;failedTarget=p.demoTarget;
            }
            first=false;
            const before=groundSweepBefore(p,traffic);projectedGroundStep(p,traffic,h);job.untilStart+=h;job.cursorFrame++;recordSourceCheckpoint(job,p,traffic);
            enforceFloor ||= p.speed>=speedFloor;yield null;
            if(!groundSweepClear(p,traffic,before,enforceFloor))return null;
          }
          return null; // Neither a segment end nor a failed episode is a root.
        }
        const makeJob=(start,sourceCars,origin,afterSuccessor=false,rankingPrefixSeconds=0)=>{
          const phaseHop=afterSuccessor?plannedHop.successor:plannedHop,isGround=origin==='ground'||origin==='ground-window';
          const snapshot=copyState(start);snapshot.demoControlExternal=copyState(start.demoControlExternal??stepSeed?.external??externalControlState());
          snapshot.demoNpcSpeeds=isGround&&stepSeed?[...stepSeed.route.previousSpeeds]:start.demoNpcSpeeds?[...start.demoNpcSpeeds]:sourceCars.map(car=>{
            const observed=live.find(o=>o.car===car);return car.speed-(observed?.acceleration||0)*dt;
          });
          snapshot.demoTarget=isGround?target:rankingPrefixSeconds?start.demoTarget:phaseHop.lane;
          snapshot.demoChanging=isGround?changing:(start.demoChanging??(Math.abs(snapshot.x-lanes[phaseHop.lane])>=.32||Math.abs(snapshot.vx)>=1.3));
          snapshot.demoDwell=isGround?dwell:(start.demoDwell||0);snapshot.demoDecisionCooldown=isGround?decisionCooldown:rankingPrefixSeconds?(start.demoDecisionCooldown||0):0;
          snapshot.demoJumpCooldown=isGround?jumpCooldown:rankingPrefixSeconds?(start.demoJumpCooldown||0):0;snapshot.demoRefillTarget=isGround?refillTarget:rankingPrefixSeconds?(start.demoRefillTarget||0):0;snapshot.demoCertificate=isGround?!!certifiedNext:false;snapshot.demoCertificatePhase=isGround?certificatePhase(certifiedNext):null;
          snapshot.demoCharging=isGround?charging:(start.demoCharging??charging);snapshot.demoRoutePrepared=isGround;snapshot.demoControls={...drive};
          if(isGround&&(jumpCooldown>0||refillTarget>0&&player.airRemaining<refillTarget))snapshot.demoControls={throttle:1,boost:refillBoost(speed,player.airRemaining,dt)?1:0,brake:0,jumpNeeded:drive.jumpNeeded};
          const traffic=sourceCars.map(car=>({...car,laneChange:car.laneChange?{...car.laneChange}:null,
            mesh:{position:{...car.mesh.position},rotation:{...car.mesh.rotation},visible:car.mesh.visible}}));
          backgroundSearches++;
          const job={dt,identities:[...cars],work:0,result:null,readyGoal:null,kind:'finite',physicsMode:start.physicsMode,insaneMode:!!start.insaneMode,infiniteJet:!!start.infiniteJet,origin,successorHint:origin==='handoff'?plannedHop.successorHint:null,ready:null,firstSafe:null,safeRoots:[],routeChanges:afterSuccessor&&phaseHop.lane!==plannedHop.lane?[{from:plannedHop.lane,to:phaseHop.lane,age:plannedHop.duration+plannedHop.groundWait}]:[],afterCertificate:afterSuccessor?{lane:phaseHop.lane,height:phaseHop.height,requiredNextAir:phaseHop.requiredNextAir,physicsMode:start.physicsMode,insaneMode:!!start.insaneMode,infiniteJet:!!start.infiniteJet,frameDt:dt,phase:certificateSerial+1,successorGeometry:phaseHop.successor?{lane:phaseHop.successor.lane,height:phaseHop.successor.height,requiredNextAir:phaseHop.successor.requiredNextAir}:null}:null,done:false,age:0,untilStart:!isGround?plannedHop.duration+plannedHop.groundWait+(afterSuccessor?phaseHop.duration+phaseHop.groundWait:0)+rankingPrefixSeconds:0,rankingPrefixSeconds,epoch:planEpoch,target:!isGround?plannedHop.lane:target,expectedState:snapshot,expectedCars:traffic,anchorDefined:false,projectStep:projectedGroundStep};job.createdFrame=simulationFrame;job.cursorFrame=simulationFrame+Math.round(job.untilStart/dt);
          if(isGround&&stepSeed){job.strictSource=true;job.sourceSchema=controlPhysicsSchema;job.sourceValidatedUntil=simulationFrame;job.sourceCheckpoints=new Map([[simulationFrame,copyState(stepSeed)]]);}
          if(origin==='ground-window')job.iterator=(function*(){
            const firstWork=job.work,terminal=yield* groundTerminalSteps(snapshot,traffic,2.4,job);job.windowWork=job.work-firstWork;groundWindowWork+=job.windowWork;
            lastGroundReanchor={createdFrame:job.createdFrame,windowCompletionFrame:simulationFrame,windowWork:job.windowWork,safe:!!terminal};
            if(terminal){groundWindows++;job.untilStart+=terminal.seconds;return yield* searchAtLaunch(job,terminal.endpoint,terminal.forecast);}
            // A failed look-ahead restarts at its original phase. Its
            // speculative end frame must not shift the fallback cursor.
            groundWindowFailures++;job.cursorFrame=job.createdFrame;
            return yield* searchAtLaunch(job,snapshot,traffic);
          })();else job.iterator=searchAtLaunch(job,snapshot,traffic);return job;
        };
        function makeProjectedGroundJob(start,sourceCars,sourceFrame){
          const snapshot=copyState(start),traffic=copyState(sourceCars);snapshot.demoRoutePrepared=false;
          const job={dt,identities:[...cars],work:0,result:null,readyGoal:null,kind:'finite',physicsMode:start.physicsMode,insaneMode:!!start.insaneMode,infiniteJet:!!start.infiniteJet,
            origin:'ground-window',ready:null,firstSafe:null,safeRoots:[],routeChanges:[],afterCertificate:null,done:false,age:0,untilStart:0,epoch:planEpoch,target:start.demoTarget,
            createdFrame:sourceFrame,cursorFrame:sourceFrame,anchorDefined:false,strictSource:true,sourceSchema:controlPhysicsSchema,
            sourceValidatedUntil:sourceFrame-1,sourceCheckpoints:new Map(),sourceInvalid:false,fromEarlyBridge:true,bridgeValidated:false};
          recordSourceCheckpoint(job,snapshot,traffic);backgroundSearches++;
          job.iterator=(function*(){
            const firstWork=job.work,terminal=yield* groundTerminalSteps(snapshot,traffic,2.4,job);job.windowWork=job.work-firstWork;groundWindowWork+=job.windowWork;
            if(terminal){groundWindows++;job.untilStart+=terminal.seconds;return yield* searchAtLaunch(job,terminal.endpoint,terminal.forecast);}
            groundWindowFailures++;job.cursorFrame=job.createdFrame;return yield* searchAtLaunch(job,snapshot,traffic);
          })();return job;
        }
        const admissionApi={makeProjectedGroundJob,steeringFor,candidateSteps,prepareProjectedGroundSteps,projectedGroundStep,projectedImmediate,groundTerminalSteps,groundSweepBefore,groundSweepClear,
          entryAir:(height,p=player)=>entryAirFor(p,height,dt)};
        lastProjectionApi=admissionApi;
        if(groundReanchorPending&&!certifiedNext&&planJob?.kind!=='continuation'){
          const hint=planJob?.readyGoal?.path?.[0]||planJob?.rootHint;planJob=makeJob(player,cars,'ground-window');planJob.rootHint=hint?{height:hint.height,lane:hint.lane}:null;groundReanchorPending=false;groundReanchors++;
        }else if(certifiedNext)groundReanchorPending=false;
        const preparedSource=consumePreparedSource(player,cars,dt,immediate);
        plannedHop=preparedSource?.root||(!preparedSource?.waiting?prepareActualAdmission(admissionApi,player,cars,dt,immediate):null);
        // No ready/mismatched proof means normal bounded ground input. Never
        // drain a sibling search or an overdue proof synchronously.
        if(!plannedHop&&!planJob&&!certifiedNext&&live.length&&!player.isFreefalling)planJob=makeJob(player,cars,'ground');
        if(!plannedHop){
          advancePlanJob();
          // Work completed on this exact launch step is already available:
          // consume it before physics, without spending a second allowance.
          plannedHop=consumePreparedSource(player,cars,dt,immediate)?.root||null;
        }
        if(plannedHop){
          if(plannedHop.fromCertificate&&plannedHop.continuationGeometry){
            // A finite A/B/C witness must not lose C when the already promised
            // B is freshly checked. B launches on its own completed proof; C
            // is optional work on B's NEW endpoint, never an extra gate on B.
            const b=plannedHop,hint=b.continuationGeometry;
            const job={dt,identities:[...cars],work:0,result:null,readyGoal:null,kind:'continuation',physicsMode:player.physicsMode,insaneMode:!!player.insaneMode,infiniteJet:!!player.infiniteJet,
              origin:'continuation',done:false,age:0,untilStart:b.duration+b.groundWait,epoch:planEpoch};
            continuationProofs++;backgroundSearches++;
            job.iterator=(function*(){
              const c=yield* candidateSteps(b.endpoint,b.forecast,hint.height,hint.lane,true,null,hint.requiredNextAir??3.6);if(!c)return null;
              const terminal=yield* groundTerminalSteps(c.endpoint,c.forecast);return terminal?{root:c,terminal}:null;
            })();
            job.promote=(proof,age)=>{
              // The old C proposal is only a lane/height hint. Its paid arc and
              // ground terminal above were recomputed on fresh B endpoint/cars.
              b.successor=proof.root;b.rankingTerminal=proof.terminal;
              const next=makeJob(proof.terminal.endpoint,proof.terminal.forecast,'post-certificate',true,proof.terminal.seconds);next.untilStart-=age;
              certifiedNext={lane:proof.root.lane,height:proof.root.height,requiredNextAir:proof.root.requiredNextAir,
                physicsMode:job.physicsMode,insaneMode:job.insaneMode,infiniteJet:!!job.infiniteJet,frameDt:dt,phase:++certificateSerial,successorGeometry:null,
                scheduledAfter:b.duration+b.groundWait,expectedState:copyState(b.endpoint),expectedCars:b.forecast};
              continuedCertificates++;return next;
            };
            planJob=job;if(prefetchJob?.bConsumed)prefetchJob.continuationJob=job;
          }else if(plannedHop.retainedPlanJob)planJob=plannedHop.retainedPlanJob;
          else {
            const tail=plannedHop.rankingTerminal,phaseHop=plannedHop.successor||plannedHop;
            planJob=makeJob(tail?.endpoint||phaseHop.endpoint,tail?.forecast||phaseHop.forecast,'post-certificate',!!plannedHop.successor,tail?.seconds||0);
          }
        }

      }
      if(plannedHop){
        lastLaunchedFromCertificate=!!plannedHop.fromCertificate;
        const span=Math.abs(plannedHop.lane-nearest(player.x,lanes));
        if(plannedHop.lane!==target){if(!changing)started++;changing=true;dwell=0;}
        if(span>1)multiLane++;maxLaneSpan=Math.max(maxLaneSpan,span);
        target=plannedHop.lane;landingLane=target;refillTarget=plannedHop.requiredNextAir;
        certifiedNext=plannedHop.successor?{lane:plannedHop.successor.lane,height:plannedHop.successor.height,
          physicsMode:player.physicsMode,insaneMode:!!player.insaneMode,infiniteJet:!!player.infiniteJet,frameDt:dt,requiredNextAir:plannedHop.successor.requiredNextAir,phase:++certificateSerial,
          successorGeometry:plannedHop.successor.successor?{lane:plannedHop.successor.successor.lane,height:plannedHop.successor.successor.height,requiredNextAir:plannedHop.successor.successor.requiredNextAir}:null,
          scheduledAfter:plannedHop.duration+plannedHop.groundWait,expectedState:{...plannedHop.endpoint},expectedCars:plannedHop.forecast}:null;
        jumpCooldown=plannedHop.duration+plannedHop.groundWait;jumps++;
        return {input:neutral(),jump:true,jumpHeight:plannedHop.height,jumpGraceSeconds:Math.min(2.4,plannedHop.duration+.18),nextJumpAir:plannedHop.requiredNextAir,groundPreparationSeconds:plannedHop.preparation,groundWaitSeconds:plannedHop.groundWait,certificateSource:plannedHop.fromCertificate?'revalidated':plannedHop.backup?'backup':'new',nextJumpLane:certifiedNext?.lane??null,nextJumpHeight:certifiedNext?.height??null,status:'jump',targetLane:target};
      }
      // Keep the admitted preparation interval and tank minimum. The same
      // floor-only paid pulse is included in the candidate's real refill clock;
      // no H/retro, free gas or airborne forward request can shorten it.
      if(jumpCooldown>0||(refillTarget>0&&player.airRemaining<refillTarget))drive={throttle:1,boost:refillBoost(speed,player.airRemaining,dt)?1:0,brake:0,jumpNeeded:drive.jumpNeeded};
      input.throttle=drive.throttle;input.boost=drive.boost;input.brake=drive.brake;
      input.steer=steeringFor(player.x,player.vx||0,speed,target,input.boost);
      return {input,jump:false,status:drive.brake>0?'brake':changing?'merge':charging?'recharge':'drive',targetLane:target};
      } finally {
        if(standalone)endRender();
        if(renderStartedAt!==null)maxRenderElapsedAtPlannerExitMs=Math.max(maxRenderElapsedAtPlannerExitMs,clockNow()-renderStartedAt);
        if(standalone){renderWorkRemaining=null;renderStartedAt=renderDeadline=null;}
      }
    }
    return { step, reset, invalidateFuelMode, beginRender, endRender, stats: () => ({ fuelMode, fuelModeChanges, planEpoch, started, completed, jumps, multiLane, maxLaneSpan, targetLane: target, changing,certifiedNextLane:certifiedNext?.lane??null,certifiedNextHeight:certifiedNext?.height??null,certifiedHandoffs,invalidatedCertificates,releasedCertificates,backupHops,freshValidations,maxFreshValidations,retainedHints:proposalHints.length,backgroundSearches,backgroundWork,backgroundFrames,maxBackgroundWork,planningWorkLimit,planningBudgetMs,earlyJobs,earlyWork,earlyChecks,earlyInvalidations,earlyLandings,earlyFreshCChecks,lastEarlyFailure,lastEarlyPromotion,prefetchJobs,prefetchWork,prefetchBindings,prefetchInvalidations,lastPrefetchFailure,lastPrefetchBinding,renderTimeLimitHits,maxRenderElapsedAtPlannerExitMs,expiredPlans,emptyPlans,preparedJobs,preparedWork,preparedChecks,preparedStartChecks,preparedInvalidations,preparedNoReady,maxPreparedWork,preparedCommits,preparedDeferred,sourceStartChecks,sourceAnchorChecks,sourceInvalidations,cachedSourceCommits,lastSourceFailure,groundReanchors,groundWindows,groundWindowFailures,groundWindowWork,lastGroundReanchor,lastPreparedFailure,controlPhysicsSchema,finiteSearches,finiteNodes,finiteYields,finiteCapped,finiteGoals,finiteMemoHits,continuationProofs,continuedCertificates,lastPlanMismatch,expiryReasons }) };
  }
  return Object.freeze({ create, createClock, neutral, handling, sweptContact, activationHazard });
})();

// UI/lifecycle adapter. No keyboard shortcut is registered for this mode.
(() => {
  const button = document.getElementById('btn-highway-demo');
  if (!button) return;
  const planner = RoadsterHighwayDemoPlanner.create(LANE_CENTERS, WORLD_SPEED_SCALE);
  const clock=RoadsterHighwayDemoPlanner.createClock();
  let lastClockFrame=null;
  let requestingJump = false, plannedJumpHeight=2.3, plannedJumpGrace=.95;
  let active = false, pending = false, version = 0, frameInput = RoadsterHighwayDemoPlanner.neutral(), status = '', error = false;
  const busy = () => active || pending;
  function render() {
    const zh = currentLang === 'zh';
    button.hidden = currentMap !== 'highway';
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-busy', String(pending));
    button.textContent = pending ? (zh ? '自动驾驶：准备中·取消' : 'Autopilot: preparing · cancel') : active ? (status === 'brake' ? (zh ? '自动驾驶：制动·退出' : 'Autopilot: braking · exit') : (zh ? '自动驾驶：开·退出' : 'Autopilot: on · exit')) : error === 'unsafe' ? (zh ? '自动驾驶：暂不能安全接管' : 'Autopilot: cannot safely take over') : error === 'ground' ? (zh ? '自动驾驶：先落地' : 'Autopilot: land first') : error ? (zh ? '自动驾驶：重试' : 'Autopilot: retry') : (zh ? '自动驾驶模式' : 'Autopilot');
    const details = error === 'unsafe' ? (zh ? '暂不能安全接管：高速近端危险，规划尚未就绪。请保持手动驾驶，在有充分净空时重试。' : 'Cannot safely take over: a near-term hazard leaves no prepared plan at high speed. Keep manual control and retry with sufficient clearance.') : error === 'performance' ? (zh ? '自动驾驶已退出：渲染过慢。请降低画质后重新开启；当前已恢复手动驾驶。' : 'Autopilot stopped: rendering is too slow. Lower graphics quality and restart; manual driving is restored.') : error === 'ground' ? (zh ? '请先落地，再开启自动驾驶。' : 'Land before enabling autopilot.') : error ? (zh ? '旧挑战尚未确认结束，请重试自动驾驶。' : 'Previous challenge end is unconfirmed. Retry autopilot.') : active ? (status === 'brake' ? (zh ? '仅在预测不低于220 km/h时制动；否则优先变道或真实耗气跳跃。关闭后手动驾驶。' : 'Braking only above 220 km/h; otherwise pass or use a paid hop. Switch off for manual control.') : (zh ? '自动驾驶·目标220+ km/h·不计排行。连续变道、耗气跳跃；气量不足时受真实物理限制。' : 'Autopilot · target 220+ km/h · unranked. Continuous merges and paid hops; real tank limits apply.')) : (zh ? '第一关自动驾驶。真实用气与碰撞，无快捷键。' : 'Highway autopilot. Real gas and collisions. No shortcut.');
    button.title = details;
    button.setAttribute('aria-label', `${button.textContent}. ${details}`);
    button.dataset.status = status;
    document.body.classList.toggle('highway-demo-active', active);
    window.RoadsterRanked?.render();
    if (typeof updateHudBounds === 'function') updateHudBounds();
  }
  function stop(reason) {
    if (!busy()) return;
    clock.clear();
    version++; active = pending = false; status = ''; error = reason==='performance'?'performance':false;
    frameInput = RoadsterHighwayDemoPlanner.neutral();
    clearAllInputKeys();
    render();
  }
  async function toggle() {
    if (busy()) { stop(); return; }
    if (currentMap !== 'highway' || state.isDestroyed || document.hidden) return;
    if (state.y > 0.15 || state.isJumping6m || state.isAltitudeHold) { error = 'ground'; render(); return; }
    if(RoadsterHighwayDemoPlanner.activationHazard(state,trafficCars,WORLD_SPEED_SCALE)){error='unsafe';status='unsafe';render();return;}
    const token = ++version;
    pending = true; error = false; clearAllInputKeys(); render();
    try {
      // Await both late issuance and server cancellation before taking control.
      await window.RoadsterRanked?.prepareForDemo();
      if (token !== version || !pending || currentMap !== 'highway' || state.isDestroyed || document.hidden) return;
      if(RoadsterHighwayDemoPlanner.activationHazard(state,trafficCars,WORLD_SPEED_SCALE)){pending=false;error='unsafe';status='unsafe';render();return;}
      clearAllInputKeys(); planner.reset(state.x);clock.reset();lastClockFrame=null;
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
  function advanceFrame(seconds,simulate){
    if(!active)return null;
    // One shared planning budget for the render, even if it owns three physics
    // ticks. Normal drive input is still recomputed on every fixed physics tick.
    planner.beginRender();lastClockFrame=clock.advance(seconds,simulate,()=>active);
    if(lastClockFrame.overloaded)stop('performance');else if(active)planner.endRender();
    return lastClockFrame;
  }
  button.addEventListener('click', toggle);
  window.addEventListener('blur', stop);
  window.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.RoadsterDemo = { jumpHeight: () => plannedJumpHeight, jumpGraceSeconds:()=>plannedJumpGrace, isRequestingJump: () => requestingJump, isActive: () => active, isBusy: busy, stop, toggle, onFuelModeChange: () => planner.invalidateFuelMode(state), step, advanceFrame, clockStats:()=>({...clock.stats(),lastFrame:lastClockFrame}), render, input: () => frameInput };
  render();
})();
