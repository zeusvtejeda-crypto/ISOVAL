// CRM de clientes: listado con estadísticas, ficha con historial, alta, edición y borrado lógico.
// Barbero (clients.read.own): solo clientes con al menos una cita con él; en la ficha y en las
// estadísticas solo cuentan SUS citas y SUS cobros. Dueño/superadmin: toda la barbería.
import { bad, forbidden, notFound, newId, nowIso, int, clamp, money, normPhone } from '../util.js';
import { apptView } from '../domain/views.js';
import { body, failIf, dupError, textIn, phoneIn, emailIn, boolIn, isRealDate } from './shop.js';

const READ = ['clients.read.all', 'clients.read.own'];
export const CLIENT_SORTS = ['recent', 'name', 'visits', 'spent'];
const MAX_TAGS = 10;
const MAX_TAG_LEN = 20;
const ACTIVE = ['pending', 'confirmed'];
const IN_CHUNK = 80;     // D1 admite ~100 parámetros por sentencia
const MAX_IN_QUERIES = 3; // más ids que esto × 80 → una consulta amplia filtrada en JS
const NOT_FOUND = 'No encontramos ese cliente.';

// null = ve todo; id = solo lo suyo.
function ownScope(ctx) {
  if (ctx.can('clients.read.all')) return null;
  if (!ctx.staff) throw forbidden();
  return ctx.staff.id;
}
// Minúsculas sin acentos (búsqueda y orden estables en servidor y navegador).
export const fold = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const newestFirst = (a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0);
const uniqById = (rows) => { const m = new Map(); for (const r of rows) m.set(r.id, r); return [...m.values()]; };

async function findByIds(sdb, table, col, ids, where) {
  if (!ids.length) return [];
  if (ids.length > IN_CHUNK * MAX_IN_QUERIES) {
    const set = new Set(ids);
    return (await sdb.find(table, where || {})).filter((r) => set.has(r[col]));
  }
  const out = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) out.push(...await sdb.find(table, Object.assign({}, where || {}, { [col]: { in: ids.slice(i, i + IN_CHUNK) } })));
  return out;
}

// Citas y pagos de los clientes `ids` (null = todos) visibles para quien pregunta (own = id del barbero).
// Consultas acotadas: 1 de citas y 1–2 de pagos por página (no una por cliente).
export async function loadActivity(sdb, ids, own) {
  const ownW = own ? { staff_id: own } : {};
  const appts = ids ? await findByIds(sdb, 'appointments', 'client_id', ids, ownW)
    : await sdb.find('appointments', Object.assign({ client_id: { isNull: false } }, ownW));
  const apptIds = appts.map((a) => a.id);
  const apptSet = new Set(apptIds);
  const idSet = ids ? new Set(ids) : null;
  const inClients = (x) => !!x && (!idSet || idSet.has(x));
  let pays;
  if (own) {
    // Cobros de SUS citas + cobros sueltos (sin cita) que él registró a esos clientes.
    const loose = { staff_id: own, appointment_id: null };
    pays = uniqById([].concat(
      await findByIds(sdb, 'payments', 'appointment_id', apptIds),
      ids ? await findByIds(sdb, 'payments', 'client_id', ids, loose) : await sdb.find('payments', Object.assign({ client_id: { isNull: false } }, loose))
    ));
  } else if (ids) {
    pays = uniqById([].concat(await findByIds(sdb, 'payments', 'client_id', ids), await findByIds(sdb, 'payments', 'appointment_id', apptIds)));
  } else {
    pays = await sdb.find('payments', { $or: [{ client_id: { isNull: false } }, { appointment_id: { isNull: false } }] });
  }
  pays = pays.filter((p) => apptSet.has(p.appointment_id) || (inClients(p.client_id) && (!own || (!p.appointment_id && p.staff_id === own))));
  return { appts, pays };
}

export const emptyStats = () => ({ visits: 0, completed: 0, cancelled: 0, no_shows: 0, total_spent: 0, last_visit: null, next_visit: null, first_visit: null, avg_ticket: 0, appointments: 0 });

