import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Mascot } from './Mascot';
import { applyTheme, theme } from './theme';
import { chunkCaptions, sceneFrames } from './timing';
import type { ReelScript, Scene } from './types';
import { VisualView } from './Visuals';

const Grid: React.FC<{ color: string }> = ({ color }) => (
  <AbsoluteFill
    style={{
      backgroundImage: `linear-gradient(${color} 2px, transparent 2px), linear-gradient(90deg, ${color} 2px, transparent 2px)`,
      backgroundSize: '54px 54px',
    }}
  />
);

const Progress: React.FC<{ n: number; total: number }> = ({ n, total }) => (
  <div style={{ display: 'flex', gap: 10, direction: 'ltr' }}>
    {Array.from({ length: total }).map((_, i) => (
      <div key={i} style={{ width: 44, height: 9, borderRadius: 5, background: i < n ? theme.accent : theme.border }} />
    ))}
  </div>
);

const Captions: React.FC<{ say: string; frames: number; dark?: boolean }> = ({ say, frames, dark }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chunks = chunkCaptions(say, frames);
  const c = chunks.find((x) => f >= x.start && f < x.end) ?? chunks[chunks.length - 1];
  // Reference reel: words land one by one (~0.33s apart), each with a 6-frame pop.
  const per = (c.end - c.start) / c.words.length;
  return (
    <div style={{ display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap' }}>
      {c.words.map((w, i) => {
        const at = c.start + i * per;
        const k = spring({ frame: f - at, fps, config: { damping: 12, mass: 0.4 }, durationInFrames: 6 });
        return (
          <span
            key={i}
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: w.hi ? theme.highlightText : dark ? theme.bg : theme.text,
              background: w.hi ? theme.highlight : 'transparent',
              padding: w.hi ? '0 14px' : 0,
              borderRadius: 10,
              opacity: f >= at ? Math.min(1, k * 1.5) : 0,
              transform: `translateY(${(1 - k) * 18}px) scale(${0.8 + k * 0.2})`,
              display: 'inline-block',
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};

const SceneView: React.FC<{ s: Scene; frames: number; script: ReelScript; fadeOut?: boolean }> = ({ s, frames, script, fadeOut }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t1 = spring({ frame: f, fps, config: { damping: 14 } });
  const t2 = spring({ frame: f - 7, fps, config: { damping: 14 } });

  if (s.interrupt) {
    // Pattern interrupt: inverted colours, one big calligraphic sentence.
    const k = spring({ frame: f, fps, config: { damping: 18 } });
    return (
      <AbsoluteFill style={{ background: theme.interruptBg, color: theme.interruptText, alignItems: 'center', justifyContent: 'center', padding: 90 }}>
        <div style={{ position: 'absolute', top: 120, right: 90, fontSize: 34, fontWeight: 700, direction: 'ltr' }}>{script.handle}</div>
        <div style={{ fontFamily: theme.callig, fontSize: 104, lineHeight: 1.55, textAlign: 'center', opacity: k, transform: `translateY(${(1 - k) * 40}px)` }}>
          {s.say.replace(/\*/g, '')}
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ background: theme.bg, opacity: fadeOut ? interpolate(f, [frames - 8, frames], [1, 0.15], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1 }}>
      <Grid color={theme.grid} />
      {/* top bar */}
      <div style={{ position: 'absolute', top: 110, left: 70, right: 70, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {s.chapter ? (
          <div style={{ background: theme.accent, color: theme.bg, fontSize: 34, fontWeight: 700, padding: '8px 26px', borderRadius: 40 }}>{s.chapter}</div>
        ) : (
          <div />
        )}
        <Progress n={s.progress ?? 0} total={script.totalChapters} />
      </div>
      {/* headline */}
      <div style={{ position: 'absolute', top: 250, left: 60, right: 60, textAlign: 'center' }}>
        {s.title1 && (
          <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1.25, opacity: t1, transform: `translateY(${(1 - t1) * 30}px)` }}>{s.title1}</div>
        )}
        {s.title2 && (
          <div style={{ fontFamily: theme.callig, fontSize: 104, color: theme.accent, lineHeight: 1.5, opacity: t2, transform: `translateY(${(1 - t2) * 30}px)` }}>{s.title2}</div>
        )}
      </div>
      {/* visual */}
      <div style={{ position: 'absolute', top: 600, height: 560, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <VisualView v={s.visual} frames={frames} />
      </div>
      {/* captions */}
      <div style={{ position: 'absolute', top: 1190, left: 70, right: 70 }}>
        <Captions say={s.say} frames={frames} />
      </div>
      <div style={{ position: 'absolute', top: 1330, left: 70 }}>
        <Mascot mood={s.mascot ?? 'talk'} />
      </div>
    </AbsoluteFill>
  );
};

/** Panel wipe measured on the reference: 9 frames, enters from the right, fully covers at frame 4, exits left. */
const Wipe: React.FC = () => {
  const f = useCurrentFrame();
  const x = interpolate(f, [0, 4, 5, 9], [100, 0, 0, -100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ transform: `translateX(${x}%)`, background: theme.accent }}>
      <Grid color="rgba(0,0,0,0.08)" />
    </AbsoluteFill>
  );
};

const Sfx: React.FC<{ at: number; src: string; volume?: number }> = ({ at, src, volume = 1 }) => (
  <Sequence from={Math.max(0, at)} durationInFrames={60}>
    <Audio src={staticFile(`sfx/${src}.wav`)} volume={volume} />
  </Sequence>
);

export const Reel: React.FC<{ script: ReelScript }> = ({ script }) => {
  applyTheme(script.theme);
  const sfx = script.sfx !== false;
  const starts: number[] = [];
  let acc = 0;
  for (const s of script.scenes) {
    starts.push(acc);
    acc += sceneFrames(s, script.pace);
  }
  const total = acc;
  const interruptAt = script.scenes.map((s, i) => (s.interrupt ? starts[i] : -1)).filter((x) => x >= 0);

  return (
    <AbsoluteFill style={{ background: theme.bg, color: theme.text, fontFamily: theme.sans, direction: 'rtl' }}>
      {script.scenes.map((s, i) => {
        const frames = sceneFrames(s, script.pace);
        const next = script.scenes[i + 1];
        return (
          <Sequence key={i} from={starts[i]} durationInFrames={frames}>
            <SceneView s={s} frames={frames} script={script} fadeOut={!!next?.interrupt} />
          </Sequence>
        );
      })}

      {/* transitions + sound design, all derived from the script */}
      {script.scenes.map((s, i) => {
        if (i === 0) return null;
        const prev = script.scenes[i - 1];
        const at = starts[i];
        const frames = sceneFrames(s, script.pace);
        const out: React.ReactNode[] = [];
        if (s.interrupt) {
          // hard cut + sub boom; music drops out (see musicVolume)
          if (sfx) out.push(<Sfx key="b" at={at} src="boom" volume={0.9} />);
        } else if (prev.interrupt || s.chapter !== prev.chapter) {
          out.push(
            <Sequence key="w" from={at - 4} durationInFrames={10}>
              <Wipe />
            </Sequence>,
          );
          // sound leads picture: whoosh starts ~0.3s before the panel
          if (sfx) out.push(<Sfx key="s" at={at - 4 - (prev.interrupt ? 17 : 9)} src={prev.interrupt ? 'whoosh-big' : 'whoosh'} volume={0.8} />);
        }
        if (sfx && s.visual && s.visual.type !== 'none') {
          const v = s.visual;
          out.push(<Sfx key="p" at={at + 8} src="pop" volume={0.45} />);
          if (v.type === 'checklist' || v.type === 'funnel') {
            const n = v.type === 'checklist' ? v.items.length : v.steps.length;
            const per = (frames * (v.type === 'checklist' ? 0.75 : 0.7)) / n;
            for (let k = 0; k < n; k++) out.push(<Sfx key={'t' + k} at={at + 6 + Math.round(k * per)} src="tick" volume={0.6} />);
          }
          if (v.type === 'card') out.push(<Sfx key="ty" at={at + 10} src="typing" volume={0.35} />);
        }
        return <React.Fragment key={i}>{out}</React.Fragment>;
      })}
      {sfx && script.scenes[0].visual && <Sfx at={8} src="pop" volume={0.45} />}
      {sfx && <Sfx at={total - 36} src="sting" volume={0.5} />}

      {script.voiceover && <Audio src={staticFile(script.voiceover)} />}
      {script.music && (
        <Audio
          src={staticFile(script.music)}
          volume={(f) => (interruptAt.some((t) => f >= t - 9 && f < t + 12) ? 0 : 0.12)}
        />
      )}
    </AbsoluteFill>
  );
};
