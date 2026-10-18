// =========================================================================
// 4. PLAYER VEHICLE: TRUE 2026 TESLA ROADSTER CYBER-WEDGE MODEL (V8)
//    Rebuilt 1:1 from user reference photos (image_ed309d, ed30b9, ed8256)
// =========================================================================
const playerWrapper = new THREE.Group();
playerWrapper.position.set(2.5, 0, 0);
scene.add(playerWrapper);

const roadsterAttitudeGroup = new THREE.Group();
roadsterAttitudeGroup.rotation.order = 'YXZ';
playerWrapper.add(roadsterAttitudeGroup);

const carMeshGroup = new THREE.Group();
roadsterAttitudeGroup.add(carMeshGroup);

function lerpVal(a, b, t) {
  return a + (b - a) * t;
}

function hermiteInterp(a, b, t) {
  const f = t * t * (3 - 2 * t);
  return a + (b - a) * f;
}

function sampleStationLinear(stations, z) {
  if (z <= stations[0].z) return stations[0];
  if (z >= stations[stations.length - 1].z) return stations[stations.length - 1];
  for (let i = 0; i < stations.length - 1; i++) {
    const s0 = stations[i];
    const s1 = stations[i + 1];
    if (z >= s0.z && z <= s1.z) {
      const t = (z - s0.z) / Math.max(1e-6, s1.z - s0.z);
      const out = {};
      for (const k of Object.keys(s0)) {
        out[k] = lerpVal(s0[k], s1[k], t);
      }
      return out;
    }
  }
  return stations[0];
}

function sampleStationProfile(stations, z) {
  if (z <= stations[0].z) return stations[0];
  if (z >= stations[stations.length - 1].z) return stations[stations.length - 1];
  for (let i = 0; i < stations.length - 1; i++) {
    const s0 = stations[i];
    const s1 = stations[i + 1];
    if (z >= s0.z && z <= s1.z) {
      const t = (z - s0.z) / Math.max(1e-6, s1.z - s0.z);
      const out = {};
      for (const k of Object.keys(s0)) {
        out[k] = hermiteInterp(s0[k], s1[k], t);
      }
      return out;
    }
  }
  return stations[0];
}

const FRONT_Z = -1.36, FRONT_Y = 0.32, FRONT_R = 0.32;
const REAR_Z  =  1.38, REAR_Y  = 0.35, REAR_R  = 0.35;

function wheelArchOpeningY(z) {
  const df = Math.abs(z - FRONT_Z);
  const dr = Math.abs(z - REAR_Z);
  if (df < 0.38) return 0.14 + Math.sqrt(Math.max(0, 0.38 * 0.38 - df * df)) * 1.05;
  if (dr < 0.40) return 0.15 + Math.sqrt(Math.max(0, 0.40 * 0.40 - dr * dr)) * 1.06;
  return 0.0;
}

