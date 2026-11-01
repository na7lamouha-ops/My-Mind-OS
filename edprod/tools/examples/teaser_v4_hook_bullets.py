"""Teaser v3 video render.

New timeline (s):
  0.0 - 6.7  hook: bullets lying on a glossy floor, hero ECOMMANITA bullet + light sweep; original text screened on top
  5.5 - 6.3  hero rises and dissolves, floor fades
  6.7 / 6.95 reload shakes (text frozen)
  7.3        shot: muzzle flash, "...ولا بالقوة." slams in
  7.3 - 9.3  bullet flies in, text shrinks + fades, camera zooms to centre
  9.3 ->     original footage from 10.0 s (explosion) to the end, with overlays:
             logo spark + light sweeps, controller button presses, CTA sweep

usage: render_v3.py <orig.mp4> <bullet.png> <assets_dir> <out_video.mp4> [preview_dir]
"""
import math
import subprocess
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd

SRC, SPRITE, ASSETS, OUT = sys.argv[1:5]
PREV = sys.argv[5] if len(sys.argv) > 5 else None
W, H, FPS = 1080, 1920, 30
NEW_END = 279                 # first frame taken from the original (orig frame 300 = 10.0 s)
ORIG_OFF = 21                 # new frame n >= NEW_END  ->  orig frame n + 21
rng = np.random.default_rng(1)


def clamp01(x):
    return min(1.0, max(0.0, x))


def ease_io(x):
    x = clamp01(x)
    return 3 * x * x - 2 * x * x * x


def ease_in3(x):
    x = clamp01(x)
    return x ** 3


def ease_out2(x):
    x = clamp01(x)
    return 1 - (1 - x) ** 2


# ------------------------------------------------------------------ sprites ---
spr_full = Image.open(SPRITE).convert("RGBA")          # D = 360, rim at x = 8
SPR_D, SPR_PAD = 360, 8
spr_case = spr_full.crop((0, 0, SPR_PAD + int(3.2 * SPR_D), spr_full.height))


def sprite_img(kind, D, rot=0.0, bright=1.0):
    s = spr_full if kind == "live" else spr_case
    sc = D / SPR_D
    im = s.resize((max(1, round(s.width * sc)), max(1, round(s.height * sc))), Image.LANCZOS)
    if rot:
        im = im.rotate(rot, resample=Image.BICUBIC, expand=True)
    a = np.asarray(im).astype(np.float32) / 255
    a[..., :3] *= bright
    return a


def over(dst, src, x, y, alpha_mul=1.0):
    """premultiplied-over of RGBA float src (straight alpha) onto RGB dst, top-left at (x, y)."""
    h, w = src.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(dst.shape[1], x + w), min(dst.shape[0], y + h)
    if x1 <= x0 or y1 <= y0:
        return
    s = src[y0 - y:y1 - y, x0 - x:x1 - x]
    a = s[..., 3:4] * alpha_mul
    dst[y0:y1, x0:x1] = s[..., :3] * a + dst[y0:y1, x0:x1] * (1 - a)


def add(dst, src_rgb, x, y):
    h, w = src_rgb.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(dst.shape[1], x + w), min(dst.shape[0], y + h)
    if x1 > x0 and y1 > y0:
        dst[y0:y1, x0:x1] += src_rgb[y0 - y:y1 - y, x0 - x:x1 - x]


def screen(a, b):
    return 1 - (1 - a) * (1 - b)


# ------------------------------------------------------------ floor scene -----
HERO = dict(cx=540, cy=1610, D=125)
ITEMS = [  # cx, cy, D, rot, kind, brightness   (far -> near)
    (150, 1440, 34, -14, "case", 0.45), (420, 1418, 30, 22, "live", 0.42),
    (705, 1432, 32, -30, "case", 0.45), (960, 1452, 36, 10, "live", 0.5),
    (85, 1560, 48, 28, "live", 0.65), (990, 1548, 46, -24, "case", 0.65),
    (120, 1800, 72, -8, "case", 0.8), (935, 1815, 76, 16, "live", 0.8),
]


