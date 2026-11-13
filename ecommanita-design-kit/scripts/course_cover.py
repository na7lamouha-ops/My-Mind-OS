"""Course cover 16:9 from the key visual + 'كود حجز فيزا اللعبة' code chip."""
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter

import os
KIT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = KIT + "/fonts"
SRC = KIT + "/assets/course-logo-key.png"
OUT = KIT + "/out/course-cover-16x9.png"
W, H, Z = 1920, 1080, 2
IMG_H = 965

src = cv2.imread(SRC, cv2.IMREAD_COLOR)
sh, sw = src.shape[:2]
iw = round(sw * IMG_H / sh)
scene = cv2.resize(src, (iw * Z, IMG_H * Z), interpolation=cv2.INTER_LANCZOS4)
scene = cv2.addWeighted(scene, 1.35, cv2.GaussianBlur(scene, (0, 0), 2.2 * Z), -0.35, 0)   # gentle sharpen after upscale
padx = (W - iw) // 2
# extend sides by mirroring (vertical light curtains mirror naturally), extend bottom with the dark floor
canvas = cv2.copyMakeBorder(scene, 0, (H - IMG_H) * Z, padx * Z, (W - iw - padx) * Z, cv2.BORDER_REFLECT)
canvas = canvas.astype(np.float32)
ys = np.arange(H * Z)[:, None, None]
fade = np.clip((ys - (IMG_H - 70) * Z) / (110 * Z), 0, 1)
canvas = canvas * (1 - 0.85 * fade)            # floor darkens toward the bottom band
canvas = cv2.resize(canvas, (W * Z, H * Z))
im = Image.fromarray(cv2.cvtColor(np.clip(canvas, 0, 255).astype(np.uint8), cv2.COLOR_BGR2RGB)).convert("RGBA")


def layer():
    return Image.new("RGBA", im.size, (0, 0, 0, 0))


def bbox(t, f, rtl=True):
    return ImageDraw.Draw(Image.new("L", (1, 1))).textbbox((0, 0), t, font=f, **({"direction": "rtl"} if rtl else {}))


def text(x, cy, t, f, fill, anchor="c", rtl=True):
    l, tp, r, b = bbox(t, f, rtl)
    X = x * Z
    px = X - (r - l) / 2 - l if anchor == "c" else (X - (r - l) - l if anchor == "r" else X - l)
    py = cy * Z - (b - tp) / 2 - tp
    L = layer(); ImageDraw.Draw(L).text((px, py), t, font=f, fill=fill, **({"direction": "rtl"} if rtl else {}))
    im.alpha_composite(L)


# ---------- code chip: [copy] ecommanita | كود حجز فيزا اللعبة ----------
lab_f = ImageFont.truetype(f"{FONTS}/Tajawal-ExtraBold.ttf", int(30 * Z))
code_f = ImageFont.truetype(f"{FONTS}/Archivo-VF.ttf", int(32 * Z)); code_f.set_variation_by_axes([850, 118])
LAB = "كود حجز فيزا اللعبة"
l, tp, r, b = bbox(LAB, lab_f); lab_w = (r - l) / Z
cl, ctp, cr, cb = bbox("ecommanita", code_f, False); code_w = (cr - cl) / Z
seg_w = lab_w + 56
left_w = code_w + 100
bw, bh = seg_w + left_w, 66
cx, cy = W / 2, 1018
x0, y0, x1, y1 = cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2
seg = x1 - seg_w
L = layer()
ImageDraw.Draw(L).rounded_rectangle([x0 * Z, y0 * Z, x1 * Z, y1 * Z], radius=18 * Z, outline=(255, 122, 26, 230), width=16)
im.alpha_composite(L.filter(ImageFilter.GaussianBlur(12 * Z)))
L = layer()
ImageDraw.Draw(L).rounded_rectangle([x0 * Z, y0 * Z, x1 * Z, y1 * Z], radius=18 * Z, fill=(12, 11, 10, 245), outline=(255, 140, 46, 255), width=3 * Z)
im.alpha_composite(L)
segw, segh = int(seg_w * Z), int(bh * Z)
gx = np.linspace(0, 1, segw)[None, :, None]
grad = (np.array([255, 150, 50]) * (1 - gx) + np.array([235, 95, 20]) * gx).repeat(segh, axis=0).astype(np.uint8)
gimg = Image.fromarray(grad, "RGB").convert("RGBA")
shape = Image.new("L", (segw, segh), 0)
ImageDraw.Draw(shape).rounded_rectangle([-40, 0, segw - 1, segh - 1], radius=18 * Z, fill=255)
gimg.putalpha(shape)
L = layer(); L.paste(gimg, (int(seg * Z), int(y0 * Z)), gimg); im.alpha_composite(L)
text((seg + x1) / 2, cy + 1, LAB, lab_f, (255, 255, 255, 255))
# code with glow
cxl = x0 + 58
m = Image.new("L", im.size, 0)
ImageDraw.Draw(m).text((cxl * Z - cl, cy * Z - (cb + ctp) / 2), "ecommanita", font=code_f, fill=255)
g = layer(); g.paste(Image.new("RGBA", im.size, (255, 122, 26, 255)), (0, 0), m)
im.alpha_composite(g.filter(ImageFilter.GaussianBlur(8 * Z)))
L = layer(); ImageDraw.Draw(L).text((cxl * Z - cl, cy * Z - (cb + ctp) / 2), "ecommanita", font=code_f, fill=(255, 150, 60, 255))
im.alpha_composite(L)
# copy icon
ix = x0 + 28
L = layer(); d = ImageDraw.Draw(L)
d.rounded_rectangle([(ix - 9) * Z, (cy - 11) * Z, (ix + 5) * Z, (cy + 5) * Z], radius=3 * Z, outline=(200, 200, 204, 235), width=4)
d.rounded_rectangle([(ix - 4) * Z, (cy - 5) * Z, (ix + 10) * Z, (cy + 11) * Z], radius=3 * Z, fill=(12, 11, 10, 255), outline=(238, 238, 240, 255), width=4)
im.alpha_composite(L)

im.convert("RGB").resize((W, H), Image.LANCZOS).save(OUT)
print(OUT)
