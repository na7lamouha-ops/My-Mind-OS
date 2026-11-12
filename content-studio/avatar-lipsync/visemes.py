"""Audio -> mouth shapes (visemes) at 30 fps, language-independent (works on Darija).

Shapes (same letters as the mouth chart): X rest, A closed (m/b), B teeth (most consonants),
C wide (ee), D open (aa), E slightly round (o), F round (oo), G f, H l.
Method: loudness decides closed vs open; for voiced frames, LPC formants F1 (jaw opening)
and F2 (front/back = spread/round) pick the vowel shape; noisy unvoiced frames = teeth (B).
Short dips between voiced frames = lips closed (A). Shapes shorter than 2 frames are merged.
Usage: python3 visemes.py voice.wav cues.json
"""
import json, sys
import numpy as np, librosa

FPS = 30

def formants(frame, sr, order=10):
    if np.max(np.abs(frame)) < 1e-4:
        return None
    a = librosa.lpc(frame * np.hamming(len(frame)), order=order)
    roots = [r for r in np.roots(a) if np.imag(r) >= 0.01]
    f = sorted(np.angle(roots) * sr / (2 * np.pi))
    f = [x for x in f if 200 < x < 3500]
    return f[:2] if len(f) >= 2 else None

def analyse(path):
    y, sr = librosa.load(path, sr=16000)
    hop = sr // FPS
    rms = librosa.feature.rms(y=y, frame_length=hop * 2, hop_length=hop)[0]
    zcr = librosa.feature.zero_crossing_rate(y, frame_length=hop * 2, hop_length=hop)[0]
    cen = librosa.feature.spectral_centroid(y=y, sr=sr, n_fft=hop * 2, hop_length=hop)[0]
    silent = rms < np.percentile(rms, 30) * 1.2
    loud = rms / (np.percentile(rms, 95) + 1e-9)
    shapes = []
    for i in range(len(rms)):
        if silent[i]:
            shapes.append('X'); continue
        fr = y[i * hop: i * hop + hop * 2]
        if zcr[i] > 0.18 or cen[i] > 3200:          # hiss / fricative
            shapes.append('G' if 2000 < cen[i] < 3000 and zcr[i] < 0.25 else 'B'); continue
        fm = formants(fr, sr) if len(fr) == hop * 2 else None
        if fm is None:
            shapes.append('B'); continue
        f1, f2 = fm
        if loud[i] < 0.25:
            shapes.append('B')
        elif f1 > 650:
            shapes.append('D')                       # open "aa"
        elif f2 > 1900:
            shapes.append('C')                       # spread "ee"
        elif f2 < 1100:
            shapes.append('F' if f1 < 450 else 'E')  # rounded "oo" / "o"
        elif f1 < 400:
            shapes.append('H')                       # l / n-like
        else:
            shapes.append('E' if f2 < 1400 else 'C')
    # brief dips between voiced frames -> lips closed (m/b)
    for i in range(1, len(shapes) - 1):
        if shapes[i] == 'X' and shapes[i - 1] not in 'X' and shapes[i + 1] not in 'X':
            shapes[i] = 'A'
    # merge runs shorter than 2 frames
    for i in range(1, len(shapes) - 1):
        if shapes[i] != shapes[i - 1] and shapes[i] != shapes[i + 1]:
            shapes[i] = shapes[i - 1]
    cues = []
    for i, s in enumerate(shapes):
        if cues and cues[-1]['value'] == s:
            cues[-1]['end'] = round((i + 1) / FPS, 3)
        else:
            cues.append({'start': round(i / FPS, 3), 'end': round((i + 1) / FPS, 3), 'value': s})
    return {'fps': FPS, 'duration': round(len(y) / sr, 3), 'mouthCues': cues}

if __name__ == '__main__':
    out = analyse(sys.argv[1])
    json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False, indent=0)
    from collections import Counter
    print(len(out['mouthCues']), 'cues', dict(Counter(c['value'] for c in out['mouthCues'])))
