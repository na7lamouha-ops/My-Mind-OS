"""Teaser v5: hook5 timing + sound, our image quality, realistic ECOMMANITA bullet.

usage: render_v5.py <bullet.png> <layers_dir> <tajawal_dir> <env30.npy> <out_video.mp4> [preview_dir]
Timeline (s, follows hook5 vertical exactly; text types while its typewriter sound plays):
  0.30-1.37  "اليوم... أول نوفمبر" (orange)          out 2.37-2.50
  2.90-6.43  تحية ... / ...ولعبقرية تنظيمهم.          out 6.67-6.80
  7.30-8.77  الثورة ما بداتش بالصدفة...                out 9.87-10.0
 10.40-11.10 ...ولا بالقوة.   + list items 11.40 / 12.73 / 14.00 / 15.27   cut 16.83
  0 - 16.8   bullets on the floor, hero ECOMMANITA; hero rises + dissolves 16.83-17.6
 17.80-19.0  bullet flies to the centre; 19.0 orange/blue tech explosion (driven by the audio envelope)
 20.37       logo ignites; pillars 21.13 / 21.93 / 22.73 / 23.53; 24.20 burst + controller lights up
 24.93-25.1  pillars out; 25.4 labels المانيطة / Tassyir; 25.97-26.4 light bars
 27.40-29.0  الهدف: نحرّرو العقل من التشتّت.
 29.40-31.3  لقينا المانيطة... واللعبة بدات.      31.3 CTA box     34.2-34.5 out     34.5 يتبع...
"""
import math
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as nd

SPRITE, LAYERS, FONTS, ENV, OUT, ORIG = sys.argv[1:7]
PREV = sys.argv[7] if len(sys.argv) > 7 else None
W, H, FPS = 1080, 1920, 30
TOTAL = 35 * FPS
rng = np.random.default_rng(1954)
ENVDB = np.load(ENV)


def env_at(t):
    i = min(len(ENVDB) - 1, max(0, int(t * FPS)))
    return float(np.clip((ENVDB[i] + 30) / 22, 0, 1))      # -30 dB -> 0, -8 dB -> 1


def clamp01(x): return min(1.0, max(0.0, x))
def ease_io(x): x = clamp01(x); return 3 * x * x - 2 * x ** 3
def ease_out2(x): x = clamp01(x); return 1 - (1 - x) ** 2
def ease_in3(x): x = clamp01(x); return x ** 3


def over(dst, src, x, y, alpha_mul=1.0):
    h, w = src.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(dst.shape[1], x + w), min(dst.shape[0], y + h)
    if x1 <= x0 or y1 <= y0 or alpha_mul <= 0:
        return
    s = src[y0 - y:y1 - y, x0 - x:x1 - x]
    a = s[..., 3:4] * alpha_mul
    dst[y0:y1, x0:x1] = s[..., :3] * a + dst[y0:y1, x0:x1] * (1 - a)


def add(dst, rgb, x, y):
    h, w = rgb.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(dst.shape[1], x + w), min(dst.shape[0], y + h)
    if x1 > x0 and y1 > y0:
        dst[y0:y1, x0:x1] += rgb[y0 - y:y1 - y, x0 - x:x1 - x]


def draw_glow(f, x, y, r, col, inten):
    R = int(r * 3) + 2
    x0, y0 = int(x) - R, int(y) - R
    yy, xx = np.mgrid[0:2 * R, 0:2 * R].astype(np.float32)
    g = np.exp(-(((xx + x0 - x) ** 2 + (yy + y0 - y) ** 2) / (r * r))) * inten
    add(f, g[..., None] * np.array(col, np.float32), x0, y0)


def to_rgba_f(im):
    return np.asarray(im.convert("RGBA")).astype(np.float32) / 255


def resize_rgba(a, s):
    h, w = a.shape[:2]
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "RGBA")
    return to_rgba_f(im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS))


# ------------------------------------------------------------------- text ------
RAQM = ImageFont.Layout.RAQM


def font(weight, size):
    return ImageFont.truetype(f"{FONTS}/Tajawal-{weight}.ttf", size, layout_engine=RAQM)


ORANGE = (1.0, 0.58, 0.16)
CYAN = (0.33, 0.84, 1.0)
WHITE = (1.0, 1.0, 1.0)
GREY = (0.74, 0.74, 0.74)


def text_img(txt, fnt, col=WHITE, glow=0.0, glow_col=None):
    tmp = Image.new("L", (1600, 400), 0)
    ImageDraw.Draw(tmp).text((800, 200), txt, font=fnt, fill=255, anchor="mm", direction="rtl")
    bb = tmp.getbbox()
    tmp = tmp.crop((bb[0] - 40, bb[1] - 40, bb[2] + 40, bb[3] + 40))
    a = np.asarray(tmp).astype(np.float32) / 255
    img = np.dstack([np.ones(a.shape + (3,), np.float32) * np.array(col, np.float32), a])
    g = nd.gaussian_filter(a, 10) * glow if glow else None
    return {"img": img, "glow": g, "gcol": np.array(glow_col or col, np.float32)}


