"""Teaser v3 soundtrack (new 28.3 s timeline).

usage: sound_v3.py <orig_stereo_f32le_48k.raw> <out.wav> [makeup_db]
Original audio: kept 0-6.68 s, dropped 6.68-11.6 s, back at 0.7 from new 11.6 s (= orig 12.3 s; new = orig - 0.7).
"""
import sys
import wave

import numpy as np
from scipy.ndimage import maximum_filter1d, uniform_filter1d
from scipy.signal import butter, resample_poly, sosfilt

SR = 48000
src_raw, out_wav = sys.argv[1], sys.argv[2]
MAKEUP_DB = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
rng = np.random.default_rng(1954)
DUR = 32.0
N = int(DUR * SR)

o = np.fromfile(src_raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)
orig = np.zeros((N, 2))
a = int(6.68 * SR)
orig[:a] = o[:a]
orig[a - 480:a] *= np.linspace(1, 0, 480)[:, None]
s0 = int(14.5 * SR)
st_ = int(15.6 * SR)
tail = o[s0:s0 + (N - st_)]
orig[st_:st_ + len(tail)] = tail
g = np.zeros(N)
g[:a] = 1
i0, i1 = st_, int(15.75 * SR)
g[i0:i1] = np.linspace(0, 0.7, i1 - i0)
g[i1:] = 0.7
orig *= g[:, None]


def flt(x, kind, f, order=4):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output="sos"), x, axis=0)


def bp(x, lo, hi, order=4): return flt(x, "band", [lo, hi], order)
def lp(x, f, order=4): return flt(x, "low", f, order)
def hp(x, f, order=4): return flt(x, "high", f, order)
def ex(n, tau): return np.exp(-np.arange(n) / SR / tau)
def nz(n): return rng.standard_normal(n)


def sm(a_, b, x):
    t = np.clip((x - a_) / (b - a_), 0, 1)
    return t * t * (3 - 2 * t)


def pan2(sig, p):
    an = (p + 1) * np.pi / 4
    return np.stack([sig * np.cos(an), sig * np.sin(an)], axis=1)


def place(buf, t0, sig, pan=0.0, gain=1.0):
    i = int(t0 * SR)
    if sig.ndim == 1:
        sig = pan2(sig, pan)
    if i < 0:
        sig, i = sig[-i:], 0
    j = min(N, i + len(sig))
    if j > i:
        buf[i:j] += gain * sig[: j - i]


def sweep_sine(n, f_fn):
    tt = np.arange(n) / SR
    return np.sin(2 * np.pi * np.cumsum(f_fn(tt)) / SR)


def reverb(sig, decay=1.2, mix=0.3, lpf=3000):
    n = int(decay * 1.5 * SR)
    irs = []
    for _ in range(2):
        ir = lp(nz(n), lpf) * ex(n, decay / 3)
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    m = sig if sig.ndim == 1 else sig.mean(axis=1)
    L = len(m) + n
    M = np.fft.rfft(m, L)
    wet = np.stack([np.fft.irfft(M * np.fft.rfft(ir, L), L) for ir in irs], axis=1)
    dry = pan2(np.pad(m, (0, n)), 0) if sig.ndim == 1 else np.pad(sig, ((0, n), (0, 0)))
    return dry * (1 - mix) + mix * wet


