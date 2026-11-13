"""EDPROD kit — shared building blocks for ecommanita course videos.

Import from a render script:
    import sys; sys.path.insert(0, "edprod/tools/lib")
    from edprod_kit import *

Everything is plain numpy / PIL / scipy + ffmpeg. Frames are float32 RGB in [0, 1], 1080x1920.
"""
import math
import os
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as nd
from scipy.ndimage import maximum_filter1d, uniform_filter1d
from scipy.signal import butter, resample_poly, sosfilt

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ASSETS = os.path.join(ROOT, "assets")
W, H, FPS = 1080, 1920, 30

# ------------------------------------------------------------------ brand -------
BLUE = (40, 215, 255)      # #28D7FF  «حنا» / tassyir side
ORANGE = (255, 120, 20)    # #FF7814  ecommanita side
GREEN = (43, 217, 107)     # #2BD96B  validated / green card / goal
RED = (255, 59, 59)        # #FF3B3B  opponent / fake / red card / stop
GOLD = (255, 205, 90)      # arrows, 1954 side
WHITE = (245, 248, 252)
SAFE_TOP, SAFE_BOTTOM = int(0.13 * H), int(0.78 * H)   # keep text between these (TikTok / Reels UI)
SAFE_RIGHT = int(0.86 * W)                             # right action rail starts here (mid screen)


def font(weight="ExtraBold", size=64):
    """Tajawal with RAQM shaping (Arabic joins correctly). weight: Regular Medium Bold ExtraBold Black."""
    return ImageFont.truetype(os.path.join(ASSETS, "fonts", f"Tajawal-{weight}.ttf"), size,
                              layout_engine=ImageFont.Layout.RAQM)


def clamp01(x): return min(1.0, max(0.0, x))
def ease_io(x): x = clamp01(x); return 3 * x * x - 2 * x ** 3
def ease_out(x): x = clamp01(x); return 1 - (1 - x) ** 2
def ease_in3(x): x = clamp01(x); return x ** 3


# ------------------------------------------------------------------ text --------
def text_rgba(s, fnt, col=WHITE):
    """RGBA float image of a (RTL if Arabic) string, cropped tight.
    NOTE: Tajawal has no «←» glyph — draw arrows with arrow_rgba() instead."""
    im = Image.new("RGBA", (1600, 320), (0, 0, 0, 0))
    rtl = any("؀" <= ch <= "ۿ" for ch in s)
    ImageDraw.Draw(im).text((800, 160), s, font=fnt, fill=tuple(col) + (255,), anchor="mm",
                            direction="rtl" if rtl else None)
    return np.asarray(im.crop(im.getbbox())).astype(np.float32) / 255


def arrow_rgba(w=46, h=30, col=GOLD):
    """left-pointing arrow (reading direction in Arabic)."""
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    c = h / 2
    ImageDraw.Draw(im).polygon([(0, c), (18, c - 14), (18, c - 5), (w, c - 5), (w, c + 5), (18, c + 5), (18, c + 14)],
                               fill=tuple(col) + (255,))
    return np.asarray(im).astype(np.float32) / 255


def reveal_rtl(img, v):
    """typewriter for Arabic: keep the right part, v in [0,1]."""
    out = img.copy()
    w = out.shape[1]
    out[:, :int(w * (1 - clamp01(v))), 3] = 0
    return out


def scaled(img, k):
    h, w = img.shape[:2]
    return np.asarray(Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), "RGBA").resize(
        (max(1, int(w * k)), max(1, int(h * k))), Image.BICUBIC)).astype(np.float32) / 255


# ------------------------------------------------------------------ compositing -
def over(f, a, x, y, alpha=1.0):
    """alpha-composite RGBA float `a` onto frame `f` at top-left (x, y)."""
    h, w = a.shape[:2]
    x, y = int(x), int(y)
    x0, y0, x1, y1 = max(0, x), max(0, y), min(f.shape[1], x + w), min(f.shape[0], y + h)
    if x1 > x0 and y1 > y0 and alpha > 0:
        s = a[y0 - y:y1 - y, x0 - x:x1 - x]
        k = s[..., 3:4] * alpha
        f[y0:y1, x0:x1] = s[..., :3] * k + f[y0:y1, x0:x1] * (1 - k)


