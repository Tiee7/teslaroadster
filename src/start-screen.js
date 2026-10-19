// Compact launch configuration. Uses the game's real geometry and shared paint
// material, with an independent, render-on-change studio preview (no extra loop).
(() => {
  const $ = id => document.getElementById(id);
  const menu = $('modal-map-select');
  const vehicleButton = $('btn-start-paint');
  const picker = $('paint-picker');
  const physicsSelect = $('start-physics');
  const trafficSelect = $('start-traffic');
  const modelSelect = $('start-model');
  const cockpitSelect = $('start-cockpit');
  // The vehicle module owns persistence and the live meshes. These local defaults
  // also keep the optional entry UI usable in stripped-down/offline previews.
  let selectedModel = 'reference';
  let selectedCockpit = 'reference';
  const historyKey = 'roadsterFinishPicker';
  const historyToken = `finish-${Date.now()}`;
  let ownsHistory = false;
  let pendingBack = false;
  let deferredOpen = null;
  let returnFocus = vehicleButton;
  let preview = null;
  let previewFailed = false;
  const copy = {
    en: { badge: 'SPACEX COLD-GAS PACKAGE', title: 'Your Roadster', sub: 'Choose your setup and drive.', car: 'YOUR ROADSTER', change: 'Change finish ↗', choose: 'Choose your finish', collection: '12 EXTERIOR FINISHES', done: 'Done', note: 'Select a finish to preview it on your Roadster. Your choice is saved in this browser.', vehicle: 'Vehicle configuration', model: 'Vehicle model', cockpit: 'Cockpit', models: ['Roadster 2 · Reference', 'Classic Roadster'], cockpits: ['Reference cockpit', 'Classic cockpit'], worlds: 'World', highway: 'Elevated Highway', city: 'Cyber City', highwaySpec: '6 lanes · traffic', citySpec: 'Roam · rooftop refills', weather: 'Weather & time', driving: 'Driving mode', modes: ['Realistic', 'Plaid', 'Fantasy'], traffic: 'Traffic', densities: ['Normal · 20', 'Heavy · 36', 'Insane · 52'], launch: 'Launch simulation', audio: 'Audio settings', language: 'Switch to Chinese', unavailable: '3D preview unavailable' },
    zh: { badge: 'SPACEX 冷气推进版', title: '我的 Roadster', sub: '选好车辆、地图和天气，开始驾驶。', car: '我的 ROADSTER', change: '更换涂装 ↗', choose: '选择车漆涂装', collection: '12 款专属涂装', done: '完成', note: '点选涂装即可预览效果，此浏览器会记住你的选择。', vehicle: '车辆配置', model: '车身车型', cockpit: '驾驶舱', models: ['Roadster 2 · 参考款', '经典 Roadster'], cockpits: ['参考驾驶舱', '经典驾驶舱'], worlds: '驾驶地图', highway: '高架高速', city: '赛博都市', highwaySpec: '6 车道 · 车流', citySpec: '开放都市 · 补气', weather: '天气与时间', driving: '驾驶模式', modes: ['常规物理', '狂暴 Plaid', '幻想极速'], traffic: '车流密度', densities: ['普通 · 20 辆', '密集 · 36 辆', '疯狂 · 52 辆'], launch: '进入游戏', audio: '声音设置', language: 'Switch to English', unavailable: '3D 预览暂不可用' }
  };
  const menuVisible = () => !menu.classList.contains('hidden');
  const validChoice = value => value === 'reference' || value === 'classic';
  function vehicleChoices() {
    const model = window.RoadsterVehicle?.getModel?.();
    const cockpit = window.RoadsterVehicle?.getCockpit?.();
    return {
      model: validChoice(model) ? model : selectedModel,
      cockpit: validChoice(cockpit) ? cockpit : selectedCockpit
    };
  }
  function showPreviewUnavailable() {
    const message = copy[currentLang].unavailable;
    $('start-car-preview').textContent = message;
    $('paint-picker-preview').textContent = message;
  }
  function renderPreview() {
    if (previewFailed) { showPreviewUnavailable(); return; }
    if (!menuVisible() && !picker.open) return;
    const host = picker.open ? $('paint-picker-preview') : $('start-car-preview');
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    try {
      if (!preview) {
        const scene = new THREE.Scene();
        scene.environment = studioEnvMap;
        const camera = new THREE.OrthographicCamera(-4, 4, 2, -2, .1, 50);
        camera.position.set(6, 2.7, -8);
        camera.lookAt(0, .65, 0);
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0x000000, 0);
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.domElement.setAttribute('aria-hidden', 'true');
        preview = { renderer, scene, camera, model: null, source: null, modelKey: null };
      }
      const source = window.RoadsterVehicle?.getPreviewModel?.() || carMeshGroup;
      const choices = vehicleChoices();
      const modelKey = `${choices.model}:${choices.cockpit}`;
      if (preview.source !== source || preview.modelKey !== modelKey) {
        const model = source.clone(true);
        model.position.set(0, 0, 0);
        model.rotation.set(0, 0, 0);
        model.scale.set(1, 1, 1);
        model.visible = true;
        // Clones share gameplay geometry and materials. Detach only: disposing
        // either would corrupt the live car, NPCs, and the other studio view.
        if (preview.model) preview.scene.remove(preview.model);
        preview.scene.add(model);
        preview.model = model;
        preview.source = source;
        preview.modelKey = modelKey;
      }
      if (!preview.lit) {
        preview.scene.add(new THREE.AmbientLight(0xe2edff, 1.8));
        const key = new THREE.DirectionalLight(0xffffff, 2.4);
        key.position.set(5, 8, -4);
        preview.scene.add(key);
        const rim = new THREE.DirectionalLight(0x80dfff, 1.2);
        rim.position.set(-5, 3, 4);
        preview.scene.add(rim);
        preview.lit = true;
      }
      if (preview.renderer.domElement.parentNode !== host) host.appendChild(preview.renderer.domElement);
      const aspect = width / height;
      const halfHeight = Math.max(1.15, 3.1 / aspect);
      preview.camera.left = -halfHeight * aspect;
      preview.camera.right = halfHeight * aspect;
      preview.camera.top = halfHeight;
      preview.camera.bottom = -halfHeight;
      preview.camera.updateProjectionMatrix();
      preview.renderer.setSize(width, height, false);
      preview.renderer.render(preview.scene, preview.camera);
    } catch (_) {
      preview?.renderer.dispose();
      preview = null;
      previewFailed = true;
      showPreviewUnavailable();
      // A failed optional preview must not block configuration or the game.
    }
  }
  function render() {
    const t = copy[currentLang];
    const text = { 'map-modal-badge': t.badge, 'map-modal-title': t.title, 'map-modal-sub': t.sub, 'ui-modal-paint-step': t.car, 'start-paint-action': t.change, 'ui-modal-paint-title': t.choose, 'paint-picker-eyebrow': t.collection, 'paint-picker-close': t.done, 'paint-picker-note': t.note, 'ui-modal-map-title': t.worlds, 'card-hwy-title': t.highway, 'card-city-title': t.city, 'card-hwy-spec': t.highwaySpec, 'card-city-spec': t.citySpec, 'ui-modal-weather-title': t.weather, 'start-physics-label': t.driving, 'start-traffic-label': t.traffic, 'start-model-label': t.model, 'start-cockpit-label': t.cockpit, 'ui-btn-launch-map': t.launch };
    Object.entries(text).forEach(([id, value]) => { $(id).textContent = value; });
    $('btn-map-audio-settings').setAttribute('aria-label', t.audio);
    $('btn-map-modal-lang').setAttribute('aria-label', t.language);
    $('btn-map-modal-lang').setAttribute('title', t.language);
    physicsSelect.value = state.physicsMode === 'fantasy' ? 'fantasy' : state.insaneMode ? 'plaid' : 'realistic';
    trafficSelect.value = String(trafficLevelIndex);
    const choices = vehicleChoices();
    modelSelect.value = choices.model;
    cockpitSelect.value = choices.cockpit;
    $('start-vehicle-options').setAttribute('aria-label', t.vehicle);
    Array.from(modelSelect.options).forEach((option, idx) => { option.textContent = t.models[idx]; });
    Array.from(cockpitSelect.options).forEach((option, idx) => { option.textContent = t.cockpits[idx]; });
    $('summary-model-chip').textContent = t.models[choices.model === 'classic' ? 1 : 0];
    $('summary-cockpit-chip').textContent = t.cockpits[choices.cockpit === 'classic' ? 1 : 0];
    Array.from(physicsSelect.options).forEach((option, idx) => { option.textContent = t.modes[idx]; });
    Array.from(trafficSelect.options).forEach((option, idx) => { option.textContent = t.densities[idx]; });
    const paint = PAINT_PRESETS[paintIndex];
    $('modal-active-dot').style.backgroundColor = paint.hexCode;
    $('modal-active-paint-name').setAttribute('title', currentLang === 'zh' ? paint.nameZh : paint.nameEn);
    vehicleButton.setAttribute('aria-label', `${currentLang === 'zh' ? paint.nameZh : paint.nameEn}. ${t.change.replace(' ↗', '')}`);
    renderPreview();
  }
  function openPaint(event, fromHistory = false) {
    if (picker.open) return;
    // Back is asynchronous in browsers. Queue an immediate reopen until the
    // previous picker entry is actually gone, rather than stacking stale entries.
    if (pendingBack) { deferredOpen = event?.currentTarget || vehicleButton; return; }
    clearAllInputKeys();
    returnFocus = event?.currentTarget || (menuVisible() ? vehicleButton : $('btn-paint'));
    renderModalPaintGrid();
    picker.showModal();
    vehicleButton.setAttribute('aria-expanded', 'true');
    if (!fromHistory) {
      try {
        // A same-URL entry lets the phone/browser Back button dismiss the picker.
        history.pushState({ ...history.state, [historyKey]: historyToken }, '');
        ownsHistory = true;
      } catch (_) { ownsHistory = false; }
    } else ownsHistory = true;
    renderPreview();
    $('modal-paint-grid').children[paintIndex]?.focus();
  }
  function closePaint() { if (picker.open) picker.close(); }
  picker.addEventListener('close', () => {
    vehicleButton.setAttribute('aria-expanded', 'false');
    if (ownsHistory && history.state?.[historyKey] === historyToken) {
      ownsHistory = false;
      pendingBack = true;
      try { history.back(); } catch (_) { pendingBack = false; }
    }
    renderPreview();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  });
  $('paint-picker-close').addEventListener('click', closePaint);
  picker.addEventListener('click', event => {
    if (event.target !== picker) return;
    const rect = picker.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closePaint();
  });
  window.addEventListener('popstate', event => {
    pendingBack = false;
    if (event.state?.[historyKey] === historyToken && menuVisible()) openPaint(null, true);
    else if (picker.open) { ownsHistory = false; picker.close(); }
    if (deferredOpen && menuVisible()) {
      const button = deferredOpen;
      deferredOpen = null;
      openPaint({ currentTarget: button });
    }
  });
  vehicleButton.addEventListener('click', openPaint);
  modelSelect.addEventListener('change', () => {
    if (!validChoice(modelSelect.value)) { render(); return; }
    selectedModel = modelSelect.value;
    window.RoadsterVehicle?.setModel?.(selectedModel);
    render();
  });
  cockpitSelect.addEventListener('change', () => {
    if (!validChoice(cockpitSelect.value)) { render(); return; }
    selectedCockpit = cockpitSelect.value;
    window.RoadsterVehicle?.setCockpit?.(selectedCockpit);
    render();
  });
  window.addEventListener('roadster-vehicle-change', render);
  physicsSelect.addEventListener('change', () => {
    const selected = physicsSelect.value;
    if (selected === 'plaid') {
      if (state.physicsMode !== 'realistic' || !state.insaneMode) togglePlaidMode();
    } else {
      if (state.insaneMode) togglePlaidMode();
      if (state.physicsMode !== selected) togglePhysicsMode();
    }
    render();
  });
  trafficSelect.addEventListener('change', () => {
    const next = Number(trafficSelect.value);
    if (!Number.isInteger(next) || next < 0 || next > 2 || next === trafficLevelIndex) return;
    window.RoadsterRanked?.abort('traffic');
    trafficLevelIndex = next;
    populateTraffic([20, 36, 52][next]);
    applyTranslations();
    sound.beep(580, .08);
  });
  menu.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || picker.open || window.RoadsterMusic?.isSettingsOpen()) return;
    const controls = Array.from(menu.querySelectorAll('button, select')).filter(element => !element.disabled && element.getClientRects().length);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === menu)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  window.addEventListener('resize', renderPreview);
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(renderPreview);
    observer.observe($('start-car-preview'));
    observer.observe($('paint-picker-preview'));
  }
  window.RoadsterStart = {
    render, isPaintOpen: () => picker.open,
    onOpen() { render(); vehicleButton.focus({ preventScroll: true }); },
    onLaunch() { closePaint(); $('btn-map-select').focus({ preventScroll: true }); }
  };
  // Store stable preset IDs, so reordering the finish collection cannot change it.
  let saved;
  try { saved = localStorage.getItem('roadster-paint-finish'); } catch (_) {}
  const savedIndex = PAINT_PRESETS.findIndex(preset => preset.id === saved);
  selectPaintFinish(savedIndex >= 0 ? savedIndex : paintIndex, false);
  render();
  vehicleButton.focus({ preventScroll: true });
})();
