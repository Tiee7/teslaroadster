
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

function toggleHudMode() {
  state.hudMinimal = !state.hudMinimal;
  const brandBadge = document.getElementById('hud-brand-badge');
  const actionBar = document.getElementById('hud-action-bar');
  const hudLeft = document.getElementById('hud-left');
  const hudRight = document.getElementById('hud-right');
  const hudFooter = document.getElementById('hud-footer');

  // Buttons to hide when HUD is minimized, leaving ONLY #btn-lang and #btn-hud-mode
  const nonMinimalBtnIds = [
    'btn-map-select',
    'btn-physics-mode',
    'btn-plaid-mode',
    'btn-unit-toggle',
    'btn-paint',
    'btn-weather',
    'btn-traffic',
    'btn-camera',
    'btn-camera-zoom',
    'btn-sound',
    'btn-reset',
    'btn-help'
  ];

  if (state.hudMinimal) {
    if (brandBadge) brandBadge.classList.add('hidden');
    if (actionBar) actionBar.classList.add('ml-auto');
    nonMinimalBtnIds.forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.add('hidden');
    });
    if (hudLeft) hudLeft.classList.add('hidden');
    if (hudRight) hudRight.classList.add('hidden');
    // Requirement 3: Retain 600L COPV Air Tank gauge in minimized HUD view
    if (hudFooter) {
      hudFooter.classList.remove('hidden');
      hudFooter.classList.add('hud-minimal-view');
    }
  } else {
    if (brandBadge) brandBadge.classList.remove('hidden');
    if (actionBar) actionBar.classList.remove('ml-auto');
    nonMinimalBtnIds.forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.remove('hidden');
    });
    if (hudLeft) hudLeft.classList.remove('hidden');
    if (hudRight) hudRight.classList.remove('hidden');
    if (hudFooter) {
      hudFooter.classList.remove('hidden');
      hudFooter.classList.remove('hud-minimal-view');
    }
  }
  applyTranslations();
  sound.beep(state.hudMinimal ? 540 : 720, 0.08);
}

// =========================================================================
// 8. INPUT HANDLERS, MAP SELECTION & UI TRANSLATIONS
// =========================================================================
const keys = {};
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

function setKeyState(code, isDown) {
  keys[code] = isDown;
  const badgeId = keyBadgeMap[code];
  if (badgeId) {
    const el = document.getElementById(badgeId);
    if (el) el.classList.toggle('active', isDown);
  }
  if (isDown) sound.init();
}

