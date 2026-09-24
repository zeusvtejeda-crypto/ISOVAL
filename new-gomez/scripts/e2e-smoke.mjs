// Recorrido E2E de la demo en varios dispositivos: captura pantallas y errores de consola.
//   node scripts/e2e-smoke.mjs [--out /tmp/shots] [--port 8655] [--only owner,barber] [--devices iphone,desktop] [--dark]
// Requiere el paquete global `playwright` (Chromium en /opt/pw-browsers).
import { createRequire } from 'node:module';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const globalRoot = execSync('npm root -g').toString().trim();
const { chromium } = require(path.join(globalRoot, 'playwright'));

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };
const OUT = arg('out', '/tmp/claude-0/shots/e2e');
const PORT = +arg('port', 8655);
const ONLY = (arg('only', 'owner,barber,client,superadmin,public')).split(',');
const DEV = (arg('devices', 'iphone,android,ipad,desktop')).split(',');
const DARK = process.argv.includes('--dark');
mkdirSync(OUT, { recursive: true });

const DEVICES = {
  iphone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' },
  android: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' },
  ipad: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
};
const ROUTES = {
  owner: ['/inicio', '/agenda', '/agenda?vista=semana', '/agenda?vista=mes', '/agenda?vista=lista', '/clientes', '/mensajes', '/caja', '/comisiones', '/reportes', '/equipo', '/servicios', '/horarios', '/enlace', '/ajustes', '/notificaciones', '/perfil', '/instalar', '/guia'],
  barber: ['/inicio', '/agenda', '/clientes', '/comisiones', '/horarios', '/mensajes', '/notificaciones', '/perfil'],
  client: ['/mis-citas', '/notificaciones', '/perfil'],
  superadmin: ['/plataforma']
};

const server = spawn('npx', ['http-server', ROOT, '-p', String(PORT), '-c-1', '-s'], { stdio: 'ignore' });
const base = 'http://localhost:' + PORT;
await new Promise((r) => setTimeout(r, 1500));

const report = { errors: [], shots: 0, checks: [] };
const browser = await chromium.launch();
try {
  for (const dev of DEV) {
    const ctxOpts = Object.assign({}, DEVICES[dev], { colorScheme: DARK ? 'dark' : 'light', locale: 'es-MX', timezoneId: 'America/Mazatlan' });
    for (const role of ONLY) {
      const context = await browser.newContext(ctxOpts);
      const page = await context.newPage();
      const errs = [];
      page.on('console', (m) => { if (m.type() === 'error' && !/favicon|\/api\/health|Failed to load resource/i.test(m.text())) errs.push(m.text()); });
      page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
      const shot = async (name) => { const f = path.join(OUT, `${dev}-${role}-${name.replace(/[^a-z0-9]+/gi, '_')}${DARK ? '-dark' : ''}.png`); await page.screenshot({ path: f, fullPage: false }); report.shots++; };
      try {
        if (role === 'public') {
          await page.goto(base + '/?b=demo', { waitUntil: 'networkidle' });
          await page.waitForTimeout(800);
          await shot('booking-1');
          continue;
        }
        await page.goto(base + '/app/#/demo', { waitUntil: 'networkidle' });
        await page.click(`[data-role="${role}"]`);
        await page.waitForFunction(() => document.querySelector('.shell'), null, { timeout: 20000 });
        await page.waitForTimeout(700);
        for (const r of ROUTES[role]) {
          await page.goto(base + '/app/#' + r);
          await page.waitForTimeout(900);
          const blank = await page.evaluate(() => { const p = document.querySelector('#page .page'); return !p || p.innerText.trim().length < 5; });
          if (blank) report.checks.push(`${dev}/${role}${r}: página vacía`);
          const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
          if (hscroll) report.checks.push(`${dev}/${role}${r}: scroll horizontal`);
          await shot(r);
        }
      } catch (e) {
        report.errors.push(`${dev}/${role}: ${e.message}`);
      } finally {
        if (errs.length) report.errors.push(...errs.map((x) => `${dev}/${role}: ${x}`));
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  server.kill();
}
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ shots: report.shots, errors: report.errors.length, checks: report.checks.length }, null, 0));
if (report.errors.length) console.log(report.errors.slice(0, 40).join('\n'));
if (report.checks.length) console.log(report.checks.slice(0, 40).join('\n'));
process.exit(report.errors.length ? 1 : 0);
