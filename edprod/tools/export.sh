#!/usr/bin/env bash
# EDPROD export: video + audio -> platform-ready MP4 (Meta / TikTok), loudness -14 LUFS, QC, cover.
# usage: edprod/tools/export.sh <video_only.mp4> <audio.(wav|m4a)> <out_name> [--copy-audio]
#   --copy-audio : keep the audio stream bit-exact (e.g. the historical hook5 track), no loudness change
set -euo pipefail
VID="$1"; AUD="$2"; NAME="$3"; MODE="${4:-}"
OUT="${NAME}.mp4"
if [[ "$MODE" == "--copy-audio" ]]; then
  ffmpeg -v error -y -i "$VID" -i "$AUD" -map 0:v -map 1:a -c:v copy -c:a copy -shortest -movflags +faststart "$OUT"
else
  I=$(ffmpeg -hide_banner -i "$AUD" -af ebur128=framelog=quiet -f null - 2>&1 | awk '/^ +I:/{print $2}' | tail -1)
  GAIN=$(python3 -c "print(round(-14.0 - (${I}), 2))")
  ffmpeg -v error -y -i "$VID" -i "$AUD" -map 0:v -map 1:a -c:v copy -af "volume=${GAIN}dB,alimiter=limit=0.84:level=false" \
    -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart "$OUT"
fi
ffmpeg -v error -y -ss 0.9 -i "$OUT" -frames:v 1 -q:v 2 "${NAME}-cover.jpg"
echo "== loudness"; ffmpeg -hide_banner -i "$OUT" -af ebur128=peak=true:framelog=quiet -f null - 2>&1 | grep -E "^\s+I:|Peak:"
QC=".claude/skills/render-qc/scripts/verify-render.mjs"
if [[ -f "$QC" ]]; then echo "== render-qc"; node "$QC" --input "$OUT" 2>/dev/null | head -1 || true; fi
echo "done: $OUT  ${NAME}-cover.jpg"
