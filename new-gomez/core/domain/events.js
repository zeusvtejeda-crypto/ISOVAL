// Historial de cada cita (auditoría visible en el detalle de la cita).
import { newId, nowIso } from '../util.js';

// type: created | status | rescheduled | edited | note | payment | message
export async function logEvent(sdb, appointment_id, type, data, actor) {
  return sdb.insert('appointment_events', {
    id: newId('ev'), appointment_id, type, data: data || null,
    actor_id: actor && actor.id || null, actor_name: actor && actor.name || null, created_at: nowIso()
  });
}
