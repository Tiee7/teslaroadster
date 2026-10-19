"""Side-by-side labeled baseline/candidate source renders, with no image retouching."""
from PIL import Image
import os, sys, json
baseline,candidate,out=map(os.path.abspath,sys.argv[1:4]);os.makedirs(out,exist_ok=True)
audits=[json.load(open(os.path.join(folder,'render-audit.json'))) for folder in [baseline,candidate]]
for key in ['renderer','samples','colorConversion','renderedViews']:
 if audits[0].get(key)!=audits[1].get(key):raise RuntimeError('Unmatched baseline/candidate render settings: '+key)
views=['front-three-quarter','rear-three-quarter','side','front','rear']
frames=[]
for name in views:
 a=Image.open(os.path.join(baseline,name+'.png')).convert('RGB');b=Image.open(os.path.join(candidate,name+'.png')).convert('RGB')
 if a.size!=b.size:raise RuntimeError('Baseline/candidate resolution mismatch')
 pair=Image.new('RGB',(a.width*2,a.height),'#f3f4f5');pair.paste(a,(0,0));pair.paste(b,(a.width,0))
 pair.save(os.path.join(out,'comparison-'+name+'.png'));frames.append(pair)
sheet=Image.new('RGB',(frames[0].width,frames[0].height*3),'#f3f4f5')
for i,frame in enumerate(frames[:3]):sheet.paste(frame,(0,frame.height*i))
sheet.save(os.path.join(out,'before-after-primary-views.png'))
print(os.path.join(out,'before-after-primary-views.png'))
