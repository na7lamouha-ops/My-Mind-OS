"""Course slide = a live match on the master template (content from a JSON file).
ideas = players, explanation order = passes toward the goal, active idea = ball holder with an event card
(head bullets), HUD like the localhost stade.html.  Usage: match_slide.py CONTENT.json OUT_PREFIX   -> writes OUT_PREFIX-00.png (overview) .. OUT_PREFIX-NN.png"""
import sys
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

import json
CONTENT, PREFIX = sys.argv[1], sys.argv[2]
import os
KIT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = KIT + "/fonts"
MASTER = KIT + "/out/master-slide.png"
W, H, Z = 1920, 1080, 2

C = json.load(open(CONTENT, encoding="utf-8"))
SECTION, SECTION_N = C["section"], C["section_name"]
TITLE, GOAL = C["title"], C["goal"]
IDEAS = [(i["label"], i["sub"], i["bullets"]) for i in C["ideas"]]
N = len(IDEAS)
PX0, PY0, PX1, PY1 = 150, 262, 1770, 872
MY = (PY0 + PY1) / 2
XR, XL = 1585, 425
POS = [(XR - k * (XR - XL) / (N - 1), 455 if k % 2 == 0 else 690) for k in range(N)]
assert 3 <= N <= 6, "3 to 6 ideas per slide; split bigger sections in two halves" 
CY = np.array([40, 215, 255], np.float32); OR = np.array([255, 120, 20], np.float32)
HOT = np.array([255, 240, 215], np.float32)

