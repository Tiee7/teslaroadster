import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const world = readFileSync(new URL('../src/world.js', import.meta.url), 'utf8');
const config = readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
const hud = readFileSync(new URL('../src/ui-hud.js', import.meta.url), 'utf8');
function section(source, first, last) {
  const start = source.indexOf(first), end = source.indexOf(last, start + first.length);
  assert.ok(start >= 0 && end > start, `Missing production section: ${first}`);
  return source.slice(start, end);
}

function harness() {
  const textures = [], canvases = [];
  class Texture {
    constructor(image) {
      this.image = image; this.repeat = { set(x, y) { this.x = x; this.y = y; } };
      textures.push(this);
    }
  }
  class DataTexture extends Texture {
    constructor(data, width, height, format) { super({ data, width, height }); this.format = format; }
  }
  class Material {
    constructor(options) { Object.assign(this, options); this.userData = {}; }
  }
  const THREE = { CanvasTexture: Texture, DataTexture, MeshStandardMaterial: Material,
    EquirectangularReflectionMapping: 303, RGBAFormat: 1023, RepeatWrapping: 1000,
    LinearFilter: 1006, LinearMipmapLinearFilter: 1008,
    MathUtils: { clamp: (n, low, high) => Math.min(high, Math.max(low, n)) } };
  const color = () => ({ setHex(hex) { this.hex = hex; } });
  const light = () => ({ color: color(), position: { set(...values) { this.values = values; } } });
  const scene = { background: color(), fog: { color: color() } };
  const context = vm.createContext({ THREE, Uint8Array, scene, window: {},
    document: { createElement() {
      const canvas = { fills: [], stops: [], getContext() { return {
        createLinearGradient() { return { addColorStop: (at, value) => canvas.stops.push({ at, value }) }; },
        fillRect: (...bounds) => canvas.fills.push(bounds),
      }; } }; canvases.push(canvas); return canvas;
    }, getElementById() { return {}; } },
    ROAD_WIDTH: 30, CITY_ROAD_WIDTH: 32, CITY_HALF_BOUND: 1200,
    weatherIndex: 0, studioEnvMap: { id: 'car-studio' }, marsSunsetEnvMap: { id: 'sunset' },
    ambientLight: light(), dirLight: light(), rimLight: light(),
    headlightSpotL: light(), headlightSpotR: light(), rainLinesMesh: {}, marsSunGroup: {},
    renderModalWeatherGrid() {}, applyTranslations() {}, sound: { beep() {} },
  });
  vm.runInContext(section(world, 'function createWetRoadEnv()', 'function createMarsSunsetEnv()'), context);
  vm.runInContext(section(world, 'const roadMat =', 'const roadMesh ='), context);
  vm.runInContext('let cityAsphaltMat = null; let cityAsphaltEWMat = null;\n' +
    section(world, '  cityAsphaltMat = new THREE.MeshStandardMaterial(', '  const yellowLineMat ='), context);
  vm.runInContext(config.slice(config.indexOf('const WEATHER_PRESETS =')), context);
  vm.runInContext(section(hud, 'function selectWeatherMode(', 'function cycleWeatherMode('), context);
  const get = expression => vm.runInContext(expression, context);
  return { context, scene, textures, canvases, get,
    materials: get('[roadMat, cityAsphaltMat, cityAsphaltEWMat]'),
    select: index => vm.runInContext(`selectWeatherMode(${index}, false)`, context) };
}

test('rain uses a dim road-only environment without studio softboxes; car environment is retained', () => {
  const h = harness(); h.select(1);
  const roadEnv = h.get('wetRoadEnvMap');
  assert.notEqual(roadEnv, h.scene.environment);
  assert.equal(h.scene.environment, h.context.studioEnvMap);
  assert.equal(roadEnv.mapping, h.context.THREE.EquirectangularReflectionMapping);
  const sky = h.canvases[0];
  assert.deepEqual(sky.fills, [[0, 0, 256, 128]], 'one continuous gradient, no white or cyan light rectangles');
  for (const { value } of sky.stops) {
    const components = value.slice(1).match(/../g).map(hex => parseInt(hex, 16));
    assert.ok(Math.max(...components) <= 42, 'night environment must stay dim');
  }
  for (const material of h.materials) {
    assert.equal(material.envMap, roadEnv);
    assert.equal(material.metalness, 0);
    assert.equal(material.roughness, 0.50);
    assert.equal(material.envMapIntensity, 0.55);
  }
});

