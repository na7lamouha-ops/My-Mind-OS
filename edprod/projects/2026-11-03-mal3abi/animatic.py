"""«مرحبا بك في ملعبي» — animatic on the A.E.M track (from 0:59.37, phrase start before 1:00).
112 BPM -> one bar = 4 beats ≈ 2.15 s. Cuts land on bar downbeats, flashes on phrase starts.
run from repo root: python3 edprod/projects/2026-11-03-mal3abi/animatic.py <song.mp3>
"""
import os
import subprocess
import sys

sys.path.insert(0, "edprod/tools/lib")
from edprod_kit import *  # noqa

SONG = sys.argv[1]
SONG_START = 59.37
DUR = 27.0
FR = os.environ.get("FRAMES", "out/mal3abi/frames_clean")
OUT = "out/mal3abi/animatic"
os.makedirs(OUT, exist_ok=True)

BEATS = [58.25, 58.81, 59.37, 59.90, 60.43, 60.99, 61.48, 61.97, 62.43, 62.89, 63.45, 63.99, 64.54, 65.08, 65.61,
         66.17, 66.73, 67.26, 67.82, 68.35, 68.89, 69.44, 69.98, 70.53, 71.07, 71.63, 72.16, 72.72, 73.25, 73.81,
         74.34, 74.90, 75.43, 75.99, 76.52, 77.08, 77.62, 78.17, 78.71, 79.26, 79.80, 80.36, 80.89, 81.45, 81.98,
         82.54, 83.07, 83.63, 84.16, 84.72, 85.26, 85.81, 86.35]
BEATS = [b - SONG_START for b in BEATS if b >= SONG_START]
# shot list: (frame, start, end, zoom_from, zoom_to, drift_y)
SHOTS = [(1, 0.00, 4.08, 1.00, 1.08, 0), (2, 4.08, 6.24, 1.10, 1.02, -40), (3, 6.24, 8.45, 1.00, 1.07, 20),
         (4, 8.45, 10.61, 1.12, 1.03, 0), (5, 10.61, 12.79, 1.00, 1.06, 0), (6, 12.79, 17.15, 1.00, 1.09, 0),
         (7, 17.15, 23.70, 1.00, 1.14, -30), (8, 23.70, DUR, 1.06, 1.00, 0)]
PHRASES = [8.45, 17.15]
IMGS = {n: Image.open(os.path.join(FR, f"frame_{n:02d}.png")).convert("RGB") for n in range(1, 9)}


def shot_at(t):
    for s in SHOTS:
        if s[1] <= t < s[2]:
            return s
    return SHOTS[-1]


def render(t):
    n, a, b, z0, z1, dy = shot_at(t)
    p = ease_io((t - a) / (b - a))
    z = z0 + (z1 - z0) * p
    # beat pulse: +1.2 % on every beat, decays in 0.18 s
    last = max([x for x in BEATS if x <= t] or [0])
    z *= 1 + 0.012 * math.exp(-(t - last) / 0.18)
    im = IMGS[n]
    w, h = int(W * z), int(H * z)
    big = im.resize((w, h), Image.BICUBIC)
    x0 = (w - W) // 2
    y0 = int((h - H) / 2 + dy * p)
    y0 = max(0, min(h - H, y0))
    f = np.asarray(big.crop((x0, y0, x0 + W, y0 + H))).astype(np.float32) / 255
    if t < 0.35:
        f *= ease_io(t / 0.35)
    for ph in PHRASES:                       # white flash on phrase starts
        if 0 <= t - ph < 0.2:
            f = f + (1 - f) * (1 - (t - ph) / 0.2) * 0.85
    if 0 <= t - a < 0.07 and a not in PHRASES and a > 0:   # 2-frame dip on normal cuts
        f *= 0.55
    if t > DUR - 1.2:
        f *= 1 - ease_io((t - (DUR - 1.2)) / 1.2)
    return f


enc = Encoder(os.path.join(OUT, "video.mp4"))
for k in range(int(DUR * FPS)):
    enc.write(render(k / FPS))
enc.close()
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{SONG_START}", "-t", f"{DUR}", "-i", SONG,
                "-af", f"afade=t=in:d=0.03,afade=t=out:st={DUR - 1.4}:d=1.4", "-ar", "48000", "-ac", "2",
                os.path.join(OUT, "song_cut.wav")], check=True)
print("ok")
