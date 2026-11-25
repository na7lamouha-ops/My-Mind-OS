"""«الشرارة الأولى»: a blue tracer (the first bullet, drawn as light, never a weapon) streaks in from the blue side,
strikes the centre, and the flash opens like two doors on  ecommanita × tassyir.  The × is born at the impact point.
Then a spark crackles between the two logos, the lock-up rises, and a bolt drops from the × onto the real controller,
which comes up from below and lights at the touchpad.
Logos and controller are lifted from assets/ (poster emblem + wordmark, tassyir mask, key visual + controller mask), never redrawn.
Optional AI plates (fx/bullet.png, fx/explosion.png, made by gen_fx_gemini.py: light only, no text) replace the procedural
tracer head and impact flash when present.
Usage: motion_first_spark.py OUT_DIR  -> first-spark.mp4 (composite) + layer-bg / layer-spark / layer-logos / layer-manette
       (.mp4, on black, for screen/add blending) + layer-logos-matte / layer-manette-matte (alpha) + first-spark-poster.png"""
import os
import sys
import subprocess
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
KIT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTER = KIT + "/assets/key-poster-gpt.png"
KEY16 = KIT + "/assets/course-logo-key.png"
KMASK = KIT + "/assets/ctrl-key-mask.png"
FX = KIT + "/fx"
TAS = KIT + "/assets/tassyir-logo-mask.png"
FONTS = KIT + "/fonts"
W, H, FPS, DUR = 1920, 1080, 30, 7.5
NF = int(FPS * DUR)
CY = np.array([40, 215, 255], np.float32)      # RGB
OR = np.array([255, 120, 20], np.float32)
HOT = np.array([255, 240, 215], np.float32)
ELEC = np.array([200, 235, 255], np.float32)
CX, CYY = W / 2, H / 2 + 10                    # impact point = where the × is born

# timeline (seconds)
T_FIRE, T_HIT = 0.35, 1.25                     # tracer flight
T_OPEN0, T_OPEN1 = 1.30, 2.30                  # doors open
X_IN = 1.45                                    # × appears
T_ARC0, T_ARC1 = 2.75, 3.60                    # spark crackles between the two logos
T_RISE0, T_RISE1 = 3.35, 4.35                  # lock-up rises to make room for the controller
T_M0, T_M1 = 3.55, 4.45                        # controller comes up from below
T_DROP0, T_LAND = 4.05, 4.45                   # bolt drops from the × onto the touchpad


def ease_in(t): return t ** 2.2
def ease_out(t): return 1 - (1 - t) ** 3
def ease_io(t): return t * t * (3 - 2 * t)
def clip01(x): return float(np.clip(x, 0, 1))


def blur(img, r): return cv2.GaussianBlur(img, (0, 0), r)


# ---------- background: deep black + the blue/orange side curtains of the master ----------
xs = (np.arange(W) + .5) / W
side_b = np.exp(-0.5 * (xs / 0.14) ** 2)[None, :, None] * CY
side_o = np.exp(-0.5 * ((1 - xs) / 0.14) ** 2)[None, :, None] * OR
GRAIN = np.random.default_rng(5).normal(0, 1.1, (H, W, 3)).astype(np.float32)


def background(t):
    breathe = 0.06 + 0.015 * np.sin(2 * np.pi * t / 2.2)          # curtains breathe (move 5)
    lit = 1 + 1.4 * clip01((t - T_HIT) / 0.4) * (1 - 0.6 * clip01((t - T_HIT - 0.4) / 1.5))
    return np.clip(5 + (side_b + side_o) * breathe * lit + GRAIN, 0, 255)


# ---------- logos (lifted, as master_slide.py does) ----------
P = cv2.cvtColor(cv2.imread(POSTER), cv2.COLOR_BGR2RGB).astype(np.float32)


def lift(x0, y0, x1, y1, feather=0.1, black=10):
    c = np.clip((P[y0:y1, x0:x1] - black) / (255 - black), 0, 1) * 255
    h, w = c.shape[:2]
    yy = np.linspace(0, 1, h)[:, None]; xx = np.linspace(0, 1, w)[None, :]
    v = np.clip(np.minimum(np.minimum(yy, 1 - yy), np.minimum(xx, 1 - xx)) / feather, 0, 1)
    return c * (v * v * (3 - 2 * v))[..., None]


