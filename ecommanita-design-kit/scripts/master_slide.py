"""Presentation master 16:9: small Tassyir controller bottom-centre; light rays leave it, run along the frame
(+ free strands) and converge at the top into the ecommanita logo, which sparks.
Usage: master_slide.py OUT.png"""
import sys
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
import os
KIT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = KIT + "/fonts"
KEY16 = KIT + "/assets/course-logo-key.png"
KMASK = KIT + "/assets/ctrl-key-mask.png"
POSTER = KIT + "/assets/key-poster-gpt.png"
TAS = KIT + "/assets/tassyir-logo-mask.png"
W, H, Z = 1920, 1080, 2
w2, h2 = W * Z, H * Z
CY = np.array([40, 215, 255], np.float32)      # RGB
OR = np.array([255, 120, 20], np.float32)
HOT = np.array([255, 240, 215], np.float32)

canvas = np.full((h2, w2, 3), 5, np.float32)
xs = (np.arange(w2) + .5) / w2
canvas += (np.exp(-0.5 * (xs / 0.14) ** 2)[None, :, None] * CY + np.exp(-0.5 * ((1 - xs) / 0.14) ** 2)[None, :, None] * OR) * 0.06
canvas += np.random.default_rng(5).normal(0, 1.1, canvas.shape)


def add(mask, color, k=1.0, radii=((22, .9), (7, .8), (2, .5))):
    global canvas
    g = sum(cv2.GaussianBlur(mask, (0, 0), r * Z) * w for r, w in radii)
    col = color if np.ndim(color) == 3 else color[None, None, :]
    canvas = np.clip(canvas + g[..., None] * col * k, 0, 255)


# ---------- layout ----------
M, R = 46, 40
CTRL_H = 150                           # controller height on slide
CTRL_CY = H - 22 - CTRL_H / 2          # sits on the bottom edge
LOGO_TOP = 18                          # emblem top

# ---------- grey pitch in the middle (top-down, light holographic lines) ----------
PX0, PY0, PX1, PY1 = 150, 262, 1770, 872
pm = np.zeros((h2, w2), np.float32)
def L_(a, b): cv2.line(pm, (int(a[0] * Z), int(a[1] * Z)), (int(b[0] * Z), int(b[1] * Z)), 1.0, 3, cv2.LINE_AA)
def Rct(x0_, y0_, x1_, y1_):
    L_((x0_, y0_), (x1_, y0_)); L_((x1_, y0_), (x1_, y1_)); L_((x1_, y1_), (x0_, y1_)); L_((x0_, y1_), (x0_, y0_))
Rct(PX0, PY0, PX1, PY1)
pmx, pmy = (PX0 + PX1) / 2, (PY0 + PY1) / 2
L_((pmx, PY0), (pmx, PY1))
cv2.circle(pm, (int(pmx * Z), int(pmy * Z)), int(92 * Z), 1.0, 3, cv2.LINE_AA)
cv2.circle(pm, (int(pmx * Z), int(pmy * Z)), int(5 * Z), 1.0, -1, cv2.LINE_AA)
for sx_, sg in ((PX0, 1), (PX1, -1)):
    Rct(*sorted([sx_, sx_ + sg * 225])[:1], pmy - 195, *sorted([sx_, sx_ + sg * 225])[1:], pmy + 195)
    Rct(*sorted([sx_, sx_ + sg * 82])[:1], pmy - 92, *sorted([sx_, sx_ + sg * 82])[1:], pmy + 92)
    cv2.circle(pm, (int((sx_ + sg * 150) * Z), int(pmy * Z)), int(3.5 * Z), 1.0, -1, cv2.LINE_AA)
    cv2.ellipse(pm, (int((sx_ + sg * 150) * Z), int(pmy * Z)), (int(72 * Z), int(72 * Z)), 0,
                -52 if sg > 0 else 128, 52 if sg > 0 else 232, 1.0, 3, cv2.LINE_AA)
# corner arcs
for cxk, cyk, a0 in ((PX0, PY0, 0), (PX1, PY0, 90), (PX1, PY1, 180), (PX0, PY1, 270)):
    cv2.ellipse(pm, (int(cxk * Z), int(cyk * Z)), (int(14 * Z), int(14 * Z)), 0, a0, a0 + 90, 1.0, 3, cv2.LINE_AA)
