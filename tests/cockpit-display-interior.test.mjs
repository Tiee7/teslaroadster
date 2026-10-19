import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers/reference-fixture.mjs';
const visible = part => { for (let node = part; node; node = node.parent) if (!node.visible) return false; return true; };
const pose = part => [part.position.x,part.position.y,part.position.z,part.rotation.x,part.scale.x,part.scale.y,part.scale.z];

test('all four exterior/cockpit choices separate the in-cabin screen from the readable FPV pod', () => {
  const f = fixture(), physical = f.carMeshGroup.getObjectByName('interior-center-screen');
  const display = physical.getObjectByName('interior-live-instruments');
  const housing = physical.getObjectByName('interior-screen-housing');
  assert.equal(display.material, f.screenDisplay.material, 'both views share the actual live speed/air/taxi texture');
  assert.notEqual(housing.material, f.screenBezel.material, 'outside housing has a dark cabin finish');
  const fixedPose = pose(physical);
  for (let cycle = 0; cycle < 3; cycle++) for (const model of ['classic','reference']) for (const cockpit of ['classic','reference']) {
    f.api.setModel(model); f.api.setCockpit(cockpit);
    for (const active of [true,false,true,false]) {
      f.setCockpitPerspective(active); f.setCockpitExteriorDetailsVisible(!active);
      assert.equal(visible(f.screenDisplay), active);
      assert.equal(visible(f.screenBezel), active);
      assert.equal(visible(physical), !active);
      f.window.innerWidth = cycle % 2 ? 390 : 1440;
      f.window.innerHeight = cycle % 2 ? 844 : 900;
      f.resizeCockpitDisplay();
      assert.deepEqual(pose(physical), fixedPose, 'window resizing cannot enlarge or move the physical cabin screen');
    }
    const preview = f.api.getPreviewModel();
    assert.equal(visible(preview.getObjectByName('fpv-live-instruments')), false, 'start/paint previews cannot capture the enlarged FPV pod');
    assert.equal(visible(preview.getObjectByName('fpv-instrument-bezel')), false);
    const screen = preview.getObjectByName('interior-center-screen');
    assert.ok(visible(screen), 'canonical model includes the actual screen mounted inside the cabin');
    assert.deepEqual(pose(screen), fixedPose);
    assert.equal(screen.getObjectByName('interior-live-instruments').material, display.material);
  }
});
