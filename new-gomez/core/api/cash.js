// Caja: apertura con fondo, movimientos (ingresos, gastos, retiros), corte con conteo y diferencia.
// Una sola caja abierta por barbería. Los cobros en efectivo con caja abierta quedan ligados a ella
// (payments.cash_session_id); tarjeta/transferencia se reportan por la ventana de tiempo de la caja.
//
// Efectivo esperado = fondo inicial + ventas en efectivo + propinas en efectivo + ingresos − gastos − retiros.
import { bad, conflict, newId, nowIso, money, addDays } from '../util.js';
import { notify } from '../domain/notify.js';
import { failIf, textField } from '../domain/appointments.js';
import { body, parseRange, moneyField, fmtMoney, paymentViews, openCashSession } from './payments.js';

export const MOVEMENT_TYPES = ['income', 'expense', 'withdrawal'];
export const MOVEMENT_LABEL = { income: 'Ingreso', expense: 'Gasto', withdrawal: 'Retiro' };
const MAX_CASH = 1000000;
const SESSIONS_LIMIT = 500;

export function emptySummary() {
  return { opening_float: 0, cash_sales: 0, cash_tips: 0, income: 0, expense: 0, withdrawal: 0, expected_cash: 0, card_sales: 0, transfer_sales: 0, other_sales: 0, card_tips: 0, transfer_tips: 0, payments_count: 0 };
}

// Resumen puro de una caja a partir de sus movimientos y pagos (solo cuentan los `paid`).
export function summarize(session, movements, payments) {
  const s = emptySummary();
  s.opening_float = money(session.opening_float);
  for (const m of movements) if (MOVEMENT_TYPES.includes(m.type)) s[m.type] += Number(m.amount) || 0;
  for (const p of payments) {
    if (p.status !== 'paid') continue;
    const a = Number(p.amount) || 0, tip = Number(p.tip) || 0;
    s.payments_count++;
    if (p.method === 'cash') { s.cash_sales += a; s.cash_tips += tip; }
    else if (p.method === 'card') { s.card_sales += a; s.card_tips += tip; }
    else if (p.method === 'transfer') { s.transfer_sales += a; s.transfer_tips += tip; }
    else s.other_sales += a;
  }
  for (const k of Object.keys(s)) if (k !== 'payments_count') s[k] = money(s[k]);
  s.expected_cash = money(s.opening_float + s.cash_sales + s.cash_tips + s.income - s.expense - s.withdrawal);
  return s;
}

// { session, summary, movements, payments } de una caja (2 consultas). Pagos: efectivo ligado a la caja
// + otras formas de pago registradas mientras estuvo abierta.
export async function sessionDetail(sdb, session) {
  if (!session) return { session: null, summary: emptySummary(), movements: [], payments: [] };
  const created = session.closed_at ? { gte: session.opened_at, lte: session.closed_at } : { gte: session.opened_at };
  const [movements, pays] = await Promise.all([
    sdb.find('cash_movements', { cash_session_id: session.id }, { order: ['created_at asc', 'id asc'] }),
    sdb.find('payments', { date: { gte: session.date }, created_at: created }, { order: ['created_at asc', 'id asc'] })
  ]);
  const payments = pays.filter((p) => (p.method === 'cash' ? p.cash_session_id === session.id : true));
  return { session, summary: summarize(session, movements, payments), movements, payments };
}

async function lastClosed(sdb) {
  return (await sdb.find('cash_sessions', { status: 'closed' }, { order: ['closed_at desc', 'id desc'], limit: 1 }))[0] || null;
}
async function fullDetail(ctx, session) {
  const [d, last] = await Promise.all([sessionDetail(ctx.sdb, session), lastClosed(ctx.sdb)]);
  d.payments = await paymentViews(ctx.sdb, d.payments);
  d.last_session = last;
  return d;
}

async function current(ctx) {
  return fullDetail(ctx, await openCashSession(ctx.sdb));
}

async function open(ctx) {
  const b = body(ctx);
  const errs = {};
  const opening_float = moneyField(errs, 'opening_float', b.opening_float, { label: 'el fondo inicial', required: false, max: MAX_CASH });
  const notes = textField(errs, 'notes', b.notes, 300, 'La nota');
  failIf(errs);
  if (await openCashSession(ctx.sdb)) throw conflict('Ya hay una caja abierta. Haz el corte antes de abrir otra.');
  const actor = ctx.actor;
  const row = await ctx.sdb.insert('cash_sessions', {
    id: newId('cs'), status: 'open', opened_by: actor.id, opened_by_name: actor.name, opened_at: nowIso(), opening_float,
    closed_by: null, closed_by_name: null, closed_at: null, expected_cash: null, counted_cash: null, difference: null,
    notes: notes || null, date: ctx.now().date
  });
  // Dos aperturas simultáneas: se queda la primera.
  const opened = await ctx.sdb.find('cash_sessions', { status: 'open' }, { order: ['opened_at asc', 'id asc'] });
  if (opened.length > 1 && opened[0].id !== row.id) {
    await ctx.sdb.delete('cash_sessions', { id: row.id });
    throw conflict('Ya hay una caja abierta. Haz el corte antes de abrir otra.');
  }
  return fullDetail(ctx, row);
}

