"""Two compact Chinese-labeled review sheets with disclosed uniform transforms."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib,json,sys
before,after,photo=map(Path,sys.argv[1:4])
font='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';head=ImageFont.truetype(font,29);small=ImageFont.truetype(font,20)
specs=[('参考',photo,(0,160,1205,720)),('上一版',before/'rear-inspection-three-quarter-raw.png',(70,190,1155,640)),('新候选',after/'rear-inspection-three-quarter-raw.png',(70,190,1155,640))]
sheet=Image.new('RGB',(2160,540),'#f3f4f5');d=ImageDraw.Draw(sheet);transforms=[]
for col,(label,path,crop) in enumerate(specs):
    im=Image.open(path).convert('RGB');source_size=im.size;im=im.crop(crop)
    scale=690/im.width;x=col*720+15;y=452-im.height*scale
    inverse=(1/scale,0,-x/scale,0,1/scale,-y/scale)
    panel=im.transform(sheet.size,Image.Transform.AFFINE,inverse,resample=Image.Resampling.BICUBIC,fillcolor='#f3f4f5')
    # Only this column is pasted, preserving previously composed panels.
    sheet.paste(panel.crop((col*720,0,(col+1)*720,470)),(col*720,0))
    d=ImageDraw.Draw(sheet);d.text((col*720+18,8),label,font=head,fill='#17202b')
    d.text((col*720+18,49),'原照片 084441' if col==0 else '实际网格 CPU · 相同检查相机/补光',font=small,fill='#505862')
    transforms.append({'label':label,'file':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'originalDimensions':source_size,'crop':crop,'uniformScaleXY':scale,'pasteTranslation':[x,y],'inverseAffine':inverse})
d.text((18,477),'仅裁切、等比缩放；参考照片未镜像、未改形，原有字幕未修除。',font=small,fill='#505862')
d.text((18,508),'相机为近似检查视角，照片光照不同；模型 16 采样，尾翼为构建预览姿态。',font=small,fill='#505862')
sheet.save(after/'rear-three-quarter-tight-user-comparison.png')

crop=(255,180,910,555);scale=1.4;cw,ch=917,525
pane=Image.new('RGB',(cw*2,ch+170),'#f3f4f5');d=ImageDraw.Draw(pane)
for col,(folder,label) in enumerate([(before,'上一版'),(after,'新候选 · 仅前挡改为平面')]):
    path=folder/'windshield-inspection-raw.png';im=Image.open(path).convert('RGB').crop(crop)
    im=im.resize((cw,ch),Image.Resampling.LANCZOS);pane.paste(im,(col*cw,90))
    d.text((col*cw+18,10),label,font=head,fill='#17202b');d.text((col*cw+18,51),'实际网格 CPU · 同相机/光照 · 等比裁切放大',font=small,fill='#505862')
projection=json.loads((after/'front-pane-boundary-projection.json').read_text())
points=[(cw+(c['pixel'][0]-crop[0])*scale,90+(c['pixel'][1]-crop[1])*scale) for c in projection.get('boundarySamples',projection['corners'])]
d.line(points+[points[0]],fill='#1677c8',width=3)
d.text((18,ch+103),'仅前挡风玻璃调整为单一斜平面；车顶与侧窗保留原造型。',font=small,fill='#505862')
d.text((18,ch+135),'蓝线为实际前挡边界的相机投影标注；反光不是几何测量，原始预览图另存。',font=small,fill='#505862')
pane.save(after/'front-windshield-tight-user-comparison.png')
metadata={'rearSheetTransforms':transforms,'rearPhotoMirroredReshapedOrRetouched':False,
          'paneCropBoth':crop,'paneUniformScaleXY':scale,'paneProjectionSource':'front-pane-boundary-projection.json',
          'paneAnnotation':'Blue line on candidate sheet only traces the full exact actual front-pane boundary mesh vertices projected through the unchanged inspection camera.',
          'frontPaneScope':'Front windshield only; roof/side-window design retained. No whole-canopy flattening claim.',
          'rawRenderPixelsPreservedSeparately':True,'samples':16,'cameraAndLightingEqualityProof':'inspection-comparison-provenance.json'}
(after/'user-sheets-crop-projection-provenance.json').write_text(json.dumps(metadata,indent=2,ensure_ascii=False)+'\n')
print(after/'rear-three-quarter-tight-user-comparison.png');print(after/'front-windshield-tight-user-comparison.png')
