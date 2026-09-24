// Hoja de cobro (cita o venta suelta) y diálogo "Abrir caja". Contratos:
//   openPaymentSheet({ appointment?, client?, onDone? }) → Promise<payment|null>
//     appointment: vista Appointment (id, total, paid, balance, services, status, client_name…) o { id } (se carga).
//     client: { id, name } para ligar una venta suelta a un cliente.
//     onDone(payment): se llama en cuanto el cobro queda registrado (antes de cerrar la hoja).
//     Emite bus 'payments:changed' y 'appointments:changed' (y 'cash:changed' si fue en efectivo).
//   openCashDialog({ lastSession? }) → Promise<{ session, summary, … }|null>   (POST /api/cash/open)
//   parseMoney('1,250.50') → 1250.5 | NaN · METHOD_ICON · paymentMethods()
import { html, raw, esc, $, $$ } from './html.js';
import { icon } from './icons.js';
import { api } from './api.js';
import { bus, can, shop, today, nowMin, getStaff } from './state.js';
import { toast, modal, busy, showFieldErrors, clearFieldErrors } from './ui.js';
import { money, METHOD, time, relDay } from './fmt.js';
import { sendWhatsApp } from './whatsapp.js';

export const METHOD_ICON = { cash: 'cash', card: 'card', transfer: 'transfer', other: 'receipt' };
const TIP_PCTS = [10, 15, 20];

export function paymentMethods() {
  const s = shop();
  const list = s && s.settings && s.settings.payments && s.settings.payments.methods;
  const out = (Array.isArray(list) ? list : ['cash', 'card', 'transfer']).filter((m) => METHOD[m]);
  return out.length ? out : ['cash'];
}
const tipsEnabled = () => { const s = shop(); return !(s && s.settings && s.settings.payments && s.settings.payments.tips === false); };

