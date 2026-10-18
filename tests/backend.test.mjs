import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHandlers, configuration, nickname, validateScore, readBody, playerCookie, playerFromCookie, redisClient, RATE_LUA, START_LUA, SCORE_LUA, LIST_LUA, DURATION_MS, RUN_TTL_MS, COOKIE_NAME } from '../lib/leaderboard.mjs';

const player1 = '00000000-0000-4000-8000-000000000001';
const player2 = '00000000-0000-4000-8000-000000000002';
const run1 = '00000000-0000-4000-8000-000000000003';
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
      if (existing && this.values.has(argv[0] + existing) && !JSON.parse(this.values.get(argv[0] + existing)).receipt) return 'active';
      this.values.set(keys[1], argv[1]); this.values.set(keys[0], argv[3]); return argv[1];
    }
    if (lua === SCORE_LUA) {
      const raw = this.values.get(keys[0]); if (!raw) return ['missing'];
      const run = JSON.parse(raw);
      if (run.player !== argv[0]) return ['owner'];
      if (run.receipt) return run.fingerprint === argv[1] ? ['ok', run.receipt] : ['replay'];
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
  const ids = [player1, run1, player2];
  const handlers = createHandlers({ getConfig: () => config, getRedis: () => redis, now: () => timestamp, uuid: () => ids[counter++] || '00000000-0000-4000-8000-000000000004' });
  return { redis, handlers, time: value => { timestamp = value; } };
}
async function invoke(handler, { method = 'POST', body, cookie = '', headers = {}, url = '/' } = {}) {
  const req = { method, body, url, headers: { origin, 'content-type': 'application/json', cookie, ...headers }, socket: { remoteAddress: '127.0.0.1' } };
  const res = { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(raw) { this.data = JSON.parse(raw); } };
  await handler(req, res); return res;
}
const valid = (runId = run1, score = 1500, name = '飞天干脆面') => ({ runId, score, nickname: name, elapsedMs: DURATION_MS });
const cookieFor = id => playerCookie(id, config).split(';')[0];

