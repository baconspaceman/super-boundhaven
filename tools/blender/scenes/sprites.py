"""Pre-rendered 2D sprite props (chunky, SMW-tuned: 2-4 flat tones per material, dark outlines added in post).

  blender --background --factory-startup --python sprites.py -- --out <dir> [--scale 4] [--only tree_round,...]

Writes <out>/spr_<name>_<frame>.png (RGBA, SCALE x canvas). Canvas/anchors/palettes live in ../sprite_defs.py.
"""
import argparse
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402
import golden_hour as G  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import sprite_defs as D  # noqa: E402

KEY = (-0.5, -0.55, 0.65)


class Sp:
    def __init__(self, name, gx, gz):
        self.name, self.gx, self.gz = name, gx, gz
        self.meshes = {}
        self.mats = {}

    def mat(self, role):
        if role not in self.mats:
            r = D.ROLES[role]
            n = len(r["ramp"])
            self.mats[role] = C.toon("m_" + role, r["ramp"], G.tri_thr(n, a=-0.05, b=0.5), KEY, fw=0.12)
        return self.mats[role]

    def mesh(self, role, smooth=False):
        k = (role, smooth)
        if k not in self.meshes:
            self.meshes[k] = C.Mesh()
        return self.meshes[k]

    def solid_mesh(self, role, idx):
        k = ("solid", role, idx)
        if k not in self.meshes:
            self.meshes[k] = C.Mesh()
        return self.meshes[k]

    def finish(self):
        for k, m in self.meshes.items():
            if not m.v:
                continue
            if k[0] == "solid":
                mat = C.solid("s", D.ROLES[k[1]]["ramp"][k[2]])
                m.build("o", [mat])
            else:
                m.build("o", [self.mat(k[0])], smooth=k[1])


# ---------------------------------------------------------------- builders
def b_tree_round(sp, f, n):
    x, z = sp.gx, sp.gz
    t = sp.mesh("trunk")
    v, fc = C.prim_cone(8, 0.6, 26, 4.2)
    t.add(C.xform(v, (x, 0, z)), fc)
    l = sp.mesh("leaf", True)
    for (dx, dz, r) in [(0, 34, 15), (-11, 27, 11), (11, 28, 11), (-5, 44, 10), (6, 43, 9)]:
        G.ball(l, x + dx, 0, z + dz, r, r * 0.85, r * 0.9, seg=16, rings=10)


def b_tree_pine(sp, f, n):
    x, z = sp.gx, sp.gz
    t = sp.mesh("trunk")
    G.box(t, x, 0, z + 4, 4, 4, 9)
    l = sp.mesh("leaf", True)
    for k, (r, h) in enumerate([(15, 18), (12, 17), (9, 15), (6, 13)]):
        G.cone(l, x, 0, z + 6 + k * 11, r, h, 9, sy=0.85)


def b_tree_palm(sp, f, n):
    x, z = sp.gx, sp.gz
    t = sp.mesh("trunk", True)
    px, pz = x, z
    for k in range(7):
        nx, nz = px + 0.8 + k * 0.22, pz + 6.5
        G.ball(t, (px + nx) / 2, 0, (pz + nz) / 2, 3.0 - k * 0.12, 3.0 - k * 0.12, 4.6, seg=8, rings=5)
        px, pz = nx, nz
    l = sp.mesh("leaf", True)
    for k in range(7):
        ang = math.radians(-15 + k * 210 / 6)
        L = 19
        ex, ez = math.cos(ang) * L, math.sin(ang) * L * 0.55 - abs(math.cos(ang)) * 6
        v, fc = C.prim_sphere(10, 6)
        rot = math.atan2(ez, ex)
        l.add(C.xform(v, (px + ex / 2, (k % 3 - 1) * 1.2, pz + ez / 2 + 2), (L / 2 + 1, 2.4, 3.2), (0, -rot, 0)), fc)
    G.ball(sp.mesh("yellow", True) if False else sp.mesh("trunk", True), px, 0, pz - 1, 3.2, 3.2, 3.2, seg=8, rings=5)


def b_bush(sp, f, n):
    x, z = sp.gx, sp.gz
    l = sp.mesh("leaf", True)
    for (dx, dz, r) in [(-10, 6, 9), (9, 6, 9), (0, 10, 11), (-3, 15, 7)]:
        G.ball(l, x + dx, 0, z + dz, r, r * 0.8, r * 0.85, clampz=z, seg=14, rings=9)
    for (dx, dz, c) in [(-8, 8, "petal_pink"), (6, 14, "petal_pink"), (10, 6, "yellow"), (-1, 17, "yellow"), (0, 6, "petal_pink")]:
        G.ball(sp.mesh(c, True), x + dx, -8, z + dz, 1.9, 1.3, 1.9, seg=8, rings=5)


