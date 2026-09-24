// #/inicio — Inicio del panel.
//
//   Dueño / superadmin (reports.read): tablero del negocio con GET /api/reports/dashboard.
//     · Bloque "Hoy" (todo el equipo): próximas citas con acciones rápidas, cobrado / esperado, atajos
//       (recordatorios de mañana → #/mensajes, caja → #/caja) y botón de nueva cita.
//     · "Tu negocio": filtros de periodo (Hoy, 7 días, 30 días, Este mes, Mes pasado, Personalizado) y
//       barbero — en la URL (?r=&desde=&hasta=&barbero=) y recordados en este dispositivo —, KPIs con
//       variación contra el periodo anterior, ingresos/citas por día, barbero más activo, ranking del
//       equipo, servicios más vendidos, formas de pago y horas pico.
//     · ?bienvenida=1 → tarjeta de primeros pasos.
//   Barbero: "Mi día" — próxima cita destacada, línea de tiempo de hoy con acciones (Confirmar, Atendida,
//     Cobrar), KPIs propios (citas hoy, atendidas, ingresos de la semana, comisión estimada del mes con
//     GET /api/commissions) y su semana en mini calendario.
//   Se refresca al volver a la pestaña y con los eventos 'appointments:changed' / 'payments:changed'.
//
// Exporta utilidades que reutiliza #/reportes (reports.js):
//   PRESETS, MAX_DAYS, rangeOf(key, q), prevRange(from, to), rangeText(from, to), shortDay(key),
//   readPrefs(k), writePrefs(k, v), initialFilters(query, presets, def, storeKey),
//   filtersHtml(presets, S, staff|null), paintFilters(el, presets, S, staff), wireFilters(el, { presets, S, storeKey, staff, onChange }),
//   deltaInfo(cur, prev, { invert, pts }), deltaHtml(d, prevText), kpiTile(def, k, prevK|null|false, series, prevText),
//   animateKpis(root, defs, first), bucketSeries(series, days), mountChart(store, key, host, factory, opts), destroyCharts(store),
//   METHOD_ORDER, METHOD_ICON, methodSegments(by_method), hourLabel(h), peakOf(by_hour), statusBars(by_status),
//   kpiSkeleton(n, cls), cardSkeleton(h, cls), injectDashStyle(), pctText(n), greeting()
import { html, raw, $, $$, on } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { api, LS } from '../lib/api.js';
import { state, bus, can, canAny, shop, today, nowMin, me, getStaff } from '../lib/state.js';
import { setQuery } from '../lib/router.js';
import { toast, modal, avatar, emptyState, errorState, animateNumber, statusBadge } from '../lib/ui.js';
import { money, number, time, dateLongCap, addDays, diffDays, startOfWeek, startOfMonth, endOfMonth, addMonths, firstName, plural, MONTHS_SHORT, WEEKDAYS_SHORT, METHOD, colorFor, statusLabel } from '../lib/fmt.js';
import { lineChart, barChart, donutChart, sparkline } from '../lib/charts.js';

// ═════════════════════════════════════════════════════════════════════
// Utilidades compartidas (también las usa reports.js)
// ═════════════════════════════════════════════════════════════════════
export const PRESETS = { hoy: 'Hoy', '7d': '7 días', '30d': '30 días', mes: 'Este mes', mes_ant: 'Mes pasado', '90d': '90 días', anio: 'Este año', otro: 'Personalizado' };
export const MAX_DAYS = 400;
const isKey = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const dec = (n) => r1(n).toLocaleString('es-MX', { maximumFractionDigits: 1 }); // es-MX: punto decimal (igual que las gráficas)
export const pctText = (n) => dec(n) + '%';
const sheet = () => import('../lib/appointment-sheet.js');
const ACTIVE = ['pending', 'confirmed'];
const canWrite = () => canAny(['appointments.write.all', 'appointments.write.own']);
const hasStarted = (a) => a.date < today() || (a.date === today() && a.start_min <= nowMin() + 60);

export function rangeOf(key, q) {
  const t = today();
  q = q || {};
  switch (key) {
    case 'hoy': return { from: t, to: t };
    case '7d': return { from: addDays(t, -6), to: t };
    case '90d': return { from: addDays(t, -89), to: t };
    case 'mes': return { from: startOfMonth(t), to: t };
    case 'mes_ant': { const s = addMonths(t, -1); return { from: s, to: endOfMonth(s) }; }
    case 'anio': return { from: t.slice(0, 4) + '-01-01', to: t };
    case 'otro': {
      let from = isKey(q.desde) ? q.desde : addDays(t, -29), to = isKey(q.hasta) ? q.hasta : t;
      if (to < from) { const x = from; from = to; to = x; }
      if (diffDays(from, to) + 1 > MAX_DAYS) from = addDays(to, -(MAX_DAYS - 1));
      return { from, to };
    }
    default: return { from: addDays(t, -29), to: t };
  }
}
export function prevRange(from, to) { const n = diffDays(from, to) + 1; return { from: addDays(from, -n), to: addDays(from, -1) }; }
const dm = (k) => { const p = k.split('-').map(Number); return { y: p[0], m: p[1], d: p[2] }; };
export function rangeText(from, to) {
  const a = dm(from), b = dm(to), M = MONTHS_SHORT;
  if (from === to) return a.d + ' ' + M[a.m - 1] + ' ' + a.y;
  if (a.y === b.y && a.m === b.m) return a.d + '–' + b.d + ' ' + M[a.m - 1] + ' ' + a.y;
  if (a.y === b.y) return a.d + ' ' + M[a.m - 1] + ' – ' + b.d + ' ' + M[b.m - 1] + ' ' + b.y;
  return a.d + ' ' + M[a.m - 1] + ' ' + a.y + ' – ' + b.d + ' ' + M[b.m - 1] + ' ' + b.y;
}
export const shortDay = (k) => { const p = dm(k); return p.d + ' ' + MONTHS_SHORT[p.m - 1]; };

// Preferencias por barbería en este dispositivo (periodo y barbero elegidos).
const prefKey = (k) => 'tb:' + k + ':' + (state.shopId || '');
export function readPrefs(k) { try { return JSON.parse(LS.get(prefKey(k)) || 'null') || {}; } catch (e) { return {}; } }
export function writePrefs(k, v) { LS.set(prefKey(k), JSON.stringify(v)); }

// Estado inicial de filtros: la URL manda; si no trae periodo, lo recordado; si no, el predeterminado.
export function initialFilters(query, presets, def, storeKey) {
  const saved = readPrefs(storeKey);
  const src = presets.includes(query.r) ? query : (presets.includes(saved.r) ? saved : { r: def });
  return { r: src.r, desde: src.r === 'otro' ? (src.desde || '') : '', hasta: src.r === 'otro' ? (src.hasta || '') : '', barbero: query.r ? (query.barbero || '') : (saved.barbero || '') };
}

// ── Filtros: periodo (segmentado en tablet/escritorio, hoja inferior en móvil) + barbero ──
export function filtersHtml(presets, S, staff) {
  return html`<div class="db-filters" role="group" aria-label="Filtros del periodo">
    <div class="seg db-seg" role="group" aria-label="Periodo">${presets.map((k) => html`<button type="button" data-range="${k}" aria-pressed="${String(k === S.r)}">${PRESETS[k]}</button>`)}</div>
    <button type="button" class="btn btn-secondary db-range-btn" data-act="range-sheet" aria-haspopup="dialog">${raw(icon('calendar', 'ic-sm'))}<span class="grow truncate" data-range-label>${PRESETS[S.r]}</span>${raw(icon('chevron-down', 'ic-sm'))}</button>
    ${staff ? html`<label class="db-staff"><span class="sr">Barbero</span><select class="select" data-staff aria-label="Filtrar por barbero">${staffOptions(staff, S.barbero)}</select></label>` : ''}
  </div>
  <p class="db-cap" data-cap aria-live="polite"></p>`;
}
function staffOptions(list, sel) {
  return html`<option value="">Todo el equipo</option>${(list || []).map((s) => html`<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${s.name}${s.active === false ? ' (inactivo)' : ''}</option>`)}`;
}
export function paintFilters(el, presets, S, staff) {
  $$('[data-range]', el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.range === S.r)));
  const R = rangeOf(S.r, S), P = prevRange(R.from, R.to);
  const lbl = $('[data-range-label]', el);
  if (lbl) lbl.textContent = S.r === 'otro' ? rangeText(R.from, R.to) : PRESETS[S.r];
  const sel = $('[data-staff]', el);
  if (sel && staff) { sel.innerHTML = String(staffOptions(staff, S.barbero)); sel.value = S.barbero || ''; }
  const cap = $('[data-cap]', el);
  if (cap) {
    const who = S.barbero && staff ? (staff.find((s) => s.id === S.barbero) || {}).name : '';
    cap.innerHTML = String(html`${raw(icon('calendar'))}<b>${rangeText(R.from, R.to)}</b><span>· comparado con ${rangeText(P.from, P.to)}</span>${who ? html`<span>· solo ${who}</span>` : ''}`);
  }
}
// opts: { presets, S, storeKey, onChange(), staff: () => list }
export function wireFilters(el, opts) {
  const { presets, S } = opts;
  const apply = (patch) => {
    Object.assign(S, patch);
    if (S.r !== 'otro') { S.desde = ''; S.hasta = ''; }
    writePrefs(opts.storeKey, { r: S.r, desde: S.desde, hasta: S.hasta, barbero: S.barbero });
    paintFilters(el, presets, S, opts.staff && opts.staff());
    opts.onChange();
  };
  const offs = [
    on(el, 'click', '[data-range]', async (e, b) => {
      const k = b.dataset.range;
      if (k === 'otro') { const p = await openRangeSheet({ presets, S, customOnly: true }); if (p) apply(p); return; }
      if (k !== S.r) apply({ r: k });
    }),
    on(el, 'click', '[data-act="range-sheet"]', async () => { const p = await openRangeSheet({ presets, S }); if (p) apply(p); }),
    on(el, 'change', '[data-staff]', (e, s) => apply({ barbero: s.value }))
  ];
  return () => offs.forEach((f) => f());
}

// Hoja de periodo: presets como renglones (móvil) + rango personalizado con dos fechas.
function openRangeSheet({ presets, S, customOnly }) {
  const cur = rangeOf(S.r, S);
  const rows = customOnly ? [] : presets.filter((k) => k !== 'otro');
  const m = modal({
    title: customOnly ? 'Periodo personalizado' : 'Elige el periodo',
    subtitle: customOnly ? 'Elige desde qué día y hasta qué día.' : '',
    size: 'sm',
    body: String(html`
      ${rows.length ? html`<div class="list db-plist" role="listbox" aria-label="Periodos">${rows.map((k) => { const r = rangeOf(k, {}); const sel = k === S.r; return html`<button type="button" class="list-item" role="option" aria-selected="${String(sel)}" data-p="${k}"><span class="grow"><span class="title" style="display:block">${PRESETS[k]}</span><span class="meta">${rangeText(r.from, r.to)}</span></span>${sel ? raw(icon('check', 'brand-t')) : ''}</button>`; })}</div>
        <div class="db-plist-sep"><span>o elige las fechas</span></div>` : ''}
      <form class="db-custom" id="dbCustom" novalidate>
        <div class="db-dates">
          <div class="field"><label for="dbFrom">Desde</label><input class="input" type="date" id="dbFrom" name="desde" value="${cur.from}" required/><p class="error">Elige la fecha inicial.</p></div>
          <div class="field"><label for="dbTo">Hasta</label><input class="input" type="date" id="dbTo" name="hasta" value="${cur.to}" required/><p class="error">Elige la fecha final.</p></div>
        </div>
        <p class="hint faint" style="font-size:12.5px;margin-top:8px">Hasta ${MAX_DAYS} días. Se compara con el mismo número de días inmediatamente anteriores.</p>
      </form>`),
    actions: [
      { label: 'Cancelar', variant: 'secondary', value: null },
      { label: 'Aplicar fechas', variant: 'primary', type: 'submit', form: 'dbCustom', close: false }
    ]
  });
  const form = m.body.querySelector('#dbCustom');
  const fail = (name, msg) => { const f = form.querySelector('[name="' + name + '"]').closest('.field'); f.classList.add('invalid'); f.querySelector('.error').textContent = msg; };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    form.querySelectorAll('.field').forEach((f) => f.classList.remove('invalid'));
    const from = form.desde.value, to = form.hasta.value;
    let bad = false;
    if (!isKey(from)) { fail('desde', 'Elige la fecha inicial.'); bad = true; }
    if (!isKey(to)) { fail('hasta', 'Elige la fecha final.'); bad = true; }
    if (!bad && to < from) { fail('hasta', 'Debe ser igual o posterior a la fecha inicial.'); bad = true; }
    if (!bad && diffDays(from, to) + 1 > MAX_DAYS) { fail('hasta', 'El periodo puede ser de máximo ' + MAX_DAYS + ' días.'); bad = true; }
    if (bad) { m.el.classList.remove('shake'); void m.el.offsetWidth; m.el.classList.add('shake'); return; }
    m.close({ r: 'otro', desde: from, hasta: to });
  });
  m.body.addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (b) m.close({ r: b.dataset.p }); });
  return m.done.then((v) => v || null);
}

