// Horarios (#/horarios): editor semanal por barbero (el dueño elige con chips; el barbero ve el suyo),
// días abiertos/cerrados con varios bloques (p. ej. 10:00–14:00 y 15:00–20:00), validación de traslapes,
// copiar a días hábiles, resumen en barras y descansos/vacaciones (time_off) con alta y baja.
import { html, raw, $, on, formData } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { bus, can, getStaff, me, role, today, shop } from '../lib/state.js';
import { setQuery } from '../lib/router.js';
import { toast, modal, confirmDialog, menu, busy, emptyState, errorState, avatar, showFieldErrors, clearFieldErrors } from '../lib/ui.js';
import { time as fmtTime, dateShort, relDay, diffDays, plural, firstName, WEEKDAYS } from '../lib/fmt.js';
import { timeSelect } from '../lib/timefield.js';

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // lunes primero
const DAY = (d) => WEEKDAYS[d].charAt(0).toUpperCase() + WEEKDAYS[d].slice(1);
const DAY_S = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MAX_BLOCKS = 8;
const REASONS = ['Vacaciones', 'Día festivo', 'Cita médica', 'Curso', 'Asunto personal'];

const CSS = `
.av-staff{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:2px 2px 4px;margin:0 -2px 14px;-webkit-overflow-scrolling:touch}
.av-staff::-webkit-scrollbar{display:none}
.av-staff .chip{flex:none;min-height:44px;padding:0 14px 0 6px;gap:8px;font-size:14px}
.av-staff .chip .avatar{--s:30px;font-size:11px}
.av-staff .chip small{font-size:11px;opacity:.7;font-weight:500}
.av-grid{display:grid;gap:16px}
@media (min-width:1100px){.av-grid{grid-template-columns:minmax(0,1fr) 360px;align-items:start}.av-side{position:sticky;top:calc(var(--topbar-h) + 12px)}}
.av-ed{overflow:visible;min-width:0}
#avBar{display:contents}
.av-ed .card-head{padding:16px 18px 12px;border-bottom:1px solid var(--border)}
.av-day{display:grid;gap:8px;padding:12px 12px 12px 16px;border-bottom:1px solid var(--border);transition:background .2s}
.av-day:last-of-type{border-bottom:0}
#avDays .av-day:last-child{border-radius:0 0 var(--r-lg) var(--r-lg)}
.av-day.closed{background:var(--surface-2)}
.av-day.bad{background:var(--err-soft)}
.av-dh{display:flex;align-items:center;gap:10px;min-height:44px}
.av-dh .switch{min-height:44px;gap:12px}
.av-dname{font-weight:600;font-size:15px;min-width:92px}
.av-dsum{font-size:12.5px;color:var(--text-3);margin-left:auto;white-space:nowrap}
.av-ranges{display:grid;gap:8px;padding-left:54px}
.av-range{display:flex;align-items:center;gap:8px;animation:fadeUp .25s var(--ease-out)}
.av-range .input{width:0;flex:1;min-width:0;max-width:150px;font-variant-numeric:tabular-nums;text-align:center;padding:8px 10px}
.av-range .to{color:var(--text-3);font-size:13px}
.av-range .input.err{border-color:var(--err);box-shadow:0 0 0 3px var(--err-soft)}
.av-add{justify-self:start;min-height:36px}
.av-closed{padding-left:54px;font-size:13px;color:var(--text-3)}
.av-err{padding-left:54px;font-size:12.5px;color:var(--err);font-weight:500;display:flex;gap:6px;align-items:center}
.av-err .ic{width:15px;height:15px}
@media (max-width:519px){.av-ranges,.av-closed,.av-err{padding-left:0}.av-dname{min-width:0}.av-range .input{max-width:none}}
@media (min-width:720px){
  .av-day{grid-template-columns:250px minmax(0,1fr);column-gap:16px;align-items:start;padding:12px 16px}
  .av-dh{grid-column:1;grid-row:1 / span 2}
  .av-ranges,.av-closed,.av-err{grid-column:2;padding-left:0}
  .av-closed{min-height:44px;display:flex;align-items:center}
}
.av-savebar{position:sticky;bottom:calc(var(--bottomnav-h) + var(--safe-b) + 10px);z-index:5;display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 10px 10px;padding:10px 10px 10px 16px;border-radius:var(--r-lg);background:var(--ink);color:var(--on-ink);box-shadow:var(--shadow-3);animation:toastIn .3s var(--ease-out)}
@media (min-width:1024px){.av-savebar{bottom:16px}}
.av-savebar .grow{font-size:13.5px;font-weight:500;min-width:0}
.av-savebar .lg{display:none}
@media (min-width:520px){.av-savebar .lg{display:inline}}
.av-savebar .btn-ghost{color:var(--on-ink)}
.av-savebar .btn-ghost:hover{background:rgba(255,255,255,.1);color:#fff}
.av-sum .card-body{padding-top:6px}
.av-tot{display:flex;gap:18px;margin-bottom:12px}
.av-tot div{display:grid}
.av-tot b{font-family:var(--disp);font-size:28px;font-weight:800;line-height:1.05}
.av-tot span{font-size:12px;color:var(--text-3)}
.av-bars{display:grid;gap:7px}
.av-bar{display:grid;grid-template-columns:34px 1fr 44px;gap:8px;align-items:center;font-size:12px}
.av-bar .d{font-weight:600;color:var(--text-2)}
.av-bar .t{position:relative;height:14px;border-radius:5px;background:var(--surface-3);overflow:hidden}
.av-bar .t i{position:absolute;top:0;bottom:0;border-radius:4px;background:var(--brand);transition:left .3s var(--ease-out),width .3s var(--ease-out)}
.av-bar .t i.off{background:repeating-linear-gradient(135deg,var(--err-soft) 0 4px,transparent 4px 8px);border:1px solid var(--err);opacity:.8}
.av-bar .h{text-align:right;color:var(--text-3);font-variant-numeric:tabular-nums}
.av-bar.closed .d{color:var(--text-3)}
.av-ticks{display:grid;grid-template-columns:34px 1fr 44px;gap:8px;font-size:10.5px;color:var(--text-3);margin-top:4px}
.av-ticks .r{position:relative;height:14px}
.av-ticks .r span{position:absolute;transform:translateX(-50%)}
.av-to .list-item{align-items:flex-start;padding:12px 14px}
.av-to .ico{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--warn-soft);color:var(--warn);flex:none}
.av-to .ico.shop{background:var(--info-soft);color:var(--info)}
.av-to .title{display:block}
.av-to .meta{display:block;margin-top:1px}
#tfForm .field{align-content:start}
.tf-days{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.tf-times{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.tf-sw{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--r);background:var(--surface-2);font-size:14px!important;font-weight:400!important}
.tf-sw .lbl{display:grid;font-weight:600}
.tf-sw small{font-size:12.5px;color:var(--text-3);font-weight:400}
`;
function injectCss() { if (!document.getElementById('st-availability')) document.head.insertAdjacentHTML('beforeend', '<style id="st-availability">' + CSS + '</style>'); }