function createSmoothGridGeometry(gridRows) {
  const nz = gridRows.length - 1;
  const nu = gridRows[0].length - 1;
  const positions = [];
  const indices = [];
  for (let iz = 0; iz <= nz; iz++) {
    for (let iu = 0; iu <= nu; iu++) {
      const p = gridRows[iz][iu];
      positions.push(p[0], p[1], p[2]);
    }
  }
  const stride = nu + 1;
  for (let iz = 0; iz < nz; iz++) {
    for (let iu = 0; iu < nu; iu++) {
      const a = iz * stride + iu;
      const b = a + 1;
      const c = (iz + 1) * stride + iu;
      const d = c + 1;
      indices.push(a, c, d);
      indices.push(a, d, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createQuadMesh(p0, p1, p2, p3, mat) {
  const geo = new THREE.BufferGeometry();
  const verts = new Float32Array([
    p0[0], p0[1], p0[2],
    p1[0], p1[1], p1[2],
    p2[0], p2[1], p2[2],
    p3[0], p3[1], p3[2]
  ]);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

// 1) Faceted Cyber-Wedge Body Shell (Exact match to image_ed309d, image_ed30b9, image_ed8256)
// 1) 2026 Tesla Roadster SpaceX Rocket - 20-Station Catmull-Rom Sculpted Topology (V12)
const cyberWedgeStations = [
  { z: -2.36, hoodW: 0.50, centerY: 0.38, hoodValleyY: 0.37, hoodEdgeY: 0.37, pocketX: 0.52, pocketY: 0.37, fenderPeakX: 0.64, fenderPeakY: 0.39, shoulderX: 0.78, shoulderY: 0.32, flankX: 0.82, flankY: 0.19, rockerY: 0.15 },
  { z: -2.28, hoodW: 0.53, centerY: 0.40, hoodValleyY: 0.39, hoodEdgeY: 0.39, pocketX: 0.56, pocketY: 0.40, fenderPeakX: 0.68, fenderPeakY: 0.42, shoulderX: 0.84, shoulderY: 0.34, flankX: 0.88, flankY: 0.21, rockerY: 0.15 },
  { z: -2.18, hoodW: 0.56, centerY: 0.44, hoodValleyY: 0.42, hoodEdgeY: 0.43, pocketX: 0.60, pocketY: 0.44, fenderPeakX: 0.74, fenderPeakY: 0.48, shoulderX: 0.90, shoulderY: 0.40, flankX: 0.94, flankY: 0.26, rockerY: 0.15 },
  { z: -2.04, hoodW: 0.58, centerY: 0.48, hoodValleyY: 0.46, hoodEdgeY: 0.47, pocketX: 0.66, pocketY: 0.48, fenderPeakX: 0.80, fenderPeakY: 0.56, shoulderX: 0.94, shoulderY: 0.49, flankX: 0.97, flankY: 0.30, rockerY: 0.16 },
  { z: -1.86, hoodW: 0.60, centerY: 0.53, hoodValleyY: 0.50, hoodEdgeY: 0.52, pocketX: 0.70, pocketY: 0.55, fenderPeakX: 0.84, fenderPeakY: 0.64, shoulderX: 0.97, shoulderY: 0.59, flankX: 1.00, flankY: 0.38, rockerY: 0.16 },
  { z: -1.65, hoodW: 0.62, centerY: 0.58, hoodValleyY: 0.54, hoodEdgeY: 0.57, pocketX: 0.73, pocketY: 0.62, fenderPeakX: 0.87, fenderPeakY: 0.70, shoulderX: 0.99, shoulderY: 0.65, flankX: 1.02, flankY: 0.45, rockerY: 0.16 },
  { z: -1.48, hoodW: 0.63, centerY: 0.62, hoodValleyY: 0.58, hoodEdgeY: 0.61, pocketX: 0.74, pocketY: 0.66, fenderPeakX: 0.88, fenderPeakY: 0.74, shoulderX: 0.99, shoulderY: 0.69, flankX: 1.02, flankY: 0.49, rockerY: 0.16 },
  { z: -1.36, hoodW: 0.64, centerY: 0.64, hoodValleyY: 0.60, hoodEdgeY: 0.63, pocketX: 0.74, pocketY: 0.68, fenderPeakX: 0.88, fenderPeakY: 0.76, shoulderX: 0.99, shoulderY: 0.71, flankX: 1.02, flankY: 0.51, rockerY: 0.16 },
  { z: -1.22, hoodW: 0.65, centerY: 0.65, hoodValleyY: 0.62, hoodEdgeY: 0.65, pocketX: 0.75, pocketY: 0.68, fenderPeakX: 0.87, fenderPeakY: 0.74, shoulderX: 0.98, shoulderY: 0.70, flankX: 1.01, flankY: 0.50, rockerY: 0.16 },
  { z: -0.98, hoodW: 0.66, centerY: 0.66, hoodValleyY: 0.64, hoodEdgeY: 0.66, pocketX: 0.75, pocketY: 0.69, fenderPeakX: 0.86, fenderPeakY: 0.71, shoulderX: 0.96, shoulderY: 0.69, flankX: 0.99, flankY: 0.49, rockerY: 0.17 },
  { z: -0.58, hoodW: 0.64, centerY: 0.68, hoodValleyY: 0.66, hoodEdgeY: 0.68, pocketX: 0.74, pocketY: 0.71, fenderPeakX: 0.85, fenderPeakY: 0.72, shoulderX: 0.95, shoulderY: 0.71, flankX: 0.98, flankY: 0.50, rockerY: 0.19 },
  { z: -0.10, hoodW: 0.59, centerY: 0.71, hoodValleyY: 0.69, hoodEdgeY: 0.71, pocketX: 0.71, pocketY: 0.74, fenderPeakX: 0.84, fenderPeakY: 0.75, shoulderX: 0.94, shoulderY: 0.74, flankX: 0.98, flankY: 0.53, rockerY: 0.22 },
  { z:  0.35, hoodW: 0.52, centerY: 0.74, hoodValleyY: 0.73, hoodEdgeY: 0.74, pocketX: 0.68, pocketY: 0.77, fenderPeakX: 0.83, fenderPeakY: 0.79, shoulderX: 0.96, shoulderY: 0.77, flankX: 0.99, flankY: 0.54, rockerY: 0.24 },
  { z:  0.85, hoodW: 0.43, centerY: 0.79, hoodValleyY: 0.78, hoodEdgeY: 0.79, pocketX: 0.64, pocketY: 0.82, fenderPeakX: 0.83, fenderPeakY: 0.84, shoulderX: 0.97, shoulderY: 0.81, flankX: 1.01, flankY: 0.57, rockerY: 0.27 },
  { z:  1.15, hoodW: 0.38, centerY: 0.82, hoodValleyY: 0.81, hoodEdgeY: 0.82, pocketX: 0.60, pocketY: 0.85, fenderPeakX: 0.83, fenderPeakY: 0.87, shoulderX: 0.98, shoulderY: 0.84, flankX: 1.02, flankY: 0.60, rockerY: 0.29 },
  { z:  1.38, hoodW: 0.34, centerY: 0.83, hoodValleyY: 0.82, hoodEdgeY: 0.83, pocketX: 0.58, pocketY: 0.86, fenderPeakX: 0.82, fenderPeakY: 0.89, shoulderX: 0.98, shoulderY: 0.85, flankX: 1.02, flankY: 0.61, rockerY: 0.30 },
  { z:  1.68, hoodW: 0.30, centerY: 0.85, hoodValleyY: 0.84, hoodEdgeY: 0.85, pocketX: 0.54, pocketY: 0.86, fenderPeakX: 0.79, fenderPeakY: 0.88, shoulderX: 0.96, shoulderY: 0.85, flankX: 0.99, flankY: 0.61, rockerY: 0.32 },
  { z:  1.95, hoodW: 0.27, centerY: 0.85, hoodValleyY: 0.85, hoodEdgeY: 0.85, pocketX: 0.50, pocketY: 0.85, fenderPeakX: 0.75, fenderPeakY: 0.87, shoulderX: 0.93, shoulderY: 0.84, flankX: 0.95, flankY: 0.60, rockerY: 0.33 },
  { z:  2.16, hoodW: 0.25, centerY: 0.85, hoodValleyY: 0.85, hoodEdgeY: 0.85, pocketX: 0.46, pocketY: 0.85, fenderPeakX: 0.70, fenderPeakY: 0.86, shoulderX: 0.88, shoulderY: 0.83, flankX: 0.90, flankY: 0.59, rockerY: 0.34 },
  { z:  2.28, hoodW: 0.24, centerY: 0.84, hoodValleyY: 0.84, hoodEdgeY: 0.84, pocketX: 0.44, pocketY: 0.84, fenderPeakX: 0.66, fenderPeakY: 0.84, shoulderX: 0.85, shoulderY: 0.82, flankX: 0.86, flankY: 0.57, rockerY: 0.34 }
];

function buildCyberWedgeBodyV8() {
  const nz = 160;
  const zMin = -2.32, zMax = 2.26;
  const grid = [];
  for (let iz = 0; iz <= nz; iz++) {
    const z = zMin + (iz / nz) * (zMax - zMin);
    const st = sampleStationProfile(cyberWedgeStations, z);
    const archY = wheelArchOpeningY(z);
    const botY = Math.max(st.rockerY, archY);

    const vY = st.hoodValleyY || (st.centerY * 0.4 + st.hoodEdgeY * 0.6);
    // Recess inner cabin tub floor between z = -0.95 and z = +0.48 so cockpit dash, screen & yoke never intersect the body mesh
    let cabinRecess = 0.0;
    if (z > -0.95 && z < 0.48) {
      const tCab = (z - (-0.95)) / (0.48 - (-0.95));
      cabinRecess = 0.24 * Math.sin(tCab * Math.PI);
    }

    const ptsRight = [
      [0.0, st.centerY - cabinRecess, z],
      [st.hoodW * 0.35, lerpVal(st.centerY, vY, 0.6) - cabinRecess * 0.92, z],
      [st.hoodW * 0.70, lerpVal(vY, st.hoodEdgeY, 0.5) - cabinRecess * 0.65, z],
      [st.hoodW, st.hoodEdgeY, z],
      [st.pocketX, st.pocketY, z],
      [st.fenderPeakX, st.fenderPeakY, z],
      [st.shoulderX * 0.92, lerpVal(st.fenderPeakY, st.shoulderY, 0.5), z],
      [st.shoulderX, st.shoulderY, z],
      [st.flankX, Math.max(botY + 0.04, st.flankY), z],
      [st.flankX * 0.98, Math.max(botY + 0.015, (st.flankY + botY) * 0.5), z],
      [st.flankX * 0.96, botY, z]
    ];
    const ptsLeft = [];
    for (let i = ptsRight.length - 1; i >= 1; i--) {
      ptsLeft.push([-ptsRight[i][0], ptsRight[i][1], ptsRight[i][2]]);
    }
    grid.push(ptsLeft.concat(ptsRight));
  }
  return new THREE.Mesh(createSmoothGridGeometry(grid), bodyMaterial);
}

function buildCyberRockerSkirtV8() {
  const nz = 160;
  const zMin = -2.32, zMax = 2.26;
  const grid = [];
  for (let iz = 0; iz <= nz; iz++) {
    const z = zMin + (iz / nz) * (zMax - zMin);
    const st = sampleStationProfile(cyberWedgeStations, z);
    const archY = wheelArchOpeningY(z);
    const topRy = archY > 0.0 ? archY : st.rockerY;
    const botRy = archY > 0.0 ? archY : 0.12;
    const rx = st.flankX * 0.96;
    grid.push([
      [-rx * 0.95, botRy, z],
      [-rx, topRy, z],
      [0.0, botRy, z],
      [rx, topRy, z],
      [rx * 0.95, botRy, z]
    ]);
  }
  return new THREE.Mesh(createSmoothGridGeometry(grid), carbonMaterial);
}

// 2) Seamless Dark-Bronze Panoramic Canopy + Side Windows + White Roof Arch Rails
const cyberCanopyStations = [
  { z: -1.24, topW: 0.65, botW: 0.68, topY: 0.66, botY: 0.65 },
  { z: -0.84, topW: 0.59, botW: 0.85, topY: 0.92, botY: 0.69 },
  { z: -0.35, topW: 0.52, botW: 0.83, topY: 1.10, botY: 0.73 },
  { z:  0.08, topW: 0.48, botW: 0.81, topY: 1.14, botY: 0.76 },
  { z:  0.55, topW: 0.40, botW: 0.74, topY: 1.07, botY: 0.81 },
  { z:  1.05, topW: 0.31, botW: 0.52, topY: 0.96, botY: 0.86 },
  { z:  1.65, topW: 0.22, botW: 0.24, topY: 0.86, botY: 0.85 }
];

function buildCyberCanopyV8() {
  const nz = 72;
  const zMin = -1.24, zMax = 1.65;
  const grid = [];
  for (let iz = 0; iz <= nz; iz++) {
    const z = zMin + (iz / nz) * (zMax - zMin);
    const st = sampleStationProfile(cyberCanopyStations, z);
    const ptsR = [
      [0.0, st.topY + 0.015, z],
      [st.topW * 0.35, st.topY + 0.012, z],
      [st.topW * 0.70, st.topY + 0.005, z],
      [st.topW, st.topY - 0.01, z],
      [lerpVal(st.topW, st.botW, 0.55), lerpVal(st.topY, st.botY, 0.52), z],
      [st.botW, st.botY, z]
    ];
    const ptsL = [];
    for (let i = ptsR.length - 1; i >= 1; i--) {
      ptsL.push([-ptsR[i][0], ptsR[i][1], ptsR[i][2]]);
    }
    grid.push(ptsL.concat(ptsR));
  }
  return new THREE.Mesh(createSmoothGridGeometry(grid), goldCanopyMaterial);
}

const roadsterBodyMesh = buildCyberWedgeBodyV8();
roadsterBodyMesh.castShadow = true;
roadsterBodyMesh.receiveShadow = true;
carMeshGroup.add(roadsterBodyMesh);

const roadsterRockerMesh = buildCyberRockerSkirtV8();
carMeshGroup.add(roadsterRockerMesh);

const roadsterCanopyMesh = buildCyberCanopyV8();
carMeshGroup.add(roadsterCanopyMesh);

// White Painted A-Pillar & Roof Arch Side Rails (Matches bodyMaterial color!)
[-1, 1].forEach((side) => {
  const railGrid = [];
  const nz = 36;
  for (let iz = 0; iz <= nz; iz++) {
    const z = -1.20 + (iz / nz) * (1.12 - (-1.20));
    const st = sampleStationLinear(cyberCanopyStations, z);
    const rx = side * (st.topW + 0.02);
    const ry = st.topY - 0.005;
    railGrid.push([
      [rx - side * 0.032, ry + 0.008, z],
      [rx + side * 0.032, ry - 0.012, z]
    ]);
  }
  const railMesh = new THREE.Mesh(createSmoothGridGeometry(railGrid), bodyMaterial);
  carMeshGroup.add(railMesh);
});

// =========================================================================
// FULL-FEATURED FIRST-PERSON COCKPIT (FPV) WITH 3D YOKE & LIVE HUD CANVAS

// Live Dynamic CanvasTexture for Center Touchscreen & Fighter HUD Combiner
const cockpitHudCanvas = document.createElement('canvas');
cockpitHudCanvas.width = 512;
cockpitHudCanvas.height = 320;
const cockpitHudCtx = cockpitHudCanvas.getContext('2d');
const cockpitHudTexture = new THREE.CanvasTexture(cockpitHudCanvas);
const screenGlowMat = new THREE.MeshBasicMaterial({
  map: cockpitHudTexture,
  side: THREE.FrontSide,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2
});
const hudGlassMat = new THREE.MeshBasicMaterial({
  map: cockpitHudTexture,
  transparent: true,
  opacity: 0.88,
  side: THREE.DoubleSide
});

const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.52, 0.10), cockpitMat);
seatBack.position.set(0, 0.58, 0.38);
seatBack.rotation.x = -0.22;

// Wrap-around Carbon Fighter Cockpit Dashboard Cowling
const dashCowling = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.11, 0.44), carbonMaterial);
dashCowling.position.set(0, 0.62, -0.78);
dashCowling.rotation.x = 0.12;

// Center Console Tunnel, Capacitive P-R-N-D Drive Strip & Hazard Flasher
const consoleTunnel = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.72), carbonMaterial);
consoleTunnel.position.set(0, 0.38, -0.22);
consoleTunnel.rotation.x = -0.15;
const gearStripMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
const gearStrip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.006, 0.16), gearStripMat);
gearStrip.position.set(0, 0.495, -0.42);
gearStrip.rotation.x = -0.15;
const hazardBtnMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
const hazardBtn = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.008, 0.022), hazardBtnMat);
hazardBtn.position.set(0, 0.505, -0.52);
hazardBtn.rotation.x = -0.15;
carMeshGroup.add(consoleTunnel, gearStrip, hazardBtn);

// Center Console Tilted Touchscreen Display (offset cleanly from bezel to prevent Z-fighting)
const screenBezel = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.25, 0.018), titaniumMaterial);
screenBezel.position.set(0, 0.61, -0.64);
screenBezel.rotation.x = -0.26;
const screenDisplay = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.23), screenGlowMat);
screenDisplay.position.set(0, 0.615, -0.624);
screenDisplay.rotation.x = -0.26;

// Fighter-Jet Translucent HUD Combiner Glass above Steering Yoke
const hudCombinerMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.19), hudGlassMat);
hudCombinerMesh.position.set(0, 0.79, -0.68);
hudCombinerMesh.rotation.x = -0.18;

