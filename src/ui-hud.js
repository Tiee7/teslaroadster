
// Size only from the header/footer, never from transient center notifications.
function updateHudBounds() {
  const container = document.getElementById('hud-top-container');
  const header = document.getElementById('hud-header');
  const footer = document.getElementById('hud-footer');
  if (!container || !header || !footer) return;
  container.style.setProperty('--hud-header-height', `${header.getBoundingClientRect().height}px`);
  container.style.setProperty('--hud-footer-height', `${footer.getBoundingClientRect().height}px`);
}
if (typeof ResizeObserver !== 'undefined') {
  const hudBoundsObserver = new ResizeObserver(updateHudBounds);
  ['hud-header', 'hud-footer'].forEach((id) => {
    const element = document.getElementById(id);
    if (element) hudBoundsObserver.observe(element);
  });
}
window.addEventListener('resize', updateHudBounds);
updateHudBounds();

function syncHudPerspective() {
  document.body.classList.toggle('cockpit-view', cameraModeIndex === 3);
  updateHudBounds();
}

const HUD_MODES = ['full', 'medium', 'minimal'];
const HUD_STORAGE_KEY = 'roadster-hud-mode';
function toggleMobileHudPanel(panel) {
  if (typeof window === 'undefined' || !window.matchMedia?.('(pointer: coarse)').matches) return false;
  const next = document.body.dataset.mobileHudPanel === panel ? 'none' : panel;
  document.body.dataset.mobileHudPanel = next;
  for (const [name,id] of [['guide','btn-collapse-guide'],['telemetry','btn-collapse-telemetry']]) {
    const button = document.getElementById(id);
    button?.setAttribute('aria-expanded',String(next === name));
    if (button) button.textContent = next === name ? '−' : '+';
  }
  updateHudBounds();
  return true;
}
function normalizeHudMode(value) {
  if (HUD_MODES.includes(value)) return value;
  // Accept the former boolean shape without treating an unknown value as minimal.
  return value === true || value === 'true' ? 'minimal' : 'full';
}

function applyHudMode() {
  const mode = normalizeHudMode(state.hudMode ?? state.hudMinimal);
  state.hudMode = mode;
  state.hudMinimal = mode === 'minimal';
  const compact = mode !== 'full';
  document.body.dataset.hudMode = mode;
  document.getElementById('hud-brand-badge')?.classList.toggle('hidden', compact);
  document.getElementById('hud-action-bar')?.classList.toggle('ml-auto', compact);
  const extraButtons = [
    'btn-map-select', 'btn-physics-mode', 'btn-plaid-mode', 'btn-unit-toggle',
    'btn-paint', 'btn-weather', 'btn-traffic', 'btn-camera-zoom',
    'btn-sound', 'btn-help'
  ];
  extraButtons.forEach(id => document.getElementById(id)?.classList.toggle('hidden', compact));
  // HUD reduction removes information, never the available driving controls.
  ['btn-camera','btn-reset'].forEach(id => document.getElementById(id)?.classList.toggle('hidden',false));
  document.body.dataset.mobileHudPanel = 'none';
  if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) {
    for (const id of ['btn-collapse-guide','btn-collapse-telemetry']) {
      const button=document.getElementById(id);button?.setAttribute?.('aria-expanded','false');if(button)button.textContent='+';
    }
  }
  ['hud-left', 'hud-right'].forEach(id => document.getElementById(id)?.classList.toggle('hidden', mode === 'minimal'));
  const footer = document.getElementById('hud-footer');
  footer?.classList.remove('hidden');
  footer?.classList.toggle('hud-compact-view', compact);
  footer?.classList.toggle('hud-minimal-view', mode === 'minimal');
  updateHudBounds();
}

function restoreHudMode() {
  let mode = state.hudMode ?? state.hudMinimal;
  try { mode = localStorage.getItem(HUD_STORAGE_KEY) ?? mode; } catch (_) {}
  state.hudMode = normalizeHudMode(mode);
  applyHudMode();
}

function toggleHudMode() {
  const current = normalizeHudMode(state.hudMode ?? state.hudMinimal);
  state.hudMode = HUD_MODES[(HUD_MODES.indexOf(current) + 1) % HUD_MODES.length];
  applyHudMode();
  try { localStorage.setItem(HUD_STORAGE_KEY, state.hudMode); } catch (_) {}
  applyTranslations();
  sound.beep({ full: 720, medium: 630, minimal: 540 }[state.hudMode], 0.08);
}

// =========================================================================
// 8. INPUT HANDLERS, MAP SELECTION & UI TRANSLATIONS
// =========================================================================
const keys = {};
const infiniteJetShortcutDown = new Set();
const keyBadgeMap = {
  KeyW: 'key-w',
  Semicolon: 'key-semi',
  KeyI: 'key-up',
  KeyA: 'key-a',
  KeyJ: 'key-left',
  KeyS: 'key-s',
  KeyK: 'key-down',
  KeyD: 'key-d',
  KeyL: 'key-right',
  KeyH: 'key-h',
  KeyB: 'key-b',
  KeyY: 'key-y',
  KeyU: 'key-u',
  KeyN: 'key-n',
  KeyO: 'key-o',
  Space: 'key-space',
  ShiftLeft: 'key-shift',
  ShiftRight: 'key-shift',
  ArrowLeft: 'key-left',
  ArrowRight: 'key-right',
  ArrowUp: 'key-up',
  ArrowDown: 'key-down',
  KeyQ: 'key-q',
  KeyE: 'key-e',
  KeyC: 'key-c',
  KeyT: 'key-t'
};
const autopilotKeyBadges = new Set();
const autopilotControlBadges = ['key-w','key-semi','key-h','key-s','key-u','key-a','key-d',
  'key-space','key-shift','key-q','key-e','key-left','key-right','key-up','key-down','key-o'];
function refreshKeyBadge(badgeId) {
  const held = Object.keys(keyBadgeMap).some(code => keyBadgeMap[code] === badgeId && keys[code]);
  document.getElementById(badgeId)?.classList.toggle('active', held || autopilotKeyBadges.has(badgeId));
}
// Display only. Never write real keys, synthesize input, charge gas or take ownership.
function updateAutopilotKeyBadges(input = null, jumping = false) {
  autopilotKeyBadges.clear();
  const value = name => Number.isFinite(input?.[name]) ? input[name] : 0;
  for (const [name,badge] of [['throttle','key-w'],['boost','key-semi'],['brake','key-h'],
    ['reverse','key-s'],['handbrake','key-u'],['lift','key-space'],['descend','key-shift']]) {
    if (value(name) > 0) autopilotKeyBadges.add(badge);
  }
  for (const [name,negative,positive] of [['steer','key-a','key-d'],['strafe','key-q','key-e'],
    ['roll','key-right','key-left'],['pitch','key-down','key-up']]) {
    if (value(name) < 0) autopilotKeyBadges.add(negative);
    if (value(name) > 0) autopilotKeyBadges.add(positive);
  }
  if (jumping) autopilotKeyBadges.add('key-o');
  autopilotControlBadges.forEach(refreshKeyBadge);
}

