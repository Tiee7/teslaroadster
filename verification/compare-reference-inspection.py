"""Pair native supplied photographs with approximate actual-mesh inspection renders."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib, json, sys

folder, reference, view = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
photo = Image.open(reference).convert('RGB')
render = Image.open(folder / (view + '-raw.png')).convert('RGB')
assert photo.size == render.size == (550, 688)
audit = json.loads((folder / 'render-audit.json').read_text())
camera = next(v for v in audit['renderedViews'] if v['name'] == view)
title = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
sheet = Image.new('RGB', (1100, 778), '#f3f4f5')
draw = ImageDraw.Draw(sheet)
draw.text((12, 12), 'Source photograph | ' + reference.stem.removeprefix('image(').removesuffix(')'), font=title, fill='#17202b')
draw.text((12, 43), 'Original supplied pixels; unchanged and unmirrored', font=small, fill='#505862')
draw.text((562, 12), 'Actual model CPU preview | ' + view, font=title, fill='#17202b')
draw.text((562, 43), f'Approximate inspection camera; {audit["samples"]} samples', font=small, fill='#505862')
draw.text((562, 63), 'Different photograph camera and studio lighting', font=small, fill='#505862')
sheet.paste(photo, (0, 90)); sheet.paste(render, (550, 90))
output = view + '-source-comparison.png'; sheet.save(folder / output)
metadata = {'referenceFilename': reference.name, 'referenceSha256': hashlib.sha256(reference.read_bytes()).hexdigest(),
            'referencePixelsResizedMirroredOrRetouched': False, 'previewPixelsResizedOrRetouched': False,
            'renderSamples': audit['samples'], 'camera': camera, 'photographCameraUnknown': True, 'output': output}
(folder / (view + '-source-comparison.json')).write_text(json.dumps(metadata, indent=2) + '\n')
print(folder / output)
