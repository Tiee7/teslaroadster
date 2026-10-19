// Mobile input owns its pointers separately from keyboard keys. A resting thumb
// is always neutral; only a deliberate drag outside the dead zone drives.
(function () {
  'use strict';
  const root = document.getElementById('mobile-controls');
  if (!root || typeof window.matchMedia !== 'function') return;
  const coarse = window.matchMedia('(pointer: coarse)');
  const modeSelect = document.getElementById('mobile-stick-mode');
  const modes = ['lift', 'attitude', 'boost'];
  const deadzone = 0.14;
  const sticks = ['left', 'right'].map(side => ({
    side, element: document.getElementById(`mobile-stick-${side}`),
    pointerId: null, x: 0, y: 0, reverse: null
  }));
  let mode = 'lift';

  function blocked() {
    return document.hidden || (typeof state !== 'undefined' && state.isDestroyed) ||
      document.body.dataset.hudMode === 'minimal' ||
      ['modal-map-select', 'modal-help', 'modal-destroyed'].some(id => {
        const node = document.getElementById(id);
        return node && !node.classList.contains('hidden');
      }) || ['ranked-dialog', 'audio-settings', 'paint-picker'].some(id => document.getElementById(id)?.open);
  }

  function render(stick) {
    const radius = Math.max(1, stick.element.getBoundingClientRect().width * 0.32);
    stick.element.style.setProperty('--stick-x', `${stick.x * radius}px`);
    stick.element.style.setProperty('--stick-y', `${-stick.y * radius}px`);
    stick.element.classList.toggle('is-held', stick.pointerId !== null);
  }

  function release(stick) {
    const pointer = stick.pointerId;
    const changed = pointer !== null || stick.x !== 0 || stick.y !== 0 || stick.reverse !== null;
    // Null ownership before releasePointerCapture, which can synchronously fire
    // lostpointercapture. Repeated cleanup must be harmless.
    stick.pointerId = null;
    stick.x = stick.y = 0;
    stick.reverse = null;
    if (pointer !== null) {
      try { stick.element.releasePointerCapture(pointer); } catch (_) {}
    }
    if (changed) render(stick);
  }

  function clear() { sticks.forEach(release); }

  function sync() {
    const enabled = coarse.matches && !blocked();
    if (!enabled) clear();
    // Physics may read this twice per frame. Avoid repeat attribute writes or
    // measuring idle pads, especially on fine-pointer desktop devices.
    if (root.hidden === enabled) root.hidden = !enabled;
    const capability = coarse.matches ? 'true' : 'false';
    if (document.body.dataset.mobileControls !== capability) document.body.dataset.mobileControls = capability;
    return enabled;
  }

  function update(stick, event) {
    const box = stick.element.getBoundingClientRect();
    const radius = Math.max(1, box.width * 0.32);
    // The down event only claims the pad. The first drag is measured from that
    // thumb's resting position, so even an off-centre resting touch is neutral.
    const dx = (event.clientX - stick.originX) / radius;
    const dy = (stick.originY - event.clientY) / radius;
    const magnitude = Math.hypot(dx, dy);
    const normalized = Math.min(1, Math.max(0, (magnitude - deadzone) / (1 - deadzone)));
    stick.x = magnitude ? dx / magnitude * normalized : 0;
    stick.y = magnitude ? dy / magnitude * normalized : 0;
    // Per-axis dead zone also keeps an approximately horizontal steering drag
    // from requesting a tiny amount of unwanted throttle or braking.
    if (Math.abs(dx) <= deadzone) stick.x = 0;
    if (Math.abs(dy) <= deadzone) stick.y = 0;
    if (stick.side === 'left') {
      if (stick.y >= 0) stick.reverse = null;
      else if (stick.reverse === null) {
        // A forward braking pull never turns into reverse when speed reaches
        // zero. Centre/release and pull again to deliberately re-arm reverse.
        stick.reverse = typeof state !== 'undefined' && !state.wasAirborne && !state.isJumping6m &&
          Math.max(Math.abs(state.speed), Math.hypot(state.vx || 0, state.vy || 0, state.vz || 0)) <= 0.35;
      }
    }
    render(stick);
  }

  sticks.forEach(stick => {
    stick.element.addEventListener('pointerdown', event => {
      if (!sync() || stick.pointerId !== null || event.pointerType === 'mouse' || event.button > 0 ||
          sticks.some(other => other.pointerId === event.pointerId)) return;
      event.preventDefault();
      stick.pointerId = event.pointerId;
      stick.originX = event.clientX;
      stick.originY = event.clientY;
      try { stick.element.setPointerCapture(event.pointerId); } catch (_) { release(stick); return; }
      render(stick);
      if (typeof sound !== 'undefined') sound.init();
    });
    stick.element.addEventListener('pointermove', event => {
      if (stick.pointerId !== event.pointerId) return;
      if (!sync()) return;
      event.preventDefault();
      update(stick, event);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
      stick.element.addEventListener(type, event => {
        if (stick.pointerId === event.pointerId) release(stick);
      });
    });
    stick.element.addEventListener('contextmenu', event => event.preventDefault());
  });

  function readInput() {
    if (!sync()) return {};
    const [left, right] = sticks;
    return {
      steer: left.x, throttle: Math.max(0, left.y),
      brake: left.reverse ? 0 : Math.max(0, -left.y),
      reverse: left.reverse ? Math.max(0, -left.y) : 0,
      lift: mode === 'lift' ? Math.max(0, right.y) : 0,
      descend: mode === 'lift' ? Math.max(0, -right.y) : 0,
      strafe: mode !== 'attitude' ? right.x : 0,
      roll: mode === 'attitude' ? -right.x : 0,
      pitch: mode === 'attitude' ? right.y : 0,
      boost: mode === 'boost' ? Math.max(0, right.y) : 0,
      handbrake: mode === 'boost' ? Math.max(0, -right.y) : 0
    };
  }

  function setLanguage() {
    const zh = typeof currentLang !== 'undefined' && currentLang === 'zh';
    const text = zh ? {
      drive: '转向 · 油门 / 刹车', lift: '升降', attitude: '姿态', boost: '喷气',
      liftHint: '↑ 升空 · ↓ 下降 · ↔ 平移', attitudeHint: '↕ 俯仰 · ↔ 横滚', boostHint: '↑ 喷气 · ↓ 漂移 · ↔ 平移',
      jump: '跳跃', hold: '定高', camera: '视角', reset: '重置', label: '右摇杆模式',
      helpTitle: '手机双摇杆',
      help: '左摇杆：左右转向（空中偏航），上推加速，下拉刹车。停稳后回中再下拉可倒车。右摇杆切换：升降＝上升／下降、左右平移；姿态＝上下俯仰、左右横滚；喷气＝上推尾部喷气、下拉手刹漂移、左右平移。移动幅度控制力度，松手即回中；切换模式后需重新触摸。两根手指可同时独立操作。定高是持续耗气的开关，再点一次取消。'
    } : {
      drive: 'STEER · DRIVE / BRAKE', lift: 'Lift', attitude: 'Attitude', boost: 'Boost',
      liftHint: '↑ Lift · ↓ Descend · ↔ Strafe', attitudeHint: '↕ Pitch · ↔ Roll', boostHint: '↑ Jet · ↓ Drift · ↔ Strafe',
      jump: 'Jump', hold: 'Hold', camera: 'View', reset: 'Reset', label: 'Right stick mode',
      helpTitle: 'Mobile dual sticks',
      help: 'Left: steer (yaw in flight), push up to accelerate, pull down to brake. Once stopped, centre then pull down again to reverse. Right modes: Lift = ascend/descend and sideways strafe; Attitude = pitch and roll; Boost = push up for the rear jet, down for handbrake drift, sideways to strafe. Drag farther for more power. Release to centre; changing modes requires a fresh touch. Use two fingers independently. Hold toggles altitude hold, which keeps using air until tapped again.'
    };
    document.getElementById('mobile-left-label').textContent = text.drive;
    sticks[0].element.setAttribute('aria-label', text.drive);
    sticks[1].element.setAttribute('aria-label', text[mode] + ': ' + text[mode + 'Hint']);
    modeSelect.setAttribute('aria-label', text.label);
    [...modeSelect.options].forEach(option => { option.textContent = text[option.value]; });
    document.getElementById('mobile-right-hint').textContent = text[mode + 'Hint'];
    ['jump', 'hold', 'camera', 'reset'].forEach(action => {
      const button = document.getElementById(`mobile-${action}`);
      button.textContent = text[action];
      button.setAttribute('aria-label', text[action]);
    });
    document.getElementById('mobile-help-title').textContent = text.helpTitle;
    document.getElementById('mobile-help-copy').textContent = text.help;
  }

  modeSelect.addEventListener('pointerdown', clear);
  modeSelect.addEventListener('focus', clear);
  modeSelect.addEventListener('change', () => {
    clear();
    mode = modes.includes(modeSelect.value) ? modeSelect.value : 'lift';
    modeSelect.value = mode;
    setLanguage();
  });
  const actions = {
    jump: () => { if (typeof triggerJump6m === 'function') triggerJump6m(); },
    hold: () => { if (typeof toggleAltitudeHold === 'function') toggleAltitudeHold(); },
    camera: () => document.getElementById('btn-camera')?.click(),
    reset: () => { if (typeof resetCar === 'function') resetCar(); }
  };
  Object.entries(actions).forEach(([action, run]) => {
    document.getElementById(`mobile-${action}`).addEventListener('click', () => {
      if (!sync()) return;
      if (action === 'reset') clear();
      run();
    });
  });

  window.addEventListener('blur', clear);
  window.addEventListener('pagehide', clear);
  document.addEventListener('visibilitychange', () => { clear(); sync(); });
  ['resize', 'orientationchange'].forEach(type => window.addEventListener(type, () => { clear(); sync(); }));
  window.visualViewport?.addEventListener('resize', clear);
  window.screen?.orientation?.addEventListener('change', clear);
  if (coarse.addEventListener) coarse.addEventListener('change', () => { clear(); sync(); });
  else coarse.addListener?.(() => { clear(); sync(); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-hud-mode'] });
    ['modal-map-select', 'modal-help', 'modal-destroyed', 'ranked-dialog', 'audio-settings', 'paint-picker'].forEach(id => {
      const node = document.getElementById(id);
      if (node) observer.observe(node, { attributes: true, attributeFilter: ['class', 'hidden', 'open'] });
    });
  }
  window.RoadsterTouch = { readInput, clear, sync, setLanguage };
  setLanguage();
  sync();
})();
