import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { calcularHuella } from '../scripts/huella.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

test('dist/_worker.js corresponde al código actual (si falla: npm run empaquetar)', () => {
  const inicio = readFileSync(RAIZ + 'dist/_worker.js', 'utf8').slice(0, 120);
  assert.ok(inicio.includes(`huella:${calcularHuella(RAIZ)}`), 'El paquete está viejo: corre  npm run empaquetar  y súbelo con el resto');
});
