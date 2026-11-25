"""Render a photoreal-ish rifle cartridge sprite (RGBA) with ECOMMANITA engraved on the brass case.

Surface of revolution around the x axis, shaded with a studio environment map
(soft-box key on top, kicker strip below), metal tinting, lathe marks, and a
bump-mapped engraving.
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

out = sys.argv[1]
LABEL = sys.argv[2] if len(sys.argv) > 2 else "ECOMMANITA"
D = 360                      # diameter in px
L_D = 4.68                   # length / diameter
L = int(D * L_D)
PAD = 8
W, H = L + 2 * PAD, D + 2 * PAD
SS = 2                       # supersample
Ws, Hs, Ds = W * SS, H * SS, D * SS
R = Ds / 2

# ---- profile r(u), u = x / D (0 = rim/back, L_D = tip) -----------------------
def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

u = (np.arange(Ws) / SS - PAD) / D
r = np.zeros_like(u)
rim = (u >= 0) & (u < 0.09)
r[rim] = 0.492 - 0.03 * (1 - smooth(0.0, 0.018, u[rim])) - 0.03 * smooth(0.07, 0.09, u[rim])
grv = (u >= 0.09) & (u < 0.22)
r[grv] = 0.40 + 0.085 * smooth(0.16, 0.22, u[grv])
body = (u >= 0.22) & (u < 2.55)
r[body] = 0.485 - 0.02 * (u[body] - 0.22) / 2.33
sh = (u >= 2.55) & (u < 2.82)
r[sh] = 0.465 - 0.15 * smooth(2.55, 2.82, u[sh])
neck = (u >= 2.82) & (u < 3.20)
r[neck] = 0.315
bear = (u >= 3.20) & (u < 3.62)
r[bear] = 0.300
can = (u >= 3.34) & (u < 3.40)
r[can] -= 0.012 * np.sin(np.pi * (u[can] - 3.34) / 0.06)
og = (u >= 3.62) & (u <= L_D)
t = (u[og] - 3.62) / (L_D - 3.62)
r[og] = 0.300 * np.clip(1 - t ** 1.9, 0, 1) ** 0.62
r[og] = np.maximum(r[og], 0.0)
r[u > L_D] = 0
r[u < 0] = 0
rpx = r * Ds
dr = np.gradient(rpx)  # dr/dx in px/px

is_proj = u >= 3.20

# ---- per-pixel geometry ------------------------------------------------------
yy = (np.arange(Hs) - Hs / 2 + 0.5)[:, None]
rp = rpx[None, :]
inside = np.abs(yy) < rp
s = np.clip(yy / np.maximum(rp, 1e-6), -1, 1)       # sin(theta), +down
c = np.sqrt(1 - s ** 2)
nx = -np.broadcast_to(dr[None, :], s.shape) * c     # slope normal component
ny = s.copy()
nz = c.copy()

# ---- engraving height map (in (x, arc) texture space, mapped on cylinder) ---
tex_h = int(np.pi * R)                               # half circumference visible
txt = Image.new("L", (Ws, tex_h * 2), 0)
d = ImageDraw.Draw(txt)
font = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf", int(Ds * 0.29))
label = LABEL
x0p, x1p = (PAD + 0.40 * D) * SS, (PAD + 2.40 * D) * SS
bbox = d.textbbox((0, 0), label, font=font)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
# letter-space to fill the case body
spacing = ((x1p - x0p) - tw) / (len(label) - 1)
xcur = x0p
for ch in label:
    cb = d.textbbox((0, 0), ch, font=font)
    d.text((xcur - cb[0], tex_h - th / 2 - bbox[1]), ch, font=font, fill=255)
    xcur += (cb[2] - cb[0]) + spacing
eng = np.asarray(txt.filter(ImageFilter.GaussianBlur(SS * 1.6)), dtype=np.float32) / 255
eng_sharp = np.asarray(txt.filter(ImageFilter.GaussianBlur(SS * 0.6)), dtype=np.float32) / 255
theta = np.arcsin(s)
arc = (theta * R + tex_h).astype(int).clip(0, 2 * tex_h - 1)
cols = np.broadcast_to(np.arange(Ws)[None, :], arc.shape)
hmap = eng[arc, cols] * (~np.broadcast_to(is_proj[None, :], arc.shape))
hsharp = eng_sharp[arc, cols] * (~np.broadcast_to(is_proj[None, :], arc.shape))
gy, gx = np.gradient(-hmap)
k = 6.0
nx = nx - k * gx
ny = ny - k * gy
n = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
nx, ny, nz = nx / n, ny / n, nz / n

# ---- environment lighting ----------------------------------------------------
# reflection of view (0,0,1)
rx, ry, rz = 2 * nz * nx, 2 * nz * ny, 2 * nz * nz - 1
up = -ry
env = (
    0.03
    + 2.4 * smooth(0.30, 0.55, up) * (1 - smooth(0.80, 0.97, up))     # top soft-box
    + 0.55 * np.exp(-((up + 0.45) / 0.12) ** 2)                      # bottom kicker strip
    + 0.35 * np.exp(-((rx - 0.55) / 0.35) ** 2) * (up > -0.2)        # warm side fill (right)
    + 0.15 * smooth(-0.2, 0.3, rz)
)
# point-light speculars
for lx, ly, lz, p, a in [(-0.35, -0.75, 0.55, 60, 1.6), (0.6, 0.35, 0.7, 25, 0.35)]:
    ln = np.sqrt(lx * lx + ly * ly + lz * lz)
    hx, hy, hz = lx / ln, ly / ln, (lz / ln + 1)
    hn = np.sqrt(hx * hx + hy * hy + hz * hz)
    env = env + a * np.clip((nx * hx + ny * hy + nz * hz) / hn, 0, 1) ** p

rng = np.random.default_rng(7)
lathe = 1 + 0.06 * np.convolve(rng.standard_normal(Ws), np.ones(5) / 5, "same")[None, :]
grain = 1 + 0.035 * rng.standard_normal((Hs, Ws))
env = env * lathe * grain

brass = np.array([0.97, 0.74, 0.34])
copper = np.array([0.86, 0.46, 0.27])
base = np.where(np.broadcast_to(is_proj[None, :, None], (Hs, Ws, 1)), copper, brass)
# patina / dirt inside engraving and in the extractor groove
occl = 1 - 0.72 * hsharp
groove = (u >= 0.09) & (u < 0.17)
occl = occl * (1 - 0.35 * groove[None, :])
fres = 0.25 + 0.75 * (1 - nz) ** 3
col = base[..., :] * (env * occl)[..., None] * (1 - 0.15 * fres[..., None]) + 0.06 * fres[..., None]
col = 1 - np.exp(-1.25 * col)                       # filmic tone map
col = col ** (1 / 1.05)

# ---- alpha with AA, downsample ----------------------------------------------
alpha = np.clip(rp - np.abs(yy) + 0.5, 0, 1)
rgba = np.dstack([np.clip(col, 0, 1) * alpha[..., None], alpha])
img = Image.fromarray((rgba * 255).astype(np.uint8), "RGBA").resize((W, H), Image.LANCZOS)
# un-premultiply
a = np.asarray(img).astype(np.float32)
al = a[..., 3:4] / 255
a[..., :3] = np.where(al > 0, a[..., :3] / np.maximum(al, 1e-3), 0)
Image.fromarray(a.clip(0, 255).astype(np.uint8), "RGBA").save(out)
print("sprite", W, H, "rim_x", PAD, "diam", D)
