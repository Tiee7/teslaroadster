const RoadsterCoast = (() => {
  'use strict';
  const spec = Object.freeze({ id:'coast', halfBound:1200, shorelineX:-330, waterY:-.4,
    spawn:Object.freeze({x:-64,z:700,speed:18}), counts:Object.freeze([12,16,20]),
    pier:Object.freeze({minX:-810,maxX:-250,minZ:-668,maxZ:-632}), wheelHeight:60 });
  const network=RoadsterCoastRoads;
  const xs=[-70],zs=[-850,-300,300,850];
  const roads=[{x:-70,z:200,w:9,d:1300},{x:(network.access.stations[0].x+network.access.stations.at(-1).x)/2,z:-650,w:network.access.stations.at(-1).x-network.access.stations[0].x,d:9}];
  const junctions=[];
  const contains=(b,x,z,pad=0)=>x>=b.minX-pad&&x<=b.maxX+pad&&z>=b.minZ-pad&&z<=b.maxZ+pad;
  const onRoad=(x,z,margin=0)=>{const near=network.nearestSegment(x,z);return network.candidates(x,z).some(c=>c.road)&&(!margin||near&&near.distance<=near.halfWidth-margin);};
  const support=q=>{
    let below=network.querySupport({...q,previousSupportId:q.coastSupportId||q.previousSupportId});
    for(const b of roofBuildings)if(q.x>b.minX-1.1&&q.x<b.maxX+1.1&&q.z>b.minZ-1.8&&q.z<b.maxZ+1.8&&q.y>=b.height-.55&&b.height>below.height)below={id:'roof',height:b.height,normal:{x:0,y:1,z:0},solid:true,water:false};
    return {...below,pier:Boolean(below.pier)};
  };
  const surface=(x,z,pose={y:0})=>support({...pose,x,z});
  const nodes=[...network.routes.map(r=>({id:r.id,...r.stations[0]})),{id:2,...network.access.stations[0]}];
  const edges=[{from:0,to:1},{from:1,to:0},{from:0,to:2},{from:2,to:0}];
  let seed=90173;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const buildings=[];
  for(const x of [-5,95,195,295,355,485,585,685,785,865,1035,1115])for(const z of [-1000,-720,-580,-440,-160,0,160,440,580,720,1000]){
    const w=30+rand()*16,d=28+rand()*14,height=(x<430?8:12)+rand()*(z>600?10:16),color=Math.floor(rand()*6);
    if(x<430&&!(x===95&&z===-720||x===355&&z===1000)&&[-w/2,0,w/2].every(dx=>[-d/2,0,d/2].every(dz=>network.terrainSupport(x+dx,z+dz).height<=.15))&&(!network.nearestSegment(x,z)||network.nearestSegment(x,z).distance>Math.hypot(w,d)/2+18))buildings.push(Object.freeze({x,z,w,d,height,minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,color}));
  }
  const hillsideBuildings=[];
  for(const [i,[x,z]] of [[620,-920],[680,-710],[740,-710],[800,-640],[860,-780],[860,-570],[860,-360],[740,60]].entries()){
    const w=14,d=12,levels=[8,11,14][i%3],heights=[-w/2,0,w/2].flatMap(dx=>[-d/2,0,d/2].map(dz=>network.terrainSupport(x+dx,z+dz).height)),baseY=Math.max(...heights)+.05;
    hillsideBuildings.push(Object.freeze({x,z,w,d,baseY,minY:Math.min(...heights)-.1,wallHeight:levels,height:baseY+levels+.3,minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,kind:'hillside'}));
  }
  const roofBuildings=[...buildings,...hillsideBuildings];
  const palms=[];
  for(const x of [-120,-190])for(let z=-1020;z<=1020;z+=60)palms.push({x,z,h:9+rand()*4});
  for(const x of [380,480])for(let z=-990;z<=990;z+=110)if(zs.every(c=>Math.abs(z-c)>32))palms.push({x,z,h:9+rand()*4});
  palms.splice(0,palms.length,...palms.filter(p=>network.terrainSupport(p.x,p.z).height<=.15&&!(p.z===990&&p.x>=380)));
  const obstacles=[...roofBuildings,...palms.map(p=>({minX:p.x-.6,maxX:p.x+.6,minZ:p.z-.6,maxZ:p.z+.6,height:p.h,kind:'palm'}))];

  const routes=[0,1,2,3].map(id=>network.trafficPath(id));
  const pose=(routeId,distance,lane)=>network.sampleRoute(routeId,distance,lane);
  const junctionTraffic=network.createTrafficJunctions();
  const safe=(p,cars,player,except)=>junctionTraffic.canSpawn(p)&&(Math.abs(p.y-(player.y||0))>3||Math.hypot(p.x-player.x,p.z-player.z)>32)&&cars.every(c=>c===except||c.mesh.visible===false||Math.abs(p.y-c.mesh.position.y)>3||Math.hypot(p.x-c.mesh.position.x,p.z-c.mesh.position.z)>20);
  function place(car,cars,player){
    const path=network.trafficPath(car.coastRoute,car.coastLane);car.coastRouteLength=path.length;
    for(let i=0;i<32;i++){
      const s=(car.coastSpawnCursor+i*113)%path.length,p=pose(car.coastRoute,s,car.coastLane);
      if(!safe(p,cars,player,car))continue;
      car.coastDistance=s;car.coastWaiting=false;car.coastCooldown=0;car.speed=car.desiredSpeed;
      car.y=p.y;car.coastSupportId=p.supportId;car.blastTimer=0;car.mesh.position.set(p.x,p.y,p.z);car.mesh.rotation.order='YXZ';car.mesh.rotation.set(p.pitch,p.yaw,p.roll);car.mesh.visible=true;
      car.vx=p.vx*car.speed;car.vy=p.vy*car.speed;car.vz=p.vz*car.speed;car.coastSpawnCursor=s+97;return true;
    }
    car.coastSpawnCursor+=79;car.coastWaiting=true;car.mesh.visible=false;car.speed=0;car.vx=car.vz=0;return false;
  }
  function createTraffic(count,createMesh,group,player){
    junctionTraffic.reset();
    const cars=[];count=Math.max(0,Math.min(20,Math.floor(count)));
    for(let i=0;i<count;i++){
      const mesh=createMesh(i),routeId=i%routes.length,lane=1.75+3.5*(Math.floor(i/4)%3),path=network.trafficPath(routeId,lane);group.add(mesh);mesh.visible=false;
      const car={mesh,mode:'coast',coastRoute:routeId,coastLane:lane,coastRouteLength:path.length,coastDistance:0,coastSpawnCursor:(Math.floor(i/routes.length)+.35)*path.length/Math.max(1,Math.ceil(count/routes.length)),
        coastWaiting:true,coastCooldown:0,desiredSpeed:12+(i%4)*1.5,speed:0,vx:0,vz:0,y:0,blastTimer:0,
        blastVx:0,blastVy:0,blastVz:0,blastVRoll:0,blastVPitch:0,blastVYaw:0,length:mesh.userData.length||4.62,height:mesh.userData.height||1.25};
      cars.push(car);place(car,cars,player);
    }
    return cars;
  }
  function hit(car){car.coastCooldown=1.8;car.speed=0;car.vx=car.vz=0;}
  function respawn(cars=[]){
    const live=cars.filter(c=>c.mode==='coast'&&c.mesh.visible!==false&&!c.coastWaiting);
    for(let i=0;i<120;i++){
      const p=pose(0,150+i*39);
      if(live.every(c=>Math.abs(c.y-p.y)>3||Math.hypot(c.mesh.position.x-p.x,c.mesh.position.z-p.z)>32))return {...p,speed:spec.spawn.speed};
    }
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
    const before=cars.map((c,index)=>({car:c,index,p:pose(c.coastRoute,c.coastDistance,c.coastLane),x:c.mesh.position.x,y:c.mesh.position.y,z:c.mesh.position.z,vx:c.vx,vz:c.vz,speed:c.speed,visible:c.mesh.visible}));
    junctionTraffic.prepare(cars,dt);
    for(const car of cars){
      if(car.mode!=='coast')continue;
      if(car.blastTimer>0){
        car.blastTimer=Math.max(0,car.blastTimer-dt);car.mesh.position.x+=car.blastVx*dt;car.mesh.position.z+=car.blastVz*dt;
        car.y=(car.y||0)+car.blastVy*dt;car.blastVy-=22*dt;
        car.mesh.position.y=car.y;car.mesh.rotation.x+=(car.blastVPitch||0)*dt;car.mesh.rotation.z+=(car.blastVRoll||0)*dt;
        if(car.blastTimer===0){car.coastWaiting=true;car.mesh.visible=false;car.speed=0;car.vx=car.vz=0;}
        continue;
      }
      if(car.coastWaiting){place(car,cars,player);continue;}
      if(car.coastCooldown>0){car.coastCooldown=Math.max(0,car.coastCooldown-dt);car.speed=0;car.vx=car.vz=0;continue;}
      const own=before[cars.indexOf(car)],p=own.p,aheadPose=pose(car.coastRoute,car.coastDistance+25,car.coastLane),merge=p.wide>.001&&pose(car.coastRoute,car.coastDistance+120,car.coastLane).wide<p.wide-.001;
      const bend=Math.acos(Math.max(-1,Math.min(1,p.dx*aheadPose.dx+p.dz*aheadPose.dz)))/25;
      let target=Math.min(car.desiredSpeed,Math.sqrt(3.5/Math.max(.001,bend)));
      for(const b of before){
        if(b.car===car||!b.visible||Math.abs(b.y-p.y)>3)continue;
        if(merge&&b.car.coastRoute===car.coastRoute){const length=network.routes[car.coastRoute%2].stations.at(-1).sxz,gap=(car.coastRoute>=2?-1:1)*(b.p.referenceS-p.referenceS),ahead=(gap+length)%length;
          if(ahead>.25&&ahead<60||Math.abs(gap)<=.25&&(b.car.coastLane<car.coastLane||b.car.coastLane===car.coastLane&&b.index<own.index))target=Math.min(target,Math.max(0,((Math.abs(gap)<=.25?0:ahead)-12)/1.6));}
        const x=b.x-p.x,z=b.z-p.z,ahead=x*p.dx+z*p.dz,lateral=Math.abs(x*p.dz-z*p.dx);
        if(ahead>0&&ahead<42&&lateral<2.6)target=Math.min(target,Math.max(0,(ahead-10)/1.6));
      }
      target=Math.min(target,junctionTraffic.targetSpeed(car));
      car.speed+=Math.max(-7*dt,Math.min(2.2*dt,target-car.speed));
      car.coastRouteLength=network.trafficPath(car.coastRoute,car.coastLane).length;
      const nextDistance=(car.coastDistance+car.speed*dt)%car.coastRouteLength,next=pose(car.coastRoute,nextDistance,car.coastLane);
      if(!junctionTraffic.canAdvance(car,next)){car.speed=0;car.vx=car.vy=car.vz=0;continue;}
      car.coastDistance=nextDistance;car.y=next.y;car.coastSupportId=next.supportId;car.mesh.position.set(next.x,next.y,next.z);car.mesh.rotation.set(next.pitch,next.yaw,next.roll);
      car.vx=next.vx*car.speed;car.vy=next.vy*car.speed;car.vz=next.vz*car.speed;
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
    const oldY=oldCar.y||0,newY=car.mesh.position.y||0;
    const start=previous.y-oldY,delta=(state.y-previous.y)-(newY-oldY);
    let enter=interval.enter,exit=interval.exit;
    const lo=-1.25,hi=car.height+.15;
    if(Math.abs(delta)<1e-12){if(start<lo||start>hi)return null;}
    else{const a=(lo-start)/delta,b=(hi-start)/delta;enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));}
    if(enter>exit||enter>1)return null;
    const y=previous.y+(state.y-previous.y)*enter,npcY=oldY+(newY-oldY)*enter,relativeY=y-npcY;
    return {t:enter,y,npcY,relativeY,body:relativeY<car.height-.15};
  }

  function clipBuildings(previous,state){
    let earliest=null;
    for(const b of obstacles){
      if(Math.max(previous.y,state.y)+1.25<(b.minY??0))continue;
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

  let active=null,builds=0,disposals=0,failedBuilds=0;
  const artBudget=Object.freeze({sourceGzipBytes:32*1024,staticMeshDraws:96,staticTriangles:180000,textureBytes:4*1024*1024,geometryAndInstanceBytes:8*1024*1024,cpuPixelCacheBytes:1024*1024});
  let groundFieldCache=null;
  function restoreSceneState(owner){
    const previous=owner.previousScene;
    if(!previous)return;
    owner.scene.background=previous.background;owner.scene.fog=previous.fog;owner.scene.environment=previous.environment;
    for(const saved of previous.lights)saved.light.visible=saved.visible;
  }
  function disposeResources(owner){
    owner.group.parent?.remove(owner.group);
    for(const mesh of owner.instances)mesh.dispose();
    for(const light of owner.lights)light.dispose?.();
    for(const geo of owner.geometries)geo.dispose();
    for(const mat of owner.materials)mat.dispose();
    for(const texture of owner.textures)texture.dispose();
    owner.group.clear();owner.instances.clear();owner.lights.clear();owner.geometries.clear();owner.materials.clear();owner.textures.clear();
  }
  function followCoastFocus(owner){
    let focus=null;try{focus=owner.bridge?.getFocus?.();}catch{}
    if(focus&&Number.isFinite(focus.x)&&Number.isFinite(focus.z)){owner.focus.x=focus.x;owner.focus.z=focus.z;}
    const {x,z}=owner.focus,[dx,dy,dz]=owner.sunOffset;
    owner.sun.position.set(x+dx,dy,z+dz);owner.sun.target.position.set(x,0,z);owner.updateFoliage?.(x,z);owner.updateDetails?.(x,z);
  }
  function applyCoastWeather(owner,preset={}){
    const previous=owner.previousScene;
    if(Number.isFinite(preset.bgColor)&&previous.background?.isColor)previous.background.setHex(preset.bgColor);
    if(Number.isFinite(preset.fogColor)&&previous.fog?.color)previous.fog.color.setHex(preset.fogColor);
    if(Number.isFinite(preset.fogDensity)&&previous.fog&&'density' in previous.fog)previous.fog.density=preset.fogDensity;
    if(owner.scene.environment!==owner.skyTexture)previous.environment=owner.scene.environment;
    const sunset=Boolean(preset.marsSun),rain=Boolean(preset.rain);
    const settings=preset.daylight?{background:0xc7dfed,fog:0xc7dfed,density:.0002,sky:0xdbe9f4,ground:0x9a9b82,fill:.58,key:0xfff5df,strength:1.0,offset:[-55,100,48],top:[178,210,231],horizon:[219,234,240],bottom:[143,153,144]}:sunset?{background:0xc6a48a,fog:0xb99582,density:.00065,sky:0xe0b49a,ground:0x8c7266,fill:.62,key:0xffd09b,strength:1.25,offset:[-68,44,35],top:[120,151,169],horizon:[213,179,155],bottom:[84,83,74]}:
      rain?{background:0x101e29,fog:0x263c47,density:.00085,sky:0x8da4af,ground:0x565c58,fill:.38,key:0x9bb4bf,strength:.68,offset:[-55,90,48],top:[12,25,36],horizon:[48,67,76],bottom:[10,19,24]}:
      {background:0x0d1c29,fog:0x263f4b,density:.00055,sky:0x9bb5c5,ground:0x655d4c,fill:.46,key:0xb2cbd5,strength:.92,offset:[-55,90,48],top:[11,22,35],horizon:[52,78,91],bottom:[10,20,27]};
    owner.background.setHex(settings.background);owner.fog.color.setHex(settings.fog);owner.fog.density=settings.density;
    owner.scene.background=owner.background;owner.scene.fog=owner.fog;owner.scene.environment=owner.skyTexture;
    owner.hemi.color.setHex(settings.sky);owner.hemi.groundColor.setHex(settings.ground);owner.hemi.intensity=settings.fill;
    owner.sun.color.setHex(settings.key);owner.sun.intensity=settings.strength;owner.sunOffset=settings.offset;followCoastFocus(owner);
    owner.skyTexture.image.forEach((face,faceIndex)=>{
      const image=face.image,data=image.data;
      for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
        const u=(x+.5)/image.width*2-1,v=(y+.5)/image.height*2-1;
        const directionY=(faceIndex===2?1:faceIndex===3?-1:-v)/Math.sqrt(1+u*u+v*v),t=(1-directionY)/2;
        const weight=t<.52?t/.52:(t-.52)/.48,a=t<.52?settings.top:settings.horizon,b=t<.52?settings.horizon:settings.bottom,i=(y*image.width+x)*4;
        for(let c=0;c<3;c++)data[i+c]=Math.round(a[c]+(b[c]-a[c])*weight);data[i+3]=255;
      }
    });
    owner.waterMaterial.roughness=sunset?.29:rain?.42:.32;owner.waterMaterial.envMapIntensity=preset.daylight?.35:sunset?.62:rain?.55:.75;
    owner.skyTexture.needsUpdate=true;owner.facadeLitMaterial.emissiveIntensity=preset.daylight?.02:sunset?.06:rain?.34:.42;owner.lampMaterial.emissiveIntensity=preset.daylight?.025:sunset?.18:rain?.8:.65;owner.roadMat.roughness=rain?.76:.94;owner.roadMat.metalness=.02;owner.roadMat.envMapIntensity=preset.daylight?.15:rain?.25:.4;
  }
  function enter(scene,THREE=globalThis.THREE){
    if(active)return active.group;
    const group=new THREE.Group();group.name='original-coastal-district';
    const geometries=new Set(),materials=new Set(),textures=new Set(),instances=new Set(),lights=new Set(),own=g=>(geometries.add(g),g);
    const owner={group,geometries,materials,textures,instances,lights,scene};
    try {
    // Grazing-angle road/paver detail otherwise dissolves into isotropic mip
    // averages nearby. Keep original pixels, metre-correct UVs and mipmaps;
    // bound the sampler quality once, without per-frame work or extra textures.
    let groundAnisotropy=1;
    try {
      const maximum=scene.userData?.coastArtBridge?.getMaxGroundAnisotropy?.();
      if(Number.isFinite(maximum))groundAnisotropy=Math.max(1,Math.min(8,Math.floor(maximum)));
    } catch {}
    function grainTexture(kind,size=kind==='sand'?256:128){
      const bytes=new Uint8Array(size*size*4);let value=kind==='asphalt'?991:kind==='sand'?771:kind==='plaster'?331:551;
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        value=(Math.imul(value,1664525)+1013904223)>>>0;
        const noise=value/4294967296;
        let v=kind==='asphalt'?225+noise*29:kind==='sand'?239+noise*16:kind==='plaster'?247+noise*8:235+noise*19;
        if(kind==='paver'&&(x%(size/4)===0||y%(size/4)===0))v=219;
        if(kind==='deck'){v=228+noise*26;const board=Math.floor(y/16);if(y%16===0||(x+(board%2)*64)%128===0)v=190;}
        const i=(y*size+x)*4;bytes[i]=bytes[i+1]=bytes[i+2]=Math.floor(v);bytes[i+3]=255;
      }
      const texture=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;
      texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
      texture.anisotropy=kind==='plaster'?1:groundAnisotropy;
      texture.repeat.set(kind==='plaster'?12:1,kind==='plaster'?6:1);
      textures.add(texture);return texture;
    }
    const plasterTexture=grainTexture('plaster'),sandTexture=grainTexture('sand'),asphaltTexture=grainTexture('asphalt'),paverTexture=grainTexture('paver'),deckTexture=grainTexture('deck');
    deckTexture.userData={coastTileMetres:2.4};
    function waterNormalTexture(){
      const size=128,bytes=new Uint8Array(size*size*4),waves=[[3,2,.55],[7,-5,.22],[11,13,.12],[-17,9,.065]];
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        let dx=0,dz=0;for(const [fx,fz,amplitude] of waves){const phase=Math.PI*2*(fx*x/size+fz*y/size),gradient=Math.cos(phase)*amplitude*Math.PI*2/24;dx+=fx*gradient;dz+=fz*gradient;}
        const length=Math.hypot(dx,dz,1),i=(y*size+x)*4;bytes[i]=Math.round((-dx/length*.5+.5)*255);bytes[i+1]=Math.round((-dz/length*.5+.5)*255);bytes[i+2]=Math.round((1/length*.5+.5)*255);bytes[i+3]=255;
      }
      const texture=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;texture.userData={coastTileMetres:24};textures.add(texture);return texture;
    }
    const waterNormals=waterNormalTexture();

    const material=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.85,metalness:.02,...extra});materials.add(m);return m;};
    const box=own(new THREE.BoxGeometry(1,1,1)),paintPlane=own(new THREE.PlaneGeometry(1,1)),windowPlane=own(new THREE.PlaneGeometry(1,1));
    paintPlane.rotateX(-Math.PI/2);windowPlane.rotateY(Math.PI/2);
    const palette=[0xe3dbca,0xc1d0c3,0xdcc9b7,0xd6d4ca,0xaac1ba,0xd4bea6];
    function districtWallColor(b,index){
      const coastal=[0xe2dbc9,0xc0d0c6,0xd8c8b6,0xd8cbb8],inland=[0xd0d2c2,0xc2c9bc,0xd8c9b8,0xb4c8be];
      const sector=(Math.floor((b.z+1000)/560)+Math.floor(Math.max(0,b.x)/300))%4;
      return new THREE.Color((b.x<430?coastal:inland)[sector]).multiplyScalar([.97,1,.985][index%3]).getHex();
    }
    function curvedParapetGeometry(){
      const positions=[],indices=[],sections=8;
      function quad(a,b,c,d,target){
        const n=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).cross(new THREE.Vector3(...c).sub(new THREE.Vector3(...a)));
        if(n.dot(new THREE.Vector3(...target))<0)[b,d]=[d,b];
        const i=positions.length/3;positions.push(...a,...b,...c,...d);indices.push(i,i+1,i+2,i,i+2,i+3);
      }
      const height=u=>.3+.7*Math.cos(u*Math.PI);
      for(let i=0;i<sections;i++){
        const a=i/sections-.5,b=(i+1)/sections-.5,ha=height(a),hb=height(b);
        for(const side of [-1,1])quad([side*.5,0,a],[side*.5,ha,a],[side*.5,hb,b],[side*.5,0,b],[side,0,0]);
        quad([-.5,ha,a],[.5,ha,a],[.5,hb,b],[-.5,hb,b],[0,1,0]);
      }
      quad([-.5,0,-.5],[.5,0,-.5],[.5,0,.5],[-.5,0,.5],[0,-1,0]);
      for(const side of [-1,1])quad([-.5,0,side*.5],[.5,0,side*.5],[.5,.3,side*.5],[-.5,.3,side*.5],[0,0,side]);
      const geo=own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
    }
    function windowRevealGeometry(){
      const points=[],indices=[],outer=[[.6,.6],[-.6,.6],[-.6,-.6],[.6,-.6]],inner=[[.5,.5],[-.5,.5],[-.5,-.5],[.5,-.5]];
      function quad(a,b,c,d,normal){
        const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),cv=new THREE.Vector3(...c);
        if(bv.sub(av).cross(cv.sub(av)).dot(new THREE.Vector3(...normal))<0)[b,d]=[d,b];
        const i=points.length/3;points.push(...a,...b,...c,...d);indices.push(i,i+1,i+2,i,i+2,i+3);
      }
      for(let i=0;i<4;i++){
        const j=(i+1)%4,o=outer[i],n=outer[j],a=inner[i],b=inner[j],normal=[0,(o[0]+n[0])/2,(o[1]+n[1])/2];
        quad([-.5,...o],[-.5,...n],[-.5,...b],[-.5,...a],[-1,0,0]);
        quad([-.5,...o],[-.5,...n],[.5,...n],[.5,...o],normal);
        quad([-.5,...a],[-.5,...b],[.5,...b],[.5,...a],normal.map(v=>-v));
      }
      const geo=own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
    }
    const revealGeometry=windowRevealGeometry();
    const batches=[];
    function batch(name,geo,mat,items,flags={}){
      const mesh=new THREE.InstancedMesh(geo,mat,items.length);instances.add(mesh);const dummy=new THREE.Object3D();mesh.name=name;
      items.forEach((v,i)=>{dummy.position.set(...v.p);dummy.scale.set(...v.s);dummy.rotation.set(...(v.r||[0,0,0]));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(v.color!==undefined)mesh.setColorAt(i,new THREE.Color(v.color));});
      mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.receiveShadow=Boolean(flags.receiveShadow);mesh.castShadow=Boolean(flags.castShadow);mesh.userData.coastArt={visualOnly:Boolean(flags.visualOnly),flat:Boolean(flags.flat)};mesh.renderOrder=flags.renderOrder||0;group.add(mesh);batches.push(mesh);return mesh;
    }
    function unionRectangles(input){
     const rects=input.map(r=>({minX:r.x-r.w/2,maxX:r.x+r.w/2,minZ:r.z-r.d/2,maxZ:r.z+r.d/2}));
     const xs=[...new Set(rects.flatMap(r=>[r.minX,r.maxX]))].sort((a,b)=>a-b),zs=[...new Set(rects.flatMap(r=>[r.minZ,r.maxZ]))].sort((a,b)=>a-b);
     const nx=xs.length,nz=zs.length,coverage=new Int32Array(nx*nz),xIndex=new Map(xs.map((x,i)=>[x,i])),zIndex=new Map(zs.map((z,i)=>[z,i]));
     for(const r of rects){const a=xIndex.get(r.minX),b=xIndex.get(r.maxX),c=zIndex.get(r.minZ),d=zIndex.get(r.maxZ);coverage[c*nx+a]++;coverage[c*nx+b]--;coverage[d*nx+a]--;coverage[d*nx+b]++;}
     for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const i=z*nx+x;coverage[i]+=(x?coverage[i-1]:0)+(z?coverage[i-nx]:0)-(x&&z?coverage[i-nx-1]:0);}
     const result=[],open=new Map();
     for(let iz=0;iz<zs.length-1;iz++){
      const z0=zs[iz],z1=zs[iz+1],z=(z0+z1)/2,runs=[];let start=null;
      for(let ix=0;ix<xs.length-1;ix++){
       const filled=coverage[iz*nx+ix]>0;
       if(filled&&start===null)start=xs[ix];
       if(start!==null&&(!filled||ix===xs.length-2)){const end=filled?xs[ix+1]:xs[ix];runs.push([start,end]);start=null;}
      }
      const live=new Set();for(const [minX,maxX] of runs){
       const key=minX+':'+maxX,previous=open.get(key);live.add(key);
       if(previous&&previous.maxZ===z0)previous.maxZ=z1;else{const r={minX,maxX,minZ:z0,maxZ:z1};result.push(r);open.set(key,r);}
      }
      for(const key of open.keys())if(!live.has(key))open.delete(key);
     }
     return result;
    }
    function flatBatch(name,items,mat,tileMetres=2.4){
      const positions=[],uvs=[],indices=[];
      for(const v of items){
        const [x,cy,z]=v.p,[w,h,d]=v.s,y=cy+h/2,x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2,i=positions.length/3;
        positions.push(x0,y,z0,x0,y,z1,x1,y,z1,x1,y,z0);
        uvs.push(x0/tileMetres,z0/tileMetres,x0/tileMetres,z1/tileMetres,x1/tileMetres,z1/tileMetres,x1/tileMetres,z0/tileMetres);
        indices.push(i,i+1,i+2,i,i+2,i+3);
      }
      const geo=own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();
      const mesh=new THREE.Mesh(geo,mat);mesh.name=name;mesh.receiveShadow=true;mesh.userData.coastArt={visualOnly:true,flat:true};
      mat.userData.coastMetresPerTextureTile=tileMetres;group.add(mesh);return mesh;
    }
    const slab=(name,x,z,w,d,color,y=-.12,h=.16,extra={})=>{
      const mat=material(color,extra),items=[{p:[x,y,z],s:[w,h,d]}];
      return extra.map?flatBatch(name,items,mat,extra.map.userData?.coastTileMetres||(extra.map===paverTexture?2.4:4)):batch(name,box,mat,items,{receiveShadow:true,flat:true});
    };
    function triangleMesh(name,triangles,mat){
      const positions=[],uvs=[];
      for(const t of triangles){
        const cross=(t.b.z-t.a.z)*(t.c.x-t.a.x)-(t.b.x-t.a.x)*(t.c.z-t.a.z);
        for(const p of cross<0?[t.a,t.c,t.b]:[t.a,t.b,t.c]){positions.push(p.x,p.y,p.z);uvs.push(p.x/4,p.z/4);}
      }
      const geometry=own(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,mat);mesh.name=name;mesh.receiveShadow=true;mesh.userData.coastTerrainVersion=2;group.add(mesh);return mesh;
    }
    function exclusiveTop(subjects,masks){
      const grid=new Map(),cell=(x,z)=>`${Math.floor(x/64)},${Math.floor(z/64)}`;
      for(const m of masks)for(let x=Math.floor(m.minX/64);x<=Math.floor(m.maxX/64);x++)for(let z=Math.floor(m.minZ/64);z<=Math.floor(m.maxZ/64);z++){const k=`${x},${z}`;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(m);}
      const clip=(poly,distance)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],u=distance(a),v=distance(b),A=u>=-1e-9,B=v>=-1e-9;if(A)out.push(a);if(A!==B){const t=u/(u-v);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});}}const clean=out.filter((p,i)=>!i||Math.hypot(p.x-out[i-1].x,p.z-out[i-1].z)>1e-7);if(clean.length>1&&Math.hypot(clean[0].x-clean.at(-1).x,clean[0].z-clean.at(-1).z)<1e-7)clean.pop();return clean;};
      const valid=p=>p.length>=3&&Math.abs(p.slice(1,-1).reduce((n,a,i)=>{const b=p[i+2],o=p[0];return n+(a.x-o.x)*(b.z-o.z)-(b.x-o.x)*(a.z-o.z);},0))>1e-6;
      const output=[];
      for(const t of subjects){
        if([t.a,t.b,t.c].some(p=>Math.abs(p.y)>1e-5)){output.push(t);continue;}
        const minX=Math.min(t.a.x,t.b.x,t.c.x),maxX=Math.max(t.a.x,t.b.x,t.c.x),minZ=Math.min(t.a.z,t.b.z,t.c.z),maxZ=Math.max(t.a.z,t.b.z,t.c.z),near=new Set();
        for(let x=Math.floor(minX/64);x<=Math.floor(maxX/64);x++)for(let z=Math.floor(minZ/64);z<=Math.floor(maxZ/64);z++)for(const m of grid.get(`${x},${z}`)||[])if(m.maxX>=minX&&m.minX<=maxX&&m.maxZ>=minZ&&m.minZ<=maxZ)near.add(m);
        let pieces=[[t.a,t.b,t.c]];
        for(const m of near){
          if(!pieces.length)break;
          const mask=m.poly;
          const area=mask.reduce((n,a,i)=>{const b=mask[(i+1)%mask.length];return n+a.x*b.z-b.x*a.z;},0),sign=area>=0?1:-1,next=[];if(Math.abs(area)<1e-7)continue;
          for(const part of pieces){let intersection=part;for(let i=0;i<mask.length&&valid(intersection);i++){const a=mask[i],b=mask[(i+1)%mask.length];intersection=clip(intersection,p=>sign*((b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x)));}if(!valid(intersection)){next.push(part);continue;}let inside=part;for(let i=0;i<mask.length&&inside.length>=3;i++){const a=mask[i],b=mask[(i+1)%mask.length],side=p=>sign*((b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x)),outside=clip(inside,p=>-side(p));if(valid(outside))next.push(outside);inside=clip(inside,side);if(!valid(inside))break;}}
          if(next.length>256)throw Error('excessive surface fragmentation');pieces=next;
        }
        for(const poly of pieces)for(let i=1;i+1<poly.length;i++){const a=poly[0],b=poly[i],c=poly[i+1];if(Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))>1e-7)output.push({a,b,c});}
      }
      return output;
    }
    const roadTops=network.triangles.filter(t=>t.id.startsWith('road'));
    const flatMask=poly=>({poly,minX:Math.min(...poly.map(p=>p.x)),maxX:Math.max(...poly.map(p=>p.x)),minZ:Math.min(...poly.map(p=>p.z)),maxZ:Math.max(...poly.map(p=>p.z))});
    const roadMasks=[],earthMasks=[];
    for(const s of network.segments){if(s.shared||s.bridge||s.a.y!==0||s.b.y!==0)continue;
      roadMasks.push(flatMask([s.rows[0][0],s.rows[0][4],s.rows[1][4],s.rows[1][0]]));
      const poly=[[-1,s.a],[1,s.a],[1,s.b],[-1,s.b]].map(([side,p])=>({x:p.x+p.rx*side*32,y:0,z:p.z+p.rz*side*32}));
      if(poly.every(p=>Math.abs(network.terrainSupport(p.x,p.z).height)<1e-5))earthMasks.push(flatMask(poly));
    }
    earthMasks.push(...roadMasks,...network.banks.filter(t=>[t.a,t.b,t.c].every(p=>Math.abs(p.y)<1e-5)).map(t=>flatMask([t.a,t.b,t.c])));
    const bankTops=exclusiveTop(network.banks,roadMasks);
    const groundMaterial=material(0xffffff,{roughness:1});
    const terrainTriangles=[];for(let i=0;i<network.terrain.indices.length;i+=3){const ids=network.terrain.indices.slice(i,i+3);terrainTriangles.push({a:network.terrain.vertices[ids[0]],b:network.terrain.vertices[ids[1]],c:network.terrain.vertices[ids[2]]});}
    const inlandGround=triangleMesh('coast-inland-ground',exclusiveTop(terrainTriangles,earthMasks),groundMaterial),groundUV=inlandGround.geometry.attributes.uv,groundPosition=inlandGround.geometry.attributes.position;
    for(let i=0;i<groundUV.count;i++)groundUV.setXY(i,(groundPosition.getX(i)+145)/1345,(groundPosition.getZ(i)+1200)/2400);
    function groundToneField(){
      const size=256,width=1345,depth=2400,minX=-145,minZ=-1200;
      if(!groundFieldCache){const bytes=new Uint8Array(size*size*4),regions=[];
      const row=new Uint8Array(size*4),worldX=new Float64Array(size),worldZ=new Float64Array(size);
      for(let x=0;x<size;x++){const i=x*4,t=x/(size-1);row[i]=135+((t*3+.5)|0);row[i+1]=145;row[i+2]=123-((t*2+.5)|0);row[i+3]=255;worldX[x]=minX+(x+.5)*width/size;worldZ[x]=minZ+(x+.5)*depth/size;}
      for(let y=0;y<size;y++)bytes.set(row,y*size*4);
      function tint(x0,x1,z0,z1,color,blend=8,strength=.85){
        if(x1<=x0||z1<=z0)return;
        regions.push({x0,x1,z0,z1,color,blend});const c=new THREE.Color(color),rgb=[c.r*255,c.g*255,c.b*255];
        const left=Math.max(0,Math.floor((x0-blend-minX)/width*size)),right=Math.min(size-1,Math.ceil((x1+blend-minX)/width*size)),bottom=Math.max(0,Math.floor((z0-blend-minZ)/depth*size)),top=Math.min(size-1,Math.ceil((z1+blend-minZ)/depth*size));
        for(let y=bottom;y<=top;y++)for(let x=left;x<=right;x++){
          const wx=worldX[x],wz=worldZ[y],dx=wx<x0?x0-wx:wx>x1?wx-x1:0,dz=wz<z0?z0-wz:wz>z1?wz-z1:0;
          if(dx>=blend||dz>=blend)continue;const t=1-Math.sqrt(dx*dx+dz*dz)/blend;if(t<=0)continue;const a=t*t*(3-2*t)*strength,i=(y*size+x)*4;
          for(let k=0;k<3;k++)bytes[i+k]=bytes[i+k]+(rgb[k]-bytes[i+k])*a+.5;
        }
      }
      for(const e of districtEntryMeta){
        if(!e.linkedToSidewalk)continue;const b=buildings[e.buildingIndex],axis=e.axis,side=e.side,face=axis==='x'?b.x+side*b.w/2:b.z+side*b.d/2;
        const lo=Math.min(face,e.pathEnd),hi=Math.max(face,e.pathEnd),along=axis==='x'?b.z:b.x,half=(axis==='x'?b.d:b.w)/2;
        if(axis==='x')tint(lo,hi,along-half,along+half,0xa7a393,8,.8);else tint(along-half,along+half,lo,hi,0xa7a393,8,.8);
      }
      tint(69,111,349,381,0x9a927e,7,.65);
      for(const r of cornerCourts)tint(r.minX,r.maxX,r.minZ,r.maxZ,0xa7a393,6,.8);
      groundFieldCache=Object.freeze({pixels:bytes,regions:Object.freeze(regions.map(r=>Object.freeze(r)))});}
      const texture=new THREE.DataTexture(groundFieldCache.pixels,size,size,THREE.RGBAFormat);texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;textures.add(texture);
      texture.userData={coastWorldField:true,bounds:[minX,minX+width,minZ,minZ+depth]};group.userData.coastGroundField={size,bounds:texture.userData.bounds,regions:groundFieldCache.regions,scope:'Visual color only, not traversability/physical material'};return texture;
    }

    function coastalSurface(kind,mat){
      const water=kind==='water',shore=spec.shorelineX,half=spec.halfBound;
      const stations=water?[-half,shore-370,shore-170,shore-90,shore-40,shore-15,shore]:[shore,shore+2,shore+6,shore+12,shore+24,-145];
      const positions=[],uvs=[],colors=[],indices=[],deep=new THREE.Color(water?0x164d6c:0x9c987e),light=new THREE.Color(water?0x438684:0xd9c69f),color=new THREE.Color();
      const rows=40,columns=stations.length,tile=water?24:4;
      for(let row=0;row<=rows;row++){
        const z=-half+row*half*2/rows;
        for(let column=0;column<columns;column++){
          const base=stations[column],interior=column>0&&column<columns-1;
          const x=base+(interior?Math.sin(z*.021+column*1.7)*(water?1.5:.55):0);
          const distance=water?shore-x:x-shore;
          const t=water?Math.exp(-distance/45):Math.min(1,Math.max(0,distance/(16+2*Math.sin(z*.026))));
          color.lerpColors(deep,light,t);positions.push(x,water?-.42:-.04,z);uvs.push(x/tile,z/tile);colors.push(color.r,color.g,color.b);
        }
      }
      for(let row=0;row<rows;row++)for(let column=0;column<columns-1;column++){
        const a=row*columns+column,b=a+columns;indices.push(a,b,b+1,a,b+1,a+1);
      }
      const geometry=own(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,mat);mesh.name=water?'coast-water':'coast-sand';mesh.receiveShadow=true;mesh.userData.coastArt={visualOnly:true,flat:true};mat.userData.coastMetresPerTextureTile=tile;group.add(mesh);return mesh;
    }
    const waterMaterial=material(0xffffff,{vertexColors:true,normalMap:waterNormals,normalScale:new THREE.Vector2(.28,.28),roughness:.32,metalness:.08,envMapIntensity:.75});
    coastalSurface('water',waterMaterial);
    const sandMaterial=material(0xffffff,{vertexColors:true,map:sandTexture,roughness:.95});
    coastalSurface('sand',sandMaterial);
    const shoreGeometry=own(new THREE.BufferGeometry()),shoreX=spec.shorelineX;
    shoreGeometry.setAttribute('position',new THREE.Float32BufferAttribute([shoreX,-.42,-1200,shoreX,-.04,-1200,shoreX,-.04,1200,shoreX,-.42,1200],3));
    shoreGeometry.setAttribute('uv',new THREE.Float32BufferAttribute([-300,-.105,-300,-.01,300,-.01,300,-.105],2));
    const shoreColors=[];for(const color of [0x7c8d80,0x9c987e,0x9c987e,0x7c8d80]){const c=new THREE.Color(color);shoreColors.push(c.r,c.g,c.b);}
    shoreGeometry.setAttribute('color',new THREE.Float32BufferAttribute(shoreColors,3));shoreGeometry.setIndex([0,2,1,0,3,2]);shoreGeometry.computeVertexNormals();
    const shoreCut=new THREE.Mesh(shoreGeometry,sandMaterial);shoreCut.name='coast-shore-cut-face';shoreCut.receiveShadow=true;shoreCut.userData.coastArt={visualOnly:true,shoreClosure:true};group.add(shoreCut);
    const foamPositions=[],foamIndices=[];
    for(let z=-1188;z<1180;z+=36)for(let section=0;section<4;section++){
      const a=z+section*6,b=a+6;if(b>=-680&&a<=-620)continue;const x0=-330.48+.12*Math.sin(a*.08),x1=-330.48+.12*Math.sin(b*.08),width=.11+.035*Math.sin(z*.21),i=foamPositions.length/3;
      foamPositions.push(x0-width,-.4196,a,x0+width,-.4196,a,x1+width,-.4196,b,x1-width,-.4196,b);foamIndices.push(i,i+3,i+2,i,i+2,i+1);
    }
    const foamGeo=own(new THREE.BufferGeometry());foamGeo.setAttribute('position',new THREE.Float32BufferAttribute(foamPositions,3));foamGeo.setIndex(foamIndices);foamGeo.computeVertexNormals();
    const foam=new THREE.Mesh(foamGeo,material(0xa1b9b4,{roughness:.88,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,depthWrite:false}));foam.name='coast-broken-surf-ribbons';foam.renderOrder=1;foam.userData.coastArt={visualOnly:true,flat:true};group.add(foam);

    slab('coast-promenade',-134,0,22,2200,0xc2b9a5,-.02,.10,{map:paverTexture,roughness:.92});
    const roadMat=material(0x343c40,{map:asphaltTexture,roughness:.94,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
    triangleMesh('coast-road-surfaces',roadTops,roadMat);
    triangleMesh('coast-road-earth-banks',bankTops,material(0x8d967c,{map:sandTexture,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
    const paint=[],decks=[];
    const strip=(a,b,offset,width,y=.015)=>{
      const corners=[{x:a.x+a.rx*(offset-width/2),y:a.y+y,z:a.z+a.rz*(offset-width/2)},{x:a.x+a.rx*(offset+width/2),y:a.y+y,z:a.z+a.rz*(offset+width/2)},{x:b.x+b.rx*(offset-width/2),y:b.y+y,z:b.z+b.rz*(offset-width/2)},{x:b.x+b.rx*(offset+width/2),y:b.y+y,z:b.z+b.rz*(offset+width/2)}];
      paint.push({a:corners[0],b:corners[1],c:corners[2]},{a:corners[1],b:corners[3],c:corners[2]});
    };
    for(const s of network.segments){
      if(s.shared)continue;
      for(const side of[-1,1]){
        const a={...s.a},b={...s.b},offset=side*(a.halfWidth-1),end=side*(b.halfWidth-1);b.x+=b.rx*(end-offset);b.z+=b.rz*(end-offset);strip(a,b,offset,.12);
        if(Math.floor(s.a.s/9)%2===0)for(const lane of[3.5,7])if(Math.min(s.a.halfWidth,s.b.halfWidth)>lane+3.4)strip(s.a,s.b,side*lane,.12);
      }
      if(Math.floor(s.a.s/9)%2===0)strip(s.a,s.b,0,.12);
      if(s.bridge){
        const down=p=>({...p,y:p.y-network.SLAB_DEPTH}),[a,b]=s.rows;
        decks.push({a:down(a[0]),b:down(b[0]),c:down(a[4])},{a:down(a[4]),b:down(b[0]),c:down(b[4])});
        for(const edge of[0,4])decks.push({a:a[edge],b:down(a[edge]),c:b[edge]},{a:b[edge],b:down(a[edge]),c:down(b[edge])});
      }
    }
    const arrowRecords=[];
    for(const id of[0,1,2,3])for(let distance=90;distance<routes[id].length;distance+=160){
      const p=pose(id,distance),right={x:-p.dz,z:p.dx},vertices=[[-.20,-2.7],[.20,-2.7],[.20,.5],[.85,.5],[0,2.7],[-.85,.5],[-.20,.5]].map(([x,z])=>{
        const wx=p.x+right.x*x+p.dx*z,wz=p.z+right.z*x+p.dz*z,surface=network.candidates(wx,wz).find(s=>s.road&&Math.abs(s.height-p.y)<.5);
        return{x:wx,y:(surface?.height??p.y)+.018,z:wz};
      });
      for(const [a,b,c]of[[0,1,2],[0,2,6],[6,2,3],[6,3,5],[3,4,5]])paint.push({a:vertices[a],b:vertices[b],c:vertices[c]});
      arrowRecords.push({routeId:id,distance,x:p.x,y:p.y,z:p.z,dx:p.dx,dz:p.dz});
    }
    group.userData.coastRouteArrows=arrowRecords;
    triangleMesh('coast-terrain-road-paint',paint,material(0xd0c4a0,{roughness:.95,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
    triangleMesh('coast-viaduct-deck',decks,material(0x96998c,{roughness:.96,side:THREE.DoubleSide}));
    const rails=network.structures.filter(b=>b.kind==='rail').map(b=>{
      const dx=b.b.x-b.a.x,dy=b.b.y-b.a.y,dz=b.b.z-b.a.z;
      return{p:[(b.a.x+b.b.x)/2,(b.a.y+b.b.y)/2+.515,(b.a.z+b.b.z)/2],s:[.24,.87,Math.hypot(dx,dy,dz)],r:[-Math.atan2(dy,Math.hypot(dx,dz)),Math.atan2(dx,dz),0,'YXZ']};
    });
    batch('coast-viaduct-rails',box,material(0xc1bba6),rails,{receiveShadow:true});
    batch('coast-viaduct-piers',box,material(0x96998c),network.structures.filter(b=>b.kind==='pier').map(b=>({p:[(b.minX+b.maxX)/2,(b.minY+b.maxY)/2,(b.minZ+b.maxZ)/2],s:[b.maxX-b.minX,b.maxY-b.minY,b.maxZ-b.minZ]})),{castShadow:true,receiveShadow:true});
    batch('coast-bridge-abutments',box,material(0x96998c),network.structures.filter(b=>b.kind==='abutment').map(b=>({p:[(b.a.x+b.b.x)/2,(b.minY+b.maxY)/2,(b.a.z+b.b.z)/2],s:[b.thickness,b.maxY-b.minY,Math.hypot(b.b.x-b.a.x,b.b.z-b.a.z)],r:[0,Math.atan2(b.b.x-b.a.x,b.b.z-b.a.z),0]})),{castShadow:true,receiveShadow:true});

    const wallPieces=[],wallRoles=[],signatureHouses=[];
    for(const [index,b] of buildings.entries()){
      const selected=[355,485].includes(b.x)&&[440,580,720].includes(b.z);
      const push=(p,s,color,role)=>{wallRoles.push({buildingIndex:index,role});wallPieces.push({p,s,color});};
      if(!selected){push([b.x,b.height/2,b.z],[b.w,b.height,b.d],districtWallColor(b,index),'body');continue;}
      const family=(Math.floor((b.z+1000)/560)+(b.x>=430?1:0))%2;
      const highest=Math.min(8,1+Math.floor((b.height-.5-(family?1.65:1.9)/2-4.9)/3.25));
      const top=highest<2?6.6:3.15+(highest-1)*3.25;
      const colors=b.z===580?(b.x===355?[0x8b9c8e,0xc0ccbe,0xd4d9c8]:[0x9d8c7c,0xc9ac99,0xd9c6b4]):[0x8b9c8e,b.x===355?0xe3dcca:0xd8d8c7,b.x===355?0xe9e2d1:0xe0dfce];
      const cuts=[0,3.2,top,b.height];for(let i=0;i<3;i++)push([b.x,(cuts[i]+cuts[i+1])/2,b.z],[b.w,cuts[i+1]-cuts[i],b.d],colors[i],'body');
      const side=b.x<430?1:-1,face=b.x+side*b.w/2,z=b.z+b.d/2,y=(4.05+b.height-.34)/2,h=b.height-4.39;
      push([face+side*.07,y,z-.3],[.14,h,.6],colors[0],'pier');
      push([face-side*.3,y,z+.07],[.6,h,.14],colors[0],'pier');
      signatureHouses.push({buildingIndex:index,base:3.2,top,colors});
    }
    const houseWalls=batch('coast-original-shop-houses',box,material(0xffffff,{map:plasterTexture,roughness:.95}),wallPieces,{castShadow:true,receiveShadow:true});
    houseWalls.userData.coastWallPieces=wallRoles;group.userData.coastSignatureHouses=signatureHouses;
    batch('coast-roof-terraces',box,material(0xa39f8d),buildings.map(b=>({p:[b.x,b.height+.04,b.z],s:[b.w,.08,b.d]})),{receiveShadow:true});
    const hero=buildings.filter(b=>b.x===-5&&[440,580,720].includes(b.z));
    const cream=material(0xe5dfcf,{roughness:.9}),metal=material(0x425b5b,{roughness:.55,metalness:.32});
    const dark=material(0x24434f,{roughness:.45,metalness:.08,side:THREE.DoubleSide}),wood=material(0x987754,{roughness:.91});
    const trims=[],glazing=[],railings=[],awnings=[],timber=[],pavement=[],planters=[],greenery=[],contact=[],signPixels=[];
    const roofParapetPositions=[],roofParapetIndices=[];
    function parapetQuad(a,b,c,d,outward){
      const normal=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).cross(new THREE.Vector3(...c).sub(new THREE.Vector3(...a)));
      if(normal.dot(new THREE.Vector3(...outward))<0)[b,d]=[d,b];
      const i=roofParapetPositions.length/3;roofParapetPositions.push(...a,...b,...c,...d);roofParapetIndices.push(i,i+1,i+2,i,i+2,i+3);
    }
    for(const b of buildings){
      for(const y of [3.4,b.height-.18])trims.push({p:[b.x,y,b.z],s:[b.w+.5,.26,b.d+.5]});
      const corners=[[-1,-1],[1,-1],[1,1],[-1,1]],outer=corners.map(([x,z])=>[b.x+x*b.w/2,b.z+z*b.d/2]),inner=corners.map(([x,z])=>[b.x+x*(b.w/2-.28),b.z+z*(b.d/2-.28)]);
      const point=(v,top)=>[v[0],b.height+(top?.64:0),v[1]];
      for(let i=0;i<4;i++){
        const j=(i+1)%4,out=[(outer[i][0]+outer[j][0])/2-b.x,0,(outer[i][1]+outer[j][1])/2-b.z];
        parapetQuad(point(outer[i],false),point(outer[j],false),point(outer[j],true),point(outer[i],true),out);
        parapetQuad(point(inner[i],false),point(inner[j],false),point(inner[j],true),point(inner[i],true),out.map(v=>-v));
        parapetQuad(point(outer[i],true),point(outer[j],true),point(inner[j],true),point(inner[i],true),[0,1,0]);
        parapetQuad(point(outer[i],false),point(outer[j],false),point(inner[j],false),point(inner[i],false),[0,-1,0]);
      }
    }
    const roofParapetGeometry=own(new THREE.BufferGeometry());roofParapetGeometry.setAttribute('position',new THREE.Float32BufferAttribute(roofParapetPositions,3));roofParapetGeometry.setIndex(roofParapetIndices);roofParapetGeometry.computeVertexNormals();
    const roofParapets=new THREE.Mesh(roofParapetGeometry,cream);roofParapets.name='coast-continuous-roof-parapets';roofParapets.castShadow=true;roofParapets.receiveShadow=true;roofParapets.userData.coastArt={visualOnly:true,flat:false};group.add(roofParapets);
    const signGlyphs={
      B:['11110','10001','10001','11110','10001','10001','11110'],H:['10001','10001','10001','11111','10001','10001','10001'],
      '<':['00001','00010','00100','01000','00100','00010','00001'],P:['11110','10001','10001','11110','10000','10000','10000'],A:['01110','10001','10001','11111','10001','10001','10001'],
      L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],
      C:['01111','10000','10000','10000','10000','10000','01111'],F:['11111','10000','10000','11110','10000','10000','10000'],
      E:['11111','10000','10000','11110','10000','10000','11111'],S:['01111','10000','10000','01110','00001','00001','11110'],
      I:['11111','00100','00100','00100','00100','00100','11111'],O:['01110','10001','10001','10001','10001','10001','01110'],
      T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],R:['11110','10001','10001','11110','10100','10010','10001']
    };
    Object.assign(signGlyphs,{
      N:['10001','11001','11001','10101','10011','10011','10001'],D:['11110','10001','10001','10001','10001','10001','11110'],
      V:['10001','10001','10001','10001','10001','01010','00100'],G:['01111','10000','10000','10111','10001','10001','01110'],
      W:['10001','10001','10001','10101','10101','11011','10001'],'>':['10000','01000','00100','00010','00100','01000','10000']
    });
    function sign(text,x,y,z,target=signPixels,pixel=.046,direction=1){
      const width=(text.length*6-1)*pixel,cells=[];
      [...text].forEach((letter,k)=>signGlyphs[letter].forEach((row,iy)=>[...row].forEach((bit,ix)=>{
        if(bit==='1')cells.push({x:k*6+ix+.5,z:3-iy,w:1,d:1});
      })));
      for(const r of unionRectangles(cells))target.push({p:[x,y+(r.minZ+r.maxZ)*pixel/2,z+direction*(-width/2+(r.minX+r.maxX)*pixel/2)],s:[1,(r.maxZ-r.minZ)*pixel,(r.maxX-r.minX)*pixel]});
    }
    const routeSigns=[],routeBoards=[],routePosts=[],routeLetters=[];
    const signSpecs=[{id:0,s:180,text:'MOUNTAIN',color:0x355e53},{id:0,s:590,text:'GROUND>',color:0x355e53},{id:0,s:1350,text:'<PIER',color:0x355f78},
      {id:0,s:1530,text:'CLIMB',color:0x8e7038},{id:0,s:2570,text:'BENDS',color:0x8e7038},{id:0,s:3100,text:'VIADUCT',color:0x355f78},
      {id:0,s:3400,text:'DOWNHILL',color:0x8e7038},{id:0,s:5010,text:'COAST',color:0x355e53},{id:1,s:110,text:'BENDS',color:0x8e7038},
      {id:1,s:600,text:'GROUND',color:0x355e53},{id:1,s:980,text:'UNDERPASS',color:0x355f78}];
    for(const spec of signSpecs){
      const p=pose(spec.id,spec.s),offset=p.bridge?p.halfWidth-.15:Math.max(10,p.halfWidth+1.5),x=p.x-p.dz*offset,z=p.z+p.dx*offset;
      const floor=p.bridge?p.y:network.querySupport({x,z,y:p.y+.1}).height,y=Number.isFinite(floor)?floor:p.y,angle=Math.atan2(p.dz,-p.dx),cos=Math.cos(angle),sin=Math.sin(angle);
      routePosts.push({p:[x,y+1.3,z],s:[.13,2.6,.13]});routeBoards.push({p:[x,y+3.6,z],s:[.16,2.3,6.3],r:[0,angle,0],color:spec.color});
      const letterStart=routeLetters.length,letters=[];sign(spec.text,.10,3.6,0,letters,.11,-1);
      for(const v of letters)routeLetters.push({...v,p:[x+cos*v.p[0]+sin*v.p[2],y+v.p[1],z-sin*v.p[0]+cos*v.p[2]],r:[0,angle,0]});
      routeSigns.push({...spec,x,y,z,bridge:p.bridge,letterStart,letterCount:routeLetters.length-letterStart});
    }
    batch('coast-route-sign-posts',box,metal,routePosts,{receiveShadow:true});
    batch('coast-route-sign-boards',box,material(0xffffff,{roughness:.94}),routeBoards,{receiveShadow:true});
    batch('coast-route-sign-lettering',windowPlane,material(0xeee9d4,{roughness:.95}),routeLetters);
    group.userData.coastRouteSigns=routeSigns;
    for(const [hi,b] of hero.entries()){
      const front=b.minX-.055,bays=hi===1?4:3,bayWidth=(b.d-3.4)/bays;
      const floors=Math.max(2,1+Math.floor((b.height-3.4)/3.25));
      for(let level=0;level<floors;level++)for(let bay=0;bay<bays;bay++){
        const z=b.z-b.d/2+1.7+bayWidth*(bay+.5),y=level===0?1.65:4.9+(level-1)*3.25;
        if(y+1.2>b.height-.5)continue;
        const w=level===0?Math.min(5.2,bayWidth-1.3):2.15,h=level===0?2.65:1.85;
        glazing.push({p:[front,y,z],s:[.075,h,w],outward:-1});

        contact.push({p:[front-.012,y,z],s:[.025,h+.55,w+.58]});
        if(level===0){
          awnings.push({p:[front-1.05,3.15,z],s:[2.05,.16,w+.8],r:[0,0,-.08],color:hi===1?0x7b9e92:0xb99775});
          timber.push({p:[front-.18,.18,z],s:[.45,.36,w+.55]});
          const doorZ=z-w/2+.82;
          trims.push({p:[front-.17,1.28,doorZ-.57],s:[.25,2.42,.10]},{p:[front-.17,1.28,doorZ+.57],s:[.25,2.42,.10]},
            {p:[front-.17,2.53,doorZ],s:[.25,.10,1.24]});
          railings.push({p:[front-.25,1.18,doorZ+.36],s:[.07,.37,.045]});
          timber.push({p:[front-.27,.055,doorZ],s:[.5,.10,1.28]});
          awnings.push({p:[front-2.03,3.03,z],s:[.12,.25,w+.8],color:hi===1?0x7b9e92:0xb99775});
          awnings.push({p:[front-.21,3.66,z],s:[.25,.52,w+.58],color:hi===1?0x668b80:0x8e806b});
          sign(['PALM','CAFE','SURF'][(hi+bay)%3],front-.35,3.67,z);
          if((hi===0&&bay===1)||(hi===2&&bay===0)){
            const tx=front-6.2;
            timber.push({p:[tx,.78,z],s:[1.25,.11,1.25]});railings.push({p:[tx,.38,z],s:[.12,.76,.12]});
            for(const dz of [-1.05,1.05]){
              timber.push({p:[tx,.43,z+dz],s:[.54,.09,.5]},{p:[tx,.76,z+dz+Math.sign(dz)*.22],s:[.54,.54,.07]});
              for(const dx of [-.19,.19])for(const k of [-.17,.17])railings.push({p:[tx+dx,.21,z+dz+k],s:[.045,.42,.045]});
            }
          }
        }else if((bay+hi)%2===0){
          trims.push({p:[front-.65,y-h/2-.16,z],s:[1.4,.18,w+.5]});
          railings.push({p:[front-1.22,y-h/2+.75,z],s:[.075,.075,w+.42]});
          for(let k=0;k<=5;k++)railings.push({p:[front-1.22,y-h/2+.34,z-w/2+k*w/5],s:[.055,.78,.055]});
          for(const sign of [-1,1])railings.push({p:[front-.65,y-h/2+.75,z+sign*(w/2+.19)],s:[1.2,.075,.075]});
        }
      }
      const standardWindow=(x,y,z,w,h,side=1)=>{
        const face=side<0?b.minZ-.055:b.maxZ+.055;
        glazing.push({p:[x,y,face],s:[w,h,.075],outward:side,axis:'z'});

        trims.push({p:[x,y+h/2+.22,face+side*.48],s:[w+.58,.12,1.05]});
      };
      for(let level=0;level<floors;level++){
        const y=level===0?1.8:4.9+(level-1)*3.25;if(y+1.2>b.height-.5)continue;
        const count=Math.max(4,Math.floor((b.w-3)/4.25));
        for(let k=0;k<count;k++)for(const side of [-1,1])standardWindow(b.minX+2.1+(b.w-4.2)*(k+.5)/count,y,b.z,level===0?2.45:1.9,level===0?2.4:1.85,side);
        if(level===0)continue;
        for(let bay=0;bay<bays-1;bay++){
          const z=b.minZ+1.7+bayWidth*(bay+1),w=1.65,h=1.85;
          glazing.push({p:[front,y,z],s:[.075,h,w],outward:-1});
        }
        for(let k=0;k<Math.floor(b.d/4);k++){
          const z=b.minZ+2+(b.d-4)*(k+.5)/Math.floor(b.d/4),back=b.maxX+.055;
          glazing.push({p:[back,y,z],s:[.075,1.85,1.8],outward:1});
        }
      }
      trims.push({p:[b.minX+2.3,b.height+1.05,b.minZ+2.3],s:[4.8,2.1,4.8]});
      trims.push({p:[b.minX+2.3,b.height+2.21,b.minZ+2.3],s:[5.3,.22,5.3]});
      dark.color.setHex(0x294651);
      for(const side of [-1,1]){
        glazing.push({p:[b.minX+2.3,b.height+1.14,b.minZ+2.3+side*2.405],s:[3.6,.68,.035]});
        glazing.push({p:[b.minX+2.3+side*2.405,b.height+1.14,b.minZ+2.3],s:[.035,.68,3.6]});
      }
      for(let k=0;k<3;k++)trims.push({p:[front-.15,b.height*.64,b.minZ+.9+k*.55],s:[.32,b.height*.49,.18]});
      const plazaMin=-45,plazaMax=b.minX-.5,cx=(plazaMin+plazaMax)/2;
      pavement.push({p:[cx,-.005,b.z],s:[plazaMax-plazaMin,.07,b.d+17]});
      for(const sign of [-1,1]){
        const z=b.z+sign*(b.d/2+6.4);
        planters.push({p:[cx,.31,z],s:[(plazaMax-plazaMin)*.67,.6,1.4]});
        greenery.push({p:[cx,.83,z],s:[(plazaMax-plazaMin)*.64,.55,1.1]});
        timber.push({p:[-44,.52,z-sign*2.1],s:[.65,.15,4.1]});
        for(const dz of [-1.55,1.55])railings.push({p:[-44,.24,z-sign*2.1+dz],s:[.5,.48,.12]});
      }
      const roofX=b.x+b.w*.12,roofZ=b.z+b.d*.12;
      for(const sx of [-1,1])for(const sz of [-1,1])timber.push({p:[roofX+sx*3.7,b.height+1.25,roofZ+sz*3.1],s:[.18,2.5,.18]});
      for(let k=0;k<7;k++)timber.push({p:[roofX-4+k*1.34,b.height+2.6,roofZ],s:[.15,.18,6.8]});
    }
    function sashTexture(emission=false){
      const size=64,width=size*2,bytes=new Uint8Array(width*size*4);
      for(let y=0;y<size;y++)for(let x=0;x<width;x++){
        const localX=x%size,family=x>=size?1:0,inner=localX>=8&&localX<56&&y>=8&&y<56,mullion=family?(y>=44&&y<=45):(localX>=31&&localX<=32),glass=inner&&!mullion;
        const tint=glass?[39+Math.floor(y/20),64+Math.floor(y/14),74+Math.floor(y/10)]:inner?[194,194,177]:localX<5||localX>58||y<5||y>58?[219,215,197]:[55,72,72];
        const color=emission?(glass?[255,245,224]:[0,0,0]):tint,i=(y*width+x)*4;
        for(let c=0;c<3;c++)bytes[i+c]=color[c];bytes[i+3]=255;
      }
      const texture=new THREE.DataTexture(bytes,width,size,THREE.RGBAFormat);texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;textures.add(texture);return texture;
    }
    const sashMap=sashTexture(),sashEmission=sashTexture(true);
    const sashPlanes=[0,1].map(family=>{const geo=own(windowPlane.clone()),uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,(uv.getX(i)+family)/2);return geo;});
    const facadeWindowMaterial=material(0xffffff,{map:sashMap,roughness:.7,metalness:.04});
    const facadeLitMaterial=material(0xffffff,{map:sashMap,emissiveMap:sashEmission,emissive:0xa17e4f,emissiveIntensity:.42,roughness:.7,metalness:.04});
    const districtWindows=[[],[]],districtLitWindows=[[],[]],facadeFamilies=[],cornerCourts=[],facadeRecords=[],districtPaths=[],districtEntryMeta=[],districtBalconies=[],curvedParapets=[],districtPlinths=[],cornerStorePanels=[],cornerStores=[];
    function facePose(b,axis,side,along,y,w,h){
      return {p:axis==='x'?[b.x+side*(b.w/2+.065),y,along]:[along,y,b.z+side*(b.d/2+.065)],s:[1,h,w],r:[0,axis==='z'?-side*Math.PI/2:side<0?Math.PI:0,0],axis,side,w,h};
    }
    for(const [bi,b] of buildings.entries()){
      if(hero.includes(b))continue;
      const facadeFamily=(Math.floor((b.z+1000)/560)+(b.x>=430?1:0))%2;facadeFamilies.push({buildingIndex:bi,family:facadeFamily});
      const cornerStore=[355,485].includes(b.x)&&[440,580].includes(b.z),storeSide=b.x<430?1:-1;
      const storeAlong=b.z+b.d/2-6.2,storeEndAlong=b.x+storeSide*(b.w/2-6.2);
      const entries=[];
      for(const road of roads){
        const axis=road.d>road.w?'x':'z',along=axis==='x'?b.z:b.x,centre=axis==='x'?road.x:road.z,side=Math.sign(centre-(axis==='x'?b.x:b.z));
        const lo=axis==='x'?road.z-road.d/2:road.x-road.w/2,hi=axis==='x'?road.z+road.d/2:road.x+road.w/2;
        if(side&&along>=lo&&along<=hi)entries.push({axis,side,road,kind:'street',distance:Math.abs(centre-(axis==='x'?b.x:b.z))-(axis==='x'?(road.w+b.w)/2:(road.d+b.d)/2)});
      }
      let entry=entries.sort((a,b)=>a.distance-b.distance)[0];
      if(!entry){
        const nearest=roads.map(r=>{const x=Math.max(r.x-r.w/2,Math.min(r.x+r.w/2,b.x)),z=Math.max(r.z-r.d/2,Math.min(r.z+r.d/2,b.z));return {x,z,distance:(x-b.x)**2+(z-b.z)**2};}).sort((a,b)=>a.distance-b.distance)[0];
        const axis=Math.abs(nearest.x-b.x)>Math.abs(nearest.z-b.z)?'x':'z';entry={axis,side:Math.sign(axis==='x'?nearest.x-b.x:nearest.z-b.z)||-1,road:null,kind:'garden'};
      }
      const alongCenter=entry.axis==='x'?b.z:b.x,alongHalf=entry.axis==='x'?b.d/2:b.w/2,fromFace=(entry.axis==='x'?b.x:b.z)+entry.side*((entry.axis==='x'?b.w:b.d)/2+.065);
      const road=entry.road,roadCenter=road?(entry.axis==='x'?road.x:road.z):0,walkInner=road?(entry.axis==='x'?road.w/2+10:21):0,streetEnd=road?roadCenter-entry.side*walkInner:fromFace+entry.side*12;
      const offsets=[0,4,-4,8,-8,12,-12].filter(v=>Math.abs(v)<=alongHalf-2);
      const pathFree=(along,end)=>{const lo=Math.min(fromFace,end),hi=Math.max(fromFace,end),margin=1.65;return obstacles.every(other=>other===b||(entry.axis==='x'?other.maxX<=lo||other.minX>=hi||other.maxZ<=along-margin||other.minZ>=along+margin:other.maxZ<=lo||other.minZ>=hi||other.maxX<=along-margin||other.minX>=along+margin));};
      let selected=null;
      for(const offset of offsets){const along=alongCenter+offset;if(pathFree(along,streetEnd)){selected={along,end:streetEnd,linked:Boolean(road)};break;}}
      if(!selected)for(const offset of offsets){const along=alongCenter+offset,end=fromFace+entry.side*12;if(pathFree(along,end)){selected={along,end,linked:false};break;}}
      Object.assign(entry,selected||{along:alongCenter,end:fromFace,linked:false});
      const record={building:b,windows:[],entry};facadeRecords.push(record);
      for(const axis of ['x','z'])for(const side of [-1,1]){
        const length=axis==='x'?b.d:b.w,center=axis==='x'?b.z:b.x,baseBays=Math.max(4,Math.floor((length-2.4)/4.7));
        for(let level=0;level<9;level++){
          const y=level===0?1.55:4.9+(level-1)*3.25,h=level===0?2.35:facadeFamily?1.65:1.9,bays=level===0?baseBays:Math.max(4,Math.floor((length-2.4)/(facadeFamily?6.5:4.7)));
          if(y+h/2+.5>b.height)break;
          for(let bay=0;bay<bays;bay++){
            const along=center-length/2+1.2+(length-2.4)*(bay+.5)/bays,w=level===0?2.65:facadeFamily?2.7:1.75;
            if(level===0&&cornerStore&&((axis==='x'&&side===storeSide&&Math.abs(along-storeAlong)<6.1)||(axis==='z'&&side===1&&Math.abs(along-storeEndAlong)<6.1)))continue;
            if(level===0&&axis===entry.axis&&side===entry.side&&Math.abs(along-entry.along)<w/2+1.0)continue;
            if((b.x===-5||b.x===355||b.x===485)&&axis===entry.axis&&side===entry.side&&level>0&&level<=3&&bay===Math.floor(bays/2)){
              const floor=3.55+(level-1)*3.25,door=facePose(b,axis,side,along,floor+1.225,2.1,2.45),face=axis==='x'?b.x+side*b.w/2:b.z+side*b.d/2;
              glazing.push({p:door.p,s:axis==='x'?[.075,2.45,2.1]:[2.1,2.45,.075],axis,outward:side});
              const piece=(depth,across,py,d,ph,width)=>({p:axis==='x'?[face+side*depth,py,along+across]:[along+across,py,face+side*depth],s:axis==='x'?[d,ph,width]:[width,ph,d]});
              trims.push(piece(.78,0,floor-.09,1.4,.18,3.0));
              railings.push(piece(1.45,0,floor+.92,.045,.045,2.88),piece(1.45,0,floor+.37,.035,.035,2.88));
              for(const edge of [-1,1])railings.push(piece(.78,edge*1.42,floor+.92,1.38,.045,.045),piece(1.45,edge*1.42,floor+.47,.045,.94,.045));
              districtBalconies.push({buildingIndex:bi,axis,side,along,floor,width:3,projection:1.48,doorHeight:2.45});continue;
            }
            const pose=facePose(b,axis,side,along,y,w,h);record.windows.push(pose);
            const lit=(bi*11+level*7+bay*3+(axis==='x'?0:17)+(side===1?1:0))%7<2;
            (lit?districtLitWindows:districtWindows)[facadeFamily].push(pose);
          }
        }
      }
      if(cornerStore){
        const color=b.x<430?0x78958a:0xad8d72;
        for(const [axis,side,along] of [['x',storeSide,storeAlong],['z',1,storeEndAlong]]){
          const panel=facePose(b,axis,side,along,1.7,11.6,3.3);panel.p[axis==='x'?0:2]-=side*.045;panel.color=color;cornerStorePanels.push(panel);
          for(const offset of [-2.5,2.5]){const glass=facePose(b,axis,side,along+offset,1.6,4.1,2.55);glazing.push({p:glass.p,s:axis==='x'?[.075,2.55,4.1]:[4.1,2.55,.075],axis,outward:side});}
          const face=(axis==='x'?b.x:b.z)+side*((axis==='x'?b.w:b.d)/2+.7),edge=face+side*.65;
          awnings.push({p:axis==='x'?[face,3.07,along]:[along,3.07,face],s:axis==='x'?[1.45,.13,11.6]:[11.6,.13,1.45],color},
            {p:axis==='x'?[edge,2.93,along]:[along,2.93,edge],s:axis==='x'?[.08,.22,11.6]:[11.6,.22,.08],color});
          const fascia=(axis==='x'?b.x:b.z)+side*((axis==='x'?b.w:b.d)/2+.34);
          awnings.push({p:axis==='x'?[fascia,3.7,along]:[along,3.7,fascia],s:axis==='x'?[.12,.5,4]:[4,.5,.12],color});
          const text=b.x<430?'CAFE':'SURF',letters=[],signStart=signPixels.length;sign(text,0,3.7,0,letters,.06,axis==='x'?-side:side);
          for(const letter of letters)signPixels.push({...letter,p:axis==='x'?[panel.p[0]+side*.39,letter.p[1],along+letter.p[2]]:[along+letter.p[2],letter.p[1],panel.p[2]+side*.39],r:axis==='z'?[0,Math.PI/2,0]:[0,0,0]});
          cornerStores.push({buildingIndex:bi,axis,side,along,width:11.6,entranceUnchanged:true,signText:text,signStart,signCount:letters.length});
        }
      }
      const along=entry.along,door=facePose(b,entry.axis,entry.side,along,1.29,1.2,2.4);
      glazing.push({p:door.p,s:entry.axis==='x'?[.075,2.4,1.2]:[1.2,2.4,.075],axis:entry.axis,outward:entry.side});
      const front=door.p.slice(),threshold=door.p.slice(),handle=door.p.slice();front[entry.axis==='x'?0:2]+=entry.side*.45;front[1]=2.72;
      threshold[entry.axis==='x'?0:2]+=entry.side*.22;threshold[1]=.065;
      handle[entry.axis==='x'?0:2]+=entry.side*.16;handle[entry.axis==='x'?2:0]+=.38;handle[1]=1.18;
      if(bi%4===1){
        const color=b.x<430?0x78998b:0xb29a79;
        awnings.push({p:front,s:entry.axis==='x'?[1.45,.13,2.65]:[2.65,.13,1.45],color});
        const edge=front.slice();edge[entry.axis==='x'?0:2]+=entry.side*.7;edge[1]-=.13;
        awnings.push({p:edge,s:entry.axis==='x'?[.075,.25,2.65]:[2.65,.25,.075],color});
      }else trims.push({p:front,s:entry.axis==='x'?[1,.16,2.15]:[2.15,.16,1]});
      const centre=entry.axis==='x'?b.z:b.x,half=entry.axis==='x'?b.d/2:b.w/2;
      for(const [lo,hi] of [[centre-half+.15,entry.along-.88],[entry.along+.88,centre+half-.15]])if(hi>lo){
        const face=(entry.axis==='x'?b.x:b.z)+entry.side*((entry.axis==='x'?b.w:b.d)/2+.025);
        districtPlinths.push(facePose(b,entry.axis,entry.side,(lo+hi)/2,.18,hi-lo,.36));
      }
      timber.push({p:threshold,s:entry.axis==='x'?[.65,.13,1.45]:[1.45,.13,.65]});
      railings.push({p:handle,s:entry.axis==='x'?[.055,.33,.055]:[.055,.33,.055]});
      const from=door.p[entry.axis==='x'?0:2],alongValue=entry.along,end=entry.end,linked=entry.linked;
      const length=Math.abs(end-from),pathCenter=(from+end)/2;
      if(length>.1)districtPaths.push({p:entry.axis==='x'?[pathCenter,-.005,alongValue]:[alongValue,-.005,pathCenter],s:entry.axis==='x'?[length,.07,2.6]:[2.6,.07,length]});
      districtEntryMeta.push({buildingIndex:bi,axis:entry.axis,side:entry.side,kind:entry.kind,roadIndex:entry.road?roads.indexOf(entry.road):-1,linkedToSidewalk:linked,door:door.p.slice(),pathEnd:end});
      const family=bi%6;
      if(family===0){
        const pose=facePose(b,entry.axis,entry.side,entry.axis==='x'?b.z:b.x,b.height+.64,Math.min(13,(entry.axis==='x'?b.d:b.w)*.4),1.6);
        pose.p[entry.axis==='x'?0:2]-=entry.side*.205;pose.s[0]=.24;curvedParapets.push(pose);
      }else if(family===1){
        for(const dx of [-3.5,3.5])for(const dz of [-3.1,3.1])timber.push({p:[b.x+dx,b.height+.8,b.z+dz],s:[.13,1.6,.13]});
        for(let k=0;k<7;k++)timber.push({p:[b.x-3.8+k*1.27,b.height+1.68,b.z],s:[.14,.16,7]});
      }else if(family===2){
        for(let k=0;k<3;k++)trims.push({p:[b.minX-.10,b.height*.65,b.minZ+.8+k*.5],s:[.24,b.height*.55,.15]});
      }else if(family===3){
        trims.push({p:[b.maxX-3,b.height+.72,b.maxZ-3],s:[4.4,1.44,4.4]},
          {p:[b.maxX-3,b.height+1.54,b.maxZ-3],s:[4.9,.2,4.9]});
      }else if(family===4){
        for(const side of [-1,1])trims.push({p:[b.x,3.58,b.z+side*(b.d/2+.3)],s:[b.w+.65,.18,1.0]});
      }else{
        const axis=entry.axis,face=(axis==='x'?b.x:b.z)+entry.side*((axis==='x'?b.w:b.d)/2-.14),along=axis==='x'?b.z:b.x;
        for(const [offset,width,height] of [[-3.5,3,.7],[0,4,1.25],[3.5,3,.7]])trims.push({p:axis==='x'?[face,b.height+.64+height/2,along+offset]:[along+offset,b.height+.64+height/2,face],s:axis==='x'?[.24,height,width]:[width,height,.24]});
      }
    }
    batch('coast-district-curved-parapets',curvedParapetGeometry(),cream,curvedParapets,{castShadow:true,receiveShadow:true,visualOnly:true});
    group.userData.coastBalconies=districtBalconies;
    group.userData.coastCornerStores=cornerStores;
    batch('coast-corner-store-ground-panels',windowPlane,material(0xffffff,{roughness:.95}),cornerStorePanels,{receiveShadow:true,visualOnly:true});
    batch('coast-district-ground-plinths',windowPlane,cream,districtPlinths,{receiveShadow:true,visualOnly:true});
    for(const r of cornerStores)if(r.axis==='z'){
      const b=buildings[r.buildingIndex],e=districtEntryMeta.find(e=>e.buildingIndex===r.buildingIndex);if(!e?.linkedToSidewalk||e.axis!=='x')continue;
      const face=b.x+e.side*b.w/2,outer=face+e.side*6,z0=e.door[2]-1.3,z1=b.maxZ+7;
      for(const rect of [{minX:Math.min(face,outer),maxX:Math.max(face,outer),minZ:z0,maxZ:z1},{minX:Math.min(r.along-r.width/2,outer),maxX:Math.max(r.along+r.width/2,outer),minZ:b.maxZ,maxZ:z1}]){
        cornerCourts.push({...rect,buildingIndex:r.buildingIndex});districtPaths.push({p:[(rect.minX+rect.maxX)/2,-.005,(rect.minZ+rect.maxZ)/2],s:[rect.maxX-rect.minX,.07,rect.maxZ-rect.minZ]});
      }
    }
    group.userData.coastCornerCourts=cornerCourts;
    const arrivalPaths=[{x:394,z:590,w:16,d:14},{x:394,z:583.5,w:2.6,d:7}];
    for(const r of arrivalPaths)districtPaths.push({p:[r.x,-.005,r.z],s:[r.w,.07,r.d]});
    group.userData.coastArrivalCourts={paths:arrivalPaths,branch:[394,580,394,590],pause:[466,605],trees:[[388,587],[399,594]]};
    flatBatch('coast-district-entry-paving',unionRectangles(districtPaths.map(v=>({x:v.p[0],z:v.p[2],w:v.s[0],d:v.s[2]}))).map(r=>({p:[(r.minX+r.maxX)/2,-.005,(r.minZ+r.maxZ)/2],s:[r.maxX-r.minX,.07,r.maxZ-r.minZ]})),material(0xbdb9a9,{map:paverTexture,roughness:.94}),2.4);
    group.userData.coastArtDistrict={windowCount:districtWindows.reduce((n,a)=>n+a.length,0)+districtLitWindows.reduce((n,a)=>n+a.length,0),entryCount:districtEntryMeta.length,entries:districtEntryMeta,families:facadeFamilies};
    groundMaterial.map=groundToneField();groundMaterial.needsUpdate=true;
    for(const family of [0,1])for(const [name,mat,items] of [['coast-district-window-sashes',facadeWindowMaterial,districtWindows],['coast-district-selected-lit-windows',facadeLitMaterial,districtLitWindows]]){
      const mesh=batch(name+(family?'-transom':''),sashPlanes[family],mat,items[family],{receiveShadow:true,visualOnly:true});mesh.userData.coastArt.facadeFamily=family;
    }
    const staticDetails=facadeRecords.flatMap(record=>record.windows.filter(pose=>pose.axis===record.entry.axis&&pose.side===record.entry.side&&pose.p[1]<2).map(pose=>{const p=pose.p.slice();p[pose.axis==='x'?0:2]+=pose.side*.14;return {p,s:[.28,pose.h*.75,pose.w*.75],r:[0,pose.axis==='z'?pose.side*Math.PI/2:pose.side>0?Math.PI:0,0]};}));
    const detailRings=batch('coast-district-near-window-reveals',revealGeometry,cream,staticDetails,{receiveShadow:true,visualOnly:true});detailRings.userData.coastArt.capacity=staticDetails.length;
    function updateDistrictDetails(){}
    pavement.push({p:[-43,-.005,580],s:[4,.07,330]});
    for(let i=0;i<hero.length-1;i++){
      const a=hero[i].maxZ+18,b=hero[i+1].minZ-18;
      for(const z of [a+8,b-8]){
        planters.push({p:[-35.6,.22,z],s:[1.6,.44,14]});greenery.push({p:[-35.6,.71,z],s:[1.3,.55,13.6]});
      }
    }
    const windowRings=[],mullions=[];
    for(const v of glazing){
      if(v.s[1]<1)continue;const axis=v.axis||'x',side=v.outward||-1,w=axis==='z'?v.s[0]:v.s[2],h=v.s[1],p=v.p.slice();
      p[axis==='z'?2:0]+=side*.13;windowRings.push({p,s:[.28,h,w],r:[0,axis==='z'?side*Math.PI/2:side>0?Math.PI:0,0]});
      if(w>1.9){const mp=v.p.slice();mp[axis==='z'?2:0]+=side*.15;mullions.push({p:mp,s:axis==='z'?[.065,h,.29]:[.29,h,.065]});}
    }
    batch('coast-architecture-limestone-trims',box,cream,[...trims,...mullions],{castShadow:true,receiveShadow:true,visualOnly:true});
    batch('coast-architecture-window-reveals',revealGeometry,cream,windowRings,{castShadow:true,receiveShadow:true,visualOnly:true});
    batch('coast-sample-shop-window-reveals',box,material(0x647574,{roughness:1}),contact,{visualOnly:true});
    batch('coast-sample-framed-glazing',windowPlane,dark,glazing.map(v=>v.s[0]>.2&&v.s[2]<.1?{...v,s:[.075,v.s[1],v.s[0]],r:[0,Math.PI/2,0]}:v),{receiveShadow:true,visualOnly:true});
    batch('coast-sample-balcony-metal',box,metal,railings,{castShadow:true,visualOnly:true});
    batch('coast-sample-shop-awnings',box,material(0xffffff,{roughness:.9}),awnings,{castShadow:true,receiveShadow:true,visualOnly:true});
    batch('coast-sample-storefront-lettering',windowPlane,material(0xe6dfc8,{roughness:.9,side:THREE.DoubleSide}),signPixels,{visualOnly:true});
    batch('coast-sample-timber-details',box,wood,timber,{castShadow:true,receiveShadow:true,visualOnly:true});
    flatBatch('coast-sample-parcel-paving',unionRectangles(pavement.map(v=>({x:v.p[0],z:v.p[2],w:v.s[0],d:v.s[2]}))).map(r=>({p:[(r.minX+r.maxX)/2,-.005,(r.minZ+r.maxZ)/2],s:[r.maxX-r.minX,.07,r.maxZ-r.minZ]})),material(0xbdb9a9,{map:paverTexture,roughness:.94}),2.4);
    const arrivalBorderStart=planters.length;
    for(const [x,z,w,d] of [[469.2,606.4,3.48,.08],[470.9,605.05,.08,2.62],[471.5,603.7,1.28,.08],[472.1,605.65,.08,3.82],[469.8,607.6,4.68,.08],[467.5,607,.08,1.12]])planters.push({p:[x,.12,z],s:[w,.18,d]});
    const beds=batch('coast-sample-planter-walls',box,material(0xb8b8a3,{roughness:.96}),planters,{receiveShadow:true,visualOnly:true});beds.userData.coastArrivalStart=arrivalBorderStart;
    const shrubClusters=[];
    for(const hedge of greenery){
      const alongX=hedge.s[0]>hedge.s[2],length=alongX?hedge.s[0]:hedge.s[2],width=alongX?hedge.s[2]:hedge.s[0],count=Math.max(2,Math.ceil(length/.85));
      for(let k=0;k<count;k++){
        const t=(k+.5)/count-.5,wobble=Math.sin(k*2.37+hedge.p[2])*.055,p=hedge.p.slice();p[alongX?0:2]+=t*length;p[1]+=wobble;
        const long=.52+.08*Math.sin(k*1.7),wide=width*.49;
        shrubClusters.push({p,s:alongX?[long,hedge.s[1]*(.54+wobble),wide]:[wide,hedge.s[1]*(.54+wobble),long],color:[0x71855e,0x617c54,0x829067][k%3]});
      }
    }
    function coastalShrubGeometry(){
      const positions=[],colors=[];const core=new THREE.IcosahedronGeometry(1,0),p=core.attributes.position;
      for(let i=0;i<p.count;i++){positions.push(p.getX(i)*.72,p.getY(i)*.55-.25,p.getZ(i)*.72);colors.push(.69,.78,.61);}core.dispose();
      for(let leaf=0;leaf<6;leaf++){
        const a=leaf*Math.PI/3+.18*Math.sin(leaf*2.1),ca=Math.cos(a),sa=Math.sin(a),height=.62+(leaf%2)*.3;
        const point=(r,y,w)=>[ca*r-sa*w,y,sa*r+ca*w],root=point(.17,-.48,0),left=point(.62,height-.15,-.24),tip=point(1.08,height+.05,0),right=point(.62,height-.15,.24),ridge=point(.62,height+.11,0);
        for(const triangle of [[root,left,ridge],[left,tip,ridge],[tip,right,ridge],[right,root,ridge]]){
          positions.push(...triangle.flat());for(let i=0;i<3;i++)colors.push(.92,.98,.79);
        }
      }
      const geo=own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();return geo;
    }
    const shrubGeometry=coastalShrubGeometry(),shrubMaterial=material(0xffffff,{vertexColors:true,side:THREE.DoubleSide,roughness:1});
    const arrivalShrubStart=shrubClusters.length;
    for(const [x,z] of [[471.5,604.3],[471.5,605.2],[471.5,606.1],[471.5,607],[468.1,607],[469,607],[469.9,607],[470.8,607]])shrubClusters.push({p:[x,.27,z],s:[.55,.36,.55],color:0x829067});
    const shrubs=batch('coast-sample-planter-shrubs',shrubGeometry,shrubMaterial,shrubClusters,{castShadow:true,receiveShadow:true,visualOnly:true});shrubs.userData.coastArrivalStart=arrivalShrubStart;
    const courtyard={x:90,z:365,width:48,depth:38},parkRects=[
      {x:90,z:347.3,w:48,d:2.6},{x:90,z:382.7,w:48,d:2.6},
      {x:67.3,z:365,w:2.6,d:32.8},{x:112.7,z:365,w:2.6,d:32.8},
      {x:10.5,z:365,w:111,d:2.6},{x:90,z:365,w:48,d:2.6},{x:90,z:365,w:2.6,d:38},{x:90,z:365,w:10,d:10}];
    const parkPaving=flatBatch('coast-neighbourhood-courtyard-walks',unionRectangles(parkRects).map(r=>({p:[(r.minX+r.maxX)/2,-.0747,(r.minZ+r.maxZ)/2],s:[r.maxX-r.minX,.07,r.maxZ-r.minZ]})),material(0xc1bcaa,{map:paverTexture,roughness:.96,polygonOffset:true,polygonOffsetFactor:-.5,polygonOffsetUnits:-1,depthWrite:false}),2.4);parkPaving.renderOrder=.75;
    const parkWood=[],treeStems=[],treeCrowns=[],up=new THREE.Vector3(0,1,0);
    for(const [x,z] of [[76,375],[105,378],[76,352]]){
      parkWood.push({p:[x,.48,z],s:[1.8,.12,.5]},{p:[x,.77,z-.24],s:[1.8,.55,.10]});
      for(const dx of [-.62,.62])parkWood.push({p:[x+dx,.23,z],s:[.12,.46,.5]});
    }
    for(const dx of [-2.6,2.6])for(const dz of [-1.9,1.9])parkWood.push({p:[76+dx,1.3,375+dz],s:[.15,2.6,.15]});
    for(const dz of [-1.9,1.9])parkWood.push({p:[76,2.62,375+dz],s:[5.7,.17,.15]});
    for(let k=0;k<5;k++)parkWood.push({p:[73.4+k*1.3,2.76,375],s:[.14,.15,4.4]});
    const arrivalWoodStart=parkWood.length;
    for(const [x,z,turn,width] of [[466.5,606.3,0,2.4],[469.3,605,1,2.4],[390,595.5,0,1.8],[399,585,0,1.8]]){
      const add=(dx,y,dz,s)=>parkWood.push({p:turn?[x+dz,y,z-dx]:[x+dx,y,z+dz],s:turn?[s[2],s[1],s[0]]:s});
      add(0,.48,0,[width,.12,.5]);add(0,.77,.24,[width,.55,.10]);
      for(const dx of [-.62,.62])add(dx,.23,0,[.12,.46,.5]);
    }
    parkWood.push({p:[469.8,.035,607],s:[4.6,.04,1.2]},{p:[471.5,.035,605.05],s:[1.2,.04,2.7]});
    const seats=batch('coast-courtyard-seating-and-open-pergola',box,wood,parkWood,{castShadow:true,receiveShadow:true,visualOnly:true});seats.userData.coastArrivalStart=arrivalWoodStart;
    function stem(a,b,width){
      const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),axis=end.clone().sub(start),q=new THREE.Quaternion().setFromUnitVectors(up,axis.clone().normalize()),euler=new THREE.Euler().setFromQuaternion(q);
      treeStems.push({p:start.add(end).multiplyScalar(.5).toArray(),s:[width,axis.length(),width],r:euler.toArray().slice(0,3)});
    }
    for(const [index,[x,z]] of [[76,355],[104,355],[104,375],...group.userData.coastArrivalCourts.trees].entries()){
      stem([x,0,z],[x+.1,2.1,z],.32);
      for(const [head,[dx,y,dz]] of [[-.9,3.2,-.3],[.8,3.7,-.4],[.2,3.3,1]].entries()){
        stem([x+.1,1.65,z],[x+dx,y,z+dz],.18);
        treeCrowns.push({p:[x+dx,y,z+dz],s:[1.4,.9,1.4],r:[0,index*.67+head*.5,0],color:index===1?0xb4bf98:0xc1c69d});
      }
    }
    const stems=batch('coast-courtyard-forked-tree-stems',own(new THREE.CylinderGeometry(.35,.5,1,5)),wood,treeStems,{castShadow:true,receiveShadow:true,visualOnly:true});stems.userData.coastArrivalStart=12;
    const crowns=batch('coast-courtyard-folded-tree-crowns',shrubGeometry,shrubMaterial,treeCrowns,{castShadow:true,receiveShadow:true,visualOnly:true});crowns.userData.coastArrivalStart=9;
    const basin=new THREE.Mesh(own(new THREE.CylinderGeometry(2.8,2.8,.38,24,1,true)),cream);basin.name='coast-courtyard-low-basin';basin.position.set(90,.19,365);basin.castShadow=true;basin.receiveShadow=true;basin.userData.coastArt={visualOnly:true};group.add(basin);
    const rim=new THREE.Mesh(own(new THREE.TorusGeometry(2.68,.18,5,24)),cream);rim.geometry.rotateX(-Math.PI/2);rim.name='coast-courtyard-basin-rim';rim.position.set(90,.4,365);rim.castShadow=true;rim.userData.coastArt={visualOnly:true};group.add(rim);
    const pool=new THREE.Mesh(own(new THREE.CircleGeometry(2.6,32)),material(0x5e9186,{normalMap:waterNormals,normalScale:new THREE.Vector2(.09,.09),roughness:.34,metalness:.04,envMapIntensity:.55}));pool.geometry.rotateX(-Math.PI/2);pool.name='coast-courtyard-still-water';pool.position.set(90,.34,365);pool.userData.coastArt={visualOnly:true};group.add(pool);
    group.userData.coastCourtyard={...courtyard,paths:parkRects,trees:[[76,355],[104,355],[104,375]],walkTopY:-.0397};
    const walks=[],curbs=[],crosswalks=[];
    for(const x of xs)for(const side of [-1,1]){
      const roadWidth=x===950?22:30,walkX=x+side*(roadWidth/2+5.5);
      for(let i=0;i<zs.length-1;i++){
        const a=zs[i]+22,b=zs[i+1]-22;
        walks.push({p:[walkX,-.005,(a+b)/2],s:[9,.07,b-a]});
        const curbSpans=x===-70&&side===-1?[[a,Math.min(b,-662)],[Math.max(a,-638),b]]:[[a,b]];
        for(const [start,end] of curbSpans)if(end>start)curbs.push({p:[x+side*(roadWidth/2+.7),.035,(start+end)/2],s:[.35,.14,end-start]});
      }
    }
    for(const z of zs)for(const side of [-1,1])for(let i=0;i<xs.length-1;i++){
      const a=xs[i]+22,b=xs[i+1]-22;
      walks.push({p:[(a+b)/2,-.005,z+side*16.5],s:[b-a,.07,9]});
      curbs.push({p:[(a+b)/2,.035,z+side*11.7],s:[b-a,.14,.35]});
    }
    for(const x of xs)for(const z of zs)for(const side of [-1,1])for(let k=0;k<7;k++){
      crosswalks.push({p:[x-9+k*3,.039,z+side*22],s:[1.35,.014,4]});
    }
    flatBatch('coast-street-sidewalks',walks,material(0xbcb8a8,{map:paverTexture,roughness:.93}),2.4);
    batch('coast-street-low-curbs',box,cream,curbs,{receiveShadow:true,visualOnly:true,flat:true});
    batch('coast-street-crosswalk-paint',paintPlane,material(0xd8d8c9,{roughness:.95}),crosswalks,{visualOnly:true,flat:true});
    function palmTrunkGeometry(){
      const pos=[],uv=[],idx=[],sides=6,rings=3;
      for(let j=0;j<=rings;j++)for(let k=0;k<=sides;k++){
        const t=j/rings,a=k/sides*Math.PI*2,r=.36-.14*t;
        pos.push(Math.cos(a)*r+.18*Math.sin(t*Math.PI*.7),t,Math.sin(a)*r+.1*Math.sin(t*Math.PI*1.4));uv.push(k/sides,t);
      }
      for(let j=0;j<rings;j++)for(let k=0;k<sides;k++){const a=j*(sides+1)+k,b=a+sides+1;idx.push(a,b,a+1,a+1,b,b+1);}
      for(const j of [0,rings]){const t=j/rings,center=pos.length/3;pos.push(.18*Math.sin(t*Math.PI*.7),t,.1*Math.sin(t*Math.PI*1.4));uv.push(.5,.5);
        for(let k=0;k<sides;k++){const a=j*(sides+1)+k;if(j===0)idx.push(center,a,a+1);else idx.push(center,a+1,a);}}
      const geo=own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return geo;
    }
    function palmCrownGeometry(fronds,segments,length,spread){
      const pos=[],colors=[],idx=[];
      for(let leaf=0;leaf<fronds;leaf++){
        const angle=leaf*Math.PI*2/fronds,ca=Math.cos(angle),sa=Math.sin(angle),start=pos.length/3,tier=leaf%2,L=length*(tier?.76:1)*(.9+.1*Math.sin(leaf*2.1));
        for(let j=0;j<=segments;j++){
          const t=j/segments,d=.16+L*t,y=tier?.95*Math.sin(t*Math.PI*.8)-.35*t*t:.48*Math.sin(t*Math.PI)-1.1*t*t;
          const width=spread*(tier?.9:1.05)*Math.sin(Math.PI*t)*((j===0||j===segments)?0:j%2===0?.4:1);
          for(const side of [-1,0,1]){
            const w=side*width;pos.push(ca*d-sa*w,y+(side===0?.075*Math.sin(Math.PI*t):0),sa*d+ca*w);
            const shade=side===0?new THREE.Color(0x708c5b):new THREE.Color(leaf%2?0x426c4e:0x527a51);shade.multiplyScalar(.9+.1*t);colors.push(shade.r,shade.g,shade.b);
          }
        }
        for(let j=0;j<segments;j++){const a=start+j*3,b=a+3;idx.push(a,b,a+1,a+1,b,b+1,a+1,b+1,a+2,a+2,b+1,b+2);}
      }
      const kept=[],av=new THREE.Vector3(),bv=new THREE.Vector3(),cv=new THREE.Vector3();
      for(let i=0;i<idx.length;i+=3){av.fromArray(pos,idx[i]*3);bv.fromArray(pos,idx[i+1]*3);cv.fromArray(pos,idx[i+2]*3);if(bv.sub(av).cross(cv.sub(av)).lengthSq()>1e-12)kept.push(idx[i],idx[i+1],idx[i+2]);}
      const geo=own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(kept);geo.computeVertexNormals();return geo;
    }
    batch('coast-palm-trunks',palmTrunkGeometry(),material(0x8e8066,{map:plasterTexture,roughness:.97}),palms.map(p=>({p:[p.x,0,p.z],s:[1,p.h,1]})),{castShadow:true,receiveShadow:true});
    const crownMaterial=material(0xffffff,{vertexColors:true,side:THREE.DoubleSide,roughness:.93});
    const palmRecords=palms.map((p,index)=>({p,index,variant:index%2,pose:{p:[p.x+.18*Math.sin(Math.PI*.7),p.h,p.z+.1*Math.sin(Math.PI*1.4)],s:[1,1,1],r:[0,(Math.floor(index/2)*.73)%(Math.PI*2),0],color:Math.floor(index/2)%3===0?0xe1e6ca:0xffffff}}));
    const palmFar=[],palmNear=[];
    for(let variant=0;variant<2;variant++){
      const records=palmRecords.filter(v=>v.variant===variant),geo=variant?palmCrownGeometry(8,4,3.3,.52):palmCrownGeometry(8,4,3.9,.48);
      const mesh=batch(variant?'coast-palm-fans-far-compact':'coast-palm-fans-far',geo,crownMaterial,records.map(v=>v.pose),{castShadow:true,receiveShadow:true,visualOnly:true});mesh.userData.coastArt.capacity=records.length;palmFar.push(mesh);
    }
    function updateCoastFoliage(){}
    const beachCream=[],beachMetal=[],beachTimber=[],beachBodies=[],beachRoofs=[],beachGlass=[],beachFrames=[],beachSigns=[],bulbs=[],shadeCaps=[];
    const parasols=[],parasolPoles=[],beachFabric=[];
    const beachEntryRects=[],beachEntryPlants=[];
    for(const [centreZ,spurZ] of [[600,620],[80,80],[-440,-440]]){
      beachEntryRects.push({x:(-145.2-246)/2,z:spurZ,w:100.8,d:2.4},{x:-243.25,z:centreZ,w:5.5,d:8.5});
      if(spurZ!==centreZ)beachEntryRects.push({x:-244.8,z:(centreZ+spurZ)/2,w:2.4,d:Math.abs(spurZ-centreZ)+2.4});
      const x=-239;
      beachTimber.push({p:[x,.48,centreZ-7],s:[.64,.12,2.25]},{p:[x+.25,.79,centreZ-7],s:[.10,.62,2.25]});
      for(const dz of [-.82,.82])beachMetal.push({p:[x,.23,centreZ-7+dz],s:[.54,.46,.09]});
      for(const [i,bx] of [-240,-239].entries()){
        beachBodies.push({p:[bx,.43,centreZ+7],s:[.55,.86,.55],color:i?0x6f8d81:0x8a9581});
        beachMetal.push({p:[bx,.90,centreZ+7],s:[.61,.08,.61]});
      }
      const showerZ=spurZ-4.2;
      beachMetal.push({p:[-152,1.18,showerZ],s:[.075,2.36,.075]},{p:[-152.26,2.34,showerZ],s:[.60,.075,.075]},{p:[-152.53,2.28,showerZ],s:[.18,.06,.18]});
      beachCream.push({p:[-152,.025,showerZ],s:[.60,.05,.60]});
      for(const dz of [-10,-6,6,10])beachEntryPlants.push({p:[-237.5,.24,centreZ+dz],s:[.75,.22,.9],color:0xb7bc8d});
    }
    const access=flatBatch('coast-beach-access-boardwalks',unionRectangles(beachEntryRects).map(r=>({p:[(r.minX+r.maxX)/2,-.0748,(r.minZ+r.maxZ)/2],s:[r.maxX-r.minX,.07,r.maxZ-r.minZ]})),material(0xb6a183,{map:deckTexture,roughness:.96,polygonOffset:true,polygonOffsetFactor:-.5,polygonOffsetUnits:-1,depthWrite:false}),2.4);access.renderOrder=.75;
    batch('coast-beach-entry-low-plants',shrubGeometry,shrubMaterial,beachEntryPlants,{receiveShadow:true,visualOnly:true});
    group.userData.coastBeachEntryRects=beachEntryRects;

    function pitchedRoofGeometry(){
      const pos=[-.5,0,-.5,.5,0,-.5,0,.5,-.5,-.5,0,.5,.5,0,.5,0,.5,.5];
      const idx=[0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4,0,1,4,0,4,3];
      const geo=own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);const flat=own(geo.toNonIndexed());flat.computeVertexNormals();return flat;
    }
    function umbrellaGeometry(){
      const positions=[],colors=[];
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4,b=(i+1)*Math.PI/4,c=new THREE.Color(i%2?0x789c8f:0xe5d9ba);
        positions.push(0,.55,0,Math.cos(b),0,Math.sin(b),Math.cos(a),0,Math.sin(a));
        for(let j=0;j<3;j++)colors.push(c.r,c.g,c.b);
      }
      const geo=own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();return geo;
    }
    for(const [site,centerZ] of [-920,-700,-440,-180,80,340,600,800,1000].entries()){
      for(let row=0;row<2;row++)for(let col=0;col<2;col++){
        const x=-254-row*12,z=centerZ+(col-.5)*9;
        parasols.push({p:[x,2.45,z],s:[2.15,1.15,2.15],r:[0,site*.37+col*.12,0]});
        parasolPoles.push({p:[x,1.54,z],s:[1,3.08,1]});
        for(const side of [-1,1]){
          const sx=x+side*1.8;
          beachTimber.push({p:[sx,.31,z+.25],s:[.09,.09,2.1]},{p:[sx+.64,.31,z+.25],s:[.09,.09,2.1]});
          beachFabric.push({p:[sx+.32,.35,z+.25],s:[.57,.02,1.95]});
          for(const dz of [-.6,.9])for(const dx of [0,.64])beachMetal.push({p:[sx+dx,.16,z+dz],s:[.06,.32,.06]});
          beachTimber.push({p:[sx+.32,.49,z-.62],s:[.68,.1,.6],r:[.38,0,0]});
        }
      }
    }
    for(const [site,z] of [790,220,-500].entries()){
      const x=-296;
      for(const dx of [-1.9,1.9])for(const dz of [-1.6,1.6])beachTimber.push({p:[x+dx,1.03,z+dz],s:[.22,2.06,.22]});
      beachTimber.push({p:[x-.6,2.1,z],s:[7.8,.22,5.8]});
      beachBodies.push({p:[x+.8,3.24,z],s:[4.8,2.08,4.4],color:site===1?0xc6c5af:0x9eb9aa});
      beachRoofs.push({p:[x+.8,4.31,z],s:[6.2,1.4,5.9]});
      const face=x-1.64;
      beachGlass.push({p:[face-.035,3.3,z],s:[1,1.12,3.2]});
      beachFrames.push({p:[face-.13,3.3,z],s:[.22,1.12,3.2]});
      for(const side of [-1,1]){
        beachMetal.push({p:[x-2.6,3.22,z+side*2.65],s:[3.7,.07,.07]});
        for(let i=0;i<5;i++)beachMetal.push({p:[x-4.3+i*.8,2.70,z+side*2.65],s:[.055,1.05,.055]});
      }
      for(let i=0;i<7;i++)beachTimber.push({p:[x-4.9-(6-i)*.42,.15+i*.285,z],s:[.52,.15,1.5]});
    }
    for(let z=-1020;z<=1020;z+=60){
      beachMetal.push({p:[-143,1.94,z],s:[.10,3.88,.10]},{p:[-142.67,3.87,z],s:[.73,.10,.10]});
      bulbs.push({p:[-142.31,3.8,z],s:[.20,.24,.20]});shadeCaps.push({p:[-142.31,4.04,z],s:[.47,.38,.47]});
      if((z+1020)%120===0&&Math.abs(z+5+650)>15){
        beachTimber.push({p:[-126,.48,z+5],s:[.64,.12,2.25]},{p:[-125.75,.79,z+5],s:[.10,.62,2.25]});
        for(const dz of [-.82,.82])beachMetal.push({p:[-126,.23,z+5+dz],s:[.54,.46,.09]});
      }
    }
    const gateX=-272;
    for(const side of [-1,1]){
      beachCream.push({p:[gateX,4,-650+side*19.2],s:[.65,8,.65]});
      beachBodies.push({p:[gateX-.02,2.2,-650+side*19.2],s:[.72,2.8,.72],color:0x75998b});
    }
    const gateCablePoints=Array.from({length:17},(_,i)=>{const z=-19.2+i*2.4;return new THREE.Vector3(gateX,6.4+1.6*(z/19.2)**2,-650+z);});
    const gateCable=new THREE.Mesh(own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(gateCablePoints),32,.035,4,false)),metal);gateCable.name='coast-pier-sign-suspension';gateCable.userData.coastArt={visualOnly:true,flat:false};group.add(gateCable);
    for(const side of [-1,1])beachMetal.push({p:[gateX,6.4,-650+side*2.6],s:[.04,.32,.04]});
    beachBodies.push({p:[gateX,5.7,-650],s:[.32,1.2,6.6],color:0x78998a});
    sign('PIER',gateX+.175,5.72,-650,beachSigns,.16,-1);
    sign('COAST',gateX-.175,5.72,-650,beachSigns,.16,1);
    for(const [i,x] of [-228,-194,-160].entries())for(const side of [-1,1]){
      const z=-650+side*18,front=z-side*2.12;
      beachBodies.push({p:[x,1.48,z],s:[5.2,2.92,4.2],color:i%2?0xb7c9b7:0xd6cbb5});
      beachRoofs.push({p:[x,2.98,z],s:[6.1,1.45,5.2]});
      beachTimber.push({p:[x,.09,z],s:[5.8,.16,4.8]});
      beachGlass.push({p:[x,1.65,front],s:[1,1.65,3.55],r:[0,side*Math.PI/2,0]});
      beachFrames.push({p:[x,1.65,front-side*.13],s:[.24,1.65,3.55],r:[0,-side*Math.PI/2,0]});
      beachCream.push({p:[x,2.7,front-side*.40],s:[4.2,.13,1.15]});
    }
    const streetShrubs=[];
    for(const side of [-1,1])for(let z=-810;z<=810;z+=45){
      if(zs.some(c=>Math.abs(c-z)<32)||Math.abs(z+650)<25)continue;
      const x=-70+side*18.5;
      beachCream.push({p:[x,.21,z],s:[1.85,.42,6.8]});
      for(let k=0;k<3;k++)streetShrubs.push({p:[x,.62,z-2+k*2],s:[.73,.42,1.05],color:[0x71855e,0x617c54,0x829067][k%3]});
      const poleZ=z+3.05,lampX=x+side*.95;
      beachMetal.push({p:[x,2.28,poleZ],s:[.10,4.56,.10]},{p:[x+side*.49,4.49,poleZ],s:[1.06,.10,.10]});
      bulbs.push({p:[lampX,4.42,poleZ],s:[.19,.22,.19]});shadeCaps.push({p:[lampX,4.64,poleZ],s:[.46,.34,.46]});
      beachBodies.push({p:[x,.26,poleZ],s:[.27,.52,.27],color:0x78998a});
    }
    for(const side of [-1,1])for(const z of [465,525,585,645,705,765]){
      const x=430+side*18.5,lampX=x+side*.95;
      beachMetal.push({p:[x,2.28,z],s:[.10,4.56,.10]},{p:[x+side*.49,4.49,z],s:[1.06,.10,.10]});
      bulbs.push({p:[lampX,4.42,z],s:[.19,.22,.19]});shadeCaps.push({p:[lampX,4.64,z],s:[.46,.34,.46]});
      beachBodies.push({p:[x,.26,z],s:[.27,.52,.27],color:0x78998a});
    }
    batch('coast-boulevard-low-planting',shrubGeometry,shrubMaterial,streetShrubs,{castShadow:true,receiveShadow:true,visualOnly:true});
    for(const z of [780,620,460]){
      const x=-51.5;
      beachMetal.push({p:[x,1.5,z],s:[.11,3,.11]});
      beachBodies.push({p:[x,3.1,z],s:[2.9,.85,.16],color:0x668c80});
      for(const face of [-1,1]){
        const letters=[];sign('<BEACH',0,3.1,0,letters,.07,-1);
        for(const v of letters)beachSigns.push({...v,p:[x-face*v.p[2],v.p[1],z+face*.095],r:[0,-face*Math.PI/2,0]});
      }
    }
    batch('coast-beach-chalk-structures',box,cream,beachCream,{castShadow:true,receiveShadow:true,visualOnly:true});
    batch('coast-beach-metal-furnishings',box,metal,beachMetal,{castShadow:true,receiveShadow:true,visualOnly:true});
    batch('coast-beach-timber-furnishings',box,wood,beachTimber,{castShadow:true,receiveShadow:true,visualOnly:true});
    batch('coast-beach-huts-and-kiosks',box,material(0xffffff,{roughness:.94}),beachBodies,{castShadow:true,receiveShadow:true,visualOnly:true});
    batch('coast-beach-pitched-roofs',pitchedRoofGeometry(),material(0xa58668,{roughness:.96}),beachRoofs,{castShadow:true,receiveShadow:true,visualOnly:true});
    batch('coast-beach-framed-glazing',windowPlane,dark,beachGlass,{visualOnly:true});
    batch('coast-beach-window-reveals',revealGeometry,cream,beachFrames,{castShadow:true,receiveShadow:true,visualOnly:true});
    batch('coast-beach-gateway-lettering',windowPlane,material(0xe6dfc8,{roughness:.9,side:THREE.DoubleSide}),beachSigns,{visualOnly:true});
    batch('coast-beach-parasols',umbrellaGeometry(),material(0xffffff,{vertexColors:true,roughness:.96,side:THREE.DoubleSide}),parasols,{castShadow:true,receiveShadow:true,visualOnly:true});
    batch('coast-beach-parasol-poles',own(new THREE.CylinderGeometry(.04,.04,1,6)),metal,parasolPoles,{castShadow:true,visualOnly:true});
    batch('coast-beach-chaise-canvas',paintPlane,material(0xc4c8b1,{roughness:.98,side:THREE.DoubleSide}),beachFabric,{receiveShadow:true,visualOnly:true});
    const hillVolumes=[],hillWindows=[];
    for(const [i,b] of hillsideBuildings.entries()){
      hillVolumes.push({p:[b.x,(b.minY+b.baseY)/2,b.z],s:[b.w+.3,b.baseY-b.minY,b.d+.3],color:0x7f887d},
        {p:[b.x,b.baseY+b.wallHeight/2,b.z],s:[b.w,b.wallHeight,b.d],color:[0xc9d2c9,0xc4baa8,0xaebab9][i%3]},
        {p:[b.x,b.height-.15,b.z],s:[b.w+.4,.3,b.d+.4],color:0x82958d},
        {p:[b.x,b.baseY+1.2,b.minZ-.04],s:[1.5,2.4,.08],color:0x405652});
      for(let y=b.baseY+2.1;y<b.height-1;y+=3)for(const side of[-1,1])for(const offset of[-4,0,4]){
        hillWindows.push(facePose(b,'z',side,b.x+offset,y,1.8,1.5),facePose(b,'x',side,b.z+offset,y,1.8,1.5));
      }
    }
    batch('coast-hillside-volumes',box,material(0xffffff,{roughness:.94}),hillVolumes,{castShadow:true,receiveShadow:true});
    batch('coast-hillside-windows',windowPlane,facadeWindowMaterial,hillWindows,{visualOnly:true});
    const lampMaterial=material(0xe8d9b6,{emissive:0xffd59c,emissiveIntensity:.6,roughness:.55});
    batch('coast-promenade-lamp-globes',own(new THREE.IcosahedronGeometry(1,0)),lampMaterial,bulbs,{visualOnly:true});
    batch('coast-promenade-lamp-shades',own(new THREE.ConeGeometry(1,1,8,1,true)),cream,shadeCaps,{castShadow:true,visualOnly:true});
    slab('coast-pier-boardwalk',-530,-650,560,36,0x94734f,-.04,.12,{map:deckTexture,roughness:.94});
    batch('coast-pier-rails',box,material(0xc0b18e),[-668,-632].flatMap(z=>[{p:[-530,.8,z],s:[560,.15,.15]},...Array.from({length:29},(_,i)=>({p:[-810+i*20,.4,z],s:[.15,.8,.15]}))]));
    batch('coast-pier-piles',box,material(0x675b4b),Array.from({length:15},(_,i)=>[-660,-640].map(z=>({p:[-800+i*38,-1.8,z],s:[1.1,3.6,1.1]}))).flat());
    slab('coast-court',-195,540,45,70,0x446c6b,-.015,.10);
    batch('coast-court-lines',paintPlane,material(0xd8d2b7),[{p:[-195,.05,540],s:[.16,.02,66]},...[-32,32].map(z=>({p:[-195,.05,540+z],s:[42,.02,.16]})),...[-21,21].map(x=>({p:[-195+x,.05,540],s:[.16,.02,66]}))]);
    const skate=new THREE.Mesh(own(new THREE.RingGeometry(10,16,32)),material(0x999a8c));skate.rotation.x=-Math.PI/2;skate.position.set(-220,.07,220);group.add(skate);
    slab('coast-skate-basin',-220,220,20,20,0x515e65,-.005,.02);
    const wheel=new THREE.Group();wheel.position.set(-650,30,-650);wheel.rotation.y=Math.PI/2;wheel.name='coast-original-ferris-wheel';group.add(wheel);
    const rotor=new THREE.Group();wheel.add(rotor);const ferrisMat=material(0xd1b58d),rimGeo=own(new THREE.TorusGeometry(28,.28,5,64));
    for(const z of [-1.4,1.4]){const rim=new THREE.Mesh(rimGeo,ferrisMat);rim.position.z=z;rotor.add(rim);}
    const spokes=new THREE.InstancedMesh(box,ferrisMat,24);instances.add(spokes);const dummy=new THREE.Object3D();
    for(let i=0;i<24;i++){const a=i*Math.PI/12;dummy.position.set(Math.cos(a)*14,Math.sin(a)*14,0);dummy.scale.set(28,.15,.15);dummy.rotation.set(0,0,a);dummy.updateMatrix();spokes.setMatrixAt(i,dummy.matrix);}rotor.add(spokes);
    const cabins=new THREE.InstancedMesh(box,material(0xffffff),16),cabinDummy=new THREE.Object3D(),cabinAnchors=[];
    instances.add(cabins);cabins.name='coast-wheel-cabins';cabins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);rotor.add(cabins);
    for(let i=0;i<16;i++){const a=i*Math.PI/8;cabinAnchors.push({x:Math.cos(a)*28,y:Math.sin(a)*28});cabinDummy.position.set(cabinAnchors[i].x,cabinAnchors[i].y,0);cabinDummy.scale.set(2.6,2.8,3.8);cabinDummy.updateMatrix();cabins.setMatrixAt(i,cabinDummy.matrix);cabins.setColorAt(i,new THREE.Color(palette[i%palette.length]));}
    cabins.instanceMatrix.needsUpdate=true;cabins.instanceColor.needsUpdate=true;
    batch('coast-wheel-supports',box,ferrisMat,[{p:[-650,14,-655],s:[1.4,30,1.4],r:[.18,0,0]},{p:[-650,14,-645],s:[1.4,30,1.4],r:[-.18,0,0]}]);
    const hemi=new THREE.HemisphereLight(0x9bb5c5,0x655d4c,.46);lights.add(hemi);hemi.name='coast-hemisphere-light';group.add(hemi);
    const sun=new THREE.DirectionalLight(0xb2cbd5,.92);lights.add(sun);sun.name='coast-key-light';sun.castShadow=true;
    sun.target.name='coast-shadow-target';group.add(sun,sun.target);
    sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-80;sun.shadow.camera.right=80;sun.shadow.camera.top=80;sun.shadow.camera.bottom=-80;
    sun.shadow.camera.near=1;sun.shadow.camera.far=260;sun.shadow.bias=-.00012;sun.shadow.normalBias=.02;sun.shadow.camera.updateProjectionMatrix();
    const skyFaces=Array.from({length:6},()=>{
      const face=new THREE.DataTexture(new Uint8Array(32*32*4),32,32,THREE.RGBAFormat);face.userData={coastCubePayload:true};textures.add(face);return face;
    });
    const skyTexture=new THREE.CubeTexture(skyFaces);textures.add(skyTexture);skyTexture.format=THREE.RGBAFormat;
    skyTexture.generateMipmaps=true;skyTexture.minFilter=THREE.LinearMipmapLinearFilter;skyTexture.magFilter=THREE.LinearFilter;
    const bridge=scene.userData?.coastArtBridge;
    const savedLights=[...new Set(bridge?.sharedLights||[])].filter(light=>light?.isLight).map(light=>({light,visible:light.visible}));
    Object.assign(owner,{waterNormals,waterMaterial,waterPhaseX:0,waterPhaseZ:0,roadMat,lampMaterial,facadeLitMaterial,detailRings,updateDetails:updateDistrictDetails,palmNear,palmFar,updateFoliage:updateCoastFoliage,rotor,cabins,cabinDummy,cabinAnchors,angle:0,hemi,sun,skyTexture,bridge,
      background:new THREE.Color(0x0d1c29),fog:new THREE.FogExp2(0x263f4b,.00055),focus:{x:spec.spawn.x,z:spec.spawn.z},sunOffset:[-55,90,48],
      previousScene:{background:scene.background,fog:scene.fog,environment:scene.environment,lights:savedLights}});
    for(const saved of savedLights)saved.light.visible=false;
    scene.background=owner.background;scene.fog=owner.fog;scene.environment=skyTexture;applyCoastWeather(owner);
    scene.add(group);active=owner;builds++;return group;
    } catch(error){restoreSceneState(owner);disposeResources(owner);failedBuilds++;throw error;}
  }
  function leave(){
    junctionTraffic.reset();
    if(!active)return;const owner=active;active=null;
    restoreSceneState(owner);disposeResources(owner);disposals++;
  }
  function tick(dt){
    if(!active)return;followCoastFocus(active);const safeDt=Number.isFinite(dt)?Math.max(0,Math.min(.05,dt)):0;active.angle=(active.angle+safeDt*.045)%(Math.PI*2);active.rotor.rotation.z=active.angle;
    active.waterPhaseX=(active.waterPhaseX+safeDt*.00085)%1;active.waterPhaseZ=(active.waterPhaseZ+safeDt*.00062)%1;active.waterNormals.offset.set(active.waterPhaseX,active.waterPhaseZ);
    const dummy=active.cabinDummy;dummy.rotation.z=-active.angle;
    for(let i=0;i<16;i++){const p=active.cabinAnchors[i];dummy.position.set(p.x,p.y,0);dummy.updateMatrix();active.cabins.setMatrixAt(i,dummy.matrix);}
    active.cabins.instanceMatrix.needsUpdate=true;
  }
  function weather(preset){if(active)applyCoastWeather(active,preset);}
  function metrics(){
    let meshes=0,triangles=0,maximumTriangles=0,instances=0,shadowCasterBatches=0,shadowCasterTriangles=0,maximumShadowCasterTriangles=0;
    active?.group.traverse(o=>{if(o.isMesh){meshes++;const n=o.isInstancedMesh?o.count:1;instances+=n;const count=((o.geometry.index?.count??o.geometry.attributes.position.count)/3)*n;triangles+=count;maximumTriangles+=((o.geometry.index?.count??o.geometry.attributes.position.count)/3)*(o.isInstancedMesh?(o.userData.coastArt?.capacity??o.count):1);if(o.castShadow){shadowCasterBatches++;shadowCasterTriangles+=count;maximumShadowCasterTriangles+=((o.geometry.index?.count??o.geometry.attributes.position.count)/3)*(o.isInstancedMesh?(o.userData.coastArt?.capacity??o.count):1);}}});
    const buffers=new Set();let geometryBufferBytes=0,instanceBufferBytes=0;
    for(const geo of active?.geometries||[])for(const attribute of [...Object.values(geo.attributes),geo.index].filter(Boolean)){const array=attribute.isInterleavedBufferAttribute?attribute.data.array:attribute.array;if(!buffers.has(array)){buffers.add(array);geometryBufferBytes+=array.byteLength;}}
    for(const mesh of active?.instances||[])for(const attribute of [mesh.instanceMatrix,mesh.instanceColor].filter(Boolean))instanceBufferBytes+=attribute.array.byteLength;
    return {active:Boolean(active),builds,disposals,failedBuilds,cachedCpuPixelBytes:groundFieldCache?.pixels.byteLength||0,ownedLights:active?.lights.size||0,shadowMapResolution:active?1024:0,shadowSpanMetres:active?160:0,ownedGeometries:active?.geometries.size||0,ownedMaterials:active?.materials.size||0,ownedTextures:active?.textures.size||0,textureBytes:active?Math.ceil([...active.textures].reduce((sum,t)=>sum+(t.isCubeTexture?t.image.reduce((n,face)=>n+face.image.data.byteLength,0):t.userData?.coastCubePayload?0:t.image.data.byteLength)*(t.generateMipmaps?4/3:1),0)):0,ownedGeometryBufferBytes:geometryBufferBytes,ownedInstanceBufferBytes:instanceBufferBytes,staticMeshDraws:meshes,staticTriangles:triangles,maximumStaticTriangles:maximumTriangles,nearPalms:active?active.palmNear.reduce((n,m)=>n+m.count,0):0,farPalms:active?active.palmFar.reduce((n,m)=>n+m.count,0):0,foliageRefreshes:active?.foliageRefreshes||0,nearDetailInstances:active?.detailRings.count||0,nearDetailCapacity:active?active.detailRings.count:0,nearDetailMatrixBytes:active?.detailRings.instanceMatrix.array.byteLength||0,detailRefreshes:active?.detailRefreshes||0,shadowCasterBatches,shadowCasterTriangles,maximumShadowCasterTriangles,instances,buildings:roofBuildings.length,retainedCoastalBuildings:buildings.length,hillsideBuildings:hillsideBuildings.length,palms:palms.length,textureEstimateScope:'Owned sampled texture levels only; excludes shadow render target and driver allocations',performanceBoundary:'Static scene structure, not measured renderer draw calls or FPS'};
  }
  return Object.freeze({spec,artBudget,roads:Object.freeze(roads),nodes:Object.freeze(nodes),edges:Object.freeze(edges),routes:Object.freeze(routes),pose,onRoad,surface,support,network,
    layout:()=>({buildings,hillsideBuildings,palms,obstacles}),buildings:()=>active?obstacles:[],enter,leave,tick,weather,metrics,trafficJunctionStats:junctionTraffic.stats,createTraffic,stepTraffic,recoverTraffic,respawn,hit,sweptBox,clipBuildings,contactBounds,trafficContact});
})();
if(typeof window!=='undefined')window.RoadsterCoast=RoadsterCoast;
