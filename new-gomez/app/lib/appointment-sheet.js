// Hoja de cita: detalle con acciones por estado, alta, edición y reagenda. Hoja inferior en móvil.
//
// Contrato:
//   openAppointment(id)                         → Promise<Appointment|null>  (al cerrar; última versión vista)
//   openNewAppointment({ date, start_min, staff_id, client, services, source })
//                                               → Promise<Appointment|null>  (la cita creada o null)
//   Ambos emiten bus 'appointments:changed' ({ id, action }) cuando algo cambia.
//   client: { id, name, phone } de un cliente existente (opcional). Sin fecha y desde #/agenda se usa la
//   fecha/barbero que se están viendo (?fecha=&barbero=).
//
// Extras (los usa la agenda; cualquier vista puede usarlos):
//   openEditAppointment(appt)                   → Promise<Appointment|null>
//   openReschedule(appt)                        → Promise<Appointment|null>
//   moveAppointment(appt, { date, start_min, staff_id }) → PATCH con confirmación "de todas formas" (409)
//   setAppointmentStatus(appt, status, { btn, reason }) → Promise<Appointment|null>
//   cancelAppointment(appt)                     → pide motivo (chips rápidos) y cancela
//   chargeAppointment(appt)                     → abre openPaymentSheet (lib/payment-sheet.js)
//   whatsappMenu(anchorEl, appt)                → menú con los mensajes que aplican al estado
//   sendAppointmentWhatsApp(appt, kind)         → sendWhatsApp (lib/whatsapp.js)
import { html, raw, esc, $, $$ } from './html.js';
import { icon } from './icons.js';
import { api } from './api.js';
import { bus, can, canAny, today, nowMin, me, getServices, getStaff, cached } from './state.js';
import { parseHash } from './router.js';
import { toast, modal, confirmDialog, promptDialog, menu, busy, avatar, statusBadge, errorState } from './ui.js';
import { money, time, duration, dateLongCap, dateShort, relDay, ago, dateTimeIso, phone as fmtPhone, plural, METHOD, SOURCE, firstName, weekday } from './fmt.js';
import { pickClient, servicesPicker, staffSelect, dayStrip, slotChips, hexRgb } from './pickers.js';

// ── Permisos ──
const canWrite = () => canAny(['appointments.write.all', 'appointments.write.own']);
const canAll = () => can('appointments.write.all');
const canPay = () => can('payments.write');
const canMsg = () => can('messages.send');
const canClient = () => canAny(['clients.read.all', 'clients.read.own']);
const hasStarted = (a) => a.date < today() || (a.date === today() && a.start_min <= nowMin() + 60);
const ACTIVE = ['pending', 'confirmed'];
const whenText = (a) => relDay(a.date, today()) + ', ' + time(a.start_min);

const CANCEL_REASONS = ['El cliente avisó que no viene', 'Cambio de planes', 'Se enfermó', 'Reagendará después', 'Error al agendar', 'El barbero no está disponible'];
const WA_KINDS = {
  confirmation: ['Confirmación', 'check-circle'],
  reminder: ['Recordatorio', 'bell'],
  reschedule: ['Cambio de horario', 'calendar-clock'],
  cancellation: ['Aviso de cancelación', 'calendar-x'],
  thanks: ['Agradecimiento', 'star'],
  no_show: ['«Te esperamos»', 'user-x']
};
const MSG_STATUS = { prepared: ['Preparado', ''], opened: ['Abierto en WhatsApp', 'info'], sent: ['Enviado', 'ok'], queued: ['En cola', 'warn'], failed: ['Falló', 'err'] };

// Datos auxiliares (caché corta).
const availability = () => cached('agenda:availability', () => api.get('/availability'), 60000).catch(() => ({}));
async function staffOptions() {
  if (!canAll()) { const m = me(); return m ? [m] : []; }
  const list = (await getStaff()).filter((s) => s.active !== false);
  return list.slice().sort((a, b) => (b.bookable ? 1 : 0) - (a.bookable ? 1 : 0));
}

// ── Estilos ───────────────────────────────────────────────────────────
function ensureStyles() {
  if (document.getElementById('st-appt')) return;
  document.head.insertAdjacentHTML('beforeend', `<style id="st-appt">
.apf{display:grid;gap:24px;padding-top:4px}
.apf-sec{display:grid;gap:10px;min-width:0}
.apf-label{display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px;min-width:0}
.apf-n{width:24px;height:24px;border-radius:50%;background:var(--ink);color:var(--on-ink);font-size:12.5px;font-weight:700;display:grid;place-items:center;flex:none;transition:background .2s}
.apf-sec.done .apf-n{background:var(--ok);color:#fff}
:root[data-theme="dark"] .apf-n{background:var(--surface-3);color:var(--text)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .apf-n{background:var(--surface-3);color:var(--text)}}
.apf-aside{margin-left:auto;font-weight:500;font-size:12.5px;color:var(--text-2);white-space:nowrap}
.apf .field.invalid>.error{display:block}
.apf .field[data-f].invalid .pc-sel,.apf .field[data-f].invalid .pc-q .input{border-color:var(--err)}
.apf-more{border-top:1px solid var(--border);padding-top:6px}
.apf-more>summary{list-style:none;display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;min-height:44px;border-radius:8px}
.apf-more>summary::-webkit-details-marker{display:none}
.apf-more>summary .ic{margin-left:auto;transition:transform .2s var(--ease)}
.apf-more[open]>summary .ic{transform:rotate(180deg)}
.apf-sum{display:grid;min-width:0;line-height:1.2;align-content:center}
.apf-total{font-family:var(--disp);font-size:25px;font-weight:800;font-variant-numeric:tabular-nums}
.apf-meta{font-size:12.5px;color:var(--text-2)}
@media (max-width:719px){.apf-cancel{display:none}.modal-foot .apf-sum{flex:1.2}}
.apf-done{display:grid;justify-items:center;text-align:center;gap:8px;padding:28px 8px 8px;animation:fadeUp .3s var(--ease-out)}
.apf-done h3{font-size:20px;font-weight:700}
.apf-done p{color:var(--text-2);font-size:14.5px;max-width:380px}
.apf-check{width:80px;height:80px;border-radius:50%;background:var(--ok-soft);color:var(--ok);display:grid;place-items:center;animation:pop .5s var(--ease-out);margin-bottom:6px}
.apf-check .ic{width:42px;height:42px;stroke-width:2.4}
.apf-check .ic path{stroke-dasharray:40;stroke-dashoffset:40;animation:draw .6s .18s var(--ease-out) forwards}
.apf-done .stack{width:100%;max-width:360px;margin-top:14px}
/* detalle */
.ad{display:grid;gap:16px;padding-top:2px}
.ad-hero{position:relative;padding:14px 16px 16px 20px;border-radius:var(--r-lg);background:rgba(var(--c-rgb),.09);border:1px solid rgba(var(--c-rgb),.22);overflow:hidden}
.ad-hero::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--c)}
.ad-hero.st-cancelled{filter:saturate(.3)}
.ad-badges{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.ad-folio{margin-left:auto;font-family:var(--mono);font-size:12px;color:var(--text-3)}
.ad-day{font-size:13.5px;color:var(--text-2);font-weight:500;margin-top:10px}
.ad-time{font-family:var(--disp);font-size:42px;font-weight:800;line-height:1;margin-top:3px;font-variant-numeric:tabular-nums;letter-spacing:.01em}
.ad-time small{color:var(--text-3);font-size:27px;font-weight:700}
.ad-hero.st-cancelled .ad-time{text-decoration:line-through;text-decoration-thickness:3px;color:var(--text-3)}
.ad-staff{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:14px;color:var(--text-2)}
.ad-staff b{color:var(--text);font-weight:600}
.ad-contact{display:flex;align-items:center;gap:10px;min-width:0}
.ad-contact .t{font-weight:600;font-size:15px}
.ad-contact .m{font-size:13px;color:var(--text-2)}
.ad-contact .btn-icon{--h:42px;flex:none}
.ad-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.ad-acts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
@media (min-width:720px){.ad-acts{grid-template-columns:repeat(auto-fill,minmax(92px,1fr))}}
.ad-act{display:grid;justify-items:center;align-content:center;gap:6px;min-height:74px;padding:10px 4px;border-radius:var(--r);border:1px solid var(--border);background:var(--surface);font-size:12.5px;font-weight:600;color:var(--text);text-align:center;line-height:1.2;transition:border-color .15s,background .15s,transform .12s var(--ease)}
.ad-act .ic{width:22px;height:22px;color:var(--text-2)}
.ad-act:hover{border-color:var(--border-strong);background:var(--surface-2)}
.ad-act:active{transform:scale(.95)}
.ad-act.danger,.ad-act.danger .ic{color:var(--err)}
.ad-act.wa .ic{color:#1FAF54}
.ad-act.ok .ic{color:var(--ok)}
.ad-act.brand .ic{color:var(--brand-strong)}
.ad-act[aria-busy="true"]{opacity:.6;pointer-events:none}
.ad-card{border:1px solid var(--border);border-radius:var(--r-lg);padding:12px 16px;background:var(--surface-2)}
.ad-line{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:14px;padding:5px 0}
.ad-line .num{font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}
.ad-line.total{border-top:1px solid var(--border);margin-top:4px;padding-top:10px;font-size:15.5px;font-weight:700}
.ad-note-q{padding:12px 14px;border-radius:var(--r);background:var(--brand-softer);border:1px solid var(--brand-soft);font-size:14px}
.ad-note-q .label{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-2);margin-bottom:4px}
.ad-note-q .label .ic{width:14px;height:14px}
.ad-inote textarea{min-height:64px}
.ad-tabs{margin-bottom:6px}
.ad-tabs .n{font-weight:600;color:var(--text-3);margin-left:4px;font-size:12.5px}
.ad-panel{min-height:80px;animation:fadeIn .2s var(--ease)}
.ad .timeline .ev .d.ok{background:var(--ok-soft);color:var(--ok)}
.ad .timeline .ev .d.err{background:var(--err-soft);color:var(--err)}
.ad .timeline .ev .d.warn{background:var(--warn-soft);color:var(--warn)}
.ad .timeline .ev .d.info{background:var(--info-soft);color:var(--info)}
.ad .timeline .ev .d.brand{background:var(--brand-soft);color:var(--brand-strong)}
.ad .timeline .ev .d.wa{background:rgba(37,211,102,.14);color:#1FAF54}
.ad-sub{font-size:12.5px;color:var(--text-2)}
.ad-list{border:1px solid var(--border);border-radius:var(--r);overflow:hidden}
.ad-list .list-item{min-height:56px;padding:10px 14px}
.ad-msg-body{white-space:pre-wrap;font-size:13px;color:var(--text-2);margin-top:6px;padding:10px 12px;border-radius:10px;background:var(--surface-2);border:1px solid var(--border)}
.ad-skel{display:grid;gap:14px}
.ad-foot-note{font-size:12.5px;color:var(--text-3);display:flex;align-items:center;gap:6px}
@media (max-width:719px){.ad-time{font-size:38px}}
</style>`);
}