function setKeyState(code, isDown) {
  if (isDown && globalThis.window?.RoadsterDemo?.isBusy() && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyH', 'KeyU', 'Space', 'Semicolon', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyE', 'KeyI', 'KeyK', 'KeyJ', 'KeyL', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyO', 'KeyN'].includes(code)) return;
  keys[code] = isDown;
  const badgeId = keyBadgeMap[code];
  if (badgeId) refreshKeyBadge(badgeId);
  if (isDown) sound.init();
}

function refillAirTank() {
  // Invalidate ranked eligibility before the sandbox tank changes. A pending
  // server issuance is also released by the ranked controller when it arrives.
  window.RoadsterRanked?.abort('refill', { silent: true });
  state.airRemaining = MAX_AIR_SECONDS;
  state.airUsedContinuous = 0;
  state.gasMassKg = 144;
  state.isAutoDescending8s = false;
  state.isFreefalling = false;
  if (state.bannerType === '8s' || state.bannerType === 'freefall') {
    state.bannerTimer = 0;
    renderBannerText();
  }
}

function toggleInfiniteJet() {
  if (!state.infiniteJet) refillAirTank();
  state.infiniteJet = !state.infiniteJet;
  window.RoadsterDemo?.onFuelModeChange?.();
  window.RoadsterRanked?.render();
}

window.addEventListener('keydown', (e) => {
  // Text entry and the leaderboard dialog must never steer the car or trigger shortcuts.
  if ((e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) || window.RoadsterRanked?.isDialogOpen() || window.RoadsterMusic?.isSettingsOpen() || window.RoadsterStart?.isPaintOpen()) return;
  if (window.RoadsterTaxi?.handleKeydown(e)) return;
  const mapModalEl = document.getElementById('modal-map-select');
  if (mapModalEl && !mapModalEl.classList.contains('hidden')) {
    // Native buttons/selects handle Enter and Space themselves. Menu keys must
    // never launch a map while activating a finish, world, or weather control.
    if (e.code === 'Enter' && !(e.target instanceof Element && e.target.closest('button, select, input, a'))) {
      e.preventDefault();
      launchSelectedMap();
    }
    return;
  }
  // Focused native activation is an interface action, not a driving hotkey.
  if (e.code === 'Space' && e.target === document.getElementById('btn-highway-demo')) return;
  if (globalThis.window?.RoadsterDemo?.isBusy() && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyH', 'KeyU', 'Space', 'Semicolon', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyE', 'KeyI', 'KeyK', 'KeyJ', 'KeyL', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyO', 'KeyN'].includes(e.code)) { if (!e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault(); return; }
  if (e.code === 'Digit0' || e.code === 'Numpad0') {
    const hasOverlay = ['modal-help', 'modal-destroyed'].some((id) => {
      const overlay = document.getElementById(id);
      return overlay && !overlay.classList.contains('hidden');
    });
    if (!e.repeat && !e.isComposing && !e.ctrlKey && !e.metaKey && !e.altKey && !document.hidden && !state.isDestroyed && !hasOverlay) {
      if (infiniteJetShortcutDown.size === 0) toggleInfiniteJet();
      infiniteJetShortcutDown.add(e.code);
    }
    return;
  }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyZ') {
    if (!e.repeat) toggleHudMode();
    return;
  }
  if (e.code === 'KeyF') {
    togglePhysicsMode();
    return;
  }
  if (e.code === 'KeyR') {
    resetCar();
    return;
  }
  if (e.code === 'KeyM') {
    openMapSelectModal();
    return;
  }
  if (e.code === 'KeyY') {
    togglePlaidMode();
    return;
  }
  if (e.code === 'KeyB') {
    setKeyState('KeyB', true);
    toggleSpeedUnit();
    return;
  }
  if (e.code === 'KeyO') {
    setKeyState('KeyO', true);
    if (!e.repeat) triggerJump6m();
    return;
  }
  if (e.code === 'KeyN') {
    setKeyState('KeyN', true);
    if (!e.repeat) toggleAltitudeHold();
    return;
  }
  if (e.code === 'KeyX') {
    toggleStabilizer();
    return;
  }
  if (e.code === 'KeyP' || e.code === 'Slash') {
    toggleHelpModal();
    return;
  }
  if (e.code === 'KeyV') {
    cameraModeIndex = (cameraModeIndex === 1) ? 0 : 1;
    applyTranslations();
    sound.beep(680, 0.08);
    return;
  }
  if (e.code === 'KeyC') {
    cameraModeIndex = (cameraModeIndex === 3) ? 0 : 3;
    applyTranslations();
    sound.beep(760, 0.08);
    return;
  }
  if (e.code === 'KeyT') {
    cycleWeatherMode();
    return;
  }
  if (e.code === 'BracketLeft' || e.code === 'Minus') {
    state.camZoom = THREE.MathUtils.clamp((state.camZoom || 0.75) + 0.1, 0.55, 1.35);
    updateZoomButtonLabel();
    sound.beep(520, 0.05);
    return;
  }
  if (e.code === 'BracketRight') {
    state.camZoom = THREE.MathUtils.clamp((state.camZoom || 0.75) - 0.1, 0.55, 1.35);
    updateZoomButtonLabel();
    sound.beep(640, 0.05);
    return;
  }
  setKeyState(e.code, true);
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Digit0' || e.code === 'Numpad0') { infiniteJetShortcutDown.delete(e.code); return; }
  setKeyState(e.code, false);
});

document.querySelectorAll('[data-hold-key]').forEach((btn) => {
  const code = btn.getAttribute('data-hold-key');
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { btn.setPointerCapture(e.pointerId); } catch (_) {}
    setKeyState(code, true);
  });
  btn.addEventListener('pointerup', (e) => {
    try { btn.releasePointerCapture(e.pointerId); } catch (_) {}
    setKeyState(code, false);
  });
  btn.addEventListener('pointercancel', (e) => {
    try { btn.releasePointerCapture(e.pointerId); } catch (_) {}
    setKeyState(code, false);
  });
  btn.addEventListener('pointerleave', (e) => {
    try { btn.releasePointerCapture(e.pointerId); } catch (_) {}
    setKeyState(code, false);
  });
});

function showBanner(type, duration = 2.5) {
  state.bannerType = type;
  state.bannerTimer = duration;
  renderBannerText();
}

