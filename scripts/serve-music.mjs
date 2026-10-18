import { readFile } from 'node:fs/promises';

// The development server only serves this fixed asset, never arbitrary file paths.
export async function serveMusic(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }
  try {
    const bytes = await readFile(new URL('../assets/Ludicrous_Velocity_bgm.mp3', import.meta.url));
    const headers = { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes' };
    let start = 0;
    let end = bytes.length - 1;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (match && (match[1] || match[2])) {
        if (match[1]) {
          start = Number(match[1]);
          if (match[2]) end = Math.min(Number(match[2]), end);
        } else {
          start = Math.max(0, bytes.length - Number(match[2]));
        }
      }
      if (!match || !(match[1] || match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)
          || start > end || start >= bytes.length || (!match[1] && Number(match[2]) === 0)) {
        res.writeHead(416, { ...headers, 'Content-Range': `bytes */${bytes.length}` });
        return res.end();
      }
      headers['Content-Range'] = `bytes ${start}-${end}/${bytes.length}`;
    }
    res.writeHead(req.headers.range ? 206 : 200, { ...headers, 'Content-Length': end - start + 1 });
    res.end(req.method === 'HEAD' ? undefined : bytes.subarray(start, end + 1));
  } catch (_) {
    res.writeHead(500);
    res.end('Music asset unavailable.');
  }
}
