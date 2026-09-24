// #/reportes — Reportes del dueño (reports.read).
//
//   Filtros de periodo (Hoy, 7 días, 30 días, Este mes, Mes pasado, 90 días, Este año, Personalizado) y
//   barbero — en la URL (?r=&desde=&hasta=&barbero=) y recordados en este dispositivo (mismos controles
//   que #/inicio, importados de dashboard.js).
//   Datos: GET /api/reports/dashboard del periodo y del periodo anterior (para las variaciones).
//   Secciones (con navegación fija que sigue el scroll):
//     · Resumen   — KPIs con variación: ingresos, citas, ticket, propinas, clientes nuevos, ocupación.
//     · Ingresos  — serie (día/semana/mes) contra el periodo anterior + tabla; por forma de pago, por
//                   barbero y por servicio, cada uno con tabla y totales.
//     · Citas     — citas y atendidas por día, por estado, tasas de cancelación y no-show, por día de
//                   la semana y por hora.
//     · Clientes  — nuevos vs. recurrentes.
//     · Exportar  — CSV de citas, cobros, clientes y comisiones (GET /api/reports/export, reports.export).
//   Imprimir: window.print() con estilos @media print propios (tema claro, sin menús ni controles).
//   Se refresca con 'appointments:changed' / 'payments:changed' y al volver a la pestaña.
import { html, raw, $, $$, on } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { bus, can, shop, today, getStaff } from '../lib/state.js';
import { setQuery } from '../lib/router.js';
import { toast, menu, busy, avatar, emptyState, errorState, saveFile } from '../lib/ui.js';
import { money, number, plural, dateShort, monthYear, WEEKDAYS, WEEKDAYS_SHORT, colorFor, dateTimeIso } from '../lib/fmt.js';
import { lineChart, barChart, donutChart } from '../lib/charts.js';
import {
  PRESETS, rangeOf, prevRange, rangeText, initialFilters, writePrefs, filtersHtml, paintFilters, wireFilters,
  kpiTile, animateKpis, bucketSeries, mountChart, destroyCharts, methodSegments, METHOD_ICON,
  hourLabel, peakOf, injectDashStyle, pctText, statusBars, kpiSkeleton, cardSkeleton, shortDay
} from './dashboard.js';

const RP_PRESETS = ['hoy', '7d', '30d', 'mes', 'mes_ant', '90d', 'anio', 'otro'];
const SECTIONS = [['resumen', 'Resumen'], ['ingresos', 'Ingresos'], ['citas', 'Citas'], ['clientes', 'Clientes'], ['exportar', 'Exportar']];
const WD_ORDER = [1, 2, 3, 4, 5, 6, 0]; // lunes primero
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const m0 = (n) => money(Math.round(Number(n) || 0));
const share = (v, tot) => (tot > 0 ? (v / tot) * 100 : 0);

const EXPORTS = [
  { type: 'appointments', t: 'Citas', unit: ['cita', 'citas'], icon: 'calendar', d: 'Cada cita con cliente, barbero, servicios, total, pagado y estado.' },
  { type: 'payments', t: 'Cobros', unit: ['cobro', 'cobros'], icon: 'wallet', d: 'Cada pago con forma de pago, propina, cliente y quién lo registró.' },
  { type: 'clients', t: 'Clientes', unit: ['cliente', 'clientes'], icon: 'users', d: 'Tu lista de clientes con sus citas y lo que pagaron en el periodo.' },
  { type: 'commissions', t: 'Comisiones', unit: ['barbero', 'barberos'], icon: 'percent', d: 'Ventas, comisión, propinas, pagos y saldo de cada barbero.' }
];

const KPIS = [
  { k: 'revenue', label: 'Ingresos', icon: 'wallet', fmt: m0, spark: 'revenue', foot: (k, D) => m0(k.revenue / Math.max(1, D.range.days)) + ' al día en promedio' },
  { k: 'appointments', label: 'Citas', icon: 'calendar', fmt: (n) => number(n), spark: 'appointments', foot: (k) => plural(k.completed, 'atendida') },
  { k: 'avg_ticket', label: 'Ticket promedio', icon: 'receipt', fmt: m0, foot: () => 'Por cada venta cobrada' },
  { k: 'tips', label: 'Propinas', icon: 'gift', fmt: m0, foot: (k) => (k.revenue ? pctText(share(k.tips, k.revenue)) + ' sobre los ingresos' : 'Aparte de los ingresos') },
  { k: 'new_clients', label: 'Clientes nuevos', icon: 'user-plus', fmt: (n) => number(n), foot: (k) => plural(k.returning_clients, 'cliente recurrente', 'clientes recurrentes') },
  { k: 'occupancy_pct', label: 'Ocupación', icon: 'clock', pts: true, fmt: (n) => pctText(n), bar: (k) => k.occupancy_pct, foot: () => 'Del tiempo disponible' }
];
const RATE_KPIS = [
  { k: 'appointments', label: 'Citas agendadas', icon: 'calendar', fmt: (n) => number(n), foot: () => 'Sin contar las canceladas' },
  { k: 'completed', label: 'Atendidas', icon: 'check-circle', fmt: (n) => number(n), foot: (k) => (k.appointments ? pctText(share(k.completed, k.appointments)) + ' de las agendadas' : 'Aún sin citas') },
  { k: 'cancel_rate', label: 'Cancelación', icon: 'calendar-x', pts: true, invert: true, fmt: (n) => pctText(n), bar: (k) => k.cancel_rate, foot: (k) => plural(k.cancelled, 'cita cancelada', 'citas canceladas') },
  { k: 'no_show_rate', label: 'No llegaron', icon: 'user-x', pts: true, invert: true, fmt: (n) => pctText(n), bar: (k) => k.no_show_rate, foot: (k) => plural(k.no_show, 'cliente', 'clientes') + ' sin avisar' }
];

// ═════════════════════════════════════════════════════════════════════
// Estilos (pantalla + impresión)
// ═════════════════════════════════════════════════════════════════════
const LIGHT_TOKENS = '--bg:#F5F3EE;--surface:#FFFFFF;--surface-2:#FAF8F4;--surface-3:#F0ECE4;--border:rgba(21,19,15,.09);--border-strong:rgba(21,19,15,.16);' +
  '--text:#15130F;--text-2:#5B554A;--text-3:#8C8577;--brand:#C49A3C;--brand-strong:#9E7826;--brand-soft:rgba(196,154,60,.13);--brand-softer:rgba(196,154,60,.07);' +
  '--ok:#2F7D4F;--ok-soft:rgba(47,125,79,.12);--warn:#B26B00;--warn-soft:rgba(178,107,0,.12);--err:#B3261E;--err-soft:rgba(179,38,30,.10);--info:#2F5F8C;--info-soft:rgba(47,95,140,.11);' +
  '--muted-soft:rgba(21,19,15,.06);--st-pending:#B26B00;--st-confirmed:#2F5F8C;--st-completed:#2F7D4F;--st-cancelled:#8C8577;--st-no_show:#B3261E;' +
  '--chart-1:#B28C39;--chart-2:#00839B;--chart-3:#A45032;--chart-4:#644994;--chart-5:#365F19;--chart-6:#8E4367;--chart-muted:#CEC6B7;--chart-grid:#EFEBE4;' +
  '--chart-axis:#D6CFC2;--chart-seq-0:#F6EEDC;--chart-seq-1:#C49A3C;--chart-seq-2:#5C430F;--chart-empty:#F4F1EB;--chart-area-opacity:.18;--chart-surface:#FFFFFF;color-scheme:light;';
