import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHandlers, configuration, nickname, validateScore, validateEnd, readBody, playerCookie, playerFromCookie, redisClient, RATE_LUA, START_LUA, END_LUA, SCORE_LUA, LIST_LUA, DURATION_MS, RUN_TTL_MS, COOKIE_NAME, SCORE_VERSION } from '../lib/leaderboard.mjs';
import endApi from '../api/end.js';

const player1 = '00000000-0000-4000-8000-000000000001';
const player2 = '00000000-0000-4000-8000-000000000002';
const run1 = '00000000-0000-4000-8000-000000000003';
const run2 = '00000000-0000-4000-8000-000000000004';
const origin = 'https://roadster.example';
const config = { secret: 'test-only-placeholder-secret-32-bytes', namespace: 'test', origins: [origin] };
class MemoryRedis {
  constructor() { this.calls = []; this.values = new Map(); this.boards = new Map(); this.names = new Map(); this.fail = false; }
  async command(...args) {
    this.calls.push(args);
    if (this.fail) throw Error('private-credential-must-not-leak');
    const [cmd, lua, keyCount, ...rest] = args;
    if (cmd === 'GET') return this.values.get(lua) ?? null;
    const keys = rest.slice(0, keyCount), argv = rest.slice(keyCount);
    if (lua === RATE_LUA) return this.limited ? 0 : 1;
    if (lua === START_LUA) {
      const existing = this.values.get(keys[0]);
      const run = existing && this.values.has(argv[0] + existing) ? JSON.parse(this.values.get(argv[0] + existing)) : null;
      if (run && !run.receipt && !run.canceled) return 'active';
      this.values.set(keys[1], argv[1]); this.values.set(keys[0], argv[3]); return argv[1];
    }
    if (lua === END_LUA) {
      const raw = this.values.get(keys[0]); if (!raw) return 'ok';
      const run = JSON.parse(raw);
      if (run.player !== argv[0]) return 'owner';
      if (!run.receipt && !run.canceled) { run.canceled = true; this.values.set(keys[0], JSON.stringify(run)); }
      if (this.values.get(keys[1]) === argv[1]) this.values.delete(keys[1]);
      return 'ok';
    }
    if (lua === SCORE_LUA) {
      const raw = this.values.get(keys[0]); if (!raw) return ['missing'];
      const run = JSON.parse(raw);
      if (run.player !== argv[0]) return ['owner'];
      if (run.receipt) return run.fingerprint === argv[1] ? ['ok', run.receipt] : ['replay'];
      if (run.canceled) return ['canceled'];
      if (argv[2] < run.startedAt + argv[3]) return ['early'];
      if (argv[2] > run.expiresAt) return ['expired'];
      const board = this.boards.get(keys[1]) || new Map(), names = this.names.get(keys[2]) || new Map();
      let best = board.get(argv[0]) ?? -1;
      const improved = argv[4] > best;
      if (improved) { best = argv[4]; board.set(argv[0], best); names.set(argv[0], argv[5]); }
      this.boards.set(keys[1], board); this.names.set(keys[2], names);
      const rank = this.sorted(board).findIndex(([id]) => id === argv[0]) + 1;
      const receipt = JSON.stringify({ accepted: true, improved, bestScore: best, rank });
      run.receipt = receipt; run.fingerprint = argv[1]; this.values.set(keys[0], JSON.stringify(run));
      return ['ok', receipt];
    }
    if (lua === LIST_LUA) {
      return this.sorted(this.boards.get(keys[0]) || new Map()).slice(0, 100).map(([id, score]) => [this.names.get(keys[1]).get(id), String(score)]);
    }
    throw Error('Unrecognized command');
  }
  sorted(board) { return [...board].sort(([a, sa], [b, sb]) => sb - sa || b.localeCompare(a)); }
}
function fixture() {
  const redis = new MemoryRedis(); let timestamp = 1_000_000, counter = 0;
  const ids = [player1, run1];
  const handlers = createHandlers({ getConfig: () => config, getRedis: () => redis, now: () => timestamp, uuid: () => ids[counter++] || `00000000-0000-4000-8000-${String(counter + 1).padStart(12, '0')}` });
  return { redis, handlers, time: value => { timestamp = value; } };
}
async function invoke(handler, { method = 'POST', body, cookie = '', headers = {}, url = '/' } = {}) {
  const req = { method, body, url, headers: { origin, 'content-type': 'application/json', cookie, ...headers }, socket: { remoteAddress: '127.0.0.1' } };
  const res = { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(raw) { this.data = JSON.parse(raw); } };
  await handler(req, res); return res;
}
const valid = (runId = run1, score = 1000, name = '飞天干脆面') => ({ runId, score, nickname: name, elapsedMs: DURATION_MS, scoreVersion: SCORE_VERSION, distanceBySpeed: [0, 0, 0, 0, 0, score * 10 / 1.8] });
const cookieFor = id => playerCookie(id, config).split(';')[0];

