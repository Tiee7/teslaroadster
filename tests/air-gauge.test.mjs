import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
const html = read('index.html'), hud = read('ui-hud.js');
const config = read('config.js'), physics = read('physics-main.js');
const i18nSource = config.slice(config.indexOf('const I18N ='), config.indexOf('let currentLang ='));
const i18n = vm.runInNewContext(`${i18nSource}\nI18N`);
const tankReader = config.slice(config.indexOf('function getAirTankReadout('), config.indexOf('const VEHICLE_MASS_KG'));
const getAirTankReadout = vm.runInNewContext(`${tankReader}\ngetAirTankReadout`, { MAX_AIR_SECONDS: 10 });
const gauge = html.slice(html.indexOf('id="hud-cluster-tank"'), html.indexOf('</footer>'));

test('exterior gauge uses a short title, remaining seconds and no capacity or used-time caption', () => {
  assert.match(gauge, /id="ui-tank-title"[^>]*>AIR TANK<\/span>/);
  assert.match(gauge, /id="val-air-sec"[^>]*>10\.0s<\/span>/);
  assert.doesNotMatch(gauge, /600L|COPV|SPACE-X|SPACEX|\/\s*10\.0s|val-air-liters|ui-tank-burn-time|val-burn-used|Burn Time Used/);
  assert.equal(i18n.en.tankTitle, 'AIR TANK');
  assert.equal(i18n.zh.tankTitle, '空气槽');
});

test('language switching only touches surviving gauge labels and preserves warnings', () => {
  const translate = hud.slice(hud.indexOf("  document.getElementById('ui-tank-title')"), hud.indexOf("  document.getElementById('map-modal-badge')"));
  for (const lang of ['en', 'zh', 'en']) {
    const elements = Object.fromEntries(['ui-tank-title', 'ui-8s-marker-label', 'ui-tank-hint'].map(id => [id, {}]));
    vm.runInNewContext(translate, { t: i18n[lang], document: { getElementById: id => elements[id] ?? null } });
    assert.equal(elements['ui-tank-title'].textContent, i18n[lang].tankTitle);
    assert.equal(elements['ui-8s-marker-label'].textContent, i18n[lang].marker8s);
    assert.equal(elements['ui-tank-hint'].textContent, i18n[lang].tankHint);
  }
});

test('simplified gauge retains the flow, status, fill and 20% auto-descent warning', () => {
  for (const id of ['val-air-flow', 'ui-tank-state-badge', 'air-bar-fill', 'ui-8s-marker-label', 'ui-tank-hint']) {
    assert.ok(gauge.includes(`id="${id}"`), `${id} remains in the gauge`);
  }
  assert.match(gauge, /left-\[20%\]/);
  assert.match(gauge, /FLOW: 0 L\/s/);
});

test('remaining-time updates never require removed nodes during depletion, recharge or invalid readings', () => {
  const update = physics.slice(physics.indexOf('  const tank = getAirTankReadout('), physics.indexOf('  const hullInt = Math.round(state.hullIntegrity);'));
  for (const lang of ['en', 'zh']) {
    for (const [remaining, autoDescending, freefalling, seconds, width, badge] of [
      [10, false, false, '10.0s', '100%', 'badgeReady'],
      [5.4, false, false, '5.4s', '54%', 'badgeRecharging'],
      [2, true, false, '2.0s', '20%', 'badge8sWarn'],
      [0, false, true, '0.0s', '0%', 'badgeDepleted'],
      [0.5, false, false, '0.5s', '5%', 'badgeRecharging'],
      [10, false, false, '10.0s', '100%', 'badgeReady'],
      [11, false, false, '10.0s', '100%', 'badgeReady'],
      [-1, false, true, '0.0s', '0%', 'badgeDepleted'],
      [NaN, false, true, '0.0s', '0%', 'badgeDepleted'],
    ]) {
      const elements = Object.fromEntries(['val-gas-mass', 'val-air-sec', 'air-bar-fill', 'ui-tank-state-badge', 'ui-flight-mode'].map(id => [id, { style: {} }]));
      const state = { airRemaining: remaining, airUsedContinuous: 10 - remaining,
        isAutoDescending8s: autoDescending, isFreefalling: freefalling, y: 0 };
      vm.runInNewContext(update, { currentMap:'city',groundElevation:0,state, t: i18n[lang], getAirTankReadout,
        isRetroBrakeFiring: false, isLiftFiring: false, isAirborne: false,
        document: { getElementById: id => elements[id] ?? null },
      });
      assert.equal(elements['val-air-sec'].textContent, seconds);
      assert.equal(elements['air-bar-fill'].style.width, width);
      assert.equal(elements['ui-tank-state-badge'].textContent, i18n[lang][badge]);
      if (freefalling) assert.equal(elements['ui-flight-mode'].textContent,i18n[lang].modeGround,'depleted ground tank is not a freefall mode');
      assert.equal(state.airRemaining, remaining, 'rendering never changes the gas state');
    }
  }
});

test('depleted mode caption distinguishes actual flight from a road O-hop without changing tank readings',()=>{
  const start=physics.indexOf('  const tank = getAirTankReadout(');
  const update=physics.slice(start,physics.indexOf('  const hullInt = Math.round(state.hullIntegrity);',start));
  for(const lang of ['en','zh'])for(const groundHopActive of [false,true]){
    const elements=Object.fromEntries(['val-gas-mass','val-air-sec','air-bar-fill','ui-tank-state-badge','ui-flight-mode'].map(id=>[id,{style:{}}]));
    const state={airRemaining:0,airUsedContinuous:10,isFreefalling:true,y:100,groundHopActive};
    vm.runInNewContext(update,{currentMap:'city',groundElevation:0,state,t:i18n[lang],getAirTankReadout,isAirborne:true,isRetroBrakeFiring:false,isLiftFiring:false,document:{getElementById:id=>elements[id]??null}});
    assert.equal(elements['ui-flight-mode'].textContent,i18n[lang][groundHopActive?'modeHover':'modeFreefall']);
    assert.equal(elements['ui-tank-state-badge'].textContent,i18n[lang].badgeDepleted);
    assert.equal(state.airRemaining,0);
  }
});
