#!/usr/bin/env python3
"""Generate an isolated native Three recorder; no production source edits.
Reads the immutable original coast fixture, not patched src/coast-map.js.
"""
from pathlib import Path
import argparse
parser=argparse.ArgumentParser()
parser.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[3])
parser.add_argument('--output',type=Path,required=True)
a=parser.parse_args();root=a.repo.resolve();out=a.output.resolve();out.mkdir(parents=True,exist_ok=True)
s=(root/'verification/render-instance-20261022/native-webgl-capture.mjs').read_text()
s=s.replace("const scriptDirectory=path.dirname(fileURLToPath(import.meta.url));", "const scriptDirectory=path.join(path.resolve(process.argv[2]),'verification/render-instance-20261022');")
s=s.replace("getSupportedExtensions:()=>['OES_element_index_uint','OES_standard_derivatives','ANGLE_instanced_arrays'],", "getSupportedExtensions:()=>['OES_element_index_uint','OES_standard_derivatives','ANGLE_instanced_arrays',...(opts.supported!==false?['EXT_texture_filter_anisotropic']:[])],")
s=s.replace("getExtension(name){if(name==='ANGLE_instanced_arrays')", "getExtension(name){if(name==='EXT_texture_filter_anisotropic'&&opts.supported!==false)return{TEXTURE_MAX_ANISOTROPY_EXT:34046,MAX_TEXTURE_MAX_ANISOTROPY_EXT:34047};if(name==='ANGLE_instanced_arrays')")
s=s.replace("const vals={3379:16384,", "const vals={34047:opts.maxAnisotropy||16,3379:16384,")
start=s.index("const palette=src('vehicles.js')")
s=s[:start]+r'''
// Isolated original ground patch. Immutable baseline fixture, never patched production grainTexture.
const productionCoast=fs.readFileSync(path.join(root,'tests/fixtures/weather-ground-traffic-baseline/coast-map.js'),'utf8');
const expectedCoastSha256='ee0a881e0d1647de70d4403002a0f0f9fbadddceca5c15ad758cf25a13dd91de';
if(createHash('sha256').update(productionCoast).digest('hex')!==expectedCoastSha256)throw Error('Original coast fixture hash mismatch');
const grainStart=productionCoast.indexOf('    function grainTexture('),grainEnd=productionCoast.indexOf("    const plasterTexture=",grainStart);
const grain=productionCoast.slice(grainStart,grainEnd);
vm.runInContext(`const textures=new Set();${grain}globalThis.paverTexture=grainTexture('paver');`,c);
const tex=c.paverTexture;
let effective=1;
tex.anisotropy=effective;
const scene=new T.Scene();scene.background=new T.Color(0xc7dfed);scene.fog=new T.FogExp2(0xc7dfed,.0002);
const camera=new T.PerspectiveCamera(60,width/height,.38,4500);camera.position.fromArray([0,2.3,0]);camera.lookAt(0,.65,-14.05);
scene.add(new T.HemisphereLight(0xdbe9f4,0x9a9b82,.58));
const light=new T.DirectionalLight(0xfff5df,1);light.position.set(-55,100,48);scene.add(light);
const material=new T.MeshStandardMaterial({color:0xbdb9a9,roughness:.94,metalness:.02,map:tex});
// Production flatBatch convention, unchanged 2.4 metres / 128px tile, .6m joints.
const x0=-120,x1=120,z0=-1000,z1=10,y=.03,tileMetres=2.4;
const geometry=new T.BufferGeometry();
geometry.setAttribute('position',new T.Float32BufferAttribute([x0,y,z0,x0,y,z1,x1,y,z1,x1,y,z0],3));
geometry.setAttribute('uv',new T.Float32BufferAttribute([x0/tileMetres,z0/tileMetres,x0/tileMetres,z1/tileMetres,x1/tileMetres,z1/tileMetres,x1/tileMetres,z0/tileMetres],2));
geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();
const mesh=new T.Mesh(geometry,material);mesh.name='isolated-original-paver';scene.add(mesh);
const renderer=new T.WebGLRenderer({canvas,context:gl,antialias:false});const reportedMax=renderer.capabilities.getMaxAnisotropy();effective=Math.min(opts.anisotropy||1,Math.max(1,reportedMax));tex.anisotropy=effective;renderer.setSize(width,height,false);renderer.render(scene,camera);
const info={scope:'Isolated original paver bytes/metre-correct patch and native Three r128 MeshStandard shader captured then rasterized by Mesa llvmpipe; not browser, device, full scene, or FPS acceptance',width,height,options:opts,reportedMaxAnisotropy:reportedMax,effectiveAnisotropy:effective,texture:{width:tex.image.width,height:tex.image.height,rgbaSha256:createHash('sha256').update(tex.image.data).digest('hex'),minFilter:tex.minFilter,magFilter:tex.magFilter,generateMipmaps:tex.generateMipmaps,repeat:tex.repeat.toArray(),jointMetres:.6,tileMetres},camera:{position:camera.position.toArray(),projectionMatrix:camera.projectionMatrix.toArray(),matrixWorld:camera.matrixWorld.toArray(),groundY:y},productionCoastSha256:createHash('sha256').update(productionCoast).digest('hex'),runtimeSha256:createHash('sha256').update(fs.readFileSync(runtime)).digest('hex'),stats:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,programs:reflects.length,commands:commands.length,unknownMethods:[...unknown]},reflections:reflects,commands};
fs.writeFileSync(out,JSON.stringify(info));
console.log(JSON.stringify({out,...info.stats,texture:info.texture,effective}));
'''
(out/'native-paver-capture.mjs').write_text(s)

print(out/'native-paver-capture.mjs')
