"""Voice agent, similarity-driven: get the cloned voice as close as possible to NA7LA's real voice.

    WHISPER_DIR=... python clone90.py real_voice.(wav|m4a) lines.json out.wav

Similarity = cosine between speaker embeddings (Chatterbox VoiceEncoder) of the generated audio and
of NA7LA's whole real recording, reported in %. Steps:
 1. ceiling: real voice (first half) vs real voice (second half);
 2. reference search: candidate 12 s clips of the real voice -> render a test line -> keep the best ref;
 3. per line: several takes (spelling variants x temperature x exaggeration), score =
    0.5 * text accuracy (Whisper turbo) + 0.5 * speaker similarity, keep the best;
 4. tone match: long-term spectrum of the result is EQ-corrected toward the real voice (+-6 dB);
 5. -14 LUFS; report json next to the output.
"""
import json, os, re, sys, difflib, subprocess, tempfile
import numpy as np, torch, torchaudio as ta, librosa, soundfile as sf
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
import sherpa_onnx

W = os.environ.get('WHISPER_DIR', 'sherpa-onnx-whisper-turbo') + '/'
norm = lambda s: re.sub(r'[ً-ْـ…،.,؟?!:\s]', '', s)
cos = lambda a, b: float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def load16(path):
    y, _ = librosa.load(path, sr=16000, mono=True)
    return y


def spk(tts, y16):
    """Speaker embedding over 4 s chunks of a 16 kHz signal."""
    hop = 16000 * 4
    chunks = [y16[i:i + hop] for i in range(0, max(1, len(y16) - hop // 2), hop)] or [y16]
    return tts.ve.embeds_from_wavs([c for c in chunks if len(c) > 16000], sample_rate=16000, as_spk=True)


def eq_match(gen, sr, ref16):
    """Correct the long-term average spectrum of gen toward the real voice (smoothed, clipped to +-6 dB)."""
    n_fft = 2048
    g = librosa.resample(gen, orig_sr=sr, target_sr=16000)
    G = np.abs(librosa.stft(g, n_fft=n_fft)).mean(1) + 1e-8
    R = np.abs(librosa.stft(ref16, n_fft=n_fft)).mean(1) + 1e-8
    gain_db = 20 * np.log10(R / R.mean()) - 20 * np.log10(G / G.mean())
    gain_db = np.convolve(gain_db, np.ones(25) / 25, mode='same').clip(-6, 6)
    S = librosa.stft(g, n_fft=n_fft)
    out = librosa.istft(S * (10 ** (gain_db / 20))[:, None], length=len(g))
    return librosa.resample(out, orig_sr=16000, target_sr=sr)


def main(real_path, lines_path, out):
    torch.set_num_threads(4)
    tts = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
    asr = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=W + 'turbo-encoder.int8.onnx', decoder=W + 'turbo-decoder.int8.onnx',
                                                     tokens=W + 'turbo-tokens.txt', language='ar', task='transcribe', num_threads=4)
    real = load16(real_path)
    target = spk(tts, real)
    half = len(real) // 2
    ceiling = cos(spk(tts, real[:half]), spk(tts, real[half:]))
    print(f'ceiling (real vs real): {ceiling*100:.1f}%', flush=True)
    lines = json.load(open(lines_path))
    tmp = tempfile.mkdtemp()

    def render(text, ref, temp=0.7, exag=0.6):
        wav = tts.generate(text, language_id='ar', audio_prompt_path=ref, exaggeration=exag, cfg_weight=0.4, temperature=temp)
        y = wav.squeeze().numpy()
        y16 = librosa.resample(y, orig_sr=tts.sr, target_sr=16000)
        return y, y16

    def text_score(y16, text):
        st = asr.create_stream(); st.accept_waveform(16000, y16); asr.decode_stream(st)
        return difflib.SequenceMatcher(None, norm(text), norm(st.result.text)).ratio(), st.result.text

    # 2. reference search: 12 s windows, keep the 6 most representative, then test-render each
    win = 12 * 16000
    cands = []
    for i in range(0, len(real) - win, win):
        clip = real[i:i + win]
        if np.sqrt(np.mean(clip ** 2)) < 0.02:
            continue
        cands.append((cos(spk(tts, clip), target), i))
    cands = sorted(cands, reverse=True)[:6]
    test = lines[0]['text']
    best_ref = None
    for rep, i in cands:
        p = f'{tmp}/ref_{i}.wav'
        sf.write(p, real[i:i + win], 16000)
        _, y16 = render(test, p)
        s = cos(spk(tts, y16), target)
        print(f'ref @{i/16000:5.1f}s: clip {rep*100:.1f}% -> generated {s*100:.1f}%', flush=True)
        if best_ref is None or s > best_ref[0]:
            best_ref = (s, p, i / 16000)
    ref = best_ref[1]
    print(f'best ref @{best_ref[2]:.1f}s ({best_ref[0]*100:.1f}%)', flush=True)

    # 3. best take per line
    pieces, report = [], []
    for li, line in enumerate(lines):
        best = None
        for text in [line['text']] + line.get('variants', []):
            for temp, exag in ((0.6, 0.5), (0.8, 0.6), (0.7, 0.8)):
                torch.manual_seed(1000 + li * 37 + int(temp * 10) + int(exag * 100))
                y, y16 = render(text, ref, temp, exag)
                ts, heard = text_score(y16, line['text'])
                ss = cos(spk(tts, y16), target)
                score = 0.5 * ts + 0.5 * ss
                if best is None or score > best[0]:
                    best = (score, y, ts, ss, heard)
        print(f'line {li}: text {best[2]*100:.0f}% voice {best[3]*100:.1f}% -> {best[4]}', flush=True)
        report.append({'line': line['text'], 'heard': best[4], 'text_%': round(best[2] * 100), 'voice_%': round(best[3] * 100, 1)})
        pieces += [best[1], np.zeros(int(0.35 * tts.sr), np.float32)]

    # 4. tone match + 5. loudness
    y = np.concatenate(pieces)
    before = cos(spk(tts, librosa.resample(y, orig_sr=tts.sr, target_sr=16000)), target)
    y_eq = eq_match(y, tts.sr, real)
    after = cos(spk(tts, librosa.resample(y_eq, orig_sr=tts.sr, target_sr=16000)), target)
    final = y_eq if after >= before else y
    sf.write(out + '.raw.wav', final / (np.abs(final).max() + 1e-9) * 0.9, tts.sr)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', out + '.raw.wav', '-af', 'highpass=f=70,loudnorm=I=-14:TP=-1.5:LRA=9', '-ar', '44100', out], check=True)
    summary = {'ceiling_%': round(ceiling * 100, 1), 'best_ref_s': best_ref[2], 'voice_before_eq_%': round(before * 100, 1),
               'voice_after_eq_%': round(after * 100, 1), 'final_%': round(max(before, after) * 100, 1),
               'final_vs_ceiling_%': round(max(before, after) / ceiling * 100, 1), 'lines': report}
    json.dump(summary, open(out + '.report.json', 'w'), ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in summary.items() if k != 'lines'}), flush=True)


if __name__ == '__main__':
    main(*sys.argv[1:4])