function renderBannerText() {
  const bannerEl = document.getElementById('status-banner');
  const titleEl = document.getElementById('status-banner-title');
  const subEl = document.getElementById('status-banner-sub');
  const t = I18N[currentLang];

  if (!state.bannerType || state.bannerTimer <= 0) {
    bannerEl.classList.add('hidden');
    return;
  }
  bannerEl.classList.remove('hidden');

  if (state.bannerType === '8s') {
    bannerEl.className = 'glass-panel rounded-xl px-4 py-2 text-center border-2 border-amber-400 bg-amber-950/70 warning-pulse';
    titleEl.className = 'text-xs md:text-sm font-extrabold tracking-wider uppercase text-amber-300';
    titleEl.textContent = t.banner8sTitle;
    subEl.textContent = t.banner8sSub;
  } else if (state.bannerType === 'freefall') {
    bannerEl.className = 'glass-panel rounded-xl px-4 py-2 text-center border-2 border-rose-500 bg-rose-950/80 warning-pulse';
    titleEl.className = 'text-xs md:text-sm font-extrabold tracking-wider uppercase text-rose-300';
    titleEl.textContent = t.bannerFreefallTitle;
    subEl.textContent = t.bannerFreefallSub;
  } else if (state.bannerType === 'stunt') {
    bannerEl.className = 'glass-panel rounded-xl px-4 py-2 text-center border-2 border-cyan-400 bg-cyan-950/70';
    titleEl.className = 'text-xs md:text-sm font-extrabold tracking-wider uppercase text-cyan-300';
    titleEl.textContent = t.bannerStuntTitle;
    subEl.textContent = t.bannerStuntSub;
  } else if (state.bannerType === 'helipad') {
    bannerEl.className = 'glass-panel rounded-xl px-4 py-2 text-center border-2 border-emerald-400 bg-emerald-950/80 warning-pulse';
    titleEl.className = 'text-xs md:text-sm font-extrabold tracking-wider uppercase text-emerald-300';
    titleEl.textContent = t.bannerHelipadTitle;
    subEl.textContent = t.bannerHelipadSub;
  } else if (state.bannerType === 'impact') {
    bannerEl.className = 'glass-panel rounded-xl px-4 py-2 text-center border-2 border-orange-400 bg-orange-950/75';
    titleEl.className = 'text-xs md:text-sm font-extrabold tracking-wider uppercase text-orange-300';
    titleEl.textContent = `${t.bannerImpactTitle} (${state.lastImpactG.toFixed(1)} G)`;
    subEl.textContent = t.bannerImpactSub;
  } else if (state.bannerType === 'autoland') {
    bannerEl.className = 'glass-panel rounded-xl px-4 py-2 text-center border-2 border-emerald-400 bg-emerald-950/80';
    titleEl.className = 'text-xs md:text-sm font-extrabold tracking-wider uppercase text-emerald-300';
    titleEl.textContent = `${t.bannerAutoLandTitle} [${state.lastAutoSaveAlt.toFixed(1)}m]`;
    subEl.textContent = t.bannerAutoLandSub;
  } else if (state.bannerType === 'sonic') {
    bannerEl.className = 'glass-panel rounded-xl px-4 py-2 text-center border-2 border-cyan-300 bg-sky-950/85 warning-pulse';
    titleEl.className = 'text-xs md:text-sm font-extrabold tracking-wider uppercase text-cyan-200';
    titleEl.textContent = t.bannerSonicTitle;
    subEl.textContent = t.bannerSonicSub;
  } else if (state.bannerType === 'plaidOn') {
    bannerEl.className = 'glass-panel rounded-xl px-4 py-2 text-center border-2 border-rose-500 bg-rose-950/85 warning-pulse';
    titleEl.className = 'text-xs md:text-sm font-extrabold tracking-wider uppercase text-rose-300';
    titleEl.textContent = t.bannerPlaidOnTitle;
    subEl.textContent = t.bannerPlaidOnSub;
  } else if (state.bannerType === 'plaidOff') {
    bannerEl.className = 'glass-panel rounded-xl px-4 py-2 text-center border-2 border-slate-500 bg-slate-900/85';
    titleEl.className = 'text-xs md:text-sm font-extrabold tracking-wider uppercase text-slate-200';
    titleEl.textContent = t.bannerPlaidOffTitle;
    subEl.textContent = t.bannerPlaidOffSub;
  } else if (state.bannerType === 'drift') {
    bannerEl.className = 'glass-panel rounded-xl px-4 py-2 text-center border-2 border-amber-400 bg-amber-950/80';
    titleEl.className = 'text-xs md:text-sm font-extrabold tracking-wider uppercase text-amber-300';
    titleEl.textContent = t.bannerDriftTitle;
    subEl.textContent = t.bannerDriftSub;
  } else if (state.bannerType === 'modeReal') {
    bannerEl.className = 'glass-panel rounded-xl px-4 py-2 text-center border-2 border-emerald-400 bg-emerald-950/80';
    titleEl.className = 'text-xs md:text-sm font-extrabold tracking-wider uppercase text-emerald-300';
    titleEl.textContent = t.bannerRealTitle;
    subEl.textContent = t.bannerRealSub;
  } else if (state.bannerType === 'modeFantasy') {
    bannerEl.className = 'glass-panel rounded-xl px-4 py-2 text-center border-2 border-cyan-400 bg-cyan-950/80 warning-pulse';
    titleEl.className = 'text-xs md:text-sm font-extrabold tracking-wider uppercase text-cyan-300';
    titleEl.textContent = t.bannerFantasyTitle;
    subEl.textContent = t.bannerFantasySub;
  } else if (state.bannerType === 'altHoldOn') {
    bannerEl.className = 'glass-panel rounded-xl px-4 py-2 text-center border-2 border-teal-400 bg-teal-950/80';
    titleEl.className = 'text-xs md:text-sm font-extrabold tracking-wider uppercase text-teal-300';
    titleEl.textContent = t.bannerAltHoldOnTitle;
    subEl.textContent = t.bannerAltHoldOnSub;
  } else if (state.bannerType === 'altHoldOff') {
    bannerEl.className = 'glass-panel rounded-xl px-4 py-2 text-center border-2 border-slate-500 bg-slate-900/85';
    titleEl.className = 'text-xs md:text-sm font-extrabold tracking-wider uppercase text-slate-200';
    titleEl.textContent = t.bannerAltHoldOffTitle;
    subEl.textContent = t.bannerAltHoldOffSub;
  } else if (state.bannerType === 'milestone100') {
    bannerEl.className = 'glass-panel rounded-xl px-4 py-2 text-center border-2 border-emerald-400 bg-emerald-950/80 warning-pulse';
    titleEl.className = 'text-xs md:text-sm font-extrabold tracking-wider uppercase text-emerald-300';
    titleEl.textContent = t.banner0to100;
    subEl.textContent = currentLang === 'zh' ? '0-100 km/h 性能标杆实测达成（1.88s）！' : '0-100 km/h performance benchmark achieved (1.88s)!';
  } else if (state.bannerType === 'milestone200') {
    bannerEl.className = 'glass-panel rounded-xl px-4 py-2 text-center border-2 border-sky-400 bg-sky-950/80 warning-pulse';
    titleEl.className = 'text-xs md:text-sm font-extrabold tracking-wider uppercase text-sky-300';
    titleEl.textContent = t.banner200Kmh;
    subEl.textContent = currentLang === 'zh' ? '已突破 200 km/h 纯电巡航极速！' : '200 km/h pure EV cruise ceiling unlocked!';
  } else if (state.bannerType === 'milestone300') {
    bannerEl.className = 'glass-panel rounded-xl px-4 py-2 text-center border-2 border-amber-400 bg-amber-950/80 warning-pulse';
    titleEl.className = 'text-xs md:text-sm font-extrabold tracking-wider uppercase text-amber-300';
    titleEl.textContent = t.banner300Kmh;
    subEl.textContent = currentLang === 'zh' ? '已突破 300 km/h 狂暴超跑极速，全下压力贴地！' : '300 km/h hyper velocity reached — full downforce active!';
  } else if (state.bannerType === 'milestone370') {
    bannerEl.className = 'glass-panel rounded-xl px-4 py-2 text-center border-2 border-cyan-300 bg-sky-950/85 warning-pulse';
    titleEl.className = 'text-xs md:text-sm font-extrabold tracking-wider uppercase text-cyan-200';
    titleEl.textContent = t.banner370Kmh;
    subEl.textContent = currentLang === 'zh' ? '370 km/h 游戏高速阈值，短暂凝结气流脉冲。' : '370 km/h game speed threshold; brief condensation pulse.';
  } else if (state.bannerType === 'jump6m') {
    bannerEl.className = 'glass-panel rounded-xl px-4 py-2 text-center border-2 border-emerald-400 bg-emerald-950/85 warning-pulse';
    titleEl.className = 'text-xs md:text-sm font-extrabold tracking-wider uppercase text-emerald-300';
    titleEl.textContent = t.bannerJump6mTitle;
    subEl.textContent = t.bannerJump6mSub;
  }
}

function switchMap(targetMap) {
  window.RoadsterTaxi?.stop();
  window.RoadsterRanked?.abort('map');
  const nextMap = ['highway','city','coast'].includes(targetMap) ? targetMap : 'highway';
  if (nextMap !== 'coast') window.RoadsterCoast?.leave();
  else { window.RoadsterCoast?.enter(scene); window.RoadsterCoast?.weather(WEATHER_PRESETS[weatherIndex]); }
  currentMap = nextMap;
  selectedMapInModal = currentMap;
  highwayEnvGroup.visible = (currentMap === 'highway');
  cityEnvGroup.visible = (currentMap === 'city');

  const counts = mapTrafficCounts();
  resetCar();
  populateTraffic(counts[trafficLevelIndex]);
  applyTranslations();
}

function resetCar() {
  window.RoadsterTouch?.clear();
  window.RoadsterRanked?.abort('reset');
  window.RoadsterCityFrame?.reset();
  window.RoadsterCoastFrame?.reset();
  let coastSpawn=null;
  state.coastSupportId=null;state.coastDetached=false;
  globalThis.window?.RoadsterDemo?.stop();
  if (typeof clearThrusterVisuals === 'function') clearThrusterVisuals();
  if (typeof resetChaseCamera === 'function') resetChaseCamera();
  clearDebris();
  carMeshGroup.visible = true;
  document.getElementById('modal-destroyed').classList.add('hidden');


  if (typeof headlightSpotL !== 'undefined') headlightSpotL.intensity = 2.4;
  if (typeof headlightSpotR !== 'undefined') headlightSpotR.intensity = 2.4;
  RoadsterDrivingScore.reset(state);
  state.carsCleared = 0;
  state.blastedCarsCount = 0;
  state.speedMilestone = 0;
  state.isDestroyed = false;
  state.hullIntegrity = 100.0;
  state.lastImpactG = 0.0;
  state.impactCooldown = 0.0;

  if (currentMap === 'coast') {
    clearAllInputKeys();
    coastSpawn=window.RoadsterCoast.respawn(trafficCars);
  } else if (currentMap === 'highway') {
    state.x = 2.5;
    state.y = 0.0;
    state.z = 0.0;
    state.speed = 42.0;
    state.vx = 0.0;
    state.vy = 0.0;
    state.vz = -42.0;
  } else {
    state.x = CITY_DEFAULT_LANE_OFFSET;
    state.y = 0.0;
    state.z = 0.0;
    state.speed = 24.0;
    state.vx = 0.0;
    state.vy = 0.0;
    state.vz = -24.0;
  }

  state.airStrafeSpeed = 0.0;
  state.steerInput = 0.0;
  state.steerAngle = 0.0;
  state.roll = 0.0;
  state.pitch = 0.0;
  state.attitudeIdleSeconds = 0.0;
  state.wasAirborne = false;
  state.jumpInertiaSeconds = null;
  state.jumpInertiaGraceSeconds = null;
  state.groundHopActive = false;
  state.yaw = 0.0;
  state.vRoll = 0.0;
  state.vPitch = 0.0;
  state.vYaw = 0.0;
  state.accumulatedRoll = 0.0;
  state.airRemaining = MAX_AIR_SECONDS;
  state.airUsedContinuous = 0.0;
  state.isAutoDescending8s = false;
  state.isFreefalling = false;
  state.isAltitudeHold = false;
  state.holdTargetY = 0.0;
  state.isJumping6m = false;
  state.jumpTargetY = 6.0;
  const nBadge = document.getElementById('key-n');
  if (nBadge) nBadge.classList.remove('active');
  state.hasTriggeredHelipad = false;
  state.bannerTimer = 0;
  renderBannerText();
  sound.beep(520, 0.1);
  window.RoadsterTaxi?.onReset();
  if(coastSpawn){
    const p=coastSpawn;Object.assign(state,{x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:p.pitch,roll:p.roll,speed:p.speed,vx:p.vx*p.speed,vy:p.vy*p.speed,vz:p.vz*p.speed,coastSupportId:p.supportId,coastDetached:false});
  }
  if (currentMap === 'coast') window.RoadsterCoast?.recoverTraffic(trafficCars,state);
  // Every new round starts clean immediately, including mobile/button resets.
  if (typeof updateDestroyedScores === 'function') updateDestroyedScores();
  if (typeof updateCockpitHudScreen === 'function') {
    const speed = RoadsterDrivingScore.displayedSpeed(state, false);
    updateCockpitHudScreen(Math.round(speed * 2.23694), Math.round(speed * 3.6), false, false, false, false, false);
  }
}