// ── Variación contra el periodo anterior ──
// o: { invert: true (subir es malo), pts: true (diferencia en puntos porcentuales) }
export function deltaInfo(cur, prev, o) {
  o = o || {};
  if (prev == null || cur == null) return null;
  cur = Number(cur) || 0; prev = Number(prev) || 0;
  let dir, txt, sr;
  if (o.pts) {
    const d = r1(cur - prev);
    dir = Math.abs(d) < 0.1 ? 'flat' : d > 0 ? 'up' : 'down';
    txt = dir === 'flat' ? 'Igual' : dec(Math.abs(d)) + ' pts';
    sr = dir === 'flat' ? 'igual que el periodo anterior' : (dir === 'up' ? 'subió ' : 'bajó ') + dec(Math.abs(d)) + ' puntos frente al periodo anterior';
  } else if (!prev) {
    dir = cur ? 'up' : 'flat';
    txt = cur ? 'Nuevo' : 'Igual';
    sr = cur ? 'en el periodo anterior no hubo' : 'igual que el periodo anterior';
  } else {
    const p = ((cur - prev) / prev) * 100;
    dir = Math.abs(p) < 0.5 ? 'flat' : p > 0 ? 'up' : 'down';
    txt = dir === 'flat' ? 'Igual' : (Math.abs(p) >= 100 ? Math.round(Math.abs(p)) + '%' : pctText(Math.abs(p)));
    sr = dir === 'flat' ? 'igual que el periodo anterior' : (dir === 'up' ? 'subió ' : 'bajó ') + txt + ' frente al periodo anterior';
  }
  const tone = dir === 'flat' ? 'flat' : ((dir === 'up') !== !!o.invert ? 'up' : 'down');
  return { dir, tone, txt, sr };
}
export function deltaHtml(d, prevText) {
  if (!d) return html`<span class="skel db-dskel" aria-hidden="true"></span>`;
  const ic = d.dir === 'up' ? 'arrow-up' : d.dir === 'down' ? 'arrow-down' : 'minus';
  return html`<span class="delta ${d.tone}" title="${'Comparado con ' + (prevText || 'el periodo anterior')}">${raw(icon(ic))}<span aria-hidden="true">${d.txt}</span><span class="sr">${d.sr}</span></span>`;
}

// ── KPI ──
// def: { k, label, icon, fmt(n), val(k)?, prev(kp)?, invert?, pts?, foot(k)?, bar?(k), spark?: 'revenue'|'appointments' }
export function kpiTile(def, k, prevK, series, prevText) {
  const val = def.val ? def.val(k) : k[def.k];
  const pv = prevK == null ? null : (def.prev ? def.prev(prevK) : (def.val ? def.val(prevK) : prevK[def.k]));
  const d = prevK === false ? null : deltaInfo(val, pv, def);
  const spark = def.spark && series && series.length > 2 && series.some((s) => Number(s[def.spark]) > 0) ? sparkline(series.map((s) => s[def.spark]), { width: 64, height: 22, label: def.label + ' por día' }) : '';
  return html`<div class="card kpi db-kpi" data-k="${def.k}">
    <div class="label">${raw(icon(def.icon))}${def.label}</div>
    <div class="value" data-to="${val}" data-kpi="${def.k}">${def.fmt(val)}</div>
    <div class="db-kpi-row">${prevK === false ? html`<span class="delta flat">${raw(icon('minus'))}Sin comparación</span>` : deltaHtml(d, prevText)}${raw(spark)}</div>
    ${def.bar ? html`<div class="progress-bar" aria-hidden="true"><span style="width:${Math.max(0, Math.min(100, def.bar(k)))}%"></span></div>` : ''}
    ${def.foot ? html`<div class="foot">${def.foot(k)}</div>` : ''}
  </div>`;
}
// Anima los números la primera vez (y cuando cambian); después sólo actualiza el texto.
const lastVals = new WeakMap();
export function animateKpis(root, defs, first) {
  const seen = lastVals.get(root) || {};
  $$('[data-kpi]', root).forEach((v) => {
    const def = defs.find((d) => d.k === v.dataset.kpi);
    const to = Number(v.dataset.to) || 0;
    if (!def) return;
    if (first || seen[def.k] == null) animateNumber(v, to, def.fmt, 800);
    else if (seen[def.k] !== to) { v.classList.remove('flash'); void v.offsetWidth; v.closest('.kpi').classList.add('flash'); }
    seen[def.k] = to;
  });
  lastVals.set(root, seen);
}

// ── Series: por día (≤ 45 días), por semana (≤ 190) o por mes ──
export function bucketSeries(series, days) {
  series = series || [];
  if (days <= 45) return { unit: 'día', labels: series.map((s) => s.date), rows: series };
  const weekly = days <= 190;
  const map = new Map();
  for (const s of series) {
    const key = weekly ? startOfWeek(s.date) : s.date.slice(0, 7);
    const g = map.get(key) || { key, first: s.date, revenue: 0, appointments: 0, completed: 0 };
    g.revenue += Number(s.revenue) || 0; g.appointments += s.appointments || 0; g.completed += s.completed || 0;
    map.set(key, g);
  }
  const rows = Array.from(map.values()).map((g) => Object.assign(g, { revenue: Math.round(g.revenue * 100) / 100 }));
  return { unit: weekly ? 'semana' : 'mes', labels: rows.map((g) => (weekly ? 'Sem. ' + shortDay(g.first) : g.key)), rows };
}

// Crea o actualiza (con transición) una gráfica guardada en `store`.
export function mountChart(store, key, host, factory, opts) {
  const c = store.get(key);
  if (c && c.el && c.el.isConnected && host.contains(c.el)) { c.update(opts); return c; }
  if (c) { try { c.destroy(); } catch (e) { /* */ } }
  if (!host) return null;
  const n = factory(host, opts);
  store.set(key, n);
  return n;
}
export function destroyCharts(store) { store.forEach((c) => { try { c.destroy(); } catch (e) { /* */ } }); store.clear(); }

export const METHOD_ORDER = ['cash', 'card', 'transfer', 'other'];
export const METHOD_ICON = { cash: 'cash', card: 'card', transfer: 'transfer', other: 'receipt' };
export function methodSegments(by) {
  // Color fijo por forma de pago (no por posición): filtrar no repinta.
  return METHOD_ORDER.map((m, i) => ({ label: METHOD[m], value: Number((by || {})[m]) || 0, color: i + 1, m })).filter((s) => s.value > 0 || s.m !== 'other');
}
export const hourLabel = (h) => h + ':00';
export function peakOf(byHour) {
  let pk = null;
  for (const x of byHour || []) if (x.count > 0 && (!pk || x.count > pk.count)) pk = x;
  return pk;
}