const CSS = `
.rp .page-head .actions .btn{min-height:44px}
.rp-nav{position:sticky;top:var(--topbar-h);z-index:20;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:0 -16px 6px;padding:8px 16px;background:var(--bg);background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:saturate(1.4) blur(14px);-webkit-backdrop-filter:saturate(1.4) blur(14px);border-bottom:1px solid transparent;transition:border-color .2s}
.rp-nav::-webkit-scrollbar{display:none}
.rp-nav.stuck{border-bottom-color:var(--border)}
.rp-nav button{flex:none;min-height:40px;padding:0 15px;border-radius:999px;font-size:13.5px;font-weight:600;color:var(--text-2);background:var(--surface);border:1px solid var(--border);transition:background .15s,color .15s,border-color .15s}
.rp-nav button:hover{border-color:var(--border-strong);color:var(--text)}
.rp-nav button[aria-current="true"]{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
@media (pointer:coarse){.rp-nav button{min-height:44px}}
@media (min-width:1024px){.rp-nav{margin:0 -32px 6px;padding:10px 32px}}
.rp-sec{scroll-margin-top:calc(var(--topbar-h) + 70px)}
.rp-sec:first-child .db-sec{margin-top:14px}
.rp .db-sec h3 .n{font-family:var(--sans);font-size:13px;font-weight:600;color:var(--text-3);letter-spacing:0;margin-left:8px}
.rp-card-stat{display:flex;align-items:baseline;gap:6px 14px;flex-wrap:wrap;margin:2px 0 12px}
.rp-card-stat b{font-family:var(--disp);font-size:28px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
.rp-card-stat span{font-size:12.5px;color:var(--text-3)}
.rp-oneday{display:grid;gap:14px;padding:6px 0 4px}
.rp-oneday .row{gap:8px;flex-wrap:wrap}
.rp-oneday p{font-size:13.5px;color:var(--text-2);max-width:460px}
.rp-tw{border-top:1px solid var(--border);overflow-x:auto;-webkit-overflow-scrolling:touch}
.rp-table{width:100%;border-collapse:collapse;font-size:13.5px}
.rp-table th{text-align:left;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3);padding:10px 12px;background:var(--surface-2);border-bottom:1px solid var(--border);white-space:nowrap}
.rp-table td{padding:10px 12px;border-bottom:1px solid var(--border);font-variant-numeric:tabular-nums;vertical-align:middle}
.rp-table th:first-child,.rp-table td:first-child{padding-left:18px}
.rp-table th:last-child,.rp-table td:last-child{padding-right:18px}
.rp-table .r{text-align:right;white-space:nowrap}
.rp-table tbody tr:last-child td{border-bottom:0}
.rp-table tbody tr{transition:background .12s}
@media (hover:hover){.rp-table tbody tr:hover{background:var(--surface-2)}}
.db-card>.rp-tw:last-child,.db-card>.rp-more:last-child .rp-tw{border-radius:0 0 var(--r-lg) var(--r-lg)}
.rp-table tfoot td{font-weight:700;background:var(--surface-2);border-top:1px solid var(--border-strong);border-bottom:0}
.rp-table .nm{display:flex;align-items:center;gap:10px;min-width:0;font-weight:600}
.rp-table .nm .avatar{flex:none}
.rp-table .sw{width:10px;height:10px;border-radius:3px;flex:none;background:var(--c)}
.rp-table .pc{color:var(--text-3);font-weight:500}
.rp-table .ic{width:16px;height:16px;color:var(--text-3);flex:none}
@media screen and (max-width:719px){
  .rp-table thead{display:none}
  .rp-table,.rp-table tbody,.rp-table tfoot{display:block}
  .rp-table tr{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 12px;padding:12px 16px!important;border-bottom:1px solid var(--border)}
  .rp-table tr.c2{grid-template-columns:repeat(2,minmax(0,1fr))}
  .rp-table tr.c4{grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
  .rp-table tbody tr:last-child{border-bottom:0}
  .rp-table td{padding:0!important;border:0!important;text-align:left!important;min-width:0;background:none!important}
  .rp-table td.primary{grid-column:1/-1}
  .rp-table td[data-label]::before{content:attr(data-label);display:block;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3);margin-bottom:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .rp-table tfoot tr{background:var(--surface-2);border-top:1px solid var(--border-strong)}
}
.rp-more{border-top:1px solid var(--border)}
.rp-more>summary{list-style:none;display:flex;align-items:center;justify-content:center;gap:6px;min-height:48px;padding:0 18px;font-size:13.5px;font-weight:600;color:var(--brand-strong);cursor:pointer;border-radius:0 0 var(--r-lg) var(--r-lg);transition:background .12s}
.rp-more>summary:hover{background:var(--surface-2)}
.rp-more>summary::-webkit-details-marker{display:none}
.rp-more>summary .ic{width:16px;height:16px;transition:transform .2s var(--ease)}
.rp-more[open]>summary .ic{transform:rotate(180deg)}
.rp-more[open]>summary{border-bottom:1px solid var(--border);border-radius:0}
.rp-more .rp-tw{border-top:0}
.rp-cli{display:grid;gap:22px;grid-template-columns:minmax(0,1fr);align-items:center}
@media (min-width:900px){.rp-cli{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr)}}
.rp-cstats{display:grid;gap:0}
.rp-cstat{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)}
.rp-cstat:last-child{border-bottom:0}
.rp-cstat span{font-size:13.5px;color:var(--text-2)}
.rp-cstat b{font-family:var(--disp);font-size:24px;font-weight:800;font-variant-numeric:tabular-nums;text-align:right;line-height:1.1}
.rp-cstat small{grid-column:1/-1;font-size:12px;color:var(--text-3)}
.rp-cstat .delta{font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:3px;margin-left:6px;vertical-align:1px}
.rp-cstat .delta .ic{width:12px;height:12px;stroke-width:2.6}
.rp-cstat .delta.up{color:var(--ok)}.rp-cstat .delta.down{color:var(--err)}.rp-cstat .delta.flat{color:var(--text-3)}
.rp-note{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;color:var(--text-3);line-height:1.45;margin-top:14px}
.rp-note .ic{width:15px;height:15px;flex:none;margin-top:1px}
.rp-exp{display:grid;gap:12px;grid-template-columns:minmax(0,1fr)}
@media (min-width:600px){.rp-exp{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (min-width:1180px){.rp-exp{grid-template-columns:repeat(4,minmax(0,1fr))}}
.rp-x{display:flex;flex-direction:column;gap:10px;padding:16px;min-width:0}
.rp-x .ico{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand-strong)}
.rp-x b{font-size:15px;font-weight:600}
.rp-x p{font-size:13px;color:var(--text-2);flex:1;line-height:1.45}
.rp-x .btn{align-self:stretch;min-height:44px}
@media (max-width:599px){
  .rp-exp{gap:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--shadow-1);overflow:hidden}
  .rp-x{display:grid;grid-template-columns:42px minmax(0,1fr) 44px;grid-template-areas:"i t b" "i p b";column-gap:12px;row-gap:1px;align-items:center;padding:14px 14px 14px 16px;border:0;border-radius:0;box-shadow:none;background:none}
  .rp-x+.rp-x{border-top:1px solid var(--border)}
  .rp-x .ico{grid-area:i;align-self:center}
  .rp-x>div{grid-area:t}
  .rp-x p{grid-area:p;font-size:12.5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .rp-x .btn{grid-area:b;width:44px;height:44px;min-height:44px;padding:0;border-radius:12px;align-self:center}
  .rp-x .btn .lbl{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
}
.rp-empty-acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;padding:0 20px 28px;margin-top:-14px}
.rp-phead{display:none}
.rp-lock{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-3);padding:14px 16px;border:1px dashed var(--border-strong);border-radius:var(--r)}
:root.rp-printing.rp-printing.rp-printing{${LIGHT_TOKENS}}
.rp-printing .rp-doc{max-width:720px;margin:0 auto}
.rp-printing .db-grid,.rp-printing .db-grid.lead{grid-template-columns:minmax(0,1fr)!important}
@media print{
  @page{margin:14mm 12mm}
  :root:root:root{${LIGHT_TOKENS}}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  html,body{background:#fff!important}
  .sidebar,.topbar,.bottom-nav,.demo-ribbon,.toasts,.overlay,.menu,.rp-noprint,.rp-nav,.db-filters,#rpFilters .db-filters{display:none!important}
  .shell.has-sidebar .main{margin-left:0!important}
  .page{padding:0!important;max-width:none!important;animation:none!important}
  .rp-doc{max-width:none!important}
  .rp .page-head{display:none!important}
  .rp-phead{display:flex!important;justify-content:space-between;align-items:flex-end;gap:16px;padding-bottom:10px;margin-bottom:6px;border-bottom:2px solid #15130F}
  .rp-phead h1{font-family:var(--disp);font-size:26px;font-weight:800;line-height:1.05}
  .rp-phead p{font-size:11.5px;color:#5B554A;margin-top:2px}
  .rp-phead .r{text-align:right}
  .db-cap{margin:6px 0 4px!important}
  .card{box-shadow:none!important;border:1px solid #DDD6C8!important;break-inside:avoid;page-break-inside:avoid}
  .db-grid,.db-grid.lead{grid-template-columns:minmax(0,1fr)!important;gap:10px!important;margin-top:10px!important}
  .db-kpis,.db-kpis.six,.db-kpis.four{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}
  .db-kpi{min-height:0!important;padding:10px 12px!important}
  .db-kpi .value{font-size:22px!important}
  .db-sec{margin:18px 0 6px!important;break-after:avoid;page-break-after:avoid}
  .rp-sec{break-inside:auto}
  .rp-more>summary{display:none!important}
  .rp-more{border-top:1px solid #DDD6C8}
  .rp-table tr{break-inside:avoid}
  .rp-table tbody tr:hover{background:none}
  .tbc svg{width:100%!important;height:auto!important}
  .tbc-tip{display:none!important}
  .fade-up,.stagger>*,.db-a{animation:none!important;opacity:1!important;transform:none!important}
  .db-busy{opacity:1!important}
  a{text-decoration:none!important;color:inherit!important}
}
`;
function injectStyle() { if (!document.getElementById('st-reports')) document.head.insertAdjacentHTML('beforeend', '<style id="st-reports">' + CSS + '</style>'); }

