import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { serveMusic } from '../scripts/serve-music.mjs';

const source = readFileSync(new URL('../src/music.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
class Element {
  constructor() { this.listeners = {}; this.attributes = {}; this.paused = true; this.currentTime = 0; this.open = false; this.playCalls = 0; this.pauseCalls = 0; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  emit(type, event = {}) { for (const fn of this.listeners[type] || []) fn({ target: this, currentTarget: this, ...event }); }
  setAttribute(key, value) { this.attributes[key] = value; }
  play() { this.playCalls++; return this.onPlay(); }
  pause() { this.pauseCalls++; this.paused = true; this.emit('pause'); }
  load() { this.error = null; }
  showModal() { this.open = true; }
  close() { this.open = false; this.emit('close'); }
  focus() { this.focused = true; }
}
function harness({ stored, blockedStorage = false, deferred = false } = {}) {
  const elements = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, new Element()]));
  const document = new Element(); document.hidden = false; document.getElementById = id => elements[id];
  const window = new Element(); const saved = [];
  const audio = elements['roadster-bgm'];
  let resolve, reject;
  audio.onPlay = () => {
    if (deferred) return new Promise((yes, no) => { resolve = () => { audio.paused = false; yes(); }; reject = no; });
    audio.paused = false; return Promise.resolve();
  };
  const context = vm.createContext({ window, document, currentLang: 'en', Promise,
    localStorage: { getItem() { if (blockedStorage) throw Error('blocked'); return stored; }, setItem(key, value) { if (blockedStorage) throw Error('blocked'); saved.push({ key, value }); } },
    clearAllInputKeys() { context.keysCleared = (context.keysCleared || 0) + 1; },
  });
  vm.runInContext(source, context);
  return { context, window, document, audio, elements, saved,
    gesture: (trusted = true) => document.emit('pointerdown', { isTrusted: trusted }),
    click: () => elements['music-toggle'].emit('click', { isTrusted: true }),
    resolve: () => resolve(), reject: () => reject(Error('NotAllowedError')),
    flush: async () => { await Promise.resolve(); await Promise.resolve(); },
  };
}

test('music defaults to looping, waits for real interaction and has one player/listener set', async () => {
  const h = harness(); assert.equal(h.audio.loop, true); assert.equal(h.audio.volume, .35);
  assert.equal(h.audio.playCalls, 0); h.gesture(false); assert.equal(h.audio.playCalls, 0);
  h.gesture(); await h.flush(); assert.equal(h.audio.playCalls, 1);
  h.gesture(); h.window.emit('pageshow'); await h.flush(); assert.equal(h.audio.playCalls, 1);
  const listenerCount = h.document.listeners.pointerdown.length;
  vm.runInContext(source, h.context); assert.equal(h.document.listeners.pointerdown.length, listenerCount);
  assert.equal(h.audio.playCalls, 1);
});

test('settings truly pauses, retains position and preference, resumes the same element', async () => {
  const h = harness(); h.gesture(); await h.flush(); h.audio.currentTime = 37;
  h.click(); assert.equal(h.audio.paused, true); assert.equal(h.audio.currentTime, 37);
  assert.equal(h.saved.at(-1).value, 'false'); assert.equal(h.elements['music-toggle'].textContent, 'Resume music');
  h.gesture(); h.window.emit('pageshow'); assert.equal(h.audio.playCalls, 1);
  h.click(); await h.flush(); assert.equal(h.audio.paused, false); assert.equal(h.audio.currentTime, 37);
  assert.equal(h.saved.at(-1).value, 'true'); assert.equal(h.audio.playCalls, 2);
  const reload = harness({ stored: 'false' }); reload.gesture(); assert.equal(reload.audio.playCalls, 0);
  reload.click(); await reload.flush(); assert.equal(reload.audio.playCalls, 1);
});

test('storage failures do not break controls or silently disable default music', async () => {
  const h = harness({ blockedStorage: true }); h.gesture(); await h.flush(); h.click();
  assert.equal(h.audio.paused, true); h.click(); await h.flush(); assert.equal(h.audio.paused, false);
});

test('pending plays are deduplicated and late success cannot undo manual pause', async () => {
  const h = harness({ deferred: true }); h.gesture(); h.gesture(); assert.equal(h.audio.playCalls, 1);
  h.click(); h.resolve(); await h.flush(); assert.equal(h.audio.paused, true);
  assert.equal(h.saved.at(-1).value, 'false');
});

test('rejected autoplay remains enabled, explicit retry works and old rejection is harmless', async () => {
  const h = harness({ deferred: true }); h.gesture(); h.reject(); await h.flush();
  assert.match(h.elements['music-status'].textContent, /retry/); assert.equal(h.elements['music-toggle'].textContent, 'Play music');
  // Browser capture runs first; this target must not change failed before its click handler.
  h.document.emit('click', { isTrusted: true, target: h.elements['music-toggle'] });
  h.click(); assert.equal(h.audio.playCalls, 2); h.resolve(); await h.flush(); assert.equal(h.audio.paused, false);
  const stale = harness({ deferred: true }); stale.gesture(); stale.click(); stale.reject(); await stale.flush();
  assert.equal(stale.elements['music-status'].textContent, 'Paused');
});