// ═════════════════════════════════════════════════════════════════════
// Estilos
// ═════════════════════════════════════════════════════════════════════
const CSS = `
.db .stack,.db .list,.db .stack-sm{grid-template-columns:minmax(0,1fr)}
.db-head{align-items:flex-end}
.db-head .eyebrow{display:block;margin-bottom:6px}
.db-head h2{font-size:32px}
@media (min-width:1024px){.db-head h2{font-size:38px}}
.db-filters{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.db-range-btn{display:none}
.db-staff{margin-left:auto;min-width:0;display:block}
.db-staff .select{min-width:210px;min-height:40px;font-weight:500}
.db-cap{display:flex;align-items:center;gap:4px 6px;flex-wrap:wrap;margin:10px 0 16px;font-size:12.5px;color:var(--text-3);min-height:19px}
.db-cap b{color:var(--text-2);font-weight:600}
.db-cap .ic{width:14px;height:14px}
@media (max-width:719px){
  .db-filters .db-seg{display:none}
  .db-range-btn{display:inline-flex;flex:1 1 0;min-width:0;justify-content:flex-start;padding:0 12px;min-height:44px}
  .db-range-btn .grow{text-align:left}
  .db-staff{flex:1 1 0;margin-left:0}
  .db-staff .select{min-width:0;width:100%;min-height:44px}
}
.db-plist{margin:0 -20px}
.db-plist .list-item{min-height:56px}
.db-plist .meta{display:block}
.db-plist [aria-selected="true"] .title{color:var(--brand-strong)}
.db-plist-sep{display:flex;align-items:center;gap:12px;margin:14px 0 12px;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3)}
.db-plist-sep::before,.db-plist-sep::after{content:"";flex:1;height:1px;background:var(--border)}
.db-dates{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.db-dates .input{min-width:0}
.db-sec{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:32px 0 12px}
.db-sec h3{font-family:var(--disp);font-size:25px;font-weight:800;letter-spacing:.01em;line-height:1.05}
.db-sec p{font-size:13.5px;color:var(--text-2);margin-top:3px}
.db-sec .link-btn{white-space:nowrap;min-height:44px}
.db-kpis{display:grid;gap:12px;grid-template-columns:repeat(2,minmax(0,1fr))}
@media (min-width:720px){.db-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.db-kpis.four{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media (min-width:1280px){.db-kpis.six{grid-template-columns:repeat(6,minmax(0,1fr))}}
.db-kpi{min-height:132px;align-content:start;gap:5px}
@media (min-width:1280px){.db-kpis.six .db-kpi{min-height:156px}}
.db-kpi .value{font-size:30px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (min-width:1280px){.db-kpis.six .db-kpi .value{font-size:29px}}
.db-kpi-row{display:flex;align-items:center;gap:8px;min-height:22px}
.db-kpi-row .delta .ic{width:12px;height:12px;stroke-width:2.6}
.db-kpi-row .tbc-spark{margin-left:auto;flex:none}
.db-kpi .foot{line-height:1.35}
.db-kpi .progress-bar{height:5px;margin:3px 0 1px}
.db-kpi.flash{animation:flash 1.2s var(--ease)}
.db-dskel{display:inline-block;width:62px;height:14px;border-radius:6px}
.db-grid{display:grid;gap:16px;grid-template-columns:minmax(0,1fr);margin-top:16px}
@media (min-width:900px){.db-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.db-grid>.wide{grid-column:1/-1}}
@media (min-width:1180px){.db-grid.lead{grid-template-columns:minmax(0,1.8fr) minmax(300px,1fr)}}
.db-card{display:flex;flex-direction:column;min-width:0}
.db-card .card-head{align-items:flex-start;flex-wrap:wrap;row-gap:8px}
.db-card .card-head>div:first-child{min-width:0;flex:1 1 200px}
.db-card .card-head .sub{display:block;margin-top:2px;line-height:1.4}
.db-card .card-body{flex:1;min-width:0}
.db-card .seg button{min-height:32px;font-size:12.5px;padding:0 11px}
@media (pointer:coarse){.db .btn-sm,.db .db-appt .acts .btn-sm{--h:44px}.db .db-card .seg button{min-height:44px;padding:0 14px}.db .link-btn,.db .db-foot-link .link-btn{min-height:44px}}
.db-a{transition:opacity .25s var(--ease)}
.db-busy{opacity:.5;pointer-events:none}
.db-skel-card{border:0;box-shadow:none}
.db-foot-link{display:flex;justify-content:flex-end;padding:0 18px 14px;margin-top:-4px}
.db-foot-link .link-btn{font-size:13px;min-height:36px}
.db-top{position:relative;overflow:hidden;background:var(--ink);color:var(--on-ink);border:1px solid rgba(242,237,227,.07);border-radius:var(--r-lg);box-shadow:var(--shadow-2);padding:20px;display:flex;flex-direction:column;gap:18px}
.db-top::before{content:"";position:absolute;right:-150px;top:-170px;width:400px;height:400px;background:radial-gradient(circle,rgba(217,178,90,.25),transparent 62%);pointer-events:none}
.db-top>*{position:relative}
.db-top .eyebrow{color:#D9B25A;display:flex;align-items:center;gap:6px}
.db-top .eyebrow .ic{width:15px;height:15px}
.db-top-who{display:flex;align-items:center;gap:14px;min-width:0}
.db-top-who .avatar{box-shadow:0 0 0 3px #15130F,0 0 0 5px rgba(217,178,90,.55)}
.db-top-who b{display:block;font-family:var(--disp);font-size:30px;font-weight:800;line-height:1.02;color:#F7F2E8;letter-spacing:.01em}
.db-top-who span{font-size:13px;color:#BDB5A5}
.db-top-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding-top:16px;border-top:1px solid rgba(242,237,227,.1)}
.db-top-stats span{display:block;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9E968A}
.db-top-stats b{display:block;font-size:21px;font-weight:700;color:#F2EDE3;font-variant-numeric:tabular-nums;margin-top:3px;white-space:nowrap}
.db-share{display:grid;gap:12px;font-size:12.5px;color:#BDB5A5;margin-top:auto}
.db-share>div{display:grid;gap:6px}
.db-lead{display:flex;align-items:center;gap:6px;padding-top:12px;border-top:1px solid rgba(242,237,227,.1);color:#BDB5A5;font-size:12.5px}
.db-lead .ic{color:#D9B25A;width:14px;height:14px}
.db-share .bar{height:6px;border-radius:999px;background:rgba(242,237,227,.1);overflow:hidden}
.db-share .bar span{display:block;height:100%;border-radius:inherit;background:#D9B25A;transform-origin:left;animation:growX .9s var(--ease-out) both}
.db-share b{color:#F2EDE3}
.db-top .db-dark-btn{align-self:flex-start;background:rgba(242,237,227,.08);color:#F2EDE3;border:1px solid rgba(242,237,227,.14)}
.db-top .db-dark-btn:hover{background:rgba(242,237,227,.14)}
.db-rank{display:grid}
.db-rank-row{display:grid;grid-template-columns:16px 36px minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 0;border-bottom:1px solid var(--border);text-decoration:none;color:inherit}
.db-rank-row:last-child{border-bottom:0}
.db-rank-row .pos{font-size:12px;font-weight:700;color:var(--text-3);text-align:center;font-variant-numeric:tabular-nums}
.db-rank-row .nm{font-weight:600;font-size:14px}
.db-rank-row .bar{height:6px;border-radius:999px;background:var(--surface-3);margin-top:7px;overflow:hidden}
.db-rank-row .bar span{display:block;height:100%;border-radius:inherit;background:var(--chart-1,var(--brand));transform-origin:left;animation:growX .8s var(--ease-out) both}
.db-rank-row .v{text-align:right;font-weight:700;font-size:14.5px;font-variant-numeric:tabular-nums;white-space:nowrap}
.db-rank-row .v small{display:block;font-weight:500;font-size:12px;color:var(--text-3)}
.db-today-grid{display:grid;gap:16px;grid-template-columns:minmax(0,1fr)}
@media (min-width:1024px){.db-today-grid{grid-template-columns:minmax(0,1fr) 316px;align-items:start}}
.db-today{overflow:hidden}
.db-today .card-head{padding-bottom:2px}
.db-today .card-head h3{font-family:var(--disp);font-size:22px;font-weight:800;letter-spacing:.01em}
.db-tstats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:12px 18px 2px}
.db-tstats>div{display:grid;gap:1px;min-width:0}
.db-tstats span{font-size:11px;color:var(--text-3);font-weight:700;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.db-tstats b{font-family:var(--disp);font-size:25px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums;white-space:nowrap}
@media (max-width:519px){.db-tstats{grid-template-columns:repeat(2,minmax(0,1fr));row-gap:12px}}
.db-tprog{margin:12px 18px 8px;display:grid;gap:6px;font-size:12px;color:var(--text-3)}
.db-tprog .progress-bar>span{background:var(--ok)}
.db-alist{display:grid;border-top:1px solid var(--border)}
.db-alist-t{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 18px 4px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3)}
.db-appt{display:flex;align-items:center;gap:6px;padding-right:16px;position:relative}
.db-appt+.db-appt{border-top:1px solid var(--border)}
.db-appt-main{flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:11px 6px 11px 18px;text-align:left;min-height:64px;transition:background .12s}
.db-appt-main:hover{background:var(--surface-2)}
.db-appt-time{display:grid;justify-items:start;width:64px;flex:none}
.db-appt-time b{font-family:var(--mono);font-size:15px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1.2}
.db-appt-time small{font-size:11.5px;color:var(--text-3);white-space:nowrap}
.db-appt-time small.now{color:var(--ok);font-weight:700}
.db-appt .stripe{width:3px;align-self:stretch;border-radius:3px;background:var(--c,var(--brand));flex:none}
.db-appt .who{display:grid;min-width:0;gap:1px;flex:1}
.db-appt .who b{font-size:14.5px;font-weight:600}
.db-appt .who span{font-size:12.5px;color:var(--text-2)}
.db-appt .acts{display:flex;gap:6px;align-items:center;flex:none}
.db-appt .acts .btn-sm{--h:36px}
.db-appt.done .db-appt-main{opacity:.6}
@media (max-width:519px){.db-appt.has-act .badge{display:none}.db-appt-time{width:60px}.db-appt-main{gap:10px;padding-left:16px}}
.db-today .card-head .db-to-agenda{flex:none;margin:-4px -8px 0 0}
.db-tmore{display:flex;justify-content:center;border-top:1px solid var(--border)}
.db-tmore button{min-height:46px;font-size:13.5px;font-weight:600;color:var(--brand-strong);width:100%}
.db-tmore button:hover{background:var(--surface-2)}
.db-tempty{display:flex;align-items:center;gap:14px;padding:18px}
.db-tempty .art{width:44px;height:44px;border-radius:14px;background:var(--brand-soft);color:var(--brand-strong);display:grid;place-items:center;flex:none}
.db-tempty b{display:block;font-size:14.5px}
.db-tempty span{font-size:13px;color:var(--text-2)}
.db-shorts{display:grid;gap:12px;grid-template-columns:minmax(0,1fr)}
@media (min-width:600px) and (max-width:1023px){.db-shorts .db-short-link{display:none}}
@media (min-width:600px) and (max-width:1023px){.db-shorts{grid-template-columns:repeat(2,minmax(0,1fr))}.db-shorts>.btn{grid-column:1/-1}}
.db-short{display:flex;align-items:center;gap:12px;padding:14px 14px 14px 16px;text-decoration:none;color:inherit;min-height:74px}
.db-short .ico{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand-strong);flex:none}
.db-short .ico.wa{background:rgba(37,211,102,.14);color:#1A9E4B}
.db-short .ico.ok{background:var(--ok-soft);color:var(--ok)}
.db-short .txt{display:grid;min-width:0;gap:1px}
.db-short b{font-size:14.5px;font-weight:600}
.db-short .txt span{font-size:12.5px;color:var(--text-2)}
.db-short .chev{margin-left:auto;color:var(--text-3)}
.db-welcome{padding:20px;margin-bottom:22px;border:1px solid rgba(196,154,60,.32);background:linear-gradient(135deg,var(--brand-soft),var(--surface) 55%);position:relative;overflow:hidden}
.db-welcome-head{display:flex;gap:14px;align-items:flex-start}
.db-welcome-head .logo-mark{width:44px;height:44px;border-radius:13px;flex:none}
.db-welcome-head .logo-mark svg{width:22px;height:22px}
.db-welcome h3{font-size:18px;font-weight:700;line-height:1.25}
.db-welcome p{font-size:13.5px;color:var(--text-2);margin-top:2px}
.db-welcome .btn-icon{margin:-6px -8px 0 auto;flex:none}
.db-wprog{display:flex;align-items:center;gap:10px;margin-top:14px;font-size:12.5px;color:var(--text-2);font-weight:600}
.db-wprog .progress-bar{flex:1;max-width:260px}
.db-steps{display:grid;gap:8px;margin-top:14px;grid-template-columns:minmax(0,1fr);list-style:none}
@media (min-width:720px){.db-steps{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (min-width:1180px){.db-steps{grid-template-columns:repeat(5,minmax(0,1fr))}}
.db-step{display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:var(--r);border:1px solid var(--border);background:var(--surface);text-decoration:none;color:inherit;min-height:64px;height:100%;transition:border-color .15s,transform .15s var(--ease),box-shadow .15s}
.db-step:hover{border-color:var(--border-strong);transform:translateY(-1px);box-shadow:var(--shadow-1)}
@media (min-width:1180px){.db-step{flex-direction:column;align-items:flex-start}}
.db-step .n{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand-strong);flex:none}
.db-step .n .ic{width:16px;height:16px}
.db-step.done .n{background:var(--ok);color:#fff}
.db-step.done b{text-decoration:line-through;text-decoration-color:var(--text-3)}
.db-step b{font-size:14px;display:block;line-height:1.3}
.db-step span{font-size:12.5px;color:var(--text-2);line-height:1.35;display:block}
.db-status{display:grid;gap:12px}
.db-st-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;align-items:center}
.db-st-row .bar{grid-column:1/-1;height:6px;border-radius:999px;background:var(--surface-3);overflow:hidden}
.db-st-row .bar span{display:block;height:100%;border-radius:inherit;background:var(--st,var(--brand));transform-origin:left;animation:growX .8s var(--ease-out) both}
.db-st-row .v{font-weight:700;font-variant-numeric:tabular-nums;font-size:14px}
.db-st-row .v small{font-weight:500;color:var(--text-3);font-size:12px;margin-left:6px}
.db-empty-card .empty{padding:36px 20px}
.db-empty-acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:4px}
/* ── Barbero: Mi día ── */
.db-next{position:relative;overflow:hidden;background:var(--ink);color:var(--on-ink);border:1px solid rgba(242,237,227,.07);border-radius:var(--r-xl);box-shadow:var(--shadow-2);padding:20px;display:grid;gap:14px}
.db-next::before{content:"";position:absolute;left:-120px;bottom:-200px;width:440px;height:440px;background:radial-gradient(circle,rgba(217,178,90,.22),transparent 62%);pointer-events:none}
.db-next>*{position:relative}
.db-next .eyebrow{color:#D9B25A;display:flex;align-items:center;gap:6px}
.db-next .eyebrow .ic{width:15px;height:15px}
.db-next-top{display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap}
.db-next .tm{font-family:var(--disp);font-size:58px;font-weight:800;line-height:.92;color:#F7F2E8;letter-spacing:.01em}
.db-next .cd{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:999px;background:rgba(217,178,90,.16);color:#E6C173;font-weight:700;font-size:13px;margin-bottom:6px}
.db-next .cd.live{background:rgba(111,191,138,.18);color:#8BD9A5}
.db-next .cd.live::before{content:"";width:8px;height:8px;border-radius:50%;background:currentColor;animation:dbPulse 1.6s ease-in-out infinite}
@keyframes dbPulse{0%,100%{opacity:1}50%{opacity:.35}}
.db-next .cl{font-size:21px;font-weight:700;color:#F7F2E8;line-height:1.2}
.db-next .sv{color:#BDB5A5;font-size:14px;margin-top:2px}
.db-next .acts{display:flex;gap:8px;flex-wrap:wrap}
.db-next .db-dark-btn{background:rgba(242,237,227,.08);color:#F2EDE3;border:1px solid rgba(242,237,227,.14)}
.db-next .db-dark-btn:hover{background:rgba(242,237,227,.14)}
@media (min-width:720px){.db-next{padding:24px 28px;grid-template-columns:minmax(0,1fr) auto;align-items:end}.db-next .tm{font-size:72px}.db-next .acts{justify-content:flex-end}}
.db-bgrid{display:grid;gap:16px;grid-template-columns:minmax(0,1fr);margin-top:16px}
@media (min-width:1024px){.db-bgrid{grid-template-columns:minmax(0,1fr) 360px;align-items:start}}
.db-tl{display:grid;padding:4px 16px 8px 0}
.db-tl-row{display:grid;grid-template-columns:62px 18px minmax(0,1fr);column-gap:10px;position:relative}
.db-tl-row .t{padding:13px 0 0;text-align:right;font-family:var(--mono);font-size:13.5px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1.2}
.db-tl-row .t small{display:block;font-family:var(--sans);font-size:11px;color:var(--text-3);font-weight:500;margin-top:2px}
.db-tl-row .rail{position:relative;display:flex;justify-content:center}
.db-tl-row .rail::before{content:"";position:absolute;top:0;bottom:0;width:2px;background:var(--border)}
.db-tl-row:first-child .rail::before{top:18px}
.db-tl-row:last-child .rail::before{bottom:auto;height:18px}
.db-tl-row .rail i{position:relative;margin-top:14px;width:14px;height:14px;border-radius:50%;background:var(--surface);border:3px solid var(--st,var(--brand));z-index:1;flex:none}
.db-tl-row.done .rail i{background:var(--st)}
.db-tl-row .bd{display:flex;gap:10px;align-items:center;min-width:0;padding:8px 0 10px;border-bottom:1px solid var(--border)}
.db-tl-row:last-child .bd{border-bottom:0}
.db-tl-row .bd>button{flex:1;min-width:0;text-align:left;display:grid;gap:2px;padding:4px 6px;margin-left:-6px;border-radius:10px;min-height:44px;align-content:center}
.db-tl-row .bd>button:hover{background:var(--surface-2)}
.db-tl-row .bd b{font-size:14.5px;font-weight:600}
.db-tl-row .bd span{font-size:12.5px;color:var(--text-2)}
.db-tl-row .act{display:flex;gap:6px;align-items:center;flex:none}
.db-tl-row.past .t,.db-tl-row.past .bd>button{opacity:.6}
.db-tl-row .db-stt{display:none;font-style:normal;font-weight:600;color:var(--st)}
@media (max-width:519px){.db-tl-row .act>.badge{display:none}.db-tl-row .db-stt{display:inline}.db-tl{padding-right:4px}.db-tl-row{grid-template-columns:52px 18px minmax(0,1fr)}.db-nowline{grid-template-columns:52px 18px minmax(0,1fr)}}
.db-tl-row.cur .bd>button b::after{content:"En curso";margin-left:8px;font-size:11px;font-weight:700;color:var(--ok);background:var(--ok-soft);padding:2px 7px;border-radius:999px;vertical-align:2px}
.db-nowline{grid-column:1/-1;display:grid;grid-template-columns:62px 18px minmax(0,1fr);column-gap:10px;align-items:center;margin:2px 0}
.db-nowline span{text-align:right;font-size:11px;font-weight:700;color:var(--err);letter-spacing:.04em}
.db-nowline i{width:10px;height:10px;border-radius:50%;background:var(--err);justify-self:center;box-shadow:0 0 0 4px var(--err-soft)}
.db-nowline em{height:2px;background:var(--err);opacity:.55;border-radius:2px}
.db-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
@media (max-width:519px){.db-week{gap:0;margin:0 -6px}}
.db-day{display:grid;justify-items:center;gap:5px;padding:10px 0 9px;border-radius:12px;text-decoration:none;color:inherit;border:1px solid transparent;transition:background .12s,border-color .12s;min-width:0}
.db-day:hover{background:var(--surface-2);border-color:var(--border)}
.db-day .wd{font-size:10.5px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em}
.db-day .dn{font-size:15px;font-weight:700;width:32px;height:32px;display:grid;place-items:center;border-radius:50%;font-variant-numeric:tabular-nums}
.db-day.today .dn{background:var(--brand);color:var(--brand-ink)}
.db-day .meter{width:8px;height:34px;border-radius:999px;background:var(--surface-3);display:flex;align-items:flex-end;overflow:hidden}
.db-day .meter span{display:block;width:100%;background:var(--chart-1,var(--brand));border-radius:inherit;transform-origin:bottom;animation:dbGrowY .7s var(--ease-out) both}
@keyframes dbGrowY{from{transform:scaleY(0)}to{transform:none}}
.db-day .cnt{font-size:12px;color:var(--text-2);font-weight:600;font-variant-numeric:tabular-nums}
.db-day.past{opacity:.55}
.db-day.off .cnt{color:var(--text-3);font-weight:500}
.db-wsum{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);font-size:13px;color:var(--text-2)}
.db-wsum b{color:var(--text);font-variant-numeric:tabular-nums}
.db-tomorrow{display:grid;gap:2px;padding:4px 0 0}
.db-tomorrow .list-item{min-height:52px;padding:10px 18px}
`;
export function injectDashStyle() { if (!document.getElementById('st-dash')) document.head.insertAdjacentHTML('beforeend', '<style id="st-dash">' + CSS + '</style>'); }

