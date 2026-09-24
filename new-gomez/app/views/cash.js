// #/caja — Caja y pagos (dueño). Pestañas:
//   Hoy     → caja cerrada: abrir con fondo · caja abierta: efectivo esperado, ventas por método, propinas,
//             movimientos (ingreso/gasto/retiro), cerrar caja con conteo y diferencia en vivo; cobros del día
//             con reembolso.
//   Pagos   → rango + filtros (método, barbero), totales, lista por día, exportar CSV.
//   Cierres → historial de cortes con diferencias resaltadas.
import { html, raw, on, $, $$ } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { bus, can, today, tz, getStaff } from '../lib/state.js';
import { setQuery, navigate } from '../lib/router.js';
import { toast, modal, confirmDialog, busy, menu, emptyState, errorState, skeletonRows, skeletonCards, showFieldErrors, clearFieldErrors, saveFile } from '../lib/ui.js';
import { money, moneyIn, clock as clockIn, METHOD, dateLongCap, dateShort, addDays, startOfMonth, endOfMonth, startOfWeek, addMonths, number, plural, MONTHS_SHORT, WEEKDAYS, weekday } from '../lib/fmt.js';
import { openPaymentSheet, parseMoney, tweenMoney, METHOD_ICON, injectPayStyle, paymentMethods } from '../lib/payment-sheet.js';
import { periodHtml, wirePeriod, fitPeriod } from '../lib/period.js';

const MKEYS = ['cash', 'card', 'transfer', 'other'];
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const clock = (iso) => clockIn(iso, tz()); // 24 h, como la agenda: '14:05'
const dayOf = (iso) => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz(), year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)); } catch (e) { return String(iso || '').slice(0, 10); } };
const WEEKDAY_CAP = (k) => { const w = WEEKDAYS[weekday(k)] || ''; return w.charAt(0).toUpperCase() + w.slice(1); };
const signed = (n, m) => (n > 0 ? '+' : n < 0 ? '−' : '') + (m || money)(Math.abs(n));
const payTotal = (p) => (p.total != null ? p.total : r2(p.amount + (p.tip || 0)));

