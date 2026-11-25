# Sound design timeline (seconds). Rules measured on the reference: whoosh starts 0.3s before a wipe
# (0.56s for the big one out of the interrupt), boom + music drop on the interrupt cut.
import subprocess, os
SFX='../../sfx/ours/'
DUR=53.5
W=4/30  # wipe starts 4 frames before the scene boundary
ev=[]
for b in [5.2,13.6,40.2,47.6]: ev.append(('whoosh',b-W-0.3,0.8))
ev.append(('whoosh-big',29.4-W-0.56,0.9))
ev.append(('boom',25.2,1.0))
ev+= [('pop',0.3,.5),('pop',1.6,.5),('pop',2.8,.6)]                    # doors + "?"
ev+= [('tick',5.5,.7),('tick',7.6,.7),('tick',9.7,.7),('pop',11.5,.6)]  # list rows + exit row
ev+= [('tick',16.0+i*0.25,.45) for i in range(10)]                       # shelf filling
ev+= [('pop',18.2,.5),('pop',22.4,.7)]                                   # counter, red tag
ev+= [('pop',29.9,.5),('pop',31.7,.5),('pop',32.5,.5),('sting',36.4,.45)]# decision, gap reveal
ev+= [('pop',40.5,.5),('whoosh',43.9,.35)]                               # compass, needle turns back
ev+= [('pop',48.0,.5),('pop',48.4,.5),('sting',52.2,.5)]                 # CTA
inputs=[]; fl=[]
# soft pad 55/82 Hz, drops out around the interrupt (25.0-25.9)
inputs+=['-f','lavfi','-i',f"aevalsrc='0.05*(sin(2*PI*55*t)+0.6*sin(2*PI*82.4*t))*(1-0.3*sin(2*PI*0.25*t))*if(between(t,24.9,25.9),0,1)|0.05*(sin(2*PI*55*t)+0.6*sin(2*PI*82.4*t))*(1+0.3*sin(2*PI*0.25*t))*if(between(t,24.9,25.9),0,1)':s=44100:d={DUR}"]
for i,(n,t,v) in enumerate(ev):
    inputs+=['-i',SFX+n+'.wav']; ms=int(max(0,t)*1000)
    fl.append(f"[{i+1}]aformat=channel_layouts=stereo,volume={v},adelay={ms}|{ms}[e{i}]")
mix=''.join(f'[e{i}]' for i in range(len(ev)))
fl.append(f"[0]{mix}amix=inputs={len(ev)+1}:normalize=0:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11[a]")
subprocess.run(['ffmpeg','-y','-v','error',*inputs,'-filter_complex',';'.join(fl),'-map','[a]','-t',str(DUR),'sfx.wav'],check=True)
subprocess.run(['ffmpeg','-y','-v','error','-i','video.mp4','-i','sfx.wav','-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart','reel-boussoula-khorja.mp4'],check=True)
print(len(ev),'sfx events')