// ═════════════════════════════════════════════════════════════════════
// Piezas comunes (dueño y barbero)
// ═════════════════════════════════════════════════════════════════════
export function greeting() { const m = nowMin(); return m >= 300 && m < 720 ? 'Buenos días' : m >= 720 && m < 1140 ? 'Buenas tardes' : 'Buenas noches'; }
function myName() { return firstName((me() && me().name) || (state.user && state.user.name) || (state.staff && state.staff.name) || ''); }
// Versión corta para renglones: "en 25 min", "en 1 h 20 m", "en 8 h".
function untilShort(a, now) {
  if (a.start_min <= now && now < a.end_min) return 'En curso';
  const d = a.start_min - now;
  if (d <= 0) return 'Ya pasó';
  if (d < 60) return 'en ' + d + ' min';
  const h = Math.floor(d / 60), m = d % 60;
  return 'en ' + h + ' h' + (h < 3 && m ? ' ' + m + ' m' : '');
}
function untilText(a, now) {
  if (a.start_min <= now && now < a.end_min) return 'En curso';
  const d = a.start_min - now;
  if (d <= 0) return 'Ya pasó';
  if (d < 60) return 'en ' + d + ' min';
  const h = Math.floor(d / 60), m = d % 60;
  return 'en ' + h + ' h' + (m ? ' ' + m + ' min' : '');
}
const svcText = (a) => (a.services || []).map((s) => s.name).join(' + ') || 'Servicio';
const staffColor = (s) => (s && (s.color || s.staff_color)) || colorFor(s && (s.name || s.staff_name));

// Acción rápida según el estado (una sola, la más útil).
function quickAction(a) {
  const writable = canWrite();
  if (a.status === 'pending' && writable) return { act: 'confirm', label: 'Confirmar', icon: 'check', cls: 'btn-secondary' };
  if (a.status === 'confirmed' && writable && hasStarted(a)) return { act: 'done', label: 'Atendida', icon: 'check-circle', cls: 'btn-ok' };
  if (a.status === 'completed' && (Number(a.balance) || 0) > 0 && can('payments.write')) return { act: 'charge', label: 'Cobrar', icon: 'wallet', cls: 'btn-primary' };
  return null;
}
async function runQuick(act, a, btn) {
  const m = await sheet();
  if (act === 'confirm') return m.setAppointmentStatus(a, 'confirmed', { btn });
  if (act === 'done') return m.setAppointmentStatus(a, 'completed', { btn });
  if (act === 'charge') return m.chargeAppointment(a);
  return m.openAppointment(a.id);
}
function wireAppointmentActions(el, getAppt) {
  return [
    on(el, 'click', '[data-open]', async (e, b) => { const m = await sheet(); m.openAppointment(b.dataset.open); }),
    on(el, 'click', '[data-quick]', async (e, b) => {
      const a = getAppt(b.dataset.id);
      if (!a) return;
      try { await runQuick(b.dataset.quick, a, b); } catch (err) { toast.error(err); }
    })
  ];
}

// ═════════════════════════════════════════════════════════════════════
// Vista
// ═════════════════════════════════════════════════════════════════════
export default {
  title: () => (can('reports.read') ? 'Inicio' : 'Mi día'),
  async render(el, ctx) {
    injectDashStyle();
    el.classList.add('db');
    return can('reports.read') ? renderOwner(el, ctx) : renderBarber(el, ctx);
  }
};

// ─────────────────────────────────────────────────────────────────────
// Dueño
// ─────────────────────────────────────────────────────────────────────
const OWNER_PRESETS = ['hoy', '7d', '30d', 'mes', 'mes_ant', 'otro'];
const OWNER_KPIS = [
  { k: 'revenue', label: 'Ingresos', icon: 'wallet', fmt: (n) => money(Math.round(n)), prev: (p) => p.revenue, spark: 'revenue', foot: (k) => (k.tips ? '+ ' + money(k.tips) + ' de propinas' : 'Sin propinas registradas') },
  { k: 'appointments', label: 'Citas', icon: 'calendar', fmt: (n) => number(n), spark: 'appointments', foot: (k) => plural(k.completed, 'atendida') },
  { k: 'avg_ticket', label: 'Ticket promedio', icon: 'receipt', fmt: (n) => money(Math.round(n)), foot: () => 'Por cada venta cobrada' },
  { k: 'new_clients', label: 'Clientes nuevos', icon: 'user-plus', fmt: (n) => number(n), foot: (k) => plural(k.returning_clients, 'cliente recurrente', 'clientes recurrentes') },
  { k: 'occupancy_pct', label: 'Ocupación', icon: 'clock', pts: true, fmt: (n) => pctText(n), bar: (k) => k.occupancy_pct, foot: () => 'Del tiempo disponible del equipo' },
  { k: 'lost', label: 'Citas perdidas', icon: 'calendar-x', invert: true, fmt: (n) => number(n), val: (k) => (k.cancelled || 0) + (k.no_show || 0), foot: (k) => plural(k.cancelled, 'cancelada') + ' · ' + number(k.no_show) + ' no ' + (k.no_show === 1 ? 'llegó' : 'llegaron') }
];

