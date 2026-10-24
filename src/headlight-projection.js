// Presentation-only headlamp projection adapter. Load after the immutable UI
// owner; never change its weather policy or any numeric projection source.
(() => {
  'use strict';
let headlampProjectionIssue = null;
function enforceHeadlampProjectionSafety() {
  if (!headlampProjectionIssue) return true;
  for (const light of [headlightSpotL, headlightSpotR]) { light.intensity = 0; light.visible = false; }
  return false;
}
function reportHeadlampProjectionIssue(reason) {
  if (!headlampProjectionIssue) console.warn('Headlamp projection disabled: ' + reason);
  headlampProjectionIssue = reason;
  enforceHeadlampProjectionSafety();
  const notice = document.getElementById('headlight-status');
  if (notice) { notice.hidden = false; notice.textContent = 'Headlamp projection compatibility error / 大灯投射兼容检查失败'; }
}
function roadHeadlampShaderPatch() {
  // Pinned r128 layout. Do not silently carry a string patch to a new shader.
  const chunk = THREE.ShaderChunk?.lights_fragment_begin;
  const spot = '#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )';
  const dir = '#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )';
  const call = 'RE_Direct( directLight, geometry, material, reflectedLight );';
  const count = (text, needle) => text.split(needle).length - 1;
  if (THREE.REVISION !== '128' || !chunk || count(chunk, spot) !== 1 || count(chunk, dir) !== 1) return null;
  const a = chunk.indexOf(spot), b = chunk.indexOf(dir);
  if (b <= a || count(chunk.slice(a, b), call) !== 1) return null;
  return chunk.slice(0, a) + chunk.slice(a, b).replace(call, 'roadsterHeadlampDirect( directLight, geometry, material, reflectedLight );') + chunk.slice(b);
}
function prepareRoadHeadlampResponse() {
  const chunk = roadHeadlampShaderPatch();
  if (!chunk) { reportHeadlampProjectionIssue('unsupported Three shader layout'); return false; }
  // Only the three highway/city asphalt materials and the two car SpotLights.
  // Diffuse lighting, point/directional lights, environment, road textures and
  // every weather material value remain unchanged. Never alter global tone map.
  for (const material of [roadMat, cityAsphaltMat, cityAsphaltEWMat]) {
    material.userData ||= {};
    if (material.userData.roadsterHeadlampResponse) continue;
    const previous = material.onBeforeCompile, previousKey = material.customProgramCacheKey;
    material.onBeforeCompile = function (shader, renderer) {
      previous?.call(this, shader, renderer);
      const physical = '#include <lights_physical_pars_fragment>', lights = '#include <lights_fragment_begin>';
      if (shader.fragmentShader.split(physical).length !== 2 || shader.fragmentShader.split(lights).length !== 2) { reportHeadlampProjectionIssue('shader include mismatch'); return; }
      // A helper call avoids local-variable redeclarations or nested blocks in
      // r128's pragma-unrolled loop. Only each spot's GGX specular delta is capped.
      const helper = `
void roadsterHeadlampDirect( const in IncidentLight directLight, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  vec3 roadsterSpecularBefore = reflectedLight.directSpecular;
  RE_Direct( directLight, geometry, material, reflectedLight );
  reflectedLight.directSpecular = roadsterSpecularBefore + min( max( reflectedLight.directSpecular - roadsterSpecularBefore, vec3( 0.0 ) ), vec3( 0.18 ) );
}
`;
      shader.fragmentShader = shader.fragmentShader.replace(physical, physical + helper).replace(lights, chunk);
    };
    material.customProgramCacheKey = function () { return (previousKey?.call(this) || '') + '|roadster-headlamp-r128-specular-v1'; };
    material.userData.roadsterHeadlampResponse = true; material.needsUpdate = true;
  }
  return !headlampProjectionIssue;
}
const originalSync = syncVehicleWeatherLights;
syncVehicleWeatherLights = function (previewRoot = null) {
  const compatible = prepareRoadHeadlampResponse();
  originalSync(previewRoot);
  const apply = light => {
    if (!light) return;
    light.angle = 7 * Math.PI / 180; light.penumbra = .8; light.distance = 38; light.decay = 2;
    if (light.target && light.parent) {
      // Native r128 clones detach this target; attach only the clone's own copy.
      if (light.target.parent !== light.parent) light.parent.add(light.target);
      light.target.position.set(light.position.x + Math.sign(light.position.x) * .03, light.position.y - Math.tan(10 * Math.PI / 180) * 18, light.position.z - 18);
    }
    if (!compatible) { light.intensity = 0; light.visible = false; }
  };
  if (previewRoot) previewRoot.traverse?.(part => { if (part.isSpotLight) apply(part); });
  else { apply(headlightSpotL); apply(headlightSpotR); }
};
window.RoadsterWeatherLights = Object.freeze({
  ...window.RoadsterWeatherLights,
  enforceSafety: enforceHeadlampProjectionSafety,
  status: () => ({ revision: THREE.REVISION, compatible: !headlampProjectionIssue, issue: headlampProjectionIssue })
});
})();
