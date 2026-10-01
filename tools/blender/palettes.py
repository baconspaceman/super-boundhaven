"""Golden Hour Meadows palettes -- single source of truth for Blender materials AND the pixelizer.

Every color the pipeline ever emits comes from this file (hand-picked, hue-shifted: shadows lean violet/blue,
lights lean warm). Blender renders flat/toon bands using these exact colors; pixelize.py snaps to them.

Design rules (docs/ART_NORTH_STAR.md): bold + cheerful, 2-3 tone flat blocks, background contrast compressed,
dither only in sky/halo/haze zones.

Layout of TOD[<tod>]:
  sky    : ramp (top->bottom), stops (0..1 from top), glow=(x, z, sigma, strength) bends the bands around the sun
  sun    : disc/ring/halo colors, sun position (x, z) in native px (z up from the bottom of the 256x224 frame)
  clouds : ramp dark->light, key light vector
  mountains / lake / ridges / hills / fore : ramps dark->light + light vectors + haze color
Only plain dicts/lists/tuples so the file imports in both Blender's python and system python.
"""

W = 768  # tileable layer width (3 screens)
H = 224  # native layer height
SW = 256  # sky/sun frame width
SCALE = 4  # render supersampling; native px = render px / SCALE

TODS = ["dawn", "day", "sunset", "night"]
LAYERS = ["sky", "sun", "clouds_a", "clouds_b", "mountains", "lake", "ridges", "hills", "fore"]

# parallax factor (horizontal scroll multiplier) per layer, far -> near
PARALLAX = {
    "sky": 0.0,
    "sun": 0.02,
    "clouds_a": 0.05,
    "clouds_b": 0.10,
    "mountains": 0.16,
    "lake": 0.22,
    "ridges": 0.32,
    "hills": 0.50,
    "fore": 0.80,
}
# layer width in native px (sky/sun are one screen; the rest tile across 3 screens)
LAYER_W = {k: (SW if k in ("sky", "sun") else W) for k in LAYERS}
TILE_X = {k: (k not in ("sun", "sky")) for k in LAYERS}  # sky has a sun glow baked in: fixed frame, not tileable


def _ramp(*c):
    return list(c)


TOD = {}

# ---------------------------------------------------------------------------------------------- SUNSET (hero)
TOD["sunset"] = dict(
    sky=dict(
        ramp=["#231457", "#3a1a78", "#5c2196", "#8a2ba0", "#b93aa0", "#e0509a", "#fb6f86", "#ff9462", "#ffb748", "#ffd65c", "#ffef9a"],
        stops=[0.0, 0.10, 0.20, 0.30, 0.40, 0.50, 0.59, 0.68, 0.77, 0.87, 1.0],
        glow=(76, 100, 120, 0.25),
        dither=3.0,
    ),
    sun=dict(
        pos=(76, 98), r=25,
        disc=["#fffbd8", "#ffe773"],        # core, lower band
        ring="#ffc94d",                      # solid ring just outside disc
        halo=["#ffb04a", "#ff8f5a", "#f8709a"],  # dithered glow, inner -> outer
        halo_r=[44, 66, 66],
        ray="#ffd56a",
        n_rays=6,
    ),
    clouds=dict(
        # dark->light: shadow top violet, body pink, belly orange glow, gold rim
        ramp=["#6a2b92", "#b3409c", "#ff7f7e", "#ffb45a", "#ffe08a"],
        key=(0.15, -0.25, -0.92),
        fill=(0.0, 0.0, 1.0),
        thr=[-1.0, -0.55, -0.05, 0.50, 0.82],
    ),
    mountains=dict(
        rock=["#3a2a6e", "#56348a", "#7a3f9c", "#c0509a"],
        snow=["#9a5bb0", "#e88aa6", "#ffc98a"],
        key=(0.65, 0.55, 0.30),
        haze="#ff9a78",
        haze_k=0.55,
    ),
    lake=dict(
        ramp=["#7a3a9e", "#b04aa0", "#e8608e", "#ff8e72", "#ffb458"],
        glitter=["#fff3b0", "#ffd65c"],
        hl="#ff9a78",
    ),
    ridges=dict(
        far=["#5a2f86", "#8e3c9a"],
        mid=["#54347e", "#7c419c", "#b25098"],
        near=["#3e2c6c", "#5e3a90", "#8c48a0"],
        pine=["#34205e", "#4c2c84", "#f07a8c"],
        key=(0.6, 0.4, 0.5),
        haze="#ff9a78",
    ),
    hills=dict(
        ground=["#3a2f70", "#54498c", "#7a62a0", "#f2806a"],
        leaf=["#2c2560", "#433a80", "#63559f", "#ff8a6a"],
        trunk=["#27184a", "#5a3468"],
        wall=["#3d2c66", "#6e4a82", "#f79a78"],
        roof=["#28184e", "#8c3c84"],
        win="#ffd65c",
        key=(0.6, 0.3, 0.7),
        haze="#ff9a78",
    ),
    fore=dict(
        sil=["#140c30", "#221446", "#3a2368"],
        rim="#ff8a6a",
        flower=["#ff6f9a", "#ffd65c"],
        key=(0.6, 0.3, 0.7),
    ),
)

