"""Talking avatar from ONE portrait + a voice file (no external model besides face landmarks).

    python3 animate.py portrait.png face_landmarker.task voice.wav cues.json out_dir [size]

1. MediaPipe Face Landmarker finds 478 face points once (lips, eyelids, brows, chin).
2. Every frame (30 fps) we build a smooth displacement field and warp the portrait (cv2.remap):
   jaw drop (lower lip + chin + beard move together), lip corners (wide / round), smile,
   brow raise on loud syllables, blinks every 2.5-5 s, small head motion with the voice.
3. When the lips part, the mouth interior (dark + upper teeth) is painted between the inner lips.
4. Mouth shapes come from cues.json (visemes.py), eased so the motion is continuous.
Writes out_dir/frame_00000.png ... at `size` px (square).
"""
import json, sys, os
import numpy as np, cv2, librosa

FPS = 30
# viseme -> (jaw open 0..1, width -1 round .. +1 wide, teeth 0..1)
VIS = {'X': (0.0, 0.0, 0.0), 'A': (0.0, -0.1, 0.0), 'B': (0.18, 0.15, 1.0), 'C': (0.32, 0.7, 0.9),
       'D': (0.85, 0.2, 0.7), 'E': (0.45, -0.35, 0.4), 'F': (0.25, -0.9, 0.2), 'G': (0.12, 0.1, 1.0),
       'H': (0.4, 0.1, 0.8)}
UP_IN = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308]
LO_IN = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308]
EYES = [  # (upper lid, lower lid) contours
    ([33, 246, 161, 160, 159, 158, 157, 173, 133], [33, 7, 163, 144, 145, 153, 154, 155, 133]),
    ([263, 466, 388, 387, 386, 385, 384, 398, 362], [263, 249, 390, 373, 374, 380, 381, 382, 362]),
]
BROWS = [[70, 63, 105, 66, 107], [300, 293, 334, 296, 336]]


def landmarks(img, model):
    import mediapipe as mp
    from mediapipe.tasks.python import vision, BaseOptions
    det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=model, delegate=BaseOptions.Delegate.CPU), num_faces=1))
    r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
    h, w = img.shape[:2]
    return np.array([[p.x * w, p.y * h] for p in r.face_landmarks[0]], np.float32)


def g(x, s):
    return np.exp(-(x * x) / (2 * s * s))


