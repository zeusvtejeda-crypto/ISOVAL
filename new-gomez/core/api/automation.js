// Integraciones externas con Authorization: Bearer <env.AUTOMATION_KEY> (proveedor de WhatsApp Cloud API,
// cron externo). Ver docs/API.md → "Automatización".
//
// EXCEPCIÓN DOCUMENTADA AL AISLAMIENTO: estas rutas no tienen barbería activa — la llave es de la PLATAFORMA,
// no de una barbería — y el proveedor atiende la cola de TODAS las barberías, así que leen `messages` y recorren
// barberías con ctx.db (sin scope). Nunca reciben un shop_id del cliente: toda escritura se hace con
// scopedDb(ctx.db, <shop_id de la fila guardada en la base>).
import { bad, notFound, conflict, nowIso, nowInTz, int, clamp, addDays, waNumber } from '../util.js';
import { scopedDb } from '../db.js';
import { shopSettings } from '../domain/settings.js';
import { notify } from '../domain/notify.js';
import { logEvent } from '../domain/events.js';
import { ACTIVE } from '../domain/appointments.js';
import { KIND_LABEL, composeMessage, recordMessage, messagePhone, validPhone, publicBase } from '../domain/messages.js';

const ACTOR = { id: null, name: 'Automatización', kind: 'system' };
const PROVIDER = { id: null, name: 'WhatsApp automático', kind: 'system' };
const IN_CHUNK = 80;
// Tope de recordatorios por corrida (cada uno son ~4 escrituras y D1 limita las consultas por petición).
// Lo que falte se encola en la siguiente corrida del cron (la operación es idempotente).
export const MAX_REMINDERS_PER_RUN = 150;
const body = (ctx) => { const b = ctx.req.body; return b && typeof b === 'object' && !Array.isArray(b) ? b : {}; };
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

async function findIn(sdb, table, col, ids, where) {
  const list = [...new Set(ids.filter(Boolean))];
  const out = [];
  for (let i = 0; i < list.length; i += IN_CHUNK) out.push(...await sdb.find(table, Object.assign({}, where || {}, { [col]: { in: list.slice(i, i + IN_CHUNK) } })));
  return out;
}

// GET /api/automation/outbox?limit= → mensajes `queued` (los más antiguos primero) de barberías activas.
async function outbox(ctx) {
  const q = ctx.req.query;
  if (q.limit != null && q.limit !== '' && !Number.isFinite(Number(q.limit))) throw bad('El límite debe ser un número.', { limit: 'Número entre 1 y 200.' });
  const limit = clamp(int(q.limit, 50), 1, 200);
  const rows = await ctx.db.find('messages', { status: 'queued' }, { order: ['created_at asc', 'id asc'], limit: limit * 3 });
  const shops = Object.fromEntries((await findIn(ctx.db, 'shops', 'id', rows.map((m) => m.shop_id))).map((s) => [s.id, s]));
  return rows.filter((m) => shops[m.shop_id] && shops[m.shop_id].status === 'active').slice(0, limit).map((m) => ({
    id: m.id, shop_id: m.shop_id, to_phone: m.to_phone, body: m.body, kind: m.kind, appointment_id: m.appointment_id,
    // Opcionales: número internacional listo para la API del proveedor y datos para registros.
    wa_number: m.to_phone ? waNumber(m.to_phone, shopSettings(shops[m.shop_id]).whatsapp.country_code) : '',
    client_id: m.client_id, shop_name: shops[m.shop_id].name, created_at: m.created_at
  }));
}

// POST /api/automation/outbox/:id { status: sent|failed, provider_id?, error? } → Message
// queued → sent|failed · failed → sent|failed (reintento) · sent → sent (idempotente). Lo demás: 409.
async function report(ctx) {
  const m = await ctx.db.findOne('messages', { id: String(ctx.params.id || '').slice(0, 64) });
  if (!m) throw notFound('No encontramos ese mensaje.');
  const b = body(ctx);
  const errs = {};
  const status = typeof b.status === 'string' ? b.status : '';
  if (!['sent', 'failed'].includes(status)) errs.status = 'El estado debe ser sent o failed.';
  const text = (v, max, field) => {
    if (v === undefined || v === null || v === '') return null;
    if (typeof v !== 'string' && typeof v !== 'number') { errs[field] = 'Valor no válido.'; return null; }
    const s = String(v).trim();
    if (s.length > max) { errs[field] = 'Máximo ' + max + ' caracteres.'; return null; }
    return s || null;
  };
  const provider_id = text(b.provider_id, 200, 'provider_id');
  const error = text(b.error, 500, 'error');
  if (Object.keys(errs).length) throw bad(errs[Object.keys(errs)[0]], errs);
  if (m.status === 'sent') {
    if (status === 'sent') return m;
    throw conflict('Ese mensaje ya se marcó como enviado.');
  }
  if (!['queued', 'failed'].includes(m.status)) throw conflict('Ese mensaje no está en la cola de envío automático.');

  const sdb = scopedDb(ctx.db, m.shop_id);
  const at = nowIso();
  const patch = { status, provider_id: provider_id || m.provider_id || null, error: status === 'failed' ? (error || 'El proveedor no pudo enviar el mensaje.') : null };
  if (status === 'sent') patch.sent_at = at;
  await sdb.update('messages', { id: m.id }, patch);
  const out = Object.assign({}, m, patch);
  if (m.appointment_id) {
    await logEvent(sdb, m.appointment_id, 'message', { message_id: m.id, kind: m.kind, status, error: patch.error }, PROVIDER);
    if (m.kind === 'reminder') {
      if (status === 'sent') await sdb.update('appointments', { id: m.appointment_id, reminder_sent_at: null }, { reminder_sent_at: at });
      else if (!(await sdb.count('messages', { appointment_id: m.appointment_id, kind: 'reminder', status: { in: ['sent', 'opened'] } }))) {
        // Falló y no hay otro recordatorio entregado: la cita vuelve a verse "sin recordatorio" para mandarlo a mano.
        await sdb.update('appointments', { id: m.appointment_id }, { reminder_sent_at: null });
      }
    }
  }
  if (status === 'failed' && m.status !== 'failed') {
    const a = m.appointment_id ? await sdb.findOne('appointments', { id: m.appointment_id }) : null;
    const who = a ? a.client_name : (m.client_id ? ((await sdb.findOne('clients', { id: m.client_id })) || {}).name : '');
    await notify(sdb, 'owners', {
      type: 'system', title: 'No se pudo enviar un WhatsApp',
      body: (KIND_LABEL[m.kind] || 'Mensaje') + (who ? ' para ' + who : '') + '. Envíalo a mano desde el panel.',
      link: a ? '#/agenda?cita=' + a.id : '#/mensajes', data: { message_id: m.id, appointment_id: m.appointment_id || null }
    });
  }
  return out;
}