// 3D Tesla Roadster Yoke Steering Wheel (Rotates in real-time with steering & roll!)
const steeringColumn = new THREE.Mesh(
  new THREE.CylinderGeometry(0.028, 0.032, 0.26, 16).rotateX(Math.PI / 2 - 0.22),
  titaniumMaterial
);
steeringColumn.position.set(0, 0.65, -0.58);

const yokeWheelGroup = new THREE.Group();
yokeWheelGroup.position.set(0, 0.675, -0.46);
yokeWheelGroup.rotation.x = -0.20;

// Yoke Center Hub & Horn Pad
const yokeHub = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.075, 0.032), cockpitMat);
const yokeBadge = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.010, 0.036), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
yokeBadge.position.set(0, 0.012, 0);
// Yoke Bottom Flat Bridge & Side Spokes
const yokeBottomBar = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.024, 0.026), carbonMaterial);
yokeBottomBar.position.set(0, -0.062, 0.004);
const yokeSpokeL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.022, 0.024), titaniumMaterial);
yokeSpokeL.position.set(-0.095, -0.01, 0.002);
const yokeSpokeR = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.022, 0.024), titaniumMaterial);
yokeSpokeR.position.set(0.095, -0.01, 0.002);
// Yoke Left & Right Ergonomic Horns + Thumb Scroll Rollers
[-1, 1].forEach((side) => {
  const hornGrip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.145, 0.032), carbonMaterial);
  hornGrip.position.set(side * 0.15, 0.005, 0.008);
  hornGrip.rotation.z = -side * 0.08;
  const thumbRoller = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.018, 12).rotateZ(Math.PI / 2), titaniumMaterial);
  thumbRoller.position.set(side * 0.105, 0.015, 0.016);
  const hornTip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.020, 0.030), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
  hornTip.position.set(side * 0.135, 0.074, 0.008);
  yokeWheelGroup.add(hornGrip, thumbRoller, hornTip);
});
yokeWheelGroup.add(yokeHub, yokeBadge, yokeBottomBar, yokeSpokeL, yokeSpokeR);
// Formula 1 / Plaid Dynamic Shift LED Array on top bridge of Yoke
const yokeShiftLeds = [];
const shiftColors = [0x10b981, 0x10b981, 0xf59e0b, 0xf59e0b, 0xef4444, 0xef4444, 0x38bdf8];
for (let i = 0; i < 7; i++) {
  const lx = -0.09 + (i / 6.0) * 0.18;
  const ly = 0.042 - Math.abs(lx) * 0.08;
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
  const ledMesh = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.007, 0.012), ledMat);
  ledMesh.position.set(lx, ly, 0.022);
  ledMesh.userData = { activeColor: shiftColors[i] };
  yokeWheelGroup.add(ledMesh);
  yokeShiftLeds.push(ledMesh);
}


carMeshGroup.add(seatBack, dashCowling, screenBezel, screenDisplay, hudCombinerMesh, steeringColumn, yokeWheelGroup);

// Digital Streaming Rear-View Camera Mirror Display
const mirrorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.042, 0.016), carbonMaterial);
mirrorHousing.position.set(0, 0.98, -0.44);
mirrorHousing.rotation.x = -0.15;
const mirrorScreenMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
const mirrorScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.036), mirrorScreenMat);
mirrorScreen.position.set(0, 0.98, -0.43);
mirrorScreen.rotation.x = -0.15;
const mirrorMount = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.065, 8), titaniumMaterial);
mirrorMount.position.set(0, 1.02, -0.44);
carMeshGroup.add(mirrorHousing, mirrorScreen, mirrorMount);

// Interior Ambient LED Light Piping along Door Sills and Dash
const ambientLightMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
[-1, 1].forEach((side) => {
  const doorPipe = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.010, 0.85), ambientLightMat);
  doorPipe.position.set(side * 0.76, 0.54, -0.15);
  carMeshGroup.add(doorPipe);
});
const dashPipe = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.010, 0.012), ambientLightMat);
dashPipe.position.set(0, 0.655, -0.66);
carMeshGroup.add(dashPipe);


// 3) Front Fascia: Center Horizontal LED Light Bar, Triangular Matrix Headlights & Recessed Black Grille
const ledPureWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const ledHousingMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.2, side: THREE.DoubleSide });
const amberRepeaterMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });

// Center Horizontal LED Light Bar with Titanium Eyeliner Frame (image_ed309d.png)
const lightBarFrame = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.030, 0.022), ledHousingMat);
lightBarFrame.position.set(0, 0.415, -2.252);
const centerLightBar = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.022, 0.024), ledPureWhiteMat);
centerLightBar.position.set(0, 0.415, -2.256);
carMeshGroup.add(lightBarFrame, centerLightBar);

// Front Fascia Chrome Tesla "T" Apex Emblem
const emblemMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.98, roughness: 0.12 });
const emblemBar = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.007, 0.012), emblemMat);
emblemBar.position.set(0, 0.428, -2.256);
emblemBar.rotation.x = 0.22;
const emblemStem = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.022, 0.010), emblemMat);
emblemStem.position.set(0, 0.418, -2.258);
emblemStem.rotation.x = 0.22;
carMeshGroup.add(emblemBar, emblemStem);

// Precision Automotive Panel Shutlines & Hood Aerodynamic Extraction Louvers (V10/V11)
const seamMat = new THREE.MeshBasicMaterial({ color: 0x050811 });
const frunkSeam = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.008, 0.012), seamMat);
frunkSeam.position.set(0, 0.655, -1.22);

// Dual Negative-Pressure Hood Aero Air Extraction Louvers (NACA negative pressure ducts)
[-0.32, 0.32].forEach((hx) => {
  const ventRecess = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.016, 0.42), carbonMaterial);
  ventRecess.position.set(hx, 0.615, -1.55);
  ventRecess.rotation.x = -0.18;
  carMeshGroup.add(ventRecess);
  for (let f = 0; f < 3; f++) {
    const finZ = -1.68 + f * 0.12;
    const louver = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.008, 0.024), titaniumMaterial);
    louver.position.set(hx, 0.625 + f * 0.02, finZ);
    louver.rotation.x = -0.45;
    carMeshGroup.add(louver);
  }
});

// Front Bumper Dual Aerodynamic Carbon Dive Planes (Canards)
[-1, 1].forEach((side) => {
  const canardUpper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.014, 0.22), carbonMaterial);
  canardUpper.position.set(side * 0.94, 0.36, -2.18);
  canardUpper.rotation.set(-0.25, side * 0.28, -side * 0.22);
  const canardLower = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.014, 0.18), carbonMaterial);
  canardLower.position.set(side * 0.92, 0.28, -2.20);
  canardLower.rotation.set(-0.25, side * 0.28, -side * 0.22);
  carMeshGroup.add(canardUpper, canardLower);
});

// Left/Right Door Shutlines & Rear Hatch Seam
[-1, 1].forEach(side => {
  const doorCutA = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.42, 0.012), seamMat);
  doorCutA.position.set(side * 0.99, 0.48, -0.68);
  const doorCutB = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.45, 0.012), seamMat);
  doorCutB.position.set(side * 0.99, 0.52, 0.72);
  carMeshGroup.add(doorCutA, doorCutB);
});
const hatchSeam = new THREE.Mesh(new THREE.BoxGeometry(1.10, 0.008, 0.012), seamMat);
hatchSeam.position.set(0, 0.852, 1.82);
carMeshGroup.add(frunkSeam, hatchSeam);

// Aerodynamic Carbon Aero Side Mirror Stalks & High-Resolution Camera Pods (V12)
[-1, 1].forEach((side) => {
  const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.018, 0.045), carbonMaterial);
  stalk.position.set(side * 0.88, 0.69, -0.66);
  stalk.rotation.z = side * 0.28;
  const mirrorPod = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.042, 0.075), bodyMaterial);
  mirrorPod.position.set(side * 0.98, 0.71, -0.66);
  mirrorPod.rotation.y = -side * 0.12;
  const cameraLens = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 12).rotateX(Math.PI / 2), titaniumMaterial);
  cameraLens.position.set(side * 1.02, 0.71, -0.62);
  const glassElem = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 8), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
  glassElem.position.set(side * 1.02, 0.71, -0.61);
  carMeshGroup.add(stalk, mirrorPod, cameraLens, glassElem);
});


// Wide Recessed Matte-Black Trapezoidal Front Bumper Grille below light bar
const frontGrilleQuad = createQuadMesh(
  [-0.57, 0.405, -2.248],
  [ 0.57, 0.405, -2.248],
  [ 0.66, 0.160, -2.248],
  [-0.66, 0.160, -2.248],
  carbonMaterial
);
const frontGrilleBar = new THREE.Mesh(new THREE.BoxGeometry(1.20, 0.032, 0.025), titaniumMaterial);
frontGrilleBar.position.set(0, 0.27, -2.254);
const frontChinSplitter = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.032, 0.16), carbonMaterial);
frontChinSplitter.position.set(0, 0.145, -2.245);
const frontChinChannel = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.022, 0.08), carbonMaterial);
frontChinChannel.position.set(0, 0.168, -2.252);
carMeshGroup.add(frontGrilleQuad, frontGrilleBar, frontChinSplitter, frontChinChannel);

