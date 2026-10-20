import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {renderEngineSoundPreview} from '../scripts/render-engine-sound-preview.mjs';

test('production V8 graph CPU reference renders bounded, finite load response and smooth mute/destruction recovery', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'engine-sound-numeric-test-'));
  try {
    const audit = await renderEngineSoundPreview(directory);
    assert.match(audit.verification, /CPU reference/);
    assert.match(audit.verification, /not native OfflineAudioContext/);
    const wav = await readFile(join(directory, 'v8-ev-acceleration-cpu-preview.wav'));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal(wav.readUInt16LE(22), 1);
    assert.equal(wav.readUInt32LE(24), 44100);
    assert.equal(wav.length, 44 + 12 * 44100 * 2);
    const saved = JSON.parse(await readFile(join(directory, 'audio-audit.json'), 'utf8'));
    assert.equal(saved.sourceSha256, audit.sourceSha256);
    assert.ok(saved.segments.highLoad.rms > saved.segments.coast.rms * 1.5);
    assert.ok(saved.voices.find(v => v.time === 6).rpm > saved.voices.find(v => v.time === 3).rpm);
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});
