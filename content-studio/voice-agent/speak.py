"""Voice agent: script lines -> NA7LA's cloned voice, best take per line, -14 LUFS.

    HF_HOME=... python speak.py ref.wav lines.json out.wav
lines.json: [{"text": "...plain text...", "variants": ["...with diacritics...", ...]}, ...]

Open-source: Chatterbox Multilingual (Resemble AI, zero-shot cloning from ~10 s of reference,
Arabic supported; output carries Resemble's inaudible Perth watermark).
For each line it renders several takes (spelling variants x temperatures), transcribes each with
Whisper turbo (sherpa-onnx) and keeps the take whose transcript is closest to the plain text.
"""
import json, sys, difflib, re, os, time
import numpy as np, torch, torchaudio as ta, librosa
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
import sherpa_onnx

WHISPER = os.environ.get('WHISPER_DIR', 'sherpa-onnx-whisper-turbo') + '/'
norm = lambda s: re.sub(r'[ً-ْـ…،.,؟?!:\s]', '', s)

def main(ref, lines_path, out):
    torch.set_num_threads(4)
    tts = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
    asr = sherpa_onnx.OfflineRecognizer.from_whisper(
        encoder=WHISPER + 'turbo-encoder.int8.onnx', decoder=WHISPER + 'turbo-decoder.int8.onnx',
        tokens=WHISPER + 'turbo-tokens.txt', language='ar', task='transcribe', num_threads=4)
    lines = json.load(open(lines_path))
    pieces, report = [], []
    for li, line in enumerate(lines):
        best = None
        for vi, text in enumerate([line['text']] + line.get('variants', [])):
            for temp in (0.6, 0.8):
                torch.manual_seed(100 * li + 10 * vi + int(temp * 10))
                wav = tts.generate(text, language_id='ar', audio_prompt_path=ref,
                                   exaggeration=0.6, cfg_weight=0.4, temperature=temp)
                a16 = librosa.resample(wav.squeeze().numpy(), orig_sr=tts.sr, target_sr=16000)
                st = asr.create_stream(); st.accept_waveform(16000, a16); asr.decode_stream(st)
                score = difflib.SequenceMatcher(None, norm(line['text']), norm(st.result.text)).ratio()
                if best is None or score > best[0]:
                    best = (score, wav, st.result.text, vi, temp)
        print(f'line {li}: score {best[0]:.2f} (variant {best[3]}, temp {best[4]}) -> {best[2]}', flush=True)
        report.append({'line': line['text'], 'heard': best[2], 'score': round(best[0], 2)})
        pieces += [best[1], torch.zeros(1, int(0.22 * tts.sr))]
    ta.save(out + '.raw.wav', torch.cat(pieces, dim=1), tts.sr)
    os.system(f'ffmpeg -v error -y -i "{out}.raw.wav" -af "highpass=f=70,loudnorm=I=-14:TP=-1.5:LRA=9" -ar 44100 "{out}"')
    json.dump(report, open(out + '.report.json', 'w'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main(*sys.argv[1:4])
