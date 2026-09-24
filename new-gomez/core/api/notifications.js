// Centro de notificaciones del usuario actual en la barbería activa. Cada fila tiene UN destinatario:
// staff_id (dueño/barbero) o client_id (cliente). Superadmin sin ficha de staff en la barbería → lista vacía.
// Las filas se crean con domain/notify.js (reservas, cancelaciones, recordatorios pendientes…).
import { bad, nowIso, int, clamp } from '../util.js';

const PERM = 'notifications.read';
const MAX_IDS = 500;
const IN_CHUNK = 80;
const truthy = (v) => v === true || v === 1 || v === '1' || v === 'true';
const body = (ctx) => { const b = ctx.req.body; return b && typeof b === 'object' && !Array.isArray(b) ? b : {}; };

// Filtro del destinatario actual (sale de la sesión, nunca del cliente) o null si no tiene bandeja.
function recipient(ctx) {
  if (ctx.staff) return { staff_id: ctx.staff.id };
  if (ctx.client && !ctx.client.deleted_at) return { client_id: ctx.client.id };
  return null;
}
const unreadOf = (ctx, who) => ctx.sdb.count('notifications', Object.assign({}, who, { read_at: null }));

// GET /api/notifications?limit=&unread=1&before=<created_at ISO> (before: paginación opcional)
async function list(ctx) {
  const q = ctx.req.query;
  const errs = {};
  if (q.limit != null && q.limit !== '' && !Number.isFinite(Number(q.limit))) errs.limit = 'El límite debe ser un número.';
  let before = null;
  if (q.before != null && q.before !== '') {
    if (typeof q.before !== 'string' || q.before.length > 40 || isNaN(Date.parse(q.before))) errs.before = 'La fecha no es válida.';
    else before = q.before;
  }
  if (Object.keys(errs).length) throw bad(errs[Object.keys(errs)[0]], errs);
  const who = recipient(ctx);
  if (!who) return { items: [], unread: 0 };
  const limit = clamp(int(q.limit, 30), 1, 100);
  const where = Object.assign({}, who);
  if (truthy(q.unread)) where.read_at = null;
  if (before) where.created_at = { lt: before };
  const [items, unread] = await Promise.all([
    ctx.sdb.find('notifications', where, { order: ['created_at desc', 'id desc'], limit }),
    unreadOf(ctx, who)
  ]);
  return { items, unread };
}

// POST /api/notifications/read { ids:[…] } | { all:true } → { unread, updated }
async function markRead(ctx) {
  const b = body(ctx);
  const all = truthy(b.all);
  let ids = null;
  if (!all) {
    if (!Array.isArray(b.ids) || !b.ids.length) throw bad('Indica qué notificaciones marcar como leídas.', { ids: 'Elige al menos una notificación.' });
    if (b.ids.length > MAX_IDS) throw bad('Puedes marcar hasta ' + MAX_IDS + ' notificaciones a la vez.', { ids: 'Máximo ' + MAX_IDS + '.' });
    if (b.ids.some((x) => typeof x !== 'string' || !x || x.length > 64)) throw bad('La lista de notificaciones no es válida.', { ids: 'Identificador no válido.' });
    ids = [...new Set(b.ids)];
  }
  const who = recipient(ctx);
  if (!who) return { unread: 0, updated: 0 };
  // Solo las del destinatario actual: ids ajenos (u otra barbería) simplemente no coinciden.
  const where = Object.assign({}, who, { read_at: null });
  const patch = { read_at: nowIso() };
  let updated = 0;
  if (all) updated = await ctx.sdb.update('notifications', where, patch);
  else for (let i = 0; i < ids.length; i += IN_CHUNK) updated += await ctx.sdb.update('notifications', Object.assign({}, where, { id: { in: ids.slice(i, i + IN_CHUNK) } }), patch);
  return { unread: await unreadOf(ctx, who), updated };
}

export const routes = [
  { method: 'GET', path: '/api/notifications', auth: 'shop', perm: PERM, handler: list },
  { method: 'POST', path: '/api/notifications/read', auth: 'shop', perm: PERM, handler: markRead }
];
