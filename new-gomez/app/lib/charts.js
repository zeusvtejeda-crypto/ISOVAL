/* ════════════════════════════════════════════════════════════════════
   TuBarbería — gráficas SVG propias (sin librerías)

   lineChart(el, { series:[{ name, values, color? }], labels, format?, area?, height?, label? })
   barChart(el,  { labels, values, format?, horizontal?, highlight?, color?, height?, name?, label? })
   donutChart(el,{ segments:[{ label, value, color? }], format?, centerLabel?, centerValue?, label? })
   heatmap(el,   { rows, cols, values:number[][], format?, label? })
   sparkline(values, { width, height, color, label? }) → string SVG

   Cada gráfica (salvo sparkline) devuelve { update(opts), redraw(), destroy() }.

   · format: 'money' | 'number' | 'percent' (valores 0–100) | (n) => string.
     El eje usa una versión compacta ($12.5 k); pasa axisFormat(n) para cambiarla.
   · color: número de ranura 1–6, 'brand', 'muted', 'var(--x)', '--x' o cualquier color CSS.
   · Colores desde variables CSS (--chart-1…6, --chart-muted, --chart-grid, --chart-axis,
     --chart-seq-0…2, --chart-empty, --chart-surface + tokens de app.css). Se definen aquí con
     especificidad 0, así que app.css puede sobrescribirlos. Paleta categórica de 6 ranuras
     (latón, petróleo, terracota, amatista, bosque, ciruela) validada en claro (#FFF) y oscuro
     (#191713): vecinas con ΔE OKLab ≥ 9.4 bajo protan/deutan y ≥ 19.5 visión normal, contraste
     ≥ 3:1, y las 4 primeras distinguibles entre todas (donas de 2–6 segmentos, incluido el cierre).
     Magnitud (heatmap) = rampa de un solo tono latón; en oscuro se invierte (más = más claro).
     Máximo 6 series/segmentos con color propio: en la dona el resto se agrupa en "Otros".
   · Responsivas (ResizeObserver), se redibujan al cambiar data-theme / prefers-color-scheme,
     animación de entrada que respeta prefers-reduced-motion, tooltip con mouse, dedo o teclado,
     role="img" + <title> + tabla oculta para lectores de pantalla.
   ════════════════════════════════════════════════════════════════════ */

let UID = 0;
const live = new Set();

// ─── utilidades ─────────────────────────────────────────────────────
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v) => (v == null || v === '' || !isFinite(+v) ? null : +v);
const r1 = (v) => Math.round(v * 10) / 10;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const maxOf = (arr) => arr.reduce((m, v) => (v > m ? v : m), -Infinity);
const minOf = (arr) => arr.reduce((m, v) => (v < m ? v : m), Infinity);
const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function div(cls, tag) { const d = document.createElement(tag || 'div'); if (cls) d.className = cls; return d; }

let _ctx = null;
function ctx2d() { if (!_ctx) _ctx = document.createElement('canvas').getContext('2d'); return _ctx; }
const _tw = new Map();
function textW(s, size, weight, fam) {
  const key = size + '|' + weight + '|' + fam + '|' + s;
  let w = _tw.get(key);
  if (w == null) {
    const c = ctx2d(); c.font = weight + ' ' + size + 'px ' + fam;
    w = c.measureText(String(s)).width;
    if (_tw.size > 4000) _tw.clear();
    _tw.set(key, w);
  }
  return w;
}
function truncate(s, maxW, size, weight, fam) {
  s = String(s);
  if (textW(s, size, weight, fam) <= maxW) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (textW(s.slice(0, mid).trimEnd() + '…', size, weight, fam) <= maxW) lo = mid; else hi = mid - 1; }
  return lo ? s.slice(0, lo).trimEnd() + '…' : '…';
}

// ─── formatos es-MX ─────────────────────────────────────────────────
const NF0 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const NF1 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });
const NF2 = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sign = (n) => (n < 0 ? '−' : '');
function compactFor(prefix, suffix, maxAbs) {
  return (n) => {
    if (!n) return prefix + '0' + suffix;
    const a = Math.abs(n);
    if (maxAbs >= 1e6) return sign(n) + prefix + NF1.format(a / 1e6) + ' M' + suffix;
    if (maxAbs >= 1e4) return sign(n) + prefix + NF1.format(a / 1e3) + ' k' + suffix;
    return sign(n) + prefix + NF1.format(a) + suffix;
  };
}
const FORMATS = {
  number: { full: (n) => sign(n) + NF1.format(Math.abs(n)), axis: (m) => compactFor('', '', m) },
  money: {
    full: (n) => sign(n) + '$' + (Math.round(Math.abs(n) * 100) % 100 ? NF2 : NF0).format(Math.abs(n)),
    axis: (m) => compactFor('$', '', m)
  },
  percent: { full: (n) => sign(n) + NF1.format(Math.abs(n)) + '%', axis: () => (n) => sign(n) + NF0.format(Math.abs(n)) + '%' }
};
const kFrom1000 = (n) => (Math.abs(n) >= 1e3 && Math.abs(n) < 1e6 ? 1e4 : Math.abs(n));
FORMATS.money.compact = (n) => compactFor('$', '', kFrom1000(n))(n);
FORMATS.number.compact = (n) => compactFor('', '', kFrom1000(n))(n);
FORMATS.percent.compact = FORMATS.percent.full;
function resolveFormat(o) {
  const f = o.format;
  if (typeof f === 'function') {
    const ax = typeof o.axisFormat === 'function' ? o.axisFormat : f;
    return { full: f, axis: () => ax, compact: ax };
  }
  const F = FORMATS[f] || FORMATS.number;
  if (typeof o.axisFormat === 'function') return { full: F.full, axis: () => o.axisFormat, compact: o.axisFormat };
  return F;
}

// ─── fechas ─────────────────────────────────────────────────────────
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MON_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isMonth = (s) => /^\d{4}-\d{2}$/.test(s);
function pd(k) { const p = k.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2] || 1)); }
function labelMode(labels) {
  if (labels.length && labels.every(isDay)) return 'date';
  if (labels.length && labels.every(isMonth)) return 'month';
  return 'text';
}
function multiYear(labels) { return labels.length > 1 && labels[0].slice(0, 4) !== labels[labels.length - 1].slice(0, 4); }
// Etiqueta corta para ejes.
function tickText(labels, i, mode, short) {
  const k = labels[i];
  if (mode === 'date') { const d = pd(k); return short ? cap(DOW[d.getUTCDay()]) + ' ' + d.getUTCDate() : d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; }
  if (mode === 'month') {
    const d = pd(k), m = MON[d.getUTCMonth()];
    return (i === 0 || d.getUTCMonth() === 0) && multiYear(labels) ? m + ' ' + String(d.getUTCFullYear()).slice(2) : m;
  }
  return k;
}
// Etiqueta completa para tooltip / lector de pantalla.
function longText(labels, i, mode) {
  const k = labels[i];
  if (mode === 'date') { const d = pd(k); return cap(DOW[d.getUTCDay()]) + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + (multiYear(labels) ? ' ' + d.getUTCFullYear() : ''); }
  if (mode === 'month') { const d = pd(k); return cap(MON_L[d.getUTCMonth()]) + ' ' + d.getUTCFullYear(); }
  return k;
}

// ─── escala "bonita" para el eje Y (3–5 líneas guía, el menor desperdicio arriba) ───
function niceTicks(lo, hi, count, integer) {
  if (!(hi > lo)) { hi = lo + (Math.abs(lo) || 1); }
  const span = hi - lo, e0 = Math.floor(Math.log10(span / 4)) - 1;
  let best = null;
  for (let e = e0; e <= e0 + 3; e++) {
    [1, 2, 2.5, 4, 5].forEach((m) => {
      const step = m * Math.pow(10, e);
      if (integer && (step < 1 || step % 1)) return;
      const a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step, k = Math.round((b - a) / step);
      if (k < 2 || k > 4) return; // 3 a 5 líneas
      const score = (b - a - span) / (b - a) + 0.04 * Math.abs(k - count) + (m === 4 ? 0.02 : 0) + 0.001 * k; // empate → menos líneas
      if (!best || score < best.score - 1e-9) best = { a, b, step, score };
    });
  }
  if (!best) { const step = Math.max(integer ? 1 : 0, span / count) || 1; best = { a: lo, b: lo + step * count, step }; }
  const ticks = [];
  for (let v = best.a; v <= best.b + best.step / 2; v += best.step) ticks.push(Math.abs(v) < best.step / 1e6 ? 0 : +v.toPrecision(12));
  return { lo: best.a, hi: best.b, ticks };
}

// ─── curva monótona (Fritsch–Carlson): suave sin rebasar los datos ──
function smoothPath(pts) {
  const n = pts.length;
  if (!n) return '';
  if (n === 1) return 'M' + r1(pts[0][0]) + ',' + r1(pts[0][1]);
  if (n === 2) return 'M' + r1(pts[0][0]) + ',' + r1(pts[0][1]) + 'L' + r1(pts[1][0]) + ',' + r1(pts[1][1]);
  const dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = dx[i] ? (pts[i + 1][1] - pts[i][1]) / dx[i] : 0; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) t[i] = 0;
    else t[i] = (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  }
  let d = 'M' + r1(pts[0][0]) + ',' + r1(pts[0][1]);
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += 'C' + r1(pts[i][0] + h) + ',' + r1(pts[i][1] + t[i] * h) + ' ' + r1(pts[i + 1][0] - h) + ',' + r1(pts[i + 1][1] - t[i + 1] * h) + ' ' + r1(pts[i + 1][0]) + ',' + r1(pts[i + 1][1]);
  }
  return d;
}
function runs(xs, ys) { // tramos contiguos (los null cortan la línea)
  const out = []; let cur = [];
  for (let i = 0; i < xs.length; i++) {
    if (ys[i] == null) { if (cur.length) out.push(cur); cur = []; } else cur.push([xs[i], ys[i]]);
  }
  if (cur.length) out.push(cur);
  return out;
}
// Barra con extremo de datos redondeado (4px) y base recta.
function barPath(x0, x1, base, end, horizontal) {
  const len = Math.abs(end - base);
  if (len < 0.5) return '';
  const th = Math.abs(x1 - x0), r = Math.min(4, th / 2, len);
  if (!horizontal) {
    const up = end < base, e = end, k = up ? r : -r;
    return 'M' + r1(x0) + ',' + r1(base) + 'V' + r1(e + k) + 'Q' + r1(x0) + ',' + r1(e) + ' ' + r1(x0 + r) + ',' + r1(e) + 'H' + r1(x1 - r) + 'Q' + r1(x1) + ',' + r1(e) + ' ' + r1(x1) + ',' + r1(e + k) + 'V' + r1(base) + 'Z';
  }
  const right = end > base, k = right ? -r : r; // x0/x1 = arriba/abajo
  return 'M' + r1(base) + ',' + r1(x0) + 'H' + r1(end + k) + 'Q' + r1(end) + ',' + r1(x0) + ' ' + r1(end) + ',' + r1(x0 + r) + 'V' + r1(x1 - r) + 'Q' + r1(end) + ',' + r1(x1) + ' ' + r1(end + k) + ',' + r1(x1) + 'H' + r1(base) + 'Z';
}
function arcPath(cx, cy, r0, r1_, a0, a1) {
  const pt = (r, a) => r1(cx + r * Math.cos(a)) + ',' + r1(cy + r * Math.sin(a));
  if (a1 - a0 >= Math.PI * 2 - 1e-4) { // anillo completo
    const m = a0 + Math.PI;
    return 'M' + pt(r1_, a0) + 'A' + r1_ + ',' + r1_ + ' 0 1 1 ' + pt(r1_, m) + 'A' + r1_ + ',' + r1_ + ' 0 1 1 ' + pt(r1_, a0) +
      'ZM' + pt(r0, a0) + 'A' + r0 + ',' + r0 + ' 0 1 0 ' + pt(r0, m) + 'A' + r0 + ',' + r0 + ' 0 1 0 ' + pt(r0, a0) + 'Z';
  }
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return 'M' + pt(r1_, a0) + 'A' + r1_ + ',' + r1_ + ' 0 ' + large + ' 1 ' + pt(r1_, a1) + 'L' + pt(r0, a1) + 'A' + r0 + ',' + r0 + ' 0 ' + large + ' 0 ' + pt(r0, a0) + 'Z';
}

