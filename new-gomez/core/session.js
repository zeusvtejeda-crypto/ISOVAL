// Sesiones, contextos (barberías/roles del usuario) y limitador de intentos.
import { sha256Hex, newToken } from './crypto.js';
import { nowIso, tooMany, newId } from './util.js';

export const COOKIE = 'tb_sid';
const DAY = 86400000;
export const SESSION_TTL = { password: 30 * DAY, pin: 12 * 3600000 };

export function publicUser(u) {
  if (!u) return null;
  return { id: u.id, email: u.email, name: u.name, phone: u.phone || '', is_superadmin: !!u.is_superadmin, created_at: u.created_at };
}

export async function createSession(db, { kind, user_id, staff_id, shop_id, user_agent }) {
  const token = newToken();
  const now = Date.now();
  await db.insert('sessions', {
    id: await sha256Hex(token), kind, user_id: user_id || null, staff_id: staff_id || null, shop_id: shop_id || null,
    created_at: new Date(now).toISOString(), expires_at: new Date(now + SESSION_TTL[kind]).toISOString(),
    last_seen_at: new Date(now).toISOString(), user_agent: (user_agent || '').slice(0, 200)
  });
  return token;
}
export async function destroySession(db, token) {
  if (token) await db.delete('sessions', { id: await sha256Hex(token) });
}
export async function loadSession(db, token) {
  if (!token || token.length < 20) return null;
  const s = await db.findOne('sessions', { id: await sha256Hex(token) });
  if (!s) return null;
  if (s.expires_at < nowIso()) { await db.delete('sessions', { id: s.id }); return null; }
  // Renovación deslizante (como mucho una escritura por hora para no gastar escrituras de D1).
  const lastSeen = Date.parse(s.last_seen_at || s.created_at);
  if (Date.now() - lastSeen > 3600000) {
    const patch = { last_seen_at: nowIso() };
    if (s.kind === 'password') patch.expires_at = new Date(Date.now() + SESSION_TTL.password).toISOString();
    await db.update('sessions', { id: s.id }, patch);
  }
  return s;
}

// Staff de una sesión PIN si sigue siendo válida: miembro activo, con PIN todavía configurado y, si tiene
// cuenta vinculada, con esa cuenta activa (desactivar la cuenta o quitar el PIN corta el acceso al instante,
// aunque la fila de la sesión siguiera ahí). null → la sesión PIN ya no sirve.
export async function pinSessionStaff(db, session) {
  if (!session || session.kind !== 'pin' || !session.staff_id || !session.shop_id) return null;
  const st = await db.findOne('staff', { id: session.staff_id, shop_id: session.shop_id });
  if (!st || !st.active || !st.pin_hash) return null;
  if (st.user_id) {
    const u = await db.findOne('users', { id: st.user_id });
    if (u && u.status !== 'active') return null;
  }
  return st;
}

// Cierra las sesiones de una cuenta: las de correo/contraseña (salvo exceptId, la sesión actual) y también
// las sesiones PIN de sus fichas de staff (esas no llevan user_id, solo staff_id).
export async function revokeUserSessions(db, userId, opts) {
  const exceptId = opts && opts.exceptId;
  let n = await db.delete('sessions', exceptId ? { user_id: userId, id: { ne: exceptId } } : { user_id: userId });
  n += await revokePinSessions(db, (await db.find('staff', { user_id: userId })).map((s) => s.id), opts);
  return n;
}
// Cierra las sesiones PIN de esas fichas de staff (salvo exceptId).
export async function revokePinSessions(db, staffIds, opts) {
  const exceptId = opts && opts.exceptId;
  const ids = [...new Set((staffIds || []).filter(Boolean))];
  let n = 0;
  for (let i = 0; i < ids.length; i += 80) {
    const where = { kind: 'pin', staff_id: { in: ids.slice(i, i + 80) } };
    if (exceptId) where.id = { ne: exceptId };
    n += await db.delete('sessions', where);
  }
  return n;
}

