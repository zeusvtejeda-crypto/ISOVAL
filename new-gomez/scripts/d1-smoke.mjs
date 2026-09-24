// Prueba de humo REAL con Cloudflare D1 local: levanta `wrangler pages dev` (Pages Functions + D1 en
// miniflare, base nueva en una carpeta temporal) y recorre la API por HTTP con cookies, como un navegador.
//
//   npm run test:d1                     (equivale a: node scripts/d1-smoke.mjs)
//   node scripts/d1-smoke.mjs --port 8790 --keep     (--keep conserva la base temporal y muestra su ruta)
//
// Instala dependencias si falta node_modules (wrangler está en devDependencies). Sale con código ≠ 0 si
// algún paso falla. Cada paso indica el módulo responsable para ubicar rápido la falla.
import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nowInTz, addDays, randomString } from '../core/util.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };
const KEEP = process.argv.includes('--keep');

// Puerto: --port o 8790; si está ocupado (otro servidor), uno libre al azar.
function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer().once('error', () => resolve(false)).once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}
async function pickPort() {
  const wanted = +arg('port', 8790);
  if (await portFree(wanted)) return wanted;
  return new Promise((resolve) => { const srv = net.createServer().listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => resolve(p)); }); });
}
const PORT = await pickPort();
const BASE = 'http://127.0.0.1:' + PORT;
const SETUP_KEY = 'smoke-' + randomString(24);
const SUPER = { email: 'super@smoke.mx', password: 'superseguro-123', name: 'Superadmin Smoke' };
const PINS = { angel: '4812', alexis: '7390' };
const DEMO_OWNER = { email: 'dueno@demo.mx', password: 'demo1234' };

