"""Swap the flat golden bullet (frames 246..299, 8.2s-9.97s) for the rendered realistic sprite.

usage: replace_object.py <src.mp4> <sprite.png> <track.json> <out_video_only.mp4> [preview_dir]
"""
import json
import subprocess
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as nd

src, sprite_p, track_p, out = sys.argv[1:5]
prev_dir = sys.argv[5] if len(sys.argv) > 5 else None
Wf, Hf, FPS = 1080, 1920, 30
OFF = 231                    # track.json frame k  ->  absolute frame OFF + k
SPR_D, SPR_PAD = 360, 8      # sprite diameter / rim offset in px
D_RATIO = 0.97
L_RATIO = 4.68 * D_RATIO      # sprite length / measured height               # sprite diameter / measured height (measured includes glow)

trk = {int(k): v for k, v in json.load(open(track_p)).items()}


def pose(k):
    if k <= 45:
        h, cy = 70.0, 1101.5
        tip = 15 + 9.93 * (k - 15)
        rim = tip - L_RATIO * h
    elif k <= 54:
        h, cy, rim = trk[k]["h"], trk[k]["cy"], trk[k]["rim"]
    elif k <= 57:
        h, cy, rim = 147.0, 956.7, trk[k]["rim"]
    else:
        h, cy, rim = 147.0, 956.7, 266.0
    return float(h), float(cy), float(rim)


sprite = Image.open(sprite_p).convert("RGBA")


def render_sprite(h):
    sc = D_RATIO * h / SPR_D
    w, hh = round(sprite.width * sc), round(sprite.height * sc)
    s = sprite.resize((w, hh), Image.LANCZOS)
    M = int(3 * max(2, 0.14 * h / D_RATIO)) + 2      # room for the glow to fade out
    arr = np.pad(np.asarray(s).astype(np.float32) / 255, ((M, M), (M, M), (0, 0)))
    return arr, sc, M


dec = subprocess.Popen(
    ["ffmpeg", "-v", "error", "-i", src, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    stdout=subprocess.PIPE,
)
enc = subprocess.Popen(
    ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{Wf}x{Hf}",
     "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "17",
     "-pix_fmt", "yuv420p", "-movflags", "+faststart", out],
    stdin=subprocess.PIPE,
)
fsz = Wf * Hf * 3
idx = 0
while True:
    buf = dec.stdout.read(fsz)
    if len(buf) < fsz:
        break
    k = idx - OFF
    if 15 <= k <= 68:
        orig = np.frombuffer(buf, np.uint8).reshape(Hf, Wf, 3)
        f = orig.astype(np.float32) / 255
        h, cy, rim = pose(k)
        spr, sc, M = render_sprite(h)
        tip = rim + L_RATIO * h
        # 1) erase the old bullet: warm/golden pixels inside its corridor
        x0, x1 = int(max(0, rim - 14)), int(min(Wf, tip + 0.5 * h + 6))
        y0, y1 = int(max(0, cy - 0.9 * h)), int(min(Hf, cy + 0.9 * h))
        reg = orig[y0:y1, x0:x1].astype(int)
        r, g, b = reg[..., 0], reg[..., 1], reg[..., 2]
        warm = (r > 40) & (r - b > 25)
        warm = nd.gaussian_filter(nd.binary_dilation(warm, iterations=3).astype(np.float32), 1.5)
        xs = np.arange(x0, x1)[None, :]
        # erase fully along the body, fade out just past the new tip (no hard edge)
        fade = np.clip((tip + 0.45 * h - xs) / (0.55 * h), 0, 1)
        if k > 45:
            fade = fade * np.clip((xs - (rim - 14)) / 10, 0, 1)
        warm = np.clip(warm * fade, 0, 1)
        f[y0:y1, x0:x1] *= (1 - warm)[..., None]
        # 2) composite the sprite (premultiplied over)
        px = int(round(rim - SPR_PAD * sc)) - M
        py = int(round(cy - spr.shape[0] / 2))
        sx0, sy0 = max(0, -px), max(0, -py)
        sx1, sy1 = min(spr.shape[1], Wf - px), min(spr.shape[0], Hf - py)
        if sx1 > sx0 and sy1 > sy0:
            s = spr[sy0:sy1, sx0:sx1]
            a = s[..., 3:4]
            dst = f[py + sy0:py + sy1, px + sx0:px + sx1]
            # soft amber glow around the bullet keeps the original golden mood
            glow = nd.gaussian_filter(spr[..., 3], sigma=max(2, 0.14 * h))[sy0:sy1, sx0:sx1, None]
            glow = glow * (1 - a) * 0.42 * np.array([1.0, 0.68, 0.25])
            comp = s[..., :3] * a + dst * (1 - a)
            comp = 1 - (1 - comp) * (1 - glow)
            f[py + sy0:py + sy1, px + sx0:px + sx1] = comp
        # 3) keep the white text / sparks of the original on top
        o = orig[y0:y1, x0:x1].astype(int)
        white = (o.min(-1) > 150) & (o.max(-1) - o.min(-1) < 70)
        white &= (np.arange(x0, x1)[None, :] > tip + 0.03 * h)   # only in front of the tip (text impact)
        wsoft = nd.gaussian_filter(white.astype(np.float32), 1.2)[..., None]
        f[y0:y1, x0:x1] = f[y0:y1, x0:x1] * (1 - wsoft) + (o / 255) * wsoft
        outb = (np.clip(f, 0, 1) * 255 + 0.5).astype(np.uint8)
        if prev_dir and k in (20, 35, 45, 48, 51, 54, 58, 64, 68):
            Image.fromarray(outb).save(f"{prev_dir}/new_{k:03d}.png")
        enc.stdin.write(outb.tobytes())
    else:
        enc.stdin.write(buf)
    idx += 1
enc.stdin.close()
enc.wait()
dec.wait()
print("frames", idx)
