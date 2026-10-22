// Local, bounded render evidence. Render callbacks certify submission attempts,
// NOT GPU completion, unoccluded visibility, or the colour of visible pixels.
(() => {
  if (window.RoadsterRenderDiagnostics) return;
  const LIMIT = 8, CHILD_LIMIT = 6, observed = new WeakMap();
  const frame = { started: 0, finished: 0, lastFinishedFrame: null, lastStartedAt: null, lastFinishedAt: null };
  const contextEvents = { lost: 0, restored: 0, lastLostAt: null, lastRestoredAt: null };
  const now = () => typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : null;
  const finite = value => Number.isFinite(value) ? value : null;
  const short = (value, max = 256) => typeof value === 'string' ? value.slice(0, max) : value == null ? null : String(value).slice(0, max);
  const vector = value => value ? { x: finite(value.x), y: finite(value.y), z: finite(value.z) } : null;
  const matrix = value => value?.elements ? Array.from(value.elements).slice(0, 16).map(finite) : null;
  const transform = object => object ? { id: object.id ?? null, name: short(object.name), visible: object.visible !== false,
    position: vector(object.position), rotation: object.rotation ? { ...vector(object.rotation), order: short(object.rotation.order) } : null,
    scale: vector(object.scale), matrixAutoUpdate: object.matrixAutoUpdate ?? null, matrixWorldNeedsUpdate: object.matrixWorldNeedsUpdate ?? null,
    layers: object.layers?.mask ?? null, matrix: matrix(object.matrix), matrixWorld: matrix(object.matrixWorld) } : null;
  const safeInfo = value => {
    if (!value || typeof value !== 'object') return value == null ? null : short(value);
    const result = {};
    for (const key of Object.keys(value).slice(0, 16)) {
      const v = value[key];
      result[key] = typeof v === 'boolean' || typeof v === 'number' ? (typeof v === 'number' ? finite(v) : v)
        : Array.isArray(v) ? v.slice(0, 16).map(x => typeof x === 'number' ? finite(x) : short(x)) : short(v);
    }
    return result;
  };
  function buildInfo(value) {
    if (!value || typeof value !== 'object') return null;
    const source = value.sourceSha256 && typeof value.sourceSha256 === 'object' ? value.sourceSha256 : {};
    const entries = Object.entries(source).filter(([path, hash]) => /^(?:src\/[a-z0-9][a-z0-9-]*\.(?:js|html|css)|bundle_app\.py)$/.test(path)
      && typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash)).sort(([a], [b]) => a.localeCompare(b));
    return { schema: short(value.schema), id: short(value.id), sourceInputCount: entries.length,
      sourceSha256: Object.fromEntries(entries.slice(0, 32)), sourceListTruncated: entries.length > 32 };
  }
  function ancestry(object) {
    const chain = []; let cursor = object, visible = true, inScene = false;
    for (let i = 0; cursor && i < 8; i++, cursor = cursor.parent) {
      visible = visible && cursor.visible !== false;
      if (cursor === scene) inScene = true;
      if (i < 4) chain.push(transform(cursor));
    }
    return { visible, inScene, chain, truncated: Boolean(cursor) };
  }
  function programInfo(program) {
    if (!program) return null;
    const d = program.diagnostics;
    return { id: program.id ?? null, usedTimes: finite(program.usedTimes), runnable: d ? d.runnable ?? null : null,
      diagnosticsAvailable: Boolean(d), programLog: short(d?.programLog, 1024),
      vertexLog: short(d?.vertexShader?.log, 1024), fragmentLog: short(d?.fragmentShader?.log, 1024) };
  }
  function noteProgram(record, material) {
    // Only read renderer properties for materials whose after-render hook ran.
    // Do not compile/link, drain GL errors, or read pixels for diagnostics.
    if (!material || !renderer.properties?.get) return;
    try {
      const properties = renderer.properties.get(material);
      record.lastProgram = properties?.program || properties?.currentProgram || null;
    } catch (error) { record.programReadError = short(error?.message); }
  }
  function observe(mesh) {
    if (!mesh || observed.has(mesh)) return;
    const record = { before: 0, after: 0, lastBeforeFrame: null, lastAfterFrame: null, lastProgram: null };
    observed.set(mesh, record);
    const before = mesh.onBeforeRender, after = mesh.onAfterRender;
    mesh.onBeforeRender = function (...args) {
      record.before++; record.lastBeforeFrame = frame.started;
      record.lastGeometryId = args[3]?.id ?? this.geometry?.id ?? null;
      record.lastMaterialId = args[4]?.id ?? this.material?.id ?? null;
      record.lastCameraId = args[2]?.id ?? null;
      try { return typeof before === 'function' ? before.apply(this, args) : undefined; }
      catch (error) { record.callbackError = short(error?.message); throw error; }
    };
    mesh.onAfterRender = function (...args) {
      record.after++; record.lastAfterFrame = frame.started;
      noteProgram(record, args[4] || this.material);
      try { return typeof after === 'function' ? after.apply(this, args) : undefined; }
      catch (error) { record.callbackError = short(error?.message); throw error; }
    };
  }
  function nearby(contact) {
    const cars = typeof trafficCars !== 'undefined' && Array.isArray(trafficCars) ? trafficCars : [];
    const p = typeof state !== 'undefined' ? state : camera.position;
    const ordered = cars.filter(car => car?.mesh?.position).map((car, ordinal) => ({ car, ordinal,
      distance2: ['x', 'y', 'z'].reduce((sum, key) => sum + Math.pow((car.mesh.position[key] || 0) - (p[key] || 0), 2), 0) }))
      .sort((a, b) => a.distance2 - b.distance2 || a.ordinal - b.ordinal);
    const selected = ordered.slice(0, LIMIT);
    let target = null;
    if (contact?.kind?.startsWith('traffic') && contact.position) {
      target = ordered.find(({ car }) => (!contact.variant || car.mesh.userData?.trafficVariant === contact.variant)
        && ['x', 'y', 'z'].every(key => Math.abs((car.mesh.position[key] || 0) - (contact.position[key] || 0)) < 1e-4));
      if (target && !selected.includes(target)) { if (selected.length === LIMIT) selected.pop(); selected.push(target); }
    }
    return { selected, target, total: cars.length };
  }
  function sphereTest(mesh) {
    const sphere = mesh.geometry?.boundingSphere;
    // intersectsObject() would compute a missing bound and mutate geometry.
    // A missing or stale bound remains evidence, never silently recomputed.
    if (!sphere || typeof THREE === 'undefined' || !THREE.Frustum || !THREE.Matrix4 || !sphere.clone || !mesh.matrixWorld || !camera.projectionMatrix || !camera.matrixWorldInverse) return null;
    try {
      const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      return frustum.intersectsSphere(sphere.clone().applyMatrix4(mesh.matrixWorld));
    } catch (_) { return null; }
  }
  function materialInfo(material) {
    if (!material) return null;
    return { id: material.id ?? null, type: short(material.type), name: short(material.name), visible: material.visible !== false,
      colorWrite: material.colorWrite !== false, transparent: Boolean(material.transparent), opacity: finite(material.opacity),
      side: material.side ?? null, depthTest: material.depthTest ?? null, depthWrite: material.depthWrite ?? null,
      alphaTest: finite(material.alphaTest), version: finite(material.version), clippingPlanes: material.clippingPlanes?.length || 0 };
  }
  function childInfo(mesh) {
    const g = mesh.geometry, record = observed.get(mesh), parents = ancestry(mesh), sphere = g?.boundingSphere;
    return { ...transform(mesh), ancestry: parents,
      eligibility: { visibleInAncestors: parents.visible, attachedToScene: parents.inScene,
        cameraLayerMatch: camera.layers && mesh.layers ? Boolean(camera.layers.mask & mesh.layers.mask) : null,
        frustumCulled: mesh.frustumCulled ?? null, storedSphereIntersectsCamera: sphereTest(mesh) },
      material: (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).slice(0, 4).map(materialInfo),
      geometry: g ? { id: g.id ?? null, positionCount: g.attributes?.position?.count ?? null, indexCount: g.index?.count ?? null,
        indexType: short(g.index?.array?.constructor?.name), drawRange: g.drawRange ? { start: finite(g.drawRange.start), count: finite(g.drawRange.count), unbounded: g.drawRange.count === Infinity } : null,
        groups: (g.groups || []).slice(0, 8).map(group => ({ start: finite(group.start), count: finite(group.count), materialIndex: group.materialIndex ?? null })),
        boundingSphere: sphere ? { center: vector(sphere.center), radius: finite(sphere.radius) } : null } : null,
      submission: record ? { beforeCallbacks: record.before, afterCallbacks: record.after,
        lastBeforeFrame: record.lastBeforeFrame, lastAfterFrame: record.lastAfterFrame,
        lastGeometryId: record.lastGeometryId ?? null, lastMaterialId: record.lastMaterialId ?? null, lastCameraId: record.lastCameraId ?? null,
        lastProgram: programInfo(record.lastProgram), callbackError: record.callbackError || null, programReadError: record.programReadError || null }
        : { observed: false, reason: 'No nearby render hook has been attached yet.' } };
  }
  function read(request = {}) {
    const contact = request?.contact || (request?.kind ? request : null), selection = nearby(contact);
    let contextLost = null;
    try { contextLost = renderer.getContext?.().isContextLost?.() ?? null; } catch (_) {}
    const programs = renderer.info?.programs || [], failed = programs.filter(program => program.diagnostics?.runnable === false);
    return { schema: 'roadster-render-evidence-v1', phase: short(request?.phase || 'live'),
      limitation: 'Callbacks record CPU render/submission paths only, not GPU completion, pixel visibility, occlusion, or visual acceptance. Matrices/bounds are observed, never repaired.',
      build: buildInfo(window.RoadsterBuildInfo), map: typeof currentMap === 'undefined' ? null : currentMap,
      playerState: typeof state === 'undefined' ? null : { ...vector(state), yaw: finite(state.yaw), pitch: finite(state.pitch), roll: finite(state.roll), destroyed: Boolean(state.isDestroyed) },
      scene: transform(scene), trafficGroup: typeof trafficGroup === 'undefined' ? null : transform(trafficGroup),
      camera: { ...transform(camera), near: finite(camera.near), far: finite(camera.far), fov: finite(camera.fov),
        projectionMatrix: matrix(camera.projectionMatrix), matrixWorldInverse: matrix(camera.matrixWorldInverse) },
      frame: { ...frame, active: frame.started > 0 && frame.lastFinishedFrame !== frame.started, capturedAt: now() },
      renderer: { contextLost, contextEvents: { ...contextEvents }, getErrorConsumed: false,
        stats: safeInfo(renderer.info?.render), memory: safeInfo(renderer.info?.memory), programCount: programs.length,
        failedProgramCount: failed.length, programs: [...failed, ...programs.filter(program => !failed.includes(program))].slice(0, 8).map(programInfo) },
      traffic: { total: selection.total, captured: selection.selected.length, maximumCars: LIMIT, maximumChildrenPerCar: CHILD_LIMIT,
        contactTargetMatched: Boolean(selection.target), cars: selection.selected.map(entry => {
          const { car } = entry, mesh = car.mesh;
          return { ordinal: entry.ordinal, contactTarget: entry === selection.target, distance: Math.sqrt(entry.distance2),
            variant: short(mesh.userData?.trafficVariant), lod: short(mesh.userData?.trafficDetail), mode: short(car.mode),
            velocity: { x: finite(car.vx), y: finite(car.vy), z: finite(car.vz) }, speed: finite(car.speed),
            blastTimer: finite(car.blastTimer), cityWrapPending: Boolean(car.cityWrapPending),
            ...transform(mesh), ancestry: ancestry(mesh), childCount: mesh.children?.length || 0,
            children: (mesh.children || []).slice(0, CHILD_LIMIT).map(childInfo) };
        }) } };
  }
  // Opt-in exports contain game state only. The bounded ring samples rendered
  // poses, not exact physics ticks; no keys typed into text fields are recorded.
  const DRIVE_FIELDS=['x','y','z','vx','vy','vz','yaw','pitch','roll','airRemaining'];
  const DRIVE_CAPACITY=96,driveRows=Array.from({length:DRIVE_CAPACITY},()=>new Float64Array(12));
  let driveHead=0,driveCount=0,driveMap=null;
  const validMap=()=>typeof currentMap!=='undefined'&&['highway','city','coast'].includes(currentMap)?currentMap:null;
  function sampleDriveFrame(){
    const map=validMap();if(!map||typeof state==='undefined')return;
    if(driveMap!==map){driveHead=driveCount=0;driveMap=map;}
    const row=driveRows[driveHead];row[0]=now()||0;
    for(let i=0;i<DRIVE_FIELDS.length;i++)row[i+1]=Number.isFinite(state[DRIVE_FIELDS[i]])?state[DRIVE_FIELDS[i]]:0;
    row[11]=state.wasAirborne?0:1;driveHead=(driveHead+1)%DRIVE_CAPACITY;driveCount=Math.min(DRIVE_CAPACITY,driveCount+1);
  }
  function surfaceInfo(s){return s?{id:short(s.id,64),height:finite(s.height),normal:vector(s.normal),solid:Boolean(s.solid),road:Boolean(s.road),bridge:Boolean(s.bridge),water:Boolean(s.water)}:null;}
  function coastalGeometryAt(x,z){
    // Observe existing draw geometry/matrices only. Never compute missing bounds,
    // update world matrices, run renderer passes or read GPU pixels for an export.
    if(validMap()!=='coast'||typeof scene.getObjectByName!=='function')return null;
    const hits=[],budget=65536;let visited=0,truncated=false;
    const names=['coast-inland-ground','coast-road-surfaces','coast-road-earth-banks','coast-sand','coast-promenade','coast-pier-boardwalk'];
    for(const name of names){
      const mesh=scene.getObjectByName(name);if(!mesh?.geometry||!mesh.matrixWorld?.elements)continue;
      let visible=true;for(let p=mesh;p;p=p.parent)if(p.visible===false)visible=false;
      const material=mesh.material;if(!visible||Array.isArray(material)||!material||material.visible===false||material.colorWrite===false||(material.transparent&&material.opacity===0))continue;
      const g=mesh.geometry,p=g.attributes?.position,ix=g.index,e=mesh.matrixWorld.elements;if(!p||e.length!==16)continue;
      const start=g.drawRange?.start||0,end=Math.min(ix?.count??p.count,start+(g.drawRange?.count??Infinity));
      const vertex=i=>{const j=ix?ix.getX(i):i,a=p.getX(j),b=p.getY(j),c=p.getZ(j);return{x:e[0]*a+e[4]*b+e[8]*c+e[12],y:e[1]*a+e[5]*b+e[9]*c+e[13],z:e[2]*a+e[6]*b+e[10]*c+e[14]};};
      for(let i=start;i+2<end;i+=3){
        if(visited>=budget){truncated=true;break;}visited++;
        const a=vertex(i),b=vertex(i+1),c=vertex(i+2);
        if(x<Math.min(a.x,b.x,c.x)-1e-6||x>Math.max(a.x,b.x,c.x)+1e-6||z<Math.min(a.z,b.z,c.z)-1e-6||z>Math.max(a.z,b.z,c.z)+1e-6)continue;
        const d=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(d)<1e-12)continue;
        const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/d,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/d,w=1-u-v;
        if(Math.min(u,v,w)>=-1e-7){const h=u*a.y+v*b.y+w*c.y;if(Number.isFinite(h))hits.push({mesh:name,triangle:Math.floor(i/3),height:h});}
      }
      if(truncated)break;
    }
    return{method:'CPU existing visible-material draw triangles at player XZ; not GPU visibility or screenshot evidence',triangleBudget:budget,trianglesVisited:visited,truncated,totalHits:hits.length,hits:hits.sort((a,b)=>b.height-a.height).slice(0,8)};
  }
  function driveSnapshot(){
    const map=validMap();if(!map||typeof state==='undefined')return{schema:'roadster-local-problem-v1',available:false,reason:'No active game state'};
    sampleDriveFrame();let support=null,supportError=null,geometry=null,geometryError=null;
    if(map==='coast'){
      try{support=surfaceInfo(window.RoadsterCoast?.support({...state,grounded:!state.wasAirborne}));}catch(_){supportError='Support query unavailable';}
      try{geometry=coastalGeometryAt(state.x,state.z);}catch(_){geometryError='Draw geometry query unavailable';}
    }
    let incident=null;if(map==='city')try{const r=window.RoadsterCityDiagnostics?.snapshot();if(r?.map==='city')incident={tick:r.tick,kind:short(r.contact?.kind,64),id:typeof r.contact?.id==='number'?finite(r.contact.id):null,normal:r.contact?.normal?{...vector(r.contact.normal),depth:finite(r.contact.normal.depth)}:null,deltaV:finite(r.deltaV)};}catch(_){}
    const cars=typeof trafficCars!=='undefined'&&Array.isArray(trafficCars)?trafficCars.slice(0,64):[];
    let visible=0,ahead=0,behind=0,queued=0;const originZ=map==='highway'?0:state.z;
    for(const car of cars){if(car?.highwayWaitingToSpawn!==undefined||car?.coastWaiting)queued++;if(!car?.mesh||car.mesh.visible===false)continue;visible++;const p=car.mesh.position;if(!p)continue;const f=-(p.x-state.x)*Math.sin(state.yaw)-(p.z-originZ)*Math.cos(state.yaw);if(f>0&&f<=480)ahead++;else if(f<0&&f>=-480)behind++;}
    const closest=geometry?.hits?.reduce((best,h)=>support&&(!best||Math.abs(h.height-support.height)<Math.abs(best.height-support.height))?h:best,null);
    return{schema:'roadster-local-problem-v1',available:true,map,build:buildInfo(window.RoadsterBuildInfo),
      pose:{...vector(state),yaw:finite(state.yaw),pitch:finite(state.pitch),roll:finite(state.roll)},velocity:{x:finite(state.vx),y:finite(state.vy),z:finite(state.vz)},
      game:{airRemaining:finite(state.airRemaining),hullIntegrity:finite(state.hullIntegrity),wasAirborne:Boolean(state.wasAirborne),destroyed:Boolean(state.isDestroyed),coastSupportId:short(state.coastSupportId,64),physicsMode:state.physicsMode==='fantasy'?'fantasy':'realistic',plaid:Boolean(state.insaneMode),weatherIndex:typeof weatherIndex==='number'?finite(weatherIndex):null,cameraMode:typeof cameraModeIndex==='number'?finite(cameraModeIndex):null},
      impact:{g:finite(state.lastImpactG),deltaVKmh:finite(state.lastImpactDvKmh),reasonKey:typeof state.destroyReasonKey==='string'&&/^crashReason[A-Za-z]+$/.test(state.destroyReasonKey)?state.destroyReasonKey:null,cityContact:incident},
      support:{selected:support,error:supportError,rootClearance:support?.height!==null&&support?finite(state.y-support.height):null,meaning:'Current selected support, not proof of a collision contact'},
      geometry,geometryError,selectedSupportGeometryDelta:closest?finite(support.height-closest.height):null,
      traffic:{sampled:cars.length,total:typeof trafficCars!=='undefined'&&Array.isArray(trafficCars)?trafficCars.length:0,visible,aheadWithin480m:ahead,behindWithin480m:behind,queued,positionsRelativeToPlayer:map==='highway'},
      recent:{sampling:'rendered poses, not exact physics ticks or complete input replay; may contain reset jumps',capacity:DRIVE_CAPACITY,fields:['sampleMs',...DRIVE_FIELDS,'grounded'],trace:Array.from({length:driveCount},(_,i)=>Array.from(driveRows[(driveHead-driveCount+i+DRIVE_CAPACITY)%DRIVE_CAPACITY]))},
      privacy:'Local game coordinates, motion, support, contact and source version only. No account, nickname, URL, text input, storage or device identifiers; no automatic upload.'};
  }
  function briefDriveReport(r){
    if(!r.available)return'Roadster: no active game state';
    const n=v=>Number.isFinite(v)?Number(v.toFixed(3)):'?';
    const speed=[r.velocity.x,r.velocity.y,r.velocity.z].every(Number.isFinite)?Math.hypot(r.velocity.x,r.velocity.y,r.velocity.z)*3.6:null;
    return['Roadster local problem record v1',`Map: ${r.map} | build: ${r.build?.id||'unavailable'}`,`Position xyz: ${n(r.pose.x)}, ${n(r.pose.y)}, ${n(r.pose.z)} m`,`Velocity xyz: ${n(r.velocity.x)}, ${n(r.velocity.y)}, ${n(r.velocity.z)} m/s | ${n(speed)} km/h`,`Attitude yaw/pitch/roll: ${n(r.pose.yaw)}, ${n(r.pose.pitch)}, ${n(r.pose.roll)} rad`,`Grounded: ${!r.game.wasAirborne} | destroyed: ${r.game.destroyed} | air: ${n(r.game.airRemaining)} s`,`Support: ${r.support.selected?.id||'unavailable'} | height: ${n(r.support.selected?.height)} m | root clearance: ${n(r.support.rootClearance)} m`,`Support/draw-geometry delta: ${n(r.selectedSupportGeometryDelta)} m (CPU, not pixel proof)`,`Traffic ahead/visible/queued: ${r.traffic.aheadWithin480m}/${r.traffic.visible}/${r.traffic.queued}`,`Weather index: ${r.game.weatherIndex} | camera: ${r.game.cameraMode} | impact: ${n(r.impact.g)} G`,'Local only; no automatic upload.'].join('\n');
  }
  const driveDoc=typeof document==='undefined'?null:document,driveUi={};
  function renderDriveTools(){
    if(!driveDoc?.getElementById)return;const zh=typeof currentLang!=='undefined'&&currentLang==='zh';
    const labels={'drive-problem-title':zh?'本地问题记录':'Local problem record','drive-problem-note':zh?'仅记录地图坐标、速度、姿态、地面支持与版本。不会自动上传；可复制简要信息或保存本地JSON。':'Game coordinates, motion, support and version only. Nothing is uploaded automatically. Copy a brief report or save local JSON.','btn-copy-drive-problem':zh?'复制简要记录':'Copy brief report','btn-save-drive-problem':zh?'保存JSON':'Save JSON','btn-copy-crash-problem':zh?'复制问题记录':'Copy problem record'};
    for(const[id,text]of Object.entries(labels)){const el=driveDoc.getElementById(id);if(el)el.textContent=text;}
  }
  function bindDriveCopy(prefix,buttonId){
    const button=driveDoc?.getElementById?.(buttonId),output=driveDoc?.getElementById?.(prefix+'-data'),status=driveDoc?.getElementById?.(prefix+'-status');if(!button||!output||!status)return;
    const context={token:0,button,output,status};driveUi[prefix]=context;button.disabled=false;
    if(prefix==='crash-problem')button.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter')e.stopPropagation();});
    const active=()=>prefix==='drive-problem'?Boolean(driveDoc.getElementById('audio-settings')?.open):Boolean(driveDoc.getElementById('modal-destroyed')&&!driveDoc.getElementById('modal-destroyed').classList.contains('hidden'));
    button.addEventListener('click',()=>{
      const token=++context.token,zh=typeof currentLang!=='undefined'&&currentLang==='zh';let text;
      try{text=briefDriveReport(driveSnapshot());}catch(_){text=zh?'问题记录暂不可用。':'Problem record unavailable.';}
      output.value=text;output.hidden=false;status.textContent=zh?'正在复制…':'Copying…';
      const finish=success=>{if(token!==context.token||!active())return;status.textContent=success?(zh?'已复制。可直接粘贴发送。':'Copied. Paste it when you choose to share it.'):(zh?'浏览器未允许自动复制，请手动复制下方记录。':'Automatic copy is unavailable. Select and copy the record below.');if(!success){output.focus?.();output.select?.();}};
      try{if(typeof navigator==='undefined'||typeof navigator.clipboard?.writeText!=='function'){finish(false);return;}Promise.resolve(navigator.clipboard.writeText(text)).then(()=>finish(true),()=>finish(false));}catch(_){finish(false);}
    });
  }
  bindDriveCopy('drive-problem','btn-copy-drive-problem');bindDriveCopy('crash-problem','btn-copy-crash-problem');
  const driveSave=driveDoc?.getElementById?.('btn-save-drive-problem');if(driveSave){driveSave.disabled=false;driveSave.addEventListener('click',()=>{
    const ui=driveUi['drive-problem'];if(!ui)return;ui.token++;const zh=typeof currentLang!=='undefined'&&currentLang==='zh';let url=null;
    try{const r=driveSnapshot(),text=JSON.stringify(r,null,2);ui.output.value=text;ui.output.hidden=false;
      if(typeof Blob==='undefined'||typeof URL?.createObjectURL!=='function')throw Error('Local download unavailable');
      url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=driveDoc.createElement('a');a.href=url;a.download=`roadster-${r.map||'game'}-problem.json`;a.click();a.remove?.();
      ui.status.textContent=zh?'已发起本地JSON下载；未上传。':'Local JSON download requested; nothing uploaded.';
    }catch(_){ui.status.textContent=zh?'下载未开始，可手动复制下方记录。':'Download unavailable. Copy the record below.';ui.output.focus?.();ui.output.select?.();}
    finally{if(url){const revoke=url;setTimeout(()=>URL.revokeObjectURL(revoke),1000);}}
  });}
  for(const id of['btn-settings','btn-map-audio-settings','btn-lang','btn-modal-lang','btn-map-modal-lang','ranked-language'])driveDoc?.getElementById?.(id)?.addEventListener('click',renderDriveTools);
  driveDoc?.getElementById?.('drive-problem-tools')?.addEventListener('toggle',renderDriveTools);
  const clearDriveUi=()=>{for(const ui of Object.values(driveUi)){ui.token++;ui.output.value='';ui.output.hidden=true;ui.status.textContent='';}};
  driveDoc?.getElementById?.('audio-settings')?.addEventListener('close',clearDriveUi);
  for(const id of['btn-crash-respawn','btn-crash-switch-map'])driveDoc?.getElementById?.(id)?.addEventListener('click',clearDriveUi);
  window.RoadsterDriveDiagnostics=Object.freeze({snapshot:driveSnapshot,brief:()=>briefDriveReport(driveSnapshot()),render:renderDriveTools,stats:()=>({capacity:DRIVE_CAPACITY,storedFrames:driveCount,bytes:DRIVE_CAPACITY*12*8})});
  renderDriveTools();

  const sceneBefore = scene.onBeforeRender, sceneAfter = scene.onAfterRender;
  scene.onBeforeRender = function (...args) {
    frame.started++; frame.lastStartedAt = now();
    const result = typeof sceneBefore === 'function' ? sceneBefore.apply(this, args) : undefined;
    for (const { car } of nearby().selected) for (const child of (car.mesh.children || []).slice(0, CHILD_LIMIT)) observe(child);
    return result;
  };
  scene.onAfterRender = function (...args) {
    frame.finished++; frame.lastFinishedFrame = frame.started; frame.lastFinishedAt = now();
    const result=typeof sceneAfter === 'function' ? sceneAfter.apply(this, args) : undefined;
    try{sampleDriveFrame();}catch(_){} // Observing game state cannot break a render callback.
    return result;
  };
  const canvas = renderer.domElement;
  canvas?.addEventListener?.('webglcontextlost', () => { contextEvents.lost++; contextEvents.lastLostAt = now(); });
  canvas?.addEventListener?.('webglcontextrestored', () => { contextEvents.restored++; contextEvents.lastRestoredAt = now(); });
  const registered = typeof window.RoadsterCityDiagnostics?.setRuntimeReader === 'function';
  if (registered) window.RoadsterCityDiagnostics.setRuntimeReader(read);
  window.RoadsterRenderDiagnostics = Object.freeze({ snapshot: () => read({ phase: 'live' }), read, registered });
})();
