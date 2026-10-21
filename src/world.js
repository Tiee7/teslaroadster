// =========================================================================
// 3. THREE.JS SCENE & DUAL-MAP ENVIRONMENTS (HIGHWAY vs. OPEN-WORLD CITY)
// =========================================================================
const container = document.getElementById('game-canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b16);
scene.fog = new THREE.FogExp2(0x070b16, 0.00045);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 4500);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0x94a3b8, 0.85);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xf8fafc, 1.45);
dirLight.position.set(45, 95, 60);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.bias = -0.0008;
dirLight.shadow.normalBias = 0.04;
scene.add(dirLight);

const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.55);
rimLight.position.set(-40, 30, -50);
scene.add(rimLight);

// Explicit renderer-only bridge: coast consumes focus without writing camera/physics.
scene.userData.coastArtBridge = Object.freeze({
  getFocus: () => camera.position,
  sharedLights: Object.freeze([ambientLight, dirLight, rimLight])
});

// underGlowLight removed per user request (eliminates weird blue light column under car)
const underGlowLight = { position: { set: () => {} }, intensity: 0 };

// High-Dynamic Automotive Studio Environment Reflection Map
function createAutomotiveStudioEnv() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d');

  const bgGrad = ctx.createLinearGradient(0, 0, 0, 512);
  bgGrad.addColorStop(0, '#0a0f1d');
  bgGrad.addColorStop(0.48, '#1e293b');
  bgGrad.addColorStop(0.52, '#0f172a');
  bgGrad.addColorStop(1, '#050811');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1024, 512);

  // Overhead Primary Studio Softbox
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(256, 30, 512, 75);

  // Curved Studio Light Tubes (Side Shoulder Highlights)
  ctx.fillStyle = '#e0f2fe';
  ctx.fillRect(40, 150, 944, 38);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(90, 205, 844, 18);

  // Horizon Rim Fill
  const rimGrad = ctx.createLinearGradient(0, 240, 0, 275);
  rimGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
  rimGrad.addColorStop(1, 'rgba(2, 132, 199, 0)');
  ctx.fillStyle = rimGrad;
  ctx.fillRect(0, 240, 1024, 35);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}
const studioEnvMap = createAutomotiveStudioEnv();

// Asphalt must not reflect the vehicle's imaginary studio softboxes. Keep that
// environment for the car, and give wet roads only a dim, continuous night sky.
function createWetRoadEnv() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, 128);
  sky.addColorStop(0, '#040812');
  sky.addColorStop(0.45, '#101c2a');
  sky.addColorStop(0.55, '#101c2a');
  sky.addColorStop(1, '#03060c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 256, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}
const wetRoadEnvMap = createWetRoadEnv();

// Deterministic, non-emissive microdetail. Repeat in metres rather than stretching
// one noise patch over an entire avenue; N-S and E-W roads use the same scale.
function createWetRoadDetail(width, length) {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  let seed = 1729;
  for (let i = 0; i < size * size; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    // r128 multiplies this green channel by material.roughness. Keep its floor
    // high enough to avoid reintroducing the rim light's saturated mirror spot.
    const grain = 240 + Math.floor((seed / 4294967296) * 16);
    data.set([grain, grain, grain, 255], i * 4);
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(width / 8, length / 8);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function applyRoadWeather(material, weather) {
  if (!material) return;
  material.roughness = weather.roadRoughness;
  material.metalness = weather.roadMetalness;
  material.envMapIntensity = weather.roadEnvIntensity;
  // null deliberately restores the existing scene environment in dry modes.
  material.envMap = weather.rain ? wetRoadEnvMap : null;
  material.roughnessMap = weather.rain ? material.userData.wetRoadDetail : null;
  material.bumpMap = weather.rain ? material.userData.wetRoadDetail : null;
  material.bumpScale = weather.rain ? 0.006 : 1;
  material.needsUpdate = true;
}

function createMarsSunsetEnv() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d');
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 512);
  bgGrad.addColorStop(0, '#180912');
  bgGrad.addColorStop(0.35, '#7c2d12');
  bgGrad.addColorStop(0.49, '#f97316');
  bgGrad.addColorStop(0.53, '#3b0714');
  bgGrad.addColorStop(1, '#090408');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1024, 512);

  // Blazing Mars Sunset Solar Core Reflection
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(220, 180, 584, 55);
  ctx.fillStyle = '#fb923c';
  ctx.fillRect(60, 120, 904, 38);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}
