// Ficha de cliente (CRM), siempre dentro de la MISMA barbería (sdb con scope). La usan la reserva en línea
// (api/public.js, source 'online') y el alta de citas del panel (api/appointments.js, source 'manual'|'walkin').
//
//   findOrCreateClient(sdb, { name, phone, email, user_id?, source })
//     → { client, created, generic? }
//   provenClient(db, sdb, tokens) → ficha sin cuenta cuyas citas TODAS vienen en `tokens` (enlaces de gestión) | null
//
// Reglas (ver docs/API.md → "Fichas de cliente"):
//  1. Con user_id (reserva en línea con sesión de cliente): SOLO la ficha de ESE usuario. Nunca se le asigna
//     una ficha encontrada por el teléfono o el correo escritos en el formulario, ni por el correo de su cuenta
//     (no está verificado): cualquiera que conozca esos datos se quedaría con el historial y las citas de otra
//     persona. Si aún no tiene ficha se le crea una propia; el teléfono/correo escritos se guardan en ella solo
//     si ninguna otra ficha los usa (así no se duplican teléfonos en el CRM).
//  2. Sin user_id: se reutiliza la ficha por teléfono y, si no, por correo. Si los datos vienen de la reserva
//     en línea (source 'online', sin verificar) NO se agregan teléfono ni correo a la ficha existente (un
//     correo ajeno agregado así permitiría reclamarla después), y NUNCA se usa una ficha con cuenta: su dueño
//     vería en «Mis citas» las reservas de quien escribiera su teléfono o su correo.
//  3. Sin teléfono, correo ni user_id, desde el panel ("cliente sin registro"): se reutiliza UNA ficha
//     genérica por barbería (WALKIN: 'Cliente de paso', source 'walkin', etiqueta 'Sin registro') en vez de
//     crear una ficha por cita. En ese caso `client` es una COPIA de la ficha genérica con `name` = el nombre
//     escrito (el llamador lo guarda en client_name de la cita; la ficha en la base no cambia) y
//     `generic: true`. La reserva en línea sin teléfono ni correo sigue creando su propia ficha.
import { newId, nowIso, normPhone, normEmail, str } from '../util.js';
import { findByManageToken } from './messages.js';

export const WALKIN = Object.freeze({ name: 'Cliente de paso', source: 'walkin', tag: 'Sin registro' });

export async function findOrCreateClient(sdb, { name, phone, email, user_id, source }) {
  const p = normPhone(phone);
  const e = normEmail(email);
  const nm = str(name, 120);
  if (user_id) return ownClient(sdb, { name: nm, p, e, user_id, source });
  const online = source === 'online';
  if (!p && !e && !online) return walkinClient(sdb, nm);
  const where = online ? { deleted_at: null, user_id: null } : { deleted_at: null };
  let c = null;
  if (p) c = await sdb.findOne('clients', Object.assign({ phone: p }, where));
  if (!c && e) c = await sdb.findOne('clients', Object.assign({ email: e }, where));
  if (c) {
    const patch = {};
    if (!online) {
      if (e && !c.email) patch.email = e;
      if (p && !c.phone) patch.phone = p; // encontrada por correo: ninguna ficha tiene este teléfono
    }
    if (nm && (!c.name || c.name === 'Cliente')) patch.name = nm;
    await save(sdb, c, patch);
    return { client: c, created: false };
  }
  return { client: await insertClient(sdb, { name: nm, phone: p, email: e, source }), created: true };
}

// Regla 1: ficha propia del usuario con sesión.
async function ownClient(sdb, { name, p, e, user_id, source }) {
  const c = await sdb.findOne('clients', { user_id, deleted_at: null });
  if (c) {
    const patch = {};
    if (p && !c.phone && !(await usedBy(sdb, 'phone', p, c.id))) patch.phone = p;
    if (e && !c.email && !(await usedBy(sdb, 'email', e, c.id))) patch.email = e;
    if (name && (!c.name || c.name === 'Cliente')) patch.name = name;
    await save(sdb, c, patch);
    return { client: c, created: false };
  }
  const phoneFree = p && !(await usedBy(sdb, 'phone', p));
  const emailFree = e && !(await usedBy(sdb, 'email', e));
  const client = await insertClient(sdb, { name, phone: phoneFree ? p : null, email: emailFree ? e : null, user_id, source: source || 'online' });
  return { client, created: true };
}

// Regla 3: ficha genérica "Cliente de paso" (la más antigua si hubiera varias por altas simultáneas).
async function walkinClient(sdb, typedName) {
  const where = { source: WALKIN.source, name: WALKIN.name, phone: null, email: null, user_id: null, deleted_at: null };
  let [c] = await sdb.find('clients', where, { order: ['created_at asc', 'id asc'], limit: 1 });
  let created = false;
  if (!c) {
    c = await insertClient(sdb, { name: WALKIN.name, source: WALKIN.source, tags: [WALKIN.tag], marketing_ok: false });
    created = true;
  }
  return { client: Object.assign({}, c, { name: typedName || WALKIN.name }), created, generic: true };
}

// Prueba de que una ficha existente es de quien se registra (auth.js → linkClientAccount): los enlaces de gestión
// de TODAS sus citas (el cliente los recibió al reservar o por WhatsApp; la página pública los guarda en el
// dispositivo). Solo fichas sin cuenta; nunca la genérica de clientes de paso ni una sin citas. Si los tokens
// prueban varias fichas, la de más citas. db: base global (los tokens se buscan como en el enlace de gestión).
export const MAX_CLAIM_TOKENS = 20;
export async function provenClient(db, sdb, tokens) {
  const list = [...new Set((Array.isArray(tokens) ? tokens : []).filter((t) => typeof t === 'string'))].slice(0, MAX_CLAIM_TOKENS);
  const proven = new Set();
  const ids = new Set();
  for (const t of list) {
    const a = await findByManageToken(db, t);
    if (a && a.shop_id === sdb.shopId && a.client_id) { proven.add(a.id); ids.add(a.client_id); }
  }
  let best = null, bestN = 0;
  for (const id of ids) {
    const c = await sdb.findOne('clients', { id, user_id: null, deleted_at: null });
    if (!c || c.source === WALKIN.source) continue;
    const all = await sdb.find('appointments', { client_id: id });
    if (all.length > bestN && all.every((a) => proven.has(a.id))) { best = c; bestN = all.length; }
  }
  return best;
}

export async function usedBy(sdb, col, value, exceptId) {
  const where = { [col]: value, deleted_at: null };
  if (exceptId) where.id = { ne: exceptId };
  return !!(await sdb.findOne('clients', where));
}
async function save(sdb, c, patch) {
  if (!Object.keys(patch).length) return;
  patch.updated_at = nowIso();
  await sdb.update('clients', { id: c.id }, patch);
  Object.assign(c, patch);
}
function insertClient(sdb, { name, phone, email, user_id, source, tags, marketing_ok }) {
  return sdb.insert('clients', {
    id: newId('cl'), user_id: user_id || null, name: str(name, 120) || 'Cliente', phone: phone || null, email: email || null,
    tags: tags || [], source: source || 'manual', marketing_ok: marketing_ok === undefined ? true : marketing_ok, created_at: nowIso()
  });
}
