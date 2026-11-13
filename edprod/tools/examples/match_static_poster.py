"""«الماتش» v2 — 10 s, static poster, only the ball plays.
Attack 1: 3 good passes («أوييي!» each) -> goal; the captain armband (C) appears on كرياتيف وينر.
Attack 2: 2 good passes -> the ball stops at التأكيد; angry whistling.

usage: match_v2.py <poster.png> <tajawal_dir> <out.mp4>
"""
import math
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as nd
from scipy.ndimage import maximum_filter1d, uniform_filter1d
from scipy.signal import butter, resample_poly, sosfilt

POSTER, FONTS, OUT = sys.argv[1:4]
W, H, FPS, DUR = 1080, 1920, 30, 10.0
TOTAL = int(DUR * FPS)
RAQM = ImageFont.Layout.RAQM


def F(w, s): return ImageFont.truetype(f"{FONTS}/Tajawal-{w}.ttf", s, layout_engine=RAQM)
def clamp01(x): return min(1.0, max(0.0, x))
def eio(x): x = clamp01(x); return 3 * x * x - 2 * x ** 3
def eout(x): x = clamp01(x); return 1 - (1 - x) ** 2


GREEN = (43, 217, 107)
RED = (255, 59, 59)
ORNG = (255, 120, 20)
WHITE = (245, 248, 252)
GOLDA = (255, 205, 90)

# ---------------------------------------------------------------- poster -------
src = np.asarray(Image.open(POSTER).convert("RGB")).astype(np.float32) / 255
PH, PW = src.shape[:2]


def inpaint_diffuse(img, cx, cy, r, sig):
    y0, y1, x0, x1 = int(cy - 4 * r), int(cy + 4 * r), int(cx - 4 * r), int(cx + 4 * r)
    reg = img[y0:y1, x0:x1].copy()
    yy, xx = np.mgrid[y0:y1, x0:x1]
    m = ((xx - cx) ** 2 + ((yy - cy) * 1.15) ** 2) < r * r
    fill = reg.copy()
    for _ in range(120):
        bl = np.stack([nd.uniform_filter(fill[..., c], 7) for c in range(3)], -1)
        fill = np.where(m[..., None], bl, reg)
    soft = nd.gaussian_filter(m.astype(np.float32), sig)[..., None]
    img[y0:y1, x0:x1] = reg * (1 - soft) + fill * soft


def inpaint_disc(img, cx, cy, r):
    y0, y1, x0, x1 = int(cy - 3 * r), int(cy + 3 * r), int(cx - 3 * r), int(cx + 3 * r)
    reg = img[y0:y1, x0:x1].copy()
    yy, xx = np.mgrid[y0:y1, x0:x1]
    m = ((xx - cx) ** 2 + (yy - cy) ** 2) < r * r
    known = (~m).astype(np.float32)
    num = np.stack([nd.gaussian_filter(reg[..., c] * known, r * 0.8) for c in range(3)], -1)
    den = nd.gaussian_filter(known, r * 0.8)[..., None] + 1e-6
    soft = nd.gaussian_filter(m.astype(np.float32), 2)[..., None]
    img[y0:y1, x0:x1] = reg * (1 - soft) + (num / den) * soft


inpaint_diffuse(src, 1352, 1830, 56, 4)  # painted ball mid-air (and its glow)
inpaint_disc(src, 330, 1892, 30)         # painted ball in the net
inpaint_disc(src, 1595, 1875, 27)        # the C armband: it is earned in this video
SC = W / PW
POST_H = int(PH * SC)
OFF_Y = (H - POST_H) // 2
BASE = np.zeros((H, W, 3), np.float32)
BASE[OFF_Y:OFF_Y + POST_H] = np.asarray(Image.fromarray((np.clip(src, 0, 1) * 255).astype(np.uint8)).resize(
    (W, POST_H), Image.LANCZOS)).astype(np.float32) / 255


def S(p): return p[0] * SC, OFF_Y + p[1] * SC


MB, CAP, CONF, DELIV, GOAL = (1990, 2035), (1530, 1915), (1065, 1715), (665, 2035), (330, 1892)
BADGE = (1595, 1875)

