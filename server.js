/*
  ============================================================
  CENTRAL DE APLICAÇÕES - Servidor (Node.js)
  ------------------------------------------------------------
  Criado por: Carlos Arvela
  Autor e responsável por este projeto: Carlos Arvela
  Todos os direitos reservados © Carlos Arvela
  ------------------------------------------------------------
  Servidor sem dependências externas (só módulos nativos do Node).
  - Serve a página (pasta /public)
  - API para sites e manuais (dados guardados em ficheiro JSON)
  - Login de admin verificado NO SERVIDOR (cookie HttpOnly assinado)
  ============================================================
*/
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------- Configuração (variáveis de ambiente) ----------
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const SEED_FILE = path.join(__dirname, 'seed.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'adminabsol';
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_MS = 12 * 60 * 60 * 1000; // 12 horas
const MAX_BODY = 2 * 1024 * 1024; // 2 MB

// ---------- Utilitários de segurança ----------
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return body + '.' + mac;
}
function verify(token) {
  if (!token || token.indexOf('.') < 0) return null;
  const [body, mac] = token.split('.');
  const good = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch (e) { return null; }
}
function getCookie(req, name) {
  const c = req.headers.cookie || '';
  const m = c.split(';').map((x) => x.trim()).find((x) => x.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
}
const isAdmin = (req) => !!verify(getCookie(req, 'sid'));

// Limite de tentativas de login (por IP): 5 falhas / 15 min
const fails = new Map();
function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}
function blocked(ip) {
  const f = fails.get(ip);
  if (!f) return false;
  if (Date.now() - f.t > 15 * 60 * 1000) { fails.delete(ip); return false; }
  return f.n >= 5;
}
function addFail(ip) {
  const f = fails.get(ip);
  if (!f || Date.now() - f.t > 15 * 60 * 1000) fails.set(ip, { n: 1, t: Date.now() });
  else f.n++;
}

// ---------- Dados ----------
function ensureData() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.copyFileSync(SEED_FILE, DATA_FILE);
  migrate();
}
// Corrige links antigos (páginas privadas do claude.ai) para os sites no Render
function migrate() {
  const d = readData();
  let changed = false;
  for (const s of d.sites || []) {
    if (!/claude\.ai\/artifact\//.test(s.u || '')) continue;
    if (s.n === 'Diário de Trabalho') { s.u = 'https://diario-de-trabalho.onrender.com'; changed = true; }
    if (s.n === 'Visão do Vencimento') { s.u = 'https://vencimento.onrender.com'; changed = true; }
  }
  // Acrescenta a Agenda (site + manual) uma única vez
  d.m = Array.isArray(d.m) ? d.m : [];
  if (!d.m.includes('agenda-v1')) {
    const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
    const site = seed.sites.find((x) => x.id === 's-agenda');
    const man = seed.manuals.find((x) => x.id === 'man-agenda');
    if (site && !d.sites.some((x) => x.id === site.id)) d.sites.push(site);
    if (man && !d.manuals.some((x) => x.id === man.id)) d.manuals.push(man);
    d.m.push('agenda-v1');
    changed = true;
  }
  if (changed) writeData(d);
}
function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { return { sites: [], manuals: [] }; }
}
function writeData(d) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
  fs.renameSync(tmp, DATA_FILE); // escrita atómica
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
function cleanUrl(u) {
  try {
    const x = new URL(str(u, 2000));
    return x.protocol === 'http:' || x.protocol === 'https:' ? x.href : '';
  } catch (e) { return ''; }
}
function validate(input) {
  if (!input || !Array.isArray(input.sites) || !Array.isArray(input.manuals)) return null;
  if (input.sites.length > 200 || input.manuals.length > 100) return null;
  const sites = [];
  for (const s of input.sites) {
    const o = { id: str(s.id, 60), n: str(s.n, 120), u: cleanUrl(s.u), c: str(s.c, 80), d: str(s.d, 300) };
    if (!o.id || !o.n || !o.u || !o.c) return null;
    sites.push(o);
  }
  const manuals = [];
  for (const m of input.manuals) {
    if (!Array.isArray(m.ch) || m.ch.length > 100) return null;
    const o = { id: str(m.id, 60), t: str(m.t, 160), d: str(m.d, 300),
      ch: m.ch.map((c) => ({ t: str(c.t, 200) || 'Sem título', b: typeof c.b === 'string' ? c.b.slice(0, 20000) : '' })) };
    if (!o.id || !o.t || !o.ch.length) return null;
    manuals.push(o);
  }
  return { sites, manuals };
}

