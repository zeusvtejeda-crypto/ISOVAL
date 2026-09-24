// Estado global de la sesión + bus de eventos + caché de catálogos (servicios, equipo).
import { api, setShop, getMode, LS } from './api.js';
import { todayIn, nowMinIn } from './fmt.js';

export const state = {
  mode: getMode(),
  user: null,          // usuario con cuenta (null en sesión por PIN)
  staff: null,         // staff de la sesión PIN
  contexts: [],        // barberías/roles del usuario
  sessionKind: null,   // 'password' | 'pin'
  shopId: null,
  ctx: null            // respuesta de /api/context: { shop, role, permissions, staff, client, unread }
};

// ── Bus de eventos ── (p. ej. 'appointments:changed', 'notifications:changed', 'context')
const handlers = {};
export const bus = {
  on(ev, fn) { (handlers[ev] = handlers[ev] || new Set()).add(fn); return () => handlers[ev].delete(fn); },
  emit(ev, data) { (handlers[ev] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); }
};

export const can = (perm) => !!(state.ctx && state.ctx.permissions && state.ctx.permissions.includes(perm));
export const canAny = (...perms) => perms.flat().some(can);
export const role = () => (state.ctx ? state.ctx.role : null);
export const isOwnerLike = () => role() === 'owner' || role() === 'superadmin';
export const isBarber = () => role() === 'barber';
export const isClient = () => role() === 'client';
export const isSuper = () => !!(state.user && state.user.is_superadmin);
export const shop = () => (state.ctx ? state.ctx.shop : null);
export const tz = () => (shop() && shop().timezone) || 'America/Mexico_City';
export const today = () => todayIn(tz());
export const nowMin = () => nowMinIn(tz());
export const me = () => (state.ctx && state.ctx.staff) || null; // ficha de staff del usuario en esta barbería

export async function loadMe() {
  // /auth/session responde 200 también sin sesión ({ user: null }): una carga anónima no deja un 401 en consola.
  const r = await api.get('/auth/session', null, { silent401: true });
  state.user = r.user || null;
  state.staff = r.staff || null;
  state.contexts = r.contexts || [];
  state.sessionKind = r.session_kind || null;
  return r;
}
export function clearSession() {
  state.user = null; state.staff = null; state.contexts = []; state.sessionKind = null; state.ctx = null; state.shopId = null;
  setShop(null); cacheClear();
}

// Barbería activa: la recordada, la única, o la primera. Superadmin sin contextos → null (va a Plataforma).
export function preferredShopId() {
  const saved = LS.get('tb:shop:' + state.mode);
  if (saved && (state.contexts.some((c) => c.shop_id === saved) || isSuper())) return saved;
  return state.contexts.length ? state.contexts[0].shop_id : null;
}
export async function selectShop(id) {
  setShop(id);
  state.shopId = id;
  cacheClear();
  const ctx = await api.get('/context');
  state.ctx = ctx;
  LS.set('tb:shop:' + state.mode, id);
  bus.emit('context', ctx);
  return ctx;
}
export async function refreshContext() {
  if (!state.shopId) return null;
  state.ctx = await api.get('/context');
  bus.emit('context:refresh', state.ctx); // misma barbería: el shell se actualiza sin repintar la vista
  return state.ctx;
}

// ── Caché de catálogos ──
const cache = new Map();
export async function cached(key, loader, ttlMs) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < (ttlMs || 60000)) return hit.p;
  const p = loader();
  cache.set(key, { t: Date.now(), p });
  p.catch(() => cache.delete(key));
  return p;
}
export function invalidate(prefix) { for (const k of Array.from(cache.keys())) if (k.startsWith(prefix)) cache.delete(k); }
export function cacheClear() { cache.clear(); }

// Catálogos más usados (servicios y equipo de la barbería activa).
export const getServices = (all) => cached('services:' + (all ? 'all' : 'active'), () => api.get('/services', all ? { all: 1 } : null));
export const getStaff = (all) => canAny('staff.read') ? cached('staff:' + (all ? 'all' : 'active'), () => api.get('/staff', all ? { all: 1 } : null)) : Promise.resolve(me() ? [me()] : []);
bus.on('services:changed', () => invalidate('services:'));
bus.on('staff:changed', () => invalidate('staff:'));
