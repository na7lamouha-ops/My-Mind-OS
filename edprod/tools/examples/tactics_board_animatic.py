"""«اندلاع الدورة» · Episode 01 «حماية مواردك» — animatic (45 s, 1080x1920).

usage: render_ep01.py <v4_hq_video.mp4> <tajawal_dir> <out_dir> [preview_dir]
writes <out_dir>/ep01_guide.mp4 (with commentator subtitles) and ep01_clean.mp4
"""
import math
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as nd

V4, FONTS, OUTD = sys.argv[1:4]
PREV = sys.argv[4] if len(sys.argv) > 4 else None
W, H, FPS = 1080, 1920, 30
TOTAL = 45 * FPS
RAQM = ImageFont.Layout.RAQM


def F(w, s): return ImageFont.truetype(f"{FONTS}/Tajawal-{w}.ttf", s, layout_engine=RAQM)


def clamp01(x): return min(1.0, max(0.0, x))
def eio(x): x = clamp01(x); return 3 * x * x - 2 * x ** 3
def eout(x): x = clamp01(x); return 1 - (1 - x) ** 2


RED = (235, 60, 60)
CYANc = (85, 214, 255)
ORNG = (255, 148, 40)
GOLD = (255, 205, 90)
WHT = (240, 244, 250)
YEL = (255, 215, 40)

# ------------------------------------------------------------------ pitch ------
YF, YN, WF, WN = 660, 1460, 620, 1020


def P(u, v):
    """pitch coords (u: 0 left..1 right, v: 0 far..1 near) -> screen."""
    w = WF + (WN - WF) * v
    return 540 + (u - 0.5) * w, YF + (YN - YF) * v


def scale_at(v): return 0.62 + 0.38 * v


def pitch_base():
    im = Image.new("RGB", (W, H), (4, 7, 14))
    d = ImageDraw.Draw(im)
    # stripes
    for k in range(10):
        v0, v1 = k / 10, (k + 1) / 10
        c = (10, 26, 38) if k % 2 else (8, 22, 33)
        d.polygon([P(0, v0), P(1, v0), P(1, v1), P(0, v1)], fill=c)
    lw = 3
    L = (150, 200, 225)
    d.line([P(0, 0), P(1, 0), P(1, 1), P(0, 1), P(0, 0)], fill=L, width=lw)
    d.line([P(0, 0.5), P(1, 0.5)], fill=L, width=lw)
    pts = [P(0.5 + 0.13 * math.cos(a), 0.5 + 0.09 * math.sin(a)) for a in np.linspace(0, 2 * np.pi, 80)]
    d.line(pts + [pts[0]], fill=L, width=lw)
    for vb, s in [(0, 1), (1, -1)]:
        d.line([P(0.25, vb), P(0.25, vb + s * 0.16), P(0.75, vb + s * 0.16), P(0.75, vb)], fill=L, width=lw)
        d.line([P(0.38, vb), P(0.38, vb + s * 0.06), P(0.62, vb + s * 0.06), P(0.62, vb)], fill=L, width=lw)
    a = np.asarray(im).astype(np.float32) / 255
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    a *= (0.55 + 0.45 * np.exp(-(((xx - 540) / 700) ** 2 + ((yy - 1080) / 700) ** 2)))[..., None]
    # stadium light haze + side light bars
    a += (np.exp(-((yy - 560) / 240) ** 2) * 0.05)[..., None] * np.array([0.5, 0.7, 1.0], np.float32)
    for xb, col in [(36, CYANc), (W - 36, ORNG)]:
        a += (np.exp(-((xx - xb) / 9) ** 2) * 0.35 * np.clip(1 - np.abs(yy - 900) / 1100, 0, 1))[..., None] * np.array(col, np.float32) / 255
    return a


PITCH = pitch_base()
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)


def txt(d, xy, s, fnt, col, anchor="mm", alpha=255):
    d.text(xy, s, font=fnt, fill=col + (int(alpha),), anchor=anchor, direction="rtl" if any('؀' <= ch <= 'ۿ' for ch in s) else None)


