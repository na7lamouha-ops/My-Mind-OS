"""v7 sound: hook5's historical track re-cut to v4's storyline (dominant) + v4 effects stem underneath.

usage: montage_v7.py <hook5_f32le_48k_stereo.raw> <v4_stem.wav> <out.wav> [stem_db] [makeup_db]
"""
import sys
import wave

import numpy as np
from scipy.ndimage import maximum_filter1d, uniform_filter1d
from scipy.signal import resample_poly

SR = 48000
DUR = 32.0
N = int(DUR * SR)
h5 = np.fromfile(sys.argv[1], dtype=np.float32).reshape(-1, 2).astype(np.float64)
with wave.open(sys.argv[2]) as w:
    stem = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").reshape(-1, 2).astype(np.float64) / 32768
STEM_DB = float(sys.argv[4]) if len(sys.argv) > 4 else -8.0
MAKEUP = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0

# (dst_start, src_start, src_end)  -- hook5 pieces laid on v4's timeline
SEGS = [
    (0.00, 0.00, 2.00),    # radio + "01 نوفمبر" typing
    (2.00, 2.90, 5.50),    # salute typing
    (4.60, 6.40, 7.30, 0.3),    # tone tail (hold)
    (5.50, 7.30, 8.40),    # "الثورة ما بداتش بالصدفة" typing
    (6.60, 8.70, 9.40),    # the silence = reload tension
    (7.30, 17.00, 19.90),  # burst + build -> explosion lands exactly at 9.30
    (10.20, 11.40, 16.20),  # list typing under the four cards
    (15.00, 23.90, 25.60),  # the big hit -> lands at 15.30 with the flash
    (16.70, 19.80, 23.90, 0.25),  # quiet bed: logo + pillars
    (20.80, 25.60, 26.60, 0.3),  # tone
    (21.80, 27.40, 28.40),  # "الهدف" typing
    (22.80, 26.60, 27.35, 0.25),  # tone (hold)
    (23.55, 20.40, 21.65),  # quiet bed
    (24.80, 27.60, 28.70),  # "لقينا المانيطة" typing (clear clicks)
    (25.90, 30.80, 31.30),  # tail into the code
    (26.40, 31.30, 34.20, 0.3),  # code hold
    (29.30, 34.00, 35.00),  # ending
    (30.20, 27.47, 28.27),  # typing for "يتبع..."
]
XF = 0.08  # crossfade seconds

out = np.zeros((N, 2))
for k, seg in enumerate(SEGS):
    d0, s0, s1 = seg[:3]
    xf = seg[3] if len(seg) > 3 else XF
    a, b = int(s0 * SR), int(s1 * SR)
    piece = h5[a:b].copy()
    n = len(piece)
    x = int(xf * SR)
    env = np.ones(n)
    fin = np.sin(np.linspace(0, np.pi / 2, x)) ** 1      # equal-power
    env[:x] *= fin
    env[-x:] *= fin[::-1]
    piece *= env[:, None]
    i = int(d0 * SR) - (x // 2 if k else 0)
    i = max(0, i)
    j = min(N, i + n)
    out[i:j] += piece[:j - i]

# hook5 dominant, v4 effects underneath
st = np.zeros((N, 2))
st[:min(N, len(stem))] = stem[:N]
mix = (out + st * 10 ** (STEM_DB / 20)) * 10 ** (MAKEUP / 20)
fo = int(0.3 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]

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
with wave.open(sys.argv[3], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
