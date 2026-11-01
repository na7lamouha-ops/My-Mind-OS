"""EDPROD · الإنترو الثابت (16 s, 9:16) — 2.5D motion, no Veo.

A  0.0-6.5  darkness · blinking point · controller (rim light, tassyir engraved/off) · lightning ·
            spark up the strands · logo flickers on · orange bars on the right one by one
B  6.5-12.0 tassyir boots in cyan · cyan bars on the left · all lit · TV glitch · stadium
C 12.0-16.0 stadium waits (haze, pulsing rings, neon flicker) + scorebug builds + match title

usage (from repo root): python3 edprod/projects/2026-11-01-intro/render.py [title]
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "tools", "lib"))
from edprod_kit import (ASSETS, BLUE, FPS, GREEN, H, ORANGE, RED, SR, W, WHITE, Encoder, Mix, arrow_rgba, clamp01,  # noqa
                        crowd, ease_in3, ease_io, ease_out, flt, font, glow, inpaint_diffuse, over, rms, scaled,
                        sfx_whistle, text_glow, text_rgba, widen)

TITLE = sys.argv[1] if len(sys.argv) > 1 else "المباراة 01 · الطلبات المزيّفة"
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)
DUR = 16.0
TOTAL = int(DUR * FPS)
rng = np.random.default_rng(11)
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)
CY = (0.33, 0.84, 1.0)
OR = (1.0, 0.47, 0.08)


def rgba(path): return np.asarray(Image.open(path).convert("RGBA")).astype(np.float32) / 255


# ============================================================ intro layers ======
L = os.path.join(ASSETS, "layers")
S_L = 0.80
ctrl = rgba(f"{L}/layer-controller-tassyir.png")
logo = rgba(f"{L}/layer-logo-ecommanita.png")
strands = rgba(f"{L}/layer-light-strands.png")
# tassyir "off": wordmark painted with the controller plate colour
reg = ctrl[635:722, 935:1250]
mn, mx = reg[..., :3].min(-1), reg[..., :3].max(-1)
wm = np.clip((mx - 0.30) / 0.2, 0, 1) * np.clip(1 - (mx - mn) / 0.5, 0, 1) * (reg[..., 3] > 0.5)
wm = np.clip(nd.gaussian_filter(nd.grey_dilation(wm, size=3), 1.0) * 1.3, 0, 1)
plate = np.median(reg[..., :3][(wm < 0.05) & (reg[..., 3] > 0.5)], axis=0)
ctrl_off = ctrl.copy()
ctrl_off[635:722, 935:1250, :3] = reg[..., :3] * (1 - wm[..., None]) + (plate * 0.9 + reg[..., :3] * 0.08) * wm[..., None]
CTRL_ON, CTRL_OFF = scaled(ctrl, S_L), scaled(ctrl_off, S_L)
LOGO, STR = scaled(logo, S_L), scaled(strands, S_L)
WM = scaled(np.dstack([np.ones(wm.shape + (3,), np.float32), wm]), S_L)[..., 3]
OX, OY = int(540 - S_L * 1075), int(470 - S_L * 45)


def L2V(x, y): return S_L * x + OX, S_L * y + OY


WM_XY = (int(L2V(935, 635)[0]), int(L2V(935, 635)[1]))
CTRL_TOP = L2V(1086, 560)       # where the lightning hits / strands start
# rim light from the controller silhouette
ca = CTRL_ON[..., 3]
RIM = np.clip(ca - nd.grey_erosion(ca, size=7), 0, 1)
RIM = nd.gaussian_filter(RIM, 1.2)
# logo spark path: tops of the wordmark letters
lm = (logo[..., 3] > 0.8) & (logo[..., :3].max(-1) > 0.8)
lm[:250] = False
cols = np.nonzero(lm.any(0))[0]
SPATH = np.array([L2V(x, np.nonzero(lm[:, x])[0].min()) for x in cols[::3]])


def add_rgb(f, rgb, x, y):
    """additive paste with clipping (layers can be wider than the frame)."""
    h, w = rgb.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if x1 > x0 and y1 > y0:
        f[y0:y1, x0:x1] += rgb[y0 - y:y1 - y, x0 - x:x1 - x]


def bars(f, t, side, t_on, k_all=1.0):
    """three tall neon bars switching on one by one with a flicker."""
    xs = [930, 985, 1040] if side == "R" else [150, 95, 40]
    col = OR if side == "R" else CY
    for i, x in enumerate(xs):
        d = t - (t_on + 0.4 * i)
        if d < 0:
            continue
        fl = 1.0 if d > 0.18 else (1.0 if int(d * 60) % 3 else 0.25)
        a = fl * k_all * (0.95 - 0.18 * i) * (1 + 0.04 * math.sin(t * 13 + i))
        band = np.exp(-((XX[:1] - x) / 4.5) ** 2) * 1.2 + np.exp(-((XX[:1] - x) / 26) ** 2) * 0.45
        vert = np.clip(1 - np.abs(YY[:, :1] - 960) / 1150, 0, 1) ** 0.6
        f += (band * vert)[..., None] * np.array(col, np.float32) * a
        f += (np.exp(-((XX - x) / 160) ** 2) * 0.05 * a)[..., None] * np.array(col, np.float32)   # spill


def bolt(f, t, t0, x0, y0, x1, y1):
    d = t - t0
    if d < 0 or d > 0.35:
        return
    r = np.random.default_rng(int(t * 60))
    pts = [np.array([x0, y0]), np.array([x1, y1])]
    disp = 90.0
    for _ in range(7):
        new = [pts[0]]
        for a, b in zip(pts[:-1], pts[1:]):
            m = (a + b) / 2 + np.array([r.uniform(-disp, disp), 0])
            new += [m, b]
        pts = new
        disp *= 0.55
    acc = np.zeros((H, W), np.float32)
    for a, b in zip(pts[:-1], pts[1:]):
        n = int(np.linalg.norm(b - a)) + 1
        xs, ys = np.linspace(a[0], b[0], n).astype(int), np.linspace(a[1], b[1], n).astype(int)
        ok = (xs >= 0) & (xs < W) & (ys >= 0) & (ys < H)
        acc[ys[ok], xs[ok]] = 1
    k = (1 - d / 0.35) ** 1.5
    f += ((nd.gaussian_filter(acc, 2.5) * 10 + acc) * k)[..., None] * np.array([0.85, 0.92, 1.0], np.float32)


def intro_scene(t):
    f = np.zeros((H, W, 3), np.float32)
    # 0 - 1.5: one blinking point
    if t < 1.9:
        b = (0.5 + 0.5 * math.sin(t * 9)) * (1 - ease_io((t - 1.5) / 0.4))
        glow(f, 540, 980, 3, (255, 255, 255), 1.4 * b)
        glow(f, 540, 980, 18, (160, 200, 255), 0.25 * b)
    # 1.5 -> : controller from the dark (rim light, tassyir engraved), slow push-in
    reveal = ease_io((t - 1.5) / 1.4)
    lit_logo = ease_io((t - 4.2) / 0.8)
    all_lit = ease_io((t - 6.5) / 2.5)
    if reveal > 0:
        push = 1.0 + 0.05 * clamp01((t - 1.5) / 8.0)
        layer = np.zeros((H, W, 3), np.float32)
        c = CTRL_ON if (t >= 6.5 and ts_state(t) >= 1) else CTRL_OFF
        body = c.copy()
        body[..., :3] *= 0.10 + 0.25 * ease_io((t - 3.0) / 1.0) + 0.65 * all_lit
        over(layer, body, OX, OY, reveal)
        rim = RIM * (0.9 * reveal) * (1 - 0.6 * all_lit)
        add_rgb(layer, rim[..., None] * np.array([0.65, 0.85, 1.0], np.float32), OX, OY)
        # strands + spark (3.5 - 5.0)
        sv = clamp01((t - 3.5) / 1.3)
        if sv > 0:
            s = STR.copy()
            hh = s.shape[0]
            cut = int(hh * (1 - sv))                       # strands fill bottom-up
            s[:cut, :, 3] = 0
            over(layer, s, OX, OY, 0.9 * (0.7 + 0.3 * math.sin(t * 20)))
            sy = CTRL_TOP[1] - (CTRL_TOP[1] - L2V(1086, 330)[1]) * ease_io(sv)
            if sv < 1:
                glow(layer, CTRL_TOP[0], sy, 6, (255, 255, 255), 1.5)
                glow(layer, CTRL_TOP[0], sy, 28, (255, 170, 80), 0.5)
        # logo: flicker on, then brighter
        if t >= 4.6:
            d = t - 4.6
            fl = 1.0 if d > 0.45 else (1.0 if int(d * 40) % 3 != 1 else 0.1)
            lg = LOGO.copy()
            lg[..., :3] *= 0.6 + 0.4 * ease_io(d / 1.0)
            over(layer, lg, OX, OY, fl)
            if d < 0.9:
                idx = int(ease_io(d / 0.9) * (len(SPATH) - 1))
                for j in range(22):
                    if idx - j >= 0:
                        glow(layer, *SPATH[idx - j], 3.2, (255, 190, 110) if j % 2 else (110, 220, 255), 0.9 * (1 - j / 22))
        # tassyir boot (6.5 -> 7.3)
        if t >= 6.5:
            tassyir_boot(layer, t)
        im = Image.fromarray((np.clip(layer, 0, 1) * 255).astype(np.uint8))
        if push > 1.0005:
            im = im.resize((round(W * push), round(H * push)), Image.BICUBIC)
            ox, oy = round((im.width - W) / 2), round((im.height - H) / 2 + 30 * (push - 1))
            im = im.crop((ox, oy, ox + W, oy + H))
        f += np.asarray(im).astype(np.float32) / 255
    # 3.0: lightning onto the controller + white flash
    bolt(f, t, 3.0, CTRL_TOP[0] + 20, -20, CTRL_TOP[0], CTRL_TOP[1])
    fl = math.exp(-max(0.0, t - 3.02) / 0.09) if t >= 3.0 else 0
    f += 0.95 * fl
    bars(f, t, "R", 5.1)
    bars(f, t, "L", 7.6)
    return f


T_ON = 6.55


def ts_state(t):
    d = t - T_ON
    if d < 0:
        return 0.0
    for a, b, v in [(0.0, 0.07, 1), (0.07, 0.13, 0), (0.13, 0.17, 1), (0.17, 0.27, 0)]:
        if a <= d < b:
            return float(v)
    return 1.0


def tassyir_boot(layer, t):
    d = t - T_ON - 0.27
    if d < 0 or ts_state(t) < 1:
        return
    x0, y0 = WM_XY
    m = WM
    h, w = m.shape
    reg = layer[y0:y0 + h, x0:x0 + w]
    reg += (m * 0.5 * math.exp(-d / 0.5))[..., None] * np.array(CY, np.float32)
    reg += (nd.gaussian_filter(m, 6) * 1.1 * math.exp(-d / 0.7))[..., None] * np.array(CY, np.float32)
    cx, cy = x0 + w / 2, y0 + h / 2
    rr = 30 + 520 * d
    ring = np.exp(-((np.sqrt((XX - cx) ** 2 + ((YY - cy) * 1.4) ** 2) - rr) / 5) ** 2) * max(0.0, 1 - d / 0.8) * 0.9
    layer += ring[..., None] * np.array(CY, np.float32)


# ============================================================ stadium (poster) ===
P = np.asarray(Image.open(os.path.join(ASSETS, "posters", "match-poster.png")).convert("RGB")).astype(np.float32) / 255
for (cx, cy, r) in [(1352, 1830, 56), (330, 1892, 34)]:
    inpaint_diffuse(P, cx, cy, r)                      # painted balls: the match has not started
# hide the «تحالف رسمي» pill
yy, xx = np.mgrid[0:P.shape[0], 0:P.shape[1]].astype(np.float32)
pill = np.clip((1 - np.maximum(np.abs(xx - 1085) / 215, np.abs(yy - 83) / 50)) * 8, 0, 1)
P = P * (1 - pill[..., None]) + np.array([0.02, 0.02, 0.025], np.float32) * pill[..., None]
# grey pitch: our players grey, the opponent's half darker; logo / controller / bars keep their colour
pitch = np.clip((yy - 1560) / 60, 0, 1) * np.clip((2430 - yy) / 60, 0, 1) * np.clip((xx - 120) / 80, 0, 1) * np.clip((2060 - xx) / 80, 0, 1)
lum = P.mean(-1, keepdims=True)
grey = P * 0.15 + lum * 0.85
dark_half = 1 - 0.35 * np.clip((1086 - xx) / 120, 0, 1)
grey = grey * dark_half[..., None]
P = P * (1 - pitch[..., None]) + grey * pitch[..., None]
SCP = W / P.shape[1]
PH = int(P.shape[0] * SCP)
POFF = (H - PH) // 2
STAD = np.zeros((H, W, 3), np.float32)
STAD[POFF:POFF + PH] = np.asarray(Image.fromarray((np.clip(P, 0, 1) * 255).astype(np.uint8)).resize((W, PH), Image.LANCZOS)).astype(np.float32) / 255
# bottom: fade the poster's CTA and visa line (we put the match title there)
cover = np.clip((YY[:, :1] - 1440) / 22, 0, 1) * np.clip(np.minimum(XX[:1] - 90, 990 - XX[:1]) / 50, 0, 1) * 0.985
STAD *= (1 - cover)[..., None]


def S(p): return p[0] * SCP, POFF + p[1] * SCP


RINGS = [S(p) for p in [(2005, 2060), (1555, 1945), (1062, 1735), (650, 2060), (822, 1933), (705, 1820), (440, 1745), (1440, 2085), (1200, 2165), (1740, 1880)]]
haze_n = nd.gaussian_filter(rng.standard_normal((H // 8, W // 4 + 200)).astype(np.float32), (3, 10))
haze_n = (haze_n - haze_n.min()) / (haze_n.max() - haze_n.min())


def stadium_scene(t):
    f = STAD.copy()
    # haze drifting over the pitch
    sh = int(t * 12) % 200
    hz = np.kron(haze_n[:, sh:sh + W // 4], np.ones((8, 4), np.float32))[:H, :W]
    band = np.exp(-((YY - (POFF + 1980 * SCP)) / 220) ** 2)
    f += (hz * band * 0.10)[..., None] * np.array([0.75, 0.82, 0.9], np.float32)
    # neon frame flicker (the poster's own bars)
    fl = 1 + 0.05 * math.sin(t * 17) + 0.03 * math.sin(t * 41)
    side = (np.exp(-(XX / 130) ** 2) + np.exp(-((W - XX) / 130) ** 2))
    f *= (1 + (fl - 1) * side)[..., None]
    # rings under the players pulse gently
    for i, (x, y) in enumerate(RINGS):
        p = 0.5 + 0.5 * math.sin(t * 3 + i)
        d = np.sqrt(((XX - x) / 26) ** 2 + ((YY - y) / 8) ** 2)
        f += (np.exp(-((d - 1) / 0.12) ** 2) * 0.12 * p)[..., None] * np.array([0.8, 0.9, 1.0], np.float32)
    # tiny crowd flashes in the dark
    for k in range(4):
        if rng.random() < 0.25:
            glow(f, rng.uniform(80, 1000), rng.uniform(1200, 1440), 2, (255, 255, 255), 1.2)
    return f


def glitch(f, t, k):
    """TV channel switch: shake, scan lines, RGB split, noise, zig-zag."""
    r = np.random.default_rng(int(t * 90))
    out = f.copy()
    dx = int(r.integers(-18, 19) * k)
    dy = int(r.integers(-10, 11) * k)
    out = np.roll(out, (dy, dx), axis=(0, 1))
    zz = (np.sin(YY[:, 0] / 24 + t * 50) * 26 * k).astype(int)
    for y0 in range(0, H, 24):
        out[y0:y0 + 24] = np.roll(out[y0:y0 + 24], int(zz[y0] + r.integers(-30, 31) * k * (r.random() < 0.3)), axis=1)
    s = int(16 * k)
    out[..., 0] = np.roll(out[..., 0], s, axis=1)
    out[..., 2] = np.roll(out[..., 2], -s, axis=1)
    out[::3] *= 1 - 0.35 * k
    out += (r.standard_normal((H // 2, W // 2)).astype(np.float32).repeat(2, 0).repeat(2, 1)[..., None] * 0.12 * k)
    return out


# ============================================================ scorebug ==========
F_TAB, F_TEAM, F_SUB = font("Bold", 30), font("ExtraBold", 38), font("Medium", 22)
F_SCORE, F_TIME, F_STRIP = font("ExtraBold", 44), font("Bold", 30), font("Bold", 27)


def rr(w, h, col, r=14, outline=None):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=tuple(col) + (255,),
                                         outline=None if outline is None else tuple(outline) + (255,), width=3)
    return np.asarray(im).astype(np.float32) / 255


TAB = rr(470, 50, (255, 120, 20))
TAB_T = text_rgba("مباراة اليوم · مواجهة قوية", F_TAB, (20, 12, 4))
BLUEB = rr(430, 78, (16, 120, 170), outline=(40, 215, 255))
BLUE_T, BLUE_S = text_rgba("دفاع تسيير", F_TEAM, (255, 255, 255)), text_rgba("ضد السبام", F_SUB, (200, 240, 255))
REDB = rr(430, 78, (150, 24, 24), outline=(255, 59, 59))
RED_T = text_rgba("الطلبيات المزيّفة", F_TEAM, (255, 255, 255))
SCOREB = rr(150, 86, (8, 14, 26), outline=(245, 248, 252))
SCORE_T = text_rgba("0 - 0", F_SCORE, (255, 255, 255))
TIMEB = rr(150, 44, (8, 14, 26), r=22, outline=(120, 140, 160))
STRIP = rr(700, 44, (10, 18, 30), r=10, outline=(60, 80, 100))
STRIP_T = text_rgba("متصدّر منذ شهر  |  +3 تزييفات محبوسة", F_STRIP, (230, 236, 245))
TITLE_T = text_rgba(TITLE, font("ExtraBold", 56), (255, 255, 255))


def scorebug(f, t):
    if t < 12.0:
        return
    d = t - 12.0
    y = 18 - 80 * (1 - ease_out(d / 0.3))                      # tab drops
    over(f, TAB, 540 - 235, y)
    over(f, TAB_T, 540 - TAB_T.shape[1] / 2, y + 25 - TAB_T.shape[0] / 2)
    if t >= 12.3:
        k = ease_out((t - 12.3) / 0.45)
        xb = 1080 + (575 - 1080) * k                             # blue from the right
        xr = -430 + (75 - (-430)) * k                            # red from the left
        yb = 84
        over(f, BLUEB, xb, yb)
        over(f, BLUE_T, xb + 215 - BLUE_T.shape[1] / 2, yb + 30 - BLUE_T.shape[0] / 2)
        over(f, BLUE_S, xb + 215 - BLUE_S.shape[1] / 2, yb + 62 - BLUE_S.shape[0] / 2)
        over(f, REDB, xr, yb)
        over(f, RED_T, xr + 215 - RED_T.shape[1] / 2, yb + 39 - RED_T.shape[0] / 2)
        if t >= 12.75:
            kk = ease_out((t - 12.75) / 0.12)
            sb = scaled(SCOREB, 1 + 0.25 * (1 - kk))
            over(f, sb, 540 - sb.shape[1] / 2, yb + 39 - sb.shape[0] / 2)
            over(f, SCORE_T, 540 - SCORE_T.shape[1] / 2, yb + 39 - SCORE_T.shape[0] / 2)
            glow(f, 540, yb + 39, 60, (255, 255, 255), 0.5 * math.exp(-(t - 12.75) / 0.2))
    if t >= 12.8:
        k = ease_out((t - 12.8) / 0.25)
        secs = max(0, int(t - 15.5) + 1) if t >= 15.5 else 0
        tt = text_rgba(f"{secs // 60:02d}:{secs % 60:02d}", F_TIME, (255, 255, 255))
        yb = 172
        over(f, TIMEB, 540 - 75, yb, k)
        over(f, tt, 552 - tt.shape[1] / 2, yb + 22 - tt.shape[0] / 2, k)
        if int(t * 2) % 2 == 0:
            glow(f, 488, yb + 22, 5, (255, 59, 59), 1.6 * k)
    if t >= 13.2:
        k = ease_out((t - 13.2) / 0.35)
        x = 1080 + (190 - 1080) * k
        over(f, STRIP, x, 250)
        over(f, STRIP_T, x + 350 - STRIP_T.shape[1] / 2, 272 - STRIP_T.shape[0] / 2)
    if t >= 13.8:
        k = ease_io((t - 13.8) / 0.4)
        text_glow(f, TITLE_T, 540 - TITLE_T.shape[1] / 2, 1530 - TITLE_T.shape[0] / 2, (255, 160, 60), 0.5 * k)
        over(f, TITLE_T, 540 - TITLE_T.shape[1] / 2, 1530 - TITLE_T.shape[0] / 2, k)


# ============================================================ frames ============
def frame(n):
    t = n / FPS
    if t < 10.0:
        f = intro_scene(t)
    elif t < 11.0:
        u = (t - 10.0) / 1.0
        base = intro_scene(t) * (1 - ease_io((u - 0.35) / 0.4)) + stadium_scene(t) * ease_io((u - 0.35) / 0.4)
        f = glitch(base, t, math.sin(math.pi * u) ** 0.6)
    else:
        f = stadium_scene(t)
        if t < 11.25:
            f = glitch(f, t, 0.4 * (1 - (t - 11.0) / 0.25))
    scorebug(f, t)
    return f


enc = Encoder(os.path.join(OUT, "intro_video.mp4"))
for n in range(TOTAL):
    f = frame(n)
    if n % 15 == 0:
        Image.fromarray((np.clip(f, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, f"p_{n:04d}.png"))
    enc.write(f)
enc.close()
print("video done")

# ============================================================ sound =============
mix = Mix(DUR)


def ex(n, tau): return np.exp(-np.arange(n) / SR / tau)
def nz(n): return rng.standard_normal(n)


def sweep(n, fn):
    tm = np.arange(n) / SR
    return np.sin(2 * np.pi * np.cumsum(fn(tm)) / SR)


def bass_pulse():
    n = int(1.6 * SR)
    return np.tanh(1.6 * sweep(n, lambda t: 32 + 40 * np.exp(-t / 0.08)) * ex(n, 0.5))


def thunder():
    n = int(3.5 * SR)
    tm = np.arange(n) / SR
    crack = flt(nz(n), "high", 900) * ex(n, 0.08)
    lfo = sum(a * np.exp(-((tm - c) / w) ** 2) for c, w, a in [(0.25, 0.2, 1.0), (0.8, 0.3, 0.7), (1.5, 0.4, 0.5), (2.3, 0.5, 0.3)])
    roll = flt(nz(n), "low", 380) * lfo * 3
    sub = sweep(n, lambda t: 28 + 50 * np.exp(-t / 0.12)) * ex(n, 0.9)
    return np.tanh(crack * 1.4 + roll + sub)


def electric(dur):
    n = int(dur * SR)
    tm = np.arange(n) / SR
    gate = np.zeros(n)
    k = 0.0
    while k < dur:
        k += rng.exponential(1 / (30 + 90 * k / dur))
        i, m = int(k * SR), int(rng.uniform(0.003, 0.02) * SR)
        if i + m < n:
            gate[i:i + m] += rng.uniform(0.3, 1) * np.hanning(m)
    return (np.sign(np.sin(2 * np.pi * 110 * tm)) * 0.3 + flt(nz(n), "band", [2500, 9000])) * gate * (0.3 + 0.7 * tm / dur)


def whoosh(dur=0.9):
    n = int(dur * SR)
    u = np.arange(n) / n
    return flt(nz(n), "band", [150, 2500]) * np.sin(np.pi * u) ** 2 + 0.6 * sweep(n, lambda t: 50 + 30 * t) * np.sin(np.pi * u)


def clunk():
    n = int(1.4 * SR)
    tm = np.arange(n) / SR
    hit = sweep(n, lambda t: 70 + 60 * np.exp(-t / 0.02)) * ex(n, 0.12) + 0.5 * flt(nz(n), "band", [300, 2500]) * ex(n, 0.02)
    ring = (np.sin(2 * np.pi * 410 * tm) + 0.5 * np.sin(2 * np.pi * 1180 * tm)) * ex(n, 0.25) * 0.15
    hum = np.sin(2 * np.pi * 100 * tm) * 0.12 * np.clip(tm / 0.2, 0, 1) * ex(n, 0.9)
    return np.tanh(1.5 * (hit + ring + hum))


def chime():
    n = int(1.4 * SR)
    tm = np.arange(n) / SR
    return sum(a * np.sin(2 * np.pi * f * tm) * ex(n, 0.4) for f, a in [(1318.5, 1), (1975.5, 0.6), (2637, 0.3)]) * np.minimum(1, tm / 0.005)


def static(dur):
    n = int(dur * SR)
    s = flt(nz(n), "band", [400, 9000]) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 13 * np.arange(n) / SR)))
    s = (np.round(s * 8) / 8)[(np.arange(n) // 4) * 4]
    return s * np.minimum(1, np.arange(n) / (0.02 * SR)) * np.minimum(1, (n - np.arange(n)) / (0.08 * SR))


def tick():
    m = int(0.06 * SR)
    return flt(nz(m), "band", [2000, 7000]) * ex(m, 0.004)


def beep():
    m = int(0.18 * SR)
    tm = np.arange(m) / SR
    return np.sin(2 * np.pi * 1760 * tm) * np.minimum(1, tm / 0.005) * np.minimum(1, (tm[-1] - tm) / 0.03)


mix.place(0.3, bass_pulse(), 0.55)
n = int(8.5 * SR)
wind = flt(nz(n), "band", [200, 900], 2) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.2 * np.arange(n) / SR))
hum = np.sin(2 * np.pi * 50 * np.arange(n) / SR) * 0.5 + np.sin(2 * np.pi * 100 * np.arange(n) / SR) * 0.25
env = np.clip((np.arange(n) / SR - 0) / 1.2, 0, 1) * np.clip((8.5 - np.arange(n) / SR) / 1.0, 0, 1)
mix.place(1.5, wind * env * 0.04 + hum * env * 0.02)
mix.place(3.0, thunder(), 0.5)
mix.place(3.5, electric(1.4), 0.12)
mix.place(4.4, whoosh(1.0), 0.25)
for t0 in (5.1, 5.5, 5.9):
    mix.place(t0, clunk(), 0.32, pan=0.6)
mix.place(6.55, chime(), 0.10)
for t0 in (7.6, 8.0, 8.4):
    mix.place(t0, clunk(), 0.32, pan=-0.6)
amb_lo, amb_hi = crowd("ambience-low"), crowd("ambience-high")
nb = int(9.0 * SR)
bed = widen(amb_lo[int(4 * SR):int(4 * SR) + nb] / rms(amb_lo), 0.7)
tb = np.arange(nb) / SR + 7.5
bed *= np.interp(tb, [7.5, 9.0, 10.0, 11.0, 16.5], [0.0, 0.025, 0.04, 0.05, 0.05])[:, None]
bed[:, :] = flt(bed, "low", 1200) * (tb < 10)[:, None] + bed * (tb >= 10)[:, None]   # distant (muffled) until the stadium appears
mix.place(7.5, bed)
hi = widen(amb_hi[int(3 * SR):int(3 * SR) + int(5 * SR)] / rms(amb_hi), 0.7)
mix.place(11.0, hi * np.linspace(0.0, 0.035, len(hi))[:, None] ** 0.5)
mix.place(10.0, static(1.05), 0.10)
mix.place(11.55, sfx_whistle(0.55), 0.16)
hr = crowd("cheer-hr-3")
mix.place(13.6, widen(hr[:int(2.4 * SR)] / rms(hr), 0.7) * np.linspace(0.02, 0.03, int(2.4 * SR))[:, None])   # chants
mix.place(12.0, tick(), 0.25)
mix.place(12.75, bass_pulse(), 0.35)
mix.place(12.85, beep(), 0.07)
n2 = int(0.4 * SR)
mix.place(13.2, flt(nz(n2), "band", [800, 6000]) * np.sin(np.pi * np.arange(n2) / n2) ** 2, 0.07)
for s in range(int(15.5), 16):
    mix.place(s + 0.5, tick(), 0.12)
gr = mix.save(os.path.join(OUT, "intro.wav"))
print(f"audio done, gain reduction {gr:.1f} dB")