// ── Servidor ──
if (!existsSync(path.join(ROOT, 'node_modules', 'wrangler'))) {
  console.log('· Instalando dependencias (npm install)…');
  execSync('npm install --no-audit --no-fund', { cwd: ROOT, stdio: 'inherit' });
}
const tmp = mkdtempSync(path.join(os.tmpdir(), 'tb-d1-'));
const logs = [];
const child = spawn('npx', ['--no-install', 'wrangler', 'pages', 'dev', '.', '--d1', 'DB=tubarberia', '--port', String(PORT), '--ip', '127.0.0.1',
  '--persist-to', tmp, '--binding', 'SETUP_KEY=' + SETUP_KEY, '--compatibility-date', '2025-09-01', '--show-interactive-dev-session=false'], {
  cwd: ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: Object.assign({}, process.env, { WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1', FORCE_COLOR: '0', CI: '1' })
});
let exited = null;
child.on('exit', (code) => { exited = code == null ? 'señal' : code; });
for (const s of [child.stdout, child.stderr]) s.on('data', (b) => { logs.push(...String(b).split('\n').filter(Boolean)); if (logs.length > 400) logs.splice(0, logs.length - 400); });

function stopServer() {
  try { process.kill(-child.pid, 'SIGTERM'); } catch (e) { try { child.kill('SIGTERM'); } catch (x) { /* ya terminó */ } }
  if (!KEEP) { try { rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* nada */ } }
}
process.on('SIGINT', () => { stopServer(); process.exit(130); });

async function waitHealth(ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (exited !== null) throw new Error('wrangler terminó antes de tiempo (código ' + exited + ')');
    try {
      const r = await fetch(BASE + '/api/health');
      if (r.status === 200) {
        const j = await r.json();
        // Que sea NUESTRO servidor (D1 + la SETUP_KEY de esta corrida), no otro que ya usaba el puerto.
        const s = await (await fetch(BASE + '/api/setup/status')).json().catch(() => null);
        if (!s || !s.data || !s.data.has_setup_key || !s.data.needs_setup) throw new Error('el puerto ' + PORT + ' lo atiende otro servidor');
        return j;
      }
    } catch (e) { if (/otro servidor/.test(e.message)) throw e; /* aún no escucha */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('wrangler no respondió /api/health en ' + Math.round(ms / 1000) + ' s');
}

// ── Cliente HTTP con cookies (un "navegador" por persona) ──
class Browser {
  constructor(name) { this.name = name; this.jar = {}; this.shop = null; }
  cookieHeader() { return Object.entries(this.jar).map(([k, v]) => k + '=' + v).join('; '); }
  async req(method, p, o) {
    o = o || {};
    const headers = { accept: 'application/json' };
    if (Object.keys(this.jar).length) headers.cookie = this.cookieHeader();
    if (o.csrf !== false && method !== 'GET') headers['x-requested-with'] = 'tb';
    const shop = o.shop === undefined ? this.shop : o.shop;
    if (shop) headers['x-shop-id'] = shop;
    let body;
    if (o.raw !== undefined) { body = o.raw; headers['content-type'] = 'application/json'; }
    else if (o.body !== undefined) { body = JSON.stringify(o.body); headers['content-type'] = 'application/json'; }
    const qs = o.query ? '?' + new URLSearchParams(o.query).toString() : '';
    const res = await fetch(BASE + p + qs, { method, headers, body, redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      const k = pair.slice(0, i).trim(), v = pair.slice(i + 1).trim();
      if (/max-age=0/i.test(c) || !v) delete this.jar[k]; else this.jar[k] = v;
    }
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* no JSON */ }
    return { status: res.status, headers: res.headers, json, data: json && json.data, error: json && json.error, text };
  }
}

// ── Pasos ──
const results = [];
const MINE = ['functions', 'setup', 'd1-migrate', 'static'];
async function step(area, name, fn) {
  const t0 = Date.now();
  try {
    const note = await fn();
    results.push({ area, name, ok: true, ms: Date.now() - t0, note: note || '' });
    console.log('  PASS  [' + area + '] ' + name + (note ? ' — ' + note : ''));
  } catch (e) {
    results.push({ area, name, ok: false, ms: Date.now() - t0, note: String(e && e.message || e) });
    console.log('  FAIL  [' + area + '] ' + name + ' — ' + String(e && e.message || e));
  }
}
function expect(cond, msg) { if (!cond) throw new Error(msg); }
function expectStatus(r, status, what) {
  if (r.status !== status) throw new Error((what || 'respuesta') + ': HTTP ' + r.status + ' (esperado ' + status + ')' + (r.error ? ' — ' + r.error.code + ': ' + r.error.message : r.text ? ' — ' + r.text.slice(0, 160) : ''));
}

async function main() {
  console.log('· Levantando wrangler pages dev en ' + BASE + ' (base temporal: ' + tmp + ')…');
  const health = await waitHealth(120000);
  console.log('· Servidor listo (' + JSON.stringify(health.data) + ')\n');

  const anon = new Browser('anónimo');
  const sa = new Browser('superadmin');
  const owner = new Browser('dueño demo');
  const angel = new Browser('Angel (PIN)');
  const ctx = {};

  await step('functions', 'GET /api/health usa D1 en modo servidor', async () => {
    const r = await anon.req('GET', '/api/health');
    expectStatus(r, 200);
    expect(r.data.backend === 'd1' && r.data.mode === 'server', 'health: ' + JSON.stringify(r.data));
    expect(r.headers.get('x-content-type-options') === 'nosniff', 'falta X-Content-Type-Options en la API');
  });
  await step('functions', 'JSON inválido → 400 y ruta desconocida → 404', async () => {
    expectStatus(await anon.req('POST', '/api/auth/login', { raw: '{"email":' }), 400, 'JSON inválido');
    expectStatus(await anon.req('GET', '/api/no-existe'), 404, 'ruta desconocida');
  });
  await step('setup', 'GET /api/setup/status en base nueva', async () => {
    const r = await anon.req('GET', '/api/setup/status');
    expectStatus(r, 200);
    expect(r.data.needs_setup === true && r.data.has_setup_key === true, JSON.stringify(r.data));
  });
  await step('setup', 'POST /api/setup con llave incorrecta → 403', async () => {
    expectStatus(await anon.req('POST', '/api/setup', { body: Object.assign({ key: 'mala' }, SUPER) }), 403);
  });
  await step('setup', 'POST /api/setup crea superadmin + NEW GOMEZ + demo', async () => {
    const r = await anon.req('POST', '/api/setup', { body: Object.assign({ key: SETUP_KEY, pins: PINS, demo: true }, SUPER) });
    expectStatus(r, 200);
    expect(r.data.shop && r.data.shop.slug === 'new-gomez' && r.data.services === 10, 'NEW GOMEZ: ' + JSON.stringify(r.data.shop));
    ctx.ngId = r.data.shop.id;
    ctx.demo = r.data.demo;
    return '10 servicios, ' + r.data.staff.map((s) => s.name + ' (' + s.role + ')').join(', ');
  });
  await step('seed-demo', 'La demo quedó cargada', async () => {
    expect(ctx.demo && ctx.demo.ok, 'demo: ' + JSON.stringify(ctx.demo));
    ctx.demoId = ctx.demo.shop.id;
    expect(!ctx.demo.credentials.superadmin, 'la demo en servidor no debe traer superadmin');
    return ctx.demo.shop.name;
  });
  await step('setup', 'Segundo POST /api/setup → 409 (idempotente)', async () => {
    const r = await anon.req('POST', '/api/setup', { body: Object.assign({ key: SETUP_KEY }, SUPER) });
    expectStatus(r, 409);
  });
  await step('d1-migrate', 'Tablas creadas solas (sin migraciones manuales)', async () => {
    const r = await anon.req('GET', '/api/setup/status');
    expect(r.data.needs_setup === false && r.data.has_demo === true, JSON.stringify(r.data));
  });

  await step('auth', 'Login superadmin con cookie HttpOnly', async () => {
    const r = await sa.req('POST', '/api/auth/login', { body: { email: SUPER.email, password: SUPER.password } });
    expectStatus(r, 200);
    expect(sa.jar.tb_sid, 'no llegó la cookie tb_sid');
    expect(r.data.token === undefined, 'el token no debe ir en el cuerpo en modo servidor');
    expect(r.data.user.is_superadmin === true, 'no es superadmin');
  });
  await step('admin', 'GET /api/admin/shops (superadmin)', async () => {
    const r = await sa.req('GET', '/api/admin/shops');
    expectStatus(r, 200);
    const slugs = r.data.map((s) => s.slug);
    expect(slugs.includes('new-gomez') && slugs.includes('demo'), 'barberías: ' + slugs.join(', '));
    return slugs.join(', ');
  });
  await step('shop', 'Superadmin entra a NEW GOMEZ con x-shop-id', async () => {
    const r = await sa.req('GET', '/api/context', { shop: ctx.ngId });
    expectStatus(r, 200);
    expect(r.data.role === 'superadmin' && r.data.shop.slug === 'new-gomez', 'contexto: ' + r.data.role + ' ' + (r.data.shop && r.data.shop.slug));
  });

  await step('auth', 'Login dueño demo (' + DEMO_OWNER.email + ')', async () => {
    const r = await owner.req('POST', '/api/auth/login', { body: DEMO_OWNER });
    expectStatus(r, 200);
    const c = r.data.contexts.find((x) => x.shop_slug === 'demo');
    expect(c && c.role === 'owner', 'contextos: ' + JSON.stringify(r.data.contexts));
    owner.shop = c.shop_id;
  });
  await step('shop', 'GET /api/context de la demo', async () => {
    const r = await owner.req('GET', '/api/context');
    expectStatus(r, 200);
    expect(r.data.role === 'owner' && r.data.shop.slug === 'demo', r.data.role + ' ' + (r.data.shop && r.data.shop.slug));
    return 'permisos: ' + r.data.permissions.length + ', sin leer: ' + r.data.unread;
  });
  await step('reports', 'GET /api/reports/dashboard (30 días)', async () => {
    const today = nowInTz('America/Mazatlan').date;
    const r = await owner.req('GET', '/api/reports/dashboard', { query: { from: addDays(today, -29), to: today } });
    expectStatus(r, 200);
    expect(r.data.kpis && typeof r.data.kpis.revenue === 'number', 'sin kpis');
    return 'citas ' + r.data.kpis.appointments + ', ingresos $' + r.data.kpis.revenue + (r.data.top_staff ? ', top: ' + r.data.top_staff.name : '');
  });
  await step('appointments', 'GET /api/appointments (próximos 7 días)', async () => {
    const today = nowInTz('America/Mazatlan').date;
    const r = await owner.req('GET', '/api/appointments', { query: { from: today, to: addDays(today, 7) } });
    expectStatus(r, 200);
    expect(Array.isArray(r.data.items), 'sin items');
    return r.data.total + ' citas';
  });

  await step('public', 'GET /api/public/shops/new-gomez', async () => {
    const r = await anon.req('GET', '/api/public/shops/new-gomez');
    expectStatus(r, 200);
    expect(r.data.services.length === 10, 'servicios: ' + r.data.services.length);
    ctx.svc = r.data.services[0];
  });
  await step('public', 'Horarios libres en /api/public/shops/new-gomez/slots', async () => {
    const today = nowInTz('America/Mazatlan').date;
    for (let i = 1; i <= 14 && !ctx.slot; i++) {
      const date = addDays(today, i);
      const r = await anon.req('GET', '/api/public/shops/new-gomez/slots', { query: { date, services: ctx.svc.id, staff: 'any' } });
      expectStatus(r, 200, 'slots ' + date);
      if (r.data.slots.length) ctx.slot = { date, start_min: r.data.slots[0].start_min };
    }
    expect(ctx.slot, 'no hubo horarios en 14 días');
    return ctx.slot.date + ' ' + Math.floor(ctx.slot.start_min / 60) + ':' + String(ctx.slot.start_min % 60).padStart(2, '0');
  });
  await step('public', 'POST /api/public/shops/new-gomez/appointments (reserva en línea)', async () => {
    const r = await anon.req('POST', '/api/public/shops/new-gomez/appointments', { body: { services: [ctx.svc.id], staff_id: 'any', date: ctx.slot.date, start_min: ctx.slot.start_min, name: 'Cliente Smoke', phone: '3110001122', note: 'Prueba automática' } });
    expectStatus(r, 200);
    expect(r.data.manage_token && r.data.appointment.folio, 'sin folio/token');
    ctx.appt = r.data.appointment;
    ctx.manage = r.data.manage_token;
    return 'folio ' + ctx.appt.folio + ' con ' + ctx.appt.staff_name;
  });
  await step('public', 'Mismo barbero y horario otra vez → 409 slot_taken', async () => {
    const r = await anon.req('POST', '/api/public/shops/new-gomez/appointments', { body: { services: [ctx.svc.id], staff_id: ctx.appt.staff_id, date: ctx.slot.date, start_min: ctx.slot.start_min, name: 'Otro Cliente', phone: '3110001133' } });
    expectStatus(r, 409);
  });
  await step('public', 'GET /api/public/appointments/:token', async () => {
    const r = await anon.req('GET', '/api/public/appointments/' + encodeURIComponent(ctx.manage));
    expectStatus(r, 200);
    expect(r.data.appointment.folio === ctx.appt.folio, 'folio distinto');
  });
  await step('auth', 'Angel entra con PIN a NEW GOMEZ y ve la reserva', async () => {
    const r = await angel.req('POST', '/api/auth/pin', { body: { shop_slug: 'new-gomez', pin: PINS.angel } });
    expectStatus(r, 200);
    expect(r.data.contexts[0] && r.data.contexts[0].role === 'owner', 'rol: ' + JSON.stringify(r.data.contexts));
    const a = await angel.req('GET', '/api/appointments', { shop: ctx.ngId, query: { from: ctx.slot.date, to: ctx.slot.date } });
    expectStatus(a, 200, 'agenda');
    expect(a.data.items.some((x) => x.folio === ctx.appt.folio), 'la cita no aparece en la agenda');
  });

  await step('router', 'Aislamiento: dueño demo con x-shop-id de NEW GOMEZ → 403', async () => {
    expectStatus(await owner.req('GET', '/api/context', { shop: ctx.ngId }), 403, 'context');
    expectStatus(await owner.req('GET', '/api/appointments', { shop: ctx.ngId }), 403, 'appointments');
    expectStatus(await owner.req('GET', '/api/clients', { shop: ctx.ngId }), 403, 'clients');
  });
  await step('router', 'Aislamiento: dueño demo no ve la cita de NEW GOMEZ ni adivinando su id', async () => {
    const r = await owner.req('GET', '/api/appointments/' + encodeURIComponent(ctx.appt.id));
    expect(r.status === 404 || r.status === 403, 'HTTP ' + r.status);
  });
  await step('router', 'Aislamiento: dueño demo no entra a la plataforma', async () => {
    expectStatus(await owner.req('GET', '/api/admin/shops'), 403);
  });
  await step('router', 'CSRF: POST con cookie sin x-requested-with → 403', async () => {
    expectStatus(await owner.req('POST', '/api/auth/logout', { csrf: false }), 403);
    expect(owner.jar.tb_sid, 'la sesión no debió cerrarse');
  });
  await step('auth', 'Logout y la cookie deja de servir', async () => {
    const old = owner.jar.tb_sid;
    expectStatus(await owner.req('POST', '/api/auth/logout'), 200, 'logout');
    const r = await fetch(BASE + '/api/auth/me', { headers: { cookie: 'tb_sid=' + old } });
    expect(r.status === 401, 'con la cookie anterior: HTTP ' + r.status);
  });

  await step('static', '_redirects: /b/new-gomez → /?b=new-gomez', async () => {
    const r = await fetch(BASE + '/b/new-gomez', { redirect: 'manual' });
    expect(r.status === 302 && /\/\?b=new-gomez$/.test(r.headers.get('location') || ''), 'HTTP ' + r.status + ' ' + r.headers.get('location'));
  });
  await step('static', '_redirects: /demo y /panel/ → panel', async () => {
    const d = await fetch(BASE + '/demo', { redirect: 'manual' });
    expect(d.status === 302 && /\/app\/#\/demo$/.test(d.headers.get('location') || ''), '/demo: HTTP ' + d.status + ' ' + d.headers.get('location'));
    const p = await fetch(BASE + '/panel/', { redirect: 'manual' });
    expect(p.status === 301 && /\/app\/$/.test(p.headers.get('location') || ''), '/panel/: HTTP ' + p.status + ' ' + p.headers.get('location'));
  });
  await step('static', '_headers: panel sin caché e íconos con caché de una semana (sin mezclar reglas)', async () => {
    const js = await fetch(BASE + '/app/lib/api.js');
    expect(js.status === 200 && js.headers.get('cache-control') === 'no-cache', 'app js Cache-Control: ' + js.headers.get('cache-control'));
    const ic = await fetch(BASE + '/app/icons/icon-192.png');
    expect(ic.status === 200 && ic.headers.get('cache-control') === 'public, max-age=604800', 'ícono Cache-Control: ' + ic.headers.get('cache-control'));
    const home = await fetch(BASE + '/');
    expect(home.headers.get('cache-control') === 'no-cache', '/ Cache-Control: ' + home.headers.get('cache-control'));
    expect(/camera=\(\)/.test(home.headers.get('permissions-policy') || ''), 'Permissions-Policy: ' + home.headers.get('permissions-policy'));
  });
  await step('static', '_headers: seguridad y caché del service worker', async () => {
    const r = await fetch(BASE + '/sw.js');
    expect(r.status === 200, 'sw.js HTTP ' + r.status);
    expect(r.headers.get('service-worker-allowed') === '/', 'Service-Worker-Allowed: ' + r.headers.get('service-worker-allowed'));
    expect(/no-cache/.test(r.headers.get('cache-control') || ''), 'Cache-Control: ' + r.headers.get('cache-control'));
    expect(r.headers.get('x-frame-options') === 'SAMEORIGIN', 'X-Frame-Options: ' + r.headers.get('x-frame-options'));
    const img = await fetch(BASE + '/img/logo.jpg');
    expect(/max-age=604800/.test(img.headers.get('cache-control') || ''), 'img Cache-Control: ' + img.headers.get('cache-control'));
  });
}

let fatal = null;
try { await main(); } catch (e) { fatal = e; }
stopServer();

const failed = results.filter((r) => !r.ok);
console.log('\n── Resumen ──');
console.log('  ' + results.filter((r) => r.ok).length + ' PASS · ' + failed.length + ' FAIL' + (fatal ? ' · ERROR: ' + fatal.message : ''));
if (failed.length) {
  const own = failed.filter((r) => MINE.includes(r.area));
  const other = failed.filter((r) => !MINE.includes(r.area));
  if (own.length) console.log('  Fallas de despliegue/setup: ' + own.map((r) => '[' + r.area + '] ' + r.name).join('; '));
  if (other.length) console.log('  Fallas de otros módulos: ' + other.map((r) => '[' + r.area + '] ' + r.name).join('; '));
}
if (fatal || failed.length) {
  console.log('\n── Últimas líneas de wrangler ──\n' + logs.slice(-40).join('\n'));
}
if (KEEP) console.log('\nBase D1 local conservada en ' + tmp);
process.exit(fatal || failed.length ? 1 : 0);
