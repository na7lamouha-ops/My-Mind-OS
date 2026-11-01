"""Episode 01 sound bed (no commentator): stadium ambience, crowd reactions and match SFX on the script's cues.

usage: sound_ep01.py <v4_audio_f32le_48k.raw (v4 track, for the intro/outro clips)> <out.wav>
"""
import sys
import wave

import numpy as np
from scipy.ndimage import maximum_filter1d, uniform_filter1d
from scipy.signal import butter, resample_poly, sosfilt

SR = 48000
N = 45 * SR
rng = np.random.default_rng(7)
v4 = np.fromfile(sys.argv[1], dtype=np.float32).reshape(-1, 2).astype(np.float64)


def flt(x, kind, f, order=4): return sosfilt(butter(order, f, btype=kind, fs=SR, output="sos"), x, axis=0)
def ex(n, tau): return np.exp(-np.arange(n) / SR / tau)
def nz(n): return rng.standard_normal(n)
def sm(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)


def pan2(s, p):
    a = (p + 1) * np.pi / 4
    return np.stack([s * np.cos(a), s * np.sin(a)], 1)


out = np.zeros((N, 2))


def place(t0, sig, pan=0.0, gain=1.0):
    i = int(t0 * SR)
    if sig.ndim == 1:
        sig = pan2(sig, pan)
    j = min(N, i + len(sig))
    out[i:j] += gain * sig[:j - i]


def verb(sig, decay=1.5, mix=0.35, lpf=4000):
    n = int(decay * 1.5 * SR)
    m = sig if sig.ndim == 1 else sig.mean(1)
    L = len(m) + n
    M = np.fft.rfft(m, L)
    wet = []
    for _ in range(2):
        ir = flt(nz(n), "low", lpf) * ex(n, decay / 3)
        ir /= np.sqrt((ir ** 2).sum())
        wet.append(np.fft.irfft(M * np.fft.rfft(ir, L), L))
    dry = pan2(np.pad(m, (0, n)), 0) if sig.ndim == 1 else np.pad(sig, ((0, n), (0, 0)))
    return dry * (1 - mix) + mix * np.stack(wet, 1)


# ---------------- intro / outro from v4 (bullet + explosion, controller) --------
def clip(src_t0, src_t1, dst_t0, fade=0.05):
    a, b = int(src_t0 * SR), int(src_t1 * SR)
    p = v4[a:b].copy()
    f = int(fade * SR)
    p[:f] *= np.linspace(0, 1, f)[:, None]
    p[-f:] *= np.linspace(1, 0, f)[:, None]
    place(dst_t0, p)


clip(8.1, 9.9, 0.0, 0.03)          # bullet + explosion, tail rings into B0

# ---------------- stadium ambience bed (3 -> 43) ------------------------------
n = int(40.5 * SR)
t = np.arange(n) / SR
bed = np.zeros((n, 2))
for lo, hi, gn in [(150, 600, 1.0), (600, 1800, 0.6), (1800, 4000, 0.25)]:
    for c in range(2):
        am = flt(nz(n), "low", 0.8, 2)
        am = 0.65 + 0.35 * am / (np.abs(am).max() + 1e-9)
        bed[:, c] += flt(nz(n), "band", [lo, hi], 2) * am * gn
bed = verb(bed, 2.0, 0.5, 2500)[:n]
lvl = np.interp(t + 3.0, [3, 4, 8, 8.5, 25.5, 26.0, 30.8, 31.2, 43.5], [0.0, 0.5, 0.55, 0.8, 0.8, 0.15, 0.15, 0.85, 0.9])
bed = bed / (np.sqrt(np.mean(bed ** 2)) + 1e-9) * 0.03
place(3.0, bed * lvl[:, None])


