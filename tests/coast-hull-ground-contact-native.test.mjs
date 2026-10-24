// This reachable landing class is not claimed to match the unviewed user image.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {nativeAvailable,nativeWorld,physics,oldPhysics} from './helpers/coast-hull-native-harness.mjs';

const nativeTest=(name,fn)=>test(name,{skip:nativeAvailable?false:'Set ROADSTER_THREE_RUNTIME to the official Three r128 production build'},fn);
const hash=s=>createHash('sha256').update(s).digest('hex');
const schedules=[{lift:.6,key:'KeyJ',attitude:1.4},{lift:.8,key:'KeyJ',attitude:1.6},
  {lift:.8,key:'KeyI',attitude:1.8},{lift:1,key:'KeyJ',attitude:1.8}];

nativeTest('coast native floor oracle reads real world meshes and agrees with r128 Raycaster, not physics height stubs',()=>{
  const w=nativeWorld(),{T}=w;
  assert.equal(hash(oldPhysics),'692713c8dcd606ed8478946aedd0af9a86ad5073b50d82f986d68072f649c4d6');
  assert.ok(w.triangles.length>30000);
  const ray=new T.Raycaster();
  for(const [x,z]of[[-64,700],[-200,-650],[-650,-650],[244.25050655792703,229.0091649243026],[700,-700],[846.1108502072587,248.0704973910741],[1000,600],[-320,0]]){
    ray.set(new T.Vector3(x,1000,z),new T.Vector3(0,-1,0));
    const hit=ray.intersectObjects(w.meshes,false)[0],independent=w.tops(x,z)[0];
    if(hit)assert.ok(independent&&Math.abs(hit.point.y-independent.height)<1e-5);else assert.equal(independent,undefined);
  }
  // Exact 2D projection hulls contain actual vertices, not a substituted box.
  // Verify the bounded test optimization against the full frozen point cloud.
  assert.ok(w.points.length>70000);
  for(let i=0;i<24;i++){
    const angle=(i-12)*.27,pitch=i%3===0?angle:0,roll=i%3===1?angle:i%3===2?angle*.37:0;
    const m=new T.Matrix4().makeRotationFromEuler(new T.Euler(pitch,.73,roll,'YXZ'));
    assert.ok(Math.abs(w.lowest(m).y-w.lowest(m,true).y)<1e-9);
  }
});

