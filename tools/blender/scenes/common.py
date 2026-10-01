"""Shared Blender (bpy 5.x) helpers: flat/toon materials, primitives, periodic noise, render setup.

World units == native pixels. Camera is orthographic, looks along +Y; X right, Z up.
Everything is emission-only (toon bands through Shader->RGB-free math on the surface normal), so the
render contains *exactly* the palette colors (view transform 'Standard') and the pixelizer only has to snap.
"""
import math
import os
import random
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import palettes as P  # noqa: E402


# ------------------------------------------------------------------ color
def _s2l(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lin(hexstr, a=1.0):
    r, g, b = P.hex_rgb(hexstr)
    return (_s2l(r), _s2l(g), _s2l(b), a)


# ------------------------------------------------------------------ scene setup
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    w = bpy.data.worlds.new("w")
    bpy.context.scene.world = w


def setup_render(w_px, h_px, scale, samples=16):
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x = int(w_px * scale)
    sc.render.resolution_y = int(h_px * scale)
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.color_depth = "8"
    sc.render.dither_intensity = 0.0
    sc.render.filter_size = 0.6
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.view_settings.exposure = 0.0
    sc.view_settings.gamma = 1.0
    sc.display_settings.display_device = "sRGB"
    try:
        sc.eevee.taa_render_samples = samples
    except Exception:
        pass
    cam = bpy.data.cameras.new("cam")
    cam.type = "ORTHO"
    cam.ortho_scale = float(max(w_px, h_px))
    cam.clip_start = 1.0
    cam.clip_end = 20000.0
    co = bpy.data.objects.new("cam", cam)
    sc.collection.objects.link(co)
    co.location = (w_px / 2.0, -5000.0, h_px / 2.0)
    co.rotation_euler = (math.pi / 2, 0, 0)
    sc.camera = co
    return sc


def clear_scene_objects():
    for o in list(bpy.data.objects):
        if o.type != "CAMERA":
            bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)


def render_to(path):
    sc = bpy.context.scene
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


# ------------------------------------------------------------------ materials
def _new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    return m, nt, out


def solid(name, hexstr):
    m, nt, out = _new_mat(name)
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[0].default_value = lin(hexstr)
    nt.links.new(em.outputs[0], out.inputs[0])
    return m


def _vmath(nt, op, a=None, b=None, av=None, bv=None):
    n = nt.nodes.new("ShaderNodeVectorMath")
    n.operation = op
    if a is not None:
        nt.links.new(a, n.inputs[0])
    elif av is not None:
        n.inputs[0].default_value = av
    if b is not None:
        nt.links.new(b, n.inputs[1])
    elif bv is not None:
        n.inputs[1].default_value = bv
    return n


def _math(nt, op, a=None, b=None, av=None, bv=None, clamp=False):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    n.use_clamp = clamp
    if a is not None:
        nt.links.new(a, n.inputs[0])
    elif av is not None:
        n.inputs[0].default_value = av
    if b is not None:
        nt.links.new(b, n.inputs[1])
    elif bv is not None:
        n.inputs[1].default_value = bv
    return n


def _ramp(nt, colors, pos, interp="CONSTANT"):
    cr = nt.nodes.new("ShaderNodeValToRGB")
    cr.color_ramp.interpolation = interp
    el = cr.color_ramp.elements
    while len(el) < len(colors):
        el.new(0.5)
    for i, (c, p) in enumerate(zip(colors, pos)):
        el[i].position = p
        el[i].color = c
    return cr


def _norm(v):
    v = Vector(v)
    return tuple(v.normalized())