def player(d, g, u, v, col, label=None, a=1.0, fnt=None, ring=True, fade_lbl=1.0):
    x, y = P(u, v)
    s = scale_at(v)
    A = int(255 * a)
    if ring:
        rx, ry = 46 * s, 15 * s
        d.ellipse([x - rx, y - ry, x + rx, y + ry], outline=col + (A,), width=max(2, int(4 * s)))
        g.ellipse([x - rx, y - ry, x + rx, y + ry], outline=col + (A,), width=int(8 * s))
    # figure: body capsule + head
    bw, bh, hr = 26 * s, 62 * s, 13 * s
    d.rounded_rectangle([x - bw / 2, y - bh, x + bw / 2, y - 6 * s], radius=bw / 2, fill=col + (A,))
    d.ellipse([x - hr, y - bh - 2 * hr - 2, x + hr, y - bh - 2], fill=col + (A,))
    g.rounded_rectangle([x - bw / 2, y - bh, x + bw / 2, y - 6 * s], radius=bw / 2, fill=col + (int(A * 0.6),))
    if label:
        txt(d, (x, y + 34 * s), label, fnt or F("Bold", int(34 * s)), WHT, alpha=255 * a * fade_lbl)


def dashed(d, g, p0, p1, col, prog=1.0, a=1.0, width=5, dash=22, gap=14, head=True):
    x0, y0 = p0
    x1, y1 = p1
    L = math.hypot(x1 - x0, y1 - y0)
    if L < 1 or prog <= 0:
        return
    ux, uy = (x1 - x0) / L, (y1 - y0) / L
    end = L * clamp01(prog)
    s = 0.0
    while s < end:
        e = min(end, s + dash)
        d.line([(x0 + ux * s, y0 + uy * s), (x0 + ux * e, y0 + uy * e)], fill=col + (int(255 * a),), width=width)
        g.line([(x0 + ux * s, y0 + uy * s), (x0 + ux * e, y0 + uy * e)], fill=col + (int(200 * a),), width=width * 3)
        s += dash + gap
    if head and prog > 0.05:
        hx, hy = x0 + ux * end, y0 + uy * end
        px, py = -uy, ux
        d.polygon([(hx + ux * 14, hy + uy * 14), (hx - ux * 12 + px * 12, hy - uy * 12 + py * 12),
                   (hx - ux * 12 - px * 12, hy - uy * 12 - py * 12)], fill=col + (int(255 * a),))


def star(d, g, cx, cy, r, col, a=1.0, dashed_outline=False):
    pts = []
    for k in range(10):
        ang = -math.pi / 2 + k * math.pi / 5
        rr = r if k % 2 == 0 else r * 0.45
        pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
    if dashed_outline:
        for i in range(10):
            if i % 2 == 0:
                d.line([pts[i], pts[(i + 1) % 10]], fill=col + (int(255 * a),), width=4)
    else:
        d.polygon(pts, fill=col + (int(255 * a),))
        g.polygon(pts, fill=col + (int(220 * a),))


def big_x(d, g, cx, cy, r, prog, a=1.0):
    p1 = clamp01(prog * 2)
    p2 = clamp01(prog * 2 - 1)
    for (sx, sy, ex, ey, p) in [(-1, -1, 1, 1, p1), (1, -1, -1, 1, p2)]:
        if p > 0:
            d.line([(cx + sx * r, cy + sy * r), (cx + sx * r + (ex - sx) * r * p, cy + sy * r + (ey - sy) * r * p)], fill=RED + (int(255 * a),), width=12)
            g.line([(cx + sx * r, cy + sy * r), (cx + sx * r + (ex - sx) * r * p, cy + sy * r + (ey - sy) * r * p)], fill=RED + (int(255 * a),), width=26)


def card(d, g, cx, cy, s, a=1.0, rot=0):
    w, h = 44 * s, 62 * s
    d.rounded_rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], radius=6, fill=YEL + (int(255 * a),))
    g.rounded_rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], radius=6, fill=YEL + (int(200 * a),))


