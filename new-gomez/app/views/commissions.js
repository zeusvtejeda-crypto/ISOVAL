// #/comisiones — Dueño: comisión, propinas, pagado y saldo por barbero en un periodo (quincena, mes o
// personalizado), "Registrar pago" y el historial de pagos. Barbero: "Mis ganancias" (solo lo suyo).
import { html, raw, on, $, $$ } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { bus, can, today, role } from '../lib/state.js';
import { setQuery } from '../lib/router.js';
import { toast, modal, busy, avatar, emptyState, errorState, skeletonCards, skeletonRows, showFieldErrors, clearFieldErrors, saveFile } from '../lib/ui.js';
import { money, moneyIn, number, pct, plural, startOfMonth, endOfMonth, addMonths, MONTHS_SHORT, ago, firstName } from '../lib/fmt.js';
import { periodHtml, wirePeriod } from '../lib/period.js';
import { parseMoney, tweenMoney, injectPayStyle } from '../lib/payment-sheet.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const RANGES = [['q', 'Esta quincena'], ['q_ant', 'Quincena pasada'], ['mes', 'Este mes'], ['mes_ant', 'Mes pasado'], ['otro', 'Personalizado']];
const isKey = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');

function quincena(t, prev) {
  let first = Number(t.slice(8, 10)) <= 15;
  let month = startOfMonth(t);
  if (prev) { if (first) { month = addMonths(t, -1); first = false; } else first = true; }
  return first ? { from: month, to: month.slice(0, 8) + '15' } : { from: month.slice(0, 8) + '16', to: endOfMonth(month) };
}
function rangeOf(key, q) {
  const t = today();
  if (key === 'q_ant') return quincena(t, true);
  if (key === 'mes') return { from: startOfMonth(t), to: endOfMonth(t) };
  if (key === 'mes_ant') { const s = addMonths(t, -1); return { from: s, to: endOfMonth(s) }; }
  if (key === 'otro') {
    const from = isKey(q.desde) ? q.desde : startOfMonth(t);
    let to = isKey(q.hasta) ? q.hasta : t;
    if (to < from) to = from;
    return { from, to };
  }
  return quincena(t, false);
}
function rangeLabel(r) {
  const [y1, m1, d1] = r.from.split('-').map(Number), [y2, m2, d2] = r.to.split('-').map(Number);
  if (r.from === r.to) return d1 + ' ' + MONTHS_SHORT[m1 - 1] + ' ' + y1;
  if (y1 === y2 && m1 === m2) return d1 + '–' + d2 + ' ' + MONTHS_SHORT[m1 - 1] + ' ' + y1;
  return d1 + ' ' + MONTHS_SHORT[m1 - 1] + (y1 !== y2 ? ' ' + y1 : '') + ' – ' + d2 + ' ' + MONTHS_SHORT[m2 - 1] + ' ' + y2;
}
const pctTxt = (p) => pct(Number(p) || 0); // '38.3%', como el resto del panel (fmt.pct)