async function close(ctx) {
  const b = body(ctx);
  const errs = {};
  const counted = moneyField(errs, 'counted_cash', b.counted_cash, { label: 'el efectivo contado', max: MAX_CASH });
  const notes = textField(errs, 'notes', b.notes, 300, 'La nota');
  failIf(errs);
  const s = await openCashSession(ctx.sdb);
  if (!s) throw conflict('No hay una caja abierta.');
  const d = await sessionDetail(ctx.sdb, s);
  const expected = d.summary.expected_cash;
  const difference = money(counted - expected);
  const actor = ctx.actor;
  const patch = {
    status: 'closed', closed_by: actor.id, closed_by_name: actor.name, closed_at: nowIso(),
    expected_cash: expected, counted_cash: counted, difference,
    notes: [s.notes, notes ? 'Cierre: ' + notes : ''].filter(Boolean).join('\n') || null
  };
  if (!(await ctx.sdb.update('cash_sessions', { id: s.id, status: 'open' }, patch))) throw conflict('Esta caja ya se cerró.');
  const session = Object.assign({}, s, patch);
  if (difference !== 0) {
    const cur = ctx.shop.currency;
    const kind = difference < 0 ? 'faltante' : 'sobrante';
    await notify(ctx.sdb, 'owners', {
      type: 'cash_closed', title: 'Corte de caja con ' + kind + ' de ' + fmtMoney(Math.abs(difference), cur),
      body: 'Esperado ' + fmtMoney(expected, cur) + ' · Contado ' + fmtMoney(counted, cur) + ' · Diferencia ' + (difference > 0 ? '+' : '−') + fmtMoney(Math.abs(difference), cur) + ' · Cerró ' + (actor.name || 'el equipo'),
      link: '#/caja', data: { cash_session_id: s.id, expected_cash: expected, counted_cash: counted, difference }
    });
  }
  return { session, summary: d.summary };
}

async function addMovement(ctx) {
  const b = body(ctx);
  const errs = {};
  const type = b.type == null ? '' : String(b.type);
  if (!MOVEMENT_TYPES.includes(type)) errs.type = 'Elige el tipo: ingreso, gasto o retiro.';
  const amount = moneyField(errs, 'amount', b.amount, { label: 'el monto', positive: true, max: MAX_CASH });
  const concept = b.concept == null ? '' : String(b.concept).replace(/\s+/g, ' ').trim();
  if (concept.length < 2 || concept.length > 120) errs.concept = 'Escribe el concepto (2 a 120 caracteres).';
  failIf(errs);
  const s = await openCashSession(ctx.sdb);
  if (!s) throw conflict('Abre la caja para registrar movimientos.');
  if (type !== 'income') {
    // No puede salir más efectivo del que hay en caja.
    const avail = (await sessionDetail(ctx.sdb, s)).summary.expected_cash;
    if (amount > avail) {
      const msg = 'En caja solo hay ' + fmtMoney(avail, ctx.shop.currency) + '.';
      throw bad(msg + ' Revisa el monto.', { amount: msg });
    }
  }
  return ctx.sdb.insert('cash_movements', {
    id: newId('cm'), cash_session_id: s.id, type, amount, concept,
    created_by: ctx.actor.id, created_by_name: ctx.actor.name, created_at: nowIso()
  });
}

// Historial de cortes. Sin from/to: últimos 30 días.
async function sessions(ctx) {
  const q = ctx.req.query;
  let r;
  if (!q.from && !q.to) { const to = ctx.now().date; r = { from: addDays(to, -29), to }; }
  else { const errs = {}; r = parseRange(errs, q); failIf(errs); }
  return ctx.sdb.find('cash_sessions', { date: { gte: r.from, lte: r.to } }, { order: ['date desc', 'opened_at desc', 'id desc'], limit: SESSIONS_LIMIT });
}

export const routes = [
  { method: 'GET', path: '/api/cash/current', auth: 'shop', perm: 'cash.read', handler: current },
  { method: 'POST', path: '/api/cash/open', auth: 'shop', perm: 'cash.manage', handler: open },
  { method: 'POST', path: '/api/cash/close', auth: 'shop', perm: 'cash.manage', handler: close },
  { method: 'POST', path: '/api/cash/movements', auth: 'shop', perm: 'cash.manage', handler: addMovement },
  { method: 'GET', path: '/api/cash/sessions', auth: 'shop', perm: 'cash.read', handler: sessions }
];
