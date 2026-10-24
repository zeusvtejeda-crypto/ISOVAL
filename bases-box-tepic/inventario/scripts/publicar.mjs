#!/usr/bin/env node
// Publica el inventario en Cloudflare Pages + D1 con un solo comando:  npm run publicar
// Se puede repetir: la primera vez crea la base, el sitio y la clave de instalación; después solo sube la versión
// nueva (no toca los datos ni la clave). Necesita Node 20+ y una cuenta de Cloudflare (gratis).
import { spawnSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const NOMBRE = 'bases-box-inventario';
const WRANGLER = process.env.WRANGLER_BIN ? [process.env.WRANGLER_BIN] : ['npx', '--yes', 'wrangler@4']; // WRANGLER_BIN: solo para pruebas
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const paso = (t) => console.log('\n▸ ' + t);
const parar = (t) => { console.error('\n✗ ' + t); process.exit(1); };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const json = (s) => { try { return JSON.parse(s.slice(s.search(/[[{]/), Math.max(s.lastIndexOf(']'), s.lastIndexOf('}')) + 1)); } catch { return null; } };

function wrangler(args, { entrada, interactivo } = {}) {
  const [cmd, ...previos] = WRANGLER;
  const r = spawnSync(cmd, [...previos, ...args], {
    cwd: RAIZ, encoding: 'utf8', input: entrada, shell: process.platform === 'win32',
    stdio: interactivo ? 'inherit' : [entrada == null ? 'ignore' : 'pipe', 'pipe', 'pipe']
  });
  if (r.error) parar('No pude ejecutar wrangler: ' + r.error.message);
  const limpio = (s) => (s || '').replace(/\x1b\[[0-9;]*m/g, '');
  return { ok: r.status === 0, out: limpio(r.stdout), err: limpio(r.stderr) };
}

function fallo(r, que) {
  const detalle = (r.err + r.out).split('\n').filter((l) => l.trim() && !/Proxy environment/.test(l)).slice(-12).join('\n');
  const pista = /more than one account/i.test(detalle)
    ? '\nTienes varias cuentas de Cloudflare: elige una y repite con  CLOUDFLARE_ACCOUNT_ID=<id> npm run publicar' : '';
  parar(que + '\n' + detalle + pista);
}

function exigir(args, que, opciones) {
  const r = wrangler(args, opciones);
  if (!r.ok) fallo(r, que);
  return r;
}

if (Number(process.versions.node.split('.')[0]) < 20) parar(`Necesitas Node 20 o más nuevo (tienes ${process.versions.node}): https://nodejs.org`);

paso('Cuenta de Cloudflare');
if (/not authenticated/i.test(wrangler(['whoami']).out)) {
  console.log('Se abrirá el navegador para que entres a Cloudflare (si no tienes cuenta, créala gratis).');
  wrangler(['login'], { interactivo: true });
  if (/not authenticated/i.test(wrangler(['whoami']).out)) parar('No se pudo iniciar sesión en Cloudflare.');
}
console.log('Listo.');

paso('Base de datos (D1)');
const bases = () => json(exigir(['d1', 'list', '--json'], 'No pude consultar tus bases de datos.').out) || [];
let base = bases().find((b) => b.name === NOMBRE);
if (base) console.log('Ya existe; se reutiliza (sus datos no se tocan).');
else {
  const creada = exigir(['d1', 'create', NOMBRE, '--location', 'wnam'], 'No pude crear la base de datos.');
  base = bases().find((b) => b.name === NOMBRE) || { uuid: (creada.out.match(UUID) || [])[0] };
  console.log('Creada.');
}
if (!base || !base.uuid) parar('No encontré el id de la base de datos.');
const rutaToml = RAIZ + 'wrangler.toml';
const toml = readFileSync(rutaToml, 'utf8');
const conId = toml.replace(/^(database_id\s*=\s*)"[^"]*"/m, `$1"${base.uuid}"`);
if (!conId.includes(base.uuid)) parar('No pude escribir el id de la base en wrangler.toml.');
if (conId !== toml) writeFileSync(rutaToml, conId);

paso('Sitio (Cloudflare Pages)');
const sitio = wrangler(['pages', 'project', 'create', NOMBRE, '--production-branch', 'main']);
if (!sitio.ok && !/already exists|8000002/i.test(sitio.err + sitio.out)) fallo(sitio, 'No pude crear el sitio.');
console.log(sitio.ok ? 'Creado.' : 'Ya existe; se actualiza.');

paso('Clave de instalación');
let clave = '';
const tieneClave = !sitio.ok && /\bSETUP_KEY\b/.test(wrangler(['pages', 'secret', 'list', '--project-name', NOMBRE]).out);
if (tieneClave) console.log('Ya había una; se conserva.');
else {
  clave = [4, 4, 4].map((n) => Array.from({ length: n }, () => ALFABETO[randomInt(ALFABETO.length)]).join('')).join('-');
  exigir(['pages', 'secret', 'put', 'SETUP_KEY', '--project-name', NOMBRE], 'No pude guardar la clave de instalación.', { entrada: clave });
  console.log('Generada.');
}

paso('Subiendo la app (puede tardar un minuto)');
const subida = exigir(['pages', 'deploy', 'public', '--project-name', NOMBRE, '--branch', 'main', '--commit-dirty=true', '--commit-message', 'Publicacion'], 'No pude subir la app.');
const enlaces = subida.out.match(/https?:\/\/[^\s)]+/g) || [];
const enlace = enlaces.find((u) => /\.pages\.dev/.test(u)) || enlaces[enlaces.length - 1];
if (!enlace) parar('Se subió, pero no encontré la dirección. Búscala en dash.cloudflare.com → Workers y Pages.');
const url = new URL(enlace).origin.replace(/^(https?:\/\/)[0-9a-f]{8}\./, '$1');

paso('Comprobando que responda');
let ping = null;
for (let i = 0; i < 10 && !(ping && ping.ok); i++) {
  if (i) await espera(4000);
  try { ping = await (await fetch(url + '/api/ping', { cache: 'no-store' })).json(); } catch { ping = null; }
  if (ping && ping.error && ping.error.code === 'sin_base_de_datos') break;
}
const sinBase = !!(ping && ping.error && ping.error.code === 'sin_base_de_datos');
if (ping && ping.ok) console.log('Responde bien.');
else if (sinBase) console.log('⚠ La app no encuentra la base de datos. Revisa el database_id de wrangler.toml y repite  npm run publicar');
else console.log('⚠ Todavía no responde (un sitio nuevo a veces tarda unos minutos). Prueba la dirección en un rato.');

console.log(`\n✓ Dirección: ${url}`);
if (clave) console.log(`✓ Clave de instalación: ${clave}\n  Guárdala: el asistente de primera configuración la pide una sola vez.`);
if (ping && ping.ok && ping.configurado === false) console.log('\nSiguiente: abre la dirección y termina el asistente tú, antes de compartir el enlace.');
if (conId !== toml) console.log('\nSe guardó el id de la base en wrangler.toml: súbelo al repositorio (git add wrangler.toml && git commit).');
if (sinBase) process.exit(1);
