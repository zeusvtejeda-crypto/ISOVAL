// Pruebas de la cuenta demo (core/seed-demo.js): cantidades, agenda sin traslapes y dentro de horario,
// pagos/caja/comisiones coherentes, credenciales, determinismo, tamaño/tiempo y aislamiento multibarbería.
// No dependen de endpoints: revisan las filas sembradas directamente (y el motor de agenda de domain/slots.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryDb, scopedDb } from '../core/db.js';
import { SCHEMA } from '../core/schema.js';
import { verifySecret } from '../core/crypto.js';
import { contextsFor } from '../core/session.js';
import { addDays, weekday, nowInTz, money } from '../core/util.js';
import { buildAgenda, checkFree, OCCUPYING } from '../core/domain/slots.js';
import { shopSettings } from '../core/domain/settings.js';
import { makeFixture } from './helpers.mjs';
import {
  seedDemo, mulberry32, DEMO_CREDENTIALS, DEMO_NORTE_CREDENTIALS, DEMO_PINS, DEMO_NORTE_PINS, DEMO_SHOP_SLUG, DEMO_NORTE_SLUG, DEMO_TZ
} from '../core/seed-demo.js';

const TODAY = '2026-09-24'; // jueves
const NOW = 700;            // 11:40 a.m.

// ── Utilidades de prueba ──
const off = (date) => { const g = Date.parse(date + 'T12:00:00Z'); const n = nowInTz(DEMO_TZ, g); return (g - (Date.parse(n.date + 'T00:00:00Z') + n.minutes * 60000)) / 60000; };
const localMs = (date, min) => Date.parse(date + 'T00:00:00Z') + (min + off(date)) * 60000;
const ms = (iso) => Date.parse(iso);

async function seeded(opts) {
  const db = memoryDb();
  const t0 = performance.now();
  const r = await seedDemo(db, opts);
  const elapsed = performance.now() - t0;
  const d = db.dump();
  const of = (shop, t) => d[t].filter((x) => x.shop_id === shop.id);
  return { db, r, d, elapsed, of };
}
const cache = {};
const base = () => (cache.base = cache.base || seeded({ today: TODAY, nowMin: NOW }));

// Revisa las reglas de agenda de una barbería sembrada (propias, sin el motor).
function checkAgenda(d, shop, today, nowMin) {
  const staff = d.staff.filter((s) => s.shop_id === shop.id);
  const staffById = Object.fromEntries(staff.map((s) => [s.id, s]));
  const svcById = Object.fromEntries(d.services.filter((s) => s.shop_id === shop.id).map((s) => [s.id, s]));
  const av = d.availability.filter((a) => a.shop_id === shop.id);
  const offs = d.time_off.filter((t) => t.shop_id === shop.id);
  const appts = d.appointments.filter((a) => a.shop_id === shop.id);
  const nowT = localMs(today, nowMin);
  const busy = {};
  for (const a of appts) {
    const where = a.folio + ' ' + a.date + ' ' + a.start_min;
    const st = staffById[a.staff_id];
    assert.ok(st, 'barbero de la misma barbería ' + where);
    assert.ok(a.services.length >= 1 && a.services.length <= 2, '1–2 servicios ' + where);
    assert.equal(a.duration_min, a.services.reduce((m, s) => m + s.duration_min, 0), 'duración ' + where);
    assert.equal(a.end_min, a.start_min + a.duration_min, 'fin ' + where);
    assert.equal(a.total, money(a.services.reduce((m, s) => m + s.price, 0)), 'total ' + where);
    assert.equal(a.start_min % 20, 0, 'rejilla de 20 min ' + where);
    for (const s of a.services) {
      const sv = svcById[s.id];
      assert.ok(sv, 'servicio de la misma barbería ' + where);
      assert.equal(s.name, sv.name); assert.equal(s.price, sv.price); assert.equal(s.duration_min, sv.duration_min);
      assert.ok(!sv.staff_ids.length || sv.staff_ids.includes(a.staff_id), 'el barbero ofrece ' + s.name + ' ' + where);
    }
    const blocks = av.filter((x) => x.staff_id === a.staff_id && x.weekday === weekday(a.date));
    assert.ok(blocks.some((b) => a.start_min >= b.start_min && a.end_min <= b.end_min), 'dentro de disponibilidad ' + where);
    for (const t of offs) {
      if ((t.staff_id != null && t.staff_id !== a.staff_id) || t.date_from > a.date || t.date_to < a.date) continue;
      assert.ok(t.start_min != null && (t.end_min <= a.start_min || t.start_min >= a.end_min), 'fuera de descanso (' + t.reason + ') ' + where);
    }
    assert.ok(a.date >= st.created_at.slice(0, 10) || ms(st.created_at) <= localMs(a.date, a.start_min), 'no antes de que entrara el barbero ' + where);
    // Tiempos coherentes
    assert.ok(ms(a.created_at) <= localMs(a.date, a.start_min), 'creada antes de empezar ' + where);
    assert.ok(ms(a.created_at) <= nowT, 'creada en el pasado ' + where);
    if (a.updated_at) assert.ok(ms(a.updated_at) >= ms(a.created_at) && ms(a.updated_at) <= nowT, 'updated_at ' + where);
    // Estados según la fecha
    if (a.date < today) assert.ok(['completed', 'cancelled', 'no_show'].includes(a.status), 'estado pasado ' + where);
    else if (a.date > today) assert.ok(['pending', 'confirmed', 'cancelled'].includes(a.status), 'estado futuro ' + where);
    else {
      assert.ok(['completed', 'confirmed', 'pending'].includes(a.status), 'estado de hoy ' + where);
      if (a.status === 'completed') assert.ok(a.end_min <= nowMin, 'atendida hoy ya terminó ' + where);
      else assert.ok(a.end_min > nowMin, 'pendiente/confirmada hoy aún no termina ' + where);
    }
    assert.equal(!!a.completed_at, a.status === 'completed', 'completed_at ' + where);
    if (a.completed_at) assert.ok(ms(a.completed_at) >= localMs(a.date, a.end_min) && ms(a.completed_at) <= nowT);
    if (a.status === 'cancelled') { assert.ok(a.cancel_reason); assert.ok(['client', 'staff'].includes(a.cancelled_by)); }
    else { assert.equal(a.cancel_reason, null); assert.equal(a.cancelled_by, null); }
    assert.ok(['online', 'manual', 'walkin'].includes(a.source));
    if (a.source === 'walkin') assert.ok(!['cancelled', 'no_show', 'pending'].includes(a.status) && a.date <= today, 'walk-in coherente ' + where);
    assert.equal(a.manage_token_hash, null);
    if (OCCUPYING.includes(a.status)) (busy[a.staff_id + '|' + a.date] = busy[a.staff_id + '|' + a.date] || []).push(a);
  }
  // Cero traslapes por barbero entre citas que ocupan agenda
  for (const list of Object.values(busy)) {
    list.sort((x, y) => x.start_min - y.start_min);
    for (let i = 1; i < list.length; i++) assert.ok(list[i].start_min >= list[i - 1].end_min, 'traslape ' + list[i].date + ' ' + list[i - 1].start_min + '/' + list[i].start_min);
  }
  return appts;
}