const CSS = `
.v-comm .stack,.v-comm .stack-lg,.v-comm .list,.cm-range{grid-template-columns:minmax(0,1fr)}
.cm-range{display:grid;gap:10px;margin-bottom:18px}
.cm-range .row{gap:8px}
.cm-range .lbl{font-size:13px;color:var(--text-2);display:inline-flex;align-items:center;gap:6px}
.cm-range .input{width:auto;min-height:40px}
.cm-grid{display:grid;gap:14px;grid-template-columns:minmax(0,1fr)}
@media (min-width:720px){.cm-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (min-width:1280px){.cm-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.cm-card{display:flex;flex-direction:column;overflow:hidden}
.cm-top{display:flex;align-items:center;gap:12px;padding:16px 16px 0}
.cm-top .nm{font-weight:700;font-size:15.5px}
.cm-top .rl{font-size:12.5px;color:var(--text-3)}
.cm-pct{margin-left:auto;display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:999px;background:var(--surface-3);font-size:12.5px;font-weight:700;color:var(--text-2);font-variant-numeric:tabular-nums;white-space:nowrap}
.cm-due{margin:14px 16px 0;padding:14px;border-radius:var(--r);background:var(--brand-softer);border:1px solid rgba(196,154,60,.28);display:grid;gap:2px}
.cm-due .eyebrow{color:var(--brand-strong)}
.cm-due b{font-family:var(--disp);font-size:36px;font-weight:800;line-height:1.05;font-variant-numeric:tabular-nums}
.cm-due.zero{background:var(--ok-soft);border-color:transparent}
.cm-due.zero .eyebrow{color:var(--ok)}
.cm-due.neg{background:var(--warn-soft);border-color:transparent}.cm-due.neg .eyebrow{color:var(--warn)}
.cm-due .progress-bar{margin-top:8px;height:5px}
.cm-due .progress-bar>span{background:var(--ok)}
.cm-due small{font-size:12px;color:var(--text-3);margin-top:4px}
.cm-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;margin:10px 16px 0}
.cm-stats div{display:grid;gap:1px;padding:9px 0;border-bottom:1px solid var(--border)}
.cm-stats div:nth-last-child(-n+2){border-bottom:0}
.cm-stats span{font-size:12px;color:var(--text-3)}
.cm-stats b{font-size:15px;font-variant-numeric:tabular-nums}
.cm-foot{margin-top:auto;padding:12px 16px 16px}
.cm-foot .btn{width:100%}
.cm-card.inactive{opacity:.8}
.cm-hero{position:relative;overflow:hidden;background:var(--ink);color:var(--on-ink);border-radius:var(--r-xl);padding:22px 20px;box-shadow:var(--shadow-2);border:1px solid rgba(242,237,227,.07)}
.cm-hero::before{content:"";position:absolute;left:-120px;bottom:-190px;width:420px;height:420px;background:radial-gradient(circle,rgba(217,178,90,.22),transparent 62%);pointer-events:none}
.cm-hero>*{position:relative}
.cm-hero .who{display:flex;align-items:center;gap:12px;color:#BDB5A5;font-size:13px}
.cm-hero .who b{color:#F2EDE3;font-size:15px;display:block}
.cm-hero .lab{margin-top:18px;font-size:13px;color:#BDB5A5}
.cm-hero .big{font-family:var(--disp);font-size:60px;font-weight:800;line-height:1;color:#F7F2E8;font-variant-numeric:tabular-nums;margin-top:4px}
.cm-hero .eq{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:12px;font-size:12.5px;color:#9E968A}
.cm-hero .eq b{color:#E4DED2;font-weight:600;font-variant-numeric:tabular-nums}
@media (min-width:720px){.cm-hero{padding:26px 28px}.cm-hero .big{font-size:76px}}
.po-row .amt{font-weight:700;font-variant-numeric:tabular-nums;font-size:15px}
.po-row .note{font-size:12.5px;color:var(--text-3);font-style:italic}
.po-sum{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:12px;border-radius:var(--r);background:var(--surface-2);border:1px solid var(--border);text-align:center}
.po-sum div{display:grid;gap:1px;min-width:0}
.po-sum span{font-size:10.5px;color:var(--text-3);font-weight:700;letter-spacing:.05em;text-transform:uppercase}
.po-sum b{font-size:14.5px;font-variant-numeric:tabular-nums}
.po-sum .due b{color:var(--brand-strong)}
.cm-how{font-size:13.5px;color:var(--text-2);display:grid;gap:8px}
.cm-how div{display:flex;gap:10px;align-items:flex-start}
.cm-how .ic{color:var(--brand-strong);margin-top:1px;width:18px;height:18px}
`;
function injectStyle() { injectPayStyle(); if (!document.getElementById('st-comm')) document.head.insertAdjacentHTML('beforeend', '<style id="st-comm">' + CSS + '</style>'); }

