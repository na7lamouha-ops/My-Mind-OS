// Usage: node render.mjs <composition-id> [--still <frame>]
// Renders to out/<id>.mp4. Set CHROME_PATH to use an existing Chrome/Chromium binary.
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import path from 'node:path';

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
  console.log(`\nout/${id}.mp4 (${composition.durationInFrames / composition.fps}s)`);
}
