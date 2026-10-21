import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync,existsSync}from'node:fs';
import vm from'node:vm';
const runtime=process.env.ROADSTER_THREE_RUNTIME||'/tmp/roadster-three.min.js',available=existsSync(runtime);
const c=vm.createContext({window:{},console});
if(available)for(const path of[runtime,'src/coast-road-network.js','src/coast-map.js'])vm.runInContext(readFileSync(path,'utf8'),c);
const T=c.THREE,coast=c.window.RoadsterCoast,n=coast?.network,scene=T?new T.Scene():null,root=coast?.enter(scene,T);
const geometryTest=(name,fn)=>test(name,{skip:available?false:'Set ROADSTER_THREE_RUNTIME to the official Three r128 production build'},fn);
geometryTest('rendered tilted rails use the exact collision a→b thin prism, never a several-metres-wide AABB wall',()=>{
 const rails=root.getObjectByName('coast-viaduct-rails'),boxes=n.structures.filter(b=>b.kind==='rail'),matrix=new T.Matrix4(),v=new T.Vector3(),p=rails.geometry.attributes.position;
 assert.equal(rails.count,boxes.length);
 for(let i=0;i<rails.count;i++){
  rails.getMatrixAt(i,matrix);const box=boxes[i],dx=box.b.x-box.a.x,dz=box.b.z-box.a.z,len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len;
  for(let k=0;k<p.count;k++){
   v.fromBufferAttribute(p,k).applyMatrix4(matrix);
   assert.ok(Math.abs((v.x-box.a.x)*nx+(v.z-box.a.z)*nz)<=.1201,'all rendered vertices inside the same ±12cm rail strip');
   assert.ok(v.y>=box.minY-.002&&v.y<=box.maxY+.002,'same station height window');
  }
  const middle=new T.Vector3(0,0,0).applyMatrix4(matrix);assert.ok(Math.abs(middle.x-(box.a.x+box.b.x)/2)<.0001);assert.ok(Math.abs(middle.z-(box.a.z+box.b.z)/2)<.0001);
 }
});
geometryTest('rendered road and terrain positions are identical Float32 collision triangles, including true elevation',()=>{
 const road=root.getObjectByName('coast-road-surfaces').geometry.attributes.position,source=n.triangles.filter(t=>t.id.startsWith('road'));
 assert.equal(road.count,source.length*3);
 for(let i=0;i<source.length;i++){
  const t=source[i],cross=(t.b.z-t.a.z)*(t.c.x-t.a.x)-(t.b.x-t.a.x)*(t.c.z-t.a.z),vertices=cross<0?[t.a,t.c,t.b]:[t.a,t.b,t.c];
  for(let j=0;j<3;j++)for(const[axis,get]of[['x','getX'],['y','getY'],['z','getZ']])assert.equal(road[get](i*3+j),Math.fround(vertices[j][axis]));
 }
 assert.ok(Math.max(...Array.from(road.array).filter((_,i)=>i%3===1))>63.9);
 const terrain=root.getObjectByName('coast-inland-ground').geometry.attributes.position;assert.equal(terrain.count,n.terrain.indices.length);
});
geometryTest('whole-map terrain replaces inland blocks under unchanged mobile structural budgets',()=>{
 const m=coast.metrics();assert.equal(m.buildings,44);assert.equal(m.palms,94);assert.equal(m.ownedLights,2);assert.equal(m.shadowMapResolution,1024);
 assert.ok(m.staticMeshDraws<=96);assert.ok(m.maximumStaticTriangles<=180000);assert.ok(m.textureBytes<=4*1024*1024);assert.ok(m.ownedGeometryBufferBytes+m.ownedInstanceBufferBytes<=8*1024*1024);assert.equal(m.nearDetailCapacity,384);
});
geometryTest('route arrows and real signs distinguish mountain, viaduct, ground bypass, sharp bends and pier direction',()=>{
 const arrows=root.userData.coastRouteArrows,signs=root.userData.coastRouteSigns;assert.equal(arrows.length,112);assert.equal(signs.length,11);
 for(const word of['MOUNTAIN','VIADUCT','GROUND','UNDERPASS','BENDS','CLIMB','DOWNHILL','<PIER'])assert.ok(signs.some(s=>s.text===word));
 for(const a of arrows){const p=coast.pose(a.routeId,a.distance);assert.ok(a.dx*p.dx+a.dz*p.dz>.999);}
 assert.equal(root.getObjectByName('coast-route-sign-boards').count,11);assert.ok(root.getObjectByName('coast-route-sign-lettering').count>200);
});
geometryTest('all retained coastal buildings and palms preserve their published dimensions/colors/poses; only hillside conflicts are removed',()=>{
 const old=JSON.parse(readFileSync('verification/coast-terrain-v2/retained-art-baseline.json','utf8'));assert.equal(old.buildings.length,132);assert.equal(old.palms.length,100);
 for(const b of coast.layout().buildings)assert.equal(JSON.stringify(b),JSON.stringify(old.buildings.find(p=>p.x===b.x&&p.z===b.z)));
 for(const p of coast.layout().palms)assert.equal(JSON.stringify(p),JSON.stringify(old.palms.find(q=>q.x===p.x&&q.z===p.z)));
});
geometryTest('actual sign instances read correctly from the approaching lane: every 5×7 glyph cell, no mirror text',()=>{
 const source=readFileSync('src/coast-map.js','utf8'),a=source.indexOf('    const signGlyphs='),b=source.indexOf('    function sign(text,',a),g=vm.runInNewContext(source.slice(a,b)+';signGlyphs;');
 const mesh=root.getObjectByName('coast-route-sign-lettering'),matrix=new T.Matrix4(),position=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3();
 for(const sign of root.userData.coastRouteSigns){
  const p=coast.pose(sign.id,sign.s),rx=-p.dz,rz=p.dx,rects=[];
  for(let i=sign.letterStart;i<sign.letterStart+sign.letterCount;i++){mesh.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);const x=(position.x-sign.x)*rx+(position.z-sign.z)*rz;rects.push({x0:x-scale.z/2,x1:x+scale.z/2,y0:position.y-scale.y/2,y1:position.y+scale.y/2});}
  const width=(sign.text.length*6-1)*.11;
  for(let k=0;k<sign.text.length;k++)for(let y=0;y<7;y++)for(let x=0;x<5;x++){
   const right=-width/2+(k*6+x+.5)*.11,up=sign.y+3.6+(3-y)*.11,painted=rects.some(r=>right>r.x0-1e-4&&right<r.x1+1e-4&&up>r.y0-1e-4&&up<r.y1+1e-4);
   assert.equal(painted,g[sign.text[k]][y][x]==='1',`${sign.text} glyph${k}, ${x}/${y}`);
  }
 }
});
