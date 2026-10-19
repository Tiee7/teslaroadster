import '../src/driving-score.js';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const CATEGORIES = Object.freeze(['highway-realistic', 'highway-fantasy', 'city-realistic', 'city-fantasy']);
export const DURATION_MS = 60_000;
export const RUN_TTL_MS = 600_000;
export const SCORE_VERSION = RoadsterDrivingScore.version;
export const MAX_SCORE = 3240;
export const MAX_BODY_BYTES = 2048;
export const COOKIE_NAME = '__Host-roadster_player';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class ApiError extends Error {
  constructor(status, code, message, retryAfter) {
    super(message); this.status = status; this.code = code; this.retryAfter = retryAfter;
  }
}
const invalid = (message = 'Invalid request.') => new ApiError(400, 'invalid_request', message);
const unavailable = () => new ApiError(503, 'unavailable', 'Leaderboard temporarily unavailable. Try again later.', 5);

export function configuration(env = process.env) {
  const secret = env.LEADERBOARD_SECRET;
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) throw unavailable();
  const namespace = env.LEADERBOARD_NAMESPACE || 'roadster:v1';
  if (!/^[a-zA-Z0-9:_-]{1,80}$/.test(namespace)) throw unavailable();
  const origins = [];
  if (env.LEADERBOARD_ORIGIN) {
    let u; try { u = new URL(env.LEADERBOARD_ORIGIN); } catch { throw unavailable(); }
    if (u.origin !== env.LEADERBOARD_ORIGIN || (u.protocol !== 'https:' && !(env.NODE_ENV !== 'production' && u.hostname === 'localhost'))) throw unavailable();
    origins.push(u.origin);
  }
  // Vercel supplies this deployment's trusted hostname, never a request-controlled Host header.
  if (env.VERCEL_URL && /^[a-zA-Z0-9.-]+\.vercel\.app$/.test(env.VERCEL_URL)) origins.push(`https://${env.VERCEL_URL}`);
  if (origins.length === 0) throw unavailable();
  return { secret, namespace, origins };
}
export function category(value) {
  if (!CATEGORIES.includes(value)) throw invalid('Unknown leaderboard category.');
  return value;
}
export function exactFields(body, fields) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== fields.length || Object.keys(body).some(k => !fields.includes(k))) throw invalid();
}
export function nickname(value) {
  if (typeof value !== 'string') throw invalid('Nickname must be text.');
  // Reject all controls, formatting marks (including bidi/zero-width), private-use and lone surrogates BEFORE normalization.
  if (/\p{C}/u.test(value)) throw invalid('Nickname contains unsupported characters.');
  const name = value.normalize('NFKC').trim();
  if ([...name].length < 1 || [...name].length > 20 || Buffer.byteLength(name) > 80 || !/^[\p{L}\p{N}][\p{L}\p{M}\p{N} _-]*$/u.test(name)) throw invalid('Use 1–20 letters, numbers, spaces, underscores or hyphens.');
  return name;
}
export function validateScore(body) {
  exactFields(body, ['runId', 'nickname', 'score', 'elapsedMs', 'scoreVersion', 'distanceBySpeed']);
  if (body.scoreVersion !== SCORE_VERSION) throw invalid('Reload the game to use the current scoring rules.');
  if (!Array.isArray(body.distanceBySpeed) || body.distanceBySpeed.length !== 6 || Array.from(body.distanceBySpeed).some(value => !Number.isFinite(value) || value < 0)) throw invalid('Invalid distance segments.');
  if (body.score !== RoadsterDrivingScore.points(body.distanceBySpeed)) throw invalid('Score does not match distance segments.');
  if (typeof body.runId !== 'string' || !UUID.test(body.runId)) throw invalid('Invalid run ID.');
  const name = nickname(body.nickname);
  if (!Number.isSafeInteger(body.score) || body.score < 0 || body.score > MAX_SCORE) throw invalid('Score is outside the allowed range.');
  if (body.elapsedMs !== DURATION_MS) throw invalid('Ranked runs last exactly 60 seconds.');
  return { runId: body.runId, nickname: name, score: body.score, elapsedMs: body.elapsedMs, scoreVersion: SCORE_VERSION, distanceBySpeed: [...body.distanceBySpeed] };
}
export function validateEnd(body) {
  exactFields(body, ['runId']);
  if (typeof body.runId !== 'string' || !UUID.test(body.runId)) throw invalid('Invalid run ID.');
  return { runId: body.runId };
}
function header(req, name) { const v = req.headers?.[name]; return typeof v === 'string' ? v : ''; }
export function checkOrigin(req, config) {
  const origin = header(req, 'origin');
  if (!config.origins.includes(origin) || ['cross-site', 'none'].includes(header(req, 'sec-fetch-site'))) throw new ApiError(403, 'origin_rejected', 'Use this site to submit scores.');
}
export async function readBody(req) {
  const type = header(req, 'content-type');
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(type)) throw new ApiError(415, 'unsupported_media_type', 'Send application/json.');
  const length = header(req, 'content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) throw new ApiError(413, 'body_too_large', 'Request is too large.');
  let raw = req.body;
  if (raw === undefined) {
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > MAX_BODY_BYTES) throw new ApiError(413, 'body_too_large', 'Request is too large.');
      chunks.push(bytes);
    }
    raw = Buffer.concat(chunks);
  }
  if (raw && typeof raw === 'object' && !Buffer.isBuffer(raw)) {
    let encoded; try { encoded = JSON.stringify(raw); } catch { throw invalid(); }
    if (!encoded || Buffer.byteLength(encoded) > MAX_BODY_BYTES) throw new ApiError(413, 'body_too_large', 'Request is too large.');
    return raw;
  }
  if (Buffer.isBuffer(raw)) raw = raw.toString('utf8');
  if (typeof raw !== 'string') throw invalid();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) throw new ApiError(413, 'body_too_large', 'Request is too large.');
  try { return JSON.parse(raw); } catch { throw invalid('Malformed JSON.'); }
}
function mac(secret, value) { return createHmac('sha256', secret).update(value).digest('base64url'); }
export function playerFromCookie(req, config) {
  const cookies = header(req, 'cookie');
  if (cookies.length > 8192) throw invalid();
  const matches = cookies.split(';').map(x => x.trim()).filter(x => x.startsWith(`${COOKIE_NAME}=`));
  if (matches.length !== 1) return null;
  const token = matches[0].slice(COOKIE_NAME.length + 1);
  const [id, signature, extra] = token.split('.');
  if (extra !== undefined || !UUID.test(id || '') || !/^[A-Za-z0-9_-]{43}$/.test(signature || '')) return null;
  const expected = mac(config.secret, `player:${id}`);
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? id : null;
}
export function playerCookie(id, config) {
  return `${COOKIE_NAME}=${id}.${mac(config.secret, `player:${id}`)}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=31536000`;
}
export function ipKey(req, config) {
  // Vercel overwrites the original client-IP header at its trusted proxy. Never store raw IPs.
  const forwarded = process.env.VERCEL ? header(req, 'x-vercel-forwarded-for') || header(req, 'x-forwarded-for') : req.socket?.remoteAddress;
  return mac(config.secret, `ip:${String(forwarded || 'unknown').split(',')[0].trim()}`);
}
export function redisClient(env = process.env, fetchImpl = fetch) {
  let url;
  try { url = new URL(env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL); } catch { throw unavailable(); }
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.upstash\.io$/i.test(url.hostname) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname) || !(env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN)) throw unavailable();
  return {
    async command(...args) {
      try {
        const response = await fetchImpl(url.origin, { method: 'POST', headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(4000), redirect: 'error', cache: 'no-store' });
        if (!response.ok) throw unavailable();
        const data = await response.json();
        if (!data || data.error || !Object.hasOwn(data, 'result')) throw unavailable();
        return data.result;
      } catch { throw unavailable(); }
    }
  };
}

