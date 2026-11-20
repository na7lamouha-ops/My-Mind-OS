#!/bin/bash
# frames (1440x810 16-bit PNG) -> lanczos 1920x1080 + soft vignette + temporal film grain
# -> H.264 CRF 14 yuv420p BT.709 30 fps faststart ; then mux the synthesized audio.
cd "$(dirname "$0")"
VF="scale=1920:1080:flags=lanczos+accurate_rnd+full_chroma_int,format=rgb48le,vignette=angle=PI/5:mode=forward,format=yuv444p16le,noise=c0s=9:c0f=t+u:c1s=3:c1f=t+u:c2s=3:c2f=t+u,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p"
ffmpeg -hide_banner -loglevel error -y -framerate 30 -i out/frames/f_%04d.png -vf "$VF" \
  -c:v libx264 -profile:v high -preset slow -crf 14 -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -movflags +faststart out/target-dart-silent.mp4
ffmpeg -hide_banner -loglevel error -y -i out/target-dart-silent.mp4 -i out/target-dart.wav \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart out/target-dart.mp4
ls -la out/*.mp4
