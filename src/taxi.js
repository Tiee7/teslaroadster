// Hidden city passenger sandbox. Its session and score never enter ranked scoring.
// The model is renderer-independent so route, proximity, and lifecycle rules are testable.
const CityTaxiModel = (() => {
  'use strict';
  const WAITING_COUNT = 5;
  const ARRIVAL_RADIUS = 2;
  const MIN_ROUTE_METERS = 900;
  const MAX_ROUTE_METERS = 3600;
  // A straight-line lower bound prevents even corner-cutting on wide roads from producing a short fare.
  const MIN_DIRECT_METERS = 900;
  const PICKUP_SPACING_METERS = 600;

  function buildRoadGraph(roadCoords, laneOffset = 11.5) {
    const coords = [...roadCoords].sort((a, b) => a - b);
    if (coords.length < 4 || new Set(coords).size !== coords.length || !coords.every(Number.isFinite)) throw new Error('Invalid city road grid');
    const nodes = coords.flatMap((x, col) => coords.map((z, row) => Object.freeze({
      id: col * coords.length + row, x: x + laneOffset, y: 0, z: z + laneOffset, col, row,
    })));
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
  // Swept 3D proximity catches a fast car between frames but rejects flying above a stop.
  function withinArrival(from, to, stop) {
    if (!validPosition(from) || !validPosition(to)) return false;
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const lengthSquared = dx * dx + dy * dy + dz * dz;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
      ((stop.x - from.x) * dx + (stop.y - from.y) * dy + (stop.z - from.z) * dz) / lengthSquared));
    return Math.hypot(from.x + dx * t - stop.x, from.y + dy * t - stop.y, from.z + dz * t - stop.z) <= ARRIVAL_RADIUS;
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
    function reset(position) {
      if (!active || !validPosition(position)) return;
      // Repairs never teleport a passenger to a paid destination; earned fares remain local.
      waiting = []; passenger = null; previousPosition = copyPosition(position); refill(position);
    }
    function pause(position) { previousPosition = validPosition(position) ? copyPosition(position) : null; }
    function advance(position) {
      if (!active || !validPosition(position)) return null;
      const from = previousPosition || position;
      previousPosition = copyPosition(position);
      if (passenger) {
        if (!withinArrival(from, position, passenger.destination)) return null;
        const trip = passenger; passenger = null; score += trip.fare; delivered += 1;
        refill(position);
        return { type: 'delivered', trip };
      }
      const index = waiting.findIndex(trip => withinArrival(from, position, trip.pickup));
      if (index === -1) return null;
      passenger = waiting.splice(index, 1)[0];
      return { type: 'picked-up', trip: passenger };
    }
    const snapshot = () => ({ active, waiting: [...waiting], passenger, score, delivered });
    return { start, stop, reset, pause, advance, snapshot };
  }
  return Object.freeze({ WAITING_COUNT, ARRIVAL_RADIUS, MIN_ROUTE_METERS, MAX_ROUTE_METERS,
    MIN_DIRECT_METERS, PICKUP_SPACING_METERS, buildRoadGraph, shortestRoute, fareForDistance, withinArrival, createSession });
})();