// 'HH:MM' ⇄ minutos. El fin de día (1440) se muestra como 23:59 (así lo guardaba <input type=time>, que no admite
// 24:00). Las horas se eligen con timeSelect (24 h, como el resto del panel), no con el <input type=time> nativo.
const toHHMM = (m) => (m >= 1440 ? '23:59' : fmtTime(m));
function toMin(v, isEnd) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(v || ''));
  if (!m) return null;
  const n = Number(m[1]) * 60 + Number(m[2]);
  if (isEnd && n === 1439) return 1440;
  return n >= 0 && n <= 1440 ? n : null;
}
const hoursText = (min) => { const h = Math.floor(min / 60), r = min % 60; return r ? h + ' h ' + r : h + ' h'; };

// Estado editable ← semana de la API
function toModel(week) {
  const out = {};
  for (let d = 0; d < 7; d++) {
    const list = (week && (week[d] || week[String(d)])) || [];
    out[d] = { open: list.length > 0, ranges: list.map(([s, e]) => ({ s: toHHMM(s), e: toHHMM(e) })) };
  }
  return out;
}
// Valida un día → { blocks:[[s,e]], error, bad:Set(idx) }
function checkDay(day) {
  if (!day.open) return { blocks: [], error: null, bad: new Set() };
  const bad = new Set();
  const blocks = [];
  if (!day.ranges.length) return { blocks: [], error: 'Agrega al menos un horario o marca el día como cerrado.', bad };
  if (day.ranges.length > MAX_BLOCKS) return { blocks: [], error: 'Máximo ' + MAX_BLOCKS + ' horarios por día.', bad };
  let error = null;
  day.ranges.forEach((r, i) => {
    const s = toMin(r.s, false), e = toMin(r.e, true);
    if (s == null || e == null) { bad.add(i); error = error || 'Completa la hora de entrada y de salida.'; return; }
    if (s >= e) { bad.add(i); error = error || 'La salida (' + r.e + ') debe ser después de la entrada (' + r.s + ').'; return; }
    blocks.push([s, e, i]);
  });
  const sorted = blocks.slice().sort((a, b) => a[0] - b[0]);
  for (let k = 1; k < sorted.length; k++) {
    if (sorted[k][0] < sorted[k - 1][1]) {
      bad.add(sorted[k][2]); bad.add(sorted[k - 1][2]);
      error = error || 'Los horarios ' + toHHMM(sorted[k - 1][0]) + '–' + toHHMM(sorted[k - 1][1]) + ' y ' + toHHMM(sorted[k][0]) + '–' + toHHMM(sorted[k][1]) + ' se traslapan.';
    }
  }
  return { blocks: sorted.map(([s, e]) => [s, e]), error, bad };
}
const weekOf = (model) => { const w = {}; for (let d = 0; d < 7; d++) w[d] = checkDay(model[d]).blocks; return w; };
const sig = (model) => JSON.stringify(ORDER.map((d) => (model[d].open ? checkDay(model[d]).blocks.map((b) => b.join('-')).join(',') + (checkDay(model[d]).error ? '!' + model[d].ranges.map((r) => r.s + r.e).join() : '') : 'x')));

