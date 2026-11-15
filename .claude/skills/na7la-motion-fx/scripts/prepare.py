# -*- coding: utf-8 -*-
"""HibAI Motions: prepare the clips for each effect card.
reads   <project>/motions.json   {"cards":[{"effect":"orbit","src":"clip.mp4","t":12.3,"words":["..."]}, ...]}
writes  <project>/cards/NN/f/00001.jpg ...  54 frames (1.8 s, 30 fps, 720x1280)
        <project>/cards/NN/m/00001.png ...  her cut-out (transparent background), same frames
        <project>/thumbs/01.jpg ...         12 stills from her clips (used by orbit, couch wall, UI world, headline wall)
usage   python prepare.py <project>
"""
import json, os, subprocess, sys

P = os.path.abspath(sys.argv[1])
cfg = json.load(open(os.path.join(P, "motions.json"), encoding="utf-8"))
SIZE, N = (720, 1280), 54


def at(f):
    """clip paths in motions.json are relative to the project folder, not to where the script is run from"""
    return f if os.path.isabs(f) else os.path.join(P, f)


def ffmpeg(*a):
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", *a], check=True)


def cutouts(fdir, mdir):
    from rembg import remove, new_session          # pip install "rembg[cpu]" pillow
    from PIL import Image
    s = new_session("u2net_human_seg")
    os.makedirs(mdir, exist_ok=True)
    for f in sorted(os.listdir(fdir)):
        out = os.path.join(mdir, f.replace(".jpg", ".png"))
        if os.path.exists(out):
            continue
        remove(Image.open(os.path.join(fdir, f)).convert("RGB"), session=s, post_process_mask=True).save(out)


for k, c in enumerate(cfg["cards"]):
    d = os.path.join(P, "cards", f"{k + 1:02d}")
    fdir = os.path.join(d, "f")
    os.makedirs(fdir, exist_ok=True)
    if len(os.listdir(fdir)) < N:
        ffmpeg("-ss", f"{c['t']:.3f}", "-i", at(c["src"]), "-frames:v", str(N),
               "-vf", f"fps=30,scale={SIZE[0]}:{SIZE[1]}:force_original_aspect_ratio=increase,crop={SIZE[0]}:{SIZE[1]}",
               "-q:v", "2", os.path.join(fdir, "%05d.jpg"))
    cutouts(fdir, os.path.join(d, "m"))
    print("ready", k + 1, c["effect"], flush=True)

# thumbnails: stills spread across her clips (or the list she gives)
th = os.path.join(P, "thumbs")
os.makedirs(th, exist_ok=True)
src = cfg.get("thumbs") or [{"src": c["src"], "t": c["t"] + 0.9} for c in cfg["cards"]]
i = 0
while len([x for x in os.listdir(th) if x.endswith(".jpg")]) < 12 and src:
    s = src[i % len(src)]
    t = s["t"] + (i // len(src)) * 1.7
    ffmpeg("-ss", f"{t:.2f}", "-i", at(s["src"]), "-frames:v", "1", "-vf", "scale=360:640:force_original_aspect_ratio=increase,crop=360:640",
           "-q:v", "3", os.path.join(th, f"{i + 1:02d}.jpg"))
    i += 1
print("thumbs ok")
