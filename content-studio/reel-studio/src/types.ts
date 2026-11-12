// Script format: one JSON file = one reel. Written by hand or by Claude (see ../prompts).

export type Visual =
  | { type: 'none' }
  | { type: 'equation'; parts: string[]; result: string; strike?: boolean }
  | { type: 'checklist'; items: { name: string; note?: string }[] }
  | { type: 'funnel'; steps: { value: string; label: string }[] }
  | { type: 'countUp'; from: number; to: number; suffix?: string; label?: string }
  | { type: 'versus'; left: { label: string; value: string }; right: { label: string; value: string } }
  | { type: 'keyword'; word: string; sub?: string }
  | { type: 'card'; tag?: string; lines: string[] };

export type Scene = {
  /** Chapter pill, e.g. "03 · الأدس". Omit for hook / outro. */
  chapter?: string;
  /** Number of filled segments in the progress bar (0..totalChapters). */
  progress?: number;
  /** Line 1: bold sans, white. */
  title1?: string;
  /** Line 2: calligraphic, accent colour. */
  title2?: string;
  visual?: Visual;
  /** Spoken words. Wrap a word in *stars* to highlight it. */
  say: string;
  /** Seconds. If omitted: computed from word count (speech pace below). */
  duration?: number;
  /** Pattern interrupt: full-screen inverted scene with the `say` text as a big quote. */
  interrupt?: boolean;
  mascot?: 'talk' | 'think' | 'wink';
};

export type ReelScript = {
  id: string;
  handle: string;
  totalChapters: number;
  /** Words per second used for auto timing (Rakan's reel ≈ 2.6). */
  pace?: number;
  /** Optional files inside public/: recorded voice + music bed. */
  voiceover?: string;
  music?: string;
  scenes: Scene[];
};
