#!/usr/bin/env node
// Arma dist/_worker.js: la API y toda la app (public/) en un solo archivo para Cloudflare Pages en modo avanzado.
// Sirve para subir la app sin wrangler (panel de Cloudflare → "Upload assets", o por API). Respeta public/_headers.
// Uso:  npm run empaquetar   (necesita Node 20+; descarga esbuild la primera vez). No edites dist/ a mano.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calcularHuella } from './huella.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const ESBUILD = process.env.ESBUILD_BIN ? [process.env.ESBUILD_BIN] : ['npx', '--yes', 'esbuild@0.25.0']; // ESBUILD_BIN: solo para pruebas
const TIPOS = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8',
  webmanifest: 'application/manifest+json', svg: 'image/svg+xml', png: 'image/png', ico: 'image/x-icon', txt: 'text/plain; charset=utf-8'
};
const TEXTO = new Set(['html', 'js', 'css', 'json', 'webmanifest', 'svg', 'txt']);
const ESPECIALES = new Set(['_headers', '_redirects', '_worker.js', '_routes.json']);

// public/_headers: líneas sin sangría = ruta ("/*" o una ruta exacta); con sangría = "Nombre: valor".
function leerReglas(texto) {
  const reglas = [];
  for (const linea of texto.split(/\r?\n/)) {
    if (!linea.trim() || linea.trim().startsWith('#')) continue;
    if (/^\s/.test(linea)) {
      const i = linea.indexOf(':');
      if (reglas.length && i > 0) reglas[reglas.length - 1].cabeceras.push([linea.slice(0, i).trim().toLowerCase(), linea.slice(i + 1).trim()]);
    } else {
      const patron = linea.trim();
      reglas.push({ re: new RegExp('^' + patron.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'), cabeceras: [] });
    }
  }
  return reglas;
}

const reglas = leerReglas(readFileSync(join(RAIZ, 'public/_headers'), 'utf8'));
const archivos = {};
for (const nombre of readdirSync(join(RAIZ, 'public')).sort()) {
  const ruta = join(RAIZ, 'public', nombre);
  if (ESPECIALES.has(nombre) || !statSync(ruta).isFile()) continue;
  const ext = extname(nombre).slice(1).toLowerCase();
  const datos = readFileSync(ruta);
  const cabeceras = { 'content-type': TIPOS[ext] || 'application/octet-stream' };
  for (const r of reglas) if (r.re.test('/' + nombre)) for (const [k, v] of r.cabeceras) cabeceras[k] = v;
  cabeceras.etag = '"' + createHash('sha256').update(datos).digest('hex').slice(0, 20) + '"';
  archivos['/' + nombre] = TEXTO.has(ext) ? { cabeceras, texto: datos.toString('utf8') } : { cabeceras, b64: datos.toString('base64') };
}

const tmp = mkdtempSync(join(tmpdir(), 'bb-empaquetar-'));
try {
  const modulo = join(tmp, 'archivos.js');
  writeFileSync(modulo, 'export default ' + JSON.stringify(archivos) + ';\n');
  mkdirSync(join(RAIZ, 'dist'), { recursive: true });
  const [cmd, ...previos] = ESBUILD;
  const r = spawnSync(cmd, [...previos, join(RAIZ, 'scripts/entrada-worker.js'), '--bundle', '--format=esm', '--platform=neutral', '--target=es2022',
    '--charset=ascii', '--legal-comments=none', `--banner:js=/* huella:${calcularHuella(RAIZ)} */`, `--alias:archivos-embebidos=${modulo}`, `--outfile=${join(RAIZ, 'dist/_worker.js')}`],
  { encoding: 'utf8', shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.error || r.status !== 0) {
    console.error('✗ No pude armar el paquete.\n' + ((r.error && r.error.message) || r.stderr || r.stdout));
    process.exit(1);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
const kb = Math.round(statSync(join(RAIZ, 'dist/_worker.js')).size / 1024);
console.log(`✓ dist/_worker.js listo (${kb} KB, ${Object.keys(archivos).length} archivos de la app incluidos).`);