// Contextos del usuario: en qué barberías está y con qué rol. Superadmin ve además "plataforma".
export async function contextsFor(db, { user, session }) {
  const out = [];
  const shopCache = {};
  const shopOf = async (id) => (shopCache[id] = shopCache[id] || await db.findOne('shops', { id }));
  if (session && session.kind === 'pin') {
    const st = await pinSessionStaff(db, session);
    const sh = st ? await shopOf(session.shop_id) : null;
    if (st && sh) out.push(ctxRow(sh, st.role, st.id, null, st.name));
    return out;
  }
  if (!user) return out;
  const staffRows = await db.find('staff', { user_id: user.id, active: true });
  for (const st of staffRows) { const sh = await shopOf(st.shop_id); if (sh) out.push(ctxRow(sh, st.role, st.id, null, st.name)); }
  const clientRows = await db.find('clients', { user_id: user.id, deleted_at: null });
  for (const c of clientRows) {
    if (out.some((x) => x.shop_id === c.shop_id)) continue; // si también es staff ahí, gana el rol de staff
    const sh = await shopOf(c.shop_id); if (sh) out.push(ctxRow(sh, 'client', null, c.id, c.name));
  }
  return out;
}
function ctxRow(sh, role, staff_id, client_id, display_name) {
  return { shop_id: sh.id, shop_slug: sh.slug, shop_name: sh.name, shop_logo: sh.logo_url || '', shop_status: sh.status, role, staff_id, client_id, display_name };
}