# ball path: (t, poster point)
PATH = [(0.0, MB), (0.6, MB), (1.1, CAP), (1.3, CAP), (1.42, (1497, 1932)), (1.52, (1525, 1898)), (1.6, CAP),
        (2.1, CONF), (2.25, CONF), (2.75, DELIV), (2.9, DELIV), (3.2, GOAL), (4.7, (345, 1900)),
        (5.1, MB), (5.2, MB), (5.7, CAP), (5.9, CAP), (6.4, CONF), (6.75, CONF),
        (6.95, (990, 1765)), (7.25, (1040, 1735)), (10.0, (1040, 1735))]
HIDDEN = (4.7, 5.1)          # ball disappears while the play resets
LOFT = {(0.6, 1.1), (1.6, 2.1), (2.25, 2.75), (5.2, 5.7), (5.9, 6.4)}


def ball(t):
    for (t0, a), (t1, b) in zip(PATH[:-1], PATH[1:]):
        if t0 <= t <= t1:
            u = eio((t - t0) / max(1e-3, t1 - t0))
            x, y = a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u
            h = -60 * math.sin(math.pi * u) if (t0, t1) in LOFT else 0
            return x, y + h, y
    return PATH[-1][1][0], PATH[-1][1][1], PATH[-1][1][1]


# ---------------------------------------------------------------- drawing ------
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)


def over(f, a, x, y, alpha=1.0):
    h, w = a.shape[:2]
    x, y = int(x), int(y)
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if x1 > x0 and y1 > y0 and alpha > 0:
        s = a[y0 - y:y1 - y, x0 - x:x1 - x]
        k = s[..., 3:4] * alpha
        f[y0:y1, x0:x1] = s[..., :3] * k + f[y0:y1, x0:x1] * (1 - k)


def glow(f, x, y, r, col, k):
    R = int(r * 3) + 2
    x0, y0 = int(x) - R, int(y) - R
    yy, xx = np.mgrid[0:2 * R, 0:2 * R].astype(np.float32)
    g = np.exp(-(((xx + x0 - x) ** 2 + (yy + y0 - y) ** 2) / (r * r))) * k
    a0, b0, a1, b1 = max(0, x0), max(0, y0), min(W, x0 + 2 * R), min(H, y0 + 2 * R)
    f[b0:b1, a0:a1] += g[b0 - y0:b1 - y0, a0 - x0:a1 - x0, None] * np.array(col, np.float32) / 255


def text_rgba(s, fnt, col):
    im = Image.new("RGBA", (1500, 260), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((750, 130), s, font=fnt, fill=col + (255,), anchor="mm", direction="rtl")
    return np.asarray(im.crop(im.getbbox())).astype(np.float32) / 255


def scaled(a, k):
    return np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "RGBA").resize(
        (max(1, int(a.shape[1] * k)), max(1, int(a.shape[0] * k))), Image.BICUBIC)).astype(np.float32) / 255


def put_glow(f, img, x, y, col, k):
    P = 40
    gl = nd.gaussian_filter(np.pad(img[..., 3], P), 12)[..., None] * np.array(col, np.float32) / 255 * k
    h, w = gl.shape[:2]
    x0, y0 = int(x) - P, int(y) - P
    a0, b0, a1, b1 = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
    f[b0:b1, a0:a1] += gl[b0 - y0:b1 - y0, a0 - x0:a1 - x0]


def arrow(f, xr, cy, w, col=GOLDA):
    pts = [(xr - w, cy), (xr - w + 18, cy - 14), (xr - w + 18, cy - 5), (xr, cy - 5), (xr, cy + 5), (xr - w + 18, cy + 5), (xr - w + 18, cy + 14)]
    im = Image.new("RGBA", (W, 60), (0, 0, 0, 0))
    ImageDraw.Draw(im).polygon([(x, y - cy + 30) for x, y in pts], fill=col + (255,))
    over(f, np.asarray(im).astype(np.float32) / 255, 0, cy - 30)


FC = F("ExtraBold", 66)
TY = 120


