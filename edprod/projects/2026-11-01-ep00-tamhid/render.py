"""التمهيد · تحرير العقول من التشتت — test render of part 1 «الشرارة» (0 → 13 s).
run from repo root:  python3 edprod/projects/2026-11-01-ep00-tamhid/render.py
"""
import os
import sys

sys.path.insert(0, "edprod/tools/lib")
from edprod_kit import *  # noqa

OUT = os.environ.get("OUT", "out/ep00-tamhid")
os.makedirs(OUT, exist_ok=True)
DUR = float(os.environ.get("DUR", 13.0))
rng = np.random.default_rng(7)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
VIGN = np.clip(1 - 0.55 * (((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H / 2) / (H * 0.62)) ** 2), 0, 1)[..., None]

# ------------------------------------------------------------ assets ------------
BULLET = np.asarray(Image.open(os.path.join(ASSETS, "sprites", "bullet-ecommanita.png")).convert("RGBA")).astype(np.float32) / 255
F_TITLE = font("ExtraBold", 92)
F_BIG = font("Black", 150)
F_MED = font("Bold", 70)

# glossy dark floor for the bullet
FLOOR = np.zeros((H, W, 3), np.float32)
FLOOR += np.array([0.02, 0.025, 0.04], np.float32)
FLOOR += (np.exp(-((yy - 1080) / 520) ** 2) * 0.10)[..., None] * np.array([0.6, 0.75, 1.0], np.float32)
FLOOR *= VIGN


