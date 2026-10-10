import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(r'D:\挑战杯项目\除草机器人幼苗-杂草辨识与作业规划系统\prototype')
OUTPUT = ROOT / 'public' / 'models'
SOURCE = ROOT / 'assets' / 'blender'
if bpy.data.filepath and Path(bpy.data.filepath).resolve() == (SOURCE / 'field-atlas-robot.blend').resolve():
    raise RuntimeError('Please run from another file to preserve the existing model.')
for path in [SOURCE / 'field-atlas-robot.blend', OUTPUT / 'field-atlas-robot.glb']:
    if path.exists():
        raise RuntimeError(f'Output already exists; rename it before regenerating: {path}')

scene = bpy.data.scenes.new('FIELD_ATLAS_ROBOT')
bpy.context.window.scene = scene

def material(name, color, metallic=0, roughness=.55):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    shader = m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = roughness
    return m

ivory = material('Warm ceramic enclosure', (.78,.77,.65), .15)
graphite = material('Graphite chassis', (.055,.085,.07), .55)
rubber = material('Rubber tread', (.022,.029,.025), 0, .92)
metal = material('Brushed alloy', (.36,.4,.36), .8, .32)
orange = material('Terracotta tool', (.61,.24,.105), .3)
teal = material('Spray tank', (.12,.36,.31), .15)
glass = material('Optical lens', (.035,.20,.24), .5, .13)

def empty(name, parent=None, location=(0,0,0)):
    o=bpy.data.objects.new(name,None)
    scene.collection.objects.link(o)
    o.parent=parent
    o.location=location
    return o

def finish(o,name,mat,parent):
    o.name=name
    o.data.materials.append(mat)
    o.parent=parent
    return o

def box(name,loc,size,mat,parent,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o=finish(bpy.context.object,name,mat,parent)
    o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Soft machined edges','BEVEL')
        mod.width=bevel
        mod.segments=3
        o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return o

def cylinder(name,loc,radius,depth,mat,parent,axis='Z',vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    o=finish(bpy.context.object,name,mat,parent)
    if axis=='X': o.rotation_euler[1]=math.pi/2
    if axis=='Y': o.rotation_euler[0]=math.pi/2
    bevel=o.modifiers.new('Rim bevel','BEVEL');bevel.width=.012;bevel.segments=2
    for polygon in o.data.polygons: polygon.use_smooth=True
    return o

def tube(name,points,radius,mat,parent):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=radius;curve.bevel_resolution=3
    spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
    for p,co in zip(spline.points,points): p.co=(*co,1)
    o=bpy.data.objects.new(name,curve);scene.collection.objects.link(o);o.parent=parent;o.data.materials.append(mat)
    return o

root=empty('FieldAtlasRobot')
box('Structural deck',(0,0,.5),(1.5,2.05,.22),graphite,root)
box('Flat rectangular enclosure',(0,0,.76),(1.48,1.85,.36),ivory,root,.07)
box('Service panel',(0,-.05,.953),(1.12,1.22,.035),metal,root,.018)
for x in [-.6,.6]:
    for y in [-.72,.72]: cylinder('Recessed panel fastener',(x,y,.948),.024,.015,graphite,root,vertices=12)
for i in range(7): box('Vent grille',(0,.05+i*.07,.978),(.52,.024,.013),graphite,root,.004)
for side in [-1,1]:
    box('Side protection rail',(side*.76,0,.67),(.09,1.7,.16),graphite,root)
    for i in range(4):
        y=.84-i*.56
        suspension=empty(f'Suspension_{"L" if side<0 else "R"}_{i}',root,(side*.91,y,.27))
        box('Independent swing link',(-side*.12,0,.12),(.34,.09,.085),metal,suspension,.015)
        cylinder('Suspension pivot',(-side*.24,0,.12),.07,.1,graphite,suspension,'X')
        wheel=empty(f'Wheel_{"L" if side<0 else "R"}_{i}',suspension)
        cylinder('All terrain tire',(0,0,0),.265,.22,rubber,wheel,'X')
        cylinder('Wheel hub',(side*.005,0,0),.16,.235,metal,wheel,'X')
        cylinder('Hub center',(side*.13,0,0),.066,.025,graphite,wheel,'X')
        for bolt in range(6):
            angle=bolt*math.tau/6
            cylinder('Hub bolt',(side*.128,math.sin(angle)*.108,math.cos(angle)*.108),.014,.02,graphite,wheel,'X',12)
        for tread in range(16):
            angle=tread*math.tau/16
            block=box('Tread block',(0,math.sin(angle)*.259,math.cos(angle)*.259),(.235,.072,.04),rubber,wheel,.006)
            block.rotation_euler[0]=-angle
box('Camera bracket',(0,.83,1.02),(.09,.08,.51),metal,root)
box('USB camera enclosure',(0,.96,1.25),(.34,.24,.18),graphite,root,.025)
cylinder('Camera lens',(0,1.09,1.25),.07,.06,glass,root,'Y')
tube('USB cable',[(.14,.9,1.25),(.25,.7,1.1),(.28,.5,.97)],.018,rubber,root)
tool=empty('MechanicalTool',root)
box('Weeder housing',(0,1.27,.16),(.8,.65,.1),orange,tool)
for i in range(4): box('Cultivator tine',(-.3+i*.2,1.5,.065),(.065,.25,.18),metal,tool,.008)
cylinder('Solution tank',(.4,-.55,1.06),.22,.4,teal,root)
cylinder('Tank cap',(.4,-.55,1.275),.08,.04,graphite,root)
box('Spray manifold',(0,-1.2,.32),(1.55,.08,.06),metal,root)
for x in [-.55,.55]: cylinder('Targeted nozzle',(x,-1.2,.23),.045,.13,teal,root)
tube('Supply hose',[(.4,-.55,1.1),(.66,-.7,.7),(.66,-1.2,.35),(0,-1.2,.35)],.018,graphite,root)

bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'field-atlas-robot.blend'),copy=True)
bpy.ops.export_scene.gltf(filepath=str(OUTPUT / 'field-atlas-robot.glb'),export_format='GLB',use_selection=True,export_apply=True)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_distance=5
            area.spaces.active.region_3d.view_location=Vector((0,0,.65))
print('FIELD ATLAS exported:', OUTPUT / 'field-atlas-robot.glb')