// ═════════════════════════════════════════════════════════════════════
// Acciones sueltas (reutilizables)
// ═════════════════════════════════════════════════════════════════════
function emit(id, action, extra) { bus.emit('appointments:changed', Object.assign({ id, action }, extra || {})); }

export async function sendAppointmentWhatsApp(a, kind) {
  try {
    const m = await import('./whatsapp.js');
    const r = await m.sendWhatsApp({ appointment_id: a.id, client_id: a.client_id || undefined, kind });
    if (r) emit(a.id, 'message');
    return r;
  } catch (e) { toast.error(e && e.message ? e : 'No se pudo preparar el mensaje de WhatsApp.'); return null; }
}
async function writeWhatsApp(a) {
  try {
    const m = await import('./whatsapp.js');
    const fn = m.editAndSendWhatsApp || m.sendWhatsApp;
    const r = await fn({ appointment_id: a.id, client_id: a.client_id || undefined, kind: 'custom' });
    if (r) emit(a.id, 'message');
    return r;
  } catch (e) { toast.error(e); return null; }
}
function waKindsFor(a) {
  const st = a.status;
  if (st === 'cancelled') return ['cancellation'];
  if (st === 'completed') return ['thanks'];
  if (st === 'no_show') return ['no_show'];
  const ks = ['confirmation', 'reminder'];
  if ((a.reschedule_count || 0) > 0) ks.unshift('reschedule');
  return ks;
}
export function whatsappMenu(anchor, a, after) {
  if (!a.client_phone) { toast.error('Este cliente no tiene teléfono registrado. Agrégalo en su ficha para escribirle por WhatsApp.'); return; }
  const done = (p) => Promise.resolve(p).then((r) => { if (r && after) after(r); });
  menu(anchor, waKindsFor(a).map((k) => ({ label: 'Enviar ' + WA_KINDS[k][0].toLowerCase(), icon: WA_KINDS[k][1], onClick: () => done(sendAppointmentWhatsApp(a, k)) }))
    .concat([{ sep: true }, { label: 'Escribir otro mensaje…', icon: 'edit', onClick: () => done(writeWhatsApp(a)) }]));
}

export async function chargeAppointment(a, onDone) {
  if (!canPay()) { toast.error('Tu rol no puede registrar cobros.'); return null; }
  try {
    const m = await import('./payment-sheet.js');
    const p = await m.openPaymentSheet({ appointment: a, onDone: (x) => { if (onDone) onDone(x); } });
    if (p) emit(a.id, 'payment');
    return p || null;
  } catch (e) { console.error(e); toast.error('No se pudo abrir el cobro. Intenta de nuevo.'); return null; }
}

function statusToast(prev, a) {
  const wa = (kind, label) => (canMsg() && a.client_phone ? { label: label || 'Avisar por WhatsApp', onClick: () => sendAppointmentWhatsApp(a, kind) } : undefined);
  const undo = (to) => ({ label: 'Deshacer', onClick: () => setAppointmentStatus(a, to) });
  const s = a.status;
  if (s === 'confirmed' && prev.status === 'cancelled') return toast.success('Cita restaurada', { action: wa('confirmation') });
  if (s === 'confirmed' && prev.status === 'completed') return toast.success('Listo, la cita volvió a «confirmada»');
  if (s === 'confirmed' && prev.status === 'no_show') return toast.success('Listo, la cita volvió a «confirmada»');
  if (s === 'confirmed') return toast.success('Cita confirmada', { action: wa('confirmation', 'Enviar confirmación') });
  if (s === 'completed') return toast.success('¡Cita atendida!', { action: a.balance > 0 && canPay() ? { label: 'Cobrar ' + money(a.balance), onClick: () => chargeAppointment(a) } : undo(prev.status) });
  if (s === 'no_show') return toast.success('Marcada como «no asistió»', { action: undo(prev.status) });
  if (s === 'cancelled') return toast.success('Cita cancelada · el horario quedó libre', { action: wa('cancellation') });
  if (s === 'pending') return toast.success(prev.status === 'cancelled' ? 'Cita restaurada como pendiente' : 'La cita quedó pendiente de confirmar');
  return toast.success('Estado actualizado');
}

