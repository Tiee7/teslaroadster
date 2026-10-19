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
  const jetInner = new THREE.MeshStandardMaterial({color:0x34383a,metalness:.58,roughness:.40});
  for (const x of [-.45,-.15,.15,.45]) {
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(.080,.051,.170,48,1,true).rotateX(Math.PI/2),jetMetal);
    sleeve.position.set(x,-.060,-.048);
    const lip = new THREE.Mesh(new THREE.RingGeometry(.067,.081,48),jetMetal);
    lip.position.set(x,-.060,.037);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(.067,.043,.142,48,1,true).rotateX(Math.PI/2),jetInner);
    inner.position.set(x,-.060,-.036);
    const back = new THREE.Mesh(new THREE.CircleGeometry(.055,48),jetInner);
    back.position.set(x,-.060,-.122);
    sleeve.name = `reference-jet-sleeve-${x}`; lip.name = `reference-jet-flush-lip-${x}`;
    inner.name = `reference-jet-inner-${x}`; back.name = `reference-jet-back-${x}`;
    referenceJets.add(sleeve,lip,inner,back);
  }
  rearNozzlesGimbalGroup.add(referenceJets);
  // Preserve every classic wheel, axle and animation handle. The new model has
  // rounded tire shoulders, open twin swept spokes and inset red aero blades.
  const classicWheelParts = wheels.map(wheel => wheel.children.slice());
  const referenceWheelParts = [];
  const rubber = new THREE.MeshStandardMaterial({color:0x151719,roughness:.82,metalness:.03});
  const wheelAlloy = new THREE.MeshStandardMaterial({color:0xc9ced0,roughness:.24,metalness:.88});
  const wheelGraphite = new THREE.MeshStandardMaterial({color:0x202326,roughness:.32,metalness:.65});
  const wheelAeroRed = new THREE.MeshStandardMaterial({color:0xb91d24,roughness:.29,metalness:.48});
  const wheelFace = (name, points, mat, parent, side) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
    const ids=[]; for(let i=1;i<points.length-1;i++) ids.push(...(side>0?[0,i,i+1]:[0,i+1,i]));
    geo.setIndex(ids); geo.computeVertexNormals();
    const part = new THREE.Mesh(geo,mat);part.name=name;parent.add(part);return part;
  };
  // All wheel detail is static inside the existing spin/steer group. Concatenate
  // its original indexed triangles by material; never weld or rebuild normals.
  // The deliberately small scene-graph test fixture has no matrix/attribute
  // implementation, so leave its source meshes intact rather than fake a batch.
  const batchReferenceWheel = (group, wheelIndex) => {
    if (typeof THREE.Matrix3?.prototype.getNormalMatrix !== 'function' ||
        typeof THREE.BufferGeometry?.prototype.applyMatrix4 !== 'function') return;
    const byMaterial = new Map();
    group.children.forEach(part => {
      const parts = byMaterial.get(part.material) || [];
      parts.push(part);byMaterial.set(part.material,parts);
    });
    for (const [material,parts] of byMaterial) {
      const geometry = new THREE.BufferGeometry(), indices = [];
      const attributes = new Map();let vertexCount = 0;
      parts.forEach(part => {
        part.updateMatrix();vertexCount += part.geometry.attributes.position.count;
        Object.entries(part.geometry.attributes).forEach(([name,attribute]) => {
          if (!attributes.has(name)) attributes.set(name,attribute);
        });
      });
      const arrays = new Map([...attributes].map(([name,attribute]) =>
        [name,new attribute.array.constructor(vertexCount*attribute.itemSize)]));
      let vertexOffset = 0;
      parts.forEach(part => {
        const source = part.geometry,p = source.attributes.position;
        const translatedOnly = part.rotation.x===0 && part.rotation.y===0 && part.rotation.z===0 &&
          part.scale.x===1 && part.scale.y===1 && part.scale.z===1;
        const normalMatrix = translatedOnly ? null : new THREE.Matrix3().getNormalMatrix(part.matrix);
        for (const [name,attribute] of Object.entries(source.attributes)) {
          const target = arrays.get(name),offset = vertexOffset*attribute.itemSize;
          // UVs, and the existing normals on these translation-only parts, are
          // copied bit for bit. Unused UV slots on untextured faces stay zero.
          target.set(attribute.array,offset);
          if (name==='position' || (name==='normal' && normalMatrix)) {
            const v = new THREE.Vector3();
            for (let j=0;j<attribute.count;j++) {
              v.fromBufferAttribute(attribute,j);
              if (name==='position') v.applyMatrix4(part.matrix);else v.applyNormalMatrix(normalMatrix);
              target[offset+j*3]=v.x;target[offset+j*3+1]=v.y;target[offset+j*3+2]=v.z;
            }
          }
        }
        const sourceIndices = source.index?.array;
        for (let j=0;j<(sourceIndices?.length ?? p.count);j++) indices.push(vertexOffset+(sourceIndices ? sourceIndices[j] : j));
        vertexOffset += p.count;
      });
      for (const [name,attribute] of attributes) geometry.setAttribute(name,
        new THREE.BufferAttribute(arrays.get(name),attribute.itemSize,attribute.normalized));
      geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();
      const batch = new THREE.Mesh(geometry,material);
      const label = material===rubber ? 'rubber' : material===wheelAlloy ? 'alloy' : material===wheelGraphite ? 'graphite' : 'red';
      batch.name = label==='rubber' ? `reference-rounded-tire-${wheelIndex}` : `reference-wheel-${label}-batch-${wheelIndex}`;
      batch.userData.referenceWheelBatch = {material:label,sourceMeshes:parts.length};
      parts.forEach(part => group.remove(part));group.add(batch);
    }
  };
  wheels.forEach((wheel,i)=>{
    const ws=wheelSpecs[i],side=ws.x>0?1:-1,r=ws.radius,half=ws.width/2;
    const group=new THREE.Group();group.name=`reference-wheel-${i}`;
    const tireProfile = [[.77,-1],[.88,-1.01],[.95,-.84],[.994,-.56],[1,-.32],[1,.32],[.994,.56],[.95,.84],[.88,1.01],[.77,1]].map(([radius,width])=>new THREE.Vector2(radius*r,width*half));
    const tire=new THREE.Mesh(new THREE.LatheGeometry(tireProfile,48).rotateZ(Math.PI/2),rubber);
    tire.name=`reference-rounded-tire-${i}`;group.add(tire);
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.775*r,.775*r,ws.width*.90,48,1,true).rotateZ(Math.PI/2),wheelGraphite);group.add(barrel);
    for(const radius of [.785,.745]) {
      const lip=new THREE.Mesh(new THREE.TorusGeometry(radius*r,.0055,4,48).rotateY(Math.PI/2),wheelAlloy);
      lip.position.x=side*(half+.001);group.add(lip);
    }
    // Recessed aero inserts leave real dark gaps through to the brake rotor.
    const point=(angle,radius,depth)=>[side*depth,Math.cos(angle)*radius*r,Math.sin(angle)*radius*r];
    for(let k=0;k<5;k++) {
      const a=k*Math.PI*2/5+.13;
      wheelFace(`reference-red-aero-${i}-${k}`,[point(a+.35,.26,half-.012),point(a+.42,.71,half-.014),point(a+.91,.71,half-.014),point(a+.85,.26,half-.012)],wheelAeroRed,group,side);
      for(const offset of [0,.15]) {
        const angle=a+offset;
        const p=[point(angle-.06,.18,half+.010),point(angle+.11,.75,half+.001),point(angle+.18,.76,half+.001),point(angle+.04,.18,half+.010)];
        wheelFace(`reference-swept-spoke-${i}-${k}-${offset}`,p,wheelAlloy,group,side);
        // A physical inner side gives the spokes depth from oblique angles.
        wheelFace(`reference-spoke-depth-${i}-${k}-${offset}`,[p[0],p[1],[p[1][0]-side*.020,p[1][1],p[1][2]],[p[0][0]-side*.020,p[0][1],p[0][2]]],wheelGraphite,group,side);
      }
    }
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.012,32).rotateZ(Math.PI/2),wheelGraphite);cap.position.x=side*(half+.011);group.add(cap);
    for(let k=0;k<5;k++) {
      const a=k*Math.PI*2/5;
      const lug=new THREE.Mesh(new THREE.CylinderGeometry(.0065,.0065,.009,6).rotateZ(Math.PI/2),wheelAlloy);
      lug.position.set(side*(half+.019),Math.cos(a)*.030,Math.sin(a)*.030);group.add(lug);
    }
    // Shallow circumferential relief stays inside the tread silhouette.
    for(const width of [-.36,.36]) {
      const groove=new THREE.Mesh(new THREE.TorusGeometry(r-.001,.0022,3,48).rotateY(Math.PI/2),wheelGraphite);groove.position.x=width*ws.width;group.add(groove);
    }
    batchReferenceWheel(group,i);
    wheel.add(group);referenceWheelParts.push(group);
  });

  const referenceWing = referenceExterior.getObjectByName('reference-active-wing');
  if (referenceWing) activeWingGroup.add(referenceWing);

  const ambientPipes = carMeshGroup.children.filter(part => part.material === ambientLightMat);
  const classicInteriorParts = [seatBack, dashCowling, consoleTunnel, gearStrip, hazardBtn, steeringColumn, dashPipe, ...ambientPipes];
  // The responsive FPV pod is projection-sized for readable telemetry. Its old
  // exterior pose pierced the raked windshield. Give outside/studio views a
  // separate, fixed-size physical screen mounted in the cabin instead; both
  // displays share the same live texture, without duplicating telemetry state.
  screenBezel.name = 'fpv-instrument-bezel';
  screenDisplay.name = 'fpv-live-instruments';
  const interiorScreen = new THREE.Group();
  interiorScreen.name = 'interior-center-screen';
  interiorScreen.position.set(0,.725,-.64);
  interiorScreen.rotation.x = -.26;
  const interiorScreenBezel = new THREE.Mesh(new THREE.BoxGeometry(.38,.16,.016), cockpitMat);
  interiorScreenBezel.name = 'interior-screen-housing';
  interiorScreenBezel.position.z = -.010;
  const interiorScreenDisplay = new THREE.Mesh(new THREE.PlaneGeometry(.36,.140625), screenGlowMat);
  interiorScreenDisplay.name = 'interior-live-instruments';
  interiorScreen.add(interiorScreenBezel,interiorScreenDisplay);
  carMeshGroup.add(interiorScreen);
  const sharedParts = new Set([
    ...classicInteriorParts, screenBezel, screenDisplay, interiorScreen, hudCombinerMesh, yokeWheelGroup, fpvDashboardGroup,
    ...wheels.map(wheel => wheel.parent), activeWingGroup, rearNozzlesGimbalGroup,
    headlightSpotL, headlightSpotR, headlightTargetL, headlightTargetR,
    ...rearPlumes, ...liftPlumes, ...descendPlumes, ...frontRetroNozzles, ...frontRetroPlumes,
    ...Object.values(rcsPlumes), sonicBoomConeGroup, coldGasNozzlesGroup
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
    // Reapply the selected driver offset after the base exterior resize.
    if (!cockpitPerspectiveActive) {
      yokeWheelGroup.position.x = cockpit === 'reference' ? -.34 : 0;
      return;
    }
    if (cockpit !== 'reference') return;
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
  // Camera synchronization is called twice by the frame loop. Cache the stable
  // handles once and only apply configuration/view changes when they change.
  const referenceCanopy = referenceExterior.getObjectByName('reference-canopy');
  const referenceRails = referenceExterior.getObjectByName('reference-canopy-rails');
  const referenceFrontLights = referenceExterior.getObjectByName('reference-front-lights');
  const referenceShoulders = [-1,1].flatMap(side => [
    `referenceShoulder${side}`, `referenceLampShoulderBridge${side}`,
    `referenceFrontWingInnerReturn${side}`, `referenceFrontWingRearReturn${side}`
  ]).map(name => referenceExterior.getObjectByName(name));
  let appliedView = null;
  let appliedExteriorDetails = null;
  function syncView(active = cockpitPerspectiveActive) {
    const view = `${model}:${cockpit}:${Boolean(active)}`;
    if (appliedView === view) return;
    appliedView = view;
    classicExterior.visible = model === 'classic';
    referenceExterior.visible = model === 'reference';
    if (referenceCanopy) referenceCanopy.visible = !active;
    if (referenceRails) referenceRails.visible = !active;
    if (referenceFrontLights) referenceFrontLights.visible = !active;
    // The sculpted high fender crowns sit at the very bottom of a driver view.
    // Omit just these two external panels in FPV so the complete upper 65% of
    // the road stays clear; restore their exact geometry in every outside view.
    referenceShoulders.forEach(shoulder => { if (shoulder) shoulder.visible = !active; });
    oldWingParts.forEach(part => { part.visible = model === 'classic'; });
    oldRearJetParts.forEach(part => { part.visible = model === 'classic'; });
    referenceJets.visible = model === 'reference';
    // Each body uses its actual outlet mouths, including the shallower reference
    // rear sleeves. The small unlit auxiliary rims remain shared by both bodies.
    frontRetroNozzles.forEach(part => { part.visible = true; });
    configureThrusterLayout(model);
    classicWheelParts.forEach(parts => parts.forEach(part => { part.visible = model === 'classic'; }));
    referenceWheelParts.forEach(part => { part.visible = model === 'reference'; });
    if (referenceWing) referenceWing.visible = model === 'reference';
    screenBezel.visible = screenDisplay.visible = active;
    interiorScreen.visible = !active;
    // The revised reference windshield is a lower raked plane; its physical
    // screen mounts 20mm lower. The classic body and readable FPV pod stay put.
    interiorScreen.position.y = model === 'reference' ? .705 : .725;
    // The obsolete translucent combiner is already disabled by the frame loop;
    // keep canonical previews consistent, including before the first frame.
    hudCombinerMesh.visible = false;
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
  setCockpitExteriorDetailsVisible = function (visible) {
    if (appliedExteriorDetails !== visible) {
      appliedExteriorDetails = visible;
      baseExteriorDetails(visible);
    }
    syncView(!visible);
  };
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
    const source = carMeshGroup.clone(true);
    source.traverse(part => { if (part.userData.shadowProxy) part.visible = false; });
    previewSources.set(`${model}:${cockpit}`,source);
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