export default {
  title: () => (role() === 'barber' ? 'Mis ganancias' : 'Comisiones'),
  async render(el, { query }) {
    injectStyle();
    el.classList.add('v-comm');
    const owner = can('commissions.read.all');
    const q = { r: RANGES.some((x) => x[0] === query.r) ? query.r : 'q', desde: query.desde || '', hasta: query.hasta || '' };
    let poFilter = '';
    let data = null, payouts = null, seq = 0;

    el.innerHTML = String(html`
      <div class="page-head">
        <div><h2>${owner ? 'Comisiones' : 'Mis ganancias'}</h2><p>${owner ? 'Lo que genera cada barbero, su comisión, propinas y lo que falta pagarle.' : 'Tu comisión y tus propinas del periodo, y lo que ya te pagaron.'}</p></div>
        <div class="actions">${owner && can('reports.export') ? html`<button type="button" class="btn btn-secondary" data-act="export">${raw(icon('download'))}Exportar CSV</button>` : ''}</div>
      </div>
      <div class="cm-range">
        ${periodHtml(RANGES, q.r)}
        <div class="row wrap">
          <span class="lbl" id="cmLabel">${raw(icon('calendar', 'ic-sm'))}<span></span></span>
          <span class="row wrap" id="cmCustom" ${q.r === 'otro' ? '' : 'hidden'}>
            <label class="sr" for="cmFrom">Desde</label><input class="input" type="date" id="cmFrom" data-d="desde"/>
            <span class="faint">a</span>
            <label class="sr" for="cmTo">Hasta</label><input class="input" type="date" id="cmTo" data-d="hasta"/>
          </span>
        </div>
      </div>
      <div id="cmBody"></div>
      <section class="section" aria-labelledby="poT">
        <div class="section-title"><span id="poT">${owner ? 'Historial de pagos' : 'Mis pagos recibidos'}</span><span id="poChips"></span></div>
        <div id="poBody"></div>
      </section>`);
    const body = $('#cmBody', el), poBody = $('#poBody', el);
    const range = () => rangeOf(q.r, q);
    const paintRange = () => {
      const r = range();
      $('#cmLabel span', el).textContent = rangeLabel(r);
      const a = $('#cmFrom', el), z = $('#cmTo', el);
      a.value = r.from; z.value = r.to;
      $('#cmCustom', el).hidden = q.r !== 'otro';
      setQuery(Object.assign({}, q.r !== 'q' ? { r: q.r } : {}, q.r === 'otro' ? { desde: r.from, hasta: r.to } : {}));
    };

    async function load(soft) {
      const my = ++seq;
      paintRange();
      const r = range();
      if (!soft) body.innerHTML = owner
        ? String(html`<div class="kpis" style="margin-bottom:18px">${skeletonCards(4, 104)}</div><div class="cm-grid">${skeletonCards(3, 330)}</div>`)
        : String(html`<div class="card skel" style="height:220px;border:0;border-radius:var(--r-xl);margin-bottom:16px"></div><div class="kpis">${skeletonCards(4, 104)}</div>`);
      else body.style.opacity = '.55';
      try {
        const d = await api.get('/commissions', { from: r.from, to: r.to });
        if (my !== seq) return;
        data = d;
        body.style.opacity = '';
        body.innerHTML = String(owner ? ownerHtml(d, r) : barberHtml(d, r));
        const big = $('#cmBig', body);
        if (big) { big.dataset.v = '0'; tweenMoney(big, (d.items[0] && d.items[0].balance) || 0); }
      } catch (err) {
        if (my !== seq) return;
        body.style.opacity = '';
        body.innerHTML = String(html`<div class="card">${errorState(err, 'cmRetry')}</div>`);
      }
    }
    async function loadPayouts() {
      poBody.innerHTML = String(html`<div class="card">${skeletonRows(3)}</div>`);
      try {
        payouts = await api.get('/commissions/payouts', { limit: 100 });
        paintPayouts();
      } catch (err) { poBody.innerHTML = String(html`<div class="card">${errorState(err, 'poRetry')}</div>`); }
    }

    // ── Dueño ──
    function ownerHtml(d, r) {
      const t = d.totals || {};
      const items = d.items || [];
      if (!items.length) return emptyState({ icon: 'users', title: 'Aún no hay barberos', text: 'Agrega a tu equipo con su porcentaje de comisión y aquí verás lo que le toca a cada uno.', action: can('staff.manage') ? { label: 'Ir a Equipo', href: '#/equipo', icon: 'scissors' } : null });
      const sorted = items.slice().sort((a, b) => (b.balance - a.balance) || (b.revenue - a.revenue));
      // Centavos en todas las cifras del grupo o en ninguna ('$4,170.00' junto a '$2,709.50').
      const mk = moneyIn([t.revenue, t.commission, t.tips, t.balance]);
      const mc = moneyIn(items.flatMap((it) => [it.balance, it.revenue, it.commission, it.tips, it.payouts]));
      return html`
        <div class="kpis stagger" style="margin-bottom:18px">
          <div class="card kpi"><span class="label">${raw(icon('chart'))}Ingresos generados</span><span class="value">${mk(t.revenue)}</span><span class="foot">${plural(t.services_count || 0, 'servicio')}</span></div>
          <div class="card kpi"><span class="label">${raw(icon('percent'))}Comisiones</span><span class="value">${mk(t.commission)}</span><span class="foot">${t.revenue ? pctTxt((t.commission / t.revenue) * 100) + ' de los ingresos' : 'Sin ingresos'}</span></div>
          <div class="card kpi"><span class="label">${raw(icon('gift'))}Propinas</span><span class="value">${mk(t.tips)}</span><span class="foot">100% para cada barbero</span></div>
          <div class="card kpi hl" style="background:linear-gradient(180deg,var(--brand-soft),var(--surface))"><span class="label">${raw(icon('wallet'))}Por pagar</span><span class="value ${t.balance > 0 ? 'brand-t' : ''}">${mk(t.balance)}</span><span class="foot">${t.payouts ? 'Ya pagaste ' + money(t.payouts) : 'Aún no registras pagos'}</span></div>
        </div>
        <div class="cm-grid stagger">${sorted.map((it) => cardHtml(it, mc))}</div>`;
    }
    function cardHtml(it, m) {
      m = m || money;
      const owed = r2(it.commission + it.tips);
      const paidPct = owed > 0 ? Math.min(100, Math.round((it.payouts / owed) * 100)) : (it.payouts ? 100 : 0);
      const cls = it.balance > 0.004 ? '' : it.balance < -0.004 ? 'neg' : 'zero';
      return html`<article class="card cm-card ${it.active ? '' : 'inactive'}" aria-label="${it.staff_name}">
        <div class="cm-top">${avatar(it.staff_name, { color: it.color || undefined, size: 'lg' })}
          <div style="min-width:0"><div class="nm truncate">${it.staff_name}</div><div class="rl">${it.role === 'owner' ? 'Dueño' : 'Barbero'}${it.active ? '' : ' · inactivo'}</div></div>
          <span class="cm-pct" title="Porcentaje de comisión">${pctTxt(it.commission_pct)}</span></div>
        <div class="cm-due ${cls}">
          <span class="eyebrow">${cls === 'zero' ? 'Al corriente' : cls === 'neg' ? 'Pagado de más' : 'Saldo por pagar'}</span>
          <b>${m(Math.abs(it.balance))}</b>
          ${it.payouts ? html`<div class="progress-bar" role="progressbar" aria-label="Pagado" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${String(paidPct)}"><span style="width:${String(paidPct)}%"></span></div>` : ''}
          <small>${it.payouts ? 'Ya le pagaste ' + m(it.payouts) + ' de ' + m(owed) : owed ? 'Aún sin pagos en este periodo' : 'Sin movimientos en este periodo'}</small>
        </div>
        <div class="cm-stats">
          <div><span>Servicios</span><b>${number(it.services_count)}</b></div>
          <div><span>Ingresos generados</span><b>${m(it.revenue)}</b></div>
          <div><span>Comisión (${pctTxt(it.commission_pct)})</span><b>${m(it.commission)}</b></div>
          <div><span>Propinas</span><b>${m(it.tips)}</b></div>
        </div>
        ${can('commissions.payout') ? html`<div class="cm-foot"><button type="button" class="btn ${it.balance > 0.004 ? 'btn-primary' : 'btn-secondary'}" data-payout="${it.staff_id}">${raw(icon('wallet'))}Registrar pago${it.balance > 0.004 ? ' · ' + m(it.balance) : ''}</button></div>` : html`<div style="height:16px"></div>`}
      </article>`;
    }

    // ── Barbero ──
    function barberHtml(d, r) {
      const it = (d.items || [])[0];
      if (!it) return emptyState({ icon: 'percent', title: 'Sin datos de comisión', text: 'Pide al dueño que configure tu porcentaje de comisión.' });
      const owed = r2(it.commission + it.tips);
      const m = moneyIn([it.balance, it.commission, it.tips, it.payouts, it.revenue, owed]);
      return html`
        <section class="cm-hero fade-up" aria-labelledby="cmHl">
          <div class="who">${avatar(it.staff_name, { color: it.color || undefined, size: 'lg' })}<div><b>${firstName(it.staff_name)}</b>${rangeLabel(r)} · comisión ${pctTxt(it.commission_pct)}</div></div>
          <div class="lab" id="cmHl">${it.balance < -0.004 ? 'Te pagaron de más' : 'Te falta por cobrar'}</div>
          <div class="big" id="cmBig" aria-live="polite">${m(it.balance)}</div>
          <div class="eq"><span>Comisión <b>${m(it.commission)}</b></span><span>+ Propinas <b>${m(it.tips)}</b></span><span>− Ya te pagaron <b>${m(it.payouts)}</b></span></div>
        </section>
        <div class="kpis stagger" style="margin-top:16px">
          <div class="card kpi"><span class="label">${raw(icon('scissors'))}Servicios realizados</span><span class="value">${number(it.services_count)}</span><span class="foot">Citas atendidas</span></div>
          <div class="card kpi"><span class="label">${raw(icon('chart'))}Ingresos generados</span><span class="value">${m(it.revenue)}</span><span class="foot">Cobrado a tus clientes</span></div>
          <div class="card kpi"><span class="label">${raw(icon('percent'))}Tu comisión</span><span class="value">${m(it.commission)}</span><span class="foot">${pctTxt(it.commission_pct)} de tus ingresos</span></div>
          <div class="card kpi"><span class="label">${raw(icon('gift'))}Propinas</span><span class="value">${m(it.tips)}</span><span class="foot">${owed ? 'Total ganado ' + m(owed) : 'Todas son para ti'}</span></div>
        </div>
        <section class="card card-pad" style="margin-top:16px">
          <div class="section-title" style="margin-bottom:8px">¿Cómo se calcula?</div>
          <div class="cm-how">
            <div>${raw(icon('check-circle'))}<span>Tu comisión es el ${pctTxt(it.commission_pct)} de lo que se cobró por tus servicios (sin propinas).</span></div>
            <div>${raw(icon('gift'))}<span>Las propinas son 100% tuyas y se suman a tu saldo.</span></div>
            <div>${raw(icon('wallet'))}<span>Cuando el dueño registra un pago, se descuenta del periodo que liquida.</span></div>
          </div>
        </section>`;
    }

    function paintPayouts() {
      const list = payouts || [];
      const names = [];
      for (const p of list) if (!names.some((n) => n.id === p.staff_id)) names.push({ id: p.staff_id, name: p.staff_name });
      const chips = $('#poChips', el);
      chips.innerHTML = owner && names.length > 1 ? String(html`<span class="chips" role="group" aria-label="Filtrar por barbero"><button type="button" class="chip" data-po="" aria-pressed="${String(!poFilter)}">Todos</button>${names.map((n) => html`<button type="button" class="chip" data-po="${n.id}" aria-pressed="${String(poFilter === n.id)}">${firstName(n.name)}</button>`)}</span>`) : '';
      const rows = poFilter ? list.filter((p) => p.staff_id === poFilter) : list;
      if (!rows.length) {
        poBody.innerHTML = '<div class="card">' + String(emptyState({ icon: 'receipt', compact: true, title: owner ? 'Aún no registras pagos de comisión' : 'Aún no tienes pagos registrados', text: owner ? 'Cuando le pagues a un barbero, regístralo desde su tarjeta y su saldo se actualiza.' : 'Cuando el dueño te pague, lo verás aquí con su periodo.' })) + '</div>';
        return;
      }
      const m = moneyIn(rows.map((p) => p.amount));
      poBody.innerHTML = String(html`<div class="card"><div class="list">${rows.map((p) => html`<div class="list-item po-row">
        ${owner ? avatar(p.staff_name, { size: 'sm' }) : raw('<span class="avatar sm" style="--c:var(--ok)">' + icon('check', 'ic-sm') + '</span>')}
        <div class="grow"><div class="title truncate">${owner ? p.staff_name : 'Pago recibido'}</div>
          <div class="meta">Periodo ${rangeLabel({ from: p.period_from, to: p.period_to })} · ${ago(p.created_at)}</div>
          ${p.note ? html`<div class="note truncate">${p.note}</div>` : ''}</div>
        <div class="trail"><span class="amt">${m(p.amount)}</span></div>
      </div>`)}</div></div>`);
    }

    // ── Registrar pago ──
    async function openPayout(staffId) {
      const it = data && data.items.find((x) => x.staff_id === staffId);
      if (!it) return;
      const r = range();
      const t = today();
      const pFrom = r.from > t ? t : r.from;
      let cashOpen = null;
      const ms = moneyIn([it.commission, it.tips, it.payouts, it.balance]);
      const m = modal({
        title: 'Registrar pago', subtitle: 'A ' + it.staff_name + ' · ' + rangeLabel(r),
        body: String(html`<form id="poF" class="pay-form" novalidate>
          <div class="po-sum">
            <div><span>Comisión</span><b>${ms(it.commission)}</b></div>
            <div><span>Propinas</span><b>${ms(it.tips)}</b></div>
            <div><span>Pagado</span><b>${ms(it.payouts)}</b></div>
            <div class="due"><span>Saldo</span><b>${ms(it.balance)}</b></div>
          </div>
          <div class="field"><label for="poAmt">Monto a pagar</label>
            <div class="money-in xl"><span>$</span><input class="input" id="poAmt" name="amount" inputmode="decimal" autocomplete="off" placeholder="0" value="${it.balance > 0 ? String(r2(it.balance)) : ''}"/></div>
            <p class="hint" id="poHint">${it.balance > 0 ? 'Sugerido: el saldo completo del periodo.' : 'Este barbero no tiene saldo pendiente en el periodo.'}</p>
            <p class="error">Escribe el monto.</p></div>
          <div class="form-grid cols-2">
            <div class="field"><label for="poFrom">Periodo: desde</label><input class="input" type="date" id="poFrom" name="period_from" value="${pFrom}" max="${t}"/><p class="error"></p></div>
            <div class="field"><label for="poTo">Hasta</label><input class="input" type="date" id="poTo" name="period_to" value="${r.to}"/><p class="error"></p></div>
          </div>
          <div class="field"><label for="poNote">Nota <span class="opt">(opcional)</span></label>
            <input class="input" id="poNote" name="note" maxlength="200" placeholder="Ej. Pago de quincena en efectivo"/>
            <div class="chips" style="margin-top:4px">${['Pago de quincena', 'Pago de mes', 'Adelanto'].map((c) => html`<button type="button" class="chip" data-note="${c}">${c}</button>`)}</div>
            <p class="error"></p></div>
          ${can('cash.manage') ? html`<label class="switch pay-opt"><span class="grow"><b>Pagar con efectivo de la caja</b><small id="poCashHint">Se registra como retiro en la caja abierta.</small></span>
            <input type="checkbox" name="from_cash"/><span class="track"></span></label>` : ''}
        </form>`),
        actions: [
          { label: 'Cancelar', variant: 'secondary' },
          { label: 'Registrar pago', variant: 'primary', type: 'submit', form: 'poF', icon: 'check', close: false }
        ]
      });
      const form = $('#poF', m.body);
      if (form.from_cash && can('cash.read')) {
        api.get('/cash/current').then((d) => {
          cashOpen = !!(d && d.session);
          const h = $('#poCashHint', m.body);
          if (!cashOpen) { form.from_cash.disabled = true; if (h) h.textContent = 'La caja está cerrada: ábrela para pagar desde el efectivo.'; }
          else if (h) h.textContent = 'Se registra como retiro. Hay ' + money(d.summary.expected_cash) + ' en caja.';
        }).catch(() => {});
      }
      m.body.addEventListener('click', (e) => { const c = e.target.closest('[data-note]'); if (c) { form.note.value = c.dataset.note; form.note.focus(); } });
      m.body.addEventListener('input', (e) => { const f = e.target.closest('.field'); if (f) f.classList.remove('invalid'); });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFieldErrors(form);
        const v = parseMoney(form.amount.value);
        const bad = (input, msg) => { const f = input.closest('.field'); f.classList.add('invalid'); if (msg) f.querySelector('.error').textContent = msg; input.focus(); };
        if (!Number.isFinite(v) || v <= 0) return bad(form.amount, 'Escribe un monto mayor a cero.');
        if (!isKey(form.period_from.value)) return bad(form.period_from, 'Elige el inicio del periodo.');
        if (!isKey(form.period_to.value)) return bad(form.period_to, 'Elige el fin del periodo.');
        if (form.period_to.value < form.period_from.value) return bad(form.period_to, 'Debe ser igual o posterior al inicio.');
        const fromCash = !!(form.from_cash && form.from_cash.checked && !form.from_cash.disabled);
        const btn = m.foot.querySelector('[type=submit]');
        try {
          await busy(btn, api.post('/commissions/payouts', { staff_id: it.staff_id, amount: r2(v), period_from: form.period_from.value, period_to: form.period_to.value, note: form.note.value.trim() || undefined, from_cash: fromCash || undefined }));
          m.close();
          toast.success('Pago registrado a ' + firstName(it.staff_name) + ' · ' + money(v));
          bus.emit('commissions:changed');
          if (fromCash) bus.emit('cash:changed');
          load(true); loadPayouts();
        } catch (err) { showFieldErrors(form, err); }
      });
    }

    async function exportCsv(btn) {
      const r = range();
      try {
        const f = await busy(btn, api.raw('/reports/export', { type: 'commissions', from: r.from, to: r.to }));
        saveFile(f.filename, '﻿' + f.body, 'text/csv;charset=utf-8');
        toast.success('Descargando ' + f.filename);
      } catch (err) { toast.error(err); }
    }

    const offs = [];
    offs.push(wirePeriod(el, { describe: (k) => (k === 'otro' ? (q.r === 'otro' ? rangeLabel(range()) : 'Elige desde y hasta qué día') : rangeLabel(rangeOf(k, q))) }));
    offs.push(on(el, 'click', '[data-range]', (e, b) => {
      if (q.r === b.dataset.range && q.r !== 'otro') return;
      q.r = b.dataset.range;
      $$('[data-range]', el).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      if (q.r === 'otro' && !q.desde) { const r = rangeOf('q', q); q.desde = r.from; q.hasta = today() < r.to ? today() : r.to; }
      load(true);
    }));
    offs.push(on(el, 'change', '[data-d]', (e, i) => { if (!isKey(i.value)) return; q[i.dataset.d] = i.value; load(true); }));
    offs.push(on(el, 'click', '[data-payout]', (e, b) => openPayout(b.dataset.payout)));
    offs.push(on(el, 'click', '[data-po]', (e, b) => { poFilter = b.dataset.po; paintPayouts(); }));
    offs.push(on(el, 'click', '#cmRetry', () => load()));
    offs.push(on(el, 'click', '#poRetry', loadPayouts));
    offs.push(on(el, 'click', '[data-act="export"]', (e, b) => exportCsv(b)));
    const refresh = () => { load(true); loadPayouts(); };
    offs.push(bus.on('payments:changed', refresh));

    load();
    loadPayouts();
    return () => offs.forEach((f) => f());
  }
};
