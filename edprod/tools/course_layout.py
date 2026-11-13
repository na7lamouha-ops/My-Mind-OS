"""EDPROD course layout engine — camera + screen recording composed on the course kit (16:9).

Two layouts, with an animated swap between them:
  CAM     : camera big (talking to the students), screen recording small on the left
  SCREEN  : screen recording big (working on the laptop), camera small on the right
Which layout is on screen comes from a cue file, or automatically from the screen recording's activity
(mouse moving, typing, pages changing -> SCREEN; screen still -> CAM), with a minimum hold so it never flickers.

usage (repo root):
  python3 edprod/tools/course_layout.py --cam cam.mp4 --screen screen.mp4 --out lesson.mp4 [--cues cues.txt] [--offset 0.0]
  cues.txt: one line per switch, "mm:ss LAYOUT" e.g.  00:00 CAM / 00:12.5 SCREEN / 01:40 CAM
  --offset: seconds to shift the screen recording against the camera (positive = screen starts later)
  --auto-report : only print the automatic cue list (to check / edit it), no render
"""
import argparse
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
KIT = os.path.join(ROOT, "assets", "course-kit")
W, H, FPS = 1920, 1080, 30
CYAN = (40, 215, 255)

# rectangles (x, y, w, h) — inside the kit safe zone x 130→1790, y 185→880, clear of the controller (x 780→1140, y>890)
LAYOUTS = {
    "CAM": {"cam": (580, 200, 1200, 675), "screen": (150, 420, 410, 231)},
    "SCREEN": {"screen": (150, 200, 1200, 675), "cam": (1400, 360, 370, 370)},
}
SWAP = 0.5            # seconds of the animated swap
MIN_HOLD = 3.0        # automatic mode: a layout stays at least this long


def ease(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration",
                          "-of", "default=nw=1:nk=1", path], capture_output=True, text=True, check=True).stdout.split()
    return int(out[0]), int(out[1]), float(out[2])


