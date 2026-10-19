"""Pixel-preserving matched top/side before-after inspection sheet."""
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json,sys
before,after,out=map(Path,sys.argv[1:4]);out.mkdir(parents=True,exist_ok=True)
audits=[json.loads((d/'render-audit.json').read_text()) for d in [before,after]]
for key in ['renderer','samples','colorConversion']:assert audits[0][key]==audits[1][key],key
camera_keys=['cameraPositionBlender','targetBlender','projection','focalLengthMm','orthographicScale','resolution','rollDegrees','shiftX','shiftY']
for name in ['top','side']:
 records=[next(v for v in a['renderedViews'] if v['name']==name) for a in audits]
 for key in camera_keys:assert records[0].get(key)==records[1].get(key),(name,key)
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';title=ImageFont.truetype(font,24);small=ImageFont.truetype(font,18)
W,H=1200,840;sheet=Image.new('RGB',(2*W,80+2*H),'#f3f4f5');d=ImageDraw.Draw(sheet)
d.text((24,10),'Actual mesh window comparison | unchanged inspection cameras and studio lighting',font=title,fill='#17202b')
d.text((24,43),'16-sample Cycles CPU. Source photographs use different cameras and lighting. Render pixels below are copied without resizing or retouching.',font=small,fill='#505862')
for row,(name,label) in enumerate([('top','Top inspection | front points right'),('side','Side inspection')]):
 for col,(folder,stage) in enumerate([(before,'Before | frozen baseline 1bf6034'),(after,'After | window-only candidate')]):
  raw=Image.open(folder/(name+'-raw.png')).convert('RGB');assert raw.size==(W,760)
  x,y=col*W,80+row*H;d.text((x+22,y+12),stage+' | '+label,font=title,fill='#17202b');d.text((x+22,y+43),'Actual canonical Three.js meshes | CPU studio preview',font=small,fill='#505862');sheet.paste(raw,(x,y+80))
sheet.save(out/'window-before-after-top-side.png')
metadata={'before':str(before),'after':str(after),'matchedViews':['top','side'],'sameCameraSettingsVerified':True,'sameSamples':audits[0]['samples'],'sameColorConversion':True,'imagePixelsResizedOrRetouched':False,'photographLimit':'Original reference photographs have different cameras, scale and lighting.'};(out/'window-comparison.json').write_text(json.dumps(metadata,indent=2)+'\n');print(out/'window-before-after-top-side.png')