def b_flower_daisy(sp, f, n):
    x, z = sp.gx, sp.gz
    G.box(sp.mesh("leaf"), x, 0, z + 9, 1.8, 1.8, 18)
    G.ball(sp.mesh("leaf", True), x - 4, 0, z + 5, 4.2, 1.2, 1.8, seg=8, rings=5)
    G.ball(sp.mesh("leaf", True), x + 4, 0, z + 7, 4.2, 1.2, 1.8, seg=8, rings=5)
    hz = z + 21
    for k in range(8):
        a = k * math.pi / 4
        G.ball(sp.mesh("petal_white", True), x + 5.2 * math.cos(a), -1, hz + 5.2 * math.sin(a), 2.6, 1.2, 2.6, seg=8, rings=5)
    G.ball(sp.mesh("yellow", True), x, -3, hz, 3.0, 1.8, 3.0, seg=10, rings=6)


def b_flower_tulip(sp, f, n):
    x, z = sp.gx, sp.gz
    G.box(sp.mesh("leaf"), x, 0, z + 9, 1.8, 1.8, 18)
    G.ball(sp.mesh("leaf", True), x - 4.5, 0, z + 6, 4.6, 1.2, 1.8, seg=8, rings=5)
    G.ball(sp.mesh("leaf", True), x + 4.5, 0, z + 9, 4.6, 1.2, 1.8, seg=8, rings=5)
    G.ball(sp.mesh("petal_red", True), x, 0, z + 21, 5.2, 4.2, 6.2, seg=12, rings=8)
    for dx in (-3.5, 0, 3.5):
        G.cone(sp.mesh("petal_red", True), x + dx, 0, z + 24.5, 2.2, 5, 5)


def b_rock(sp, f, n):
    x, z = sp.gx, sp.gz
    r = sp.mesh("stone")
    for (dx, dz, sx, sz, rot) in [(0, 6, 11, 8, 0.2), (-9, 4, 6, 5, -0.3), (8, 3, 5, 4, 0.5)]:
        v, fc = C.prim_sphere(7, 4)
        r.add(C.xform(v, (x + dx, 0, z + dz), (sx, sx * 0.8, sz), (0, 0, rot)), fc)


def b_crystal(sp, f, n):
    x, z = sp.gx, sp.gz
    c = sp.mesh("crystal")
    for (dx, h, r, tilt) in [(0, 30, 6, 0.0), (-9, 20, 4.6, -0.28), (9, 16, 4.2, 0.3)]:
        v, fc = C.prim_cone(6, 0.75, h * 0.72, r)
        c.add(C.xform(v, (x + dx, 0, z), (1, 1, 1), (0, tilt, 0)), fc)
        v, fc = C.prim_cone(6, 0.0, h * 0.28, r * 0.75)
        c.add(C.xform(v, (x + dx + tilt * h * 0.7, 0, z + h * 0.72 * math.cos(tilt)), (1, 1, 1), (0, tilt, 0)), fc)
    s = sp.mesh("stone")
    v, fc = C.prim_sphere(7, 4)
    s.add(C.xform(v, (x, 0, z + 1), (15, 8, 4)), fc)


def b_windmill(sp, f, n):
    x, z = sp.gx, sp.gz
    wall = sp.mesh("wall", True)
    v, fc = C.prim_cone(12, 0.6, 46, 13)
    wall.add(C.xform(v, (x, 0, z)), fc)
    roof = sp.mesh("roof", True)
    v, fc = C.prim_cone(12, 0.0, 16, 11)
    roof.add(C.xform(v, (x, 0, z + 44)), fc)
    G.box(sp.mesh("trunk"), x, -9, z + 10, 7, 2, 12)  # door
    hub = (x, -13.0, z + 42)
    G.ball(sp.mesh("trunk", True), hub[0], hub[1], hub[2], 3.4, 3.0, 3.4, seg=8, rings=5)
    base = math.radians(f * 90.0 / n + 8)
    for k in range(4):
        a = base + k * math.pi / 2
        L = 30.0
        px, pz = -math.sin(a), math.cos(a)
        ex, ez = hub[0] + L * math.cos(a), hub[2] + L * math.sin(a)
        sp.mesh("trunk").add([(hub[0] - px, hub[1], hub[2] - pz), (ex - px, hub[1], ez - pz), (ex + px, hub[1], ez + pz), (hub[0] + px, hub[1], hub[2] + pz)], [(0, 1, 2, 3)])
        s0 = (hub[0] + 8 * math.cos(a), hub[2] + 8 * math.sin(a))
        s1 = (hub[0] + 29 * math.cos(a), hub[2] + 29 * math.sin(a))
        sp.mesh("sail").add([(s0[0] + px, hub[1] - 0.6, s0[1] + pz), (s1[0] + px, hub[1] - 0.6, s1[1] + pz), (s1[0] + px * 8, hub[1] - 0.6, s1[1] + pz * 8), (s0[0] + px * 8, hub[1] - 0.6, s0[1] + pz * 8)], [(0, 1, 2, 3)])


