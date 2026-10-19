// Opt-in, browser-scoped 60-second ranked runs. Sandbox play stays local.
(() => {
  'use strict';
  const DURATION = 60000;
  const categories = ['highway-realistic', 'highway-fantasy', 'city-realistic', 'city-fantasy'];
  const $ = (id) => document.getElementById(id);
  const dialog = $('ranked-dialog');
  if (!dialog) return;
  const copy = {
    en: {
      button: '🏁 Leaderboard', title: '60-second challenge', close: 'Close leaderboard',
      language: '中文', category: 'Public leaderboard', current: 'Challenge category',
      nickname: 'Public nickname', nicknameHint: '1–20 letters/numbers, spaces, _ or -; start with a letter/number. This name is public. Don’t use private information.',
      privacy: 'No account needed. An anonymous cookie identifies this browser. Your best score per category stays on this browser identity; clearing cookies or changing browsers creates a new identity. Only the nickname and score are shown publicly.',
      rules: '60 real-time seconds. Score = HUD score (points + vehicles cleared × 10). Each run resets the car, score, tires and gas, with 36 vehicles, Cyber Night, Plaid OFF and stabilizer ON. Your map and physics mode set the category. Reset, map/mode, weather, traffic, Plaid or stabilizer changes cancel a running challenge. Leaving the tab or window also cancels it. A crash immediately cancels the run without publishing a score; you can restart once the server confirms it has ended.',
      trust: 'Casual v1: server-issued timed runs and basic checks. Scores come from the browser; this leaderboard is not cheat-proof.',
      baseline: 'Starts fresh: 36 vehicles · Cyber Night · Plaid OFF · Stabilizer ON. Crashes and cancellations end the server run before your next challenge.',
      activeError: 'A run is already reserved for this browser. Wait 65 seconds after the last start, then try again.',
      start: 'Start 60-second challenge', starting: 'Starting…', abort: 'Cancel challenge', refresh: 'Refresh board',
      submit: 'Submit public score', retry: 'Retry same score', submitting: 'Submitting…', discard: 'Discard result',
      rank: 'Rank', name: 'Nickname', score: 'Score', empty: 'No scores yet. Set the first one!',
      loading: 'Loading leaderboard…', boardError: 'Leaderboard unavailable. Try Refresh.',
      idle: 'Sandbox • challenge is optional', running: 'Ranked challenge', crash: 'Vehicle crashed',
      done: 'Time! Score ready to submit', cancelled: 'Challenge cancelled',
      reset: 'Car reset', map: 'Map changed', physics: 'Physics mode changed', weather: 'Weather changed',
      traffic: 'Traffic changed', plaid: 'Plaid setting changed', stabilizer: 'Stabilizer changed',
      hidden: 'Tab or window left', closed: 'Start cancelled', invalid: 'Challenge settings changed',
      invalidName: 'Use 1–20 Unicode letters/numbers, spaces, _ or -, starting with a letter/number. Choose a public nickname.',
      startError: 'Could not start the challenge. No score was submitted. Try again when connected.',
      endError: 'The server has not confirmed the previous challenge ended. Start again to retry ending it first.',
      submitError: 'Submission not confirmed. Your exact result is kept. Retry sends the same run and score.',
      rejected: 'The server did not accept this run. Your result is kept; check the message before retrying.',
      saved: 'Score accepted', improved: 'New personal best!', unchanged: 'Your previous best stays',
      best: 'Best', position: 'Rank', outside: 'Outside top 100', seconds: 'seconds left',
      result: 'Completed score', lockedName: 'The nickname is fixed for this run.', pending: 'Finish or discard the saved result before starting another challenge.',
      inProgress: 'Countdown continues while this panel is open. Close it to drive.',
      settings: 'Choose the map and physics mode in the simulator before starting.',
      highway: 'Elevated Highway', city: 'Cyber City', realistic: 'Realistic', fantasy: 'Fantasy',
      errorCode: 'Server response', unavailable: 'Ranked play needs the online leaderboard service.',
    },
    zh: {
      button: '🏁 排行榜', title: '60 秒挑战', close: '关闭排行榜',
      language: 'EN', category: '公开排行榜', current: '挑战分组',
      nickname: '公开昵称', nicknameHint: '1–20 个文字、数字、空格、_ 或 -，以文字或数字开头。昵称公开，请勿填写隐私信息。',
      privacy: '无需注册。匿名 Cookie 用于识别本浏览器，每个分组保存你的最高分。清除 Cookie 或更换浏览器会成为新的身份。公开榜单只显示昵称与分数。',
      rules: '挑战持续真实时间 60 秒。分数＝HUD 得分（积分＋超越车辆数 × 10）。每次重置车辆、得分、轮胎与气体，统一为 36 辆车、星际暗夜、狂暴关闭、自动回正开启。地图与物理模式决定分组。挑战中重置车辆、更改地图、模式、天气、车流、狂暴或自动回正都会取消挑战；离开标签页或窗口也会取消。撞毁后立即向服务器取消挑战，不提交分数；服务器确认结束后即可重开。',
      trust: '休闲版 v1：服务器签发限时挑战并做基础校验。得分由浏览器上报，无法完全防作弊。',
      baseline: '统一重开：36 辆车 · 星际暗夜 · 狂暴关闭 · 自动回正开启。撞毁或取消会结束服务器挑战，确认后即可重开。',
      activeError: '此浏览器已有预留挑战，请在上次启动后等待 65 秒再重试。',
      start: '开始 60 秒挑战', starting: '启动中…', abort: '取消挑战', refresh: '刷新榜单',
      submit: '提交公开分数', retry: '重试同一分数', submitting: '提交中…', discard: '放弃此成绩',
      rank: '名次', name: '昵称', score: '分数', empty: '暂无成绩，来创造第一个纪录！',
      loading: '正在加载排行榜…', boardError: '暂时无法加载榜单，请刷新重试。',
      idle: '自由驾驶 · 挑战可选', running: '排位挑战', crash: '车辆已撞毁',
      done: '时间到！可提交成绩', cancelled: '挑战已取消',
      reset: '车辆已重置', map: '地图已更改', physics: '物理模式已更改', weather: '天气已更改',
      traffic: '车流已更改', plaid: '狂暴设置已更改', stabilizer: '自动回正已更改',
      hidden: '已离开标签页或窗口', closed: '已取消启动', invalid: '挑战设置已更改',
      invalidName: '请使用 1–20 个 Unicode 文字、数字、空格、_ 或 -，以文字或数字开头，并选择适合公开的昵称。',
      startError: '无法启动挑战，尚未提交分数。联网后可重试。',
      endError: '服务器尚未确认上次挑战已结束。再次点击开始会先重试结束旧挑战。',
      submitError: '未确认提交成功。已保留完整成绩，重试只会发送同一挑战和分数。',
      rejected: '服务器未接受此挑战。成绩已保留，请查看提示后再重试。',
      saved: '成绩已接受', improved: '个人新纪录！', unchanged: '保留此前最高分',
      best: '最高分', position: '名次', outside: '百名之外', seconds: '秒剩余',
      result: '本次成绩', lockedName: '本次挑战的昵称已锁定。', pending: '请先提交或放弃保留的成绩，再开始新挑战。',
      inProgress: '此面板打开时仍继续计时，关闭后可驾驶。',
      settings: '请先在模拟器中选择地图与物理模式。',
      highway: '高架高速', city: '赛博都市', realistic: '常规物理', fantasy: '幻想模式',
      errorCode: '服务器响应', unavailable: '排位挑战需要连接在线排行榜服务。',
    }
  };
  let normalizing = false;
  let phase = 'idle'; // idle, starting, running, complete, submitting, submitted, aborted
  let run = null;
  let result = null;
  let deadline = 0;
  const pendingEnds = new Map();
  let pendingStart = Promise.resolve();
  let requestVersion = 0;
  let boardVersion = 0;
  let reason = '';
  let error = '';
  let errorType = '';
  let savedReply = null;
  let returnFocus = null;
  let lastSecond = -1;
  let boardState = 'empty';
  let boardRows = [];
  let boardLoaded = false;
  let hudDismissed = false;
  const t = () => copy[currentLang === 'zh' ? 'zh' : 'en'];
  const category = () => `${currentMap}-${state.physicsMode}`;
  const score = () => Math.max(0, Math.round(state.score + state.carsCleared * 10));
  const categoryName = (value) => value.split('-').map((key) => t()[key] || key).join(' · ');
  const isInFlight = () => phase === 'starting' || phase === 'running';
  const isSaved = () => phase === 'complete' || phase === 'submitting';

  try { $('ranked-nickname').value = localStorage.getItem('roadster-public-nickname') || ''; } catch (_) {}
  function validNickname(value) {
    return value.length > 0 && Array.from(value).length <= 20 && new TextEncoder().encode(value).length <= 80 && /^[\p{L}\p{N}][\p{L}\p{M}\p{N} _-]*$/u.test(value);
  }
  function text(id, value) { $(id).textContent = value; }
  function visible(id, show) { $(id).hidden = !show; }
  function renderBoard() {
    const body = $('ranked-entries');
    body.replaceChildren();
    for (const entry of boardRows) {
      const row = document.createElement('tr');
      for (const value of [entry.rank, entry.nickname, entry.score]) {
        const cell = document.createElement('td');
        cell.textContent = String(value);
        row.appendChild(cell);
      }
      body.appendChild(row);
    }
    text('ranked-board-status', t()[boardState] || '');
    visible('ranked-table', boardRows.length > 0);
    $('ranked-refresh').disabled = boardState === 'loading';
  }
  function statusText() {
    const c = t();
    if (phase === 'running') return c.running;
    if (phase === 'starting') return c.starting;
    if (phase === 'complete' || phase === 'submitting') return c.done;
    if (phase === 'aborted') return `${c.cancelled}: ${c[reason] || c.invalid}`;
    if (phase === 'submitted') return `${c.saved} · ${savedReply.improved ? c.improved : c.unchanged} · ${c.best} ${savedReply.bestScore} · ${savedReply.rank == null ? c.outside : `${c.position} ${savedReply.rank}`}`;
    return c.idle;
  }
  function render() {
    const c = t();
    const labels = {
      'btn-leaderboard': c.button, 'ranked-title': c.title, 'ranked-language': c.language,
      'ranked-category-label': c.category, 'ranked-current-label': c.current,
      'ranked-nickname-label': c.nickname, 'ranked-nickname-hint': c.nicknameHint,
      'ranked-privacy': c.privacy, 'ranked-rules': c.rules, 'ranked-trust': c.trust,
      'ranked-refresh': c.refresh, 'ranked-abort': c.abort, 'ranked-discard': c.discard,
      'ranked-rank-label': c.rank, 'ranked-name-label': c.name, 'ranked-score-label': c.score,
      'ranked-baseline': c.baseline, 'ranked-settings-hint': c.settings, 'ranked-running-hint': c.inProgress,
    };
    Object.entries(labels).forEach(([id, value]) => text(id, value));
    $('ranked-close').setAttribute('aria-label', c.close);
    $('ranked-hud-dismiss').setAttribute('aria-label', currentLang === 'zh' ? '隐藏挑战成绩提示' : 'Hide challenge status');
    visible('ranked-hud', !hudDismissed);
    $('ranked-category').querySelectorAll('option').forEach((option) => { option.textContent = categoryName(option.value); });
    text('ranked-current-category', categoryName(run && isInFlight() ? run.category : category()));
    const message = statusText();
    text('ranked-status', message);
    text('ranked-hud-status', message);
    text('ranked-error', errorType ? `${c[errorType]}${error ? ` (${c.errorCode}: ${error})` : ''}` : '');
    const seconds = phase === 'running' ? Math.max(0, Math.ceil((deadline - performance.now()) / 1000)) : 0;
    text('ranked-countdown', phase === 'running' ? `${seconds}s` : '');
    text('ranked-crash-status', phase === 'aborted' && reason === 'crash' ? message : '');
    $('ranked-countdown').setAttribute('aria-label', `${seconds} ${c.seconds}`);
    lastSecond = seconds;
    text('ranked-start', phase === 'starting' ? c.starting : c.start);
    $('ranked-start').disabled = isInFlight() || isSaved();
    $('ranked-nickname').disabled = isInFlight() || isSaved();
    text('ranked-name-lock', isInFlight() || isSaved() ? c.lockedName : '');
    text('ranked-submit', phase === 'submitting' ? c.submitting : errorType ? c.retry : c.submit);
    $('ranked-submit').disabled = phase === 'submitting';
    $('ranked-discard').disabled = phase === 'submitting';
    visible('ranked-submit', isSaved());
    visible('ranked-discard', isSaved());
    visible('ranked-abort', isInFlight());
    visible('ranked-running-hint', phase === 'running');
    visible('ranked-result', Boolean(result));
    if (result) text('ranked-result', `${c.result}: ${result.score} · ${categoryName(result.category)} · ${result.nickname}`);
    $('ranked-hud').dataset.phase = phase;
    renderBoard();
  }

  function open() {
    hudDismissed = false;
    clearAllInputKeys();
    if (!dialog.open) {
      returnFocus = document.activeElement;
      dialog.showModal();
    }
    if (!boardLoaded) {
      $('ranked-category').value = category();
      loadBoard();
    }
    render();
    $('ranked-close').focus();
  }
  function close() {
    if (phase === 'starting') abort('closed');
    dialog.close();
  }
  function abort(why) {
    if (normalizing || !isInFlight()) return;
    requestVersion += 1;
    phase = 'aborted';
    reason = why;
    const endedRun = run;
    run = null;
    if (endedRun) queueEnd(endedRun.runId);
    clearAllInputKeys();
    render();
  }
  function compatible() {
    return run && category() === run.category && trafficLevelIndex === 1 && weatherIndex === 0 && !state.insaneMode && state.autoStabilizer;
  }
  function tick(now = performance.now()) {
    if (phase !== 'running') return;
    if (document.hidden) { abort('hidden'); return; }
    if (!compatible()) { abort('invalid'); return; }
    if (state.isDestroyed) { abort('crash'); return; }
    if (now >= deadline) {
      result = Object.freeze({ runId: run.runId, nickname: run.nickname, score: score(), elapsedMs: DURATION, category: run.category });
      phase = 'complete';
      clearAllInputKeys();
      render();
      open();
      $('ranked-submit').focus();
      return;
    }
    const second = Math.ceil((deadline - now) / 1000);
    if (second !== lastSecond) {
      lastSecond = second;
      text('ranked-countdown', `${second}s`);
      $('ranked-countdown').setAttribute('aria-label', `${second} ${t().seconds}`);
    }
  }
  async function api(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(path, { ...options, signal: controller.signal });
      let data;
      try { data = await response.json(); } catch (_) { throw new Error('invalid_response'); }
      if (!response.ok) {
        // Show only a bounded machine error code, never server HTML or arbitrary text.
        const rawCode = data.error && typeof data.error === 'object' ? data.error.code : data.error;
        const code = typeof rawCode === 'string' && /^[a-zA-Z0-9_-]{1,60}$/.test(rawCode) ? rawCode : `HTTP_${response.status}`;
        const failure = new Error(code);
        failure.status = response.status;
        throw failure;
      }
      return data;
    } finally { clearTimeout(timer); }
  }
  // Keep uncertain end requests by exact run ID. A delayed retry can never end a newer run.
  function queueEnd(runId) {
    if (!pendingEnds.has(runId)) pendingEnds.set(runId, { promise: null });
    return endRun(runId);
  }
  function endRun(runId) {
    const entry = pendingEnds.get(runId);
    if (!entry) return Promise.resolve(true);
    if (entry.promise) return entry.promise;
    entry.promise = (async () => {
      try {
        const data = await api('/api/end', {
          method: 'POST', credentials: 'same-origin', cache: 'no-store', keepalive: true,
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId }),
        });
        if (data.ended !== true || data.runId !== runId) throw new Error('invalid_response');
        pendingEnds.delete(runId);
        return true;
      } catch (failure) {
        if (!isInFlight()) {
          errorType = 'endError'; error = failure.name === 'AbortError' ? '' : failure.message;
          render();
        }
        return false;
      } finally { entry.promise = null; }
    })();
    return entry.promise;
  }
  async function finishPendingEnds() {
    for (const runId of pendingEnds.keys()) {
      if (!await endRun(runId)) throw new Error('end_unconfirmed');
    }
  }
  async function start() {
    if (isInFlight() || isSaved()) return;
    const enteredName = $('ranked-nickname').value;
    const nickname = enteredName.normalize('NFKC').trim();
    if (/\p{C}/u.test(enteredName) || !validNickname(nickname)) {
      errorType = 'invalidName'; error = ''; render(); $('ranked-nickname').focus(); return;
    }
    if (document.hidden) return;
    try { localStorage.setItem('roadster-public-nickname', nickname); } catch (_) {}
    const chosen = category();
    const previousStart = pendingStart;
    const version = ++requestVersion;
    let issuedRunId = null;
    phase = 'starting'; error = ''; errorType = ''; result = null; run = null; savedReply = null;
    clearAllInputKeys(); render();
    try {
      // A canceled start may still return a server-issued run; release it before issuing another.
      await previousStart;
      if (version !== requestVersion || phase !== 'starting') return;
      await finishPendingEnds();
      if (version !== requestVersion || phase !== 'starting') return;
      const issuance = api('/api/run', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: chosen }),
      }).then((data) => {
        if (typeof data.runId === 'string' && data.runId && data.runId.length <= 100) {
          issuedRunId = data.runId;
          if (version !== requestVersion || phase !== 'starting') queueEnd(issuedRunId);
        }
        return data;
      });
      pendingStart = issuance.catch(() => {});
      const data = await issuance;
      if (version !== requestVersion || phase !== 'starting') return;
      if (document.hidden || category() !== chosen) {
        if (issuedRunId) queueEnd(issuedRunId);
        abort(document.hidden ? 'hidden' : 'invalid'); return;
      }
      if (!issuedRunId || data.durationMs !== DURATION) throw new Error('invalid_run');
      // Baseline only after the server has issued a run. No elapsed sandbox score can carry over.
      normalizing = true;
      window.RoadsterTaxi?.stop();
      resetCar();
      clearAllInputKeys();
      trafficLevelIndex = 1;
      selectWeatherMode(0, false);
      state.insaneMode = false;
      if (!state.autoStabilizer) toggleStabilizer();
      Object.assign(state, {
        score: 0, carsCleared: 0, blastedCarsCount: 0, tireTemp: 35, tireGripMu: 1,
        gasMassKg: 144, dragCoeffCd: 0.34, brakeHeat: 0, wasAirBraking: false,
        suspensionVelocity: 0, suspensionSquash: 0, aeroSquash: 0, downforceN: 0,
        driftAngle: 0, driftTimer: 0, isDrifting: false, tireSmokeTimer: 0,
        wasSupersonic: false, cameraShake: 0, longitudinalG: 0, lateralG: 0,
        isAutoLandingSave: false, lastAutoSaveAlt: 0, lastImpactDvKmh: 0, lastImpactEnergyKj: 0,
        lightningTimer: 6.5, lightningFlash: 0,
      });
      state.prevSpeed = state.speed;
      if (typeof clearTireSmoke === 'function') clearTireSmoke();
      populateTraffic(36);
      normalizing = false;
      run = { runId: data.runId, nickname, category: chosen };
      phase = 'running';
      deadline = performance.now() + DURATION;
      // Reset the animation clock so a slow request never grants a pre-start simulation step.
      lastTime = performance.now();
      applyTranslations();
      ['modal-map-select', 'modal-help'].forEach((id) => $(id).classList.add('hidden'));
      dialog.close();
      render();
    } catch (failure) {
      normalizing = false;
      if (issuedRunId) queueEnd(issuedRunId);
      if (version !== requestVersion) return;
      phase = 'idle'; errorType = failure.message === 'end_unconfirmed' ? 'endError' : failure.message === 'run_active' ? 'activeError' : 'startError'; error = failure.name === 'AbortError' ? '' : failure.message;
      render();
    }
  }
  async function submit() {
    if (phase !== 'complete' || !result) return;
    const payload = result;
    phase = 'submitting'; errorType = ''; error = ''; render();
    try {
      const data = await api('/api/score', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: payload.runId, nickname: payload.nickname, score: payload.score, elapsedMs: payload.elapsedMs }),
      });
      if (data.accepted !== true || !Number.isSafeInteger(data.bestScore) || (data.rank !== null && (!Number.isInteger(data.rank) || data.rank < 1))) throw new Error('invalid_response');
      savedReply = data;
      phase = 'submitted';
      $('ranked-category').value = payload.category;
      render();
      loadBoard();
    } catch (failure) {
      phase = 'complete';
      errorType = failure.status && failure.status < 500 ? 'rejected' : 'submitError';
      error = failure.name === 'AbortError' ? '' : failure.message;
      render();
    }
  }
  async function loadBoard() {
    const chosen = $('ranked-category').value;
    if (!categories.includes(chosen)) return;
    const version = ++boardVersion;
    boardState = 'loading'; boardRows = []; renderBoard();
    try {
      const data = await api(`/api/leaderboard?category=${encodeURIComponent(chosen)}`, { credentials: 'omit', cache: 'default' });
      if (version !== boardVersion) return;
      if (data.category !== chosen || !Array.isArray(data.entries)) throw new Error('invalid_response');
      boardRows = data.entries.slice(0, 100).filter((entry) => entry && Number.isInteger(entry.rank) && entry.rank > 0 && typeof entry.nickname === 'string' && Number.isSafeInteger(entry.score) && entry.score >= 0).map((entry) => ({ rank: entry.rank, nickname: Array.from(entry.nickname).slice(0, 20).join(''), score: entry.score }));
      boardState = boardRows.length ? '' : 'empty';
      boardLoaded = true;
      renderBoard();
    } catch (_) {
      if (version !== boardVersion) return;
      boardState = 'boardError'; renderBoard();
    }
  }
  $('btn-leaderboard').addEventListener('click', open);
  $('ranked-hud-open').addEventListener('click', open);
  $('ranked-hud-dismiss').addEventListener('click', () => {
    hudDismissed = true;
    visible('ranked-hud', false);
    $('btn-leaderboard').focus();
  });
  $('ranked-close').addEventListener('click', close);
  $('ranked-language').addEventListener('click', toggleLanguage);
  $('ranked-start').addEventListener('click', start);
  $('ranked-submit').addEventListener('click', submit);
  $('ranked-abort').addEventListener('click', () => abort('closed'));
  $('ranked-discard').addEventListener('click', () => {
    if (phase !== 'complete') return;
    if (run) queueEnd(run.runId);
    result = null; run = null; phase = 'idle'; errorType = ''; error = ''; render();
  });
  $('ranked-refresh').addEventListener('click', loadBoard);
  $('ranked-category').addEventListener('change', loadBoard);
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => {
    clearAllInputKeys();
    if (returnFocus && returnFocus.isConnected) returnFocus.focus();
  });
  document.addEventListener('focusin', (event) => {
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]')) clearAllInputKeys();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) abort('hidden'); });
  window.addEventListener('blur', () => abort('hidden'));
  window.addEventListener('pagehide', () => abort('hidden'));
  window.RoadsterRanked = { abort, tick, render, isDialogOpen: () => dialog.open };
  setInterval(() => tick(), 200);
  render();
})();