def main(portrait, model, voice, cues_path, out, size=1080):
    os.makedirs(out, exist_ok=True)
    img = cv2.imread(portrait)
    H, W = img.shape[:2]
    L = landmarks(img, model)
    face_w = np.linalg.norm(L[234] - L[454])                  # cheek to cheek
    u = face_w / 100.0                                         # 1 unit = 1% of face width
    cx, seam = (L[13, 0] + L[14, 0]) / 2, (L[13, 1] + L[14, 1]) / 2
    mouth_w = np.linalg.norm(L[61] - L[291])
    chin = L[152, 1]
    beard_bottom = chin + 18 * u
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

    # static weight maps
    jaw_x = g(xx - cx, 34 * u)
    jaw_y = np.clip((yy - seam) / (3 * u), 0, 1) * np.clip((beard_bottom + 14 * u - yy) / (16 * u), 0, 1)
    jaw_w = jaw_x * jaw_y                                      # lower face block
    up_w = g(xx - cx, 22 * u) * np.clip((seam - yy) / (1.5 * u), 0, 1) * g(yy - seam, 6 * u)
    near_mouth = g(yy - seam, 7 * u)
    side = np.sign(xx - cx)
    corner_w = near_mouth * g(np.abs(xx - cx) - mouth_w / 2, 14 * u)
    brow_w = sum(g(xx - L[b].mean(0)[0], 14 * u) * g(yy - L[b].mean(0)[1], 6 * u) for b in BROWS)

    # audio loudness per frame (for emphasis)
    y, sr = librosa.load(voice, sr=16000)
    hop = sr // FPS
    rms = librosa.feature.rms(y=y, frame_length=hop * 2, hop_length=hop)[0]
    loud = np.clip(rms / (np.percentile(rms, 95) + 1e-9), 0, 1.2)
    n = len(rms)
    cues = json.load(open(cues_path))['mouthCues']
    target = np.zeros((n, 3), np.float32)
    for c in cues:
        a, b = int(c['start'] * FPS), int(np.ceil(c['end'] * FPS))
        target[a:b] = VIS.get(c['value'], VIS['X'])
    target[:, 0] *= 0.55 + 0.45 * np.clip(loud, 0, 1)          # louder = wider jaw

    rng = np.random.default_rng(7)
    blinks, t = [], 1.2
    while t < n / FPS:
        blinks.append(t); t += rng.uniform(2.5, 5.0)
    def lid_colour(idx):  # eyelid skin just above the upper lid, slightly darker
        x, yv = L[idx]
        patch = img[int(yv - 2.2 * u):int(yv - 1.2 * u), int(x - 1.5 * u):int(x + 1.5 * u)].reshape(-1, 3)
        return np.median(patch, 0) * 0.82
    lid_cols = [lid_colour(159), lid_colour(386)]

    state = np.zeros(3, np.float32)
    brow = 0.0
    # framing: head + beard fill the square (centred on the nose)
    box = int(min(H, W, face_w * 2.3))
    x0 = int(np.clip(L[4, 0] - box / 2, 0, W - box)); y0 = int(np.clip(L[4, 1] - box * 0.5, 0, H - box))
    for i in range(n):
        state += (target[i] - state) * 0.55                    # ease toward the shape
        jaw, wid, teeth = state
        drop = jaw * 9 * u
        peak = loud[i] > 0.85 and (i == 0 or loud[i - 1] <= 0.85)
        brow = max(brow * 0.9, 1.0 if peak and rng.random() < 0.35 else 0.0)
        tt = i / FPS
        bl = max([max(0.0, 1 - abs(tt - b) / 0.075) for b in blinks] + [0.0])
        bl = min(1.0, bl * 1.4)

        dy = jaw_w * drop - up_w * drop * 0.18 - brow_w * brow * 2.2 * u
        dx = corner_w * side * wid * 3.2 * u
        dy -= corner_w * 0.6 * u * max(0.0, wid)               # wide = corners slightly up
        mx, my = xx - dx, yy - dy
        out_img = cv2.remap(img, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

        # mouth interior between the displaced inner lips
        if drop > 0.6 * u:
            def moved(idx, k):
                p = L[idx].copy(); p[:, 1] += k
                return p
            upper = moved(UP_IN, -drop * 0.18)
            lower = moved(LO_IN, drop)
            for arr in (upper, lower):
                arr[:, 0] += np.sign(arr[:, 0] - cx) * wid * 3.2 * u * g(np.abs(arr[:, 0] - cx) - mouth_w / 2, 14 * u)
            poly = np.concatenate([upper, lower[::-1]]).astype(np.int32)
            mask = np.zeros((H, W), np.uint8)
            cv2.fillPoly(mask, [poly], 255)
            mask = cv2.GaussianBlur(mask, (0, 0), 1.2).astype(np.float32)[..., None] / 255
            inner = np.zeros_like(out_img); inner[:] = (22, 14, 40)    # BGR dark red-brown
            th = min(drop * 0.35, 2.0 * u) * teeth
            if th > 1:
                tm = np.zeros((H, W), np.uint8)
                top = upper.copy(); bot = upper.copy(); bot[:, 1] += th
                cv2.fillPoly(tm, [np.concatenate([top, bot[::-1]]).astype(np.int32)], 255)
                tm = cv2.bitwise_and(tm, cv2.GaussianBlur((mask[..., 0] * 255).astype(np.uint8), (0, 0), 1))
                inner[tm > 128] = (176, 188, 200)
            out_img = (out_img * (1 - mask) + inner * mask).astype(np.uint8)

        # blink: lower the upper lid with skin colour
        if bl > 0.02:
            for (up, lo), col in zip(EYES, lid_cols):
                pu, pl = L[up], L[lo]
                lid = pu + (pl - pu) * bl
                m = np.zeros((H, W), np.uint8)
                cv2.fillPoly(m, [np.concatenate([pu, lid[::-1]]).astype(np.int32)], 255)
                m = cv2.GaussianBlur(m, (0, 0), 1.0).astype(np.float32)[..., None] / 255
                out_img = (out_img * (1 - m) + col * m).astype(np.uint8)
                cv2.polylines(out_img, [lid.astype(np.int32)], False, (18, 14, 14), max(2, int(0.8 * u)), cv2.LINE_AA)

        # small head motion: sway + nod with the voice + breathing
        ang = 0.9 * np.sin(tt * 0.9) + 0.6 * np.sin(tt * 2.3)
        nod = loud[i] * 1.2 * u
        M = cv2.getRotationMatrix2D((W / 2, H * 0.62), ang, 1.0 + 0.004 * np.sin(tt * 1.6))
        M[1, 2] += nod
        out_img = cv2.warpAffine(out_img, M, (W, H), borderMode=cv2.BORDER_REPLICATE)
        cv2.imwrite(f'{out}/frame_{i:05d}.png', cv2.resize(out_img[y0:y0 + box, x0:x0 + box], (size, size), interpolation=cv2.INTER_AREA))
    print(n, 'frames')


if __name__ == '__main__':
    main(*sys.argv[1:6], *(int(a) for a in sys.argv[6:7]))