emb = lift(462, 146, 630, 262, 0.10)
wm = lift(322, 252, 762, 310, 0.06, black=20)
core = (wm.max(2) > 175).astype(np.uint8)
wm = wm * np.clip(blur(cv2.dilate(core, np.ones((5, 5), np.uint8)).astype(np.float32), 3) * 1.4, 0, 1)[..., None]

LOGO = np.zeros((H, W, 3), np.float32)         # emissive logo layer (screen-blended on black)


def place(patch, cx, top, height):
    s = height / patch.shape[0]
    p = cv2.resize(patch, (int(patch.shape[1] * s), int(patch.shape[0] * s)), interpolation=cv2.INTER_CUBIC)
    x0, y0 = int(cx - p.shape[1] / 2), int(top)
    reg = LOGO[y0:y0 + p.shape[0], x0:x0 + p.shape[1]]
    LOGO[y0:y0 + p.shape[0], x0:x0 + p.shape[1]] = 255 - (255 - reg) * (255 - p) / 255
    return p.shape[1]


EC_X, TS_X = 560, 1385                         # ecommanita on the blue side, tassyir on the orange side
EH = 150
place(emb, EC_X, CYY - 150, EH)
wm_w = place(wm, EC_X, CYY - 150 + EH - 10, 78)

tm = cv2.imread(TAS, cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255
TW = 430; TH = int(tm.shape[0] * TW / tm.shape[1])
tmr = cv2.resize(tm, (TW, TH), interpolation=cv2.INTER_AREA)
tfull = np.zeros((H, W), np.float32)
ty0 = int(CYY - TH / 2 + 22); tx0 = int(TS_X - TW / 2)
tfull[ty0:ty0 + TH, tx0:tx0 + TW] = tmr
tglow = (blur(tfull, 18) * 0.8 + blur(tfull, 5) * 0.8)[..., None] * (CY * 0.55 + OR * 0.45)   # sits on the orange side
LOGO = np.clip(LOGO + tglow, 0, 255)
LOGO = LOGO * (1 - tfull[..., None]) + np.array([255, 246, 236], np.float32) * tfull[..., None]

# the × (Archivo, typed by the script)
xim = Image.new("L", (W, H), 0)
f = ImageFont.truetype(f"{FONTS}/Archivo-VF.ttf", 120); f.set_variation_by_axes([300, 100])
d = ImageDraw.Draw(xim); l, tp, r, b = d.textbbox((0, 0), "×", font=f)
d.text((CX - (r - l) / 2 - l, CYY - (b - tp) / 2 - tp), "×", font=f, fill=255)
XM = np.array(xim, np.float32) / 255

LOGO_A = np.clip(LOGO.max(2) / 255 * 1.6, 0, 1)
EC_R = EC_X + wm_w / 2 - 10                    # right end of the ecommanita wordmark
TS_L = tx0 + 10                                # left end of the tassyir mark


def lockup(t):
    """Scale + lift of the logo lock-up about the impact point as the controller arrives."""
    o = ease_io(clip01((t - T_RISE0) / (T_RISE1 - T_RISE0)))
    return 1 - 0.2 * o, -250 * o


def lk(t, x, y):
    s_, dy = lockup(t)
    return CX + s_ * (x - CX), CYY + s_ * (y - CYY) + dy


def lk_warp(img, t):
    s_, dy = lockup(t)
    if s_ == 1 and dy == 0:
        return img
    M_ = np.float32([[s_, 0, CX * (1 - s_)], [0, s_, CYY * (1 - s_) + dy]])
    return cv2.warpAffine(img, M_, (W, H), flags=cv2.INTER_LINEAR)


# ---------- controller (segmented from the key visual, as master_slide.py does; tassyir pad kept as is) ----------
key = cv2.cvtColor(cv2.imread(KEY16, cv2.IMREAD_COLOR), cv2.COLOR_BGR2RGB).astype(np.float32)
km = cv2.imread(KMASK, cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255
ys_, xs_ = np.where(km > 0.5)
kx0, kx1, ky0, ky1 = xs_.min(), xs_.max() + 1, ys_.min(), ys_.max() + 1
mc = key[ky0:ky1, kx0:kx1].copy()
ma = cv2.GaussianBlur(km[ky0:ky1, kx0:kx1], (0, 0), 1.0) * np.clip((612 - np.arange(ky0, ky1)) / 14, 0, 1)[:, None]
MH = 430
msc = MH / mc.shape[0]
mw, mh = int(mc.shape[1] * msc), int(mc.shape[0] * msc)
mc = cv2.resize(mc, (mw, mh), interpolation=cv2.INTER_AREA); ma = cv2.resize(ma, (mw, mh), interpolation=cv2.INTER_AREA)
MX0, MY0 = int(CX - mw / 2), H - 30 - mh       # resting place, bottom centre
EX, EY = CX, MY0 + (292 - ky0) * msc           # emission point: top of the touchpad (the poster's stream start)
MHALO_SRC = np.zeros((H, W), np.float32); MHALO_SRC[MY0:MY0 + mh, MX0:MX0 + mw] = ma
LRX = np.clip((np.arange(W) - MX0) / mw, 0, 1)[:, None]
MHALO = cv2.GaussianBlur(MHALO_SRC, (0, 0), 40)[..., None] * (CY * (1 - LRX) + OR * LRX)[None]


def manette_layer(t):
    """RGB (premultiplied) + alpha of the controller rising into place, plus its two-colour halo."""
    o = ease_out(clip01((t - T_M0) / (T_M1 - T_M0)))
    rgb = np.zeros((H, W, 3), np.float32); a = np.zeros((H, W), np.float32)
    if o <= 0:
        return rgb, a, rgb
    y0 = MY0 + int(160 * (1 - o))
    y1 = min(H, y0 + mh); hh = y1 - y0
    a[y0:y1, MX0:MX0 + mw] = ma[:hh] * o
    rgb[y0:y1, MX0:MX0 + mw] = mc[:hh] * a[y0:y1, MX0:MX0 + mw, None]
    land = np.exp(-max(0, t - T_LAND) / 0.4) if t >= T_LAND else 0
    breathe = 0.55 + 0.12 * np.sin(2 * np.pi * max(0, t - T_M1) / 1.8)
    sh = y0 - MY0                              # shift down without wrapping round to the top
    halo = np.zeros_like(MHALO); halo[sh:] = MHALO[:H - sh]
    halo *= o * (breathe + 1.2 * land)
    return rgb, a, halo


# ---------- optional AI plates (light only, on black) ----------
def plate(name):
    f = f"{FX}/{name}.png"
    return cv2.cvtColor(cv2.imread(f), cv2.COLOR_BGR2RGB).astype(np.float32) if os.path.exists(f) else None


BULLET, EXPLO = plate("bullet"), plate("explosion")


def add_plate(out, pl, cx, cy, width, k=1.0):
    s_ = width / pl.shape[1]
    p = cv2.resize(pl, (max(1, int(pl.shape[1] * s_)), max(1, int(pl.shape[0] * s_))), interpolation=cv2.INTER_AREA)
    x0, y0 = int(cx - p.shape[1] / 2), int(cy - p.shape[0] / 2)
    sx0, sy0 = max(0, -x0), max(0, -y0)
    dx0, dy0 = max(0, x0), max(0, y0)
    dx1, dy1 = min(W, x0 + p.shape[1]), min(H, y0 + p.shape[0])
    if dx1 > dx0 and dy1 > dy0:
        out[dy0:dy1, dx0:dx1] += p[sy0:sy0 + dy1 - dy0, sx0:sx0 + dx1 - dx0] * k


# ---------- lightning (same midpoint displacement as master_slide.py) ----------
def bolt(p0, p1, rng, disp, depth=6):
    pts = [np.array(p0, np.float32), np.array(p1, np.float32)]
    for _ in range(depth):
        new = [pts[0]]
        for a, b_ in zip(pts[:-1], pts[1:]):
            m = (a + b_) / 2; v = b_ - a; n = np.array([-v[1], v[0]]); n /= np.linalg.norm(n) + 1e-6
            new += [m + n * rng.uniform(-disp, disp), b_]
        pts = new; disp *= 0.55
    return np.array(pts, np.int32)


def tracer_x(t):
    return -80 + (CX + 80) * ease_in(clip01((t - T_FIRE) / (T_HIT - T_FIRE)))


def spark_layer(t, fi):
    """Emissive: tracer head + trail, impact flash, shock ring, radial bolts, × ignition, sparks. Additive on black."""
    rng = np.random.default_rng(1000 + fi)
    core = np.zeros((H, W), np.float32)
    arc = np.zeros((H, W), np.float32)
    trail = np.zeros((H, W), np.float32)
    if T_FIRE <= t < T_HIT + 0.02:
        x = tracer_x(t); tail = max(90, (x + 80) * 0.75)
        # trail: tapered cyan streak, a touch of wobble
        for k in range(24):
            a = k / 24
            x0 = x - tail * a; x1 = x - tail * (a + 1 / 24)
            cv2.line(trail, (int(x0), int(CYY)), (int(x1), int(CYY + 1.5 * np.sin(a * 9))), float((1 - a) ** 1.6), max(1, int(16 * (1 - a))), cv2.LINE_AA)
        if BULLET is None:
            cv2.ellipse(core, (int(x), int(CYY)), (26, 10), 0, 0, 360, 1.0, -1, cv2.LINE_AA)
        for _ in range(2):                     # crackle along the trail
            xa = x - rng.uniform(20, tail * 0.8)
            cv2.polylines(arc, [bolt((xa, CYY), (xa - rng.uniform(40, 90), CYY + rng.uniform(-14, 14)), rng, 10).reshape(-1, 1, 2)], False, 0.8, 1, cv2.LINE_AA)
    out = blur(trail, 14)[..., None] * CY * 2.8 + blur(trail, 2.5)[..., None] * (CY * 0.5 + ELEC * 0.5) * 1.4
    out += (blur(core, 30) * 2.5 + blur(core, 8) * 1.6)[..., None] * CY + core[..., None] * 255
    if BULLET is not None and T_FIRE <= t < T_HIT + 0.02:
        add_plate(out, BULLET, tracer_x(t) - 90, CYY, 260)

    th = t - T_HIT
    if th >= 0:
        flash = np.exp(-th / 0.12)
        if EXPLO is not None and th < 1.2:
            add_plate(out, EXPLO, CX, CYY, 500 + 1500 * ease_out(clip01(th / 1.2)), np.exp(-th / 0.35) * 1.3)
        g = np.zeros((H, W), np.float32); cv2.circle(g, (int(CX), int(CYY)), 10, 1.0, -1, cv2.LINE_AA)
        out += (blur(g, 160) * 40 + blur(g, 45) * 14 + blur(g, 12) * 4)[..., None] * HOT * flash
        out += np.full((H, W, 3), 255, np.float32) * 0.35 * np.exp(-th / 0.05)          # one-frame white punch
        if th < 0.7:                                                                     # shock ring
            rr = 40 + 900 * ease_out(th / 0.7)
            ring = np.zeros((H, W), np.float32)
            cv2.ellipse(ring, (int(CX), int(CYY)), (int(rr), int(rr * 0.42)), 0, 0, 360, 1.0, 3, cv2.LINE_AA)
            out += blur(ring, 6)[..., None] * (CY * 0.6 + ELEC * 0.4) * 3.0 * (1 - th / 0.7)
        if th < 0.6:                                                                     # radial bolts
            for _ in range(int(12 * (1 - th / 0.6)) + 1):
                ang = rng.uniform(0, 2 * np.pi); ln = rng.uniform(80, 260) * (0.6 + th)
                end = (CX + ln * np.cos(ang), CYY + ln * np.sin(ang) * 0.5)
                cv2.polylines(arc, [bolt((CX, CYY), end, rng, ln * 0.2, 5).reshape(-1, 1, 2)], False, 1.0, 2, cv2.LINE_AA)
        # sparks flying out, slowing down
        srng = np.random.default_rng(7)
        sp = np.zeros((H, W), np.float32)
        for k in range(60):
            ang = srng.uniform(0, 2 * np.pi); v = srng.uniform(250, 900); life = srng.uniform(0.6, 1.6)
            if th < life:
                dist = v * (1 - np.exp(-th * 2.5)) / 2.5
                cv2.circle(sp, (int(CX + dist * np.cos(ang)), int(CYY + dist * np.sin(ang) * 0.6 + 60 * th * th)), 2, float(1 - th / life), -1, cv2.LINE_AA)
        out += (blur(sp, 5) * 3 + sp)[..., None] * HOT
        # the doors' edges: two vertical blades of light running outward (blue left, orange right)
        o = ease_out(clip01((t - T_OPEN0) / (T_OPEN1 - T_OPEN0)))
        if 0 < o < 1:
            for sgn, col in ((-1, CY), (1, OR)):
                bx = int(CX + sgn * o * W * 0.55)
                blade = np.zeros((H, W), np.float32)
                cv2.line(blade, (bx, int(CYY - 260)), (bx, int(CYY + 260)), 1.0, 3, cv2.LINE_AA)
                out += (blur(blade, 22) * 2.2 + blur(blade, 4) * 1.4)[..., None] * col * (1 - o) ** 0.5
    out += (blur(arc, 8) * 1.8 + blur(arc, 2) * 1.2)[..., None] * ELEC + arc[..., None] * 255
    # × ignition: white-hot, cools to a warm white with a blue/orange split glow
    xa = clip01((t - X_IN) / 0.35)
    if xa > 0:
        arc_env = clip01((t - T_ARC0) / 0.15) * (1 - clip01((t - T_ARC1) / 0.3))
        heat = np.exp(-(t - X_IN) / 0.5) + 0.8 * arc_env + (0.9 * np.exp(-(t - T_LAND) / 0.3) if t >= T_LAND else 0)
        xm = lk_warp(XM, t)
        xc, yc = lk(t, CX, CYY)
        lr = np.clip((np.arange(W) - (xc - 60)) / 120, 0, 1)[None, :, None]
        glow_col = CY * (1 - lr) + OR * lr
        out += (blur(xm, 14) * 1.6)[..., None] * glow_col * xa * (1 + heat)
        out += xm[..., None] * (HOT * (1 - min(1, heat)) + 255 * min(1, heat)) * xa
        # spark between the two logos: bolts ecommanita -> × -> tassyir, blue on the left, orange on the right
        if arc_env > 0:
            ab, ao = np.zeros((H, W), np.float32), np.zeros((H, W), np.float32)
            for buf, (xa_, xb_) in ((ab, (EC_R, CX - 45)), (ao, (CX + 45, TS_L))):
                for _ in range(2):
                    p0 = lk(t, xa_, CYY + rng.uniform(-8, 8)); p1 = lk(t, xb_, CYY + rng.uniform(-8, 8))
                    cv2.polylines(buf, [bolt(p0, p1, rng, 22, 6).reshape(-1, 1, 2)], False, 1.0, 3, cv2.LINE_AA)
            for buf, col in ((ab, CY), (ao, OR)):
                out += (blur(buf, 12) * 2.2 + blur(buf, 3) * 1.4)[..., None] * (col * 0.5 + ELEC * 0.5) * arc_env + buf[..., None] * 255 * arc_env
        # bolt dropping from the × onto the touchpad, then living wisps between them
        if t >= T_DROP0:
            top = lk(t, CX, CYY + 55)
            p = ease_in(clip01((t - T_DROP0) / (T_LAND - T_DROP0)))
            end = (top[0] + (EX - top[0]) * p, top[1] + (EY - top[1]) * p)
            db = np.zeros((H, W), np.float32)
            if p < 1:
                cv2.polylines(db, [bolt(top, end, rng, 26, 6).reshape(-1, 1, 2)], False, 1.0, 3, cv2.LINE_AA)
            else:
                live = 0.6 + 0.4 * np.sin(2 * np.pi * t * 1.3)
                wrng = np.random.default_rng(300 + fi // 3)          # wisps re-shape every 3 frames: a calm flicker
                for _ in range(3):
                    cv2.polylines(db, [bolt(top, (EX, EY), wrng, 30, 6).reshape(-1, 1, 2)], False, 0.8 * live, 2, cv2.LINE_AA)
            out += (blur(db, 14) * 2.0 + blur(db, 3) * 1.2)[..., None] * ELEC + db[..., None] * 255
        if t >= T_LAND:                                               # touchpad lights: the controller's own spark
            tl = t - T_LAND
            g = np.zeros((H, W), np.float32); cv2.circle(g, (int(EX), int(EY)), 6, 1.0, -1, cv2.LINE_AA)
            k = 0.5 + 2.5 * np.exp(-tl / 0.25)
            out += (blur(g, 60) * 18 + blur(g, 16) * 5 + blur(g, 4) * 1.5)[..., None] * (CY * 0.4 + HOT * 0.6) * k
            if tl < 0.5:
                arc = np.zeros((H, W), np.float32)
                for _ in range(int(8 * (1 - tl / 0.5)) + 1):
                    ang = rng.uniform(np.pi, 2 * np.pi); ln = rng.uniform(40, 140)
                    e = (EX + ln * np.cos(ang), EY + ln * np.sin(ang) * 0.6)
                    cv2.polylines(arc, [bolt((EX, EY), e, rng, ln * 0.25, 5).reshape(-1, 1, 2)], False, 1.0, 2, cv2.LINE_AA)
                out += (blur(arc, 8) * 1.8 + blur(arc, 2) * 1.2)[..., None] * ELEC + arc[..., None] * 255
    return np.clip(out, 0, 255)


def logo_mask(t):
    """Doors: an aperture opening from the impact point outward; logos slide 70px apart as it opens."""
    o = ease_out(clip01((t - T_OPEN0) / (T_OPEN1 - T_OPEN0)))
    if o <= 0:
        return None, 0
    half = o * W * 0.55
    xx = np.abs(np.arange(W) - CX)[None, :]
    ap = np.clip((half - xx) / 40, 0, 1) * np.ones((H, 1), np.float32)
    return ap, o


def logos_layer(t):
    ap, o = logo_mask(t)
    if ap is None:
        return np.zeros((H, W, 3), np.float32), np.zeros((H, W), np.float32)
    shift = int(70 * (1 - o))                  # start packed toward the centre, settle outward
    M_ = np.float32([[1, 0, 0], [0, 1, 0]])
    left = LOGO.copy(); left[:, int(CX):] = 0
    right = LOGO.copy(); right[:, :int(CX)] = 0
    M_[0, 2] = shift; L = cv2.warpAffine(left, M_, (W, H))
    M_[0, 2] = -shift; R = cv2.warpAffine(right, M_, (W, H))
    lay = np.maximum(L, R) * ap[..., None]
    pulse = 1 + 0.06 * np.sin(2 * np.pi * max(0, t - T_OPEN1) / 1.6)                  # breathing after settle
    lay = lk_warp(np.clip(lay * pulse, 0, 255), t)
    return lay, np.clip(lay.max(2) / 255 * 1.6, 0, 1)


def writer(name, gray=False):
    return subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                             "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "16",
                             "-pix_fmt", "yuv420p", "-movflags", "+faststart", f"{OUT}/{name}.mp4"], stdin=subprocess.PIPE)


streams = {k: writer(k) for k in ("first-spark", "layer-bg", "layer-spark", "layer-logos", "layer-logos-matte",
                                  "layer-manette", "layer-manette-matte")}
for fi in range(NF):
    t = fi / FPS
    bg = background(t)
    sp = spark_layer(t, fi)
    lg, la = logos_layer(t)
    mrgb, ma_, mhalo = manette_layer(t)
    bg = np.clip(bg + mhalo, 0, 255)
    bgm = bg * (1 - ma_[..., None]) + mrgb                # controller is a solid object: normal over
    comp = 255 - (255 - bgm) * (255 - lg) / 255           # logos screen over
    comp = np.clip(comp + sp, 0, 255)                     # light is additive
    frames = {"first-spark": comp, "layer-bg": bg, "layer-spark": sp, "layer-logos": lg,
              "layer-logos-matte": np.repeat(la[..., None] * 255, 3, 2),
              "layer-manette": mrgb, "layer-manette-matte": np.repeat(ma_[..., None] * 255, 3, 2)}
    for k, fr in frames.items():
        streams[k].stdin.write(np.clip(fr, 0, 255).astype(np.uint8).tobytes())
    if fi in (int(0.8 * FPS), int(T_HIT * FPS) + 1, int(1.7 * FPS), int(3.1 * FPS), int(4.5 * FPS), NF - 1):
        Image.fromarray(comp.astype(np.uint8)).save(f"{OUT}/frame-{t:.2f}s.png")
for s in streams.values():
    s.stdin.close(); s.wait()
os.replace(f"{OUT}/frame-{(NF - 1) / FPS:.2f}s.png", f"{OUT}/first-spark-poster.png")
print(OUT, f"{NF} frames, {DUR}s @ {FPS}fps")
