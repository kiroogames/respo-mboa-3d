# Construction du GLB depuis le fichier Blender Unity ouvert en lecture : aucune sauvegarde du .blend source.
# Les paramètres de city-layout.json pilotent l’espacement et l’agrandissement de la présidence ; les assertions valident le résultat.

"""Export an expanded WSP city with separated houses. Never saves the Unity source."""
import bpy, math, json, random, sys
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[1]
ASSETS=Path('E:/WORK_DEV_YOUMSI/DEVWORK/LeResponsableMboa/Assets')
BASE=ASSETS/'Test/Sprites/Decor/WorldMap_WSP';TEX=BASE/'3D/textures'
OUT=ROOT/'public/models/mboa-wsp.glb'
SETTINGS=json.loads((ROOT/'city-layout.json').read_text(encoding='utf8'))
CITY_SCALE=float(SETTINGS['horizontalScale'])
MIN_HOUSE_GAP=float(SETTINGS['minimumHouseGap'])
PRESIDENCY_SCALE=float(SETTINGS.get('presidencyScale',1.0))
sys.path.insert(0,str(ROOT/'scripts'))
from wsp_layout import spread_city, is_house, rectangle_gap
report={'scene':'Assets/Test/Scenes/Scene_WorldMap_WSP.unity','source':'3D WorldMap_003.blend','layout':'WSP district layout expanded horizontally; native buildings keep their dimensions; residential plots separated; presidency on its own western hill','materials_repaired':[],'materials_replaced':[],'buildings':[]}
def material(name,color):
    m=bpy.data.materials.new(name);m.use_nodes=True
    rgb=tuple((int(color[i:i+2],16)/255)**2.2 for i in (1,3,5));m.diffuse_color=(*rgb,1)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*rgb,1);p.inputs['Roughness'].default_value=.9
    return m
def mesh(name,vertices,faces,mats):
    data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update()
    for m in mats:data.materials.append(m)
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);return o
def box(name,x,y,z,w,d,h,mat,angle=0,top=True):
    o=mesh(name,[(a*w/2,b*d/2,c*h) for a,b,c in [(-1,-1,0),(1,-1,0),(1,1,0),(-1,1,0),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]],[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)][:6 if top else 5],[mat])
    o.location=(x,y,z);o.rotation_euler.z=angle;return o
def cylinder(name,x,y,z,r,h,mat,n=16):
    return mesh(name,[(x+r*math.cos(i*math.tau/n),y+r*math.sin(i*math.tau/n),z+j*h) for j in [0,1] for i in range(n)],[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],[mat])
def ellipsoid(name,x,y,z,sx,sy,sz,mat):
    n=10;rings=6;vs=[];fs=[]
    for j in range(rings+1):
        a=math.pi*j/rings
        for i in range(n):
            b=math.tau*i/n;vs.append((x+sx*math.sin(a)*math.cos(b),y+sy*math.sin(a)*math.sin(b),z+sz*math.cos(a)))
    for j in range(rings):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;fs.append((a,b,b+n,a+n))
    o=mesh(name,vs,fs,[mat])
    for f in o.data.polygons:f.use_smooth=True
    return o
for image in bpy.data.images:
    if image.packed_file:continue
    filename=image.filepath.replace('\\','/').split('/')[-1]
    for path in [TEX/filename,TEX/image.name,TEX/image.name.removesuffix('.001')]:
        if path.is_file():image.filepath=str(path);image.reload();break
