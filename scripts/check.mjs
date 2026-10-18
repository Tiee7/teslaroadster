import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root = readFileSync('index.html', 'utf8');
for (const dir of ['api', 'lib', 'src', 'scripts', 'tests']) {
  for (const file of readdirSync(dir).filter(f => /\.(?:m?js)$/.test(f))) {
    const path = `${dir}/${file}`;
    const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${path}: ${result.stderr}`);
  }
}
for (const match of root.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new Function(match[1]);
for (const path of ['src/index.html', 'index.html']) {
  const html = readFileSync(path, 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, `${path}: duplicate DOM ids`);
}
const originals = root;
const bundle = spawnSync('python3', ['bundle_app.py'], { encoding: 'utf8' });
assert.equal(bundle.status, 0, bundle.stderr);
assert.equal(readFileSync('index.html', 'utf8'), originals, 'Root bundle is stale: run python3 bundle_app.py and commit index.html');
const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
assert.equal(config.outputDirectory, 'public');
assert.ok(config.functions['api/*.js'].maxDuration >= 15);
console.log('JavaScript syntax, inline bundle, unique DOM IDs, deterministic bundler, and deployment config passed.');