def floor_base():
    f = np.zeros((H, W, 3), np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    floor = np.clip((yy - 1360) / 220, 0, 1)
    f += floor[..., None] * np.array([0.035, 0.03, 0.026])
    pool = np.exp(-(((xx - 540) / 470) ** 2 + ((yy - 1650) / 210) ** 2))
    f += pool[..., None] * np.array([0.20, 0.13, 0.06])
    rim = np.exp(-(((xx - 540) / 900) ** 2 + ((yy - 1380) / 18) ** 2)) * 0.05
    f += rim[..., None] * np.array([0.9, 0.7, 0.45])
    return f


def place_item(f, kind, cx, cy, D, rot, bright, refl=True):
    s = sprite_img(kind, D, rot, bright)
    h, w = s.shape[:2]
    x, y = int(cx - w / 2), int(cy - h / 2)
    a = s[..., 3]
    ys = np.nonzero(a.max(1) > 0.5)[0]
    bottom = y + (ys.max() if len(ys) else h)
    # contact shadow
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    sh = np.exp(-(((xx - cx) / (w * 0.42)) ** 2 + ((yy - bottom) / (D * 0.16)) ** 2)) * 0.75
    f *= (1 - sh)[..., None]
    if refl:
        r = s[::-1].copy()
        fade = np.clip(1 - np.arange(h) / (h * 0.75), 0, 1)[:, None] ** 1.6
        r[..., 3] *= 0.30 * fade
        r = np.dstack([nd.gaussian_filter(r[..., c], 1.4) for c in range(4)])
        over(f, r, x, bottom + (bottom - (y + h)) if False else 2 * bottom - (y + h))
    over(f, s, x, y)


base = floor_base()
for it in ITEMS[:6]:
    place_item(base, it[4], *it[:4], it[5])
static_back = base.copy()               # items behind the hero
front = np.zeros((H, W, 3), np.float32)
front_a = np.zeros((H, W), np.float32)
for it in ITEMS[6:]:                    # items in front: draw on their own layer
    tmp = np.zeros((H, W, 3), np.float32)
    s = sprite_img(it[4], it[2], it[3], it[5])
    over(tmp, s, int(it[0] - s.shape[1] / 2), int(it[1] - s.shape[0] / 2))
    m = np.zeros((H, W), np.float32)
    hh, ww = s.shape[:2]
    x0, y0 = int(it[0] - ww / 2), int(it[1] - hh / 2)
    xs0, ys0 = max(0, x0), max(0, y0)
    xs1, ys1 = min(W, x0 + ww), min(H, y0 + hh)
    m[ys0:ys1, xs0:xs1] = np.maximum(m[ys0:ys1, xs0:xs1], s[ys0 - y0:ys1 - y0, xs0 - x0:xs1 - x0, 3])
    front = front * (1 - m[..., None]) + tmp * m[..., None]
    front_a = np.maximum(front_a, m)

hero = sprite_img("live", HERO["D"])
hero_h, hero_w = hero.shape[:2]
hero_x, hero_y = int(HERO["cx"] - hero_w / 2), int(HERO["cy"] - hero_h / 2)
hero_lum = (hero[..., :3].mean(-1) ** 0.6)
hero_bottom = hero_y + np.nonzero(hero[..., 3].max(1) > 0.5)[0].max()
hero_refl = hero[::-1].copy()
hero_refl[..., 3] *= 0.32 * np.clip(1 - np.arange(hero_h) / (hero_h * 0.8), 0, 1)[:, None] ** 1.5
hero_refl = np.dstack([nd.gaussian_filter(hero_refl[..., c], 1.2) for c in range(4)])
yy_h, xx_h = np.mgrid[0:hero_h, 0:hero_w].astype(np.float32)

# dust motes (screen space, deterministic)
NM = 80
motes = np.stack([rng.uniform(0, W, NM), rng.uniform(300, H, NM), rng.uniform(0.6, 2.4, NM),
                  rng.uniform(0.08, 0.35, NM), rng.uniform(-6, 10, NM), rng.uniform(-18, -4, NM)], 1)


def draw_glow(f, x, y, r, col, inten):
    R = int(r * 3) + 2
    x0, y0 = int(x) - R, int(y) - R
    yy, xx = np.mgrid[0:2 * R, 0:2 * R].astype(np.float32)
    g = np.exp(-(((xx + x0 - x) ** 2 + (yy + y0 - y) ** 2) / (r * r))) * inten
    add(f, g[..., None] * np.array(col, np.float32), x0, y0)


def hero_layer(t, f):
    """hero bullet with light sweep, reflection and dissolve; returns nothing (draws into f)."""
    u = clamp01((t - 5.5) / 0.8)
    if u >= 1:
        return
    a_mul = 1 - ease_in3(u) * 0.0 - ease_io(u)
    dy = -70 * ease_io(u)
    h = hero.copy()
    for (t0, dur, k) in [(0.15, 1.1, 0.95), (3.3, 1.0, 0.55)]:
        v = (t - t0) / dur
        if 0 <= v <= 1:
            xs = -80 + (hero_w + 160) * ease_io(v)
            band = np.exp(-(((xx_h - xs) - 0.45 * (yy_h - hero_h / 2)) / 38) ** 2)
            h[..., :3] += (band * hero_lum * k)[..., None] * np.array([1.0, 0.9, 0.68], np.float32)
    if u > 0:
        blur = 5 * u
        h = np.dstack([nd.gaussian_filter(h[..., c], blur) for c in range(4)])
    over(f, hero_refl, hero_x, 2 * hero_bottom - (hero_y + hero_h), alpha_mul=a_mul * (1 - u))
    over(f, h, hero_x, int(hero_y + dy), alpha_mul=a_mul)
    if u > 0:  # embers rising from the hero
        for i in range(26):
            st = 5.5 + (i / 26) * 0.6
            age = t - st
            if 0 <= age < 0.7:
                ex = hero_x + 40 + (i * 97) % (hero_w - 80)
                ey = HERO["cy"] - 20 - 160 * age + 10 * math.sin(i)
                draw_glow(f, ex, ey, 2.2, (1.0, 0.62, 0.22), 0.9 * (1 - age / 0.7))


def floor_scene(t):
    f = static_back.copy()
    hero_layer(t, f)
    f = f * (1 - front_a[..., None]) + front
    fade = 1 - ease_io((t - 5.7) / 0.8)
    f *= fade
    # slow push-in on the floor
    s = 1 + 0.05 * min(t, 5.6) / 5.6
    if s > 1.0005:
        im = Image.fromarray((np.clip(f, 0, 1) * 255).astype(np.uint8))
        nw, nh = round(W * s), round(H * s)
        im = im.resize((nw, nh), Image.BICUBIC)
        cx, cy = 540 * s - 540, 1610 * s - 1610
        im = im.crop((round(cx), round(cy), round(cx) + W, round(cy) + H))
        f = np.asarray(im).astype(np.float32) / 255
    return f


# ---------------------------------------------------------- text from orig ----
def read_frames(path, idxs):
    want = set(idxs)
    out = {}
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         stdout=subprocess.PIPE)
    i = 0
    while True:
        b = p.stdout.read(W * H * 3)
        if len(b) < W * H * 3:
            break
        if i in want:
            out[i] = np.frombuffer(b, np.uint8).reshape(H, W, 3).astype(np.float32) / 255
        i += 1
        if i > max(want):
            break
    p.kill()
    return out


