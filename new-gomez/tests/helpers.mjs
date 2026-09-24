// Arnés de pruebas: base en memoria + fixture mínimo (2 barberías) + llamada directa al router.
import { memoryDb } from '../core/db.js';
import { handle } from '../core/router.js';
import { hashSecret } from '../core/crypto.js';
import { newId, nowIso, addDays, nowInTz } from '../core/util.js';

export const PW = 'secreto123';

export async function makeFixture() {
  const db = memoryDb();
  const env = { MODE: 'demo', DEFAULT_SHOP_SLUG: 'alfa' };
  const pw = await hashSecret(PW, 1000);
  const now = nowIso();
  const hours = { 0: [], 1: [[600, 1200]], 2: [[600, 1200]], 3: [[600, 1200]], 4: [[600, 1200]], 5: [[600, 1200]], 6: [[600, 1200]] };
  const mkShop = (id, slug, name) => db.insert('shops', { id, slug, name, timezone: 'America/Mexico_City', currency: 'MXN', status: 'active', plan: 'basic', settings: { hours, booking: { lead_min: 0 } }, created_at: now });
  await mkShop('shop_a', 'alfa', 'Barbería Alfa');
  await mkShop('shop_b', 'beta', 'Barbería Beta');
  const users = {};
  for (const [k, email, sa] of [['super', 'super@t.mx', true], ['ownerA', 'owner.a@t.mx'], ['barberA', 'barber.a@t.mx'], ['ownerB', 'owner.b@t.mx'], ['clientA', 'client.a@t.mx']]) {
    users[k] = await db.insert('users', { id: 'u_' + k, email, name: k, password_hash: pw, is_superadmin: !!sa, status: 'active', created_at: now });
  }
  const staff = {};
  staff.ownerA = await db.insert('staff', { id: 'st_ownerA', shop_id: 'shop_a', user_id: 'u_ownerA', name: 'Dueño A', role: 'owner', bookable: true, active: true, commission_pct: 0, created_at: now });
  staff.barberA = await db.insert('staff', { id: 'st_barberA', shop_id: 'shop_a', user_id: 'u_barberA', name: 'Barbero A', role: 'barber', bookable: true, active: true, commission_pct: 50, pin_hash: await hashSecret('2222', 1000), created_at: now });
  staff.barberA2 = await db.insert('staff', { id: 'st_barberA2', shop_id: 'shop_a', user_id: null, name: 'Barbero A2', role: 'barber', bookable: true, active: true, commission_pct: 40, created_at: now });
  staff.ownerB = await db.insert('staff', { id: 'st_ownerB', shop_id: 'shop_b', user_id: 'u_ownerB', name: 'Dueño B', role: 'owner', bookable: true, active: true, commission_pct: 0, created_at: now });
  for (const s of ['st_ownerA', 'st_barberA', 'st_barberA2', 'st_ownerB']) {
    const shop_id = s.endsWith('B') ? 'shop_b' : 'shop_a';
    for (let wd = 1; wd <= 6; wd++) await db.insert('availability', { id: newId('av'), shop_id, staff_id: s, weekday: wd, start_min: 600, end_min: 1200 });
  }
  const svc = {};
  svc.corte = await db.insert('services', { id: 'sv_corte', shop_id: 'shop_a', name: 'Corte', duration_min: 40, price: 200, active: true, created_at: now });
  svc.barba = await db.insert('services', { id: 'sv_barba', shop_id: 'shop_a', name: 'Barba', duration_min: 20, price: 120, active: true, created_at: now });
  svc.corteB = await db.insert('services', { id: 'sv_corteB', shop_id: 'shop_b', name: 'Corte B', duration_min: 30, price: 150, active: true, created_at: now });
  const clients = {};
  clients.clientA = await db.insert('clients', { id: 'cl_clientA', shop_id: 'shop_a', user_id: 'u_clientA', name: 'Cliente A', phone: '3110000001', tags: [], source: 'online', created_at: now });
  clients.walkB = await db.insert('clients', { id: 'cl_walkB', shop_id: 'shop_b', name: 'Cliente B', phone: '3110000002', tags: [], source: 'manual', created_at: now });

  // Próximo día hábil (lun–sáb) a partir de mañana en la zona de la barbería.
  let day = addDays(nowInTz('America/Mexico_City').date, 1);
  while (new Date(day + 'T12:00:00Z').getUTCDay() === 0) day = addDays(day, 1);

  const tokens = {};
  async function call(method, path, opts) {
    opts = opts || {};
    const [p, qs] = path.split('?');
    const query = Object.fromEntries(new URLSearchParams(qs || ''));
    const headers = {};
    const tk = opts.as ? tokens[opts.as] : opts.token;
    if (tk) headers.authorization = 'Bearer ' + tk;
    if (opts.shop) headers['x-shop-id'] = opts.shop;
    const res = await handle({ method, path: p, query, body: opts.body, headers, ip: opts.ip || '1.1.1.1' }, { db, env });
    let json = null;
    try { json = JSON.parse(res.body); } catch (e) { /* CSV */ }
    return { status: res.status, json, body: res.body, headers: res.headers, data: json && json.data, error: json && json.error };
  }
  async function login(as, email) {
    const r = await call('POST', '/api/auth/login', { body: { email, password: PW } });
    if (r.status !== 200) throw new Error('login ' + as + ' falló: ' + r.body);
    tokens[as] = r.data.token;
    return r.data;
  }
  return { db, env, users, staff, svc, clients, day, call, login, tokens };
}
