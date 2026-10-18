import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { serveMusic } from './serve-music.mjs';
import { createHandlers } from '../lib/leaderboard.mjs';
const port = Number(process.env.PORT || 3000);
if (!process.env.LEADERBOARD_ORIGIN) process.env.LEADERBOARD_ORIGIN = `http://localhost:${port}`;
const handlers = createHandlers();
http.createServer(async (req, res) => {
  const path = new URL(req.url, `http://localhost:${port}`).pathname;
  const api = { '/api/run': handlers.run, '/api/score': handlers.score, '/api/leaderboard': handlers.leaderboard }[path];
  if (api) return api(req, res);
  if (path === '/assets/Ludicrous_Velocity_bgm.mp3') {
    return serveMusic(req, res);
  }
  if (path !== '/' && path !== '/index.html') { res.statusCode = 404; return res.end('Not found'); }
  try { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(await readFile('index.html')); }
  catch { res.statusCode = 500; res.end('Run from the project root.'); }
}).listen(port, '127.0.0.1', () => console.log(`Game: http://localhost:${port}. Leaderboard needs server-only environment configuration; otherwise API returns 503.`));