GREY = np.array([170, 178, 184], np.float32)
canvas = np.clip(canvas + cv2.GaussianBlur(pm, (0, 0), 7 * Z)[..., None] * GREY * 0.10, 0, 255)
canvas = canvas * (1 - 0.28 * pm[..., None]) + GREY * 0.28 * pm[..., None]
# faint turf stripes
stripe = ((np.arange(w2) // int(162 * Z)) % 2).astype(np.float32)[None, :]
inside = np.zeros((h2, w2), np.float32); inside[int(PY0 * Z):int(PY1 * Z), int(PX0 * Z):int(PX1 * Z)] = 1
canvas = canvas + (stripe * inside)[..., None] * 3.0

# ---------- controller (segmented from the key visual) ----------
key = cv2.cvtColor(cv2.imread(KEY16, cv2.IMREAD_COLOR), cv2.COLOR_BGR2RGB).astype(np.float32)
km = cv2.imread(KMASK, cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255
ys_, xs_ = np.where(km > 0.5)
x0, x1, y0, y1 = xs_.min(), xs_.max() + 1, ys_.min(), ys_.max() + 1
cc = key[y0:y1, x0:x1].copy(); ca = cv2.GaussianBlur(km[y0:y1, x0:x1], (0, 0), 1.0)
ca = ca * np.clip((612 - (np.arange(y0, y1)))/14, 0, 1)[:, None]
# drop the dark pedestal between the grips
_yy = np.arange(y0, y1)[:, None]; _xx = np.arange(x0, x1)[None, :]
ca = ca * (1 - ((_yy > 498) & (_xx > 452) & (_xx < 640)).astype(np.float32))
ca = cv2.GaussianBlur(ca.astype(np.float32), (0, 0), 0.8)
# tassyir on the pad: erase the grey mark, set it in glowing cyan
pad = (470 - x0, 318 - y0, 625 - x0, 362 - y0)
pm = np.zeros(cc.shape[:2], np.uint8)
reg = cc[pad[1]:pad[3], pad[0]:pad[2]]
pm[pad[1]:pad[3], pad[0]:pad[2]] = ((reg.max(2) > 70) * 255).astype(np.uint8)
pm = cv2.dilate(pm, np.ones((3, 3), np.uint8))
cc = cv2.inpaint(np.clip(cc, 0, 255).astype(np.uint8), pm, 5, cv2.INPAINT_TELEA).astype(np.float32)
sc = CTRL_H * Z / cc.shape[0]
cw = int(cc.shape[1] * sc); ch = int(cc.shape[0] * sc)
cc = cv2.resize(cc, (cw, ch), interpolation=cv2.INTER_AREA); ca = cv2.resize(ca, (cw, ch), interpolation=cv2.INTER_AREA)
cx0 = int(W * Z / 2 - cw / 2); cy0 = int(CTRL_CY * Z - ch / 2)
# emission points: the touchpad top (where the poster's streams start) splits into two rays, left & right
EX, EY = W / 2, cy0 / Z + 6

# ---------- ray paths ----------
def side_path(sgn):
    """Points (slide px) from the controller top, out to the side, down to the bottom frame edge? No: the ray hugs
    the controller shoulder, drops to the bottom frame line, runs to the corner, up the side, along the top to the logo."""
    pts = []
    # leave the controller: short curve from emission point to the bottom frame line, outside the controller
    sx = W / 2 + sgn * (cw / Z / 2 + 18)
    by = H - M
    P0 = np.array([EX, EY]); P1 = np.array([sx + sgn * 60, EY - 30]); P2 = np.array([sx + sgn * 8, by])
    for t in np.linspace(0, 1, 60):
        pts.append(tuple((1 - t) ** 2 * P0 + 2 * (1 - t) * t * P1 + t * t * P2))
    # along the bottom to the corner
    cxr = (W - M - R) if sgn > 0 else (M + R)
    for x in np.linspace(sx, cxr, 160)[1:]:
        pts.append((x, by))
    # bottom corner arc
    ccx, ccy = cxr, H - M - R
    for a in np.linspace(np.pi / 2, 0 if sgn > 0 else np.pi, 20)[1:]:
        pts.append((ccx + R * np.cos(a), ccy + R * np.sin(a)))
    # up the side
    xside = W - M if sgn > 0 else M
    for y in np.linspace(H - M - R, M + R, 220)[1:]:
        pts.append((xside, y))
    # top corner arc
    ccx, ccy = (W - M - R if sgn > 0 else M + R), M + R
    for a in (np.linspace(0, -np.pi / 2, 20)[1:] if sgn > 0 else np.linspace(np.pi, 1.5 * np.pi, 20)[1:]):
        pts.append((ccx + R * np.cos(a), ccy + R * np.sin(a)))
    # along the top toward the logo, then curl up into the emblem
    lx = W / 2 + sgn * 70
    for x in np.linspace(ccx, lx + sgn * 120, 160)[1:]:
        pts.append((x, M))
    for t in np.linspace(0, 1, 30)[1:]:
        pts.append((lx + sgn * 120 * (1 - t), M + (LOGO_TOP + 58 - M) * t ** 1.5))
    return np.array(pts, np.float32)


def draw_poly(pts, width, mask):
    p = (pts * Z).astype(np.int32).reshape(-1, 1, 2)
    cv2.polylines(mask, [p], False, 1.0, int(width * Z), cv2.LINE_AA)


def path_color(n, sgn, near_end_hot=True):
    t = np.linspace(0, 1, n)[:, None]
    base = CY if sgn < 0 else OR
    other = OR if sgn < 0 else CY
    col = base * (1 - 0.15 * t) + other * 0.15 * t
    if near_end_hot:
        hot = np.clip((t - 0.9) / 0.1, 0, 1)
        col = col * (1 - hot) + HOT * hot
    return col


EMIT = {"core": np.zeros((h2, w2, 3), np.float32), "soft": np.zeros((h2, w2, 3), np.float32)}


def render_path(pts, sgn, width, k, layer):
    """Accumulate a colour-varying polyline into an emission buffer (blurred once at the end)."""
    n = len(pts)
    cols = path_color(n, sgn)
    p = (pts * Z).astype(np.int32)
    buf = EMIT[layer]
    for i in range(n - 1):
        c = tuple(float(v) * k for v in cols[i])
        cv2.line(buf, tuple(p[i]), tuple(p[i + 1]), c, int(width * Z), cv2.LINE_AA)


def strands(base, sgn, count, seed):
    rng = np.random.default_rng(seed)
    d = np.gradient(base, axis=0); nrm = np.stack([-d[:, 1], d[:, 0]], 1)
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-6
    s = np.linspace(0, 1, len(base))
    env = np.sin(np.pi * np.clip(s * 1.05, 0, 1)) ** 0.7     # free in the middle, tied at both ends
    out = []
    for j in range(count):
        amp = rng.uniform(5, 13)
        f1, f2 = rng.uniform(3, 7), rng.uniform(9, 16)
        ph1, ph2 = rng.uniform(0, 6.28, 2)
        off = (amp * np.sin(2 * np.pi * f1 * s + ph1) + amp * 0.35 * np.sin(2 * np.pi * f2 * s + ph2)) * env
        side_shift = sgn * 0                                     # strands wander on both sides of the frame line
        out.append(base + nrm * off[:, None])
    return out


EMIT["arc"] = np.zeros((h2, w2, 3), np.float32)
ELEC = np.array([200, 235, 255], np.float32)      # electric white-blue


def bolt(p0, p1, rng, disp, depth=6):
    """Midpoint-displacement lightning between two points (slide px)."""
    pts = [np.array(p0, np.float32), np.array(p1, np.float32)]
    d = disp
    for _ in range(depth):
        new = [pts[0]]
        for a, b in zip(pts[:-1], pts[1:]):
            m = (a + b) / 2
            v = b - a; n = np.array([-v[1], v[0]]); n /= (np.linalg.norm(n) + 1e-6)
            new += [m + n * rng.uniform(-d, d), b]
        pts = new; d *= 0.55
    return np.array(pts, np.float32)


def draw_bolt(pts, col, width, rng, branch=0.25, depth=0):
    p = (pts * Z).astype(np.int32)
    for i in range(len(p) - 1):
        cv2.line(EMIT["arc"], tuple(p[i]), tuple(p[i + 1]), tuple(float(c) for c in col), max(1, int(width * Z)), cv2.LINE_AA)
    if depth < 2:
        for i in range(2, len(pts) - 2, 6):
            if rng.random() < branch:
                v = pts[i + 1] - pts[i - 1]; ang = np.arctan2(v[1], v[0]) + rng.choice([-1, 1]) * rng.uniform(0.4, 0.9)
                ln = rng.uniform(14, 34) / (depth + 1)
                end = pts[i] + ln * np.array([np.cos(ang), np.sin(ang)])
                draw_bolt(bolt(pts[i], end, rng, ln * 0.25, 4), col * 0.7, width * 0.6, rng, branch * 0.6, depth + 1)


def arcs_along(base, sgn, seed):
    rng = np.random.default_rng(seed)
    n = len(base)
    col = (CY if sgn < 0 else OR) * 0.35 + ELEC * 0.65
    # windows: controller exit, logo arrival, plus a few crackles along the frame
    wins = [(0.0, 0.10, 3), (0.90, 1.0, 3)] + [(c, c + 0.035, 2) for c in rng.uniform(0.15, 0.85, 4)]
    for a, b, k in wins:
        i0, i1 = int(a * (n - 1)), int(b * (n - 1))
        for _ in range(k):
            j0 = rng.integers(i0, max(i0 + 1, i1 - 4)); j1 = min(n - 1, j0 + rng.integers(6, max(7, i1 - j0 + 2)))
            seg_len = np.linalg.norm(base[j1] - base[j0])
            draw_bolt(bolt(base[j0], base[j1], rng, max(6, seg_len * 0.18)), col, 1.1, rng)


for sgn in (-1, 1):
    base = side_path(sgn)
    for j, st in enumerate(strands(base, sgn, 2, 11 + (sgn > 0))):
        render_path(st, sgn, 1.0, 0.5, "soft")
    render_path(base, sgn, 2.4, 1.0, "core")
    arcs_along(base, sgn, 40 + (sgn > 0))
arc_b = EMIT["arc"]
canvas = np.clip(canvas + cv2.GaussianBlur(arc_b, (0, 0), 14 * Z) * 1.1 + cv2.GaussianBlur(arc_b, (0, 0), 4 * Z) * 1.0, 0, 255)
am = np.clip(arc_b.max(2, keepdims=True) / 255, 0, 1)
canvas = canvas * (1 - am) + (arc_b * 0.4 + 255 * 0.6 * am) * 1.0
core_b, soft_b = EMIT["core"], EMIT["soft"]
glow = (cv2.GaussianBlur(core_b, (0, 0), 26 * Z) * 1.6 + cv2.GaussianBlur(core_b, (0, 0), 8 * Z) * 1.2
        + cv2.GaussianBlur(soft_b, (0, 0), 9 * Z) * 1.0)
canvas = np.clip(canvas + glow, 0, 255)
cm = np.clip(core_b.max(2, keepdims=True) / 255, 0, 1)
canvas = canvas * (1 - cm * 0.9) + (core_b * 0.55 + HOT * 0.45 * cm) * 0.9
sm = np.clip(soft_b.max(2, keepdims=True) / 255, 0, 1)
canvas = np.clip(canvas + soft_b * 0.8, 0, 255)

# ---------- controller on top of the rays (rays emerge from behind it) ----------
# controller halo
halo = np.zeros((h2, w2), np.float32); halo[cy0:cy0 + ch, cx0:cx0 + cw] = ca
lr = np.clip((np.arange(w2) - cx0) / cw, 0, 1)[None, :, None]
vfade = np.clip(1 - (np.arange(h2) - (cy0 + ch * 0.45)) / (ch * 0.35), 0, 1)[:, None, None]
add(halo, (CY * (1 - lr) + OR * lr) * vfade, 0.35, ((30, .9),))
region = canvas[cy0:cy0 + ch, cx0:cx0 + cw]
canvas[cy0:cy0 + ch, cx0:cx0 + cw] = cc * ca[..., None] + region * (1 - ca[..., None])

# tassyir glowing cyan, centred on the old pad position
tm = cv2.imread(TAS, cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255
TW = int((pad[2] - pad[0] - 14) * sc); TH = int(tm.shape[0] * TW / tm.shape[1])
tmr = cv2.resize(tm, (TW, TH), interpolation=cv2.INTER_AREA)
tcx = cx0 + int((pad[0] + pad[2]) / 2 * sc); tcy = cy0 + int((pad[1] + pad[3]) / 2 * sc)
tfull = np.zeros((h2, w2), np.float32); tfull[tcy - TH // 2:tcy - TH // 2 + TH, tcx - TW // 2:tcx - TW // 2 + TW] = tmr
add(tfull, CY, 1.0, ((10, .9), (3, .8)))
canvas = canvas * (1 - tfull[..., None]) + np.array([200, 245, 255], np.float32) * tfull[..., None]


# ---------- ecommanita logo lifted from the key poster + spark ----------
P = cv2.cvtColor(cv2.imread(POSTER), cv2.COLOR_BGR2RGB).astype(np.float32)


def lift(x0, y0, x1, y1, feather=0.1, black=10):
    c = np.clip((P[y0:y1, x0:x1] - black) / (255 - black), 0, 1) * 255
    h, w = c.shape[:2]
    yy = np.linspace(0, 1, h)[:, None]; xx = np.linspace(0, 1, w)[None, :]
    v = np.clip(np.minimum(np.minimum(yy, 1 - yy), np.minimum(xx, 1 - xx)) / feather, 0, 1)
    return c * (v * v * (3 - 2 * v))[..., None]


def screen(patch, cx, top, height):
    global canvas
    s_ = height * Z / patch.shape[0]
    p = cv2.resize(patch, (int(patch.shape[1] * s_), int(patch.shape[0] * s_)), interpolation=cv2.INTER_CUBIC)
    x0 = int(cx * Z - p.shape[1] / 2); y0 = int(top * Z)
    reg = canvas[y0:y0 + p.shape[0], x0:x0 + p.shape[1]]
    canvas[y0:y0 + p.shape[0], x0:x0 + p.shape[1]] = 255 - (255 - reg) * (255 - p) / 255
    return p.shape[1] / Z, p.shape[0] / Z


emb = lift(462, 146, 630, 262, 0.10)
wm = lift(322, 252, 762, 310, 0.06, black=20)
core = (wm.max(2) > 175).astype(np.uint8)
halo_w = cv2.GaussianBlur(cv2.dilate(core, np.ones((5, 5), np.uint8)).astype(np.float32), (0, 0), 3)
wm = wm * np.clip(halo_w * 1.4, 0, 1)[..., None]
EH = 96
ew, eh = screen(emb, W / 2, LOGO_TOP, EH)
# spark: where the two rays meet, inside the emblem centre
SPX, SPY = W / 2, LOGO_TOP + EH * 0.62
spark = np.zeros((h2, w2), np.float32)
cv2.circle(spark, (int(SPX * Z), int(SPY * Z)), int(5 * Z), 1.0, -1, cv2.LINE_AA)
add(spark, HOT, 3.0, ((50, .7), (16, 1.0), (4, 1.2)))
# electric discharge: short radial bolts + particles around the spark
rng = np.random.default_rng(77)
EMIT["arc"][:] = 0
for k in range(9):
    ang = rng.uniform(0, 2 * np.pi); ln = rng.uniform(26, 62)
    end = (SPX + ln * np.cos(ang), SPY + ln * np.sin(ang) * 0.7)
    draw_bolt(bolt((SPX, SPY), end, rng, ln * 0.22, 5), ELEC, 1.0, rng, 0.35)
arc_b = EMIT["arc"]
canvas = np.clip(canvas + cv2.GaussianBlur(arc_b, (0, 0), 10 * Z) * 1.2 + cv2.GaussianBlur(arc_b, (0, 0), 3 * Z) * 1.0, 0, 255)
am = np.clip(arc_b.max(2, keepdims=True) / 255, 0, 1)
canvas = canvas * (1 - am) + 255 * am
pt = np.zeros((h2, w2), np.float32)
for k in range(26):
    ang = rng.uniform(0, 2 * np.pi); rr = rng.uniform(30, 110)
    x = SPX + rr * np.cos(ang); y = SPY + rr * np.sin(ang) * 0.6
    cv2.circle(pt, (int(x * Z), int(y * Z)), int(rng.uniform(0.8, 2.0) * Z), float(rng.uniform(0.5, 1.0)), -1, cv2.LINE_AA)
add(pt, HOT, 1.0, ((6, .8), (1.5, 1.0)))
# spark at the controller emission point too
sp2 = np.zeros((h2, w2), np.float32)
cv2.circle(sp2, (int(EX * Z), int(EY * Z)), int(4 * Z), 1.0, -1, cv2.LINE_AA)
add(sp2, ELEC, 1.6, ((24, .7), (8, .9), (2, 1.0)))
screen(wm, W / 2, LOGO_TOP + EH - 6, 50)

Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8)).resize((W, H), Image.LANCZOS).save(OUT)
print(OUT, "content area: y", LOGO_TOP + EH + 60, "->", H - CTRL_H - 40)
