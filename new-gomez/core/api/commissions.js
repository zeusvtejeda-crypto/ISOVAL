// Comisiones por barbero y pagos de comisiones. Barbero (commissions.read.own): solo lo suyo.
//
// Reglas (periodo from..to, fechas locales):
//   services_count = citas `completed` del barbero con fecha en el periodo.
//   revenue        = suma de `amount` de los cobros del barbero con fecha en el periodo (sin propina), incluidos
//                    los que después se reembolsaron, MENOS el `amount` de los reembolsos hechos en el periodo
//                    (fecha local de refunded_at). Un reembolso no cambia el periodo del cobro (que pudo ya
//                    liquidarse): lo pagado de más se descuenta en el periodo del reembolso (puede quedar negativo).
//   refunds        = monto reembolsado en el periodo (ya restado de revenue).
//   commission     = revenue × commission_pct / 100 (redondeo a centavos).
//   tips           = propinas de esos cobros − propinas reembolsadas en el periodo (100 % del barbero).
//   payouts        = pagos de comisión cuyo `period_to` cae en el periodo (el pago se asigna al periodo
//                    que liquida, no al día en que se registró: así, tras pagar un periodo, su saldo queda en 0).
//   balance        = commission + tips − payouts.
// Se listan los barberos activos y los inactivos que tengan movimientos en el periodo.
import { forbidden, notFound, conflict, bad, newId, nowIso, money, int, clamp, diffDays } from '../util.js';
import { failIf, textField, cleanText } from '../domain/appointments.js';
import { ownScope, body, dateKey, parseRange, moneyField, fmtMoney, truthy, openCashSession, refundsIn, MAX_RANGE_DAYS } from './payments.js';
import { sessionDetail } from './cash.js';

const MAX_PAYOUT = 1000000;

// tz: zona horaria de la barbería (fecha local de los reembolsos).
export async function computeCommissions(sdb, { from, to, staffId, tz }) {
  const sw = staffId ? { staff_id: staffId } : {};
  const [staff, appts, pays, refunds, payouts] = await Promise.all([
    sdb.find('staff', staffId ? { id: staffId } : {}, { order: ['sort asc', 'name asc'] }),
    sdb.find('appointments', Object.assign({ date: { gte: from, lte: to }, status: 'completed' }, sw)),
    sdb.find('payments', Object.assign({ date: { gte: from, lte: to }, status: { in: ['paid', 'refunded'] } }, sw)),
    refundsIn(sdb, tz, from, to, sw),
    sdb.find('commission_payouts', Object.assign({ period_to: { gte: from, lte: to } }, sw))
  ]);
  const acc = {};
  const get = (id) => acc[id] || (acc[id] = { services_count: 0, revenue: 0, tips: 0, refunds: 0, payouts: 0 });
  for (const a of appts) get(a.staff_id).services_count++;
  for (const p of pays) if (p.staff_id) { const x = get(p.staff_id); x.revenue += Number(p.amount) || 0; x.tips += Number(p.tip) || 0; }
  for (const p of refunds) if (p.staff_id) { const x = get(p.staff_id); x.revenue -= Number(p.amount) || 0; x.tips -= Number(p.tip) || 0; x.refunds += Number(p.amount) || 0; }
  for (const p of payouts) get(p.staff_id).payouts += Number(p.amount) || 0;
  const items = staff.filter((s) => s.active || acc[s.id] || s.id === staffId).map((s) => {
    const x = acc[s.id] || { services_count: 0, revenue: 0, tips: 0, refunds: 0, payouts: 0 };
    const pct = Number(s.commission_pct) || 0;
    const revenue = money(x.revenue), tips = money(x.tips), payouts = money(x.payouts);
    const commission = money(revenue * pct / 100);
    return {
      staff_id: s.id, staff_name: s.name, color: s.color || '', role: s.role, active: !!s.active, commission_pct: pct,
      services_count: x.services_count, revenue, commission, tips, refunds: money(x.refunds), payouts, balance: money(commission + tips - payouts)
    };
  });
  const totals = { services_count: 0, revenue: 0, commission: 0, tips: 0, refunds: 0, payouts: 0, balance: 0 };
  for (const it of items) for (const k of Object.keys(totals)) totals[k] += it[k];
  for (const k of Object.keys(totals)) if (k !== 'services_count') totals[k] = money(totals[k]);
  return { items, totals };
}

// staff_id de la consulta según permisos: el barbero solo el suyo.
function staffFilter(ctx, raw) {
  const own = ownScope(ctx, 'commissions.read.all');
  const wanted = raw == null || raw === '' ? '' : String(raw);
  if (own && wanted && wanted !== own) throw forbidden('Solo puedes ver tus propias comisiones.');
  return own || wanted;
}