ref = read_frames(SRC, [200, 228])
freeze = ref[200].copy()
freeze[1040:1160] = 0                                 # drop the half-typed second line


def no_cursor(img):
    r, g, b_ = img[..., 0], img[..., 1], img[..., 2]
    m = (r - b_ > 0.3) & (r > 0.45)
    m = nd.binary_dilation(m, iterations=2)
    img[m] = 0
    return img


freeze = no_cursor(freeze)
f228 = no_cursor(ref[228].copy())
LINES = []  # (img RGB float, centre x, centre y)
for (y0, y1) in [(190, 250), (748, 856), (1046, 1148)]:
    crop = f228[y0:y1].copy()
    cols = np.nonzero(crop.max(-1).max(0) > 0.1)[0]
    x0, x1 = max(0, cols.min() - 12), min(W, cols.max() + 12)
    LINES.append((crop[:, x0:x1], (x0 + x1) / 2, (y0 + y1) / 2))


def scaled(img, s):
    h, w = img.shape[:2]
    nw, nh = max(1, round(w * s)), max(1, round(h * s))
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).resize((nw, nh), Image.BICUBIC)
    return np.asarray(im).astype(np.float32) / 255


ZC = np.array([540.0, 1000.0])


def zoom_of(t):
    return 1 + 1.5 * ease_in3((t - 8.0) / 1.3)


