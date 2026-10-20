/** Build-time only. No physics, planner, browser, or generated entry is run. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generateNumericProjectionKernel, EXPECTED_SOURCE_HASHES,
  CONTROL_PHYSICS_KEYS, verifyPinnedSources } from './generate-numeric-projection-kernel.mjs';

const DEFAULT_REPO = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const GENERATOR_SHA256 = '0c2d10eb3890eb9d627959ed653e8b093d7f35d33e4fb8fa43b01ed7107a34cb';
const EXPECTED_NUMERIC_PROGRAM_SHA256 = 'cb4aa0c07c2eb14414aef08ae9856ceb884eb0cf7057f4cd23653f0fc448eeb4';
const MINIFIED_THREE_SHA256 = '9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2';
const MATH_PROFILES_SHA256 = '2d588d45a973970ea3bb253e9eeeafee137fa923785ec107d846498859a9ba3a';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const replaceOnce = (source, from, to) => {
  if (source.split(from).length !== 2) throw Error(`Unsupported static-emitter boundary: ${from}`);
  return source.replace(from, to);
};

// Frozen source formatting is itself pinned. Functions close on their own
// indentation, never on nested bodies. No parser/eval/Function is used here.
function functionSource(source, name, indent = '') {
  const marker = `function ${name}(`, begin = source.indexOf(marker);
  if (begin < 0 || source.indexOf(marker, begin + marker.length) !== -1) throw Error(`Ambiguous function ${name}`);
  const close = source.indexOf(`\n${indent}}\n`, begin);
  if (close < 0) throw Error(`Missing pinned function end ${name}`);
  return source.slice(begin, close + indent.length + 2);
}

function exactBlock(source, start, end) {
  const begin = source.indexOf(start), finish = source.indexOf(end, begin + start.length);
  if (begin < 0 || finish < begin || source.indexOf(start, begin + start.length) !== -1) throw Error(`Ambiguous block ${start}`);
  return source.slice(begin, finish);
}

function cloneTrustedSnapshot(value, path = 'snapshot', seen = new Set()) {
  // Browser JavaScript has no isProxy intrinsic. This entry is for trusted
  // plain-data snapshots from the verified internal producer only. Hostile
  // proxies/getters/observers are outside that contract, never advertised safe.
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint')
      throw Error(`Unsupported snapshot value at ${path}`);
    return value;
  }
  if (seen.has(value)) throw Error(`Cyclic snapshot at ${path}`);
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null)
    throw Error(`Non-data snapshot object at ${path}`);
  seen.add(value);
  const copy = Array.isArray(value) ? [] : Object.create(prototype);
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === 'length') continue;
    if (typeof key !== 'string') throw Error(`Symbol snapshot key at ${path}`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!Object.hasOwn(descriptor, 'value')) throw Error(`Snapshot accessor at ${path}.${key}`);
    Object.defineProperty(copy, key, { value: cloneTrustedSnapshot(descriptor.value, `${path}.${key}`, seen),
      enumerable: descriptor.enumerable, writable: true, configurable: true });
  }
  if (Array.isArray(value)) copy.length = value.length;
  seen.delete(value);
  return copy;
}

function makeIdentityBinder({ readReferences, expectedFunctions, expectedConstants, expectedHandling, profiles }) {
  const toString = Function.prototype.toString;
  let cached = null, selectedProfile = null;
  const reject = detail => {
    const error = Error(`Projection runtime identity mismatch: ${detail}`);
    error.code = 'PROJECTION_RUNTIME_IDENTITY_MISMATCH'; error.detail = detail; throw error;
  };
  const sameData = (expected, actual, path) => {
    if (expected === null || actual === null || typeof expected !== 'object' || typeof actual !== 'object') {
      if (!Object.is(expected, actual)) reject(path);
      return;
    }
    if (Array.isArray(expected) !== Array.isArray(actual)) reject(path);
    const keys = Object.keys(expected);
    if (keys.length !== Object.keys(actual).length) reject(`${path}.keys`);
    for (const key of keys) {
      if (!Object.hasOwn(actual, key)) reject(`${path}.${key}.missing`);
      sameData(expected[key], actual[key], `${path}.${key}`);
    }
  };
  const assertRuntime = () => {
    const current = readReferences();
    if (!current || !current.functions || !current.math || !current.constants || !current.handling) reject('missing-bindings');
    const names = Object.keys(expectedFunctions);
    if (Object.keys(current.functions).length !== names.length) reject('function-keys');
    sameData(expectedConstants, current.constants, 'constants');
    sameData(expectedHandling, current.handling, 'handling');
    if (cached) {
      for (const name of names) if (current.functions[name] !== cached.functions[name]) reject(`${name}.reference`);
      if (current.math.clamp !== cached.math.clamp || current.math.lerp !== cached.math.lerp) reject('math.reference');
      if (current.handling !== cached.handling) reject('handling.reference');
      return true;
    }
    for (const name of names) {
      const fn = current.functions[name];
      if (typeof fn !== 'function' || toString.call(fn) !== expectedFunctions[name]) reject(`${name}.source`);
    }
    if (typeof current.math.clamp !== 'function' || typeof current.math.lerp !== 'function') reject('math.missing');
    const clamp = toString.call(current.math.clamp), lerp = toString.call(current.math.lerp);
    const matched = profiles.find(profile => profile.clampSource === clamp && profile.lerpSource === lerp);
    if (!matched) reject('math.unknown-profile');
    selectedProfile = matched.id;
    cached = { functions: { ...current.functions }, math: { ...current.math }, handling: current.handling };
    return true;
  };
  return { assertRuntime, identity: () => ({ bound: !!cached, mathProfile: selectedProfile }) };
}

/** Build-only: returns a classic-script literal and its frozen identity manifest. */
export function emitBrowserStaticProjection({ repo = DEFAULT_REPO,
  mathProfilesPath = join(repo, 'verification/demo-continuous/numeric-math-identity-profiles.json') } = {}) {
  repo = resolve(repo);
  const sources = verifyPinnedSources(repo);
  const generator = readFileSync(join(repo, 'verification/demo-continuous/generate-numeric-projection-kernel.mjs'), 'utf8');
  if (sha256(generator) !== GENERATOR_SHA256) throw Error('Frozen Node generator changed; explicit new epoch required');
  const { programSource, manifest: numericalManifest } = generateNumericProjectionKernel({ repo });
  if (sha256(programSource) !== EXPECTED_NUMERIC_PROGRAM_SHA256) throw Error('Numerical program changed; explicit new equivalence epoch required');
  const profileText = readFileSync(mathProfilesPath, 'utf8');
  if (sha256(profileText) !== MATH_PROFILES_SHA256) throw Error('Audited math profile artifact changed; explicit review required');
  const profileData = JSON.parse(profileText), recorded = profileData.profiles;
  if (profileData.schemaVersion !== 1 || profileData.kind !== 'exact-math-function-identity-profiles' ||
    !Array.isArray(recorded) || recorded.length !== 2) throw Error('Exactly two audited math identity profiles required');
  const cpu = recorded.find(profile => profile.id === 'three-r128-cpu-vendor-uncompressed');
  const minified = recorded.find(profile => profile.id === 'three-r128-browser-bundle-minified');
  if (!cpu || !minified || cpu.artifactSha256 !== EXPECTED_SOURCE_HASHES['tests/helpers/vendor/three-r128-MathUtils.mjs'] ||
    minified.bundleSha256 !== MINIFIED_THREE_SHA256 || profileData.comparison?.allObjectIsEqual !== true ||
    profileData.comparison?.allKnownExpectedPassed !== true)
    throw Error('Unrecognized or unverified math identity profile set');
  for (const profile of recorded) for (const name of ['clamp', 'lerp'])
    if (typeof profile.functions?.[name]?.source !== 'string' || sha256(profile.functions[name].source) !== profile.functions[name].sha256)
      throw Error('Missing or altered exact math function source');
  const profiles = recorded.map(profile => ({id:profile.id,bundleSha256:profile.artifactSha256,
    clampSource:profile.functions.clamp.source,lerpSource:profile.functions.lerp.source}));
  const physics = sources['src/physics-main.js'], hud = sources['src/ui-hud.js'];
  const helpers = ['wrapAnglePi', 'getAirCoastSpeed', 'advanceAirHandling', 'getResponsiveAirCoastSpeed', 'addAirThrust',
    'getGroundCoastSpeed', 'accelerateGroundSpeed', 'getRetroBrakeDemand', 'integrateFreefall',
    'readDriveInput', 'readAttitudeInput', 'advanceAttitudeIdle'];
  const expectedFunctions = Object.fromEntries(['updateSimulation', ...helpers].map(name => [name, functionSource(physics, name)]));
  expectedFunctions.triggerJump6m = functionSource(hud, 'triggerJump6m');
  expectedFunctions.trafficStep = functionSource(sources['src/highway-traffic.js'], 'step', '  ');
  expectedFunctions.trafficForecastStep = functionSource(sources['src/highway-traffic.js'], 'forecastStep', '  ');
  expectedFunctions.demoSweptContact = functionSource(sources['src/highway-demo.js'], 'sweptContact');
  const configConstants = exactBlock(sources['src/config.js'], 'const ROAD_WIDTH =', 'const state =');
  const helperText = exactBlock(physics, 'function wrapAnglePi(', '// Keep the chase rig');
  const extraConstantLines = helperText.split('\n').filter(line => /^const [A-Z][A-Z0-9_]* =/.test(line));
  const constantNames = [...configConstants.matchAll(/^const ([A-Z][A-Z0-9_]*) =/gm), ...extraConstantLines.join('\n').matchAll(/^const ([A-Z][A-Z0-9_]*) =/gm)].map(match => match[1]);
  const constantsCode = `${configConstants}\n${extraConstantLines.join('\n')}\nreturn {${constantNames.join(',')}};`;
  const geometry = exactBlock(sources['src/highway-demo.js'], '  const handling =', '  const neutral =');
  const numericalWrapper = exactBlock(generator, 'function instantiateProjectionKernel(', '\nexport function generateNumericProjectionKernel(').trimEnd();
  let wrapper = replaceOnce(numericalWrapper,
    'function instantiateProjectionKernel({ repo = DEFAULT_REPO, programSource, manifest }) {',
    'function instantiateBrowserProjectionKernel({ manifest, assertRuntime }) {');
  wrapper = replaceOnce(wrapper, `  repo = resolve(repo);\n  // The same check runs before EVERY public numeric entry, including after a\n  // factory was created. A source edit cannot silently keep an old kernel live.\n  const assertSources = () => verifyPinnedSources(repo);`,
    '  const assertSources = assertRuntime;');
  wrapper = replaceOnce(wrapper,
    '  const compile = new Function(\'Math\', \'stop\', `"use strict";\\n${programSource}`);\n  const numeric = compile(math, stop);',
    '  const numeric = createNumericCore(math, stop);');
  const manifest = {
    schema: 'verification-browser-static-projection-v1', numericalProgramSourceSha256: sha256(programSource),
    sourceHashes: EXPECTED_SOURCE_HASHES, nodeGeneratorSha256: GENERATOR_SHA256,
    mathIdentityProfilesSha256: sha256(profileText), mathProfiles: profiles.map(({ id, bundleSha256 }) => ({ id, bundleSha256 })),
    functionSources: Object.fromEntries(Object.entries(expectedFunctions).map(([name, source]) => [name, {sha256:sha256(source),length:source.length}])),
    numericalSegments: numericalManifest.segments,
    buildRule: 'All complete source bytes and the frozen generator must match. Any mismatch requires an explicit new epoch; do not refresh automatically.',
    runtimeRule: 'First bind exact Function.prototype.toString for actual named functions plus exact constant/handling values and one audited math pair; every later entry checks cached function/math/handling references and constant values.',
    snapshotContract: 'Trusted plain internal lossless data only; no hostile Proxy/accessor/prototype/observer input. Browser JavaScript has no isProxy intrinsic; this does not widen the Node adversarial-input proof.',
    oracleBoundary: 'CPU harness may declare the complete updateSimulation function for source identity only; its numerical oracle still executes only the established extracted body/contact/G regions, not full updateSimulation or page rendering.',
    productionAuthority: 'Prototype only. Existing strict bridge scope and every phase/route/history/NPC/ownership/budget condition remain required. This module never independently grants reuse authority.'
  };
  const directFunctions = ['updateSimulation', ...helpers, 'triggerJump6m'].map(name => `${name}`).join(',');
  const browserSource = `// Generated verification-only static prototype. No runtime compilation or filesystem access.\n` +
    `// PROJECTION_MANIFEST_BEGIN\n// ${JSON.stringify(manifest)}\n// PROJECTION_MANIFEST_END\n` +
    `const RoadsterDemoNumericProjection = (()=>{\n'use strict';\n` +
    `const manifest=Object.freeze(${JSON.stringify(manifest)});\nconst CONTROL_PHYSICS_KEYS=Object.freeze(${JSON.stringify(CONTROL_PHYSICS_KEYS)});\n` +
    `const expectedFunctions=Object.freeze(${JSON.stringify(expectedFunctions)});\nconst profiles=Object.freeze(${JSON.stringify(profiles)});\n` +
    `const expectedConstants=(()=>{${constantsCode}})();\nconst expectedHandling=(()=>{${geometry}\nreturn handling;})();\n` +
    `${cloneTrustedSnapshot.toString().replaceAll('cloneTrustedSnapshot', 'cloneSnapshot')}\n` +
    `${makeIdentityBinder.toString()}\n` +
    `function createNumericCore(Math,stop){\n'use strict';\n${programSource}\n}\n` +
    `${wrapper}\n` +
    `const readActualReferences=()=>({functions:{${directFunctions},trafficStep:highwayTraffic.step,trafficForecastStep:highwayTraffic.forecastStep,demoSweptContact:RoadsterHighwayDemoPlanner.sweptContact},math:{clamp:THREE.MathUtils.clamp,lerp:THREE.MathUtils.lerp},constants:{${constantNames.join(',')}},handling:RoadsterHighwayDemoPlanner.handling});\n` +
    `function createBound(readReferences){const binding=makeIdentityBinder({readReferences,expectedFunctions,expectedConstants,expectedHandling,profiles});const kernel=instantiateBrowserProjectionKernel({manifest,assertRuntime:binding.assertRuntime});return Object.freeze({...kernel,assertRuntime:binding.assertRuntime,identity:binding.identity});}\n` +
    `return Object.freeze({manifest,create:()=>createBound(readActualReferences),createForVerification:readReferences=>{if(typeof readReferences!=='function')throw TypeError('Explicit verification-only reference reader required');return createBound(readReferences);}});\n})();\n`;
  if (/\bnew\s+Function\s*\(|\beval\s*\(|node:fs|node:crypto|readFileSync|createHash/.test(browserSource))
    throw Error('Forbidden runtime compiler/filesystem/hash operation in browser artifact');
  const browserModuleSource = `${browserSource}\nexport { RoadsterDemoNumericProjection };\n`;
  const identityDeclarationsSource = `// Identity-only CPU declarations. NEVER execute these functions.\n` +
    `export const declaredUpdateSimulation = ${expectedFunctions.updateSimulation};\n` +
    `export const declaredTriggerJump6m = ${expectedFunctions.triggerJump6m};\n`;
  return { browserSource, browserModuleSource, identityDeclarationsSource, manifest };
}

/** Build integration must run this check before using a checked-in artifact. */
export function verifyBrowserStaticProjectionBuild(artifactPath, repo = DEFAULT_REPO) {
  const source = readFileSync(artifactPath, 'utf8');
  const match = source.match(/\/\/ PROJECTION_MANIFEST_BEGIN\n\/\/ (.+)\n\/\/ PROJECTION_MANIFEST_END/);
  if (!match) throw Error('Missing static projection build manifest');
  const manifest = JSON.parse(match[1]);
  if (manifest.schema !== 'verification-browser-static-projection-v1' || manifest.numericalProgramSourceSha256 !== EXPECTED_NUMERIC_PROGRAM_SHA256)
    throw Error('Unknown static projection epoch');
  for (const [name, expected] of Object.entries(manifest.sourceHashes))
    if (sha256(readFileSync(join(repo, name), 'utf8')) !== expected) throw Error(`Stale static projection source: ${name}`);
  const regenerated = emitBrowserStaticProjection({ repo });
  if (source !== regenerated.browserSource) throw Error('Static projection artifact differs from exact current emission');
  return { valid: true, artifactSha256: sha256(source), manifest };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const folder = dirname(fileURLToPath(import.meta.url));
  const output = join(folder, 'browser-static-projection.generated.js');
  const productionOutput = join(DEFAULT_REPO, 'src/demo-numeric-projection.js');
  if (process.argv.includes('--check')) {
    const result = verifyBrowserStaticProjectionBuild(output);
    const production = verifyBrowserStaticProjectionBuild(productionOutput);
    if (result.artifactSha256 !== production.artifactSha256)
      throw Error('Production projection artifact differs from verification mirror');
    const emitted = emitBrowserStaticProjection();
    if (readFileSync(join(folder, 'browser-static-projection.generated.mjs'), 'utf8') !== emitted.browserModuleSource ||
      readFileSync(join(folder, 'browser-static-projection-identity.generated.mjs'), 'utf8') !== emitted.identityDeclarationsSource)
      throw Error('Stale static module or identity-only declarations');
    process.stdout.write(JSON.stringify({ valid: result.valid, artifactSha256: result.artifactSha256,
      productionOutput, productionMirrorExact: true }) + '\n');
  } else {
    const { browserSource, browserModuleSource, identityDeclarationsSource, manifest } = emitBrowserStaticProjection();
    writeFileSync(output, browserSource);
    writeFileSync(productionOutput, browserSource);
    writeFileSync(join(folder, 'browser-static-projection.generated.mjs'), browserModuleSource);
    writeFileSync(join(folder, 'browser-static-projection-identity.generated.mjs'), identityDeclarationsSource);
    writeFileSync(join(folder, 'browser-static-projection.manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    process.stdout.write(JSON.stringify({ output, productionOutput, emittedOnly: true, artifactSha256: sha256(browserSource) }) + '\n');
  }
}