export async function setAppointmentStatus(a, next, o) {
  o = o || {};
  const run = (force) => api.post('/appointments/' + a.id + '/status', { status: next, reason: o.reason || undefined, force: force ? true : undefined });
  let out;
  try { out = await busy(o.btn, () => run(false)); }
  catch (err) {
    if (err.status === 409 && err.code === 'slot_taken') {
      const ok = await confirmDialog({ title: 'Ese horario ya está ocupado', message: err.message + ' ¿Quieres restaurarla de todas formas? Quedarán dos citas a la misma hora.', confirmText: 'Restaurar de todas formas', cancelText: 'No', icon: 'alert' });
      if (!ok) return null;
      try { out = await busy(o.btn, () => run(true)); } catch (e2) { toast.error(e2); return null; }
    } else { toast.error(err); return null; }
  }
  if (!out) return null;
  emit(a.id, 'status', { status: next });
  statusToast(a, out);
  return out;
}

export async function cancelAppointment(a) {
  const reason = await promptDialog({
    title: '¿Cancelar esta cita?',
    message: (a.client_name || 'Cliente') + ' · ' + whenText(a) + ' con ' + (a.staff_name || 'el barbero') + '. El horario quedará libre para alguien más.',
    label: 'Motivo', optional: true, max: 300, placeholder: 'Escribe o elige un motivo', chips: CANCEL_REASONS,
    confirmText: 'Cancelar cita', cancelText: 'No, mantenerla', danger: true
  });
  if (reason === null) return null;
  return setAppointmentStatus(a, 'cancelled', { reason });
}

// PATCH de fecha/hora/barbero con la confirmación "Guardar de todas formas" si el horario choca (409).
export async function moveAppointment(a, to, o) {
  o = o || {};
  const body = {};
  if (to.date && to.date !== a.date) body.date = to.date;
  if (to.start_min != null && to.start_min !== a.start_min) body.start_min = to.start_min;
  if (to.staff_id && to.staff_id !== a.staff_id) body.staff_id = to.staff_id;
  if (!Object.keys(body).length) return a;
  const run = (force) => api.patch('/appointments/' + a.id, Object.assign({}, body, force ? { force: true } : {}));
  let out;
  try { out = await busy(o.btn, () => run(false)); }
  catch (err) {
    if (err.status === 409 && err.code === 'slot_taken') {
      const ok = await confirmDialog({ title: 'Ese horario no está libre', message: err.message + ' ¿Quieres guardarla ahí de todas formas?', confirmText: 'Guardar de todas formas', cancelText: 'Elegir otro', icon: 'alert' });
      if (!ok) return null;
      try { out = await busy(o.btn, () => run(true)); } catch (e2) { toast.error(e2); return null; }
    } else { toast.error(err); return null; }
  }
  emit(a.id, 'moved');
  const who = body.staff_id ? ' con ' + (out.staff_name || '') : '';
  toast.success('Cita movida a ' + whenText(out).toLowerCase() + who, { action: canMsg() && out.client_phone && ACTIVE.includes(out.status) ? { label: 'Avisar por WhatsApp', onClick: () => sendAppointmentWhatsApp(out, 'reschedule') } : undefined });
  return out;
}

// ═════════════════════════════════════════════════════════════════════
// Detalle
// ═════════════════════════════════════════════════════════════════════
function skelDetail() {
  return '<div class="ad-skel" aria-busy="true" aria-label="Cargando cita">' +
    '<div class="skel" style="height:148px;border-radius:16px"></div>' +
    '<div class="row"><div class="skel" style="width:40px;height:40px;border-radius:50%"></div><div class="grow"><div class="skel skel-line" style="width:45%"></div><div class="skel skel-line" style="width:30%;height:10px"></div></div></div>' +
    '<div class="ad-acts">' + '<div class="skel" style="height:74px;border-radius:12px"></div>'.repeat(4) + '</div>' +
    '<div class="skel" style="height:110px;border-radius:16px"></div></div>';
}

function eventInfo(ev, names) {
  const d = ev.data || {};
  const nm = (id) => names[id] || 'otro barbero';
  switch (ev.type) {
    case 'created': return { ic: 'calendar-plus', tone: 'brand', text: d.source === 'online' ? 'Reservó en línea' : d.source === 'walkin' ? 'Registrada sin cita (llegó directo)' : d.source === 'import' ? 'Importada del sistema anterior' : 'Cita creada', sub: d.status === 'pending' ? 'Quedó pendiente de confirmar' : null };
    case 'status': {
      const f = d.from, t = d.to;
      const by = d.by === 'client' ? ' por el cliente' : '';
      if (t === 'cancelled') return { ic: 'x-circle', tone: 'err', text: 'Cancelada' + by, sub: d.reason ? 'Motivo: ' + d.reason : null };
      if (f === 'cancelled') return { ic: 'refresh', tone: 'info', text: 'Restaurada' + (t === 'pending' ? ' como pendiente' : '') };
      if (f === 'completed') return { ic: 'undo', tone: 'warn', text: 'Se deshizo «atendida»' };
      if (f === 'no_show' && t === 'confirmed') return { ic: 'undo', tone: 'warn', text: 'Se deshizo «no asistió»' };
      if (t === 'confirmed') return { ic: 'check-circle', tone: 'info', text: 'Confirmada' + by };
      if (t === 'completed') return { ic: 'check', tone: 'ok', text: 'Marcada como atendida' };
      if (t === 'no_show') return { ic: 'user-x', tone: 'err', text: 'Marcada como «no asistió»' };
      if (t === 'pending') return { ic: 'clock', tone: 'warn', text: 'Regresó a pendiente' };
      return { ic: 'info', tone: '', text: 'Cambio de estado' };
    }
    case 'rescheduled': {
      const f = d.from || {}, t = d.to || {};
      let sub = (f.date ? dateShort(f.date) + ' ' + time(f.start_min) : '') + ' → ' + (t.date ? dateShort(t.date) + ' ' + time(t.start_min) : '');
      if (f.staff_id && t.staff_id && f.staff_id !== t.staff_id) sub += ' · ' + nm(f.staff_id) + ' → ' + nm(t.staff_id);
      return { ic: 'calendar-clock', tone: 'info', text: 'Reagendada' + (d.by === 'client' ? ' por el cliente' : ''), sub };
    }
    case 'edited': {
      const L = { services: 'servicios', client: 'cliente', internal_note: 'nota interna', client_note: 'nota del cliente' };
      const fs = (d.fields || []).map((k) => L[k] || k);
      return { ic: 'edit', tone: '', text: 'Cita editada', sub: (fs.length ? 'Cambió: ' + fs.join(', ') : '') + (d.fields && d.fields.includes('services') && d.total != null ? ' · Total ' + money(d.total) : '') };
    }
    case 'note': return { ic: 'note', tone: '', text: d.internal_note ? 'Nota interna actualizada' : 'Nota interna borrada', sub: d.internal_note ? '“' + String(d.internal_note).slice(0, 120) + (String(d.internal_note).length > 120 ? '…' : '') + '”' : null };
    case 'payment': return d.action === 'refund'
      ? { ic: 'undo', tone: 'warn', text: 'Reembolso de ' + money(d.amount), sub: d.reason ? 'Motivo: ' + d.reason : null }
      : { ic: 'cash', tone: 'ok', text: 'Cobro de ' + money(d.amount) + (d.tip ? ' + ' + money(d.tip) + ' de propina' : ''), sub: METHOD[d.method] || d.method || null };
    case 'message': return { ic: 'whatsapp', tone: 'wa', text: 'WhatsApp: ' + ((WA_KINDS[d.kind] || [d.kind === 'custom' ? 'mensaje libre' : 'mensaje'])[0]).toLowerCase(), sub: (MSG_STATUS[d.status] || [d.status || ''])[0] };
    default: return { ic: 'info', tone: '', text: ev.type };
  }
}