class Chain:
    def __init__(self, items, t_out):
        """items: [(text, colour, t_show)] laid right->left with arrows; last may follow '='."""
        self.items = [(text_rgba(s, FC, c), c, t0, s) for s, c, t0 in items]
        self.eq = text_rgba("=", FC, WHITE)
        self.t_out = t_out
        widths = [a.shape[1] for a, *_ in self.items]
        self.total = sum(widths) + 46 * (len(widths) - 1) + 26 * 2 * (len(widths) - 1)
        self.right = 540 + self.total / 2

    def draw(self, f, t, use_eq_last=True):
        if t >= self.t_out + 0.2:
            return
        a_out = 1 - eio((t - self.t_out) / 0.2)
        x = self.right
        n = len(self.items)
        for i, (img, col, t0, s) in enumerate(self.items):
            if i > 0:
                if t >= t0:
                    if use_eq_last and i == n - 1:
                        over(f, self.eq, x - 46 / 2 - self.eq.shape[1] / 2 - 26, TY - self.eq.shape[0] / 2, a_out)
                    else:
                        tmp = np.zeros_like(f)
                        arrow(tmp, x - 26, TY, 46)
                        f += tmp * a_out
                x -= 46 + 2 * 26
            if t >= t0:
                pop = 1 + 0.18 * (1 - eout((t - t0) / 0.15))
                a2 = scaled(img, pop) if pop > 1.001 else img
                cx = x - img.shape[1] / 2
                if col != WHITE:
                    put_glow(f, a2, cx - a2.shape[1] / 2, TY - a2.shape[0] / 2, col, 0.9 * a_out)
                over(f, a2, cx - a2.shape[1] / 2, TY - a2.shape[0] / 2, a_out)
            x -= img.shape[1]


CH1 = Chain([("ليد", WHITE, 1.1), ("مؤكّدة", WHITE, 2.1), ("موصّلة", WHITE, 2.75), ("هدف", GREEN, 3.2)], t_out=3.4)
CH2 = Chain([("ليد", WHITE, 5.7), ("مؤكّدة", WHITE, 6.4)], t_out=6.85)
T_BADGE = text_rgba("الشارة لـ كرياتيف وينر", F("ExtraBold", 64), ORNG)
T_STOP = text_rgba("الكورة حبست في التأكيد", F("ExtraBold", 64), RED)


def badge(f, t):
    if t < 3.4:
        return
    d = t - 3.4
    x, y = S(BADGE)
    k = eout(d / 0.25)
    r = 13 * (1 + 0.6 * (1 - k)) * (1 + 0.05 * math.sin(d * 8))
    glow(f, x, y, 30 * (1 + 0.8 * math.exp(-d / 0.4)), ORNG, 1.2 * k)
    disc = np.clip(r + 0.6 - np.sqrt((XX - x) ** 2 + (YY - y) ** 2), 0, 1)
    edge = np.clip(1.6 - np.abs(np.sqrt((XX - x) ** 2 + (YY - y) ** 2) - r), 0, 1)
    f[:] = f * (1 - disc[..., None]) + disc[..., None] * np.array([1.0, 0.47, 0.12], np.float32)
    f[:] = f * (1 - edge[..., None] * 0.9) + edge[..., None] * 0.9 * np.array([1.0, 0.85, 0.7], np.float32)
    ci = text_rgba("C", F("ExtraBold", int(26 * (r / 13))), WHITE)
    over(f, ci, x - ci.shape[1] / 2, y - ci.shape[0] / 2, k)
    if d < 0.6:     # sparkle burst
        for j in range(10):
            a = j * 2 * math.pi / 10
            rr = 10 + 70 * eout(d / 0.6)
            glow(f, x + rr * math.cos(a), y + rr * math.sin(a), 3, (255, 220, 160), 1.2 * (1 - d / 0.6))


def stop_mark(f, t):
    if t < 7.0:
        return
    x, y = S(CONF)
    k = eout((t - 7.0) / 0.2)
    pul = 1 + 0.08 * math.sin((t - 7.0) * 10)
    r = 26 * pul
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cy = y - 70
    d.line([(x - r, cy - r), (x + r, cy + r)], fill=RED + (int(255 * k),), width=9)
    d.line([(x + r, cy - r), (x - r, cy + r)], fill=RED + (int(255 * k),), width=9)
    glow(f, x, cy, 40, RED, 0.8 * k)
    over(f, np.asarray(im).astype(np.float32) / 255, 0, 0)


