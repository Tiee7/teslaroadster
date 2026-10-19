"""Label actual CPU mesh renders and create a contact sheet, without altering imagery."""
from PIL import Image, ImageDraw, ImageFont
import json, os, sys
folder=os.path.abspath(sys.argv[1])
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
f=ImageFont.truetype(font,22);small=ImageFont.truetype(font,16)
views=[('front-three-quarter','Front 3/4'),('rear-three-quarter','Rear 3/4'),('side','Side'),('front','Front'),('rear','Rear')]
with open(os.path.join(folder,'manifest.json')) as h:manifest=json.load(h)
for name,label in views:
 raw=Image.open(os.path.join(folder,name+'-raw.png')).convert('RGB')
 canvas=Image.new('RGB',(raw.width,raw.height+88),'#f3f4f5');canvas.paste(raw,(0,70))
 d=ImageDraw.Draw(canvas);d.text((24,10),'Actual model preview | '+label,font=f,fill='#1b2330')
 d.text((24,40),'Exact Three.js canonical meshes | Blender Cycles CPU studio | '+os.path.basename(folder),font=small,fill='#505862')
 canvas.save(os.path.join(folder,name+'.png'))
W,H=1200,848
sheet=Image.new('RGB',(W*2,H*3),'#f3f4f5')
for i,(name,_) in enumerate(views):sheet.paste(Image.open(os.path.join(folder,name+'.png')),(i%2*W,i//2*H))
d=ImageDraw.Draw(sheet);x,y=W+40,H*2+70
lines=['Actual model preview',str(manifest['meshCount'])+' visible source meshes',f"{manifest['triangleCount']:,} source triangles",'Official Three.js r'+manifest['runtimeRevision']+' scene export','Neutral white paint and dark glass','No remeshing or geometry redesign','Transparent effects and shadow proxies excluded','CPU studio render, not a browser screenshot','Source SHA-256 hashes and camera data included']
for i,line in enumerate(lines):d.text((x,y+i*45),line,font=f if i==0 else small,fill='#1b2330')
sheet.save(os.path.join(folder,'contact-sheet.png'))
print(os.path.join(folder,'contact-sheet.png'))