// POST /api/automation/reminders/run → { queued, shops, skipped, notified, more }
// Barberías activas en modo `auto`: encola el recordatorio de cada cita pendiente/confirmada de MAÑANA (en la zona
// horaria de cada barbería) sin reminder_sent_at ni un mensaje de recordatorio previo, y marca reminder_sent_at.
// Barberías en modo `manual`: avisa una vez por día (centro de notificaciones) cuántos recordatorios faltan.
// Pensado para un cron cada hora: es idempotente. more:true = se llegó al tope; vuelve a llamarlo.
async function runReminders(ctx) {
  const shops = await ctx.db.find('shops', { status: 'active' }, { order: 'created_at asc' });
  const base = publicBase(ctx.env, ctx.req.headers);
  let queued = 0, autoShops = 0, skipped = 0, notified = 0, more = false;
  for (const shop of shops) {
    if (more) break;
    const st = shopSettings(shop);
    const sdb = scopedDb(ctx.db, shop.id);
    const date = addDays(nowInTz(shop.timezone).date, 1);
    const appts = await sdb.find('appointments', { date, status: { in: ACTIVE }, reminder_sent_at: null }, { order: ['start_min asc', 'id asc'] });
    if (st.whatsapp.mode !== 'auto') { if (appts.length) notified += await nudgeManual(sdb, appts, date); continue; }
    autoShops++;
    if (!appts.length) continue;
    const ids = appts.map((a) => a.id);
    const prior = new Set((await findIn(sdb, 'messages', 'appointment_id', ids, { kind: 'reminder' })).map((m) => m.appointment_id));
    const clients = Object.fromEntries((await findIn(sdb, 'clients', 'id', appts.map((a) => a.client_id))).map((c) => [c.id, c]));
    const staff = Object.fromEntries((await sdb.find('staff', {})).map((s) => [s.id, s.name]));
    for (const a of appts) {
      if (prior.has(a.id)) continue;
      if (queued >= MAX_REMINDERS_PER_RUN) { more = true; break; }
      const cl = a.client_id && clients[a.client_id] && !clients[a.client_id].deleted_at ? clients[a.client_id] : null;
      const phone = messagePhone(cl, a);
      if (!validPhone(phone)) { skipped++; continue; }
      const text = await composeMessage({ sdb, shop }, { kind: 'reminder', appt: a, client: cl, base, withToken: true, staffName: staff[a.staff_id] || '' });
      if (!text) { skipped++; continue; }
      await recordMessage(sdb, { appointment_id: a.id, client_id: a.client_id, kind: 'reminder', to_phone: phone, body: text, status: 'queued', created_by: 'automation' }, ACTOR);
      await sdb.update('appointments', { id: a.id }, { reminder_sent_at: nowIso() });
      queued++;
    }
  }
  return { queued, shops: autoShops, skipped, notified, more };
}

// Modo manual: "Mañana hay N citas sin recordatorio" a dueños (total) y a cada barbero (las suyas), una vez por fecha.
async function nudgeManual(sdb, appts, date) {
  const since = new Date(Date.now() - 2 * 86400000).toISOString();
  const sent = await sdb.find('notifications', { type: 'reminder_due', created_at: { gte: since } });
  if (sent.some((n) => n.data && n.data.date === date)) return 0;
  const staff = Object.fromEntries((await sdb.find('staff', { active: true })).map((s) => [s.id, s]));
  const link = '#/mensajes';
  let n = await notify(sdb, 'owners', {
    type: 'reminder_due', title: 'Recordatorios de mañana',
    body: 'Mañana hay ' + plural(appts.length, 'cita', 'citas') + ' sin recordatorio. Envíalos por WhatsApp en un toque.',
    link, data: { date, count: appts.length }
  });
  const byStaff = {};
  for (const a of appts) byStaff[a.staff_id] = (byStaff[a.staff_id] || 0) + 1;
  for (const [id, count] of Object.entries(byStaff)) {
    if (!staff[id] || staff[id].role === 'owner') continue;
    n += await notify(sdb, 'staff:' + id, {
      type: 'reminder_due', title: 'Recordatorios de mañana',
      body: 'Mañana tienes ' + plural(count, 'cita', 'citas') + ' sin recordatorio. Envíalos por WhatsApp en un toque.',
      link, data: { date, count }
    });
  }
  return n;
}

export const routes = [
  { method: 'GET', path: '/api/automation/outbox', auth: 'automation', handler: outbox },
  { method: 'POST', path: '/api/automation/outbox/:id', auth: 'automation', handler: report },
  { method: 'POST', path: '/api/automation/reminders/run', auth: 'automation', handler: runReminders }
];
