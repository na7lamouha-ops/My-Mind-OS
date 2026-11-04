"""«مرحبا بك في ملعبي» — storyboard key frames (Çukur-style structure, our assets).
run from repo root: python3 edprod/projects/2026-11-03-mal3abi/frames.py
"""
import os, sys
sys.path.insert(0, "edprod/tools/lib")
from edprod_kit import *  # noqa

OUT = "out/mal3abi/frames"
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(3)
L = os.path.join(ASSETS, "layers")
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
VIGN = np.clip(1 - 0.7 * (((xx - W / 2) / (W * 0.7)) ** 2 + ((yy - H / 2) / (H * 0.62)) ** 2), 0, 1)[..., None]


def load(name, crop=True):
    im = Image.open(os.path.join(L, name)).convert("RGBA")
    if crop:
        im = im.crop(im.getbbox())
    return np.asarray(im).astype(np.float32) / 255


LOGO = load("layer-logo-ecommanita.png")
PAD = load("layer-controller-tassyir.png")
BOARD = np.asarray(Image.open(os.path.join(L, "tactics-board-9x16.png")).convert("RGB")).astype(np.float32) / 255


def grade(f, keep=None, sat=0.15, contrast=1.25, tint=(0.96, 1.0, 1.06)):
    """Çukur look: almost black & white, hard contrast, cold. `keep` = mask (H,W,1) that keeps colour."""
    lum = (f * np.array([0.299, 0.587, 0.114], np.float32)).sum(-1, keepdims=True)
    g = lum + (f - lum) * sat
    g = np.clip((g - 0.5) * contrast + 0.5 - 0.03, 0, 1) * np.array(tint, np.float32)
    if keep is not None:
        g = g * (1 - keep) + f * keep
    g *= VIGN
    g += rng.standard_normal((H, W, 1)).astype(np.float32) * 0.018
    return g


def ctext(f, s, y, size=96, col=WHITE, weight="ExtraBold", glowcol=None, k=0.6):
    t = text_rgba(s, font(weight, size), col)
    x = (W - t.shape[1]) / 2
    if glowcol:
        text_glow(f, t, x, y, glowcol, k)
    over(f, t, x, y)
    return t.shape[0]


def tag(f, n, label):
    t = text_rgba(f"{n:02d}  {label}", font("Bold", 34), (200, 205, 215))
    over(f, t, W - t.shape[1] - 40, H - 120, 0.85)


def mask_of(img, x, y):
    m = np.zeros((H, W, 1), np.float32)
    tmp = np.zeros((H, W, 3), np.float32)
    a = img.copy(); a[..., :3] = 1
    over(tmp, a, x, y)
    return tmp[..., :1]


# ---------------------------------------------------------------- night street with banners
def street(look_up=0.0, close=False):
    im = Image.new("RGB", (W, H), (14, 16, 20))
    d = ImageDraw.Draw(im)
    vx, vy = W / 2, 760 - 500 * look_up
    # sky glow
    for r in range(600, 0, -20):
        c = int(18 + 30 * (1 - r / 600))
        d.ellipse([vx - r, vy - 900 - r * 0.5, vx + r, vy - 900 + r * 0.5], fill=(c, c + 2, c + 6))
    # buildings both sides in perspective
    for side in (-1, 1):
        for i in range(7):
            x0 = W / 2 + side * (W * 0.62 - i * 60)
            x1 = W / 2 + side * (W * 0.62 - (i + 1) * 60)
            top0, top1 = -200 + i * 90, -200 + (i + 1) * 90
            shade = 52 + rng.integers(0, 26)
            poly = [(side * 4000 + W / 2, -400), (x0, top0), (x1, top1), (x1, H - 380 + i * -25), (side * 4000 + W / 2, H + 400)]
            d.polygon(poly, fill=(shade, shade + 1, shade + 4))
            for wdw in range(6):
                if rng.random() < 0.35:
                    wy = top0 + 120 + wdw * 150
                    wx = (x0 + x1) / 2
                    lc = (190, 170, 120) if rng.random() < 0.5 else (90, 95, 105)
                    d.rectangle([wx - 9, wy, wx + 9, wy + 26], fill=lc)
    # street floor
    d.polygon([(0, H), (W, H), (W / 2 + 70, vy + 260), (W / 2 - 70, vy + 260)], fill=(40, 41, 44))
    f = np.asarray(im).astype(np.float32) / 255
    f = nd.gaussian_filter(f, (1.2, 1.2, 0))
    for lx, ly in [(W * 0.18, vy + 120), (W * 0.82, vy + 60), (W / 2, vy - 200)]:
        glow(f, lx, ly, 160, (255, 220, 170), 0.22)
    glow(f, W / 2, vy + 260, 260, (200, 210, 230), 0.15)
    # people silhouettes at the end of the street
    for k in range(9):
        px, sc = W / 2 + rng.uniform(-120, 120), rng.uniform(0.6, 1.0)
        py = vy + 300 + rng.uniform(0, 80)
        hh = 70 * sc
        f[int(py - hh):int(py), int(px - 7 * sc):int(px + 7 * sc)] *= 0.35
    return f


