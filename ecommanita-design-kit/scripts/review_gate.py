"""Reviewer gate (بوابة المراجع) for a lesson: checks the content JSON and the rendered slides before anything ships.
Automatic checks fail hard; things only a human can judge (Arabic letter by letter, promises) are listed for review.
Usage: review_gate.py CONTENT.json OUT_PREFIX   (same arguments as match_slide.py)  -> prints a short report, exit 1 on FAIL"""
import sys
import os
import glob
import json
import re
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

CONTENT, PREFIX = sys.argv[1], sys.argv[2]
KIT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = KIT + "/out/master-slide.png"
FONTS = KIT + "/fonts"
W, H = 1920, 1080
# brand regions of the master (y0, y1, x0, x1): text must never land here, the logo and controller are never redrawn
BRAND = {"اللوغو": (0, 170, 700, 1220), "المانيطة": (900, 1080, 760, 1160),
         "الإطار فوق": (0, 60, 0, 1920), "الإطار تحت": (1020, 1080, 0, 1920),
         "الإطار يسار": (0, 1080, 0, 80), "الإطار يمين": (0, 1080, 1840, 1920)}
NOISE, MAX_PX = 40, 50          # resampling noise vs the master stays under 40 levels, on a few dozen pixels at most
WATCH = ["البوصلة", "كرياتيف", "وينر", "الميديا باير", "الموصّل", "الموصل"]   # words image models got wrong before
PROMISE = ["مضمون", "أكيد", "ضمان", "مليون", "تربح", "%"]   # + any number: a figure is a promise until proven

fails, checks, human = [], [], []


def ok(cond, msg):
    (checks if cond else fails).append(msg)


C = json.load(open(CONTENT, encoding="utf-8"))
ideas = C["ideas"]
ok(3 <= len(ideas) <= 6, f"عدد الأفكار {len(ideas)} (لازم 3 حتى 6)")
for i, it in enumerate(ideas, 1):
    ok(len(it["label"].split()) <= 4, f"فكرة {i:02d}: العنوان «{it['label']}» = {len(it['label'].split())} كلمات (4 أقصى)")
    ok(len(it["bullets"]) == 3, f"فكرة {i:02d}: {len(it['bullets'])} رؤوس أقلام (لازم 3)")
    ok(all(len(b.split()) <= 7 for b in it["bullets"]), f"فكرة {i:02d}: رؤوس الأقلام قصار (7 كلمات أقصى)")

texts = [C["title"], C["goal"], C["section_name"]] + [t for it in ideas for t in [it["label"], it["sub"], *it["bullets"]]]
blob = " ".join(texts)
brand = re.findall(r"(?i)e+c+o+m+a+n+i+t+a+", blob)
ok(all(b == "ecommanita" for b in brand), "ecommanita بالحروف الصغيرة وبجوج m" + (f" (لقيت: {', '.join(brand)})" if brand else ""))
tf = ImageFont.truetype(f"{FONTS}/Tajawal-ExtraBold.ttf", 50)
l, _, r, _ = ImageDraw.Draw(Image.new("L", (1, 1))).textbbox((0, 0), C["title"], font=tf, direction="rtl")
ok(r - l <= 1100, f"العنوان يدخل بين الخانتين ({r - l}px من 1100)")
human += [f"«{w}» موجودة: افحصها حرف بحرف" for w in WATCH if w in blob]
human += [f"وعد؟ «{t}»: لازم يكون عندو دليل في النظام" for t in texts if any(p in t for p in PROMISE) or re.search(r"[0-9٠-٩]", t)]

files = sorted(glob.glob(f"{PREFIX}-[0-9][0-9].png"))
ok(len(files) == len(ideas) + 1, f"{len(files)} سلايدات (لازم {len(ideas) + 1}: النظرة + فكرة فكرة)")
M = cv2.imread(MASTER).astype(np.int16)
for f in files:
    im = cv2.imread(f)
    name = os.path.basename(f)
    if im.shape[:2] != (H, W):
        fails.append(f"{name}: المقاس {im.shape[1]}×{im.shape[0]} (لازم {W}×{H})"); continue
    d = np.abs(im.astype(np.int16) - M).max(2) > NOISE
    bad = [k for k, (y0, y1, x0, x1) in BRAND.items() if d[y0:y1, x0:x1].sum() > MAX_PX]
    ok(not bad, f"{name}: المقاس صحيح والكتابة ما تمسّش " + ("الماركة" if not bad else "، ".join(bad)))

print(f"# بوابة المراجع · {os.path.basename(PREFIX)}")
print(f"\n{'❌ FAIL' if fails else '✅ PASS'}  ({len(checks)} صحيح، {len(fails)} غالط، {len(human)} للمراجعة بالعين)\n")
for m in fails:
    print("- ❌", m)
for m in checks:
    print("- ✅", m)
if human:
    print("\n## للمراجعة بالعين")
    for m in human:
        print("- 👁", m)
sys.exit(1 if fails else 0)