// ═════════════════════════════════════════════════════════════════════
// Piezas
// ═════════════════════════════════════════════════════════════════════
// Tabla con totales. cols: [{ label, r?, cell(row) → html, foot?(totals) → html, primary? }]
// En móvil (< 720px) cada renglón se vuelve una ficha con etiquetas.
function table({ cols, rows, foot, caption, c2, c4 }) {
  return html`<div class="rp-tw"><table class="rp-table">
    ${caption ? html`<caption class="sr">${caption}</caption>` : ''}
    <thead><tr>${cols.map((c) => html`<th scope="col" class="${c.r ? 'r' : ''}">${c.label}</th>`)}</tr></thead>
    <tbody>${rows.map((row) => html`<tr class="${c2 ? 'c2' : c4 ? 'c4' : ''}">${cols.map((c, i) => (i === 0
      ? html`<td class="primary">${c.cell(row)}</td>`
      : html`<td class="${c.r ? 'r' : ''}" data-label="${c.label}">${c.cell(row)}</td>`))}</tr>`)}</tbody>
    ${foot ? html`<tfoot><tr class="${c2 ? 'c2' : c4 ? 'c4' : ''}">${cols.map((c, i) => (i === 0 ? html`<td class="primary">${c.foot ? c.foot(foot) : 'Total'}</td>` : html`<td class="${c.r ? 'r' : ''}" data-label="${c.label}">${c.foot ? c.foot(foot) : ''}</td>`))}</tr></tfoot>` : ''}
  </table></div>`;
}
const pcCell = (v, tot) => html`<span class="pc">${pctText(share(v, tot))}</span>`;
const details = (label, body, open) => html`<details class="rp-more" ${open ? 'open' : ''}><summary>${label}${raw(icon('chevron-down'))}</summary>${body}</details>`;
const sec = (id, title, sub, extra) => html`<div class="db-sec"><div><h3 id="${'rpH-' + id}">${title}</h3>${sub ? html`<p>${sub}</p>` : ''}</div>${extra || ''}</div>`;
const card = (id, title, sub, body, cls) => html`<div class="card db-card ${cls || ''}" id="${id}"><div class="card-head"><div><h3>${title}</h3>${sub ? html`<span class="sub">${sub}</span>` : ''}</div></div>${body}</div>`;

function deltaMini(cur, prev, invert) {
  if (prev == null) return '';
  cur = Number(cur) || 0; prev = Number(prev) || 0;
  let dir, txt;
  if (!prev) { dir = cur ? 'up' : 'flat'; txt = cur ? 'Nuevo' : 'Igual'; }
  else { const p = ((cur - prev) / prev) * 100; dir = Math.abs(p) < 0.5 ? 'flat' : p > 0 ? 'up' : 'down'; txt = dir === 'flat' ? 'Igual' : pctText(Math.abs(p)); }
  const tone = dir === 'flat' ? 'flat' : ((dir === 'up') !== !!invert ? 'up' : 'down');
  return html`<span class="delta ${tone}">${raw(icon(dir === 'up' ? 'arrow-up' : dir === 'down' ? 'arrow-down' : 'minus'))}${txt}<span class="sr"> frente al periodo anterior</span></span>`;
}

