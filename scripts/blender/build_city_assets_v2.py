"""Individually authored offline architecture; paints are shared external runtime assets.

The browser loads geometry, never constructs landmark buildings. Every source
retains its named material/UV contracts and four-sided architecture in Blender.
"""
import bpy, bmesh, math, json, hashlib
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/assets/renovation/v2/models'
SRC=ROOT/'art/renovation/v2/models'
OUT.mkdir(parents=True,exist_ok=True);SRC.mkdir(parents=True,exist_ok=True)
LOD=0
COLORS={'stone':(.80,.66,.44),'trim':(.93,.83,.64),'brick':(.65,.31,.20),'glass':(.25,.49,.63),'slate':(.30,.34,.40),'copper':(.28,.48,.39),'dark':(.065,.12,.16),'rose':(.66,.21,.29),'gold':(.64,.47,.21),'white':(.92,.87,.74),'asphalt':(.23,.26,.27)}
TEXTURES={'stone':'V201','brick':'V202','glass':'V203','slate':'V204','copper':'RT02-copper','rose':'RT03-rose','trim':'V201-stone','white':'V201-stone'}

class Mesh:
    def __init__(self): self.v=[];self.f=[];self.uv=[];self.mi=[];self.mats=[]
    def face(self,points,mat,uv=None):
        n=len(self.v);self.v.extend(points);self.f.append(tuple(range(n,n+len(points))))
        if mat not in self.mats:self.mats.append(mat)
        self.mi.append(self.mats.index(mat));self.uv.append(uv or [(0,0),(1,0),(1,1),(0,1)][:len(points)])
    def box(self,x,y,z,w,d,h,mat='trim',repeat=(1,1),rot=0):
        c,s=math.cos(rot),math.sin(rot)
        def p(a,b,k):return (x+a*c-b*s,y+a*s+b*c,z+k)
        a,b=w/2,d/2;pts=[p(-a,-b,-h/2),p(a,-b,-h/2),p(a,b,-h/2),p(-a,b,-h/2),p(-a,-b,h/2),p(a,-b,h/2),p(a,b,h/2),p(-a,b,h/2)]
        for ids in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:
            self.face([pts[i] for i in ids],mat,[(0,0),(repeat[0],0),repeat,(0,repeat[1])])
    def loft(self,levels,mat='glass',n=32,twist=0,uvrepeat=(1,1),shape=1):
        n=max(8,n//[1,2,4][LOD]);total=levels[-1][0]-levels[0][0]
        def ring(z,r,d=1):
            a=twist*(z-levels[0][0])/max(total,.01)
            return [(math.cos(i*math.tau/n+a)*r,math.sin(i*math.tau/n+a)*r*d,z) for i in range(n)]
        for j in range(len(levels)-1):
            z0,r0=levels[j];z1,r1=levels[j+1];ringa=ring(z0,r0,shape);ringb=ring(z1,r1,shape)
            for i in range(n):
                k=(i+1)%n;u0=i/n*uvrepeat[0];u1=(i+1)/n*uvrepeat[0]
                v0=(z0-levels[0][0])/total*uvrepeat[1];v1=(z1-levels[0][0])/total*uvrepeat[1]
                self.face([ringa[i],ringa[k],ringb[k],ringb[i]],mat,[(u0,v0),(u1,v0),(u1,v1),(u0,v1)])
        for z,r in [levels[0],levels[-1]]:
            points=ring(z,r,shape)
            for i in range(n):self.face([(0,0,z),points[i],points[(i+1)%n]],mat,[(.5,.5),(i/n,0),((i+1)/n,1)])
    def cyl(self,x,y,z,r,h,mat='trim',n=20,r2=None):
        start=len(self.v);self.loft([(z-h/2,r),(z+h/2,r if r2 is None else r2)],mat,n)
        for i in range(start,len(self.v)):
            a,b,c=self.v[i];self.v[i]=(a+x,b+y,c)
    def beam(self,a,b,r,mat='trim',n=10):
        a,b=Vector(a),Vector(b);axis=b-a;q=axis.to_track_quat('Z','Y');start=len(self.v)
        self.cyl(0,0,0,r,axis.length,mat,n)
        for i in range(start,len(self.v)):self.v[i]=tuple(q@Vector(self.v[i])+(a+b)/2)
    def sphere(self,x,y,z,r,mat='rose',scale=(1,1,1),dome=False):
        n=[40,24,12][LOD];rings=[20,12,7][LOD];extent=math.pi/2 if dome else math.pi
        def p(i,j):
            a=i*math.tau/n;b=j*extent/rings
            return (x+math.sin(b)*math.cos(a)*r*scale[0],y+math.sin(b)*math.sin(a)*r*scale[1],z+math.cos(b)*r*scale[2])
        for j in range(rings):
            for i in range(n):self.face([p(i,j),p(i,j+1),p(i+1,j+1),p(i+1,j)],mat,[(i/n,j/rings),(i/n,(j+1)/rings),((i+1)/n,(j+1)/rings),((i+1)/n,j/rings)])
    def roof(self,w,d,z,h=2.8,mat='slate',top=.7):
        p=[(-w/2,-d/2,z),(w/2,-d/2,z),(w/2,d/2,z),(-w/2,d/2,z),(-w*top/2,-d*top/2,z+h),(w*top/2,-d*top/2,z+h),(w*top/2,d*top/2,z+h),(-w*top/2,d*top/2,z+h)]
        for ids in [(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)]:self.face([p[i] for i in ids],mat)
    def building(self,w,d,h,mat='stone',floors=5,roof=True):
        self.box(0,0,h/2,w,d,h,mat,(max(1,round(w/18)),floors/4 if mat in ['stone','brick'] else floors/5))
        for z in [0.35,h*.2,h*.8,h]:self.box(0,0,z,w+.7,d+.7,.23,'trim')
        if roof:self.roof(w+.8,d+.8,h+.15)
        if LOD<2:
            bays=max(4,round(w/3))
            for i in range(bays+1):
                x=(i/bays-.5)*w
                for side in [-1,1]:self.box(x,side*(d/2+.09),h*.49,.22,.24,h*.94,'trim')
            for side in [-1,1]:
                for i in range(max(3,round(d/3))+1):
                    y=(i/max(3,round(d/3))-.5)*d
                    self.box(side*(w/2+.1),y,h*.49,.24,.22,h*.94,'trim')
    def dormers(self,w,d,z):
        if LOD==2:return
        for side in [-1,1]:
            for i in range(max(3,round(w/4))):
                x=(i-(max(3,round(w/4))-1)/2)*3.6
                self.box(x,side*d*.43,z+1,1.05,.7,1.6,'trim');self.box(x,side*(d*.43+.36),z+1,.65,.035,1.05,'dark')
                self.box(x,side*d*.43,z+1.9,1.4,.95,.2,'trim')
    def colonnade(self,w,d,z=0,columns=8):
        for side in [-1,1]:
            for i in range(columns):
                x=(i/(columns-1)-.5)*w*.8;y=side*(d/2+1)
                self.cyl(x,y,z+3,.34,5.5,'trim',16);self.cyl(x,y,z+.35,.55,.35,'trim',16)
                self.box(x,y,z+5.8,1.05,1.05,.4,'trim')
            self.box(0,side*(d/2+1),z+6.3,w*.9,2.1,.65,'trim')

def customs(m):
    m.building(32,19,13,floors=5);m.dormers(32,19,13)
    # Continuous, square clock shaft rather than a generic heritage roof.
    m.box(0,-1,18,6.8,7,13,'stone',(1,.75))
    for z in [13.5,18.5,23]:m.box(0,-1,z,7.5,7.7,.4)
    m.box(0,-1,25,6,6,4.2,'trim');m.box(0,-1,27.2,7,7,.5)
    for side in range(4):
        a=side*math.pi/2
        def p(x,y,z):return (x*math.cos(a)-y*math.sin(a),-1+x*math.sin(a)+y*math.cos(a),z)
        # Clock dials are geometrically drawn: exact indices, no generated digits.
        for radius,mat,offset in [(1.45,'gold',-.03),(1.3,'white',-.07)]:
            centre=p(0,-3.08+offset,25)
            for i in range(32):
                aa=i*math.tau/32;bb=(i+1)*math.tau/32
                m.face([centre,p(math.sin(bb)*radius,-3.08+offset,25+math.cos(bb)*radius),p(math.sin(aa)*radius,-3.08+offset,25+math.cos(aa)*radius)],mat,[(.5,.5),(0,0),(1,1)])
        for i in range(12):
            aa=i*math.tau/12;m.beam(p(math.sin(aa)*1.02,-3.2,25+math.cos(aa)*1.02),p(math.sin(aa)*1.17,-3.2,25+math.cos(aa)*1.17),.035,'dark',6)
        m.beam(p(0,-3.23,25),p(-.72,-3.23,25),.055,'dark');m.beam(p(0,-3.23,25),p(.45,-3.23,25.8),.04,'dark')
    m.box(0,-1,28.2,3.8,3.8,1.5);m.roof(4.8,4.8,29,1.1,'copper',.2);m.cyl(0,-1,31,.045,2,'gold')
    return 32

def hsbc(m):
    m.building(35,23,13.5,floors=5);m.colonnade(21,23,0,6)
    m.cyl(0,0,17,4.9,4.2,'trim',32)
    for i in range([20,12,8][LOD]):
        a=i*math.tau/[20,12,8][LOD];m.cyl(math.cos(a)*5,math.sin(a)*5,17,.13,3.2)
    m.sphere(0,0,19.1,5.25,'copper',(1,1,.8),True)
    m.cyl(0,0,23.8,.8,1.2);m.sphere(0,0,24.4,.9,'copper',(1,1,.7),True);m.cyl(0,0,25.6,.05,1.4,'gold')
    m.dormers(35,23,13.5);return 26.5

def peace(m):
    m.building(25,20,20,floors=8,roof=False)
    m.box(0,0,22,15,14,4,'stone',(1,.4));m.box(0,0,24.2,16,15,.5)
    m.box(0,0,26,10,10,3.4,'stone',(1,.3));m.roof(11,11,27.8,8,'copper',.08)
    m.cyl(0,0,36.5,.06,1.5,'gold')
    for x in [-10.8,10.8]:m.box(x,0,21.1,3.2,20,2.4,'stone')
    return 37.5

def pearl(m):
    m.cyl(0,0,.7,7.8,1.4,'trim',40)
    for i in range(3):
        a=i*math.tau/3;m.beam((math.cos(a)*9,math.sin(a)*9,1),(math.cos(a)*2,math.sin(a)*2,17),.8,'white',20)
        m.beam((math.cos(a)*1.3,math.sin(a)*1.3,13),(math.cos(a)*1.05,math.sin(a)*1.05,53),.62,'white',20)
    for z,r in [(19.5,6.2),(51,4.5),(70,1.6)]:
        m.sphere(0,0,z,r,'rose')
        for dz in [-.65,.65]:m.cyl(0,0,z+dz,r*.995,.32,'glass',48);m.cyl(0,0,z+dz+.2,r*1.005,.1,'white',48)
    for z in [28,34,40]:m.cyl(0,0,z,1.7,.36,'trim',24)
    m.cyl(0,0,61.5,.38,15.5,'white');m.cyl(0,0,75.5,.14,11,'gold');m.cyl(0,0,82,.04,2,'gold')
    # Nine small viewing spheres on the lower legs give the base its own silhouette.
    for i in range(9):
        a=i*math.tau/9;m.sphere(math.cos(a)*6,math.sin(a)*6,5.8,1.0,'rose')
    return 83.5

def shanghai(m):
    # Rounded triangular, twisting and tapering shell, articulated top crown.
    h=112;n=[48,30,16][LOD];steps=[36,22,12][LOD]
    def p(i,j):
        t=j/steps;a=i*math.tau/n+t*math.radians(115);r=(8.7-4.1*t)*(1+.085*math.cos(3*(a-t*math.radians(115))))
        return (math.cos(a)*r,math.sin(a)*r,t*h)
    for j in range(steps):
        for i in range(n):m.face([p(i,j),p(i+1,j),p(i+1,j+1),p(i,j+1)],'glass',[(i/n*3,j/steps*8),((i+1)/n*3,j/steps*8),((i+1)/n*3,(j+1)/steps*8),(i/n*3,(j+1)/steps*8)])
    for z in range(4,110,[3,5,9][LOD]):
        t=z/h;r=8.7-4.1*t;start=len(m.v);m.loft([(z,r+.07),(z+.10,r+.07)],'trim',48,0)
        for k in range(start,len(m.v)):
            x,y,zz=m.v[k];a=math.atan2(y,x);r0=math.hypot(x,y)*(1+.085*math.cos(3*(a-t*math.radians(115))));m.v[k]=(math.cos(a)*r0,math.sin(a)*r0,zz)
    if LOD<2:
        for i in range(12):
            for j in range(steps):m.beam(p(i*n/12,j),p(i*n/12,j+1),.045,'trim',6)
    m.loft([(110,4.7),(113,4.4),(114,3.4)],'glass',48);m.cyl(0,0,114.2,3.4,.25,'gold',32)
    m.building(21,18,4,'glass',2,False);return 114.8

def swfc(m):
    # Lower tapered wedge plus separated side piers and header: real open void.
    w,d,h=16,9,95
    pts=[(-w/2,-d/2,0),(w/2,-d/2,0),(w/2,d/2,0),(-w/2,d/2,0),(-5.4,-3,79),(5.4,-3,79),(5.4,3,79),(-5.4,3,79)]
    for ids in [(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)]:m.face([pts[i] for i in ids],'glass',[(0,0),(1,0),(1,5),(0,5)])
    m.box(-4.8,0,86.3,1.6,6,14.6,'glass',(1,1));m.box(4.8,0,86.3,1.6,6,14.6,'glass',(1,1));m.box(0,0,94,11.2,6,2.7,'glass')
    for side in [-1,1]:
        m.beam((side*8,-4.6,0),(side*5.5,-3.1,95),.11,'trim');m.beam((side*8,4.6,0),(side*5.5,3.1,95),.11,'trim')
    for z in range(2,79,[2,4,8][LOD]):m.box(0,0,z,16-z/79*5.2,9-z/79*3,.08,'trim')
    m.box(0,0,3,23,16,6,'glass',(1,.5));return 96

def jinmao(m):
    m.box(0,0,2.3,22,19,4.6,'stone')
    z=4.6
    for tier in range(12):
        r=8-tier*.48;h=8.8-tier*.47
        m.loft([(z,r),(z+h,r)],'glass',8,0,(2,h/10))
        m.loft([(z+h-.12,r+.45),(z+h+.28,r+.45)],'trim',8)
        if LOD<2:
            for a in range(8):
                angle=a*math.tau/8;m.beam((math.cos(angle)*r,math.sin(angle)*r,z),(math.cos(angle)*r,math.sin(angle)*r,z+h),.10,'trim',6)
        z+=h
    m.loft([(z,2),(z+4,1),(z+7,.5)],'trim',16);m.cyl(0,0,z+10,.08,6,'gold');return z+13

def heritage(m,kind):
    configs=[(29,19,12,'stone'),(23,17,14,'stone'),(19,17,22,'stone'),(26,18,12,'stone'),(22,18,15,'brick'),(30,20,17,'brick')]
    w,d,h,mat=configs[kind];m.building(w,d,h,mat,round(h/2.7),kind!=2)
    if kind==0:m.colonnade(w,d,0,10);m.roof(w*.65,d*.8,h+2.5,2,'slate',.05)
    if kind==1:
        for side in [-1,1]:
            for i in range(7):
                x=(i-3)*3.1;m.box(x,side*(d/2+.18),2.1,1.5,.3,3.4,'dark')
                m.sphere(x,side*(d/2+.2),3.5,.75,'trim',(1,.25,1),True)
    if kind==2:
        for i in range(3):m.box(0,0,h+i*1.8,w-i*4,d-i*3,2.1,'stone',(1,.2))
        for i in range(5):m.box((i-2)*3.1,-d/2-.2,h*.5,.5,.45,h,'trim')
        m.cyl(0,0,h+8,.045,7,'gold')
    if kind in [3,5]:m.dormers(w,d,h)
    if kind==4:
        for x in [-w*.42,w*.42]:m.box(x,0,h+1.8,1.1,1.2,3.6,'brick')
    if kind==5:
        for z in [5,9,13]:
            for side in [-1,1]:m.box(0,side*(d/2+.6),z,w*.9,1.4,.25,'trim')
    return h+(9 if kind==2 else 4)

def modern(m,kind):
    if kind==0:
        m.building(15,12,43,'glass',24,False);m.box(0,0,44,13,10,2,'slate');m.box(0,0,2,24,19,4,'glass')
    elif kind==1:
        m.building(25,10,32,'glass',18,False)
        for x in [-11,-5,1,7,11]:m.box(x,0,16,.4,10.3,32,'trim')
    elif kind==2:
        for i in range(5):m.box(i*.8,0,4+i*6,22-i*3,17-i*2,8,'glass',(1,.5))
    elif kind==3:
        m.building(32,24,8,'glass',4,False);m.box(-8,0,15,11,15,18,'stone',(1,2))
        m.roof(33,25,8.1,.4,'copper',.9)
    elif kind==4:
        m.building(18,13,30,'stone',12,False)
        for z in range(3,31,3):m.box(0,-6.8,z,19,1.7,.2,'trim')
        m.box(0,0,31,13,10,2,'slate')
    else:
        m.loft([(0,8),(36,8),(41,5)],'glass',32,0,(2,4),.75)
        for z in range(3,39,3):m.loft([(z,8.06),(z+.1,8.06)],'trim',32,0,(1,1),.75)
        m.box(0,0,2,24,18,4,'glass')
    return [45,33,36,24,32,42][kind]

def boat(m,kind):
    length=12 if kind==0 else 8;w=3.6 if kind==0 else 2.6
    # Faceted hull with a pointed bow, contrasting decks and individually cut cabins.
    pts=[(-w/2,-length/2,1),(w/2,-length/2,1),(w/2,length*.28,1),(0,length/2,1),(-w/2,length*.28,1)]
    m.face(pts,'white',[(0,0),(1,0),(1,.7),(.5,1),(0,.7)])
    for i in range(5):a,b=pts[i],pts[(i+1)%5];m.face([a,(a[0]*.7,a[1]*.9,0),(b[0]*.7,b[1]*.9,0),b],'dark')
    for floor in range(3 if kind==0 else 2):
        z=1.4+floor*.95;m.box(0,-.5,z,w*.84,length*.7,.75,'white')
        for side in [-1,1]:
            for i in range(9):m.box(side*w*.425,-length*.33+i*length*.065,z,.035,.44,.38,'dark')
        m.box(0,-.5,z+.45,w*.96,length*.76,.14,'gold')
    m.cyl(0,-2,4.5,.035,2,'gold');return 5.6

def bridge(m):
    m.box(0,0,2.6,13,29,.65,'asphalt');m.box(0,0,2,14,30,.5,'trim')
    for side in [-1,1]:
        m.box(side*5.8,0,3,1.5,29,.2,'trim')
        for i in range(8):
            y0=-14+i*4;y1=y0+4;h0=4+math.sin(i*math.pi/7)*3.7;h1=4+math.sin((i+1)*math.pi/7)*3.7
            m.beam((side*6.4,y0,h0),(side*6.4,y1,h1),.18,'copper')
            m.beam((side*6.4,y0,3.1),(side*6.4,y1,3.1),.17,'copper')
            m.beam((side*6.4,y0,3.1),(side*6.4,y0,h0),.12,'copper')
            m.beam((side*6.4,y0,3.1),(side*6.4,y1,h1),.10,'copper')
    for y in [-13,13]:m.box(0,y,.7,16,3,2.6,'trim')
    return 8.5

def export(asset_id,label,builder,category,art):
    global LOD
    variants=[];height=0;bounds=None
    for lod in range(3):
        LOD=lod;bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
        m=Mesh();height=builder(m)
        data=bpy.data.meshes.new(asset_id);data.from_pydata(m.v,[],m.f);data.update()
        obj=bpy.data.objects.new(asset_id+'_architecture',data);bpy.context.collection.objects.link(obj)
        for name in m.mats:
            mat=bpy.data.materials.new(name);mat.use_nodes=True;p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*COLORS[name],1);p.inputs['Roughness'].default_value=.75
            mat['paintId']=TEXTURES.get(name,'');data.materials.append(mat)
        layer=data.uv_layers.new(name='PaintUV')
        for i,poly in enumerate(data.polygons):
            poly.material_index=m.mi[i]
            poly.use_smooth=m.mats[m.mi[i]] in ['rose','copper']
            for li,uv in zip(poly.loop_indices,m.uv[i]):layer.data[li].uv=uv
        # Shared vertices allow genuine smooth sphere/dome normals; UVs stay
        # per-loop, so seams and material boundaries keep their intended paint.
        bm=bmesh.new();bm.from_mesh(data);bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=.00001);bm.to_mesh(data);bm.free();data.update()
        root=bpy.data.objects.new(asset_id,None);bpy.context.collection.objects.link(root);obj.parent=root;root['assetId']=asset_id
        if category=='landmark':root['landmarkId']=asset_id
        for name,z in [('label-anchor',height+1.3),('focus-anchor',height*.43)]:
            anchor=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(anchor);anchor.parent=root;anchor.location=(0,0,z)
        data.calc_loop_triangles();triangles=len(data.loop_triangles)
        filename=f'{asset_id}-lod{lod}.glb';bpy.ops.export_scene.gltf(filepath=str(OUT/filename),export_format='GLB',export_extras=True,export_yup=True)
        if lod==0:
            bounds={'min':[min(v[i] for v in m.v) for i in range(3)],'max':[max(v[i] for v in m.v) for i in range(3)]}
            # Link the genuine image originals in the editable source, after geometry-only
            # export. Runtime materials reference one shared, compressed paint library.
            for mat in data.materials:
                paint=mat.get('paintId','');file=ROOT/f'art/renovation/v2/originals/{paint}.png'
                if not file.exists():file=ROOT/f'public/assets/renovation/v2/textures/{paint}.webp'
                if file.exists():
                    tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(file),check_existing=True);mat.node_tree.links.new(tex.outputs['Color'],mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
            bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(SRC/f'{asset_id}.blend'))
        raw=(OUT/filename).read_bytes();variants.append({'level':lod,'path':f'assets/renovation/v2/models/{filename}','bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'triangles':triangles})
    raw=(SRC/f'{asset_id}.blend').read_bytes()
    return {'id':asset_id,'name':label,'category':category,'height':height,'boundsBlender':bounds,'anchors':{'label':[0,height+1.3,0],'focus':[0,height*.43,0]},'materialSlots':m.mats,'artIds':art,'source':f'art/renovation/v2/models/{asset_id}.blend','sourceBytes':len(raw),'sourceSha256':hashlib.sha256(raw).hexdigest(),'method':'individually authored offline Blender geometry; shared imagegen paint textures','status':'candidate','lods':variants}

assets=[]
for id,name,fn,art in [('pearl','东方明珠',pearl,['RT03-rose','V203']),('shanghai','上海中心',shanghai,['V203']),('swfc','环球金融中心',swfc,['V203']),('jinmao','金茂大厦',jinmao,['V203','V201']),('customs','海关大楼',customs,['V201','V204']),('hsbc','原汇丰银行大楼',hsbc,['V201','RT02-copper','V204']),('peace','和平饭店',peace,['V201','RT02-copper'])]:assets.append(export(id,name,fn,'landmark',art))
for i,name in enumerate(['柱廊','拱窗','装饰艺术','坡屋顶','砖石','公寓']):assets.append(export(f'heritage-{i}',name,lambda m,i=i:heritage(m,i),'heritage',['V201','V202','V204']))
for i,name in enumerate(['玻璃塔楼','板楼','阶梯楼','商业裙房','住宅','办公楼']):assets.append(export(f'modern-{i}',name,lambda m,i=i:modern(m,i),'modern',['V201','V203']))
for i,name in enumerate(['三层游船','双层渡轮']):assets.append(export(f'boat-{i}',name,lambda m,i=i:boat(m,i),'prop',[]))
assets.append(export('bridge','外白渡桥',bridge,'prop',['RT02-copper']))
(OUT/'manifest.json').write_text(json.dumps({'schemaVersion':2,'status':'candidate','assets':assets},ensure_ascii=False,indent=2)+'\n')
print('CITY_V2_EXPORT '+json.dumps({'models':len(assets),'lods':len(assets)*3}))
