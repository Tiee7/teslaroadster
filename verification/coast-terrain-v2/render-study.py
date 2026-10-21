# Flat-color CPU painter projection of actual r128 scene meshes, not game screenshots.
import json,math
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
tri=np.fromfile('/tmp/coast-study-positions.f32',dtype=np.float32).reshape(-1,3,3)
colors=np.fromfile('/tmp/coast-study-colors.u8',dtype=np.uint8).reshape(-1,3)
data=json.loads(Path('/tmp/coast-study-views.json').read_text())
norm=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);norm/=np.maximum(np.linalg.norm(norm,axis=1)[:,None],1e-12)
light=np.array([-.35,.85,.35]);light/=np.linalg.norm(light);shade=.65+.35*np.abs(norm@light)
colors=np.clip(colors*shade[:,None],0,255).astype(np.uint8)
w,h=640,360;sheet=Image.new('RGB',(1280,3*(h+32)+104),(24,36,44));font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',15)
for index,v in enumerate(data['views']):
 image=Image.new('RGB',(w,h),(142,177,190));draw=ImageDraw.Draw(image)
 eye=np.array(v['eye']);d=tri-eye;basis=np.array([v['right'],v['up'],v['forward']]);cam=d@basis.T
 z=cam[:,:,2];select=np.where((z.max(axis=1)>.08)&(z.min(axis=1)<1000))[0];select=select[np.argsort(z[select].mean(axis=1))[::-1]];scale=h/(2*math.tan(math.radians(30)))
 for i in select:
  poly=list(cam[i]);out=[]
  for a,b in zip(poly,poly[1:]+poly[:1]):
   if a[2]>=.08:out.append(a)
   if (a[2]-.08)*(b[2]-.08)<0:out.append(a+(b-a)*((.08-a[2])/(b[2]-a[2])))
  if len(out)<3:continue
  pts=[(w/2+p[0]/p[2]*scale,h/2-p[1]/p[2]*scale) for p in out]
  if min(p[0] for p in pts)>w or max(p[0] for p in pts)<0 or min(p[1] for p in pts)>h or max(p[1] for p in pts)<0:continue
  dist=max(0,min(1,(z[i].mean()-300)/700));col=tuple(int(c*(1-dist*.6)+bg*(dist*.6))for c,bg in zip(colors[i],(142,177,190)))
  draw.polygon(pts,fill=col)
 x=(index%2)*w;y=(index//2)*(h+32)+74;sheet.paste(image,(x,y));ImageDraw.Draw(sheet).text((x+12,y-24),v['title'],font=font,fill=(230,235,222))
draw=ImageDraw.Draw(sheet);draw.text((12,3),'TERRAIN V2 / exact mesh + stationary FPV camera basis / CPU geometry study',font=font,fill=(237,228,199));draw.text((12,sheet.height-25),'Not WebGL screenshots: flat colors; textures, cockpit, HUD, weather and FPS omitted.',font=font,fill=(211,217,207));sheet.save('verification/coast-terrain-v2/cpu-driving-geometry.png')