// ─── color ──────────────────────────────────────────────────────────
function rgbOf(c) {
  const x = ctx2d(); x.fillStyle = '#000'; x.fillStyle = c; const s = x.fillStyle;
  if (s[0] === '#') return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const m = s.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
}
const toLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const toSrgb = (c) => { c = clamp(c, 0, 1); return Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255); };
function oklab(rgb) {
  const [r, g, b] = rgb.map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function fromOklab([L, a, b]) {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map(toSrgb);
  return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
}
// Rampa secuencial de un solo tono (interpolación en OKLab entre 3 paradas).
function ramp(stops) {
  const labs = stops.map((c) => oklab(rgbOf(c)));
  return (t) => {
    t = clamp(t, 0, 1);
    const seg = t < 0.5 ? 0 : 1, k = seg ? (t - 0.5) * 2 : t * 2, A = labs[seg], B = labs[seg + 1];
    return fromOklab([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k]);
  };
}

// ─── tokens de tema (se leen con getComputedStyle en cada dibujo) ───
function readTokens(el) {
  const cs = getComputedStyle(el);
  const v = (n, fb) => (cs.getPropertyValue(n) || '').trim() || fb;
  return {
    cs,
    series: [1, 2, 3, 4, 5, 6].map((i) => v('--chart-' + i, ['#B28C39', '#00839B', '#A45032', '#644994', '#365F19', '#8E4367'][i - 1])),
    muted: v('--chart-muted', '#CEC6B7'),
    grid: v('--chart-grid', '#EFEBE4'),
    axis: v('--chart-axis', '#D6CFC2'),
    text: v('--text', '#15130F'), text2: v('--text-2', '#5B554A'), text3: v('--text-3', '#8C8577'),
    surface: v('--chart-surface', v('--surface', '#FFFFFF')),
    brand: v('--brand', '#C49A3C'),
    seq: [v('--chart-seq-0', '#F6EEDC'), v('--chart-seq-1', '#C49A3C'), v('--chart-seq-2', '#5C430F')],
    empty: v('--chart-empty', '#F4F1EB'),
    areaOp: +v('--chart-area-opacity', '0.18') || 0.18,
    font: cs.fontFamily || 'system-ui, sans-serif',
    disp: v('--disp', '') || cs.fontFamily || 'system-ui, sans-serif'
  };
}
function resolveColor(c, i, t) {
  if (c == null || c === '') return i < t.series.length ? t.series[i] : t.muted;
  if (typeof c === 'number') return t.series[clamp(Math.round(c) - 1, 0, t.series.length - 1)];
  c = String(c).trim();
  if (c === 'muted') return t.muted;
  if (/^[a-z][a-z0-9-]*$/i.test(c) && t.cs.getPropertyValue('--' + c).trim()) return t.cs.getPropertyValue('--' + c).trim(); // 'brand', 'info', 'ok'…
  const m = c.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/);
  if (m) return t.cs.getPropertyValue(m[1]).trim() || (m[2] || '').trim() || t.series[0];
  if (c.slice(0, 2) === '--') return t.cs.getPropertyValue(c).trim() || t.series[0];
  return c;
}

// ─── estilos (una sola vez) ─────────────────────────────────────────
const LIGHT = '--chart-1:#B28C39;--chart-2:#00839B;--chart-3:#A45032;--chart-4:#644994;--chart-5:#365F19;--chart-6:#8E4367;' +
  '--chart-muted:#CEC6B7;--chart-grid:#EFEBE4;--chart-axis:#D6CFC2;--chart-seq-0:#F6EEDC;--chart-seq-1:#C49A3C;--chart-seq-2:#5C430F;' +
  '--chart-empty:#F4F1EB;--chart-area-opacity:.18;--chart-surface:var(--surface,#fff);';
const DARK = '--chart-1:#B58F3C;--chart-2:#1896AD;--chart-3:#A84D2B;--chart-4:#725AAE;--chart-5:#3A732C;--chart-6:#A8547C;' +
  '--chart-muted:#4A443A;--chart-grid:#27231D;--chart-axis:#3A352D;--chart-seq-0:#2E291F;--chart-seq-1:#9C7A2F;--chart-seq-2:#EDD08A;' +
  '--chart-empty:#24211B;--chart-area-opacity:.22;--chart-surface:var(--surface,#191713);';
const CSS =
  ':where(:root){' + LIGHT + '}' +
  '@media (prefers-color-scheme:dark){:where(:root:not([data-theme="light"])){' + DARK + '}}' +
  ':where(:root[data-theme="dark"]){' + DARK + '}' +
  '.tbc{position:relative;width:100%;min-width:0;color:var(--text);-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}' +
  '.tbc svg{display:block;overflow:visible;max-width:100%}' +
  '.tbc text{font-family:inherit}' +
  '.tbc-plot{position:relative;border-radius:10px;touch-action:pan-y;outline:none}' +
  '.tbc-plot:focus-visible{outline:2.5px solid var(--brand);outline-offset:4px}' +
  '.tbc-tick{font-size:11px;fill:var(--text-3);font-variant-numeric:tabular-nums}' +
  '.tbc-val{font-size:11.5px;font-weight:600;fill:var(--text-2);font-variant-numeric:tabular-nums}' +
  '.tbc-name{font-size:12.5px;fill:var(--text-2)}' +
  '.tbc-ann{transition:opacity .25s ease}' +
  '.tbc-marks path,.tbc-marks rect{transition:opacity .15s ease}' +
  '.tbc-legend{display:flex;flex-wrap:wrap;gap:4px 16px;margin:0 0 10px;font-size:12.5px;color:var(--text-2);line-height:1.3}' +
  '.tbc-li{display:inline-flex;align-items:center;gap:7px;min-height:26px;padding:0;margin:0;background:none;border:0;border-radius:6px;color:inherit;font:inherit;cursor:pointer;transition:opacity .15s}' +
  '.tbc-li[aria-pressed="false"]{opacity:.45}.tbc-li[aria-pressed="false"] .tbc-key{background:transparent!important;box-shadow:inset 0 0 0 1.5px var(--text-3)}' +
  '.tbc-li:focus-visible{outline:2px solid var(--brand);outline-offset:2px}' +
  '.tbc-key{display:inline-block;width:14px;height:3px;border-radius:2px;flex:none}' +
  '.tbc-key.sq{width:10px;height:10px;border-radius:3px}' +
  '.tbc-tip{position:absolute;z-index:6;left:0;top:0;pointer-events:none;min-width:112px;max-width:min(260px,90%);padding:9px 11px 9px;background:var(--surface);border:1px solid var(--border-strong,rgba(0,0,0,.14));border-radius:11px;box-shadow:var(--shadow-2,0 6px 20px rgba(0,0,0,.1));font-size:12.5px;line-height:1.35;opacity:0;visibility:hidden;transform:translateY(3px);transition:opacity .12s ease,transform .12s ease,visibility 0s linear .12s}' +
  '.tbc-tip.on{opacity:1;visibility:visible;transform:none;transition:opacity .12s ease,transform .12s ease}' +
  '.tbc-tt{font-size:11.5px;font-weight:500;color:var(--text-3);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
  '.tbc-tr{display:flex;align-items:center;gap:8px;white-space:nowrap;min-width:0}.tbc-tr+.tbc-tr{margin-top:3px}' +
  '.tbc-tv{font-weight:600;color:var(--text);font-variant-numeric:tabular-nums}' +
  '.tbc-tn{color:var(--text-2);overflow:hidden;text-overflow:ellipsis;min-width:0}' +
  '.tbc-tk{width:12px;height:3px;border-radius:2px;flex:none}.tbc-tk.sq{width:9px;height:9px;border-radius:3px}' +
  '.tbc-sr{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important;border:0!important}' +
  '.tbc-dw{display:flex;align-items:center;gap:28px}.tbc-dw.narrow{flex-direction:column;align-items:stretch;gap:16px}' +
  '.tbc-dw .tbc-plot{flex:none;margin:0 auto;border-radius:50%}' +
  '.tbc-dl{flex:1;min-width:0;display:grid;gap:2px;align-content:center}' +
  '.tbc-dr{display:grid;grid-template-columns:10px minmax(0,1fr) auto 44px;align-items:center;gap:10px;min-height:34px;padding:4px 8px;margin:0 -8px;border-radius:8px;font-size:13.5px;cursor:default;transition:background .12s,opacity .15s}' +
  '.tbc-dr.on{background:var(--muted-soft,rgba(0,0,0,.05))}.tbc-dl.dim .tbc-dr:not(.on){opacity:.5}' +
  '.tbc-dn{color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
  '.tbc-dv{color:var(--text);font-weight:600;font-variant-numeric:tabular-nums;text-align:right}' +
  '.tbc-dp{color:var(--text-3);font-size:12.5px;font-variant-numeric:tabular-nums;text-align:right}' +
  '.tbc-scale{display:flex;align-items:center;justify-content:space-between;gap:8px 14px;flex-wrap:wrap;margin-top:10px;font-size:12px;color:var(--text-3)}' +
  '.tbc-scale b{font-weight:600;color:var(--text-2)}' +
  '.tbc-ramp{display:inline-flex;align-items:center;gap:6px}.tbc-ramp i{display:block;width:14px;height:10px;border-radius:3px}' +
  '.tbc-empty{fill:var(--text-3);font-size:13px}' +
  '@media (prefers-reduced-motion:reduce){.tbc-tip,.tbc-ann,.tbc-marks path,.tbc-marks rect{transition:none!important}}';
