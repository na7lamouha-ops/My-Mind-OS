"""Light-only FX plates from Gemini (Nano Banana) for the motion scripts: fx/bullet.png and fx/explosion.png.
The image model draws light on pure black and nothing else: no text, no logo, no controller, no weapon (team rules 1 and 2).
Needs GEMINI_API_KEY in the environment; GEMINI_IMAGE_MODEL overrides the model (default gemini-2.5-flash-image).
Usage: gen_fx_gemini.py [bullet] [explosion]   (default: both)  -> fx/<name>.png, plus fx/<name>-raw.png as returned"""
import os
import sys
import json
import base64
import urllib.request
import numpy as np
import cv2

KIT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = KIT + "/fx"
KEY = os.environ.get("GEMINI_API_KEY")
MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
RULES = ("Pure black background (#000000) everywhere outside the light. Absolutely no text, letters, numbers, logos, "
         "symbols, objects, people, weapons or guns: only glowing light and energy. Photoreal VFX plate, high dynamic range, "
         "crisp core, soft bloom, for additive compositing.")
PROMPTS = {
    "bullet": ("A single horizontal tracer of electric-blue plasma (#28D7FF) flying left to right, centred vertically. "
               "White-hot glowing head on the right third, a long tapering cyan light trail behind it to the left, "
               "a few tiny crackling electric filaments and sparks along the trail. ", "16:9"),
    "explosion": ("A centred burst of pure energy at the moment of impact: a blinding white-hot core, a shockwave ring "
                  "expanding outward, branching electric-blue (#28D7FF) lightning arcs on the left half and warm orange "
                  "(#FF7814) energy sparks on the right half, fine glowing particles flying out radially. ", "1:1"),
}


def generate(name):
    prompt, aspect = PROMPTS[name]
    body = {"contents": [{"parts": [{"text": prompt + RULES}]}],
            "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": aspect}}}
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
        data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": KEY})
    with urllib.request.urlopen(req, timeout=180) as r:
        res = json.load(r)
    parts = [p for c in res.get("candidates", []) for p in c.get("content", {}).get("parts", []) if "inlineData" in p]
    if not parts:
        sys.exit(f"{name}: no image returned: {json.dumps(res)[:500]}")
    raw = cv2.imdecode(np.frombuffer(base64.b64decode(parts[0]["inlineData"]["data"]), np.uint8), cv2.IMREAD_COLOR)
    cv2.imwrite(f"{FX}/{name}-raw.png", raw)
    # crush the near-black so the plate adds light only (no grey veil when screened/added), feather the borders
    img = np.clip((raw.astype(np.float32) - 14) / (255 - 14), 0, 1)
    h, w = img.shape[:2]
    yy = np.linspace(0, 1, h)[:, None]; xx = np.linspace(0, 1, w)[None, :]
    v = np.clip(np.minimum(np.minimum(yy, 1 - yy), np.minimum(xx, 1 - xx)) / 0.08, 0, 1)
    cv2.imwrite(f"{FX}/{name}.png", (img * (v * v * (3 - 2 * v))[..., None] * 255).astype(np.uint8))
    print(f"{FX}/{name}.png  ({MODEL}, {w}x{h})")


if __name__ == "__main__":
    if not KEY:
        sys.exit("GEMINI_API_KEY is not set: add it in the environment settings, then start a new session.")
    os.makedirs(FX, exist_ok=True)
    for n in sys.argv[1:] or list(PROMPTS):
        generate(n)
