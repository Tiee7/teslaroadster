import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/reference-fixture.mjs';
const f=fixture(),e=f.carMeshGroup.getObjectByName('reference-roadster-exterior'),s=e.userData;
const point=(p,i)=>[p.getX(i),p.getY(i),p.getZ(i)];

test('side-reference nose falls continuously forward and its high fold sits over the unchanged axle',()=>{
  const {nose,axleFold,cowl}=s.frontWingLandmarks;
  assert.deepEqual({...s.axles.front},{z:-1.36,y:.32,radius:.32});
  assert.deepEqual({...s.axles.rear},{z:1.38,y:.35,radius:.35});
  assert.equal(nose[2],-2.16);
  assert.ok(nose[1]>=.45&&nose[1]<=.49);
  assert.ok(Math.abs(axleFold[2]-s.axles.front.z)<.08,'high fold belongs over the wheel, not 74cm ahead');
  assert.ok(axleFold[1]>=.73&&axleFold[1]<=.77);
  for(const u of [0,.275,.55,.7975,1]){
    let previous=-Infinity;
    for(let i=0;i<=200;i++){
      const z=nose[2]+(axleFold[2]-nose[2])*i/200,y=s.sampleShoulder(z,u)[1];
      assert.ok(y>=previous-1e-9,`forward shoulder hump at z=${z},u=${u}`);previous=y;
      if(z<=-1.75)assert.ok(y<.66,'no high forward shelf remains ahead of the wheel');
    }
  }
  assert.ok(cowl[2]>axleFold[2]);
});

test('hood and complete front mask use the shorter visual overhang without moving the cabin',()=>{
  const p=e.getObjectByName('referenceFlatWedgeHood').geometry.attributes.position;
  for(let c=0;c<=32;c++)for(let r=1;r<=96;r++)assert.ok(p.getY(r*33+c)>=p.getY((r-1)*33+c)-1e-7);
  let front=Infinity;
  e.traverse(m=>{if(!m.geometry||m.userData.shadowProxy)return;const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++)front=Math.min(front,p.getZ(i));});
  assert.ok(front>=-2.189&&front<=-2.183,'all fascia, splitter and badge follow the 16cm shorter nose');
  assert.ok(s.axles.front.z-front<.83,'front overhang agrees with the side-reference range');
  const canopy=e.getObjectByName('referencePanoramicCanopy').geometry.attributes.position;
  assert.equal(canopy.getZ(0),Math.fround(-1.065));
});

test('clipped lamp shoulders contain no collapsed Float32 triangles',()=>{
  for(const side of [-1,1]){
    const g=e.getObjectByName(`referenceLampShoulderBridge${side}`).geometry,p=g.attributes.position,idx=g.index.array;
    for(let i=0;i<idx.length;i+=3){
      const [a,b,c]=[idx[i],idx[i+1],idx[i+2]].map(j=>point(p,j));
      const v=b.map((x,k)=>x-a[k]),w=c.map((x,k)=>x-a[k]);
      assert.ok(Math.hypot(v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0])>=1e-12);
    }
    const lens=e.getObjectByName(`referenceTriangleHeadlamp${side}`).geometry.attributes.position;
    assert.ok(Math.abs(lens.getY(1)+.012-.635)<1e-6);
    assert.ok(Math.abs(lens.getY(2)+.012-.650)<1e-6,'lamp top stays shallow across its upper edge');
  }
});

test('same-grid rear bridge closes at its upper beam and rises distinctly at both outer lower corners',()=>{
  const m=e.getObjectByName('referenceRearPaintedBumper'),p=m.geometry.attributes.position;
  const beam=e.getObjectByName('referenceRearLowerBeam').geometry.attributes.position;
  let beamBottom=Infinity;for(let i=0;i<beam.count;i++)beamBottom=Math.min(beamBottom,beam.getY(i));
  assert.equal(m.userData.surfaceRows,24);assert.equal(m.userData.surfaceColumns,64);
  for(let c=0;c<=64;c++){
    assert.ok(p.getY(c)>beamBottom&&p.getY(c)-beamBottom<.002,'bridge follows the lowered upper transom beam');assert.ok(Math.abs(p.getZ(c)-2.278)<1e-6);
  }
  assert.ok(Math.abs(p.getY(24*65+32)-.562)<1e-6);
  for(const c of [0,64])assert.ok(p.getY(24*65+c)>.6417&&p.getY(24*65+c)<=.6421);
});

test('diffuser dividers curve in depth with bounded thin-face grids and closed top edges',()=>{
  for(const x of [-.710,-.473,-.237,0,.237,.473,.710]){
    const a=e.getObjectByName(`referenceDiffuserFin${x}_-1`),b=e.getObjectByName(`referenceDiffuserFin${x}_1`);
    const ap=a.geometry.attributes.position,bp=b.geometry.attributes.position,edge=e.getObjectByName(`referenceDiffuserFinEdge${x}`).geometry.attributes.position;
    assert.equal(a.userData.surfaceRows,16);assert.ok(a.userData.surfaceColumns<=4);
    const stride=a.userData.surfaceColumns+1,top=a.userData.surfaceColumns;
    const linearMid=(ap.getZ(top)+ap.getZ(16*stride+top))/2;
    assert.ok(linearMid-ap.getZ(8*stride+top)>.044&&linearMid-ap.getZ(8*stride+top)<.046);
    for(let r=0;r<=16;r++){
      assert.ok(Math.abs(bp.getX(r*stride+top)-ap.getX(r*stride+top)-.008)<1e-6);
      for(let k=0;k<3;k++){
        assert.ok(Math.abs(ap.array[(r*stride+top)*3+k]-edge.array[r*6+k])<1e-6);
        assert.ok(Math.abs(bp.array[(r*stride+top)*3+k]-edge.array[r*6+3+k])<1e-6);
      }
    }
  }
});
