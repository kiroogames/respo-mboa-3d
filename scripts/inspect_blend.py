# Inventaire Blender des objets, limites, matériaux et images de la scène chargée.
# Écrit seulement un rapport JSON du projet web et ne sauvegarde pas la scène Unity.

import bpy,json
from mathutils import Vector
scene=bpy.context.scene
objects=[]
for o in scene.objects:
    corners=[o.matrix_world@Vector(c) for c in o.bound_box] if o.type=='MESH' else []
    objects.append({'name':o.name,'type':o.type,'location':list(o.location),'rotation':list(o.rotation_euler),'dimensions':list(o.dimensions),'vertices':len(o.data.vertices) if o.type=='MESH' else 0,'materials':[m.name if m else None for m in o.data.materials] if o.type=='MESH' else [],'bounds':[[min(v[i] for v in corners) for i in range(3)],[max(v[i] for v in corners) for i in range(3)]] if corners else None})
images=[{'name':i.name,'path':i.filepath,'size':list(i.size),'packed':bool(i.packed_file)} for i in bpy.data.images]
materials=[{'name':m.name,'nodes':m.use_nodes,'diffuse':list(m.diffuse_color),'images':[n.image.name for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image] if m.use_nodes else []} for m in bpy.data.materials]
with open('E:/WORK_DEV_YOUMSI/DEVWORK/RESPOMBOA_WEB/respo-mboa-3d/scripts/blend-inspection.json','w',encoding='utf-8') as f:json.dump({'objects':objects,'images':images,'materials':materials},f,ensure_ascii=False,indent=2)
print('INSPECTION',len(objects),'objects',len(images),'images',len(materials),'materials')
