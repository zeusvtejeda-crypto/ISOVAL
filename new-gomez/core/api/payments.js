// Cobros: pagos de citas y ventas sueltas (productos, servicios sin cita), reembolsos y totales.
// Barbero (payments.read.own): solo ve sus cobros y solo cobra sus propias citas.
// También exporta utilidades que reutilizan cash.js, commissions.js y reports.js (rangos, montos, alcance).
import { HttpError, forbidden, notFound, conflict, newId, nowIso, money, int, clamp, diffDays } from '../util.js';
import { shopSettings } from '../domain/settings.js';
import { logEvent } from '../domain/events.js';
import { failIf, textField, cleanText, canTransition, hasStarted, changeStatus } from '../domain/appointments.js';

export const METHODS = ['cash', 'card', 'transfer', 'other'];
export const METHOD_LABEL = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro' };
export const MAX_AMOUNT = 100000;        // tope por cobro (evita errores de captura: un cero de más)
export const MAX_RANGE_DAYS = 400;
const IN_CHUNK = 80;                     // D1 admite ~100 parámetros por sentencia
const IN_MAX_CHUNKS = 4;                 // más ids → una sola consulta amplia (db-d1 filtra en JS)

// ── Utilidades compartidas ──
// null = ve todo; id = solo lo suyo (permisos .own).
export function ownScope(ctx, allPerm) {
  if (ctx.can(allPerm)) return null;
  if (!ctx.staff) throw forbidden();
  return ctx.staff.id;
}
export const body = (ctx) => { const b = ctx.req.body; return b && typeof b === 'object' && !Array.isArray(b) ? b : {}; };
export const truthy = (v) => v === true || v === 1 || v === '1' || v === 'true';

// 'AAAA-MM-DD' real (rechaza 2026-02-30) entre 2000 y 2100 → la misma cadena | null.
export function dateKey(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return y >= 2000 && y <= 2100 && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? v : null;
}

// from/to obligatorios → { from, to, days } (días inclusivos). Los errores van a errs por campo.
export function parseRange(errs, q, { max = MAX_RANGE_DAYS, fromKey = 'from', toKey = 'to' } = {}) {
  q = q || {};
  const from = dateKey(q[fromKey]), to = dateKey(q[toKey]);
  if (!from) errs[fromKey] = q[fromKey] ? 'La fecha inicial no es válida (AAAA-MM-DD).' : 'Indica la fecha inicial.';
  if (!to) errs[toKey] = q[toKey] ? 'La fecha final no es válida (AAAA-MM-DD).' : 'Indica la fecha final.';
  let days = 0;
  if (from && to) {
    days = diffDays(from, to) + 1;
    if (to < from) errs[toKey] = 'La fecha final debe ser igual o posterior a la inicial.';
    else if (days > max) errs[toKey] = 'El rango máximo es de ' + max + ' días.';
  }
  return { from, to, days };
}

// Monto de dinero: número o texto ('250', '$1,250.50'). Redondea a centavos.
function parseAmount(v) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  let s = v.trim().replace(/^\$\s*/, '').replace(/\s+/g, '');
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  return /^-?(\d+(\.\d*)?|\.\d+)$/.test(s) ? Number(s) : NaN;
}
// opts: { label ('el monto'), required, positive (> 0), max }
export function moneyField(errs, field, v, { label = 'el monto', required = true, positive = false, max = MAX_AMOUNT } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) errs[field] = 'Escribe ' + label + '.';
    return 0;
  }
  const n = parseAmount(v);
  if (!Number.isFinite(n)) { errs[field] = 'Escribe ' + label + ' con números (p. ej. 250 o 250.50).'; return 0; }
  if (n < 0) { errs[field] = 'No se permiten montos negativos.'; return 0; }
  if (positive && money(n) <= 0) { errs[field] = 'Escribe un monto mayor a cero.'; return 0; }
  if (n > max) { errs[field] = 'El monto máximo es de ' + fmtMoney(max) + '.'; return 0; }
  return money(n);
}

