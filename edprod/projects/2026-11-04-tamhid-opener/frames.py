"""Opener «من الخلية للاندلاع» — 10 storyboard key frames (16:9).
run from repo root: python3 edprod/projects/2026-11-04-tamhid-opener/frames.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from opener_lib import *  # noqa
OUT = "out/tamhid-opener/frames"
os.makedirs(OUT, exist_ok=True)

# ================================================================ frames ========
def F(n, t, label, f):
    f = grain(vignette(f))
    tag(f, n, t, label)
    Image.fromarray((np.clip(f, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, f"frame_{n:02d}.png"))
    print("frame", n)


black = lambda: np.zeros((H2, W2, 3), np.float32)

# 01 black + heartbeat
f = black()
glow(f, CX, CY, 300, (60, 20, 20), 0.10)
F(1, "0.0", "كحل · نبضة قلب", f)

# 02 al-KHALiYA assembling (mid-way)
f = black()
kh_layer(f, "ring", a=0.85, s=1.0)
kh_layer(f, "hanger", dy=-140, a=0.55)
kh_layer(f, "shirt_l", dx=-170, dy=40, a=0.6)
kh_layer(f, "shirt_r", dx=170, dy=40, a=0.6)
kh_layer(f, "text", dy=60, a=0.25)
glow(f, *HEX_C, 260, (255, 200, 110), 0.10)
F(2, "0.5 – 1.7", "الخلية تتركّب قطعة بقطعة · تك… تك…", f)

# 03 honeycomb lights up from the centre
f = black() + honeycomb(0.55) * 0.55
kh_full(f)
glow(f, *HEX_C, 300, (255, 200, 110), 0.10)
F(3, "1.7 – 2.5", "الخلايا تشعل وحدة بوحدة · طنين النحل", f)

# 04 the bullet enters from the left
f = black() + honeycomb(1.0) * 0.45
kh_full(f)
bullet_at(f, 470, HEX_C[1], spin=0.6)
for k in range(1, 6):                                    # faint light trail
    glow(f, 470 - 180 - k * 60, HEX_C[1], 22 - k * 3, (255, 220, 170), 0.10)
F(4, "2.5 – 3.7", "الرصاصة تدخل من اليسار بالشوية · بلا طلقة", f)

# 05 the touch: gold turns blue / orange
f = black() + honeycomb(1.0, colour_split=True) * 0.65
kh_full(f)
bw = scaled(BULLET, 0.42).shape[1]
bullet_at(f, HEX_C[0] - bw / 2 + 20, HEX_C[1], halo=1.4)
glow(f, *HEX_C, 40, (255, 255, 255), 1.2)
F(5, "3.7 – 3.9", "اللمسة · فريم يتجمّد · سكوت تام", f)

# 06 eruption: the cell opens like a chrysalis + teaser sparks
f = black() + honeycomb(1.0, colour_split=True, crack=0.5) * 0.7
kh_layer(f, "ring", s=1.25, a=0.45)
kh_layer(f, "hanger", dy=-120, a=0.35)
kh_layer(f, "shirt_l", dx=-150, dy=30, a=0.35)
kh_layer(f, "shirt_r", dx=150, dy=30, a=0.35)
sparks(f, *HEX_C)
F(6, "3.9 – 4.6", "الاندلاع · الخلية تتفتح · شرارات التيزر", f)

# 07 ecommanita logo born from the light
f = black() + honeycomb(1.0, colour_split=True, crack=1.0) * 0.25
glow(f, *HEX_C, 420, (255, 200, 150), 0.35)
lg = scaled(LOGO, 900 / LOGO.shape[1])
over(f, lg, CX - lg.shape[1] / 2, HEX_C[1] - lg.shape[0] / 2)
F(7, "4.6 – 5.4", "لوغو ecommanita يطلع من الضو · ووش", f)

# 08 logo travels up + beams draw the frame
f = frame_reveal(0.55)
lg = scaled(LOGO, 620 / LOGO.shape[1])
over(f, lg, CX - lg.shape[1] / 2, 180 - lg.shape[0] / 2)
for side, col in ((-1, BLUE), (1, ORANGE)):          # beam heads
    a = 0.55 * math.pi
    hx, hy = W2 / 2 + side * 1000 * math.sin(a), H2 / 2 - 600 * math.cos(a)
    hx = min(max(hx, 55), W2 - 55)
    glow(f, hx, hy, 40, col, 1.4)
    glow(f, hx, hy, 140, col, 0.35)
F(8, "5.4 – 6.6", "اللوقو يطلع · الأشعة ترسم الإطار · زاپ زاپ", f)

# 09 beams meet at the bottom, controller lights up
f = MASTER.copy()
glow(f, CX, 1000, 220, BLUE, 0.30)
glow(f, CX - 20, 935, 26, (255, 255, 255), 0.9)
F(9, "6.6 – 7.4", "الأشعة تتلاقى تحت · المانيطة تشعل · رنّة تسيير", f)

# 10 final = master-eclairs + gold hex dust fading
f = MASTER.copy() + honeycomb(1.0) * 0.06
for _ in range(160):
    glow(f, rng.uniform(80, W2 - 80), rng.uniform(150, 900), rng.uniform(0.8, 2.0), (255, 205, 120), rng.uniform(0.05, 0.35))
F(10, "7.4 – 8.5", "الخلفية master-eclairs · غبرة ذهبية · صوت النحلة", f)

files = [os.path.join(OUT, f"frame_{i:02d}.png") for i in range(1, 11)]
sheet = Image.new("RGB", (480 * 2 + 30, 270 * 5 + 60), (12, 12, 14))
for i, p in enumerate(files):
    sheet.paste(Image.open(p).resize((480, 270), Image.LANCZOS), (10 + (i % 2) * 490, 10 + (i // 2) * 280))
sheet.save(os.path.join(OUT, "storyboard.png"))
print("ok")