const CSS = `
.v-cash .grid-main-side,.v-cash .stack-lg,.v-cash .stack,.v-cash .list,.v-cash .pf{grid-template-columns:minmax(0,1fr)}
.v-cash .grid-main-side>*{min-width:0}
@media (min-width:900px){.v-cash .grid-main-side{grid-template-columns:minmax(0,1fr) 340px}}
.cash-grid{align-items:start}
@media (min-width:900px){.v-cash .cash-grid>.cash-main{grid-column:1;grid-row:1}.v-cash .cash-grid>.cash-side{grid-column:2;grid-row:1 / span 2}.v-cash .cash-grid>.cash-pays{grid-column:1;grid-row:2}}
@media (max-width:899px){.v-cash .pay-side{order:-1}.v-cash .cash-grid>.cash-side{order:1}.v-cash .cash-grid>.cash-pays{order:2}}
@media (min-width:640px) and (max-width:899px){.v-cash .cash-side,.v-cash .pay-side{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}.v-cash .cash-side>.banner{grid-column:1/-1}}
.cash-hero{position:relative;overflow:hidden;background:var(--ink);color:var(--on-ink);border-radius:var(--r-xl);padding:20px 18px 18px;box-shadow:var(--shadow-2);border:1px solid rgba(242,237,227,.07)}
.cash-hero::before{content:"";position:absolute;right:-120px;top:-150px;width:380px;height:380px;background:radial-gradient(circle,rgba(217,178,90,.24),transparent 62%);pointer-events:none}
.cash-hero>*{position:relative}
.ch-top{display:flex;align-items:center;justify-content:space-between;gap:8px 12px;flex-wrap:wrap;font-size:12.5px;color:#BDB5A5}
.ch-status{display:inline-flex;align-items:center;gap:7px;height:26px;padding:0 11px;border-radius:999px;background:rgba(111,191,138,.16);color:#8BD9A5;font-weight:700;font-size:12px;letter-spacing:.02em}
.ch-status i{width:7px;height:7px;border-radius:50%;background:#6FBF8A;animation:chPulse 2.2s infinite}
.ch-label{margin-top:18px;font-size:13px;color:#BDB5A5;font-weight:500}
.ch-big{font-family:var(--disp);font-weight:800;font-size:58px;line-height:1;letter-spacing:.005em;color:#F7F2E8;font-variant-numeric:tabular-nums;margin-top:6px}
.ch-formula{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:12px;font-size:12.5px;color:#9E968A}
.ch-formula b{color:#E4DED2;font-weight:600;font-variant-numeric:tabular-nums}
.ch-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}
.ch-actions .btn{flex:1 1 calc(50% - 4px)}
.ch-actions .btn-primary{flex-basis:100%}
.ch-ghost{background:rgba(242,237,227,.08);color:#F2EDE3;border-color:rgba(242,237,227,.14);--spin-c:#F2EDE3}
.ch-ghost:hover:not(:disabled){background:rgba(242,237,227,.15)}
@media (min-width:720px){.cash-hero{padding:24px 28px 22px}.ch-big{font-size:74px}.ch-actions .btn,.ch-actions .btn-primary{flex:0 0 auto}}
@keyframes chPulse{0%{box-shadow:0 0 0 0 rgba(111,191,138,.55)}70%{box-shadow:0 0 0 8px rgba(111,191,138,0)}100%{box-shadow:0 0 0 0 rgba(111,191,138,0)}}
.cash-closed{padding:24px 20px;display:grid;gap:18px;text-align:center;justify-items:center;background:linear-gradient(180deg,var(--brand-softer),var(--surface) 55%)}
.cc-art{width:68px;height:68px;border-radius:22px;background:var(--ink);color:var(--brand);display:grid;place-items:center;box-shadow:var(--shadow-2)}
.cc-art .ic{width:32px;height:32px;stroke-width:1.6}
.cash-closed h3{font-family:var(--disp);font-size:28px;font-weight:800;line-height:1.05}
.cash-closed p{color:var(--text-2);font-size:14px;max-width:420px;margin:6px auto 0}
.cc-form{display:grid;gap:12px;width:100%;max-width:360px;text-align:left}
.cc-last{font-size:12.5px;color:var(--text-3);display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center}
.pm-ic{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;flex:none;background:var(--muted-soft);color:var(--text-2)}
.pm-ic .ic{width:19px;height:19px}
.m-cash{--mc:var(--ok)}.m-card{--mc:var(--info)}.m-transfer{--mc:var(--brand-strong)}.m-other{--mc:var(--text-3)}
.pm-ic.m-cash{background:var(--ok-soft);color:var(--ok)}.pm-ic.m-card{background:var(--info-soft);color:var(--info)}
.pm-ic.m-transfer{background:var(--brand-soft);color:var(--brand-strong)}
.pay-row .pay-amt{display:grid;justify-items:end;gap:1px;line-height:1.2}
.pay-row .pay-amt b{font-size:15px}
.pay-row .pay-amt small{font-size:11.5px;color:var(--text-3);white-space:nowrap}
.pay-row.is-refunded .title,.pay-row.is-refunded .pay-amt b{text-decoration:line-through;color:var(--text-3)}
.pay-row.is-refunded .pm-ic{opacity:.5}
.card-foot-link{display:flex;justify-content:center;border-top:1px solid var(--border);padding:6px}
.card-foot-link button{min-height:40px;padding:0 12px;border-radius:10px;font-weight:600;font-size:13.5px;color:var(--brand-strong);display:inline-flex;align-items:center;gap:6px}
.card-foot-link button:hover{background:var(--brand-softer)}
.mb-bar{display:flex;height:12px;border-radius:999px;overflow:hidden;background:var(--surface-3);gap:2px}
.mb-bar span{display:block;height:100%;background:var(--mc);transform-origin:left;animation:mbGrow .7s var(--ease-out) both}
.mb-bar span:first-child{border-radius:999px 0 0 999px}.mb-bar span:last-child{border-radius:0 999px 999px 0}.mb-bar span:only-child{border-radius:999px}
@keyframes mbGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.mb-legend{display:grid;gap:2px;margin-top:14px}
.mb-row{display:flex;align-items:center;gap:10px;min-height:34px;font-size:14px}
.mb-row .dot{background:var(--mc)}
.mb-row .faint{font-size:12.5px;width:40px;text-align:right}
.mb-row b{font-variant-numeric:tabular-nums;min-width:84px;text-align:right}
.mv-sum{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:6px}
.mv-sum div{background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r);padding:10px;display:grid;gap:2px}
.mv-sum span{font-size:11.5px;color:var(--text-3);font-weight:600}
.mv-sum b{font-size:15px;font-variant-numeric:tabular-nums}
.mv-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)}
.mv-row:last-child{border-bottom:0}
.mv-row .mv-ic{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;flex:none}
.mv-row .mv-ic .ic{width:16px;height:16px}
.mv-income .mv-ic{background:var(--ok-soft);color:var(--ok)}.mv-expense .mv-ic{background:var(--err-soft);color:var(--err)}.mv-withdrawal .mv-ic{background:var(--warn-soft);color:var(--warn)}
.mv-row .t{font-size:14px;font-weight:600}.mv-row .m{font-size:12px;color:var(--text-3)}
.mv-row .a{margin-left:auto;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.tip-rows{display:grid;gap:2px}
.tip-rows div{display:flex;justify-content:space-between;min-height:30px;align-items:center;font-size:14px;color:var(--text-2)}
.tip-rows b{color:var(--text);font-variant-numeric:tabular-nums}
.cl-exp{display:grid;justify-items:center;text-align:center;gap:2px;padding:14px;border-radius:var(--r-lg);background:var(--surface-2);border:1px solid var(--border)}
.cl-exp b{font-size:40px;font-weight:800;line-height:1.05;font-variant-numeric:tabular-nums}
.cl-exp .faint{font-size:12.5px}
.cl-diff{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:var(--r);border:1px solid transparent;transition:background .2s,color .2s,border-color .2s;min-height:62px}
.cl-diff .ci{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;flex:none;background:rgba(255,255,255,.35)}
.cl-diff .tx{display:grid;gap:1px;flex:1;min-width:0}
.cl-diff .tx b{font-size:14.5px}.cl-diff .tx span{font-size:12.5px;opacity:.85}
.cl-diff .amt{font-family:var(--disp);font-size:28px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
.cl-diff.idle{background:var(--surface-2);color:var(--text-2);border-color:var(--border)}
.cl-diff.ok{background:var(--ok-soft);color:var(--ok)}.cl-diff.warn{background:var(--warn-soft);color:var(--warn)}.cl-diff.err{background:var(--err-soft);color:var(--err)}
.cl-diff.pulse{animation:pop .35s var(--ease-out)}
.den-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:12px;border-radius:var(--r);background:var(--surface-2);border:1px solid var(--border);animation:fadeUp .25s var(--ease-out)}
@media (min-width:560px){.den-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.den{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600}
.den span{flex:1;white-space:nowrap}
.den small{display:block;font-size:11px;color:var(--text-3);font-weight:500}
.den input{width:64px;min-height:40px;text-align:center;padding:6px}
.den-total{grid-column:1/-1;display:flex;justify-content:space-between;font-size:13px;color:var(--text-2);padding-top:6px;border-top:1px dashed var(--border-strong)}
.pf{display:grid;gap:10px;margin-bottom:16px}
.pf .row{gap:8px}
.pf .select{width:auto;min-width:180px;min-height:40px}
.pf-custom{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pf-custom .input{width:auto;min-height:40px}
.day-sep{padding:10px 16px 6px;font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);background:var(--surface-2);border-bottom:1px solid var(--border);display:flex;justify-content:space-between}
.day-sep b{letter-spacing:0;text-transform:none;font-weight:600;color:var(--text-2)}
.ses-row{align-items:flex-start;padding:14px 16px}
.ses-date{width:48px;flex:none;display:grid;justify-items:center;border-radius:12px;background:var(--surface-2);border:1px solid var(--border);padding:6px 0 5px;line-height:1}
.ses-date b{font-family:var(--disp);font-size:22px;font-weight:800}
.ses-date span{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-top:3px}
.ses-nums{display:flex;flex-wrap:wrap;gap:2px 12px;font-size:12.5px;color:var(--text-2);margin-top:4px}
.ses-nums b{font-variant-numeric:tabular-nums;color:var(--text)}
.ses-note{font-size:12.5px;color:var(--text-3);margin-top:6px;white-space:pre-line;border-left:2px solid var(--border-strong);padding-left:8px}
.ses-row.bad{box-shadow:inset 3px 0 0 var(--err)}.ses-row.over{box-shadow:inset 3px 0 0 var(--warn)}
.kpi.hl{background:linear-gradient(180deg,var(--brand-softer),var(--surface))}
.mv-tip{font-size:12.5px;color:var(--text-3);min-height:18px}
`;
function injectStyle() { injectPayStyle(); if (!document.getElementById('st-cash')) document.head.insertAdjacentHTML('beforeend', '<style id="st-cash">' + CSS + '</style>'); }

function diffBadge(d) {
  if (d == null) return raw('<span class="badge info">Abierta</span>');
  if (Math.abs(d) < 0.005) return raw('<span class="badge ok">Cuadró</span>');
  return d > 0 ? html`<span class="badge warn">Sobrante ${signed(d)}</span>` : html`<span class="badge err">Faltante ${signed(d)}</span>`;
}
function methodBars(by, opts) {
  opts = opts || {};
  const total = MKEYS.reduce((a, k) => a + (Number(by[k]) || 0), 0);
  if (!total) return html`<p class="muted" style="font-size:14px">${opts.empty || 'Aún no hay ventas.'}</p>`;
  const active = paymentMethods();
  const keys = MKEYS.filter((k) => by[k] || active.includes(k));
  const pctOf = (k) => Math.round(((Number(by[k]) || 0) / total) * 100);
  const m = moneyIn(keys.map((k) => by[k]));
  return html`<div class="mb-bar" role="img" aria-label="${keys.map((k) => METHOD[k] + ' ' + pctOf(k) + '%').join(', ')}">${keys.filter((k) => by[k]).map((k) => html`<span class="m-${k}" style="width:${String(((Number(by[k]) || 0) / total) * 100)}%"></span>`)}</div>
    <div class="mb-legend">${keys.map((k) => html`<div class="mb-row m-${k}"><span class="dot"></span><span class="grow">${METHOD[k]}</span><span class="faint">${String(pctOf(k))}%</span><b>${m(by[k] || 0)}</b></div>`)}</div>`;
}
// opts: { noTime, m (formato de dinero común a la lista, ver moneyIn) }
function payRow(p, opts) {
  opts = opts || {};
  const m = opts.m || money;
  const refunded = p.status === 'refunded';
  const title = p.client_name || p.concept || 'Venta';
  const meta = [p.client_name ? p.concept : '', p.staff_name, opts.noTime ? '' : clock(p.created_at)].filter(Boolean).join(' · ');
  const hasMenu = (can('payments.refund') && !refunded) || p.appointment_id;
  return html`<div class="list-item pay-row ${refunded ? 'is-refunded' : ''}">
    <span class="pm-ic m-${p.method}" aria-hidden="true">${raw(icon(METHOD_ICON[p.method] || 'receipt'))}</span>
    <div class="grow"><div class="title truncate">${title}</div><div class="meta truncate">${meta}</div></div>
    <div class="trail"><div class="pay-amt"><b class="num">${m(payTotal(p))}</b>
      ${refunded ? raw('<span class="badge err plain">Reembolsado</span>') : Number(p.tip) ? html`<small>incl. ${m(p.tip)} de propina</small>` : html`<small>${METHOD[p.method] || ''}</small>`}</div>
      ${hasMenu ? html`<button type="button" class="btn btn-ghost btn-icon btn-sm" data-act="pay-menu" data-pid="${p.id}" aria-label="Opciones del cobro de ${title}">${raw(icon('more-v'))}</button>` : ''}</div>
  </div>`;
}

