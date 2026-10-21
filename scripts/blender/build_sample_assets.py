"""Offline, reproducible Blender assets for the P3 art sample.

Geometry is authored here and retained in .blend files. Runtime code loads GLB;
painted facades come from image_gen originals, not runtime window generators.
"""
import bpy
import hashlib
import json
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/assets/renovation/models'
SOURCES = ROOT / 'art/renovation/models'
OUT.mkdir(parents=True, exist_ok=True)
SOURCES.mkdir(parents=True, exist_ok=True)
TL, TR, BL, BR = (0.006, 0.506, 0.494, 0.994), (0.506, 0.506, 0.994, 0.994), (0.006, 0.006, 0.494, 0.494), (0.506, 0.006, 0.994, 0.494)
LOD = 0
PARENT = None
MATS = {}


def material(name, color, texture=None, roughness=0.8, metal=0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = metal
    if texture:
        image = bpy.data.images.load(str(ROOT / f'art/renovation/originals/{texture}.png'), check_existing=True)
        t = m.node_tree.nodes.new('ShaderNodeTexImage')
        t.image = image
        m.node_tree.links.new(t.outputs['Color'], p.inputs['Base Color'])
    MATS[name] = m
    return m


def finish(obj, name, mat, rect=None, smooth=False):
    obj.name = name
    obj.parent = PARENT
    obj.data.materials.append(mat)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    if rect and obj.data.uv_layers.active:
        u0, v0, u1, v1 = rect
        for loop in obj.data.uv_layers.active.data:
            loop.uv = (u0 + loop.uv.x * (u1 - u0), v0 + loop.uv.y * (v1 - v0))
    return obj


def box(name, xyz, size, mat, rect=None, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz)
    obj = bpy.context.object
    obj.scale = size
    finish(obj, name, mat)
    # Explicit per-face UVs: each wall gets a complete elevation, no cube-net
    # fragments, mirrored backs, or accidental roof/clock quadrant leakage.
    uv = obj.data.uv_layers.active.data
    if rect:
        u0, v0, u1, v1 = rect
        for poly in obj.data.polygons:
            for li in poly.loop_indices:
                co = obj.data.vertices[obj.data.loops[li].vertex_index].co
                if abs(poly.normal.z) > .5:
                    u, v = co.x + .5, co.y + .5
                elif abs(poly.normal.y) > .5:
                    u, v = co.x + .5, co.z + .5
                else:
                    u, v = co.y + .5, co.z + .5
                uv[li].uv = (u0 + u * (u1-u0), v0 + v * (v1-v0))
    if bevel and LOD < 2:
        modifier = obj.modifiers.new('Stone edge', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 2 if LOD == 0 else 1
    return obj


def wall(name, width, depth, height, atlas):
    # Four independent wall surfaces preserve front/side elevation proportions.
    facade = material(name + '_Facade', (1, 1, 1), atlas)
    side = material(name + '_SideFacade', (1, 1, 1), atlas)
    box(name + '_core', (0, 0, height/2), (width-.04, depth-.04, height), STONE)
    box(name + '_front', (0, -depth/2, height/2), (width, .03, height), facade, TL)
    box(name + '_back', (0, depth/2, height/2), (width, .03, height), side, TR)
    box(name + '_east', (width/2, 0, height/2), (.03, depth, height), side, TR)
    box(name + '_west', (-width/2, 0, height/2), (.03, depth, height), side, TR)


def cylinder(name, xyz, radius, depth, mat, rect=None, rotation=None, vertices=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices or [32, 20, 12][LOD], radius=radius, depth=depth, location=xyz)
    obj = finish(bpy.context.object, name, mat, rect, smooth=True)
    if rotation:
        obj.rotation_euler = rotation
    return obj


def sphere(name, xyz, radius, mat, rect=None, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=[48, 28, 16][LOD], ring_count=[24, 16, 10][LOD], radius=radius, location=xyz)
    obj = finish(bpy.context.object, name, mat, rect, smooth=True)
    obj.scale = scale
    return obj


def dome(name, xyz, radius, mat, rect, height_scale=.8):
    segments, rings = [(48,16),(28,10),(16,6)][LOD]
    vertices=[]
    for ring_index in range(rings+1):
        phi=ring_index*math.pi/(2*rings)
        for segment in range(segments+1):
            theta=segment*math.tau/segments
            vertices.append((radius*math.sin(phi)*math.cos(theta),radius*math.sin(phi)*math.sin(theta),radius*math.cos(phi)*height_scale))
    faces=[]
    for r in range(rings):
        for s in range(segments):
            a=r*(segments+1)+s
            faces.append((a,a+segments+1,a+segments+2,a+1))
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    obj.location=xyz
    uv=mesh.uv_layers.new()
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            vi=mesh.loops[li].vertex_index
            u=(vi%(segments+1))/segments
            v=1-(vi//(segments+1))/rings
            uv.data[li].uv=(rect[0]+u*(rect[2]-rect[0]),rect[1]+v*(rect[3]-rect[1]))
    return finish(obj,name,mat,smooth=True)


def beam(name, a, b, radius, mat, rect=None):
    a, b = Vector(a), Vector(b)
    obj = cylinder(name, (a+b)/2, radius, (b-a).length, mat, rect)
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return obj


def ring(name, z, width, depth, height=.2):
    box(name, (0, 0, z), (width, depth, height), STONE, bevel=.04)


def mansard(width, depth, base_z, atlas):
    mat = material('Slate_Roof', (.45, .5, .55), atlas)
    verts = [(x*width/2, y*depth/2, base_z) for x,y in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    verts += [(x*width*.37, y*depth*.32, base_z+1.8) for x,y in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    mesh = bpy.data.meshes.new('Mansard')
    mesh.from_pydata(verts, [], [(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)])
    mesh.update()
    obj = bpy.data.objects.new('Mansard roof', mesh)
    bpy.context.collection.objects.link(obj)
    finish(obj, 'Mansard roof', mat)
    layer = mesh.uv_layers.new()
    for poly in mesh.polygons:
        coords = [(0,0),(1,0),(1,1),(0,1)]
        for li, (u,v) in zip(poly.loop_indices, coords):
            layer.data[li].uv = (BL[0]+u*(BL[2]-BL[0]), BL[1]+v*(BL[3]-BL[1]))
    if LOD == 0:
        for side in [-1, 1]:
            for i in range(7):
                x = (i-3)*width/8
                box('Dormer stone frame', (x, side*depth*.43, base_z+.65), (1.1,.6,1.2), STONE)
                box('Dormer glass', (x, side*(depth*.43+.31), base_z+.65), (.65,.03,.75), DARK)
                box('Dormer cap', (x, side*depth*.43, base_z+1.33), (1.35,.8,.15), STONE)


def clock(z, radius=1.02):
    # The generated clock quadrant has malformed numerals. Deliberately unused.
    # Real geometry provides twelve clear raised indices rather than fake text.
    for side in range(4):
        angle = side*math.pi/2
        def pt(x, y, h):
            return (x*math.cos(angle)-y*math.sin(angle), x*math.sin(angle)+y*math.cos(angle), h)
        cylinder('Clock brass rim', pt(0,-2.14,z), radius+.12, .13, GOLD, rotation=(math.pi/2,0,angle))
        cylinder('Clock ivory dial', pt(0,-2.23,z), radius, .04, STONE, rotation=(math.pi/2,0,angle))
        for tick in range(12):
            a=tick*math.tau/12
            obj=box('Clock raised index',pt(math.sin(a)*radius*.82,-2.27,z+math.cos(a)*radius*.82),(.06,.04,.18),DARK)
            obj.rotation_euler=(0,a,angle)
        for a,length in [(math.radians(-90),.54),(math.radians(60),.8)]:
            beam('Clock hand',pt(0,-2.3,z),pt(math.sin(a)*length,-2.3,z+math.cos(a)*length),.035,DARK)


def customs():
    wall('Customs',24,12,8,'RT01')
    for z in [0.3,2,4,6,8.1]: ring('Customs cornice',z,24.8,12.8,.22)
    mansard(24,12,8.3,'RT01')
    box('Clocktower shaft',(0,0,12.4),(5.2,5.2,9.4),STONE,bevel=.08)
    if LOD < 2:
        for side in [-1,1]:
            for x in [-1.2,0,1.2]:
                box('Tower vertical recess',(x,side*2.615,12.8),(.32,.04,3.6),DARK)
                box('Tower lateral recess',(side*2.615,x,12.8),(.04,.32,3.6),DARK)
    for z in [9,12.5,15,17]: ring('Tower cornice',z,5.7,5.7,.25)
    box('Clock chamber',(0,0,18.1),(4.2,4.2,3.1),STONE,bevel=.08)
    clock(18.1)
    ring('Clock top cornice',19.8,4.9,4.9,.35)
    box('Belfry',(0,0,20.7),(2.9,2.9,1.7),STONE)
    for side in [-1,1]:
        for i in range(4): box('Belfry louver',(side*1.47,(i-1.5)*.52,20.7),(.04,.22,1.0),DARK)
    ring('Belfry crown',21.7,3.3,3.3,.24)
    cylinder('Tower lantern',(0,0,22.15),.92,.65,GOLD,vertices=8)
    cylinder('Flag pole',(0,0,23.5),.035,2,GOLD)
    if LOD < 2:
        for side in [-1,1]:
            for i in range(13):
                x=(i-6)*1.75
                box('Facade pilaster',(x,side*6.04,4.2),(.17,.22,7.5),STONE)
    return 24.5


def hsbc():
    wall('HSBC',27,14,9.4,'RT02')
    for z in [.4,2.3,5,7.2,9.5]: ring('HSBC cornice',z,27.7,14.7,.25)
    mansard(27,14,9.7,'RT02')
    for side in [-1,1]:
        for i in range(6):
            x=(i-2.5)*1.75
            cylinder('Portico column',(x,side*7.8,3.5),.32,5.5,STONE)
            cylinder('Column base',(x,side*7.8,.75),.47,.3,STONE)
            box('Corinthian capital',(x,side*7.8,6.35),(.92,.9,.35),STONE,bevel=.06)
        box('Portico entablature',(0,side*7.8,6.8),(11,2,.55),STONE,bevel=.08)
    cylinder('Dome drum',(0,0,12.2),3.65,2.2,STONE)
    roof=material('HSBC_Copper',(.45,.65,.61),'RT02',roughness=.72,metal=.1)
    dome('Copper dome',(0,0,13.25),3.8,roof,BL,.87)
    for i in range([16,12,8][LOD]):
        a=i*math.tau/[16,12,8][LOD]
        beam('Drum column',(math.cos(a)*3.7,math.sin(a)*3.7,11.4),(math.cos(a)*3.7,math.sin(a)*3.7,13.1),.08,STONE)
    cylinder('Dome lantern',(0,0,16.6),.6,.85,STONE)
    dome('Lantern cap',(0,0,17.15),.68,roof,BL,.6)
    cylinder('Dome finial',(0,0,18),.04,.8,GOLD)
    return 18.5


def pearl():
    rose=material('Pearl_Rose',(1,1,1),'RT03',roughness=.65,metal=.12)
    cream=material('Pearl_Cream',(1,1,1),'RT03')
    glass=material('Pearl_Glass',(1,1,1),'RT03',roughness=.4,metal=.2)
    for i in range(3):
        a=i*math.tau/3
        beam('Main sloping support',(math.cos(a)*7,math.sin(a)*7,.2),(math.cos(a)*2.1,math.sin(a)*2.1,13.2),.72,cream,TR)
        beam('Tower core column',(math.cos(a)*1.0,math.sin(a)*1.0,11),(math.cos(a)*.7,math.sin(a)*.7,41.5),.48,cream,TR)
    cylinder('Arrival podium',(0,0,.6),6,1.2,cream,TR)
    sphere('Lower sphere',(0,0,15),5.1,rose,TL)
    sphere('Upper sphere',(0,0,39.5),3.6,rose,TL)
    sphere('Space capsule',(0,0,53.6),1.23,rose,TL)
    for z,r in [(14.5,5.08),(16,4.95),(39.2,3.63),(40.5,3.5)]:
        cylinder('Observation glazing',(0,0,z),r,.5,glass,BL)
        cylinder('Observation rim',(0,0,z+.28),r+.06,.08,cream,TR)
    for z in [24,28,32]: cylinder('Shaft connector',(0,0,z),1.35,.3,cream,TR)
    cylinder('Upper mast',(0,0,47),.32,11.5,cream,TR)
    cylinder('Antenna',(0,0,58),.11,8.0,GOLD)
    cylinder('Antenna tip',(0,0,62.4),.035,1.2,GOLD)
    if LOD < 2:
        for i in range(12):
            a=i*math.tau/12
            beam('Sphere glazing mullion',(math.cos(a)*5.12,math.sin(a)*5.12,14.2),(math.cos(a)*5.12,math.sin(a)*5.12,16.1),.035,cream,TR)
    return 63.5


def heritage():
    wall('Heritage',15,10,8,'RT01')
    for z in [.25,2,4,6,8.1]: ring('Heritage cornice',z,15.5,10.5,.18)
    mansard(15,10,8.25,'RT01')
    for x in [-5,5]:box('Chimney',(x,0,10.6),(.65,.8,1.6),STONE)
    return 11.5


def modern():
    glass=material('Modern_Facade',(1,1,1),'RT03',roughness=.55,metal=.1)
    box('Modern lower tower',(0,0,10),(8,7,20),glass,BL,bevel=.08)
    box('Modern setback',(0,0,23),(6.3,5.4,6),glass,BL,bevel=.08)
    box('Modern crown',(0,0,27),(4.5,4,2),glass,BL)
    for z in range(2,27,2 if LOD < 2 else 4):box('Modern floor band',(0,0,z),(8.1 if z<20 else 6.4,7.1 if z<20 else 5.5,.08),STONE)
    if LOD == 0:
        for i in range(7):
            x=(i-3)*1.2
            for y in [-3.55,3.55]:box('Modern vertical mullion',(x,y,10),(.055,.055,20),STONE)
    return 28.5


def build(asset_id, label, builder, art_ids):
    global LOD,PARENT,MATS,STONE,DARK,GOLD
    entries=[]
    height=0
    for lod in range(3):
        LOD=lod
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
        MATS={}
        PARENT=bpy.data.objects.new(asset_id,None)
        bpy.context.collection.objects.link(PARENT)
        PARENT['assetId']=asset_id
        PARENT['landmarkId']=asset_id if asset_id in ['customs','hsbc','pearl'] else ''
        STONE=material('Ivory_Stone',(.79,.73,.59))
        DARK=material('BlueGrey_Detail',(.07,.12,.15),roughness=.7)
        GOLD=material('Brass',(.5,.31,.1),roughness=.55,metal=.3)
        height=builder()
        for name,xyz in [('label-anchor',(0,0,height+1)),('focus-anchor',(0,0,height*.43))]:
            anchor=bpy.data.objects.new(name,None)
            bpy.context.collection.objects.link(anchor)
            anchor.parent=PARENT
            anchor.location=xyz
        # Consolidate by material into a single mesh. Anchor empties stay intact.
        meshes=[obj for obj in bpy.context.scene.objects if obj.type=='MESH']
        bpy.ops.object.select_all(action='DESELECT')
        for obj in meshes: obj.select_set(True)
        bpy.context.view_layer.objects.active=meshes[0]
        bpy.ops.object.convert(target='MESH')
        bpy.ops.object.join()
        mesh=bpy.context.object
        mesh.name=asset_id+'_architecture'
        mesh.data.calc_loop_triangles()
        triangles=len(mesh.data.loop_triangles)
        filename=f'{asset_id}-lod{lod}.glb'
        bpy.ops.export_scene.gltf(filepath=str(OUT/filename),export_format='GLB',export_extras=True,export_yup=True)
        if lod==0:
            bpy.ops.file.pack_all()
            bpy.ops.wm.save_as_mainfile(filepath=str(SOURCES/f'{asset_id}.blend'))
        raw=(OUT/filename).read_bytes()
        entries.append({'level':lod,'path':f'assets/renovation/models/{filename}','bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'triangles':triangles})
    source_raw=(SOURCES/f'{asset_id}.blend').read_bytes()
    return {'id':asset_id,'name':label,'status':'candidate','source':f'art/renovation/models/{asset_id}.blend',
            'sourceBytes':len(source_raw),'sourceSha256':hashlib.sha256(source_raw).hexdigest(),
            'method':'offline Blender geometry with image_gen facade/material atlases','artIds':art_ids,
            'height':height,'anchors':{'label':[0,height+1,0],'focus':[0,height*.43,0]},'lods':entries,
            'visualAcceptance':'pending actual browser screenshots and user review'}


assets=[]
for arguments in [('pearl','东方明珠',pearl,['RT03']),('customs','海关大楼',customs,['RT01']),('hsbc','原汇丰银行大楼',hsbc,['RT02']),('heritage','古典配景',heritage,['RT01']),('modern','现代配景',modern,['RT03'])]:
    assets.append(build(*arguments))
manifest={'schemaVersion':1,'purpose':'P2/P3 sample only; not the completed city','assets':assets}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('ART_SAMPLE_EXPORT '+json.dumps({'models':len(assets),'lodFiles':sum(len(a['lods']) for a in assets)}))