async function renderOwner(el, { query }) {
  const S = initialFilters(query, OWNER_PRESETS, '7d', 'dash');
  const UI = { metric: 'revenue', rankBy: 'appointments', showAll: false };
  const charts = new Map();
  let staff = null, seq = 0, D = null, P = null, T = null, first = true, gone = false, lastLoad = 0;
  let welcome = query.bienvenida === '1';
  const t0 = today();
  const sh = shop() || {};

  el.innerHTML = String(html`
    <div class="page-head db-head">
      <div><span class="eyebrow">${dateLongCap(t0)}</span><h2>${greeting()}${myName() ? ', ' + myName() : ''}</h2><p>${sh.name ? 'Así va ' + sh.name + '.' : 'Así va tu barbería.'}</p></div>
    </div>
    <div id="dbWelcome"></div>
    <section class="db-today-grid" aria-label="Hoy">
      <div class="card db-today" id="dbToday">${raw(todaySkeleton())}</div>
      <div class="db-shorts" id="dbShorts">${raw(shortcutsHtml(null, null))}</div>
    </section>
    <div class="db-sec"><div><h3>Tu negocio</h3><p>Cómo va la barbería en el periodo que elijas.</p></div>${can('reports.read') ? html`<a class="link-btn" href="#/reportes">Ver reportes${raw(icon('arrow-right', 'ic-sm'))}</a>` : ''}</div>
    <div id="dbFilters">${filtersHtml(OWNER_PRESETS, S, can('staff.read') ? [] : null)}</div>
    <div id="dbA" class="db-a">${raw(ownerSkeleton())}</div>`);

  const filtersEl = $('#dbFilters', el);
  paintFilters(filtersEl, OWNER_PRESETS, S, staff);
  syncUrl();
  paintWelcome();

  // ── Carga ──
  async function load(silent) {
    const my = ++seq;
    lastLoad = Date.now();
    const R = rangeOf(S.r, S), PR = prevRange(R.from, R.to), t = today();
    const sid = S.barbero || undefined;
    const box = $('#dbA', el);
    if (silent || !first) { box.classList.add('db-busy'); box.setAttribute('aria-busy', 'true'); }
    const reuseToday = R.from === t && R.to === t && !sid;
    const mainP = api.get('/reports/dashboard', { from: R.from, to: R.to, staff_id: sid });
    const prevP = api.get('/reports/dashboard', { from: PR.from, to: PR.to, staff_id: sid }).catch(() => false);
    const todayP = reuseToday ? mainP : api.get('/reports/dashboard', { from: t, to: t });
    loadSide();
    todayP.then((x) => { if (my !== seq || gone) return; T = x; paintToday(); }).catch((err) => { if (my !== seq || gone) return; if (!T) paintTodayError(err); });
    try {
      D = await mainP;
    } catch (err) {
      if (my !== seq || gone) return;
      box.classList.remove('db-busy'); box.removeAttribute('aria-busy');
      if (err.status === 404 && S.barbero) { S.barbero = ''; writePrefs('dash', S); paintFilters(filtersEl, OWNER_PRESETS, S, staff); syncUrl(); toast.info('Ese barbero ya no está en el equipo. Te mostramos a todo el equipo.'); return load(); }
      if (silent && D) { toast.error(err); return; }
      destroyCharts(charts);
      box.innerHTML = String(html`<div class="card">${errorState(err, 'dbRetry')}</div>`);
      return;
    }
    if (my !== seq || gone) return;
    P = null;
    paintAnalytics(first);
    box.classList.remove('db-busy'); box.removeAttribute('aria-busy');
    first = false;
    const pv = await prevP;
    if (my !== seq || gone) return;
    P = pv;
    paintKpis(false);
    paintTrend();
  }

  // Datos de los atajos (no bloquean ni muestran error: son complementos).
  let side = { rem: null, cash: null };
  function loadSide() {
    const jobs = [];
    if (can('messages.send')) jobs.push(api.get('/reminders').then((r) => { side.rem = r; }).catch(() => { side.rem = false; }));
    if (can('cash.read')) jobs.push(api.get('/cash/current').then((r) => { side.cash = r; }).catch(() => { side.cash = false; }));
    Promise.all(jobs).then(() => { if (!gone) { $('#dbShorts', el).innerHTML = String(shortcutsHtml(side.rem, side.cash)); if (T) paintToday(); } });
  }

  function syncUrl() {
    setQuery({ r: S.r, desde: S.r === 'otro' ? S.desde : '', hasta: S.r === 'otro' ? S.hasta : '', barbero: S.barbero, bienvenida: welcome ? '1' : '' });
  }

  // ── Bienvenida / primeros pasos ──
  function paintWelcome() {
    const host = $('#dbWelcome', el);
    if (!welcome) { host.innerHTML = ''; return; }
    const done = readPrefs('onb');
    const pwa = (window.TB && window.TB.pwa) || {};
    if (pwa.installed) done.app = 1;
    const steps = STEPS.filter((s) => !s.perm || canAny(s.perm));
    const n = steps.filter((s) => done[s.k]).length;
    host.innerHTML = String(html`
      <section class="card db-welcome fade-up" aria-labelledby="dbWt">
        <div class="db-welcome-head">
          <span class="logo-mark">${raw(icon('sparkles'))}</span>
          <div class="grow"><h3 id="dbWt">¡Bienvenido a TuBarbería${myName() ? ', ' + myName() : ''}!</h3><p>Deja tu barbería lista para recibir reservas en unos minutos. Puedes volver a esta guía cuando quieras.</p></div>
          <button type="button" class="btn btn-ghost btn-icon" data-act="welcome-close" aria-label="Ocultar primeros pasos">${raw(icon('x'))}</button>
        </div>
        <div class="db-wprog"><div class="progress-bar" aria-hidden="true"><span style="width:${Math.round((n / steps.length) * 100)}%"></span></div><span>${n} de ${steps.length} listos</span></div>
        <ol class="db-steps">${steps.map((s, i) => html`<li><a class="db-step ${done[s.k] ? 'done' : ''}" href="${s.href}" data-step="${s.k}">
          <span class="n">${done[s.k] ? raw(icon('check')) : raw(icon(s.icon))}</span>
          <span class="grow"><b>${i + 1}. ${s.t}</b><span>${s.d}</span></span></a></li>`)}</ol>
      </section>`);
  }

  // ── Bloque "Hoy" ──
  function paintTodayError(err) {
    $('#dbToday', el).innerHTML = String(html`<div class="db-tempty"><span class="art" style="background:var(--err-soft);color:var(--err)">${raw(icon('alert'))}</span><div class="grow"><b>No se pudo cargar el día de hoy</b><span>${err.message || 'Revisa tu conexión.'}</span></div><button type="button" class="btn btn-secondary btn-sm" id="dbRetryToday">${raw(icon('refresh'))}Reintentar</button></div>`);
  }
  function paintToday() {
    const host = $('#dbToday', el);
    if (!T || !host) return;
    const now = nowMin(), td = T.today || { appointments: [], count: 0, expected_revenue: 0 };
    const all = (td.appointments || []).slice().sort((a, b) => a.start_min - b.start_min);
    const done = all.filter((a) => a.status === 'completed').length;
    const upcoming = all.filter((a) => ACTIVE.includes(a.status) && a.end_min > now);
    const list = UI.showAll ? all : upcoming.slice(0, 4);
    const rem = side.rem && side.rem.items ? side.rem.items : null;
    const pct = all.length ? Math.round((done / all.length) * 100) : 0;
    host.innerHTML = String(html`
      <div class="card-head"><div><span class="eyebrow">Hoy</span><h3>${all.length ? plural(all.length, 'cita') + ' en la agenda' : 'Sin citas en la agenda'}</h3></div>
        <a class="btn btn-ghost btn-sm db-to-agenda" href="#/agenda" aria-label="Ver la agenda de hoy">Agenda${raw(icon('chevron-right', 'ic-sm'))}</a></div>
      <div class="db-tstats">
        <div><span>Citas</span><b class="num">${number(all.length)}</b></div>
        <div><span>Atendidas</span><b class="num">${number(done)}</b></div>
        <div><span>Cobrado</span><b class="num">${money(Math.round((T.kpis && T.kpis.revenue) || 0))}</b></div>
        <div><span>Esperado</span><b class="num">${money(Math.round(td.expected_revenue || 0))}</b></div>
      </div>
      ${all.length ? html`<div class="db-tprog"><div class="progress-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Citas atendidas"><span style="width:${pct}%"></span></div><span>${done} de ${all.length} atendidas${upcoming.length ? ' · ' + plural(upcoming.length, 'por atender', 'por atender') : ''}</span></div>` : ''}
      ${list.length ? html`<div class="db-alist">
          <div class="db-alist-t"><span>${UI.showAll ? 'Todas las de hoy' : 'Próximas'}</span></div>
          ${list.map((a) => apptRow(a, now))}
        </div>`
        : html`<div class="db-alist">${all.length
          ? html`<div class="db-tempty"><span class="art" style="background:var(--ok-soft);color:var(--ok)">${raw(icon('check-circle'))}</span><div class="grow"><b>Ya no quedan citas por hoy</b><span>${done ? 'Se atendieron ' + plural(done, 'cita') + '. ¡Buen trabajo!' : 'Revisa la agenda para ver cómo cerró el día.'}</span></div></div>`
          : html`<div class="db-tempty"><span class="art">${raw(icon('calendar'))}</span><div class="grow"><b>Hoy no hay citas agendadas</b><span>Comparte tu enlace de reservas o agenda a alguien que llegue sin cita.</span></div>${canWrite() ? html`<button type="button" class="btn btn-primary btn-sm" data-act="new">${raw(icon('plus'))}Nueva cita</button>` : ''}</div>`}
          ${!upcoming.length && rem && rem.length ? html`<div class="db-alist-t" style="border-top:1px solid var(--border)"><span>Mañana · ${plural(rem.length, 'cita')}</span><a class="link-btn" href="#/mensajes" style="text-transform:none;letter-spacing:0;font-size:13px">Recordatorios</a></div>
            ${rem.slice(0, 3).map((x) => apptRow(x.appointment, -1))}` : ''}
        </div>`}
      ${all.length > list.length || UI.showAll ? html`<div class="db-tmore"><button type="button" data-act="today-all" aria-expanded="${String(UI.showAll)}">${UI.showAll ? 'Ver solo las próximas' : 'Ver las ' + all.length + ' citas de hoy'}</button></div>` : ''}`);
  }

  // ── Tablero del periodo ──
  function paintAnalytics(isFirst) {
    const box = $('#dbA', el);
    const k = D.kpis, days = D.range.days;
    const empty = !k.appointments && !k.revenue && !k.cancelled;
    const filtered = !!S.barbero;
    const layout = [empty, days === 1, filtered].join('|');
    const rebuild = isFirst || box.dataset.layout !== layout || !$('#dbKpis', box);
    if (rebuild) {
      destroyCharts(charts);
      box.dataset.layout = layout;
      box.innerHTML = String(html`
        <div class="db-kpis six" id="dbKpis"></div>
        ${empty ? html`<div class="card db-empty-card" style="margin-top:16px">${emptyState({ icon: 'chart', title: 'Sin movimiento en este periodo', text: 'No hay citas ni cobros ' + (filtered ? 'de este barbero ' : '') + 'entre el ' + rangeText(D.range.from, D.range.to) + '. Prueba con otro periodo o agenda una cita.' })}
            <div class="db-empty-acts" style="padding:0 20px 28px;margin-top:-18px">
              ${S.r !== '30d' ? html`<button type="button" class="btn btn-secondary" data-range="30d">${raw(icon('calendar'))}Ver últimos 30 días</button>` : ''}
              ${canWrite() ? html`<button type="button" class="btn btn-primary" data-act="new">${raw(icon('plus'))}Nueva cita</button>` : ''}
              ${can('shop.update') ? html`<a class="btn btn-ghost" href="#/enlace">${raw(icon('qr'))}Compartir mi enlace</a>` : ''}
            </div></div>`
        : html`
          <div class="db-grid lead">
            <div class="card db-card" id="dbTrend"></div>
            <div id="dbTop"></div>
          </div>
          <div class="db-grid">
            ${filtered ? '' : html`<div class="card db-card" id="dbRank"></div>`}
            <div class="card db-card" id="dbSvc"></div>
            <div class="card db-card" id="dbPay"></div>
            <div class="card db-card ${filtered ? 'wide' : ''}" id="dbPeak"></div>
          </div>`}`);
    }
    paintKpis(isFirst || rebuild);
    if (empty) return;
    paintTrend();
    paintTop();
    if (!filtered) paintRank();
    paintServices();
    paintPay();
    paintPeak();
  }

  function paintKpis(anim) {
    const host = $('#dbKpis', el);
    if (!host || !D) return;
    const prevText = (() => { const PR = prevRange(D.range.from, D.range.to); return rangeText(PR.from, PR.to); })();
    // Ingresos y citas ya traen su comparación; el resto espera la consulta del periodo anterior.
    const k = D.kpis;
    const baseline = P === false ? false : P ? P.kpis : null;
    const quick = { revenue: k.revenue_prev, appointments: k.appointments_prev };
    host.innerHTML = String(html`${OWNER_KPIS.map((def) => {
      const pk = quick[def.k] != null ? Object.assign({}, baseline || {}, { [def.k]: quick[def.k] }) : baseline;
      return kpiTile(def, k, pk, D.range.days > 2 ? D.series : null, prevText);
    })}`);
    animateKpis(host, OWNER_KPIS, anim);
  }

  function paintTrend() {
    const host = $('#dbTrend', el);
    if (!host || !D) return;
    const days = D.range.days;
    if (days === 1) {
      if (!host.dataset.kind) {
        host.dataset.kind = 'hour';
        host.innerHTML = String(html`<div class="card-head"><div><h3>Citas por hora</h3><span class="sub" data-sub></span></div></div><div class="card-body"><div data-chart style="min-height:240px"></div></div>`);
      }
      const pk = peakOf(D.by_hour);
      $('[data-sub]', host).textContent = pk ? 'La hora con más citas: ' + hourLabel(pk.hour) + ' (' + plural(pk.count, 'cita') + ')' : 'Sin citas en el día';
      mountChart(charts, 'trend', $('[data-chart]', host), barChart, { labels: D.by_hour.map((x) => hourLabel(x.hour)), values: D.by_hour.map((x) => x.count), format: 'number', name: 'Citas', highlight: pk ? D.by_hour.indexOf(pk) : null, height: 240, label: 'Citas por hora del día' });
      return;
    }
    const B = bucketSeries(D.series, days);
    const PB = P && P.series ? bucketSeries(P.series, days) : null;
    const isRev = UI.metric === 'revenue';
    const vals = B.rows.map((r) => (isRev ? r.revenue : r.appointments));
    const pvals = PB ? B.rows.map((_, i) => (PB.rows[i] ? (isRev ? PB.rows[i].revenue : PB.rows[i].appointments) : null)) : null;
    const total = vals.reduce((a, v) => a + (v || 0), 0);
    const best = vals.reduce((bi, v, i) => (v > vals[bi] ? i : bi), 0);
    if (host.dataset.kind !== 'line') {
      host.dataset.kind = 'line';
      host.innerHTML = String(html`<div class="card-head"><div><h3 data-title></h3><span class="sub" data-sub></span></div>
        <div class="seg" role="group" aria-label="Qué graficar"><button type="button" data-metric="revenue">Ingresos</button><button type="button" data-metric="appointments">Citas</button></div></div>
        <div class="card-body"><div data-chart style="min-height:240px"></div></div>`);
    }
    $$('[data-metric]', host).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.metric === UI.metric)));
    const per = B.unit === 'día' ? 'por día' : B.unit === 'semana' ? 'por semana' : 'por mes';
    $('[data-title]', host).textContent = (isRev ? 'Ingresos ' : 'Citas ') + per;
    const fmtV = isRev ? money(Math.round(total)) : plural(total, 'cita');
    const bestTxt = vals[best] > 0 ? ' · mejor ' + B.unit + ': ' + (B.unit === 'día' ? shortDay(B.labels[best]) : B.unit === 'mes' ? MONTHS_SHORT[Number(B.labels[best].slice(5, 7)) - 1] : B.labels[best].replace('Sem. ', 'semana del ')) : '';
    $('[data-sub]', host).textContent = 'Total ' + fmtV + bestTxt;
    const series = [{ name: isRev ? 'Ingresos' : 'Citas', values: vals, color: 1 }];
    if (pvals) series.push({ name: 'Periodo anterior', values: pvals, color: 'muted' });
    mountChart(charts, 'trend', $('[data-chart]', host), lineChart, { labels: B.labels, series, format: isRev ? 'money' : 'number', height: 240, area: true, label: (isRev ? 'Ingresos ' : 'Citas ') + per });
  }

  function paintTop() {
    const host = $('#dbTop', el);
    if (!host) return;
    const k = D.kpis;
    const filtered = !!S.barbero;
    const row = filtered ? (D.by_staff || [])[0] : (D.top_staff && (D.by_staff || []).find((s) => s.staff_id === D.top_staff.staff_id)) || D.top_staff;
    if (!row || !row.appointments) {
      host.innerHTML = String(html`<div class="card db-card" style="height:100%">${emptyState({ icon: 'crown', title: 'Aún no hay barbero destacado', text: 'Cuando haya citas en el periodo verás aquí quién atendió más.', compact: true })}</div>`);
      return;
    }
    const share = k.appointments ? Math.round((row.appointments / k.appointments) * 100) : 0;
    const revShare = k.revenue ? Math.min(100, Math.round((row.revenue / k.revenue) * 100)) : 0;
    const second = filtered ? null : (D.by_staff || []).find((s) => s.staff_id !== row.staff_id && s.appointments > 0);
    const lead = second ? row.appointments - second.appointments : 0;
    const col = staffColor(row);
    host.innerHTML = String(html`<article class="db-top" style="height:100%" aria-label="${filtered ? 'Resumen del barbero' : 'Barbero más activo'}">
      <span class="eyebrow">${raw(icon(filtered ? 'user' : 'crown'))}${filtered ? 'Resumen del barbero' : 'Barbero más activo'}</span>
      <div class="db-top-who">${avatar(row.name, { size: 'xl', color: col })}<div class="grow"><b class="truncate">${row.name}</b><span>${row.occupancy_pct != null ? pctText(row.occupancy_pct) + ' de ocupación' : ''}${row.completed != null ? ' · ' + plural(row.completed, 'atendida') : ''}</span></div></div>
      <div class="db-top-stats">
        <div><span>Citas</span><b>${number(row.appointments)}</b></div>
        <div><span>Ingresos</span><b>${money(Math.round(row.revenue))}</b></div>
        <div><span>${filtered ? 'Ticket' : 'Del total'}</span><b>${filtered ? money(Math.round(k.avg_ticket)) : share + '%'}</b></div>
      </div>
      ${filtered ? html`<div class="db-share">
            <div><span><b>${row.appointments ? Math.round((row.completed / row.appointments) * 100) : 0}%</b> de sus citas ya se atendieron</span><div class="bar" aria-hidden="true"><span style="width:${row.appointments ? Math.round((row.completed / row.appointments) * 100) : 0}%"></span></div></div>
            <div><span><b>${pctText(row.occupancy_pct || 0)}</b> de ocupación de su horario</span><div class="bar" aria-hidden="true"><span style="width:${Math.min(100, row.occupancy_pct || 0)}%;animation-delay:120ms"></span></div></div>
            <a class="btn btn-sm db-dark-btn" style="justify-self:start" href="${'#/agenda?barbero=' + encodeURIComponent(row.staff_id)}">${raw(icon('calendar', 'ic-sm'))}Ver su agenda</a>
          </div>`
        : html`<div class="db-share">
            <div><span><b>${share}%</b> de las citas del equipo</span><div class="bar" aria-hidden="true"><span style="width:${share}%"></span></div></div>
            <div><span><b>${revShare}%</b> de los ingresos</span><div class="bar" aria-hidden="true"><span style="width:${revShare}%;animation-delay:120ms"></span></div></div>
            ${second ? html`<p class="db-lead">${raw(icon(lead > 0 ? 'arrow-up' : 'minus', 'ic-sm'))}${lead > 0 ? plural(lead, 'cita') + ' más que ' + firstName(second.name) + ', el 2.º lugar' : 'Empatado en citas con ' + firstName(second.name)}</p>` : ''}
          </div>`}
    </article>`);
  }

  function paintRank() {
    const host = $('#dbRank', el);
    if (!host) return;
    const list = (D.by_staff || []).slice();
    const by = UI.rankBy;
    list.sort((a, b) => (b[by] - a[by]) || (b.appointments - a.appointments));
    const max = Math.max(1, ...list.map((s) => s[by] || 0));
    host.innerHTML = String(html`<div class="card-head"><div><h3>Ranking del equipo</h3><span class="sub">${by === 'revenue' ? 'Ordenado por ingresos' : 'Ordenado por citas'}</span></div>
      <div class="seg" role="group" aria-label="Ordenar ranking"><button type="button" data-rank="appointments" aria-pressed="${String(by === 'appointments')}">Citas</button><button type="button" data-rank="revenue" aria-pressed="${String(by === 'revenue')}">Ingresos</button></div></div>
      <div class="card-body">${list.length ? html`<div class="db-rank" role="list">${list.map((s, i) => html`<a class="db-rank-row" role="listitem" href="${'#/agenda?barbero=' + encodeURIComponent(s.staff_id)}" aria-label="${s.name + ': ' + s.appointments + ' citas, ' + money(Math.round(s.revenue))}">
          <span class="pos">${i + 1}</span>${avatar(s.name, { color: staffColor(s) })}
          <span class="grow" style="min-width:0"><span class="nm truncate" style="display:block">${s.name}</span><span class="bar" aria-hidden="true"><span style="width:${Math.round(((s[by] || 0) / max) * 100)}%;animation-delay:${i * 60}ms"></span></span></span>
          <span class="v">${by === 'revenue' ? money(Math.round(s.revenue)) : number(s.appointments)}<small>${by === 'revenue' ? plural(s.appointments, 'cita') : money(Math.round(s.revenue))} · ${pctText(s.occupancy_pct)} ocup.</small></span></a>`)}</div>`
        : emptyState({ icon: 'users', title: 'Sin barberos con citas', compact: true })}</div>`);
  }

  function paintServices() {
    const host = $('#dbSvc', el);
    if (!host) return;
    const list = (D.by_service || []).slice(0, 6);
    const rest = (D.by_service || []).length - list.length;
    if (host.dataset.ready !== '1' || !list.length !== (host.dataset.empty === '1')) {
      host.dataset.ready = '1'; host.dataset.empty = list.length ? '0' : '1';
      destroyChart('svc');
      host.innerHTML = String(html`<div class="card-head"><div><h3>Servicios más vendidos</h3><span class="sub" data-sub></span></div></div>
        <div class="card-body">${list.length ? html`<div data-chart></div>` : emptyState({ icon: 'scissors', title: 'Sin servicios atendidos', text: 'Aquí verás los servicios de las citas marcadas como atendidas.', compact: true })}</div>
        <div class="db-foot-link" data-more></div>`);
    }
    const tot = (D.by_service || []).reduce((a, s) => a + s.count, 0);
    $('[data-sub]', host).textContent = tot ? plural(tot, 'servicio') + ' en citas atendidas' : 'De las citas atendidas';
    $('[data-more]', host).innerHTML = rest > 0 ? String(html`<a class="link-btn" href="#/reportes">y ${plural(rest, 'servicio')} más en Reportes${raw(icon('arrow-right', 'ic-sm'))}</a>`) : '';
    if (list.length) mountChart(charts, 'svc', $('[data-chart]', host), barChart, { labels: list.map((s) => s.name), values: list.map((s) => s.count), horizontal: true, format: 'number', name: 'Veces', color: 2, label: 'Servicios más vendidos' });
  }

  function paintPay() {
    const host = $('#dbPay', el);
    if (!host) return;
    const segs = methodSegments(D.by_method);
    const total = segs.reduce((a, s) => a + s.value, 0);
    if (host.dataset.ready !== '1' || !total !== (host.dataset.empty === '1')) {
      host.dataset.ready = '1'; host.dataset.empty = total ? '0' : '1';
      destroyChart('pay');
      host.innerHTML = String(html`<div class="card-head"><div><h3>Formas de pago</h3><span class="sub">Cobros registrados en el periodo, sin propinas</span></div></div>
        <div class="card-body">${total ? html`<div data-chart></div>` : emptyState({ icon: 'wallet', title: 'Sin cobros registrados', text: 'Cuando cobres una cita verás aquí cuánto entró en efectivo, tarjeta o transferencia.', compact: true })}</div>`);
    }
    if (total) mountChart(charts, 'pay', $('[data-chart]', host), donutChart, { segments: segs, format: 'money', centerLabel: 'Cobrado', label: 'Cobros por forma de pago' });
  }

  function paintPeak() {
    const host = $('#dbPeak', el);
    if (!host) return;
    const days = D.range.days;
    // Un solo día: la gráfica de arriba ya es por hora → aquí, el estado de las citas.
    if (days === 1) {
      destroyChart('peak');
      host.innerHTML = String(html`<div class="card-head"><div><h3>Estado de las citas</h3><span class="sub">Todas las citas del día, incluidas las canceladas</span></div></div><div class="card-body">${statusBars(D.by_status)}</div>`);
      return;
    }
    const pk = peakOf(D.by_hour);
    if (host.dataset.ready !== '1' || !pk !== (host.dataset.empty === '1')) {
      host.dataset.ready = '1'; host.dataset.empty = pk ? '0' : '1';
      destroyChart('peak');
      host.innerHTML = String(html`<div class="card-head"><div><h3>Horas pico</h3><span class="sub" data-sub></span></div></div>
        <div class="card-body">${pk ? html`<div data-chart></div>` : emptyState({ icon: 'clock', title: 'Sin citas en el periodo', compact: true })}</div>`);
    }
    if (!pk) return;
    $('[data-sub]', host).textContent = 'La hora más pedida es de ' + hourLabel(pk.hour) + ' a ' + hourLabel(pk.hour + 1) + ' · ' + plural(pk.count, 'cita');
    mountChart(charts, 'peak', $('[data-chart]', host), barChart, { labels: D.by_hour.map((x) => hourLabel(x.hour)), values: D.by_hour.map((x) => x.count), format: 'number', name: 'Citas', highlight: D.by_hour.indexOf(pk), height: 230, label: 'Citas por hora de inicio' });
  }
  function destroyChart(key) { const c = charts.get(key); if (c) { try { c.destroy(); } catch (e) { /* */ } charts.delete(key); } }

  // ── Eventos ──
  const offs = [];
  offs.push(wireFilters(filtersEl, { presets: OWNER_PRESETS, S, storeKey: 'dash', staff: () => staff, onChange: () => { syncUrl(); load(); } }));
  offs.push(on(el, 'click', '#dbA [data-range]', (e, b) => { S.r = b.dataset.range; S.desde = ''; S.hasta = ''; writePrefs('dash', S); paintFilters(filtersEl, OWNER_PRESETS, S, staff); syncUrl(); load(); }));
  offs.push(on(el, 'click', '[data-act="new"]', () => window.TB.newAppointment()));
  offs.push(on(el, 'click', '#dbRetry', () => { first = true; $('#dbA', el).innerHTML = ownerSkeleton(); load(); }));
  offs.push(on(el, 'click', '#dbRetryToday', () => { $('#dbToday', el).innerHTML = todaySkeleton(); load(true); }));
  offs.push(on(el, 'click', '[data-metric]', (e, b) => { if (UI.metric === b.dataset.metric) return; UI.metric = b.dataset.metric; paintTrend(); }));
  offs.push(on(el, 'click', '[data-rank]', (e, b) => { if (UI.rankBy === b.dataset.rank) return; UI.rankBy = b.dataset.rank; paintRank(); }));
  offs.push(on(el, 'click', '[data-act="today-all"]', () => { UI.showAll = !UI.showAll; paintToday(); }));
  offs.push(on(el, 'click', '[data-step]', (e, a) => { const d = readPrefs('onb'); d[a.dataset.step] = 1; writePrefs('onb', d); }));
  offs.push(on(el, 'click', '[data-act="welcome-close"]', () => {
    welcome = false; syncUrl();
    const c = $('.db-welcome', el);
    if (c) { c.style.transition = 'opacity .2s, transform .2s'; c.style.opacity = '0'; c.style.transform = 'translateY(-6px)'; setTimeout(paintWelcome, 200); }
    toast.info('Listo. Encuentras cada paso en el menú cuando lo necesites.');
  }));
  offs.push(...wireAppointmentActions(el, (id) => {
    const pool = ((T && T.today && T.today.appointments) || []).concat(((side.rem && side.rem.items) || []).map((x) => x.appointment));
    return pool.find((a) => a.id === id);
  }));

  let tRefresh = null;
  const refresh = () => { clearTimeout(tRefresh); tRefresh = setTimeout(() => { if (!gone) load(true); }, 250); };
  offs.push(bus.on('appointments:changed', refresh));
  offs.push(bus.on('payments:changed', refresh));
  const onVis = () => { if (!document.hidden && Date.now() - lastLoad > 30000) load(true); };
  document.addEventListener('visibilitychange', onVis);
  const tick = setInterval(() => { if (!document.hidden && T) paintToday(); }, 60000);

  // Barberos para el filtro (no bloquea el tablero).
  if (can('staff.read')) {
    getStaff(true).then((list) => {
      if (gone) return;
      staff = (list || []).filter((s) => s.active !== false || s.id === S.barbero);
      paintFilters(filtersEl, OWNER_PRESETS, S, staff);
    }).catch(() => {});
  }

  await load();
  return () => { gone = true; clearTimeout(tRefresh); clearInterval(tick); document.removeEventListener('visibilitychange', onVis); offs.forEach((f) => f()); destroyCharts(charts); };
}