# ---------------------------------------------------------------------------------------------- DAY
TOD["day"] = dict(
    sky=dict(
        ramp=["#2f6fd0", "#3f86e0", "#58a0ee", "#78baf6", "#9ad0fa", "#bce4fc", "#dcf3fe"],
        stops=[0.0, 0.18, 0.36, 0.54, 0.72, 0.88, 1.0],
        glow=(190, 175, 100, 0.12),
        dither=3.0,
    ),
    sun=dict(
        pos=(190, 172), r=15,
        disc=["#fffbe0", "#ffef8a"],
        ring="#ffe25a",
        halo=["#fff4b0", "#d8f0ff", "#b0dcfb"],
        halo_r=[26, 40, 40],
        ray="#fff6c0",
        n_rays=0,
    ),
    clouds=dict(
        ramp=["#7a94d0", "#b4c8ee", "#eef4ff", "#ffffff", "#fffbe8"],
        key=(-0.45, -0.35, 0.82),
        fill=(0.0, 0.0, 1.0),
        thr=[-1.0, -0.15, 0.25, 0.55, 0.85],
    ),
    mountains=dict(
        rock=["#5a6ec0", "#6f88d4", "#8aa4e2", "#a9c2f0"],
        snow=["#b8c8f2", "#e2ecff", "#ffffff"],
        key=(-0.55, -0.45, 0.70),
        haze="#c8e6fb",
        haze_k=0.55,
    ),
    lake=dict(
        ramp=["#3a78d8", "#4e92e6", "#6ab0f2", "#8ccaf8", "#b4e2fc"],
        glitter=["#ffffff", "#d8f4ff"],
        hl="#a4dcfc",
    ),
    ridges=dict(
        far=["#6a9cc8", "#88b8d8"],
        mid=["#3d8a88", "#58a898", "#78c4a0"],
        near=["#2c7a5c", "#3f9a64", "#5cb870"],
        pine=["#1e6052", "#2c8260", "#58c070"],
        key=(-0.55, -0.4, 0.75),
        haze="#c8e6fb",
    ),
    hills=dict(
        ground=["#2f8a4a", "#48aa4c", "#74cc52", "#c4ee6c"],
        leaf=["#1c6a48", "#2c8a4c", "#4cae4e", "#86d85a"],
        trunk=["#6a3a44", "#a8683e"],
        wall=["#c08a6a", "#e6b894", "#fff0d4"],
        roof=["#b8484e", "#e66a58"],
        win="#ffe25a",
        key=(-0.55, -0.4, 0.75),
        haze="#c8e6fb",
    ),
    fore=dict(
        sil=["#1c5a58", "#2a7c4c", "#44a84c"],
        rim="#b4e860",
        flower=["#ff6f8c", "#ffe25a"],
        key=(-0.55, -0.4, 0.75),
    ),
)

# ---------------------------------------------------------------------------------------------- DAWN
TOD["dawn"] = dict(
    sky=dict(
        ramp=["#4a4c9c", "#6a66b4", "#8c80c4", "#b094cc", "#d4a4c8", "#f0b4b8", "#ffc8a8", "#ffdc9c", "#fff0b4"],
        stops=[0.0, 0.16, 0.30, 0.44, 0.58, 0.70, 0.81, 0.91, 1.0],
        glow=(185, 88, 110, 0.22),
        dither=3.0,
    ),
    sun=dict(
        pos=(185, 84), r=19,
        disc=["#fffbdc", "#ffe98a"],
        ring="#ffd672",
        halo=["#ffe0a0", "#ffc8a8", "#f0b4b8"],
        halo_r=[32, 48, 48],
        ray="#fff0b4",
        n_rays=0,
    ),
    clouds=dict(
        ramp=["#a08cc8", "#d0a8cc", "#f4b8b8", "#ffd2a8", "#fff0c4"],
        key=(0.35, 0.50, -0.30),
        fill=(0.0, 0.0, 1.0),
        thr=[-1.0, -0.10, 0.20, 0.50, 0.82],
    ),
    mountains=dict(
        rock=["#6c5aa4", "#8a72b8", "#a88ac8", "#c8a4d4"],
        snow=["#cdb4dc", "#f0d4e0", "#fff2e0"],
        key=(0.55, 0.45, 0.55),
        haze="#ffd2b0",
        haze_k=0.55,
    ),
    lake=dict(
        ramp=["#7c78c0", "#9c90cc", "#c0a4d0", "#e4b8c4", "#ffd2b0"],
        glitter=["#fff6d0", "#ffe2a0"],
        hl="#ffc8a8",
    ),
    ridges=dict(
        far=["#8a82bc", "#a898c8"],
        mid=["#5a78a8", "#7c94b8", "#9cb0c8"],
        near=["#46808c", "#5ea09a", "#80bca4"],
        pine=["#36607c", "#4a8088", "#9cc4a8"],
        key=(0.55, 0.40, 0.65),
        haze="#ffd2b0",
    ),
    hills=dict(
        ground=["#3a8c78", "#58ac86", "#86c88e", "#d4ea9a"],
        leaf=["#2a6c68", "#3c8c74", "#5cac80", "#9cd08e"],
        trunk=["#5c4a70", "#9a7a78"],
        wall=["#b8909c", "#dcb4b4", "#fff0d8"],
        roof=["#a04c6e", "#d4706c"],
        win="#ffe28a",
        key=(0.55, 0.40, 0.65),
        haze="#ffd2b0",
    ),
    fore=dict(
        sil=["#2a4c68", "#3a7078", "#58987c"],
        rim="#ffd8a0",
        flower=["#ff8aa8", "#ffe28a"],
        key=(0.55, 0.40, 0.65),
    ),
)