def text_layer_built(t):
    f = np.zeros((H, W, 3), np.float32)
    Z = zoom_of(t)
    ts = 1 - 0.2 * ease_io((t - 8.0) / 0.9)
    al = 1 - ease_io((t - 8.0) / 0.9)
    for i, (img, cx, cy) in enumerate(LINES):
        s = Z * ts
        a = al
        if i == 2:  # slam-in of "...ولا بالقوة."
            v = (t - 7.3) / 0.14
            if v < 0:
                continue
            s *= 1 + 0.35 * (1 - ease_out2(v))
            a *= clamp01(v * 2)
        if a <= 0.003:
            continue
        im = scaled(img, s) * a
        c = ZC + (np.array([cx, cy]) - ZC) * Z
        add(f, im, int(c[0] - im.shape[1] / 2), int(c[1] - im.shape[0] / 2))
    return f


# ------------------------------------------------------------- bullet flight --
bullet_cache = {}


def bullet_pose(t):
    if t < 8.0:
        u = (t - 7.3) / 0.7
        D = 66.0
        L = 4.68 * D
        tip = -30 + 360 * ease_out2(u)
        return tip - L / 2, 1100.0, D
    u = ease_io((t - 8.0) / 1.3)
    D = 66.0 * zoom_of(t)
    c0 = np.array([330 - 4.68 * 66 / 2, 1100.0])
    c1 = np.array([540.0, 1087.0])
    c = c0 + (c1 - c0) * u
    return c[0], c[1], D


def draw_bullet(f, t):
    cx, cy, D = bullet_pose(t)
    key = round(D, 1)
    if key not in bullet_cache:
        s = sprite_img("live", D)
        pad = int(0.5 * D) + 4
        sp = np.pad(s, ((pad, pad), (pad, pad), (0, 0)))
        glow = nd.gaussian_filter(sp[..., 3], max(2, 0.16 * D))
        bullet_cache[key] = (sp, glow)
    sp, glow = bullet_cache[key]
    h, w = sp.shape[:2]
    x, y = int(cx - w / 2), int(cy - h / 2)
    # motion blur while it is fast
    speed = 0
    if t < 8.0:
        speed = (bullet_pose(t)[0] - bullet_pose(t - 1 / FPS)[0])
    gl = (glow * (1 - sp[..., 3]))[..., None] * np.array([1.0, 0.66, 0.24], np.float32) * 0.45
    add(f, gl, x, y)
    if speed > 4:
        n = 5
        for k in range(n):
            over(f, sp, int(x - speed * 0.6 * k / n), y, alpha_mul=1.0 / (k + 1) if k else 1.0)
    else:
        over(f, sp, x, y)
    # tip glint before impact
    g = math.exp(-((t - 9.18) / 0.05) ** 2)
    if g > 0.02:
        tipx = cx + 4.68 * D / 2 - 4
        R = int(D * 1.6)
        yy, xx = np.mgrid[-R:R, -R:R].astype(np.float32)
        star = (np.exp(-(yy / 2.5) ** 2) * np.exp(-np.abs(xx) / (R * 0.35)) +
                np.exp(-(xx / 2.5) ** 2) * np.exp(-np.abs(yy) / (R * 0.25)) +
                np.exp(-(xx ** 2 + yy ** 2) / (0.12 * R) ** 2) * 2)
        add(f, (star * g)[..., None] * np.array([1.0, 0.95, 0.85], np.float32), int(tipx) - R, int(cy) - R)