export function fmtMoney(n, currency) {
  const v = money(n);
  try { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency || 'MXN' }).format(v); } catch (e) { return '$' + v.toFixed(2); }
}

// find con lista IN: hasta IN_CHUNK*IN_MAX_CHUNKS ids en trozos exactos; más, en una sola consulta.
export async function findIn(sdb, table, col, ids, where, opts) {
  const uniq = [...new Set((ids || []).filter(Boolean))];
  if (!uniq.length) return [];
  if (uniq.length > IN_CHUNK * IN_MAX_CHUNKS) return sdb.find(table, Object.assign({}, where || {}, { [col]: { in: uniq } }), opts);
  const parts = [];
  for (let i = 0; i < uniq.length; i += IN_CHUNK) parts.push(uniq.slice(i, i + IN_CHUNK));
  const res = await Promise.all(parts.map((p) => sdb.find(table, Object.assign({}, where || {}, { [col]: { in: p } }), opts)));
  return [].concat(...res);
}

// Formas de pago activas de la barbería (settings.payments.methods ∩ las conocidas).
export function shopMethods(shop) {
  const list = (shopSettings(shop).payments || {}).methods;
  const out = (Array.isArray(list) ? list : []).filter((m) => METHODS.includes(m));
  return out.length ? out : ['cash'];
}

// Caja abierta de la barbería (o null).
export async function openCashSession(sdb) {
  return (await sdb.find('cash_sessions', { status: 'open' }, { order: ['opened_at asc', 'id asc'], limit: 1 }))[0] || null;
}

// Totales de una lista de pagos (solo `paid`). by_method = montos sin propina.
export function paymentTotals(rows) {
  const t = { amount: 0, tip: 0, count: 0, by_method: { cash: 0, card: 0, transfer: 0, other: 0 }, total: 0, refunded: 0, refunded_count: 0 };
  for (const p of rows) {
    if (p.status === 'refunded') { t.refunded += Number(p.amount) || 0; t.refunded_count++; continue; }
    if (p.status !== 'paid') continue;
    const a = Number(p.amount) || 0, tip = Number(p.tip) || 0;
    t.amount += a; t.tip += tip; t.count++;
    t.by_method[METHODS.includes(p.method) ? p.method : 'other'] += a;
  }
  t.amount = money(t.amount); t.tip = money(t.tip); t.total = money(t.amount + t.tip); t.refunded = money(t.refunded);
  for (const k of METHODS) t.by_method[k] = money(t.by_method[k]);
  return t;
}

// Payment: fila + staff_name, client_name, folio (de la cita) y total (monto + propina). 3 consultas máx.
export async function paymentViews(sdb, rows) {
  const single = !Array.isArray(rows);
  const list = single ? [rows] : rows;
  if (!list.length) return single ? null : [];
  const [staff, clients, appts] = await Promise.all([
    sdb.find('staff', {}),
    findIn(sdb, 'clients', 'id', list.map((p) => p.client_id)),
    findIn(sdb, 'appointments', 'id', list.map((p) => p.appointment_id))
  ]);
  const sName = Object.fromEntries(staff.map((s) => [s.id, s.name]));
  const cName = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  const apById = Object.fromEntries(appts.map((a) => [a.id, a]));
  const out = list.map((p) => {
    const ap = p.appointment_id ? apById[p.appointment_id] : null;
    return Object.assign({}, p, {
      staff_name: p.staff_id ? (sName[p.staff_id] || '') : '',
      client_name: (p.client_id && cName[p.client_id]) || (ap && ap.client_name) || '',
      folio: ap ? ap.folio : '',
      total: money((Number(p.amount) || 0) + (Number(p.tip) || 0))
    });
  });
  return single ? out[0] : out;
}

const dom = (ctx) => ({ sdb: ctx.sdb, shop: ctx.shop, now: ctx.now(), actor: ctx.actor, env: ctx.env });
const servicesConcept = (a) => cleanText((a.services || []).map((s) => s.name).join(', ') || ('Cita ' + (a.folio || '')), 120);

