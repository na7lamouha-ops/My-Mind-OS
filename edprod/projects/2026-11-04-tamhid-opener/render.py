"""Opener «من الخلية للاندلاع» — full 8.5 s render (16:9 1920x1080, 30 fps) + sound design (no music).
run from repo root: python3 edprod/projects/2026-11-04-tamhid-opener/render.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from opener_lib import *  # noqa

OUT = "out/tamhid-opener"
os.makedirs(OUT, exist_ok=True)
DUR = 8.5
rng2 = np.random.default_rng(9)

# final logo slot in master-eclairs
LOGO_END_W, LOGO_END_C = 350.0, (960.0, 92.0)
LOGO_MID_W, LOGO_MID_C = 900.0, (CX, HEX_C[1])

# beam heads: bright border pixels sorted along the perimeter
bmask = BORDER.max(-1) > 0.35
BY, BX = np.where(bmask)
BP = PERIM[BY, BX]
BSIDE = BX < W2 / 2


def beam_head(p, left):
    sel = (BSIDE == left) & (np.abs(BP - p) < 0.012)
    if not sel.any():
        return None
    return float(BX[sel].mean()), float(BY[sel].mean())


def lerp(a, b, t):
    return a + (b - a) * t


def zoom(f, z, shake=(0.0, 0.0)):
    if abs(z - 1) < 1e-4 and shake == (0.0, 0.0):
        return f
    im = Image.fromarray((np.clip(f, 0, 1) * 255).astype(np.uint8))
    w, h = int(W2 * z), int(H2 * z)
    big = im.resize((w, h), Image.BICUBIC)
    x0 = (w - W2) / 2 + shake[0]
    y0 = (h - H2) / 2 + shake[1]
    if z < 1:
        canvas = Image.new("RGB", (W2, H2))
        canvas.paste(big, (int(-x0), int(-y0)))
        return np.asarray(canvas).astype(np.float32) / 255
    return np.asarray(big.crop((int(x0), int(y0), int(x0) + W2, int(y0) + H2))).astype(np.float32) / 255


# cache the honeycomb layers (expensive to draw) on a few progress steps
HC_GOLD = {k: honeycomb(k / 20) for k in range(21)}
HC_SPLIT = honeycomb(1.0, colour_split=True)
HC_CRACK = {k: honeycomb(1.0, colour_split=True, crack=k / 10) for k in range(11)}
# sparks rendered once, revealed by radius
SPK = np.zeros((H2, W2, 3), np.float32)
sparks(SPK, *HEX_C)
SPK_R = np.hypot(xx - HEX_C[0], yy - HEX_C[1])

ASSEMBLY = [("ring", 0.50, 0.90, (0, 0)), ("hanger", 0.75, 1.15, (0, -160)), ("shirt_l", 0.95, 1.35, (-180, 40)),
            ("shirt_r", 1.10, 1.50, (180, 40)), ("text", 1.30, 1.70, (0, 90))]


# ================================================================ explosion assets
from scipy.spatial import cKDTree

PAD = rgba(os.path.join(LAY, "layer-controller-tassyir.png"))
KEY_C = (CX, 540.0)
KEY_S_BIG = 0.62
LOGO_IN_KEY = (1089 - 1075, 221.5 - 647.5)     # logo centre relative to the key centre (canvas px)
PAD_IN_KEY = (1075 - 1075, 872 - 647.5)
LOGO_SLOT = (960.0, 92.0, 391.0)              # cx, cy, width in master-eclairs
PAD_SLOT = (957.0, 976.0, 230.0)

# al-KHALiYA as one RGBA on screen, then shattered into Voronoi shards
_src = scaled(np.dstack([unpremul, alpha]), KS)
KH_RGBA = np.zeros((H2, W2, 4), np.float32)
_h, _w = _src.shape[:2]
_x, _y = int(KOFF[0]), int(KOFF[1])
KH_RGBA[_y:_y + _h, _x:_x + _w] = _src[:min(_h, H2 - _y), :min(_w, W2 - _x)]
_a = KH_RGBA[..., 3] > 0.04
_ys, _xs = np.where(_a)
_rs = np.random.default_rng(21)
_seeds = []
for _ in range(90):
    ang_ = _rs.uniform(0, 2 * math.pi)
    rr = 330 * _rs.uniform(0, 1) ** 1.4
    _seeds.append((HEX_C[0] + rr * math.cos(ang_), HEX_C[1] + rr * math.sin(ang_) * 1.1))
_lab = cKDTree(np.array(_seeds)).query(np.stack([_xs, _ys], 1))[1]
SHARDS = []
for i in range(len(_seeds)):
    sel = _lab == i
    if sel.sum() < 30:
        continue
    py, px = _ys[sel], _xs[sel]
    y0, y1, x0, x1 = py.min(), py.max() + 1, px.min(), px.max() + 1
    piece = np.zeros((y1 - y0, x1 - x0, 4), np.float32)
    piece[py - y0, px - x0] = KH_RGBA[py, px]
    cx_, cy_ = px.mean(), py.mean()
    d = np.array([cx_ - HEX_C[0], cy_ - HEX_C[1]])
    dist = np.linalg.norm(d) + 1e-3
    d = d / dist + _rs.normal(0, 0.25, 2)
    d /= np.linalg.norm(d)
    speed = 1500 * (1.25 - dist / 420) + _rs.uniform(0, 500)
    SHARDS.append(dict(img=piece, c=(cx_, cy_), off=(x0 - cx_, y0 - cy_), v=d * speed, w=_rs.uniform(-520, 520),
                       life=_rs.uniform(0.7, 1.25), grow=_rs.uniform(0.2, 0.9)))

EMBERS = []
for _ in range(340):
    ang_ = _rs.uniform(0, 2 * math.pi)
    sp_ = _rs.uniform(250, 1700) * _rs.uniform(0.4, 1) ** 0.5
    EMBERS.append((HEX_C[0] + _rs.normal(0, 18), HEX_C[1] + _rs.normal(0, 18), math.cos(ang_) * sp_, math.sin(ang_) * sp_ * 0.85,
                   _rs.uniform(0.45, 1.4), _rs.uniform(1, 3)))
SMOKE = nd.gaussian_filter(_rs.standard_normal((H2 // 2, W2 // 2)).astype(np.float32), 24)
SMOKE += 0.5 * nd.gaussian_filter(_rs.standard_normal((H2 // 2, W2 // 2)).astype(np.float32), 7)
SMOKE = (SMOKE - SMOKE.min()) / (SMOKE.max() - SMOKE.min())


def drag_pos(p0, v, t, k=2.4, g=320.0):
    return (p0[0] + v[0] * (1 - math.exp(-k * t)) / k, p0[1] + v[1] * (1 - math.exp(-k * t)) / k + 0.5 * g * t * t)


def shards(f, te):
    for sh in SHARDS:
        if te > sh["life"]:
            continue
        fade = 1 - ease_in3(te / sh["life"])
        emit = 1 + 2.2 * math.exp(-te / 0.12)
        img = sh["img"].copy()
        img[..., :3] = np.clip(img[..., :3] * emit * np.array([1.0, 0.86, 0.62]) ** (emit - 1), 0, 1)
        k = 1 + sh["grow"] * te
        im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), "RGBA")
        if k != 1:
            im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.BILINEAR)
        im = im.rotate(sh["w"] * te, resample=Image.BILINEAR, expand=True)
        a = np.asarray(im).astype(np.float32) / 255
        for j, dt in enumerate((-0.022, -0.011, 0.0)):        # motion blur
            x, y = drag_pos(sh["c"], sh["v"], max(0.0, te + dt))
            over(f, a, x - a.shape[1] / 2, y - a.shape[0] / 2, fade * (0.35 if j < 2 else 1.0))


def embers(f, te):
    im = Image.new("L", (W2, H2), 0)
    im_c = Image.new("L", (W2, H2), 0)
    d, dc = ImageDraw.Draw(im), ImageDraw.Draw(im_c)
    for x0, y0, vx, vy, life, wdt in EMBERS:
        if te > life:
            continue
        a = 1 - te / life
        p1 = drag_pos((x0, y0), (vx, vy), te, k=1.8, g=520)
        p0 = drag_pos((x0, y0), (vx, vy), max(0, te - 0.035), k=1.8, g=520)
        d.line([p0, p1], fill=int(255 * a), width=int(wdt))
        dc.line([p0, p1], fill=int(255 * a * a), width=int(wdt))
    A = np.asarray(im).astype(np.float32)[..., None] / 255
    C = np.asarray(im_c).astype(np.float32)[..., None] / 255
    hot = np.array([1.0, 0.95, 0.75], np.float32)
    warm = np.array([1.0, 0.45, 0.08], np.float32)
    f += A * warm + C * hot * 0.8 + blur_(A, 5) * warm * 1.2


def smoke(f, te):
    if te <= 0:
        return
    p = min(1.0, te / 1.4)
    R = 160 + 760 * ease_out(p)
    sc = 1 + 0.7 * p
    gy, gx = (yy[::2, ::2] - HEX_C[1]) / sc + HEX_C[1], (xx[::2, ::2] - HEX_C[0]) / sc + HEX_C[0]
    n = nd.map_coordinates(SMOKE, [gy / 2, gx / 2], order=1, mode="reflect")
    dist = np.hypot(xx[::2, ::2] - HEX_C[0], yy[::2, ::2] - HEX_C[1])
    m = np.exp(-(dist / R) ** 2) * np.clip(n * 1.6 - 0.35, 0, 1) * (1 - p) ** 1.3
    m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize((W2, H2), Image.BILINEAR)).astype(np.float32)[..., None] / 255
    lit = np.exp(-(np.hypot(xx - HEX_C[0], yy - HEX_C[1]) / (R * 0.6)) ** 2)[..., None]
    col = np.array([0.30, 0.24, 0.20], np.float32) + lit * np.array([0.55, 0.30, 0.10], np.float32)
    f[:] = f * (1 - m * 0.55) + col * m * 0.55


def shockwave(f, te):
    if not (0 < te < 0.5):
        return f
    p = te / 0.5
    r = 60 + 1500 * ease_out(p)
    d = np.hypot(xx - HEX_C[0], yy - HEX_C[1]) + 1e-3
    band = np.exp(-((d - r) / 45) ** 2) * (1 - p)
    dx = (xx - HEX_C[0]) / d * band * 22
    dy = (yy - HEX_C[1]) / d * band * 22
    out = np.stack([nd.map_coordinates(f[..., c], [yy - dy, xx - dx], order=1, mode="nearest") for c in range(3)], -1)
    out += band[..., None] * np.array([0.35, 0.30, 0.25], np.float32) * 0.6
    return out


def key(f, S, logo_pos=None, pad_pos=None, a=1.0):
    """the full key (ecommanita logo + tassyir controller) at scale S around KEY_C, or each part at its own pose."""
    if logo_pos is None:
        logo_pos = (KEY_C[0] + LOGO_IN_KEY[0] * S, KEY_C[1] + LOGO_IN_KEY[1] * S, LOGO.shape[1] * S)
        pad_pos = (KEY_C[0] + PAD_IN_KEY[0] * S, KEY_C[1] + PAD_IN_KEY[1] * S, PAD.shape[1] * S)
    for img, (cx, cy, w) in ((PAD, pad_pos), (LOGO, logo_pos)):
        if w < 2:
            continue
        L = scaled(img, w / img.shape[1])
        over(f, L, cx - L.shape[1] / 2, cy - L.shape[0] / 2, a)


def khaliya(f, t, a_all=1.0):
    for name, t0, t1, (dx, dy) in ASSEMBLY:
        p = ease_out((t - t0) / (t1 - t0))
        if p <= 0:
            continue
        s = lerp(1.6, 1.0, p)
        kh_layer(f, name, dx=dx * (1 - p), dy=dy * (1 - p), a=min(1, p * 1.5) * a_all, s=s)


def render(t):
    f = np.zeros((H2, W2, 3), np.float32)
    z, shake = 1.0, (0.0, 0.0)
    if t < 0.5:
        k = math.exp(-((t - 0.3) / 0.06) ** 2)
        glow(f, CX, CY, 260, (90, 25, 25), 0.10 * k)
    elif t < 3.9:
        # honeycomb
        if t >= 1.7:
            p = ease_io((t - 1.7) / 0.8)
            hc = HC_GOLD[int(round(p * 20))]
            if t >= 3.7:                          # touch: gold -> blue/orange
                c = ease_io((t - 3.7) / 0.15)
                f += hc * 0.5 * (1 - c) + HC_SPLIT * 0.65 * c
            else:
                f += hc * (0.55 if t < 2.5 else lerp(0.55, 0.45, min(1, (t - 2.5) / 0.4)))
        khaliya(f, t)
        glow(f, *HEX_C, 300, (255, 200, 110), 0.10 * min(1, max(0, (t - 1.3) / 0.4)))
        z = 1 + 0.03 * ease_io((t - 1.7) / 2.0)
        if t >= 2.5:                              # bullet glides in from the left
            bw = scaled(BULLET, 0.42).shape[1]
            p = ease_out((t - 2.5) / 1.2) if t < 3.7 else 1.0
            x_end = HEX_C[0] - bw / 2 + 20
            x = lerp(-bw, x_end, p)
            spin = math.pi * min(1, (t - 2.5) / 1.2)
            for k in range(1, 6):
                glow(f, x - bw / 2 - k * 55, HEX_C[1], max(4, 22 - k * 3), (255, 220, 170), 0.10 * (1 - p * 0.6))
            bullet_at(f, x, HEX_C[1], spin=spin if t < 3.7 else 0.0, halo=1.0 + 0.4 * (t >= 3.7))
            if t >= 3.7:
                glow(f, *HEX_C, 40, (255, 255, 255), 1.2)
    elif t < 5.4:
        te = t - 3.9
        # residual honeycomb, smoke, teaser sparks (lighter), shards, embers
        f += HC_CRACK[int(round(ease_out(min(1, te / 0.7)) * 10))] * 0.55 * max(0.0, 1 - te / 1.0)
        smoke(f, te)
        r = 900 * ease_out(min(1, te * 2.2))
        m = np.clip((r - SPK_R) / 60, 0, 1)[..., None]
        f += SPK * m * 0.45 * max(0.0, 1 - te / 0.6)
        glow(f, *HEX_C, 380, (255, 190, 120), 0.9 * math.exp(-te / 0.25))
        glow(f, *HEX_C, 110, (255, 250, 235), 2.2 * math.exp(-te / 0.12))
        # the key is born small inside the fireball and zooms up
        if te > 0.12:
            pz = ease_out(min(1.0, (te - 0.12) / 1.0))
            S = lerp(0.03, KEY_S_BIG, pz)
            glow(f, *KEY_C, 420 * S / KEY_S_BIG + 40, (255, 170, 90), 0.28)
            key(f, S, a=min(1.0, (te - 0.12) / 0.1))
        shards(f, te)
        embers(f, te)
        if te < 0.08:
            f += (1 - te / 0.08) * 0.9
        f = shockwave(f, te)
        if te < 0.25:
            shake = (rng2.uniform(-12, 12) * (1 - te / 0.25), rng2.uniform(-8, 8) * (1 - te / 0.25))
        z = lerp(1.03, 1.0, ease_io(min(1, te / 1.5)))
    else:
        # frame drawing + logo to its slot, then master
        p = ease_io(min(1, (t - 5.4) / 1.2))
        f = frame_reveal(p * 1.01)
        if t < 6.95:
            S = KEY_S_BIG
            l0 = (KEY_C[0] + LOGO_IN_KEY[0] * S, KEY_C[1] + LOGO_IN_KEY[1] * S, LOGO.shape[1] * S)
            p0 = (KEY_C[0] + PAD_IN_KEY[0] * S, KEY_C[1] + PAD_IN_KEY[1] * S, PAD.shape[1] * S)
            lp = tuple(lerp(a, b, p) for a, b in zip(l0, LOGO_SLOT))
            pp = tuple(lerp(a, b, p) for a, b in zip(p0, PAD_SLOT))
            key(f, 0, logo_pos=lp, pad_pos=pp, a=1 - ease_io((t - 6.65) / 0.25))
        for left, col in ((True, BLUE), (False, ORANGE)):
            if p < 0.995:
                h = beam_head(p, left)
                if h:
                    glow(f, *h, 34, col, 1.4)
                    glow(f, *h, 130, col, 0.35)
        # crossfade into the exact master (logo slot at 6.55, controller from 6.6)
        cf_logo = ease_io((t - 6.5) / 0.25)
        cf_pad = ease_io((t - 6.6) / 0.5)
        mlogo = (logo_box[..., None]).astype(np.float32) * cf_logo
        mpad = (pad_box[..., None]).astype(np.float32) * cf_pad
        f = f * (1 - mlogo) + MASTER * mlogo
        f = f * (1 - mpad) + MASTER * mpad
        kall = ease_io((t - 6.6) / 0.8)
        f = f * (1 - kall) + MASTER * kall
        if t >= 7.4:
            f = MASTER.copy()
        if 6.6 <= t < 7.4:
            k = math.exp(-(t - 6.6) / 0.25)
            glow(f, CX, 1000, 220, BLUE, 0.30 * k + 0.05)
            glow(f, CX - 20, 935, 26, (255, 255, 255), 0.9 * k)
        if t >= 7.0:                               # gold dust fading
            k = max(0.0, 1 - (t - 7.0) / 1.5)
            f += HC_GOLD[20] * 0.06 * k
            for (px, py, rr, a) in DUST:
                glow(f, px, py - (t - 7.0) * 12, rr, (255, 205, 120), a * k)
        return f
    f = zoom(f, z, shake)
    return vignette(f)


DUST = [(rng2.uniform(80, W2 - 80), rng2.uniform(150, 900), rng2.uniform(0.8, 2.0), rng2.uniform(0.05, 0.35)) for _ in range(120)]

if os.environ.get("MODE", "full") in ("full", "video"):
    enc = Encoder(os.path.join(OUT, "video.mp4"), size=(W2, H2))
    for n in range(int(DUR * FPS)):
        t = n / FPS
        f = render(t)
        f = f + rng2.standard_normal((H2 // 2, W2 // 2, 1)).astype(np.float32).repeat(2, 0).repeat(2, 1) * (0.010 if t < 7.4 else 0.004)
        enc.write(f)
        if n % 15 == 0:
            Image.fromarray((np.clip(f, 0, 1) * 255).astype(np.uint8)).resize((480, 270)).save(os.path.join(OUT, f"p_{n:04d}.png"))
    enc.close()
    print("video done")

# ============================================================ sound (no music) ==
mix = Mix(DUR)
r = np.random.default_rng(2)


def tone(fq, dur, decay, amp=1.0):
    tt = np.arange(int(dur * SR)) / SR
    return amp * np.sin(2 * np.pi * fq * tt) * np.exp(-tt / decay) * np.minimum(1, tt / 0.003)


def summ(*xs):
    n = max(len(x) for x in xs)
    return sum(np.pad(x, (0, n - len(x))) for x in xs)


def heartbeat():
    a = summ(tone(55, 0.35, 0.09), 0.5 * tone(110, 0.2, 0.04))
    b = np.zeros(int(0.22 * SR))
    return np.concatenate([a, b, 0.7 * a])


def tick():
    s = summ(tone(3100, 0.12, 0.018, 0.6), tone(5200, 0.08, 0.01, 0.3))
    s += flt(r.standard_normal(len(s)), "high", 2500) * np.exp(-np.arange(len(s)) / SR / 0.006) * 0.4
    return s


def buzz(dur, f0=210):
    tt = np.arange(int(dur * SR)) / SR
    vib = 1 + 0.02 * np.sin(2 * np.pi * 7 * tt) + 0.01 * np.sin(2 * np.pi * 13 * tt)
    ph = 2 * np.pi * np.cumsum(f0 * vib) / SR
    s = sum(np.sin(k * ph) / k for k in range(1, 9))
    s = flt(s, "band", [150, 2400])
    am = 0.7 + 0.3 * np.sin(2 * np.pi * 31 * tt)
    return s * am / 3


def hum(dur, f0=60):
    tt = np.arange(int(dur * SR)) / SR
    s = np.sin(2 * np.pi * f0 * tt) + 0.5 * np.sin(2 * np.pi * 2 * f0 * tt) + 0.3 * np.sin(2 * np.pi * 3 * f0 * tt)
    s += flt(r.standard_normal(len(tt)), "band", [1500, 6000]) * 0.15 * (r.random(len(tt)) > 0.985)
    return s * np.linspace(0, 1, len(tt)) ** 1.5


def crackle(dur, density=0.02):
    n = int(dur * SR)
    s = flt(r.standard_normal(n), "high", 1800) * (r.random(n) < density)
    return nd.gaussian_filter1d(s, 2) * 4 * np.exp(-np.arange(n) / SR / (dur * 0.5))


def boom():
    tt = np.arange(int(2.5 * SR)) / SR
    fs = 32 + 70 * np.exp(-tt / 0.07)
    s = np.sin(2 * np.pi * np.cumsum(fs) / SR) * np.exp(-tt / 0.7)
    ir = r.standard_normal(int(1.5 * SR)) * np.exp(-np.arange(int(1.5 * SR)) / SR / 0.4)
    return s + np.convolve(flt(s, "low", 900), ir)[:len(s)] * 0.015


def whoosh(dur=0.9, rise=True):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    env = np.sin(np.pi * tt / dur) ** 2
    s = flt(r.standard_normal(n), "band", [250, 3000]) * env
    return s


def zap():
    tt = np.arange(int(0.5 * SR)) / SR
    fs = 2400 * np.exp(-tt / 0.08) + 300
    s = np.sign(np.sin(2 * np.pi * np.cumsum(fs) / SR)) * np.exp(-tt / 0.12) * 0.25
    return flt(s, "band", [200, 7000]) + crackle(0.5, 0.03) * 0.5


def chime():
    s = summ(tone(880, 1.2, 0.5, 0.5), tone(1318.5, 1.2, 0.45, 0.35), tone(1760, 1.0, 0.3, 0.2))
    s = summ(s, np.concatenate([np.zeros(int(0.09 * SR)), tone(1318.5, 1.1, 0.5, 0.4)]))
    return s


def wind(dur):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    return flt(r.standard_normal(n), "band", [180, 900]) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.4 * tt)) * np.minimum(1, tt / 0.5)


mix.place(0.22, heartbeat(), 0.55)
for name, t0, t1, _ in ASSEMBLY:
    mix.place(t1 - 0.02, tick(), 0.30, pan=(-0.3 if "l" in name[-1:] else 0.3 if "r" in name[-1:] else 0.0))
mix.place(1.75, heartbeat(), 0.45)
b = buzz(1.4) * np.concatenate([np.linspace(0, 1, int(0.4 * SR)), np.ones(int(0.6 * SR)), np.linspace(1, 0, int(0.4 * SR))])
mix.place(1.7, np.stack([b, np.roll(b, 300)], 1), 0.05)
mix.place(2.5, hum(1.2), 0.09)
# 3.7 -> 3.9 total silence
mix.place(3.9, boom(), 0.95)
c = crackle(1.2, 0.03)
mix.place(3.9, np.stack([c, np.roll(c, 700)], 1), 0.35)
mix.place(4.0, whoosh(1.1), 0.30)
for _ in range(26):                                   # gold shards falling / clinking
    tc = 4.05 + r.uniform(0, 1.0)
    mix.place(tc, tone(r.uniform(2500, 6500), 0.25, r.uniform(0.02, 0.06), r.uniform(0.15, 0.4)), 0.25, pan=r.uniform(-0.9, 0.9))
rumble = flt(r.standard_normal(int(2.0 * SR)), "low", 120) * np.exp(-np.arange(int(2.0 * SR)) / SR / 0.6)
mix.place(3.92, rumble, 0.9)
mix.place(5.45, zap(), 0.32, pan=-0.6)
mix.place(5.65, zap(), 0.32, pan=0.6)
for tc, pn in ((5.85, -0.9), (5.95, 0.9), (6.35, -0.8), (6.45, 0.8)):
    mix.place(tc, crackle(0.25, 0.05), 0.25, pan=pn)
mix.place(6.62, chime(), 0.22)
w = wind(1.6)
mix.place(7.0, np.stack([w, np.roll(w, 1200)], 1), 0.05)
b2 = buzz(1.2, 230) * np.linspace(0, 1, int(1.2 * SR))
mix.place(7.3, np.stack([b2, np.roll(b2, 200)], 1), 0.045)
# enforce exact silence at the touch
mix.buf[int(3.7 * SR):int(3.9 * SR)] = 0
mix.save(os.path.join(OUT, "audio.wav"), fade_out=0.05)
print("audio done")
