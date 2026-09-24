// #/mensajes — Centro de WhatsApp. Pestañas:
//   Recordatorios  → citas de Hoy/Mañana/otra fecha con su recordatorio listo; "Enviar" por cita, progreso
//                    "4 de 12 enviados" y modo "uno tras otro" (o "todos a la cola" en modo automático).
//   Historial      → mensajes con estado (preparado, abierto, enviado, en cola, falló) y detalle.
//   Plantillas     → (dueño) editar cada plantilla con variables clicables y vista previa en vivo.
//   Automatización → (dueño) modo manual vs automático, cola y estado "preparado para automatizar".
import { html, raw, on, $, $$ } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { api, SITE_BASE } from '../lib/api.js';
import { bus, can, shop, today, role } from '../lib/state.js';
import { setQuery, navigate } from '../lib/router.js';
import { toast, modal, confirmDialog, busy, emptyState, errorState, skeletonRows } from '../lib/ui.js';
import { time, dateLong, dateLongCap, addDays, ago, dateTimeIso, phone as fmtPhone, plural, number } from '../lib/fmt.js';
import { sendWhatsApp, editAndSendWhatsApp, markMessage, bubbleHtml, waMode, waLinkFor, KIND_LABEL, MSG_STATUS, MAX_BODY } from '../lib/whatsapp.js';
import { DEFAULT_TEMPLATES } from '../../core/domain/settings.js';

const TPL_KINDS = [
  ['confirmation', 'Confirmación', 'Cuando agendas o confirmas una cita.'],
  ['reminder', 'Recordatorio', 'Un día antes de la cita, para que no se le olvide.'],
  ['reschedule', 'Cambio de horario', 'Cuando mueves la cita a otra fecha u hora.'],
  ['cancellation', 'Cancelación', 'Cuando se cancela la cita; invita a reservar de nuevo.'],
  ['thanks', 'Agradecimiento', 'Después de atenderlo; invita a dejar una reseña.'],
  ['no_show', 'No asistió', 'Si no llegó, para invitarlo a reagendar.']
];
const VARS = [
  ['cliente', 'Cliente'], ['fecha', 'Fecha'], ['hora', 'Hora'], ['servicios', 'Servicios'], ['barbero', 'Barbero'],
  ['total', 'Total'], ['folio', 'Folio'], ['enlace', 'Enlace'], ['barberia', 'Barbería'], ['direccion', 'Dirección'], ['resena', 'Reseña']
];
// 17:30 → { t: '5:30', ap: 'p.m.' }
const h12 = (min) => { const h = Math.floor(min / 60) % 24, m = min % 60; return { t: (h % 12 || 12) + ':' + String(m).padStart(2, '0'), ap: h < 12 ? 'a.m.' : 'p.m.' }; };
const KIND_ICON = { confirmation: 'calendar-check', reminder: 'clock', reschedule: 'repeat', cancellation: 'x-circle', thanks: 'star', no_show: 'ban', custom: 'message' };