def glow(f, x, y, r, col, k):
    """additive soft light disc."""
    R = int(r * 3) + 2
    x0, y0 = int(x) - R, int(y) - R
    yy, xx = np.mgrid[0:2 * R, 0:2 * R].astype(np.float32)
    g = np.exp(-(((xx + x0 - x) ** 2 + (yy + y0 - y) ** 2) / (r * r))) * k
    a0, b0, a1, b1 = max(0, x0), max(0, y0), min(f.shape[1], x0 + 2 * R), min(f.shape[0], y0 + 2 * R)
    if a1 > a0 and b1 > b0:
        f[b0:b1, a0:a1] += g[b0 - y0:b1 - y0, a0 - x0:a1 - x0, None] * np.array(col, np.float32) / 255


def text_glow(f, img, x, y, col, k, pad=40, sigma=12):
    """glow behind a text image — padded so the glow never shows a box edge."""
    gl = nd.gaussian_filter(np.pad(img[..., 3], pad), sigma)[..., None] * np.array(col, np.float32) / 255 * k
    h, w = gl.shape[:2]
    x0, y0 = int(x) - pad, int(y) - pad
    a0, b0, a1, b1 = max(0, x0), max(0, y0), min(f.shape[1], x0 + w), min(f.shape[0], y0 + h)
    if a1 > a0 and b1 > b0:
        f[b0:b1, a0:a1] += gl[b0 - y0:b1 - y0, a0 - x0:a1 - x0]


def fit_poster(path, canvas=(W, H)):
    """static poster fitted to the reel width, centred; returns (frame, scale, y_offset)."""
    im = Image.open(path).convert("RGB")
    sc = canvas[0] / im.width
    ph = int(im.height * sc)
    off = (canvas[1] - ph) // 2
    f = np.zeros((canvas[1], canvas[0], 3), np.float32)
    f[max(0, off):max(0, off) + ph] = np.asarray(im.resize((canvas[0], ph), Image.LANCZOS)).astype(np.float32)[:canvas[1]] / 255
    return f, sc, off


def inpaint_diffuse(img, cx, cy, r, sigma=4, iters=120):
    """remove a small painted object (e.g. a ball) by diffusing the surroundings into it."""
    y0, y1, x0, x1 = int(cy - 4 * r), int(cy + 4 * r), int(cx - 4 * r), int(cx + 4 * r)
    reg = img[y0:y1, x0:x1].copy()
    yy, xx = np.mgrid[y0:y1, x0:x1]
    m = ((xx - cx) ** 2 + ((yy - cy) * 1.15) ** 2) < r * r
    fill = reg.copy()
    for _ in range(iters):
        bl = np.stack([nd.uniform_filter(fill[..., c], 7) for c in range(3)], -1)
        fill = np.where(m[..., None], bl, reg)
    soft = nd.gaussian_filter(m.astype(np.float32), sigma)[..., None]
    img[y0:y1, x0:x1] = reg * (1 - soft) + fill * soft


class Encoder:
    """streams float frames to an H.264 file tuned for Meta / TikTok."""

    def __init__(self, path, fps=FPS, size=(W, H), crf=12):
        self.p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                                   "-s", f"{size[0]}x{size[1]}", "-r", str(fps), "-i", "-", "-c:v", "libx264",
                                   "-preset", "slower", "-tune", "film", "-crf", str(crf), "-maxrate", "30M",
                                   "-bufsize", "60M", "-profile:v", "high", "-level", "4.2", "-g", "60", "-bf", "2",
                                   "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709",
                                   "-colorspace", "bt709", "-movflags", "+faststart", path], stdin=subprocess.PIPE)

    def write(self, f):
        self.p.stdin.write((np.clip(f, 0, 1) * 255 + 0.5).astype(np.uint8).tobytes())

    def close(self):
        self.p.stdin.close()
        self.p.wait()


# ------------------------------------------------------------------ audio -------
SR = 48000


