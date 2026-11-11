#!/usr/bin/env python3
"""Reel template 9:16 (1080x1920) in the course-kit look · job J0004 · task video.reel-template.

The frame is the REAL course master (`course-kit/background/master-eclairs-1920x1080.png`), 9-sliced:
  * the master is recomposed at its own resolution into a tall 1920 x 3413 canvas (= 9:16),
    so its width never changes: the top band (4 corners' top half, the top edge and the logo) and
    the bottom band (bottom corners, bottom edge and the controller with its beams) are copied pixel for pixel;
  * only the straight left/right edges get longer: the middle band is filled with real master rows
    (y 260 -> 860), tiled from different offsets, some flipped vertically, joined with long crossfades.
    The left and right halves use different tiles so the strands never repeat in lockstep;
  * a short pad above the master (smooth extension of its own top rows) pushes the logo below the phone's
    status bar / notch;
  * the tall canvas is then scaled once, uniformly, by 1080/1920 = 0.5625 -> 1080x1920.
    The logo and the controller therefore keep exactly the course size relative to the width; they are never
    redrawn, recoloured, or stretched.

Library use (from another render script):
    sys.path.insert(0, "edprod/projects/2026-11-11-reel-template"); import template as T
    bg = T.reel_frame()                 # float32 (1920,1080,3) in [0,1], cached
    R = T.layout_rects("R1")            # dict name -> (x0, y0, x1, y1) in reel px
    T.camera_window(f, R["camera"]) / T.lower_third(f, ...) / T.badge_building(f) / T.tag_example(f) ...

Run from the repo root to render the proposal stills:
    python3 edprod/projects/2026-11-11-reel-template/template.py
"""
import os
import re
import sys
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as nd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
KIT = os.path.join(ROOT, "edprod", "assets", "course-kit")
MASTER = os.path.join(KIT, "background", "master-eclairs-1920x1080.png")
FONTS = os.path.join(KIT, "fonts")
OUT = os.path.join(HERE, "out")

W, H = 1080, 1920
K = W / 1920                      # 0.5625: master px -> reel px (same as the course, relative to width)
CH = int(round(H / K))            # 3413: tall canvas height in master px

# ------------------------------------------------------------------ 9-slice knobs (master px) ---
TOP_PAD = 110                     # smooth pad above the master: logo clears the status bar / notch
TOP_BAND = 260                    # master rows 0..260 kept as they are (logo, top corners + their sparks)
BOT_BAND = 860                    # master rows 860..1080 kept as they are (controller, beams, bottom corners)
SRC0, SRC1 = 260, 860             # clean straight-edge rows used to extend the sides
TILE, XF = 470, 190               # tile length and crossfade length
SPLIT_X, SPLIT_XF = 960, 240      # left / right halves tiled independently, blended across the centre

# ------------------------------------------------------------------ course colours ---------------
BLUE = (40, 215, 255)             # #28D7FF
CAM_CYAN = (39, 207, 244)         # camera window border (03)
ORANGE = (255, 120, 20)           # #FF7814 underline, badge dot
BADGE_LINE = (255, 151, 40)       # «مازال يتعمّر» border
BADGE_TXT = (255, 221, 139)       # «مازال يتعمّر» text
PILL_TXT = (255, 170, 40)         # 09 pill text / border (gold-orange)
LT_SUB = (184, 236, 255)          # lower-third sub line
WHITE = (245, 246, 248)           # #F5F6F8
GREY = (150, 156, 165)            # #969CA5
PANEL = (8, 10, 15)               # badge / lower-third / pill fill
PLACEHOLDER = (72, 74, 84)        # grey camera placeholder (as in the kit previews)


# =================================================================== the frame ================
def _u8(path):
    return np.asarray(Image.open(path).convert("RGB")).astype(np.float32) / 255


def _ramp(n):
    return (np.arange(n, dtype=np.float32) + 0.5) / n


