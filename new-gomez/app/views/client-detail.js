// Ficha del cliente (#/clientes/:id): cabecera con contacto y acciones, métricas, notas internas con
// autoguardado, historial de citas (abre el detalle de la cita), pagos y mensajes de WhatsApp.
// Barbero: la API ya limita la ficha a SUS citas y cobros; no ve "Eliminar" (clients.delete).
import { html, raw, $, on } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { bus, can, canAny, today } from '../lib/state.js';
import { navigate } from '../lib/router.js';
import { toast, menu, emptyState, errorState, avatar, statusBadge, animateNumber } from '../lib/ui.js';
import { money, number, relDay, dateNum, dateShort, timeRange, phone as fmtPhone, plural, firstName, diffDays, METHOD, SOURCE, MONTHS, ago } from '../lib/fmt.js';
import { openClientForm, clientActions, sinceText } from './clients.js';

const KIND = { confirmation: 'Confirmación', reminder: 'Recordatorio', reschedule: 'Reagenda', cancellation: 'Cancelación', thanks: 'Agradecimiento', no_show: 'No asistió', custom: 'Mensaje libre' };
const MSG_STATUS = { prepared: ['Preparado', 'plain'], opened: ['Abierto en WhatsApp', 'info'], sent: ['Enviado', 'ok'], queued: ['En cola', 'warn'], failed: ['Falló', 'err'] };
const METHOD_ICON = { cash: 'cash', card: 'card', transfer: 'transfer', other: 'wallet' };

const CSS = `
.cd-back{margin:4px 0 12px}
.cd-hero{padding:18px;display:grid;gap:16px;position:relative;overflow:hidden}
.cd-hero::before{content:"";position:absolute;inset:0 0 auto 0;height:84px;background:linear-gradient(135deg,var(--brand-soft),transparent 70%);pointer-events:none}
.cd-id{display:flex;gap:14px;align-items:center;position:relative;min-width:0}
.cd-id .avatar{--s:64px;box-shadow:0 0 0 4px var(--surface),var(--shadow-2)}
.cd-name{font-family:var(--disp);font-size:30px;font-weight:800;line-height:1.02;letter-spacing:.01em;word-break:break-word}
.cd-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}
.cd-contact{display:flex;gap:4px 14px;flex-wrap:wrap;margin-top:6px;font-size:13.5px;color:var(--text-2)}
.cd-contact span{display:inline-flex;align-items:center;gap:5px;min-width:0}
.cd-contact .ic{width:15px;height:15px;color:var(--text-3)}
.cd-actions{display:grid;grid-template-columns:1fr 1fr auto auto;gap:8px;position:relative}
.cd-actions .btn{min-width:0}
@media (min-width:720px){
  .cd-hero{grid-template-columns:minmax(0,1fr) auto;align-items:center;padding:22px 24px}
  .cd-hero::before{height:100%;background:linear-gradient(100deg,var(--brand-soft),transparent 55%)}
  .cd-id .avatar{--s:76px}
  .cd-name{font-size:36px}
  .cd-actions{display:flex}
}
.cd-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:var(--border);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;margin-top:12px}
.cd-fact{background:var(--surface);padding:12px 14px;display:grid;gap:2px;min-width:0}
.cd-fact .k{font-size:12px;color:var(--text-3);font-weight:500;display:flex;align-items:center;gap:5px}
.cd-fact .k .ic{width:14px;height:14px}
.cd-fact .v{font-weight:600;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cd-fact .s{font-size:12px;color:var(--text-2)}
@media (min-width:900px){.cd-facts{grid-template-columns:repeat(4,minmax(0,1fr))}}
.cd-kpis{margin-top:12px}
@media (min-width:720px){.cd-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media (max-width:719px){.cd-kpis{gap:10px}.cd-kpis .kpi{padding:12px 14px}.cd-kpis .kpi .value{font-size:26px}}
.cd-grid{margin-top:16px}
@media (max-width:899px){.cd-grid{display:flex;flex-direction:column}.cd-side{display:contents}.cd-side>.cd-bday{order:-3}.cd-side>.cd-notes{order:-2}.cd-side>.cd-contact-card{order:1}}
.cd-tabs{padding:0 12px;margin:0}
.cd-panel{min-height:120px}
.cd-group{padding:12px 16px 6px;font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);background:var(--surface-2);border-bottom:1px solid var(--border)}
.cd-appt{align-items:center}
.cd-date{width:46px;flex:none;display:grid;justify-items:center;line-height:1.05;padding:6px 0;border-radius:12px;background:var(--surface-3)}
.cd-date b{font-family:var(--disp);font-size:21px;font-weight:800}
.cd-date small{font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-2)}
.cd-date.up{background:var(--info-soft);color:var(--info)}
.cd-date.up small{color:inherit}
.cd-appt .title{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cd-appt .meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:2px}
.cd-appt .trail{flex-direction:column;align-items:flex-end;gap:4px}
.cd-appt .amt{font-weight:700;font-variant-numeric:tabular-nums;font-size:14px}
.cd-ic{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--surface-3);color:var(--text-2);flex:none}
.cd-ic.wa{background:rgba(37,211,102,.14);color:#1C9E4E}
.cd-msg .body{font-size:13px;color:var(--text-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-line;margin-top:2px}
.cd-notes textarea{min-height:140px;background:var(--surface-2)}
.cd-save{font-size:12.5px;color:var(--text-3);display:inline-flex;align-items:center;gap:5px;min-height:22px;transition:color .2s}
.cd-save .ic{width:14px;height:14px}
.cd-save.ok{color:var(--ok)}.cd-save.err{color:var(--err)}
.cd-save .spinner{width:12px;height:12px;border-width:2px}
.cd-info{display:grid;gap:0}
.cd-info>div{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);font-size:13.5px}
.cd-info>div:last-child{border-bottom:0}
.cd-info dt{color:var(--text-2)}
.cd-info dd{font-weight:600;text-align:right;min-width:0;overflow-wrap:anywhere}
.cd-bday{display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:var(--r);background:var(--brand-soft);border:1px solid rgba(196,154,60,.28)}
.cd-bday .ic{width:22px;height:22px;color:var(--brand-strong);flex:none}
.cd-skel-hero{height:150px}
`;