overrides={'mat_office':TEX/'Office_principal.png','Mat3D_police':TEX/'Police.png','Fapmous':TEX/'Fapmous.png'}
fallback={'preidence ext':'#DDE8E3','preidence ext 2':'#6191A3','player home':'#E5CEAC','Eglis ext down':'#EFE6C9','home rich 3 ext ':'#E4D3AF','home rich 3 ext 2':'#C4D6D1','home rich 3 ext toit':'#A56150','core':'#BAC1BC'}
for m in list(bpy.data.materials):
    tex=next((n.image for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and n.image.size[0]>0),None) if m.use_nodes else None
    if m.name in overrides and overrides[m.name].is_file():tex=bpy.data.images.load(str(overrides[m.name]),check_existing=True)
    original=tuple(m.diffuse_color);m.use_nodes=True;m.node_tree.nodes.clear()
    out=m.node_tree.nodes.new('ShaderNodeOutputMaterial');p=m.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
    p.inputs['Roughness'].default_value=.93;p.inputs['Metallic'].default_value=0
    p.inputs['Base Color'].default_value=(*((int(fallback[m.name][i:i+2],16)/255)**2.2 for i in (1,3,5)),1) if m.name in fallback else original
    m.node_tree.links.new(p.outputs['BSDF'],out.inputs['Surface'])
    if tex:
        node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=tex;node.extension='EXTEND';m.node_tree.links.new(node.outputs['Color'],p.inputs['Base Color'])
        report['materials_repaired'].append({'material':m.name,'image':tex.name})
    else:report['materials_replaced'].append(m.name)
    m.use_backface_culling=True
cream=material('WSP Enduit ivoire','#E3DED0');roof=material('WSP Toitures terre cuite','#B77D61');glass=material('WSP Verrieres','#517D88');wood=material('WSP Bois','#7E6043');stone=material('WSP Fondations','#B3A48B')
leaf=[material('WSP Feuillage '+str(i),c) for i,c in enumerate(['#4D7540','#678E47','#7D9A50'])]
# Evaluate modifiers in their original coordinate system before baking transforms.
for obj in bpy.context.scene.objects:
    if obj.type=='MESH':obj.hide_set(False);obj.hide_viewport=False;obj.hide_render=False
bpy.context.view_layer.update();depsgraph=bpy.context.evaluated_depsgraph_get()
evaluated_meshes={obj.name:bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph),preserve_all_data_layers=True,depsgraph=depsgraph) for obj in bpy.context.scene.objects if obj.type=='MESH' and obj.name!='bg' and not obj.name.startswith('Plane')}
for obj in list(bpy.context.scene.objects):
    if obj.type=='MESH' and obj.name.startswith('Plane'):bpy.data.objects.remove(obj,do_unlink=True)
ground=bpy.data.objects['bg'];bpy.context.view_layer.update()
ground.data=ground.data.copy();ground.data.transform(ground.matrix_world);ground.matrix_world=Matrix.Identity(4)
corners=[v.co.copy() for v in ground.data.vertices];uvs={loop.vertex_index:ground.data.uv_layers.active.data[loop.index].uv.copy() for loop in ground.data.loops}
report['original_ground']=[{'position':list(v.co),'uv':list(uvs[v.index])} for v in ground.data.vertices]
x0=min(v.x for v in corners);x1=max(v.x for v in corners);y0=min(v.y for v in corners);y1=max(v.y for v in corners)
bgmat=ground.data.materials[0]
bgimage=bpy.data.images.load(str(TEX/'large map extended.jpg'),check_existing=True)
# The extended artwork is the same source at its original scale, with 1276 pixels added on either side.
report['ground_alignment']={'original':[3840,4124],'extended':[6392,4124],'offset_x':1276,'scale':1.0}
bgimage.scale(4096,2643)
next(n for n in bgmat.node_tree.nodes if n.type=='TEX_IMAGE').image=bgimage
pw,ph=bgimage.size
pixel_buffer=np.empty(pw*ph*4,dtype=np.float32);bgimage.pixels.foreach_get(pixel_buffer)
pixel_grid=pixel_buffer.reshape(ph,pw,4)[::4,::4,:3].copy();del pixel_buffer
sample_h,sample_w=pixel_grid.shape[:2]
def ground_uv(x,y):
    x/=CITY_SCALE;y/=CITY_SCALE
    origin=corners[0];a=corners[1]-origin;other=next(i for i in range(2,4) if abs(a.x*(corners[i].y-origin.y)-a.y*(corners[i].x-origin.x))>.01)
    b=corners[other]-origin;det=a.x*b.y-a.y*b.x;s=((x-origin.x)*b.y-(y-origin.y)*b.x)/det;t=(a.x*(y-origin.y)-a.y*(x-origin.x))/det
    uv=uvs[0]+s*(uvs[1]-uvs[0])+t*(uvs[other]-uvs[0])
    return Vector(((uv.x*3840+1276)/6392,uv.y))