# ---------------------------------------------------------------------------------------------- NIGHT
TOD["night"] = dict(
    sky=dict(
        ramp=["#0c0c2e", "#141448", "#1c1c62", "#262878", "#303a8c", "#3a4c9c", "#4a62ac"],
        stops=[0.0, 0.18, 0.36, 0.54, 0.72, 0.88, 1.0],
        glow=(190, 160, 100, 0.10),
        dither=3.0,
    ),
    sun=dict(
        pos=(190, 168), r=15,
        disc=["#fffef0", "#e4ecff"],
        ring="#c4d4ff",
        halo=["#8ea4f0", "#5c74d0", "#3a4c9c"],
        halo_r=[24, 36, 36],
        ray="#c4d4ff",
        n_rays=0,
        crater="#b8c6f0",
    ),
    clouds=dict(
        ramp=["#20246c", "#2e3a88", "#4a5cae", "#7e92d0", "#b4c4f0"],
        key=(-0.40, 0.30, 0.60),
        fill=(0.0, 0.0, 1.0),
        thr=[-1.0, -0.10, 0.25, 0.55, 0.85],
    ),
    mountains=dict(
        rock=["#141450", "#1c2068", "#283080", "#3c4c9c"],
        snow=["#4a5cae", "#7e92d0", "#b4c4f0"],
        key=(-0.55, 0.35, 0.60),
        haze="#3a4c9c",
        haze_k=0.55,
    ),
    lake=dict(
        ramp=["#10104a", "#1a1c66", "#262c80", "#34409a", "#4a5cb0"],
        glitter=["#e4ecff", "#a4b8f4"],
        hl="#4a5cb0",
    ),
    ridges=dict(
        far=["#1c2068", "#283080"],
        mid=["#141450", "#1c2068", "#283a84"],
        near=["#0e1040", "#181c5c", "#243278"],
        pine=["#0a0c34", "#121a52", "#4a6cb0"],
        key=(-0.5, 0.3, 0.6),
        haze="#3a4c9c",
    ),
    hills=dict(
        ground=["#0e1c48", "#182e5c", "#244672", "#5c8ac0"],
        leaf=["#0a1840", "#122c58", "#1c4470", "#5c9ac8"],
        trunk=["#14123c", "#2c2c62"],
        wall=["#2a2c64", "#444882", "#7a84c0"],
        roof=["#161848", "#34347a"],
        win="#ffe25a",
        key=(-0.5, 0.3, 0.6),
        haze="#3a4c9c",
    ),
    fore=dict(
        sil=["#060820", "#0c1234", "#182450"],
        rim="#6c8cd0",
        flower=["#9cb4ff", "#ffe25a"],
        key=(-0.5, 0.3, 0.6),
    ),
    stars=["#ffffff", "#b4c4f0", "#ffe25a"],
    firefly="#d8ff7a",
)
TOD["sunset"]["fireflies"] = "#ffe680"
TOD["dawn"]["fireflies"] = "#fff0a0"
TOD["day"]["fireflies"] = "#ffffff"
TOD["night"]["fireflies"] = "#d8ff7a"


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def layer_palette(tod, layer):
    """Flat list of hex colors (lower-case) a given layer may use. Mirrors what the Blender materials emit."""
    t = TOD[tod]
    out = []

    def add(*lists):
        for l in lists:
            for c in (l if isinstance(l, (list, tuple)) else [l]):
                c = c.lower()
                if c not in out:
                    out.append(c)

    if layer == "sky":
        add(t["sky"]["ramp"])
        if "stars" in t:
            add(t["stars"])
    elif layer == "sun":
        s = t["sun"]
        add(s["disc"], s["ring"], s["halo"], s["ray"])
        if "crater" in s:
            add(s["crater"])
    elif layer in ("clouds_a", "clouds_b"):
        add(t["clouds"]["ramp"])
    elif layer == "mountains":
        m = t["mountains"]
        add(m["rock"], m["snow"], m["haze"])
    elif layer == "lake":
        l = t["lake"]
        add(l["ramp"], l["glitter"], l["hl"])
    elif layer == "ridges":
        r = t["ridges"]
        add(r["far"], r["mid"], r["near"], r["pine"], r["haze"])
    elif layer == "hills":
        h = t["hills"]
        add(h["ground"], h["leaf"], h["trunk"], h["wall"], h["roof"], h["win"], t["fireflies"])
    elif layer == "fore":
        f = t["fore"]
        add(f["sil"], f["rim"], f["flower"])
    return out
