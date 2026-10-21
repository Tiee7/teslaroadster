import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const runtime=process.env.ROADSTER_THREE_RUNTIME||'/tmp/roadster-three.min.js';
const skip=!existsSync(runtime)&&'Official production Three r128 required';
function city(){
 const c=vm.createContext({console,window:{},document:{getElementById:()=>null},renderModalWeatherGrid(){},applyTranslations(){},applyRoadWeather(){},sound:{beep(){}}});
 vm.runInContext(readFileSync(runtime,'utf8'),c);vm.runInContext(read('src/config.js'),c);
 const world=read('src/world.js'),ui=read('src/ui-hud.js');
 vm.runInContext(`const scene=new THREE.Scene();scene.background=new THREE.Color();scene.fog=new THREE.FogExp2();
 const cityEnvGroup=new THREE.Group(),cityBuildings=[];let cityAsphaltMat=null,cityAsphaltEWMat=null;
 const dashMat=new THREE.MeshBasicMaterial(),titaniumMaterial=new THREE.MeshStandardMaterial(),createWetRoadDetail=()=>({});
 ${world.slice(world.indexOf('function buildOpenWorldCity()'),world.indexOf('buildOpenWorldCity();')+21)}
 currentMap='city';weatherIndex=0;
 const ambientLight=new THREE.AmbientLight(),dirLight=new THREE.DirectionalLight(),rimLight=new THREE.DirectionalLight();
 const roadMat={},studioEnvMap=new THREE.Texture(),marsSunsetEnvMap=new THREE.Texture(),rainLinesMesh={},marsSunGroup={};
 ${ui.slice(ui.indexOf('function selectWeatherMode('),ui.indexOf('function cycleWeatherMode('))}
 globalThis.api={scene,root:cityEnvGroup,buildings:cityBuildings,lights:[ambientLight,dirLight,rimLight],studio:studioEnvMap,
 select:(map,index)=>{currentMap=map;selectWeatherMode(index,false);}};`,c);
 return {...c.api,T:c.THREE};
}
test('city daylight is a direction-continuous cached six-face sky, not a flat colour or a sun object',{skip},()=>{
 const h=city();h.select('city',3);const sky=h.scene.background;
 assert.equal(sky.isCubeTexture,true);assert.equal(h.scene.environment,sky);assert.equal(sky.image.length,6);
 const faces=sky.image.map(t=>t.image.data);assert.ok(faces.every(d=>d.byteLength===128*128*4));
 const pixel=(face,x,y)=>Array.from(faces[face].slice((y*128+x)*4,(y*128+x)*4+3));
 const zenith=pixel(2,64,64),horizon=pixel(4,64,64);assert.ok(zenith[2]>zenith[0]+70);assert.ok(horizon[0]>zenith[0]+80);
 const colours=new Set();for(const d of faces)for(let i=0;i<d.length;i+=4){assert.equal(d[i+3],255);assert.ok(Math.max(d[i],d[i+1],d[i+2])<245);colours.add(`${d[i]},${d[i+1]},${d[i+2]}`);}
 assert.ok(colours.size>500,'sky contains hundreds of stored sky/cloud colours, not a uniform background');
 const cloudRow=new Set(Array.from({length:128},(_,x)=>pixel(2,x,64).join(',')));assert.ok(cloudRow.size>12,'non-flat cloud variation within one elevation row');
 // Adjacent +Z/+X, +Z/-X, +Z/+Y, +Z/-Y pixel centres approach the same 3D direction.
 for(let i=0;i<128;i++)for(const[a,b]of[[pixel(4,127,i),pixel(0,0,i)],[pixel(4,0,i),pixel(1,127,i)],[pixel(4,i,0),pixel(2,i,127)],[pixel(4,i,127),pixel(3,i,0)]])assert.ok(Math.max(...a.map((v,k)=>Math.abs(v-b[k])))<35,'no independent face-colour seam');
 const version=sky.version,images=sky.image.slice();for(let i=0;i<10;i++){h.select('city',0);assert.equal(h.scene.background.isCubeTexture,true);assert.equal(h.scene.background.name,'city-cyber-night-sky');assert.equal(h.scene.environment,h.studio);h.select('city',3);assert.equal(h.scene.background,sky);assert.equal(sky.version,version);images.forEach((face,j)=>assert.equal(sky.image[j],face));}
 assert.equal(h.root.children.some(o=>/sun/i.test(o.name)),false);assert.ok(h.lights[0].intensity<=.6&&h.lights[1].intensity<=.9);
});
test('day sky never leaks to highway/coast weather, and city shells, glazing and paving restore night without uploads',{skip},()=>{
 const h=city(),bodies=h.root.children.filter(o=>o.name.startsWith('city-building-batch-')),paving=h.root.getObjectByName('city-avenue-paving');
 assert.equal(bodies.length,6);assert.equal(h.buildings.length,797);assert.equal(h.buildings.filter(b=>b.isHelipad).length,35);
 assert.equal(paving.castShadow,false);assert.equal(paving.position.y,0);const versions=bodies.map(o=>[o.instanceMatrix.version,o.material.map.version,o.material.emissiveMap.version]);
 h.select('city',3);const sky=h.scene.background;assert.ok(bodies.every(o=>o.material.emissiveIntensity===.035&&o.material.roughness>=.44));const day=paving.material.color.getHex();
 for(const map of['highway','coast']){h.select(map,3);assert.equal(h.scene.background.isColor,true);assert.notEqual(h.scene.environment,sky);assert.equal(h.scene.environment,h.studio);}
 h.select('city',0);assert.ok(bodies.every(o=>o.material.emissiveIntensity===.42));assert.notEqual(paving.material.color.getHex(),day);
 bodies.forEach((o,i)=>assert.deepEqual([o.instanceMatrix.version,o.material.map.version,o.material.emissiveMap.version],versions[i]));
 h.select('city',3);assert.equal(h.scene.background,sky);
});

test('night and rain background cube upload format matches every RGBA pixel, preserving sky hues instead of alpha-channel RGB stripes',{skip},()=>{
 const h=city();for(const mode of[0,1]){h.select('city',mode);const sky=h.scene.background;assert.equal(sky.isCubeTexture,true);assert.equal(sky.format,h.T.RGBAFormat);for(const face of sky.image){assert.equal(face.format,h.T.RGBAFormat);assert.equal(face.image.data.byteLength,128*128*4);const data=face.image.data;for(let i=0;i<data.length;i+=4){assert.equal(data[i+3],255);assert.ok(Math.max(data[i],data[i+1],data[i+2])<90,'stored night colours are bounded, not neon-primary alpha misreads');}}}
 const sky=h.scene.background,data=sky.image[0].image.data;assert.equal(new h.T.CubeTexture([]).format,h.T.RGBFormat,'freeze actual r128 default that caused the upload bug');
 const legacy=Array.from(data.slice(3,6)),correct=Array.from(data.slice(4,7));assert.equal(legacy[0],255);assert.ok(Math.max(...correct)<90);assert.notDeepEqual(legacy,correct,'old second RGB pixel read alpha255 as red');
});