def painted_color(x,y):
    uv=ground_uv(x,y);u=max(0,min(sample_w-1,round(uv.x*(sample_w-1))));v=max(0,min(sample_h-1,round(uv.y*(sample_h-1))));return pixel_grid[v,u]
native_bounds={}
for name,data in evaluated_meshes.items():
    points=[bpy.data.objects[name].matrix_world@vertex.co for vertex in data.vertices]
    native_bounds[name]=(min(v.x for v in points),min(v.y for v in points),max(v.x for v in points),max(v.y for v in points))
from wsp_roads import StreetMap
streets=StreetMap(pixel_grid,ground_uv,native_bounds,CITY_SCALE)
report['streets']=streets.report()
layout_offsets,report['expansion']=spread_city(native_bounds,CITY_SCALE,MIN_HOUSE_GAP,painted_color,(-69,5),streets)
# Relocate private paving with the homes that originally had a paved courtyard.
# Paint the terrain texture itself: no extra coplanar surface to flicker at distance.
paving_pixels=np.empty(pw*ph*4,dtype=np.float32);bgimage.pixels.foreach_get(paving_pixels)
paving_pixels=paving_pixels.reshape(ph,pw,4)
paved_lots=[]
for name,rect in native_bounds.items():
    if not is_house(name):continue
    a,b,c,d=rect
    original=[painted_color(float((a+(c-a)*u)*CITY_SCALE),float((b+(d-b)*v)*CITY_SCALE)) for u in np.linspace(.15,.85,9) for v in np.linspace(.15,.85,9)]
    grays=[p for p in original if max(p)-min(p)<.13 and .2<p[0]<.87]
    if len(grays)/len(original)<.25:continue
    dx,dy=layout_offsets[name];a+=dx;b+=dy;c+=dx;d+=dy
    uv0=ground_uv(a-.7,b-.7);uv1=ground_uv(c+.7,d+.7)
    left,right=sorted([round(uv0.x*(pw-1)),round(uv1.x*(pw-1))]);bottom,top=sorted([round(uv0.y*(ph-1)),round(uv1.y*(ph-1))])
    color=np.median(grays,axis=0)
    for j in range(max(0,bottom),min(ph,top+1)):
        for i in range(max(0,left),min(pw,right+1)):
            edge=min(i-left,right-i,j-bottom,top-j)
            blend=min(1.,max(0.,edge/1.5))
            paving_pixels[j,i,:3]=paving_pixels[j,i,:3]*(1-blend)+color*blend
    paved_lots.append(name)
bgimage.pixels.foreach_set(paving_pixels.ravel());bgimage.update();del paving_pixels
report['paving']={'relocated_private_paved_lots':paved_lots,'integrated_in_terrain_texture':True}
# Le profil de la colline est indépendant de la taille du palais : agrandir le bâtiment ne relève pas les quartiers.
HILL_HEIGHT=30.0
HILL_CENTER_X=-177.0*CITY_SCALE
HILL_CENTER_Y=64.0*CITY_SCALE
PRESIDENCY_OFFSET_X=-69.0
PRESIDENCY_OFFSET_Y=5.0
HILL_RADIUS_WEST=85.0*CITY_SCALE
HILL_RADIUS_EAST=80.0*CITY_SCALE
HILL_RADIUS_NORTH=70.0*CITY_SCALE
HILL_RADIUS_SOUTH=90.0*CITY_SCALE
HILL_PLATEAU=.28
HILL_SHOULDER=.2
TERRACE_BLEND=18.0
TERRACE_ADJUSTMENT=1.25

def hill_shape(x,y):
    # A rounded summit with long, near-constant grades and eased shoulders/toes.
    # The north slope reaches sea level before the artwork's northern boundary.
    radius_y=HILL_RADIUS_NORTH if y>=HILL_CENTER_Y else HILL_RADIUS_SOUTH
    radius_x=HILL_RADIUS_WEST if x<HILL_CENTER_X else HILL_RADIUS_EAST
    radius=math.hypot((x-HILL_CENTER_X)/radius_x,(y-HILL_CENTER_Y)/radius_y)
    t=max(0,min(1,(radius-HILL_PLATEAU)/(1-HILL_PLATEAU)))
    edge=HILL_SHOULDER
    if t<edge:descent=t*t/(2*edge*(1-edge))
    elif t>1-edge:descent=1-(1-t)**2/(2*edge*(1-edge))
    else:descent=(t-edge/2)/(1-edge)
    return HILL_HEIGHT*(1-descent)
