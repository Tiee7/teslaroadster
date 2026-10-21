const RoadsterCoastRoads = (() => {
  'use strict';
  const HALF_BOUND=1200, ROAD_WIDTH=9, BRIDGE_ROAD_WIDTH=23, SLAB_DEPTH=.7, CELL=64;
  const f=Math.fround, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const points=[[-70,850],[-70,200],[-70,-450],[100,-900],[650,-850],[980,-450],[650,0],[1000,450],[750,900],[280,900]];
  const bypass=[[-70,200],[430,300],[1040,300],[1040,780],[430,850],[-70,850]];
  function curve(nodes,piece,t,coastLocks=false){
    const n=nodes.length,a=nodes[piece],b=nodes[(piece+1)%n];
    const tangent=i=>{if(coastLocks&&(i===0||i===1))return[0,-500];if(nodes===bypass&&(i===0||i===n-1))return[0,-700];
      const before=nodes[(i+n-1)%n],after=nodes[(i+1)%n];return[(after[0]-before[0])*.5,(after[1]-before[1])*.5];};
    const u=tangent(piece),v=tangent((piece+1)%n),t2=t*t,t3=t2*t;
    const h=[2*t3-3*t2+1,t3-2*t2+t,-2*t3+3*t2,t3-t2];
    return{x:a[0]*h[0]+u[0]*h[1]+b[0]*h[2]+v[0]*h[3],z:a[1]*h[0]+u[1]*h[1]+b[1]*h[2]+v[1]*h[3],piece};
  }
  function horizontal(nodes,locks){
    const table=[];let length=0,previous=null;
    for(let piece=0;piece<nodes.length;piece++)for(let i=0;i<128;i++){
      const p=curve(nodes,piece,i/128,locks);if(previous)length+=Math.hypot(p.x-previous.x,p.z-previous.z);
      table.push({...p,s:length});previous=p;
    }
    const p=curve(nodes,0,0,locks);length+=Math.hypot(p.x-previous.x,p.z-previous.z);table.push({...p,s:length});return{table,length};
  }
  const horizontalPaths=[horizontal(points,true),horizontal(bypass,false)];
  function profile(s,length){
    const keys=[[0,0],[1550,0],[2450,36],[3250,64],[4300,28],[Math.min(5000,length-120),0],[length,0]];
    for(let i=0;i<keys.length-1;i++)if(s<=keys[i+1][0]){const[a,y]=keys[i],[b,z]=keys[i+1],t=clamp((s-a)/(b-a),0,1);return lerp(y,z,t*t*(3-2*t));}
    return 0;
  }
  function tableAt(path,s){
    let low=0,high=path.table.length-1;while(low+1<high){const m=(low+high)>>1;if(path.table[m].s<=s)low=m;else high=m;}
    const a=path.table[low],b=path.table[high],t=(s-a.s)/(b.s-a.s||1);return{x:lerp(a.x,b.x,t),z:lerp(a.z,b.z,t),piece:a.piece};
  }
  const routes=horizontalPaths.map((path,id)=>{
    const stations=[];let distance=0,previous=null;
    const count=Math.ceil(path.length/5.5);
    for(let i=0;i<=count;i++){
      const sxz=i*path.length/count,p=tableAt(path,sxz),y=id===0?profile(sxz,path.length):0;
      const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);},wide=id===0?ease((sxz-2930)/250)*ease((5050-sxz)/180):0;
      const next={halfWidth:f(4.5+7*wide),wide,x:f(p.x),y:f(y),z:f(p.z),sxz,index:i,piece:p.piece,bridge:id===0&&sxz>=3200&&sxz<=4850,shared:id===1&&p.piece===bypass.length-1};
      if(previous)distance+=Math.hypot(next.x-previous.x,next.y-previous.y,next.z-previous.z);
      next.s=distance;stations.push(next);previous=next;
    }
    for(let i=0;i<stations.length;i++){
      const a=stations[i===0?stations.length-2:i-1],b=stations[i===stations.length-1?1:i+1],p=stations[i];
      const size=Math.hypot(b.x-a.x,b.z-a.z),dx=(b.x-a.x)/size,dz=(b.z-a.z)/size;
      p.dx=dx;p.dz=dz;p.grade=(b.y-a.y)/size;p.rx=-dz;p.rz=dx;
      const normalSize=Math.hypot(1,p.grade);p.normal={x:-dx*p.grade/normalSize,y:1/normalSize,z:-dz*p.grade/normalSize};
    }
    return{id,name:id===0?'Coast / mountain / viaduct loop':'Ground-level cross-coast bypass',stations,length:distance};
  });
  const pierJoin=routes[0].stations.slice(0,-1).flatMap((a,i)=>{const b=routes[0].stations[i+1];if((a.z+650)*(b.z+650)>0||a.z===b.z)return[];const t=(-650-a.z)/(b.z-a.z);return[{x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),z:-650}];}).sort((a,b)=>a.x-b.x)[0];
  const access={id:2,name:'Continuous pier road link',stations:[],length:0};
  const accessCount=Math.ceil((pierJoin.x+250)/5.5);
  for(let i=0;i<=accessCount;i++){
    const t=i/accessCount,grade=pierJoin.y*6*t*(1-t)/(pierJoin.x+250),p={x:f(lerp(-250,pierJoin.x,t)),y:f(pierJoin.y*t*t*(3-2*t)),z:-650,index:i,dx:1,dz:0,rx:0,rz:1,grade,normal:{x:-grade/Math.hypot(1,grade),y:1/Math.hypot(1,grade),z:0},bridge:false,shared:false,halfWidth:4.5,wide:0};
    const previous=access.stations.at(-1);if(previous)access.length+=Math.hypot(p.x-previous.x,p.y-previous.y,p.z-previous.z);p.s=access.length;access.stations.push(p);
  }
  const key=(x,z)=>`${Math.floor(x/CELL)},${Math.floor(z/CELL)}`;
  const segmentGrid=new Map(),triangleGrid=new Map(),segments=[],triangles=[],routeSegments=[[],[],[]];
  const index=(map,item,box,pad=0)=>{for(let x=Math.floor((box.minX-pad)/CELL);x<=Math.floor((box.maxX+pad)/CELL);x++)for(let z=Math.floor((box.minZ-pad)/CELL);z<=Math.floor((box.maxZ+pad)/CELL);z++){const k=`${x},${z}`;if(!map.has(k))map.set(k,[]);map.get(k).push(item);}};
  function makeTriangle(a,b,c,routeId,bridge,id=`road-${routeId}`){
    const ux=b.x-a.x,uy=b.y-a.y,uz=b.z-a.z,vx=c.x-a.x,vy=c.y-a.y,vz=c.z-a.z;
    let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;if(ny<0){nx=-nx;ny=-ny;nz=-nz;}const n=Math.hypot(nx,ny,nz);
    const t={a,b,c,id,routeId,bridge,normal:{x:nx/n,y:ny/n,z:nz/n},minX:Math.min(a.x,b.x,c.x),maxX:Math.max(a.x,b.x,c.x),minZ:Math.min(a.z,b.z,c.z),maxZ:Math.max(a.z,b.z,c.z)};
    triangles.push(t);index(triangleGrid,t,t);return t;
  }
  for(const route of [...routes,access])for(let i=0;i<route.stations.length-1;i++){
    const a=route.stations[i],b=route.stations[i+1],bridge=a.bridge||b.bridge,shared=a.shared&&b.shared;
    const segment={a,b,routeId:route.id,bridge,shared,minX:Math.min(a.x,b.x),maxX:Math.max(a.x,b.x),minZ:Math.min(a.z,b.z),maxZ:Math.max(a.z,b.z)};
    segments.push(segment);routeSegments[route.id].push(segment);index(segmentGrid,segment,segment,180);
    if(shared)continue;
    const row=p=>[-p.halfWidth,1-p.halfWidth,0,p.halfWidth-1,p.halfWidth].map(offset=>({x:f(p.x+p.rx*offset),y:p.y,z:f(p.z+p.rz*offset)}));const left=row(a),right=row(b);
    segment.rows=[left,right];segment.triangles=[];
    for(let j=0;j<left.length-1;j++){segment.triangles.push(makeTriangle(left[j],left[j+1],right[j],route.id,bridge),makeTriangle(left[j+1],right[j+1],right[j],route.id,bridge));}
  }
  function heightInTriangle(t,x,z){
    const[a,b,c]=[t.a,t.b,t.c],den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
    if(Math.abs(den)<1e-10)return null;const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/den,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/den,w=1-u-v;
    return Math.min(u,v,w)>=-1e-7?u*a.y+v*b.y+w*c.y:null;
  }
  function nearestSegment(x,z,predicate=()=>true){
    let nearest=null;
    for(const segment of segmentGrid.get(key(x,z))||[]){if(!predicate(segment))continue;const{a,b}=segment,dx=b.x-a.x,dz=b.z-a.z,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1),distance=Math.hypot(x-lerp(a.x,b.x,t),z-lerp(a.z,b.z,t));
      if(!nearest||distance<nearest.distance)nearest={segment,t,distance,height:lerp(a.y,b.y,t),halfWidth:lerp(a.halfWidth,b.halfWidth,t)};
    }return nearest;
  }
  function baseTerrain(x,z){
    const fade=clamp((x-500)/160,0,1),mask=fade*fade*(3-2*fade);
    let y=mask*(45*Math.exp(-Math.pow((x-800)/300,2)-Math.pow((z+350)/510,2))+20*Math.exp(-Math.pow((x-950)/270,2)-Math.pow((z-520)/430,2))+28*Math.exp(-Math.pow((x-1120)/150,2)-Math.pow((z+1000)/200,2))+24*Math.exp(-Math.pow((x-720)/170,2)-Math.pow((z-650)/210,2)));
    const influence=distance=>{const t=clamp((distance-45)/115,0,1);return 1-t*t*(3-2*t);};
    const mountain=nearestSegment(x,z,s=>!s.bridge&&s.routeId===0);
    if(mountain&&mountain.distance<160)y=lerp(y,Math.max(0,mountain.height-3),influence(mountain.distance));
    const ground=nearestSegment(x,z,s=>s.routeId===1);
    if(ground&&ground.distance<160)y*=1-influence(ground.distance);
    return y;
  }
  const terrain={nx:64,nz:64,minX:-145,maxX:1200,minZ:-1200,maxZ:1200,vertices:[],indices:[]};
  for(let iz=0;iz<=terrain.nz;iz++)for(let ix=0;ix<=terrain.nx;ix++){const x=f(lerp(terrain.minX,terrain.maxX,ix/terrain.nx)),z=f(lerp(terrain.minZ,terrain.maxZ,iz/terrain.nz));terrain.vertices.push({x,y:f(baseTerrain(x,z)),z});}
  for(let z=0;z<terrain.nz;z++)for(let x=0;x<terrain.nx;x++){const a=z*(terrain.nx+1)+x,b=a+1,c=a+terrain.nx+1,d=c+1;terrain.indices.push(a,c,b,b,c,d);}
  function terrainSupport(x,z){
    const ix=clamp(Math.floor((x-terrain.minX)/(terrain.maxX-terrain.minX)*terrain.nx),0,terrain.nx-1),iz=clamp(Math.floor((z-terrain.minZ)/(terrain.maxZ-terrain.minZ)*terrain.nz),0,terrain.nz-1),a=iz*(terrain.nx+1)+ix,b=a+1,c=a+terrain.nx+1,d=c+1;
    for(const ids of [[a,c,b],[b,c,d]]){const[p,q,r]=ids.map(i=>terrain.vertices[i]),t={a:p,b:q,c:r},height=heightInTriangle(t,x,z);if(height===null)continue;
      const ux=q.x-p.x,uy=q.y-p.y,uz=q.z-p.z,vx=r.x-p.x,vy=r.y-p.y,vz=r.z-p.z,nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,n=Math.hypot(nx,ny,nz);
      return{id:'terrain',height,normal:{x:nx/n,y:ny/n,z:nz/n},solid:true,water:false,terrain:true,triangle:t};}
    return{id:'terrain',height:0,normal:{x:0,y:1,z:0},solid:true,water:false,terrain:true};
  }
  const banks=[],structures=[],bridgeSegments=segments.filter(s=>s.bridge),bridgeStart=Math.min(...bridgeSegments.map(s=>s.a.sxz)),bridgeEnd=Math.max(...bridgeSegments.map(s=>s.b.sxz));
  function rail(c,d,guide=false){structures.push({kind:'rail',guide,minX:Math.min(c.x,d.x)-.12,maxX:Math.max(c.x,d.x)+.12,minZ:Math.min(c.z,d.z)-.12,maxZ:Math.max(c.z,d.z)+.12,minY:Math.min(c.y,d.y)+.08,maxY:Math.max(c.y,d.y)+.95,a:c,b:d});}
  for(const segment of segments){
    if(segment.shared)continue;
    const {a,b,bridge,rows}=segment;
    if(!bridge){
      for(const side of[-1,1]){
        const edge=side<0?0:4,outer=p=>{const x=f(p.x+p.rx*side*32),z=f(p.z+p.rz*side*32);return{x,y:f(terrainSupport(x,z).height),z};};
        const c=outer(a),d=outer(b);
        banks.push(makeTriangle(rows[0][edge],c,rows[1][edge],segment.routeId,false,`bank-${segment.routeId}`),makeTriangle(c,d,rows[1][edge],segment.routeId,false,`bank-${segment.routeId}`));
      }
      if(segment.routeId===0&&(a.sxz>=bridgeStart-180&&b.sxz<=bridgeStart||a.sxz>=bridgeEnd&&b.sxz<=bridgeEnd+180)){
        for(const side of[-1,1]){
          const guide=p=>{const d=p.sxz<bridgeStart?bridgeStart-p.sxz:p.sxz-bridgeEnd,t=clamp(d/180,0,1),offset=lerp(p.halfWidth,32,t*t*(3-2*t)),x=f(p.x+p.rx*side*offset),z=f(p.z+p.rz*side*offset),outer=terrainSupport(p.x+p.rx*side*32,p.z+p.rz*side*32).height;
            return{x,z,y:f(lerp(p.y,outer,(offset-p.halfWidth)/(32-p.halfWidth)))};};rail(guide(a),guide(b),true);
        }
      }
    }else{
      for(const edge of[0,4]){
        const c=rows[0][edge],d=rows[1][edge];
        rail(c,d);
      }
      if(Math.floor(a.s/90)!==Math.floor(b.s/90)){
        const land=terrainSupport(a.x,a.z).height,groundRoad=nearestSegment(a.x,a.z,s=>s.routeId===1&&!s.shared);
        if(a.y-land>8&&(!groundRoad||groundRoad.distance>12))structures.push({kind:'pier',minX:a.x-.9,maxX:a.x+.9,minZ:a.z-.9,maxZ:a.z+.9,minY:land,maxY:a.y-SLAB_DEPTH});
      }
    }
  }
  for(const p of[bridgeSegments[0].a,bridgeSegments.at(-1).b])for(const[lo,hi,top]of[[-32,-p.halfWidth,p.y+.95],[-p.halfWidth,p.halfWidth,p.y-SLAB_DEPTH],[p.halfWidth,32,p.y+.95]]){
    const a={x:f(p.x+p.rx*lo),z:f(p.z+p.rz*lo)},b={x:f(p.x+p.rx*hi),z:f(p.z+p.rz*hi)},land=Math.min(terrainSupport(a.x,a.z).height,terrainSupport(b.x,b.z).height)-.1;
    structures.push({kind:'abutment',a,b,thickness:1.2,minX:Math.min(a.x,b.x)-.6,maxX:Math.max(a.x,b.x)+.6,minZ:Math.min(a.z,b.z)-.6,maxZ:Math.max(a.z,b.z)+.6,minY:land,maxY:top});
  }
  function candidates(x,z){
    if(x< -330){
      if(x>=-810&&x<=-250&&z>=-668&&z<=-632)return[{id:'pier',height:0,normal:{x:0,y:1,z:0},solid:true,water:false,pier:true}];
      return[{id:'water',height:-.4,normal:{x:0,y:1,z:0},solid:false,water:true}];
    }
    const found=[terrainSupport(x,z)];
    for(const triangle of triangleGrid.get(key(x,z))||[]){const height=heightInTriangle(triangle,x,z);if(height!==null&&!found.some(s=>s.id===triangle.id&&Math.abs(s.height-height)<1e-5))found.push({id:triangle.id,height,normal:triangle.normal,solid:true,water:false,road:triangle.id.startsWith('road'),bank:triangle.id.startsWith('bank'),bridge:triangle.bridge,triangle});}
    return found;
  }
  function querySupport(q){
    const{x,z}=q,y=Number.isFinite(q.y)?q.y:0,previousY=Number.isFinite(q.previousY)?q.previousY:y;
    if(x< -330&&!(x>=-810&&x<=-250&&z>=-668&&z<=-632))return{id:'water',height:-.4,solid:false,water:true,normal:{x:0,y:1,z:0}};
    if(x>=-810&&x<=-250&&z>=-668&&z<=-632)return y<-.25
      ?{id:'water',height:-.4,solid:false,water:true,normal:{x:0,y:1,z:0}}
      :{id:'pier',height:0,solid:true,water:false,pier:true,normal:{x:0,y:1,z:0}};
    const options=candidates(x,z).filter(s=>s.height<=Math.max(y,previousY)+.35);
    if(q.grounded&&q.previousSupportId){
      const same=options.filter(s=>s.id===q.previousSupportId&&Math.abs(s.height-y)<.5);
      if(!q.previousSupportId.startsWith('road')){
        const road=options.filter(s=>(s.road||(s.bank&&q.previousSupportId==='terrain'))&&Math.abs(s.height-y)<=.12).sort((a,b)=>Number(b.road)-Number(a.road)||b.height-a.height)[0];
        if(road)return road;
      }
      if(same.length)return same.reduce((a,b)=>Math.abs(a.height-y)<Math.abs(b.height-y)?a:b);
    }
    return options.sort((a,b)=>b.height-a.height)[0]||{id:'none',height:-Infinity,solid:false,water:false,normal:{x:0,y:1,z:0}};
  }
  function groundAttitude(normal,yaw){
    const right=normal.x*Math.cos(yaw)-normal.z*Math.sin(yaw),back=normal.x*Math.sin(yaw)+normal.z*Math.cos(yaw);
    return{pitch:Math.atan2(back,normal.y),roll:-Math.asin(clamp(right,-1,1))};
  }
  function sweepLanding(previous,next){
    const count=Math.max(1,Math.ceil(Math.hypot(next.x-previous.x,next.z-previous.z)/1.5));
    let old={...previous};
    for(let i=1;i<=count;i++){
      const time=i/count,p={x:lerp(previous.x,next.x,time),y:lerp(previous.y,next.y,time),z:lerp(previous.z,next.z,time)};
      let first=null;
      const oldOptions=candidates(old.x,old.z),newOptions=candidates(p.x,p.z);
      for(const s of [...oldOptions,...newOptions]){
        if(!s.solid)continue;
        const plane=(x,z)=>s.triangle?s.triangle.a.y-(s.normal.x*(x-s.triangle.a.x)+s.normal.z*(z-s.triangle.a.z))/s.normal.y:s.height;
        const a=old.y-plane(old.x,old.z),b=p.y-plane(p.x,p.z);
        if(a>=-.025&&b<=.025&&b<a-1e-8){
          const local=clamp(a/(a-b||1),0,1),t=(i-1+local)/count,x=lerp(previous.x,next.x,t),z=lerp(previous.z,next.z,t),exact=candidates(x,z).find(c=>c.id===s.id&&Math.abs(c.height-plane(x,z))<.03);
          if(!exact)continue;
          const hit={...exact,t,x,z};if(!first||t<first.t-1e-8||(Math.abs(t-first.t)<1e-8&&s.road))first=hit;
        }
      }
      if(first)return first;
      old=p;
    }
    return null;
  }
  function sweepStructures(previous,next,height=1.25){
    let hit=null;
    for(const box of structures){
      let enter=0,exit=1,normal=null;
      const ranges=[['y',box.minY-height,box.maxY,{x:0,y:1,z:0}]];
      let from=previous,to=next;
      if(box.kind==='rail'||box.kind==='abutment'){
        const dx=box.b.x-box.a.x,dz=box.b.z-box.a.z,length=Math.hypot(dx,dz),tx=dx/length,tz=dz/length,nx=-tz,nz=tx,yaw=next.yaw||0;
        const extent=(x,z)=>Math.abs(-Math.sin(yaw)*x-Math.cos(yaw)*z)*2.31+Math.abs(Math.cos(yaw)*x-Math.sin(yaw)*z)*.98;
        const local=p=>({x:(p.x-box.a.x)*nx+(p.z-box.a.z)*nz,z:(p.x-box.a.x)*tx+(p.z-box.a.z)*tz,y:p.y});
        from=local(previous);to=local(next);
        const half=(box.thickness||.24)/2;
        ranges.push(['x',-half-extent(nx,nz),half+extent(nx,nz),{x:nx,y:0,z:nz}],['z',-extent(tx,tz),length+extent(tx,tz),{x:tx,y:0,z:tz}]);
      }else ranges.push(['x',box.minX-1.1,box.maxX+1.1,{x:1,y:0,z:0}],['z',box.minZ-2.31,box.maxZ+2.31,{x:0,y:0,z:1}]);
      for(const [axis,lo,hi,basis]of ranges){
        const v=to[axis]-from[axis];if(Math.abs(v)<1e-12){if(from[axis]<lo||from[axis]>hi){enter=2;break;}continue;}
        const a=(lo-from[axis])/v,b=(hi-from[axis])/v,first=Math.min(a,b);
        if(first>=enter){enter=first;const sign=v>0?-1:1;normal={x:basis.x*sign,y:basis.y*sign,z:basis.z*sign};}
        exit=Math.min(exit,Math.max(a,b));
      }
      if(normal&&enter<=exit&&enter<=1&&(!hit||enter<hit.t))hit={t:enter,kind:box.kind,box,normal};
    }
    const count=Math.max(1,Math.ceil(Math.hypot(next.x-previous.x,next.z-previous.z)/1.5));
    for(let i=1;i<=count;i++){
      const t=i/count,x=lerp(previous.x,next.x,t),z=lerp(previous.z,next.z,t),y=lerp(previous.y,next.y,t);
      for(const s of candidates(x,z).filter(s=>s.bridge)){
        const oldT=(i-1)/count,old=candidates(lerp(previous.x,next.x,oldT),lerp(previous.z,next.z,oldT)).find(a=>a.id===s.id&&a.bridge),ceiling=s.height-SLAB_DEPTH;
        const before=lerp(previous.y,next.y,oldT)+height-(old?old.height-SLAB_DEPTH:ceiling),after=y+height-ceiling;
        if(before<=0&&after>=0&&after>before+1e-8){const fraction=clamp(-before/(after-before),0,1),at=(i-1+fraction)/count;if(!hit||at<hit.t)hit={t:at,kind:'ceiling',height:ceiling-height,normal:{x:-s.normal.x,y:-s.normal.y,z:-s.normal.z}};}
      }
    }
    return hit;
  }
  const trafficPathCache=new Map();
  function trafficPath(routeId,laneOffset=1.75){
    const key=`${routeId},${laneOffset}`;if(trafficPathCache.has(key))return trafficPathCache.get(key);
    const route=routes[Math.abs(Math.floor(routeId))%2],reverse=routeId>=2,sign=reverse?-1:1;
    let input=route.stations.slice(0,-1);if(reverse)input=input.slice().reverse();
    let length=0,previous=null;
    const stations=input.map(p=>{const offset=laneOffset===0?0:1.75+(laneOffset-1.75)*p.wide,x=p.x+p.rx*sign*offset,z=p.z+p.rz*sign*offset,surface=candidates(x,z).find(c=>c.id===`road-${route.id}`)||terrainSupport(x,z),q={...p,x,y:surface.height,z,dx:p.dx*sign,dz:p.dz*sign,grade:p.grade*sign};
      if(previous)length+=Math.hypot(q.x-previous.x,q.y-previous.y,q.z-previous.z);q.s=length;previous=q;return q;});
    for(let i=0;i<stations.length;i++){const a=stations[(i+stations.length-1)%stations.length],b=stations[(i+1)%stations.length],p=stations[i],d=Math.hypot(b.x-a.x,b.z-a.z);p.dx=(b.x-a.x)/d;p.dz=(b.z-a.z)/d;p.grade=(b.y-a.y)/d;}
    const first={...stations[0]};length+=Math.hypot(first.x-previous.x,first.y-previous.y,first.z-previous.z);first.s=length;stations.push(first);
    const result={id:routeId,stations,length,roadId:route.id};trafficPathCache.set(key,result);return result;
  }
  function sampleRoute(routeId,distance,laneOffset=1.75){
    const route=trafficPath(routeId,laneOffset);const s=((distance%route.length)+route.length)%route.length;
    let low=0,high=route.stations.length-1;while(low+1<high){const m=(low+high)>>1;if(route.stations[m].s<=s)low=m;else high=m;}
    const a=route.stations[low],b=route.stations[high],t=(s-a.s)/(b.s-a.s||1),dx=lerp(a.dx,b.dx,t),dz=lerp(a.dz,b.dz,t),n=Math.hypot(dx,dz),x=lerp(a.x,b.x,t),z=lerp(a.z,b.z,t);
    let surface=null;
    const strips=routeSegments[route.roadId];for(const station of[a,b])for(const index of[station.index-1,station.index])for(const triangle of strips[(index+strips.length)%strips.length]?.triangles||[]){const height=heightInTriangle(triangle,x,z);if(height!==null){surface={height,normal:triangle.normal,id:triangle.id};break;}}
    surface=surface||candidates(x,z).find(c=>c.id===`road-${route.roadId}`)||candidates(x,z).find(c=>c.road&&Math.abs(c.height-lerp(a.y,b.y,t))<.03);if(!surface)throw Error('Unsupported traffic lane');const grade=lerp(a.grade,b.grade,t);
    const yaw=Math.atan2(-dx,-dz),attitude=groundAttitude(surface.normal,yaw),size=Math.hypot(1,grade);
    return{x,y:surface.height,z,dx:dx/n,dz:dz/n,dy:grade,vx:dx/n/size,vy:grade/size,vz:dz/n/size,yaw,...attitude,normal:surface.normal,supportId:surface.id,bridge:a.bridge||b.bridge,halfWidth:lerp(a.halfWidth,b.halfWidth,t),wide:lerp(a.wide,b.wide,t),referenceS:lerp(a.sxz,b.sxz,t),s};
  }
  const trafficConflicts=Object.freeze([{x:-69.113,z:181.488,radius:32},{x:-62.352,z:878.039,radius:44},{x:231.724,z:902.219,radius:31}]);
  function createTrafficJunctions(){
    const zones=trafficConflicts.map((q,id)=>({...q,id,entries:new Map(),owner:null,entered:false,hold:0,grants:0,releases:0}));
    let limits=new Map(),maximumWait=0,maximumHold=0;
    const waits=new Map();
    const distance=(zone,car)=>{
      const path=trafficPath(car.coastRoute,car.coastLane),key=`${car.coastRoute},${car.coastLane||1.75}`;
      if(!zone.entries.has(key)){const found=[];for(let i=0;i<path.stations.length-1;i++){
        const a=path.stations[i],b=path.stations[i+1],x=a.x-zone.x,z=a.z-zone.z,dx=b.x-a.x,dz=b.z-a.z,A=dx*dx+dz*dz,B=2*(x*dx+z*dz),C=x*x+z*z-zone.radius*zone.radius,D=B*B-4*A*C;
        if(D<0||!A)continue;const t=(-B-Math.sqrt(D))/(2*A);if(t>=0&&t<=1)found.push(lerp(a.s,b.s,t));
      }zone.entries.set(key,found);}
      return Math.min(...zone.entries.get(key).map(s=>(s-car.coastDistance+path.length)%path.length));
    };
    const inside=(zone,p,extra=0)=>Math.hypot(p.x-zone.x,p.z-zone.z)<zone.radius+extra&&Math.abs(p.y||0)<4;
    const live=c=>c.mesh.visible!==false&&!c.coastWaiting&&!c.blastTimer;
    function prepare(cars,dt){
      limits=new Map();
      for(const zone of zones){
        const owner=zone.owner;
        if(owner&&(!cars.includes(owner)||!live(owner)||(zone.entered&&!inside(zone,owner.mesh.position,4)))){zone.owner=null;zone.releases++;zone.hold=0;zone.entered=false;}
        if(!zone.owner){
          const ready=cars.map((car,index)=>({car,index,d:live(car)?distance(zone,car):Infinity})).filter(c=>live(c.car)&&(inside(zone,c.car.mesh.position)||c.d<60));
          ready.sort((a,b)=>{const score=c=>c.d/c.car.desiredSpeed-Math.min(waits.get(`${zone.id},${c.index}`)||0,40)*.25;return score(a)-score(b)||(a.car.coastRoute%2)-(b.car.coastRoute%2)||a.index-b.index;});
          if(ready.length){zone.owner=ready[0].car;zone.grants++;zone.entered=inside(zone,zone.owner.mesh.position);zone.hold=0;}
        }
        if(zone.owner){zone.hold+=dt;maximumHold=Math.max(maximumHold,zone.hold);if(inside(zone,zone.owner.mesh.position))zone.entered=true;}
        cars.forEach((car,index)=>{
          if(!live(car))return;const d=distance(zone,car),key=`${zone.id},${index}`;
          if(zone.owner===car){waits.set(key,0);return;}
          if(d<60){const wait=(waits.get(key)||0)+dt;waits.set(key,wait);maximumWait=Math.max(maximumWait,wait);limits.set(car,Math.min(limits.get(car)??Infinity,Math.max(0,(d-9)/1.5)));}
          else waits.set(key,0);
        });
      }
    }
    return Object.freeze({prepare,targetSpeed:car=>limits.get(car)??Infinity,
      canAdvance:(car,p)=>zones.every(q=>q.owner===car||!inside(q,p,3)||inside(q,car.mesh.position,3)),
      canSpawn:p=>zones.every(q=>!inside(q,p,12)),
      reset(){for(const q of zones){q.owner=null;q.entered=false;q.hold=q.grants=q.releases=0;}waits.clear();limits.clear();maximumWait=maximumHold=0;},
      stats:()=>({maximumWait,maximumHold,zones:zones.map(q=>({id:q.id,grants:q.grants,releases:q.releases,owned:Boolean(q.owner)}))})});
  }
  const stats=()=>({routes:routes.length,mainLength:routes[0].length,bypassLength:routes[1].length,pierLinkLength:access.length,stations:routes.reduce((n,r)=>n+r.stations.length,access.stations.length),roadTriangles:triangles.length-banks.length,bankTriangles:banks.length,terrainTriangles:terrain.indices.length/3,maxHeight:Math.max(...routes[0].stations.map(p=>p.y)),maxGrade:Math.max(...routes.flatMap(r=>r.stations.map(p=>Math.abs(p.grade))))});
  return Object.freeze({version:2,HALF_BOUND,ROAD_WIDTH,BRIDGE_ROAD_WIDTH,SLAB_DEPTH,routes,access,segments,triangles,banks,structures,terrain,trafficPath,sampleRoute,createTrafficJunctions,trafficConflicts,querySupport,sweepLanding,sweepStructures,groundAttitude,candidates,nearestSegment,heightInTriangle,terrainSupport,stats});
})();
