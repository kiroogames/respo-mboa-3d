# Contrôle géométrique à lancer dans Blender sur la source Unity.
# Vérifie les maisons hors chaussée et les segments du circuit exporté, puis écrit un rapport dans artifacts.

"""Check exported house footprints and continuous traffic against the source streets."""
import bpy,json,sys,math
import numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from wsp_roads import StreetMap
from wsp_layout import is_house
r=json.loads((ROOT/'scripts/wsp-report.json').read_text(encoding='utf8'));scale=r['expansion']['horizontal_scale']
image=bpy.data.images.load('E:/WORK_DEV_YOUMSI/DEVWORK/LeResponsableMboa/Assets/Test/Sprites/Decor/WorldMap_WSP/3D/textures/large map extended.jpg');image.scale(4096,2643)
w,h=image.size;pixels=np.empty(w*h*4,dtype=np.float32);image.pixels.foreach_get(pixels);pixels=pixels.reshape(h,w,4)[::4,::4,:3]
corners=[Vector(v['position']) for v in r['original_ground']];uvs=[Vector(v['uv']) for v in r['original_ground']]
def uv(x,y):
 x/=scale;y/=scale;origin=corners[0];a=corners[1]-origin;other=next(i for i in range(2,4) if abs(a.x*(corners[i].y-origin.y)-a.y*(corners[i].x-origin.x))>.01);b=corners[other]-origin;det=a.x*b.y-a.y*b.x;s=((x-origin.x)*b.y-(y-origin.y)*b.x)/det;t=(a.x*(y-origin.y)-a.y*(x-origin.x))/det;q=uvs[0]+s*(uvs[1]-uvs[0])+t*(uvs[other]-uvs[0]);return ((q.x*3840+1276)/6392,q.y)
streets=StreetMap(pixels,uv,{b['name']:b['source_footprint'] for b in r['buildings']},scale)
houses=[b for b in r['buildings'] if is_house(b['name'])]
collisions=[b['name'] for b in houses if streets.intersects(b['footprint'],.55)]
assert not collisions,collisions
traffic=json.loads((ROOT/'public/data/wsp-traffic.json').read_text());route=traffic['route'];assert route[0]==route[-1]
for a,b in zip(route,route[1:]):
 for t in np.linspace(0,1,max(2,math.ceil(math.dist(a,b)/.3))):
  x=float(a[0]+(b[0]-a[0])*t);y=float(-a[2]-(b[2]-a[2])*t)
  assert streets.clearance(x,y)>=1.1,(x,y)
  assert not any(p-.0<x<q and v<y<z for p,v,q,z in [n['footprint'] for n in r['buildings']]),(x,y)
result={'houses_checked':len(houses),'houses_on_streets':collisions,'closed_traffic_route':True,'traffic_points':len(route),'paved_lots':len(r['paving']['relocated_private_paved_lots'])}
(ROOT/'artifacts/streets-check.json').write_text(json.dumps(result,indent=2));print('STREETS_CHECK',json.dumps(result))
