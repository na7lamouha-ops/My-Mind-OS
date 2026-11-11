#!/usr/bin/env python3
"""كلاش 65/50 ↔ 50/65 · motion-graphics track (9:16 1080x1920, 30 fps, silent, 62.0 s).

The owner plays this file, records his face/voice over it, then the montage happens.
All motion + text lives in y 250 -> 1300 (x 60 -> 1020); y 1300 -> 1920 stays calm for his camera.

run from the repo root:
  python3 edprod/projects/2026-11-11-clash-65-50/render.py                         # full 62 s -> out/motion-full.mp4
  T0=0 T1=10 NAME=test-0-10 SHEET=0.5 python3 edprod/projects/2026-11-11-clash-65-50/render.py
env:  T0/T1 range in seconds · NAME output name · SHEET step (s) for preview frames + contact sheet
      WORKERS parallel chunks (default 4) · SHEET_ONLY=1 renders the stills/sheet without the video
"""
import math
import os
import re
import subprocess
import sys
import time
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as nd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "edprod", "tools", "lib"))
from edprod_kit import W, H, FPS, over, scaled, Encoder, clamp01, ease_out, ease_io  # noqa: E402

# =========================================================== DECISIONS (easy to change) ==
CTA_LINES = ["احفظ الفيديو…", "واحسب سلعتك"]   # owner's open question 1: no «علّق موصّل / نبعثلك»
PER_LEADS = "في كل 100 ليد"                     # open question 3: per 100 leads, keeping 32.5
GLASSES_GESTURE = False                          # open question 2: the gesture is the owner's, on camera
TAG_TEXT = "أرقام مثال · ecommanita"
TAG_T0, TAG_T1 = 29.0, 55.5
SHOW_CARD_LABELS = True                          # tiny «تأكيد / توصيل» under the 65/50 cards
DUR = 62.0
CRF = 14
CALM_Y = 1300                                    # below this: camera zone, background only

# =========================================================== palette ====================
RED = (255, 59, 59)
BLUE = (40, 215, 255)
GREEN = (43, 217, 107)
ORANGE = (255, 120, 20)
GREY = (150, 156, 165)
WHITE = (245, 246, 248)
YEL = (255, 210, 40)
GOLD = (255, 205, 90)
KRAFT = (196, 146, 92)
INK = (14, 18, 30)

OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)
FONTS = os.path.join(ROOT, "edprod", "assets", "course-kit", "fonts")
LOGO_PATH = os.path.join(ROOT, "edprod", "assets", "course-kit", "logos", "1-logo-ecommanita.png")
RAQM = ImageFont.Layout.RAQM


def f32(im): return np.asarray(im).astype(np.float32) / 255
def to_pil(a): return Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")
def lerp(a, b, m): return a + (b - a) * m
def lerpc(c1, c2, m): return tuple(int(round(lerp(x, y, m))) for x, y in zip(c1, c2))
def seg(t, a, b): return clamp01((t - a) / (b - a))


# =========================================================== fonts + text ===============
@lru_cache(None)
def tj(weight, size):
    return ImageFont.truetype(os.path.join(FONTS, f"Tajawal-{weight}.ttf"), size, layout_engine=RAQM)


@lru_cache(None)
def ar(weight, size):
    f = ImageFont.truetype(os.path.join(FONTS, "Archivo-VF.ttf"), size, layout_engine=RAQM)
    f.set_variation_by_name(weight)
    return f


LAT = re.compile(r"[A-Za-z0-9+\-][A-Za-z0-9,.%/+\-]*")
ARROW = "→"   # marker only, never rendered as a glyph: drawn as a shape pointing left (reading direction)
NUMK = 0.9    # Archivo digits look bigger than Tajawal letters at the same size


def tokens(s):
    out = []
    for p in re.split(f"({ARROW})", s):
        if p == ARROW:
            out.append(("arrow", None))
            continue
        pos = 0
        for m in LAT.finditer(p):
            pre = p[pos:m.start()].strip()
            if pre:
                out.append(("ar", pre))
            out.append(("num", m.group()))
            pos = m.end()
        if p[pos:].strip():
            out.append(("ar", p[pos:].strip()))
    return out


def arrow_img(w, h, col):
    """left-pointing arrow, anti-aliased (4x)."""
    ss = 4
    im = Image.new("RGBA", (w * ss, h * ss), (0, 0, 0, 0))
    W4, H4, c = w * ss, h * ss, h * ss / 2
    hw = H4 * 0.5
    sh = H4 * 0.15
    ImageDraw.Draw(im).polygon([(0, c), (hw * 1.1, c - hw), (hw * 1.1, c - sh), (W4, c - sh), (W4, c + sh),
                                (hw * 1.1, c + sh), (hw * 1.1, c + hw)], fill=tuple(col) + (255,))
    return f32(im.resize((w, h), Image.LANCZOS))