const STEPS = [
  { k: 'horario', t: 'Configura tu horario', d: 'Días y horas en que atiende cada barbero.', href: '#/horarios', icon: 'clock', perm: ['availability.manage.all', 'availability.manage.own'] },
  { k: 'servicios', t: 'Revisa servicios y precios', d: 'Lo que tus clientes podrán reservar.', href: '#/servicios', icon: 'tag', perm: ['services.manage'] },
  { k: 'equipo', t: 'Agrega a tus barberos', d: 'Cada uno con su agenda, PIN y comisión.', href: '#/equipo', icon: 'users', perm: ['staff.manage'] },
  { k: 'enlace', t: 'Comparte tu enlace y QR', d: 'En Instagram, WhatsApp y el mostrador.', href: '#/enlace', icon: 'qr', perm: ['shop.update'] },
  { k: 'app', t: 'Instala la app', d: 'Tenla a un toque en tu celular o computadora.', href: '#/instalar', icon: 'download' }
];

function apptRow(a, now) {
  const tomorrow = now < 0;
  const q = tomorrow ? null : quickAction(a);
  const live = !tomorrow && a.start_min <= now && now < a.end_min && ACTIVE.includes(a.status);
  const past = !tomorrow && (a.status === 'completed' || a.status === 'no_show' || a.end_min <= now);
  const owner = can('appointments.read.all');
  return html`<div class="db-appt ${past ? 'done' : ''} ${q ? 'has-act' : ''}">
    <button type="button" class="db-appt-main" data-open="${a.id}" aria-label="${'Abrir cita de ' + (a.client_name || 'cliente') + ' a las ' + time(a.start_min)}">
      <span class="db-appt-time"><b>${time(a.start_min)}</b><small class="${live ? 'now' : ''}">${tomorrow ? 'mañana' : past ? 'hasta ' + time(a.end_min) : untilShort(a, now)}</small></span>
      <span class="stripe" style="--c:${staffColor(a)}"></span>
      <span class="who"><b class="truncate">${a.client_name || 'Cliente sin nombre'}</b><span class="truncate">${svcText(a)}${owner && a.staff_name ? ' · ' + firstName(a.staff_name) : ''}</span></span>
    </button>
    <span class="acts">${statusBadge(a.status)}${q ? html`<button type="button" class="btn btn-sm ${q.cls}" data-quick="${q.act}" data-id="${a.id}">${raw(icon(q.icon, 'ic-sm'))}${q.label}</button>` : ''}</span>
  </div>`;
}