# ------------------------------------------------------------- positions ------
OPP = (0.5, 0.06)
SPY = (0.25, 0.20)
COPY = (0.75, 0.20)
STAR_US = (0.63, 0.78)
ATT = [("المكرّر", 0.18, 0.44), ("5 أرقام", 0.39, 0.37), ("الروبو", 0.61, 0.37), ("الرافض", 0.82, 0.44)]
GOAL = (0.5, 1.0)
CONF = (0.5, 0.86)
SPAM_XY = (965, 1090)

# ---------------------------------------------------------- top texts --------
F_BIG = F("ExtraBold", 120)
F_MID = F("ExtraBold", 74)
F_SM = F("Medium", 40)
F_LBL = F("Bold", 34)
F_SUB = F("Medium", 34)

SUBS = [  # commentator guide (animatic only)
    (3.0, 8.0, "مساء الخير يا جماعة... كي تبدا تنجح، أول واحد يلاحظ... ماشي الكليان. الخصم."),
    (8.0, 14.0, "شوفو شوفو! راهو يعسّك... كل إعلان، كل حركة! وها هو... جاب نفس المنتوج، ووقف قدامك!"),
    (14.0, 19.5, "وكي ما قدرش يغلبك بالمنتوج... هجوم! المكرّر... صاحب الخمس أرقام... الروبو... والرافض!"),
    (19.5, 25.5, "هدف في شباكك! كل طلبية مزيّفة تاكل: فلوسك... وقتك... سلعتك... والأخطر؟ قرارك."),
    (25.5, 31.0, "هنا الدرس يا جماعة... العين ما تتحبسش، والتقليد ما يتحبسش... بصح الشباك؟ الشباك تتحمى."),
    (31.0, 38.0, "الصافرة الأولى! المكرّر... مقطوع! الخمس أرقام... مقطوع! الروبو والرافض؟ بطاقة صفرا! المؤكّدة تعيّطلهم قبل ما تأكّد."),
    (38.0, 43.0, "هذي ماشي وعود... هذي تسيير، تخدم اليوم. القوة ماشي اللي يقول... القوة اللي يحبس!"),
    (43.0, 45.0, "علّق دفاع... ونبعتلك الخطة."),
]


def wrap(s, fnt, maxw):
    words = s.split(" ")
    lines, cur = [], ""
    d = ImageDraw.Draw(Image.new("L", (10, 10)))
    for wd in words:
        t = (cur + " " + wd).strip()
        if d.textlength(t, font=fnt, direction="rtl") > maxw and cur:
            lines.append(cur)
            cur = wd
        else:
            cur = t
    lines.append(cur)
    return lines


