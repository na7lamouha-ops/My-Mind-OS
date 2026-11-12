import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from './theme';
import type { Visual } from './types';

const useIn = (delay = 0) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: { damping: 14, mass: 0.7 } });
};

const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      background: theme.surface,
      border: `2px solid ${theme.border}`,
      borderRadius: 28,
      padding: '28px 36px',
      boxShadow: '0 30px 60px rgba(0,0,0,0.45)',
      ...style,
    }}
  >
    {children}
  </div>
);

const num = (n: number) => Math.round(n).toLocaleString('en-US');

export const VisualView: React.FC<{ v?: Visual; frames: number }> = ({ v, frames }) => {
  const f = useCurrentFrame();
  const a = useIn(8);
  const late = useIn(Math.round(frames * 0.35));
  if (!v || v.type === 'none') return null;
  const enter: React.CSSProperties = { opacity: a, transform: `translateY(${(1 - a) * 60}px) scale(${0.9 + a * 0.1})` };

  switch (v.type) {
    case 'equation': {
      const strike = v.strike ? interpolate(f, [frames * 0.45, frames * 0.6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
      return (
        <Card style={{ ...enter, direction: 'ltr', display: 'flex', alignItems: 'center', gap: 26, fontSize: 76, fontWeight: 700 }}>
          {v.parts.map((p, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ color: theme.muted }}>−</span>}
              <span>{p}</span>
            </React.Fragment>
          ))}
          <span style={{ color: theme.muted }}>=</span>
          <span style={{ position: 'relative', color: theme.accent }}>
            {v.result}
            <span style={{ position: 'absolute', left: -8, right: -8, top: '52%', height: 10, background: theme.bad, borderRadius: 6, transformOrigin: 'left', transform: `scaleX(${strike})` }} />
          </span>
        </Card>
      );
    }
    case 'checklist': {
      const per = (frames * 0.75) / v.items.length;
      return (
        <div style={{ width: 860, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {v.items.map((it, i) => {
            const s = spring({ frame: f - 6 - i * per, fps: 30, config: { damping: 14 } });
            const on = s > 0.5;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '20px 30px', borderRadius: 22, border: `2px ${on ? 'solid' : 'dashed'} ${on ? theme.accent : theme.border}`, background: on ? theme.surface : 'transparent', opacity: 0.35 + s * 0.65, transform: `translateX(${(1 - s) * -40}px)` }}>
                <div style={{ width: 46, height: 46, borderRadius: 23, background: on ? theme.accent : theme.border, color: theme.bg, display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 700 }}>{on ? '✓' : ''}</div>
                <div style={{ fontSize: 50, fontWeight: 700 }}>{it.name}</div>
                {it.note && <div style={{ fontSize: 34, color: theme.muted, marginInlineStart: 'auto' }}>{it.note}</div>}
              </div>
            );
          })}
          <div style={{ fontSize: 34, color: theme.accent, direction: 'ltr', textAlign: 'left' }}>
            {Math.min(v.items.length, Math.floor(Math.max(0, f - 6) / per) + 1)}/{v.items.length}
          </div>
        </div>
      );
    }
    case 'funnel': {
      const per = (frames * 0.7) / v.steps.length;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {v.steps.map((s, i) => {
            const k = spring({ frame: f - 6 - i * per, fps: 30, config: { damping: 14 } });
            const w = 880 - i * 190;
            return (
              <div key={i} style={{ width: w * k, minWidth: 10, height: 130, borderRadius: 24, background: i === v.steps.length - 1 ? theme.accent : theme.surface, border: `2px solid ${theme.border}`, color: i === v.steps.length - 1 ? theme.bg : theme.text, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, overflow: 'hidden', opacity: k }}>
                <span style={{ fontSize: 66, fontWeight: 700 }}>{s.value}</span>
                <span style={{ fontSize: 40, fontWeight: 500, whiteSpace: 'nowrap' }}>{s.label}</span>
              </div>
            );
          })}
        </div>
      );
    }
    case 'countUp': {
      const p = interpolate(f, [10, frames * 0.55], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (t) => 1 - Math.pow(1 - t, 3) });
      const val = v.from + (v.to - v.from) * p;
      return (
        <div style={{ ...enter, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 440, height: 440, borderRadius: 220, border: `16px solid ${theme.border}`, position: 'relative', display: 'grid', placeItems: 'center' }}>
            <svg width="440" height="440" style={{ position: 'absolute', inset: -16, transform: 'rotate(-90deg)' }} viewBox="0 0 440 440">
              <circle cx="220" cy="220" r="204" fill="none" stroke={theme.accent} strokeWidth="16" strokeDasharray={2 * Math.PI * 204} strokeDashoffset={2 * Math.PI * 204 * (1 - p)} strokeLinecap="round" />
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
              <div style={{ fontSize: 120, fontWeight: 700, direction: 'ltr', color: p > 0.98 ? theme.accent : theme.text }}>{num(val)}</div>
              {v.suffix && <div style={{ fontSize: 52, color: theme.muted }}>{v.suffix}</div>}
            </div>
          </div>
          {v.label && <div style={{ fontSize: 40, color: theme.muted, marginTop: 20 }}>{v.label}</div>}
        </div>
      );
    }
    case 'versus': {
      const r = late;
      const box = (side: { label: string; value: string }, good: boolean, k: number) => (
        <Card style={{ width: 420, textAlign: 'center', opacity: k, transform: `translateY(${(1 - k) * 50}px)`, borderColor: good ? theme.accent : theme.border }}>
          <div style={{ fontSize: 36, color: theme.muted, marginBottom: 8 }}>{side.label}</div>
          <div style={{ fontSize: 96, fontWeight: 700, direction: 'ltr', color: good ? theme.accent : theme.text, textDecoration: good ? 'none' : `line-through ${theme.bad} 8px` }}>{side.value}</div>
        </Card>
      );
      return (
        <div style={{ display: 'flex', gap: 30, alignItems: 'center' }}>
          {box(v.left, false, a)}
          <div style={{ fontSize: 70, color: theme.accent, opacity: r }}>←</div>
          {box(v.right, true, r)}
        </div>
      );
    }
    case 'keyword': {
      const wob = Math.sin(f / 6) * 2;
      return (
        <div style={{ ...enter, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <div style={{ background: theme.accent, color: theme.bg, fontSize: 150, fontWeight: 700, padding: '6px 70px', borderRadius: 30, transform: `rotate(${wob}deg)`, boxShadow: `0 0 0 10px ${theme.surface}, 0 0 0 13px ${theme.border}` }}>{v.word}</div>
          {v.sub && <div style={{ fontSize: 40, color: theme.muted }}>{v.sub}</div>}
        </div>
      );
    }
    case 'card':
      return (
        <Card style={{ ...enter, width: 860 }}>
          {v.tag && <div style={{ display: 'inline-block', background: theme.accent, color: theme.bg, fontSize: 28, fontWeight: 700, padding: '4px 16px', borderRadius: 8, marginBottom: 14, direction: 'ltr' }}>{v.tag}</div>}
          {v.lines.map((l, i) => (
            <div key={i} style={{ fontSize: 46, lineHeight: 1.5 }}>{l}</div>
          ))}
        </Card>
      );
  }
};
