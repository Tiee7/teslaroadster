"""Label exact functional target renders without altering original frames."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import json,sys
root=Path(sys.argv[1]);names=[('rest','静止'),('deployed','加速展开'),('flight','飞行'),('airbrake','空气制动')]
font='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';head=ImageFont.truetype(font,26);small=ImageFont.truetype(font,18)
sheet=Image.new('RGB',(2400,1776),'#f3f4f5');detail=Image.new('RGB',(2180,1216),'#f3f4f5')
audits=[];crop=(65,190,610,430)
for i,(name,label) in enumerate(names):
 folder=root/name;a=json.loads((folder/'render-audit.json').read_text());audits.append(a)
 pose=a['wingPose'];raw=Image.open(folder/'rear-inspection-three-quarter-raw.png').convert('RGB');assert raw.size==(1200,760)
 x,y=(i%2)*1200,(i//2)*850;d=ImageDraw.Draw(sheet)
 text=f'{label} | Y={pose["targets"]["y"]:.2f} m，俯仰 {pose["targets"]["angle"]:.2f} rad'
 d.text((x+20,y+10),text,font=head,fill='#17202b');d.text((x+20,y+49),'实际网格；原功能目标；相同相机/补光；16 采样',font=small,fill='#505862');sheet.paste(raw,(x,y+90))
 x,y=(i%2)*1090,(i//2)*570;d=ImageDraw.Draw(detail)
 d.text((x+18,y+10),text,font=head,fill='#17202b');d.text((x+18,y+49),'同一固定裁切，等比放大 2 倍；未镜像/未改形',font=small,fill='#505862')
 detail.paste(raw.crop(crop).resize((1090,480),Image.Resampling.LANCZOS),(x,y+90))
for a in audits[1:]:
 assert a['inspectionLighting']==audits[0]['inspectionLighting'];assert a['renderedViews']==audits[0]['renderedViews'];assert a['samples']==16
for im,y in [(sheet,1708),(detail,1148)]:
 d=ImageDraw.Draw(im);d.text((18,y),'静态功能目标检查，非驾驶动画实测；未改物理代码、模型顶点或材质。',font=small,fill='#505862');d.text((18,y+28),'实际旋转矩阵与原物理文件 SHA-256 见 functional-wing-pose-proof.json。',font=small,fill='#505862')
sheet.save(root/'functional-wing-poses-native.png');detail.save(root/'functional-wing-poses-tight.png')
(root/'functional-wing-sheet-provenance.json').write_text(json.dumps({'fixedCrop':crop,'uniformScale':2,'nativeFramesResizedOrRetouched':False,'tightSheetMirroredOrReshaped':False,'samples':16,'sameCameraAndLightingVerified':True},indent=2)+'\n')
print(root/'functional-wing-poses-tight.png')
