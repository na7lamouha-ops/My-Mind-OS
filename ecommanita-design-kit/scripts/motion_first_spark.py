"""«الشرارة الأولى»: a blue tracer (the first bullet, drawn as light, never a weapon) streaks in from the blue side,
strikes the centre, and the flash opens like two doors on  ecommanita × tassyir.  The × is born at the impact point.
Logos are lifted from assets/ (poster emblem + wordmark, tassyir mask), never redrawn.
Usage: motion_first_spark.py OUT_DIR  -> first-spark.mp4 (composite) + layer-bg / layer-spark / layer-logos (.mp4, on black,
       for screen/add blending) + layer-logos-matte.mp4 (alpha) + first-spark-poster.png (last frame)"""
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
TAS = KIT + "/assets/tassyir-logo-mask.png"
FONTS = KIT + "/fonts"
W, H, FPS, DUR = 1920, 1080, 30, 4.5
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


def ease_in(t): return t ** 2.2
def ease_out(t): return 1 - (1 - t) ** 3
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
        cv2.ellipse(core, (int(x), int(CYY)), (26, 10), 0, 0, 360, 1.0, -1, cv2.LINE_AA)
        for _ in range(2):                     # crackle along the trail
            xa = x - rng.uniform(20, tail * 0.8)
            cv2.polylines(arc, [bolt((xa, CYY), (xa - rng.uniform(40, 90), CYY + rng.uniform(-14, 14)), rng, 10).reshape(-1, 1, 2)], False, 0.8, 1, cv2.LINE_AA)
    out = blur(trail, 14)[..., None] * CY * 2.8 + blur(trail, 2.5)[..., None] * (CY * 0.5 + ELEC * 0.5) * 1.4
    out += (blur(core, 30) * 2.5 + blur(core, 8) * 1.6)[..., None] * CY + core[..., None] * 255

    th = t - T_HIT
    if th >= 0:
        flash = np.exp(-th / 0.12)
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
        heat = np.exp(-(t - X_IN) / 0.5)
        lr = np.clip((np.arange(W) - (CX - 60)) / 120, 0, 1)[None, :, None]
        glow_col = CY * (1 - lr) + OR * lr
        out += (blur(XM, 14) * 1.6)[..., None] * glow_col * xa * (1 + heat)
        out += XM[..., None] * (HOT * (1 - heat) + 255 * heat) * xa
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
    lay = np.clip(lay * pulse, 0, 255)
    return lay, np.clip(lay.max(2) / 255 * 1.6, 0, 1)


def writer(name, gray=False):
    return subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                             "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "16",
                             "-pix_fmt", "yuv420p", "-movflags", "+faststart", f"{OUT}/{name}.mp4"], stdin=subprocess.PIPE)


streams = {k: writer(k) for k in ("first-spark", "layer-bg", "layer-spark", "layer-logos", "layer-logos-matte")}
for fi in range(NF):
    t = fi / FPS
    bg = background(t)
    sp = spark_layer(t, fi)
    lg, la = logos_layer(t)
    comp = 255 - (255 - bg) * (255 - lg) / 255            # logos screen over the background
    comp = np.clip(comp + sp, 0, 255)                     # light is additive
    frames = {"first-spark": comp, "layer-bg": bg, "layer-spark": sp, "layer-logos": lg,
              "layer-logos-matte": np.repeat(la[..., None] * 255, 3, 2)}
    for k, fr in frames.items():
        streams[k].stdin.write(np.clip(fr, 0, 255).astype(np.uint8).tobytes())
    if fi in (int(0.8 * FPS), int(T_HIT * FPS) + 1, int(1.7 * FPS), NF - 1):
        Image.fromarray(comp.astype(np.uint8)).save(f"{OUT}/frame-{t:.2f}s.png")
for s in streams.values():
    s.stdin.close(); s.wait()
os.replace(f"{OUT}/frame-{(NF - 1) / FPS:.2f}s.png", f"{OUT}/first-spark-poster.png")
print(OUT, f"{NF} frames, {DUR}s @ {FPS}fps")
