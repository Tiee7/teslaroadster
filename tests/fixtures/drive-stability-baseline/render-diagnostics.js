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
  const sceneBefore = scene.onBeforeRender, sceneAfter = scene.onAfterRender;
  scene.onBeforeRender = function (...args) {
    frame.started++; frame.lastStartedAt = now();
    const result = typeof sceneBefore === 'function' ? sceneBefore.apply(this, args) : undefined;
    for (const { car } of nearby().selected) for (const child of (car.mesh.children || []).slice(0, CHILD_LIMIT)) observe(child);
    return result;
  };
  scene.onAfterRender = function (...args) {
    frame.finished++; frame.lastFinishedFrame = frame.started; frame.lastFinishedAt = now();
    return typeof sceneAfter === 'function' ? sceneAfter.apply(this, args) : undefined;
  };
  const canvas = renderer.domElement;
  canvas?.addEventListener?.('webglcontextlost', () => { contextEvents.lost++; contextEvents.lastLostAt = now(); });
  canvas?.addEventListener?.('webglcontextrestored', () => { contextEvents.restored++; contextEvents.lastRestoredAt = now(); });
  const registered = typeof window.RoadsterCityDiagnostics?.setRuntimeReader === 'function';
  if (registered) window.RoadsterCityDiagnostics.setRuntimeReader(read);
  window.RoadsterRenderDiagnostics = Object.freeze({ snapshot: () => read({ phase: 'live' }), read, registered });
})();
