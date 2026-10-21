"""CPU inspection of actual original DataTexture pixels, not a WebGL exposure test."""
import base64,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
families=json.loads(Path('/tmp/tesla-original-city-facades.json').read_text())
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
sheet=Image.new('RGB',(1100,790),'#111827');d=ImageDraw.Draw(sheet)
d.text((18,12),'Actual original procedural facade pixels — CPU inspection, NOT game/WebGL screenshot',fill='white',font=font)
d.text((18,38),'Window repetition 3.6m; flat daytime base-colour product only, no lighting/shadow/exposure evaluation.',fill='#a8bacb',font=small)
for i,v in enumerate(families):
    atlas=Image.frombytes('RGBA',(128,128),base64.b64decode(v['pixels'])).convert('RGB')
    tint=v['tint'];day=[0xc3/255,0xc8/255,0xcc/255]
    atlas=Image.eval(atlas,lambda x:x)
    out=Image.new('RGB',(320,190));pix=atlas.load();dest=out.load()
    # A36m-wide x21.4m-high frontage, /7.2 UVs, sampled from actual atlas.
    for y in range(190):
        for x in range(320):
            c=pix[int(x/320*36/7.2*128)%128,int((1-y/190)*21.4/7.2*128)%128]
            dest[x,y]=tuple(round(c[k]*tint[k]*day[k]) for k in range(3))
    left=18+(i%3)*366;top=94+(i//3)*335
    d.text((left,top-25),v['family'],fill='white',font=font);sheet.paste(out,(left,top))
    thumb=atlas.resize((92,92),Image.Resampling.NEAREST);sheet.paste(thumb,(left,top+204));d.text((left+104,top+218),'128x128 stored tile',fill='#b1c5d6',font=small)
    d.text((left+104,top+242),'Original pixels, not copied assets',fill='#b1c5d6',font=small)
sheet.save(Path(__file__).with_name('original-facade-pixels.png'))