function injectStyles() {
  if (document.getElementById('tbc-style')) return;
  const s = document.createElement('style'); s.id = 'tbc-style'; s.textContent = CSS;
  document.head.appendChild(s);
}

// ─── cableado global: tema, fuentes, toques fuera ───────────────────
let wired = false;
function themeSig() { const cs = getComputedStyle(document.documentElement); return ['--surface', '--text', '--chart-1', '--brand'].map((n) => cs.getPropertyValue(n).trim()).join('|'); }
function redrawAll() { live.forEach((c) => { if (c.stopAnim) c.dirty = true; else c.redraw(); }); }
function wireGlobal() {
  if (wired) return; wired = true;
  let sig = themeSig();
  const check = () => requestAnimationFrame(() => { const s = themeSig(); if (s !== sig) { sig = s; redrawAll(); } });
  if (window.MutationObserver) new MutationObserver(check).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  if (mq) { if (mq.addEventListener) mq.addEventListener('change', check); else if (mq.addListener) mq.addListener(check); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { _tw.clear(); redrawAll(); });
  document.addEventListener('pointerdown', (e) => live.forEach((c) => { if (c.active != null && !c.root.contains(e.target)) c.setActive(null); }), true);
}

function tween(dur, frame, done) {
  const t0 = performance.now(); let raf = 0, stopped = false;
  const finish = () => { if (stopped) return; stopped = true; cancelAnimationFrame(raf); clearTimeout(safety); frame(1); if (done) done(); };
  // el timestamp de rAF puede ser anterior a t0 (inicio del frame): acotar a [0, 1]
  const step = (now) => { if (stopped) return; const k = clamp((now - t0) / dur, 0, 1); if (k >= 1) finish(); else { frame(k); raf = requestAnimationFrame(step); } };
  frame(0);
  raf = requestAnimationFrame(step);
  const safety = setTimeout(finish, dur + 400); // pestañas en segundo plano: nunca dejar la gráfica a medias
  return () => { if (!stopped) { stopped = true; cancelAnimationFrame(raf); clearTimeout(safety); } };
}

// ════════════════════════════════════════════════════════════════════
//  Base
// ════════════════════════════════════════════════════════════════════
class Chart {
  constructor(el, opts, kind) {
    if (!el) throw new Error('charts: falta el contenedor');
    injectStyles(); wireGlobal();
    this.el = el; this.kind = kind; this.uid = 'tbc' + (++UID);
    this.opts = this.normalize(Object.assign({}, opts));
    this.active = null; this.geo = null; this.w = 0; this.stopAnim = null; this.dirty = false; this.drawn = false;
    this.offs = [];
    el.textContent = '';
    const root = this.root = div('tbc tbc-' + kind);
    this.plot = div('tbc-plot'); this.plot.tabIndex = 0; this.plot.setAttribute('role', 'group');
    this.tip = div('tbc-tip'); this.tip.setAttribute('aria-hidden', 'true');
    this.liveEl = div('tbc-sr'); this.liveEl.setAttribute('aria-live', 'polite');
    this.table = div('tbc-sr', 'table');
    this.mount(root);
    root.appendChild(this.tip); root.appendChild(this.liveEl); root.appendChild(this.table);
    el.appendChild(root);
    this.bind();
    if (window.ResizeObserver) { this.ro = new ResizeObserver(() => this.onResize()); this.ro.observe(root); }
    else this.on(window, 'resize', () => this.onResize());
    live.add(this);
    this.render(true, false);
  }
  mount(root) { root.appendChild(this.plot); }
  on(t, type, fn, o) { t.addEventListener(type, fn, o); this.offs.push(() => t.removeEventListener(type, fn, o)); }
  onResize() {
    if (!this.root.isConnected) { this.destroy(); return; }
    const w = Math.round(this.root.clientWidth);
    if (w && w !== this.w) this.render(!this.drawn, false);
  }
  update(opts) { this.opts = this.normalize(Object.assign({}, this.opts, opts)); this.render(true, true); return this; }
  redraw() { if (!this.root.isConnected) { this.destroy(); return; } this.dirty = false; this.render(false, false); }
  destroy() {
    if (this.dead) return; this.dead = true;
    if (this.stopAnim) this.stopAnim();
    if (this.ro) this.ro.disconnect();
    this.offs.forEach((f) => f()); live.delete(this);
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
  }
  render(animate, morph) {
    if (this.dead) return;
    const w = Math.round(this.root.clientWidth);
    if (!w) return; // oculto: ResizeObserver avisará cuando tenga ancho
    this.w = w;
    if (this.stopAnim) { this.stopAnim(); this.stopAnim = null; }
    this.active = null; this.hideTip();
    this.t = readTokens(this.root);
    this.F = resolveFormat(this.opts);
    const prev = this.geo;
    const geo = this.geo = this.layout(w);
    this.drawStatic(geo);
    if (this.legendUI) this.legendUI(geo);
    this.svg = this.plot.querySelector('svg');
    const from = morph && prev && !prev.empty && !geo.empty && this.canMorph(prev, geo) ? prev : null;
    const anim = animate && !geo.empty && !reduceMotion();
    this.drawn = true;
    if (anim) {
      this.stopAnim = tween(from ? 520 : this.duration(), (k) => this.frame(k, from), () => { this.stopAnim = null; if (this.dirty) this.redraw(); });
    } else this.frame(1, null);
    this.a11y(geo);
  }
  duration() { return 700; }
  canMorph() { return false; }
  // ── interacción ──
  bind() {
    const p = this.plot;
    const pos = (e) => {
      const svg = this.svg; if (!svg || !this.geo) return null;
      const r = svg.getBoundingClientRect(), k = this.geo.W / (r.width || 1);
      return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
    };
    this.on(p, 'pointerdown', (e) => {
      this.lastDown = Date.now();
      if (e.pointerType !== 'mouse') { this.touching = true; const q = pos(e); if (q) this.setActive(this.hit(q[0], q[1]), 'touch'); }
    });
    this.on(p, 'pointermove', (e) => {
      if (e.pointerType !== 'mouse' && !this.touching) return;
      const q = pos(e); if (q) this.setActive(this.hit(q[0], q[1]), e.pointerType === 'mouse' ? 'mouse' : 'touch');
    });
    this.on(p, 'pointerup', () => { this.touching = false; });
    this.on(p, 'pointercancel', () => { this.touching = false; this.setActive(null); });
    this.on(p, 'pointerleave', (e) => { if (e.pointerType === 'mouse') this.setActive(null); });
    this.on(p, 'focus', () => { if (Date.now() - (this.lastDown || 0) > 400 && this.geo && !this.geo.empty) this.setActive(this.firstKey(), 'kbd'); });
    this.on(p, 'blur', () => this.setActive(null));
    this.on(p, 'keydown', (e) => {
      if (!this.geo || this.geo.empty) return;
      if (e.key === 'Escape') { this.setActive(null); return; }
      const nk = this.nav(this.active == null ? null : this.active, e.key);
      if (nk !== undefined) { e.preventDefault(); this.setActive(nk, 'kbd'); }
    });
  }
  firstKey() { return 0; }
  setActive(key, src) {
    if (key === undefined) key = null;
    if (key === this.active && src !== 'kbd') return;
    this.active = key;
    this.paintActive(key);
    if (key == null) { this.hideTip(); return; }
    const info = this.tipInfo(key);
    if (!info) { this.hideTip(); return; }
    this.showTip(info, src);
    if (src === 'kbd') this.liveEl.textContent = info.title + ': ' + info.rows.map((r) => (r.name ? r.name + ' ' : '') + r.value).join(', ');
  }
  hideTip() { this.tip.classList.remove('on'); }
  showTip(info, src) {
    const tip = this.tip;
    tip.textContent = '';
    if (info.title) { const t = div('tbc-tt'); t.textContent = info.title; tip.appendChild(t); }
    info.rows.forEach((r) => {
      const row = div('tbc-tr');
      if (r.color) { const k = div('tbc-tk' + (r.square ? ' sq' : ''), 'span'); k.style.background = r.color; row.appendChild(k); }
      const v = div('tbc-tv', 'span'); v.textContent = r.value; row.appendChild(v);
      if (r.name) { const n = div('tbc-tn', 'span'); n.textContent = r.name; row.appendChild(n); }
      tip.appendChild(row);
    });
    // posición en px del contenedor
    const svgR = this.svg.getBoundingClientRect(), rootR = this.root.getBoundingClientRect();
    const k = svgR.width / (this.geo.W || 1), ox = svgR.left - rootR.left, oy = svgR.top - rootR.top;
    const tw = tip.offsetWidth, th = tip.offsetHeight, RW = rootR.width;
    const ax = ox + info.x * k, ay = oy + info.y * k;
    const gapX = src === 'touch' ? 26 : 14;
    let left, top;
    if (info.side) { // a un lado de la línea guía, alineado arriba
      left = ax + gapX; if (left + tw > RW) left = ax - gapX - tw;
      if (left < 0) left = clamp(ax - tw / 2, 0, RW - tw);
      top = ay;
    } else { // centrado sobre la marca; si no cabe arriba, abajo
      left = clamp(ax - tw / 2, 0, Math.max(0, RW - tw));
      top = ay - th - (src === 'touch' ? 18 : 10);
      if (top < -oy - 6 && info.y2 != null) top = oy + info.y2 * k + 10;
    }
    tip.style.left = Math.round(left) + 'px'; tip.style.top = Math.round(top) + 'px';
    tip.classList.add('on');
  }
  svgOpen(W, H, summary) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(summary) +
      '" style="width:100%;height:auto;aspect-ratio:' + W + '/' + H + ';font-family:' + esc(this.t.font) + '"><title>' + esc(summary) + '</title>';
  }
  a11y(geo) {
    const name = this.opts.label || this.defaultName();
    this.plot.setAttribute('aria-label', name + '. Usa las flechas para recorrer los valores.');
    // tabla equivalente para lectores de pantalla
    const tb = this.table; tb.textContent = '';
    const data = this.tableData(geo);
    if (!data) return;
    const cap_ = document.createElement('caption'); cap_.textContent = name; tb.appendChild(cap_);
    const thead = document.createElement('thead'), hr = document.createElement('tr');
    data.head.forEach((h) => { const th = document.createElement('th'); th.scope = 'col'; th.textContent = h; hr.appendChild(th); });
    thead.appendChild(hr); tb.appendChild(thead);
    const tbody = document.createElement('tbody');
    data.rows.forEach((r) => {
      const tr = document.createElement('tr');
      r.forEach((c, j) => { const td = document.createElement(j ? 'td' : 'th'); if (!j) td.scope = 'row'; td.textContent = c; tr.appendChild(td); });
      tbody.appendChild(tr);
    });
    tb.appendChild(tbody);
  }
  emptySvg(W, H, msg) {
    return this.svgOpen(W, H, msg) + '<text class="tbc-empty" x="' + W / 2 + '" y="' + H / 2 + '" text-anchor="middle" dominant-baseline="middle">' + esc(msg) + '</text></svg>';
  }
}