// Estadísticas por cliente (docs/API.md → ClientWithStats). Gasto = pagos `paid` (sin propina);
// una cita atendida sin ningún pago registrado cuenta su total.
export function computeStats(ids, appts, pays, today) {
  const out = {};
  for (const id of ids) out[id] = emptyStats();
  const apptById = {};
  for (const a of appts) apptById[a.id] = a;
  const withPay = new Set();
  for (const p of pays) {
    const a = p.appointment_id ? apptById[p.appointment_id] : null;
    if (p.appointment_id) withPay.add(p.appointment_id);
    const s = out[a ? a.client_id : p.client_id];
    if (s && p.status === 'paid') s.total_spent += Number(p.amount) || 0;
  }
  for (const a of appts) {
    const s = out[a.client_id];
    if (!s) continue;
    s.appointments++;
    if (a.status === 'completed') {
      s.completed++;
      if (!withPay.has(a.id)) s.total_spent += Number(a.total) || 0;
      if (!s.last_visit || a.date > s.last_visit) s.last_visit = a.date;
      if (!s.first_visit || a.date < s.first_visit) s.first_visit = a.date;
    } else if (a.status === 'cancelled') s.cancelled++;
    else if (a.status === 'no_show') s.no_shows++;
    else if (ACTIVE.includes(a.status) && a.date >= today && (!s.next_visit || a.date < s.next_visit)) s.next_visit = a.date;
  }
  for (const id of ids) {
    const s = out[id];
    s.visits = s.completed;
    s.total_spent = money(s.total_spent);
    s.avg_ticket = s.visits ? money(s.total_spent / s.visits) : 0;
  }
  return out;
}
export function withStats(c, stats) {
  return Object.assign({}, c, { tags: Array.isArray(c.tags) ? c.tags : [], stats: stats || emptyStats() });
}

// ── Búsqueda y orden ──
function matcher(text) {
  const digits = text.replace(/\D/g, '');
  const phoneQuery = digits.length >= 3 && /^[\d\s()+.-]+$/.test(text);
  const d = digits.length > 10 ? normPhone(digits) : digits;
  const words = fold(text).split(/\s+/).filter(Boolean);
  return (c) => {
    if (phoneQuery) return String(c.phone || '').includes(d);
    const hay = fold(c.name) + ' ' + fold(c.email) + ' ' + (c.phone || '');
    return words.every((w) => hay.includes(w));
  };
}
const byName = (a, b) => (fold(a.name) < fold(b.name) ? -1 : fold(a.name) > fold(b.name) ? 1 : (a.id < b.id ? -1 : 1));
const desc = (x, y) => (x === y ? 0 : x == null ? 1 : y == null ? -1 : x < y ? 1 : -1); // nulos al final
function sorter(sort, stats) {
  if (sort === 'name') return byName;
  if (sort === 'visits') return (a, b) => desc(stats[a.id].visits, stats[b.id].visits) || desc(stats[a.id].last_visit, stats[b.id].last_visit) || byName(a, b);
  if (sort === 'spent') return (a, b) => desc(stats[a.id].total_spent, stats[b.id].total_spent) || byName(a, b);
  // recent: última visita; quien nunca ha venido va después, por fecha de alta.
  return (a, b) => desc(stats[a.id].last_visit, stats[b.id].last_visit) || desc(a.created_at, b.created_at) || byName(a, b);
}
function collectTags(clients) {
  const m = new Map();
  for (const c of clients) for (const t of (Array.isArray(c.tags) ? c.tags : [])) { const k = fold(t); if (k && !m.has(k)) m.set(k, t); }
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map((x) => x[1]);
}