test('nickname canonicalization accepts multilingual names; rejects XSS, controls and pathological input', () => {
  for (const name of ['Alice 7', '飞天干脆面', 'Tiëe', 'e\u0301', 'ＡＢＣ', '123_-']) assert.ok(nickname(name));
  assert.equal(nickname('  ＡＢＣ  '), 'ABC');
  for (const name of [null, 123, {}, [], '', ' ', '-bad', '<img src=x>', 'A&B', "x' OR 1=1", 'x\n', 'a\u202Eb', 'a\u200Bb', '\ud800', '👩‍🚀', 'a'.repeat(21), 'A\uE000']) assert.throws(() => nickname(name));
});
test('score schema rejects unknown fields, bad types, invalid numeric values and forged categories', () => {
  assert.equal(validateScore(valid()).score, 1500);
  for (const body of [null, [], {}, { ...valid(), category: 'city-fantasy' }, { ...valid(), playerId: player2 }, { ...valid(), score: '50' }, { ...valid(), score: null }, { ...valid(), score: Infinity }, { ...valid(), score: NaN }, { ...valid(), score: -1 }, { ...valid(), score: 250001 }, { ...valid(), score: 1.5 }, { ...valid(), elapsedMs: 59999 }, { ...valid(), elapsedMs: '60000' }, { ...valid(), runId: "x');DEL *" }]) assert.throws(() => validateScore(body));
  assert.throws(() => validateScore(JSON.parse('{"runId":"'+run1+'","nickname":"a","score":1,"elapsedMs":60000,"__proto__":{}}')));
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
  for (const options of [{ method: 'GET' }, { body: { category: 'x' } }, { body: { category: 'highway-realistic', unknown: true } }, { body: { category: 'highway-realistic' }, headers: { origin: 'https://evil.example' } }, { body: { category: 'highway-realistic' }, headers: { origin: '' } }, { body: { category: 'highway-realistic' }, headers: { 'sec-fetch-site': 'cross-site' } }]) {
    const res = await invoke(f.handlers.run, options); assert.ok(res.statusCode >= 400);
  }
  assert.equal(f.redis.calls.length, 0);
  for (const body of [{ ...valid(), nickname: '<script>' }, { ...valid(), score: 500000 }]) assert.equal((await invoke(f.handlers.score, { body })).statusCode, 400);
  assert.equal(f.redis.calls.length, 0);
});
test('full lifecycle: server run, early rejection, score acceptance, best only, same-payload idempotence and changed replay rejection', async () => {
  const f = fixture();
  const run = await invoke(f.handlers.run, { body: { category: 'highway-realistic' } });
  assert.equal(run.statusCode, 200); assert.equal(run.data.runId, run1); assert.equal(run.data.durationMs, 60000);
  assert.ok(!JSON.stringify(run.data).includes(player1));
  const cookie = run.headers['set-cookie'].split(';')[0];
  const options = { cookie, body: valid() };
  assert.equal((await invoke(f.handlers.score, options)).statusCode, 422);
  f.time(1_060_000);
  const accepted = await invoke(f.handlers.score, options);
  assert.deepEqual(accepted.data, { accepted: true, improved: true, bestScore: 1500, rank: 1 });
  const retry = await invoke(f.handlers.score, options); assert.deepEqual(retry.data, accepted.data);
  assert.equal((await invoke(f.handlers.score, { ...options, body: valid(run1, 1600) })).statusCode, 409);
  const list = await invoke(f.handlers.leaderboard, { method: 'GET', url: '/api/leaderboard?category=highway-realistic' });
  assert.deepEqual(list.data.entries, [{ rank: 1, nickname: '飞天干脆面', score: 1500 }]);
  assert.equal(list.data.limit, 100); assert.match(list.headers['cache-control'], /s-maxage=10/); assert.equal(list.headers['set-cookie'], undefined); assert.ok(!JSON.stringify(list.data).includes(player1));
  const another = '00000000-0000-4000-8000-000000000005';
  f.redis.values.set(`test:run:${another}`, JSON.stringify({ player: player1, category: 'highway-realistic', startedAt: 1_000_000, expiresAt: 1_600_000 }));
  const lower = await invoke(f.handlers.score, { cookie, body: valid(another, 500, 'Renamed') });
  assert.deepEqual(lower.data, { accepted: true, improved: false, bestScore: 1500, rank: 1 });
  assert.equal((await invoke(f.handlers.leaderboard, { method: 'GET', url: '/api/leaderboard?category=highway-realistic' })).data.entries[0].nickname, '飞天干脆面');
});
test('ownership, expiry, category isolation and rate-limit failures are fail-closed', async () => {
  const f = fixture(); await invoke(f.handlers.run, { body: { category: 'city-fantasy' } });
  assert.equal((await invoke(f.handlers.score, { body: valid() })).statusCode, 401);
  assert.equal((await invoke(f.handlers.score, { cookie: cookieFor(player2), body: valid() })).statusCode, 403);
  f.time(1_000_000 + RUN_TTL_MS + 1);
  assert.equal((await invoke(f.handlers.score, { cookie: cookieFor(player1), body: valid() })).statusCode, 410);
  f.redis.limited = true;
  const limited = await invoke(f.handlers.score, { cookie: cookieFor(player1), body: valid() });
  assert.equal(limited.statusCode, 429); assert.ok(Number(limited.headers['retry-after']) > 0); assert.equal(f.redis.boards.size, 0);
  f.redis.limited = false; f.redis.fail = true;
  const failed = await invoke(f.handlers.run, { cookie: cookieFor(player1), body: { category: 'city-fantasy' } });
  assert.equal(failed.statusCode, 503); assert.equal(failed.headers['cache-control'], 'no-store'); assert.doesNotMatch(JSON.stringify(failed.data), /private|credential/);
});
test('Top 100 is ordered, anonymized, bounded and empty categories use an array', async () => {
  const f = fixture(), board = new Map(), names = new Map();
  for (let i = 0; i < 130; i++) { board.set(`id${i}`, i); names.set(`id${i}`, `Player ${i}`); }
  f.redis.boards.set('test:board:highway-realistic', board); f.redis.names.set('test:names:highway-realistic', names);
  const list = await invoke(f.handlers.leaderboard, { method: 'GET', url: '/api/leaderboard?category=highway-realistic' });
  assert.equal(list.data.entries.length, 100); assert.equal(list.data.entries[0].score, 129); assert.equal(list.data.entries.at(-1).rank, 100);
  const empty = await invoke(f.handlers.leaderboard, { method: 'GET', url: '/api/leaderboard?category=city-realistic' }); assert.deepEqual(empty.data.entries, []);
  for (const url of ['/api/leaderboard', '/api/leaderboard?category=highway-realistic&category=city-realistic', '/api/leaderboard?category=highway-realistic&callback=alert', '/api/leaderboard?category=__proto__']) assert.equal((await invoke(f.handlers.leaderboard, { method: 'GET', url })).statusCode, 400);
});

test('active runs cannot be reused, while submitted runs allow immediate play-again', async () => {
  const f = fixture();
  await invoke(f.handlers.run, { body: { category: 'highway-realistic' } });
  const second = await invoke(f.handlers.run, { cookie: cookieFor(player1), body: { category: 'highway-realistic' } });
  assert.equal(second.statusCode, 409); assert.equal(second.data.error.code, 'run_active');
  f.time(1_060_000);
  assert.equal((await invoke(f.handlers.score, { cookie: cookieFor(player1), body: valid() })).statusCode, 200);
  const third = await invoke(f.handlers.run, { cookie: cookieFor(player1), body: { category: 'highway-realistic' } });
  assert.equal(third.statusCode, 200); assert.notEqual(third.data.runId, run1);
});

test('invalid stored nicknames fail as infrastructure errors rather than blaming the reader', async () => {
  const f = fixture();
  f.redis.boards.set('test:board:highway-realistic', new Map([['id', 10]]));
  f.redis.names.set('test:names:highway-realistic', new Map([['id', '<script>']]));
  const response = await invoke(f.handlers.leaderboard, { method: 'GET', url: '/api/leaderboard?category=highway-realistic' });
  assert.equal(response.statusCode, 503); assert.equal(response.headers['cache-control'], 'no-store');
});
