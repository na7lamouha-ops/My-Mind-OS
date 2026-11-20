#!/bin/bash
# full shot: 2 blender processes (2 threads each) -> EXR, then OIDN, then grade -> out/frames
cd "$(dirname "$0")"; mkdir -p out/exr out/logs
t0=$(date +%s)
FRAME_START=1  FRAME_END=84  THREADS=2 blender -b --python scene.py > out/logs/r1.log 2>&1 &
FRAME_START=85 FRAME_END=168 THREADS=2 blender -b --python scene.py > out/logs/r2.log 2>&1 &
wait
t1=$(date +%s); echo "render $((t1-t0)) s"
python3 denoise.py out/exr out/dn > out/logs/dn.log 2>&1
blender -b --python grade.py -- out/dn out/frames ${EXPO:-0.3} > out/logs/grade.log 2>&1
echo "total $(( $(date +%s)-t0 )) s"; ls out/frames | wc -l
