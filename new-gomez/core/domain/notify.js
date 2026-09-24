// Centro de notificaciones: una fila por destinatario (staff o cliente), con read_at propio.
import { newId, nowIso } from '../util.js';

// to: 'owners' | 'staff:<id>' | 'client:<id>' | array de esos. Se deduplican destinatarios.
export async function notify(sdb, to, { type, title, body, link, data }) {
  const targets = [].concat(to || []);
  const staffIds = new Set();
  const clientIds = new Set();
  for (const t of targets) {
    if (t === 'owners') {
      (await sdb.find('staff', { role: 'owner', active: true })).forEach((s) => staffIds.add(s.id));
    } else if (typeof t === 'string' && t.startsWith('staff:')) staffIds.add(t.slice(6));
    else if (typeof t === 'string' && t.startsWith('client:')) clientIds.add(t.slice(7));
  }
  const created_at = nowIso();
  const rows = [];
  for (const id of staffIds) if (id && id !== 'any') rows.push({ id: newId('nt'), staff_id: id, client_id: null, type, title, body: body || '', link: link || '', data: data || null, read_at: null, created_at });
  for (const id of clientIds) if (id) rows.push({ id: newId('nt'), staff_id: null, client_id: id, type, title, body: body || '', link: link || '', data: data || null, read_at: null, created_at });
  if (rows.length) await sdb.insertMany('notifications', rows);
  return rows.length;
}
