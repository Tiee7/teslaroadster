import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const htmlFiles = ['src/index.html', 'index.html'].map(path => ({
  path,
  html: readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'),
}));
function analyticsTags(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(([, attrs, body]) => attrs.includes('/_vercel/insights/script.js') || body.includes('window.va ='));
}

test('source and standalone bundle each include one deferred first-party analytics script', () => {
  for (const { path, html } of htmlFiles) {
    const tags = analyticsTags(html);
    assert.equal(tags.length, 2, path);
    assert.ok(tags[0][2].includes('window.va ='), `${path}: queue precedes loader`);
    assert.match(tags[1][1], /\bdefer\b/);
    assert.match(tags[1][1], /\bsrc="\/_vercel\/insights\/script\.js"/);
    assert.ok(tags[1].index < html.indexOf('</head>'), `${path}: analytics runs independently of game initialization`);
    assert.ok(tags[1].index < html.indexOf('<!-- Modular Functional Scripts -->'));
  }
  assert.deepEqual(analyticsTags(htmlFiles[0].html).map(tag => tag[0]), analyticsTags(htmlFiles[1].html).map(tag => tag[0]));
});

test('analytics queue preserves calls in order without emitting game or player data', () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(analyticsTags(htmlFiles[0].html)[0][2], context);
  assert.equal(typeof context.window.va, 'function');
  assert.equal(context.window.vaq, undefined, 'initialization must not queue custom events');
  context.window.va('first', { value: 1 });
  context.window.va('second', 2);
  assert.deepEqual(Array.from(context.window.vaq, args => Array.from(args)), [['first', { value: 1 }], ['second', 2]]);
});

test('analytics initialization preserves an existing loader or queue across repeated evaluation', () => {
  const calls = [];
  const va = (...args) => calls.push(args);
  const vaq = [['existing']];
  const context = vm.createContext({ window: { va, vaq } });
  const source = analyticsTags(htmlFiles[0].html)[0][2];
  vm.runInContext(source, context);
  vm.runInContext(source, context);
  assert.equal(context.window.va, va);
  assert.equal(context.window.vaq, vaq);
  context.window.va('test');
  assert.deepEqual(calls, [['test']]);
});