# Level plots on the lower slopes avoid tall exposed plinths under neighbouring homes.
terraces=[]
for obj in bpy.context.scene.objects:
    if obj.type!='MESH' or obj.name in ['bg','presidence'] or obj.name.startswith('Plane'):continue
    dx,dy=layout_offsets[obj.name]
    points=[obj.matrix_world@v.co+Vector((dx,dy,0)) for v in evaluated_meshes[obj.name].vertices]
    a=min(v.x for v in points);b=min(v.y for v in points);c=max(v.x for v in points);d=max(v.y for v in points)
    floor=hill_shape((a+c)/2,(b+d)/2)
    if max(hill_shape(x,y) for x in [a,c] for y in [b,d])>.8:terraces.append((a-.25,b-.25,c+.25,d+.25,floor))
def height(x,y):
    base=hill_shape(x,y)
    # Blend neighbouring plots together; sequential flattening made sharp ridges
    # between close houses. Limit earthworks so they cannot undo the gentle hill.
    weight_sum=0.0;floor_sum=0.0;influence=0.0
    for a,b,c,d,floor in terraces:
        distance=math.hypot(max(a-x,0,x-c),max(b-y,0,y-d))
        if distance>=TERRACE_BLEND:continue
        t=distance/TERRACE_BLEND;weight=1-t*t*(3-2*t)
        weight_sum+=weight;floor_sum+=weight*floor;influence=max(influence,weight)
    if not weight_sum:return base
    summit=min(1,(HILL_HEIGHT-base)/4);summit=summit*summit*(3-2*summit)
    adjustment=TERRACE_ADJUSTMENT*math.tanh((floor_sum/weight_sum-base)/TERRACE_ADJUSTMENT)
    return base+influence*summit*adjustment

span=x1-x0
x0=x0-span*1276/3840;x1=x0+span*6392/3840
x0*=CITY_SCALE;x1*=CITY_SCALE;y1*=CITY_SCALE
artwork_west=x0
x0=min(x0,HILL_CENTER_X-HILL_RADIUS_WEST-8*CITY_SCALE)
forest_ground=material('WSP Prairie de la colline','#FFFFFF')
y0=min(y0,-130.0)*CITY_SCALE
vs=[];fs=[];nx=320;ny=300
for j in range(ny+1):
    y=y0+(y1-y0)*j/ny
    for i in range(nx+1):
        x=x0+(x1-x0)*i/nx;vs.append((x,y,height(x,y)))
for j in range(ny):
    for i in range(nx):a=j*(nx+1)+i;fs.append((a,a+1,a+nx+2,a+nx+1))
bpy.data.objects.remove(ground,do_unlink=True)
terrain=mesh('WSP Sol et voirie origine',vs,fs,[bgmat,forest_ground]);uv=terrain.data.uv_layers.new(name='UVMap')
for face in terrain.data.polygons:
    if face.center.x<artwork_west:face.material_index=1
for loop in terrain.data.loops:
    v=terrain.data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=ground_uv(v.x,v.y)
# Use the same texture workflow as the original artwork, with a blended edge.
forest_tone=painted_color(-160*CITY_SCALE,65*CITY_SCALE).copy();fw,fh=192,512
forest_pixels=np.ones((fh,fw,4),dtype=np.float32)
for j in range(fh):
    y=y0+(y1-y0)*j/(fh-1);edge_color=painted_color(artwork_west,y)
    for i in range(fw):
        x=x0+(artwork_west-x0)*i/(fw-1);t=max(0,min(1,(artwork_west-x)/(42*CITY_SCALE)));t=t*t*(3-2*t)
        noise=.012*math.sin(x*.12+y*.08)*math.sin(y*.19)
        forest_pixels[j,i,:3]=np.clip(edge_color*(1-t)+(forest_tone+noise)*t,0,1)
