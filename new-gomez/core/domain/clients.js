// Ficha de cliente (CRM), siempre dentro de la MISMA barbería (sdb con scope). La usan la reserva en línea
// (api/public.js, source 'online') y el alta de citas del panel (api/appointments.js, source 'manual'|'walkin').
//
//   findOrCreateClient(sdb, { name, phone, email, user_id?, user_email?, source })
//     → { client, created, generic? }
//
// Reglas (ver docs/API.md → "Fichas de cliente"):
//  1. Con user_id (reserva en línea con sesión de cliente): SOLO la ficha de ESE usuario. Nunca se le asigna
//     una ficha encontrada por el teléfono o el correo escritos en el formulario: cualquiera puede escribir
//     los datos de otra persona y se quedaría con su historial y sus citas. Si aún no tiene ficha:
//       - reclama una ficha SIN cuenta cuyo correo sea el de SU cuenta (`user_email`, que el llamador toma de
//         la sesión, no del formulario; misma regla que auth.js → linkClientAccount);
//       - si no, se le crea una ficha propia. El teléfono/correo escritos se guardan en ella solo si ninguna
//         otra ficha los usa (así no se duplican teléfonos en el CRM).
//  2. Sin user_id: se reutiliza la ficha por teléfono y, si no, por correo. Si los datos vienen de la reserva
//     en línea (source 'online', sin verificar) NO se agregan teléfono ni correo a la ficha existente: un
//     correo ajeno agregado así permitiría reclamarla después registrándose con él.
//  3. Sin teléfono, correo ni user_id, desde el panel ("cliente sin registro"): se reutiliza UNA ficha
//     genérica por barbería (WALKIN: 'Cliente de paso', source 'walkin', etiqueta 'Sin registro') en vez de
//     crear una ficha por cita. En ese caso `client` es una COPIA de la ficha genérica con `name` = el nombre
//     escrito (el llamador lo guarda en client_name de la cita; la ficha en la base no cambia) y
//     `generic: true`. La reserva en línea sin teléfono ni correo sigue creando su propia ficha.
import { newId, nowIso, normPhone, normEmail, str } from '../util.js';

export const WALKIN = Object.freeze({ name: 'Cliente de paso', source: 'walkin', tag: 'Sin registro' });

export async function findOrCreateClient(sdb, { name, phone, email, user_id, user_email, source }) {
  const p = normPhone(phone);
  const e = normEmail(email);
  const nm = str(name, 120);
  if (user_id) return ownClient(sdb, { name: nm, p, e, user_id, user_email: normEmail(user_email), source });
  const online = source === 'online';
  if (!p && !e && !online) return walkinClient(sdb, nm);
  let c = null;
  if (p) c = await sdb.findOne('clients', { phone: p, deleted_at: null });
  if (!c && e) c = await sdb.findOne('clients', { email: e, deleted_at: null });
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
async function ownClient(sdb, { name, p, e, user_id, user_email, source }) {
  const c = await sdb.findOne('clients', { user_id, deleted_at: null });
  if (c) {
    const patch = {};
    if (p && !c.phone && !(await usedBy(sdb, 'phone', p, c.id))) patch.phone = p;
    if (e && !c.email && !(await usedBy(sdb, 'email', e, c.id))) patch.email = e;
    if (name && (!c.name || c.name === 'Cliente')) patch.name = name;
    await save(sdb, c, patch);
    return { client: c, created: false };
  }
  if (user_email) {
    const m = await sdb.findOne('clients', { email: user_email, user_id: null, deleted_at: null });
    if (m) {
      const patch = { user_id, updated_at: nowIso() };
      if (p && !m.phone && !(await usedBy(sdb, 'phone', p, m.id))) patch.phone = p;
      // user_id: null en el where: si otra petición la reclamó al mismo tiempo, no se pisa.
      if (await sdb.update('clients', { id: m.id, user_id: null }, patch)) return { client: Object.assign(m, patch), created: false };
    }
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

async function usedBy(sdb, col, value, exceptId) {
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
