// CPU-only map geometry study. No WebGL, textures, cockpit, overlays or FPS claim.
import vm from'node:vm';import{readFileSync,writeFileSync}from'node:fs';
const c=vm.createContext({window:{},console});for(const p of[process.env.ROADSTER_THREE_RUNTIME||'/tmp/roadster-three.min.js','src/coast-road-network.js','src/coast-map.js'])vm.runInContext(readFileSync(p,'utf8'),c);
const T=c.THREE,C=c.window.RoadsterCoast,scene=new T.Scene(),root=C.enter(scene,T);root.updateMatrixWorld(true);
const positions=[],colors=[],matrix=new T.Matrix4(),instance=new T.Matrix4(),point=new T.Vector3(),color=new T.Color(),base=new T.Color(),tint=new T.Color();
root.traverse(o=>{if(!o.isMesh||!o.visible)return;const geo=o.geometry,p=geo.attributes.position,indices=geo.index?.array,count=o.isInstancedMesh?o.count:1,material=Array.isArray(o.material)?o.material[0]:o.material;
 for(let i=0;i<count;i++){
  matrix.copy(o.matrixWorld);if(o.isInstancedMesh){o.getMatrixAt(i,instance);matrix.multiply(instance);}base.copy(material.color||new T.Color(0xffffff));if(o.instanceColor){o.getColorAt(i,tint);base.multiply(tint);}
  if(o.name==='coast-inland-ground')base.setHex(0x788d65);else if(o.name==='coast-road-earth-banks')base.setHex(0x8d9273);else if(o.name==='coast-water')base.setHex(0x357988);else if(o.name==='coast-sand')base.setHex(0xcbb98f);else if(/glazing|sashes|lit-windows/.test(o.name))base.setHex(0x35484c);
  const length=indices?indices.length:p.count;
  for(let k=0;k<length;k+=3){color.copy(base);if(geo.attributes.color){const v=geo.attributes.color,ids=[0,1,2].map(j=>indices?indices[k+j]:k+j);color.r*=ids.reduce((sum,i)=>sum+v.getX(i),0)/3;color.g*=ids.reduce((sum,i)=>sum+v.getY(i),0)/3;color.b*=ids.reduce((sum,i)=>sum+v.getZ(i),0)/3;}
   for(let j=0;j<3;j++){point.fromBufferAttribute(p,indices?indices[k+j]:k+j).applyMatrix4(matrix);positions.push(point.x,point.y,point.z);}colors.push(Math.round(color.r*255),Math.round(color.g*255),Math.round(color.b*255));
  }
 }
});
writeFileSync('/tmp/coast-study-positions.f32',Buffer.from(new Float32Array(positions).buffer));writeFileSync('/tmp/coast-study-colors.u8',Buffer.from(new Uint8Array(colors).buffer));
const views=[];for(const[id,s,title]of[[0,145,'Coast / mountain direction'],[0,1700,'Broad continuous uphill'],[0,2545,'Mountain bends / warnings'],[0,3380,'Curved viaduct / downhill'],[1,1039,'Ground road under viaduct'],[0,4700,'Long descent to the coast']]){
 const p=C.pose(id,s),object=new T.Object3D();object.position.set(p.x,p.y,p.z);object.rotation.set(p.pitch,p.yaw,p.roll,'YXZ');object.updateMatrixWorld(true);
 const eye=new T.Vector3(0,1.04,-.15).applyMatrix4(object.matrixWorld),forward=new T.Vector3(0,-.04,-1).normalize().transformDirection(object.matrixWorld),up=new T.Vector3(0,1,0).transformDirection(object.matrixWorld),right=forward.clone().cross(up).normalize();up.copy(right).cross(forward).normalize();
 views.push({title,eye:eye.toArray(),forward:forward.toArray(),up:up.toArray(),right:right.toArray(),pose:p,fov:60});
}
writeFileSync('/tmp/coast-study-views.json',JSON.stringify({triangles:positions.length/9,views,metrics:C.metrics()},null,2));console.log(JSON.stringify({triangles:positions.length/9,views:views.length}));
