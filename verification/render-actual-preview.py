"""Blender CPU studio render of exact Three.js canonical preview export.
blender -b -noaudio --factory-startup --python verification/render-actual-preview.py -- EXPORT_DIR
No artistic mesh editing, remeshing, subdivision, smoothing modifiers or image generation.
"""
import bpy, json, sys, os, math, time
from mathutils import Vector, Matrix
argument_start=sys.argv.index('--')+1
folder=os.path.abspath(sys.argv[argument_start])
requested_sequence=sys.argv[argument_start+1:]
requested_views=set(requested_sequence)
samples=int(os.environ.get('ROADSTER_PREVIEW_SAMPLES','48'))
inspection_fill=os.environ.get('ROADSTER_PREVIEW_INSPECTION_FILL')=='1'
inspection_lighting={'enabled':inspection_fill,'name':'Optional gentle low rear inspection fill','positionBlender':[2.2,-5.5,.9],'targetBlender':[0,-2.1,.25],'energyWatts':85,'sizeMeters':2,'sizeYMeters':1} if inspection_fill else {'enabled':False}
previous_audit=None
if os.environ.get('ROADSTER_PREVIEW_RESUME')=='1' and os.path.isfile(os.path.join(folder,'render-audit.json')):
 with open(os.path.join(folder,'render-audit.json')) as f:previous_audit=json.load(f)
with open(os.path.join(folder,'actual-preview-meshes.json')) as f: data=json.load(f)
if previous_audit:
 if previous_audit.get('sourceHashes')!=data['sources'] or previous_audit.get('samples')!=samples:raise RuntimeError('Resume requires identical source and samples.')
 if previous_audit.get('inspectionLighting',{'enabled':False})!=inspection_lighting:raise RuntimeError('Resume requires identical inspection lighting.')
 if previous_audit.get('wingPose')!=data.get('wingPose'):raise RuntimeError('Resume requires identical exported wing pose.')
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=samples
scene.cycles.use_denoising=False;scene.cycles.max_bounces=5
scene.cycles.transparent_max_bounces=8
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=1200;scene.render.resolution_y=760;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
scene.render.film_transparent=False
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.view_settings.exposure=0
world=bpy.data.worlds.new('Neutral studio world');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.55,.55,.55,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.2
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
def srgb_linear(v):
 return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
materials={}
for m in data['materials']:
 mat=bpy.data.materials.new(m['id']);mat.use_nodes=True;nodes=mat.node_tree.nodes;links=mat.node_tree.links
 bsdf=nodes.get('Principled BSDF');c=m.get('color') or [.4,.4,.4]
 bsdf.inputs['Base Color'].default_value=(*(srgb_linear(v) for v in c),1)
 bsdf.inputs['Metallic'].default_value=m.get('metalness',0)
 bsdf.inputs['Roughness'].default_value=max(.06,m.get('roughness',.5))
 bsdf.inputs['Coat Weight'].default_value=m.get('clearcoat',0)
 bsdf.inputs['Coat Roughness'].default_value=m.get('clearcoatRoughness',.1)
 if m.get('emissive'):
  bsdf.inputs['Emission Color'].default_value=(*(srgb_linear(v) for v in m['emissive']),1)
  bsdf.inputs['Emission Strength'].default_value=m.get('emissiveIntensity',0)
 # Preserve front/back sidedness from Three.js using transparent back faces.
 # Source DoubleSide=2 remains double sided; negative determinants are corrected below.
 if m.get('side',0)!=2:
  geom=nodes.new('ShaderNodeNewGeometry');trans=nodes.new('ShaderNodeBsdfTransparent');mix=nodes.new('ShaderNodeMixShader')
  links.new(geom.outputs['Backfacing'],mix.inputs[0])
  if m.get('side',0)==0: links.new(bsdf.outputs[0],mix.inputs[1]);links.new(trans.outputs[0],mix.inputs[2])
  else: links.new(trans.outputs[0],mix.inputs[1]);links.new(bsdf.outputs[0],mix.inputs[2])
  links.new(mix.outputs[0],nodes.get('Material Output').inputs['Surface'])
 materials[m['id']]=mat
