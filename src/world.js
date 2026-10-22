// =========================================================================
// 3. THREE.JS SCENE & DUAL-MAP ENVIRONMENTS (HIGHWAY vs. OPEN-WORLD CITY)
// =========================================================================
const container = document.getElementById('game-canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b16);
scene.fog = new THREE.FogExp2(0x070b16, 0.00045);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 4500);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'default' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.matchMedia?.('(pointer: coarse)').matches ? 1.25 : 1.5));
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
    for (let dPos = -CITY_HALF_BOUND + 24; dPos <= CITY_HALF_BOUND - 24; dPos += 8) {
      if (CITY_ROAD_COORDS.some((c) => Math.abs(dPos - c) < CITY_ROAD_WIDTH / 2 + 3)) continue;
      [-1, 1, -2, 2].map(lane => lane * CITY_LANE_WIDTH).forEach((laneOff) => {
        cityLanePaint.push([coord + laneOff, 0.08, dPos, 0.16, 3.0], [dPos, 0.10, coord + laneOff, 3.0, 0.16]);
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
  const cityDashMat = new THREE.MeshBasicMaterial({ color: 0xd9dfe5, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  batchCityPaint('city-lane-paint', cityLanePaint, cityDashMat);
  batchCityPaint('city-crosswalk-paint', cityCrosswalkPaint, crosswalkWhiteMat);

  // Flat mineral paving gives each avenue an ordered edge without adding raised
  // curbs or invisible obstacles. Cross streets render above these ground strips.
  const cityPavingMat=new THREE.MeshStandardMaterial({color:0x26343f,roughness:.94,metalness:.02});
  const paving=[];CITY_ROAD_COORDS.forEach(c=>{for(const sign of[-1,1])paving.push([c+sign*(CITY_ROAD_WIDTH/2+4),-.13,0,8,CITY_HALF_BOUND*2],[0,-.13,c+sign*(CITY_ROAD_WIDTH/2+4),CITY_HALF_BOUND*2,8]);});
  batchCityPaint('city-avenue-paving',paving,cityPavingMat);

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
  // Original procedural façades: three related contemporary families, no
  // fetched game assets. World-metre UVs keep windows human-sized on tall slabs.
  const cityFamilies = ['graphite-server', 'copper-foundry', 'violet-glass', 'ceramic-grid', 'teal-data', 'indigo-ribs'];
  const familyColors = [0xadb9cd,0xc2a7a0,0xa9a0c4,0xc0c7d1,0x91b8bd,0xa5aecb];
  const bldgMats = cityFamilies.map((family, familyIndex) => {
    const size=128,pixels=new Uint8Array(size*size*4),emission=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const cx=x%64,cy=y%64;
      const window=familyIndex===0?cx>9&&cx<24&&cy>6&&cy<57:familyIndex===1?cx>8&&cx<56&&cy>24&&cy<43:familyIndex===2?cx>3&&cx<61:familyIndex===3?cx>14&&cx<49&&cy>12&&cy<53:familyIndex===4?cx>7&&cx<58:cx>20&&cx<44&&cy>5&&cy<59;
      const seam=familyIndex===5?x%16<3:x%64<3||y%64<3;
      const glass=familyIndex===2||familyIndex===4,rgb=window?(glass?[15,26,43]:[27,42,61]):seam?[48,57,75]:glass?[42,55,76]:[94,104,123],i=(y*size+x)*4;
      const lit=window&&(familyIndex===2?cx<7:familyIndex===4?cx>42&&cx<47&&y%128>8&&y%128<110:((Math.floor(x/64)*7+Math.floor(y/64)*3+familyIndex)%4!==0)),tint=[[55,206,232],[244,147,66],[204,94,222],[158,199,222],[56,204,176],[127,148,235]][familyIndex];
      for(let k=0;k<3;k++){pixels[i+k]=rgb[k];emission[i+k]=lit?tint[k]:0;}pixels[i+3]=emission[i+3]=255;
    }
    const texture=data=>{const map=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;return map;};
    const map=texture(pixels),emissiveMap=texture(emission);map.name=`city-original-${family}`;
    const material=new THREE.MeshStandardMaterial({color:0x9aa8bf,map,emissive:0xffffff,emissiveMap,emissiveIntensity:.42,metalness:familyIndex===2?.28:.10,roughness:familyIndex===2?.48:.78});
    material.userData.cityFamily=family;
    material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
#ifdef USE_MAP
#ifdef USE_INSTANCING
 vec3 citySize=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
 vUv=abs(normal.y)>.5?vec2(.52,.52):uv*vec2(abs(normal.x)>.5?citySize.z:citySize.x,citySize.y)/7.2;
#endif
#endif`);
    };
    material.customProgramCacheKey=()=> 'city-world-metre-facade-cyber-v3';
    return material;
  });
  // The city is a coherent contemporary/cyber district, not six unrelated eras.
  // Three glazing/shell signatures share a cool mineral palette and metre modules.
  let cityDaySky=null;
  cityEnvGroup.userData.daySky=()=>{
    if(cityDaySky)return cityDaySky;
    const size=128,faces=[],mix=(a,b,t)=>a+(b-a)*t,smooth=t=>t*t*(3-2*t);
    const hash=(x,z)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);};
    const noise=(x,z)=>{const ix=Math.floor(x),iz=Math.floor(z),u=smooth(x-ix),v=smooth(z-iz);return mix(mix(hash(ix,iz),hash(ix+1,iz),u),mix(hash(ix,iz+1),hash(ix+1,iz+1),u),v);};
    for(let face=0;face<6;face++){
      const data=new Uint8Array(size*size*4);
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const u=(x+.5)/size*2-1,v=(y+.5)/size*2-1;
        const d=face===0?[1,-v,-u]:face===1?[-1,-v,u]:face===2?[u,1,v]:face===3?[u,-1,-v]:face===4?[u,-v,1]:[-u,-v,-1],len=Math.hypot(...d),h=d[1]/len;
        const top=[70,123,178],horizon=[190,211,224],ground=[69,86,99],w=Math.pow(Math.min(1,Math.abs(h)),.62),a=horizon,b=h>=0?top:ground;
        const qx=d[0]/len/(Math.max(.02,h)+.22),qz=d[2]/len/(Math.max(.02,h)+.22);
        // Rotate/warp the static cloud domain so scalar-noise cells do not read
        // as axis-aligned tiles. Soft contrast, no sun disc or per-frame work.
        const rx=qx*.866+qz*.5,rz=qz*.866-qx*.5,wx=rx+.45*noise(rx*1.3+9,rz*1.3+3),wz=rz+.45*noise(rx*1.3+31,rz*1.3+17);
        const cloudNoise=(noise(wx*1.6+13,wz*1.6+7)+.5*noise(wx*3.3+41,wz*3.3+19)+.25*noise(wx*6.7,wz*6.7))/1.75;
        const cloud=h>.025?smooth(Math.max(0,Math.min(1,(cloudNoise-.49)/.28)))*Math.min(1,(h-.025)/.15)*.43:0,i=(y*size+x)*4;
        for(let k=0;k<3;k++)data[i+k]=Math.round(mix(mix(a[k],b[k],w),[226,234,239][k],cloud));data[i+3]=255;
      }
      const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);texture.needsUpdate=true;faces.push(texture);
    }
    cityDaySky=new THREE.CubeTexture(faces);cityDaySky.name='city-clear-day-sky';cityDaySky.format=THREE.RGBAFormat;cityDaySky.generateMipmaps=true;cityDaySky.minFilter=THREE.LinearMipmapLinearFilter;cityDaySky.magFilter=THREE.LinearFilter;cityDaySky.needsUpdate=true;
    return cityDaySky;
  };
  // One cached direction-continuous night cube. Original static pixels, no
  // animated volumetrics, bloom pass or extra light per building.
  let cityNightSky=null;
  cityEnvGroup.userData.nightSky=()=>{
    if(cityNightSky)return cityNightSky;const size=128,faces=[];
    for(let face=0;face<6;face++){const data=new Uint8Array(size*size*4);
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){const u=(x+.5)/size*2-1,v=(y+.5)/size*2-1,d=face===0?[1,-v,-u]:face===1?[-1,-v,u]:face===2?[u,1,v]:face===3?[u,-1,-v]:face===4?[u,-v,1]:[-u,-v,-1],len=Math.hypot(...d),h=d[1]/len;
        const haze=Math.exp(-Math.abs(h)*7),cloud=h>0?Math.pow(.5+.5*Math.sin(d[0]/len*6+d[2]/len*3+h*11),3)*Math.exp(-Math.pow((h-.32)*5,2)):0,i=(y*size+x)*4;
        const top=[7,8,25],horizon=[29,49,68];for(let k=0;k<3;k++)data[i+k]=Math.round(top[k]+(horizon[k]-top[k])*haze+[8,5,13][k]*cloud);data[i+3]=255;
      }const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);texture.needsUpdate=true;faces.push(texture);
    }cityNightSky=new THREE.CubeTexture(faces);cityNightSky.name='city-cyber-night-sky';cityNightSky.format=THREE.RGBAFormat;cityNightSky.generateMipmaps=true;cityNightSky.minFilter=THREE.LinearMipmapLinearFilter;cityNightSky.magFilter=THREE.LinearFilter;cityNightSky.needsUpdate=true;return cityNightSky;
  };
  const windowLitMat = new THREE.MeshBasicMaterial({ color: 0x648391 });
  const windowWarmMat = new THREE.MeshBasicMaterial({ color: 0x918b75 });
  const trimMat = new THREE.MeshBasicMaterial({ color: 0x356678 });
  const landmarkTrimMat = new THREE.MeshBasicMaterial({ color: 0x3c9aaf });
  const helipadRingMat = new THREE.MeshBasicMaterial({ color: 0x67bdd0 });
  const helipadMarkMat = new THREE.MeshBasicMaterial({ color: 0xc6d1d9 });
  cityEnvGroup.userData.applyWeather = (preset) => {
    const day = Boolean(preset.daylight);
    groundMesh.material.color.setHex(day?0x34434f:0x090d16);cityPavingMat.color.setHex(day?0x697a86:0x26343f);
    bldgMats.forEach(mat=>{mat.color.setHex(day?0xe5eaf2:0x9aa8bf);mat.emissiveIntensity=day?.035:.42;});
    windowLitMat.color.setHex(day ? 0x6b8191 : 0x57b6c9);
    windowWarmMat.color.setHex(day ? 0x7e878a : 0xc68b63);
    trimMat.color.setHex(day ? 0x596f7b : 0x34b6c9);
    cityAsphaltMat.color.setHex(day ? 0x3b424a : 0x1b2633);
    cityAsphaltEWMat.color.copy(cityAsphaltMat.color);
    for (const mat of [cityAsphaltMat, cityAsphaltEWMat]) {
      mat.roughness = preset.rain ? 0.58 : day ? 0.86 : 0.72;
      mat.metalness = preset.rain ? 0.0 : 0.06;
      mat.envMapIntensity = preset.rain ? 0.50 : day ? 0.25 : 0.36;
    }
  };
  const towersForSkybridges = [];
  const blockCenters = [-1050, -750, -450, -150, 150, 450, 750, 1050];
  const cityBodies=cityFamilies.map(()=>[]),cityBands=[[],[]],cityCornices=[[],[]],cityStrips=[[],[]];
  const cityPads=[],cityPadRings=[],cityPadLetters=[],cityBeams=[],citySigns=[];
  let bIdx = 0;
  function addCityBuilding(bx, bz, ox, oz, w, d, h, kind, district, bridgePair = null, minY=0, logicalId=null) {
    const isLandmark=kind==='landmark',isHelipadTower=kind==='tower'||isLandmark;
    logicalId??=`legacy-${bIdx}`;const solidHeight=h-minY;
    const family=district%cityFamilies.length;
    const renderBatch=`city-building-batch-${family}`,renderIndex=cityBodies[family].length;
    cityBodies[family].push({p:[ox,(h+minY)/2,oz],s:[w,solidHeight,d],color:familyColors[family],id:bIdx});
    // A few broad architectural courses, not thousands of per-window scene nodes.
    for(const level of(kind==='low'?[.15,.84]:kind.startsWith('cyber-')?[.86]:[.2,.4,.6,.8]))cityBands[district%2].push({p:[ox,minY+solidHeight*level,oz],s:[w,.22,d]});
    if(kind==='low')cityCornices[district%2].push({p:[ox,h-.2,oz],s:[w,.4,d]});
    else if(!kind.startsWith('cyber-')||solidHeight>=40)for(const[x,z]of(isLandmark?[[-1,-1],[1,-1],[-1,1],[1,1]]:[[-1,-1],[1,1]]))cityStrips[isLandmark?1:0].push({p:[ox+x*(w/2-.02),(h+minY)/2,oz+z*(d/2-.02)],s:[.18,solidHeight,.18]});
    if(isHelipadTower){
      const r=Math.min(w,d)*.38;cityPads.push({p:[ox,h+.12,oz],s:[r,.25,r]});cityPadRings.push({p:[ox,h+.28,oz],s:[r,1,r]});
      cityPadLetters.push({p:[ox-r*.28,h+.30,oz],s:[1.6,1,r*1.1]},{p:[ox+r*.28,h+.30,oz],s:[1.6,1,r*1.1]},{p:[ox,h+.30,oz],s:[r*.62,1,1.6]});cityBeams.push({p:[ox,h+7,oz],s:[1,1,1]});
    }
    if(kind==='low'){
      const ns=Math.abs(ox-bx)>Math.abs(oz-bz);for(const sign of[-1,1])citySigns.push({p:[ox+(ns?0:sign*(w/2+.016)),Math.min(9,h*.34),oz+(ns?sign*(d/2+.016):0)],s:[(ns?w:d)*.88,3.8,1],r:[0,ns?(sign>0?0:Math.PI):sign*Math.PI/2,0],tile:(bIdx*7)%16,color:[0x55d8ed,0xef70c8,0xffb85e][district%3]});
    }
    if((oz===-220&&ox===76)||(oz===-240&&ox===-52))citySigns.push({p:[ox,ox>0?75:68,oz+d/2+.016],s:[12,40,1],r:[0,0,0],tile:ox>0?9:8,color:ox>0?0x59e5eb:0xf675cf,feature:true});
    const buildingDef={id:bIdx,logicalId,minY,kind,blockX:bx,blockZ:bz,minX:ox-w/2,maxX:ox+w/2,minZ:oz-d/2,maxZ:oz+d/2,x:ox,z:oz,w,d,height:h,isHelipad:isHelipadTower,bridgePair,
      avenueAccent:(oz===-220&&ox===76)||(oz===-240&&ox===-52),family:cityFamilies[family],renderBatch,renderIndex};
    cityBuildings.push(buildingDef);if(bridgePair!==null)towersForSkybridges.push(buildingDef);bIdx++;
  }
  blockCenters.forEach((bx, ix) => {
    blockCenters.forEach((bz, iz) => {
      const district = Math.floor(ix / 2) + Math.floor(iz / 2);
      const frontage = [36, 42, 48][district % 3], lowH = [28, 32, 36, 42][district % 4];
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
        const accent = landmark || (bx === -150 && bz === -450);
        const ox = landmark ? 76 : accent ? -52 : bx, oz = landmark ? -220 : accent ? -240 : bz;
        addCityBuilding(bx, accent ? -150 : bz, ox, oz, landmark ? 58 : accent ? 22 : 44, landmark ? 58 : accent ? 22 : 44,
          landmark ? 180 : accent ? 96 : [76, 92, 108, 120][district % 4], landmark ? 'landmark' : 'tower', district);
      }
    });
  });

  // Two opposite mid-block frontages leave both cross-street sides open.
  // Keep the original 99 IDs and all35 pads/two bridge pairs intact.
  blockCenters.forEach((bx,ix)=>blockCenters.forEach((bz,iz)=>{
    const district=Math.floor(ix/2)+Math.floor(iz/2),side=ix%2===0?1:-1,alongX=(ix+iz)%2===0;
    const offset=150-CITY_ROAD_WIDTH/2-CITY_BUILDING_SETBACK-15;
    const slots=alongX?[[-side*offset,0]]:[[0,-side*offset]];
    slots.forEach(([dx,dz],j)=>{const frontage=[36,42,48][(district+j+1)%3],h=[24,30,34,38][(district*2+j+1)%4];
      addCityBuilding(bx,bz,bx+dx,bz+dz,dx?30:frontage,dx?frontage:30,h,'low',(ix*3+iz+j)%cityFamilies.length);
    });
  }));
  // Four infill plots per block, six layered silhouettes. Every opaque mass
  // is its own exact render/collision box, including its real base elevation.
  // Upper masses stay within the ground podium: no outer-AABB air walls.
  let infill=0;const silhouettes=['stepped-server','split-shoulder','slim-spire','commerce-stack','foundry-core','terraced-data'];
  blockCenters.forEach((bx,ix)=>blockCenters.forEach((bz,iz)=>{
    for(let q=0;q<4;q++){
      const sx=q%2?1:-1,sz=q<2?-1:1,style=(ix*3+iz+q)%6,seed=ix*37+iz*17+q*11;
      const w=44+(seed%4)*4,d=44+((seed>>2)%4)*4;
      const candidates=[[sx*74,sz*74],[sx*68,sz*42],[sx*42,sz*78],[sx*92,sz*52],[sx*52,sz*92]];
      const slot=candidates.find(([dx,dz])=>!cityBuildings.some(b=>b.minY===0&&bx+dx+w/2+3>b.minX&&bx+dx-w/2-3<b.maxX&&bz+dz+d/2+3>b.minZ&&bz+dz-d/2-3<b.maxZ));if(!slot)continue;
      const x=bx+slot[0],z=bz+slot[1],id=`cyber-${ix}-${iz}-${q}`,district=(ix+iz*2+q)%6;
      const core=Math.abs(bx)<500&&Math.abs(bz)<500,top=style===2?(core?172:132):style===0?104+(seed%4)*12:style===1?76+(seed%3)*10:style===3?38+(seed%3)*7:style===4?62+(seed%3)*8:88+(seed%3)*10;
      const base=14+(seed%4)*3;addCityBuilding(bx,bz,x,z,w,d,base,'cyber-podium',district,null,0,id);
      const upperW=Math.round(w*(style===2?.48:style===3?.82:.70)*2)/2,upperD=Math.round(d*(style===1?.54:.72)*2)/2;
      addCityBuilding(bx,bz,x,z,upperW,upperD,style===2?top-20:top,'cyber-'+silhouettes[style],district,null,base,id);
      if(style===0||style===2||style===5){const capBase=style===2?top-20:top;addCityBuilding(bx,bz,x,z,Math.round(upperW*.62*2)/2,Math.round(upperD*.64*2)/2,top+(style===2?0:12),'cyber-crown',district,null,capBase,id);}
      // Flush non-solid illuminated wall graphics, not physical overhangs.
      if(q!==3){const nx=(Math.abs(slot[0])>=Math.abs(slot[1]))?sx:0,nz=nx?0:sz;
        citySigns.push({p:[x+nx*(w/2+.016),base*.55,z+nz*(d/2+.016)],s:[12,5,1],r:[0,Math.atan2(nx,nz),0],tile:seed%16,color:[0x55d8ed,0xef70c8,0xffb85e][district%3]});}
      if(bx===150&&bz===-450&&q===0)citySigns.push({p:[x,base+30,z+upperD/2+.016],s:[10,36,1],r:[0,0,0],tile:10,color:0xffbf66,feature:true});
      infill++;
    }
  }));
  const cityBox=new THREE.BoxGeometry(1,1,1);

  function cityInstances(name,geometry,material,records,castShadow=false){
    if(!records.length)return null;const mesh=new THREE.InstancedMesh(geometry,material,records.length),pose=new THREE.Object3D(),color=new THREE.Color();
    // r128 caches a shared material's instancing-colour program. Mixing a
    // coloured batch with a null instanceColor batch can abort the entire
    // render before traffic is drawn. Explicit white is the neutral multiplier
    // for untinted records; do not change material, geometry or solid bounds.
    records.forEach((record,i)=>{pose.position.set(...record.p);pose.scale.set(...record.s);pose.rotation.set(...(record.r||[0,0,0]));pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);mesh.setColorAt(i,color.setHex(record.color??0xffffff));});
    mesh.name=name;mesh.castShadow=castShadow;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.userData.cityInstances=records.map(record=>record.id??null);cityEnvGroup.add(mesh);return mesh;
  }
  cityBodies.forEach((records,i)=>cityInstances(`city-building-batch-${i}`,cityBox,bldgMats[i],records,true));
  for(let i=0;i<2;i++){cityInstances(`city-window-courses-${i}`,cityBox,i?windowWarmMat:windowLitMat,cityBands[i]);cityInstances(`city-roof-cornices-${i}`,cityBox,bldgMats[i],cityCornices[i]);cityInstances(`city-tower-trims-${i}`,cityBox,i?landmarkTrimMat:trimMat,cityStrips[i]);}
  cityInstances('city-rooftop-pads',new THREE.CylinderGeometry(1,1,1,24),bldgMats[0],cityPads);
  cityInstances('city-rooftop-rings',new THREE.RingGeometry(.85,1,24).rotateX(-Math.PI/2),helipadRingMat,cityPadRings);
  cityInstances('city-rooftop-H',new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),helipadMarkMat,cityPadLetters);
  cityInstances('city-rooftop-beacons',new THREE.CylinderGeometry(.25,1.2,14,12),new THREE.MeshBasicMaterial({color:0x38bdf8,transparent:true,opacity:.10,side:THREE.DoubleSide}),cityBeams);
  // Original 5x7 glyph atlas: one static texture and one instanced sign draw.
  const glyphs={A:[14,17,17,31,17,17,17],B:[30,17,17,30,17,17,30],C:[14,17,16,16,16,17,14],D:[30,17,17,17,17,17,30],E:[31,16,16,30,16,16,31],F:[31,16,16,30,16,16,16],G:[14,17,16,23,17,17,15],I:[14,4,4,4,4,4,14],L:[16,16,16,16,16,16,31],N:[17,25,25,21,19,19,17],O:[14,17,17,17,17,17,14],R:[30,17,17,30,20,18,17],T:[31,4,4,4,4,4,4],U:[17,17,17,17,17,17,14],V:[17,17,17,17,17,10,4],X:[17,17,10,4,10,17,17],Y:[17,17,10,4,4,4,4]};
  const atlasSize=256,atlas=new Uint8Array(atlasSize*atlasSize*4),words=['ION','NEX','ARC','VOLT','DATA','GRID','AIR','FUEL','CYBR','NODE','CORE','NEON','RACE','GATE','LINE','CITY'];
  for(let tile=0;tile<16;tile++){const ox=tile%4*64,oy=Math.floor(tile/4)*64,word=words[tile];for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=((oy+y)*256+ox+x)*4,frame=x<2||x>61||y<2||y>61;atlas[i]=atlas[i+1]=atlas[i+2]=frame?150:9;atlas[i+3]=255;}
    for(let j=0;j<word.length;j++)for(let row=0;row<7;row++)for(let col=0;col<5;col++)if((glyphs[word[j]]||glyphs.I)[row]&(1<<(4-col)))for(let yy=0;yy<2;yy++)for(let xx=0;xx<2;xx++){const vertical=tile>=8,x=ox+(vertical?27+col*2+xx:Math.floor((64-word.length*12)/2)+j*12+col*2+xx),y=oy+(vertical?Math.floor((64-word.length*14)/2)+j*14+row*2+yy:25+row*2+yy),i=(y*256+x)*4;atlas[i]=atlas[i+1]=atlas[i+2]=240;}}
  const signMap=new THREE.DataTexture(atlas,256,256,THREE.RGBAFormat);signMap.name='city-original-cyber-sign-atlas';signMap.magFilter=THREE.LinearFilter;signMap.minFilter=THREE.LinearMipmapLinearFilter;signMap.generateMipmaps=true;signMap.needsUpdate=true;
  const signMat=new THREE.MeshBasicMaterial({color:0xffffff,map:signMap,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  signMat.onBeforeCompile=shader=>{shader.vertexShader='attribute float citySignTile;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvUv=vec2(uv.x+mod(citySignTile,4.0),1.0-uv.y+floor(citySignTile/4.0))/4.0;');};signMat.customProgramCacheKey=()=> 'city-original-sign-atlas-v1';
  const signGeometry=new THREE.PlaneGeometry(1,1);signGeometry.setAttribute('citySignTile',new THREE.InstancedBufferAttribute(new Float32Array(citySigns.map(s=>s.tile)),1));
  cityInstances('city-cyber-signs',signGeometry,signMat,citySigns);
  cityEnvGroup.userData.cityArchitecture={version:3,families:cityFamilies,buildings:new Set(cityBuildings.map(b=>b.logicalId)).size,solidParts:cityBuildings.length,infillBuildings:infill,lowBuildings:cityBuildings.filter(b=>b.kind==='low').length,silhouettes,signs:citySigns.length,featureSigns:citySigns.filter(s=>s.feature).length,facadeTextureBytes:12*128*128*4+atlas.byteLength,source:'original procedural geometry, glyphs and pixels; no third-party assets'};

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