export function openAppointment(id) {
  ensureStyles();
  let data = null, latest = null, tab = 'history', names = {}, closed = false;
  const m = modal({ title: 'Cita', subtitle: ' ', size: 'lg', body: skelDetail(), footerHtml: ' ', onClose: () => { closed = true; offBus(); } });
  m.el.classList.add('ad-modal');
  m.foot.hidden = true;
  const sub = m.el.querySelector('.modal-head .sub');
  let reloadT = null;
  const reload = () => { clearTimeout(reloadT); reloadT = setTimeout(() => { if (!closed) load(); }, 60); };
  const offBus = bus.on('appointments:changed', (e) => { if (!closed && e && e.id === id) reload(); });
  getStaff().then((l) => { names = Object.fromEntries((l || []).map((s) => [s.id, s.name])); }).catch(() => {});

  async function load() {
    try {
      const r = await api.get('/appointments/' + encodeURIComponent(id));
      if (closed) return;
      data = r; latest = r.appointment;
      paint();
    } catch (e) {
      if (closed) return;
      if (!data) {
        m.setTitle(e.status === 404 ? 'Cita no encontrada' : 'Cita');
        if (sub) sub.textContent = '';
        m.body.innerHTML = String(errorState(e.status === 404 ? { message: 'Puede que la hayan borrado o que no tengas acceso a ella.' } : e, e.status === 404 ? null : 'adRetry'));
        m.foot.hidden = true;
      } else toast.error(e);
    }
  }

  function actionsFor(a) {
    const st = a.status, started = hasStarted(a), active = ACTIVE.includes(st), w = canWrite();
    const wa = canMsg() && !!a.client_phone;
    let primary = null;
    if (w && st === 'pending') primary = { k: 'confirm', label: 'Confirmar cita', ic: 'check-circle', cls: 'btn-primary' };
    else if (w && st === 'confirmed' && started) primary = { k: 'complete', label: 'Marcar como atendida', ic: 'check', cls: 'btn-ok' };
    else if (st === 'confirmed' && wa) primary = { k: 'wa:reminder', label: 'Enviar recordatorio', ic: 'whatsapp', cls: 'btn-wa' };
    else if (st === 'completed' && a.balance > 0 && canPay()) primary = { k: 'pay', label: 'Cobrar ' + money(a.balance), ic: 'cash', cls: 'btn-primary' };
    else if (st === 'completed' && wa) primary = { k: 'wa:thanks', label: 'Enviar agradecimiento', ic: 'whatsapp', cls: 'btn-wa' };
    else if (w && st === 'cancelled') primary = { k: 'restore', label: 'Restaurar cita', ic: 'refresh', cls: 'btn-primary' };
    else if (st === 'no_show' && wa) primary = { k: 'wa:no_show', label: 'Escribirle para reagendar', ic: 'whatsapp', cls: 'btn-wa' };
    const g = [];
    if (w && st === 'pending') g.push(['confirm', 'check-circle', 'Confirmar', 'brand']);
    if (w && (active || st === 'no_show') && started) g.push(['complete', 'check', st === 'no_show' ? 'Sí vino' : 'Atendida', 'ok']);
    if (canPay() && st !== 'cancelled' && a.balance > 0) g.push(['pay', 'cash', 'Cobrar', 'brand']);
    if (wa) g.push(['wa', 'whatsapp', 'WhatsApp', 'wa']);
    if (w && active) g.push(['reschedule', 'calendar-clock', 'Reagendar', '']);
    if (w && st !== 'cancelled') g.push(['edit', 'edit', 'Editar', '']);
    if (w && active && started) g.push(['noshow', 'user-x', 'No asistió', '']);
    if (w && (st === 'completed' || st === 'no_show')) g.push(['undo', 'undo', 'Deshacer', '']);
    if (w && st === 'cancelled') g.push(['restore', 'refresh', 'Restaurar', 'brand']);
    if (w && !active) g.push(['again', 'calendar-plus', 'Agendar otra', '']);
    if (w && active) g.push(['cancel', 'calendar-x', 'Cancelar', 'danger']);
    return { primary, grid: g.filter((x) => !primary || x[0] !== primary.k) };
  }

  function panelHtml() {
    const { events = [], payments = [], messages = [] } = data;
    if (tab === 'payments') {
      if (!payments.length) return '<p class="muted" style="font-size:14px;padding:6px 0">Aún no hay pagos registrados para esta cita.</p>';
      return '<div class="list ad-list">' + payments.slice().reverse().map((p) => {
        const ref = p.status === 'refunded';
        const ic = p.method === 'card' ? 'card' : p.method === 'transfer' ? 'transfer' : 'cash';
        return '<div class="list-item"><span class="pc-ico" style="width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--ok-soft);color:var(--ok);flex:none">' + icon(ic, 'ic-sm') + '</span>' +
          '<div class="grow"><div class="title" style="' + (ref ? 'text-decoration:line-through;color:var(--text-3)' : '') + '">' + esc(money(p.amount)) + (p.tip ? ' <span class="muted" style="font-weight:500">+ ' + esc(money(p.tip)) + ' propina</span>' : '') + '</div>' +
          '<div class="meta">' + esc((METHOD[p.method] || p.method) + ' · ' + dateTimeIso(p.created_at)) + '</div></div>' +
          (ref ? '<span class="trail"><span class="badge warn">Reembolsado</span></span>' : '') + '</div>';
      }).join('') + '</div>';
    }
    if (tab === 'messages') {
      if (!messages.length) return '<p class="muted" style="font-size:14px;padding:6px 0">No se le ha enviado ningún mensaje por esta cita.</p>';
      return '<div class="list ad-list">' + messages.slice().reverse().map((x) => {
        const s = MSG_STATUS[x.status] || [x.status, ''];
        return '<details class="list-item" style="display:block"><summary style="list-style:none;display:flex;align-items:center;gap:10px;cursor:pointer">' +
          '<span style="width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:rgba(37,211,102,.14);color:#1FAF54;flex:none">' + icon('whatsapp', 'ic-sm') + '</span>' +
          '<span class="grow"><span class="title" style="display:block">' + esc((WA_KINDS[x.kind] || ['Mensaje libre'])[0]) + '</span><span class="meta">' + esc(ago(x.created_at)) + (x.to_phone ? ' · ' + esc(fmtPhone(x.to_phone)) : '') + '</span></span>' +
          '<span class="badge ' + s[1] + '">' + esc(s[0]) + '</span></summary><div class="ad-msg-body">' + esc(x.body) + '</div></details>';
      }).join('') + '</div>';
    }
    if (!events.length) return '<p class="muted" style="font-size:14px">Sin movimientos todavía.</p>';
    return '<div class="timeline">' + events.slice().reverse().map((ev) => {
      const i = eventInfo(ev, names);
      return '<div class="ev"><span class="d ' + i.tone + '">' + icon(i.ic) + '</span><div><div>' + esc(i.text) + '</div>' + (i.sub ? '<div class="ad-sub">' + esc(i.sub) + '</div>' : '') +
        '<div class="t">' + esc(ago(ev.created_at)) + (ev.actor_name ? ' · ' + esc(ev.actor_name) : '') + '</div></div></div>';
    }).join('') + '</div>';
  }

  function paint() {
    const a = data.appointment, cl = data.client;
    const st = a.status;
    const color = a.staff_color || '#8C8577';
    m.setTitle(a.client_name || 'Cliente');
    if (sub) sub.textContent = relDay(a.date, today()) + ' · ' + time(a.start_min) + ' con ' + firstName(a.staff_name);
    const { primary, grid } = actionsFor(a);
    const paidFull = a.paid > 0 && a.balance <= 0;
    const tags = cl && Array.isArray(cl.tags) ? cl.tags : [];
    const noteVal = a.internal_note || '';
    m.body.innerHTML = String(html`<div class="ad">
      <div class="ad-hero st-${st}" style="--c:${color};--c-rgb:${hexRgb(color)}">
        <div class="ad-badges">${statusBadge(st)}
          ${a.first_visit ? html`<span class="tag">Primera visita</span>` : ''}
          ${paidFull ? html`<span class="badge ok">Pagada</span>` : ''}
          ${a.source && a.source !== 'manual' ? html`<span class="badge plain">${SOURCE[a.source] || a.source}</span>` : ''}
          <span class="ad-folio">${a.folio || ''}</span></div>
        <div class="ad-day">${['Hoy', 'Mañana', 'Ayer'].includes(relDay(a.date, today())) ? relDay(a.date, today()) + ' · ' : ''}${dateLongCap(a.date)}</div>
        <div class="ad-time">${time(a.start_min)}<small>–${time(a.end_min)}</small></div>
        <div class="ad-staff">${avatar(a.staff_name, { size: 'sm', color })}<span>con <b>${a.staff_name}</b> · ${duration(a.duration_min || (a.end_min - a.start_min))}</span></div>
      </div>
      ${st === 'cancelled' ? html`<div class="banner warn">${raw(icon('x-circle'))}<div class="grow"><b>Cancelada${a.cancelled_by === 'client' ? ' por el cliente' : ''}.</b>${a.cancel_reason ? ' Motivo: ' + a.cancel_reason : ''}</div></div>` : ''}
      ${st === 'no_show' ? html`<div class="banner err">${raw(icon('user-x'))}<div class="grow"><b>No asistió.</b> Si llegó tarde y sí lo atendiste, toca «Sí vino».</div></div>` : ''}
      <div class="ad-contact">
        ${avatar(a.client_name)}
        <div class="grow"><div class="t truncate">${a.client_name || 'Cliente'}</div>
          <div class="m truncate">${a.client_phone ? fmtPhone(a.client_phone) : 'Sin teléfono'}${cl && cl.email ? ' · ' + cl.email : ''}</div>
          ${tags.length ? html`<div class="ad-tags">${tags.slice(0, 4).map((t) => html`<span class="tag">${t}</span>`)}</div>` : ''}</div>
        ${a.client_phone ? html`<a class="btn btn-secondary btn-icon" href="tel:${a.client_phone}" aria-label="Llamar a ${a.client_name}">${raw(icon('phone'))}</a>` : ''}
        ${a.client_id && canClient() ? html`<a class="btn btn-secondary btn-icon" href="#/clientes/${a.client_id}" data-nav aria-label="Ver ficha del cliente">${raw(icon('user'))}</a>` : ''}
      </div>
      ${grid.length ? html`<div class="ad-acts">${grid.map(([k, ic, label, tone]) => html`<button type="button" class="ad-act ${tone}" data-act="${k}">${raw(icon(ic))}<span>${label}</span></button>`)}</div>` : ''}
      <div class="ad-card">
        ${(a.services || []).map((s) => html`<div class="ad-line"><span>${s.name} <span class="faint">· ${duration(s.duration_min)}</span></span><span class="num">${money(s.price)}</span></div>`)}
        <div class="ad-line total"><span>Total</span><span class="num">${money(a.total)}</span></div>
        ${a.paid > 0 ? html`<div class="ad-line"><span class="muted">Pagado</span><span class="num ok-t">${money(a.paid)}</span></div>` : ''}
        ${a.balance > 0 && st !== 'cancelled' && (a.paid > 0 || st === 'completed') ? html`<div class="ad-line"><span class="muted">Por cobrar</span><span class="num warn-t">${money(a.balance)}</span></div>` : ''}
      </div>
      ${a.client_note ? html`<div class="ad-note-q"><div class="label">${raw(icon('message'))}Lo que pidió el cliente</div>“${a.client_note}”</div>` : ''}
      ${cl && cl.notes ? html`<div class="ad-note-q"><div class="label">${raw(icon('note'))}De su ficha</div>${cl.notes}</div>` : ''}
      <div class="field ad-inote"><label for="adNote">Nota interna <span class="opt">· solo la ve el equipo</span></label>
        <textarea class="textarea" id="adNote" rows="2" maxlength="1000" placeholder="${canWrite() ? 'Ej. Prefiere el degradado bajo; trae su propia cera' : 'Sin nota'}" ${canWrite() ? '' : 'readonly'}>${noteVal}</textarea>
        <div class="row end" id="adNoteBar" hidden><button type="button" class="btn btn-ghost btn-sm" data-act="note-reset">Descartar</button><button type="button" class="btn btn-primary btn-sm" data-act="note-save">Guardar nota</button></div>
      </div>
      <div>
        <div class="tabs ad-tabs" role="tablist" aria-label="Actividad de la cita">
          <button type="button" role="tab" data-tab="history" aria-selected="${String(tab === 'history')}">Historial</button>
          <button type="button" role="tab" data-tab="payments" aria-selected="${String(tab === 'payments')}">Pagos<span class="n">${(data.payments || []).length || ''}</span></button>
          <button type="button" role="tab" data-tab="messages" aria-selected="${String(tab === 'messages')}">Mensajes<span class="n">${(data.messages || []).length || ''}</span></button>
        </div>
        <div class="ad-panel" role="tabpanel">${raw(panelHtml())}</div>
      </div>
    </div>`);
    if (primary) {
      m.foot.hidden = false;
      m.foot.innerHTML = '<button type="button" class="btn ' + primary.cls + ' btn-lg" data-act="' + esc(primary.k) + '" style="flex:1;max-width:420px;margin-left:auto">' + icon(primary.ic) + esc(primary.label) + '</button>';
    } else { m.foot.hidden = true; m.foot.innerHTML = ''; }
  }

  async function act(k, btn) {
    const a = data && data.appointment;
    if (!a) return;
    const after = () => {}; // cada acción emite 'appointments:changed' y el detalle se recarga solo
    if (k.startsWith('wa:')) { btn.setAttribute('aria-busy', 'true'); await sendAppointmentWhatsApp(a, k.slice(3)); btn.removeAttribute('aria-busy'); return reload(); }
    switch (k) {
      case 'confirm': return after(await setAppointmentStatus(a, 'confirmed', { btn }));
      case 'complete': return after(await setAppointmentStatus(a, 'completed', { btn }));
      case 'noshow': return after(await setAppointmentStatus(a, 'no_show', { btn }));
      case 'undo': case 'restore': return after(await setAppointmentStatus(a, 'confirmed', { btn }));
      case 'cancel': return after(await cancelAppointment(a));
      case 'reschedule': return after(await openReschedule(a));
      case 'edit': return after(await openEditAppointment(a));
      case 'pay': { await chargeAppointment(a, reload); return reload(); }
      case 'wa': return whatsappMenu(btn, a, reload);
      case 'again': {
        m.close();
        return openNewAppointment({ client: a.client_id ? { id: a.client_id, name: a.client_name, phone: a.client_phone } : null, services: (a.services || []).map((s) => s.id), staff_id: a.staff_id });
      }
      case 'note-reset': { const t = $('#adNote', m.body); t.value = a.internal_note || ''; $('#adNoteBar', m.body).hidden = true; return; }
      case 'note-save': {
        const t = $('#adNote', m.body);
        try {
          const out = await busy(btn, api.patch('/appointments/' + a.id, { internal_note: t.value.trim() }));
          toast.success(t.value.trim() ? 'Nota guardada' : 'Nota borrada');
          data.appointment = Object.assign({}, a, out); latest = data.appointment;
          emit(a.id, 'note');
        } catch (e) { toast.error(e); }
      }
    }
  }

  m.el.addEventListener('click', (e) => {
    if (e.target.closest('#adRetry')) { m.body.innerHTML = skelDetail(); return load(); }
    const nav = e.target.closest('a[href^="#"]');
    if (nav) { m.close(); return; }
    const tb = e.target.closest('[data-tab]');
    if (tb) {
      tab = tb.dataset.tab;
      $$('[data-tab]', m.body).forEach((x) => x.setAttribute('aria-selected', String(x === tb)));
      const p = $('.ad-panel', m.body); if (p) { p.innerHTML = panelHtml(); p.style.animation = 'none'; void p.offsetWidth; p.style.animation = ''; }
      return;
    }
    const b = e.target.closest('[data-act]');
    if (b && m.el.contains(b) && b.getAttribute('aria-busy') !== 'true') act(b.dataset.act, b);
  });
  m.el.addEventListener('input', (e) => {
    if (e.target.id !== 'adNote' || !data) return;
    const dirty = e.target.value.trim() !== (data.appointment.internal_note || '').trim();
    const bar = $('#adNoteBar', m.body); if (bar) bar.hidden = !dirty;
    e.target.style.height = 'auto'; e.target.style.height = Math.min(220, e.target.scrollHeight + 2) + 'px';
  });
  m.el.addEventListener('keydown', (e) => {
    if (e.target.id === 'adNote' && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); const b = $('[data-act="note-save"]', m.body); if (b && !$('#adNoteBar', m.body).hidden) b.click(); }
  });
  load();
  return m.done.then(() => latest);
}