stats={'meshCount':0,'triangleCount':0,'negativeDeterminants':[],'missingNormals':[],'normalWindingDisagreements':[],'sourceHashes':data['sources'],'renderer':'Blender '+bpy.app.version_string+' Cycles CPU','samples':samples,'colorConversion':'Source hex/Color channels sRGB to Blender linear; exposure 0; world strength .2; half-energy softboxes','exactGeometry':True,'renderedViews':[]}
stats['inspectionLighting']=inspection_lighting
if data.get('wingPose'):stats['wingPose']=data['wingPose']
for part in data['meshes']:
 p=part['position'];M=Matrix([part['matrixWorld'][i::4] for i in range(4)]);M=C@M
 verts=[M@Vector(p[i:i+3]) for i in range(0,len(p),3)]
 indices=part['index'] or list(range(len(verts)));start=part.get('drawRange',{}).get('start',0);count=part.get('drawRange',{}).get('count')
 end=min(len(indices),start+count) if count is not None else len(indices)
 tris=[tuple(indices[i:i+3]) for i in range(start,end-2,3)]
 if M.determinant()<0:
  tris=[(t[0],t[2],t[1]) for t in tris];stats['negativeDeterminants'].append(part['name'])
 mesh=bpy.data.meshes.new(part['name']);mesh.from_pydata(verts,[],tris);mesh.update()
 obj=bpy.data.objects.new(part['name'],mesh);bpy.context.collection.objects.link(obj)
 for mid in part['material']:mesh.materials.append(materials[mid])
 for poly in mesh.polygons:
  poly.use_smooth=True
  tri_index=start+poly.index*3
  for group in part.get('groups',[]):
   if group['start']<=tri_index<group['start']+group['count']:poly.material_index=group['materialIndex'];break
 normals=part.get('normal')
 if normals:
  normal_matrix=M.to_3x3().inverted_safe().transposed()
  transformed=[(normal_matrix@Vector(normals[i:i+3])).normalized() for i in range(0,len(normals),3)]
  mesh.normals_split_custom_set_from_vertices(transformed)
  disagree=0
  for poly in mesh.polygons:
   avg=sum((transformed[i] for i in poly.vertices),Vector()).normalized()
   if poly.area>1e-10 and avg.dot(poly.normal)<-.1:disagree+=1
  if disagree:stats['normalWindingDisagreements'].append({'name':part['name'],'triangles':disagree})
 else:stats['missingNormals'].append(part['name'])
 stats['meshCount']+=1;stats['triangleCount']+=len(tris)
