// Reproducible original/current engine-only DSP comparison, not native listening.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderEngineSoundPreview } from './render-engine-sound-preview.mjs';

export async function auditHighSpeedEngine(outputDirectory) {
  const directory = resolve(outputDirectory);
  await mkdir(directory, { recursive: true });
  const sources = {
    before: await readFile(new URL('../tests/fixtures/v8-original-audio.js', import.meta.url), 'utf8'),
    after: await readFile(new URL('../src/audio.js', import.meta.url), 'utf8'),
  };
  const cases = [];
  for (const [name, kmh, maxKmh, load] of [
    ['normal-200', 200, 200, 1], ['boost-370', 370, 370, 1],
    ['released-boost-W-held-370', 370, 200, 1], ['coast-370', 370, 200, 0],
  ]) {
    const comparison = { name, kmh, maxKmh, load };
    for (const version of ['before', 'after']) {
      const speed = kmh / (version === 'before' ? maxKmh : 200);
      comparison[version] = await renderEngineSoundPreview(join(directory, name, version), {
        source: sources[version], duration: 3, controls: () => ({ speed, load }), segments: [['steady', 1, 2.9]],
      });
    }
    cases.push(comparison);
  }
  const audit = { verification: 'Engine-only deterministic CPU reference of real before/after graphs, not native OfflineAudioContext or subjective/device listening. The separate cold-gas thruster graph is unchanged and is not mixed into these WAVs.', cases };
  await writeFile(join(directory, 'comparison.json'), JSON.stringify(audit, null, 2) + '\n');
  return audit;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  console.log(JSON.stringify(await auditHighSpeedEngine(process.argv[2] ?? 'verification/v8-high-speed/audio'), null, 2));
}
