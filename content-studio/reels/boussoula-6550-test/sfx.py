# Sound design by Rule 1 (SFX only, no voice yet): whoosh 0.3 s before each wipe (0.56 s for the big one
# out of the interrupt), boom + bed drop at the interrupt cut, pop/tick on visuals, sting on money and at the end.
# Master: two-pass loudnorm to -14 LUFS, true peak -1.5 dBTP.  Usage: python3 sfx.py  (needs out/video.mp4)
import json, os, re, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE)
SFX = '../../sfx/ours/'; DUR = 18.6; W = 4/30; INT = 10.3
OUT = 'out/boussoula-6550-test.mp4'
ev = []
for b in [2.6, 6.0, 14.8, 16.4]: ev.append(('whoosh', b - W - 0.3, 0.7))
ev.append(('whoosh-big', 11.8 - W - 0.56, 0.8))
ev.append(('boom', INT, 1.0))
ev += [('pop', 0.0, .5), ('pop', 0.1, .4)] + [('tick', 0.15 + i * 0.13, .35) for i in range(7)] + [('sting', 1.4, .5)]  # hook: cards, 100 leads counter, +10,500
ev += [('pop', 2.8, .45), ('pop', 3.1, .45), ('tick', 3.4, .5), ('tick', 3.55, .5), ('pop', 3.9, .5), ('pop', 4.2, .5), ('tick', 4.7, .6)]  # shipped, arrows, 32.5 x2, "="
ev += [('tick', 6.5 + i * 0.15, .3) for i in range(16)] + [('pop', 9.0, .45)]                                         # returned parcels pile up
ev += [('pop', 12.0, .45), ('typing', 12.05, .35), ('pop', 13.35, .55), ('sting', 13.4, .45), ('tick', 13.75, .5)]   # bars, +10,500, highlighter
ev += [('pop', 14.95, .45), ('tick', 15.25, .5), ('pop', 15.65, .5)]                                                   # recap: 65/50 struck, arrow, card
ev += [('pop', 16.55, .5), ('pop', 16.9, .45), ('sting', 17.9, .5)]                                                    # CTA: compass, link, end
bed = (f"aevalsrc='0.05*(sin(2*PI*55*t)+0.6*sin(2*PI*82.4*t)+0.25*sin(2*PI*110*t))*(1-0.3*sin(2*PI*0.5*t))"
       f"*if(between(t,{INT-0.3},{INT+0.7}),0,1)*min(1,t/0.3)*min(1,({DUR}-t)/0.4)|"
       f"0.05*(sin(2*PI*55*t)+0.6*sin(2*PI*82.4*t)+0.25*sin(2*PI*110*t))*(1+0.3*sin(2*PI*0.5*t))"
       f"*if(between(t,{INT-0.3},{INT+0.7}),0,1)*min(1,t/0.3)*min(1,({DUR}-t)/0.4)':s=48000:d={DUR}")
inp = ['-f', 'lavfi', '-i', bed]; fl = []
for i, (n, t, v) in enumerate(ev):
    inp += ['-i', SFX + n + '.wav']; ms = int(max(0, t) * 1000)
    fl.append(f"[{i+1}]aresample=48000,aformat=channel_layouts=stereo,volume={v},adelay={ms}|{ms}[e{i}]")
mix = '[0]' + ''.join(f'[e{i}]' for i in range(len(ev))) + f"amix=inputs={len(ev)+1}:normalize=0:duration=first"
def run(*a, **k): return subprocess.run(['ffmpeg', '-y', '-hide_banner', *a], check=True, capture_output=True, text=True, **k)
run(*inp, '-filter_complex', ';'.join(fl + [mix + '[a]']), '-map', '[a]', '-t', str(DUR), 'out/mix.wav')
m = json.loads(re.findall(r'\{[^{}]+\}', run('-i', 'out/mix.wav', '-af', 'loudnorm=I=-14:TP=-3:LRA=7:print_format=json', '-f', 'null', '-').stderr)[-1])
ln = (f"loudnorm=I=-14:TP=-3:LRA=7:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
      f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
# limiter at -3 dBFS (4x oversampled) leaves headroom for AAC overshoot -> true peak of the MP4 stays <= -1.5 dBTP
run('-i', 'out/mix.wav', '-af', ln + ',aresample=192000,alimiter=limit=0.708:attack=1:release=40:level=false,aresample=48000', 'out/sfx.wav')
run('-i', 'out/video.mp4', '-i', 'out/sfx.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-shortest', '-movflags', '+faststart', OUT)
print(len(ev), 'sfx events ->', OUT)