// ── Hoja de descanso ─────────────────────────────────────────────────────
function openTimeOffForm({ staff, staffId, isOwner }) {
  const t0 = today();
  const body = html`
    <form id="tfForm" class="stack" novalidate autocomplete="off">
      ${isOwner ? html`<div class="field"><label for="tfWho">¿Para quién?</label>
        <select class="select" id="tfWho" name="staff_id">
          ${staff.map((s) => html`<option value="${s.id}" ${s.id === staffId ? 'selected' : ''}>${s.name}</option>`)}
          <option value="__shop">Toda la barbería (día festivo o cierre)</option>
        </select>
        <p class="hint" id="tfWhoHint">Nadie podrá reservar con esta persona en esas fechas.</p>
        <p class="error">Elige a quién aplica.</p></div>` : ''}
      <div class="tf-days">
        <div class="field"><label for="tfFrom">Desde</label><input class="input" type="date" id="tfFrom" name="date_from" min="${t0}" value="${t0}"/><p class="error">Elige la fecha de inicio.</p></div>
        <div class="field"><label for="tfTo">Hasta</label><input class="input" type="date" id="tfTo" name="date_to" min="${t0}" value="${t0}"/><p class="error">Revisa la fecha final.</p></div>
      </div>
      <div class="field"><label class="switch tf-sw" for="tfAll"><span class="lbl">Todo el día<small>Apágalo para bloquear solo unas horas (p. ej. una cita médica).</small></span>
        <input type="checkbox" id="tfAll" name="all_day" checked/><span class="track"></span></label></div>
      <div class="tf-times" id="tfTimes" hidden>
        <div class="field"><label for="tfS">De</label>${raw(timeSelect('12:00', { id: 'tfS', name: 'start_min' }))}<p class="error">Hora no válida.</p></div>
        <div class="field"><label for="tfE">A</label>${raw(timeSelect('14:00', { id: 'tfE', name: 'end_min' }, { end: true }))}<p class="error">Revisa la hora final.</p></div>
      </div>
      <div class="field"><label for="tfReason">Motivo <span class="opt">(opcional)</span></label>
        <input class="input" id="tfReason" name="reason" maxlength="120" placeholder="p. ej. Vacaciones"/>
        <div class="chips" style="margin-top:8px">${REASONS.map((r) => html`<button type="button" class="chip" data-reason="${r}">${r}</button>`)}</div>
        <p class="error">Máximo 120 caracteres.</p></div>
      <p class="faint" style="font-size:12.5px">Las citas que ya estén agendadas en esas fechas no se cancelan solas: te avisamos para que las muevas.</p>
    </form>`;
  const m = modal({
    title: 'Agregar descanso', subtitle: 'Vacaciones, días libres, festivos o unas horas bloqueadas.', body,
    actions: [{ label: 'Cancelar', variant: 'secondary', value: null }, { label: 'Guardar descanso', variant: 'primary', type: 'submit', form: 'tfForm', icon: 'check' }]
  });
  const form = $('#tfForm', m.body);
  m.body.addEventListener('change', (e) => {
    if (e.target.id === 'tfAll') $('#tfTimes', m.body).hidden = e.target.checked;
    if (e.target.id === 'tfFrom') { const to = form.elements.date_to; to.min = e.target.value; if (!to.value || to.value < e.target.value) to.value = e.target.value; }
    if (e.target.id === 'tfWho') $('#tfWhoHint', m.body).textContent = e.target.value === '__shop' ? 'La barbería aparecerá cerrada para todos esos días.' : 'Nadie podrá reservar con esta persona en esas fechas.';
  });
  m.body.addEventListener('input', (e) => { const f = e.target.closest('.field'); if (f) f.classList.remove('invalid'); });
  m.body.addEventListener('click', (e) => { const c = e.target.closest('[data-reason]'); if (c) { form.elements.reason.value = c.dataset.reason; m.body.querySelectorAll('[data-reason]').forEach((x) => x.setAttribute('aria-pressed', String(x === c))); } });
  return new Promise((resolve) => {
    let saved = null;
    m.done.then(() => resolve(saved));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(form);
      const d = formData(form);
      const payload = { date_from: d.date_from, date_to: d.date_to || d.date_from, reason: (d.reason || '').trim() };
      if (isOwner) payload.staff_id = d.staff_id === '__shop' ? null : d.staff_id;
      else payload.staff_id = staffId;
      const errs = {};
      if (!payload.date_from) errs.date_from = 'Elige la fecha de inicio.';
      if (payload.date_to && payload.date_from && payload.date_to < payload.date_from) errs.date_to = 'La fecha final debe ser igual o posterior a la inicial.';
      if (!d.all_day) {
        payload.start_min = toMin(d.start_min, false); payload.end_min = toMin(d.end_min, true);
        if (payload.start_min == null) errs.start_min = 'Hora no válida.';
        if (payload.end_min == null) errs.end_min = 'Hora no válida.';
        else if (payload.start_min != null && payload.end_min <= payload.start_min) errs.end_min = 'La hora final debe ser después de la inicial.';
      }
      if (Object.keys(errs).length) { showFieldErrors(form, { fields: errs }); return; }
      const btn = m.foot.querySelector('[type=submit]');
      try {
        saved = await busy(btn, api.post('/time-off', payload));
        m.close(saved);
      } catch (err) { showFieldErrors(form, err); }
    });
  });
}