// Scene adapter: no DOM entry, modal, HUD, or scene object exists before the secret key.
(() => {
  'use strict';
  let session = null, markerGroup = null, hud = null, scoreLabel = null, statusLabel = null;
  let beamGeometry = null, ringGeometry = null, whiteMaterial = null, greenMaterial = null;
  let pickupMarkers = [], destinationMarker = null, lastAward = null;
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
  function makeMarker(material) {
    const marker = new THREE.Group();
    const beam = new THREE.Mesh(beamGeometry, material);
    beam.position.y = 550;
    const ring = new THREE.Mesh(ringGeometry, material);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.18;
    marker.add(beam, ring); marker.visible = false; markerGroup.add(marker);
    return marker;
  }
  function createScene() {
    markerGroup = new THREE.Group();
    cityEnvGroup.add(markerGroup);
    beamGeometry = new THREE.CylinderGeometry(2, 2, 1100, 24, 1, true);
    ringGeometry = new THREE.RingGeometry(1.65, 2, 32);
    whiteMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false, fog: false });
    greenMaterial = new THREE.MeshBasicMaterial({ color: 0x22ff77, transparent: true, opacity: 0.2, depthWrite: false, fog: false });
    pickupMarkers = Array.from({ length: CityTaxiModel.WAITING_COUNT }, () => makeMarker(whiteMaterial));
    destinationMarker = makeMarker(greenMaterial);
    hud = document.createElement('section');
    hud.id = 'city-taxi-hud';
    hud.className = 'city-taxi-hud';
    hud.setAttribute('aria-label', isZh() ? '接客游戏' : 'City passenger game');
    scoreLabel = document.createElement('strong');
    statusLabel = document.createElement('span');
    hud.appendChild(scoreLabel); hud.appendChild(statusLabel); document.body.appendChild(hud);
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
    const data = snapshot();
    scoreLabel.textContent = isZh()
      ? `接客积分 ${data.score.toLocaleString()} · 已送达 ${data.delivered} 位`
      : `Passenger score ${data.score.toLocaleString()} · ${data.delivered} delivered`;
    hud.setAttribute('aria-label', isZh() ? '接客游戏' : 'City passenger game');
    if (data.passenger) {
      statusLabel.textContent = isZh()
        ? `前往绿色光柱 · 路程 ${data.passenger.routeMeters} 米 · 送达 +${data.passenger.fare}`
        : `Green column · ${data.passenger.routeMeters}m route · Fare +${data.passenger.fare}`;
    } else {
      const award = lastAward ? (isZh() ? `送达 +${lastAward} · ` : `Delivered +${lastAward} · `) : '';
      statusLabel.textContent = award + (isZh() ? `白色光柱 · ${data.waiting.length} 位乘客等待接送` : `White columns · ${data.waiting.length} passengers waiting`);
    }
  }
  function start() {
    if (currentMap !== 'city' || snapshot().active || state.isDestroyed) return false;
    if (!session) session = CityTaxiModel.createSession(CityTaxiModel.buildRoadGraph(CITY_ROAD_COORDS));
    window.RoadsterRanked?.abort('invalid');
    session.start(position()); lastAward = null; createScene(); syncMarkers(); render();
    return true;
  }
  function stop() {
    session?.stop(); lastAward = null;
    if (markerGroup) cityEnvGroup.remove(markerGroup);
    for (const resource of [beamGeometry, ringGeometry, whiteMaterial, greenMaterial]) resource?.dispose();
    hud?.remove();
    markerGroup = null; hud = null; scoreLabel = null; statusLabel = null;
    beamGeometry = null; ringGeometry = null; whiteMaterial = null; greenMaterial = null;
    pickupMarkers = []; destinationMarker = null;
  }
  function onReset() {
    if (!snapshot().active) return;
    if (currentMap !== 'city') { stop(); return; }
    session.reset(position()); lastAward = null; syncMarkers(); render();
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
      ? '开启城市接客游戏？\n\n白色光柱是等待中的乘客，靠近 2 米自动接上；送到绿色光柱可获 1000–3000 接客积分。每段行程至少 900 米，一次接送一位。\n\n接客积分独立计算，不计入排行榜。'
      : 'Start the city passenger game?\n\nWhite columns mark waiting passengers. Get within 2m to pick one up, then reach the green column for 1,000–3,000 passenger points. Routes are at least 900m, one passenger at a time.\n\nPassenger points are separate from the leaderboard.');
    // A native confirmation may be open for minutes. Never replay held controls or elapsed time.
    clearAllInputKeys(); lastTime = performance.now();
    if (approved && currentMap === 'city' && !state.isDestroyed && !blockedByUi()) start();
    return true;
  }
  function tick() {
    if (!snapshot().active) return;
    if (currentMap !== 'city') { stop(); return; }
    if (state.isDestroyed || document.hidden || blockedByUi()) { session.pause(position()); return; }
    const event = session.advance(position());
    if (!event) return;
    lastAward = event.type === 'delivered' ? event.trip.fare : null;
    syncMarkers(); render();
    sound.beep(event.type === 'delivered' ? 960 : 720, 0.12);
  }
  window.RoadsterTaxi = Object.freeze({ handleKeydown, tick, stop, onReset, render, snapshot });
})();