def crush(x, levels=24, hold=5):
    y = np.round(x * levels) / levels
    idx = (np.arange(len(y)) // hold) * hold
    return y[idx]


sfx = np.zeros((N, 2))

# =============================== HOOK 0 - 6.7 =================================
n = int(6.65 * SR)
tt = np.arange(n) / SR
env = sm(0, 0.4, tt) * (1 - sm(6.45, 6.65, tt))
drone = lp(nz(n), 130) * 2.6 + 0.22 * np.sin(2 * np.pi * 49 * tt) * (1 + 0.3 * np.sin(2 * np.pi * 0.35 * tt))
place(sfx, 0, np.stack([drone, np.roll(drone, 700)], 1) * env[:, None], gain=0.13)
for k, t0 in enumerate(np.arange(0.05, 5.4, 0.85)):          # heartbeat: lub-dub
    for d, gg in [(0, 1.0), (0.13, 0.65)]:
        m = int(0.4 * SR)
        place(sfx, t0 + d, sweep_sine(m, lambda t: 42 + 30 * np.exp(-t / 0.04)) * ex(m, 0.09), gain=0.42 * gg)
# metallic clink + short roll as the hero settles
m = int(0.9 * SR)
tm = np.arange(m) / SR
clink = sum(np.sin(2 * np.pi * f * tm) * ex(m, d) * a_ for f, d, a_ in
            [(2130, 0.35, 1), (3420, 0.22, 0.7), (5210, 0.12, 0.5), (7300, 0.06, 0.3)])
clink += hp(nz(m), 3000) * ex(m, 0.004) * 0.6
place(sfx, 0.22, reverb(clink, 1.0, 0.35, 6000), gain=0.10, pan=0.1)
place(sfx, 0.48, reverb(clink * 0.6, 1.0, 0.35, 6000), gain=0.07, pan=-0.2)
roll = bp(nz(int(0.5 * SR)), 1500, 5000) * (0.5 + 0.5 * np.sin(2 * np.pi * 23 * np.arange(int(0.5 * SR)) / SR)) * ex(int(0.5 * SR), 0.2)
place(sfx, 0.3, roll, gain=0.05)
# shimmer with each light sweep
for t0, dur, k in [(0.15, 1.1, 1.0), (3.3, 1.0, 0.6)]:
    m = int(dur * SR)
    u = np.arange(m) / m
    sh = hp(nz(m), 5000) * np.sin(np.pi * u) ** 2
    ch = (np.sin(2 * np.pi * 3520 * u * dur) + 0.6 * np.sin(2 * np.pi * 5280 * u * dur)) * np.sin(np.pi * u) ** 4
    place(sfx, t0, reverb(sh * 0.6 + ch * 0.25, 1.4, 0.45, 9000), gain=0.10 * k)


def artillery(dist=1.0):
    n = int(3.2 * SR)
    t = np.arange(n) / SR
    b = sweep_sine(n, lambda t: 32 + 40 * np.exp(-t / 0.15)) * ex(n, 0.55)
    rumble = lp(nz(n), 260) * ex(n, 0.9) * 2.5 * sm(0, 0.04, t)
    crack = lp(nz(n), 1800) * ex(n, 0.05)
    s = np.tanh(1.6 * (b + rumble + 0.6 * crack * (1 - 0.6 * dist)))
    return reverb(lp(s, 900 - 400 * dist), decay=2.5, mix=0.55, lpf=700)


def mg_burst(shots=9, gap=0.085):
    n = int((shots * gap + 1.2) * SR)
    s = np.zeros(n)
    for k in range(shots):
        i = max(0, int((k * gap + rng.uniform(-0.006, 0.006)) * SR))
        m = int(0.12 * SR)
        s[i:i + m] += (bp(nz(m), 300, 2500) * ex(m, 0.018) +
                       0.8 * np.sin(2 * np.pi * 90 * np.arange(m) / SR) * ex(m, 0.03)) * rng.uniform(0.7, 1)
    return reverb(lp(s, 1600), decay=1.8, mix=0.6, lpf=1200)


place(sfx, 2.4, artillery(1.0), gain=0.13)
place(sfx, 4.0, mg_burst(10), gain=0.06)
place(sfx, 4.9, artillery(0.85), gain=0.16)
place(sfx, 5.9, mg_burst(7, 0.075), gain=0.06)
# hero dissolve: reverse swell + sparkles
m = int(0.8 * SR)
u = np.arange(m) / m
place(sfx, 5.5, hp(nz(m), 2500) * u ** 2.5 * (1 - sm(0.92, 1, u)), gain=0.10)
for k in range(14):
    mm = int(0.12 * SR)
    place(sfx, 5.6 + 0.05 * k, np.sin(2 * np.pi * rng.uniform(4000, 7000) * np.arange(mm) / SR) * ex(mm, 0.03),
          pan=rng.uniform(-0.6, 0.6), gain=0.04)

# =============================== RELOAD + SHOT ================================
for t, f0 in [(6.70, 3200), (6.95, 2400)]:
    m = int(0.06 * SR)
    tm = np.arange(m) / SR
    click = bp(nz(m), 1500, 9000) * ex(m, 0.006)
    ring = (np.sin(2 * np.pi * f0 * tm) + 0.5 * np.sin(2 * np.pi * f0 * 1.51 * tm)) * ex(m, 0.012)
    thock = np.sin(2 * np.pi * 180 * tm) * ex(m, 0.015)
    place(sfx, t, reverb(0.45 * click + 0.16 * ring + 0.3 * thock, 0.8, 0.25, 5000), pan=-0.25, gain=0.9)
n = int(2.6 * SR)
tt = np.arange(n) / SR
shot = np.tanh(2.4 * (hp(nz(n), 2500) * ex(n, 0.004) + 0.95 * bp(nz(n), 160, 3500) * ex(n, 0.08) +
                      1.25 * sweep_sine(n, lambda t: 38 + 70 * np.exp(-t / 0.25)) * ex(n, 0.22))) / np.tanh(2.4)
place(sfx, 7.30, reverb(shot, decay=2.2, mix=0.35, lpf=1800), gain=0.6, pan=-0.35)
place(sfx, 7.30, sweep_sine(n, lambda t: 30 + 35 * np.exp(-t / 0.3)) * ex(n, 0.7) * sm(0, 0.01, tt), gain=0.5)

# whiz + riser 7.35 -> 9.23
T0, T1 = 7.35, 9.23
n = int((T1 - T0) * SR)
tt = np.arange(n) / SR
u = tt / tt[-1]
centre = 2600 + 1400 * u
w = np.zeros(n)
blk = 2048
nzz = nz(n + 2 * blk)
for s in range(0, n, blk):
    c = centre[min(s, n - 1)]
    seg = bp(nzz[s:s + 2 * blk], c * 0.7, c * 1.4, 2)[blk // 2:blk // 2 + blk]
    w[s:s + blk] = seg[:len(w[s:s + blk])]
whiz = (0.55 * w + 0.10 * sweep_sine(n, lambda t: 1800 + 900 * (t / tt[-1]) ** 2)) * (0.15 + 0.85 * u ** 2)
r0 = int((T1 - T0 - 0.9) * SR)
riser = np.zeros(n)
riser[r0:] = hp(nz(n - r0), 300) * (np.arange(n - r0) / (n - r0)) ** 2.5
rumble = lp(nz(n), 120) * (0.2 + 0.8 * u ** 3) * 2.2
fade = np.minimum(1, np.minimum(tt / 0.02, (tt[-1] - tt) / 0.012))
an = (-0.85 + 1.7 * u + 1) * np.pi / 4
place(sfx, T0, 0.4 * np.stack([(whiz * np.cos(an) + 0.5 * riser + 0.6 * rumble) * fade,
                                (whiz * np.sin(an) + 0.5 * riser + 0.6 * rumble) * fade], axis=1))

# =============================== TECH LIGHTNING 9.3 ===========================
T = 9.3
n = int(3.5 * SR)
tt = np.arange(n) / SR
sub = sweep_sine(n, lambda t: 26 + 80 * np.exp(-t / 0.1)) * ex(n, 1.1) * sm(0, 0.003, tt)
place(sfx, T, np.tanh(1.8 * sub) / np.tanh(1.8), gain=0.45)
blast = np.stack([lp(nz(n), 1800), lp(nz(n), 1800)], 1) * ex(n, 0.35)[:, None]
place(sfx, T, blast, gain=0.24)
m = int(0.35 * SR)
tm = np.arange(m) / SR
fc = 2200 * np.exp(-tm / 0.08) + 180
idx = 6 * np.exp(-tm / 0.1)
mod = np.sin(2 * np.pi * np.cumsum(fc * 1.41) / SR)
zap = np.sin(2 * np.pi * np.cumsum(fc) / SR + idx * mod) * ex(m, 0.12)
zap = crush(zap, 12, 6)
place(sfx, T, reverb(zap, 1.2, 0.3, 8000), gain=0.32)
chunk = zap[: int(0.04 * SR)]
for k in range(7):                                    # glitch stutter
    place(sfx, T + 0.07 + 0.045 * k, chunk * (0.8 ** k), pan=(-1) ** k * 0.5, gain=0.32)
clap = np.zeros((int(0.5 * SR), 2))
for _ in range(160):
    ts = rng.exponential(0.05)
    if ts > 0.35:
        continue
    i = int(ts * SR)
    mm = int(rng.uniform(0.002, 0.008) * SR)
    clap[i:i + mm] += pan2(hp(nz(mm), 1500) * ex(mm, 0.002) * np.exp(-ts / 0.12) * rng.uniform(0.3, 1),
                           rng.uniform(-0.8, 0.8))
place(sfx, T, clap, gain=0.38)
# digital arcs on the rays 9.35 -> 11.6
t_a0, t_a1 = 9.35, 10.6
n3 = int((t_a1 - t_a0) * SR)
t3 = np.arange(n3) / SR
dec3 = np.exp(-t3 / 0.9) * (1 - sm(t_a1 - t_a0 - 0.3, t_a1 - t_a0, t3))
gate = np.zeros(n3)
k = 0.0
while k < t_a1 - t_a0:
    k += rng.exponential(1 / 60)
    i = int(k * SR)
    mm = int(rng.uniform(0.004, 0.03) * SR)
    if i + mm < n3:
        gate[i:i + mm] += rng.uniform(0.3, 1.0) * np.hanning(mm)
buzz = crush(np.sign(np.sin(2 * np.pi * 110 * t3)) * 0.35 + bp(nz(n3), 2500, 9000), 10, 4)
arcs = np.zeros((n3, 2))
p = 0.0
for s in range(0, n3, 4800):
    p = np.clip(p + rng.uniform(-0.6, 0.6), -0.9, 0.9)
    seg = (buzz * gate * dec3)[s:s + 4800]
    arcs[s:s + len(seg)] += pan2(seg, p)
place(sfx, t_a0, reverb(arcs, 0.8, 0.25, 7000), gain=0.30)

# =============================== TECH HITS ON WORDS ===========================
def tech_hit(root, big=1.0):
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    kick = sweep_sine(n, lambda t: 48 + 120 * np.exp(-t / 0.03)) * ex(n, 0.32 * big)
    cl = np.zeros(n)
    for d in (0, 0.009, 0.018):
        i = int(d * SR)
        mm = int(0.03 * SR)
        cl[i:i + mm] += bp(nz(mm), 900, 3500) * ex(mm, 0.007)
    saw = sum(((t * f) % 1.0) * 2 - 1 for f in (root, root * 1.5, root * 2, root * 3.01))
    cut = 600 + 3400 * np.exp(-t / 0.18)
    stab = np.zeros(n)
    blk = 1024
    for s in range(0, n, blk):
        seg = lp(saw[max(0, s - blk):s + blk], cut[s])[-min(blk, n - s):]
        stab[s:s + len(seg)] = seg
    stab *= ex(n, 0.38 * big) * 0.25
    mix = np.tanh(1.6 * (1.3 * kick + 0.5 * cl)) + stab
    return reverb(mix, 1.4 * big, 0.3, 5000)


for t, root, gn in [(9.9, 110, 0.5), (11.2, 130.8, 0.5), (12.5, 146.8, 0.55), (13.8, 164.8, 0.6)]:
    place(sfx, t - 0.01, tech_hit(root), gain=gn)
n4 = int(0.42 * SR)
u4 = np.arange(n4) / n4
place(sfx, 15.30 - 0.42, hp(nz(n4), 400) * u4 ** 3 * 0.6 + lp(nz(n4), 150) * u4 ** 2 * 1.5, gain=0.45)
place(sfx, 15.29, tech_hit(110, 1.5), gain=0.65)

# =============================== CROWD (synth) ================================
def crowd(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for lo, hi, gn in [(250, 800, 1.0), (800, 2000, 0.8), (2000, 4200, 0.45)]:
        for ch in range(2):
            am = lp(nz(n), 1.5, 2)
            am = 0.6 + 0.4 * am / (np.abs(am).max() + 1e-9)
            out[:, ch] += bp(nz(n), lo, hi, 2) * am * gn
    vowels = [(800, 1200), (500, 1800), (500, 900), (650, 1100)]
    for _ in range(int(dur * 28)):                    # individual shouting voices
        st = rng.uniform(0, dur - 0.3)
        d = rng.uniform(0.35, 1.3)
        m = int(min(d, dur - st) * SR)
        tm = np.arange(m) / SR
        f0 = rng.uniform(140, 340)
        contour = f0 * (1 + 0.12 * np.sin(np.pi * tm / tm[-1]) + 0.02 * np.sin(2 * np.pi * 5.5 * tm))
        ph = np.cumsum(contour) / SR
        src = (ph % 1.0) * 2 - 1
        f1, f2 = vowels[rng.integers(len(vowels))]
        v = bp(src, f1 * 0.8, f1 * 1.2, 2) + 0.6 * bp(src, f2 * 0.85, f2 * 1.15, 2)
        envv = np.minimum(1, tm / 0.06) * np.minimum(1, (tm[-1] - tm) / 0.25)
        i = int(st * SR)
        out[i:i + m] += pan2(v * envv * rng.uniform(0.2, 0.7), rng.uniform(-0.9, 0.9))
    k = 0.0
    while k < dur - 0.05:                              # claps
        k += rng.exponential(1 / 22)
        i = int(k * SR)
        mm = int(0.012 * SR)
        if i + mm < n:
            out[i:i + mm] += pan2(bp(nz(mm), 1000, 3500) * ex(mm, 0.003) * rng.uniform(0.3, 1), rng.uniform(-1, 1)) * 1.5
    for _ in range(4):                                 # whistles
        st = rng.uniform(0.3, dur - 1.5)
        m = int(rng.uniform(0.5, 0.9) * SR)
        tm = np.arange(m) / SR
        f = rng.uniform(2200, 2900)
        wv = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.15 * tm / tm[-1]) + 30 * np.sin(2 * np.pi * 6 * tm)) / SR)
        out[int(st * SR):int(st * SR) + m] += pan2(wv * np.sin(np.pi * tm / tm[-1]) * 0.25, rng.uniform(-0.7, 0.7))
    out = lp(out, 5500)
    return reverb(out, 1.8, 0.45, 3500)


