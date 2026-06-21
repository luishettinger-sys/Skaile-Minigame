# Baut 10 kreative Low-Poly-Toon-Waffen prozedural und exportiert sie als GLB
# nach assets/weapons/. Headless ausführbar:
#   /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build_weapons.py
#
# Konventionen (passend zur bestehenden Pipeline in src/weaponmodels.js):
#   +Y = Lauf/Blickrichtung   +Z = oben   +X = rechts
#   Griff zeigt nach unten (-Z) und leicht nach hinten (-Y).
# Der glTF-Export (Y-up) macht aus Blender-+Y im Spiel -Z; normalize() dreht
# es um 180° → Lauf zeigt im Spiel nach +Z. Native Größe wird beibehalten.
import bpy, os, math

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "weapons")
os.makedirs(OUT, exist_ok=True)

def srgb2lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def hexcol(h):
    r = ((h >> 16) & 255) / 255.0
    g = ((h >> 8) & 255) / 255.0
    b = (h & 255) / 255.0
    return (srgb2lin(r), srgb2lin(g), srgb2lin(b), 1.0)

_mats = {}
def mat(name, h, metal=0.35, rough=0.5):
    key = (name, h, metal, rough)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = hexcol(h)
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = rough
    _mats[key] = m
    return m

# Gemeinsame Farben
GUN   = 0x14171f  # dunkles Gunmetal
GUN2  = 0x2a2f3a  # helleres Gehäuse-Grau
GRIP  = 0x0e1014

def _apply(obj, m):
    obj.data.materials.clear()
    obj.data.materials.append(m)
    for p in obj.data.polygons:
        p.use_smooth = False

def cube(loc, dim, m, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.active_object
    o.scale = (dim[0]/2, dim[1]/2, dim[2]/2)
    o.rotation_euler = rot
    _apply(o, m)
    return o

def cyl(loc, radius, depth, m, axis="Y", verts=18, rot=None):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, vertices=verts, location=loc)
    o = bpy.context.active_object
    if rot is not None:
        o.rotation_euler = rot
    elif axis == "Y":
        o.rotation_euler = (math.pi/2, 0, 0)
    elif axis == "X":
        o.rotation_euler = (0, math.pi/2, 0)
    _apply(o, m)
    return o

def cone(loc, r1, r2, depth, m, axis="Y", verts=18):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, vertices=verts, location=loc)
    o = bpy.context.active_object
    if axis == "Y":
        o.rotation_euler = (-math.pi/2, 0, 0)  # Spitze nach +Y
    _apply(o, m)
    return o

def sphere(loc, radius, m, seg=18):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, segments=seg, ring_count=seg//2, location=loc)
    o = bpy.context.active_object
    _apply(o, m)
    return o

def torus(loc, major, minor, m, rot=(0,0,0), seg=20, sides=10):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc,
                                     major_segments=seg, minor_segments=sides)
    o = bpy.context.active_object
    o.rotation_euler = rot
    _apply(o, m)
    return o

def grip(m=None):
    # Standard-Pistolengriff: nach unten/hinten geneigt.
    m = m or mat("grip", GRIP, 0.1, 0.7)
    return cube((0, -0.32, -0.42), (0.22, 0.34, 0.62), m, rot=(0.32, 0, 0))

def body(length=1.0, h=0x14171f):
    return cube((0, 0.05, 0.0), (0.30, length, 0.34), mat("body", h, 0.45, 0.45))

def clear():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for blk in (bpy.data.meshes, bpy.data.materials):
        for d in list(blk):
            if d.users == 0:
                blk.remove(d)
    _mats.clear()

def export(name):
    bpy.ops.object.select_all(action="SELECT")
    path = os.path.join(OUT, name + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_apply=True, export_yup=True)
    print("exported", path)

# ===========================================================================
#  Die 10 Waffen
# ===========================================================================

def w_boomerang():
    ACC = 0x80ed99
    body(0.9)
    grip()
    cyl((0, 0.62, 0.06), 0.12, 0.5, mat("emit", GUN2, 0.6, 0.3))  # Ausstoß-Schacht
    # Grüner Bumerang (gewinkeltes V) vorne aufgesetzt.
    a = mat("acc", ACC, 0.2, 0.4)
    cube((0.0, 0.95, 0.30), (0.55, 0.16, 0.10), a, rot=(0, 0, 0.5))
    cube((0.0, 0.95, 0.30), (0.55, 0.16, 0.10), a, rot=(0, 0, -0.5))
    sphere((0.0, 0.95, 0.42), 0.10, a)