def _tiles(rng, length):
    """sequence of (src_y0, flip) tiles covering `length` rows with XF overlaps.
    first tile continues the master after TOP_BAND, last tile ends exactly at BOT_BAND."""
    n = max(2, int(np.ceil((length - XF) / (TILE - XF))))
    step = (length - TILE) / (n - 1)
    out = []
    for i in range(n):
        if i == 0:
            out.append((SRC0, False, 0))
        elif i == n - 1:
            out.append((SRC1 - TILE, False, int(round(length - TILE))))
        else:
            out.append((int(rng.integers(SRC0, SRC1 - TILE + 1)), bool(i % 2), int(round(i * step))))
    return out


def _tape(m, length, seed):
    """middle band (length x 1920) built from crossfaded master tiles."""
    rng = np.random.default_rng(seed)
    acc = np.zeros((length, m.shape[1], 3), np.float32)
    wsum = np.zeros((length, 1, 1), np.float32)
    tiles = _tiles(rng, length)
    for i, (s0, flip, y0) in enumerate(tiles):
        t = m[s0:s0 + TILE]
        if flip:
            t = t[::-1]
        w = np.ones(TILE, np.float32)
        if i > 0:
            w[:XF] = _ramp(XF)
        if i < len(tiles) - 1:
            w[-XF:] = _ramp(XF)[::-1]
        w = (w * w * (3 - 2 * w))[:, None, None]       # smoothstep crossfade
        acc[y0:y0 + TILE] += t * w
        wsum[y0:y0 + TILE] += w
    return acc / np.maximum(wsum, 1e-6)


def _resize(a, w, h):
    return np.stack([np.asarray(Image.fromarray(a[..., c], "F").resize((w, h), Image.LANCZOS))
                     for c in range(3)], -1)


@lru_cache(None)
def tall_master():
    """the 1920 x 3413 recomposed master (float32)."""
    m = _u8(MASTER)
    tall = np.zeros((CH, 1920, 3), np.float32)
    # 1) pad: smooth extension of the master's own top rows (+ matching grain)
    if TOP_PAD > 0:
        row = nd.gaussian_filter1d(m[0:6].mean(0), 6, axis=0)
        grain = m[300:800, 600:1300].std(axis=(0, 1)).mean() * 0.8
        rng = np.random.default_rng(3)
        pad = np.repeat(row[None], TOP_PAD, 0) + rng.normal(0, grain, (TOP_PAD, 1920, 1)).astype(np.float32)
        blend = _ramp(24)[:, None, None]                 # last 24 rows lean into the real row 0
        pad[-24:] = pad[-24:] * (1 - blend) + m[0][None] * blend
        tall[:TOP_PAD] = pad
    # 2) top band and bottom band exactly as they are
    y_mid0 = TOP_PAD + TOP_BAND
    tall[TOP_PAD:y_mid0] = m[:TOP_BAND]
    nb = 1080 - BOT_BAND
    tall[CH - nb:] = m[BOT_BAND:]
    # 3) middle: real edge rows, crossfaded tiles; left and right halves decorrelated
    length = CH - nb - y_mid0
    left, right = _tape(m, length, 21), _tape(m, length, 58)
    wx = np.clip((np.arange(1920) - (SPLIT_X - SPLIT_XF / 2)) / SPLIT_XF, 0, 1).astype(np.float32)
    wx = (wx * wx * (3 - 2 * wx))[None, :, None]
    tall[y_mid0:CH - nb] = left * (1 - wx) + right * wx
    return tall


@lru_cache(None)
def _frame_cached():
    return np.clip(_resize(tall_master(), W, H), 0, 1).astype(np.float32)


def reel_frame():
    """the 1080x1920 course frame, float32 RGB [0,1] (a fresh copy)."""
    return _frame_cached().copy()


def master_to_reel_y(y_master):
    """where a master row lands in the reel (top band only)."""
    return (TOP_PAD + y_master) * K


