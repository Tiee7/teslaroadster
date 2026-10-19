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
test('NPC inventory retains classic/touring/track and every archived geometry with unchanged collision bounds',()=>{
  const f=fixture(),inventory=f.window.RoadsterTrafficAssets.variants;
  assert.ok(inventory.length>=15);
  for(const variant of inventory){
    const car=f.createTrafficVehicleMesh(0,variant.id);
    assert.equal(car.userData.model,variant.id);
    assert.equal(car.userData.length,4.62);assert.equal(car.userData.height,1.25);
    assert.equal(car.userData.wheels.length,0,'circular baked NPC wheels need no per-frame spin work');
    assert.equal(car.children.length,6,'shared material roles stay in six batches');
    assert.ok(car.children.every(part=>!part.castShadow&&!part.receiveShadow));
  }
});



test('stable frame view synchronization does no recursive scene lookups or repeated cabin copies',()=>{
  const f=fixture();
  let lookups=0, copies=0;
  const exterior=f.carMeshGroup.getObjectByName('reference-roadster-exterior');
  const cabin=f.carMeshGroup.getObjectByName('reference-cockpit');
  const get=exterior.getObjectByName.bind(exterior);
  exterior.getObjectByName=(name)=>{lookups++;return get(name);};
  for(const part of cabin.children){
    const copy=part.position.copy.bind(part.position);
    part.position.copy=(value)=>{copies++;return copy(value);};
  }
  for(const active of [false,true,false,true]){
    f.setCockpitPerspective(active);f.setCockpitExteriorDetailsVisible(!active);
    const before=copies;
    for(let frame=0;frame<120;frame++){
      f.setCockpitPerspective(active);f.setCockpitExteriorDetailsVisible(!active);
    }
    assert.equal(copies,before,'unchanged frames must not rebuild cabin transforms');
  }
  assert.equal(lookups,0,'mesh handles should be resolved once at startup');
  f.window.innerWidth=390;f.window.innerHeight=844;
  const before=copies;
  f.resizeCockpitDisplay();assert.ok(copies>before,'explicit resizing must still lay out the cabin');
  f.api.setCockpit('classic');f.api.setCockpit('reference');
  assert.ok(visible(cabin),'changing cockpit in FPV must still apply immediately');
});

test('reference shadows use two invisible bounded silhouette batches and retain the live wing pivot',()=>{
  const f=fixture();const proxies=[];
  f.carMeshGroup.traverse(part=>{if(part.userData.shadowProxy)proxies.push(part);});
  assert.equal(proxies.length,2);
  assert.equal(proxies[0].material,proxies[1].material);
  let triangles=0;
  for(const proxy of proxies){
    assert.equal(proxy.castShadow,true);assert.equal(proxy.material.colorWrite,false);assert.equal(proxy.material.depthWrite,false);
    const intersections=[];proxy.raycast({},intersections);assert.equal(intersections.length,0);
    triangles+=proxy.geometry.index.array.length/3;
    const preview=f.api.getPreviewModel().getObjectByName(proxy.name);assert.equal(preview.visible,false,'studio should skip shadow-only resources');
  }
  assert.ok(triangles<15000,'caster geometry must stay bounded');
  assert.equal(proxies.find(p=>p.name==='reference-wing-shadow').parent,f.activeWingGroup.getObjectByName('reference-active-wing'));
  const exterior=f.carMeshGroup.getObjectByName('reference-roadster-exterior');
  exterior.traverse(part=>{if(part.geometry&&!part.userData.shadowProxy)assert.equal(part.castShadow,false);});
  f.api.setModel('classic');assert.ok(proxies.every(p=>!visible(p)));
  f.api.setModel('reference');assert.ok(proxies.every(visible));
});


test('viewport changes preserve exterior driver offset without relying on per-frame visibility repair',()=>{
  const f=fixture();
  for(const model of ['reference','classic'])for(const cockpit of ['reference','classic']){
    f.api.setModel(model);f.api.setCockpit(cockpit);f.setCockpitPerspective(false);f.setCockpitExteriorDetailsVisible(true);
    for(const [width,height] of [[390,844],[1440,900],[844,390]]){
      f.window.innerWidth=width;f.window.innerHeight=height;
      f.window.dispatchEvent({type:'resize'});
      assert.equal(f.yokeWheelGroup.position.x,cockpit==='reference'?-.34:0,'native resize listener should preserve the chosen exterior cabin');
      f.resizeCockpitDisplay();
      assert.equal(f.yokeWheelGroup.position.x,cockpit==='reference'?-.34:0,'explicit layout must preserve the same driver offset');
      f.setCockpitPerspective(false);f.setCockpitExteriorDetailsVisible(true);
      assert.equal(f.yokeWheelGroup.position.x,cockpit==='reference'?-.34:0,'stable frame should not need to repair layout');
    }
  }
});