// Cuenta renglones de un CSV (sin encabezado), respetando comillas.
function csvRows(text) {
  let n = 0, q = false, any = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') q = !q;
    else if (c === '\n' && !q) { n++; any = false; } else if (c !== '\r') any = true;
  }
  if (any) n++;
  return Math.max(0, n - 1);
}

function skeleton() {
  const secH = '<div class="db-sec"><div style="flex:1"><div class="skel" style="width:140px;height:24px"></div><div class="skel" style="width:260px;height:12px;margin-top:8px"></div></div></div>';
  return '<div aria-busy="true" aria-label="Cargando reportes">' +
    '<div class="rp-sec" style="padding-top:14px">' + kpiSkeleton(6, 'six') + '</div>' +
    secH + cardSkeleton(270) +
    '<div class="db-grid">' + cardSkeleton(300) + cardSkeleton(300) + '</div>' +
    '<div class="db-grid">' + cardSkeleton(260, 'wide') + '</div>' +
    secH + kpiSkeleton(4, 'four') +
    '<div class="db-grid">' + cardSkeleton(240) + cardSkeleton(240) + '</div></div>';
}

// ═════════════════════════════════════════════════════════════════════
// Vista
// ═════════════════════════════════════════════════════════════════════
export default {
  title: 'Reportes',
  async render(el, { query }) {
    injectDashStyle();
    injectStyle();
    el.classList.add('db', 'rp');
    const S = initialFilters(query, RP_PRESETS, '30d', 'reports');
    const UI = { svcBy: 'revenue', staffBy: 'revenue' };
    const charts = new Map();
    const canExport = can('reports.export');
    const sh = shop() || {};
    let staff = null, D = null, P = null, seq = 0, gone = false, lastLoad = 0, first = true;

    el.innerHTML = String(html`
      <div class="rp-doc">
        <div class="page-head">
          <div><span class="eyebrow">${sh.name || 'Tu barbería'}</span><h2>Reportes</h2><p>Ingresos, citas y clientes para decidir con números.</p></div>
          <div class="actions rp-noprint">
            <button type="button" class="btn btn-secondary" data-act="print">${raw(icon('printer'))}Imprimir</button>
            ${canExport ? html`<button type="button" class="btn btn-primary" data-act="export-menu" aria-haspopup="menu">${raw(icon('download'))}Exportar</button>` : ''}
          </div>
        </div>
        <header class="rp-phead" aria-hidden="true"><div><h1>Reporte · ${sh.name || 'TuBarbería'}</h1><p data-ph-range></p></div><div class="r"><p data-ph-date></p></div></header>
        <div id="rpFilters" class="rp-noprint-controls">${filtersHtml(RP_PRESETS, S, can('staff.read') ? [] : null)}</div>
        <nav class="rp-nav" aria-label="Secciones del reporte">${SECTIONS.filter(([k]) => k !== 'exportar' || canExport).map(([k, l], i) => html`<button type="button" data-go="${k}" aria-current="${String(i === 0)}">${l}</button>`)}</nav>
        <div id="rpBody" class="db-a">${raw(skeleton())}</div>
        ${canExport ? html`<section class="rp-sec rp-noprint" id="rp-exportar" aria-labelledby="rpH-exportar">
          ${sec('exportar', 'Exportar', 'Descarga tus datos en CSV para abrirlos en Excel o Google Sheets.')}
          <div class="rp-exp stagger">${EXPORTS.map((x) => html`<div class="card rp-x">
            <span class="ico">${raw(icon(x.icon))}</span>
            <div><b>${x.t}</b></div>
            <p>${x.d}</p>
            <button type="button" class="btn btn-secondary" data-export="${x.type}" aria-label="${'Descargar CSV de ' + x.t.toLowerCase()}">${raw(icon('file-down'))}<span class="lbl">Descargar CSV</span></button>
          </div>`)}</div>
          <p class="rp-note" data-exp-note>${raw(icon('info'))}<span></span></p>
        </section>` : ''}
      </div>`);

    const filtersEl = $('#rpFilters', el);
    const body = $('#rpBody', el);
    paintFilters(filtersEl, RP_PRESETS, S, staff);
    syncUrl();
    paintExportNote();

    function syncUrl() { setQuery({ r: S.r, desde: S.r === 'otro' ? S.desde : '', hasta: S.r === 'otro' ? S.hasta : '', barbero: S.barbero }); }
    function paintExportNote() {
      const n = $('[data-exp-note] span', el);
      if (!n) return;
      const R = rangeOf(S.r, S);
      n.textContent = 'Se exporta el periodo ' + rangeText(R.from, R.to) + (S.barbero ? ' de todo el equipo (el filtro de barbero no aplica a las descargas).' : '.') + ' Los archivos usan UTF-8 y abren bien con acentos.';
    }

    // ── Carga ──
    async function load(silent) {
      const my = ++seq;
      lastLoad = Date.now();
      const R = rangeOf(S.r, S), PR = prevRange(R.from, R.to);
      const sid = S.barbero || undefined;
      if (!first) { body.classList.add('db-busy'); body.setAttribute('aria-busy', 'true'); }
      let d, p;
      try {
        [d, p] = await Promise.all([
          api.get('/reports/dashboard', { from: R.from, to: R.to, staff_id: sid }),
          api.get('/reports/dashboard', { from: PR.from, to: PR.to, staff_id: sid }).catch(() => false)
        ]);
      } catch (err) {
        if (my !== seq || gone) return;
        body.classList.remove('db-busy'); body.removeAttribute('aria-busy');
        if (err.status === 404 && S.barbero) {
          S.barbero = ''; writePrefs('reports', S); paintFilters(filtersEl, RP_PRESETS, S, staff); syncUrl();
          toast.info('Ese barbero ya no está en el equipo. Te mostramos a todo el equipo.');
          return load();
        }
        if (silent && D) { toast.error(err); return; }
        destroyCharts(charts);
        D = null;
        body.innerHTML = String(html`<div class="card" style="margin-top:14px">${errorState(err, 'rpRetry')}</div>`);
        return;
      }
      if (my !== seq || gone) return;
      D = d; P = p;
      paint(!silent);
      body.classList.remove('db-busy'); body.removeAttribute('aria-busy');
      first = false;
    }

    // ── Pintado ──
    function paint(anim) {
      destroyCharts(charts);
      const k = D.kpis, days = D.range.days, filtered = !!S.barbero;
      const empty = !k.appointments && !k.revenue && !k.cancelled;
      const R = D.range;
      const PR = prevRange(R.from, R.to);
      $('[data-ph-range]', el).textContent = rangeText(R.from, R.to) + (filtered && staff ? ' · ' + ((staff.find((s) => s.id === S.barbero) || {}).name || '') : ' · Todo el equipo');
      $('[data-ph-date]', el).textContent = 'Generado el ' + dateTimeIso(new Date().toISOString());
      const prevK = P === false ? false : P ? P.kpis : null;
      const prevText = rangeText(PR.from, PR.to);

      body.innerHTML = String(html`
        <section class="rp-sec" id="rp-resumen" aria-label="Resumen">
          <div class="db-kpis six" id="rpKpis" style="margin-top:14px">${KPIS.map((def) => kpiTile(Object.assign({}, def, { foot: def.foot ? (kk) => def.foot(kk, D) : null }), k, prevK, days > 2 ? D.series : null, prevText))}</div>
        </section>
        ${empty ? html`
          <div class="card db-empty-card" style="margin-top:16px">
            ${emptyState({ icon: 'chart', title: 'Sin movimiento en este periodo', text: 'No hay citas ni cobros ' + (filtered ? 'de este barbero ' : '') + 'del ' + rangeText(R.from, R.to) + '. Elige un periodo más amplio para ver tus números.' })}
            <div class="rp-empty-acts">
              ${S.r !== '30d' ? html`<button type="button" class="btn btn-secondary" data-range="30d">${raw(icon('calendar'))}Últimos 30 días</button>` : ''}
              ${S.r !== 'anio' ? html`<button type="button" class="btn btn-secondary" data-range="anio">${raw(icon('calendar'))}Este año</button>` : ''}
              ${filtered ? html`<button type="button" class="btn btn-ghost" data-act="all-staff">${raw(icon('users'))}Ver a todo el equipo</button>` : ''}
            </div>
          </div>`
        : html`
          ${revenueSection(k, days, filtered)}
          ${apptSection(k, days)}
          ${clientSection(k)}`}`);

      animateKpis($('#rpKpis', body), KPIS, anim || first);
      if (!empty) {
        const rk = $('#rpRates', body);
        if (rk) animateKpis(rk, RATE_KPIS, anim || first);
        mountAll(days, filtered);
      }
      syncNav();
      spy();
    }

    function revenueSection(k, days, filtered) {
      const B = bucketSeries(D.series, days);
      const per = B.unit === 'día' ? 'por día' : B.unit === 'semana' ? 'por semana' : 'por mes';
      const segs = methodSegments(D.by_method);
      const payTot = segs.reduce((a, s) => a + s.value, 0);
      const staffRows = (D.by_staff || []).slice().sort((a, b) => b.revenue - a.revenue || b.appointments - a.appointments);
      const stTot = staffRows.reduce((a, s) => ({ appointments: a.appointments + s.appointments, completed: a.completed + s.completed, revenue: a.revenue + (Number(s.revenue) || 0) }), { appointments: 0, completed: 0, revenue: 0 });
      const svc = D.by_service || [];
      const svTot = svc.reduce((a, s) => ({ count: a.count + s.count, revenue: a.revenue + (Number(s.revenue) || 0) }), { count: 0, revenue: 0 });
      const serTot = B.rows.reduce((a, r) => ({ appointments: a.appointments + (r.appointments || 0), completed: a.completed + (r.completed || 0), revenue: a.revenue + (Number(r.revenue) || 0) }), { appointments: 0, completed: 0, revenue: 0 });
      const rowLabel = (r) => (B.unit === 'día' ? cap(dateShort(r.date)) : B.unit === 'semana' ? 'Semana del ' + shortDay(r.first) : monthYear(r.key + '-01'));
      return html`<section class="rp-sec" id="rp-ingresos" aria-labelledby="rpH-ingresos">
        ${sec('ingresos', 'Ingresos', 'Total ' + m0(k.revenue) + (k.tips ? ' · + ' + m0(k.tips) + ' de propinas' : '') + ' · cobros registrados y citas atendidas sin cobro.')}
        <div class="card db-card" id="rpRev">
          <div class="card-head"><div><h3>Ingresos ${per}</h3><span class="sub">${days > 1 ? 'Comparado con ' + rangeText(prevRange(D.range.from, D.range.to).from, prevRange(D.range.from, D.range.to).to) : 'Un solo día'}</span></div></div>
          <div class="card-body">${days > 1 ? html`<div data-chart="rev" style="min-height:260px"></div>` : html`<div class="rp-oneday">
              <div class="rp-card-stat"><b>${m0(k.revenue)}</b><span>${plural(k.completed, 'cita atendida', 'citas atendidas')} · ticket promedio ${m0(k.avg_ticket)}</span></div>
              <p>Para ver la tendencia elige un periodo de varios días.</p>
              <div class="row rp-noprint"><button type="button" class="btn btn-secondary btn-sm" data-range="7d">7 días</button><button type="button" class="btn btn-secondary btn-sm" data-range="30d">30 días</button></div>
            </div>`}</div>
          ${days > 1 ? details('Ver tabla ' + per, table({
            caption: 'Ingresos y citas ' + per,
            cols: [
              { label: cap(B.unit), cell: rowLabel, foot: () => 'Total' },
              { label: 'Citas', r: 1, cell: (r) => number(r.appointments), foot: (t) => number(t.appointments) },
              { label: 'Atendidas', r: 1, cell: (r) => number(r.completed), foot: (t) => number(t.completed) },
              { label: 'Ingresos', r: 1, cell: (r) => m0(r.revenue), foot: (t) => m0(t.revenue) }
            ],
            rows: B.rows, foot: serTot
          })) : ''}
        </div>
        <div class="db-grid">
          ${card('rpPay', 'Por forma de pago', 'Cobros del periodo, sin propinas', html`
            <div class="card-body">${payTot ? html`<div data-chart="pay"></div>` : emptyState({ icon: 'wallet', title: 'Sin cobros registrados', text: 'Cuando cobres citas verás aquí cuánto entró en efectivo, tarjeta o transferencia.', compact: true })}</div>
            ${payTot ? details('Ver tabla de cobros', table({
              caption: 'Cobros por forma de pago',
              cols: [
                { label: 'Forma de pago', cell: (s) => html`<span class="nm"><span class="sw" style="--c:var(--chart-${s.color})"></span>${raw(icon(METHOD_ICON[s.m]))}${s.label}</span>`, foot: () => 'Total' },
                { label: 'Monto', r: 1, cell: (s) => money(s.value), foot: () => money(payTot) },
                { label: '% del total', r: 1, cell: (s) => pcCell(s.value, payTot), foot: () => '100%' }
              ],
              rows: segs, foot: {}, c2: true
            })) : ''}`)}
          ${filtered ? card('rpStaff', 'Del barbero', 'Resumen del periodo', html`<div class="card-body">${staffRows.length ? staffSolo(staffRows[0], k) : emptyState({ icon: 'user', title: 'Sin datos', compact: true })}</div>`)
            : card('rpStaff', 'Por barbero', stTot.revenue ? 'Ingresos atribuidos a cada barbero' : 'Citas de cada barbero (aún sin ingresos en el periodo)', html`
            <div class="card-body">${stTot.revenue || stTot.appointments ? html`<div data-chart="staff"></div>` : emptyState({ icon: 'users', title: 'Sin movimiento del equipo', compact: true })}</div>
            ${staffRows.length ? table({
              caption: 'Ingresos y citas por barbero',
              cols: [
                { label: 'Barbero', cell: (s) => html`<span class="nm">${avatar(s.name, { size: 'sm', color: s.color || colorFor(s.name) })}<span class="truncate">${s.name}</span></span>`, foot: () => 'Total' },
                { label: 'Citas', r: 1, cell: (s) => number(s.appointments), foot: (t) => number(t.appointments) },
                { label: 'Ingresos', r: 1, cell: (s) => m0(s.revenue), foot: (t) => m0(t.revenue) },
                { label: '% ingresos', r: 1, cell: (s) => pcCell(s.revenue, stTot.revenue), foot: () => (stTot.revenue ? '100%' : '—') },
                { label: 'Ocupación', r: 1, cell: (s) => pctText(s.occupancy_pct), foot: () => pctText(k.occupancy_pct) }
              ],
              rows: staffRows, foot: stTot, c4: true
            }) : ''}`)}
        </div>
        <div class="db-grid">
          ${card('rpSvc', 'Por servicio', svTot.count ? plural(svTot.count, 'servicio') + ' en citas atendidas · a precio de lista' : 'Servicios de las citas atendidas', html`
            <div class="card-body">${svc.length ? html`<div class="row" style="justify-content:flex-end;margin:-6px 0 8px"><div class="seg rp-noprint" role="group" aria-label="Ordenar servicios"><button type="button" data-svc="revenue" aria-pressed="${String(UI.svcBy === 'revenue')}">Ingresos</button><button type="button" data-svc="count" aria-pressed="${String(UI.svcBy === 'count')}">Veces</button></div></div><div data-chart="svc"></div>`
              : emptyState({ icon: 'scissors', title: 'Sin servicios atendidos', text: 'Aquí verás los servicios de las citas marcadas como atendidas.', compact: true })}</div>
            ${svc.length ? details(svc.length > 8 ? 'Ver los ' + svc.length + ' servicios' : 'Ver tabla de servicios', table({
              caption: 'Servicios atendidos',
              cols: [
                { label: 'Servicio', cell: (s) => html`<span class="truncate" style="font-weight:600">${s.name}</span>`, foot: () => 'Total' },
                { label: 'Veces', r: 1, cell: (s) => number(s.count), foot: (t) => number(t.count) },
                { label: 'Ingresos', r: 1, cell: (s) => m0(s.revenue), foot: (t) => m0(t.revenue) },
                { label: '% ingresos', r: 1, cell: (s) => pcCell(s.revenue, svTot.revenue), foot: () => (svTot.revenue ? '100%' : '—') }
              ],
              rows: svc.slice().sort((a, b) => b.revenue - a.revenue || b.count - a.count), foot: svTot
            })) : ''}`, 'wide')}
        </div>
      </section>`;
    }

    function staffSolo(s, k) {
      return html`<div class="rp-cstats">
        <div class="rp-cstat"><span class="nm" style="display:flex;align-items:center;gap:10px">${avatar(s.name, { color: s.color || colorFor(s.name) })}<b style="font-family:var(--sans);font-size:15px;text-align:left">${s.name}</b></span><span></span></div>
        <div class="rp-cstat"><span>Citas agendadas</span><b>${number(s.appointments)}</b></div>
        <div class="rp-cstat"><span>Atendidas</span><b>${number(s.completed)}</b></div>
        <div class="rp-cstat"><span>Ingresos</span><b>${m0(s.revenue)}</b></div>
        <div class="rp-cstat"><span>Ocupación</span><b>${pctText(s.occupancy_pct)}</b><small>De sus horas disponibles en el periodo</small></div>
      </div>`;
    }

    function apptSection(k, days) {
      const st = D.by_status || {};
      const allN = Object.values(st).reduce((a, v) => a + (v || 0), 0);
      const pk = peakOf(D.by_hour);
      const wd = WD_ORDER.map((i) => (D.by_weekday || [])[i] || { weekday: i, count: 0, revenue: 0 });
      const wdTot = wd.reduce((a, x) => ({ count: a.count + x.count, revenue: a.revenue + (Number(x.revenue) || 0) }), { count: 0, revenue: 0 });
      const bestWd = wd.reduce((b, x) => (x.count > (b ? b.count : 0) ? x : b), null);
      const hrTot = (D.by_hour || []).reduce((a, x) => a + x.count, 0);
      const prevK = P === false ? false : P ? P.kpis : null;
      const PR = prevRange(D.range.from, D.range.to);
      return html`<section class="rp-sec" id="rp-citas" aria-labelledby="rpH-citas">
        ${sec('citas', 'Citas', plural(allN, 'cita') + ' en total, incluidas ' + plural(k.cancelled, 'cancelada') + '.')}
        <div class="db-kpis four" id="rpRates">${RATE_KPIS.map((def) => kpiTile(def, k, prevK, null, rangeText(PR.from, PR.to)))}</div>
        <div class="db-grid">
          ${days > 1 ? card('rpApd', 'Citas por ' + (bucketSeries(D.series, days).unit), 'Agendadas (sin canceladas) y atendidas', html`<div class="card-body"><div data-chart="apd" style="min-height:240px"></div></div>`, 'wide') : ''}
          ${card('rpStatus', 'Por estado', 'Todas las citas del periodo', html`<div class="card-body">${statusBars(st)}
            <p class="rp-note">${raw(icon('info'))}<span>La cancelación se calcula sobre todas las citas; «no llegaron» sobre las que ya pasaron (atendidas + no llegaron).</span></p></div>`, days < 7 ? 'wide' : '')}
          ${days < 7 ? '' : card('rpWd', 'Por día de la semana', bestWd && bestWd.count ? 'El día con más citas: ' + WEEKDAYS[bestWd.weekday] : 'Citas agendadas por día', html`
            <div class="card-body">${wdTot.count ? html`<div data-chart="wd"></div>` : emptyState({ icon: 'calendar', title: 'Sin citas', compact: true })}</div>
            ${wdTot.count ? details('Ver tabla por día', table({
              caption: 'Citas e ingresos por día de la semana',
              cols: [
                { label: 'Día', cell: (x) => cap(WEEKDAYS[x.weekday]), foot: () => 'Total' },
                { label: 'Citas', r: 1, cell: (x) => number(x.count), foot: (t) => number(t.count) },
                { label: '% citas', r: 1, cell: (x) => pcCell(x.count, wdTot.count), foot: () => '100%' },
                { label: 'Ingresos', r: 1, cell: (x) => m0(x.revenue), foot: (t) => m0(t.revenue) }
              ],
              rows: wd, foot: wdTot
            })) : ''}`)}
          ${card('rpHour', 'Por hora', pk ? 'La hora más pedida es de ' + hourLabel(pk.hour) + ' a ' + hourLabel(pk.hour + 1) + ' · ' + plural(pk.count, 'cita') : 'Hora de inicio de las citas', html`
            <div class="card-body">${pk ? html`<div data-chart="hour"></div>` : emptyState({ icon: 'clock', title: 'Sin citas', compact: true })}</div>
            ${pk ? details('Ver tabla por hora', table({
              caption: 'Citas por hora de inicio',
              c2: true,
              cols: [
                { label: 'Hora', cell: (x) => hourLabel(x.hour) + ' – ' + hourLabel(x.hour + 1), foot: () => 'Total' },
                { label: 'Citas', r: 1, cell: (x) => number(x.count), foot: () => number(hrTot) },
                { label: '% citas', r: 1, cell: (x) => pcCell(x.count, hrTot), foot: () => '100%' }
              ],
              rows: (D.by_hour || []).filter((x) => x.count > 0), foot: {}
            })) : ''}`, 'wide')}
        </div>
      </section>`;
    }

    function clientSection(k) {
      const nw = k.new_clients || 0, rt = k.returning_clients || 0, tot = nw + rt;
      const pk = P && P.kpis ? P.kpis : null;
      return html`<section class="rp-sec" id="rp-clientes" aria-labelledby="rpH-clientes">
        ${sec('clientes', 'Clientes', tot ? plural(tot, 'cliente distinto', 'clientes distintos') + ' con cita en el periodo.' : 'Quién te visitó en el periodo.')}
        <div class="card db-card" id="rpCli"><div class="card-head"><div><h3>Nuevos y recurrentes</h3><span class="sub">Según su primera cita en la barbería</span></div></div>
          <div class="card-body">${tot ? html`<div class="rp-cli">
              <div data-chart="cli"></div>
              <div class="rp-cstats">
                <div class="rp-cstat"><span>Clientes nuevos</span><b>${number(nw)}${deltaMini(nw, pk ? pk.new_clients : null)}</b><small>${pk ? number(pk.new_clients) + ' en el periodo anterior · su primera cita fue en este' : 'Su primera cita fue en este periodo'}</small></div>
                <div class="rp-cstat"><span>Recurrentes</span><b>${number(rt)}${deltaMini(rt, pk ? pk.returning_clients : null)}</b><small>${pk ? number(pk.returning_clients) + ' en el periodo anterior · ya te habían visitado' : 'Ya te habían visitado antes'}</small></div>
                <div class="rp-cstat"><span>Regresan</span><b>${pctText(share(rt, tot))}</b><small>De cada 10 clientes, ${Math.round(share(rt, tot) / 10)} ya eran tuyos</small></div>
              </div>
            </div>` : emptyState({ icon: 'users', title: 'Sin clientes en el periodo', compact: true })}
            <p class="rp-note rp-noprint">${raw(icon('info'))}<span>Para ver a cada cliente, sus visitas y cuánto ha gastado, entra a <a class="link-btn" href="#/clientes">Clientes</a> o descarga el CSV de clientes.</span></p>
          </div>
        </div>
      </section>`;
    }

    function mountAll(days, filtered) {
      const host = (k) => $('[data-chart="' + k + '"]', body);
      if (days > 1) {
        const B = bucketSeries(D.series, days);
        const PB = P && P.series ? bucketSeries(P.series, days) : null;
        const per = B.unit === 'día' ? 'por día' : B.unit === 'semana' ? 'por semana' : 'por mes';
        const series = [{ name: 'Ingresos', values: B.rows.map((r) => r.revenue), color: 1 }];
        if (PB) series.push({ name: 'Periodo anterior', values: B.rows.map((_, i) => (PB.rows[i] ? PB.rows[i].revenue : null)), color: 'muted' });
        mountChart(charts, 'rev', host('rev'), lineChart, { labels: B.labels, series, format: 'money', area: true, height: 260, label: 'Ingresos ' + per });
        mountChart(charts, 'apd', host('apd'), lineChart, {
          labels: B.labels, format: 'number', height: 240, label: 'Citas ' + per,
          series: [{ name: 'Agendadas', values: B.rows.map((r) => r.appointments), color: 1 }, { name: 'Atendidas', values: B.rows.map((r) => r.completed), color: 2 }]
        });
      }
      const segs = methodSegments(D.by_method);
      if (host('pay')) mountChart(charts, 'pay', host('pay'), donutChart, { segments: segs, format: 'money', centerLabel: 'Cobrado', label: 'Cobros por forma de pago' });
      if (!filtered && host('staff')) paintStaffChart();
      if (host('svc')) paintSvcChart();
      const wd = WD_ORDER.map((i) => (D.by_weekday || [])[i] || { count: 0 });
      const wdMax = wd.reduce((b, x, i) => (x.count > wd[b].count ? i : b), 0);
      if (host('wd')) mountChart(charts, 'wd', host('wd'), barChart, { labels: WD_ORDER.map((i) => cap(WEEKDAYS_SHORT[i])), values: wd.map((x) => x.count), format: 'number', name: 'Citas', highlight: wd[wdMax].count ? wdMax : null, height: 230, label: 'Citas por día de la semana' });
      const pk = peakOf(D.by_hour);
      if (host('hour')) mountChart(charts, 'hour', host('hour'), barChart, { labels: D.by_hour.map((x) => hourLabel(x.hour)), values: D.by_hour.map((x) => x.count), format: 'number', name: 'Citas', highlight: pk ? D.by_hour.indexOf(pk) : null, height: 230, label: 'Citas por hora de inicio' });
      const k = D.kpis;
      if (host('cli')) mountChart(charts, 'cli', host('cli'), donutChart, { segments: [{ label: 'Nuevos', value: k.new_clients, color: 1 }, { label: 'Recurrentes', value: k.returning_clients, color: 2 }], format: 'number', centerLabel: 'Clientes', label: 'Clientes nuevos y recurrentes' });
    }
    function paintStaffChart() {
      const list = (D.by_staff || []).slice().sort((a, b) => b.revenue - a.revenue || b.appointments - a.appointments);
      const byRev = list.some((s) => s.revenue > 0);
      mountChart(charts, 'staff', $('[data-chart="staff"]', body), barChart, byRev
        ? { labels: list.map((s) => s.name), values: list.map((s) => s.revenue), horizontal: true, format: 'money', name: 'Ingresos', color: 1, label: 'Ingresos por barbero' }
        : { labels: list.map((s) => s.name), values: list.map((s) => s.appointments), horizontal: true, format: 'number', name: 'Citas', color: 1, label: 'Citas por barbero' });
    }
    function paintSvcChart() {
      const by = UI.svcBy;
      const list = (D.by_service || []).slice().sort((a, b) => (b[by] - a[by]) || (b.count - a.count)).slice(0, 8);
      mountChart(charts, 'svc', $('[data-chart="svc"]', body), barChart, { labels: list.map((s) => s.name), values: list.map((s) => s[by]), horizontal: true, format: by === 'revenue' ? 'money' : 'number', name: by === 'revenue' ? 'Ingresos' : 'Veces', color: 2, label: 'Servicios más vendidos' });
    }

    // ── Navegación por secciones (sigue el scroll) ──
    let io = null, ioStick = null;
    function spy() {
      if (io) io.disconnect();
      if (!('IntersectionObserver' in window)) return;
      const nav = $('.rp-nav', el);
      const vis = new Map();
      io = new IntersectionObserver((entries) => {
        entries.forEach((e) => vis.set(e.target.id, e.isIntersecting));
        const cur = SECTIONS.map(([k]) => 'rp-' + k).find((id) => vis.get(id));
        if (cur) setCurrent(cur.slice(3));
      }, { rootMargin: '-35% 0px -60% 0px' });
      SECTIONS.forEach(([k]) => { const s = $('#rp-' + k, el); if (s) io.observe(s); });
      if (!ioStick && nav) {
        const sentinel = document.createElement('div');
        sentinel.style.cssText = 'height:1px;margin-top:-1px';
        nav.parentNode.insertBefore(sentinel, nav);
        ioStick = new IntersectionObserver(([e]) => nav.classList.toggle('stuck', !e.isIntersecting && e.boundingClientRect.top < 100), { rootMargin: '-' + 64 + 'px 0px 0px 0px' });
        ioStick.observe(sentinel);
      }
    }
    function syncNav() { $$('.rp-nav [data-go]', el).forEach((b) => { b.hidden = !$('#rp-' + b.dataset.go, el); }); }
    function setCurrent(k) {
      const nav = $('.rp-nav', el);
      $$('.rp-nav [data-go]', el).forEach((b) => {
        const on = b.dataset.go === k;
        b.setAttribute('aria-current', String(on));
        // Que la sección activa siempre se vea en la barra (móvil: se desplaza de lado).
        if (on && nav && (b.offsetLeft < nav.scrollLeft || b.offsetLeft + b.offsetWidth > nav.scrollLeft + nav.clientWidth)) {
          try { nav.scrollTo({ left: Math.max(0, b.offsetLeft - 16), behavior: 'smooth' }); } catch (e) { nav.scrollLeft = b.offsetLeft - 16; }
        }
      });
    }

    // ── Exportar ──
    async function doExport(type, btn) {
      const x = EXPORTS.find((e) => e.type === type);
      const R = rangeOf(S.r, S);
      try {
        const res = await busy(btn, () => api.raw('/reports/export', { type, from: R.from, to: R.to }));
        if (!res) return;
        const bodyText = typeof res.body === 'string' ? res.body : '';
        saveFile(res.filename || ('tubarberia-' + type + '-' + R.from + '_' + R.to + '.csv'), bodyText, res.contentType || 'text/csv;charset=utf-8');
        const n = csvRows(bodyText.replace(/^﻿/, ''));
        const shown = type === 'commissions' ? Math.max(0, n - 1) : n; // comisiones trae un renglón de total
        if (!shown) toast.info('Descargamos «' + x.t + '», pero no hay ' + x.unit[1] + ' del ' + rangeText(R.from, R.to) + '. El archivo solo trae los encabezados.');
        else toast.success('Descargaste ' + plural(shown, x.unit[0], x.unit[1]) + ' del ' + rangeText(R.from, R.to) + '.');
      } catch (err) { toast.error(err); }
    }

    // ── Imprimir ──
    let printPrep = false;
    const isDark = () => { const t = document.documentElement.getAttribute('data-theme'); return t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches); };
    function beforePrint() {
      $$('details.rp-more', el).forEach((d) => { d.dataset.was = d.open ? '1' : ''; d.open = true; });
    }
    function afterPrint() {
      $$('details.rp-more', el).forEach((d) => { d.open = d.dataset.was === '1'; });
      if (printPrep) { printPrep = false; document.documentElement.classList.remove('rp-printing'); }
    }
    async function doPrint(btn) {
      if (!D) { toast.info('Espera a que carguen los datos para imprimir.'); return; }
      await busy(btn, async () => {
        // Tema claro y ancho de hoja antes de imprimir: las gráficas se redibujan a ese tamaño y colores.
        printPrep = true;
        document.documentElement.classList.add('rp-printing');
        beforePrint();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, isDark() ? 320 : 220))));
      });
      // En Safari/iOS print() no bloquea: 'afterprint' limpia (y, por si no llega, al volver el foco).
      window.print();
    }
    const onBeforePrint = () => { if (!printPrep) beforePrint(); };
    const onAfterPrint = () => afterPrint();
    const onFocusBack = () => { if (printPrep) setTimeout(() => { if (printPrep) afterPrint(); }, 600); };
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    window.addEventListener('focus', onFocusBack);

    // ── Eventos ──
    const offs = [];
    offs.push(wireFilters(filtersEl, { presets: RP_PRESETS, S, storeKey: 'reports', staff: () => staff, onChange: () => { syncUrl(); paintExportNote(); load(); } }));
    offs.push(on(el, 'click', '#rpBody [data-range]', (e, b) => { S.r = b.dataset.range; S.desde = ''; S.hasta = ''; writePrefs('reports', S); paintFilters(filtersEl, RP_PRESETS, S, staff); syncUrl(); paintExportNote(); load(); }));
    offs.push(on(el, 'click', '[data-act="all-staff"]', () => { S.barbero = ''; writePrefs('reports', S); paintFilters(filtersEl, RP_PRESETS, S, staff); syncUrl(); paintExportNote(); load(); }));
    offs.push(on(el, 'click', '#rpRetry', () => { first = true; body.innerHTML = skeleton(); load(); }));
    offs.push(on(el, 'click', '[data-go]', (e, b) => {
      const s = $('#rp-' + b.dataset.go, el);
      if (!s) return;
      setCurrent(b.dataset.go);
      s.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }));
    offs.push(on(el, 'click', '[data-svc]', (e, b) => {
      if (UI.svcBy === b.dataset.svc) return;
      UI.svcBy = b.dataset.svc;
      $$('[data-svc]', el).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.svc === UI.svcBy)));
      paintSvcChart();
    }));
    offs.push(on(el, 'click', '[data-export]', (e, b) => doExport(b.dataset.export, b)));
    offs.push(on(el, 'click', '[data-act="export-menu"]', (e, b) => {
      menu(b, EXPORTS.map((x) => ({ label: x.t + ' (CSV)', icon: x.icon, onClick: () => doExport(x.type, b) })));
    }));
    offs.push(on(el, 'click', '[data-act="print"]', (e, b) => doPrint(b)));

    let tRefresh = null;
    const refresh = () => { clearTimeout(tRefresh); tRefresh = setTimeout(() => { if (!gone && D) load(true); }, 400); };
    offs.push(bus.on('appointments:changed', refresh));
    offs.push(bus.on('payments:changed', refresh));
    const onVis = () => { if (!document.hidden && D && Date.now() - lastLoad > 60000) load(true); };
    document.addEventListener('visibilitychange', onVis);

    if (can('staff.read')) {
      getStaff(true).then((list) => {
        if (gone) return;
        staff = (list || []).filter((s) => s.active !== false || s.id === S.barbero);
        paintFilters(filtersEl, RP_PRESETS, S, staff);
      }).catch(() => {});
    }

    await load();
    return () => {
      gone = true;
      clearTimeout(tRefresh);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
      window.removeEventListener('focus', onFocusBack);
      document.documentElement.classList.remove('rp-printing');
      if (io) io.disconnect();
      if (ioStick) ioStick.disconnect();
      offs.forEach((f) => f());
      destroyCharts(charts);
    };
  }
};