forest_image=bpy.data.images.new('WSP Prairie prolongee',width=fw,height=fh,alpha=False)
forest_image.colorspace_settings.name=bgimage.colorspace_settings.name
forest_image.pixels.foreach_set(forest_pixels.ravel());forest_image.update()
forest_node=forest_ground.node_tree.nodes.new('ShaderNodeTexImage');forest_node.image=forest_image;forest_node.extension='EXTEND'
forest_ground.node_tree.links.new(forest_node.outputs['Color'],forest_ground.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
for face in terrain.data.polygons:
    if face.material_index!=1:continue
    for loop_index in face.loop_indices:
        point=terrain.data.vertices[terrain.data.loops[loop_index].vertex_index].co
        uv.data[loop_index].uv=((point.x-x0)/(artwork_west-x0),(point.y-y0)/(y1-y0))
for f in terrain.data.polygons:f.use_smooth=True
source=[o for o in list(bpy.context.scene.objects) if o.type=='MESH' and o!=terrain]
for o in list(bpy.context.scene.objects):
    if o.type!='MESH':bpy.data.objects.remove(o,do_unlink=True)
footprints=[]
for o in source:
    o.hide_set(False);o.hide_viewport=False;o.hide_render=False
    o.data=evaluated_meshes[o.name];o.data.transform(o.matrix_world);o.modifiers.clear();o.matrix_world=Matrix.Identity(4)
    dx,dy=layout_offsets[o.name];o.data.transform(Matrix.Translation((dx,dy,0)))
    if not o.data.materials:o.data.materials.append(leaf[1] if o.name.startswith('Plane') else cream)
    lo=Vector(tuple(min(v.co[i] for v in o.data.vertices) for i in range(3)));hi=Vector(tuple(max(v.co[i] for v in o.data.vertices) for i in range(3)))
    original=native_bounds[o.name]
    assert abs((hi.x-lo.x)-(original[2]-original[0]))<.001 and abs((hi.y-lo.y)-(original[3]-original[1]))<.001, 'A native building was stretched'
    # Exception voulue à la taille native : agrandissement uniforme autour du centre au sol, sans déplacer le pied.
    if o.name=='presidence':
        anchor=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
        o.data.transform(Matrix.Translation(anchor)@Matrix.Scale(PRESIDENCY_SCALE,4)@Matrix.Translation(-anchor))
        lo=Vector(tuple(min(v.co[i] for v in o.data.vertices) for i in range(3)));hi=Vector(tuple(max(v.co[i] for v in o.data.vertices) for i in range(3)))
    stacked=o.name in ['contenair_police','comissariat','HotelDePolilce fontaine']
    # Le point le plus haut sous la parcelle fixe le sol ; le socle comble ensuite le volume pour éviter un bâtiment flottant.
    level=max(height(x,y) for x in [lo.x,(lo.x+hi.x)/2,hi.x] for y in [lo.y,(lo.y+hi.y)/2,hi.y]);shift=level+.035-lo.z if not stacked else 1.15
    o.data.transform(Matrix.Translation((0,0,shift)))
    if not o.name.startswith('Plane'):
        footprints.append((lo.x,lo.y,hi.x,hi.y));report['buildings'].append({'name':o.name,'footprint':[lo.x,lo.y,hi.x,hi.y],'ground':level,'shift_z':shift,'native_height':hi.z-lo.z,'source_footprint':list(native_bounds[o.name]),'translation_xy':list(layout_offsets[o.name])})
    if level>.15 and not stacked:box('WSP Assise '+o.name,(lo.x+hi.x)/2,(lo.y+hi.y)/2,0,hi.x-lo.x,hi.y-lo.y,level+.035,stone)
    if o.name in ['presidence','house_player','Rich home 3','Rich home 2','hopital','Hopital 2','Hopital 3','Hopital 4','eglise','Mboabet']:
        o.data.materials.clear();o.data.materials.append(cream);o.data.materials.append(roof);o.data.materials.append(glass)
        for f in o.data.polygons:f.material_index=1 if f.normal.z>.45 else 0
        if o.name=='presidence':
            for f in o.data.polygons:f.material_index=0 if f.normal.z>.45 else (2 if f.center.z>level+2 and f.area<4 else 0)
earth=material('WSP Terre des abords','#C09462')
# The terrain supplies the visible top. A second cap only 2 cm below it flickered at distant zoom.
landscape_base=box('WSP Socle paysage',(x0+x1)/2,(y0+y1)/2,-3,x1-x0,y1-y0,3,earth,top=False)
assert not any(face.normal.z>.9 for face in landscape_base.data.polygons),'A duplicate terrain cap would reintroduce flickering'
report['rendering']={'landscape_base_has_top':False,'base_upward_faces':0}
sea=material('WSP Eau turquoise','#43B8BF');box('WSP Horizon marin',0,320*CITY_SCALE,-2.5,1800*CITY_SCALE,560*CITY_SCALE,.3,sea)
anchors=[(x*CITY_SCALE,y*CITY_SCALE) for x,y in [(-109,51),(-122,43),(-133,22),(-155,26),(-173,37)]]
palace=bpy.data.objects['presidence']
palace_min=Vector(tuple(min(v.co[i] for v in palace.data.vertices) for i in range(3)))
palace_max=Vector(tuple(max(v.co[i] for v in palace.data.vertices) for i in range(3)))
anchors.append(((palace_min.x+palace_max.x)/2+.5,palace_min.y+.3))
path=[]
for segment in range(len(anchors)-1):
    p0=Vector(anchors[max(0,segment-1)]);p1=Vector(anchors[segment]);p2=Vector(anchors[segment+1]);p3=Vector(anchors[min(len(anchors)-1,segment+2)])
    for k in range(16):
        t=k/16;point=.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t);path.append(point)