def load_audio(path, mono=False):
    """any audio file -> float64 (N, 2) at 48 kHz (or (N,) if mono)."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1" if mono else "2", "-ar", str(SR),
                          "-f", "f32le", "-"], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.float32).astype(np.float64)
    return a if mono else a.reshape(-1, 2)


def crowd(name):
    """a CC0 crowd recording from assets/audio/crowd (mono): ambience-low/high, cheer-small-1..3,
    cheer-big-1..3, cheer-hr-1..3 (arena roar + chant + whistles), groan-1..3 (disappointed «أووه»)."""
    return load_audio(os.path.join(ASSETS, "audio", "crowd", f"{name}.flac"), mono=True)


def flt(x, kind, fq, order=4): return sosfilt(butter(order, fq, btype=kind, fs=SR, output="sos"), x, axis=0)


def widen(m, width=0.6):
    """mono -> stereo (Haas delay + tilt) so a mono crowd feels like a stadium."""
    d = int(0.013 * SR)
    l, r = m, np.concatenate([np.zeros(d), m[:-d]])
    l, r = l + 0.15 * flt(l, "high", 2500), r + 0.15 * flt(r, "low", 800)
    mid, side = (l + r) / 2, (l - r) / 2 * width
    return np.stack([mid + side, mid - side], 1)


def rms(x): return float(np.sqrt(np.mean(x ** 2)) + 1e-9)


class Mix:
    """timeline mixer: mix.place(t, signal, gain, pan); mix.save(path) with a true-peak limiter."""

    def __init__(self, dur):
        self.N = int(dur * SR)
        self.buf = np.zeros((self.N + 4 * SR, 2))

    def place(self, t0, sig, gain=1.0, pan=0.0):
        if sig.ndim == 1:
            a = (pan + 1) * np.pi / 4
            sig = np.stack([sig * np.cos(a), sig * np.sin(a)], 1)
        i = int(t0 * SR)
        self.buf[i:i + len(sig)] += gain * sig[:len(self.buf) - i]

    def save(self, path, ceiling_db=-1.5, fade_out=0.4):
        mix = self.buf[:self.N].copy()
        fo = int(fade_out * SR)
        if fo:
            mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
        thr = 10 ** (ceiling_db / 20)
        up = np.abs(resample_poly(mix, 4, 1, axis=0)).max(1)[:4 * self.N].reshape(self.N, 4).max(1)
        la = int(0.003 * SR)
        gr = uniform_filter1d(np.minimum(1, thr / np.maximum(maximum_filter1d(up, 4 * la + 1), 1e-9)), 2 * la + 1)
        g = np.empty_like(gr)
        cur, rel = 1.0, np.exp(-1 / (0.08 * SR))
        for i in range(self.N):
            cur = gr[i] if gr[i] < cur else rel * cur + (1 - rel) * gr[i]
            g[i] = cur
        mix *= g[:, None]
        with wave.open(path, "wb") as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
        return 20 * np.log10(g.min())


# synthetic match SFX (no clean CC0 recordings available offline)
def sfx_kick(strong=1.0):
    n = int(0.3 * SR)
    tm = np.arange(n) / SR
    rng = np.random.default_rng()
    return (np.sin(2 * np.pi * np.cumsum(60 + 90 * np.exp(-tm / 0.02)) / SR) * np.exp(-tm / (0.05 * strong)) +
            0.45 * flt(rng.standard_normal(n), "band", [800, 4000]) * np.exp(-tm / 0.008))


def sfx_whistle(dur=0.35):
    n = int(dur * SR)
    tm = np.arange(n) / SR
    am = uniform_filter1d(0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 32 * tm)), 40)
    w = (np.sin(2 * np.pi * 2900 * tm) + 0.6 * np.sin(2 * np.pi * 3150 * tm)) * am
    return w * np.minimum(1, tm / 0.01) * np.minimum(1, (tm[-1] - tm) / 0.03)


def sfx_net():
    n = int(0.7 * SR)
    rng = np.random.default_rng()
    return flt(rng.standard_normal(n), "band", [1500, 6000]) * np.exp(-np.arange(n) / SR / 0.14)