// Triangular Recessed Matrix Headlights + 5 Crystal Projector Bars + Chrome Bowls + Cyan Eyebrow DRL
[-1, 1].forEach((side) => {
  const pocketMesh = createQuadMesh(
    [side * 0.56, 0.42, -2.254],
    [side * 0.66, 0.43, -2.190],
    [side * 0.81, 0.54, -2.000],
    [side * 0.59, 0.50, -2.050],
    ledHousingMat
  );
  const ledBeamMesh = createQuadMesh(
    [side * 0.565, 0.45, -2.180],
    [side * 0.700, 0.46, -2.140],
    [side * 0.805, 0.54, -2.005],
    [side * 0.590, 0.505, -2.050],
    ledPureWhiteMat
  );
  const cheekPanelMesh = createQuadMesh(
    [side * 0.57, 0.41, -2.245],
    [side * 0.88, 0.35, -2.210],
    [side * 0.90, 0.22, -2.210],
    [side * 0.66, 0.17, -2.245],
    bodyMaterial
  );
  const sideRepeater = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.026, 0.18), amberRepeaterMat);
  sideRepeater.position.set(side * 1.005, 0.55, -0.88);
  
  // 5 Vertical Crystal Matrix LED Projector Bars + Chrome Reflector Bowls
  const crystalLedMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const crystalBarsGroup = new THREE.Group();
  for (let b = 0; b < 5; b++) {
    const bt = b / 4.0;
    const bx = side * lerpVal(0.585, 0.775, bt);
    const by = lerpVal(0.445, 0.518, bt);
    const bz = lerpVal(-2.175, -2.030, bt);
    const barH = lerpVal(0.038, 0.052, bt);
    const bowl = new THREE.Mesh(new THREE.BoxGeometry(0.018, barH + 0.012, 0.024), titaniumMaterial);
    bowl.position.set(bx - side * 0.006, by, bz + 0.008);
    bowl.rotation.y = -side * 0.32;
    bowl.rotation.z = -side * 0.16;
    const barMesh = new THREE.Mesh(new THREE.BoxGeometry(0.012, barH, 0.020), crystalLedMat);
    barMesh.position.set(bx, by, bz);
    barMesh.rotation.y = -side * 0.32;
    barMesh.rotation.z = -side * 0.16;
    crystalBarsGroup.add(bowl, barMesh);
  }

  const eyebrowDrlMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const eyebrowDrl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.012, 0.016), eyebrowDrlMat);
  eyebrowDrl.position.set(side * 0.69, 0.515, -2.10);
  eyebrowDrl.rotation.set(-0.14, -side * 0.36, -side * 0.18);

  carMeshGroup.add(pocketMesh, ledBeamMesh, cheekPanelMesh, sideRepeater, crystalBarsGroup, eyebrowDrl);
});

// Dual High-Intensity Matrix LED Road Projection Headlights (Cast dynamic forward illumination pools on asphalt)
const headlightSpotL = new THREE.SpotLight(0xf8fafc, 2.4, 65, Math.PI / 6.8, 0.45, 1.2);
headlightSpotL.position.set(-0.62, 0.46, -2.15);
const headlightTargetL = new THREE.Object3D();
headlightTargetL.position.set(-0.65, 0.0, -28.0);
carMeshGroup.add(headlightSpotL, headlightTargetL);
headlightSpotL.target = headlightTargetL;

const headlightSpotR = new THREE.SpotLight(0xf8fafc, 2.4, 65, Math.PI / 6.8, 0.45, 1.2);
headlightSpotR.position.set(0.62, 0.46, -2.15);
const headlightTargetR = new THREE.Object3D();
headlightTargetR.position.set(0.65, 0.0, -28.0);
carMeshGroup.add(headlightSpotR, headlightTargetR);
headlightSpotR.target = headlightTargetR;


// Rear Kammback Fascia, Full-Width Crimson Taillight & Diffuser Fins
const rearTransomPanel = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.46, 0.08), carbonMaterial);
rearTransomPanel.position.set(0, 0.56, 2.22);
const tailLightMat = new THREE.MeshBasicMaterial({ color: 0xcc1436, side: THREE.DoubleSide });
const fullWidthTailLight = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.034, 0.04), tailLightMat);
fullWidthTailLight.position.set(0, 0.82, 2.23);

// Center High-Mount Stop Lamp (CHMSL) integrated beneath rear hatch glass
const chmslMat = new THREE.MeshBasicMaterial({ color: 0x3b050d, side: THREE.DoubleSide });
const chmslMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.016, 0.035), chmslMat);
chmslMesh.position.set(0, 0.885, 1.76);

// Dual Crisp White LED Reverse Back-up Lamps
const reverseLightMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, side: THREE.DoubleSide });
const reverseLamps = [];
[-0.24, 0.24].forEach((rx) => {
  const revLamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.022, 0.035), reverseLightMat);
  revLamp.position.set(rx, 0.77, 2.238);
  carMeshGroup.add(revLamp);
  reverseLamps.push(revLamp);
});

carMeshGroup.add(rearTransomPanel, fullWidthTailLight, chmslMesh);

// Dynamic Sequential Amber Turn Signal Indicators (Front Eyebrows & Rear Tail Edge)
const turnSignalMatL = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.0 });
const turnSignalMatR = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.0 });

const rearTurnSignalL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.032, 0.045), turnSignalMatL);
rearTurnSignalL.position.set(-0.74, 0.82, 2.235);
const rearTurnSignalR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.032, 0.045), turnSignalMatR);
rearTurnSignalR.position.set(0.74, 0.82, 2.235);

const frontTurnSignalL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.014, 0.022), turnSignalMatL);
frontTurnSignalL.position.set(-0.69, 0.518, -2.105);
frontTurnSignalL.rotation.set(-0.14, 0.36, 0.18);
const frontTurnSignalR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.014, 0.022), turnSignalMatR);
frontTurnSignalR.position.set(0.69, 0.518, -2.105);
frontTurnSignalR.rotation.set(-0.14, -0.36, -0.18);
carMeshGroup.add(rearTurnSignalL, rearTurnSignalR, frontTurnSignalL, frontTurnSignalR);

[-0.66, -0.44, -0.22, 0.0, 0.22, 0.44, 0.66].forEach((fx) => {
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.18, 0.34), carbonMaterial);
  fin.position.set(fx, 0.24, 2.16);
  carMeshGroup.add(fin);
});

// Active Rear Spoiler Group with Multi-Stage Telescopic Hydraulic Rams, Hoses, Endplates & Gurney Flap
const activeWingGroup = new THREE.Group();
activeWingGroup.position.set(0, 0.85, 2.04);
const wingBladeMain = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.028, 0.24), carbonMaterial);

[-1, 1].forEach((side) => {
  const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.12, 0.26), carbonMaterial);
  endplate.position.set(side * 0.82, -0.01, 0.0);
  activeWingGroup.add(endplate);
  const strakeTop = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.032, 0.24), carbonMaterial);
  strakeTop.position.set(side * 0.825, 0.052, 0.0);
  const strakeBtm = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.032, 0.24), carbonMaterial);
  strakeBtm.position.set(side * 0.825, -0.065, 0.0);
  activeWingGroup.add(strakeTop, strakeBtm);
});

const chromePistonMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.98, roughness: 0.08 });
[-0.44, 0.44].forEach((sx) => {
  const ramBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.13, 16), titaniumMaterial);
  ramBarrel.position.set(sx, -0.08, -0.02);
  ramBarrel.rotation.x = 0.22;
  const ramPistonOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.11, 16), chromePistonMat);
  ramPistonOuter.position.set(sx, -0.04, -0.015);
  ramPistonOuter.rotation.x = 0.22;
  const ramPistonInner = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.10, 16), chromePistonMat);
  ramPistonInner.position.set(sx, -0.01, -0.008);
  ramPistonInner.rotation.x = 0.22;
  const baseMount = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.038, 0.078), carbonMaterial);
  baseMount.position.set(sx, -0.15, -0.04);
  const hoseMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8, metalness: 0.2 });
  const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 8), hoseMat);
  hose.position.set(sx + (sx > 0 ? 0.025 : -0.025), -0.10, -0.035);
  hose.rotation.z = (sx > 0 ? -0.25 : 0.25);
  activeWingGroup.add(ramBarrel, ramPistonOuter, ramPistonInner, baseMount, hose);
});

const gurneyFlap = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.022, 0.014), carbonMaterial);
gurneyFlap.position.set(0, 0.022, 0.115);
activeWingGroup.add(gurneyFlap, wingBladeMain);
carMeshGroup.add(activeWingGroup);

// Dual Ground-Effect Vacuum Suction Fan Wells with 12-Blade Rotors, Stators & Venturi Skirts
const fanRimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.88, roughness: 0.28 });
const fanBladeMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.95, roughness: 0.18 });
const statorMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.90, roughness: 0.25 });
[-0.38, 0.38].forEach((fx) => {
  const fanRim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.045, 24), fanRimMat);
  fanRim.position.set(fx, 0.135, 0.35);
  const fanHub = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.055, 16), titaniumMaterial);
  fanHub.position.set(fx, 0.138, 0.35);
  carMeshGroup.add(fanRim, fanHub);
// Dual Low-Pressure Ground-Effect Suction Vortex Rings beneath fans
const groundEffectVortexGroup = new THREE.Group();
const vortexMat = new THREE.MeshBasicMaterial({
  color: 0x38bdf8,
  transparent: true,
  opacity: 0.0,
  side: THREE.DoubleSide
});
[-0.38, 0.38].forEach((fx) => {
  const vRing = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 0.28, 24).rotateX(-Math.PI / 2),
    vortexMat
  );
  vRing.position.set(fx, 0.05, 0.35);
  groundEffectVortexGroup.add(vRing);
});
carMeshGroup.add(groundEffectVortexGroup);

  for (let b = 0; b < 12; b++) {
    const bAngle = (b / 12) * Math.PI * 2;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.028, 0.15), fanBladeMat);
    blade.position.set(fx + Math.cos(bAngle) * 0.13, 0.140, 0.35 + Math.sin(bAngle) * 0.13);
    blade.rotation.y = bAngle + 0.45;
    carMeshGroup.add(blade);
  }
  for (let sv = 0; sv < 6; sv++) {
    const svAngle = (sv / 6) * Math.PI * 2;
    const stator = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.018, 0.22), statorMat);
    stator.position.set(fx + Math.cos(svAngle) * 0.11, 0.122, 0.35 + Math.sin(svAngle) * 0.11);
    stator.rotation.y = svAngle;
    carMeshGroup.add(stator);
  }
});

// Aerodynamic Lower Vacuum Skirt Rubber Blades
[-1, 1].forEach((side) => {
  const skirtBlade = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.045, 2.3), carbonMaterial);
  skirtBlade.position.set(side * 0.94, 0.138, 0.0);
  carMeshGroup.add(skirtBlade);
});

// Underbody Carbon Venturi Aerodynamic Flow Channels to Rear Diffuser
const venturiChannelL = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.055, 3.4), carbonMaterial);
venturiChannelL.position.set(-0.48, 0.14, 0.2);
const venturiChannelR = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.055, 3.4), carbonMaterial);
venturiChannelR.position.set(0.48, 0.14, 0.2);
carMeshGroup.add(venturiChannelL, venturiChannelR);