function applyTranslations() {
  syncHudPerspective();
  globalThis.window?.RoadsterDemo?.render();
  window.RoadsterTouch?.setLanguage();
  window.RoadsterTaxi?.render();
  window.RoadsterMusic?.render();
  window.RoadsterRanked?.render();
  const t = I18N[currentLang];
  const hudBtnEl = document.getElementById('ui-hud-mode-btn');
  if (hudBtnEl) hudBtnEl.textContent = ({ full: t.hudBtnFull, medium: t.hudBtnMedium, minimal: t.hudBtnMinimal })[state.hudMode] || t.hudBtnFull;
  document.getElementById('btn-hud-mode')?.setAttribute('title', t.hudModeHint);
  document.getElementById('btn-hud-mode')?.setAttribute('aria-label', t.hudModeHint);
  if (document.getElementById('ui-lbl-downforce')) document.getElementById('ui-lbl-downforce').textContent = t.lblDownforce;
  if (document.getElementById('ui-lbl-tire-temp')) document.getElementById('ui-lbl-tire-temp').textContent = t.lblTireTemp;
  if (document.getElementById('ui-lbl-drag-coeff')) document.getElementById('ui-lbl-drag-coeff').textContent = t.lblDragCoeff;
  if (document.getElementById('ui-lbl-gas-mass')) document.getElementById('ui-lbl-gas-mass').textContent = t.lblGasMass;
  document.getElementById('ui-title').textContent = t.title;
  document.getElementById('ui-subtitle').textContent = t.subtitle;
  document.getElementById('lang-label').textContent = t.langToggle;
  document.getElementById('ui-map-btn').textContent = currentMap === 'coast' ? (currentLang === 'zh' ? '地图：海滨街区 (M)' : 'Map: Coastal District (M)') : currentMap === 'highway' ? t.mapBtnHighway : t.mapBtnCity;
  document.getElementById('ui-paint-btn').textContent = t.paintPrefix + t.paints[paintIndex];
  const physBtn = document.getElementById('ui-physics-mode-btn');
  if (physBtn) physBtn.textContent = (state.physicsMode === 'realistic') ? t.modeBtnRealistic : t.modeBtnFantasy;
  const plaidBtn = document.getElementById('ui-plaid-mode-btn');
  if (plaidBtn) {
    plaidBtn.textContent = state.insaneMode ? t.plaidBtnOn : t.plaidBtnOff;
    const plaidIcon = document.getElementById('plaid-mode-icon');
    if (plaidIcon) plaidIcon.textContent = state.insaneMode ? '🔥' : '⚡';
  }
  const unitBtn = document.getElementById('ui-unit-btn');
  if (unitBtn) {
    unitBtn.textContent = state.speedUnit === 'kmh' ? t.unitBtnKmh : t.unitBtnMph;
  }
  if (document.getElementById('ui-ctrl-steer')) document.getElementById('ui-ctrl-steer').textContent = t.ctrlSteer;
  if (document.getElementById('ui-ctrl-brake')) document.getElementById('ui-ctrl-brake').textContent = t.ctrlBrake;
  if (document.getElementById('ui-ctrl-handbrake')) document.getElementById('ui-ctrl-handbrake').textContent = t.ctrlHandbrake;
  if (document.getElementById('ui-ctrl-reverse')) document.getElementById('ui-ctrl-reverse').textContent = t.ctrlReverse;
  if (document.getElementById('ui-ctrl-air-jets')) document.getElementById('ui-ctrl-air-jets').textContent = t.ctrlAirJets;
  if (document.getElementById('ui-ctrl-modes')) document.getElementById('ui-ctrl-modes').textContent = t.ctrlModes;
  if (document.getElementById('ui-ctrl-zoom')) document.getElementById('ui-ctrl-zoom').textContent = t.ctrlZoom;
  if (document.getElementById('ui-weather-btn')) {
    document.getElementById('ui-weather-btn').textContent = t.weatherPrefix + t.weathers[weatherIndex];
  }
  if (document.getElementById('ui-ctrl-fpv-weather')) {
    document.getElementById('ui-ctrl-fpv-weather').textContent = t.ctrlFpvWeather;
  }
  if (document.getElementById('ui-modal-weather-step')) {
    document.getElementById('ui-modal-weather-step').textContent = t.modalWeatherStep;
  }
  if (document.getElementById('ui-modal-weather-title')) {
    document.getElementById('ui-modal-weather-title').textContent = t.modalWeatherTitle;
  }
  renderModalWeatherGrid();
  document.getElementById('ui-traffic-btn').textContent = t.trafficPrefix + (currentMap === 'coast' ? t.trafficLevels[trafficLevelIndex].replace(/20|36|52/,String(mapTrafficCounts()[trafficLevelIndex])) : t.trafficLevels[trafficLevelIndex]);
  document.getElementById('ui-camera-btn').textContent = t.camPrefix + t.cams[cameraModeIndex];
  updateZoomButtonLabel();
  document.getElementById('ui-sound-btn').textContent = sound.enabled ? t.soundOn : t.soundOff;
  document.getElementById('ui-reset-btn').textContent = t.resetBtn;
  document.getElementById('ui-help-btn').textContent = t.helpBtn;

  document.getElementById('ui-controls-header').textContent = t.controlsHeader;
  document.getElementById('ui-ctrl-drive').textContent = t.ctrlDrive;
  document.getElementById('ui-ctrl-hover').textContent = t.ctrlHover;
  document.getElementById('ui-ctrl-descend').textContent = t.ctrlDescend;
  document.getElementById('ui-ctrl-roll').textContent = t.ctrlRoll;
  document.getElementById('ui-stabilizer-label').textContent = t.stabilizerLabel;
  document.getElementById('ui-stabilizer-state').textContent = state.autoStabilizer ? t.stabilizerOn : t.stabilizerOff;
  document.getElementById('ui-rule-title').textContent = t.ruleTitle;
  document.getElementById('ui-rule-desc').innerHTML = t.ruleDesc;

  document.getElementById('ui-telemetry-header').textContent = t.telemetryHeader;
  document.getElementById('ui-hull-label').textContent = t.hullLabel;
  document.getElementById('ui-last-g-lbl').textContent = t.lastGLbl;
  document.getElementById('ui-nozzle-label').textContent = t.nozzleLabel;
  document.getElementById('ui-lbl-roll').textContent = t.lblRoll;
  document.getElementById('ui-lbl-pitch').textContent = t.lblPitch;
  document.getElementById('ui-lbl-yaw').textContent = t.lblYaw;
  document.getElementById('ui-lbl-altitude').textContent = t.lblAltitude;
  document.getElementById('ui-lbl-vspeed').textContent = t.lblVspeed;
  document.getElementById('ui-lbl-coords').textContent = t.lblCoords;
  document.getElementById('ui-lbl-passed').textContent = t.lblPassed;
  document.getElementById('ui-lbl-score').textContent = t.lblScore;

  document.getElementById('ui-tank-title').textContent = t.tankTitle;
  document.getElementById('ui-8s-marker-label').textContent = t.marker8s;
  document.getElementById('ui-tank-hint').textContent = t.tankHint;

  document.getElementById('map-modal-badge').textContent = t.mapModalBadge;
  document.getElementById('map-modal-title').textContent = t.mapModalTitle;
  document.getElementById('map-modal-sub').textContent = t.mapModalSub;
  if (document.getElementById('ui-modal-paint-step')) document.getElementById('ui-modal-paint-step').textContent = t.modalPaintStep;
  if (document.getElementById('ui-modal-paint-title')) document.getElementById('ui-modal-paint-title').textContent = t.modalPaintTitle;
  if (document.getElementById('ui-modal-map-step')) document.getElementById('ui-modal-map-step').textContent = t.modalMapStep;
  if (document.getElementById('ui-modal-map-title')) document.getElementById('ui-modal-map-title').textContent = t.modalMapTitle;
  if (document.getElementById('ui-ready-prefix')) document.getElementById('ui-ready-prefix').textContent = t.modalReadyPrefix;
  renderModalPaintGrid();
  highlightSelectedMapCard(selectedMapInModal);
  document.getElementById('map-modal-sub').textContent = t.mapModalSub;
  document.getElementById('card-hwy-tag').textContent = t.cardHwyTag;
  document.getElementById('card-hwy-title').textContent = t.cardHwyTitle;
  document.getElementById('card-hwy-desc').textContent = t.cardHwyDesc;
  document.getElementById('card-hwy-spec').textContent = t.cardHwySpec;
  document.getElementById('card-city-tag').textContent = t.cardCityTag;
  document.getElementById('card-city-title').textContent = t.cardCityTitle;
  document.getElementById('card-city-desc').textContent = t.cardCityDesc;
  document.getElementById('card-city-spec').textContent = t.cardCitySpec;
  document.getElementById('map-modal-highlights').innerHTML = t.mapModalHighlights;
  document.getElementById('ui-btn-launch-map').textContent = t.btnLaunchMap;

  document.getElementById('modal-badge').textContent = t.modalBadge;
  document.getElementById('modal-title').textContent = t.modalTitle;
  document.getElementById('modal-desc').innerHTML = t.modalDesc;
  document.getElementById('modal-h-drive').textContent = t.modalHDrive;
  document.getElementById('modal-list-drive').innerHTML = t.modalListDrive;
  document.getElementById('modal-h-attitude').textContent = t.modalHAttitude;
  document.getElementById('modal-list-attitude').innerHTML = t.modalListAttitude;
  if (document.getElementById('modal-h-sonic')) document.getElementById('modal-h-sonic').textContent = t.modalHSonic;
  if (document.getElementById('modal-p-sonic')) document.getElementById('modal-p-sonic').innerHTML = t.modalPSonic;
  document.getElementById('modal-h-tank').textContent = t.modalHTank;
  document.getElementById('modal-p-tank').innerHTML = t.modalPTank;
  document.getElementById('modal-btn-resume').textContent = t.modalBtnResume;

  updateDestroyedModalText();
  renderBannerText();
  window.RoadsterStart?.render();
}

