"""Pair an untouched supplied front photograph with the actual optional front render."""
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import sys,json,hashlib
folder=Path(sys.argv[1]);reference=Path(sys.argv[2]);a=Image.open(reference).convert('RGB');b=Image.open(folder/'reference-front-raw.png').convert('RGB')
assert a.size==b.size==(1040,585)
audit=json.loads((folder/'render-audit.json').read_text());samples=audit['samples']
canvas=Image.new('RGB',(2080,675),'#f3f4f5');canvas.paste(a,(0,90));canvas.paste(b,(1040,90));d=ImageDraw.Draw(canvas);font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';f=ImageFont.truetype(font,22);small=ImageFont.truetype(font,16)
d.text((20,12),'Source photograph | first front reference 084437',font=f,fill='#17202b');d.text((20,45),'Original supplied image, unchanged',font=small,fill='#505862')
d.text((1060,12),'Actual model CPU preview | approximate matched front view',font=f,fill='#17202b');d.text((1060,45),f'Level perspective; estimated camera match; different studio lighting; {samples} samples',font=small,fill='#505862');canvas.save(folder/'reference-front-side-by-side.png')
metadata={'referenceFilename':reference.name,'referenceSha256':hashlib.sha256(reference.read_bytes()).hexdigest(),'referenceImagePreserved':True,'renderFilename':'reference-front-raw.png','label':'Approximate matched front camera, not an exact camera or lighting match','sourceDimensions':[1040,585],'renderDimensions':[1040,585],'renderSamples':samples};(folder/'reference-comparison.json').write_text(json.dumps(metadata,indent=2)+'\n');print(folder/'reference-front-side-by-side.png')
