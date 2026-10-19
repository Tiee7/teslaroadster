import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {fixture} from './helpers/reference-fixture.mjs';
const visible = part => { for (let n=part;n;n=n.parent) if(!n.visible)return false;return true; };
const exterior = f => f.carMeshGroup.getObjectByName('reference-roadster-exterior');

test('reference silhouette has tapered nose and a pinched waist between wide wheel shoulders',()=>{
  const f=fixture(),s=exterior(f).userData;
  const front=s.sampleShoulder(-1.36,1)[0],rear=s.sampleShoulder(1.38,1)[0];
  const nose=s.sampleShoulder(-2.16,1)[0],waist=s.sampleFlank(-.10,.48)[0];
  assert.ok(s.sampleShoulder(-1.98,0)[1]-s.sampleShoulder(-2.16,0)[1]<.065,'hood descent is spread along the wedge, not a tall last18cm lip');
  assert.ok(front-nose>.10,'nose must taper inside front wheel shoulders');
  assert.ok(front-waist>.10&&rear-waist>.11,'door waist must read inside both shoulders');
  assert.ok(Math.abs(s.sampleFlank(-.1,.48,-1)[0]+waist)<1e-12);
  const canopy=exterior(f).getObjectByName('referencePanoramicCanopy');
  let maxY=-Infinity;const p=canopy.geometry.attributes.position;
  for(let i=0;i<p.count;i++)maxY=Math.max(maxY,p.getY(i));
  assert.ok(maxY<1.12,'roof stays a low wedge rather than a swollen bubble');
  for(const side of [-1,1])assert.ok(exterior(f).getObjectByName(`referenceRearButtress${side}`));
});

test('front wings fold over inward triangular optics and the cross-nose datum stays shallow',()=>{
  const f=fixture(),e=exterior(f),s=e.userData;
  for(const z of [-1.75,-1.40]){
    const inner=s.sampleShoulder(z,0),middle=s.sampleShoulder(z,.275),crest=s.sampleShoulder(z,.55);
    assert.ok(Math.abs(middle[1]-(inner[1]+crest[1])/2)<1e-10,'inner wing is a broad ruled face, not a rounded hump');
    assert.ok(crest[1]>inner[1]+.045,'fold stays above the lower central hood without a forward hump');
  }
  const a=s.sampleShoulder(-1.40,.55),b=s.sampleShoulder(-1.06,0),c=s.sampleShoulder(-2.16,0);
  const ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
  const n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
  for(const z of [-2.10,-1.98,-1.75,-1.40,-1.36,-1.06])for(const u of [0,.2,.4,.55]){
    const p=s.sampleShoulder(z,u);
    assert.ok(Math.abs(p.reduce((sum,v,i)=>sum+(v-a[i])*n[i],0))<1e-9,'the full triangular wing lies in one plane without a twisted crown');
  }
  for(const side of [-1,1]){
    const lamp=e.getObjectByName(`referenceTriangleHeadlamp${side}`).geometry.attributes.position;
    const x=Array.from({length:lamp.count},(_,i)=>Math.abs(lamp.getX(i)));
    assert.ok(Math.min(...x)>.64&&Math.max(...x)<.775,'recess belongs at the inner white shoulder, not the outer corner');
  }
  const bar=e.getObjectByName('referenceCrossNoseLight').geometry.attributes.position;
  for(let i=0;i<bar.count;i++)assert.ok(bar.getY(i)>.466&&bar.getY(i)<.477);
});

test('lamp shoulder bridges and sculpted diffuser channels are physical source meshes',()=>{
  const f=fixture(),e=exterior(f);
  for(const side of [-1,1])assert.ok(e.getObjectByName(`referenceLampShoulderBridge${side}`),'no open crescent between lamp and fender');
  assert.ok(e.getObjectByName('referenceDiffuserBowl'));
  for(const x of [-.710,-.473,-.237,0,.237,.473,.710]){
    for(const face of [-1,1])assert.ok(e.getObjectByName(`referenceDiffuserFin${x}_${face}`));
  }
});