function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'zh' : 'en';
  if (currentLang === 'zh') {
    state.speedUnit = 'kmh';
  }
  applyTranslations();
  sound.beep(740, 0.08);
}

document.getElementById('btn-lang').addEventListener('click', toggleLanguage);
document.getElementById('btn-modal-lang').addEventListener('click', toggleLanguage);
document.getElementById('btn-map-modal-lang').addEventListener('click', toggleLanguage);

const cardHighwayEl = document.getElementById('card-map-highway');
const cardCityEl = document.getElementById('card-map-city');

function highlightSelectedMapCard(mapKey) {
  selectedMapInModal = ['highway','city','coast'].includes(mapKey) ? mapKey : 'highway';
  const isZh = currentLang === 'zh';
  for (const [id,key,color] of [['highway','hwy','cyan'],['city','city','indigo'],['coast','coast','amber']]) {
    const selected=selectedMapInModal===id,card=document.getElementById(`card-map-${id}`),badge=document.getElementById(`card-${key}-status`);
    card?.classList.toggle('selected',selected);card?.setAttribute('aria-pressed',String(selected));
    if (badge) { badge.textContent=selected?(isZh?'✓ 已选定':'✓ SELECTED'):(isZh?'选择 →':'SELECT →');badge.className=selected?`font-bold text-${color}-300`:'text-slate-400 font-normal'; }
  }
  const names = { highway:isZh?'高架高速 (Elevated Highway)':'Elevated Highway', city:isZh?'赛博都市 (Mega Cyber Metropolis)':'Mega Open-World Cyber Metropolis',coast:isZh?'海滨街区 · 原创压缩地图':'Original Coastal District' };
  const summary=document.getElementById('summary-map-chip');if(summary)summary.textContent=names[selectedMapInModal];
  window.RoadsterStart?.render();
}

cardHighwayEl.addEventListener('click', () => {
  highlightSelectedMapCard('highway');
  sound.beep(520, 0.06);
});

cardCityEl.addEventListener('click', () => {
  highlightSelectedMapCard('city');
  sound.beep(520, 0.06);
});
document.getElementById('card-map-coast')?.addEventListener('click', () => {
  highlightSelectedMapCard('coast');sound.beep(520,.06);
});

function launchSelectedMap() {
  clearAllInputKeys();
  switchMap(selectedMapInModal);
  document.getElementById('modal-map-select').classList.add('hidden');
  window.RoadsterStart?.onLaunch();
  sound.init();
}
document.getElementById('btn-launch-selected-map').addEventListener('click', launchSelectedMap);

function clearAllInputKeys() {
  updateAutopilotKeyBadges();
  infiniteJetShortcutDown.clear();
  window.RoadsterTouch?.clear();
  for (const k in keys) {
    if (keys[k]) setKeyState(k, false);
  }
}

function openMapSelectModal() {
  globalThis.window?.RoadsterDemo?.stop();
  clearAllInputKeys();
  highlightSelectedMapCard(currentMap);
  document.getElementById('modal-destroyed').classList.add('hidden');
  document.getElementById('modal-map-select').classList.remove('hidden');
  window.RoadsterStart?.onOpen();
}

document.getElementById('btn-map-select').addEventListener('click', openMapSelectModal);
document.getElementById('btn-crash-switch-map').addEventListener('click', openMapSelectModal);
document.getElementById('btn-crash-respawn').addEventListener('click', resetCar);

function selectPaintFinish(idx, playAudio = true) {
  paintIndex = THREE.MathUtils.clamp(Number.isFinite(idx) ? Math.trunc(idx) : 0, 0, PAINT_PRESETS.length - 1);
  try { localStorage.setItem('roadster-paint-finish', PAINT_PRESETS[paintIndex].id); } catch (_) {}
  const preset = PAINT_PRESETS[paintIndex];
  bodyMaterial.color.setHex(preset.color);
  bodyMaterial.metalness = preset.metalness;
  bodyMaterial.roughness = preset.roughness;
  bodyMaterial.clearcoat = 1.0;
  bodyMaterial.clearcoatRoughness = 0.16;

  const dot = document.getElementById('paint-dot');
  if (dot) dot.className = `w-2.5 h-2.5 rounded-full border border-white ${preset.dotClass}`;
  
  const modalDot = document.getElementById('modal-active-dot');
  if (modalDot) { modalDot.className = 'start-paint-dot'; modalDot.style.backgroundColor = preset.hexCode; }

  renderModalPaintGrid();
  applyTranslations();
  if (playAudio) sound.beep(640, 0.08);
}

function cyclePaintFinish(nextIdx) {
  const target = (typeof nextIdx === 'number') ? (nextIdx % PAINT_PRESETS.length) : ((paintIndex + 1) % PAINT_PRESETS.length);
  selectPaintFinish(target, true);
}

function renderModalPaintGrid() {
  const grid = document.getElementById('modal-paint-grid');
  if (!grid) return;
  const isZh = currentLang === 'zh';
  // Keep the focused button alive during paint changes and translation refreshes.
  PAINT_PRESETS.forEach((preset, idx) => {
    let card = grid.children[idx];
    if (!card) {
      card = document.createElement('button');
      card.type = 'button';
      card.className = 'paint-choice';
      card.addEventListener('click', () => selectPaintFinish(idx, true));
      grid.appendChild(card);
    }
    const selected = idx === paintIndex;
    const name = isZh ? preset.nameZh : preset.nameEn;
    card.setAttribute('aria-pressed', String(selected));
    card.setAttribute('aria-label', name);
    card.innerHTML = `<span class="paint-swatch" style="background-color:${preset.hexCode}" aria-hidden="true"></span><span class="paint-choice-name">${name}<span class="paint-choice-tag">${selected ? (isZh ? '✓ 当前涂装' : '✓ SELECTED') : (isZh ? preset.tagZh : preset.tagEn)}</span></span>`;
  });
  const name = isZh ? PAINT_PRESETS[paintIndex].nameZh : PAINT_PRESETS[paintIndex].nameEn;
  const active = document.getElementById('modal-active-paint-name');
  if (active) active.textContent = name;
  const summary = document.getElementById('summary-paint-chip');
  if (summary) summary.textContent = name;
}