# ---------------- crowd voices (reactions) ------------------------------------
def crowd_burst(dur, kind="ooh", n_voices=90):
    n = int(dur * SR)
    o = np.zeros((n, 2))
    vowels = {"ooh": [(400, 800)], "aah": [(800, 1200), (650, 1100)], "cheer": [(800, 1200), (500, 1800), (650, 1100)]}[kind]
    for _ in range(n_voices):
        st = rng.uniform(0, 0.25 * dur)
        d = rng.uniform(0.5, 0.95) * (dur - st)
        m = int(d * SR)
        tm = np.arange(m) / SR
        f0 = rng.uniform(120, 300)
        if kind == "ooh":
            cont = f0 * (1 + 0.25 * np.sin(np.pi * tm / tm[-1]))
        elif kind == "aah":
            cont = f0 * (1.15 - 0.3 * tm / tm[-1])
        else:
            cont = f0 * (1 + 0.15 * np.sin(np.pi * tm / tm[-1]) + 0.03 * np.sin(2 * np.pi * 6 * tm))
        src = ((np.cumsum(cont) / SR) % 1.0) * 2 - 1
        f1, f2 = vowels[rng.integers(len(vowels))]
        v = flt(src, "band", [f1 * 0.8, f1 * 1.2], 2) + 0.5 * flt(src, "band", [f2 * 0.85, f2 * 1.15], 2)
        env = np.minimum(1, tm / 0.12) * np.minimum(1, (tm[-1] - tm) / 0.35)
        i = int(st * SR)
        o[i:i + m] += pan2(v * env * rng.uniform(0.2, 0.7), rng.uniform(-0.9, 0.9))
    if kind == "cheer":
        k = 0.0
        while k < dur - 0.05:
            k += rng.exponential(1 / 30)
            i = int(k * SR)
            mm = int(0.012 * SR)
            if i + mm < n:
                o[i:i + mm] += pan2(flt(nz(mm), "band", [1000, 3500]) * ex(mm, 0.003) * rng.uniform(0.3, 1), rng.uniform(-1, 1)) * 1.4
    o = flt(o, "low", 5000)
    o = verb(o, 1.8, 0.45, 3000)
    return o / (np.sqrt(np.mean(o ** 2)) + 1e-9)


# ---------------- match SFX ----------------------------------------------------
def whistle(dur=0.35, trill=32):
    n = int(dur * SR)
    tm = np.arange(n) / SR
    am = 0.6 + 0.4 * np.sign(np.sin(2 * np.pi * trill * tm))
    am = uniform_filter1d(am, 40)
    w = (np.sin(2 * np.pi * 2900 * tm) + 0.6 * np.sin(2 * np.pi * 3150 * tm)) * am + 0.08 * flt(nz(n), "band", [2500, 4000])
    env = np.minimum(1, tm / 0.01) * np.minimum(1, (tm[-1] - tm) / 0.03)
    return verb(w * env, 1.2, 0.3, 6000)


def kick():
    n = int(0.25 * SR)
    tm = np.arange(n) / SR
    return np.sin(2 * np.pi * np.cumsum(60 + 90 * np.exp(-tm / 0.02)) / SR) * ex(n, 0.05) + 0.4 * flt(nz(n), "band", [800, 4000]) * ex(n, 0.008)


def bass_hit(f=45, dur=1.4):
    n = int(dur * SR)
    tm = np.arange(n) / SR
    s = np.sin(2 * np.pi * np.cumsum(f + 50 * np.exp(-tm / 0.06)) / SR) * ex(n, 0.5)
    return verb(np.tanh(1.8 * s), 1.2, 0.25, 1500)


def heartbeat():
    n = int(0.5 * SR)
    tm = np.arange(n) / SR
    b = np.sin(2 * np.pi * np.cumsum(40 + 30 * np.exp(-tm / 0.04)) / SR) * ex(n, 0.08)
    o = np.zeros(int(0.7 * SR))
    o[:n] += b
    o[int(0.14 * SR):int(0.14 * SR) + n] += 0.6 * b
    return o


def net():
    n = int(0.6 * SR)
    return flt(nz(n), "band", [1500, 6000]) * ex(n, 0.12) * (1 + 0.5 * np.sin(2 * np.pi * 37 * np.arange(n) / SR))


def zoom_whine():
    n = int(0.25 * SR)
    tm = np.arange(n) / SR
    return np.sin(2 * np.pi * np.cumsum(900 + 2400 * tm) / SR) * np.sin(np.pi * tm / tm[-1]) * 0.5 + flt(nz(n), "high", 5000) * 0.1


def swoosh_cut():
    n = int(0.3 * SR)
    tm = np.arange(n) / SR
    s = flt(nz(n), "band", [700, 5000]) * np.sin(np.pi * tm / tm[-1]) ** 2
    return s + 0.8 * np.sin(2 * np.pi * np.cumsum(120 + 60 * np.exp(-tm / 0.03)) / SR) * ex(n, 0.06) * (tm > 0.12)