def b_torch(sp, f, n):
    x, z = sp.gx, sp.gz
    v, fc = C.prim_cone(8, 0.7, 22, 2.6)
    sp.mesh("trunk").add(C.xform(v, (x, 0, z)), fc)
    v, fc = C.prim_cone(10, 1.5, 6, 3.2)
    sp.mesh("iron").add(C.xform(v, (x, 0, z + 20)), fc)
    sway = [0.0, 1.0, -0.6, 0.7][f % 4]
    hts = [1.0, 1.25, 0.9, 1.15][f % 4]
    for k, (r, h, idx) in enumerate([(6.4, 17, 0), (4.4, 13, 1), (2.4, 8, 2)]):
        m = sp.solid_mesh("flame", idx)
        v, fc = C.prim_cone(10, 0.0, h * hts, r)
        vv = C.xform(v, (x + sway * (k + 1) * 0.35, 0, z + 24 + k * 0.3))
        m.add(vv, fc)


def b_lantern(sp, f, n):
    x, z = sp.gx, sp.gz
    G.box(sp.mesh("iron"), x, 0, z + 14, 2.6, 2.6, 28)
    G.box(sp.mesh("iron"), x + 5, 0, z + 27, 12, 2.2, 2.2)
    G.cone(sp.mesh("iron"), x + 9, 0, z + 29, 4.6, 4, 6)
    G.box(sp.mesh("iron"), x + 9, 0, z + 18.5, 7.6, 7.6, 1.8)
    g = sp.solid_mesh("yellow", 1 if f % 2 == 0 else 0)
    G.box(g, x + 9, 0, z + 23.5, 6, 6, 8)
    core = sp.solid_mesh("flame", 2)
    s = [2.6, 3.4, 2.2, 3.0][f % 4]
    G.ball(core, x + 9, -3.5, z + 23.5, s, 1.4, s * 1.2, seg=8, rings=5)


def b_waterfall(sp, f, n):
    x, z = sp.gx, sp.gz
    st = sp.mesh("stone")
    G.box(st, x - 15, 0, z + 34, 10, 14, 68)
    G.box(st, x + 15, 0, z + 34, 10, 14, 68)
    G.box(st, x, 6, z + 34, 24, 4, 68)
    # water sheet: stripes scroll down; period P divides the loop exactly
    P_ = 16.0
    shift = (f / n) * P_
    wm = [sp.solid_mesh("water", i) for i in range(4)]
    wm[0].add([(x - 11, -4, z), (x + 11, -4, z), (x + 11, -4, z + 66), (x - 11, -4, z + 66)], [(0, 1, 2, 3)])
    zz = -P_ + shift
    k = 0
    while zz < 66:
        z0, z1 = max(0.0, zz), min(66.0, zz + 6.0)
        if z1 > z0:
            xo = -3 if (k % 2) else 2
            wm[1].add([(x - 11 + 1, -5, z + z0), (x + 11 - 4 + xo * 0.0, -5, z + z0), (x + 11 - 4, -5, z + z1), (x - 11 + 1, -5, z + z1)], [(0, 1, 2, 3)])
        z2, z3 = max(0.0, zz + 8.0), min(66.0, zz + 10.0)
        if z3 > z2:
            wm[2].add([(x - 6, -6, z + z2), (x + 4, -6, z + z2), (x + 4, -6, z + z3), (x - 6, -6, z + z3)], [(0, 1, 2, 3)])
        zz += P_
        k += 1
    for (dx, dz, r) in [(-9, 2, 5), (-2, 3, 6.5), (7, 2, 5.5), (12, 1, 4)]:
        G.ball(wm[3], x + dx, -7, z + dz + 1, r, 2.0, r * 0.8, seg=10, rings=6, clampz=z)


def b_spring(sp, f, n):
    x, z = sp.gx, sp.gz
    c = [1.0, 0.72, 0.45, 1.22, 0.96][f % 5]
    H = 20.0 * c
    G.box(sp.mesh("coral"), x, 0, z + 2, 26, 12, 4)
    coils = 5
    for k in range(coils):
        zz = z + 4 + (k + 0.5) * H / coils
        wide = 1.0 + (1.0 - c) * 0.35
        G.ball(sp.mesh("coil", True), x, 0, zz, 9.5 * wide, 6.0 * wide, H / coils * 0.62, seg=14, rings=6)
    top = z + 4 + H
    G.box(sp.mesh("coral"), x, 0, top + 2, 28, 13, 4)
    G.ball(sp.solid_mesh("yellow", 1), x, -7, top + 4.6, 4.6, 2.0, 2.6, seg=10, rings=6)