// ════════════════════════════════════════════════════════════════════
//  Línea / área
// ════════════════════════════════════════════════════════════════════
class LineChart extends Chart {
  normalize(o) {
    const labels = (o.labels || []).map(String);
    const series = (o.series || []).map((s, i) => ({ name: s && s.name != null ? String(s.name) : 'Serie ' + (i + 1), values: ((s && s.values) || []).map(num), color: s && s.color }));
    if (this.hidden) { for (const i of Array.from(this.hidden)) if (i >= series.length) this.hidden.delete(i); }
    else this.hidden = new Set();
    return Object.assign({}, o, { labels, series });
  }
  mount(root) { this.legendEl = div('tbc-legend'); root.appendChild(this.legendEl); root.appendChild(this.plot); }
  defaultName() { return this.opts.series.length === 1 ? this.opts.series[0].name : 'Gráfica de líneas'; }
  layout(W) {
    const o = this.opts, t = this.t, F = this.F, n = o.labels.length, fam = t.font;
    const H = Math.round(o.height || clamp(W * 0.42, 200, 280));
    const vis = o.series.map((s, i) => i).filter((i) => !this.hidden.has(i));
    const vals = [];
    vis.forEach((i) => o.series[i].values.forEach((v, j) => { if (v != null && j < n) vals.push(v); }));
    const mode = labelMode(o.labels);
    const geo = { W, H, n, mode, empty: !n || !vals.length };
    if (geo.empty) return geo;
    const lo0 = o.min != null ? o.min : Math.min(0, minOf(vals)), hi0 = o.max != null ? o.max : maxOf(vals);
    const single = vis.length === 1;
    const padT = single ? 24 : 12, padB = 28;
    const nt = niceTicks(lo0, hi0, H - padT - padB < 150 ? 3 : 4, vals.every((v) => v === Math.round(v)) && hi0 - lo0 < 12);
    const axisFmt = F.axis(Math.max(Math.abs(nt.lo), Math.abs(nt.hi)));
    const yl = nt.ticks.map((v) => axisFmt(v));
    const padL = Math.ceil(maxOf(yl.map((s) => textW(s, 11, 400, fam)))) + 12, padR = 12;
    const pw = W - padL - padR, ph = H - padT - padB;
    const x = (i) => padL + (n > 1 ? (i * pw) / (n - 1) : pw / 2);
    const y = (v) => padT + ph - ((v - nt.lo) / (nt.hi - nt.lo)) * ph;
    const xs = o.labels.map((_, i) => x(i));
    const series = vis.map((i) => {
      const s = o.series[i], color = resolveColor(s.color, i, t);
      const vv = o.labels.map((_, j) => (s.values[j] == null ? null : s.values[j]));
      return { idx: i, name: s.name, color, vals: vv, ys: vv.map((v) => (v == null ? null : y(v))), area: o.area != null ? !!o.area : o.series.length === 1 };
    });
    // marcas del eje X: sin amontonar (≥ 14px entre etiquetas), la más reciente siempre visible
    const txt = o.labels.map((_, i) => tickText(o.labels, i, mode));
    const lw = maxOf(txt.map((s) => textW(s, 11, 400, fam)));
    const per = n > 1 ? pw / (n - 1) : pw;
    const need = Math.max(1, Math.ceil((lw + 14) / per));
    const steps = mode === 'date' ? [1, 2, 3, 7, 14, 28, 56, 91, 182, 364] : mode === 'month' ? [1, 2, 3, 4, 6, 12, 24] : null;
    const step = steps ? steps.find((s) => s >= need) || need : need;
    let xt = [];
    if (mode === 'text') for (let i = 0; i < n; i += step) xt.push(i);
    else for (let i = n - 1; i >= 0; i -= step) xt.unshift(i);
    xt = xt.map((i) => { const w_ = textW(txt[i], 11, 400, fam); return { i, s: txt[i], w: w_, left: clamp(xs[i] - w_ / 2, 0, W - w_) }; });
    for (let j = xt.length - 1; j > 0; j--) if (xt[j - 1].left + xt[j - 1].w + 8 > xt[j].left) xt.splice(mode === 'text' ? j : j - 1, 1);
    const base = y(clamp(0, nt.lo, nt.hi));
    return Object.assign(geo, { padL, padR, padT, padB, pw, ph, xs, y, nt, yl, series, xt, base, single, per });
  }
  drawStatic(g) {
    const t = this.t, o = this.opts;
    if (g.empty) { this.plot.innerHTML = this.emptySvg(g.W, g.H, o.emptyText || 'Sin datos para este periodo'); return; }
    let s = this.svgOpen(g.W, g.H, this.summary(g)) + '<defs><clipPath id="' + this.uid + '-c"><rect x="0" y="0" width="' + g.W + '" height="' + g.H + '"/></clipPath>';
    g.series.forEach((se) => {
      if (se.area) s += '<linearGradient id="' + this.uid + '-a' + se.idx + '" gradientUnits="userSpaceOnUse" x1="0" y1="' + g.padT + '" x2="0" y2="' + g.base + '"><stop offset="0" stop-color="' + esc(se.color) + '" stop-opacity="' + t.areaOp + '"/><stop offset="1" stop-color="' + esc(se.color) + '" stop-opacity="0"/></linearGradient>';
    });
    s += '</defs><g>';
    g.nt.ticks.forEach((v, i) => {
      const yy = r1(g.y(v)) + 0.5;
      s += '<line x1="' + g.padL + '" x2="' + (g.W - g.padR) + '" y1="' + yy + '" y2="' + yy + '" stroke="' + esc(v === 0 ? t.axis : t.grid) + '" stroke-width="1" shape-rendering="crispEdges"/>';
      s += '<text class="tbc-tick" x="' + (g.padL - 10) + '" y="' + yy + '" text-anchor="end" dominant-baseline="middle">' + esc(g.yl[i]) + '</text>';
    });
    g.xt.forEach((tk) => { s += '<text class="tbc-tick" x="' + r1(tk.left) + '" y="' + (g.H - 8) + '">' + esc(tk.s) + '</text>'; });
    s += '</g><g class="tbc-marks" clip-path="url(#' + this.uid + '-c)"></g><g class="tbc-ann"></g>';
    s += '<g class="tbc-hover" style="display:none"><line y1="' + g.padT + '" y2="' + (g.padT + g.ph) + '" stroke="' + esc(t.text3) + '" stroke-opacity=".55" stroke-width="1"/>';
    g.series.forEach((se) => { s += '<circle r="4.5" fill="' + esc(se.color) + '" stroke="' + esc(t.surface) + '" stroke-width="2"/>'; });
    s += '</g></svg>';
    this.plot.innerHTML = s;
    const svg = this.plot.firstChild;
    this.gMarks = svg.querySelector('.tbc-marks'); this.gAnn = svg.querySelector('.tbc-ann'); this.gHover = svg.querySelector('.tbc-hover');
    this.clip = svg.querySelector('clipPath rect');
  }
  legendUI() {
    const o = this.opts, L = this.legendEl;
    L.textContent = '';
    L.hidden = o.series.length < 2;
    if (L.hidden) return;
    o.series.forEach((s, i) => {
      const b = div('tbc-li', 'button'); b.type = 'button';
      b.setAttribute('aria-pressed', String(!this.hidden.has(i)));
      const k = div('tbc-key', 'span'); k.style.background = resolveColor(s.color, i, this.t);
      const n = div('', 'span'); n.textContent = s.name;
      b.appendChild(k); b.appendChild(n);
      b.title = this.hidden.has(i) ? 'Mostrar ' + s.name : 'Ocultar ' + s.name;
      b.addEventListener('click', () => {
        if (this.hidden.has(i)) this.hidden.delete(i);
        else if (o.series.length - this.hidden.size > 1) this.hidden.add(i);
        else return;
        this.render(true, true);
      });
      L.appendChild(b);
    });
  }
  canMorph(a, b) { return a.n === b.n; }
  frame(k, from) {
    const g = this.geo, t = this.t; if (g.empty) return;
    const e = from ? easeInOut(k) : easeOut(k);
    let s = '';
    g.series.forEach((se) => {
      let ys = se.ys;
      const f = from && from.series.find((q) => q.idx === se.idx);
      if (f) ys = ys.map((yy, j) => (yy == null || f.ys[j] == null ? yy : f.ys[j] + (yy - f.ys[j]) * e));
      const segs = runs(g.xs, ys);
      if (se.area) segs.forEach((seg) => { if (seg.length > 1) s += '<path d="' + smoothPath(seg) + 'L' + r1(seg[seg.length - 1][0]) + ',' + r1(g.base) + 'L' + r1(seg[0][0]) + ',' + r1(g.base) + 'Z" fill="url(#' + this.uid + '-a' + se.idx + ')"' + (from && !f ? ' opacity="' + e + '"' : '') + '/>'; });
      segs.forEach((seg) => {
        s += seg.length > 1
          ? '<path d="' + smoothPath(seg) + '" fill="none" stroke="' + esc(se.color) + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' + (from && !f ? ' opacity="' + e + '"' : '') + '/>'
          : '<circle cx="' + r1(seg[0][0]) + '" cy="' + r1(seg[0][1]) + '" r="3" fill="' + esc(se.color) + '"/>';
      });
    });
    this.gMarks.innerHTML = s;
    this.clip.setAttribute('width', from ? g.W : r1(g.padL + g.pw * e + g.padR * (k >= 1 ? 1 : 0) + (k >= 1 ? 8 : 2)));
    // anotaciones selectivas: punto final de cada serie + máximo (una sola serie)
    if (k >= 1) {
      let a = '';
      g.series.forEach((se) => {
        let j = se.ys.length - 1; while (j >= 0 && se.ys[j] == null) j--;
        if (j >= 0) a += '<circle cx="' + r1(g.xs[j]) + '" cy="' + r1(se.ys[j]) + '" r="4" fill="' + esc(se.color) + '" stroke="' + esc(t.surface) + '" stroke-width="2"/>';
      });
      if (g.single && g.n > 2) {
        const se = g.series[0]; let mi = -1;
        se.vals.forEach((v, j) => { if (v != null && (mi < 0 || v > se.vals[mi])) mi = j; });
        const last = se.vals.length - 1;
        if (mi >= 0 && se.vals[mi] > 0) {
          const txt = this.F.full(se.vals[mi]), tw = textW(txt, 11.5, 600, t.font);
          const cx = g.xs[mi], cy = se.ys[mi];
          const left = clamp(cx - tw / 2, g.padL, g.W - tw);
          if (mi !== last) a += '<circle cx="' + r1(cx) + '" cy="' + r1(cy) + '" r="3" fill="' + esc(t.surface) + '" stroke="' + esc(se.color) + '" stroke-width="2"/>';
          a += '<text class="tbc-val" x="' + r1(left) + '" y="' + r1(cy - 10) + '">' + esc(txt) + '</text>';
        }
      }
      this.gAnn.innerHTML = a;
      this.gAnn.style.opacity = '1';
    } else { this.gAnn.style.opacity = '0'; }
  }
  duration() { return 900; }
  hit(x) { const g = this.geo; if (!g || g.empty) return null; return clamp(Math.round((x - g.padL) / (g.n > 1 ? g.pw / (g.n - 1) : 1)), 0, g.n - 1); }
  firstKey() { return this.geo.n - 1; }
  nav(cur, key) {
    const n = this.geo.n;
    if (key === 'ArrowRight' || key === 'ArrowUp') return cur == null ? n - 1 : Math.min(n - 1, cur + 1);
    if (key === 'ArrowLeft' || key === 'ArrowDown') return cur == null ? n - 1 : Math.max(0, cur - 1);
    if (key === 'Home') return 0;
    if (key === 'End') return n - 1;
    return undefined;
  }
  paintActive(i) {
    const g = this.geo, h = this.gHover; if (!h || g.empty) return;
    if (i == null) { h.style.display = 'none'; return; }
    h.style.display = '';
    const x = r1(g.xs[i]) + 0.5, line = h.firstChild; line.setAttribute('x1', x); line.setAttribute('x2', x);
    const dots = h.querySelectorAll('circle');
    g.series.forEach((se, j) => { const c = dots[j]; if (se.ys[i] == null) c.style.display = 'none'; else { c.style.display = ''; c.setAttribute('cx', r1(g.xs[i])); c.setAttribute('cy', r1(se.ys[i])); } });
  }
  tipInfo(i) {
    const g = this.geo, multi = this.opts.series.length > 1;
    const rows = g.series.map((se) => ({ color: se.color, value: se.vals[i] == null ? 'Sin dato' : this.F.full(se.vals[i]), name: multi || this.opts.series[0].name !== 'Serie 1' ? se.name : '' }));
    return { title: longText(this.opts.labels, i, g.mode), rows, x: g.xs[i], y: g.padT, side: true };
  }
  summary(g) {
    const o = this.opts, first = longText(o.labels, 0, g.mode), last = longText(o.labels, g.n - 1, g.mode);
    const parts = g.series.map((se) => {
      const idx = se.vals.map((v, j) => [v, j]).filter((p) => p[0] != null);
      if (!idx.length) return se.name + ': sin datos';
      const mx = idx.reduce((a, b) => (b[0] > a[0] ? b : a)), mn = idx.reduce((a, b) => (b[0] < a[0] ? b : a)), lt = idx[idx.length - 1];
      return se.name + ': máximo ' + this.F.full(mx[0]) + ' (' + longText(o.labels, mx[1], g.mode) + '), mínimo ' + this.F.full(mn[0]) + ' (' + longText(o.labels, mn[1], g.mode) + '), último ' + this.F.full(lt[0]);
    });
    return (o.label || 'Gráfica de líneas') + ', del ' + first + ' al ' + last + '. ' + parts.join('. ') + '.';
  }
  tableData(g) {
    if (g.empty) return null;
    const o = this.opts;
    return { head: [g.mode === 'text' ? '' : 'Fecha'].concat(o.series.map((s) => s.name)), rows: o.labels.map((_, i) => [longText(o.labels, i, g.mode)].concat(o.series.map((s) => (s.values[i] == null ? '—' : this.F.full(s.values[i]))))) };
  }
}

