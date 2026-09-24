// Genera migrations/0001_init.sql desde core/schema.js (única fuente del esquema).
//   npm run migration            → escribe el archivo
//   node scripts/gen-migration.mjs --check   → sale con código 1 si el archivo no está al día (CI)
// No hace falta aplicarlo a mano: la Pages Function crea/actualiza las tablas sola (core/d1-migrate.js).
// Sirve para revisar el esquema o para `wrangler d1 execute tubarberia --file migrations/0001_init.sql`.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toSQL, TABLES } from '../core/schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'migrations', '0001_init.sql');
const header = [
  '-- TuBarbería — esquema inicial de Cloudflare D1 (' + TABLES.length + ' tablas).',
  '-- GENERADO por scripts/gen-migration.mjs desde core/schema.js: no lo edites a mano.',
  '-- La app lo aplica sola al arrancar (core/d1-migrate.js); todas las sentencias son IF NOT EXISTS.',
  ''
].join('\n');
const sql = header + toSQL();

if (process.argv.includes('--check')) {
  let cur = '';
  try { cur = readFileSync(OUT, 'utf8'); } catch (e) { /* no existe */ }
  if (cur !== sql) { console.error('migrations/0001_init.sql no está al día: corre `npm run migration`.'); process.exit(1); }
  console.log('migrations/0001_init.sql al día.');
} else {
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, sql);
  console.log('Escrito ' + path.relative(ROOT, OUT) + ' (' + TABLES.length + ' tablas).');
}