def render(ACTIVE):
    global canvas
    base = cv2.cvtColor(cv2.imread(MASTER), cv2.COLOR_BGR2RGB)
    canvas = cv2.resize(base, (W * Z, H * Z), interpolation=cv2.INTER_CUBIC).astype(np.float32)
    h2, w2 = canvas.shape[:2]


    def add(mask, color, k=1.0, radii=((18, .9), (6, .8))):
        global canvas
        g = sum(cv2.GaussianBlur(mask, (0, 0), r * Z) * w for r, w in radii)
        canvas = np.clip(canvas + g[..., None] * np.asarray(color, np.float32) * k, 0, 255)


    def paint(mask, color, a=1.0):
        global canvas
        canvas = canvas * (1 - mask[..., None] * a) + np.asarray(color, np.float32) * mask[..., None] * a


    def F(name, size):
        return ImageFont.truetype(f"{FONTS}/Tajawal-{name}.ttf", int(size * Z))


    def LF(size, wg=800):
        f = ImageFont.truetype(f"{FONTS}/Archivo-VF.ttf", int(size * Z)); f.set_variation_by_axes([wg, 100]); return f


    def text_mask(t, font, x, y, anchor="c", rtl=True):
        im = Image.new("L", (w2, h2), 0); d = ImageDraw.Draw(im)
        kw = {"direction": "rtl"} if rtl else {}
        l, tp, r, b = d.textbbox((0, 0), t, font=font, **kw)
        X = x * Z
        px = X - (r - l) / 2 - l if anchor == "c" else (X - (r - l) - l if anchor == "r" else X - l)
        d.text((px, y * Z - (b - tp) / 2 - tp), t, font=font, fill=255, **kw)
        return np.array(im, np.float32) / 255, (r - l) / Z


    def text(t, font, x, y, color, anchor="c", rtl=True, glow=None, gk=0.6, shadow=True):
        m, w = text_mask(t, font, x, y, anchor, rtl)
        if shadow:
            sh = np.roll(m, 2 * Z, axis=0); paint(cv2.GaussianBlur(sh, (0, 0), 3 * Z), (0, 0, 0), 0.8)
        if glow is not None:
            add(m, glow, gk, ((16, .7), (5, .6)))
        paint(m, color)
        return w


    def rrect(x0, y0, x1, y1, r, fill=None, outline=None, ow=2, fa=1.0, glow=None, gk=0.5):
        m = Image.new("L", (w2, h2), 0); d = ImageDraw.Draw(m)
        if fill is not None:
            d.rounded_rectangle([x0 * Z, y0 * Z, x1 * Z, y1 * Z], radius=r * Z, fill=255)
            paint(np.array(m, np.float32) / 255, fill, fa)
        if outline is not None:
            o = Image.new("L", (w2, h2), 0)
            ImageDraw.Draw(o).rounded_rectangle([x0 * Z, y0 * Z, x1 * Z, y1 * Z], radius=r * Z, outline=255, width=int(ow * Z))
            om = np.array(o, np.float32) / 255
            if glow is not None:
                add(om, glow, gk, ((12, .8), (4, .6)))
            paint(om, outline)


    def col_at(i):
        t = i / (N - 1); return CY * (1 - t) + OR * t


    # ---------- title band ----------
    tw = text(TITLE, F("ExtraBold", 50), W / 2, 214, (255, 255, 255), glow=(CY + OR) / 2, gk=0.45)

    # ---------- HUD (top-left inside the pitch), like stade.html ----------
    done = max(0, ACTIVE - 1)
    hud = f"{SECTION} · {SECTION_N}"
    rrect(PX0, 192, PX0 + 330, 236, 22, fill=(8, 12, 14), fa=0.85, outline=(70, 90, 98), ow=1.5)
    # live dot
    dm = np.zeros((h2, w2), np.float32); cv2.circle(dm, (int((PX0 + 26) * Z), int(214 * Z)), int(6 * Z), 1.0, -1, cv2.LINE_AA)
    add(dm, (255, 50, 50), 0.8, ((8, .8),)); paint(dm, (240, 50, 50))
    text(hud, F("Bold", 22), PX0 + 46, 214, (225, 230, 232), anchor="l", shadow=False)
    stat = f"PASSES {done}/{N - 1}" if ACTIVE else f"PASSES 0/{N - 1}"
    rrect(PX1 - 230, 192, PX1, 236, 22, fill=(8, 12, 14), fa=0.85, outline=(70, 90, 98), ow=1.5)
    text(stat, LF(20), PX1 - 115, 214, (150, 225, 240), rtl=False, shadow=False)

    # ---------- goal (left, attack runs right -> left) ----------
    gm = np.zeros((h2, w2), np.float32)
    gx0 = PX0 - 44
    cv2.rectangle(gm, (int(gx0 * Z), int((MY - 60) * Z)), (int(PX0 * Z), int((MY + 60) * Z)), 1.0, 4)
    for k in range(1, 4):
        cv2.line(gm, (int((gx0 + k * 11) * Z), int((MY - 60) * Z)), (int((gx0 + k * 11) * Z), int((MY + 60) * Z)), 0.6, 2)
    for k in range(1, 6):
        cv2.line(gm, (int(gx0 * Z), int((MY - 60 + k * 20) * Z)), (int(PX0 * Z), int((MY - 60 + k * 20) * Z)), 0.6, 2)
    add(gm, OR, 1.1, ((14, .9), (4, .7))); paint(gm, OR)
    text(GOAL, F("ExtraBold", 22), PX0 + 18, PY1 - 30, (255, 180, 100), anchor="l", glow=OR, gk=0.4)


    # ---------- passes ----------
    def curve(p, q, bend):
        (x1, y1), (x2, y2) = p, q
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2 + bend
        t = np.linspace(0, 1, 140)[:, None]
        return (1 - t) ** 2 * np.array(p) + 2 * (1 - t) * t * np.array([cx, cy]) + t * t * np.array(q)


    targets = POS[1:] + [(PX0 + 8, MY)]
    for i, (p, q) in enumerate(zip(POS, targets)):
        pts = curve(p, q, 26 if i % 2 == 0 else -26)
        pts = pts[26:-26] if i < N - 1 else pts[26:-4]
        played = ACTIVE and i + 1 < ACTIVE
        current = ACTIVE and i + 1 == ACTIVE
        k = 1.0 if (not ACTIVE or played) else (0.75 if current else 0.25)
        m = np.zeros((h2, w2), np.float32)
        P = (pts * Z).astype(np.int32)
        for j in range(0, len(P) - 3, 7):
            cv2.line(m, tuple(P[j]), tuple(P[j + 3]), 1.0, 3 * Z, cv2.LINE_AA)
        a, b = pts[-6], pts[-1]
        ang = np.arctan2(b[1] - a[1], b[0] - a[0])
        for s_ in (-0.5, 0.5):
            cv2.line(m, (int(b[0] * Z), int(b[1] * Z)), (int((b[0] - 16 * np.cos(ang + s_)) * Z), int((b[1] - 16 * np.sin(ang + s_)) * Z)), 1.0, 3 * Z, cv2.LINE_AA)
        c = (col_at(i) + col_at(min(i + 1, N - 1))) / 2
        add(m * k, c, 0.6, ((7, .8),)); paint(m * k, c)
        if current:   # the ball travelling on the current pass, with an electric trail
            bx, by = pts[len(pts) // 3]
            bm = np.zeros((h2, w2), np.float32); cv2.circle(bm, (int(bx * Z), int(by * Z)), int(9 * Z), 1.0, -1, cv2.LINE_AA)
            add(bm, HOT, 1.4, ((22, .8), (7, .9))); paint(bm, (250, 250, 250))

    # ---------- players + label cards ----------
    num = LF(26)
    for i, ((x, y), (lab, sub, _)) in enumerate(zip(POS, IDEAS)):
        col = col_at(i); c = tuple(int(v) for v in col)
        act = ACTIVE == i + 1; dim = ACTIVE and not act
        rw, rh, rr = (64, 21, 38) if act else (52, 17, 30)
        ring = np.zeros((h2, w2), np.float32)
        cv2.ellipse(ring, (int(x * Z), int((y + 30) * Z)), (int(rw * Z), int(rh * Z)), 0, 0, 360, 1.0, 4 * Z, cv2.LINE_AA)
        head = np.zeros((h2, w2), np.float32)
        cv2.circle(head, (int(x * Z), int((y - 18) * Z)), int(rr * Z), 1.0, -1, cv2.LINE_AA)
        edge = np.zeros((h2, w2), np.float32)
        cv2.circle(edge, (int(x * Z), int((y - 18) * Z)), int(rr * Z), 1.0, 4 * Z, cv2.LINE_AA)
        gk = 1.5 if act else (0.3 if dim else 0.9)
        add(ring + edge, col, gk)
        paint(head, col if act else col / 5)
        paint(edge, col, 0.45 if dim else 1.0); paint(ring, col, 0.4 if dim else 0.9)
        text(f"0{i + 1}", num, x, y - 17, (10, 10, 12) if act else tuple(col * (0.5 if dim else 1)), rtl=False, shadow=False)
        lf, sf = F("ExtraBold", 27), F("Medium", 20)
        above = y < MY
        if not ACTIVE:
            _, w1 = text_mask(lab, lf, 0, 0); _, w2_ = text_mask(sub, sf, 0, 0)
            cw = max(w1, w2_) + 36
            cy0 = (y - 18 - rr - 14 - 80) if above else (y + 56)
            rrect(x - cw / 2, cy0, x + cw / 2, cy0 + 80, 13, fill=(8, 10, 12), fa=0.8, outline=tuple(col * 0.7), ow=1.5)
            text(lab, lf, x, cy0 + 27, (255, 255, 255))
            text(sub, sf, x, cy0 + 58, (205, 210, 214), shadow=False)
        elif not act:
            ly = (y - 18 - rr - 22) if above else (y + 72)
            played = i + 1 < ACTIVE
            text(lab, F("Bold", 24), x, ly, tuple(np.array([255, 255, 255]) * (0.75 if played else 0.42)))

    # ---------- event card for the active idea (the "رؤوس أقلام") ----------
    if ACTIVE:
        x, y = POS[ACTIVE - 1]
        lab, sub, bullets = IDEAS[ACTIVE - 1]
        col = col_at(ACTIVE - 1)
        bf = F("Bold", 25)
        ws = [text_mask(b, bf, 0, 0)[1] for b in bullets]
        cw, ch = max(ws) + 90, 64 + 46 * len(bullets)
        cx = min(max(x + (W / 2 - x) * 0.10, PX0 + cw / 2 + 16), PX1 - cw / 2 - 16)
        cy0 = (y - 18 - 40 - 18 - ch) if y > MY else (y + 66)
        rrect(cx - cw / 2, cy0, cx + cw / 2, cy0 + ch, 16, fill=(10, 9, 8), fa=0.92, outline=tuple(col), ow=2.5, glow=col, gk=0.6)
        # header strip
        text(f"0{ACTIVE} · {lab}", F("ExtraBold", 24), cx + cw / 2 - 26, cy0 + 32, tuple(col), anchor="r", glow=col, gk=0.35)
        for j, b in enumerate(bullets):
            by = cy0 + 80 + j * 46
            text(b, bf, cx + cw / 2 - 52, by, (240, 242, 244), anchor="r")
            dm = np.zeros((h2, w2), np.float32)
            cv2.circle(dm, (int((cx + cw / 2 - 32) * Z), int(by * Z)), int(5 * Z), 1.0, -1, cv2.LINE_AA)
            add(dm, col, 0.8, ((6, .8),)); paint(dm, col)

    out = f"{PREFIX}-{ACTIVE:02d}.png"
    Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8)).resize((W, H), Image.LANCZOS).save(out)
    print(out)


for A in range(N + 1):
    render(A)