// ════════════════════════════════════════════════════════════════════
//  Barras (verticales o horizontales para rankings)
// ════════════════════════════════════════════════════════════════════
class BarChart extends Chart {
  normalize(o) {
    const labels = (o.labels || []).map(String);
    return Object.assign({}, o, { labels, values: labels.map((_, i) => num((o.values || [])[i])), highlight: o.highlight == null ? null : +o.highlight });
  }
  defaultName() { return this.opts.name || 'Gráfica de barras'; }
  layout(W) {
    return this.opts.horizontal ? this.layoutH(W) : this.layoutV(W);
  }
  colors() {
    const o = this.opts, t = this.t, main = resolveColor(o.color, 0, t);
    return o.labels.map((_, i) => (o.highlight != null && o.highlight >= 0 && i !== o.highlight ? t.muted : main));
  }
  layoutV(W) {
    const o = this.opts, t = this.t, F = this.F, fam = t.font, n = o.labels.length;
    const H = Math.round(o.height || clamp(W * 0.45, 200, 280));
    const vals = o.values.map((v) => v || 0);
    const geo = { W, H, n, mode: labelMode(o.labels), empty: !n || vals.every((v) => !v) && !o.values.some((v) => v === 0) };
    if (!n) return geo;
    const mode = geo.mode, short = mode === 'date' && n <= 8;
    const padT = 22;
    let padB = 28;
    const nt = niceTicks(Math.min(0, minOf(vals)), Math.max(0, maxOf(vals)), H - padT - padB < 150 ? 3 : 4, vals.every((v) => v === Math.round(v)) && maxOf(vals) < 12);
    // ¿caben todas las etiquetas de valor? (primero completas, luego compactas)
    let slot = (W - 8) / n, lab = vals.map((v) => F.full(v));
    let fits = lab.every((s) => textW(s, 11.5, 600, fam) + 6 <= slot);
    if (!fits && F.compact) { const c = vals.map((v) => F.compact(v)); if (c.every((s) => textW(s, 11.5, 600, fam) + 6 <= slot)) { lab = c; fits = true; } }
    let padL = 4, yl = null;
    if (!fits) { const ax = F.axis(Math.max(Math.abs(nt.lo), Math.abs(nt.hi))); yl = nt.ticks.map((v) => ax(v)); padL = Math.ceil(maxOf(yl.map((s) => textW(s, 11, 400, fam)))) + 12; }
    const padR = 4, pw = W - padL - padR;
    slot = pw / n;
    // etiquetas del eje X: completas; si no caben y son días de la semana, en dos renglones ("Jue" / "24"); si no, se adelgazan
    const txt = o.labels.map((_, i) => tickText(o.labels, i, mode, short));
    const lw = maxOf(txt.map((s) => textW(s, 11, 400, fam)));
    let step = Math.max(1, Math.ceil((lw + 10) / slot)), two = false;
    if (step > 1 && short && maxOf(txt.map((s) => maxOf(s.split(' ').map((p) => textW(p, 11, 400, fam))))) + 8 <= slot) { two = true; step = 1; padB = 42; }
    const ph = H - padT - padB;
    const bw = clamp(slot * 0.62, 3, 24);
    const y = (v) => padT + ph - ((v - nt.lo) / (nt.hi - nt.lo)) * ph, base = y(0);
    const cols = this.colors();
    const bars = vals.map((v, i) => { const cx = padL + slot * (i + 0.5); return { i, v, raw: o.values[i], cx, x0: cx - bw / 2, x1: cx + bw / 2, end: y(v), color: cols[i] }; });
    // etiquetas de valor: todas si caben; si no, sólo la destacada o la mayor
    let showLab;
    if (fits) showLab = bars.map(() => true);
    else { const key = o.highlight != null && o.highlight >= 0 && o.highlight < n ? o.highlight : vals.indexOf(maxOf(vals)); showLab = bars.map((b) => b.i === key); lab = vals.map((v) => F.full(v)); }
    const xt = [];
    for (let i = 0; i < n; i++) {
      if (mode !== 'text' ? (n - 1 - i) % step : i % step) continue;
      if (two) { xt.push({ i, lines: txt[i].split(' '), cx: bars[i].cx }); continue; }
      const s = step === 1 && lw + 4 > slot ? truncate(txt[i], slot - 4, 11, 400, fam) : txt[i];
      const w_ = textW(s, 11, 400, fam); xt.push({ i, s, left: clamp(bars[i].cx - w_ / 2, 0, W - w_) });
    }
    return Object.assign(geo, { padL, padR, padT, padB, pw, ph, slot, bw, base, nt, yl, bars, lab, showLab, xt, two, horizontal: false });
  }
  layoutH(W) {
    const o = this.opts, t = this.t, F = this.F, fam = t.font, n = o.labels.length;
    const vals = o.values.map((v) => Math.max(0, v || 0));
    const geo = { W, n, mode: labelMode(o.labels), empty: !n, horizontal: true };
    if (!n) { geo.H = 120; return geo; }
    const stacked = o.layout ? o.layout === 'stacked' : W < 480;
    const lab = vals.map((v, i) => F.full(o.values[i] == null ? 0 : o.values[i]));
    const valW = Math.ceil(maxOf(lab.map((s) => textW(s, 12, 600, fam))));
    const max = maxOf(vals) || 1;
    const cols = this.colors();
    const names = o.labels.map((_, i) => tickText(o.labels, i, geo.mode));
    let rowH, th, padL, pw, rows;
    if (stacked) {
      rowH = 46; th = 10; padL = 0; pw = W - 2;
      rows = vals.map((v, i) => {
        const top = i * rowH + 4, by = top + 24;
        return { i, v, top, x0: by, x1: by + th, len: (v / max) * pw, name: truncate(names[i], W - valW - 16, 13, 500, fam), ny: top + 13, color: cols[i] };
      });
    } else {
      rowH = 36; th = 14;
      const nameW = Math.min(Math.ceil(maxOf(names.map((s) => textW(s, 12.5, 400, fam)))), Math.round(W * 0.34));
      padL = nameW + 14; pw = W - padL - valW - 12;
      rows = vals.map((v, i) => {
        const top = i * rowH, cy = top + rowH / 2;
        return { i, v, top, x0: cy - th / 2, x1: cy + th / 2, len: (v / max) * pw, name: truncate(names[i], nameW, 12.5, 400, fam), ny: cy, color: cols[i] };
      });
    }
    const H = n * rowH + (stacked ? 4 : 2);
    return Object.assign(geo, { H, stacked, rowH, th, padL, pw, rows, lab, valW });
  }
  duration() { return this.opts.horizontal ? 750 : 700; }
  canMorph(a, b) { return a.n === b.n && a.horizontal === b.horizontal && a.stacked === b.stacked; }
  drawStatic(g) {
    const t = this.t, o = this.opts;
    if (g.empty) { this.plot.innerHTML = this.emptySvg(g.W, g.H, o.emptyText || 'Sin datos para este periodo'); return; }
    let s = this.svgOpen(g.W, g.H, this.summary(g));
    if (!g.horizontal) {
      s += '<g>';
      if (g.yl) g.nt.ticks.forEach((v, i) => {
        const yy = r1(g.padT + g.ph - ((v - g.nt.lo) / (g.nt.hi - g.nt.lo)) * g.ph) + 0.5;
        if (v !== 0) s += '<line x1="' + g.padL + '" x2="' + (g.W - g.padR) + '" y1="' + yy + '" y2="' + yy + '" stroke="' + esc(t.grid) + '" stroke-width="1" shape-rendering="crispEdges"/>';
        s += '<text class="tbc-tick" x="' + (g.padL - 10) + '" y="' + yy + '" text-anchor="end" dominant-baseline="middle">' + esc(g.yl[i]) + '</text>';
      });
      g.xt.forEach((tk) => {
        s += tk.lines
          ? '<text class="tbc-tick" x="' + r1(tk.cx) + '" y="' + (g.H - 22) + '" text-anchor="middle">' + esc(tk.lines[0]) + '<tspan x="' + r1(tk.cx) + '" dy="14" style="fill:' + esc(t.text2) + ';font-weight:500">' + esc(tk.lines.slice(1).join(' ')) + '</tspan></text>'
          : '<text class="tbc-tick" x="' + r1(tk.left) + '" y="' + (g.H - 8) + '">' + esc(tk.s) + '</text>';
      });
      s += '</g><g class="tbc-marks"></g>';
      s += '<line x1="' + g.padL + '" x2="' + (g.W - g.padR) + '" y1="' + (r1(g.base) + 0.5) + '" y2="' + (r1(g.base) + 0.5) + '" stroke="' + esc(t.axis) + '" stroke-width="1" shape-rendering="crispEdges"/>';
      s += '<g class="tbc-ann">';
      g.bars.forEach((b) => {
        if (!g.showLab[b.i] || b.raw == null) return;
        const neg = b.v < 0, yy = neg ? b.end + 14 : b.end - 7;
        s += '<text class="tbc-val" x="' + r1(b.cx) + '" y="' + r1(yy) + '" text-anchor="middle" data-i="' + b.i + '"' + (o.highlight === b.i ? ' style="fill:' + esc(t.text) + '"' : '') + '>' + esc(g.lab[b.i]) + '</text>';
      });
      s += '</g>';
    } else {
      s += '<g>';
      g.rows.forEach((r) => {
        s += g.stacked
          ? '<text class="tbc-name" x="0" y="' + r1(r.ny) + '" dominant-baseline="middle" style="fill:' + esc(t.text) + ';font-weight:500;font-size:13px">' + esc(r.name) + '</text>'
          : '<text class="tbc-name" x="' + (g.padL - 14) + '" y="' + r1(r.ny) + '" text-anchor="end" dominant-baseline="middle">' + esc(r.name) + '</text>';
      });
      s += '</g><g class="tbc-marks"></g><g class="tbc-ann">';
      g.rows.forEach((r) => {
        const x = g.stacked ? g.W : g.padL + r.len + 8, y = g.stacked ? r.ny : (r.x0 + r.x1) / 2;
        s += '<text class="tbc-val" x="' + r1(x) + '" y="' + r1(y) + '" dominant-baseline="middle"' + (g.stacked ? ' text-anchor="end"' : '') + ' data-i="' + r.i + '" style="fill:' + esc(t.text) + ';font-size:12px">' + esc(g.lab[r.i]) + '</text>';
      });
      s += '</g>';
    }
    s += '<rect class="tbc-hl" fill="none" stroke="none" pointer-events="none"/></svg>';
    this.plot.innerHTML = s;
    const svg = this.plot.firstChild;
    this.gMarks = svg.querySelector('.tbc-marks'); this.gAnn = svg.querySelector('.tbc-ann');
  }
  frame(k, from) {
    const g = this.geo; if (g.empty) return;
    let s = '';
    if (!g.horizontal) {
      g.bars.forEach((b, i) => {
        let end;
        if (from) { const f = from.bars[i]; const e = easeInOut(k); end = f.end + (b.end - f.end) * e; }
        else { const st = (i / Math.max(1, g.n)) * 0.35, e = easeOut(clamp((k - st) / 0.65, 0, 1)); end = g.base + (b.end - g.base) * e; }
        s += '<path d="' + barPath(b.x0, b.x1, g.base, end, false) + '" fill="' + esc(b.color) + '" data-i="' + i + '"/>';
      });
    } else {
      g.rows.forEach((r, i) => {
        let len;
        if (from) { const f = from.rows[i]; len = f.len + (r.len - f.len) * easeInOut(k); }
        else { const st = (i / Math.max(1, g.n)) * 0.35, e = easeOut(clamp((k - st) / 0.65, 0, 1)); len = r.len * e; }
        s += '<path d="' + barPath(r.x0, r.x1, g.padL, g.padL + Math.max(len, r.v > 0 ? 2 : 0), true) + '" fill="' + esc(r.color) + '" data-i="' + i + '"/>';
      });
    }
    this.gMarks.innerHTML = s;
    this.gAnn.style.opacity = k >= 1 ? '1' : from ? '0' : String(clamp((k - 0.6) / 0.4, 0, 1));
  }
  hit(x, y) {
    const g = this.geo; if (!g || g.empty) return null;
    if (!g.horizontal) { if (x < g.padL - 4 || x > g.W) return null; return clamp(Math.floor((x - g.padL) / g.slot), 0, g.n - 1); }
    if (y < 0 || y > g.H) return null;
    return clamp(Math.floor(y / g.rowH), 0, g.n - 1);
  }
  nav(cur, key) {
    const n = this.geo.n, fwd = this.opts.horizontal ? 'ArrowDown' : 'ArrowRight', back = this.opts.horizontal ? 'ArrowUp' : 'ArrowLeft';
    if (key === fwd || key === (this.opts.horizontal ? 'ArrowRight' : 'ArrowUp')) return cur == null ? 0 : Math.min(n - 1, cur + 1);
    if (key === back || key === (this.opts.horizontal ? 'ArrowLeft' : 'ArrowDown')) return cur == null ? 0 : Math.max(0, cur - 1);
    if (key === 'Home') return 0;
    if (key === 'End') return n - 1;
    return undefined;
  }
  paintActive(i) {
    if (!this.gMarks) return;
    const paths = this.gMarks.children;
    for (let j = 0; j < paths.length; j++) paths[j].style.opacity = i == null || j === i ? '' : '0.45';
    const labs = this.gAnn ? this.gAnn.querySelectorAll('text') : [];
    for (let j = 0; j < labs.length; j++) labs[j].style.opacity = i == null || +labs[j].getAttribute('data-i') === i ? '' : '0.45';
  }
  tipInfo(i) {
    const g = this.geo, o = this.opts, v = o.values[i];
    const row = { color: (g.bars || g.rows)[i].color, square: true, value: v == null ? 'Sin dato' : this.F.full(v), name: o.name || '' };
    if (!g.horizontal) { const b = g.bars[i]; return { title: longText(o.labels, i, g.mode), rows: [row], x: b.cx, y: Math.min(b.end, g.base), y2: g.base }; }
    const r = g.rows[i];
    return { title: longText(o.labels, i, g.mode), rows: [row], x: g.stacked ? Math.min(g.W - 60, Math.max(60, r.len)) : g.padL + r.len, y: g.stacked ? r.top : r.x0, y2: r.x1 };
  }
  summary(g) {
    const o = this.opts, v = o.values.map((x) => x || 0);
    const mx = v.indexOf(maxOf(v)), mn = v.indexOf(minOf(v));
    return (o.label || o.name || 'Gráfica de barras') + ', ' + g.n + (g.n === 1 ? ' categoría' : ' categorías') + '. Mayor: ' + longText(o.labels, mx, g.mode) + ' con ' + this.F.full(v[mx]) + '. Menor: ' + longText(o.labels, mn, g.mode) + ' con ' + this.F.full(v[mn]) + '.';
  }
  tableData(g) {
    if (g.empty) return null;
    const o = this.opts;
    return { head: ['', o.name || 'Valor'], rows: o.labels.map((_, i) => [longText(o.labels, i, g.mode), o.values[i] == null ? '—' : this.F.full(o.values[i])]) };
  }
}

