// Main-canvas context loss is a safety pause, not a collision/rendering fix.
// Native Three may stop submitting frames while ordinary RAF physics continues.
(() => {
  if (window.RoadsterRenderHealth) return;
  const canvas = renderer.domElement;
  const dialog = document.getElementById('render-health-overlay');
  const title = document.getElementById('render-health-title');
  const message = document.getElementById('render-health-message');
  const button = document.getElementById('render-health-resume');
  let paused = false, phase = 'ready', losses = 0, restorations = 0, returnFocus = null;
  const heldUntilRelease = new Set();
  const contextLost = () => {
    try { return renderer.getContext?.().isContextLost?.() === true; } catch (_) { return false; }
  };
  function clearInput() {
    try { if (typeof clearAllInputKeys === 'function') { clearAllInputKeys(); return; } } catch (_) {}
    if (typeof keys !== 'undefined') for (const code of Object.keys(keys)) keys[code] = false;
    window.RoadsterTouch?.clear?.();
  }
  function resetTime() {
    window.RoadsterCityFrame?.reset?.();
    window.RoadsterCoastFrame?.reset?.();
    // Also discard the interval since the most recent paused RAF on resume.
    if (typeof lastTime !== 'undefined') lastTime = performance.now();
  }
  function mute() {
    if (typeof sound !== 'undefined') sound.update(0, false, false, true);
  }
  function show() {
    const zh = typeof currentLang !== 'undefined' && currentLang === 'zh';
    if (title) title.textContent = zh ? '画面中断，驾驶已暂停' : 'Graphics interrupted — driving paused';
    if (message) message.textContent = phase === 'lost'
      ? (zh ? 'WebGL 图形上下文已丢失。车辆停止模拟，正在等待图形恢复；不会在看不到画面时继续驾驶。'
        : 'The WebGL graphics context was lost. Driving simulation is paused while graphics recover.')
      : (zh ? '图形上下文已恢复，驾驶仍暂停。控制输入已清空；准备好后，请点「继续驾驶」。'
        : 'The graphics context was restored. Driving is still paused and controls are cleared. Continue only when you are ready.');
    if (button) { button.disabled = phase !== 'awaiting-resume'; button.textContent = zh ? '继续驾驶' : 'Continue driving'; }
    if (!dialog) return;
    dialog.hidden = false;
    if (!dialog.open) {
      try { dialog.showModal(); } catch (_) { dialog.setAttribute('open', ''); }
    }
    (phase === 'awaiting-resume' ? button : dialog)?.focus?.();
  }
  function lose(event) {
    // This listener belongs only to the main renderer, never the studio preview.
    event?.preventDefault?.();
    if (phase !== 'lost') losses++;
    if (!paused) returnFocus = document.activeElement;
    paused = true; phase = 'lost';
    if (typeof keys !== 'undefined') for (const code of Object.keys(keys)) if (keys[code]) heldUntilRelease.add(code);
    window.RoadsterDemo?.stop?.();
    clearInput(); resetTime(); mute(); show();
  }
  function restored() {
    if (!paused) return;
    restorations++; phase = 'awaiting-resume';
    clearInput(); resetTime(); mute(); show();
  }
  function resume() {
    if (!paused || phase !== 'awaiting-resume' || document.hidden) return;
    if (contextLost()) { lose(); return; }
    clearInput(); resetTime(); mute();
    paused = false; phase = 'ready';
    dialog?.close?.();
    if (dialog) dialog.hidden = true;
    if (returnFocus?.isConnected) returnFocus.focus?.();
    returnFocus = null;
  }
  canvas.addEventListener('webglcontextlost', lose);
  canvas.addEventListener('webglcontextrestored', restored);
  button?.addEventListener('click', resume);
  dialog?.addEventListener('cancel', event => { if (paused) event.preventDefault(); });
  // A held driving key must not accumulate again behind the modal. Native
  // button activation and modal Tab navigation remain available after restore.
  window.addEventListener('keydown', event => {
    if (heldUntilRelease.has(event.code)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (!paused) return;
    const buttonActivation = phase === 'awaiting-resume' && event.target === button && (event.key === 'Enter' || event.key === ' ');
    // Keep native default actions, but do not let the existing game listener
    // prevent Space activation or turn this interface key into driving input.
    if (event.key === 'Tab' || buttonActivation) { event.stopImmediatePropagation(); return; }
    if (event.code) heldUntilRelease.add(event.code);
    event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  window.addEventListener('keyup', event => { heldUntilRelease.delete(event.code); }, true);
  window.RoadsterRenderHealth = Object.freeze({
    isPaused() { if (!paused && contextLost()) lose(); return paused; },
    snapshot: () => ({ paused, phase, losses, restorations, contextLost: contextLost() })
  });
  // Loaded after physics and before onload starts RAF. The original owner
  // schedules the current animate binding, so every subsequent RAF is gated
  // without changing the pinned physics source or its numerical kernel.
  const runFrame = animate;
  animate = function (now) {
    if (!window.RoadsterRenderHealth.isPaused()) return runFrame.apply(this, arguments);
    requestAnimationFrame(animate);
    lastTime = now;
    cityFrameClock.clear(); coastFrameClock.clear();
    citySoundFrame = coastSoundFrame = null;
    coastVisualSeconds = 0;
    openWorldRenderMap = openWorldRenderActive = null;
    mute();
  };
})();