def draw_ball(f, t):
    if HIDDEN[0] < t < HIDDEN[1]:
        return
    bx, by, gy = ball(t)
    sx, sy = S((bx, by))
    gx, gyy = S((bx, gy))
    r = 24 * SC * 1.45
    f *= (1 - 0.5 * np.exp(-(((XX - gx) / (r * 1.3)) ** 2 + ((YY - gyy - r * 0.6) / (r * 0.45)) ** 2)))[..., None]
    dd = np.sqrt((XX - sx) ** 2 + (YY - sy) ** 2)
    disc = np.clip(r + 0.5 - dd, 0, 1)
    shade = np.clip(1 - ((XX - sx + r * 0.35) ** 2 + (YY - sy + r * 0.35) ** 2) / (2.2 * r * r), 0.35, 1)
    f[:] = f * (1 - disc[..., None]) + (disc * shade)[..., None] * np.array([0.97, 0.97, 0.98], np.float32)
    glow(f, sx, sy, r * 1.6, (255, 255, 255), 0.25)
    if 2.9 <= t <= 3.35:
        for k in range(8):
            tt = t - k * 0.025
            if tt >= 2.9:
                x, y, _ = ball(tt)
                glow(f, *S((x, y)), 7, (255, 240, 200), 0.35 * (1 - k / 8))


def frame(n):
    t = n / FPS
    f = BASE.copy()
    draw_ball(f, t)
    badge(f, t)
    stop_mark(f, t)
    CH1.draw(f, t)
    if 3.62 <= t < 4.9:
        a = eio((t - 3.62) / 0.2) * (1 - eio((t - 4.7) / 0.2))
        put_glow(f, T_BADGE, 540 - T_BADGE.shape[1] / 2, TY - T_BADGE.shape[0] / 2, ORNG, 0.7 * a)
        over(f, T_BADGE, 540 - T_BADGE.shape[1] / 2, TY - T_BADGE.shape[0] / 2, a)
    CH2.draw(f, t, use_eq_last=False)
    if t >= 7.0:
        k = eout((t - 7.0) / 0.15)
        img = scaled(T_STOP, 1 + 0.2 * (1 - k)) if k < 1 else T_STOP
        put_glow(f, img, 540 - img.shape[1] / 2, TY - img.shape[0] / 2, RED, 0.6 * k)
        over(f, img, 540 - img.shape[1] / 2, TY - img.shape[0] / 2, k)
    return f


enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                        "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "14",
                        "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT + ".video.mp4"],
                       stdin=subprocess.PIPE)
for n in range(TOTAL):
    o = (np.clip(frame(n), 0, 1) * 255 + 0.5).astype(np.uint8)
    if n in (35, 66, 100, 110, 130, 180, 200, 225, 260, 290):
        Image.fromarray(o).save(f"{OUT}.f{n:03d}.png")
    enc.stdin.write(o.tobytes())
enc.stdin.close()
enc.wait()

# ================================================================= sound =======
SR = 48000
N = int(DUR * SR)
rng = np.random.default_rng(3)


def flt(x, kind, fq, order=4): return sosfilt(butter(order, fq, btype=kind, fs=SR, output="sos"), x, axis=0)
def ex(n, tau): return np.exp(-np.arange(n) / SR / tau)
def nz(n): return rng.standard_normal(n)


def pan2(s, p):
    a = (p + 1) * np.pi / 4
    return np.stack([s * np.cos(a), s * np.sin(a)], 1)


out = np.zeros((N, 2))


def place(t0, sig, pan=0.0, gain=1.0):
    i = int(t0 * SR)
    if sig.ndim == 1:
        sig = pan2(sig, pan)
    j = min(N, i + len(sig))
    out[i:j] += gain * sig[:j - i]


def verb(sig, decay=1.5, mix=0.35, lpf=4000):
    n = int(decay * 1.5 * SR)
    m = sig if sig.ndim == 1 else sig.mean(1)
    L = len(m) + n
    M = np.fft.rfft(m, L)
    wet = []
    for _ in range(2):
        ir = flt(nz(n), "low", lpf) * ex(n, decay / 3)
        ir /= np.sqrt((ir ** 2).sum())
        wet.append(np.fft.irfft(M * np.fft.rfft(ir, L), L))
    dry = pan2(np.pad(m, (0, n)), 0) if sig.ndim == 1 else np.pad(sig, ((0, n), (0, 0)))
    return dry * (1 - mix) + mix * np.stack(wet, 1)