# Algerian flag (green hoist, white fly, red crescent + star), 3:2
def make_flag(w=960, h=640):
    im = Image.new("RGB", (w * 2, h * 2), (255, 255, 255))
    d = ImageDraw.Draw(im)
    W2, H2 = w * 2, h * 2
    d.rectangle([0, 0, W2 // 2, H2], fill=(0, 98, 51))
    cx, cy = W2 // 2, H2 // 2
    r1 = H2 * 0.25
    d.ellipse([cx - r1, cy - r1, cx + r1, cy + r1], fill=(210, 16, 52))
    r2 = H2 * 0.20
    ox = H2 * 0.0625
    inner = (0, 98, 51) if False else None
    m = Image.new("L", (W2, H2), 0)
    ImageDraw.Draw(m).ellipse([cx + ox - r2, cy - r2, cx + ox + r2, cy + r2], fill=255)
    bg = Image.new("RGB", (W2, H2), (255, 255, 255))
    ImageDraw.Draw(bg).rectangle([0, 0, W2 // 2, H2], fill=(0, 98, 51))
    im.paste(bg, (0, 0), m)
    # star
    sx, sy, R, r = cx + H2 * 0.12, cy, H2 * 0.115, H2 * 0.045
    pts = []
    for i in range(10):
        a = math.pi + i * math.pi / 5
        rr = R if i % 2 == 0 else r
        pts.append((sx + rr * math.cos(a), sy + rr * math.sin(a)))
    d.polygon(pts, fill=(210, 16, 52))
    return np.asarray(im.resize((w, h), Image.LANCZOS)).astype(np.float32) / 255


FLAG = make_flag()
FH, FW = FLAG.shape[:2]


def flag_frame(t):
    """waving flag: hoist fixed, ripples travel to the fly."""
    ys, xs = np.mgrid[0:FH, 0:FW].astype(np.float32)
    amp = (xs / FW) ** 1.2
    ph = xs / FW * 9.0 - t * 3.2
    dy = 26 * amp * np.sin(ph)
    dx = 8 * amp * np.sin(ph * 0.5 + 1.0)
    src_y = np.clip(ys - dy, 0, FH - 1)
    src_x = np.clip(xs - dx, 0, FW - 1)
    out = np.stack([nd.map_coordinates(FLAG[..., c], [src_y, src_x], order=1) for c in range(3)], -1)
    shade = 1 + 0.22 * amp * np.cos(ph)
    out *= shade[..., None]
    a = ((ys - dy >= 0) & (ys - dy <= FH - 1)).astype(np.float32)
    return np.dstack([np.clip(out, 0, 1), a])


# old paper (parchment) + burnt edges
def make_paper():
    base = np.array([0.86, 0.78, 0.60], np.float32)
    n1 = nd.gaussian_filter(rng.standard_normal((H, W)).astype(np.float32), 60) * 9
    n2 = nd.gaussian_filter(rng.standard_normal((H, W)).astype(np.float32), 4) * 1.2
    n3 = rng.standard_normal((H, W)).astype(np.float32) * 0.03
    p = base * (1 + 0.10 * n1 + 0.04 * n2 + n3)[..., None]
    d2 = ((xx - W / 2) / (W * 0.5)) ** 2 + ((yy - H / 2) / (H * 0.5)) ** 2 + 0.08 * n1
    d2 = np.maximum(d2, 0)
    burn = np.clip(1 - 0.55 * d2 ** 1.6, 0, 1)[..., None]
    p = p * (0.45 + 0.55 * burn) * np.array([1.0, 0.92, 0.80], np.float32) ** (1 - burn)
    return np.clip(p, 0, 1)


PAPER = make_paper()
INK = (58, 38, 22)
DATE = text_rgba("1 نوفمبر 1954", F_BIG, INK)
LINE2 = text_rgba("قبل ما يندلع… كان منظّم", font("ExtraBold", 80), INK)
T_SHUH = text_rgba("رحم الله شهداءنا", F_TITLE, WHITE)
# «organisation» dots linked by pencil lines (abstract, no real names)
DOTS = [(230, 1130), (430, 1230), (640, 1110), (850, 1250), (600, 1380), (330, 1400)]
LINKS = [(0, 1), (1, 2), (2, 3), (1, 4), (4, 5), (5, 0), (2, 4)]


def ink_line(f, p, q, v, col=INK, w=4):
    if v <= 0:
        return
    x = p[0] + (q[0] - p[0]) * v
    y = p[1] + (q[1] - p[1]) * v
    im = Image.new("L", (W, H), 0)
    ImageDraw.Draw(im).line([p, (x, y)], fill=215, width=w)
    a = np.asarray(im).astype(np.float32)[..., None] / 255
    f[:] = f * (1 - a) + np.array(col, np.float32) / 255 * a


def frame(t):
    f = np.zeros((H, W, 3), np.float32)
    # ---------------- 0 → 4.4 : bullet close-up, light sweep on «ecommanita»
    if t < 4.6:
        f[:] = FLOOR
        k = 0.52 + 0.06 * ease_io(t / 4.6)
        b = scaled(BULLET, k)
        bh, bw = b.shape[:2]
        x, y = (W - bw) / 2, 900 - bh / 2
        # reflection
        ref = b[::-1].copy()
        ref[..., 3] *= np.linspace(0.35, 0, bh)[:, None]
        over(f, ref, x, y + bh + 6)
        over(f, b, x, y)
        # light sweep (additive band masked by the bullet)
        sx = -0.3 + 1.6 * ease_io((t - 0.5) / 2.4)
        cols = np.arange(bw, dtype=np.float32) / bw
        band = np.exp(-((cols - sx) / 0.07) ** 2)[None, :] * b[..., 3]
        x0, y0 = int(x), int(y)
        f[y0:y0 + bh, x0:x0 + bw] += band[..., None] * np.array([1.0, 0.85, 0.6], np.float32) * 0.55
        glow(f, x + bw * sx, y + bh * 0.4, 70, ORANGE, 0.25 * float(0 < sx < 1))
        fade_in = ease_io(t / 0.6)
        f *= fade_in
        if t > 3.8:
            f *= 1 - ease_io((t - 3.8) / 0.6)
    # ---------------- 4.0 → 7.5 : flag, «رحم الله شهداءنا», fade to black
    if 4.0 <= t < 7.5:
        g = np.zeros((H, W, 3), np.float32) + np.array([0.03, 0.035, 0.05], np.float32)
        g *= VIGN
        fl = flag_frame(t)
        s = 0.95 + 0.03 * ease_io((t - 4) / 3.5)
        fl = scaled(fl, s)
        over(g, fl, (W - fl.shape[1]) / 2, 760 - fl.shape[0] / 2)
        a = ease_io((t - 4.7) / 0.7)
        tx, ty = (W - T_SHUH.shape[1]) / 2, 1230
        over(g, T_SHUH, tx, ty, a)
        v = ease_io((t - 4.0) / 0.6) * (1 - ease_io((t - 6.7) / 0.8))
        f[:] = np.maximum(f, g * v) if t < 4.6 else g * v
    # ---------------- 7.5 → 9.0 : black + silence
    # ---------------- 9.0 → 13 : old paper, date stamp, «قبل ما يندلع… كان منظّم»
    if t >= 9.0:
        z = 1.0 + 0.04 * ease_io((t - 9) / 4)
        p = PAPER if z == 1 else np.asarray(Image.fromarray((PAPER * 255).astype(np.uint8)).resize(
            (int(W * z), int(H * z)), Image.BILINEAR)).astype(np.float32)[:H, :W] / 255
        g = p.copy()
        # stamp punch at 9.05
        st = ease_out((t - 9.05) / 0.25)
        if st > 0:
            k = 1.25 - 0.25 * st
            d = scaled(DATE, k)
            over(g, d, (W - d.shape[1]) / 2, 640 - d.shape[0] / 2, min(1, st * 1.4) * 0.92)
        r = (t - 10.2) / 1.1
        if r > 0:
            ln = reveal_rtl(LINE2, ease_io(r))
            over(g, ln, (W - ln.shape[1]) / 2, 860, 0.9)
        for i, (a_, b_) in enumerate(LINKS):
            ink_line(g, DOTS[a_], DOTS[b_], ease_io((t - 11.0 - i * 0.22) / 0.5), w=5)
        for i, (dx, dy) in enumerate(DOTS):
            if t > 10.8 + i * 0.12:
                ImageDraw.Draw(im := Image.new("L", (W, H), 0)).ellipse([dx - 12, dy - 12, dx + 12, dy + 12], fill=230)
                a = np.asarray(im).astype(np.float32)[..., None] / 255
                g[:] = g * (1 - a) + np.array([0.55, 0.12, 0.10], np.float32) * a
        f[:] = g * ease_io((t - 9.0) / 0.12)
    # light film grain, everywhere except true black
    if f.max() > 0.01:
        f += (rng.standard_normal((H // 2, W // 2)).astype(np.float32).repeat(2, 0).repeat(2, 1)[..., None] * 0.012)
    return f


MODE = os.environ.get("MODE", "full")
if MODE in ("full", "video"):
    enc = Encoder(os.path.join(OUT, "video.mp4"))
    for n in range(int(DUR * FPS)):
        t = n / FPS
        f = frame(t)
        if n % 15 == 0:
            Image.fromarray((np.clip(f, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, f"p_{n:04d}.png"))
        enc.write(f)
    enc.close()
    print("video done")

# ============================================================ sound =============
mix = Mix(DUR)
t = np.arange(int(5.0 * SR)) / SR
drone = (np.sin(2 * np.pi * 55 * t) * 0.5 + np.sin(2 * np.pi * 82.4 * t) * 0.25) * np.minimum(1, t / 1.0) * np.clip((4.6 - t) / 0.8, 0, 1)
drone += flt(rng.standard_normal(len(t)), "low", 300) * 0.05 * np.minimum(1, t / 1.0) * np.clip((4.6 - t) / 0.8, 0, 1)
mix.place(0.0, drone, 0.35)


def ring(dur=2.2):
    tt = np.arange(int(dur * SR)) / SR
    s = sum(a * np.sin(2 * np.pi * fq * tt) * np.exp(-tt / d) for fq, a, d in
            [(2140, 0.5, 0.9), (3390, 0.35, 0.6), (5230, 0.25, 0.4), (7810, 0.12, 0.25)])
    return s * np.minimum(1, tt / 0.004)


mix.place(0.7, ring(), 0.22, pan=-0.2)
mix.place(1.8, ring(1.6) * 0.6, 0.12, pan=0.3)
# wind under the flag, gone by 7.3 (music «stops»)
tw = np.arange(int(3.4 * SR)) / SR
wind = flt(rng.standard_normal(len(tw)), "band", [200, 1400]) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.7 * tw))
wind *= np.minimum(1, tw / 0.6) * np.clip((3.3 - tw) / 0.9, 0, 1)
mix.place(4.0, np.stack([wind, np.roll(wind, 900)], 1), 0.12)
# 7.5 → 9.0 : true silence. 9.0 : one deep drum
td = np.arange(int(3.5 * SR)) / SR
fsweep = 45 + 75 * np.exp(-td / 0.06)
drum = np.sin(2 * np.pi * np.cumsum(fsweep) / SR) * np.exp(-td / 0.55)
drum += flt(rng.standard_normal(len(td)), "band", [80, 2500]) * np.exp(-td / 0.02) * 0.4
ir = rng.standard_normal(int(2.0 * SR)) * np.exp(-np.arange(int(2.0 * SR)) / SR / 0.5)
tail = np.convolve(flt(drum, "low", 1200), ir)[:len(td)] * 0.02
mix.place(9.0, drum + tail, 0.9)
# paper rustle at the cut, pencil scratches with the lines
tp = np.arange(int(0.5 * SR)) / SR
mix.place(9.02, flt(rng.standard_normal(len(tp)), "band", [1500, 7000]) * np.exp(-tp / 0.12), 0.10, pan=0.2)
for i in range(len(LINKS)):
    ts = np.arange(int(0.45 * SR)) / SR
    sc = flt(rng.standard_normal(len(ts)), "band", [2500, 8000]) * (0.5 + 0.5 * np.sin(2 * np.pi * 23 * ts) ** 2) * np.sin(np.pi * ts / 0.45)
    mix.place(11.0 + i * 0.22, sc, 0.035, pan=-0.4 + 0.12 * i)
# room tone on paper
tr = np.arange(int(4.0 * SR)) / SR
mix.place(9.0, flt(rng.standard_normal(len(tr)), "low", 500) * 0.02 * np.minimum(1, tr / 0.3), 1.0)
mix.save(os.path.join(OUT, "audio.wav"))
print("audio done")