const marsSunsetEnvMap = createMarsSunsetEnv();
scene.environment = studioEnvMap;

// 3D Dynamic Weather Objects: Cyber Neon Rain Streaks & Mars Sunset Solar Disc
const rainCount = 1500;
const rainGeo = new THREE.BufferGeometry();
const rainPositions = new Float32Array(rainCount * 6);
for (let i = 0; i < rainCount; i++) {
  const rx = (Math.random() - 0.5) * 180;
  const ry = Math.random() * 90;
  const rz = (Math.random() - 0.5) * 180;
  rainPositions[i * 6] = rx;
  rainPositions[i * 6 + 1] = ry;
  rainPositions[i * 6 + 2] = rz;
  rainPositions[i * 6 + 3] = rx;
  rainPositions[i * 6 + 4] = ry - 2.6;
  rainPositions[i * 6 + 5] = rz;
}
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
const rainMat = new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.52 });
const rainLinesMesh = new THREE.LineSegments(rainGeo, rainMat);
rainLinesMesh.visible = false;
scene.add(rainLinesMesh);

const marsSunGroup = new THREE.Group();
const sunCoreMesh = new THREE.Mesh(
  new THREE.SphereGeometry(85, 32, 24),
  new THREE.MeshBasicMaterial({ color: 0xfef08a })
);
const sunHaloMesh = new THREE.Mesh(
  new THREE.RingGeometry(86, 145, 36),
  new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
);
marsSunGroup.add(sunCoreMesh, sunHaloMesh);
marsSunGroup.position.set(0, 140, -1450);
marsSunGroup.visible = false;
scene.add(marsSunGroup);


// Shared PBR Automotive & Aerospace Materials (Hoisted before Map & Vehicle Builders)

// Default Satin Ano White / Silver-White finish matching reference photos
const bodyMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xeef2f7,
  metalness: 0.55,
  roughness: 0.15,
  clearcoat: 1.0,
  clearcoatRoughness: 0.16,
  reflectivity: 1.0,
  envMapIntensity: 1.2,
  side: THREE.DoubleSide
});

const titaniumMaterial = new THREE.MeshStandardMaterial({
  color: 0x94a3b8,
  metalness: 0.95,
  roughness: 0.14,
  envMapIntensity: 1.6,
  side: THREE.DoubleSide
});

const carbonMaterial = new THREE.MeshStandardMaterial({
  color: 0x0c0f16,
  metalness: 0.55,
  roughness: 0.32,
  envMapIntensity: 0.85,
  side: THREE.DoubleSide
});

// Dark Bronze-Tinted Panoramic Glass Canopy matching reference photos
const goldCanopyMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x1e1512,
  emissive: 0x120b08,
  emissiveIntensity: 0.18,
  metalness: 0.92,
  roughness: 0.10,
  clearcoat: 1.0,
  clearcoatRoughness: 0.10,
  reflectivity: 1.0,
  envMapIntensity: 1.5,
  transparent: true,
  opacity: 0.92,
  side: THREE.DoubleSide
});

const cockpitMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.55 });
const whiteLeatherMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.1 });

const highwayEnvGroup = new THREE.Group();
scene.add(highwayEnvGroup);

const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, 2600);
const roadMat = new THREE.MeshStandardMaterial({
  color: 0x0f172a,
  roughness: 0.45,
  metalness: 0.35,
  envMapIntensity: 0.6,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1
});
roadMat.userData.wetRoadDetail = createWetRoadDetail(ROAD_WIDTH, 2600);
const roadMesh = new THREE.Mesh(roadGeo, roadMat);
roadMesh.rotation.x = -Math.PI / 2;
roadMesh.receiveShadow = true;
highwayEnvGroup.add(roadMesh);

const shoulderGeo = new THREE.BoxGeometry(1.2, 0.65, 2600);
const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.4 });
const leftRail = new THREE.Mesh(shoulderGeo, shoulderMat);
leftRail.position.set(-ROAD_WIDTH / 2 - 0.6, 0.32, 0);
const rightRail = new THREE.Mesh(shoulderGeo, shoulderMat);
rightRail.position.set(ROAD_WIDTH / 2 + 0.6, 0.32, 0);
highwayEnvGroup.add(leftRail, rightRail);

