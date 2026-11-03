"""Opener «من الخلية للاندلاع» — 10 storyboard key frames (16:9, 1920x1080) built from the real assets.
run from repo root: python3 edprod/projects/2026-11-04-tamhid-opener/frames.py <al-khaliya-logo.(png|webp)>
"""
import os
import sys

sys.path.insert(0, "edprod/tools/lib")
from edprod_kit import *  # noqa

W2, H2 = 1920, 1080
CX, CY = 960, 500
OUT = "out/tamhid-opener/frames"
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(4)
yy, xx = np.mgrid[0:H2, 0:W2].astype(np.float32)
LAY = os.path.join(ASSETS, "layers")


def rgba(path, crop=True):
    im = Image.open(path).convert("RGBA")
    if crop:
        im = im.crop(im.getbbox())
    return np.asarray(im).astype(np.float32) / 255


MASTER = np.asarray(Image.open(os.path.join(LAY, "master-eclairs-16x9.png")).convert("RGB")).astype(np.float32) / 255
LOGO = rgba(os.path.join(LAY, "layer-logo-ecommanita.png"))
BULLET = rgba(os.path.join(ASSETS, "sprites", "bullet-ecommanita.png"))

# ---------------------------------------------------------------- al-KHALiYA layers (from the flat logo on black)
src = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float32) / 255
lum = src.max(-1)
alpha = np.clip((lum - 0.06) / 0.5, 0, 1)
unpremul = np.clip(src / np.maximum(lum[..., None], 1e-3) * np.clip(lum[..., None] / 0.75, 0, 1), 0, 1)
m = lum > 0.24
m[810:] = False
lab, _ = nd.label(m)
sizes = nd.sum(m, lab, range(1, lab.max() + 1))
order = np.argsort(-sizes) + 1
body, hanger = lab == order[0], lab == order[1]
filled = nd.binary_fill_holes(body | hanger | nd.binary_closing(body, iterations=8))
inner = nd.binary_erosion(filled, iterations=24)
ring = body & ~inner
shirt = body & inner
grow = lambda k: nd.binary_dilation(k, iterations=3)
KH = {}
for name, k in {"ring": grow(ring), "hanger": grow(hanger), "shirt_l": grow(shirt) & (np.arange(src.shape[1]) < 627)[None, :],
                "shirt_r": grow(shirt) & (np.arange(src.shape[1]) >= 627)[None, :]}.items():
    KH[name] = np.dstack([unpremul, alpha * k])
txt = np.zeros_like(lum, bool); txt[805:1030] = True
KH["text"] = np.dstack([unpremul, alpha * txt])
KS = 0.62           # logo scale on the 1080p frame
KOFF = (CX - 627 * KS, CY - 560 * KS)   # emblem centre (627, 480) -> frame centre-ish


def kh_layer(f, name, dx=0, dy=0, a=1.0, s=1.0):
    L = scaled(KH[name], KS * s)
    cx = KOFF[0] + (627 * KS) * (1 - s)
    cy = KOFF[1] + (560 * KS) * (1 - s)
    over(f, L, cx + dx, cy + dy, a)


def kh_full(f, a=1.0, s=1.0):
    for n in ("ring", "hanger", "shirt_l", "shirt_r", "text"):
        kh_layer(f, n, a=a, s=s)


HEX_C = (KOFF[0] + 627 * KS, KOFF[1] + 476 * KS)   # emblem centre on screen


# ---------------------------------------------------------------- honeycomb
def honeycomb(progress, colour_split=False, crack=0.0):
    """hex grid lines lit from the centre outward. progress 0..1. returns RGB light layer."""
    R = 46
    im = Image.new("L", (W2, H2), 0)
    d = ImageDraw.Draw(im)
    lit = []
    for row in range(-2, int(H2 / (R * 1.5)) + 3):
        for col in range(-2, int(W2 / (R * math.sqrt(3))) + 3):
            cx = col * R * math.sqrt(3) + (row % 2) * R * math.sqrt(3) / 2
            cy = row * R * 1.5
            dist = math.hypot(cx - HEX_C[0], cy - HEX_C[1]) / 1100
            if dist > progress:
                continue
            k = crack * (1 + dist * 2)
            ox = (cx - HEX_C[0]) * k * 0.25
            oy = (cy - HEX_C[1]) * k * 0.25
            pts = [(cx + ox + (R - 3) * math.cos(math.pi / 6 + i * math.pi / 3), cy + oy + (R - 3) * math.sin(math.pi / 6 + i * math.pi / 3)) for i in range(7)]
            b = int(255 * max(0.15, 1 - dist / max(progress, 1e-3)) * (1 - min(1, dist * 1.4)) )
            d.line(pts, fill=max(b, 30), width=2)
    a = np.asarray(im).astype(np.float32)[..., None] / 255
    a = a * (0.35 + 0.65 * blur_(a, 3) * 4).clip(0, 1)
    if colour_split:
        left = (xx < HEX_C[0])[..., None]
        col = np.where(left, np.array(BLUE, np.float32) / 255, np.array(ORANGE, np.float32) / 255)
    else:
        col = np.array([0.85, 0.66, 0.30], np.float32)
    return a * col


