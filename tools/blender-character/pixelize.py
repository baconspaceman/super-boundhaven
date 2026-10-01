"""SBH character spike: data-pass PNGs -> palette-indexed 24x32 layer frames -> composites + contact sheets.

  python pixelize.py --raw _raw --out ../../packages/art/assets/blender-characters [--method mode|center]

Pipeline per (anim, frame, layer):
  1. downscale 4x supersampled data passes to native (mode slot / mean depth+normal over covered samples)
  2. toon-band the normal against ONE shared light -> 3 bands
  3. map (slot, band) -> global palette index (see PAL_INDEX)
  4. cleanup: orphan alpha pixels, single-pixel band noise
  5. per-layer 1px outline (hue-matched dark, index 4 or 10)
  6. composite layers by depth (truth) or by fixed draw order (runtime-friendly), recolor via LUT
"""
import argparse
import colorsys
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument("--raw", default="_raw")
ap.add_argument("--out", default="../../packages/art/assets/blender-characters")
ap.add_argument("--method", default="mode")
ap.add_argument("--scale", type=int, default=4)
ARGS = ap.parse_args()
RAW, OUT, S = Path(ARGS.raw), Path(ARGS.out), ARGS.scale
OUT.mkdir(parents=True, exist_ok=True)

W, H = 24, 32
LAYER_ORDER = ["cape", "hair_back", "body_far", "outfit_far", "body", "outfit", "face", "hair_front", "body_near", "outfit_near"]
SLOT_NAMES = {1: "skin", 2: "hair", 3: "primary", 4: "secondary", 5: "accent", 6: "eye"}

# --------------------------------------------------------------- palette (15 colours, index 0 = transparent)
# slot -> band(0 light,1 base,2 shade) -> palette index. Two-tone slots fold light into base.
PAL_INDEX = {
    1: [1, 2, 3], 2: [5, 5, 6], 3: [7, 8, 9], 4: [11, 11, 12], 5: [13, 13, 14], 6: [15, 15, 15],
}
LINE_OF_SLOT = {1: 4, 2: 4, 3: 10, 4: 4, 5: 4, 6: 4}  # 4 = warm line, 10 = cool line (primary)
DEFAULT_LIGHT = np.array([-0.45, -0.60, 0.66]); DEFAULT_LIGHT /= np.linalg.norm(DEFAULT_LIGHT)  # upper-left-front
B0, B1 = 0.50, -0.05  # lambert thresholds: >=B0 light, >=B1 base, else shade


def hsl(h, s, l):
    r, g, b = colorsys.hls_to_rgb((h % 360) / 360, min(1, max(0, l)), min(1, max(0, s)))
    return (round(r * 255), round(g * 255), round(b * 255))


def towards(h, target, f):
    d = ((target - h + 540) % 360) - 180
    return (h + d * f) % 360


def ramp3(h, s, l):  # port of packages/art/src/characters/pal.ts ramp3: highlights warm, shadows cool
    return [hsl(towards(h, 55, 0.14), s * 0.9, l + 0.12), hsl(h, s, l), hsl(towards(h, 268, 0.14), s * 0.96, l - 0.22)]


def line_col(h, s, l):
    return hsl(towards(h, 268, 0.30), min(1, s * 0.55), max(0.12, min(l - 0.30, 0.26)))


def make_palette(look):
    """look: dict slot-name -> (h,s,l). Returns (16,3) uint8 LUT indexed by PAL_INDEX values."""
    lut = np.zeros((16, 3), np.uint8)
    sk = ramp3(*look["skin"]); lut[1], lut[2], lut[3] = sk
    lut[4] = line_col(*look["skin"])
    hr = ramp3(*look["hair"]); lut[5], lut[6] = hr[1], hr[2]
    pr = ramp3(*look["primary"]); lut[7], lut[8], lut[9] = pr
    lut[10] = line_col(*look["primary"])
    se = ramp3(*look["secondary"]); lut[11], lut[12] = se[1], se[2]
    ac = ramp3(*look["accent"]); lut[13], lut[14] = ac[1], ac[2]
    lut[15] = (34, 24, 48)  # eye: constant, reads on every skin
    return lut