if previous_audit:stats['renderedViews']=previous_audit.get('renderedViews',[])
# Added presentation environment only: a neutral floor, softboxes, cameras.
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.003))
floor=bpy.context.object;floor.name='Presentation floor (not vehicle geometry)'
mat=bpy.data.materials.new('Neutral gray floor');mat.use_nodes=True;mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.38,.39,.40,1);mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.78;floor.data.materials.append(mat)
def point_at(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
def area(name,location,power,size,target=(0,0,.5),size_y=None):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='RECTANGLE';d.size=size;d.size_y=size_y or size
 obj=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(obj);obj.location=location;point_at(obj,target)
area('Key broad softbox',(-3,-1,6),625,2,size_y=5)
area('Fill strip softbox',(4,1,4),500,3,size_y=6)
area('Rear rim softbox',(-3.8,-4,5),600,.7,size_y=5)
area('Top strip',(0,0,7),425,2,size_y=6)
if inspection_fill:area('Optional low rear inspection fill',(2.2,-5.5,.9),85,2,target=(0,-2.1,.25),size_y=1)
cam_data=bpy.data.cameras.new('Inspection camera');cam=bpy.data.objects.new('Inspection camera',cam_data);bpy.context.collection.objects.link(cam);scene.camera=cam
views=[('front-three-quarter',(6.3,8.8,3.3),(0,0,.54),'PERSP',None),('rear-three-quarter',(6.3,-8.8,3.3),(0,0,.54),'PERSP',None),('side',(10,0,1.55),(0,0,.54),'ORTHO',5.65),('front',(0,10,1.55),(0,0,.54),'ORTHO',3.05),('rear',(0,-10,1.55),(0,0,.54),'ORTHO',3.05)]
if 'reference-side-left' in requested_views:
 views.append(('reference-side-left',(-10,0,.55),(0,0,.55),'ORTHO',7.38))
if 'tail-side-left' in requested_views:
 views.append(('tail-side-left',(-10,0,.55),(0,0,.55),'ORTHO',5.2))
if 'rear-detail' in requested_views:
 views.append(('rear-detail',(-1.8,-6,.82),(-.10,-2.25,.43),'PERSP',None))
if 'rear-detail-oblique' in requested_views:
 views.append(('rear-detail-oblique',(-3.4,-5.4,.50),(-.10,-2.25,.38),'PERSP',None))
if 'rear-fin-close' in requested_views:
 views.append(('rear-fin-close',(2.4,-4.6,.27),(.10,-2.05,.23),'PERSP',None))
if 'rear-inspection-three-quarter' in requested_views:
 views.append(('rear-inspection-three-quarter',(4.6,-7,1.65),(0,-.65,.54),'PERSP',None))
if 'rear-inspection-direct' in requested_views:
 views.append(('rear-inspection-direct',(0,-7,.75),(0,-1.4,.5),'PERSP',None))
if 'windshield-inspection' in requested_views:
 views.append(('windshield-inspection',(-3.8,5.8,2.7),(0,.65,.8),'PERSP',None))
if 'reference-top-rear' in requested_views:
 views.append(('reference-top-rear',(0,-7.5,6.5),(0,-.5,.55),'PERSP',None))
if 'top' in requested_views:
 views.insert(0,('top',(0,0,10),(0,0,0),'ORTHO',5.65))
if 'reference-top' in requested_views:
 views.insert(0,('reference-top',(0,0,10),(0,0,0),'ORTHO',11.10))
if 'reference-front' in requested_views:
 views.append(('reference-front',(0,6,.8509439655),(0,0,.8509439655),'PERSP',None))
if requested_sequence:
 views.sort(key=lambda view:requested_sequence.index(view[0]) if view[0] in requested_views else len(requested_sequence))
# Quarter cameras use a long lens for a restrained, physically consistent perspective.
with open(os.path.join(folder,'render-audit.json'),'w') as f:json.dump(stats,f,indent=2)
for name,location,target,typ,scale in views:
 if requested_views and name not in requested_views:continue
 if previous_audit and any(v['name']==name for v in stats['renderedViews']):continue
 cam.location=location;point_at(cam,target);cam_data.type=typ;cam_data.lens=65;cam_data.sensor_width=36;cam_data.sensor_fit='AUTO';cam_data.shift_y=0;cam_data.shift_x=0
 scene.render.resolution_x=1200;scene.render.resolution_y=760
 if name=='reference-front':
  scene.render.resolution_x=1040;scene.render.resolution_y=585
  cam_data.lens=56.7414768;cam_data.sensor_fit='HORIZONTAL';cam_data.shift_y=-.0804165091;cam_data.shift_x=-16/1040
 if name=='windshield-inspection':cam_data.lens=85
 if name in ['reference-side-left','rear-detail','rear-detail-oblique','rear-fin-close','reference-top-rear']:
  scene.render.resolution_x=550;scene.render.resolution_y=688
  if name=='reference-side-left':
   cam_data.shift_x=2/688;cam_data.shift_y=(419-344-.55*(688/7.38))/688
  else:cam_data.lens=56 if name=='rear-fin-close' else 70
 if name in ['top','reference-top']:
  cam.rotation_euler.rotate_axis('Z',math.pi/2)
  if name=='reference-top':
   scene.render.resolution_x=700;scene.render.resolution_y=544
   cam_data.shift_x=-4/700;cam_data.shift_y=27/700
 if scale:cam_data.ortho_scale=scale
 scene.render.filepath=os.path.join(folder,name+'-raw.png')
 bpy.ops.render.render(write_still=True)
 record={'name':name,'cameraPositionBlender':location,'targetBlender':target,'projection':typ,'focalLengthMm':cam_data.lens if typ=='PERSP' else None,'orthographicScale':scale,'file':name+'-raw.png'}
 if name in ['rear-inspection-three-quarter','rear-inspection-direct','windshield-inspection']:
  record.update({'label':'Optional actual-mesh inspection camera; not a photograph camera match','resolution':[1200,760],'shiftX':cam_data.shift_x,'shiftY':cam_data.shift_y})
 if name=='reference-front':
  from bpy_extras.object_utils import world_to_camera_view
  record.update({'label':'Approximate matched reference-front camera; actual photograph camera unknown','resolution':[1040,585],'horizontalSensorMm':36,'shiftY':cam_data.shift_y,'shiftX':cam_data.shift_x,'projectedLandmarks':{}})
  for label,point in [('roofCenter',(0,-.025,1.111)),('splitterCenter',(0,2.344,.134)),('noseLeft',(-.914,2.344,.154)),('noseRight',(.914,2.344,.154))]:
   ndc=world_to_camera_view(scene,cam,Vector(point));record['projectedLandmarks'][label]=[ndc.x*1040,(1-ndc.y)*585]
 if name in ['top','reference-top']:
  from bpy_extras.object_utils import world_to_camera_view
  width,height=scene.render.resolution_x,scene.render.resolution_y
  record.update({'label':'Actual mesh top inspection; front points right' if name=='top' else 'Approximate reference-top framing; photograph camera unknown','resolution':[width,height],'rollDegrees':90,'shiftX':cam_data.shift_x,'shiftY':cam_data.shift_y,'frontPointsRight':True,'projectedLandmarks':{}})
  for label,point in [('origin',(0,0,0)),('front',(0,2.348,0)),('rear',(0,-2.317,0))]:
   ndc=world_to_camera_view(scene,cam,Vector(point));record['projectedLandmarks'][label]=[ndc.x*width,(1-ndc.y)*height]
  projected=[]
  for x in [data['boundsThree']['min'][0],data['boundsThree']['max'][0]]:
   for z in [data['boundsThree']['min'][2],data['boundsThree']['max'][2]]:
    ndc=world_to_camera_view(scene,cam,Vector((x,-z,0)));projected.append((ndc.x*width,(1-ndc.y)*height))
  lo=[min(v[i] for v in projected) for i in [0,1]];hi=[max(v[i] for v in projected) for i in [0,1]]
  record['projectedBodyBounds']={'min':lo,'max':hi,'size':[hi[i]-lo[i] for i in [0,1]],'center':[(hi[i]+lo[i])/2 for i in [0,1]]}
 if name in ['reference-side-left','rear-detail','rear-detail-oblique','rear-fin-close','reference-top-rear']:
  record.update({'label':'Approximate reference inspection camera; actual photograph camera unknown','resolution':[550,688],'shiftX':cam_data.shift_x,'shiftY':cam_data.shift_y,'photographMirrored':False})
  if name=='reference-side-left':
   from bpy_extras.object_utils import world_to_camera_view
   record['projectedLandmarks']={}
   for label,point in [('ground',(0,0,0)),('frontWheel',(0,1.36,.32)),('rearWheel',(0,-1.38,.35)),('roof',(0,0,1.1144949)),('nose',(0,2.348,.3)),('tail',(0,-2.317,.3))]:
    ndc=world_to_camera_view(scene,cam,Vector(point));record['projectedLandmarks'][label]=[ndc.x*550,(1-ndc.y)*688]
   record['horizontalWorldField']=7.38*550/688
 stats['renderedViews'].append(record)
 with open(os.path.join(folder,'render-audit.json'),'w') as f:json.dump(stats,f,indent=2)