// ── Entrada ──
function parseTags(errs, v) {
  if (v === undefined) return undefined;
  if (v === null || v === '') return [];
  const list = typeof v === 'string' ? v.split(',') : v;
  if (!Array.isArray(list)) { errs.tags = 'Las etiquetas no son válidas.'; return undefined; }
  const out = [];
  const seen = new Set();
  for (const t of list) {
    if (typeof t !== 'string' && typeof t !== 'number') { errs.tags = 'Las etiquetas no son válidas.'; return undefined; }
    const s = String(t).replace(/\s+/g, ' ').trim();
    if (!s) continue;
    if (s.length > MAX_TAG_LEN) { errs.tags = 'Cada etiqueta puede tener máximo ' + MAX_TAG_LEN + ' caracteres ("' + s.slice(0, MAX_TAG_LEN) + '…").'; return undefined; }
    const k = fold(s);
    if (seen.has(k)) continue; // repetidas (sin importar mayúsculas/acentos) se ignoran
    seen.add(k);
    out.push(s);
  }
  if (out.length > MAX_TAGS) { errs.tags = 'Máximo ' + MAX_TAGS + ' etiquetas por cliente.'; return undefined; }
  return out;
}
function parseInput(b, { create, today }) {
  const errs = {};
  const v = {};
  const put = (k, x) => { if (x !== undefined) v[k] = x; };
  put('name', textIn(errs, 'name', create && b.name === undefined ? null : b.name, { min: 2, max: 80, label: 'El nombre', empty: 'Escribe el nombre del cliente.' }));
  put('phone', phoneIn(errs, 'phone', b.phone));
  put('email', emailIn(errs, 'email', b.email));
  if (b.birthday !== undefined) {
    if (b.birthday === null || b.birthday === '') v.birthday = null;
    else if (!isRealDate(b.birthday) || b.birthday < '1900-01-01') errs.birthday = 'Escribe la fecha de nacimiento como AAAA-MM-DD.';
    else if (b.birthday > today) errs.birthday = 'La fecha de nacimiento no puede ser futura.';
    else v.birthday = b.birthday;
  }
  const notes = textIn(errs, 'notes', b.notes, { max: 1000, label: 'Las notas', multiline: true });
  if (notes !== undefined) v.notes = notes || null;
  put('tags', parseTags(errs, b.tags));
  put('marketing_ok', boolIn(errs, 'marketing_ok', b.marketing_ok));
  failIf(errs);
  return v;
}
// Teléfono único por barbería (entre clientes no borrados).
async function assertPhoneFree(sdb, phone, exceptId) {
  const dup = await sdb.findOne('clients', exceptId ? { phone, deleted_at: null, id: { ne: exceptId } } : { phone, deleted_at: null });
  if (dup) throw dupError('Ya tienes un cliente con ese teléfono: ' + dup.name, 'phone');
}
// Cliente visible para quien pregunta (otra barbería, borrado o sin citas con el barbero → 404).
async function findVisible(ctx, own) {
  const c = await ctx.sdb.findOne('clients', { id: String(ctx.params.id || ''), deleted_at: null });
  if (!c) throw notFound(NOT_FOUND);
  const act = await loadActivity(ctx.sdb, [c.id], own);
  if (own && !act.appts.length) throw notFound(NOT_FOUND);
  return { client: c, act };
}

// ── Handlers ──
async function list(ctx) {
  const q = ctx.req.query;
  const own = ownScope(ctx);
  const sort = q.sort ? String(q.sort) : 'recent';
  if (!CLIENT_SORTS.includes(sort)) throw bad('Orden no válido.', { sort: 'Usa recent, name, visits o spent.' });
  const limit = clamp(int(q.limit, 50), 1, 200);
  const offset = clamp(int(q.offset, 0), 0, 1e6);
  const today = ctx.now().date;
  let clients, act = null;
  if (own) {
    act = await loadActivity(ctx.sdb, null, own);
    const ids = [...new Set(act.appts.map((a) => a.client_id))];
    clients = await findByIds(ctx.sdb, 'clients', 'id', ids, { deleted_at: null });
  } else clients = await ctx.sdb.find('clients', { deleted_at: null });
  // Orden base estable (el más antiguo primero): define la escritura de cada etiqueta y los empates.
  clients.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1));
  const tags = collectTags(clients);
  const text = String(q.q == null ? '' : q.q).trim().slice(0, 80);
  const tag = fold(String(q.tag == null ? '' : q.tag).trim());
  let rows = clients;
  if (text) rows = rows.filter(matcher(text));
  if (tag) rows = rows.filter((c) => (Array.isArray(c.tags) ? c.tags : []).some((t) => fold(t) === tag));
  const total = rows.length;
  let stats;
  if (sort === 'name') {
    rows = rows.sort(byName).slice(offset, offset + limit);
    const ids = rows.map((c) => c.id);
    if (!act) act = await loadActivity(ctx.sdb, ids, null);
    stats = computeStats(ids, act.appts, act.pays, today);
  } else {
    // Orden por estadísticas: se calculan para todos los filtrados (1 consulta de citas + pagos) y luego se pagina.
    const ids = rows.map((c) => c.id);
    if (!act) act = await loadActivity(ctx.sdb, rows.length === clients.length ? null : ids, null);
    stats = computeStats(ids, act.appts, act.pays, today);
    rows = rows.sort(sorter(sort, stats)).slice(offset, offset + limit);
  }
  return { items: rows.map((c) => withStats(c, stats[c.id])), total, tags };
}