def banner(w, h, phase, logo=LOGO, dark=True):
    """hanging cloth with the logo printed, rippling."""
    rgb = np.zeros((h, w, 3), np.float32) + (0.07 if dark else 0.72)
    lg = scaled(logo, (w * 0.78) / logo.shape[1])
    over(rgb, lg, (w - lg.shape[1]) / 2, h * 0.5 - lg.shape[0] / 2)
    cloth = np.dstack([rgb, np.ones((h, w), np.float32)])
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    amp = (ys / h) ** 1.1
    ph = ys / h * 5 + xs / w * 2 + phase
    dx = 14 * amp * np.sin(ph)
    out = np.stack([nd.map_coordinates(cloth[..., c], [ys, np.clip(xs - dx, 0, w - 1)], order=1) for c in range(4)], -1)
    out[..., :3] *= (1 + 0.28 * np.cos(ph) * (0.4 + amp))[..., None]
    out[..., :3] += 0.04 * rng.standard_normal((h, w, 1)).astype(np.float32)
    return np.clip(out, 0, 1)


def rope(f, p, q, sag=40):
    im = Image.new("L", (W, H), 0)
    pts = [(p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s + sag * math.sin(math.pi * s)) for s in np.linspace(0, 1, 30)]
    ImageDraw.Draw(im).line(pts, fill=255, width=3)
    a = np.asarray(im).astype(np.float32)[..., None] / 255
    f[:] = f * (1 - a * 0.8) + 0.02 * a


# ---------------------------------------------------------------- tactics board
BOARD_C = (540, 958)


def pitch(y):  # left/right pitch edges at screen y (perspective trapezoid of the board image)
    t = (y - 532) / (1570 - 532)
    return 226 + (90 - 226) * t, 854 + (990 - 854) * t


def board_pt(u, v):
    """u in [-1,1] across, v in [0,1] top goal → bottom goal → screen xy."""
    y = 532 + v * (1570 - 532)
    l, r = pitch(y)
    return (l + r) / 2 + u * (r - l) / 2, y


def player(f, x, y, col=BLUE, r=22, captain=False, label=None):
    s = r / 22 * (0.8 + 0.4 * (y - 532) / 1040)
    glow(f, x, y, 34 * s, col, 0.55)
    im = Image.new("RGBA", (120, 120), (0, 0, 0, 0))
    dd = ImageDraw.Draw(im)
    R = 22 * s
    dd.ellipse([60 - R, 60 - R, 60 + R, 60 + R], fill=tuple(col) + (255,), outline=(255, 255, 255, 255), width=3)
    if captain:
        dd.arc([60 - R - 9, 60 - R - 9, 60 + R + 9, 60 + R + 9], 200, 340, fill=ORANGE + (255,), width=7)
    over(f, np.asarray(im).astype(np.float32) / 255, x - 60, y - 60)
    if label:
        t = text_rgba(label, font("Bold", 36), WHITE)
        over(f, t, x - t.shape[1] / 2, y + 30 * s)