def blur_(a, s):
    return nd.gaussian_filter(a, (s, s, 0)) if a.ndim == 3 else nd.gaussian_filter(a, s)


def sparks(f, cx, cy, n=420, rmax=700, seed=1):
    """the teaser's closing burst: thin electric streaks, blue on the left, orange on the right."""
    r = np.random.default_rng(seed)
    im_b = Image.new("L", (W2, H2), 0)
    im_o = Image.new("L", (W2, H2), 0)
    for _ in range(n):
        a = r.uniform(0, 2 * math.pi)
        r0 = r.uniform(20, 160)
        r1 = r0 + r.uniform(60, rmax) * r.uniform(0.3, 1) ** 2
        x0, y0 = cx + r0 * math.cos(a), cy + r0 * math.sin(a)
        x1, y1 = cx + r1 * math.cos(a), cy + r1 * math.sin(a)
        tgt = im_b if math.cos(a) < 0 else im_o
        ImageDraw.Draw(tgt).line([(x0, y0), (x1, y1)], fill=int(r.uniform(120, 255)), width=int(r.choice([1, 1, 2, 3])))
    for im, col in ((im_b, BLUE), (im_o, ORANGE)):
        a = np.asarray(im).astype(np.float32)[..., None] / 255
        c = np.array(col, np.float32) / 255
        f += a * (c * 0.6 + 0.4) + blur_(a, 6) * c * 1.4 + blur_(a, 22) * c * 0.8
    glow(f, cx, cy, 120, (255, 255, 255), 1.6)
    glow(f, cx, cy, 380, (255, 210, 160), 0.35)


def vignette(f, k=0.55):
    v = np.clip(1 - k * (((xx - W2 / 2) / (W2 * 0.75)) ** 2 + ((yy - H2 / 2) / (H2 * 0.75)) ** 2), 0, 1)[..., None]
    return f * v


def grain(f, k=0.012):
    return f + rng.standard_normal((H2, W2, 1)).astype(np.float32) * k


def tag(f, n, t, label):
    s = text_rgba(f"{n:02d}  ·  {t}  ·  {label}", font("Bold", 30), (200, 205, 215))
    over(f, s, W2 - s.shape[1] - 40, H2 - 70, 0.85)


def bullet_at(f, x, y, k=0.42, spin=0.0, halo=1.0):
    b = scaled(BULLET, k)
    if spin:  # half-turn illusion: squash vertically
        b = np.asarray(Image.fromarray((b * 255).astype(np.uint8), "RGBA").resize((b.shape[1], max(2, int(b.shape[0] * (0.55 + 0.45 * abs(math.cos(spin)))))), Image.BICUBIC)).astype(np.float32) / 255
    bh, bw = b.shape[:2]
    glow(f, x + bw * 0.3, y, 130 * halo, ORANGE, 0.22 * halo)
    glow(f, x - bw * 0.3, y, 130 * halo, BLUE, 0.22 * halo)
    over(f, b, x - bw / 2, y - bh / 2)
    return bw


# ---------------------------------------------------------------- perimeter reveal of the master frame
logo_box = (yy < 175) & (xx > 760) & (xx < 1160)
pad_box = (yy > 880) & (xx > 780) & (xx < 1140)
ang = np.arctan2(xx - W2 / 2, -(yy - H2 / 2))          # 0 at top centre, ±pi at bottom centre
PERIM = np.abs(ang) / math.pi                          # 0 top -> 1 bottom, both sides
BORDER = MASTER.copy()
BORDER[logo_box | pad_box] = 0.0
BORDER *= np.clip((BORDER.max(-1, keepdims=True) - 0.06) * 6, 0, 1)


def frame_reveal(p):
    m = np.clip((p - PERIM) * 25, 0, 1)[..., None]
    base = np.zeros_like(MASTER) + MASTER[400:600, 400:600].mean((0, 1)) * 0.0
    return BORDER * m + base * (1 - m)


