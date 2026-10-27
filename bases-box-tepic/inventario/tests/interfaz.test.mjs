// Revisión mínima de la interfaz: su script debe compilar (una constante repetida lo dejaría en blanco)
// y la página no puede traer scripts ni manejadores en línea (la política de seguridad solo permite archivos propios).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (f) => readFileSync(new URL('../public/' + f, import.meta.url), 'utf8');

test('app.js y core.js no tienen errores de sintaxis', () => {
  ['app.js', 'core.js', 'sw.js'].forEach((f) => assert.doesNotThrow(() => new Function(leer(f)), f));
});

test('index.html: sin scripts en línea, sin manejadores onclick=, solo recursos propios', () => {
  const html = leer('index.html');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length >= 2);
  scripts.forEach((m) => { assert.match(m[1], /\bsrc="[a-z.]+\.js"/); assert.equal(m[2].trim(), ''); });
  assert.doesNotMatch(html, /\son[a-z]+\s*=\s*["']/i, 'manejadores en línea');
  assert.doesNotMatch(html, /(?:src|href)="https?:\/\//i, 'recursos externos');
  assert.doesNotMatch(leer('app.js'), /https?:\/\/(?!wa\.me)/, 'solo wa.me se abre fuera de la app');
});

test('las cabeceras de seguridad prohíben scripts en línea y recursos de terceros', () => {
  const h = leer('_headers');
  const csp = h.match(/Content-Security-Policy: (.*)/)[1];
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.doesNotMatch(csp.split(';').find((d) => d.trim().startsWith('script-src')), /unsafe/);
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /connect-src 'self'/);
  assert.doesNotMatch(csp, /https?:/);
  assert.match(h, /Strict-Transport-Security/);
});
