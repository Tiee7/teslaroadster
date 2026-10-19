"""Disclosed actual-mesh side/rear comparisons. Uniform scale/crop only."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json,hashlib,sys
before,after,reference,out=map(Path,sys.argv[1:5]);out.mkdir(parents=True,exist_ok=True)
audits=[json.loads((p/'render-audit.json').read_text()) for p in (before,after)]
sideviews=[next(v for v in a['renderedViews'] if v['name']=='tail-side-left') for a in audits]
assert sideviews[0]==sideviews[1]
for k in ['renderer','samples','inspectionLighting','colorConversion']:assert audits[0][k]==audits[1][k]
font='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';large=ImageFont.truetype(font,34);small=ImageFont.truetype(font,22)
# Exact orthographic camera projection:1200px /5.2m horizontal field.
ppm=1200/5.2;frontx=600-1.36*ppm;rearx=600+1.38*ppm;reary=380+(.55-.35)*ppm
specs=[('参考',reference,[60,105,575,267],[151,452],207),('当前上线版',before/'tail-side-left-raw.png',[85,235,1150,515],[frontx,rearx],reary),('向下收尾候选',after/'tail-side-left-raw.png',[85,235,1150,515],[frontx,rearx],reary)]
sheet=Image.new('RGB',(1400,1370),'#f3f4f5');records=[]
for row,(label,path,crop,xs,ry) in enumerate(specs):
 im=Image.open(path).convert('RGB');scale=750/(xs[1]-xs[0]);x=1080-(xs[1]-crop[0])*scale;y=285-(ry-crop[1])*scale
 inverse=(1/scale,0,-x/scale,0,1/scale,-y/scale)
 panel=im.crop(tuple(crop)).transform((1400,430),Image.Transform.AFFINE,inverse,Image.Resampling.BICUBIC,fillcolor='#f3f4f5')
 ImageDraw.Draw(panel).text((20,7),label,font=large,fill='#17202b');sheet.paste(panel,(0,row*430))
 records.append({'label':label,'file':str(path.resolve()),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'crop':crop,'uniformScaleXY':scale,'inverseAffine':inverse,'sourceRearWheelY':ry,'sourceWheelCentersX':xs,'targetWheelbasePixels':750,'targetRearWheelCenter':[1080,285],'rotationDegrees':0,'mirrored':False})
d=ImageDraw.Draw(sheet);d.text((20,1298),'等比缩放并对齐轴距；参考飞行画面保留原倾角，未镜像、未改形。',font=small,fill='#505862');d.text((20,1330),'实际网格 CPU 侧视；后肩、后甲板及上后围向下收，尾翼姿态保留。',font=small,fill='#505862')
sheet.save(out/'tail-down-side-user-comparison.png')
name='rear-inspection-three-quarter';rearviews=[next(v for v in a['renderedViews'] if v['name']==name) for a in audits];assert rearviews[0]==rearviews[1]
sheet=Image.new('RGB',(1400,1140),'#f3f4f5');d=ImageDraw.Draw(sheet);reartransforms=[]
for row,(p,label) in enumerate(((before,'当前上线版'),(after,'向下收尾候选'))):
 path=p/(name+'-raw.png');crop=[70,202,1145,609];im=Image.open(path).crop(tuple(crop));scale=1.15
 # Same inverse-affine uniform factor avoids integer-size X/Y aspect drift.
 panel=im.transform((1400,550),Image.Transform.AFFINE,(1/scale,0,-40/scale,0,1/scale,-50/scale),Image.Resampling.BICUBIC,fillcolor='#f3f4f5')
 ImageDraw.Draw(panel).text((20,7),label,font=large,fill='#17202b');sheet.paste(panel,(0,row*550))
 reartransforms.append({'file':str(path.resolve()),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'crop':crop,'uniformScaleXY':scale,'translation':[40,50]})
d.text((20,1107),'实际网格 CPU 后侧；同相机同光照，翼面、牌照、喷口及下扩散器保持原位。',font=small,fill='#505862');sheet.save(out/'tail-down-rear-user-comparison.png')
(out/'preview-provenance.json').write_text(json.dumps({'sideTransforms':records,'beforeAfterCameraEqual':True,'renderer':audits[1]['renderer'],'samples':audits[1]['samples'],'sourceHashes':audits[1]['sourceHashes'],'sideView':sideviews[1],'rearView':rearviews[1],'rearTransforms':reartransforms,'photographCameraKnown':False,'photographRetouched':False,'sideCaption':'Uniform scale / wheelbase alignment only; original reference attitude retained; not an exact photograph camera match.'},indent=2,ensure_ascii=False)+'\n')
print(out/'tail-down-side-user-comparison.png');print(out/'tail-down-rear-user-comparison.png')
