"""Pixelize + pack the pre-rendered sprite props (system python: Pillow + numpy).

  python pack_sprites.py --work <dir with spr_*.png> --out <assets/blender>

Per frame: palette snap + majority vote (<=15 colors/sprite), orphan cleanup, full hue-matched sel-out outline,
hard alpha. All frames of a sprite are cropped to a shared bbox (stable animation), anchor = ground point.
Output: sprites.png (shelf-packed sheet) + sprites.json (atlas + per-sprite frame lists / anchors / fps).
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pixelize as PZ  # noqa: E402
import sprite_defs as D  # noqa: E402
import palettes as P  # noqa: E402

S = 4


def sprite_palette(roles):
    pal, role_of, line_idx = [], {}, {}
    for r in roles:
        rd = D.ROLES[r]
        for c in rd["ramp"] + [rd["line"]]:
            c = c.lower()
            if c not in pal:
                pal.append(c)
            role_of.setdefault(c, r)
    for r in roles:
        line_idx[r] = pal.index(D.ROLES[r]["line"].lower())
    idx_line = np.array([line_idx[role_of[c]] for c in pal])
    return pal, idx_line


def outline_outer(idx, idx_line, lum):
    h, w = idx.shape
    out = idx.copy()
    best = np.full((h, w), 1e9)
    for (dy, dx) in PZ.N4:
        nb = np.roll(idx, (dy, dx), (0, 1))
        if dy > 0:
            nb[:dy, :] = -1
        elif dy < 0:
            nb[dy:, :] = -1
        if dx > 0:
            nb[:, :dx] = -1
        elif dx < 0:
            nb[:, dx:] = -1
        sel = (idx < 0) & (nb >= 0)
        li = idx_line[np.maximum(nb, 0)]
        ll = lum[li]
        upd = sel & (ll < best)
        out = np.where(upd, li, out)
        best = np.where(upd, ll, best)
    return out


def process(path, pal_hex, idx_line):
    pal = PZ.hex_arr(pal_hex)
    img = PZ.load(path)
    idx = PZ.nearest_index(img[..., :3], pal)
    idx = np.where(img[..., 3] >= 128, idx, -1)
    v = PZ.vote(idx, S, len(pal), 0.5)
    v = PZ.cleanup(v, len(pal), False, (), 2)
    v = PZ.notch_fix(v, len(pal), False)
    lum = PZ.rgb_to_lab(pal)[:, 0]
    v = outline_outer(v, idx_line, lum)
    return v


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    frames, meta = {}, {}
    for name, sd in D.SPRITES.items():
        pal_hex, idx_line = sprite_palette(sd["roles"])
        assert len(pal_hex) <= 15, (name, len(pal_hex))
        pal = PZ.hex_arr(pal_hex)
        idxs = [process(os.path.join(a.work, "spr_%s_%d.png" % (name, f)), pal_hex, idx_line) for f in range(sd["frames"])]
        occ = np.zeros(idxs[0].shape, bool)
        for v in idxs:
            occ |= v >= 0
        ys, xs = np.where(occ)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        w, h = sd["size"]
        gx, gz = sd["ground"]
        names = []
        for f, v in enumerate(idxs):
            rgba = PZ.to_rgba(v, pal)[y0:y1, x0:x1]
            nm = "%s_%d" % (name, f)
            frames[nm] = rgba
            names.append(nm)
        meta[name] = dict(frames=names, anchor=[int(gx - x0), int(h - gz - y0)], fps=sd["fps"], size=[int(x1 - x0), int(y1 - y0)], colors=len(pal_hex))
    # shelf pack
    order = list(frames)
    maxw, pad = 512, 1
    x = y = rowh = sw = 0
    atlas = {}
    for n in order:
        fh, fw = frames[n].shape[:2]
        if x + fw > maxw:
            x, y, rowh = 0, y + rowh + pad, 0
        atlas[n] = dict(x=x, y=y, w=fw, h=fh)
        x += fw + pad
        rowh = max(rowh, fh)
        sw = max(sw, x - pad)
    sheet = np.zeros((y + rowh, sw, 4), np.uint8)
    for n in order:
        r = atlas[n]
        sheet[r["y"] : r["y"] + r["h"], r["x"] : r["x"] + r["w"]] = frames[n]
    Image.fromarray(sheet, "RGBA").save(os.path.join(a.out, "sprites.png"), optimize=True)
    json.dump(dict(image="sprites.png", w=int(sw), h=int(y + rowh), frames=atlas, sprites=meta), open(os.path.join(a.out, "sprites.json"), "w"), indent=1)
    print("packed", len(order), "frames ->", sw, "x", y + rowh)


if __name__ == "__main__":
    main()