window.addEventListener('keydown', (e) => {
  // Text entry and the leaderboard dialog must never steer the car or trigger shortcuts.
  if ((e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) || window.RoadsterRanked?.isDialogOpen() || window.RoadsterMusic?.isSettingsOpen()) return;
  if (window.RoadsterTaxi?.handleKeydown(e)) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
  const mapModalEl = document.getElementById('modal-map-select');
  if (mapModalEl && !mapModalEl.classList.contains('hidden') && (e.code === 'Enter' || e.code === 'Space')) {
    switchMap(selectedMapInModal);
    mapModalEl.classList.add('hidden');
    sound.init();
    return;
  }
  if (e.code === 'KeyZ') {
    toggleHudMode();
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
    subEl.textContent = currentLang === 'zh' ? '超音速 370 km/h 音障突破，马赫激波锥全开！' : 'Supersonic 370 km/h Mach 1 barrier broken!';
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
  currentMap = targetMap === 'city' ? 'city' : 'highway';
  selectedMapInModal = currentMap;
  highwayEnvGroup.visible = (currentMap === 'highway');
  cityEnvGroup.visible = (currentMap === 'city');

  const counts = [20, 36, 52];
  populateTraffic(counts[trafficLevelIndex]);
  resetCar();
  applyTranslations();
}

function resetCar() {
  window.RoadsterRanked?.abort('reset');
  clearDebris();
  carMeshGroup.visible = true;
  document.getElementById('modal-destroyed').classList.add('hidden');


  if (typeof headlightSpotL !== 'undefined') headlightSpotL.intensity = 2.4;
  if (typeof headlightSpotR !== 'undefined') headlightSpotR.intensity = 2.4;
  state.speedMilestone = 0;
  state.isDestroyed = false;
  state.hullIntegrity = 100.0;
  state.lastImpactG = 0.0;
  state.impactCooldown = 0.0;

  if (currentMap === 'highway') {
    state.x = 2.5;
    state.y = 0.0;
    state.z = 0.0;
    state.speed = 42.0;
    state.vx = 0.0;
    state.vy = 0.0;
    state.vz = -42.0;
  } else {
    state.x = 5.5;
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
}

function applyTranslations() {
  window.RoadsterTaxi?.render();
  window.RoadsterMusic?.render();
  window.RoadsterRanked?.render();
  const t = I18N[currentLang];
  const hudBtnEl = document.getElementById('ui-hud-mode-btn');
  if (hudBtnEl) hudBtnEl.textContent = state.hudMinimal ? t.hudBtnMinimal : t.hudBtnFull;
  if (document.getElementById('ui-lbl-downforce')) document.getElementById('ui-lbl-downforce').textContent = t.lblDownforce;
  if (document.getElementById('ui-lbl-tire-temp')) document.getElementById('ui-lbl-tire-temp').textContent = t.lblTireTemp;
  if (document.getElementById('ui-lbl-drag-coeff')) document.getElementById('ui-lbl-drag-coeff').textContent = t.lblDragCoeff;
  if (document.getElementById('ui-lbl-gas-mass')) document.getElementById('ui-lbl-gas-mass').textContent = t.lblGasMass;
  document.getElementById('ui-title').textContent = t.title;
  document.getElementById('ui-subtitle').textContent = t.subtitle;
  document.getElementById('lang-label').textContent = t.langToggle;
  document.getElementById('ui-map-btn').textContent = currentMap === 'highway' ? t.mapBtnHighway : t.mapBtnCity;
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
  document.getElementById('ui-traffic-btn').textContent = t.trafficPrefix + t.trafficLevels[trafficLevelIndex];
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
  document.getElementById('ui-tank-burn-time').innerHTML = `${t.burnTimeLabel} <b id="val-burn-used" class="text-slate-200">${state.airUsedContinuous.toFixed(1)}s</b> / 10.0s`;
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
  selectedMapInModal = mapKey;
  cardHighwayEl.classList.toggle('selected', mapKey === 'highway');
  cardCityEl.classList.toggle('selected', mapKey === 'city');
  const isZh = (currentLang === 'zh');
  
  const hwyStatus = document.getElementById('card-hwy-status');
  const cityStatus = document.getElementById('card-city-status');
  if (hwyStatus && cityStatus) {
    if (mapKey === 'highway') {
      hwyStatus.textContent = isZh ? '✓ 已选定' : '✓ SELECTED';
      hwyStatus.className = 'font-bold text-cyan-300';
      cityStatus.textContent = isZh ? '选择 →' : 'SELECT →';
      cityStatus.className = 'text-slate-400 font-normal';
    } else {
      cityStatus.textContent = isZh ? '✓ 已选定' : '✓ SELECTED';
      cityStatus.className = 'font-bold text-indigo-300';
      hwyStatus.textContent = isZh ? '选择 →' : 'SELECT →';
      hwyStatus.className = 'text-slate-400 font-normal';
    }
  }

  const summaryMapEl = document.getElementById('summary-map-chip');
  if (summaryMapEl) {
    summaryMapEl.textContent = mapKey === 'highway' 
      ? (isZh ? '高架高速 (Elevated Highway)' : 'Elevated Highway')
      : (isZh ? '赛博都市 (Mega Cyber Metropolis)' : 'Mega Open-World Cyber Metropolis');
  }
}

cardHighwayEl.addEventListener('click', () => {
  highlightSelectedMapCard('highway');
  sound.beep(520, 0.06);
});

cardCityEl.addEventListener('click', () => {
  highlightSelectedMapCard('city');
  sound.beep(520, 0.06);
});

document.getElementById('btn-launch-selected-map').addEventListener('click', () => {
  switchMap(selectedMapInModal);
  document.getElementById('modal-map-select').classList.add('hidden');
});

function clearAllInputKeys() {
  for (const k in keys) {
    if (keys[k]) setKeyState(k, false);
  }
}

function openMapSelectModal() {
  clearAllInputKeys();
  highlightSelectedMapCard(currentMap);
  document.getElementById('modal-destroyed').classList.add('hidden');
  document.getElementById('modal-map-select').classList.remove('hidden');
}

document.getElementById('btn-map-select').addEventListener('click', openMapSelectModal);
document.getElementById('btn-crash-switch-map').addEventListener('click', openMapSelectModal);
document.getElementById('btn-crash-respawn').addEventListener('click', resetCar);

function selectPaintFinish(idx, playAudio = true) {
  paintIndex = THREE.MathUtils.clamp(idx, 0, PAINT_PRESETS.length - 1);
  const preset = PAINT_PRESETS[paintIndex];
  bodyMaterial.color.setHex(preset.color);
  bodyMaterial.metalness = preset.metalness;
  bodyMaterial.roughness = preset.roughness;
  bodyMaterial.clearcoat = 1.0;
  bodyMaterial.clearcoatRoughness = 0.03;

  const dot = document.getElementById('paint-dot');
  if (dot) dot.className = `w-2.5 h-2.5 rounded-full border border-white ${preset.dotClass}`;
  
  const modalDot = document.getElementById('modal-active-dot');
  if (modalDot) modalDot.className = `w-3 h-3 rounded-full border border-white shadow-[0_0_8px_rgba(255,255,255,0.8)] ${preset.dotClass}`;

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
  const isZh = (currentLang === 'zh');
  grid.innerHTML = '';

  PAINT_PRESETS.forEach((preset, idx) => {
    const isSelected = (idx === paintIndex);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `p-2 rounded-xl text-left transition-all duration-150 flex flex-col justify-between cursor-pointer border ${
      isSelected
        ? 'bg-cyan-950/70 border-cyan-400 ring-2 ring-cyan-400/60 shadow-[0_0_15px_rgba(56,189,248,0.35)] scale-[1.02]'
        : 'bg-slate-950/70 border-slate-800 hover:border-slate-600 hover:bg-slate-900/80 active:scale-95'
    }`;
    
    const nameText = isZh ? preset.nameZh : preset.nameEn;
    const tagText = isZh ? preset.tagZh : preset.tagEn;

    card.innerHTML = `
      <div class="flex items-center justify-between w-full mb-1.5">
        <div class="w-5 h-5 rounded-full border-2 ${isSelected ? 'border-white ring-2 ring-cyan-400' : 'border-slate-500'} ${preset.dotClass} shadow-md" style="background-color: ${preset.hexCode};"></div>
        <span class="text-[9px] mono font-bold px-1 py-0.5 rounded ${isSelected ? 'bg-cyan-500/30 text-cyan-200' : 'bg-slate-800 text-slate-400'}">${tagText}</span>
      </div>
      <div class="text-[11px] font-bold text-slate-100 truncate w-full" title="${nameText}">${nameText}</div>
      <div class="text-[9px] mono mt-0.5 ${isSelected ? 'text-cyan-300 font-bold' : 'text-slate-500'}">${isSelected ? '✓ ' + (isZh ? '当前选定' : 'SELECTED') : (isZh ? '点击应用' : 'CLICK TO APPLY')}</div>
    `;

    card.addEventListener('click', () => {
      selectPaintFinish(idx, true);
    });

    grid.appendChild(card);
  });

  const activeNameEl = document.getElementById('modal-active-paint-name');
  if (activeNameEl) {
    activeNameEl.textContent = isZh ? PAINT_PRESETS[paintIndex].nameZh : PAINT_PRESETS[paintIndex].nameEn;
  }
  const summaryPaintEl = document.getElementById('summary-paint-chip');
  if (summaryPaintEl) {
    summaryPaintEl.textContent = isZh ? PAINT_PRESETS[paintIndex].nameZh : PAINT_PRESETS[paintIndex].nameEn;
  }
}



document.getElementById('btn-physics-mode').addEventListener('click', togglePhysicsMode);
const btnPlaidEl = document.getElementById('btn-plaid-mode');
if (btnPlaidEl) btnPlaidEl.addEventListener('click', togglePlaidMode);
const btnUnitEl = document.getElementById('btn-unit-toggle');
if (btnUnitEl) btnUnitEl.addEventListener('click', toggleSpeedUnit);
const valSpeedUnitEl = document.getElementById('val-speed-unit');
if (valSpeedUnitEl) valSpeedUnitEl.addEventListener('click', toggleSpeedUnit);
document.getElementById('btn-paint').addEventListener('click', () => cyclePaintFinish());
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
  const isZh = (currentLang === 'zh');
  grid.innerHTML = '';

  WEATHER_PRESETS.forEach((wp, idx) => {
    const isSelected = (idx === weatherIndex);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `p-2.5 rounded-xl text-left transition-all duration-150 flex flex-col justify-between cursor-pointer border ${
      isSelected
        ? 'bg-amber-950/60 border-amber-400 ring-2 ring-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
        : 'bg-slate-950/70 border-slate-800 hover:border-slate-600 hover:bg-slate-900/80'
    }`;
    const title = isZh ? wp.nameZh : wp.nameEn;
    const desc = isZh ? wp.descZh : wp.descEn;
    btn.innerHTML = `
      <div class="flex items-center justify-between w-full mb-1">
        <span class="text-xs font-extrabold text-white flex items-center gap-1.5"><span>${wp.icon}</span><span>${title}</span></span>
        <span class="text-[9px] mono font-bold px-1.5 py-0.5 rounded ${isSelected ? 'bg-amber-500/30 text-amber-200' : 'bg-slate-800 text-slate-400'}">${isSelected ? (isZh ? '✓ 已选' : '✓ ACTIVE') : (isZh ? '选择' : 'SELECT')}</span>
      </div>
      <p class="text-[10px] text-slate-300 leading-snug">${desc}</p>
    `;
    btn.addEventListener('click', () => selectWeatherMode(idx, true));
    grid.appendChild(btn);
  });

  const summaryWeatherEl = document.getElementById('summary-weather-chip');
  if (summaryWeatherEl) {
    const wp = WEATHER_PRESETS[weatherIndex];
    summaryWeatherEl.textContent = `${wp.icon} ${isZh ? wp.nameZh : wp.nameEn}`;
  }
}

document.getElementById('btn-weather').addEventListener('click', () => cycleWeatherMode());

document.getElementById('btn-traffic').addEventListener('click', () => {
  window.RoadsterRanked?.abort('traffic');
  trafficLevelIndex = (trafficLevelIndex + 1) % 3;
  const counts = [20, 36, 52];
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
  if (state.isDestroyed || state.isFreefalling || state.airRemaining <= 0.15) return;
  sound.init();
  let groundElev = 0.0;
  if (currentMap === 'city' && typeof cityBuildings !== 'undefined') {
    for (let i = 0; i < cityBuildings.length; i++) {
      const b = cityBuildings[i];
      if (state.x > b.minX - 1.1 && state.x < b.maxX + 1.1 && state.z > b.minZ - 1.8 && state.z < b.maxZ + 1.8) {
        if (state.y >= b.height - 0.55) {
          groundElev = Math.max(groundElev, b.height);
        }
      }
    }
  }
  const currentAgl = Math.max(0.0, state.y - groundElev);
  // Jump to 6.0m above ground/rooftop (or +6.0m if already flying above 5.5m)
  state.jumpStartY = state.y;
  state.jumpTargetY = (currentAgl < 5.5) ? (groundElev + 6.0) : Math.min(MAX_FLIGHT_ALTITUDE, state.y + 6.0);
  state.isJumping6m = true;
  state.isAltitudeHold = false;
  const nBadge = document.getElementById('key-n');
  if (nBadge) nBadge.classList.remove('active');
  const baseClimbVy = (state.physicsMode === 'realistic') ? (6.2 * 1.3) : (28.0 * 1.3);
  state.vy = Math.max(state.vy, baseClimbVy * 2.5);
  showBanner('jump6m', 2.0);
  sound.beep(820, 0.12);
}

function toggleAltitudeHold() {
  if (state.isDestroyed) return;
  sound.init();
  let groundElev = 0.0;
  if (currentMap === 'city' && typeof cityBuildings !== 'undefined') {
    for (let i = 0; i < cityBuildings.length; i++) {
      const b = cityBuildings[i];
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
const windshieldDrops = Array.from({ length: 42 }, () => ({
  x: Math.random(),
  y: Math.random(),
  len: 0.02 + Math.random() * 0.04,
  spd: 0.35 + Math.random() * 0.65
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
  const W = 512, H = 320;

  // Translucent Dark Aerospace Glass Background
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(6, 12, 24, 0.90)';
  ctx.fillRect(0, 0, W, H);

  // Outer Cyan Telemetry Border
  ctx.strokeStyle = mph >= 230 ? '#38bdf8' : 'rgba(56, 189, 248, 0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, W - 8, H - 8);

  // Digital Compass Heading & Cardinal Tape (Top Center)
  const curYawDeg = Math.round(((-THREE.MathUtils.radToDeg(state.yaw) % 360) + 360) % 360);
  const cardinalDirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const cardIndex = Math.round(curYawDeg / 45) % 8;
  const cardStr = cardinalDirs[cardIndex];
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  ctx.fillRect(296, 12, 108, 20);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.strokeRect(296, 12, 108, 20);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`HDG ${String(curYawDeg).padStart(3, "0")}° ${cardStr}`, 350, 26);
  ctx.textAlign = 'left';

  // 1. LEFT PANEL: Digital Speed, Flight Mode & 600L COPV Tank Bar
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 12px "JetBrains Mono", monospace';
  ctx.fillText('TESLA ROADSTER // ROCKET TELEMETRY', 18, 26);

  const isUnitKmh = (state.speedUnit === 'kmh');
  const primarySpeed = isUnitKmh ? kmh : mph;
  const primaryLabel = isUnitKmh ? 'KM/H' : 'MPH';
  const secondaryText = isUnitKmh ? `${mph} MPH` : `${kmh} km/h`;

  ctx.fillStyle = mph >= 230 ? '#38bdf8' : '#ffffff';
  // Canvas accepts numeric weights; "extrabold" silently kept the preceding
  // 12px font, making this readout look different from the synchronized HUD.
  ctx.font = '800 54px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(String(primarySpeed), 122, 86);
  ctx.textAlign = 'left';
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(primaryLabel, 132, 62);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 12px "JetBrains Mono", monospace';
  ctx.fillText(secondaryText, 132, 84);

  // Cockpit Turn Signal Blinkers
  const isTurnLeft = (state.steerInput > 0.12) || Boolean(keys['KeyA']);
  const isTurnRight = (state.steerInput < -0.12) || Boolean(keys['KeyD']);
  const blinkActive = (Math.sin(performance.now() * 0.013) > 0);
  ctx.font = 'bold 15px "JetBrains Mono", monospace';
  ctx.fillStyle = (isTurnLeft && blinkActive) ? '#10b981' : 'rgba(51, 65, 85, 0.45)';
  ctx.fillText('◀', 132, 42);
  ctx.fillStyle = (isTurnRight && blinkActive) ? '#10b981' : 'rgba(51, 65, 85, 0.45)';
  ctx.fillText('▶', 156, 42);

  // Artificial Horizon Pitch & Roll Ladder (Center-Left)
  ctx.save();
  ctx.translate(105, 165);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 48, 0, Math.PI * 2);
  ctx.stroke();

  ctx.rotate(-state.roll);
  const pitchShift = THREE.MathUtils.clamp(Math.sin(state.pitch) * 65, -34, 34);
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-36, pitchShift);
  ctx.lineTo(36, pitchShift);
  ctx.stroke();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-18, pitchShift - 14);
  ctx.lineTo(18, pitchShift - 14);
  ctx.moveTo(-18, pitchShift + 14);
  ctx.lineTo(18, pitchShift + 14);
  ctx.stroke();
  // 3D Velocity Vector / Flight Path Marker (FPM)
  const fpmX = THREE.MathUtils.clamp((state.vx || 0) * 0.45, -28, 28);
  const fpmY = THREE.MathUtils.clamp(-(state.vy || 0) * 0.85, -28, 28);
  ctx.save();
  ctx.translate(105 + fpmX, 165 + fpmY);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-11, 0); ctx.lineTo(-5, 0);
  ctx.moveTo(5, 0); ctx.lineTo(11, 0);
  ctx.moveTo(0, -5); ctx.lineTo(0, -9);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 11px "JetBrains Mono", monospace';
  ctx.fillText(`PITCH ${Math.round(THREE.MathUtils.radToDeg(state.pitch))}°  ROLL ${Math.round(THREE.MathUtils.radToDeg(state.roll))}°`, 38, 232);

  // 600L COPV Air Pressure Bar at Bottom
  const airPct = Math.max(0, Math.min(1, state.airRemaining / MAX_AIR_SECONDS));
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(18, 268, 476, 22);
  const isLowAir = airPct <= 0.20 && airPct > 0.001;
  const pulseAlpha = isLowAir ? (0.7 + 0.3 * Math.sin(performance.now() * 0.015)) : 1.0;
  ctx.fillStyle = state.isFreefalling ? '#ef4444' : (state.isAutoDescending8s ? `rgba(245, 158, 11, ${pulseAlpha})` : '#06b6d4');
  ctx.fillRect(18, 268, 476 * airPct, 22);
  // 8s Auto-Descent threshold line (20%)
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(18 + 476 * 0.20, 264, 3, 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px "JetBrains Mono", monospace';
  ctx.fillText(`600L COPV TANK: ${state.airRemaining.toFixed(1)}s / 10.0s (${Math.round(airPct * 600)}L)`, 26, 284);

  // 2. CENTER-RIGHT PANEL: Live G-Force Ball Meter (G-Meter)
  const gxCenter = 268, gyCenter = 135, gRadius = 58;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 1.5;
  [gRadius, gRadius * 0.62, gRadius * 0.28].forEach((r) => {
    ctx.beginPath();
    ctx.arc(gxCenter, gyCenter, r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.beginPath();
  ctx.moveTo(gxCenter - gRadius, gyCenter);
  ctx.lineTo(gxCenter + gRadius, gyCenter);
  ctx.moveTo(gxCenter, gyCenter - gRadius);
  ctx.lineTo(gxCenter, gyCenter + gRadius);
  ctx.stroke();

  // G-Force Ball position
  const ballX = gxCenter + THREE.MathUtils.clamp(state.lateralG * 14, -gRadius + 8, gRadius - 8);
  const ballY = gyCenter + THREE.MathUtils.clamp(state.longitudinalG * 14, -gRadius + 8, gRadius - 8);
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(ballX, ballY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Peak G-Force retention ring indicator
  if (!state.peakGPos) state.peakGPos = { x: 0, y: 0, mag: 0 };
  const currentGMag = Math.hypot(state.lateralG || 0, state.longitudinalG || 0);
  if (currentGMag >= state.peakGPos.mag || (state.peakGTimer || 0) <= 0) {
    state.peakGPos = {
      x: state.lateralG || 0,
      y: state.longitudinalG || 0,
      mag: currentGMag
    };
    state.peakGTimer = 2.4;
  }
  if (state.peakGPos.mag > 0.3) {
    const peakX = gxCenter + THREE.MathUtils.clamp(state.peakGPos.x * 14, -gRadius + 8, gRadius - 8);
    const peakY = gyCenter + THREE.MathUtils.clamp(state.peakGPos.y * 14, -gRadius + 8, gRadius - 8);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(peakX, peakY, 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  const totalG = Math.hypot(state.longitudinalG, state.lateralG, 1.0);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 12px "JetBrains Mono", monospace';
  ctx.fillText(`G-FORCE: ${totalG.toFixed(1)}G`, gxCenter - 44, gyCenter + gRadius + 20);
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 10px "JetBrains Mono", monospace';
  ctx.fillText(`PEAK: ${(state.peakGPos ? state.peakGPos.mag : 0).toFixed(1)}G`, gxCenter - 28, gyCenter - gRadius - 8);

  // 3. RIGHT PANEL: 10-Nozzle SpaceX Cold-Gas Firing Topology Diagram
  const nxCenter = 422, nyCenter = 135;
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2;
  ctx.strokeRect(nxCenter - 34, nyCenter - 64, 68, 128);
  ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
  ctx.fillRect(nxCenter - 32, nyCenter - 62, 64, 124);

  const drawNozzleIndicator = (dx, dy, isFiring, col = '#38bdf8') => {
    ctx.fillStyle = isFiring ? col : '#334155';
    ctx.beginPath();
    ctx.arc(nxCenter + dx, nyCenter + dy, isFiring ? 6.5 : 4.5, 0, Math.PI * 2);
    ctx.fill();
    if (isFiring) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  };
  // 2 Front Retro Nozzles
  drawNozzleIndicator(-14, -58, isFrontRetroFiring, '#38bdf8');
  drawNozzleIndicator(14, -58, isFrontRetroFiring, '#38bdf8');
  // 4 Underbody Lift Nozzles
  drawNozzleIndicator(-24, -26, isLiftFiring, '#2dd4bf');
  drawNozzleIndicator(24, -26, isLiftFiring, '#2dd4bf');
  drawNozzleIndicator(-24, 26, isLiftFiring, '#2dd4bf');
  drawNozzleIndicator(24, 26, isLiftFiring, '#2dd4bf');
  // 2 Lateral RCS Attitude Nozzles
  drawNozzleIndicator(-32, 0, rcsRollPitchActive || rcsYawRetroActive, '#f59e0b');
  drawNozzleIndicator(32, 0, rcsRollPitchActive || rcsYawRetroActive, '#f59e0b');
  // 4 Rear 80kN Supersonic Nozzles
  [-21, -7, 7, 21].forEach((rx) => {
    drawNozzleIndicator(rx, 60, rearActive, '#0ea5e9');
  });

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 11px "JetBrains Mono", monospace';
  ctx.fillText('10 RCS TOPOLOGY', nxCenter - 48, nyCenter + 84);

  // Dynamic Battery Power Output (kW) & Flow Readout
  const accelVal = Math.abs(state.longitudinalG || 0) * 9.81;
  const powerKw = Math.min(1250, Math.round((accelVal * VEHICLE_MASS_KG * (Math.abs(state.speed) + 2.0)) / 1000));
  const isRegen = Boolean(keys["KeyH"]) && state.speed > 2.0;
  ctx.fillStyle = isRegen ? '#10b981' : '#38bdf8';
  ctx.font = 'bold 12px "JetBrains Mono", monospace';
  ctx.fillText(isRegen ? `REGEN: -${Math.round(powerKw * 0.45)} kW` : `POWER: ${powerKw} kW`, 18, 108);
  const socPct = THREE.MathUtils.clamp(98 - Math.round((state.carsCleared || 0) * 0.15), 72, 100);
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 11px "JetBrains Mono", monospace';
  ctx.fillText(`BATT: ${socPct}% // 200 kWh PACK`, 18, 126);
  ctx.fillStyle = (state.tireTemp > 80) ? '#f59e0b' : '#38bdf8';
  ctx.fillText(`TIRE: ${Math.round(state.tireTemp || 35)}°C (μ ${(state.tireGripMu || 1.0).toFixed(2)}) // AERO: ${state.downforceN || 0} N`, 18, 144);
  ctx.fillText(`CD: ${(state.dragCoeffCd || 0.34).toFixed(2)} // GAS: ${(state.gasMassKg || 144.0).toFixed(1)} kg`, 18, 162);

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

  // 2. Windshield Rain Streaks when in Cyber Neon Rain (weatherIndex === 1)
  if (weatherIndex === 1) {
    vfxCtx.strokeStyle = 'rgba(125, 211, 252, 0.38)';
    vfxCtx.lineWidth = 1.5;
    const speedFactor = 1.0 + (mph / 120.0) * 2.2;
    windshieldDrops.forEach((d) => {
      d.y += d.spd * speedFactor * dt;
      d.x += (d.x - 0.5) * 0.45 * speedFactor * dt;
      if (d.y > 1.05 || d.x < -0.05 || d.x > 1.05) {
        d.x = 0.15 + Math.random() * 0.70;
        d.y = Math.random() * 0.35;
      }
      const sx = d.x * W;
      const sy = d.y * H;
      const ex = sx + (d.x - 0.5) * 28 * speedFactor;
      const ey = sy + d.len * H * speedFactor;
      vfxCtx.beginPath();
      vfxCtx.moveTo(sx, sy);
      vfxCtx.lineTo(ex, ey);
      vfxCtx.stroke();
    });
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
  for (const k in keys) {
    if (keys[k]) setKeyState(k, false);
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
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
