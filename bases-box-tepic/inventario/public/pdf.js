// Generador mínimo de PDF (sin librerías ni internet): texto, rectángulos y líneas en varias páginas.
// Usa las tipografías estándar Helvetica y Helvetica-Bold, que todo lector de PDF trae incluidas.
// Coordenadas en puntos (1/72 de pulgada) con el origen arriba a la izquierda; y = línea base del texto.
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.BBPdf = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Anchos de Helvetica (unidades por 1000 em) para ASCII 32..126
  const W = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  const WB = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
    975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
    333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];

  // Unicode → byte de la codificación WinAnsi (cp1252), que es la que entienden las tipografías estándar
  const ESPECIALES = { 0x20AC: 0x80, 0x2026: 0x85, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2122: 0x99, 0x2212: 0x2D };
  function aWin(str) {
    let o = '';
    for (const ch of String(str == null ? '' : str)) {
      const c = ch.codePointAt(0);
      if (c === 10 || c === 13 || c === 9) o += ' ';
      else if (c >= 32 && c < 127) o += ch;
      else if (c >= 160 && c <= 255) o += ch;
      else if (ESPECIALES[c]) o += String.fromCharCode(ESPECIALES[c]);
      else o += '?';
    }
    return o;
  }
  const escapar = (s) => s.replace(/[\\()]/g, (m) => '\\' + m);
  function anchoCar(ch, bold) {
    const c = ch.charCodeAt(0);
    if (c >= 32 && c < 127) return (bold ? WB : W)[c - 32];
    if (c >= 192) { // letras acentuadas: ancho de la letra base
      const base = ch.normalize('NFD').charAt(0);
      const b = base.charCodeAt(0);
      if (b >= 32 && b < 127) return (bold ? WB : W)[b - 32];
    }
    return c === 0xB7 ? 278 : c === 0xD7 ? 584 : 556;
  }
  const num = (n) => (Math.round(n * 100) / 100).toString();
  const color = (c) => (c || [0, 0, 0]).map((v) => num(v / 255)).join(' ');

  class Doc {
    constructor(opts) {
      opts = opts || {};
      this.w = opts.w || 612;
      this.h = opts.h || 792;
      this.paginas = [];
      this.titulo = opts.titulo || '';
      this.actual = null;
    }
    page() { this.actual = []; this.paginas.push(this.actual); return this.paginas.length; }
    get numPaginas() { return this.paginas.length; }
    textWidth(str, size, bold) {
      const s = aWin(str);
      let t = 0;
      for (let i = 0; i < s.length; i++) t += anchoCar(s[i], bold);
      return t * size / 1000;
    }
    // recorta con “…” para que el texto quepa en un ancho
    ajustar(str, size, bold, ancho) {
      let s = aWin(str);
      if (this.textWidth(s, size, bold) <= ancho) return s;
      while (s.length > 1 && this.textWidth(s + '...', size, bold) > ancho) s = s.slice(0, -1);
      return s + '...';
    }
    rect(x, y, w, h, o) {
      o = o || {};
      const op = [];
      if (o.fill) op.push(color(o.fill) + ' rg');
      if (o.stroke) op.push(color(o.stroke) + ' RG', num(o.lw || 0.75) + ' w');
      op.push(num(x) + ' ' + num(this.h - y - h) + ' ' + num(w) + ' ' + num(h) + ' re ' + (o.fill && o.stroke ? 'B' : o.stroke ? 'S' : 'f'));
      this.actual.push(op.join('\n'));
    }
    line(x1, y1, x2, y2, o) {
      o = o || {};
      this.actual.push(color(o.color || [180, 180, 180]) + ' RG\n' + num(o.lw || 0.75) + ' w\n' + num(x1) + ' ' + num(this.h - y1) + ' m ' + num(x2) + ' ' + num(this.h - y2) + ' l S');
    }
    text(x, y, str, o) {
      o = o || {};
      const size = o.size || 10, s = aWin(str);
      let px = x;
      if (o.align === 'right') px = x - this.textWidth(s, size, o.bold);
      else if (o.align === 'center') px = x - this.textWidth(s, size, o.bold) / 2;
      this.actual.push('BT\n' + color(o.color) + ' rg\n/' + (o.bold ? 'F2' : 'F1') + ' ' + num(size) + ' Tf\n' + num(px) + ' ' + num(this.h - y) + ' Td\n(' + escapar(s) + ') Tj\nET');
    }
    // PDF completo como bytes
    bytes() {
      const objs = [];
      const add = (cuerpo) => { objs.push(cuerpo); return objs.length; };
      add('<< /Type /Catalog /Pages 2 0 R >>'); // 1
      add(''); // 2 (se completa abajo)
      const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      const info = add('<< /Title (' + escapar(aWin(this.titulo)) + ') /Producer (Inventario Bases Box) >>');
      const kids = [];
      this.paginas.forEach((ops) => {
        const flujo = ops.join('\n');
        const cont = add('<< /Length ' + flujo.length + ' >>\nstream\n' + flujo + '\nendstream');
        const pag = add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + this.w + ' ' + this.h + '] /Resources << /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2 + ' 0 R >> >> /Contents ' + cont + ' 0 R >>');
        kids.push(pag + ' 0 R');
      });
      objs[1] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + kids.length + ' >>';
      let out = '%PDF-1.4\n%âãÏÓ\n';
      const pos = [];
      objs.forEach((o, i) => { pos.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
      const xref = out.length;
      out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + pos.map((p) => String(p).padStart(10, '0') + ' 00000 n \n').join('');
      out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
      const u8 = new Uint8Array(out.length);
      for (let i = 0; i < out.length; i++) u8[i] = out.charCodeAt(i) & 255;
      return u8;
    }
  }
  return { Doc, aWin };
});