// Misma regla que el servidor (core/domain/messages.js → renderTemplate) para la vista previa.
const fold = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
function renderTemplate(tpl, vars) {
  const val = (k) => { const key = fold(k); return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key] == null ? '' : vars[key]) : null; };
  const out = [];
  for (const line of String(tpl || '').replace(/\r\n?/g, '\n').split('\n')) {
    let used = 0, empty = 0;
    let r = line.replace(/\{([^{}\n]{1,24})\}/g, (m, k) => { const v = val(k); if (v === null) return m; used++; if (!v.trim()) empty++; return v; });
    if (used && used === empty && !/[\p{L}\p{N}]/u.test(r)) continue;
    if (empty) r = r.replace(/[ \t]{2,}/g, ' ').replace(/ +([,.;:!?])/g, '$1').trimEnd();
    out.push(r);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const CSS = `
.v-msg .grid-2,.v-msg .stack,.v-msg .stack-lg,.v-msg .tpl-grid,.v-msg .list{grid-template-columns:minmax(0,1fr)}
.v-msg .grid-2>*,.v-msg .tpl-grid>*{min-width:0}
@media (min-width:900px){.v-msg .grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}}
.rm-seq,.msg-det{grid-template-columns:minmax(0,1fr)}
.wa-head-mode{display:inline-flex;align-items:center;gap:6px}
.rm-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
.rm-bar .input{width:auto;min-height:40px}
.rm-prog{padding:16px 18px;display:grid;gap:12px;margin-bottom:14px}
.rm-prog .top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.rm-prog .count{font-family:var(--disp);font-size:30px;font-weight:800;line-height:1.05}
.rm-prog .count span{font-family:var(--sans);font-size:14px;font-weight:500;color:var(--text-2);margin-left:4px}
.rm-prog .progress-bar{height:8px}
.rm-prog .progress-bar>span{background:#25D366}
.rm-prog .sub{font-size:12.5px;color:var(--text-3)}
.rm-row{gap:12px;padding:12px 14px 12px 16px}
.rm-time{width:52px;flex:none;display:grid;justify-items:center;padding:6px 0;border-radius:12px;background:var(--surface-2);border:1px solid var(--border);line-height:1.05}
.rm-time b{font-size:15px;font-variant-numeric:tabular-nums}
.rm-time span{font-size:10.5px;color:var(--text-3);font-weight:600;margin-top:2px}
.rm-row .meta{display:flex;gap:2px 8px;align-items:center;min-width:0;flex-wrap:wrap}
.rm-row .meta .faint{white-space:nowrap}
.rm-row .done-t{color:var(--ok);font-weight:600;display:inline-flex;align-items:center;gap:3px;flex:none}
.rm-row .done-t .ic{width:14px;height:14px;stroke-width:2.4}
.rm-row.done .rm-time{background:var(--ok-soft);border-color:transparent;color:var(--ok)}
.rm-row.nophone .rm-time{opacity:.6}
.rm-row .trail{gap:4px}
.rm-row.flash{animation:flash 1.2s var(--ease)}
.rm-seq{display:grid;gap:14px}
.rm-seq .who{display:flex;align-items:center;gap:12px}
.rm-seq .who .rm-time{width:58px}
.rm-seq .who b{font-size:16px}
.rm-done{display:grid;justify-items:center;text-align:center;gap:6px;padding:18px 0 6px}
.rm-done .art{width:72px;height:72px;border-radius:50%;background:rgba(37,211,102,.15);color:#1FA855;display:grid;place-items:center;animation:pop .5s var(--ease-out)}
.rm-done .art .ic{width:34px;height:34px;stroke-width:2.2}
.rm-done h3{font-size:19px}
.msg-row{align-items:flex-start;gap:12px}
.msg-ic{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;flex:none;background:rgba(37,211,102,.12);color:#1FA855}
.msg-ic .ic{width:18px;height:18px}
.msg-row .top{display:flex;align-items:baseline;gap:8px;min-width:0}
.msg-row .top .title{flex:1;min-width:0}
.msg-row .top .faint{font-size:12px;white-space:nowrap;flex:none}
.msg-row .sub2{display:flex;align-items:center;gap:8px;margin-top:3px;flex-wrap:wrap}
.msg-row .kind{font-size:12.5px;color:var(--text-2);font-weight:500;white-space:nowrap}
.msg-row .sub2 .badge{height:20px;font-size:11px}
.msg-ex{font-size:13px;color:var(--text-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:2px;overflow-wrap:anywhere}
.msg-det{display:grid;gap:14px}
.msg-det dl{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:13.5px;margin:0}
.msg-det dt{color:var(--text-3)}
.msg-det dd{margin:0;min-width:0;overflow-wrap:anywhere}
.tpl-kinds{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:4px;margin-bottom:14px}
.tpl-kinds::-webkit-scrollbar{display:none}
.tpl-kinds .chip{flex:none;min-height:38px}
.tpl-kinds .chip .dot{width:6px;height:6px}
.tpl-grid{display:grid;gap:16px;align-items:start}
@media (min-width:960px){.v-msg .tpl-grid{grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr)}.tpl-prev{position:sticky;top:calc(var(--topbar-h) + 12px)}}
.tpl-edit{display:grid;gap:14px}
.tpl-edit h3{font-size:17px;font-weight:700}
.tpl-edit .desc{color:var(--text-2);font-size:13.5px;margin-top:2px}
.tpl-ta{min-height:210px;font-size:15px;line-height:1.5}
.tpl-vars .chip{min-height:36px;gap:5px}
.tpl-vars .chip code{font-family:var(--mono);font-size:11.5px;color:var(--text-3)}
.tpl-vars .chip:hover code{color:inherit}
.tpl-actions{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center;border-top:1px solid var(--border);padding-top:14px}
.tpl-actions .row{gap:10px}
.tpl-dirty{font-size:12.5px;color:var(--warn);font-weight:600;display:inline-flex;align-items:center;gap:6px}
.tpl-dirty::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--warn)}
.tpl-prev{display:grid;gap:10px}
.tpl-prev .phone{border-radius:24px;padding:10px;background:var(--surface);border:1px solid var(--border);box-shadow:var(--shadow-2)}
.tpl-prev .phone-top{display:flex;align-items:center;gap:10px;padding:6px 8px 10px}
.tpl-prev .phone-top b{font-size:14px;display:block}
.tpl-prev .phone-top span{font-size:12px;color:var(--text-3)}
.tpl-prev .wa-chat{min-height:220px;align-items:flex-start;border-radius:16px}
.au-modes{display:grid;gap:10px;margin-top:12px}
.au-mode{display:flex;gap:14px;align-items:flex-start;text-align:left;width:100%;padding:16px;border-radius:var(--r-lg);border:1.5px solid var(--border-strong);background:var(--surface);transition:border-color .15s,background .15s,box-shadow .15s}
.au-mode:hover{border-color:var(--text-3)}
.au-mode[aria-checked="true"]{border-color:var(--brand);background:var(--brand-softer);box-shadow:0 0 0 3px var(--brand-soft)}
.au-mode .ai{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;flex:none;background:var(--surface-3);color:var(--text-2)}
.au-mode[aria-checked="true"] .ai{background:var(--ink);color:var(--brand)}
.au-mode b{font-size:15px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.au-mode p{font-size:13.5px;color:var(--text-2);margin-top:3px}
.au-mode .radio{width:20px;height:20px;border-radius:50%;border:2px solid var(--border-strong);flex:none;margin-left:auto;margin-top:2px;display:grid;place-items:center}
.au-mode[aria-checked="true"] .radio{border-color:var(--brand)}
.au-mode[aria-checked="true"] .radio::after{content:"";width:10px;height:10px;border-radius:50%;background:var(--brand)}
.au-check{display:grid;gap:4px;margin-top:10px}
.au-check div{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border)}
.au-check div:last-child{border-bottom:0}
.au-check .st{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;flex:none}
.au-check .st .ic{width:15px;height:15px;stroke-width:2.4}
.au-check .st.ok{background:var(--ok-soft);color:var(--ok)}.au-check .st.wait{background:var(--warn-soft);color:var(--warn)}
.au-check b{font-size:14px;font-weight:600;display:block}
.au-check span.d{font-size:13px;color:var(--text-2)}
.au-flow{display:grid;gap:12px;grid-template-columns:minmax(0,1fr)}
@media (min-width:760px){.au-flow{grid-template-columns:repeat(3,minmax(0,1fr))}}
.au-flow div{padding:14px;border-radius:var(--r);background:var(--surface-2);border:1px solid var(--border);display:grid;gap:6px}
.au-flow .n{width:28px;height:28px;border-radius:9px;background:var(--brand-soft);color:var(--brand-strong);font-weight:700;display:grid;place-items:center;font-size:13px}
.au-flow b{font-size:14px}.au-flow span{font-size:13px;color:var(--text-2)}
`;
function injectStyle() { if (!document.getElementById('st-msg')) document.head.insertAdjacentHTML('beforeend', '<style id="st-msg">' + CSS + '</style>'); }

export default {
  title: 'WhatsApp',
  async render(el, { query }) {
    injectStyle();
    el.classList.add('v-msg');
    const owner = can('shop.update');
    const TABS = [['recordatorios', 'Recordatorios', 'clock'], ['historial', 'Historial', 'list']]
      .concat(owner ? [['plantillas', 'Plantillas', 'edit'], ['automatizacion', 'Automatización', 'zap']] : []);
    let tab = TABS.some((t) => t[0] === query.tab) ? query.tab : 'recordatorios';
    const t0 = today();
    let rmDate = /^\d{4}-\d{2}-\d{2}$/.test(query.fecha || '') ? query.fecha : addDays(t0, 1);
    let tplKind = TPL_KINDS.some((k) => k[0] === query.t) ? query.t : 'reminder';
    let histStatus = MSG_STATUS[query.estado] ? query.estado : '';
    let histLimit = 60;
    let tplDirty = false;
    let seq = 0;
    const R = { items: [], date: rmDate };

    const modeBadge = () => waMode() === 'auto'
      ? html`<span class="badge warn plain wa-head-mode">${raw(icon('zap', 'ic-sm'))}Envío automático</span>`
      : html`<span class="badge ok plain wa-head-mode">${raw(icon('smartphone', 'ic-sm'))}Envío manual</span>`;
    el.innerHTML = String(html`
      <div class="page-head">
        <div><h2>WhatsApp</h2><p>${role() === 'barber' ? 'Recordatorios y mensajes de tus citas.' : 'Recordatorios, historial y plantillas de los mensajes a tus clientes.'}</p></div>
        <div class="actions">${modeBadge()}</div>
      </div>
      <div class="tabs" role="tablist" aria-label="Secciones de WhatsApp">${TABS.map(([k, l]) => html`<button type="button" role="tab" id="mt-${k}" aria-controls="msgTab" data-tab="${k}" aria-selected="${String(k === tab)}">${l}</button>`)}</div>
      <div id="msgTab" role="tabpanel"></div>`);
    const box = $('#msgTab', el);

    const syncQuery = () => setQuery(Object.assign({ tab: tab !== 'recordatorios' ? tab : '' },
      tab === 'recordatorios' && rmDate !== addDays(today(), 1) ? { fecha: rmDate } : {},
      tab === 'plantillas' && tplKind !== 'reminder' ? { t: tplKind } : {},
      tab === 'historial' && histStatus ? { estado: histStatus } : {}));
    async function show(soft) {
      const my = ++seq;
      $$('[data-tab]', el).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
      box.setAttribute('aria-labelledby', 'mt-' + tab);
      syncQuery();
      if (tab === 'recordatorios') return renderReminders(my, soft);
      if (tab === 'historial') return renderHistory(my, soft);
      if (tab === 'plantillas') return renderTemplates();
      return renderAuto(my);
    }
    const alive = (my) => my === seq && document.body.contains(box);

    // ════════ RECORDATORIOS ════════
    const dayMode = () => (rmDate === today() ? 'hoy' : rmDate === addDays(today(), 1) ? 'manana' : 'otro');
    async function renderReminders(my, soft) {
      if (!soft) {
        const dm = dayMode();
        box.innerHTML = String(html`<div class="rm-bar">
            <div class="seg" role="group" aria-label="Día">
              <button type="button" data-day="hoy" aria-pressed="${String(dm === 'hoy')}">Hoy</button>
              <button type="button" data-day="manana" aria-pressed="${String(dm === 'manana')}">Mañana</button>
              <button type="button" data-day="otro" aria-pressed="${String(dm === 'otro')}">Otra fecha</button>
            </div>
            <label class="sr" for="rmDate">Fecha</label><input class="input" type="date" id="rmDate" value="${rmDate}" ${dm === 'otro' ? '' : 'hidden'}/>
          </div>
          <div id="rmRes"><div class="card skel" style="height:118px;border:0;margin-bottom:14px"></div><div class="card">${skeletonRows(5)}</div></div>`);
      }
      const res = $('#rmRes', box);
      if (!res) return;
      let d;
      try { d = await api.get('/reminders', { date: rmDate }); }
      catch (err) { if (alive(my)) res.innerHTML = String(html`<div class="card">${errorState(err, 'msgRetry')}</div>`); return; }
      if (!alive(my)) return;
      R.items = d.items || []; R.date = d.date;
      paintReminders();
    }
    function rmCounts() {
      const withPhone = R.items.filter((x) => x.to_phone);
      return { total: withPhone.length, sent: withPhone.filter((x) => x.reminded).length, noPhone: R.items.length - withPhone.length };
    }
    function rmRow(x) {
      const a = x.appointment;
      const svc = (a.services || []).map((s) => s.name).join(' + ');
      const owner2 = can('appointments.read.all');
      const hm = h12(a.start_min);
      return html`<div class="list-item rm-row ${x.reminded ? 'done' : ''} ${x.to_phone ? '' : 'nophone'}" data-aid="${a.id}">
        <div class="rm-time" aria-hidden="true"><b>${hm.t}</b><span>${hm.ap}</span></div>
        <div class="grow" style="min-width:0">
          <div class="title truncate">${a.client_name || 'Cliente'}</div>
          <div class="meta"><span class="truncate">${svc}${owner2 && a.staff_name ? ' · ' + a.staff_name : ''}</span></div>
          <div class="meta">${x.to_phone ? html`<span class="faint">${fmtPhone(x.to_phone)}</span>` : raw('<span class="warn-t">Sin teléfono</span>')}${x.reminded ? html`<span class="done-t">${raw(icon('check'))}Enviado</span>` : ''}</div>
        </div>
        <div class="trail">
          ${x.to_phone ? html`<button type="button" class="btn btn-ghost btn-icon btn-sm" data-rm-edit="${a.id}" aria-label="Editar mensaje para ${a.client_name || 'el cliente'}">${raw(icon('edit'))}</button>
            ${x.reminded ? html`<button type="button" class="btn btn-secondary btn-icon btn-sm" data-rm-send="${a.id}" title="Reenviar" aria-label="Reenviar recordatorio a ${a.client_name || 'el cliente'}">${raw(icon('repeat'))}</button>`
              : html`<button type="button" class="btn btn-wa btn-sm" data-rm-send="${a.id}" aria-label="Enviar recordatorio a ${a.client_name || 'el cliente'}">${raw(icon('whatsapp'))}Enviar</button>`}`
            : can('clients.write') && a.client_id ? html`<a class="btn btn-secondary btn-sm" href="#/clientes/${a.client_id}">Agregar tel.</a>` : ''}
        </div>
      </div>`;
    }
    function paintReminders() {
      const res = $('#rmRes', box);
      if (!res) return;
      const c = rmCounts();
      const auto = waMode() === 'auto';
      const dl = dateLong(R.date);
      const rel = R.date === today() ? 'de hoy' : R.date === addDays(today(), 1) ? 'de mañana' : 'del ' + dl;
      if (!R.items.length) {
        res.innerHTML = '<div class="card">' + String(emptyState({ icon: 'calendar-check', title: 'Nada que recordar ' + (R.date === today() ? 'hoy' : R.date === addDays(today(), 1) ? 'mañana' : 'ese día'), text: 'No hay citas pendientes ni confirmadas para el ' + dl + '.', action: { label: 'Ver la agenda', href: '#/agenda?fecha=' + R.date, icon: 'calendar' } })) + '</div>';
        return;
      }
      const pct = c.total ? Math.round((c.sent / c.total) * 100) : 0;
      const pending = c.total - c.sent;
      res.innerHTML = String(html`
        <section class="card rm-prog" aria-live="polite">
          <div class="top">
            <div><div class="eyebrow">Recordatorios ${rel}</div><div class="count">${String(c.sent)} de ${String(c.total)}<span>enviados</span></div></div>
            ${pending ? (auto ? html`<button type="button" class="btn btn-wa" data-act="queue-all">${raw(icon('zap'))}Enviar ${pending === 1 ? 'el pendiente' : 'los ' + pending} a la cola</button>`
              : html`<button type="button" class="btn btn-wa" data-act="seq">${raw(icon('play'))}Enviar uno tras otro</button>`)
              : raw('<span class="badge ok">¡Todos enviados!</span>')}
          </div>
          <div class="progress-bar" role="progressbar" aria-label="Recordatorios enviados" aria-valuemin="0" aria-valuemax="${String(c.total)}" aria-valuenow="${String(c.sent)}"><span style="width:${String(pct)}%"></span></div>
          <div class="sub">${auto ? 'Modo automático: los mensajes salen desde la cola de envío.' : 'Se abre WhatsApp con el mensaje listo; solo toca enviar.'}${c.noPhone ? ' · ' + plural(c.noPhone, 'cita') + ' sin teléfono' : ''}</div>
        </section>
        <section class="card" aria-label="Citas"><div class="list">${R.items.map(rmRow)}</div></section>`);
    }
    function markReminded(aid) {
      const x = R.items.find((i) => i.appointment.id === aid);
      if (x) x.reminded = true;
      paintReminders();
      const row = box.querySelector('[data-aid="' + aid + '"]');
      if (row) { row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); }
    }
    function sendOne(btn, aid) {
      const x = R.items.find((i) => i.appointment.id === aid);
      if (!x) return;
      const p = sendWhatsApp({ appointment_id: aid, kind: 'reminder', name: x.appointment.client_name }); // mismo gesto
      busy(btn, p);
      p.then((r) => { if (r && (r.opened || r.queued)) markReminded(aid); });
    }
    function editOne(aid) {
      const x = R.items.find((i) => i.appointment.id === aid);
      if (!x) return;
      editAndSendWhatsApp({ appointment_id: aid, kind: 'reminder', name: x.appointment.client_name, phone: x.to_phone, kinds: ['reminder', 'confirmation', 'custom'] })
        .then((r) => { if (r && (r.opened || r.queued)) markReminded(aid); });
    }
    async function queueAll(btn) {
      const list = R.items.filter((x) => x.to_phone && !x.reminded);
      let ok = 0;
      await busy(btn, (async () => {
        for (const x of list) {
          const r = await sendWhatsApp({ appointment_id: x.appointment.id, kind: 'reminder', silent: true });
          if (r && (r.queued || r.opened)) { x.reminded = true; ok++; }
        }
      })());
      paintReminders();
      if (ok) toast.success(plural(ok, 'recordatorio') + ' en la cola de envío automático');
      else toast.error('No se pudo encolar ningún recordatorio. Revisa los teléfonos.');
    }
    // Modo "uno tras otro": una tarjeta por cita, "Enviar y seguir" avanza sola.
    function openSequence() {
      const queue = R.items.filter((x) => x.to_phone && !x.reminded);
      if (!queue.length) return;
      let i = 0, skipped = 0;
      const c0 = rmCounts();
      const m = modal({ title: 'Enviar recordatorios', subtitle: c0.sent + ' de ' + c0.total + ' enviados', body: '<div id="seqBody"></div>', footerHtml: '<div id="seqFoot" style="display:contents"></div>' });
      const bodyEl = $('#seqBody', m.body);
      const footEl = m.foot;
      const paint = () => {
        const c = rmCounts();
        m.el.querySelector('.modal-head .sub').textContent = c.sent + ' de ' + c.total + ' enviados';
        if (i >= queue.length) {
          const left = queue.filter((x) => !x.reminded).length;
          m.setTitle(left ? 'Casi listo' : '¡Listo!');
          bodyEl.innerHTML = String(html`<div class="rm-done"><div class="art">${raw(icon(left ? 'clock' : 'check'))}</div>
            <h3>${left ? 'Quedan ' + plural(left, 'recordatorio') + ' por enviar' : 'Enviaste todos los recordatorios'}</h3>
            <p class="muted">${left ? 'Puedes enviarlos desde la lista cuando quieras.' : 'Tus clientes ya tienen su recordatorio. Menos citas perdidas.'}</p></div>`);
          footEl.innerHTML = '<button type="button" class="btn btn-primary" data-close-seq>Listo</button>';
          return;
        }
        const x = queue[i], a = x.appointment;
        const hm = h12(a.start_min);
        bodyEl.innerHTML = String(html`<div class="rm-seq">
          <div class="progress-bar"><span style="width:${String(Math.round((i / queue.length) * 100))}%"></span></div>
          <div class="who"><div class="rm-time"><b>${hm.t}</b><span>${hm.ap}</span></div>
            <div style="min-width:0"><span class="eyebrow">${String(i + 1)} de ${String(queue.length)}</span><b class="truncate" style="display:block">${a.client_name || 'Cliente'}</b><span class="muted" style="font-size:13px">${fmtPhone(x.to_phone)} · ${(a.services || []).map((s) => s.name).join(' + ')}</span></div></div>
          ${raw(bubbleHtml(x.body))}
          <p class="faint" style="font-size:12.5px">El enlace para gestionar la cita se genera al enviarlo.</p>
        </div>`);
        footEl.innerHTML = String(html`<button type="button" class="btn btn-secondary" data-skip>Saltar</button>
          <button type="button" class="btn btn-wa" data-send-next>${raw(icon('whatsapp'))}Enviar y seguir</button>`);
        const go = footEl.querySelector('[data-send-next]');
        if (go && window.matchMedia('(min-width:720px)').matches) go.focus({ preventScroll: true });
      };
      footEl.addEventListener('click', (e) => {
        if (e.target.closest('[data-close-seq]')) { m.close(); return; }
        if (e.target.closest('[data-skip]')) { skipped++; i++; paint(); return; }
        const go = e.target.closest('[data-send-next]');
        if (!go || go.getAttribute('aria-busy') === 'true') return;
        const x = queue[i];
        const p = sendWhatsApp({ appointment_id: x.appointment.id, kind: 'reminder', name: x.appointment.client_name, silent: true }); // mismo gesto
        busy(go, p);
        p.then((r) => {
          if (r && (r.opened || r.queued)) { x.reminded = true; markReminded(x.appointment.id); i++; }
          paint();
        });
      });
      paint();
    }

    // ════════ HISTORIAL ════════
    async function renderHistory(my, soft) {
      if (!soft) {
        box.innerHTML = String(html`<div class="toolbar"><div class="chips" role="group" aria-label="Estado">
            <button type="button" class="chip" data-hs="" aria-pressed="${String(!histStatus)}">Todos</button>
            ${['opened', 'sent', 'queued', 'failed', 'prepared'].map((s) => html`<button type="button" class="chip" data-hs="${s}" aria-pressed="${String(histStatus === s)}">${s === 'opened' ? 'Abiertos' : s === 'sent' ? 'Enviados' : s === 'queued' ? 'En cola' : s === 'failed' ? 'Fallidos' : 'Sin abrir'}</button>`)}
          </div></div><div id="hsRes"><div class="card">${skeletonRows(6)}</div></div>`);
      }
      const res = $('#hsRes', box);
      if (!res) return;
      let list;
      try { list = await api.get('/messages', { status: histStatus, limit: histLimit }); }
      catch (err) { if (alive(my)) res.innerHTML = String(html`<div class="card">${errorState(err, 'msgRetry')}</div>`); return; }
      if (!alive(my)) return;
      R.hist = list;
      if (!list.length) {
        res.innerHTML = '<div class="card">' + String(emptyState(histStatus
          ? { icon: 'filter', title: 'No hay mensajes con ese estado', text: 'Prueba con otro filtro.', action: { label: 'Ver todos', id: 'hsAll' } }
          : { icon: 'whatsapp', title: 'Aún no envías mensajes', text: 'Cuando mandes un recordatorio, confirmación o agradecimiento, lo verás aquí con su estado.', action: { label: 'Enviar recordatorios', id: 'hsGoRem', icon: 'clock' } })) + '</div>';
        return;
      }
      res.innerHTML = String(html`<section class="card"><div class="list">${list.map((m) => {
        const st = MSG_STATUS[m.status] || { label: m.status, cls: 'plain' };
        return html`<button type="button" class="list-item msg-row" data-mid="${m.id}">
          <span class="msg-ic" aria-hidden="true">${raw(icon(KIND_ICON[m.kind] || 'message'))}</span>
          <div class="grow" style="min-width:0">
            <div class="top"><span class="title truncate">${m.client_name || fmtPhone(m.to_phone) || 'Cliente'}</span><span class="faint">${ago(m.created_at)}</span></div>
            <div class="sub2"><span class="kind">${KIND_LABEL[m.kind] || m.kind}</span><span class="badge ${st.cls}">${st.label}</span></div>
            <div class="msg-ex">${m.body}</div>
          </div>
        </button>`;
      })}</div></section>
      ${list.length >= histLimit && histLimit < 500 ? html`<div style="display:flex;justify-content:center;margin-top:14px"><button type="button" class="btn btn-secondary" id="hsMore">${raw(icon('chevron-down'))}Ver más mensajes</button></div>` : ''}`);
    }
    function openMessage(id) {
      const msg = (R.hist || []).find((x) => x.id === id);
      if (!msg) return;
      const st = MSG_STATUS[msg.status] || { label: msg.status, cls: 'plain' };
      const canMark = ['prepared', 'opened'].includes(msg.status);
      const m = modal({
        title: KIND_LABEL[msg.kind] || 'Mensaje',
        subtitle: (msg.client_name ? msg.client_name + ' · ' : '') + fmtPhone(msg.to_phone),
        body: String(html`<div class="msg-det">${raw(bubbleHtml(msg.body, { time: new Date(msg.created_at).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' }) }))}
          <dl>
            <dt>Estado</dt><dd><span class="badge ${st.cls}">${st.label}</span></dd>
            <dt>Preparado</dt><dd>${dateTimeIso(msg.created_at)}</dd>
            ${msg.sent_at ? html`<dt>Enviado</dt><dd>${dateTimeIso(msg.sent_at)}</dd>` : ''}
            ${msg.appointment ? html`<dt>Cita</dt><dd>${dateLongCap(msg.appointment.date)} · ${time(msg.appointment.start_min)}${msg.appointment.folio ? ' · ' + msg.appointment.folio : ''}</dd>` : ''}
            ${msg.error ? html`<dt>Error</dt><dd class="err-t">${msg.error}</dd>` : ''}
          </dl></div>`),
        footerHtml: String(html`${msg.appointment ? html`<button type="button" class="btn btn-ghost" data-go-appt>${raw(icon('calendar'))}Ver cita</button>` : ''}
          ${canMark ? html`<button type="button" class="btn btn-secondary" data-mark-sent>${raw(icon('check'))}Marcar enviado</button>` : ''}
          ${msg.to_phone && msg.status !== 'queued' ? html`<a class="btn btn-wa" data-reopen href="${waLinkFor(msg.to_phone, msg.body)}" target="_blank" rel="noopener">${raw(icon('whatsapp'))}Abrir en WhatsApp</a>` : ''}`)
      });
      m.foot.addEventListener('click', async (e) => {
        if (e.target.closest('[data-go-appt]')) { m.close(); navigate('/agenda', { query: { cita: msg.appointment.id } }); return; }
        if (e.target.closest('[data-reopen]')) { if (msg.status === 'prepared') markMessage(msg.id, 'opened').catch(() => {}); return; }
        const b = e.target.closest('[data-mark-sent]');
        if (b) {
          try { await busy(b, markMessage(msg.id, 'sent')); toast.success('Marcado como enviado'); m.close(); }
          catch (err) { toast.error(err); }
        }
      });
    }

    // ════════ PLANTILLAS ════════
    function templates() { const s = shop(); return (s && s.settings && s.settings.whatsapp && s.settings.whatsapp.templates) || {}; }
    function sampleVars() {
      const s = shop() || {};
      const booking = SITE_BASE + '?b=' + encodeURIComponent(s.slug || '');
      const review = (s.settings && s.settings.public && s.settings.public.review_url) || booking;
      return { cliente: 'Carlos', barberia: s.name || 'Tu barbería', fecha: dateLong(addDays(today(), 1)), hora: '5:30 p.m.', servicios: 'Corte clásico + Barba', barbero: 'Luis', total: '$350', folio: 'TB-1042', enlace: SITE_BASE + '?cita=…', direccion: s.address || '', resena: review };
    }
    function renderTemplates() {
      const cur = templates();
      const isCustom = (k) => (cur[k] || '') !== '' && cur[k] !== DEFAULT_TEMPLATES[k];
      const meta = TPL_KINDS.find((k) => k[0] === tplKind);
      const s = shop() || {};
      box.innerHTML = String(html`
        <div class="chips tpl-kinds" role="tablist" aria-label="Plantillas">${TPL_KINDS.map(([k, l]) => html`<button type="button" class="chip" role="tab" data-tpl="${k}" aria-selected="${String(k === tplKind)}" aria-pressed="${String(k === tplKind)}">${l}${isCustom(k) ? raw('<span class="dot" title="Personalizada"></span>') : ''}</button>`)}</div>
        <div class="tpl-grid">
          <section class="card card-pad tpl-edit" aria-labelledby="tplH">
            <div class="row between top"><div><h3 id="tplH">${meta[1]}</h3><p class="desc">${meta[2]}</p></div>${isCustom(tplKind) ? raw('<span class="badge brand plain">Personalizada</span>') : raw('<span class="badge plain">Predeterminada</span>')}</div>
            <div class="field"><label for="tplText" class="sr">Texto de la plantilla</label>
              <textarea class="textarea tpl-ta" id="tplText" maxlength="${String(MAX_BODY)}" spellcheck="true"></textarea>
              <div class="row between"><p class="hint">Toca una variable para insertarla donde está el cursor.</p><span class="wa-count faint" id="tplCount"></span></div>
              <p class="error"></p></div>
            <div class="chips tpl-vars" role="group" aria-label="Variables">${VARS.map(([v, l]) => html`<button type="button" class="chip" data-var="${v}" title="Insertar {${v}}">${l}<code>{${v}}</code></button>`)}</div>
            <div class="tpl-actions">
              <button type="button" class="btn btn-ghost" data-act="tpl-restore" ${isCustom(tplKind) ? '' : 'disabled'}>${raw(icon('refresh'))}Restaurar predeterminada</button>
              <div class="row"><span class="tpl-dirty" id="tplDirty" hidden>Sin guardar</span><button type="button" class="btn btn-primary" data-act="tpl-save" disabled>${raw(icon('check'))}Guardar</button></div>
            </div>
          </section>
          <section class="tpl-prev" aria-label="Vista previa">
            <span class="eyebrow">Vista previa con datos de ejemplo</span>
            <div class="phone"><div class="phone-top"><span class="avatar" style="--c:#25D366">${raw(icon('whatsapp', 'ic-sm'))}</span><div><b>${s.name || 'Tu barbería'}</b><span>Así lo recibe Carlos</span></div></div><div id="tplPrev"></div></div>
            <p class="faint" style="font-size:12.5px">Si un dato no existe (por ejemplo, la dirección), su línea se quita sola.</p>
          </section>
        </div>`);
      const ta = $('#tplText', box);
      ta.value = cur[tplKind] || DEFAULT_TEMPLATES[tplKind] || '';
      ta.dataset.orig = ta.value;
      tplDirty = false;
      paintTpl();
    }
    function paintTpl() {
      const ta = $('#tplText', box);
      if (!ta) return;
      const n = ta.value.length;
      const c = $('#tplCount', box);
      c.textContent = n + '/' + MAX_BODY;
      c.className = 'wa-count ' + (n > MAX_BODY * 0.9 ? 'warn' : 'faint');
      $('#tplPrev', box).innerHTML = bubbleHtml(renderTemplate(ta.value, sampleVars()), { time: '10:30' });
      tplDirty = ta.value.trim() !== (ta.dataset.orig || '').trim();
      $('#tplDirty', box).hidden = !tplDirty;
      $('[data-act="tpl-save"]', box).disabled = !tplDirty || !ta.value.trim();
    }
    async function saveTpl(btn, value, okMsg) {
      try {
        await busy(btn, api.patch('/shop', { settings: { whatsapp: { templates: { [tplKind]: value } } } }));
        tplDirty = false;
        toast.success(okMsg);
        await window.TB.refreshContext(); // vuelve a pintar la vista con el contexto nuevo (la pestaña queda en la URL)
      } catch (err) {
        const f = $('#tplText', box);
        if (f && err.fields) { const fld = f.closest('.field'); fld.classList.add('invalid'); fld.querySelector('.error').textContent = Object.values(err.fields)[0]; }
        toast.error(err);
      }
    }

    // ════════ AUTOMATIZACIÓN ════════
    async function renderAuto(my) {
      const s = shop() || {};
      const wa = (s.settings && s.settings.whatsapp) || {};
      const mode = wa.mode === 'auto' ? 'auto' : 'manual';
      const tpls = templates();
      const ready = TPL_KINDS.filter(([k]) => (tpls[k] || DEFAULT_TEMPLATES[k] || '').trim()).length;
      box.innerHTML = String(html`
        <div class="grid-2">
          <section class="card card-pad" aria-labelledby="auH">
            <h3 id="auH" style="font-size:16px">¿Cómo se envían tus mensajes?</h3>
            <p class="muted" style="font-size:13.5px;margin-top:2px">Puedes cambiarlo cuando quieras. Las plantillas son las mismas en ambos modos.</p>
            <div class="au-modes" role="radiogroup" aria-labelledby="auH">
              <button type="button" class="au-mode" role="radio" data-mode="manual" aria-checked="${String(mode === 'manual')}">
                <span class="ai">${raw(icon('smartphone'))}</span>
                <span class="grow"><b>Manual ${raw('<span class="badge ok plain">Recomendado para empezar</span>')}</b><p>Tocas "Enviar" y se abre WhatsApp con el mensaje listo; tú lo mandas desde tu teléfono. No requiere configuración.</p></span>
                <span class="radio" aria-hidden="true"></span></button>
              <button type="button" class="au-mode" role="radio" data-mode="auto" aria-checked="${String(mode === 'auto')}">
                <span class="ai">${raw(icon('zap'))}</span>
                <span class="grow"><b>Automático</b><p>Los mensajes entran a una cola y salen solos desde el número de tu barbería, con la API oficial de WhatsApp Business. Los recordatorios se programan ${String(wa.reminder_hours || 24)} h antes.</p></span>
                <span class="radio" aria-hidden="true"></span></button>
            </div>
          </section>
          <section class="card card-pad" aria-labelledby="auR">
            <div class="row between"><h3 id="auR" style="font-size:16px">Preparado para automatizar</h3><span id="auQ"></span></div>
            <div class="au-check" id="auCheck">
              <div><span class="st ok">${raw(icon('check'))}</span><span><b>Plantillas listas</b><span class="d">${String(ready)} de ${String(TPL_KINDS.length)} mensajes con texto. <button type="button" class="link-btn" data-tab-go="plantillas">Editarlas</button></span></span></div>
              <div><span class="st ok">${raw(icon('check'))}</span><span><b>Historial de cada mensaje</b><span class="d">Cada envío queda registrado con su estado: en cola, enviado o falló.</span></span></div>
              <div><span class="st ok">${raw(icon('check'))}</span><span><b>Cola de envío</b><span class="d" id="auQd">Revisando…</span></span></div>
              <div><span class="st wait">${raw(icon('clock'))}</span><span><b>Conectar WhatsApp Business</b><span class="d">Se conecta con la API oficial de WhatsApp Business (Meta) usando un número verificado de tu barbería. Nuestro equipo te ayuda a conectarlo; mientras tanto, usa el modo manual.</span></span></div>
            </div>
          </section>
        </div>
        <section class="section" aria-labelledby="auF">
          <div class="section-title" id="auF">Cómo funciona el envío automático</div>
          <div class="au-flow stagger">
            <div><span class="n">1</span><b>Se arma el mensaje</b><span>Con tu plantilla y los datos de la cita: nombre, fecha, hora, servicios y enlace.</span></div>
            <div><span class="n">2</span><b>Entra a la cola</b><span>Queda "En cola" en el historial. Los recordatorios se agregan solos cada día.</span></div>
            <div><span class="n">3</span><b>WhatsApp lo entrega</b><span>El conector de WhatsApp Business lo envía y lo marca como "Enviado" o "Falló".</span></div>
          </div>
        </section>`);
      try {
        const q = await api.get('/messages', { status: 'queued', limit: 500 });
        if (!alive(my)) return;
        const n = q.length;
        $('#auQd', box).innerHTML = String(n ? html`Hay <b>${number(n)}</b> ${n === 1 ? 'mensaje' : 'mensajes'} esperando en la cola. <button type="button" class="link-btn" data-go-queue>Ver cola</button>` : html`Vacía: no hay mensajes esperando.`);
        $('#auQ', box).innerHTML = String(n ? html`<span class="badge warn">${plural(n, 'en cola', 'en cola')}</span>` : '');
      } catch (err) { if (alive(my)) $('#auQd', box).textContent = 'No se pudo revisar la cola.'; }
    }
    async function setMode(mode, btn) {
      const cur = waMode();
      if (mode === cur) return;
      const ok = await confirmDialog(mode === 'auto'
        ? { title: '¿Activar el envío automático?', icon: 'zap', confirmText: 'Activar automático', message: 'Los mensajes ya no abrirán WhatsApp: quedarán en la cola hasta que el conector de WhatsApp Business los envíe. Si aún no está conectado, tus clientes no los recibirán.' }
        : { title: '¿Volver al envío manual?', icon: 'smartphone', confirmText: 'Usar modo manual', message: 'Al tocar "Enviar" se abrirá WhatsApp con el mensaje listo para que tú lo mandes. Los mensajes que ya están en la cola se quedan ahí.' });
      if (!ok) return;
      try {
        await busy(btn, api.patch('/shop', { settings: { whatsapp: { mode } } }));
        toast.success(mode === 'auto' ? 'Envío automático activado' : 'Envío manual activado');
        await window.TB.refreshContext();
      } catch (err) { toast.error(err); }
    }

    // ── Eventos ──
    const confirmLeaveTpl = async () => !tplDirty || confirmDialog({ title: '¿Descartar los cambios?', message: 'Tienes cambios sin guardar en esta plantilla.', confirmText: 'Descartar', danger: true, icon: 'edit' });
    const offs = [];
    offs.push(on(el, 'click', '[data-tab]', async (e, b) => {
      if (b.dataset.tab === tab) return;
      if (tab === 'plantillas' && !(await confirmLeaveTpl())) return;
      tab = b.dataset.tab; tplDirty = false; show();
    }));
    offs.push(on(el, 'keydown', '.tabs [role=tab]', (e, b) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const i = TABS.findIndex((x) => x[0] === b.dataset.tab), n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0];
      const nb = el.querySelector('.tabs [data-tab="' + n + '"]'); nb.focus(); nb.click();
    }));
    offs.push(on(el, 'click', '[data-tab-go]', (e, b) => { tab = b.dataset.tabGo; show(); }));
    offs.push(on(el, 'click', '#msgRetry', () => show()));
    // Recordatorios
    offs.push(on(el, 'click', '[data-day]', (e, b) => {
      const k = b.dataset.day;
      $$('[data-day]', el).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      const inp = $('#rmDate', el);
      if (k === 'otro') { inp.hidden = false; inp.focus(); if (inp.showPicker) { try { inp.showPicker(); } catch (err) { /* */ } } return; }
      inp.hidden = true;
      rmDate = k === 'hoy' ? today() : addDays(today(), 1);
      inp.value = rmDate;
      syncQuery();
      const res = $('#rmRes', el); if (res) res.innerHTML = String(html`<div class="card skel" style="height:118px;border:0;margin-bottom:14px"></div><div class="card">${skeletonRows(4)}</div>`);
      renderReminders(++seq, true);
    }));
    offs.push(on(el, 'change', '#rmDate', (e, i) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(i.value)) return;
      rmDate = i.value; syncQuery();
      renderReminders(++seq, true);
    }));
    offs.push(on(el, 'click', '[data-rm-send]', (e, b) => sendOne(b, b.dataset.rmSend)));
    offs.push(on(el, 'click', '[data-rm-edit]', (e, b) => editOne(b.dataset.rmEdit)));
    offs.push(on(el, 'click', '[data-act="seq"]', openSequence));
    offs.push(on(el, 'click', '[data-act="queue-all"]', (e, b) => queueAll(b)));
    // Historial
    offs.push(on(el, 'click', '[data-hs]', (e, b) => {
      histStatus = b.dataset.hs; histLimit = 60;
      $$('[data-hs]', el).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      syncQuery();
      const res = $('#hsRes', el); if (res) res.style.opacity = '.55';
      renderHistory(++seq, true).then(() => { const r2 = $('#hsRes', el); if (r2) r2.style.opacity = ''; });
    }));
    offs.push(on(el, 'click', '#hsAll', () => { const b = el.querySelector('[data-hs=""]'); if (b) b.click(); }));
    offs.push(on(el, 'click', '#hsGoRem', () => { tab = 'recordatorios'; show(); }));
    offs.push(on(el, 'click', '#hsMore', (e, b) => { histLimit = Math.min(500, histLimit + 100); busy(b, renderHistory(++seq, true)); }));
    offs.push(on(el, 'click', '[data-mid]', (e, b) => openMessage(b.dataset.mid)));
    offs.push(on(el, 'click', '[data-go-queue]', () => { tab = 'historial'; histStatus = 'queued'; show(); }));
    // Plantillas
    offs.push(on(el, 'click', '[data-tpl]', async (e, b) => {
      if (b.dataset.tpl === tplKind) return;
      if (!(await confirmLeaveTpl())) return;
      tplKind = b.dataset.tpl; syncQuery(); renderTemplates();
    }));
    offs.push(on(el, 'input', '#tplText', (e, ta) => { ta.closest('.field').classList.remove('invalid'); paintTpl(); }));
    offs.push(on(el, 'mousedown', '[data-var]', (e) => e.preventDefault())); // conserva el cursor del textarea
    offs.push(on(el, 'click', '[data-var]', (e, b) => {
      const ta = $('#tplText', el);
      if (!ta) return;
      const token = '{' + b.dataset.var + '}';
      const s = ta.selectionStart != null ? ta.selectionStart : ta.value.length, en = ta.selectionEnd != null ? ta.selectionEnd : ta.value.length;
      const before = ta.value.slice(0, s);
      const pad = before && !/\s$/.test(before) ? ' ' : '';
      ta.focus();
      ta.setRangeText(pad + token, s, en, 'end');
      paintTpl();
    }));
    offs.push(on(el, 'click', '[data-act="tpl-save"]', (e, b) => {
      const ta = $('#tplText', el);
      const v = ta.value.trim();
      if (!v) { const f = ta.closest('.field'); f.classList.add('invalid'); f.querySelector('.error').textContent = 'La plantilla no puede quedar vacía. Usa "Restaurar predeterminada".'; return; }
      saveTpl(b, v, 'Plantilla "' + TPL_KINDS.find((k) => k[0] === tplKind)[1] + '" guardada');
    }));
    offs.push(on(el, 'click', '[data-act="tpl-restore"]', async (e, b) => {
      const ok = await confirmDialog({ title: '¿Restaurar la plantilla original?', message: 'Se reemplaza tu texto por el mensaje predeterminado de TuBarbería.', confirmText: 'Restaurar', icon: 'refresh' });
      if (ok) saveTpl(b, '', 'Plantilla restaurada');
    }));
    // Automatización
    offs.push(on(el, 'click', '[data-mode]', (e, b) => setMode(b.dataset.mode, b)));
    // Refrescos desde otros lugares (p. ej. se envió un WhatsApp desde la agenda)
    offs.push(bus.on('messages:changed', () => { if (tab === 'historial') renderHistory(++seq, true); }));
    offs.push(bus.on('appointments:changed', () => { if (tab === 'recordatorios') renderReminders(++seq, true); }));
    const beforeUnload = (e) => { if (tab === 'plantillas' && tplDirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);

    show();
    return () => { offs.forEach((f) => f()); window.removeEventListener('beforeunload', beforeUnload); };
  }
};
