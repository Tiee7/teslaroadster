import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/reference-fixture.mjs';
const f=fixture(),exterior=f.carMeshGroup.getObjectByName('reference-roadster-exterior');
const collect=()=>{const parts=[];exterior.traverse(part=>{if(part.geometry)parts.push(part);});return parts;};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const point=(attr,index)=>[attr.getX(index),attr.getY(index),attr.getZ(index)];
test('reference surfaces have finite positions, smooth unit normals and valid indexed triangles',()=>{
  let vertices=0,triangles=0;
  for(const part of collect()){
    const {position:p,normal:n}=part.geometry.attributes,idx=part.geometry.index?.array;
    vertices+=p.count;triangles+=(idx?.length||p.count)/3;
    assert.ok([...p.array].every(Number.isFinite),part.name);
    if(n)for(let i=0;i<n.count;i++)assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5,`${part.name}: nonunit surface normal`);
    if(idx)assert.ok([...idx].every(i=>i>=0&&i<p.count),part.name);
  }
  assert.ok(vertices>40000);assert.ok(triangles>50000);
});
test('both inset triangular headlights and crossnose light emit only forward',()=>{
  let count=0;
  exterior.traverse(part=>{
    if(!part.userData.forwardOnly)return;count++;
    assert.equal(part.material.side ?? 0,0);
    const p=part.geometry.attributes.position,indices=part.geometry.index.array;
    for(let i=0;i<indices.length;i+=3){
      const [a,b,c]=[...indices.slice(i,i+3)].map(index=>point(p,index));
      const n=cross(b.map((v,k)=>v-a[k]),c.map((v,k)=>v-a[k]));
      assert.ok(n[2]<0,`${part.name}: driver-facing luminous backface`);
    }
  });
  assert.equal(count,5,'two lamps, two indicators and one nose line');
});
test('reference fenders remain symmetric and clear the unchanged spinning wheel crowns',()=>{
  const {sampleShoulder, sampleFlank,wheelOpeningY}=exterior.userData;
  for(let z=-2.10;z<2.26;z+=.037)for(const u of [0,.2,.48,.55,.8,1])for(const sample of [sampleShoulder,sampleFlank]){
    const l=sample(z,u,-1),r=sample(z,u,1);
    assert.ok(Math.abs(l[0]+r[0])<1e-12&&l[1]===r[1]&&l[2]===r[2]);
  }
  assert.ok(wheelOpeningY(-1.36)>.32+.32+.04);
  assert.ok(wheelOpeningY(1.38)>.35+.35+.04);
});
test('four metallic rear jets share the original gimbal and functional plumes while the diffuser is closed',()=>{
  const jets=f.carMeshGroup.getObjectByName('reference-four-rear-jets');
  assert.equal(jets.parent,f.rearNozzlesGimbalGroup);assert.equal(jets.children.length,16);
  const backing=exterior.getObjectByName('referenceClosedDiffuserBacking');
  assert.ok(backing,'opaque backing must connect the nozzle pocket and rising undertray');
  assert.equal(backing.material.transparent,undefined);
  assert.equal(backing.position.z,2.13);assert.equal(backing.position.y,.275);
  assert.equal(f.activeWingGroup.getObjectByName('reference-active-wing').parent,f.activeWingGroup);
});