// Días hábiles (horario de la barbería y sin feriado de día completo) en [from, to].
function businessDays(d, shop, from, to) {
  const hours = shopSettings(shop).hours;
  const offs = d.time_off.filter((t) => t.shop_id === shop.id && t.staff_id == null && t.start_min == null);
  const out = [];
  for (let k = from; k <= to; k = addDays(k, 1)) if ((hours[weekday(k)] || []).length && !offs.some((t) => t.date_from <= k && t.date_to >= k)) out.push(k);
  return out;
}

function checkMoney(d, shop, today, nowMin, { products } = {}) {
  const appts = d.appointments.filter((a) => a.shop_id === shop.id);
  const pays = d.payments.filter((p) => p.shop_id === shop.id);
  const nowT = localMs(today, nowMin);
  const byAppt = {};
  for (const p of pays) if (p.appointment_id) (byAppt[p.appointment_id] = byAppt[p.appointment_id] || []).push(p);
  for (const a of appts) {
    const ps = byAppt[a.id] || [];
    if (a.status !== 'completed') { assert.equal(ps.length, 0, 'sin pagos si no está atendida ' + a.folio); continue; }
    assert.equal(ps.length, 1, 'un pago por cita atendida ' + a.folio);
    const p = ps[0];
    assert.equal(p.amount, a.total); assert.equal(p.date, a.date); assert.equal(p.status, 'paid');
    assert.equal(p.staff_id, a.staff_id); assert.equal(p.client_id, a.client_id);
    assert.ok(ms(p.created_at) >= localMs(a.date, a.end_min) && ms(p.created_at) <= nowT, 'pago al terminar ' + a.folio);
  }
  for (const p of pays) {
    assert.ok(['cash', 'card', 'transfer'].includes(p.method));
    assert.equal(p.tip % 5, 0, 'propina redondeada a $5');
    assert.ok(p.tip >= 0 && p.tip <= p.amount * 0.21 + 5);
    if (p.cash_session_id) assert.equal(p.method, 'cash');
  }
  const loose = pays.filter((p) => !p.appointment_id);
  if (products) {
    assert.ok(loose.length >= 3 && loose.length <= 4, 'ventas de producto sueltas');
    for (const p of loose) { assert.match(p.concept, /producto/); assert.ok([180, 220].includes(p.amount)); }
  } else assert.equal(loose.length, 0);
  return pays;
}

function checkCash(d, shop, today, nowMin) {
  const sessions = d.cash_sessions.filter((c) => c.shop_id === shop.id);
  const moves = d.cash_movements.filter((m) => m.shop_id === shop.id);
  const pays = d.payments.filter((p) => p.shop_id === shop.id);
  const appts = d.appointments.filter((a) => a.shop_id === shop.id);
  const first = appts.reduce((m, a) => (a.date < m ? a.date : m), today);
  const expectedDays = businessDays(d, shop, first, addDays(today, -1));
  const closed = sessions.filter((s) => s.status === 'closed');
  assert.deepEqual(closed.map((s) => s.date).sort(), expectedDays, 'un corte por día hábil pasado');
  const open = sessions.filter((s) => s.status === 'open');
  assert.equal(open.length, 1, 'una sola caja abierta');
  assert.equal(open[0].date, today);
  assert.ok(ms(open[0].opened_at) <= localMs(today, nowMin));
  for (const s of sessions) {
    const dayPays = pays.filter((p) => p.date === s.date);
    const end = s.closed_at ? ms(s.closed_at) : Infinity;
    for (const p of dayPays) {
      assert.ok(ms(p.created_at) >= ms(s.opened_at) && ms(p.created_at) <= end, 'pago dentro de la ventana de la caja ' + s.date);
      if (p.method === 'cash') assert.equal(p.cash_session_id, s.id, 'efectivo ligado a la caja del día ' + s.date);
    }
    const mv = moves.filter((m) => m.cash_session_id === s.id);
    for (const m of mv) {
      assert.ok(['income', 'expense', 'withdrawal'].includes(m.type) && m.amount > 0 && m.concept);
      assert.ok(ms(m.created_at) >= ms(s.opened_at) && ms(m.created_at) <= end, 'movimiento dentro de la caja');
    }
    if (s.status !== 'closed') { assert.equal(s.expected_cash, null); continue; }
    const cash = dayPays.filter((p) => p.cash_session_id === s.id);
    const exp = money(s.opening_float + cash.reduce((m, p) => m + p.amount + p.tip, 0) + mv.reduce((m, x) => m + (x.type === 'income' ? x.amount : -x.amount), 0));
    assert.equal(s.expected_cash, exp, 'esperado cuadra ' + s.date);
    assert.equal(money(s.counted_cash - s.expected_cash), s.difference, 'diferencia = contado − esperado');
    assert.ok([0, -20, 10].includes(s.difference));
    if (s.difference) assert.match(s.notes, /^Cierre: /); else assert.equal(s.notes, null);
    assert.ok(s.counted_cash >= 0);
    assert.ok(ms(s.closed_at) > ms(s.opened_at));
  }
  assert.ok(moves.every((m) => sessions.some((s) => s.id === m.cash_session_id)));
  return { sessions, closed };
}

