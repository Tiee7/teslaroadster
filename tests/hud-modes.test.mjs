import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
const hud = read('ui-hud.js'), html = read('index.html'), css = read('styles.css'), config = read('config.js');
const modes = hud.slice(hud.indexOf('const HUD_MODES'), hud.indexOf('// =========================================================================', hud.indexOf('const HUD_MODES')));
function harness(saved = null, blocked = false, legacy, coarse = false) {
  const elements = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => {
    const classes = new Set();
    return [id, { classes, attributes:{}, setAttribute(name,value){this.attributes[name]=String(value);}, classList: {
      toggle(name, active) { if (active) classes.add(name); else classes.delete(name); },
      remove(name) { classes.delete(name); },
    } }];
  }));
  let stored = saved, bounds = 0, translations = 0, beeps = 0;
  const state = legacy === undefined ? { hudMode: 'full', hudMinimal: false } : { hudMinimal: legacy };
  const body = { dataset: {} };
  const context = vm.createContext({ state, window:{matchMedia:()=>({matches:coarse})}, document: { body, getElementById: id => elements[id] },
    localStorage: { getItem() { if (blocked) throw Error('blocked'); return stored; }, setItem(key, value) { if (blocked) throw Error('blocked'); assert.equal(key, 'roadster-hud-mode'); stored = value; } },
    updateHudBounds() { bounds++; }, applyTranslations() { translations++; }, sound: { beep() { beeps++; } },
  });
  vm.runInContext(modes, context);
  return { context, state, elements, body, restore: () => context.restoreHudMode(), toggle: () => context.toggleHudMode(),
    hidden: id => elements[id].classes.has('hidden'), saved: () => stored, bounds: () => bounds, translations: () => translations, beeps: () => beeps };
}

test('HUD cycles Full → Medium → Minimal repeatedly with independent compact and side-panel flags', () => {
  const h = harness(); h.restore();
  for (let i = 0; i < 12; i++) {
    const expected = ['medium', 'minimal', 'full'][i % 3]; h.toggle();
    assert.equal(h.state.hudMode, expected); assert.equal(h.body.dataset.hudMode, expected);
    assert.equal(h.state.hudMinimal, expected === 'minimal');
    assert.equal(h.hidden('hud-left'), expected === 'minimal'); assert.equal(h.hidden('hud-right'), expected === 'minimal');
    assert.equal(h.hidden('hud-brand-badge'), expected !== 'full');
    assert.equal(h.hidden('btn-map-select'), expected !== 'full');
    assert.equal(h.hidden('btn-camera'), false); assert.equal(h.hidden('btn-reset'), false);
    for (const id of ['btn-lang', 'btn-settings', 'btn-hud-mode', 'btn-leaderboard', 'status-banner', 'ranked-hud']) assert.equal(h.hidden(id), false);
    assert.equal(h.elements['hud-footer'].classes.has('hud-compact-view'), expected !== 'full');
    assert.equal(h.elements['hud-footer'].classes.has('hud-minimal-view'), expected === 'minimal');
    assert.equal(h.saved(), expected);
  }
  assert.equal(h.beeps(), 12); assert.equal(h.translations(), 12); assert.equal(h.bounds(), 13);
});

test('all HUD modes restore on reload, boolean legacy values migrate safely, invalid values use Full', () => {
  for (const [saved, expected] of [['full', 'full'], ['medium', 'medium'], ['minimal', 'minimal'], ['true', 'minimal'], ['false', 'full'], ['broken', 'full'], ['', 'full'], [null, 'full']]) {
    const h = harness(saved); h.restore(); assert.equal(h.state.hudMode, expected);
    assert.equal(h.hidden('hud-left'), expected === 'minimal');
    assert.equal(h.beeps(), 0); assert.equal(h.saved(), saved, 'restoration is silent and read-only');
  }
  for (const value of [true, false]) { const h = harness(null, false, value); h.restore(); assert.equal(h.state.hudMode, value ? 'minimal' : 'full'); }
  const h = harness(); h.restore(); h.toggle(); const reload = harness(h.saved()); reload.restore(); assert.equal(reload.state.hudMode, 'medium');
});

