let coastBridgeSideNetwork=null,coastBridgeSideGrid=null,coastBridgeSideSegments=null,coastBridgeSideFaces=null;
let coastBridgeBottomNetwork=null,coastBridgeBottomGrid=null,coastBridgeBottomSegments=null,coastBridgeBottomFaces=null;
function coastBridgeFaceContact(world,previous,next,bottom=false) {
  const network=world?.network;if(!network?.segments)return null;
  const cachedNetwork=bottom?coastBridgeBottomNetwork:coastBridgeSideNetwork;
  if(network!==cachedNetwork){
    const grid=new Map(),segments=network.segments.filter(segment=>segment.bridge&&!segment.shared);
    if(bottom){
      for(let ordinal=0;ordinal<segments.length;ordinal++)for(const triangle of[0,1]){
        const[a,b]=segments[ordinal].rows,p=triangle?a[4]:a[0],q=b[0],r=triangle?b[4]:a[4],code=ordinal*2+triangle;
        for(let x=Math.floor(Math.min(p.x,q.x,r.x)/64);x<=Math.floor(Math.max(p.x,q.x,r.x)/64);x++)for(let z=Math.floor(Math.min(p.z,q.z,r.z)/64);z<=Math.floor(Math.max(p.z,q.z,r.z)/64);z++){const k=x+','+z;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(code);}
      }
    }else{
    for(let ordinal=0;ordinal<segments.length;ordinal++)for(const edge of[0,4]){
      const a=segments[ordinal].rows[0][edge],b=segments[ordinal].rows[1][edge],code=ordinal*2+(edge===4?1:0);
      for(let x=Math.floor(Math.min(a.x,b.x)/64);x<=Math.floor(Math.max(a.x,b.x)/64);x++)for(let z=Math.floor(Math.min(a.z,b.z)/64);z<=Math.floor(Math.max(a.z,b.z)/64);z++){const k=x+','+z;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(code);}
    }
    }
    if(bottom){coastBridgeBottomNetwork=network;coastBridgeBottomGrid=grid;coastBridgeBottomSegments=segments;coastBridgeBottomFaces=new Map();}
    else{coastBridgeSideNetwork=network;coastBridgeSideGrid=grid;coastBridgeSideSegments=segments;coastBridgeSideFaces=new Map();}
  }
  const faceGrid=bottom?coastBridgeBottomGrid:coastBridgeSideGrid,faceSegments=bottom?coastBridgeBottomSegments:coastBridgeSideSegments,faceCache=bottom?coastBridgeBottomFaces:coastBridgeSideFaces;
  const start={x:previous.x,y:previous.y,z:previous.z,pitch:previous.pitch,yaw:previous.yaw,roll:previous.roll},finish={x:next.x,y:next.y,z:next.z,pitch:next.pitch,yaw:next.yaw,roll:next.roll},delta={};for(const k of['pitch','yaw','roll'])delta[k]=wrapAnglePi((finish[k]||0)-(start[k]||0));
  const dx=finish.x-start.x,dy=finish.y-start.y,dz=finish.z-start.z,initialBody=cityPlayerBody(start),radius=Math.hypot(...initialBody.half)+Math.hypot(initialBody.x-start.x,initialBody.y-start.y,initialBody.z-start.z),turn=Math.abs(delta.pitch)+Math.abs(delta.yaw)+Math.abs(delta.roll),near=new Set();
  for(let x=Math.floor((Math.min(start.x,finish.x)-radius)/64);x<=Math.floor((Math.max(start.x,finish.x)+radius)/64);x++)for(let z=Math.floor((Math.min(start.z,finish.z)-radius)/64);z<=Math.floor((Math.max(start.z,finish.z)+radius)/64);z++)for(const face of faceGrid.get(x+','+z)||[])near.add(face);
  if(!near.size)return null;
  const at=t=>({x:start.x+dx*t,y:start.y+dy*t,z:start.z+dz*t,pitch:(start.pitch||0)+delta.pitch*t,yaw:(start.yaw||0)+delta.yaw*t,roll:(start.roll||0)+delta.roll*t});
  const local=cityPlayerBounds||{minX:-.98,maxX:.98,minY:0,maxY:1.25,minZ:-2.31,maxZ:2.31},corners=[];for(const x of[local.minX,local.maxX])for(const y of[local.minY,local.maxY])for(const z of[local.minZ,local.maxZ])corners.push([x,y,z]);
  let earliest=null;
  for(const code of near){
    const ordinal=code>>1,edge=code%2?4:0,segment=faceSegments[ordinal],a=segment.rows[0][edge],b=bottom?segment.rows[1][0]:segment.rows[1][edge],c=bottom?(code%2?segment.rows[1][4]:segment.rows[0][4]):a,pad=radius+1e-7;
    if(Math.max(a.x,b.x,c.x)<Math.min(start.x,finish.x)-pad||Math.min(a.x,b.x,c.x)>Math.max(start.x,finish.x)+pad||Math.max(a.z,b.z,c.z)<Math.min(start.z,finish.z)-pad||Math.min(a.z,b.z,c.z)>Math.max(start.z,finish.z)+pad||(bottom?Math.max(Math.fround(a.y-network.SLAB_DEPTH),Math.fround(b.y-network.SLAB_DEPTH),Math.fround(c.y-network.SLAB_DEPTH)):Math.max(a.y,b.y,c.y))<Math.min(start.y,finish.y)-pad||Math.min(Math.fround(a.y-network.SLAB_DEPTH),Math.fround(b.y-network.SLAB_DEPTH),Math.fround(c.y-network.SLAB_DEPTH))>Math.max(start.y,finish.y)+pad)continue;
    let face=faceCache.get(code);
    if(!face){
      if(bottom){
        const vertices=[a,b,c].map(p=>[p.x,Math.fround(p.y-network.SLAB_DEPTH),p.z]),u=vertices[1].map((v,i)=>v-vertices[0][i]),v=vertices[2].map((v,i)=>v-vertices[0][i]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...cross),sign=cross[1]>0?-1:1,[nx,ny,nz]=cross.map(v=>v*sign/length);
        face={vertices,normal:{x:nx,y:ny,z:nz},plane:vertices[0][0]*nx+vertices[0][1]*ny+vertices[0][2]*nz,edges:vertices.map((p,i)=>vertices[(i+1)%3].map((v,j)=>v-p[j])),minX:Math.min(a.x,b.x,c.x),maxX:Math.max(a.x,b.x,c.x),minZ:Math.min(a.z,b.z,c.z),maxZ:Math.max(a.z,b.z,c.z),minY:Math.min(...vertices.map(p=>p[1])),maxY:Math.max(...vertices.map(p=>p[1])),ordinal,edge};
      }else{
      const down=p=>[p.x,Math.fround(p.y-network.SLAB_DEPTH),p.z],vertices=[[a.x,a.y,a.z],down(a),down(b),[b.x,b.y,b.z]];
      let nx=b.z-a.z,nz=a.x-b.x;const length=Math.hypot(nx,nz),side=((a.x+b.x-segment.a.x-segment.b.x)*nx+(a.z+b.z-segment.a.z-segment.b.z)*nz)<0?-1:1;nx*=side/length;nz*=side/length;
      face={vertices,normal:{x:nx,y:0,z:nz},plane:a.x*nx+a.z*nz,edges:vertices.map((p,i)=>vertices[(i+1)%4].map((v,j)=>v-p[j])),minX:Math.min(a.x,b.x),maxX:Math.max(a.x,b.x),minZ:Math.min(a.z,b.z),maxZ:Math.max(a.z,b.z),minY:Math.min(...vertices.map(p=>p[1])),maxY:Math.max(a.y,b.y),ordinal,edge};
      }
      faceCache.set(code,face);
    }
    const axes=body=>{const out=[...body.axes,[face.normal.x,face.normal.y,face.normal.z]];for(const u of body.axes)for(const v of face.edges){const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n);if(l>1e-10)out.push(n.map(v=>v/l));}return out;};
    const projection=(body,n)=>{let lo=Infinity,hi=-Infinity;for(const p of face.vertices){const v=p[0]*n[0]+p[1]*n[1]+p[2]*n[2];lo=Math.min(lo,v);hi=Math.max(hi,v);}const center=body.x*n[0]+body.y*n[1]+body.z*n[2],r=cityContactProjection(body,n);return{lo:lo-r,hi:hi+r,center};};
    const gap=t=>{const pose=at(t),body=cityPlayerBody(pose);let best=-Infinity,normal=null;for(const n of axes(body)){const p=projection(body,n),a=p.lo-p.center,b=p.center-p.hi;if(Math.max(a,b)>best){best=Math.max(a,b);const sign=a>b?-1:1;normal=n.map(v=>v*sign);}}return{gap:best,normal,pose,body};};
    const complete=(t,q)=>{const pose=q.pose,n={x:q.normal[0],y:q.normal[1],z:q.normal[2]},cp=Math.cos(pose.pitch),sp=Math.sin(pose.pitch),cy=Math.cos(pose.yaw),sy=Math.sin(pose.yaw),cr=Math.cos(pose.roll),sr=Math.sin(pose.roll);let support=Infinity,angular=-Infinity;const candidates=[];
      for(const[x,y,z]of corners){const u=cr*x-sr*y,v=sr*x+cr*y,w=sp*v+cp*z,h=cp*v-sp*z,wx=cy*u+sy*w,wz=-sy*u+cy*w,offset=wx*n.x+h*n.y+wz*n.z,du=-delta.roll*v,dv=delta.roll*u,dw=sp*dv+delta.pitch*h,uy=cp*dv-delta.pitch*w,ux=cy*du+sy*dw+delta.yaw*wz,uz=-sy*du+cy*dw-delta.yaw*wx;support=Math.min(support,offset);candidates.push({offset,closing:-(ux*n.x+uy*n.y+uz*n.z)});}
      for(const p of candidates)if(p.offset<=support+1e-7)angular=Math.max(angular,p.closing);
      return{t,kind:bottom?'bridge-bottom':'bridge-side',box:face,normal:n,pose,depth:Math.max(0,-q.gap),angularClosingPerFraction:angular};};
    const first=gap(0);
    if(first.gap<=1e-7){const h=complete(0,first),closing=-(dx*h.normal.x+dy*h.normal.y+dz*h.normal.z)+h.angularClosingPerFraction;if(closing>1e-12&&h.normal.x*face.normal.x+h.normal.y*face.normal.y+h.normal.z*face.normal.z>=-1e-7&&(!earliest||h.t<earliest.t))earliest=h;continue;}
    // A tilted corner may cross the infinite plane before it reaches this
    // finite face. Decide entry at the actual quad, not at that extension.
    let found=null;
    if(turn<1e-12){let enter=0,exit=1,enterNormal=null;for(const n of axes(initialBody)){const p=projection(initialBody,n),v=dx*n[0]+dy*n[1]+dz*n[2];if(Math.abs(v)<1e-12){if(p.center<p.lo||p.center>p.hi){enter=2;break;}continue;}const a=(p.lo-p.center)/v,b=(p.hi-p.center)/v;if(Math.min(a,b)>enter){enter=Math.min(a,b);enterNormal=n.map(c=>c*(v>0?-1:1));}exit=Math.min(exit,Math.max(a,b));if(enter>exit)break;}if(enter<=exit&&enter<=1&&exit>=0)found=complete(enter,{...gap(enter),normal:enterNormal||first.normal});}
    else{const bound=(q,span=1)=>{const n=q.normal,cy=Math.cos(q.pose.yaw),sy=Math.sin(q.pose.yaw),cp=Math.cos(q.pose.pitch),sp=Math.sin(q.pose.pitch),cross=(x,y,z)=>Math.hypot(y*n[2]-z*n[1],z*n[0]-x*n[2],x*n[1]-y*n[0]);return Math.abs(dx*n[0]+dy*n[1]+dz*n[2])+radius*(Math.abs(delta.yaw)*Math.hypot(n[0],n[2])+Math.abs(delta.pitch)*Math.min(1,cross(cy,0,-sy)+Math.abs(delta.yaw)*span)+Math.abs(delta.roll)*Math.min(1,cross(sy*cp,-sp,cy*cp)+(Math.abs(delta.yaw)+Math.abs(delta.pitch))*span));};let t=0;for(let i=0;i<96;i++){const q=gap(t);if(q.gap<=1e-7){found=complete(t,q);break;}const b=bound(q,1-t);if(b<1e-12||t+q.gap/b*.9>1){t=2;break;}t+=q.gap/b*.9;}if(!found&&t<=1){const search=(lo,hi,depth)=>{const mid=(lo+hi)/2,q=gap(mid),b=bound(q,(hi-lo)/2);if(q.gap>b*(hi-lo)/2+1e-7)return null;if(depth>=36||b*(hi-lo)<1e-7){for(const t of[lo,mid,hi]){const a=gap(t);if(a.gap<=1e-7)return complete(t,a);}return null;}return search(lo,mid,depth+1)||search(mid,hi,depth+1);};found=search(t,1,0);}}
    if(found&&found.normal.x*face.normal.x+found.normal.y*face.normal.y+found.normal.z*face.normal.z>=-1e-7&&-(dx*found.normal.x+dy*found.normal.y+dz*found.normal.z)+found.angularClosingPerFraction>1e-12&&(!earliest||found.t<earliest.t))earliest=found;
  }
  return earliest;
}
function coastBridgeSideContact(world,previous,next) {return coastBridgeFaceContact(world,previous,next,false);}
function coastBridgeBottomContact(world,previous,next) {return coastBridgeFaceContact(world,previous,next,true);}
function coastBridgeBodyContact(world,previous,next) {
  const side=coastBridgeSideContact(world,previous,next),bottom=coastBridgeBottomContact(world,previous,next);
  return bottom&&(!side||bottom.t<side.t)?bottom:side;
}
