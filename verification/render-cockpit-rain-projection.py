"""Draw measured CPU projection footprints; never present this as a game render."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont
root = Path(__file__).resolve().parent
records = json.loads((root / 'cockpit-rain-runtime-result.json').read_text())['configurations']
font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font = ImageFont.truetype(font_path, 15)
small = ImageFont.truetype(font_path, 12)
image = Image.new('RGB', (1180, 950), '#09101a')
draw = ImageDraw.Draw(image)
draw.text((24, 15), 'WINDSHIELD WATER | exact r128 CPU projection footprints', fill='#e5f1fa', font=font)
draw.text((24, 40), 'Layout diagnostic, not a browser / GPU game render. Camera, instrument and wheel positions are unchanged.', fill='#91a4b7', font=small)
for panel, (model, viewport) in enumerate((('reference', [1440, 900]), ('classic', [1440, 900]), ('reference', [390, 844]), ('classic', [390, 844]))):
    record = next(r for r in records if r['model'] == model and r['viewport'] == viewport and r['cockpit'] == 'reference')
    x0, y0 = 25 + panel % 2 * 580, 85 + panel // 2 * 425
    w, h = (540, 337) if panel < 2 else (170, 368)
    if panel >= 2:
        x0 += 160
    draw.text((x0, y0 - 20), f"{model.upper()} | {viewport[0]} x {viewport[1]}", fill='#c5d7e8', font=font)
    draw.rectangle((x0, y0, x0 + w, y0 + h), fill='#111d2a', outline='#34465a')
    for fraction in (.25, .5, .75):
        y = int(y0 + fraction * h)
        draw.line((x0, y, x0 + w, y), fill='#1f2e3d')
    y1, y2 = (.69, .755) if model == 'reference' else (.54, .65)
    for a, b in ((.025, .15), (.85, .975)):
        draw.rectangle((int(x0+a*w), int(y0+y1*h), int(x0+b*w), int(y0+y2*h)), outline='#327a91')
    for bounds, color in ((record['screenBounds'], '#655f37'), (record['yokeBounds'], '#4c6256')):
        a, b, c, d = bounds
        draw.rectangle((int(x0+max(0,a)*w), int(y0+max(0,b)*h), int(x0+min(1,c)*w), int(y0+min(1,d)*h)), outline=color)
    points = record['screenPoints']
    for i in range(8):
        quad = [(x0 + points[i*4+j][0] * w, y0 + points[i*4+j][1] * h) for j in (0, 1, 3, 2)]
        draw.polygon(quad, fill='#a2d7e5')
    draw.text((x0, y0+h+7), 'cyan: glass water | gold: screen | green: wheel envelope', fill='#91a4b7', font=small)
image.save(root / 'cockpit-rain-projection.png')