class TypeLine:
    """RTL typewriter line: reveals from the right edge between t0 and t1; fades out [o0, o1]."""

    def __init__(self, txt, fnt, col, cx, cy, t0, t1, o0, o1, glow=0.0, anchor="c", cursor=True):
        self.t = text_img(txt, fnt, col, glow)
        self.cx, self.cy, self.t0, self.t1, self.o0, self.o1 = cx, cy, t0, t1, o0, o1
        self.anchor, self.cursor = anchor, cursor

    def draw(self, f, t, extra_alpha=1.0):
        if t < self.t0 or t > self.o1:
            return
        img = self.t["img"].copy()
        h, w = img.shape[:2]
        v = clamp01((t - self.t0) / max(1e-3, self.t1 - self.t0))
        edge = int(w - 40 - (w - 80) * v)
        img[:, :max(0, edge), 3] = 0
        a = (1 - ease_io((t - self.o0) / max(1e-3, self.o1 - self.o0))) * extra_alpha
        x = int(self.cx - w / 2) if self.anchor == "c" else int(self.cx - w + 40)
        y = int(self.cy - h / 2)
        if self.t["glow"] is not None:
            g = self.t["glow"].copy()
            g[:, :max(0, edge)] = 0
            add(f, g[..., None] * self.t["gcol"] * a, x, y)
        over(f, img, x, y, alpha_mul=a)
        if self.cursor and v < 1 and a > 0.5:
            cxp = x + max(edge, 40) - 12
            f[int(self.cy - h * 0.28):int(self.cy + h * 0.28), cxp:cxp + 5] = np.array(ORANGE, np.float32)


# ------------------------------------------------------------- bullets / floor ---
spr_full = Image.open(SPRITE).convert("RGBA")
SPR_D, SPR_PAD = 360, 8
spr_case = spr_full.crop((0, 0, SPR_PAD + int(3.2 * SPR_D), spr_full.height))


def sprite(kind, D, rot=0.0, bright=1.0):
    s = spr_full if kind == "live" else spr_case
    sc = D / SPR_D
    im = s.resize((max(1, round(s.width * sc)), max(1, round(s.height * sc))), Image.LANCZOS)
    if rot:
        im = im.rotate(rot, resample=Image.BICUBIC, expand=True)
    a = to_rgba_f(im)
    a[..., :3] *= bright
    return a


FY = -280  # floor lifted into the safe zone
HERO = dict(cx=540, cy=1610 + FY, D=118)
ITEMS_F = [(150, 1440, 34, -14, "case", 0.45), (420, 1418, 30, 22, "live", 0.42),
           (705, 1432, 32, -30, "case", 0.45), (960, 1452, 36, 10, "live", 0.5),
           (85, 1560, 48, 28, "live", 0.6), (990, 1548, 46, -24, "case", 0.6),
           (130, 1740, 62, -8, "case", 0.7), (940, 1752, 64, 16, "live", 0.7)]


