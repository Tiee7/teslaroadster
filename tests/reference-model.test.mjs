import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/reference-fixture.mjs';
const visible = part => { for(let node=part;node;node=node.parent)if(!node.visible)return false;return true; };
test('new reference model and cabin default independently while the classic remains preserved',()=>{
  const f=fixture();
  assert.equal(f.api.getModel(),'reference');assert.equal(f.api.getCockpit(),'reference');
  assert.ok(visible(f.carMeshGroup.getObjectByName('reference-cockpit'))===false,'FPV dash is hidden outside');
  assert.ok(visible(f.carMeshGroup.getObjectByName('reference-interior')));
  assert.equal(visible(f.carMeshGroup.getObjectByName('classic-roadster-exterior')),false);
  assert.equal(f.wheels.length,4);assert.equal(f.frontWheelSteerGroups.length,2);
  assert.equal(f.yokeWheelGroup.children.length,19,'all 18 classic yoke parts remain intact beside the new U yoke');
  assert.equal(f.yokeWheelGroup.position.x,-.34,'new exterior cabin uses left-hand drive');
  f.api.setModel('classic');
  assert.ok(visible(f.carMeshGroup.getObjectByName('classic-roadster-exterior')));
  assert.equal(f.api.getCockpit(),'reference');
  f.api.setCockpit('classic');assert.ok(f.yokeWheelGroup.children.slice(0,18).every(visible));
  assert.equal(visible(f.carMeshGroup.getObjectByName('reference-yoke')),false);
});
test('choices restore, validate and persist without depending on storage availability',()=>{
  const f=fixture({saved:{'roadster-exterior-model':'classic','roadster-cockpit-model':'reference'}});
  assert.equal(f.api.getModel(),'classic');assert.equal(f.api.getCockpit(),'reference');
  let notifications=0;f.window.addEventListener('roadster-vehicle-change',()=>notifications++);
  assert.equal(f.api.setModel('invented'),false);assert.equal(f.api.setCockpit(''),false);assert.equal(notifications,0);
  assert.equal(f.api.setCockpit('classic'),true);assert.equal(notifications,1);
  assert.equal(f.storage.get('roadster-cockpit-model'),'classic');
  const denied=fixture({storageBlocked:true});assert.equal(denied.api.setModel('classic'),true);assert.equal(denied.api.getModel(),'classic');
});
test('switching models and cockpit views repeatedly restores surfaces without hiding functional lights or effects',()=>{
  const f=fixture();
  for(let cycle=0;cycle<3;cycle++)for(const model of ['reference','classic'])for(const cockpit of ['reference','classic']){
    f.api.setModel(model);f.api.setCockpit(cockpit);
    for(const active of [true,false,true,false]){
      f.setCockpitPerspective(active);f.setCockpitExteriorDetailsVisible(!active);
      assert.equal(visible(f.carMeshGroup.getObjectByName('classic-roadster-exterior')),model==='classic');
      assert.equal(visible(f.carMeshGroup.getObjectByName('reference-cockpit')),active&&cockpit==='reference');
      assert.equal(visible(f.fpvDashboardGroup),active&&cockpit==='classic');
      assert.ok(visible(f.headlightSpotL)&&visible(f.headlightSpotR),'real forward headlights must survive view choices');
      assert.ok(visible(f.rearNozzlesGimbalGroup));assert.ok(visible(f.activeWingGroup));
      const canopy=f.carMeshGroup.getObjectByName('reference-canopy');
      assert.equal(visible(canopy),model==='reference'&&!active);
      for(const name of ['referenceShoulder-1','referenceShoulder1'])assert.equal(visible(f.carMeshGroup.getObjectByName(name)),model==='reference'&&!active);
    }
  }
});
test('studio sources stay neutral and independent of FPV visibility, steering and jet animations',()=>{
  const f=fixture();const preview=f.api.getPreviewModel();
  assert.equal(f.api.getPreviewModel(),preview,'stable source avoids recloning every render');
  f.setCockpitPerspective(true);f.setCockpitExteriorDetailsVisible(false);
  f.yokeWheelGroup.rotation.z=1;f.activeWingGroup.rotation.x=-.72;
  assert.ok(visible(preview.getObjectByName('reference-canopy')));
  assert.equal(preview.getObjectByName('reference-cockpit').visible,false);
  f.api.setModel('classic');const classic=f.api.getPreviewModel();assert.notEqual(classic,preview);
  f.api.setModel('reference');assert.equal(f.api.getPreviewModel(),preview);
});
test('NPC mix reuses the preserved classic and touring/track detail without changing gameplay bounds or wheel handles',()=>{
  const f=fixture();const counts={};let previousGeometry;
  for(let i=0;i<36;i++){
    const car=f.createTrafficVehicleMesh(i);counts[car.userData.model]=(counts[car.userData.model]||0)+1;
    assert.equal(car.userData.length,4.62);assert.equal(car.userData.height,1.25);assert.equal(car.userData.wheels.length,4);
    if(car.userData.model==='classic-roadster'){
      const body=car.children[0];if(previousGeometry)assert.equal(body.geometry,previousGeometry);previousGeometry=body.geometry;
      assert.equal(body.geometry.attributes.position.count,41*41,'traffic shares a bounded 3200-triangle classic body');
    }
  }
  assert.deepEqual(counts,{'classic-roadster':12,'sculpted-track':12,'sculpted-touring':12});
});