test('all road axes have deterministic metre-scaled, mipmapped microdetail', () => {
  const h = harness();
  const dimensions = [[30, 2600], [32, 2400], [2400, 32]];
  const data = h.materials.map(material => material.userData.wetRoadDetail.image.data);
  assert.deepEqual(data[0], data[1]); assert.deepEqual(data[1], data[2]);
  h.materials.forEach((material, i) => {
    const texture = material.userData.wetRoadDetail;
    assert.equal(texture.image.width, 64); assert.equal(texture.image.height, 64);
    assert.equal(dimensions[i][0] / texture.repeat.x, 8);
    assert.equal(dimensions[i][1] / texture.repeat.y, 8);
    assert.equal(texture.wrapS, h.context.THREE.RepeatWrapping);
    assert.equal(texture.wrapT, h.context.THREE.RepeatWrapping);
    assert.equal(texture.generateMipmaps, true);
    assert.equal(texture.minFilter, h.context.THREE.LinearMipmapLinearFilter);
    const green = new Set();
    for (let p = 0; p < texture.image.data.length; p += 4) {
      const grain = texture.image.data[p]; green.add(grain);
      assert.ok(grain >= 240 && grain <= 255);
      assert.equal(texture.image.data[p + 1], grain);
      assert.equal(texture.image.data[p + 2], grain);
      assert.equal(texture.image.data[p + 3], 255);
    }
    assert.ok(green.size > 12, 'roughness varies locally rather than forming a flat mirror');
  });
});

test('wet roughness keeps a finite broad highlight instead of the old pin-sharp light peak', () => {
  const h = harness(); h.select(1);
  for (const material of h.materials) {
    const minimumRoughness = material.roughness * 240 / 255;
    assert.ok(minimumRoughness >= 0.47);
    // At N dot H = 1 the GGX distribution peak scales as 1 / roughness^4.
    // This bounds the material-level peak, not the final rendered pixel colour.
    assert.ok((minimumRoughness / 0.05) ** 4 > 600);
    assert.equal(material.bumpScale, 0.006);
    assert.equal(material.bumpMap, material.userData.wetRoadDetail);
    assert.equal(material.roughnessMap, material.userData.wetRoadDetail);
  }
});

test('r128 GGX rim-light mirror-direction peak stays below a clipped cyan core', () => {
  const h = harness(); h.select(1);
  const roughness = h.materials[0].roughness * 240 / 255;
  // Production rimLight direction (-40, 30, -50); view direction mirrored in
  // the road normal. Match Three r128's Schlick, correlated Smith and GGX,
  // including its PI light factor with physicallyCorrectLights disabled.
  assert.match(world, /rimLight\.position\.set\(-40, 30, -50\)/);
  const dotNL = 30 / Math.hypot(40, 30, 50), dotNV = dotNL, dotVH = dotNL;
  const alpha = roughness * roughness, alphaSquared = alpha * alpha;
  const fresnel = 0.04 + 0.96 * 2 ** ((-5.55473 * dotVH - 6.98316) * dotVH);
  const gv = dotNL * Math.sqrt(alphaSquared + (1 - alphaSquared) * dotNV * dotNV);
  const gl = dotNV * Math.sqrt(alphaSquared + (1 - alphaSquared) * dotNL * dotNL);
  const visibility = 0.5 / Math.max(gv + gl, 1e-6);
  const distribution = 1 / (Math.PI * alphaSquared);
  const intensity = h.get('WEATHER_PRESETS[1].rimIntensity');
  const peak = [14, 165, 233].map(channel =>
    channel / 255 * intensity * dotNL * Math.PI * fresnel * visibility * distribution);
  assert.ok(Math.max(...peak) < 1, `rim-only linear peak is too bright: ${peak}`);
  assert.ok(peak[0] < 0.1, 'rim reflection must not have a near-white core');
});

test('repeated weather changes restore both dry presets and reuse all road textures', () => {
  const h = harness();
  const count = h.textures.length;
  const offsets = h.materials.map(m => [m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits]);
  for (let cycle = 0; cycle < 8; cycle++) {
    for (const index of [1, 0, 1, 2, 0]) {
      h.select(index);
      const preset = h.get(`WEATHER_PRESETS[${index}]`);
      assert.equal(h.scene.environment, index === 2 ? h.context.marsSunsetEnvMap : h.context.studioEnvMap);
      for (const material of h.materials) {
        assert.equal(material.roughness, preset.roadRoughness);
        assert.equal(material.metalness, preset.roadMetalness);
        assert.equal(material.envMapIntensity, preset.roadEnvIntensity);
        assert.equal(material.envMap, preset.rain ? h.get('wetRoadEnvMap') : null);
        assert.equal(material.roughnessMap, preset.rain ? material.userData.wetRoadDetail : null);
        assert.equal(material.bumpMap, preset.rain ? material.userData.wetRoadDetail : null);
        assert.equal(material.needsUpdate, true);
      }
      assert.equal(h.textures.length, count, 'weather/map switches must not allocate more textures');
      assert.equal(h.context.rainLinesMesh.visible, preset.rain);
      assert.equal(h.context.marsSunGroup.visible, preset.marsSun);
    }
  }
  assert.deepEqual(h.materials.map(m => [m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits]), offsets);
});

test('road weather helper tolerates absent city materials without changing vehicle materials', () => {
  const h = harness();
  assert.doesNotThrow(() => h.get('applyRoadWeather(null, WEATHER_PRESETS[1])'));
  const wet = section(world, 'function applyRoadWeather(', 'function createMarsSunsetEnv(');
  assert.doesNotMatch(wet, /bodyMaterial|goldCanopyMaterial|headlight|scene\.environment\s*=/);
  assert.match(hud, /\[roadMat, cityAsphaltMat, cityAsphaltEWMat\]\.forEach/);
});
