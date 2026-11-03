"""«مرحبا بك في ملعبي» — storyboard v2, cinematic look.
Real-feeling cloth banners (height-field folds, lighting, printed logo), Algiers night street in true perspective,
fog / volumetric light / wet-ground reflections, tactics war-table with physical tokens, backlit walking team.
run from repo root: python3 edprod/projects/2026-11-03-mal3abi/frames_v2.py
"""
import os
import sys

sys.path.insert(0, "edprod/tools/lib")
from edprod_kit import *  # noqa

OUT = os.environ.get("OUT", "out/mal3abi/frames_v2")
NOTAG = os.environ.get("NOTAG") == "1"
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(11)
L = os.path.join(ASSETS, "layers")
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)


def load(name, crop=True):
    im = Image.open(os.path.join(L, name)).convert("RGBA")
    if crop:
        im = im.crop(im.getbbox())
    return np.asarray(im).astype(np.float32) / 255


LOGO = load("layer-logo-ecommanita.png")
PAD = load("layer-controller-tassyir.png")
BOARD = np.asarray(Image.open(os.path.join(L, "tactics-board-9x16.png")).convert("RGB")).astype(np.float32) / 255


# ================================================================ helpers ========
def blur(a, s):
    return nd.gaussian_filter(a, (s, s, 0)) if a.ndim == 3 else nd.gaussian_filter(a, s)


def homography(src, dst):
    A = []
    for (x, y), (u, v) in zip(src, dst):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    _, _, Vt = np.linalg.svd(np.array(A, np.float64))
    Hm = Vt[-1].reshape(3, 3)
    return Hm / Hm[2, 2]


def hpt(Hm, x, y):
    p = Hm @ np.array([x, y, 1.0])
    return p[0] / p[2], p[1] / p[2]


def warp(img, quad, size=(W, H)):
    """RGBA float image -> full-frame RGBA float, its corners (TL,TR,BR,BL) mapped onto `quad`."""
    h, w = img.shape[:2]
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    Hi = homography(quad, src)
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), "RGBA")
    o = im.transform(size, Image.PERSPECTIVE, tuple((Hi.flatten() / Hi[2, 2])[:8]), Image.BICUBIC)
    return np.asarray(o).astype(np.float32) / 255


def comp(f, rgba, alpha=1.0):
    a = rgba[..., 3:4] * alpha
    f[:] = rgba[..., :3] * a + f * (1 - a)


def add(f, light):
    f += light


def bloom(f, thr=0.62, s=26, k=0.55):
    b = np.clip(f - thr, 0, None)
    f += blur(b, s) * k + blur(b, s * 3) * k * 0.6