CR0, CR1 = 9.9, 30.1
cr = crowd(CR1 - CR0)
tc = np.arange(len(cr)) / SR + CR0
ce = np.interp(tc, [9.9, 11.2, 13.8, 15.3, 15.9, 16.4, 19.4, 19.9, 20.8, 25.6, 26.4, 27.8, 29.0, 30.1],
               [0.0, 0.3, 0.6, 1.0, 1.0, 0.42, 0.42, 0.75, 0.45, 0.45, 1.0, 0.95, 0.3, 0.0])
cr = cr / (np.sqrt(np.mean(cr ** 2)) + 1e-9) * 0.06
place(sfx, CR0, cr * ce[:, None])

# =============================== LOGO / BUTTONS / CTA =========================
# spark crackle following the spark on the logo (14.3 -> 15.25)
n5 = int(0.95 * SR)
t5 = np.arange(n5) / SR
spk = hp(nz(n5), 4000) * 0.25
k = 0.0
while k < 0.95:
    k += rng.exponential(1 / 90)
    i = int(k * SR)
    mm = int(0.003 * SR)
    if i + mm < n5:
        spk[i:i + mm] += hp(nz(mm), 2500) * rng.uniform(0.4, 1.2)
spk *= np.sin(np.pi * t5 / t5[-1]) ** 0.5
an5 = np.linspace(-0.6, 0.6, n5)
place(sfx, 16.1, np.stack([spk * np.cos((an5 + 1) * np.pi / 4), spk * np.sin((an5 + 1) * np.pi / 4)], 1), gain=0.22)
# ignite whoosh + shimmers on light sweeps
for t0, dur, k in [(17.05, 0.6, 1.0), (19.95, 0.5, 0.8), (26.0, 0.6, 0.8), (26.7, 0.6, 0.8), (28.4, 0.6, 0.6)]:
    m = int(dur * SR)
    u = np.arange(m) / m
    sh = hp(nz(m), 4500) * np.sin(np.pi * u) ** 2
    ch = np.sin(2 * np.pi * 4186 * u * dur) * np.sin(np.pi * u) ** 4
    place(sfx, t0, reverb(sh * 0.6 + ch * 0.2, 1.2, 0.4, 9000), gain=0.10 * k)


