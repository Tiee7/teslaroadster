// Hidden city passenger sandbox. Its session and score never enter ranked scoring.
// The model is renderer-independent so route, proximity, and lifecycle rules are testable.
const CityTaxiModel = (() => {
  'use strict';
  const WAITING_COUNT = 5;
  const ARRIVAL_RADIUS = 2;
  const PICKUP_RADIUS = ARRIVAL_RADIUS * 2;
  const MARKER_RADIUS = 3;
  const STOP_CLEARANCE = MARKER_RADIUS + 1;
  const GROUND_TOLERANCE = 0.35;
  const MIN_ROUTE_METERS = 900;
  const MAX_ROUTE_METERS = 3600;
  // A straight-line lower bound prevents even corner-cutting on wide roads from producing a short fare.
  const MIN_DIRECT_METERS = 900;
  const PICKUP_SPACING_METERS = 600;

  // Check the whole beam footprint, including a margin for building trim and walls.
  function isStopClear(point, buildings = [], halfBound = Infinity) {
    if (Math.abs(point.x) + STOP_CLEARANCE >= halfBound || Math.abs(point.z) + STOP_CLEARANCE >= halfBound) return false;
    return buildings.every(building => {
      const dx = Math.max(building.minX - point.x, 0, point.x - building.maxX);
      const dz = Math.max(building.minZ - point.z, 0, point.z - building.maxZ);
      return Math.hypot(dx, dz) > STOP_CLEARANCE;
    });
  }

  function buildRoadGraph(roadCoords, laneOffset = 11.5, buildings = [], halfBound = Infinity) {
    const coords = [...roadCoords].sort((a, b) => a - b);
    if (coords.length < 4 || new Set(coords).size !== coords.length || !coords.every(Number.isFinite)) throw new Error('Invalid city road grid');
    const nodes = coords.flatMap((x, col) => coords.map((z, row) => ({
      x: x + laneOffset, y: 0, z: z + laneOffset, col, row,
    }))).filter(point => isStopClear(point, buildings, halfBound))
      .map((point, id) => Object.freeze({ ...point, id }));
    const edges = nodes.map(node => nodes.filter(other =>
      (other.col === node.col && Math.abs(other.row - node.row) === 1) ||
      (other.row === node.row && Math.abs(other.col - node.col) === 1)
    ).map(other => ({ id: other.id, meters: Math.hypot(other.x - node.x, other.z - node.z) })));
    return { nodes, edges };
  }

  // Dijkstra follows only the connected asphalt avenues, never a line through a block.
  function shortestRoute(graph, fromId, toId) {
    const distance = graph.nodes.map(() => Infinity);
    const previous = graph.nodes.map(() => -1);
    const remaining = new Set(graph.nodes.map(node => node.id));
    if (!remaining.has(fromId) || !remaining.has(toId)) return null;
    distance[fromId] = 0;
    while (remaining.size) {
      let nearest = -1;
      for (const id of remaining) if (nearest < 0 || distance[id] < distance[nearest]) nearest = id;
      if (!Number.isFinite(distance[nearest])) return null;
      remaining.delete(nearest);
      if (nearest === toId) break;
      for (const edge of graph.edges[nearest]) {
        const proposed = distance[nearest] + edge.meters;
        if (remaining.has(edge.id) && proposed < distance[edge.id]) {
          distance[edge.id] = proposed;
          previous[edge.id] = nearest;
        }
      }
    }
    const path = [];
    for (let id = toId; id !== -1; id = previous[id]) path.unshift(graph.nodes[id]);
    return { meters: distance[toId], path };
  }

  function fareForDistance(meters) {
    const fraction = Math.max(0, Math.min(1, (meters - MIN_ROUTE_METERS) / (MAX_ROUTE_METERS - MIN_ROUTE_METERS)));
    return Math.round(1000 + fraction * 2000);
  }

  const copyPosition = position => ({ x: position.x, y: position.y, z: position.z });
  const validPosition = position => position && [position.x, position.y, position.z].every(Number.isFinite);
  // Car forward is (-sin(yaw), -cos(yaw)); positive screen rotation points right.
  // Project onto the car's horizontal axes, independent of camera mode or drift.
  function destinationBearing(position, yaw, destination) {
    if (!validPosition(position) || !validPosition(destination) || !Number.isFinite(yaw)) return null;
    const dx = destination.x - position.x, dz = destination.z - position.z;
    const right = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    const forward = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
    return { radians: Math.atan2(right, forward), meters: Math.hypot(dx, dz) };
  }
  // Swept 3D proximity catches a fast car between frames but rejects flying above a stop.
  function withinArrival(from, to, stop, radius = ARRIVAL_RADIUS) {
    if (!validPosition(from) || !validPosition(to) || !validPosition(stop) || !Number.isFinite(radius) || radius < 0) return false;
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const lengthSquared = dx * dx + dy * dy + dz * dz;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
      ((stop.x - from.x) * dx + (stop.y - from.y) * dy + (stop.z - from.z) * dz) / lengthSquared));
    return Math.hypot(from.x + dx * t - stop.x, from.y + dy * t - stop.y, from.z + dz * t - stop.z) <= radius;
  }

  function createSession(graph, random = Math.random) {
    const routes = graph.nodes.map(from => graph.nodes.map(to => shortestRoute(graph, from.id, to.id)));
    const destinations = graph.nodes.map(from => graph.nodes.filter(to => {
      const route = routes[from.id][to.id];
      return route && route.meters >= MIN_ROUTE_METERS && Math.hypot(from.x - to.x, from.z - to.z) >= MIN_DIRECT_METERS;
    }));
    if (graph.nodes.length < WAITING_COUNT || destinations.some(stops => stops.length === 0)) throw new Error('City grid cannot support passenger routes');
    let active = false, waiting = [], passenger = null, score = 0, delivered = 0, sequence = 0, previousPosition = null;
    const pick = choices => choices[Math.min(choices.length - 1, Math.max(0, Math.floor(random() * choices.length)))];
    function newTrip(position) {
      let pickups = graph.nodes.filter(node =>
        !waiting.some(trip => trip.pickup.id === node.id) &&
        Math.hypot(position.x - node.x, position.z - node.z) >= 100 &&
        waiting.every(trip => routes[node.id][trip.pickup.id].meters >= PICKUP_SPACING_METERS));
      if (!pickups.length) throw new Error('No spaced city pickup remains');
      const pickup = pick(pickups);
      const choices = destinations[pickup.id].filter(node => !waiting.some(trip => trip.pickup.id === node.id));
      const destination = pick(choices.length ? choices : destinations[pickup.id]);
      const route = routes[pickup.id][destination.id];
      return Object.freeze({ id: ++sequence, pickup, destination, routeMeters: route.meters,
        route: Object.freeze([...route.path]), fare: fareForDistance(route.meters) });
    }
    function refill(position) {
      while (waiting.length < WAITING_COUNT) waiting.push(newTrip(position));
    }
    function start(position) {
      if (active || !validPosition(position)) return false;
      active = true; score = 0; delivered = 0; waiting = []; passenger = null;
      previousPosition = copyPosition(position); refill(position);
      return true;
    }
    function stop() {
      active = false; waiting = []; passenger = null; score = 0; delivered = 0; previousPosition = null;
    }
    function pause(position) { previousPosition = validPosition(position) ? copyPosition(position) : null; }
    function losePassenger(position, reason = 'destroyed') {
      if (!active || !passenger) return null;
      const trip = passenger, penalty = trip.fare * 2, before = score;
      // Clear the passenger before any later reset/frame can charge this trip again.
      passenger = null; score = Math.max(0, score - penalty);
      pause(position); refill(validPosition(position) ? position : trip.pickup);
      return { type: 'passenger-lost', trip, penalty, deducted: before - score, reason };
    }
    function reset(position) {
      if (!active || !validPosition(position)) return null;
      const event = losePassenger(position, 'reset');
      waiting = []; previousPosition = copyPosition(position); refill(position);
      return event;
    }
    function advance(position, grounded = validPosition(position) && Math.abs(position.y) <= GROUND_TOLERANCE) {
      if (!active || !validPosition(position)) return null;
      // A landing frame must never sweep through a stop from an airborne point.
      if (!grounded) { previousPosition = null; return null; }
      const from = previousPosition || position;
      previousPosition = copyPosition(position);
      if (passenger) {
        if (!withinArrival(from, position, passenger.destination)) return null;
        const trip = passenger; passenger = null; score += trip.fare; delivered += 1;
        refill(position);
        return { type: 'delivered', trip };
      }
      const index = waiting.findIndex(trip => withinArrival(from, position, trip.pickup, PICKUP_RADIUS));
      if (index === -1) return null;
      passenger = waiting.splice(index, 1)[0];
      return { type: 'picked-up', trip: passenger };
    }
    const snapshot = () => ({ active, waiting: [...waiting], passenger, score, delivered });
    return { start, stop, reset, pause, advance, losePassenger, snapshot };
  }
  return Object.freeze({ WAITING_COUNT, ARRIVAL_RADIUS, PICKUP_RADIUS, MARKER_RADIUS, STOP_CLEARANCE, GROUND_TOLERANCE,
    MIN_ROUTE_METERS, MAX_ROUTE_METERS, MIN_DIRECT_METERS, PICKUP_SPACING_METERS,
    isStopClear, buildRoadGraph, shortestRoute, fareForDistance, destinationBearing, withinArrival, createSession });
})();

