// WhatsApp desde el panel: historial, preparar mensaje (plantilla → wa.me o cola), marcar estado y lista de
// recordatorios del día. Barbero (sin messages.read.all): solo mensajes de SUS citas y, si no son de una cita,
// de clientes que ha atendido o tiene agendados. Dueño/superadmin: toda la barbería.
import { bad, forbidden, notFound, conflict, nowIso, int, clamp, addDays, isDateKey, parseDateKey, dateKeyUTC } from '../util.js';
import { apptView } from '../domain/views.js';
import { shopSettings } from '../domain/settings.js';
import { ACTIVE, failIf, parseIds } from '../domain/appointments.js';
import {
  KINDS, APPT_KINDS, MESSAGE_STATUSES, MAX_BODY, composeMessage, recordMessage, messagePhone, validPhone, waLink,
  publicBase, bookingUrl, initialStatus, templateFor, buildVars, renderTemplate
} from '../domain/messages.js';

const PERM = 'messages.send';
const MARKS = ['opened', 'sent', 'failed'];
const IN_CHUNK = 80;
const NO_PHONE = 'Este cliente no tiene teléfono registrado.';

const body = (ctx) => { const b = ctx.req.body; return b && typeof b === 'object' && !Array.isArray(b) ? b : {}; };
const isRealDate = (k) => isDateKey(k) && dateKeyUTC(parseDateKey(k)) === k;

// null = ve todo; id = solo lo suyo.
function ownScope(ctx) {
  if (ctx.can('messages.read.all')) return null;
  if (!ctx.staff) throw forbidden();
  return ctx.staff.id;
}
// Identificador opcional (cita / cliente): undefined|null|'' → null.
function idIn(errs, field, v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || v.length > 64 || !/^[A-Za-z0-9_-]+$/.test(v)) { errs[field] = 'El identificador no es válido.'; return null; }
  return v;
}
async function findIn(sdb, table, ids, where) {
  const list = [...new Set(ids.filter(Boolean))];
  const out = [];
  for (let i = 0; i < list.length; i += IN_CHUNK) out.push(...await sdb.find(table, Object.assign({}, where || {}, { id: { in: list.slice(i, i + IN_CHUNK) } })));
  return out;
}
const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));

// Citas y clientes de un barbero (para filtrar mensajes).
async function ownSets(sdb, staffId) {
  const appts = await sdb.find('appointments', { staff_id: staffId });
  return { appts: new Set(appts.map((a) => a.id)), clients: new Set(appts.map((a) => a.client_id).filter(Boolean)) };
}
const visibleTo = (m, sets) => !sets || (m.appointment_id ? sets.appts.has(m.appointment_id) : !!m.client_id && sets.clients.has(m.client_id));

// Message (fila) + client_name y resumen de su cita (campos opcionales para listar sin más consultas).
async function messageViews(sdb, rows) {
  const [clients, appts] = await Promise.all([
    findIn(sdb, 'clients', rows.map((m) => m.client_id)),
    findIn(sdb, 'appointments', rows.map((m) => m.appointment_id))
  ]);
  const cl = byId(clients), ap = byId(appts);
  return rows.map((m) => {
    const a = m.appointment_id ? ap[m.appointment_id] : null;
    const c = m.client_id ? cl[m.client_id] : null;
    return Object.assign({}, m, {
      client_name: (c && c.name) || (a && a.client_name) || '',
      appointment: a ? { id: a.id, folio: a.folio, date: a.date, start_min: a.start_min, status: a.status, staff_id: a.staff_id } : null
    });
  });
}

async function getMessage(ctx) {
  const own = ownScope(ctx);
  const m = await ctx.sdb.findOne('messages', { id: String(ctx.params.id || '') });
  let ok = !!m;
  if (m && own) {
    if (m.appointment_id) ok = !!(await ctx.sdb.findOne('appointments', { id: m.appointment_id, staff_id: own }));
    else ok = !!m.client_id && (await ctx.sdb.count('appointments', { client_id: m.client_id, staff_id: own })) > 0;
  }
  if (!ok) throw notFound('No encontramos ese mensaje.');
  return m;
}