// ---------- HTTP ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

function send(res, code, body, headers) {
  res.writeHead(code, Object.assign({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': CSP,
  }, headers || {}));
  res.end(body);
}
const json = (res, code, obj, headers) => send(res, code, JSON.stringify(obj), Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers || {}));

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error('too_large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch (e) { reject(new Error('bad_json')); } });
    req.on('error', reject);
  });
}
function sameOrigin(req) {
  const o = req.headers.origin;
  return !o || o.replace(/^https?:\/\//, '') === req.headers.host;
}
function cookieFlags(req) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  return 'Path=/; HttpOnly; SameSite=Strict' + (secure ? '; Secure' : '');
}

async function api(req, res, pathname) {
  if (pathname === '/api/data' && req.method === 'GET') return json(res, 200, readData());
  if (pathname === '/api/me' && req.method === 'GET') return json(res, 200, { admin: isAdmin(req) });

  // Todas as operações de escrita exigem origem igual e JSON
  if (req.method !== 'GET' && !sameOrigin(req)) return json(res, 403, { error: 'origem_invalida' });

  if (pathname === '/api/login' && req.method === 'POST') {
    const ip = clientIp(req);
    if (blocked(ip)) return json(res, 429, { error: 'demasiadas_tentativas' });
    let b; try { b = await readBody(req); } catch (e) { return json(res, 400, { error: 'pedido_invalido' }); }
    const ok = safeEqual(str(b.user, 200), ADMIN_USER) & safeEqual(String(b.pass || '').slice(0, 200), ADMIN_PASS);
    if (!ok) { addFail(ip); return json(res, 401, { error: 'credenciais_invalidas' }); }
    fails.delete(ip);
    const token = sign({ exp: Date.now() + SESSION_MS });
    return json(res, 200, { admin: true }, { 'Set-Cookie': 'sid=' + encodeURIComponent(token) + '; Max-Age=' + SESSION_MS / 1000 + '; ' + cookieFlags(req) });
  }
  if (pathname === '/api/logout' && req.method === 'POST') {
    return json(res, 200, { admin: false }, { 'Set-Cookie': 'sid=; Max-Age=0; ' + cookieFlags(req) });
  }
  if (pathname === '/api/data' && req.method === 'PUT') {
    if (!isAdmin(req)) return json(res, 401, { error: 'sem_permissao' });
    let b; try { b = await readBody(req); } catch (e) { return json(res, e.message === 'too_large' ? 413 : 400, { error: 'pedido_invalido' }); }
    const clean = validate(b);
    if (!clean) return json(res, 422, { error: 'dados_invalidos' });
    clean.m = readData().m || []; // mantém as marcas de migração
    writeData(clean);
    return json(res, 200, clean);
  }
  return json(res, 404, { error: 'nao_encontrado' });
}

function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Método não permitido');
  const rel = pathname === '/' || pathname === '' ? '/index.html' : pathname;
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Proibido');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Não encontrado', { 'Content-Type': 'text/plain; charset=utf-8' });
    const ext = path.extname(file);
    send(res, 200, req.method === 'HEAD' ? '' : buf, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
    });
  });
}

ensureData();
http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent((req.url || '/').split('?')[0]); }
  catch (e) { return send(res, 400, 'Pedido inválido'); }
  if (pathname === '/healthz') return send(res, 200, 'ok', { 'Content-Type': 'text/plain' });
  if (pathname.startsWith('/api/')) {
    return api(req, res, pathname).catch(() => json(res, 500, { error: 'erro_interno' }));
  }
  serveStatic(req, res, pathname);
}).listen(PORT, () => {
  console.log('Central de Aplicações a correr na porta ' + PORT + ' (dados em ' + DATA_FILE + ')');
  if (!process.env.ADMIN_PASS) console.log('AVISO: a usar a palavra-passe de admin por defeito. Define ADMIN_PASS no ambiente.');
});
