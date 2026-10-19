"""Compose supplied source photographs against genuine mesh previews.
Usage: python verification/compare-reference-photos.py MODEL_DIR OUTPUT_DIR REFERENCE_DIR
Original photographs are fitted without cropping, warping, recoloring or retouching.
"""
from PIL import Image, ImageDraw, ImageFont, ImageOps
import os,sys,json,hashlib
model,out,reference=map(os.path.abspath,sys.argv[1:4]);os.makedirs(out,exist_ok=True)
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';title=ImageFont.truetype(font,24);small=ImageFont.truetype(font,17)
rows=[('image(20261019-084437).png','front','Front reference / front inspection'),('image(20261019-084440).png','rear','Rear close 3/4 reference / rear inspection'),('image(20261019-084441).png','rear-three-quarter','Rear 3/4 reference / rear 3/4 inspection')]
W,H=1200,848;sheet=Image.new('RGB',(W*2,H*len(rows)+90),'#f3f4f5');d=ImageDraw.Draw(sheet)
d.text((24,12),'Source photographs versus actual model CPU previews',font=title,fill='#17202b')
d.text((24,48),'Cameras, focal lengths, pose and lighting differ. Shape reference only; this is not a pixel-matched or browser-rendered comparison.',font=small,fill='#505862')
provenance=[]
for row,(filename,view,description) in enumerate(rows):
 y=90+row*H
 for col,(file,label) in enumerate([(os.path.join(reference,filename),'Source photograph | '+description),(os.path.join(model,view+'-raw.png'),'Actual model preview | '+view.replace('-',' ')+' | Cycles CPU')]):
  tile=Image.new('RGB',(W,H),'#f3f4f5');td=ImageDraw.Draw(tile);td.text((20,10),label,font=small,fill='#17202b')
  td.text((20,36),filename if col==0 else 'Exact canonical Three.js meshes; neutral studio; original source geometry',font=small,fill='#505862')
  im=Image.open(file).convert('RGB');im=ImageOps.contain(im,(W,760),Image.Resampling.LANCZOS);tile.paste(im,((W-im.width)//2,70+(760-im.height)//2));sheet.paste(tile,(col*W,y))
  if col==0:provenance.append({'referenceFilename':filename,'sha256':hashlib.sha256(open(file,'rb').read()).hexdigest(),'pairedActualView':view,'comparisonLimit':'Different real photograph and CPU studio camera, pose and lighting; no direct pixel-equivalence claim.'})
 sheet.crop((0,y,W*2,y+H)).save(os.path.join(out,'reference-versus-actual-'+view+'.png'))
sheet.save(os.path.join(out,'reference-versus-actual-model.png'))
with open(os.path.join(out,'reference-comparison-provenance.json'),'w') as f:json.dump(provenance,f,indent=2)
print(os.path.join(out,'reference-versus-actual-model.png'))
