import { mkdir, copyFile } from 'node:fs/promises';
// Bundle before committing with python bundle_app.py. Do not publish server code, docs, or secrets as static files.
await mkdir('public', { recursive: true });
await copyFile('index.html', 'public/index.html');
console.log('Static game copied to public/index.html; Vercel builds api/ separately.');
