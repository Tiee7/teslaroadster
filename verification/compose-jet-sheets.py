"""Label exact CPU renders; no image generation or geometry/image retouching.
python3 verification/compose-jet-sheets.py /tmp/jet-effects-baseline /tmp/jet-effects-candidate /tmp/jet-modes
"""
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json,shutil,sys,hashlib
root=Path(__file__).resolve().parent.parent
out=root/'verification/jet-effects';out.mkdir(exist_ok=True)
baseline,candidate,modes=map(Path,sys.argv[1:4])
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';F=lambda n:ImageFont.truetype(font,n)
canvas=Image.new('RGB',(1000,1340),'#0b111b');d=ImageDraw.Draw(canvas);d.text((20,10),'Actual production meshes | CPU comparison | shader alpha approximated',font=F(20),fill='white')
for i,(folder,label) in enumerate([(baseline,'Before: persistent cone, blue annulus and stacked jet rings'),(candidate,'After: brief condensation wisps and one fading envelope per mouth')]):
 im=Image.open(folder/'effects-side-raw.png').convert('RGB');y=50+i*640;canvas.paste(im,(0,y+25));d.text((20,y),label,font=F(19),fill='#a4dcf4')
 name='before' if i==0 else 'after'
 for f in ['render-audit.json','manifest.json']:shutil.copy(folder/f,out/(name+'-'+f))
d.text((20,1320),'Not a WebGL/gameplay screenshot. Same studio camera, lighting and floor; source geometry unchanged.',font=F(15),fill='#cbd5e1');canvas.save(out/'cold-gas-before-after.png')
scenes=[('lift','Lift / jump / emergency support','effects-side'),('descent','Powered descent / top ports','effects-side'),('retro','Paid forward retro braking','effects-side'),('roll','Positive roll / shared top-bottom ports','effects-side'),('yaw','Positive yaw / opposing side ports','effects-three-quarter'),('strafe','Left strafe / both right-side outlets','effects-three-quarter')]
sheet=Image.new('RGB',(1280,1410),'#0b111b');d=ImageDraw.Draw(sheet);d.text((18,12),'Production outlet directions | CPU renders | shader alpha approximated',font=F(22),fill='white')
for i,(scene,title,view) in enumerate(scenes):
 folder=modes/scene;im=Image.open(folder/(view+'-raw.png')).convert('RGB').resize((640,397),Image.Resampling.LANCZOS);x=(i%2)*640;y=58+(i//2)*440;sheet.paste(im,(x,y+28));d.text((x+15,y),title,font=F(18),fill='#a4dcf4')
 for f in ['manifest.json','render-audit.json']:shutil.copy(folder/f,out/(scene+'-'+f))
d.text((18,1380),'Flight views use a disclosed 1.6 m studio elevation. Not browser screenshots or FPS evidence.',font=F(17),fill='#cbd5e1');sheet.save(out/'cold-gas-mode-sheet.png')
classic=Image.open(modes/'classic/effects-side-raw.png').convert('RGB');c=Image.new('RGB',(1000,675),'#0b111b');c.paste(classic,(0,38));dc=ImageDraw.Draw(c);dc.text((18,10),'Classic exterior | production mesh CPU render | alpha approximated',font=F(21),fill='white');dc.text((18,655),'Same effect implementation, separately aligned classic rear and auxiliary mouths.',font=F(17),fill='#cbd5e1');c.save(out/'cold-gas-classic.png')
for f in ['manifest.json','render-audit.json']:shutil.copy(modes/'classic'/f,out/('classic-'+f))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
photos=[]
for folder in [baseline,candidate]+[modes/s for s,_,_ in scenes]+[modes/'classic']:
 manifest=json.loads((folder/'manifest.json').read_text());audit=json.loads((folder/'render-audit.json').read_text())
 if manifest['effectImplementation']=='candidate':
  for filename,expected in manifest['sources'].items():assert sha(root/'src'/filename)==expected,(filename,'stale render source')
 if manifest['studioHeight']>0:assert manifest['boundsThree']['min'][1]>.5,'elevated studio root matrix was not applied'
 photos.append({'implementation':manifest['effectImplementation'],'model':manifest['model'],'scenario':manifest['scenario'],'studioHeight':manifest['studioHeight'],'sources':manifest['sources'],'renders':[{'file':v['file'],'sha256':sha(folder/v['file']),'camera':v}for v in audit['renderedViews']]})
provenance={'method':'Exact Three r128 live mesh export, Blender Cycles CPU, vertex-sampled GLSL alpha approximation. Labels, layout and downsampling only; no generated/retouched imagery.','limits':'Not WebGL screenshots, shader compilation verification or rendering-FPS evidence.','photos':photos,'sheets':{p.name:sha(p)for p in out.glob('*.png')}}
(out/'render-evidence.json').write_text(json.dumps(provenance,indent=2)+'\n')
print('Source-matched CPU sheets ready:',out)