// ── Handlers ──
async function list(ctx) {
  const q = ctx.req.query;
  const errs = {};
  const r = parseRange(errs, q);
  const own = ownScope(ctx, 'payments.read.all');
  let staff_id = q.staff_id ? String(q.staff_id) : '';
  if (own && staff_id && staff_id !== own) throw forbidden('Solo puedes ver tus propios cobros.');
  if (own) staff_id = own;
  const method = q.method ? String(q.method) : '';
  if (method && !METHODS.includes(method)) errs.method = 'Forma de pago no válida.';
  const status = q.status ? String(q.status) : '';
  if (status && !['paid', 'refunded'].includes(status)) errs.status = 'Estado no válido (paid o refunded).';
  failIf(errs);
  const where = { date: { gte: r.from, lte: r.to } };
  if (staff_id) where.staff_id = staff_id;
  if (method) where.method = method;
  if (status) where.status = status;
  if (q.client_id) where.client_id = String(q.client_id);
  if (q.appointment_id) where.appointment_id = String(q.appointment_id);
  const rows = await ctx.sdb.find('payments', where, { order: ['created_at desc', 'id desc'] });
  const limit = clamp(int(q.limit, 500), 1, 1000);
  return { items: await paymentViews(ctx.sdb, rows.slice(0, limit)), totals: paymentTotals(rows), total: rows.length };
}

async function create(ctx) {
  const b = body(ctx);
  const errs = {};
  const settings = shopSettings(ctx.shop);
  const amount = moneyField(errs, 'amount', b.amount, { label: 'el monto' });
  const tip = moneyField(errs, 'tip', b.tip, { label: 'la propina', required: false });
  if (tip > 0 && settings.payments && settings.payments.tips === false) errs.tip = 'Esta barbería no tiene activadas las propinas.';
  if (!errs.amount && !errs.tip && amount + tip <= 0) errs.amount = 'Escribe un monto mayor a cero.';
  const method = b.method == null ? '' : String(b.method);
  if (!method) errs.method = 'Elige la forma de pago.';
  else if (!shopMethods(ctx.shop).includes(method)) errs.method = 'Esa forma de pago no está activa en la barbería.';
  const concept = textField(errs, 'concept', b.concept, 120, 'El concepto').replace(/\s+/g, ' ');
  const complete = truthy(b.complete);
  const apptId = b.appointment_id == null || b.appointment_id === '' ? '' : String(b.appointment_id);
  failIf(errs);

  const own = ownScope(ctx, 'payments.read.all');
  let appt = null, staff_id = null, client_id = null;
  if (apptId) {
    // Cobro de cita: barbero y cliente salen de la cita (se ignora lo que mande el cliente).
    appt = await ctx.sdb.findOne('appointments', { id: apptId });
    if (!appt || (own && appt.staff_id !== own)) throw notFound('No encontramos esa cita.');
    if (appt.status === 'cancelled') throw conflict('No se puede cobrar una cita cancelada. Si el cliente sí vino, restáurala primero.');
    staff_id = appt.staff_id;
    client_id = appt.client_id || null;
  } else {
    // Venta suelta: barbero y cliente opcionales, siempre de esta barbería.
    const sid = b.staff_id == null || b.staff_id === '' ? '' : String(b.staff_id);
    if (own && sid && sid !== own) throw forbidden('Solo puedes registrar cobros a tu nombre.');
    if (own) staff_id = own;
    else if (sid) {
      const st = await ctx.sdb.findOne('staff', { id: sid });
      if (!st) errs.staff_id = 'Ese barbero no existe.';
      else if (!st.active) errs.staff_id = 'Ese barbero está desactivado.';
      else staff_id = st.id;
    }
    const cid = b.client_id == null || b.client_id === '' ? '' : String(b.client_id);
    if (cid) {
      const cl = await ctx.sdb.findOne('clients', { id: cid, deleted_at: null });
      if (!cl) errs.client_id = 'Ese cliente no existe.';
      else client_id = cl.id;
    }
    failIf(errs);
  }

  const c = dom(ctx);
  let appointment_status = appt ? appt.status : null;
  // complete: marca la cita como atendida si la transición es válida y la cita ya empezó (si no, solo cobra).
  if (appt && complete && appt.status !== 'completed' && canTransition(appt.status, 'completed') && hasStarted(appt, c.now)) {
    try {
      appointment_status = (await changeStatus(c, appt, 'completed', { by: 'staff' })).status;
    } catch (e) {
      if (e instanceof HttpError && e.code === 'slot_taken') {
        throw conflict('No se pudo marcar la cita como atendida: ' + String(e.message).replace(/^No se puede restaurar:\s*/, '') + ' No se registró el cobro.', 'slot_taken');
      }
      throw e;
    }
  }
  const cs = method === 'cash' ? await openCashSession(ctx.sdb) : null;
  const row = await ctx.sdb.insert('payments', {
    id: newId('pay'), appointment_id: appt ? appt.id : null, client_id, staff_id, amount, tip, method,
    concept: concept || (appt ? servicesConcept(appt) : 'Venta'), status: 'paid', cash_session_id: cs ? cs.id : null,
    created_by: ctx.actor.id, created_at: nowIso(), date: c.now.date
  });
  if (appt) await logEvent(ctx.sdb, appt.id, 'payment', { action: 'charge', payment_id: row.id, amount, tip, method }, ctx.actor);
  const view = await paymentViews(ctx.sdb, row);
  if (appt) view.appointment_status = appointment_status;
  return view;
}