def finish(f, sat=0.35, keep=None, cold=True, grain=0.02, vign=0.75):
    """cinema grade: low saturation, cold shadows / warm highlights, vignette, grain, slight CA."""
    lum = (f * np.array([0.299, 0.587, 0.114], np.float32)).sum(-1, keepdims=True)
    g = lum + (f - lum) * sat
    if keep is not None:
        g = g * (1 - keep) + f * keep
    if cold:
        sh = np.clip(1 - lum * 2.2, 0, 1)
        g = g + sh * np.array([-0.012, 0.0, 0.025], np.float32)
    g = g / (1 + 0.18 * g)  # soft shoulder
    g = np.clip(g * 1.12, 0, None)
    v = np.clip(1 - vign * (((xx - W / 2) / (W * 0.85)) ** 2 + ((yy - H / 2) / (H * 0.72)) ** 2), 0.15, 1)[..., None]
    g *= v
    g[..., 0] = nd.shift(g[..., 0], (0, 1.2), order=1, mode="nearest")
    g[..., 2] = nd.shift(g[..., 2], (0, -1.2), order=1, mode="nearest")
    n = rng.standard_normal((H // 2, W // 2, 1)).astype(np.float32).repeat(2, 0).repeat(2, 1)
    g += n * grain * (0.6 + 0.4 * (1 - np.clip(lum, 0, 1)))
    return np.clip(g, 0, 1)


def colour_mask(f, thr=0.10):
    return np.clip((f.max(-1) - f.min(-1) - thr) * 5, 0, 1)[..., None]


def ctext(f, s, y, size=96, col=WHITE, weight="ExtraBold", glowcol=None, k=0.6, shadow=True):
    t = text_rgba(s, font(weight, size), col)
    x = (W - t.shape[1]) / 2
    if shadow:
        sh = t.copy(); sh[..., :3] = 0
        sh[..., 3] = nd.gaussian_filter(sh[..., 3], 6) * 0.8
        over(f, sh, x + 4, y + 6)
    if glowcol:
        text_glow(f, t, x, y, glowcol, k)
    over(f, t, x, y)


def tag(f, n, label):
    if NOTAG:
        return
    t = text_rgba(f"{n:02d}  {label}", font("Bold", 32), (190, 195, 205))
    over(f, t, W - t.shape[1] - 40, H - 110, 0.8)


def printed_logo(logo, width):
    """logo as ink printed on cloth: drop the soft glow halo, keep crisp shapes."""
    lg = scaled(logo, width / logo.shape[1])
    a = lg[..., 3]
    lg[..., 3] = np.clip((a - 0.45) * 3.0, 0, 1)
    lg[..., :3] = np.clip(lg[..., :3] * 0.92, 0, 1)
    return lg


# ================================================================ cloth =========
def cloth(w, h, t=0.0, wind=1.0, light=(-0.55, -0.6, 0.6), albedo=(0.80, 0.78, 0.73), seed=0, logo_w=0.74):
    """banner hung by its top hem. Height-field folds + wind, lit, logo printed and following the folds."""
    r = np.random.default_rng(seed)
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    u, v = xs / w, ys / h
    # folds: vertical gravity folds from the hem + travelling wind ripples + small wrinkles
    hf = np.zeros((h, w), np.float32)
    for i in range(4):
        fq = r.uniform(2.0, 4.0)
        hf += r.uniform(0.6, 1.0) * np.sin(2 * np.pi * (fq * u + 0.15 * v * r.uniform(-1, 1) + r.uniform(0, 1))) * (0.25 + 0.75 * v)
    hf += 0.9 * wind * np.sin(2 * np.pi * (1.1 * u + 0.5 * v) - t * 2.6) * (0.2 + v) ** 1.3
    hf += 0.35 * wind * np.sin(2 * np.pi * (2.2 * u - 0.4 * v) - t * 3.4 + 1.0) * v
    wr = nd.gaussian_filter(r.standard_normal((h, w)).astype(np.float32), (w * 0.08, w * 0.03))
    hf += 0.10 * wr / (wr.std() + 1e-6)
    hf *= w * 0.022
    # top hem stays straight
    hf *= np.clip(v / 0.06, 0, 1)
    gy, gx = np.gradient(hf)
    n = np.dstack([-gx, -gy, np.ones_like(hf)])
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    Lv = np.array(light, np.float32); Lv /= np.linalg.norm(Lv)
    ndl = (n * Lv).sum(-1)
    diff = np.clip(ndl, 0, 1)
    trans = np.clip(-ndl, 0, 1) * 0.25          # thin fabric lets light through
    Hh = Lv + np.array([0, 0, 1.0]); Hh /= np.linalg.norm(Hh)
    sheen = np.clip((n * Hh).sum(-1), 0, 1) ** 18 * 0.12
    ao = np.clip(1 - np.clip(nd.gaussian_filter(hf, w * 0.03) - hf, 0, None) / (w * 0.02), 0.45, 1)
    # albedo: cotton weave, dirt toward the bottom, printed logo (distorted with the folds)
    alb = np.ones((h, w, 3), np.float32) * np.array(albedo, np.float32)
    weave = (np.sin(xs * 1.7) * np.sin(ys * 1.7)) * 0.015 + r.standard_normal((h, w)).astype(np.float32) * 0.02
    alb *= (1 + weave)[..., None]
    alb *= (1 - 0.18 * nd.gaussian_filter(r.random((h, w)).astype(np.float32), w * 0.06) * v)[..., None]
    lg = printed_logo(LOGO, w * logo_w)
    tmp = np.dstack([alb, np.ones((h, w), np.float32)])
    over(tmp[..., :3], lg, (w - lg.shape[1]) / 2, h * 0.47 - lg.shape[0] / 2)
    alb = tmp[..., :3]
    k = 0.9
    sx = np.clip(xs + gx * k * 4, 0, w - 1)
    sy = np.clip(ys + gy * k * 4, 0, h - 1)
    alb = np.dstack([nd.map_coordinates(alb[..., c], [sy, sx], order=1) for c in range(3)])
    shade = (0.22 + 0.95 * diff + trans) * ao
    rgb = alb * shade[..., None] + sheen[..., None]
    # silhouette: the free edges flap with the wind
    dx = (w * 0.025 * wind * np.sin(2 * np.pi * 1.6 * v - t * 3.0) * v ** 1.5)
    edge_l = 0 + dx + w * 0.01 * np.sin(v * 9 + seed)
    edge_r = w - w * 0.03 * v ** 2 + dx
    bottom = h - h * 0.04 * (0.5 + 0.5 * np.sin(2 * np.pi * 2 * u - t * 2.4))
    a = np.clip(xs - edge_l, 0, 1) * np.clip(edge_r - xs, 0, 1) * np.clip(bottom - ys, 0, 1)
    # hem at the top
    hem = (ys < h * 0.035)
    rgb[hem] *= 0.78
    return np.dstack([np.clip(rgb, 0, 1.4), a])


# ================================================================ street ========
VP = (540.0, 1230.0)
K = 200.0      # px per metre at s = 1
CAM_H = 1.6


def sp(X, h, s):
    """3-D street point (X metres across, h metres up) at depth scale s -> screen."""
    return VP[0] + X * K * s, VP[1] - (h - CAM_H) * K * s


def facade(seed, length_px=2600, height_px=1300):
    """Algiers white facade: plaster, floors, tall windows with blue shutters, wrought-iron balconies."""
    r = np.random.default_rng(seed)
    im = Image.new("RGB", (length_px, height_px), (176, 172, 163))
    d = ImageDraw.Draw(im)
    floor_h = height_px / 7
    win_w = length_px / 26
    for fl in range(7):
        y0 = height_px - (fl + 1) * floor_h
        d.rectangle([0, y0 + floor_h - 10, length_px, y0 + floor_h - 2], fill=(170, 166, 156))
        if fl == 0:
            for i in range(0, length_px, int(win_w * 2.2)):
                d.rectangle([i + 10, y0 + floor_h * 0.25, i + win_w * 1.6, height_px], fill=(40, 42, 46))
                for k in range(int(floor_h * 0.75 / 9)):
                    d.line([i + 10, y0 + floor_h * 0.25 + k * 9, i + win_w * 1.6, y0 + floor_h * 0.25 + k * 9], fill=(70, 72, 76))
            continue
        for i in range(13):
            x0 = i * win_w * 2 + win_w * 0.5
            wy0, wy1 = y0 + floor_h * 0.18, y0 + floor_h * 0.88
            state = r.random()
            if state < 0.15:
                col = (230, 180, 110)      # lit window
            else:
                col = (28, 30, 36)
            d.rectangle([x0, wy0, x0 + win_w, wy1], fill=col)
            if state > 0.35:               # shutters (blue-grey), slats
                sc = (70, 95, 120) if r.random() < 0.7 else (110, 120, 128)
                if state > 0.7:
                    d.rectangle([x0, wy0, x0 + win_w, wy1], fill=sc)
                    for k in range(int((wy1 - wy0) / 7)):
                        d.line([x0, wy0 + k * 7, x0 + win_w, wy0 + k * 7], fill=tuple(int(c * 0.75) for c in sc))
                else:
                    d.rectangle([x0 - win_w * 0.45, wy0, x0, wy1], fill=sc)
                    d.rectangle([x0 + win_w, wy0, x0 + win_w * 1.45, wy1], fill=sc)
            # balcony
            by = wy1 - floor_h * 0.25
            d.rectangle([x0 - win_w * 0.3, wy1 - 2, x0 + win_w * 1.3, wy1 + 6], fill=(150, 146, 138))
            d.line([x0 - win_w * 0.3, by, x0 + win_w * 1.3, by], fill=(25, 25, 28), width=3)
            for k in range(9):
                bx = x0 - win_w * 0.3 + k * win_w * 1.6 / 8
                d.line([bx, by, bx, wy1], fill=(25, 25, 28), width=2)
            if r.random() < 0.25:          # laundry / clutter
                d.line([x0 - win_w * 0.3, by - 4, x0 + win_w * 1.3, by + 6], fill=(150, 60, 50), width=6)
    f = np.asarray(im).astype(np.float32) / 255
    stain = nd.gaussian_filter(r.random((height_px, length_px)).astype(np.float32), 30)
    stain = (stain - stain.mean()) / (stain.std() + 1e-6)
    f *= (1 + 0.07 * stain + 0.03 * r.standard_normal((height_px, length_px)).astype(np.float32))[..., None]
    f *= np.linspace(0.85, 1.05, height_px)[:, None, None]   # streaks / dirt toward the ground
    return np.dstack([np.clip(f, 0, 1), np.ones((height_px, length_px), np.float32)])


FAC_L, FAC_R = facade(1), facade(2)
LAMPS = [(-4.6, 4.6, 0.95), (4.6, 4.6, 0.62), (-4.6, 4.6, 0.40), (4.6, 4.6, 0.27), (-4.6, 4.6, 0.19), (4.6, 4.6, 0.14)]


def street(banners=True, t=0.0, people=0, cam_shift=0.0):
    f = np.zeros((H, W, 3), np.float32)
    # sky: sodium-lit low clouds
    sky = np.clip(1 - np.abs(yy - VP[1] + 500) / 1600, 0, 1)
    f += (sky ** 2)[..., None] * np.array([0.20, 0.16, 0.14], np.float32) + 0.02
    s_near, s_far = 1.6, 0.07
    for X, fac in ((-5.0, FAC_L), (5.0, FAC_R)):
        q = [sp(X, 24, s_near), sp(X, 24, s_far), sp(X, 0, s_far), sp(X, 0, s_near)]
        if X > 0:
            q = [sp(X, 24, s_far), sp(X, 24, s_near), sp(X, 0, s_near), sp(X, 0, s_far)]
        comp(f, warp(fac if X < 0 else fac, q))
    # ground (wet asphalt + cobbles), between the walls
    g = Image.new("L", (W, H), 0)
    ImageDraw.Draw(g).polygon([sp(-5, 0, s_near), sp(5, 0, s_near), sp(5, 0, s_far), sp(-5, 0, s_far)], fill=255)
    gm = np.asarray(g).astype(np.float32)[..., None] / 255
    road = 0.07 + 0.03 * nd.gaussian_filter(rng.random((H, W)).astype(np.float32), 3)[..., None]
    f = f * (1 - gm) + road * gm
    # night light: dim everything, lamps paint the walls
    lit = np.zeros((H, W, 1), np.float32) + 0.13
    for X, hh, s in LAMPS:
        x, y = sp(X, hh, s)
        R = 900 * s
        lit += (np.exp(-(((xx - x) ** 2 + ((yy - y) * 0.8) ** 2) / (R * R))) * 0.55)[..., None]
    lit = lit / (1 + 0.6 * lit)
    f *= lit * np.array([1.0, 0.92, 0.80], np.float32)
    # fog by depth (distance to the vanishing point)
    d = np.sqrt((xx - VP[0]) ** 2 + (yy - VP[1]) ** 2)
    fog = np.exp(-d / 330)[..., None]
    f = f * (1 - fog * 0.85) + np.array([0.30, 0.30, 0.32], np.float32) * fog * 0.85
    # lamps: sources, volumetric cones, wet-ground reflections
    for X, hh, s in LAMPS:
        x, y = sp(X, hh, s)
        glow(f, x, y, 26 * s + 3, (255, 214, 160), 1.6)
        glow(f, x, y, 140 * s + 8, (255, 190, 120), 0.35)
        cone = Image.new("L", (W, H), 0)
        gx0, gy0 = sp(X - np.sign(X) * 1.5, 0, s)
        gx1, gy1 = sp(X + np.sign(X) * 0.3, 0, s)
        ImageDraw.Draw(cone).polygon([(x, y), (gx0, gy0), (gx1, gy1)], fill=255)
        c = blur(np.asarray(cone).astype(np.float32) / 255, 30 * s + 4)[..., None]
        f += c * np.array([0.30, 0.24, 0.16], np.float32) * 0.55
        rx, ry = sp(X * 0.55, 0, s)
        streak = np.exp(-(((xx - rx) / (18 * s + 2)) ** 2 + ((yy - ry - 160 * s) / (260 * s + 10)) ** 2))[..., None]
        f += streak * gm * np.array([0.9, 0.7, 0.45], np.float32) * 0.35
    if people:
        for k in range(people):
            X = rng.uniform(-2.2, 2.2)
            s = rng.uniform(0.09, 0.16)
            man(f, *sp(X, 0, s), 1.8 * K * s, rim=0.4)
    if banners:
        for i, s in enumerate([0.18, 0.27, 0.40, 0.62]):
            for j, X in enumerate((-2.0, 2.0)):
                bw, bh = 1.7 * K * s, 2.5 * K * s
                if bw < 8:
                    continue
                c = cloth(int(bw), int(bh), t + i + j, wind=1.0, seed=10 * i + j, light=(-0.4 * np.sign(X), -0.7, 0.55))
                x, y = sp(X, 8.0, s)
                rope_y = y
                # depth of field: focus on the 3rd row
                c = c.copy()
                sig = abs(s - 0.40) * 6
                if sig > 0.3:
                    c = blur(c, sig)
                fogk = float(np.exp(-np.hypot(x - VP[0], y - VP[1]) / 330))
                c[..., :3] = c[..., :3] * (1 - fogk * 0.8) + 0.30 * fogk * 0.8
                c[..., :3] *= 0.35 + 0.65 * min(1.0, 0.4 + s)
                over(f, c, x - bw / 2, rope_y + 4)
            # rope
            im = Image.new("L", (W, H), 0)
            p0, p1 = sp(-5, 8.3, s), sp(5, 8.3, s)
            pts = [(p0[0] + (p1[0] - p0[0]) * a, p0[1] + (p1[1] - p0[1]) * a + 30 * s * math.sin(math.pi * a)) for a in np.linspace(0, 1, 40)]
            ImageDraw.Draw(im).line(pts, fill=255, width=max(1, int(4 * s)))
            a = np.asarray(im).astype(np.float32)[..., None] / 255
            f = f * (1 - a * 0.85) + 0.03 * a
    return f


# ================================================================ people ========
def man(f, x, y_feet, hpx, rim=1.0, armband=False, stride=0.0, back=(1.0, 0.85, 0.7)):
    """coat silhouette standing at (x, y_feet), height hpx. Backlit: rim light on the edges."""
    S = 4
    w_, h_ = int(hpx * 0.6 * S) + 8, int(hpx * 1.05 * S) + 8
    im = Image.new("L", (w_, h_), 0)
    d = ImageDraw.Draw(im)
    cx, top = w_ / 2, 4
    u = hpx * S
    d.ellipse([cx - 0.048 * u, top, cx + 0.048 * u, top + 0.125 * u], fill=255)                    # head
    d.polygon([(cx - 0.03 * u, top + 0.11 * u), (cx + 0.03 * u, top + 0.11 * u), (cx + 0.05 * u, top + 0.16 * u), (cx - 0.05 * u, top + 0.16 * u)], fill=255)
    d.chord([cx - 0.13 * u, top + 0.145 * u, cx + 0.13 * u, top + 0.26 * u], 180, 360, fill=255)    # shoulders
    d.polygon([(cx - 0.13 * u, top + 0.20 * u), (cx + 0.13 * u, top + 0.20 * u), (cx + 0.115 * u, top + 0.45 * u),
               (cx + 0.125 * u, top + 0.60 * u), (cx - 0.125 * u, top + 0.60 * u), (cx - 0.115 * u, top + 0.45 * u)], fill=255)  # long coat
    for side in (-1, 1):                                                                              # arms
        sw_ = 0.03 * stride * side
        d.polygon([(cx + side * 0.105 * u, top + 0.19 * u), (cx + side * 0.15 * u, top + 0.21 * u),
                   (cx + side * (0.15 + sw_) * u, top + 0.50 * u), (cx + side * (0.12 + sw_) * u, top + 0.51 * u)], fill=255)
        d.ellipse([cx + side * (0.135 + sw_) * u - 0.022 * u, top + 0.49 * u, cx + side * (0.135 + sw_) * u + 0.022 * u, top + 0.54 * u], fill=255)
    for side, ph in ((-1, stride), (1, -stride)):                                                     # legs
        lx = cx + side * 0.045 * u
        d.polygon([(lx - 0.036 * u, top + 0.58 * u), (lx + 0.036 * u, top + 0.58 * u),
                   (lx + 0.028 * u + ph * 0.04 * u, top + 0.965 * u), (lx - 0.028 * u + ph * 0.04 * u, top + 0.965 * u)], fill=255)
        d.ellipse([lx - 0.04 * u + ph * 0.04 * u, top + 0.95 * u, lx + 0.05 * u + ph * 0.04 * u, top + 0.99 * u], fill=255)
    a = np.asarray(im.resize((w_ // S, h_ // S), Image.LANCZOS)).astype(np.float32) / 255
    er = nd.grey_erosion(a, size=(3, 3))
    edge = np.clip(a - nd.gaussian_filter(er, 1.5), 0, 1)
    body = np.zeros(a.shape + (4,), np.float32)
    body[..., :3] = 0.025
    body[..., :3] += edge[..., None] * np.array(back, np.float32) * rim * 1.6
    body[..., 3] = a
    if armband:
        ab = np.zeros_like(a)
        hh, ww = a.shape
        ay0, ay1 = int(0.33 * hh), int(0.37 * hh)
        ab[ay0:ay1, int(ww / 2 + 0.17 * hpx):int(ww / 2 + 0.25 * hpx)] = 1
        ab *= a
        body[..., :3] = body[..., :3] * (1 - ab[..., None]) + ab[..., None] * np.array([1.0, 0.47, 0.08], np.float32)
    # long shadow toward the camera (backlight)
    sh = Image.new("L", (W, H), 0)
    ImageDraw.Draw(sh).polygon([(x - hpx * 0.08, y_feet), (x + hpx * 0.08, y_feet), (x + hpx * 0.2, y_feet + hpx * 0.7), (x - hpx * 0.2, y_feet + hpx * 0.7)], fill=255)
    sa = blur(np.asarray(sh).astype(np.float32) / 255, hpx * 0.05 + 1)[..., None]
    sa *= np.clip(1 - (yy[..., None] - y_feet) / (hpx * 0.7), 0, 1)
    f[:] = f * (1 - sa * 0.7)
    body = blur(body, 0.8)
    over(f, body, x - a.shape[1] / 2, y_feet - a.shape[0] + 2)
    # contact shadow
    glow(f, x, y_feet, hpx * 0.12, (0, 0, 0), 0)


# ================================================================ war table =====
TABLE_Q = [(250, 330), (830, 330), (1150, 1880), (-70, 1880)]
HB = homography([(0, 0), (W, 0), (W, H), (0, H)], TABLE_Q)


def wood():
    r = np.random.default_rng(5)
    n = nd.gaussian_filter(r.standard_normal((H, W)).astype(np.float32), (2, 60))
    grain_ = np.sin(xx * 0.05 + n * 6) * 0.5 + 0.5
    base = np.array([0.20, 0.12, 0.07], np.float32)
    return base * (0.6 + 0.4 * grain_[..., None])


WOOD = wood()


def table_scene(screen_k=1.0):
    f = WOOD * 0.35
    # overhead lamp cone on the table
    lamp = np.exp(-(((xx - 540) / 700) ** 2 + ((yy - 1050) / 1000) ** 2))[..., None]
    f *= 0.25 + 1.4 * lamp
    scr = np.dstack([BOARD * screen_k, np.ones((H, W), np.float32)])
    sw = warp(scr, TABLE_Q)
    # bevel/frame of the screen
    fr = Image.new("L", (W, H), 0)
    ImageDraw.Draw(fr).polygon([(240, 318), (840, 318), (1170, 1900), (-90, 1900)], fill=255)
    frm = np.asarray(fr).astype(np.float32)[..., None] / 255
    f = f * (1 - frm) + 0.015 * frm
    comp(f, sw)
    # screen light spills on the table + haze
    spill = blur(sw[..., :3] * sw[..., 3:4], 60)
    f += spill * 0.6
    haze = np.exp(-(((xx - 540) / 900) ** 2 + ((yy - 300) / 700) ** 2))[..., None]
    f += haze * np.array([0.05, 0.055, 0.06], np.float32)
    # lamp beam from the top (volumetric)
    beam = Image.new("L", (W, H), 0)
    ImageDraw.Draw(beam).polygon([(470, -10), (610, -10), (1000, 1300), (80, 1300)], fill=255)
    f += blur(np.asarray(beam).astype(np.float32) / 255, 70)[..., None] * np.array([0.07, 0.07, 0.065], np.float32)
    # dust in the beam
    for _ in range(140):
        px, py = rng.uniform(150, 930), rng.uniform(0, 1300)
        glow(f, px, py, rng.uniform(1.0, 2.6), (255, 245, 230), rng.uniform(0.1, 0.5))
    return f


def board_xy(u, v):
    """u in [-1,1] across the pitch, v in [0,1] top goal → bottom goal, on the board image -> screen."""
    y = 532 + v * (1570 - 532)
    t = (y - 532) / (1570 - 532)
    l, r = 226 + (90 - 226) * t, 854 + (990 - 854) * t
    return hpt(HB, (l + r) / 2 + u * (r - l) / 2, y)


def token(f, x, y, col=BLUE, captain=False, size=1.0):
    """physical puck: shadow, side, top, glowing ring, specular."""
    persp = 0.75 + 0.55 * (y - 330) / 1550
    R = 30 * size * persp
    sq = 0.55
    hgt = R * 0.55
    sh = Image.new("L", (W, H), 0)
    ImageDraw.Draw(sh).ellipse([x - R * 1.1 + R * 0.35, y - R * sq + R * 0.45, x + R * 1.1 + R * 0.35, y + R * sq * 1.3 + R * 0.45], fill=200)
    sa = blur(np.asarray(sh).astype(np.float32) / 255, R * 0.35)[..., None]
    f[:] = f * (1 - sa * 0.75)
    glow(f, x, y, R * 1.6, col, 0.45)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = tuple(int(v * 0.45) for v in col)
    d.rectangle([x - R, y - hgt, x + R, y], fill=c + (255,))
    d.ellipse([x - R, y - R * sq, x + R, y + R * sq], fill=c + (255,))
    d.ellipse([x - R, y - hgt - R * sq, x + R, y - hgt + R * sq], fill=tuple(col) + (255,))
    d.ellipse([x - R * 0.72, y - hgt - R * sq * 0.72, x + R * 0.72, y - hgt + R * sq * 0.72], fill=tuple(int(v * 0.8) for v in col) + (255,))
    if captain:
        d.arc([x - R * 0.9, y - hgt - R * sq * 0.9, x + R * 0.9, y - hgt + R * sq * 0.9], 0, 360, fill=(255, 255, 255, 255), width=max(2, int(R * 0.12)))
        d.text((x, y - hgt), "C", font=font("Black", int(R * 0.9)), fill=(255, 255, 255, 255), anchor="mm")
    a = np.asarray(im).astype(np.float32) / 255
    a[..., :3] = blur(a[..., :3], 0.6)
    over(f, a, 0, 0)
    glow(f, x - R * 0.35, y - hgt - R * sq * 0.35, R * 0.25, (255, 255, 255), 0.6)
    return y - hgt


def gold_dash(f, p0, p1, n=16, w=5):
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    for s in range(n):
        if s % 2 == 0:
            a0, a1 = s / n, (s + 1) / n
            d.line([(p0[0] + (p1[0] - p0[0]) * a0, p0[1] + (p1[1] - p0[1]) * a0),
                    (p0[0] + (p1[0] - p0[0]) * a1, p0[1] + (p1[1] - p0[1]) * a1)], fill=255, width=w)
    a = np.asarray(im).astype(np.float32)[..., None] / 255
    f[:] = f * (1 - a) + np.array(GOLD, np.float32) / 255 * a
    f += blur(a, 6) * np.array(GOLD, np.float32) / 255 * 0.5


def label(f, s, x, y):
    t = text_rgba(s, font("Bold", 38), WHITE)
    sh = t.copy(); sh[..., :3] = 0; sh[..., 3] = nd.gaussian_filter(sh[..., 3], 4)
    over(f, sh, x - t.shape[1] / 2 + 3, y + 4)
    over(f, t, x - t.shape[1] / 2, y)


# ================================================================ frames ========
def f01():
    f = table_scene(0.75)
    token(f, *board_xy(0, 0.41), col=ORANGE, captain=True, size=1.3)
    bloom(f)
    f = finish(f, sat=0.5, keep=colour_mask(f, 0.12) * 0.7)
    ctext(f, "مرحبا بك", 470, 104, glowcol=ORANGE, k=0.3)
    ctext(f, "في ملعبي", 590, 140, col=(255, 150, 60), glowcol=ORANGE, k=0.7)
    tag(f, 1, "الهوك · طاولة القيادة · 0.0 ث")
    return f


def f02():
    f = street(banners=True, t=0.0, people=8)
    bloom(f, 0.7)
    f = finish(f, sat=0.30, keep=colour_mask(f, 0.16) * 0.8)
    tag(f, 2, "زنقة العاصمة · رايات الملعب · 2.5 ث")
    return f


def f03():
    bg = street(banners=False, t=0.0)
    bg = blur(bg, 16)
    for X, hh, s in LAMPS[:4]:                       # bokeh discs
        x, y = sp(X, hh, s)
        im = Image.new("L", (W, H), 0)
        rr = 60 + 90 * s
        ImageDraw.Draw(im).ellipse([x - rr, y - rr, x + rr, y + rr], fill=255)
        bg += blur(np.asarray(im).astype(np.float32) / 255, 3)[..., None] * np.array([0.5, 0.38, 0.22], np.float32) * 0.6
    f = bg * 0.8
    c = cloth(860, 1260, t=1.7, wind=1.4, seed=4, light=(-0.75, -0.45, 0.5))
    im = Image.new("L", (W, H), 0)
    ImageDraw.Draw(im).line([(-40, 300), (W + 40, 330)], fill=255, width=7)
    a = np.asarray(im).astype(np.float32)[..., None] / 255
    f = f * (1 - a) + 0.02 * a
    over(f, c, (W - 860) / 2 + 10, 312)
    # rim of warm light on the left edge of the cloth from the lamp
    glow(f, 120, 520, 280, (255, 190, 120), 0.18)
    bloom(f, 0.75)
    f = finish(f, sat=0.38, keep=colour_mask(f, 0.16) * 0.8)
    tag(f, 3, "الراية قريبة · الريح · 4.5 ث")
    return f


def f04():
    f = table_scene(0.25) * 0.55
    f = blur(f, 10)
    p = scaled(PAD, 960 / PAD.shape[1])
    x, y = (W - p.shape[1]) / 2, 1080 - p.shape[0] / 2
    ref = p[::-1].copy(); ref[..., 3] *= np.linspace(0.30, 0, ref.shape[0])[:, None]
    over(f, blur(ref, 3), x, y + p.shape[0] - 30)
    sh = Image.new("L", (W, H), 0)
    ImageDraw.Draw(sh).ellipse([x + 80, y + p.shape[0] - 70, x + p.shape[1] - 80, y + p.shape[0] + 10], fill=255)
    f *= 1 - blur(np.asarray(sh).astype(np.float32) / 255, 25)[..., None] * 0.8
    over(f, p, x, y)
    glow(f, x + 250, y + 120, 260, BLUE, 0.10)
    glow(f, x + p.shape[1] - 250, y + 120, 260, ORANGE, 0.10)
    bloom(f, 0.6)
    f = finish(f, sat=0.75, keep=colour_mask(f, 0.10))
    ctext(f, "الملعب كامل… في يدك", 420, 86, glowcol=BLUE, k=0.35)
    tag(f, 4, "الدراعة tassyir تشعل · 7.0 ث")
    return f


def f05():
    f = table_scene(0.7)
    pts = []
    for i in range(10):
        a = i / 10 * 2 * math.pi
        pts.append((0.62 * math.cos(a), 0.41 + 0.17 * math.sin(a)))
    pts.sort(key=lambda p: p[1])
    for u, v in pts:
        token(f, *board_xy(u, v), col=BLUE)
    token(f, *board_xy(0, 0.41), col=ORANGE, captain=True, size=1.25)
    bloom(f)
    f = finish(f, sat=0.5, keep=colour_mask(f, 0.12) * 0.7)
    ctext(f, "كل واحد في بلاصتو", 440, 92)
    tag(f, 5, "الدائرة · الكابيتان في الوسط · 10 ث")
    return f


def f06():
    f = table_scene(0.7)
    roles = [(0, 0.90, "الإشهار"), (-0.55, 0.70, "الستوك"), (0.55, 0.70, "التأكيد"),
             (-0.6, 0.42, "الليفرور"), (0.6, 0.42, "الدراهم"), (0, 0.55, "أنت")]
    P = {lab: board_xy(u, v) for u, v, lab in roles}
    for a_, b_ in [("الإشهار", "التأكيد"), ("التأكيد", "الستوك"), ("الستوك", "الليفرور"), ("الليفرور", "الدراهم"), ("أنت", "الإشهار")]:
        gold_dash(f, P[a_], P[b_])
    tops = {}
    for u, v, lab in sorted(roles, key=lambda r: r[1]):
        tops[lab] = token(f, *P[lab], col=ORANGE if lab == "أنت" else BLUE, captain=lab == "أنت", size=1.1)
    bloom(f)
    f = finish(f, sat=0.5, keep=colour_mask(f, 0.12) * 0.7)
    for u, v, lab in roles:
        label(f, lab, P[lab][0], P[lab][1] + 30)
    ctext(f, "وكل واحد يعرف دورو", 440, 92)
    tag(f, 6, "التشكيلة بالأدوار · 14 ث")
    return f


def f07():
    f = street(banners=True, t=2.0, people=0)
    # strong backlight at the end of the street
    glow(f, VP[0], VP[1] - 120, 380, (255, 225, 190), 0.75)
    glow(f, VP[0], VP[1] - 120, 120, (255, 245, 230), 1.2)
    formation = [(0.0, 0.95, True), (-1.0, 0.72, False), (1.0, 0.72, False), (-1.9, 0.56, False),
                 (1.9, 0.56, False), (-2.7, 0.44, False), (2.7, 0.44, False)]
    for X, s, cap in sorted(formation, key=lambda m: m[1]):
        x, y = sp(X, 0, s)
        man(f, x, y, 1.82 * K * s, rim=1.0, armband=cap, stride=rng.uniform(-0.8, 0.8))
    # low fog layer in front of their feet
    fogl = np.exp(-((yy - 1520) / 200) ** 2)[..., None] * np.array([0.22, 0.22, 0.24], np.float32)
    f += fogl * (0.6 + 0.4 * nd.gaussian_filter(rng.random((H, W)).astype(np.float32), 20)[..., None])
    bloom(f, 0.65, 30, 0.7)
    f = finish(f, sat=0.25, keep=colour_mask(f, 0.2) * 0.8)
    ctext(f, "حنا فريق… ماشي فوضى", 330, 92)
    tag(f, 7, "الفريق يمشي للكاميرا · 18 ث")
    return f


def f08():
    f = np.zeros((H, W, 3), np.float32) + 0.012
    # god rays behind the logo through haze
    cx, cy = W / 2, 720
    ang = np.arctan2(yy - cy, xx - cx)
    rays = (0.5 + 0.5 * np.sin(ang * 23 + 1.3)) ** 6 * (0.5 + 0.5 * np.sin(ang * 7)) ** 2
    dist = np.hypot(xx - cx, yy - cy)
    f += (rays * np.exp(-dist / 650))[..., None] * np.array([0.55, 0.32, 0.12], np.float32) * 0.6
    glow(f, cx, cy, 420, ORANGE, 0.18)
    lg = scaled(LOGO, 920 / LOGO.shape[1])
    over(f, lg, cx - lg.shape[1] / 2, cy - lg.shape[0] / 2)
    for _ in range(220):
        px, py = rng.uniform(0, W), rng.uniform(200, 1500)
        glow(f, px, py, rng.uniform(0.8, 2.2), (255, 220, 180), rng.uniform(0.05, 0.4))
    bloom(f, 0.6)
    f = finish(f, sat=0.9, keep=colour_mask(f, 0.1), cold=False)
    ctext(f, "اندلاع الدورة", 1010, 124, glowcol=ORANGE, k=0.45)
    ctext(f, "مرحبا بك في ملعبي", 1185, 80, col=(205, 210, 220))
    ctext(f, "تبّع… الماتش راهو بدا", 1330, 60, col=GOLD, weight="Bold")
    tag(f, 8, "كارت الآخر · 22 ث")
    return f


if __name__ == "__main__":
    only = sys.argv[1:]
    fns = [f01, f02, f03, f04, f05, f06, f07, f08]
    for i, fn in enumerate(fns, 1):
        if only and str(i) not in only:
            continue
        f = fn()
        Image.fromarray((np.clip(f, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, f"frame_{i:02d}.png"))
        print("frame", i)
    files = [os.path.join(OUT, f"frame_{i:02d}.png") for i in range(1, 9)]
    if all(os.path.exists(p) for p in files):
        sheet = Image.new("RGB", (360 * 4 + 50, 640 * 2 + 30), (8, 8, 10))
        for i, p in enumerate(files):
            sheet.paste(Image.open(p).resize((360, 640), Image.LANCZOS), (10 + (i % 4) * 370, 10 + (i // 4) * 650))
        sheet.save(os.path.join(OUT, "storyboard.png"))
