// El generador de PDF propio: estructura válida (xref con posiciones reales), varias páginas, acentos y texto largo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { Doc, aWin } = createRequire(import.meta.url)('../public/pdf.js');

test('PDF válido: cabecera, objetos en la posición que dice la tabla xref, páginas y fin', () => {
  const d = new Doc({ titulo: 'Prueba · Ñandú' });
  d.page(); d.rect(40, 40, 100, 20, { fill: [255, 0, 0] }); d.line(40, 80, 200, 80); d.text(40, 120, 'Hola, Dueño: $1,250.50 (ñ á é í ó ú ¿?)', { size: 12, bold: true });
  d.page(); d.text(300, 100, 'Segunda página', { align: 'center' });
  const u8 = d.bytes();
  const s = Buffer.from(u8).toString('latin1');
  assert.ok(s.startsWith('%PDF-1.4'));
  assert.ok(s.trimEnd().endsWith('%%EOF'));
  assert.match(s, /\/Count 2/);
  const xref = Number(s.match(/startxref\n(\d+)/)[1]);
  assert.equal(s.slice(xref, xref + 4), 'xref');
  const n = Number(s.match(/xref\n0 (\d+)/)[1]);
  const lineas = s.slice(xref).split('\n').slice(2, 2 + n);
  assert.equal(lineas[0].startsWith('0000000000 65535 f'), true);
  lineas.slice(1).forEach((l, i) => {
    const off = Number(l.slice(0, 10));
    assert.ok(s.slice(off).startsWith((i + 1) + ' 0 obj'), 'objeto ' + (i + 1) + ' en ' + off);
  });
  // la longitud declarada de cada flujo coincide con su contenido
  for (const m of s.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)) assert.equal(m[2].length, Number(m[1]));
  assert.ok(s.includes('(Hola, Due\xf1o: $1,250.50'));
});

test('texto: caracteres especiales, escape de paréntesis y recorte con puntos suspensivos', () => {
  assert.equal(aWin('a−b — “x” € 中'), 'a-b \x97 \x93x\x94 \x80 ?');
  const d = new Doc(); d.page();
  d.text(10, 10, 'Paréntesis (a) \\ b');
  assert.ok(Buffer.from(d.bytes()).toString('latin1').includes('(Par\xe9ntesis \\(a\\) \\\\ b)'));
  const largo = 'Compra de madera y tela para la producción de toda la semana, con envío';
  const corto = d.ajustar(largo, 9, false, 120);
  assert.ok(corto.endsWith('...') && d.textWidth(corto, 9, false) <= 120);
  assert.equal(d.ajustar('Hola', 9, false, 120), 'Hola');
  // Helvetica: 'i' es angosta, 'W' ancha
  assert.ok(d.textWidth('iii', 10) < d.textWidth('WWW', 10));
  assert.ok(d.textWidth('Hola', 10, true) > d.textWidth('Hola', 10, false));
});
