import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/reference-fixture.mjs';
const f=fixture(),e=f.carMeshGroup.getObjectByName('reference-roadster-exterior'),w=e.userData.frontWindshield;
const p=e.getObjectByName(w.mesh).geometry.attributes.position,n=e.getObjectByName(w.mesh).geometry.attributes.normal;

test('only the front windshield is one exact raked plane with a single limiting normal',()=>{
  assert.equal(w.startZ,-1.065);assert.equal(w.endZ,-.360);
  assert.equal(w.startY,.702);assert.equal(w.endY,1.065);
  const normal=[n.getX(0),n.getY(0),n.getZ(0)];let points=0;
  for(let i=0;i<p.count;i++)if(p.getZ(i)<=w.endZ+1e-7){
    assert.ok(Math.abs(p.getY(i)-w.startY-w.slope*(p.getZ(i)-w.startZ))<1.5e-7,'no longitudinal bend or transverse crown on the windshield');
    assert.deepEqual([n.getX(i),n.getY(i),n.getZ(i)],normal,'front pane normals cannot inherit curved roof shading');points++;
  }
  assert.equal(points,(w.lastPlanarRow+1)*(w.columns+1));
  assert.ok(normal[1]>.8&&normal[2]<-.4);
});

test('roof and outboard side panes retain their independent curved outline',()=>{
  let peak=-Infinity;
  for(let i=0;i<p.count;i++)peak=Math.max(peak,p.getY(i));
  assert.ok(peak>1.11&&peak<1.12,'roof peak stays unchanged instead of flattening the complete canopy');
  for(const side of [-1,1]){
    const pane=e.getObjectByName(`referenceSideWindow${side}`),a=pane.geometry.attributes.position;
    let spread=0;for(let i=0;i<a.count;i++)spread=Math.max(spread,Math.abs(a.getX(i)));
    assert.ok(spread>.81,'outboard glass lobes are retained');
  }
});

test('concave rear bridge side wings recess behind the preserved central plate attachment',()=>{
  const a=e.getObjectByName('referenceRearPaintedBumper').geometry.attributes.position;
  const row=12,stride=65,center=row*stride+32,outboard=row*stride+52;
  assert.ok(a.getZ(center)-a.getZ(outboard)>.13,'white bridge has actual depth concavity, not a convex roll');
  assert.ok(a.getZ(center)>2.29,'central plate plinth stays attached');
  for(let c=0;c<=64;c++)assert.ok(Math.abs(a.getZ(c)-2.278)<1e-6,'upper bridge remains closed against the beam');
});

test('four recessed nozzle mouths sit inside a shallow straight-run rounded-rectangle frame',()=>{
  const rim=e.getObjectByName('referenceSculptedJetCarrierRim'),a=rim.geometry.attributes.position;
  const top=[];
  for(let i=0;i<a.count;i++)if(Math.abs(a.getY(i)-.566)<1e-6)top.push(a.getX(i));
  assert.ok(top.length>=12&&Math.max(...top)-Math.min(...top)>1.40,'frame has a long straight upper run rather than an oval crest');
  const jets=f.carMeshGroup.getObjectByName('reference-four-rear-jets');
  for(const x of [-.45,-.15,.15,.45]){
    const lip=jets.getObjectByName(`reference-jet-flush-lip-${x}`);
    assert.equal(lip.position.y,-.060);assert.equal(lip.position.z,.037);
  }
});

test('wing is swept, tapered and closed without adding detached endplate towers',()=>{
  assert.equal(e.userData.wingProfile.centerChord,.490);assert.equal(e.userData.wingProfile.tipChord,.410);
  const wing=f.activeWingGroup.getObjectByName('reference-active-wing'),a=wing.getObjectByName('referenceWhiteWingBlade').geometry.attributes.position;
  const stride=57;
  const centerLeading=a.getZ(28),tipLeading=a.getZ(0),centerTrailing=a.getZ(18*stride+28),tipTrailing=a.getZ(18*stride);
  assert.ok(tipLeading-centerLeading>.049&&centerTrailing-tipTrailing>.029);
  for(const side of [-1,1]){
    assert.equal(wing.getObjectByName(`referenceWingEndplateThickness${side}`),undefined);
    const cap=wing.getObjectByName(`referenceWhiteWingEndplate${side}`),cp=cap.geometry.attributes.position;
    assert.ok(cp.count>24,'endplate is one closed thin shell');
    let lo=Infinity,hi=-Infinity;for(let i=0;i<cp.count;i++){lo=Math.min(lo,cp.getX(i));hi=Math.max(hi,cp.getX(i));}
    assert.ok(Math.abs(hi-lo-.008)<1e-6);
    assert.equal(wing.getObjectByName(`referenceWingSupport${side}`).material,wing.getObjectByName(`referenceWingBaseMount${side}`).material,'curved supports share existing carbon finish');
  }
});

test('the diffuser bulkhead has real per-channel depth and a completely closed matching boundary',()=>{
  const m=e.getObjectByName('referenceClosedDiffuserBacking'),a=m.geometry.attributes.position,idx=m.geometry.index.array;
  assert.equal(m.position.y,.275);assert.equal(m.position.z,2.13);
  assert.equal(m.userData.surfaceRows,12);assert.equal(m.userData.surfaceColumns,48);
  let frontMin=Infinity,frontMax=-Infinity;
  for(let i=0;i<13*49;i++){frontMin=Math.min(frontMin,a.getZ(i));frontMax=Math.max(frontMax,a.getZ(i));}
  assert.ok(frontMax-frontMin>.14,'throats recede in actual geometry');
  assert.ok(idx.length/3<=1600,'closed interior surface remains bounded');
  const edges=new Map();
  const key=i=>JSON.stringify([a.getX(i),a.getY(i),a.getZ(i)]);
  for(let i=0;i<idx.length;i+=3)for(let k=0;k<3;k++){
    const x=key(idx[i+k]),y=key(idx[i+(k+1)%3]),name=x<y?x+'|'+y:y+'|'+x,edge=edges.get(name)||{count:0,orientation:0};
    edge.count++;edge.orientation+=x<y?1:-1;edges.set(name,edge);
  }
  for(const edge of edges.values())assert.deepEqual(edge,{count:2,orientation:0},'every shared boundary has exactly two opposite triangle edges');
});
