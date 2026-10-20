"""Blender CPU art inspection of exact exported map-owned Three scene.
This is not WebGL gameplay and does not validate GPU FPS. Geometry is not edited.
Usage: blender -b --factory-startup --python ... -- EXPORT_DIR [view ...]
"""
import bpy,sys,os,json,math,time,base64
from mathutils import Matrix,Vector
start=sys.argv.index('--')+1;folder=os.path.abspath(sys.argv[start]);requested=sys.argv[start+1:]
with open(os.path.join(folder,'scene.json')) as f:data=json.load(f)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU'
scene.cycles.seed=7013;scene.cycles.samples=int(os.environ.get('COAST_SAMPLES','48'));scene.cycles.use_denoising=False
scene.cycles.max_bounces=5;scene.render.threads_mode='FIXED';scene.render.threads=int(os.environ.get('COAST_THREADS','2'))
scene.render.resolution_x=int(os.environ.get('COAST_WIDTH','1440'));scene.render.resolution_y=int(os.environ.get('COAST_HEIGHT','900'));scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
scene.view_settings.view_transform='Standard';scene.view_settings.look='Medium High Contrast';scene.view_settings.exposure=0
world=bpy.data.worlds.new('Disclosed neutral daylight inspection sky');world.use_nodes=True;scene.world=world
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.57,.72,.85,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.55
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
textures={}
for t in data['textures']:
 if t.get('kind')=='cube':continue
 img=bpy.data.images.new(t['id'],width=t['width'],height=t['height'],alpha=True)
 raw=base64.b64decode(t['bytes']);channels=len(raw)//(t['width']*t['height'])
 px=[]
 for i in range(0,len(raw),channels):
  values=raw[i:i+channels];px.extend([v/255 for v in values[:3]]+[values[3]/255 if channels==4 else 1])
 img.pixels.foreach_set(px);img.update();textures[t['id']]=(img,t)
