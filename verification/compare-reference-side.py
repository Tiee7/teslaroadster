"""Pair unchanged side reference with pixel-preserving baseline/candidate previews."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib, json, sys

before, after, reference = map(Path, sys.argv[1:4])
candidate_label = sys.argv[4] if len(sys.argv) > 4 else 'bounded nose-slope check'
audits = [json.loads((p / 'render-audit.json').read_text()) for p in (before, after)]
for key in ('renderer', 'samples', 'colorConversion'):
    assert audits[0][key] == audits[1][key], key
records = [next(v for v in a['renderedViews'] if v['name'] == 'reference-side-left') for a in audits]
for key in ('cameraPositionBlender', 'targetBlender', 'projection', 'focalLengthMm',
            'orthographicScale', 'resolution', 'shiftX', 'shiftY'):
    assert records[0].get(key) == records[1].get(key), key
images = [Image.open(p).convert('RGB') for p in (reference, before / 'reference-side-left-raw.png', after / 'reference-side-left-raw.png')]
assert all(i.size == (550, 688) for i in images)
font = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
title, small = ImageFont.truetype(font, 18), ImageFont.truetype(font, 13)
labels = [
    ('Source photograph | side reference 113142', 'Original pixels; unchanged and unmirrored'),
    ('Actual model | frozen 2d4bbf7 baseline', 'Approximate side camera; different photograph lighting'),
    ('Actual model | ' + candidate_label, f'Same CPU studio and camera; {audits[1]["samples"]} samples'),
]
sheet = Image.new('RGB', (1650, 778), '#f3f4f5')
draw = ImageDraw.Draw(sheet)
for col, (im, (head, sub)) in enumerate(zip(images, labels)):
    x = col * 550
    draw.text((x + 12, 12), head, font=title, fill='#17202b')
    draw.text((x + 12, 43), sub, font=small, fill='#505862')
    draw.text((x + 12, 63), 'Front points left; no image resizing or retouching', font=small, fill='#505862')
    sheet.paste(im, (x, 90))
sheet.save(after / 'reference-side-original-baseline-candidate.png')
pair = sheet.crop((550, 0, 1650, 778))
pair.save(after / 'reference-side-before-after.png')
metadata = {
    'referenceFilename': reference.name,
    'referenceSha256': hashlib.sha256(reference.read_bytes()).hexdigest(),
    'referencePixelsResizedMirroredOrRetouched': False,
    'previewPixelsResizedOrRetouched': False,
    'beforeFolder': str(before), 'afterFolder': str(after),
    'matchedActualCamerasVerified': True, 'renderSamples': audits[1]['samples'],
    'photographCameraUnknown': True,
    'outputs': ['reference-side-original-baseline-candidate.png', 'reference-side-before-after.png'],
}
(after / 'reference-side-comparison.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(after / metadata['outputs'][0])
print(after / metadata['outputs'][1])