LOOK_A = {"skin": (24, 0.62, 0.74), "hair": (22, 0.55, 0.36), "primary": (176, 0.52, 0.46), "secondary": (28, 0.45, 0.32), "accent": (46, 0.88, 0.56)}
LOOK_B = {"skin": (20, 0.45, 0.42), "hair": (52, 0.75, 0.62), "primary": (292, 0.45, 0.50), "secondary": (210, 0.35, 0.30), "accent": (8, 0.80, 0.52)}
LOOK_C = {"skin": (30, 0.70, 0.80), "hair": (330, 0.65, 0.55), "primary": (8, 0.70, 0.52), "secondary": (250, 0.30, 0.28), "accent": (170, 0.55, 0.55)}

# --------------------------------------------------------------- stage 1: downscale passes
def load_pass(anim, i, layer):
    d = np.asarray(Image.open(RAW / f"{anim}_{i:02d}_{layer}_data.png").convert("RGBA")).astype(np.float32)
    n = np.asarray(Image.open(RAW / f"{anim}_{i:02d}_{layer}_nrm.png").convert("RGBA")).astype(np.float32)
    def blocks(a):
        return a.reshape(H, S, W, S, 4).transpose(0, 2, 1, 3, 4).reshape(H, W, S * S, 4)
    return blocks(d), blocks(n)


def downscale(d, n, method=ARGS.method):
    if method == "center":  # nearest: what you get rendering natively at 24x32 with pixel-centre sampling
        k = (S // 2) * S + (S // 2)
        dc, nc = d[:, :, k, :], n[:, :, k, :]
        alpha = dc[..., 3] > 127
        slot = np.rint(dc[..., 1] / 255 * 16).astype(int) * alpha
        depth = dc[..., 0] / 255
        nrm = nc[..., :3] / 255 * 2 - 1
    else:  # "mode": majority slot among covered samples, mean depth/normal of those samples
        cov = d[..., 3] > 127
        alpha = cov.mean(-1) >= 0.5
        slots = np.rint(d[..., 1] / 255 * 16).astype(int)
        counts = np.stack([((slots == k) & cov).sum(-1) for k in range(1, 7)], -1)
        slot = (counts.argmax(-1) + 1) * alpha
        same = (slots == slot[..., None]) & cov
        w = np.maximum(same.sum(-1), 1)[..., None]
        depth = (d[..., 0] * same).sum(-1) / w[..., 0] / 255
        nrm = ((n[..., :3] / 255 * 2 - 1) * same[..., None]).sum(2) / w
    ln = np.linalg.norm(nrm, axis=-1, keepdims=True)
    nrm = nrm / np.maximum(ln, 1e-6)
    return alpha, slot.astype(int), depth, nrm


# --------------------------------------------------------------- stage 2-3: toon band + palette index
def shade_bands(nrm, light=DEFAULT_LIGHT):
    lam = nrm @ light
    return np.where(lam >= B0, 0, np.where(lam >= B1, 1, 2))


def to_index(alpha, slot, band):
    idx = np.zeros((H, W), np.uint8)
    for sl, tbl in PAL_INDEX.items():
        m = alpha & (slot == sl)
        for b in range(3):
            idx[m & (band == b)] = tbl[b]
    return idx


# --------------------------------------------------------------- stage 4: cleanup
def nb4(a, fill=0):
    p = np.pad(a, 1, constant_values=fill)
    return p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]  # up, down, left, right


def cleanup(idx):
    idx = idx.copy()
    # orphan opaque pixels (no 4-neighbour opaque) -> delete
    up, dn, lf, rt = nb4(idx)
    orphan = (idx > 0) & ((up == 0) & (dn == 0) & (lf == 0) & (rt == 0))
    idx[orphan] = 0
    # single-pixel holes (>=3 opaque 4-neighbours) -> fill with most common neighbour
    up, dn, lf, rt = nb4(idx)
    cnt = (up > 0).astype(int) + (dn > 0) + (lf > 0) + (rt > 0)
    hole = (idx == 0) & (cnt >= 3)
    for y, x in zip(*np.nonzero(hole)):
        vals = [v[y, x] for v in (up, dn, lf, rt) if v[y, x] > 0]
        idx[y, x] = max(set(vals), key=vals.count)
    # band noise: a pixel whose 4 neighbours all share another index of the SAME slot group -> adopt it
    up, dn, lf, rt = nb4(idx)
    grp = group_of(idx)
    agree = (up == dn) & (dn == lf) & (lf == rt) & (up != idx) & (up > 0) & (group_of(up) == grp)
    idx[agree] = up[agree]
    # 3-of-4 agreement on a vertical or horizontal stripe of 1px wrapped by same group
    return idx