function shortcutsHtml(rem, cash) {
  const items = [];
  if (can('messages.send')) {
    let sub = 'Envíalos por WhatsApp en un toque';
    if (rem && rem.items) {
      const n = rem.items.length, pend = rem.items.filter((x) => !x.reminded).length;
      sub = !n ? 'Mañana no hay citas por recordar' : pend ? pend + ' de ' + n + ' por enviar' : '¡Todos enviados! (' + n + ')';
    }
    items.push(html`<a class="card interactive db-short" href="#/mensajes?tab=recordatorios"><span class="ico wa">${raw(icon('whatsapp'))}</span><span class="txt"><b>Recordatorios de mañana</b><span>${sub}</span></span>${raw(icon('chevron-right', 'chev'))}</a>`);
  }
  if (can('cash.read')) {
    let sub = 'Abre, registra y haz el corte', cls = '';
    if (cash && cash.session) { sub = 'Abierta · ' + money(cash.summary ? cash.summary.expected_cash : 0) + ' en efectivo'; cls = 'ok'; }
    else if (cash) sub = 'Cerrada · ábrela al iniciar el día';
    items.push(html`<a class="card interactive db-short" href="#/caja"><span class="ico ${cls}">${raw(icon('wallet'))}</span><span class="txt"><b>Caja</b><span>${sub}</span></span>${raw(icon('chevron-right', 'chev'))}</a>`);
  }
  if (can('shop.update')) items.push(html`<a class="card interactive db-short db-short-link" href="#/enlace"><span class="ico">${raw(icon('qr'))}</span><span class="txt"><b>Tu enlace de reservas</b><span>Compártelo por WhatsApp o con tu QR</span></span>${raw(icon('chevron-right', 'chev'))}</a>`);
  if (canWrite()) items.push(html`<button type="button" class="btn btn-primary btn-lg btn-block" data-act="new">${raw(icon('calendar-plus'))}Nueva cita</button>`);
  return html`${items}`;
}

export function statusBars(by) {
  const rows = [['completed', 'Atendidas'], ['confirmed', 'Confirmadas'], ['pending', 'Pendientes'], ['no_show', 'No asistieron'], ['cancelled', 'Canceladas']];
  const tot = rows.reduce((a, [k]) => a + ((by || {})[k] || 0), 0);
  if (!tot) return emptyState({ icon: 'calendar', title: 'Sin citas', compact: true });
  return html`<div class="db-status">${rows.map(([k, l], i) => { const v = (by || {})[k] || 0; const p = tot ? Math.round((v / tot) * 1000) / 10 : 0; return html`<div class="db-st-row"><span>${statusBadge(k)}<span class="sr"> ${l}</span></span><span class="v">${number(v)}<small>${pctText(p)}</small></span><span class="bar" aria-hidden="true"><span style="width:${p}%;--st:var(--st-${k});animation-delay:${i * 50}ms"></span></span></div>`; })}</div>`;
}

function todaySkeleton() {
  return '<div aria-busy="true" aria-label="Cargando el día de hoy"><div class="card-head"><div style="flex:1"><div class="skel" style="width:120px;height:11px"></div><div class="skel" style="width:220px;height:22px;margin-top:8px"></div></div></div>' +
    '<div class="db-tstats">' + '<div><div class="skel" style="width:60%;height:10px"></div><div class="skel" style="width:70%;height:24px;margin-top:6px"></div></div>'.repeat(4) + '</div>' +
    '<div class="db-tprog"><div class="skel" style="height:6px"></div></div>' +
    '<div class="db-alist">' + '<div class="skel-row" style="min-height:64px;padding-left:18px"><div class="skel" style="width:48px;height:30px"></div><div style="flex:1"><div class="skel skel-line" style="width:45%"></div><div class="skel skel-line" style="width:30%;height:10px"></div></div><div class="skel" style="width:80px;height:24px;border-radius:999px"></div></div>'.repeat(3) + '</div></div>';
}
export function kpiSkeleton(n, cls) {
  return '<div class="db-kpis ' + (cls || '') + '" aria-hidden="true">' + ('<div class="card kpi db-kpi"><div class="skel" style="width:55%;height:12px"></div><div class="skel" style="width:70%;height:30px;margin-top:6px"></div><div class="skel" style="width:40%;height:12px;margin-top:6px"></div><div class="skel" style="width:80%;height:10px;margin-top:4px"></div></div>').repeat(n) + '</div>';
}
export function cardSkeleton(h, extra) { return '<div class="card db-card ' + (extra || '') + '"><div class="card-head"><div style="flex:1"><div class="skel" style="width:40%;height:14px"></div><div class="skel" style="width:60%;height:10px;margin-top:8px"></div></div></div><div class="card-body"><div class="skel" style="height:' + h + 'px;border-radius:12px"></div></div></div>'; }
function ownerSkeleton() {
  return '<div aria-busy="true" aria-label="Cargando tablero">' + kpiSkeleton(6, 'six') +
    '<div class="db-grid lead">' + cardSkeleton(240) + '<div class="card skel db-skel-card" style="min-height:300px;border-radius:var(--r-lg)"></div></div>' +
    '<div class="db-grid">' + cardSkeleton(250) + cardSkeleton(250) + cardSkeleton(220) + cardSkeleton(230) + '</div></div>';
}

// ─────────────────────────────────────────────────────────────────────
// Barbero: "Mi día"
// ─────────────────────────────────────────────────────────────────────
const BARBER_KPIS = [
  { k: 'today', label: 'Citas hoy', icon: 'calendar', fmt: (n) => number(n) },
  { k: 'done', label: 'Atendidas', icon: 'check-circle', fmt: (n) => number(n) },
  { k: 'week', label: 'Ingresos semana', icon: 'wallet', fmt: (n) => money(Math.round(n)) },
  { k: 'commission', label: 'Comisión del mes', icon: 'percent', fmt: (n) => money(Math.round(n)) }
];

