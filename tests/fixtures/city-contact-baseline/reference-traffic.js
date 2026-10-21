// Random reuse of every preserved historical style. Only the clean compact
// retopology is live: original archives and failed clustering experiments stay
// offline. Shared geometry/material pools are bounded by the asset inventory.
(() => {
  const variants = archivedTrafficAssets.variants;
  const variantsById = new Map(variants.map(variant => [variant.id, variant]));
  // Source-only/normal-only revisions share geometry honestly, while retaining
  // their own historical identity in each NPC's stable provenance record.
  const choices = variants.flatMap(variant => variant.archiveEntries.map(entry => ({ variant, entry })));
  const geometryCache = new Map();
  const materialPool = new Map(archivedTrafficAssets.palette.map(role => [role.id,
    new THREE.MeshStandardMaterial({ name: `traffic-shared-${role.id}`, color: role.color,
      emissive: role.emissive || 0, emissiveIntensity: role.emissive ? .28 : 0,
      metalness: role.metalness, roughness: role.roughness, side: THREE.FrontSide })]));
  const paintMaterials = trafficPalette.map(color => new THREE.MeshStandardMaterial({
    color, metalness: .42, roughness: .27, side: THREE.FrontSide
  }));
  const MAX_TRAFFIC = 52;
  const MAX_NEAR = 8;
  const NEAR_DISTANCE = 64;
  const farthest = new Float64Array(MAX_NEAR);
  const nearest = new Array(MAX_NEAR);

  function geometry(index) {
    if (!geometryCache.has(index)) {
      const data = unpackArchivedTrafficGeometry(archivedTrafficAssets.geometryPool[index]);
      const value = new THREE.BufferGeometry();
      value.setAttribute('position', new THREE.Float32BufferAttribute(data.position, 3));
      value.setAttribute('normal', new THREE.Float32BufferAttribute(data.normal, 3));
      value.setIndex(Array.from(data.index));
      value.computeBoundingBox(); value.computeBoundingSphere();
      geometryCache.set(index, value);
    }
    return geometryCache.get(index);
  }
  function setDetail(car, level) {
    if (car.userData.trafficDetail === level) return;
    const definition = variantsById.get(car.userData.trafficVariant).levels[level];
    for (let slot = 0; slot < car.children.length; slot++) {
      const mesh = car.children[slot], index = definition.geometries[slot];
      mesh.visible = index !== undefined;
      if (index === undefined) continue;
      const role = archivedTrafficAssets.geometryPool[index].material;
      mesh.geometry = geometry(index);
      mesh.material = role === 'body' ? paintMaterials[car.userData.paintIndex] : materialPool.get(role);
      mesh.name = `npc-${car.userData.trafficVariant}-${role}`;
    }
    car.userData.trafficDetail = level;
    car.userData.triangleCount = definition.triangles;
    car.userData.drawSubmissions = definition.draws;
  }
  createTrafficVehicleMesh = function(typeIndex, selectedVariant) {
    const random = selectedVariant ? 0 : Math.random();
    const choice = selectedVariant
      ? { variant: variantsById.get(selectedVariant), entry: variantsById.get(selectedVariant)?.archiveEntries[0] }
      : choices[Math.min(choices.length - 1, Math.floor(random * choices.length))];
    if (!choice?.variant) throw Error('Unknown preserved traffic variant');
    const car = new THREE.Group();
    car.name = `npc-${choice.variant.id}`;
    car.userData = {
      model: choice.variant.id,
      trafficVariant: choice.variant.id,
      archiveEntry: choice.entry,
      sourceGeometrySha256: choice.variant.sourceGeometrySha256,
      paintIndex: ((typeIndex % paintMaterials.length) + paintMaterials.length) % paintMaterials.length,
      // Circular symmetric baked wheel discs make a static pose unobtrusive;
      // keep the established wheel list contract without per-frame wheel work.
      wheels: [], length: 4.62, height: 1.25
    };
    const initial = choice.variant.levels.far;
    for (const index of initial.geometries) {
      const role = archivedTrafficAssets.geometryPool[index].material;
      const mesh = new THREE.Mesh(geometry(index), role === 'body' ? paintMaterials[car.userData.paintIndex] : materialPool.get(role));
      mesh.castShadow = false; mesh.receiveShadow = false;
      car.add(mesh);
    }
    setDetail(car, 'far');
    return car;
  };

  // A population change releases only instance nodes. Cached assets are shared
  // by every NPC and are never disposed when a sibling car is removed.
  const originalPopulate = populateTraffic;
  populateTraffic = function(count) {
    const bounded = Number.isFinite(count) ? Math.max(0, Math.min(MAX_TRAFFIC, Math.floor(count))) : 0;
    originalPopulate(bounded);
  };
  function updateTrafficVehicleLods(cars, eye) {
    let kept = 0;
    const limitSquared = NEAR_DISTANCE * NEAR_DISTANCE;
    for (const car of cars) {
      const mesh = car.mesh;
      const dx = mesh.position.x - eye.x, dy = mesh.position.y - eye.y, dz = mesh.position.z - eye.z;
      const distance = dx * dx + dy * dy + dz * dz;
      if (distance >= limitSquared) continue;
      let slot = kept;
      while (slot > 0 && farthest[slot - 1] > distance) slot--;
      if (slot >= MAX_NEAR) continue;
      const end = Math.min(kept, MAX_NEAR - 1);
      for (let i = end; i > slot; i--) { nearest[i] = nearest[i - 1]; farthest[i] = farthest[i - 1]; }
      nearest[slot] = mesh; farthest[slot] = distance;
      kept = Math.min(MAX_NEAR, kept + 1);
    }
    for (const car of cars) {
      let isNear = false;
      for (let i = 0; i < kept; i++) if (nearest[i] === car.mesh) { isNear = true; break; }
      setDetail(car.mesh, isNear ? 'near' : 'far');
    }
    // Do not retain previous populations through the fixed scratch buffer.
    for (let i = 0; i < MAX_NEAR; i++) nearest[i] = null;
  }
  window.RoadsterTrafficAssets = Object.freeze({
    updateLods: updateTrafficVehicleLods,
    variants: Object.freeze(variants.map(variant => Object.freeze({ id: variant.id, label: variant.label,
      archiveEntries: Object.freeze([...variant.archiveEntries]), nearTriangles: variant.levels.near.triangles,
      farTriangles: variant.levels.far.triangles }))),
    bounds: Object.freeze({ maximumCars: MAX_TRAFFIC, maximumNearCars: MAX_NEAR,
      nearDistance: NEAR_DISTANCE, maximumMeshesPerCar: 6, maximumShadowMeshes: 0 }),
    stats: () => ({ cachedGeometries: geometryCache.size, maximumGeometries: archivedTrafficAssets.geometryPool.length,
      sharedMaterials: materialPool.size + paintMaterials.length })
  });
})();
