// Actual Three meshes/instances/textures/camera exported for a CPU art-direction
// study. This is NOT a WebGL screenshot, PBR/exposure, shadow or driving QA.
import vm from 'node:vm';import{readFileSync,writeFileSync}from'node:fs';
const read=p=>readFileSync(p,'utf8'),c=vm.createContext({console});vm.runInContext(read('/tmp/roadster-three.min.js'),c);vm.runInContext(read('src/config.js'),c);
const world=read('src/world.js');vm.runInContext(`const cityEnvGroup=new THREE.Group(),cityBuildings=[];let cityAsphaltMat=null,cityAsphaltEWMat=null;const dashMat=new THREE.MeshBasicMaterial(),titaniumMaterial=new THREE.MeshStandardMaterial(),createWetRoadDetail=()=>({});${world.slice(world.indexOf('function buildOpenWorldCity()'),world.indexOf('buildOpenWorldCity();')+21)}globalThis.api={T:THREE,root:cityEnvGroup,presets:WEATHER_PRESETS};`,c);
const{T,root,presets}=c.api,views=[],textures=[],textureIds=new Map();
const tex=t=>{if(!t?.image?.data)return-1;if(textureIds.has(t))return textureIds.get(t);const id=textures.length;textureIds.set(t,id);textures.push({w:t.image.width,h:t.image.height,data:Buffer.from(t.image.data).toString('base64')});return id;};
for(const[title,mode,position,target,width,height]of[
 ['FPV spawn / night',0,[6,1.04,-.15],[6,-.96,-50.15],540,960],['FPV avenue / night',0,[6,1.04,110],[6,-.96,60],960,600],['FPV crossing / day',3,[-110,1.04,6],[-60,-.96,6],960,600],['High view / night',0,[180,135,160],[0,30,-150],960,600],['FPV spawn / day',3,[6,1.04,-.15],[6,-.96,-50.15],540,960]]){
 root.userData.applyWeather(presets[mode]);const camera=new T.PerspectiveCamera(60,width/height,.38,4500);camera.position.set(...position);camera.lookAt(...target);camera.updateMatrixWorld(true);root.updateMatrixWorld(true);const triangles=[],m=new T.Matrix4(),im=new T.Matrix4(),normalM=new T.Matrix3();
 root.traverseVisible(o=>{if(!o.isMesh)return;const g=o.geometry,p=g.attributes.position,uv=g.attributes.uv,n=g.attributes.normal,index=g.index,mat=Array.isArray(o.material)?o.material[0]:o.material;if(!mat?.color||mat.opacity<.15)return;const texture=tex(mat.map),emission=tex(mat.emissiveMap);
  for(let k=0;k<(o.isInstancedMesh?o.count:1);k++){m.copy(o.matrixWorld);const colour=mat.color.clone();if(o.isInstancedMesh){o.getMatrixAt(k,im);m.multiply(im);if(o.instanceColor){const tint=new T.Color();o.getColorAt(k,tint);colour.multiply(tint);}}normalM.getNormalMatrix(m);const size=[new T.Vector3().setFromMatrixColumn(m,0).length(),new T.Vector3().setFromMatrixColumn(m,1).length(),new T.Vector3().setFromMatrixColumn(m,2).length()];
   for(let j=0;j<(index?.count??p.count);j+=3){let vertices=[];const ids=[0,1,2].map(q=>index?index.getX(j+q):j+q),normal=n?new T.Vector3().fromBufferAttribute(n,ids[0]).applyMatrix3(normalM).normalize():new T.Vector3(0,1,0);
    for(const id of ids){const worldPoint=new T.Vector3().fromBufferAttribute(p,id).applyMatrix4(m),point=worldPoint.clone().applyMatrix4(camera.matrixWorldInverse);let u=uv?.getX(id)||0,v=uv?.getY(id)||0;if(o.name==='city-cyber-signs'){const tile=g.attributes.citySignTile.getX(k);u=(u+tile%4)/4;v=(1-v+Math.floor(tile/4))/4;}if(mat.userData.cityFamily){if(Math.abs(n.getY(id))>.5)u=v=.52;else{u*=Math.abs(n.getX(id))>.5?size[2]/7.2:size[0]/7.2;v*=size[1]/7.2;}}vertices.push([point.x,point.y,point.z,u,v,worldPoint.x,worldPoint.y,worldPoint.z]);}
    if(vertices.every(v=>v[2]<-1800)||vertices.every(v=>v[2]>-.38))continue;
    if(mat.side!==T.DoubleSide){const a=new T.Vector3(...vertices[0].slice(0,3)),b=new T.Vector3(...vertices[1].slice(0,3)),d=new T.Vector3(...vertices[2].slice(0,3));if(b.sub(a).cross(d.sub(a)).dot(a)>=0)continue;}
    const clip=[];let a=vertices.at(-1);for(const b of vertices){const ai=a[2]<=-.38,bi=b[2]<=-.38;if(ai!==bi){const t=(-.38-a[2])/(b[2]-a[2]);clip.push(a.map((v,q)=>v+(b[q]-v)*t));}if(bi)clip.push(b);a=b;}vertices=clip;if(vertices.length<3)continue;
    const projected=vertices.map(v=>{const q=new T.Vector3(...v.slice(0,3)).applyMatrix4(camera.projectionMatrix);return[(q.x+1)*width/2,(1-q.y)*height/2,-v[2],...v.slice(3)];});if(projected.every(p=>p[0]<0)||projected.every(p=>p[0]>=width)||projected.every(p=>p[1]<0)||projected.every(p=>p[1]>=height))continue;
    const light=mode===3?.40+.58*Math.max(0,normal.dot(new T.Vector3(65,100,45).normalize())):.36+.35*Math.max(0,normal.dot(new T.Vector3(45,95,60).normalize()));
    for(let v=1;v<projected.length-1;v++)triangles.push({v:[projected[0],projected[v],projected[v+1]],colour:colour.toArray(),texture,emission,emissive:mat.emissive?.toArray()||[0,0,0],gain:mat.emissiveIntensity||0,light:mat.isMeshBasicMaterial?1:light,alpha:mat.transparent?mat.opacity:1});
   }
  }
 });
 views.push({title,mode,width,height,triangles,camera:Array.from(camera.matrixWorld.elements),sky:(mode===3?root.userData.daySky():root.userData.nightSky()).image.map(tex),background:new T.Color(presets[mode].bgColor).toArray()});
 console.log(JSON.stringify({title,triangles:triangles.length,qualification:'CPU textured geometry study, not GPU/PBR/exposure acceptance'}));
}
writeFileSync('/tmp/tesla-city-cyber-scene-study.json',JSON.stringify({textures,views}));

let meshes=0,triangles=0;root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});console.log(JSON.stringify({architecture:root.userData.cityArchitecture,meshes,triangles,parts:c.api.root.children.length}));
