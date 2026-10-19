"""Matched native previews plus transparently scaled supplied-photo context."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, hashlib, sys

baseline, candidate, refs = map(Path, sys.argv[1:4])
audits = [json.loads((p / 'render-audit.json').read_text()) for p in (baseline, candidate)]
names = ['rear-inspection-three-quarter', 'rear-inspection-direct', 'windshield-inspection']
for key in ('samples', 'renderer', 'colorConversion', 'inspectionLighting'):
    assert audits[0][key] == audits[1][key], key
for name in names:
    views = [next(v for v in a['renderedViews'] if v['name'] == name) for a in audits]
    assert views[0] == views[1], name
font = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
head, small = ImageFont.truetype(font, 27), ImageFont.truetype(font, 19)
labels = {'rear-inspection-three-quarter': '低角度后 3/4', 'rear-inspection-direct': '低角度正后方', 'windshield-inspection': '前挡风玻璃检查'}
sheet = Image.new('RGB', (2400, 3 * 850 + 76), '#f3f4f5')
for row, name in enumerate(names):
    pair = Image.new('RGB', (2400, 850), '#f3f4f5'); draw = ImageDraw.Draw(pair)
    for col, (folder, label) in enumerate([(baseline, '上一版'), (candidate, '新候选')]):
        draw.text((col * 1200 + 22, 10), label + ' | ' + labels[name], font=head, fill='#17202b')
        draw.text((col * 1200 + 22, 49), '实际网格 CPU，16 采样；相同新检查相机及柔和后补光', font=small, fill='#505862')
        raw = Image.open(folder / (name + '-raw.png')).convert('RGB'); assert raw.size == (1200, 760)
        pair.paste(raw, (col * 1200, 90))
    pair.save(candidate / (name + '-before-after.png')); sheet.paste(pair, (0, row * 850))
draw = ImageDraw.Draw(sheet)
draw.text((22, 2558), '原始预览像素未缩放、未修图。此处尾翼为构建预览姿态（Y=0.85，俯仰=0）；功能姿态另列。', font=small, fill='#505862')
draw.text((22, 2588), '检查相机并非照片精确匹配；照片与模型材质及光照不同。', font=small, fill='#505862')
sheet.save(candidate / 'rear-wing-before-after-inspections.png')

photo_specs = [('084440', 'rear-inspection-direct', None), ('084441', 'rear-inspection-three-quarter', None),
               ('113143', 'rear-inspection-direct', None), ('113142', 'windshield-inspection', [44, 296, 500, 432])]
context = Image.new('RGB', (2160, 4 * 540 + 92), '#f3f4f5'); draw = ImageDraw.Draw(context)
provenance = []
for row, (number, name, crop) in enumerate(photo_specs):
    photo = refs / ('image(20261019-' + number + ').png')
    paths = [photo, baseline / (name + '-raw.png'), candidate / (name + '-raw.png')]
    for col, (path, label) in enumerate(zip(paths, ['参考 ' + number, '上一版', '新候选'])):
        original = Image.open(path).convert('RGB'); original_size = original.size
        if col == 0 and crop: original = original.crop(tuple(crop))
        scale = min(720 / original.width, 456 / original.height)
        size = (round(original.width * scale), round(original.height * scale))
        im = original.resize(size, Image.Resampling.LANCZOS)
        x, y = col * 720, row * 540
        draw.text((x + 16, y + 7), label + ' | ' + labels[name], font=head, fill='#17202b')
        note = '照片等比缩放；相机与模型不同' if col == 0 else '实际网格 CPU；相同检查相机/补光'
        if col == 0 and crop: note = '照片裁切车身后等比放大；视角与模型不同'
        draw.text((x + 16, y + 45), note, font=small, fill='#505862')
        context.paste(im, (x + (720 - size[0]) // 2, y + 84 + (456 - size[1]) // 2))
        provenance.append({'row': row, 'column': col, 'file': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'originalDimensions': original_size, 'crop': crop if col == 0 else None, 'uniformScale': scale, 'resizedDimensions': size})
draw.text((18, 2168), '仅公开标注的裁切与等比缩放；照片未镜像、未改形、未修图。尾翼此处仍为构建姿态。', font=small, fill='#505862')
draw.text((18, 2198), '前挡风玻璃反射工作室地面/灯箱；截图不能代替平面几何与屏幕间隙测量。', font=small, fill='#505862')
context.save(candidate / 'rear-wing-originals-baseline-candidate.png')
compact = Image.new('RGB', (2160, 1144), '#f3f4f5')
compact.paste(context.crop((0, 0, 2160, 1080)), (0, 0))
draw = ImageDraw.Draw(compact)
draw.text((18, 1087), '参考照片仅等比缩放；模型为相同检查相机/补光的实际网格 CPU 预览。', font=small, fill='#505862')
draw.text((18, 1115), '照片相机未知；此处尾翼为构建姿态，四种功能目标姿态另有实网格证明。', font=small, fill='#505862')
compact.save(candidate / 'rear-wing-compact-original-baseline-candidate.png')
metadata = {'matchedActualCamerasVerified': True, 'matchedInspectionLighting': audits[0]['inspectionLighting'],
            'samples': 16, 'nativeBeforeAfterPixelsResizedOrRetouched': False, 'referenceContextTransforms': provenance,
            'photosMirroredReshapedOrRetouched': False, 'constructionPose': {'groupY': .85, 'groupRotationX': 0},
            'baselineSourceHashes': audits[0]['sourceHashes'], 'candidateSourceHashes': audits[1]['sourceHashes']}
(candidate / 'inspection-comparison-provenance.json').write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + '\n')
print(candidate / 'rear-wing-before-after-inspections.png')
print(candidate / 'rear-wing-originals-baseline-candidate.png')
