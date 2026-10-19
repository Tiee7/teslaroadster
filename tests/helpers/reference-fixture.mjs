// Small deterministic scene-graph fixture. Geometry shading and camera-ray QA
// are checked separately against the actual Three.js runtime before release.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
class Vec {
  constructor(x=0,y=0,z=0) { this.set(x,y,z); }
  set(x,y,z) { Object.assign(this,{x,y,z}); return this; }
  setScalar(n) { return this.set(n,n,n); }
  copy(v) { return this.set(v.x,v.y,v.z); }
  clone() { return new Vec(this.x,this.y,this.z); }
}
class Object3D {
  constructor(geometry,material) { Object.assign(this,{geometry,material,children:[],position:new Vec(),rotation:new Vec(),scale:new Vec(1,1,1),visible:true,userData:{},name:''}); }
  add(...parts) { for (const part of parts) { part.parent?.remove(part); part.parent=this; this.children.push(part); } return this; }
  remove(part) { this.children=this.children.filter(child=>child!==part); part.parent=null; return this; }
  getObjectByName(name) { if (this.name===name) return this; for(const child of this.children){ const found=child.getObjectByName(name); if(found)return found; } }
  traverse(fn) { fn(this); this.children.forEach(child=>child.traverse(fn)); }
  clone(deep=true) { const copy=new Object3D(this.geometry,this.material); copy.position.copy(this.position);copy.rotation.copy(this.rotation);copy.scale.copy(this.scale);copy.visible=this.visible;copy.name=this.name;copy.userData={...this.userData};if(deep)this.children.forEach(child=>copy.add(child.clone()));return copy; }
}
class Attribute {
  constructor(array,itemSize=3) { this.array=Float32Array.from(array);this.itemSize=itemSize;this.count=this.array.length/itemSize; }
  getX(i){return this.array[i*this.itemSize];} getY(i){return this.array[i*this.itemSize+1];} getZ(i){return this.array[i*this.itemSize+2];}
  setZ(i,z){this.array[i*this.itemSize+2]=z;}
}
class Geometry {
  constructor(w=1,h=1,d=1) {this.attributes={position:new Attribute([-w/2,-h/2,-d/2,w/2,-h/2,-d/2,w/2,h/2,d/2,-w/2,h/2,d/2],3)};this.groups=[];this.setIndex([0,1,2,0,2,3]);}
  setAttribute(name,attr){this.attributes[name]=attr;return this;}setIndex(indices){this.index={array:Uint32Array.from(indices)};return this;}
  clearGroups(){this.groups=[];}addGroup(start,count,materialIndex){this.groups.push({start,count,materialIndex});}
  computeVertexNormals(){const p=this.attributes.position;this.attributes.normal=new Attribute(Array.from({length:p.count},()=>[0,1,0]).flat(),3);}
  computeBoundingBox(){}computeBoundingSphere(){}
  rotateX(){return this;}rotateY(){return this;}rotateZ(){return this;}translate(){return this;} clone(){return this;}
}
class Material {constructor(props={}) {Object.assign(this,props);this.color={value:props.color,setHex(v){this.value=v;}};}clone(){return new Material({...this});}}
const source=name=>readFileSync(new URL(`../../src/${name}`,import.meta.url),'utf8');
export function fixture({saved={},storageBlocked=false}={}) {
  const events={},storage=new Map(Object.entries(saved)),writes=[];
  const window={innerWidth:1440,innerHeight:900,addEventListener(name,fn){(events[name]||=[]).push(fn);},dispatchEvent(event){events[event.type]?.forEach(fn=>fn(event));}};
  const scene=new Object3D();
  const THREE=new Proxy({Group:Object3D,Mesh:Object3D,Object3D,SpotLight:Object3D,Vector3:Vec,BufferGeometry:Geometry,Float32BufferAttribute:Attribute,FrontSide:0,DoubleSide:2,CatmullRomCurve3:class{},CanvasTexture:class{},MeshBasicMaterial:Material,MeshPhysicalMaterial:Material,MeshStandardMaterial:Material}, {get(obj,key){return key in obj?obj[key]:Geometry;}});
  const context=vm.createContext({THREE,scene,window,Event:class{constructor(type){this.type=type;}},document:{createElement(){return {getContext(){return {};}};}},localStorage:{getItem(key){if(storageBlocked)throw Error('blocked');return storage.get(key)??null;},setItem(key,value){if(storageBlocked)throw Error('blocked');storage.set(key,value);writes.push([key,value]);}},currentMap:'highway',performance:{now:()=>0},Math});
  vm.runInContext(['bodyMaterial','goldCanopyMaterial','carbonMaterial','cockpitMat','titaniumMaterial','whiteLeatherMat'].map(name=>`const ${name}=new THREE.MeshStandardMaterial();`).join('\n'),context);
  for(const file of ['vehicles.js','reference-exterior.js','reference-cockpit.js','reference-traffic.js'])vm.runInContext(source(file),context,{filename:file});
  vm.runInContext('this.parts={carMeshGroup,yokeWheelGroup,screenDisplay,screenBezel,fpvDashboardGroup,activeWingGroup,rearNozzlesGimbalGroup,headlightSpotL,headlightSpotR,roadsterCanopyMesh,wheels,frontWheelSteerGroups,resizeCockpitDisplay,setCockpitPerspective,setCockpitExteriorDetailsVisible,createTrafficVehicleMesh};',context);
  return {window,context,storage,writes,...context.parts,api:window.RoadsterVehicle};
}
