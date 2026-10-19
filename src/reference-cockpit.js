// Reference-photo cabin and independent, persisted vehicle presentation choices.
// The established camera, live instrument texture, physics and wheel animation
// remain shared. The classic exterior and complete classic cockpit stay intact.
(() => {
  const referenceExterior = buildReferenceRoadsterExterior();
  // The builder exposes live integration handles. Object3D.clone serializes
  // userData, so strip graph/material references before any studio cloning;
  // geometry and materials must stay shared rather than serialized four times.
  for (const key of ['parts','canopy','rails','frontLights','rearLights','activeWing','materials']) delete referenceExterior.userData[key];
  const classicExterior = new THREE.Group();
  classicExterior.name = 'classic-roadster-exterior';
  const oldWingParts = activeWingGroup.children.slice();
  const oldRearJetParts = rearNozzlesGimbalGroup.children.filter(part => !rearPlumes.includes(part));
  const referenceJets = new THREE.Group();
  referenceJets.name = 'reference-four-rear-jets';
  const jetMetal = new THREE.MeshStandardMaterial({color:0xa3a8aa,metalness:.91,roughness:.26});
  const jetInner = new THREE.MeshStandardMaterial({color:0x101315,metalness:.24,roughness:.64});
  for (const x of [-.45,-.15,.15,.45]) {
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(.094,.065,.15,32,1,true).rotateX(Math.PI/2),jetMetal);
    sleeve.position.set(x,0,.065);
    const lip = new THREE.Mesh(new THREE.RingGeometry(.080,.096,40),jetMetal);
    lip.position.set(x,0,.142);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(.079,.060,.11,32,1,true).rotateX(Math.PI/2),jetInner);
    inner.position.set(x,0,.074);
    const back = new THREE.Mesh(new THREE.CircleGeometry(.063,32),jetInner);
    back.position.set(x,0,.015);
    referenceJets.add(sleeve,lip,inner,back);
  }
  rearNozzlesGimbalGroup.add(referenceJets);
  const referenceWing = referenceExterior.getObjectByName('reference-active-wing');
  if (referenceWing) activeWingGroup.add(referenceWing);

  const ambientPipes = carMeshGroup.children.filter(part => part.material === ambientLightMat);
  const classicInteriorParts = [seatBack, dashCowling, consoleTunnel, gearStrip, hazardBtn, steeringColumn, dashPipe, ...ambientPipes];
  const sharedParts = new Set([
    ...classicInteriorParts, screenBezel, screenDisplay, hudCombinerMesh, yokeWheelGroup, fpvDashboardGroup,
    ...wheels.map(wheel => wheel.parent), activeWingGroup, rearNozzlesGimbalGroup,
    headlightSpotL, headlightSpotR, headlightTargetL, headlightTargetR,
    ...rearPlumes, ...liftPlumes, ...descendPlumes, ...frontRetroNozzles, ...frontRetroPlumes,
    ...Object.values(rcsPlumes), sonicBoomConeGroup
  ]);
  carMeshGroup.children.slice().forEach(part => { if (!sharedParts.has(part)) classicExterior.add(part); });
  carMeshGroup.add(classicExterior, referenceExterior);

  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x111518, metalness: .12, roughness: .72 });
  const softMat = new THREE.MeshStandardMaterial({ color: 0x24282a, metalness: .03, roughness: .84 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xc6ccce, metalness: .68, roughness: .28 });
  const referenceCabin = new THREE.Group();
  referenceCabin.name = 'reference-cockpit';
  const referenceYoke = new THREE.Group();
  referenceYoke.name = 'reference-yoke';
  const oldYokeParts = yokeWheelGroup.children.slice();
  const mesh = (geo, mat, name) => { const part = new THREE.Mesh(geo, mat); part.name = name; return part; };
  // A padded squared U, with bright side rails and a broad, unlit central pad.
  const railCurve = new THREE.CatmullRomCurve3([
    [-.116,.071,.016], [-.157,.077,.016], [-.169,.045,.016], [-.168,-.050,.016],
    [-.145,-.073,.016], [0,-.077,.016], [.145,-.073,.016], [.168,-.050,.016],
    [.169,.045,.016], [.157,.077,.016], [.116,.071,.016]
  ].map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const grip = mesh(new THREE.TubeGeometry(railCurve, 72, .015, 10, false), cabinMat, 'reference-yoke-padded-rim');
  const rim = mesh(new THREE.TubeGeometry(railCurve, 72, .0055, 8, false), trimMat, 'reference-yoke-silver-rim');
  rim.position.z = .014;
  const hub = mesh(new THREE.BoxGeometry(.178,.072,.035), cabinMat, 'reference-yoke-horn-pad');
  hub.position.set(0,-.003,.012);
  const spoke = mesh(new THREE.BoxGeometry(.272,.022,.023), softMat, 'reference-yoke-cross-spoke');
  spoke.position.set(0,-.025,.006);
  referenceYoke.add(grip, rim, hub, spoke);
  [-1,1].forEach(side => {
    const button = mesh(new THREE.BoxGeometry(.014,.007,.004), trimMat, 'reference-yoke-thumb-control');
    button.position.set(side*.119,.013,.030);
    referenceYoke.add(button);
  });
  const badge = mesh(new THREE.BoxGeometry(.023,.003,.003), trimMat, 'reference-yoke-center-badge');
  badge.position.set(0,.011,.031);
  referenceYoke.add(badge);
  yokeWheelGroup.add(referenceYoke);

  // Actual sculpted dashboard surfaces, rather than a HUD pasted over the road.
  // The shallow top lip stays below the established 65%-of-view road boundary.
  const dashboardGeometry = new THREE.BoxGeometry(1,1,.12,32,4,1);
  const dashVertices = dashboardGeometry.attributes.position;
  for (let i=0; i<dashVertices.count; i++) {
    const x = dashVertices.getX(i);
    dashVertices.setZ(i,dashVertices.getZ(i)+.12*x*x);
  }
  dashboardGeometry.computeVertexNormals();
  const dashFace = mesh(dashboardGeometry, cabinMat, 'reference-dash-fascia');
  const dashTop = mesh(new THREE.BoxGeometry(1,.014,.17), softMat, 'reference-dash-soft-upper');
  const dashAccent = mesh(new THREE.BoxGeometry(1,.004,.008), trimMat, 'reference-dash-satin-seam');
  const screenCradle = mesh(new THREE.BoxGeometry(.40,.25,.012), cabinMat, 'reference-center-screen-cradle');
  const referenceMount = fpvColumnMount.clone();
  referenceMount.material = cabinMat; referenceMount.name = 'reference-column-mount';
  const referenceColumn = fpvSteeringColumn.clone();
  referenceColumn.material = cabinMat; referenceColumn.name = 'reference-steering-column';
  referenceCabin.add(dashFace,dashTop,dashAccent,screenCradle,referenceMount,referenceColumn);
  const referenceConsole = mesh(new THREE.BoxGeometry(.26,.17,.68), cabinMat, 'reference-console');
  referenceConsole.position.set(.13,.41,-.23);
  referenceConsole.rotation.x = -.13;
  const driveStrip = mesh(new THREE.BoxGeometry(.034,.005,.22), trimMat, 'reference-console-drive-strip');
  driveStrip.position.set(.13,.502,-.39);
  driveStrip.rotation.x = -.13;
  const referenceSeats = new THREE.Group();
  [-.38,.38].forEach(x => {
    const back = mesh(new THREE.BoxGeometry(.39,.47,.105), softMat, 'reference-seat-back');
    back.position.set(x,.56,.43); back.rotation.x = -.20;
    const head = mesh(new THREE.BoxGeometry(.23,.16,.095), cabinMat, 'reference-seat-headrest');
    head.position.set(x,.87,.48); head.rotation.x = -.20;
    referenceSeats.add(back, head);
  });
  const referenceInterior = new THREE.Group();
  referenceInterior.name = 'reference-interior';
  referenceInterior.add(referenceConsole,driveStrip,referenceSeats);
  carMeshGroup.add(referenceCabin,referenceInterior);

  let model = 'reference', cockpit = 'reference';
  try {
    const storedModel = localStorage.getItem('roadster-exterior-model');
    const storedCockpit = localStorage.getItem('roadster-cockpit-model');
    if (storedModel === 'classic') model = storedModel;
    if (storedCockpit === 'classic') cockpit = storedCockpit;
  } catch (_) {}
  const valid = id => id === 'reference' || id === 'classic';
  const baseResize = resizeCockpitDisplay;
  const basePerspective = setCockpitPerspective;
  const baseExteriorDetails = setCockpitExteriorDetailsVisible;
  function resizeReferenceCabin() {
    if (!cockpitPerspectiveActive || cockpit !== 'reference') return;
    // Use the proven responsive projection and clearances of the original pod.
    dashFace.position.copy(fpvDashFascia.position);
    dashFace.rotation.copy(fpvDashFascia.rotation);
    dashFace.scale.copy(fpvDashFascia.scale);
    dashTop.position.copy(fpvDashLedge.position);
    dashTop.rotation.copy(fpvDashLedge.rotation);
    dashTop.scale.copy(fpvDashLedge.scale);
    dashAccent.position.copy(fpvDashTrim.position);
    dashAccent.rotation.copy(fpvDashTrim.rotation);
    dashAccent.scale.copy(fpvDashTrim.scale);
    screenCradle.position.copy(screenBezel.position);
    screenCradle.rotation.copy(screenBezel.rotation);
    screenCradle.scale.set(screenBezel.scale.x*1.02,screenBezel.scale.y*.92,.5);
    screenCradle.position.z -= .002;
    referenceMount.position.copy(fpvColumnMount.position);
    referenceMount.rotation.copy(fpvColumnMount.rotation);
    referenceMount.scale.copy(fpvColumnMount.scale);
    referenceColumn.position.copy(fpvSteeringColumn.position);
    referenceColumn.rotation.copy(fpvSteeringColumn.rotation);
    referenceColumn.scale.copy(fpvSteeringColumn.scale);
  }
  function syncView(active = cockpitPerspectiveActive) {
    classicExterior.visible = model === 'classic';
    referenceExterior.visible = model === 'reference';
    const canopy = referenceExterior.getObjectByName('reference-canopy');
    const rails = referenceExterior.getObjectByName('reference-canopy-rails');
    const frontLights = referenceExterior.getObjectByName('reference-front-lights');
    if (canopy) canopy.visible = !active;
    if (rails) rails.visible = !active;
    if (frontLights) frontLights.visible = !active;
    // The sculpted high fender crowns sit at the very bottom of a driver view.
    // Omit just these two external panels in FPV so the complete upper 65% of
    // the road stays clear; restore their exact geometry in every outside view.
    for (const name of ['referenceShoulder-1','referenceShoulder1']) {
      const shoulder = referenceExterior.getObjectByName(name);
      if (shoulder) shoulder.visible = !active;
    }
    oldWingParts.forEach(part => { part.visible = model === 'classic'; });
    oldRearJetParts.forEach(part => { part.visible = model === 'classic'; });
    referenceJets.visible = model === 'reference';
    if (referenceWing) referenceWing.visible = model === 'reference';
    oldYokeParts.forEach(part => { part.visible = cockpit === 'classic'; });
    referenceYoke.visible = cockpit === 'reference';
    if (!active) yokeWheelGroup.position.x = cockpit === 'reference' ? -.34 : 0;
    classicInteriorParts.forEach(part => { part.visible = cockpit === 'classic'; });
    if (cockpit === 'classic') {
      dashCowling.visible = steeringColumn.visible = dashPipe.visible = !active;
    }
    fpvDashboardGroup.visible = active && cockpit === 'classic';
    referenceCabin.visible = active && cockpit === 'reference';
    referenceInterior.visible = cockpit === 'reference' && !active;
    resizeReferenceCabin();
  }
  resizeCockpitDisplay = function () { baseResize(); resizeReferenceCabin(); };
  setCockpitPerspective = function (active) { basePerspective(active); syncView(active); };
  setCockpitExteriorDetailsVisible = function (visible) { baseExteriorDetails(visible); syncView(!visible); };
  window.addEventListener('resize', resizeReferenceCabin);
  function choose(kind, id) {
    if (!valid(id)) return false;
    if (kind === 'model') model = id; else cockpit = id;
    try { localStorage.setItem(kind === 'model' ? 'roadster-exterior-model' : 'roadster-cockpit-model', id); } catch (_) {}
    syncView();
    window.dispatchEvent(new Event('roadster-vehicle-change'));
    return true;
  }
  // Capture each launch configuration at its neutral exterior pose before any
  // driving/camera animation. Studio previews never inherit an FPV-hidden
  // canopy, enlarged driver wheel, active jet plume or turned/rotating wheel.
  const previewSources = new Map();
  const selectedModel = model, selectedCockpit = cockpit;
  for (const exteriorId of ['reference','classic']) for (const cockpitId of ['reference','classic']) {
    model = exteriorId; cockpit = cockpitId; syncView(false);
    previewSources.set(`${model}:${cockpit}`,carMeshGroup.clone(true));
  }
  model = selectedModel; cockpit = selectedCockpit;
  window.RoadsterVehicle = {
    getModel: () => model, getCockpit: () => cockpit,
    setModel: id => choose('model',id), setCockpit: id => choose('cockpit',id),
    getPreviewModel: () => previewSources.get(`${model}:${cockpit}`),
    syncView
  };
  syncView(false);
})();
