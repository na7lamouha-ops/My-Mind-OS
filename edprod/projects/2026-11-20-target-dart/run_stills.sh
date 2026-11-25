#!/bin/bash
# usage: TAG=x [env overrides] ./run_stills.sh   -> out/stills/png/<TAG>_####.png
cd "$(dirname "$0")"
T=${TAG:-t}; mkdir -p out/stills/raw_$T
STILLS=${STILLS:-40,96,160} OUT=$PWD/out/stills/raw_$T/${T}_ blender -b --python scene.py 2>&1 | grep -E "^\[|Error|Traceback"
python3 denoise.py out/stills/raw_$T out/stills/dn_$T >/dev/null
blender -b --python grade.py -- out/stills/dn_$T out/stills/png ${EXPO:-0} 2>&1 | grep -E "Error|Trace"
