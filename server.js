'use strict';
/**
 * DialogueAPI - servidor do editor web de diálogos do NotEnoughDialogues.
 *
 * Serve o editor (index.html, editor.css, editor.js) e repassa as chamadas /api/* para o plugin
 * (PLUGIN_URL), colocando o API_TOKEN do .env. O token nunca vai para o navegador.
 *
 * Iniciar:  npm start   (ou start.bat)
 * Sem dependências: só Node 18+.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

// ---------- .env ----------
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnv(path.join(__dirname, '.env'));

const PLUGIN_URL = (process.env.PLUGIN_URL || 'http://localhost:8166').replace(/\/+$/, '');
const API_TOKEN = process.env.API_TOKEN || '';
const PORT = parseInt(process.env.PORT || '5173', 10);
const HOST = process.env.HOST || '127.0.0.1';

if (API_TOKEN.length < 16) {
  console.error('API_TOKEN ausente ou curto demais no .env (mínimo 16 caracteres).');
  process.exit(1);
}

const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/editor.js': ['editor.js', 'application/javascript; charset=utf-8'],
  '/editor.css': ['editor.css', 'text/css; charset=utf-8'],
};

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

async function proxy(req, res, url) {
  // troca qualquer "s" que veio do navegador pelo token do .env
  url.searchParams.set('s', API_TOKEN);
  const target = PLUGIN_URL + url.pathname + '?' + url.searchParams.toString();
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: { 'Content-Type': req.headers['content-type'] || 'application/json' },
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
      signal: AbortSignal.timeout(30000),
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    send(res, upstream.status, upstream.headers.get('content-type') || 'application/octet-stream', buf);
  } catch (e) {
    send(res, 502, 'application/json; charset=utf-8', JSON.stringify({
      ok: false,
      error: `Não consegui falar com o plugin em ${PLUGIN_URL} (${e.cause ? e.cause.code || e.cause.message : e.message}). `
        + 'Confira PLUGIN_URL no .env, se o servidor está ligado e se a porta do web-editor está liberada.',
    }));
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) return proxy(req, res, url);
  const file = STATIC[url.pathname];
  if (!file) return send(res, 404, 'text/plain; charset=utf-8', 'not found');
  fs.readFile(path.join(__dirname, file[0]), (err, data) => {
    if (err) return send(res, 500, 'text/plain; charset=utf-8', 'erro ao ler ' + file[0]);
    send(res, 200, file[1], data);
  });
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  NotEnoughDialogues · DialogueAPI');
  console.log(`  Editor:  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/`);
  console.log(`  Plugin:  ${PLUGIN_URL}`);
  console.log('');
});
