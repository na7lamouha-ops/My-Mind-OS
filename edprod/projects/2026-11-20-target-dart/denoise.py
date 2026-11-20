"""OIDN denoise of the multilayer EXRs written by scene.py (Blender here has no OIDN).

python3 denoise.py IN_DIR OUT_DIR     (needs: pip install oidn OpenEXR)
Uses beauty + albedo + normal (HDR mode) and writes a linear RGB float EXR per frame.
"""
import sys, os, glob, time
import numpy as np
import OpenEXR
import oidn

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
import ctypes
_lib = ctypes.CDLL(glob.glob(os.path.join(os.path.dirname(oidn.__file__), "lib.linux.x64",
                                         "libOpenImageDenoise.so*"))[0])
_set1b = _lib.oidnSetFilter1b
_set1b.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_bool]; _set1b.restype = None
dev = oidn.NewDevice(); oidn.CommitDevice(dev)

HAZE = float(os.environ.get("HAZE_FAKE", 1.0))

def add_haze(img):
    """cheap atmospheric haze: the warm key beam falling from above through light haze
    (soft cone from the top centre) + a faint uniform veil that lifts the blacks a touch."""
    if HAZE <= 0:
        return img
    h, w = img.shape[:2]
    y = (np.arange(h, dtype=np.float32) / h)[:, None]
    x = (np.arange(w, dtype=np.float32) / w - 0.5)[None, :]
    width = 0.16 + 0.22 * y                      # the cone widens downward
    beam = np.exp(-(x / width) ** 2) * (1.0 - 0.55 * y)
    warm = np.array([1.0, 0.72, 0.45], np.float32)
    veil = np.array([0.55, 0.55, 0.6], np.float32)
    return img + HAZE * (0.010 * beam[..., None] * warm + 0.0025 * veil)

for path in sorted(glob.glob(os.path.join(src, "*.exr"))):
    out = os.path.join(dst, os.path.basename(path))
    if os.path.exists(out) and os.path.getmtime(out) > os.path.getmtime(path):
        continue
    if time.time() - os.path.getmtime(path) < float(os.environ.get("MIN_AGE", 0)):
        continue                                   # still being written by Blender
    t = time.time()
    ch = OpenEXR.File(path).parts[0].channels
    color = np.ascontiguousarray(ch["ViewLayer.Combined"].pixels[..., :3], dtype=np.float32)
    alb = np.ascontiguousarray(ch["ViewLayer.Denoising Albedo"].pixels[..., :3], dtype=np.float32)
    nrm = np.ascontiguousarray(np.stack([ch[f"ViewLayer.Denoising Normal.{a}"].pixels
                                         for a in "XYZ"], -1), dtype=np.float32)
    res = np.zeros_like(color)
    h, w = color.shape[:2]
    flt = oidn.NewFilter(dev, "RT")
    oidn.SetSharedFilterImage(flt, "color", color, oidn.FORMAT_FLOAT3, w, h)
    oidn.SetSharedFilterImage(flt, "albedo", alb, oidn.FORMAT_FLOAT3, w, h)
    oidn.SetSharedFilterImage(flt, "normal", nrm, oidn.FORMAT_FLOAT3, w, h)
    oidn.SetSharedFilterImage(flt, "output", res, oidn.FORMAT_FLOAT3, w, h)
    _set1b(flt, b"hdr", True)
    oidn.CommitFilter(flt); oidn.ExecuteFilter(flt)
    err = oidn.GetDeviceError(dev)
    oidn.ReleaseFilter(flt)
    res = add_haze(res)
    hdr = OpenEXR.File({"compression": OpenEXR.ZIP_COMPRESSION, "type": OpenEXR.scanlineimage},
                       {"RGB": np.clip(res, 0, 60000).astype(np.float16)})
    hdr.write(out)
    if os.environ.get("DELETE_SRC") == "1":
        os.remove(path)                            # raw multilayer EXRs are ~44 MB each
    print(f"[dn] {os.path.basename(path)} {time.time()-t:.1f}s err={err}", flush=True)
