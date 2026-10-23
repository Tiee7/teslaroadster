// Intentional red: rerun the immutable pre-repair f67 production physics.
import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
import{nativeWorld}from'../../tests/helpers/coast-hull-native-harness.mjs';
const source=readFileSync(new URL('../../tests/fixtures/coast-building-separation-baseline/physics-main.js',import.meta.url),'utf8');assert.equal(createHash('sha256').update(source).digest('hex'),'d3b3936cb71db98d35862e3f4a068eda6409460babbf8472a602085f98cd96f6');
for(const fps of[30,60,144])test(`old f67 native-clear side drive should not collide at${fps}Hz (intentional old failure)`,()=>{
 const w=nativeWorld(),C=w.coast,b=C.layout().buildings[2],x=b.minX-8,z=b.maxZ+1.4,g=C.support({x,z,y:0,grounded:true}),yaw=-Math.PI/2,h=w.makeRun({x,y:g.height,z,yaw,pitch:0,roll:0,speed:20,vx:20,vy:0,vz:0,coastSupportId:g.id,wasAirborne:false},'native',source);h.keys.KeyW=true;
 for(let frame=0;frame<fps;frame++){h.step(1/fps);if(h.impacts.length)break;}
 const body=h.context.cityPlayerBody(h.state);assert.ok(body.z-body.rz-b.maxZ>.38,'whole native body is truly side-clear');assert.equal(h.impacts.length,0,'retained original fixed-axis false building collision');
});
