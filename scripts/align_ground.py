# Outil d’analyse Blender : compare les textures originale et étendue pour mesurer leur alignement.
# La recherche grossière puis fine estime l’échelle et le décalage ; les images sources ne sont pas modifiées.

import bpy,numpy as np,json
from pathlib import Path
base=Path('E:/WORK_DEV_YOUMSI/DEVWORK/LeResponsableMboa/Assets/Test/Sprites/Decor/WorldMap_WSP/3D/textures')
a=bpy.data.images.load(str(base/'Plan_de_travail_5.jpg'));b=bpy.data.images.load(str(base/'large map extended.jpg'))
aw,ah=a.size;bw,bh=b.size
p=np.array(a.pixels[:],dtype=np.float32).reshape(ah,aw,4)[:,:,:3];q=np.array(b.pixels[:],dtype=np.float32).reshape(bh,bw,4)[:,:,:3]
y,x=np.meshgrid(np.linspace(15,ah-16,42).astype(int),np.linspace(15,aw-16,42).astype(int),indexing='ij');x=x.ravel();y=y.ravel();colors=p[y,x]
best=(1e9,None)
for scale in np.arange(.96,1.05,.01):
 for dx in range(1150,1401,10):
  for dy in range(-40,41,10):
   xx=np.round(x*scale+dx).astype(int);yy=np.round(y*scale+dy).astype(int);valid=(xx>=0)&(xx<bw)&(yy>=0)&(yy<bh)
   error=float(np.mean((colors[valid]-q[yy[valid],xx[valid]])**2))
   if error<best[0]:best=(error,(float(scale),dx,dy))
scale,dx,dy=best[1];coarse=best
for sx in np.arange(scale-.012,scale+.012,.001):
 for tx in np.arange(dx-10,dx+11,1):
  for ty in np.arange(dy-10,dy+11,2):
   xx=np.round(x*sx+tx).astype(int);yy=np.round(y*sx+ty).astype(int);valid=(xx>=0)&(xx<bw)&(yy>=0)&(yy<bh)
   error=float(np.mean((colors[valid]-q[yy[valid],xx[valid]])**2))
   if error<best[0]:best=(error,(float(sx),float(tx),float(ty)))
r={'old_size':[aw,ah],'new_size':[bw,bh],'error':best[0],'scale':best[1][0],'offset_x':best[1][1],'offset_y':best[1][2]}
Path('artifacts/ground-alignment.json').write_text(json.dumps(r,indent=2));print('GROUND_ALIGNMENT',r)