"""Whoosh + thud/tick for the target-dart shot (numpy/scipy only).

python3 audio.py out/target-dart.wav [gain_dB]
Impact on frame 96 of 1..168 at 30 fps -> t = 95/30 s.
"""
import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
DUR = 168 / 30
T_HIT = 95 / 30
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(11)
gain_db = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0

def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], "bandpass", fs=SR, output="sos")
    return signal.sosfilt(sos, x)

def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, "lowpass", fs=SR, output="sos"), x)

def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, "highpass", fs=SR, output="sos"), x)

L = np.zeros(N); R = np.zeros(N)

# ---- whoosh: noise through a band whose centre sweeps up (doppler) as the dart nears,
# loudness rising into the impact, panned from right to centre (it comes from top right)
w0, w1 = T_HIT - 1.9, T_HIT
seg = (t >= w0) & (t < w1 + 0.02)
u = np.clip((t - w0) / (w1 - w0), 0, 1)
noise = rng.standard_normal(N)
# time-varying band-pass by short-block processing
out = np.zeros(N)
blk = 512
for i in range(0, N, blk):
    if not seg[i:i + blk].any():
        continue
    uu = u[i]
    fc = 380 * (1 + 4.0 * uu ** 2.2)              # 380 Hz -> ~1.9 kHz
    bw = 0.9
    sos = signal.butter(2, [fc / (1 + bw), min(fc * (1 + bw), 20000)], "bandpass", fs=SR,
                        output="sos")
    s0 = max(0, i - 2048)
    y = signal.sosfilt(sos, noise[s0:i + blk])
    out[i:i + blk] = y[-len(noise[i:i + blk]):]
env = np.where(seg, u ** 2.6, 0.0)
env *= np.clip((w1 + 0.012 - t) / 0.012, 0, 1)    # cut sharply at the hit
# slow "flutter" from the spinning flights
env *= 1 + 0.25 * np.sin(2 * np.pi * (6 + 10 * u) * t)
wh = out * env * 1.0
pan = 0.85 - 0.75 * u                             # right -> near centre
L += wh * np.sqrt(np.clip(1 - pan, 0, 1) * 0.5 + 0.25)
R += wh * np.sqrt(np.clip(pan, 0, 1) * 0.5 + 0.25)

# ---- impact
i0 = int(T_HIT * SR)
k = np.arange(N - i0) / SR
hit = np.zeros(N)
# metallic tick: 2 ms broadband click + short steel ring
click = hp(rng.standard_normal(len(k)), 3500) * np.exp(-k / 0.0012)
ring = sum(a * np.sin(2 * np.pi * f * k + p) * np.exp(-k / d)
           for f, a, d, p in ((2870, 0.30, 0.050, 0.0), (4410, 0.18, 0.030, 1.0),
                              (6920, 0.10, 0.018, 2.0)))
# sharp wooden/cork thud: pitched body (falling 190->120 Hz) + band noise burst
f_body = 120 + 70 * np.exp(-k / 0.02)
body = np.sin(2 * np.pi * np.cumsum(f_body) / SR) * np.exp(-k / 0.055)
knock = bp(rng.standard_normal(len(k)), 500, 2200) * np.exp(-k / 0.012)
low = lp(rng.standard_normal(len(k)), 90) * np.exp(-k / 0.09) * 2.5
# dart shaft / flight buzz decaying with the visual shake (4-6 Hz modulated ~210 Hz)
buzz = (np.sin(2 * np.pi * 212 * k) * (0.6 + 0.4 * np.sin(2 * np.pi * 4.2 * k))
        * np.exp(-k / 0.33) * 0.06)
hit[i0:] = 0.35 * click + 0.7 * ring + 1.3 * body + 0.8 * knock + low + buzz
# small room tail (decaying-noise impulse response)
ir_n = int(0.7 * SR)
ir = rng.standard_normal(ir_n) * np.exp(-np.arange(ir_n) / SR / 0.16)
ir = lp(ir, 5000); ir /= np.sqrt((ir ** 2).sum())
tail = signal.fftconvolve(hit, ir)[:N] * 0.22
L += hit + tail * 1.0
R += hit * 0.95 + signal.fftconvolve(hit, np.roll(ir, 37))[:N] * 0.22

# very low room tone so the silence is not digital
room = lp(rng.standard_normal(N), 300) * 0.0012
L += room; R += room * 0.9

st = np.stack([L, R], 1)
st *= 10 ** (gain_db / 20)
# look-ahead true-peak limiter at -1.8 dBTP (4x oversampled detector)
ceil = 10 ** (-1.8 / 20)
up = np.abs(signal.resample_poly(st, 4, 1, axis=0)).max(1)
pk = up.reshape(-1, 4).max(1)[:N] if len(up) >= 4 * N else np.abs(st).max(1)
g = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
la = int(0.003 * SR)                                   # 3 ms look-ahead / attack
from scipy.ndimage import minimum_filter1d, uniform_filter1d
g = minimum_filter1d(g, 2 * la + 1)
g = uniform_filter1d(g, la)                            # smooth attack
rel = np.exp(-1 / (0.06 * SR)); gs = g.copy()
for i in range(1, N):                                   # 60 ms release
    gs[i] = g[i] if g[i] < gs[i - 1] else gs[i - 1] * rel + g[i] * (1 - rel)
gs = np.minimum(gs, g)
st *= gs[:, None]
tp = np.abs(signal.resample_poly(st, 4, 1, axis=0)).max()
if tp > ceil:
    st *= ceil / tp
print(f"max gain reduction {20*np.log10(gs.min()):.1f} dB")
fade = np.clip((N - np.arange(N)) / (0.08 * SR), 0, 1)[:, None]
st *= fade
wavfile.write(sys.argv[1], SR, st.astype(np.float32))
print("ok")