def button(cyan=True):
    m = int(0.25 * SR)
    tm = np.arange(m) / SR
    click = bp(nz(m), 2000, 7000) * ex(m, 0.003) + 0.6 * np.sin(2 * np.pi * 320 * tm) * ex(m, 0.012)
    f = 1500 if cyan else 1000
    blip = np.zeros(m)
    i = int(0.07 * SR)
    mm = m - i
    blip[i:] = np.sin(2 * np.pi * np.cumsum(f + 600 * np.minimum(1, np.arange(mm) / (0.04 * SR))) / SR) * ex(mm, 0.06)
    return click * 0.8 + blip * 0.35


for i in range(8):
    place(sfx, 16.55 + 0.13 * i, button(i < 4), pan=-0.4 if i < 4 else 0.4, gain=0.28)
for i in range(8):
    place(sfx, 19.85 + 0.004 * i, button(i < 4), pan=-0.4 if i < 4 else 0.4, gain=0.12)
place(sfx, 19.85, tech_hit(110, 1.2), gain=0.4)
for i in range(8):
    place(sfx, 26.45 + 0.08 * i, button(i < 4), pan=-0.4 if i < 4 else 0.4, gain=0.22)
# CTA: box slam, then final boom with a reverse swell into it
place(sfx, 26.37, tech_hit(98, 1.4), gain=0.6)
n6 = int(0.45 * SR)
u6 = np.arange(n6) / n6
place(sfx, 27.27 - 0.45, hp(nz(n6), 1500) * u6 ** 3, gain=0.18)
n7 = int(2.6 * SR)
boom = sweep_sine(n7, lambda t: 30 + 45 * np.exp(-t / 0.1)) * ex(n7, 0.9)
place(sfx, 27.27, np.tanh(1.6 * boom) / np.tanh(1.6), gain=0.6)
place(sfx, 27.27, tech_hit(82.4, 1.6), gain=0.5)