def b_sun(sp, f, n):
    x, z = sp.gx, sp.gz
    m = sp.solid_mesh("sun", 0)
    m.add([(x + 26 * math.cos(2 * math.pi * i / 48), 0, z + 26 * math.sin(2 * math.pi * i / 48)) for i in range(48)], [tuple(range(48))])
    m = sp.solid_mesh("sun", 1)
    m.add([(x + 21 * math.cos(2 * math.pi * i / 48), -1, z + 21 * math.sin(2 * math.pi * i / 48)) for i in range(48)], [tuple(range(48))])
    m = sp.solid_mesh("sun", 2)
    m.add([(x + 14 * math.cos(2 * math.pi * i / 48), -2, z + 14 * math.sin(2 * math.pi * i / 48) + 3) for i in range(48)], [tuple(range(48))])


def b_moon(sp, f, n):
    x, z = sp.gx, sp.gz
    for (r, y, i) in [(22, 0, 0), (19, -1, 1)]:
        sp.solid_mesh("moon", i).add([(x + r * math.cos(2 * math.pi * k / 48), y, z + r * math.sin(2 * math.pi * k / 48)) for k in range(48)], [tuple(range(48))])
    for (dx, dz, r) in [(-7, 6, 4.5), (6, -5, 3.4), (8, 8, 2.4)]:
        sp.solid_mesh("moon", 0).add([(x + dx + r * math.cos(2 * math.pi * k / 20), -2, z + dz + r * math.sin(2 * math.pi * k / 20)) for k in range(20)], [tuple(range(20))])


def _cloud(sp, widths, seed):
    rs = C.rng(seed)
    G.puff_cloud(sp.mesh("cloud", True), sp.gx, sp.gz, widths, rs, 0.9)


def b_cloud_a(sp, f, n):
    _cloud(sp, 60, 3)


def b_cloud_b(sp, f, n):
    _cloud(sp, 40, 8)


def b_cloud_c(sp, f, n):
    _cloud(sp, 82, 13)


def b_butterfly(sp, f, n):
    x, z = sp.gx, sp.gz
    span = [1.0, 0.66, 0.25, 0.66][f % 4]
    for sgn in (-1, 1):
        sp.solid_mesh("wing", 0).add([(x, -1, z + 1), (x + sgn * 7 * span, -1, z + 6.5), (x + sgn * 7.6 * span, -1, z + 1), (x, -1, z - 0.5)], [(0, 1, 2, 3)])
        sp.solid_mesh("wing", 1).add([(x, -1, z - 0.5), (x + sgn * 6 * span, -1, z - 0.5), (x + sgn * 4.5 * span, -1, z - 5), (x, -1, z - 2)], [(0, 1, 2, 3)])
    sp.solid_mesh("yellow", 1).add([(x - 0.6, -2, z - 4), (x + 0.6, -2, z - 4), (x + 0.6, -2, z + 4), (x - 0.6, -2, z + 4)], [(0, 1, 2, 3)])


def b_bird_flock(sp, f, n):
    x, z = sp.gx, sp.gz
    up = [1.0, 0.3, -0.7, 0.3][f % 4]
    for (dx, dz, s) in [(-14, 4, 1.0), (4, -2, 0.85), (16, 6, 0.7)]:
        for sgn in (-1, 1):
            tip = (x + dx + sgn * 7 * s, z + dz + 5 * up * s)
            sp.solid_mesh("bird", 0).add([(x + dx, -1, z + dz + 1), (tip[0], -1, tip[1] + 1.4), (tip[0], -1, tip[1] - 0.4), (x + dx, -1, z + dz - 1)], [(0, 1, 2, 3)])
        sp.solid_mesh("bird", 1).add([(x + dx - 1.4, -2, z + dz - 1), (x + dx + 1.4, -2, z + dz - 1), (x + dx + 1, -2, z + dz + 1.6), (x + dx - 1, -2, z + dz + 1.6)], [(0, 1, 2, 3)])


BUILDERS = {k[2:]: v for k, v in globals().items() if k.startswith("b_")}


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--scale", type=int, default=4)
    ap.add_argument("--only", default="")
    a = ap.parse_args(argv)
    os.makedirs(a.out, exist_ok=True)
    only = [s for s in a.only.split(",") if s]
    for name, sd in D.SPRITES.items():
        if only and name not in only:
            continue
        t0 = time.time()
        w, h = sd["size"]
        for f in range(sd["frames"]):
            C.reset()
            C.setup_render(w, h, a.scale)
            sp = Sp(name, *sd["ground"])
            BUILDERS[name](sp, f, sd["frames"])
            sp.finish()
            C.render_to(os.path.join(a.out, "spr_%s_%d.png" % (name, f)))
        print("SPRITE", name, sd["frames"], "%.1fs" % (time.time() - t0), flush=True)


if __name__ == "__main__":
    main()
