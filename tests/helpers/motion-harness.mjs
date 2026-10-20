// Production movement/tank/attitude path, without WebGL or scene mutation.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as MathUtils from './vendor/three-r128-MathUtils.mjs';
export function motionHarness(overrides = {}, map = 'city', sources = null) {
  const source = name => sources?.[name] ?? readFileSync(new URL(`../../src/${name}`, import.meta.url), 'utf8');
  const physics = source('physics-main.js');
  const part = (from, to) => { const a = physics.indexOf(from), b = physics.indexOf(to, a + from.length); if (a < 0 || b < a) throw Error(from); return physics.slice(a, b); };
  const alerts = [], impacts = [];
  const context = vm.createContext({ window: {}, cityBuildings: [], frontWheelSteerGroups: [], carMeshGroup: {},
    THREE: { MathUtils }, sound: { init() {}, beep() {}, speakAlert(...args) { alerts.push(args); } },
    document: { getElementById: () => ({ classList: { remove() {} } }) }, showBanner(...args) { alerts.push(args); },
    triggerPhysicsCollision(...args) { impacts.push(args); } });
  vm.runInContext(`${source('driving-score.js')}\n${source('config.js')}\nconst keys = {};\n${part('function wrapAnglePi(', 'function updateSimulation(')}
    function motionStep(dt) { const t = I18N[currentLang]; ${part('  const isRealMode =', '  const playerWorldZ =')}
      return { isAirborne, isRearThrusterFiring, isLiftFiring, isDescendFiring, isRetroBrakeFiring, retroImpulseSeconds, airConsumedThisFrame };
    }
    globalThis.motionApi = { state, keys, step: motionStep, setMap(value) { currentMap = value; } };
  `, context);
  const api = context.motionApi; api.setMap(map);
  Object.assign(api.state, { x: 0, y: 0, z: 0, speed: 0, vx: 0, vy: 0, vz: 0, ...overrides });
  return { ...api, alerts, impacts, context };
}