def floor_base():
    f = np.zeros((H, W, 3), np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    f += np.clip((yy - (1360 + FY)) / 220, 0, 1)[..., None] * np.array([0.03, 0.026, 0.022]) * \
        np.clip(1 - (yy - (1600 + FY)) / 500, 0, 1)[..., None]
    pool = np.exp(-(((xx - 540) / 470) ** 2 + ((yy - (1650 + FY)) / 200) ** 2))
    f += pool[..., None] * np.array([0.18, 0.12, 0.055])
    return f


def put(f, s, cx, cy, refl=True):
    h, w = s.shape[:2]
    x, y = int(cx - w / 2), int(cy - h / 2)
    a = s[..., 3]
    rows = np.nonzero(a.max(1) > 0.5)[0]
    bottom = y + (rows.max() if len(rows) else h)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    D = h * 0.6
    sh = np.exp(-(((xx - cx) / (w * 0.42)) ** 2 + ((yy - bottom) / (D * 0.16)) ** 2)) * 0.7
    f *= (1 - sh)[..., None]
    if refl:
        r = s[::-1].copy()
        r[..., 3] *= 0.28 * np.clip(1 - np.arange(h) / (h * 0.75), 0, 1)[:, None] ** 1.6
        r = np.dstack([nd.gaussian_filter(r[..., c], 1.3) for c in range(4)])
        over(f, r, x, 2 * bottom - (y + h))
    over(f, s, x, y)


floor_static = floor_base()
for cx, cy, D, rot, kind, br in ITEMS_F:
    put(floor_static, sprite(kind, D, rot, br), cx, cy + FY)
hero = sprite("live", HERO["D"])
hh_, hw_ = hero.shape[:2]
hx, hy = int(HERO["cx"] - hw_ / 2), int(HERO["cy"] - hh_ / 2)
hero_lum = hero[..., :3].mean(-1) ** 0.6
hero_bottom = hy + np.nonzero(hero[..., 3].max(1) > 0.5)[0].max()
hero_refl = hero[::-1].copy()
hero_refl[..., 3] *= 0.3 * np.clip(1 - np.arange(hh_) / (hh_ * 0.8), 0, 1)[:, None] ** 1.5
hero_refl = np.dstack([nd.gaussian_filter(hero_refl[..., c], 1.2) for c in range(4)])
YYh, XXh = np.mgrid[0:hh_, 0:hw_].astype(np.float32)
NM = 70
motes = np.stack([rng.uniform(0, W, NM), rng.uniform(250, H - 250, NM), rng.uniform(0.6, 2.2, NM),
                  rng.uniform(0.08, 0.3, NM), rng.uniform(-6, 10, NM), rng.uniform(-18, -4, NM)], 1)


def floor_scene(t):
    f = floor_static.copy()
    u = clamp01((t - 8.8) / 0.75)
    if u < 1:
        h = hero.copy()
        for t0, dur, k in [(0.2, 1.1, 0.95), (3.4, 1.0, 0.55), (7.0, 1.0, 0.5)]:
            v = (t - t0) / dur
            if 0 <= v <= 1:
                xs = -80 + (hw_ + 160) * ease_io(v)
                band = np.exp(-(((XXh - xs) - 0.45 * (YYh - hh_ / 2)) / 36) ** 2)
                h[..., :3] += (band * hero_lum * k)[..., None] * np.array([1.0, 0.9, 0.68], np.float32)
        if u > 0:
            h = np.dstack([nd.gaussian_filter(h[..., c], 5 * u) for c in range(4)])
        over(f, hero_refl, hx, 2 * hero_bottom - (hy + hh_), alpha_mul=1 - u)
        over(f, h, hx, int(hy - 70 * ease_io(u)), alpha_mul=1 - ease_io(u))
        if u > 0:
            for i in range(26):
                age = t - (8.8 + (i / 26) * 0.55)
                if 0 <= age < 0.7:
                    draw_glow(f, hx + 40 + (i * 97) % (hw_ - 80), HERO["cy"] - 20 - 160 * age,
                              2.2, ORANGE if i % 2 else CYAN, 0.9 * (1 - age / 0.7))
    f *= 1 - ease_io((t - 9.0) / 0.8)
    s = 1 + 0.05 * min(t, 9.0) / 9.0
    im = Image.fromarray((np.clip(f, 0, 1) * 255).astype(np.uint8)).resize((round(W * s), round(H * s)), Image.BICUBIC)
    ox, oy = round(540 * s - 540), round(HERO["cy"] * s - HERO["cy"])
    return np.asarray(im.crop((ox, oy, ox + W, oy + H))).astype(np.float32) / 255


def draw_motes(f, t, k=1.0):
    for x, y, r, b, vx, vy in motes:
        px, py = (x + vx * t) % W, 250 + ((y - 250 + vy * t) % (H - 500))
        draw_glow(f, px, py, r, (1.0, 0.8, 0.55), b * 0.55 * k)


# -------------------------------------------------------------- bullet flight ---
bcache = {}
EXC = np.array([540.0, 960.0])


def bullet(f, t):
    u = clamp01((t - 17.62) / 1.38)
    D = 70 + 90 * ease_in3(u)
    L = 4.68 * D
    tip = np.array([-40 + (EXC[0] + L * 0.5 + 40) * ease_out2(min(1, u * 1.15)) if u < 0.87 else 0, 0])
    c_start = np.array([-L / 2 - 40, 1000.0])
    c_end = EXC - np.array([L * 0.5 - 30, 0])
    c = c_start + (c_end - c_start) * ease_io(u)
    key = round(D, 1)
    if key not in bcache:
        s = sprite("live", D)
        pad = int(0.5 * D) + 4
        sp = np.pad(s, ((pad, pad), (pad, pad), (0, 0)))
        bcache[key] = (sp, nd.gaussian_filter(sp[..., 3], max(2, 0.16 * D)))
    sp, gl = bcache[key]
    h, w = sp.shape[:2]
    x, y = int(c[0] - w / 2 + L / 2 - L / 2), int(c[1] - h / 2)
    add(f, (gl * (1 - sp[..., 3]))[..., None] * np.array([1.0, 0.66, 0.24], np.float32) * 0.5, x, y)
    for k in range(4):
        over(f, sp, int(x - 10 * k), y, alpha_mul=1.0 if k == 0 else 0.25 / k)
    g = math.exp(-((t - 18.93) / 0.05) ** 2)
    if g > 0.02:
        tipx, R = c[0] + L / 2 + 6, int(D * 1.6)
        yy, xx = np.mgrid[-R:R, -R:R].astype(np.float32)
        star = (np.exp(-(yy / 2.5) ** 2) * np.exp(-np.abs(xx) / (R * 0.35)) +
                np.exp(-(xx / 2.5) ** 2) * np.exp(-np.abs(yy) / (R * 0.25)) +
                np.exp(-(xx ** 2 + yy ** 2) / (0.12 * R) ** 2) * 2)
        add(f, (star * g)[..., None] * np.array([1.0, 0.95, 0.85], np.float32), int(tipx) - R, int(c[1]) - R)


# ----------------------------------------------------- orange/blue tech explosion -
def make_particles(n, t0, cx, cy, speed=(300, 1900), cyan_ratio=0.5):
    ang = rng.uniform(0, 2 * np.pi, n)
    sp = np.exp(rng.uniform(np.log(speed[0]), np.log(speed[1]), n))
    cy_ = rng.random(n) < cyan_ratio
    life = rng.uniform(0.45, 1.3, n)
    return dict(t0=t0, cx=cx, cy=cy, vx=np.cos(ang) * sp, vy=np.sin(ang) * sp, cyan=cy_, life=life,
                size=rng.uniform(1.2, 3.2, n), seed=rng.integers(0, 1 << 30, n))


P1 = make_particles(900, 19.0, *EXC)
P2 = make_particles(380, 24.2, 540, 770, speed=(250, 1300))


def splat_particles(f, P, t, k_env):
    tau = t - P["t0"]
    if tau < 0 or tau > 1.4:
        return
    kd = 2.6
    acc = np.zeros((H, W, 3), np.float32)
    for back, wgt in [(0.0, 1.0), (0.012, 0.6), (0.024, 0.4), (0.036, 0.25)]:
        tb = max(0.0, tau - back)
        disp = (1 - np.exp(-kd * tb)) / kd
        px = P["cx"] + P["vx"] * disp
        py = P["cy"] + P["vy"] * disp + np.where(P["cyan"], 0, 380 * tb * tb)
        alive = (tau < P["life"])
        fade = np.clip(1 - tau / P["life"], 0, 1) ** 1.3
        # cyan = digital: flicker on/off per particle
        flick = np.where(P["cyan"], ((P["seed"] + int(t * 60)) % 3 != 0).astype(np.float32), 1.0)
        a = fade * flick * alive * wgt
        xi, yi = np.round(px).astype(int), np.round(py).astype(int)
        ok = (xi >= 0) & (xi < W) & (yi >= 0) & (yi < H) & (a > 0.01)
        col = np.where(P["cyan"][:, None], np.array(CYAN), np.array(ORANGE))
        np.add.at(acc, (yi[ok], xi[ok]), (col[ok] * a[ok, None]).astype(np.float32))
    soft = np.dstack([nd.gaussian_filter(acc[..., c], 2.2) for c in range(3)]) * 28
    f += (acc * 2.5 + soft) * (0.6 + 0.6 * k_env)


def bolt_points(x0, y0, ang, length, seed, depth=6):
    r = np.random.default_rng(seed)
    pts = [np.array([x0, y0]), np.array([x0 + np.cos(ang) * length, y0 + np.sin(ang) * length])]
    disp = length * 0.22
    for _ in range(depth):
        new = [pts[0]]
        for a_, b_ in zip(pts[:-1], pts[1:]):
            m = (a_ + b_) / 2
            d = b_ - a_
            nrm = np.array([-d[1], d[0]]) / (np.linalg.norm(d) + 1e-9)
            new += [m + nrm * r.uniform(-disp, disp), b_]
        pts = new
        disp *= 0.55
    return np.array(pts)


def draw_bolts(f, t, cx, cy, n, t0, dur, length, col):
    tau = t - t0
    if tau < 0 or tau > dur:
        return
    acc = np.zeros((H, W), np.float32)
    for i in range(n):
        seed = i * 97 + int(tau * 30) * 13       # re-strike every frame (electric flicker)
        ang = (i / n) * 2 * np.pi + 0.3 * math.sin(i * 7.1)
        pts = bolt_points(cx, cy, ang, length * (0.6 + 0.4 * ((i * 37) % 10) / 10), seed)
        for a_, b_ in zip(pts[:-1], pts[1:]):
            m = int(np.linalg.norm(b_ - a_)) + 1
            xs = np.linspace(a_[0], b_[0], m).astype(int)
            ys = np.linspace(a_[1], b_[1], m).astype(int)
            ok = (xs >= 0) & (xs < W) & (ys >= 0) & (ys < H)
            acc[ys[ok], xs[ok]] = 1
    k = (1 - tau / dur) ** 1.5
    g = nd.gaussian_filter(acc, 3) * 9 + acc
    f += (g * k)[..., None] * np.array(col, np.float32)


YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)
R_EXC = np.sqrt((XX - EXC[0]) ** 2 + (YY - EXC[1]) ** 2)
HEX = ((np.abs(np.sin(XX / 26.0) + np.sin((XX * 0.5 + YY * 0.866) / 26.0) + np.sin((XX * 0.5 - YY * 0.866) / 26.0)) < 0.18)
       .astype(np.float32))


