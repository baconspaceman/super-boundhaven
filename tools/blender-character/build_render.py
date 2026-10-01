"""SBH character spike: procedural chibi humanoid -> side-on ortho data-pass renders.

Run headless:
  blender.exe --background --factory-startup --python build_render.py -- --out <dir> [--scale 4] [--anims idle,run]

Everything is procedural and original (primitives only). Output: per (anim, frame, layer) two PNGs:
  *_data.png  R = view-depth (0..1 over 2 units), G = recolor slot id / 16, A = coverage
  *_nrm.png   RGB = world-space normal * 0.5 + 0.5, A = coverage
No lighting, no anti-aliasing, raw colour management, so every value is exact data for pixelize.py.

Conventions: character faces +X, camera looks along +Y from -Y (screen right = +X), ground z = 0.
Frame = 24x32 native px, 1 native px = 0.05 units, feet row = 30 (2 px margin below).
"""
import math
import sys
import time
from pathlib import Path

import bpy
import bmesh
from mathutils import Euler, Quaternion, Vector

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default

OUT = Path(arg("--out", "out"))
SCALE = int(arg("--scale", "4"))
ANIMS = arg("--anims", "idle,run").split(",")
NATIVE_W, NATIVE_H = 24, 32
PX = 0.05  # world units per native px
GROUND_ROW = 30

SLOTS = {"skin": 1, "hair": 2, "primary": 3, "secondary": 4, "accent": 5, "eye": 6}

# ---------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
OUT.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------- materials
def emission_mat(name, build):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(em.outputs[0], out.inputs[0])
    build(nt, em)
    return m

def build_data(slot):
    def f(nt, em):
        cam = nt.nodes.new("ShaderNodeCameraData")
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["From Min"].default_value = 9.0
        mr.inputs["From Max"].default_value = 11.0
        mr.clamp = True
        nt.links.new(cam.outputs["View Z Depth"], mr.inputs["Value"])
        comb = nt.nodes.new("ShaderNodeCombineColor")
        comb.inputs["Green"].default_value = slot / 16.0
        nt.links.new(mr.outputs["Result"], comb.inputs["Red"])
        nt.links.new(comb.outputs[0], em.inputs["Color"])
    return f

def build_nrm(nt, em):
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    mul = nt.nodes.new("ShaderNodeVectorMath")
    mul.operation = "MULTIPLY_ADD"
    mul.inputs[1].default_value = (0.5, 0.5, 0.5)
    mul.inputs[2].default_value = (0.5, 0.5, 0.5)
    nt.links.new(geo.outputs["Normal"], mul.inputs[0])
    nt.links.new(mul.outputs[0], em.inputs["Color"])

DATA_MATS = {s: emission_mat(f"data_{n}", build_data(s)) for n, s in SLOTS.items()}
NRM_MAT = emission_mat("nrm", build_nrm)