@lru_cache(None)
def rich(s, size, col=WHITE, weight="ExtraBold", ncol=None, nweight="ExtraBold", acol=None):
    """mixed Arabic (Tajawal/RAQM) + Latin numbers (Archivo) on one baseline, RTL order if Arabic.
    ncol: colour of number tokens (one colour or a tuple of colours in order). acol: arrow colour."""
    toks = tokens(s)
    rtl = any("؀" <= ch <= "ۿ" for ch in s)
    HH, BL = int(size * 1.6), int(size * 1.15)
    parts, ni = [], 0
    for kind, txt in toks:
        if kind == "arrow":
            a = arrow_img(int(size * 0.62), int(size * 0.44), acol or GOLD)
            im = np.zeros((HH, a.shape[1], 4), np.float32)
            y = int(BL - size * 0.30 - a.shape[0] / 2)
            im[y:y + a.shape[0]] = a
            parts.append(im)
            continue
        if kind == "num":
            fnt = ar(nweight, int(round(size * NUMK)))
            if ncol is None:
                c = col
            elif isinstance(ncol[0], (tuple, list)):
                c = ncol[min(ni, len(ncol) - 1)]
            else:
                c = ncol
            ni += 1
        else:
            fnt, c = tj(weight, size), col
        cw = int(len(txt) * size * 1.1 + 2 * size)
        im = Image.new("RGBA", (cw, HH), (0, 0, 0, 0))
        ImageDraw.Draw(im).text((size // 2, BL), txt, font=fnt, fill=tuple(c) + (255,), anchor="ls",
                                direction="rtl" if kind == "ar" else None)
        a = f32(im)
        cols = np.where(a[..., 3].max(0) > 0)[0]
        parts.append(a[:, cols[0]:cols[-1] + 1])
    if rtl:
        parts = parts[::-1]
    gap = int(size * 0.26)
    tw = sum(p.shape[1] for p in parts) + gap * (len(parts) - 1)
    out = np.zeros((HH, tw, 4), np.float32)
    x = 0
    for p in parts:
        out[:, x:x + p.shape[1]] = p
        x += p.shape[1] + gap
    return out


# =========================================================== compositing helpers ========
_GL = {}


def add_glow(f, img, x, y, col, k, sigma=14, cache=True):
    """additive glow from an image alpha, padded 3.5 sigma so it never shows a box edge."""
    if k <= 0:
        return
    pad = int(sigma * 3.5) + 4
    key = (id(img), sigma)
    if cache and key in _GL:
        g = _GL[key][1]
    else:
        g = nd.gaussian_filter(np.pad(img[..., 3], pad), sigma)
        if cache:
            _GL[key] = (img, g)
    h, w = g.shape
    x0, y0 = int(x) - pad, int(y) - pad
    a0, b0, a1, b1 = max(0, x0), max(0, y0), min(f.shape[1], x0 + w), min(f.shape[0], y0 + h)
    if a1 > a0 and b1 > b0:
        f[b0:b1, a0:a1] += g[b0 - y0:b1 - y0, a0 - x0:a1 - x0, None] * (np.array(col, np.float32) / 255 * k)


def over_rgba(d, s, x, y, alpha=1.0):
    """composite RGBA float `s` onto RGBA float canvas `d`."""
    h, w = s.shape[:2]
    x, y = int(x), int(y)
    x0, y0, x1, y1 = max(0, x), max(0, y), min(d.shape[1], x + w), min(d.shape[0], y + h)
    if x1 <= x0 or y1 <= y0:
        return
    S = s[y0 - y:y1 - y, x0 - x:x1 - x]
    D = d[y0:y1, x0:x1]
    sa = S[..., 3:4] * alpha
    da = D[..., 3:4]
    oa = sa + da * (1 - sa)
    rgb = (S[..., :3] * sa + D[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
    D[..., :3] = rgb
    D[..., 3:4] = oa


def squash(img, sx, sy):
    h, w = img.shape[:2]
    return f32(to_pil(img).resize((max(1, int(w * sx)), max(1, int(h * sy))), Image.BICUBIC))


def rot(img, deg):
    return f32(to_pil(img).rotate(deg, resample=Image.BICUBIC, expand=True))


def vis(t, t0, t1, fin=0.3, fout=0.25):
    """line reveal: fade + 12 px rise in 0.3 s ease-out; fades out over `fout` ending at t1."""
    if t < t0 or (t1 is not None and t >= t1):
        return 0.0, 12.0
    a = ease_out((t - t0) / fin)
    dy = 12.0 * (1 - a)
    if t1 is not None:
        a *= clamp01((t1 - t) / fout)
    return a, dy


def put(f, img, cx, cy, t, t0, t1, glow=None, gk=0.0, k=1.0, sigma=14, alpha=1.0):
    a, dy = vis(t, t0, t1)
    a *= alpha
    if a <= 0:
        return
    im = img if k == 1 else scaled(img, k)
    h, w = im.shape[:2]
    x, y = cx - w / 2, cy - h / 2 + dy
    if glow:
        add_glow(f, im, x, y, glow, gk * a, sigma, cache=(k == 1))
    over(f, im, x, y, a)


def shape(w, h, fn, ss=4):
    im = Image.new("RGBA", (int(w * ss), int(h * ss)), (0, 0, 0, 0))
    fn(ImageDraw.Draw(im), ss)
    return f32(im.resize((int(w), int(h)), Image.LANCZOS))


@lru_cache(None)
def panel(w, h, border=GREY, fill=(14, 20, 38), fa=0.82, ba=0.55, r=34):
    def fn(d, s):
        d.rounded_rectangle([2 * s, 2 * s, (w - 2) * s, (h - 2) * s], r * s, fill=tuple(fill) + (int(255 * fa),),
                            outline=tuple(border) + (int(255 * ba),), width=3 * s)
    return shape(w, h, fn, 2)


def text_card(f, t, lines, cy, t1, border=GREY, minw=560, line_gap=1.25, extra=None):
    """[وجه] text card: panel + lines revealed one by one. lines: [(img, t0, glowcol)]."""
    hs = [im.shape[0] for im, _, _ in lines]
    tw = max(im.shape[1] for im, _, _ in lines)
    th = sum(hs) * 0.78 * line_gap
    pw, ph = int(max(minw, tw + 140)), int(th + 90)
    put(f, panel(pw, ph, border), 540, cy, t, lines[0][1], t1)
    y = cy - th / 2
    for (im, t0, gc), hh in zip(lines, hs):
        yc = y + hh * 0.78 * line_gap / 2
        put(f, im, 540, yc, t, t0, t1, glow=gc, gk=0.35 if gc else 0)
        y += hh * 0.78 * line_gap


def fmt(v, dec=0):
    return f"{v:,.{dec}f}"


# =========================================================== background =================
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)


def make_bg():
    f = np.ones((H, W, 3), np.float32) * (np.array([5, 8, 18], np.float32) / 255)
    lift = np.exp(-(((XX - 540) / 640) ** 2 + ((YY - 760) / 540) ** 2))
    f += lift[..., None] * np.array([0.030, 0.045, 0.085], np.float32)
    zone = np.clip(1 - np.abs(YY - 775) / 640, 0, 1) ** 1.6
    f += (np.exp(-(XX / 26) ** 2) * zone * 0.20)[..., None] * np.array(BLUE, np.float32) / 255
    f += (np.exp(-((XX - W) / 26) ** 2) * zone * 0.20)[..., None] * np.array(ORANGE, np.float32) / 255
    # faint dot grid in the motion zone only
    dots = ((np.abs((XX - 30) % 60 - 30) < 1.6) & (np.abs((YY - 10) % 60 - 30) < 1.6)).astype(np.float32)
    dots = nd.gaussian_filter(dots, 0.6) * np.clip(1 - np.abs(YY - 775) / 560, 0, 1) * np.clip(1 - np.abs(XX - 540) / 560, 0, 1)
    f += dots[..., None] * np.array([0.10, 0.13, 0.20], np.float32)
    calm = np.clip((YY - (CALM_Y - 60)) / 260, 0, 1)
    f *= (1 - 0.35 * calm)[..., None]
    vign = np.clip(1 - 0.35 * (((XX - 540) / 760) ** 2 + ((YY - 900) / 1150) ** 2), 0, 1)
    return f * vign[..., None]


BG = make_bg()
RNG = np.random.default_rng(11)
NOISE = [(RNG.random((H, W, 1), np.float32) - 0.5) / 255 for _ in range(2)]


# =========================================================== icons / shapes =============
def eq_bars(d, s, cx, cy, col, a=255, split=0.0, slash=0.0, bw=104, bh=20, gap=24):
    """«=» (split=0) breaking into «≠» (slash 0..1). drawn, never a glyph."""
    c = tuple(col) + (a,)
    for k, yb in enumerate([cy - gap / 2 - bh / 2, cy + gap / 2 + bh / 2]):
        sgn = -1 if k == 0 else 1
        for half in (-1, 1):
            dx = half * split * 18
            dy = sgn * split * 6 * half
            x0 = cx + (0 if half > 0 else -bw / 2) + dx
            x1 = x0 + bw / 2 - (3 * split)
            d.rounded_rectangle([x0 * s, (yb - bh / 2 + dy) * s, x1 * s, (yb + bh / 2 + dy) * s], int(bh / 2 * s), fill=c)
    if slash > 0:
        L = 92 * slash
        ang = math.radians(62)
        dx, dy = math.cos(ang) * L, math.sin(ang) * L
        d.line([((cx + dx) * s, (cy - dy) * s), ((cx - dx) * s, (cy + dy) * s)], fill=c, width=int(bh * s))
        for px, py in [(cx + dx, cy - dy), (cx - dx, cy + dy)]:
            d.ellipse([(px - bh / 2) * s, (py - bh / 2) * s, (px + bh / 2) * s, (py + bh / 2) * s], fill=c)


@lru_cache(None)
def lock_img(h, col, open_amt=0):
    """padlock drawn as shapes. open_amt in [0, 10] lifts the shackle."""
    w = int(h * 0.8)
    def fn(d, s):
        bw, bt = w * 0.86, h * 0.44
        x0, x1 = (w - bw) / 2, (w + bw) / 2
        r = bw * 0.30
        cx = w / 2
        lift = open_amt / 10 * h * 0.14
        th = max(3, h * 0.09)
        d.arc([(cx - r) * s, (bt - r * 1.25 - lift) * s, (cx + r) * s, (bt + r * 1.25 - lift) * s], 180, 360,
              fill=tuple(col) + (255,), width=int(th * s))
        d.line([((cx - r + th / 2) * s, (bt - lift) * s), ((cx - r + th / 2) * s, (bt + 4) * s)], fill=tuple(col) + (255,), width=int(th * s))
        d.line([((cx + r - th / 2) * s, (bt - lift) * s), ((cx + r - th / 2) * s, (bt + 4 - lift * 1.0) * s)], fill=tuple(col) + (255,), width=int(th * s))
        d.rounded_rectangle([x0 * s, bt * s, x1 * s, (h - 2) * s], int(bw * 0.16 * s), fill=tuple(col) + (255,))
        kx, ky = cx, bt + (h - bt) * 0.45
        kr = (h - bt) * 0.12
        d.ellipse([(kx - kr) * s, (ky - kr) * s, (kx + kr) * s, (ky + kr) * s], fill=INK + (255,))
        d.polygon([((kx - kr * 0.6) * s, ky * s), ((kx + kr * 0.6) * s, ky * s), ((kx + kr * 0.4) * s, (ky + kr * 2.4) * s),
                   ((kx - kr * 0.4) * s, (ky + kr * 2.4) * s)], fill=INK + (255,))
    return shape(w, h, fn)


@lru_cache(None)
def magnifier(h, col):
    def fn(d, s):
        r = h * 0.32
        cx, cy = h * 0.4, h * 0.4
        d.ellipse([(cx - r) * s, (cy - r) * s, (cx + r) * s, (cy + r) * s], outline=tuple(col) + (255,), width=int(h * 0.08 * s))
        d.line([((cx + r * 0.7) * s, (cy + r * 0.7) * s), ((h * 0.92) * s, (h * 0.92) * s)], fill=tuple(col) + (255,), width=int(h * 0.12 * s))
    return shape(h, h, fn)


@lru_cache(None)
def check_img(h, col):
    def fn(d, s):
        d.line([(h * 0.12 * s, h * 0.55 * s), (h * 0.40 * s, h * 0.82 * s), (h * 0.90 * s, h * 0.20 * s)],
               fill=tuple(col) + (255,), width=int(h * 0.15 * s), joint="curve")
    return shape(h, h, fn)


@lru_cache(None)
def box_sprite(col, s0=44, half=False):
    """small carton tinted to its method colour."""
    w, h = s0, int(s0 * 0.86)
    body = lerpc(col, (20, 24, 36), 0.55)
    lid = lerpc(col, (20, 24, 36), 0.30)
    def fn(d, s):
        d.rounded_rectangle([1 * s, h * 0.22 * s, (w - 1) * s, (h - 1) * s], int(4 * s), fill=body + (255,),
                            outline=tuple(col) + (255,), width=int(2 * s))
        d.rounded_rectangle([0, 1 * s, w * s, h * 0.30 * s], int(3 * s), fill=lid + (255,), outline=tuple(col) + (255,), width=int(2 * s))
        d.rectangle([(w / 2 - 3) * s, 1 * s, (w / 2 + 3) * s, (h * 0.62) * s], fill=lerpc(col, WHITE, 0.45) + (255,))
    im = shape(w, h, fn)
    return im[:, : w // 2 + 1].copy() if half else im


@lru_cache(None)
def shirt_img(h, col):
    def fn(d, s):
        w = h
        P = [(0.30, 0.05), (0.42, 0.10), (0.58, 0.10), (0.70, 0.05), (0.98, 0.25), (0.86, 0.42), (0.76, 0.36),
             (0.76, 0.96), (0.24, 0.96), (0.24, 0.36), (0.14, 0.42), (0.02, 0.25)]
        d.polygon([(x * w * s, y * h * s) for x, y in P], fill=tuple(col) + (255,))
        d.arc([0.40 * w * s, 0.0 * h * s, 0.60 * w * s, 0.20 * h * s], 0, 180, fill=INK + (255,), width=int(h * 0.04 * s))
    return shape(h, h, fn)


@lru_cache(None)
def return_icon(h, col):
    """U-turn «return» arrow (drawn)."""
    def fn(d, s):
        th = h * 0.13
        r = h * 0.28
        cx, cy = h * 0.55, h * 0.42
        d.arc([(cx - r) * s, (cy - r) * s, (cx + r) * s, (cy + r) * s], 270, 90, fill=tuple(col) + (255,), width=int(th * s))
        d.line([(cx * s, (cy + r - th / 2) * s), (h * 0.22 * s, (cy + r - th / 2) * s)], fill=tuple(col) + (255,), width=int(th * s))
        ay = cy - r + th / 2
        d.line([(cx * s, ay * s), (h * 0.36 * s, ay * s)], fill=tuple(col) + (255,), width=int(th * s))
        d.polygon([(h * 0.04 * s, ay * s), (h * 0.40 * s, (ay - h * 0.2) * s), (h * 0.40 * s, (ay + h * 0.2) * s)], fill=tuple(col) + (255,))
    return shape(h, h, fn)


@lru_cache(None)
def box_icon(h, col):
    def fn(d, s):
        d.rounded_rectangle([h * 0.08 * s, h * 0.30 * s, h * 0.92 * s, h * 0.90 * s], int(h * 0.05 * s), outline=tuple(col) + (255,), width=int(h * 0.08 * s))
        d.rounded_rectangle([h * 0.02 * s, h * 0.14 * s, h * 0.98 * s, h * 0.34 * s], int(h * 0.04 * s), fill=tuple(col) + (255,))
        d.rectangle([h * 0.45 * s, h * 0.30 * s, h * 0.55 * s, h * 0.62 * s], fill=tuple(col) + (255,))
    return shape(h, h, fn)


@lru_cache(None)
def method_card(label, col, w=640, h=250, ns=170):
    """«65/50» / «50/65» card with tiny تأكيد / توصيل labels under each number."""
    c = panel(w, h, col, lerpc(col, (10, 14, 26), 0.86), 0.92, 0.95, 34).copy()
    num = rich(label, ns, col)
    ny = h * 0.43
    over_rgba(c, num, (w - num.shape[1]) / 2, ny - num.shape[0] / 2)
    if SHOW_CARD_LABELS:
        nw = num.shape[1]
        for txt, dx in [("تأكيد", -0.30), ("توصيل", 0.30)]:   # 65/50 reads LTR: left number = confirmation
            im = rich(txt, int(ns * 0.21), GREY, "Bold")
            over_rgba(c, im, w / 2 + dx * nw - im.shape[1] / 2, h * 0.83 - im.shape[0] / 2)
    return c


# ---------------------------------------------------------------- scene 1 --------------
# vertical stack: red 65/50 on top (read first), blue 50/65 under it, «=» between
RX, BX = 785, 295     # columns: red (65/50) on the right = read first, blue (50/65) on the left
S1A = dict(yr=470, ye=720, yb=970, w=640, h=250, ns=170)
S1D = dict(yr=410, ye=620, yb=830, w=560, h=210, ns=140)


def cards(f, t, t0, t1, L, first_frame=False):
    for lab, col, cy in [("65/50", RED, L["yr"]), ("50/65", BLUE, L["yb"])]:
        im = method_card(lab, col, L["w"], L["h"], L["ns"])
        if first_frame:
            a = clamp01((t1 - t) / 0.25)
            k = 0.97 + 0.03 * ease_out(t / 0.3)
            im2 = scaled(im, k)
            add_glow(f, im2, 540 - im2.shape[1] / 2, cy - im2.shape[0] / 2, col, 0.25 * a, 18, cache=False)
            over(f, im2, 540 - im2.shape[1] / 2, cy - im2.shape[0] / 2, a)
        else:
            put(f, im, 540, cy, t, t0, t1, glow=col, gk=0.25, sigma=18)


def local_draw(f, cx, cy, size, fn, alpha=1.0, glowcol=None, gk=0.0, sigma=12):
    im = shape(size, size, lambda d, s: fn(d, s, size / 2, size / 2), 2)
    x, y = cx - size / 2, cy - size / 2
    if glowcol:
        add_glow(f, im, x, y, glowcol, gk * alpha, sigma, cache=False)
    over(f, im, x, y, alpha)


QMARK = None


def s1a(f, t):   # 0.0 -> 2.5  [سبليت] 65/50 = 50/65 + «؟» stamp
    t1 = 2.5
    L = S1A
    CARD_Y = L["ye"]
    cards(f, t, 0, t1, L, first_frame=True)
    a = clamp01((t1 - t) / 0.25)
    blink = 1.0 if t >= 0.4 else (1.0 if int(t * 10) % 2 == 0 else 0.35)
    ea = a * (blink if t < 0.4 else 0.40)
    local_draw(f, 540, CARD_Y, 300, lambda d, s, cx, cy: eq_bars(d, s, cx, cy, WHITE, bw=150, bh=26, gap=32), ea)
    if t >= 0.4:
        p = ease_out((t - 0.4) / 0.16)
        k = 2.0 - 1.0 * p
        shake = math.exp(-(t - 0.56) * 14) * 9 * math.sin((t - 0.4) * 90) if t > 0.56 else 0
        q = rot(rich("؟", 290, YEL), -9)
        q = scaled(q, k) if k != 1 else q
        x = 540 - q.shape[1] / 2 + shake
        y = CARD_Y - 10 - q.shape[0] / 2
        add_glow(f, q, x, y, YEL, (0.55 + 0.6 * math.exp(-(t - 0.4) * 6)) * a * p, 18, cache=False)
        over(f, q, x, y, a * clamp01(p * 1.5))


SHARDS = [(RNG.uniform(0, 2 * np.pi), RNG.uniform(160, 420), RNG.uniform(-8, 8), RNG.uniform(6, 14), RNG.integers(0, 2))
          for _ in range(18)]


def s1d(f, t):   # 7.0 -> 10.0  [سبليت] «=» breaks into «≠» red
    t0, t1 = 7.0, 10.0
    L = S1D
    CARD_Y = L["ye"]
    cards(f, t, t0, t1, L)
    a, dy = vis(t, t0, t1)
    tb = 7.55
    tr = 0.0
    if 7.30 < t < tb:
        tr = 3 * math.sin(t * 120) * seg(t, 7.3, tb)
    split = ease_out(seg(t, tb, tb + 0.18)) * (1 - ease_io(seg(t, tb + 0.30, tb + 0.50)))
    slash = ease_out(seg(t, tb + 0.30, tb + 0.50))
    col = lerpc(WHITE, RED, ease_io(seg(t, tb + 0.1, tb + 0.45)))
    gk = 0.0 if t < tb else 0.5 + 0.8 * math.exp(-(t - tb) * 5)
    local_draw(f, 540 + tr, CARD_Y + dy, 300, lambda d, s, cx, cy: eq_bars(d, s, cx, cy, col, split=split, slash=slash,
                                                                       bw=130, bh=24, gap=28),
               a, glowcol=RED if t >= tb else None, gk=gk, sigma=14)
    if tb <= t < tb + 0.8:   # glass shards
        u = t - tb
        def fn(d, s, cx, cy):
            for ang, sp, rv, sz, kind in SHARDS:
                px = cx + math.cos(ang) * sp * u
                py = cy + math.sin(ang) * sp * u + 380 * u * u
                al = int(255 * clamp01(1 - u / 0.8))
                c = (WHITE if kind else RED) + (al,)
                r0 = rv * u
                pts = [(px + sz * math.cos(r0 + k * 2.2), py + sz * 0.7 * math.sin(r0 + k * 2.2)) for k in range(3)]
                d.polygon([(x * s, y * s) for x, y in pts], fill=c)
        local_draw(f, 540, CARD_Y, 640, fn, a)
        add_glow_disc(f, 540, CARD_Y, 70, WHITE, 0.5 * math.exp(-u * 10))
    put(f, rich("نفس الطرود…", 100, WHITE), 540, 1075, t, 7.15, t1, glow=WHITE, gk=0.15)
    put(f, rich("ماشي نفس الدراهم", 64, RED, "Bold"), 540, 1195, t, 8.05, t1, glow=RED, gk=0.3)


def add_glow_disc(f, x, y, r, col, k):
    """additive soft light disc (no edges: the gaussian is ~0 at 3.2 r)."""
    if k <= 0.003:
        return
    R = int(r * 3.2)
    x0, y0 = int(x) - R, int(y) - R
    a0, b0, a1, b1 = max(0, x0), max(0, y0), min(W, x0 + 2 * R), min(H, y0 + 2 * R)
    if a1 <= a0 or b1 <= b0:
        return
    yy, xx = np.mgrid[b0:b1, a0:a1].astype(np.float32)
    g = np.exp(-(((xx - x) ** 2 + (yy - y) ** 2) / (r * r))) * k
    f[b0:b1, a0:a1] += g[..., None] * np.array(col, np.float32) / 255


def s1b(f, t):   # 2.5 -> 5.0  [وجه] (أنا نقرا الكونفيرماسيون والسويفي) + small magnifier
    t0, t1 = 2.5, 5.0
    put(f, panel(940, 400, GREY), 540, 720, t, t0, t1)
    put(f, magnifier(140, GOLD), 540, 620, t, t0 + 0.05, t1, glow=GOLD, gk=0.3)
    put(f, rich("(أنا نقرا الكونفيرماسيون والسويفي)", 52, (215, 220, 228), "Bold"), 540, 800, t, t0 + 0.3, t1)


def s1c(f, t):   # 5.0 -> 7.0  [وجه] حسابياً؟ صح.
    t0, t1 = 5.0, 7.0
    put(f, panel(760, 440, GREY), 540, 720, t, t0, t1)
    put(f, rich("حسابياً؟", 136, WHITE), 540, 630, t, t0, t1, glow=WHITE, gk=0.12)
    sah = rich("صح.", 124, GREEN)
    put(f, sah, 575, 815, t, t0 + 0.55, t1, glow=GREEN, gk=0.35)
    put(f, check_img(100, GREEN), 575 - sah.shape[1] / 2 - 75, 800, t, t0 + 0.75, t1, glow=GREEN, gk=0.35)


# ---------------------------------------------------------------- scene 2: funnels ------
FUN_Y = [480, 635, 790, 945]
FUN_LAB = ["ليد", "مؤكّدة", "طرد", "موصّل"]
FUN_R = [100, 65, 65, 32.5]
FUN_B = [100, 50, 50, 32.5]
FUN_T = [10.25, 10.95, 11.65, 12.35]
FLIP_T = [None, 14.20, 14.38, None]


def bar_w(v): return 150 + v / 100 * 760


def vtxt(v, final):
    return fmt(v, 1) if (final and v != int(v)) else str(int(round(v)))


def s2(f, t):   # 10.0 -> 17.5 red funnel then flip to blue
    t0, t1 = 10.0, 17.5
    m = ease_io(seg(t, 14.2, 14.7))
    col = lerpc(RED, BLUE, m)
    A, _ = vis(t, t0, t1)
    # --- top line: 100 ليد ← 65% ← 50%  (percentages flip)
    a, dy = vis(t, 10.05, t1)
    if a > 0:
        lead = rich("100 ليد", 58, WHITE)
        arr = arrow_img(40, 28, GOLD)
        slots = []
        for i, (pa, pb) in enumerate([("65%", "50%"), ("50%", "65%")]):
            ft = 14.20 + 0.18 * i
            p = seg(t, ft, ft + 0.36)
            txt = pa if p < 0.5 else pb
            c = lerpc(RED, BLUE, m)
            slots.append((rich(txt, 58, c), abs(math.cos(math.pi * p))))
        sw = max(rich(x, 58, WHITE).shape[1] for x in ("65%", "50%"))
        gap = 22
        tot = lead.shape[1] + 2 * (arr.shape[1] + sw + 2 * gap)
        x = 540 + tot / 2
        cy = 330 + dy
        over(f, lead, x - lead.shape[1], cy - lead.shape[0] / 2, a)
        x -= lead.shape[1] + gap
        for im, sy in slots:
            over(f, arr, x - arr.shape[1], cy - arr.shape[0] / 2 + 6, a)
            x -= arr.shape[1] + gap
            im2 = squash(im, 1, max(0.02, sy))
            over(f, im2, x - sw / 2 - im2.shape[1] / 2, cy - im2.shape[0] / 2, a)
            x -= sw + gap
    # --- funnel bars + counters
    for i in range(4):
        ta = FUN_T[i]
        a, dy = vis(t, ta, t1)
        if a <= 0:
            continue
        prev = FUN_R[i - 1] if i else 0
        pc = ease_out(seg(t, ta, ta + 0.45))
        vr = lerp(prev, FUN_R[i], pc) if i else FUN_R[0]
        v = lerp(vr, FUN_B[i], m)
        wv = lerp(bar_w(prev if i else 100), bar_w(FUN_R[i]), pc) if i else bar_w(100)
        wv = lerp(wv, bar_w(FUN_B[i]), m)
        if i:   # connector trapezoid from the previous bar
            pv = lerp(FUN_R[i - 1], FUN_B[i - 1], m)
            pw = bar_w(pv)
            y0, y1 = FUN_Y[i - 1] + 55, FUN_Y[i] - 55
            hh = y1 - y0
            im = shape(W, hh + 2, lambda d, s: d.polygon([((540 - pw / 2) * s, 0), ((540 + pw / 2) * s, 0),
                                                         ((540 + wv / 2) * s, hh * s), ((540 - wv / 2) * s, hh * s)],
                                                        fill=tuple(col) + (46,)), 1)
            over(f, im, 0, y0 + dy, a)
        bw = int(wv)
        bar = shape(bw + 4, 110, lambda d, s: d.rounded_rectangle([2 * s, 2 * s, (bw + 2) * s, 108 * s], 26 * s,
                                                                  fill=lerpc(col, (12, 16, 30), 0.62) + (240,),
                                                                  outline=tuple(col) + (255,), width=3 * s), 2)
        add_glow(f, bar, 540 - bar.shape[1] / 2, FUN_Y[i] - 55 + dy, col, 0.18 * a, 16, cache=False)
        over(f, bar, 540 - bar.shape[1] / 2, FUN_Y[i] - 55 + dy, a)
        final = pc >= 1
        lab = rich(f"{vtxt(v, final and (m == 0 or m == 1))} {FUN_LAB[i]}", 62, WHITE)
        sy = 1.0
        if FLIP_T[i]:
            p = seg(t, FLIP_T[i], FLIP_T[i] + 0.36)
            sy = max(0.02, abs(math.cos(math.pi * p)))
            if 0 < p < 1:
                lab = rich(f"{FUN_R[i] if p < 0.5 else FUN_B[i]} {FUN_LAB[i]}", 62, WHITE)
        if sy != 1.0:
            lab = squash(lab, 1, sy)
        over(f, lab, 540 - lab.shape[1] / 2, FUN_Y[i] - lab.shape[0] / 2 + dy - 2, a)
    # --- big 32.5 موصّل (number takes the method colour)
    big_r = rich("32.5 موصّل", 112, WHITE, ncol=RED)
    big_b = rich("32.5 موصّل", 112, WHITE, ncol=BLUE)
    a, dy = vis(t, 12.95, t1)
    if a > 0:
        x, y = 540 - big_r.shape[1] / 2, 1100 - big_r.shape[0] / 2 + dy
        add_glow(f, big_r, x, y, col, 0.35 * a, 16)
        over(f, big_r, x, y, a * (1 - m))
        if m > 0:
            over(f, big_b, x, y, a * m)


def s2c(f, t):   # 17.5 -> 20.0  [وجه] لهنا… عندو الحق.
    t0, t1 = 17.5, 20.0
    text_card(f, t, [(rich("لهنا…", 96, WHITE), t0, None), (rich("عندو الحق.", 96, WHITE), t0 + 0.55, None)], 700, t1)


# ---------------------------------------------------------------- scene 3 --------------
def s3a(f, t):   # 20.0 -> 22.5  [وجه] 32.5 كيف كيف؟ (punch-in) / استنى…
    t0, t1 = 20.0, 22.5
    put(f, panel(860, 400, GOLD), 540, 720, t, t0, t1)
    k = 1 + 0.15 * ease_out(seg(t, t0 + 0.05, t0 + 0.17))
    put(f, rich("32.5 كيف كيف؟", 96, WHITE, ncol=WHITE), 540, 660, t, t0, t1, glow=WHITE, gk=0.15, k=k)
    put(f, rich("استنى…", 74, GOLD), 540, 830, t, t0 + 0.9, t1, glow=GOLD, gk=0.35)


GRID_Y0 = 470
PILE_BASE = 1160
PILE_X = {RED: 760, BLUE: 320}
BS = 44


def grid_pos(n, i, cols):
    rows = math.ceil(n / cols)
    cw = BS + 10
    x0 = 540 - (cols * cw - 10) / 2
    r, c = divmod(i, cols)
    return x0 + (cols - 1 - c) * cw, GRID_Y0 + r * (BS * 0.86 + 10)   # filled right to left


def pile_pos(col, j):
    r, c = divmod(j, 8)
    cw = BS + 6
    x0 = PILE_X[col] - (8 * cw - 6) / 2
    off = (cw / 2) if r % 2 else 0
    return x0 + c * cw + off * 0.0, PILE_BASE - (r + 1) * (BS * 0.86 + 4)


def pile_scene(f, t, col, n_sent, n_ret, t0, t1, t_ret, cols):
    """grid of sent cartons pops in, then the returned ones fly down into a pile (stays to the end)."""
    a, _ = vis(t, t0, t1)
    nfull = int(n_ret)
    half = n_ret - nfull > 0
    nr = nfull + (1 if half else 0)
    ret_ids = list(range(n_sent - nr, n_sent))
    for i in range(n_sent):
        tp = t0 + 0.15 + i * (0.9 / n_sent)
        p = ease_out(seg(t, tp, tp + 0.14))
        if p <= 0:
            continue
        gx, gy = grid_pos(n_sent, i, cols)
        if i in ret_ids:
            j = i - (n_sent - nr)
            is_half = half and j == nr - 1
            tf = t_ret + j * 0.035
            q = ease_io(seg(t, tf, tf + 0.38))
            if q > 0:
                continue   # drawn by the pile part
        alpha = a * p
        over(f, box_sprite(col), gx, gy + 8 * (1 - p), alpha)
    return ret_ids, nr, half


def pile_draw(f, t, col, n_sent, ret_ids, nr, half, t_ret, cols, alpha=1.0):
    for j in range(nr):
        i = ret_ids[j]
        is_half = half and j == nr - 1
        tf = t_ret + j * 0.035
        q = ease_io(seg(t, tf, tf + 0.38))
        if q <= 0:
            continue
        gx, gy = grid_pos(n_sent, i, cols)
        px, py = pile_pos(col, j)
        x = lerp(gx, px, q)
        y = lerp(gy, py, q) - math.sin(math.pi * q) * 90
        spr = box_sprite(col, BS, is_half)
        over(f, spr, x + (BS / 2 if is_half else 0) * q, y, alpha)


def s3b(f, t):   # 22.5 -> 29.0 red pile then blue pile next to it
    T1 = 29.0
    # red part
    tr0, tr1, trr = 22.5, 26.0, 24.05
    if t < tr1:
        ret, nr, half = pile_scene(f, t, RED, 65, 32.5, tr0, tr1, trr, 13)
    red_ids = list(range(65 - 33, 65))
    pa = (1.0 if t < 26.0 else 1 - 0.45 * ease_io(seg(t, 26.0, 26.4))) * clamp01((T1 - t) / 0.25)
    pile_draw(f, t, RED, 65, red_ids, 33, True, trr, 13, pa)
    put(f, rich("الأولى: بعثت 65", 66, WHITE, ncol=RED), 540, 300, t, tr0, tr1)
    put(f, rich("رجعولك 32.5", 66, WHITE, ncol=RED), 540, 390, t, 24.0, tr1, glow=RED, gk=0.25)
    # blue part
    tb0, tbr = 26.0, 27.3
    if t >= tb0:
        retb, nrb, halfb = pile_scene(f, t, BLUE, 50, 17.5, tb0, T1, tbr, 10)
        pile_draw(f, t, BLUE, 50, retb, nrb, halfb, tbr, 10, clamp01((T1 - t) / 0.25))
    put(f, rich("الثانية: بعثت 50", 66, WHITE, ncol=BLUE), 540, 300, t, tb0, T1)
    put(f, rich("رجعو 17.5 برك", 66, WHITE, ncol=BLUE), 540, 390, t, 27.2, T1, glow=BLUE, gk=0.25)
    # pile floor + method tags
    a, _ = vis(t, 24.0, T1)
    if a > 0:
        for c, lab in [(RED, "65/50"), (BLUE, "50/65")]:
            if c == BLUE and t < 27.2:
                continue
            aa = a if c == RED else vis(t, 27.2, T1)[0]
            fl = shape(440, 8, lambda d, s, c=c: d.rounded_rectangle([0, 0, 440 * s, 8 * s], 4 * s, fill=tuple(c) + (150,)), 2)
            over(f, fl, PILE_X[c] - 220, PILE_BASE + 2, aa)
            put(f, rich(lab, 46, c), PILE_X[c], PILE_BASE + 50, t, 24.0 if c == RED else 27.2, T1)


def s3c(f, t):   # 29.0 -> 32.5 price cards
    t0, t1 = 29.0, 32.5
    for cy, txt, icon, ts in [(560, "روتور: 600 دج", return_icon(84, RED), t0 + 0.1),
                              (820, "باكاج: 100 دج", box_icon(80, GOLD), t0 + 1.4)]:
        put(f, panel(840, 200, GREY), 540, cy, t, ts, t1)
        im = rich(txt, 74, WHITE, ncol=GOLD)
        put(f, im, 480, cy, t, ts + 0.1, t1)
        put(f, icon, 480 + im.shape[1] / 2 + 90, cy - 4, t, ts + 0.1, t1)


def s3d(f, t):   # 32.5 -> 36.5 money counters 19,500 vs 10,500 · 6,500 vs 5,000
    t0, t1 = 32.5, 36.5
    put(f, rich("65/50", 56, RED), RX, 320, t, t0, t1)
    put(f, rich("50/65", 56, BLUE), BX, 320, t, t0, t1)
    rows = [("روتور", 19500, 10500, "روتور: +9,000 دج", 450, t0 + 0.2, t0 + 1.35),
            ("باكاج", 6500, 5000, "باكاج: +1,500 دج", 820, t0 + 1.9, t0 + 3.0)]
    for lab, vr, vb, diff, y, ts, td in rows:
        put(f, rich(lab, 46, GREY, "Bold"), 540, y, t, ts, t1)
        for v, c, cx in [(vr, RED, RX), (vb, BLUE, BX)]:
            a, dy = vis(t, ts, t1)
            if a <= 0:
                continue
            p = ease_out(seg(t, ts, ts + 0.9))
            im = rich(fmt(round(v * p / 50) * 50 if p < 1 else v), 104, c)
            x, yy = cx - im.shape[1] / 2, y + 90 - im.shape[0] / 2 + dy
            over(f, im, x, yy, a)
        put(f, rich(diff, 70, WHITE, ncol=RED), 540, y + 220, t, td, t1, glow=RED, gk=0.3)


def s3e(f, t):   # 36.5 -> 40.0 [وجه] ومازال… + small lock
    t0, t1 = 36.5, 40.0
    put(f, panel(620, 260, GREY), 540, 700, t, t0, t1)
    im = rich("ومازال…", 108, WHITE)
    put(f, im, 590, 700, t, t0, t1, glow=WHITE, gk=0.12)
    lk = lock_img(96, GOLD, 0 if t > t0 + 0.9 else 10)
    puls = 1 + 0.05 * math.sin(max(0, t - t0 - 0.9) * 6)
    put(f, lk, 590 - im.shape[1] / 2 - 75, 694, t, t0 + 0.6, t1, glow=GOLD, gk=0.35 * puls)


# ---------------------------------------------------------------- scene 4 --------------
def bez(p0, p1, p2, p3, u):
    v = 1 - u
    return (v ** 3 * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u ** 3 * p3[0],
            v ** 3 * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u ** 3 * p3[1])


ROAD = [(950, 520), (700, 390), (420, 950), (130, 790)]


@lru_cache(None)
def road_img():
    def fn(d, s):
        pts = [bez(*ROAD, u) for u in np.linspace(0, 1, 120)]
        d.line([(x * s, y * s) for x, y in pts], fill=(38, 44, 60, 255), width=int(110 * s), joint="curve")
        d.line([(x * s, y * s) for x, y in pts], fill=(70, 80, 100, 255), width=int(4 * s))
        for k in range(0, 119, 6):
            seg_pts = pts[k:k + 3]
            d.line([(x * s, y * s) for x, y in seg_pts], fill=(150, 160, 178, 255), width=int(5 * s))
    return shape(W, 1100, fn, 2)


def s4a(f, t):   # 40.0 -> 42.5  15 pieces locked on the road
    t0, t1 = 40.0, 42.5
    a, _ = vis(t, t0, t1)
    if a > 0:
        over(f, road_img(), 0, 0, a * 0.95)
    lock_t = 41.15
    us = [u for u in np.linspace(0.06, 0.94, 17) if not (0.44 < u < 0.56)][:15]
    us = list(np.linspace(0.06, 0.40, 8)) + list(np.linspace(0.60, 0.94, 7))
    red_m = ease_io(seg(t, lock_t + 0.2, lock_t + 0.5))
    for k, u in enumerate(us):
        p = ease_out(seg(t, t0 + 0.1 + k * 0.03, t0 + 0.95 + k * 0.03))
        uu = lerp(0.0, u, p)
        x, y = bez(*ROAD, uu)
        sh = shirt_img(52, lerpc((225, 230, 238), RED, red_m * 0.8))
        over(f, sh, x - 26, y - 34, a * clamp01(p * 3))
    if t >= lock_t:
        p = ease_out(seg(t, lock_t, lock_t + 0.22))
        x, y = bez(*ROAD, 0.5)
        lk = lock_img(170, RED, 10 if t < lock_t + 0.32 else 0)
        yy = y - 40 - 110 * (1 - p)
        add_glow(f, lk, x - lk.shape[1] / 2, yy - lk.shape[0] / 2, RED, 0.5 * a * p, 18, cache=False)
        over(f, lk, x - lk.shape[1] / 2, yy - lk.shape[0] / 2, a * p)
    put(f, rich("15 قطعة محبوسة", 84, WHITE, ncol=RED), 540, 1095, t, t0 + 0.15, t1, glow=RED, gk=0.2)
    put(f, rich("في الطريق", 54, GREY, "Bold"), 540, 1195, t, t0 + 0.7, t1)


def s4b(f, t):   # 42.5 -> 45.5  a returned, damaged carton
    t0, t1 = 42.5, 45.5
    a, _ = vis(t, t0, t1)
    if a > 0:
        p = ease_out(seg(t, t0 + 0.05, t0 + 0.6))
        cx = lerp(380, 540, p)
        bump = math.exp(-max(0, t - t0 - 0.6) * 8) * math.sin(max(0, t - t0 - 0.6) * 30) * 6
        cr = ease_io(seg(t, t0 + 0.7, t0 + 1.0))
        sc = ease_io(seg(t, t0 + 1.1, t0 + 1.5))
        rr = np.random.default_rng(5)
        jit = rr.uniform(-1, 1, (40, 2))

        def fn(d, s, ox, oy):
            bx0, by0, bx1, by1 = ox - 200, oy - 40, ox + 200, oy + 230
            # piece poking out (behind the front)
            P = [(0.30, 0.05), (0.42, 0.10), (0.58, 0.10), (0.70, 0.05), (0.98, 0.25), (0.86, 0.42), (0.76, 0.36),
                 (0.76, 0.96), (0.24, 0.96), (0.24, 0.36), (0.14, 0.42), (0.02, 0.25)]
            sw, shh, sx, sy = 190, 190, ox - 95 + 20, oy - 150
            d.polygon([((sx + x * sw) * s, (sy + y * shh) * s) for x, y in P], fill=(222, 226, 234, 255))
            if sc > 0:   # scratch
                zz = [(sx + 70, sy + 60), (sx + 92, sy + 82), (sx + 80, sy + 96), (sx + 108, sy + 122), (sx + 98, sy + 136), (sx + 124, sy + 160)]
                n = max(2, int(len(zz) * sc))
                d.line([(x * s, y * s) for x, y in zz[:n]], fill=RED + (255,), width=int(7 * s), joint="curve")
            # crumpled carton
            def jag(pts, amp):
                out = []
                for k, (x, y) in enumerate(pts):
                    out.append((x + jit[k % 40, 0] * amp, y + jit[k % 40, 1] * amp))
                return out
            amp = 14 * cr
            top = [(bx0 + (bx1 - bx0) * u, by0) for u in np.linspace(0, 1, 9)]
            right = [(bx1, by0 + (by1 - by0) * u) for u in np.linspace(0, 1, 7)[1:]]
            bot = [(bx1 - (bx1 - bx0) * u, by1) for u in np.linspace(0, 1, 9)[1:]]
            left = [(bx0, by1 - (by1 - by0) * u) for u in np.linspace(0, 1, 7)[1:-1]]
            body = jag(top + right + bot + left, amp)
            d.polygon([(x * s, y * s) for x, y in body], fill=KRAFT + (255,))
            d.line([(x * s, y * s) for x, y in body + [body[0]]], fill=(120, 84, 48, 255), width=int(5 * s))
            # flaps
            d.polygon([(bx0 * s, by0 * s), ((bx0 - 50 + 20 * cr) * s, (by0 - 70 + 25 * cr) * s), ((ox - 60) * s, (by0 - 50) * s), ((ox - 70) * s, by0 * s)],
                      fill=lerpc(KRAFT, (255, 255, 255), 0.12) + (255,), outline=(120, 84, 48, 255))
            d.polygon([(bx1 * s, by0 * s), ((bx1 + 40 - 30 * cr) * s, (by0 - 60 + 35 * cr) * s), ((ox + 70) * s, (by0 - 55) * s), ((ox + 80) * s, by0 * s)],
                      fill=lerpc(KRAFT, (0, 0, 0), 0.12) + (255,), outline=(120, 84, 48, 255))
            # creases / dents
            if cr > 0:
                al = int(200 * cr)
                for (x0, y0, x1, y1) in [(bx0 + 30, by0 + 60, bx0 + 120, by0 + 120), (bx0 + 120, by0 + 120, bx0 + 90, by0 + 210),
                                         (bx1 - 40, by0 + 30, bx1 - 140, by0 + 140), (bx1 - 140, by0 + 140, bx1 - 60, by1 - 20)]:
                    d.line([(x0 * s, y0 * s), (x1 * s, y1 * s)], fill=(95, 64, 34, al), width=int(6 * s))
            # tape + label
            d.rectangle([(ox - 160) * s, (by0 + 100) * s, (ox - 40) * s, (by0 + 170) * s], fill=(236, 236, 230, 255))
            for k in range(3):
                d.line([((ox - 150) * s, (by0 + 115 + k * 18) * s), ((ox - 60) * s, (by0 + 115 + k * 18) * s)], fill=(90, 90, 96, 255), width=int(4 * s))
        local_draw(f, cx, 660 + bump, 620, lambda d, s, ox, oy: fn(d, s, ox, oy), a)
        ri = return_icon(110, RED)
        add_glow(f, ri, cx + 120, 420, RED, 0.4 * a, 14)
        over(f, ri, cx + 120, 420, a * p)
    put(f, rich("السلعة ترجع مخسّرة", 82, WHITE), 540, 1130, t, t0 + 0.2, t1, glow=RED, gk=0.15)


@lru_cache(None)
def yellow_card():
    w, h = 400, 560
    def fn(d, s):
        d.rounded_rectangle([4 * s, 4 * s, (w - 4) * s, (h - 4) * s], 34 * s, fill=YEL + (255,))
        d.rounded_rectangle([4 * s, 4 * s, (w - 4) * s, (h * 0.36) * s], 34 * s, fill=lerpc(YEL, (255, 255, 255), 0.18) + (255,))
        d.rectangle([4 * s, (h * 0.2) * s, (w - 4) * s, (h * 0.36) * s], fill=lerpc(YEL, (255, 255, 255), 0.18) + (255,))
    c = shape(w, h, fn, 2)
    c[int(h * 0.36):, :, :3] = np.where(c[int(h * 0.36):, :, 3:4] > 0, np.array(YEL, np.float32) / 255, c[int(h * 0.36):, :, :3])
    for txt, y in [("تاجر", 225), ("روتور", 355)]:
        im = rich(txt, 108, INK)
        over_rgba(c, im, (w - im.shape[1]) / 2, y - im.shape[0] / 2)
    return c


def s4c(f, t):   # 45.5 -> 48.5  yellow card «تاجر روتور»
    t0, t1 = 45.5, 48.5
    a, _ = vis(t, t0, t1)
    if a > 0:
        p = ease_out(seg(t, t0 + 0.05, t0 + 0.45))
        ang = lerp(24, -6, p)
        card = rot(yellow_card(), ang)
        cy = lerp(900, 640, p)
        x, y = 540 - card.shape[1] / 2, cy - card.shape[0] / 2
        add_glow(f, card, x, y, YEL, 0.28 * a * p, 22, cache=False)
        over(f, card, x, y, a * clamp01(p * 2))
    put(f, rich("عند شركة التوصيل", 58, (215, 220, 228), "Bold"), 540, 1080, t, t0 + 0.7, t1)


# ---------------------------------------------------------------- scene 5 --------------
TB_COLX = {"lab": 870, "r": 600, "b": 300}
TB_ROWS = [("مبعوث", "65", "50"), ("موصّل", "32.5", "32.5"), ("راجع", "32.5", "17.5"),
           ("روتور", "19,500", "10,500"), ("باكاج", "6,500", "5,000")]
TB_Y0 = 260          # layer top in frame coordinates
TB_H = 820


def table_layer(t):
    """the table on its own RGBA layer (built row by row) so it can shrink up after 52.0."""
    L = np.zeros((TB_H, W, 4), np.float32)
    ta = 48.55
    # column tints
    for key, col in [("r", RED), ("b", BLUE)]:
        a = ease_out(seg(t, ta, ta + 0.3))
        if a > 0:
            colp = panel(270, 790, col, lerpc(col, (10, 14, 26), 0.88), 0.85, 0.7, 26)
            over_rgba(L, colp, TB_COLX[key] - 135, 5 + 12 * (1 - a), a)
    for key, lab, col in [("r", "65/50", RED), ("b", "50/65", BLUE)]:
        a = ease_out(seg(t, ta, ta + 0.3))
        if a > 0:
            im = rich(lab, 56, col)
            over_rgba(L, im, TB_COLX[key] - im.shape[1] / 2, 60 - im.shape[0] / 2 + 12 * (1 - a), a)
    for k, (lab, vr, vb) in enumerate(TB_ROWS):
        tr = 48.95 + k * 0.38
        a = ease_out(seg(t, tr, tr + 0.3))
        if a <= 0:
            continue
        y = 150 + k * 96 + 12 * (1 - a)
        im = rich(lab, 46, (205, 210, 220), "Bold")
        over_rgba(L, im, TB_COLX["lab"] - im.shape[1] / 2, y - im.shape[0] / 2, a)
        for v, key in [(vr, "r"), (vb, "b")]:
            im = rich(v, 52, WHITE)
            over_rgba(L, im, TB_COLX[key] - im.shape[1] / 2, y - im.shape[0] / 2, a)
        sep = np.zeros((2, 900, 4), np.float32)
        sep[..., :3] = 0.5
        sep[..., 3] = 0.25
        over_rgba(L, sep, 90, y + 48, a)
    tp = 48.95 + 5 * 0.38 + 0.05
    a = ease_out(seg(t, tp, tp + 0.3))
    if a > 0:
        y = 150 + 5 * 96 + 40 + 12 * (1 - a)
        im = rich("الربح الصافي", 42, GREEN)
        over_rgba(L, im, TB_COLX["lab"] - im.shape[1] / 2, y - im.shape[0] / 2, a)
        pc = ease_out(seg(t, tp, tp + 0.7))
        for v, key, col in [(92000, "r", WHITE), (102500, "b", GREEN)]:
            s = fmt(v) if pc >= 1 else fmt(round(v * pc / 500) * 500)
            im = rich(s, 62, col)
            over_rgba(L, im, TB_COLX[key] - im.shape[1] / 2, y - im.shape[0] / 2, a)
    return L


TB_FINAL = None


def s5(f, t):   # 48.5 -> 55.5  table, then shrink + profit per delivered + +10,500 badge
    global TB_FINAL
    t0, t1 = 48.5, 55.5
    A = clamp01((t1 - t) / 0.25)
    sh = ease_io(seg(t, 52.0, 52.5))
    if t >= 52.0:
        if TB_FINAL is None:
            TB_FINAL = table_layer(52.0)
        L = TB_FINAL
    else:
        L = table_layer(t)
    k = lerp(1.0, 0.70, sh)
    Ls = L if k == 1 else scaled(L, k)
    x = 540 - Ls.shape[1] / 2
    y = TB_Y0 + lerp(0, -10, sh)
    over(f, Ls, x, y, A)
    # green glow on 102,500 (ding)
    tp = 48.95 + 5 * 0.38 + 0.05
    if t >= tp + 0.7:
        gx = 540 + (TB_COLX["b"] - 540) * k
        gy = y + (150 + 5 * 96 + 40) * k
        add_glow_disc(f, gx, gy, 90 * k, GREEN, (0.10 + 0.35 * math.exp(-(t - tp - 0.7) * 4)) * A)
    # summary line during the build, fades before the next line appears
    put(f, rich(f"92,000 دج {ARROW} 102,500 دج", 64, WHITE, ncol=(WHITE, GREEN)), 540, 1180, t, 51.35, 52.0,
        glow=GREEN, gk=0.15)
    # after the shrink
    put(f, rich(f"الربح على الموصّل: 2,831 {ARROW} 3,154 دج", 60, WHITE, ncol=(RED, BLUE)), 540, 880, t, 52.5, t1)
    a, dy = vis(t, 53.1, t1)
    if a > 0:
        badge = rich("+10,500 دج", 120, INK, nweight="Black")
        pw, ph = badge.shape[1] + 120, 190
        pill = shape(pw, ph, lambda d, s: d.rounded_rectangle([0, 0, pw * s, ph * s], 95 * s, fill=GREEN + (255,)), 2)
        k2 = 0.88 + 0.12 * ease_out(seg(t, 53.1, 53.4))
        P = pill.copy()
        over_rgba(P, badge, (pw - badge.shape[1]) / 2, (ph - badge.shape[0]) / 2 + 4)
        P = scaled(P, k2)
        bx, by = 540 - P.shape[1] / 2, 1035 - P.shape[0] / 2 + dy
        add_glow(f, P, bx, by, GREEN, 0.5 * a, 24, cache=False)
        over(f, P, bx, by, a)
    put(f, rich(PER_LEADS, 58, (215, 220, 228), "Bold"), 540, 1195, t, 53.8, t1)


# ---------------------------------------------------------------- goal ------------------
GX0, GX1, GY0, GY1 = 200, 880, 400, 860


def s5c(f, t):   # 55.5 -> 59.0  ball into the goal, the net says «الربح على الموصّل»
    t0, t1 = 55.5, 59.0
    a, dy = vis(t, t0, t1)
    hit = 56.35
    bul = math.exp(-max(0, t - hit) * 5) * (1 if t >= hit else 0)
    if a > 0:
        hx, hy = 650, 735

        def fn(d, s, ox, oy):
            # back frame (depth) + net mesh with a bulge at the hit point
            ins = 50
            bx0, bx1, by0, by1 = GX0 + ins, GX1 - ins, GY0 + 30, GY1
            def disp(x, y):
                r2 = ((x - hx) ** 2 + (y - hy) ** 2) / (150 ** 2)
                k = bul * 40 * math.exp(-r2)
                return x + (x - hx) * 0.08 * bul * math.exp(-r2), y + k * 0.5
            netc = (170, 185, 205, 120)
            for xv in np.linspace(GX0 + 10, GX1 - 10, 22):
                pts = [disp(xv, yv) for yv in np.linspace(GY0 + 10, GY1, 24)]
                d.line([(x * s, y * s) for x, y in pts], fill=netc, width=int(2 * s))
            for yv in np.linspace(GY0 + 10, GY1, 18):
                pts = [disp(xv, yv) for xv in np.linspace(GX0 + 10, GX1 - 10, 30)]
                d.line([(x * s, y * s) for x, y in pts], fill=netc, width=int(2 * s))
            d.line([(GX0 * s, GY0 * s), (bx0 * s, by0 * s)], fill=(200, 210, 225, 200), width=int(4 * s))
            d.line([(GX1 * s, GY0 * s), (bx1 * s, by0 * s)], fill=(200, 210, 225, 200), width=int(4 * s))
            d.line([(bx0 * s, by0 * s), (bx1 * s, by0 * s)], fill=(200, 210, 225, 160), width=int(4 * s))
            # posts + crossbar
            pc = (248, 250, 252, 255)
            d.line([(GX0 * s, (GY1 + 4) * s), (GX0 * s, GY0 * s), (GX1 * s, GY0 * s), (GX1 * s, (GY1 + 4) * s)],
                   fill=pc, width=int(16 * s), joint="curve")
            d.line([((GX0 - 120) * s, (GY1 + 6) * s), ((GX1 + 120) * s, (GY1 + 6) * s)], fill=(120, 200, 140, 160), width=int(4 * s))
        im = shape(W, 1000, lambda d, s: fn(d, s, 0, 0), 2)
        over(f, im, 0, dy, a)
        # the net's line
        lab = rich("الربح على الموصّل", 66, GREEN)
        la = a * ease_out(seg(t, hit, hit + 0.3))
        if la > 0:
            add_glow(f, lab, 540 - lab.shape[1] / 2, 545 - lab.shape[0] / 2 + bul * 14, GREEN, 0.6 * la, 16)
            over(f, lab, 540 - lab.shape[1] / 2, 545 - lab.shape[0] / 2 + bul * 14, la)
        # ball
        if t < hit + 0.05:
            u = ease_io(seg(t, t0 + 0.15, hit))
            bx = lerp(930, hx, u)
            by = lerp(1180, hy, u) - math.sin(math.pi * u) * 260
            r = lerp(64, 34, u)
        else:
            bx, by, r = hx, hy + bul * 10, 34
        if t >= t0 + 0.15 or True:
            ang = t * 9

            def bfn(d, s, ox, oy):
                d.ellipse([(ox - r) * s, (oy - r) * s, (ox + r) * s, (oy + r) * s], fill=(246, 248, 250, 255), outline=(30, 34, 44, 255), width=int(2 * s))
                for k in range(5):
                    aa = ang + k * 2 * math.pi / 5
                    px, py = ox + math.cos(aa) * r * 0.62, oy + math.sin(aa) * r * 0.62
                    rr = r * 0.22
                    d.polygon([((px + rr * math.cos(aa + j * 1.2566)) * s, (py + rr * math.sin(aa + j * 1.2566)) * s) for j in range(5)], fill=(30, 34, 44, 255))
                rr = r * 0.26
                d.polygon([((ox + rr * math.cos(-ang + j * 1.2566)) * s, (oy + rr * math.sin(-ang + j * 1.2566)) * s) for j in range(5)], fill=(30, 34, 44, 255))
            local_draw(f, bx, by + dy, int(2 * r + 8), bfn, a)
        add_glow_disc(f, hx, hy, 80, GREEN, 0.5 * bul * a)
    put(f, rich("ما تقراش النسب وحدهم…", 58, (215, 220, 228), "Bold"), 540, 985, t, t0 + 0.1, t1)
    put(f, rich("اقرا الربح على الموصّل", 84, GREEN), 540, 1105, t, 57.0, t1, glow=GREEN, gk=0.35)


# ---------------------------------------------------------------- CTA -------------------
LOGO = None


def s6(f, t):   # 59.0 -> 62.0  logo (as is) + CTA
    global LOGO
    t0 = 59.0
    if LOGO is None:
        im = Image.open(LOGO_PATH).convert("RGBA")
        k = 520 / im.width
        LOGO = f32(im.resize((520, int(im.height * k)), Image.LANCZOS))
    put(f, LOGO, 540, 470, t, t0 + 0.05, None)
    put(f, rich(CTA_LINES[0], 92, ORANGE), 540, 760, t, t0 + 0.4, None, glow=ORANGE, gk=0.3)
    put(f, rich(CTA_LINES[1], 92, ORANGE), 540, 885, t, t0 + 0.85, None, glow=ORANGE, gk=0.3)


SCENES = [(0.0, 2.5, s1a), (2.5, 5.0, s1b), (5.0, 7.0, s1c), (7.0, 10.0, s1d), (10.0, 17.5, s2), (17.5, 20.0, s2c),
          (20.0, 22.5, s3a), (22.5, 29.0, s3b), (29.0, 32.5, s3c), (32.5, 36.5, s3d), (36.5, 40.0, s3e),
          (40.0, 42.5, s4a), (42.5, 45.5, s4b), (45.5, 48.5, s4c), (48.5, 55.5, s5), (55.5, 59.0, s5c), (59.0, 62.0, s6)]


def frame(t, n=0):
    f = BG.copy()
    for a, b, fn in SCENES:
        if a <= t < b:
            fn(f, t)
    put(f, rich(TAG_TEXT, 30, GREY, "Bold"), 540, 1262, t, TAG_T0, TAG_T1)
    f += NOISE[n % 2]
    return f


# =========================================================== output =====================
def render_range(f0, f1, path):
    enc = Encoder(path, crf=CRF)
    for n in range(f0, f1):
        enc.write(frame(n / FPS, n))
    enc.close()


def contact_sheet(times, path, cols=5, tw=216):
    th = int(tw * H / W)
    rows = math.ceil(len(times) / cols)
    sheet = Image.new("RGB", (cols * tw, rows * (th + 30)), (30, 30, 30))
    d = ImageDraw.Draw(sheet)
    for i, tt in enumerate(times):
        n = int(round(tt * FPS))
        fr = frame(n / FPS, n)
        im = Image.fromarray((np.clip(fr, 0, 1) * 255 + 0.5).astype(np.uint8))
        im.save(os.path.join(OUT, "preview", f"t{tt:05.2f}.png"))
        th_im = im.resize((tw, th), Image.LANCZOS)
        dd = ImageDraw.Draw(th_im)
        for yv, c in [(250, (90, 90, 90)), (CALM_Y, (255, 0, 255))]:    # guides on the sheet only
            dd.line([(0, yv * th / H), (tw, yv * th / H)], fill=c, width=1)
        r, c = divmod(i, cols)
        sheet.paste(th_im, (c * tw, r * (th + 30) + 30))
        d.text((c * tw + 6, r * (th + 30) + 6), f"{tt:.2f}s", fill=(255, 255, 255))
    sheet.save(path)


def main():
    T0 = float(os.environ.get("T0", 0))
    T1 = float(os.environ.get("T1", DUR))
    name = os.environ.get("NAME", "motion-full")
    f0, f1 = int(round(T0 * FPS)), int(round(T1 * FPS))
    if "PART" in os.environ:                       # child worker
        render_range(f0, f1, os.environ["PART"])
        return
    t_start = time.time()
    if not os.environ.get("SHEET_ONLY"):
        workers = int(os.environ.get("WORKERS", 4))
        bounds = np.linspace(f0, f1, workers + 1).astype(int)
        procs, parts = [], []
        for k in range(workers):
            p = os.path.join(OUT, f".{name}.part{k}.mp4")
            parts.append(p)
            env = dict(os.environ, PART=p, T0=str(bounds[k] / FPS), T1=str(bounds[k + 1] / FPS))
            procs.append(subprocess.Popen([sys.executable, os.path.abspath(__file__)], env=env))
        for p in procs:
            if p.wait():
                sys.exit("worker failed")
        lst = os.path.join(OUT, f".{name}.txt")
        with open(lst, "w") as fh:
            fh.writelines(f"file '{p}'\n" for p in parts)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy",
                        "-movflags", "+faststart", os.path.join(OUT, f"{name}.mp4")], check=True)
        for p in parts + [lst]:
            os.remove(p)
        print(f"video {name}.mp4 in {time.time() - t_start:.1f}s")
    step = os.environ.get("SHEET")
    if step:
        step = float(step)
        os.makedirs(os.path.join(OUT, "preview"), exist_ok=True)
        times = [round(T0 + 0.2 + k * step, 2) for k in range(int((T1 - T0) / step + 1e-6))]
        sname = os.environ.get("SHEET_NAME", "test-sheet.png" if name.startswith("test") else "full-sheet.png")
        contact_sheet(times, os.path.join(OUT, sname))
        print("sheet", sname)


if __name__ == "__main__":
    main()