def w_rocket():
    ACC = 0xff8c1a
    # Dickes Rohr.
    cyl((0, 0.05, 0.05), 0.26, 1.3, mat("tube", GUN2, 0.5, 0.45))
    cyl((0, 0.05, 0.05), 0.30, 0.14, mat("ring", GUN, 0.6, 0.4), rot=(math.pi/2,0,0))  # Mündungsring
    grip()
    cube((0, -0.2, -0.05), (0.5, 0.34, 0.14), mat("body", GUN, 0.45, 0.45))  # Schulterauflage
    # Rakete schaut vorne raus.
    cone((0, 0.78, 0.05), 0.16, 0.0, 0.4, mat("acc", ACC, 0.3, 0.4))
    cyl((0, 0.55, 0.05), 0.15, 0.3, mat("acc2", 0xff5470, 0.3, 0.4))
    # kleines Visier
    cube((0, 0.2, 0.30), (0.06, 0.18, 0.18), mat("sight", GUN, 0.5, 0.4))

def w_grenade():
    ACC = 0xffd23f
    body(0.8, GUN2)
    grip()
    # Fette, kurze Mündung + Trommel.
    cyl((0, 0.55, 0.02), 0.28, 0.5, mat("muzzle", GUN, 0.55, 0.4))
    cyl((0, 0.62, 0.02), 0.30, 0.12, mat("ring", ACC, 0.4, 0.4), rot=(math.pi/2,0,0))
    torus((0, 0.1, -0.12), 0.22, 0.08, mat("drum", GUN, 0.6, 0.4), rot=(0, math.pi/2, 0))  # Trommel
    sphere((0, 0.78, 0.02), 0.16, mat("nade", ACC, 0.3, 0.45))  # sichtbare Granate

def w_ricochet():
    ACC = 0x6ee7ff
    body(0.85)
    grip()
    cyl((0, 0.55, 0.05), 0.10, 0.5, mat("barrel", GUN2, 0.6, 0.4))
    # Tischtennis-Schläger als Mündungsplatte (flache Scheibe + Stiel).
    cyl((0, 0.92, 0.05), 0.34, 0.07, mat("paddle", ACC, 0.15, 0.5), rot=(math.pi/2,0,0))
    torus((0, 0.92, 0.05), 0.34, 0.04, mat("rim", 0xff5470, 0.2, 0.45), rot=(math.pi/2,0,0))
    sphere((0, 0.92, 0.10), 0.08, mat("dot", 0xffffff, 0.1, 0.4))

def w_singularity():
    ACC = 0x9b5de5
    body(0.95, GUN2)
    grip()
    # Drei Halteklauen, die einen dunklen Orb umschließen.
    claw = mat("claw", GUN, 0.6, 0.35)
    for ang in (0, 2.094, 4.188):
        cube((0.0, 0.7, 0.05), (0.10, 0.45, 0.10), claw, rot=(0, ang, 0))
    sphere((0, 0.85, 0.05), 0.20, mat("orb", 0x0a0a12, 0.1, 0.15))  # "schwarzes Loch"
    torus((0, 0.85, 0.05), 0.30, 0.05, mat("halo", ACC, 0.2, 0.4), rot=(math.pi/2, 0, 0))

def w_tesla():
    ACC = 0x6ef0ff
    body(0.8)
    grip()
    # Spulen-Stapel.
    coil = mat("coil", 0xb87333, 0.7, 0.4)  # Kupfer
    for i, y in enumerate((0.25, 0.42, 0.59)):
        torus((0, y, 0.18), 0.18 - i*0.02, 0.05, coil, rot=(math.pi/2, 0, 0))
    # Zwei Prongs vorne (Funkenstrecke).
    pr = mat("prong", ACC, 0.6, 0.3)
    cube((0.10, 0.75, 0.05), (0.06, 0.4, 0.06), pr)
    cube((-0.10, 0.75, 0.05), (0.06, 0.4, 0.06), pr)
    sphere((0.10, 0.95, 0.05), 0.06, pr)
    sphere((-0.10, 0.95, 0.05), 0.06, pr)

