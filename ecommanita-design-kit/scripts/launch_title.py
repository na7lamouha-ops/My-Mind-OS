"""Launch title screen 16:9 on the master template: live kicker, big title (blue→orange glow), tagline, code CTA.
All text typed by the script (Tajawal / Archivo); logo, controller and frame come from out/master-slide.png untouched.
Usage: launch_title.py "TITLE" "TAGLINE" OUT.png [KICKER]"""
import os
import sys
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

TITLE, TAG, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
KICKER = sys.argv[4] if len(sys.argv) > 4 else "مباشر · ضربة البداية"
KIT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = KIT + "/fonts"
W, H, Z = 1920, 1080, 2
CY = np.array([40, 215, 255], np.float32); OR = np.array([255, 120, 20], np.float32)
HOT = np.array([255, 240, 215], np.float32)

canvas = cv2.resize(cv2.cvtColor(cv2.imread(KIT + "/out/master-slide.png"), cv2.COLOR_BGR2RGB),
                    (W * Z, H * Z), interpolation=cv2.INTER_CUBIC).astype(np.float32)
h2, w2 = canvas.shape[:2]


def add(mask, color, k=1.0, radii=((18, .9), (6, .8))):
    global canvas
    g = sum(cv2.GaussianBlur(mask, (0, 0), r * Z) * w for r, w in radii)
    col = np.asarray(color, np.float32)
    canvas = np.clip(canvas + g[..., None] * (col if col.ndim == 3 else col[None, None]) * k, 0, 255)


def paint(mask, color, a=1.0):
    global canvas
    col = np.asarray(color, np.float32)
    canvas = canvas * (1 - mask[..., None] * a) + (col if col.ndim == 3 else col[None, None]) * mask[..., None] * a


def F(name, size): return ImageFont.truetype(f"{FONTS}/Tajawal-{name}.ttf", int(size * Z))


def LF(size, wg=800):
    f = ImageFont.truetype(f"{FONTS}/Archivo-VF.ttf", int(size * Z)); f.set_variation_by_axes([wg, 100]); return f


def text_mask(t, font, x, y, rtl=True):
    im = Image.new("L", (w2, h2), 0); d = ImageDraw.Draw(im)
    kw = {"direction": "rtl"} if rtl else {}
    l, tp, r, b = d.textbbox((0, 0), t, font=font, **kw)
    d.text((x * Z - (r - l) / 2 - l, y * Z - (b - tp) / 2 - tp), t, font=font, fill=255, **kw)
    return np.array(im, np.float32) / 255, (r - l) / Z


def rrect_mask(x0, y0, x1, y1, r, outline=0):
    m = Image.new("L", (w2, h2), 0)
    ImageDraw.Draw(m).rounded_rectangle([x0 * Z, y0 * Z, x1 * Z, y1 * Z], radius=r * Z,
                                        **({"outline": 255, "width": int(outline * Z)} if outline else {"fill": 255}))
    return np.array(m, np.float32) / 255


# horizontal blue → orange ramp (the template's two sides)
ramp = np.clip((np.arange(w2) / w2 - 0.3) / 0.4, 0, 1)[None, :, None]
GRAD = CY[None, None] * (1 - ramp) + OR[None, None] * ramp

# ---------- kicker (live pill, like the HUD) ----------
km, kw_ = text_mask(KICKER, F("Bold", 26), W / 2 - 14, 268)
pw = kw_ + 110
paint(rrect_mask(W / 2 - pw / 2, 242, W / 2 + pw / 2, 294, 26), (8, 12, 14), 0.88)
paint(rrect_mask(W / 2 - pw / 2, 242, W / 2 + pw / 2, 294, 26, outline=1.5), (70, 90, 98))
dm = np.zeros((h2, w2), np.float32)
cv2.circle(dm, (int((W / 2 + pw / 2 - 26) * Z), int(268 * Z)), int(7 * Z), 1.0, -1, cv2.LINE_AA)
add(dm, (255, 50, 50), 0.9, ((8, .8),)); paint(dm, (240, 50, 50))
paint(km, (225, 230, 232))

# ---------- title: shadow, two-colour bloom, hot white core with a faint gradient rim ----------
tm, tw = text_mask(TITLE, F("ExtraBold", 190), W / 2, 450)
paint(cv2.GaussianBlur(np.roll(tm, 4 * Z, axis=0), (0, 0), 8 * Z), (0, 0, 0), 0.85)
add(tm, GRAD, 1.0, ((60, .6), (22, .9), (7, .8)))
rim = np.clip(cv2.dilate(tm, np.ones((3 * Z, 3 * Z), np.uint8)) - tm, 0, 1)
paint(rim, GRAD, 0.9)
paint(tm, HOT * 0.35 + 255 * 0.65)

# ---------- tagline ----------
gm, gw = text_mask(TAG, F("Bold", 46), W / 2, 618)
paint(cv2.GaussianBlur(np.roll(gm, 2 * Z, axis=0), (0, 0), 3 * Z), (0, 0, 0), 0.8)
paint(gm, (232, 236, 238))

# ---------- CTA: «احجز فيزا اللعبة» | code ecommanita (as on the key poster) ----------
cta_m, cta_w = text_mask("احجز فيزا اللعبة", F("ExtraBold", 32), 0, 0)
code_m, code_w = text_mask("ecommanita", LF(30), 0, 0, rtl=False)
bw = cta_w + code_w + 130
x0, y0, y1 = W / 2 - bw / 2, 700, 770
xs = x0 + code_w + 60                                    # split: code box on the left, orange action on the right
paint(rrect_mask(x0, y0, x0 + bw, y1, 18), (10, 9, 8), 0.92)
paint(rrect_mask(xs, y0, x0 + bw, y1, 18), OR)
ring = rrect_mask(x0, y0, x0 + bw, y1, 18, outline=2.5)
add(ring, GRAD, 0.7, ((14, .8), (4, .6))); paint(ring, GRAD)
add(rrect_mask(xs, y0, x0 + bw, y1, 18), OR, 0.35, ((20, .8),))
paint(text_mask("احجز فيزا اللعبة", F("ExtraBold", 32), (xs + x0 + bw) / 2, (y0 + y1) / 2)[0], (20, 10, 4))
cm = text_mask("ecommanita", LF(30), (x0 + xs) / 2, (y0 + y1) / 2 - 2, rtl=False)[0]
add(cm, OR, 0.5, ((8, .8),)); paint(cm, (255, 170, 90))

Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8)).resize((W, H), Image.LANCZOS).save(OUT)
print(OUT, f"title {tw:.0f}px, tagline {gw:.0f}px")