// ── GET /api/messages ──
async function list(ctx) {
  const q = ctx.req.query;
  const errs = {};
  const where = {};
  const appointment_id = idIn(errs, 'appointment_id', q.appointment_id);
  const client_id = idIn(errs, 'client_id', q.client_id);
  if (appointment_id) where.appointment_id = appointment_id;
  if (client_id) where.client_id = client_id;
  if (q.status) {
    const s = parseIds(q.status);
    if (s.some((x) => !MESSAGE_STATUSES.includes(x))) errs.status = 'Estado no válido.'; else where.status = { in: s };
  }
  if (q.kind) {
    const k = parseIds(q.kind);
    if (k.some((x) => !KINDS.includes(x))) errs.kind = 'Tipo de mensaje no válido.'; else where.kind = { in: k };
  }
  if (q.limit != null && q.limit !== '' && !Number.isFinite(Number(q.limit))) errs.limit = 'El límite debe ser un número.';
  failIf(errs);
  const limit = clamp(int(q.limit, 100), 1, 500);
  const order = ['created_at desc', 'id desc'];
  const own = ownScope(ctx);
  let rows;
  if (!own) rows = await ctx.sdb.find('messages', where, { order, limit });
  else {
    const sets = await ownSets(ctx.sdb, own);
    rows = (await ctx.sdb.find('messages', where, { order })).filter((m) => visibleTo(m, sets)).slice(0, limit);
  }
  return messageViews(ctx.sdb, rows);
}

// ── POST /api/messages/prepare ──
async function prepare(ctx) {
  const b = body(ctx);
  const errs = {};
  const kind = typeof b.kind === 'string' ? b.kind : '';
  if (!KINDS.includes(kind)) errs.kind = 'Elige el tipo de mensaje.';
  let text = null;
  if (b.body !== undefined && b.body !== null) {
    if (typeof b.body !== 'string') errs.body = 'El mensaje no es válido.';
    else {
      text = b.body.replace(/\r\n?/g, '\n').trim() || null;
      if (text && text.length > MAX_BODY) errs.body = 'El mensaje puede tener máximo ' + MAX_BODY + ' caracteres.';
    }
  }
  const appointment_id = idIn(errs, 'appointment_id', b.appointment_id);
  const client_id = idIn(errs, 'client_id', b.client_id);
  if (kind === 'custom' && !text && !errs.body) errs.body = 'Escribe el mensaje.';
  if (!appointment_id && !client_id && !errs.appointment_id && !errs.client_id) errs.appointment_id = 'Indica la cita o el cliente del mensaje.';
  else if (!appointment_id && !text && APPT_KINDS.includes(kind) && !errs.appointment_id) errs.appointment_id = 'Elige la cita para este mensaje.';
  failIf(errs);

  const own = ownScope(ctx);
  let appt = null;
  if (appointment_id) {
    appt = await ctx.sdb.findOne('appointments', { id: appointment_id });
    if (!appt || (own && appt.staff_id !== own)) throw notFound('No encontramos esa cita.');
    if (client_id && appt.client_id && client_id !== appt.client_id) throw bad('Ese cliente no corresponde a la cita.', { client_id: 'No corresponde a la cita.' });
  }
  let client = null;
  if (appt && appt.client_id) client = await ctx.sdb.findOne('clients', { id: appt.client_id, deleted_at: null });
  else if (client_id) {
    client = await ctx.sdb.findOne('clients', { id: client_id, deleted_at: null });
    // El barbero solo escribe a clientes que ha atendido o tiene agendados.
    if (!client || (own && !(await ctx.sdb.count('appointments', { client_id, staff_id: own })))) throw notFound('No encontramos ese cliente.');
  }
  const phone = messagePhone(client, appt);
  if (!phone) throw bad(NO_PHONE, { phone: 'Agrega su teléfono en la ficha del cliente.' });
  if (!validPhone(phone)) throw bad('El teléfono de este cliente no es válido. Corrígelo en su ficha.', { phone: 'Teléfono no válido.' });

  const text2 = text || await composeMessage({ sdb: ctx.sdb, shop: ctx.shop }, { kind, appt, client, base: publicBase(ctx.env, ctx.req.headers), withToken: true });
  if (!text2) throw bad('No hay plantilla para ese tipo de mensaje. Escribe el texto.', { body: 'Escribe el mensaje.' });
  const cc = shopSettings(ctx.shop).whatsapp.country_code;
  const wa_link = waLink(phone, text2, cc);
  // Vista previa (opcional): arma el texto (y rota el enlace de gestión) sin registrar el mensaje.
  if (b.preview === true) return { message: null, body: text2, to_phone: phone, wa_link, preview: true };
  const row = await recordMessage(ctx.sdb, {
    appointment_id: appt ? appt.id : null, client_id: client ? client.id : (appt ? appt.client_id : null),
    kind, to_phone: phone, body: text2, status: initialStatus(ctx.shop)
  }, ctx.actor);
  return { message: (await messageViews(ctx.sdb, [row]))[0], body: text2, to_phone: phone, wa_link };
}

