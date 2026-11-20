"""Opener «من الخلية للاندلاع» v1 (bullet + teaser sparks + logo flicker, beams from the logo) — full 8.5 s render (16:9 1920x1080, 30 fps) + sound design (no music).
run from repo root: python3 edprod/projects/2026-11-04-tamhid-opener/render.py
"""
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from opener_lib import *  # noqa

OUT = "out/tamhid-opener/v1-bullet"
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
    elif t < 4.6:
        p = (t - 3.9) / 0.7
        f += HC_CRACK[int(round(ease_out(p) * 10))] * 0.7 * (1 - 0.6 * p)
        for name, dx, dy in (("ring", 0, 0), ("hanger", 0, -150), ("shirt_l", -170, 30), ("shirt_r", 170, 30), ("text", 0, 120)):
            kh_layer(f, name, dx=dx * ease_out(p), dy=dy * ease_out(p), a=(1 - p) * 0.8, s=1 + 0.35 * ease_out(p))
        r = 900 * ease_out(min(1, p * 1.6))
        m = np.clip((r - SPK_R) / 60, 0, 1)[..., None]
        f += SPK * m * (1 - 0.7 * p)
        if t < 4.0:
            f += (1 - (t - 3.9) / 0.1) * 0.85
        if t < 4.08:
            shake = (rng2.uniform(-9, 9), rng2.uniform(-6, 6))
        z = 1.03
    elif t < 5.4:
        p = (t - 4.6) / 0.8
        f += HC_CRACK[10] * 0.22 * (1 - p)
        glow(f, *HEX_C, 420, (255, 200, 150), 0.35 * (1 - 0.5 * p))
        on = not (0.05 < t - 4.6 < 0.11 or 0.17 < t - 4.6 < 0.21)
        if on:
            w = LOGO_MID_W * lerp(0.9, 1.0, ease_out(p))
            lg = scaled(LOGO, w / LOGO.shape[1])
            over(f, lg, CX - lg.shape[1] / 2, HEX_C[1] - lg.shape[0] / 2, min(1, (t - 4.6) / 0.05))
        z = lerp(1.03, 1.0, ease_io(p))
    else:
        # frame drawing + logo to its slot, then master
        p = ease_io(min(1, (t - 5.4) / 1.2))
        f = frame_reveal(p * 1.01)
        if t < 6.75:
            w = lerp(LOGO_MID_W, LOGO_END_W, p)
            cx, cy = lerp(LOGO_MID_C[0], LOGO_END_C[0], p), lerp(LOGO_MID_C[1], LOGO_END_C[1], p)
            lg = scaled(LOGO, w / LOGO.shape[1])
            over(f, lg, cx - lg.shape[1] / 2, cy - lg.shape[0] / 2, 1 - ease_io((t - 6.55) / 0.2))
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
    if os.environ.get("MASTER") == "1":   # high-quality master: ProRes 422 HQ, 10-bit, no H.264 generation loss
        class _ProRes:
            def __init__(self, path):
                self.p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb48le", "-s", f"{W2}x{H2}",
                                           "-r", str(FPS), "-i", "-", "-c:v", "prores_ks", "-profile:v", "3", "-pix_fmt", "yuv422p10le",
                                           "-vendor", "apl0", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", path],
                                          stdin=subprocess.PIPE)

            def write(self, f):
                self.p.stdin.write((np.clip(f, 0, 1) * 65535 + 0.5).astype("<u2").tobytes())

            def close(self):
                self.p.stdin.close()
                self.p.wait()
        enc = _ProRes(os.path.join(OUT, "master_prores.mov"))
    else:
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
mix.place(4.5, whoosh(0.9), 0.35)
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
