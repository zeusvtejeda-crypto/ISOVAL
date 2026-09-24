// Router de la API. Isomórfico: lo usan la Pages Function (servidor, D1) y la demo del navegador (memoria).
//
//   const res = await handle(req, { db, env });
//   req = { method, path, query: {}, body: any, headers: { lowercase }, ip }
//   res = { status, headers: {}, body: string }
//
// Cada módulo de core/api/*.js exporta `routes`: [{ method, path, auth, perm, handler }]
//   auth: 'public'   — sin sesión (se carga la sesión si existe, pero no se exige)
//         'user'     — cualquier sesión válida (contextos, perfil, etc.)
//         'shop'     — sesión + barbería activa (cabecera x-shop-id); crea ctx.shop/ctx.sdb/ctx.role
//         'platform' — solo superadmin
//         'automation' — Authorization: Bearer <env.AUTOMATION_KEY> (proveedores de WhatsApp, cron externo)
//   perm: 'permiso' | ['permiso', …] (basta uno) — se valida con permissions.can(ctx.role, …)
//   handler(ctx) → datos (se envían como { ok:true, data }) | { __raw:true, body, contentType, filename }
import { HttpError, unauthorized, forbidden, bad, nowInTz } from './util.js';
import { can, permissionsFor } from './permissions.js';
import { scopedDb } from './db.js';
import { COOKIE, loadSession, contextsFor, publicUser } from './session.js';

import { routes as publicRoutes } from './api/public.js';
import { routes as authRoutes } from './api/auth.js';
import { routes as shopRoutes } from './api/shop.js';
import { routes as staffRoutes } from './api/staff.js';
import { routes as servicesRoutes } from './api/services.js';
import { routes as availabilityRoutes } from './api/availability.js';
import { routes as appointmentsRoutes } from './api/appointments.js';
import { routes as clientsRoutes } from './api/clients.js';
import { routes as paymentsRoutes } from './api/payments.js';
import { routes as cashRoutes } from './api/cash.js';
import { routes as commissionsRoutes } from './api/commissions.js';
import { routes as reportsRoutes } from './api/reports.js';
import { routes as notificationsRoutes } from './api/notifications.js';
import { routes as messagesRoutes } from './api/messages.js';
import { routes as myRoutes } from './api/my.js';
import { routes as adminRoutes } from './api/admin.js';
import { routes as automationRoutes } from './api/automation.js';
import { routes as importRoutes } from './api/importer.js';
import { routes as setupRoutes } from './api/setup.js';

export const VERSION = '2.0.0';

const ALL = [].concat(
  [{ method: 'GET', path: '/api/health', auth: 'public', handler: (ctx) => ({ ok: true, version: VERSION, backend: ctx.db.kind, mode: ctx.env.MODE || 'server' }) }],
  publicRoutes, authRoutes, shopRoutes, staffRoutes, servicesRoutes, availabilityRoutes, appointmentsRoutes,
  clientsRoutes, paymentsRoutes, cashRoutes, commissionsRoutes, reportsRoutes, notificationsRoutes, messagesRoutes,
  myRoutes, adminRoutes, automationRoutes, importRoutes, setupRoutes
);