path.append(Vector(anchors[-1]))

rng=random.Random(381);tree_positions=[]
for _ in range(6500):
    x=rng.uniform(x0+2,x1-2);y=rng.uniform(y0+2,y1-2);r,g,b=painted_color(x,y)
    if not(g>r*1.09 and g>b*1.2):continue
    radius=rng.uniform(1.25,2.2)
    if any(a-radius-1<x<c+radius+1 and b-radius-1<y<d+radius+1 for a,b,c,d in footprints):continue
    if any((x-point.x)**2+(y-point.y)**2<(radius+3.2)**2 for point in path):continue
    if any((x-a)**2+(y-b)**2<(radius+q+1)**2 for a,b,q in tree_positions):continue
    z=height(x,y);size=rng.uniform(.8,1.25);cylinder('WSP Tronc',x,y,z,.18*size,2.2*size,wood,8)
    ellipsoid('WSP Arbre',x,y,z+3*size,radius,radius*.85,2*size,leaf[len(tree_positions)%3]);ellipsoid('WSP Couronne secondaire',x+.7,y-.3,z+2.7*size,radius*.72,radius*.7,1.5*size,leaf[(len(tree_positions)+1)%3])
    tree_positions.append((x,y,radius))
    if len(tree_positions)>=300:break
report['presidential_hill']={
    'summit_height':HILL_HEIGHT,'center':[HILL_CENTER_X,HILL_CENTER_Y],'presidency_offset':list(layout_offsets['presidence']),'profile':'isolated wooded hill with rounded summit and broad eased slopes',
    'radius_west':HILL_RADIUS_WEST,'radius_east':HILL_RADIUS_EAST,'radius_north':HILL_RADIUS_NORTH,'radius_south':HILL_RADIUS_SOUTH,
    'terrace_blend':TERRACE_BLEND,'terrace_adjustment_limit':TERRACE_ADJUSTMENT,'terraced_plots':len(terraces),
    'old_profile_max_grade':30*math.sqrt(2/220)*math.exp(-.5),
    'profile_max_grade':HILL_HEIGHT/((1-HILL_PLATEAU)*(1-HILL_SHOULDER)*min(HILL_RADIUS_WEST,HILL_RADIUS_EAST,HILL_RADIUS_NORTH,HILL_RADIUS_SOUTH)),
}
report['trees']=len(tree_positions)
# A physical bridge follows the painted road and continues above the water.
bridge=material('WSP Tablier du pont','#BAAA91');rail=material('WSP Garde corps','#E2D8BF')
bridge_path=[(x*CITY_SCALE,y*CITY_SCALE,z) for x,y,z in [(72,69,.2),(113,137,.65),(135,174,.65)]]
def beam(name,p,q,width,depth,mat):
    dx=q[0]-p[0];dy=q[1]-p[1];length=math.hypot(dx,dy)
    ox=dy/length*width/2;oy=-dx/length*width/2
    vertices=[(v[0]+side*ox,v[1]+side*oy,v[2]+rise) for rise in [0,depth] for v,side in [(p,-1),(p,1),(q,1),(q,-1)]]
    return mesh(name,vertices,[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],[mat])