test('hidden/page lifecycle pauses without changing preference and resumes only when appropriate', async () => {
  const h = harness(); h.gesture(); await h.flush(); h.audio.currentTime = 18;
  h.document.hidden = true; h.document.emit('visibilitychange'); assert.equal(h.audio.paused, true);
  h.gesture(); assert.equal(h.audio.playCalls, 1); assert.equal(h.saved.length, 0);
  h.document.hidden = false; h.document.emit('visibilitychange'); await h.flush(); assert.equal(h.audio.playCalls, 2);
  h.window.emit('pagehide'); assert.equal(h.audio.paused, true); h.window.emit('pageshow'); await h.flush();
  assert.equal(h.audio.playCalls, 3); assert.equal(h.audio.currentTime, 18);
  h.click(); h.window.emit('pagehide'); h.window.emit('pageshow'); assert.equal(h.audio.playCalls, 3);
  const fresh = harness(); fresh.window.emit('pageshow'); assert.equal(fresh.audio.playCalls, 0);
});

test('hidden transition wins over pending play, and a later gesture recovers a sync error', async () => {
  const h = harness({ deferred: true }); h.gesture(); h.document.hidden = true; h.document.emit('visibilitychange');
  h.resolve(); await h.flush(); assert.equal(h.audio.paused, true);
  const sync = harness(); sync.audio.onPlay = () => { throw Error('blocked'); }; sync.gesture();
  assert.match(sync.elements['music-status'].textContent, /retry/);
  sync.audio.onPlay = () => { sync.audio.paused = false; return Promise.resolve(); };
  sync.gesture(); await sync.flush(); assert.equal(sync.audio.paused, false);
});

test('settings handles repeated open/close and translations without changing music or SFX', () => {
  const h = harness(); const open = h.elements['btn-settings']; const dialog = h.elements['audio-settings'];
  open.emit('click'); open.emit('click'); assert.equal(dialog.open, true); assert.equal(h.context.keysCleared, 2);
  h.elements['audio-settings-close'].emit('click'); assert.equal(dialog.open, false); assert.equal(open.focused, true);
  h.elements['btn-map-audio-settings'].emit('click'); dialog.close(); assert.equal(h.elements['btn-map-audio-settings'].focused, true);
  h.context.currentLang = 'zh'; h.window.RoadsterMusic.render(); assert.equal(open.textContent, '⚙ 设置');
  assert.equal(h.audio.playCalls, 0); assert.equal(h.saved.length, 0);
  assert.ok(html.includes('aria-labelledby="audio-settings-title"'));
  const hud = readFileSync(new URL('../src/ui-hud.js', import.meta.url), 'utf8');
  assert.match(hud, /RoadsterMusic\?\.isSettingsOpen\(\)/);
  assert.match(hud, /RoadsterMusic\?\.render\(\)/);
  assert.ok(!source.includes('sound.enabled'));
  const bundle = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(bundle.indexOf('// MODULE: music.js') < bundle.indexOf('// MODULE: world.js'));
});

test('build preserves original MP3 bytes and audio metadata contract', () => {
  const bytes = readFileSync(new URL('../assets/Ludicrous_Velocity_bgm.mp3', import.meta.url));
  assert.equal(bytes.length, 1434989);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '49b5e5b6520a2e05eaaba2f3ff49af68837177a69626de96cfb605fe9be10f77');
  assert.match(html, /<audio[^>]*id="roadster-bgm"[^>]*loop preload="none" playsinline/);
  const build = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
  assert.match(build, /copyFile\('assets\/Ludicrous_Velocity_bgm.mp3', 'public\/assets\/Ludicrous_Velocity_bgm.mp3'\)/);
});

test('music dev endpoint serves complete bytes, HEAD, valid ranges and rejects invalid ranges', async t => {
  const server = http.createServer(serveMusic); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close()); const url = `http://127.0.0.1:${server.address().port}`;
  const original = readFileSync(new URL('../assets/Ludicrous_Velocity_bgm.mp3', import.meta.url));
  const full = await fetch(url); assert.equal(full.status, 200); assert.equal(full.headers.get('content-type'), 'audio/mpeg');
  assert.deepEqual(Buffer.from(await full.arrayBuffer()), original);
  const head = await fetch(url, { method: 'HEAD' }); assert.equal(head.headers.get('content-length'), String(original.length)); assert.equal((await head.arrayBuffer()).byteLength, 0);
  for (const [range, start, end] of [['bytes=0-99', 0, 99], ['bytes=1434900-', 1434900, original.length - 1], ['bytes=-100', original.length - 100, original.length - 1], ['bytes=0-99999999', 0, original.length - 1]]) {
    const res = await fetch(url, { headers: { Range: range } }); assert.equal(res.status, 206);
    assert.equal(res.headers.get('content-range'), `bytes ${start}-${end}/${original.length}`);
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), original.subarray(start, end + 1));
  }
  for (const range of ['bytes=9999999-', 'bytes=4-2', 'bytes=-0', 'bytes=-', 'bytes=0-1,3-4', 'nonsense']) {
    const res = await fetch(url, { headers: { Range: range } }); assert.equal(res.status, 416, range); assert.equal(res.headers.get('content-range'), `bytes */${original.length}`);
  }
  assert.equal((await fetch(url, { method: 'POST' })).status, 405);
});
