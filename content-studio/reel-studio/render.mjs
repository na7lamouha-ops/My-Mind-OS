// Usage: node render.mjs <composition-id> [--still <frame>]
// Renders to out/<id>.mp4. Set CHROME_PATH to use an existing Chrome/Chromium binary.
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const id = process.argv[2] ?? 'ep01-marge';
const stillAt = process.argv.indexOf('--still');
const browserExecutable = process.env.CHROME_PATH || null;

const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const composition = await selectComposition({ serveUrl, id, browserExecutable });

if (stillAt > -1) {
  const frame = Number(process.argv[stillAt + 1] ?? 0);
  await renderStill({ serveUrl, composition, frame, output: `out/${id}-f${frame}.png`, browserExecutable });
  console.log(`out/${id}-f${frame}.png`);
} else {
  await renderMedia({
    serveUrl,
    composition,
    codec: 'h264',
    crf: 18,
    outputLocation: `out/${id}.mp4`,
    browserExecutable,
    onProgress: ({ progress }) => process.stdout.write(`\r${Math.round(progress * 100)}%`),
  });
  // loudness: -14 LUFS with a voice-over, -16 for SFX only (RULE-01 §5)
  const target = composition.props?.script?.voiceover ? -14 : -16;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', `out/${id}.mp4`, '-c:v', 'copy', '-af', `loudnorm=I=${target}:TP=-1.5:LRA=11`, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', `out/${id}.tmp.mp4`]);
  fs.renameSync(`out/${id}.tmp.mp4`, `out/${id}.mp4`);
  console.log(`\nout/${id}.mp4 (${composition.durationInFrames / composition.fps}s, ${target} LUFS)`);
}