// ── PATCH /api/messages/:id ──
async function mark(ctx) {
  const m = await getMessage(ctx);
  const b = body(ctx);
  const status = typeof b.status === 'string' ? b.status : '';
  if (!MARKS.includes(status)) throw bad('Elige un estado válido: abierto, enviado o fallido.', { status: 'Usa opened, sent o failed.' });
  if (m.status === 'sent' && status !== 'sent') throw conflict('Este mensaje ya se marcó como enviado.');
  const at = nowIso();
  if (m.status !== status) {
    const patch = { status };
    if (status === 'sent') patch.sent_at = at;
    await ctx.sdb.update('messages', { id: m.id }, patch);
    Object.assign(m, patch);
  }
  if (m.kind === 'reminder' && m.appointment_id && (status === 'opened' || status === 'sent')) {
    await ctx.sdb.update('appointments', { id: m.appointment_id }, { reminder_sent_at: at });
  }
  return (await messageViews(ctx.sdb, [m]))[0];
}

// ── GET /api/reminders ──
// Citas pendientes/confirmadas de la fecha (por defecto mañana en la zona de la barbería) con el texto del
// recordatorio listo. El {enlace} aquí es el link de reservas: el de gestión (token nuevo) se genera al
// preparar el mensaje con POST /api/messages/prepare { appointment_id, kind:'reminder' }.
async function reminders(ctx) {
  const q = ctx.req.query;
  let date;
  if (q.date == null || q.date === '') date = addDays(ctx.now().date, 1);
  else if (isRealDate(q.date)) date = q.date;
  else throw bad('La fecha no es válida.', { date: 'Usa el formato AAAA-MM-DD.' });
  const own = ownScope(ctx);
  const where = { date, status: { in: ACTIVE } };
  if (own) where.staff_id = own;
  const rows = await ctx.sdb.find('appointments', where, { order: ['start_min asc', 'id asc'] });
  const [views, clients] = await Promise.all([apptView(ctx.sdb, rows), findIn(ctx.sdb, 'clients', rows.map((a) => a.client_id))]);
  const cl = byId(clients);
  const base = publicBase(ctx.env, ctx.req.headers);
  const link = bookingUrl(base, ctx.shop);
  const tpl = templateFor(ctx.shop, 'reminder');
  const cc = shopSettings(ctx.shop).whatsapp.country_code;
  const items = views.map((v) => {
    const client = v.client_id ? cl[v.client_id] || null : null;
    const phone = messagePhone(client && !client.deleted_at ? client : null, v);
    const text = renderTemplate(tpl, buildVars(ctx.shop, v, { client, staffName: v.staff_name, base, link }));
    return { appointment: v, body: text, to_phone: validPhone(phone) ? phone : '', wa_link: validPhone(phone) ? waLink(phone, text, cc) : null, reminded: !!v.reminder_sent_at };
  });
  return { date, items };
}

export const routes = [
  { method: 'GET', path: '/api/messages', auth: 'shop', perm: PERM, handler: list },
  { method: 'POST', path: '/api/messages/prepare', auth: 'shop', perm: PERM, handler: prepare },
  { method: 'PATCH', path: '/api/messages/:id', auth: 'shop', perm: PERM, handler: mark },
  { method: 'GET', path: '/api/reminders', auth: 'shop', perm: PERM, handler: reminders }
];