# ================================================================ frames ========
def F(n, t, label, f):
    f = grain(vignette(f))
    tag(f, n, t, label)
    Image.fromarray((np.clip(f, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, f"frame_{n:02d}.png"))
    print("frame", n)


black = lambda: np.zeros((H2, W2, 3), np.float32)

# 01 black + heartbeat
f = black()
glow(f, CX, CY, 300, (60, 20, 20), 0.10)
F(1, "0.0", "كحل · نبضة قلب", f)

# 02 al-KHALiYA assembling (mid-way)
f = black()
kh_layer(f, "ring", a=0.85, s=1.0)
kh_layer(f, "hanger", dy=-140, a=0.55)
kh_layer(f, "shirt_l", dx=-170, dy=40, a=0.6)
kh_layer(f, "shirt_r", dx=170, dy=40, a=0.6)
kh_layer(f, "text", dy=60, a=0.25)
glow(f, *HEX_C, 260, (255, 200, 110), 0.10)
F(2, "0.5 – 1.7", "الخلية تتركّب قطعة بقطعة · تك… تك…", f)

# 03 honeycomb lights up from the centre
f = black() + honeycomb(0.55) * 0.55
kh_full(f)
glow(f, *HEX_C, 300, (255, 200, 110), 0.10)
F(3, "1.7 – 2.5", "الخلايا تشعل وحدة بوحدة · طنين النحل", f)

# 04 the bullet enters from the left
f = black() + honeycomb(1.0) * 0.45
kh_full(f)
bullet_at(f, 470, HEX_C[1], spin=0.6)
for k in range(1, 6):                                    # faint light trail
    glow(f, 470 - 180 - k * 60, HEX_C[1], 22 - k * 3, (255, 220, 170), 0.10)
F(4, "2.5 – 3.7", "الرصاصة تدخل من اليسار بالشوية · بلا طلقة", f)

# 05 the touch: gold turns blue / orange
f = black() + honeycomb(1.0, colour_split=True) * 0.65
kh_full(f)
bw = scaled(BULLET, 0.42).shape[1]
bullet_at(f, HEX_C[0] - bw / 2 + 20, HEX_C[1], halo=1.4)
glow(f, *HEX_C, 40, (255, 255, 255), 1.2)
F(5, "3.7 – 3.9", "اللمسة · فريم يتجمّد · سكوت تام", f)

# 06 eruption: the cell opens like a chrysalis + teaser sparks
f = black() + honeycomb(1.0, colour_split=True, crack=0.5) * 0.7
kh_layer(f, "ring", s=1.25, a=0.45)
kh_layer(f, "hanger", dy=-120, a=0.35)
kh_layer(f, "shirt_l", dx=-150, dy=30, a=0.35)
kh_layer(f, "shirt_r", dx=150, dy=30, a=0.35)
sparks(f, *HEX_C)
F(6, "3.9 – 4.6", "الاندلاع · الخلية تتفتح · شرارات التيزر", f)

# 07 ecommanita logo born from the light
f = black() + honeycomb(1.0, colour_split=True, crack=1.0) * 0.25
glow(f, *HEX_C, 420, (255, 200, 150), 0.35)
lg = scaled(LOGO, 900 / LOGO.shape[1])
over(f, lg, CX - lg.shape[1] / 2, HEX_C[1] - lg.shape[0] / 2)
F(7, "4.6 – 5.4", "لوغو ecommanita يطلع من الضو · ووش", f)

# 08 logo travels up + beams draw the frame
f = frame_reveal(0.55)
lg = scaled(LOGO, 620 / LOGO.shape[1])
over(f, lg, CX - lg.shape[1] / 2, 180 - lg.shape[0] / 2)
for side, col in ((-1, BLUE), (1, ORANGE)):          # beam heads
    a = 0.55 * math.pi
    hx, hy = W2 / 2 + side * 1000 * math.sin(a), H2 / 2 - 600 * math.cos(a)
    hx = min(max(hx, 55), W2 - 55)
    glow(f, hx, hy, 40, col, 1.4)
    glow(f, hx, hy, 140, col, 0.35)
F(8, "5.4 – 6.6", "اللوقو يطلع · الأشعة ترسم الإطار · زاپ زاپ", f)

# 09 beams meet at the bottom, controller lights up
f = MASTER.copy()
glow(f, CX, 1000, 220, BLUE, 0.30)
glow(f, CX - 20, 935, 26, (255, 255, 255), 0.9)
F(9, "6.6 – 7.4", "الأشعة تتلاقى تحت · المانيطة تشعل · رنّة تسيير", f)

# 10 final = master-eclairs + gold hex dust fading
f = MASTER.copy() + honeycomb(1.0) * 0.06
for _ in range(160):
    glow(f, rng.uniform(80, W2 - 80), rng.uniform(150, 900), rng.uniform(0.8, 2.0), (255, 205, 120), rng.uniform(0.05, 0.35))
F(10, "7.4 – 8.5", "الخلفية master-eclairs · غبرة ذهبية · صوت النحلة", f)

files = [os.path.join(OUT, f"frame_{i:02d}.png") for i in range(1, 11)]
sheet = Image.new("RGB", (480 * 2 + 30, 270 * 5 + 60), (12, 12, 14))
for i, p in enumerate(files):
    sheet.paste(Image.open(p).resize((480, 270), Image.LANCZOS), (10 + (i % 2) * 490, 10 + (i // 2) * 280))
sheet.save(os.path.join(OUT, "storyboard.png"))
print("ok")