// Monto escrito a mano: '250', '$1,250.50', '250,5' → número (NaN si no es válido).
export function parseMoney(v) {
  if (typeof v === 'number') return v;
  let s = String(v == null ? '' : v).trim().replace(/^\$\s*/, '').replace(/\s+/g, '');
  if (!s) return NaN;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  return /^(\d+(\.\d*)?|\.\d+)$/.test(s) ? Number(s) : NaN;
}
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Número que se desliza del valor actual al nuevo (enteros mientras se mueve, exacto al final).
export function tweenMoney(el, to) {
  if (!el) return;
  const from = Number(el.dataset.v || 0);
  el.dataset.v = String(to);
  cancelAnimationFrame(el._raf);
  if (reduced() || from === to) { el.textContent = money(to); return; }
  const t0 = performance.now(), dur = 420;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = p < 1 ? money(Math.round(from + (to - from) * e)) : money(to);
    if (p < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

const CSS = `
.pay-sum{background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-lg);padding:14px 16px;margin-bottom:18px}
.pay-sum .who{display:flex;align-items:center;gap:10px;margin-bottom:10px;min-width:0}
.pay-sum .who b{font-size:15px}
.pay-sum .who .meta{font-size:12.5px;color:var(--text-2)}
.pay-sum .svc{display:flex;justify-content:space-between;gap:12px;font-size:14px;padding:3px 0;color:var(--text-2)}
.pay-sum .svc span:last-child{font-variant-numeric:tabular-nums;color:var(--text)}
.pay-sum .tot{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;border-top:1px dashed var(--border-strong);margin-top:10px;padding-top:10px}
.pay-sum .tot div{display:grid;gap:1px;min-width:0}
.pay-sum .tot span{font-size:11px;color:var(--text-3);font-weight:600;letter-spacing:.06em;text-transform:uppercase}
.pay-sum .tot b{font-size:16px;font-variant-numeric:tabular-nums}
.pay-sum .tot .due b{color:var(--brand-strong)}
.pay-sum .tot .paid b{color:var(--ok)}
.money-in{position:relative}
.money-in>span{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--text-3);font-weight:600;pointer-events:none}
.money-in .input{padding-left:28px;font-variant-numeric:tabular-nums}
.money-in.xl>span{font-family:var(--disp);font-size:28px;font-weight:800;left:16px}
.money-in.xl .input{min-height:66px;font-family:var(--disp);font-size:38px;font-weight:800;padding-left:40px;letter-spacing:.01em;line-height:1}
.pay-form{display:grid;gap:18px;grid-template-columns:minmax(0,1fr)}
.pay-form>*,.stack>*{min-width:0}
#cashOpenF,#closeF{grid-template-columns:minmax(0,1fr)}
.pay-form .field>.label,.pay-form .field>label{font-size:13px}
.pay-tips{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
.pay-tips button{min-height:54px;border-radius:12px;border:1px solid var(--border-strong);background:var(--surface);display:grid;align-content:center;justify-items:center;gap:1px;font-weight:600;font-size:14px;color:var(--text);transition:background .15s,border-color .15s,color .15s,transform .12s var(--ease);padding:0 2px}
.pay-tips button:active{transform:scale(.96)}
.pay-tips button small{font-size:11.5px;font-weight:500;color:var(--text-3);font-variant-numeric:tabular-nums;white-space:nowrap}
.pay-tips button[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:var(--on-ink)}
.pay-tips button[aria-pressed="true"] small{color:rgba(242,237,227,.72)}
:root[data-theme="dark"] .pay-tips button[aria-pressed="true"]{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
:root[data-theme="dark"] .pay-tips button[aria-pressed="true"] small{color:rgba(21,19,15,.7)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .pay-tips button[aria-pressed="true"]{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}:root:not([data-theme="light"]) .pay-tips button[aria-pressed="true"] small{color:rgba(21,19,15,.7)}}
.pay-methods{display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr));gap:8px}
.pay-methods button{min-height:66px;border-radius:14px;border:1.5px solid var(--border-strong);background:var(--surface);display:grid;justify-items:center;align-content:center;gap:5px;font-size:13px;font-weight:600;color:var(--text-2);transition:border-color .15s,background .15s,box-shadow .15s,transform .12s var(--ease)}
.pay-methods button:active{transform:scale(.97)}
.pay-methods button .ic{width:22px;height:22px}
.pay-methods button[aria-checked="true"]{border-color:var(--brand);background:var(--brand-softer);color:var(--text);box-shadow:0 0 0 3px var(--brand-soft)}
.pay-methods button[aria-checked="true"] .ic{color:var(--brand-strong)}
.pay-opt{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--border);border-radius:var(--r);background:var(--surface-2);width:100%;justify-content:space-between}
.pay-opt .grow{display:grid;gap:1px}
.pay-opt b{font-size:14px;font-weight:600}
.pay-opt small{font-size:12.5px;color:var(--text-3);font-weight:400}
.pay-opt input:disabled+.track{opacity:.45}
.pay-total{display:grid;line-height:1.05;margin-right:auto;min-width:0;flex:none!important}
.pay-total .eyebrow{font-size:10.5px}
.pay-total b{font-family:var(--disp);font-size:32px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:.005em}
.pay-total small{font-size:11.5px;color:var(--text-3)}
.pay-done{display:grid;justify-items:center;text-align:center;gap:6px;padding:14px 0 6px}
.pay-check{width:86px;height:86px;margin-bottom:6px}
.pay-check circle{fill:var(--ok-soft);stroke:var(--ok);stroke-width:2.5;stroke-dasharray:152;stroke-dashoffset:152;animation:payDraw .6s var(--ease-out) forwards}
.pay-check path{fill:none;stroke:var(--ok);stroke-width:3.6;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:40;stroke-dashoffset:40;animation:payDraw .42s .42s var(--ease-out) forwards}
.pay-done h3{font-size:19px;font-weight:700}
.pay-done .amount{font-family:var(--disp);font-size:46px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;animation:pop .45s .3s var(--ease-out) both}
.pay-done .auto{width:120px;height:3px;border-radius:3px;background:var(--surface-3);overflow:hidden;margin-top:10px}
.pay-done .auto span{display:block;height:100%;background:var(--ok);transform-origin:left;animation:payAuto var(--t,3.5s) linear forwards}
@keyframes payDraw{to{stroke-dashoffset:0}}
@keyframes payAuto{from{transform:scaleX(1)}to{transform:scaleX(0)}}
@media (max-width:719px){.pay-total b{font-size:28px}.money-in.xl .input{min-height:62px;font-size:34px}}
`;
export function injectPayStyle() { if (!document.getElementById('st-pay')) document.head.insertAdjacentHTML('beforeend', '<style id="st-pay">' + CSS + '</style>'); }

function hasStarted(a) {
  const t = today();
  return a.date < t || (a.date === t && a.start_min <= nowMin() + 60);
}

// ── Abrir caja ──────────────────────────────────────────────────────────────
export function openCashDialog(o) {
  o = o || {};
  injectPayStyle();
  const last = o.lastSession || null;
  return new Promise((resolve) => {
    let result = null;
    const m = modal({
      title: 'Abrir caja', subtitle: 'Cuenta el efectivo con el que empiezas el día.', size: 'sm',
      body: html`<form id="cashOpenF" class="stack" novalidate>
        <div class="field"><label for="coFloat">Fondo inicial</label>
          <div class="money-in xl"><span>$</span><input class="input" id="coFloat" name="opening_float" inputmode="decimal" autocomplete="off" placeholder="0"/></div>
          <p class="hint">${last && last.counted_cash != null ? 'En el último corte contaste ' + money(last.counted_cash) + '.' : 'Es el cambio con el que abres. Puede ser $0.'}</p>
          <p class="error">Revisa el monto.</p></div>
        <div class="field"><label for="coNotes">Nota <span class="opt">(opcional)</span></label>
          <input class="input" id="coNotes" name="notes" maxlength="300" placeholder="Ej. Abrió Ana, cambio en monedas"/><p class="error"></p></div>
      </form>`,
      actions: [
        { label: 'Cancelar', variant: 'secondary' },
        { label: 'Abrir caja', variant: 'primary', type: 'submit', form: 'cashOpenF', icon: 'wallet', close: false }
      ],
      onClose: () => resolve(result)
    });
    const form = $('#cashOpenF', m.body);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(form);
      const raw = form.opening_float.value;
      const v = raw.trim() === '' ? 0 : parseMoney(raw);
      if (!Number.isFinite(v) || v < 0) { const f = form.opening_float.closest('.field'); f.classList.add('invalid'); f.querySelector('.error').textContent = 'Escribe el fondo con números (p. ej. 500).'; form.opening_float.focus(); return; }
      const btn = m.foot.querySelector('[type=submit]');
      try {
        const d = await busy(btn, api.post('/cash/open', { opening_float: r2(v), notes: form.notes.value.trim() || undefined }));
        result = d;
        toast.success('Caja abierta · fondo de ' + money(v));
        bus.emit('cash:changed', d);
        m.close(d);
      } catch (err) { showFieldErrors(form, err); }
    });
  });
}

