import { FPS } from './theme';
import type { ReelScript, Scene } from './types';

const DEFAULT_PACE = 2.6; // words per second, measured on the reference reel

export const words = (s: string) => s.split(/\s+/).filter(Boolean);

export const sceneFrames = (scene: Scene, pace = DEFAULT_PACE) => {
  const secs = scene.duration ?? Math.max(2.2, words(scene.say).length / pace + 0.5);
  return Math.round(secs * FPS);
};

export const totalFrames = (script: ReelScript) =>
  script.scenes.reduce((a, s) => a + sceneFrames(s, script.pace), 0);

export type Chunk = { words: { text: string; hi: boolean }[]; start: number; end: number };

/** Split the spoken text into 1–3 word caption chunks, timed by character length. */
export const chunkCaptions = (say: string, frames: number): Chunk[] => {
  const ws = words(say).map((w) => ({ text: w.replace(/\*/g, ''), hi: /\*/.test(w) }));
  const groups: { text: string; hi: boolean }[][] = [];
  let cur: { text: string; hi: boolean }[] = [];
  for (const w of ws) {
    cur.push(w);
    const punct = /[.،,؟?!…:]$/.test(w.text);
    if (cur.length === 3 || punct || (w.hi && cur.length >= 2)) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);
  const usable = frames - 6; // small tail so the last chunk is readable
  const weights = groups.map((g) => g.reduce((a, w) => a + w.text.length + 2, 0));
  const sum = weights.reduce((a, b) => a + b, 0);
  let t = 0;
  return groups.map((g, i) => {
    const len = Math.round((weights[i] / sum) * usable);
    const c = { words: g, start: t, end: t + len };
    t += len;
    return c;
  });
};
