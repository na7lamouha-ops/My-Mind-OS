import React from 'react';
import { Composition } from 'remotion';
import { Reel } from './Reel';
import { FPS, H, W } from './theme';
import { totalFrames } from './timing';
import type { ReelScript } from './types';
import ep01 from '../scripts/ep01-marge.json';

// Every JSON in scripts/ becomes a composition. Add new episodes here.
const scripts = [ep01] as ReelScript[];

export const Root: React.FC = () => (
  <>
    {scripts.map((s) => (
      <Composition key={s.id} id={s.id} component={Reel} durationInFrames={totalFrames(s)} fps={FPS} width={W} height={H} defaultProps={{ script: s }} />
    ))}
  </>
);
