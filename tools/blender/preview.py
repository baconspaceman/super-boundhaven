"""Composite previews of the generated Golden Hour backgrounds (system python: Pillow).

  python preview.py --assets <packages/art/assets/blender> [--scroll 0] [--wide]

Writes preview_<tod>.png (256x224 window at 3x, all layers stacked + mock meadow ground strip so legibility is
judged against real-ish tiles) and preview_timeofday.png (4-scene contact sheet). With --wide also writes
wide_<tod>.png (full 768px strip, 2x) into --work for seam review.
"""
import argparse
import json
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import palettes as P  # noqa: E402

GROUND_TOP = 184  # screen y of the mock grass lip
MEADOW = dict(g1="#dcf56c", g2="#86d85a", g3="#38a04c", g4="#1c5a58", a="#eaa870", b="#bc7448", c="#7c4850", d="#472f52")


def hexc(h):
    return tuple(int(h.lstrip("#")[i : i + 2], 16) for i in (0, 2, 4)) + (255,)


def mock_ground(w=256, h=224, top=GROUND_TOP):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for x in range(0, w, 16):  # tile columns
        d.rectangle([x, top, x + 15, h], fill=hexc(MEADOW["b"]))
        for k in range(0, 16, 5):
            d.point((x + (k * 7) % 16, top + 10 + (k * 3) % 18), fill=hexc(MEADOW["a"]))
            d.point((x + (k * 5 + 3) % 16, top + 22 + (k * 2) % 10), fill=hexc(MEADOW["c"]))
    d.rectangle([0, top, w, top + 3], fill=hexc(MEADOW["g2"]))
    d.rectangle([0, top, w, top], fill=hexc(MEADOW["g1"]))
    d.rectangle([0, top + 4, w, top + 5], fill=hexc(MEADOW["g4"]))
    # floating semisolid platform + a block row
    d.rectangle([150, 140, 197, 147], fill=hexc(MEADOW["b"]))
    d.rectangle([150, 138, 197, 141], fill=hexc(MEADOW["g2"]))
    d.rectangle([150, 138, 197, 138], fill=hexc(MEADOW["g1"]))
    d.rectangle([150, 148, 197, 149], fill=hexc(MEADOW["c"]))
    return im


def layer_image(assets, rec, scroll, frame_w=256):
    im = Image.open(os.path.join(assets, rec["file"])).convert("RGBA")
    out = Image.new("RGBA", (frame_w, P.H), (0, 0, 0, 0))
    ox = -int(round(scroll * rec["parallax"]))
    w = im.width
    if rec["tileX"]:
        x = ox % w - w
        while x < frame_w:
            out.alpha_composite(im, (x, rec["y"]))
            x += w
    else:
        out.alpha_composite(im, (ox, rec["y"]))
    return out


def compose(assets, meta, tod, scroll=0, ground=True, frame_w=256):
    base = Image.new("RGBA", (frame_w, P.H), (0, 0, 0, 255))
    for rec in meta[tod]:
        base.alpha_composite(layer_image(assets, rec, scroll, frame_w))
    if ground:
        base.alpha_composite(mock_ground(frame_w))
    return base


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--assets", required=True)
    ap.add_argument("--work", default=None)
    ap.add_argument("--scroll", type=int, default=0)
    ap.add_argument("--wide", action="store_true")
    ap.add_argument("--sprites", action="store_true")
    ap.add_argument("--tods", default=",".join(P.TODS))
    a = ap.parse_args()
    if a.sprites:
        sprite_preview(a.assets)
    meta = json.load(open(os.path.join(a.assets, "bg_manifest.json")))
    tods = [t for t in a.tods.split(",") if t in meta]
    sheets = {}
    for tod in tods:
        im = compose(a.assets, meta, tod, a.scroll)
        sheets[tod] = im
        im.resize((im.width * 3, im.height * 3), Image.NEAREST).convert("RGB").save(os.path.join(a.assets, "preview_%s.png" % tod))
        if a.wide and a.work:
            w = compose(a.assets, meta, tod, 0, ground=True, frame_w=768)
            w.resize((w.width * 2, w.height * 2), Image.NEAREST).convert("RGB").save(os.path.join(a.work, "wide_%s.png" % tod))
    if len(sheets) == 4:
        cell = 256 * 2
        ch = 224 * 2
        sheet = Image.new("RGB", (cell * 2 + 4, ch * 2 + 4), (12, 12, 20))
        for i, t in enumerate(P.TODS):
            sheet.paste(sheets[t].resize((cell, ch), Image.NEAREST).convert("RGB"), ((i % 2) * (cell + 4), (i // 2) * (ch + 4)))
        sheet.save(os.path.join(a.assets, "preview_timeofday.png"))




def sprite_preview(assets, scale=3):
    """preview_sprites.png: every sprite (frame 0 + all anim frames in a row) on a meadow-blue backdrop."""
    js = json.load(open(os.path.join(assets, "sprites.json")))
    sheet = Image.open(os.path.join(assets, js["image"])).convert("RGBA")
    rows = []
    for name, sp in js["sprites"].items():
        ims = []
        for fn in sp["frames"]:
            r = js["frames"][fn]
            ims.append(sheet.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"])))
        rows.append((name, ims))
    W_ = 760
    x = y = rh = 0
    pos = []
    for name, ims in rows:
        w = sum(i.width + 3 for i in ims) + 6
        h = max(i.height for i in ims) + 6
        if x + w > W_:
            x, y, rh = 0, y + rh, 0
        pos.append((x, y, ims))
        x += w
        rh = max(rh, h)
    out = Image.new("RGBA", (W_, y + rh), (150, 200, 245, 255))
    for x, y, ims in pos:
        cx = x + 3
        for im in ims:
            out.alpha_composite(im, (cx, y + 3))
            cx += im.width + 3
    out = out.resize((out.width * scale, out.height * scale), Image.NEAREST).convert("RGB")
    out.save(os.path.join(assets, "preview_sprites.png"))



if __name__ == "__main__":
    main()