// ═════════════════════════════════════════════════════════════════════
// Nueva / editar
// ═════════════════════════════════════════════════════════════════════
export function openNewAppointment(prefill) { return openForm({ prefill: prefill || {} }); }
export function openEditAppointment(appt) { return openForm({ appt }); }

function skelForm() {
  const sec = (h) => '<div class="stack-sm"><div class="skel skel-line" style="width:30%;height:14px"></div><div class="skel" style="height:' + h + 'px;border-radius:12px"></div></div>';
  return '<div class="stack-lg" aria-busy="true" aria-label="Cargando formulario">' + sec(46) + sec(120) + sec(52) + sec(150) + '</div>';
}

async function openForm({ prefill, appt }) {
  ensureStyles();
  if (!canWrite()) { toast.error('Tu rol no puede agendar citas.'); return null; }
  const edit = !!appt;
  const a = appt || {};
  prefill = Object.assign({}, prefill || {});
  if (!edit && !prefill.date) {
    const { path, query } = parseHash();
    if (path === '/agenda') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(query.fecha || '') && query.fecha >= today()) prefill.date = query.fecha;
      if (query.barbero && !prefill.staff_id) prefill.staff_id = query.barbero;
    }
  }
  let result = null, dirty = false, saving = false;
  const m = modal({
    title: edit ? 'Editar cita' : 'Nueva cita',
    subtitle: edit ? (a.client_name || 'Cliente') + ' · Folio ' + (a.folio || '') : 'Cliente, servicios, barbero y horario',
    size: 'lg', body: skelForm(), footerHtml: ' ', dismissible: false
  });
  m.foot.hidden = true;
  const askClose = async () => {
    if (saving) return;
    if (dirty && !result && !(await confirmDialog({ title: edit ? '¿Descartar los cambios?' : '¿Descartar esta cita?', message: 'Lo que escribiste no se guardará.', confirmText: 'Descartar', cancelText: 'Seguir editando', danger: true, icon: 'trash' }))) return;
    m.close(result);
  };
  m.el.querySelector('[data-close]').onclick = askClose;
  m.el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); askClose(); } });

  let services, staff, avail;
  try {
    [services, staff, avail] = await Promise.all([getServices(), staffOptions(), availability()]);
  } catch (e) {
    m.body.innerHTML = String(errorState(e, 'apfRetry'));
    m.body.addEventListener('click', (ev) => { if (ev.target.closest('#apfRetry')) { m.close(); openForm({ prefill, appt }); } });
    return m.done.then(() => null);
  }
  const barberOnly = !canAll();
  const showStaff = !barberOnly && staff.length > 1;
  let staffId = edit ? a.staff_id : (barberOnly ? (me() && me().id) : (prefill.staff_id && staff.some((s) => s.id === prefill.staff_id) ? prefill.staff_id : (staff.length === 1 ? staff[0].id : '')));
  let date = edit ? a.date : (prefill.date || today());
  let source = prefill.source === 'walkin' ? 'walkin' : 'manual';
  let sourceTouched = false;
  const clientInit = edit
    ? (a.client_id ? { id: a.client_id, name: a.client_name || 'Cliente', phone: a.client_phone || '' } : null)
    : (prefill.client && prefill.client.id ? { id: prefill.client.id, name: prefill.client.name || 'Cliente', phone: prefill.client.phone || '', stats: prefill.client.stats || null } : null);
  const n = (i) => i - (showStaff ? 0 : (i > 2 ? 1 : 0));
  const hasNotes = !!(edit && (a.internal_note || a.client_note));

  m.body.innerHTML = String(html`<form id="apf" class="apf" novalidate autocomplete="off">
    <section class="apf-sec" data-s="client"><div class="apf-label"><span class="apf-n">1</span>Cliente</div>
      <div class="field" data-f="client"><div id="apfClient"></div><p class="error">Elige un cliente.</p></div></section>
    <section class="apf-sec" data-s="services"><div class="apf-label"><span class="apf-n">2</span>Servicios<span class="apf-aside" id="apfSvcSum"></span></div>
      <div class="field" data-f="services"><div id="apfSvc"></div><p class="error">Elige al menos un servicio.</p></div></section>
    ${showStaff ? html`<section class="apf-sec" data-s="staff"><div class="apf-label"><span class="apf-n">3</span>Barbero</div>
      <div class="field" data-f="staff_id"><div id="apfStaff"></div><p class="error">Elige quién atiende.</p></div></section>` : ''}
    <section class="apf-sec" data-s="when"><div class="apf-label"><span class="apf-n">${n(4)}</span>Día y hora${barberOnly ? html`<span class="apf-aside">Tu agenda</span>` : ''}</div>
      <div class="field" data-f="date"><div id="apfDays"></div><p class="error"></p></div>
      <div class="field" data-f="start_min"><div id="apfSlots"></div><p class="error">Elige un horario.</p></div></section>
    <details class="apf-more" ${hasNotes ? 'open' : ''}>
      <summary>${edit ? 'Notas' : 'Notas y detalles'} <span class="faint" style="font-weight:500">(opcional)</span>${raw(icon('chevron-down', 'ic-sm'))}</summary>
      <div class="stack" style="margin-top:10px">
        ${edit ? '' : html`<div class="field" data-f="source"><span class="label">¿Cómo llegó?</span>
          <div class="seg" role="group" aria-label="Origen de la cita" style="width:100%">
            <button type="button" data-src="manual" aria-pressed="${String(source === 'manual')}" style="flex:1">Con cita</button>
            <button type="button" data-src="walkin" aria-pressed="${String(source === 'walkin')}" style="flex:1">Sin cita (llegó directo)</button></div></div>
          <label class="check"><input type="checkbox" id="apfConfirmed" checked/> La cita ya está confirmada</label>`}
        <div class="field" data-f="internal_note"><label for="apfIn">Nota interna <span class="opt">· solo la ve el equipo</span></label>
          <textarea class="textarea" id="apfIn" rows="2" maxlength="1000" placeholder="Ej. Viene con su hijo; prefiere tijera">${a.internal_note || ''}</textarea><p class="error"></p></div>
        <div class="field" data-f="client_note"><label for="apfCn">Lo que pidió el cliente <span class="opt">(opcional)</span></label>
          <textarea class="textarea" id="apfCn" rows="2" maxlength="500" placeholder="Ej. Corte formal para una boda">${a.client_note || ''}</textarea><p class="error"></p></div>
      </div>
    </details>
  </form>`);
  m.foot.hidden = false;
  m.foot.innerHTML = '<div class="apf-sum grow" aria-live="polite"><span class="apf-total" id="apfTotal">$0</span><span class="apf-meta truncate" id="apfMeta">Elige servicios</span></div>' +
    '<button type="button" class="btn btn-secondary apf-cancel" data-apf-cancel>Cancelar</button>' +
    '<button type="submit" form="apf" class="btn btn-primary" id="apfSave">' + icon(edit ? 'check' : 'calendar-plus') + (edit ? 'Guardar cambios' : 'Agendar cita') + '</button>';

  const form = $('#apf', m.body);
  const fieldOf = (k) => $('[data-f="' + k + '"]', form);
  const clearErr = (k) => { const f = fieldOf(k); if (f) f.classList.remove('invalid'); };
  const setErr = (k, msg) => { const f = fieldOf(k); if (!f) return null; f.classList.add('invalid'); const p = f.querySelector(':scope > .error'); if (p && msg) p.textContent = msg; return f; };
  const markDone = () => {
    const c = client.get();
    $$('.apf-sec', form).forEach((s) => {
      const k = s.dataset.s;
      const ok = k === 'client' ? !!(c && (c.id || c.walkin || (c.new && c.name.length >= 2))) : k === 'services' ? svc.get().length > 0 : k === 'staff' ? !!staffId : k === 'when' ? !!slots.get() : false;
      s.classList.toggle('done', ok);
    });
  };
  const summary = () => {
    const t = svc.totals();
    $('#apfTotal', m.foot).textContent = money(t.price);
    const sl = slots.get();
    const bits = [];
    if (t.count) bits.push(plural(t.count, 'servicio') + ' · ' + duration(t.duration)); else bits.push('Elige servicios');
    if (sl) bits.push(relDay(date, today()) + ' ' + time(sl.start_min));
    $('#apfMeta', m.foot).textContent = bits.join(' · ');
    const s = $('#apfSvcSum', form); if (s) s.textContent = t.count ? duration(t.duration) + ' · ' + money(t.price) : '';
    markDone();
  };
  const touch = () => { dirty = true; };

  const client = pickClient($('#apfClient', form), {
    value: clientInit,
    onChange: (v) => {
      touch(); clearErr('client');
      if (v && v.walkin && !sourceTouched && !edit) setSource('walkin');
      markDone();
    }
  });
  const svc = servicesPicker($('#apfSvc', form), {
    services, staffId, value: edit ? (a.services || []).map((s) => s.id) : (prefill.services || []), extra: edit ? a.services : [],
    onChange: (ids) => { touch(); clearErr('services'); slots.load({ services: ids }); summary(); }
  });
  if (showStaff) {
    staffSelect($('#apfStaff', form), {
      staff, value: staffId,
      onChange: (id) => { touch(); staffId = id; clearErr('staff_id'); svc.setStaff(id); days.refresh(); slots.load({ staffId: id }); summary(); }
    });
  }
  const isOff = (d) => { const w = staffId && avail[staffId]; if (!w) return false; const bl = w[weekday(d)] || w[String(weekday(d))] || []; return !bl.length; };
  const days = dayStrip($('#apfDays', form), { value: date, today: today(), days: 45, isOff, onChange: (d) => { touch(); date = d; clearErr('date'); slots.load({ date: d }); summary(); } });
  const slots = slotChips($('#apfSlots', form), {
    date, services: svc.get(), staffId, exclude: edit ? a.id : undefined,
    value: edit ? a.start_min : (prefill.start_min != null ? prefill.start_min : null),
    original: edit ? { date: a.date, staff_id: a.staff_id, start_min: a.start_min } : null,
    onChange: () => { clearErr('start_min'); summary(); }
  });
  function setSource(s) {
    source = s;
    $$('[data-src]', form).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.src === s)));
  }
  form.addEventListener('click', (e) => { const b = e.target.closest('[data-src]'); if (b) { sourceTouched = true; touch(); setSource(b.dataset.src); } });
  form.addEventListener('input', (e) => { if (e.target.matches('textarea')) { touch(); clearErr(e.target.id === 'apfIn' ? 'internal_note' : 'client_note'); } });
  m.foot.addEventListener('click', (e) => { if (e.target.closest('[data-apf-cancel]')) askClose(); });
  summary();
  if (window.matchMedia('(min-width:720px)').matches && !edit && !clientInit) setTimeout(() => client.focus(), 80);

  function validate() {
    ['client', 'services', 'staff_id', 'start_min', 'date'].forEach(clearErr);
    const errs = [];
    const cErr = client.validate();
    if (cErr) errs.push(['client', cErr]);
    const cv = client.get();
    if (cv && cv.walkin && cv.name && cv.name.length < 2) errs.push(['client', 'El nombre debe tener al menos 2 letras (o déjalo vacío).']);
    if (!svc.get().length) errs.push(['services', 'Elige al menos un servicio.']);
    if (!staffId) errs.push(['staff_id', 'Elige quién atiende.']);
    if (!slots.get()) errs.push(['start_min', 'Elige un horario libre o toca «Otra hora».']);
    return errs;
  }
  function showErrs(errs) {
    let first = null;
    for (const [k, msg] of errs) { const f = setErr(k, msg); if (f && !first) first = f; }
    if (first) first.closest('.apf-sec, .apf-more').scrollIntoView({ behavior: 'smooth', block: 'center' });
    m.el.classList.remove('shake'); void m.el.offsetWidth; m.el.classList.add('shake');
  }
  function serverErrs(err) {
    const f = err && err.fields;
    if (!f) { toast.error(err); return; }
    const errs = [];
    let other = false;
    for (const [k, msg] of Object.entries(f)) {
      if (k === 'client.name' || k === 'client.phone' || k === 'client.email') {
        if (!client.fieldError(k.slice(7), msg)) errs.push(['client', msg]); else errs.push(['__', msg]);
      } else if (k === 'client' || k === 'client_id') errs.push(['client', msg]);
      else if (k === 'services') errs.push(['services', msg]);
      else if (k === 'staff_id') errs.push([showStaff ? 'staff_id' : 'start_min', msg]);
      else if (k === 'date') errs.push(['date', msg]);
      else if (k === 'start_min' || k === 'status') errs.push(['start_min', msg]);
      else if (k === 'internal_note' || k === 'client_note') { errs.push([k, msg]); const d = $('.apf-more', form); if (d) d.open = true; }
      else other = true;
    }
    showErrs(errs.filter((x) => x[0] !== '__'));
    if (other || !errs.length) toast.error(err);
  }

  async function ensureClientId(cv) {
    // Edición con cliente nuevo: se crea la ficha primero (si el teléfono ya existe, el servidor lo dice).
    const c = await api.post('/clients', { name: cv.name, phone: cv.phone || undefined });
    bus.emit('clients:changed', { id: c.id });
    return c.id;
  }

  async function save(btn, force) {
    const errs = validate();
    if (errs.length) { showErrs(errs); return; }
    const cv = client.get();
    const sl = slots.get();
    const ids = svc.get();
    const inote = $('#apfIn', form).value.trim();
    const cnote = $('#apfCn', form).value.trim();
    saving = true;
    try {
      let out;
      if (!edit) {
        const body = { staff_id: staffId, date, start_min: sl.start_min, services: ids, internal_note: inote || undefined, client_note: cnote || undefined, source, status: $('#apfConfirmed', form) && !$('#apfConfirmed', form).checked ? 'pending' : 'confirmed' };
        if (cv.id) body.client_id = cv.id;
        else if (cv.new) body.client = { name: cv.name, phone: cv.phone || undefined };
        else body.client = { name: cv.name || 'Cliente de paso' };
        if (force) body.force = true;
        out = await busy(btn, api.post('/appointments', body));
      } else {
        const body = {};
        const origIds = (a.services || []).map((s) => s.id);
        if (ids.join(',') !== origIds.join(',')) body.services = ids;
        if (staffId !== a.staff_id) body.staff_id = staffId;
        if (date !== a.date) body.date = date;
        if (sl.start_min !== a.start_min || body.date || body.staff_id) body.start_min = sl.start_min;
        if (inote !== (a.internal_note || '').trim()) body.internal_note = inote;
        if (cnote !== (a.client_note || '').trim()) body.client_note = cnote;
        if (cv && cv.id && cv.id !== a.client_id) body.client_id = cv.id;
        if (!Object.keys(body).length && !(cv && cv.new)) { toast.info('No hiciste cambios'); m.close(null); return; }
        if (cv && cv.new) body.client_id = await busy(btn, ensureClientId(cv));
        if (force) body.force = true;
        out = await busy(btn, api.patch('/appointments/' + a.id, body));
        result = out;
        const moved = body.date || body.staff_id || (body.start_min != null && body.start_min !== a.start_min);
        emit(out.id, 'edited');
        toast.success(moved ? 'Cita movida a ' + whenText(out).toLowerCase() : 'Cambios guardados', {
          action: moved && canMsg() && out.client_phone ? { label: 'Avisar por WhatsApp', onClick: () => sendAppointmentWhatsApp(out, 'reschedule') } : undefined
        });
        m.close(out);
        return;
      }
      result = out;
      emit(out.id, 'created');
      done(out);
    } catch (err) {
      if (err.status === 409 && err.code === 'slot_taken' && !force) {
        saving = false;
        const ok = await confirmDialog({ title: 'Ese horario no está libre', message: err.message + ' ¿Quieres ' + (edit ? 'guardarla' : 'agendarla') + ' de todas formas?', confirmText: edit ? 'Guardar de todas formas' : 'Agendar de todas formas', cancelText: 'Elegir otro horario', icon: 'alert' });
        if (ok) return save(btn, true);
        setErr('start_min', 'Elige otro horario o confirma que quieres empalmar la cita.');
        fieldOf('start_min').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (err.status === 409 && err.code === 'duplicate') { client.fieldError('phone', err.message); showErrs([['client', err.message]]); return; }
      serverErrs(err);
    } finally { saving = false; }
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); save($('#apfSave', m.foot)); });

  function done(out) {
    const wa = canMsg() && !!out.client_phone;
    m.setTitle('Cita agendada');
    const s = m.el.querySelector('.modal-head .sub'); if (s) s.textContent = '';
    m.body.innerHTML = String(html`<div class="apf-done" role="status">
      <div class="apf-check">${raw(icon('check'))}</div>
      <h3>¡Listo! Cita agendada</h3>
      <p><b>${out.client_name}</b> · ${whenText(out)} con ${out.staff_name}<br/>${(out.services || []).map((x) => x.name).join(', ')} · ${money(out.total)}</p>
      <div class="stack">
        ${wa ? html`<button type="button" class="btn btn-wa btn-lg btn-block" data-done="wa">${raw(icon('whatsapp'))}Enviar confirmación por WhatsApp</button>` : ''}
        <div class="row"><button type="button" class="btn btn-secondary grow" data-done="view">${raw(icon('eye'))}Ver cita</button>
        <button type="button" class="btn ${wa ? 'btn-ghost' : 'btn-primary'} grow" data-done="ok">Listo</button></div>
      </div></div>`);
    m.foot.hidden = true;
    toast.success('Cita agendada · ' + whenText(out));
    m.body.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-done]'); if (!b) return;
      if (b.dataset.done === 'wa') { await busy(b, sendAppointmentWhatsApp(out, 'confirmation')); m.close(out); }
      else if (b.dataset.done === 'view') { m.close(out); openAppointment(out.id); }
      else m.close(out);
    });
    const okBtn = $('[data-done="' + (wa ? 'wa' : 'ok') + '"]', m.body); if (okBtn) okBtn.focus({ preventScroll: true });
  }
  return m.done.then((v) => (v === undefined ? result : v) || result || null);
}

