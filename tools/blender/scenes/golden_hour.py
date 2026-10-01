"""Golden Hour Meadows -- procedural layer renders.

  blender --background --factory-startup --python golden_hour.py -- --tod sunset --out <dir> [--scale 4] [--layers sky,sun,...]

Writes <out>/<tod>_<layer>.png (RGBA, SCALE x native size). 100% procedural, fixed seeds, no external assets.
"""
import argparse
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: E402,F401,F403
import common as C  # noqa: E402

P = C.P
W, H, SW = P.W, P.H, P.SW


# ------------------------------------------------------------------ helpers
def tri_thr(n, lo=-1.0, a=-0.25, b=0.55):
    """first threshold -1, rest evenly spread between a..b"""
    if n == 1:
        return [-1.0]
    return [lo] + [a + (b - a) * i / (n - 2) if n > 2 else a for i in range(n - 1)]


def copies(x, half, period=W):
    return [x + k * period for k in (-1, 0, 1) if -half < x + k * period < period + half]


def dome_fn(rs, n, hmin, hmax, wmin, wmax, base=0.0, sharp=1.0, pad=0.0):
    """periodic crest height from n random semicircular bumps (chunky SMW-style hills)."""
    bumps = []
    for i in range(n):
        cx = (i + 0.5 + (rs.random() - 0.5) * 0.5) * W / n
        bumps.append((cx, rs.uniform(hmin, hmax), rs.uniform(wmin, wmax)))

    def f(x):
        h = base
        for cx, a, w in bumps:
            dx = C.wrap_dx(x, cx, W)
            if abs(dx) < w:
                v = a * (max(0.0, 1.0 - (dx / w) ** 2)) ** (0.5 * sharp)
                h = max(h, base + v)
        return h

    f.bumps = bumps
    return f


def hill_mesh(name, hfun, mat, Y=40.0, step=4.0, ny=7, profile_pow=0.6, y0=0.0, z0=0.0, smooth=True, xr=(-16.0, W + 16.0)):
    """rounded mound: z = h(x) * p(y), p rises from the front (y0) to the crest at y0+Y/2."""
    xs = []
    x = xr[0]
    while x <= xr[1] + 1e-6:
        xs.append(x)
        x += step
    m = C.Mesh()
    verts = []
    for x in xs:
        h = hfun(x)
        for j in range(ny + 1):
            u = j / ny
            p = (min(1.0, u * 2.0)) ** profile_pow
            if u > 0.5:
                p = 1.0 - (u - 0.5) * 2.0 * 0.15
            verts.append((x, y0 + u * Y, z0 + h * p))
    faces = []
    for i in range(len(xs) - 1):
        for j in range(ny):
            a = i * (ny + 1) + j
            b = (i + 1) * (ny + 1) + j
            faces.append((a, b, b + 1, a + 1))
    m.add(verts, faces)
    return m.build(name, [mat], smooth=smooth)


def box(m, cx, cy, cz, sx, sy, sz, mat=0, rot_z=0.0):
    v = [(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1), (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6), (1, 2, 6, 5), (0, 4, 7, 3)]
    m.add(C.xform(v, (cx, cy, cz), (sx / 2, sy / 2, sz / 2), (0, 0, rot_z)), f, mat)


def cone(m, cx, cy, cz, r, h, seg=8, mat=0, top=0.0, sy=1.0):
    v, f = C.prim_cone(seg, top, h, r)
    m.add(C.xform(v, (cx, cy, cz), (1, sy, 1)), f, mat)


def ball(m, cx, cy, cz, rx, ry=None, rz=None, mat=0, seg=14, rings=8, clampz=None):
    v, f = C.prim_sphere(seg, rings)
    vv = C.xform(v, (cx, cy, cz), (rx, ry or rx, rz or rx))
    if clampz is not None:
        vv = [(a, b, max(c, clampz)) for (a, b, c) in vv]
    m.add(vv, f, mat)


