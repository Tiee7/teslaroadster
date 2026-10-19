import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/reference-fixture.mjs';
const f=fixture(),e=f.carMeshGroup.getObjectByName('reference-roadster-exterior'),w=e.userData.windowStructure;
const pos=(p,i)=>[p.getX(i),p.getY(i),p.getZ(i)];
const near=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<1e-6);

test('central glazing retains front-wide rear-narrow taper while side glass spreads outboard',()=>{
  const p=e.getObjectByName('referencePanoramicCanopy').geometry.attributes.position;
  const halfAt=z=>{let closest=Infinity,x=0;for(let i=0;i<p.count;i++){const d=Math.abs(p.getZ(i)-z);if(d<closest-1e-5){closest=d;x=0;}if(Math.abs(d-closest)<1e-5)x=Math.max(x,Math.abs(p.getX(i)));}return x;};
  const front=halfAt(-1.065),middle=halfAt(.025),rear=halfAt(1.71);
  assert.ok(front>middle&&middle>rear,'central pane keeps longitudinal taper');
  assert.ok(middle>.44&&middle<.46,'mid roof stays narrower than the side lobes');
  assert.ok(w.lowerFront[0]>.81&&w.lowerRear[0]>.76);
  assert.ok(w.rearPoint[0]>w.roofRear[0]+.10,'aft glazing branch spreads outward before its point');
});

test('each side has one continuous glass mesh with a planar main region, gentle crown and acute aft point',()=>{
  for(const side of [-1,1]){
    const pane=e.getObjectByName(`referenceSideWindow${side}`),p=pane.geometry.attributes.position,n=pane.geometry.attributes.normal;
    const rows=pane.userData.surfaceRows,columns=pane.userData.surfaceColumns;
    assert.equal(columns,8);assert.equal(p.count,(rows+1)*(columns+1));
    const middle=Array.from({length:p.count},(_,i)=>i).filter(i=>p.getZ(i)>w.roofFront[2]+.04&&p.getZ(i)<w.roofRear[2]-.04);
    const a=pos(p,middle[Math.floor(middle.length/2)]),normal=pos(n,middle[Math.floor(middle.length/2)]);
    for(const i of middle){
      assert.ok(near(pos(n,i),normal),'main region keeps its limiting plane normal');
      assert.ok(Math.abs(pos(p,i).reduce((sum,v,k)=>sum+(v-a[k])*normal[k],0))<1e-6,'main region is genuinely planar');
    }
    const upperYs=Array.from({length:rows+1},(_,r)=>p.getY(r*(columns+1))),peak=Math.max(...upperYs);
    assert.ok(peak-w.roofFront[1]>.03&&peak-w.roofRear[1]>.03,'upper edge retains a gentle crown instead of a flat cap');
    for(let c=0;c<=columns;c++)assert.ok(near(pos(p,rows*(columns+1)+c),[side*w.rearPoint[0],w.rearPoint[1],w.rearPoint[2]]));
    assert.ok(w.rearPoint[2]>w.roofRear[2]&&w.rearPoint[1]<w.roofRear[1]);
  }
});

test('broad planar C-buttress joins the roof branch, acute window point and rear body',()=>{
  for(const side of [-1,1]){
    const mesh=e.getObjectByName(`referenceRearButtress${side}`),p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
    assert.equal(p.count,3);assert.equal(mesh.geometry.index.array.length,3);
    for(const point of [w.roofRear,w.rearPoint,w.buttressTail])assert.ok(Array.from({length:p.count},(_,i)=>pos(p,i)).some(v=>near(v,[side*point[0],point[1],point[2]])));
    for(let i=1;i<n.count;i++)assert.ok(near(pos(n,i),pos(n,0)));
    assert.ok(w.rearPoint[0]-w.buttressTail[0]>.35,'white buttress is a body panel, not a narrow trim rail');
  }
});

test('window geometry stays mirrored, restores in preview, and hides with the existing FPV canopy domains',()=>{
  for(const stem of ['referenceSideWindow','referenceRearButtress','referenceWhiteRoofRail','referenceWindowSill']){
    const l=e.getObjectByName(`${stem}-1`).geometry.attributes.position,r=e.getObjectByName(`${stem}1`).geometry.attributes.position;
    assert.equal(l.count,r.count);
    const left=Array.from({length:l.count},(_,i)=>pos(l,i).map((v,k)=>k===0?-v:v));
    for(let i=0;i<r.count;i++)assert.ok(left.some(p=>near(p,pos(r,i))),stem);
  }
  f.setCockpitPerspective(true);
  assert.equal(e.getObjectByName('reference-canopy').visible,false);
  assert.equal(e.getObjectByName('reference-canopy-rails').visible,false);
  f.setCockpitPerspective(false);
  assert.equal(e.getObjectByName('reference-canopy').visible,true);
  assert.equal(e.getObjectByName('reference-canopy-rails').visible,true);
});
