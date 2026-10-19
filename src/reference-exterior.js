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
    mesh.castShadow = material !== lampWhite && material !== lampRed && material !== seamMaterial;
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
      let n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      // A collapsed UV pole still needs its one-sided limiting face normal.
      // Reuse the nearest noncollapsed row, without changing any positions.
      if(Math.hypot(...n)<1e-12)for(let d=1;d<=rows;d++){
        const r=Math.max(0,Math.min(rows,i+(i<rows?d:-d)));
        const v0=grid[Math.max(0,r-1)][j],v1=grid[Math.min(rows,r+1)][j];
        const w0=grid[r][Math.max(0,j-1)],w1=grid[r][Math.min(columns,j+1)];
        const v=v1.map((x,k)=>x-v0[k]),w=w1.map((x,k)=>x-w0[k]);
        n=[v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0]];
        if(Math.hypot(...n)>1e-12)break;
      }
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

  // Wide wheel shoulders and a visibly pinched door waist. These stations
  // describe the silhouette, independently of trim and material highlights.
  const shape = profile([
    { z: -2.16, innerX: .680, innerY: .480, crestX: .817, crestY: .483, edgeX: .898, edgeY: .490, waistX: .888, waistY: .345, sillY: .155 },
    { z: -1.98, innerX: .615, innerY: .540, crestX: .840, crestY: .559, edgeX: .964, edgeY: .555, waistX: .954, waistY: .411, sillY: .158 },
    { z: -1.75, innerX: .628, innerY: .605, crestX: .864, crestY: .644, edgeX: .995, edgeY: .640, waistX: .989, waistY: .480, sillY: .160 },
    { z: -1.36, innerX: .654, innerY: .665, crestX: .865, crestY: .760, edgeX: 1.005, edgeY: .710, waistX: 1.008, waistY: .522, sillY: .165 },
    { z: -1.06, innerX: .668, innerY: .695, crestX: .851, crestY: .765, edgeX: .983, edgeY: .700, waistX: .985, waistY: .488, sillY: .168 },
    { z: -.72, innerX: .802, innerY: .724, crestX: .855, crestY: .754, edgeX: .947, edgeY: .710, waistX: .931, waistY: .420, sillY: .176 },
    { z: -.10, innerX: .775, innerY: .754, crestX: .846, crestY: .774, edgeX: .938, edgeY: .732, waistX: .866, waistY: .390, sillY: .182 },
    { z: .42, innerX: .725, innerY: .792, crestX: .854, crestY: .816, edgeX: .963, edgeY: .769, waistX: .903, waistY: .420, sillY: .190 },
    { z: .90, innerX: .602, innerY: .836, crestX: .865, crestY: .863, edgeX: .995, edgeY: .816, waistX: .993, waistY: .555, sillY: .204 },
    { z: 1.38, innerX: .398, innerY: .850, crestX: .847, crestY: .886, edgeX: 1.015, edgeY: .839, waistX: 1.018, waistY: .600, sillY: .208 },
    { z: 1.72, innerX: .275, innerY: .846, crestX: .817, crestY: .878, edgeX: .990, edgeY: .832, waistX: .996, waistY: .592, sillY: .207 },
    { z: 2.03, innerX: .255, innerY: .843, crestX: .776, crestY: .865, edgeX: .957, edgeY: .819, waistX: .952, waistY: .563, sillY: .208 },
    { z: 2.26, innerX: .255, innerY: .840, crestX: .746, crestY: .848, edgeX: .917, edgeY: .798, waistX: .920, waistY: .540, sillY: .210 }
  ]);
  const openingY = z => {
    const s = shape(z); let y = s.sillY;
    const df = z + 1.36, dr = z - 1.38;
    if (Math.abs(df) < .405) y = Math.max(y, .160 + 1.305 * Math.sqrt(Math.max(0, .405 ** 2 - df ** 2)));
    if (Math.abs(dr) < .430) y = Math.max(y, .160 + 1.420 * Math.sqrt(Math.max(0, .430 ** 2 - dr ** 2)));
    return y;
  };
  function mainShoulderPoint(z, u, side) {
    const s = shape(z);
    // A broad ruled inner wing meets the rounded outer shoulder at a clear crest.
    let x, y;
    if (u < .55) {
      const t = u / .55; x = mix(s.innerX, s.crestX, t);
      y = mix(s.innerY,s.crestY,t);
    } else {
      const t = (u - .55) / .45; x = mix(s.crestX, s.edgeX, t);
      y = s.crestY - (s.crestY - s.edgeY) * (1 - Math.cos(t * Math.PI / 2));
    }
    return [side * x, y, z];
  }
  // The side reference resolves the high fold above the front axle, rather
  // than ahead of it. The nose-to-arch envelope now rises continuously aft.
  // Front and side views jointly constrain this genuinely planar white wing.
  const frontWingA=[.840,.760,-1.400];
  const frontWingB=[.59670636,.75711891,-1.06];
  const frontWingC=[.68697000,.47500000,-2.16];
  function frontShoulderPoint(z,u,side) {
    const lerpPoint=(a,b,t)=>a.map((v,k)=>mix(v,b[k],t));
    const inner=lerpPoint(frontWingC,frontWingB,(z-frontWingC[2])/(frontWingB[2]-frontWingC[2]));
    const crease=z<frontWingA[2]
      ?lerpPoint(frontWingC,frontWingA,(z-frontWingC[2])/(frontWingA[2]-frontWingC[2]))
      :lerpPoint(frontWingA,frontWingB,(z-frontWingA[2])/(frontWingB[2]-frontWingA[2]));
    if(u<=.55){const p=lerpPoint(inner,crease,u/.55);p[0]*=side;return p;}
    const t=(u-.55)/.45,s=shape(z);let x,y;
    if(t<.55){const q=t/.55;x=mix(crease[0],s.crestX,q);y=mix(crease[1],s.crestY,q);}
    else{const q=(t-.55)/.45;x=mix(s.crestX,s.edgeX,q);y=s.crestY-(s.crestY-s.edgeY)*(1-Math.cos(q*Math.PI/2));}
    return [side*x,y,z];
  }
  const shoulderPoint=(z,u,side=1)=>z<=frontWingB[2]?frontShoulderPoint(z,u,side):mainShoulderPoint(z,u,side);
  function sidePoint(z, u, side) {
    const s = shape(z), bottom = openingY(z), waist = Math.max(s.waistY, bottom + .013);
    if (u < .48) {
      const t = u / .48;
      return [side * (mix(s.edgeX,s.waistX,t)+.014*Math.sin(Math.PI*t)*Math.exp(-Math.pow(z/.85,4))),mix(s.edgeY,waist,t),z];
    }
    const t = (u - .48) / .52;
    const rockerX = Math.max(s.waistX - .030, s.edgeX - .040);
    return [side * (mix(s.waistX, rockerX, t) - .025 * Math.sin(Math.PI * t)), mix(waist, bottom, t), z];
  }

  // Subtract a true triangular aperture from the smooth forward fender.
  // The aperture is a straight front-projected triangle evaluated on the same
  // shoulder skin. Parametric clipping alone can fold paint over its own optic.
  function frontSkinAtXY(x,y,side) {
    // Invert the actual planar wing, not the superseded station cross-section.
    // Every aperture edge lies in this plane, so its return attaches exactly.
    const a=frontWingB.map((v,k)=>v-frontWingA[k]),b=frontWingC.map((v,k)=>v-frontWingA[k]);
    const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const z=frontWingA[2]-(n[0]*(x-frontWingA[0])+n[1]*(y-frontWingA[1]))/n[2];
    return [side*x,y,z];
  }
  function cutFrontFender(side,aperture) {
    const positions=[],normals=[],indices=[];
    const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
    const hole=aperture.map(([z,u])=>{const p=shoulderPoint(z,u,side);return [Math.abs(p[0]),p[1]];});
    const orientation=Math.sign(cross(hole[0],hole[1],hole[2]));
    const distance=(a,b,p)=>{const q=shoulderPoint(p[0],p[1],side);return orientation*cross(a,b,[Math.abs(q[0]),q[1]]);};
    function clip(poly,a,b,inside) {
      const out=[];
      for(let i=0;i<poly.length;i++){
        const previous=poly[(i+poly.length-1)%poly.length],current=poly[i];
        const vp=distance(a,b,previous),vc=distance(a,b,current);
        const kp=inside?vp>=-1e-12:vp<=1e-12,kc=inside?vc>=-1e-12:vc<=1e-12;
        if(kp!==kc){const t=vp/(vp-vc);out.push([mix(previous[0],current[0],t),mix(previous[1],current[1],t)]);}
        if(kc)out.push(current);
      }
      return out;
    }
    function emit(poly) {
      if(poly.length<3)return;
      const offset=positions.length/3;
      for(const [z,u] of poly){
        positions.push(...shoulderPoint(z,u,side));
        const a=frontShoulderPoint(Math.max(-2.16,z-.00001),u,side),b=frontShoulderPoint(Math.min(-1.06,z+.00001),u,side);
        const c=shoulderPoint(z,Math.max(0,u-.00001),side),d=shoulderPoint(z,Math.min(1,u+.00001),side);
        const v=b.map((x,k)=>x-a[k]),w=d.map((x,k)=>x-c[k]);
        let n=[v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0]];
        if(Math.hypot(...n)<1e-12){
          // Both tips of the planar triangular strip collapse to one point.
          // Its analytic plane normal is the correct limiting surface normal.
          const a=frontWingB.map((x,k)=>x-frontWingA[k]),b=frontWingC.map((x,k)=>x-frontWingA[k]);
          n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]].map(x=>-x);
          n[0]*=side;
          if(side<0)n=n.map(x=>-x);
        }
        const length=Math.hypot(...n)||1;normals.push(...n.map(x=>x/length*(side<0?-1:1)));
      }
      for(let i=1;i<poly.length-1;i++){
        const a=poly[0],b=poly[i],c=poly[i+1];
        if(Math.abs(cross(a,b,c))<1e-13)continue;
        // Both UV boundary tips collapse in 3D. Omit zero-area triangles in
        // the actual Float32 geometry, rather than leaving unraycastable fans.
        const point=j=>positions.slice(j*3,j*3+3).map(Math.fround);
        const p=point(offset),q=point(offset+i),r=point(offset+i+1);
        const v=q.map((x,k)=>x-p[k]),w=r.map((x,k)=>x-p[k]);
        if(Math.hypot(v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0])<1e-12)continue;
        indices.push(...(side<0?[offset,offset+i+1,offset+i]:[offset,offset+i,offset+i+1]));
      }
    }
    function subtract(poly) {
      for(let edge=0;edge<3&&poly.length>=3;edge++){
        const a=hole[edge],b=hole[(edge+1)%3];
        emit(clip(poly,a,b,false));poly=clip(poly,a,b,true);
      }
    }
    const rows=[...new Set([...Array.from({length:25},(_,i)=>mix(-2.16,-1.06,i/24)),-1.98,-1.75,frontWingA[2],-1.36])].sort((a,b)=>a-b);
    const columns=[...new Set([...Array.from({length:17},(_,i)=>i/16),.55,.7975])].sort((a,b)=>a-b);
    for(let row=0;row<rows.length-1;row++)for(let column=0;column<columns.length-1;column++){
      const z0=rows[row],z1=rows[row+1],u0=columns[column],u1=columns[column+1];
      subtract([[z0,u0],[z1,u0],[z1,u1]]);subtract([[z0,u0],[z1,u1],[z0,u1]]);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setIndex(indices);geo.computeBoundingBox();geo.computeBoundingSphere();
    return addMesh(`referenceLampShoulderBridge${side}`,geo,paint);
  }

  // Broad, almost planar hood. Its width stays substantial at the nose.
  surface('referenceFlatWedgeHood', (t, u) => {
    const z = mix(-2.16, -1.06, t), s = shape(z), x = (u * 2 - 1) * s.innerX;
    return [x, s.innerY + .0045 * (1 - (u * 2 - 1) ** 2), z];
  }, 96, 32, paint);
  for (const side of [-1, 1]) {
    surface(`referenceShoulder${side}`, (t, u) => mainShoulderPoint(mix(-1.06, 2.26, t), u, side), 176, 32, paint, body, side < 0);
    // The shoulder-to-door break is deliberately separate from the crown.
    surface(`referenceUpperFlank${side}`, (t, u) => sidePoint(mix(-2.16, 2.26, t), u * .48, side), 240, 8, paint, body, side < 0);
    surface(`referenceSculptedDoor${side}`, (t, u) => sidePoint(mix(-2.16, 2.26, t), .48 + u * .52, side), 240, 16, paint, body, side < 0);
    // Painted arch return/lip, nested behind the body edge, without faceted rings.
    surface(`referenceArchReturn${side}`, (t, u) => {
      const z = mix(-1.94, 2.26, t), s = shape(z), y = openingY(z);
      return [side * (Math.max(s.waistX - .030, s.edgeX - .040) - u * .035), y - u * .014, z];
    }, 240, 3, paint, body, side < 0);
    // A narrow black sill undercuts the white body between the wheel holes.
    // Its leading return terminates behind the bumper, above the front lip's
    // projected lower contour; no exposed pointed strip hangs beneath it.
    surface(`referenceCarbonSill${side}`, (t, u) => {
      const z = mix(-1.94, 2.24, t), s = shape(z), top = openingY(z);
      return [side * (Math.max(s.waistX - .030, s.edgeX - .040) - .002 + u * .008), mix(top - .008, Math.max(.12, top - .044), u), z];
    }, 224, 3, carbon, body, side < 0);

    // A dark optical pocket cut into the continuous fender, not a folded
    // triangular pod. Lens and walls sit inside the skin by only 12–18 mm.
    const p=(x,y,z)=>[side*x,y,z];
    const apertureUV=(x,y)=>{
      const point=frontSkinAtXY(x,y,1),z=point[2];
      const inner=frontShoulderPoint(z,0,1),crease=frontShoulderPoint(z,.55,1);
      return [z,.55*(x-inner[0])/(crease[0]-inner[0])];
    };
    // Keep the optical upper edge broad and shallow in front projection while
    // the physical wing slopes toward the shortened nose in side elevation.
    const aperture=[[frontWingC[2],0],apertureUV(.655,.635),apertureUV(.770,.650)];
    cutFrontFender(side,aperture);
    // Close the folded wing into the hood edge and the original rear shoulder;
    // no overlapping cosmetic plane or detached floating fin is left behind.
    const innerReturn=surface(`referenceFrontWingInnerReturn${side}`,(t,u)=>{
      const z=mix(-2.16,-1.06,t),a=frontShoulderPoint(z,0,side),q=shape(z),b=[side*q.innerX,q.innerY,z];
      return a.map((v,k)=>mix(v,b[k],u));
    },24,2,paint,body,side>0);innerReturn.castShadow=false;
    const rearReturn=facet(`referenceFrontWingRearReturn${side}`,[frontShoulderPoint(-1.06,0,side),mainShoulderPoint(-1.06,0,side),mainShoulderPoint(-1.06,.55,side)],paint,body,[0,0,1]);
    rearReturn.castShadow=false;
    const skin=aperture.map(([z,u])=>shoulderPoint(z,u,side));
    const inset=skin.map(([x,y,z])=>[x,y-.012,z+.014]);
    const lensMaterial=new THREE.MeshPhysicalMaterial({color:0x15232c,metalness:.35,roughness:.17,clearcoat:1,side:THREE.FrontSide});
    facet(`referenceTriangleHeadlamp${side}`,inset,lensMaterial,frontLights,[0,.4,-1]);
    for(let edge=0;edge<3;edge++){
      const next=(edge+1)%3;
      const va=skin[edge],vb=skin[next],delta=vb.map((v,k)=>v-va[k]),depth=[0,-.012,.014];
      const normal=[delta[1]*depth[2]-delta[2]*depth[1],delta[2]*depth[0]-delta[0]*depth[2],delta[0]*depth[1]-delta[1]*depth[0]];
      const center=skin[0].map((v,k)=>(v+skin[1][k]+skin[2][k])/3-(va[k]+vb[k])/2);
      const inwardFlip=normal.reduce((sum,v,k)=>sum+v*center[k],0)<0;
      // Follow the curved aperture edge with an actual dark internal liner.
      const pocketWall=surface(`referenceLampPocketWall${side}_${edge}`,(t,u)=>{
        const x=mix(Math.abs(skin[edge][0]),Math.abs(skin[next][0]),t),y=mix(skin[edge][1],skin[next][1],t);
        const a=frontSkinAtXY(x,y,side),b=inset[edge].map((v,k)=>mix(v,inset[next][k],t));
        return a.map((v,k)=>mix(v,b[k],u));
      },12,2,dark,frontLights,inwardFlip);
      pocketWall.castShadow=false; // enclosed optical liner, not silhouette
    }
    const bary=(a,b,c)=>inset[0].map((v,k)=>v*a+inset[1][k]*b+inset[2][k]*c);
    const lens=facet(`referenceHeadlightProjector${side}`,[bary(.90,.05,.05),bary(.05,.90,.05),bary(.05,.05,.90)].map(v=>[v[0],v[1]+.001,v[2]-.002]),lampWhite,frontLights,[0,.4,-1]);
    lens.userData.forwardOnly=true;
    const indicator=facet(`referenceFrontIndicator${side}`,[bary(.11,.78,.11),bary(.11,.11,.78),bary(.16,.105,.735),bary(.16,.735,.105)].map(v=>[v[0],v[1]+.001,v[2]-.002]),side<0?amberL:amberR,frontLights,[0,.4,-1]);
    indicator.userData.forwardOnly=true;
    // Rounded/swept outer nose cheeks close into the dark lower splitter.
    surface(`referenceFrontCheek${side}`,(t,u)=>{
      const top=shoulderPoint(-2.16,u,side);
      const x=mix(Math.abs(top[0]),mix(.710,.889,u),t),y=mix(top[1],mix(.335,.345,u),t);
      return [side*x,y,mix(-2.161,-2.151,t*t)];
    },28,20,paint,body,side>0);
    facet(`referenceFrontCarbonCorner${side}`,[p(.710,.335,-2.152),p(.889,.345,-2.152),p(.868,.155,-2.152),p(.730,.155,-2.152)],carbon,body,[0,0,-1]);

    // Side intake aft of the front wheel, plus the white knife-edge that borders it.
    facet(`referenceSideBladeRecess${side}`, [[-.932,.20],[-.783,.20],[-.738,.91],[-.887,.94]].map(([z,u])=>{const a=sidePoint(z,u,side);a[0]+=side*.002;return a;}),recess,body,[side,0,0]);
    facet(`referenceSideBlade${side}`, [[-.766,.18],[-.730,.18],[-.686,.96],[-.737,.95]].map(([z,u])=>{const a=sidePoint(z,u,side);a[0]+=side*.004;return a;}),paint,body,[side,0,0]);

    // Narrow, surface-following door shutlines. They are not raised black bars.
    for (const z of [-.650, .780]) ribbon(`referenceDoorSeam${side}_${z}`, t => {
      const a = sidePoint(z + .018 * Math.sin(Math.PI * t), mix(.02, .97, t), side); a[0] += side * .0012; return a;
    }, .0028, seamMaterial, body, [side, 0, 0], 48);
    ribbon(`referenceDoorLowerSeam${side}`,t=>{const z=mix(-.65,.78,t),a=sidePoint(z,.89+.045*Math.sin(Math.PI*t),side);a[0]+=side*.0015;return a;},.0025,seamMaterial,body,[side,0,0],64);
    const handle = box(`referenceFlushDoorHandle${side}`, [.003, .010, .094], [side * .955, .660, .35], dark);
    handle.rotation.x = -.08;
    // Small mirror camera fairings stay inside the original overall width.
    box(`referenceMirrorStalk${side}`, [.075, .012, .032], [side * .895, .756, -.745], carbon);
    const mirror = box(`referenceMirrorPod${side}`, [.132, .032, .062], [side * .949, .770, -.751], paint);
    mirror.rotation.y = -side * .10;
    facet(`referenceMirrorGlass${side}`, [p(.906, .757, -.718), p(1.007, .757, -.728), p(1.007, .778, -.728), p(.906, .778, -.718)], metal, body, [0, 0, 1]);
  }

  // Front mask: broad painted corners surround a black recessed, continuous
  // center fascia. The thin cross-nose white light has a single emitting face.
  facet('referenceFrontFasciaRecess', [[-.704, .460, -2.150], [.704, .460, -2.150], [.732, .257, -2.147], [-.732, .257, -2.147]], dark, body, [0, 0, -1]);
  facet('referenceFrontLowerIntake', [[-.701, .385, -2.156], [.701, .385, -2.156], [.754, .235, -2.156], [-.754, .235, -2.156]], recess, body, [0, 0, -1]);
  facet('referenceFrontBarHousing', [[-.690, .483, -2.169], [.690, .483, -2.169], [.695, .458, -2.169], [-.695, .458, -2.169]], dark, frontLights, [0, 0, -1]);
  const noseBar = facet('referenceCrossNoseLight', [[-.684, .476, -2.171], [.684, .476, -2.171], [.688, .467, -2.171], [-.688, .467, -2.171]], lampWhite, frontLights, [0, 0, -1]);
  noseBar.userData.forwardOnly = true;
  facet('referenceGrilleHorizontalBlade', [[-.715, .405, -2.159], [.715, .405, -2.159], [.717, .391, -2.159], [-.717, .391, -2.159]], carbon, body, [0, 0, -1]);
  // The lower nose has a raised central undercut and angled outer returns,
  // rather than one deep vertical black wall ending on a straight plank.
  const frontSplitterSection=u=>{
    const q=Math.max(0,(Math.abs(u*2-1)-.55)/.45),s=q*q*(3-2*q);
    return {top:.285-.065*s,bottom:.215-.060*s};
  };
  surface('referenceFrontSplitterTop',(t,u)=>{
    const s=frontSplitterSection(u);
    return [(u*2-1)*mix(.914,.954,t),s.top-.020*t,mix(-2.184,-1.940,t)];
  },8,40,carbon,body);
  surface('referenceFrontSplitterEdge',(t,u)=>{
    const s=frontSplitterSection(u);
    return [(u*2-1)*.914,mix(s.top,s.bottom,t),-2.184-.004*Math.sin(Math.PI*t)];
  },4,40,carbon,body,true);
  // A tiny, non-luminous nose badge, with no oversized logo on the hood.
  facet('referenceNoseBadgeTop', [[-.023, .391, -2.163], [.023, .391, -2.163], [.017, .386, -2.163], [-.017, .386, -2.163]], metal, body, [0, 0, -1]);
  facet('referenceNoseBadgeStem', [[-.004, .387, -2.164], [.004, .387, -2.164], [.002, .370, -2.164], [-.002, .370, -2.164]], metal, body, [0, 0, -1]);
  ribbon('referenceHoodRearShutline', t => {
    const x = mix(-.665, .665, t); return [x, .698 + .0045 * (1 - (x / .668) ** 2), -1.063];
  }, .0025, seamMaterial, body, [0, 1, 0], 48);

  // A broad raked windshield, a low nearly planar roof and substantial white
  // flying buttresses. Side windows terminate before the rear wheel shoulders.
  const canopyProfile = profile([
    { z: -1.065, w: .642, y: .702, bw: .669, by: .696 },
    { z: -.820, w: .610, y: .863, bw: .800, by: .725 },
    { z: -.360, w: .520, y: 1.065, bw: .790, by: .745 },
    { z: .025, w: .477, y: 1.111, bw: .770, by: .763 },
    { z: .450, w: .445, y: 1.074, bw: .716, by: .793 },
    { z: .900, w: .393, y: .971, bw: .605, by: .835 },
    { z: 1.330, w: .312, y: .885, bw: .414, by: .852 },
    { z: 1.710, w: .270, y: .847, bw: .275, by: .847 }
  ]);
  const canopyStart = -1.065, canopyEnd = 1.710, windshieldTopZ = -.360;
  const windshieldSlope = (1.065-.702)/(windshieldTopZ-canopyStart);
  const windshieldY = z => .702+windshieldSlope*(z-canopyStart);
  const canopyEdgeY = z => z<=windshieldTopZ?windshieldY(z):canopyProfile(z).y;
  // Only the front windshield is a flat, raked pane. Its cowl and roof-edge
  // endpoints stay fixed; side glazing and the rear roof keep their own shape.
  const canopyStations=Array.from({length:105},(_,i)=>mix(canopyStart,canopyEnd,i/104));
  const windshieldTopRow=Math.round((windshieldTopZ-canopyStart)/(canopyEnd-canopyStart)*104);
  canopyStations[windshieldTopRow]=windshieldTopZ;
  const centralCanopy=surface('referencePanoramicCanopy', (t, u) => {
    const z=canopyStations[Math.round(t*104)],s=canopyProfile(z),q=2*u-1;
    const blend=Math.min(1,Math.max(0,(z-windshieldTopZ)/.385));
    const crown=.0035*(1-q*q)*blend*blend*(3-2*blend);
    return [q*(s.w-.027),z<=windshieldTopZ?windshieldY(z):s.y+crown,z];
  }, 104, 24, glass, canopy);
  // A real pane has one limiting normal, including its roof seam. Do not let
  // finite differences average the curved rear roof into its front edge rows.
  const paneNormal=[0,1,-windshieldSlope],paneNormalLength=Math.hypot(...paneNormal);
  const canopyNormals=centralCanopy.geometry.attributes.normal.array;
  for(let row=0;row<=windshieldTopRow;row++)for(let column=0;column<=24;column++)for(let axis=0;axis<3;axis++){
    canopyNormals[(row*25+column)*3+axis]=paneNormal[axis]/paneNormalLength;
  }
  exterior.userData.frontWindshield={mesh:'referencePanoramicCanopy',startZ:canopyStart,endZ:windshieldTopZ,startY:.702,endY:1.065,slope:windshieldSlope,lastPlanarRow:windshieldTopRow,columns:24};
  // The reference has separate outboard side panes and a pointed rear glass
  // corner, not one continuously pinched leaf ending on a vertical cutoff.
  // The central pane retains its front-wide / rear-narrow plan taper.
  const windowTip=[.664,.696,-1.065];
  const windowLowerFront=[.820,.752,-.820];
  const windowRoofFront=[.543,1.054,-.360];
  const windowRoofRear=[.540,1.063,.450];
  const windowRearPoint=[.660,.858,.945];
  const buttressTail=[.275,.847,1.710];
  const planeY=(x,z,a,b,c)=>{
    const v=b.map((q,k)=>q-a[k]),w=c.map((q,k)=>q-a[k]);
    const n=[v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0]];
    return a[1]-(n[0]*(x-a[0])+n[2]*(z-a[2]))/n[1];
  };
  const windowLowerRear=[.770,planeY(.770,.450,windowLowerFront,windowRoofFront,windowRoofRear),.450];
  const pointAlong=(points,z)=>{
    if(z<=points[0][2])return points[0];
    for(let i=1;i<points.length;i++)if(z<=points[i][2]){
      const a=points[i-1],b=points[i],t=(z-a[2])/(b[2]-a[2]);return a.map((v,k)=>mix(v,b[k],t));
    }
    return points[points.length-1];
  };
  const frontWindowUpper=profile([{z:-1.065,x:.664},{z:-.820,x:.633},{z:-.360,x:.543}]);
  const planeX=(y,z,a,b,c)=>{
    const v=b.map((q,k)=>q-a[k]),w=c.map((q,k)=>q-a[k]);
    const n=[v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0]];
    return a[0]-(n[1]*(y-a[1])+n[2]*(z-a[2]))/n[0];
  };
  const windowUpper=z=>{
    if(z<windowRoofFront[2]){
      const t=(z-windowTip[2])/(windowRoofFront[2]-windowTip[2]);
      return[frontWindowUpper(z).x,canopyProfile(z).y-.011+.005*(1-t),z];
    }
    if(z<=windowRoofRear[2]){const y=canopyProfile(z).y-.011;return[planeX(y,z,windowLowerFront,windowRoofFront,windowRoofRear),y,z];}
    return pointAlong([windowRoofRear,windowRearPoint],z);
  };
  const windowLower=z=>{
    if(z<=windowRoofRear[2])return pointAlong([windowTip,windowLowerFront,windowLowerRear],z);
    if(z>=windowRearPoint[2])return pointAlong([windowRearPoint,buttressTail],z);
    // A small geometric blend softens the quarter-pane transition while the
    // top boundary still closes exactly against the planar white buttress.
    const a=windowLowerRear,b=windowRearPoint,h=b[2]-a[2],t=(z-a[2])/h,t2=t*t,t3=t2*t;
    const d0=a.map((v,k)=>(v-windowLowerFront[k])/(a[2]-windowLowerFront[2]));
    const d1=b.map((v,k)=>(v-a[k])/h);
    return a.map((v,k)=>(2*t3-3*t2+1)*v+(t3-2*t2+t)*h*d0[k]+(-2*t3+3*t2)*b[k]+(t3-t2)*h*d1[k]);
  };
  const railOuter=z=>z<=windowRoofRear[2]?windowUpper(z):pointAlong([windowRoofRear,buttressTail],z);
  const railStations=[...new Set([...Array.from({length:105},(_,i)=>mix(canopyStart,canopyEnd,i/104)),...[-.820,-.360,.025,.450,.945]])].sort((a,b)=>a-b);
  const atStation=(t)=>railStations[Math.round(t*(railStations.length-1))];
  // One continuous glass mesh retains a planar main region with a gently
  // crowned outline and softened front/quarter transitions, not a flat cap.
  const glassStations=[...new Set([...Array.from({length:97},(_,i)=>mix(canopyStart,.945,i/96)),...[-.820,-.360,.025,.450]])].sort((a,b)=>a-b);
  for (const side of [-1,1]) {
    surface(`referenceWhiteRoofRail${side}`, (t,u) => {
      const z=atStation(t),s=canopyProfile(z),a=[s.w-.027,canopyEdgeY(z),z],b=railOuter(z);
      return [side*mix(a[0],b[0],u),mix(a[1],b[1],u),z];
    },railStations.length-1,6,paint,rails,side<0);
    surface(`referenceSideWindow${side}`,(t,u)=>{
      const z=glassStations[Math.round(t*(glassStations.length-1))],a=windowUpper(z),b=windowLower(z);
      return[side*mix(a[0],b[0],u),mix(a[1],b[1],u),z];
    },glassStations.length-1,8,sideGlass,canopy,side<0);
    // A separate planar white triangle spreads outward toward the aft glass
    // point, then merges into the rear shoulder. The inner rail adapts to glass.
    facet(`referenceRearButtress${side}`,[windowRoofRear,windowRearPoint,buttressTail].map(p=>[side*p[0],p[1],p[2]]),paint,rails,[side,1,0]);
    surface(`referenceWindowSill${side}`, (t,u) => {
      const z=atStation(t),p=windowLower(z);
      return [side*(p[0]+u*.019),p[1]-u*.013,z];
    },railStations.length-1,3,paint,rails,side<0);
    ribbon(`referenceWindowSeal${side}`,t=>{const p=windowLower(mix(canopyStart,.945,t));return[side*(p[0]+.001),p[1]+.002,p[2]];},.004,dark,canopy,[side,1,0],64);
  }
  exterior.userData.windowStructure={
    tip:windowTip,lowerFront:windowLowerFront,roofFront:windowRoofFront,roofRear:windowRoofRear,
    lowerRear:windowLowerRear,rearPoint:windowRearPoint,buttressTail,
    note:'Multi-view inferred landmarks; central taper retained, planar main side glass and acute aft point.'
  };
  // Front cowl has an opaque dark reverse face. Nothing luminous faces the cabin.
  facet('referenceWindshieldCowl', [[-.668, .697, -1.067], [.668, .697, -1.067], [.650, .714, -1.040], [-.650, .714, -1.040]], dark, canopy, [0, 1, -.3]);
  ribbon('referenceWindshieldWiper', t => [mix(-.37, .28, t), .720 + .012 * Math.sin(Math.PI * t), -1.018], .004, dark, canopy, [0, 1, -.3], 48);

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
  // The painted rear bridge rolls underneath into a recessed dark jet pocket.
  // Its central plate pad is molded into the bridge, not a separate giant slab.
  surface('referenceRearPaintedBumper',(t,u)=>{
    const x=mix(-.903,.903,u),q=Math.abs(x)/.903;
    const outer=Math.max(0,(q-.35)/.65),rise=outer*outer*(3-2*outer);
    const outboard=Math.min(1,Math.max(0,(q-.18)/.40)),hollow=outboard*outboard*(3-2*outboard);
    return [x,mix(.667,.562+.080*rise,t),2.278+(.028-.145*hollow)*Math.sin(Math.PI*t)-(.008+.030*q*q)*t];
  },24,64,paint,body,false);
  box('referenceRearPlatePad',[.315,.135,.014],[0,.603,2.307],paint);
  const plateMark = new THREE.MeshStandardMaterial({color:0x90989b,metalness:.1,roughness:.5});
  // Discreet registration-panel relief and reversing camera.
  box('referenceRearCamera',[.024,.013,.014],[0,.664,2.294],dark);
  for (const x of [-.13,.13]) box(`referencePlateFastener${x}`,[.008,.005,.002],[x,.628,2.316],metal);
  facet('referenceRearJetRecess',[[-.714,.570,2.040],[.714,.570,2.040],[.714,.310,2.040],[-.714,.310,2.040]],recess,body,[0,0,1]);
  // A shallow rounded rectangular shelf surrounds the four separate mouths.
  // Straight top/bottom runs and small corner fillets replace the fat oval rim.
  const carrier=(angle,width,height)=>{
    const r=.045,k=((1-angle/(Math.PI*2))*8%8+8)%8,segment=Math.floor(k),t=k-segment;
    let x,y,a;
    if(segment===0){x=mix(-width+r,width-r,t);y=height;}
    else if(segment===1){a=mix(Math.PI/2,0,t);x=width-r+r*Math.cos(a);y=height-r+r*Math.sin(a);}
    else if(segment===2){x=width;y=mix(height-r,-height+r,t);}
    else if(segment===3){a=mix(0,-Math.PI/2,t);x=width-r+r*Math.cos(a);y=-height+r+r*Math.sin(a);}
    else if(segment===4){x=mix(width-r,-width+r,t);y=-height;}
    else if(segment===5){a=mix(-Math.PI/2,-Math.PI,t);x=-width+r+r*Math.cos(a);y=-height+r+r*Math.sin(a);}
    else if(segment===6){x=-width;y=mix(-height+r,height-r,t);}
    else{a=mix(Math.PI,Math.PI/2,t);x=-width+r+r*Math.cos(a);y=height-r+r*Math.sin(a);}
    return[x,.440+y];
  };
  surface('referenceSculptedJetCarrierRim',(t,u)=>{const a=t*Math.PI*2,inner=carrier(a,.707,.094),outer=carrier(a,.765,.126);return [mix(inner[0],outer[0],u),mix(inner[1],outer[1],u),2.245+.030*u+.005*Math.sin(Math.PI*u)];},96,8,carbon,body,true);
  const carrierWall=surface('referenceJetCarrierDeepWall',(t,u)=>{const p=carrier(t*Math.PI*2,.707,.094);return [p[0],p[1],mix(2.040,2.245,u)];},96,4,dark,body,true);
  carrierWall.castShadow=false; // entirely inside the closed carrier silhouette
  for(const side of [-1,1]) {
    surface(`referenceDiffuserOuterCheek${side}`,(t,u)=>{
      const x=side*mix(.710,.920,u),y=mix(.592-.006*u,.210+.010*u,t);
      return [x,y,2.270-.075*Math.sin(Math.PI*u)-.030*Math.sin(Math.PI*t)];
    },32,16,carbon,body,side<0);
    facet(`referenceJetPocketSide${side}`,[[side*.714,.530,2.270],[side*.714,.510,2.190],[side*.714,.350,2.190],[side*.714,.350,2.275]],dark,body,[-side,0,0]);
    facet(`referenceRearReflector${side}`,[[side*.815,.570,2.277],[side*.905,.607,2.251],[side*.905,.581,2.251],[side*.815,.548,2.277]],lampRed,rearLights,[side*.2,0,1]);
  }
  surface('referenceJetPocketHeader',(t,u)=>{
    const x=mix(-.903,.903,u),q=Math.abs(x)/.903,outer=Math.max(0,(q-.35)/.65),rise=outer*outer*(3-2*outer);
    // Real underside return: close the recessed white bridge to the dark frame.
    return [x,mix(.562+.080*rise,.545-.045*q*q,t),mix(2.278-(.008+.030*q*q),2.245,t)];
  },8,32,carbon,body,false);
  surface('referenceJetPocketLowerLip',(t,u)=>{
    const x=mix(-.714,.714,u),q=x/.714;
    return [x,mix(.310,.290,t)+.018*q*q,mix(2.190,2.285,t)];
  },8,32,carbon,body,false);
  // Continuous undertray and deep diffuser keep road/sky from showing through.
  surface('referenceClosedUndertray', (t, u) => {
    const z = mix(-2.06, 2.29, t), x = mix(-.745, .745, u);
    const rise = Math.max(0, (z - 1.65) / .64);
    return [x, .129 + .074 * rise * rise + .012 * Math.cos((u - .5) * Math.PI), z];
  }, 100, 32, carbon);
  // A closed, recessed multi-channel bulkhead keeps the original opaque
  // coverage but gives each diffuser throat real bowl depth instead of a door.
  const diffuserDividers=[-.710,-.473,-.237,0,.237,.473,.710];
  const diffuserBacking=surface('referenceClosedDiffuserBacking',(t,u)=>{
    const x=mix(-.80,.80,u);let channel=0;
    for(let i=0;i<diffuserDividers.length-1;i++)if(x>=diffuserDividers[i]&&x<=diffuserDividers[i+1]){
      const q=(x-diffuserDividers[i])/(diffuserDividers[i+1]-diffuserDividers[i]);channel=Math.sin(Math.PI*q)**2;break;
    }
    return[x,mix(-.085,.085,t),.0175-.145*channel*Math.sin(Math.PI*t)];
  },12,48,carbon,body,true);
  diffuserBacking.position.set(0,.275,2.13);
  diffuserBacking.castShadow=false; // enclosed internal bulkhead, not silhouette
  {
    const g=diffuserBacking.geometry,positions=Array.from(g.attributes.position.array),normals=Array.from(g.attributes.normal.array),indices=Array.from(g.index.array);
    const at=i=>positions.slice(i*3,i*3+3),back=p=>[p[0],p[1],-.20];
    const face=(points,toward)=>{
      const a=points[0],v=points[1].map((x,k)=>x-a[k]),w=points[2].map((x,k)=>x-a[k]);
      let n=[v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0]];
      const reverse=n.reduce((sum,x,k)=>sum+x*toward[k],0)<0,length=Math.hypot(...n);
      n=n.map(x=>x/length*(reverse?-1:1));const offset=positions.length/3;
      points.forEach(p=>{positions.push(...p);normals.push(...n);});
      for(let i=1;i<points.length-1;i++)indices.push(...(reverse?[offset,offset+i+1,offset+i]:[offset,offset+i,offset+i+1]));
    };
    // Match every boundary sample on both skins; no clustering/T-junction seam.
    const boundary=[...Array.from({length:48},(_,c)=>c),...Array.from({length:12},(_,r)=>r*49+48),...Array.from({length:48},(_,c)=>12*49+48-c),...Array.from({length:12},(_,r)=>(12-r)*49)];
    for(let i=0;i<boundary.length;i++){
      const a=at(boundary[i]),b=at(boundary[(i+1)%boundary.length]),ba=back(a),bb=back(b);
      face([a,ba,bb,b],[b[1]-a[1],a[0]-b[0],0]);
      face([[0,0,-.20],ba,bb],[0,0,-1]);
    }
    g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();
  }
  // Curved diffuser ramps and thin swept vertical fences. Their trailing
  // edge stays open between channels instead of reading as a rectangular tray.
  surface('referenceDiffuserBowl',(t,u)=>{
    const x=mix(-.730,.730,u),z=mix(1.68,2.292,t);
    const channels=.026*(.5+.5*Math.cos(x/.242*Math.PI*2))*t*t;
    return [x,.132+.064*t*t+channels,z];
  },32,48,carbon,body,false);
  facet('referenceDiffuserTrailingFace',[[-.748,.197,2.292],[.748,.197,2.292],[.748,.182,2.292],[-.748,.182,2.292]],dark,body,[0,0,1]);
  for(const x of [-.710,-.473,-.237,0,.237,.473,.710]) {
    for(const face of [-1,1]) {
      const fin=surface(`referenceDiffuserFin${x}_${face}`,(t,u)=>{
        const z=mix(1.76,2.292,t)-.045*Math.sin(Math.PI*t)*u,base=.135+.047*t*t;
        const sweep=Math.sign(x)*(.030*t*t-.026*Math.sin(Math.PI*t))*u;
        const belly=Math.sin(Math.PI*u)*t*t;
        return [x+sweep+Math.sign(x)*.012*belly+face*.004,base+u*(.008+.146*t*t*t),z-.035*belly];
      },16,4,carbon,body,face>0);
      fin.userData.diffuser=true;
      fin.userData.shadowExact=true;
      // The proxy is double-sided; one face casts this 8 mm-thick fence.
      fin.castShadow=face>0&&Math.abs(x)>.70; // inner fences are enclosed by the body silhouette
    }
    surface(`referenceDiffuserFinEdge${x}`,(t,u)=>{
      const sweep=Math.sign(x)*(.030*t*t-.026*Math.sin(Math.PI*t)),base=.135+.047*t*t;
      return [x+sweep+mix(-.004,.004,u),base+.008+.146*t*t*t,mix(1.76,2.292,t)-.045*Math.sin(Math.PI*t)];
    },16,1,carbon,body,false);
  }

  // Sculpted active white wing. All geometry remains local to the existing
  // animated pivot; normal/flight/air-brake angles still come from physics.
  const wingLeading=x=>-.205+.050*(x/.855)**2;
  const wingTrailing=x=>.285-.030*(x/.855)**2;
  const wingSection=(x,t)=>{
    const y=.095+.012*(1-(x/.855)**2)+.025*Math.sin(Math.PI*t);
    const thickness=.004+.020*Math.sin(Math.PI*t)**.7;
    return {y,thickness,z:mix(wingLeading(x),wingTrailing(x),t)};
  };
  surface('referenceWhiteWingBlade',(t,u)=>{const x=mix(-.855,.855,u),s=wingSection(x,t);return[x,s.y,s.z];},18,56,paint,activeWing);
  surface('referenceWingCarbonUnderside',(t,u)=>{const x=mix(-.855,.855,u),s=wingSection(x,t);return[x,s.y-s.thickness,s.z];},18,56,carbon,activeWing,true);
  surface('referenceWingLeadingEdge',(t,u)=>{const x=mix(-.855,.855,u),s=wingSection(x,0);return[x,s.y-t*s.thickness,s.z];},1,56,paint,activeWing,true);
  surface('referenceWingTrailingEdge',(t,u)=>{const x=mix(-.855,.855,u),s=wingSection(x,1);return[x,s.y-t*s.thickness,s.z];},1,56,carbon,activeWing,false);
  // Closed thin extrusions replace the detached rectangular endplate boxes.
  // Individual planar faces have independent limiting normals at hard edges.
  function wingPanel(name,outline,side,x,thickness,material){
    const positions=[],indices=[];
    const area=outline.reduce((sum,p,i)=>{const q=outline[(i+1)%outline.length];return sum+p[0]*q[1]-q[0]*p[1];},0),orientation=Math.sign(area);
    const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    const remaining=outline.map((_,i)=>i),cap=[];
    while(remaining.length>3){
      let clipped=false;
      for(let i=0;i<remaining.length;i++){
        const a=remaining[(i+remaining.length-1)%remaining.length],b=remaining[i],c=remaining[(i+1)%remaining.length];
        if(orientation*cross(outline[a],outline[b],outline[c])<=1e-12)continue;
        const contains=remaining.some(j=>j!==a&&j!==b&&j!==c&&[cross(outline[a],outline[b],outline[j]),cross(outline[b],outline[c],outline[j]),cross(outline[c],outline[a],outline[j])].every(v=>orientation*v>=-1e-12));
        if(contains)continue;
        cap.push(a,b,c);remaining.splice(i,1);clipped=true;break;
      }
      if(!clipped)throw Error(`Invalid wing panel outline: ${name}`);
    }
    cap.push(...remaining);
    const face=(points,toward,triangles=null)=>{
      const first=triangles?triangles.slice(0,3):[0,1,2];
      const a=points[first[0]],b=points[first[1]],c=points[first[2]],v=b.map((q,k)=>q-a[k]),w=c.map((q,k)=>q-a[k]);
      const n=[v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0]];
      const reverse=n.reduce((sum,q,k)=>sum+q*toward[k],0)<0,offset=positions.length/3;
      points.forEach(p=>positions.push(...p));
      const local=triangles||Array.from({length:points.length-2},(_,i)=>[0,i+1,i+2]).flat();
      for(let i=0;i<local.length;i+=3){const a=offset+local[i],b=offset+local[i+1],c=offset+local[i+2];indices.push(...(reverse?[a,c,b]:[a,b,c]));}
    };
    const outside=outline.map(([y,z])=>[side*x,y,z]),inside=outline.map(([y,z])=>[side*(x-thickness),y,z]);
    face(outside,[side,0,0],cap);face(inside,[-side,0,0],cap);
    for(let i=0;i<outline.length;i++){
      const j=(i+1)%outline.length,dy=outline[j][0]-outline[i][0],dz=outline[j][1]-outline[i][1];
      face([outside[i],inside[i],inside[j],outside[j]],[0,orientation*dz,-orientation*dy]);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
    return addMesh(name,g,material,activeWing);
  }
  for(const side of [-1,1]){
    const edge=[0,.25,.5,.75,1].map(t=>{const s=wingSection(.855,t);return[s.y,s.z];});
    const outline=[...edge,[-.035,.255],[-.045,.180],[-.018,-.160]];
    wingPanel(`referenceWhiteWingEndplate${side}`,outline,side,.855,.008,paint);
    const arm=[[-.100,-.090],[-.075,-.065],[-.025,.005],[.086,.058],[.112,.040],[.088,.013],[-.010,-.028],[-.065,-.080]];
    wingPanel(`referenceWingSupport${side}`,arm,side,.4725,.025,carbon);
    box(`referenceWingBaseMount${side}`,[.076,.019,.095],[side*.460,-.100,-.080],carbon,activeWing);
  }
  exterior.userData.wingProfile={span:1.710,centerChord:.490,tipChord:.410,constructionPivot:[0,.85,2.04],poseSource:'Existing physics-main.js activeWingGroup targets, unchanged.'};

  // The side photograph's wheel-axis-normalized upper tail falls aft instead
  // of ending in a near-level shelf. Deform the existing connected upper body
  // once at construction; do not move the wing pivot, wheels or jet assembly.
  // The height ramp fades out above the plate/nozzle region. Its derivative
  // keeps dy'/dy >= .386, so this cannot invert or collapse the rear fascia.
  const tailDown={startZ:1.38,endZ:2.26,startY:.635,rampHeight:.100,crestDrop:.100,referenceCrestY:.848,protectedArchClearance:.015};
  const tailHeight=(y,z=tailDown.endZ)=>{
    const cutoff=Math.max(tailDown.startY,openingY(z)+tailDown.protectedArchClearance),r=z-1.38;
    const cutoffSlope=cutoff>tailDown.startY?-1.420*r/Math.sqrt(.430**2-r*r):0;
    const d=y-cutoff;
    return d<=0?{value:0,slope:0,cutoffSlope}:d<tailDown.rampHeight
      ?{value:d*d/(2*tailDown.rampHeight),slope:d/tailDown.rampHeight,cutoffSlope}
      :{value:d-tailDown.rampHeight/2,slope:1,cutoffSlope};
  };
  const tailScale=tailDown.crestDrop/tailHeight(tailDown.referenceCrestY).value;
  function tailDownSample(point){
    const [x,y,z]=point,t=Math.max(0,Math.min(1,(z-tailDown.startZ)/(tailDown.endZ-tailDown.startZ)));
    const blend=t*t*(3-2*t),height=tailHeight(y,z);
    return [x,y-tailScale*blend*height.value,z];
  }
  const tailUnchangedRelief=/^reference(?:RearPlatePad|RearCamera|PlateFastener)/;
  let tailChangedMeshes=0,tailChangedVertices=0;
  // The aft central-glass edge and buttress/rail feet share the deck taper.
  // Front windshield and side panes are ahead of this domain, bit-identical.
  for(const root of [body,canopy,rails,rearLights])root.traverse(part=>{
    if(!part.geometry||tailUnchangedRelief.test(part.name))return;
    const g=part.geometry,p=g.attributes.position,n=g.attributes.normal;
    let changed=false;
    for(let i=0;i<p.count;i++){
      const y=p.getY(i)+part.position.y,z=p.getZ(i)+part.position.z;
      if(z<=tailDown.startZ||y<=tailDown.startY)continue;
      // All affected production panels are untranslated or translation-only.
      // Fail loudly if a future refactor introduces a rotated/scaled tail part.
      if(part.rotation.x||part.rotation.y||part.rotation.z||part.scale.x!==1||part.scale.y!==1||part.scale.z!==1)throw Error('Unsupported tail panel transform: '+part.name);
      const t=Math.min(1,(z-tailDown.startZ)/(tailDown.endZ-tailDown.startZ)),blend=t*t*(3-2*t);
      const blendSlope=t<1?6*t*(1-t)/(tailDown.endZ-tailDown.startZ):0,height=tailHeight(y,z);
      if(height.value===0)continue;
      const a=1-tailScale*blend*height.slope,b=-tailScale*blendSlope*height.value+tailScale*blend*height.slope*height.cutoffSlope;
      p.array[i*3+1]=y-tailScale*blend*height.value-part.position.y;
      if(n){
        // Exact inverse-transpose Jacobian, preserving the source hard edges
        // rather than averaging flat fascia normals across unrelated panels.
        const nx=n.getX(i),ny=n.getY(i)/a,nz=n.getZ(i)-b*ny,length=Math.hypot(nx,ny,nz);
        n.array[i*3]=nx/length;n.array[i*3+1]=ny/length;n.array[i*3+2]=nz/length;
      }
      changed=true;tailChangedVertices++;
    }
    if(changed){
      // A three-corner buttress is still one actual plane after its aft foot
      // moves. Use that plane's normal, not a smoothly bent continuum normal.
      if(/^referenceRearButtress/.test(part.name))g.computeVertexNormals();
      p.needsUpdate=true;if(g.attributes.normal)g.attributes.normal.needsUpdate=true;
      g.computeBoundingBox();g.computeBoundingSphere();tailChangedMeshes++;
    }
  });
  exterior.userData.tailDownProfile={...tailDown,scale:tailScale,minimumJacobian:1-tailScale,changedMeshes:tailChangedMeshes,changedVertices:tailChangedVertices,note:'Conservative side-reference estimate:100mm additional upper-tail drop. Plate relief, four nozzles, lower diffuser and animated wing retain their existing geometry/poses.'};
  exterior.userData.windowStructure.buttressTail=tailDownSample(buttressTail);

  // Render the exact detailed exterior once, rather than drawing every trim
  // panel again into the 2048² shadow map. Two shared-material silhouette
  // batches retain the body footprint and independently animated wing.
  // Surface decimation affects ONLY the shadow pass; visible meshes are intact.
  const shadowMaterial = new THREE.MeshBasicMaterial({
    colorWrite: false, depthWrite: false, side: THREE.FrontSide,
    shadowSide: THREE.DoubleSide
  });
  function shadowBatch(name, roots, parent) {
    const positions = [], indices = [];
    const point = new THREE.Vector3();
    const append = part => {
      if (!part.geometry || !part.castShadow) return;
      part.castShadow = false;
      part.updateMatrix();
      const p = part.geometry.attributes.position, index = part.geometry.index?.array;
      const offset = positions.length / 3;
      const push = at => {
        point.fromBufferAttribute(p, at).applyMatrix4(part.matrix);
        positions.push(point.x, point.y, point.z);
      };
      const rows = part.userData.surfaceRows, columns = part.userData.surfaceColumns;
      if (rows && columns && !part.userData.shadowExact) {
        // Retain extra source rows at tight wheel openings and sill creases.
        // Uniform decimation alone can bridge those sharp profile transitions.
        const samples = (last, step, across, rowAxis) => {
          const out = [];
          const at = (i,j) => (rowAxis ? i * (columns + 1) + j : j * (columns + 1) + i) * 3;
          const refine = (first,end) => {
            let error = 0, split = first;
            for (let i=first+1; i<end; i++) for (let j=0; j<=across; j++) {
              const t = (i-first)/(end-first), a = at(first,j), b = at(end,j), v = at(i,j);
              let distance2 = 0;
              for (let axis=0; axis<3; axis++) distance2 += (p.array[v+axis] - mix(p.array[a+axis],p.array[b+axis],t)) ** 2;
              if (distance2 > error) { error = distance2; split = i; }
            }
            if (error > .008 ** 2) { refine(first,split); refine(split,end); }
            else out.push(first);
          };
          for (let first=0; first<last; first+=step) refine(first,Math.min(last,first+step));
          out.push(last); return out;
        };
        const rs = samples(rows,5,columns,true), cs = samples(columns,2,rows,false);
        part.userData.shadowGridRows = rs;
        part.userData.shadowGridColumns = cs;
        rs.forEach(r => cs.forEach(c => push(r * (columns + 1) + c)));
        const flip = index[1] > index[2];
        for (let r=0; r<rs.length-1; r++) for (let c=0; c<cs.length-1; c++) {
          const a = offset + r * cs.length + c, b = a + 1, lo = a + cs.length, d = lo + 1;
          indices.push(...(flip ? [a,d,lo,a,b,d] : [a,lo,d,a,d,b]));
        }
      } else {
        for (let i=0; i<p.count; i++) push(i);
        for (const at of index || Array.from({length:p.count}, (_,i) => i)) indices.push(offset + at);
      }
    };
    roots.forEach(root => root.traverse(append));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const proxy = new THREE.Mesh(geometry, shadowMaterial);
    proxy.name = name; proxy.castShadow = true;
    proxy.userData.shadowProxy = true;
    // The invisible caster must never obstruct instrument, light or road rays.
    proxy.raycast = () => {};
    parent.add(proxy);
  }
  shadowBatch('reference-body-shadow', [body,canopy,rails,frontLights,rearLights], exterior);
  shadowBatch('reference-wing-shadow', [activeWing], activeWing);

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
  exterior.userData.frontWingLandmarks={nose:frontWingC,axleFold:frontWingA,cowl:frontWingB};
  exterior.userData.likenessRevision = 'downward-tail-planar-front-glass-v7';
  exterior.userData.wingPivot = [0, .85, 2.04];
  // Public numeric samplers support runtime geometry tests and future matching.
  exterior.userData.sampleShoulder = (z, u, side = 1) => tailDownSample(shoulderPoint(z, u, side));
  exterior.userData.sampleFlank = (z, u, side = 1) => tailDownSample(sidePoint(z, u, side));
  exterior.userData.wheelOpeningY = openingY;
  return exterior;
}