def norm(o): return o / (np.sqrt(np.mean(o ** 2)) + 1e-9)


def oyee(voices=110):
    """one short stadium «أوييي!»: /u/ gliding up to /i/."""
    n = int(1.1 * SR)
    o = np.zeros((n, 2))
    for _ in range(voices):
        f0 = rng.uniform(130, 250)
        st = rng.uniform(0, 0.03)
        du, di = 0.22 + rng.uniform(-0.03, 0.03), 0.30 + rng.uniform(-0.04, 0.04)
        m = int((du + di) * SR)
        tm = np.arange(m) / SR
        gl = np.clip((tm - du + 0.05) / 0.08, 0, 1)
        fp = f0 * (1 + 0.40 * gl) * (1 + 0.012 * np.sin(2 * np.pi * 5.5 * tm))
        s = ((np.cumsum(fp) / SR) % 1.0) * 2 - 1
        u = flt(s, "band", [260, 480], 2) + 0.55 * flt(s, "band", [700, 1000], 2)
        i_ = flt(s, "band", [240, 420], 2) + 0.75 * flt(s, "band", [2000, 2700], 2)
        v = (u * (1 - gl) + i_ * gl) * np.minimum(1, tm / 0.04) * np.minimum(1, (tm[-1] - tm) / 0.10) * (1 + 0.3 * gl)
        i0 = int(st * SR)
        o[i0:i0 + m] += pan2(v * rng.uniform(0.3, 1.0), rng.uniform(-0.95, 0.95))
    return norm(verb(flt(o, "low", 6000), 1.2, 0.28, 4000))


def cheer(dur, nv=150):
    n = int(dur * SR)
    o = np.zeros((n, 2))
    for _ in range(nv):
        st = rng.uniform(0, 0.2 * dur)
        m = int(rng.uniform(0.5, 0.95) * (dur - st) * SR)
        tm = np.arange(m) / SR
        f0 = rng.uniform(140, 320)
        s = ((np.cumsum(f0 * (1 + 0.15 * np.sin(np.pi * tm / tm[-1]))) / SR) % 1.0) * 2 - 1
        f1, f2 = [(800, 1200), (650, 1100), (500, 1800)][rng.integers(3)]
        v = flt(s, "band", [f1 * 0.8, f1 * 1.2], 2) + 0.5 * flt(s, "band", [f2 * 0.85, f2 * 1.15], 2)
        i0 = int(st * SR)
        o[i0:i0 + m] += pan2(v * np.minimum(1, tm / 0.1) * np.minimum(1, (tm[-1] - tm) / 0.3) * rng.uniform(0.2, 0.7), rng.uniform(-0.9, 0.9))
    return norm(verb(flt(o, "low", 5000), 1.6, 0.4, 3000))


def angry(dur):
    """fan whistling (two-finger whistles) + booing «هووو»."""
    n = int(dur * SR)
    o = np.zeros((n + int(1.2 * SR), 2))
    for _ in range(45):                       # whistles
        st = rng.uniform(0, dur - 0.5)
        m = int(rng.uniform(0.35, 1.1) * SR)
        tm = np.arange(m) / SR
        f = rng.uniform(1900, 3200)
        shape = rng.integers(3)
        if shape == 0:
            fp = f * (1 + 0.25 * tm / tm[-1])                         # rising
        elif shape == 1:
            fp = f * (1 + 0.2 * np.sin(np.pi * tm / tm[-1]))          # up-down
        else:
            fp = f * (1 - 0.18 * tm / tm[-1])                         # falling
        fp = fp * (1 + 0.01 * np.sin(2 * np.pi * 7 * tm))
        w = np.sin(2 * np.pi * np.cumsum(fp) / SR) + 0.05 * flt(nz(m), "band", [1500, 5000])
        i0 = int(st * SR)
        o[i0:i0 + m] += pan2(w * np.minimum(1, tm / 0.03) * np.minimum(1, (tm[-1] - tm) / 0.06) * rng.uniform(0.2, 0.6), rng.uniform(-1, 1))
    for _ in range(90):                       # booing
        st = rng.uniform(0, 0.4)
        m = int(rng.uniform(0.8, 1.0) * (dur - st) * SR)
        tm = np.arange(m) / SR
        f0 = rng.uniform(100, 190)
        s = ((np.cumsum(f0 * (1 - 0.06 * tm / tm[-1])) / SR) % 1.0) * 2 - 1
        v = flt(s, "band", [250, 450], 2) + 0.4 * flt(s, "band", [650, 900], 2)
        i0 = int(st * SR)
        o[i0:i0 + m] += pan2(v * np.minimum(1, tm / 0.15) * np.minimum(1, (tm[-1] - tm) / 0.4) * rng.uniform(0.2, 0.6), rng.uniform(-0.9, 0.9))
    return norm(verb(o, 1.6, 0.4, 5000))


