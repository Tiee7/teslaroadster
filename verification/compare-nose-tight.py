"""Disclosed, uniformly scaled tight side comparison; no mirroring or reshaping."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib, json, sys

before, after, original = map(Path, sys.argv[1:4])
audits = [json.loads((p / 'render-audit.json').read_text()) for p in (before, after)]
views = [next(v for v in a['renderedViews'] if v['name'] == 'reference-side-left') for a in audits]
for key in ('cameraPositionBlender', 'targetBlender', 'projection', 'orthographicScale', 'resolution', 'shiftX', 'shiftY'):
    assert views[0].get(key) == views[1].get(key), key
for key in ('samples', 'colorConversion', 'renderer'):
    assert audits[0][key] == audits[1][key], key
fontfile = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
assert Path(fontfile).exists(), 'CJK font required'
title, small = ImageFont.truetype(fontfile, 31), ImageFont.truetype(fontfile, 20)
wheelbase = 580.0
model_front, model_rear = views[0]['projectedLandmarks']['frontWheel'][0], views[0]['projectedLandmarks']['rearWheel'][0]
specs = [
    {'label': '参考', 'file': original, 'crop': [44, 296, 500, 432], 'wheelCentersX': [134.0, 398.0], 'groundY': 419.0, 'landmarkMethod': 'Approximate wheel centers measured in supplied photograph'},
    {'label': '上一版', 'file': before / 'reference-side-left-raw.png', 'crop': [42, 303, 501, 432], 'wheelCentersX': [model_front, model_rear], 'groundY': views[0]['projectedLandmarks']['ground'][1], 'landmarkMethod': 'Exact camera projection of model axle landmarks'},
    {'label': '新候选', 'file': after / 'reference-side-left-raw.png', 'crop': [57, 303, 501, 432], 'wheelCentersX': [model_front, model_rear], 'groundY': views[1]['projectedLandmarks']['ground'][1], 'landmarkMethod': 'Exact camera projection of model axle landmarks'},
]
width, rowheight = 1100, 370
sheet = Image.new('RGB', (width, 3 * rowheight + 76), '#f3f4f5')
provenance = []
for row, spec in enumerate(specs):
    path, crop = spec['file'], spec['crop']
    source = Image.open(path).convert('RGB'); assert source.size == (550, 688)
    scale = wheelbase / (spec['wheelCentersX'][1] - spec['wheelCentersX'][0])
    x = 880.0 - (spec['wheelCentersX'][1] - crop[0]) * scale
    y = 330.0 - (spec['groundY'] - crop[1]) * scale
    # This inverse affine contains one identical scale for X/Y and translation only.
    # It implements exact uniform resampling without integer-size aspect drift.
    inverse = (1 / scale, 0, -x / scale, 0, 1 / scale, -y / scale)
    panel = source.crop(tuple(crop)).transform((width, rowheight), Image.Transform.AFFINE,
            inverse, resample=Image.Resampling.BICUBIC, fillcolor='#f3f4f5')
    ImageDraw.Draw(panel).text((22, 7), spec['label'], font=title, fill='#17202b')
    sheet.paste(panel, (0, row * rowheight))
    provenance.append({**{k: v for k, v in spec.items() if k != 'file'}, 'file': str(path),
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'uniformScaleXY': scale,
        'pasteTranslation': [x, y], 'inverseAffine': inverse, 'outputWheelbasePixels': wheelbase,
        'outputRearWheelCenterX': 880, 'outputGroundYWithinRow': 330})
draw = ImageDraw.Draw(sheet)
draw.text((22, 3 * rowheight + 7), '统一裁切、等比缩放，对齐轴距；照片未镜像、未改形。', font=small, fill='#505862')
draw.text((22, 3 * rowheight + 36), f'近似侧视相机；模型为实际网格 CPU 预览（{audits[1]["samples"]} 采样），与照片光照不同。', font=small, fill='#505862')
out = after / 'nose-tight-side-comparison.png'; sheet.save(out)
metadata = {'output': out.name, 'sourcePhotoSha256': provenance[0]['sha256'], 'font': fontfile,
            'transforms': provenance, 'normalization': 'Uniform XY scale to 580px wheelbase; rear axle X and ground Y aligned',
            'resampling': 'Bicubic uniform affine scale and translation only', 'mirrored': False,
            'photographRetouchedOrReshaped': False, 'approximatePhotographCamera': True,
            'originalNativeComparisonsPreserved': True, 'cameraEqualityVerifiedForActualBeforeAfter': True,
            'finalSourceHashes': audits[1]['sourceHashes']}
(after / 'nose-tight-side-comparison-provenance.json').write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + '\n')
print(out)
