"""Original / frozen baseline / candidate window evidence, with disclosed crops/scales."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,math,hashlib,sys
baseline,candidate,reference=map(Path,sys.argv[1:4]);out=candidate
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';title=ImageFont.truetype(font,24);label=ImageFont.truetype(font,21);small=ImageFont.truetype(font,16)
W=800;rowH=500;head=110;sheet=Image.new('RGB',(2400,head+2*rowH+880),'#f3f4f5');d=ImageDraw.Draw(sheet)
d.text((22,12),'Original references / frozen 1bf6034 baseline / current crown candidate',font=title,fill='#17202b')
d.text((22,46),'Actual mesh CPU previews. Photographs have different cameras and lighting. Only the stated crop and uniform resize are applied.',font=small,fill='#505862')
for col,text in enumerate(['SOURCE PHOTOGRAPH','BEFORE | frozen 1bf6034','AFTER | current crown candidate']):d.text((col*W+22,78),text,font=label,fill='#17202b')
audits=[json.loads((p/'render-audit.json').read_text()) for p in [baseline,candidate]]
for view in ['top','side','rear-three-quarter']:
 records=[next(v for v in a['renderedViews'] if v['name']==view) for a in audits]
 for key in ['cameraPositionBlender','targetBlender','projection','focalLengthMm','orthographicScale','resolution','rollDegrees','shiftX','shiftY']:assert records[0].get(key)==records[1].get(key),(view,key)
assert audits[0]['samples']==audits[1]['samples']==16
body=[next(v for v in a['renderedViews'] if v['name']=='top')['projectedBodyBounds'] for a in audits]
topbox=(math.floor(min(v['min'][0] for v in body))-20,math.floor(min(v['min'][1] for v in body))-20,math.ceil(max(v['max'][0] for v in body))+20,math.ceil(max(v['max'][1] for v in body))+20)
topscale=720/body[0]['size'][0]
projection=json.loads((candidate/'window-crop-projection.json').read_text());values=list(projection.values());windowbox=(math.floor(min(v['min'][0] for v in values))-20,math.floor(min(v['min'][1] for v in values))-20,math.ceil(max(v['max'][0] for v in values))+20,math.ceil(max(v['max'][1] for v in values))+20);windowscale=720/(windowbox[2]-windowbox[0])
provenance=[]
def put(row,col,path,box,scale,first,second):
 im=Image.open(path).convert('RGB').crop(box);size=(round(im.width*scale),round(im.height*scale));im=im.resize(size,Image.Resampling.LANCZOS)
 assert size[0]<=W and size[1]<=400
 x,y=col*W,head+row*rowH;d.text((x+20,y+12),first,font=label,fill='#17202b');d.text((x+20,y+43),second,font=small,fill='#505862');d.text((x+20,y+67),f'Crop {box}; uniform scale {scale:.4f}x',font=small,fill='#505862');sheet.paste(im,(x+(W-size[0])//2,y+100+(400-size[1])//2))
 provenance.append({'row':row,'column':col,'sourceFilename':str(path),'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'cropBox':list(box),'uniformScale':scale,'resizedDimensions':list(size),'retouching':False})
put(0,0,reference/'image(20261019-084438).png',(197,225,511,373),720/294,'Aerial 084438 | car crop enlarged','Approximate body length 720 px; original pixels')
for col,folder in enumerate([baseline,candidate],1):put(0,col,folder/'top-raw.png',topbox,topscale,'Actual top | front points right','Same 16-sample camera; body length 720 px')
put(1,0,reference/'image(20261019-084441).png',(335,145,1155,365),720/820,'Window region 084441 | crop enlarged','Different photograph camera, scale and lighting')
for col,folder in enumerate([baseline,candidate],1):put(1,col,folder/'rear-three-quarter-raw.png',windowbox,windowscale,'Actual rear 3/4 | same window crop','Matched before/after camera; photograph differs')
sheet.crop((0,0,2400,head+2*rowH)).save(out/'window-source-baseline-candidate.png')
y=head+2*rowH;d.text((22,y+14),'Pure side before/after | same camera, lighting and 16 samples | native render pixels',font=title,fill='#17202b')
for col,(folder,text) in enumerate([(baseline,'BEFORE | frozen baseline'),(candidate,'AFTER | current crown candidate')]):
 d.text((col*1200+22,y+52),text,font=label,fill='#17202b');im=Image.open(folder/'side-raw.png').convert('RGB');assert im.size==(1200,760);sheet.paste(im,(col*1200,y+100))
sheet.save(out/'window-originals-baseline-candidate-with-side.png')
side=sheet.crop((0,y,2400,y+880));side.save(out/'window-before-after-side-native.png')
metadata={'matchedActualCamerasVerified':['top','side','rear-three-quarter'],'samples':16,'originalPhotographsUnretouched':True,'transforms':'Disclosed rectangular crops and uniform Lanczos resize only; no warp, redraw, color adjustment or reconstruction. Native side render pixels copied directly.','photographCameraLimit':'Photograph cameras, perspective, scale and lighting differ from actual mesh inspection cameras.','topBodyLengthPx':720,'sourceTopBodyLengthBasisPx':294,'cells':provenance};(out/'original-comparison-provenance.json').write_text(json.dumps(metadata,indent=2)+'\n');print(out/'window-originals-baseline-candidate-with-side.png')
