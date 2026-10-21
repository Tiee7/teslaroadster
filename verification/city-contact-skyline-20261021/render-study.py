"""CPU z-buffer, perspective UVs and stored sky pixels; NOT WebGL/PBR validation."""
import json,base64,math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
data=json.loads(Path('/tmp/tesla-city-scene-study.json').read_text())
textures=[np.frombuffer(base64.b64decode(t['data']),dtype=np.uint8).reshape(t['h'],t['w'],4)[:,:,:3]/255 for t in data['textures']]
out=Path(__file__).parent
for num,view in enumerate(data['views']):
 w,h=view['width'],view['height'];depth=np.full((h,w),np.inf);image=np.zeros((h,w,3));image[:]=view['background']
 if view['sky']:
  yy,xx=np.mgrid[:h,:w];rays=np.stack([(xx+.5-w/2)/(h/(2*math.tan(math.pi/6))),-(yy+.5-h/2)/(h/(2*math.tan(math.pi/6))),-np.ones((h,w))],axis=-1)
  rotation=np.array(view['camera']).reshape(4,4).T[:3,:3];rays=rays@rotation.T;rays[:,:,0]*=-1
  a=np.abs(rays);major=a.argmax(axis=-1)
  for face in range(6):
   axis=face//2;sign=1 if face%2==0 else -1;mask=(major==axis)&(rays[:,:,axis]*sign>0);d=rays[mask];scale=np.abs(d[:,axis]);u,v=([(-d[:,2],-d[:,1]),(d[:,2],-d[:,1]),(d[:,0],d[:,2]),(d[:,0],-d[:,2]),(d[:,0],-d[:,1]),(-d[:,0],-d[:,1])][face]);texture=textures[view['sky'][face]];sx=np.clip((u/scale+1)*64-.5,0,127);sy=np.clip((v/scale+1)*64-.5,0,127);tx=sx.astype(int);ty=sy.astype(int);fx=(sx-tx)[:,None];fy=(sy-ty)[:,None];x2=np.minimum(tx+1,127);y2=np.minimum(ty+1,127);image[mask]=((texture[ty,tx]*(1-fx)+texture[ty,x2]*fx)*(1-fy)+(texture[y2,tx]*(1-fx)+texture[y2,x2]*fx)*fy)
 for t in view['triangles']:
  v=np.array(t['v']);x0=max(0,math.floor(v[:,0].min()));x1=min(w,math.ceil(v[:,0].max()));y0=max(0,math.floor(v[:,1].min()));y1=min(h,math.ceil(v[:,1].max()))
  if x0>=x1 or y0>=y1:continue
  den=(v[1,1]-v[2,1])*(v[0,0]-v[2,0])+(v[2,0]-v[1,0])*(v[0,1]-v[2,1])
  if abs(den)<1e-8:continue
  yy,xx=np.mgrid[y0:y1,x0:x1];xx=xx+.5;yy=yy+.5
  b0=((v[1,1]-v[2,1])*(xx-v[2,0])+(v[2,0]-v[1,0])*(yy-v[2,1]))/den;b1=((v[2,1]-v[0,1])*(xx-v[2,0])+(v[0,0]-v[2,0])*(yy-v[2,1]))/den;b2=1-b0-b1
  inv=b0/v[0,2]+b1/v[1,2]+b2/v[2,2];z=1/np.maximum(inv,1e-12);mask=(b0>=-1e-8)&(b1>=-1e-8)&(b2>=-1e-8)&(z<depth[y0:y1,x0:x1]);
  if not mask.any():continue
  rgb=np.broadcast_to(np.array(t['colour'])*t['light'],(*z.shape,3)).copy()
  if t['texture']>=0:
   u=(b0*v[0,3]/v[0,2]+b1*v[1,3]/v[1,2]+b2*v[2,3]/v[2,2])*z;vv=(b0*v[0,4]/v[0,2]+b1*v[1,4]/v[1,2]+b2*v[2,4]/v[2,2])*z;texture=textures[t['texture']];tx=(np.floor(u*texture.shape[1]).astype(int)%texture.shape[1]);ty=(np.floor(vv*texture.shape[0]).astype(int)%texture.shape[0]);rgb*=texture[ty,tx]
   if t['emission']>=0:rgb+=textures[t['emission']][ty,tx]*t['emissive']*t['gain']
  fog=1-np.exp(-(z*(.00018 if view['mode']==3 else .00045))**2);fogcolour=np.array([190,211,224])/255 if view['mode']==3 else np.array(view['background']);rgb=rgb*(1-fog[:,:,None])+fogcolour*fog[:,:,None]
  patch=image[y0:y1,x0:x1];patch[mask]=rgb[mask]*t['alpha']+patch[mask]*(1-t['alpha']);depth[y0:y1,x0:x1][mask]=z[mask]
 pic=Image.fromarray(np.uint8(np.clip(image,0,1)*255));draw=ImageDraw.Draw(pic);draw.rectangle((0,0,w,47),fill='#071322');draw.text((8,6),view['title']+' / actual geometry + stored texture pixels',fill='white');draw.text((8,25),'CPU approximate lighting; NOT WebGL / exposure / gameplay QA',fill='#b3c6d8');pic.save(out/f'city-study-{num}.png')
