"""J0005 · target-dart B-roll · Blender 4.0 Cycles (CPU), fully procedural.

Run:  blender -b --python scene.py
Env:  FRAME_START / FRAME_END   frame range (default 1..168)
      STILLS="40,96,160"        render only these frames as stills (overrides range)
      SAMPLES (16)  RES_PCT (75)  THREADS  OUT (out/exr/f_)  HAZE (1)  MBLUR (1)
      SAVE_BLEND=path           also save the .blend
"""
import bpy, bmesh, math, os, random, time
from mathutils import Vector, Matrix, Quaternion, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
E = os.environ.get
FPS = 30
F_FIRST, F_LAST = 1, 168            # 5.6 s
F_IN, F_IMPACT = 34, 96             # dart flight, impact at 57 %
FRAME_START = int(E("FRAME_START", F_FIRST))
FRAME_END = int(E("FRAME_END", F_LAST))
SAMPLES = int(E("SAMPLES", 16))      # + OIDN (denoise.py)
RES_PCT = int(E("RES_PCT", 75))      # 1440x810, upscaled with lanczos at encode
OUT = E("OUT", os.path.join(HERE, "out", "exr", "f_"))
STILLS = [int(x) for x in E("STILLS", "").split(",") if x.strip()]
HAZE = int(E("HAZE", 0))   # real volume barely reads and costs ~25 %: haze is faked in denoise.py
MBLUR = int(E("MBLUR", 1))

random.seed(7)

# ---------------------------------------------------------------- reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
scn.render.fps = FPS
scn.frame_start, scn.frame_end = F_FIRST, F_LAST

# ---------------------------------------------------------------- helpers
def node_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    return m, nt, bsdf

def link(nt, a, b):
    nt.links.new(a, b)

def N(nt, kind, **props):
    n = nt.nodes.new(kind)
    for k, v in props.items():
        setattr(n, k, v)
    return n

def math_node(nt, op, a=None, b=None, va=None, vb=None):
    n = nt.nodes.new("ShaderNodeMath"); n.operation = op
    if a is not None: link(nt, a, n.inputs[0])
    elif va is not None: n.inputs[0].default_value = va
    if b is not None: link(nt, b, n.inputs[1])
    elif vb is not None: n.inputs[1].default_value = vb
    return n