# ------------------------------------------------------------ scenes --------
def scene(t, guide):
    base = PITCH.copy()
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    glw = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d, g = ImageDraw.Draw(lay), ImageDraw.Draw(glw)
    dim = 1.0
    spot = None

    # ---- B1 3.0-8.0 : the opponent
    if 3.0 <= t < 8.0:
        dim = 0.35 + 0.15 * eio((t - 3.0) / 1.0)
        x, y = P(*OPP)
        a = eio((t - 3.4) / 0.5)
        pul = 1 + 0.12 * math.sin((t - 3.4) * 6)
        r = 44 * pul
        d.ellipse([x - r, y - r, x + r, y + r], outline=RED + (int(255 * a),), width=6)
        g.ellipse([x - r, y - r, x + r, y + r], outline=RED + (int(255 * a),), width=18)
        txt(d, (x, y), "؟", F("ExtraBold", 56), RED, alpha=255 * a)
        if t >= 7.0:
            k = eout((t - 7.0) / 0.15)
            fs = int(150 * (1.3 - 0.3 * k))
            txt(d, (540, 380), "الخصم", F("ExtraBold", fs), RED, alpha=255 * k)
            txt(g, (540, 380), "الخصم", F("ExtraBold", fs), RED, alpha=200 * k)

    # ---- B2 8.0-14.0 : the spy and the copier
    if 8.0 <= t < 14.0:
        x, y = P(*STAR_US)
        star(d, g, x, y - 40, 46, GOLD, eio((t - 8.1) / 0.3))
        txt(d, (x, y + 30), "منتوجك الرابح", F_LBL, GOLD, alpha=255 * eio((t - 8.2) / 0.3))
        player(d, g, *SPY, RED, "العسّاس", eio((t - 8.3) / 0.3))
        k = eio((t - 8.6) / 0.7)
        if k > 0:
            sx, sy = P(*SPY)
            l, r_ = P(0.05, 0.25 + 0.6 * k), P(0.85, 0.25 + 0.6 * k)
            poly = [(sx, sy - 20), l, r_]
            d.polygon(poly, fill=RED + (int(45 * k),))
            dashed(d, g, (sx, sy - 20), l, RED, 1, k, 4, head=False)
            dashed(d, g, (sx, sy - 20), r_, RED, 1, k, 4, head=False)
        if t >= 11.2:
            player(d, g, *COPY, RED, "المقلّد", eio((t - 11.2) / 0.3))
            cx, cy = P(*COPY)
            k2 = eio((t - 11.5) / 0.5)
            sx0, sy0 = x, y - 40
            star(d, g, sx0 + (cx + 70 - sx0) * k2, sy0 + (cy - 110 - sy0) * k2, 40, RED, 1, dashed_outline=True)
        txt(d, (540, 380), "العسّاس", F_MID, RED, alpha=255 * eio((t - 8.4) / 0.3) * (1 - eio((t - 11.1) / 0.2)))
        if t >= 11.3:
            txt(d, (540, 380), "المقلّد", F_MID, RED, alpha=255 * eio((t - 11.3) / 0.3))

    # ---- B3 14.0-19.5 : the attack
    if 14.0 <= t < 19.5:
        gx, gy = P(0.5, 0.97)
        for i, (nm, u, v) in enumerate(ATT):
            t0 = 15.6 + 0.8 * i
            if t >= t0:
                player(d, g, u, v, RED, nm, eio((t - t0) / 0.25))
                x, y = P(u, v)
                dashed(d, g, (x, y + 10), (gx, gy - 20), RED, eout((t - t0 - 0.15) / 0.7), 1, 5)
        txt(d, (540, 380), "هجوم!", F_BIG, RED, alpha=255 * eio((t - 15.0) / 0.2))
        txt(g, (540, 380), "هجوم!", F_BIG, RED, alpha=180 * eio((t - 15.0) / 0.2))

    # ---- B4 19.5-25.5 : the goal and the four resources
    if 19.5 <= t < 25.5:
        gx, gy = P(0.5, 0.995)
        bx = P(0.39, 0.37)
        k = eio((t - 19.5) / 0.5)
        x = bx[0] + (gx - bx[0]) * k
        y = bx[1] + (gy - 10 - bx[1]) * k
        d.ellipse([x - 14, y - 14, x + 14, y + 14], fill=WHT + (255,))
        g.ellipse([x - 20, y - 20, x + 20, y + 20], fill=WHT + (200,))
        fl = math.exp(-max(0, t - 20.0) / 0.25) if t >= 20.0 else 0
        if fl > 0.02:
            g.rectangle([gx - 170, gy - 60, gx + 170, gy + 20], fill=RED + (int(255 * fl),))
        if t >= 20.0:
            txt(d, (540, 300), "هدف في شباكك!", F_MID, RED, alpha=255 * eio((t - 20.0) / 0.2) * (1 - eio((t - 21.2) / 0.2)))
        for i, (w_, t0) in enumerate([("فلوسك", 21.4), ("وقتك", 22.1), ("سلعتك", 22.8), ("قرارك", 24.0)]):
            if t >= t0:
                a = eio((t - t0) / 0.2)
                y_ = 250 + i * 88
                col = WHT if i < 3 else RED
                txt(d, (540, y_), w_, F("ExtraBold", 70 if i == 3 else 60), col, alpha=255 * a)
        if t >= 24.4:
            txt(d, (540, 600), "تقتل إعلان رابح على بالك خاسر", F_SM, (230, 170, 170), alpha=255 * eio((t - 24.4) / 0.3))

    # ---- B5 25.5-31.0 : the lesson
    if 25.5 <= t < 31.0:
        dim = 1 - 0.75 * eio((t - 25.5) / 0.5)
        spot = eio((t - 25.8) / 0.6)
        x, y = P(*OPP)
        r = 40
        d.ellipse([x - r, y - r, x + r, y + r], outline=RED + (90,), width=4)
        if t >= 29.6:
            k = eout((t - 29.6) / 0.2)
            txt(d, (540, 420), "الشباك تتحمى.", F("ExtraBold", int(96 * (1.2 - 0.2 * k))), WHT, alpha=255 * k)
            txt(g, (540, 420), "الشباك تتحمى.", F("ExtraBold", int(96 * (1.2 - 0.2 * k))), CYANc, alpha=170 * k)

    # ---- B6 31.0-38.0 : the defence
    if 31.0 <= t < 38.0:
        gx, gy = P(0.5, 0.97)
        cx_, cy_ = P(*CONF)
        player(d, g, *CONF, WHT, "المؤكّدة", eio((t - 31.2) / 0.3))
        sx, sy = SPAM_XY
        d.rounded_rectangle([sx - 80, sy - 40, sx + 80, sy + 40], radius=10, outline=RED + (220,), width=4)
        txt(d, (sx, sy), "السبام", F("ExtraBold", 38), RED)
        for i, (nm, u, v) in enumerate(ATT):
            x, y = P(u, v)
            if i < 2:   # cut -> slides to spam
                tc = 32.6 + 1.2 * i
                if t < tc + 0.45:
                    player(d, g, u, v, RED, nm, 1.0)
                    if t >= tc:
                        big_x(d, g, x, y - 40, 50, (t - tc) / 0.25)
                else:
                    k = eio((t - tc - 0.45) / 0.5)
                    px_, py_ = x + (sx - x) * k, y + (sy - y) * k
                    a = 1 - 0.7 * k
                    d.ellipse([px_ - 18, py_ - 18, px_ + 18, py_ + 18], fill=RED + (int(255 * a),))
                    if k >= 1:
                        txt(d, (x, y + 30), nm + " ← السبام", F_LBL, (200, 120, 120), alpha=150)
            else:       # yellow card -> confirmation call
                tc = 35.2
                player(d, g, u, v, RED if t < tc else YEL, nm, 1.0)
                if t >= tc:
                    card(d, g, x + 40, y - 120, 1.3, eio((t - tc) / 0.15))
                    dashed(d, g, (x, y + 10), (cx_, cy_ - 30), YEL, eout((t - tc - 0.3) / 0.8), 1, 5)
        if t < 32.4:
            txt(d, (540, 380), "الصافرة الأولى!", F_MID, WHT, alpha=255 * eio((t - 31.0) / 0.2))
        elif t < 35.1:
            txt(d, (540, 380), "مقطوع!", F_BIG, RED, alpha=255 * eio((t - 32.6) / 0.15))
        else:
            txt(d, (540, 380), "بطاقة صفرا!", F_BIG, YEL, alpha=255 * eio((t - 35.2) / 0.15))

    # ---- B7 38.0-43.0 : the tassyir screen (placeholder)
    if 38.0 <= t < 43.0:
        dim = 0.6
        k = eout((t - 38.2) / 0.35)
        x0, y0, x1, y1 = 120, 170, 960, 720
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        sw, sh = (x1 - x0) * (0.6 + 0.4 * k), (y1 - y0) * (0.6 + 0.4 * k)
        a = k
        d.rounded_rectangle([cx - sw / 2, cy - sh / 2, cx + sw / 2, cy + sh / 2], radius=18, fill=(14, 22, 36, int(240 * a)), outline=CYANc + (int(255 * a),), width=5)
        g.rounded_rectangle([cx - sw / 2, cy - sh / 2, cx + sw / 2, cy + sh / 2], radius=18, outline=CYANc + (int(255 * a),), width=16)
        if k > 0.9:
            txt(d, (cx, y0 + 60), "الحماية من السبام", F("ExtraBold", 50), WHT)
            rows = [("المكرّر", "← السبام", RED), ("5 أرقام", "← السبام", RED), ("الروبو", "← مشبوه", YEL), ("الرافض", "← مشبوه", YEL)]
            for i, (a1, b1, c1) in enumerate(rows):
                ry = y0 + 150 + i * 92
                ka = eio((t - 39.0 - 0.25 * i) / 0.25)
                txt(d, (x1 - 60, ry), a1, F("Bold", 42), WHT, anchor="rm", alpha=255 * ka)
                txt(d, (x0 + 60, ry), b1, F("Bold", 40), c1, anchor="lm", alpha=255 * ka)
            txt(d, (cx, y1 - 30), "[ سكرين تسيير الحقيقي هنا ]", F("Medium", 26), (120, 140, 160))
        if t >= 41.3:
            k2 = eout((t - 41.3) / 0.15)
            fs = int(92 * (1.3 - 0.3 * k2))
            txt(d, (540, 1000), "القوة اللي يحبس", F("ExtraBold", fs), ORNG, alpha=255 * k2)
            txt(g, (540, 1000), "القوة اللي يحبس", F("ExtraBold", fs), ORNG, alpha=220 * k2)

    # compose
    f = base * dim
    if spot:
        x, y = P(0.5, 0.97)
        f += (np.exp(-(((XX - x) / 260) ** 2 + ((YY - y + 60) / 170) ** 2)) * 0.55 * spot)[..., None] * np.array([0.8, 0.9, 1.0], np.float32)
        gx, gy = P(0.5, 1.0)
        dd = ImageDraw.Draw(lay)
        dd.line([(gx - 150, gy), (gx - 150, gy - 90), (gx + 150, gy - 90), (gx + 150, gy)], fill=WHT + (int(255 * spot),), width=6)
    # our goal frame always visible (except B1/B5 handled)
    gx, gy = P(0.5, 1.0)
    if not spot:
        d.line([(gx - 150, gy), (gx - 150, gy - 90), (gx + 150, gy - 90), (gx + 150, gy)], fill=WHT + (int(200 * dim),), width=5)
        if not (3.0 <= t < 8.0):
            txt(d, (gx, gy + 40), "مرماك", F_LBL, (200, 220, 235), alpha=200 * dim)
    ga = np.asarray(glw).astype(np.float32) / 255
    gl = np.dstack([nd.gaussian_filter(ga[..., c] * ga[..., 3], 9) for c in range(3)])
    la = np.asarray(lay).astype(np.float32) / 255
    f = f + gl * 1.3
    f = f * (1 - la[..., 3:4]) + la[..., :3] * la[..., 3:4]
    if guide:
        for t0, t1, s in SUBS:
            if t0 <= t < t1:
                lines = wrap(s, F_SUB, 900)
                im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                dd = ImageDraw.Draw(im)
                y = 1600
                dd.rounded_rectangle([60, y - 34, 1020, y - 34 + 54 * len(lines) + 20], radius=14, fill=(0, 0, 0, 170))
                for i, ln in enumerate(lines):
                    txt(dd, (540, y + i * 54), ln, F_SUB, (255, 230, 150))
                a = np.asarray(im).astype(np.float32) / 255
                f = f * (1 - a[..., 3:4]) + a[..., :3] * a[..., 3:4]
    return f


