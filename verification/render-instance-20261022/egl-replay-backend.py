"""Replay recorded native Three GL calls through CPU Mesa, without browser claims."""
import ctypes as C,json,math,struct,zlib,hashlib
from pathlib import Path
I=C.c_int;U=C.c_uint;P=C.c_void_p;F=C.c_float;B=C.c_ubyte
class Replay:
 def __init__(self,g):
  self.g=g;self.handles={};self.errors=[];self.failures=[];self.draws=0;self.triangles=0;self.uniform_calls=0;self.programs={};self.shaders={};self.state={};self.unsupported=[]
 def call(self,name,result,types,args):return self.g.gl('gl'+name[0].upper()+name[1:],result,*types)(*args)
 def key(self,v):return (v.get('kind'),v.get('id'))
 def handle(self,v):
  if v is None:return 0
  if isinstance(v,(int,float)):return int(v)
  key=self.key(v)
  if key in self.handles:return self.handles[key]
  if v.get('kind')=='uniformLocation':
   program=v['program'];pid=self.handles.get(('program',program),program if isinstance(program,int) else 0)
   value=self.call('getUniformLocation',I,[U,C.c_char_p],[pid,v['name'].encode()]);self.handles[key]=value;return value
  raise ValueError('unknown handle '+str(v))
 def typed(self,v):
  if v is None:return None
  if isinstance(v,dict):
   kind=v.get('type',v.get('$typed'));data=v.get('data')
   if data is None and 'base64' in v:
    import base64
    return C.create_string_buffer(base64.b64decode(v['base64']))
  else:kind='Float32Array';data=v
  types={'Float32Array':F,'Float64Array':C.c_double,'Uint8Array':B,'Uint8ClampedArray':B,'Int8Array':C.c_byte,'Uint16Array':C.c_ushort,'Int16Array':C.c_short,'Uint32Array':U,'Int32Array':I,'Array':F}
  if kind not in types:raise ValueError('unknown typed array '+str(kind))
  return (types[kind]*len(data))(*data)
 def save(self,v,result):
  if isinstance(v,dict):self.handles[self.key(v)]=result
 def gen(self,kind,v):
  name={'buffer':'Buffers','texture':'Textures','framebuffer':'Framebuffers','renderbuffer':'Renderbuffers','vertexArray':'VertexArrays','vertexArrayOES':'VertexArrays'}[kind]
  n=U();self.g.gl('glGen'+name,None,I,C.POINTER(U))(1,C.byref(n));self.save(v,n.value)
 def command(self,c):
  op=c['op'];a=c.get('args',[]);r=c.get('result');g=self.g
  if op=='createShader':
   n=self.call(op,U,[U],a);self.save(r,n);self.shaders[n]={'kind':a[0]};return
  if op=='createProgram':
   n=self.call(op,U,[],[]);self.save(r,n);self.programs[n]={'shaders':[]};return
  if op in ['createBuffer','createTexture','createFramebuffer','createRenderbuffer','createVertexArrayOES','createVertexArray']:
   self.gen(r['kind'] if r else op[6:].lower(),r);return
  if op=='shaderSource':
   n=self.handle(a[0]);s=C.c_char_p(a[1].encode());g.gl('glShaderSource',None,U,I,C.POINTER(C.c_char_p),C.POINTER(I))(n,1,C.byref(s),None);self.shaders[n]['sourceSha256']=hashlib.sha256(a[1].encode()).hexdigest();return
  if op=='compileShader':
   n=self.handle(a[0]);self.call(op,None,[U],[n]);ok=I();g.gl('glGetShaderiv',None,U,U,C.POINTER(I))(n,0x8B81,C.byref(ok));self.shaders[n]['compiled']=bool(ok.value)
   if not ok.value:self.failures.append({'shader':n,'compile':False})
   return
  if op=='attachShader':
   p,s=map(self.handle,a);self.call(op,None,[U,U],[p,s]);self.programs[p]['shaders'].append(s);return
  if op=='linkProgram':
   p=self.handle(a[0]);self.call(op,None,[U],[p]);ok=I();g.gl('glGetProgramiv',None,U,U,C.POINTER(I))(p,0x8B82,C.byref(ok));self.programs[p]['linked']=bool(ok.value)
   if not ok.value:self.failures.append({'program':p,'link':False})
   return
  if op=='bindAttribLocation':self.call(op,None,[U,U,C.c_char_p],[self.handle(a[0]),a[1],a[2].encode()]);return
  if op in ['getUniformLocation','getAttribLocation']:
   loc=self.call(op,I,[U,C.c_char_p],[self.handle(a[0]),a[1].encode()]);self.save(r,loc);return
  if op=='bufferData':
   buf=self.typed(a[1]) if not isinstance(a[1],(int,float)) else None;size=C.sizeof(buf) if buf is not None else int(a[1]);self.call(op,None,[U,C.c_ssize_t,P,U],[a[0],size,buf,a[2]]);return
  if op=='bufferSubData':
   buf=self.typed(a[2]);self.call(op,None,[U,C.c_ssize_t,C.c_ssize_t,P],[a[0],int(a[1]),C.sizeof(buf),buf]);return
  if op.startswith('uniformMatrix'):
   size=int(op[len('uniformMatrix')]);buf=self.typed(a[2]);count=len(buf)//(size*size);self.call(op,None,[I,I,B,P],[self.handle(a[0]),count,int(a[1]),buf]);self.uniform_calls+=1;return
  if op.startswith('uniform'):
   n=int(op[7]);kind=op[8:];loc=self.handle(a[0]);typ=I if kind.startswith('i') else F
   if kind.endswith('v'):
    buf=self.typed(a[1]);self.call(op,None,[I,I,P],[loc,len(buf)//n,buf])
   else:self.call(op,None,[I]+[typ]*n,[loc]+a[1:])
   self.uniform_calls+=1;return
  if op=='vertexAttribPointer':self.call(op,None,[U,I,U,B,I,P],a[:-1]+[P(a[-1])]);return
  if op.startswith('vertexAttrib') and op.endswith('fv'):
   buf=self.typed(a[1]);self.call(op,None,[U,P],[a[0],buf]);return
  if op in ['vertexAttribDivisorANGLE','vertexAttribDivisor']:
   self.call('vertexAttribDivisor',None,[U,U],a);return
  if op in ['drawElementsInstancedANGLE','drawElementsInstanced']:
   self.call('drawElementsInstanced',None,[U,I,U,P,I],a[:3]+[P(a[3]),a[4]]);self.draws+=1;self.triangles+=a[1]//3*a[4] if a[0]==4 else 0;return
  if op in ['drawArraysInstancedANGLE','drawArraysInstanced']:
   self.call('drawArraysInstanced',None,[U,I,I,I],a);self.draws+=1;self.triangles+=a[2]//3*a[3] if a[0]==4 else 0;return
  if op in ['drawBuffersWEBGL','drawBuffers']:
   buf=(U*len(a[0]))(*a[0]);self.call('drawBuffers',None,[I,P],[len(a[0]),buf]);return
  if op=='drawElements':
   self.call(op,None,[U,I,U,P],a[:-1]+[P(a[-1])]);self.draws+=1;self.triangles+=a[1]//3 if a[0]==4 else 0;return
  if op=='drawArrays':self.call(op,None,[U,I,I],a);self.draws+=1;self.triangles+=a[2]//3 if a[0]==4 else 0;return
  if op=='texImage2D':
   if len(a)!=9:raise ValueError('texImage2D DOM overload requires explicit pixels')
   buf=self.typed(a[8]);self.call(op,None,[U,I,I,I,I,I,U,U,P],a[:8]+[buf]);return
  if op=='texSubImage2D':
   buf=self.typed(a[8]);self.call(op,None,[U,I,I,I,I,I,U,U,P],a[:8]+[buf]);return
  if op in ['compressedTexImage2D','compressedTexSubImage2D']:raise ValueError('unsupported compressed textures')
  if op=='pixelStorei':
   if a[0] in [0x9240,0x9241,0x9243]:self.state[str(a[0])]=a[1];return
   self.call(op,None,[U,I],a);return
  if op=='getError' or op.startswith('get') or op in ['getContextAttributes','getSupportedExtensions','getExtension','isContextLost']:return
  if op in ['deleteBuffer','deleteTexture','deleteFramebuffer','deleteRenderbuffer','deleteVertexArrayOES','deleteVertexArray']:
   name={'deleteBuffer':'Buffers','deleteTexture':'Textures','deleteFramebuffer':'Framebuffers','deleteRenderbuffer':'Renderbuffers','deleteVertexArrayOES':'VertexArrays','deleteVertexArray':'VertexArrays'}[op];n=U(self.handle(a[0]));g.gl('glDelete'+name,None,I,C.POINTER(U))(1,C.byref(n));return
  # Handle-bearing commands followed by integer/enum scalars.
  handles={'useProgram':([U],[0]),'bindBuffer':([U,U],[1]),'bindTexture':([U,U],[1]),'bindFramebuffer':([U,U],[1]),'bindRenderbuffer':([U,U],[1]),'deleteShader':([U],[0]),'deleteProgram':([U],[0]),'detachShader':([U,U],[0,1]),'framebufferTexture2D':([U,U,U,U,I],[3]),'framebufferRenderbuffer':([U,U,U,U],[3]),'bindVertexArray':([U],[0]),'bindVertexArrayOES':([U],[0])}
  if op in handles:
   types,indices=handles[op];args=a.copy()
   for k in indices:args[k]=self.handle(args[k])
   self.call('bindVertexArray' if op=='bindVertexArrayOES' else op,None,types,args);return
  sig={
   'enable':[U],'disable':[U],'activeTexture':[U],'cullFace':[U],'frontFace':[U],'depthFunc':[U],'depthMask':[B],'colorMask':[B]*4,
   'clear':[U],'clearColor':[F]*4,'clearStencil':[I],'blendColor':[F]*4,'blendFunc':[U]*2,'blendFuncSeparate':[U]*4,'blendEquation':[U],'blendEquationSeparate':[U]*2,
   'viewport':[I]*4,'scissor':[I]*4,'lineWidth':[F],'polygonOffset':[F]*2,'enableVertexAttribArray':[U],'disableVertexAttribArray':[U],
   'texParameteri':[U,U,I],'texParameterf':[U,U,F],'generateMipmap':[U],'renderbufferStorage':[U,U,I,I],
   'stencilFunc':[U,I,U],'stencilFuncSeparate':[U,U,I,U],'stencilOp':[U]*3,'stencilOpSeparate':[U]*4,'stencilMask':[U],'stencilMaskSeparate':[U,U],
   'hint':[U,U],'finish':[],'flush':[],
  }
  if op in ['clearDepth','depthRange']:
   self.call(op+'f',None,[F]*len(a),a);return
  if op in sig:self.call(op,None,sig[op],a);return
  if op.startswith('vertexAttrib') and op[-1]=='f':self.call(op,None,[U]+[F]*(len(a)-1),a);return
  raise ValueError('unimplemented '+op)
 def run(self,v,out):
  cmds=v['commands'];error=self.g.gl('glGetError',U)
  for i,c in enumerate(cmds):
   try:self.command(c)
   except Exception as e:self.unsupported.append({'index':i,'op':c.get('op'),'error':str(e)});raise
   err=error()
   if err:self.errors.append({'index':i,'op':c['op'],'error':hex(err)})
  self.g.gl('glFinish',None)();buf=(B*(self.g.w*self.g.h*4))();self.g.gl('glReadPixels',None,I,I,I,I,U,U,P)(0,0,self.g.w,self.g.h,0x1908,0x1401,buf)
  raw=bytes(buf);row=self.g.w*4;raw=b''.join(raw[y*row:(y+1)*row] for y in reversed(range(self.g.h)))
  def chunk(typ,data):return struct.pack('!I',len(data))+typ+data+struct.pack('!I',zlib.crc32(typ+data)&0xffffffff)
  png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!IIBBBBB',self.g.w,self.g.h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(b'\0'+raw[y*row:(y+1)*row] for y in range(self.g.h)),6))+chunk(b'IEND',b'')
  Path(out).write_bytes(png)
  return {'scope':'Native Three captured command stream rendered by Mesa llvmpipe CPU; NOT browser/device GPU acceptance','renderer':self.g.string(0x1F01),'version':self.g.string(0x1F02),'commands':len(cmds),'drawCalls':self.draws,'triangles':self.triangles,'uniformCalls':self.uniform_calls,'programs':self.programs,'shaders':self.shaders,'glErrors':self.errors,'failures':self.failures,'png':str(out),'pngSha256':hashlib.sha256(png).hexdigest(),'rgbaSha256':hashlib.sha256(raw).hexdigest(),'nonzeroAlphaPixels':sum(raw[i]>0 for i in range(3,len(raw),4))}