function checkPayouts(d, shop, today) {
  const staff = d.staff.filter((s) => s.shop_id === shop.id);
  const pays = d.payments.filter((p) => p.shop_id === shop.id && p.status === 'paid');
  const payouts = d.commission_payouts.filter((p) => p.shop_id === shop.id);
  const seen = new Set();
  for (const po of payouts) {
    const st = staff.find((s) => s.id === po.staff_id);
    assert.ok(st, 'payout de un barbero de la barbería');
    assert.ok(po.period_to < today && po.period_from <= po.period_to);
    assert.ok(/^\d{4}-\d{2}-(01|16)$/.test(po.period_from), 'quincena');
    const key = po.staff_id + po.period_from;
    assert.ok(!seen.has(key), 'un pago por barbero y quincena'); seen.add(key);
    const ps = pays.filter((p) => p.staff_id === st.id && p.date >= po.period_from && p.date <= po.period_to);
    const revenue = money(ps.reduce((m, p) => m + p.amount, 0));
    const tips = money(ps.reduce((m, p) => m + p.tip, 0));
    assert.equal(po.amount, money(money(revenue * st.commission_pct / 100) + tips), 'comisión + propinas ' + st.name + ' ' + po.period_from);
    assert.ok(ms(po.created_at) > localMs(po.period_to, 0));
  }
  return payouts;
}

// Todas las referencias de las filas de una barbería apuntan a filas de ESA barbería.
function checkRefs(d, shop) {
  const ids = (t) => new Set(d[t].filter((x) => x.shop_id === shop.id).map((x) => x.id));
  const staff = ids('staff'), clients = ids('clients'), appts = ids('appointments'), svcs = ids('services'), sessions = ids('cash_sessions');
  const own = (set, v, what) => assert.ok(v == null || set.has(v), what + ' de otra barbería: ' + v);
  for (const t of Object.keys(SCHEMA)) {
    if (!SCHEMA[t].scoped) continue;
    for (const r of d[t].filter((x) => x.shop_id === shop.id)) {
      if ('staff_id' in r) own(staff, r.staff_id, t + '.staff_id');
      if ('client_id' in r) own(clients, r.client_id, t + '.client_id');
      if ('appointment_id' in r) own(appts, r.appointment_id, t + '.appointment_id');
      if ('cash_session_id' in r) own(sessions, r.cash_session_id, t + '.cash_session_id');
      if (t === 'appointments') r.services.forEach((s) => own(svcs, s.id, 'servicio'));
      if (t === 'services') r.staff_ids.forEach((s) => own(staff, s, 'services.staff_ids'));
      if (t === 'notifications' && r.data && r.data.appointment_id) own(appts, r.data.appointment_id, 'notifications.data');
      if (t === 'appointment_events' && r.data && r.data.payment_id) assert.ok(d.payments.some((p) => p.id === r.data.payment_id && p.shop_id === shop.id));
    }
  }
}

// ── Pruebas ──

