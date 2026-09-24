// Ficha de cliente (CRM). Se reutiliza la ficha existente por teléfono (o correo) dentro de la MISMA barbería.
import { newId, nowIso, normPhone, normEmail, str } from '../util.js';

export async function findOrCreateClient(sdb, { name, phone, email, user_id, source }) {
  const p = normPhone(phone);
  const e = normEmail(email);
  let c = null;
  if (user_id) c = await sdb.findOne('clients', { user_id, deleted_at: null });
  if (!c && p) c = await sdb.findOne('clients', { phone: p, deleted_at: null });
  if (!c && e) c = await sdb.findOne('clients', { email: e, deleted_at: null });
  if (c) {
    const patch = {};
    if (user_id && !c.user_id) patch.user_id = user_id;
    if (e && !c.email) patch.email = e;
    if (p && !c.phone) patch.phone = p;
    if (name && (!c.name || c.name === 'Cliente')) patch.name = str(name, 120);
    if (Object.keys(patch).length) { patch.updated_at = nowIso(); await sdb.update('clients', { id: c.id }, patch); Object.assign(c, patch); }
    return { client: c, created: false };
  }
  c = await sdb.insert('clients', {
    id: newId('cl'), user_id: user_id || null, name: str(name, 120) || 'Cliente', phone: p || null, email: e || null,
    tags: [], source: source || 'manual', marketing_ok: true, created_at: nowIso()
  });
  return { client: c, created: true };
}