// ════════════════════════════════════════════════════════════════════
//  Dona (parte de un todo, ≤ 6 segmentos; el resto se agrupa en "Otros")
// ════════════════════════════════════════════════════════════════════
class DonutChart extends Chart {
  normalize(o) {
    let segs = (o.segments || []).map((s, i) => ({ label: String(s.label == null ? 'Segmento ' + (i + 1) : s.label), value: Math.max(0, num(s.value) || 0), color: s.color, slot: i }));
    if (segs.length > 6) {
      const rest = segs.slice(5);
      segs = segs.slice(0, 5).concat([{ label: 'Otros', value: rest.reduce((a, s) => a + s.value, 0), color: 'muted', slot: -1, parts: rest.map((s) => s.label) }]);
    }
    return Object.assign({}, o, { segs });
  }
  mount(root) {
    this.wrap = div('tbc-dw');
    this.list = div('tbc-dl'); this.list.setAttribute('aria-hidden', 'true');
    this.wrap.appendChild(this.plot); this.wrap.appendChild(this.list);
    root.appendChild(this.wrap);
    this.on(this.list, 'pointermove', (e) => { const r = e.target.closest && e.target.closest('.tbc-dr'); if (r && e.pointerType === 'mouse') this.setActive(+r.getAttribute('data-i'), 'legend'); });
    this.on(this.list, 'pointerleave', (e) => { if (e.pointerType === 'mouse') this.setActive(null); });
    this.on(this.list, 'click', (e) => { const r = e.target.closest && e.target.closest('.tbc-dr'); if (r) { const i = +r.getAttribute('data-i'); this.setActive(this.active === i ? null : i, 'legend'); } });
  }
  defaultName() { return 'Gráfica de dona'; }
  layout(W) {
    const o = this.opts, t = this.t, segs = o.segs;
    const total = segs.reduce((a, s) => a + s.value, 0);
    const narrow = W < 460;
    const S = Math.round(narrow ? Math.min(W, 208) : clamp(W * 0.36, 168, 224));
    const R = S / 2 - 5, th = clamp(R * 0.2, 14, 22), r0 = R - th;
    const cx = S / 2, cy = S / 2;
    const cols = segs.map((s) => (s.slot < 0 ? t.muted : resolveColor(s.color, s.slot, t)));
    const pad = segs.filter((s) => s.value > 0).length > 1 ? 2 / ((R + r0) / 2) : 0; // 2px de superficie entre segmentos
    let a = -Math.PI / 2;
    const arcs = segs.map((s, i) => {
      const sweep = total ? (s.value / total) * Math.PI * 2 : 0;
      const arc = { i, a0: a, a1: a + sweep, frac: total ? s.value / total : 0, color: cols[i] };
      a += sweep; return arc;
    });
    return { W: S, H: S, CW: W, narrow, S, R, r0, cx, cy, total, arcs, pad, cols, empty: !total, n: segs.length };
  }
  duration() { return 900; }
  canMorph(a, b) { return a.n === b.n; }
  pctText(f) { return NF1.format(f * 100) + '%'; }
  center(label, value, sub) {
    const g = this.geo, t = this.t, inner = g.r0 * 2 - 18;
    let fs = clamp(g.R * 0.3, 20, 30);
    while (fs > 14 && textW(value, fs, 800, t.disp) > inner) fs -= 1;
    const lab = truncate(label, inner, 11, 600, t.font);
    return '<text x="' + g.cx + '" y="' + r1(g.cy - fs * 0.62) + '" text-anchor="middle" style="font-size:11px;font-weight:600;letter-spacing:.06em;fill:' + esc(t.text3) + '">' + esc(lab.toUpperCase()) + '</text>' +
      '<text x="' + g.cx + '" y="' + r1(g.cy + fs * 0.36) + '" text-anchor="middle" style="font-family:' + esc(t.disp) + ';font-size:' + fs + 'px;font-weight:800;letter-spacing:.01em;fill:' + esc(t.text) + ';font-variant-numeric:tabular-nums">' + esc(value) + '</text>' +
      (sub ? '<text x="' + g.cx + '" y="' + r1(g.cy + fs * 0.36 + 17) + '" text-anchor="middle" style="font-size:12px;font-weight:500;fill:' + esc(t.text2) + '">' + esc(sub) + '</text>' : '');
  }
  drawStatic(g) {
    const o = this.opts, t = this.t;
    this.wrap.classList.toggle('narrow', g.narrow);
    this.plot.style.width = g.S + 'px';
    let s = this.svgOpen(g.S, g.S, this.summary(g));
    s += '<circle cx="' + g.cx + '" cy="' + g.cy + '" r="' + r1((g.R + g.r0) / 2) + '" fill="none" stroke="' + esc(t.grid) + '" stroke-width="' + r1(g.R - g.r0) + '"/>';
    s += '<g class="tbc-marks"></g><g class="tbc-center"></g></svg>';
    this.plot.innerHTML = s;
    const svg = this.plot.firstChild;
    this.gMarks = svg.querySelector('.tbc-marks'); this.gCenter = svg.querySelector('.tbc-center');
    this.paintCenter(null);
    // leyenda con valor y %
    const L = this.list; L.textContent = '';
    o.segs.forEach((sg, i) => {
      const r = div('tbc-dr'); r.setAttribute('data-i', i);
      const k = div('tbc-key sq', 'span'); k.style.background = g.cols[i];
      const n = div('tbc-dn', 'span'); n.textContent = sg.label; n.title = sg.parts ? sg.parts.join(', ') : sg.label;
      const v = div('tbc-dv', 'span'); v.textContent = this.F.full(sg.value);
      const p = div('tbc-dp', 'span'); p.textContent = g.total ? this.pctText(g.arcs[i].frac) : '—';
      r.appendChild(k); r.appendChild(n); r.appendChild(v); r.appendChild(p);
      L.appendChild(r);
    });
  }
  paintCenter(i) {
    const g = this.geo, o = this.opts;
    if (!this.gCenter) return;
    if (i == null || g.empty) {
      this.gCenter.innerHTML = g.empty ? this.center(o.centerLabel || 'Total', o.emptyText || 'Sin datos') : this.center(o.centerLabel || 'Total', o.centerValue != null ? String(o.centerValue) : this.F.full(g.total));
    } else {
      const sg = o.segs[i];
      this.gCenter.innerHTML = this.center(sg.label, this.F.full(sg.value), this.pctText(g.arcs[i].frac));
    }
  }
  frame(k, from) {
    const g = this.geo; if (g.empty) { this.gMarks.innerHTML = ''; return; }
    const e = easeInOut(k), lim = -Math.PI / 2 + Math.PI * 2 * (from ? 1 : e);
    let s = '';
    let a = -Math.PI / 2;
    g.arcs.forEach((arc, i) => {
      let a0 = arc.a0, a1 = arc.a1;
      if (from) { const f = from.arcs[i]; const sw = (f.a1 - f.a0) + ((arc.a1 - arc.a0) - (f.a1 - f.a0)) * e; a0 = a; a1 = a + sw; a = a1; }
      if (a0 >= lim) return;
      a1 = Math.min(a1, lim);
      const p = g.pad / 2, b0 = a0 + p, b1 = a1 - p;
      if (b1 - b0 <= 0.002) return;
      const on = this.active === i;
      s += '<path d="' + arcPath(g.cx, g.cy, g.r0, on ? g.R + 3 : g.R, b0, b1) + '" fill="' + esc(arc.color) + '" data-i="' + i + '"' + (this.active != null && !on ? ' opacity=".35"' : '') + '/>';
    });
    this.gMarks.innerHTML = s;
  }
  hit(x, y) {
    const g = this.geo; if (!g || g.empty) return null;
    const dx = x - g.cx, dy = y - g.cy, d = Math.sqrt(dx * dx + dy * dy);
    if (d < g.r0 - 10 || d > g.R + 12) return null;
    let a = Math.atan2(dy, dx); if (a < -Math.PI / 2) a += Math.PI * 2;
    const arc = g.arcs.find((q) => a >= q.a0 && a < q.a1);
    return arc ? arc.i : null;
  }
  nav(cur, key) {
    const n = this.geo.n;
    if (key === 'ArrowRight' || key === 'ArrowDown') { let i = cur == null ? 0 : (cur + 1) % n; return i; }
    if (key === 'ArrowLeft' || key === 'ArrowUp') return cur == null ? n - 1 : (cur - 1 + n) % n;
    if (key === 'Home') return 0;
    if (key === 'End') return n - 1;
    return undefined;
  }
  paintActive(i) {
    if (!this.geo || this.geo.empty) return;
    if (!this.stopAnim) this.frame(1, null);
    this.paintCenter(i);
    const rows = this.list.children;
    for (let j = 0; j < rows.length; j++) rows[j].classList.toggle('on', j === i);
    this.list.classList.toggle('dim', i != null);
  }
  showTip() { /* la dona muestra el detalle en el centro, no en un tooltip */ }
  tipInfo(i) {
    const sg = this.opts.segs[i]; if (!sg) return null;
    return { title: sg.label, rows: [{ value: this.F.full(sg.value) + ' · ' + this.pctText(this.geo.arcs[i].frac) }] };
  }
  summary(g) {
    const o = this.opts;
    if (g.empty) return (o.label || 'Gráfica de dona') + ': sin datos.';
    return (o.label || 'Gráfica de dona') + '. Total ' + this.F.full(g.total) + '. ' + o.segs.map((s, i) => s.label + ': ' + this.F.full(s.value) + ' (' + this.pctText(g.arcs[i].frac) + ')').join(', ') + '.';
  }
  tableData(g) {
    const o = this.opts;
    return { head: ['', 'Valor', '%'], rows: o.segs.map((s, i) => [s.label, this.F.full(s.value), g.total ? this.pctText(g.arcs[i].frac) : '—']).concat([['Total', this.F.full(g.total), g.total ? '100%' : '—']]) };
  }
}

