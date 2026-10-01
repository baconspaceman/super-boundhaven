"""Sprite prop definitions shared by scenes/sprites.py (Blender) and pack_sprites.py (pixelizer/packer).

ROLES: name -> dict(line=<outline hex>, ramp=[dark..light hex]). A sprite's palette = union of its roles
(ramp + line) and must stay <= 15 colors. The outline around a pixel uses the `line` of the role that pixel belongs to
(hue-matched dark, never pure black).
SPRITES: name -> dict(size=(w,h native px canvas), frames=N, roles=[...], fps, loop, ground=(x,z) anchor inside canvas).
"""

ROLES = {
    "leaf": dict(line="#1c5a58", ramp=["#2f8a4a", "#58c054", "#a8ee6c"]),
    "trunk": dict(line="#472f52", ramp=["#8a5048", "#c98450"]),
    "stone": dict(line="#3e3a66", ramp=["#6a6ca0", "#9a9ec8", "#dcdcf0"]),
    "petal_pink": dict(line="#8a2a5a", ramp=["#ff6f9a", "#ffc0d4"]),
    "petal_red": dict(line="#8a2030", ramp=["#e84a62", "#ff8a8a"]),
    "petal_white": dict(line="#6a6aa8", ramp=["#c8c8e8", "#fff6ea"]),
    "yellow": dict(line="#b8741c", ramp=["#ffc83a", "#ffe44a", "#fff6a8"]),
    "crystal": dict(line="#2e1a6a", ramp=["#5a34b0", "#8a5ae8", "#c8a4ff", "#f2e4ff"]),
    "wall": dict(line="#6a3a4a", ramp=["#c28a6a", "#ecc098", "#fff0d4"]),
    "roof": dict(line="#7a2840", ramp=["#b8484e", "#e66a58"]),
    "sail": dict(line="#6a6aa8", ramp=["#dcdcf0", "#fff0d4"]),
    "flame": dict(line="#c2431f", ramp=["#ff8a2a", "#ffc94a", "#fff3b0"]),
    "iron": dict(line="#23234a", ramp=["#56567a", "#8a8ab0"]),
    "water": dict(line="#1c4a9a", ramp=["#2a78d0", "#58aef4", "#a8dcff", "#f0fbff"]),
    "coil": dict(line="#3e3a66", ramp=["#8a8ab8", "#dcdcf0"]),
    "coral": dict(line="#8a2a3a", ramp=["#e84a62", "#ff8a82"]),
    "sun": dict(line="#e8902a", ramp=["#ffc94d", "#ffe773", "#fffbd8"]),
    "moon": dict(line="#6c84c8", ramp=["#b8c6f0", "#e4ecff", "#fffef0"]),
    "cloud": dict(line="#7a94d0", ramp=["#b4c8ee", "#eef4ff", "#ffffff"]),
    "wing": dict(line="#5a2a7a", ramp=["#ff7fb0", "#ffc0dc"]),
    "bird": dict(line="#1a1640", ramp=["#3a3478", "#6a62b0"]),
}

# frames: number of animation frames. ground: (x, z) of the anchor inside the canvas (native px, z up from bottom)
SPRITES = {
    "tree_round": dict(size=(48, 64), frames=1, roles=["leaf", "trunk"], fps=0, ground=(24, 4)),
    "tree_pine": dict(size=(40, 64), frames=1, roles=["leaf", "trunk"], fps=0, ground=(20, 4)),
    "tree_palm": dict(size=(56, 64), frames=1, roles=["leaf", "trunk"], fps=0, ground=(20, 4)),
    "bush": dict(size=(40, 28), frames=1, roles=["leaf", "petal_pink", "yellow"], fps=0, ground=(20, 4)),
    "flower_daisy": dict(size=(24, 32), frames=1, roles=["petal_white", "yellow", "leaf"], fps=0, ground=(12, 4)),
    "flower_tulip": dict(size=(24, 32), frames=1, roles=["petal_red", "leaf"], fps=0, ground=(12, 4)),
    "rock": dict(size=(32, 24), frames=1, roles=["stone"], fps=0, ground=(16, 4)),
    "crystal": dict(size=(32, 40), frames=1, roles=["crystal", "stone"], fps=0, ground=(16, 4)),
    "windmill": dict(size=(72, 80), frames=8, roles=["wall", "roof", "trunk", "sail"], fps=6, ground=(36, 4)),
    "torch": dict(size=(20, 40), frames=4, roles=["trunk", "iron", "flame"], fps=8, ground=(10, 4)),
    "lantern": dict(size=(24, 40), frames=4, roles=["iron", "yellow", "flame"], fps=6, ground=(12, 4)),
    "waterfall": dict(size=(40, 72), frames=4, roles=["water", "stone"], fps=8, ground=(20, 4)),
    "spring": dict(size=(32, 32), frames=5, roles=["coil", "coral", "yellow"], fps=14, ground=(16, 4)),
    "sun": dict(size=(56, 56), frames=1, roles=["sun"], fps=0, ground=(28, 28)),
    "moon": dict(size=(48, 48), frames=1, roles=["moon"], fps=0, ground=(24, 24)),
    "cloud_a": dict(size=(72, 36), frames=1, roles=["cloud"], fps=0, ground=(36, 4)),
    "cloud_b": dict(size=(56, 32), frames=1, roles=["cloud"], fps=0, ground=(28, 4)),
    "cloud_c": dict(size=(96, 40), frames=1, roles=["cloud"], fps=0, ground=(48, 4)),
    "butterfly": dict(size=(16, 16), frames=4, roles=["wing", "yellow"], fps=10, ground=(8, 8)),
    "bird_flock": dict(size=(56, 28), frames=4, roles=["bird"], fps=6, ground=(28, 14)),
}