for p,q in zip(bridge_path,bridge_path[1:]):
    beam('WSP Pont',p,q,3.7*CITY_SCALE,.45,bridge)
    dx=q[0]-p[0];dy=q[1]-p[1];length=math.hypot(dx,dy)
    for side in [-1,1]:
        ox=side*dy/length*1.75*CITY_SCALE;oy=-side*dx/length*1.75*CITY_SCALE
        beam('WSP Rive pont',(p[0]+ox,p[1]+oy,p[2]+.5),(q[0]+ox,q[1]+oy,q[2]+.5),.14,.2,rail)
    for j in range(1,int(length/12)+1):
        t=j*12/length;x=p[0]+dx*t;y=p[1]+dy*t
        cylinder('WSP Pile du pont',x,y,-3,.6,3+p[2]+(q[2]-p[2])*t,stone,12)
# A curved drive connects the relocated presidency to the original western road.
road_mat=material('WSP Route de la presidence','#686A62');road_edge=material('WSP Bordures de la presidence','#E4D7BA')

def driveway_strip(name,left,right,mat):
    vertices=[];faces=[];lanes=max(1,math.ceil((right-left)/.65));stride=lanes+1
    for i,p in enumerate(path):
        tangent=(path[min(i+1,len(path)-1)]-path[max(0,i-1)]).normalized();normal=Vector((-tangent.y,tangent.x))
        for lane in range(stride):
            side=left+(right-left)*lane/lanes;q=p+normal*side
            vertices.append((q.x,q.y,height(q.x,q.y)+.18))
    for i in range(len(path)-1):
        for lane in range(lanes):
            a=i*stride+lane;faces.append((a,a+stride,a+stride+1,a+1))
    obj=mesh(name,vertices,faces,[mat])
    for face in obj.data.polygons:face.use_smooth=True
    return obj
driveway_strip('WSP Acces a la presidence',-2.2,2.2,road_mat)
driveway_strip('WSP Bordure acces gauche',-2.38,-2.2,road_edge)
driveway_strip('WSP Bordure acces droite',2.2,2.38,road_edge)
report['presidential_hill']['access_road_points']=len(path)
road_clearance=min(math.hypot(x-point.x,y-point.y)-radius for x,y,radius in tree_positions for point in path)
assert road_clearance>=3.2,'A tree has grown into the presidential drive'
report['presidential_hill']['tree_road_clearance']=road_clearance
# Light fittings glow after sunset without filling the scene with expensive point lights.
lamp=material('Verre des lampadaires','#E6D7A0');pole=material('WSP Lampadaires','#52645B');lamp_count=0
for k in range(12):
    a=math.tau*k/12;x=(-15.86+10.3*math.cos(a))*CITY_SCALE;y=(.7+10.3*math.sin(a))*CITY_SCALE
    if any(x0-.5<x<x1+.5 and y0-.5<y<y1+.5 for x0,y0,x1,y1 in footprints):continue
    z=height(x,y);cylinder('WSP Lampadaire',x,y,z,.09,4.5,pole,8);box('WSP Lanterne',x,y,z+4.5,.55,.55,.3,lamp);lamp_count+=1
report['lamps']=lamp_count
pitch=material('WSP Gazon du stade','#567C3C');line=material('WSP Lignes du stade','#F6F0D7');cx,cy=96+layout_offsets['stadium'][0],-12+layout_offsets['stadium'][1];angle=math.pi/4
box('WSP Pelouse du stade',cx,cy,.65,23,31,.1,pitch,angle)
def pitch_point(x,y):return (cx+x*math.cos(angle)-y*math.sin(angle),cy+x*math.sin(angle)+y*math.cos(angle))
for x in [-10.5,10.5]:
    a,b=pitch_point(x,0);box('WSP Touche',a,b,.78,.12,28,.02,line,angle)