// 4) 5-Spoke Aero Star Wheels with Silver Triangle Inserts (Exact match to image_ed30b9.png)
const tireMat = new THREE.MeshStandardMaterial({ color: 0x0b0f19, roughness: 0.82, metalness: 0.1, side: THREE.DoubleSide });
const alloyRimMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, metalness: 0.90, roughness: 0.16, side: THREE.DoubleSide });
const aeroInsertMat = new THREE.MeshStandardMaterial({ color: 0xd8dee9, metalness: 0.78, roughness: 0.20, side: THREE.DoubleSide });
const darkSpokeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide });
const caliperMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide });
const rotorMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, emissive: 0x000000, emissiveIntensity: 0.0, metalness: 0.85, roughness: 0.35, side: THREE.DoubleSide });

const wheelSpecs = [
  { x: -0.84, y: FRONT_Y, z: FRONT_Z, radius: FRONT_R, width: 0.20, isFront: true },
  { x:  0.84, y: FRONT_Y, z: FRONT_Z, radius: FRONT_R, width: 0.20, isFront: true },
  { x: -0.86, y: REAR_Y,  z: REAR_Z,  radius: REAR_R,  width: 0.22, isFront: false },
  { x:  0.86, y: REAR_Y,  z: REAR_Z,  radius: REAR_R,  width: 0.22, isFront: false }
];
const wheels = [];
const frontWheelSteerGroups = [];

wheelSpecs.forEach((ws) => {
  const outX = (ws.x > 0 ? 1 : -1) * (ws.width * 0.51);
  const steerPivot = new THREE.Group();
  steerPivot.position.set(ws.x, ws.y, ws.z);
  carMeshGroup.add(steerPivot);
  if (ws.isFront) frontWheelSteerGroups.push(steerPivot);

  // Circular inner wheel-well drum (stays strictly inside the wheel arch, never poking through the fender!)
  const archDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(ws.radius * 0.96, ws.radius * 0.96, ws.width * 1.15, 24).rotateZ(Math.PI / 2),
    carbonMaterial
  );
  archDrum.position.set(ws.x > 0 ? -0.06 : 0.06, 0, 0);
  steerPivot.add(archDrum);

  // V10/V11 Brembo 6-Piston Caliper with White Brand Stripe & Drilled Rotor + Titanium Lug Nuts
  const caliper = new THREE.Mesh(new THREE.BoxGeometry(ws.width * 0.54, 0.135, 0.10), caliperMat);
  caliper.position.set(ws.x > 0 ? 0.03 : -0.03, 0.04, -0.12);
  const caliperStripe = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.024, 0.065), ledPureWhiteMat);
  caliperStripe.position.set(ws.x > 0 ? 0.035 + (ws.width * 0.27) : -0.035 - (ws.width * 0.27), 0.04, -0.12);
  const brakeRotor = new THREE.Mesh(
    new THREE.CylinderGeometry(ws.radius * 0.70, ws.radius * 0.70, ws.width * 0.18, 24).rotateZ(Math.PI / 2),
    rotorMat
  );
  const rotorHat = new THREE.Mesh(
    new THREE.CylinderGeometry(ws.radius * 0.36, ws.radius * 0.36, ws.width * 0.22, 16).rotateZ(Math.PI / 2),
    darkSpokeMat
  );
  steerPivot.add(caliper, caliperStripe, brakeRotor, rotorHat);

  // Braided stainless-steel high-pressure hydraulic brake line
  const brakeHose = new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.005, 0.16, 8).rotateX(0.42),
    titaniumMaterial
  );
  brakeHose.position.set(ws.x > 0 ? 0.01 : -0.01, 0.09, -0.07);
  steerPivot.add(brakeHose);

  // Cross-drilled carbon-ceramic brake rotor cooling ventilation holes
  const drilledHoleMat = new THREE.MeshBasicMaterial({ color: 0x111827 });
  for (let h = 0; h < 12; h++) {
    const hAngle = (h / 12) * Math.PI * 2;
    const hRadius = ws.radius * (0.44 + (h % 3) * 0.095);
    const holeMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.007, ws.width * 0.19, 8).rotateZ(Math.PI / 2),
      drilledHoleMat
    );
    holeMesh.position.set(ws.x > 0 ? 0.01 : -0.01, Math.cos(hAngle) * hRadius, Math.sin(hAngle) * hRadius);
    steerPivot.add(holeMesh);
  }

  const spinGroup = new THREE.Group();
  steerPivot.add(spinGroup);

  const tireCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(ws.radius, ws.radius, ws.width, 28).rotateZ(Math.PI / 2),
    tireMat
  );
  // Stepped aerodynamic tire sidewall relief ring
  const sidewallRing = new THREE.Mesh(
    new THREE.RingGeometry(ws.radius * 0.76, ws.radius * 0.96, 28).rotateY(ws.x > 0 ? Math.PI / 2 : -Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.92, metalness: 0.05, side: THREE.DoubleSide })
  );
  sidewallRing.position.set(outX * 1.002, 0, 0);
  spinGroup.add(sidewallRing);
  const rimBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(ws.radius * 0.78, ws.radius * 0.78, ws.width * 1.01, 24).rotateZ(Math.PI / 2),
    darkSpokeMat
  );
  const rimLip = new THREE.Mesh(
    new THREE.RingGeometry(ws.radius * 0.75, ws.radius * 0.81, 32).rotateY(ws.x > 0 ? Math.PI / 2 : -Math.PI / 2),
    alloyRimMat
  );
  rimLip.position.set(outX * 1.01, 0, 0);
  const centerCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, ws.width * 1.05, 16).rotateZ(Math.PI / 2),
    darkSpokeMat
  );
  const centerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.048, 0.062, 16).rotateY(ws.x > 0 ? Math.PI / 2 : -Math.PI / 2),
    alloyRimMat
  );
  centerRing.position.set(outX * 1.055, 0, 0);
  const lugNutMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.95, roughness: 0.12 });
  for (let n = 0; n < 5; n++) {
    const nAngle = (n / 5) * Math.PI * 2;
    const lug = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.016, 6).rotateZ(Math.PI / 2), lugNutMat);
    lug.position.set(outX * 1.045, Math.cos(nAngle) * 0.038, Math.sin(nAngle) * 0.038);
    spinGroup.add(lug);
  }
  spinGroup.add(tireCyl, rimBarrel, rimLip, centerCap, centerRing);
  // Twin circumferential racing tread grooves on tire surface
  const treadGrooveMat = new THREE.MeshBasicMaterial({ color: 0x05070c });
  [-0.04, 0.04].forEach((tx) => {
    const groove = new THREE.Mesh(
      new THREE.RingGeometry(ws.radius * 0.992, ws.radius * 1.002, 32).rotateY(Math.PI / 2),
      treadGrooveMat
    );
    groove.position.set(tx, 0, 0);
    spinGroup.add(groove);
  });

  // Precision wheel air valve stem on rim barrel
  const valveMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.25 });
  const valveStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.005, 0.032, 8).rotateZ(Math.PI / 2),
    valveMat
  );
  valveStem.position.set(outX * 0.98, ws.radius * 0.73, 0);
  valveStem.rotation.x = -0.42;
  spinGroup.add(valveStem);

  // 5-Spoke Star Pattern + 5 Silver Aero Triangle Sector Plates (Exact match to image_ed30b9.png)
  for (let s = 0; s < 5; s++) {
    const ang = (s / 5) * Math.PI * 2 + 0.2;
    const spokeBar = new THREE.Mesh(new THREE.BoxGeometry(0.022, ws.radius * 0.74, 0.038), alloyRimMat);
    spokeBar.position.set(outX, Math.cos(ang) * (ws.radius * 0.38), Math.sin(ang) * (ws.radius * 0.38));
    spokeBar.rotation.x = ang;
    spinGroup.add(spokeBar);

    const angMid = ang + Math.PI / 5;
    const a1 = angMid - 0.34;
    const a2 = angMid + 0.34;
    const pHub = [outX * 1.01, Math.cos(angMid) * (ws.radius * 0.22), Math.sin(angMid) * (ws.radius * 0.22)];
    const pRim1 = [outX * 1.01, Math.cos(a1) * (ws.radius * 0.73), Math.sin(a1) * (ws.radius * 0.73)];
    const pRim2 = [outX * 1.01, Math.cos(a2) * (ws.radius * 0.73), Math.sin(a2) * (ws.radius * 0.73)];
    const aeroTri = createQuadMesh(pHub, pRim1, pRim2, pHub, aeroInsertMat);
    spinGroup.add(aeroTri);
  }
  wheels.push(spinGroup);
});

// =========================================================================
// 5. 10 SPACEX COLD-GAS SUPERSONIC THRUSTER NOZZLES & SHOCK PLUMES
// =========================================================================
const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.92, roughness: 0.18, side: THREE.DoubleSide });
const flangeMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide });
const heatTintMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
const plumeMatMain = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
const plumeMatLift = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
const plumeMatRCS = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.90, side: THREE.DoubleSide });

const machDiamondMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
const heatShimmerMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45, side: THREE.DoubleSide });

function createThrusterPlume(radius, length, mat, dirVec) {
  const group = new THREE.Group();
  const coneGeo = new THREE.ConeGeometry(radius, length, 14);
  coneGeo.translate(0, -length / 2, 0);
  const dx = dirVec.x, dy = dirVec.y, dz = dirVec.z;
  if (Math.abs(dz) > 0.8) {
    coneGeo.rotateX(dz > 0 ? -Math.PI / 2 : Math.PI / 2);
  } else if (Math.abs(dx) > 0.5) {
    coneGeo.rotateZ(dx > 0 ? Math.PI / 2 : -Math.PI / 2);
  } else if (dy > 0.5) {
    coneGeo.rotateX(Math.PI);
  }
  const mesh = new THREE.Mesh(coneGeo, mat);
  group.add(mesh);

  // Add Supersonic Mach Shockwave Diamonds & Heat Shimmer Refraction Rings inside Plume
  if (Math.abs(dz) > 0.8) {
    const sgn = dz > 0 ? 1 : -1;
    for (let m = 1; m <= 3; m++) {
      const ringR = radius * (1.05 - m * 0.22);
      const mRing = new THREE.Mesh(new THREE.RingGeometry(ringR * 0.45, ringR, 16), machDiamondMat);
      mRing.position.set(0, 0, sgn * (m * length * 0.22));
      const shimmerRing = new THREE.Mesh(new THREE.RingGeometry(ringR * 1.1, ringR * 1.65, 16), heatShimmerMat);
      shimmerRing.position.set(0, 0, sgn * (m * length * 0.24));
      group.add(mRing, shimmerRing);
    }
  }

  group.visible = false;
  return group;
}