materials={}
for m in data['materials']:
 mat=bpy.data.materials.new(m['id']);mat.use_nodes=True;nodes=mat.node_tree.nodes;links=mat.node_tree.links;bs=nodes.get('Principled BSDF')
 c=m.get('color') or [.5,.5,.5];bs.inputs['Base Color'].default_value=(*(linear(v) for v in c),1)
 bs.inputs['Roughness'].default_value=m.get('roughness',.8);bs.inputs['Metallic'].default_value=m.get('metalness',0)
 if m.get('emissive'):
  bs.inputs['Emission Color'].default_value=(*(linear(v) for v in m['emissive']),1);bs.inputs['Emission Strength'].default_value=m.get('emissiveIntensity',0)
 if m.get('map'):
  img,t=textures[m['map']];tex=nodes.new('ShaderNodeTexImage');tex.image=img;tex.extension='REPEAT'
  coord=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(*t['repeat'],1)
  links.new(coord.outputs['UV'],mapping.inputs[0]);links.new(mapping.outputs[0],tex.inputs['Vector'])
  mul=nodes.new('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1;mul.inputs[1].default_value=(*(linear(v) for v in c),1)
  links.new(tex.outputs['Color'],mul.inputs[2]);links.new(mul.outputs[0],bs.inputs['Base Color'])
 if m.get('emissiveMap'):
  img,t=textures[m['emissiveMap']];tex=nodes.new('ShaderNodeTexImage');tex.image=img;tex.extension='REPEAT'
  mul=nodes.new('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1;mul.inputs[1].default_value=bs.inputs['Emission Color'].default_value
  links.new(tex.outputs['Color'],mul.inputs[2]);links.new(mul.outputs[0],bs.inputs['Emission Color'])
 if m.get('transparent') and m.get('opacity',1)<1:
  trans=nodes.new('ShaderNodeBsdfTransparent');mix=nodes.new('ShaderNodeMixShader');mix.inputs[0].default_value=m.get('opacity',1)
  links.new(trans.outputs[0],mix.inputs[1]);links.new(bs.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],nodes.get('Material Output').inputs['Surface'])
 if m.get('vertexColors'):
  vc=nodes.new('ShaderNodeVertexColor');vc.layer_name='Source vertex color';mul=nodes.new('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1
  if bs.inputs['Base Color'].links:links.new(bs.inputs['Base Color'].links[0].from_socket,mul.inputs[1])
  else:mul.inputs[1].default_value=bs.inputs['Base Color'].default_value
  links.new(vc.outputs['Color'],mul.inputs[2]);links.new(mul.outputs[0],bs.inputs['Base Color'])
 materials[m['id']]=mat
# Flatten actual transformed triangles into material batches for bounded offline RAM.
# This changes storage only: no vertex positions, triangle winding, UVs or source normals.
source_geometries={g['id']:g for g in data['geometries']};batches={}
for part in data['meshes']:
 g=source_geometries[part['geometry']];p=g['attributes']['position'];normals=g['attributes'].get('normal');uvs=g['attributes'].get('uv');source_colors=g['attributes'].get('color')
 M=C@Matrix([part['matrixWorld'][i::4] for i in range(4)]);N=M.to_3x3().inverted_safe().transposed()
 idx=g['index'] or list(range(len(p)//3));start=g['drawRange']['start'];count=g['drawRange']['count'];end=min(len(idx),start+count) if count is not None else len(idx)
 for i in range(start,end-2,3):
  material_index=0
  for group in g.get('groups',[]):
   if group['start']<=i<group['start']+group['count']:material_index=group.get('materialIndex',0);break
  mid=part['materials'][min(material_index,len(part['materials'])-1)]
  bucket=batches.setdefault(mid,{'vertices':[],'normals':[],'uv':[],'colors':[],'faces':[]})
  triangle=idx[i:i+3]
  if M.determinant()<0:triangle=[triangle[0],triangle[2],triangle[1]]
  face=[]
  for v in triangle:
   face.append(len(bucket['vertices']));bucket['vertices'].append(M@Vector(p[v*3:v*3+3]))
   bucket['normals'].append((N@Vector(normals[v*3:v*3+3])).normalized() if normals else Vector((0,0,1)))
   bucket['uv'].append(uvs[v*2:v*2+2] if uvs else (0,0));bucket['colors'].append([linear(c) for c in source_colors[v*3:v*3+3]] if source_colors else (1,1,1))
  bucket['faces'].append(face)
converted_triangles=sum(len(bucket['faces']) for bucket in batches.values())
if converted_triangles!=data['metrics']['staticTriangles']:raise RuntimeError('Triangle count mismatch after exact instance expansion')
for mid,bucket in batches.items():
 mesh=bpy.data.meshes.new(mid);mesh.from_pydata(bucket['vertices'],[],bucket['faces']);mesh.update()
 uv=mesh.uv_layers.new(name='Exact source UV')
 for loop in mesh.loops:uv.data[loop.index].uv=bucket['uv'][loop.vertex_index]
 colors=mesh.color_attributes.new(name='Source vertex color',type='FLOAT_COLOR',domain='CORNER')
 for loop in mesh.loops:colors.data[loop.index].color=(*bucket['colors'][loop.vertex_index],1)
 mesh.normals_split_custom_set_from_vertices(bucket['normals'])
 for poly in mesh.polygons:poly.use_smooth=True
 mesh.materials.append(materials[mid]);obj=bpy.data.objects.new(mid,mesh);bpy.context.collection.objects.link(obj)
# This inspection sun deliberately does NOT imply in-game shadow acceptance.
sun_data=bpy.data.lights.new('Disclosed inspection sun','SUN');sun_data.energy=2.2;sun_data.angle=math.radians(6)
sun=bpy.data.objects.new('Disclosed inspection sun',sun_data);bpy.context.collection.objects.link(sun);sun.rotation_euler=(math.radians(27),math.radians(-24),math.radians(-36))
cam_data=bpy.data.cameras.new('Offline review camera');cam=bpy.data.objects.new('Offline review camera',cam_data);bpy.context.collection.objects.link(cam);scene.camera=cam
views={
 'sample-street':((-89,5,797),(-5,6,708),60),
 'sample-frontage':((-58,4.4,755),(-4,5,714),55),
 'storefront-close':((-39,2.8,727),(-23,2,720),55),
 'sample-aerial':((-240,125,855),(18,0,612),48),
 'pier':((-840,70,-555),(-575,10,-650),48),
 'promenade':((-148,3.8,815),(-151,3,618),60),
 'district':((-700,470,1300),(170,0,0),52),
 'driver-spawn':((-64,1.2,700),(-64,1.2,580),60),
 'roadside':((-99,1.8,700),(-30,4,580),65),
 'pier-approach':((-235,1.3,-650),(-600,3,-650),65),
 'shore-ground':((-317,1.8,650),(-110,2,100),68),
 'coast-panorama':((-450,90,1000),(-150,0,-150),72),
}
audit={'generatedAtUTC':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'renderer':'Blender '+bpy.app.version_string+' Cycles CPU','warning':'Offline exact-geometry art inspection, NOT a WebGL gameplay screenshot or FPS test','source':data['source'],'metrics':data['metrics'],'coordinateMapping':data['coordinateMapping'],'exactGeometry':True,'convertedTriangleCount':converted_triangles,'threads':scene.render.threads,'seed':scene.cycles.seed,'geometryNotes':'All original vertices/triangles, instance matrices, instance-color × material-color and UVs retained. No mesh artistic edits. Materials/sky/light/color mapping approximate Three rendering. All Blender objects cast shadows, unlike current game baseline.','lighting':{'worldStrength':.55,'sunEnergy':2.2,'sunAngleDeg':6,'sunEulerDeg':[27,-24,-36]},'samples':scene.cycles.samples,'resolution':[scene.render.resolution_x,scene.render.resolution_y],'views':[]}
for name in (requested or ['sample-street','sample-frontage','sample-aerial']):
 loc,target,fov=views[name];cam.location=C@Vector(loc);t=C@Vector(target);cam.rotation_euler=(t-cam.location).to_track_quat('-Z','Y').to_euler();cam_data.type='PERSP';cam_data.sensor_fit='VERTICAL' if name=='driver-spawn' else 'HORIZONTAL';cam_data.lens=(cam_data.sensor_height if name=='driver-spawn' else cam_data.sensor_width)/(2*math.tan(math.radians(fov)/2));cam_data.clip_start=.1;cam_data.clip_end=6000
 projection=cam.calc_matrix_camera(bpy.context.evaluated_depsgraph_get(),x=scene.render.resolution_x,y=scene.render.resolution_y)
 actual_fov=[math.degrees(2*math.atan(1/abs(projection[0][0]))),math.degrees(2*math.atan(1/abs(projection[1][1])))]
 scene.render.filepath=os.path.join(folder,name+'-raw.png');t0=time.time();bpy.ops.render.render(write_still=True)
 audit['views'].append({'name':name,'positionThree':loc,'targetThree':target,'fovDeg':fov,'fovAxis':'vertical' if name=='driver-spawn' else 'horizontal','projectionMeasuredFovXYDeg':actual_fov,'output':name+'-raw.png','seconds':round(time.time()-t0,3)})
 with open(os.path.join(folder,'render-audit.json'),'w') as f:json.dump(audit,f,indent=2)