// All decision-and-write sequences execute atomically in Redis, across function instances.
export const RATE_LUA = `-- roadster:rate:v1
for i,key in ipairs(KEYS) do
  local n = tonumber(redis.call('GET', key) or '0')
  if n >= tonumber(ARGV[i]) then return 0 end
end
for _,key in ipairs(KEYS) do
  local n = redis.call('INCR', key)
  if n == 1 then redis.call('EXPIRE', key, ARGV[#KEYS + 1]) end
end
return 1`;
export const START_LUA = `-- roadster:start:v1
local active = redis.call('GET', KEYS[1])
if active then
  local existing = redis.call('GET', ARGV[1] .. active)
  if existing then
    local run = cjson.decode(existing)
    if not run.receipt and not run.canceled then return 'active' end
  end
end
redis.call('SET', KEYS[2], ARGV[2], 'PX', ARGV[3])
redis.call('SET', KEYS[1], ARGV[4], 'PX', ARGV[5])
return ARGV[2]`;
export const END_LUA = `-- roadster:end:v1
local raw = redis.call('GET', KEYS[1])
if not raw then return 'ok' end
local run = cjson.decode(raw)
if run.player ~= ARGV[1] then return 'owner' end
-- An accepted receipt always wins. Preserve it, and never extend a run's TTL.
if not run.receipt and not run.canceled then
  run.canceled = true
  redis.call('SET', KEYS[1], cjson.encode(run), 'KEEPTTL')
end
-- A delayed/replayed end may target an old run after a newer start.
if redis.call('GET', KEYS[2]) == ARGV[2] then redis.call('DEL', KEYS[2]) end
return 'ok'`;
export const SCORE_LUA = `-- roadster:score:v1
local raw = redis.call('GET', KEYS[1])
if not raw then return {'missing'} end
local run = cjson.decode(raw)
if run.player ~= ARGV[1] then return {'owner'} end
if run.receipt then
  if run.fingerprint == ARGV[2] then return {'ok', run.receipt} end
  return {'replay'}
end
if run.canceled then return {'canceled'} end
local now = tonumber(ARGV[3])
if now < run.startedAt + tonumber(ARGV[4]) then return {'early'} end
if now > run.expiresAt then return {'expired'} end
local score = tonumber(ARGV[5])
local best = tonumber(redis.call('ZSCORE', KEYS[2], ARGV[1]) or '-1')
local improved = score > best
if improved then
  redis.call('ZADD', KEYS[2], score, ARGV[1])
  redis.call('HSET', KEYS[3], ARGV[1], ARGV[6])
  best = score
end
local rank = redis.call('ZREVRANK', KEYS[2], ARGV[1])
local receipt = cjson.encode({accepted=true, improved=improved, bestScore=best, rank=rank + 1})
run.receipt = receipt
run.fingerprint = ARGV[2]
redis.call('SET', KEYS[1], cjson.encode(run), 'PX', ARGV[7])
return {'ok', receipt}`;
export const LIST_LUA = `-- roadster:list:v1
local rows = redis.call('ZREVRANGE', KEYS[1], 0, 99, 'WITHSCORES')
local result = {}
for i=1,#rows,2 do
  local name = redis.call('HGET', KEYS[2], rows[i])
  if name then table.insert(result, {name, rows[i + 1]}) end
end
return result`;