GROUP = np.zeros(16, int)
for sl, tbl in PAL_INDEX.items():
    for v in tbl:
        GROUP[v] = sl
GROUP[4] = GROUP[10] = 0


def group_of(a):
    return GROUP[a]


# --------------------------------------------------------------- stage 5: outline per layer
def outline(idx, depth):
    """1px outside outline. colour = line index of the adjacent slot; depth copied from neighbour so
    the outline sorts with its own layer but is hidden by anything nearer."""
    out, od = idx.copy(), depth.copy()
    up, dn, lf, rt = nb4(idx)
    dup, ddn, dlf, drt = nb4(depth, 1.0)
    lines = np.array([0, *[LINE_OF_SLOT[GROUP[i]] if GROUP[i] else 0 for i in range(1, 16)]])
    empty = idx == 0
    for nb, dnb in ((dn, ddn), (rt, drt), (up, dup), (lf, dlf)):  # below/right first = shadow-side preference
        m = empty & (out == 0) & (nb > 0) & (nb < 16)
        out[m] = lines[nb[m]]
        od[m] = dnb[m]
    return out, od


# --------------------------------------------------------------- stage 6: composite
def composite_depth(layers):
    """layers: list of (idx, depth). Nearest (smallest depth) wins, later layer wins ties."""
    n = len(layers)
    D = np.stack([np.where(i > 0, d - k * 1e-5, np.inf) for k, (i, d) in enumerate(layers)])
    I = np.stack([i for i, _ in layers])
    win = D.argmin(0)
    out = np.take_along_axis(I, win[None], 0)[0]
    out[np.isinf(D.min(0))] = 0
    return out


def composite_full(layers):
    """Depth composite that also returns the winning depth and layer id (for inner lines)."""
    D = np.stack([np.where(i > 0, d - k * 1e-5, np.inf) for k, (i, d) in enumerate(layers)])
    I = np.stack([i for i, _ in layers])
    win = D.argmin(0)
    out = np.take_along_axis(I, win[None], 0)[0]
    dep = D.min(0)
    empty = np.isinf(dep)
    out[empty] = 0
    dep[empty] = 1.0
    win = np.where(empty, -1, win)
    return out, dep, win


NEAR_LAYERS = [LAYER_ORDER.index('body_near'), LAYER_ORDER.index('outfit_near')]


def compose_outline(idx, dep, lid, inner_gap=0.04):
    """Outline ONCE on the composited image (this is the 'bake per look' step):
    outer 1px silhouette line + inner 1px line on the FAR pixel wherever a different layer is nearer by > inner_gap."""
    out = idx.copy()
    lines = np.array([0, *[LINE_OF_SLOT[GROUP[i]] if GROUP[i] else 0 for i in range(1, 16)]])
    # inner lines first (only on opaque far pixels)
    up_i, dn_i, lf_i, rt_i = nb4(idx)
    up_d, dn_d, lf_d, rt_d = nb4(dep, 1.0)
    up_l, dn_l, lf_l, rt_l = nb4(lid, -1)
    inner = np.zeros(idx.shape, bool)
    for ni, nd, nl in ((dn_i, dn_d, dn_l), (rt_i, rt_d, rt_l), (up_i, up_d, up_l), (lf_i, lf_d, lf_l)):
        inner |= (idx > 0) & (ni > 0) & (nl != lid) & np.isin(nl, NEAR_LAYERS) & (nd < dep - inner_gap) & (idx < 16)
    out[inner] = lines[idx[inner]]
    # outer silhouette
    up, dn, lf, rt = nb4(idx)
    empty = idx == 0
    for nb in (dn, rt, up, lf):
        m = empty & (out == 0) & (nb > 0)
        out[m] = lines[nb[m]]
    return out


def composite_fixed(layers):
    out = np.zeros((H, W), np.uint8)
    for idx, _ in layers:
        out = np.where(idx > 0, idx, out)
    return out


