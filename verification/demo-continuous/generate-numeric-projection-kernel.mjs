/**
 * Verification-only, source-pinned numeric projection prototype.
 *
 * Generation only reads source and writes the optional requested verification
 * artifact. It does not import the CPU harness, execute physics, or run a planner.
 * A generated kernel is deliberately narrower than a whole-page simulation.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isProxy } from 'node:util/types';

const DEFAULT_REPO = resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const EXPECTED_SOURCE_HASHES = Object.freeze({
  'src/config.js': 'e266a54510bd451a35d5a75fe3d330cc40204bacd681d23cfbe76a693eaf4d3f',
  'src/physics-main.js': 'ca0ce77283ac6fcedbc0b20db182778d3935ebe09f9f4cac4f8f9ba29f0aec13',
  'src/highway-demo.js': '30269219669489f3f1c228fc305eacd1032238bc1bcb0100a2bd9ebf6f06df43',
  'src/highway-traffic.js': 'faf6b646391504ea3661ec2e816b9b162ea3214fd0fea11c6d0f019b6cdfb108',
  'src/ui-hud.js': 'eda76a2f67268dacbcae89a299a9ef00af241648909a8a5e1f8b349e38079b7b',
  'src/audio.js': '5ef67352c4680a1b24c2f3e10a9caa584f8280ed2196bf7fbda67a4cfc35e2ee',
  'tests/helpers/demo-harness.mjs': '69868deb4aed37cc25c78828fdc9ef34eae4ffae217396b965807f7277f3feff',
  'tests/helpers/vendor/three-r128-MathUtils.mjs': '09ee4ebbae9976c1c9803eaafe5cb7553fcd58f34293fd557dc51c2ac8fe1f61'
});
export const CONTROL_PHYSICS_KEYS = Object.freeze(('x y z vx vy vz speed maxSpeed airMaxSpeed physicsMode insaneMode gasMassKg airStrafeSpeed steerInput steerAngle roll pitch yaw vRoll vPitch vYaw attitudeIdleSeconds accumulatedRoll lateralG longitudinalG prevSpeed airRemaining airUsedContinuous infiniteJet isFreefalling isAutoDescending8s isJumping6m isAltitudeHold isAutoLandingSave wasAirborne jumpInertiaSeconds jumpInertiaGraceSeconds driftAngle isDrifting wasHandbraking autoStabilizer isDestroyed hullIntegrity impactCooldown jumpStartY jumpTargetY holdTargetY hudMode hudMinimal').split(' '));
const sha256 = value => createHash('sha256').update(value).digest('hex');

/** Also a negative-test entry: supplied text is verified, never executed. */
export function verifyPinnedSources(repo = DEFAULT_REPO, textOverrides = {}) {
  const sources = {};
  for (const [name, expected] of Object.entries(EXPECTED_SOURCE_HASHES)) {
    const source = Object.hasOwn(textOverrides, name) ? textOverrides[name] : readFileSync(join(repo, name), 'utf8');
    if (typeof source !== 'string' || sha256(source) !== expected) {
      const error = Error(`Projection source mismatch: ${name}`);
      error.code = 'PROJECTION_SOURCE_MISMATCH'; error.source = name;
      throw error;
    }
    sources[name] = source;
  }
  for (const name of Object.keys(textOverrides)) if (!Object.hasOwn(EXPECTED_SOURCE_HASHES, name)) {
    const error = Error(`Unknown projection source override: ${name}`);
    error.code = 'PROJECTION_SOURCE_MISMATCH'; throw error;
  }
  return sources;
}

function exactSegment(sources, file, start, end, name, manifest) {
  const source = sources[file], begin = source.indexOf(start);
  const finish = end === null ? source.length : source.indexOf(end, begin + start.length);
  if (begin < 0 || finish < begin || source.indexOf(start, begin + start.length) !== -1)
    throw Error(`Unsupported or ambiguous extraction boundary: ${name}`);
  const text = source.slice(begin, finish);
  manifest.push({ name, file, begin, end: finish,
    firstLine: source.slice(0, begin).split('\n').length,
    lastLine: source.slice(0, finish).split('\n').length,
    sourceSha256: sha256(text), emittedSha256: sha256(text), transformations: [] });
  return text;
}