# =============================== "يتبع..." ======================================
for k in range(7):
    m = int(0.08 * SR)
    tm = np.arange(m) / SR
    tw = bp(nz(m), 1800, 6500) * ex(m, 0.006) + 0.7 * np.sin(2 * np.pi * 260 * tm) * ex(m, 0.012)
    place(sfx, 30.2 + k * (0.8 / 6) + rng.uniform(-0.01, 0.01), tw, pan=rng.uniform(-0.15, 0.15), gain=0.22)
n8 = int(1.0 * SR)
place(sfx, 31.0, np.tanh(1.6 * sweep_sine(n8, lambda t: 28 + 40 * np.exp(-t / 0.1)) * ex(n8, 0.6)) / np.tanh(1.6), gain=0.55)
place(sfx, 31.0, tech_hit(73.4, 1.2), gain=0.35)

# =============================== MIX + LIMITER ================================
sfx = lp(sfx, 15500, 6)
mix = (orig + 0.7 * sfx) * 10 ** (MAKEUP_DB / 20)
fo = int(0.25 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
thr = 10 ** (-2.0 / 20)
up = np.abs(resample_poly(mix, 4, 1, axis=0)).max(axis=1)
tp_lvl = up[:4 * N].reshape(N, 4).max(axis=1)
la = int(0.003 * SR)
gr = np.minimum(1.0, thr / np.maximum(maximum_filter1d(tp_lvl, size=4 * la + 1), 1e-9))
gr = uniform_filter1d(gr, size=2 * la + 1)
rel = np.exp(-1 / (0.08 * SR))
smg = np.empty_like(gr)
cur = 1.0
for i in range(N):
    cur = gr[i] if gr[i] < cur else rel * cur + (1 - rel) * gr[i]
    smg[i] = cur
mix *= smg[:, None]
for sec in range(0, N, SR // 2):
    v = 20 * np.log10(smg[sec:sec + SR // 2].min())
    if v < -4:
        print(f"  GR {sec / SR:5.2f}s {v:.1f} dB")
pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2")
with wave.open(out_wav, "wb") as wf:
    wf.setnchannels(2)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    wf.writeframes(pcm.tobytes())
print(f"ok max gain reduction={20 * np.log10(smg.min()):.1f} dB")