def master_bottom_to_reel_y(y_master):
    """where a master row of the bottom band lands in the reel."""
    return (CH - (1080 - y_master)) * K


# =================================================================== layout ===================
# reel px. Platform safe zone: key content y 250 -> 1500 · right rail x > 940 for y 900 -> 1700 ·
# caption covers y > 1500. Frame lines sit at x ~26 / ~1054; keep text inside x 90 -> 990.
SAFE = dict(top=250, bottom=1500, rail_x=940, rail_y0=900, rail_y1=1700, text_x0=90, text_x1=990)
BADGE_POS = (70, 182)             # «مازال يتعمّر»: top-left, just under the logo row (course: top-left too)
TAG_RIGHT = (1010, 182)           # «أرقام مثال»: top-right, same row (right edge anchored)


def layout_rects(state):
    """rects (x0, y0, x1, y1) in reel px for a layout state: 'R1' | 'R2' | 'R3'."""
    if state == "R1":       # motion big + camera small
        return dict(motion=(60, 250, 1020, 1250),
                    camera=(240, 1290, 840, 1700),
                    lower_third=(196, 1398, 646, 1484))
    if state == "R2":       # camera big + title on top + small motion window (left)
        return dict(title=(90, 236, 990, 352),
                    camera=(70, 376, 1010, 1700),
                    motion=(98, 1080, 438, 1452))
    if state == "R3":       # full card
        return dict(card=(90, 560, 990, 1060),
                    cta=(160, 1150, 920, 1250))
    raise ValueError(state)


# =================================================================== drawing helpers ==========
RAQM = ImageFont.Layout.RAQM
LAT = re.compile(r"[A-Za-z0-9][A-Za-z0-9,.%/×+\- ]*[A-Za-z0-9]|[A-Za-z0-9]")


@lru_cache(None)
def tj(weight, size):
    return ImageFont.truetype(os.path.join(FONTS, f"Tajawal-{weight}.ttf"), size, layout_engine=RAQM)


@lru_cache(None)
def ar(weight, size):
    f = ImageFont.truetype(os.path.join(FONTS, "Archivo-VF.ttf"), size, layout_engine=RAQM)
    f.set_variation_by_name(weight)
    return f