/** Copies only data. Accessors, executable objects and scene graphs fail closed. */
function cloneSnapshot(value, path = 'snapshot', seen = new Set()) {
  if (isProxy(value)) throw Error(`Proxy snapshot object at ${path}`);
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
    Object.defineProperty(copy, key, { value: cloneSnapshot(descriptor.value, `${path}.${key}`, seen),
      enumerable: descriptor.enumerable, writable: true, configurable: true });
  }
  if (Array.isArray(value)) copy.length = value.length;
  seen.delete(value);
  return copy;
}

function instantiateProjectionKernel({ repo = DEFAULT_REPO, programSource, manifest }) {
  repo = resolve(repo);
  // The same check runs before EVERY public numeric entry, including after a
  // factory was created. A source edit cannot silently keep an old kernel live.
  const assertSources = () => verifyPinnedSources(repo);
  assertSources();
  const stop = (reason, detail = null, kind = 'unsupported') => {
    const error = Error(reason); error.projectionBoundary = true;
    error.kind = kind; error.detail = detail; throw error;
  };
  // No ambient Math.random is called or patched. The only supported math
  // helpers are exact official-r128 clamp/lerp copied into programSource.
  const math = Object.create(Math);
  Object.defineProperty(math, 'random', { value: () => stop('random-call'), writable: false });
  Object.freeze(math);
  const compile = new Function('Math', 'stop', `"use strict";\n${programSource}`);
  const numeric = compile(math, stop);
  const failure = error => {
    if (!error.projectionBoundary) return { supported: false, collision: false,
      unsupported: { reason: 'unexpected-execution-boundary', name: error.name, message: error.message },
      state: null, cars: null, eligibleForComparison: false, reuseAuthorized: false };
    return { supported: false, collision: error.kind === 'collision',
      unsupported: error.kind === 'collision' ? null : { reason: error.message, detail: error.detail },
      contact: error.kind === 'collision' ? { reason: error.message, detail: error.detail } : null,
      state: null, cars: null, eligibleForComparison: false, reuseAuthorized: false };
  };
  const validate = request => {
    if (!request || typeof request !== 'object') stop('missing-request');
    const cloned = cloneSnapshot(request);
    const { state, cars, input, external } = cloned;
    if (!state || !Array.isArray(cars) || !input || !external) stop('missing-snapshot-input-or-external');
    if (Object.hasOwn(cloned, 'dt') && cloned.dt !== 1 / 60) stop('unsupported-step-dt');
    if (external.map !== 'highway' || external.active !== true || external.busy !== true)
      stop('unsupported-map-or-input-ownership');
    if (external.weatherIndex !== 0) stop('unsupported-weather-or-missing-weather-binding');
    if (typeof external.audioInitialized !== 'boolean') stop('missing-audio-initialized-binding');
    if (state.physicsMode !== 'realistic' || state.insaneMode !== false) stop('unsupported-physics-mode');
    if (state.isDestroyed !== false || state.isFreefalling !== false || state.impactCooldown !== 0 || state.isAltitudeHold !== false)
      stop('unsupported-destruction-freefall-cooldown-or-hold');
    const nullable = new Set(['jumpInertiaSeconds', 'jumpInertiaGraceSeconds', 'jumpStartY']);
    const flags = new Set(['physicsMode', 'insaneMode', 'infiniteJet', 'isFreefalling', 'isAutoDescending8s', 'isJumping6m',
      'isAltitudeHold', 'isAutoLandingSave', 'wasAirborne', 'isDrifting', 'wasHandbraking',
      'autoStabilizer', 'isDestroyed', 'hudMode', 'hudMinimal']);
    for (const key of flags) {
      if (key === 'physicsMode' || key === 'hudMode') continue;
      if (key === 'wasHandbraking' && state[key] === undefined) continue;
      if (typeof state[key] !== 'boolean') stop('invalid-control-physics-flag', key);
    }
    if (!['full', 'medium', 'minimal'].includes(state.hudMode)) stop('invalid-hud-mode');
    for (const key of CONTROL_PHYSICS_KEYS) {
      if (nullable.has(key) && (state[key] === null || state[key] === undefined)) continue;
      if (key === 'wasHandbraking' && state[key] === undefined) continue;
      if (!flags.has(key) && !Number.isFinite(state[key])) stop('invalid-control-physics-field', key);
    }
    const inputs = ['steer', 'throttle', 'boost', 'brake', 'reverse', 'handbrake', 'lift', 'descend', 'strafe', 'roll', 'pitch'];
    if (Object.keys(input).some(key => !inputs.includes(key))) stop('unknown-input-field');
    for (const key of inputs) if (!Number.isFinite(input[key]) || Math.abs(input[key]) > 1 ||
      (!['steer', 'strafe', 'roll', 'pitch'].includes(key) && input[key] < 0)) stop('invalid-drive-input', key);
    if (input.roll !== 0 || input.pitch !== 0 || input.lift !== 0 || input.descend !== 0)
      stop('unsupported-manual-rcs-lift-or-descend');
    const airborne = state.y > 0.15 || (state.isJumping6m && state.vy > 0);
    if (airborne && (input.boost !== 0 || input.throttle !== 0)) stop('unsupported-air-propulsion');
    const keys = external.keys;
    if (!Object.hasOwn(external, 'keys') || keys === null || typeof keys !== 'object' || Array.isArray(keys))
      stop('missing-or-invalid-direct-key-binding');
    if (Object.values(keys).some(value => typeof value !== 'boolean')) stop('nonboolean-direct-key');
    if (Object.values(keys).some(value => value)) stop('unsupported-direct-key');
    for (const [index, car] of cars.entries()) {
      if (car.mode !== 'highway' || car.blastTimer > 0 || (car.y || 0) !== 0 || car.recoverHighwayLane)
        stop('unsupported-npc-mode-blast-or-recovery', index);
      if (!car.mesh?.position || !car.mesh?.rotation || typeof car.mesh.visible !== 'boolean') stop('incomplete-npc-mesh-snapshot', index);
      for (const vector of [car.mesh.position, car.mesh.rotation])
        for (const axis of ['x', 'y', 'z']) if (!Number.isFinite(vector[axis])) stop('invalid-npc-transform', { index, axis });
      for (const key of ['speed', 'length', 'height']) if (!Number.isFinite(car[key])) stop('invalid-npc-field', { index, key });
    }
    return { ...cloned, keys };
  };
  const run = (request, jumpOnly) => {
    // Source mismatch is an explicit exception, never converted into a usable
    // fallback. Tests can catch its PROJECTION_SOURCE_MISMATCH code.
    assertSources();
    try {
      const cloned = validate(request);
      if (jumpOnly && cloned.external.audioInitialized !== true) stop('jump-requires-initialized-audio');
      if (jumpOnly && (cloned.external.requestingJump !== true ||
        !Number.isFinite(cloned.jumpHeight) || !Number.isFinite(cloned.jumpGraceSeconds))) stop('missing-jump-contract');
      const result = numeric(cloned, jumpOnly);
      if (!result) stop('numeric-body-returned-without-result');
      return { supported: true, collision: false, unsupported: null, ...result,
        controlState: Object.fromEntries(CONTROL_PHYSICS_KEYS.map(key => [key, result.state[key]])),
        eligibleForComparison: true, reuseAuthorized: false };
    } catch (error) { return failure(error); }
  };
  return Object.freeze({
    manifest, fixedDt: 1 / 60, controlPhysicsKeys: CONTROL_PHYSICS_KEYS,
    step: request => run(request, false),
    triggerJump6m: request => run(request, true),
    assertSources,
    // Executes only the same boundary guards, never physics or a planner.
    // Negative tests can verify random/unknown visual/impact rejection directly.
    probeBoundary: kind => {
      assertSources();
      try { numeric.probeBoundary(kind); return { rejected: false }; }
      catch (error) { return { rejected: true, ...failure(error) }; }
    }
  });
}