const rearNozzlesGimbalGroup = new THREE.Group();
rearNozzlesGimbalGroup.position.set(0, 0.50, 2.23);
carMeshGroup.add(rearNozzlesGimbalGroup);

// Perforated Titanium SpaceX Thruster Heat Shield Backplate & Manifold Rail
const heatShieldMat = new THREE.MeshStandardMaterial({
  color: 0x1e293b,
  metalness: 0.94,
  roughness: 0.22,
  side: THREE.DoubleSide
});
const thrusterHeatShield = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.22, 0.016), heatShieldMat);
thrusterHeatShield.position.set(0, 0, -0.02);
const manifoldRail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.18, 16).rotateZ(Math.PI / 2), titaniumMaterial);
manifoldRail.position.set(0, 0.08, -0.035);
rearNozzlesGimbalGroup.add(thrusterHeatShield, manifoldRail);

const rearPlumes = [];
[-0.45, -0.15, 0.15, 0.45].forEach((rx) => {
  const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 20).rotateX(Math.PI / 2), flangeMat);
  flange.position.set(rx, 0, 0);
  const gimbalBall = new THREE.Mesh(new THREE.SphereGeometry(0.072, 16, 12), titaniumMaterial);
  gimbalBall.position.set(rx, 0, 0.02);
  const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.105, 0.22, 20).rotateX(Math.PI / 2), nozzleMat);
  noz.position.set(rx, 0, 0.05);
  const lipRing = new THREE.Mesh(new THREE.RingGeometry(0.088, 0.106, 20), heatTintMat);
  lipRing.position.set(rx, 0, 0.162);
  // Concentric internal supersonic De Laval expansion ring & central pintle injector
  const innerBell = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.082, 0.16, 16).rotateX(Math.PI / 2), titaniumMaterial);
  innerBell.position.set(rx, 0, 0.075);
  const pintle = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.065, 12).rotateX(-Math.PI / 2), heatTintMat);
  pintle.position.set(rx, 0, 0.065);
  const propellantLine = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8).rotateX(0.45), titaniumMaterial);
  propellantLine.position.set(rx, 0.12, -0.06);
  rearNozzlesGimbalGroup.add(flange, gimbalBall, noz, lipRing, innerBell, pintle, propellantLine);

  const plume = createThrusterPlume(0.12, 1.95, plumeMatMain, new THREE.Vector3(0, 0, 1));
  plume.position.set(rx, 0, 0.17);
  rearNozzlesGimbalGroup.add(plume);
  rearPlumes.push(plume);
});

// 3D Supersonic Prandtl-Glauert Mach Vapor Shock Cone around Fuselage (>230 MPH)
const sonicBoomConeGroup = new THREE.Group();
const machConeMat = new THREE.MeshBasicMaterial({
  color: 0xe0f2fe,
  transparent: true,
  opacity: 0.28,
  side: THREE.DoubleSide
});
const machConeMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(0.35, 1.85, 2.2, 28, 1, true).rotateX(Math.PI / 2),
  machConeMat
);
machConeMesh.position.set(0, 0.55, 0.35);
const machVaporRing = new THREE.Mesh(
  new THREE.RingGeometry(1.15, 1.92, 32),
  new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.42, side: THREE.DoubleSide })
);
machVaporRing.position.set(0, 0.55, 1.25);
sonicBoomConeGroup.add(machConeMesh, machVaporRing);
sonicBoomConeGroup.visible = false;
carMeshGroup.add(sonicBoomConeGroup);

const liftPlumes = [];
[
  [-0.78, 0.16, -1.25],
  [0.78, 0.16, -1.25],
  [-0.78, 0.16, 1.25],
  [0.78, 0.16, 1.25]
].forEach(([lx, ly, lz]) => {
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 16), flangeMat);
  collar.position.set(lx, ly - 0.01, lz);
  carMeshGroup.add(collar);

  const plume = createThrusterPlume(0.24, 1.7, plumeMatLift, new THREE.Vector3(0, -1, 0));
  plume.position.set(lx, ly, lz);
  carMeshGroup.add(plume);
  liftPlumes.push(plume);
});

const descendPlumes = [];
[
  [-0.76, 0.72, -1.1],
  [0.76, 0.72, -1.1],
  [-0.76, 0.84, 1.1],
  [0.76, 0.84, 1.1]
].forEach(([dx, dy, dz]) => {
  const plume = createThrusterPlume(0.15, 1.25, plumeMatRCS, new THREE.Vector3(0, 1, 0));
  plume.position.set(dx, dy, dz);
  carMeshGroup.add(plume);
  descendPlumes.push(plume);
});

// 2 Stealth Front Nose Supersonic Cold-Gas Retro-Thrusters inside lower front grille
const frontRetroNozzles = [];
const frontRetroPlumes = [];
[-0.34, 0.34].forEach((fx) => {
  const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.068, 0.12, 16).rotateX(Math.PI / 2), nozzleMat);
  noz.position.set(fx, 0.24, -2.25);
  const lipRing = new THREE.Mesh(new THREE.RingGeometry(0.055, 0.070, 16), heatTintMat);
  lipRing.position.set(fx, 0.24, -2.312);
  carMeshGroup.add(noz, lipRing);
  frontRetroNozzles.push(noz);

  const plume = createThrusterPlume(0.14, 1.65, plumeMatRCS, new THREE.Vector3(0, 0, -1));
  plume.position.set(fx, 0.24, -2.32);
  carMeshGroup.add(plume);
  frontRetroPlumes.push(plume);
});

const rcsPlumes = {
  rollLeft: createThrusterPlume(0.14, 1.2, plumeMatRCS, new THREE.Vector3(1, 0, 0)),
  rollRight: createThrusterPlume(0.14, 1.2, plumeMatRCS, new THREE.Vector3(-1, 0, 0)),
  pitchUp: createThrusterPlume(0.14, 1.2, plumeMatRCS, new THREE.Vector3(0, -1, 0)),
  pitchDown: createThrusterPlume(0.14, 1.2, plumeMatRCS, new THREE.Vector3(0, 1, 0)),
  yawLeft: createThrusterPlume(0.14, 1.2, plumeMatRCS, new THREE.Vector3(1, 0, 0)),
  yawRight: createThrusterPlume(0.14, 1.2, plumeMatRCS, new THREE.Vector3(-1, 0, 0))
};
rcsPlumes.rollLeft.position.set(1.00, 0.55, 0);
rcsPlumes.rollRight.position.set(-1.00, 0.55, 0);
rcsPlumes.pitchUp.position.set(0, 0.30, -2.20);
rcsPlumes.pitchDown.position.set(0, 0.62, -2.20);
rcsPlumes.yawLeft.position.set(0.95, 0.48, -2.0);
rcsPlumes.yawRight.position.set(-0.95, 0.48, -2.0);
Object.values(rcsPlumes).forEach(p => carMeshGroup.add(p));

const hoverRingGeo = new THREE.RingGeometry(0.9, 2.3, 32);
hoverRingGeo.rotateX(-Math.PI / 2);
const hoverRingMat = new THREE.MeshBasicMaterial({
  color: 0x38bdf8,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.0
});
const hoverRingMesh = new THREE.Mesh(hoverRingGeo, hoverRingMat);
hoverRingMesh.position.y = 0.05;
// hoverRingMesh removed per user request
// scene.add(hoverRingMesh);

// =========================================================================
// 6. TRAFFIC VEHICLES — USING THE PREVIOUS SCULPTED SUPERCAR MODEL
//    ("把你上面的模型给其他车辆": All traffic vehicles now use the V6/V7
//     sculpted supercar mesh with flared arches, teardrop canopy & wing!)
// =========================================================================
const trafficGroup = new THREE.Group();
scene.add(trafficGroup);
let trafficCars = [];

const trafficPalette = [
  0xc9182b, // Signature Multi-Coat Crimson
  0x2563eb, // Electric Cobalt Blue
  0xf59e0b, // Solar Metallic Gold
  0x10b981, // Cyber Emerald Green
  0xe2e8f0, // Liquid Quicksilver
  0x334155, // Stealth Gunmetal Titanium
  0x7c3aed, // Ultra Violet Pearl
  0x06b6d4  // Miami Cyan Metallic
];

const sharedTrafficPaintMats = trafficPalette.map((color) => new THREE.MeshPhysicalMaterial({
  color,
  metalness: 0.78,
  roughness: 0.14,
  clearcoat: 1.0,
  clearcoatRoughness: 0.03,
  reflectivity: 0.96,
  envMapIntensity: 1.45,
  side: THREE.DoubleSide
}));

