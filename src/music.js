// One persistent HTML media player, independent of WebGL and the synthesized SFX.
// Keep this module before world.js so settings still work if 3D initialization fails.
(() => {
  if (window.RoadsterMusic) return;
  const audio = document.getElementById('roadster-bgm');
  const dialog = document.getElementById('audio-settings');
  const openButton = document.getElementById('btn-settings');
  const mapOpenButton = document.getElementById('btn-map-audio-settings');
  const toggleButton = document.getElementById('music-toggle');
  const engineToggleButton = document.getElementById('engine-sound-toggle');
  const storageKey = 'roadster.bgm.enabled.v1';
  let enabled = true;
  try { enabled = localStorage.getItem(storageKey) !== 'false'; } catch (_) {}
  let unlocked = false;
  let pageSuspended = false;
  let pending = null;
  let requestId = 0;
  let failed = false;
  let returnFocus = openButton;
  audio.loop = true;
  audio.volume = 0.35;

  const shouldPlay = () => enabled && unlocked && !document.hidden && !pageSuspended;
  function render() {
    const zh = currentLang === 'zh';
    openButton.textContent = zh ? '⚙ 设置' : '⚙ Settings';
    mapOpenButton.textContent = zh ? '⚙ 声音设置' : '⚙ Audio settings';
    document.getElementById('audio-settings-title').textContent = zh ? '声音设置' : 'Audio settings';
    document.getElementById('audio-settings-close').textContent = zh ? '返回游戏' : 'Back to game';
    document.getElementById('engine-sound-label').textContent = zh ? '模拟音浪' : 'Simulated engine sound';
    engineToggleButton.textContent = zh
      ? `模拟音浪：${sound.simulatedEngineEnabled ? '开启' : '关闭'}`
      : `Engine sound: ${sound.simulatedEngineEnabled ? 'On' : 'Off'}`;
    engineToggleButton.setAttribute('aria-pressed', String(sound.simulatedEngineEnabled));
    document.getElementById('engine-sound-note').textContent = zh
      ? '关闭后不播放发动机模拟声。其他音效和背景音乐独立控制；此浏览器会记住你的选择。'
      : 'Turn off the simulated motor hum. Other sound effects and music keep their separate controls. Your choice is saved in this browser.';
    document.getElementById('music-label').textContent = zh ? '常驻背景音乐 · 循环播放' : 'Background music · loop';
    document.getElementById('music-note').textContent = zh
      ? 'Ludicrous Velocity · 暂停后从原位置继续；此浏览器会记住你的选择。车辆音效由顶部音效按钮独立控制。'
      : 'Ludicrous Velocity · Resume from the paused position. Your choice is saved in this browser. Vehicle sound effects have their own top-bar control.';
    // A failed/blocked play remains enabled, but the next explicit click retries it.
    toggleButton.textContent = failed ? (zh ? '播放音乐' : 'Play music')
      : enabled ? (zh ? '暂停音乐' : 'Pause music') : (zh ? '继续播放' : 'Resume music');
    toggleButton.setAttribute('aria-pressed', String(enabled));
    document.getElementById('music-status').textContent = !enabled ? (zh ? '已暂停' : 'Paused')
      : failed ? (zh ? '播放未开始，请点「播放音乐」重试。' : 'Playback did not start. Tap Play music to retry.')
      : !audio.paused ? (zh ? '正在循环播放' : 'Playing on repeat')
      : pending !== null ? (zh ? '正在加载音乐…' : 'Loading music…')
      : (zh ? '点击或按键后开始播放；切到后台时会暂时暂停。' : 'Starts after a tap or keypress. Pauses while this page is in the background.');
  }
  function pause() {
    requestId++;
    pending = null;
    audio.pause(); // Do not mute or reset currentTime: resume keeps the same position.
    render();
  }
  function play() {
    if (!shouldPlay() || !audio.paused || pending !== null) return;
    const id = ++requestId;
    pending = id;
    failed = false;
    render();
    try {
      if (audio.error) audio.load();
      Promise.resolve(audio.play()).then(() => {
        if (pending === id) pending = null;
        // A late play promise must not undo a pause or a background transition.
        if (!shouldPlay()) audio.pause();
        render();
      }, () => {
        if (requestId !== id) return;
        pending = null;
        failed = true;
        render();
      });
    } catch (_) {
      pending = null;
      failed = true;
      render();
    }
  }
  function gesture(event) {
    // Let this button make one deliberate pause/resume/retry decision on click.
    if (!event.isTrusted || event.target === toggleButton) return;
    unlocked = true;
    play();
  }
  // Keep listeners after an autoplay rejection so the next real gesture can retry.
  for (const type of ['pointerdown', 'keydown', 'click']) {
    document.addEventListener(type, gesture, { capture: true, passive: true });
  }
  toggleButton.addEventListener('click', (event) => {
    if (event.isTrusted) unlocked = true;
    enabled = !enabled || failed;
    failed = false;
    try { localStorage.setItem(storageKey, String(enabled)); } catch (_) {}
    if (enabled) play(); else pause();
    render();
  });
  engineToggleButton.addEventListener('click', () => {
    sound.setSimulatedEngineEnabled(!sound.simulatedEngineEnabled);
    render();
  });
  function openSettings(event) {
    returnFocus = event.currentTarget;
    // Function declarations may exist even after a failed WebGL startup.
    try { if (typeof clearAllInputKeys === 'function') clearAllInputKeys(); } catch (_) {}
    render();
    if (!dialog.open) dialog.showModal();
  }
  openButton.addEventListener('click', openSettings);
  mapOpenButton.addEventListener('click', openSettings);
  document.getElementById('audio-settings-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => returnFocus.focus());
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else play(); });
  window.addEventListener('pagehide', () => { pageSuspended = true; pause(); });
  window.addEventListener('pageshow', () => { pageSuspended = false; play(); });
  for (const type of ['playing', 'pause', 'waiting']) audio.addEventListener(type, render);
  audio.addEventListener('error', () => { failed = true; pending = null; render(); });
  window.RoadsterMusic = { render, isSettingsOpen: () => dialog.open };
  render();
})();
