import json,pathlib,concurrent.futures,subprocess,os,sys
root=pathlib.Path('verification/npc-traffic/previews')
selected=set(sys.argv[1:]);jobs=[p for p in root.glob('*/*') if p.is_dir() and (not selected or p.parent.name in selected)]
def render(folder):
 env={**os.environ,'ROADSTER_PREVIEW_SAMPLES':'16'}
 log=folder/'blender.log'
 with log.open('w') as f:r=subprocess.run(['blender','-b','-noaudio','--factory-startup','--python','verification/npc-traffic/render-preview.py','--',str(folder),'front-three-quarter','rear-three-quarter','rear'],env=env,stdout=f,stderr=subprocess.STDOUT)
 if r.returncode:raise RuntimeError(str(folder))
 return str(folder)
with concurrent.futures.ThreadPoolExecutor(max_workers=2)as pool:
 for result in pool.map(render,jobs):print(result,flush=True)