// Pre-build shared BufferGeometries of the previous sculpted supercar model once for 60fps performance
const legacySupercarBodyGeo = (function() {
  const stations = [
    { z: -2.34, halfW: 0.64, waistW: 0.40, centerY: 0.32, fenderY: 0.32, beltY: 0.28, chinY: 0.16 },
    { z: -2.18, halfW: 0.83, waistW: 0.55, centerY: 0.40, fenderY: 0.41, beltY: 0.36, chinY: 0.15 },
    { z: -1.92, halfW: 0.95, waistW: 0.65, centerY: 0.51, fenderY: 0.54, beltY: 0.48, chinY: 0.14 },
    { z: -1.62, halfW: 1.02, waistW: 0.73, centerY: 0.59, fenderY: 0.69, beltY: 0.63, chinY: 0.14 },
    { z: -1.36, halfW: 1.04, waistW: 0.75, centerY: 0.64, fenderY: 0.75, beltY: 0.68, chinY: 0.14 },
    { z: -1.06, halfW: 1.00, waistW: 0.70, centerY: 0.66, fenderY: 0.71, beltY: 0.64, chinY: 0.13 },
    { z: -0.60, halfW: 0.95, waistW: 0.67, centerY: 0.66, fenderY: 0.72, beltY: 0.65, chinY: 0.13 },
    { z: -0.10, halfW: 0.92, waistW: 0.64, centerY: 0.67, fenderY: 0.73, beltY: 0.67, chinY: 0.13 },
    { z:  0.35, halfW: 0.95, waistW: 0.62, centerY: 0.69, fenderY: 0.78, beltY: 0.71, chinY: 0.13 },
    { z:  0.85, halfW: 1.01, waistW: 0.59, centerY: 0.72, fenderY: 0.84, beltY: 0.75, chinY: 0.14 },
    { z:  1.15, halfW: 1.05, waistW: 0.57, centerY: 0.74, fenderY: 0.87, beltY: 0.78, chinY: 0.15 },
    { z:  1.36, halfW: 1.06, waistW: 0.55, centerY: 0.75, fenderY: 0.88, beltY: 0.79, chinY: 0.16 },
    { z:  1.68, halfW: 1.02, waistW: 0.52, centerY: 0.75, fenderY: 0.84, beltY: 0.76, chinY: 0.18 },
    { z:  2.02, halfW: 0.95, waistW: 0.48, centerY: 0.74, fenderY: 0.79, beltY: 0.72, chinY: 0.22 },
    { z:  2.28, halfW: 0.87, waistW: 0.43, centerY: 0.70, fenderY: 0.72, beltY: 0.67, chinY: 0.29 }
  ];
  const numZ = 48, numU = 24;
  const zMin = -2.34, zMax = 2.28;
  const grid = [];
  for (let iz = 0; iz <= numZ; iz++) {
    const z = zMin + (iz / numZ) * (zMax - zMin);
    const st = sampleStationProfile(stations, z);
    const archY = wheelArchOpeningY(z);
    const effChinY = Math.min(st.beltY - 0.03, Math.max(st.chinY, archY));
    let sideScoop = 0.0;
    if (z > -0.90 && z < 0.92) {
      const c = Math.cos((z / 0.91) * (Math.PI / 2));
      sideScoop = 0.088 * c * c;
    }
    let buttressLift = 0.0;
    if (z > 0.10 && z < 1.80) {
      const bt = (z - 0.10) / 1.70;
      buttressLift = 0.19 * Math.sin(bt * Math.PI) * Math.pow(1.0 - bt * 0.45, 1.2);
    }
    const row = [];
    for (let iu = 0; iu <= numU; iu++) {
      const u = (iu / numU) * 2.0 - 1.0;
      const au = Math.abs(u);
      const sx = u < 0 ? -1.0 : 1.0;
      let x = 0, y = 0;
      if (au <= 0.38) {
        const lt = au / 0.38;
        x = sx * lt * st.waistW;
        const rib = (lt > 0.68) ? buttressLift * Math.sin(((lt - 0.68) / 0.32) * (Math.PI / 2)) : 0.0;
        y = hermiteInterp(st.centerY, st.fenderY, Math.pow(lt, 1.4)) + rib;
      } else if (au <= 0.68) {
        const lt = (au - 0.38) / 0.30;
        const curve = Math.sin(lt * Math.PI);
        const rib = (lt < 0.45) ? buttressLift * Math.cos((lt / 0.45) * (Math.PI / 2)) : 0.0;
        x = sx * (hermiteInterp(st.waistW, st.halfW, lt) + 0.025 * curve);
        y = hermiteInterp(st.fenderY, st.beltY, lt) + 0.02 * curve + rib;
      } else {
        const lt = (au - 0.68) / 0.32;
        const scoop = archY === 0.0 ? sideScoop * Math.sin(lt * Math.PI) : 0.0;
        const flare = archY > 0.22 ? (0.018 * Math.sin(lt * Math.PI)) : (-0.05 * lt);
        x = sx * (st.halfW + flare - scoop);
        y = hermiteInterp(st.beltY, effChinY, lt);
      }
      row.push([x, y, z]);
    }
    grid.push(row);
  }
  return createSmoothGridGeometry(grid);
})();

const legacySupercarCanopyGeo = (function() {
  const canopyStations = [
    { z: -1.14, halfW: 0.55, topY: 0.65, sideY: 0.64 },
    { z: -0.90, halfW: 0.65, topY: 0.78, sideY: 0.67 },
    { z: -0.50, halfW: 0.67, topY: 0.97, sideY: 0.70 },
    { z: -0.12, halfW: 0.64, topY: 1.09, sideY: 0.72 },
    { z:  0.22, halfW: 0.60, topY: 1.10, sideY: 0.74 },
    { z:  0.68, halfW: 0.50, topY: 1.01, sideY: 0.78 },
    { z:  1.18, halfW: 0.40, topY: 0.88, sideY: 0.79 },
    { z:  1.64, halfW: 0.31, topY: 0.76, sideY: 0.74 }
  ];
  const nz = 28, nu = 18;
  const zMin = -1.14, zMax = 1.64;
  const grid = [];
  for (let iz = 0; iz <= nz; iz++) {
    const z = zMin + (iz / nz) * (zMax - zMin);
    const st = sampleStationProfile(canopyStations, z);
    const row = [];
    for (let iu = 0; iu <= nu; iu++) {
      const u = (iu / nu) * 2.0 - 1.0;
      const au = Math.abs(u);
      const x = u * st.halfW;
      const dome = Math.cos(au * (Math.PI / 2));
      const y = st.sideY + (st.topY - st.sideY) * Math.pow(dome, 0.75);
      row.push([x, y, z]);
    }
    grid.push(row);
  }
  return createSmoothGridGeometry(grid);
})();

const sharedTrafficCanopyMat = new THREE.MeshPhysicalMaterial({
  color: 0x261c16,
  emissive: 0x1a110b,
  emissiveIntensity: 0.22,
  metalness: 0.92,
  roughness: 0.06,
  clearcoat: 1.0,
  reflectivity: 1.0,
  envMapIntensity: 1.8,
  transparent: true,
  opacity: 0.90,
  side: THREE.DoubleSide
});
const sharedTrafficWheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.22, 20).rotateZ(Math.PI / 2);
const sharedTrafficRimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.225, 16).rotateZ(Math.PI / 2);
const sharedTrafficSpokeBarGeo = new THREE.BoxGeometry(0.235, 0.44, 0.034);
const sharedTrafficCenterCapGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.24, 12).rotateZ(Math.PI / 2);
const sharedTrafficCaliperGeo = new THREE.BoxGeometry(0.12, 0.13, 0.10);
const sharedTrafficWingGeo = new THREE.BoxGeometry(1.66, 0.032, 0.28);
const sharedTrafficWingEndplateGeo = new THREE.BoxGeometry(0.026, 0.13, 0.30);
const sharedTrafficWingStrutGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.14, 10);
const sharedTrafficUndertrayGeo = new THREE.BoxGeometry(1.74, 0.055, 4.34);
const sharedTrafficSplitterGeo = new THREE.BoxGeometry(1.68, 0.035, 0.38);
const sharedTrafficDiffuserFinGeo = new THREE.BoxGeometry(0.024, 0.18, 0.34);
const sharedTrafficHeadlightHousingGeo = new THREE.BoxGeometry(0.42, 0.068, 0.12);
const sharedTrafficHeadlightLensGeo = new THREE.BoxGeometry(0.36, 0.032, 0.04);
const sharedTrafficDrlGeo = new THREE.BoxGeometry(0.38, 0.016, 0.03);
const sharedTrafficTaillightGeo = new THREE.BoxGeometry(1.70, 0.038, 0.06);
const sharedTrafficTailSideGeo = new THREE.BoxGeometry(0.035, 0.038, 0.22);
const sharedTrafficSeatGeo = new THREE.BoxGeometry(0.46, 0.48, 0.12);
const sharedTrafficMirrorGeo = new THREE.BoxGeometry(0.16, 0.045, 0.08);
const sharedTrafficHLMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
const sharedTrafficDrlMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
const sharedTrafficTLMat = new THREE.MeshBasicMaterial({ color: 0xff1e42 });