const edgeGeo = new THREE.PlaneGeometry(0.22, 2600);
const edgeMat = new THREE.MeshBasicMaterial({
  color: 0x38bdf8,
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -4
});
const leftEdge = new THREE.Mesh(edgeGeo, edgeMat);
leftEdge.rotation.x = -Math.PI / 2;
leftEdge.position.set(-ROAD_WIDTH / 2 + 0.2, 0.06, 0);
const rightEdge = new THREE.Mesh(edgeGeo, edgeMat);
rightEdge.rotation.x = -Math.PI / 2;
rightEdge.position.set(ROAD_WIDTH / 2 - 0.2, 0.06, 0);
highwayEnvGroup.add(leftEdge, rightEdge);

const scrollingProps = [];
const dashGeo = new THREE.PlaneGeometry(0.15, 4.5);
const dashMat = new THREE.MeshBasicMaterial({
  color: 0x64748b,
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -4
});
const centerDividerMat = new THREE.MeshBasicMaterial({
  color: 0xf59e0b,
  polygonOffset: true,
  polygonOffsetFactor: -5,
  polygonOffsetUnits: -5
});

for (let z = -420; z < 420; z += 14) {
  for (let l = 1; l < LANE_COUNT; l++) {
    const x = -ROAD_WIDTH / 2 + l * LANE_WIDTH;
    const dash = new THREE.Mesh(dashGeo, l === 3 ? centerDividerMat : dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(x, 0.06, z);
    highwayEnvGroup.add(dash);
    scrollingProps.push(dash);
  }
}

const pillarGeo = new THREE.BoxGeometry(0.6, 24, 0.6);
const pillarMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.3 });
const beamGeo = new THREE.BoxGeometry(ROAD_WIDTH + 3, 0.5, 0.5);
const neonBeamGeo = new THREE.BoxGeometry(ROAD_WIDTH, 0.14, 0.18);
const neonBeamMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9 });
const marker6mGeo = new THREE.BoxGeometry(0.85, 0.18, 0.85);
const marker6mMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });

for (let z = -420; z < 420; z += 60) {
  const arch = new THREE.Group();
  const pL = new THREE.Mesh(pillarGeo, pillarMat);
  pL.position.set(-ROAD_WIDTH / 2 - 1.1, 12, 0);
  const pR = new THREE.Mesh(pillarGeo, pillarMat);
  pR.position.set(ROAD_WIDTH / 2 + 1.1, 12, 0);
  // 6.0m visual altitude calibration rings on highway pillars
  const m6L = new THREE.Mesh(marker6mGeo, marker6mMat);
  m6L.position.set(-ROAD_WIDTH / 2 - 1.1, 6.0, 0);
  const m6R = new THREE.Mesh(marker6mGeo, marker6mMat);
  m6R.position.set(ROAD_WIDTH / 2 + 1.1, 6.0, 0);
  const topBeam = new THREE.Mesh(beamGeo, pillarMat);
  topBeam.position.set(0, 24, 0);
  const neonBar = new THREE.Mesh(neonBeamGeo, neonBeamMat);
  neonBar.position.set(0, 23.7, 0);
  arch.add(pL, pR, m6L, m6R, topBeam, neonBar);
  arch.position.z = z;
  highwayEnvGroup.add(arch);
  scrollingProps.push(arch);
}


const cityEnvGroup = new THREE.Group();
cityEnvGroup.visible = false;
scene.add(cityEnvGroup);