// ── Limitador de intentos (login, PIN, registro, alta, cambio de PIN…) sobre la tabla login_attempts ──
//
// Una fila POR INTENTO: id = <clave> + '#' + id único, first_at = cuándo fue. Contar es insertar la fila
// propia y luego leer las de la clave: solo hay inserciones y borrados de filas propias, nunca un
// "leer el contador → sumarle 1 → escribirlo", así que peticiones simultáneas no pisan el conteo de otras
// y el resultado es el mismo en memoryDb y en D1 (cada sentencia de D1 es atómica).
// Ventana deslizante: la clave queda bloqueada mientras tenga `max` intentos en los últimos
// max(windowMin, lockMin) minutos (en todos los límites actuales windowMin = lockMin).
//
//   rateHit(db, key, lim)     Cuenta ESTE intento ANTES del trabajo caro (verificar contraseña o PIN, crear la
//                             cuenta…). Si con él se pasa del máximo lo retira y lanza 429. Como el intento ya
//                             cuenta mientras se procesa, N peticiones en paralelo no pueden pasar todas.
//                             Devuelve un recibo para rateRelease.
//   rateRelease(db, recibo)   Retira ese intento (salió bien y no debe contar; p. ej. la clave ip: de un login correcto).
//   rateReset(db, key)        Borra todos los intentos de la clave (p. ej. tras un login correcto en pw:).
//   rateCheck / rateFail      Interfaz anterior (solo consultar / contar un intento ya hecho). Siguen funcionando
//                             y rateFail ya no pierde conteos, pero entre ambos puede haber peticiones en vuelo:
//                             para límites de seguridad usa rateHit.
const ATTEMPT_SEP = '#';
const SWEEP_MS = 2 * DAY; // filas más viejas que esto sobran para cualquier límite (el más largo es de 24 h)
// La clave se escapa para que ninguna otra clave caiga en su rango de ids (un correo puede traer '#').
const attemptPrefix = (key) => String(key).replace(/%/g, '%25').replace(/#/g, '%23') + ATTEMPT_SEP;
// where de las filas-intento de una clave (los sufijos son [0-9a-z], todos < '~').
export function attemptsWhere(key) {
  const p = attemptPrefix(key);
  return { id: { gt: p, lt: p + '~' } };
}
const spanMs = (lim) => Math.max(Number(lim.windowMin) || 0, Number(lim.lockMin) || 0) * 60000;

// Intentos vigentes de la clave (más viejos primero). También respeta la fila del formato anterior
// (id = key, con count y locked_until) mientras siga vigente: su `count` cuenta como intentos hechos en su
// first_at. Borra de paso lo ya vencido de esta clave.
async function liveAttempts(db, key, lim, now) {
  const since = new Date(now - spanMs(lim)).toISOString();
  const rows = await db.find('login_attempts', { $or: [{ id: key }, attemptsWhere(key)] }, { order: ['first_at asc', 'id asc'] });
  const legacy = rows.find((r) => r.id === key) || null;
  const own = rows.filter((r) => r.id !== key);
  const live = own.filter((r) => r.first_at >= since);
  if (live.length < own.length) await db.delete('login_attempts', Object.assign(attemptsWhere(key), { first_at: { lt: since } }));
  let lockedUntil = 0;
  if (legacy) {
    if (legacy.locked_until && Date.parse(legacy.locked_until) > now) lockedUntil = Date.parse(legacy.locked_until);
    if (legacy.first_at >= since) {
      const n = Math.min(Math.max(Number(legacy.count) || 0, 0), 1000);
      live.unshift(...Array.from({ length: n }, () => ({ id: key, first_at: legacy.first_at })));
      live.sort((a, b) => (a.first_at < b.first_at ? -1 : a.first_at > b.first_at ? 1 : 0));
    } else if (!lockedUntil) await db.delete('login_attempts', { id: key });
  }
  return { live, lockedUntil };
}
// 429 con el tiempo que falta para que vuelva a haber lugar (se libera el intento más viejo que sobra).
function blocked(live, lim, now, lockedUntil) {
  const over = live.length - lim.max; // cuántos intentos deben caducar para tener lugar para uno más
  let until = lockedUntil || 0;
  if (over >= 0 && live[over]) until = Math.max(until, Date.parse(live[over].first_at) + spanMs(lim));
  // Tope: nunca más que la ventana (los intentos simultáneos pueden traer una marca de tiempo posterior a `now`).
  const cap = Math.max(spanMs(lim), lockedUntil ? lockedUntil - now : 0);
  const mins = Math.max(1, Math.ceil(Math.min(until - now, cap) / 60000));
  return tooMany('Demasiados intentos. Intenta de nuevo en ' + (mins > 90 ? Math.ceil(mins / 60) + ' h.' : mins + ' min.'));
}
// Limpieza ocasional de filas viejas de claves que ya no se usan (no bloquea la petición si falla).
async function sweep(db, now) {
  if (Math.random() >= 0.02) return;
  try { await db.delete('login_attempts', { first_at: { lt: new Date(now - SWEEP_MS).toISOString() } }); } catch (e) { /* nada */ }
}
async function addAttempt(db, key, now) {
  const id = attemptPrefix(key) + newId();
  await db.insert('login_attempts', { id, count: 1, first_at: new Date(now).toISOString(), locked_until: null });
  return id;
}

export async function rateHit(db, key, lim) {
  const now = Date.now();
  const id = await addAttempt(db, key, now);
  let st;
  try { st = await liveAttempts(db, key, lim, now); } catch (e) { try { await db.delete('login_attempts', { id }); } catch (x) { /* nada */ } throw e; }
  const others = st.live.filter((r) => r.id !== id);
  if (st.lockedUntil || others.length >= lim.max) {
    await db.delete('login_attempts', { id });
    throw blocked(others, lim, now, st.lockedUntil);
  }
  await sweep(db, now);
  return { key, id };
}
export async function rateRelease(db, receipt) {
  if (receipt && receipt.id) await db.delete('login_attempts', { id: receipt.id });
}
export async function rateCheck(db, key, lim) {
  const now = Date.now();
  const st = await liveAttempts(db, key, lim, now);
  if (st.lockedUntil || st.live.length >= lim.max) throw blocked(st.live, lim, now, st.lockedUntil);
  return { count: st.live.length, max: lim.max };
}
export async function rateFail(db, key, lim) {
  const now = Date.now();
  const id = await addAttempt(db, key, now);
  await sweep(db, now);
  return { key, id };
}
export async function rateReset(db, key) {
  await db.delete('login_attempts', { $or: [{ id: key }, attemptsWhere(key)] });
}