export function generateNumericProjectionKernel({ repo = DEFAULT_REPO } = {}) {
  repo = resolve(repo);
  const sources = verifyPinnedSources(repo), segments = [];
  const take = (file, start, end, name) => exactSegment(sources, file, start, end, name, segments);
  const constants = take('src/config.js', 'const ROAD_WIDTH =', 'const state =', 'world-tank-mass-constants');
  const helpers = take('src/physics-main.js', 'function wrapAnglePi(', '// Keep the chase rig', 'numeric-and-busy-input-helpers');
  let body = take('src/physics-main.js', '  const isRealMode =', '  const playerWorldZ =', 'motion-gas-altitude-attitude-body');
  let contact = take('src/physics-main.js', '    const dx = Math.abs(state.x - car.mesh.position.x);', '\n  // Render the resolved pose', 'npc-contact-body');
  // Only remove the enclosing production forEach terminator. Contact arithmetic
  // and its relative-sweep function are otherwise byte-for-byte source text.
  const terminator = /\n  \}\);\s*$/;
  if (!terminator.test(contact)) throw Error('Unsupported contact forEach terminator');
  contact = contact.replace(terminator, '');
  const gFeedback = take('src/physics-main.js', '  const accelMs2 =', '\n  // Rotate 3D Tesla Yoke Steering Wheel', 'real-g-feedback-tail');
  const traffic = take('src/highway-traffic.js', '// Highway-only traffic.', null, 'complete-highway-traffic-module');
  const geometry = take('src/highway-demo.js', '  const handling =', '  const neutral =', 'demo-handling-and-swept-contact-only');
  const jump = take('src/ui-hud.js', 'function triggerJump6m() {', 'function toggleAltitudeHold() {', 'numeric-jump-trigger');
  const banner = take('src/ui-hud.js', 'function showBanner(', 'function renderBannerText()', 'banner-state-write-before-dom');
  const clamp = take('tests/helpers/vendor/three-r128-MathUtils.mjs', 'function clamp(', 'function euclideanModulo(', 'official-r128-clamp');
  const lerp = take('tests/helpers/vendor/three-r128-MathUtils.mjs', 'function lerp(', 'function damp(', 'official-r128-lerp');
  // Collision response requires shared page RNG, effects and lifecycle. Reject
  // before those are invoked; never turn collision off or repair actual state.
  const inject = (text, from, to, name, description) => {
    if (text.split(from).length !== 2) throw Error(`Unsupported instrumentation boundary: ${description}`);
    const emitted = text.replace(from, to), entry = segments.find(segment => segment.name === name);
    entry.transformations.push(description); entry.emittedSha256 = sha256(emitted); return emitted;
  };
  body = inject(body, '    if (state.x < -halfRoad || state.x > halfRoad) {',
    "    if (state.x < -halfRoad || state.x > halfRoad) {\n      stop('highway-rail-contact', null, 'collision');",
    'motion-gas-altitude-attitude-body', 'insert fail-closed guard at true highway rail branch before correction');
  contact = inject(contact, '        } else if (state.vy < 0 && clearanceY < 0.15) {',
    "        } else if (state.vy < 0 && clearanceY < 0.15) {\n          stop('npc-roof-bounce-contact', {index:carIndex}, 'collision');",
    'npc-contact-body', 'insert fail-closed guard at true roof-bounce branch before response');
  contact = inject(contact, '      } else if (clearanceY < -0.15) {',
    "      } else if (clearanceY < -0.15) {\n        stop('npc-body-contact', {index:carIndex}, 'collision');",
    'npc-contact-body', 'insert fail-closed guard at true body-contact branch before response');
  const contactEntry = segments.find(segment => segment.name === 'npc-contact-body');
  contactEntry.transformations.unshift('remove enclosing production trafficCars.forEach terminator only');
  contactEntry.emittedSha256 = sha256(contact);
  const programSource = `
${clamp}\n${lerp}
const THREE = Object.freeze({MathUtils:Object.freeze({clamp,lerp})});
${constants}\n${geometry}
const RoadsterHighwayDemoPlanner=Object.freeze({handling,sweptContact});
${traffic}
function receivers(state,external,events){
  const unknown=(receiver,method)=>stop('unknown-visual-call',{receiver,method:String(method)});
  const known=(receiver,methods)=>new Proxy(Object.freeze(methods),{get(target,key){
    if(!Object.hasOwn(target,key))return (...args)=>unknown(receiver,key);
    return target[key];
  }});
  const sound=known('sound',{
    init(){if(external.audioInitialized!==true)stop('audio-init-may-consume-shared-rng');events.push({kind:'audio-init-already-initialized'});},
    beep(...args){events.push({kind:'beep',args});},
    speakAlert(...args){events.push({kind:'speakAlert',args});}
  });
  const document=known('document',{getElementById(id){
    if(id!=='key-n')return unknown('document.getElementById',id);
    return {classList:known('key-n.classList',{remove(token){
      if(token!=='active')return unknown('key-n.classList.remove',token);
      events.push({kind:'remove-key-n-active'});
    }})};
  }});
  const renderBannerText=()=>events.push({kind:'renderBannerText',type:state.bannerType,timer:state.bannerTimer});
  return {sound,document,renderBannerText};
}
function numeric(request,jumpOnly){
  const state=request.state,trafficCars=request.cars,keys=request.keys;
  const dt=1/60,currentMap='highway',weatherIndex=0,cityBuildings=[];
  const input=request.input,external=request.external,events=[];
  const {sound,document,renderBannerText}=receivers(state,external,events);
  const frontWheelSteerGroups=Object.freeze([]);
  const window=Object.freeze({RoadsterDemo:Object.freeze({isActive:()=>external.active,isBusy:()=>external.busy,
    isRequestingJump:()=>external.requestingJump===true,input:()=>input,
    jumpHeight:()=>request.jumpHeight,jumpGraceSeconds:()=>request.jumpGraceSeconds})});
  const globalThis=Object.freeze({window});
  const triggerPhysicsCollision=(...args)=>stop('physics-impact-request',{args},'collision');
${banner}\n${helpers}\n${jump}
  if(jumpOnly){triggerJump6m();return {state,cars:trafficCars,events,dt:0,jumpOnly:true};}
  state.impactCooldown=Math.max(0,state.impactCooldown-dt);
${body}
  const playerWorldZ=0;
  highwayTraffic.forecastStep(trafficCars,{x:state.x,y:state.y,z:0,vx:state.vx,vz:state.vz},dt,LANE_CENTERS,WORLD_SPEED_SCALE);
  trafficCars.forEach((car,carIndex)=>{
${contact}
  });
${gFeedback}
  return {state,cars:trafficCars,events,dt,isAirborne,isRearThrusterFiring,isLiftFiring,airConsumedThisFrame};
}
numeric.probeBoundary=kind=>{
  const {sound,document}=receivers({}, {audioInitialized:false}, []);
  if(kind==='random')return Math.random();
  if(kind==='unknown-sound')return sound.unsupportedMethod();
  if(kind==='unknown-dom')return document.getElementById('unsupported-node');
  if(kind==='audio-init')return sound.init();
  if(kind==='collision')return stop('physics-impact-request',null,'collision');
  return stop('unknown-boundary-probe',kind);
};
return numeric;
`;
  const manifest = Object.freeze({ schema: 'verification-numeric-projection-prototype-v1',
    sourceHashes: EXPECTED_SOURCE_HASHES, programSourceSha256: sha256(programSource), segments,
    fixedDt: '1 / 60', controlPhysicsKeys: CONTROL_PHYSICS_KEYS,
    scope: 'highway realistic normal-mode; explicit weatherIndex=0 fixed oracle domain; busy demo input; explicit all-released external.keys object, including Q/E; initial no freefall; no manual RCS/lift/descend/hold/air propulsion; no blast/recovery/contact',
    qualification: 'Prototype, not executed or equivalence-validated by this generator. Boundary guards do not expand the named strict bridge proof or authorize production reuse, wider keys, or full-page/RNG equivalence.',
    omittedRegions: ['planner execution and route/history updates', 'render/visual/audio execution', 'full-frame random draws',
      'post-playerWorldZ suspension, tire smoke, thruster/DOM visuals, road props', 'scoring and thermal/visual instrumentation',
      'collision random response, destruction, blast and lifecycle'],
    auditedReceivers: ['showBanner retains original bannerType/bannerTimer assignments; renderBannerText records only',
      'sound.beep and sound.speakAlert have no force/player/NPC/RNG feedback in pinned audio source',
      'sound.init accepted only with explicit audioInitialized=true; pinned init returns before RNG in that case',
      'document.getElementById accepts only key-n and classList.remove(active); all other calls reject',
      'empty frontWheelSteerGroups omits only rotation.y writes; no physical reader',
      'Math.random always rejects; unknown receiver calls reject'],
    rejection: 'Mismatch rejects before entry; unsupported/contact returns no endpoint. No actual state/input/keys/traffic/global object is mutated.' });
  const moduleSource = `// Generated verification-only prototype. Regenerate; never edit production files.\n` +
    `import {readFileSync} from 'node:fs';\nimport {createHash} from 'node:crypto';\nimport {resolve,join} from 'node:path';\nimport {fileURLToPath} from 'node:url';\nimport {isProxy} from 'node:util/types';\n` +
    `const DEFAULT_REPO=resolve(fileURLToPath(new URL('../..',import.meta.url)));\n` +
    `export const EXPECTED_SOURCE_HASHES=Object.freeze(${JSON.stringify(EXPECTED_SOURCE_HASHES)});\n` +
    `export const CONTROL_PHYSICS_KEYS=Object.freeze(${JSON.stringify(CONTROL_PHYSICS_KEYS)});\n` +
    `const sha256=${sha256.toString()};\nexport ${verifyPinnedSources.toString()}\n${cloneSnapshot.toString()}\n${instantiateProjectionKernel.toString()}\n` +
    `export const manifest=Object.freeze(${JSON.stringify(manifest,null,2)});\nconst programSource=${JSON.stringify(programSource)};\n` +
    `export function createNumericProjectionKernel(options={}){return instantiateProjectionKernel({...options,programSource,manifest});}\n`;
  return { programSource, manifest, moduleSource };
}

export function createNumericProjectionKernel({ repo = DEFAULT_REPO } = {}) {
  return instantiateProjectionKernel({ repo, ...generateNumericProjectionKernel({ repo }) });
}

// Default invocation only emits code + a manifest. It never calls a numeric entry.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const ownFile = fileURLToPath(import.meta.url);
  const output = resolve(process.argv[2] || join(dirname(ownFile), 'numeric-projection-kernel.generated.mjs'));
  if (dirname(output) !== dirname(ownFile) || !output.endsWith('.generated.mjs') || output === ownFile)
    throw Error('Output must be a separate *.generated.mjs file in verification/demo-continuous');
  const { moduleSource, manifest } = generateNumericProjectionKernel();
  writeFileSync(output, moduleSource);
  writeFileSync(output.replace(/\.mjs$/, '') + '.manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ output, generatedOnly: true, programSourceSha256: manifest.programSourceSha256 }) + '\n');
}