const cityBuildings = [];
let cityAsphaltMat = null;
let cityAsphaltEWMat = null;
function buildOpenWorldCity() {
  const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF_BOUND * 2 + 120, CITY_HALF_BOUND * 2 + 120),
    new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.85,
      metalness: 0.1,
      polygonOffset: true,
      polygonOffsetFactor: 4,
      polygonOffsetUnits: 4
    })
  );
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = -0.18;
  groundMesh.receiveShadow = true;
  cityEnvGroup.add(groundMesh);

  cityAsphaltMat = new THREE.MeshStandardMaterial({
    color: 0x111c2e,
    roughness: 0.42,
    metalness: 0.38,
    envMapIntensity: 0.65,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });
  cityAsphaltEWMat = new THREE.MeshStandardMaterial({
    color: 0x111c2e,
    roughness: 0.42,
    metalness: 0.38,
    envMapIntensity: 0.65,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  cityAsphaltMat.userData.wetRoadDetail = createWetRoadDetail(CITY_ROAD_WIDTH, CITY_HALF_BOUND * 2);
  cityAsphaltEWMat.userData.wetRoadDetail = createWetRoadDetail(CITY_HALF_BOUND * 2, CITY_ROAD_WIDTH);
  const yellowLineMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    polygonOffset: true,
    polygonOffsetFactor: -6,
    polygonOffsetUnits: -6
  });
  const crosswalkWhiteMat = new THREE.MeshBasicMaterial({
    color: 0xe2e8f0,
    polygonOffset: true,
    polygonOffsetFactor: -8,
    polygonOffsetUnits: -8
  });

  const cityLanePaint = [], cityCrosswalkPaint = [];
  CITY_ROAD_COORDS.forEach((coord) => {
    const nsRoad = new THREE.Mesh(new THREE.PlaneGeometry(CITY_ROAD_WIDTH, CITY_HALF_BOUND * 2), cityAsphaltMat);
    nsRoad.rotation.x = -Math.PI / 2;
    nsRoad.position.set(coord, 0.02, 0);
    cityEnvGroup.add(nsRoad);

    const nsCenter = new THREE.Mesh(new THREE.PlaneGeometry(0.28, CITY_HALF_BOUND * 2), yellowLineMat);
    nsCenter.rotation.x = -Math.PI / 2;
    nsCenter.position.set(coord, 0.09, 0);
    cityEnvGroup.add(nsCenter);

    const ewRoad = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF_BOUND * 2, CITY_ROAD_WIDTH), cityAsphaltEWMat);
    ewRoad.rotation.x = -Math.PI / 2;
    ewRoad.position.set(0, 0.05, coord);
    cityEnvGroup.add(ewRoad);

    const ewCenter = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF_BOUND * 2, 0.28), yellowLineMat);
    ewCenter.rotation.x = -Math.PI / 2;
    ewCenter.position.set(0, 0.11, coord);
    cityEnvGroup.add(ewCenter);

    // Add dashed lane dividers along every N-S and E-W avenue (skipping intersection interiors to prevent overlap)
    for (let dPos = -CITY_HALF_BOUND + 24; dPos <= CITY_HALF_BOUND - 24; dPos += 16) {
      if (CITY_ROAD_COORDS.some((c) => Math.abs(dPos - c) < CITY_ROAD_WIDTH / 2 + 3)) continue;
      [-1, 1, -2, 2].map(lane => lane * CITY_LANE_WIDTH).forEach((laneOff) => {
        cityLanePaint.push([coord + laneOff, 0.08, dPos, 0.16, 4.8], [dPos, 0.10, coord + laneOff, 4.8, 0.16]);
      });
    }

    CITY_ROAD_COORDS.forEach((crossCoord) => {
      for (let s = -CITY_ROAD_WIDTH / 2 + 1.5; s <= CITY_ROAD_WIDTH / 2 - 1.5; s += 3.0) {
        cityCrosswalkPaint.push([coord + s, 0.13, crossCoord + CITY_ROAD_WIDTH / 2 + 1.5, 1.4, 0.5],
          [coord + s, 0.13, crossCoord - CITY_ROAD_WIDTH / 2 - 1.5, 1.4, 0.5]);
      }
    });
  });

  // Same paint footprints, two draw calls instead of >8,000 separate meshes.
  // No new scenery lights/shadows/obstacles; near street frontage reuses towers.
  function batchCityPaint(name, marks, material) {
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, marks.length);
    const pose = new THREE.Object3D(); pose.rotation.x = -Math.PI / 2;
    marks.forEach(([x, y, z, w, d], i) => {
      pose.position.set(x, y, z); pose.scale.set(w, d, 1); pose.updateMatrix(); mesh.setMatrixAt(i, pose.matrix);
    });
    mesh.frustumCulled = false;
    mesh.name = name; mesh.userData.cityPaintCount = marks.length;
    mesh.instanceMatrix.needsUpdate = true; cityEnvGroup.add(mesh);
  }
  batchCityPaint('city-lane-paint', cityLanePaint, dashMat);
  batchCityPaint('city-crosswalk-paint', cityCrosswalkPaint, crosswalkWhiteMat);

  // City Energy Boundary Walls (Taller 45m perimeter shield)
  const wallHeight = 45;
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x0369a1,
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.38
  });
  const topRailMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

  const borderDefs = [
    { x: 0, z: -CITY_HALF_BOUND, w: CITY_HALF_BOUND * 2, d: 2.0 },
    { x: 0, z: CITY_HALF_BOUND, w: CITY_HALF_BOUND * 2, d: 2.0 },
    { x: -CITY_HALF_BOUND, z: 0, w: 2.0, d: CITY_HALF_BOUND * 2 },
    { x: CITY_HALF_BOUND, z: 0, w: 2.0, d: CITY_HALF_BOUND * 2 }
  ];
  borderDefs.forEach((b) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(b.w, wallHeight, b.d), wallMat);
    wall.position.set(b.x, wallHeight / 2, b.z);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.6, b.d), topRailMat);
    cap.position.set(b.x, wallHeight, b.z);
    cityEnvGroup.add(wall, cap);
  });

  // Street-view hierarchy: low mid-block frontage, tall forms set well inside.
  // No per-frame occluder hiding and no extra lights: the geometry itself clears junctions.
  const bldgMats = [
    new THREE.MeshStandardMaterial({ color: 0x283241, metalness: 0.34, roughness: 0.62 }),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.34, roughness: 0.62 })
  ];
  const windowLitMat = new THREE.MeshBasicMaterial({ color: 0x648391 });
  const windowWarmMat = new THREE.MeshBasicMaterial({ color: 0x918b75 });
  const trimMat = new THREE.MeshBasicMaterial({ color: 0x356678 });
  const landmarkTrimMat = new THREE.MeshBasicMaterial({ color: 0x3c9aaf });
  const helipadRingMat = new THREE.MeshBasicMaterial({ color: 0x67bdd0 });
  const helipadMarkMat = new THREE.MeshBasicMaterial({ color: 0xc6d1d9 });
  const towersForSkybridges = [];
  const blockCenters = [-1050, -750, -450, -150, 150, 450, 750, 1050];
  let bIdx = 0;
  function addCityBuilding(bx, bz, ox, oz, w, d, h, kind, district, bridgePair = null) {
    const isLandmark = kind === 'landmark', isHelipadTower = kind !== 'low';
    const bMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bldgMats[district % 2]);
    bMesh.name = `city-building-${bIdx}`;
    bMesh.position.set(ox, h / 2, oz);
    bMesh.castShadow = true; bMesh.receiveShadow = true;
    cityEnvGroup.add(bMesh);
    const bands = kind === 'low' ? [0.3, 0.7] : [0.2, 0.4, 0.6, 0.8];
    bands.forEach(level => {
      const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.4, d + 0.3), district % 2 ? windowWarmMat : windowLitMat);
      band.position.set(ox, h * level, oz); cityEnvGroup.add(band);
    });
    if (kind === 'low') {
      const coping = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.4, d + 0.4), bldgMats[district % 2]);
      coping.position.set(ox, h - 0.2, oz); cityEnvGroup.add(coping);
    } else {
      const corners = isLandmark ? [[-1,-1],[1,-1],[-1,1],[1,1]] : [[-1,-1],[1,1]];
      const stripGeo = new THREE.BoxGeometry(0.3, h, 0.3);
      corners.forEach(([x,z]) => {
        const strip = new THREE.Mesh(stripGeo, isLandmark ? landmarkTrimMat : trimMat);
        strip.position.set(ox + x * (w / 2 + 0.05), h / 2, oz + z * (d / 2 + 0.05)); cityEnvGroup.add(strip);
      });
    }
    if (isHelipadTower) {
      const padR = Math.min(w, d) * 0.38;
      const padCircle = new THREE.Mesh(new THREE.CylinderGeometry(padR, padR, 0.25, 24), bldgMats[0]);
      padCircle.position.set(ox, h + 0.12, oz);

      const padOuterRing = new THREE.Mesh(
        new THREE.RingGeometry(padR * 0.85, padR, 24).rotateX(-Math.PI / 2),
        helipadRingMat
      );
      padOuterRing.position.set(ox, h + 0.28, oz);

      const bar1 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, padR * 1.1).rotateX(-Math.PI / 2), helipadMarkMat);
      bar1.position.set(ox - padR * 0.28, h + 0.30, oz);
      const bar2 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, padR * 1.1).rotateX(-Math.PI / 2), helipadMarkMat);
      bar2.position.set(ox + padR * 0.28, h + 0.30, oz);
      const barMid = new THREE.Mesh(new THREE.PlaneGeometry(padR * 0.62, 1.6).rotateX(-Math.PI / 2), helipadMarkMat);
      barMid.position.set(ox, h + 0.30, oz);

      cityEnvGroup.add(padCircle, padOuterRing, bar1, bar2, barMid);

      const skyBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 1.2, 14, 12),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.10, side: THREE.DoubleSide })
      );
      skyBeam.position.set(ox, h + 7, oz);
      cityEnvGroup.add(skyBeam);
    }

    const buildingDef = {
      id: bIdx, kind, blockX: bx, blockZ: bz,
      minX: ox - w / 2, maxX: ox + w / 2, minZ: oz - d / 2, maxZ: oz + d / 2,
      x: ox, z: oz, w, d, height: h, isHelipad: isHelipadTower,
      bridgePair
    };
    cityBuildings.push(buildingDef);
    if (bridgePair !== null) towersForSkybridges.push(buildingDef);
    bIdx++;
  }
  blockCenters.forEach((bx, ix) => {
    blockCenters.forEach((bz, iz) => {
      const district = Math.floor(ix / 2) + Math.floor(iz / 2);
      const frontage = [36, 42, 48][district % 3], lowH = [18, 22, 26, 28][district % 4];
      const side = (ix % 2 === 0) ? 1 : -1;
      const alongX = (ix + iz) % 2 === 0;
      const w = alongX ? 30 : frontage, d = alongX ? frontage : 30;
      const offset = 150 - CITY_ROAD_WIDTH / 2 - CITY_BUILDING_SETBACK - 15;
      addCityBuilding(bx, bz, bx + (alongX ? side * offset : 0), bz + (alongX ? 0 : side * offset), w, d, lowH, 'low', district);
      // Preserve both original bridge locations explicitly, not by array order.
      const bridgePair = bx === -750 && (bz === -1050 || bz === -750) ? bz : null;
      if (bridgePair !== null) {
        for (const offsetX of [-34, 34]) addCityBuilding(bx, bz, bx + offsetX, bz, 44, 44, offsetX < 0 ? 108 : 120, 'tower', district, bridgePair);
      } else if ((ix + iz) % 2 === 1) {
        const landmark = bx === 150 && bz === -150;
        addCityBuilding(bx, bz, bx, bz, landmark ? 58 : 44, landmark ? 58 : 44,
          landmark ? 180 : [76, 92, 108, 120][district % 4], landmark ? 'landmark' : 'tower', district);
      }
    });
  });

  // High-Altitude Glass Pedestrian Skybridges (at 60m - 170m altitude)
  const skybridgeMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.8,
    roughness: 0.2,
    transparent: true,
    opacity: 0.88
  });
  const skybridgeGlowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

  for (let i = 0; i < towersForSkybridges.length - 1; i += 2) {
    const t1 = towersForSkybridges[i];
    const t2 = towersForSkybridges[i + 1];
    const dist = Math.hypot(t1.x - t2.x, t1.z - t2.z);
    if (t1.bridgePair === t2.bridgePair) {
      const bridgeH = Math.min(t1.height, t2.height) * 0.72;
      const midX = (t1.x + t2.x) / 2;
      const midZ = (t1.z + t2.z) / 2;
      const angle = Math.atan2(t2.z - t1.z, t2.x - t1.x);

      const bridgeGroup = new THREE.Group();
      bridgeGroup.position.set(midX, bridgeH, midZ);
      bridgeGroup.rotation.y = -angle;

      const bridgeBody = new THREE.Mesh(new THREE.BoxGeometry(dist, 4.2, 5.8), skybridgeMat);
      const topLightBar = new THREE.Mesh(new THREE.BoxGeometry(dist, 0.3, 6.0), skybridgeGlowMat);
      topLightBar.position.y = 2.15;
      const btmLightBar = new THREE.Mesh(new THREE.BoxGeometry(dist, 0.3, 6.0), skybridgeGlowMat);
      btmLightBar.position.y = -2.15;
      bridgeGroup.add(bridgeBody, topLightBar, btmLightBar);
      cityEnvGroup.add(bridgeGroup);
    }
  }
}

buildOpenWorldCity();
