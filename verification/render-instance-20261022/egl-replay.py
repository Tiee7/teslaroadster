#!/usr/bin/env python3
"""Read-only experiment: native Mesa llvmpipe CPU GLSL compilation/rasterization.
Not a browser, physical GPU, device acceptance, or production code change.
"""
import ctypes as C,ctypes.util,json,os,sys
os.environ.setdefault('LIBGL_ALWAYS_SOFTWARE','1')
os.environ.setdefault('MESA_SHADER_CACHE_DIR','/tmp/tesla-mesa-shader-cache')
I=C.c_int; U=C.c_uint; P=C.c_void_p; F=C.c_float; B=C.c_ubyte
class EGL:
 def __init__(self,w=1024,h=640):
  self.w=w;self.h=h;self.e=C.CDLL(C.util.find_library('EGL'));e=self.e
  e.eglGetProcAddress.argtypes=[C.c_char_p];e.eglGetProcAddress.restype=P
  plat=C.CFUNCTYPE(P,U,P,C.POINTER(I))(e.eglGetProcAddress(b'eglGetPlatformDisplayEXT'));self.d=plat(0x31DD,None,None)
  e.eglInitialize.argtypes=[P,C.POINTER(I),C.POINTER(I)];e.eglInitialize.restype=I
  ma=I();mi=I();assert e.eglInitialize(self.d,C.byref(ma),C.byref(mi)),'eglInitialize'
  e.eglChooseConfig.argtypes=[P,C.POINTER(I),C.POINTER(P),I,C.POINTER(I)];e.eglChooseConfig.restype=I
  attrs=(I*15)(0x3033,1,0x3040,4,0x3024,8,0x3023,8,0x3022,8,0x3021,8,0x3025,24,0x3038);conf=P();n=I();assert e.eglChooseConfig(self.d,attrs,C.byref(conf),1,C.byref(n)) and n.value,'eglChooseConfig'
  e.eglBindAPI.argtypes=[U];assert e.eglBindAPI(0x30A0)
  e.eglCreatePbufferSurface.argtypes=[P,P,C.POINTER(I)];e.eglCreatePbufferSurface.restype=P
  self.s=e.eglCreatePbufferSurface(self.d,conf,(I*5)(0x3057,w,0x3056,h,0x3038))
  e.eglCreateContext.argtypes=[P,P,P,C.POINTER(I)];e.eglCreateContext.restype=P
  self.c=e.eglCreateContext(self.d,conf,None,(I*3)(0x3098,2,0x3038))
  e.eglMakeCurrent.argtypes=[P,P,P,P];assert e.eglMakeCurrent(self.d,self.s,self.s,self.c),'eglMakeCurrent'
  self.functions={}
 def gl(self,name,result,*args):
  if name not in self.functions:
   p=self.e.eglGetProcAddress(name.encode());assert p,name
   self.functions[name]=C.CFUNCTYPE(result,*args)(p)
  return self.functions[name]
 def string(self,k):return self.gl('glGetString',C.c_char_p,U)(k).decode()
 def shader(self,kind,source):
  shader=self.gl('glCreateShader',U,U)(kind);raw=source.encode();s=C.c_char_p(raw)
  self.gl('glShaderSource',None,U,I,C.POINTER(C.c_char_p),C.POINTER(I))(shader,1,C.byref(s),None)
  self.gl('glCompileShader',None,U)(shader);ok=I();self.gl('glGetShaderiv',None,U,U,C.POINTER(I))(shader,0x8B81,C.byref(ok))
  size=I();self.gl('glGetShaderiv',None,U,U,C.POINTER(I))(shader,0x8B84,C.byref(size));buf=C.create_string_buffer(max(1,size.value));self.gl('glGetShaderInfoLog',None,U,I,C.POINTER(I),C.c_char_p)(shader,len(buf),None,buf)
  return shader,bool(ok.value),buf.value.decode()
 def compile(self,v,f,bindings=None):
  vs,vok,vlog=self.shader(0x8B31,v);fs,fok,flog=self.shader(0x8B30,f);p=self.gl('glCreateProgram',U)()
  self.gl('glAttachShader',None,U,U)(p,vs);self.gl('glAttachShader',None,U,U)(p,fs)
  for name,index in (bindings or {}).items():self.gl('glBindAttribLocation',None,U,U,C.c_char_p)(p,index,name.encode())
  self.gl('glLinkProgram',None,U)(p);ok=I();self.gl('glGetProgramiv',None,U,U,C.POINTER(I))(p,0x8B82,C.byref(ok));size=I();self.gl('glGetProgramiv',None,U,U,C.POINTER(I))(p,0x8B84,C.byref(size));buf=C.create_string_buffer(max(1,size.value));self.gl('glGetProgramInfoLog',None,U,I,C.POINTER(I),C.c_char_p)(p,len(buf),None,buf)
  result={'linked':bool(ok.value),'vertexCompiled':vok,'fragmentCompiled':fok,'log':buf.value.decode(),'vertexLog':vlog,'fragmentLog':flog,'uniforms':[],'attributes':[]}
  if ok.value:
   for target,count,fn,maxlen in [('uniforms',0x8B86,'glGetActiveUniform',0x8B87),('attributes',0x8B89,'glGetActiveAttrib',0x8B8A)]:
    n=I();m=I();self.gl('glGetProgramiv',None,U,U,C.POINTER(I))(p,count,C.byref(n));self.gl('glGetProgramiv',None,U,U,C.POINTER(I))(p,maxlen,C.byref(m))
    for index in range(n.value):
     name=C.create_string_buffer(max(1,m.value));length=I();num=I();typ=U();self.gl(fn,None,U,U,I,C.POINTER(I),C.POINTER(I),C.POINTER(U),C.c_char_p)(p,index,len(name),C.byref(length),C.byref(num),C.byref(typ),name)
     loc=self.gl('glGetUniformLocation' if target=='uniforms' else 'glGetAttribLocation',I,U,C.c_char_p)(p,name.value)
     result[target].append({'name':name.value.decode(),'type':typ.value,'size':num.value,'location':loc})
  return p,result
 def close(self):
  e=self.e;e.eglMakeCurrent(self.d,None,None,None)
  for name,args in [('eglDestroyContext',(self.d,self.c)),('eglDestroySurface',(self.d,self.s))]:
   fn=getattr(e,name);fn.argtypes=[P,P];fn(*args)
  e.eglTerminate.argtypes=[P];e.eglTerminate(self.d)
if __name__=='__main__':
 mode=sys.argv[1];input=json.load(open(sys.argv[2]));gl=EGL(input.get('width',1024),input.get('height',640))
 try:
  if mode=='reflect':
   p,result=gl.compile(input.get('vertexShader',input.get('vertexSource',input.get('vertex'))),input.get('fragmentShader',input.get('fragmentSource',input.get('fragment'))),input.get('bindings'));print(json.dumps(result))
  elif mode=='replay':
   from importlib.machinery import SourceFileLoader
   Replay=SourceFileLoader('backend',str(__import__('pathlib').Path(__file__).with_name('egl-replay-backend.py'))).load_module().Replay
   out=sys.argv[3] if len(sys.argv)>3 else sys.argv[2]+'.png';print(json.dumps(Replay(gl).run(input,out)))
  else:raise SystemExit('Unknown mode')
 finally:gl.close()
