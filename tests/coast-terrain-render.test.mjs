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
 const terrain=root.getObjectByName('coast-inland-ground').geometry.attributes.position;assert.ok(terrain.count>0);for(let i=0;i<terrain.count;i++){const x=terrain.getX(i),z=terrain.getZ(i);assert.ok(Math.abs(terrain.getY(i)-n.terrainSupport(x,z).height)<.002,'clipped render tops keep exact collision height; no visual road elevation fudge');}
});
geometryTest('whole-map terrain replaces inland blocks under unchanged mobile structural budgets',()=>{
 const m=coast.metrics();assert.equal(m.buildings,52);assert.equal(m.retainedCoastalBuildings,44);assert.equal(m.hillsideBuildings,8);assert.equal(m.palms,94);assert.equal(m.ownedLights,2);assert.equal(m.shadowMapResolution,1024);
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
geometryTest('actual flat terrain, bank and asphalt render tops have no substantive coplanar overlap; world heights are not raised',t=>{
 const triangles=name=>{const p=root.getObjectByName(name).geometry.attributes.position,result=[];for(let i=0;i<p.count;i+=3){const v=[0,1,2].map(j=>({x:p.getX(i+j),y:p.getY(i+j),z:p.getZ(i+j)}));if(v.every(p=>Math.abs(p.y)<1e-5))result.push(v);}return result;};
 const area=p=>Math.abs(p.slice(1,-1).reduce((sum,a,i)=>{const b=p[i+2],o=p[0];return sum+(a.x-o.x)*(b.z-o.z)-(b.x-o.x)*(a.z-o.z);},0))/2;
 const intersection=(A,B)=>{let p=A;const sign=((B[1].x-B[0].x)*(B[2].z-B[0].z)-(B[1].z-B[0].z)*(B[2].x-B[0].x))>0?1:-1;for(let j=0;j<3&&p.length;j++){const a=B[j],b=B[(j+1)%3],d=v=>sign*((b.x-a.x)*(v.z-a.z)-(b.z-a.z)*(v.x-a.x)),next=[];for(let i=0;i<p.length;i++){const u=p[i],v=p[(i+1)%p.length],du=d(u),dv=d(v);if(du>=0)next.push(u);if((du>=0)!==(dv>=0)){const s=du/(du-dv);next.push({x:u.x+(v.x-u.x)*s,z:u.z+(v.z-u.z)*s});}}p=next;}return p.length>=3?area(p):0;};
 const layers=['coast-inland-ground','coast-road-earth-banks','coast-road-surfaces'].map(triangles);let tested=0,maxOverlap=0;
 for(const [ai,bi]of[[0,1],[0,2],[1,2]]){const grid=new Map();for(const tri of layers[bi]){const xs=tri.map(p=>p.x),zs=tri.map(p=>p.z);for(let x=Math.floor(Math.min(...xs)/64);x<=Math.floor(Math.max(...xs)/64);x++)for(let z=Math.floor(Math.min(...zs)/64);z<=Math.floor(Math.max(...zs)/64);z++){const key=`${x},${z}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(tri);}}
  for(const tri of layers[ai]){const xs=tri.map(p=>p.x),zs=tri.map(p=>p.z),near=new Set();for(let x=Math.floor(Math.min(...xs)/64);x<=Math.floor(Math.max(...xs)/64);x++)for(let z=Math.floor(Math.min(...zs)/64);z<=Math.floor(Math.max(...zs)/64);z++)for(const b of grid.get(`${x},${z}`)||[])near.add(b);for(const b of near){const overlap=intersection(tri,b);maxOverlap=Math.max(maxOverlap,overlap);assert.ok(overlap<.002,'only sub-20cm² Float32 seam residue, not stacked road/soil faces');tested++;}}
 }
 assert.ok(tested>10000);assert.ok(root.getObjectByName('coast-road-surfaces').material.polygonOffset,'controlled depth layer is only a seam safety net after true cutouts');t.diagnostic(JSON.stringify({flatTriangles:layers.map(a=>a.length),crossLayerTrianglePairs:tested,maxOverlapSquareMetres:maxOverlap}));
});
geometryTest('bridge abutment foundations and wing walls are visible oriented solids identical to collision, not invisible snap planes',()=>{
 const mesh=root.getObjectByName('coast-bridge-abutments'),walls=n.structures.filter(b=>b.kind==='abutment'),matrix=new T.Matrix4(),v=new T.Vector3(),positions=mesh.geometry.attributes.position;assert.equal(walls.length,6);assert.equal(mesh.count,6);
 for(let i=0;i<walls.length;i++){const w=walls[i],dx=w.b.x-w.a.x,dz=w.b.z-w.a.z,length=Math.hypot(dx,dz),nx=-dz/length,nz=dx/length;mesh.getMatrixAt(i,matrix);for(let j=0;j<positions.count;j++){v.fromBufferAttribute(positions,j).applyMatrix4(matrix);assert.ok(Math.abs((v.x-w.a.x)*nx+(v.z-w.a.z)*nz)<=w.thickness/2+.001);assert.ok(v.y>=w.minY-.001&&v.y<=w.maxY+.001);}}
});
