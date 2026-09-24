// Importación desde la app anterior (index.html v1, localStorage 'nb:<slug>:citas' y 'nb:<slug>:staff').
//
//   POST /api/import/legacy { citas:[…], staff:[…] } → { imported, skipped, staff_created, clients_created, errors }
//
// Cita vieja: { id:'NG-XXXX', fecha, inicio (min), dur, barbero (id viejo | 'any'), barberoNombre, servicios:[nombres],
//               total, nombre, telefono, primera:'Sí'|'No', nota, creado (ISO), estado: registrada|confirmada|cancelada|atendida }
// Staff viejo: { id, nombre, rol: superadmin|owner|employee, activo, barbero, img }
//
// - Idempotente: una cita cuyo folio ya existe en la barbería se omite (se puede volver a correr).
// - Barberos por nombre (sin acentos ni mayúsculas); si no existe se crea como barbero sin PIN (el superadmin
//   viejo se ignora). 'any' → primer barbero reservable.
// - Clientes: misma regla que domain/clients.js → findOrCreateClient (ficha por teléfono dentro de la barbería,
//   source 'import'), pero en LOTE: una consulta para leer las fichas y insertMany para crear las nuevas. Con
//   5000 citas, una llamada por cita rebasaría el límite de consultas por petición de Cloudflare D1.
// - Las citas se guardan tal cual (historial): no se validan contra horarios ni choques.
import { bad, newId, nowIso, money, normPhone, isPhone, isDateKey, parseDateKey, dateKeyUTC, str } from '../util.js';
import { pickColor } from './staff.js';

const PERM = 'import.legacy';
export const MAX_CITAS = 5000;
const MAX_STAFF = 200;
const MAX_ERRORS = 20;
const STATUS_MAP = { registrada: 'confirmed', confirmada: 'confirmed', cancelada: 'cancelled', atendida: 'completed' };
const PRIMERA = { 'sí': true, 'si': true, 'no': false };

const body = (ctx) => { const b = ctx.req.body; return b && typeof b === 'object' && !Array.isArray(b) ? b : {}; };
const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
// Llave de comparación de nombres: minúsculas, sin acentos, espacios simples.
export const nameKey = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
const isRealDate = (k) => isDateKey(k) && dateKeyUTC(parseDateKey(k)) === k;
const cleanText = (v, max) => (typeof v === 'string' || typeof v === 'number') ? String(v).replace(/\s+/g, ' ').trim().slice(0, max) : '';
const capital = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const toInt = (v) => { const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN); return Number.isInteger(n) ? n : null; };
const round2 = (n) => Math.round(n * 100) / 100;