// ═════════════════════════════════════════════════════════════════════
// Reagendar (fecha + barbero + horarios libres)
// ═════════════════════════════════════════════════════════════════════
export async function openReschedule(a) {
  ensureStyles();
  if (!canWrite()) return null;
  let staff = [], avail = {};
  try { [staff, avail] = await Promise.all([staffOptions(), availability()]); } catch (e) { /* se usa lo mínimo */ }
  const multi = canAll() && staff.length > 1;
  let date = a.date, staffId = a.staff_id;
  const m = modal({
    title: 'Reagendar cita', subtitle: (a.client_name || 'Cliente') + ' · ahora: ' + whenText(a).toLowerCase(), size: 'lg',
    body: '<div class="apf">' + (multi ? '<section class="apf-sec"><div class="apf-label">Barbero</div><div id="rsStaff"></div></section>' : '') +
      '<section class="apf-sec"><div class="apf-label">Día</div><div id="rsDays"></div></section>' +
      '<section class="apf-sec"><div class="apf-label">Hora <span class="apf-aside">' + esc(duration(a.duration_min || (a.end_min - a.start_min))) + '</span></div><div class="field" data-f="start_min"><div id="rsSlots"></div><p class="error">Elige el nuevo horario.</p></div></section></div>',
    footerHtml: '<div class="apf-sum grow"><span class="apf-meta">Nuevo horario</span><span class="apf-total" id="rsSum" style="font-size:20px">—</span></div>' +
      '<button type="button" class="btn btn-secondary apf-cancel" data-rs="cancel">Cancelar</button><button type="button" class="btn btn-primary" data-rs="save">' + icon('calendar-clock') + 'Reagendar</button>'
  });
  const sum = () => { const s = slots.get(); $('#rsSum', m.foot).textContent = s ? relDay(date, today()) + ' · ' + time(s.start_min) : '—'; };
  if (multi) staffSelect($('#rsStaff', m.body), { staff, value: staffId, onChange: (id) => { staffId = id; days.refresh(); slots.load({ staffId: id }); sum(); } });
  const isOff = (d) => { const w = avail[staffId]; if (!w) return false; return !(w[weekday(d)] || []).length; };
  const days = dayStrip($('#rsDays', m.body), { value: date, today: today(), days: 45, isOff, onChange: (d) => { date = d; slots.load({ date: d }); sum(); } });
  const slots = slotChips($('#rsSlots', m.body), {
    date, services: (a.services || []).map((s) => s.id), staffId, exclude: a.id, value: a.start_min,
    original: { date: a.date, staff_id: a.staff_id, start_min: a.start_min },
    onChange: () => { const f = $('[data-f="start_min"]', m.body); if (f) f.classList.remove('invalid'); sum(); }
  });
  sum();
  let result = null;
  m.foot.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-rs]'); if (!b) return;
    if (b.dataset.rs === 'cancel') return m.close(null);
    const s = slots.get();
    if (!s) { $('[data-f="start_min"]', m.body).classList.add('invalid'); m.el.classList.remove('shake'); void m.el.offsetWidth; m.el.classList.add('shake'); return; }
    if (s.start_min === a.start_min && date === a.date && staffId === a.staff_id) { toast.info('Elige un día u hora diferente para reagendar.'); return; }
    const out = await moveAppointment(a, { date, start_min: s.start_min, staff_id: staffId }, { btn: b });
    if (out) { result = out; m.close(out); }
  });
  return m.done.then(() => result);
}