// Scene adapter: no DOM entry, modal, HUD, or scene object exists before the secret key.
(() => {
  'use strict';
  let session = null, markerGroup = null, hud = null, scoreLabel = null, instrumentHost = null;
  let beamGeometry = null, coreGeometry = null, ringGeometry = null;
  let whiteMaterial = null, greenMaterial = null, whiteCoreMaterial = null, greenCoreMaterial = null;
  let pickupMarkers = [], destinationMarker = null, lastEvent = null;
  let navigation = null, navigationArrow = null, navigationDistance = null, navigationRotation = null;
  const isZh = () => currentLang === 'zh';
  const position = () => ({ x: state.x, y: state.y, z: state.z });
  const snapshot = () => session?.snapshot() || { active: false, waiting: [], passenger: null, score: 0, delivered: 0 };
  function blockedByUi() {
    return ['modal-map-select', 'modal-help', 'modal-destroyed'].some(id => {
      const element = document.getElementById(id);
      return element && !element.classList.contains('hidden');
    }) || window.RoadsterRanked?.isDialogOpen() || window.RoadsterMusic?.isSettingsOpen();
  }
  function textEntry(event) {
    return event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
  }
  function makeMarker(material, coreMaterial) {
    const marker = new THREE.Group();
    const beam = new THREE.Mesh(beamGeometry, material);
    beam.position.y = 550;
    const ring = new THREE.Mesh(ringGeometry, material);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.18;
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.y = 550;
    marker.add(beam, ring, core); marker.visible = false; markerGroup.add(marker);
    return marker;
  }
  function createScene() {
    markerGroup = new THREE.Group();
    cityEnvGroup.add(markerGroup);
    beamGeometry = new THREE.CylinderGeometry(CityTaxiModel.MARKER_RADIUS, CityTaxiModel.MARKER_RADIUS, 1100, 24, 1, true);
    coreGeometry = new THREE.CylinderGeometry(0.75, 0.75, 1100, 12, 1, true);
    ringGeometry = new THREE.RingGeometry(1.65, CityTaxiModel.MARKER_RADIUS, 32);
    // A readable narrow core plus a soft shell survives long viewing distances.
    // DoubleSide also keeps a beam visible when the camera is inside its radius.
    const material = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity,
      side: THREE.DoubleSide, depthWrite: false, depthTest: true, fog: false, toneMapped: false });
    whiteMaterial = material(0xffffff, 0.34); greenMaterial = material(0x22ff77, 0.34);
    whiteCoreMaterial = material(0xffffff, 0.82); greenCoreMaterial = material(0x22ff77, 0.82);
    pickupMarkers = Array.from({ length: CityTaxiModel.WAITING_COUNT }, () => makeMarker(whiteMaterial, whiteCoreMaterial));
    destinationMarker = makeMarker(greenMaterial, greenCoreMaterial);
    hud = document.createElement('section');
    hud.id = 'city-taxi-hud';
    hud.className = 'city-taxi-hud';
    scoreLabel = document.createElement('strong');
    hud.appendChild(scoreLabel);
    // Footer flow reserves real space for the mobile controls and side-panel bounds.
    const footer = document.getElementById('hud-footer');
    if (footer) {
      // Keep the score outside the scroll area on short landscapes.
      // Move the existing controls, retaining their DOM nodes and input listeners.
      instrumentHost = document.createElement('div');
      instrumentHost.className = 'taxi-footer-instruments';
      for (const child of [...footer.children]) instrumentHost.appendChild(child);
      footer.appendChild(instrumentHost); footer.classList.add('taxi-active');
    }
    (footer || document.body).appendChild(hud);
    navigation = document.createElement('section');
    navigation.id = 'city-taxi-navigation'; navigation.className = 'city-taxi-navigation'; navigation.hidden = true;
    navigation.setAttribute('role', 'img');
    navigationArrow = document.createElement('span'); navigationArrow.className = 'city-taxi-navigation-arrow';
    navigationArrow.setAttribute('aria-hidden', 'true');
    navigationDistance = document.createElement('span'); navigationDistance.className = 'city-taxi-navigation-distance';
    navigationDistance.setAttribute('aria-hidden', 'true');
    navigation.appendChild(navigationArrow); navigation.appendChild(navigationDistance);
    // The corner indicator stays independent of the header's wrapping rows.
    // CSS reserves its lane inside the header for every HUD and camera mode.
    const top = document.getElementById('hud-top-container'), main = document.getElementById('hud-main');
    if (top && main) top.insertBefore(navigation, main);
    else document.body.appendChild(navigation);
  }
  function renderNavigation() {
    if (!navigation) return;
    const data = snapshot();
    const bearing = data.active && data.passenger && currentMap === 'city' && !state.isDestroyed
      ? CityTaxiModel.destinationBearing(position(), state.yaw, data.passenger.destination) : null;
    const top = document.getElementById('hud-top-container');
    navigation.hidden = !bearing;
    if (!bearing) {
      navigationRotation = null;
      navigationArrow.style.transform = '';
      navigationDistance.textContent = '';
      top?.classList.remove('taxi-navigation-active');
      return;
    }
    top?.classList.add('taxi-navigation-active');
    // Unwrap the shortest signed change, so crossing north/180 never spins a turn.
    navigationRotation = navigationRotation === null ? bearing.radians
      : navigationRotation + Math.atan2(Math.sin(bearing.radians - navigationRotation), Math.cos(bearing.radians - navigationRotation));
    navigationArrow.style.transform = `rotate(${navigationRotation}rad)`;
    navigationDistance.textContent = `${Math.round(bearing.meters)}m`;
    navigation.setAttribute('aria-label', isZh()
      ? `绿色目的地方向，距离 ${Math.round(bearing.meters)} 米；箭头上方为车头前方`
      : `Green destination direction, ${Math.round(bearing.meters)} meters; up is ahead of the car`);
  }
  function syncMarkers() {
    if (!markerGroup) return;
    const data = snapshot();
    pickupMarkers.forEach((marker, index) => {
      const trip = data.waiting[index];
      marker.visible = data.active && !data.passenger && Boolean(trip);
      if (trip) marker.position.set(trip.pickup.x, 0, trip.pickup.z);
    });
    destinationMarker.visible = data.active && Boolean(data.passenger);
    if (data.passenger) destinationMarker.position.set(data.passenger.destination.x, 0, data.passenger.destination.z);
  }
  function render() {
    if (!hud) return;
    renderNavigation();
    const data = snapshot();
    scoreLabel.textContent = data.score.toLocaleString();
    hud.setAttribute('aria-label', isZh() ? `接客积分 ${scoreLabel.textContent}` : `Passenger score ${scoreLabel.textContent}`);
  }
  function drawCockpit(ctx) {
    const data = snapshot();
    if (!data.active) return;
    ctx.save();
    // Reserved bottom strip of the compact pod, clear of speed and the air bar.
    ctx.fillStyle = '#061810'; ctx.fillRect(16, 160, 480, 38);
    ctx.textAlign = 'left'; ctx.fillStyle = '#86efac'; ctx.font = 'bold 18px sans-serif';
    ctx.fillText(isZh() ? `接客积分 ${data.score} · 已送达 ${data.delivered} 位`
      : `${data.score} PTS · ${data.delivered} DELIVERED`, 22, 176, 468);
    const remaining = data.passenger ? Math.round(Math.hypot(state.x - data.passenger.destination.x, state.z - data.passenger.destination.z)) : null;
    const detail = data.passenger
      ? (isZh() ? `载客中 · 绿色目的地 ${remaining} 米 · 送达 +${data.passenger.fare}`
        : `ON BOARD · ${remaining}m · +${data.passenger.fare}`)
      : lastEvent?.type === 'passenger-lost'
        ? (isZh() ? `乘客遇难 · 双倍扣分 ${lastEvent.penalty} · 白柱等待 ${data.waiting.length} 位`
          : `PASSENGER LOST · -${lastEvent.penalty} · ${data.waiting.length} WAITING`)
        : (isZh() ? `空车 · ${data.waiting.length} 位乘客等待 · 前往白色光柱`
          : `EMPTY · ${data.waiting.length} WAITING`);
    ctx.fillStyle = '#dcfce7'; ctx.fillText(detail, 22, 194, 468);
    ctx.restore();
  }
  function start() {
    if (currentMap !== 'city' || snapshot().active || state.isDestroyed) return false;
    if (!session) session = CityTaxiModel.createSession(CityTaxiModel.buildRoadGraph(CITY_ROAD_COORDS, 11.5, cityBuildings, CITY_HALF_BOUND));
    window.RoadsterRanked?.abort('invalid');
    session.start(position()); lastEvent = null; createScene(); syncMarkers(); render();
    return true;
  }
  function stop() {
    session?.stop(); lastEvent = null;
    if (markerGroup) cityEnvGroup.remove(markerGroup);
    for (const resource of [beamGeometry, coreGeometry, ringGeometry, whiteMaterial, greenMaterial, whiteCoreMaterial, greenCoreMaterial]) resource?.dispose();
    hud?.remove();
    navigation?.remove();
    document.getElementById('hud-top-container')?.classList.remove('taxi-navigation-active');
    navigation = null; navigationArrow = null; navigationDistance = null; navigationRotation = null;
    const footer = document.getElementById('hud-footer');
    if (instrumentHost && footer) {
      for (const child of [...instrumentHost.children]) footer.appendChild(child);
    }
    instrumentHost?.remove(); instrumentHost = null;
    footer?.classList.remove('taxi-active');
    markerGroup = null; hud = null; scoreLabel = null;
    beamGeometry = null; coreGeometry = null; ringGeometry = null;
    whiteMaterial = null; greenMaterial = null; whiteCoreMaterial = null; greenCoreMaterial = null;
    pickupMarkers = []; destinationMarker = null;
  }
  function onReset() {
    if (!snapshot().active) return;
    if (currentMap !== 'city') { stop(); return; }
    const event = session.reset(position());
    if (event) lastEvent = event;
    syncMarkers(); render();
  }
  function onDestroyed() {
    if (!snapshot().active) return;
    const event = session.losePassenger(position(), 'destroyed');
    if (event) { lastEvent = event; syncMarkers(); render(); }
    session.pause(position());
  }
  function handleKeydown(event) {
    const equals = (event.code === 'Equal' || event.code === 'NumpadEqual' || event.key === '=') &&
      !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing;
    if (!equals) return false;
    if (textEntry(event)) return true;
    event.preventDefault();
    if (event.repeat || currentMap !== 'city' || document.hidden || state.isDestroyed || blockedByUi() || snapshot().active) return true;
    clearAllInputKeys();
    const approved = window.confirm(isZh()
      ? `开启城市接客游戏？\n\n白色光柱是等待中的乘客，地面靠近 ${CityTaxiModel.PICKUP_RADIUS} 米自动接上；上车后只显示该乘客的绿色目的地，送达可获 1000–3000 接客积分。每段行程至少 900 米，一次接送一位。\n\n载客时撞毁或重置将失去乘客，并扣除该趟奖励的双倍积分，最低为 0。接客积分独立计算，不计入排行榜。`
      : `Start the city passenger game?\n\nWhite columns mark waiting passengers. Get within ${CityTaxiModel.PICKUP_RADIUS}m on the ground to pick one up. Only that passenger’s green destination is then visible. Deliver them for 1,000–3,000 passenger points. Routes are at least 900m, one passenger at a time.\n\nDestroying or resetting the occupied car loses the passenger and deducts twice that fare, with a minimum score of zero. Passenger points are separate from the leaderboard.`);
    // A native confirmation may be open for minutes. Never replay held controls or elapsed time.
    clearAllInputKeys(); lastTime = performance.now();
    if (approved && currentMap === 'city' && !state.isDestroyed && !blockedByUi()) start();
    return true;
  }
  function tick() {
    if (!snapshot().active) return;
    if (currentMap !== 'city') { stop(); return; }
    if (state.isDestroyed) { onDestroyed(); return; }
    if (document.hidden || blockedByUi()) { session.pause(position()); renderNavigation(); return; }
    const event = session.advance(position(), !state.wasAirborne && Math.abs(state.y) <= CityTaxiModel.GROUND_TOLERANCE);
    renderNavigation();
    if (!event) return;
    lastEvent = event;
    syncMarkers(); render();
    sound.beep(event.type === 'delivered' ? 960 : 720, 0.12);
  }
  window.RoadsterTaxi = Object.freeze({ handleKeydown, tick, stop, onReset, onDestroyed, render, drawCockpit, snapshot });
})();