def explosion(f, t):
    tau = t - 19.0
    if tau < 0 or tau > 1.4:
        return f
    k = env_at(t)
    core = math.exp(-tau / 0.09)
    f += (np.exp(-(R_EXC / (180 + 500 * tau)) ** 2) * core * (1.6 + 0.8 * k))[..., None] * np.array([1.0, 0.93, 0.85], np.float32)
    f += (np.exp(-(R_EXC / 420) ** 2) * math.exp(-tau / 0.35) * 0.55 * k)[..., None] * np.array(ORANGE, np.float32)
    rr = 1500 * (1 - math.exp(-5.5 * tau))
    ring = np.exp(-((R_EXC - rr) / 7) ** 2) * math.exp(-tau / 0.45)
    f += ring[..., None] * np.array([0.6, 0.95, 1.0], np.float32) * 1.3
    hx_ = HEX * np.exp(-((R_EXC - rr * 0.75) / 90) ** 2) * math.exp(-tau / 0.16) * 0.2
    f += hx_[..., None] * np.array(CYAN, np.float32)
    draw_bolts(f, t, EXC[0], EXC[1], 7, 19.0, 0.42, 620, (0.55, 0.9, 1.0))
    splat_particles(f, P1, t, k)
    if tau < 0.07:   # glitch: RGB split
        s = 14
        f[..., 0] = np.roll(f[..., 0], s, axis=1)
        f[..., 2] = np.roll(f[..., 2], -s, axis=1)
    return f



# ===================================================== "المراية 1954 ↔ 2026" ====
# Built on hook5's timing (35 s). Mirror line at y = 900: top = 1954, bottom = 2026.
MY = 900
GOLD = (0.96, 0.80, 0.50)
GOLD_D = (0.78, 0.62, 0.36)

EXC = np.array([540.0, float(MY)])
R_EXC = np.sqrt((XX - EXC[0]) ** 2 + (YY - EXC[1]) ** 2)
P1 = make_particles(900, 19.0, *EXC)

# ---------------- backgrounds ----------------
grain_rng = np.random.default_rng(5)
paper = np.zeros((H, W, 3), np.float32)
top = (YY < MY)
vign = np.clip(1 - (((XX - 540) / 760) ** 2 + ((YY - 560) / 700) ** 2), 0, 1)
pn = nd.gaussian_filter(grain_rng.standard_normal((H, W)).astype(np.float32), 2.5) * 0.5 + \
     nd.gaussian_filter(grain_rng.standard_normal((H, W)).astype(np.float32), 18) * 2.0
paper += ((0.10 + 0.05 * vign + 0.012 * pn) * top)[..., None] * np.array([1.0, 0.80, 0.55], np.float32)
neon = np.zeros((H, W, 3), np.float32)
bot = (YY > MY)
gridl = ((np.abs(((XX - 540) % 60) - 30) > 29.2) | (np.abs(((YY - MY) % 60) - 30) > 29.2)).astype(np.float32)
neon += ((0.035 + 0.04 * np.exp(-((YY - MY) / 380) ** 2)) * bot)[..., None] * np.array([0.35, 0.6, 1.0], np.float32)
neon += (gridl * bot * np.exp(-((YY - MY) / 300) ** 2) * 0.06)[..., None] * np.array(CYAN, np.float32)