def b0(t):
    f = np.zeros((H, W, 3), np.float32)
    fl = math.exp(-max(0, t - 1.25) / 0.12)
    f += fl
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d, gd = ImageDraw.Draw(im), ImageDraw.Draw(g)
    k = eout((t - 1.3) / 0.25)
    txt(d, (540, 820), "اندلاع الدورة", F("ExtraBold", int(118 * (1.15 - 0.15 * k))), ORNG, alpha=255 * k)
    txt(gd, (540, 820), "اندلاع الدورة", F("ExtraBold", int(118 * (1.15 - 0.15 * k))), ORNG, alpha=200 * k)
    k2 = eio((t - 1.5) / 0.25)
    txt(d, (540, 950), "الحلقة 01 · حماية مواردك", F("Bold", 54), CYANc, alpha=255 * k2)
    s = "قبل ما تطلق... احرس الباب."
    v = clamp01((t - 1.9) / 0.9)
    fnt = F("Medium", 44)
    full = Image.new("L", (W, 120), 0)
    ImageDraw.Draw(full).text((540, 60), s, font=fnt, fill=255, anchor="mm", direction="rtl")
    bb = full.getbbox()
    if bb and v > 0:
        cut = int(bb[2] - (bb[2] - bb[0]) * v)
        m = np.asarray(full).astype(np.float32) / 255
        m[:, :cut] = 0
        f[1060 - 60:1060 + 60] += m[..., None] * np.array([0.92, 0.92, 0.92], np.float32)
    ga = np.asarray(g).astype(np.float32) / 255
    f += np.dstack([nd.gaussian_filter(ga[..., c] * ga[..., 3], 10) for c in range(3)]) * 1.2
    la = np.asarray(im).astype(np.float32) / 255
    return f * (1 - la[..., 3:4]) + la[..., :3] * la[..., 3:4]


