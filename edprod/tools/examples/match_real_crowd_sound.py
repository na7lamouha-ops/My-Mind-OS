"""«الماتش» v2 sound with REAL crowd recordings (CC0 1.0, Freesound via brandon2196-oss/spelling-slugger AUDIO-CREDITS.md).

usage: match_v2_realcrowd.py <crowd_raw_dir> <out.wav>
Timeline matches match_v2.py: passes 1.1 / 2.1 / 2.75, shot 2.9, goal 3.2, armband 3.4,
attack 2 passes 5.7 / 6.4, ball stops at التأكيد 7.0.
"""
import sys
import wave

import numpy as np
from scipy.ndimage import maximum_filter1d, uniform_filter1d
from scipy.signal import butter, resample_poly, sosfilt

A, OUTF = sys.argv[1:3]
SR, DUR = 48000, 10.0
N = int(DUR * SR)
rng = np.random.default_rng(9)


def load(name):
    return np.fromfile(f"{A}/{name}.raw", dtype=np.float32).reshape(-1, 2)[:, 0].astype(np.float64)


def flt(x, kind, fq, order=4): return sosfilt(butter(order, fq, btype=kind, fs=SR, output="sos"), x, axis=0)
def ex(n, tau): return np.exp(-np.arange(n) / SR / tau)
def nz(n): return rng.standard_normal(n)
def rms(x): return np.sqrt(np.mean(x ** 2)) + 1e-9


def wide(m, width=0.6):
    """mono -> stereo: Haas delay + complementary tilt so a mono crowd feels like a stadium."""
    d = int(0.013 * SR)
    l = m
    r = np.concatenate([np.zeros(d), m[:-d]])
    l = l + 0.15 * flt(l, "high", 2500)
    r = r + 0.15 * flt(r, "low", 800)
    mid = (l + r) / 2
    side = (l - r) / 2 * width
    return np.stack([mid + side, mid - side], 1)


def clip(x, t0, t1, fi=0.03, fo=0.25):
    a = x[int(t0 * SR):int(t1 * SR)].copy()
    n = len(a)
    a[:int(fi * SR)] *= np.linspace(0, 1, int(fi * SR))
    a[n - int(fo * SR):] *= np.linspace(1, 0, int(fo * SR))
    return a


out = np.zeros((N + 3 * SR, 2))


def place(t0, sig, gain=1.0, pan=0.0):
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(a), sig * np.sin(a)], 1)
    i = int(t0 * SR)
    out[i:i + len(sig)] += gain * sig


# ---------------------------------------------------------------- crowd -------
amb_lo, amb_hi = load("ambience-low"), load("ambience-high")
bed = wide(amb_lo[int(3 * SR):int(3 * SR) + N] / rms(amb_lo), 0.7) * 0.050
bed_hi = wide(amb_hi[int(2 * SR):int(2 * SR) + N] / rms(amb_hi), 0.7)
tt = np.arange(N) / SR
lvl_hi = np.interp(tt, [0, 0.5, 2.9, 3.2, 4.4, 5.2, 6.6, 7.0, 7.4, 10], [0.2, 0.35, 0.6, 0.9, 0.4, 0.45, 0.6, 0.3, 0.15, 0.15])
place(0, bed)
place(0, bed_hi * lvl_hi[:, None] * 0.045)

small = [load("cheer-small-1"), load("cheer-small-2"), load("cheer-small-3")]
# a short real cheer on every completed pass, a little bigger each time
for k, (t0, g, src) in enumerate([(1.1, 0.75, 0), (2.1, 0.9, 1), (2.75, 1.0, 2), (5.7, 0.8, 0), (6.4, 0.9, 1)]):
    s = small[src]
    c = clip(s, 0.0, min(len(s) / SR, 1.5), 0.02, 0.4)
    place(t0 - 0.05, wide(c / rms(c), 0.6), gain=0.07 * g)

# GOAL: big cheer + arena roar with whistles, layered
big = load("cheer-big-1")
hr = load("cheer-hr-2")
place(3.15, wide(clip(big, 0, 3.5, 0.01, 0.8) / rms(big), 0.8), gain=0.12)
place(3.2, wide(clip(hr, 0.3, 4.6, 0.05, 1.2) / rms(hr), 0.8), gain=0.08)