def horn(dur=1.3):
    n = int(dur * SR)
    tm = np.arange(n) / SR
    s = sum(((tm * f) % 1.0) * 2 - 1 for f in (185, 233, 277)) * (1 + 0.02 * np.sin(2 * np.pi * 5 * tm))
    s = flt(s, "low", 2500) * np.minimum(1, tm / 0.05) * np.minimum(1, (tm[-1] - tm) / 0.2)
    return verb(s, 2.5, 0.5, 2500)


def soft_hit():
    n = int(1.6 * SR)
    tm = np.arange(n) / SR
    s = np.sin(2 * np.pi * 110 * tm) * ex(n, 0.6) + 0.5 * np.sin(2 * np.pi * 220 * tm) * ex(n, 0.4)
    return verb(s * np.minimum(1, tm / 0.01), 2.5, 0.5, 3000)


def type_click():
    m = int(0.05 * SR)
    tm = np.arange(m) / SR
    return flt(nz(m), "band", [1800, 6500]) * ex(m, 0.005) + 0.6 * np.sin(2 * np.pi * 260 * tm) * ex(m, 0.012)


# B0 typing (1.9 -> 2.8)
for k in range(9):
    place(1.9 + k * 0.1 + rng.uniform(-0.01, 0.01), type_click(), gain=0.18)
# B1: heartbeat + bass hit on «الخصم»
for k, t0 in enumerate(np.arange(3.3, 7.0, 0.85)):
    place(t0, heartbeat(), gain=0.35)
place(7.0, bass_hit(), gain=0.55)
# B2: crowd «ووووه» on the copy + zoom/camera sound
place(11.4, crowd_burst(2.2, "ooh"), gain=0.07)
place(11.5, zoom_whine(), gain=0.12)
# B3: attack whistle + a kick on every name
place(15.0, whistle(0.6), gain=0.16)
for i in range(4):
    place(15.6 + 0.8 * i, kick(), pan=-0.6 + 0.4 * i, gain=0.4)
cb = crowd_burst(4.0, "ooh", 70)
place(15.4, cb * np.linspace(0.3, 1.0, len(cb))[:, None], gain=0.05)   # crowd getting tense
# B4: net + sigh
place(20.0, net(), gain=0.35)
place(20.0, bass_hit(40, 1.0), gain=0.35)
place(20.15, crowd_burst(2.6, "aah"), gain=0.08)
# B5: soft hit on «تتحمى»
place(29.6, soft_hit(), gain=0.25)
# B6: kick-off whistle, two cuts, two referee whistles on the cards, crowd rising
place(31.0, whistle(0.7), gain=0.2)
place(32.6, swoosh_cut(), gain=0.35)
place(33.8, swoosh_cut(), gain=0.35)
place(35.2, whistle(0.25), gain=0.18)
place(35.55, whistle(0.25), gain=0.18)
place(35.6, crowd_burst(2.6, "cheer", 80), gain=0.06)
# B7: full crowd + horn on «القوة اللي يحبس»
place(41.2, crowd_burst(3.2, "cheer", 140), gain=0.11)
place(41.3, horn(), gain=0.12)
place(41.3, bass_hit(42, 1.6), gain=0.4)
# outro: final whistle (three blasts)
for k, d in enumerate((0.25, 0.25, 0.7)):
    place(43.15 + k * 0.4, whistle(d), gain=0.18)

place(42.9, crowd_burst(2.1, "cheer", 120), gain=0.07)   # outro: crowd under the final whistle

# ---------------- limiter / loudness -------------------------------------------
mix = out
thr = 10 ** (-1.5 / 20)
up = np.abs(resample_poly(mix, 4, 1, axis=0)).max(1)[:4 * N].reshape(N, 4).max(1)
la = int(0.003 * SR)
gr = uniform_filter1d(np.minimum(1, thr / np.maximum(maximum_filter1d(up, 4 * la + 1), 1e-9)), 2 * la + 1)
rel = np.exp(-1 / (0.08 * SR))
g = np.empty_like(gr)
cur = 1.0
for i in range(N):
    cur = gr[i] if gr[i] < cur else rel * cur + (1 - rel) * gr[i]
    g[i] = cur
mix *= g[:, None]
print(f"max gain reduction {20 * np.log10(g.min()):.1f} dB")
with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