def muzzle(f, t):
    I = math.exp(-max(0.0, t - 7.3) / 0.035) if t >= 7.3 else 0
    if I < 0.02:
        return
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d2 = ((xx + 20) / 300) ** 2 + ((yy - 1100) / 190) ** 2
    g = np.exp(-d2) * 1.4 + np.exp(-((yy - 1100) / 10) ** 2) * np.exp(-(xx + 20) / 420) * 1.2
    f += (g * I)[..., None] * np.array([1.0, 0.75, 0.4], np.float32)
    f += 0.07 * I


def shake(t):
    o = 0.0
    for t0, amp in [(6.7, 5), (6.95, 6), (7.3, 12)]:
        d = t - t0
        if 0 <= d < 0.2:
            o += amp * math.exp(-d / 0.05) * math.cos(d * 90)
    return int(round(o))


def draw_motes(f, t):
    Z = zoom_of(t) if t > 8.0 else 1.0
    for x, y, r, b, vx, vy in motes:
        px, py = (x + vx * t) % W, 300 + ((y - 300 + vy * t) % (H - 300))
        p = ZC + (np.array([px, py]) - ZC) * Z
        draw_glow(f, p[0], p[1], r * (Z ** 0.7), (1.0, 0.8, 0.55), b * 0.6)


def new_frame(n, orig_n):
    t = n / FPS
    if t < 6.7:
        f = floor_scene(t)
        f = screen(np.clip(f, 0, 1), orig_n)
    elif t < 7.3:
        f = screen(np.zeros((H, W, 3), np.float32), freeze)
    else:
        f = text_layer_built(t)
        draw_bullet(f, t)
        muzzle(f, t)
    if t < 9.23:
        draw_motes(f, t)
    s = shake(t)
    if s:
        f = np.roll(f, s, axis=0)
    return f


# ------------------------------------------------------ logo-section overlays --
S_, OX, OY = 0.84, -370.0, 117.0       # layer -> video mapping (template matched)


def L2V(x, y):
    return S_ * x + OX, S_ * y + OY


BUTTONS = [L2V(*p) + (c,) for p, c in [
    ((783, 664), "c"), ((846, 723), "c"), ((785, 780), "c"), ((724, 724), "c"),
    ((1395, 657), "o"), ((1461, 722), "o"), ((1397, 787), "o"), ((1330, 721), "o")]]
BR = 28.0
COL = {"c": np.array([0.35, 0.85, 1.0], np.float32), "o": np.array([1.0, 0.55, 0.15], np.float32)}
PRESS = []
for i in range(8):
    PRESS.append((15.45 + 0.13 * i, i))
for i in range(8):
    PRESS.append((18.75, i))
for i in range(8):
    PRESS.append((25.35 + 0.08 * i, i))

# spark path along the top edge of the ecommanita wordmark
logo = np.asarray(Image.open(f"{ASSETS}/layer-logo-ecommanita.png").convert("RGBA")).astype(np.float32)
wm = (logo[..., 3] > 200) & (logo[..., :3].max(-1) > 200)
wm[:250] = False
cols = np.nonzero(wm.any(0))[0]
path = []
for x in cols[::3]:
    ys = np.nonzero(wm[:, x])[0]
    path.append(L2V(x, ys.min()))
path = np.array(path)
# spark particles: simulated once
SPARKS = []
for i in range(140):
    t0 = 15.0 + 0.9 * (i / 140)
    s_ = ease_io((t0 - 15.0) / 0.9)
    p = path[min(len(path) - 1, int(s_ * (len(path) - 1)))]
    SPARKS.append((t0, p[0], p[1], rng.uniform(-160, 160), rng.uniform(-260, 40), rng.uniform(0.2, 0.45)))

SWEEPS = [  # tau0, dur, bbox (video), strength
    (16.0, 0.6, (150, 140, 940, 460), 0.9),
    (18.85, 0.5, (420, 650, 690, 735), 1.0),
    (24.9, 0.6, (150, 140, 940, 460), 0.8),
    (25.6, 0.6, (180, 1290, 895, 1520), 0.8),
    (27.3, 0.6, (180, 1290, 895, 1520), 0.7),
]