def w_dronepod():
    ACC = 0x6ee7ff
    body(0.8, GUN2)
    grip()
    cyl((0, 0.5, 0.05), 0.20, 0.45, mat("launcher", GUN, 0.55, 0.4))  # Abschuss-Pod
    # Kleine Drohnen oben angedockt.
    d = mat("drone", ACC, 0.4, 0.35)
    for x in (-0.18, 0.18):
        cube((x, 0.2, 0.34), (0.16, 0.16, 0.10), d)
        cube((x, 0.2, 0.42), (0.30, 0.04, 0.02), mat("wing", GUN, 0.5, 0.4))  # Rotorbalken
    cube((0, 0.7, 0.30), (0.03, 0.03, 0.3), mat("antenna", GUN, 0.5, 0.4))  # Antenne
    sphere((0, 0.86, 0.30), 0.05, d)

def w_wobble():
    ACC = 0xff6ec7
    body(0.8, GUN2)
    grip()
    # Großer Lautsprecher-Konus als Mündung.
    cone((0, 0.7, 0.05), 0.36, 0.12, 0.45, mat("cone", GUN, 0.4, 0.5))
    cyl((0, 0.92, 0.05), 0.36, 0.06, mat("rim", ACC, 0.2, 0.45), rot=(math.pi/2,0,0))
    sphere((0, 0.7, 0.05), 0.14, mat("dust", ACC, 0.2, 0.4))  # Staubkappe
    # Bass-Reflex-Röhrchen.
    cyl((0.16, 0.3, 0.18), 0.05, 0.3, mat("port", GUN, 0.5, 0.4))

def w_flame():
    ACC = 0xff8c1a
    body(0.7)
    grip()
    # Brennstofftank seitlich.
    cyl((0.0, -0.05, -0.22), 0.16, 0.6, mat("tank", 0xc0392b, 0.4, 0.5), rot=(math.pi/2,0,0))
    sphere((0.0, 0.25, -0.22), 0.16, mat("tankcap", 0xc0392b, 0.4, 0.5))
    sphere((0.0, -0.35, -0.22), 0.16, mat("tankcap2", 0xc0392b, 0.4, 0.5))
    # Düse mit weiter Öffnung + Zündflamme.
    cyl((0, 0.55, 0.06), 0.10, 0.5, mat("nozzle", GUN2, 0.6, 0.4))
    cone((0, 0.85, 0.06), 0.18, 0.10, 0.22, mat("flare", GUN, 0.5, 0.4))
    sphere((0.12, 0.7, 0.06), 0.05, mat("pilot", ACC, 0.2, 0.4))  # Pilotflamme

def w_forkbomb():
    ACC = 0x80ed99
    body(0.8)
    grip()
    cyl((0, 0.45, 0.05), 0.12, 0.4, mat("barrel", GUN2, 0.6, 0.4))
    # Gabel: drei Prongs, die sich vorne aufspreizen.
    f = mat("fork", ACC, 0.3, 0.4)
    cube((0.0, 0.78, 0.05), (0.07, 0.42, 0.07), f, rot=(0, 0, 0))
    cube((0.0, 0.78, 0.05), (0.07, 0.42, 0.07), f, rot=(0.0, 0.0, 0.45))
    cube((0.0, 0.78, 0.05), (0.07, 0.42, 0.07), f, rot=(0.0, 0.0, -0.45))
    for x in (-0.18, 0, 0.18):
        sphere((x, 0.98, 0.05), 0.06, f)

WEAPONS = [
    ("boomerang", w_boomerang),
    ("rocket",    w_rocket),
    ("grenade",   w_grenade),
    ("ricochet",  w_ricochet),
    ("voidgun",   w_singularity),
    ("tesla",     w_tesla),
    ("dronepod",  w_dronepod),
    ("wobble",    w_wobble),
    ("flame",     w_flame),
    ("forkbomb",  w_forkbomb),
]

for name, fn in WEAPONS:
    clear()
    fn()
    export(name)

print("DONE: %d Waffen gebaut." % len(WEAPONS))