const compiled = ALL.map((r) => {
  const keys = [];
  const re = new RegExp('^' + r.path.replace(/\/:([a-zA-Z_]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
  return Object.assign({}, r, { re, keys });
});
export function listRoutes() { return ALL.map((r) => r.method + ' ' + r.path + '  [' + r.auth + (r.perm ? ' · ' + [].concat(r.perm).join('|') : '') + ']'); }

function parseCookies(h) {
  const out = {};
  String(h || '').split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function json(status, obj, headers) {
  return { status, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, headers || {}), body: JSON.stringify(obj) };
}

export async function handle(req, { db, env }) {
  env = env || {};
  const headers = {};
  for (const k of Object.keys(req.headers || {})) headers[k.toLowerCase()] = req.headers[k];
  const method = (req.method || 'GET').toUpperCase();
  const path = req.path.replace(/\/+$/, '') || '/';
  const outHeaders = {};
  const setCookies = [];

  let route = null, params = {};
  let methodMismatch = false;
  for (const r of compiled) {
    const m = r.re.exec(path);
    if (!m) continue;
    if (r.method !== method) { methodMismatch = true; continue; }
    route = r;
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    break;
  }
  if (!route) return json(methodMismatch ? 405 : 404, { ok: false, error: { code: methodMismatch ? 'method_not_allowed' : 'not_found', message: 'Ruta no encontrada.' } });

  const ctx = {
    req: { method, path, query: req.query || {}, body: req.body == null ? {} : req.body, headers, ip: req.ip || headers['cf-connecting-ip'] || '' },
    env, db, params,
    user: null, session: null, token: null, contexts: [],
    shop: null, sdb: null, role: null, staff: null, client: null,
    setCookie(name, value, opts) {
      opts = opts || {};
      const secure = env.MODE !== 'demo' && env.INSECURE_COOKIES !== '1';
      let c = name + '=' + encodeURIComponent(value) + '; Path=/; HttpOnly; SameSite=Lax' + (secure ? '; Secure' : '');
      if (opts.maxAge != null) c += '; Max-Age=' + opts.maxAge;
      setCookies.push(c);
    },
    header(k, v) { outHeaders[k.toLowerCase()] = v; },
    can(perm) { return !!ctx.role && can(ctx.role, perm); },
    require(perm) { if (![].concat(perm).some((p) => ctx.can(p))) throw forbidden(); },
    now() { return nowInTz(ctx.shop ? ctx.shop.timezone : 'America/Mexico_City'); },
    get actor() {
      if (ctx.staff) return { id: ctx.staff.id, name: ctx.staff.name, kind: 'staff' };
      if (ctx.user) return { id: ctx.user.id, name: ctx.user.name, kind: ctx.role === 'client' ? 'client' : 'user' };
      return { id: null, name: 'Cliente (en línea)', kind: 'public' };
    }
  };

  try {
    // ── Sesión: cookie HttpOnly (navegador) o Authorization: Bearer (demo, apps, integraciones) ──
    const auth = headers['authorization'] || '';
    let viaCookie = false;
    let token = /^Bearer\s+/i.test(auth) ? auth.replace(/^Bearer\s+/i, '').trim() : '';
    if (!token) { token = parseCookies(headers['cookie'])[COOKIE] || ''; viaCookie = !!token; }

    if (route.auth === 'automation') {
      if (!env.AUTOMATION_KEY || token !== env.AUTOMATION_KEY) throw unauthorized('Llave de automatización inválida.');
    } else if (token) {
      const s = await loadSession(db, token);
      if (s) {
        ctx.session = s; ctx.token = token;
        if (s.user_id) {
          const u = await db.findOne('users', { id: s.user_id });
          if (u && u.status === 'active') ctx.user = u; else ctx.session = null;
        }
      }
    }
    // CSRF: con cookie, las escrituras deben traer la cabecera x-requested-with (un sitio ajeno no puede ponerla sin CORS).
    if (viaCookie && method !== 'GET' && headers['x-requested-with'] !== 'tb') throw forbidden('Solicitud no permitida (CSRF).');

    if (route.auth !== 'public' && route.auth !== 'automation' && !ctx.session) throw unauthorized();

    if (ctx.session) ctx.contexts = await contextsFor(db, { user: ctx.user, session: ctx.session });

    if (route.auth === 'platform' && !(ctx.user && ctx.user.is_superadmin)) throw forbidden();
    if (route.auth === 'platform') ctx.role = 'superadmin';

    if (route.auth === 'shop') await resolveShop(ctx);

    if (route.perm) ctx.require(route.perm);

    const data = await route.handler(ctx);
    if (setCookies.length) outHeaders['set-cookie'] = setCookies;
    if (data && data.__raw) {
      const h = Object.assign({ 'content-type': data.contentType || 'text/plain; charset=utf-8', 'cache-control': 'no-store' }, outHeaders);
      if (data.filename) h['content-disposition'] = 'attachment; filename="' + data.filename + '"';
      return { status: 200, headers: h, body: data.body };
    }
    return json(200, { ok: true, data: data === undefined ? null : data }, outHeaders);
  } catch (e) {
    if (setCookies.length) outHeaders['set-cookie'] = setCookies;
    if (e instanceof HttpError) return json(e.status, { ok: false, error: { code: e.code, message: e.message, fields: e.fields || undefined } }, outHeaders);
    if (typeof console !== 'undefined') console.error('[api] ' + method + ' ' + path, e);
    return json(500, { ok: false, error: { code: 'server_error', message: 'Ocurrió un error inesperado. Intenta de nuevo.' } }, outHeaders);
  }
}

// Barbería activa: cabecera x-shop-id (o ?shop=). Si el usuario solo tiene una, se usa esa.
async function resolveShop(ctx) {
  const wanted = ctx.req.headers['x-shop-id'] || ctx.req.query.shop || '';
  const isSuper = !!(ctx.user && ctx.user.is_superadmin);
  let c = null;
  if (wanted) c = ctx.contexts.find((x) => x.shop_id === wanted) || null;
  else if (ctx.contexts.length === 1) c = ctx.contexts[0];
  let shop = null;
  if (c) shop = await ctx.db.findOne('shops', { id: c.shop_id });
  else if (isSuper && wanted) shop = await ctx.db.findOne('shops', { id: wanted });
  if (!shop) {
    if (!wanted) throw bad('Elige una barbería.', { shop: 'required' });
    throw forbidden('No tienes acceso a esa barbería.');
  }
  if (shop.status === 'suspended' && !isSuper) throw forbidden('Esta barbería está suspendida. Contacta a soporte.');
  ctx.shop = shop;
  ctx.sdb = scopedDb(ctx.db, shop.id);
  if (isSuper) { ctx.role = 'superadmin'; }
  else {
    ctx.role = c.role;
    if (c.staff_id) {
      ctx.staff = await ctx.sdb.findOne('staff', { id: c.staff_id });
      if (!ctx.staff || !ctx.staff.active) throw forbidden('Tu acceso a esta barbería está desactivado.');
      ctx.role = ctx.staff.role;
    }
    if (c.client_id) ctx.client = await ctx.sdb.findOne('clients', { id: c.client_id });
  }
  // Un superadmin que además es staff de esta barbería conserva su ficha de staff (para "mis citas").
  if (isSuper && c && c.staff_id) ctx.staff = await ctx.sdb.findOne('staff', { id: c.staff_id });
}

export { publicUser, permissionsFor };