def overlays(f, tau):
    # light sweeps (only on lit surfaces)
    for t0, dur, (x0, y0, x1, y1), k in SWEEPS:
        v = (tau - t0) / dur
        if 0 <= v <= 1:
            reg = f[y0:y1, x0:x1]
            yy, xx = np.mgrid[0:y1 - y0, 0:x1 - x0].astype(np.float32)
            xs = -120 + (x1 - x0 + 240) * ease_io(v)
            band = np.exp(-(((xx - xs) - 0.5 * (yy - (y1 - y0) / 2)) / 34) ** 2)
            lum = np.clip(reg.mean(-1) * 2.2, 0, 1) ** 0.8
            reg += (band * lum * k)[..., None] * np.array([1.0, 0.97, 0.92], np.float32)
    # logo spark
    if 15.0 <= tau <= 15.95:
        s_ = ease_io((tau - 15.0) / 0.9)
        idx = int(s_ * (len(path) - 1))
        for j in range(0, 28):
            k = idx - j
            if k < 0:
                break
            draw_glow(f, path[k][0], path[k][1], 3.5, (1.0, 0.85, 0.55), 0.9 * (1 - j / 28))
        hx, hy = path[idx]
        draw_glow(f, hx, hy, 7, (1.0, 1.0, 0.95), 1.6)
        draw_glow(f, hx, hy, 26, (1.0, 0.7, 0.3), 0.45)
    for t0, x, y, vx, vy, life in SPARKS:
        age = tau - t0
        if 0 <= age < life:
            px, py = x + vx * age, y + vy * age + 600 * age * age
            draw_glow(f, px, py, 1.8, (1.0, 0.8, 0.45), 1.0 * (1 - age / life))
    # logo ignition after the spark
    ig = math.exp(-((tau - 16.0) / 0.12) ** 2) * 0.6
    if ig > 0.02:
        f[140:460, 150:940] *= 1 + ig
    # button presses
    for t0, i in PRESS:
        d = tau - t0
        if d < 0 or d > 0.65:
            continue
        bx, by, c = BUTTONS[i]
        R = int(BR * 2.4)
        x0, y0 = int(bx) - R, int(by) - R
        patch = f[y0:y0 + 2 * R, x0:x0 + 2 * R]
        yy, xx = np.mgrid[0:2 * R, 0:2 * R].astype(np.float32)
        dist = np.sqrt((xx + x0 - bx) ** 2 + (yy + y0 - by) ** 2)
        disk = np.clip(BR + 1 - dist, 0, 1)
        if d < 0.07:   # pressed: button sinks (smaller, darker, inner shadow)
            k = math.sin(math.pi * d / 0.07)
            src = patch.copy()
            sc = 1 - 0.1 * k
            mx = (xx - R) / sc + R
            my = (yy - R) / sc + R
            shrunk = np.stack([nd.map_coordinates(src[..., ch], [my, mx], order=1) for ch in range(3)], -1)
            patch[:] = patch * (1 - disk[..., None]) + shrunk * (1 - 0.45 * k) * disk[..., None]
            ring = np.exp(-((dist - BR) / 2.5) ** 2) * 0.5 * k
            patch *= (1 - ring)[..., None]
        else:          # released: lights up + ring wave
            e = d - 0.07
            glow = 1 + 1.1 * math.exp(-e / 0.16)
            patch[:] = patch * (1 + (glow - 1) * disk[..., None])
            rr = BR * (1 + 1.6 * e / 0.58)
            wave = np.exp(-((dist - rr) / 2.2) ** 2) * (1 - e / 0.58) * 0.9
            patch += wave[..., None] * COL[c]
            patch += (np.exp(-(dist / (BR * 1.3)) ** 2) * math.exp(-e / 0.2) * 0.35)[..., None] * COL[c]


# ======================================================================== v4 ===
from PIL import ImageDraw, ImageFont