// ── Rangos de la pestaña Pagos ──
const RANGES = [['hoy', 'Hoy'], ['ayer', 'Ayer'], ['semana', 'Esta semana'], ['mes', 'Este mes'], ['mes_ant', 'Mes pasado'], ['otro', 'Otro']];
function rangeOf(key, q) {
  const t = today();
  if (key === 'ayer') { const d = addDays(t, -1); return { from: d, to: d }; }
  if (key === 'semana') return { from: startOfWeek(t), to: t };
  if (key === 'mes') return { from: startOfMonth(t), to: t };
  if (key === 'mes_ant') { const s = addMonths(t, -1); return { from: s, to: endOfMonth(s) }; }
  if (key === 'otro') {
    const from = /^\d{4}-\d{2}-\d{2}$/.test(q.desde || '') ? q.desde : addDays(t, -6);
    let to = /^\d{4}-\d{2}-\d{2}$/.test(q.hasta || '') ? q.hasta : t;
    if (to < from) to = from;
    return { from, to };
  }
  return { from: t, to: t };
}
function rangeLabel(r) {
  if (r.from === r.to) return dateLongCap(r.from);
  const [y1, m1, d1] = r.from.split('-').map(Number), [y2, m2, d2] = r.to.split('-').map(Number);
  if (y1 === y2 && m1 === m2) return d1 + '–' + d2 + ' ' + MONTHS_SHORT[m1 - 1] + ' ' + y1;
  return d1 + ' ' + MONTHS_SHORT[m1 - 1] + (y1 !== y2 ? ' ' + y1 : '') + ' – ' + d2 + ' ' + MONTHS_SHORT[m2 - 1] + ' ' + y2;
}