document.getElementById('btn-physics-mode').addEventListener('click', togglePhysicsMode);
const btnPlaidEl = document.getElementById('btn-plaid-mode');
if (btnPlaidEl) btnPlaidEl.addEventListener('click', togglePlaidMode);
const btnUnitEl = document.getElementById('btn-unit-toggle');
if (btnUnitEl) btnUnitEl.addEventListener('click', toggleSpeedUnit);
const valSpeedUnitEl = document.getElementById('val-speed-unit');
if (valSpeedUnitEl) valSpeedUnitEl.addEventListener('click', toggleSpeedUnit);
document.getElementById('btn-paint').addEventListener('click', () => cyclePaintFinish());
restoreHudMode();
const btnHudMode = document.getElementById('btn-hud-mode');
if (btnHudMode) {
  btnHudMode.addEventListener('click', toggleHudMode);
}


function selectWeatherMode(idx, playAudio = true) {
  if (idx !== weatherIndex) window.RoadsterRanked?.abort('weather');
  weatherIndex = THREE.MathUtils.clamp(idx, 0, WEATHER_PRESETS.length - 1);
  const wp = WEATHER_PRESETS[weatherIndex];

  scene.background.setHex(wp.bgColor);
  scene.fog.color.setHex(wp.fogColor);
  scene.fog.density = wp.fogDensity;

  ambientLight.color.setHex(wp.ambientColor);
  ambientLight.intensity = wp.ambientIntensity;

  dirLight.color.setHex(wp.dirColor);
  dirLight.intensity = wp.dirIntensity;
  dirLight.position.set(wp.dirPos[0], wp.dirPos[1], wp.dirPos[2]);

  rimLight.color.setHex(wp.rimColor);
  rimLight.intensity = wp.rimIntensity;

  scene.environment = wp.marsSun ? marsSunsetEnvMap : studioEnvMap;

  // Isolate wet asphalt from the car's studio lighting, on both maps/road axes.
  [roadMat, cityAsphaltMat, cityAsphaltEWMat].forEach(material => applyRoadWeather(material, wp));
  window.RoadsterCoast?.weather(wp);


  if (typeof headlightSpotL !== 'undefined' && typeof headlightSpotR !== 'undefined') {
    const spotCol = wp.marsSun ? 0xfef08a : (wp.rain ? 0x7dd3fc : 0xf8fafc);
    const spotInt = wp.rain ? 2.8 : (wp.marsSun ? 2.0 : 2.4);
    headlightSpotL.color.setHex(spotCol);
    headlightSpotR.color.setHex(spotCol);
    headlightSpotL.intensity = spotInt;
    headlightSpotR.intensity = spotInt;
  }
  rainLinesMesh.visible = wp.rain;
  marsSunGroup.visible = wp.marsSun;

  const iconEl = document.getElementById('weather-icon');
  if (iconEl) iconEl.textContent = wp.icon;

  renderModalWeatherGrid();
  applyTranslations();
  if (playAudio) sound.beep(610, 0.08);
}

function cycleWeatherMode() {
  selectWeatherMode((weatherIndex + 1) % WEATHER_PRESETS.length, true);
}

function renderModalWeatherGrid() {
  const grid = document.getElementById('modal-weather-grid');
  if (!grid) return;
  const isZh = currentLang === 'zh';
  const shortNames = isZh ? ['星际暗夜', '霓虹雨夜', '火星落日'] : ['Cyber Night', 'Neon Rain', 'Mars Sunset'];
  WEATHER_PRESETS.forEach((wp, idx) => {
    let button = grid.children[idx];
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'start-weather-choice';
      button.addEventListener('click', () => selectWeatherMode(idx, true));
      grid.appendChild(button);
    }
    button.setAttribute('aria-pressed', String(idx === weatherIndex));
    button.setAttribute('aria-label', isZh ? wp.nameZh : wp.nameEn);
    button.setAttribute('title', isZh ? wp.descZh : wp.descEn);
    button.innerHTML = `<span aria-hidden="true">${wp.icon}</span><span>${shortNames[idx]}</span>`;
  });
  const summary = document.getElementById('summary-weather-chip');
  if (summary) summary.textContent = `${WEATHER_PRESETS[weatherIndex].icon} ${shortNames[weatherIndex]}`;
}

document.getElementById('btn-weather').addEventListener('click', () => cycleWeatherMode());

document.getElementById('btn-traffic').addEventListener('click', () => {
  globalThis.window?.RoadsterDemo?.stop();
  window.RoadsterRanked?.abort('traffic');
  trafficLevelIndex = (trafficLevelIndex + 1) % 3;
  const counts = mapTrafficCounts();
  populateTraffic(counts[trafficLevelIndex]);
  applyTranslations();
  sound.beep(580, 0.08);
});

document.getElementById('btn-camera').addEventListener('click', () => {
  cameraModeIndex = (cameraModeIndex + 1) % 4;
  applyTranslations();
  sound.beep(680, 0.08);
});

document.getElementById('btn-sound').addEventListener('click', () => {
  sound.init();
  sound.enabled = !sound.enabled;
  applyTranslations();
});

document.getElementById('btn-reset').addEventListener('click', resetCar);


function togglePhysicsMode() {
  globalThis.window?.RoadsterDemo?.stop();
  window.RoadsterRanked?.abort('physics');
  state.physicsMode = (state.physicsMode === 'realistic') ? 'fantasy' : 'realistic';
  if (state.physicsMode === 'fantasy') {
    state.insaneMode = false;
  }
  applyTranslations();
  sound.beep(state.physicsMode === 'realistic' ? 580 : 880, 0.12);
  showBanner(state.physicsMode === 'realistic' ? 'modeReal' : 'modeFantasy', 2.8);
  sound.speakAlert('modeSwitch',
    state.physicsMode === 'realistic' ? 'Realistic physics mode engaged.' : 'Fantasy mode engaged.',
    state.physicsMode === 'realistic' ? '已切换至常规物理模式，限速200公里每小时。' : '已切换至幻想模式，全功率火箭推进。'
  );
}

function togglePlaidMode() {
  globalThis.window?.RoadsterDemo?.stop();
  window.RoadsterRanked?.abort('plaid');
  if (state.physicsMode !== 'realistic') {
    state.physicsMode = 'realistic';
  }
  state.insaneMode = !state.insaneMode;
  applyTranslations();
  sound.beep(state.insaneMode ? 920 : 480, 0.14);
  showBanner(state.insaneMode ? 'plaidOn' : 'plaidOff', 2.6);
  sound.speakAlert('plaidMode',
    state.insaneMode ? 'Insane Plaid mode engaged. Max speed 370 kilometers per hour.' : 'Plaid mode disengaged. Top speed 200 kilometers per hour.',
    state.insaneMode ? '狂暴模式已开启，最高时速370公里每小时，冷气火箭推进全开！' : '狂暴模式已关闭，恢复常规纯电行驶，最高时速200公里每小时。'
  );
}

function toggleSpeedUnit() {
  state.speedUnit = (state.speedUnit === 'kmh') ? 'mph' : 'kmh';
  applyTranslations();
  sound.beep(620, 0.08);
}

function triggerJump6m() {
  if (globalThis.window?.RoadsterDemo?.isBusy() && !window.RoadsterDemo.isRequestingJump()) return;
  if (state.isDestroyed || state.isFreefalling || state.airRemaining <= 0.15) return;
  sound.init();
  let groundElev = currentMap === 'coast' ? (globalThis.window?.RoadsterCoast?.support({...state,grounded:!state.wasAirborne}).height ?? 0) : 0;
  if ((currentMap === 'city' && typeof cityBuildings !== 'undefined') || currentMap === 'coast') {
    const mapBuildings = currentMap === 'coast' ? (globalThis.window?.RoadsterCoast?.buildings() || []) : cityBuildings;
    for (let i = 0; i < mapBuildings.length; i++) {
      const b = mapBuildings[i];
      if (state.x > b.minX - 1.1 && state.x < b.maxX + 1.1 && state.z > b.minZ - 1.8 && state.z < b.maxZ + 1.8) {
        if (state.y >= b.height - 0.55) {
          groundElev = Math.max(groundElev, b.height);
        }
      }
    }
  }
  const currentAgl = Math.max(0.0, state.y - groundElev);
  // Only a fresh ground/roof takeoff gets launch grace. Midair O taps cannot
  // restart it and disable normal flight handling.
  if (currentAgl <= 0.15 && (currentMap!=='coast'||(!state.wasAirborne&&!state.coastDetached))) {
    state.groundHopActive = true;
    state.jumpInertiaSeconds = 0;
    state.jumpInertiaGraceSeconds = globalThis.window?.RoadsterDemo?.isRequestingJump() ? (window.RoadsterDemo.jumpGraceSeconds?.() ?? 0.95) : null;
  }
  // Jump to 6.0m above ground/rooftop (or +6.0m if already flying above 5.5m)
  state.jumpStartY = state.y;
  const demoJumpHeight = globalThis.window?.RoadsterDemo?.isRequestingJump() ? window.RoadsterDemo.jumpHeight() : 6.0;
  state.jumpTargetY = (currentAgl < 5.5) ? (groundElev + demoJumpHeight) : Math.min(MAX_FLIGHT_ALTITUDE, state.y + 6.0);
  state.isJumping6m = true;
  if(currentMap==='coast'){state.coastDetached=true;state.coastSupportId=null;}
  state.isAltitudeHold = false;
  const nBadge = document.getElementById('key-n');
  if (nBadge) nBadge.classList.remove('active');
  const baseClimbVy = (state.physicsMode === 'realistic') ? (6.2 * 1.3) : (28.0 * 1.3);
  state.vy = Math.max(state.vy, baseClimbVy * 2.5);
  if (!globalThis.window?.RoadsterDemo?.isRequestingJump()) showBanner('jump6m', 2.0);
  sound.beep(820, 0.12);
}