async function renderBarber(el) {
  let W = null, C = null, R = null, PW = null, seq = 0, gone = false, lastLoad = 0, first = true;
  const t0 = today();
  el.innerHTML = String(html`
    <div class="page-head db-head">
      <div><span class="eyebrow">${dateLongCap(t0)}</span><h2>${greeting()}${myName() ? ', ' + myName() : ''}</h2><p id="dbSub">Tu día de un vistazo.</p></div>
    </div>
    <div id="dbB">${raw(barberSkeleton())}</div>`);

  async function load(silent) {
    const my = ++seq;
    lastLoad = Date.now();
    const t = today(), ws = startOfWeek(t), we = addDays(ws, 6);
    const box = $('#dbB', el);
    if (silent && W) { box.classList.add('db-busy'); box.setAttribute('aria-busy', 'true'); }
    const staffId = me() ? me().id : undefined;
    try {
      const [w, pw, c, r] = await Promise.all([
        api.get('/reports/dashboard', { from: ws, to: we, staff_id: staffId }),
        // Mismo corte de la semana pasada (lunes → mismo día) para comparar parejo.
        api.get('/reports/dashboard', { from: addDays(ws, -7), to: addDays(t, -7), staff_id: staffId }).catch(() => null),
        canAny(['commissions.read.all', 'commissions.read.own']) ? api.get('/commissions', { from: startOfMonth(t), to: t, staff_id: staffId }).catch(() => null) : Promise.resolve(null),
        can('messages.send') ? api.get('/reminders').catch(() => null) : Promise.resolve(null)
      ]);
      if (my !== seq || gone) return;
      W = w; C = c; R = r; PW = pw;
    } catch (err) {
      if (my !== seq || gone) return;
      box.classList.remove('db-busy'); box.removeAttribute('aria-busy');
      if (silent && W) { toast.error(err); return; }
      box.innerHTML = String(html`<div class="card">${errorState(err, 'dbRetry')}</div>`);
      return;
    }
    paint();
    box.classList.remove('db-busy'); box.removeAttribute('aria-busy');
    first = false;
  }

  function paint() {
    const box = $('#dbB', el);
    const now = nowMin(), t = today();
    const all = ((W.today && W.today.appointments) || []).slice().sort((a, b) => a.start_min - b.start_min);
    const done = all.filter((a) => a.status === 'completed');
    const live = all.find((a) => ACTIVE.includes(a.status) && a.start_min <= now && now < a.end_min);
    const next = live || all.find((a) => ACTIVE.includes(a.status) && a.start_min > now);
    const left = all.filter((a) => ACTIVE.includes(a.status) && a.end_min > now).length;
    const tom = R && R.items ? R.items.map((x) => x.appointment) : [];
    const mine = C && C.items ? (C.items.find((x) => me() && x.staff_id === me().id) || C.items[0]) : null;
    $('#dbSub', el).textContent = !all.length ? 'Hoy no tienes citas en tu agenda.' : left ? 'Te ' + (left === 1 ? 'queda 1 cita' : 'quedan ' + left + ' citas') + ' por atender hoy.' : '¡Terminaste las citas de hoy!';
    const k = { today: all.length, done: done.length, week: W.kpis.revenue, commission: mine ? mine.commission : 0 };
    const pwFrom = addDays(W.range.from, -7), pwTo = addDays(t, -7);
    const weekDelta = PW ? deltaInfo(W.kpis.revenue, PW.kpis.revenue) : null;
    const pwText = pwFrom === pwTo ? shortDay(pwFrom) : rangeText(pwFrom, pwTo).replace(/ \d{4}$/, '');
    box.innerHTML = String(html`
      ${nextHero(next, live, now, all, done, tom)}
      <div class="db-kpis four" id="dbKpis" style="margin-top:16px">
        <div class="card kpi db-kpi"><div class="label">${raw(icon('calendar'))}Citas hoy</div><div class="value" data-kpi="today" data-to="${k.today}">${number(k.today)}</div><div class="foot">${all.length ? (next ? 'Siguiente a las ' + time(next.start_min) : 'Ya no tienes pendientes') : 'Día libre en tu agenda'}</div></div>
        <div class="card kpi db-kpi"><div class="label">${raw(icon('check-circle'))}Atendidas</div><div class="value" data-kpi="done" data-to="${k.done}">${number(k.done)}</div>
          <div class="progress-bar" aria-hidden="true"><span style="width:${all.length ? Math.round((done.length / all.length) * 100) : 0}%;background:var(--ok)"></span></div><div class="foot">de ${plural(all.length, 'cita')} de hoy</div></div>
        <div class="card kpi db-kpi"><div class="label">${raw(icon('wallet'))}Ingresos semana</div><div class="value" data-kpi="week" data-to="${k.week}">${money(Math.round(k.week))}</div>
          <div class="db-kpi-row">${PW ? deltaHtml(weekDelta, pwText) : html`<span class="delta flat">${raw(icon('minus'))}Sin comparación</span>`}</div>
          <div class="foot">${PW ? 'vs. ' + pwText + ' (' + money(Math.round(PW.kpis.revenue)) + ')' : 'Desde el lunes'}</div></div>
        <div class="card kpi db-kpi"><div class="label">${raw(icon('percent'))}Comisión del mes</div><div class="value" data-kpi="commission" data-to="${k.commission}">${money(Math.round(k.commission))}</div>
          <div class="foot">${mine ? (mine.commission_pct ? mine.commission_pct + '% de ' + money(Math.round(mine.revenue)) : 'Sin comisión configurada') + (mine.tips ? ' · + ' + money(Math.round(mine.tips)) + ' de propinas' : '') : 'Estimada con tus cobros del mes'}</div></div>
      </div>
      <div class="db-bgrid">
        <section class="card db-card" aria-labelledby="dbTlT">
          <div class="card-head"><div><h3 id="dbTlT">Tu día</h3><span class="sub">${all.length ? plural(all.length, 'cita') + ' · ' + plural(done.length, 'atendida') : dateLongCap(t)}</span></div><a class="btn btn-ghost btn-sm" href="#/agenda">Agenda${raw(icon('chevron-right', 'ic-sm'))}</a></div>
          <div class="card-body" style="padding-top:6px">${all.length ? timeline(all, now) : html`${emptyState({ icon: 'calendar', title: 'Hoy no tienes citas', text: tom.length ? 'Mañana tienes ' + plural(tom.length, 'cita') + '. Aprovecha para compartir tu enlace de reservas.' : 'Cuando te agenden una cita aparecerá aquí, en orden.', compact: true })}`}</div>
        </section>
        <div class="stack" style="gap:16px">
        <section class="card db-card" aria-labelledby="dbWkT">
          <div class="card-head"><div><h3 id="dbWkT">Tu semana</h3><span class="sub">${rangeText(W.range.from, W.range.to)}</span></div></div>
          <div class="card-body">${weekCal(W.series, t)}
            <div class="db-wsum"><span><b>${number(W.kpis.appointments)}</b> citas</span><span><b>${number(W.kpis.completed)}</b> atendidas</span><span><b>${money(Math.round(W.kpis.revenue))}</b> cobrado</span></div>
          </div>
        </section>
        ${R ? html`<section class="card db-card db-today" aria-labelledby="dbTmT">
          <div class="card-head"><div><h3 id="dbTmT" style="font-family:var(--sans);font-size:15px;font-weight:600;letter-spacing:0">Mañana</h3><span class="sub">${tom.length ? plural(tom.length, 'cita') + ' · la primera a las ' + time(tom[0].start_min) : 'Sin citas por ahora'}</span></div>
            ${tom.length && can('messages.send') ? html`<a class="btn btn-ghost btn-sm db-to-agenda" href="#/mensajes?tab=recordatorios">${raw(icon('whatsapp', 'ic-sm'))}Recordar</a>` : ''}</div>
          ${tom.length ? html`<div class="db-alist" style="margin-top:12px">${tom.slice(0, 3).map((a) => apptRow(a, -1))}</div>
            ${tom.length > 3 ? html`<div class="db-tmore"><a class="link-btn" style="min-height:46px;justify-content:center;width:100%" href="${'#/agenda?fecha=' + addDays(t, 1)}">Ver las ${tom.length} de mañana</a></div>` : ''}`
            : html`<div class="db-tempty"><span class="art">${raw(icon('calendar'))}</span><div class="grow"><b>Mañana tienes la agenda libre</b><span>Comparte tu enlace para que te reserven.</span></div></div>`}
        </section>` : ''}
        </div>
      </div>`);
    animateKpis($('#dbKpis', box), BARBER_KPIS, first);
  }

  const offs = [];
  offs.push(on(el, 'click', '[data-act="new"]', () => window.TB.newAppointment()));
  offs.push(on(el, 'click', '#dbRetry', () => { $('#dbB', el).innerHTML = barberSkeleton(); load(); }));
  offs.push(on(el, 'click', '[data-act="wa"]', async (e, b) => {
    const a = ((W && W.today && W.today.appointments) || []).find((x) => x.id === b.dataset.id);
    if (!a) return;
    const m = await sheet();
    m.whatsappMenu(b, a);
  }));
  offs.push(...wireAppointmentActions(el, (id) => ((W && W.today && W.today.appointments) || []).concat(((R && R.items) || []).map((x) => x.appointment)).find((a) => a.id === id)));
  let tRefresh = null;
  const refresh = () => { clearTimeout(tRefresh); tRefresh = setTimeout(() => { if (!gone) load(true); }, 250); };
  offs.push(bus.on('appointments:changed', refresh));
  offs.push(bus.on('payments:changed', refresh));
  const onVis = () => { if (!document.hidden && Date.now() - lastLoad > 30000) load(true); };
  document.addEventListener('visibilitychange', onVis);
  const tick = setInterval(() => { if (!document.hidden && W) paint(); }, 60000);
  await load();
  return () => { gone = true; clearTimeout(tRefresh); clearInterval(tick); document.removeEventListener('visibilitychange', onVis); offs.forEach((f) => f()); };
}

function nextHero(next, live, now, all, done, tom) {
  if (!next) {
    const tm = tom && tom[0];
    return html`<section class="db-next fade-up" aria-label="Próxima cita">
      <div class="stack-sm">
        <span class="eyebrow">${raw(icon(all.length ? 'check-circle' : 'sun'))}${all.length ? '¡Listo por hoy!' : 'Día tranquilo'}</span>
        <div class="cl">${all.length ? 'Atendiste ' + plural(done.length, 'cita') + ' hoy.' : 'No tienes citas hoy.'}</div>
        <div class="sv">${tm ? 'Mañana tienes ' + plural(tom.length, 'cita') + '; la primera a las ' + time(tm.start_min) + ' con ' + (tm.client_name || 'un cliente') + '.' : 'Por ahora no tienes citas mañana.'}</div>
      </div>
      <div class="acts">${tm ? html`<button type="button" class="btn db-dark-btn" data-open="${tm.id}">${raw(icon('calendar'))}Ver la de mañana</button>` : ''}${canWrite() ? html`<button type="button" class="btn btn-primary" data-act="new">${raw(icon('plus'))}Nueva cita</button>` : ''}</div>
    </section>`;
  }
  const q = quickAction(next);
  return html`<section class="db-next fade-up" aria-label="${live ? 'Cita en curso' : 'Tu próxima cita'}">
    <div class="stack-sm" style="gap:10px">
      <span class="eyebrow">${raw(icon(live ? 'scissors' : 'clock'))}${live ? 'En curso ahora' : 'Tu próxima cita'}</span>
      <div class="db-next-top"><span class="tm">${time(next.start_min)}</span><span class="cd ${live ? 'live' : ''}">${live ? 'Termina a las ' + time(next.end_min) : untilText(next, now)}</span></div>
      <div><div class="cl">${next.client_name || 'Cliente sin nombre'}</div><div class="sv">${svcText(next)} · ${next.duration_min} min · ${money(next.total)}${next.status === 'pending' ? ' · Sin confirmar' : ''}</div></div>
    </div>
    <div class="acts">
      <button type="button" class="btn db-dark-btn" data-open="${next.id}">${raw(icon('eye'))}Ver cita</button>
      ${can('messages.send') && next.client_phone ? html`<button type="button" class="btn db-dark-btn" data-act="wa" data-id="${next.id}" aria-label="Enviar WhatsApp">${raw(icon('whatsapp'))}WhatsApp</button>` : ''}
      ${q ? html`<button type="button" class="btn ${q.cls}" data-quick="${q.act}" data-id="${next.id}">${raw(icon(q.icon))}${q.label}</button>` : ''}
    </div>
  </section>`;
}

function timeline(all, now) {
  const rows = [];
  let nowPlaced = false;
  const nowLine = html`<div class="db-nowline" aria-hidden="true"><span>AHORA</span><i></i><em></em></div>`;
  all.forEach((a) => {
    if (!nowPlaced && a.start_min > now) { rows.push(nowLine); nowPlaced = true; }
    const q = quickAction(a);
    const done = ['completed', 'no_show'].includes(a.status);
    const cur = ACTIVE.includes(a.status) && a.start_min <= now && now < a.end_min;
    const past = done || a.end_min <= now;
    rows.push(html`<div class="db-tl-row ${done ? 'done' : ''} ${past && !cur ? 'past' : ''} ${cur ? 'cur' : ''}" style="--st:var(--st-${a.status})">
      <div class="t">${time(a.start_min)}<small>${a.duration_min} min</small></div>
      <div class="rail"><i></i></div>
      <div class="bd">
        <button type="button" data-open="${a.id}" aria-label="${'Abrir cita de ' + (a.client_name || 'cliente') + ' a las ' + time(a.start_min) + ', ' + statusLabel(a.status)}"><b class="truncate">${a.client_name || 'Cliente sin nombre'}</b><span class="truncate"><em class="db-stt">${statusLabel(a.status)} · </em>${svcText(a)} · ${money(a.total)}</span></button>
        <span class="act">${q ? html`<button type="button" class="btn btn-sm ${q.cls}" data-quick="${q.act}" data-id="${a.id}">${raw(icon(q.icon, 'ic-sm'))}${q.label}</button>` : statusBadge(a.status)}</span>
      </div>
    </div>`);
  });
  if (!nowPlaced && all.length && now < 24 * 60) rows.push(nowLine);
  return html`<div class="db-tl">${rows}</div>`;
}

function weekCal(series, t) {
  const max = Math.max(1, ...(series || []).map((s) => s.appointments || 0));
  return html`<div class="db-week" role="list">${(series || []).map((s, i) => {
    const isT = s.date === t, past = s.date < t, n = s.appointments || 0;
    return html`<a role="listitem" class="db-day ${isT ? 'today' : ''} ${past ? 'past' : ''} ${n ? '' : 'off'}" href="${'#/agenda?fecha=' + s.date}" aria-label="${dateLongCap(s.date) + ': ' + plural(n, 'cita')}">
      <span class="wd">${WEEKDAYS_SHORT[(i + 1) % 7]}</span><span class="dn">${Number(s.date.slice(8, 10))}</span>
      <span class="meter" aria-hidden="true"><span style="height:${Math.round((n / max) * 100)}%;animation-delay:${i * 50}ms"></span></span>
      <span class="cnt">${n || '—'}</span></a>`;
  })}</div>`;
}

function barberSkeleton() {
  return '<div aria-busy="true" aria-label="Cargando tu día"><div class="skel" style="height:190px;border-radius:var(--r-xl)"></div>' +
    '<div style="margin-top:16px">' + kpiSkeleton(4, 'four') + '</div>' +
    '<div class="db-bgrid">' + cardSkeleton(320) + cardSkeleton(160) + '</div></div>';
}