// Foto vieja: URL completa o ruta del sitio ('img/angel.jpg' → '/img/angel.jpg').
function imgOf(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (/^https:\/\/[^\s<>"'\\`]{3,300}$/i.test(s)) return s;
  const p = s.replace(/^\.?\//, '');
  return /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_.-]+)*\.(jpe?g|png|webp|gif)$/i.test(p) && !p.includes('..') ? '/' + p : null;
}

// ── Barberos ──
function staffResolver(ctx, existing) {
  const byKey = new Map();
  const byFirst = new Map(); // primera palabra → [staff] (para 'Angel' ↔ 'Ángel Gómez' si es único)
  const add = (s) => {
    const k = nameKey(s.name);
    if (!byKey.has(k) || (!byKey.get(k).active && s.active)) byKey.set(k, s);
    const f = k.split(' ')[0];
    byFirst.set(f, (byFirst.get(f) || []).concat(s));
  };
  const list = existing.slice();
  existing.forEach(add);
  const colors = existing.map((s) => s.color);
  let sort = existing.reduce((m, s) => Math.max(m, Number(s.sort) || 0), 0);
  let created = 0;
  const match = (name) => {
    const k = nameKey(name);
    if (!k) return null;
    if (byKey.has(k)) return byKey.get(k);
    if (!k.includes(' ')) { const list = byFirst.get(k) || []; if (list.length === 1) return list[0]; }
    return null;
  };
  const ensure = async (name, legacy) => {
    const found = match(name);
    if (found) return found;
    if (legacy && legacy.rol === 'superadmin') return null;
    const clean = capital(cleanText(name, 60));
    if (clean.length < 2) return null;
    const color = pickColor(colors);
    colors.push(color);
    const row = await ctx.sdb.insert('staff', {
      id: newId('st'), user_id: null, name: clean, role: 'barber',
      bookable: legacy ? legacy.barbero !== false : true, active: legacy ? legacy.activo !== false : true,
      color, avatar_url: legacy ? imgOf(legacy.img) : null, bio: null, phone: null, commission_pct: 50,
      pin_hash: null, sort: ++sort, created_at: nowIso(), updated_at: null
    });
    add(row);
    list.push(row);
    created++;
    return row;
  };
  // 'any' → primer barbero reservable (activo); si no hay, el primero activo.
  const fallback = () => list.find((s) => s.active && s.bookable) || list.find((s) => s.active) || list[0] || null;
  return { match, ensure, fallback, created: () => created };
}

// ── Clientes (semántica de findOrCreateClient, en lote) ──
function clientResolver(existing) {
  const byPhone = new Map();
  for (const c of existing) if (c.phone && !byPhone.has(c.phone)) byPhone.set(c.phone, c);
  const byName = new Map(); // sin teléfono: una ficha por nombre dentro de esta importación
  const fresh = [];
  const renamed = new Map();
  const at = nowIso();
  const make = (name, phone) => {
    const c = { id: newId('cl'), user_id: null, name: str(name, 120) || 'Cliente', phone: phone || null, email: null, tags: [], source: 'import', marketing_ok: true, created_at: at };
    fresh.push(c);
    return c;
  };
  const get = (name, phone) => {
    if (phone) {
      let c = byPhone.get(phone);
      if (c) {
        if ((!c.name || c.name === 'Cliente') && name && name !== 'Cliente' && !fresh.includes(c)) { c.name = str(name, 120); renamed.set(c.id, c.name); }
        return c;
      }
      c = make(name, phone);
      byPhone.set(phone, c);
      return c;
    }
    const k = nameKey(name);
    if (!k || k === 'cliente') return null;
    if (!byName.has(k)) byName.set(k, make(name, null));
    return byName.get(k);
  };
  return { get, fresh, renamed };
}

// ── Servicios: por nombre contra el catálogo; los que no existen se reparten el resto del total y la duración ──
function servicesFor(names, dur, total, catalog) {
  const list = (Array.isArray(names) ? names : []).map((n) => cleanText(isObj(n) ? n.nombre || n.name : n, 80)).filter(Boolean).slice(0, 10);
  if (!list.length) return [{ id: null, name: 'Servicio', price: money(total), duration_min: dur }];
  const out = list.map((name) => { const s = catalog.get(nameKey(name)); return s ? { id: s.id, name: s.name, price: money(s.price), duration_min: Math.max(0, Math.round(Number(s.duration_min) || 0)) } : { id: null, name, price: 0, duration_min: 0 }; });
  const missing = out.filter((s) => s.id === null);
  if (missing.length) {
    const known = out.filter((s) => s.id !== null);
    const restPrice = Math.max(0, total - known.reduce((m, s) => m + s.price, 0));
    const restDur = Math.max(0, dur - known.reduce((m, s) => m + s.duration_min, 0));
    const each = round2(restPrice / missing.length);
    missing.forEach((s, i) => {
      s.price = i === missing.length - 1 ? round2(restPrice - each * (missing.length - 1)) : each;
      s.duration_min = Math.floor(restDur / missing.length) + (i === missing.length - 1 ? restDur % missing.length : 0);
    });
  }
  return out;
}

async function importLegacy(ctx) {
  const b = body(ctx);
  const errs = {};
  const citas = b.citas == null ? [] : b.citas;
  const staffIn = b.staff == null ? [] : b.staff;
  if (!Array.isArray(citas)) errs.citas = 'La lista de citas no es válida (usa el respaldo de la app anterior).';
  else if (citas.length > MAX_CITAS) errs.citas = 'Máximo ' + MAX_CITAS + ' citas por importación. Divide el archivo en partes.';
  if (!Array.isArray(staffIn)) errs.staff = 'La lista del equipo no es válida.';
  else if (staffIn.length > MAX_STAFF) errs.staff = 'Máximo ' + MAX_STAFF + ' personas del equipo por importación.';
  if (Array.isArray(citas) && Array.isArray(staffIn) && !citas.length && !staffIn.length) errs.citas = 'El archivo no trae citas ni equipo para importar.';
  if (Object.keys(errs).length) throw bad(errs[Object.keys(errs)[0]], errs);

  const [staffRows, services, clients] = await Promise.all([
    ctx.sdb.find('staff', {}, { order: ['sort asc', 'name asc'] }),
    ctx.sdb.find('services', {}, { order: ['sort asc', 'name asc'] }),
    ctx.sdb.find('clients', { deleted_at: null }, { order: 'created_at asc' })
  ]);

  // Equipo viejo (se crean los que falten, excepto el superadmin).
  const staff = staffResolver(ctx, staffRows);
  const legacyById = new Map();
  for (const s of staffIn) {
    if (!isObj(s)) continue;
    const nombre = cleanText(s.nombre, 60);
    const rol = ['superadmin', 'owner', 'employee'].includes(s.rol) ? s.rol : 'employee';
    const row = { id: cleanText(s.id, 64), nombre, rol, activo: s.activo !== false, barbero: s.barbero !== false, img: s.img };
    if (row.id) legacyById.set(row.id, row);
    if (nombre && rol !== 'superadmin') await staff.ensure(nombre, row);
  }

  const catalog = new Map();
  for (const s of services) { const k = nameKey(s.name); if (!catalog.has(k) || (!catalog.get(k).active && s.active)) catalog.set(k, s); }

  // Folios ya importados (una sola consulta: el adaptador D1 resuelve listas IN grandes con un filtro en JS).
  const folios = [...new Set(citas.map((c) => (isObj(c) ? cleanText(c.id, 40) : '')).filter(Boolean))];
  const taken = new Set(folios.length ? (await ctx.sdb.find('appointments', { folio: { in: folios } })).map((a) => a.folio) : []);

  const cl = clientResolver(clients);
  const rows = [];
  const errors = [];
  let skipped = 0;
  const skip = (i, folio, message) => { skipped++; if (errors.length < MAX_ERRORS) errors.push({ index: i, folio: folio || '', message }); };
  const now = nowIso();
  for (let i = 0; i < citas.length; i++) {
    const c = citas[i];
    if (!isObj(c)) { skip(i, '', 'Registro no válido.'); continue; }
    const folio = cleanText(c.id, 40);
    if (!folio || !/^[A-Za-z0-9_-]{2,40}$/.test(folio)) { skip(i, folio, 'La cita no tiene folio válido.'); continue; }
    if (taken.has(folio)) { skip(i, folio, 'Ya estaba importada.'); continue; }
    const date = typeof c.fecha === 'string' ? c.fecha.trim() : '';
    if (!isRealDate(date) || date < '2000-01-01' || date > '2100-12-31') { skip(i, folio, 'Fecha no válida.'); continue; }
    const start = toInt(c.inicio);
    if (start == null || start < 0 || start >= 1440) { skip(i, folio, 'Hora no válida.'); continue; }
    let dur = toInt(c.dur);
    if (dur == null || dur <= 0 || dur > 720) dur = null;
    const totalRaw = Number(c.total);
    const hasTotal = c.total !== null && c.total !== '' && Number.isFinite(totalRaw) && totalRaw >= 0 && totalRaw <= 1000000;
    let snap = servicesFor(c.servicios, dur || 0, hasTotal ? money(totalRaw) : 0, catalog);
    if (!dur) {
      // Sin duración vieja: la de los servicios del catálogo (o 30 min).
      dur = snap.reduce((m, s) => m + s.duration_min, 0) || 30;
      snap = servicesFor(c.servicios, dur, hasTotal ? money(totalRaw) : 0, catalog);
    }
    dur = Math.min(dur, 1440 - start);
    const total = hasTotal ? money(totalRaw) : money(snap.reduce((m, s) => m + s.price, 0));

    // Barbero
    let st = null;
    const oldId = c.barbero == null ? '' : cleanText(c.barbero, 64);
    if (oldId && oldId !== 'any') {
      const legacy = legacyById.get(oldId) || null;
      const names = [legacy && legacy.nombre, cleanText(c.barberoNombre, 60), oldId].filter(Boolean);
      for (const n of names) { st = staff.match(n); if (st) break; }
      if (!st && !(legacy && legacy.rol === 'superadmin')) st = await staff.ensure(names[0], legacy);
    }
    if (!st) st = staff.fallback();
    if (!st) { skip(i, folio, 'No hay barberos en la barbería.'); continue; }

    const name = cleanText(c.nombre, 80) || 'Cliente';
    const p = normPhone(c.telefono);
    const phone = isPhone(p) ? p : '';
    const client = cl.get(name, phone);
    const status = STATUS_MAP[typeof c.estado === 'string' ? c.estado.trim().toLowerCase() : ''] || 'confirmed';
    const created = typeof c.creado === 'string' && c.creado.length <= 40 && !isNaN(Date.parse(c.creado)) ? new Date(Date.parse(c.creado)).toISOString() : now;
    const primera = PRIMERA[typeof c.primera === 'string' ? c.primera.trim().toLowerCase() : ''];
    const nota = cleanText(c.nota, 500);
    rows.push({
      id: newId('ap'), folio, client_id: client ? client.id : null, staff_id: st.id, date, start_min: start, end_min: start + dur,
      duration_min: dur, services: snap, total, status, source: 'import', client_name: name, client_phone: phone,
      client_note: nota || null, internal_note: null, cancel_reason: null, cancelled_by: null, manage_token_hash: null,
      first_visit: primera === undefined ? null : primera, reminder_sent_at: null,
      confirmed_at: status === 'confirmed' ? created : null, completed_at: status === 'completed' ? created : null,
      reschedule_count: 0, created_by: ctx.actor.id, created_at: created, updated_at: null
    });
    taken.add(folio);
  }

  if (cl.fresh.length) await ctx.sdb.insertMany('clients', cl.fresh);
  for (const [id, name] of cl.renamed) await ctx.sdb.update('clients', { id }, { name, updated_at: now });
  if (rows.length) await ctx.sdb.insertMany('appointments', rows);
  return { imported: rows.length, skipped, staff_created: staff.created(), clients_created: cl.fresh.length, errors };
}

export const routes = [
  { method: 'POST', path: '/api/import/legacy', auth: 'shop', perm: PERM, handler: importLegacy }
];
