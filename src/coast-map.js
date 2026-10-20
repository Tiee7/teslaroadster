// Original compressed seaside district. No GTA/OSM geometry, imagery or assets.
// Data and traffic are renderer-independent; owned GPU resources are lazy/map-local.
const RoadsterCoast = (() => {
  'use strict';
  const spec = Object.freeze({ id:'coast', halfBound:1200, shorelineX:-330, waterY:-.4,
    spawn:Object.freeze({x:-64,z:700,speed:18}), counts:Object.freeze([12,16,20]),
    pier:Object.freeze({minX:-810,maxX:-250,minZ:-668,maxZ:-632}), wheelHeight:60 });
  const xs=[-70,430,950],zs=[-850,-300,300,850];
  const roads=[...xs.map((x,i)=>({x,z:0,w:i<2?30:22,d:1740})),
    ...zs.map(z=>({x:440,z,w:1060,d:22}))];
  const junctions=xs.flatMap(x=>zs.map(z=>({x,z,w:34,d:34})));
  const contains=(b,x,z,pad=0)=>x>=b.minX-pad&&x<=b.maxX+pad&&z>=b.minZ-pad&&z<=b.maxZ+pad;
  const onRoad=(x,z,margin=0)=>[...roads,...junctions].some(r=>Math.abs(x-r.x)<=r.w/2-margin&&Math.abs(z-r.z)<=r.d/2-margin);
  const surface=(x,z)=>{
    const pier=contains(spec.pier,x,z);
    const water=x<spec.shorelineX&&!pier;
    return {solid:!water,water,pier,height:water?spec.waterY:0};
  };
  const nodes=xs.flatMap((x,ix)=>zs.map((z,iz)=>({id:ix*zs.length+iz,x,z})));
  const edges=[];
  for(const a of nodes)for(const b of nodes)if((a.x===b.x&&Math.abs(a.id-b.id)===1)||
    (a.z===b.z&&Math.abs(a.id-b.id)===zs.length))edges.push({from:a.id,to:b.id,length:Math.hypot(a.x-b.x,a.z-b.z)});
  let seed=90173;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const buildings=[];
  for(const x of [-5,95,195,295,355,485,585,685,785,865,1035,1115])for(const z of [-1000,-720,-580,-440,-160,0,160,440,580,720,1000]){
    const w=30+rand()*16,d=28+rand()*14,height=(x<430?8:12)+rand()*(z>600?10:16);
    buildings.push(Object.freeze({x,z,w,d,height,minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,color:Math.floor(rand()*6)}));
  }
  const palms=[];
  for(const x of [-120,-190])for(let z=-1020;z<=1020;z+=60)palms.push({x,z,h:9+rand()*4});
  for(const x of [380,480])for(let z=-990;z<=990;z+=110)if(zs.every(c=>Math.abs(z-c)>32))palms.push({x,z,h:9+rand()*4});
  const obstacles=[...buildings,...palms.map(p=>({minX:p.x-.6,maxX:p.x+.6,minZ:p.z-.6,maxZ:p.z+.6,height:p.h,kind:'palm'}))];

  // Rounded directed loops on the connected road graph, with distinct opposing lanes.
  function route(left,right,reverse){
    const lane=reverse?-4:4,top=-850+lane,bottom=850-lane,r=8;
    left+=lane;right-=lane;
    const pieces=[];
    const line=(x,z,dx,dz,length)=>pieces.push({x,z,dx,dz,length});
    const arc=(x,z,angle)=>pieces.push({x,z,angle,r,length:Math.PI*r/2});
    line(left,bottom-r,0,-1,bottom-top-2*r);arc(left+r,top+r,Math.PI);
    line(left+r,top,1,0,right-left-2*r);arc(right-r,top+r,Math.PI*1.5);
    line(right,top+r,0,1,bottom-top-2*r);arc(right-r,bottom-r,0);
    line(right-r,bottom,-1,0,right-left-2*r);arc(left+r,bottom-r,Math.PI/2);
    return {pieces,length:pieces.reduce((n,p)=>n+p.length,0),reverse};
  }
  const routes=[route(-70,430,false),route(-70,430,true),route(430,950,false),route(430,950,true)];
  function pose(routeId,distance){
    const path=routes[((routeId%routes.length)+routes.length)%routes.length];
    let s=((distance%path.length)+path.length)%path.length;
    if(path.reverse)s=(path.length-s)%path.length;
    for(const p of path.pieces){
      if(s>p.length){s-=p.length;continue;}
      let x,z,dx,dz;
      if(p.r){const a=p.angle+s/p.r;x=p.x+p.r*Math.cos(a);z=p.z+p.r*Math.sin(a);dx=-Math.sin(a);dz=Math.cos(a);}
      else{x=p.x+p.dx*s;z=p.z+p.dz*s;dx=p.dx;dz=p.dz;}
      if(path.reverse){dx=-dx;dz=-dz;}
      return {x,z,dx,dz,yaw:Math.atan2(-dx,-dz)};
    }
    throw Error('Invalid coastal route distance');
  }
  const safe=(p,cars,player,except)=>Math.hypot(p.x-player.x,p.z-player.z)>32&&cars.every(c=>c===except||c.mesh.visible===false||Math.hypot(p.x-c.mesh.position.x,p.z-c.mesh.position.z)>20);
  function place(car,cars,player){
    const path=routes[car.coastRoute];
    for(let i=0;i<32;i++){
      const s=(car.coastSpawnCursor+i*113)%path.length,p=pose(car.coastRoute,s);
      if(!safe(p,cars,player,car))continue;
      car.coastDistance=s;car.coastWaiting=false;car.coastCooldown=0;car.speed=car.desiredSpeed;
      car.y=0;car.blastTimer=0;car.mesh.position.set(p.x,0,p.z);car.mesh.rotation.set(0,p.yaw,0);car.mesh.visible=true;
      car.vx=p.dx*car.speed;car.vz=p.dz*car.speed;car.coastSpawnCursor=s+97;return true;
    }
    car.coastSpawnCursor+=79;car.coastWaiting=true;car.mesh.visible=false;car.speed=0;car.vx=car.vz=0;return false;
  }
  function createTraffic(count,createMesh,group,player){
    const cars=[];count=Math.max(0,Math.min(20,Math.floor(count)));
    for(let i=0;i<count;i++){
      const mesh=createMesh(i),routeId=i%routes.length,path=routes[routeId];group.add(mesh);mesh.visible=false;
      const car={mesh,mode:'coast',coastRoute:routeId,coastDistance:0,coastSpawnCursor:(Math.floor(i/routes.length)+.35)*path.length/Math.max(1,Math.ceil(count/routes.length)),
        coastWaiting:true,coastCooldown:0,desiredSpeed:12+(i%4)*1.5,speed:0,vx:0,vz:0,y:0,blastTimer:0,
        blastVx:0,blastVy:0,blastVz:0,blastVRoll:0,blastVPitch:0,blastVYaw:0,length:mesh.userData.length||4.62,height:mesh.userData.height||1.25};
      cars.push(car);place(car,cars,player);
    }
    return cars;
  }
  function hit(car){car.coastCooldown=1.8;car.speed=0;car.vx=car.vz=0;}
  function respawn(cars=[]){
    const live=cars.filter(c=>c.mode==='coast'&&c.mesh.visible!==false&&!c.coastWaiting);
    for(const x of [spec.spawn.x,436,956])for(let i=0;i<39;i++){
      const z=700-i*40;
      if(live.every(c=>Math.hypot(c.mesh.position.x-x,c.mesh.position.z-z)>32))return {x,z,speed:spec.spawn.speed};
    }
    // With at most20 cars and117 candidates this cannot be fully occupied.
    throw Error('No safe coastal road respawn');
  }
  function recoverTraffic(cars,player){
    for(const c of cars)if(c.mode==='coast'&&(c.blastTimer>0||!onRoad(c.mesh.position.x,c.mesh.position.z))){
      c.coastWaiting=true;c.mesh.visible=false;c.blastTimer=0;c.y=0;c.speed=0;
    }
    for(const c of cars)if(c.mode==='coast'&&c.coastWaiting)place(c,cars,player);
  }
  function stepTraffic(cars,player,dt){
    dt=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));
    const before=cars.map(c=>({car:c,x:c.mesh.position.x,z:c.mesh.position.z,vx:c.vx,vz:c.vz,speed:c.speed,visible:c.mesh.visible}));
    for(const car of cars){
      if(car.mode!=='coast')continue;
      if(car.blastTimer>0){
        car.blastTimer=Math.max(0,car.blastTimer-dt);car.mesh.position.x+=car.blastVx*dt;car.mesh.position.z+=car.blastVz*dt;
        car.y=Math.max(0,(car.y||0)+car.blastVy*dt);car.blastVy-=22*dt;
        car.mesh.position.y=car.y;car.mesh.rotation.x+=(car.blastVPitch||0)*dt;car.mesh.rotation.z+=(car.blastVRoll||0)*dt;
        if(car.blastTimer===0){car.coastWaiting=true;car.mesh.visible=false;car.speed=0;car.vx=car.vz=0;}
        continue;
      }
      if(car.coastWaiting){place(car,cars,player);continue;}
      if(car.coastCooldown>0){car.coastCooldown=Math.max(0,car.coastCooldown-dt);car.speed=0;car.vx=car.vz=0;continue;}
      const p=pose(car.coastRoute,car.coastDistance);let target=car.desiredSpeed;
      for(const b of before){
        if(b.car===car||!b.visible)continue;
        const x=b.x-p.x,z=b.z-p.z,ahead=x*p.dx+z*p.dz,lateral=Math.abs(x*p.dz-z*p.dx);
        if(ahead>0&&ahead<42&&lateral<2.6)target=Math.min(target,Math.max(0,(ahead-10)/1.6));
      }
      car.speed+=Math.max(-7*dt,Math.min(2.2*dt,target-car.speed));
      car.coastDistance=(car.coastDistance+car.speed*dt)%routes[car.coastRoute].length;
      const next=pose(car.coastRoute,car.coastDistance);car.mesh.position.set(next.x,0,next.z);car.mesh.rotation.y=next.yaw;
      car.vx=next.dx*car.speed;car.vz=next.dz*car.speed;
    }
  }
  function sweptInterval(ax,az,bx,bz,box,padX,padZ){
    let enter=0,exit=1;
    for(const [a,b,lo,hi] of [[ax,bx,box.minX-padX,box.maxX+padX],[az,bz,box.minZ-padZ,box.maxZ+padZ]]){
      const v=b-a;if(Math.abs(v)<1e-12){if(a<lo||a>hi)return null;continue;}
      const t0=(lo-a)/v,t1=(hi-a)/v;enter=Math.max(enter,Math.min(t0,t1));exit=Math.min(exit,Math.max(t0,t1));if(enter>exit)return null;
    }
    return enter>=0&&enter<=1?{enter,exit}:null;
  }
  function sweptBox(ax,az,bx,bz,box,padX,padZ){
    return sweptInterval(ax,az,bx,bz,box,padX,padZ)?.enter??null;
  }
  function trafficContact(previous,state,oldCar,car,bounds){
    const interval=sweptInterval(oldCar.x-previous.x,oldCar.z-previous.z,
      car.mesh.position.x-state.x,car.mesh.position.z-state.z,
      {minX:-bounds.x,maxX:bounds.x,minZ:-bounds.z,maxZ:bounds.z},0,0);
    if(!interval)return null;
    const dy=state.y-previous.y,ceiling=car.height+.15;
    let t=interval.enter,y=previous.y+dy*t;
    if(y>ceiling){
      if(dy>=0)return null;
      t=(ceiling-previous.y)/dy;
      if(t>interval.exit||t>1)return null;
      y=ceiling;
    }
    // Height is evaluated at actual contact, not horizontal entry or frame end.
    return {t,y,body:y<car.height-.15};
  }
  function clipBuildings(previous,state){
    let earliest=null;
    for(const b of obstacles){
      // A roof is support, not a side wall. Allow driving/jumping across it.
      if(previous.y>=b.height-.08&&state.y>=b.height-.08)continue;
      const t=sweptBox(previous.x,previous.z,state.x,state.z,b,1.1,1.8);
      if(t===null||previous.y+(state.y-previous.y)*t>=b.height+.08)continue;
      if(earliest===null||t<earliest)earliest=t;
    }
    if(earliest===null)return null;
    const speed=Math.hypot(state.vx,state.vz),t=Math.max(0,earliest-1e-5);
    state.x=previous.x+(state.x-previous.x)*t;state.z=previous.z+(state.z-previous.z)*t;
    state.vx*=-.25;state.vz*=-.25;state.speed*= -.25;
    return {speed,t:earliest};
  }
  function contactBounds(playerYaw,npcYaw,npcLength,previousPlayerYaw=playerYaw,previousNpcYaw=npcYaw){
    const projected=(from,to,width,length,zAxis)=>{
      from=Number.isFinite(from)?from:0;to=Number.isFinite(to)?to:from;
      const delta=((to-from+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
      const lo=Math.min(from,from+delta),hi=Math.max(from,from+delta);
      const extent=a=>zAxis?width*Math.abs(Math.sin(a))+length*Math.abs(Math.cos(a)):width*Math.abs(Math.cos(a))+length*Math.abs(Math.sin(a));
      let maximum=Math.max(extent(lo),extent(hi));const peak=Math.atan2(zAxis?width:length,zAxis?length:width);
      for(let k=Math.floor(lo/Math.PI)-1;k<=Math.ceil(hi/Math.PI)+1;k++)for(const sign of [-1,1]){
        const a=k*Math.PI+sign*peak;if(a>=lo&&a<=hi)maximum=Math.max(maximum,extent(a));
      }
      return maximum;
    };
    return {x:projected(previousPlayerYaw,playerYaw,.925,2.15,false)+projected(previousNpcYaw,npcYaw,.925,npcLength/2,false),
      z:projected(previousPlayerYaw,playerYaw,.925,2.15,true)+projected(previousNpcYaw,npcYaw,.925,npcLength/2,true)};
  }

  let active=null,builds=0,disposals=0;
  function enter(scene,THREE=globalThis.THREE){
    if(active)return active.group;
    const group=new THREE.Group();group.name='original-coastal-district';
    const geometries=new Set(),materials=new Set(),own=g=>(geometries.add(g),g);
    const material=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.85,metalness:.02,...extra});materials.add(m);return m;};
    const box=own(new THREE.BoxGeometry(1,1,1)),palette=[0xe3a58a,0xd5ba79,0x8fb9b0,0xb6abc3,0xc9d2bd,0x86a5ba];
    const batches=[];
    function batch(name,geo,mat,items){
      const mesh=new THREE.InstancedMesh(geo,mat,items.length),dummy=new THREE.Object3D();mesh.name=name;
      items.forEach((v,i)=>{dummy.position.set(...v.p);dummy.scale.set(...v.s);dummy.rotation.set(...(v.r||[0,0,0]));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(v.color!==undefined)mesh.setColorAt(i,new THREE.Color(v.color));});
      mesh.instanceMatrix.needsUpdate=true;mesh.receiveShadow=false;mesh.castShadow=false;group.add(mesh);batches.push(mesh);return mesh;
    }
    const slab=(name,x,z,w,d,color,y=-.12,h=.16)=>batch(name,box,material(color),[{p:[x,y,z],s:[w,h,d]}]);
    slab('coast-inland-ground',435,0,1530,2400,0x677761);
    slab('coast-water',-765,0,870,2400,0x164d6c,-.48,.12);
    slab('coast-sand',-237.5,0,185,2300,0xc6ae7c);
    slab('coast-promenade',-134,0,22,2200,0xaaa28b,-.02,.10);
    const roadMat=material(0x303b43);batch('coast-road-surfaces',box,roadMat,[...roads,...junctions].map(r=>({p:[r.x,-.015,r.z],s:[r.w,.08,r.d]})));
    const markings=[];
    for(const r of roads)if(r.d>r.w){for(let z=-800;z<850;z+=30)if(zs.every(c=>Math.abs(c-z)>22))markings.push({p:[r.x,.035,z],s:[.22,.012,9]});}
    else for(let x=-40;x<950;x+=30)if(xs.every(c=>Math.abs(c-x)>22))markings.push({p:[x,.035,r.z],s:[9,.012,.22]});
    batch('coast-lane-markings',box,material(0xd9c980),markings);
    batch('coast-original-shop-houses',box,material(0xffffff),buildings.map(b=>({p:[b.x,b.height/2,b.z],s:[b.w,b.height,b.d],color:palette[b.color]})));
    batch('coast-roof-terraces',box,material(0x596567),buildings.map(b=>({p:[b.x,b.height+.12,b.z],s:[b.w+1,.24,b.d+1]})));
    batch('coast-dark-window-bands',box,material(0x284e5f),buildings.flatMap(b=>[-1,1].map(side=>({p:[b.x+side*(b.w/2+.025),b.height*.56,b.z],s:[.05,b.height*.35,b.d*.78]}))));
    batch('coast-palm-trunks',own(new THREE.CylinderGeometry(.22,.36,1,7)),material(0x847251),palms.map(p=>({p:[p.x,p.h/2,p.z],s:[1,p.h,1]})));
    batch('coast-palm-fans',box,material(0x3b7956),palms.flatMap(p=>Array.from({length:6},(_,i)=>{const a=i*Math.PI/3;return {p:[p.x+Math.cos(a)*1.7,p.h,p.z+Math.sin(a)*1.7],s:[4.5,.14,.85],r:[0,-a,.15]};})));
    slab('coast-pier-boardwalk',-530,-650,560,36,0x94734f,-.04,.12);
    slab('coast-pier-approach',-160,-650,180,18,0xb7a17b,-.03,.10);
    batch('coast-pier-rails',box,material(0xc0b18e),[-668,-632].flatMap(z=>[{p:[-530,.8,z],s:[560,.15,.15]},...Array.from({length:29},(_,i)=>({p:[-810+i*20,.4,z],s:[.15,.8,.15]}))]));
    batch('coast-pier-piles',box,material(0x675b4b),Array.from({length:15},(_,i)=>[-660,-640].map(z=>({p:[-800+i*38,-1.8,z],s:[1.1,3.6,1.1]}))).flat());
    slab('coast-court',-195,540,45,70,0x446c6b,-.015,.10);
    batch('coast-court-lines',box,material(0xd8d2b7),[{p:[-195,.05,540],s:[.16,.02,66]},...[-32,32].map(z=>({p:[-195,.05,540+z],s:[42,.02,.16]})),...[-21,21].map(x=>({p:[-195+x,.05,540],s:[.16,.02,66]}))]);
    const skate=new THREE.Mesh(own(new THREE.RingGeometry(10,16,32)),material(0x999a8c));skate.rotation.x=-Math.PI/2;skate.position.set(-220,.07,220);group.add(skate);
    slab('coast-skate-basin',-220,220,20,20,0x515e65,-.005,.02);
    const wheel=new THREE.Group();wheel.position.set(-650,30,-650);wheel.rotation.y=Math.PI/2;wheel.name='coast-original-ferris-wheel';group.add(wheel);
    const rotor=new THREE.Group();wheel.add(rotor);const ferrisMat=material(0xd1b58d),rimGeo=own(new THREE.TorusGeometry(28,.28,5,64));
    for(const z of [-1.4,1.4]){const rim=new THREE.Mesh(rimGeo,ferrisMat);rim.position.z=z;rotor.add(rim);}
    const spokes=new THREE.InstancedMesh(box,ferrisMat,24),dummy=new THREE.Object3D();
    for(let i=0;i<24;i++){const a=i*Math.PI/12;dummy.position.set(Math.cos(a)*14,Math.sin(a)*14,0);dummy.scale.set(28,.15,.15);dummy.rotation.set(0,0,a);dummy.updateMatrix();spokes.setMatrixAt(i,dummy.matrix);}rotor.add(spokes);
    const cabins=[];for(let i=0;i<16;i++){const a=i*Math.PI/8,cabin=new THREE.Mesh(box,material(palette[i%palette.length]));cabin.position.set(Math.cos(a)*28,Math.sin(a)*28,0);cabin.scale.set(2.6,2.8,3.8);rotor.add(cabin);cabins.push(cabin);}
    batch('coast-wheel-supports',box,ferrisMat,[{p:[-650,14,-655],s:[1.4,30,1.4],r:[.18,0,0]},{p:[-650,14,-645],s:[1.4,30,1.4],r:[-.18,0,0]}]);
    scene.add(group);active={group,geometries,materials,roadMat,rotor,cabins,angle:0};builds++;
    return group;
  }
  function leave(){
    if(!active)return;
    active.group.parent?.remove(active.group);
    // r128 owns instanceMatrix/instanceColor buffers on InstancedMesh itself.
    active.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
    for(const g of active.geometries)g.dispose();for(const m of active.materials)m.dispose();active=null;disposals++;
  }
  function tick(dt){if(!active)return;active.angle=(active.angle+Math.max(0,Math.min(.05,dt))*.045)%(Math.PI*2);active.rotor.rotation.z=active.angle;active.cabins.forEach(c=>{c.rotation.z=-active.angle;});}
  function weather(preset){if(active){active.roadMat.roughness=preset.rain ? .7 : .85;active.roadMat.metalness=.02;}}
  function metrics(){
    let meshes=0,triangles=0,instances=0;
    active?.group.traverse(o=>{if(o.isMesh){meshes++;const n=o.isInstancedMesh?o.count:1;instances+=n;triangles+=((o.geometry.index?.count??o.geometry.attributes.position.count)/3)*n;}});
    return {active:Boolean(active),builds,disposals,ownedGeometries:active?.geometries.size||0,ownedMaterials:active?.materials.size||0,staticMeshDraws:meshes,staticTriangles:triangles,instances,buildings:buildings.length,palms:palms.length,performanceBoundary:'Static scene structure, not measured renderer draw calls or FPS'};
  }
  return Object.freeze({spec,roads:Object.freeze(roads),nodes:Object.freeze(nodes),edges:Object.freeze(edges),routes:Object.freeze(routes),pose,onRoad,surface,
    layout:()=>({buildings,palms,obstacles}),buildings:()=>active?obstacles:[],enter,leave,tick,weather,metrics,createTraffic,stepTraffic,recoverTraffic,respawn,hit,sweptBox,clipBuildings,contactBounds,trafficContact});
})();
if(typeof window!=='undefined')window.RoadsterCoast=RoadsterCoast;
