# Sound design by Rule 1: whoosh 0.3s before each wipe (0.56s for the big one out of the interrupt),
# boom + pad drop at the interrupt cut, pop/tick on visuals, sting on reveals and at the end.
import subprocess
SFX='../../sfx/ours/'; DUR=53.2; W=4/30; INT=28.4
ev=[]
for b in [6.2,12.8,19.2,43.0,46.6]: ev.append(('whoosh',b-W-0.3,0.8))
ev.append(('whoosh-big',31.6-W-0.56,0.9))
ev.append(('boom',INT,1.0))
ev+=[('pop',0.2,.45)]+[('pop',0.4+i*0.35,.4) for i in range(4)]+[('sting',4.4,.35)]      # hook: flag, 4 pawns, one glows
ev+=[('pop',6.4,.45),('tick',8.7,.5),('tick',9.0,.5),('pop',11.6,.6)]                     # loop: pawn, stumble, "same point"
ev+=[('pop',13.1,.45)]+[('tick',13.7+i*0.12,.25) for i in range(9)]+[('pop',17.8,.6)]   # road appears, erased, "?"
ev+=[('whoosh',21.6,.45),('boom',23.6,.7),('pop',23.62,.6)]                              # speed, crash
ev+=[('tick',24.6+i*0.12,.3) for i in range(18)]                                         # boxes pile in the garage
ev+=[('pop',32.1,.5)]+[('tick',t,.7) for t in (35.4,36.8,38.0,39.2)]+[('sting',40.8,.45)] # goal, 4 rules, arrived
ev+=[('pop',43.2,.45),('pop',47.0,.5),('pop',47.4,.5),('sting',52.0,.5)]                 # recap, CTA
inp=['-f','lavfi','-i',f"aevalsrc='0.05*(sin(2*PI*55*t)+0.6*sin(2*PI*82.4*t))*(1-0.3*sin(2*PI*0.25*t))*if(between(t,{INT-0.3},{INT+0.6}),0,1)|0.05*(sin(2*PI*55*t)+0.6*sin(2*PI*82.4*t))*(1+0.3*sin(2*PI*0.25*t))*if(between(t,{INT-0.3},{INT+0.6}),0,1)':s=44100:d={DUR}"]
fl=[]
for i,(n,t,v) in enumerate(ev):
    inp+=['-i',SFX+n+'.wav']; ms=int(max(0,t)*1000)
    fl.append(f"[{i+1}]aformat=channel_layouts=stereo,volume={v},adelay={ms}|{ms}[e{i}]")
fl.append('[0]'+''.join(f'[e{i}]' for i in range(len(ev)))+f"amix=inputs={len(ev)+1}:normalize=0:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11[a]")
subprocess.run(['ffmpeg','-y','-v','error',*inp,'-filter_complex',';'.join(fl),'-map','[a]','-t',str(DUR),'sfx.wav'],check=True)
subprocess.run(['ffmpeg','-y','-v','error','-i','video.mp4','-i','sfx.wav','-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart','reel-boussoula-target.mp4'],check=True)
print(len(ev),'sfx events')
