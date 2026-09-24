// Tablero (dashboard) y exportación CSV. Barbero: versión propia del tablero (staff_id = el suyo).
//
// Reglas del tablero (docs/API.md → /api/reports/dashboard):
//   revenue        = pagos `paid` (monto sin propina) con fecha en el rango + `total` de citas `completed`
//                    del rango que no tienen ningún pago registrado (ni reembolsado).
//   appointments   = citas no canceladas (pending, confirmed, completed, no_show).
//   avg_ticket     = revenue / ventas (citas cobradas + ventas sueltas + citas atendidas sin pago).
//   cancel_rate    = canceladas / todas las citas del rango × 100.
//   no_show_rate   = no asistió / (atendidas + no asistió) × 100.
//   occupancy_pct  = minutos agendados (no canceladas) / minutos disponibles × 100 (tope 100). Disponibles =
//                    bloques de availability (o settings.hours) − descansos, de barberos activos y reservables.
//   new_clients    = clientes cuya primera cita no cancelada cae en el rango; returning = ya tenían una antes.
//   by_service     = servicios de citas atendidas (conteo y precio de lista).
//   today          = citas no canceladas de hoy; expected_revenue = total de las pendientes/confirmadas/atendidas.
import { forbidden, notFound, money, addDays, diffDays, eachDay, weekday, fmtMin, toCSV, slugify, nowInTz } from '../util.js';
import { shopSettings } from '../domain/settings.js';
import { apptView } from '../domain/views.js';
import { buildAgenda, blocksFor, busyFor, weekFor } from '../domain/slots.js';
import { failIf, STATUSES, STATUS_LABEL } from '../domain/appointments.js';
import { parseRange, findIn, METHODS, METHOD_LABEL } from './payments.js';
import { computeCommissions } from './commissions.js';

const EXPECTED = ['pending', 'confirmed', 'completed'];
const PAY_LOOKBACK = 31;   // anticipos: pagos hasta 31 días antes del rango cuentan como "la cita ya tiene pago"
const PAY_LOOKAHEAD = 62;  // cobros tardíos: hasta 62 días después
const pct = (a, b) => (b > 0 ? Math.min(100, Math.round((a / b) * 1000) / 10) : 0);
const inRange = (d, a, b) => d >= a && d <= b;
const num = (v) => Number(v) || 0;

// Minutos de trabajo de un barbero en una fecha: bloques − descansos (ag construida sin citas).
function workMinutes(ag, staffId, date) {
  const blocks = blocksFor(ag, staffId, date);
  if (!blocks.length) return 0;
  const off = busyFor(ag, staffId, date);
  let m = 0;
  for (const [s, e] of blocks) {
    m += e - s;
    for (const [os, oe] of off) m -= Math.max(0, Math.min(e, oe) - Math.max(s, os));
  }
  return Math.max(0, m);
}