def colorize(idx, lut):
    rgba = np.zeros((H, W, 4), np.uint8)
    m = idx > 0
    rgba[m, :3] = lut[idx[m]]
    rgba[m, 3] = 255
    return rgba


def up(img_arr, k):
    return Image.fromarray(img_arr).resize((img_arr.shape[1] * k, img_arr.shape[0] * k), Image.NEAREST)


# --------------------------------------------------------------- run
def process(anim, i, do_cleanup=True, do_outline=False, layers=LAYER_ORDER, method=None):
    res = {}
    for ly in layers + ["all"]:
        d, n = load_pass(anim, i, ly)
        al, sl, dp, nr = downscale(d, n, method or ARGS.method)
        idx = to_index(al, sl, shade_bands(nr))
        dp = np.where(idx > 0, dp, 1.0)
        if do_cleanup:
            idx = cleanup(idx)
        if do_outline:
            idx, dp = outline(idx, dp)
        res[ly] = (idx, dp)
    return res


def label_sheet(rows, col_labels, row_labels, k, bg=(74, 86, 110), pad=2):
    """rows: list[list[rgba array]] -> PIL image with labels."""
    cw, ch = W * k + pad, H * k + pad
    lab_w = 92
    img = Image.new("RGBA", (lab_w + cw * len(rows[0]) + pad, 14 + ch * len(rows) + pad), bg + (255,))
    dr = ImageDraw.Draw(img)
    for c, t in enumerate(col_labels):
        dr.text((lab_w + c * cw + 2, 1), t, fill=(240, 240, 240, 255))
    for r, row in enumerate(rows):
        dr.text((3, 14 + r * ch + H * k // 2 - 5), row_labels[r], fill=(240, 240, 240, 255))
        for c, a in enumerate(row):
            tile = Image.fromarray(a)
            tile = tile.resize((W * k, H * k), Image.NEAREST)
            # ground line for eyeballing foot-lock
            img.alpha_composite(tile, (lab_w + c * cw + pad, 14 + r * ch + pad))
    return img


if __name__ == "__main__":
    lutA, lutB, lutC = (make_palette(l) for l in (LOOK_A, LOOK_B, LOOK_C))
    report = {}
    t0 = time.time()
    run = [process("run", i) for i in range(6)]
    idle = [process("idle", i) for i in range(4)]
    dt = (time.time() - t0) / 10
    report["pixelize_s_per_frame_all_layers"] = round(dt, 3)

    # --- 1. layer sheet (run): each layer separately, alpha preview, plus composite row
    rows = []
    names = []
    for ly in LAYER_ORDER:
        rows.append([colorize(run[i][ly][0], lutA) for i in range(6)])
        names.append(ly)
    def baked(res):
        i_, d_, l_ = composite_full([res[ly] for ly in LAYER_ORDER])
        return compose_outline(i_, d_, l_)
    comp_depth = [baked(run[i]) for i in range(6)]
    rows.append([colorize(c, lutA) for c in comp_depth]); names.append("COMPOSITE")
    label_sheet(rows, [f"run {i}" for i in range(6)], names, 4).save(OUT / "poc_run_layers.png")

    # --- 2. composited 4x: look A/B/C recolor of the run + idle, and the un-layered 'all' render
    crow = []
    crn = []
    for nm, lut in (("look A", lutA), ("look B recolor", lutB), ("look C recolor", lutC)):
        crow.append([colorize(c, lut) for c in comp_depth]); crn.append(nm)
    crow.append([colorize(compose_outline(run[i]["all"][0], run[i]["all"][1], np.where(run[i]["all"][0] > 0, 0, -1)), lutA) for i in range(6)]); crn.append("single-render ref")
    idle_depth = [baked(idle[i]) for i in range(4)]
    big = label_sheet(crow, [f"run {i}" for i in range(6)], crn, 6)
    idl = label_sheet([[colorize(c, lutA) for c in idle_depth], [colorize(c, lutC) for c in idle_depth]], [f"idle {i}" for i in range(4)], ["idle A", "idle C"], 6)
    canvas = Image.new("RGBA", (max(big.width, idl.width), big.height + idl.height + 4), (74, 86, 110, 255))
    canvas.alpha_composite(big, (0, 0)); canvas.alpha_composite(idl, (0, big.height + 4))
    canvas.save(OUT / "poc_composited_4x.png")  # (file name kept from brief; drawn at 6x for legibility)

    # --- 3. metrics: layered composite vs baked reference; fixed order vs depth order
    raw_run = [process("run", i, do_cleanup=False) for i in range(6)]
    diff_layer_vs_all = []
    diff_fixed_vs_depth = []
    for i in range(6):
        cd = composite_depth([raw_run[i][ly] for ly in LAYER_ORDER])
        ref = raw_run[i]["all"][0]
        diff_layer_vs_all.append(int((cd != ref).sum()))
        cf = composite_fixed([raw_run[i][ly] for ly in LAYER_ORDER])
        diff_fixed_vs_depth.append(int((cf != cd).sum()))
    report["layers_vs_baked_all_px_diff_per_frame"] = diff_layer_vs_all
    report["fixed_order_vs_depth_order_px_diff_per_frame"] = diff_fixed_vs_depth
    # outlined/cleaned composite vs outlined/cleaned all
    od = []
    for i in range(6):
        od.append(int((composite_full([run[i][ly] for ly in LAYER_ORDER])[0] != run[i]["all"][0]).sum()))
    report["cleaned_layers_vs_all_px_diff_before_outline"] = od
    report["opaque_px_run0"] = int((comp_depth[0] > 0).sum())
    report["colors_used_default_look_all_frames"] = int(len(set(np.concatenate([c[c > 0].ravel() for c in comp_depth]).tolist())))
    report["per_layer_colors_max"] = max(len(set(run[i][ly][0][run[i][ly][0] > 0].tolist())) for i in range(6) for ly in LAYER_ORDER)

    # --- 4. downscale method + cleanup comparison on run frame 2
    variants = []
    vn = []
    for nm, kw, ol in (("center, no clean", dict(method="center", do_cleanup=False), False),
                       ("mode, no clean", dict(method="mode", do_cleanup=False), False),
                       ("mode + clean", dict(method="mode", do_cleanup=True), False),
                       ("mode+clean+outline", dict(method="mode", do_cleanup=True), True)):
        r = [process("run", i, **kw) for i in (0, 2, 4)]
        variants.append([colorize(baked(x) if ol else composite_depth([x[ly] for ly in LAYER_ORDER]), lutA) for x in r]); vn.append(nm)
    label_sheet(variants, ["run 0", "run 2", "run 4"], vn, 8).save(OUT / "poc_method_compare.png")

    # --- 5. atlas cost estimate: one look, 10 layers x (6 run+4 idle) frames
    report["frames_per_layer"] = 10
    report["layer_atlas_px_per_layer"] = f"{W*10}x{H} = {W*10*H} px"
    for k, v in report.items():
        print(f"{k}: {v}")

    # --- 6. side-by-side with the hand-authored hero preview (read-only reference)
    ref = OUT.parent / "characters_preview_hero.png"
    if ref.exists():
        src = Image.open(ref).convert("RGBA")
        # tiles in the preview are ~108px wide / ~136px tall; crop run_0 (col 10,row 0) and run_2 (col 2,row 1), idle_0
        tw, th = 108.5, 154
        crops = [src.crop((int(c * tw) + 2, 14 + int(r * th) - (2 if r else 0), int((c + 1) * tw) - 2, 14 + int(r * th) + 136)) for c, r in ((0, 0), (10, 0), (2, 1))]
        mine = [Image.fromarray(colorize(baked(run[i]), lutA)).resize((W * 5, H * 5), Image.NEAREST) for i in (0, 2, 4)]
        cw = max(max(c.width for c in crops), W * 5) + 8
        cmp_img = Image.new("RGBA", (cw * 3, 136 + 140 + 24), (74, 86, 110, 255))
        d2 = ImageDraw.Draw(cmp_img)
        d2.text((4, 2), "hand-authored hero (packages/art/src/characters)", fill=(240, 240, 240, 255))
        d2.text((4, 140), "Blender->2D spike (same 24x32 frame, ~same zoom)", fill=(240, 240, 240, 255))
        for k, c in enumerate(crops):
            cmp_img.alpha_composite(c, (k * cw, 14))
        for k, m in enumerate(mine):
            cmp_img.alpha_composite(m, (k * cw + 10, 154))
        cmp_img.save(OUT / "poc_vs_handmade.png")