async function list(ctx) {
  const q = ctx.req.query;
  const errs = {};
  const r = parseRange(errs, q);
  const staffId = staffFilter(ctx, q.staff_id);
  failIf(errs);
  if (staffId && !(await ctx.sdb.findOne('staff', { id: staffId }))) throw notFound('No encontramos a ese barbero.');
  const out = await computeCommissions(ctx.sdb, { from: r.from, to: r.to, staffId, tz: ctx.shop.timezone });
  return Object.assign({ range: { from: r.from, to: r.to, days: r.days } }, out);
}

async function listPayouts(ctx) {
  const q = ctx.req.query;
  const staffId = staffFilter(ctx, q.staff_id);
  const where = staffId ? { staff_id: staffId } : {};
  if (q.from || q.to) {
    const errs = {};
    const r = parseRange(errs, q, { max: 3660 });
    failIf(errs);
    where.period_to = { gte: r.from, lte: r.to };
  }
  const [rows, staff] = await Promise.all([
    ctx.sdb.find('commission_payouts', where, { order: ['created_at desc', 'id desc'], limit: clamp(int(q.limit, 200), 1, 1000) }),
    ctx.sdb.find('staff', {})
  ]);
  const names = Object.fromEntries(staff.map((s) => [s.id, s.name]));
  return rows.map((p) => Object.assign({}, p, { staff_name: names[p.staff_id] || '' }));
}

async function createPayout(ctx) {
  const b = body(ctx);
  const errs = {};
  const staffId = b.staff_id == null || b.staff_id === '' ? '' : String(b.staff_id);
  let st = null;
  if (!staffId) errs.staff_id = 'Elige al barbero.';
  else if (!(st = await ctx.sdb.findOne('staff', { id: staffId }))) errs.staff_id = 'Ese barbero no existe.';
  const period_from = dateKey(b.period_from), period_to = dateKey(b.period_to);
  if (!period_from) errs.period_from = 'Indica el inicio del periodo (AAAA-MM-DD).';
  if (!period_to) errs.period_to = 'Indica el fin del periodo (AAAA-MM-DD).';
  if (period_from && period_to) {
    const today = ctx.now().date;
    if (period_to < period_from) errs.period_to = 'El fin del periodo debe ser igual o posterior al inicio.';
    else if (diffDays(period_from, period_to) + 1 > MAX_RANGE_DAYS) errs.period_to = 'El periodo puede abarcar máximo ' + MAX_RANGE_DAYS + ' días.';
    else if (period_from > today) errs.period_from = 'El periodo no puede empezar en el futuro.';
    else if (diffDays(period_from, today) > 731) errs.period_from = 'El periodo es demasiado antiguo (máximo 2 años).';
  }
  const amount = moneyField(errs, 'amount', b.amount, { label: 'el monto', positive: true, max: MAX_PAYOUT });
  const note = textField(errs, 'note', b.note, 200, 'La nota');
  const fromCash = truthy(b.from_cash);
  failIf(errs);
  // Opcional: el pago sale de la caja abierta (se registra como retiro).
  let cs = null;
  if (fromCash) {
    cs = await openCashSession(ctx.sdb);
    if (!cs) throw conflict('Abre la caja para pagar desde el efectivo, o desmarca "pagar desde caja".');
    const avail = (await sessionDetail(ctx.sdb, cs)).summary.expected_cash;
    if (amount > avail) {
      const msg = 'En caja solo hay ' + fmtMoney(avail, ctx.shop.currency) + '.';
      throw bad(msg + ' Revisa el monto.', { amount: msg });
    }
  }
  const at = nowIso();
  const row = await ctx.sdb.insert('commission_payouts', {
    id: newId('po'), staff_id: st.id, period_from, period_to, amount, note: note || null, created_by: ctx.actor.id, created_at: at
  });
  let movement = null;
  if (cs) {
    movement = await ctx.sdb.insert('cash_movements', {
      id: newId('cm'), cash_session_id: cs.id, type: 'withdrawal', amount, concept: cleanText('Pago de comisión · ' + st.name, 120),
      created_by: ctx.actor.id, created_by_name: ctx.actor.name, created_at: at
    });
  }
  return Object.assign({}, row, { staff_name: st.name, cash_movement_id: movement ? movement.id : null });
}

export const routes = [
  { method: 'GET', path: '/api/commissions', auth: 'shop', perm: ['commissions.read.all', 'commissions.read.own'], handler: list },
  { method: 'GET', path: '/api/commissions/payouts', auth: 'shop', perm: ['commissions.read.all', 'commissions.read.own'], handler: listPayouts },
  { method: 'POST', path: '/api/commissions/payouts', auth: 'shop', perm: 'commissions.payout', handler: createPayout }
];
