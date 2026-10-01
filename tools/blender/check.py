"""Pixel sanity checks for the generated Blender art (system python: Pillow + numpy). Exit 1 on failure.

  python check.py [--assets <dir>]

Checks: layer sizes, hard alpha (0/255 only), <=32 colors per layer, <=64 (warn) / 80 (fail) per scene, every pixel
color comes from palettes.py, horizontal seam continuity on tileable layers, sprites <=15 colors + hard alpha + atlas bounds.
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import palettes as P  # noqa: E402

fails, warns = [], []


def colors(a):
    m = a[..., 3] > 0
    return {tuple(c) for c in np.unique(a[m][:, :3], axis=0)}


def seam_ok(a):
    """mismatch rate across the wrap seam must not exceed 1.6x the average interior column-pair rate (+0.02)."""
    op = a[..., 3] > 0
    def rate(l, r):
        diff = (op[:, l] != op[:, r]) | (op[:, l] & op[:, r] & (a[:, l, :3] != a[:, r, :3]).any(-1))
        return diff.mean()
    w = a.shape[1]
    seam = rate(w - 1, 0)
    inner = np.mean([rate(i, i + 1) for i in range(0, w - 1)])
    return seam <= inner * 1.6 + 0.02, seam, inner


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--assets", default=os.path.join(HERE, "..", "..", "packages", "art", "assets", "blender"))
    a = ap.parse_args()
    man = json.load(open(os.path.join(a.assets, "bg_manifest.json")))
    for tod in P.TODS:
        if tod not in man:
            fails.append("missing tod %s" % tod)
            continue
        scene = set()
        for rec in man[tod]:
            tag = "%s/%s" % (tod, rec["name"])
            im = np.asarray(Image.open(os.path.join(a.assets, rec["file"])).convert("RGBA"))
            h, w = im.shape[:2]
            if w != P.LAYER_W[rec["name"]] or h > P.H or (rec["name"] in ("sky", "sun") and h != P.H):
                fails.append("%s bad size %dx%d" % (tag, w, h))
            if (rec["width"], rec["height"]) != (w, h):
                fails.append("%s manifest size mismatch" % tag)
            if not np.isin(im[..., 3], (0, 255)).all():
                fails.append("%s has semi-transparent pixels" % tag)
            cs = colors(im)
            if len(cs) > 32:
                fails.append("%s uses %d colors (>32)" % (tag, len(cs)))
            allowed = {P.hex_rgb(c) for c in P.layer_palette(tod, rec["name"])}
            extra = cs - allowed
            if extra:
                fails.append("%s has %d off-palette colors" % (tag, len(extra)))
            scene |= cs
            if rec["tileX"]:
                ok, s, i = seam_ok(im)
                if not ok:
                    fails.append("%s seam mismatch %.3f vs interior %.3f" % (tag, s, i))
        print("%-7s scene colors: %d" % (tod, len(scene)))
        if len(scene) > 80:
            fails.append("%s scene has %d colors (>80)" % (tod, len(scene)))
        elif len(scene) > 64:
            warns.append("%s scene has %d colors (>64 target)" % (tod, len(scene)))
    sj = json.load(open(os.path.join(a.assets, "sprites.json")))
    sheet = np.asarray(Image.open(os.path.join(a.assets, sj["image"])).convert("RGBA"))
    if not np.isin(sheet[..., 3], (0, 255)).all():
        fails.append("sprites.png semi-transparent")
    for n, r in sj["frames"].items():
        if r["x"] + r["w"] > sheet.shape[1] or r["y"] + r["h"] > sheet.shape[0]:
            fails.append("atlas frame %s out of bounds" % n)
        if len(colors(sheet[r["y"] : r["y"] + r["h"], r["x"] : r["x"] + r["w"]])) > 15:
            fails.append("sprite frame %s >15 colors" % n)
    for w in warns:
        print("WARN", w)
    for f in fails:
        print("FAIL", f)
    print("check:", "FAILED" if fails else "ok")
    sys.exit(1 if fails else 0)


main()