function toggleAltitudeHold() {
  if (globalThis.window?.RoadsterDemo?.isBusy()) return;
  if (state.isDestroyed) return;
  sound.init();
  let groundElev = currentMap === 'coast' ? (globalThis.window?.RoadsterCoast?.support({...state,grounded:!state.wasAirborne}).height ?? 0) : 0;
  if ((currentMap === 'city' && typeof cityBuildings !== 'undefined') || currentMap === 'coast') {
    const mapBuildings = currentMap === 'coast' ? (globalThis.window?.RoadsterCoast?.buildings() || []) : cityBuildings;
    for (let i = 0; i < mapBuildings.length; i++) {
      const b = mapBuildings[i];
      if (state.x > b.minX - 1.1 && state.x < b.maxX + 1.1 && state.z > b.minZ - 1.8 && state.z < b.maxZ + 1.8) {
        if (state.y >= b.height - 0.55) {
          groundElev = Math.max(groundElev, b.height);
        }
      }
    }
  }
  const agl = state.y - groundElev;
  if (agl <= 0.15) {
    // Only engages in mid-air
    state.isAltitudeHold = false;
    return;
  }
  if (state.isFreefalling || state.airRemaining <= 0.05) return;
  state.isAltitudeHold = !state.isAltitudeHold;
  if (state.isAltitudeHold) {
    state.holdTargetY = state.y;
    state.isJumping6m = false;
    showBanner('altHoldOn', 2.2);
    sound.beep(740, 0.10);
  } else {
    showBanner('altHoldOff', 1.6);
    sound.beep(480, 0.08);
  }
  const nBadge = document.getElementById('key-n');
  if (nBadge) nBadge.classList.toggle('active', state.isAltitudeHold);
}

function toggleStabilizer() {
  globalThis.window?.RoadsterDemo?.stop();
  window.RoadsterRanked?.abort('stabilizer');
  state.autoStabilizer = !state.autoStabilizer;
  const btn = document.getElementById('btn-stabilizer');
  if (state.autoStabilizer) {
    btn.className = 'px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 cursor-pointer';
  } else {
    btn.className = 'px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40 cursor-pointer';
  }
  applyTranslations();
  sound.beep(state.autoStabilizer ? 700 : 440, 0.08);
}

document.getElementById('btn-stabilizer').addEventListener('click', toggleStabilizer);

function toggleHelpModal() {
  globalThis.window?.RoadsterDemo?.stop();
  clearAllInputKeys();
  const modal = document.getElementById('modal-help');
  modal.classList.toggle('hidden');
}

document.getElementById('btn-touch-jump')?.addEventListener('click', (e) => {
  e.preventDefault();
  triggerJump6m();
});
document.getElementById('btn-touch-hold')?.addEventListener('click', (e) => {
  e.preventDefault();
  toggleAltitudeHold();
});

document.getElementById('btn-help').addEventListener('click', toggleHelpModal);
document.getElementById('btn-close-modal').addEventListener('click', toggleHelpModal);
document.getElementById('btn-start-game').addEventListener('click', toggleHelpModal);

document.getElementById('btn-collapse-guide').addEventListener('click', () => {
  if (toggleMobileHudPanel('guide')) return;
  const body = document.getElementById('guide-body');
  const hudLeft = document.getElementById('hud-left');
  const hudLeftHeader = document.getElementById('hud-left-header');
  const btn = document.getElementById('btn-collapse-guide');
  const isNowHidden = body.classList.toggle('hidden');
  if (isNowHidden) {
    hudLeft.className = 'pointer-events-auto glass-panel rounded-lg px-2.5 py-1.5 w-auto transition-all duration-200 opacity-85 hover:opacity-100';
    hudLeftHeader.className = 'flex items-center justify-between gap-2';
    btn.textContent = '[+]';
  } else {
    hudLeft.className = 'pointer-events-auto glass-panel rounded-xl p-3 w-72 md:w-80 transition-all duration-200 max-h-[calc(100vh-12.5rem)] overflow-y-auto';
    hudLeftHeader.className = 'flex items-center justify-between gap-2 border-b border-slate-700/70 pb-1.5 mb-2';
    btn.textContent = '[_]';
  }
});

const btnCollapseTelemetry = document.getElementById('btn-collapse-telemetry');
if (btnCollapseTelemetry) {
  btnCollapseTelemetry.addEventListener('click', () => {
    if (toggleMobileHudPanel('telemetry')) return;
    const body = document.getElementById('telemetry-body');
    const card = document.getElementById('hud-right-card');
    const header = document.getElementById('hud-right-header');
    const isNowHidden = body.classList.toggle('hidden');
    if (isNowHidden) {
      card.className = 'glass-panel rounded-lg px-2.5 py-1.5 w-auto pointer-events-auto transition-all duration-200 opacity-85 hover:opacity-100';
      header.className = 'flex items-center justify-between gap-2';
      btnCollapseTelemetry.textContent = '[+]';
    } else {
      card.className = 'glass-panel rounded-xl p-3 w-56 md:w-64 pointer-events-auto transition-all duration-200 max-h-[calc(100vh-12.5rem)] overflow-y-auto';
      header.className = 'flex items-center justify-between gap-1.5 border-b border-slate-700/70 pb-1.5 mb-2';
      btnCollapseTelemetry.textContent = '[_]';
    }
  });
}

// =========================================================================
// LIVE COCKPIT TOUCHSCREEN & HUD RENDERER (Speed, G-Force Ball, 10 Nozzles)
// =========================================================================
const vfxCanvas = document.getElementById('vfx-overlay-canvas');
const vfxCtx = vfxCanvas ? vfxCanvas.getContext('2d') : null;
const speedLinesPool = Array.from({ length: 68 }, () => ({
  angle: Math.random() * Math.PI * 2,
  radiusFrac: 0.25 + Math.random() * 0.75,
  speedMul: 0.7 + Math.random() * 0.8,
  lenMul: 0.6 + Math.random() * 0.9
}));

function resizeVfxCanvas() {
  if (!vfxCanvas) return;
  vfxCanvas.width = window.innerWidth;
  vfxCanvas.height = window.innerHeight;
}
resizeVfxCanvas();