def outro_overlay(f, t):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    p = 1 + 0.06 * math.sin((t - 43.0) * 9)
    k = eout((t - 43.1) / 0.2)
    d.rounded_rectangle([240, 1440, 840, 1560], radius=60, fill=(10, 10, 14, int(200 * k)), outline=ORNG + (int(255 * k),), width=5)
    txt(d, (540, 1500), "علّق «دفاع»", F("ExtraBold", int(64 * p)), ORNG, alpha=255 * k)
    la = np.asarray(im).astype(np.float32) / 255
    return f * (1 - la[..., 3:4]) + la[..., :3] * la[..., 3:4]


def read_clip(path, t0, t1):
    n = int(round((t1 - t0) * FPS))
    p = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t0}", "-i", path, "-frames:v", str(n),
                        "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True)
    a = np.frombuffer(p.stdout, np.uint8)
    return a.reshape(-1, H, W, 3)


INTRO = read_clip(V4, 8.1, 9.35)          # bullet into "ولا بالقوة" -> explosion flash
OUTRO = read_clip(V4, 20.55, 21.8)         # controller fully lit, no text on screen (slowed to 2 s below)


def frame(n, guide):
    t = n / FPS
    if t < 1.25:
        f = INTRO[min(n, len(INTRO) - 1)].astype(np.float32) / 255
    elif t < 3.0:
        f = b0(t)
    elif t < 43.0:
        f = scene(t, guide)
        for tb in (8.0, 14.0, 19.5, 25.5, 31.0, 38.0):     # horizontal wipe between boards
            dt = t - tb
            if 0 <= dt < 0.16:
                x = int(W * (1 - dt / 0.16))
                f[:, :x] *= 0.15
                f[:, max(0, x - 8):x] = np.array([1.0, 1.0, 1.0], np.float32)
    else:
        k = n - int(43.0 * FPS)
        f = OUTRO[min(int(k * len(OUTRO) / 60), len(OUTRO) - 1)].astype(np.float32) / 255
        f = outro_overlay(f, t)
        if guide:
            f = scene(t, True) * 0 + f
    return f


def render(guide, out):
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                            "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "14",
                            "-profile:v", "high", "-pix_fmt", "yuv420p", "-color_primaries", "bt709",
                            "-color_trc", "bt709", "-colorspace", "bt709", "-movflags", "+faststart", out],
                           stdin=subprocess.PIPE)
    for n in range(TOTAL):
        f = frame(n, guide)
        o = (np.clip(f, 0, 1) * 255 + 0.5).astype(np.uint8)
        if PREV and guide and n % 45 == 0:
            Image.fromarray(o).save(f"{PREV}/e_{n:04d}.png")
        enc.stdin.write(o.tobytes())
    enc.stdin.close()
    enc.wait()


render(True, f"{OUTD}/ep01_guide_video.mp4")
render(False, f"{OUTD}/ep01_clean_video.mp4")
print("done")