def grain(f, t, k=1.0):
    g = grain_rng.standard_normal((H // 4, W // 4)).astype(np.float32)
    g = np.kron(g, np.ones((4, 4), np.float32))[:H, :W]
    f[:MY] += (g[:MY] * 0.018 * k)[..., None]
    if int(t * 30) % 11 == 0:   # occasional film scratch
        x = int(grain_rng.uniform(80, W - 80))
        f[:MY, x:x + 2] += 0.05 * k


def mirror_line(f, t, k):
    if k <= 0:
        return
    line = np.exp(-((YY[:, :1] - MY) / 2.2) ** 2) * 1.0 + np.exp(-((YY[:, :1] - MY) / 16) ** 2) * 0.25
    xs = np.exp(-((XX[:1] - 540) / 520) ** 2)
    col = np.where(XX[:1, :, None] < 540, np.array(GOLD, np.float32), np.array(CYAN, np.float32))
    f += (line * xs)[..., None] * col * k


def year_labels(f, t, a):
    if a <= 0:
        return
    place_txt(f, Y54, 120, MY - 40, a)
    place_txt(f, Y26, 120, MY + 42, a)


def place_txt(f, ti, cx, cy, a, anchor="c"):
    img = ti["img"]
    h, w = img.shape[:2]
    x = int(cx - w / 2) if anchor == "c" else int(cx - w + 40)
    if ti["glow"] is not None:
        add(f, ti["glow"][..., None] * ti["gcol"] * a, x, int(cy - h / 2))
    over(f, img, x, int(cy - h / 2), alpha_mul=a)


Y54 = text_img("1954", font("ExtraBold", 40), GOLD, 0.4)
Y26 = text_img("2026", font("ExtraBold", 40), CYAN, 0.4)

# ---------------- hero bullet lying on the mirror ----------------
HB = sprite("live", 120)
hb_h, hb_w = HB.shape[:2]
hb_rows = np.nonzero(HB[..., 3].max(1) > 0.5)[0]
HB_X = int(540 - hb_w / 2)
HB_Y = MY - hb_rows.max() - 2
HB_lum = HB[..., :3].mean(-1) ** 0.6
hyy, hxx = np.mgrid[0:hb_h, 0:hb_w].astype(np.float32)


def hero_on_mirror(f, t):
    u = clamp01((t - 8.8) / 0.8)
    if u >= 1:
        return
    h = HB.copy()
    for t0, dur, k in [(0.2, 1.1, 1.0), (3.4, 1.0, 0.55), (6.6, 1.0, 0.5)]:
        v = (t - t0) / dur
        if 0 <= v <= 1:
            xs = -80 + (hb_w + 160) * ease_io(v)
            band = np.exp(-(((hxx - xs) - 0.45 * (hyy - hb_h / 2)) / 36) ** 2)
            h[..., :3] += (band * HB_lum * k)[..., None] * np.array([1.0, 0.9, 0.68], np.float32)
    a = 1 - ease_io(u)
    if u > 0:
        h = np.dstack([nd.gaussian_filter(h[..., c], 5 * u) for c in range(4)])
    # reflection below the mirror line (cool tint)
    r = h[::-1].copy()
    r[..., :3] *= np.array([0.65, 0.8, 1.0], np.float32)
    r[..., 3] *= 0.38 * np.clip(1 - np.arange(hb_h) / (hb_h * 0.9), 0, 1)[:, None]
    over(f, r, HB_X, MY + (MY - (HB_Y + hb_h)) - 2 + int(70 * ease_io(u)), alpha_mul=a)
    over(f, h, HB_X, int(HB_Y - 70 * ease_io(u)), alpha_mul=a)
    if u > 0:
        for i in range(24):
            age = t - (8.8 + (i / 24) * 0.55)
            if 0 <= age < 0.7:
                draw_glow(f, HB_X + 30 + (i * 97) % (hb_w - 60), MY - 40 - 170 * age, 2.2,
                          GOLD if i % 2 else CYAN, 0.9 * (1 - age / 0.7))


# ---------------- 1954 text (top) ----------------
F_T = font("Bold", 52)
L_DATE = TypeLine("اليوم... أول نوفمبر", font("ExtraBold", 84), GOLD, 540, 470, 0.30, 1.37, 2.37, 2.50, glow=0.6)
L_SAL1 = TypeLine("تحية لأرواح شهدائنا الأبرار", F_T, (0.95, 0.92, 0.85), 540, 520, 2.90, 4.70, 6.67, 6.80)
L_SAL2 = TypeLine("...ولعبقرية تنظيمهم.", F_T, (0.95, 0.92, 0.85), 540, 605, 4.70, 6.43, 6.67, 6.80)
L_REV = TypeLine("الثورة ما بداتش بالصدفة...", font("ExtraBold", 54), (0.97, 0.95, 0.9), 540, 340, 7.30, 8.77, 99, 99, glow=0.25)
L_FORCE = TypeLine("...ولا بالقوة.", font("ExtraBold", 54), (0.97, 0.95, 0.9), 540, 418, 10.40, 11.10, 99, 99, glow=0.25)

ROW_T = [585, 745]              # top rows (1954)
ROW_B = [2 * MY - y for y in ROW_T]   # mirrored rows (2026): 1215, 1055
COLX = [790, 290]               # right, left (RTL order)
TOP_P = [("التنظيم", "كل منطقة بقائدها", 11.40, 12.43),
         ("التسيير", "كل رصاصة محسوبة", 12.73, 13.40),
         ("الوحدة", "صف واحد", 14.00, 14.70),
         ("ساعة الصفر", "الضربة في نفس الوقت", 15.27, 16.27)]
BOT_P = [("المراحل", "كل مرحلة بمعاييرها وبابها", 21.13),
         ("البوصلة", "تحسب قبل ما تصرف", 21.93),
         ("الفريق", "كل وكيل في بلاصتو", 22.73),
         ("القرار", "ساعة الصفر في يدك", 23.53)]
CELLS = [(COLX[0], 0), (COLX[1], 0), (COLX[0], 1), (COLX[1], 1)]
TOP_IMG = [(text_img(a, font("ExtraBold", 60), GOLD, 0.45), text_img(b, font("Medium", 32), (0.9, 0.85, 0.75)))
           for a, b, *_ in TOP_P]
BOT_IMG = [(text_img(a, font("ExtraBold", 60), CYAN if i % 2 == 0 else ORANGE, 0.5), text_img(b, font("Medium", 32), (0.85, 0.9, 0.95)))
           for i, (a, b, _) in enumerate(BOT_P)]
LINK = text_img("نفس المنطق... في زمن آخر", font("ExtraBold", 50), WHITE, 0.6, (1.0, 0.92, 0.8))
GRID_OUT = 25.6                 # grids fade out here (2026 takes the whole screen)


def reveal(img, v):
    im = img.copy()
    w = im.shape[1]
    edge = int(w - 40 - (w - 80) * clamp01(v))
    im[:, :max(0, edge), 3] = 0
    return im


def top_text(f, t):
    for ln in (L_DATE, L_SAL1, L_SAL2):
        ln.draw(f, t)
    head_a = 1 - ease_io((t - GRID_OUT) / 0.5)
    for ln in (L_REV, L_FORCE):
        ln.draw(f, t, extra_alpha=head_a * (1 - 0.45 * ease_io((t - 19.0) / 0.4)))
    glitch = 19.0 <= t < 19.5
    for i, ((ti, su), (_, _, a0, a1)) in enumerate(zip(TOP_IMG, TOP_P)):
        if t < a0:
            continue
        cx, r = CELLS[i]
        cy = ROW_T[r]
        a = clamp01((t - a0) / 0.08) * (1 - ease_io((t - GRID_OUT) / 0.5))
        dim = 1 - 0.35 * ease_io((t - 19.0) / 0.3) + 0.35 * ease_io((t - 24.2) / 0.2)
        dx = int(grain_rng.integers(-8, 9)) if glitch else 0
        mid = a0 + 0.35 * (a1 - a0)
        place_txt(f, {"img": reveal(ti["img"], (t - a0) / max(0.1, mid - a0)), "glow": None}, cx + dx, cy, a * dim)
        place_txt(f, {"img": reveal(su["img"], (t - mid) / max(0.1, a1 - mid)), "glow": None}, cx + dx, cy + 52, a * dim)
        if t >= mid:
            g = ti["glow"]
            img = ti["img"]
            add(f, g[..., None] * ti["gcol"] * a * dim * 0.6, int(cx + dx - img.shape[1] / 2), int(cy - img.shape[0] / 2))


def bottom_text(f, t):
    for i, ((ti, su), (_, _, b0)) in enumerate(zip(BOT_IMG, BOT_P)):
        if t < b0:
            continue
        cx, r = CELLS[i]
        cy = ROW_B[r]
        a = ease_io((t - b0) / 0.22) * (1 - ease_io((t - GRID_OUT) / 0.5))
        # appears like a reflection rising out of the mirror
        dy = (MY - cy) * 0.25 * (1 - ease_out2((t - b0) / 0.3))
        place_txt(f, ti, cx, cy + dy, a)
        place_txt(f, su, cx, cy + 52 + dy, a * ease_io((t - b0 - 0.1) / 0.3))
        # short ripple on the mirror under the column
        rp = t - b0
        if 0 <= rp < 0.5:
            rr = 30 + 500 * rp
            ring = np.exp(-((np.sqrt((XX - cx) ** 2 + ((YY - MY) * 4) ** 2) - rr) / 6) ** 2) * (1 - rp / 0.5) * 0.6
            f += ring[..., None] * np.array(CYAN if i % 2 == 0 else ORANGE, np.float32)


def links(f, t):
    d = t - 24.2
    if d < 0 or t > GRID_OUT + 0.5:
        return
    a = ease_io(d / 0.15) * (1 - ease_io((t - GRID_OUT) / 0.5))
    for i in range(4):
        cx, r = CELLS[i]
        y0, y1 = ROW_T[r] + 80, ROW_B[r] - 40
        if r == 0:      # far row: run along the outer side so the middle words stay readable
            cx = cx + (175 if cx > 540 else -175)
            y0, y1 = ROW_T[r] - 10, ROW_B[r] + 10
        prog = ease_out2((d - 0.05 * i) / 0.35)
        ye = y0 + (y1 - y0) * prog
        beam = np.exp(-((XX[:1] - cx) / 3.0) ** 2) * 1.0 + np.exp(-((XX[:1] - cx) / 18) ** 2) * 0.3
        mask = ((YY[:, :1] >= y0) & (YY[:, :1] <= ye)).astype(np.float32)
        colv = np.where(YY[:, :1, None] < MY, np.array(GOLD, np.float32), np.array(CYAN if i % 2 == 0 else ORANGE, np.float32))
        f += (beam * mask)[..., None] * colv * a * (0.9 + 0.4 * env_at(t))
    fl = math.exp(-((t - 24.22) / 0.06) ** 2)
    f += fl * 0.32
    la = ease_io((t - 24.35) / 0.25) * (1 - ease_io((t - GRID_OUT) / 0.4))
    if la > 0:
        img = LINK["img"]
        w_, h_ = img.shape[1], img.shape[0]
        f[MY - 42:MY + 42, 540 - w_ // 2 + 20:540 + w_ // 2 - 20] *= 1 - 0.85 * la
        place_txt(f, LINK, 540, MY, la)


# ---------------- 2026 final scene (layers) ----------------
S_L = 0.80
logo_s = resize_rgba(to_rgba_f(Image.open(f"{LAYERS}/layer-logo-ecommanita.png")), S_L)
ctrl_raw = to_rgba_f(Image.open(f"{LAYERS}/layer-controller-tassyir.png"))
str_s = resize_rgba(to_rgba_f(Image.open(f"{LAYERS}/layer-light-strands.png")), S_L)
# tassyir "off" version of the controller: wordmark painted with the plate colour
cr = ctrl_raw.copy()
reg = cr[635:722, 935:1250]
mn_, mx_ = reg[..., :3].min(-1), reg[..., :3].max(-1)
wm_m = np.clip((mx_ - 0.30) / 0.2, 0, 1) * np.clip(1 - (mx_ - mn_) / 0.5, 0, 1) * (reg[..., 3] > 0.5)
wm_m = np.clip(nd.gaussian_filter(nd.grey_dilation(wm_m, size=3), 1.0) * 1.3, 0, 1)
plate = np.median(reg[..., :3][(wm_m < 0.05) & (reg[..., 3] > 0.5)], axis=0)
reg_off = reg.copy()
reg_off[..., :3] = reg[..., :3] * (1 - wm_m[..., None]) + (plate * 0.95 + reg[..., :3] * 0.06) * wm_m[..., None]
ctrl_off_raw = ctrl_raw.copy()
ctrl_off_raw[635:722, 935:1250] = reg_off
ctrl_on = resize_rgba(ctrl_raw, S_L)
ctrl_off = resize_rgba(ctrl_off_raw, S_L)
OX, OY = 540 - S_L * 1075, 190 - S_L * 45
LX, LY = int(OX), int(OY)


def L2V(x, y): return S_L * x + OX, S_L * y + OY


WM_BOX = (int(L2V(935, 635)[0]), int(L2V(935, 635)[1]), int(L2V(1250, 722)[0]), int(L2V(1250, 722)[1]))
WM_MASK = resize_rgba(np.dstack([np.ones(wm_m.shape + (3,), np.float32), wm_m]), S_L)[..., 3]
BUTTONS = [L2V(*p) + (c,) for p, c in [((783, 664), "c"), ((846, 723), "c"), ((785, 780), "c"), ((724, 724), "c"),
                                       ((1395, 657), "o"), ((1461, 722), "o"), ((1397, 787), "o"), ((1330, 721), "o")]]
BR = 33 * S_L
CC = {"c": np.array(CYAN, np.float32), "o": np.array(ORANGE, np.float32)}
T_ON = 30.05
L_GOAL = TypeLine("الهدف: نحرّرو العقل من التشتّت.", font("ExtraBold", 54), WHITE, 540, 1270, 27.40, 29.0, 34.20, 34.45)
L_FOUND = TypeLine("لقينا المانيطة... واللعبة بدات.", font("ExtraBold", 52), ORANGE, 540, 1350, 29.40, 31.30, 34.20, 34.45, glow=0.35)
CTA_L = text_img("ecommanita", font("ExtraBold", 40), ORANGE)
CTA_R = text_img("كود تغيير المصير", font("ExtraBold", 38), (0.08, 0.05, 0.02))
END = text_img("يتبع...", font("ExtraBold", 84), WHITE, 0.5, (1.0, 0.85, 0.6))


def press(f, i, d):
    if d < 0 or d > 0.65:
        return
    bx, by, c = BUTTONS[i]
    R = int(BR * 2.4)
    x0, y0 = int(bx) - R, int(by) - R
    patch = f[y0:y0 + 2 * R, x0:x0 + 2 * R]
    yy, xx = np.mgrid[0:2 * R, 0:2 * R].astype(np.float32)
    dist = np.sqrt((xx + x0 - bx) ** 2 + (yy + y0 - by) ** 2)
    disk = np.clip(BR + 1 - dist, 0, 1)
    if d < 0.07:
        k = math.sin(math.pi * d / 0.07)
        patch *= (1 - 0.45 * k * disk)[..., None]
    else:
        e = d - 0.07
        patch *= (1 + 1.1 * math.exp(-e / 0.16) * disk)[..., None]
        rr = BR * (1 + 1.6 * e / 0.58)
        patch += (np.exp(-((dist - rr) / 2.2) ** 2) * (1 - e / 0.58) * 0.9)[..., None] * CC[c]


def ts_state(t):
    if t < T_ON:
        return 0.0
    d = t - T_ON
    for a_, b_, v in [(0.0, 0.07, 1), (0.07, 0.13, 0), (0.13, 0.17, 1), (0.17, 0.27, 0)]:
        if a_ <= d < b_:
            return float(v)
    return 1.0


def scene2026(f, t):
    k = ease_io((t - GRID_OUT) / 0.6)
    if k <= 0:
        return
    layer = np.zeros((H, W, 3), np.float32)
    bv = ease_io((t - 26.0) / 0.45)
    for i in range(4):
        for xb, col in [(40 + i * 18, CYAN), (W - 40 - i * 18, ORANGE)]:
            bar = np.exp(-((XX[0] - xb) / ((6 - i) * 1.6)) ** 2) * (0.9 - i * 0.18)
            layer += (bar[None, :] * np.clip(1 - np.abs(YY[:, :1] - 960) / 1200, 0, 1))[..., None] * np.array(col, np.float32) * bv * 0.8
    st = ts_state(t)
    over(layer, ctrl_on if st >= 1 else ctrl_off, LX, LY)
    over(layer, str_s, LX, LY, alpha_mul=0.5 + 0.5 * (0.5 + 0.5 * math.sin(t * 23)))
    over(layer, logo_s, LX, LY)
    d = t - T_ON - 0.27
    if st >= 1 and d >= 0:      # power-on bloom + sweep on the tassyir wordmark
        x0, y0, x1, y1 = WM_BOX
        m = WM_MASK[:y1 - y0, :x1 - x0]
        reg_ = layer[y0:y0 + m.shape[0], x0:x0 + m.shape[1]]
        reg_ *= (1 + 0.9 * math.exp(-d / 0.35) * m)[..., None]
        reg_ += (nd.gaussian_filter(m, 7) * math.exp(-d / 0.6) * 1.2)[..., None] * np.array([0.6, 0.85, 1.0], np.float32)
        sv = (d - 0.15) / 0.5
        if 0 <= sv <= 1:
            yy2, xx2 = np.mgrid[0:m.shape[0], 0:m.shape[1]].astype(np.float32)
            xs = -60 + (m.shape[1] + 120) * ease_io(sv)
            reg_ += (np.exp(-(((xx2 - xs) - 0.5 * (yy2 - m.shape[0] / 2)) / 18) ** 2) * m * 1.2)[..., None]
    for i in range(8):
        press(layer, i, t - (30.35 + 0.06 * i))
        press(layer, i, t - (31.35 + 0.05 * i))
    L_GOAL.draw(layer, t)
    L_FOUND.draw(layer, t)
    ca = ease_io((t - 31.3) / 0.3) * (1 - ease_io((t - 34.2) / 0.25))
    if ca > 0:
        bw, bh, bx, by = 700, 84, 190, 1415
        box = np.zeros((bh, bw, 4), np.float32)
        box[..., :3] = ORANGE
        box[..., 3] = 1
        box[3:-3, 3:300, :3] = 0.05
        sc = 1 + 0.08 * (1 - ease_out2((t - 31.3) / 0.25))
        b_ = resize_rgba(box, sc)
        over(layer, b_, int(540 - b_.shape[1] / 2), int(by + bh / 2 - b_.shape[0] / 2), ca)
        place_txt(layer, CTA_L, bx + 150, by + bh / 2, ca)
        place_txt(layer, CTA_R, bx + 500, by + bh / 2, ca)
        sv = (t - 31.6) / 0.6
        if 0 <= sv <= 1:
            yy, xx = np.mgrid[0:bh, 0:bw].astype(np.float32)
            xs = -100 + (bw + 200) * ease_io(sv)
            layer[by:by + bh, bx:bx + bw] += (np.exp(-(((xx - xs) - 0.5 * (yy - bh / 2)) / 30) ** 2) * 0.8)[..., None]
    layer *= 1 - ease_io((t - 34.2) / 0.25)
    f[:] = f * (1 - k) + layer * k


# ---------------- frame ----------------
def frame(n):
    t = n / FPS
    split_k = 1 - ease_io((t - GRID_OUT) / 0.6)
    f = (paper + neon) * split_k
    if split_k > 0:
        grain(f, t, split_k)
    # bottom reflection of the 1954 half (very faint) until the 2026 side wakes up
    if t < 20.4:
        hero_on_mirror(f, t)
        tmp = np.zeros((H, W, 3), np.float32)
        top_text(tmp, t)
        refl = tmp[MY - 640:MY][::-1] * np.array([0.5, 0.65, 0.9], np.float32) * 0.14
        f[:MY] += tmp[:MY]
        f[MY:MY + 640] += nd.gaussian_filter(refl, (2, 2, 0)) * (1 - ease_io((t - 19.0) / 0.3))
    else:
        top_text(f, t)
        bottom_text(f, t)
        links(f, t)
    ml = 0.35 + 0.65 * ease_io((t - 19.0) / 0.2)
    mirror_line(f, t, ml * split_k)
    year_labels(f, t, ease_io(t / 0.4) * split_k * (1 - ease_io((t - 24.2) / 0.2)))
    if 17.55 <= t < 19.0:     # the bullet comes back: flash on the left, flight to the mirror centre
        I = math.exp(-max(0.0, t - 17.6) / 0.05) if t >= 17.6 else 0
        if I > 0.02:
            f += (np.exp(-(((XX + 20) / 260) ** 2 + ((YY - 520) / 170) ** 2)) * I * 1.3)[..., None] * np.array([1.0, 0.75, 0.4], np.float32)
        u = clamp01((t - 17.62) / 1.38)
        D = 66 + 70 * ease_in3(u)
        s = sprite("live", D, rot=-22 * (1 - u) - 8)
        c0, c1 = np.array([-200.0, 520.0]), np.array([540.0 - 4.68 * D * 0.42, MY - 12.0])
        c = c0 + (c1 - c0) * ease_io(u)
        gl = nd.gaussian_filter(s[..., 3], max(2, 0.16 * D))
        add(f, (gl * (1 - s[..., 3]))[..., None] * np.array([1.0, 0.66, 0.24], np.float32) * 0.5,
            int(c[0] - s.shape[1] / 2), int(c[1] - s.shape[0] / 2))
        over(f, s, int(c[0] - s.shape[1] / 2), int(c[1] - s.shape[0] / 2))
    if 19.0 <= t < 20.4:
        f = explosion(f, t)
    if t < 20.4:
        draw_motes(f, t, 0.8)
    scene2026(f, t)
    if t >= 34.45:
        a = ease_io((t - 34.45) / 0.2)
        img = END["img"]
        x, y = int(540 - img.shape[1] / 2), int(960 - img.shape[0] / 2)
        add(f, END["glow"][..., None] * END["gcol"] * a, x, y)
        over(f, img, x, y, alpha_mul=a)
    return f


enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                        "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slower", "-tune", "film",
                        "-crf", "12", "-maxrate", "30M", "-bufsize", "60M", "-profile:v", "high", "-level", "4.2",
                        "-g", "60", "-bf", "2", "-pix_fmt", "yuv420p", "-color_primaries", "bt709",
                        "-color_trc", "bt709", "-colorspace", "bt709", "-movflags", "+faststart", OUT],
                       stdin=subprocess.PIPE)
PREV_AT = {0, 30, 150, 240, 290, 340, 470, 520, 560, 575, 600, 640, 660, 690, 715, 728, 740, 770, 800,
           850, 900, 903, 915, 960, 1000, 1045}
for n in range(TOTAL):
    out = (np.clip(frame(n), 0, 1) * 255 + 0.5).astype(np.uint8)
    if PREV and n in PREV_AT:
        Image.fromarray(out).save(f"{PREV}/m_{n:04d}.png")
    enc.stdin.write(out.tobytes())
enc.stdin.close()
enc.wait()
print("frames", TOTAL)