def toon(name, colors, thr, key, fill=(0, 0, 1), kw=1.0, fw=0.0, rim=None, z_lift=None):
    """Banded flat shading. colors: hex dark->light; thr: t-thresholds (t in [-1,1]) where each color starts
    (first should be -1). t = kw*dot(N,key) + fw*dot(N,fill) (world-space normal).
    rim=(hex, width, lit_thr): silhouette-facing normals on the lit side get the rim color.
    z_lift=(z0, z1, amount): adds amount*smoothstep(z0..z1) to t by world height (brighter tops)."""
    m, nt, out = _new_mat(name)
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    n = geo.outputs["Normal"]
    d1 = _vmath(nt, "DOT_PRODUCT", n, None, bv=_norm(key))
    t = _math(nt, "MULTIPLY", d1.outputs["Value"], None, bv=kw)
    if fw:
        d2 = _vmath(nt, "DOT_PRODUCT", n, None, bv=_norm(fill))
        t2 = _math(nt, "MULTIPLY", d2.outputs["Value"], None, bv=fw)
        t = _math(nt, "ADD", t.outputs[0], t2.outputs[0])
    if z_lift:
        z0, z1, amt = z_lift
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(geo.outputs["Position"], sep.inputs[0])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs[1].default_value = z0
        mr.inputs[2].default_value = z1
        mr.inputs[3].default_value = 0.0
        mr.inputs[4].default_value = amt
        nt.links.new(sep.outputs["Z"], mr.inputs[0])
        t = _math(nt, "ADD", t.outputs[0], mr.outputs[0])
    mp = nt.nodes.new("ShaderNodeMapRange")
    mp.inputs[1].default_value = -1.0
    mp.inputs[2].default_value = 1.0
    nt.links.new(t.outputs[0], mp.inputs[0])
    cr = _ramp(nt, [lin(c) for c in colors], [(x + 1.0) / 2.0 for x in thr])
    cr.color_ramp.elements[0].position = 0.0
    nt.links.new(mp.outputs[0], cr.inputs[0])
    col = cr.outputs["Color"]
    if rim:
        rhex, rw, rlit = rim
        vd = _vmath(nt, "DOT_PRODUCT", n, None, bv=(0.0, -1.0, 0.0))
        ab = _math(nt, "ABSOLUTE", vd.outputs["Value"])
        edge = _math(nt, "LESS_THAN", ab.outputs[0], None, bv=rw)
        ndl = _vmath(nt, "DOT_PRODUCT", n, None, bv=_norm(key))
        lit = _math(nt, "GREATER_THAN", ndl.outputs["Value"], None, bv=rlit)
        msk = _math(nt, "MULTIPLY", edge.outputs[0], lit.outputs[0])
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        nt.links.new(msk.outputs[0], mix.inputs[0])
        nt.links.new(col, mix.inputs[6])
        mix.inputs[7].default_value = lin(rhex)
        col = mix.outputs[2]
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(col, em.inputs[0])
    nt.links.new(em.outputs[0], out.inputs[0])
    return m


def height_bands(name, colors, z0s):
    """Flat color by world height: colors[i] applies above z0s[i] (ascending)."""
    m, nt, out = _new_mat(name)
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Position"], sep.inputs[0])
    lo, hi = z0s[0], z0s[-1] + 1.0
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs[1].default_value = lo
    mr.inputs[2].default_value = hi
    nt.links.new(sep.outputs["Z"], mr.inputs[0])
    cr = _ramp(nt, [lin(c) for c in colors], [(z - lo) / (hi - lo) for z in z0s])
    cr.color_ramp.elements[0].position = 0.0
    nt.links.new(mr.outputs[0], cr.inputs[0])
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(cr.outputs["Color"], em.inputs[0])
    nt.links.new(em.outputs[0], out.inputs[0])
    return m


def sky_gradient(name, colors, stops, z_top, z_bot, glow=None, x_scale=1.0):
    """Smooth vertical ramp (stops measured 0=top..1=bottom/horizon); glow=(x,z,sigma,k) pushes bands toward the horizon color near the sun."""
    m, nt, out = _new_mat(name)
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Position"], sep.inputs[0])
    # s = (z_top - z)/(z_top - z_bot)
    a = _math(nt, "SUBTRACT", None, sep.outputs["Z"], av=z_top)
    s = _math(nt, "DIVIDE", a.outputs[0], None, bv=(z_top - z_bot))
    cur = s.outputs[0]
    if glow:
        gx, gz, sg, k = glow
        dx = _math(nt, "SUBTRACT", sep.outputs["X"], None, bv=gx)
        dz = _math(nt, "SUBTRACT", sep.outputs["Z"], None, bv=gz)
        dx2 = _math(nt, "MULTIPLY", dx.outputs[0], dx.outputs[0])
        dz2 = _math(nt, "MULTIPLY", dz.outputs[0], dz.outputs[0])
        sm = _math(nt, "ADD", dx2.outputs[0], dz2.outputs[0])
        ng = _math(nt, "DIVIDE", sm.outputs[0], None, bv=-(sg * sg))
        ex = _math(nt, "EXPONENT", ng.outputs[0])
        kk = _math(nt, "MULTIPLY", ex.outputs[0], None, bv=k)
        ad = _math(nt, "ADD", cur, kk.outputs[0])
        cur = ad.outputs[0]
    cr = _ramp(nt, [lin(c) for c in colors], stops, interp="LINEAR")
    nt.links.new(cur, cr.inputs[0])
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(cr.outputs["Color"], em.inputs[0])
    nt.links.new(em.outputs[0], out.inputs[0])
    return m


def radial_alpha(name, cx, cz, stops):
    """Translucent radial material around world (cx, cz). stops: list of (radius, hex, alpha) bands; each band
    holds from its radius outward until the next one (constant interpolation)."""
    m, nt, out = _new_mat(name)
    m.surface_render_method = "BLENDED"
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sub = _vmath(nt, "SUBTRACT", geo.outputs["Position"], None, bv=(cx, 0.0, cz))
    sub.inputs[1].default_value = (cx, 0.0, cz)
    # flatten Y out of the distance
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(sub.outputs[0], sep.inputs[0])
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(sep.outputs["X"], comb.inputs[0])
    nt.links.new(sep.outputs["Z"], comb.inputs[2])
    ln = _vmath(nt, "LENGTH", comb.outputs[0])
    rmax = stops[-1][0] + 1.0
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs[1].default_value = 0.0
    mr.inputs[2].default_value = rmax
    nt.links.new(ln.outputs["Value"], mr.inputs[0])
    colors = [lin(h, a) for (r, h, a) in stops]
    pos = [r / rmax for (r, h, a) in stops]
    cr = _ramp(nt, colors, pos)
    cr.color_ramp.elements[0].position = 0.0
    nt.links.new(mr.outputs[0], cr.inputs[0])
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(cr.outputs["Color"], em.inputs[0])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    inv = _math(nt, "SUBTRACT", None, cr.outputs["Alpha"], av=1.0)
    mx = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(inv.outputs[0], mx.inputs[0])
    nt.links.new(em.outputs[0], mx.inputs[1])
    nt.links.new(tr.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs[0])
    return m


