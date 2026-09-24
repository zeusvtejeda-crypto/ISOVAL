// Sesiones, contextos (barberías/roles del usuario) y limitador de intentos.
import { sha256Hex, newToken } from './crypto.js';
import { nowIso, tooMany } from './util.js';

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

// Contextos del usuario: en qué barberías está y con qué rol. Superadmin ve además "plataforma".
export async function contextsFor(db, { user, session }) {
  const out = [];
  const shopCache = {};
  const shopOf = async (id) => (shopCache[id] = shopCache[id] || await db.findOne('shops', { id }));
  if (session && session.kind === 'pin') {
    const st = await db.findOne('staff', { id: session.staff_id, shop_id: session.shop_id });
    const sh = await shopOf(session.shop_id);
    if (st && st.active && sh) out.push(ctxRow(sh, st.role, st.id, null, st.name));
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

// ── Limitador de intentos (login con contraseña, PIN, registro) sobre la tabla login_attempts ──
export async function rateCheck(db, key, { max, windowMin, lockMin }) {
  const row = await db.findOne('login_attempts', { id: key });
  const now = Date.now();
  if (row && row.locked_until && Date.parse(row.locked_until) > now) {
    const mins = Math.ceil((Date.parse(row.locked_until) - now) / 60000);
    throw tooMany('Demasiados intentos. Intenta de nuevo en ' + mins + ' min.');
  }
  return { row, max, windowMin, lockMin };
}
export async function rateFail(db, key, { max, windowMin, lockMin }) {
  const row = await db.findOne('login_attempts', { id: key });
  const now = Date.now();
  if (!row || now - Date.parse(row.first_at) > windowMin * 60000) {
    if (row) await db.delete('login_attempts', { id: key });
    await db.insert('login_attempts', { id: key, count: 1, first_at: new Date(now).toISOString(), locked_until: null });
    return;
  }
  const count = row.count + 1;
  await db.update('login_attempts', { id: key }, { count, locked_until: count >= max ? new Date(now + lockMin * 60000).toISOString() : null });
}
export async function rateReset(db, key) { await db.delete('login_attempts', { id: key }); }