async function detail(ctx) {
  const own = ownScope(ctx);
  const { client, act } = await findVisible(ctx, own);
  const apptIds = act.appts.map((a) => a.id);
  // Mensajes de sus citas + los sueltos del cliente (barbero: solo los que él preparó).
  const [byAppt, loose] = await Promise.all([
    findByIds(ctx.sdb, 'messages', 'appointment_id', apptIds),
    ctx.sdb.find('messages', own ? { client_id: client.id, appointment_id: null, created_by: own } : { client_id: client.id })
  ]);
  const messages = uniqById(byAppt.concat(loose)).sort(newestFirst).slice(0, 200);
  const stats = computeStats([client.id], act.appts, act.pays, ctx.now().date)[client.id];
  const appts = act.appts.slice().sort((a, b) => (a.date === b.date ? b.start_min - a.start_min : a.date < b.date ? 1 : -1));
  const payments = act.pays.slice().sort(newestFirst);
  return { client: withStats(client, stats), appointments: await apptView(ctx.sdb, appts), payments, messages };
}

async function create(ctx) {
  const v = parseInput(body(ctx), { create: true, today: ctx.now().date });
  if (v.phone) await assertPhoneFree(ctx.sdb, v.phone);
  const now = nowIso();
  const row = await ctx.sdb.insert('clients', {
    id: newId('cl'), user_id: null, name: v.name, phone: v.phone || null, email: v.email || null, birthday: v.birthday || null,
    notes: v.notes || null, tags: v.tags || [], source: 'manual', marketing_ok: v.marketing_ok === undefined ? true : v.marketing_ok,
    deleted_at: null, created_at: now, updated_at: now
  });
  return withStats(row, emptyStats());
}

async function update(ctx) {
  const own = ownScope(ctx);
  const { client, act } = await findVisible(ctx, own);
  const v = parseInput(body(ctx), { create: false, today: ctx.now().date });
  if (!Object.keys(v).length) throw bad('No hay cambios que guardar.');
  if (v.phone && v.phone !== client.phone) await assertPhoneFree(ctx.sdb, v.phone, client.id);
  v.updated_at = nowIso();
  await ctx.sdb.update('clients', { id: client.id }, v);
  // Las citas guardan una copia del nombre/teléfono para listados rápidos: se mantiene al día.
  const copy = {};
  if (v.name !== undefined && v.name !== client.name) copy.client_name = v.name;
  if (v.phone !== undefined && (v.phone || null) !== (client.phone || null)) copy.client_phone = v.phone || null;
  if (Object.keys(copy).length) await ctx.sdb.update('appointments', { client_id: client.id }, copy);
  const fresh = await ctx.sdb.findOne('clients', { id: client.id });
  return withStats(fresh, computeStats([client.id], act.appts, act.pays, ctx.now().date)[client.id]);
}

// Borrado lógico: el historial (citas, pagos) se conserva.
async function remove(ctx) {
  const c = await ctx.sdb.findOne('clients', { id: String(ctx.params.id || ''), deleted_at: null });
  if (!c) throw notFound(NOT_FOUND);
  const now = nowIso();
  await ctx.sdb.update('clients', { id: c.id }, { deleted_at: now, updated_at: now });
  return null;
}

export const routes = [
  { method: 'GET', path: '/api/clients', auth: 'shop', perm: READ, handler: list },
  { method: 'GET', path: '/api/clients/:id', auth: 'shop', perm: READ, handler: detail },
  { method: 'POST', path: '/api/clients', auth: 'shop', perm: 'clients.write', handler: create },
  { method: 'PATCH', path: '/api/clients/:id', auth: 'shop', perm: 'clients.write', handler: update },
  { method: 'DELETE', path: '/api/clients/:id', auth: 'shop', perm: 'clients.delete', handler: remove }
];
