# Rendert die 10 neuen Waffen-GLBs als Vorschau-Kontaktbogen (ein PNG pro Waffe)
# nach /tmp/wpreview/. Headless:
#   /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/preview_weapons.py
import bpy, os, math

SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "weapons")
OUT = "/tmp/wpreview"
os.makedirs(OUT, exist_ok=True)
NAMES = ["boomerang","rocket","grenade","ricochet","voidgun","tesla","dronepod","wobble","flame","forkbomb"]

def clear():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()

scene = bpy.context.scene
for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
    try:
        scene.render.engine = eng
        break
    except Exception:
        continue
scene.render.resolution_x = 480
scene.render.resolution_y = 360
scene.render.film_transparent = False
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.10, 0.07, 0.13, 1)
scene.world.node_tree.nodes["Background"].inputs[1].default_value = 1.0

for name in NAMES:
    clear()
    path = os.path.join(SRC, name + ".glb")
    bpy.ops.import_scene.gltf(filepath=path)
    # Ziel-Empty im Ursprung, Kamera schaut darauf (Mündung +Y zur Kamera).
    bpy.ops.object.empty_add(location=(0, 0.2, 0.1))
    tgt = bpy.context.active_object
    bpy.ops.object.camera_add(location=(2.4, 2.9, 1.7))
    cam = bpy.context.active_object
    con = cam.constraints.new("TRACK_TO")
    con.target = tgt
    con.track_axis = "TRACK_NEGATIVE_Z"
    con.up_axis = "UP_Y"
    scene.camera = cam
    bpy.ops.object.light_add(type="SUN", location=(3, 3, 6))
    bpy.context.active_object.data.energy = 6.0
    bpy.ops.object.light_add(type="AREA", location=(-3, 1, 4))
    bpy.context.active_object.data.energy = 600.0
    bpy.ops.object.light_add(type="AREA", location=(2, -2, 3))
    bpy.context.active_object.data.energy = 400.0
    scene.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("rendered", name)

print("DONE")