def reader(path, w, h, start=0.0):
    args = ["ffmpeg", "-v", "error"]
    if start > 0:
        args += ["-ss", f"{start}"]
    args += ["-i", path, "-vf", f"fps={FPS},scale={w}:{h}:flags=lanczos", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    p = subprocess.Popen(args, stdout=subprocess.PIPE)
    last = np.zeros((h, w, 3), np.uint8)
    while True:
        buf = p.stdout.read(w * h * 3)
        if len(buf) < w * h * 3:
            while True:              # source ended: hold its last frame
                yield last
        last = np.frombuffer(buf, np.uint8).reshape(h, w, 3)
        yield last


# ------------------------------------------------------------------ cues
def parse_cues(path):
    cues = []
    for line in open(path, encoding="utf-8"):
        line = line.split("#")[0].strip()
        if not line:
            continue
        t, lay = line.split()[:2]
        parts = [float(x) for x in t.split(":")]
        sec = sum(v * 60 ** i for i, v in enumerate(reversed(parts)))
        cues.append((sec, lay.upper()))
    return sorted(cues)


def auto_cues(screen, offset, dur, thr=None):
    """screen activity at 5 fps on a 160x90 grey copy -> CAM / SCREEN with hysteresis + minimum hold."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", screen, "-vf", "fps=5,scale=160:90,format=gray", "-f", "rawvideo", "-"],
                         capture_output=True, check=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, 90, 160).astype(np.float32)
    act = np.r_[0, (np.abs(np.diff(fr, axis=0)) > 12).mean((1, 2))]          # share of pixels that changed
    k = 10                                                                     # 2 s smoothing
    act = np.convolve(act, np.ones(k) / k, "same")
    if thr is None:
        thr = max(0.002, float(np.percentile(act, 60)) * 0.6)
    state, since, cues = "CAM", -1e9, [(0.0, "CAM")]
    for i, a in enumerate(act):
        t = i / 5 + offset
        want = "SCREEN" if a > thr else ("CAM" if a < thr * 0.5 else state)
        if want != state and t - since >= MIN_HOLD:
            state, since = want, t
            cues.append((max(0.0, t - 0.6), state))      # switch a bit before the action starts
    out = []
    for c in cues:                                       # one cue per instant, the later one wins
        if out and abs(out[-1][0] - c[0]) < 0.05:
            out[-1] = c
        elif not out or out[-1][1] != c[1]:
            out.append(c)
    return [c for c in out if c[0] < dur], act, thr


def layout_at(cues, t):
    """returns (from_layout, to_layout, progress) at time t."""
    prev = cues[0][1]
    for i, (tc, lay) in enumerate(cues):
        if t < tc:
            break
        if i > 0 and cues[i - 1][1] != lay:
            prev_lay = cues[i - 1][1]
            p = (t - tc) / SWAP
            if p < 1:
                return prev_lay, lay, ease(p)
        prev = lay
    return prev, prev, 1.0


def lerp_rect(a, b, p):
    return tuple(int(round(x + (y - x) * p)) for x, y in zip(a, b))


# ------------------------------------------------------------------ drawing
_mask_cache = {}


def rounded_mask(w, h, r=18):
    key = (w, h, r)
    if key not in _mask_cache:
        m = Image.new("L", (w * 2, h * 2), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, w * 2 - 1, h * 2 - 1], r * 2, fill=255)
        _mask_cache[key] = m.resize((w, h), Image.LANCZOS)
    return _mask_cache[key]


def cover_crop(frame, w, h, focus_x=0.5):
    """scale + crop the frame to fill w x h (camera keeps the face: centred horizontally on focus_x)."""
    fh, fw = frame.shape[:2]
    s = max(w / fw, h / fh)
    nw, nh = max(w, int(fw * s + 0.5)), max(h, int(fh * s + 0.5))
    im = Image.fromarray(frame).resize((nw, nh), Image.BILINEAR if s < 1 else Image.BICUBIC)
    x0 = int(min(max(0, focus_x * nw - w / 2), nw - w))
    y0 = (nh - h) // 2
    return im.crop((x0, y0, x0 + w, y0 + h))


def fit_contain(frame, w, h):
    """screen recordings are never cropped: letterbox inside the window."""
    fh, fw = frame.shape[:2]
    s = min(w / fw, h / fh)
    im = Image.fromarray(frame).resize((max(1, int(fw * s)), max(1, int(fh * s))), Image.BILINEAR if s < 1 else Image.BICUBIC)
    out = Image.new("RGB", (w, h), (8, 10, 14))
    out.paste(im, ((w - im.width) // 2, (h - im.height) // 2))
    return out


def window(canvas, img, rect, border=CYAN):
    x, y, w, h = rect
    # soft shadow
    sh = Image.new("L", (w + 60, h + 60), 0)
    ImageDraw.Draw(sh).rounded_rectangle([30, 36, w + 30, h + 36], 22, fill=150)
    sh = sh.filter(ImageFilter.GaussianBlur(14))
    canvas.paste((0, 0, 0), (x - 30, y - 30), sh)
    m = rounded_mask(w, h)
    canvas.paste(img, (x, y), m)
    b = Image.new("L", (w, h), 0)
    ImageDraw.Draw(b).rounded_rectangle([0, 0, w - 1, h - 1], 18, outline=255, width=3)
    canvas.paste(border, (x, y), b)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cam", required=True)
    ap.add_argument("--screen", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--cues")
    ap.add_argument("--offset", type=float, default=0.0)
    ap.add_argument("--focus-x", type=float, default=0.5, help="where the face is in the camera frame, 0..1")
    ap.add_argument("--badge", action="store_true", help="add the «مازال يتعمّر» badge")
    ap.add_argument("--auto-report", action="store_true")
    ap.add_argument("--max-dur", type=float, default=None)
    a = ap.parse_args()

    _, _, dcam = probe(a.cam)
    _, _, dscr = probe(a.screen)
    dur = min(dcam, dscr + a.offset) if a.offset >= 0 else dcam
    if a.max_dur:
        dur = min(dur, a.max_dur)
    if a.cues:
        cues = parse_cues(a.cues)
    else:
        cues, act, thr = auto_cues(a.screen, a.offset, dur)
        print(f"auto threshold {thr:.4f}")
    print("cues:")
    for t, lay in cues:
        print(f"  {int(t // 60):02d}:{t % 60:05.2f} {lay}")
    if a.auto_report:
        return

    master = Image.open(os.path.join(KIT, "background", "master-eclairs-1920x1080.png")).convert("RGB")
    badge = Image.open(os.path.join(KIT, "screens", "10-badge-mazal-yt3ammar.png")).convert("RGBA") if a.badge else None
    cam_r = reader(a.cam, 1280, 720)
    scr_r = reader(a.screen, 1920, 1080)
    blank = np.zeros((1080, 1920, 3), np.uint8)
    tmp_v = a.out + ".video.mp4"
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                            "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p",
                            "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", tmp_v], stdin=subprocess.PIPE)
    n = int(dur * FPS)
    for i in range(n):
        t = i / FPS
        cf = next(cam_r)
        sf = next(scr_r) if t >= a.offset else blank
        l0, l1, p = layout_at(cues, t)
        rc = lerp_rect(LAYOUTS[l0]["cam"], LAYOUTS[l1]["cam"], p)
        rs = lerp_rect(LAYOUTS[l0]["screen"], LAYOUTS[l1]["screen"], p)
        canvas = master.copy()
        cam_big = (rc[2] * rc[3]) >= (rs[2] * rs[3])
        order = [("screen", rs), ("cam", rc)] if cam_big else [("cam", rc), ("screen", rs)]
        for name, r in order:                  # big one first, small one on top
            img = cover_crop(cf, r[2], r[3], a.focus_x) if name == "cam" else fit_contain(sf, r[2], r[3])
            window(canvas, img, r)
        if badge:
            canvas.paste(badge, (0, 0), badge)
        enc.stdin.write(canvas.tobytes())
        if i % 300 == 0:
            print(f"  {t:6.1f}s / {dur:.1f}s", flush=True)
    enc.stdin.close()
    enc.wait()
    # audio: the camera's microphone
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp_v, "-i", a.cam, "-map", "0:v", "-map", "1:a?", "-c:v", "copy",
                    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", f"{dur}", "-movflags", "+faststart", a.out], check=True)
    os.remove(tmp_v)
    print("done:", a.out)


if __name__ == "__main__":
    main()