test('nickname canonicalization accepts multilingual names; rejects XSS, controls and pathological input', () => {
  for (const name of ['Alice 7', '飞天干脆面', 'Tiëe', 'e\u0301', 'ＡＢＣ', '123_-']) assert.ok(nickname(name));
  assert.equal(nickname('  ＡＢＣ  '), 'ABC');
  for (const name of [null, 123, {}, [], '', ' ', '-bad', '<img src=x>', 'A&B', "x' OR 1=1", 'x\n', 'a\u202Eb', 'a\u200Bb', '\ud800', '👩‍🚀', 'a'.repeat(21), 'A\uE000']) assert.throws(() => nickname(name));
});
test('score schema rejects unknown fields, bad types, invalid numeric values and forged categories', () => {
  assert.equal(validateScore(valid()).score, 1000);
  for (const body of [null, [], {}, { ...valid(), category: 'city-fantasy', scoreVersion: SCORE_VERSION }, { ...valid(), playerId: player2 }, { ...valid(), score: '50' }, { ...valid(), score: null }, { ...valid(), score: Infinity }, { ...valid(), score: NaN }, { ...valid(), score: -1 }, { ...valid(), score: 250001 }, { ...valid(), score: 1.5 }, { ...valid(), elapsedMs: 59999 }, { ...valid(), elapsedMs: '60000' }, { ...valid(), runId: "x');DEL *" }]) assert.throws(() => validateScore(body));
  assert.throws(() => validateScore(JSON.parse('{"runId":"'+run1+'","nickname":"a","score":1,"elapsedMs":60000,"__proto__":{}}')));
});
test('end schema accepts only an exact UUID-v4 run ID object', () => {
  assert.deepEqual(validateEnd({ runId: run1 }), { runId: run1 });
  for (const body of [null, [], {}, run1, { runId: null }, { runId: 3 }, { runId: 'unknown' }, { runId: run1.replace('-4000-', '-1000-') }, { runId: run1, player: player1 }, { runId: run1, score: 1 }, { runId: run1, category: 'city-fantasy', scoreVersion: SCORE_VERSION }]) assert.throws(() => validateEnd(body));
});
test('end API entry point is POST-only with uncached safe errors', async () => {
  const res = await invoke(endApi, { method: 'GET' });
  assert.equal(res.statusCode, 405); assert.equal(res.headers.allow, 'POST');
  assert.equal(res.headers['cache-control'], 'no-store'); assert.equal(res.data.error.code, 'method_not_allowed');
});
test('bounded body parsing covers parsed Vercel body, raw buffers, streams, malformed JSON and headers', async () => {
  assert.deepEqual(await readBody({ headers: { 'content-type': 'application/json; charset=utf-8' }, body: Buffer.from('{"a":1}') }), { a: 1 });
  const stream = Readable.from(['{"a":', '1}']); stream.headers = { 'content-type': 'application/json' };
  assert.deepEqual(await readBody(stream), { a: 1 });
  for (const req of [
    { headers: { 'content-type': 'text/plain' }, body: '{}' },
    { headers: { 'content-type': 'application/json' }, body: '{' },
    { headers: { 'content-type': 'application/json' }, body: { a: 'x'.repeat(2048) } },
    { headers: { 'content-type': 'application/json', 'content-length': '2049' }, body: '{}' },
    { headers: { 'content-type': 'application/json', 'content-length': '-1' }, body: '{}' }
  ]) await assert.rejects(() => readBody(req));
  const large = Readable.from(['x'.repeat(2049)]); large.headers = { 'content-type': 'application/json' };
  await assert.rejects(() => readBody(large), e => e.status === 413);
});
test('signed host-only identity resists changed IDs, signatures and duplicate cookie ambiguity', () => {
  const value = playerCookie(player1, config); assert.match(value, /Secure; HttpOnly; SameSite=Strict/);
  assert.doesNotMatch(value, /Domain=/);
  assert.equal(playerFromCookie({ headers: { cookie: value } }, config), player1);
  for (const cookie of ['', `${COOKIE_NAME}=${player1}`, value.replace(player1, player2), value.replace(/\.[^;]+/, '.'+'x'.repeat(43)), `${value}; ${value}`]) assert.equal(playerFromCookie({ headers: { cookie } }, config), null);
});
test('configuration fails closed and REST client uses server-only Bearer auth, JSON arrays and no redirects', async () => {
  const env = { LEADERBOARD_SECRET: config.secret, LEADERBOARD_ORIGIN: origin };
  assert.equal(configuration(env).origins[0], origin);
  for (const bad of [{ ...env, LEADERBOARD_SECRET: 'short' }, { ...env, LEADERBOARD_ORIGIN: origin+'/' }, { ...env, LEADERBOARD_NAMESPACE: 'bad*' }, { ...env, LEADERBOARD_ORIGIN: '' }]) assert.throws(() => configuration(bad), e => e.status === 503);
  let request;
  const client = redisClient({ KV_REST_API_URL: 'https://test.upstash.io', KV_REST_API_TOKEN: 'test-placeholder' }, async (url, options) => { request = { url, ...options }; return { ok: true, json: async () => ({ result: 'OK' }) }; });
  assert.equal(await client.command('SET', 'k', 'v'), 'OK');
  assert.equal(request.headers.Authorization, 'Bearer test-placeholder'); assert.equal(request.redirect, 'error'); assert.deepEqual(JSON.parse(request.body), ['SET', 'k', 'v']);
  for (const url of ['http://test.upstash.io', 'https://attacker.example', 'https://test.upstash.io/path', 'https://test.upstash.io?token=bad', 'https://a:b@test.upstash.io']) assert.throws(() => redisClient({ UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: 'x' }));
  const fail = redisClient({ UPSTASH_REDIS_REST_URL: 'https://test.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'x' }, async () => ({ ok: true, json: async () => ({ error: 'credential-private' }) }));
  await assert.rejects(() => fail.command('GET', 'x'), e => !e.message.includes('credential') && e.status === 503);
});
test('no database commands happen for malformed/untrusted inputs and unsupported methods', async () => {
  const f = fixture();
  for (const options of [{ method: 'GET' }, { body: { category: 'x' } }, { body: { category: 'highway-realistic', scoreVersion: SCORE_VERSION, unknown: true } }, { body: { category: 'highway-realistic', scoreVersion: SCORE_VERSION }, headers: { origin: 'https://evil.example' } }, { body: { category: 'highway-realistic', scoreVersion: SCORE_VERSION }, headers: { origin: '' } }, { body: { category: 'highway-realistic', scoreVersion: SCORE_VERSION }, headers: { 'sec-fetch-site': 'cross-site' } }]) {
    const res = await invoke(f.handlers.run, options); assert.ok(res.statusCode >= 400);
  }
  assert.equal(f.redis.calls.length, 0);
  for (const body of [{ ...valid(), nickname: '<script>' }, { ...valid(), score: 500000 }]) assert.equal((await invoke(f.handlers.score, { body })).statusCode, 400);
  assert.equal(f.redis.calls.length, 0);
});
test('full lifecycle: server run, early rejection, score acceptance, best only, same-payload idempotence and changed replay rejection', async () => {
  const f = fixture();
  const run = await invoke(f.handlers.run, { body: { category: 'highway-realistic', scoreVersion: SCORE_VERSION } });
  assert.equal(run.statusCode, 200); assert.equal(run.data.runId, run1); assert.equal(run.data.durationMs, 60000);
  assert.ok(!JSON.stringify(run.data).includes(player1));
  const cookie = run.headers['set-cookie'].split(';')[0];
  const options = { cookie, body: valid() };
  assert.equal((await invoke(f.handlers.score, options)).statusCode, 422);
  f.time(1_060_000);
  const accepted = await invoke(f.handlers.score, options);
  assert.deepEqual(accepted.data, { accepted: true, improved: true, bestScore: 1000, rank: 1 });
  const retry = await invoke(f.handlers.score, options); assert.deepEqual(retry.data, accepted.data);
  assert.equal((await invoke(f.handlers.score, { ...options, body: valid(run1, 1100) })).statusCode, 409);
  const list = await invoke(f.handlers.leaderboard, { method: 'GET', url: '/api/leaderboard?category=highway-realistic&scoreVersion=distance-v2' });
  assert.deepEqual(list.data.entries, [{ rank: 1, nickname: '飞天干脆面', score: 1000 }]);
  assert.equal(list.data.limit, 100); assert.match(list.headers['cache-control'], /s-maxage=10/); assert.equal(list.headers['set-cookie'], undefined); assert.ok(!JSON.stringify(list.data).includes(player1));
  const another = '00000000-0000-4000-8000-000000000005';
  f.redis.values.set(`test:run:${another}`, JSON.stringify({ player: player1, category: 'highway-realistic', scoreVersion: SCORE_VERSION, startedAt: 1_000_000, expiresAt: 1_600_000 }));
  const lower = await invoke(f.handlers.score, { cookie, body: valid(another, 500, 'Renamed') });
  assert.deepEqual(lower.data, { accepted: true, improved: false, bestScore: 1000, rank: 1 });
  assert.equal((await invoke(f.handlers.leaderboard, { method: 'GET', url: '/api/leaderboard?category=highway-realistic&scoreVersion=distance-v2' })).data.entries[0].nickname, '飞天干脆面');
});
test('ownership, expiry, category isolation and rate-limit failures are fail-closed', async () => {
  const f = fixture(); await invoke(f.handlers.run, { body: { category: 'city-fantasy', scoreVersion: SCORE_VERSION } });
  assert.equal((await invoke(f.handlers.score, { body: valid() })).statusCode, 401);
  assert.equal((await invoke(f.handlers.score, { cookie: cookieFor(player2), body: valid() })).statusCode, 403);
  f.time(1_000_000 + RUN_TTL_MS + 1);
  assert.equal((await invoke(f.handlers.score, { cookie: cookieFor(player1), body: valid() })).statusCode, 410);
  f.redis.limited = true;
  const limited = await invoke(f.handlers.score, { cookie: cookieFor(player1), body: valid() });
  assert.equal(limited.statusCode, 429); assert.ok(Number(limited.headers['retry-after']) > 0); assert.equal(f.redis.boards.size, 0);
  f.redis.limited = false; f.redis.fail = true;
  const failed = await invoke(f.handlers.run, { cookie: cookieFor(player1), body: { category: 'city-fantasy', scoreVersion: SCORE_VERSION } });
  assert.equal(failed.statusCode, 503); assert.equal(failed.headers['cache-control'], 'no-store'); assert.doesNotMatch(JSON.stringify(failed.data), /private|credential/);
});
test('Top 100 is ordered, anonymized, bounded and empty categories use an array', async () => {
  const f = fixture(), board = new Map(), names = new Map();
  for (let i = 0; i < 130; i++) { board.set(`id${i}`, i); names.set(`id${i}`, `Player ${i}`); }
  f.redis.boards.set('test:board:distance-v2:highway-realistic', board); f.redis.names.set('test:names:distance-v2:highway-realistic', names);
  const list = await invoke(f.handlers.leaderboard, { method: 'GET', url: '/api/leaderboard?category=highway-realistic&scoreVersion=distance-v2' });
  assert.equal(list.data.entries.length, 100); assert.equal(list.data.entries[0].score, 129); assert.equal(list.data.entries.at(-1).rank, 100);
  const empty = await invoke(f.handlers.leaderboard, { method: 'GET', url: '/api/leaderboard?category=city-realistic&scoreVersion=distance-v2' }); assert.deepEqual(empty.data.entries, []);
  for (const url of ['/api/leaderboard', '/api/leaderboard?category=highway-realistic&category=city-realistic', '/api/leaderboard?category=highway-realistic&callback=alert', '/api/leaderboard?category=__proto__']) assert.equal((await invoke(f.handlers.leaderboard, { method: 'GET', url })).statusCode, 400);
});

test('active runs cannot be reused, while submitted runs allow immediate play-again', async () => {
  const f = fixture();
  await invoke(f.handlers.run, { body: { category: 'highway-realistic', scoreVersion: SCORE_VERSION } });
  const second = await invoke(f.handlers.run, { cookie: cookieFor(player1), body: { category: 'highway-realistic', scoreVersion: SCORE_VERSION } });
  assert.equal(second.statusCode, 409); assert.equal(second.data.error.code, 'run_active');
  f.time(1_060_000);
  assert.equal((await invoke(f.handlers.score, { cookie: cookieFor(player1), body: valid() })).statusCode, 200);
  const third = await invoke(f.handlers.run, { cookie: cookieFor(player1), body: { category: 'highway-realistic', scoreVersion: SCORE_VERSION } });
  assert.equal(third.statusCode, 200); assert.notEqual(third.data.runId, run1);
});

test('end rejects invalid origin, method, body and missing/tampered identity before any database operation', async () => {
  const f = fixture(), cookie = cookieFor(player1), body = { runId: run1 };
  for (const options of [
    { method: 'GET' }, { method: 'DELETE' }, { body: null }, { body: [] }, { body: {} },
    { body: { runId: 'bad' } }, { body: { ...body, nickname: 'Name' } },
    { body, headers: { origin: '' } }, { body, headers: { origin: 'https://evil.example' } },
    { body, headers: { 'sec-fetch-site': 'cross-site' } }, { body, headers: { 'sec-fetch-site': 'none' } },
    { body, headers: { 'content-type': 'text/plain' } },
    { body, headers: { 'content-length': '2049' } }, { body: '{' }
  ]) assert.ok((await invoke(f.handlers.end, { cookie, ...options })).statusCode >= 400);
  for (const invalidCookie of ['', cookie.replace(player1, player2), `${COOKIE_NAME}=${player1}`, `${cookie}; ${cookie}`]) {
    const res = await invoke(f.handlers.end, { cookie: invalidCookie, body });
    assert.equal(res.statusCode, 401); assert.equal(res.data.error.code, 'identity_required');
  }
  assert.equal(f.redis.calls.length, 0);
});

test('start -> end -> immediate new start is idempotent and canceled scores cannot publish', async () => {
  const f = fixture(), cookie = cookieFor(player1);
  await invoke(f.handlers.run, { body: { category: 'highway-realistic', scoreVersion: SCORE_VERSION } });
  const end = await invoke(f.handlers.end, { cookie, body: { runId: run1 } });
  assert.equal(end.statusCode, 200); assert.deepEqual(end.data, { ended: true, runId: run1 });
  assert.equal(end.headers['cache-control'], 'no-store'); assert.equal(end.headers['set-cookie'], undefined);
  const canceled = JSON.parse(f.redis.values.get(`test:run:${run1}`));
  assert.equal(canceled.canceled, true); assert.equal(canceled.expiresAt, 1_000_000 + RUN_TTL_MS);
  assert.equal(f.redis.values.has(`test:active:${player1}`), false);
  assert.deepEqual((await invoke(f.handlers.end, { cookie, body: { runId: run1 } })).data, end.data);
  const next = await invoke(f.handlers.run, { cookie, body: { category: 'city-fantasy', scoreVersion: SCORE_VERSION } });
  assert.equal(next.statusCode, 200); assert.equal(next.data.runId, run2);
  f.time(1_060_000);
  const rejected = await invoke(f.handlers.score, { cookie, body: valid() });
  assert.equal(rejected.statusCode, 409); assert.equal(rejected.data.error.code, 'run_canceled');
  assert.equal(f.redis.boards.size, 0);
  await invoke(f.handlers.end, { cookie, body: { runId: run1 } });
  assert.equal(f.redis.values.get(`test:active:${player1}`), run2);
  assert.equal(JSON.parse(f.redis.values.get(`test:run:${run2}`)).canceled, undefined);
  assert.equal((await invoke(f.handlers.run, { cookie, body: { category: 'city-fantasy', scoreVersion: SCORE_VERSION } })).statusCode, 409);
});

test('end ownership is enforced atomically and unknown/expired old IDs cannot release a newer active lock', async () => {
  const f = fixture(), cookie = cookieFor(player1);
  await invoke(f.handlers.run, { body: { category: 'highway-realistic', scoreVersion: SCORE_VERSION } });
  const original = f.redis.values.get(`test:run:${run1}`);
  f.redis.values.set(`test:active:${player2}`, run1);
  const denied = await invoke(f.handlers.end, { cookie: cookieFor(player2), body: { runId: run1 } });
  assert.equal(denied.statusCode, 403); assert.equal(denied.data.error.code, 'run_owner');
  assert.equal(f.redis.values.get(`test:run:${run1}`), original);
  assert.equal(f.redis.values.get(`test:active:${player1}`), run1);
  assert.equal(f.redis.values.get(`test:active:${player2}`), run1);
  // The active window can expire and a new run may begin while an old result still exists.
  f.redis.values.delete(`test:active:${player1}`);
  const next = await invoke(f.handlers.run, { cookie, body: { category: 'highway-realistic', scoreVersion: SCORE_VERSION } });
  assert.equal(next.data.runId, run2);
  assert.equal((await invoke(f.handlers.end, { cookie, body: { runId: run1 } })).statusCode, 200);
  assert.equal(f.redis.values.get(`test:active:${player1}`), run2);
  assert.equal(JSON.parse(f.redis.values.get(`test:run:${run2}`)).canceled, undefined);
  f.redis.values.delete(`test:run:${run1}`);
  for (let i = 0; i < 2; i++) {
    assert.deepEqual((await invoke(f.handlers.end, { cookie, body: { runId: run1 } })).data, { ended: true, runId: run1 });
    assert.equal(f.redis.values.get(`test:active:${player1}`), run2);
  }
});

test('end after accepted score preserves its exact receipt, best score, nickname and replay semantics', async () => {
  const f = fixture(), cookie = cookieFor(player1);
  await invoke(f.handlers.run, { body: { category: 'highway-realistic', scoreVersion: SCORE_VERSION } });
  f.time(1_060_000);
  const accepted = await invoke(f.handlers.score, { cookie, body: valid() });
  const saved = f.redis.values.get(`test:run:${run1}`);
  await invoke(f.handlers.end, { cookie, body: { runId: run1 } });
  assert.equal(f.redis.values.get(`test:run:${run1}`), saved);
  assert.deepEqual((await invoke(f.handlers.score, { cookie, body: valid() })).data, accepted.data);
  assert.equal((await invoke(f.handlers.score, { cookie, body: valid(run1, 1200) })).statusCode, 409);
  assert.deepEqual((await invoke(f.handlers.leaderboard, { method: 'GET', url: '/api/leaderboard?category=highway-realistic&scoreVersion=distance-v2' })).data.entries, [{ rank: 1, nickname: '飞天干脆面', score: 1000 }]);
  assert.equal((await invoke(f.handlers.run, { cookie, body: { category: 'highway-realistic', scoreVersion: SCORE_VERSION } })).statusCode, 200);
  await invoke(f.handlers.end, { cookie, body: { runId: run1 } });
  assert.equal(f.redis.values.get(`test:active:${player1}`), run2);
});

test('cancellation between score lookup and atomic submission cannot publish a stale score', async () => {
  const f = fixture(), cookie = cookieFor(player1);
  await invoke(f.handlers.run, { body: { category: 'highway-realistic', scoreVersion: SCORE_VERSION } });
  f.time(1_060_000);
  let release, lookedUp;
  const pause = new Promise(resolve => { release = resolve; });
  const observed = new Promise(resolve => { lookedUp = resolve; });
  const command = f.redis.command.bind(f.redis);
  f.redis.command = async (...args) => {
    const result = await command(...args);
    if (args[0] === 'GET' && args[1] === `test:run:${run1}`) { lookedUp(); await pause; }
    return result;
  };
  const pendingScore = invoke(f.handlers.score, { cookie, body: valid() });
  await observed;
  assert.equal((await invoke(f.handlers.end, { cookie, body: { runId: run1 } })).statusCode, 200);
  release();
  const score = await pendingScore;
  assert.equal(score.statusCode, 409); assert.equal(score.data.error.code, 'run_canceled');
  assert.equal(f.redis.boards.size, 0);
});

test('end uses an independent bounded rate allowance and infrastructure failures remain safe', async () => {
  const f = fixture(), cookie = cookieFor(player1), body = { runId: run1 };
  await invoke(f.handlers.end, { cookie, body });
  const [rate, end] = f.redis.calls;
  assert.equal(rate[1], RATE_LUA); assert.equal(rate[2], 2);
  assert.match(rate[3], /^test:rate:end:ip:/); assert.match(rate[4], /^test:rate:end:player:/);
  assert.deepEqual(rate.slice(-3), [120, 30, 61]); assert.equal(end[1], END_LUA);
  f.redis.limited = true;
  const limited = await invoke(f.handlers.end, { cookie, body });
  assert.equal(limited.statusCode, 429); assert.equal(limited.headers['retry-after'], '60');
  assert.equal(f.redis.calls.filter(args => args[1] === END_LUA).length, 1);
  f.redis.limited = false; f.redis.fail = true;
  const failed = await invoke(f.handlers.end, { cookie, body });
  assert.equal(failed.statusCode, 503); assert.equal(failed.headers['cache-control'], 'no-store');
  assert.doesNotMatch(JSON.stringify(failed.data), /private|credential/);
});

test('invalid stored nicknames fail as infrastructure errors rather than blaming the reader', async () => {
  const f = fixture();
  f.redis.boards.set('test:board:distance-v2:highway-realistic', new Map([['id', 10]]));
  f.redis.names.set('test:names:distance-v2:highway-realistic', new Map([['id', '<script>']]));
  const response = await invoke(f.handlers.leaderboard, { method: 'GET', url: '/api/leaderboard?category=highway-realistic&scoreVersion=distance-v2' });
  assert.equal(response.statusCode, 503); assert.equal(response.headers['cache-control'], 'no-store');
});

test('distance v2 rejects legacy clients, mismatched totals and malformed telemetry before any writes', async () => {
  const f = fixture();
  const legacy = { runId: run1, nickname: 'Driver', score: 10, elapsedMs: DURATION_MS };
  assert.equal((await invoke(f.handlers.run, { body: { category: 'highway-realistic' } })).statusCode, 400);
  assert.equal((await invoke(f.handlers.score, { body: legacy, cookie: cookieFor(player1) })).statusCode, 400);
  for (const distanceBySpeed of [null, {}, [], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0, -1], [0, 0, 0, 0, 0, Infinity], [0, 0, 0, 0, 0, '10'], new Array(6)]) {
    assert.equal((await invoke(f.handlers.score, { body: { ...valid(run1, 0), distanceBySpeed }, cookie: cookieFor(player1) })).statusCode, 400);
  }
  for (const body of [{ ...valid(), scoreVersion: 'v1' }, { ...valid(), score: 1 }, { ...valid(), distanceBySpeed: [0, 0, 0, 0, 0, 0], bonus: 1.8 }]) assert.equal((await invoke(f.handlers.score, { body, cookie: cookieFor(player1) })).statusCode, 400);
  assert.equal(f.redis.calls.length, 0);
});

test('distance v2 uses category-specific speed/time plausibility and recomputes mixed-band ceil once', async () => {
  for (const category of ['highway-realistic', 'city-fantasy']) {
    const f = fixture(); await invoke(f.handlers.run, { body: { category, scoreVersion: SCORE_VERSION } }); f.time(1_060_000);
    const metres = category.endsWith('realistic') ? 7200.5 : 18000.5;
    const distanceBySpeed = [0, 0, 0, 0, 0, metres];
    const body = { ...valid(), score: RoadsterDrivingScore.points(distanceBySpeed), distanceBySpeed };
    assert.equal((await invoke(f.handlers.score, { body, cookie: cookieFor(player1) })).statusCode, 400);
    assert.equal(f.redis.boards.size, 0);
    const mixed = [100, 100, 100, 100, 100, 100];
    const accepted = await invoke(f.handlers.score, { body: { ...valid(), score: 83, distanceBySpeed: mixed }, cookie: cookieFor(player1) });
    assert.equal(accepted.statusCode, 200); assert.equal(accepted.data.bestScore, 83);
  }
});

test('distance v2 isolates new boards without deleting legacy records and rejects legacy issued runs', async () => {
  const f = fixture();
  const oldBoard = new Map([[player1, 200000]]), oldNames = new Map([[player1, 'Earlier Driver']]);
  f.redis.boards.set('test:board:highway-realistic', oldBoard); f.redis.names.set('test:names:highway-realistic', oldNames);
  f.redis.values.set(`test:run:${run1}`, JSON.stringify({ player: player1, category: 'highway-realistic', startedAt: 1_000_000, expiresAt: 1_600_000 })); f.time(1_060_000);
  const stale = await invoke(f.handlers.score, { body: valid(), cookie: cookieFor(player1) });
  assert.equal(stale.statusCode, 409); assert.equal(stale.data.error.code, 'scoring_changed');
  const empty = await invoke(f.handlers.leaderboard, { method: 'GET', url: '/api/leaderboard?category=highway-realistic&scoreVersion=distance-v2' });
  assert.equal(empty.statusCode, 200); assert.deepEqual(empty.data.entries, []); assert.equal(empty.data.scoreVersion, SCORE_VERSION);
  assert.equal(f.redis.boards.get('test:board:highway-realistic'), oldBoard); assert.equal(oldBoard.get(player1), 200000); assert.equal(oldNames.get(player1), 'Earlier Driver');
  assert.equal((await invoke(f.handlers.leaderboard, { method: 'GET', url: '/api/leaderboard?category=highway-realistic' })).statusCode, 400);
});