// Tablero completo. sdb con scope; staffId opcional (vista de un barbero). ~7 consultas + clientes previos.
export async function computeDashboard(sdb, shop, { from, to, staffId, today }) {
  const days = diffDays(from, to) + 1;
  const prevFrom = addDays(from, -days), prevTo = addDays(from, -1);
  const sw = staffId ? { staff_id: staffId } : {};
  const [staff, availability, timeOff, appts, pays, todayRows] = await Promise.all([
    sdb.find('staff', {}, { order: ['sort asc', 'name asc'] }),
    sdb.find('availability', sw),
    sdb.find('time_off', { date_from: { lte: to }, date_to: { gte: from } }),
    sdb.find('appointments', Object.assign({ date: { gte: prevFrom, lte: to } }, sw)),
    sdb.find('payments', { date: { gte: addDays(prevFrom, -PAY_LOOKBACK), lte: addDays(to, PAY_LOOKAHEAD) } }),
    sdb.find('appointments', Object.assign({ date: today, status: { ne: 'cancelled' } }, sw), { order: ['start_min asc', 'id asc'] })
  ]);

  // ── Ingresos ──
  const hasPay = new Set(pays.filter((p) => p.appointment_id).map((p) => p.appointment_id));
  const paidIn = (a, b) => pays.filter((p) => p.status === 'paid' && inRange(p.date, a, b) && (!staffId || p.staff_id === staffId));
  const cur = appts.filter((a) => a.date >= from);
  const prev = appts.filter((a) => a.date < from);
  const curPays = paidIn(from, to);
  const curUnpaid = cur.filter((a) => a.status === 'completed' && !hasPay.has(a.id));
  const prevUnpaid = prev.filter((a) => a.status === 'completed' && !hasPay.has(a.id));
  const revenueOf = (ps, us) => money(ps.reduce((m, p) => m + num(p.amount), 0) + us.reduce((m, a) => m + num(a.total), 0));
  const revenue = revenueOf(curPays, curUnpaid);
  const revenue_prev = revenueOf(paidIn(prevFrom, prevTo), prevUnpaid);

  // ── Citas ──
  const live = cur.filter((a) => a.status !== 'cancelled');
  const by_status = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const a of cur) if (a.status in by_status) by_status[a.status]++;
  const tickets = new Set(curPays.filter((p) => p.appointment_id).map((p) => p.appointment_id)).size
    + curPays.filter((p) => !p.appointment_id).length + curUnpaid.length;

  // ── Ocupación ──
  const ag = buildAgenda({ settings: shopSettings(shop), staff, availability, timeOff });
  const occIds = staffId ? (ag.staff[staffId] ? [staffId] : []) : ag.order.filter((id) => ag.staff[id].active && ag.staff[id].bookable);
  const dates = eachDay(from, to);
  const availMin = {};
  const availOf = (id) => {
    if (availMin[id] == null) { let m = 0; if (ag.staff[id]) for (const d of dates) m += workMinutes(ag, id, d); availMin[id] = m; }
    return availMin[id];
  };
  const bookedMin = {};
  for (const a of live) bookedMin[a.staff_id] = (bookedMin[a.staff_id] || 0) + Math.max(0, a.end_min - a.start_min);
  const occupancy_pct = pct(occIds.reduce((m, id) => m + (bookedMin[id] || 0), 0), occIds.reduce((m, id) => m + availOf(id), 0));

  // ── Clientes nuevos / recurrentes ──
  const curClients = [...new Set(live.filter((a) => a.client_id).map((a) => a.client_id))];
  const seenBefore = new Set(prev.filter((a) => a.client_id && a.status !== 'cancelled').map((a) => a.client_id));
  const unknown = curClients.filter((id) => !seenBefore.has(id));
  if (unknown.length) {
    const older = await findIn(sdb, 'appointments', 'client_id', unknown, { date: { lt: from }, status: { ne: 'cancelled' } });
    for (const a of older) seenBefore.add(a.client_id);
  }
  const returning_clients = curClients.filter((id) => seenBefore.has(id)).length;

  // ── Por día / barbero / servicio / hora / día de la semana / forma de pago ──
  const series = {};
  for (const d of dates) series[d] = { date: d, revenue: 0, appointments: 0, completed: 0 };
  const byS = {};
  const S = (id) => byS[id] || (byS[id] = { appointments: 0, completed: 0, revenue: 0 });
  const byWd = [0, 1, 2, 3, 4, 5, 6].map((w) => ({ weekday: w, count: 0, revenue: 0 }));
  const hours = {};
  for (const a of live) {
    series[a.date].appointments++;
    if (a.status === 'completed') series[a.date].completed++;
    S(a.staff_id).appointments++;
    if (a.status === 'completed') S(a.staff_id).completed++;
    byWd[weekday(a.date)].count++;
    const h = Math.floor(a.start_min / 60);
    hours[h] = (hours[h] || 0) + 1;
  }
  const by_method = { cash: 0, card: 0, transfer: 0, other: 0 };
  const addRev = (date, staff_id, v) => {
    series[date].revenue += v;
    byWd[weekday(date)].revenue += v;
    if (staff_id) S(staff_id).revenue += v;
  };
  for (const p of curPays) { addRev(p.date, p.staff_id, num(p.amount)); by_method[METHODS.includes(p.method) ? p.method : 'other'] += num(p.amount); }
  for (const a of curUnpaid) addRev(a.date, a.staff_id, num(a.total));

  const names = Object.fromEntries(staff.map((s) => [s.id, s]));
  const listIds = staffId ? [staffId] : [...new Set(ag.order.filter((id) => byS[id] || (ag.staff[id].active && ag.staff[id].bookable)).concat(Object.keys(byS)))];
  const by_staff = listIds.map((id, i) => {
    const x = byS[id] || { appointments: 0, completed: 0, revenue: 0 };
    const s = names[id];
    return { i, staff_id: id, name: s ? s.name : 'Sin asignar', color: s ? (s.color || '') : '', appointments: x.appointments, completed: x.completed, revenue: money(x.revenue), occupancy_pct: pct(bookedMin[id] || 0, availOf(id)) };
  }).sort((a, b) => b.appointments - a.appointments || b.revenue - a.revenue || a.i - b.i).map(({ i, ...r }) => r);
  const top = by_staff.find((s) => s.appointments > 0);
  const top_staff = top ? { staff_id: top.staff_id, name: top.name, color: top.color, appointments: top.appointments, completed: top.completed, revenue: top.revenue } : null;

  const sv = {};
  for (const a of cur) {
    if (a.status !== 'completed') continue;
    for (const s of a.services || []) {
      const k = s.id || s.name;
      const x = sv[k] || (sv[k] = { service_id: s.id || null, name: s.name || 'Servicio', count: 0, revenue: 0 });
      x.count++;
      x.revenue += num(s.price);
    }
  }
  const by_service = Object.values(sv).map((x) => Object.assign(x, { revenue: money(x.revenue) }))
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue || a.name.localeCompare(b.name, 'es'));

  // Horas: del horario de trabajo (y de las citas fuera de él), en un rango continuo para graficar.
  let lo = 24, hi = -1;
  for (const id of occIds) {
    const w = weekFor(ag, id);
    for (let d = 0; d < 7; d++) for (const [s, e] of w[d]) { lo = Math.min(lo, Math.floor(s / 60)); hi = Math.max(hi, Math.ceil(e / 60) - 1); }
  }
  for (const h of Object.keys(hours).map(Number)) { lo = Math.min(lo, h); hi = Math.max(hi, h); }
  const by_hour = [];
  for (let h = Math.max(0, lo); h <= Math.min(23, hi); h++) by_hour.push({ hour: h, count: hours[h] || 0 });

  for (const k of METHODS) by_method[k] = money(by_method[k]);
  const completed = by_status.completed, no_show = by_status.no_show;
  return {
    range: { from, to, days, prev_from: prevFrom, prev_to: prevTo },
    kpis: {
      revenue, revenue_prev, appointments: live.length, appointments_prev: prev.filter((a) => a.status !== 'cancelled').length,
      completed, cancelled: by_status.cancelled, no_show,
      avg_ticket: tickets ? money(revenue / tickets) : 0,
      tips: money(curPays.reduce((m, p) => m + num(p.tip), 0)),
      new_clients: curClients.length - returning_clients, returning_clients, occupancy_pct,
      cancel_rate: pct(by_status.cancelled, cur.length), no_show_rate: pct(no_show, completed + no_show)
    },
    series: dates.map((d) => Object.assign(series[d], { revenue: money(series[d].revenue) })),
    by_staff, top_staff, by_service, by_status, by_hour,
    by_weekday: byWd.map((x) => Object.assign(x, { revenue: money(x.revenue) })),
    by_method,
    today: {
      date: today, appointments: await apptView(sdb, todayRows),
      expected_revenue: money(todayRows.filter((a) => EXPECTED.includes(a.status)).reduce((m, a) => m + num(a.total), 0)),
      count: todayRows.length
    }
  };
}

