# Voice agent (صوت NA7LA، open source)

السكريبت مكتوب ← صوتك المنسوخ ← أحسن take لكل جملة ← ‎-14 LUFS.

- **الموديل:** Chatterbox Multilingual (Resemble AI، رخصة MIT)، ينسخ الصوت من 10 ثواني تقريباً، والعربية مدعومة. الصوت يخرج فيه **watermark ما يتسمعش** (Perth) يبيّن بلي هو مولّد بالـ AI.
- **الاختيار الأوتوماتيكي:** كل جملة تتولّد بأكثر من كتابة (بلا تشكيل / بالتشكيل) وبأكثر من temperature. Whisper يكتب واش سمع، ونخليو الـ take اللي قريب أكثر للنص.
- **الشبكة:** الموديلات من HuggingFace (huggingface.co, us.aws.cdn.hf.co, cas-server.xethub.hf.co).

```bash
python3 -m venv venv && venv/bin/pip install chatterbox-tts "setuptools<81" sherpa-onnx
# Whisper turbo for the checker:
curl -L https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-turbo.tar.bz2 | tar xj
WHISPER_DIR=sherpa-onnx-whisper-turbo venv/bin/python speak.py ref.wav lines.json voice.wav
# then: ../avatar-lipsync (visemes.py + animate.py) to make the avatar speak it
```

`ref.wav`: 10–12 s of NA7LA speaking, clean (not committed). `lines.json`: `[{"text": "...", "variants": ["...diacritics..."]}]`.
CPU speed: ~35 s per line take.