export default {
  title: 'Caja y pagos',
  async render(el, { query }) {
    injectStyle();
    el.classList.add('v-cash');
    const TABS = [['hoy', 'Hoy'], ['pagos', 'Pagos'], ['cierres', 'Cierres']];
    let tab = TABS.some((t) => t[0] === query.tab) ? query.tab : 'hoy';
    const pq = { r: RANGES.some((x) => x[0] === query.r) ? query.r : 'hoy', m: MKEYS.includes(query.m) ? query.m : '', b: query.b || '', desde: query.desde || '', hasta: query.hasta || '' };
    let sesRange = ['30', '90', '365'].includes(query.dias) ? query.dias : '30';
    const S = { cur: null, pays: null, list: null, lastExpected: 0 };
    let seq = 0;

    el.innerHTML = String(html`
      <div class="page-head">
        <div><h2>Caja y pagos</h2><p id="cashSub">${dateLongCap(today())}</p></div>
        <div class="actions">${can('payments.write') ? html`<button type="button" class="btn btn-primary" data-act="charge" id="headCharge" hidden>${raw(icon('plus'))}Registrar cobro</button>` : ''}</div>
      </div>
      <div class="tabs" role="tablist" aria-label="Secciones de caja">${TABS.map(([k, l]) => html`<button type="button" role="tab" id="tab-${k}" aria-controls="cashTab" data-tab="${k}" aria-selected="${String(k === tab)}">${l}</button>`)}</div>
      <div id="cashTab" role="tabpanel"></div>`);
    const box = $('#cashTab', el);
    const setHeadCharge = (show) => { const b = $('#headCharge', el); if (b) b.hidden = !show; };
    const syncQuery = () => setQuery(tab === 'pagos' ? Object.assign({ tab }, pq.r !== 'hoy' ? { r: pq.r } : {}, pq.m ? { m: pq.m } : {}, pq.b ? { b: pq.b } : {}, pq.r === 'otro' ? { desde: pq.desde, hasta: pq.hasta } : {})
      : tab === 'cierres' ? { tab, dias: sesRange !== '30' ? sesRange : '' } : {});

    function show(soft) {
      const my = ++seq;
      $$('[data-tab]', el).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
      box.setAttribute('aria-labelledby', 'tab-' + tab);
      syncQuery();
      if (tab === 'hoy') return renderToday(my, soft);
      if (tab === 'pagos') return renderPayments(my, soft);
      return renderSessions(my, soft);
    }
    const alive = (my) => my === seq && document.body.contains(box);

    // ════════ HOY ════════
    async function renderToday(my, soft) {
      const t = today();
      if (!soft) {
        setHeadCharge(false);
        box.innerHTML = String(html`<div class="grid-main-side cash-grid"><div class="stack-lg"><div class="card skel" style="height:250px;border:0;border-radius:var(--r-xl)"></div><div class="card">${skeletonRows(4)}</div></div><div class="stack-lg">${skeletonCards(2, 180)}</div></div>`);
      }
      let cur, pays;
      try { [cur, pays] = await Promise.all([api.get('/cash/current'), api.get('/payments', { from: t, to: t })]); }
      catch (err) { if (alive(my)) { box.innerHTML = String(html`<div class="card">${errorState(err, 'cashRetry')}</div>`); } return; }
      if (!alive(my)) return;
      S.cur = cur; S.pays = pays;
      setHeadCharge(!cur.session);
      $('#cashSub', el).textContent = dateLongCap(t) + (cur.session ? ' · Caja abierta' : ' · Caja cerrada');
      box.innerHTML = String(cur.session ? openHtml(cur, pays) : closedHtml(cur, pays));
      const big = $('#chBig', box);
      if (big) { big.dataset.v = String(soft ? S.lastExpected : 0); tweenMoney(big, cur.summary.expected_cash); S.lastExpected = cur.summary.expected_cash; }
      const f = $('#openF', box);
      if (f) f.addEventListener('submit', (e) => submitOpen(e, f));
    }

    function todayPaysCard(pays) {
      const items = (pays && pays.items) || [];
      const tt = (pays && pays.totals) || { count: 0, total: 0 };
      const m = moneyIn(items.slice(0, 12).map(payTotal));
      return html`<section class="card" aria-labelledby="hPays">
        <div class="card-head"><h3 id="hPays">Cobros de hoy</h3><span class="sub">${tt.count ? plural(tt.count, 'cobro') + ' · ' + money(tt.total) : ''}</span></div>
        ${items.length ? html`<div class="list" style="margin-top:8px">${items.slice(0, 12).map((p) => payRow(p, { m }))}</div>
          <div class="card-foot-link"><button type="button" data-act="tab" data-tab="pagos">${items.length > 12 ? 'Ver los ' + items.length + ' cobros' : 'Ver todos los pagos'}${raw(icon('arrow-right', 'ic-sm'))}</button></div>`
          : html`<div class="card-body">${emptyState({ icon: 'receipt', title: 'Aún no hay cobros hoy', text: 'Cobra desde la agenda al terminar cada cita, o registra aquí una venta suelta.', compact: true, action: can('payments.write') ? { label: 'Registrar cobro', id: 'emptyCharge', icon: 'plus' } : null })}</div>`}
      </section>`;
    }

    function closedHtml(cur, pays) {
      const last = cur.last_session;
      const tt = (pays && pays.totals) || { by_method: {}, tip: 0, total: 0, count: 0 };
      return html`<div class="grid-main-side cash-grid">
        <div class="stack-lg cash-main">
          <section class="card cash-closed fade-up" aria-labelledby="ccT">
            <div class="cc-art">${raw(icon('wallet'))}</div>
            <div><h3 id="ccT">La caja está cerrada</h3><p>Ábrela con el efectivo con el que empiezas el día. Al cerrar sabrás si cuadra al peso.</p></div>
            ${can('cash.manage') ? html`<form class="cc-form" id="openF" novalidate>
              <div class="field"><label for="ofFloat">Fondo inicial</label>
                <div class="money-in xl"><span>$</span><input class="input" id="ofFloat" name="opening_float" inputmode="decimal" autocomplete="off" placeholder="0"/></div>
                <p class="hint">Es el cambio con el que empiezas. Puede ser $0.</p>
                <p class="error">Revisa el monto.</p></div>
              <button class="btn btn-primary btn-lg btn-block" type="submit">${raw(icon('wallet'))}Abrir caja</button>
            </form>` : ''}
            ${last ? html`<div class="cc-last"><span>Último corte: ${dateShort(last.date)} · contado ${money(last.counted_cash)}</span>${diffBadge(last.difference)}</div>` : ''}
          </section>
        </div>
        <div class="cash-pays">${todayPaysCard(pays)}</div>
        <aside class="stack-lg cash-side">
          <section class="card card-pad" aria-labelledby="hSold">
            <div class="eyebrow" id="hSold">Cobrado hoy</div>
            <div class="disp num" style="font-size:40px;font-weight:800;line-height:1.1;margin:4px 0 2px">${money(tt.total)}</div>
            <p class="faint" style="font-size:13px;margin-bottom:14px">${tt.count ? plural(tt.count, 'cobro') + (tt.tip ? ' · ' + money(tt.tip) + ' de propinas' : '') : 'Sin cobros todavía'}</p>
            ${methodBars(tt.by_method || {}, { empty: 'Cuando cobres, aquí verás cuánto entró en efectivo, tarjeta y transferencia.' })}
          </section>
          <section class="banner info">${raw(icon('info'))}<div class="grow">Los cobros con tarjeta o transferencia se registran aunque la caja esté cerrada. El efectivo solo entra al corte si la caja está abierta.</div></section>
        </aside>
      </div>`;
    }

    function openHtml(cur, pays) {
      const s = cur.summary, ses = cur.session;
      const tips = r2(s.cash_tips + s.card_tips + s.transfer_tips);
      const sales = r2(s.cash_sales + s.card_sales + s.transfer_sales + s.other_sales);
      const movs = (cur.movements || []).slice().reverse();
      const old = ses.date < today();
      const mf = moneyIn([s.opening_float, s.cash_sales, s.cash_tips, s.income, s.expense, s.withdrawal]);
      const mk = moneyIn([sales, tips, s.card_sales, s.transfer_sales]);
      const mm = moneyIn([s.income, s.expense, s.withdrawal].concat(movs.map((mv) => mv.amount)));
      return html`<div class="grid-main-side cash-grid">
        <div class="stack-lg cash-main">
          ${old ? html`<div class="banner warn">${raw(icon('alert'))}<div class="grow"><b>Esta caja sigue abierta desde el ${dateLongCap(ses.date).toLowerCase()}.</b> Haz el corte para empezar el día con las cuentas claras.</div></div>` : ''}
          <section class="cash-hero fade-up" aria-labelledby="chL">
            <div class="ch-top"><span class="ch-status"><i></i>Caja abierta</span><span>Desde las ${clock(ses.opened_at)}${old ? ' del ' + dateShort(ses.date) : ''}${ses.opened_by_name ? ' · ' + ses.opened_by_name : ''}</span></div>
            <div class="ch-label" id="chL">Efectivo que debe haber en caja</div>
            <div class="ch-big" id="chBig" aria-live="polite">${money(s.expected_cash)}</div>
            <div class="ch-formula">
              <span>Fondo <b>${mf(s.opening_float)}</b></span>
              <span>+ Ventas en efectivo <b>${mf(s.cash_sales)}</b></span>
              <span>+ Propinas en efectivo <b>${mf(s.cash_tips)}</b></span>
              ${s.income ? html`<span>+ Ingresos <b>${mf(s.income)}</b></span>` : ''}
              ${s.expense ? html`<span>− Gastos <b>${mf(s.expense)}</b></span>` : ''}
              ${s.withdrawal ? html`<span>− Retiros <b>${mf(s.withdrawal)}</b></span>` : ''}
            </div>
            <div class="ch-actions">
              ${can('payments.write') ? html`<button type="button" class="btn btn-primary" data-act="charge">${raw(icon('plus'))}Registrar cobro</button>` : ''}
              ${can('cash.manage') ? html`<button type="button" class="btn ch-ghost" data-act="movement">${raw(icon('transfer'))}Movimiento</button>
                <button type="button" class="btn ch-ghost" data-act="close-cash">${raw(icon('lock'))}Cerrar caja</button>` : ''}
            </div>
          </section>
          <div class="kpis stagger">
            <div class="card kpi"><span class="label">${raw(icon('receipt'))}Vendido en el turno</span><span class="value">${mk(sales)}</span><span class="foot">${plural(s.payments_count || 0, 'cobro')}</span></div>
            <div class="card kpi"><span class="label">${raw(icon('gift'))}Propinas</span><span class="value">${mk(tips)}</span><span class="foot">Efectivo ${money(s.cash_tips)}</span></div>
            <div class="card kpi"><span class="label">${raw(icon('card'))}Tarjeta</span><span class="value">${mk(s.card_sales)}</span><span class="foot">${s.card_tips ? '+ ' + money(s.card_tips) + ' propinas' : 'Sin propinas'}</span></div>
            <div class="card kpi"><span class="label">${raw(icon('transfer'))}Transferencia</span><span class="value">${mk(s.transfer_sales)}</span><span class="foot">${s.transfer_tips ? '+ ' + money(s.transfer_tips) + ' propinas' : 'Sin propinas'}</span></div>
          </div>
        </div>
        <div class="cash-pays">${todayPaysCard(pays)}</div>
        <aside class="stack-lg cash-side">
          <section class="card" aria-labelledby="hMeth">
            <div class="card-head"><h3 id="hMeth">Ventas por método</h3><span class="sub">Sin propinas</span></div>
            <div class="card-body">${methodBars({ cash: s.cash_sales, card: s.card_sales, transfer: s.transfer_sales, other: s.other_sales }, { empty: 'Aún no hay ventas en este turno.' })}</div>
          </section>
          <section class="card" aria-labelledby="hMov">
            <div class="card-head"><h3 id="hMov">Movimientos de caja</h3>${can('cash.manage') ? html`<button type="button" class="btn btn-ghost btn-sm" data-act="movement">${raw(icon('plus'))}Nuevo</button>` : ''}</div>
            <div class="card-body">
              <div class="mv-sum"><div><span>Ingresos</span><b class="ok-t">${signed(s.income, mm)}</b></div><div><span>Gastos</span><b class="err-t">${s.expense ? '−' + mm(s.expense) : mm(0)}</b></div><div><span>Retiros</span><b class="warn-t">${s.withdrawal ? '−' + mm(s.withdrawal) : mm(0)}</b></div></div>
              ${movs.length ? html`<div>${movs.map((mv) => html`<div class="mv-row mv-${mv.type}">
                  <span class="mv-ic" aria-hidden="true">${raw(icon(mv.type === 'income' ? 'arrow-down' : mv.type === 'expense' ? 'receipt' : 'arrow-up'))}</span>
                  <div class="grow" style="min-width:0"><div class="t truncate">${mv.concept || ''}</div><div class="m">${{ income: 'Ingreso', expense: 'Gasto', withdrawal: 'Retiro' }[mv.type]} · ${clock(mv.created_at)}${mv.created_by_name ? ' · ' + mv.created_by_name : ''}</div></div>
                  <span class="a ${mv.type === 'income' ? 'ok-t' : ''}">${mv.type === 'income' ? '+' : '−'}${mm(mv.amount)}</span></div>`)}</div>`
                : html`<p class="muted" style="font-size:13.5px;margin-top:10px">Registra aquí lo que pagues con efectivo de la caja (insumos, comida), los retiros y el dinero que entre aparte de los cobros.</p>`}
            </div>
          </section>
        </aside>
      </div>`;
    }

    async function submitOpen(e, form) {
      e.preventDefault();
      clearFieldErrors(form);
      const rawV = form.opening_float.value;
      const v = rawV.trim() === '' ? 0 : parseMoney(rawV);
      if (!Number.isFinite(v) || v < 0) { const f = form.opening_float.closest('.field'); f.classList.add('invalid'); f.querySelector('.error').textContent = 'Escribe el fondo con números (p. ej. 500).'; form.opening_float.focus(); return; }
      try {
        await busy(form.querySelector('[type=submit]'), api.post('/cash/open', { opening_float: r2(v) }));
        toast.success('Caja abierta · fondo de ' + money(v));
        bus.emit('cash:changed');
      } catch (err) { showFieldErrors(form, err); }
    }

    // ── Cerrar caja ──
    function openClose() {
      const cur = S.cur;
      if (!cur || !cur.session) return;
      const s = cur.summary, exp = s.expected_cash;
      const DEN = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5];
      const m = modal({
        title: 'Cerrar caja', subtitle: 'Cuenta el efectivo y compáralo con lo esperado.',
        body: String(html`<form id="closeF" class="stack" novalidate>
          <div class="cl-exp"><span class="eyebrow">Efectivo esperado</span><b class="disp">${money(exp)}</b>
            <span class="faint">Fondo ${money(s.opening_float)} + efectivo cobrado ${money(r2(s.cash_sales + s.cash_tips))}${s.income ? ' + ingresos ' + money(s.income) : ''}${s.expense + s.withdrawal ? ' − salidas ' + money(r2(s.expense + s.withdrawal)) : ''}</span></div>
          <div class="field"><label for="clCount">Efectivo contado</label>
            <div class="money-in xl"><span>$</span><input class="input" id="clCount" name="counted_cash" inputmode="decimal" autocomplete="off" placeholder="0"/></div>
            <p class="error">Escribe cuánto efectivo contaste.</p></div>
          <div class="cl-diff idle" id="clDiff" aria-live="polite"></div>
          <button type="button" class="link-btn" data-den-toggle aria-expanded="false" aria-controls="clDen" style="justify-self:start;min-height:36px">${raw(icon('grid', 'ic-sm'))}Contar por billetes y monedas</button>
          <div class="den-grid" id="clDen" hidden>
            ${DEN.map((d) => html`<label class="den"><span>${d >= 1 ? '$' + number(d) : '50¢'}<small>${d >= 20 ? 'billete' : 'moneda'}</small></span><input class="input" type="number" min="0" step="1" inputmode="numeric" data-den="${String(d)}" placeholder="0" aria-label="Cantidad de ${d >= 20 ? 'billetes' : 'monedas'} de ${d >= 1 ? '$' + d : '50 centavos'}"/></label>`)}
            <div class="den-total"><span>Suma del conteo</span><b id="clDenSum">$0</b></div>
          </div>
          <div class="field"><label for="clNotes">Notas <span class="opt">(opcional)</span></label>
            <textarea class="textarea" id="clNotes" name="notes" maxlength="300" rows="2" placeholder="Ej. Faltaron $20 de un cambio mal dado"></textarea><p class="error"></p></div>
        </form>`),
        actions: [
          { label: 'Cancelar', variant: 'secondary' },
          { label: 'Cerrar caja', variant: 'dark', type: 'submit', form: 'closeF', icon: 'lock', close: false }
        ]
      });
      const form = $('#closeF', m.body), inp = $('#clCount', m.body), diffEl = $('#clDiff', m.body);
      let lastKind = '';
      const paintDiff = () => {
        const v = parseMoney(inp.value);
        let kind, head, sub, amt = '';
        if (!inp.value.trim() || !Number.isFinite(v)) { kind = 'idle'; head = 'Escribe cuánto efectivo contaste'; sub = 'Te diremos al instante si cuadra.'; }
        else {
          const d = r2(v - exp);
          if (Math.abs(d) < 0.005) { kind = 'ok'; head = '¡Cuadra exacto!'; sub = 'El efectivo contado coincide con lo esperado.'; amt = money(0); }
          else if (d > 0) { kind = 'warn'; head = 'Sobrante'; sub = 'Hay más efectivo del esperado.'; amt = signed(d); }
          else { kind = 'err'; head = 'Faltante'; sub = 'Falta efectivo respecto a lo esperado.'; amt = signed(d); }
        }
        diffEl.className = 'cl-diff ' + kind + (kind !== lastKind && kind !== 'idle' ? ' pulse' : '');
        lastKind = kind;
        diffEl.innerHTML = String(html`<span class="ci" aria-hidden="true">${raw(icon(kind === 'ok' ? 'check' : kind === 'idle' ? 'cash' : 'alert'))}</span><span class="tx"><b>${head}</b><span>${sub}</span></span>${amt ? html`<span class="amt">${amt}</span>` : ''}`);
      };
      paintDiff();
      m.body.addEventListener('input', (e) => {
        if (e.target.dataset.den) {
          const sum = r2($$('[data-den]', m.body).reduce((a, i) => a + (Math.max(0, Math.floor(Number(i.value) || 0)) * Number(i.dataset.den)), 0));
          $('#clDenSum', m.body).textContent = money(sum);
          inp.value = sum ? String(sum) : '';
        }
        inp.closest('.field').classList.remove('invalid');
        paintDiff();
      });
      m.body.addEventListener('click', (e) => {
        const t = e.target.closest('[data-den-toggle]');
        if (!t) return;
        const g = $('#clDen', m.body); g.hidden = !g.hidden; t.setAttribute('aria-expanded', String(!g.hidden));
        if (!g.hidden) { const f = g.querySelector('input'); if (f) f.focus(); }
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFieldErrors(form);
        const v = parseMoney(inp.value);
        if (!inp.value.trim() || !Number.isFinite(v) || v < 0) { inp.closest('.field').classList.add('invalid'); inp.focus(); const b = form.closest('.modal'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); return; }
        const d = r2(v - exp);
        const verdict = Math.abs(d) < 0.005 ? 'Cuadra exacto.' : d > 0 ? 'Hay un sobrante de ' + money(d) + '.' : 'Hay un faltante de ' + money(-d) + '.';
        const ok = await confirmDialog({ title: '¿Cerrar la caja?', icon: 'lock', message: 'Contado ' + money(v) + ' · esperado ' + money(exp) + '. ' + verdict + ' Después del corte ya no se pueden registrar movimientos en esta caja.', confirmText: 'Sí, cerrar caja' });
        if (!ok) return;
        const btn = m.foot.querySelector('[type=submit]');
        try {
          const r = await busy(btn, api.post('/cash/close', { counted_cash: r2(v), notes: form.notes.value.trim() || undefined }));
          const diff = r && r.session ? Number(r.session.difference) || 0 : d;
          m.close();
          if (Math.abs(diff) < 0.005) toast.success('Caja cerrada · cuadró exacto');
          else toast.success('Caja cerrada con ' + (diff > 0 ? 'sobrante' : 'faltante') + ' de ' + money(Math.abs(diff)));
          bus.emit('cash:changed');
          bus.emit('notifications:changed');
        } catch (err) { showFieldErrors(form, err); }
      });
    }

    // ── Movimiento de caja ──
    function openMovement() {
      const cur = S.cur;
      if (!cur || !cur.session) { toast.info('Abre la caja para registrar movimientos.'); return; }
      const avail = cur.summary.expected_cash;
      const TYPES = [
        ['expense', 'Gasto', 'receipt', 'Pagas algo con efectivo de la caja.'],
        ['withdrawal', 'Retiro', 'arrow-up', 'Sacas efectivo: depósito al banco, retiro del dueño.'],
        ['income', 'Ingreso', 'arrow-down', 'Entra efectivo que no es un cobro: cambio, aporte.']
      ];
      const SUG = { income: ['Cambio (morralla)', 'Aporte del dueño', 'Otro ingreso'], expense: ['Insumos', 'Limpieza', 'Comida', 'Garrafón de agua', 'Mantenimiento'], withdrawal: ['Depósito al banco', 'Retiro del dueño', 'Pago de comisión'] };
      let type = 'expense';
      const m = modal({
        title: 'Movimiento de caja', subtitle: 'Efectivo que entra o sale sin ser un cobro.',
        body: String(html`<form id="mvF" class="pay-form" novalidate>
          <div class="field"><span class="label" id="mvTL">Tipo</span>
            <div class="pay-methods" role="radiogroup" aria-labelledby="mvTL" style="--n:3">${TYPES.map(([k, l, ic], i) => html`<button type="button" role="radio" data-mtype="${k}" aria-checked="${String(i === 0)}" tabindex="${i === 0 ? '0' : '-1'}">${raw(icon(ic))}${l}</button>`)}</div>
            <p class="mv-tip" id="mvTip">${TYPES[0][3]}</p>
            <input type="hidden" name="type" value="expense"/><p class="error"></p></div>
          <div class="field"><label for="mvAmt">Monto</label>
            <div class="money-in xl"><span>$</span><input class="input" id="mvAmt" name="amount" inputmode="decimal" autocomplete="off" placeholder="0"/></div>
            <p class="hint" id="mvAvail">Hay ${money(avail)} en caja.</p><p class="error">Escribe el monto.</p></div>
          <div class="field"><label for="mvConcept">Concepto</label>
            <input class="input" id="mvConcept" name="concept" maxlength="120" placeholder="¿En qué se usó o de dónde vino?"/>
            <div class="chips" id="mvSug" style="margin-top:4px"></div>
            <p class="error">Escribe el concepto (mínimo 2 letras).</p></div>
        </form>`),
        actions: [
          { label: 'Cancelar', variant: 'secondary' },
          { label: 'Registrar', variant: 'primary', type: 'submit', form: 'mvF', icon: 'check', close: false }
        ]
      });
      const form = $('#mvF', m.body);
      const paintType = () => {
        const t = TYPES.find((x) => x[0] === type);
        $$('[data-mtype]', m.body).forEach((b) => { const onx = b.dataset.mtype === type; b.setAttribute('aria-checked', String(onx)); b.tabIndex = onx ? 0 : -1; });
        form.type.value = type;
        $('#mvTip', m.body).textContent = t[3];
        $('#mvAvail', m.body).textContent = type === 'income' ? 'Se sumará al efectivo esperado.' : 'Hay ' + money(avail) + ' en caja.';
        $('#mvSug', m.body).innerHTML = String(html`${SUG[type].map((c) => html`<button type="button" class="chip" data-sug="${c}">${c}</button>`)}`);
      };
      paintType();
      m.body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-mtype]');
        if (b) { type = b.dataset.mtype; paintType(); return; }
        const s = e.target.closest('[data-sug]');
        if (s) { form.concept.value = s.dataset.sug; form.concept.closest('.field').classList.remove('invalid'); form.concept.focus(); }
      });
      $('.pay-methods', m.body).addEventListener('keydown', (e) => {
        if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
        e.preventDefault();
        const i = TYPES.findIndex((x) => x[0] === type), d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
        type = TYPES[(i + d + TYPES.length) % TYPES.length][0]; paintType();
        m.body.querySelector('[data-mtype="' + type + '"]').focus();
      });
      m.body.addEventListener('input', (e) => { const f = e.target.closest('.field'); if (f) f.classList.remove('invalid'); });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFieldErrors(form);
        const v = parseMoney(form.amount.value);
        const bad = (input, msg) => { const f = input.closest('.field'); f.classList.add('invalid'); if (msg) f.querySelector('.error').textContent = msg; input.focus(); };
        if (!Number.isFinite(v) || v <= 0) return bad(form.amount, 'Escribe un monto mayor a cero.');
        if (type !== 'income' && v > avail) return bad(form.amount, 'En caja solo hay ' + money(avail) + '.');
        if (form.concept.value.trim().length < 2) return bad(form.concept, 'Escribe el concepto (mínimo 2 letras).');
        const btn = m.foot.querySelector('[type=submit]');
        try {
          await busy(btn, api.post('/cash/movements', { type, amount: r2(v), concept: form.concept.value.trim() }));
          m.close();
          toast.success({ income: 'Ingreso', expense: 'Gasto', withdrawal: 'Retiro' }[type] + ' registrado · ' + money(v));
          bus.emit('cash:changed');
        } catch (err) { showFieldErrors(form, err); }
      });
    }

    // ════════ PAGOS ════════
    let staffList = null;
    async function renderPayments(my, soft) {
      setHeadCharge(can('payments.write'));
      const r = rangeOf(pq.r, pq);
      if (!soft) {
        box.innerHTML = String(html`<div class="pf">
            ${periodHtml(RANGES, pq.r)}
            <div class="pf-custom" ${pq.r === 'otro' ? '' : 'hidden'}>
              <label class="sr" for="pfFrom">Desde</label><input class="input" type="date" id="pfFrom" data-pf="desde" value="${r.from}" max="${today()}"/>
              <span class="faint">a</span>
              <label class="sr" for="pfTo">Hasta</label><input class="input" type="date" id="pfTo" data-pf="hasta" value="${r.to}" max="${today()}"/>
            </div>
            <div class="row wrap between">
              <div class="chips" role="group" aria-label="Forma de pago">
                <button type="button" class="chip" data-pm="" aria-pressed="${String(!pq.m)}">Todos</button>
                ${MKEYS.filter((k) => paymentMethods().includes(k) || pq.m === k).map((k) => html`<button type="button" class="chip" data-pm="${k}" aria-pressed="${String(pq.m === k)}">${raw(icon(METHOD_ICON[k], 'ic-sm'))}${METHOD[k]}</button>`)}
              </div>
              <div class="row wrap">
                <label class="sr" for="pfStaff">Barbero</label>
                <select class="select" id="pfStaff" data-pf="b"><option value="">Todo el equipo</option></select>
                ${can('reports.export') ? html`<button type="button" class="btn btn-secondary btn-sm" data-act="export" style="min-height:40px">${raw(icon('download'))}Exportar CSV</button>` : ''}
              </div>
            </div>
          </div>
          <div id="payRes"></div>`);
        fitPeriod(box);
        (staffList ? Promise.resolve(staffList) : getStaff(true)).then((list) => {
          staffList = list || [];
          const sel = $('#pfStaff', box);
          if (!sel) return;
          sel.insertAdjacentHTML('beforeend', String(html`${staffList.map((s) => html`<option value="${s.id}">${s.name}${s.active === false ? ' (inactivo)' : ''}</option>`)}`));
          sel.value = pq.b;
        }).catch(() => {});
      }
      const res = $('#payRes', box);
      if (!res) return;
      if (!soft) res.innerHTML = String(html`<div class="kpis" style="margin-bottom:16px">${skeletonCards(4, 104)}</div><div class="card">${skeletonRows(6)}</div>`);
      let data;
      try { data = await api.get('/payments', { from: r.from, to: r.to, method: pq.m, staff_id: pq.b, limit: 500 }); }
      catch (err) { if (alive(my)) res.innerHTML = String(html`<div class="card">${errorState(err, 'cashRetry')}</div>`); return; }
      if (!alive(my)) return;
      res.style.opacity = '';
      S.list = data;
      const items = data.items || [], tt = data.totals || {};
      const avg = tt.count ? Math.round(tt.amount / tt.count) : 0;
      const multiDay = r.from !== r.to;
      const mk = moneyIn([tt.total, tt.amount, tt.tip, avg]);
      let rows = [];
      if (multiDay) {
        let lastD = '';
        const dayTot = {};
        for (const p of items) { if (p.status === 'paid') dayTot[p.date] = (dayTot[p.date] || 0) + (Number(p.amount) || 0) + (Number(p.tip) || 0); }
        const m = moneyIn(items.map(payTotal).concat(Object.values(dayTot)));
        for (const p of items) {
          if (p.date !== lastD) { lastD = p.date; rows.push(html`<div class="day-sep"><span>${dateLongCap(p.date)}</span><b>${m(dayTot[p.date] || 0)}</b></div>`); }
          rows.push(payRow(p, { m }));
        }
      } else { const m = moneyIn(items.map(payTotal)); rows = items.map((p) => payRow(p, { m })); }
      res.innerHTML = String(html`
        <div class="kpis stagger" style="margin-bottom:16px">
          <div class="card kpi hl"><span class="label">${raw(icon('wallet'))}Cobrado</span><span class="value">${mk(tt.total || 0)}</span><span class="foot">${rangeLabel(r)}</span></div>
          <div class="card kpi"><span class="label">${raw(icon('receipt'))}Servicios y ventas</span><span class="value">${mk(tt.amount || 0)}</span><span class="foot">Sin propinas</span></div>
          <div class="card kpi"><span class="label">${raw(icon('gift'))}Propinas</span><span class="value">${mk(tt.tip || 0)}</span><span class="foot">100% para los barberos</span></div>
          <div class="card kpi"><span class="label">${raw(icon('hash'))}Cobros</span><span class="value">${number(tt.count || 0)}</span><span class="foot">${tt.count ? 'Ticket promedio ' + money(avg) : 'Sin cobros'}</span></div>
        </div>
        <div class="grid-main-side">
          <section class="card" aria-label="Lista de cobros">
            ${items.length ? html`<div class="list">${rows}</div>${data.total > items.length ? html`<p class="faint" style="font-size:12.5px;padding:10px 16px;border-top:1px solid var(--border)">Mostrando los ${items.length} cobros más recientes de ${number(data.total)}. Exporta el CSV para verlos todos.</p>` : ''}`
              : emptyState({ icon: 'receipt', title: 'Sin cobros en este periodo', text: pq.m || pq.b ? 'Prueba con otro filtro o un rango más amplio.' : 'Cuando cobres una cita o una venta aparecerá aquí.', compact: false, action: pq.m || pq.b ? { label: 'Quitar filtros', id: 'pfClear', icon: 'x' } : null })}
          </section>
          <aside class="stack-lg pay-side">
            <section class="card" aria-labelledby="hPm"><div class="card-head"><h3 id="hPm">Por forma de pago</h3><span class="sub">Sin propinas</span></div>
              <div class="card-body">${methodBars(tt.by_method || {}, { empty: 'Sin ventas en este periodo.' })}</div></section>
            ${tt.refunded_count ? html`<div class="banner warn">${raw(icon('refresh'))}<div class="grow"><b>${plural(tt.refunded_count, 'reembolso')}</b> por ${money(tt.refunded)} en este periodo (no cuentan en los totales).</div></div>` : ''}
          </aside>
        </div>`);
    }

    // ════════ CIERRES ════════
    async function renderSessions(my, soft) {
      setHeadCharge(can('payments.write'));
      const t = today();
      const from = addDays(t, -(Number(sesRange) - 1));
      if (!soft) {
        box.innerHTML = String(html`<div class="toolbar"><div class="seg" role="group" aria-label="Periodo">${[['30', '30 días'], ['90', '90 días'], ['365', '12 meses']].map(([k, l]) => html`<button type="button" data-ses="${k}" aria-pressed="${String(k === sesRange)}">${l}</button>`)}</div></div>
          <div id="sesRes"><div class="kpis" style="margin-bottom:16px">${skeletonCards(4, 104)}</div><div class="card">${skeletonRows(5)}</div></div>`);
      }
      let list;
      try { list = await api.get('/cash/sessions', { from, to: t }); }
      catch (err) { if (alive(my)) $('#sesRes', box).innerHTML = String(html`<div class="card">${errorState(err, 'cashRetry')}</div>`); return; }
      if (!alive(my)) return;
      const closed = list.filter((s) => s.status === 'closed');
      const exact = closed.filter((s) => Math.abs(Number(s.difference) || 0) < 0.005).length;
      const short = r2(closed.reduce((a, s) => a + Math.min(0, Number(s.difference) || 0), 0));
      const over = r2(closed.reduce((a, s) => a + Math.max(0, Number(s.difference) || 0), 0));
      const mk = moneyIn([short, over]);
      const mn = moneyIn(list.flatMap((s) => [s.opening_float, s.expected_cash, s.counted_cash]));
      $('#sesRes', box).innerHTML = String(html`
        <div class="kpis stagger" style="margin-bottom:16px">
          <div class="card kpi"><span class="label">${raw(icon('lock'))}Cortes</span><span class="value">${number(closed.length)}</span><span class="foot">Últimos ${sesRange === '365' ? '12 meses' : sesRange + ' días'}</span></div>
          <div class="card kpi"><span class="label">${raw(icon('check-circle'))}Cuadraron</span><span class="value">${closed.length ? Math.round((exact / closed.length) * 100) + '%' : '—'}</span><span class="foot">${plural(exact, 'corte exacto', 'cortes exactos')}</span></div>
          <div class="card kpi"><span class="label">${raw(icon('arrow-down'))}Faltantes</span><span class="value ${short ? 'err-t' : ''}">${short ? signed(short, mk) : mk(0)}</span><span class="foot">${plural(closed.filter((s) => (Number(s.difference) || 0) < -0.004).length, 'corte')}</span></div>
          <div class="card kpi"><span class="label">${raw(icon('arrow-up'))}Sobrantes</span><span class="value ${over ? 'warn-t' : ''}">${over ? signed(over, mk) : mk(0)}</span><span class="foot">${plural(closed.filter((s) => (Number(s.difference) || 0) > 0.004).length, 'corte')}</span></div>
        </div>
        <section class="card" aria-label="Historial de cortes">
          ${list.length ? html`<div class="list">${list.map((s) => {
            const d = s.status === 'closed' ? Number(s.difference) || 0 : null;
            const [, mm, dd] = s.date.split('-').map(Number);
            return html`<div class="list-item ses-row ${d != null && d < -0.004 ? 'bad' : d != null && d > 0.004 ? 'over' : ''}">
              <div class="ses-date" aria-hidden="true"><b>${String(dd)}</b><span>${MONTHS_SHORT[mm - 1]}</span></div>
              <div class="grow">
                <div class="title">${WEEKDAY_CAP(s.date)}${s.date.slice(0, 4) !== today().slice(0, 4) ? ' · ' + s.date.slice(0, 4) : ''}</div>
                <div class="meta">${clock(s.opened_at)}${s.closed_at ? ' → ' + clock(s.closed_at) + (dayOf(s.closed_at) !== s.date ? ' (' + dateShort(dayOf(s.closed_at)) + ')' : '') : ' · sigue abierta'}${s.opened_by_name ? ' · Abrió ' + s.opened_by_name : ''}${s.closed_by_name && s.closed_by_name !== s.opened_by_name ? ' · Cerró ' + s.closed_by_name : ''}</div>
                <div class="ses-nums"><span>Fondo <b>${mn(s.opening_float)}</b></span>${s.status === 'closed' ? html`<span>Esperado <b>${mn(s.expected_cash)}</b></span><span>Contado <b>${mn(s.counted_cash)}</b></span>` : ''}</div>
                ${s.notes ? html`<div class="ses-note">${s.notes}</div>` : ''}
              </div>
              <div class="trail">${diffBadge(d)}</div>
            </div>`;
          })}</div>`
            : emptyState({ icon: 'lock', title: 'Aún no hay cortes de caja', text: 'Cuando cierres la caja, aquí verás cada corte con lo esperado, lo contado y la diferencia.', action: { label: 'Ir a la caja de hoy', id: 'goToday', icon: 'wallet' } })}
        </section>`);
    }

    // ── Acciones ──
    async function payMenu(btn) {
      const all = []
        .concat(S.list && S.list.items ? S.list.items : [])
        .concat(S.pays && S.pays.items ? S.pays.items : []);
      const p = all.find((x) => x.id === btn.dataset.pid);
      if (!p) return;
      menu(btn, [
        p.appointment_id ? { label: 'Ver la cita', icon: 'calendar', onClick: () => navigate('/agenda', { query: { cita: p.appointment_id } }) } : null,
        p.appointment_id && can('payments.refund') && p.status === 'paid' ? { sep: true } : null,
        can('payments.refund') && p.status === 'paid' ? { label: 'Reembolsar ' + money(p.total), icon: 'refresh', danger: true, onClick: () => refund(p) } : null
      ]);
    }
    async function refund(p) {
      const who = p.client_name ? ' de ' + p.client_name : '';
      const ok = await confirmDialog({
        danger: true, icon: 'refresh', title: '¿Reembolsar ' + money(p.total) + '?', confirmText: 'Sí, reembolsar',
        message: 'El cobro' + who + (p.concept ? ' (' + p.concept + ')' : '') + ' quedará como devuelto y dejará de contar en ventas y comisiones. ' +
          (p.method === 'cash' ? 'Si el efectivo ya no está en la caja abierta, se registrará como gasto para que el corte cuadre.' : 'Recuerda devolver el dinero por ' + (METHOD[p.method] || '').toLowerCase() + '.') + ' No se puede deshacer.'
      });
      if (!ok) return;
      try {
        await api.post('/payments/' + encodeURIComponent(p.id) + '/refund', {});
        toast.success('Cobro reembolsado · ' + money(p.total));
        bus.emit('payments:changed');
        bus.emit('appointments:changed', { id: p.appointment_id || null });
        if (p.method === 'cash') bus.emit('cash:changed');
      } catch (err) { toast.error(err); }
    }
    async function exportCsv(btn) {
      const r = rangeOf(pq.r, pq);
      try {
        const f = await busy(btn, api.raw('/reports/export', { type: 'payments', from: r.from, to: r.to }));
        saveFile(f.filename, '﻿' + f.body, 'text/csv;charset=utf-8');
        toast.success('Descargando ' + f.filename);
      } catch (err) { toast.error(err); }
    }

    const offs = [];
    offs.push(wirePeriod(el, { describe: (k) => (k === 'otro' ? (pq.r === 'otro' ? rangeLabel(rangeOf('otro', pq)) : 'Elige desde y hasta qué día') : rangeLabel(rangeOf(k, pq))) }));
    offs.push(on(el, 'click', '[data-tab]', (e, b) => { if (b.dataset.tab === tab) return; tab = b.dataset.tab; show(); }));
    offs.push(on(el, 'keydown', '[role=tab]', (e, b) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const i = TABS.findIndex((x) => x[0] === b.dataset.tab), n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0];
      const nb = el.querySelector('[role=tab][data-tab="' + n + '"]'); nb.focus(); nb.click();
    }));
    offs.push(on(el, 'click', '[data-act="charge"],#emptyCharge', () => openPaymentSheet({})));
    offs.push(on(el, 'click', '[data-act="movement"]', openMovement));
    offs.push(on(el, 'click', '[data-act="close-cash"]', openClose));
    offs.push(on(el, 'click', '[data-act="pay-menu"]', (e, b) => payMenu(b)));
    offs.push(on(el, 'click', '[data-act="export"]', (e, b) => exportCsv(b)));
    offs.push(on(el, 'click', '#cashRetry', () => show()));
    offs.push(on(el, 'click', '#goToday', () => { tab = 'hoy'; show(); }));
    offs.push(on(el, 'click', '[data-range]', (e, b) => {
      pq.r = b.dataset.range;
      $$('[data-range]', el).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      const c = $('.pf-custom', el); if (c) c.hidden = pq.r !== 'otro';
      if (pq.r === 'otro') { const r = rangeOf('otro', pq); pq.desde = r.from; pq.hasta = r.to; const a = $('#pfFrom', el), z = $('#pfTo', el); if (a) a.value = r.from; if (z) z.value = r.to; }
      show(true); syncQuery();
      const res = $('#payRes', box); if (res) res.style.opacity = '.55';
    }));
    offs.push(on(el, 'change', '[data-pf]', (e, i) => {
      pq[i.dataset.pf] = i.value;
      if (i.dataset.pf !== 'b' && !i.value) return;
      const res = $('#payRes', box); if (res) res.style.opacity = '.55';
      show(true);
    }));
    offs.push(on(el, 'click', '[data-pm]', (e, b) => {
      pq.m = b.dataset.pm;
      $$('[data-pm]', el).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      const res = $('#payRes', box); if (res) res.style.opacity = '.55';
      show(true);
    }));
    offs.push(on(el, 'click', '#pfClear', () => { pq.m = ''; pq.b = ''; show(); }));
    offs.push(on(el, 'click', '[data-ses]', (e, b) => { sesRange = b.dataset.ses; $$('[data-ses]', el).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); show(true); }));

    let rT = null;
    const refresh = () => { clearTimeout(rT); rT = setTimeout(() => show(true), 120); };
    offs.push(bus.on('payments:changed', refresh));
    offs.push(bus.on('cash:changed', refresh));

    show();
    return () => { clearTimeout(rT); offs.forEach((f) => f()); };
  }
};