for y in [-14,0,14]:
    a,b=pitch_point(0,y);box('WSP Ligne de terrain',a,b,.78,21,.12,.02,line,angle)
sys.path.insert(0,str(ROOT/'scripts'))
from wsp_details import enhance_city
report['enhancements']=enhance_city(ROOT,source,footprints,painted_color,height,material,mesh,box,cylinder,ellipsoid,(x0,x1,y0,y1),CITY_SCALE,streets)
report['landmarks']={'square':[-15.86,0.7,23],'market':[-53,-27,4],'ministry':[3.74,34.39,29],'presidency':[-108.98+PRESIDENCY_OFFSET_X,59.55+PRESIDENCY_OFFSET_Y,41],'stadium':[96,-12,11],'airport':[86,44,22],'njoka':[53,-37,12]}
report['landmarks']={key:[value[0]*CITY_SCALE,value[1]*CITY_SCALE,value[2]] for key,value in report['landmarks'].items()}
report['ground_bounds']={'west':x0,'east':x1,'south':y0,'north':y1};report['source_meshes']=len(source)
assert len(source)>150 and any(o.name=='stadium' for o in source) and any(o.name=='Airport 1' for o in source)
assert all(abs(record['native_height'])>0 for record in report['buildings'])
house_plots=[record for record in report['buildings'] if is_house(record['name'])]
actual_gaps=[rectangle_gap(a['footprint'],b['footprint']) for i,a in enumerate(house_plots) for b in house_plots[i+1:]]
assert min(actual_gaps)>=MIN_HOUSE_GAP-.001,'Exported house plots still touch'
report['expansion']['verified_export_gap']=min(actual_gaps)
report['expansion']['terrain_width']=x1-x0;report['expansion']['terrain_depth']=y1-y0
neighbour_levels=[record['ground'] for record in report['buildings'] if record['name']!='presidence']
report['presidential_hill']['maximum_neighbour_ground']=max(neighbour_levels)
assert max(neighbour_levels)<.5,'The presidency hill has lifted an existing neighbourhood'
bpy.context.view_layer.update()
# Contrôle avant export : le pied du palais doit toucher exactement le dessus de son socle.
palace=bpy.data.objects['presidence'];foundation=bpy.data.objects['WSP Assise presidence']
palace_floor=min(v.co.z for v in palace.data.vertices)
foundation_top=max((foundation.matrix_world@v.co).z for v in foundation.data.vertices)
assert abs(palace_floor-foundation_top)<.003,'Presidential building has lost contact with its foundation'
report['presidential_hill'].update({'palace_floor':palace_floor,'foundation_top':foundation_top,'palace_footprint_supported':abs(palace_floor-foundation_top)<.003,'palace_scale':PRESIDENCY_SCALE,'palace_dimensions':list(palace_max-palace_min)})
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_yup=True,export_cameras=False,export_lights=False,export_animations=False,export_image_format='AUTO')
report['objects']=len(bpy.context.scene.objects);report['bytes']=OUT.stat().st_size
import struct
with OUT.open('rb') as file:
    header=file.read(20);length=struct.unpack_from('<I',header,12)[0];gltf=json.loads(file.read(length))
exported_names={node.get('name') for node in gltf['nodes']}
assert 'Mougabiang statue' in exported_names, 'The original statue was hidden from export'
report['statue_verified']=True
forest_primitive=next(primitive for node in gltf['nodes'] if node.get('name')=='WSP Sol et voirie origine' for primitive in gltf['meshes'][node['mesh']]['primitives'] if gltf['materials'][primitive['material']]['name']=='WSP Prairie de la colline')
assert 'baseColorTexture' in gltf['materials'][forest_primitive['material']]['pbrMetallicRoughness'],'The woodland extension lost its landscape texture'
report['presidential_hill']['landscape_colors_verified']=True
(ROOT/'scripts/wsp-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print('WSP_EXPORT',json.dumps({'source_meshes':len(source),'trees':report['trees'],'bytes':report['bytes']}))