test('PRNG mulberry32: determinista y en [0, 1)', () => {
  const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
  const xs = Array.from({ length: 50 }, () => a());
  assert.deepEqual(xs, Array.from({ length: 50 }, () => b()));
  assert.notDeepEqual(xs, Array.from({ length: 50 }, () => c()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
});

test('barbería demo: datos generales, equipo, horarios, servicios y descansos', async () => {
  const { r, d, of } = await base();
  const shop = r.shop;
  assert.equal(shop.slug, DEMO_SHOP_SLUG);
  assert.equal(shop.name, 'La Navaja Barber Club');
  assert.equal(shop.plan, 'demo');
  assert.equal(shop.city, 'Tepic');
  assert.equal(shop.phone, '3115550100');
  assert.equal(shop.timezone, 'America/Mazatlan');
  assert.equal(shop.brand_color, '#C49A3C');
  assert.ok(shop.tagline && shop.description && shop.address);
  const st = shopSettings(shop);
  assert.deepEqual(st.hours[0], []);
  for (let w = 1; w <= 5; w++) assert.deepEqual(st.hours[w], [[600, 1200]]);
  assert.deepEqual(st.hours[6], [[540, 1020]]);
  assert.equal(st.booking.step_min, 20); assert.equal(st.booking.lead_min, 30); assert.equal(st.booking.window_days, 30); assert.equal(st.booking.auto_confirm, true);
  assert.equal(st.public.rating, 4.9); assert.equal(st.public.reviews_count, 212); assert.equal(st.public.review_url, 'https://g.page/r/demo');
  assert.ok(st.public.instagram);
  assert.equal(st.whatsapp.mode, 'manual'); assert.equal(st.notify_email, '');

  const staff = of(shop, 'staff');
  assert.deepEqual(staff.map((s) => [s.name, s.role, s.commission_pct]), [['Mauricio Ibarra', 'owner', 0], ['Luis Herrera', 'barber', 50], ['Andrea Solís', 'barber', 45], ['Diego Ramírez', 'barber', 40]]);
  assert.ok(staff.every((s) => s.active && s.bookable && s.pin_hash && s.bio && s.avatar_url === ''));
  assert.equal(new Set(staff.map((s) => s.color)).size, 4, 'colores distintos');
  const [mau, luis, andrea, diego] = staff;
  assert.ok(diego.created_at > luis.created_at, 'Diego entró después');
  const av = (s, w) => of(shop, 'availability').filter((a) => a.staff_id === s.id && a.weekday === w).map((a) => [a.start_min, a.end_min]).sort((x, y) => x[0] - y[0]);
  assert.deepEqual(av(diego, 1), [], 'Diego no trabaja lunes');
  assert.deepEqual(av(andrea, 2), [[600, 1080]], 'Andrea sale a las 18:00 los martes');
  assert.deepEqual(av(luis, 3), [[600, 840], [900, 1200]], 'Luis come de 14:00 a 15:00');
  assert.ok(staff.every((s) => av(s, 0).length === 0), 'domingo cerrado');
  for (const a of of(shop, 'availability')) {
    const h = st.hours[a.weekday];
    assert.ok(h.some(([s, e]) => a.start_min >= s && a.end_min <= e), 'disponibilidad dentro del horario de la barbería');
  }
  assert.ok(mau.bookable, 'el dueño también atiende');

  const svcs = of(shop, 'services');
  assert.equal(svcs.length, 10);
  const price = Object.fromEntries(svcs.map((s) => [s.name, [s.duration_min, s.price, s.popular]]));
  assert.deepEqual(price['Corte clásico'], [40, 180, true]);
  assert.deepEqual(price['Fade / degradado'], [45, 220, true]);
  assert.deepEqual(price['Corte + barba'], [60, 320, true]);
  assert.deepEqual(price['Tinte / matiz'], [60, 380, false]);
  assert.deepEqual([...new Set(svcs.map((s) => s.category))].sort(), ['Barba', 'Cortes', 'Extras', 'Faciales']);

  const offs = of(shop, 'time_off');
  const vac = offs.find((t) => t.staff_id === andrea.id && t.start_min == null);
  assert.ok(vac, 'vacaciones de Andrea');
  assert.equal(addDays(vac.date_from, 1), vac.date_to, '2 días');
  assert.ok(vac.date_from > TODAY && vac.date_from <= addDays(TODAY, 14));
  const holiday = offs.find((t) => t.staff_id == null && t.date_from > TODAY);
  assert.ok(holiday && holiday.reason, 'feriado futuro de toda la barbería con motivo');
  assert.ok(holiday.date_from <= addDays(TODAY, 21));
  assert.ok(offs.some((t) => t.staff_id == null && t.date_from === '2026-09-16'), 'el 16 de septiembre (pasado) se cerró');
});

test('clientes (CRM): ~140, teléfonos únicos, cumpleaños del mes, etiquetas y cliente demo con historial', async () => {
  const { r, d, of } = await base();
  const clients = of(r.shop, 'clients');
  assert.ok(clients.length >= 130 && clients.length <= 150, 'clientes: ' + clients.length);
  const phones = clients.map((c) => c.phone);
  assert.equal(new Set(phones).size, phones.length, 'teléfonos únicos');
  assert.ok(phones.every((p) => /^311555\d{4}$/.test(p) && !['3115550100', '3115550101', '3115550102', '3115550103', '3115550104'].includes(p)));
  assert.equal(new Set(clients.map((c) => c.name)).size, clients.length, 'nombres sin repetir');
  assert.ok(clients.filter((c) => c.email).length >= 25, 'algunos con correo');
  assert.ok(clients.filter((c) => c.birthday && c.birthday.slice(5, 7) === TODAY.slice(5, 7)).length >= 5, 'cumpleaños este mes');
  assert.ok(clients.every((c) => !c.birthday || /^\d{4}-\d{2}-\d{2}$/.test(c.birthday)));
  const allowed = ['VIP', 'Barba', 'Fade', 'Nuevo', 'Frecuente'];
  assert.ok(clients.every((c) => Array.isArray(c.tags) && c.tags.every((t) => allowed.includes(t))));
  for (const t of allowed) assert.ok(clients.some((c) => c.tags.includes(t)), 'etiqueta ' + t);
  assert.ok(clients.filter((c) => c.notes).length >= 15, 'notas internas');
  assert.ok(clients.every((c) => ['online', 'manual', 'walkin'].includes(c.source) && c.deleted_at === null));
  // created_at: antes de cualquier reserva del cliente y nunca en el futuro
  const appts = of(r.shop, 'appointments');
  const firstCreated = {};
  for (const a of appts) if (!firstCreated[a.client_id] || a.created_at < firstCreated[a.client_id]) firstCreated[a.client_id] = a.created_at;
  for (const c of clients) {
    assert.ok(!firstCreated[c.id] || ms(c.created_at) <= ms(firstCreated[c.id]), 'ficha antes de su primera reserva: ' + c.name);
    assert.ok(ms(c.created_at) <= localMs(TODAY, NOW));
  }
  // Recurrencia: la mayoría de las citas son de clientes que vuelven
  const visits = {};
  for (const a of appts) if (a.status === 'completed') visits[a.client_id] = (visits[a.client_id] || 0) + 1;
  assert.ok(clients.filter((c) => (visits[c.id] || 0) >= 5).length >= clients.length * 0.3, '30 % frecuentes');
  // Primera visita marcada solo una vez por cliente
  const fv = {};
  for (const a of appts) if (a.first_visit) fv[a.client_id] = (fv[a.client_id] || 0) + 1;
  assert.ok(Object.values(fv).every((n) => n === 1) && Object.keys(fv).length >= 10);

  // Cliente demo
  const user = d.users.find((u) => u.email === DEMO_CREDENTIALS.client.email);
  const jorge = clients.find((c) => c.user_id === user.id);
  assert.equal(jorge.name, 'Jorge Castañeda');
  assert.equal(user.name, 'Jorge Castañeda');
  assert.equal(jorge.email, DEMO_CREDENTIALS.client.email);
  const mine = appts.filter((a) => a.client_id === jorge.id);
  assert.equal(mine.filter((a) => a.status === 'completed').length, 6, '6 visitas');
  const upcoming = mine.filter((a) => a.date > TODAY && ['pending', 'confirmed'].includes(a.status));
  assert.equal(upcoming.length, 1, '1 cita próxima');
  assert.ok(upcoming[0].date <= addDays(TODAY, 7));
  assert.ok(mine.every((a) => a.source === 'online' && a.created_by === user.id));
  assert.ok(jorge.notes.includes('Luis'));
});

test('citas: volumen por día, estados, orígenes, notas, folios', async () => {
  const { r, of } = await base();
  const appts = of(r.shop, 'appointments');
  const byDay = {};
  for (const a of appts) byDay[a.date] = (byDay[a.date] || 0) + 1;
  const pastDays = businessDays({ time_off: of(r.shop, 'time_off') }, r.shop, addDays(TODAY, -75), TODAY);
  assert.ok(pastDays.length >= 60);
  for (const k of pastDays) assert.ok(byDay[k] >= 12 && byDay[k] <= 26, 'citas el ' + k + ': ' + byDay[k]);
  const avg = (wd) => { const ks = pastDays.filter((k) => weekday(k) === wd); return ks.reduce((m, k) => m + byDay[k], 0) / ks.length; };
  assert.ok(avg(5) > avg(1) && avg(6) > avg(1), 'más citas viernes y sábado');
  assert.ok(Object.keys(byDay).every((k) => k >= addDays(TODAY, -75) && k <= addDays(TODAY, 21)));
  assert.ok(Object.keys(byDay).some((k) => k > addDays(TODAY, 14)), 'agenda a 3 semanas');
  assert.ok(!byDay['2026-09-16'], 'feriado sin citas');

  const past = appts.filter((a) => a.date < TODAY);
  const share = (list, st) => list.filter((a) => a.status === st).length / list.length;
  assert.ok(share(past, 'completed') >= 0.8 && share(past, 'completed') <= 0.92, 'atendidas');
  assert.ok(share(past, 'cancelled') >= 0.05 && share(past, 'cancelled') <= 0.13, 'canceladas');
  assert.ok(share(past, 'no_show') >= 0.025 && share(past, 'no_show') <= 0.08, 'no asistió');
  const future = appts.filter((a) => a.date > TODAY && a.status !== 'cancelled');
  assert.ok(share(future, 'pending') >= 0.07 && share(future, 'pending') <= 0.25, 'pendientes a futuro');
  const today = appts.filter((a) => a.date === TODAY);
  assert.equal(today.filter((a) => a.status === 'pending').length, 2, 'hoy: 2 pendientes');
  assert.ok(today.some((a) => a.status === 'completed') && today.some((a) => a.status === 'confirmed'));
  const src = (s) => appts.filter((a) => a.source === s).length / appts.length;
  assert.ok(src('online') >= 0.45 && src('online') <= 0.65, 'online ' + src('online'));
  assert.ok(src('manual') >= 0.25 && src('manual') <= 0.45, 'manual ' + src('manual'));
  assert.ok(src('walkin') >= 0.05 && src('walkin') <= 0.15, 'walkin ' + src('walkin'));
  assert.ok(appts.filter((a) => a.client_note).length >= 20 && appts.filter((a) => a.internal_note).length >= 20);
  assert.equal(new Set(appts.map((a) => a.folio)).size, appts.length, 'folios únicos');
  assert.ok(appts.every((a) => /^TB-[2-9A-HJ-NP-Z]{6}$/.test(a.folio)));
  assert.ok(appts.some((a) => a.reschedule_count === 1));
  const tomorrow = appts.filter((a) => a.date === addDays(TODAY, 1));
  assert.ok(tomorrow.some((a) => a.reminder_sent_at) && tomorrow.some((a) => !a.reminder_sent_at), 'recordatorios de mañana: algunos enviados');
  // Barbero más activo: Luis
  const staff = of(r.shop, 'staff');
  const count = (s) => appts.filter((a) => a.staff_id === s.id).length;
  assert.equal(staff.slice().sort((a, b) => count(b) - count(a))[0].name, 'Luis Herrera');
  assert.ok(appts.every((a) => a.client_id && of(r.shop, 'clients').some((c) => c.id === a.client_id && c.name === a.client_name && c.phone === a.client_phone)));
});

test('agenda: sin traslapes, dentro de disponibilidad, fuera de descansos y con tiempos coherentes', async () => {
  const { r, d } = await base();
  checkAgenda(d, r.shop, TODAY, NOW);
  checkAgenda(d, r.norte, TODAY, NOW);
});

test('agenda validada con el motor real (domain/slots.js checkFree en modo panel)', async () => {
  const { r, d, of } = await base();
  for (const shop of [r.shop, r.norte]) {
    const appts = of(shop, 'appointments');
    const ag = buildAgenda({ settings: shopSettings(shop), staff: of(shop, 'staff'), availability: of(shop, 'availability'), timeOff: of(shop, 'time_off'), appointments: appts });
    for (const a of appts) {
      const res = checkFree(ag, { staffId: a.staff_id, date: a.date, start: a.start_min, duration: a.duration_min, excludeId: a.id, now: { date: TODAY, minutes: NOW }, mode: 'staff' });
      assert.equal(res, null, a.date + ' ' + a.start_min + ': ' + (res && res.message));
    }
  }
});

test('pagos: uno por cita atendida (monto = total), propinas, métodos y ventas de producto', async () => {
  const { r, d } = await base();
  const pays = checkMoney(d, r.shop, TODAY, NOW, { products: true });
  const withAppt = pays.filter((p) => p.appointment_id);
  const share = (m) => withAppt.filter((p) => p.method === m).length / withAppt.length;
  assert.ok(share('cash') >= 0.48 && share('cash') <= 0.62, 'efectivo');
  assert.ok(share('card') >= 0.28 && share('card') <= 0.42, 'tarjeta');
  assert.ok(share('transfer') >= 0.05 && share('transfer') <= 0.15, 'transferencia');
  const tipShare = withAppt.filter((p) => p.tip > 0).length / withAppt.length;
  assert.ok(tipShare >= 0.33 && tipShare <= 0.47, 'propina en ~40 %');
  checkMoney(d, r.norte, TODAY, NOW, { products: false });
});

test('caja: un corte por día hábil pasado que cuadra, y la caja de hoy abierta con el efectivo de hoy', async () => {
  const { r, d, of } = await base();
  const { closed, sessions } = checkCash(d, r.shop, TODAY, NOW);
  assert.ok(closed.length >= 60);
  assert.ok(closed.filter((s) => s.difference === 0).length >= closed.length * 0.85, 'casi siempre sin diferencia');
  const last = closed.sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  assert.equal(last.difference, -20, 'el último corte tuvo faltante (aviso en notificaciones)');
  assert.ok(of(r.shop, 'cash_movements').some((m) => m.concept === 'Toallas y navajas' && m.type === 'expense'));
  assert.ok(of(r.shop, 'cash_movements').some((m) => m.concept === 'Depósito a banco' && m.type === 'withdrawal'));
  assert.ok(sessions.every((s) => s.opening_float === 500 && s.opened_by_name === 'Mauricio Ibarra'));
  const todayCash = of(r.shop, 'payments').filter((p) => p.date === TODAY && p.method === 'cash');
  const open = sessions.find((s) => s.status === 'open');
  assert.ok(todayCash.length > 0 && todayCash.every((p) => p.cash_session_id === open.id));
  checkCash(d, r.norte, TODAY, NOW);
});

test('comisiones: pagos quincenales de periodos cerrados = comisión + propinas (saldo del periodo en 0)', async () => {
  const { r, d, of } = await base();
  const payouts = checkPayouts(d, r.shop, TODAY);
  const staff = of(r.shop, 'staff');
  for (const s of staff.filter((x) => x.role === 'barber')) assert.ok(payouts.some((p) => p.staff_id === s.id), 'pagos a ' + s.name);
  const diego = staff.find((s) => s.name === 'Diego Ramírez');
  assert.ok(payouts.filter((p) => p.staff_id === diego.id).length < payouts.filter((p) => p.staff_id === staff[1].id).length, 'Diego con menos historial');
  // La quincena en curso aún no se paga
  assert.ok(payouts.every((p) => p.period_to < TODAY));
  assert.ok(!payouts.some((p) => p.period_from <= TODAY && p.period_to >= TODAY));
  checkPayouts(d, r.norte, TODAY);
});

test('notificaciones, mensajes de WhatsApp e historial de citas', async () => {
  const { r, d, of } = await base();
  const staff = of(r.shop, 'staff');
  const [mau, luis] = staff;
  const nts = of(r.shop, 'notifications');
  assert.ok(nts.length >= 20 && nts.length <= 32, 'notificaciones: ' + nts.length);
  const types = ['booking_new', 'booking_cancelled', 'booking_rescheduled', 'cash_closed', 'client_new', 'system'];
  for (const t of types) assert.ok(nts.some((n) => n.type === t && n.staff_id === mau.id), 'tipo ' + t);
  assert.equal(nts.filter((n) => n.staff_id === mau.id && !n.read_at).length, 8, 'dueño: 8 sin leer');
  assert.equal(nts.filter((n) => n.staff_id === luis.id && !n.read_at).length, 3, 'Luis: 3 sin leer');
  assert.ok(nts.every((n) => n.title && n.body && n.link && staff.some((s) => s.id === n.staff_id) && n.client_id === null));
  const nowT = localMs(TODAY, NOW);
  assert.ok(nts.every((n) => ms(n.created_at) <= nowT && (!n.read_at || (ms(n.read_at) >= ms(n.created_at) && ms(n.read_at) <= nowT))));
  const appts = of(r.shop, 'appointments');
  for (const n of nts.filter((x) => x.type.startsWith('booking_'))) {
    const a = appts.find((x) => x.id === n.data.appointment_id);
    assert.ok(a, 'notificación de una cita real');
    assert.equal(n.link, '#/agenda?cita=' + a.id);
    assert.ok(n.body.startsWith(a.client_name));
    if (n.type === 'booking_cancelled') assert.equal(a.status, 'cancelled');
    if (n.type === 'booking_rescheduled') assert.equal(a.reschedule_count, 1);
  }
  const cashN = nts.find((n) => n.type === 'cash_closed');
  const cs = of(r.shop, 'cash_sessions').find((s) => s.id === cashN.data.cash_session_id);
  assert.equal(cs.difference, cashN.data.difference);
  assert.match(cashN.title, /faltante de \$20\.00/);

  const msgs = of(r.shop, 'messages');
  assert.ok(msgs.length >= 30, 'mensajes: ' + msgs.length);
  for (const k of ['confirmation', 'reminder', 'thanks']) assert.ok(msgs.some((m) => m.kind === k), 'mensaje ' + k);
  const clients = of(r.shop, 'clients');
  for (const m of msgs) {
    const a = appts.find((x) => x.id === m.appointment_id);
    assert.ok(a && a.client_id === m.client_id);
    assert.equal(m.to_phone, clients.find((c) => c.id === m.client_id).phone);
    assert.ok(['sent', 'opened'].includes(m.status) && m.channel === 'whatsapp');
    assert.ok(!/\{\w+\}/.test(m.body), 'plantilla completa');
    assert.ok(m.body.includes('La Navaja Barber Club'));
    assert.ok(ms(m.created_at) <= nowT && ms(m.created_at) >= ms(a.created_at));
    if (m.kind === 'reminder') assert.ok(a.reminder_sent_at, 'cita con recordatorio marcado');
    if (m.kind === 'thanks') assert.equal(a.status, 'completed');
  }
  for (const a of appts.filter((x) => x.reminder_sent_at)) assert.ok(msgs.some((m) => m.kind === 'reminder' && m.appointment_id === a.id));

  const evs = of(r.shop, 'appointment_events');
  const evAppts = new Set(evs.map((e) => e.appointment_id));
  for (const id of evAppts) assert.ok(appts.find((a) => a.id === id).date >= addDays(TODAY, -7), 'historial solo de los últimos 7 días y futuras');
  for (const a of appts.filter((x) => x.date >= addDays(TODAY, -7))) {
    const mine = evs.filter((e) => e.appointment_id === a.id).sort((x, y) => (x.created_at < y.created_at ? -1 : 1));
    assert.equal(mine[0].type, 'created');
    assert.equal(mine[0].created_at, a.created_at);
    if (a.status === 'completed') assert.ok(mine.some((e) => e.type === 'payment') && mine.some((e) => e.type === 'status' && e.data.to === 'completed'));
    if (a.status === 'cancelled') assert.ok(mine.some((e) => e.type === 'status' && e.data.to === 'cancelled' && e.data.reason === a.cancel_reason));
    if (a.reschedule_count) assert.ok(mine.some((e) => e.type === 'rescheduled' && e.data.to.date === a.date && e.data.to.start_min === a.start_min));
  }
  assert.ok(evs.some((e) => e.type === 'rescheduled' && e.data.by === 'client'));
});

test('credenciales y PIN verificables; cada usuario entra con el rol correcto', async () => {
  const { r, d, db } = await base();
  assert.deepEqual(DEMO_CREDENTIALS, {
    owner: { email: 'dueno@demo.mx', password: 'demo1234' }, barber: { email: 'barbero@demo.mx', password: 'demo1234' },
    client: { email: 'cliente@demo.mx', password: 'demo1234' }, superadmin: { email: 'admin@demo.mx', password: 'demo1234' }
  });
  assert.equal(r.credentials.owner.email, 'dueno@demo.mx');
  const expect = { owner: ['demo:owner'], barber: ['demo:barber'], client: ['demo:client'], superadmin: [] };
  for (const [k, c] of Object.entries(DEMO_CREDENTIALS).concat([['norte', DEMO_NORTE_CREDENTIALS.owner]])) {
    const u = d.users.find((x) => x.email === c.email);
    assert.ok(u, 'usuario ' + c.email);
    assert.equal(await verifySecret(c.password, u.password_hash), true, 'contraseña de ' + c.email);
    assert.equal(await verifySecret('otra-cosa', u.password_hash), false);
    assert.match(u.password_hash, /^pbkdf2\$5000\$/);
    assert.equal(u.is_superadmin, k === 'superadmin');
    assert.equal(u.status, 'active');
    const ctxs = await contextsFor(db, { user: u, session: { kind: 'password' } });
    assert.deepEqual(ctxs.map((x) => x.shop_slug + ':' + x.role), expect[k] || [DEMO_NORTE_SLUG + ':owner'], 'contextos de ' + k);
  }
  assert.equal(d.users.length, 5);
  const staff = d.staff.filter((s) => s.shop_id === r.shop.id);
  assert.deepEqual(r.pins.map((p) => [p.name, p.pin]), DEMO_PINS.map((p) => [p.name, p.pin]));
  for (const p of DEMO_PINS) {
    const s = staff.find((x) => x.name === p.name);
    assert.equal(s.role, p.role);
    assert.equal(await verifySecret(p.pin, s.pin_hash), true, 'PIN de ' + p.name);
    assert.equal(await verifySecret('9999', s.pin_hash), false);
  }
  const nstaff = d.staff.filter((s) => s.shop_id === r.norte.id);
  for (const p of DEMO_NORTE_PINS) assert.equal(await verifySecret(p.pin, nstaff.find((x) => x.name === p.name).pin_hash), true);
  // Cuentas vinculadas: dueño → Mauricio, barbero → Luis
  const uid = (e) => d.users.find((u) => u.email === e).id;
  assert.equal(staff.find((s) => s.user_id === uid('dueno@demo.mx')).name, 'Mauricio Ibarra');
  assert.equal(staff.find((s) => s.user_id === uid('barbero@demo.mx')).name, 'Luis Herrera');
});

test('aislamiento: la segunda barbería solo referencia filas propias y scopedDb no cruza datos', async () => {
  const { r, d, db, of } = await base();
  const norte = r.norte;
  assert.equal(norte.slug, DEMO_NORTE_SLUG);
  assert.equal(norte.name, 'Barbería Norte');
  assert.equal(of(norte, 'staff').length, 3);
  assert.equal(of(norte, 'staff').filter((s) => s.role === 'barber').length, 2);
  assert.equal(of(norte, 'services').length, 4);
  const n = of(norte, 'appointments').length;
  assert.ok(n >= 30 && n <= 55, 'citas de Norte: ' + n);
  // Toda fila con shop_id es de una de las dos barberías y sus referencias no cruzan
  for (const t of Object.keys(SCHEMA)) if (SCHEMA[t].scoped) assert.ok(d[t].every((x) => x.shop_id === r.shop.id || x.shop_id === norte.id), t);
  checkRefs(d, r.shop);
  checkRefs(d, norte);
  // Mismos datos vistos con scope
  const sa = scopedDb(db, r.shop.id), sn = scopedDb(db, norte.id);
  for (const t of ['staff', 'clients', 'appointments', 'payments', 'notifications']) {
    assert.equal((await sn.find(t)).length, of(norte, t).length, t);
    assert.ok((await sn.find(t)).every((x) => x.shop_id === norte.id));
  }
  // Adivinar ids de la otra barbería no sirve
  const foreignAppt = of(r.shop, 'appointments')[0];
  const foreignClient = of(norte, 'clients')[0];
  assert.equal(await sn.findOne('appointments', { id: foreignAppt.id }), null);
  assert.equal(await sa.findOne('clients', { id: foreignClient.id }), null);
  assert.equal(await sn.update('appointments', { id: foreignAppt.id }, { status: 'cancelled' }), 0);
  assert.equal(await sn.delete('clients', { id: of(r.shop, 'clients')[0].id }), 0);
  assert.equal((await db.findOne('appointments', { id: foreignAppt.id })).status, foreignAppt.status);
  // El dueño de Norte no tiene contexto en la demo principal
  const u = d.users.find((x) => x.email === DEMO_NORTE_CREDENTIALS.owner.email);
  const ctx = await contextsFor(db, { user: u, session: { kind: 'password' } });
  assert.ok(ctx.every((c) => c.shop_id === norte.id));
  assert.ok(of(norte, 'notifications').every((x) => of(norte, 'staff').some((s) => s.id === x.staff_id)));
});

test('rendimiento y tamaño: < 2 s y JSON < 2.5 MB (cabe en localStorage)', async () => {
  const { d, elapsed } = await base();
  const json = JSON.stringify(d);
  assert.ok(elapsed < 2000, 'tiempo ' + Math.round(elapsed) + ' ms');
  assert.ok(json.length < 2.5e6, 'tamaño ' + json.length);
  assert.ok(new TextEncoder().encode(json).length < 2.6e6);
});

test('determinismo: misma seed + today → mismas fechas, estados, montos y nombres; otra seed cambia', async () => {
  const opts = { today: '2026-03-12', nowMin: 900, seed: 777 };
  const [a, b, c] = await Promise.all([seeded(opts), seeded(opts), seeded(Object.assign({}, opts, { seed: 778 }))]);
  const key = (x) => {
    const staffName = Object.fromEntries(x.d.staff.map((s) => [s.id, s.name]));
    return {
      appts: x.d.appointments.map((a) => [a.date, a.start_min, a.end_min, a.status, a.source, staffName[a.staff_id], a.client_name, a.total, a.cancel_reason, a.created_at, a.first_visit]),
      pays: x.d.payments.map((p) => [p.date, p.amount, p.tip, p.method, p.created_at]),
      clients: x.d.clients.map((k) => [k.name, k.phone, k.birthday, k.tags, k.notes, k.created_at]),
      cash: x.d.cash_sessions.map((s) => [s.date, s.expected_cash, s.difference, s.closed_at]),
      notes: x.d.notifications.map((n) => [n.type, n.title, n.body, n.read_at]),
      msgs: x.d.messages.map((m) => [m.kind, m.status, m.created_at]),
      payouts: x.d.commission_payouts.map((p) => [p.period_from, p.amount])
    };
  };
  assert.deepEqual(key(a), key(b));
  assert.notDeepEqual(key(a).appts, key(c).appts);
  assert.notEqual(a.d.appointments[0].id, b.d.appointments[0].id, 'los ids sí son aleatorios');
});

test('invariantes en fechas límite: domingo, antes de abrir, al cierre, fin e inicio de año', async () => {
  const cases = [
    { today: '2026-09-27', nowMin: 600 },   // domingo: sin citas hoy, caja abierta
    { today: '2026-09-28', nowMin: 0 },     // lunes de madrugada: nada de hoy atendido
    { today: '2026-12-19', nowMin: 1439 },  // sábado al cierre; Navidad dentro de la ventana
    { today: '2027-01-04', nowMin: 745 },   // lunes; Año Nuevo en el historial, cambio de año
    { today: '2026-05-08', nowMin: 1000, seed: 5 }
  ];
  for (const o of cases) {
    const { r, d } = await seeded(o);
    for (const shop of [r.shop, r.norte]) {
      const appts = checkAgenda(d, shop, o.today, o.nowMin);
      checkMoney(d, shop, o.today, o.nowMin, { products: shop === r.shop });
      checkCash(d, shop, o.today, o.nowMin);
      checkPayouts(d, shop, o.today);
      checkRefs(d, shop);
      if (weekday(o.today) === 0) assert.equal(appts.filter((a) => a.date === o.today).length, 0);
      if (o.nowMin === 0) assert.ok(appts.filter((a) => a.date === o.today).every((a) => a.status !== 'completed'));
    }
    const offs = d.time_off.filter((t) => t.shop_id === r.shop.id && t.staff_id == null);
    assert.ok(offs.some((t) => t.date_from > o.today && t.date_from <= addDays(o.today, 21)), 'cierre futuro para ' + o.today);
    if (o.today === '2026-12-19') assert.ok(offs.some((t) => t.date_from === '2026-12-25' && t.reason === 'Navidad'));
    if (o.today === '2027-01-04') assert.ok(!d.appointments.some((a) => a.date === '2027-01-01'), 'Año Nuevo cerrado');
    const pinned = d.appointments.filter((a) => a.shop_id === r.shop.id && a.client_name === 'Jorge Castañeda');
    assert.equal(pinned.filter((a) => a.status === 'completed').length, 6);
  }
});

test('opciones: sin plataforma, hoy por defecto en la zona de la demo y no se siembra dos veces', async () => {
  const { r, d } = await seeded({ withPlatform: false, today: TODAY, nowMin: NOW });
  assert.equal(d.shops.length, 1);
  assert.equal(r.norte, null);
  assert.ok(!d.users.some((u) => u.is_superadmin || u.email === 'norte@demo.mx'));
  assert.equal(r.credentials.superadmin, undefined);
  assert.equal(d.users.length, 3);

  const db = memoryDb();
  const res = await seedDemo(db);
  const now = nowInTz(DEMO_TZ);
  assert.ok(res.today === now.date || res.today === addDays(now.date, -1), 'hoy en America/Mazatlan');
  await assert.rejects(() => seedDemo(db), /ya está cargada/);

  // Si un correo de la demo ya existe, no se inserta nada (sin demo a medias)
  const db2 = memoryDb();
  await db2.insert('users', { id: 'us_x', email: 'admin@demo.mx', name: 'X', status: 'active', created_at: 'x' });
  await assert.rejects(() => seedDemo(db2, { today: TODAY }), /admin@demo\.mx/);
  assert.equal(await db2.count('shops'), 0);
  assert.equal(await db2.count('appointments'), 0);
  assert.equal(await db2.count('users'), 1);
});

test('convive con otras barberías ya existentes (fixture de pruebas) sin tocarlas', async () => {
  const f = await makeFixture();
  const before = JSON.stringify(f.db.dump());
  const beforeData = JSON.parse(before);
  const { shop, norte } = await seedDemo(f.db, { today: TODAY, nowMin: NOW });
  const d = f.db.dump();
  for (const t of Object.keys(SCHEMA)) {
    const old = beforeData[t];
    assert.deepEqual(d[t].slice(0, old.length), old, 'filas previas intactas en ' + t);
    if (SCHEMA[t].scoped) assert.ok(d[t].slice(old.length).every((x) => x.shop_id === shop.id || x.shop_id === norte.id));
  }
  assert.equal((await scopedDb(f.db, 'shop_a').find('appointments')).length, 0);
  assert.equal((await scopedDb(f.db, 'shop_a').find('clients')).length, 1);
  assert.equal(await f.db.count('shops'), 4);
});
