import React from 'react';
import { AbsoluteFill, Audio, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Mascot } from './Mascot';
import { theme } from './theme';
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
  const pop = spring({ frame: f - c.start, fps, config: { damping: 11, mass: 0.5 } });
  return (
    <div style={{ display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap', transform: `scale(${0.85 + pop * 0.15})`, opacity: Math.min(1, pop * 1.6) }}>
      {c.words.map((w, i) => (
        <span
          key={i}
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: w.hi ? theme.highlightText : dark ? theme.bg : theme.text,
            background: w.hi ? theme.accent : 'transparent',
            padding: w.hi ? '0 14px' : 0,
            borderRadius: 10,
          }}
        >
          {w.text}
        </span>
      ))}
    </div>
  );
};

const SceneView: React.FC<{ s: Scene; frames: number; script: ReelScript }> = ({ s, frames, script }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t1 = spring({ frame: f, fps, config: { damping: 14 } });
  const t2 = spring({ frame: f - 7, fps, config: { damping: 14 } });

  if (s.interrupt) {
    // Pattern interrupt: inverted colours, one big calligraphic sentence.
    const k = spring({ frame: f, fps, config: { damping: 18 } });
    return (
      <AbsoluteFill style={{ background: theme.accent, color: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 90 }}>
        <div style={{ position: 'absolute', top: 120, right: 90, fontSize: 34, fontWeight: 700, direction: 'ltr' }}>{script.handle}</div>
        <div style={{ fontFamily: theme.callig, fontSize: 104, lineHeight: 1.55, textAlign: 'center', opacity: k, transform: `translateY(${(1 - k) * 40}px)` }}>
          {s.say.replace(/\*/g, '')}
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ background: theme.bg }}>
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

export const Reel: React.FC<{ script: ReelScript }> = ({ script }) => {
  let from = 0;
  return (
    <AbsoluteFill style={{ background: theme.bg, color: theme.text, fontFamily: theme.sans, direction: 'rtl' }}>
      {script.scenes.map((s, i) => {
        const frames = sceneFrames(s, script.pace);
        const el = (
          <Sequence key={i} from={from} durationInFrames={frames}>
            <SceneView s={s} frames={frames} script={script} />
          </Sequence>
        );
        from += frames;
        return el;
      })}
      {script.voiceover && <Audio src={staticFile(script.voiceover)} />}
      {script.music && <Audio src={staticFile(script.music)} volume={0.12} />}
    </AbsoluteFill>
  );
};
