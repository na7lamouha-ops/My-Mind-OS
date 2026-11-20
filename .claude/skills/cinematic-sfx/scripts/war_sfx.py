"""War / power sound design v2 for the teaser.

usage: war_sfx.py <orig_stereo_f32le_48k.raw> <out.wav> [makeup_db]

Timeline (s):
  5.0 - 9.9   war bed: low drone, distant artillery, distant machine-gun bursts (under the typewriter)
  7.45        bolt-action rack
  7.80        rifle shot + cinematic sub boom
  8.0 - 9.93  bullet whiz L->R + riser
  9.93-10.0   suck-out silence
 10.00        explosion + lightning clap
 10.05-12.3   electric arcs on the rays + rolling thunder
 11.07 11.77 12.47 13.17   war-drum hits on each word
 13.4 -> 13.80  short riser into the big flash hit
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

orig = np.fromfile(src_raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)
N = len(orig)


def flt(x, kind, f, order=4):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output="sos"), x, axis=0)


def bp(x, lo, hi, order=4):
    return flt(x, "band", [lo, hi], order)


def lp(x, f, order=4):
    return flt(x, "low", f, order)


def hp(x, f, order=4):
    return flt(x, "high", f, order)


def ex(n, tau):
    return np.exp(-np.arange(n) / SR / tau)


def nz(n):
    return rng.standard_normal(n)


def sm(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def pan2(sig, p):
    a = (p + 1) * np.pi / 4
    return np.stack([sig * np.cos(a), sig * np.sin(a)], axis=1)


def place(buf, t0, sig, pan=0.0, gain=1.0):
    i = int(t0 * SR)
    if sig.ndim == 1:
        sig = pan2(sig, pan)
    j = min(N, i + len(sig))
    if j > i:
        buf[i:j] += gain * sig[: j - i]


def sweep_sine(n, f_fn):
    tt = np.arange(n) / SR
    return np.sin(2 * np.pi * np.cumsum(f_fn(tt)) / SR)


def reverb(sig, decay=1.2, mix=0.3, lpf=3000):
    """cheap stereo reverb: decaying filtered noise convolution (FFT)."""
    n = int(decay * 1.5 * SR)
    irL = lp(nz(n), lpf) * ex(n, decay / 6.9 * 2.3)
    irR = lp(nz(n), lpf) * ex(n, decay / 6.9 * 2.3)
    irL /= np.sqrt(np.sum(irL ** 2))
    irR /= np.sqrt(np.sum(irR ** 2))
    m = sig if sig.ndim == 1 else sig.mean(axis=1)
    L = np.fft.irfft(np.fft.rfft(m, len(m) + n) * np.fft.rfft(irL, len(m) + n), len(m) + n)
    R = np.fft.irfft(np.fft.rfft(m, len(m) + n) * np.fft.rfft(irR, len(m) + n), len(m) + n)
    dry = pan2(np.pad(m, (0, n)), 0) if sig.ndim == 1 else np.pad(sig, ((0, n), (0, 0)))
    return dry * (1 - mix) + mix * np.stack([L, R], axis=1)


sfx = np.zeros((N, 2))

# ============ war bed (5.0 - 9.9) ============================================
t0, t1 = 5.0, 9.9
n = int((t1 - t0) * SR)
tt = np.arange(n) / SR
env = sm(0, 1.2, tt) * (1 - sm(t1 - t0 - 0.12, t1 - t0, tt)) * (0.55 + 0.45 * sm(1.5, 4.5, tt))
drone = lp(nz(n), 140) * 3.0 + 0.25 * np.sin(2 * np.pi * 49 * tt) * (1 + 0.3 * np.sin(2 * np.pi * 0.4 * tt))
wind = bp(nz(n), 300, 1200, 2) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.23 * tt + 1)) * 0.18
place(sfx, t0, np.stack([drone + wind, drone + np.roll(wind, 900)], axis=1) * env[:, None], gain=0.12)


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
        pop = (bp(nz(m), 300, 2500) * ex(m, 0.018) + 0.8 * np.sin(2 * np.pi * 90 * np.arange(m) / SR) * ex(m, 0.03))
        s[i:i + m] += pop * rng.uniform(0.7, 1.0)
    return reverb(lp(s, 1600), decay=1.8, mix=0.6, lpf=1200)


place(sfx, 5.35, artillery(1.0), gain=0.16)
place(sfx, 6.05, mg_burst(10), gain=0.07)
place(sfx, 6.55, artillery(0.8), gain=0.2)
place(sfx, 7.02, mg_burst(7, 0.075), gain=0.06)
place(sfx, 7.25, artillery(0.9), gain=0.16)

# ============ bolt rack (7.45) ===============================================
for t, f0 in [(7.45, 3200), (7.60, 2400)]:
    m = int(0.05 * SR)
    tt = np.arange(m) / SR
    click = bp(nz(m), 1500, 9000) * ex(m, 0.006)
    ring = (np.sin(2 * np.pi * f0 * tt) + 0.5 * np.sin(2 * np.pi * f0 * 1.51 * tt)) * ex(m, 0.012)
    place(sfx, t, 0.4 * click + 0.14 * ring, pan=-0.3)

# ============ rifle shot + sub boom (7.80) ===================================
n = int(2.6 * SR)
tt = np.arange(n) / SR
crack = hp(nz(n), 2500) * ex(n, 0.004)
body = bp(nz(n), 160, 3500) * ex(n, 0.08)
thump = sweep_sine(n, lambda t: 38 + 70 * np.exp(-t / 0.25)) * ex(n, 0.22)
shot = np.tanh(2.4 * (crack + 0.95 * body + 1.25 * thump)) / np.tanh(2.4)
place(sfx, 7.80, reverb(shot, decay=2.2, mix=0.35, lpf=1800), gain=0.6)
sub = sweep_sine(n, lambda t: 30 + 35 * np.exp(-t / 0.3)) * ex(n, 0.7) * sm(0, 0.01, tt)
place(sfx, 7.80, sub, gain=0.5)

# ============ whiz + riser (8.0 - 9.93) ======================================
T0, T1 = 8.00, 9.93
n = int((T1 - T0) * SR)
tt = np.arange(n) / SR
u = tt / tt[-1]
centre = 2600 + 1400 * u
w = np.zeros(n)
blk = 2048
nzz = nz(n + 2 * blk)
for s in range(0, n, blk):
    c = centre[min(s, n - 1)]
    seg = bp(nzz[s: s + 2 * blk], c * 0.7, c * 1.4, 2)[blk // 2: blk // 2 + blk]
    w[s: s + blk] = seg[: len(w[s: s + blk])]
whistle = sweep_sine(n, lambda t: 1800 + 900 * (t / tt[-1]) ** 2)
whiz = (0.55 * w + 0.10 * whistle) * (0.15 + 0.85 * u ** 2)
r0 = int((T1 - T0 - 0.9) * SR)
riser = np.zeros(n)
riser[r0:] = hp(nz(n - r0), 300) * (np.arange(n - r0) / (n - r0)) ** 2.5
rumble = lp(nz(n), 120) * (0.2 + 0.8 * u ** 3) * 2.2
fade = np.minimum(1, np.minimum(tt / 0.02, (tt[-1] - tt) / 0.012))
a = (-0.85 + 1.7 * u + 1) * np.pi / 4
place(sfx, T0, 0.4 * np.stack([(whiz * np.cos(a) + 0.5 * riser + 0.6 * rumble) * fade,
                                 (whiz * np.sin(a) + 0.5 * riser + 0.6 * rumble) * fade], axis=1))

# ============ explosion + lightning clap (10.0) ==============================
T = 10.0
n = int(4.0 * SR)
tt = np.arange(n) / SR
sub = sweep_sine(n, lambda t: 28 + 50 * np.exp(-t / 0.12)) * ex(n, 1.0) * sm(0, 0.004, tt)
blast = np.stack([lp(nz(n), 2000), lp(nz(n), 2000)], axis=1) * ex(n, 0.5)[:, None]
core = np.tanh(1.8 * (1.4 * sub[:, None] + 0.75 * blast)) / np.tanh(1.8)
place(sfx, T, core, gain=0.6)
# lightning clap: dense cluster of sharp tearing crackles in the first ~180 ms
clap = np.zeros((n, 2))
for _ in range(220):
    ts = rng.exponential(0.05)
    if ts > 0.35:
        continue
    i = int(ts * SR)
    m = int(rng.uniform(0.002, 0.009) * SR)
    c = hp(nz(m), 1200) * ex(m, 0.002) * np.exp(-ts / 0.12) * rng.uniform(0.3, 1)
    clap[i:i + m] += pan2(c, rng.uniform(-0.8, 0.8))
tear = hp(nz(n), 900) * ex(n, 0.09) * sm(0, 0.003, tt)
clap += pan2(tear, 0) * 0.8
place(sfx, T, clap, gain=0.55)

# rolling thunder: low noise with irregular slow swells, 0.25 s -> 3.8 s
n2 = int(3.8 * SR)
t2 = np.arange(n2) / SR
lfo = np.zeros(n2)
for c_t, wdt, amp in [(0.35, 0.25, 1.0), (0.9, 0.35, 0.8), (1.5, 0.4, 0.65), (2.2, 0.5, 0.45), (2.9, 0.6, 0.3)]:
    lfo += amp * np.exp(-((t2 - c_t) / wdt) ** 2)
thL = lp(nz(n2), 380) * lfo * 3.2
thR = lp(nz(n2), 380) * np.roll(lfo, 2400) * 3.2
place(sfx, T + 0.15, reverb(np.stack([thL, thR], axis=1), decay=2.0, mix=0.4, lpf=500), gain=0.38)

# electric arcs on the rays (10.05 -> 12.3): gated HF crackle + mains-like buzz
t_a0, t_a1 = 10.05, 12.3
n3 = int((t_a1 - t_a0) * SR)
t3 = np.arange(n3) / SR
decay = np.exp(-t3 / 0.9) * (1 - sm(t_a1 - t_a0 - 0.3, t_a1 - t_a0, t3))
gate = np.zeros(n3)
k = 0.0
while k < t_a1 - t_a0:
    k += rng.exponential(1 / 70)
    i = int(k * SR)
    m = int(rng.uniform(0.004, 0.03) * SR)
    if i + m < n3:
        gate[i:i + m] += rng.uniform(0.3, 1.0) * np.hanning(m)
buzz = np.sign(np.sin(2 * np.pi * 110 * t3)) * 0.35 + bp(nz(n3), 2500, 9000) * 1.2
arcs = np.zeros((n3, 2))
p = rng.uniform(-1, 1)
for s in range(0, n3, 4800):
    p = np.clip(p + rng.uniform(-0.6, 0.6), -0.9, 0.9)
    seg = (buzz * gate * decay)[s:s + 4800]
    arcs[s:s + len(seg)] += pan2(seg, p)
place(sfx, t_a0, reverb(arcs, decay=0.8, mix=0.25, lpf=6000), gain=0.42)

# ============ war drums on each word =========================================
def war_drum(size=1.0):
    n = int(2.0 * SR)
    t = np.arange(n) / SR
    body = sweep_sine(n, lambda t: (52 + 45 * np.exp(-t / 0.05)) / size ** 0.3) * ex(n, 0.35 * size)
    skin = bp(nz(n), 150, 1500) * ex(n, 0.03)
    slap = hp(nz(n), 2000) * ex(n, 0.006)
    d = np.tanh(2.0 * (1.2 * body + 0.5 * skin + 0.3 * slap))
    return reverb(d, decay=1.6 * size, mix=0.32, lpf=2500)


for t, sz, gn in [(11.07, 1.0, 0.5), (11.77, 1.0, 0.5), (12.47, 1.05, 0.55), (13.17, 1.15, 0.6)]:
    place(sfx, t - 0.01, war_drum(sz), gain=gn)

# short riser into the flash at 13.80, then big hit
n4 = int(0.42 * SR)
u4 = np.arange(n4) / n4
place(sfx, 13.80 - 0.42, hp(nz(n4), 400) * u4 ** 3 * 0.6 + lp(nz(n4), 150) * u4 ** 2 * 1.5, gain=0.5)
place(sfx, 13.79, war_drum(1.4), gain=0.65)
n5 = int(2.5 * SR)
place(sfx, 13.79, sweep_sine(n5, lambda t: 30 + 40 * np.exp(-t / 0.1)) * ex(n5, 0.8), gain=0.45)

# ============ original-track gain envelope ====================================
g = np.ones(N)


def ramp(a, b, v0, v1):
    i0, i1 = int(a * SR), int(b * SR)
    g[i0:i1] = np.linspace(v0, v1, i1 - i0)


ramp(7.76, 7.80, 1, 0)
g[int(7.80 * SR): int(12.30 * SR)] = 0     # old whoosh, ticks and sparkle chimes removed
ramp(12.30, 12.45, 0, 1)

sfx = lp(sfx, 15000, 6)
mix = (orig * g[:, None] + 0.7 * sfx) * 10 ** (MAKEUP_DB / 20)

# ============ true-peak look-ahead limiter at -2 dBTP =========================
thr = 10 ** (-2.0 / 20)
up = np.abs(resample_poly(mix, 4, 1, axis=0)).max(axis=1)
tp_lvl = up[: 4 * N].reshape(N, 4).max(axis=1)
la = int(0.003 * SR)
gr = np.minimum(1.0, thr / np.maximum(maximum_filter1d(tp_lvl, size=4 * la + 1), 1e-9))
gr = uniform_filter1d(gr, size=2 * la + 1)
rel = np.exp(-1 / (0.08 * SR))
smg = np.empty_like(gr)
cur = 1.0
for i in range(N):
    cur = gr[i] if gr[i] < cur else rel * cur + (1 - rel) * gr[i]
    smg[i] = cur
mix = mix * smg[:, None]
tp = 20 * np.log10(np.abs(resample_poly(mix, 4, 1, axis=0)).max())

pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2")
with wave.open(out_wav, "wb") as wf:
    wf.setnchannels(2)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    wf.writeframes(pcm.tobytes())
for sec in range(0, N, SR // 4):
    v = 20 * np.log10(smg[sec:sec + SR // 4].min())
    if v < -3: print(f"  GR {sec / SR:5.2f}s {v:.1f} dB")
print(f"ok true-peak={tp:.2f} dBTP  max gain reduction={20*np.log10(smg.min()):.1f} dB")