def quad_xz(m, x0, z0, x1, z1, y=0.0, mat=0):
    m.add([(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], [(0, 1, 2, 3)], mat)


def poly_xz(m, pts, y=0.0, mat=0):
    v = [(x, y, z) for x, z in pts]
    m.add(v, [tuple(range(len(pts)))], mat)


# ------------------------------------------------------------------ SKY
def layer_sky(T, tod, seed=11):
    s = T["sky"]
    z_top, z_bot = 224.0, 38.0
    mat = C.sky_gradient("sky", s["ramp"], s["stops"], z_top, z_bot, glow=s["glow"])
    m = C.Mesh()
    quad_xz(m, -4, -4, SW + 4, H + 4, y=200.0)
    m.build("sky", [mat])


def layer_stars(T, tod, seed=11):
    if "stars" in T:
        rs = C.rng(seed)
        mats = [C.solid("st%d" % i, c) for i, c in enumerate(T["stars"])]
        sm = [C.Mesh() for _ in mats]
        for i in range(46):
            x = math.floor(rs.uniform(6, SW - 6)) + 0.5
            z = math.floor(rs.uniform(96, H - 4)) + 0.5
            k = 0 if rs.random() < 0.6 else (1 if rs.random() < 0.7 else 2)
            size = 1.0
            if i % 9 == 0:  # plus-shaped twinkle
                quad_xz(sm[0], x - 1.5, z - 0.5, x + 1.5, z + 0.5, y=150)
                quad_xz(sm[0], x - 0.5, z - 1.5, x + 0.5, z + 1.5, y=150)
            else:
                quad_xz(sm[k], x - 0.5, z - 0.5, x + 0.5, z + 0.5, y=150)
        for mm, mat_ in zip(sm, mats):
            if mm.v:
                mm.build("stars", [mat_])


# ------------------------------------------------------------------ SUN / MOON
def layer_sun(T, tod, part="solid"):
    s = T["sun"]
    cx, cz = s["pos"]
    r = s["r"]
    hr = s["halo_r"]
    # halo: concentric dithered bands (alpha picked up by the pixelizer's ordered dither)
    stops = [(0.0, s["halo"][0], 0.5), (hr[0], s["halo"][1], 0.25), (hr[1], s["halo"][1], 0.0)]
    if part == "glow":
        hm = C.radial_alpha("halo", cx, cz, stops)
        m = C.Mesh()
        quad_xz(m, cx - hr[1] - 2, cz - hr[1] - 2, cx + hr[1] + 2, cz + hr[1] + 2, y=60.0)
        m.build("halo", [hm])
    # rays (sunset): chunky wedges, dithered alpha fade
    n = s.get("n_rays", 0)
    if part == "solid" and n:
        rs = C.rng(5)
        rm = C.solid("rays", s["ray"])
        m = C.Mesh()
        for i in range(n):
            ang = math.radians(25 + i * (130.0 / max(1, n - 1)) + rs.uniform(-4, 4))
            wd = math.radians(rs.uniform(3.0, 5.0))
            L = r + rs.uniform(70, 120)
            p1 = (cx + L * math.cos(ang - wd), cz + L * math.sin(ang - wd))
            p2 = (cx + L * math.cos(ang + wd), cz + L * math.sin(ang + wd))
            m.add([(cx, 40.0, cz), (p1[0], 40.0, p1[1]), (p2[0], 40.0, p2[1])], [(0, 1, 2)])
        m.build("rays", [rm])
    if part == "glow":
        return
    # disc: ring, body, lower band
    ring = C.solid("ring", s["ring"])
    body = C.solid("disc", s["disc"][0])
    low = C.solid("disc2", s["disc"][1])

    def disc(rad, y, mat, z0=None, cut=None):
        pts = []
        seg = 72
        for i in range(seg):
            a = 2 * math.pi * i / seg
            pts.append((cx + rad * math.cos(a), cz + rad * math.sin(a)))
        mm = C.Mesh()
        mm.add([(x, y, z) for x, z in pts], [tuple(range(seg))])
        return mm

    disc(r + 5, 20.0, ring).build("ring", [ring])
    disc(r, 10.0, body).build("disc", [body])
    # lower shade cap (circular segment below chord)
    chord = cz - r * 0.35
    pts = []
    seg = 40
    a0 = math.asin(-0.35)
    # points on circle from angle (pi - a0') ... go along bottom
    th0 = math.pi + math.asin(0.35)  # left point
    th1 = 2 * math.pi - math.asin(0.35)  # right point
    cap = C.Mesh()
    arc = [(cx + r * math.cos(th0 + (th1 - th0) * i / seg), cz + r * math.sin(th0 + (th1 - th0) * i / seg)) for i in range(seg + 1)]
    cap.add([(x, 5.0, z) for x, z in arc], [tuple(range(len(arc)))])
    cap.build("cap", [low])
    if "crater" in s:  # moon craters
        cm = C.solid("crater", s["crater"])
        mm = C.Mesh()
        for (dx, dz, rr) in [(-5, 4, 3.2), (4, -4, 2.6), (5, 6, 1.8)]:
            ptsc = [(cx + dx + rr * math.cos(2 * math.pi * i / 18), cz + dz + rr * math.sin(2 * math.pi * i / 18)) for i in range(18)]
            mm.add([(x, 2.0, z) for x, z in ptsc], [tuple(range(18))])
        mm.build("craters", [cm])


# ------------------------------------------------------------------ CLOUDS
def puff_cloud(m, cx, base_z, width, rs, big=1.0, flat=0.55):
    """chunky cumulus: row of flat-bottomed domes, biggest in the middle"""
    n = max(3, int(width / 18))
    xs = [cx - width / 2 + width * (i + 0.5) / n for i in range(n)]
    for i, x in enumerate(xs):
        u = (i + 0.5) / n
        bump = math.sin(math.pi * u) ** 0.8
        r = (7 + 13 * bump) * big * rs.uniform(0.85, 1.15)
        ball(m, x, rs.uniform(-2, 2), base_z + r * 0.35, r * 1.05, r * 0.8, r * 0.9, clampz=base_z, seg=16, rings=9)
    # an extra top puff
    ball(m, cx + rs.uniform(-width * 0.15, width * 0.15), 0, base_z + 10 * big, 11 * big, 8 * big, 10 * big, clampz=base_z, seg=16, rings=9)


def cloud_material(T, name):
    c = T["clouds"]
    return C.toon(name, c["ramp"], c["thr"], c["key"], fill=c["fill"], kw=1.0, fw=0.0)


def layer_clouds_a(T, tod):
    """high, flat, wide stratus banks (slow layer)"""
    rs = C.rng(21)
    mat = cloud_material(T, "ca")
    m = C.Mesh()
    specs = [(70, 176, 110, 0.55), (265, 158, 140, 0.6), (470, 184, 100, 0.5), (640, 166, 130, 0.6), (150, 130, 90, 0.45), (560, 128, 100, 0.45)]
    for (x, z, w, big) in specs:
        for xx in copies(x, w / 2 + 20):
            # long low stack: wide streaks
            n = int(w / 22)
            for i in range(n):
                px = xx - w / 2 + w * (i + 0.5) / n
                u = (i + 0.5) / n
                r = (5 + 9 * math.sin(math.pi * u)) * big * rs.uniform(0.85, 1.1) * 1.3
                ball(m, px, rs.uniform(-2, 2), z + r * 0.3, r * 1.9, r * 0.8, r * 0.75, clampz=z, seg=16, rings=8)
    m.build("clouds_a", [mat], smooth=True)


def layer_clouds_b(T, tod):
    """big friendly cumulus (faster layer)"""
    rs = C.rng(33)
    mat = cloud_material(T, "cb")
    m = C.Mesh()
    specs = [(95, 146, 100, 1.0), (300, 118, 70, 0.78), (430, 158, 120, 1.15), (585, 126, 80, 0.85), (700, 152, 70, 0.8)]
    for (x, z, w, big) in specs:
        for xx in copies(x, w / 2 + 30):
            puff_cloud(m, xx, z, w, rs, big)
    m.build("clouds_b", [mat], smooth=True)


# ------------------------------------------------------------------ MOUNTAINS (+ volcano, castle)
def mountain_height(peaks, x, y, sun_dip):
    z = 0.0
    for (px, py, h, sl) in peaks:
        dx = C.wrap_dx(x, px, W)
        d = math.sqrt(dx * dx + (0.9 * (y - py)) ** 2)
        z = max(z, h - sl * d)
    return max(0.0, z)


def layer_mountains(T, tod):
    mt = T["mountains"]
    rs = C.rng(77)
    rock = C.toon("rock", mt["rock"], tri_thr(4, a=-0.15, b=0.45), mt["key"])
    snow = C.toon("snow", mt["snow"], tri_thr(3, a=0.0, b=0.45), mt["key"])
    sun_x = T["sun"]["pos"][0] * 0 + 76  # dip at sun x (scroll 0)
    npk = 6
    peaks = []
    for i in range(npk):
        px = (i + 0.5) * W / npk + rs.uniform(-28, 28)
        h = rs.uniform(76, 112)
        if abs(C.wrap_dx(px, sun_x + 20, W)) < 70:
            h = rs.uniform(56, 72)
        peaks.append((px, 12.0 + rs.uniform(-2, 2), h, rs.uniform(0.9, 1.1)))
    # a flat-topped volcano (index 2 peak replaced)
    base = 22.0
    step, ny = 5.0, 16
    xs = []
    x = -20.0
    while x <= W + 20.0:
        xs.append(x)
        x += step
    # volcano crater: clamp the tallest peak
    vi = max(range(npk), key=lambda i: peaks[i][2])
    vx, vy, vh, vs = peaks[vi]
    snowline = 0.64
    m = C.Mesh()
    verts, z_avg = [], []
    jit = C.rng(9)
    cols = []
    for x in xs:
        col = []
        for j in range(ny + 1):
            y = -120.0 + j * 10.0
            z = mountain_height(peaks, x, y, 0)
            # crater cut on the volcano
            dxv = C.wrap_dx(x, vx, W)
            if abs(dxv) < 22:
                zc = vh - 13.0 + 0.5 * abs(dxv)
                z = min(z, max(zc, vh - 14.0) if False else z)
            # irregular faceting: hashed wobble (periodic in x)
            ii = int(round((x + 20) / step)) % int(W / step)
            w = (C._hash(ii * 31 + j, 5) - 0.5)
            z += w * 4.0 * (1.0 if z > 12 else 0.0)
            xx = x + (C._hash(ii * 7 + j, 6) - 0.5) * 3.0
            col.append((xx, y + (C._hash(ii * 13 + j, 8) - 0.5) * 3.0, z))
        cols.append(col)
    for col in cols:
        verts += col
    faces, fm = [], []
    for i in range(len(xs) - 1):
        for j in range(ny):
            a = i * (ny + 1) + j
            b = (i + 1) * (ny + 1) + j
            q = (a, b, b + 1, a + 1)
            zs = sum(verts[k][2] for k in q) / 4.0
            ii = int(round((xs[i] + 20) / step)) % int(W / step)
            wob = (C._hash(ii * 5 + j, 3) - 0.5) * 14.0
            faces.append(q)
            fm.append(1 if (zs + wob > (base + 82.0)) else 0)
    # snow only on the higher peaks
    m.add(verts, faces)
    m.m = fm
    m.build("mountains", [rock, snow], smooth=False)
    # volcano smoke + castle
    sm = C.Mesh()
    sc_ = C.toon("smoke", mt["snow"], tri_thr(3, a=-0.2, b=0.4), mt["key"])
    cm = C.Mesh()
    hx = vx
    # tiny distant castle on a low shoulder
    cx = (vx + W * 0.5) % W
    zs = max(mountain_height(peaks, cx, yy, 0) for yy in range(-100, 40, 4))
    wall = C.toon("cw", mt["rock"], tri_thr(4, a=-0.15, b=0.45), mt["key"])
    roof = C.toon("cr", mt["snow"], tri_thr(3, a=0.0, b=0.45), mt["key"])
    cm = C.Mesh()
    zb = zs + base - 2
    box(cm, cx, 6, zb + 5, 22, 6, 10, 0)
    box(cm, cx - 10, 6, zb + 11, 6, 6, 18, 0)
    box(cm, cx + 10, 6, zb + 11, 6, 6, 18, 0)
    box(cm, cx, 6, zb + 15, 6, 6, 12, 0)
    cone(cm, cx - 10, 6, zb + 20, 5.0, 8, 6, 1)
    cone(cm, cx + 10, 6, zb + 20, 5.0, 8, 6, 1)
    cone(cm, cx, 6, zb + 21, 5.0, 9, 6, 1)
    cm.build("castle", [wall, roof])
    # lift the whole mountain mesh a little so peaks sit in the sky band: handled by object location
    for o in bpy.data.objects:
        if o.name.startswith(("mountains", "smoke", "castle")):
            o.location.z += base
            o.location.y += 30


# ------------------------------------------------------------------ LAKE
def layer_lake(T, tod):
    lk = T["lake"]
    ZL = 62.0
    ramp = lk["ramp"]
    zs = [0.0, 12.0, 26.0, 40.0, 52.0]
    mat = C.height_bands("water", ramp, zs)
    m = C.Mesh()
    quad_xz(m, -4, -4, W + 4, ZL, y=100.0)
    m.build("water", [mat])
    rs = C.rng(3)
    hl = C.solid("wl", lk["hl"])
    g0 = C.solid("g0", lk["glitter"][0])
    g1 = C.solid("g1", lk["glitter"][1])
    lm = C.Mesh()
    # wave lines: denser/smaller toward the horizon
    for i in range(70):
        u = rs.random() ** 1.5
        z = 3 + u * 54
        w = 4 + (1 - u) * 14 * rs.random() + 3
        x = rs.uniform(0, W)
        for xx in copies(x, w):
            quad_xz(lm, xx - w / 2, z, xx + w / 2, z + 1.0, y=90.0)
    lm.build("waves", [hl])
    # sun reflection column (glitter bars, narrowing upward)
    sx = 76.0
    gm0, gm1 = C.Mesh(), C.Mesh()
    z = 2.0
    k = 0
    while z < ZL - 2:
        u = z / ZL
        w = (22 * (1 - u) + 6) * rs.uniform(0.55, 1.0)
        off = rs.uniform(-3, 3) * (1 - u)
        for xx in copies(sx + off, w):
            (gm0 if k % 3 == 0 else gm1).add([(xx - w / 2, 80.0, z), (xx + w / 2, 80.0, z), (xx + w / 2, 80.0, z + 1.0), (xx - w / 2, 80.0, z + 1.0)], [(0, 1, 2, 3)])
        z += 2.0 + u * 2.0 + rs.uniform(0, 1.5)
        k += 1
    if gm0.v:
        gm0.build("gl0", [g0])
    if gm1.v:
        gm1.build("gl1", [g1])
    # two tiny sail boats
    bm = C.Mesh()
    hull = C.solid("hull", ramp[0])
    sail = C.solid("sail", lk["glitter"][0])
    for bx, bz, sz in [(330, 26, 1.0), (560, 40, 0.75)]:
        for xx in copies(bx, 14):
            hm_ = C.Mesh()
            poly_xz(hm_, [(xx - 6 * sz, bz), (xx + 6 * sz, bz), (xx + 4 * sz, bz - 2.5 * sz), (xx - 4 * sz, bz - 2.5 * sz)], y=70.0)
            hm_.build("hull", [hull])
            smm = C.Mesh()
            poly_xz(smm, [(xx - 0.5, bz + 1), (xx - 0.5, bz + 13 * sz), (xx + 5 * sz, bz + 1)], y=69.0)
            poly_xz(smm, [(xx + 0.8 * 0, bz + 2), (xx + 0.8, bz + 10 * sz), (xx - 4.5 * sz, bz + 2)], y=68.0)
            smm.build("sail", [sail])


# ------------------------------------------------------------------ RIDGES
def pine(m, x, y, zb, h, w, tiers=3, mats=(0, 1)):
    for k in range(tiers):
        u = k / tiers
        r = w * (1.0 - 0.55 * u) / 2
        cone(m, x, y, zb + h * 0.18 + h * 0.8 * u * 0.72, r, h * 0.42, 7, mats[0], sy=0.8)
    box(m, x, y, zb, 1.4, 1.4, h * 0.2, mats[1])


def layer_ridges(T, tod):
    R = T["ridges"]
    rs = C.rng(91)
    bands = [
        ("far", R["far"], 2, dict(n=4, hmin=26, hmax=40, wmin=110, wmax=160, base=40), 120.0, (0.0, 0.0)),
        ("mid", R["mid"], 3, dict(n=5, hmin=26, hmax=46, wmin=90, wmax=140, base=26), 80.0, (0.2, 0.0)),
        ("near", R["near"], 3, dict(n=6, hmin=22, hmax=36, wmin=70, wmax=120, base=8), 40.0, (0.2, 0.0)),
    ]
    pmat = C.toon("pine", R["pine"][:2] + [R["pine"][2]], [-1.0, -0.05, 0.62], R["key"])
    trunk = C.solid("trunk", R["pine"][0])
    for name, cols, nc, dp, y0, _ in bands:
        fn = dome_fn(rs, **dp)
        mat = C.toon("r_" + name, cols, tri_thr(len(cols), a=-0.1, b=0.5), R["key"], fw=0.2)
        hill_mesh("ridge_" + name, fn, mat, Y=34.0, step=4.0, ny=6, y0=y0, z0=0.0)
        if name != "far":
            pm = C.Mesh()
            x = -10.0
            while x < W + 10:
                h = fn(x)
                if h > dp["base"] + 8:
                    th = rs.uniform(9, 15) if name == "mid" else rs.uniform(12, 20)
                    pine(pm, x, y0 + 15, h - 3, th, th * 0.62, 3, (0, 1))
                x += rs.uniform(5, 11)
            pm.build("pines_" + name, [pmat, trunk])


# ------------------------------------------------------------------ HILLS (near)
def round_tree(m, x, y, zb, h, mats):
    # mats: 0 leaf, 1 trunk
    box(m, x, y, zb, h * 0.14, h * 0.14, h * 0.55, 1)
    ball(m, x, y, zb + h * 0.66, h * 0.36, h * 0.32, h * 0.34, 0, seg=14, rings=8)


def palm(m, x, y, zb, h, mats, lean=0.3):
    # curved trunk (segments) + fronds (flat leaves)
    px, pz = x, zb
    for k in range(6):
        nx = px + lean * h / 6 * (1 + k * 0.3)
        nz = pz + h / 6
        box(m, (px + nx) / 2, y, (pz + nz) / 2, 2.0, 2.0, h / 6 + 0.6, 1, rot_z=0)
        px, pz = nx, nz
    for k in range(7):
        ang = math.radians(-20 + k * 200.0 / 6)
        L = h * 0.5
        tip = (px + L * math.cos(ang), pz + L * math.sin(ang) * 0.5 - (abs(math.cos(ang))) * h * 0.12)
        mid = (px + L * 0.55 * math.cos(ang), pz + L * 0.55 * math.sin(ang) * 0.6 + 2.0)
        wd = 2.4
        m.add([(px, y, pz), (mid[0], y - 1, mid[1] + wd), (tip[0], y, tip[1]), (mid[0], y + 1, mid[1] - wd)], [(0, 1, 2, 3)], 0)


def house(m, x, y, zb, w, h, mats, win=True):
    # mats: 0 wall, 1 roof, 2 window
    box(m, x, y, zb + h / 2, w, w * 0.8, h, 0)
    # pitched roof: triangular prism
    rz = zb + h
    v = [(x - w / 2 - 1.5, y - w * 0.4 - 1, rz), (x + w / 2 + 1.5, y - w * 0.4 - 1, rz), (x + w / 2 + 1.5, y + w * 0.4 + 1, rz), (x - w / 2 - 1.5, y + w * 0.4 + 1, rz), (x, y - w * 0.4 - 1, rz + w * 0.55), (x, y + w * 0.4 + 1, rz + w * 0.55)]
    m.add(v, [(0, 1, 2, 3), (0, 4, 5, 3), (1, 2, 5, 4), (0, 1, 4), (3, 5, 2)], 1)


def windmill(m, x, y, zb, h, mats, ang=0.35):
    v, f = C.prim_cone(10, 0.62, h, h * 0.22)
    m.add(C.xform(v, (x, y, zb)), f, 0)
    cone(m, x, y, zb + h, h * 0.2, h * 0.22, 10, 1)
    hub = (x, y - h * 0.2, zb + h * 0.92)
    for k in range(4):
        a = ang + k * math.pi / 2
        L = h * 0.85
        ex, ez = hub[0] + L * math.cos(a), hub[2] + L * math.sin(a)
        px, pz = -math.sin(a), math.cos(a)
        wd = 1.0
        m.add([(hub[0] - px * wd, hub[1], hub[2] - pz * wd), (ex - px * wd, hub[1], ez - pz * wd), (ex + px * wd, hub[1], ez + pz * wd), (hub[0] + px * wd, hub[1], hub[2] + pz * wd)], [(0, 1, 2, 3)], 2)
        # sail cloth
        s0 = hub[0] + (L * 0.3) * math.cos(a), hub[2] + (L * 0.3) * math.sin(a)
        s1 = hub[0] + (L * 0.95) * math.cos(a), hub[2] + (L * 0.95) * math.sin(a)
        o = 4.6
        m.add([(s0[0] + px * 1.0, hub[1] - 0.5, s0[1] + pz * 1.0), (s1[0] + px * 1.0, hub[1] - 0.5, s1[1] + pz * 1.0), (s1[0] + px * o, hub[1] - 0.5, s1[1] + pz * o), (s0[0] + px * o, hub[1] - 0.5, s0[1] + pz * o)], [(0, 1, 2, 3)], 3)


def layer_hills(T, tod):
    Hh = T["hills"]
    rs = C.rng(123)
    key = Hh["key"]
    fn = dome_fn(rs, n=5, hmin=30, hmax=52, wmin=90, wmax=140, base=10, sharp=1.0)
    ground = C.toon("ground", Hh["ground"], tri_thr(4, a=-0.15, b=0.55), key, fw=0.25)
    hill_mesh("hills", fn, ground, Y=50.0, step=3.0, ny=8, y0=10.0, z0=0.0, profile_pow=0.5)
    leaf = C.toon("leaf", Hh["leaf"], tri_thr(4, a=-0.2, b=0.5), key, fw=0.2)
    trunk = C.solid("trunk", Hh["trunk"][1])
    trunk_d = C.solid("trunk_d", Hh["trunk"][0])
    tm = C.Mesh()
    kinds = 0

    def zat(x):
        return fn(x) * 0.93

    # trees along the crest, mixed kinds
    x = 6.0
    while x < W:
        z = zat(x)
        y = 50.0
        if z > 22:
            r = rs.random()
            h = rs.uniform(16, 26)
            for xx in copies(x, 20):
                if r < 0.45:
                    round_tree(tm, xx, y, z - 2, h, None)
                elif r < 0.8:
                    pine(tm, xx, y, z - 2, h * 1.05, h * 0.55, 3, (0, 1))
                else:
                    palm(tm, xx, y, z - 2, h * 1.15, None, lean=rs.uniform(-0.3, 0.3))
        x += rs.uniform(14, 34)
    tm.m = [0] * len(tm.f)
    tmesh = tm.build("trees", [leaf, trunk], smooth=True)
    # bushes (low smooth domes) hugging the slopes
    bm = C.Mesh()
    x = 4.0
    while x < W:
        z = zat(x) * rs.uniform(0.35, 0.8)
        if z > 4:
            rr = rs.uniform(5, 9)
            for xx in copies(x, 12):
                ball(bm, xx, 30, z + rr * 0.3, rr, rr * 0.7, rr * 0.75, 0, clampz=z - 1, seg=12, rings=7)
        x += rs.uniform(18, 38)
    bm.build("bushes", [leaf], smooth=True)
    # village + windmills
    wall = C.toon("wall", Hh["wall"], tri_thr(3, a=-0.1, b=0.5), key, fw=0.2)
    roof = C.toon("roof", Hh["roof"], tri_thr(2, a=0.1, b=0.5), key, fw=0.2)
    win = C.solid("win", Hh["win"])
    vm = C.Mesh()
    houses = [(180, 11, 14), (200, 9, 12), (218, 12, 15), (450, 10, 13), (470, 12, 14)]
    wm = C.Mesh()
    for (hx, hw_, hh_) in houses:
        for xx in copies(hx, 14):
            zb = zat(xx) * 0.78 - 2
            house(vm, xx, 28, zb, hw_, hh_, None)
    vm.m = [0] * (len(vm.f) - 0)
    # house faces: wall then roof alternate; re-tag by construction order below
    vm_obj = None
    # rebuild houses with proper material tags
    vm = C.Mesh()
    win_m = C.Mesh()
    for (hx, hw_, hh_) in houses:
        for xx in copies(hx, 14):
            zb = zat(xx) * 0.78 - 2
            box(vm, xx, 28, zb + hh_ / 2, hw_, hw_ * 0.8, hh_, 0)
            rz = zb + hh_
            ww = hw_ / 2 + 1.5
            dd = hw_ * 0.4 + 1
            v = [(xx - ww, 28 - dd, rz), (xx + ww, 28 - dd, rz), (xx + ww, 28 + dd, rz), (xx - ww, 28 + dd, rz), (xx, 28 - dd, rz + hw_ * 0.5), (xx, 28 + dd, rz + hw_ * 0.5)]
            vm.add(v, [(0, 1, 2, 3), (0, 4, 5, 3), (1, 2, 5, 4), (0, 1, 4), (3, 5, 2)], 1)
            quad_xz(win_m, xx - 2, zb + hh_ * 0.35, xx + 0.4, zb + hh_ * 0.35 + 3.4, y=28 - hw_ * 0.4 - 0.5)
    vm.build("village", [wall, roof])
    if win_m.v:
        win_m.build("windows", [win])
    # windmill
    mill = C.Mesh()
    wall_m = C.toon("mwall", Hh["wall"], tri_thr(3, a=-0.1, b=0.5), key, fw=0.2)
    cap_m = C.toon("mcap", Hh["roof"], tri_thr(2, a=0.1, b=0.5), key, fw=0.2)
    blade_m = C.solid("mblade", Hh["trunk"][0])
    sail_m = C.solid("msail", Hh["wall"][2])
    for mx in (330,):
        for xx in copies(mx, 30):
            mz = zat(xx) * 0.9 - 3
            v, f = C.prim_cone(10, 0.62, 40, 8.8)
            mill.add(C.xform(v, (xx, 30, mz)), f, 0)
            cone(mill, xx, 30, mz + 40, 8.0, 9, 10, 1)
            hub = (xx, 30 - 8.5, mz + 37)
            for k in range(4):
                a = 0.4 + k * math.pi / 2
                L = 32.0
                ex, ez = hub[0] + L * math.cos(a), hub[2] + L * math.sin(a)
                px, pz = -math.sin(a), math.cos(a)
                mill.add([(hub[0] - px, hub[1], hub[2] - pz), (ex - px, hub[1], ez - pz), (ex + px, hub[1], ez + pz), (hub[0] + px, hub[1], hub[2] + pz)], [(0, 1, 2, 3)], 2)
                s0 = (hub[0] + 9 * math.cos(a), hub[2] + 9 * math.sin(a))
                s1 = (hub[0] + 31 * math.cos(a), hub[2] + 31 * math.sin(a))
                mill.add([(s0[0] + px, hub[1] - 0.5, s0[1] + pz), (s1[0] + px, hub[1] - 0.5, s1[1] + pz), (s1[0] + px * 6, hub[1] - 0.5, s1[1] + pz * 6), (s0[0] + px * 6, hub[1] - 0.5, s0[1] + pz * 6)], [(0, 1, 2, 3)], 3)
    mill.build("windmill", [wall_m, cap_m, blade_m, sail_m])
    # fireflies / sparkles
    ff = C.solid("ff", T["fireflies"])
    fm = C.Mesh()
    for i in range(14 if tod in ("sunset", "night", "dawn") else 6):
        x = rs.uniform(10, W - 10)
        z = rs.uniform(30, 120)
        quad_xz(fm, x - 0.5, z - 0.5, x + 0.5, z + 0.5, y=10.0)
    fm.build("fireflies", [ff])


# ------------------------------------------------------------------ FOREGROUND
def blade(m, x, y, zb, h, lean, wd, mat=0, curve=0.35):
    """tapered, curved grass blade (flat ribbon, 4 segments)"""
    n = 4
    pts_l, pts_r = [], []
    for i in range(n + 1):
        u = i / n
        cx = x + lean * h * (u ** 1.6) + curve * h * math.sin(u * math.pi) * 0.3 * (1 if lean >= 0 else -1) * 0.0
        cz = zb + h * u
        w = wd * (1 - u) ** 0.85
        pts_l.append((cx - w / 2, cz))
        pts_r.append((cx + w / 2, cz))
    verts = [(a[0], y, a[1]) for a in pts_l] + [(a[0], y, a[1]) for a in pts_r]
    faces = []
    for i in range(n):
        faces.append((i, i + 1, n + 1 + i + 1, n + 1 + i))
    m.add(verts, faces, mat)


def layer_fore(T, tod):
    F = T["fore"]
    rs = C.rng(404)
    mat = C.toon("fsil", F["sil"], [-1.0, 0.15, 0.6], F["key"], fw=0.0, rim=(F["rim"], 0.7, 0.05))
    m = C.Mesh()
    # tufts of grass blades
    x = 4.0
    while x < W:
        n = rs.randint(5, 9)
        base_h = rs.uniform(18, 44)
        for k in range(n):
            bx = x + (k - n / 2) * 2.8 + rs.uniform(-1, 1)
            h = base_h * rs.uniform(0.45, 1.0)
            lean = rs.uniform(-0.34, 0.34) + (k - n / 2) * 0.045
            for xx in copies(bx, 12):
                blade(m, xx, 5 + k * 0.3, -2, h, lean, rs.uniform(3.4, 4.6))
        x += rs.uniform(26, 58)
    # broad leaf fronds
    x = 20.0
    while x < W:
        L = rs.uniform(26, 44)
        ang = rs.uniform(-0.55, 0.55)
        for xx in copies(x, L):
            pts = []
            N = 7
            for i in range(N + 1):
                u = i / N
                cx = xx + math.sin(ang) * L * u + ang * 6 * math.sin(u * math.pi)
                cz = -2 + math.cos(ang) * L * u * 0.92 - 6 * u * u * abs(ang) * 2
                wdt = 6.5 * math.sin(math.pi * min(1, u * 1.1)) ** 0.8 + (1 - u) * 1.2
                pts.append((cx, cz, wdt))
            verts = [(p[0] - p[2], 3.0, p[1]) for p in pts] + [(p[0] + p[2], 3.0, p[1]) for p in pts]
            faces = [(i, i + 1, N + 1 + i + 1, N + 1 + i) for i in range(N)]
            m.add(verts, faces, 0)
        x += rs.uniform(90, 170)
    m.build("fore", [mat], smooth=False)
    # flowers in front (accent colors)
    fm = [C.solid("f0", F["flower"][0]), C.solid("f1", F["flower"][1]), C.solid("stem", F["sil"][1])]
    fmesh = [C.Mesh(), C.Mesh(), C.Mesh()]
    x = 30.0
    while x < W:
        h = rs.uniform(16, 34)
        kind = rs.randint(0, 1)
        for xx in copies(x, 10):
            quad_xz(fmesh[2], xx - 0.7, -2, xx + 0.7, h, y=1.0)
            r = 3.4
            ball(fmesh[kind], xx, 0.0, h + 1, r, 1.0, r, seg=10, rings=6)
            ball(fmesh[1 - kind], xx, -1.5, h + 1, 1.4, 1.0, 1.4, seg=8, rings=5)
        x += rs.uniform(60, 120)
    for mm, ma, nm in zip(fmesh, fm, ("fl0", "fl1", "stem")):
        if mm.v:
            mm.build(nm, [ma])


# ------------------------------------------------------------------ driver
BUILD = {
    "sky": (layer_sky, SW),
    "sky_stars": (layer_stars, SW),
    "sun": (lambda T, tod: layer_sun(T, tod, "solid"), SW),
    "sun_glow": (lambda T, tod: layer_sun(T, tod, "glow"), SW),
    "clouds_a": (layer_clouds_a, W),
    "clouds_b": (layer_clouds_b, W),
    "mountains": (layer_mountains, W),
    "lake": (layer_lake, W),
    "ridges": (layer_ridges, W),
    "hills": (layer_hills, W),
    "fore": (layer_fore, W),
}


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--tod", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--scale", type=int, default=P.SCALE)
    ap.add_argument("--layers", default=",".join(P.LAYERS))
    a = ap.parse_args(argv)
    os.makedirs(a.out, exist_ok=True)
    T = P.TOD[a.tod]
    layers = []
    for l in a.layers.split(","):
        layers.append(l)
        if l == "sky" and "stars" in T:
            layers.append("sky_stars")
        if l == "sun":
            layers.append("sun_glow")
    for layer in layers:
        fn, width = BUILD[layer]
        t0 = time.time()
        C.reset()
        C.setup_render(width, H, a.scale)
        fn(T, a.tod)
        C.render_to(os.path.join(a.out, "%s_%s.png" % (a.tod, layer)))
        print("LAYER", a.tod, layer, "%.1fs" % (time.time() - t0), flush=True)


if __name__ == "__main__":
    main()