async function dashboard(ctx) {
  const q = ctx.req.query;
  const errs = {};
  const r = parseRange(errs, q);
  let staffId = q.staff_id ? String(q.staff_id) : '';
  if (!ctx.can('reports.read')) {
    // Barbero (appointments.read.own): siempre su propia versión.
    if (!ctx.staff) throw forbidden();
    if (staffId && staffId !== ctx.staff.id) throw forbidden('Solo puedes ver tus propios números.');
    staffId = ctx.staff.id;
  }
  failIf(errs);
  if (staffId && !(await ctx.sdb.findOne('staff', { id: staffId }))) throw notFound('No encontramos a ese barbero.');
  return computeDashboard(ctx.sdb, ctx.shop, { from: r.from, to: r.to, staffId, today: ctx.now().date });
}

// ── Exportación CSV ──
// Texto que Excel interpretaría como fórmula (=, +, -, @) se antepone con ' (inyección CSV).
const safe = (v) => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v);
const localDate = (tz, iso) => (iso ? nowInTz(tz, iso) : null);
const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);

async function exportAppointments(ctx, r) {
  const rows = await ctx.sdb.find('appointments', { date: { gte: r.from, lte: r.to } }, { order: ['date asc', 'start_min asc', 'id asc'] });
  const list = await apptView(ctx.sdb, rows);
  const out = [['Folio', 'Fecha', 'Hora', 'Fin', 'Duración (min)', 'Barbero', 'Cliente', 'Teléfono', 'Servicios', 'Total', 'Pagado', 'Saldo', 'Estado', 'Origen', 'Nota del cliente', 'Nota interna', 'Motivo de cancelación']];
  const SRC = { online: 'En línea', manual: 'Panel', walkin: 'Sin cita', import: 'Importada' };
  for (const a of list) {
    out.push([a.folio, a.date, fmtMin(a.start_min), fmtMin(a.end_min), a.duration_min, a.staff_name, a.client_name || '', a.client_phone || '',
      (a.services || []).map((s) => s.name).join(' + '), money(a.total), a.paid, a.status === 'cancelled' ? 0 : a.balance,
      cap(STATUS_LABEL[a.status] || a.status), SRC[a.source] || a.source || '', a.client_note || '', a.internal_note || '', a.cancel_reason || '']);
  }
  return out;
}