// ── Cobro ───────────────────────────────────────────────────────────────────
export async function openPaymentSheet(opts) {
  opts = opts || {};
  injectPayStyle();
  if (!can('payments.write')) { toast.error('Tu rol no puede registrar cobros.'); return null; }
  let appt = opts.appointment || null;
  if (appt && appt.id && (appt.total == null || appt.balance == null || !Array.isArray(appt.services))) {
    try { appt = (await api.get('/appointments/' + encodeURIComponent(appt.id))).appointment; }
    catch (err) { toast.error(err); return null; }
  }
  const client = opts.client || null;
  const methods = paymentMethods();
  const tipsOn = tipsEnabled();
  const pickStaff = !appt && can('payments.read.all');
  const balance = appt ? r2(appt.balance != null ? appt.balance : (appt.total || 0) - (appt.paid || 0)) : 0;
  const st = {
    amount: appt && balance > 0 ? balance : NaN,
    tip: 'none', tipOther: NaN,
    method: methods[0],
    complete: !!appt && appt.status !== 'completed' && hasStarted(appt),
    cashOpen: null, done: null
  };
  const canComplete = !!appt && appt.status !== 'completed' && appt.status !== 'cancelled';
  const started = !!appt && hasStarted(appt);
  const who = appt ? (appt.client_name || 'Cliente') : (client ? client.name : '');

  const summary = appt ? html`<div class="pay-sum">
      <div class="who"><div class="grow"><b class="truncate" style="display:block">${who}</b>
        <span class="meta">${relDay(appt.date, today())} · ${time(appt.start_min)}${appt.staff_name ? ' · ' + appt.staff_name : ''}${appt.folio ? ' · ' + appt.folio : ''}</span></div>
        ${appt.status === 'completed' ? raw('<span class="badge completed">Atendida</span>') : ''}</div>
      ${(appt.services || []).map((s) => html`<div class="svc"><span class="truncate">${s.name}</span><span>${money(s.price)}</span></div>`)}
      <div class="tot">
        <div><span>Total</span><b>${money(appt.total)}</b></div>
        <div class="paid"><span>Pagado</span><b>${money(appt.paid || 0)}</b></div>
        <div class="due"><span>Saldo</span><b>${money(balance)}</b></div>
      </div>
    </div>` : '';
  const paidBanner = appt && balance <= 0 ? html`<div class="banner ok">${raw(icon('check-circle'))}<div class="grow"><b>Esta cita ya está pagada.</b> Si vendes algo extra (un producto, otro servicio), regístralo aquí.</div></div>` : '';

  const body = html`<form id="payF" class="pay-form" novalidate>
    ${summary}${paidBanner}
    <div class="field">
      <label for="payAmt">${appt ? 'Monto a cobrar' : 'Monto de la venta'}</label>
      <div class="money-in xl"><span>$</span><input class="input" id="payAmt" name="amount" inputmode="decimal" autocomplete="off" placeholder="0" value="${Number.isFinite(st.amount) ? String(st.amount) : ''}" aria-describedby="payAmtHint"/></div>
      <p class="hint" id="payAmtHint"></p>
      <p class="error">Escribe el monto.</p>
    </div>
    ${!appt ? html`<div class="field"><label for="payConcept">Concepto</label>
      <input class="input" id="payConcept" name="concept" maxlength="120" placeholder="Ej. Cera para cabello, corte sin cita…"/>
      <div class="chips" style="margin-top:4px">${['Producto', 'Corte sin cita', 'Barba sin cita', 'Tratamiento'].map((c) => html`<button type="button" class="chip" data-concept="${c}">${c}</button>`)}</div>
      <p class="error">Escribe el concepto.</p></div>` : ''}
    ${client && !appt ? html`<div class="banner info">${raw(icon('user'))}<div class="grow">Se registrará a nombre de <b>${client.name}</b>.</div></div>` : ''}
    ${pickStaff ? html`<div class="field"><label for="payStaff">Barbero <span class="opt">(opcional)</span></label>
      <select class="select" id="payStaff" name="staff_id"><option value="">Sin barbero (venta de mostrador)</option></select>
      <p class="hint">Si lo eliges, la venta cuenta para su comisión.</p><p class="error"></p></div>` : ''}
    ${tipsOn ? html`<div class="field"><span class="label" id="payTipL">Propina</span>
      <div class="pay-tips" role="group" aria-labelledby="payTipL">
        <button type="button" data-tip="none" aria-pressed="true">Sin<small>$0</small></button>
        ${TIP_PCTS.map((p) => html`<button type="button" data-tip="${String(p)}" aria-pressed="false">${p}%<small data-tipv="${String(p)}">$0</small></button>`)}
        <button type="button" data-tip="other" aria-pressed="false">Otra<small>monto</small></button>
      </div>
      <div class="money-in" id="payTipOtherW" hidden style="margin-top:8px"><span>$</span><input class="input" id="payTipOther" name="tip" inputmode="decimal" autocomplete="off" placeholder="Propina"/></div>
      <p class="error">Revisa la propina.</p></div>` : ''}
    <div class="field"><span class="label" id="payMethodL">Forma de pago</span>
      <div class="pay-methods" role="radiogroup" aria-labelledby="payMethodL" style="--n:${String(Math.min(methods.length, 4))}">
        ${methods.map((k, i) => html`<button type="button" role="radio" data-method="${k}" aria-checked="${String(i === 0)}" tabindex="${i === 0 ? '0' : '-1'}">${raw(icon(METHOD_ICON[k] || 'receipt'))}${METHOD[k]}</button>`)}
      </div>
      <input type="hidden" name="method" value="${methods[0]}"/>
      <p class="error">Elige la forma de pago.</p></div>
    <div id="payCash"></div>
    ${canComplete ? html`<label class="switch pay-opt">
      <span class="grow"><b>Marcar la cita como atendida</b><small>${started ? 'Se cierra la cita al registrar el cobro.' : 'Podrás marcarla desde 1 hora antes de su inicio.'}</small></span>
      <input type="checkbox" name="complete" ${st.complete ? 'checked' : ''} ${started ? '' : 'disabled'}/><span class="track"></span></label>` : ''}
  </form>`;

  const footer = html`<div class="pay-total" aria-live="polite"><span class="eyebrow">Total a cobrar</span><b id="payTotal" data-v="0">$0</b><small id="payTotalSub"></small></div>
    <button type="submit" form="payF" class="btn btn-primary btn-lg" id="payGo">${raw(icon('check'))}Cobrar</button>`;

  return new Promise((resolve) => {
    let result = null;
    const m = modal({
      title: appt ? 'Cobrar cita' : 'Registrar cobro',
      subtitle: appt ? '' : (client ? 'Venta para ' + client.name : 'Venta suelta: producto o servicio sin cita'),
      body, footerHtml: footer,
      onClose: () => { clearTimeout(autoT); resolve(result); }
    });
    let autoT = null;
    const form = $('#payF', m.body);
    const amtIn = $('#payAmt', m.body);
    const totalEl = $('#payTotal', m.foot);
    const subEl = $('#payTotalSub', m.foot);
    const hint = $('#payAmtHint', m.body);
    const tipOtherIn = $('#payTipOther', m.body);

    // Barberos para la venta suelta (dueño).
    if (pickStaff) {
      getStaff().then((list) => {
        const sel = $('#payStaff', m.body);
        if (!sel) return;
        sel.insertAdjacentHTML('beforeend', String(html`${(list || []).filter((s) => s.active !== false).map((s) => html`<option value="${s.id}">${s.name}</option>`)}`));
      }).catch(() => {});
    }
    // ¿Hay caja abierta? (solo quien puede ver la caja)
    if (can('cash.read')) {
      api.get('/cash/current').then((d) => { st.cashOpen = !!(d && d.session); st.last = d && d.last_session; paintCash(); }).catch(() => {});
    }

    const amount = () => { const v = parseMoney(amtIn.value); return Number.isFinite(v) ? r2(v) : 0; };
    const tip = () => {
      if (!tipsOn || st.tip === 'none') return 0;
      if (st.tip === 'other') { const v = parseMoney(tipOtherIn.value); return Number.isFinite(v) ? r2(v) : 0; }
      return Math.round(amount() * Number(st.tip) / 100);
    };
    function paint() {
      const a = amount(), t = tip();
      tweenMoney(totalEl, r2(a + t));
      subEl.textContent = t ? money(a) + ' + ' + money(t) + ' de propina' : METHOD[st.method];
      $$('[data-tipv]', m.body).forEach((s) => { s.textContent = money(Math.round(a * Number(s.dataset.tipv) / 100)); });
      if (appt && balance > 0 && amtIn.value.trim()) {
        if (a > 0 && a < balance) hint.textContent = 'Pago parcial: quedará un saldo de ' + money(r2(balance - a)) + '.';
        else if (a > balance) hint.textContent = 'Es ' + money(r2(a - balance)) + ' más que el saldo de la cita.';
        else if (a === balance) hint.textContent = 'Liquida el saldo de la cita.';
        else hint.textContent = '';
      } else hint.textContent = '';
      const go = $('#payGo', m.foot);
      if (go) go.lastChild.textContent = a + t > 0 ? 'Cobrar ' + money(r2(a + t)) : 'Cobrar';
    }
    function paintCash() {
      const box = $('#payCash', m.body);
      if (!box) return;
      const show = st.method === 'cash' && st.cashOpen === false;
      box.innerHTML = show ? String(html`<div class="banner warn">${raw(icon('alert'))}<div class="grow"><b>La caja está cerrada.</b> Este cobro en efectivo no entrará en ningún corte de caja.</div>
        ${can('cash.manage') ? html`<button type="button" class="btn btn-secondary btn-sm" data-open-cash>Abrir caja</button>` : ''}</div>`) : '';
    }

    m.body.addEventListener('input', (e) => {
      if (e.target === amtIn || e.target === tipOtherIn) { e.target.closest('.field').classList.remove('invalid'); paint(); }
      if (e.target.name === 'concept') e.target.closest('.field').classList.remove('invalid');
    });
    m.body.addEventListener('click', async (e) => {
      const tb = e.target.closest('[data-tip]');
      if (tb) {
        st.tip = tb.dataset.tip;
        $$('[data-tip]', m.body).forEach((b) => b.setAttribute('aria-pressed', String(b === tb)));
        const w = $('#payTipOtherW', m.body);
        w.hidden = st.tip !== 'other';
        if (st.tip === 'other') tipOtherIn.focus();
        paint();
        return;
      }
      const mb = e.target.closest('[data-method]');
      if (mb) { selectMethod(mb.dataset.method, false); return; }
      const cc = e.target.closest('[data-concept]');
      if (cc) { const i = form.concept; i.value = cc.dataset.concept; i.closest('.field').classList.remove('invalid'); i.focus(); return; }
      if (e.target.closest('[data-open-cash]')) {
        const d = await openCashDialog({ lastSession: st.last });
        if (d) { st.cashOpen = true; paintCash(); }
      }
    });
    // Radio con flechas (accesible por teclado).
    $('.pay-methods', m.body).addEventListener('keydown', (e) => {
      if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
      e.preventDefault();
      const i = methods.indexOf(st.method), d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
      selectMethod(methods[(i + d + methods.length) % methods.length], true);
    });
    function selectMethod(k, focus) {
      st.method = k;
      form.method.value = k;
      form.method.closest('.field').classList.remove('invalid');
      $$('[data-method]', m.body).forEach((b) => { const on = b.dataset.method === k; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
      paint(); paintCash();
    }
    paint();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (st.done) return;
      clearFieldErrors(form);
      const a = parseMoney(amtIn.value);
      const bad = (input, msg) => { const f = input.closest('.field'); f.classList.add('invalid'); if (msg) f.querySelector('.error').textContent = msg; input.focus(); const b = form.closest('.modal'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); };
      if (!amtIn.value.trim()) return bad(amtIn, 'Escribe el monto a cobrar.');
      if (!Number.isFinite(a) || a < 0) return bad(amtIn, 'Escribe el monto con números (p. ej. 250 o 250.50).');
      const t = tip();
      if (tipsOn && st.tip === 'other' && tipOtherIn.value.trim() && !Number.isFinite(parseMoney(tipOtherIn.value))) return bad(tipOtherIn, 'Escribe la propina con números.');
      if (r2(a) + t <= 0) return bad(amtIn, 'Escribe un monto mayor a cero.');
      if (!appt && form.concept && !form.concept.value.trim()) return bad(form.concept, 'Escribe qué vendiste (p. ej. "Cera para cabello").');
      const payload = { amount: r2(a), tip: t, method: st.method };
      if (appt) { payload.appointment_id = appt.id; const c = form.complete; payload.complete = !!(c && c.checked && !c.disabled); }
      else {
        payload.concept = form.concept.value.trim();
        if (client) payload.client_id = client.id;
        if (form.staff_id && form.staff_id.value) payload.staff_id = form.staff_id.value;
      }
      const go = $('#payGo', m.foot);
      try {
        const p = await busy(go, api.post('/payments', payload));
        st.done = p;
        result = p;
        const total = r2((Number(p.amount) || 0) + (Number(p.tip) || 0));
        toast.success('Cobro registrado · ' + money(total));
        bus.emit('payments:changed', p);
        bus.emit('appointments:changed', { id: p.appointment_id || null, payment: p });
        if (p.method === 'cash') bus.emit('cash:changed');
        try { if (opts.onDone) opts.onDone(p); } catch (err) { console.error(err); }
        showDone(p, total);
      } catch (err) {
        showFieldErrors(form, err);
      }
    });

    function showDone(p, total) {
      m.setTitle('');
      const completed = p.appointment_status === 'completed' && appt && appt.status !== 'completed';
      const thanks = appt && can('messages.send');
      m.body.innerHTML = String(html`<div class="pay-done" role="status">
        <svg class="pay-check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M15 27l7.5 7.5L38 18.5"/></svg>
        <h3>¡Cobro registrado!</h3>
        <div class="amount">${money(total)}</div>
        <p class="muted">${METHOD[p.method] || ''}${Number(p.tip) ? ' · incluye ' + money(p.tip) + ' de propina' : ''}${p.client_name ? ' · ' + p.client_name : ''}</p>
        ${completed ? raw('<span class="badge completed" style="margin-top:4px">Cita marcada como atendida</span>') : ''}
        ${thanks ? '' : raw('<div class="auto" aria-hidden="true"><span></span></div>')}
      </div>`);
      m.foot.innerHTML = String(html`${thanks ? html`<button type="button" class="btn btn-wa" data-thanks>${raw(icon('whatsapp'))}Enviar agradecimiento</button>` : ''}
        <button type="button" class="btn btn-primary" data-ok>Listo</button>`);
      m.foot.querySelector('[data-ok]').focus({ preventScroll: true });
      m.foot.addEventListener('click', async (e) => {
        if (e.target.closest('[data-ok]')) m.close(p);
        const tb = e.target.closest('[data-thanks]');
        if (tb) {
          // Se llama en el mismo gesto del clic: el navegador no bloquea la pestaña de WhatsApp.
          const pr = sendWhatsApp({ appointment_id: appt.id, kind: 'thanks', name: who });
          busy(tb, pr);
          const r = await pr;
          if (r) m.close(p);
        }
      });
      if (!thanks) {
        autoT = setTimeout(() => m.close(p), 3500);
        m.el.addEventListener('pointerdown', () => { clearTimeout(autoT); const a = m.body.querySelector('.auto'); if (a) a.remove(); }, { once: true });
      }
    }
  });
}

