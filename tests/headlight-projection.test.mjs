import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const runtime = readFileSync(process.env.ROADSTER_THREE_RUNTIME || '/tmp/roadster-three.min.js', 'utf8');
const ui = read('src/ui-hud.js'), projection = read('src/headlight-projection.js'), lighting = ui.slice(ui.indexOf('function syncVehicleWeatherLights('), ui.indexOf('function cycleWeatherMode(')) + projection;
function fixture() {
  const nodes = new Map(), node = id => { if (!nodes.has(id)) nodes.set(id, { hidden: true, textContent: '' }); return nodes.get(id); };
  const warnings = [], window = { innerWidth: 1280, innerHeight: 850, addEventListener() {}, dispatchEvent() {} };
  const c = vm.createContext({ window, console: { ...console, warn: s => warnings.push(s) }, document: { getElementById: node, createElement: () => ({ getContext: () => ({}) }) }, localStorage: { getItem: () => null, setItem() {} }, Event: class {} });
  vm.runInContext(runtime, c); assert.equal(c.THREE.REVISION, '128');
  vm.runInContext(read('src/driving-score.js') + '\n' + read('src/config.js') + '\nconst scene=new THREE.Scene();' + ['whiteLeatherMat', 'cockpitMat', 'bodyMaterial', 'goldCanopyMaterial', 'carbonMaterial', 'titaniumMaterial'].map(n => `const ${n}=new THREE.MeshStandardMaterial();`).join(''), c);
  for (const n of ['highway-traffic', 'vehicles', 'reference-exterior', 'reference-cockpit']) vm.runInContext(read('src/' + n + '.js'), c);
  vm.runInContext('const roadMat=new THREE.MeshStandardMaterial({color:0x0f172a}),cityAsphaltMat=roadMat.clone(),cityAsphaltEWMat=roadMat.clone();' + lighting + '\nglobalThis.parts={scene,carMeshGroup,headlightSpotL,headlightSpotR,headlightTargetL,headlightTargetR,roads:[roadMat,cityAsphaltMat,cityAsphaltEWMat],presets:WEATHER_PRESETS};', c);
  return { c, window, nodes, node, warnings, T: c.THREE, p: c.parts, run: s => vm.runInContext(s, c) };
}
test('headlamp projection uses a finite below-horizon soft cone while preserving actual weather intensity/colors/day/destroyed rules', () => {
  const f = fixture(), { p, T } = f;
  for (const weather of [0, 1, 2, 3]) {
    f.run(`weatherIndex=${weather};window.RoadsterWeatherLights.sync();`);
    for (const light of [p.headlightSpotL, p.headlightSpotR]) {
      assert.equal(light.intensity, [2.4, 2.8, 2, 0][weather]); assert.equal(light.visible, weather !== 3); assert.equal(light.angle, 7 * Math.PI / 180); assert.equal(light.penumbra, .8); assert.equal(light.distance, 38); assert.equal(light.decay, 2);
      const axis = light.target.position.clone().sub(light.position).normalize(), tilt = Math.asin(-axis.y); assert.ok(tilt > light.angle, 'whole cone is below the horizon');
      const near = light.position.y / Math.tan(tilt + light.angle), far = light.position.y / Math.tan(tilt - light.angle); assert.ok(near > 1.4 && near < 1.6 && far > 8.7 && far < 8.9);
      assert.equal(light.target.parent, light.parent); assert.equal(light.color.getHex(), weather === 1 ? 0x7dd3fc : weather === 2 ? 0xfef08a : 0xf8fafc);
    }
  }
  f.run('weatherIndex=0;state.isDestroyed=true;window.RoadsterWeatherLights.sync();'); assert.equal(p.headlightSpotL.intensity, 0); assert.equal(p.headlightSpotR.visible, false);
  p.carMeshGroup.position.set(3, 4, 5); p.carMeshGroup.rotation.set(.2, .9, -.3); p.scene.updateMatrixWorld(true);
  const from = p.headlightSpotL.getWorldPosition(new T.Vector3()), to = p.headlightTargetL.getWorldPosition(new T.Vector3());
  assert.ok(to.clone().sub(from).normalize().dot(new T.Vector3(0, -Math.sin(Math.PI / 18), -Math.cos(Math.PI / 18)).transformDirection(p.carMeshGroup.matrixWorld)) > .99999);
});
test('headlamp studio clone owns an attached transformed target; repeated sync cannot mutate the live target or grow nodes', () => {
  const f = fixture(), { p, T } = f; f.window.RoadsterWeatherLights.sync(); const live = p.headlightTargetL.position.clone(), preview = f.window.RoadsterVehicle.getPreviewModel().clone(true), lights = [];
  preview.traverse(n => { if (n.isSpotLight) lights.push(n); }); assert.equal(lights.length, 2); assert.ok(lights.every(l => !l.target.parent), 'native r128 detached-clone counterexample');
  f.window.RoadsterWeatherLights.applyTo(preview); const count = preview.children.length;
  preview.position.set(3, 2, -9); preview.rotation.set(.15, .8, -.2);
  for (let i = 0; i < 5; i++) f.window.RoadsterWeatherLights.applyTo(preview); preview.updateMatrixWorld(true);
  assert.equal(preview.children.length, count); assert.deepEqual(p.headlightTargetL.position.toArray(), live.toArray());
  for (const light of lights) { assert.equal(light.target.parent, light.parent); assert.notEqual(light.target, p.headlightTargetL); const actual = light.target.getWorldPosition(new T.Vector3()), expected = light.target.position.clone().applyMatrix4(light.parent.matrixWorld); assert.ok(actual.distanceTo(expected) < 1e-9); }
});
test('road shader patch validates r128, one spot call and both includes; point/directional/environment and diffuse remain byte-exact', () => {
  const f = fixture(), { T, p } = f; f.window.RoadsterWeatherLights.sync();
  const chunk = T.ShaderChunk.lights_fragment_begin, start = chunk.indexOf('#if ( NUM_SPOT_LIGHTS'), end = chunk.indexOf('#if ( NUM_DIR_LIGHTS'), call = 'RE_Direct( directLight, geometry, material, reflectedLight );';
  const expected = chunk.slice(0, start) + chunk.slice(start, end).replace(call, 'roadsterHeadlampDirect( directLight, geometry, material, reflectedLight );') + chunk.slice(end);
  assert.equal(createHash('sha256').update(runtime).digest('hex'), '9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2');
  for (const material of p.roads) {
    const original = T.ShaderLib.standard.fragmentShader, shader = { fragmentShader: original }, beforeKey = material.customProgramCacheKey(); material.onBeforeCompile(shader, {});
    assert.equal(shader.fragmentShader.split(expected).length, 2); assert.ok(shader.fragmentShader.includes('vec3( 0.18 )')); assert.equal(shader.fragmentShader.split('void roadsterHeadlampDirect(').length, 2);
    const body = shader.fragmentShader.match(/void roadsterHeadlampDirect\([\s\S]*?\n}/)[0]; assert.equal(body.split(call).length, 2); assert.doesNotMatch(body, /directDiffuse\s*[=+]/);
    const removed = shader.fragmentShader.replace(expected, '#include <lights_fragment_begin>').replace('\n' + body + '\n', ''); assert.equal(removed, original);
    // Actual r128 pragma expansion has no new block/declaration inside the loop.
    const lit = expected.replaceAll('NUM_SPOT_LIGHTS', '2'), unrolled = lit.replace(/#pragma unroll_loop_start\s+for \( int i = (\d+); i < (\d+); i \+\+ \) \{([\s\S]+?)\}\s+#pragma unroll_loop_end/g, (_, a, b, body) => Array.from({ length: +b - +a }, (_, k) => body.replace(/\[ i \]/g, `[ ${k + +a} ]`).replaceAll('UNROLLED_LOOP_INDEX', String(k + +a))).join(''));
    assert.equal(unrolled.split('roadsterHeadlampDirect( directLight').length - 1, 2); assert.doesNotMatch(unrolled, /spotLights\[ i \]/); assert.equal(beforeKey, material.customProgramCacheKey());
  }
  assert.equal(f.window.RoadsterWeatherLights.status().compatible, true);
});
test('headlamp incompatible version/layout/include fails explicitly with only projection disabled, not a blank game or silent stale patch', () => {
  for (const mutation of ["THREE.REVISION='129'", "THREE.ShaderChunk.lights_fragment_begin+='\\n#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )'", "(()=>{const s=THREE.ShaderChunk.lights_fragment_begin,k=s.indexOf('#if ( NUM_SPOT_LIGHTS');THREE.ShaderChunk.lights_fragment_begin=s.slice(0,k)+s.slice(k).replace('RE_Direct( directLight, geometry, material, reflectedLight );','bad()');})()"]) {
    const f = fixture(); f.run(mutation); f.window.RoadsterWeatherLights.sync(); f.window.RoadsterWeatherLights.sync(); assert.equal(f.window.RoadsterWeatherLights.status().compatible, false); assert.equal(f.p.headlightSpotL.intensity, 0); assert.equal(f.p.headlightSpotR.visible, false); assert.equal(f.node('headlight-status').hidden, false); assert.equal(f.warnings.length, 1);
  }
  for (const count of [0, 2]) { const f = fixture(); f.window.RoadsterWeatherLights.sync(); const shader = { fragmentShader: '#include <lights_physical_pars_fragment>\n' + '#include <lights_fragment_begin>'.repeat(count) }, before = shader.fragmentShader; f.p.roads[0].onBeforeCompile(shader, {}); assert.equal(shader.fragmentShader, before); assert.equal(f.p.headlightSpotL.intensity, 0); assert.equal(f.window.RoadsterWeatherLights.status().issue, 'shader include mismatch'); }
});
const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0), norm = a => { const m = Math.hypot(...a); return a.map(v => v / m); }, clamp = x => Math.max(0, Math.min(1, x));
// Exact fixed-r128 legacy F/G/D, PI irradiance, smooth angular and distance
// response. This is CPU BRDF arithmetic, NOT a rendered screenshot/GPU claim.
function response(light, point, eye, roughness, metalness, color, cap = Infinity) {
  const L = norm(sub(light.position.toArray(), point)), V = norm(sub(eye, point)), H = norm(L.map((v, i) => v + V[i])), axis = norm(sub(light.position.toArray(), light.target.position.toArray()));
  const nl = clamp(L[1]), nv = clamp(V[1]), nh = clamp(H[1]), lh = clamp(dot(L, H)), alpha2 = roughness ** 4;
  const G = .5 / Math.max(nl * Math.sqrt(alpha2 + (1 - alpha2) * nv * nv) + nv * Math.sqrt(alpha2 + (1 - alpha2) * nl * nl), 1e-6), D = alpha2 / (Math.PI * (nh * nh * (alpha2 - 1) + 1) ** 2);
  const a = clamp((dot(L, axis) - Math.cos(light.angle)) / (Math.cos(light.angle * (1 - light.penumbra)) - Math.cos(light.angle))), angular = a * a * (3 - 2 * a), distance = Math.max(0, 1 - Math.hypot(...sub(light.position.toArray(), point)) / light.distance) ** light.decay;
  return color.map((base, i) => { const f0 = .04 * (1 - metalness) + base * metalness, F = (1 - f0) * 2 ** ((-5.55473 * lh - 6.98316) * lh) + f0, I = nl * light.intensity * light.color.toArray()[i] * distance * angular; return { spec: Math.min(cap, I * Math.PI * F * G * D), diffuse: I * base * (1 - metalness) }; });
}
test('actual r128 GGX counterexample reproduces severe pre-fix road clipping mathematically; bounded spot delta prevents that term without darkening diffuse/weather', t => {
  const f = fixture(), { p, T } = f, old = [p.headlightSpotL, p.headlightSpotR].map(l => { const c = l.clone(); c.target = l.target.clone(); return c; });
  const color = new T.Color(0x0f172a).toArray(), witness = old.map(l => response(l, [-.5, 0, -11.2], [0, .3, -50], .42, .38, color)).reduce((sum, r) => sum + r[0].spec, 0); assert.ok(witness > 10, String(witness));
  const cap = Number(projection.match(/vec3\( (0\.18) \)/)[1]), maxima = [];
  for (const weather of [0, 1, 2]) {
    f.run(`weatherIndex=${weather};window.RoadsterWeatherLights.sync();`); const wp = p.presets[weather]; let rawMax = 0, cappedMax = 0, diffuse = 0;
    for (const height of [.12, .3, .6, 1.3, 3]) for (const range of [7, 12, 20, 35, 50]) for (let z = -3; z >= -22; z -= .4) for (let x = -2; x <= 2; x += .4) {
      const rows = [p.headlightSpotL, p.headlightSpotR].map(l => response(l, [x, 0, z], [0, height, -range], wp.roadRoughness, wp.roadMetalness, color));
      for (let c = 0; c < 3; c++) { rawMax = Math.max(rawMax, rows[0][c].spec + rows[1][c].spec); cappedMax = Math.max(cappedMax, rows.reduce((sum, r) => sum + Math.min(cap, r[c].spec), 0)); diffuse = Math.max(diffuse, rows[0][c].diffuse + rows[1][c].diffuse); }
    }
    assert.ok(rawMax > 1, 'lower cone alone is insufficient'); assert.ok(cappedMax <= .36000000001); assert.ok(diffuse > .001, 'illumination retained, not switched off or dimmed globally'); maxima.push({ weather, rawSpecularMaximum: rawMax, boundedSpecularMaximum: cappedMax, unchangedDiffuseMaximum: diffuse });
  }
  t.diagnostic(JSON.stringify({ scope: 'CPU fixed-r128 BRDF witness/grid, not GPU/pixel acceptance', originalWitness: witness, maxima }));
});