test('lamp pocket returns attach to the actual planar aperture without cross-section drift',()=>{
  const f=fixture(),e=exterior(f);
  for(const side of [-1,1]){
    const lens=e.getObjectByName(`referenceTriangleHeadlamp${side}`).geometry.attributes.position;
    const edge=Array.from({length:3},(_,i)=>[lens.getX(i),lens.getY(i)+.012,lens.getZ(i)-.014]);
    for(let k=0;k<3;k++){
      const p=e.getObjectByName(`referenceLampPocketWall${side}_${k}`).geometry.attributes.position;
      for(let r=0;r<=12;r++)for(let axis=0;axis<3;axis++){
        const t=r/12,a=edge[k],b=edge[(k+1)%3],actual=p.array[r*9+axis];
        assert.ok(Math.abs(actual-(a[axis]*(1-t)+b[axis]*t))<1e-6,'liner follows the real straight aperture edge');
      }
    }
  }
});

test('raised front wings share the cached FPV-hidden shoulder domain and restore externally',()=>{
  const f=fixture(),e=exterior(f),names=[-1,1].flatMap(side=>[
    `referenceShoulder${side}`,`referenceLampShoulderBridge${side}`,
    `referenceFrontWingInnerReturn${side}`,`referenceFrontWingRearReturn${side}`
  ]);
  f.setCockpitPerspective(true);
  for(const name of names)assert.equal(visible(e.getObjectByName(name)),false,name);
  f.setCockpitPerspective(false);
  for(const name of names)assert.equal(visible(e.getObjectByName(name)),true,name);
});

test('reference nozzles are recessed, and projection-sized instruments stay inside driver views',()=>{
  const f=fixture(),jets=f.carMeshGroup.getObjectByName('reference-four-rear-jets');
  for(const x of [-.45,-.15,.15,.45]){
    const lip=jets.getObjectByName(`reference-jet-flush-lip-${x}`);
    assert.ok(lip,'four separate nozzle mouths');
    assert.ok(f.rearNozzlesGimbalGroup.position.z+lip.position.z<2.28,'no jet tube protrudes beyond rear bumper');
    assert.equal(lip.position.y,-.060);
    const plateBottom=exterior(f).getObjectByName('referenceRearPlatePad').position.y-.135/2;
    assert.ok(plateBottom-(f.rearNozzlesGimbalGroup.position.y+lip.position.y+.081)>.014,'registration pad clears the center nozzle lips');
  }
  assert.equal(visible(f.screenDisplay),false);assert.equal(visible(f.screenBezel),false);
  assert.ok(vm.runInContext('frontRetroNozzles.every(part => part.visible)',f.context));
  f.setCockpitPerspective(true);assert.ok(visible(f.screenDisplay)&&visible(f.screenBezel));
  f.setCockpitPerspective(false);f.api.setModel('classic');
  assert.ok(!visible(f.screenDisplay)&&!visible(f.screenBezel));
  assert.ok(visible(f.carMeshGroup.getObjectByName('interior-center-screen')));
  assert.ok(vm.runInContext('frontRetroNozzles.every(part => part.visible)',f.context));
});

test('reference wheel skin follows the original spin and steer handles and classic wheels restore',()=>{
  const f=fixture();
  f.wheels.forEach((wheel,i)=>{
    const skin=wheel.getObjectByName(`reference-wheel-${i}`);
    assert.equal(skin.parent,wheel);assert.ok(visible(skin));
    assert.ok(skin.getObjectByName(`reference-rounded-tire-${i}`));
    wheel.rotation.x=.63;assert.equal(skin.parent.rotation.x,.63);
  });
  f.api.setModel('classic');
  f.wheels.forEach((wheel,i)=>assert.equal(visible(wheel.getObjectByName(`reference-wheel-${i}`)),false));
  f.api.setModel('reference');
  f.wheels.forEach((wheel,i)=>assert.ok(visible(wheel.getObjectByName(`reference-wheel-${i}`))));
});
