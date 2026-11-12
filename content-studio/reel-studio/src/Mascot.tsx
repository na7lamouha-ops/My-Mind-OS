import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from './theme';

// Original mascot for the Boussoula account: a living compass.
// For a personal account, replace this component with your own avatar (PNG) or face cam.
export const Mascot: React.FC<{ mood?: 'talk' | 'think' | 'wink'; size?: number }> = ({
  mood = 'talk',
  size = 190,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: f, fps, config: { damping: 12 } });
  const mouth = mood === 'talk' ? 4 + Math.abs(Math.sin(f / 2.3)) * 9 : 3;
  const needle = Math.sin(f / 14) * 12;
  const blink = f % 75 < 3;
  const lookUp = mood === 'think' ? -6 : 0;

  return (
    <div style={{ width: size, height: size, transform: `scale(${pop})` }}>
      <svg viewBox="0 0 200 200" width={size} height={size}>
        <circle cx="100" cy="100" r="92" fill={theme.accent} />
        <circle cx="100" cy="100" r="80" fill={theme.surface} />
        {[0, 90, 180, 270].map((a) => (
          <rect key={a} x="97" y="24" width="6" height="12" rx="2" fill={theme.accent} transform={`rotate(${a} 100 100)`} />
        ))}
        <g transform={`rotate(${needle} 100 100)`} opacity={0.35}>
          <polygon points="100,30 108,100 92,100" fill={theme.bad} />
          <polygon points="100,170 108,100 92,100" fill={theme.text} />
        </g>
        {/* eyes */}
        <circle cx="76" cy="90" r="16" fill="#fff" />
        {mood === 'wink' ? (
          <path d="M112 92 q12 -12 24 0" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" />
        ) : (
          <circle cx="124" cy="90" r="16" fill="#fff" />
        )}
        {!blink && <circle cx="78" cy={92 + lookUp} r="7" fill={theme.bg} />}
        {!blink && mood !== 'wink' && <circle cx="126" cy={92 + lookUp} r="7" fill={theme.bg} />}
        {blink && <rect x="60" y="88" width="32" height="5" rx="2" fill={theme.bg} />}
        {/* mouth */}
        <ellipse cx="100" cy="132" rx={mood === 'think' ? 7 : 16} ry={mouth} fill={theme.bg} />
        {mood === 'think' && (
          <g fill={theme.accent} opacity={interpolate(f % 30, [0, 15, 30], [0.3, 1, 0.3])}>
            <circle cx="160" cy="40" r="6" />
            <circle cx="176" cy="22" r="4" />
          </g>
        )}
      </svg>
    </div>
  );
};