// ════════════════════════════════════════════════════════════════════
//  Mapa de calor (horas pico: filas = días, columnas = horas)
// ════════════════════════════════════════════════════════════════════
class Heatmap extends Chart {
  normalize(o) {
    const rows = (o.rows || []).map(String), cols = (o.cols || []).map(String);
    const values = rows.map((_, r) => cols.map((_, c) => { const row = (o.values || [])[r]; return num(row && row[c]) || 0; }));
    return Object.assign({}, o, { rows, cols, values });
  }
  mount(root) { root.appendChild(this.plot); this.scale = div('tbc-scale'); root.appendChild(this.scale); }
  defaultName() { return 'Mapa de calor'; }
  layout(W) {
    const o = this.opts, t = this.t, fam = t.font, R = o.rows.length, C = o.cols.length;
    const flat = [].concat.apply([], o.values);
    const max = o.max != null ? o.max : maxOf(flat.length ? flat : [0]);
    const geo = { W, R, C, max, empty: !R || !C };
    if (geo.empty) { geo.H = 120; return geo; }
    const padL = Math.ceil(maxOf(o.rows.map((s) => textW(s, 11.5, 500, fam)))) + 10;
    const cw = (W - padL) / C, ch = Math.round(clamp(cw * 0.78, 20, 32)), padB = 22;
    const H = R * ch + padB;
    const lw = maxOf(o.cols.map((s) => textW(s, 11, 400, fam)));
    const step = Math.max(1, Math.ceil((lw + 8) / cw));
    const color = ramp(t.seq);
    // pico
    let pk = null;
    o.values.forEach((row, r) => row.forEach((v, c) => { if (v > 0 && (!pk || v > pk.v)) pk = { r, c, v }; }));
    const gap = 2, rx = Math.min(4, (Math.min(cw, ch) - gap) / 4);
    return Object.assign(geo, { H, padL, cw, ch, padB, step, color, pk, gap, rx });
  }
  duration() { return 650; }
  canMorph(a, b) { return a.R === b.R && a.C === b.C; }
  cellColor(v) { const g = this.geo; return v > 0 && g.max > 0 ? g.color(0.08 + 0.92 * (v / g.max)) : this.t.empty; }
  drawStatic(g) {
    const o = this.opts, t = this.t;
    if (g.empty) { this.plot.innerHTML = this.emptySvg(g.W, g.H, o.emptyText || 'Sin datos para este periodo'); this.scale.textContent = ''; return; }
    let s = this.svgOpen(g.W, g.H, this.summary(g)) + '<g>';
    o.rows.forEach((r, i) => { s += '<text class="tbc-tick" x="0" y="' + r1(i * g.ch + (g.ch - g.gap) / 2) + '" dominant-baseline="middle" style="font-size:11.5px;font-weight:500;fill:' + esc(t.text2) + '">' + esc(r) + '</text>'; });
    o.cols.forEach((c, j) => {
      if (j % g.step) return;
      const w_ = textW(c, 11, 400, t.font), cx = g.padL + j * g.cw + (g.cw - g.gap) / 2;
      s += '<text class="tbc-tick" x="' + r1(clamp(cx - w_ / 2, g.padL, g.W - w_)) + '" y="' + (g.H - 6) + '">' + esc(c) + '</text>';
    });
    s += '</g><g class="tbc-marks"></g><rect class="tbc-hl" rx="' + r1(g.rx + 1) + '" fill="none" stroke="' + esc(t.text) + '" stroke-width="2" style="display:none" pointer-events="none"/></svg>';
    this.plot.innerHTML = s;
    const svg = this.plot.firstChild;
    this.gMarks = svg.querySelector('.tbc-marks'); this.hl = svg.querySelector('.tbc-hl');
    // leyenda de escala + pico
    const sc = this.scale; sc.textContent = '';
    const peak = div('', 'span');
    if (g.pk) { peak.appendChild(document.createTextNode('Pico: ')); const b = div('', 'b'); b.textContent = o.rows[g.pk.r] + ' ' + o.cols[g.pk.c]; peak.appendChild(b); peak.appendChild(document.createTextNode(' · ' + this.F.full(g.pk.v))); }
    else peak.textContent = 'Sin actividad';
    const rp = div('tbc-ramp', 'span');
    const lo = div('', 'span'); lo.textContent = 'Menos'; rp.appendChild(lo);
    [0.12, 0.34, 0.56, 0.78, 1].forEach((f) => { const i = div('', 'i'); i.style.background = g.color(f); rp.appendChild(i); });
    const hi = div('', 'span'); hi.textContent = 'Más'; rp.appendChild(hi);
    sc.appendChild(peak); sc.appendChild(rp);
  }
  frame(k, from) {
    const g = this.geo, o = this.opts; if (g.empty) return;
    let s = '';
    o.values.forEach((row, r) => row.forEach((v, c) => {
      let vv = v, op = 1;
      if (from) { const fv = this.prevVals && this.prevVals[r] ? this.prevVals[r][c] || 0 : 0; vv = fv + (v - fv) * easeInOut(k); }
      else { const st = (c / Math.max(1, g.C)) * 0.5; op = clamp((k - st) / 0.5, 0, 1); op = easeOut(op); }
      const x = g.padL + c * g.cw, y = r * g.ch;
      s += '<rect x="' + r1(x) + '" y="' + r1(y) + '" width="' + r1(g.cw - g.gap) + '" height="' + r1(g.ch - g.gap) + '" rx="' + r1(g.rx) + '" fill="' + this.cellColor(vv) + '"' + (op < 1 ? ' opacity="' + op.toFixed(3) + '"' : '') + '/>';
    }));
    this.gMarks.innerHTML = s;
    if (k >= 1) this.prevVals = o.values.map((r) => r.slice()); // punto de partida del próximo update()
  }
  hit(x, y) {
    const g = this.geo; if (!g || g.empty) return null;
    if (x < g.padL || y < 0 || y > g.R * g.ch) return null;
    const c = clamp(Math.floor((x - g.padL) / g.cw), 0, g.C - 1), r = clamp(Math.floor(y / g.ch), 0, g.R - 1);
    return r * g.C + c;
  }
  firstKey() { const g = this.geo; return g.pk ? g.pk.r * g.C + g.pk.c : 0; }
  nav(cur, key) {
    const g = this.geo; if (cur == null) return this.firstKey();
    let r = Math.floor(cur / g.C), c = cur % g.C;
    if (key === 'ArrowRight') c = Math.min(g.C - 1, c + 1);
    else if (key === 'ArrowLeft') c = Math.max(0, c - 1);
    else if (key === 'ArrowDown') r = Math.min(g.R - 1, r + 1);
    else if (key === 'ArrowUp') r = Math.max(0, r - 1);
    else if (key === 'Home') c = 0;
    else if (key === 'End') c = g.C - 1;
    else return undefined;
    return r * g.C + c;
  }
  paintActive(key) {
    const g = this.geo, hl = this.hl; if (!hl || g.empty) return;
    if (key == null) { hl.style.display = 'none'; return; }
    const r = Math.floor(key / g.C), c = key % g.C;
    hl.setAttribute('x', r1(g.padL + c * g.cw - 1)); hl.setAttribute('y', r1(r * g.ch - 1));
    hl.setAttribute('width', r1(g.cw - g.gap + 2)); hl.setAttribute('height', r1(g.ch - g.gap + 2));
    hl.style.display = '';
  }
  tipInfo(key) {
    const g = this.geo, o = this.opts, r = Math.floor(key / g.C), c = key % g.C, v = o.values[r][c];
    return { title: o.rows[r] + ' · ' + o.cols[c], rows: [{ color: this.cellColor(v), square: true, value: this.F.full(v) }], x: g.padL + c * g.cw + (g.cw - g.gap) / 2, y: r * g.ch, y2: (r + 1) * g.ch };
  }
  summary(g) {
    const o = this.opts;
    if (g.empty) return (o.label || 'Mapa de calor') + ': sin datos.';
    const byRow = o.values.map((row) => row.reduce((a, v) => a + v, 0));
    const br = byRow.indexOf(maxOf(byRow));
    return (o.label || 'Mapa de calor') + ', ' + g.R + ' filas por ' + g.C + ' columnas. ' + (g.pk ? 'Pico: ' + o.rows[g.pk.r] + ' ' + o.cols[g.pk.c] + ' con ' + this.F.full(g.pk.v) + '. ' : '') + 'Fila con más actividad: ' + o.rows[br] + ' (' + this.F.full(byRow[br]) + ').';
  }
  tableData(g) {
    if (g.empty) return null;
    const o = this.opts;
    return { head: [''].concat(o.cols), rows: o.rows.map((r, i) => [r].concat(o.values[i].map((v) => this.F.full(v)))) };
  }
}