def frames():
    out = []
    # 01 HOOK
    f = BOARD.copy() * 0.55
    glow(f, *BOARD_C, 260, (255, 255, 255), 0.10)
    player(f, *BOARD_C, col=ORANGE, captain=True)
    sat_mask = np.clip((f.max(-1) - f.min(-1) - 0.06) * 5, 0, 1)[..., None]
    f = grade(f, sat=0.2) * (1 - sat_mask) + f * sat_mask
    ctext(f, "مرحبا بك", 255, 105, glowcol=ORANGE, k=0.35)
    ctext(f, "في ملعبي", 370, 135, col=(255, 150, 60), glowcol=ORANGE, k=0.7)
    tag(f, 1, "الهوك · 0.0 ث")
    out.append(f)

    # 02 street + banners (camera low, looking up)
    f = street(0.3)
    for i, (yb, sp) in enumerate([(260, 760), (640, 500), (900, 300)]):
        rope(f, (W / 2 - sp, yb - 40), (W / 2 + sp, yb - 40), sag=30)
        bw = int(sp * 0.40); bh = int(bw * 1.35)
        for side in (-1, 1):
            b = banner(bw, bh, i * 1.3 + side, dark=False)
            over(f, b, W / 2 + side * sp * 0.5 - bw / 2, yb - 40 + 22)
    keep = (f.max(-1, keepdims=True) > 0.0) * 0  # recomputed below
    lm = np.zeros((H, W, 1), np.float32)
    g = grade(f, sat=0.12, contrast=1.1)
    # logos keep colour: re-add colourful pixels
    sat_mask = np.clip((f.max(-1) - f.min(-1) - 0.15) * 4, 0, 1)[..., None]
    f = g * (1 - sat_mask) + f * VIGN * sat_mask
    tag(f, 2, "رايات الملعب فوق الزنقة · 2.5 ث")
    out.append(f)

    # 03 close banner
    f = np.zeros((H, W, 3), np.float32) + 0.06
    f = street(0.8) * 0.6
    b = banner(820, 1150, 2.0, dark=False)
    rope(f, (-50, 330), (W + 50, 330), sag=20)
    over(f, b, (W - 820) / 2, 345)
    sat_mask = np.clip((f.max(-1) - f.min(-1) - 0.15) * 4, 0, 1)[..., None]
    f = grade(f, sat=0.1, contrast=1.1) * (1 - sat_mask) + f * VIGN * sat_mask
    tag(f, 3, "الراية تتحرك بالريح · 4.5 ث")
    out.append(f)

    # 04 the pad lights up = «كلشي في يدك»
    f = np.zeros((H, W, 3), np.float32) + np.array([0.03, 0.03, 0.04], np.float32)
    p = scaled(PAD, 980 / PAD.shape[1])
    glow(f, W / 2, 980, 300, BLUE, 0.18); glow(f, W / 2 + 200, 1000, 260, ORANGE, 0.15)
    over(f, p, (W - p.shape[1]) / 2, 980 - p.shape[0] / 2)
    f *= VIGN
    ctext(f, "الملعب كامل… في يدك", 380, 88, glowcol=BLUE, k=0.4)
    tag(f, 4, "الدراعة tassyir تشعل · 7.0 ث")
    out.append(f)

    # 05 circle formation (like the Çukur circle)
    f = BOARD.copy() * 0.6
    for i in range(10):
        a = i / 10 * 2 * math.pi
        x, y = BOARD_C[0] + 270 * math.cos(a), BOARD_C[1] + 210 * math.sin(a)
        player(f, x, y)
    player(f, *BOARD_C, col=ORANGE, captain=True, r=26)
    sat_mask = np.clip((f.max(-1) - f.min(-1) - 0.2) * 4, 0, 1)[..., None]
    f = grade(f, sat=0.2) * (1 - sat_mask) + f * VIGN * sat_mask
    ctext(f, "كل واحد في بلاصتو", 300, 92)
    tag(f, 5, "الدائرة · الكابيتان في الوسط · 10 ث")
    out.append(f)

    # 06 formation with roles
    f = BOARD.copy() * 0.6
    roles = [(0, 0.93, "الإشهار"), (-0.55, 0.74, "الستوك"), (0.55, 0.74, "التأكيد"),
             (-0.6, 0.47, "الليفرور"), (0.6, 0.47, "الدراهم"), (0, 0.6, "أنت")]
    pts = {}
    for u, v, lab in roles:
        x, y = board_pt(u, v); pts[lab] = (x, y)
    for a_, b_ in [("الإشهار", "التأكيد"), ("التأكيد", "الستوك"), ("الستوك", "الليفرور"), ("الليفرور", "الدراهم"), ("أنت", "الإشهار")]:
        p0, p1 = pts[a_], pts[b_]
        im = Image.new("L", (W, H), 0)
        dd = ImageDraw.Draw(im)
        n = 14
        for s in range(n):
            if s % 2 == 0:
                dd.line([(p0[0] + (p1[0] - p0[0]) * s / n, p0[1] + (p1[1] - p0[1]) * s / n),
                         (p0[0] + (p1[0] - p0[0]) * (s + 1) / n, p0[1] + (p1[1] - p0[1]) * (s + 1) / n)], fill=255, width=5)
        a = np.asarray(im).astype(np.float32)[..., None] / 255
        f = f * (1 - a) + np.array(GOLD, np.float32) / 255 * a
    for u, v, lab in roles:
        player(f, *board_pt(u, v), col=ORANGE if lab == "أنت" else BLUE, captain=lab == "أنت", label=lab)
    sat_mask = np.clip((f.max(-1) - f.min(-1) - 0.2) * 4, 0, 1)[..., None]
    f = grade(f, sat=0.2) * (1 - sat_mask) + f * VIGN * sat_mask
    ctext(f, "وكل واحد يعرف دورو", 300, 92)
    tag(f, 6, "التشكيلة: الأدوار · 14 ث")
    out.append(f)

    # 07 the team walks to camera (line at the bottom, big)
    f = BOARD.copy() * 0.5
    for i in range(7):
        u = -0.75 + i * 0.25
        x, y = board_pt(u, 0.78 - abs(u) * 0.08)
        player(f, x, y, col=ORANGE if i == 3 else BLUE, captain=i == 3, r=34)
    for i in range(7):  # motion trails
        u = -0.75 + i * 0.25
        for k in range(1, 5):
            x, y = board_pt(u, 0.78 - abs(u) * 0.08 - k * 0.05)
            glow(f, x, y, 18, BLUE, 0.10 / k)
    sat_mask = np.clip((f.max(-1) - f.min(-1) - 0.2) * 4, 0, 1)[..., None]
    f = grade(f, sat=0.2) * (1 - sat_mask) + f * VIGN * sat_mask
    ctext(f, "حنا فريق… ماشي فوضى", 300, 92)
    tag(f, 7, "الفريق يمشي للكاميرا · 18 ث")
    out.append(f)

    # 08 end card
    f = np.zeros((H, W, 3), np.float32) + 0.025
    lg = scaled(LOGO, 900 / LOGO.shape[1])
    glow(f, W / 2, 700, 380, ORANGE, 0.12)
    over(f, lg, (W - lg.shape[1]) / 2, 700 - lg.shape[0] / 2)
    f *= VIGN
    ctext(f, "اندلاع الدورة", 1000, 120, glowcol=ORANGE, k=0.5)
    ctext(f, "مرحبا بك في ملعبي", 1170, 80, col=(200, 205, 215))
    ctext(f, "تبّع… الماتش راهو بدا", 1320, 60, col=GOLD, weight="Bold")
    tag(f, 8, "كارت الآخر · 22 ث")
    out.append(f)
    return out


fs = frames()
thumbs = []
for i, f in enumerate(fs, 1):
    im = Image.fromarray((np.clip(f, 0, 1) * 255).astype(np.uint8))
    im.save(os.path.join(OUT, f"frame_{i:02d}.png"))
    thumbs.append(im.resize((360, 640), Image.LANCZOS))
sheet = Image.new("RGB", (360 * 4 + 50, 640 * 2 + 30), (8, 8, 10))
for i, t in enumerate(thumbs):
    sheet.paste(t, (10 + (i % 4) * 370, 10 + (i // 4) * 650))
sheet.save(os.path.join(OUT, "storyboard.png"))
print("ok")
