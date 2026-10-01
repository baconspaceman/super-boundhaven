"""Blender renders -> authentic 16-bit-style pixel art (system python: Pillow + numpy).

  python pixelize.py --work <dir of raw renders> --out <assets dir> [--tods sunset,day,...] [--layers ...]

Per layer, in order:
  * snap/vote: nearest hand-picked palette color at high-res, then a majority vote per native pixel
    (flat layers) -- NOT an area average -- so shapes stay chunky and never invent muddy in-between colors.
  * sky/halo layers: smooth render -> position along the hue-shifted palette ramp -> ordered (Bayer 4x4)
    dither with a compressed zone, so bands have short checkerboard transitions like hand dithering.
  * cleanup: orphan pixels, jaggy notches (tile-aware, wraps in x).
  * optional haze (Bayer-dithered fade toward the haze color), inner sel-out outline (darker hue-matched
    color on shadow/bottom edges, none/lighter on lit edges).
  * hard alpha (no semi-transparent pixels), crop empty rows, write PNG + placement record (y offset).
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

BAYER4 = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32) + 0.5) / 16.0


def bayer(h, w):
    return np.tile(BAYER4, (h // 4 + 1, w // 4 + 1))[:h, :w]


def hex_arr(hexes):
    return np.array([P.hex_rgb(h) for h in hexes], dtype=np.int32)


# ------------------------------------------------------------------ color helpers
def rgb_to_lab(rgb):
    a = rgb.astype(np.float64) / 255.0
    a = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = a @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def nearest_index(rgb, pal):
    """rgb (...,3) uint8 -> index of nearest palette color (weighted RGB distance)."""
    flat = rgb.reshape(-1, 3).astype(np.int32)
    best = np.full(flat.shape[0], 1 << 30, dtype=np.int64)
    arg = np.zeros(flat.shape[0], dtype=np.int32)
    wts = np.array([2, 4, 3])
    for k, c in enumerate(pal):
        d = (((flat - c) ** 2) * wts).sum(1)
        m = d < best
        best[m] = d[m]
        arg[m] = k
    return arg.reshape(rgb.shape[:-1])


def darker_map(pal, dl=6.0):
    """for each palette color, the closest-hue palette color that is darker (itself if none)."""
    lab = rgb_to_lab(pal)
    out = []
    for i in range(len(pal)):
        cand = [j for j in range(len(pal)) if lab[j, 0] < lab[i, 0] - dl]
        if not cand:
            out.append(i)
            continue
        sc = [np.hypot(*(lab[j, 1:] - lab[i, 1:])) + 0.35 * abs(lab[j, 0] - (lab[i, 0] - 14)) for j in cand]
        out.append(cand[int(np.argmin(sc))])
    return np.array(out)


def lighter_map(pal, dl=6.0):
    lab = rgb_to_lab(pal)
    out = []
    for i in range(len(pal)):
        cand = [j for j in range(len(pal)) if lab[j, 0] > lab[i, 0] + dl]
        if not cand:
            out.append(i)
            continue
        sc = [np.hypot(*(lab[j, 1:] - lab[i, 1:])) + 0.35 * abs(lab[j, 0] - (lab[i, 0] + 14)) for j in cand]
        out.append(cand[int(np.argmin(sc))])
    return np.array(out)


# ------------------------------------------------------------------ core ops
def load(path):
    return np.asarray(Image.open(path).convert("RGBA"))


def area_mean(a, S):
    h, w = a.shape[:2]
    return a.reshape(h // S, S, w // S, S, *a.shape[2:]).mean(axis=(1, 3))


def vote(idx, S, npal, cov=0.5):
    """idx: (H,W) int with -1 = transparent. returns (h,w) idx with -1 for transparent."""
    h, w = idx.shape
    bh, bw = h // S, w // S
    blocks = idx.reshape(bh, S, bw, S).transpose(0, 2, 1, 3).reshape(bh, bw, S * S)
    opq = (blocks >= 0).mean(-1)
    counts = np.stack([(blocks == k).sum(-1) for k in range(npal)], -1)
    best = counts.argmax(-1).astype(np.int32)
    return np.where(opq >= cov, best, -1)


def neighbors(idx, wrap_x, dy_dx):
    out = []
    for dy, dx in dy_dx:
        a = np.roll(idx, (dy, dx), (0, 1))
        if not wrap_x:
            if dx > 0:
                a[:, :dx] = -1
            elif dx < 0:
                a[:, dx:] = -1
        if dy > 0:
            a[:dy, :] = -1
        elif dy < 0:
            a[dy:, :] = -1
        out.append(a)
    return out


N8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
N4 = [(-1, 0), (1, 0), (0, -1), (0, 1)]


def cleanup(idx, npal, wrap_x, protect=(), passes=2):
    idx = idx.copy()
    prot = np.isin(idx, list(protect)) if protect else np.zeros(idx.shape, bool)
    for _ in range(passes):
        nb8 = neighbors(idx, wrap_x, N8)
        same8 = sum((n == idx).astype(np.int32) for n in nb8)
        nb4 = neighbors(idx, wrap_x, N4)
        same4 = sum((n == idx).astype(np.int32) for n in nb4)
        orphan = (idx >= 0) & (same4 == 0) & (same8 <= 1) & ~prot
        if not orphan.any():
            break
        cnt = np.stack([sum((n == k).astype(np.int32) for n in nb8) for k in range(npal)], -1)
        maj = cnt.argmax(-1)
        has = cnt.max(-1) >= 3
        idx = np.where(orphan & has, maj, idx)
        # orphan transparent holes / specks (isolated opaque pixel surrounded by transparency)
        alone = (idx >= 0) & (same8 == 0) & ~prot
        idx = np.where(alone & ~has, -1, idx)
    return idx


def notch_fix(idx, npal, wrap_x, protect=()):
    """fill single-pixel notches: pixel whose left+right (or up+down) neighbors share a different color."""
    idx = idx.copy()
    l, r, u, d = neighbors(idx, wrap_x, [(0, 1), (0, -1), (1, 0), (-1, 0)])
    prot = np.isin(idx, list(protect)) if protect else np.zeros(idx.shape, bool)
    m = (idx >= 0) & (l == r) & (u == d) & (l >= 0) & (u >= 0) & (l == u) & (l != idx) & ~prot
    return np.where(m, l, idx)


def fog(idx, npal, haze_i, y0, y1, k, dither_k=1.3):
    """Bayer-dithered fade toward the haze palette color between rows y0 (none) and y1 (full k)."""
    h, w = idx.shape
    yy = np.arange(h)[:, None].astype(np.float32)
    p = np.clip((yy - y0) / max(1.0, (y1 - y0)), 0, 1) * k
    p = np.floor(p * 4) / 4  # flat 25%/50% patterns, not a smooth gradient
    thr = bayer(h, w)
    m = (idx >= 0) & (p > thr)
    return np.where(m, haze_i, idx)


def outline_inner(idx, pal, wrap_x, dark, light, lit_dirs=((1, 0), (0, 1)), skip=()):
    """sel-out: edge pixels (4-neighbor transparent) step one tone darker, except on the lit (upper-left)
    side where they step lighter (a thin rim) -- hue-matched because dark/light come from palette neighbors."""
    out = idx.copy()
    for (dy, dx) in N4:
        nb = neighbors(idx, wrap_x, [(dy, dx)])[0]  # value of the pixel at offset (-dy,-dx)... roll semantic
        # np.roll by (dy,dx) brings the pixel from (y-dy,x-dx) to (y,x): nb holds the neighbor on the (-dy,-dx) side
        edge = (idx >= 0) & (nb < 0)
        if dy > 0:
            edge[:dy, :] = False
        elif dy < 0:
            edge[dy:, :] = False
        if not wrap_x:
            if dx > 0:
                edge[:, :dx] = False
            elif dx < 0:
                edge[:, dx:] = False
        lit = (dy, dx) in lit_dirs  # neighbor is above/left when roll goes down/right => side is lit
        sel = edge & ~np.isin(idx, list(skip))
        if lit:
            out = np.where(sel & (out == idx), light[np.maximum(idx, 0)], out)
        else:
            out = np.where(sel, dark[np.maximum(idx, 0)], out)
    return out


def to_rgba(idx, pal):
    h, w = idx.shape
    out = np.zeros((h, w, 4), np.uint8)
    m = idx >= 0
    out[m, :3] = pal[idx[m]]
    out[m, 3] = 255
    return out


def crop_rows(rgba):
    a = rgba[..., 3] > 0
    rows = np.where(a.any(1))[0]
    if len(rows) == 0:
        return rgba[:1], 0
    y0, y1 = rows[0], rows[-1] + 1
    return rgba[y0:y1], int(y0)


# ------------------------------------------------------------------ layer processors
def proc_sky(img, S, pal_hex, cfg):
    pal = hex_arr(pal_hex)
    rgb = area_mean(img[..., :3].astype(np.float32), S)
    h, w = rgb.shape[:2]
    n = len(cfg["ramp"])
    R = pal[:n].astype(np.float32)
    flat = rgb.reshape(-1, 3)
    best = np.full(flat.shape[0], 1e18, np.float32)
    pos = np.zeros(flat.shape[0], np.float32)
    for i in range(n - 1):
        a, b = R[i], R[i + 1]
        ab = b - a
        t = np.clip(((flat - a) @ ab) / max(1e-6, float(ab @ ab)), 0, 1)
        d = ((flat - (a + t[:, None] * ab)) ** 2).sum(1)
        m = d < best
        best[m] = d[m]
        pos[m] = i + t[m]
    pos = pos.reshape(h, w)
    base = np.floor(pos).astype(np.int32)
    frac = pos - base
    k = cfg.get("dither", 1.6)
    f2 = np.clip((frac - 0.5) * k + 0.5, 0, 1)
    f2 = np.where(frac < 0.5 - 0.5 / k, 0, f2)
    up = f2 > bayer(h, w)
    idx = np.clip(base + up.astype(np.int32), 0, n - 1)
    return idx  # indices into ramp (== first n palette entries)


def proc_flat(img, S, npal_idx, pal, cov, wrap_x, protect, passes=2):
    rgb = img[..., :3]
    a = img[..., 3]
    idx = nearest_index(rgb, pal)
    idx = np.where(a >= 128, idx, -1)
    v = vote(idx, S, len(pal), cov)
    v = cleanup(v, len(pal), wrap_x, protect, passes)
    v = notch_fix(v, len(pal), wrap_x, protect)
    return v


def proc_glow(img, S, pal, levels=4, k=1.0):
    """translucent glow -> quantized alpha (25% steps) -> Bayer dither; color snapped to palette."""
    a = area_mean(img[..., 3].astype(np.float32) / 255.0, S)
    # colors weighted by alpha so AA edges do not darken
    w = img[..., 3:4].astype(np.float32) / 255.0
    rgbw = area_mean(img[..., :3].astype(np.float32) * w, S)
    aw = area_mean(w[..., 0], S)
    rgb = rgbw / np.maximum(aw[..., None], 1e-4)
    qa = np.round(a * levels) / levels
    h, wd = qa.shape
    on = qa > bayer(h, wd)
    idx = nearest_index(np.clip(rgb, 0, 255).astype(np.uint8), pal)
    return np.where(on, idx, -1)


# ------------------------------------------------------------------ per-layer config
def layer_cfg(tod, layer):
    T = P.TOD[tod]
    cfg = dict(cov=0.5, protect=(), passes=2, haze=None, outline=False)
    if layer == "mountains":
        cfg["haze"] = (T["mountains"]["haze"], 110, 165, min(0.5, T["mountains"].get("haze_k", 0.5)))  # rows (screen y)
    if layer == "ridges":
        cfg["haze"] = None
    if layer == "hills":
        cfg["outline"] = True
        cfg["cov"] = 0.45
    if layer == "fore":
        cfg["cov"] = 0.4
        cfg["passes"] = 1
    return cfg


def process_layer(tod, layer, work, S):
    T = P.TOD[tod]
    pal_hex = P.layer_palette(tod, layer)
    pal = hex_arr(pal_hex)
    wrap_x = P.TILE_X[layer]
    if layer == "sky":
        img = load(os.path.join(work, "%s_sky.png" % tod))
        idx = proc_sky(img, S, pal_hex, T["sky"])
        # stars (night): overlay exact-pixel stars rendered on their own
        rgba = to_rgba(idx, pal)
        if "stars" in T:
            st = load(os.path.join(work, "%s_sky_stars.png" % tod))
            sidx = proc_flat(st, S, None, hex_arr(T["stars"]), 0.5, False, (0, 1, 2), 0)
            sp = hex_arr(T["stars"])
            m = sidx >= 0
            rgba[m, :3] = sp[sidx[m]]
        return rgba
    if layer == "sun":
        g = load(os.path.join(work, "%s_sun_glow.png" % tod))
        s = load(os.path.join(work, "%s_sun.png" % tod))
        gi = proc_glow(g, S, pal)
        si = proc_flat(s, S, None, pal, 0.5, False, (), 1)
        idx = np.where(si >= 0, si, gi)
        return to_rgba(idx, pal)
    img = load(os.path.join(work, "%s_%s.png" % (tod, layer)))
    cfg = layer_cfg(tod, layer)
    pal_list = list(pal_hex)
    haze_i = None
    if cfg["haze"]:
        hz = cfg["haze"][0].lower()
        if hz not in pal_list:
            pal_list.append(hz)
        haze_i = pal_list.index(hz)
    palA = hex_arr(pal_list)
    idx = proc_flat(img, S, None, palA, cfg["cov"], wrap_x, cfg["protect"], cfg["passes"])
    if cfg["haze"]:
        _, y0, y1, k = cfg["haze"]
        # never dither the haze color itself onto pixels already haze-colored; fog only fades other colors
        idx = fog(idx, len(palA), haze_i, y0, y1, k)
    if cfg["outline"]:
        dk = darker_map(palA)
        lt = lighter_map(palA)
        idx = outline_inner(idx, palA, wrap_x, dk, lt, skip=())
    return to_rgba(idx, palA)


def write_layer(rgba, out, tod, layer, crop=True):
    if crop and layer not in ("sky", "sun"):
        rgba, y = crop_rows(rgba)
    else:
        y = 0
    path = os.path.join(out, "bg_%s_%s.png" % (tod, layer))
    Image.fromarray(rgba, "RGBA").save(path, optimize=True)
    return dict(name=layer, file="bg_%s_%s.png" % (tod, layer), parallax=P.PARALLAX[layer], y=y, tileX=P.TILE_X[layer], width=int(rgba.shape[1]), height=int(rgba.shape[0]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--tods", default=",".join(P.TODS))
    ap.add_argument("--layers", default=",".join(P.LAYERS))
    ap.add_argument("--scale", type=int, default=P.SCALE)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    meta = {}
    for tod in a.tods.split(","):
        meta[tod] = []
        for layer in a.layers.split(","):
            rgba = process_layer(tod, layer, a.work, a.scale)
            meta[tod].append(write_layer(rgba, a.out, tod, layer))
            print("pix", tod, layer, rgba.shape[1], "x", rgba.shape[0], flush=True)
    mp = os.path.join(a.out, "bg_manifest.json")
    old = {}
    if os.path.exists(mp):
        old = json.load(open(mp))
    for t, v in meta.items():
        d = {x["name"]: x for x in old.get(t, [])}
        for x in v:
            d[x["name"]] = x
        old[t] = [d[l] for l in P.LAYERS if l in d]
    json.dump(old, open(mp, "w"), indent=1)


if __name__ == "__main__":
    main()