FONT_DIR = sys.argv[6] if len(sys.argv) > 6 else "."
RAQM = ImageFont.Layout.RAQM
F_BIG = ImageFont.truetype(f"{FONT_DIR}/Tajawal-ExtraBold.ttf", 132, layout_engine=RAQM)
F_SUB = ImageFont.truetype(f"{FONT_DIR}/Tajawal-Medium.ttf", 46, layout_engine=RAQM)
F_END = ImageFont.truetype(f"{FONT_DIR}/Tajawal-ExtraBold.ttf", 96, layout_engine=RAQM)

CARDS = [  # start (new s), title, subtitle
    (9.9, "التنظيم", "كل منطقة بقائدها... وكل مرحلة بمعاييرها"),
    (11.2, "التسيير", "كل رصاصة محسوبة... وكل دينار في بلاصتو"),
    (12.5, "الوحدة", "صف واحد... وكل واحد عارف دورو"),
    (13.8, "ساعة الصفر", "القرار ما كانش صدفة... والتوقيت راهو في يدك"),
]
CARD_DUR = 1.3


def text_img(txt, font, col=(1, 1, 1)):
    """RGBA float image of RTL Arabic text, tightly cropped with padding."""
    tmp = Image.new("L", (1400, 300), 0)
    d = ImageDraw.Draw(tmp)
    d.text((700, 150), txt, font=font, fill=255, anchor="mm", direction="rtl")
    bb = tmp.getbbox()
    tmp = tmp.crop((bb[0] - 30, bb[1] - 30, bb[2] + 30, bb[3] + 30))
    a = np.asarray(tmp).astype(np.float32) / 255
    rgb = np.ones(a.shape + (3,), np.float32) * np.array(col, np.float32)
    return np.dstack([rgb, a])


CARD_IMG = []
for s0, t_, sub in CARDS:
    ti = text_img(t_, F_BIG)
    glow = nd.gaussian_filter(ti[..., 3], 14)
    CARD_IMG.append((ti, glow, text_img(sub, F_SUB, (0.80, 0.80, 0.80))))


def scaled_rgba(img, s):
    h, w = img.shape[:2]
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), "RGBA")
    im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.BICUBIC)
    return np.asarray(im).astype(np.float32) / 255


card_bg = np.zeros((H, W, 3), np.float32)
_yy, _xx = np.mgrid[0:H, 0:W].astype(np.float32)
card_bg += (np.exp(-(((_xx - 540) / 620) ** 2 + ((_yy - 960) / 520) ** 2)) * 0.05)[..., None] * np.array([1.0, 0.8, 0.55], np.float32)


