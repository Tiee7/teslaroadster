import pathlib,json,hashlib
from PIL import Image,ImageDraw,ImageFont
base=pathlib.Path('verification/npc-traffic');root=base/'previews'
manifest=json.load(open(base/'asset-audit.json'))
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
small=ImageFont.truetype(font,16);big=ImageFont.truetype(font,25);label=ImageFont.truetype(font,19)
variants=manifest['variants']
def describe(v,i):
 if v['id'].startswith('legacy-'):return f'{i+1:02}. '+v['id']
 entry=v['entries'][0].replace('frozen-','').replace(':originalSources/vehicles.js','')
 return f'{i+1:02}. {entry}'
for level in ['near','far']:
 w,h=640,252;canvas=Image.new('RGB',(w*3,h*5+85),'#e7e8eb');draw=ImageDraw.Draw(canvas)
 draw.text((20,13),f'Random NPC models | {level} detail | 15 geometric styles',font=big,fill='#182133')
 draw.text((20,48),'Actual packed runtime geometry. Blender Cycles CPU, FrontSide culling. Original archive mapping below.',font=small,fill='#384459')
 for i,v in enumerate(variants):
  x=(i%3)*w;y=(i//3)*h+85
  for n,name in enumerate(['front-three-quarter','rear-three-quarter']):
   image=Image.open(root/v['id']/level/(name+'-raw.png')).convert('RGB').resize((320,200),Image.Resampling.LANCZOS);canvas.paste(image,(x+n*320,y))
  draw.text((x+9,y+204),describe(v,i),font=small,fill='#111c2c')
  d=v['levels'][level];draw.text((x+9,y+226),f"{d['triangles']:,} triangles | {d['draws']} shared batches | no shadow draws",font=small,fill='#41506a')
 file=base/(level+'-contact-sheet.png');canvas.save(file,optimize=True)
# Straight rear inspection exposes any see-through transom or wrong-sided cap.
w,h=384,285;canvas=Image.new('RGB',(w*5,h*3+70),'#e7e8eb');draw=ImageDraw.Draw(canvas)
draw.text((18,15),'Rear closure check | near detail | actual CPU-rendered NPC meshes',font=big,fill='#182133')
for i,v in enumerate(variants):
 x=(i%5)*w;y=(i//5)*h+70
 image=Image.open(root/v['id']/'near'/'rear-raw.png').convert('RGB').resize((384,240),Image.Resampling.LANCZOS);canvas.paste(image,(x,y))
 text=describe(v,i)
 if len(text)>42:text=text[:39]+'...'
 draw.text((x+7,y+246),text,font=small,fill='#182133')
canvas.save(base/'rear-closure-contact-sheet.png',optimize=True)
audits=[];source_hash=hashlib.sha256(pathlib.Path('src/npc-traffic-assets.js').read_bytes()).hexdigest()
scope_path=base/'legacy-lod-fix-scope.json';scope=json.load(open(scope_path))if scope_path.exists()else None
unchanged=set(v['id']for v in scope['unmodifiedHistoricalStyles'])if scope else set()
if scope and scope['afterAssetSha256']!=source_hash:raise RuntimeError('Stale legacy-fix scope proof')
for v in variants:
 for level in ['near','far']:
  folder=root/v['id']/level;j=json.load(open(folder/'render-audit.json'));data=json.load(open(folder/'actual-preview-meshes.json'))
  if j['sourceHashes']!=data['sources']:raise RuntimeError('Stale render '+str(folder))
  reused=data['sources']['trafficAssets']!=source_hash
  metadata_path=base/'metadata-fingerprint-equivalence.json';metadata=json.load(open(metadata_path))if metadata_path.exists()else None
  metadata_match=bool(metadata and metadata['afterAssetSha256']==source_hash and metadata['geometryPoolByteIdentical'] and data['sources']['trafficAssets']==metadata['beforeAssetSha256'] and v['id']in metadata['styles'])
  historical_match=bool(scope and v['id']in unchanged and data['sources']['trafficAssets']==scope['beforeAssetSha256'])
  if reused and not(metadata_match or historical_match):raise RuntimeError('Unproven old render '+str(folder))
  if j['normalWindingDisagreements'] or j['missingNormals']:raise RuntimeError('Normals failed '+str(folder))
  if len(j['renderedViews'])!=3:raise RuntimeError('Missing view '+str(folder))
  audits.append({'id':v['id'],'level':level,'renderer':j['renderer'],'samples':j['samples'],'denoising':j.get('denoising'),'meshCount':j['meshCount'],'triangleCount':j['triangleCount'],'missingNormals':j['missingNormals'],'normalWindingDisagreements':j['normalWindingDisagreements'],'renderedViews':j['renderedViews'],'assetSha256':data['sources']['trafficAssets'],'liveAssetSha256':source_hash,'reusedExactUnchangedGeometry':reused})
files={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in base.glob('*contact-sheet.png')}
json.dump({'pass':True,'liveAssetSha256':source_hash,'unchangedGeometryProof':'legacy-lod-fix-scope.json'if scope else None,'actualPackedRuntimeGeometry':True,'variants':len(variants),'lods':2,'viewsPerLod':3,'totalCpuRenders':len(audits)*3,'contactSheets':files,'audits':audits},open(base/'render-result.json','w'),indent=2)
print(json.dumps({'pass':True,'totalCpuRenders':len(audits)*3,'contactSheets':files},indent=2))