test('blocked localStorage never prevents HUD switching and medium preserves collapsed panel contents', () => {
  const h = harness(null, true); h.restore();
  h.elements['guide-body'].classes.add('hidden'); h.elements['telemetry-body'].classes.add('hidden');
  h.toggle(); assert.equal(h.state.hudMode, 'medium'); assert.equal(h.hidden('hud-left'), false); assert.equal(h.hidden('hud-right'), false);
  assert.equal(h.hidden('guide-body'), true); assert.equal(h.hidden('telemetry-body'), true);
  h.toggle(); h.toggle(); h.toggle(); assert.equal(h.state.hudMode, 'medium');
  assert.equal(h.hidden('guide-body'), true); assert.equal(h.hidden('telemetry-body'), true);
});

test('all HUD modes retain touch inputs and camera/reset; keyboard and button share the same action', () => {
  assert.doesNotMatch(css, /\.hud-minimal-view #touch-controls\s*\{\s*display: none/);
  assert.doesNotMatch(css, /\.hud-compact-view #touch-controls/);
  assert.match(css, /@media \(pointer: coarse\) \{\s*body #touch-controls \{ display: flex; \}/);
  assert.match(hud, /btnHudMode\.addEventListener\('click', toggleHudMode\)/);
  assert.match(hud, /if \(e\.code === 'KeyZ'\) \{\s*if \(!e\.repeat\) toggleHudMode\(\);/);
  assert.match(config, /hudBtnMedium: "HUD: Medium \(Z\)"/);
  assert.match(config, /hudBtnMedium: "界面: 中等 \(Z\)"/);
  assert.match(hud, /medium: t\.hudBtnMedium/);
});

test('central cabin mirror and its mount/material are removed, exterior and traffic mirrors retained', () => {
  const source = read('vehicles.js');
  assert.doesNotMatch(source, /mirrorHousing|mirrorScreenMat|mirrorScreen|mirrorMount|Rear-View Camera Mirror Display/);
  assert.match(source, /const mirrorPod =/); assert.match(source, /const sharedTrafficMirrorGeo =/);
});

test('small-screen Medium FPV keeps both side cards scrollable above the central instrument band', () => {
  assert.match(css, /\.cockpit-view\[data-hud-mode="medium"\] #hud-top-container \{ --hud-notice-space: 32px; \}/);
  assert.match(css, /\.cockpit-view\[data-hud-mode="medium"\] #hud-left,\s*\.cockpit-view\[data-hud-mode="medium"\] #hud-right-card \{[^}]*max-height: min\(12dvh, max\(32px, calc\(45dvh[^}]*overflow-y: auto;/);
  for (const [height, header, navigation] of [[900, 90, 56], [844, 90, 56], [800, 90, 56], [390, 50, 56], [320, 80, 56], [320, 50, 0]]) {
    const notice = 32, top = header + navigation + notice + 4;
    const card = Math.min(height * 0.12, Math.max(32, height * 0.45 - header - navigation - notice - 8));
    assert.ok(card >= 32);
    if (height > 400) assert.ok(top + card < height * 0.45);
  }
});


test('phone detail cards start folded and only the explicitly requested sheet expands, across repeated HUD cycles',()=>{
 const h=harness(null,false,undefined,true);h.restore();
 assert.equal(h.body.dataset.mobileHudPanel,'none');
 for(let i=0;i<6;i++){
  assert.equal(h.context.toggleMobileHudPanel('guide'),true);assert.equal(h.body.dataset.mobileHudPanel,'guide');
  assert.equal(h.elements['btn-collapse-guide'].attributes['aria-expanded'],'true');
  h.context.toggleMobileHudPanel('telemetry');assert.equal(h.body.dataset.mobileHudPanel,'telemetry');
  assert.equal(h.elements['btn-collapse-guide'].attributes['aria-expanded'],'false');
  h.context.toggleMobileHudPanel('telemetry');assert.equal(h.body.dataset.mobileHudPanel,'none');
  h.toggle();assert.equal(h.body.dataset.mobileHudPanel,'none');
  assert.equal(h.hidden('btn-camera'),false);assert.equal(h.hidden('btn-reset'),false);
 }
 const desktop=harness();desktop.restore();assert.equal(desktop.context.toggleMobileHudPanel('guide'),false);
});