def obj_from_bm(name, bm, mats=(), smooth=True, parent=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    if smooth:
        for p in me.polygons: p.use_smooth = True
    for m in mats: me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    scn.collection.objects.link(ob)
    if parent: ob.parent = parent
    return ob

def lathe(profile, segs=48):
    """profile: list of (r, z); revolve around Z."""
    bm = bmesh.new()
    rings = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        ca, sa = math.cos(a), math.sin(a)
        rings.append([bm.verts.new((r * ca, r * sa, z)) for r, z in profile])
    for i in range(segs):
        r0, r1 = rings[i], rings[(i + 1) % segs]
        for j in range(len(profile) - 1):
            bm.faces.new((r0[j], r1[j], r1[j + 1], r0[j + 1]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    return bm

def torus_bm(R, r, segs=160, rsegs=10):
    bm = bmesh.new()
    bmesh.ops.create_circle  # noqa (ensure module)
    rings = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        c = Vector((math.cos(a), math.sin(a), 0))
        rings.append([bm.verts.new(c * (R + r * math.cos(b)) + Vector((0, 0, r * math.sin(b))))
                      for b in [2 * math.pi * k / rsegs for k in range(rsegs)]])
    for i in range(segs):
        r0, r1 = rings[i], rings[(i + 1) % segs]
        for k in range(rsegs):
            bm.faces.new((r0[k], r1[k], r1[(k + 1) % rsegs], r0[(k + 1) % rsegs]))
    return bm

# ---------------------------------------------------------------- materials
def mat_concrete():
    m, nt, b = node_mat("Concrete")
    tc = N(nt, "ShaderNodeTexCoord")
    mp = N(nt, "ShaderNodeMapping"); link(nt, tc.outputs["Object"], mp.inputs[0])
    big = N(nt, "ShaderNodeTexNoise"); big.inputs["Scale"].default_value = 1.6
    big.inputs["Detail"].default_value = 6; big.inputs["Roughness"].default_value = 0.6
    link(nt, mp.outputs[0], big.inputs[0])
    fine = N(nt, "ShaderNodeTexNoise"); fine.inputs["Scale"].default_value = 90
    fine.inputs["Detail"].default_value = 10; fine.inputs["Roughness"].default_value = 0.7
    link(nt, mp.outputs[0], fine.inputs[0])
    vor = N(nt, "ShaderNodeTexVoronoi"); vor.feature = "F1"; vor.inputs["Scale"].default_value = 140
    vor.inputs["Randomness"].default_value = 1.0
    link(nt, mp.outputs[0], vor.inputs[0])
    pits = N(nt, "ShaderNodeMapRange")
    link(nt, vor.outputs["Distance"], pits.inputs[0])
    pits.inputs[1].default_value = 0.0; pits.inputs[2].default_value = 0.09
    pits.inputs[3].default_value = 0.0; pits.inputs[4].default_value = 1.0
    ramp = N(nt, "ShaderNodeValToRGB")
    link(nt, big.outputs["Fac"], ramp.inputs[0])
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (0.020, 0.020, 0.021, 1)
    ramp.color_ramp.elements[1].position = 0.70
    ramp.color_ramp.elements[1].color = (0.050, 0.048, 0.046, 1)
    mixc = N(nt, "ShaderNodeMix"); mixc.data_type = "RGBA"; mixc.blend_type = "MULTIPLY"
    mixc.inputs["Factor"].default_value = 0.55
    link(nt, ramp.outputs[0], mixc.inputs[6])
    fr = N(nt, "ShaderNodeMapRange"); link(nt, fine.outputs["Fac"], fr.inputs[0])
    fr.inputs[1].default_value = 0.3; fr.inputs[2].default_value = 0.7
    fr.inputs[3].default_value = 0.6; fr.inputs[4].default_value = 1.3
    cmb = N(nt, "ShaderNodeCombineColor")
    for i in range(3): link(nt, fr.outputs[0], cmb.inputs[i])
    link(nt, cmb.outputs[0], mixc.inputs[7])
    pitc = N(nt, "ShaderNodeMix"); pitc.data_type = "RGBA"
    link(nt, pits.outputs[0], pitc.inputs["Factor"])
    pitc.inputs[6].default_value = (0.012, 0.012, 0.012, 1)
    link(nt, mixc.outputs[2], pitc.inputs[7])
    link(nt, pitc.outputs[2], b.inputs["Base Color"])
    rr = N(nt, "ShaderNodeMapRange"); link(nt, big.outputs["Fac"], rr.inputs[0])
    rr.inputs[3].default_value = 0.62; rr.inputs[4].default_value = 0.95
    link(nt, rr.outputs[0], b.inputs["Roughness"])
    bump1 = N(nt, "ShaderNodeBump"); bump1.inputs["Strength"].default_value = 0.35
    bump1.inputs["Distance"].default_value = 0.002
    link(nt, fine.outputs["Fac"], bump1.inputs["Height"])
    bump2 = N(nt, "ShaderNodeBump"); bump2.inputs["Strength"].default_value = 0.8
    bump2.inputs["Distance"].default_value = 0.0015
    link(nt, pits.outputs[0], bump2.inputs["Height"])
    link(nt, bump1.outputs[0], bump2.inputs["Normal"])
    link(nt, bump2.outputs[0], b.inputs["Normal"])
    return m

def mat_board():
    m, nt, b = node_mat("BoardSisal")
    tc = N(nt, "ShaderNodeTexCoord")
    sep = N(nt, "ShaderNodeSeparateXYZ"); link(nt, tc.outputs["Object"], sep.inputs[0])
    # alternate 20 segments with a whisper of difference (still all black)
    ang = math_node(nt, "ARCTAN2", sep.outputs[0], sep.outputs[2])
    ang2 = math_node(nt, "ADD", ang.outputs[0], vb=math.pi / 20 + 2 * math.pi)
    seg = math_node(nt, "DIVIDE", ang2.outputs[0], vb=2 * math.pi / 20)
    segf = math_node(nt, "FLOOR", seg.outputs[0])
    par = math_node(nt, "FLOORED_MODULO", segf.outputs[0], vb=2)
    # sisal: tiny fibre ends + stretched fibres
    fib = N(nt, "ShaderNodeTexNoise"); fib.inputs["Scale"].default_value = 1400
    fib.inputs["Detail"].default_value = 3; fib.inputs["Roughness"].default_value = 0.7
    link(nt, tc.outputs["Object"], fib.inputs[0])
    vor = N(nt, "ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 2600
    link(nt, tc.outputs["Object"], vor.inputs[0])
    blot = N(nt, "ShaderNodeTexNoise"); blot.inputs["Scale"].default_value = 35
    blot.inputs["Detail"].default_value = 4
    link(nt, tc.outputs["Object"], blot.inputs[0])
    col = N(nt, "ShaderNodeMapRange"); link(nt, fib.outputs["Fac"], col.inputs[0])
    col.inputs[1].default_value = 0.35; col.inputs[2].default_value = 0.75
    col.inputs[3].default_value = 0.006; col.inputs[4].default_value = 0.022
    segc = math_node(nt, "MULTIPLY", par.outputs[0], vb=0.004)
    cs = math_node(nt, "ADD", col.outputs[0], segc.outputs[0])
    bl = N(nt, "ShaderNodeMapRange"); link(nt, blot.outputs["Fac"], bl.inputs[0])
    bl.inputs[3].default_value = 0.8; bl.inputs[4].default_value = 1.25
    cs2 = math_node(nt, "MULTIPLY", cs.outputs[0], bl.outputs[0])
    cmb = N(nt, "ShaderNodeCombineColor")
    link(nt, cs2.outputs[0], cmb.inputs[0]); link(nt, cs2.outputs[0], cmb.inputs[1])
    link(nt, cs2.outputs[0], cmb.inputs[2])
    link(nt, cmb.outputs[0], b.inputs["Base Color"])
    rough = math_node(nt, "SUBTRACT", va=0.88, b=None)
    rp = math_node(nt, "MULTIPLY", par.outputs[0], vb=0.06)
    link(nt, rp.outputs[0], rough.inputs[1])
    link(nt, rough.outputs[0], b.inputs["Roughness"])
    b.inputs["Sheen Weight"].default_value = 0.08
    b.inputs["Specular IOR Level"].default_value = 0.35
    b.inputs["Sheen Roughness"].default_value = 0.6
    b.inputs["Sheen Tint"].default_value = (0.5, 0.45, 0.4, 1)
    h = math_node(nt, "ADD", fib.outputs["Fac"], vor.outputs["Distance"])
    bump = N(nt, "ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.6
    bump.inputs["Distance"].default_value = 0.0004
    link(nt, h.outputs[0], bump.inputs["Height"])
    link(nt, bump.outputs[0], b.inputs["Normal"])
    return m

def mat_metal(name, color, rough, aniso=0.0, brushed=False, bump_scale=0):
    m, nt, b = node_mat(name)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = 1.0
    b.inputs["Roughness"].default_value = rough
    if aniso:
        b.inputs["Anisotropic"].default_value = aniso
    if brushed or bump_scale:
        tc = N(nt, "ShaderNodeTexCoord")
        mp = N(nt, "ShaderNodeMapping"); link(nt, tc.outputs["Object"], mp.inputs[0])
        if brushed:
            mp.inputs["Scale"].default_value = (2000, 2000, 30)
        else:
            mp.inputs["Scale"].default_value = (bump_scale,) * 3
        nz = N(nt, "ShaderNodeTexNoise"); nz.inputs["Detail"].default_value = 4
        link(nt, mp.outputs[0], nz.inputs[0])
        bump = N(nt, "ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.12
        bump.inputs["Distance"].default_value = 0.0002
        link(nt, nz.outputs["Fac"], bump.inputs["Height"])
        link(nt, bump.outputs[0], b.inputs["Normal"])
    return m

def mat_knurl():
    m, nt, b = node_mat("BarrelTungsten")
    b.inputs["Base Color"].default_value = (0.62, 0.62, 0.64, 1)
    b.inputs["Metallic"].default_value = 1.0
    b.inputs["Roughness"].default_value = 0.24
    tc = N(nt, "ShaderNodeTexCoord")
    sep = N(nt, "ShaderNodeSeparateXYZ"); link(nt, tc.outputs["Object"], sep.inputs[0])
    phi = math_node(nt, "ARCTAN2", sep.outputs[1], sep.outputs[0])
    zk = math_node(nt, "MULTIPLY", sep.outputs[2], vb=2 * math.pi / 0.0009)
    pk = math_node(nt, "MULTIPLY", phi.outputs[0], vb=24)
    p1 = math_node(nt, "SINE", math_node(nt, "ADD", zk.outputs[0], pk.outputs[0]).outputs[0])
    p2 = math_node(nt, "SINE", math_node(nt, "SUBTRACT", zk.outputs[0], pk.outputs[0]).outputs[0])
    a1 = math_node(nt, "ABSOLUTE", p1.outputs[0]); a2 = math_node(nt, "ABSOLUTE", p2.outputs[0])
    hm = math_node(nt, "MINIMUM", a1.outputs[0], a2.outputs[0])
    # knurl only on the grip zone z 0.044..0.070 (object space of the dart)
    zone = N(nt, "ShaderNodeMapRange"); zone.interpolation_type = "SMOOTHSTEP"
    link(nt, sep.outputs[2], zone.inputs[0])
    zone.inputs[1].default_value = 0.043; zone.inputs[2].default_value = 0.046
    zone2 = N(nt, "ShaderNodeMapRange"); zone2.interpolation_type = "SMOOTHSTEP"
    link(nt, sep.outputs[2], zone2.inputs[0])
    zone2.inputs[1].default_value = 0.071; zone2.inputs[2].default_value = 0.068
    zm = math_node(nt, "MULTIPLY", zone.outputs[0], zone2.outputs[0])
    h = math_node(nt, "MULTIPLY", hm.outputs[0], zm.outputs[0])
    # also 3 machined rings near the front
    rz = math_node(nt, "MULTIPLY", sep.outputs[2], vb=2 * math.pi / 0.0016)
    rs = math_node(nt, "ABSOLUTE", math_node(nt, "SINE", rz.outputs[0]).outputs[0])
    rzone = N(nt, "ShaderNodeMapRange"); link(nt, sep.outputs[2], rzone.inputs[0])
    rzone.interpolation_type = "SMOOTHSTEP"
    rzone.inputs[1].default_value = 0.036; rzone.inputs[2].default_value = 0.038
    rzone2 = N(nt, "ShaderNodeMapRange"); link(nt, sep.outputs[2], rzone2.inputs[0])
    rzone2.interpolation_type = "SMOOTHSTEP"
    rzone2.inputs[1].default_value = 0.0415; rzone2.inputs[2].default_value = 0.0395
    rzz = math_node(nt, "MULTIPLY", rzone.outputs[0], rzone2.outputs[0])
    rh = math_node(nt, "MULTIPLY", rs.outputs[0], rzz.outputs[0])
    ht = math_node(nt, "ADD", h.outputs[0], rh.outputs[0])
    darken = N(nt, "ShaderNodeMapRange"); link(nt, ht.outputs[0], darken.inputs[0])
    darken.inputs[3].default_value = 0.30; darken.inputs[4].default_value = 0.62
    cmb = N(nt, "ShaderNodeCombineColor")
    for i in range(3): link(nt, darken.outputs[0], cmb.inputs[i])
    link(nt, cmb.outputs[0], b.inputs["Base Color"])
    bump = N(nt, "ShaderNodeBump"); bump.inputs["Strength"].default_value = 1.0
    bump.inputs["Distance"].default_value = 0.00015
    link(nt, ht.outputs[0], bump.inputs["Height"])
    link(nt, bump.outputs[0], b.inputs["Normal"])
    return m

def mat_dust():
    m, nt, b = node_mat("Dust")
    b.inputs["Base Color"].default_value = (0.42, 0.34, 0.24, 1)
    b.inputs["Roughness"].default_value = 0.9
    b.inputs["Subsurface Weight"].default_value = 0.0
    return m

M_CONC = mat_concrete()
M_BOARD = mat_board()
M_STEEL = mat_metal("BrushedSteel", (0.55, 0.55, 0.57), 0.32, aniso=0.5, brushed=True)
M_GOLD = mat_metal("PolishedGold", (1.0, 0.70, 0.26), 0.17, bump_scale=900)
M_GOLDFLIGHT = mat_metal("GoldFlight", (0.95, 0.72, 0.36), 0.26, bump_scale=600)
M_NEEDLE = mat_metal("NeedleSteel", (0.80, 0.80, 0.82), 0.18)
M_SHAFT = mat_metal("ShaftGunmetal", (0.10, 0.10, 0.11), 0.35)
M_KNURL = mat_knurl()
M_DUST = mat_dust()

# ---------------------------------------------------------------- wall
bpy.ops.mesh.primitive_plane_add(size=1)
wall = bpy.context.active_object; wall.name = "Wall"
wall.scale = (6, 1, 4); wall.rotation_euler = (math.pi / 2, 0, 0)
wall.location = (0, 0, 0)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
wall.data.materials.append(M_CONC)

# ---------------------------------------------------------------- board rig
BOARD_R = 0.225
BOARD_T = 0.040
FRONT_Y = -BOARD_T - 0.004          # front face (4 mm bracket gap to wall)
rig = bpy.data.objects.new("BoardRig", None); scn.collection.objects.link(rig)

# disc: lathe a profile with a rounded edge, axis along -Y
prof = [(0.0, 0.0)]
for i in range(9):
    a = (math.pi / 2) * i / 8
    prof.append((BOARD_R - 0.006 + 0.006 * math.sin(a), 0.006 - 0.006 * math.cos(a)))
prof += [(BOARD_R, BOARD_T - 0.004), (BOARD_R - 0.004, BOARD_T), (0.0, BOARD_T)]
# start at the face centre (z=0 = front face), z grows toward the wall
bm = lathe([(r, z) for r, z in prof], segs=180)
disc = obj_from_bm("BoardDisc", bm, [M_BOARD], parent=rig)
disc.rotation_euler = (math.pi / 2, 0, 0)  # local +Z -> world -Y ... flip below
disc.location = (0, FRONT_Y, 0)
disc.rotation_euler = (-math.pi / 2, 0, 0)  # local +Z -> world +Y (toward the wall)
bpy.context.view_layer.update()
# fix normals (lathe winding)
bm = bmesh.new(); bm.from_mesh(disc.data)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(disc.data); bm.free()

def place_on_face(ob, depth=0.0):
    """object built in XY plane (z up) -> board face plane XZ, facing -Y."""
    ob.rotation_euler = (math.pi / 2, 0, 0)
    ob.location = (0, FRONT_Y - depth, 0)
    ob.parent = rig

WIRE_r = 0.0005
for R in (0.0159, 0.099, 0.107, 0.162, 0.170):
    t = obj_from_bm(f"Ring_{R}", torus_bm(R, WIRE_r, segs=max(64, int(R * 2400)), rsegs=10),
                    [M_STEEL])
    place_on_face(t, WIRE_r * 0.55)
rim = obj_from_bm("RimBand", torus_bm(BOARD_R - 0.0015, 0.0014, segs=360, rsegs=12), [M_STEEL])
place_on_face(rim, 0.0004)

# radial wires
bm = bmesh.new()
for k in range(20):
    a = math.radians(9 + 18 * k)
    d = Vector((math.cos(a), math.sin(a), 0))
    geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=WIRE_r, radius2=WIRE_r,
                                 depth=0.170 - 0.0159)
    vs = geom["verts"]
    # cone is along Z centred at 0 -> rotate to direction d and move to mid radius
    rot = Vector((0, 0, 1)).rotation_difference(d).to_matrix().to_4x4()
    mid = d * (0.0159 + 0.170) / 2
    bmesh.ops.transform(bm, matrix=Matrix.Translation(mid) @ rot, verts=vs)
rad = obj_from_bm("RadialWires", bm, [M_STEEL])
place_on_face(rad, WIRE_r * 0.55)

# gold bullseye: slightly domed polished disc (outer bull r=15.9 mm)
bprof = [(0.0, 0.0012)]
for i in range(1, 13):
    r = 0.0153 * i / 12
    bprof.append((r, 0.0012 - 0.0005 * (r / 0.0153) ** 2))
bprof += [(0.0157, 0.0004), (0.0157, -0.001)]
bm = lathe(bprof, segs=96)
bull = obj_from_bm("GoldBull", bm, [M_GOLD])
place_on_face(bull, 0.0)
bm = bmesh.new(); bm.from_mesh(bull.data)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(bull.data); bm.free()

# ---------------------------------------------------------------- dart
DART_LEN = 0.140
needle_prof = [(0.0, 0.0), (0.00045, 0.0012), (0.00095, 0.0045), (0.00112, 0.009),
               (0.00115, 0.031), (0.0016, 0.0325)]
barrel_prof = [(0.0016, 0.0325), (0.0028, 0.0335), (0.0031, 0.036), (0.0033, 0.040),
               (0.0035, 0.046), (0.0035, 0.068), (0.0033, 0.072), (0.0028, 0.077),
               (0.0024, 0.0790), (0.0020, 0.0795)]
shaft_prof = [(0.0020, 0.0795), (0.0016, 0.081), (0.00155, 0.110), (0.0019, 0.112),
              (0.0019, 0.140), (0.0, 0.1402)]
bm_all = bmesh.new()
dart_me = bpy.data.meshes.new("Dart")
for prof_, mi in ((needle_prof, 0), (barrel_prof, 1), (shaft_prof, 2)):
    b_ = lathe(prof_, segs=40)
    for f in b_.faces: f.material_index = mi
    tmp = bpy.data.meshes.new("tmp"); b_.to_mesh(tmp); b_.free()
    bm_all.from_mesh(tmp); bpy.data.meshes.remove(tmp)
bmesh.ops.remove_doubles(bm_all, verts=bm_all.verts, dist=1e-7)
bmesh.ops.recalc_face_normals(bm_all, faces=bm_all.faces)
dart = obj_from_bm("Dart", bm_all, [M_NEEDLE, M_KNURL, M_SHAFT])

# flights: 4 wings, origin at their base (z=0.098 in dart space)
FL_BASE = 0.100
wing = [(0.0016, 0.000), (0.0060, 0.004), (0.0165, 0.024), (0.0170, 0.039),
        (0.0120, 0.040), (0.0016, 0.040)]
bm = bmesh.new()
for k in range(4):
    a = k * math.pi / 2
    ca, sa = math.cos(a), math.sin(a)
    vs = [bm.verts.new((r * ca, r * sa, z)) for r, z in wing]
    f = bm.faces.new(vs)
res = bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.00025)
fl = obj_from_bm("Flights", bm, [M_GOLDFLIGHT], smooth=False)
fl.parent = dart
fl.location = (0, 0, FL_BASE)
bev = fl.modifiers.new("bevel", "BEVEL"); bev.width = 0.0001; bev.segments = 2

# ---------------------------------------------------------------- dust particles
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1)
grain_me = bpy.context.active_object.data; bpy.data.objects.remove(bpy.context.active_object)
grain_me.materials.append(M_DUST)
for p in grain_me.polygons: p.use_smooth = True
bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=1, depth=1)
fib_me = bpy.context.active_object.data; bpy.data.objects.remove(bpy.context.active_object)
fib_me.materials.append(M_DUST)

# ---------------------------------------------------------------- lights
def add_light(name, kind, loc, look, color, energy, **kw):
    ld = bpy.data.lights.new(name, kind)
    ld.color = color; ld.energy = energy
    for k, v in kw.items(): setattr(ld, k, v)
    ob = bpy.data.objects.new(name, ld); scn.collection.objects.link(ob)
    ob.location = loc
    d = Vector(look) - Vector(loc)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return ob

KEY_E = float(E("KEY_E", 220)); RIM_E = float(E("RIM_E", 9))
add_light("KeySpot", "SPOT", (0.0, -0.50, 1.15), (0.0, FRONT_Y, -0.02), (1.0, 0.72, 0.45), KEY_E,
          spot_size=math.radians(float(E("SPOT_DEG", 16))), spot_blend=float(E("SPOT_BLEND", 0.55)), shadow_soft_size=0.12)
add_light("RimCyan", "AREA", (-1.05, -0.32, 0.18), (0.0, FRONT_Y, 0.0), (0.16, 0.84, 1.0), RIM_E,
          size=0.35, shape="RECTANGLE", size_y=0.9)
add_light("RimOrange", "AREA", (1.05, -0.32, 0.18), (0.0, FRONT_Y, 0.0), (1.0, 0.47, 0.08), RIM_E * 0.6,
          size=0.35, shape="RECTANGLE", size_y=0.9)

# reflection card: a warm softbox seen ONLY in glossy reflections (gives the polished gold
# and the steel something to mirror; adds no diffuse light, so the look stays one key spot)
card = add_light("GlossCard", "AREA", (0.05, -0.55, 0.62), (0.0, FRONT_Y, 0.0), (1.0, 0.80, 0.55),
                 float(E("CARD_E", 110)), size=0.6, shape="RECTANGLE", size_y=0.25)
card.visible_diffuse = False; card.visible_volume_scatter = False; card.visible_transmission = False
# light linking: the card only reaches the gold bull and the dart (on the rough board it
# turned the matte black into grey plaster)
card_rx = bpy.data.collections.new("CardReceivers")
for o in (bull, dart, fl):
    card_rx.objects.link(o)
card.light_linking.receiver_collection = card_rx

# ---------------------------------------------------------------- world + haze
world = bpy.data.worlds.new("World"); scn.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.0015, 0.0016, 0.002, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
if HAZE:
    bpy.ops.mesh.primitive_cube_add(size=1)
    hz = bpy.context.active_object; hz.name = "Haze"
    hz.scale = (3.0, 3.6, 3.0); hz.location = (0, -1.81, 0.3)   # wall -> behind camera
    hm = bpy.data.materials.new("HazeVol"); hm.use_nodes = True
    nt = hm.node_tree; nt.nodes.remove(nt.nodes["Principled BSDF"])
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Density"].default_value = float(E("HAZE_D", 0.012))
    vol.inputs["Anisotropy"].default_value = 0.45
    vol.inputs["Color"].default_value = (1, 1, 1, 1)
    nt.links.new(vol.outputs[0], nt.nodes["Material Output"].inputs["Volume"])
    hz.data.materials.append(hm)
    hz.visible_shadow = False

# ---------------------------------------------------------------- camera
cam_d = bpy.data.cameras.new("Cam")
cam_d.lens = 75; cam_d.sensor_width = 36
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 2.8
cam_d.dof.aperture_blades = 9; cam_d.dof.aperture_rotation = math.radians(10)
cam = bpy.data.objects.new("Cam", cam_d); scn.collection.objects.link(cam); scn.camera = cam
focus = bpy.data.objects.new("Focus", None); scn.collection.objects.link(focus)
focus.location = (0, FRONT_Y - 0.001, 0); focus.parent = None
cam_d.dof.focus_object = focus

BULL = Vector((0.0, FRONT_Y - 0.0012, 0.0))           # dome top
CAM_DIR = Vector((-0.30, -1.0, 0.10)).normalized()     # board -> camera
D_START, D_END = float(E("D_START", 1.6)), float(E("D_END", 0.52))

def smoothstep(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)

def ease_io(x):     # gentle, never stops: linear blend with smoothstep
    x = min(max(x, 0.0), 1.0)
    return 0.55 * x + 0.45 * smoothstep(x)

# ---------------------------------------------------------------- dart motion
TAIL_DIR = Vector((0.50, -0.78, 0.36)).normalized()    # from tip toward the tail
S0 = 0.62                                              # start distance along the path
ARC_K = 0.07
PEN = 0.013                                            # penetration depth
TIP_HIT = BULL.copy()

def dart_path(s):
    return TIP_HIT + TAIL_DIR * s + Vector((0, 0, 1)) * ARC_K * s * s

def dart_tangent(s):
    return (TAIL_DIR + Vector((0, 0, 1)) * 2 * ARC_K * s).normalized()

def board_wobble(t):
    """t seconds after impact -> (rot_x, rot_z, dy)  (small damped trembling)."""
    if t < 0: return 0.0, 0.0, 0.0
    env = math.exp(-t / 0.42)
    w = 2 * math.pi * 2.6
    rx = math.radians(0.22) * env * math.sin(w * t)
    rz = math.radians(0.10) * env * math.sin(w * t * 1.13 + 0.8)
    dy = 0.0030 * env * math.sin(w * t + 0.3)
    return rx, rz, dy

def rig_matrix(t):
    rx, rz, dy = board_wobble(t)
    return Matrix.Translation((0, dy, 0)) @ Euler((rx, 0, rz)).to_matrix().to_4x4()

SPIN_TOTAL = 2 * math.pi * 1.15
def dart_matrix(f):
    t_imp = (f - F_IMPACT) / FPS
    if f <= F_IMPACT:
        u = (f - F_IN) / (F_IMPACT - F_IN)
        s = S0 * (1 - u)
        tip = dart_path(s); axis = dart_tangent(s)
        spin = SPIN_TOTAL * u
        q = axis.to_track_quat("Z", "Y") @ Quaternion((0, 0, 1), spin)
        return Matrix.Translation(tip) @ q.to_matrix().to_4x4()
    # embedded: penetration over ~2 frames, then rides the board + its own shake
    pen = PEN * (1 - math.exp(-(f - F_IMPACT) / 0.9))
    tip = TIP_HIT - TAIL_DIR * pen
    env = math.exp(-t_imp / 0.33)
    w = 2 * math.pi * 4.2
    a1 = math.radians(1.6) * env * math.sin(w * t_imp)
    a2 = math.radians(0.9) * env * math.sin(w * t_imp * 1.21 + 1.1)
    q = TAIL_DIR.to_track_quat("Z", "Y") @ Quaternion((0, 0, 1), SPIN_TOTAL) \
        @ Quaternion((1, 0, 0), a1) @ Quaternion((0, 1, 0), a2)
    local = Matrix.Translation(tip) @ q.to_matrix().to_4x4()
    return rig_matrix(t_imp) @ local

def flights_rot(f):
    t = (f - F_IMPACT) / FPS
    if t < 0:
        return Euler((0.0, 0.0, 0.0))
    env = math.exp(-t / 0.45)
    w = 2 * math.pi * 6.5
    return Euler((math.radians(3.0) * env * math.sin(w * t),
                  math.radians(2.0) * env * math.sin(w * t * 0.9 + 0.7), 0.0))

# ---------------------------------------------------------------- particles
DUST = []
for i in range(140):
    fibre = i % 4 == 0
    ob = bpy.data.objects.new(f"dust{i}", fib_me if fibre else grain_me)
    scn.collection.objects.link(ob)
    # emission direction: hemisphere out of the board, biased up/right (back along the dart)
    th = random.uniform(0, 2 * math.pi)
    radial = Vector((math.cos(th), 0, math.sin(th)))
    out = Vector((0, -1, 0))
    v = (out * random.uniform(0.35, 1.0) + radial * random.uniform(0.25, 1.0)
         + TAIL_DIR * random.uniform(0.0, 0.35))
    v = v.normalized() * random.uniform(0.06, 0.34)
    size = random.uniform(0.0003, 0.0010) if not fibre else random.uniform(0.00012, 0.00022)
    length = random.uniform(0.002, 0.007)
    DUST.append(dict(ob=ob, v=v, fibre=fibre, size=size, length=length,
                     life=random.uniform(1.4, 2.4), delay=random.uniform(0, 0.06),
                     rot=Euler([random.uniform(0, 6.28) for _ in range(3)]),
                     rv=Vector([random.uniform(-4, 4) for _ in range(3)]),
                     start=BULL + radial * random.uniform(0.0005, 0.004)))
G_SLOW = 0.055; DRAG = 1.6

def dust_state(p, f):
    t = (f - F_IMPACT) / FPS - p["delay"]
    if t <= 0:
        return None
    k = DRAG
    disp = p["v"] * ((1 - math.exp(-k * t)) / k)
    disp.z -= G_SLOW * (t / k - (1 - math.exp(-k * t)) / (k * k))
    life = t / p["life"]
    sc = 1.0 if life < 0.7 else max(0.0, 1 - (life - 0.7) / 0.3)
    sc *= min(1.0, t * 30 + 0.2)
    return p["start"] + disp, sc, t

# ---------------------------------------------------------------- keyframes
t0 = time.time()
for f in range(F_FIRST, F_LAST + 1):
    t_imp = (f - F_IMPACT) / FPS
    # board rig
    rig.matrix_world = rig_matrix(t_imp)
    rig.keyframe_insert("location", frame=f); rig.keyframe_insert("rotation_euler", frame=f)
    # dart
    dart.hide_render = f < F_IN - 1
    dart.keyframe_insert("hide_render", frame=f)
    if f >= F_IN - 1:
        M = dart_matrix(max(f, F_IN))
        dart.matrix_world = M
        dart.rotation_mode = "QUATERNION"
        dart.location = M.to_translation(); dart.rotation_quaternion = M.to_quaternion()
        dart.keyframe_insert("location", frame=f); dart.keyframe_insert("rotation_quaternion", frame=f)
    fl.rotation_euler = flights_rot(f); fl.keyframe_insert("rotation_euler", frame=f)
    # camera push-in with a breath of drift
    u = (f - F_FIRST) / (F_LAST - F_FIRST)
    dist = D_START + (D_END - D_START) * ease_io(u)
    tt = f / FPS
    drift = Vector((0.0012 * math.sin(tt * 0.9), 0, 0.0009 * math.sin(tt * 0.7 + 1)))
    aim = BULL + Vector((0.012, 0, 0.006)) * (1 - u) + drift * 0.3
    cam.location = BULL + CAM_DIR * dist + drift
    cam.rotation_euler = (aim - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.keyframe_insert("location", frame=f); cam.keyframe_insert("rotation_euler", frame=f)
    # dust
    for p in DUST:
        ob = p["ob"]
        st = dust_state(p, f)
        if st is None:
            ob.location = p["start"]; ob.scale = (0, 0, 0)
        else:
            pos, sc, t = st
            ob.location = pos
            if p["fibre"]:
                ob.scale = (p["size"] * sc, p["size"] * sc, p["length"] * sc)
            else:
                s_ = p["size"] * sc; ob.scale = (s_, s_, s_)
            ob.rotation_euler = Euler([p["rot"][i] + p["rv"][i] * t for i in range(3)])
        ob.keyframe_insert("location", frame=f); ob.keyframe_insert("scale", frame=f)
        ob.keyframe_insert("rotation_euler", frame=f)
# linear interpolation everywhere (we sample every frame) -> clean motion blur
for ob in bpy.data.objects:
    if ob.animation_data and ob.animation_data.action:
        for fc in ob.animation_data.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "CONSTANT" if fc.data_path == "hide_render" else "LINEAR"
print(f"[scene] keyframes built in {time.time()-t0:.1f}s")

# --- check where the dart enters (camera-space) -----------------------------
from bpy_extras.object_utils import world_to_camera_view
for f in (F_IN, F_IN + 10, F_IN + 20, F_IN + 30, F_IMPACT):
    scn.frame_set(f)
    tail = dart.matrix_world @ Vector((0, 0, DART_LEN))
    tip = dart.matrix_world.translation
    print(f"[scene] f{f} tip={tuple(round(c,3) for c in world_to_camera_view(scn, cam, tip))}"
          f" tail={tuple(round(c,3) for c in world_to_camera_view(scn, cam, tail))}")

# ---------------------------------------------------------------- render settings
r = scn.render
r.engine = "CYCLES"
scn.cycles.device = "CPU"
scn.cycles.samples = SAMPLES
scn.cycles.use_adaptive_sampling = True
scn.cycles.adaptive_threshold = float(E("ADAPT", 0.02))
# this Blender build has no OIDN: store albedo/normal and denoise outside (denoise.py)
scn.cycles.use_denoising = False
bpy.context.view_layer.cycles.denoising_store_passes = True
scn.cycles.max_bounces = 6
scn.cycles.diffuse_bounces = 2; scn.cycles.glossy_bounces = 3
scn.cycles.transmission_bounces = 0; scn.cycles.volume_bounces = 0
scn.cycles.transparent_max_bounces = 2
scn.cycles.volume_step_rate = float(E("VOL_STEP", 4.0))
scn.cycles.volume_max_steps = 96
scn.cycles.sample_clamp_indirect = 3.0
scn.cycles.blur_glossy = 1.0
r.use_persistent_data = True
r.use_motion_blur = bool(MBLUR); r.motion_blur_shutter = 0.5
r.resolution_x, r.resolution_y = 1920, 1080
r.resolution_percentage = RES_PCT
r.film_transparent = False
r.image_settings.file_format = "OPEN_EXR_MULTILAYER"
r.image_settings.color_depth = "32"
r.image_settings.exr_codec = "ZIP"
scn.view_settings.view_transform = "AgX"
scn.view_settings.look = "AgX - Medium High Contrast"
scn.view_settings.exposure = float(E("EXPOSURE", 0.0))
if E("THREADS"):
    scn.render.threads_mode = "FIXED"; scn.render.threads = int(E("THREADS"))
else:
    scn.render.threads_mode = "AUTO"

scn.use_nodes = False   # glare/dispersion/AgX are applied in grade.py after denoising

if E("SAVE_BLEND"):
    bpy.ops.wm.save_as_mainfile(filepath=E("SAVE_BLEND"))

# ---------------------------------------------------------------- render
os.makedirs(os.path.dirname(OUT), exist_ok=True)
if STILLS:
    for f in STILLS:
        scn.frame_set(f)
        r.filepath = f"{OUT}{f:04d}.exr"
        ts = time.time()
        bpy.ops.render.render(write_still=True)
        print(f"[still] frame {f} rendered in {time.time()-ts:.1f}s -> {r.filepath}", flush=True)
else:
    scn.frame_start, scn.frame_end = FRAME_START, FRAME_END
    r.filepath = OUT
    ts = time.time()
    bpy.ops.render.render(animation=True)
    print(f"[anim] frames {FRAME_START}-{FRAME_END} in {time.time()-ts:.1f}s", flush=True)