function updateCockpitHudScreen(mph, kmh, rearActive, isLiftFiring, isFrontRetroFiring, rcsRollPitchActive, rcsYawRetroActive) {
  if (!cockpitHudCtx) return;
  const ctx = cockpitHudCtx;
  const W = 512, H = 200;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(6, 12, 24, 0.90)';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, W - 8, H - 8);

  const isUnitKmh = (state.speedUnit === 'kmh');
  const primarySpeed = isUnitKmh ? kmh : mph;
  const primaryLabel = isUnitKmh ? 'KM/H' : 'MPH';
  const secondaryText = isUnitKmh ? `${mph} MPH` : `${kmh} km/h`;
  ctx.fillStyle = mph >= 230 ? '#38bdf8' : '#ffffff';
  ctx.font = '800 54px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(String(primarySpeed), 140, 75);
  ctx.textAlign = 'left';
  ctx.font = 'bold 22px "JetBrains Mono", monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(primaryLabel, 22, 104);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 18px "JetBrains Mono", monospace';
  ctx.fillText(secondaryText, 22, 132);

  // Cockpit Turn Signal Blinkers stay in the speed column, away from the road.
  const isTurnLeft = (state.steerInput > 0.12) || Boolean(keys['KeyA']);
  const isTurnRight = (state.steerInput < -0.12) || Boolean(keys['KeyD']);
  const blinkActive = (Math.sin(performance.now() * 0.013) > 0);
  ctx.font = 'bold 20px "JetBrains Mono", monospace';
  ctx.fillStyle = (isTurnLeft && blinkActive) ? '#10b981' : '#334155';
  ctx.fillText('◀', 22, 30);
  ctx.fillStyle = (isTurnRight && blinkActive) ? '#10b981' : '#334155';
  ctx.fillText('▶', 52, 30);

  // A short, wide pod replaces the tall telemetry screen. Keep the shared live
  // speed/tank and passenger data while dedicating the upper view to the road.
  const tank = getAirTankReadout(state.airRemaining);
  const lowAir = tank.fraction <= 0.20;
  const tankColor = tank.fraction === 0 || state.isFreefalling ? '#f87171' : (lowAir || state.isAutoDescending8s ? '#fbbf24' : '#67e8f9');
  ctx.textAlign = 'left';
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 22px "JetBrains Mono", monospace';
  ctx.fillText('COPV AIR · 600L', 178, 30);
  ctx.textAlign = 'right';
  ctx.fillStyle = tankColor;
  ctx.font = 'bold 30px "JetBrains Mono", monospace';
  ctx.fillText(`${tank.seconds.toFixed(1)}s / ${MAX_AIR_SECONDS.toFixed(1)}s`, 494, 66);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(178, 78, 316, 32);
  const airGradient = ctx.createLinearGradient(182, 0, 490, 0);
  airGradient.addColorStop(0, '#06b6d4');
  airGradient.addColorStop(0.55, '#38bdf8');
  airGradient.addColorStop(1, '#34d399');
  ctx.fillStyle = lowAir || state.isAutoDescending8s || state.isFreefalling ? tankColor : airGradient;
  ctx.fillRect(182, 82, 308 * tank.fraction, 24);
  ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2;
  ctx.strokeRect(178, 78, 316, 32);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(182 + 308 * 0.20, 78, 3, 32);
  ctx.font = 'bold 20px "JetBrains Mono", monospace';
  ctx.textAlign = 'left'; ctx.fillStyle = '#cbd5e1';
  ctx.fillText(`${tank.liters}L`, 178, 134);
  ctx.textAlign = 'right';
  ctx.fillText(`GAS: ${tank.massKg.toFixed(1)} kg`, 494, 134);
  ctx.font = 'bold 18px "JetBrains Mono", monospace';
  ctx.fillStyle = tankColor; ctx.textAlign = 'left';
  const anyJet = rearActive || isLiftFiring || isFrontRetroFiring || rcsRollPitchActive || rcsYawRetroActive;
  const tankStatus = tank.fraction === 0 ? 'EMPTY' : (state.isAutoDescending8s ? 'AUTO-DESCEND'
    : (lowAir ? 'LOW AIR · 20%' : (anyJet ? 'THRUST' : (tank.fraction < 0.995 ? 'RECHARGING' : 'COPV READY'))));
  ctx.fillText(tankStatus, 22, 156);

  window.RoadsterTaxi?.drawCockpit(ctx);
  cockpitHudTexture.needsUpdate = true;
}

// =========================================================================
// FULL-SCREEN DYNAMIC SPEED LINES, MACH SHOCK & RAIN WINDSHIELD VFX OVERLAY
// =========================================================================
function updateSpeedAndWeatherOverlay(dt, mph, isThrusting, isSupersonic) {
  if (!vfxCtx || !vfxCanvas) return;
  const W = vfxCanvas.width;
  const H = vfxCanvas.height;
  vfxCtx.clearRect(0, 0, W, H);

  const cx = W * 0.5;
  const cy = H * 0.5;

  // 1. Lightning Flash in Cyber Neon Rain mode
  if (state.lightningFlash > 0.01) {
    vfxCtx.fillStyle = `rgba(224, 242, 254, ${state.lightningFlash * 0.35})`;
    vfxCtx.fillRect(0, 0, W, H);
  }

  // 3. Radial Speed Lines & Supersonic Vignette (Disabled in Cockpit FPV cameraModeIndex === 3 to prevent screen flicker)
  const speedIntensity = (cameraModeIndex === 3) ? 0.0 : (THREE.MathUtils.clamp((mph - 130) / 140, 0.0, 1.0) + (isThrusting ? 0.28 : 0.0));
  if (speedIntensity > 0.04) {
    const maxR = Math.hypot(cx, cy);
    // Peripheral aerodynamic tunnel vignette
    const radGrad = vfxCtx.createRadialGradient(cx, cy, maxR * 0.42, cx, cy, maxR);
    radGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    radGrad.addColorStop(1, isSupersonic
      ? `rgba(14, 165, 233, ${Math.min(0.32, speedIntensity * 0.25)})`
      : `rgba(56, 189, 248, ${Math.min(0.18, speedIntensity * 0.14)})`);
    vfxCtx.fillStyle = radGrad;
    vfxCtx.fillRect(0, 0, W, H);

    // Radial speed streaks
    speedLinesPool.forEach((sl, idx) => {
      sl.radiusFrac += dt * (1.2 + speedIntensity * 2.4) * sl.speedMul;
      if (sl.radiusFrac > 1.05) {
        sl.radiusFrac = 0.28 + Math.random() * 0.22;
        sl.angle = Math.random() * Math.PI * 2;
      }
      const rStart = sl.radiusFrac * maxR;
      const rEnd = rStart + (35 + speedIntensity * 95) * sl.lenMul;
      const cosA = Math.cos(sl.angle);
      const sinA = Math.sin(sl.angle);

      vfxCtx.strokeStyle = isSupersonic
        ? (idx % 3 === 0 ? `rgba(254, 240, 138, ${speedIntensity * 0.55})` : `rgba(56, 189, 248, ${speedIntensity * 0.65})`)
        : `rgba(224, 242, 254, ${speedIntensity * 0.42})`;
      vfxCtx.lineWidth = isSupersonic ? 2.2 : 1.5;
      vfxCtx.beginPath();
      vfxCtx.moveTo(cx + cosA * rStart, cy + sinA * rStart);
      vfxCtx.lineTo(cx + cosA * rEnd, cy + sinA * rEnd);
      vfxCtx.stroke();
    });
  }
}

// Fix operational bug: clear all keys when window loses focus (e.g. alt-tab) to avoid stuck throttle/thruster
window.addEventListener('blur', () => {
  updateAutopilotKeyBadges();
  infiniteJetShortcutDown.clear();
  for (const k in keys) {
    if (keys[k]) setKeyState(k, false);
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    updateAutopilotKeyBadges();
    infiniteJetShortcutDown.clear();
    for (const k in keys) {
      if (keys[k]) setKeyState(k, false);
    }
  }
});

// Dynamic Camera Distance Zoom Controls ([ / ] keys, Mouse Wheel, or UI button)
const zoomPresets = [
  { labelEn: '🔍 Zoom: Close (75%)', labelZh: '🔍 镜头: 紧凑近景 (75%)', factor: 0.75 },
  { labelEn: '🔍 Zoom: Standard (100%)', labelZh: '🔍 镜头: 标准追视 (100%)', factor: 1.0 },
  { labelEn: '🔍 Zoom: Wide (125%)', labelZh: '🔍 镜头: 广角远景 (125%)', factor: 1.25 }
];
let currentZoomIndex = 0; // Default to Close view!

function updateZoomButtonLabel() {
  const btnEl = document.getElementById('ui-camera-zoom-btn');
  if (btnEl) {
    const isZh = currentLang === 'zh';
    btnEl.textContent = isZh ? zoomPresets[currentZoomIndex].labelZh : zoomPresets[currentZoomIndex].labelEn;
  }
}

document.getElementById('btn-camera-zoom')?.addEventListener('click', () => {
  currentZoomIndex = (currentZoomIndex + 1) % zoomPresets.length;
  state.camZoom = zoomPresets[currentZoomIndex].factor;
  updateZoomButtonLabel();
  sound.beep(580 + currentZoomIndex * 80, 0.06);
});

window.addEventListener('wheel', (e) => {
  if (cameraModeIndex === 3) return; // Keep Cockpit FPV rock solid
  const delta = e.deltaY * 0.0012;
  state.camZoom = THREE.MathUtils.clamp((state.camZoom || 0.75) + delta, 0.55, 1.35);
  if (state.camZoom < 0.88) currentZoomIndex = 0;
  else if (state.camZoom < 1.15) currentZoomIndex = 1;
  else currentZoomIndex = 2;
  updateZoomButtonLabel();
}, { passive: true });


if (container) {
  container.addEventListener('contextmenu', (e) => e.preventDefault());
}
