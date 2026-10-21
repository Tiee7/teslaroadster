"""CPU geometry diagrams, explicitly NOT game/WebGL screenshots or material QA."""
import json
import math
import re
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).parent
data = json.loads((root / 'layout-before-after.json').read_text())
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 17)
small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
width, height = 620, 400
vehicles = (root.parent.parent / 'src/vehicles.js').read_text()
cockpit = {key: float(re.search(r'\b'+key+r':\s*(-?[\d.]+)', vehicles).group(1)) for key in ['eyeHeight', 'eyeZ', 'downwardSlope']}

def perspective(buildings, position, yaw=0, fpv=False):
    x, z = position
    direction = np.array([-math.sin(yaw), 0, -math.cos(yaw)])
    eye = np.array([x, cockpit['eyeHeight'] if fpv else 2.3275, z]) - direction * (cockpit['eyeZ'] if fpv else 4.05)
    target = eye + direction * 50 + np.array([0, -cockpit['downwardSlope'] * 50, 0]) if fpv else np.array([x, .65, z]) + direction * 10
    forward = target - eye
    forward /= np.linalg.norm(forward)
    right = np.cross(forward, [0, 1, 0]); right /= np.linalg.norm(right)
    up = np.cross(right, forward)
    focal = height / (2 * math.tan(math.pi / 6))
    polygons = []
    def face(points, color):
        points = [np.array([np.dot(np.array(p)-eye, right), np.dot(np.array(p)-eye, up), np.dot(np.array(p)-eye, forward)]) for p in points]
        clipped = []
        for a, b in zip(points, points[1:]+points[:1]):
            ain, bin = a[2] >= .2, b[2] >= .2
            if ain: clipped.append(a)
            if ain != bin: clipped.append(a + (b-a) * ((.2-a[2])/(b[2]-a[2])))
        if len(clipped) < 3: return
        projected = [(max(-50000, min(50000, width/2+p[0]/p[2]*focal)), max(-50000, min(50000, height/2-p[1]/p[2]*focal))) for p in clipped]
        polygons.append((sum(p[2] for p in points)/len(points), projected, color))
    face([[-1200,0,-1200], [1200,0,-1200], [1200,0,1200], [-1200,0,1200]], '#1b2631')
    for road in range(-900, 901, 300):
        face([[road-10.5,.02,-1200],[road+10.5,.02,-1200],[road+10.5,.02,1200],[road-10.5,.02,1200]], '#404e5a')
        face([[-1200,.03,road-10.5],[1200,.03,road-10.5],[1200,.03,road+10.5],[-1200,.03,road+10.5]], '#404e5a')
    for b in buildings:
        x0,x1,z0,z1,h = b['minX'],b['maxX'],b['minZ'],b['maxZ'],b['height']
        low = b.get('kind') == 'low'
        colors = ['#597282','#455d6b','#718794'] if low else ['#394e60','#2b4052','#516879']
        for points, color in [([[x0,0,z0],[x1,0,z0],[x1,h,z0],[x0,h,z0]],colors[0]),
                              ([[x1,0,z1],[x0,0,z1],[x0,h,z1],[x1,h,z1]],colors[0]),
                              ([[x0,0,z1],[x0,0,z0],[x0,h,z0],[x0,h,z1]],colors[1]),
                              ([[x1,0,z0],[x1,0,z1],[x1,h,z1],[x1,h,z0]],colors[1]),
                              ([[x0,h,z0],[x1,h,z0],[x1,h,z1],[x0,h,z1]],colors[2])]: face(points,color)
    image = Image.new('RGB',(width,height),'#111b28'); draw=ImageDraw.Draw(image)
    for _,points,color in sorted(polygons,key=lambda p:-p[0]): draw.polygon(points,fill=color)
    return image

views = [('Spawn chase',(5.25,0),0,False),('30m before junction',(5.25,30),0,False),
         ('Eastbound turn',(0,5.25),-math.pi/2,False),('FPV geometry',(5.25,30),0,True)]
sheet=Image.new('RGB',(width*2+48,(height+42)*4+80),'#0b111a');draw=ImageDraw.Draw(sheet)
draw.text((16,10),'CPU box-geometry study — NOT WebGL/game screenshots',fill='white',font=font)
draw.text((16,34),'Exact building positions/heights; flat diagnostic colors, no lighting/weather/HUD/vehicle.',fill='#9aafc1',font=small)
for row,(name,pos,yaw,fpv) in enumerate(views):
    for column,version in enumerate(['before','after']):
        left=16+column*(width+16);top=80+row*(height+42)
        draw.text((left,top-23),f'{name} | {version.upper()}',fill='white',font=font)
        sheet.paste(perspective(data[version]['buildingDefinitions'],pos,yaw,fpv),(left,top))
sheet.save(root/'cpu-street-geometry.png')
