#!/usr/bin/env python3
from pathlib import Path
import argparse
parser=argparse.ArgumentParser()
parser.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[3])
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args();root=args.repo.resolve()
import json,hashlib,ctypes as C,importlib.machinery
import numpy as np
from PIL import Image,ImageDraw
p=args.output.resolve()
cap=json.loads((p/'capture-1.json').read_text());w,h=cap['width'],cap['height'];cam=cap['camera'];proj=np.array(cam['projectionMatrix']).reshape(4,4,order='F');world=np.array(cam['matrixWorld']).reshape(4,4,order='F');view=np.linalg.inv(world);y=cam['groundY'];images={a:np.asarray(Image.open(p/f'paver-{a}.png')).astype(float) for a in [1,4,8]};gray={a:im[:,:,:3]@[.2126,.7152,.0722] for a,im in images.items()}
def project(v):
 q=proj@view@np.array([*v,1]);q/=q[3];return [(q[0]+1)*w/2,(1-q[1])*h/2]
def rowpoint(row,col):
 q=np.linalg.inv(proj)@np.array([(col+.5)*2/w-1,1-(row+.5)*2/h,1,1]);q/=q[3];q=world@q;origin=world[:3,3];d=q[:3]-origin;return origin+d*(y-origin[1])/d[1]
