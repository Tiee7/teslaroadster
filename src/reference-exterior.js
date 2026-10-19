// Reference-led 2026 Roadster exterior. Units and axles match vehicles.js.
// All smooth panels are indexed tangent-normal surfaces. Separate meshes retain
// the intentional hood, shoulder, sill and transom creases of the reference car.
function buildReferenceRoadsterExterior() {
  const exterior = new THREE.Group();
  exterior.name = 'reference-roadster-exterior';
  const parts = {};
  const own = (name, parent = exterior) => {
    const group = new THREE.Group(); group.name = name; parent.add(group); parts[name] = group; return group;
  };
  const body = own('reference-body');
  const canopy = own('reference-canopy');
  const rails = own('reference-canopy-rails');
  const frontLights = own('reference-front-lights');
  const rearLights = own('reference-rear-lights');
  const activeWing = own('reference-active-wing');
  // This group is deliberately local to the existing animated spoiler pivot
  // (0, .85, 2.04). Move it under activeWingGroup without changing its transform.
  activeWing.userData.pivot = [0, 0.85, 2.04];

  const paint = typeof bodyMaterial !== 'undefined' ? bodyMaterial : new THREE.MeshPhysicalMaterial({ color: 0xf2f4f5, roughness: 0.24, metalness: 0.24, clearcoat: 1 });
  const carbon = typeof carbonMaterial !== 'undefined' ? carbonMaterial : new THREE.MeshStandardMaterial({ color: 0x090c10, metalness: 0.35, roughness: 0.35 });
  const metal = typeof titaniumMaterial !== 'undefined' ? titaniumMaterial : new THREE.MeshStandardMaterial({ color: 0x7c858b, metalness: 0.9, roughness: 0.22 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x080c10, metalness: 0.38, roughness: 0.28, side: THREE.FrontSide });
  const recess = new THREE.MeshStandardMaterial({ color: 0x030507, metalness: 0.08, roughness: 0.58, side: THREE.FrontSide });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x080e13, metalness: 0.37, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08, reflectivity: 0.83, envMapIntensity: 1.1, side: THREE.FrontSide });
  const sideGlass = new THREE.MeshPhysicalMaterial({ color: 0x10191f, metalness: 0.40, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.09, envMapIntensity: 1.0, side: THREE.FrontSide });
  const seamMaterial = new THREE.MeshBasicMaterial({ color: 0x1b2328, side: THREE.FrontSide });
  const lampWhite = new THREE.MeshBasicMaterial({ color: 0xf8fcff, side: THREE.FrontSide });
  const lampRed = typeof tailLightMat !== 'undefined' ? tailLightMat : new THREE.MeshBasicMaterial({ color: 0xe91d36, side: THREE.FrontSide });
  const lampStop = typeof chmslMat !== 'undefined' ? chmslMat : new THREE.MeshBasicMaterial({ color: 0x55101b, side: THREE.FrontSide });
  const lampReverse = typeof reverseLightMat !== 'undefined' ? reverseLightMat : new THREE.MeshBasicMaterial({ color: 0xfaffff, transparent: true, opacity: 0, side: THREE.FrontSide });
  const amberL = typeof turnSignalMatL !== 'undefined' ? turnSignalMatL : new THREE.MeshBasicMaterial({ color: 0xffa321, transparent: true, opacity: 0, side: THREE.FrontSide });
  const amberR = typeof turnSignalMatR !== 'undefined' ? turnSignalMatR : new THREE.MeshBasicMaterial({ color: 0xffa321, transparent: true, opacity: 0, side: THREE.FrontSide });

  const mix = (a, b, t) => a + (b - a) * t;
  const addMesh = (name, geometry, material, parent = body) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name;
    mesh.castShadow = material !== lampWhite && material !== lampRed;
    mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  // Shared derivatives at every control station, shape-preserving PCHIP.
  function profile(stations) {
    const keys = Object.keys(stations[0]).filter(k => k !== 'z');
    const h = stations.slice(1).map((p, i) => p.z - stations[i].z);
    const slopes = {};
    for (const key of keys) {
      const d = h.map((v, i) => (stations[i + 1][key] - stations[i][key]) / v);
      const m = new Array(stations.length).fill(0);
      const end = (h0, h1, d0, d1) => {
        let v = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
        if (v * d0 <= 0) v = 0; else if (d0 * d1 < 0 && Math.abs(v) > Math.abs(3 * d0)) v = 3 * d0;
        return v;
      };
      if (d.length === 1) m.fill(d[0]);
      else {
        m[0] = end(h[0], h[1], d[0], d[1]);
        const n = d.length - 1; m[n + 1] = end(h[n], h[n - 1], d[n], d[n - 1]);
        for (let i = 1; i <= n; i++) if (d[i - 1] * d[i] > 0) {
          const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
          m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
        }
      }
      slopes[key] = m;
    }
    return z => {
      if (z <= stations[0].z) return stations[0];
      if (z >= stations[stations.length - 1].z) return stations[stations.length - 1];
      let i = 0; while (z > stations[i + 1].z) i++;
      const t = (z - stations[i].z) / h[i], t2 = t * t, t3 = t2 * t, result = { z };
      for (const key of keys) result[key] = (2 * t3 - 3 * t2 + 1) * stations[i][key]
        + (t3 - 2 * t2 + t) * h[i] * slopes[key][i]
        + (-2 * t3 + 3 * t2) * stations[i + 1][key]
        + (t3 - t2) * h[i] * slopes[key][i + 1];
      return result;
    };
  }
  function surface(name, at, rows, columns, material, parent = body, flip = false) {
    const positions = [], normals = [], indices = [], grid = [];
    for (let i = 0; i <= rows; i++) {
      const row = []; for (let j = 0; j <= columns; j++) { const p = at(i / rows, j / columns); row.push(p); positions.push(...p); }
      grid.push(row);
    }
    const stride = columns + 1;
    for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) {
      const a = i * stride + j, b = a + 1, c = a + stride, d = c + 1;
      indices.push(...(flip ? [a, d, c, a, b, d] : [a, c, d, a, d, b]));
    }
    for (let i = 0; i <= rows; i++) for (let j = 0; j <= columns; j++) {
      const p0 = grid[Math.max(0, i - 1)][j], p1 = grid[Math.min(rows, i + 1)][j];
      const q0 = grid[i][Math.max(0, j - 1)], q1 = grid[i][Math.min(columns, j + 1)];
      const a = p1.map((v, k) => v - p0[k]), b = q1.map((v, k) => v - q0[k]);
      const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const length = Math.hypot(...n) || 1; normals.push(...n.map(v => v / length * (flip ? -1 : 1)));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = addMesh(name, geometry, material, parent); mesh.userData.surfaceRows = rows; mesh.userData.surfaceColumns = columns; return mesh;
  }
  // Convex planar facets, wound once toward a known exterior direction. Lenses
  // never contain reverse triangles and never use emissive rear/side faces.
  function facet(name, points, material, parent = body, toward = [0, 1, 0]) {
    const a = points[0], b = points[1], c = points[2];
    const u = b.map((v, k) => v - a[k]), v = c.map((n, k) => n - a[k]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const reverse = n.reduce((sum, value, k) => sum + value * toward[k], 0) < 0;
    const index = []; for (let i = 1; i < points.length - 1; i++) index.push(...(reverse ? [0, i + 1, i] : [0, i, i + 1]));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3)); g.setIndex(index); g.computeVertexNormals();
    return addMesh(name, g, material, parent);
  }
  const box = (name, size, position, material, parent = body) => {
    const mesh = addMesh(name, new THREE.BoxGeometry(...size), material, parent); mesh.position.set(...position); return mesh;
  };
  function ribbon(name, pointAt, width, material, parent, outward = [0, 1, 0], segments = 64) {
    // Explicit narrow surfaces avoid floating tubes and chunky raised shutlines.
    const points = []; for (let i = 0; i <= segments; i++) points.push(pointAt(i / segments));
    return surface(name, (t, u) => {
      const f = t * segments, i = Math.min(segments - 1, Math.floor(f)), k = f - i;
      const p = points[i].map((v, axis) => mix(v, points[i + 1][axis], k));
      const prev = points[Math.max(0, i - 1)], next = points[Math.min(segments, i + 1)];
      const tangent = next.map((v, axis) => v - prev[axis]);
      const side = [outward[1] * tangent[2] - outward[2] * tangent[1], outward[2] * tangent[0] - outward[0] * tangent[2], outward[0] * tangent[1] - outward[1] * tangent[0]];
      const len = Math.hypot(...side) || 1;
      return p.map((v, axis) => v + side[axis] / len * (u - 0.5) * width);
    }, segments, 1, material, parent, false);
  }

  const shape = profile([
    { z: -2.32, innerX: .680, innerY: .505, crestX: .870, crestY: .620, edgeX: .954, edgeY: .560, waistX: .951, waistY: .355, sillY: .155 },
    { z: -2.10, innerX: .615, innerY: .680, crestX: .855, crestY: .738, edgeX: .981, edgeY: .636, waistX: .986, waistY: .420, sillY: .158 },
    { z: -1.85, innerX: .628, innerY: .700, crestX: .860, crestY: .775, edgeX: 1.000, edgeY: .706, waistX: 1.013, waistY: .482, sillY: .160 },
    { z: -1.36, innerX: .654, innerY: .715, crestX: .866, crestY: .791, edgeX: 1.005, edgeY: .747, waistX: 1.020, waistY: .522, sillY: .165 },
    { z: -1.06, innerX: .668, innerY: .710, crestX: .858, crestY: .775, edgeX: .992, edgeY: .731, waistX: 1.005, waistY: .520, sillY: .168 },
    { z: -.72, innerX: .830, innerY: .738, crestX: .886, crestY: .770, edgeX: .973, edgeY: .725, waistX: .994, waistY: .492, sillY: .176 },
    { z: -.10, innerX: .802, innerY: .772, crestX: .864, crestY: .788, edgeX: .963, edgeY: .746, waistX: .990, waistY: .501, sillY: .190 },
    { z: .42, innerX: .748, innerY: .810, crestX: .852, crestY: .832, edgeX: .979, edgeY: .785, waistX: 1.000, waistY: .534, sillY: .207 },
    { z: .90, innerX: .602, innerY: .851, crestX: .841, crestY: .881, edgeX: 1.000, edgeY: .832, waistX: 1.017, waistY: .587, sillY: .210 },
    { z: 1.38, innerX: .375, innerY: .863, crestX: .820, crestY: .906, edgeX: 1.005, edgeY: .854, waistX: 1.020, waistY: .620, sillY: .208 },
    { z: 1.72, innerX: .215, innerY: .860, crestX: .792, crestY: .897, edgeX: .986, edgeY: .852, waistX: .997, waistY: .612, sillY: .207 },
    { z: 2.03, innerX: .205, innerY: .862, crestX: .754, crestY: .882, edgeX: .950, edgeY: .838, waistX: .958, waistY: .598, sillY: .208 },
    { z: 2.26, innerX: .205, innerY: .860, crestX: .715, crestY: .869, edgeX: .910, edgeY: .823, waistX: .918, waistY: .571, sillY: .210 }
  ]);
  const openingY = z => {
    const s = shape(z); let y = s.sillY;
    const df = z + 1.36, dr = z - 1.38;
    if (Math.abs(df) < .405) y = Math.max(y, .160 + 1.305 * Math.sqrt(Math.max(0, .405 ** 2 - df ** 2)));
    if (Math.abs(dr) < .430) y = Math.max(y, .160 + 1.420 * Math.sqrt(Math.max(0, .430 ** 2 - dr ** 2)));
    return y;
  };
  function shoulderPoint(z, u, side) {
    const s = shape(z);
    // Two cubic arcs share a horizontal tangent across each fender crown.
    let x, y;
    if (u < .55) {
      const t = u / .55; x = mix(s.innerX, s.crestX, t);
      y = mix(s.innerY, s.crestY, Math.sin(t * Math.PI / 2));
    } else {
      const t = (u - .55) / .45; x = mix(s.crestX, s.edgeX, t);
      y = s.crestY - (s.crestY - s.edgeY) * (1 - Math.cos(t * Math.PI / 2));
    }
    return [side * x, y, z];
  }
  function sidePoint(z, u, side) {
    const s = shape(z), bottom = openingY(z), waist = Math.max(s.waistY, bottom + .013);
    if (u < .48) {
      const t = u / .48;
      return [side * mix(s.edgeX, s.waistX, t), mix(s.edgeY, waist, t), z];
    }
    const t = (u - .48) / .52;
    return [side * (mix(s.waistX, s.waistX - .052, t) - .009 * Math.sin(Math.PI * t)), mix(waist, bottom, t), z];
  }

  // Broad, almost planar hood. Its width stays substantial at the nose.
  surface('referenceFlatWedgeHood', (t, u) => {
    const z = mix(-2.32, -1.06, t), s = shape(z), x = (u * 2 - 1) * s.innerX;
    return [x, s.innerY + .0045 * (1 - (u * 2 - 1) ** 2), z];
  }, 96, 32, paint);
  for (const side of [-1, 1]) {
    surface(`referenceShoulder${side}`, (t, u) => shoulderPoint(mix(-2.10, 2.26, t), u, side), 176, 32, paint, body, side < 0);
    // The shoulder-to-door break is deliberately separate from the crown.
    surface(`referenceUpperFlank${side}`, (t, u) => sidePoint(mix(-2.32, 2.26, t), u * .48, side), 240, 8, paint, body, side < 0);
    surface(`referenceSculptedDoor${side}`, (t, u) => sidePoint(mix(-2.32, 2.26, t), .48 + u * .52, side), 240, 16, paint, body, side < 0);
    // Painted arch return/lip, nested behind the body edge, without faceted rings.
    surface(`referenceArchReturn${side}`, (t, u) => {
      const z = mix(-2.32, 2.26, t), s = shape(z), y = openingY(z);
      return [side * (s.waistX - .052 - u * .035), y - u * .014, z];
    }, 240, 3, paint, body, side < 0);
    // A narrow black sill undercuts the white body between the two wheel holes.
    surface(`referenceCarbonSill${side}`, (t, u) => {
      const z = mix(-2.30, 2.24, t), s = shape(z), top = openingY(z);
      return [side * (s.waistX - .054 + u * .008), mix(top - .008, Math.max(.12, top - .044), u), z];
    }, 224, 3, carbon, body, side < 0);

    // The forward fender is folded around an actual triangular recessed lamp,
    // rather than a luminous triangle pasted onto the windshield-facing hood.
    const p = (x, y, z) => [side * x, y, z];
    const lampTip = p(.680, .511, -2.327), lampInner = p(.616, .669, -2.126), lampOuter = p(.850, .670, -2.126);
    facet(`referenceFrontShoulderTop${side}`, [p(.615, .680, -2.10), p(.855, .738, -2.10), lampOuter, lampInner], paint, body, [0, 1, -.3]);
    facet(`referenceFrontCheek${side}`, [lampTip, lampOuter, p(.982, .637, -2.10), p(.954, .560, -2.32), p(.951, .280, -2.32), p(.708, .280, -2.32)], paint, body, [side * .2, .15, -1]);
    facet(`referenceLampPocket${side}`, [lampTip, lampInner, lampOuter], recess, frontLights, [0, .25, -1]);
    // Deep charcoal liner: the small luminous face is always -Z-facing.
    const triangle = [p(.687, .531, -2.327), p(.630, .654, -2.141), p(.829, .655, -2.141)];
    const lens = facet(`referenceTriangleHeadlamp${side}`, triangle, lampWhite, frontLights, [0, .25, -1]);
    lens.userData.forwardOnly = true;
    // A restrained dark upper eyebrow makes the triangular inset read in sun.
    facet(`referenceHeadlightEyebrow${side}`, [p(.622, .667, -2.132), p(.846, .668, -2.132), p(.839, .655, -2.148), p(.628, .654, -2.148)], dark, frontLights, [0, .3, -1]);
    const indicator = facet(`referenceFrontIndicator${side}`, [p(.640, .650, -2.148), p(.826, .651, -2.148), p(.816, .642, -2.161), p(.644, .641, -2.161)], side < 0 ? amberL : amberR, frontLights, [0, .3, -1]);
    indicator.userData.forwardOnly = true;

    // Side intake aft of the front wheel, plus the white knife-edge that borders it.
    facet(`referenceSideBladeRecess${side}`, [p(.999, .617, -.932), p(.998, .624, -.783), p(.983, .278, -.738), p(.967, .232, -.887)], recess, body, [side, 0, 0]);
    facet(`referenceSideBlade${side}`, [p(1.001, .625, -.766), p(.996, .625, -.730), p(.950, .222, -.686), p(.969, .224, -.737)], paint, body, [side, 0, 0]);

    // Narrow, surface-following door shutlines. They are not raised black bars.
    for (const z of [-.650, .780]) ribbon(`referenceDoorSeam${side}_${z}`, t => {
      const a = sidePoint(z + .018 * Math.sin(Math.PI * t), mix(.02, .97, t), side); a[0] += side * .0012; return a;
    }, .0028, seamMaterial, body, [side, 0, 0], 48);
    const handle = box(`referenceFlushDoorHandle${side}`, [.003, .010, .094], [side * .990, .659, .35], dark);
    handle.rotation.x = -.08;
    // Small mirror camera fairings stay inside the original overall width.
    box(`referenceMirrorStalk${side}`, [.075, .012, .032], [side * .895, .756, -.745], carbon);
    const mirror = box(`referenceMirrorPod${side}`, [.132, .032, .062], [side * .949, .770, -.751], paint);
    mirror.rotation.y = -side * .10;
    facet(`referenceMirrorGlass${side}`, [p(.906, .757, -.718), p(1.007, .757, -.728), p(1.007, .778, -.728), p(.906, .778, -.718)], metal, body, [0, 0, 1]);
  }

  // Front mask: broad painted corners surround a black recessed, continuous
  // center fascia. The thin cross-nose white light has a single emitting face.
  facet('referenceFrontFasciaRecess', [[-.704, .487, -2.307], [.704, .487, -2.307], [.732, .257, -2.307], [-.732, .257, -2.307]], dark, body, [0, 0, -1]);
  facet('referenceFrontLowerIntake', [[-.701, .285, -2.316], [.701, .285, -2.316], [.754, .188, -2.316], [-.754, .188, -2.316]], recess, body, [0, 0, -1]);
  facet('referenceFrontBarHousing', [[-.690, .512, -2.329], [.690, .512, -2.329], [.695, .483, -2.329], [-.695, .483, -2.329]], dark, frontLights, [0, 0, -1]);
  const noseBar = facet('referenceCrossNoseLight', [[-.684, .504, -2.331], [.684, .504, -2.331], [.688, .493, -2.331], [-.688, .493, -2.331]], lampWhite, frontLights, [0, 0, -1]);
  noseBar.userData.forwardOnly = true;
  facet('referenceGrilleHorizontalBlade', [[-.715, .341, -2.319], [.715, .341, -2.319], [.717, .328, -2.319], [-.717, .328, -2.319]], carbon, body, [0, 0, -1]);
  facet('referenceFrontSplitterTop', [[-.970, .154, -2.358], [.970, .154, -2.358], [.972, .154, -2.170], [-.972, .154, -2.170]], carbon, body, [0, 1, 0]);
  facet('referenceFrontSplitterEdge', [[-.970, .154, -2.358], [.970, .154, -2.358], [.970, .126, -2.358], [-.970, .126, -2.358]], dark, body, [0, 0, -1]);
  // A tiny, non-luminous nose badge, with no oversized logo on the hood.
  facet('referenceNoseBadgeTop', [[-.023, .391, -2.323], [.023, .391, -2.323], [.017, .386, -2.323], [-.017, .386, -2.323]], metal, body, [0, 0, -1]);
  facet('referenceNoseBadgeStem', [[-.004, .387, -2.324], [.004, .387, -2.324], [.002, .370, -2.324], [-.002, .370, -2.324]], metal, body, [0, 0, -1]);
  ribbon('referenceHoodRearShutline', t => {
    const x = mix(-.665, .665, t); return [x, .713 + .0045 * (1 - (x / .668) ** 2), -1.063];
  }, .0025, seamMaterial, body, [0, 1, 0], 48);

  // The black canopy is one long tapered teardrop. White structural rails live
  // between its roof and side windows, and all three are individually hideable.
  const canopyProfile = profile([
    { z: -1.065, w: .642, y: .719, bw: .669, by: .712 },
    { z: -.820, w: .615, y: .913, bw: .832, by: .741 },
    { z: -.360, w: .550, y: 1.096, bw: .820, by: .764 },
    { z: .025, w: .516, y: 1.137, bw: .792, by: .782 },
    { z: .450, w: .451, y: 1.094, bw: .734, by: .813 },
    { z: .900, w: .343, y: .997, bw: .599, by: .850 },
    { z: 1.330, w: .248, y: .914, bw: .390, by: .865 },
    { z: 1.710, w: .198, y: .865, bw: .214, by: .861 }
  ]);
  const canopyStart = -1.065, canopyEnd = 1.710;
  surface('referencePanoramicCanopy', (t, u) => {
    const z = mix(canopyStart, canopyEnd, t), s = canopyProfile(z), q = 2 * u - 1;
    return [q * (s.w - .027), s.y + .012 * (1 - q * q), z];
  }, 128, 40, glass, canopy);
  for (const side of [-1, 1]) {
    surface(`referenceWhiteRoofRail${side}`, (t, u) => {
      const z = mix(canopyStart, canopyEnd, t), s = canopyProfile(z);
      const rearFlare = .045 * Math.sin(Math.PI * Math.max(0, Math.min(1, (z - .55) / 1.15)));
      return [side * (s.w - .027 + u * (.062 + rearFlare)), s.y - .006 * u + .002 * Math.sin(Math.PI * u), z];
    }, 120, 6, paint, rails, side < 0);
    surface(`referenceSideWindow${side}`, (t, u) => {
      const z = mix(canopyStart, canopyEnd, t), s = canopyProfile(z);
      const rearFlare = .045 * Math.sin(Math.PI * Math.max(0, Math.min(1, (z - .55) / 1.15)));
      const inner = Math.min(s.bw - .003, s.w + .035 + rearFlare);
      return [side * mix(inner, s.bw, u), mix(Math.max(s.by + .002, s.y - .008), s.by, u) - .0004 * Math.sin(Math.PI * u), z];
    }, 120, 18, sideGlass, canopy, side < 0);
    // Narrow painted sill at the base of the side glass, terminating into the
    // broad white rear buttress. It follows the same shared station profile.
    surface(`referenceWindowSill${side}`, (t, u) => {
      const z = mix(-.925, 1.710, t), s = canopyProfile(z);
      return [side * (s.bw + u * .022), s.by - u * .014, z];
    }, 100, 3, paint, rails, side < 0);
  }
  // Front cowl has an opaque dark reverse face. Nothing luminous faces the cabin.
  facet('referenceWindshieldCowl', [[-.668, .714, -1.067], [.668, .714, -1.067], [.650, .731, -1.040], [-.650, .731, -1.040]], dark, canopy, [0, 1, -.3]);
  ribbon('referenceWindshieldWiper', t => [mix(-.37, .28, t), .741 + .018 * Math.sin(Math.PI * t), -1.018], .004, dark, canopy, [0, 1, -.3], 48);

  // Closed upper rear deck and transom. The black lamp slot is recessed inside
  // an actual painted surround, with walls, back panel and a lower white beam.
  surface('referenceRearDeckCenter', (t, u) => {
    const z = mix(1.708, 2.260, t), s = shape(z), q = u * 2 - 1;
    return [q * s.innerX, s.innerY + .0015 * (1 - q * q), z];
  }, 40, 24, paint);
  const atRear = (x, y, z = 2.278) => [x, y, z];
  facet('referenceRearLampRecess', [atRear(-.850, .837, 2.245), atRear(.850, .837, 2.245), atRear(.850, .713, 2.245), atRear(-.850, .713, 2.245)], recess, body, [0, 0, 1]);
  facet('referenceRearTopBeam', [atRear(-.909, .863), atRear(.909, .863), atRear(.856, .832), atRear(-.856, .832)], paint, body, [0, .2, 1]);
  facet('referenceRearLowerBeam', [atRear(-.856, .715), atRear(.856, .715), atRear(.904, .666), atRear(-.904, .666)], paint, body, [0, -.1, 1]);
  for (const side of [-1, 1]) {
    facet(`referenceRearCorner${side}`, [[side * .909, .863, 2.278], [side * .856, .832, 2.278], [side * .856, .715, 2.278], [side * .904, .666, 2.278], [side * .924, .579, 2.252], [side * .926, .818, 2.252]], paint, body, [side * .1, 0, 1]);
    facet(`referenceRearSlotSidewall${side}`, [[side * .856, .832, 2.278], [side * .850, .830, 2.245], [side * .850, .718, 2.245], [side * .856, .715, 2.278]], dark, body, [0, 0, 1]);
  }
  facet('referenceRearSlotCeiling', [atRear(-.856, .832), atRear(.856, .832), atRear(.850, .830, 2.245), atRear(-.850, .830, 2.245)], dark, body, [0, -1, 0]);
  facet('referenceRearSlotSill', [atRear(-.856, .715), atRear(.856, .715), atRear(.850, .718, 2.245), atRear(-.850, .718, 2.245)], dark, body, [0, 1, 0]);
  facet('referenceRearSlotHorizontalBlade', [atRear(-.842, .766, 2.262), atRear(.842, .766, 2.262), atRear(.842, .754, 2.262), atRear(-.842, .754, 2.262)], dark, body, [0, 0, 1]);
  const tail = facet('referenceRearContinuousRedLight', [atRear(-.838, .794, 2.269), atRear(.838, .794, 2.269), atRear(.838, .781, 2.269), atRear(-.838, .781, 2.269)], lampRed, rearLights, [0, 0, 1]);
  tail.userData.rearOnly = true;
  facet('referenceRearCenterStopLamp', [[-.172, .878, 1.715], [.172, .878, 1.715], [.172, .866, 1.715], [-.172, .866, 1.715]], lampStop, rearLights, [0, 0, 1]);
  for (const side of [-1, 1]) {
    const x0 = side * .625, x1 = side * .835;
    facet(`referenceRearIndicator${side}`, [atRear(x0, .795, 2.271), atRear(x1, .795, 2.271), atRear(x1, .780, 2.271), atRear(x0, .780, 2.271)], side < 0 ? amberL : amberR, rearLights, [0, 0, 1]);
    const x = side * .330;
    facet(`referenceReverseLamp${side}`, [atRear(x - .053, .740, 2.267), atRear(x + .053, .740, 2.267), atRear(x + .053, .728, 2.267), atRear(x - .053, .728, 2.267)], lampReverse, rearLights, [0, 0, 1]);
  }
  facet('referenceRearPaintedBumper', [atRear(-.903, .666, 2.273), atRear(.903, .666, 2.273), atRear(.713, .638, 2.279), atRear(-.713, .638, 2.279)], paint, body, [0, 0, 1]);
  // Broad black lower fascia is closed behind the four existing nozzles, whose
  // local positions stay x=[-.45,-.15,.15,.45], y=.50 and z=2.23.
  facet('referenceRearJetRecess', [[-.714, .636, 2.231], [.714, .636, 2.231], [.714, .351, 2.231], [-.714, .351, 2.231]], recess, body, [0, 0, 1]);
  for (const side of [-1, 1]) {
    facet(`referenceDiffuserOuterCheek${side}`, [[side * .924, .579, 2.263], [side * .714, .636, 2.278], [side * .714, .351, 2.278], [side * .764, .202, 2.292], [side * .919, .221, 2.268]], carbon, body, [side * .1, 0, 1]);
    facet(`referenceJetPocketSide${side}`, [[side * .714, .636, 2.278], [side * .714, .636, 2.231], [side * .714, .351, 2.231], [side * .714, .351, 2.278]], dark, body, [-side, 0, 0]);
  }
  facet('referenceJetPocketHeader', [[-.714, .636, 2.278], [.714, .636, 2.278], [.714, .636, 2.231], [-.714, .636, 2.231]], carbon, body, [0, -1, 0]);
  facet('referenceJetPocketLowerLip', [[-.714, .351, 2.231], [.714, .351, 2.231], [.714, .351, 2.292], [-.714, .351, 2.292]], carbon, body, [0, 1, 0]);
  // Continuous undertray and deep diffuser keep road/sky from showing through.
  surface('referenceClosedUndertray', (t, u) => {
    const z = mix(-2.22, 2.29, t), x = mix(-.745, .745, u);
    const rise = Math.max(0, (z - 1.65) / .64);
    return [x, .129 + .074 * rise * rise + .012 * Math.cos((u - .5) * Math.PI), z];
  }, 100, 32, carbon);
  box('referenceClosedDiffuserBacking', [1.60,.17,.035], [0,.275,2.13], recess);
  facet('referenceDiffuserTrailingFace', [[-.748, .205, 2.292], [.748, .205, 2.292], [.748, .130, 2.292], [-.748, .130, 2.292]], dark, body, [0, 0, 1]);
  for (const x of [-.710, -.473, -.237, 0, .237, .473, .710]) {
    const fin = facet(`referenceDiffuserFin${x}`, [[x, .135, 1.82], [x, .143, 2.292], [x, .350, 2.292], [x, .275, 2.10], [x, .166, 1.82]], carbon, body, [x < 0 ? -1 : 1, 0, 0]);
    // Closed small fin thickness, rather than double-sided paper-thin black fins.
    const edge = box(`referenceDiffuserFinEdge${x}`, [.010, .206, .025], [x, .247, 2.280], carbon); edge.rotation.x = -.06;
    fin.userData.diffuser = true;
  }

  // Raised active white wing. The blade and endplates are all local to the
  // existing animation pivot, so braking/deployment never creates two spoilers.
  const wingProfile = (x, z) => .102 + .014 * (1 - (x / .855) ** 2) + .011 * Math.sin((z + .145) / .280 * Math.PI);
  surface('referenceWhiteWingBlade', (t, u) => {
    const z = mix(-.145, .135, t), x = mix(-.855, .855, u); return [x, wingProfile(x, z), z];
  }, 18, 56, paint, activeWing);
  surface('referenceWingCarbonUnderside', (t, u) => {
    const z = mix(-.145, .135, t), x = mix(-.855, .855, u); return [x, wingProfile(x, z) - .024, z];
  }, 18, 56, carbon, activeWing, true);
  facet('referenceWingLeadingEdge', [[-.855, .102, -.145], [.855, .102, -.145], [.855, .078, -.145], [-.855, .078, -.145]], paint, activeWing, [0, 0, -1]);
  facet('referenceWingTrailingEdge', [[-.855, .102, .135], [.855, .102, .135], [.855, .078, .135], [-.855, .078, .135]], carbon, activeWing, [0, 0, 1]);
  for (const side of [-1, 1]) {
    const x = side * .855;
    facet(`referenceWhiteWingEndplate${side}`, [[x, .111, -.145], [x, .111, .140], [x, -.065, .148], [x, -.032, -.130]], paint, activeWing, [side, 0, 0]);
    box(`referenceWingEndplateThickness${side}`, [.015, .146, .270], [x - side * .0075, .023, .002], paint, activeWing);
    const strut = box(`referenceWingSupport${side}`, [.025, .136, .043], [side * .460, .015, -.027], metal, activeWing); strut.rotation.x = -.24;
    box(`referenceWingBaseMount${side}`, [.076, .019, .095], [side * .460, -.052, -.044], carbon, activeWing);
  }

  // Stable integration contract, without depending on construction order.
  exterior.userData.parts = parts;
  exterior.userData.canopy = canopy;
  exterior.userData.rails = rails;
  exterior.userData.frontLights = frontLights;
  exterior.userData.rearLights = rearLights;
  exterior.userData.activeWing = activeWing;
  exterior.userData.materials = { paint, glass, sideGlass, lampWhite, lampRed, lampStop, lampReverse, amberL, amberR };
  exterior.userData.axles = { front: { z: -1.36, y: .32, radius: .32 }, rear: { z: 1.38, y: .35, radius: .35 } };
  exterior.userData.rearNozzleClearance = { x: [-.61, .61], y: [.39, .63], z: 2.23 };
  exterior.userData.wingPivot = [0, .85, 2.04];
  // Public numeric samplers support runtime geometry tests and future matching.
  exterior.userData.sampleShoulder = (z, u, side = 1) => shoulderPoint(z, u, side);
  exterior.userData.sampleFlank = (z, u, side = 1) => sidePoint(z, u, side);
  exterior.userData.wheelOpeningY = openingY;
  return exterior;
}
