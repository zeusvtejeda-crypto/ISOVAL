// Pendiente (agente de agenda). Contrato:
//   openAppointment(id)                       → abre el detalle/edición de una cita
//   openNewAppointment({ date, start_min, staff_id, client }) → formulario de nueva cita
// Ambos devuelven una promesa que resuelve con la cita guardada (o null) y emiten bus 'appointments:changed'.
import { toast } from './ui.js';
export async function openAppointment(id) { toast.info('Detalle de cita en construcción'); return null; }
export async function openNewAppointment(prefill) { toast.info('Nueva cita en construcción'); return null; }
