/**
 * Three build/identity checks only. No binder, step, jump, physics, driver or
 * browser entry is invoked. Source mutations stay in a temporary mirror.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXPECTED_SOURCE_HASHES } from './generate-numeric-projection-kernel.mjs';
import { verifyBrowserStaticProjectionBuild } from './emit-browser-static-projection.mjs';

const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const sourceArtifact = 'src/demo-numeric-projection.js';
const verificationArtifact = 'verification/demo-continuous/browser-static-projection.generated.js';
const emitter = 'verification/demo-continuous/emit-browser-static-projection.mjs';

function withMirror(action) {
  const mirror = mkdtempSync(join(tmpdir(), 'roadster-src-mirror-identity-only-'));
  try {
    const files = [...Object.keys(EXPECTED_SOURCE_HASHES), sourceArtifact, verificationArtifact, emitter,
      'verification/demo-continuous/generate-numeric-projection-kernel.mjs',
      'verification/demo-continuous/browser-static-projection.generated.mjs',
      'verification/demo-continuous/browser-static-projection-identity.generated.mjs',
      'verification/demo-continuous/numeric-math-identity-profiles.json'];
    for (const name of files) {
      mkdirSync(dirname(join(mirror, name)), { recursive: true });
      copyFileSync(join(repo, name), join(mirror, name));
    }
    return action(mirror);
  } finally { rmSync(mirror, { recursive: true, force: true }); }
}

test('src projection artifact passes complete build identity and equals verification mirror', () => {
  const result = verifyBrowserStaticProjectionBuild(join(repo, sourceArtifact), repo);
  assert.equal(result.valid, true);
  assert.deepEqual(readFileSync(join(repo, sourceArtifact)), readFileSync(join(repo, verificationArtifact)));
});

test('src projection stale-byte mutation rejects without changing verification mirror', () => {
  withMirror(mirror => {
    const path = join(mirror, sourceArtifact);
    const verificationBefore = readFileSync(join(mirror, verificationArtifact));
    writeFileSync(path, Buffer.concat([readFileSync(path), Buffer.from('\n// stale src artifact probe\n')]));
    assert.throws(() => verifyBrowserStaticProjectionBuild(path, mirror),
      /Static projection artifact differs from exact current emission/);
    assert.deepEqual(readFileSync(join(mirror, verificationArtifact)), verificationBefore);
  });
});

test('emitter --check rejects src-versus-verification mirror desynchronization', () => {
  withMirror(mirror => {
    const sourceBefore = readFileSync(join(mirror, sourceArtifact));
    const path = join(mirror, verificationArtifact);
    // src stays valid; only its verification mirror drifts. The full --check
    // must reject, whether exact regeneration catches it before the redundant
    // explicit src/verification SHA equality gate or that equality gate does.
    writeFileSync(path, Buffer.concat([readFileSync(path), Buffer.from('\n// verification mirror drift probe\n')]));
    assert.notDeepEqual(readFileSync(path), sourceBefore);
    const checked = spawnSync(process.execPath, [join(mirror, emitter), '--check'],
      { cwd: mirror, encoding: 'utf8', timeout: 30000 });
    assert.equal(checked.error, undefined, String(checked.error));
    assert.notEqual(checked.status, 0, 'Desynchronized src/verification artifacts must fail --check');
    assert.match(`${checked.stdout}\n${checked.stderr}`,
      /Static projection artifact differs from exact current emission|Production projection artifact differs from verification mirror/);
    assert.deepEqual(readFileSync(join(mirror, sourceArtifact)), sourceBefore);
  });
});