rows=[]
for z in [5,10,15,20,30,40,50,75,100,150,200]:
 row=int(round(project([0,y,-z])[1]-.5));point=rowpoint(row,w/2-.5);cols=np.arange(w//4,3*w//4);xs=np.array([rowpoint(row,float(c))[0] for c in cols]);freq=2*np.pi*xs/.6;A=np.stack([np.ones(len(cols)),np.linspace(-1,1,len(cols)),np.cos(freq),np.sin(freq)],axis=1);measure={}
 for a in [1,4,8]:
  values=gray[a][row,cols];fit=np.linalg.lstsq(A,values,rcond=None)[0];measure[str(a)]={'meanLuminance':float(values.mean()),'rowStdDev':float(values.std()),'mortarFundamentalAmplitude':float(np.hypot(fit[2],fit[3])),'mortarFundamentalPeakToPeak':float(2*np.hypot(fit[2],fit[3]))}
 rows.append({'targetForwardMetres':z,'actualForwardMetresAtPixelRow':float(-point[2]),'pixelRow':row,'jointPeriodPixels':float(.6/(xs[1]-xs[0])),'measurements':measure})
# Exact recorded command comparison: only additional anisotropy sampler call may differ.
captures={a:json.loads((p/f'capture-{a}.json').read_text()) for a in [1,4,8]}
def no_aniso(commands):return [c for c in commands if not(c['op']=='texParameterf' and c['args'][1]==34046)]
commandSame=all(no_aniso(captures[1]['commands'])==no_aniso(captures[a]['commands']) for a in [4,8])
textureSame=len({captures[a]['texture']['rgbaSha256'] for a in [1,4,8]})==1
mod=importlib.machinery.SourceFileLoader('egl',str(root/'verification/render-instance-20261022/egl-replay.py')).load_module();g=mod.EGL(8,8);maxA=C.c_float();g.gl('glGetFloatv',None,C.c_uint,C.POINTER(C.c_float))(0x84FF,C.byref(maxA));native={'renderer':g.string(0x1F01),'version':g.string(0x1F02),'anisotropyExtension':'GL_EXT_texture_filter_anisotropic' in g.string(0x1F03).split(),'maxAnisotropy':maxA.value};g.close()
report={'scope':cap['scope'],'nativeCapabilities':native,'sameTextureRgbaBytes':textureSame,'sameCommandStreamExceptAnisotropySampler':commandSame,'sameCameraGeometryUvsMipmapsMaterialShaderLighting':commandSame,'rows':rows,'limitations':['Isolated original paver patch, not full coast render','Software GL/native r128, not browser or physical device; no performance claim','No on-demand texture fetch or late mesh activation was exercised; result diagnoses minification not streaming','Anisotropy cannot recover joint detail beyond display pixel resolution; physically unresolvable distant mortar still fades']}
(p/'evidence.json').write_text(json.dumps(report,indent=2))
# Paired native pixels, untouched renders plus plain labels in separate canvas.
pair=Image.new('RGB',(w*2,h+44),'#17283c');d=ImageDraw.Draw(pair);d.text((16,12),'A: original anisotropy 1 - trilinear mipmaps',fill='white');d.text((w+16,12),'B: original bytes + anisotropy 8 - trilinear mipmaps',fill='white');pair.paste(Image.open(p/'paver-1.png').convert('RGB'),(0,44));pair.paste(Image.open(p/'paver-8.png').convert('RGB'),(w,44));pair.save(p/'paver-1-vs-8-paired.png')
# Pixel-for-pixel band crop for easy viewing, not rescaled or re-rendered.
y0,y1=370,590;crop=Image.new('RGB',(w*2,y1-y0+44),'#17283c');d=ImageDraw.Draw(crop);d.text((16,12),f'A anisotropy 1 - native rows {y0}-{y1}',fill='white');d.text((w+16,12),f'B anisotropy 8 - native rows {y0}-{y1}',fill='white');crop.paste(Image.open(p/'paver-1.png').crop((0,y0,w,y1)).convert('RGB'),(0,44));crop.paste(Image.open(p/'paver-8.png').crop((0,y0,w,y1)).convert('RGB'),(w,44));crop.save(p/'distance-band-1-vs-8.png')
# Recreate compact supported/unsupported boundary evidence from recorded calls and pixels.
boundary={}
for case,reference in [('cap4','4'),('unsupported','1')]:
 c=json.loads((p/f'capture-{case}.json').read_text());r=json.loads((p/f'replay-{case}.json').read_text());ref=json.loads((p/f'replay-{reference}.json').read_text())
 boundary[case]={'requestedAnisotropy':c['options']['anisotropy'],'reportedNativeR128Capability':c['reportedMaxAnisotropy'],'effectiveAnisotropy':c['effectiveAnisotropy'],'expectedMatch':reference,'samePixels':r['rgbaSha256']==ref['rgbaSha256'],'sameCommands':c['commands']==json.loads((p/f'capture-{reference}.json').read_text())['commands'],'glErrors':r['glErrors'],'failures':r['failures'],'note':'Simulated WebGL capability facade; replay is native Mesa with no unsupported anisotropy operation'}
base=(root/'tests/fixtures/weather-ground-traffic-baseline/coast-map.js').read_bytes();basehash=hashlib.sha256(base).hexdigest()
boundary['sourceCommit']={'commit':'4451a11c9c09d031a9da037ce63afe4bb7f062e5','coastSha256':basehash,'capturedCoastSha256':cap['productionCoastSha256'],'same':basehash==cap['productionCoastSha256']}
boundary['textureRgbaSha256']=cap['texture']['rgbaSha256'];(p/'capability-boundary.json').write_text(json.dumps(boundary,indent=2))
# Compact independent replay manifest; no raw command buffers or image bytes.
manifest={}
for case in ['1','4','8','cap4','unsupported']:
 c=json.loads((p/f'capture-{case}.json').read_text());r=json.loads((p/f'replay-{case}.json').read_text())
 manifest[case]={'rgbaSha256':r['rgbaSha256'],'pngSha256':r['pngSha256'],'sourceSha256':c['productionCoastSha256'],'textureSha256':c['texture']['rgbaSha256'],'runtimeSha256':c['runtimeSha256'],'effectiveAnisotropy':c['effectiveAnisotropy'],'drawCalls':r['drawCalls'],'triangles':r['triangles'],'shaders':r['shaders'],'glErrors':r['glErrors'],'failures':r['failures']}
(p/'replay-manifest.json').write_text(json.dumps(manifest,indent=2))
assert commandSame and textureSame and boundary['sourceCommit']['same']
assert native['anisotropyExtension'] and native['maxAnisotropy']>=8
assert [manifest[k]['effectiveAnisotropy'] for k in ['1','4','8','cap4','unsupported']]==[1,4,8,4,1]
assert cap['texture']['rgbaSha256']=='cdb3fba211e4235586d1279c8ca4a373b1ab7cbe230da98d9e385a6f1c1d8aca'
assert all(boundary[k]['samePixels'] and boundary[k]['sameCommands'] for k in ['cap4','unsupported'])
assert all(not m['glErrors'] and not m['failures'] for m in manifest.values())
print(json.dumps({'native':native,'sameTexture':textureSame,'onlySamplerDifferent':commandSame,'capabilityBoundariesPass':True,'manifest':'replay-manifest.json'},indent=2))