# the ball stops at التأكيد: real disappointed «أووه» + angry whistling
g3, g2 = load("groan-3"), load("groan-2")
place(7.0, wide(clip(g3, 0, 2.5, 0.01, 0.6) / rms(g3), 0.6), gain=0.11)
place(7.15, wide(clip(g2, 0, 3.0, 0.02, 0.8) / rms(g2), 0.6), gain=0.08)


def fan_whistle(dur, f, shape):
    m = int(dur * SR)
    tm = np.arange(m) / SR
    fp = {0: f * (1 + 0.25 * tm / tm[-1]), 1: f * (1 + 0.2 * np.sin(np.pi * tm / tm[-1])), 2: f * (1 - 0.18 * tm / tm[-1])}[shape]
    w = np.sin(2 * np.pi * np.cumsum(fp * (1 + 0.01 * np.sin(2 * np.pi * 7 * tm))) / SR) + 0.05 * flt(nz(m), "band", [1500, 5000])
    return w * np.minimum(1, tm / 0.03) * np.minimum(1, (tm[-1] - tm) / 0.06)


for _ in range(26):   # two-finger whistles from the stands (synthetic, kept under the real crowd)
    place(7.05 + rng.uniform(0, 2.2), fan_whistle(rng.uniform(0.35, 0.9), rng.uniform(1900, 3100), int(rng.integers(3))),
          gain=0.012 * rng.uniform(0.5, 1.0), pan=rng.uniform(-1, 1))

# ---------------------------------------------------------------- ball & fx ---
def kick(strong=1.0):
    n = int(0.3 * SR)
    tm = np.arange(n) / SR
    return (np.sin(2 * np.pi * np.cumsum(60 + 90 * np.exp(-tm / 0.02)) / SR) * ex(n, 0.05 * strong) +
            0.45 * flt(nz(n), "band", [800, 4000]) * ex(n, 0.008))


def net():
    n = int(0.7 * SR)
    return flt(nz(n), "band", [1500, 6000]) * ex(n, 0.14) * (1 + 0.5 * np.sin(2 * np.pi * 37 * np.arange(n) / SR))


def sparkle():
    n = int(0.8 * SR)
    tm = np.arange(n) / SR
    return sum(np.sin(2 * np.pi * f * tm) * ex(n, 0.25) for f in (1568, 2093, 2637)) * np.minimum(1, tm / 0.005)


for t0, p, g in [(0.6, 0.5, 0.40), (1.42, 0.3, 0.14), (1.52, 0.3, 0.14), (1.6, 0.3, 0.40), (2.25, -0.2, 0.40),
                 (5.2, 0.5, 0.38), (5.9, 0.3, 0.38), (6.75, -0.1, 0.38)]:
    place(t0, kick(0.5 if g < 0.3 else 1.0), gain=g, pan=p)
place(2.9, kick(1.6), gain=0.62, pan=-0.5)
place(3.2, net(), gain=0.40, pan=-0.6)
place(3.4, sparkle(), gain=0.10, pan=0.5)

# ---------------------------------------------------------------- master ------
mix = out[:N]
fo = int(0.6 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
thr = 10 ** (-1.5 / 20)
up = np.abs(resample_poly(mix, 4, 1, axis=0)).max(1)[:4 * N].reshape(N, 4).max(1)
la = int(0.003 * SR)
gr = uniform_filter1d(np.minimum(1, thr / np.maximum(maximum_filter1d(up, 4 * la + 1), 1e-9)), 2 * la + 1)
g = np.empty_like(gr)
cur, rel = 1.0, np.exp(-1 / (0.08 * SR))
for i in range(N):
    cur = gr[i] if gr[i] < cur else rel * cur + (1 - rel) * gr[i]
    g[i] = cur
mix *= g[:, None]
print(f"max gain reduction {20 * np.log10(g.min()):.1f} dB")
with wave.open(OUTF, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