function toRangeText(t, t0) {
  const one = t.date_from === t.date_to;
  const d = one ? relDay(t.date_from, t0) : dateShort(t.date_from) + ' – ' + dateShort(t.date_to);
  const hrs = t.start_min != null ? ' · ' + fmtTime(t.start_min) + '–' + toHHMM(t.end_min) : '';
  return d.charAt(0).toUpperCase() + d.slice(1) + hrs;
}

// ── Vista ────────────────────────────────────────────────────────────────
export default {
  title: () => (role() === 'barber' ? 'Mi horario' : 'Horarios'),
  async render(el, { query }) {
    injectCss();
    const isOwner = can('availability.manage.all');
    const canAllOff = can('timeoff.manage.all');
    const self = me();
    const t0 = today();
    const st = { staff: [], id: null, model: null, orig: '', origWeek: {}, offs: [], loadingWeek: false };
    el.innerHTML = String(html`
      <div class="page-head">
        <div><h2>${isOwner ? 'Horarios' : 'Mi horario'}</h2>
          <p>${isOwner ? 'Define cuándo trabaja cada barbero. La reserva en línea solo ofrece estas horas.' : 'Tus días y horas de trabajo. Tus clientes solo podrán reservar en este horario.'}</p></div>
      </div>
      <div id="avStaff"></div>
      <div class="av-grid">
        <div class="stack" style="gap:16px;min-width:0">
          <section class="card av-ed" id="avEd" aria-label="Horario semanal">${raw('<div class="skel-row"><div style="flex:1"><div class="skel skel-line" style="width:40%"></div></div></div>'.repeat(7))}</section>
        </div>
        <div class="stack av-side" style="gap:16px;min-width:0">
          <section class="card av-sum" id="avSum" aria-label="Resumen de la semana"><div class="card-body"><div class="skel" style="height:180px"></div></div></section>
          <section class="card av-to" id="avTo" aria-label="Descansos y vacaciones"><div class="card-body"><div class="skel" style="height:120px"></div></div></section>
        </div>
      </div>`);
    const edEl = $('#avEd', el), sumEl = $('#avSum', el), toEl = $('#avTo', el);
    const cur = () => st.staff.find((s) => s.id === st.id) || self || {};
    const dirty = () => !!st.model && sig(st.model) !== st.orig;

    // ── Barberos ──
    function paintStaff() {
      const box = $('#avStaff', el);
      if (!isOwner || st.staff.length < 2) { box.innerHTML = ''; return; }
      box.innerHTML = String(html`<div class="av-staff" role="group" aria-label="Elegir barbero">${st.staff.map((s) => html`
        <button type="button" class="chip" data-staff="${s.id}" aria-pressed="${String(s.id === st.id)}">${avatar(s.name, { color: s.color || undefined, size: 'sm' })}<span>${firstName(s.name)}${s.bookable ? '' : html` <small>· sin reservas</small>`}</span></button>`)}</div>`);
      const on2 = box.querySelector('[aria-pressed="true"]');
      if (on2 && on2.scrollIntoView) on2.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    // ── Editor ──
    function dayHtml(d) {
      const day = st.model[d];
      const chk = checkDay(day);
      const mins = chk.blocks.reduce((a, [s, e]) => a + e - s, 0);
      return html`<div class="av-day ${day.open ? '' : 'closed'} ${chk.error ? 'bad' : ''}" data-day="${d}">
        <div class="av-dh">
          <label class="switch"><input type="checkbox" data-open="${d}" ${day.open ? 'checked' : ''} aria-label="${DAY(d)} abierto"/><span class="track"></span><span class="av-dname">${DAY(d)}</span></label>
          <span class="av-dsum" data-dsum="${d}">${day.open ? (mins && !chk.error ? hoursText(mins) : '') : 'Cerrado'}</span>
          ${day.open ? html`<button type="button" class="btn btn-ghost btn-icon btn-sm" data-copy="${d}" aria-label="Copiar el horario del ${WEEKDAYS[d]} a otros días" aria-haspopup="menu" title="Copiar a otros días">${raw(icon('copy', 'ic-sm'))}</button>` : html`<span style="width:34px"></span>`}
        </div>
        ${day.open ? html`<div class="av-ranges">
            ${day.ranges.map((r, i) => html`<div class="av-range" data-r="${i}">
              ${raw(timeSelect(r.s, { 'data-t': 's', 'data-d': d, 'data-i': i, 'aria-label': DAY(d) + ': entrada del horario ' + (i + 1) }, { cls: chk.bad.has(i) ? 'err' : '' }))}
              <span class="to">a</span>
              ${raw(timeSelect(r.e, { 'data-t': 'e', 'data-d': d, 'data-i': i, 'aria-label': DAY(d) + ': salida del horario ' + (i + 1) }, { end: true, cls: chk.bad.has(i) ? 'err' : '' }))}
              <button type="button" class="btn btn-ghost btn-icon" data-del="${d}:${i}" aria-label="Quitar el horario ${r.s} a ${r.e} del ${WEEKDAYS[d]}" title="Quitar">${raw(icon('x'))}</button>
            </div>`)}
            ${day.ranges.length < MAX_BLOCKS ? html`<button type="button" class="btn btn-ghost btn-sm av-add" data-add="${d}">${raw(icon('plus'))}${day.ranges.length ? 'Agregar otro horario' : 'Agregar horario'}</button>` : ''}
          </div>
          ${chk.error ? html`<p class="av-err" role="alert">${raw(icon('alert'))}${chk.error}</p>` : ''}` : html`<p class="av-closed">No trabaja este día.</p>`}
      </div>`;
    }
    function paintEditor() {
      const s = cur();
      edEl.innerHTML = String(html`
        <div class="card-head"><div><h3>${isOwner && s.id !== (self && self.id) ? 'Semana de ' + firstName(s.name) : 'Tu semana'}</h3><div class="sub">Usa varios horarios para marcar la comida (p. ej. 10:00–14:00 y 15:00–20:00).</div></div></div>
        ${s.bookable === false ? html`<div class="banner warn" style="margin:12px 16px 0">${raw(icon('info'))}<div class="grow">${firstName(s.name)} no recibe reservas en línea; su horario aplica a las citas que agende el equipo.</div></div>` : ''}
        <div id="avDays">${ORDER.map(dayHtml)}</div>
        <div id="avBar"></div>`);
      paintBar();
    }
    function repaintDay(d) {
      const old = edEl.querySelector('.av-day[data-day="' + d + '"]');
      if (!old) return;
      const tmp = document.createElement('div');
      tmp.innerHTML = String(dayHtml(d));
      old.replaceWith(tmp.firstElementChild);
    }
    // Revalida sin volver a pintar los inputs (no pierde el foco al escribir).
    function refreshDay(d) {
      const row = edEl.querySelector('.av-day[data-day="' + d + '"]');
      if (!row) return;
      const chk = checkDay(st.model[d]);
      row.classList.toggle('bad', !!chk.error);
      row.querySelectorAll('.av-range').forEach((r) => r.querySelectorAll('.input').forEach((inp) => inp.classList.toggle('err', chk.bad.has(Number(r.dataset.r)))));
      let err = row.querySelector('.av-err');
      if (chk.error) {
        if (!err) { err = document.createElement('p'); err.className = 'av-err'; err.setAttribute('role', 'alert'); row.appendChild(err); }
        err.innerHTML = icon('alert') + '<span></span>'; err.lastChild.textContent = chk.error;
      } else if (err) err.remove();
      const mins = chk.error ? 0 : chk.blocks.reduce((a, [s, e]) => a + e - s, 0);
      const sum = row.querySelector('[data-dsum]'); if (sum) sum.textContent = mins ? hoursText(mins) : '';
    }
    function paintBar() {
      const bar = $('#avBar', edEl);
      if (!bar) return;
      if (!dirty()) { bar.innerHTML = ''; paintSummary(); return; }
      const errors = ORDER.filter((d) => checkDay(st.model[d]).error).length;
      bar.innerHTML = String(html`<div class="av-savebar" role="region" aria-label="Cambios sin guardar">
        <span class="grow">${errors ? plural(errors, 'día con error', 'días con error') : 'Cambios sin guardar'}</span>
        <button type="button" class="btn btn-ghost btn-sm" data-act="discard">Descartar</button>
        <button type="button" class="btn btn-primary btn-sm" data-act="save" ${errors ? raw('disabled') : ''}>${raw(icon('check'))}<span>Guardar<span class="lg"> horario</span></span></button>
      </div>`);
      paintSummary();
    }

    // ── Resumen ──
    function paintSummary() {
      if (!st.model) return;
      const w = weekOf(st.model);
      let lo = 24 * 60, hi = 0, total = 0, days = 0;
      for (const d of ORDER) for (const [s, e] of w[d]) { lo = Math.min(lo, s); hi = Math.max(hi, e); }
      for (const d of ORDER) { const m = w[d].reduce((a, [s, e]) => a + e - s, 0); total += m; if (m) days++; }
      if (lo >= hi) { lo = 8 * 60; hi = 21 * 60; }
      lo = Math.max(0, Math.floor(lo / 60) * 60 - 60); hi = Math.min(1440, Math.ceil(hi / 60) * 60 + 60);
      const span = hi - lo;
      const pctOf = (m) => ((m - lo) / span) * 100;
      const ticks = [];
      for (let h = Math.ceil(lo / 60 / 2) * 2; h * 60 <= hi; h += span > 12 * 60 ? 4 : 2) ticks.push(h);
      sumEl.innerHTML = String(html`
        <div class="card-head"><h3>Resumen de la semana</h3></div>
        <div class="card-body">
          <div class="av-tot"><div><b>${hoursText(total)}</b><span>a la semana</span></div><div><b>${days}</b><span>${days === 1 ? 'día de trabajo' : 'días de trabajo'}</span></div></div>
          <div class="av-bars">${ORDER.map((d) => {
            const m = w[d].reduce((a, [s, e]) => a + e - s, 0);
            return html`<div class="av-bar ${m ? '' : 'closed'}"><span class="d">${DAY_S[d]}</span><span class="t" title="${m ? w[d].map(([s, e]) => toHHMM(s) + '–' + toHHMM(e)).join(', ') : 'Cerrado'}">${w[d].map(([s, e]) => html`<i style="left:${pctOf(s).toFixed(2)}%;width:${((e - s) / span * 100).toFixed(2)}%"></i>`)}</span><span class="h">${m ? hoursText(m) : '—'}</span></div>`;
          })}</div>
          <div class="av-ticks" aria-hidden="true"><span></span><span class="r">${ticks.map((h) => html`<span style="left:${pctOf(h * 60).toFixed(2)}%">${h}:00</span>`)}</span><span></span></div>
        </div>`);
    }

    // ── Descansos ──
    async function loadOff() {
      try {
        st.offs = await api.get('/time-off', { staff_id: st.id, from: t0 });
        paintOff();
      } catch (e) {
        toEl.innerHTML = String(html`<div class="card-head"><h3>Descansos y vacaciones</h3></div>${errorState(e, 'avOffRetry')}`);
      }
    }
    function paintOff() {
      const s = cur();
      const items = st.offs;
      toEl.innerHTML = String(html`
        <div class="card-head"><div><h3>Descansos y vacaciones</h3><div class="sub">${isOwner ? 'De ' + firstName(s.name) + ' y de toda la barbería' : 'Tus días libres y los de la barbería'}</div></div>
          <button type="button" class="btn btn-secondary btn-sm" data-act="add-off">${raw(icon('plus'))}Agregar</button></div>
        ${items.length ? html`<div class="list" style="margin-top:8px">${items.map((t) => {
          const now = t.date_from <= t0 && t.date_to >= t0;
          const soon = !now && diffDays(t0, t.date_from) <= 7;
          const canDel = t.staff_id === null ? canAllOff : true;
          const days = diffDays(t.date_from, t.date_to) + 1;
          return html`<div class="list-item" data-off="${t.id}">
            <span class="ico ${t.staff_id === null ? 'shop' : ''}">${raw(icon(t.staff_id === null ? 'store' : t.start_min != null ? 'clock' : 'sun'))}</span>
            <span class="grow" style="min-width:0"><span class="title">${t.reason || (t.staff_id === null ? 'Barbería cerrada' : 'Descanso')}</span>
              <span class="meta">${toRangeText(t, t0)}${t.start_min == null && days > 1 ? ' · ' + plural(days, 'día') : ''}</span>
              <span class="row wrap" style="gap:5px;margin-top:5px">${t.staff_id === null ? html`<span class="badge info plain">Toda la barbería</span>` : ''}${now ? html`<span class="badge warn">En curso</span>` : soon ? html`<span class="badge plain">Pronto</span>` : ''}</span></span>
            ${canDel ? html`<button type="button" class="btn btn-ghost btn-icon" data-deloff="${t.id}" aria-label="Quitar descanso ${t.reason || ''} ${toRangeText(t, t0)}" title="Quitar">${raw(icon('trash'))}</button>` : ''}
          </div>`;
        })}</div>`
          : emptyState({ icon: 'sun', title: 'Sin descansos próximos', text: 'Registra vacaciones, días libres o festivos para que nadie reserve en esas fechas.', compact: true })}`);
    }

    // ── Carga ──
    async function loadWeek() {
      st.loadingWeek = true;
      edEl.innerHTML = String(raw('<div class="skel-row"><div style="flex:1"><div class="skel skel-line" style="width:40%"></div></div></div>'.repeat(7)));
      try {
        const r = await api.get('/availability', { staff_id: st.id });
        const week = r[st.id] || {};
        st.origWeek = week;
        st.model = toModel(week);
        st.orig = sig(st.model);
        sumEl.hidden = false;
        paintEditor();
        paintSummary();
      } catch (e) {
        edEl.innerHTML = String(errorState(e, 'avRetry'));
        sumEl.hidden = true;
      } finally { st.loadingWeek = false; }
    }
    async function selectStaff(id, push) {
      if (dirty()) {
        const ok = await confirmDialog({ title: '¿Descartar los cambios?', message: 'No guardaste el horario de ' + firstName(cur().name) + '. Si cambias de barbero, se pierden.', confirmText: 'Descartar cambios', danger: true, icon: 'alert' });
        if (!ok) { paintStaff(); return; }
      }
      st.id = id;
      if (push) setQuery({ barbero: id });
      paintStaff();
      await Promise.all([loadWeek(), loadOff()]);
    }

    async function init() {
      try {
        if (isOwner) {
          st.staff = await getStaff(false);
          if (!st.staff.length) { edEl.innerHTML = String(emptyState({ icon: 'users', title: 'Aún no hay barberos', text: 'Agrega a tu equipo para definir sus horarios.', action: { label: 'Ir a Equipo', href: '#/equipo', icon: 'users' } })); sumEl.hidden = true; toEl.hidden = true; return; }
          const wanted = query.barbero && st.staff.find((s) => s.id === query.barbero);
          st.id = wanted ? wanted.id : ((st.staff.find((s) => s.bookable) || st.staff[0]).id);
        } else {
          if (!self) { edEl.innerHTML = String(emptyState({ icon: 'lock', title: 'Sin ficha de barbero', text: 'Tu usuario no está vinculado a un barbero de esta barbería.' })); return; }
          st.staff = [self];
          st.id = self.id;
        }
        paintStaff();
        await Promise.all([loadWeek(), loadOff()]);
      } catch (e) {
        edEl.innerHTML = String(errorState(e, 'avInitRetry'));
      }
    }

    // ── Eventos ──
    const offs = [];
    offs.push(on(el, 'click', '[data-staff]', (e, b) => { if (b.dataset.staff !== st.id) selectStaff(b.dataset.staff, true); }));
    offs.push(on(el, 'click', '#avRetry', () => loadWeek()));
    offs.push(on(el, 'click', '#avOffRetry', () => loadOff()));
    offs.push(on(el, 'click', '#avInitRetry', () => init()));
    offs.push(on(el, 'change', '[data-open]', (e, inp) => {
      const d = Number(inp.dataset.open);
      const day = st.model[d];
      day.open = inp.checked;
      if (day.open && !day.ranges.length) {
        const h = (shop() && shop().settings && shop().settings.hours && shop().settings.hours[d]) || [];
        day.ranges = h.length ? h.map(([s, e2]) => ({ s: toHHMM(s), e: toHHMM(e2) })) : [{ s: '10:00', e: '20:00' }];
      }
      repaintDay(d); paintBar();
      const again = edEl.querySelector('[data-open="' + d + '"]'); if (again) again.focus();
    }));
    offs.push(on(el, 'input', '[data-t]', (e, inp) => {
      const d = Number(inp.dataset.d), i = Number(inp.dataset.i);
      st.model[d].ranges[i][inp.dataset.t] = inp.value;
      refreshDay(d); paintBar();
    }));
    offs.push(on(el, 'click', '[data-add]', (e, b) => {
      const d = Number(b.dataset.add);
      const rs = st.model[d].ranges;
      const lastEnd = rs.length ? Math.max(...rs.map((r) => toMin(r.e, true) || 0)) : null;
      // Nuevo bloque: 1 h después del último, de 2 h (o de 10:00 a 20:00 si el día estaba vacío).
      let s = lastEnd != null ? lastEnd + 60 : 10 * 60;
      let e2 = lastEnd != null ? s + 120 : 20 * 60;
      if (e2 > 1440) { s = Math.max(0, (rs.length ? Math.min(...rs.map((r) => toMin(r.s, false) || 0)) : 600) - 180); e2 = s + 120; }
      rs.push({ s: toHHMM(s), e: toHHMM(e2) });
      repaintDay(d); paintBar();
      const inputs = edEl.querySelectorAll('.av-day[data-day="' + d + '"] [data-t="s"]');
      if (inputs.length) inputs[inputs.length - 1].focus();
    }));
    offs.push(on(el, 'click', '[data-del]', (e, b) => {
      const [d, i] = b.dataset.del.split(':').map(Number);
      st.model[d].ranges.splice(i, 1);
      if (!st.model[d].ranges.length) st.model[d].open = false;
      repaintDay(d); paintBar();
      const add = edEl.querySelector('.av-day[data-day="' + d + '"] [data-add], [data-open="' + d + '"]'); if (add) add.focus();
    }));
    offs.push(on(el, 'click', '[data-copy]', (e, b) => {
      const d = Number(b.dataset.copy);
      const src = st.model[d];
      const apply = (targets, label) => {
        for (const t of targets) { if (t === d) continue; st.model[t] = { open: src.open, ranges: src.ranges.map((r) => ({ s: r.s, e: r.e })) }; }
        paintEditor();
        toast.info('Listo: el horario del ' + WEEKDAYS[d] + ' se copió ' + label + '. Revisa y guarda.');
      };
      menu(b, [
        { label: 'Copiar a días hábiles (lun–vie)', icon: 'copy', onClick: () => apply([1, 2, 3, 4, 5], 'a los días hábiles (lunes a viernes)') },
        { label: 'Copiar de lunes a sábado', icon: 'copy', onClick: () => apply([1, 2, 3, 4, 5, 6], 'de lunes a sábado') },
        { label: 'Copiar a todos los días', icon: 'copy', onClick: () => apply([0, 1, 2, 3, 4, 5, 6], 'a toda la semana') }
      ]);
    }));
    offs.push(on(el, 'click', '[data-act="discard"]', () => {
      st.model = toModel(st.origWeek);
      st.orig = sig(st.model);
      paintEditor();
      toast.info('Cambios descartados');
    }));
    offs.push(on(el, 'click', '[data-act="save"]', async (e, b) => {
      const bad = ORDER.find((d) => checkDay(st.model[d]).error);
      if (bad !== undefined) { toast.error('Revisa el ' + WEEKDAYS[bad] + ': ' + checkDay(st.model[bad]).error); return; }
      const week = weekOf(st.model);
      try {
        const r = await busy(b, api.put('/availability/' + encodeURIComponent(st.id), { week }));
        st.origWeek = r[st.id] || week;
        st.model = toModel(st.origWeek);
        st.orig = sig(st.model);
        paintEditor();
        bus.emit('availability:changed', { staff_id: st.id });
        const who = isOwner && !(self && self.id === st.id) ? 'de ' + firstName(cur().name) : '';
        toast.success(who ? 'Horario ' + who + ' guardado' : 'Tu horario quedó guardado');
      } catch (err) {
        const f = err.fields && Object.keys(err.fields).find((k) => /^week\.\d$/.test(k));
        toast.error(f ? err.fields[f] : err);
      }
    }));
    offs.push(on(el, 'click', '[data-act="add-off"]', async () => {
      const r = await openTimeOffForm({ staff: st.staff, staffId: st.id, isOwner });
      if (!r) return;
      const who = r.staff_id === null ? 'Toda la barbería' : firstName((st.staff.find((s) => s.id === r.staff_id) || {}).name || '');
      if (r.conflicts) {
        toast.info('Descanso guardado. Ojo: hay ' + plural(r.conflicts, 'cita agendada', 'citas agendadas') + ' en esas fechas; muévelas o cancélalas.', { duration: 9000, action: { label: 'Ver agenda', onClick: () => window.TB.navigate('/agenda', { query: { fecha: r.date_from } }) } });
      } else toast.success('Descanso guardado' + (who ? ' · ' + who : ''));
      bus.emit('availability:changed', { staff_id: r.staff_id });
      if (r.staff_id && r.staff_id !== st.id) { await selectStaff(r.staff_id, true); } else loadOff();
    }));
    offs.push(on(el, 'click', '[data-deloff]', async (e, b) => {
      const t = st.offs.find((x) => x.id === b.dataset.deloff);
      if (!t) return;
      const ok = await confirmDialog({
        title: '¿Quitar este descanso?',
        message: (t.reason || 'Descanso') + ' · ' + toRangeText(t, t0) + '. Esos días vuelven a estar disponibles para reservar según el horario.',
        confirmText: 'Quitar descanso', danger: true
      });
      if (!ok) return;
      try {
        await api.del('/time-off/' + encodeURIComponent(t.id));
        st.offs = st.offs.filter((x) => x.id !== t.id);
        const row = b.closest('.list-item');
        if (row) { row.style.transition = 'opacity .25s, transform .25s'; row.style.opacity = '0'; row.style.transform = 'translateX(16px)'; }
        setTimeout(paintOff, 240);
        bus.emit('availability:changed', { staff_id: t.staff_id });
        toast.success('Descanso quitado');
      } catch (err) { toast.error(err); }
    }));
    const beforeUnload = (e) => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);

    await init();
    return () => {
      offs.forEach((f) => f());
      window.removeEventListener('beforeunload', beforeUnload);
      if (dirty()) toast.info('No guardaste los cambios del horario.', { duration: 6000 });
    };
  }
};
