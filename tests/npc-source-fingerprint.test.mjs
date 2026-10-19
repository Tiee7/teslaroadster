import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSourceGeometryHash} from '../verification/npc-traffic/canonical-source-hash.mjs';
const make=()=>({name:'example',material:['random-uuid-a'],normal:[0,1,0,0,1,0,0,1,0],position:[0,0,0,1,0,0,0,0,1],index:[0,1,2],matrixWorld:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],groups:[]});
test('source geometry fingerprint ignores incidental UUIDs, names, materials and normals',()=>{
 const a=make(),b=make();b.name='renamed';b.uuid='another-random-uuid';b.material=['random-uuid-b'];b.normal.fill(.5);
 assert.equal(canonicalSourceGeometryHash([a]),canonicalSourceGeometryHash([b]));
 for(const field of ['position','index','matrixWorld']){const changed=make();changed[field][0]+=.125;assert.notEqual(canonicalSourceGeometryHash([a]),canonicalSourceGeometryHash([changed]),field);}
});
test('identical normalized geometry/pose has the same hash across JSON round trips',()=>{
 const source=make(),copy=JSON.parse(JSON.stringify(source));copy.drawRange={start:0,count:Infinity};
 assert.equal(canonicalSourceGeometryHash([source]),canonicalSourceGeometryHash([copy]));
 assert.match(canonicalSourceGeometryHash([source]),/^[a-f0-9]{64}$/);
});