function createTrafficVehicleMesh(typeIndex) {
  const group = new THREE.Group();
  const paintMat = sharedTrafficPaintMats[typeIndex % sharedTrafficPaintMats.length];

  // 1. Sculpted Aerodynamic Supercar Monocoque & Glazed Canopy
  const bodyMesh = new THREE.Mesh(legacySupercarBodyGeo, paintMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  const canopyMesh = new THREE.Mesh(legacySupercarCanopyGeo, sharedTrafficCanopyMat);

  // 2. Carbon Aero Undertray, Front Splitter Lip & Rear 5-Fin Diffuser
  const undertray = new THREE.Mesh(sharedTrafficUndertrayGeo, carbonMaterial);
  undertray.position.set(0, 0.145, 0);
  const frontLip = new THREE.Mesh(sharedTrafficSplitterGeo, carbonMaterial);
  frontLip.position.set(0, 0.14, -2.14);
  group.add(bodyMesh, canopyMesh, undertray, frontLip);

  [-0.56, -0.28, 0.0, 0.28, 0.56].forEach((fx) => {
    const fin = new THREE.Mesh(sharedTrafficDiffuserFinGeo, carbonMaterial);
    fin.position.set(fx, 0.22, 2.16);
    group.add(fin);
  });

  // 3. Interior Bucket Seat Silhouette & Side Aero Mirrors
  const seat = new THREE.Mesh(sharedTrafficSeatGeo, cockpitMat);
  seat.position.set(0, 0.56, 0.36);
  seat.rotation.x = -0.22;
  const mirrorL = new THREE.Mesh(sharedTrafficMirrorGeo, paintMat);
  mirrorL.position.set(-0.98, 0.68, -0.62);
  const mirrorR = new THREE.Mesh(sharedTrafficMirrorGeo, paintMat);
  mirrorR.position.set(0.98, 0.68, -0.62);
  group.add(seat, mirrorL, mirrorR);

  // 4. Active Rear Wing with Twin Struts & Endplates (Sport & Track variants)
  const wing = new THREE.Mesh(sharedTrafficWingGeo, carbonMaterial);
  wing.position.set(0, 0.85, 2.04);
  const epL = new THREE.Mesh(sharedTrafficWingEndplateGeo, carbonMaterial);
  epL.position.set(-0.83, 0.84, 2.04);
  const epR = new THREE.Mesh(sharedTrafficWingEndplateGeo, carbonMaterial);
  epR.position.set(0.83, 0.84, 2.04);
  const strutL = new THREE.Mesh(sharedTrafficWingStrutGeo, titaniumMaterial);
  strutL.position.set(-0.44, 0.77, 2.01);
  const strutR = new THREE.Mesh(sharedTrafficWingStrutGeo, titaniumMaterial);
  strutR.position.set(0.44, 0.77, 2.01);
  group.add(wing, epL, epR, strutL, strutR);

  // 5. Recessed Matrix LED Headlights + Cyan DRLs & Full-Width Crimson Taillight Bar
  [-1, 1].forEach((side) => {
    const hlBox = new THREE.Mesh(sharedTrafficHeadlightHousingGeo, carbonMaterial);
    hlBox.position.set(side * 0.62, 0.46, -2.10);
    hlBox.rotation.y = -side * 0.26;
    const hlLens = new THREE.Mesh(sharedTrafficHeadlightLensGeo, sharedTrafficHLMat);
    hlLens.position.set(side * 0.62, 0.465, -2.145);
    hlLens.rotation.y = -side * 0.26;
    const drl = new THREE.Mesh(sharedTrafficDrlGeo, sharedTrafficDrlMat);
    drl.position.set(side * 0.62, 0.44, -2.15);
    drl.rotation.y = -side * 0.26;
    group.add(hlBox, hlLens, drl);
  });

  const tl = new THREE.Mesh(sharedTrafficTaillightGeo, sharedTrafficTLMat);
  tl.position.set(0, 0.70, 2.26);
  const tlSideL = new THREE.Mesh(sharedTrafficTailSideGeo, sharedTrafficTLMat);
  tlSideL.position.set(-0.85, 0.69, 2.16);
  const tlSideR = new THREE.Mesh(sharedTrafficTailSideGeo, sharedTrafficTLMat);
  tlSideR.position.set(0.85, 0.69, 2.16);
  group.add(tl, tlSideL, tlSideR);

  // 6. 4 Multi-Spoke Turbine Wheels with Red Brake Calipers & Real-Time Spin
  const carWheels = [];
  [
    [-0.82, 0.33, -1.36],
    [ 0.82, 0.33, -1.36],
    [-0.84, 0.35,  1.36],
    [ 0.84, 0.35,  1.36]
  ].forEach(([wx, wy, wz]) => {
    const caliper = new THREE.Mesh(sharedTrafficCaliperGeo, caliperMat);
    caliper.position.set(wx + (wx > 0 ? 0.03 : -0.03), wy + 0.04, wz - 0.11);
    group.add(caliper);

    const wheelSpin = new THREE.Group();
    wheelSpin.position.set(wx, wy, wz);
    const wTire = new THREE.Mesh(sharedTrafficWheelGeo, tireMat);
    const wRim = new THREE.Mesh(sharedTrafficRimGeo, darkSpokeMat);
    const spoke1 = new THREE.Mesh(sharedTrafficSpokeBarGeo, alloyRimMat);
    const spoke2 = new THREE.Mesh(sharedTrafficSpokeBarGeo, alloyRimMat);
    spoke2.rotation.x = Math.PI / 3;
    const spoke3 = new THREE.Mesh(sharedTrafficSpokeBarGeo, alloyRimMat);
    spoke3.rotation.x = (Math.PI * 2) / 3;
    const cap = new THREE.Mesh(sharedTrafficCenterCapGeo, caliperMat);
    wheelSpin.add(wTire, wRim, spoke1, spoke2, spoke3, cap);
    group.add(wheelSpin);
    carWheels.push(wheelSpin);
  });

  group.userData.wheels = carWheels;
  group.userData.height = 1.25;
  group.userData.length = 4.62;
  return group;
}

function populateTraffic(count) {
  trafficCars.forEach(c => trafficGroup.remove(c.mesh));
  trafficCars = [];

  if (currentMap === 'highway') {
    for (let i = 0; i < count; i++) {
      const laneIdx = i % LANE_COUNT;
      const laneX = LANE_CENTERS[laneIdx];
      const zPos = -420 + (i / count) * 760 + (Math.random() * 14 - 7);
      const safeZ = (Math.abs(zPos) < 22 && Math.abs(laneX - 2.5) < 4) ? zPos - 40 : zPos;

      const mesh = createTrafficVehicleMesh(i);
      mesh.position.set(laneX, 0, safeZ);
      mesh.rotation.y = 0;
      trafficGroup.add(mesh);

      const spd = 15 + (laneIdx * 2.2) + Math.random() * 3.5;
      trafficCars.push({
        mesh,
        mode: 'highway',
        laneIdx,
        targetX: laneX,
        speed: spd,
        vx: 0,
        vz: -spd,
        y: 0,
        blastVx: 0,
        blastVy: 0,
        blastVz: 0,
        blastVRoll: 0,
        blastVPitch: 0,
        blastVYaw: 0,
        blastTimer: 0,
        length: mesh.userData.length,
        height: mesh.userData.height,
        changeTimer: 2 + Math.random() * 6
      });
    }
  } else {
    for (let i = 0; i < count; i++) {
      const isNS = (i % 2 === 0);
      const roadCoord = CITY_ROAD_COORDS[i % CITY_ROAD_COORDS.length];
      const dir = (i % 4 < 2) ? 1 : -1;
      const laneOffset = dir > 0 ? 5.5 : -5.5;
      const travelPos = -360 + (i / count) * 720;
      const spd = 12 + (i % 5) * 2.0;

      const mesh = createTrafficVehicleMesh(i);
      let x = 0, z = 0, vx = 0, vz = 0, rotY = 0;

      if (isNS) {
        x = roadCoord + laneOffset;
        z = travelPos;
        if (Math.abs(x - 5.5) < 6 && Math.abs(z) < 25) z -= 45;
        vz = -dir * spd;
        rotY = dir > 0 ? 0 : Math.PI;
      } else {
        x = travelPos;
        z = roadCoord + laneOffset;
        if (Math.abs(x - 5.5) < 25 && Math.abs(z) < 6) x -= 45;
        vx = -dir * spd;
        rotY = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }

      mesh.position.set(x, 0, z);
      mesh.rotation.y = rotY;
      trafficGroup.add(mesh);

      trafficCars.push({
        mesh,
        mode: 'city',
        isNS,
        dir,
        speed: spd,
        vx,
        vz,
        y: 0,
        blastVx: 0,
        blastVy: 0,
        blastVz: 0,
        blastVRoll: 0,
        blastVPitch: 0,
        blastVYaw: 0,
        blastTimer: 0,
         baseRotY: rotY,
        length: mesh.userData.length,
        height: mesh.userData.height
      });
    }
  }
}

// =========================================================================
// REAL-TIME TIRE DRIFT & BRAKE LOCKUP SMOKE PARTICLE SYSTEM
// =========================================================================
const tireSmokeGroup = new THREE.Group();
scene.add(tireSmokeGroup);
const TIRE_SMOKE_MAX = 56;
const smokePuffGeo = new THREE.SphereGeometry(0.22, 7, 7);
const tireSmokePool = [];

for (let i = 0; i < TIRE_SMOKE_MAX; i++) {
  const sMat = new THREE.MeshBasicMaterial({
    color: 0xe2e8f0,
    transparent: true,
    opacity: 0.0,
    depthWrite: false
  });
  const sMesh = new THREE.Mesh(smokePuffGeo, sMat);
  sMesh.visible = false;
  tireSmokeGroup.add(sMesh);
  tireSmokePool.push({
    mesh: sMesh,
    mat: sMat,
    active: false,
    x: 0, y: 0, z: 0,
    vx: 0, vy: 0, vz: 0,
    scale: 0.2,
    maxScale: 1.1,
    opacity: 0.0,
    maxOpacity: 0.42,
    age: 0,
    lifetime: 0.72
  });
}

function spawnTireSmokePuff(wx, wy, wz, baseVx, baseVz, intensity = 1.0) {
  for (let i = 0; i < TIRE_SMOKE_MAX; i++) {
    const p = tireSmokePool[i];
    if (!p.active) {
      p.active = true;
      p.x = wx + (Math.random() - 0.5) * 0.12;
      p.y = Math.max(0.04, wy);
      p.z = wz + (Math.random() - 0.5) * 0.12;
      p.vx = baseVx * 0.2 + (Math.random() - 0.5) * 1.6;
      p.vy = 0.55 + Math.random() * 0.85;
      p.vz = baseVz * 0.2 + (Math.random() - 0.5) * 1.6;
      p.scale = 0.20 * intensity;
      p.maxScale = (0.75 + Math.random() * 0.65) * intensity;
      p.opacity = Math.min(0.55, 0.36 * intensity);
      p.maxOpacity = p.opacity;
      p.age = 0.0;
      p.lifetime = 0.65 + Math.random() * 0.35;
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.scale.set(p.scale, p.scale, p.scale);
      p.mat.opacity = p.opacity;
      p.mesh.visible = true;
      break;
    }
  }
}

function updateTireSmokeParticles(dt, scrollDz = 0.0) {
  for (let i = 0; i < TIRE_SMOKE_MAX; i++) {
    const p = tireSmokePool[i];
    if (p.active) {
      p.age += dt;
      const progress = p.age / p.lifetime;
      if (progress >= 1.0) {
        p.active = false;
        p.mesh.visible = false;
        p.mat.opacity = 0.0;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += (p.vz * dt) + scrollDz;
      p.vx *= Math.pow(0.45, dt);
      p.vz *= Math.pow(0.45, dt);
      const curScale = p.scale + (p.maxScale - p.scale) * Math.pow(progress, 0.58);
      p.mesh.scale.set(curScale, curScale, curScale);
      p.mesh.position.set(p.x, p.y, p.z);
      p.mat.opacity = p.maxOpacity * (1.0 - progress);
    }
  }
}

function clearTireSmoke() {
  for (let i = 0; i < TIRE_SMOKE_MAX; i++) {
    const p = tireSmokePool[i];
    p.active = false;
    p.mesh.visible = false;
    p.mat.opacity = 0.0;
  }
}