async function refund(ctx) {
  const p = await ctx.sdb.findOne('payments', { id: String(ctx.params.id || '') });
  if (!p) throw notFound('No encontramos ese cobro.');
  if (p.status === 'refunded') throw conflict('Este cobro ya fue reembolsado.');
  const errs = {};
  const reason = textField(errs, 'reason', body(ctx).reason, 200, 'El motivo');
  failIf(errs);
  // Condición en el update: dos reembolsos simultáneos → solo uno cambia la fila.
  if (!(await ctx.sdb.update('payments', { id: p.id, status: 'paid' }, { status: 'refunded' }))) throw conflict('Este cobro ya fue reembolsado.');
  const out = Object.assign({}, p, { status: 'refunded' });
  // Efectivo cobrado fuera de la caja abierta (otra caja ya cerrada o sin caja): el dinero sale de la caja
  // abierta hoy → se registra como gasto para que el corte cuadre. Si es de la misma caja, el resumen ya lo descuenta.
  let movement = null;
  if (p.method === 'cash') {
    const cs = await openCashSession(ctx.sdb);
    if (cs && cs.id !== p.cash_session_id) {
      movement = await ctx.sdb.insert('cash_movements', {
        id: newId('cm'), cash_session_id: cs.id, type: 'expense', amount: money((Number(p.amount) || 0) + (Number(p.tip) || 0)),
        concept: cleanText('Reembolso: ' + (p.concept || 'cobro'), 120), created_by: ctx.actor.id, created_by_name: ctx.actor.name, created_at: nowIso()
      });
    }
  }
  if (p.appointment_id) {
    await logEvent(ctx.sdb, p.appointment_id, 'payment', { action: 'refund', payment_id: p.id, amount: p.amount, tip: p.tip, method: p.method, reason: reason || null }, ctx.actor);
  }
  const view = await paymentViews(ctx.sdb, out);
  view.cash_movement_id = movement ? movement.id : null;
  return view;
}

export const routes = [
  { method: 'GET', path: '/api/payments', auth: 'shop', perm: ['payments.read.all', 'payments.read.own'], handler: list },
  { method: 'POST', path: '/api/payments', auth: 'shop', perm: 'payments.write', handler: create },
  { method: 'POST', path: '/api/payments/:id/refund', auth: 'shop', perm: 'payments.refund', handler: refund }
];