// ════════════════════════════════════════════════════════════════════
//  API pública
// ════════════════════════════════════════════════════════════════════
function api(c) { return { update: (o) => { c.update(o || {}); }, redraw: () => c.redraw(), destroy: () => c.destroy(), get el() { return c.root; } }; }

/** Línea (una o varias series) con área suave opcional. */
export function lineChart(el, opts) { return api(new LineChart(el, opts, 'line')); }
/** Barras verticales, u horizontales (rankings) con horizontal:true. */
export function barChart(el, opts) { return api(new BarChart(el, opts, 'bar')); }
/** Dona con leyenda (valor y %) y total al centro. */
export function donutChart(el, opts) { return api(new DonutChart(el, opts, 'donut')); }
/** Mapa de calor: filas (días) × columnas (horas). */
export function heatmap(el, opts) { return api(new Heatmap(el, opts, 'heat')); }

/** Color de la ranura categórica i (0-based) como var() — para leyendas o avatares propios. */
export function seriesColor(i) { return i >= 0 && i < 6 ? 'var(--chart-' + (i + 1) + ')' : 'var(--chart-muted)'; }

/** Sparkline para KPIs → string SVG (colores con var(), así cambia sola con el tema). */
export function sparkline(values, opts) {
  opts = opts || {};
  const w = Math.max(10, +opts.width || 120), h = Math.max(8, +opts.height || 32);
  let color = opts.color == null ? 'var(--brand)' : typeof opts.color === 'number' ? seriesColor(opts.color - 1) : String(opts.color);
  if (!/^[#\w\s(),.%-]+$/.test(color)) color = 'var(--brand)';
  if (/^--/.test(color)) color = 'var(' + color + ')';
  const vs = (values || []).map(num).filter((v) => v != null);
  const a11y = opts.label ? ' role="img" aria-label="' + esc(opts.label) + '"' : ' aria-hidden="true"';
  const open = '<svg class="tbc-spark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" fill="none"' + a11y + ' style="display:block;overflow:visible">' + (opts.label ? '<title>' + esc(opts.label) + '</title>' : '');
  if (vs.length < 2) return open + '<line x1="0" x2="' + w + '" y1="' + h / 2 + '" y2="' + h / 2 + '" style="stroke:var(--border-strong);stroke-width:1.5;stroke-linecap:round"/></svg>';
  const p = 3.5, mn = minOf(vs), mx = maxOf(vs), span = mx - mn || 1;
  const pts = vs.map((v, i) => [p + (i * (w - 2 * p)) / (vs.length - 1), mx === mn ? h / 2 : p + (h - 2 * p) * (1 - (v - mn) / span)]);
  const d = smoothPath(pts), last = pts[pts.length - 1];
  return open +
    (opts.area === false ? '' : '<path d="' + d + 'L' + r1(last[0]) + ',' + h + 'L' + r1(pts[0][0]) + ',' + h + 'Z" style="fill:' + color + ';fill-opacity:.1;stroke:none"/>') +
    '<path d="' + d + '" style="stroke:' + color + ';stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;fill:none"/>' +
    '<circle cx="' + r1(last[0]) + '" cy="' + r1(last[1]) + '" r="2.75" style="fill:' + color + ';stroke:var(--surface,#fff);stroke-width:1.5"/></svg>';
}