async function exportPayments(ctx, r) {
  const rows = await ctx.sdb.find('payments', { date: { gte: r.from, lte: r.to } }, { order: ['created_at asc', 'id asc'] });
  const [staff, clients, appts] = await Promise.all([
    ctx.sdb.find('staff', {}),
    findIn(ctx.sdb, 'clients', 'id', rows.map((p) => p.client_id)),
    findIn(ctx.sdb, 'appointments', 'id', rows.map((p) => p.appointment_id))
  ]);
  const sName = Object.fromEntries(staff.map((s) => [s.id, s.name]));
  const cName = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  const ap = Object.fromEntries(appts.map((a) => [a.id, a]));
  const out = [['Fecha', 'Hora', 'Folio de cita', 'Cliente', 'Barbero', 'Concepto', 'Forma de pago', 'Monto', 'Propina', 'Total', 'Estado', 'Registró']];
  for (const p of rows) {
    const t = localDate(ctx.shop.timezone, p.created_at);
    const a = p.appointment_id ? ap[p.appointment_id] : null;
    out.push([p.date, t ? fmtMin(t.minutes) : '', a ? a.folio : '', (p.client_id && cName[p.client_id]) || (a && a.client_name) || '', sName[p.staff_id] || '',
      p.concept || '', METHOD_LABEL[p.method] || p.method, money(p.amount), money(p.tip), money(num(p.amount) + num(p.tip)),
      p.status === 'refunded' ? 'Reembolsado' : 'Pagado', sName[p.created_by] || '']);
  }
  return out;
}