const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
function injectCss() { if (!document.getElementById('st-client-detail')) document.head.insertAdjacentHTML('beforeend', '<style id="st-client-detail">' + CSS + '</style>'); }

// Próximo cumpleaños: { days, age, label }
function birthdayInfo(b, t) {
  if (!b) return null;
  const [y, mo, d] = b.split('-').map(Number);
  const ty = Number(t.slice(0, 4));
  let next = ty + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  if (mo === 2 && d === 29 && !((ty % 4 === 0 && ty % 100 !== 0) || ty % 400 === 0)) next = ty + '-03-01';
  let days = diffDays(t, next);
  let turns = ty - y;
  if (days < 0) { days = diffDays(t, (ty + 1) + next.slice(4)); turns++; }
  return { days, turns, label: d + ' de ' + MONTHS[mo - 1] };
}

export default {
  title: 'Cliente',
  async render(el, { params }) {
    injectCss();
    const id = params.id;
    const t0 = today();
    const st = { data: null, tab: 'citas', notesSaved: null, notesTimer: null, saving: null };
    el.innerHTML = String(html`
      <div class="cd-back"><a class="link-btn" href="#/clientes">${raw(icon('arrow-left', 'ic-sm'))}Clientes</a></div>
      <div id="cdRoot">
        <div class="card skel cd-skel-hero" style="border:0"></div>
        <div class="kpis cd-kpis">${raw('<div class="card skel" style="height:92px;border:0"></div>'.repeat(4))}</div>
        <div class="card skel" style="height:280px;border:0;margin-top:16px"></div>
      </div>`);
    const root = $('#cdRoot', el);

    async function load(quiet) {
      try {
        const d = await api.get('/clients/' + encodeURIComponent(id));
        st.data = d;
        if (st.notesSaved === null || !quiet) st.notesSaved = d.client.notes || '';
        paint(quiet);
      } catch (e) {
        if (quiet) { toast.error(e); return; }
        root.innerHTML = String(e.status === 404
          ? emptyState({ icon: 'users', title: 'No encontramos a este cliente', text: 'Puede que lo hayan eliminado o que no tengas acceso a su ficha.', action: { label: 'Volver a clientes', href: '#/clientes', icon: 'arrow-left' } })
          : errorState(e, 'cdRetry'));
      }
    }

    function setTopTitle(name) {
      const h = document.getElementById('tbTitle');
      if (h) h.textContent = firstName(name) || 'Cliente';
      document.title = name + ' · Clientes';
    }

    function paint(quiet) {
      const { client: c, appointments, payments, messages } = st.data;
      const s = c.stats || {};
      setTopTitle(c.name);
      const bd = birthdayInfo(c.birthday, t0);
      const upcoming = appointments.filter((a) => a.date >= t0 && (a.status === 'pending' || a.status === 'confirmed')).sort((a, b) => (a.date === b.date ? a.start_min - b.start_min : a.date < b.date ? -1 : 1));
      const past = appointments.filter((a) => !upcoming.includes(a));
      const since = s.first_visit && s.first_visit < String(c.created_at || '').slice(0, 10) ? s.first_visit : String(c.created_at || '').slice(0, 10);
      const canWa = can('messages.send');
      const canAppt = canAny(['appointments.write.all', 'appointments.write.own']);
      const focused = document.activeElement && document.activeElement.id === 'cdNotes';
      if (quiet && focused) { paintPanels(upcoming, past, payments, messages); paintKpis(s, true); return; }
      root.innerHTML = String(html`
        <section class="card cd-hero fade-up">
          <div class="cd-id">
            ${avatar(c.name, { size: 'xl' })}
            <div class="grow">
              <h2 class="cd-name">${c.name}</h2>
              ${(c.tags || []).length || c.marketing_ok === false ? html`<div class="cd-tags">${(c.tags || []).map((t) => html`<span class="tag">${t}</span>`)}${c.marketing_ok === false ? html`<span class="badge plain" title="No acepta mensajes de promoción">${raw(icon('ban', 'ic-sm'))}Sin promociones</span>` : ''}</div>` : ''}
              <div class="cd-contact">
                ${c.phone ? html`<span>${raw(icon('phone'))}<span class="num">${fmtPhone(c.phone)}</span></span>` : html`<span class="faint">${raw(icon('phone'))}Sin teléfono</span>`}
                ${c.email ? html`<span class="truncate">${raw(icon('mail'))}${c.email}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="cd-actions">
            ${canAppt ? html`<button type="button" class="btn btn-primary" data-act="appt">${raw(icon('calendar-plus'))}Nueva cita</button>` : ''}
            ${canWa ? html`<button type="button" class="btn btn-wa" data-act="wa" ${c.phone ? '' : raw('aria-disabled="true"')}>${raw(icon('whatsapp'))}WhatsApp</button>` : ''}
            ${c.phone ? html`<a class="btn btn-secondary btn-icon" href="tel:${c.phone}" aria-label="Llamar a ${c.name}" title="Llamar">${raw(icon('phone'))}</a>` : ''}
            ${can('clients.write') || can('clients.delete') ? html`<button type="button" class="btn btn-secondary btn-icon" data-act="more" aria-label="Más acciones" aria-haspopup="menu">${raw(icon('more'))}</button>` : ''}
          </div>
        </section>

        <div class="cd-facts fade-up">
          <div class="cd-fact"><span class="k">${raw(icon('clock'))}Última visita</span><span class="v">${s.last_visit ? cap(sinceText(s.last_visit, t0)) : 'Sin visitas'}</span><span class="s">${s.last_visit ? dateShort(s.last_visit) : 'Aún no lo atienden'}</span></div>
          <div class="cd-fact"><span class="k">${raw(icon('calendar'))}Próxima cita</span><span class="v ${s.next_visit ? 'brand-t' : ''}">${s.next_visit ? relDay(s.next_visit, t0) : 'Sin agendar'}</span><span class="s">${upcoming[0] ? timeRange(upcoming[0].start_min, upcoming[0].end_min) + ' · ' + firstName(upcoming[0].staff_name) : 'Agéndale su siguiente visita'}</span></div>
          <div class="cd-fact"><span class="k">${raw(icon('star'))}Cliente desde</span><span class="v">${since ? dateNum(since) : '—'}</span><span class="s">${SOURCE[c.source] ? 'Origen: ' + SOURCE[c.source].toLowerCase() : ''}</span></div>
          <div class="cd-fact"><span class="k">${raw(icon('cake'))}Cumpleaños</span><span class="v">${bd ? bd.label : 'Sin registrar'}</span><span class="s">${bd ? (bd.days === 0 ? '¡Es hoy! Cumple ' + bd.turns : bd.days <= 30 ? 'En ' + plural(bd.days, 'día') : 'Cumplirá ' + bd.turns) : can('clients.write') ? 'Agrégalo al editar' : ''}</span></div>
        </div>

        <div class="kpis cd-kpis" id="cdKpis"></div>

        <div class="grid-main-side cd-grid">
          <section class="card" aria-label="Historial">
            <div class="tabs cd-tabs" role="tablist">
              <button type="button" role="tab" data-tab="citas" aria-selected="${String(st.tab === 'citas')}">Citas <span class="faint">${appointments.length}</span></button>
              <button type="button" role="tab" data-tab="pagos" aria-selected="${String(st.tab === 'pagos')}">Pagos <span class="faint">${payments.length}</span></button>
              ${canWa ? html`<button type="button" role="tab" data-tab="mensajes" aria-selected="${String(st.tab === 'mensajes')}">Mensajes <span class="faint">${messages.length}</span></button>` : ''}
            </div>
            <div class="cd-panel" id="cdPanel" role="tabpanel"></div>
          </section>
          <div class="stack cd-side">
            ${bd && bd.days <= 7 ? html`<div class="cd-bday fade-up">${raw(icon('cake'))}<div class="grow"><b>${bd.days === 0 ? '¡Hoy cumple ' + bd.turns + ' años!' : 'Cumple ' + bd.turns + ' en ' + plural(bd.days, 'día')}</b><div class="muted" style="font-size:13px">Buen momento para mandarle una felicitación.</div></div></div>` : ''}
            <section class="card card-pad cd-notes">
              <div class="row between" style="margin-bottom:8px"><label for="cdNotes" class="label" style="font-size:14.5px">Notas internas</label><span class="cd-save" id="cdSave" aria-live="polite"></span></div>
              ${can('clients.write')
                ? html`<textarea class="textarea" id="cdNotes" maxlength="1000" placeholder="Cómo le gusta su corte, alergias, temas de plática…">${c.notes || ''}</textarea><p class="faint" style="font-size:12px;margin-top:6px">Se guardan solas · solo las ve tu equipo.</p>`
                : html`<p class="${c.notes ? '' : 'faint'}" style="white-space:pre-line;font-size:14px">${c.notes || 'Sin notas.'}</p>`}
            </section>
            <section class="card card-pad cd-contact-card">
              <h3 style="font-size:14.5px;font-weight:600;margin-bottom:4px">Datos de contacto</h3>
              <dl class="cd-info">
                <div><dt>Teléfono</dt><dd class="num">${c.phone ? fmtPhone(c.phone) : '—'}</dd></div>
                <div><dt>Correo</dt><dd>${c.email || '—'}</dd></div>
                <div><dt>Mensajes y promociones</dt><dd class="${c.marketing_ok === false ? 'faint' : 'ok-t'}">${c.marketing_ok === false ? 'No acepta' : 'Acepta'}</dd></div>
                <div><dt>Cuenta en línea</dt><dd>${c.user_id ? 'Sí, reserva con su cuenta' : 'No'}</dd></div>
              </dl>
              ${can('clients.write') ? html`<button type="button" class="btn btn-ghost btn-sm btn-block" data-act="edit" style="margin-top:8px">${raw(icon('edit'))}Editar datos</button>` : ''}
            </section>
          </div>
        </div>`);
      paintKpis(s, false);
      paintPanels(upcoming, past, payments, messages);
      paintSave();
    }

    function paintKpis(s, quiet) {
      const k = $('#cdKpis', root);
      if (!k) return;
      k.innerHTML = String(html`
        <div class="card kpi"><span class="label">${raw(icon('check-circle'))}Visitas</span><span class="value" data-n="${s.visits || 0}" data-f="n">${number(s.visits || 0)}</span><span class="foot">${s.cancelled ? plural(s.cancelled, 'cancelada') : 'Citas atendidas'}</span></div>
        <div class="card kpi"><span class="label">${raw(icon('wallet'))}Gastado</span><span class="value" data-n="${s.total_spent || 0}" data-f="m">${money(s.total_spent || 0)}</span><span class="foot">Sin propinas</span></div>
        <div class="card kpi"><span class="label">${raw(icon('receipt'))}Ticket promedio</span><span class="value" data-n="${s.avg_ticket || 0}" data-f="m">${money(s.avg_ticket || 0)}</span><span class="foot">Por visita</span></div>
        <div class="card kpi"><span class="label">${raw(icon('x-circle'))}No asistió</span><span class="value ${s.no_shows ? 'err-t' : ''}" data-n="${s.no_shows || 0}" data-f="n">${number(s.no_shows || 0)}</span><span class="foot">${s.no_shows ? (s.no_shows >= 2 ? 'Conviene confirmarle antes' : 'Una vez') : 'Siempre llega'}</span></div>`);
      if (!quiet) k.querySelectorAll('[data-n]').forEach((v) => animateNumber(v, Number(v.dataset.n), v.dataset.f === 'm' ? money : number));
    }

    function apptItem(a, up) {
      const svc = (a.services || []).map((x) => x.name).join(' + ') || 'Cita';
      const d = a.date.split('-');
      return html`<button type="button" class="list-item cd-appt" data-appt="${a.id}">
        <span class="cd-date ${up ? 'up' : ''}"><b>${Number(d[2])}</b><small>${dateShort(a.date).split(' ')[2]}</small>${d[0] !== t0.slice(0, 4) ? html`<small>${d[0]}</small>` : ''}</span>
        <span class="grow" style="min-width:0">
          <span class="title">${svc}</span>
          <span class="meta"><span class="dot" style="background:${a.staff_color || 'var(--text-3)'}"></span>${firstName(a.staff_name)} · ${up ? relDay(a.date, t0) + ' · ' : ''}${timeRange(a.start_min, a.end_min)}</span>
        </span>
        <span class="trail"><span class="amt">${money(a.total)}</span>${statusBadge(a.status)}</span>
      </button>`;
    }

    function paintPanels(upcoming, past, payments, messages) {
      const p = $('#cdPanel', root);
      if (!p) return;
      const c = st.data.client;
      const canAppt = canAny(['appointments.write.all', 'appointments.write.own']);
      if (st.tab === 'citas') {
        p.innerHTML = String(!upcoming.length && !past.length
          ? emptyState({ icon: 'calendar', title: 'Sin citas todavía', text: 'Cuando ' + firstName(c.name) + ' reserve o le agendes una cita, aparecerá aquí con su historial.', action: canAppt ? { label: 'Agendar su primera cita', id: 'cdFirstAppt', icon: 'calendar-plus' } : null, compact: true })
          : html`<div class="list">
              ${upcoming.length ? html`<div class="cd-group">Próximas · ${upcoming.length}</div>${upcoming.map((a) => apptItem(a, true))}` : ''}
              ${past.length ? html`<div class="cd-group">Historial · ${past.length}</div>${past.map((a) => apptItem(a, false))}` : ''}
            </div>`);
      } else if (st.tab === 'pagos') {
        p.innerHTML = String(!payments.length
          ? emptyState({ icon: 'wallet', title: 'Sin pagos registrados', text: 'Los cobros de sus citas aparecerán aquí con el método y la propina.', compact: true })
          : html`<div class="list">${payments.map((x) => html`<div class="list-item">
              <span class="cd-ic">${raw(icon(METHOD_ICON[x.method] || 'wallet'))}</span>
              <span class="grow" style="min-width:0"><span class="title" style="display:block">${x.concept || METHOD[x.method] || 'Pago'}</span>
                <span class="meta">${x.date ? relDay(x.date, t0) : ''} · ${METHOD[x.method] || x.method}${x.tip ? ' · propina ' + money(x.tip) : ''}</span></span>
              <span class="trail" style="flex-direction:column;align-items:flex-end;gap:4px"><b class="num ${x.status === 'refunded' ? 'faint' : ''}" style="${x.status === 'refunded' ? 'text-decoration:line-through' : ''}">${money(x.amount)}</b>${x.status === 'refunded' ? html`<span class="badge err">Reembolsado</span>` : ''}</span>
            </div>`)}</div>`);
      } else {
        p.innerHTML = String(!messages.length
          ? emptyState({ icon: 'whatsapp', title: 'Aún no le has escrito', text: 'Los recordatorios, confirmaciones y mensajes que le mandes por WhatsApp quedan registrados aquí.', action: c.phone ? { label: 'Escribirle por WhatsApp', id: 'cdFirstWa', icon: 'whatsapp' } : null, compact: true })
          : html`<div class="list">${messages.map((m) => {
              const ms = MSG_STATUS[m.status] || [m.status, 'plain'];
              return html`<div class="list-item cd-msg" style="align-items:flex-start">
                <span class="cd-ic wa">${raw(icon('whatsapp'))}</span>
                <span class="grow" style="min-width:0">
                  <span class="row between" style="gap:8px"><span class="title">${KIND[m.kind] || 'Mensaje'}</span><span class="faint" style="font-size:12px;white-space:nowrap">${m.created_at ? ago(m.created_at) : ''}</span></span>
                  <span class="body">${m.body}</span>
                  <span class="badge ${ms[1]}" style="margin-top:6px">${ms[0]}</span>
                </span></div>`;
            })}</div>`);
      }
    }

    // ── Notas con autoguardado ──
    function paintSave(state, msg) {
      const s = $('#cdSave', root);
      if (!s) return;
      s.className = 'cd-save' + (state === 'ok' ? ' ok' : state === 'err' ? ' err' : '');
      s.innerHTML = state === 'saving' ? '<span class="spinner"></span>Guardando…'
        : state === 'ok' ? icon('check') + 'Guardado'
        : state === 'err' ? icon('alert') + (msg || 'No se guardó') + ' · <button type="button" class="link-btn" data-act="notes-retry">Reintentar</button>'
        : state === 'typing' ? 'Sin guardar…' : '';
    }
    async function saveNotes() {
      clearTimeout(st.notesTimer);
      const ta = $('#cdNotes', root);
      if (!ta) return;
      const val = ta.value;
      if (val.trim() === (st.notesSaved || '').trim()) { paintSave(st.saving ? 'saving' : ''); return; }
      paintSave('saving');
      const p = api.patch('/clients/' + encodeURIComponent(id), { notes: val });
      st.saving = p;
      try {
        const r = await p;
        st.notesSaved = val;
        if (st.data) st.data.client.notes = r.notes;
        if (st.saving === p) paintSave('ok');
      } catch (e) {
        paintSave('err', e.status === 0 ? 'Sin conexión' : 'No se guardó');
      } finally { if (st.saving === p) st.saving = null; }
    }

    // ── Eventos ──
    const offs = [];
    offs.push(on(el, 'click', '#cdRetry', () => load(false)));
    offs.push(on(el, 'click', '[data-tab]', (e, b) => {
      st.tab = b.dataset.tab;
      el.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      const { appointments, payments, messages } = st.data;
      const upcoming = appointments.filter((a) => a.date >= t0 && (a.status === 'pending' || a.status === 'confirmed')).sort((a, b2) => (a.date === b2.date ? a.start_min - b2.start_min : a.date < b2.date ? -1 : 1));
      paintPanels(upcoming, appointments.filter((a) => !upcoming.includes(a)), payments, messages);
    }));
    offs.push(on(el, 'click', '[data-appt]', async (e, b) => {
      try {
        const m = await import('../lib/appointment-sheet.js');
        await m.openAppointment(b.dataset.appt); // los cambios llegan por bus 'appointments:changed'
      } catch (err) { toast.error('No se pudo abrir la cita.'); }
    }));
    offs.push(on(el, 'click', '[data-act="appt"],#cdFirstAppt', () => clientActions.newAppointment(st.data.client)));
    offs.push(on(el, 'click', '[data-act="wa"],#cdFirstWa', () => clientActions.whatsapp(st.data.client)));
    offs.push(on(el, 'click', '[data-act="edit"]', () => edit()));
    offs.push(on(el, 'click', '[data-act="notes-retry"]', () => saveNotes()));
    offs.push(on(el, 'click', '[data-act="more"]', (e, b) => {
      const c = st.data.client;
      menu(b, [
        can('clients.write') && { label: 'Editar datos', icon: 'edit', onClick: edit },
        c.phone && { label: 'Copiar teléfono', icon: 'copy', onClick: () => import('../lib/ui.js').then((u) => u.copyText(c.phone, 'Teléfono copiado')) },
        can('clients.delete') && { sep: true },
        can('clients.delete') && { label: 'Eliminar cliente', icon: 'trash', danger: true, onClick: async () => {
          if (await clientActions.remove(c)) navigate('/clientes', { replace: true });
        } }
      ]);
    }));
    async function edit() {
      const r = await openClientForm(st.data.client);
      if (r) load(true);
    }
    offs.push(on(el, 'input', '#cdNotes', () => {
      paintSave('typing');
      clearTimeout(st.notesTimer);
      st.notesTimer = setTimeout(saveNotes, 900);
    }));
    offs.push(on(el, 'focusout', '#cdNotes', () => saveNotes()));
    offs.push(bus.on('appointments:changed', () => load(true)));
    offs.push(bus.on('payments:changed', () => load(true)));
    offs.push(bus.on('messages:changed', () => load(true)));

    await load(false);
    return () => {
      offs.forEach((f) => f());
      // Si quedó texto sin guardar, se guarda al salir (sin esperar).
      const ta = $('#cdNotes', root);
      if (ta && ta.value.trim() !== (st.notesSaved || '').trim()) {
        clearTimeout(st.notesTimer);
        api.patch('/clients/' + encodeURIComponent(id), { notes: ta.value }).then(() => toast.success('Notas guardadas')).catch((e) => toast.error(e));
      }
    };
  }
};