# ---------------------------------------------------------------- collections
def collection(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c

COLL = {n: collection(n) for n in ("body", "face", "hair", "outfit", "cape")}

# ---------------------------------------------------------------- armature
arm_data = bpy.data.armatures.new("rig")
arm = bpy.data.objects.new("rig", arm_data)
scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
eb = arm_data.edit_bones
BONES = {}

def bone(name, head, tail, parent=None):
    b = eb.new(name)
    b.head, b.tail = Vector(head), Vector(tail)
    if parent:
        b.parent = eb[parent]
    BONES[name] = (head, tail)
    return b

bone("root", (0, 0, 0), (0, 0, 0.1))
bone("hips", (0, 0, 0.38), (0, 0, 0.5), "root")
bone("spine", (0, 0, 0.5), (0, 0, 0.75), "hips")
bone("head", (0, 0, 0.75), (0, 0, 1.25), "spine")
for side, y in (("N", -0.15), ("F", 0.15)):  # N = near camera, F = far
    bone(f"uarm.{side}", (0, y, 0.70), (0, y, 0.56), "spine")
    bone(f"farm.{side}", (0, y, 0.56), (0, y, 0.43), f"uarm.{side}")
    yl = y * 0.5
    bone(f"thigh.{side}", (0, yl, 0.38), (0, yl, 0.20), "hips")
    bone(f"shin.{side}", (0, yl, 0.20), (0, yl, 0.06), f"thigh.{side}")
    bone(f"foot.{side}", (0, yl, 0.06), (0.12, yl, 0.06), f"shin.{side}")
bone("cape1", (-0.15, 0, 0.70), (-0.17, 0, 0.52), "spine")
bone("cape2", (-0.17, 0, 0.52), (-0.19, 0, 0.32), "cape1")
bpy.ops.object.mode_set(mode="OBJECT")

# ---------------------------------------------------------------- parts
def add_part(name, kind, center, size, coll, rl, slot, bone_name, rot=(0, 0, 0), seg=12):
    bm = bmesh.new()
    if kind == "sphere":
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(6, seg // 2 + 1), radius=1.0)
    elif kind == "cube":
        bmesh.ops.create_cube(bm, size=2.0)
    for v in bm.verts:
        v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
    if any(rot):
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Euler([math.radians(a) for a in rot]).to_matrix())
    for v in bm.verts:
        v.co += Vector(center)
    for f in bm.faces:
        f.smooth = True
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    me.materials.append(DATA_MATS[slot])
    ob["rl"] = rl
    ob["slot"] = slot
    vg = ob.vertex_groups.new(name=bone_name)
    vg.add(list(range(len(me.vertices))), 1.0, "REPLACE")
    mod = ob.modifiers.new("arm", "ARMATURE")
    mod.object = arm
    return ob

S = SLOTS
# body ------------------------------------------------------------
add_part("head", "sphere", (0.02, 0, 0.99), (0.26, 0.22, 0.24), COLL["body"], "body", S["skin"], "head", seg=16)
add_part("torso", "sphere", (0, 0, 0.57), (0.15, 0.12, 0.19), COLL["body"], "body", S["skin"], "spine")
add_part("pelvis", "sphere", (0, 0, 0.42), (0.15, 0.12, 0.10), COLL["body"], "body", S["skin"], "hips")
for side, y in (("N", -0.15), ("F", 0.15)):
    yl = y * 0.5
    bl = "body_near" if side == "N" else "body_far"
    add_part(f"uarm.{side}", "sphere", (0, y, 0.63), (0.078, 0.078, 0.10), COLL["body"], bl, S["skin"], f"uarm.{side}", seg=8)
    add_part(f"farm.{side}", "sphere", (0, y, 0.49), (0.072, 0.072, 0.09), COLL["body"], bl, S["skin"], f"farm.{side}", seg=8)
    add_part(f"hand.{side}", "sphere", (0, y, 0.40), (0.085, 0.085, 0.075), COLL["body"], bl, S["skin"], f"farm.{side}", seg=8)
    add_part(f"thigh.{side}", "sphere", (0, yl, 0.29), (0.088, 0.088, 0.11), COLL["body"], bl, S["skin"], f"thigh.{side}", seg=8)
    add_part(f"shin.{side}", "sphere", (0, yl, 0.13), (0.078, 0.078, 0.09), COLL["body"], bl, S["skin"], f"shin.{side}", seg=8)
    add_part(f"foot.{side}", "sphere", (0.05, yl, 0.055), (0.13, 0.085, 0.055), COLL["body"], bl, S["skin"], f"foot.{side}", seg=8)
# face -------------------------------------------------------------
add_part("eye", "sphere", (0.215, -0.04, 1.00), (0.05, 0.055, 0.09), COLL["face"], "face", S["eye"], "head", seg=8)
# hair -------------------------------------------------------------
add_part("hair_back", "sphere", (-0.10, 0, 0.99), (0.22, 0.23, 0.25), COLL["hair"], "hair_back", S["hair"], "head", seg=14)
add_part("hair_top", "sphere", (0.0, 0, 1.13), (0.285, 0.24, 0.13), COLL["hair"], "hair_front", S["hair"], "head", seg=14)
add_part("hair_fringe", "sphere", (0.17, 0, 1.08), (0.12, 0.23, 0.10), COLL["hair"], "hair_front", S["hair"], "head", seg=10)
add_part("hair_tuft", "sphere", (-0.04, 0, 1.26), (0.07, 0.07, 0.10), COLL["hair"], "hair_front", S["hair"], "head", (0, 25, 0), seg=8)
# outfit -----------------------------------------------------------
add_part("tunic", "sphere", (0, 0, 0.57), (0.175, 0.145, 0.205), COLL["outfit"], "outfit", S["primary"], "spine")
add_part("skirt", "sphere", (0, 0, 0.42), (0.19, 0.155, 0.095), COLL["outfit"], "outfit", S["primary"], "hips")
for side, y in (("N", -0.15), ("F", 0.15)):
    yl = y * 0.5
    ol = "outfit_near" if side == "N" else "outfit_far"
    add_part(f"sleeve.{side}", "sphere", (0, y, 0.64), (0.098, 0.098, 0.095), COLL["outfit"], ol, S["primary"], f"uarm.{side}", seg=8)
    add_part(f"boot.{side}", "sphere", (0.04, yl, 0.07), (0.145, 0.10, 0.085), COLL["outfit"], ol, S["secondary"], f"foot.{side}", seg=8)
    add_part(f"bootshaft.{side}", "sphere", (0, yl, 0.12), (0.092, 0.092, 0.06), COLL["outfit"], ol, S["secondary"], f"shin.{side}", seg=8)
# cape -------------------------------------------------------------
add_part("cape_a", "sphere", (-0.17, 0, 0.60), (0.035, 0.17, 0.13), COLL["cape"], "cape", S["accent"], "cape1", seg=10)
add_part("cape_b", "sphere", (-0.19, 0, 0.42), (0.035, 0.15, 0.13), COLL["cape"], "cape", S["accent"], "cape2", seg=10)

PARTS = [o for o in bpy.data.objects if "rl" in o]
LAYERS = ["cape", "hair_back", "body_far", "outfit_far", "body", "outfit", "face", "hair_front", "body_near", "outfit_near"]

# ---------------------------------------------------------------- camera
cam_data = bpy.data.cameras.new("cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = NATIVE_H * PX  # larger render dimension is height
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
ground_top_z = GROUND_ROW * PX  # rows from top to ground
cam_z = ground_top_z - NATIVE_H * PX / 2  # frame centre z so ground sits on row GROUND_ROW
cam.location = (0, -10, NATIVE_H * PX / 2 - (NATIVE_H - GROUND_ROW) * PX + 0.0)
cam.location.z = (NATIVE_H - GROUND_ROW) * -PX + NATIVE_H * PX / 2  # = 0.8 - 0.1 = 0.7
cam.rotation_euler = (math.radians(90), 0, 0)
scene.camera = cam

r = scene.render
r.resolution_x, r.resolution_y = NATIVE_W * SCALE, NATIVE_H * SCALE
r.resolution_percentage = 100
r.film_transparent = True
r.image_settings.file_format = "PNG"
r.image_settings.color_mode = "RGBA"
r.image_settings.color_depth = "8"
r.filter_size = 0.0
scene.eevee.taa_render_samples = 1
scene.view_settings.view_transform = "Raw"
scene.view_settings.look = "None"
scene.display_settings.display_device = "sRGB"

# ---------------------------------------------------------------- pose helpers
pbones = arm.pose.bones
for pb in pbones:
    pb.rotation_mode = "QUATERNION"
Y = Vector((0, 1, 0))

def rot(name, deg):
    """Rotate about world +Y (screen-normal). +deg tips +Z toward +X (forward lean / leg swings BACK)."""
    pb = pbones[name]
    b = arm_data.bones[name]
    axis = b.matrix_local.to_3x3().inverted() @ Y
    pb.rotation_quaternion = Quaternion(axis, math.radians(deg))

def move(name, dx, dz):
    pb = pbones[name]
    b = arm_data.bones[name]
    pb.location = b.matrix_local.to_3x3().inverted() @ Vector((dx, 0, dz))

def reset_pose():
    for pb in pbones:
        pb.rotation_quaternion = Quaternion((1, 0, 0, 0))
        pb.location = (0, 0, 0)

def key_all(frame):
    for pb in pbones:
        pb.keyframe_insert("rotation_quaternion", frame=frame)
        pb.keyframe_insert("location", frame=frame)

def pose_idle(i, n=4):
    reset_pose()
    ph = [0.0, 0.5, 1.0, 0.5][i]  # breathe: rise, hold, settle
    move("hips", 0, -0.012 * ph)
    rot("spine", -2 + ph * 2)
    rot("head", 1 - ph * 2)
    rot("uarm.N", -6 + ph * 4); rot("farm.N", -14)
    rot("uarm.F", 6 - ph * 4); rot("farm.F", -10)
    rot("thigh.N", 0); rot("thigh.F", 0)
    rot("cape1", -3 + ph * 5); rot("cape2", -2 + ph * 6)

RUN_N = 6
def pose_run(i, n=RUN_N):
    reset_pose()
    p = 2 * math.pi * i / n
    bob = abs(math.sin(p))  # two bounces per stride
    move("hips", 0.0, -0.05 + 0.05 * bob)
    rot("spine", 14)  # forward lean
    rot("head", -8)
    for side, off in (("N", 0.0), ("F", math.pi)):
        s = math.sin(p + off)
        c = math.cos(p + off)
        rot(f"thigh.{side}", -48 * s)            # +s = forward (neg angle)
        # knee folds when the leg is on the recovery (swinging forward) half
        rot(f"shin.{side}", 14 + 75 * max(0.0, c))
        rot(f"foot.{side}", -0.6 * (-48 * s) - 10 * max(0.0, c) + 12)
        rot(f"uarm.{side}", 50 * s)
        rot(f"farm.{side}", -70 + 15 * s)
    rot("cape1", -28 + 6 * math.sin(p * 2)); rot("cape2", -18 + 8 * math.sin(p * 2 - 1.0))

ANIM_DEF = {"idle": (4, pose_idle), "run": (RUN_N, pose_run)}

# ---------------------------------------------------------------- render
def render_to(path):
    r.filepath = str(path)
    bpy.ops.render.render(write_still=True)

def set_visible(layer):
    for o in PARTS:
        o.hide_render = not (layer == "all" or o["rl"] == layer)

def set_mat(kind):
    for o in PARTS:
        o.data.materials[0] = NRM_MAT if kind == "nrm" else DATA_MATS[o["slot"]]

arm.animation_data_create()
arm.animation_data.action = bpy.data.actions.new("spike")
bpy.context.preferences.edit.keyframe_new_interpolation_type = "CONSTANT"  # stepped: hand-drawn feel, no in-betweens
START = {"idle": 0, "run": 10}
for anim in ANIMS:  # pass 1: key every pose (this is the actual animation data saved in the .blend)
    frames, fn = ANIM_DEF[anim]
    for i in range(frames):
        fn(i, frames)
        key_all(START[anim] + i)
timing = {}
n_renders = 0
t_total = time.time()
for anim in ANIMS:  # pass 2: evaluate the animation at each frame and render every layer
    frames, _ = ANIM_DEF[anim]
    for i in range(frames):
        scene.frame_set(START[anim] + i)
        bpy.context.view_layer.update()
        t0 = time.time()
        for layer in ["all"] + LAYERS:
            set_visible(layer)
            for kind in ("data", "nrm"):
                set_mat(kind)
                render_to(OUT / f"{anim}_{i:02d}_{layer}_{kind}.png")
                n_renders += 1
        timing[f"{anim}_{i}"] = time.time() - t0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "character_spike.blend"))
print(f"RENDER_DONE renders={n_renders} total_s={time.time()-t_total:.2f} "
      f"avg_frame_all_layers_s={sum(timing.values())/len(timing):.3f}")