def card_frame(t, ray_frame):
    f = card_bg.copy()
    if ray_frame is not None:            # explosion rays fading out under the first card
        k = 1 - ease_io((t - 9.9) / 0.45)
        if k > 0:
            f = np.maximum(f, ray_frame * k)
    for (s0, _, _), (ti, glow, si) in zip(CARDS, CARD_IMG):
        d = t - s0
        if d < 0 or d > CARD_DUR:
            continue
        out_k = 1 - ease_io((d - (CARD_DUR - 0.2)) / 0.2)
        sc = (1 + 0.3 * (1 - ease_out2(d / 0.12))) * (1 - 0.04 * (1 - out_k))
        a = clamp01(d / 0.06) * out_k
        img = scaled_rgba(ti, sc)
        x, y = 540 - img.shape[1] // 2, 905 - img.shape[0] // 2
        gl = scaled_rgba(np.dstack([np.ones(glow.shape + (3,), np.float32), glow]), sc)
        add(f, gl[..., :3] * gl[..., 3:4] * 0.45 * a * np.array([1.0, 0.9, 0.75], np.float32), x, y)
        over(f, img, x, y, alpha_mul=a)
        v = clamp01((d - 0.1) / 0.25)
        sa = ease_io(v) * out_k
        if sa > 0:
            over(f, si, 540 - si.shape[1] // 2, int(1035 + 28 * (1 - ease_io(v))) - si.shape[0] // 2, alpha_mul=sa)
    fl = 0.85 * math.exp(-((t - 15.3) / 0.07) ** 2)      # flash into the logo section
    if fl > 0.01:
        f = f + fl * 1.1
    draw_motes_flat(f, t)
    return f


def draw_motes_flat(f, t):
    for x, y, r, b, vx, vy in motes[:40]:
        px, py = (x + vx * t) % W, 300 + ((y - 300 + vy * t) % (H - 300))
        draw_glow(f, px, py, r, (1.0, 0.8, 0.55), b * 0.45)


END_TXT = "يتبع..."
END_IMG = text_img(END_TXT, F_END)
END_T0, END_T1 = 30.2, 31.0


def end_frame(t):
    f = np.zeros((H, W, 3), np.float32)
    img = END_IMG.copy()
    w = img.shape[1]
    v = clamp01((t - END_T0) / (END_T1 - END_T0))
    # RTL typewriter: reveal from the right edge to the left
    edge = int(w - 30 - (w - 60) * v)
    img[:, :max(0, edge), 3] = 0
    x, y = 540 - w // 2, 960 - img.shape[0] // 2
    glow = nd.gaussian_filter(img[..., 3], 12)
    add(f, (glow * 0.4)[..., None] * np.array([1.0, 0.85, 0.6], np.float32), x, y)
    over(f, img, x, y)
    if v < 1 or int(t * 2.2) % 2 == 0:     # orange cursor, blinking after typing
        cx = x + max(edge, 30) - 14
        f[960 - 48:960 + 48, cx:cx + 7] = np.array([1.0, 0.55, 0.15], np.float32)
    hit = math.exp(-max(0.0, t - END_T1) / 0.25) if t >= END_T1 else 0
    if hit > 0.01:
        f *= 1 + 0.6 * hit
    return f


# ------------------------------------------------------------------- main -----
class OrigReader:
    def __init__(self, path):
        self.p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                                  stdout=subprocess.PIPE)
        self.k = -1
        self.buf = None

    def get(self, k):
        while self.k < k:
            b = self.p.stdout.read(W * H * 3)
            if len(b) < W * H * 3:
                return self.buf
            self.buf, self.k = b, self.k + 1
        return self.buf


rd = OrigReader(SRC)
enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                        "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slower", "-tune", "film",
                        "-crf", "12", "-maxrate", "30M", "-bufsize", "60M",
                        "-profile:v", "high", "-level", "4.2", "-g", "60", "-bf", "2",
                        "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709",
                        "-colorspace", "bt709", "-color_range", "tv", "-movflags", "+faststart", OUT],
                       stdin=subprocess.PIPE)
LOGO_OFF = 33              # new n >= 468  ->  orig n - 33   (orig 14.5 s at new 15.6 s)
TOTAL = 960                # 32.0 s
PREV_AT = {0, 186, 230, 270, 285, 300, 330, 340, 380, 420, 455, 462, 470, 500, 780, 905, 920, 935, 950}
for n in range(TOTAL):
    t = n / FPS
    if n < NEW_END:
        of = np.frombuffer(rd.get(n), np.uint8).reshape(H, W, 3)
        f = new_frame(n, of.astype(np.float32) / 255)
    elif n < 297:                                   # 9.3-9.9: original explosion
        f = np.frombuffer(rd.get(n + ORIG_OFF), np.uint8).reshape(H, W, 3).astype(np.float32) / 255
    elif n < 468:                                   # 9.9-15.6: the four cards
        k = n + ORIG_OFF
        ray = np.frombuffer(rd.get(k), np.uint8).reshape(H, W, 3).astype(np.float32) / 255 if k <= 330 else None
        f = card_frame(t, ray)
    elif n < 903:                                   # logo section, original with overlays
        k = n - LOGO_OFF
        f = np.frombuffer(rd.get(k), np.uint8).reshape(H, W, 3).astype(np.float32) / 255
        tau = k / FPS
        if 14.9 <= tau <= 28.0:
            f = f.copy()
            overlays(f, tau)
    else:
        f = end_frame(t)
    out = (np.clip(f, 0, 1) * 255 + 0.5).astype(np.uint8)
    if PREV and n in PREV_AT:
        Image.fromarray(out).save(f"{PREV}/v4_{n:03d}.png")
    enc.stdin.write(out.tobytes())
enc.stdin.close()
enc.wait()
rd.p.kill()
print("frames", TOTAL, "duration", TOTAL / FPS)