export async function rateLimit(redis, config, action, ip, player) {
  const window = action === 'run' ? 600 : 60;
  const limits = action === 'run' ? [20, 8] : action === 'score' ? [60, 15] : action === 'end' ? [120, 30] : [120];
  const bucket = Math.floor(Date.now() / (window * 1000));
  const keys = [`${config.namespace}:rate:${action}:ip:${ip}:${bucket}`];
  if (player) keys.push(`${config.namespace}:rate:${action}:player:${player}:${bucket}`);
  const result = await redis.command('EVAL', RATE_LUA, keys.length, ...keys, ...limits.slice(0, keys.length), window + 1);
  if (result !== 1) throw new ApiError(429, 'rate_limited', 'Too many requests. Try again later.', window);
}
export function createHandlers(dependencies = {}) {
  const getConfig = dependencies.getConfig || configuration;
  const getRedis = dependencies.getRedis || redisClient;
  const now = dependencies.now || Date.now;
  const uuid = dependencies.uuid || randomUUID;
  const common = (method, action) => async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Origin');
    try {
      if (req.method !== method) { res.setHeader('Allow', method); throw new ApiError(405, 'method_not_allowed', 'Method not allowed.'); }
      const config = getConfig();
      if (method === 'POST') checkOrigin(req, config);
      // Fully validate client-controlled data before any database operation, including rate-limit writes.
      const body = method === 'POST' ? await readBody(req) : null;
      let input;
      if (action === 'run') {
        exactFields(body, ['category', 'scoreVersion']);
        if (body.scoreVersion !== SCORE_VERSION) throw invalid('Reload the game to use the current scoring rules.');
        input = category(body.category);
      }
      if (action === 'score') input = validateScore(body);
      if (action === 'end') input = validateEnd(body);
      if (action === 'leaderboard') {
        const url = new URL(req.url || '/', 'https://leaderboard.invalid');
        if ([...url.searchParams.keys()].length !== 2 || url.searchParams.getAll('category').length !== 1 || url.searchParams.getAll('scoreVersion').length !== 1 || url.searchParams.get('scoreVersion') !== SCORE_VERSION) throw invalid();
        input = category(url.searchParams.get('category'));
      }
      let player = action === 'leaderboard' ? null : playerFromCookie(req, config);
      if (['score', 'end'].includes(action) && !player) throw new ApiError(401, 'identity_required', 'Start a run in this browser first.');
      if (action === 'run' && !player) player = uuid();
      const redis = getRedis();
      await rateLimit(redis, config, action, ipKey(req, config), player);
      if (action === 'run') {
        const startedAt = now(), runId = uuid();
        const run = { runId, player, category: input, scoreVersion: SCORE_VERSION, startedAt, expiresAt: startedAt + RUN_TTL_MS };
        const raw = await redis.command('EVAL', START_LUA, 2, `${config.namespace}:active:${player}`, `${config.namespace}:run:${runId}`, `${config.namespace}:run:`, JSON.stringify(run), RUN_TTL_MS, runId, DURATION_MS + 5000);
        if (raw === 'active') throw new ApiError(409, 'run_active', 'A ranked run is already active. Wait 65 seconds before starting another.', 65);
        const saved = JSON.parse(raw);
        if (saved.category !== input) throw new ApiError(409, 'run_active', 'Wait for the active run to end before changing categories.', 65);
        res.setHeader('Set-Cookie', playerCookie(player, config));
        return send(res, 200, { runId: saved.runId, durationMs: DURATION_MS, scoreVersion: SCORE_VERSION, expiresAt: saved.expiresAt, serverNow: now() });
      }
      if (action === 'end') {
        const result = await redis.command('EVAL', END_LUA, 2, `${config.namespace}:run:${input.runId}`, `${config.namespace}:active:${player}`, player, input.runId);
        if (result === 'owner') throw new ApiError(403, 'run_owner', 'This run belongs to another browser.');
        if (result !== 'ok') throw unavailable();
        return send(res, 200, { ended: true, runId: input.runId });
      }
      if (action === 'score') {
        // Read the category only from the server-created run. Never accept a client-supplied board or identity.
        const raw = await redis.command('GET', `${config.namespace}:run:${input.runId}`);
        if (!raw) throw new ApiError(410, 'run_expired', 'This run expired. Start a new run.');
        const run = JSON.parse(raw);
        if (run.player !== player) throw new ApiError(403, 'run_owner', 'This run belongs to another browser.');
        if (run.scoreVersion !== SCORE_VERSION) throw new ApiError(409, 'scoring_changed', 'Scoring rules changed. Reload and start a new run.');
        const board = category(run.category);
        // Browser telemetry is not proof, but reject impossible 60-second travel.
        // A band's maximum speed gives the least time its metres could take.
        const maxMps = board.endsWith('-realistic') ? 120 : 300;
        const upperMps = [180, 200, 240, 300, 350].map(kmh => kmh / 3.6).concat(maxMps);
        const minimumSeconds = input.distanceBySpeed.reduce((sum, metres, i) => sum + metres / upperMps[i], 0);
        if (minimumSeconds > DURATION_MS / 1000 + 0.001) throw invalid('Distance exceeds the speed and duration envelope.');
        const fingerprint = mac(config.secret, JSON.stringify(input));
        const result = await redis.command('EVAL', SCORE_LUA, 3, `${config.namespace}:run:${input.runId}`, `${config.namespace}:board:${SCORE_VERSION}:${board}`, `${config.namespace}:names:${SCORE_VERSION}:${board}`, player, fingerprint, now(), DURATION_MS, input.score, input.nickname, RUN_TTL_MS);
        if (!Array.isArray(result)) throw unavailable();
        const [status, receipt] = result;
        if (status === 'ok') return send(res, 200, JSON.parse(receipt));
        const errors = { missing: [410, 'run_expired', 'This run expired.'], expired: [410, 'run_expired', 'This run expired.'], early: [422, 'run_too_early', 'The server has not observed 60 seconds yet.'], replay: [409, 'run_used', 'This run was already submitted.'], canceled: [409, 'run_canceled', 'This run was ended without submitting a score.'], owner: [403, 'run_owner', 'This run belongs to another browser.'] };
        if (!errors[status]) throw unavailable();
        throw new ApiError(...errors[status]);
      }
      const rows = await redis.command('EVAL', LIST_LUA, 2, `${config.namespace}:board:${SCORE_VERSION}:${input}`, `${config.namespace}:names:${SCORE_VERSION}:${input}`);
      if (!Array.isArray(rows)) throw unavailable();
      // Validate stored data too: old/manual database edits must not become an XSS or malformed-data path.
      let entries;
      try { entries = rows.slice(0, 100).map(([name, score], i) => ({ rank: i + 1, nickname: nickname(name), score: Number(score) })); }
      catch { throw unavailable(); }
      if (entries.some(e => !Number.isSafeInteger(e.score) || e.score < 0 || e.score > MAX_SCORE)) throw unavailable();
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=10, stale-while-revalidate=20');
      return send(res, 200, { category: input, scoreVersion: SCORE_VERSION, entries, limit: 100 });
    } catch (error) {
      const safe = error instanceof ApiError ? error : unavailable();
      res.setHeader('Cache-Control', 'no-store');
      if (safe.retryAfter) res.setHeader('Retry-After', String(safe.retryAfter));
      return send(res, safe.status, { error: { code: safe.code, message: safe.message } });
    }
  };
  return { run: common('POST', 'run'), end: common('POST', 'end'), score: common('POST', 'score'), leaderboard: common('GET', 'leaderboard') };
}
function send(res, status, data) { res.statusCode = status; return res.end(JSON.stringify(data)); }