def _run(s, fnt, col, rtl):
    im = Image.new("RGBA", (int(fnt.size * (len(s) + 2) * 0.9) + 40, int(fnt.size * 2.2)), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((20, int(fnt.size * 0.4)), s, font=fnt, fill=tuple(col) + (255,),
                            direction="rtl" if rtl else None)
    return im


def text_img(s, size, col=WHITE, weight="ExtraBold", lat_weight=None, lat_k=0.92):
    """mixed Arabic (Tajawal, RAQM) + Latin/numbers (Archivo) on one baseline. Returns RGBA uint8 PIL, tight."""
    rtl = any("؀" <= ch <= "ۿ" for ch in s)
    parts, pos = [], 0
    for mt in LAT.finditer(s):
        if s[pos:mt.start()].strip():
            parts.append(("ar", s[pos:mt.start()].strip()))
        parts.append(("lat", mt.group()))
        pos = mt.end()
    if s[pos:].strip():
        parts.append(("ar", s[pos:].strip()))
    if not rtl:
        parts = [("lat", s)]
    asc = int(size * 1.05)                          # common baseline
    imgs = []
    for kind, txt in parts:
        if kind == "ar":
            fnt = tj(weight, size)
        else:
            fnt = ar(lat_weight or weight, int(size * lat_k))
        im = Image.new("RGBA", (int(size * (len(txt) + 2) * 0.9) + 40, int(size * 2.4)), (0, 0, 0, 0))
        ImageDraw.Draw(im).text((20, asc), txt, font=fnt, fill=tuple(col) + (255,), anchor="ls",
                                direction="rtl" if kind == "ar" else None)
        bb = im.getbbox()
        imgs.append(im.crop((bb[0], 0, bb[2], im.height)))
    if rtl:
        imgs = imgs[::-1]                           # first logical run sits on the right
    gap = int(size * 0.26)
    tw = sum(i.width for i in imgs) + gap * (len(imgs) - 1)
    out = Image.new("RGBA", (tw, imgs[0].height), (0, 0, 0, 0))
    x = 0
    for i in imgs:
        out.alpha_composite(i, (x, 0))
        x += i.width + gap
    bb = out.getbbox()
    return out.crop((0, bb[1], out.width, bb[3]))


def _f(im):
    return np.asarray(im).astype(np.float32) / 255


def over(f, a, x, y, alpha=1.0):
    """alpha-composite RGBA (PIL or float) onto float frame at top-left (x, y)."""
    if isinstance(a, Image.Image):
        a = _f(a)
    h, w = a.shape[:2]
    x, y = int(round(x)), int(round(y))
    x0, y0, x1, y1 = max(0, x), max(0, y), min(f.shape[1], x + w), min(f.shape[0], y + h)
    if x1 > x0 and y1 > y0:
        s = a[y0 - y:y1 - y, x0 - x:x1 - x]
        k = s[..., 3:4] * alpha
        f[y0:y1, x0:x1] = s[..., :3] * k + f[y0:y1, x0:x1] * (1 - k)


def add_glow(f, a, x, y, col, k, sigma=12):
    """additive glow from an RGBA alpha, padded 3.5 sigma so it never shows a box edge."""
    if isinstance(a, Image.Image):
        a = _f(a)
    pad = int(sigma * 3.5) + 4
    g = nd.gaussian_filter(np.pad(a[..., 3], pad), sigma)[..., None] * (np.array(col, np.float32) / 255 * k)
    h, w = g.shape[:2]
    x0, y0 = int(round(x)) - pad, int(round(y)) - pad
    a0, b0, a1, b1 = max(0, x0), max(0, y0), min(f.shape[1], x0 + w), min(f.shape[0], y0 + h)
    if a1 > a0 and b1 > b0:
        f[b0:b1, a0:a1] += g[b0 - y0:b1 - y0, a0 - x0:a1 - x0]


def shape(w, h, fn, ss=4):
    """anti-aliased RGBA drawn at ss x then reduced. fn(draw, ss)."""
    im = Image.new("RGBA", (int(w * ss), int(h * ss)), (0, 0, 0, 0))
    fn(ImageDraw.Draw(im), ss)
    return im.resize((int(w), int(h)), Image.LANCZOS)


def rrect(w, h, r, fill=None, fa=1.0, line=None, lw=2, la=1.0):
    def fn(d, s):
        d.rounded_rectangle([lw / 2 * s, lw / 2 * s, (w - lw / 2) * s - 1, (h - lw / 2) * s - 1], r * s,
                            fill=None if fill is None else tuple(fill) + (int(255 * fa),),
                            outline=None if line is None else tuple(line) + (int(255 * la),), width=int(lw * s))
    return shape(w, h, fn)


def rr_mask(w, h, r):
    return _f(rrect(w, h, r, fill=(255, 255, 255)))[..., 3:4]


# =================================================================== course elements ==========
def camera_window(f, rect, label="الكاميرا", r=30, content=None, label_y=0.5):
    """03 style: rounded window, thin cyan border. content: float RGB (h, w, 3) to show inside,
    else the grey placeholder with a label."""
    x0, y0, x1, y1 = rect
    w, h = x1 - x0, y1 - y0
    m = rr_mask(w, h, r)
    if content is None:
        content = np.ones((h, w, 3), np.float32) * np.array(PLACEHOLDER, np.float32) / 255
        if label:
            t = text_img(label, 46, (190, 195, 205), "Bold")
            ci = Image.fromarray((content * 255).astype(np.uint8)).convert("RGBA")
            ci.alpha_composite(t, ((w - t.width) // 2, int(h * label_y - t.height / 2)))
            content = _f(ci.convert("RGB"))
    f[y0:y1, x0:x1] = content * m + f[y0:y1, x0:x1] * (1 - m)
    over(f, rrect(w, h, r, line=CAM_CYAN, lw=2.5), x0, y0)


def badge_building(f, pos=BADGE_POS, k=1.0):
    """10 «مازال يتعمّر»: dark pill, orange-gold border, orange dot on the left, cream text."""
    t = text_img("مازال يتعمّر", int(27 * k), BADGE_TXT, "Bold")
    h = int(46 * k)
    w = int(t.width + 76 * k)
    x, y = pos
    over(f, rrect(w, h, h / 2, fill=PANEL, fa=0.94, line=BADGE_LINE, lw=2.2 * k), x, y)
    d = int(15 * k)
    over(f, shape(d, d, lambda dr, s: dr.ellipse([0, 0, d * s - 1, d * s - 1], fill=ORANGE + (255,))),
         x + int(17 * k), y + (h - d) // 2)
    over(f, t, x + int(44 * k), y + (h - t.height) // 2 + 1)
    return (x, y, x + w, y + h)


def tag_example(f, right=TAG_RIGHT, text="أرقام مثال", k=1.0):
    """«أرقام مثال» tag: same pill family as the badge, quiet grey (it labels, it does not shout)."""
    t = text_img(text, int(27 * k), (200, 205, 212), "Bold")
    h = int(46 * k)
    w = int(t.width + 48 * k)
    x, y = right[0] - w, right[1]
    over(f, rrect(w, h, h / 2, fill=PANEL, fa=0.94, line=GREY, lw=2.2 * k, la=0.9), x, y)
    over(f, t, x + (w - t.width) // 2, y + (h - t.height) // 2 + 1)
    return (x, y, x + w, y + h)


def lower_third(f, rect, name="النحلة", sub="ecommanita × tassyir"):
    """08: dark panel, cyan border, cyan accent bar on the right (RTL), name + sub line right-aligned."""
    x0, y0, x1, y1 = rect
    w, h = x1 - x0, y1 - y0
    over(f, rrect(w, h, 20, fill=PANEL, fa=0.93, line=BLUE, lw=2.5), x0, y0)
    bw, bh = 7, int(h * 0.62)
    over(f, rrect(bw, bh, 3.5, fill=BLUE), x1 - 22, y0 + (h - bh) // 2)
    tn = text_img(name, 40, WHITE, "ExtraBold")
    ts = text_img(sub, 25, LT_SUB, "Medium", lat_weight="Medium", lat_k=1.0)
    gap = 10
    tot = tn.height + gap + ts.height
    yy = y0 + (h - tot) // 2
    over(f, tn, x1 - 40 - tn.width, yy)
    over(f, ts, x1 - 40 - ts.width, yy + tn.height + gap)


def underline(f, cx, y, w, col=ORANGE, th=7, glow=0.35):
    im = rrect(w, th, th / 2, fill=col)
    if glow:
        add_glow(f, im, cx - w / 2, y, col, glow, 8)
    over(f, im, cx - w / 2, y)


def cta_pill(f, rect, text, col=PILL_TXT, size=50):
    """09 style pill: dark fill, thin gold-orange border, gold-orange text."""
    x0, y0, x1, y1 = rect
    w, h = x1 - x0, y1 - y0
    t = text_img(text, size, col, "Bold")
    p = rrect(w, h, h / 2, fill=PANEL, fa=0.9, line=col, lw=2.6)
    add_glow(f, p, x0, y0, col, 0.10, 14)
    over(f, p, x0, y0)
    over(f, t, x0 + (w - t.width) / 2, y0 + (h - t.height) / 2 + 2)


def title_block(f, cy, s, size=84, line_col=BLUE, line_w=220):
    """02 style: white ExtraBold title, numbers in Archivo, short cyan underline."""
    t = text_img(s, size, WHITE, "ExtraBold")
    x = (W - t.width) / 2
    y = cy - t.height / 2
    add_glow(f, t, x, y, WHITE, 0.10, 12)
    over(f, t, x, y)
    underline(f, W / 2, y + t.height + 26, line_w, line_col, 6, 0.3)
    return (x, y, x + t.width, y + t.height)


# =================================================================== motion sample ============
def clash_sample(t=9.7):
    """the clash video's «65/50 ≠ 50/65» moment, drawn by the clash render itself on a transparent-ish
    dark layer. Returns (rgb, alpha) 1080x1920 float arrays: rgb = what the scene adds, alpha = coverage."""
    sys.path.insert(0, os.path.join(ROOT, "edprod", "projects", "2026-11-11-clash-65-50"))
    import render as clash                          # noqa: E402  (module import has no side effects beyond its out/ dir)
    base = np.zeros((H, W, 3), np.float32)
    clash.s1d(base, t)
    return base


def put_motion(f, rect, layer, src_rect=None, r=0, border=None):
    """place a 1080x1920 motion layer into rect. src_rect: region of the layer to show (scaled to fit).
    Composite is additive-on-dark (the motion track is drawn on black), so it blends into the frame."""
    x0, y0, x1, y1 = rect
    sx0, sy0, sx1, sy1 = src_rect or rect
    crop = layer[sy0:sy1, sx0:sx1]
    if (sx1 - sx0, sy1 - sy0) != (x1 - x0, y1 - y0):
        crop = _resize(crop, x1 - x0, y1 - y0)
    crop = np.clip(crop, 0, 1.5)
    if r:
        m = rr_mask(x1 - x0, y1 - y0, r)
        dark = np.array([5, 7, 10], np.float32) / 255
        f[y0:y1, x0:x1] = (dark + crop) * m + f[y0:y1, x0:x1] * (1 - m)
        if border:
            over(f, rrect(x1 - x0, y1 - y0, r, line=border, lw=2.5), x0, y0)
    else:
        # lighten: the motion is drawn on black, so max() keeps the frame's dark interior untouched
        f[y0:y1, x0:x1] = np.maximum(f[y0:y1, x0:x1], crop)


# =================================================================== proposals ================
def render_R1(sample):
    f = reel_frame()
    R = layout_rects("R1")
    put_motion(f, R["motion"], sample)
    camera_window(f, R["camera"], label_y=0.72)   # label stays clear of the lower third
    lower_third(f, R["lower_third"])
    badge_building(f)
    tag_example(f)
    return f


def render_R2(sample):
    f = reel_frame()
    R = layout_rects("R2")
    title_block(f, 284, "65/50 = 50/65 ؟", 80)
    camera_window(f, R["camera"])
    # small motion window: the two cards + ≠ (clash layer region x 190..890, y 235..1001, same aspect as the window)
    put_motion(f, R["motion"], sample, src_rect=(190, 235, 890, 1001), r=22, border=CAM_CYAN)
    badge_building(f)
    tag_example(f)
    return f


def render_R3():
    f = reel_frame()
    R = layout_rects("R3")
    lines = ["اقرا الربح", "على الموصّل"]
    ims = [text_img(s, 124, WHITE, "ExtraBold") for s in lines]
    lh = 150
    cy0 = 760
    for i, im in enumerate(ims):
        x = (W - im.width) / 2
        y = cy0 + i * lh - im.height / 2
        add_glow(f, im, x, y, WHITE, 0.10, 14)
        over(f, im, x, y)
    underline(f, W / 2, cy0 + lh + 105, 360, ORANGE, 8, 0.4)
    cta_pill(f, R["cta"], "احفظ الفيديو… واحسب سلعتك", size=48)
    badge_building(f)
    return f


def save(f, path):
    Image.fromarray((np.clip(f, 0, 1) * 255 + 0.5).astype(np.uint8)).save(path)


def safe_overlay(f):
    """R1 with the platform zones drawn semi-transparent."""
    im = Image.fromarray((np.clip(f, 0, 1) * 255 + 0.5).astype(np.uint8)).convert("RGBA")
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    d.rectangle([0, 0, W, SAFE["top"]], fill=(255, 210, 40, 70))                        # top app UI
    d.rectangle([0, SAFE["bottom"], W, H], fill=(255, 59, 59, 80))                     # caption
    d.rectangle([SAFE["rail_x"], SAFE["rail_y0"], W, SAFE["rail_y1"]], fill=(170, 80, 255, 95))   # rail
    d.rectangle([SAFE["text_x0"], SAFE["top"], SAFE["text_x1"], SAFE["bottom"]], outline=(43, 217, 107, 230), width=4)
    for k, v in layout_rects("R1").items():
        d.rectangle(v, outline=(255, 255, 255, 150), width=2)
    im.alpha_composite(ov)
    lab = [("واجهة التطبيق · فوق 250", (540, 125), (255, 225, 120)),
           ("الكابشن يغطّي · تحت 1500", (540, 1560), (255, 150, 150)),
           ("المحتوى المهم", (540, 290), (120, 240, 160))]
    for s, (cx, cy), col in lab:
        t = text_img(s, 40, col, "Bold")
        bg = rrect(t.width + 40, t.height + 24, 14, fill=(0, 0, 0), fa=0.7)
        im.alpha_composite(bg, (int(cx - bg.width / 2), int(cy - bg.height / 2)))
        im.alpha_composite(t, (int(cx - t.width / 2), int(cy - t.height / 2)))
    t = text_img("أزرار لايك/كومنتير", 30, (225, 190, 255), "Bold")
    t = t.rotate(90, expand=True)
    im.alpha_composite(t, (W - 40 - t.width, int(1300 - t.height / 2)))
    return im.convert("RGB")


def contact(frames, labels, path, tw=560, gap=30):
    th = int(tw * H / W)
    sheet = Image.new("RGB", (gap + len(frames) * (tw + gap), th + 2 * gap + 70), (16, 18, 24))
    for i, (fr, lb) in enumerate(zip(frames, labels)):
        im = Image.fromarray((np.clip(fr, 0, 1) * 255 + 0.5).astype(np.uint8)).resize((tw, th), Image.LANCZOS)
        x = gap + i * (tw + gap)
        sheet.paste(im, (x, gap))
        t = text_img(lb, 34, WHITE, "Bold")
        sheet.paste(t, (x + (tw - t.width) // 2, gap + th + 22), t)
    sheet.save(path)


def main():
    os.makedirs(OUT, exist_ok=True)
    sample = clash_sample(9.7)
    r1, r2, r3 = render_R1(sample), render_R2(sample), render_R3()
    save(reel_frame(), os.path.join(OUT, "R0-frame-vide.png"))
    save(r1, os.path.join(OUT, "R1-motion-camera.png"))
    save(r2, os.path.join(OUT, "R2-camera-big.png"))
    save(r3, os.path.join(OUT, "R3-full-card.png"))
    contact([r1, r2, r3], ["R1 · موشن كبير + كاميرا", "R2 · كاميرا كبيرة", "R3 · كارطة كاملة"],
            os.path.join(OUT, "sheet.png"))
    safe_overlay(r1).save(os.path.join(OUT, "safe-overlay.png"))
    print("logo rows (reel):", round(master_to_reel_y(24)), "->", round(master_to_reel_y(155)))
    print("controller rows (reel):", round(master_bottom_to_reel_y(907)), "->", round(master_bottom_to_reel_y(1049)))


if __name__ == "__main__":
    main()