# ------------------------------------------------------------------ meshes
def make_obj(name, verts, faces, mats, face_mats=None, smooth=False, loc=(0, 0, 0), rot=None, scale=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.update()
    for mm in mats:
        me.materials.append(mm)
    if face_mats is not None:
        for p, mi in zip(me.polygons, face_mats):
            p.material_index = mi
    if smooth:
        me.shade_smooth()
    else:
        me.shade_flat()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    if rot:
        ob.rotation_euler = rot
    if scale:
        ob.scale = scale
    return ob


def prim_sphere(seg=16, rings=8):
    v = [(0, 0, 1)]
    for r in range(1, rings):
        th = math.pi * r / rings
        for s in range(seg):
            ph = 2 * math.pi * s / seg
            v.append((math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph), math.cos(th)))
    v.append((0, 0, -1))
    f = []
    for s in range(seg):
        f.append((0, 1 + s, 1 + (s + 1) % seg))
    for r in range(rings - 2):
        for s in range(seg):
            a = 1 + r * seg + s
            b = 1 + r * seg + (s + 1) % seg
            f.append((a, a + seg, b + seg, b))
    last = len(v) - 1
    base = 1 + (rings - 2) * seg
    for s in range(seg):
        f.append((last, base + (s + 1) % seg, base + s))
    return v, f


def prim_cone(seg=10, top=0.0, h=1.0, r=1.0):
    v = []
    for s in range(seg):
        ph = 2 * math.pi * s / seg
        v.append((r * math.cos(ph), r * math.sin(ph), 0.0))
    if top <= 0:
        v.append((0, 0, h))
        f = [(s, (s + 1) % seg, seg) for s in range(seg)]
    else:
        for s in range(seg):
            ph = 2 * math.pi * s / seg
            v.append((top * r * math.cos(ph), top * r * math.sin(ph), h))
        f = [(s, (s + 1) % seg, seg + (s + 1) % seg, seg + s) for s in range(seg)]
        f.append(tuple(reversed(range(seg, 2 * seg))))
    f.append(tuple(reversed(range(seg))))
    return v, f


def xform(v, loc=(0, 0, 0), scl=(1, 1, 1), rot=(0, 0, 0)):
    m = Matrix.Translation(loc) @ Matrix.Rotation(rot[2], 4, "Z") @ Matrix.Rotation(rot[1], 4, "Y") @ Matrix.Rotation(rot[0], 4, "X")
    s = Matrix.Diagonal((scl[0], scl[1], scl[2], 1.0))
    mm = m @ s
    return [tuple(mm @ Vector(p)) for p in v]


class Mesh:
    """Accumulates primitives into one mesh so a whole layer can be few objects."""

    def __init__(self):
        self.v, self.f, self.m = [], [], []

    def add(self, verts, faces, mat_index=0):
        base = len(self.v)
        self.v += [tuple(p) for p in verts]
        self.f += [tuple(base + i for i in fc) for fc in faces]
        self.m += [mat_index] * len(faces)

    def build(self, name, mats, smooth=False):
        return make_obj(name, self.v, self.f, mats, face_mats=self.m, smooth=smooth)


# ------------------------------------------------------------------ periodic noise (period W in x)
def _hash(i, seed):
    x = (i * 374761393 + seed * 668265263) & 0xFFFFFFFF
    x = (x ^ (x >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((x ^ (x >> 16)) & 0xFFFF) / 65535.0


def pnoise(x, period, cells, seed):
    """1D periodic value noise, smoothstep-interpolated; `cells` lattice points over `period`."""
    u = (x / period) * cells
    i = math.floor(u)
    f = u - i
    a = _hash(i % cells, seed)
    b = _hash((i + 1) % cells, seed)
    f = f * f * (3 - 2 * f)
    return a + (b - a) * f


def fbm(x, period, seed, base_cells=4, octaves=3, gain=0.5):
    tot, amp, cells, norm = 0.0, 1.0, base_cells, 0.0
    for o in range(octaves):
        tot += amp * pnoise(x, period, cells, seed + o * 17)
        norm += amp
        amp *= gain
        cells *= 2
    return tot / norm


def wrap_dx(a, b, period):
    d = (a - b) % period
    return d - period if d > period / 2 else d


def rng(seed):
    return random.Random(seed)
