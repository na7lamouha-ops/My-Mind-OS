# Avatar lip-sync (صورة وحدة + صوت = أفاتار يهدر)

```bash
pip install librosa mediapipe opencv-python-headless   # + apt-get install libegl1 on Linux
# face model (data file, 3.7 MB):
curl -o face_landmarker.task https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
python3 visemes.py voice.wav cues.json                  # mouth shapes from the voice (any language)
python3 animate.py avatar.png face_landmarker.task voice.wav cues.json frames 1080
ffmpeg -framerate 30 -i frames/frame_%05d.png -i voice.wav -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest talking.mp4
```

- `visemes.py`: loudness + vowel formants → 9 mouth shapes (X A B C D E F G H) at 30 fps.
- `animate.py`: finds 478 face points once, then warps the portrait every frame: jaw (lower lip + chin + beard), lip corners, mouth interior + teeth, blinks, brow raises on emphasis, small head motion.
- Portrait: front-facing, mouth closed, eyes open, ≥ 1024 px. Avatar photos and recordings are **not** committed (public repo).
