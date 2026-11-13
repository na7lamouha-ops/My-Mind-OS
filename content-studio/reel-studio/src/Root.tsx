import React from 'react';
import { Composition } from 'remotion';
import { Reel } from './Reel';
import { FPS, H, W } from './theme';
import { totalFrames } from './timing';
import type { ReelScript } from './types';
import s_bous02_rasmal from '../scripts/bous02-rasmal.json';
import s_bous03_istirjaa from '../scripts/bous03-istirjaa.json';
import s_bous04_kanz from '../scripts/bous04-kanz.json';
import s_eco01_abwab from '../scripts/eco01-abwab.json';
import s_eco02_nazif from '../scripts/eco02-nazif.json';
import s_eco03_taakid from '../scripts/eco03-taakid.json';
import s_eco04_tags from '../scripts/eco04-tags.json';
import s_ep01_marge from '../scripts/ep01-marge.json';
import s_tas01_talabiya from '../scripts/tas01-talabiya.json';
import s_tas02_variantes from '../scripts/tas02-variantes.json';
import s_tas03_commande from '../scripts/tas03-commande.json';
import s_tas04_ai from '../scripts/tas04-ai.json';

// Every JSON in scripts/ becomes a composition. Add new episodes here.
const scripts = [s_bous02_rasmal, s_bous03_istirjaa, s_bous04_kanz, s_eco01_abwab, s_eco02_nazif, s_eco03_taakid, s_eco04_tags, s_ep01_marge, s_tas01_talabiya, s_tas02_variantes, s_tas03_commande, s_tas04_ai] as ReelScript[];

export const Root: React.FC = () => (
  <>
    {scripts.map((s) => (
      <Composition key={s.id} id={s.id} component={Reel} durationInFrames={totalFrames(s)} fps={FPS} width={W} height={H} defaultProps={{ script: s }} />
    ))}
  </>
);
