// Revisión mínima de la interfaz: el script de index.html debe compilar (una constante repetida lo dejaría en blanco)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('el script de index.html no tiene errores de sintaxis', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((c) => c.trim());
  assert.ok(scripts.length >= 1, 'hay un script en la página');
  scripts.forEach((c) => assert.doesNotThrow(() => new Function(c)));
});