async function exportClients(ctx, r) {
  const [clients, appts, pays] = await Promise.all([
    ctx.sdb.find('clients', { deleted_at: null }, { order: ['name asc', 'id asc'] }),
    ctx.sdb.find('appointments', { date: { gte: r.from, lte: r.to }, status: { ne: 'cancelled' } }),
    ctx.sdb.find('payments', { date: { gte: r.from, lte: r.to }, status: 'paid' })
  ]);
  const st = {};
  const S = (id) => st[id] || (st[id] = { appts: 0, completed: 0, paid: 0, last: '' });
  for (const a of appts) {
    if (!a.client_id) continue;
    const x = S(a.client_id);
    x.appts++;
    if (a.status === 'completed') { x.completed++; if (a.date > x.last) x.last = a.date; }
  }
  for (const p of pays) if (p.client_id) S(p.client_id).paid += num(p.amount);
  const SRC = { online: 'En línea', manual: 'Panel', walkin: 'Sin cita', import: 'Importado' };
  const out = [['Nombre', 'Teléfono', 'Correo', 'Cumpleaños', 'Etiquetas', 'Origen', 'Acepta promociones', 'Fecha de alta', 'Citas en el periodo', 'Atendidas en el periodo', 'Pagado en el periodo', 'Última visita en el periodo', 'Notas']];
  for (const c of clients) {
    const x = st[c.id] || { appts: 0, completed: 0, paid: 0, last: '' };
    const alta = localDate(ctx.shop.timezone, c.created_at);
    out.push([c.name, c.phone || '', c.email || '', c.birthday || '', (Array.isArray(c.tags) ? c.tags : []).join(', '), SRC[c.source] || c.source || '',
      c.marketing_ok ? 'Sí' : 'No', alta ? alta.date : '', x.appts, x.completed, money(x.paid), x.last, c.notes || '']);
  }
  return out;
}

async function exportCommissions(ctx, r) {
  const { items, totals } = await computeCommissions(ctx.sdb, { from: r.from, to: r.to });
  const out = [['Barbero', '% comisión', 'Servicios atendidos', 'Ventas', 'Comisión', 'Propinas', 'Pagado', 'Saldo']];
  for (const x of items) out.push([x.staff_name, x.commission_pct, x.services_count, x.revenue, x.commission, x.tips, x.payouts, x.balance]);
  out.push(['Total', '', totals.services_count, totals.revenue, totals.commission, totals.tips, totals.payouts, totals.balance]);
  return out;
}

const EXPORTERS = { appointments: exportAppointments, payments: exportPayments, clients: exportClients, commissions: exportCommissions };

async function exportCsv(ctx) {
  const q = ctx.req.query;
  const errs = {};
  const type = q.type ? String(q.type) : '';
  if (!EXPORTERS[type]) errs.type = 'Elige qué exportar: citas, cobros, clientes o comisiones.';
  const r = parseRange(errs, q);
  failIf(errs);
  const rows = await EXPORTERS[type](ctx, r);
  return {
    __raw: true, body: '﻿' + toCSV(rows.map((row) => row.map(safe))), contentType: 'text/csv; charset=utf-8',
    filename: slugify(ctx.shop.slug) + '-' + type + '-' + r.from + '_' + r.to + '.csv'
  };
}

export const routes = [
  { method: 'GET', path: '/api/reports/dashboard', auth: 'shop', perm: ['reports.read', 'appointments.read.own'], handler: dashboard },
  { method: 'GET', path: '/api/reports/export', auth: 'shop', perm: 'reports.export', handler: exportCsv }
];