def kick(strong=1.0):
    n = int(0.3 * SR)
    tm = np.arange(n) / SR
    return (np.sin(2 * np.pi * np.cumsum(60 + 90 * np.exp(-tm / 0.02)) / SR) * ex(n, 0.05 * strong) +
            0.45 * flt(nz(n), "band", [800, 4000]) * ex(n, 0.008))


def net():
    n = int(0.7 * SR)
    return flt(nz(n), "band", [1500, 6000]) * ex(n, 0.14) * (1 + 0.5 * np.sin(2 * np.pi * 37 * np.arange(n) / SR))


def sparkle():
    n = int(0.8 * SR)
    tm = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * tm) * ex(n, 0.25) for f in (1568, 2093, 2637))
    return verb(s * np.minimum(1, tm / 0.005), 1.2, 0.4, 9000)


# ambience bed
bed = np.zeros((N, 2))
for lo, hi, gn in [(150, 600, 1.0), (600, 1800, 0.6), (1800, 4000, 0.25)]:
    for c in range(2):
        am = flt(nz(N), "low", 0.8, 2)
        bed[:, c] += flt(nz(N), "band", [lo, hi], 2) * (0.65 + 0.35 * am / (np.abs(am).max() + 1e-9)) * gn
bed = norm(verb(bed, 2.0, 0.5, 2500)[:N]) * 0.045
tt = np.arange(N) / SR
place(0, bed * np.interp(tt, [0, 0.4, 3.0, 3.2, 4.6, 5.2, 6.9, 7.1, 10], [0.4, 0.8, 1.0, 1.1, 0.7, 0.8, 0.9, 0.5, 0.5])[:, None])
# attack 1
for t0, p, g in [(0.6, 0.5, 0.45), (1.42, 0.3, 0.15), (1.52, 0.3, 0.15), (1.6, 0.3, 0.45), (2.25, -0.2, 0.45)]:
    place(t0, kick(0.5 if g < 0.3 else 1.0), pan=p, gain=g)
for t0 in (1.1, 2.1, 2.75):
    place(t0 - 0.02, oyee(), gain=0.15)                       # «أوييي!» on every completed pass
place(2.9, kick(1.6), pan=-0.5, gain=0.7)
place(3.2, net(), pan=-0.6, gain=0.45)
place(3.18, cheer(1.8), gain=0.13)
place(3.4, sparkle(), pan=0.5, gain=0.12)                     # the armband appears
# attack 2
for t0, p in [(5.2, 0.5), (5.9, 0.3), (6.75, -0.1)]:
    place(t0, kick(), pan=p, gain=0.42)
for t0 in (5.7, 6.4):
    place(t0 - 0.02, oyee(), gain=0.15)
place(6.98, angry(3.0), gain=0.16)                            # the ball stops at التأكيد

mix = out
thr = 10 ** (-1.5 / 20)
up = np.abs(resample_poly(mix, 4, 1, axis=0)).max(1)[:4 * N].reshape(N, 4).max(1)
la = int(0.003 * SR)
gr = uniform_filter1d(np.minimum(1, thr / np.maximum(maximum_filter1d(up, 4 * la + 1), 1e-9)), 2 * la + 1)
g = np.empty_like(gr)
cur, rel = 1.0, np.exp(-1 / (0.08 * SR))
for i in range(N):
    cur = gr[i] if gr[i] < cur else rel * cur + (1 - rel) * gr[i]
    g[i] = cur
mix *= g[:, None]
with wave.open(OUT + ".wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
print("audio ok")