for(const bounds of['proxy','native']){
  nativeTest(`old2c natural Space/J counterexample buries actual frozen vertices and FPV eye while root stays above real ground (${bounds})`,()=>{
    const run=nativeWorld().natural({...schedules[1],bounds,text:oldPhysics});
    assert.ok(run.airborne&&run.landedAt);
    assert.ok(run.minEye<-.6&&run.minNear<-.65,'retained real counterexample, not just a hook assertion');
    assert.ok(run.minVertex<-1,'real frozen geometry penetrates, not only the camera');
    assert.ok(run.minRoot>=-1e-8);
    const first=run.history.find(r=>r.eye<-.01);
    assert.ok(first.y>.8&&first.impacts===0&&first.air>8);
    assert.equal(run.h.impacts.length,0);
  });
  nativeTest(`coast native body landing fixes four real keyboard roll/pitch trajectories without preventing takeoff (${bounds})`,()=>{
    const w=nativeWorld();
    for(const schedule of schedules){
      const run=w.natural({...schedule,bounds});
      assert.ok(run.airborne&&run.peak>4&&run.landedAt,'must actually fly, not suppress the input');
      assert.ok(run.minEye>.4&&run.minNear>.3);
      assert.ok(run.minVertex>-.06,'only existing centimetre-scale suspension compression');
      assert.ok(run.minRoot>=-1e-8);
      assert.equal(run.h.impacts.length,0,'body-aware paid braking preserves these saveable landings');
      assert.equal(run.h.resets,0);
      assert.ok(run.history.every(r=>r.air>=0&&r.air<=10));
    }
  });
  nativeTest(`normal upright coast Space flight preserves peak and fuel; descent/body contact may finish one tick earlier (${bounds})`,()=>{
    const w=nativeWorld(),old=w.natural({bounds,text:oldPhysics}),next=w.natural({bounds});
    assert.equal(next.peak,old.peak);
    assert.equal(next.peak,7.189000000000011);
    assert.equal(next.history.find(r=>r.t===.8).air,old.history.find(r=>r.t===.8).air);
    assert.equal(next.history.at(-1).air,old.history.at(-1).air);
    assert.ok(next.minEye>1&&next.minNear>.95);
    assert.ok(next.minVertex>-.06);
    assert.equal(next.h.impacts.length,0);
  });
  nativeTest(`coast body support respects finite bridge layers, side/inverted contact and ordinary slopes (${bounds})`,()=>{
    const w=nativeWorld(),n=w.coast.network,h=w.makeRun({},bounds),flat=n.sampleRoute(1,400,0),bridge=n.sampleRoute(0,3800,0),slope=n.sampleRoute(0,2400,0);
    const at=(p,y,pitch=0,roll=0)=>({x:p.x,y,z:p.z,pitch,yaw:p.yaw,roll,suspensionSquash:0,aeroSquash:0});
    const hit=(a,b)=>{h.context.a=a;h.context.b=b;return vm.runInContext('coastBodyGroundLanding(window.RoadsterCoast,a,b)',h.context);};
    assert.equal(hit(at(flat,3),at(flat,2.9)),null);
    assert.equal(hit(at(flat,0),at(flat,.1)),null,'upward launch is not a landing');
    assert.ok(hit(at(flat,3,0,Math.PI),at(flat,.3,0,Math.PI)));
    assert.ok(hit(at(flat,3,0,Math.PI/2),at(flat,.3,0,Math.PI/2)));
    assert.ok(hit(at(flat,1.05),at(flat,1.05,0,2.2)),'rotation alone can put the real hull into ground');
    assert.equal(hit(at(flat,-.1,0,Math.PI),at(flat,-.2,0,Math.PI)),null,'no generic low-Y teleport');
    assert.ok(hit(at(bridge,bridge.y+3,0,Math.PI),at(bridge,bridge.y+.3,0,Math.PI))?.bridge);
    assert.ok(!hit(at(bridge,bridge.y-1,0,Math.PI),at(bridge,bridge.y-1.1,0,Math.PI))?.bridge,'cannot magnetize to a deck above the previous root');
    assert.equal(hit(at(slope,slope.y+3,slope.pitch,slope.roll),at(slope,slope.y+.3,slope.pitch,slope.roll)),null);
    assert.ok(hit(at(slope,slope.y+.3,slope.pitch,slope.roll),at(slope,slope.y-.1,slope.pitch,slope.roll)));
    for(const [name,p,y,roll]of[['under',bridge,3,Math.PI],['under-near',bridge,bridge.y-1.3,Math.PI],
      ['top',bridge,bridge.y+3,Math.PI],['slope',slope,slope.y+3,slope.roll],['side',flat,3,Math.PI/2]]){
      const initial={x:p.x,y,z:p.z,yaw:p.yaw,pitch:name==='slope'?p.pitch:0,roll,speed:0,vx:0,vy:-1,vz:0,wasAirborne:true,coastSupportId:null,airRemaining:10};
      const drive=w.makeRun(initial,bounds);let landed=false;
      for(let i=0;i<240;i++){
        drive.step(1/60);
        if(name.startsWith('under'))assert.ok(drive.state.y<=initial.y+1e-8,'underpass must not jump upward to viaduct');
        if(drive.state.coastSupportId){
          const physical=w.coast.support({...drive.state,grounded:true});
          assert.ok(Math.abs(drive.state.y-physical.height)<1e-8,'contact height uses finite root triangle, not a corner extrapolation');
          const rendered=w.floor(drive.state,physical.height);
          assert.ok(Math.abs(drive.state.y-rendered.height)<1e-5);
          if(name.startsWith('under'))assert.equal(drive.state.coastSupportId,'terrain');
          if(name==='top')assert.equal(drive.state.coastSupportId,'road-0');
          landed=true;break;
        }
        if(drive.impacts.length)break;
      }
      assert.ok(landed,`finite ${name} support reached`);
      assert.equal(drive.resets,0);
    }
  });
  nativeTest(`late25m/s coast contact still damages with empty, tiny and full tanks (${bounds})`,()=>{
    const w=nativeWorld(),p=w.coast.network.sampleRoute(1,400,0);
    for(const fuel of[0,.005,10])for(const [pitch,roll]of[[0,0],[0,Math.PI],[0,Math.PI/2],[Math.PI,0]]){
      const h=w.makeRun({x:p.x,y:1.5,z:p.z,yaw:p.yaw,pitch,roll,speed:0,vx:0,vy:-25,vz:0,wasAirborne:true,
        coastSupportId:null,airRemaining:fuel,isFreefalling:fuel===0},bounds);
      for(let i=0;i<30&&!h.impacts.length;i++)h.step(1/60);
      assert.ok(h.impacts.length,'late contact cannot become invulnerable');
      assert.equal(h.impacts[0][1],'crashReasonGround');
      assert.ok(h.impacts[0][0]>15.5);
      // A recording callback can continue to normal landing recharge. Sample
      // fuel at the collision callback, not after that legitimate recharge.
      if(fuel<=.005)assert.equal(h.impactFuel[0],fuel,'no unpaid emergency braking');
      else assert.ok(h.impactFuel[0]<fuel&&h.impactFuel[0]>0,'full tank pays braking, but cannot erase a too-late hard hit');
    }
  });
}
