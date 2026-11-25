"""Editor pack of the 9:16 reel template: PNG overlays with alpha (camera holes), frame-only overlay, previews.
run: python3 edprod/projects/2026-11-11-reel-template/export_pack.py  -> out/pack/
"""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import template as T

OUT = os.path.join(T.OUT, "pack")
os.makedirs(OUT, exist_ok=True)
KEY = np.array([1.0, 0.0, 1.0], np.float32)          # magenta = the hole


def save_rgba(f, alpha, name):
    rgba = np.dstack([np.clip(f, 0, 1), np.clip(alpha, 0, 1)])
    Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), "RGBA").save(os.path.join(OUT, name))


def with_hole(state, numbers=True):
    r = T.layout_rects(state)
    f = T.reel_frame()
    T.badge_building(f)
    if numbers:
        T.tag_example(f)
    x0, y0, x1, y1 = r["camera"]
    T.camera_window(f, r["camera"], label="", content=np.ones((y1 - y0, x1 - x0, 3), np.float32) * KEY)
    hole = (np.abs(f - KEY).sum(2) < 0.02).astype(np.float32)
    # soften the hole edge by the antialiased mask: pixels mixing magenta are partly transparent
    mix = np.clip(1 - np.abs(f - KEY).sum(2) / 0.6, 0, 1) * (f[..., 1] < 0.35)
    alpha = 1 - np.maximum(hole, mix * (np.abs(f[..., 0] - f[..., 2]) < 0.15))
    f = np.where(alpha[..., None] < 1, f * 0, f)        # no magenta fringe left in colour
    # hole = the exact rounded mask (no key fringe), then the cyan border redrawn on top with its own alpha
    w, h = x1 - x0, y1 - y0
    m = T.rr_mask(w, h, 30)[..., 0]
    alpha[y0:y1, x0:x1] = np.minimum(alpha[y0:y1, x0:x1], 1 - m)
    alpha[y0:y1, x0:x1] = np.where(m > 0.999, 0, np.maximum(alpha[y0:y1, x0:x1], (1 - m)))
    bd = T._f(T.rrect(w, h, 30, line=T.CAM_CYAN, lw=2.5))
    ba = bd[..., 3]
    reg, ra = f[y0:y1, x0:x1], alpha[y0:y1, x0:x1]
    na = ba + ra * (1 - ba)
    f[y0:y1, x0:x1] = (bd[..., :3] * ba[..., None] + reg * ra[..., None] * (1 - ba[..., None])) / np.maximum(na[..., None], 1e-3)
    alpha[y0:y1, x0:x1] = na
    if state == "R1":                                   # lower third on top, with its own alpha (black/white trick)
        b, w = np.zeros_like(f), np.ones_like(f)
        T.lower_third(b, r["lower_third"]); T.lower_third(w, r["lower_third"])
        la = np.clip(1 - (w - b).mean(2), 0, 1)
        lc = np.where(la[..., None] > 0, np.clip(b / np.maximum(la[..., None], 1e-3), 0, 1), 0)
        out_a = la + alpha * (1 - la)
        f = np.where(out_a[..., None] > 0, (lc * la[..., None] + f * alpha[..., None] * (1 - la[..., None])) / np.maximum(out_a[..., None], 1e-3), 0)
        alpha = out_a
    return f, alpha


# 1 · frame only, transparent inside (luminance key) — put it ABOVE any video
fr = T.reel_frame()
a = np.clip((fr.max(2) - 0.035) / 0.30, 0, 1)
col = np.where(a[..., None] > 0, np.clip(fr / np.maximum(a[..., None], 1e-3), 0, 1), 0)
save_rgba(col, a, "01-frame-only-transparent.png")
# 2 · the dark frame (background)
Image.fromarray((np.clip(T.reel_frame(), 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, "02-frame-background.png"))
# 3/4 · R1 and R2 with the camera window as a transparent hole
for st, nm in (("R1", "03-R1-motion-big-camera-small-HOLE.png"), ("R2", "04-R2-camera-big-HOLE.png")):
    f, al = with_hole(st)
    save_rgba(f, al, nm)
# previews + safe zones
for src, nm in (("R1-motion-camera.png", "05-preview-R1.png"), ("R2-camera-big.png", "06-preview-R2.png"),
                ("R3-full-card.png", "07-preview-R3-card.png"), ("safe-overlay.png", "08-safe-zones.png")):
    Image.open(os.path.join(T.OUT, src)).save(os.path.join(OUT, nm))
print("ok", OUT)
